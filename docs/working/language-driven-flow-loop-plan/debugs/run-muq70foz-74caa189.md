# Run debug — `run-muq70foz-74caa189`

## Header

- Lane A run 41, `crossborder-marketplace-hub-to-cart`, slot-1, headed, started from the extension chat.
- Tree: dev `dd4f8d12`, with F29 and F30.
- **Stopped by the supervisor** at 00:02:08 during the playback of the re-authored Flow. The Lab exited 1 with no stack, and Core's log ends `[exit] code=1`. The spend ledger has a `start` and no `finish`, and no run directory was written. Evidence: the staged run (`.staging-run-muq70foz-74caa189`, `.work/.../logs/core.log`), the UI review (19 moments), and four decision dumps.
- Spend from the dumps: about **$0.3232** over 116 calls.

| Loop | Dump | Calls | Cost | Input per call (mean) | Output | `find_on_page` |
| --- | --- | --- | --- | --- | --- | --- |
| build 1 | `build-2026-10-01T23-56-38` | 27 | $0.0722 | 17.1k-28.3k (25.0k) | 80 | 18 |
| build 2 | `...23-57-30` | 30 | $0.0873 | 18.2k-28.1k (24.5k) | 86 | 11 |
| playback recovery | `...23-59-53` | 6 | $0.0080 | 7.5k-8.5k (8.0k) | 80 | 6 |
| re-author | `...2026-10-02T00-00-07` | 53 | $0.1557 | 22.2k-30.9k (26.5k) | 85 | 45 |

The Lab's settle event agrees on the build: 58 calls, $0.1598.

## Stage 1 — the instruction and the expected chain

Search "usb c hub"; open the Voltbay Official Store card (a new tab); 7-in-1; Spain; quantity 3 (Space Grey is already chosen); collect the store coupon (its first claim is refused "Network busy"); Add to cart under the chat pill.

## Stage 2 — exploration

- **The search box was hidden from the model as search.** The supervisor's finding, confirmed by the dumps: the page view showed it as `field "Autumn Mega Sale: up to 70% off"` (its promo placeholder) and printed **no button lines**. So build 1 spent 18 of 27 calls on `find_on_page` for "Voltbay" before it found and typed the query.
- **The model wrote CSS selectors instead of handles:** `input[name="q"]`, refused `target_not_a_handle`. It tried twice in the build and three times in the re-author; it looked for an input it could not see.
- **Navigations to addresses never shown** were refused 3 times. t228 removes that refusal.
- Build 2 then went well:
  - D16-D17: typed the query and pressed Enter.
  - D18: opened the card. It opens in a new tab, and the run drove that tab (F20 live).
  - D19: pressed `t968` for a1.colour. That is the "Space Grey" text beside "Color:", the chosen value, not a swatch. The swatches are image-only and are not in the view.
  - D20: 7-in-1. D21: the coupon (`t964 "Get coupons"`), refused once (`action_failed`: the busy refusal, F17 live), then pressed again at D25.
  - D26: quantity typed into `t994`, which the view names `field "−"`: the label taken from the minus glyph beside it, not "Quantity".
  - D29: Add to cart.
  - D30: complete, accepted.
- Build 2's test: one step was replayed `unreproducible` (`target_not_found`), then the replays passed and the Flow was created.

## Stage 3 — the proposed Flow

Created and played back. The playback failed (the step is not recorded: no run directory). A 6-call recovery searched for "Voltbay" on the start page, then the re-author began.

## Stage 4 — replay

Not recorded (stopped).

## Stage 5 — the answer

None.

## Stage 6 — judgement and repair

- The re-author started on the home page and spent 45 of 53 calls on `find_on_page` for "Voltbay", "Voltbay Official Store", "coupon" and "fb-store-coupon".
- It used CSS selectors for the search box three times and unshown navigations twice.
- It completed by claiming steps 5-9 of the existing Flow, which the check accepted.
- The supervisor stopped the run during this Flow's playback.

## Causes

| # | Cause | Owner | Status |
| --- | --- | --- | --- |
| 1 | The page view shows the search box by its promo placeholder, not as search, and prints no button lines | t229 (`page-view/`, `kind.ts`, capture) | in progress |
| 2 | The repeat guard does not catch 45 `find_on_page` calls with varied queries on an unchanged page | lane B (RG) | routed (evidence) |
| 3 | The quantity box is named by the `−` glyph beside it (`field "−"`) | capture labels (t229's area while it works) | routed |
| 4 | The option chips carry no chosen state, and the colour swatches (image-only) are not in the view | capture / page view (t229) | routed |
| 5 | The re-author's completion accepted claims on an earlier Flow's steps | lane D (completion claims) | routed |

UI review (`run-muq70foz-74caa189.ui-review.local/`, 19 moments): the steps show as chat cards; playback moments 11-19 ran with the overlay absent.

## Instrumentation gaps found

- A run stopped mid-way leaves no run directory, so the playback's failing step is unknown; only the staging events (periodic views) and the dumps remain. The Lab could write a partial bundle on termination.
