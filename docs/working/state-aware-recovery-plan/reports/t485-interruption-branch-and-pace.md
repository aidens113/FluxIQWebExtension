# t485 interruption-branch-and-pace: worker report

## Outcome

Done. This covers the original brief (D1, D2) and both coordinator additions:

- **N1:** label-only resubmits no longer become new revisions.
- **Continuation:** submission.ts wiring, the datasetId policy, the refusal time passed at failed-attempt.ts, and a check for a stated-limit source.

**Stated limit: no structured source reaches Core, so pacing is learned from refusals.** The failure record (`packages/contracts/src/failure/record.ts`) carries only `retryAfterMs`. A closed layer (`AutomationStudioClearedLayer`) carries only kind, control and wayOut. No rate-limit policy header is read anywhere. Following the supervisor's rule, I added no parsing of page wording and removed the unused stated-limit seam I had added earlier. This is now stated in the code headers and the architecture paragraph.

All changes are in Core (`C:/Users/osrs_/FluxStuff/fxwork/t485/!FluxIQ`). Nothing changed downstream except this report. No commits.

## What changed and why

### D1: pace learned from the limit, not from one hint (`runtime/executor/pacing/`)

- **New file `sustainable-pace.ts`** exports `automationStudioSustainablePaceMs({ letThrough, freeAt })`. It infers a limit of "N acts in any window W" from the node's earlier starts in this run that the site let through:
  - `freeAt` is the refusal time plus the hint: when the site says one more act will be allowed.
  - For each candidate k, assume the window held the last k let-through acts. Then W = `freeAt` minus the k-th latest of those starts.
  - A candidate k holds only if every let-through act had fewer than k let-through acts in the W before it, with 10% edge slack.
  - Of the k that hold, the widest W / k is kept, plus a 1.1x margin. The true limit is always one of the candidates, so the result is never shorter than what the run itself observed.
- **`pace-keeper.ts`:**
  - It records each start, and marks the latest one refused when `learn` is called.
  - `learn(node, hintMs, refusedAt?)` raises the pace to `max(sustainable ?? hint, pace in force x1.5)`, capped at 60 s. An authored pace is still never lowered.
  - The hint alone is used only when no earlier start explains the refusal, for example when the node's first act is refused.
  - If no refusal time is passed, it falls back to the run's clock as handed to `before()`.
  - Starts kept per node are capped at 32.
- **`index.ts`** now exports the new module.

### Refusal time (`runtime/executor/step-loop/failed-attempt.ts:79-82`)

- It now passes `attempt.finishedAt ?? attempt.startedAt` to `learn`.
- That is the same point `planned-retry-wait` counts the hint from, so the after-action snapshot (2.7-4.6 s in lane D) no longer stretches the inferred window.
- The step loop's other logic is unchanged.

### D2: a passed trial that met a slow-down must handle it first (`runtime/flow-bootstrap/candidate/trial-gate.ts`)

**What counts as "met an interruption"**, in a yes trial's feedback, any one of:
- a step whose `absorbed` entry has a positive `askedWaitMs`;
- a step `interruptions` entry of kind `rate_limit`;
- any entry under `paces`.

Other layers the run closed (consent, promotion, assistant, dialog) do **not** count.

**When the Flow counts as handling it:**
- Some plan node has `paceMs` at least the required pace, rounded down to a tenth of a second. The required pace is the trial's learned pace for that step, matched on definitionId, label and control; otherwise the longest wait the site asked for.
- And, only when the `rate_limit` interruption named a `wayOut`, the plan must also hold either:
  - a `builtin.timing.wait` node fed from a step whose `failed` port goes to a `builtin.control.merge`. This is how `optional: yes` plus `only after:` lowers, and it joins back into the loop pass;
  - or a `builtin.control.handler` node.
- If no way out was named, the pace alone is enough. This matches `flow-script-format.ts:377` (t470): a notice closed by the run itself needs no step.

**When it isn't handled:**
- The yes verdict stays.
- The answer carries `slowDown: [{ step, label, paceAtLeastMs?, wayOut?, waitAtLeastMs? }]`.
- "Complete now" is replaced by an instruction naming the `repeat pace:` value and the optional dismiss step plus `builtin.timing.wait` step (or one handler).
- `completion()` refuses with `candidate.trial_slow_down_unhandled`.

**Other details:**
- The plan is read only when the trial met a slow-down.
- The model-facing wording is abstract and names no scenario; the test fixture is an "archive the message" loop.
- The tool description is unchanged and none of this text is in `system-prompt-pins.json` (grep count 0), so the pins are untouched.

### N1: label-only resubmits (`candidate/unchanged-submission.ts`, `candidate/submission.ts`)

**Contract choice: answer "unchanged", don't rename the revision in place.**
- A trial verdict is bound to the revision and digest that ran.
- Renaming a tested revision in place would either void that verdict or leave a digest that no longer matches its plan.
- t464 already says a submission that changes nothing is not a new revision.

**What was built:**
- **`automationStudioCandidateSameBehaviour(a, b)`** compares two build plans while ignoring display-only words: the router name, rule names, block names, step `label`, and a record output's `label`.
  - Per the supervisor's policy, **`recordOutput.datasetId` is not ignored**: a changed one is a real change and makes a new revision.
  - A renamed step key is also a change, because edges and bindings read it.
