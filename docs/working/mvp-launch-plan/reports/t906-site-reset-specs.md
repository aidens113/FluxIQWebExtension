# t906: three site-reset specs drifted on Core's 2026-10-30 changes

## Outcome

Done. All three specs pass. None was a product regression. All three drifted on the two Core changes of 2026-10-30:

- `toggle_state_required` (Core 0bef3866f, f6760d4c3): a step on a control that toggles is refused at submit without `ensureState`.
- Auto-complete on a judged whole run's yes (Core 879ec6584, t811): the brief completes before any further builder turn, so the trial's answer never reaches the scripted builder. The verdict is read from the supervisor's `project.dispatch` answer.

Scenarios: job-board (two specs) and everything-store (one). Both are among the ten realistic scenarios.

The tree needed one extra build before any spec would load: `node scripts/build-cache/cli.mjs test-contracts:build`. Without it the first run died with "Cannot find module ...test-contracts/dist/index.js". The step restored from the shared store.

Model for the fixes: W2's `job-failed-save.spec.ts` (the `ensureState` copied from the save's own `toggle.signature`, and a supervisor that keeps the dispatch answer). The dispatch assertions are the same as that spec's.

## 1. judged-change-save-then-read.spec.ts

- **Failure before (dev).** `expect([trialCode(trial.first), trialCode(trial.second)]).toEqual(["yes","yes"])` received `[undefined, undefined]`. The diagnostic showed the cause: `submit` was refused `candidate.toggle_state_required` (step "save the job"), the build ended `failed` with `flow_bootstrap.evidence_repeat_without_progress`.
- **Cause.** Two drifts. (a) The save step had no `ensureState`. (b) After that was fixed, the first trial's yes completed the brief (ending `proposed`), so the builder never ran the second revision or `trial.second`, and the trial answers were never visible. The spec's "tested twice, second revision" shape can no longer be reached in one build.
- **Change.**
  - The save step now writes `ensureState`, copied from `answers.save.toggle.signature` (throws `diagnostic.observed_toggle_state_missing` if absent).
  - Dropped the unreachable second revision, which added a `capture_snapshot` step, and its trial.
  - A supervisor wrapper keeps the dispatch answer.
  - The `trialCode` assertion is replaced by dispatch assertions: outcome `done`; `trialsAnswered` verdicts `["yes"]`; return proposal revision and `complete.revision` equal the submitted revision; `ending` is `proposed`.
  - `siteChanges` length is now 1. The judge's two requests (trial and Core's recheck) are one run.
  - Kept as before: no undo declarations, no retired codes, the save skipped `already_in_state` with no `changed` act, and the My jobs read with >= 3 rows.
  - The header comment now says why.
- **Result after.** `pnpm test:e2e` on the spec: `1 passed (3.0m)`.
- **Weakened?** The only thing no longer exercised is the second-revision trial. That trial cannot occur since t811. The judge-saw-siteChange and `already_in_state` assertions are intact.

## 2. office-site-reverted-toggle.spec.ts (everything-store)

- **Failure before (dev).** `expect(tests).toHaveLength(1)` received 0. The diagnostic shows the build `proposed`, the untick settled (`undo.toggle` = `candidate.undo_already_back`, `canMeet: no_call`, clicks unchanged), `trial.first` with no recorded answer. There was no toggle-state refusal (the step is Buy Now, `create_new`).
- **Cause.** t811. The trial answered yes, the brief completed, and no builder turn received the trial answer, so `tests` stayed empty.
- **Change.**
  - A scripted supervisor (same plan and brief as the default, permitted `create_new` and `modify_existing`, 20 iterations) keeps the dispatch answer.
  - The `tests[0]` assertions (`actsToUndo` empty, `trialCode` yes, `trialRunId`, Buy Now feedback step succeeded, `startedWith` has no untick) are replaced by:
    - `tests` is empty and the builder took exactly 9 turns;
    - no retired codes;
    - outcome `done`, one trial with verdict `yes`, proposal and `complete` revision equal to the submitted one;
    - `ending` is `proposed`.
  - All the settlement assertions before the trial are unchanged: ref issued, Buy Now press, untick, fresh session ticked again, undo `already_back`/`no_call`, no click, no declaration. So are the end-of-build site assertions: cart hash equals baseline, Plus box ticked.
  - Removed the now-unused `startedWithActs`, `trialCode` imports and `feedbackSteps`.
- **Result after.** `1 passed (4.6m)`, then `3 passed (5.0m)` with the job-undo spec in the same invocation.
- **Weakened?** Yes, in one respect. The trial's own answer fields (`actsToUndo` empty, `startedWith`, `trialRunId`, per-step feedback) are no longer readable since t811. The dispatch answer only says the trial answered yes. "Admitted, with nothing left to undo" is now evidenced by the trial having run and passed, plus the pre-trial settlement assertions.
- **Flake seen once.** In the run that first added the supervisor (alongside the job-undo spec), the trial failed `execution_failed`: Buy Now "ignored the first press, pressed once more, ignored that press too", with the build ending `failed` (`project.completion_not_latest`). Two later runs of the same file passed. I did not trace it. See Open questions.

## 3. job-undo-redraws-on-load.spec.ts

