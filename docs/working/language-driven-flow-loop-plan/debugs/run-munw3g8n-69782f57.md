# Run debug — `run-munw3g8n-69782f57` (lane A run 29)

Written after the fact by worker t174-w28 from the surviving bundle `test-runs/instances/t174-slot-1/run-munw3g8n-69782f57`:
`snapshots/flow-lane.json` (24 step records), `snapshots/live-llm.json`, the 97 `[FluxIQ build-trace]` lines in
`logs/core.log`, and the 8 UI-review moments (5 pictures opened). There was no decision dump and no kept Core workspace.
Parameters and page packets are screened, so they are NO EVIDENCE throughout (G1, fixed since by the lane's decision dump,
F12). Every call id in this run's trace prints as `-` (F9).

## Header

- Run id: `run-munw3g8n-69782f57`
- Scenario / variant / task: crossborder-marketplace / none / crossborder-marketplace-hub-to-cart (seed 7342)
- Command: the lane's Session 2 launcher, instance `t174-slot-1`, headed: `node scripts/lab/run-lab.mjs run crossborder-marketplace --live-llm --llm-profile production --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task crossborder-marketplace-hub-to-cart ... --llm-max-calls 64`. This is inferred from today's launcher less the later `KEEP_RUN_STATE` and `DECISION_DUMP` settings.
- Code under test: downstream `76e5e766` (dirty), Core `e75dcf29` (dirty). F7 (a navigation onto a robot check reports `needs_person`) is live. t197, P1 A, P1 B and F13 are not.
- Date, provider, model: 2026-09-30 09:15:11-09:17:29 UTC (loop 09:15:51-09:17:20, 89 s), deepseek, deepseek-flash, production profile
- Provider calls, tokens, cost: 23 calls (all build), 331,222 in / 2,566 out, **$0.0328** (`observed.totalEstimatedCostUsd` 0.032751336)
- Verdict as reported: `failed`, `runtime.behavior`: "FluxIQ did not build a Flow from the task's instruction (flow_bootstrap.evidence_unusable_decision)", issue `bootstrap.instructed_act_missing`; no Flow created
- **Stage reached:** 2, exploration. No Flow was proposed, and the build made no press at all.

## Stage 1 — the instruction and the expected chain

Written by the lane lead before the run (2026-09-30 ~19:05 UTC).

