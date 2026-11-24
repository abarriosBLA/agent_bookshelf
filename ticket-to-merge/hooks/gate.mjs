#!/usr/bin/env node
// SubagentStop gate. In the 'implement' phase an agent can't finish while the suite is red:
// exit 2 sends the failing tests back to it. Output is only the failures, to keep its context small.
// After MAX_BLOCKS tries the agent is let go; the orchestrator's own green check still fails the run.
import { readInput, projectRoot, readState, writeState } from './lib.mjs';
import { runSuite } from '../scripts/check-tests.mjs';

const MAX_BLOCKS = 3;
const input = readInput();
const root = projectRoot(input);
const st = readState(root);
if (st.phase !== 'implement') process.exit(0);

const s = runSuite(root);
const failures = s.ran ? [...s.loadErrors, ...s.failed.map((t) => `${t.fullName} → ${t.message}`)] : [s.error];
if (!failures.length) process.exit(0);

if ((st.gateBlocks || 0) >= MAX_BLOCKS) {
  process.stderr.write(`GATE: still ${failures.length} failing after ${MAX_BLOCKS} tries; stopping. Report what is failing and why.\n`);
  process.exit(0);
}
writeState(root, { ...st, gateBlocks: (st.gateBlocks || 0) + 1 });
process.stderr.write(
  `GATE: you can't finish while tests fail (${failures.length} failing, try ${st.gateBlocks + 1}/${MAX_BLOCKS}).\n- ` +
    failures.slice(0, 12).join('\n- ') +
    `\nFix the code in src/. tests/ is read-only: if a test is wrong, say so in your report instead.\n`
);
process.exit(2);
