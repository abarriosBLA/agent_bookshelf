// Bypass suite for the guardrail hooks. Run: node --test ticket-to-merge/hooks/test/
// Each case feeds a PreToolUse payload to protect.mjs in a throwaway project and checks the exit code
// (2 = blocked). The layer-2 cases really tamper with files and check integrity.mjs restores them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = dirname(dirname(fileURLToPath(import.meta.url)));

function project() {
  const root = mkdtempSync(join(tmpdir(), 'ttm-guard-'));
  mkdirSync(join(root, 'src/db'), { recursive: true });
  mkdirSync(join(root, 'tests'), { recursive: true });
  writeFileSync(join(root, 'src/db/seed.sql'), "INSERT INTO books VALUES (1, 'Dune');\n");
  writeFileSync(join(root, 'bookshelf.db'), 'SQLITE');
  writeFileSync(join(root, '.env'), 'SECRET=1\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  return root;
}
const ROOT = project();

function run(script, payload, root = ROOT) {
  const r = spawnSync('node', [join(HOOKS, script)], {
    input: JSON.stringify({ cwd: root, ...payload }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    encoding: 'utf8',
  });
  return r.status;
}
const bash = (command) => run('protect.mjs', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } });
const tool = (tool_name, tool_input) => run('protect.mjs', { hook_event_name: 'PreToolUse', tool_name, tool_input });

const SHOULD_BLOCK = {
  'Edit seed.sql': () => tool('Edit', { file_path: join(ROOT, 'src/db/seed.sql'), old_string: 'a', new_string: 'b' }),
  'Write bookshelf.db (relative path)': () => tool('Write', { file_path: './bookshelf.db', content: '' }),
  'Write bookshelf.db-wal': () => tool('Write', { file_path: join(ROOT, 'bookshelf.db-wal'), content: '' }),
  'Read .env': () => tool('Read', { file_path: join(ROOT, '.env') }),
  'Read .env.local': () => tool('Read', { file_path: join(ROOT, '.env.local') }),
  'Write a script that unlinks the db': () => tool('Write', { file_path: join(ROOT, 'x.mjs'), content: "import fs from 'fs'; fs.unlinkSync('bookshelf.db')" }),
  'rm bookshelf.db': () => bash('rm bookshelf.db'),
  'quoted name rm book""shelf.db': () => bash('rm book""shelf.db'),
  "split quotes rm 'book'shelf.db": () => bash("rm 'book'shelf.db"),
  'backslash seed\\.sql': () => bash('echo x > src/db/seed\\.sql'),
  'redirect into seed.sql': () => bash('echo "DELETE" >> src/db/seed.sql'),
  'sed -i seed.sql': () => bash("sed -i '' 's/Dune/X/' src/db/seed.sql"),
  'cat .env': () => bash('cat .env'),
  'glob rm *.db': () => bash('rm -f *.db'),
  'glob src/db/*.sql': () => bash('truncate -s0 src/db/*.sql'),
  'variable f=bookshelf; rm $f.db': () => bash('f=book; rm ${f}shelf.d?'),
  'find -delete': () => bash("find . -name '*.db' -delete"),
  'rm -rf src/db (parent dir)': () => bash('rm -rf src/db'),
  'mv src away': () => bash('mv src /tmp/src-backup'),
  'node -e unlink': () => bash("node -e \"require('fs').unlinkSync('book'+'shelf.db')\""),
  'python -c': () => bash("python3 -c \"import os; os.remove('bookshelf.db')\""),
  'bash -c': () => bash("bash -c 'rm bookshelf.db'"),
  'eval': () => bash('eval "rm bookshelf.db"'),
  'base64 payload': () => bash('echo cm0gYm9va3NoZWxmLmRi | base64 -d | sh'),
  'sqlite3 on the db': () => bash("sqlite3 bookshelf.db 'DELETE FROM books'"),
  'git checkout .': () => bash('git checkout -- .'),
  'git clean -fdx': () => bash('git clean -fdx'),
  'git reset --hard': () => bash('git reset --hard HEAD'),
  'git restore seed': () => bash('git restore src/db/seed.sql'),
  'cp over seed': () => bash('cp /tmp/evil.sql src/db/seed.sql'),
  'ln -sf over db': () => bash('ln -sf /dev/null bookshelf.db'),
};

