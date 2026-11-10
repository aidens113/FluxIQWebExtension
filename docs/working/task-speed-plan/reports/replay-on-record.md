# Replay accepted on its record (t895): S9 wired, and why the Apply step retries

## Outcome

Partial. This is the t895 unit.
- **S9 is wired and works as designed.** A replay with no deviation is accepted with no judge call.
- **Dining tables cannot reach 0 calls yet.** Every replay retries one step, so its judge is still asked. The cause is the site's own Apply press, and the fix belongs in the extension (exact change below).
- Attempt 4 was refused again at its 4th judge request.
- Every answer was right, and the crossborder cleared-check replay was judged, as asked.

## What changed and why (Core worktree `fxwork/t895/!FluxIQ/packages/fluxiq/src/`)

- **`answer-first/flow-run/steps-ran.ts`, and the type in `flow-run/outcome.ts`.** Each step now carries three structured fields:
  - `skipped`: why it was passed over, one of `already_done`, `already_in_state`, `absent`, `absent_not_done`, `not_arisen`, `routed_elsewhere`.
  - `personCleared: true`, set from any attempt of the step.
  - `retries`: how many attempts carry `retry`, over every pass of the step.
  - Wording fix: a step the run's own ledger skipped as already done used to say "The page was already at another step". It now says it was already done.
- **`answer-first/task-memory/saved-flow.ts`.** Adds `shape?: { columns, empty }` and the `AutomationStudioAnswerFirstReadShape` type.
  - The shape is written in `attempt/remember.ts`: one field, from `completion.state.held.rows`, using the new `completion/read-shape.ts`.
  - **`remember.ts` is outside my owned paths, but not on the must-not-touch list.** It is the only place the best Flow is saved.
- **`answer-first/completion/replay-of.ts`.** Builds the replay record only while the attempt is on the saved Flow's own run. It returns nothing when any of these holds:
  - the route is not `use`;
  - the attempt carries on an earlier one;
  - the path is no longer `run_flow`;
  - the run did not run.
- **`attempt/run-attempt.ts`.** Passes `replay: () => automationStudioAnswerFirstReplayOf(run)`.
- **Honest words.**
  - `completion/on-record.ts` holds the `checkedWhat` text for a replay accepted on its record. The answer card shows it after "Checked:": "ran exactly as the run you accepted, every step as saved and the same kind of rows read, so no new check was needed."
  - The progress row now reads "Ran as accepted".
  - `conversations/commands/answer-first/outcome.ts` says "I ran the saved Flow, and it went exactly as the run you accepted, so no check was needed." It no longer says "checked once against what you asked".
  - `outcome.ts` imports the leaf `completion/on-record.ts`, not the completion barrel. Going through the barrel closed a 33-module import cycle that the audit caught.

- **New deviation: `asked_again`, checked second, after `judge_always`.** A person's Run again asks for its change again, so its judge is always asked.
  - Without it, a Run again on a proven Flow would stand on a record of a different change.
  - The existing tests caught this.
- **Tests that encoded "every replay is judged", updated to the new rule.** Each keeps its intent:
  - `later-attempt.test.ts`: the judge's-no case now uses a Run again. A new case: a third whole run stands on its record with 0 calls, and the saved best keeps `provenWhole` and `shape`. This is the end-to-end proof through the real service.
  - `same-words.test.ts`: the judged run reads the words as typed; the same words on a proven Flow ask no judge.
  - `apply-proven.test.ts`: attempt 3 now costs no call.
  - These sit in `answer-first/tests/` and `apply-proven/tests/`, outside my owned paths but not on the must-not-touch list.

**The first replay of a newly explored Flow is always judged.** Its Flow has never run whole, so the replay deviates as `flow_not_proven`. That judged run is the finished Flow's one judged whole run, which the plan keeps. So "every replay at 0 calls" means from the second replay on.

## Why s7 failed once with `web.action.no_effect` (here it is s9; this exploration saved two optional prompts)

