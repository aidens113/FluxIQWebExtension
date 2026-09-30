# t174-w13: plural acts need a repeat, optional steps answer no act, consequence-bound claims assessed

## Outcome

Partial, by design. Items 1 and 2 are done. For item 3 there is an assessment and no implementation: the rule the brief offers is not sound on the signals Core has, and the reasons are given below.

- **Plural acts.** Core's instructed-acts check refuses a single-shot claim for an act that is asked for every member of a set, with the new reason `act_needs_repeat`.
- **Optional steps.** It refuses a claim that names an `optional` step, with the new reason `step_is_optional`.
- Tests were written first and failed on the old code; they pass now.
- `tsc` and the structure audit pass.

## What changed and why

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t174/!FluxIQ`. `P` = `packages/fluxiq/src/programs/automation-studio/runtime`. The work builds on t174-w11's uncommitted edits in the same files.

### `P/flow-bootstrap/instructed-acts/contracts.ts`

- `AutomationStudioInstructedAct` gains the optional `plural?: true`. It is present only on an act that is asked for every member of a set, so every existing `toEqual` on acts still holds.
- `AutomationStudioInstructedActMissingReason` gains two reasons, each with a doc comment:
  - `"step_is_optional"`
  - `"act_needs_repeat"`

### `P/flow-bootstrap/instructed-acts/instruction-acts.ts`

**The `EVERY` rule.** An act is plural when its kind is one of `save`, `add_to`, `claim`, `move` or `submit`, and a closed quantifier stands within the first four words after the verb. The quantifiers are `every`, `everyone`, `everybody`, `everything`, `all` and `each`.

Some uses are excluded:
- **After a price.** The word before the quantifier holds a digit or a currency sign: "at $30 each".
- **Before a count.** "all three kettles", which separate steps may do.
- **Inside a hyphenated name.** "All-Purpose".

`open` and `set` are never plural. Opening a place shows all of it, and "sort all results" is one setting.

**The four-word window.** The window is the rule that separates the act's own object from a later qualifier. It is four words, not three, because the auction task says "add to my watchlist every auction".

**Other changes.** The header comment records the rule and run 2. The flag carries through the coordinated-object split and the final id mapping.

**Corpus result.** Of the 17 consequential corpus instructions, exactly four acts are marked, and all four are genuinely per-item:
- job-board "Save every job"
- auction "add to my watchlist every auction"
- social "confirm everyone"
- professional "withdraw every connection request"

No other act in the corpus is marked. The 10 read-only instructions still yield no acts.

### `P/flow-bootstrap/instructed-acts/check.ts`

**Two new branches.** They sit after `step_only_arrives` and before `step_claimed_twice`:
- `step.routing?.kind === "optional"` gives `step_is_optional`.
- `act.plural && !repeated(step, steps)` gives `act_needs_repeat`.

**The `repeated` helper.** A step counts as repeated in two cases:
- It carries `routing.kind === "repeat"`.
- Its position lies between a kept, proposed step carrying `repeat` and that repeat's `through` step, inclusive. The `through` step is found with `automationStudioFlowDraftStepById`.

A repeat on a dropped step counts for nothing.

**Refusal instructions.** These are now assembled from a reason-to-sentence table. The plain `INSTRUCTION` is unchanged, and each extra sentence is added only when its reason occurs:
- `step_only_arrives` keeps its existing sentence.
- `step_is_optional`: "...make it always run with amend_draft keep on that step, or name a step that always runs." `keep` is the amendment that clears routing: `flow-draft/amendment.ts:171-183`.
- `act_needs_repeat`: "...run the step that lists the items (keeping only those to act on), act on one item, then amend_draft repeat over the listing step through the act's last step, and name the repeated step for the act." This matches t195's F2 wording in `DRAFT_INSTRUCTION_BRIEF` in t195's `flow-draft/entry.ts`.

**Other changes.**
- `missingActs.acts[]` carries `plural: true` on a plural act.
- The header comment records run 2 (`run-munnop9n-5475d593`).
- No node ids are named anywhere.

### Tests

**`instructed-acts/tests/instruction-acts.test.ts`**, new `describe`:
- Each of the 17 corpus instructions marks exactly the expected plural acts. Non-plural acts have no `plural` property.
- Six positive phrasings are marked plural.
- Six negatives are not: a price with "each", "all three", "All-Purpose", a late quantifier, an open act, and a sort.

I confirmed that the price and count exclusions are load-bearing. Without them, the regex matches " at $30 each." and " all three kettles".

**`instructed-acts/tests/check.test.ts`**, new `describe` with 7 cases:
- Run 2's single Confirm is refused `act_needs_repeat`, with the repeat instruction and `"plural":true`.
- A Confirm carrying `repeat` is accepted.
- A step inside a repeat span is accepted, and a step after the span is refused.
- A repeat on a withdrawn step does not count.
- Run 2's optional Confirm is refused `step_is_optional`, with the `amend_draft keep` sentence.
- An optional step is refused for a non-plural act.
- An `only_if` step still answers a non-plural act, and the plain refusal carries neither new sentence.

## Commands run and observed results

All commands ran from `C:/Users/osrs_/FluxStuff/fxwork/t174/!FluxIQ/packages/fluxiq` unless noted.

**Failing first, before the fix.** `npx vitest run --minWorkers=1 --maxWorkers=2 src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts` gave "Test Files 2 failed (2) / Tests 10 failed | 78 passed (88)". Every failure was a new case:
- The four corpus plural cases failed with `expected [] to deeply equal ['save']` and similar.
- The positive phrasings failed with `expected [ undefined ] to deeply equal [ true ]`.
- In check.test.ts, "refuses one press that acts once" failed with `expected [['submit', undefined]] to deeply equal [['submit', true]]`, and four others with `expected true to be false`.
- The negative and unchanged-behaviour cases passed before the fix, as they should.

**After the fix.**

| Command | Result |
| --- | --- |
| `vitest` on the same directory | 2 files passed, 88 tests passed |
| `vitest` on `.../flow-bootstrap/reachability` | 3 files passed, 27 tests passed |
| `vitest` on `.../llm/harness-options` | 6 files passed, 96 tests passed |
| `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174 w13" npx tsc --noEmit -p tsconfig.json` | printed "[heavy] t174 w13 holds b2" and exited 0 with no diagnostics |
| `node scripts/structure-audit.mjs`, from the Core root | printed "structure-audit: passed (194 warning(s), 354 baselined)" and exited 0 |

