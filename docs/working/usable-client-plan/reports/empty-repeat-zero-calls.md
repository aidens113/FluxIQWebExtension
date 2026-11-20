# t945 empty repeat counts as run

## Outcome
Done, with one deviation from the brief: `NOTES_BACK_JUDGES` stays at 4 (see Open questions).

## What changed and why
Core, `packages/fluxiq/src/framework/automation-service/service/answer-first/flow-run/`:
- `steps-ran.ts`: confirmed the cause. A step with no attempts reads `not_reached` (old line 139), and `completion/replay-stands.ts:55` turns any `not_reached` into `step_failed`. New `emptyRepeatBody` runs only when the run reached the Flow's end: a `not_reached` step whose saved routing is a repeat over a list step, and whose list step is `passed`, becomes `passed` ("the repeat ran no pass and there was nothing to do"). Everything else is unchanged: a run that stopped short keeps `not_reached` (so `failingOf` still finds the failing step), and a repeat over a list that failed or was skipped keeps `not_reached`. While-repeats (no `over`) are untouched.
- New test `flow-run/tests/steps-ran-empty-repeat.test.ts`: (1) list passed + reached end -> repeat step passed; (2) earlier step failed, run stopped short -> repeat step `not_reached`; (3) list step failed to read -> list `failed`, repeat `not_reached`.

Extension: `NOTES_BACK_JUDGES` stays 4; only its comment in `packages/test-runner/src/attempt-lane/scripted-model/scripts/professional-network-accept-messaged-invitations.ts` was corrected to the real count. Its test is unchanged.

## Commands run and observed results
- Core `npx vitest run src/framework/automation-service/service/answer-first` -> 139 files, 967 tests passed (includes the new file).
- `pnpm --filter fluxiq check` -> exit 0.
- Core `node scripts/structure-audit.mjs` -> `structure-audit: passed (552 warning(s), 911 baselined).`
- Extension script test (`node --test dist/.../professional-network-accept-messaged-invitations.test.js`) -> 21 pass, 0 fail.
- Extension `node scripts/structure-audit.mjs` -> `structure-audit: passed (254 warning(s), 551 baselined).`
- Setup: `pnpm install --frozen-lockfile`, Core library builds, extension, browser-host, test-runner and test-runner dependency builds all ran through the heavy slot.
- Lab proof `FLUXIQ_ATTEMPT_SCRIPT_FORM=notes-back pnpm lab attempt professional-network --task professional-network-accept-messaged-invitations --authoring-mode answer-first --scripted-model --attempts 4` -> LAB_EXIT 0, evidence `test-runs/attempts/run-mwmb9nhp-bc125b44` (extension worktree). Per attempt (`attempt.json`):
  - A1 explore: 15 calls (interpretation 1, judge 1, decisions 13), flow unproven.
  - A2 run_flow_then_repair: 7 calls (judge 2, decisions 5), flow.c3eaae24..., continuation held.
  - A3 run_flow: 1 call (judge 1), same flow, continuation held.
  - A4 run_flow: 0 calls, same flow, continuation held.
  Summary: "3 of 3 ran, 1 with no model call, continuations all held".
- Earlier run with `NOTES_BACK_JUDGES = 3` (`run-mwmaoze9-bc585fce`) -> not_judged: script refused loop_verification request 4 during attempt 3.

## Not verified
No live browser or live model run; no full Core/extension suites. Core `fluxiq:build` output was not rebuilt after the change beyond what the Lab prelude did (the Lab ran against this worktree's Core and showed the fix working).

## Open questions or contradictions found
The brief expected 3 judges. The honest path needs 4: A1 result, A2 replay and A2's Messaging read, A3 replay. Both replays are judged for `flow_not_proven` (steps 0044 and 0071 notes), which is correct since no judged whole run of those Flows exists. With 3, attempt 3 was refused. The existing 4 already fails the script on a fifth request, so a regression of the fix (A4 judged again) is refused at request 5 and the Lab run fails. I kept 4 and fixed the comment. The brief's "attempt 3's one judged whole run is expected" matches this.

## Tightening after the lead's message (final state; supersedes the earlier description of `emptyRepeatBody`)
- `flow-run/steps-ran.ts`: the pass now rests on the loop's own evidence. A repeat body step with no attempts is `passed` only if the run reached the end, the list step passed, and the saved step is a repeat over it, and its For Each (`builtin.control.for-each`) has an attempt with route `done` and recorded output `count === 0` and no attempt that took `body`. This reuses the engine's `automationStudioZeroPassLoopBodies` (`engine/automation/graph-navigation/zero-pass-loop.ts`), fed only the attempts of For Each nodes that counted 0. The For Each already records `count` in its outputs, so nothing needed recording at the source.
- A Flow that skipped its loop (For Each never reached) or took rows (`body` route, or `done` with count above 0) keeps `not_reached`, so the replay still reads `step_failed`.
- `flow-run/tests/steps-ran-empty-repeat.test.ts` now builds a real graph (list, For Each, body) and has 6 cases: empty loop passes; earlier step failed and stopped short; list failed; loop never reached with list passed (the requested case); loop took rows with body unattempted; done with count 2. All pass.

Re-run results: answer-first vitest -> 139 files, 970 tests passed (VITEST_EXIT 0); `pnpm --filter fluxiq check` -> CHECK_EXIT 0; Core structure-audit -> passed (552 warning(s), 911 baselined). Core `fluxiq` and `ui-components` were rebuilt (the Lab refuses stale Core). Lab proof (`run-mwmex6vu-17db361e`, LAB_EXIT 0): A1 15 calls, A2 7 (judge 2), A3 1 (judge 1), A4 0 calls; flow flow.707c7a20 from attempt 2, continuation held at every transition.
Not re-run: extension structure-audit and script test (no extension source changed since they passed).
