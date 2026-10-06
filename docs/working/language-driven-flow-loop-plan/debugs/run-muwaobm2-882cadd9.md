# Run debug — run-muwaobm2-882cadd9 (lane A round 2, t262-slot-2)

Written as `run-pending-t262-slot-2-a-r2.md` before launch and renamed when the Lab assigned the id. Everything in
"Expectations" was written before launch.

## Header

Lane A, Phase 1 live round 2 on dev with the round-1 fixes. Task
`crossborder-marketplace-hub-to-cart` (scenario `crossborder-marketplace`,
kind form, judged by playback goal `hub-in-cart`). Instance `t262-slot-2`,
slot 2, persistent workspace `t262-a`, tree `fxwork/t262/!FluxIQWebExtension`
at 624c7a70 = dev, Core `fxwork/t262/!FluxIQ` at 9fd634d3 = Core dev
(contains 32b4e37c, the origin-choice fix). Previous run: round 1
`run-muw60unq-591e23bd` failed (no Spain choice, Spain and Add to cart fought
for a1). Earlier pass on older source: `run-mutepu6b-656f8882`.

What is new on this source for A: Core reads "shipped from Spain" as choice
`a1.origin` (value Spain); lane B's per-step-changes judge fix; lane C's
judge fixes; lane D's afterWithheld fix; t276 UI fixes (edit cards say what
changed, endings whole and plain, build headline instead of "Couldn't fix
your Flow").

## Expectations (written before launch)

Instruction, verbatim (219 characters):

> On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official
> Store in my cart: Space Grey, the 7-in-1 version, shipped from Spain.
> Collect that store's coupon while you are on the item. Do not buy anything.

Acts the reader must now give: `a1` put, with choices `a1.quantity` three,
`a1.colour` Space Grey, `a1.version` 7-in-1, `a1.origin` Spain; `a2`
collect. 6 things asked. If `a1.origin` is absent from the first decision
request, the fix did not reach this build and the run measures nothing new.

Command (the campaign's; `--max-attempts 1` so no second paid attempt):

```text
FLUXIQ_LAB_INSTANCE=t262-slot-2 FLUXIQ_TEST_ENV_FILES=none
pnpm.cmd lab:campaign crossborder-marketplace-hub-to-cart --max-attempts 1 -- --target persistent-isolated --workspace t262-a
```

Expected plan (dry-run to confirm): lane created-flow, buildEntry chat,
persistent-isolated, deepseek-flash, maxCalls 48, maxEstimatedCostUsd 0.1 per
build, permittedConsequences [], key DEEPSEEK_API_KEY from `.env.local`.

Actions a correct Flow takes, in order:

1. Navigate to the Farbazaar start page.
2. Dismiss the welcome popup and the consent layer (optional steps).
3. Search for the Voltbay USB-C hub and open the Voltbay Official Store item.
4. Space Grey is preselected: no press (pressing it clears it); the choice
   is named on the step after which the page showed it chosen.
5. 7-in-1 (claims a1.version) and Spain (claims a1.origin), each performed
   in the build test.
6. Collect the store coupon (a2; a page-busy refusal may need one retry).
7. Quantity 3 (a1.quantity), a real performed setting.
8. Add to cart (a1), once; never Buy now, never checkout.

The Spain press must claim `a1.origin`, not `a1`; the build test must show it
`replayed` (performed), not `verified`. Add to cart and the coupon may be
withheld in the build test (lasting) and then performed in playback.

Exact oracle facts (playback goal `hub-in-cart` plus final state):

| Fact | Subject | Expected |
| --- | --- | --- |
| cart-line | mini-cart-line text | the Voltbay hub line: Voltbay Official Store, Space Grey, 7-in-1, ships from Spain, qty 3 |
| store-coupons | coupon flyout text | Voltbay Official Store coupon collected |
| cart-count | mini-cart-count | 3 |
| orders-shipped | orders summary | 0 |

The header badge is stale by design; judge the cart by the four DOM facts.

Wrong plausible answers: China origin in the cart line; coupon but empty
cart; wrong store, colour, version or quantity; Buy now pressed; an unfinished
draft called a saved Flow.

Cost: under $0.10 per build; at most 48 build calls.

UI checkpoints:

- U1 start: the instruction as a user turn in the new project's chat;
  composer at the bottom; no getting-started screen.
- U2 mid-build: one assistant message per step with its reason; action cards
  with icon, target and outcome; **edit cards say what changed** ("Done:
  removed step N, ..."), never a bare "Edit the Flow · Done".
- U3 overlay: visible on the page whenever FluxIQ works on it; text stable,
  matching the panel; **never "Couldn't fix your Flow" during a build**.
- U4 ending: plain and whole, with no mid-word cuts, no raw handles (t958),
  no repeated sentence; a pass says the Flow is saved and tested.
- U5 playback: run status, Add to cart done, result shown.
- U6 refusals and permission questions shown plainly as refusals.

Replays (only on a pass): two `lab replay` runs on `t262-a` with the build's
project and Flow ids (from `snapshots/creation-context.json`), no provider
key in the environment: zero provider calls, zero interventions, zero harness
activations, unchanged Flow hash, `playbackGoalHeld` true.

## Result (written 2026-10-06 by the supervisor, from the run folder and the round-2 root-cause trace)

Failed, `runtime.behavior`, no Flow saved. One build, estimated $0.083775 of the
$0.10 ceiling (`snapshots/live-llm.json`); 121 logged steps, 26 of them model
decisions.

- The round-1 fix reached the build: the first decision request
  (`steps/0003-decide/request.txt`) lists choice `a1.origin`.
- The cause was the loop the user watched. From decision 0052 on, the model
  re-sent an amendment to draft step 14 that was refused, nine rounds in all
  (0060-0092). Each of those decisions also carried a rerun, which was
  applied, so the decision-history row read "applied" and dropped the
  refusal; `stepsWithoutProgress` stayed 0, the no-progress guard never
  fired, and every rerun replayed the draft's clicks until the purse ran out.
- A second defect in the same decisions: a rerun that changed step 14's node
  kept the old node's parameters (`text: "3"`, `submit: false`), so the
  replacement could not have worked (fixed in the tree:
  `reports/live-a-r2-fix-rerun-node.md`).

| Cause | Where | Fix | State |
| --- | --- | --- | --- |
| Decision history records a refused amendment as applied when the batch also applied a rerun; refused or no-change work counts as progress | Core `R/llm/decision-context/`, `R/llm/decision-handlers/amendment.ts`, `R/llm/repeat-guard/`, `R/llm/evidence-loop.ts` | History rows carry refused parts and real change; an identical refused or no-change amendment is refused before it runs and counts as no progress | brief r3-a-loop (2026-10-06) |
| A rerun that changes a step's node keeps the old node's parameters | Core `R/llm/evidence-loop/rerun-input.ts` | Drop the stored parameters when the node changes | done in tree, verified under r3-a-loop |

Expectations not reached: no Flow, so the oracle facts, playback and
replays were not exercised. UI checkpoints U2/U6 (refusals shown as
refusals) are the ones the loop touched; see t277 for the round-2 UI work.
