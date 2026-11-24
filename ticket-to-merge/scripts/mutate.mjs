#!/usr/bin/env node
// Mutation check: do the tests notice when the ticket's code is broken on purpose?
//   node mutate.mjs [--base <ref>] [--min 0.8]
// Takes every line the ticket added to src/**/*.ts (diff against the base), applies one small
// change at a time (a "mutant") in a throwaway copy of the project, and runs the suite.
//   killed   = at least one test failed on an assertion: the tests caught it
//   survived = everything still passed: a missing or weak test
//   invalid  = the change broke loading (not counted)
// No model calls, no dependencies, and the working tree is never touched.
// Exit 1 only when --min is given and the score is below it.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSuite } from './check-tests.mjs';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const tryGit = (...a) => { try { return git(...a); } catch { return ''; } };

// One mutant per match. Spaces around operators keep these off arrows (=>) and generics (<T>).
const OPERATORS = [
  { name: 'boundary', re: / > /g, to: ' >= ' },
  { name: 'boundary', re: / >= /g, to: ' > ' },
  { name: 'boundary', re: / < /g, to: ' <= ' },
  { name: 'boundary', re: / <= /g, to: ' < ' },
  { name: 'equality', re: / === /g, to: ' !== ' },
  { name: 'equality', re: / !== /g, to: ' === ' },
  { name: 'logic', re: / && /g, to: ' || ' },
  { name: 'logic', re: / \|\| /g, to: ' && ' },
  { name: 'sql-logic', re: / OR /g, to: ' AND ' },
  { name: 'sql-logic', re: / AND /g, to: ' OR ' },
  { name: 'no-trim', re: /\.trim\(\)/g, to: '' },
  { name: 'no-escape', re: /\.replace\(\/.*?\/[a-z]*,\s*(['"`]).*?\1\)/g, to: '' },
  { name: 'number+1', re: /\b\d{2,}\b/g, to: (m) => String(Number(m) + 1) },
  { name: 'no-throw', re: /throw new \w+\(.*\);/g, to: ';' },
  { name: 'no-status', re: /\.status\(\d+\)/g, to: '' },
];

function addedLines(base) {
  const out = {};
  let file = null;
  for (const line of git('diff', '-U0', base, '--', 'src').split('\n')) {
    if (line.startsWith('+++ ')) file = line.endsWith('.ts') ? line.replace('+++ b/', '') : null;
    const h = file && line.match(/^@@ .* \+(\d+)(?:,(\d+))? @@/);
    if (h) for (let i = 0; i < Number(h[2] ?? 1); i++) (out[file] ||= []).push(Number(h[1]) + i);
  }
  return out;
}

function mutantsFor(file, lines) {
  const src = readFileSync(join(root, file), 'utf8').split('\n');
  const list = [];
  for (const n of lines) {
    const text = src[n - 1] ?? '';
    if (/^\s*(\/\/|\*|import |export \{)/.test(text) || !text.trim()) continue;
    for (const op of OPERATORS) {
      for (const m of text.matchAll(op.re)) {
        const to = typeof op.to === 'function' ? op.to(m[0]) : op.to;
        const mutated = text.slice(0, m.index) + to + text.slice(m.index + m[0].length);
        list.push({ file, line: n, op: op.name, from: m[0].trim() || m[0], to: to.trim() || '(removed)', mutated, original: text });
      }
    }
  }
  return list;
}

const base = arg('base') || ['main', 'origin/main', 'upstream/main'].map((r) => tryGit('merge-base', 'HEAD', r)).find((s) => s && s !== tryGit('rev-parse', 'HEAD'));
if (!base) { console.log('MUTATION: no base found; pass --base <ref>'); process.exit(1); }
const mutants = Object.entries(addedLines(base)).flatMap(([f, ls]) => mutantsFor(f, ls));
if (!mutants.length) { console.log('MUTATION: the diff adds no mutable lines in src/**/*.ts'); process.exit(0); }

// Throwaway copy: the real tree, hooks and phase lock are never involved.
const work = mkdtempSync(join(tmpdir(), 'ttm-mutate-'));
for (const p of ['src', 'tests', 'package.json', 'tsconfig.json', 'vitest.config.ts']) {
  if (existsSync(join(root, p))) cpSync(join(root, p), join(work, p), { recursive: true });
}
symlinkSync(join(root, 'node_modules'), join(work, 'node_modules'));

const baseline = runSuite(work);
if (!baseline.ran || baseline.failed.length || baseline.loadErrors.length) {
  console.log('MUTATION: the suite must be green before mutating. Run the tests first.');
  rmSync(work, { recursive: true, force: true });
  process.exit(1);
}

for (const m of mutants) {
  const path = join(work, m.file);
  const lines = readFileSync(path, 'utf8').split('\n');
  lines[m.line - 1] = m.mutated;
  writeFileSync(path, lines.join('\n'));
  const s = runSuite(work);
  m.result = !s.ran ? 'invalid' : s.failed.length ? 'killed' : s.loadErrors.length ? 'invalid' : 'survived';
  m.killedBy = s.ran && s.failed[0] ? s.failed[0].fullName : '';
  lines[m.line - 1] = m.original;
  writeFileSync(path, lines.join('\n'));
}
rmSync(work, { recursive: true, force: true });

const count = (r) => mutants.filter((m) => m.result === r).length;
const valid = count('killed') + count('survived');
const score = valid ? count('killed') / valid : 1;
console.log(`MUTATION: ${count('killed')}/${valid} killed (${(100 * score).toFixed(0)}%) · ${count('survived')} survived · ${count('invalid')} invalid · suite ${baseline.total} tests`);
const survivors = mutants.filter((m) => m.result === 'survived');
if (survivors.length) {
  console.log('Survived (no test noticed this change):');
  for (const m of survivors) console.log(`- ${m.file}:${m.line} [${m.op}] \`${m.from}\` → \`${m.to}\` in: ${m.original.trim()}`);
}
if (process.argv.includes('--verbose')) {
  for (const m of mutants.filter((x) => x.result !== 'survived')) console.log(`  ${m.result.padEnd(8)} ${m.file}:${m.line} [${m.op}] ${m.from} → ${m.to}${m.killedBy ? `  ← ${m.killedBy}` : ''}`);
}
const min = arg('min');
process.exit(min !== undefined && score < Number(min) ? 1 : 0);
