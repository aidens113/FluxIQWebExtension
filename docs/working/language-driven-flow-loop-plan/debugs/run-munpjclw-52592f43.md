# Run debug — `run-munpjclw-52592f43` (lane B run 3)

Evidence root: `test-runs/instances/t193-slot-2/run-munpjclw-52592f43/`. **Shown** = read from the named
artifact; **Inferred** = my reading. Codes, counts and ids only.

## Header

- Run id: `run-munpjclw-52592f43` (**Shown**: `summary.json`)
- Scenario / variant / task: `bigbox-retail` / `redesigned-buy-box` / `bigbox-retail-pickup-cart-redesigned-after-creation` (**Shown**: `events.ndjson` seq 1)
- Command: NO EVIDENCE: the bundle does not record the command line (lane report: `--llm-max-calls 64`, `--evidence events`).
- Date, provider, model: 2026-09-30T06:11:35Z to 06:20:25Z; deepseek / deepseek-flash, authorized 64 calls (**Shown**: `summary.json`, `snapshots/live-llm.json`)
- Provider calls, tokens, cost: 64 calls; 1069745 in / 7026 out; **$0.1147** (`live-llm.json` `observed.totalEstimatedCostUsd` 0.11466414). Build 286927 ms.
- Verdict as reported: `failed`, `runtime.behavior`, `flow_bootstrap.evidence_unusable_decision`, issues `llm_evidence_loop.dry_run_refused`, `core.replay.failed`, `core.replay.unreproducible` (**Shown**: `flow-lane.json` `build.failure`)
- **Stage reached:** 2. 64 decisions, 30 tool calls, eight completion attempts, no Flow.

## Stage 1 — the instruction and the expected chain

Copied from `reports/t193-live-self-repair.md` "Stage 1" (bigbox). Instruction: "Switch my pickup store to
Millbrook Crossing Supercenter, then add two packs of the ValueRidge Essentials Select-A-Size Paper Towels in
the 12 Double Rolls size and one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count size to my
cart, both for pickup. Keep what is already in my cart as it is, and do not check out."
1. Store chooser → "Set as my store" on Millbrook Crossing Supercenter, first.
2. Towels page → "12 Double Rolls", Pickup, quantity 2 → Add to cart.
3. Napkins page → "250 Count", Pickup, quantity 1 → Add to cart. No checkout. Final: soap kept + 2 towels + 1 napkins, "4 items · Subtotal $43.39".
- Wrong-but-right-looking: Buy now; adding before the store switch; 1 towel pack; a repair that "passes" with no replay.

## Stage 2 — exploration (grouped; **Shown**: `flow-lane.json` `build.evidenceLoop.steps`, call ids from `logs/core.log` build trace)

| # | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- |
| 0-3 | start | navigate, dismiss privacy, open store chooser | `nav.start`, `dismiss.privacy`, `open.store.picker` | open refused `target_unobserved/handle_not_in_packet` |
| 4-12 | find the chooser | 2 snapshots, then 7 repeats (5, 7-12) | `observe.page.1/2` | `already_answered` x7 |
| 13-24 | switch store | opened chooser twice, `pick.millbrook` (13-15), detect x2, extract x2, `pick.millbrook.2` | `dom-click` x5 succeeded | chip never became Millbrook (see UI) |
| 25-38 | add items | search towels, open towels product (36 `target_not_found`, 37-39 ok), navigate, open napkins 250 | `search.paper.towels.34`...`open.napkins.250.43` | page changed each time |
| 39-56 | tidy the draft | 15 amendments; #41 targeted 15 steps, applied 9, kept 1; #46 add napkins `blocked_by_dialog`, #47 dismiss, #48 add, reruns d38, d42 | `add.napkins.cart.47/49`, `rerun.38/42` | draft rev 32, 22 steps, 8 without input |
| 57-64 | complete | `complete` x8, draft unchanged between them | dry runs 1-8 | each: reset ok, 2 ok, **40 failed (~3.9 s), 41 and 43 unreproducible (~5.4 s)** → `dry_run_refused` |

- Repeats: 13 `already_answered` (5, 7-12, 18, 20, 21, 25, 26, 32). The lane report says "decisions 6-13"; the steps show 5 and 7-12 (seven), plus six later.
- Rejections: `handle_not_in_packet` (3), `target_not_found` (35), `blocked_by_dialog` (46); each dry-run refusal names only codes, and the model resubmitted the identical draft 8 times (**Shown**: draft rev 32 through 57-64).
- Context: instructionBytes 1052 → 618 (37) → 154 (39-64): by design, cause E refuted in the lane report.

## Stage 3 — the proposed Flow

- Not reached: `stoppedAt: "build"`, no `authoredNodes` (**Shown**). The final draft kept 4 steps d2, d40, d41, d43 (**Shown**: `draftChange` #50/#52); none is a store switch or towel add (**Inferred**).
- Divergences / misread: the store pick landed on the wrong store (misread the page, cause F); towels never reached the cart (**Inferred** from UI).

## Stage 4 — replay

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| - | not reached | - | - | - | - |

- Success while doing nothing: `pick.millbrook` and `pick.millbrook.2` reported `web.action.succeeded` but the chip still read Carden Falls Supercenter afterwards (`00009`, `00020`) (cause F/F2).
- Provider calls during replay: not reached.

## Stage 5 — the answer

- Not reached; no Flow ran. Count-only comparison: not reached.

## Stage 6 — judgement and repair

- Not reached; the armed variant's repair was never exercised.

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| F | Confirmed: the store picks "succeeded" on the wrong store; the header chip read Carden Falls Supercenter through `00009` (06:17:17) and `00020` | extension `content/repeat-exemplars.ts`; domain `runtime/llm-evidence/look-alikes.ts` (per report) | fixed (wE) | t193 |
| F2 | Confirmed: the press result gave no sign the chip still named another store, so the build went on | domain `runtime/llm-evidence/press.ts` (per report) | recommendation | t193 |
| C | Confirmed, corrected count: 13 `already_answered` repeats, not "6-13" | Core `llm/evidence-loop/answered-request.ts` (per report) | not fixed | lane A |
| D | Dry-run steps 41 and 43 `unreproducible` and 40 `failed`, identical in all 8 dry runs | domain `node-run/replay.ts` (per report) | not fixed | t174 |
| N1 | Eight identical `complete` decisions (57-64) on an unchanged draft; the loop let the model spend its last 8 calls re-submitting and ended at 64 = authorized calls | NO EVIDENCE of owning file (no-progress guard does not count identical completions) | count a resubmitted unchanged draft as no progress | new |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | Which node draft steps d40, d41, d43 are, and why step 40 failed | step records carry no `dN` → node map or replay reason |
| 2 | Which store button each pick pressed | trace records call ids only |
| Header | Command line | NO EVIDENCE of owning file |

## UI review (screenshots read: `00001`, `00009`, `00020`)

- `00001` (dispatch): panel is the old card layout: Simple/Advanced toggle, "Get set up" card saying **"To do: Add an AI model key"** while a live key is in use, "Nothing running", "Describe an automation" button. No chat stream, no composer at the bottom.
- `00009` (mid-build, 06:17:17): "RIGHT NOW **Done** · Last step: Looked at the page" while the build is running: status wrong. No on-page overlay visible while FluxIQ works. Chip: Carden Falls Supercenter.
- `00020` (end): unchanged "Done"; no failure shown to the user at all; no overlay.
- Defects: not chat-first (all three); stale "Add an AI model key" (all three); status "Done" during work (`00009`); no overlay (all three); failure never surfaced (`00020`).
