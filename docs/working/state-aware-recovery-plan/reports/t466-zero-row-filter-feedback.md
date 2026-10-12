# t466 report: zero-row filter feedback, true row counts, build call count

Status: Complete
Owner: t466 worker (Core-paired; no commits)

## Outcome

Done. I confirmed all three defects against the source and the round-8 step log, and fixed each one. The narrow checks named in the brief all pass. I also touched three files outside the brief's list, because a correct fix needed them. They are listed under "Open questions" for the supervisor to accept or move.

## What changed and why

### D1: a loop that ran no passes is a valid ending, and the trial feedback says what the filter did

- I confirmed the cause. `graph-run.ts:498-504` fails a frame `executor.graph.unvisited_nodes` when `hasUnvisitedAutomationStudioNodes` (in `executor/graph-navigation.ts`) is true. A For Each over 0 kept rows routes `done`, so its body is never visited. The run therefore failed before any judge saw it, and the feedback (`feedback.ts:66-67`) told the model to fix its connections.
- New: `executor/graph-navigation/zero-pass-loop.ts` (`automationStudioZeroPassLoopBodies`), exported from `graph-navigation/index.ts`. A loop node is a For Each, Repeat or Loop. When the run reached one and none of its attempts took `body`, every node reached only from its `body` port counts as visited. The walk never passes back through the loop node, and it leaves out any node the loop's other routes (`done`, `failed`) also reach.
- `executor/graph-navigation.ts`: `hasUnvisitedAutomationStudioNodes` now adds those nodes to `visited`. I made the change here, not in `graph-run.ts`, because this function decides "unvisited" for both `graph-run.ts:498` and `step-loop/already-done.ts:121`. `graph-run.ts` itself is unchanged.
- New: `service/candidate-trial/reads.ts` (`automationStudioTrialReadsFeedback`), exported from the `candidate-trial` barrel. For each read in `summary.reads` it gives:
  - `nodeId`, `label`, `seen`, `kept`
  - `conditions[{condition, rejected, rejectedByItself}]`, using the model's own screened wording
  - a `said` sentence
- When a read with conditions kept 0 rows, `said` reads: "The read saw 8 rows and kept none. A row is kept only when it passes every one of its 2 conditions … Keeping no rows is a valid outcome when no row on the page matches, and a loop over the kept rows then runs no passes; it is not a fault in the Flow's connections. … Conditions that should accept a row in any of several forms must be one condition that names the forms together, not separate conditions that must all hold."
- It never includes `leftOutOnlyByThis`, which carries page values. The wording is general and names no site or scenario.
- `service/candidate-trial/feedback.ts`: `judged()` adds `reads` to its common feedback. Since D1's executor fix, a zero-row trial reaches the judge, so the model now gets these counts. The header comment says so. The `unvisited_nodes` graph-ending text is kept for real unvisited nodes.
- Docs: I added a paragraph to Core `docs/architecture/automation-studio/flow-authoring.md`, before "Terminal coverage".

### D2: the chat card no longer sums record sets

- I confirmed the cause from step 0077. The run stored 2 datasets, `…-main-s15` and `…-main-s6`, with `recordCount` 4 each (already counted after processing: `collected 4, kept 4`). The observation head "8 records stored, across 2 record sets" was turned into "8 rows came back". Nothing was over-collected: the 8 is the 4-row answer stored twice.
- `result-verification/verdict.ts`, function `automationStudioResultObservation`: when a run stores more than one record set and every set is summarized, the head adds each set's rows, for example "8 records stored, across 2 record sets (4, 4 rows); …". A head with one set, or with no sets, is unchanged.
- `result-verification/check-words.ts`: a new `SETS` pattern and a `setsWords` function. When a run stored more than one set, the card no longer sums them:
  - all sets equal: "4 rows came back, in each of 2 record sets."
  - sets differ: "Rows came back in 3 record sets: 12, 1 and 3 rows."
  - not every set summarized: "Rows were stored in 2 record sets."
- The single-set wording, the build-test "would be stored" wording, and the no-sets case are unchanged. `activity/wording/run-ending.ts` ("it saved N rows") reads the head and still says the total saved, which is true. I left it alone.

### D3: the Lab counts the build's real calls