- **Failure before (dev).**
  - `expect(trialCode(mid)).toBe("yes")` received `undefined`.
  - The diagnostic shows `submit` refused (`ok: false`, same `toggle_state_required`) and the build `failed` with `evidence_repeat_without_progress`.
- **Cause.** (a) No `ensureState` on the save step. (b) With that fixed, `trial.mid`'s yes completes the brief, so `undo.third`, `trial.final` and the final-trial assertions are unreachable. The spec's single build proved two moments, and only one can happen per build since t811.
- **Change.**
  - The save step has `ensureState`, copied from `answers["save.0"].toggle.signature`.
  - The test is now two tests from one script (a `VARIANTS` loop):
    - **A** (original name): two undos, submit, one trial with the third act still in place. Asserts `leftFromEarlier` has length 1, no unsettleable acts, and the trial is not refused `acts_unsettleable`.
    - **B** ("admits the trial on the restored site..."): two undos, reload, third undo, reload, submit, one trial. Asserts `undo.third` ok and `leftFromEarlier` empty.
  - Both assert: saves admitted, `undo.first` ok with exactly one click, `undo.second` ok, no retired codes, dispatch outcome `done`, one trial with verdict `yes`, proposal and `complete` revision equal the submitted one, and `ending` is `proposed`.
  - Header comment updated.
- **Result after.** `3 passed (5.0m)` (these two tests plus the office spec).
- **Weakened?** The trial answer's own fields (`unsettleable`, `actsToUndo` empty, `failed`) are no longer readable. Those assertions now run on an empty object, so they are vacuous. The dispatch verdict `yes` plus the judge's `leftFromEarlier` carry the claim instead. Splitting keeps both moments the old spec proved.
- **Left as is.** The "KNOWN GAP (t772 w11)" comment at the top of the test body. Whether it is still true is not something I checked.

## 4. instrumented-runtime.ts (stale comment, line 48)

Reworded the `clicks()` doc. It counted clicks "by any caller: the builder, a trial, or Core's own look". It now says it counts click commands dispatched through this runtime, that a trial's playback does not go through it, and that one command pressing twice counts once. W2 measured `trialClicks` at 0 while the trial's save landed. Comment only; no code change.

## Commands run and observed results

All through `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t906 -- "<cmd>"`, from `apps/extension`, slot queue waits of up to ~15 minutes.

| Command | Result |
| --- | --- |
| `node ../../scripts/build-cache/cli.mjs test-contracts:build` | `build-cache: reuse ... restored from the shared store` |
| `pnpm test:e2e -- site-reset/tests/judged-change/tests/judged-change-save-then-read.spec.ts` (first, no test-contracts build) | `Cannot find module ...test-contracts/dist/index.js`, `No tests found` |
| same, dev's version | `x 1 ... (19.7s)`, `1 failed`: `[undefined, undefined]` vs `["yes","yes"]` |
| same, with `ensureState` only | `x 1 ... (25.9s)`, failed at the same line; build `proposed` with a single judge run |
| same, final | `1 passed (3.0m)` |
| `pnpm test:e2e -- site-reset/tests/office-site-reverted-toggle.spec.ts site-reset/tests/job-undo-redraws-on-load.spec.ts`, dev's version | `x 1 job-undo ...`: `trialCode(mid)` undefined; `x 2 office ...`: `tests` length 0; `2 failed` |
| same pair, with `ensureState` and dispatch capture, before the split | job-undo failed at the same `trialCode(mid)` line; office failed on the trial `execution_failed` flake |
| `pnpm test:e2e -- site-reset/tests/office-site-reverted-toggle.spec.ts` | `1 passed (4.6m)` |
| `pnpm test:e2e -- site-reset/tests/job-undo-redraws-on-load.spec.ts site-reset/tests/office-site-reverted-toggle.spec.ts` (final files) | `3 passed (5.0m)` |
| `npx tsc -p tsconfig.test.json --noEmit` (apps/extension) | 25 `error TS`, none in `e2e/site-reset` (all `packages/test-runner` "Cannot find module '@fluxiq-web-extension/domain/node'": the domain is not built in this tree) |
| `node scripts/structure-audit.mjs` (repo root) | `structure-audit: passed (247 warning(s), 552 baselined).` |

## Not verified

- Each final spec ran once in its final form, except office (three times total in later forms: one flake, two passes). No flakiness sweep.
- Typecheck of my files is only "no errors reported against `e2e/site-reset`"; the tsc run is dominated by unrelated errors because the domain is not built here, so type errors in my files could still be masked by unresolved modules.
- No headed run, no pre-t811 comparison, and no check of whether the KNOWN GAP comment in job-undo is still true.

## Open questions or contradictions found

- **Office trial flake.** One run's trial failed Buy Now twice (`web.validation.output_not_observed`, "page ignored the first press ... and ignored that press too"), with the build ending `failed`. Two later runs passed. Cause not traced. Could be a real intermittent product or timing issue in the trial's Buy Now press on the product page after a build with three earlier Buy Now presses; worth a trace by whoever owns the store's press handling.
- **The trial's own answer is invisible to scripted builders since t811.** Any spec that relied on `startedWith`, `actsToUndo` or per-step trial feedback now loses it. If those fields matter for coverage, Core would need a seam that exposes the trial answer to the scripted harness. That is not a change for this brief.
- **dev's spec headers describe two-trial flows** in other site-reset specs I did not look at.
