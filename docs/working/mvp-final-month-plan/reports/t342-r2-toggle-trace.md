# t342-r2-toggle-trace: report

Read-only root-cause trace of lane A, run `run-muylu4pp-f9cb2121` (slot 2). No source edits. Abbreviations: R = Core `packages/fluxiq/src/programs/automation-studio/runtime`, D = downstream `domain/src/runtime/llm-evidence`. Step folders are under `test-runs/instances/t342-slot-2/run-muylu4pp-f9cb2121/steps/`.

## Outcome

Done. All three questions are answered with evidence. Q1 was **reproduced by running a script** against built Core dist. Q2 and Q3 were answered **by reading** the code and the run's step files.

## What changed and why

Nothing in either repository. Two scratch scripts are in `...\scratchpad\w-toggle\` (`pair.mjs`, `patched.mjs`).

### Q1. Why step 19 stayed in the Flow and un-chose the colour

**The presses did carry `toggle`.** D `node-run/run.ts:440` builds the model's `choice` sentence and `run.ts:510` builds the draft's `toggle`. Both use the same arguments (`node, current, after, firstHandle(written)`) through `press-effect/chosen-state.ts:82-94`. Where the sentence appears, the toggle is therefore present as well (`press-effect/toggle.ts:25-34`, key = handle `t940`). The sentence appears in 0020, 0058 and 0066 ("un-chose", so `to: off`) and in 0070 ("chose", so `to: on`). Core carries the toggle through `R/llm/evidence-loop-decision.ts:252,303-306` and then `R/llm/evidence-loop/call-record.ts:68` onto the step (`R/flow-draft/step.ts:176`).

**A rerun that runs gets a fresh `toggle`. Its receipt keeps the old one.** The rerun is appended as a new step through `callRecord`, which gives it its own toggle. `R/llm/evidence-loop/rerun-replacement.ts:95-100` then puts it in the replaced step's place. The replaced attempt moves to the end of the draft with `replacedBy` set, keeps its old `toggle`, and is dropped (`:56`). `R/llm/node-tools/rerun-check.ts:170` deletes `toggle` only for a rerun that was checked but never run, which is not the case at 0066.

**Root cause: `partnerOf` takes a rerun's receipt as a partner.** `R/flow-draft/reversal.ts:86-95` skips only steps that already carry `cancels`. It does not skip steps carrying `replacedBy`. The live sequence ran like this:

- When step 19 (0070, `on`) was appended with `add`, the walk back from 19 met draft step 18 first. Step 18 is the receipt of rerun `rerun.9` (0058): `to: off`, dropped, no `cancels`.
- Rule (b) (`reversal.ts:79`) therefore took 19 out with `cancels = <step 18>` and deleted its `a1.colour` claim.
- The draft at 0071 (`0071-decide/request.txt:1772-1786`) shows exactly that: "it pressed back the control step 18 pressed, and step 18 is not in the Flow". Step 18 is listed `replacedBy: 9`.
- The real live partner was step 9: the 0066 rerun, kept, `to: off`. Under rule (a), the kept steps 10, 12 and 13 between 9 and 19 would have stopped any pairing.

**Reversal does run after the drop in the 0071 decision. It cannot act on step 19.**

- `add 19`: in `R/flow-draft/amendment/apply.ts:290-292` this runs `DropReversals` immediately, because nothing has been withdrawn yet.
- `drop 9`: the step goes into `withdrawn`, and `apply.ts:312` runs `DropReversals` again after the strand check.
- Both passes skip step 19 at `reversal.ts:63` (`later.cancels !== undefined`), the "model has the last word" rule. Step 19 had that `cancels` only because of the wrong pairing at 0070.
- Result: the Flow ends with one Space Grey press (19, at the end of the Flow) and no step 9.
- Build test 0091 (`dryrun.1.19`) shows `t940 "Space Grey" no longer marked`.

**Proved by running.** `scratchpad/w-toggle/pair.mjs` imports `dist/.../flow-draft/index.js` and `llm/evidence-loop/rerun-replacement.js` and replays this exact sequence:

1. Kept press `off`.
2. Rerun `off`.
3. Rerun `off`.
4. Append `on` with `a1.colour`.
5. `apply([{add 19, act a1.colour}, {drop 9}])`.

Observed output:

- After step 4: the new `on` step is `dropped` with `cancels=d7`, where `d7` is the receipt carrying `replacedBy=d8`.
- `apply` returns `{"applied":2,"refused":[]}`.
- Final Flow presses of t940: `[ 'Space Grey #0070 to=on' ]`, still carrying `["a1.colour"]`.

This matches 0072 (`applied 2`) exactly. `patched.mjs` is the same sequence with one added line in `partnerOf` (`if (c.replacedBy !== undefined) continue;`). Its output: nothing is taken out at 0070, and after `drop 9` the `on` press is taken out with `cancels=d8` (the live step 9) and loses its acts. That is correct for a page that arrives with the colour chosen.

**Proposed fix**

- **Fix.** In `R/flow-draft/reversal.ts`, inside `partnerOf`, skip a candidate that has `replacedBy !== undefined`. A receipt never runs in the Flow.
- **Failing test to write first.** In `R/flow-draft/tests/reversal.test.ts`: "run muylu4pp: a rerun's receipt is never a partner; a later opposite press pairs with the rerun in the step's place". Build a kept `off` step, a receipt carrying `replacedBy` and `off`, then an appended kept `on`. Expect nothing taken out. Then drop the rerun and expect the `on` step taken out with `cancels` = the rerun's id.
- **Residual.** Even with the fix, a model that adds a taken-out rule-(b) half back keeps it forever (`reversal.ts:63`). This happens once Q3 leaves `a1.colour` as a todo and the only Space Grey press available is that half. The structural alternative is to compute, for each key, the state the Flow sees before each kept press. The arrival state is the opposite of the first recorded press's `to`, flipped by each earlier kept press. A choice claim on a press that turns its control off in the Flow would then be refused. This decision is the supervisor's; Q3's fix removes the pressure that causes the re-add.

### Q2. Why the quantity claim on step 13 ("+", 1 to 2, asked three) was accepted

- **The act judge skips choices.** `R/flow-bootstrap/instructed-acts/claim-verdict.ts:49-50,69`: `ACT_ID = /^a[0-9]+$/` and `if (!ACT_ID.test(id) ...) return undefined`. The header (`:17`) says "Only an act's own id is judged here; a choice is a setting, judged as before". So the `claimRefused` call at `apply.ts:238` never refuses `a1.quantity`.
- **The checklist accepts any stepper press.**
  - `instructed-acts/standing.ts:188-200` judges a choice. Its first call is `quantity-fault.ts:107-126`.
  - `:117`: `if (!actStep || ...) return undefined`. Here `a1` had no step (`todo no_step_added`), so `actStep` is undefined.
  - `:118`: a press that is not the add's own press also returns undefined. The header (`:64-66`) says "a stepper ... which the draft cannot tell from any other press and so accepts".
  - Back in `standing.ts:199`, with `!used.has(step)`, the choice counts as done. 0080's request then shows `a1.quantity done: 13`.
- **Core has no value to compare, because the domain never states it.**
  - 0039 (the "+" press) leaves `t964 field "Quantity" ="2"` on the page, but the result has no `changed` list and step 13 has no `ranWith` value (`bindable: []`).
  - The field value is a state token (D `page-view/element/state-tokens.ts:31-33`, `="2"`). The change walk sees it (D `press-effect/change/walk.ts:58`: tokens differ, giving a `both` change).
  - Both readers drop it. D `press-effect/page-changes.ts` `changed()` / `stateChanges()` report only `PAIRED` / `LONE` tokens (checked, open, selected, pressed, marked, disabled) and text-word changes.
  - D `press-effect/change/statement.ts` `stated()` returns undefined unless the line's *words* changed. "Quantity" stayed the same.
  - So neither the model's change list nor the draft's `changed` mentions 1 to 2.

**Proposed fix (two sides)**

1. **Domain.** In `press-effect/change/statement.ts` and `press-effect/page-changes.ts`, state a `both` change whose `=` value token differs as a `reads` / `rose` line carrying the new value (for example, the field's words, now `"2"`, was `"1"`).
   - Failing test: D `press-effect/tests/press-changes.test.ts`, "a press that moves a field from 1 to 2 states the field's new value".
2. **Core.** In `instructed-acts/quantity-fault.ts`, for a step that is not the add's press, when its `changed` holds a `reads` / `rose` line whose new value is a number different from `automationStudioInstructedQuantity(choice.value)`, return a new fault `quantity_value_differs`. Add it to `AutomationStudioInstructedActObjectTodo` in `checklist.ts` and to `AUTOMATION_STUDIO_INSTRUCTED_QUANTITY_INSTRUCTIONS`.
   - Let `claim-verdict.ts` also judge choice ids for that fault, so the claim is refused when it is made.
   - Failing tests: `instructed-acts/tests/checklist.test.ts` ("a1.quantity three on a + press whose change reads 2 is todo quantity_value_differs") and `tests/claim-verdict.test.ts`.

### Q3. A choice the page already shows chosen

- **No mechanism exists.** Searched `R/flow-bootstrap/instructed-acts/**`, `R/flow-draft/excused.ts`, `R/flow-draft/site-memory.ts` and `R/llm/harness-options/` for already-chosen, preselect and arrival handling.
  - `checklist.ts:96-113` and `:251-258` (`shown`) give a choice only `done: <step>` or a todo. With no named step the result is `todo: "no_step_added"`.
  - The only "arrival" in Core is the start-location navigation (`check.ts:211-219`, `checklist.ts:217-223`), not a control's state.
  - `excused.ts` covers replay steps a test passes over. `site-memory.ts` covers steps the site remembers. Neither covers a choice that needs no step.
- **The prompt contradicts the checklist.**
  - D `system-instructions/instructions.ts:51` ("An option already marked ... is chosen: leave it") conflicts with Core's completion text ("Finish only when every act on the draft's acts checklist is done", `0071-decide/request.txt:1828`) and with `a1.colour todo no_step_added` (`:1494-1499`).
  - The model followed the checklist and claimed `a1.colour` on Space Grey presses (0019, 0069, 0071). Each press un-chose the colour.
- **Evidence Core already holds.** A press whose `toggle.to` is `off` proves the control was chosen before it. The draft keeps such presses (even dropped or taken out) with their `control` words: `0071` request, steps 8, 9 and 19 show `does.target: Space Grey`.

**Proposed fix (smallest)**

- **Fix.** Add a focused module `R/flow-bootstrap/instructed-acts/preset-choice.ts`, read in `standing.ts`'s choice loop. When no kept step makes the choice, a variant choice is done by the page in this case:
  - the first press of some toggle key in the draft has `to: "off"`;
  - that press's `control` words fold-match the choice value (the same fold as `choice-evidence.ts:51-53`);
  - no kept press of that key is in the Flow.
- **How the checklist shows it.** As `chosenOnArrival: <that step>` plus a sentence ("already chosen when the page arrived; pressing it would undo it"). `checklist.ts:279-283` and the completion check do not count it as a todo. The judged test from the Flow's start still decides, which covers a site that does not preselect the option.
- **Failing test to write first.** `instructed-acts/tests/checklist.test.ts`: "a variant the page showed chosen before a press that un-chose it is done on arrival with no step; a kept press of it makes it a todo again".

## Commands run and observed results

- `node scratchpad/w-toggle/pair.mjs`: printed the drafts quoted under Q1. After 0070: step `d9` (the 0070 press) `dropped on cancels=d7`, where `d7` has `replacedBy=d8`. `apply -> {"applied":2,"refused":[]}`. Final Flow presses of t940: `[ 'Space Grey #0070 to=on' ]`.
- `node scratchpad/w-toggle/patched.mjs`: `patched, taken out at 0070: [] | sg4 kept [ 'a1.colour' ]`, then `patched, taken out after drop of step 9: [ 'd9 cancels=d8' ] | sg4 dropped (no acts)`.
- Read-only `node -e`, `grep` and `sed` over the step files. Results: 0020, 0058 and 0066 say "un-chose"; 0070 says "chose"; 0039 shows `t964 ="2"` with no `changed`; 0091 (`dryrun.1.19`) shows `t940 "Space Grey" no longer marked`; 0072 shows `applied 2` with targeted `d19, d18`.
- Dist freshness: `dist/.../reversal.js` and `amendment/apply.js` are stamped 12:50:40, and their sources 12:50:21 on the same day. dist `reversal.js:61,94` match source lines 63 and 91.

## Not verified

- The Q2 and Q3 fixes are designs only. No tests were written and no package tests were run, because the brief is read-only.
- `patched.mjs` reimplements `DropReversals` with the one-line change. It does not patch the dist module that `apply.js` imports, so the post-drop result was shown by calling the patched function directly rather than through `apply`.
- I did not confirm from a live draft dump that step 18 carried `toggle`. That is inferred from the 0058 "un-chose" sentence, from `run.ts:440/510`, and from the 0071 `out` line naming step 18 as the partner. The script reproduces that outcome.
- I did not check whether other consumers (`second-copy.ts`, `opener.ts`, `entry.ts`) also mistake `replacedBy` receipts for live steps.

## Open questions or contradictions found

- The draft places step 19 at the end of the Flow, after the Add to cart (0091 ran last). Even as a "choose" press it would have come too late. Ordering is a separate gap.
- The "model has the last word" rule (`reversal.ts:63`) also lets a model re-add a rule-(b) half while dropping its partner in the same decision. Whether `cancels` should still protect a later half whose partner is out is a supervisor decision; see the Q1 residual.
- The domain prompt says to leave a marked option alone, but Core's checklist demands a step for every choice. Q3's fix resolves the contradiction on the Core side.