The structure audit raised no warnings on instructed-acts files. It also printed "1 baseline entries can be lowered", the same as in w11's run; that is not mine, and I did not run `pnpm structure:baseline`.

Resulting sizes: `check.ts` 261 lines, `instruction-acts.ts` 219, `contracts.ts` 122; both test files are under 250.

## Item 3 assessed, not implemented: "a lasting act must be claimed by a step whose declared consequences include it"

**Why it is not sound on what Core has:**

1. **Where the signal lives.** Declared consequences are not on draft steps. They are the model's own per-plan-step statements (`step.declared`, read by `automationStudioPlanStepConsequences` and passed as `declaredConsequences` in `llm/harness-options/plan-parameter-resolution.ts:157`). The check receives draft steps from `bootstrap-completion.ts:297`, which I do not own.
2. **It would not have caught cause 3.** In run 16 the chooser-opening click `s2` declared `modify_existing`. The store-switch act (`set`) maps to `modify_existing`, so `s2` passes the rule. The real defect, a click that opens the chooser standing in for the pick, is invisible to it.
3. **It would refuse for the wrong reason.** Run 16's add-to-cart presses `s5` and `s7` also declared `modify_existing`, while Core's instructed reading said `create_new`. Whether adding to a cart is `create_new` or `modify_existing` is genuinely ambiguous. So the rule would refuse an honest declaration and send the model to relabel a step, not to do the act.
4. **It checks a label, not the act.** The declaration is the model's own claim. A model that relabels `s2` as whatever is wanted passes, with the Flow unchanged. This check only works where it tests something the model cannot satisfy by renaming: step existence, kept, effect, routing.
5. **Other state is no better.** `stateBefore`/`stateAfter` digests change for a chooser opening as much as for a pick, so they cannot tell the two apart either.

**Signals that would make it decidable, domain-neutrally:**

- **(a) Recommended: a closed per-step change class from the domain.**
  - The class would be either transient (opened or closed a layer, a menu, a chooser, or moved the view) or lasting (changed a record the site keeps).
  - The domain would report it on the draft step, the way it now reports `effect` and `effectApplied`.
  - Core would then refuse any non-`open` act claimed by a step whose change was only transient.
  - This is the same shape as w11's suggested `arrive` class. The two could be one field: `changes: "location" | "view" | "record"`.
  - It needs a contract change across Core's draft step and the web domain's click and runtime reporting.
- **(b) Replay evidence.** After the replay, the thing the act names still holds: the chosen store is shown, or the cart holds the item. That is a domain assertion per act kind, and it belongs with result verification, not with the claim check.
- **(c) A structural hint within Core.** A `set` act claimed by a step that is the last kept mutate step of its "menu": a press that opens something and is followed by no press inside it. Core cannot see "inside", so this degrades to a heuristic I would not ship.

## Not verified

- No live or Lab run, per the brief. Whether the model, given `act_needs_repeat` or `step_is_optional`, goes on to write `amend_draft repeat` or `keep` is untested; that needs Lane D's confirm-requests or withdraw run with this merged.
- The full Core suite was not run, only the three named directories. The `incomplete-draft` module also reads acts through this barrel. Its tests were not run, but `plural` is optional and absent on non-plural acts, and `tsc` passed.
- Whether the assembled Flow actually runs a step at a position inside a repeat span. I read the span as carrier position through `through` position, from `routing.ts`'s comment "This step through `through` repeat". I did not read `authoring/assemble-draft.ts` or t195's F4 changes to it.

## Open questions or contradictions found

1. **The false-refusal cost of `act_needs_repeat`.** A site with a list-wide control ("select all", then one "Withdraw selected" press, or a "Confirm all" button) does every item in one step, and this rule would refuse it. None of the ten scenarios has such a control as far as the instructions show. If one appears, the fix is a claim form that says "this step acts on the whole list", checked against evidence, not a relaxed rule.
2. **Which refusal a step that is both optional and single-shot gets.** It is refused `step_is_optional` first (run 2's shape). Once the model clears optional with `keep`, the next completion says `act_needs_repeat`, so the model can take two rounds to learn both. I kept one reason per act to match the existing contract.
3. **t195 F2 wording lives in t195's tree.** My `REPEAT_INSTRUCTION` copies its brief telling. If F2 changes before merge, the two sentences should be re-aligned; they are separate strings in separate modules.
4. **Windowed quantifier.** "Save the cheapest table within five miles of every station" is correctly not plural. A four-word object with a late "every", such as "confirm the requests from everyone", is not plural either, which errs toward the missed act as this module intends.
