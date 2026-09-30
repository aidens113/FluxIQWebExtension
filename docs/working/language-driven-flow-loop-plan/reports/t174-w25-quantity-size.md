# t174-w25: quantity and size become their own instructed requirements

## Outcome

Done.

- **What the reader now does.** Core's act reader reads the quantity and the named variants of an item that an act adds or buys. It turns each into its own requirement: kind `set`, linked to its act, with an id like `a2.quantity`, `a2.size` or `a1.colour`.
- **What the check now does.** It wants a separate kept, mutating, proposable step for each requirement, and that step must not be the arrival. The step named for the act's own add press may also answer a requirement only when the step's own input sets it.
- **Run 28.** Its shape is refused, naming `a2.quantity`, `a2.size` and `a3.size`.
- **Tests.** They were written first and failed on the old code. They pass now.
- **Checks.** The structure audit passes. `tsc` prints one error, in a file another worker is editing right now, and none in mine.

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t174/!FluxIQ`. `P` = `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts`.

## What changed and why

### `P/contracts.ts`

- **The act.** `AutomationStudioInstructedAct` gains `requires?: AutomationStudioInstructedChoice[]`. It is present only when non-empty, so every existing assertion on acts still holds.
- **New types.**
  - `AutomationStudioInstructedChoiceKind` is `"quantity" | "variant"`.
  - `AutomationStudioInstructedChoice` has these fields:
    - `id`: `a2.quantity`, `a2.size`, `a1.colour`, `a1.version`.
    - `kind: "set"`.
    - `of`: the act's id.
    - `choice`.
    - `value`: the person's words for the value, e.g. `two` or `12 Double Rolls`.
    - `quote`: the person's words that ask for it, e.g. `two packs` or `in the 12 Double Rolls size`.
- **New reason.** `choice_is_the_act_step`.
- **Missing entries.** `AutomationStudioInstructedActMissing` is now a union of act-missing and choice-missing. The two share `id`, `kind`, `quote`, `reason` and `step`.

### `P/instruction-choices.ts` (new)

It exports `automationStudioInstructedChoices(actId, object)` and `automationStudioInstructedQuantity(value)`. It reads only the act's own object text, which is already bounded to the act's clause or its counted object. It uses closed forms only.

**Quantity.** There are two forms:
- A count of two or more that stands first in the object: `two packs`, `three of the Voltbay`, `3 packs`. Number words run from two to twelve; digits are allowed.
- `quantity of N`.

Some counts are excluded:
- A count of one, whether "one" or "1".
- Any count followed by a measure, a price word, a rating, a time, or a word for different things: `500 g`, `two different`, `two or more`.

Articles, `the three cheapest`, `all three` and thresholds such as `under 50`, `£50` and `4.5 stars` never stand first, so they are never read.

**Variant.** There are four forms:
- `in the <1-4 words> size|colour|count|pack|flavour|scent|style|finish|version|edition|capacity|length|material|pattern`
- `in size <token>`
- `in <0-2 words> <closed colour word>`
- A comma- or colon-separated part of the object that is only a colour, or only `the <words> version|size|…`. This form catches the hub's `: Space Grey, the 7-in-1 version,`.

Other rules for variants:
- Values that name no particular variant are dropped: `same`, `usual`, `my` and the like.
- `size` inside a hyphenated name, as in `Select-A-Size`, is not read. This is load-bearing: without it, run 28 read `a2.size = Paper`.
- There is at most one choice per id word, and at most 4 per act.

### `P/instruction-acts.ts`

- Each act records its object text. That is the rest of its clause, or, for a counted coordinated object, that object and its place.
- After ids are assigned, it attaches `requires` for `add_to` acts, and for `submit` acts whose verb is `buy`, `purchase` or `order`.
- Saving, switching, booking and the other acts get no choices.

### `P/choice-evidence.ts` (new): the domain-neutral test

It exports `automationStudioInstructedChoiceSetBy(step, choice)`. It collects the string values of `step.ranWith` and `step.input`, recursively, to depth 6 and at most 200 values. It reads no keys and no node ids.

- **Quantity.** It is set when some value, folded, is exactly the written count or its digits: `"2"` or `"two"` for `two packs`.
- **Variant.** It is chosen when some value, lowercased with punctuation turned to spaces, contains the value's words as a run: `12 double rolls` in `12-double-rolls`.
- **Numbers.** Non-string numbers are ignored on purpose, because a list index of 2 must not pass for a quantity of two.

### `P/check.ts`

- **The loop.** After the act loop, a loop over every act's choices applies the checks every act gets: `no_step_named`, `no_such_step`, `step_not_kept`, `step_changed_nothing`, `step_only_arrives` and `step_is_optional`.
  - `step_only_arrives` always applies to a choice, because a choice is never an act of opening.
  - The shared checks are now one helper, `whyNot`, so acts and choices cannot drift apart.
- **Sharing a step.** A step already used, whether by an act or by another choice, may answer a choice only if `automationStudioInstructedChoiceSetBy` holds. Otherwise the reason is:
  - `choice_is_the_act_step`, when it is the step accepted for the choice's own act;
  - `step_claimed_twice`, when it is anything else.
- **Order.** Acts are checked first, so existing act verdicts are unchanged. Missing entries are sorted in the order each act and then its choices appear.
- **Naming a choice.** `assign` takes choices:
  - First by id, forgiving about separators: `a2.quantity`, `a2 quantity`, `a2-size`, `a3.color`.
  - Then in words, before any act is named in words. The claim must name what the choice fixes: its id word, `quantity`, `qty`, `amount`, `variant` or `option`, and `color` for a colour. It must not contain the act's verb. Where several choices fix the same thing, the claim must say which one by its value, its act's id, or a word only its act's quote holds.
  - This order is what stops "set quantity to two" being taken by the store switch's kind word `set`.
- **What the model sees.** In `missingActs.acts`, a choice shows `of` and `choice` instead of `verb`.
- **The refusal's instruction.** When any choice is missing, it adds `CHOICE_INSTRUCTION`, in Core's words. The sentence that matters is: "The press that adds does not make it: choose the size or set the quantity with its own step before adding -- press that option, or set the quantity control to the number -- keep that step, and name that step for the choice's id, e.g. {"action": "a2.quantity", "step": "d9"}." It also explains `choice_is_the_act_step`.
- **The order is not enforced.** The check does not require the choice's step to come before the add. The instruction says "before adding", but some sites set quantity in the cart, and enforcing the order would refuse those builds falsely.

### `P/index.ts`

Comment only. The two new files stay out of the barrel on purpose, because the choices travel on the act.

### Tests

**`P/tests/instruction-choices.test.ts` (new, 26 cases).**
- Run 28 yields exactly `a2.quantity`/`two`, `a2.size`/`12 Double Rolls` and `a3.size`/`250 Count`, and `a1` has no `requires`.
- Positive cases: the crossborder hub to cart, the kettles, the hub bought, `in size M`, `in blue`, `3 packs`, and `two kettles under £50` (quantity only).
- 17 negative cases:
  - quantity one, in words and in digits;
  - `a` and `an`;
  - `under 50`, `under £50`, `less than thirty pounds`, `4.5 stars`;
  - `the three cheapest`, `all three`, `two different`, `500 g`;
  - `the same size`, a colour inside a product name;
  - a save and a store switch;
  - a count the verb does not govern.

**`P/tests/check.test.ts`, new describe (7 cases).**
- Run 28's draft and claims are refused with three `no_step_named` choices, and the instruction carries "choose the size or set the quantity with its own step before adding" and "name that step".
- The add presses named for their own choices are refused `choice_is_the_act_step`.
- An arrival named for a choice gets `step_only_arrives`, and the store press gets `step_claimed_twice`.
- Separate steps are accepted.
- Choices named in words are accepted.
- An add step whose input carries `amount: "2"` and `option: "12 Double Rolls"` answers both of its choices; with `"3"` it is refused.
- An instruction with no choices asks for none and says nothing about them.

**Existing fixtures changed.** The new rule applies to their instructions, so these edits follow the rule rather than weaken the old tests.
- **`P/tests/check.test.ts`:**
  - Run 6's "unrelated clicks" count is now acts plus choices. Run 6 has run 28's instruction.
  - "accepts the same clicks once each claim names its act by id" also gives each choice its own step.
  - The three run-15 hub cases ("Put three of…") gain a quantity step `d9` claimed as `a1.quantity`, so each still tests only arrivals.
- **Outside P**, under the brief's fixture exception: `packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/tests/bootstrap-completion.test.ts`.
  - The kettles describe ("Put two … in sage green"):
    - Expected missing lists now include `a1.quantity` and `a1.colour`. They have kind `set` and no verb.
    - The accepted case adds a colour click `d8` and a quantity type `d9`, claimed in words.
  - The run-15 hubs describe: the draft adds a quantity type `d9` claimed as `a1.quantity`.
  - No instruction text was changed.

## Commands run and observed results

All commands ran from `.../!FluxIQ/packages/fluxiq` unless noted.

**Failing first, before any source change.** Command: `npx vitest run --minWorkers=1 --maxWorkers=2 src/.../flow-bootstrap/instructed-acts`.
- It printed "Test Files 2 failed | 1 passed (3) / Tests 12 failed | 108 passed (120)".
- All 12 failures are new cases:
  - 8 extraction cases, for example `expected [ [ 'a1', [] ] ] to deeply equal [ [ 'a1', …(1) ] ]`;
  - 4 check cases: run 28 refused, the act step, arrival or other step, and input evidence.
- The negative cases and the two "accepts" cases passed on the old code, as they should.

**While fixing.**
- After the reader change, the two extraction files gave "85 passed (85)".
- After the check change, P gave "7 failed | 113 passed (120)", and all 7 were the predicted existing fixtures.
- After the P fixture edits, the three directories together gave "Test Files 1 failed | 12 passed (13) / Tests 6 failed | 242 passed (248)". All 6 failures were in `bootstrap-completion.test.ts`.

**Final.**

| Command | Result |
| --- | --- |
| `npx vitest run --minWorkers=1 --maxWorkers=2` on `.../flow-bootstrap/instructed-acts`, `.../flow-bootstrap/reachability` and `.../llm/harness-options` | "Test Files 13 passed (13) / Tests 248 passed (248)", again after the `whyNot` refactor |
| Extra vitest run on `action-permissions/tests/destructive.test.ts`, `llm/decision-context/tests/recorder.test.ts`, `llm/evidence-loop/tests/stall-guard.test.ts`, `provider-refusal/tests/record.test.ts` and `flow-bootstrap/incomplete-draft` | "6 passed (6) / 69 passed (69)". These are the other test files whose instructions mention a cart. |
| `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174 w25" npx tsc --noEmit -p tsconfig.json`, run twice | Printed "[heavy] t174 w25 holds b4", then "holds b1", and exit 2 |
| `node scripts/structure-audit.mjs`, from the Core root | "structure-audit: passed (199 warning(s), 354 baselined)", exit 0 |

