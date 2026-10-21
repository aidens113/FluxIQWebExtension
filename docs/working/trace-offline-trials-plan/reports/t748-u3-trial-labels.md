# t748-u3-trial-labels: worker report

## Outcome

Partial.

- **Defect 1 (a read step labelled with its old words): fixed.** It is fixed in `R/service/candidate-trial/`, with tests that fail on HEAD and pass now.
- **Defect 2 (a press that reloads the page loses its control's name): cause found, not fixed.**
  - The reload has nothing to do with it. Core's model-facing screen refuses the word "address", and the control's own words are "Deliver to this address", so the screen drops them.
  - That screen is in `R/llm/model-facing/`, which the brief says I must not touch. So I stopped, as the brief says. The file and the change are below.
  - I added the spec assertion for (2) as the brief asks. It will fail until the `llm/model-facing` change lands.

`R` = `C:/Users/osrs_/FluxStuff/fxwork/t748/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`, `D` = `C:/Users/osrs_/FluxStuff/fxwork/t748/!FluxIQWebExtension/`.

## Causes

### 1. A read step's label is its saved words

- **Where:** `R/service/candidate-trial/feedback.ts:370` (HEAD) sets `const control = automationStudioModelFacingControlWords(node?.parameterValues)`. Line 420 does the same for a learned pace, and `R/service/candidate-trial/landed-acts.ts:134` does the same for the act words.
- **What goes wrong:** these lines name every step by the words of the identity the domain resolved at submission (`parameterValues.element`).
  - For a target marked `readsWords: true` (t743), those words are the value as it was captured. That is before an earlier step in the Flow changed it.
  - So the step that read the new value was labelled with the old one.
  - Nothing in Core read the `readsWords` mark: `grep readsWords` over Core `src` found no hits.

### 2. The confirm press has no `control` and no `on "..."`

- **Where:** `R/llm/model-facing/sayable-text.ts:18`, called from `R/llm/model-facing/control-words.ts:55`.
- **The rule:** `FINDING_WORDS = /\b(?:selectors?|fingerprint(?:s|ed)?|address(?:es|ed|ing)?|re-?address\w*|scor(?:e|es|ed|ing))\b/iu`. Any control whose own words contain "address" is "no words", so `control` is left out of both the feedback step and the landed act. The ledger's act words (`flow-bootstrap/site-reset/ledger.ts:463`) leave out `on "..."` when `act.control` is absent.
- **Probe:** I ran `automationStudioModelFacingControlWords({ element: { accessibleName: w, visibleText: w } })` under `node --experimental-strip-types`:
  - `"Deliver to this address"` gave `null`
  - `"Use this address"` gave `null`
  - `"Change"` gave `"Change"`
  - `"Borrow this book"` gave `"Borrow this book"`
- **Why the reload is not the cause:** the fixture's button is literally `Deliver to this address` (scenario-lab `everything-store/pages/checkout.ts:45`). The label is read from the graph node's parameters, never from the attempt or the page, so a reload cannot affect it. The domain's node-run result is not involved either, and I made no edit under `D/domain/src/runtime/llm-evidence/node-run/**`.
- **Same defect elsewhere:** the read-after-change spec's confirm step loses its name the same way.

**Proposed change (not made; `R/llm/**` is outside my Owns):**

- In `control-words.ts`, screen a control's own words with only the locator-shape and match-score checks. Do not apply the finding-word list to them.
  - These words come from the page's own accessible name, text, label and placeholder.
  - The user's rule (2026-10-10, quoted in that file's header) is that naming a control by its own words is fine.
  - Words like "address" or "score" are ordinary page words on a button.
- Keep `automationStudioModelFacingSayableText` unchanged for failure `expected`/`actual` text. `failure-text.test.ts:27` asserts that "address" is dropped there, and that is right.
- One way to do it:
  - Export the locator and score part as its own one-function file, e.g. `llm/model-facing/control-text.ts`, `automationStudioModelFacingControlText(text) = text.trim() !== "" && !automationStudioLocatorShapedText(text) && !MATCH_SCORE.test(text)`. `MATCH_SCORE` moves there, and `sayable-text.ts` imports it.
  - Use it at `control-words.ts:55`.
