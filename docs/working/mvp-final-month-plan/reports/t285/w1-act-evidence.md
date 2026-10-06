# t285-w1-act-evidence (worker-high)

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t285/!FluxIQ`, branch `task/t285-fix-act-claims`. `R` = `packages/fluxiq/src/programs/automation-studio/runtime`. No commits, and no Lab, browser or provider calls.

## Outcome

Done. Core now uses the claimed step's own record, not the model's label, to decide whether the step does a lasting act (add_to, save, claim, submit, move). My 14 new tests pass. Seventeen tests in `check.test.ts` and `object-binding.test.ts` fail. They failed the same way before any of my source edits, and the cause is the concurrent worker's `instruction-choices.ts` change ("both for pickup" now parses as `a2.fulfilment`/`a3.fulfilment`). See "Open questions".

## What changed and why

- **New `R/flow-bootstrap/instructed-acts/act-evidence.ts`**
  - `automationStudioInstructedActStepDidInstead(act, step, steps)`:
    - Applies only to add_to, save, claim, submit and move acts.
    - The step's words are `words.target`, else `control`. It returns undefined when there are no words, or when the words name the act's verb or a kind word (whole-word test).
    - Otherwise, in this order:
      1. `interruption === true` gives `step_only_clears_the_way`.
      2. `automationStudioFlowDraftStepMovedTarget(step, next)` gives `step_only_arrives`. Here `next` is the step with the lowest position after this one that has `replay.from`.
      3. The words carry the value of one of `act.requires` (variant: folded whole-word run; quantity: folded `words.text` equals the value as written or as digits via `automationStudioInstructedQuantity`). This gives `step_only_chooses` with `chooses`.
    - It never reads `toggle`.
  - `automationStudioInstructedActStepThatNamesIt(act, acts, judged, steps)` looks for a step that:
    - is not `judged`;
    - is kept or taken, has effect mutate, and is proposable;
    - has words that name the act;
    - is named for no other act and no other act's choice (its `acts` entries are checked by id and `id.` prefix);
    - is not bound to another act by `automationStudioInstructedActStepActsOn`;
    - is not caught by DidInstead.

    It returns the first such step after `judged` in draft order, else the first before it, else undefined.
  - `automationStudioInstructedActEvidenceSaid(...)` builds the one sentence that both the checklist and the verdict use. `automationStudioInstructedActIsEvidenceFault` recognises the four faults that sentence covers. The file also has the types `AutomationStudioInstructedActStepInstead` and `AutomationStudioInstructedActEvidenceFault`.
- **`kind-words.ts`**: the whole-word test moved here as the exported `automationStudioInstructedActNamesWord`. `claim-doubt.ts` imports it, and its header now points to act-evidence.
- **`standing.ts`**:
  - In the acts loop, DidInstead runs right after `opensItsChoices`.
  - `Judged` and the fault standing carry `chooses?`, and the fault standing carries `instead?`.
  - After each act settles, `instead` is computed for the four faults (step_only_chooses, step_only_clears_the_way, step_only_arrives, step_only_opens_its_choices).
  - The header paragraph cites mux74k5q, musp4h2f and muqiho5c.
- **`contracts.ts`**:
  - New documented reasons `step_only_chooses` and `step_only_clears_the_way`.
  - The `step_only_arrives` documentation now also covers a press that led to another page.
  - The missing-why type gains `chooses?` and `instead?`.
- **`checklist.ts`**:
  - Exports `AutomationStudioInstructedActEvidenceTodo = "step_only_chooses" | "step_only_clears_the_way"`, separate from the two existing unions. The item todo type is widened to all three unions (local `Todo`).
  - Items carry `chooses`, `instead` and `todoSaid` for the four faults.
  - `claimSaid` is omitted whenever `todoSaid` is present.
  - The header has a new paragraph.
- **`check.ts`**:
  - `missing` and `missingActs.acts` entries carry `chooses`, `instead` and `said` (the same sentence as `todoSaid`).
  - New `CHOOSES_INSTRUCTION` and `CLEARS_INSTRUCTION` are added to `REASON_INSTRUCTIONS`.
  - `ARRIVAL_INSTRUCTION` now says "...or, for a press whose words do not name the act, such as a typed search or a product link, a press that led to another page".
  - The header has a new paragraph.
- **`index.ts`**: `export * from "./act-evidence.ts"`, plus a note on why it is exported.
- **Sentence shape** (`todoSaid` / `said`):
  - Option press: `Step 5 chose "Spain", one of a1's options (a1.origin), and does not do a1.`
  - Quantity: `Step N set "Quantity" to "3", one of a1's options (a1.quantity), ...`
  - Arrival: `Step N ("<words>") went to another page, ...`
  - Interruption: `... only closed something in front of the page, ...`
  - Opens choices: `... only opened the page where aN's choices are made, ...`
  - Then one of two follow-ups:
    - `Step M ("<words>") names it: name aN there with amend_draft add on step M with act aN.`
    - `No step in the draft names it yet: on the page where aN is done, after its choices, run the press whose words name it with add true and act aN.` The phrase "after its choices, " is left out when the act has no choices.