**The tsc error.** tsc printed exactly one error: `src/programs/automation-studio/runtime/flow-draft/tests/verify-only.test.ts(65,26): error TS2379 … 'ranWith' … exactOptionalPropertyTypes`. `git status` shows that file untracked, alongside other in-flight edits to `flow-draft/*` and `llm/node-tools/*`. Those are another worker's, not mine. No error names any file I changed.

**The audit.**
- It raised no warning on any instructed-acts file.
- `bootstrap-completion.test.ts` is past the 400-line advisory threshold, at 554 lines. It was already past it before this work, and my edits added 6 lines.
- "1 baseline entries can be lowered" is the same as in w13's run, and not mine.

**Corpus probe.** I ran a scratch script, `t174-w25-corpus.mjs` in my scratchpad and not in the repo, with `node --experimental-strip-types` over the 17 consequential and 10 read-only instructions. Only four instructions yield choices:
- crossborder hub to cart: `a1.quantity=three`, `a1.colour=Space Grey`, `a1.version=7-in-1`;
- bigbox: `a2.quantity=two`, `a2.size=12 Double Rolls`, `a3.size=250 Count`;
- everything-store kettles: `a1.quantity=two`, `a1.colour=sage green`;
- crossborder buy hub: the same three as the hub to cart.

Every other consequential instruction, and every read-only one, yields none.