- The instruction, verbatim: "On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official Store in my cart: Space Grey, the 7-in-1 version, shipped from Spain. Collect that store's coupon while you are on the item. Do not buy anything."
- The node chain a correct Flow must have:
  1. Navigate to the start location (Farbazaar home). A robot check is never pressed: a self-clearing one is waited out, any other is handed to the person.
  2. Type "Voltbay USB-C hub" in the search box and submit.
  3. Press the Voltbay USB-C hub listing sold by Voltbay Official Store (not the same hub from another seller).
  4. On the item page, choose colour Space Grey.
  5. Choose the 7-in-1 version.
  6. Choose ship-from Spain (the catalog's Poland origin of Space Grey 7-in-1 is sold out; China is another option).
  7. Set the quantity to 3.
  8. Press the store's coupon control (collect).
  9. Press "Add to cart". No "Buy now", no checkout.
- What a wrong answer that looks right would look like: the hub in the cart from the other seller; the default colour, version or origin (China) instead of Space Grey / 7-in-1 / Spain; quantity 1; the coupon not collected; a navigation-only Flow (runs 13, 15) accepted; a robot check pressed.
- Note on P1 B: the reader asks for `a1.quantity` (three), `a1.colour` (Space Grey) and `a1.version` (7-in-1); it does not read "shipped from Spain" as a choice, so the completion check will not demand the origin step. The goal check will.

## Stage 2 — exploration

The loop ran from 09:15:51 to 09:17:20: 23 decisions and 10 tool calls. What each decision was asked, and each call's
parameters (including every navigation address), are NO EVIDENCE (G1).

| # | Decided | Node | Result | Reason / note |
| --- | --- | --- | --- | --- |
| 0 | (Core's free look) | capture | `not_at_start_location` | expected |
| 1 | tool | navigate | succeeded | start location |
| 2 | tool | navigate | succeeded | changed |
| 3 | tool | navigate | succeeded | changed. Moment 3 (09:16:03): `/search`, 45 results for "Voltbay USB-C hub". The Voltbay Official Store card ("Ships from Spain") is the fourth in the first row. A "Welcome back, Mara!" coupon dialog and the cookie banner cover the page |
| 4 | tool | detect | detected | |
| 5 | tool | extract_list | inspect succeeded | 3.9 s; the read became draft step 4 |
| 6 | tool | detect | detected | |
| 7, 8 | tool (detect) x2 | - | `already_answered` x2 | |
| 9 | amend d4 | - | amended | |
| 10 | tool | detect | detected | 1.2 s |
| 11 | tool | navigate | **`needs_person`** | a robot check (F7). The refused navigation still became a draft step (revision 5 to 6) |
| 12 | complete | - | refused | `instructed_act_missing`. Dry run 1 still ran: 4 replays in 15.5 s, one `failed` |
| 13 | complete | - | refused | the same; dry run 2, 15.5 s, one `failed`. Moments 5 and 6 (09:16:43, 09:17:03) show the robot check during the dry runs |
| 14 | amend d3, d6 | - | amended | 2 applied; 1 step kept |
| 15 | tool | navigate | **`needs_person`** | the robot check again |
| 16 | complete | - | refused | dry run 3, 2 replays, 2.3 s |
| 17-23 | complete x7 | - | refused x7 | on an unchanged draft (revision 8), 1-2 s apart; the build ends `evidence_unusable_decision` |

- Repeats, and what the loop believed was progress: the build made 0 presses and 0 typed entries. Its only acts were 5
  navigations. It then sent 10 completions, the last 7 within 9 s on a draft that did not change. Each was refused
  `instructed_act_missing`.
- Rejections and refusals, and whether each said enough to route around: `needs_person` (11, 15) said a person was needed.
  The build did not hand the check to the person: it went on sending completions and navigations (t197's handoff did not
  exist yet). The act check's refusals named the missing acts only by code in this era's trace (G2), and the model did not
  change course after any of them.
- Where the context was evicted or truncated: nowhere. The draft stayed under 3,245 bytes, the guidance was intact
  (1,019 bytes), and no step was shown without input. This is the one run of the six where the draft entry cap played
  no part.

## Stage 3 — the proposed Flow

- Node list as authored, with real parameters: none. The last draft held 6 steps (navigations and one read).
- Divergences from the stage 1 chain:
  - Chain 2 (type and submit the search): replaced by a navigation to a search address (3). Whether that address had
    been shown is NO EVIDENCE.
  - Chain 3-9 (press the Voltbay Official Store listing, choose Space Grey, 7-in-1 and Spain, quantity 3, collect the
    coupon, add): all absent. The listing was on screen at moment 3 and was never pressed.
  - The two navigations that met the robot check (11, 15) had no counterpart in the chain.
- Misread the page / the grammar / could not express it: NO EVIDENCE which. Two things were in the way. The coupon dialog
  and cookie banner covered the results for the whole build, and the lane's run 36 dump later proved that every
  crossborder results packet held 0 result cards (40 of 293 elements). If this run's packets were the same, the model
  could not press a card it was never shown.

## Stage 4 — replay

Not reached. 3 dry runs ran on refused completions: 33.5 s, 10 replays (8 `replayed`, 2 `failed`). They reset to the start
and replayed the navigations, and in doing so they re-entered the robot check. The overlay read "Using core.run_node:
core.replay.replayed" over the check at moment 6, so a replayed navigation reported `replayed` while the page was the robot
check.

- Nodes that reported success while doing nothing: the replayed navigation at moment 6 (above).
- Provider calls during replay: none.

## Stage 5 — the answer

Not reached. The cart read 0 at every moment. At failure (09:17:26) the page was the home page, still under the coupon
dialog and the cookie banner.

## Stage 6 — judgement and repair

- Did the system judge its own result: there was no result. The build ended after 7 identical refused completions.
- Did a repair trigger: no. No Flow was created (lane cause 10). Under the lifecycle, the build gave up while a way
  remained: the Voltbay Official Store card was on the results page it had reached. It also did not hand the robot check
  to the person, which is the lifecycle's answer to a check it may not press.
- Repair context: not applicable.

## UI review (8 moments, `run-munw3g8n-69782f57.ui-review.local/`)

- Page overlay:
  - Absent at the first 2 moments, then present.
  - "Flickering" at moments 3 and 4 (2-3 text changes in 3 s), with presence toggles at 3 (2), 6 (1) and 8 (1) (U7).
  - Raw ids: "Using web.detect_repeating_structure: web.structure.detected", "Using core.run_node: core.replay.replayed"
    (U1, U10).
  - "Build failed / Build failed" at the end (U2).
- Over the robot check (moments 5, 6), the overlay said "Building your Flow / Using core.run_node". Nothing told the
  person that a check was waiting for them (U9).
- Side panel (old UI): the Simple/Advanced toggle (defect 1), status cards above the chat (defect 2), "Add an AI model
  key: To do" (U5), the unlabelled "Page | Full | Small | Off" control (defect 6). At failure it showed "Worked for 1m ·
  25 steps · 11 failed" for an 89 s loop that ran 10 tool calls (U12), with no reason and no next step (U8). All t191's.
- Page layers: the site's "Welcome back" coupon dialog and its cookie banner stayed open from the first results page to
  the end. The build never answered either.

## Causes

The number in brackets is the lane's "Top causes for the audit" item.

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| 1 | Navigate-only exploration. 0 presses in 23 decisions. The build reached the results by navigating to a search address and then navigated again (11, 15) instead of pressing the shown Voltbay Official Store card. Both of those navigations met the robot check. Whether their addresses had been shown is NO EVIDENCE [8]. | domain `node-run/shown-addresses.ts` (did not exist yet) | P1 A refuses unshown addresses | fixed if the addresses were unshown (P1 A); otherwise t174 (navigate-only exploration, as in run 19) |
| 2 | The result cards were likely not in the packet [1]. This is not established here (G1). Run 36's dump proved it for this task: 0 result cards in 40 of 293 elements. | extension element cap (the 40-control packet) | Remove the cap | **owned by t200** (if confirmed) |
| 3 | The coupon dialog and cookie banner covered the results all build [9], and the build never answered them. | extension `content/action-runtime/interference/` | R1+R2 | **t195** (validated on its branch) |
| 4 | The robot check [12]: F7 reported `needs_person` twice, but the build neither waited it out nor handed it to the person. It kept sending completions. | Core and extension (t197's handoff) | t197: never pressed, handed to the person | fixed (t197) |
| 5 | The build completed while not done, and gave up while a way remained [6]. 10 completions were refused `instructed_act_missing`, 7 of them in 9 s on an unchanged draft, ending `evidence_unusable_decision`. | Core `llm/evidence-loop` | Recorded | t193 C / evidence loop |
| 6 | Dry runs from the start mid-build [3]: 3 dry runs, 33.5 s, on completions the act check had already refused. The replays re-entered the robot check. | Core `llm/evidence-loop/completion-attempt.ts` | Author live, with no replay from the start | **owned by t196** |
| 7 | The draft is a transcript [4]: the refused `needs_person` navigations (11, 15) and a read (5) became steps. | Core `flow-draft` | Keep only the steps that did the work | **owned by t196** |
| 8 | No repair: no Flow was created [10]. | - | Fixing 1-5 | - |

The draft entry cap (t200's [2]) did not act in this run: the guidance was intact and every step kept its input.

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2, 3 (G1) | The navigation addresses, the packets (were the result cards and the coupon dialog in them?), and the draft's inputs | fixed since by the lane's decision dump (F12) |
| 2 (G2) | Which acts each refused completion claimed and lacked | Core `llm/evidence-loop/progress-trace.ts`; the decision dump (F12) records each verdict |
| 4 | A replayed navigation that lands on a robot check reports `replayed` (seen only through the overlay text) | Core dry-run replay (`flow-draft/dry-run.ts`), not established |