const SHOULD_ALLOW = {
  'Edit a route': () => tool('Edit', { file_path: join(ROOT, 'src/routes/books.ts'), old_string: 'a', new_string: 'b' }),
  'Read seed.sql (reading is fine)': () => tool('Read', { file_path: join(ROOT, 'src/db/seed.sql') }),
  'Read .env.example': () => tool('Read', { file_path: join(ROOT, '.env.example') }),
  'Write a test using /tmp/test-bookshelf.db': () => tool('Write', { file_path: join(ROOT, 'tests/search.test.ts'), content: "await initDb('/tmp/test-search.db'); unlinkSync('/tmp/test-search.db')" }),
  'npm run test:run': () => bash('npm run test:run'),
  'npx vitest one file': () => bash('npx vitest run tests/models/book.test.ts'),
  'git diff seed (read-only)': () => bash('git diff main -- src/db/seed.sql'),
  'grep seed.sql': () => bash("grep -n 'Dune' src/db/seed.sql"),
  'git commit': () => bash('git add src tests && git commit -m "feat: search"'),
  'rm a tmp test db': () => bash('rm -f /tmp/test-bookshelf.db'),
  'npm run build': () => bash('npm run build'),
  'git checkout a branch': () => bash('git checkout -b feat/book-101'),
};

for (const [name, fn] of Object.entries(SHOULD_BLOCK)) test(`blocks: ${name}`, () => assert.equal(fn(), 2));
for (const [name, fn] of Object.entries(SHOULD_ALLOW)) test(`allows: ${name}`, () => assert.equal(fn(), 0));

test('layer 2: a tamper that got past layer 1 is detected and restored', () => {
  const root = project();
  const post = () => run('integrity.mjs', { hook_event_name: 'PostToolUse', tool_name: 'Bash' }, root);
  assert.equal(run('integrity.mjs', { hook_event_name: 'SessionStart' }, root), 0);
  const seed = join(root, 'src/db/seed.sql');
  const original = readFileSync(seed, 'utf8');
  writeFileSync(seed, 'DROP TABLE books;'); // e.g. done by a script file the hook couldn't read
  assert.equal(post(), 2);
  assert.equal(readFileSync(seed, 'utf8'), original);
  unlinkSync(join(root, 'bookshelf.db'));
  assert.equal(post(), 2);
  assert.ok(existsSync(join(root, 'bookshelf.db')));
  assert.equal(post(), 0); // clean again
  rmSync(root, { recursive: true, force: true });
});

// ---- phase lock (stage 2): tester can't write src/, implementer can't write tests/ ----
function phaseProject() {
  const root = project();
  writeFileSync(join(root, 'src/app.ts'), 'export const a = 1;\n');
  writeFileSync(join(root, 'tests/a.test.ts'), 'test("a", () => {});\n');
  const g = (...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root });
  g('add', 'src/app.ts', 'tests');
  g('commit', '-qm', 'init');
  return root;
}
const setPhase = (root, phase) =>
  spawnSync('node', [join(HOOKS, 'phase.mjs'), phase], { env: { ...process.env, CLAUDE_PROJECT_DIR: root }, encoding: 'utf8' }).status;
const pre = (root, tool_name, tool_input, extra = {}) => run('protect.mjs', { hook_event_name: 'PreToolUse', tool_name, tool_input, ...extra }, root);