Sizes: `check.ts` 355 lines, `instruction-acts.ts` 232, `instruction-choices.ts` 127, `choice-evidence.ts` 53, `contracts.ts` 170, `tests/check.test.ts` 316.

## Not verified

- **tsc.** A clean tsc exit, because another worker's untracked `flow-draft/tests/verify-only.test.ts` fails it. My files produce no diagnostics.
- **The model's response.** No live or Lab run, per the brief. Whether the model, given this refusal, presses the size swatch and the quantity control and names them is untested.
- **The full Core suite.** Not run; only the named directories plus the five cart-instruction test files above.
- **Whether the three hub choices are really choosable on the crossborder site.** That is, whether Space Grey and the 7-in-1 version are separate options there. If one is not a real option, the model has no step to name, and the build is refused falsely. The instruction's form suggests they are options, but I did not read the scenario's catalogue. The same caveat applies to the kettles' "sage green".
- **The quantity-evidence test against real web handles.** A string value of exactly `"2"`, such as a handle id written as a bare digit, would pass it. I did not check the domain's handle format.

## Open questions or contradictions found

1. **"Keep the existing 88+ cases green" conflicts with the new rule.** Five existing P cases, and six in `bootstrap-completion.test.ts`, used instructions that ask for a quantity or a size ("Put three of…", run 6/28, the kettles). Under the new rule their Flows are genuinely incomplete. I changed their drafts, claims and expected lists, and never their instructions. Each change is listed above.
2. **Order is not enforced.** The refusal says "before adding", but the check does not refuse a choice step that comes after the add. Enforcing it would refuse builds that set the quantity in the cart. If the supervisor wants order, it is one comparison of `step.position` in the choice loop.
3. **Pressing add twice counts as a quantity step.** A second add press, claimed for `a2.quantity`, passes, since it is a separate kept step. On run 28's site that may well be how quantity two is reached. Core cannot tell it from a quantity control.
4. **One reason per choice.** A choice claimed by a step that is both shared and optional gets `step_is_optional` first, matching the existing one-reason-per-act contract.
