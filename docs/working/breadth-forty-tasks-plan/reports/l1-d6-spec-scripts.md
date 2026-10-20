# l1-d6-spec-scripts: site-reset spec scripting fixes

## Outcome

Done. All six site-reset cases passed headed in one run (`6 passed (5.4m)`). There are no `test.fail`, `test.fixme`, `test.skip` or `.only` markers. The typecheck and the downstream structure audit both pass. No product source was edited in either repository, and no product defect turned up.

## What changed and why

### `apps/extension/e2e/site-reset/tests/office-buy-now.spec.ts` (shape E)

**Choice: the second test now runs against a new revision that the product accepts.** I did not fall back to requiring the press only on answers with a new `trialRunId`.

**Why the old second test ran no trial.** On a single-subflow plan, the builder's `core.test_subflow` is the judged whole run. When the supervisor's whole test is asked about a revision whose yes still stands, it returns that stored yes and runs nothing (Core `project-agents/supervisor/whole-trial.ts`, `alreadyJudged`, t679). That is why the second answer had the same `trialRunId` and no `feedback.steps`.

**Why the new revision adds a step.** Resubmitting the same Flow, or the same Flow with only new wording, is refused as unchanged (`flow-bootstrap/candidate/unchanged-submission.ts`, t464/t485). So the second revision has to change behaviour. It adds one step after Buy Now: `step check: look at the checkout page`, `node: web.dom.capture_snapshot`. A builder could honestly make that change, and it adds no lasting act.

**New builder sequence when there are two trials:**
1. test revision 1;
2. navigate elsewhere (not the cart);
3. `submit.second` creates revision 2;
4. test revision 2;
5. complete on revision 2.

**Changes to `expectOfficeCommon`:**
- Each test asks its own revision: `revisions` must equal `[1..n]` and match each answer's `revision`.
- Every `trialRunId` is distinct and has the form `trial.*`.
- Every test, not only those answering yes, has a succeeded `Buy Now` step.

**Design assertions left unchanged:** Core's own look before each test (`looksBefore` `[1,1]`), no undo pressed (`clicksEnd === clicksAfterBuy`), looks declare nothing lasting, every cart read equals the baseline, and the second admission lists `buy` plus the `trial step N` act as left unchanged.

### `apps/extension/e2e/site-reset/tests/photo-toggle.spec.ts` (shape G)

**The Flow now likes the post where its control was saved.** It runs three steps:
1. navigate to the profile;
2. click the grid cell of the liked post (the handle the build clicked during exploration, `consequences: none`), which opens the post's dialog;
3. click the Like handle saved inside that dialog (`consequences: modify_existing`).

**Builder steps 1 to 11 are unchanged:** the explored Like in the dialog, refusal with a `settle`, the other post's undo refused unrun, the Unlike on the post's own page admitted, and the next test admitted. That trial now runs to its end with a yes.

**New steps after the passing trial.** The trial left its own Like (act-4) on the site, which is photo r2's real situation.
- **Step 12:** test the same revision again. The builder's gate checks the site before it would run.
- **Step 13:** the gate refuses `candidate.trial_reset_required`, listing act-4 (`trial step 3 "like the post" on "Like"`) with a control settle. The build then navigates to the post's own page.
- **Step 14:** `unlike.trial`, the Unlike with `undoes: act-4`. It is admitted and dispatched once.
- **Step 15:** complete. The build ends `proposed`.

**New assertions:**
- The trial's steps are all `succeeded`, and step 3's control is `Like`.
- act-4 appears in that trial's `leftOnSite`.
- The re-test is refused, and act-4's `did` is `trial step 3 …`.
- act-4's settle is the control settle.
- The `unlike.trial` declaration is permitted, at the Like's place, in a state other than the Like's.
- Exactly one click was dispatched, and the post shows Like at the end.

**Fix to an existing assertion (a spec bug, not a design change).** The old check was `toContain("its control")`, lower case. Core's words begin a sentence: "Its control at <page> still shows the state this act set: press that same control back once, naming this act under undoes." Core's own unit tests pin that sentence (`site-reset/tests/settlement-shapes.test.ts:250`). The old run never reached this assertion because the build failed first. It is now an exact match of that sentence with the post's page URL, which is stricter than before.

