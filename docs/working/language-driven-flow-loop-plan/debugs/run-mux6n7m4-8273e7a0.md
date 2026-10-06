# Run debug — run-mux6n7m4-8273e7a0 (lane A round 3, t262-slot-2)

Written as `run-pending-t262-slot-2-a-r3.md` before launch; renamed to the run id when the Lab assigns it.
Everything in "Expectations" was written before launch (2026-10-06 ~21:20 UTC, off-peak).

## Header

Lane A, Phase 1 live round 3. Task `crossborder-marketplace-hub-to-cart` (scenario `crossborder-marketplace`,
kind form, judged by playback goal `hub-in-cart`). Instance `t262-slot-2`, slot 2, persistent workspace `t262-a`,
tree `fxwork/t262/!FluxIQWebExtension` at f224b38a (dev 7880abda is docs-only ahead), Core `fxwork/t262/!FluxIQ`
at e1551fa3 = Core dev. Both trees clean before launch; the supervisor rebuilt them at ~21:10 UTC; the Lab dry-run
rebuilt the instance's host module and extension bundle. Previous lane A runs: round 1 `run-muw60unq-591e23bd`
(origin choice unread; fixed), round 2 `run-muwaobm2-882cadd9` (the amend/rerun loop; fixed by r3-a-loop).

## Expectations (written before launch)

Instruction, verbatim (219 characters, sha256 2e6f5e7d...a405 per the dry-run):

> On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official Store in my cart: Space Grey, the
> 7-in-1 version, shipped from Spain. Collect that store's coupon while you are on the item. Do not buy anything.

Acts the reader must give: `a1` put with choices `a1.quantity` three, `a1.colour` Space Grey, `a1.version`
7-in-1, `a1.origin` Spain; `a2` collect.

