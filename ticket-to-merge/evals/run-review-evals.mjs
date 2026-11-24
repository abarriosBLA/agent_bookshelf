#!/usr/bin/env node
// Planted-bug eval for /ticket-to-merge:review-pr. Node built-ins only.
//   node ticket-to-merge/evals/run-review-evals.mjs [--set planted|hard] [--runs 3] [--label base] [--model sonnet] [--subagent-model haiku]
// For each run it builds two throwaway branches off main in a temp clone:
//   planted = the BOOK-101 implementation + evals/<set>/bugs.patch (planted bugs and clean decoys)
//   clean   = the BOOK-101 implementation as shipped (any finding here is a false positive)
// then runs review-pr headless on each, parses the JSON findings and scores them.
// Recall = plants found / plants. Precision = findings that match a plant / all findings (both cases).
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = dirname(HERE);
const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: HERE, encoding: 'utf8' }).trim();
const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const SET = arg('set', 'planted');
const expected = JSON.parse(readFileSync(join(HERE, SET, 'expected.json'), 'utf8'));
const RUNS = Number(arg('runs', 3));
const LABEL = arg('label', SET === 'planted' ? 'base' : SET);
const MODEL = arg('model', 'sonnet');
const SUBAGENT_MODEL = arg('subagent-model', '');
const LINE_TOLERANCE = 3;

function workspace(kind, run) {
  const dir = mkdtempSync(join(tmpdir(), `ttm-eval-${kind}-${run}-`));
  const git = (...a) => execFileSync('git', ['-c', 'user.email=eval@local', '-c', 'user.name=eval', ...a], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['clone', '-q', REPO, dir], { stdio: 'pipe' });
  git('checkout', '-q', '-b', `eval/${kind}`, 'origin/main');
  git('checkout', expected.impl, '--', 'src', 'tests');
  if (kind === 'planted') git('apply', join(HERE, SET, 'bugs.patch'));
  git('add', '-A');
  git('commit', '-qm', 'feat: search books by title or author');
  return dir;
}

function review(dir) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.CLAUDE_PROJECT_DIR;
    if (SUBAGENT_MODEL) env.CLAUDE_CODE_SUBAGENT_MODEL = SUBAGENT_MODEL;
    const p = spawn('claude', ['-p', '/ticket-to-merge:review-pr', '--plugin-dir', PLUGIN, '--model', MODEL,
      '--allowedTools', 'Bash', 'Read', 'Grep', 'Glob', 'Agent', 'Task', '--output-format', 'json'], { cwd: dir, env, stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', () => {
      try {
        const r = JSON.parse(out);
        const block = [...String(r.result || '').matchAll(/```json\s*([\s\S]*?)```/g)].pop();
        resolve({ ok: Boolean(block), findings: block ? JSON.parse(block[1]) : [], cost: r.total_cost_usd || 0, seconds: Math.round((r.duration_ms || 0) / 1000), raw: r.result });
      } catch (e) {
        resolve({ ok: false, findings: [], cost: 0, seconds: 0, raw: out.slice(-2000), error: String(e) });
      }
    });
  });
}

/** Line of each plant in this workspace, found by its anchor text. */
function plantLines(dir) {
  // A plant can show up in more than one place (a new dependency: package.json and the import).
  return expected.plants.map((p) => ({
    ...p,
    spots: [{ file: p.file, anchor: p.anchor }, ...(p.also || [])].map((a) => {
      const lines = readFileSync(join(dir, a.file), 'utf8').split('\n');
      return { file: a.file, line: lines.findIndex((l) => l.includes(a.anchor)) + 1 };
    }),
  }));
}

function score(findings, plants) {
  const found = new Set();
  const rows = findings.map((f) => {
    const text = `${f.issue} ${f.evidence}`;
    const hit = plants.filter((p) => new RegExp(p.keywords, 'i').test(text) && p.spots.some((s) => s.file === f.file && Math.abs(Number(f.line) - s.line) <= LINE_TOLERANCE));
    hit.forEach((p) => found.add(p.id));
    return { file: f.file, line: f.line, severity: f.severity, issue: f.issue, matches: hit.map((p) => p.id) };
  });
  return { found: [...found].sort(), real: rows.filter((r) => r.matches.length).length, total: rows.length, rows };
}

const jobs = [];
for (let run = 1; run <= RUNS; run++) {
  for (const kind of ['planted', 'clean']) {
    const dir = workspace(kind, run);
    const plants = kind === 'planted' ? plantLines(dir) : [];
    jobs.push(review(dir).then((r) => {
      const s = score(r.findings, plants);
      rmSync(dir, { recursive: true, force: true });
      return { run, kind, ok: r.ok, cost: r.cost, seconds: r.seconds, ...s, missed: plants.map((p) => p.id).filter((id) => !s.found.includes(id)), raw: r.ok ? undefined : r.raw };
    }));
  }
}
const results = (await Promise.all(jobs)).sort((a, b) => a.run - b.run || b.kind.localeCompare(a.kind));

const N = expected.plants.length;
console.log(`\n| Run | Case | Found | Missed | Findings | Real | False positives | Cost | Time |\n|---|---|---|---|---|---|---|---|---|`);
for (const r of results) {
  console.log(`| ${r.run} | ${r.kind}${r.ok ? '' : ' (NO JSON)'} | ${r.kind === 'planted' ? `${r.found.length}/${N}` : '-'} | ${r.missed.join(' ') || '-'} | ${r.total} | ${r.real} | ${r.total - r.real} | $${r.cost.toFixed(2)} | ${r.seconds}s |`);
}
const planted = results.filter((r) => r.kind === 'planted');
const found = planted.reduce((n, r) => n + r.found.length, 0);
const total = results.reduce((n, r) => n + r.total, 0);
const real = results.reduce((n, r) => n + r.real, 0);
const summary = {
  label: LABEL, set: SET, model: MODEL, subagentModel: SUBAGENT_MODEL || 'agent default (sonnet)', runs: RUNS,
  recall: found / (N * planted.length), precision: total ? real / total : 1,
  cost: results.reduce((n, r) => n + r.cost, 0),
};
console.log(`\nRecall ${(100 * summary.recall).toFixed(0)}% (${found}/${N * planted.length}) · Precision ${(100 * summary.precision).toFixed(0)}% (${real}/${total}) · Cost $${summary.cost.toFixed(2)} for ${results.length} reviews`);
const fps = results.flatMap((r) => r.rows.filter((x) => !x.matches.length).map((x) => `run ${r.run} ${r.kind}: ${x.file}:${x.line} ${x.issue}`));
if (fps.length) console.log(`\nFalse positives:\n- ${fps.join('\n- ')}`);
mkdirSync(join(HERE, 'results'), { recursive: true });
writeFileSync(join(HERE, 'results', `${LABEL}.json`), JSON.stringify({ summary, results }, null, 2) + '\n');
console.log(`\nSaved evals/results/${LABEL}.json`);