- **Tests**:
  - New `instructed-acts/tests/act-evidence.test.ts` has 14 tests:
    - Spain with acts [a1, a1.origin]: a1 is todo step_only_chooses with chooses a1.origin, a1.origin is done, there is no claimSaid, and notDone lists a1.
    - A later taken "Add to cart" sets instead 7, and the sentence names it.
    - The verdict entry has chooses, instead and `said`, and the said equals `todoSaid`. The instruction carries the step_only_chooses sentence, and `checkAutomationStudioInstructedActsOptionalOnly` stays ok.
    - A typed quantity "3" is chosen as a1.quantity.
    - A typed search that moved is step_only_arrives, and the instruction carries the new arrival wording.
    - A product link that moved is step_only_arrives with instead 5.
    - "Not now" with interruption is step_only_clears_the_way, and the instruction carries the sentence.
    - Negatives: an "Add to cart" that moved, a "♡" toggle pressed in place for a save, a step with no words, a set act on "Spain", and an interruption whose words name the act.
    - StepThatNamesIt: first after else first before; never a dropped step, a read, or a step named for another act; allowed when named for the act's own choice.
  - `choice-order.test.ts`: "Pickup" is changed to "Buy box", as the brief asked. The musq0b1m expectation now checks `todoSaid` ("Step 6", "only opened the page where a1's choices are made") and that `claimSaid` is absent.

## Commands run and observed results

All vitest runs were from `packages/fluxiq`.

1. **Fail-first** (new test written, no source changed): `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/tests`
   - Result: `Test Files 3 failed | 6 passed (9)`, `Tests 28 failed | 282 passed (310)`.
   - 11 of the failures are my new act-evidence tests (the functions are not exported yet, and the behaviour is absent: e.g. a1 is done instead of step_only_chooses).
   - The other 17 are in check.test.ts (7) and object-binding.test.ts (10). They were already failing because of the concurrent `instruction-choices.ts` edit (`a2.fulfilment` / `a3.fulfilment` appear in the received values).
2. **After the fix, first run**:
   - The `kind-words.ts` append through a shell heredoc lost its regex backslashes, giving an esbuild "Unterminated regular expression" error. I fixed it with Edit.
   - My test "names the later press..." then got `instead: 6` instead of 7. The distractor "Wishlist share" contains the add_to kind word "wishlist", so the code was right and the test was wrong; I changed the distractor to "Share".
   - The choice-order "Pickup" and musq0b1m flips were applied as the brief asked.
3. **Final, instructed-acts tests, run twice**: `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/tests`
   - Both runs: `Test Files 2 failed | 7 passed (9)`, `Tests 17 failed | 293 passed (310)`.
   - The 17 have exactly the same names as the 17 non-mine failures in the fail-first run.
   - Every one uses the PICKUP instruction ("... to my cart, both for pickup."). They show extra `a2.fulfilment`/`a3.fulfilment` entries (e.g. `expected [ [ 'a2.fulfilment', …(1) ], …(1) ] to deeply equal []`), or `ok` false because those choices have no step.
   - act-evidence (14), choice-order (12) and claim-doubt pass.
