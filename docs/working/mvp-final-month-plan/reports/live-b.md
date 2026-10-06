# Live lane B — bigbox pickup cart, store remembered after creation

## Current State

Status: Run 1 done: FAIL (runtime.behavior) with the exact oracle HELD; two Core fixes uncommitted, awaiting supervisor merge; no relaunch.

Run 1 (run-muw5zv4m-52d83027, $0.118709, 77 priced rows; build $0.0445, re-author $0.0725, each under the $0.10 build ceiling): the build from the extension chat named every act; the playback on the armed variant routed past the remembered store by page state and built the exact cart (all five facts held). Core's post-run check then had both judges answer no from status rows and an end view with a stale header count; the re-author spent its allowance and failed. Cause and fixes: [debug](../../language-driven-flow-loop-plan/debugs/run-muw5zv4m-52d83027.md), [fix 1](./live-b-fix-1.md) (finished-run check sees each step's in-place change), [fix 2](./live-b-fix-2.md) (ending and routed-step wording). Replays not run (no pass). Next: merge fixes 1-2 (Core, tree `fxwork/t262/!FluxIQ`, shared with lane A), sync and rebuild, then run 2.
Lead: lane B live lead (Claude). Slot 3, instance `t262-slot-3`, tree `fxwork/t262` (task/t262-mvp-live-continuation at efaf2034; dev ahead only by docs; Core sibling a83b1471 contains Core dev), workspace `t262-b`.
Task: `bigbox-retail-pickup-cart-store-remembered-after-creation` (variant `store-remembered`, armed after the build; judged by playback goal).

## Run 1 — expectations (predeclared 2026-10-06T04:13Z, before launch)

Instruction (verbatim, public task text):

> Switch my pickup store to Millbrook Crossing Supercenter, then add two packs of the ValueRidge Essentials Select-A-Size Paper Towels in the 12 Double Rolls size and one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count size to my cart, both for pickup. Keep what is already in my cart as it is, and do not check out.

Command (dry run inspected): `pnpm lab run bigbox-retail --variant store-remembered --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task bigbox-retail-pickup-cart-store-remembered-after-creation --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated --workspace t262-b`, launched once via `pnpm.cmd lab:campaign <task> --max-attempts 1` with `FLUXIQ_LAB_INSTANCE=t262-slot-3`, `FLUXIQ_TEST_ENV_FILES=none`. Ceiling: `.env.local` `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.10` (Lab default is also $0.10); no ceiling flag, no `--llm-permit`, no guard override. Task declares no `permits` and no permission point.

What a correct build does (unarmed base site: home store Carden Falls Supercenter, cart 1 item, soap, $3.97):

1. Starts from the real extension chat as a fresh run-owned project in `t262-b` (`flow.createHere`); the B7 draft Flow in the old project is never replayed or improved.
2. Opens the store picker and presses Set as my store on Millbrook Crossing Supercenter.
3. Reaches ValueRidge Essentials Select-A-Size Paper Towels (not Loftwell Select-A-Size, not 6 Double Rolls), selects 12 Double Rolls, actually commits quantity 2, Pickup fulfillment, adds to cart once.
4. Reaches ValueRidge Everyday Dinner Napkins, selects 250 Count, quantity 1, Pickup, adds to cart once.
5. Leaves the soap line alone; never opens checkout. Cart adds are instructed, so the consequence row should read `answeredBy: instruction` (or nothing lasting declared); no parked permission.
6. Authors an intelligent Flow, not a transcript: one store step that routes by page state (when Millbrook already reads "Your store" with no Set as my store button, the step is satisfied, not failed and not re-targeted at another store), and separate towel and napkin steps each with their own option, quantity and add action. The store binding the B7 run looped on must bind (or be refused with an affordance the model then follows), not loop.
7. Test-and-judge: one whole-Flow test from the start on the base site, both judges yes, `flowCreated: true`, within $0.10 and 48 logical calls.

Exact oracle on playback (variant armed: the site already remembers Millbrook):

- At arm: `mini-cart-store` = "Pickup store: Millbrook Crossing Supercenter"; `mini-cart-summary` = "1 item · Subtotal $3.97".
- Final: `store-switched` `mini-cart-store` = "Pickup store: Millbrook Crossing Supercenter"; `soap-kept` `mini-cart-line-5530601-pickup` = "1 × ValueRidge Ultra Dish Soap, Lemon Scent, 24 fl oz · Pickup"; `towels-added` `mini-cart-line-5510202-pickup` = "2 × ValueRidge Essentials Select-A-Size Paper Towels, 12 Double Rolls · Pickup"; `napkins-added` `mini-cart-line-5530102-pickup` = "1 × ValueRidge Everyday Dinner Napkins, 250 Count · Pickup"; `nothing-else` `mini-cart-summary` = "4 items · Subtotal $43.39".
- The remembered store on playback: the store step meets a card that says Your store and has no Set as my store button; the run continues to the search without failing, without pressing another store, and without asking the model.

Wrong plausible answers that do not pass: wrong size or wrong brand; towels quantity 1 (quantity menu opened but not committed); delivery or shipping fulfillment; store left at Carden Falls; soap removed or changed; duplicated adds (more than 4 items); checkout opened; playback failing at the store step because Set as my store is absent; a draft or unfinished build counted as a Flow; a count or checklist without the five exact facts.

On a pass: two provider-free replays (`node scripts/lab/run-lab.mjs replay bigbox-retail --workspace t262-b --project <creation-context project> --flow <saved flow> --instruction-task bigbox-retail-pickup-cart-store-remembered-after-creation`), each with explicit zero provider calls, interventions and harness activations, the saved Flow hash unchanged, and the same five final facts.

UI checkpoints (from the run's screenshots and step logs):

- Chat: the person's turn appears once; every model step is its own assistant message in plain words with its reason; actions render as cards with an icon and specific words (what was inspected or pressed, never a generic "Looking at page"); no flicker; composer at the bottom; no raw tool ids, selectors or secrets.
- Overlay: visible on the ValueRidge page whenever FluxIQ is working (exploration, test, playback), stable text.
- Ending: a truthful final message: built and ran, or unfinished with the actual reason; the Flow is named, not an id.
