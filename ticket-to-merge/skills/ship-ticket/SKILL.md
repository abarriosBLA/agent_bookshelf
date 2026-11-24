---
name: ship-ticket
description: Take the ticket in SPEC.md from zero to merge-ready. Test-first build (tester, then implementer), read-only review, fix loop, and a cost table. Usage - /ticket-to-merge:ship-ticket [ticket id]
argument-hint: "[ticket id, e.g. BOOK-101]"
disable-model-invocation: true
---
You are the orchestrator for ticket `$ARGUMENTS`. You don't write tests or code yourself. You run the gates, write each brief, read the short returns, commit, and decide the next step. Don't ask the user anything unless a step below says to stop.

Scripts (run them exactly like this):
- Phase: `node "${CLAUDE_PLUGIN_ROOT}/hooks/phase.mjs" <off|test|implement|review>`
- Test gate: `node "${CLAUDE_PLUGIN_ROOT}/scripts/check-tests.mjs" <red|green> --acs <N>`
- Mutation check: `node "${CLAUDE_PLUGIN_ROOT}/scripts/mutate.mjs" --base $BASE`

The phase makes directories read-only through a hook: `test` locks `src/`, `implement` locks `tests/`, `review` locks both. Set it before every agent call. Only you can change it.

## 0. Pre-checks (stop and report if any fails)
1. `SPEC.md` exists and, if a ticket id was given, names it. Read it and `CLAUDE.md`.
2. The current branch is not `main` or `master`.
3. `git status --porcelain` is empty.
4. The test command from CLAUDE.md passes now.
5. Record `BASE=$(git rev-parse HEAD)`. Set N = the number of acceptance criteria in SPEC.md that need their own tests (skip a criterion that only says "the suite passes").

## 1. Tests first (red)
1. Phase `test`.
2. Call the **ticket-to-merge:tester** agent.
3. Run the test gate in `red` mode. It checks that every criterion has a test named after it, that something fails, that no test file failed to load, and that no older test broke.
   - FAIL: send the gate's output to the tester once more. Still FAIL: phase `off`, stop and report.
   - OK: the gate may list criteria "already satisfied by the current code". That's fine; keep the list for the report.
4. Commit the tests only: `git add tests && git commit -m "test: failing tests for <ticket> (red)"`. This is the one commit allowed to be red. Record `RED=$(git rev-parse HEAD)`.

## 2. Implement (green)
1. Phase `implement`.
2. Call the **ticket-to-merge:implementer** agent with the test file paths. A SubagentStop hook keeps it working while the suite is red (3 tries).
3. Run the test gate in `green` mode, then the build command from CLAUDE.md.
   - FAIL: one more implementer call with the gate's output. Still FAIL: phase `off`, stop and report what fails.
4. Run the mutation check. It breaks each line the ticket added, one small change at a time, and reports changes no test noticed. It is a report, not a gate: keep its score line and its "Survived" list for the final report and carry on.
5. Check the SPEC constraints yourself: `git diff $BASE --stat` shows no change to the schema, the dependency list in `package.json`, or any protected file, and `git diff $RED -- tests` is empty (the tests are still the ones committed red).
6. Commit: `git add -A && git commit -m "feat: <ticket title> (<ticket>)"`.

## 3. Review
1. Phase `review`.
2. Run the review exactly as the `review-pr` skill of this plugin describes (read `${CLAUDE_PLUGIN_ROOT}/skills/review-pr/SKILL.md`), passing `$BASE` as the base. It returns verified JSON findings.
3. No findings of severity `high` or `medium`: go to step 5.

## 4. Fix loop (at most 2 rounds)
For the verified `high` and `medium` findings:
1. Phase `test` → **tester** in fix mode with the findings → test gate `red` → commit `test: reproduce review findings (red)`.
2. Phase `implement` → **implementer** in fix mode → test gate `green` + build → commit `fix: <what>`.
3. Phase `review` → review again, on `$BASE..HEAD`.
Findings still open after round 2: stop the loop and list them for a human. Never rewrite or amend earlier commits.

## 5. Finish
Phase `off`. Never push.

## Briefs
Agents start with a fresh context and see nothing of this conversation. Every brief uses this shape, under 150 words:
```
Task: ...
Context: ticket <id> "<title>". Spec: SPEC.md. Files: <paths from the previous step>. Base commit: <BASE>.
Constraints: follow CLAUDE.md; <step-specific limits>.
Return: exactly what your agent file says to return. No transcript.
```
Pass on only what the next step needs (paths, gate output, findings JSON), never a previous agent's full output.

## Final report (in chat)
1. One row per agent call, in order, plus a Total row. Take the numbers from each agent result:

| # | Stage (build / review / fix) | Agent | Model | Tokens | Tool uses | Duration | Result |
|---|---|---|---|---|---|---|---|

2. `Verdict: READY | BLOCKED · tests <passed>/<total> · criteria covered <n>/<N> · mutation <killed>/<valid> · review rounds <r>/2 · open findings <c>`.
3. `git log --oneline $BASE..HEAD`.
4. Criteria the red gate reported as already satisfied before implementation, and every mutant that survived (each one is a test worth adding).
5. Remind the user to run `/usage` now and note the cost for this stage.