Command (the campaign's; `--max-attempts 1`, so no second paid attempt):

```text
FLUXIQ_LAB_INSTANCE=t262-slot-2 FLUXIQ_TEST_ENV_FILES=none
pnpm.cmd lab:campaign crossborder-marketplace-hub-to-cart --max-attempts 1 -- --target persistent-isolated --workspace t262-a
```

Dry-run (21:18 UTC): `status ready`, `providerCallCount 0`, lane created-flow, buildEntry chat,
persistent-isolated, deepseek-flash, maxCalls 48, maxEstimatedCostUsd 0.1 (= maxTotalEstimatedCostUsd),
permittedConsequences [], key DEEPSEEK_API_KEY from `.env.local`.

Actions a correct Flow takes, in order:

1. Navigate to the Farbazaar start page.
2. Dismiss the welcome popup and the consent layer (optional steps).
3. Search for the Voltbay USB-C hub and open the Voltbay Official Store item.
4. Space Grey is preselected: no press; the choice is named on the step after which the page shows it chosen.
5. 7-in-1 (claims `a1.version`) and Spain (claims `a1.origin`), each performed in the build test.
6. Collect the store coupon (`a2`; a page-busy refusal may need one retry).
7. Quantity 3 (`a1.quantity`), a real performed setting.
8. Add to cart (`a1`), once; never Buy now, never checkout.

Exact oracle facts (playback goal `hub-in-cart` plus final state):

| Fact | Subject | Expected |
| --- | --- | --- |
| cart-line | mini-cart-line text | Voltbay hub line: Voltbay Official Store, Space Grey, 7-in-1, ships from Spain, qty 3 |
| store-coupons | coupon flyout text | Voltbay Official Store coupon collected |
| cart-count | mini-cart-count | 3 |
| orders-shipped | orders summary | 0 |

Wrong plausible answers: China origin; coupon but empty cart; wrong store, colour, version or quantity; Buy now
pressed; an unfinished draft called a saved Flow.

New on this source, each to be checked in the debug:

- N1 lane A loop fix (Core `68c4c9a7`): an amend decision re-sent after its rerun changed nothing, or failed on
  an unchanged draft, is refused unrun (`same_amendment`), counts toward the refused-in-a-row stop; decision
  history rows say "unchanged"/"refused", never "applied", for such work; an unchanged rerun is not progress;
  a rerun that changes a step's node drops the old node's parameters. **Must be seen: no loop of identical
  amend/rerun decisions.**
- N2 B's keep-only answer: a keep-only decision is told "keep adds nothing".
- N3 frame-stable digest `web-state.v4` (downstream `c16895b2`): the same page after a reload digests the same, so
  repeat refusals and no-progress fire across resets.
- N4 t278: `checked` rows reach a node repair (only if a post-run check refutes).
- N5 C's `judgement.whereToFix` sentence in a repair instruction ("look and detect there, not on the page the test
  left"), if a repair round opens. The paging hint does not apply to A (no list).
- N6 D's `strands_a_step` refusal and `unreached` note (`llm_evidence_loop.draft_step_unreached`) if an edit
  would strand a kept step; D2-2 does not apply (no list read).

Cost: under $0.10 per build; at most 48 build calls.

UI checkpoints (round-2 set plus t277's "what the next live UI review must see"):

- U1 start: the instruction as a user turn in the new project's chat; composer at the bottom. Known, not a panel
  defect: the Lab's kept profile may show the previous run's thread before the project is selected (R2-U-10).
- U2 mid-build: one assistant message per step with its reason; action cards with icon, target and outcome; edit
  cards say what changed; repeated refusals folded into one card "... Not done (N times)" (R2-U-7).
- U3 overlay: visible whenever FluxIQ works; text stable and matching the panel; "Starting…" with the overlay from
  the send (R2-U-5); no absent sample 100 ms or more after a new document (R2-U-11); never "Couldn't fix your
  Flow" during a build.
- U4 words: no "Step N", "the judge", "next call", "extraction", "dedup" in thoughts or cards (R2-U-4); no card
  or thought cut at "(e.g." or glued to the next sentence (R2-U-3); a check card says the count and why, never a
  bare "Didn't pass" (R2-U-1); a refusal is never "it wasn't on the page" (R2-U-6).
- U5 ending: whole, plain; a pass says the Flow is saved and tested. Known open: dollar bookkeeping in a
  budget-exhausted ending (R2-U-2 not landed).
- U6 playback: run status, Add to cart done, result shown.

Replays (only on a pass): two `lab replay` runs on `t262-a` with the build's project and Flow ids (from
`snapshots/creation-context.json`), no provider key in the environment: zero provider calls, zero interventions,
zero harness activations, unchanged Flow hash, `playbackGoalHeld` true. Then a second independent live pass.

## Result (written by the lane A lead from the run folder, 2026-10-06 ~21:35 UTC)

**Passed.** `run-mux6n7m4-8273e7a0`, verdict passed, oracle passed, result check `confirmed`, 0 harness
activations. Launched 21:20 UTC (off-peak); instruction sent 21:23:45, build ended 21:25:45, playback judged
21:26:29. 32 provider calls, $0.040481 in total; the build $0.038386 of the $0.10 ceiling (`snapshots/live-llm.json`
`observed.perBuild`), runtime $0. Ledger `finish` line recorded it (`lab.live-guard` "recorded").

Oracle facts (all `held`, `snapshots/flow-lane.json` `oracles.facts`):

| Fact | Observed |
| --- | --- |
| cart-count | `Cart (3)` |
| orders-shipped | `Orders to be shipped (0)` |
| cart-line | `Voltbay Official Store · Voltbay USB C Hub ... · Space Grey · 7-in-1 · Ships from Spain · × 3` |
| store-coupons | `Store coupons: Voltbay Official Store 2,00 € off orders over 25,00 €` |

Authored Flow (13 nodes, 11 actions; playback order): navigate start page; No thanks (welcome popup); type
"Voltbay USB-C hub" + Enter; open the Voltbay Official Store item (new tab); Reject non-essential (consent); 7-in-1
(`a1.version`); Spain (`a1.origin`); Quantity 3 (`a1.quantity`); **Space Grey (s11, `a1.colour`)**; Add to cart
(`a1`); Get coupons (`a2`). Never Buy now. Build test: the two popups and Space Grey `remembered`, 7-in-1, Spain and
Quantity `replayed` (performed), Add to cart and Get coupons `verified` (lasting, not pressed).

Exploration, 25 decisions: the reader gave `a1.origin` (round-1 fix holds). The model's first Space Grey press
(0017) un-chose the preselected colour (Core said so: "This press un-chose "Space Grey""); two reruns of that step
(0019, 0031) un-chose it again, because each rerun puts the page back with Space Grey chosen; Add to cart was then
refused by the page ("Please select a Color.", 0044); a second Space Grey press (0045) chose it and Add to cart
worked (0049). The model dropped the first press and reordered the second before Add to cart (0050, 0052), collected
the coupon (0054; the first try at 0014 was page-busy), dropped the stale coupon step, and completed (0060).

New-on-this-source checks:

- N1 (A loop fix): **seen fixed.** No identical amend/rerun decision was re-sent; amendments 0019, 0031, 0047,
  0050, 0056 applied, 0041 refused (`act_already_named`, `no_such_step`), 0052 partly (`already_out`), 0058 refused
  (`already_out`, stepsWithoutProgress 0 -> 1). In 0060's decision history the refused rows carry their codes and
  `changed: no` (rows 16, 24); the partly applied row 21 carries `already_out` with its refused part. No row says
  "applied" for refused work. `same_amendment` did not fire (nothing to fire on: the one re-sent rerun, 0031, came
  with a drop, so it was a different decision on a changed draft).
- N2 keep-only: not exercised (0041 was keep + add, refused on its own reasons).
- N3 `web-state.v4`: not observable here (no repeat refusal across a reset).
- N4 t278, N5 `whereToFix`: not exercised (no refuted check, no repair round).
- N6 `strands_a_step` / unreached note: not exercised (three drops, none stranding a step).

**Finding F1 (latent; the pass leans on it).** The kept Space Grey step (s11) is a toggle press recorded while the
colour was un-chosen. On a fresh page Space Grey is preselected, so actually pressing it would un-choose it and Add to
cart would be refused. It never runs: its target is never found after a reload, neither in the build test
(`core.replay.remembered`, "the step's target is gone from the page it acted on") nor in playback (step 0083
`skipped`, `state_routed`, `web.target.not_found`: "nothing matched; 0 control(s) of the same family are on the
page"), although that page view lists `t76 clickable "Space Grey" marked`. The swatch is `<div class="swatch"
title="Space Grey"><img alt=""></div>` under a group whose id rotates per load
(`apps/scenario-lab/src/scenarios/crossborder-marketplace/markup/item.ts:57`); the recorded target is `{tagName: div,
accessibleName: "Space Grey", selector: "#<rotating id> > div:nth-of-type(2) > div:nth-of-type(1)"}`. The selector
cannot match after a reload, and the fingerprint fallback (`apps/extension/src/content/action-runtime/resolve-target.ts`
`fingerprintMatches`: stable half via `findClosestFingerprint`, text fallback only on `visibleText`) does not find a
title-named div. Two defects cancel: the build kept a toggle press whose effect depends on the start state, and the
resolver cannot re-find a title-named control. A Flow that must choose a non-default swatch would fail playback.
Cause trace in progress (see the lane report).

UI review (11 moments, `run-mux6n7m4-8273e7a0.ui-review.local/`):

- U1: moment 1 shows the previous run's thread before the Lab selects the project (known R2-U-10, Lab-side). Its
  old text holds "The Flow so far was ke." (an old ending, not this run).
- U2: one message per step with its reason; cards with icon, target and outcome ("Already done on the site",
  "Checked, not pressed", "Working on it"); edit cards say what changed ("Done: removed "Space Grey"; added "Add to
  cart"", "Only partly done: that step is already out of the Flow"). **Gap:** the rerun card "Click · Space Grey /
  Done" (moment 5) hides that the press un-chose the colour.
- U3 overlay: present and visible in every moment from the first build step (16/16 in moments 3-8, 10, 11); texts
  plain and matching the panel. **Gap (R2-U-5):** at moment 2, 3 s after the send, the panel said "Sending your
  message" and the overlay was absent until ~4.7 s after the send (first sample "Building your Flow"); t277 expected
  "Starting…" with the overlay from the send. No absent sample after a new document.
- U4 words: no "Step N", "the judge", "next call", "extraction" in thoughts or cards. **Gaps:** the act-list
  sentence quotes "...shipped f..." (cut mid-word, moment 4); the check card says "Passed: no rows would be stored"
  (build) and "Passed: no rows came back" (run) on a cart task that reads no list.
- U5 ending: whole and plain: 'Your automation "Add 3 Voltbay USB-C hubs to cart" is ready: I tried its steps on the
  page you had open and put the ones that worked into it.'
- U6 playback: "Running step N of 11" in panel and overlay; "Skipped clicking "Space Grey": the page is already past
  it" (wording for F1's unresolved target); the coupon's page-busy try shown in red "Didn't work: the page was busy",
  then "Trying the step again", done; check result; "Run finished".

Replays (both `pnpm.cmd lab replay crossborder-marketplace --workspace t262-a --project
69101ebf-4e4d-4b12-aa8b-fc86bcfc8dc9 --flow flow.f2895f58-5bb5-48e2-8176-eb8b2a9b91a7 --instruction-task
crossborder-marketplace-hub-to-cart`, `FLUXIQ_LAB_INSTANCE=t262-slot-2 FLUXIQ_TEST_ENV_FILES=none`, no provider key
in the environment):

| Replay | Verdict | Calls / interventions / harness | Flow hash before = after | Goal held | Actions |
| --- | --- | --- | --- | --- | --- |
| `replay-mux70ks8-42b807a0` (21:30-21:31) | passed | 0 / 0 / 0, `modelProvidersEnabled: false` | `cc95809e...e1cf1a` | true | 14; Space Grey skipped, coupon failed once (page busy) then succeeded |
| `replay-mux72fiq-dbf45610` (21:32-21:33) | passed | 0 / 0 / 0 | `cc95809e...e1cf1a` | true | same |

F1 cause trace (worker, read-only, citations spot-checked by the lead):
`docs/working/mvp-final-month-plan/reports/live-a-r3-f1.md`. Resolver: `apps/extension/src/content/element-finder.ts`
`findClosestFingerprint` matches a name only by `aria-label`/`name` (never `title` or `accessibleName`), and
`content/identity/candidates.ts:118-121` `CANDIDATE_SELECTOR` lists no script-bound plain div, hence "0 controls of
the same family". Build: Core `flow-draft/reversal.ts:62-63` skips an un-chose/chose pair with kept steps between
them, so the "chose" press recorded from a state only the dropped press made stays in the Flow. Fixing the resolver
alone would turn this Flow into a failing Add to cart, so the resolver fix and the replay-verdict fix land together.

The second independent live pass failed: `run-mux74k5q-1c3c2127` (see its debug).