- **`automationStudioCandidateUnchangedRefusal` takes `reworded`.** It then says only names changed, sets `feedback.reworded: true`, and keeps the code `candidate.unchanged_submission`.
- **`submission.ts`:** after the existing same-digest check, a plan that does the same as the last accepted revision goes through `sameAsLast(…, reworded = true)`.
  - That revision stands with its own names and its trial.
  - A refuted last revision still answers `unchanged_after_no`.
  - The flag is passed through `unchanged()`.
  - The `submit()` header documents the rule.

**Consequence for N1's evidence:**
- Revisions 2 and 3, which changed only the title and labels, would now be refused as reworded.
- Revision 4 also changed the label-derived `datasetId`, so under this policy it is still a new revision with its own trial. That is intended.

### Docs (`docs/architecture/automation-studio.md`)

- The "Pace" bullet is rewritten: refusal-learned spacing, the settle-time anchor, and why no stated limit is read.
- New bullets cover the trial gate's slow-down rule and reworded resubmissions.

## Commands run and observed results

`npx vitest` and `tsc` were run from `packages/fluxiq` in the Core tree; the structure audit from the tree root.

**1. Fail-first, D1 and D2** (before any source change): pacing tests plus `trial-gate-slow-down.test.ts` gave `9 failed | 20 passed`.
- The graph test reproduced D1: `expected [ 23500, 38500 ] to deeply equal [ 23500 ]`. The old pace let the site refuse again at 38.5 s.
- The keeper tests: `expected 1500 to be 5500`.
- The gate tests: `… not to contain 'Complete now'`.

**2. An existing test that pinned the old rule.** "is learned from a hinted refusal, grows on the next one" failed with waits `[2000, 3400, 2000, 5600]`, which matches a hand computation. Its expectations are updated: pace 4400 then 6600, `waitedMs` 9000.

**3. Fail-first, N1 functions:** `unchanged-submission.test.ts` gave `3 failed | 8 passed` (`automationStudioCandidateSameBehaviour is not a function`, and no `reworded` field).

**4. Fail-first, N1 controller and datasetId.** I temporarily disabled the new submission.ts line and put `datasetId` back in the ignored list, then ran:
- Result: `2 failed | 11 passed`.
  - Controller test: `expected { ok: true, … } to match object { ok: false, revision: 1, … }`.
  - datasetId test: `expected true to be false`.
- Restored both and re-ran: `13 passed (13)`. `grep` confirmed the restore: `Math.random` count 0, and `RECORD_OUTPUT_NAMES = ["label"]`.

**5. Fail-first, refusal time.** I added the graph test "counts the hint from when the refused attempt settled…": the D1 limit plus a 3 s after-action snapshot on the refused attempt.
- Before the failed-attempt.ts change it failed with `"paceMs": 6600` against an expected 5500.
- After the change: pacing tests `24 passed (24)`.

**6. Final run of every touched directory:**
`npx vitest run …/executor/pacing/tests …/flow-bootstrap/candidate/tests …/executor/step-loop/tests …/service/candidate-trial/tests/feedback.test.ts …/learned-paces.test.ts`
-> `Test Files 23 passed (23)`, `Tests 191 passed (191)`.

**7. Typecheck:** `npx tsc --noEmit -p .` -> no output, exit 0.

**8. Structure audit:** `node scripts/structure-audit.mjs` -> exit 0, `structure-audit: passed (338 warning(s), 1159 baselined)`.
- The only finding on a touched file is advisory: `trial-gate.ts: 467 lines` (warning at 400, hard limit 800).
- It also printed "2 baseline entries can be lowered". I did not run `pnpm structure:baseline`, because the baseline is a shared file.

## Not verified

- No live, Lab or provider run. That a live build now adds the dismiss-and-wait branch, and that playback is no longer refused, is unproven.
- The gate checks only the shape of the wait branch (an optional step, then a wait, joined back). It does not check the wait's duration, or that the optional step presses the named `wayOut`: candidate plans hold resolved targets, not `tNNN` handles. The way-out refusals in `script-statements` cover a step that presses the wrong control.
- If a hint ever arrives as an HTTP-date `Retry-After` (absolute), it is computed against `now()` in assess while `freeAt` uses the settle time. That understates the window by the snapshot time. Today's producers send relative `retryAfterMs`. `planned-retry-wait` makes the same assumption.
- A model renaming a step's short key (not just its description) is treated as a real change, by design, and is not tested.

## Open questions or contradictions found

1. **The hint no longer sets a floor under the learned pace when a limit is inferred.** t378 said "a hint is the floor either way".
   - Why it changed: after a burst, the hint (time until one more act is allowed) can exceed the sustainable spacing. The retry still waits that hint once, but holding every later pass to it would be needlessly slow.
   - The hint floor still applies when nothing can be inferred.
2. **A stated limit needs a structured source first.** If one is wanted later, three pieces are missing: a producer field (for example on the failure record in `@fluxiq/contracts`), the assessment reading it, and `learn` taking it. None exists today.
3. **N1's revision 4 would still cost a trial**, because its label-derived `datasetId` changed. That follows the supervisor's policy that a `datasetId` change is real. If label-derived ids should not count, the derivation (`authoring/record-output.ts:107`) is the place to change, not the comparison.