test('phase implement: tests/ is read-only, src/ is writable', () => {
  const root = phaseProject();
  assert.equal(setPhase(root, 'implement'), 0);
  assert.equal(pre(root, 'Edit', { file_path: join(root, 'tests/a.test.ts'), old_string: 'a', new_string: 'b' }), 2);
  assert.equal(pre(root, 'Write', { file_path: 'tests/new.test.ts', content: '' }), 2);
  assert.equal(pre(root, 'Bash', { command: 'rm tests/a.test.ts' }), 2);
  assert.equal(pre(root, 'Bash', { command: 'echo x > tests/a.test.ts' }), 2);
  assert.equal(pre(root, 'Bash', { command: "sed -i '' s/a/b/ tests/a.test.ts" }), 2);
  assert.equal(pre(root, 'Bash', { command: 'git checkout HEAD~1 -- tests' }), 2);
  assert.equal(pre(root, 'Edit', { file_path: join(root, 'src/app.ts'), old_string: '1', new_string: '2' }), 0);
  assert.equal(pre(root, 'Bash', { command: 'npx vitest run tests/a.test.ts 2>&1 | tail -20' }), 0);
  assert.equal(pre(root, 'Bash', { command: 'npm run test:run' }), 0);
});

test('phase test: src/ is read-only, tests/ is writable', () => {
  const root = phaseProject();
  setPhase(root, 'test');
  assert.equal(pre(root, 'Edit', { file_path: join(root, 'src/app.ts'), old_string: '1', new_string: '2' }), 2);
  assert.equal(pre(root, 'Write', { file_path: join(root, 'tests/b.test.ts'), content: '' }), 0);
});

test('phase review: src/ and tests/ are read-only; off: nothing is', () => {
  const root = phaseProject();
  setPhase(root, 'review');
  assert.equal(pre(root, 'Write', { file_path: join(root, 'src/x.ts'), content: '' }), 2);
  assert.equal(pre(root, 'Write', { file_path: join(root, 'tests/x.test.ts'), content: '' }), 2);
  setPhase(root, 'off');
  assert.equal(pre(root, 'Write', { file_path: join(root, 'src/x.ts'), content: '' }), 0);
  assert.equal(pre(root, 'Write', { file_path: join(root, 'tests/x.test.ts'), content: '' }), 0);
});

test('a subagent cannot switch the phase or edit the guardrail state', () => {
  const root = phaseProject();
  setPhase(root, 'implement');
  assert.equal(pre(root, 'Bash', { command: 'node /plugin/hooks/phase.mjs off' }, { agent_id: 'a1', agent_type: 'ticket-to-merge:implementer' }), 2);
  assert.equal(pre(root, 'Bash', { command: 'node /plugin/hooks/phase.mjs review' }), 0); // orchestrator
  assert.equal(pre(root, 'Bash', { command: 'echo {} > .git/ticket-to-merge/phase.json' }), 2);
  assert.equal(pre(root, 'Write', { file_path: join(root, '.git/ticket-to-merge/phase.json'), content: '{}' }), 2);
});

test('phase layer 2: a test changed behind the hook is reverted to the last commit', () => {
  const root = phaseProject();
  setPhase(root, 'implement');
  writeFileSync(join(root, 'tests/a.test.ts'), 'test("a", () => { /* weakened */ });\n');
  writeFileSync(join(root, 'tests/sneaky.test.ts'), '');
  assert.equal(run('integrity.mjs', { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: {} }, root), 2);
  assert.equal(readFileSync(join(root, 'tests/a.test.ts'), 'utf8'), 'test("a", () => {});\n');
  assert.equal(existsSync(join(root, 'tests/sneaky.test.ts')), false);
  assert.equal(run('integrity.mjs', { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: {} }, root), 0);
});

test('gate: does nothing outside the implement phase', () => {
  const root = phaseProject();
  setPhase(root, 'test');
  assert.equal(run('gate.mjs', { hook_event_name: 'SubagentStop' }, root), 0);
});