**One difference in the trial act's settle.** For the trial act, Core's settle has no page: "Its control still shows the state this act set: …". The assertion accepts that sentence with or without ` at <post page>`; see the open questions.

Timeout raised from 300 s to 420 s, and the scripted builder's limits from 20/30 to 24/36, to fit the four extra turns.

## Commands run and observed results

Run from `apps/extension` unless noted.

- `node --no-experimental-strip-types node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts e2e/site-reset/tests/ --workers=3 --reporter=list` (headed, extension fixture):

  | Case | Spec | Result |
  | --- | --- | --- |
  | 1 | installed-project, new-row inverse | ok, 1.1m |
  | 2 | installed-project, failed save vs retry inverse | ok, 1.9m |
  | 3 | job-failed-save | ok, 45.2s |
  | 4 | office shape C | ok, 1.0m |
  | 5 | office shape E | ok, 1.3m |
  | 6 | photo shape G | ok, 1.6m |

  Total: `6 passed (5.4m)`.
  - Office E diagnostic: `{"tests":["yes","yes"],"revisions":[1,2],"looksBefore":[1,1]}`.
  - Photo diagnostic: `{"ending":"proposed","tests":["candidate.trial_reset_required","yes","candidate.trial_reset_required"],"other":"candidate.undo_unproved","unlike":true,"trialAct":"act-4","trialUnlike":true}`.
- Earlier attempts that failed for environmental reasons, not because of the specs:
  - An office run with `--workers=2` ended with case E failing in 0 ms with an empty `Error:`. Run alone (`-g repeating`), it then passed: `1 passed (5.3m)`.
  - Photo, first try: `page.goto: Page crashed` at the very first navigation.
  - Photo, second try: Node `FATAL ERROR ... JavaScript heap out of memory` at about 64 MB of heap. At that point the machine had 846 MB physical and 666 MB virtual memory free, while other agents' Playwright and tsc runs from t726, t728, t729 and t730 were going.
  - Photo, third try: the script ran end to end and failed only on the lower-case `"its control"` assertion, which is now fixed.
- From the repository root, `npx tsc -p apps/extension/tsconfig.test.json --noEmit` exited 0.
- From the repository root, `node scripts/structure-audit.mjs` printed `structure-audit: passed (212 warning(s), 638 baselined).` with exit 0. None of the warnings are in `site-reset`.
- `grep -rn "test\.fail\|test\.fixme\|test\.skip\|\.only(" apps/extension/e2e/site-reset/` found nothing (exit 1).

## Not verified

- I did not repeat the full run to check stability under load. Each case passed once in the final run, and the photo and office E scripts also passed in earlier single-spec runs.
- No Firefox build, no live provider, and no paid calls. Everything ran provider-free with the scripted provider.

## Open questions or contradictions found

1. **The brief says the build "must" put the trial's Like back before it can complete. Core does not enforce that.**
   - A supervisor completion on the latest passing revision is accepted without a reset. Only an honest ending is held for one (`project-agents/supervisor/completion.ts`, `project.completion_reset_first`).
   - I found no reset rule on a builder's completion.
   - So the spec puts the trial act back because the build reset policy (user, 2026-10-12) asks for it, not because completion would otherwise be refused. It brings the gate's view in by testing again.
   - Whether completing should require that reset is a product decision for the supervisor.
2. **The trial act's settle names its control but not its page.** It reads "Its control still shows …", while the explored act's says "Its control at <post page> …".
   - The Unlike on the post's own page was still admitted, at the same control place.
   - If the design expects a trial step's act to carry its page too, Core is not giving it one. The spec accepts either form.
3. **The office E second revision adds a `web.dom.capture_snapshot` step.** That is the minimal behaviour change the product accepts.
   - If the supervisor would rather the second trial come from a different kind of change, only `checkoutFlow(true)` needs editing.
