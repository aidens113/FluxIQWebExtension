# t748-u6-small-points: worker report

## Outcome

Done. Point (a) is fixed and point (b) is fixed. Point (c) was not real: the spec already makes that check at HEAD, so I changed nothing for it.

## What changed and why

### (a) A refused-repeat stall names the refusal before it

Core `R/llm/decision-handlers/refused-repeat.ts`:

- `automationStudioLlmEvidenceRepeatStop` builds the stall it ends under with the issue codes `[<guard code>, "llm_evidence_loop.last_refusal:<code>"]`.
- `<code>` is the newest call or look that the decision history (`context.history.records()`) records as `refused` under a code of its own. A refused repeat does not count, and neither does the placeholder code `ok`.
- When nothing was refused before the repeats, the stall carries only the guard's code, as it did before.
- What is refused has not changed. The count, the threshold and the note the model gets are as they were.
- Stall recovery (`recoverStall`) is still asked with the guard's code alone. So the recovery note's `stalledOn`, which the model reads, is unchanged. Only the stall that actually ends the round carries the extra code.
- The new code goes after the guard's code, never before it. That keeps every consumer that reads `issueCodes[0]` unchanged (`project-agents/supervisor/supervisor-loop.ts:337`). `automationStudioCandidateStallCode` is also unchanged, because the guard's code already makes that stall `repeat_without_progress`.
- The candidate decoder (`service/candidate-failure/refusal-codes.ts`) keys on its own `candidate.last_submission_*` prefixes, so the new code does not disturb it.
- The private prefix constant and the helper both sit in the same file. No new export was added.

How the code reaches the supervisor and the step log. I traced this in the code and did not run it:

1. The stall's `issueCodes` become the thrown failure's `diagnostic.issueCodes` (`service/project-build/brief-ports.ts:248-254`, `service/project-build/run.ts:251`).
2. `project-agents/dispatch/ending.ts` `thrownEnding` passes them to `stoppedOn` and then to `guardSaid`. `guardSaid` prints every code that matches `SAYABLE` (`/^[a-z0-9_.:-]{1,120}$/i`). The new code matches it.
3. The supervisor's brief return therefore reads "It was stopped by llm_evidence_loop.repeat_refused, llm_evidence_loop.last_refusal:<code>."
4. The step log records that tool answer as it does every other.

No change to `llm/step-log/**` was needed.

One existing test had to follow the change. `llm/decision-handlers/tests/stall-keeps-schedules.test.ts` asserted the stall's codes exactly. Its subject is the steps a stall hands over, not the codes. Its helper now takes the full expected codes, and the refused-repeat case expects the added code.

### (b) The ending keeps sentences that explain a failure

Core `R/service/project-build-ending/reason-checked.ts`:

- **Old rule:** drop any sentence that names a part, stage, section or step together with any word for test, pass, fail or work.
- **New rule:** a sentence that names a part is dropped when it:
  - claims a test, trial, pass or judgement, explained or not; or
  - says something failed or did not work without saying why.
- A sentence that names a part with a failure word and says why ("because", "since", "due to", "owing to", "when") is kept, as long as it claims no test, trial or pass.
- The colon-head rule is unchanged.

Why it is done on the text alone:

- The only caller is `service/project-build/run.ts:407`, which I must not touch. It hands the check the reason text and nothing else; it does not pass Core's structured record.
- Core's record (`record-told.ts`) says how parts' tests came out in counts, never by part name. So the record cannot back a claim about a named part's test result, and those claims must still give way. That is the part of the brief's "contradicts or cannot back" that the record can actually decide.
- A sentence that explains why something failed states a cause the record does not hold at all, so it now stays.

The existing `tests/ending-truth.test.ts` passes unchanged. "the part that saves it kept failing" is still dropped, as an unexplained failure, and "never passed its own test" is still dropped.

### (c) Judged not real: the spec already checks the refusal

`D/apps/extension/e2e/site-reset/tests/job-failed-save.spec.ts` at HEAD already sends an undo aimed at a job saved before the build:

- Step 6 sends `undo.held` on `HELD` (`hv2`, `ALREADY_SAVED`) with `undoes: act-1`.
- Lines 157-167 assert:
  - `ok: false`
  - `code: candidate.undo_unproved`
  - `failed: subject_there_before`
  - `canMeet: no_call`
  - a non-empty condition
  - no click dispatched (`clicks.after === clicks.before`)
  - the declaration `permitted: false`
- `undoneHash === baseline` (line 174) also shows that My jobs still holds both of its original rows.

t743's lead put this back in commit `d2302b5f` (`git diff d2302b5f~1 d2302b5f` shows step 6 and these assertions added). t738's open point (t738 report, lines 212-213) was written before that commit and is now closed. I did not edit the spec.

### Proposed doc text, for the lead to place

