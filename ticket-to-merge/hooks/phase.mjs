#!/usr/bin/env node
// Switch the ship-ticket phase: node phase.mjs <off|test|implement|review> · node phase.mjs (prints it).
// Only the orchestrator runs this; protect.mjs blocks it inside subagents.
import { projectRoot, readState, setPhase, PHASES } from './lib.mjs';

const root = projectRoot({});
const phase = process.argv[2];
if (!phase) {
  console.log(`phase: ${readState(root).phase}`);
  process.exit(0);
}
try {
  setPhase(root, phase);
  const locked = PHASES[phase].map((d) => `${d}/`).join(', ') || 'nothing';
  console.log(`phase: ${phase} · read-only: ${locked}`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