- I confirmed the cause. In candidate mode `evidenceLoop` is null, so `providerCalls` is null and `build-usage.ts:37` fell back to 1. The step log's `byPart.creation` holds `explore: 26` and `judge: 6`, which is 32 calls. Core's `build.accounting` dollars cover all 32.
- `packages/test-runner/src/live-llm/build-usage.ts`: `liveLlmBuildUsage(build, stepLog?)`. When Core gives no count, it now uses the sum of every phase under `stepLog.byPart.creation`. Only when neither source has a count does it use the old 1 or 0. Core's own count still wins when present.
- `packages/test-runner/src/live-llm/live-llm-run.ts`, in `settleBuild`: reads the step log and passes it in (`readLiveLlmStepLogSpend` was already imported). With round 8's figures, `liveLlmRunSpend` now gives build 26, judge 7 (the build's 6 plus the result check's 1), chat 1, unattributed 0, total 34. `creationBuildSplit` moves the 6 judges out of the build, because the build count now equals the creation total.
- Not done: `candidate.judgeCalls: 2` in `flow-lane/creation/candidate-outcome.ts` still counts only the promoted trial's judges. That file is not mine (see "Open questions").

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/executor` (Core, `packages/fluxiq`), run before the type fixes: `Test Files 96 passed (96)`, `Tests 828 passed (828)`.
- `npx vitest run …/runtime/executor …/runtime/service/candidate-trial …/runtime/result-verification …/runtime/activity`, run after all edits: `Test Files 191 passed (191)`, `Tests 1684 passed (1684)`.
- An earlier run of `…/result-verification …/activity …/recovery`: `Test Files 138 passed (138)`, `Tests 1352 passed (1352)`.
- `npx tsc --noEmit` (the fluxiq check command, run directly): exit 0. The first `pnpm --filter fluxiq check` failed on type errors in my new tests (`exactOptionalPropertyTypes`, a missing `withheld`). After I fixed them, `pnpm --filter fluxiq check` passed and the build cache stamped it (`{"build-cache":"build","step":"fluxiq:check",…}`).
- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` (Core): exit 0. fluxiq was rebuilt in 107.8 s, the other two packages were reused.
- `pnpm build` (test-runner): exit 0. This includes `tsc -p tsconfig.json`, which compiles the tests.
- `node --test dist/live-llm/tests/build-usage.test.js dist/live-llm/tests/run-spend.test.js dist/live-llm/tests/live-llm-run.test.js`: `# tests 43`, `# pass 43`, `# fail 0`.
- `pnpm structure:check` (Core): `structure-audit: passed (331 warning(s), 1159 baselined)`. It also printed "2 baseline entries can be lowered". I did not run `structure:baseline`.
- `pnpm structure:check` (downstream): `structure-audit: passed (184 warning(s), 646 baselined)`.
- I ran `pnpm test` in test-runner once by mistake. It refused to start because Core's dist was stale, so no suite ran. I then rebuilt Core as above.
- No Lab run and no paid call.

## Not verified

- No live run. In particular I did not see a real zero-row trial reach the judge, or check what the judge says about it. That trial now costs 2 judge calls instead of 0, but gives true feedback.
- I did not run the whole Core suite, `pnpm check`, the full test-runner suite, or the extension and domain suites. These are the twice-daily sweep.
- Whether any other Core or Lab reader depends on the exact text of an observation head with multiple sets. A grep of both repositories found only `recovery/tests/context-whole.test.ts`, which builds its own string and passed.
- The extension chat line "The test failed: a step didn't work" for an execution-failed trial (debug item 2) is not addressed. With D1 fixed, a zero-row trial no longer ends execution-failed.

## Open questions or contradictions found

- Files outside the brief's list that I changed:
  - Core `executor/graph-navigation.ts` and `executor/graph-navigation/index.ts`. The brief said graph-run.ts "only the feedback classification". The classification lives in `hasUnvisitedAutomationStudioNodes`, so I changed it there and left `graph-run.ts` untouched.
  - Core `result-verification/verdict.ts`. `check-words.ts` sees only the observation string, so the per-set counts had to be added where that string is made.
  - Downstream `live-llm/live-llm-run.ts`. This is the single call site, which now passes the step log.
  - Core `docs/architecture/automation-studio/flow-authoring.md`, as required by the documentation rule.
  - New files: `zero-pass-loop.ts`, `reads.ts`, and their tests.
- The debug's "8 rows came back for a 4-row answer" is right, but the cause is two record sets that both store the same 4 rows, not collected-versus-kept. The card cannot tell which set is "the answer", so it now says each set's rows. Picking one set, such as the last one written, would need a Core rule for which dataset is the answer.
- `candidate.judgeCalls` (`flow-lane/creation/candidate-outcome.ts`) still reports only the promoted trial's 2 judge calls. Fixing that is a follow-up in a file I do not own.
