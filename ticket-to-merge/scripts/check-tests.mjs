#!/usr/bin/env node
// Deterministic test gate for ship-ticket. Node built-ins only.
//   node check-tests.mjs red   [--acs 7]   tests were written first: every AC has a test, something fails,
//                                          no file failed to load, and nothing that passed before is broken
//   node check-tests.mjs green [--acs 7]   everything passes and every AC still has a test
// Exit 0 = the gate holds, 1 = it doesn't. Output is short on purpose (it goes into an agent's context).
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Run the Vitest suite once and return a small summary. */
export function runSuite(root) {
  const out = join(tmpdir(), `ttm-vitest-${process.pid}-${Date.now()}.json`);
  const r = spawnSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${out}`], {
    cwd: root,
    encoding: 'utf8',
    timeout: 150_000,
  });
  if (!existsSync(out)) {
    return { ran: false, error: (r.stderr || r.stdout || 'vitest produced no report').trim().split('\n').slice(-15).join('\n') };
  }
  const report = JSON.parse(readFileSync(out, 'utf8'));
  rmSync(out, { force: true });

  const tests = [];
  const loadErrors = [];
  for (const file of report.testResults || []) {
    const name = file.name.replace(root + '/', '');
    if (!file.assertionResults?.length && file.status === 'failed') {
      loadErrors.push(`${name}: ${firstLines(file.message, 3)}`);
    }
    for (const t of file.assertionResults || []) {
      tests.push({ file: name, title: t.title, fullName: t.fullName, status: t.status, message: firstLines((t.failureMessages || [])[0], 4) });
    }
  }
  return {
    ran: true,
    total: tests.length,
    passed: tests.filter((t) => t.status === 'passed').length,
    failed: tests.filter((t) => t.status === 'failed'),
    loadErrors,
    tests,
  };
}

const firstLines = (text, n) => String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, n).join(' | ');

/** Which acceptance criteria (AC1..ACn) have a test named after them, and which of those fail. */
export function acCoverage(tests, count) {
  const rows = [];
  for (let i = 1; i <= count; i++) {
    const re = new RegExp(`\\bAC${i}\\b`);
    const mine = tests.filter((t) => re.test(t.fullName));
    rows.push({ ac: `AC${i}`, tests: mine.length, failing: mine.filter((t) => t.status === 'failed').length });
  }
  return rows;
}

function main() {
  const mode = process.argv[2];
  const acsAt = process.argv.indexOf('--acs');
  const acs = acsAt > 0 ? Number(process.argv[acsAt + 1]) : 7;
  if (!['red', 'green'].includes(mode)) {
    console.error('usage: check-tests.mjs red|green [--acs N]');
    process.exit(1);
  }
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const s = runSuite(root);
  if (!s.ran) {
    console.log(`GATE ${mode.toUpperCase()}: FAIL · the suite did not run\n${s.error}`);
    process.exit(1);
  }
  const cov = acCoverage(s.tests, acs);
  const uncovered = cov.filter((c) => c.tests === 0).map((c) => c.ac);
  const acTests = (t) => /\bAC\d+\b/.test(t.fullName);
  const brokenOld = s.failed.filter((t) => !acTests(t));
  const problems = [];

  if (uncovered.length) problems.push(`no test named after: ${uncovered.join(', ')}`);
  if (s.loadErrors.length) problems.push(`test files failed to load (fix these, a red test must fail on an assertion):\n  - ${s.loadErrors.join('\n  - ')}`);

  if (mode === 'red') {
    if (!s.failed.length) problems.push('nothing fails: the new tests do not describe any missing behaviour');
    if (brokenOld.length) problems.push(`tests that are not AC tests now fail:\n  - ${brokenOld.map((t) => t.fullName).join('\n  - ')}`);
  } else if (s.failed.length) {
    problems.push(`${s.failed.length} failing:\n  - ${s.failed.slice(0, 12).map((t) => `${t.fullName} → ${t.message}`).join('\n  - ')}`);
  }

  const ok = problems.length === 0;
  console.log(`GATE ${mode.toUpperCase()}: ${ok ? 'OK' : 'FAIL'} · ${s.passed}/${s.total} passed, ${s.failed.length} failed`);
  console.log(cov.map((c) => `${c.ac}: ${c.tests} tests${mode === 'red' ? `, ${c.failing} failing` : ''}`).join(' · '));
  if (mode === 'red' && ok) {
    const alreadyGreen = cov.filter((c) => c.tests > 0 && c.failing === 0).map((c) => c.ac);
    if (alreadyGreen.length) console.log(`already satisfied by the current code (no failing test): ${alreadyGreen.join(', ')}`);
  }
  if (!ok) console.log(problems.join('\n'));
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