- **The cause is the site, by design.** `apps/scenario-lab/src/scenarios/local-classifieds/script/filters.ts` says: "its Apply swallows the first press after the select changes". The scripted exploration also presses Apply twice (`apply-1`, `apply-2`).
- **It happens on every replay.** In `run-mwazisjn-ab645012`, Apply's first press failed `web.action.no_effect` in attempts 2, 3 and 4 (steps 58, 95, 132), and Core's retry then landed.
- **Why the extension returns `no_effect`.** The first press showed a change in its own section, which then went back, so the click's settled look reads "certainly nothing" and hands the second press to Core. A press with no sign at all is already pressed once more inside the same command (`pressAgain`, t878). That is why only this kind of press becomes a Core retry.
- **Exact extension change** (`apps/extension/src/content/actions/click.ts`, `pressInPlace`):
  - Treat a first press that settled unchanged as a press the page ignored, so the command's existing press-once-more path makes the second press.
  - Fail `NO_EFFECT` only when the press was already made once more.
  - Replace the `settledUnchanged` block and the line after it with:
    ```ts
    if (first.settledUnchanged && measure().actionable && extra > 0) {
      return deps.success(action, startedAt, "Element clicked, and the page settled unchanged.", settledUnchangedValidation(report.detail, first.accepted), evidence(), WEB_AUTOMATION_FAILURE_CODES.NO_EFFECT);
    }
    if (!first.settledUnchanged && (first.sighting || !first.answer || first.answer.seen.length > 0)) {
    ```
  - Pass `first.settledUnchanged ? [] : first.answer.seen` to `pressAgain(...)`.
  - Then a swallowed Apply is one command with two presses. The step has no Core retry, so a replay stands on its record.
  - The t517 rule ("made once more, and only once") still holds: the second press is the one extra press.
  - Needs click tests in `content/actions/tests/` and a check on social-network-feed's Post (the case the settled look was written for).

## Commands run and observed results

- `NODE_OPTIONS=--max-old-space-size=6144 tsc --noEmit -p tsconfig.json` (fluxiq) -> exit 0, no output. An earlier run caught one test error, a missing argument, which I fixed.
- `node scripts/structure-audit.mjs` -> "passed (528 warning(s), 969 baselined)". The first run failed on a 33-module import cycle through `outcome.ts`; importing the leaf file fixed it.
- `npx vitest run src/engine/automation` -> 104 files, 903 tests passed. Engine code is unchanged since this run.
- `npx vitest run` over `answer-first`, `runtime/conversations` and `conversation-requests` -> 162 files, 1180 tests passed, exit 0.
  - The run before the test updates had 5 failures, all tests encoding "every replay is judged". They are listed above.
- Core libraries rebuilt (`pnpm --filter @fluxiq/contracts --filter fluxiq ... build`) -> exit 0. Extension build -> exit 0.
- **The Lab runs below ran before I added `asked_again`.** None of them involves a Run again, so their outcome is the same.

**Dining tables, provider-free** (`run-mwazisjn-ab645012`, 3.4 GB free at launch). Exit 1, `not_judged`: attempt 4 was refused at `loop_verification` 4.

| Attempt | Path | Time | Calls | Answer | Why judged |
| --- | --- | --- | --- | --- | --- |
| 1 | explore | 45.5 s | 23 (interpretation 1, judge 1, decisions 21) | right | (exploration) |
| 2 | run_flow | 25.3 s | 1 (interpretation 0, judge 1) | right | `flow_not_proven` |
| 3 | run_flow | 25.6 s | 1 (interpretation 0, judge 1) | right | `step_retried`: Apply |
| 4 | run_flow | did not end | 0 interpretation | not scored | judge request 4 refused |

- The two optional prompts were passed over in 249 and 213 ms.
- These replays are slower than t894's 18.9 and 19.0 s. The navigates and clicks were slower across the board while lane t885's Lab ran at the same time, and this Flow has one more optional step. S9 adds no time: the judge steps took 14-18 ms against the scripted model.

**Crossborder timed-check.**
- `--attempts 2` (`run-mwazvihu-a0ca9f20`): passed. Attempt 2 replayed, the Lab cleared the traffic-screen check twice, and it was judged (1 call, interpretation 0), right. This was also the Flow's first whole run, so it was `flow_not_proven` as well.
- `--attempts 3` (`run-mwb00284-785a5c85`): passed. Attempt 3 ran on a Flow proven by attempt 2.
  - Its only failures were the two `web.intervention.required` steps the person cleared (steps 49 and 52), each then re-run.
  - Its judge was asked (`loop_verification 3`, 1 call), answer right. That is the `check_cleared` deviation.

## Not verified

- **Attempts 3 and 4 standing on record live.** Every dining replay retries Apply, so no replay could stand on its record here. Accepting on record is proven only by the unit tests.
- **Reading the deviation and `shape` back from a run.** Neither is kept in the Lab evidence, because the isolated Core removed its task memory. The deviation is inferred from the step log and the rule's order.
- **The proposed extension change.** Not run.

## Open questions or contradictions found

- **Decided rule vs. the target on this task.** "A retried step deviates" and "replays at 0 calls" cannot both hold on dining tables until the click change above lands. The site swallows a press on every run.
- **An alternative fix in Core**, if the extension change is unwanted: keep each step's `retries` from the accepted run in `saved-flow.ts`, and count a retry as a deviation only when it differs from that record. I did not do this, because it reverses the decision that retries deviate.
