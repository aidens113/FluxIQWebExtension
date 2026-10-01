# Run debug — `run-muq4jztv-ea489aa9`

## Header

- Lane A run 39, `bigbox-retail-pickup-cart`, slot-1, headed, started from the extension chat.
- Tree: dev `46cf82c2` (presses refused only for a real layer) plus F24 (clipped controls not covered), uncommitted.
- Verdict: **failed** (`lab.chat_build_failed`). The build stopped at its $0.25 ceiling with 4 of the 6 instructed things done. Still to do: "two packs" ("the step that adds the item does not set it") and "in the 250 Count size" ("the step I tried for it already does something else").
- Spend: **$0.2290** over 58 calls: a 55-call exploration ($0.2196) and a 3-call second exploration ($0.0094).
  - Per call: input 16.9k-35.1k tokens (mean 29.9k), output about 98.
  - The ledger records $0 (a failed chat build's accounting is null).

## Stage 1 — the instruction and the expected chain

Store switch to Millbrook, then the towels in 12 Double Rolls with quantity 2 (stepper "+" before Add to cart, or the cart's Qty), then the napkins in 250 Count, for pickup.

## Stage 2 — exploration

- **Store switch (a1): done.** D9 opened the chooser and D10 pressed Millbrook. Run 38's false cover is gone: F24 plus dev's real-layer rule.
- **Towels:** D18-D25 searched and opened the item. D26 chose 12 Double Rolls (a2.size). D27 pressed Add to cart (a2).
- **Quantity:** the product page's stepper is three plain spans, `−`, `1`, `+`. The compact view showed only `t1491 "1"`: `−` and `+` are math symbols (`\p{Sm}`), which the view's "meaningful words" rule dropped. So the model had no control for "two packs". It tried to repeat the add step (D28-D30, `repeat over 28`), which the completion check rightly refused (`choice_is_the_act_step`). The cart page's Qty selects (`t1751`, `t1762`) were in view later, and it never used them.
- **Napkins:** presses on the recommendation rail (`t1781`, the right item, and `t1800`, the look-alike "Softerra ... 250 Count") were refused `target_covered` by `t1855`. That is the cart's fixed "Estimated total ... Continue to checkout" bar, which overlaps the rail only at the current scroll. The press gate scrolls a target to the viewport centre, so these presses would have landed.
- **D44-D55:** 10 completions in a row, all refused `bootstrap.instructed_act_missing`, spent the ceiling. The repeat guard (RG, dev `d5730a5a`) now refuses that pattern.

## Stage 3 — the proposed Flow

None was created; the draft was kept ("building again carries on from it").

## Stage 4 — replay

None.

## Stage 5 — the answer

None.

## Stage 6 — judgement and repair

None. The second exploration (3 calls) started off its start location and completed twice into the same refusal.

## Causes

| # | Cause | Owner | Status |
| --- | --- | --- | --- |
| 1 | The page view drops lone `+`, `−` and `×`: quantity steppers and close glyphs drawn as text | lane A (F27, domain `page-view/element/meaningful.ts`, `page-view/fragment-merge.ts`) | **fixed**: math symbols are meaningful, and a lone symbol is never folded into a fragment run |
| 2 | A bar pinned to the viewport is reported covering controls the gate's scroll would uncover | lane A (F26, extension `content/evidence/overlays.ts`) | **fixed**: the blocker is kept with its kind, but such controls are not counted as covered |
| 3 | Ten identical refused completions | lane B (RG) | on dev |
| 4 | The model repeated the add instead of using the cart's Qty | model behaviour | open: watch in run 40 with the stepper visible |

UI review (`run-muq4jztv-ea489aa9.ui-review.local/`, 11 moments): steps show as chat messages with reasons. U14-U16 recur: raw handles are shown, the same sentences repeat, and the closing message is long.

## Instrumentation gaps found

- A failed chat build's spend is still recorded nowhere but the dumps.
