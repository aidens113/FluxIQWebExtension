# t285-w13 instruction choices: fulfilment and earliest time

## Outcome

Done. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t285/!FluxIQ` (branch `task/t285-fix-act-claims`), no commits.

- "both for pickup" on the bigbox pickup-cart instruction now gives `a2.fulfilment` and `a3.fulfilment` (value `pickup`, quote `both for pickup`).
- On the pickup-order instruction, `a1` now requires `a1.size` "6 Double Rolls", then `a1.fulfilment` "pickup", then `a1.time` "earliest" (quote "the earliest pickup time").
- The book-service instruction gains `a1.time` "earliest" (quote "the earliest weekday morning slot") and nothing else.
- Across the corpus, no other act gains a fulfilment or time choice, and act ids, kinds, verbs, plural marks and consequences are unchanged.
- Two of the five neighbouring suites now fail (17 tests) because their Flows do not choose the new pickup/time requirements. Details below. I did not edit them, as the brief said.

## What changed and why

R = `packages/fluxiq/src/programs/automation-studio/runtime`.

`R/flow-bootstrap/instructed-acts/instruction-choices.ts`
- New `FULFILMENT` form: an optional both/all/each, then `for`, then an optional qualifier (in-store, in store, store, curbside, kerbside, same-day, next-day, home, local), then pickup, pick-up, pick up, delivery, shipping or collection.
  - Id word `fulfilment`, `choice: "variant"`, value the bare word, quote the matched phrase.
  - It never matches right after ready, available or eligible, so "ready for pickup today" (stock) reads nothing.
- New `TIME` form: an optional "the", then earliest, soonest, first available, next available or first open, then up to three words, then time, slot, window, appointment or date (plural allowed).
  - Id word `time`, `choice: "variant"`, value the ordinal as written, quote as matched.
- `automationStudioInstructedChoices` takes a third parameter, `reading: "item" | "booking" | "check-out"`, defaulting to `"item"`. A table (`READS`) says what each reading takes:
  - `item` takes everything: quantity, variants, origin, fulfilment and time.
  - `booking` takes only the time.
  - `check-out` takes only fulfilment and time.
- There is no new choice kind and no new export. A small `read` helper now also handles the existing ORIGIN loop.
- Header: a new paragraph names the defect, cites musp4h2f row 9 and munovwp3 cause 6 (causes-early row 34), and gives the one-sided bias argument for each form.
  - For fulfilment, the word "for" is what makes it a purpose of the act. That is why "Switch my pickup store", "pay at pickup", "with standard shipping" and "delivered free with standard delivery" read as none.
  - For time, the closing noun decides. "soonest-ending first" and "the first available kettle" read as none.

`R/flow-bootstrap/instructed-acts/instruction-acts.ts`
- Added `BOOKING = /^(?:book|reserve)$/u`. A submit act with that verb reads its own object with `"booking"`, so it gets only a time.
- The check-out drop filter is now `orderOf(act)`, the nearest earlier buy, order or purchase submit. The dropped acts are the same as before.
- For each check-out folded into an order, the order's `requires` gains `automationStudioInstructedChoices(id, checkOut.object, "check-out")`. Choices whose id the order already holds are skipped. Quantity and variant never come from the check-out, because the `check-out` reading does not read them.
- Header: the "Checking out is the order it pays for" paragraph now explains the handoff and its bias (munovwp3 cause 6, causes-early row 34). There is also a new "A booking chooses its time" paragraph.

Tests:
- `tests/instruction-choices.test.ts`
  - The RUN_28 pin now includes a2/a3 fulfilment. I changed it on purpose.
  - Six new positive cases: in-store pickup, same-day delivery on an order, delivery plus earliest slot on a buy, first available slot on a booking, next available time on a reservation, and a booking with a quantity, size and fulfilment that keeps only its time.
  - A new describe block, "what names no fulfilment and no time". It covers the store switch, "ready for pickup today" as a filter on an add, "pay at pickup", the full crossborder buy-hub instruction (standard shipping), the full everything-store kettle instruction (free standard delivery), and "the first available kettle".
  - An exact pin that the crossborder purchase's choices are unchanged.
  - Two extraction cases that yield no act at all: the bigbox "ready for pickup today" one and the auction "soonest-ending first" one.
- `tests/instruction-acts.test.ts`
  - The pickup-order pin (formerly line ~257) is updated on purpose to size, fulfilment and time, plus an exact `a1.time` object.
  - New test: a check-out hands the order only fulfilment and time. In "Buy the kettle. Check out with three of them in blue for delivery in the first available slot." the order gets fulfilment and time, but no quantity and no colour.
  - The same test checks that no second id appears ("Order the kettle for pickup. Check out for delivery." keeps `a1.fulfilment` = pickup), and that a check-out asked alone chooses nothing.
  - New describe block: across all CONSEQUENTIAL sites, exactly bigbox pickup cart [a2.fulfilment, a3.fulfilment], company book service [a1.time] and bigbox pickup order [a1.fulfilment, a1.time] have these choices. The boiler booking's `requires` is pinned exactly.

## Commands run and observed results

All commands ran from `packages/fluxiq` unless noted.

1. **Fail-first**, before the source change: `npx vitest run R/.../tests/instruction-choices.test.ts R/.../tests/instruction-acts.test.ts`
   - Result: `Test Files 2 failed (2)`, `Tests 13 failed | 140 passed (153)`.
   - The failures were RUN_28 (expected 3 requires, got 2), the six new positive cases (`expected [ [ 'a1', [] ] ]`), and the pickup-order pin (`expected [ [ 'a1.size', '6 Double Rolls' ] ] to deeply equal [ …(3) ]`).
   - Also failing: the handoff test, the three corpus fulfilment/time cases (`expected [] to deeply equal [...]`) and the boiler pin (`expected undefined`).
   - All the negative cases passed before the fix, as they should.
   - One fail-first failure was a fault in my test, not in the code: buy and check-out in one sentence are a single `submit` match (one act of a kind per sentence), so the buy's clause already held "in blue" (`a1.colour`). I moved the check-out into its own sentence so the test exercises the handoff.
2. **After the fix**, the same command twice: both runs gave `Test Files 2 passed (2)`, `Tests 153 passed (153)`.
3. **The five neighbouring suites**, run once:
   - Plain run: all 5 failed to load, `Tests no tests`. The cause is `instructed-acts/kind-words.ts:21:106: ERROR: Unterminated regular expression`. This is the other worker's uncommitted edit (its `git diff` shows `[\]\]` and `"\$&"`, where the original in claim-doubt.ts had `[\]\\]` and `"\\$&"`). Not mine, and I did not touch it.
   - To get a signal anyway, I reran with a scratch vitest config (`scratchpad/w13-vitest.config.mts`). It aliases `./kind-words.ts` to a scratch copy whose escape line was restored from HEAD's claim-doubt.ts. The tree was not changed.
   - Result: `Test Files 2 failed | 3 passed (5)`, `Tests 17 failed | 109 passed (126)`.
   - `action-permissions.test.ts`, `not-finished.test.ts` and `judged-build.test.ts` all pass.
   - In the failing assertion diffs, the only added ids are `a2.fulfilment` (10 occurrences) and `a3.fulfilment` (10); no ids were removed. These Flows have no step that chooses pickup, and my parse change explains every failure:
   - `check.test.ts` (7):
     - "refuses run 28's Flow, naming the quantity and both sizes no step chooses": old 3 missing [a2.quantity, a2.size, a3.size]; new 5, adding a2.fulfilment and a3.fulfilment (`no_step_named`).
     - "refuses the add press named for its own quantity and size": old 3 entries; new 5, adding a2/a3.fulfilment.
     - "refuses the arrival, or a step claimed for another act, named for a choice": old 3 entries; new 5, adding a2/a3.fulfilment.
     - "accepts a Flow that chooses each size and sets the quantity with steps of its own": ok was true, now false. Fulfilment is unclaimed.
     - "accepts choices named in words rather than by id": true, now false, for the same reason.
     - "lets the add step answer a choice only where its own input sets it": true, now false, for the same reason.
     - "accepts Place order, declared move_money, as the order, with the size chosen by a step of its own": true, now false. The pickup-order instruction now requires a1.fulfilment and a1.time, and the draft claims only a1 and a1.size. This one is inferred from the instruction and the claims; its diff is a bare boolean.
   - `object-binding.test.ts` (10):
     - "refuses run 40's completion ...": the missing list gains a2.fulfilment and a3.fulfilment.
     - "accepts the napkins claimed on the napkins' own Add to cart, and the honest Flow whole": old `[]`, new [[a2.fulfilment, no_step_named], [a3.fulfilment, no_step_named]].
     - "refuses a size claimed on the other product's swatch ...": old [[a3.size ...]], new [a2.fulfilment, a3.size, a3.fulfilment].
     - "accepts as before a step whose record names no object at all": old [], new a2/a3.fulfilment.
     - "refuses two packs claimed on the add repeated over a list", "refuses one press of the stepper claimed under a repeat" and "refuses presses of the add that are not the count, and counts them": old [[a2.quantity ...]], new with a2/a3.fulfilment added.
     - "accepts a quantity stepper pressed to two, or a quantity field set to 2", "accepts exactly two kept presses of that add on that product, claimed on either" and "does not count the same add on another product as a press of this one": ok was true, now false. Fulfilment is unclaimed.
4. **From the Core root**, `node scripts/build-cache/cli.mjs fluxiq:check`: exit code 2. The only errors are `kind-words.ts(21,53): error TS1161: Unterminated regular expression literal.` and `kind-words.ts(21,106): error TS1005: ')' expected.`, both from the other worker's file. tsc reports only syntax errors when any exist, so this run did not type-check my files.
   - I added a narrow typecheck: `npx tsc -p scratchpad/w13-tsconfig.json`. It extends the package tsconfig over my 4 files and everything they import, with an explicit typeRoots. Result: exit 0, no output.
5. **From the Core root**, `node scripts/build-cache/cli.mjs structure-audit:check`: `structure-audit: passed (265 warning(s), 349 baselined).` It was not stamped, because inputs changed while it ran: the other worker is editing.

## Not verified

- The full package typecheck with my change, which is blocked by the other worker's `kind-words.ts` syntax error. Only my four files and their import graph were type-checked.
- The five neighbouring suites against the real tree. They ran with an alias that replaces the broken `kind-words.ts` with a corrected copy.
- No Lab, browser or live run. Whether a Flow can claim `aN.fulfilment` / `aN.time` with a step on the bigbox site (a pickup radio, a slot picker) is untested.
- The Place-order failure's exact missing ids (its diff is only true/false).

## Open questions or contradictions found

- The 17 neighbouring failures are expected new requirements: their fixture Flows chose no pickup. Whoever owns `check.test.ts` and `object-binding.test.ts` must either add pickup-choosing steps or claims to those fixtures, or decide on purpose that the RUN_28 fixtures should keep their old expectations. Product code may also need to handle this, if `check.ts` should let the add step answer a fulfilment it sets.
- The other worker's `kind-words.ts` line 21 has lost backslashes. It breaks every suite that imports `instructed-acts` and the package typecheck.
- Same-sentence "Buy X, then check out ... for delivery": buy and check-out are one `submit` match, so the order act reads the check-out words as its own object. Those words can then give quantity and variant, as they did before this change.
- By mistake I created an empty `packages/fluxiq/vitest.w13-scratch.config.ts` and removed it at once; `git status` shows no trace. All my other scratch files are in the session scratchpad.