- Proposed test in `llm/model-facing/tests/control-words.test.ts`, on a library site:
  - `{ element: { accessibleName: "Send to this address" } }` returns `"Send to this address"`.
  - `{ element: { accessibleName: "#send > button" } }` still returns `undefined`.
- **Who else changes:** every other caller of `automationStudioModelFacingControlWords` would also start naming such controls. That is `executor/step-skip/act-not-done.ts`, `flow-bootstrap/instructed-acts/claim-doubt.ts`, `flow-bootstrap/instructed-acts/optional-act-steps.ts`, `flow-bootstrap/script-statements/way-out-steps.ts` and `recovery/refuted-result/step-failure-brief.ts`. Their tests should be run with the change.
- Once it lands, `step-control.ts` picks it up with no change, because it calls `automationStudioModelFacingControlWords`.

## What changed and why

Core (`R/service/candidate-trial/`):

- **New `step-control.ts`:** `automationStudioTrialStepControl(node, attempt)`. It is now the one place that decides the words a trial step's control is named by. The feedback and the landed acts both use it, so they say the same thing.
  - A node whose resolved `element` carries `readsWords: true` is named by the words it read in this trial:
    - the step's `outputs.value` (Core's single-value port, where a read's answer lands through its `resultPath`);
    - only when the attempt succeeded and the value is a string that is not withheld;
    - whitespace collapsed, passing the same model-facing screen, and at most 160 characters.
  - Otherwise it is named by nothing, never by the saved words. That covers a failed read, a text check that hands nothing on, no attempt (a learned pace), and a withheld, too long or unsayable value.
  - Every other node is named exactly as before, by `automationStudioModelFacingControlWords`.
- **`feedback.ts`:**
  - steps and paces call `automationStudioTrialStepControl`;
  - its import of `automationStudioModelFacingControlWords` is gone;
  - one header sentence was added, and a stray blank line inside the header was removed. The file went from 427 to 428 lines.
- **`landed-acts.ts`:** the act's `control` comes from `automationStudioTrialStepControl(node, attempt)`. The header now names the new owner.
- **`index.ts`:** exports `./step-control.ts`.
- **Tests:**
  - `tests/feedback.test.ts` gains a t748 block on a library site:
    - a read is named by what it read, and the saved words appear nowhere;
    - a failed read and its learned pace are named by nothing;
    - direct cases of `automationStudioTrialStepControl`: a number, a withheld value, too long, locator-shaped, no attempt, a step not marked `readsWords`, and a press.
  - `tests/landed-acts.test.ts` gains one case: a read step's act is named by what it read, the same as its feedback step.
- **Test placement:**
  - The direct cases sit in `feedback.test.ts`, not in `tests/step-control.test.ts`, because `candidate-trial/tests/` is at the 25-file limit. My first version added a 26th file, and the audit failed it (`directory-files`).
  - A `candidate-trial/step-control/` subfolder failed the audit's 9-segment depth limit (`naming`).
  - A comment in the test says why.

Downstream specs (assertions only; not run, per the brief):

- **`D/apps/extension/e2e/site-reset/tests/office-read-after-change.spec.ts`:** the read step's `control` is `chosenWords`, not `originalWords`. With the Core change this should pass once Core is rebuilt. It assumes the fixture's address line passes the screen: no locator shape, no match score, and not the word "address".
- **`D/apps/extension/e2e/site-reset/tests/office-address-confirm.spec.ts`:**
  - the confirm step's `control` is `"Deliver to this address"`;
  - the confirm act's `did` contains `on "Deliver to this address"`.
  - **Both will fail until the proposed `llm/model-facing` change lands.**

## Commands run and observed results