> **Refused-repeat stalls name what stranded the builder (t748).** When three refused repeats in a row end a round, the stall's issue codes are the guard's own (`llm_evidence_loop.repeat_refused`, or the amendment code) followed by `llm_evidence_loop.last_refusal:<code>`. `<code>` is the result code of the newest call or look Core refused for a reason of its own before the repeats, for example a `candidate.*` or reset-gate code. A supervisor's brief return prints it after "It was stopped by". Recovery is still asked with the guard's code alone.
>
> **Ending reasons keep their explanations (t748).** Where Core's record of a build's tests is said, the supervisor's reason loses sentences that name a part and claim a test, trial or pass, or that say a part failed without saying why. A sentence that says why a part or step failed ("... failed because ...", "... did not work when ...") is kept.

## Commands run and observed results

All Core commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t748/!FluxIQ/packages/fluxiq` unless noted. `R` = `src/programs/automation-studio/runtime`.

**Tests fail on HEAD:**

- `pnpm exec vitest run $R/llm/decision-handlers/tests/stall-names-last-refusal.test.ts`, run before the fix (HEAD's `refused-repeat.ts` was untouched; a copy is in scratch as `u6-head-refused-repeat.ts`):
  - observed `Tests 2 failed | 1 passed (3)`;
  - `expected [ 'llm_evidence_loop.repeat_refused' ] to deeply equal [ …(2) ]`;
  - the passing case is the "nothing refused before" guard.
- `pnpm exec vitest run $R/service/project-build-ending`, run before the fix (copy in scratch as `u6-head-reason-checked.ts`):
  - observed `Tests 2 failed | 5 passed (7)`;
  - `expected '' to be 'The save step failed because the boar…'`.

**After the fixes:**

- `stall-names-last-refusal.test.ts`: `Tests 3 passed (3)`.
- `$R/service/project-build-ending`: `Tests 7 passed (7)`.
- The combined run of:
  - `$R/llm/decision-handlers`
  - `$R/service/project-build-ending`
  - `$R/service/project-build/tests/project-build-{facade,reset,time-limit}.test.ts`
  - `$R/llm/deepseek/tests/system-prompt.test.ts`
  - `$R/flow-bootstrap/plan/tests/extraction-vocabulary.test.ts`
  - `$R/flow-bootstrap/plan/tests/issue-feedback*`
  - `$R/llm/evidence-loop`
  - `$R/activity/tests/refused-call.test.ts`
  - `$R/project-agents/dispatch/tests`

  first gave `Test Files 1 failed | 79 passed (80)`, `Tests 1 failed | 641 passed (642)`. The one failure was `stall-keeps-schedules.test.ts`, whose exact-codes assertion I then updated.
- `$R/llm/decision-handlers` after that update: `Test Files 20 passed (20)`, `Tests 86 passed (86)`.

**Typecheck and audits:**

- `pnpm exec tsc --noEmit -p tsconfig.json` (Core): 15 errors, all in `service/candidate-trial/tests/feedback.test.ts`, another worker's file. None are in my files.
- `node scripts/structure-audit.mjs` at Core's root: `2 violation(s) across 1 rule(s)`, both `[naming]` depth failures in `service/candidate-trial/step-control/*`, another worker's files. A grep of the audit output for my files found nothing.
- `node scripts/structure-audit.mjs` at the downstream root: `structure-audit: passed (218 warning(s), 618 baselined)`.
- `cd D/apps/extension && node scripts/check-extension.mjs`: no output, exit code 0.

## Not verified

- I did not run the browser spec, as the brief directed. The lead runs it after rebuilding Core.
- I did not run a test of the supervisor-facing words for (a): the `guardSaid` line in `project-agents/dispatch/ending.ts` and the step log. That path is traced from the code only; `project-agents/dispatch/tests` passed but asserts no stall that carries the new code.
- I did not run the full suites.

## Open questions or contradictions found

1. **The person's ending may gain a second reason.** The new code can reach `flow-bootstrap/unfinished-build/not-done.ts` `automationStudioFlowBootstrapBlockedSaid` through `round-ending.ts` `lastIssueCodes`. Its `BLOCKED_WORDS` patterns test the whole string, so a carried code containing `permission`, `replay`, `dry_run`, `plan`, `node` or `subflow` adds a second reason clause after the repeat clause (it shows at most two). Usually that adds information. A loose match such as `node` inside a site code could word it misleadingly. If that is unwanted, `blockedSaid` should skip codes that start with `llm_evidence_loop.last_refusal:`. That file is outside my ownership, so I did not change it.
2. **Record-aware checking is not wired.** A check that decides against Core's record itself would need `run.ts` to pass the per-part trials into `automationStudioProjectBuildReasonChecked`. Because the record names no parts, it still could not back a claim about a named part, so I judged the text-only rule to be the correct one.
3. **The brief's premise for (c) is outdated.** It said the spec no longer checks the refusal, but t743's commit `d2302b5f` had already put the check back.
