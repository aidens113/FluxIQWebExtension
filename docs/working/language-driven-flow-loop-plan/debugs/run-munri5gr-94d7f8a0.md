# Run debug — `run-munri5gr-94d7f8a0` (lane B run 4)

Evidence root: `test-runs/instances/t193-slot-2/run-munri5gr-94d7f8a0/` (plus the local `*.ui-review.local.json`
beside it for overlay samples). **Shown** / **Inferred** as in the model debug.

## Header

- Run id: `run-munri5gr-94d7f8a0`; `bigbox-retail` / `redesigned-buy-box` / `bigbox-retail-pickup-cart-redesigned-after-creation` (**Shown**: `events.ndjson` seq 1)
- Command: NO EVIDENCE in the bundle (lane report: dev merged after round 1).
- Date, provider, model: 2026-09-30T07:06:38Z to 07:14:38Z; deepseek / deepseek-flash, authorized 64 calls
- Provider calls, tokens, cost: 34 calls; 544117 in / 3393 out; **$0.0643** (`live-llm.json` observed). Build 171407 ms.
- Verdict as reported: `failed`, `runtime.behavior`, `flow_bootstrap.evidence_repeat_without_progress` (**Shown**: `flow-lane.json` `build.failure`)
- **Stage reached:** 2. 34 decisions, 23 tool calls, two completion attempts, no Flow.

## Stage 1 — the instruction and the expected chain

Same task as run 3; copied from the lane report "Stage 1" (bigbox). Instruction verbatim: "Switch my pickup
store to Millbrook Crossing Supercenter, then add two packs of the ValueRidge Essentials Select-A-Size Paper
Towels in the 12 Double Rolls size and one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count size
to my cart, both for pickup. Keep what is already in my cart as it is, and do not check out."
1. Set Millbrook Crossing Supercenter first. 2. Towels, "12 Double Rolls", Pickup, qty 2, Add to cart.
3. Napkins, "250 Count", Pickup, qty 1, Add to cart; no checkout; "4 items · Subtotal $43.39".
- Wrong-but-right-looking: Buy now; add before store switch; 1 towel pack; a "repair" with no replay.

## Stage 2 — exploration (grouped; **Shown**: steps + build trace call ids)

| # | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- |
| 0-7 | start, store | navigate, dismiss, open chooser (3 refused `handle_not_in_packet`), 2 snapshots, `open.store.picker.2`, `set.store.millbrook` | `dom-click` | succeeded; chip read Millbrook (`00008`): F fix live |
| 8-16 | towels, napkins | search towels, detect x2, open towels product, rerun d13 (`target_not_found`), open napkins 250 x2, add napkins (`blocked_by_dialog`) | `search.paper.towels`...`add.napkins.250` | 1 invalid decision at 17 (`llm_output.invalid_evidence_decision`, trace `decide throw`) |
| 18-23 | finish adds | dismiss dialog, add napkins, open towels, observe, `add.paper.towels.22`, `verify.cart.23` | `dom-click`, navigate | succeeded |
| 24 | complete | `complete` → dry run 1 | reset, 2 ok; **3, 7 unreproducible (6.6 s, 5.5 s); 8 failed; 18 failed**; rest replayed | `dry_run_refused` |
| 25-34 | repair draft | amend d3+d7 (applied), `complete` at 26 refused `bootstrap.instructed_act_missing` (dry run 2: 3, 7, 13 unreproducible, 8, 18 failed), then d7 x7 and d3 x1 | amendments | #27 applied, #31 undone, **6 `draft_unchanged` on d7 (28-30, 32-34)** → `evidence_repeat_without_progress` |

- Repeats: none `already_answered`; the repeat is the amendment of d7 (7 targets, 6 refused unchanged) (cause H).
- Rejections: the dry-run refusal names step numbers and codes only; nothing told the model why step 3/7 (store chip, store pick) could not replay on a site whose store was already switched (cause H2).
- Context: instructionBytes 1019 → 177 from step 21 (by design, E refuted).

## Stage 3 — the proposed Flow

- Not reached (`stoppedAt: "build"`, no `authoredNodes`). Draft at failure: 17 steps, rev 21 (**Shown**).
- Divergence: completing at 26 after amending away d3/d7 lost act 1, and the completion check caught it (`instructed_act_missing`) (**Shown** code; **Inferred** link).

## Stage 4 — replay

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| - | not reached | - | - | - | - |

- Success while doing nothing: `verify.cart.23` "succeeded"; the final page (`00014`) shows **Cart (1 item)**, soap only, so the towel/napkin adds did not persist (the dry-run `reset` may clear the cart; **Inferred**).
- Provider calls during replay: not reached.

## Stage 5 — the answer

- Not reached.

## Stage 6 — judgement and repair

- Not reached.

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| H | Confirmed: after the dry-run refusals the model re-amended d7 unchanged 6 times (28-30, 32-34) → `repeat_without_progress`. The lane report's "8 unchanged amendments" is 6 unchanged + 1 undone + 1 applied | Core no-progress guard (per report, wH) | wH | t193 |
| H2 | Confirmed and widened: dry-run steps 3 **and** 7 unreproducible (report named only 7), 8 and 18 failed: the dry run replays the store switch on a site already switched | Core `flow-draft/dry-run.ts` (per report) | verify, not re-execute | t196 |
| D | Unreproducible steps take 5.5-6.6 s each | domain `node-run/replay.ts` | not fixed | t174 |
| N2 | Decision 17 unusable (`AutomationStudioLlmUnusableDecisionError`, `code=- issues=-`) with no reason code | NO EVIDENCE of owning file | record the validation issue | new |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | Why decision 17 was unusable (trace prints `code=- issues=-`) | NO EVIDENCE of owning file |
| 2 | Which nodes d3, d7, d8, d18 are | step records lack a `dN` → node map |
| 4 | Whether the dry-run reset clears the cart | trace records codes only |

## UI review (screenshots read: `00002`, `00008`, `00014`; overlay from `ui-review.local.json`)

- `00002` (start): panel now has a chat pane with composer at the bottom ("Ask FluxIQ to do something…") and "What can FluxIQ do for you?". Above it the old Simple/Advanced toggle and "Get set up" card with **"To do: Add an AI model key"** remain. The user's instruction never appears as a message.
- `00008` (mid-build): status line and overlay read **"Using core.run_node"**: raw internal id. "21 steps so far". Overlay visible bottom-left.
- `00014` (failure): "Build failed", overlay "Build failed / Build failed" (title repeated as body); "Worked for 1m 7s · 27 steps · 2 failed" while the build took 171 s and 34 decisions; no reason given.
- Overlay samples: absent at start and first mid-build moment, flickering at moments 7, 8, 10 (**Shown**: `ui-review.local.json`).
- Defects: raw id in status (`00008`); stale setup card (all); no user message in chat (`00008`); duplicated overlay text and no failure reason (`00014`); step/time counts disagree with the build (`00014`); overlay flicker.