- **HEAD failure of the new tests:** I copied the HEAD `feedback.ts` and `landed-acts.ts` (`git show HEAD:...`) to `scratchpad/t748/u3-head/`, swapped them in, and ran `pnpm exec vitest run .../candidate-trial/tests/feedback.test.ts .../tests/landed-acts.test.ts`.
  - Result: `Tests 3 failed | 45 passed (48)`. The failures were the two t748 feedback cases and the landed-acts case, all assertion failures. The direct-cases test did not exist yet at that point.
  - My files were restored afterwards, and `git diff --stat` showed my edits intact.
  - Separately, the first version of the tests run against HEAD `feedback.ts`/`landed-acts.ts` showed 4 failed and 1 passed (the "every other control" regression guard).
- **Folder:** `cd <Core>/packages/fluxiq && pnpm exec vitest run src/programs/automation-studio/runtime/service/candidate-trial` gave `Test Files 25 passed (25)`, `Tests 208 passed (208)`.
- **Prompt contract tests:** `pnpm exec vitest run .../llm/deepseek/tests/system-prompt.test.ts .../flow-bootstrap/plan/tests/extraction-vocabulary.test.ts .../flow-bootstrap/plan/tests/issue-feedback*.test.ts` gave `Test Files 5 passed (5)`, `Tests 70 passed (70)`. This run was before the tests moved into `feedback.test.ts`; the product code is the same.
- **Core audit:** `node scripts/structure-audit.mjs` at Core root gave `structure-audit: passed (435 warning(s), 1152 baselined)`, exit 0. For my files there are warnings only:
  - `candidate-trial/` has 22 source files (advisory threshold 15);
  - `tests/` has 25 files;
  - `feedback.ts` is 428 lines and `feedback.test.ts` 428 lines (advisory threshold 400).
- **Core typecheck (extra):** `npx tsc --noEmit -p tsconfig.json` in `packages/fluxiq` exited 2 with 2 errors, both in other workers' files: `flow-bootstrap/reset-settlement/judge.ts(218,5)` and `llm/harness/tests/run-size.test.ts(238,40)`. There were none in `candidate-trial`.
- **Extension spec typing:** `cd D/apps/extension && node scripts/check-extension.mjs` exited 0 with no output. `tsconfig.test.json` includes `e2e/**/*.ts`.

## Not verified

- **Browser specs not run** (barred; Core must be rebuilt first). The office-read-after-change assertion depends on the trial's saved trace carrying `outputs.value` for the extract. I believe it does: `result-path-outputs.ts` copies `result.extracted` there, and the withholding only replaces values resolved out of state. But I did not see it on a live trial.
- **The address-confirm assertions** will fail until the `llm/model-facing` change is made.
- **The domain's node-run tests and tsc** were not run, because I made no domain edit.
- **Consumers of `automationStudioModelFacingControlWords` outside `candidate-trial`** were not run, because their code did not change. `subflow-trial/run.ts` and `project-build/entry-preparation.ts` read their acts through `automationStudioCandidateTrialLandedActs`, and their folders were not run.

## Open questions or contradictions found

1. **The brief's hypothesis for (2), that the reload loses the label, is wrong.** The cause is the finding-word screen on the word "address" (above). The fix belongs to whoever owns `R/llm/**`. The same screen also hides any control whose words include "score", "selector" or "fingerprint".
2. **Core now reads the downstream field `element.readsWords`, the t743 mark.** It is a cross-repository contract: Core's element fingerprint type (`model/action-element-target.ts`) does not declare it. The lead may want it declared in Core or written into the contract docs.
3. **Proposed doc text** for `docs/architecture/` (trial feedback section), not written by me: "A trial step names its control by the words the domain resolved at submission, except where the target's words are the value the step reads (`readsWords`): such a step is named by the words it read in that trial (`outputs.value`), or by nothing when it read none, never by the words captured before an earlier step changed them (Core `service/candidate-trial/step-control.ts`, t748)."
