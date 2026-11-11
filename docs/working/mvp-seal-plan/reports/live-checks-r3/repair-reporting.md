# Repair reporting: a hand fix after a broken replay

## Outcome

Done. Both defects are reproduced, traced to their cause and fixed in Core (`t885/!FluxIQ`). There is a provider-free test for each, and each test fails with its fix reverted.

W3's pinning tests are not in this tree. A search of answer-first tests for "repaired", "explored" and "broken step" found no such tests, and neither did the recent `fxwork` worktrees or the mvp-seal reports. So I wrote tests of my own for both shapes.

## The cause, reproduced

Shape: attempt 1 presses the card ("Renew card") and saves it. The site then renames the control ("Extend card"). Attempt 2 is a Run again: the saved Flow's run stops at step 2, "control not found". The model presses the renamed control by hand with `add` and completes. A probe run on the unfixed code showed:

1. **Path (defect 1).** Attempt 2 ended `run_flow_then_explore`, which FluxNode maps to `explored` (`fluxnode/result-of.ts:24`). The cause is `attempt/path.ts:25-31` (old). The path was a repair only when a forward run reached the last proposed step (`run.forwardReached`, set only by the `forwardRun.passed` hook in `attempt/round.ts:96`). A step done live by hand never counted, even though it is the failing step repaired live from the page the run left, as the contract defines `run_flow_then_repair`.
2. **Broken step kept (defect 2).** Attempt 2's saved steps were `d2` (kept, "Renew card", broken) and `d4` (kept, "Extend card"). Attempt 3 stopped at step 2 again and never reached `d4`. The cause: a hand call with `add` is appended to the draft as a new kept step. Nothing anywhere took the step the run failed at out of the Flow. A `rerun` amendment does that (`runtime/llm/evidence-loop/rerun/replacement.ts`), but a hand call is not a rerun. The ending then saved `run.steps` as they stood: through `attempt/ending.ts` (draft save, store), `attempt/remember.ts` (the task's best Flow) and `apply-proven` (the person's Flow).

## What changed and why

- **`answer-first/flow-run/stand-in.ts` (new), exported through `flow-run/index.ts`.** `automationStudioAnswerFirstStandIn(run)` runs once at the ending. It finds the saved step the run stopped at (`flowRun.outcome.failing`, mapped by position to its id in `startedWith`). That step must still be in the Flow, not a repeat, and not passed by a forward run since. It then finds the first step after it that this attempt made (an id that none of the saved steps have), that is in the Flow, runs the same node through the same tool with the same effect, stands for nothing and has no routing. That step is handed to the draft's own rerun replacement (`automationStudioLlmEvidenceRerunReplaced`, `takesItsPlace: true`). So it takes the broken step's place, acts, route places, routing, `standsFor`, pace and route signatures, and the broken step stays at the end as a `dropped` receipt with `replacedBy`. Steps this attempt made and kept between the two move with the stand-in, in order: they are the live way from the page the run left. A saved step between them keeps its place after them. The work is done on copies and committed only if the drop held. Otherwise nothing changes.
  - It lives in `flow-run/` because `attempt/` is at the 25-file limit and a subdirectory under it breaks the 9-segment depth limit. Both were checked with the structure audit. It reads the run's outcome and takes its own input type, so `flow-run` does not import `attempt`.
- **`attempt/ending.ts`.** It calls the stand-in first, before the path is settled and before anything saves the steps.
- **`attempt/path.ts`.** `run_flow_then_repair` now requires three things. First, still the first round (`run.path`) and a yes. Second, something repaired: the run stopped at a failing step, a forward run went over the Flow, or the Flow's proposed steps differ from the saved ones. Third, every step the Flow proposes as it ends ran in this attempt: the saved run passed or skipped it, a forward run passed it, or this attempt made it and ran it live (not `written`). This keeps every earlier expectation. It also correctly calls a written step that never ran, an unreached saved step, or the broken step still standing an exploration.
- **`attempt/state.ts`, `attempt/run-attempt.ts`, `attempt/round.ts`.** `forwardReached: number` (a max position, which renumbering makes stale) is replaced by `forwardPassed: Set<string>`, the ids of the steps a forward run passed. No other code read `forwardReached`.
- **Tests.**
  - `attempt/tests/hand-fix.test.ts`: real service, engine, apply path and scripted model. The hand fix reads `run_flow_then_repair` with result source `both`. The card is pressed once per attempt (2, then 3). The kept Flow holds only "Extend card" at step 2, with the old press `dropped` and `replacedBy` the fix. Attempt 3 is `run_flow` with no decisions. The person's Flow is adopted with exactly one card press, on "Extend card". The negative case: a hand press left out of the Flow is `run_flow_then_explore` and the Flow keeps its step.
  - `flow-run/tests/stand-in.test.ts`: six unit cases. Replace in place with acts and `standsFor`; the way-steps move and a saved step stays after them; no stand-in for another node, a taken step or a failed step; none once a forward run passed the broken step; none for a repeat; nothing when the run reached its end, never went out, or is absent.
  - `attempt/tests/path.test.ts`: eight unit cases of the path rule.

Standing rules: no cap, no limit, no retry change. No lasting act is repeated: the stand-in changes only which saved step the next run runs, and the hand-fix test shows one press per attempt. No model text was added or changed.

## Commands run and observed results

All run in `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ`. No `pnpm build`, Lab command or dist output.

- Revert check, defect 2: the `automationStudioAnswerFirstStandIn(run)` call in `ending.ts` was disabled, with the hand-fix test's path assertion skipped so the failure is about the Flow. Result: `AssertionError: expected [ [ 2, …(2) ], [ 4, …(2) ] ] to deeply equal [ [ 2, …(2) ] ]`, 1 failed / 1 passed (both presses kept). Restored, confirmed by grep.
- Revert check, defect 1: `path.ts` was set back to the old rule (repair only if a forward run passed the last proposed step). Result: hand-fix test `expected { …(15) } to match object { status: 'achieved', …(2) }` (path explore), and two path unit cases failed. 3 failed / 6 passed. Restored, confirmed by grep.
- `npx vitest run answer-first/{attempt/tests,tests,apply-proven/tests,flow-run/tests}`: `Test Files 1 failed | 73 passed (74)`, `Tests 1 failed | 475 passed (476)`, exit 1. The one failure was `flow-run/tests/repaired-read-conditions.test.ts:54`: a whole run judged no, then a forward run over the unchanged Flow, is pinned as a repair, and an intermediate version of my rule called it an exploration. Fixed in `path.ts`: a forward run in this attempt counts as something repaired. A unit case was added for it.
- After that fix: vitest over `repaired-read-conditions`, `path`, `stand-in`, `hand-fix`, `later-attempt`, `second-attempt-proof`, `caller-replay` and `apply-proven` gave `Test Files 8 passed (8)`, `Tests 73 passed (73)`, exit 0. Then every other file asserting `run_flow_then_explore` (`double-act-on-run`, `carry-on`, `interrupted`, `attempt-store/outcome-of-record`, `interrupted/interrupted-view`) gave `Test Files 5 passed (5)`, `Tests 85 passed (85)`, exit 0.
- `npm run check` in `packages/fluxiq` (the `pnpm --filter fluxiq check` script): `fluxiq:check` built, exit 0. Re-run after the last edit: exit 0.
- `pnpm structure:check`: `structure-audit: passed (531 warning(s), 969 baselined)`, exit 0. The first run failed on `attempt/` and `answer-first/tests/` at 26 files each, and a second run failed on the depth limit. Both were fixed by where the files now live.

## Not verified

- The full answer-first run was not repeated after the final `path.ts` change. Only the 13 files that assert a path were re-run (all pass). The change can only turn an exploration into a repair where a forward run passed something, and those files are the ones that pin that.
- No live or Lab run, by the brief. The FluxNode mapping `run_flow_then_repair` → `repaired` (`fluxnode/result-of.ts`) was read, not tested end to end.
- A carried-on attempt (after an interruption) has no `flowRun`, so a hand fix done in a segment before a restart is not stood in at the carry-on's ending. The stored working row keeps both steps. Not covered here.
- A broken step that is a repeat over rows is left as the model left it, by design. One hand press is one row, not the step.

## Open questions or contradictions found

- The stand-in matches the broken step by node, tool and effect. If the model hand-pressed a different row of the same node in a single-row step (not a repeat), that press replaces the broken one. That is what achieved the result, and the broken step fails on the site as it stands. But it is an inference, not something the model stated.
- With a stand-in, the stand-in's `standsFor` names the broken step's `d<n>` id. The draft's own rerun does the same for any step, and attempt 3's assembly and adoption worked with it.
- Other workers' uncommitted edits sit in this tree (`attempt/call-chain.ts`, `attempt/tests/looked.test.ts`, `completion/check.ts`, `completion/tests/looked-evidence.test.ts`, `runtime/result-verification/flow-less/*`). I did not touch them. The checks above ran with them present.
