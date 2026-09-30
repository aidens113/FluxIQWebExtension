# Run debug — `run-munw16g4-81e2d1a8` (lane B run 7)

Evidence root: `test-runs/instances/t193-slot-2/run-munw16g4-81e2d1a8/`. **Shown** / **Inferred** as in the model debug.

## Header

- Run id: `run-munw16g4-81e2d1a8`; `bigbox-retail` / `redesigned-buy-box` / `bigbox-retail-pickup-cart-redesigned-after-creation`
- Command: NO EVIDENCE in the bundle (lane report: partial wH/wR).
- Date, provider, model: 2026-09-30T09:13:24Z to 09:20:30Z; deepseek / deepseek-flash, authorized 64
- Provider calls, tokens, cost: 43 calls; 733015 in / 4242 out; **$0.0835** (`live-llm.json` observed). Build 196607 ms.
- Verdict as reported: `failed`, `runtime.behavior`, `flow_bootstrap.evidence_repeat_without_progress`
- **Stage reached:** 2. 43 decisions, 30 tool calls, two completions, no Flow.

## Stage 1 — the instruction and the expected chain

Copied from the lane report "Stage 1" (bigbox). Instruction verbatim: "Switch my pickup store to Millbrook
Crossing Supercenter, then add two packs of the ValueRidge Essentials Select-A-Size Paper Towels in the 12
Double Rolls size and one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count size to my cart,
both for pickup. Keep what is already in my cart as it is, and do not check out."
1. Set Millbrook first. 2. Towels "12 Double Rolls", Pickup, qty 2, Add to cart. 3. Napkins "250 Count", Pickup, qty 1, Add to cart.
- Wrong-but-right: Buy now, 1 towel pack, no store switch.

## Stage 2 — exploration (grouped; **Shown**: steps, trace)

| # | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- |
| 0-9 | start, store | navigate, dismiss, `store.switch` refused `handle_not_in_packet`, 2 snapshots, 2 `already_answered`, `open.store.picker`, `set.store.millbrook` | | succeeded |
| 10-20 | items | 1 amendment unchanged (d4); search; `open.towels.product` `target_not_found`; detect x2; towels link; napkins 250; add (`blocked_by_dialog`), dismiss, add | | ok |
| 21-27 | towels | navigate x2; `add.towels.cart` `target_not_found`; detect; reruns d23 (ok), d25 (`target_not_found`, then ok) | | ok |
| 28 | complete | dry run 1 | **3, 10, 16, 20, 27 unreproducible; 17, 19 failed** | `dry_run_refused` |
| 29-34 | fix | 2 snapshots; `add.towels.final`; rerun d17 x2; #33 amendment refused 4 steps `already_so` | | dry run 2: 3, 10, 27 unreproducible, 19 failed |
| 35 | complete | refused `bootstrap.instructed_act_missing` | | |
| 36-43 | fix act 1 | amend d3 (applied at 36), then **d3 x7 unchanged (37-43)** | | `evidence_repeat_without_progress` |

- Repeats: 2 `already_answered`; d3 amended unchanged 7 times in a row.
- Rejections: `already_so` refusals (#33) say the step already has that value; nothing said why d3 could not be re-made.
- Context: `00009` shows a **"Robot or human?" Press & Hold** interstitial on the search page during the build's dry-run replay (status "core.replay.unreproducible"), so at least one unreproducible step replayed into a bot check (**Shown** screenshot; **Inferred** link).

## Stage 3 — the proposed Flow

- Not reached (`stoppedAt: "build"`). Draft: 22 steps, rev 29, 12 without input (**Shown**).

## Stage 4 — replay

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| - | not reached | - | - | - | - |

- Success while doing nothing: NO EVIDENCE (no Flow ran). Provider calls during replay: not reached.

## Stage 5 — the answer

- Not reached.

## Stage 6 — judgement and repair

- Not reached.

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| H | Confirmed: after `instructed_act_missing` the model re-amended d3 (the store chip step) unchanged 7 times → `repeat_without_progress`; the partial wH did not stop it | Core no-progress guard (per report) | wH | t193 |
| H2 | Confirmed: dry run replays the store chip/pick (3, 10) on a site already switched; both unreproducible each time | Core `flow-draft/dry-run.ts` | verify, not re-execute | t196 |
| N8 | Fast dry-run replay of the search triggered the scenario's "Robot or human?" check (`00009`); steps after it cannot reproduce | scenario bot check vs. replay pacing; NO EVIDENCE of which step | pace replay or treat the check as a known interstitial | new |
| D | Unreproducible steps cost 5.2-6.5 s each | domain `node-run/replay.ts` | not fixed | t174 |

The lane report's Runs row 7 gave only the end code; the mechanism is H + H2 above.

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | Which dry-run step met the bot check | replay records carry no page state |
| 2 | Which nodes d3, d10, d17, d19, d27 are | no `dN` → node map |

## UI review (screenshots read: `00002`, `00009`, `00015`)

- `00002` (early build): "Building your Flow · Deciding the next step · 5 steps so far"; overlay shown; stale "Add an AI model key" card.
- `00009` (mid-build): panel and overlay read **"Using core.run_node: core.replay.unreproducible"**: raw ids and an internal result code shown to the user; the page is a bot check, and FluxIQ does not say so.
- `00015` (failure): "Build failed"; "Worked for 1m 3s · 24 steps · 2 failed" against 196 s and 43 decisions; overlay "Build failed / Build failed"; no reason.
- Overlay: absent at start, flickering at 5, 6, 11 (**Shown**).
- Defects: raw ids (`00009`); counts disagree (`00015`); duplicated overlay text and no reason (`00015`); stale setup card (all).
