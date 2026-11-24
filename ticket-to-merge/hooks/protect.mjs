#!/usr/bin/env node
// Layer 1 · PreToolUse guardrail. Exit 2 blocks the tool call; stderr goes back to Claude.
// Protects bookshelf.db*, src/db/seed.sql and .env (see lib.mjs PROTECTED).
// String matching can't see through every obfuscation, so layer 2 (integrity.mjs) re-checks
// file hashes after every tool call and restores anything that changed.
import { readInput, block, projectRoot, protectedKind, isAncestorOfProtected, ensureBaseline, readState, lockedDir, PHASES } from './lib.mjs';

const input = readInput();
const tool = input.tool_name || '';
const ti = input.tool_input || {};
const root = projectRoot(input);
const cwd = input.cwd || root;

try { ensureBaseline(root); } catch {}

// Phase lock (see lib.mjs PHASES): the tester can't write src/, the implementer can't write tests/.
const phase = readState(root).phase;
const inSubagent = Boolean(input.agent_id || input.agent_type);
const STATE_RE = /\.git\/ticket-to-merge|ticket-to-merge\/(phase|baseline)\.json/;

function checkPhasePath(p) {
  if (STATE_RE.test(String(p || ''))) block('the guardrail state is not editable.');
  const dir = lockedDir(p, root, cwd, phase);
  if (dir) block(`${dir}/ is read-only in the '${phase}' phase. If something in ${dir}/ looks wrong, stop and report it instead of changing it.`);
}

function checkPhaseBash(cmd) {
  if (STATE_RE.test(cmd)) block('the guardrail state is not editable.');
  // Only the orchestrator (main session) switches phases.
  if (/phase\.mjs/.test(cmd) && inSubagent) block('only the ship-ticket orchestrator changes the phase.');
  if (phase === 'off') return;
  if (/\bgit\s+(checkout|restore|reset|stash|rm|mv|apply|am|revert|cherry-pick|rebase|merge|clean)\b/.test(cmd)) {
    block(`git commands that rewrite the working tree are not allowed in the '${phase}' phase.`);
  }
  for (const dir of PHASES[phase]) {
    const target = `(^|[\\s/=])${dir}(/|\\s|$)`;
    const verb = new RegExp(`(^|[;&|(\\s])(rm|mv|cp|ln|tee|truncate|dd|touch|install|rsync|mkdir|sed\\s+(-[a-zA-Z]*i|--in-place)|perl\\s+-[a-zA-Z]*i)\\b[^;&|]*${target}`);
    const redirect = new RegExp(`>{1,2}\\s*\\S*\\b${dir}/`);
    if (verb.test(cmd) || redirect.test(cmd)) {
      block(`${dir}/ is read-only in the '${phase}' phase. If something in ${dir}/ looks wrong, stop and report it instead of changing it.`);
    }
  }
}

