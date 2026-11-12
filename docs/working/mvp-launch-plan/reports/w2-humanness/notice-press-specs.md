# W2: the two e2e specs for the notice-only press (t898)

## Outcome

Done. Both specs pass against the t898 change (0140148c5). The product is fine. Spec 1 needed nothing beyond the supervisor's edits.

Spec 2's earlier failure had three causes, and none of them is a t898 regression:

1. Two of its expectations measured the old two-command sequence.
2. Its scripted Flow had stopped meeting a Core submission rule added on 2026-10-30.
3. Its trial capture relied on a builder turn that Core stopped giving on 2026-10-30.

No record shows spec 2 passing after 2026-10-29. The last recorded pass is in the t791 R-merge-regression report, dated 2026-10-29. So it was already broken on dev before t898. I did not run it on the pre-t898 tree to prove that; see Not verified.

## Spec 1: `apps/extension/e2e/content/tests/reveal-by-scroll/tests/company-website-team-more.spec.ts`

**What it measures.** This is the content harness: the real content-script bundle on company-website's team page, with no Core and no model.

- **The two "Show more people" tests.** One `web.dom.click` command must succeed. Its account must say the target was scrolled toward, where that applies. It must also say "pressed once more", meaning the page's notice-only first press was pressed again in the same command. Finally, the grid must have grown.
- **The third test.** Next page reaches every batch.

**Is the bundle current?** `e2e/content/global-setup.ts` builds the content bundle from source for every run, so it carries t898.

**What changed.** Nothing beyond the supervisor's uncommitted edits, which state the new behaviour correctly.

## Spec 2: `apps/extension/e2e/site-reset/tests/job-failed-save.spec.ts`

### (a) How it measures

- **`clicks`.** `observed.clicks()` (`e2e/site-reset/instrumented-runtime.ts:67`) counts the `web.dom.click` commands dispatched through the instrumented LLM evidence runtime. It does not count physical presses.
  - One command that presses twice inside itself counts as +1.
  - Before t898, the board swallowed the first press, the command failed `web.action.page_reported_failure`, and the domain's node retry sent a second command. That made +2.
- **`attempts`.** This comes from the domain's node run: `domain/src/runtime/llm-evidence/node-run/run.ts:558` is `attempts: attempts > 1 ? attempts : undefined`. So a single attempt leaves the field out, and `undefined` is the true answer for one attempt.
- **What the run showed.** The save's answer was `ok`, `succeeded`, and had no `attempts`. Its `read.validation.actual` said: "the page answered the first press with nothing but a notice in one of its own status or alert regions and left everything else exactly as before, so it was pressed once more". The click count went from 0 to 1, and My jobs went from 2 rows to 3. So there was one command and one attempt, with two presses inside the command.
- **Trial clicks are not counted.** The trial's playback does not dispatch through this instrumented runtime: a measured `trialClicks` was 0 even though the trial's save landed. The shared file's doc comment, "by any caller: the builder, a trial, ...", is therefore stale. I did not edit it because it is a shared file.

### (b) Why the build ending was `failed`: Core drift, not t898

- **The refusal.** The failed run's `core.submit_subflow` was refused with `candidate.toggle_state_required`. The cause is that the save's answer carries a `toggle` signature: the heart gains class `css-04lcxz0`.
  - Core added this refusal in `framework/automation-service/toggle-state/choice.ts`, through Core commits `0bef3866f` and `f6760d4c3` on 2026-10-30. It requires `ensureState` on any step whose control has explored press observations.
  - The domain computes the signature from the look before the act and the look after it (`node-run/press-effect/toggle-signature.ts`, called at `run.ts`). Retries play no part.
  - So a save that took two attempts under the old behaviour would carry the same signature and be refused the same way.
  - The builder's step-9 guard then threw, and Core ended `flow_bootstrap.evidence_repeat_without_progress`.
- **The missing trial answer.** Once the Flow was fixed, the trial ran and answered yes, but `tests` stayed empty. Core `879ec6584` (t811, 2026-10-30) completes a brief on the judged whole run's yes before any further provider decision. Core's own tests were changed then to "keep the test's answer even when Core completes before another provider decision". The spec recorded the trial's answer on a builder turn 10, which no longer comes.
- **History.** The spec's last substantive change was `f0204c596` on 2026-10-29, the day before both Core changes.

### What changed in spec 2, and why

- **Header.** It states the single-command behaviour, explains what `clicks` counts and when `attempts` is omitted, and says why the save step names `ensureState`.
- **Save assertions.**
  - `attempts` is now `toBeUndefined()`. The supervisor's `toBe(1)` could never hold, because the field is omitted at one attempt.
  - The click count is `before + 1`, since one command is sent.
  - New: the save's account must contain the exact "...so it was pressed once more" phrase from `click.ts` `PRESSED_AFTER_NOTICE`. This is the in-command proof of the second press.
  - New: the answer's `toggle.signature` must equal the state the Flow names.
