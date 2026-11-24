// Shared helpers for the ticket-to-merge guardrail hooks. Node built-ins only.
import { readFileSync, existsSync, mkdirSync, writeFileSync, copyFileSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename, resolve, relative, isAbsolute, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

// Files no agent may touch, relative to the project root.
// `secret: true` = never read either, and never copied into the backup.
export const PROTECTED = [
  { path: 'bookshelf.db' },
  { path: 'bookshelf.db-wal' },
  { path: 'bookshelf.db-shm' },
  { path: 'bookshelf.db-journal' },
  { path: 'src/db/seed.sql' },
  { path: '.env', secret: true },
];

// Basename patterns, so a path given any way (absolute, ./, ../x/..) still matches.
const DB_RE = /^bookshelf\.db(-wal|-shm|-journal)?$/;
const SEED_RE = /^seed\.sql$/;
const ENV_RE = /^\.env(\..+)?$/;

export function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

export function block(reason) {
  process.stderr.write(`BLOCKED by ticket-to-merge guardrail: ${reason}\n`);
  process.exit(2);
}

export function projectRoot(input) {
  return process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
}

/** Is this file path one of the protected files? Returns the kind or null. */
export function protectedKind(filePath, { forRead = false } = {}) {
  if (!filePath) return null;
  const name = basename(String(filePath));
  if (ENV_RE.test(name) && name !== '.env.example') return 'secret (.env)';
  if (forRead) return null; // reading the DB or the seed is harmless
  if (DB_RE.test(name)) return 'database (bookshelf.db)';
  if (SEED_RE.test(name)) return 'seed data (seed.sql)';
  return null;
}

/** Directories that contain a protected file: deleting/resetting them is a bypass. */
export function isAncestorOfProtected(arg, root, cwd) {
  if (!arg || arg.startsWith('-')) return false;
  const abs = isAbsolute(arg) ? arg : resolve(cwd || root, arg);
  return PROTECTED.some(({ path }) => {
    const target = join(root, path);
    const rel = relative(abs, target);
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
  });
}

// ---- integrity baseline (layer 2) ----
// Lives in .git/ticket-to-merge/, outside the working tree, so it's never diffed or committed.
function stateDir(root) {
  let gitDir = join(root, '.git');
  try {
    gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {}
  return join(gitDir, 'ticket-to-merge');
}

const hash = (file) => (existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex') : null);

export function snapshot(root) {
  const dir = stateDir(root);
  mkdirSync(join(dir, 'backup'), { recursive: true });
  const hashes = {};
  for (const { path, secret } of PROTECTED) {
    const abs = join(root, path);
    hashes[path] = hash(abs);
    if (hashes[path] && !secret) {
      const dest = join(dir, 'backup', path.split('/').join('__'));
      copyFileSync(abs, dest);
      chmodSync(dest, 0o600);
    }
  }
  writeFileSync(join(dir, 'baseline.json'), JSON.stringify(hashes, null, 2));
  return hashes;
}

export function ensureBaseline(root) {
  if (!existsSync(join(stateDir(root), 'baseline.json'))) snapshot(root);
}

/** Compare protected files with the baseline; restore what we can. Returns a list of problems. */
export function verifyAndRestore(root) {
  const dir = stateDir(root);
  const file = join(dir, 'baseline.json');
  if (!existsSync(file)) {
    snapshot(root);
    return [];
  }
  const baseline = JSON.parse(readFileSync(file, 'utf8'));
  const problems = [];
  for (const { path, secret } of PROTECTED) {
    const abs = join(root, path);
    const now = hash(abs);
    if (now === baseline[path]) continue;
    const backup = join(dir, 'backup', path.split('/').join('__'));
    if (baseline[path] && !secret && existsSync(backup)) {
      copyFileSync(backup, abs);
      problems.push(`${path} was modified or deleted; restored from the session-start copy`);
    } else if (!baseline[path] && !secret) {
      // didn't exist at session start (e.g. bookshelf.db created by running the app): remove it
      try { execFileSync('rm', ['-f', abs]); } catch {}
      problems.push(`${path} was created; removed it`);
    } else {
      problems.push(`${path} changed and can't be restored automatically (secret); tell the human`);
    }
  }
  return problems;
}

export { sep };

// ---- phase lock (stage 2) ----
// ship-ticket runs in phases. Each phase locks the directories its agent must not write:
// the tester can't touch src/, the implementer can't touch tests/, reviewers can't touch either.
// The phase lives next to the baseline in .git/ticket-to-merge/, set only through hooks/phase.mjs.
export const PHASES = { off: [], test: ['src'], implement: ['tests'], review: ['src', 'tests'] };

const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/** Fingerprint of a directory's state relative to HEAD (tracked changes + untracked file names). */
function dirState(root, dir) {
  try {
    const status = git(root, ['status', '--porcelain', '--', dir]);
    const diff = git(root, ['diff', 'HEAD', '--', dir]);
    return { clean: status.trim() === '', sig: createHash('sha256').update(status + diff).digest('hex') };
  } catch {
    return { clean: false, sig: null }; // not a git repo or no commits yet: nothing to compare against
  }
}

export function readState(root) {
  try {
    const st = JSON.parse(readFileSync(join(stateDir(root), 'phase.json'), 'utf8'));
    return PHASES[st.phase] ? st : { phase: 'off', locked: {}, gateBlocks: 0 };
  } catch {
    return { phase: 'off', locked: {}, gateBlocks: 0 };
  }
}

export function writeState(root, st) {
  mkdirSync(stateDir(root), { recursive: true });
  writeFileSync(join(stateDir(root), 'phase.json'), JSON.stringify(st, null, 2));
}

export function setPhase(root, phase) {
  if (!PHASES[phase]) throw new Error(`unknown phase '${phase}' (use: ${Object.keys(PHASES).join(', ')})`);
  const locked = {};
  for (const dir of PHASES[phase]) locked[dir] = dirState(root, dir);
  writeState(root, { phase, locked, gateBlocks: 0 });
  return locked;
}

/** If this path is inside a directory locked by the current phase, return that directory. */
export function lockedDir(filePath, root, cwd, phase) {
  if (!filePath) return null;
  const abs = isAbsolute(String(filePath)) ? String(filePath) : resolve(cwd || root, String(filePath));
  const rel = relative(root, abs);
  return (PHASES[phase] || []).find((dir) => rel === dir || rel.startsWith(dir + sep)) || null;
}

/** Layer 2 for the phase lock: a locked directory that changed is put back to HEAD. */
export function verifyLocked(root) {
  const st = readState(root);
  const problems = [];
  for (const dir of PHASES[st.phase]) {
    const before = st.locked?.[dir];
    const now = dirState(root, dir);
    if (!before || !before.sig || now.sig === before.sig) continue;
    if (before.clean) {
      try {
        git(root, ['checkout', 'HEAD', '--', dir]);
        git(root, ['clean', '-fdq', '--', dir]);
      } catch {}
      problems.push(`${dir}/ is read-only in the '${st.phase}' phase; your change was reverted to the last commit`);
    } else {
      st.locked[dir] = now; // tree was already dirty when the phase started: report once, never discard a human's work
      writeState(root, st);
      problems.push(`${dir}/ is read-only in the '${st.phase}' phase and it changed; undo that change`);
    }
  }
  return problems;
}