const WRITE_API = /(writeFile|appendFile|unlink|rmSync|rmdirSync|\brm\(|rename|copyFile|truncate|createWriteStream|\bopen\s*\(|os\.remove|shutil|\.write_text|\.write_bytes|DROP\s+TABLE|DELETE\s+FROM|UPDATE\s+\w+\s+SET|INSERT\s+INTO)/i;
// Name must start at a path boundary: /tmp/test-bookshelf.db (the tests' DB) is not protected.
const PROTECTED_TOKEN = /((^|[^\w-])bookshelf\.db|(^|[^\w-])seed\.sql|(^|[^\w.])\.env(?!\.example)\b)/;

function checkPath(p, forRead = false) {
  const kind = protectedKind(p, { forRead });
  if (kind) block(`'${p}' is protected ${kind}. Don't read, edit, move or delete it.`);
}

switch (tool) {
  case 'Read':
    checkPath(ti.file_path, true);
    break;

  case 'Edit':
  case 'Write':
  case 'MultiEdit':
  case 'NotebookEdit': {
    checkPath(ti.file_path || ti.notebook_path);
    checkPhasePath(ti.file_path || ti.notebook_path);
    // A script that will write to a protected file later (node tamper.mjs) is blocked when written.
    const text = [ti.content, ti.new_string, ...(ti.edits || []).map((e) => e.new_string)].filter(Boolean).join('\n');
    const name = String(ti.file_path || '');
    const isAppDb = /src[\/\\]db[\/\\]index\.ts$/.test(name); // the app's own DB layer legitimately saves bookshelf.db
    if (!isAppDb && PROTECTED_TOKEN.test(text) && WRITE_API.test(text)) {
      block(`'${name}' would contain code that writes to a protected file (bookshelf.db, seed.sql, .env).`);
    }
    break;
  }

  case 'Bash': {
    const raw = String(ti.command || '');
    // De-obfuscate the usual tricks: quotes and backslashes inside words (book''shelf.db, seed\.sql).
    const cmd = raw.replace(/\\\n/g, ' ').replace(/['"\\]/g, '');
    checkPhaseBash(cmd);

    // 1. Inline code and decoded payloads can't be inspected reliably: block them outright.
    if (/\b(node|deno|bun)\s+(-e|--eval|-p|--print)\b|\bpython3?\s+-c\b|\b(perl|ruby)\s+-[a-z]*e\b|\b(ba|z|da|k)?sh\s+-c\b|\beval\b|base64\s+(-d|--decode|-D)|\bxxd\s+-r/.test(cmd)) {
      block('inline interpreter code (node -e, python -c, sh -c, eval, base64 -d) is not allowed; write a script file instead.');
    }

    // 2. Names a protected file directly.
    if (PROTECTED_TOKEN.test(cmd)) {
      const readOnly = /^\s*(git\s+(diff|log|show|status|blame)|cat|head|tail|grep|rg|wc|ls|stat|file|shasum|sha256sum|diff)\b[^;&|`$<>]*$/.test(raw);
      const touchesEnv = /(^|[^\w.])\.env(?!\.example)\b/.test(cmd);
      if (!readOnly || touchesEnv) block('command references a protected file (bookshelf.db, seed.sql, .env).');
    }

    // 3. Indirect targets: globs, variables or directories that contain a protected file.
    const WRITE_VERB = /(^|[;&|(\s])(rm|mv|cp|ln|tee|truncate|dd|shred|install|rsync|unlink|chmod|chown|touch|sqlite3|tar|unzip|sed\s+(-[a-zA-Z]*i|--in-place)|perl\s+-[a-zA-Z]*i)\b|>|\bfind\b.*\s-(delete|exec|execdir|ok)\b|\bxargs\b/;
    if (WRITE_VERB.test(cmd)) {
      if (/[*?[\]{}]|\$[\w{(]|`/.test(cmd) && /(db|sql|seed|env|book|src)/i.test(cmd.replace(/\b(node_modules|dist)\b/g, ''))) {
        block('a write/delete command with globs or variables near the db/seed/env files; name explicit, unprotected paths.');
      }
      const args = cmd.split(/[\s;&|()]+/).filter(Boolean);
      const hit = args.find((a) => isAncestorOfProtected(a.replace(/\/+$/, '') || '/', root, cwd));
      if (hit && /(^|[;&|(\s])(rm|mv|cp|rsync|chmod|chown|find|tar|shred|ln)\b/.test(cmd)) {
        block(`'${hit}' contains a protected file; target the files you mean instead of the directory.`);
      }
    }

    // 4. Git commands that rewrite or wipe the working tree (would restore/delete seed.sql, .env, bookshelf.db).
    if (/\bgit\s+(clean\b|reset\s+.*--hard|stash\b.*(-u|--include-untracked|-a|--all)|checkout\s+(.*\s)?(--\s+)?\.(\s|$)|restore\b.*(\s\.(\s|$)|--source|src|seed)|rm\b.*(-r|src|seed|\.db))/.test(cmd)) {
      block('git command that wipes or rewrites working-tree files (clean, reset --hard, checkout ., restore, stash -u, rm -r).');
    }
    break;
  }
}
process.exit(0);
