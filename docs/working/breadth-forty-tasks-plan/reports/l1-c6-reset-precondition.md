# l1-c6-reset-precondition

## Outcome

Done, with one contradiction in the brief that the supervisor needs to see (below). The trial-reset refusals are now a precondition in the repeat guard. Any later call that ran and was not refused lifts them, a look included. Tests, typecheck and the structure audit pass.

## What I found about the result shape

- Every reset refusal reaches the loop through a trial gate's `reset?.kind === "refuse"` branch:
  - `flow-bootstrap/candidate/trial-gate.ts:404`
  - `flow-bootstrap/subflow-candidate/subflow-trial-gate.ts:462`
- That branch returns `{ kind: "llm_evidence_tool_execution", evidence: reset.evidence, effectApplied: reset.moved, targetsUnchanged: !reset.moved, resultCode: reset.evidence.code, resultReason: "retry_allowed" }`.
  - `reset.evidence.code` is one of `candidate.trial_reset_required` (`site-reset/trial-policy.ts:81`), `candidate.trial_start_differs` (`:84`) or `candidate.trial_reset_unproved` (`site-reset/ledger.ts:616`).
- The project paths answer `project.trial_reset_required` and `candidate.trial_reset_required` with `retry: true`, which adds `resultReason: "retry_allowed"`:
  - `project-agents/supervisor/tool-answer.ts:19`
  - `whole-trial.ts:137`
  - `single-subflow-trial.ts:253`
- `readToolExecution` (`LLM/evidence-loop-decision.ts:183-184`) keeps both fields. `evidence-loop.ts:452` passes `resultCode` and `execution.resultReason` to `repeats.recorded`, with `refused` set from `evidence.ok === false`.
- The guard's matching is correct as written: it compares the last dotted segment of `resultCode` (or the reason) against the names.

**Contradiction with the brief.** `"retry_allowed"` matches `RETRY_LATER` in `LLM/repeat-guard/retry-later.ts` (`/retry/`). In `outcomes.ts`, `recorded` therefore deletes the outcome for every real reset refusal (`|| retryLater`). So the shipped guard never refuses a reset-refused trial as a repeat, with or without a look between.

The debug note agrees. Rows 0096-0110 were `llm_evidence_loop.already_answered`, which is the first layer (`refused-action-retest.ts`, already fixed). Rows 0157-0161 were `repeat_refused` on the unchanged `core.submit_candidate`, not on a trial. The "second layer" the brief describes does not occur with today's gates.

The new precondition is defence in depth: it stops the guard's behaviour depending on whatever reason a gate happens to send. One consequence: the brief's "no call between: blocked" can only hold for a refusal without `retry_allowed`. With the real shape it is never blocked, and I left `retry-later` as it was, as the brief asked. If an identical trial with no call between should be refused by the guard as well, `retry_allowed` has to stop exempting these codes. That is your decision; I did not make it.

## What changed and why

- `LLM/repeat-guard/outcomes.ts`
  - `PRECONDITIONS` gains a second entry:
    - names: `trial_reset_required | trial_reset_unproved | trial_start_differs`. These are matched on the last code segment, so both the `candidate.` and `project.` forms count, and on the reason.
    - `met: (call) => !call.refused`
  - A new field `changesState` keeps the existing t587 rule exact. The start-location precondition still marks the call that meets it as having changed the build's state. The reset precondition does not, so an act that lifts a reset refusal is still recorded as "changed nothing" when that is what it did. `met()` now returns true only when it lifted a precondition with `changesState`.
  - The header has a new section naming the live run and the rule, and saying that `retry_allowed` already exempts these refusals. The old line "Any other failure stays refused..." now points to the precondition exception.
  - Everything else in the guard is unchanged.
- `LLM/repeat-guard/tests/reset-precondition.test.ts` (new; the folder has 14 files). Each case uses the recorded shape with `resultReason` omitted:
  - A look on the same page lifts all three codes and `project.trial_reset_required`.
  - With no call between, the trial is blocked.
  - A refused look does not lift it, and a later look that ran does.
  - An unrelated `target_covered` failure on the same page stays blocked after the look.
  - An act that met the precondition and left the page unchanged is still `changed_nothing`.
  - With `retry_allowed`, the refusal is never stored.
- `LLM/tests/repeat-policy.test.ts` gets two cases added, with every call reporting `stateDigests` `cart -> cart`:
  - A refused trial, then a same-page look, then the identical trial: the trial reaches the tool, the run ends ok, and there is no `already_answered` or `repeat_refused`.
  - Refuse, look, repeated forever, ends `llm_evidence_loop.repeat_without_progress` after fewer than 10 calls, and more than one trial reaches the tool.

## Commands run and observed results

- `npx vitest run .../runtime/llm/repeat-guard` -> 14 files, 80 tests passed.
- `npx vitest run .../runtime/llm/tests/repeat-policy.test.ts` -> 12 passed.
- Mutation check, setting the new `met` to `() => false`: 6 of the new tests failed (4 guard tests, both loop tests). The two that still passed were "blocked with no call between" and the `retry_allowed` case. I then restored the file and confirmed it.
- `npx vitest run packages/fluxiq/src/programs/automation-studio/runtime/llm` -> 220 files, 2117 tests passed.
- `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` -> exit 0, no output.
- `node scripts/structure-audit.mjs` -> `passed (409 warning(s), 1152 baselined)`. The only line for my files is an advisory warning: `outcomes.ts` is 609 lines against the 400 threshold (it was 577 before).

## Not verified

- No live run. Whether the real trial path ever sends a reset refusal without `retry_allowed` (where the new precondition would matter) is only known from reading the code: today no path does.
- `evidence-loop.ts` was not touched.

## Open questions or contradictions found

- The brief's second layer does not exist with today's `retry_allowed` reason, as explained above. Decide whether the guard should refuse an identical reset-refused trial when no call ran between. Today it does not, because `retry-later` exempts the refusal.
- `outcomes.ts` is past the 400-line advisory threshold (609 lines). Splitting `PRECONDITIONS` into its own module would be a natural follow-up.