- **Scripted Flow.** The save step now writes `ensureState`, copied exactly from the save answer's `toggle.signature` (the saved heart). This is the same choice photo-obstruction-toggle makes. If no signature was observed, the step throws `diagnostic.observed_toggle_state_missing`.
- **Trial assertions.** The removed assertions read the trial's own answer (`startedWith`, `actsToUndo`, `actsToRestore`, `feedback.steps`), which this builder can no longer see. In their place:
  - A scripted supervisor, identical to the default one (one-part plan, same brief, completes with `dispatch.complete`), keeps the `project.dispatch` answer. The spec asserts:
    - `returns` is `["done"]`;
    - `trialsAnswered` verdicts are `["yes"]`;
    - the return's `proposal.revision` is the submitted revision;
    - `complete.revision` is the submitted revision, and `complete.digest` is a 64-hex digest.
  - Why the digest is not compared with the submission's: my first attempt asserted they were equal and it failed. `complete` names the Flow assembled from the subflow, and the dispatch's `next` says so.
  - The builder took exactly 9 turns, so no turn followed the trial.
  - A `verify` that gives the default bare yes keeps what the judge was shown. The judge was asked twice: the trial, then Core's converse `recheck` of a yes, which photo-first-row-toggle also expects as two requests. Both times its `flowShape` was `["open the job", "save the job"]`, with the save step's `changed` containing "Job saved".
  - The scripted judge says yes to anything, so the site is also checked:
    - `baselineTitles` must not contain the target job (new assertion);
    - after the undo, My jobs read the baseline again (existing assertion);
    - after the build, the target job's title is on My jobs (`savedAfterTrial > 0`). So the trial's own save landed on a clean site.
- **Imports.** I dropped `actsUnder`, `startedWithActs` and `trialCode`, which are now unused.
- **Fixture files.** The scripted replies live inside the spec, so it owns no separate scripted-provider fixture. I did not touch any shared fixture (`scripted-provider.ts`, `project-build.ts`, `instrumented-runtime.ts`).

## Commands run and observed results

- **Spec 1.** `cd apps/extension && node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t898-e2e -- pnpm test:content -- --workers=1 company-website-team-more.spec.ts` gave exit 0:
  - `ok 1 ... pressed from the top of the page ... (7.9s)`
  - `ok 2 ... pressed at the end of the page right after it loads ... (7.3s)`
  - `ok 3 ... Next page reaches every batch ... (10.2s)`
  - `3 passed (1.1m)`
- **Spec 2.** Each run used `... heavy-slot.mjs run t898-e2e -- pnpm test:e2e -- site-reset/tests/job-failed-save.spec.ts`.

| Run | What it tested | Result |
| --- | --- | --- |
| 1 | `ensureState`, attempts undefined, clicks +1 | Failed at `trialCode(tests[0])` (undefined). Submit was accepted, ending `proposed`, builder steps 9: the trial ran with no turn after it. |
| 2 | Supervisor and judge capture | Failed: `judged` length 2 (trial plus `recheck`). `trialClicks` was 0 while `savedAfterTrial` was 1. |
| 3 | Judge and recheck assertions | Failed: `complete.digest` was not the submission's digest (assembled Flow). |
| 4 | Final version | Exit 0, `ok 1 ... (24.1s)`, `1 passed (3.1m)`. |

  The summary line from run 4 was:
  `{"resetDiagnostic":{"ending":"proposed","failure":{},"saveClicks":{"before":0,"after":1},"submit":"accepted","undoHeld":["candidate.undo_unproved","subject_there_before"],"undo":["ok",null],"builderSteps":9,"judged":2,"savedAfterTrial":1,"complete":{"revision":1,"digest":"d500...6fdb"},"returns":["done"]}}`

- **Typecheck.** `heavy-slot ... npx tsc -p tsconfig.test.json --noEmit` (apps/extension, which includes `e2e/**`) gave exit 0 with 0 `error TS`. I ran it twice; the second run was on the final file.
- **Structure audit.** `node scripts/structure-audit.mjs` (repo root) printed `structure-audit: passed (247 warning(s), 552 baselined).` Neither spec has a warning.

## Not verified

- **Pre-t898 behaviour of spec 2.** I did not run spec 2 on the pre-t898 `click.ts`, because `src/**` must not be touched. The claim that it already failed on dev after 2026-10-30 rests on three things: the Core commit dates, the attempt-independence of the toggle signature in the code, and the absence of any recorded pass after 2026-10-29.
- **Each spec ran green once in its final form.** I did not repeat them for flakiness.
- **Headed mode.** I did not run either spec headed.

## Open questions or contradictions found

- **The supervisor's `attempts` expectation was wrong.** It expected `attempts` to be 1, but the domain omits the field for a single attempt, so `toBe(1)` could never pass.
- **Other specs probably have the same two drifts.** I did not run them, because they are outside the brief:
  - Builder scripts that record a trial's answer on a later builder turn, after a yes that completes the brief (Core t811). This includes `judged-change-save-then-read.spec.ts` (`answers["trial.second"]`), `office-site-reverted-toggle.spec.ts` and `job-undo-redraws-on-load.spec.ts`.
  - Toggle steps written without `ensureState`.
  - Their owners should check them.
- **A stale shared comment.** `e2e/site-reset/instrumented-runtime.ts:48` says `clicks()` counts clicks "by any caller: ... a trial". The trial's playback does not go through it. This is a shared file, so its owner should fix the comment.
