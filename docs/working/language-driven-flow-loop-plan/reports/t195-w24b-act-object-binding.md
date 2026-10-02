# t195-w24b: the completion check judges a claim against what its step did

## Outcome

Done. The instructed-acts check now ties each claim to what its step acted on, and it checks quantity against what the step set. Run 40's accepted completion is now refused on both counts. Each refusal names both objects in the person's words and says which act the step does instead.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/` in Core worktree `fxwork/t195/!FluxIQ`, branch `task/t195-live-control-flow`.

- **`act-object.ts` (new).** Reads an act's object from its own quote: "ValueRidge Everyday Dinner Napkins". It strips the following:
  - the verb, and a second verb joined to it ("Collect and use");
  - the variant quotes ("in the 250 Count size");
  - the destination ("to my cart");
  - relative clauses ("that is already ...") and seller descriptors ("sold by ...");
  - the opening count ("one pack of the").

  It keeps the quantity quote, because it holds the first word of the thing counted ("two Tidewell"); the opening count is cut instead. Words are compared in a folded form: lowercased, plurals folded, generic words removed. An `open` act has no object, because it names a place whose page shows the other acts' objects.
- **`object-binding.ts` (new).** `automationStudioInstructedActStepActsOn` reads only the string values the step already carries, in three sources, nearest first:
  1. the step itself: `ranWith`, `input` and `replay.produced`. These hold the target's name and text, the row's `context.record`, the option chosen and the text typed.
  2. the page it acted on: `replay.from`.
  3. the page it left: the next draft step's `replay.from`, used only when that step's iteration is no earlier.

  Rules:
  - The first source that names an object decides.
  - If that source contains any of the act's own words, the step is bound.
  - It is refused only when that source contains none of the act's own words and at least two of another act's own words.
  - "Own" words are those no other act's object shares.
  - A source with no object words gives no verdict, and the next source is tried; a step none of whose sources name an object is accepted.

  `automationStudioInstructedActsOnSaid` builds the refusal sentence. Example: "For a3, step 29 acts on ValueRidge Essentials Select-A-Size Paper Towels, which a2 asks for, not on ValueRidge Everyday Dinner Napkins: name step 29 for a2 if it does that, and name a3 on a step that acts on ValueRidge Everyday Dinner Napkins, …". It never quotes the step's record, which can hold selectors that a domain never shows the model.
- **`quantity-fault.ts` (new).** It does not apply to plural acts. Otherwise:
  - A step inside any repeat span is refused `quantity_is_a_repeat`.
  - A step whose input carries the number counts as setting the quantity, as before (`choice-evidence.ts`).
  - Claiming another press of the act's own add counts the presses. A "same press" means the same `actionId`, an identical non-empty `ranWith` (or `input`), and the same `replay.from`. The presses must be kept, proposed, not optional and not repeated.
    - Exactly the count is accepted, even when the claim names the act's own step.
    - Any other count is refused `quantity_presses_differ`, with `presses` listing them.
  - A stepper press with no number in its record is accepted as before, because the draft cannot tell it from any other press.
- **`contracts.ts`.** Adds three reasons: `step_acts_on_another_object`, `quantity_is_a_repeat` and `quantity_presses_differ`. The missing-entry type gains `actsOn?` and `presses?`.
- **`standing.ts`.** The shared loop now applies the binding after `step-fault.ts` and before `step_claimed_twice`, for both acts and choices; a choice is bound through its act's object. It then applies the quantity rule. The standing record carries `actsOn` and `presses`. The F35 rule, which tries every step named for an act, is kept.
- **`check.ts`.** Each missing entry carries `actsOn` and `presses` into `missingActs`. The refusal adds one binding sentence per refused act and the two quantity sentences. It is 398 lines, under the 400-line advisory: the sentences were moved into their own modules.
- **`checklist.ts`.** A new type, `AutomationStudioInstructedActObjectTodo`, holds the three new reasons. Checklist items gain `actsOn` and `presses`. `AutomationStudioInstructedActTodo` is unchanged, because `unfinished-build/not-done.ts`, which I do not own, keys a `Record` on it.
- **`step-fault.ts` and `index.ts`.** Comments only, plus the Exclude list in `step-fault.ts`. The new modules are internal and not added to the barrel.
- **`tests/object-binding.test.ts` (new, 35 cases).** Built from the instruction and from steps shaped as run 40's: a web `ranWith` with the element identity, and `replay.from` locations.
  - Run 40's exact completion is refused: a3 on step 26 (`step_acts_on_another_object`, actsOn a2) and a2.quantity on the repeated step 28 (`quantity_is_a_repeat`).
  - Napkins claimed on the towels' Add to cart is refused, naming both objects and nothing from the record. The same appears on the checklist.
  - Napkins claimed on the napkins' Add to cart is accepted, as is the whole honest Flow.
  - A size claimed on the other product's swatch is refused.
  - A step with no record is accepted.
  - For quantity: a repeat is refused, and so is a stepper under a repeat. A stepper or a quantity field set to 2 is accepted. Two kept presses are accepted whichever of them is claimed. Three presses are refused with `presses: [29,30,31]`. The same add on another product does not count.
  - Sweep: 19 consequential instructions from the ten sites. An honest Flow passes for each (one step per act and choice on its object's page, consequence declared, repeat where plural). Swapped claims are refused: pickup cart a2↔a3, kettle move on the add, and hub coupon on the add.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build src/programs/automation-studio/runtime/llm/harness-options` (in `packages/fluxiq`):
  - Before the change: 18 files, 328 tests passed.
  - Final: `Test Files 19 passed (19)`, `Tests 363 passed (363)`.
  - Midway, 2 existing tests failed. The cause was that steps with an empty `input` counted as "the same press". The fix requires the argument to contain a string; both tests now pass.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195-w24b tsc" npx tsc --noEmit -p tsconfig.json`: printed only `[heavy] t195-w24b tsc holds b1`, exit 0.
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (210 warning(s), 349 baselined)`. That is the same warning count as before the change. The one `instructed-acts` warning is the existing one on `tests/check.test.ts` (491 lines). The note "1 baseline entries can be lowered" was already there before the change.
- Revert check: I put `check.ts`, `checklist.ts`, `contracts.ts`, `standing.ts`, `step-fault.ts` and `index.ts` back to HEAD, kept `act-object.ts` so the test file imports, and ran the new file with the JSON reporter. Result: 12 failed, 23 passed.
  - Failed: every refusal case, the checklist case, and "two kept presses … claimed on either" (new acceptance).
  - Passed: the reader pin, the honest-Flow acceptances, the stepper/field acceptance and the 19 sweep acceptances. These are regression pins and pass either way.
  - I then restored my changes and re-ran all three checks, with the results above.

## Not verified

- No live run, Lab or browser was used, as the brief says. Whether a real web step's `ranWith` and `replay.from` carry what the tests assume is inferred, not observed: I read the domain's `node-run/run.ts`, `plan-resolution/element-identity.ts` and `node-run/replay.ts`, and the element identities stored in run 40's Flow source. Run 40's raw draft steps are not stored in its artifacts.
- Step 26's identity in run 40 is inferred from the Flow's node order: type (25), Search press (26), towels link (27), swatch (28), add (29). The debug calls step 26 "a towels click". If it was the Search press, its own record names nothing, and it is refused only through source 3, the page it led to.
- When a model moves steps, the "next step" used for source 3 may not be the one that ran next. It is guarded by the iteration order but not proven.

## Open questions or contradictions found

1. **The brief says to read only what the step's record carries; source 3 goes beyond that.** The page the step left is read from the next draft step's `replay.from`. Without it, run 40's actual claim (a3 on the Search press) still passes, because that press's own record and its page name nothing. It is consulted only when sources 1 and 2 name no object. To veto it, delete the `left` source in `object-binding.ts` `sources()`. By my reading of the tests (I did not run this), only one new case depends on it: "refuses run 40's completion", where a3 would no longer be refused.
2. **`unfinished-build/not-done.ts` (not mine) has no wording for the three new reasons.** Its `TODO_WORDS` falls back to "nothing I tried did it". Suggested clauses:
   - `step_acts_on_another_object`: "the step I tried for it acts on something else you asked for";
   - `quantity_is_a_repeat`: "I repeated the add instead of setting how many";
   - `quantity_presses_differ`: "I pressed add a different number of times than you asked".

   Adding them to `AutomationStudioInstructedActTodo` would need that file changed in the same commit, so I kept them in a separate type.
3. **The corpus in `instruction-acts.test.ts` is out of date with the downstream `live-tasks.ts`.** The friend-requests confirm and the everything-store narrow are worded differently downstream. The downstream job-board apply interpolates the candidate's details. New read-only tasks exist downstream: everything-store earbuds, job-board Rust UK, photo-social giveaway, social open-day edit, and company prices. My sweep uses the current downstream wording for the consequential ones. I did not change that corpus, because it is the act reader's own pin.
