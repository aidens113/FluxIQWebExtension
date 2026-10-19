# Auction seller-shop whole run and separate saved replay

Status: accepted. The whole run passed its oracle and a separate provider-free replay of the saved Flow passed with zero calls, zero cost, no harness activation and an unchanged Flow hash.
Task: `auction-marketplace-lens-hood-seller-shop` (scenario auction-marketplace, workflow lens-hood-seller-shop).
Run: `run-mvecxd6w-ed72a1ca`, workspace `codex-auction-shop-t566-20261018-r1`, instance bf-slot-3, target persistent-isolated.
Source: downstream e13c6d57 with the paired t566 Core worktree. No source, task, fixture, oracle or guidance edit was made for this run or this debug.

## What the build did

The build started from the real extension chat (one person turn, no permission or clarification asks) and ended "created" after about 420 seconds. Steps are in `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-18/run-mvecxd6w-ed72a1ca/steps` (118 step folders).

1. The supervisor read the task, checked the page, wrote a two-part plan and dispatched brief 1 (`find_hood`).
2. Brief 1 explored live: dismissed the cookie banner, searched for the Kestrel 35 lens hood, opened the standalone hood listing (not the camera set that includes a hood) and read the seller link (`the_camera_loft`). Its first submission was refused as an invalid evidence completion plan, the second was accepted, and its subflow trial was judged yes (steps 0017 to 0024).
3. Brief 2 (`list_shop`) bound the shop navigation to an input taken from the seller link (`url: $input.shopUrl`). Its trial stopped at "open the seller's shop" with `web.browser.permission_denied` ("A permission or policy refused the step", not retryable), reported as `candidate.execution_incomplete` (step 0035). Its resubmissions were unchanged and the repeat guard refused them (steps 0037 to 0043).
4. The supervisor dispatched repair brief 3. It hit the same `permission_denied` on two trials (steps 0060, 0064), then three `page_unreadable` page searches, and the repeat guard refused the rest.
5. Repair brief 4 tried once more with the input-bound address (same refusal, step 0089), then wrote the shop address as a fixed URL. That trial ran but was judged no because the stored rows had a title column and no price column (step 0093, diagnosis at 0094). It added the price field, the next trial stored 8 rows and was judged yes (steps 0097 to 0101).
6. The supervisor assembled the candidate, its whole-Flow trial from the start was judged yes (steps 0104 to 0108), and the Flow was promoted: 11 nodes, 8 actions (3 navigations, 2 clicks, 1 type, 1 single-value read, 1 list read).

## Judged whole run and oracle

Whole run `1a20c212-6fee-4f98-b308-9126c8923101` succeeded, Core result verification "confirmed", reported verdict passed (steps 0110 to 0117; the search step cleared one "Not now" dialog on its own). The Lab's record oracle judged the list read at step index 12: 8 of 8 expected records, 8 matched in order and in any order, 16 of 16 fields present, 0 unexpected fields, 0 non-string values, 8 collected. The four account facts (watch list, bids, purchases, followed sellers) were unchanged. Evaluation verdict passed, flowCreated true, oracle passed.

Cost: build accounting 1,067,921 tokens, $0.0307722; with the after-run check ($0.000612324) the run total is about $0.0316 (59 observed calls). This is the Lab's reported figure and was not separately reconciled against the canonical ledger.

## The two harness activations and why they happened

The evaluation records `harnessActivations: 2`: one `diagnosis` and one `runtime_patch`, with adaptation `adaptation.abf28de22efd1b2c2fdc4151b9212871d0a1288f9f426770bc913b7f8d4729d6` applied as revision 1 to 2.

They were not a repair of a failure. The whole run had already succeeded with no failure and no recovered or bypassed failures. The only model call in this phase is step 0118, the after-run `loop_verification` check ($0.000612324, the whole `adaptationCost`). It answered "Nothing to change", `answersRequest: yes`, `patchNeeded: false`. The runtime patch then recorded a provisional adaptation and a revision bump without changing the Flow: the repair lane shows the saved Flow's content hash, steps hash and all four graph hashes identical before and after (`e831225d...` for the main Flow, matching the creation-context `savedFlowHash`), with `alreadyApplied: true` and `changeRecorded: "revision"`. The in-run follow-up replay `296dbea6-6f16-4ffa-a315-af246c6b6b6b` then ran with 0 provider calls and 0 harness activations and passed its goal.

So the count of 2 comes from how the after-run check and its no-change revision are classified, not from the Flow needing help. Whether a "nothing to change" verdict should count as a harness activation or create a revision is an open question for the owner of harness accounting; I did not inspect the adaptation's stored content beyond these hashes.

## Concern for the supervisor: fixed shop address

The accepted Flow still reads the seller link, but its `open the seller's shop` step navigates to a fixed address that names this seller, because every attempt to navigate to the address read from the page was refused with `web.browser.permission_denied`. The oracle passes because the fixture's seller does not change, but the Flow does not derive the seller at run time. The refusal of a navigation whose URL comes from page data looks like the root cause and is worth a separate diagnosis; this debug does not claim to have found its owner.

## Separate provider-free saved replay

Replay `replay-mvfllkon-e7a35190` ran on 2026-10-19 from 18:38:34Z to 18:39:52Z (wrapper `node_modules/codex-auction-shop-replay.mjs`, log `node_modules/codex-auction-shop-r1-replay.log`, receipt `test-runs/instances/bf-slot-3/replays/replay-mvfllkon-e7a35190.json`, exit code 0). It used the existing Lab replay entry (`run-lab.mjs replay auction-marketplace`) on the same workspace, instance bf-slot-3 and target persistent-isolated, with every provider secret variable blank, the build cache off and the default headed browser. The prelude reused all seven builds.

- Verdict passed, reasons none, `playbackGoalHeld` true.
- Project `7c64c7f0-317f-45bd-b934-322868b3c29e`, Flow `flow.1f2bf956-9e4a-4651-beca-b9a33a0c0069`, task `auction-marketplace-lens-hood-seller-shop`, served at the saved address (port retained).
- Flow content hash before and after: `e831225d2fe92b4dab818fc7908a534717aea53826c957c4e394be626380facc`, unchanged, and equal to the creation-context `savedFlowHash` of the run.
- Model: providers disabled, run intent none, Core provider call count 0, accounted calls 0, calls 0, interventions 0, harness activations 0, model gate not invoked, stored provider keys preserved (1 before, 1 after). Cost is $0: with accounting present, the replay owner (`packages/test-runner/src/saved-flow-replay/provider/free-accounting.ts`) fails the replay unless calls, tokens, estimated cost, breaches and pending calls are all exactly 0, and it reported no failure.
- Runtime run `3661cd90-12c5-4b03-bec3-0a4b8ceae49e` succeeded with 13 actions, including the cookie-banner handler.
- Record oracle at step index 12: 8 of 8 records, 8 matched in order and in any order, 16 of 16 fields, 0 unexpected, 0 non-string values, 8 collected; dataset sha256 `44f55fed667957ade30d86c26418cc232145b7f15fc343601ae83bd2c9221a5c`.
- Core's own result verification stays "unverified", as expected for a provider-free replay; the goal is proved by the Lab oracle, not by Core.

Next: this lane may launch its next task. The fixed shop address and the `permission_denied` refusal above should be diagnosed separately before this task is counted as proof that Flows derive a page address from what they read.
