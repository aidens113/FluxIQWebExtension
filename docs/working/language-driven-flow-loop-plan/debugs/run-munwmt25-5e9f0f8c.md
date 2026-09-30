# Run debug — `run-munwmt25-5e9f0f8c` (lane B run 9)

Evidence root: `test-runs/instances/t193-slot-2/run-munwmt25-5e9f0f8c/`. **Shown** / **Inferred** as in the model debug.

## Header

- Run id: `run-munwmt25-5e9f0f8c`; `bigbox-retail` / `redesigned-buy-box` / `bigbox-retail-pickup-cart-redesigned-after-creation`
- Command: NO EVIDENCE in the bundle (lane report: wH in).
- Date, provider, model: 2026-09-30T09:30:14Z to 09:35:58Z; deepseek / deepseek-flash, authorized 64
- Provider calls, tokens, cost: build 28 calls, 441186 in / 3107 out, **$0.0541** (`live-llm.json` observed); verification 2 calls $0.0021 (filed under `repair` in `live-llm.json`). Lab counted 30.
- Verdict as reported: `failed`, `runtime.behavior`: "The created Flow ran, but the scenario's playback goal did not hold afterwards"; oracles `records: not_declared`, `finalState: failed` (**Shown**: `events.ndjson` seq 22)
- **Stage reached:** 5. The Flow ran to success; the answer was wrong; judgement `unverified`, so no repair (stage 6 not entered).

## Stage 1 — the instruction and the expected chain

Copied from the lane report "Stage 1" (bigbox). Instruction verbatim: "Switch my pickup store to Millbrook
Crossing Supercenter, then add two packs of the ValueRidge Essentials Select-A-Size Paper Towels in the 12
Double Rolls size and one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count size to my cart,
both for pickup. Keep what is already in my cart as it is, and do not check out."
1. Set Millbrook first. 2. Towels "12 Double Rolls", Pickup, qty 2, Add to cart. 3. Napkins "250 Count", Pickup, qty 1, Add to cart.
- Wrong-but-right: a run that "succeeds" with the towels missing, or with no replay.

## Stage 2 — exploration (grouped; **Shown**: steps, trace)

| # | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- |
| 0-8 | start, store | navigate, dismiss, `store1` refused `handle_not_in_packet`, snapshot, `store2`, `store3`, search x2 | | chip Millbrook (`00008`) |
| 9-17 | items | detect x2; amendment unchanged; `openpt`, `size250`, `addnap` `blocked_by_dialog`, dismiss, `addnap2`, `cart1` | | ok |
| 18-23 | towels | snapshot; rerun d16 `target_not_found`; `ptsearch`, `openpt2`, `addnap3`, rerun d22 | | ok |
| 24-25 | complete x2 | dry runs 1-2 | 1: **3, 7, 12, 16 unreproducible; 13, 15 failed**; 2: 3, 7 unreproducible, 15 failed | `dry_run_refused` |
| 26-27 | finish | amend d3/d15/d16 (2 applied; 16 refused `run_by_the_loop`), rerun d3; `complete` | dry run 3: **7 unreproducible, 15 failed** | **accepted** |

- Repeats: none; 27 decisions (wH in).
- Rejections: `run_by_the_loop` on d16 (a step the loop itself ran).
- Context: instructionBytes 1019 → 772 → 177 (by design).

## Stage 3 — the proposed Flow (**Shown**: `authoredNodes`, 14 action nodes + 1 merge)

- s1 navigate; s2 chip "Carden Falls Supercenter"; s3 "Set as my store" list 3 of 4; s4 type Search; s5 Search; s6 link "Dinner Napkins, 100 Count" list 1 of 5; s7 swatch "250 Count $6.48"; s8 close ×; s10 "Add to cart"; s11, s12 navigate; s13 napkins link again; s14 "250 Count" again; s15 chip "Millbrook Crossing Supercenter".
- Divergences: **no paper-towel step at all**; napkins chosen twice, added once; no Pickup, no quantity; s15 ends by re-opening the chooser (`00020`).
- Kind: misread the page: the towel search (full name with "12 Double Rolls") returns "We couldn't find results" (`00018`), and s6 takes the first "Popular in your area" item.

## Stage 4 — replay (**Shown**: `actions`)

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| s1-s8 | yes | succeeded (0.57-0.88) | 197-2224 ms | 0 | - |
| s10 Add to cart | yes | succeeded, `scored-candidate` 7, conf 0.566 | 1014 ms | 0 | scored candidate |
| s11-s15 | yes | succeeded | 223-1372 ms | 0 | - |

- Success while doing nothing: the armed variant should break the Add to cart press; s10 instead "succeeded" on a scored candidate at 0.566, so the redesign was never detected and repair never ran (N6). Whether it pressed Add to cart or Buy now: NO EVIDENCE.
- Provider calls during replay: 0.

## Stage 5 — the answer

- Oracle `finalState: failed`; `records: not_declared` (**Shown**). Field comparison: NO EVIDENCE (no per-field output). From the screenshots: store Millbrook; towels never searched successfully (`00018`); cart contents at the end not shown.
- Verification: `unsure` x2 → `unverified`, `core.result.refutation_unconfirmed`, basis `model_unconfirmed` (**Shown**).

## Stage 6 — judgement and repair

- Judged: yes, but inconclusive; an `unverified` result does not trigger repair, so a wrong answer ended as `status: succeeded` (**Shown**: `flow-lane.json`). No repair, no persistence.

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| N5 | Build accepted with dry run 3 still showing 7 unreproducible and 15 failed; step 15 (a towel step) is absent from the Flow | NO EVIDENCE of owning file (acceptance rule) | a failing dry run never accepts | new |
| N3 | The search typed the full product name with size and got no results; the build moved on to a popular item | NO EVIDENCE (no empty-result check) | reject a search with an empty result list | new |
| N10 | An `unverified` judgement ends the run as success with no repair and no completeness check (towels act missing) | NO EVIDENCE of owning file | unverified + missing instructed act → refute | new |
| N6 | s10 Add to cart absorbed the armed redesign by a 0.566 scored candidate | NO EVIDENCE | effect check / confidence floor | new |
| I1 | Instructed act 2 (towels) missing yet the completion check passed | Core `flow-bootstrap/instructed-acts/check.ts` | check each act has a node | t174 |

The lane report's row 9 ("Flow succeeded ... unverified, so no repair") is confirmed; the missing towels are the reason the goal failed.

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 5 | Final cart vs expected, field by field | Lab playback-goal oracle writes a verdict only |
| 4 | Which control s10 pressed | action record lacks identity |
| Header | Verification calls filed as `repair` in `live-llm.json` | live-llm snapshot writer |

## UI review (screenshots read: `00008`, `00018`, `00020`)

- `00008` (mid-build): "Using core.run_node" (raw id) in panel and overlay; "22 steps so far".
- `00018` (Flow run): "Running step 5 of 15: node.bootstrap.e1180c89efeb5684.main.s5": raw node id; grant question with raw `create_new` ("105 actions ... 78"); page shows the empty search.
- `00020` (end): **"Run finished" with a green tick** in panel and overlay while the goal failed; store chooser left open; question still unanswered.
- Overlay: absent at 1, 2 and 13; flickering at 4, 8, 9, 12 (**Shown**).
- Defects: false success (`00020`); raw ids (`00008`, `00018`); grant prompt (`00018`, `00020`); stale setup card (all).