4. **Wide sweep, once**: `npx vitest run R/flow-bootstrap/*/tests R/flow-bootstrap/tests R/llm/harness-options/tests R/llm/evidence-progress/tests R/llm/tests R/result-verification/build-test/tests R/result-verification/tests R/tests/service-bootstrap/tests` (JSON reporter)
   - Result: `total 2362 failed 18`.
   - 17 are the same fulfilment failures above.
   - 1 is `R/tests/service-bootstrap/tests/adaptation.test.ts` "bridges a generated proposal ID through the standard Adaptation Audit get, approve, and apply endpoints": `Test timed out in 15000ms`. Rerun alone it gave `Tests 9 passed (9)`; the slowest test took 5.2s. That file does not reference instructed acts, so the timeout was load during the large parallel run.
   - No other test anywhere in the sweep failed. That includes `llm/evidence-progress` (stall-redirect reads `todo`/`step`), `unfinished-build` (not-done.ts) and `llm/harness-options` (draft-acts).
5. **Core root**: `node scripts/build-cache/cli.mjs fluxiq:check` exited 0. It printed `{"build-cache":"build","step":"fluxiq:check","reason":"no stamp; ...","ms":78825,...}`, so tsc ran and was not cached.
6. **Core root**: `node scripts/build-cache/cli.mjs structure-audit:check` exited 0 with `structure-audit: passed (265 warning(s), 349 baselined).` Relevant advisory warnings, none of them failures:
   - instructed-acts/ has 20 source files (past the 15-file advisory; the limit is 25);
   - check.ts is 491 lines (advisory 400, limit 800).

## Not verified

- No live run, Lab or browser test (none was allowed). Whether the model acts on `todoSaid`/`said` is not shown.
- The 17 fulfilment-affected tests could not be judged against my change in isolation without reverting the other worker's files. The identical before-and-after failure set is the evidence.
- I did not read or change `unfinished-build/not-done.ts`. It types `TODO_WORDS` over the two older unions and falls back to "nothing I tried did it" for the new todos, as the brief describes; it still compiles and its tests pass.

## Open questions or contradictions found

- **Tests the concurrent instruction-choices change flips (in files I own, deliberately not edited).** Old expectation: the PICKUP instruction yields only quantity/size choices. New behaviour: it also yields `a2.fulfilment` and `a3.fulfilment` ("pickup"), which no step in these drafts names. The other worker, or the supervisor at integration, should update them.
  - `R/flow-bootstrap/instructed-acts/tests/check.test.ts` (7):
    - "refuses run 28's Flow, naming the quantity and both sizes no step chooses"
    - "refuses the add press named for its own quantity and size"
    - "refuses the arrival, or a step claimed for another act, named for a choice"
    - "accepts a Flow that chooses each size and sets the quantity with steps of its own"
    - "accepts choices named in words rather than by id"
    - "lets the add step answer a choice only where its own input sets it"
    - "accepts Place order, declared move_money, as the order, with the size chosen by a step of its own"
  - `R/flow-bootstrap/instructed-acts/tests/object-binding.test.ts` (10):
    - "refuses run 40's completion ..."
    - "accepts the napkins claimed on the napkins' own Add to cart ..."
    - "refuses a size claimed on the other product's swatch ..."
    - "accepts as before a step whose record names no object at all"
    - "refuses two packs claimed on the add repeated over a list"
    - "refuses one press of the stepper claimed under a repeat"
    - "accepts a quantity stepper pressed to two, or a quantity field set to 2"
    - "accepts exactly two kept presses of that add on that product, claimed on either"
    - "refuses presses of the add that are not the count, and counts them"
    - "does not count the same add on another product as a press of this one"
- **Interaction once fulfilment lands.** With "pickup" a choice value of a2, a press whose words are "Pickup" claimed for a2 becomes `step_only_chooses` (chooses `a2.fulfilment`). That is why choice-order's control had to move to "Buy box", and it is the intended behaviour.
- **Kind words are broad.** add_to's kind words include "wishlist", "watchlist", "cart" and "basket". So a press like "Wishlist share" or "View cart" counts as naming a cart act and is never caught, and it can also be offered as `instead`. This is lenient by design (brief: words naming a kind word give undefined), but it is a known gap.
- **Choices I made where the brief was ambiguous.**
  - "First before" is read as the first in draft order.
  - `next` is the lowest-positioned later step with `replay.from`; claim-doubt takes the first in array order, which is the same for a sorted draft.
  - `todoSaid` and `said` are also given for a `step_only_arrives` that comes from a start-location arrival in `step-fault.ts`, as "Step N went to another page".
