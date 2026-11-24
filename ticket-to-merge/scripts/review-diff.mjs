#!/usr/bin/env node
// Prepare the diff for the read-only reviewers (they have no Bash, so they can't run git).
//   node review-diff.mjs [base]     base = a ref or sha; default: merge-base of HEAD with main
// Writes an annotated diff to a temp file, every line prefixed with its line number in the NEW file,
// so findings can cite exact lines. Prints a JSON summary: { base, head, diffFile, files, changedLines }.
// Includes uncommitted changes. Node built-ins only.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
const tryGit = (...args) => { try { return git(...args).trim(); } catch { return ''; } };

function findBase(arg) {
  if (arg) {
    const sha = tryGit('rev-parse', '--verify', `${arg.replace(/\.\.\.?.*$/, '')}^{commit}`);
    if (!sha) fail(`'${arg}' is not a commit or ref in this repo`);
    return sha;
  }
  const head = tryGit('rev-parse', 'HEAD');
  for (const ref of ['origin/main', 'main', 'upstream/main', 'origin/master', 'master']) {
    const mb = tryGit('merge-base', 'HEAD', ref);
    if (mb && mb !== head) return mb;
  }
  fail('could not find a base: HEAD is on main (or main does not exist). Pass one: review-pr <base ref or sha>');
}

function fail(msg) {
  console.log(JSON.stringify({ error: msg }));
  process.exit(1);
}

const base = findBase(process.argv[2]);
// Not review material: generated output, lock files, and this plugin itself if it lives in the repo.
const exclude = ['dist', 'node_modules', 'package-lock.json'];
const plugin = process.env.CLAUDE_PLUGIN_ROOT || dirname(dirname(fileURLToPath(import.meta.url)));
if (plugin && isAbsolute(plugin)) {
  const rel = relative(root, plugin);
  if (rel && !rel.startsWith('..')) exclude.push(rel);
}
const pathspec = ['--', '.', ...exclude.map((p) => `:(exclude)${p}`)];
const raw = git('diff', '--no-color', '--no-ext-diff', '-U12', base, ...pathspec);

const out = [];
const files = [];
let cur = null;
let newLine = 0;
for (const line of raw.split('\n')) {
  if (line.startsWith('diff --git ')) {
    cur = { path: line.replace(/^diff --git a\/.* b\//, ''), added: 0, deleted: 0 };
    files.push(cur);
    out.push('', `===== ${cur.path} =====`);
  } else if (line.startsWith('@@')) {
    newLine = Number((line.match(/\+(\d+)/) || [])[1] || 0);
    out.push(`   ... ${line}`);
  } else if (!cur || /^(index |--- |\+\+\+ |new file|deleted file|similarity|rename |old mode|new mode|Binary)/.test(line)) {
    if (/^(new file|deleted file|rename |Binary)/.test(line)) out.push(`   ... ${line}`);
  } else if (line.startsWith('+')) {
    out.push(`${String(newLine).padStart(5)} + ${line.slice(1)}`);
    newLine++;
    cur.added++;
  } else if (line.startsWith('-')) {
    out.push(`      - ${line.slice(1)}`);
    cur.deleted++;
  } else if (line.startsWith(' ')) {
    out.push(`${String(newLine).padStart(5)}   ${line.slice(1)}`);
    newLine++;
  }
}

const head = tryGit('rev-parse', '--short', 'HEAD');
const diffFile = join(tmpdir(), `ttm-review-${head}-${Date.now()}.diff`);
const legend = 'Legend: "<n> + code" = added line n of the new file · "- code" = removed line · "<n>   code" = unchanged context.\n';
writeFileSync(diffFile, legend + out.join('\n') + '\n');

console.log(JSON.stringify({
  base: base.slice(0, 10),
  head,
  branch: tryGit('branch', '--show-current'),
  diffFile,
  diffLines: out.length,
  changedLines: files.reduce((n, f) => n + f.added + f.deleted, 0),
  files,
  commits: tryGit('log', '--format=%s', `${base}..HEAD`).split('\n').filter(Boolean).slice(0, 20),
}, null, 2));
