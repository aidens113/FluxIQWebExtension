# Live lane B — bigbox pickup cart, store remembered after creation

## Current State

Status: Round 3 run 3 done: FAIL (runtime.behavior), build stopped at its 48-call allowance ($0.0767, off-peak) with no Flow; Core fix for cause 1 uncommitted in `fxwork/t262/!FluxIQ`, awaiting supervisor merge; no relaunch.

Run 3 (run-mux6pndp-16feb842, $0.076759, 48 calls = chat + 45 decisions + 2 judges, off-peak 21:20Z): the build tested a 20-step Flow and both judges rightly said no. Cause 1 (Core): the acts checklist counted a2 ("add the towels to my cart") done by the product-link click that only opened the page where a2's size and quantity were then chosen, so every "Still not done" list, the answer "a2 done, so nothing is left to do for it" and the stall note hid the Add to cart, which was never pressed in place. Fix: such a step is `step_only_opens_its_choices` (`flow-bootstrap/instructed-acts/standing.ts`), and the stall note sends the model to the press after the choices; fail-first tests, 184 test files / 2445 tests pass, `fluxiq:check` and Core audit exit 0. Also: the napkins went to the shipped-only 3-Pack lookalike (model choice); a step claiming a lasting act is verified not followed in the build test (R2-C8, open); "keep adds nothing" never fired (keeps mixed with a no-op drop). [Debug](../../language-driven-flow-loop-plan/debugs/run-mux6pndp-16feb842.md).

Run 2 (run-muwaq9w3-baaa4e19, $0.083761, 25 decisions, started 06:28Z Tuesday inside DeepSeek's peak window, so every token cost double run 1's off-peak rate): Core's stall note told the model "the one that does a2" while a2.quantity was owed, so it added the towels at quantity 1, then spent the rest on a repeat for the second pack and no-op `keep` amendments (10 of 25 decisions, $0.033) until the ceiling. Fix: `llm/evidence-progress/stall-redirect.ts` `nextOwed` (an act's owed choice before the act), test red then green. Run 1's judge fix was not exercised (no post-run check reached). [Debug](../../language-driven-flow-loop-plan/debugs/run-muwaq9w3-baaa4e19.md). Next: merge, sync, rebuild, run 3; consider running B off-peak and fixing the no-op `keep` loop (cause 3).

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

## Run 2 — expectations (predeclared 2026-10-06T06:24Z, before launch)

Source: lane tree `fxwork/t262` downstream 624c7a70, Core 9fd634d3 (contains dev, incl. 7087e9ec "The finished-run check sees what each step changed; plain endings for cart runs", lane C/D judge sentences, t276 UI fixes). Core dist rebuilt 23:13:48 local, after its HEAD commit; the dist holds `step-changes.js`, the `flowShape[].changed` sentence, the plain cart ending and the "Skipped …" route wording. Same command as run 1 (dry run re-inspected below), instance `t262-slot-3`, workspace `t262-b`, `--max-attempts 1`, $0.10 build ceiling, 48 logical calls, DeepSeek flash, headed, built from the extension chat. A fresh run-owned project; neither the B7 draft nor run 1's Flow is replayed or improved.

Instruction (verbatim, unchanged):

> Switch my pickup store to Millbrook Crossing Supercenter, then add two packs of the ValueRidge Essentials Select-A-Size Paper Towels in the 12 Double Rolls size and one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count size to my cart, both for pickup. Keep what is already in my cart as it is, and do not check out.

What a correct build does (unarmed base site: Carden Falls, cart 1 item soap $3.97): as run 1 — dismiss whatever covers the page; open the store picker and press Set as my store on Millbrook Crossing Supercenter; reach ValueRidge Essentials Select-A-Size Paper Towels, choose 12 Double Rolls, commit quantity 2 (one "+" from 1, or the quantity field), Pickup, add once; reach ValueRidge Everyday Dinner Napkins, choose 250 Count, quantity 1, Pickup, add once; never touch the soap, never open checkout; no permission parked (`answeredBy` instruction or nothing lasting). An intelligent Flow, not a transcript; one whole-Flow test; both build judges yes; `flowCreated: true`; within $0.10 and 48 calls.

Exact oracle on playback (variant `store-remembered` armed after the build):

- At arm: `mini-cart-store` = "Pickup store: Millbrook Crossing Supercenter"; `mini-cart-summary` = "1 item · Subtotal $3.97".
- Final: `store-switched` = "Pickup store: Millbrook Crossing Supercenter"; `soap-kept` (`mini-cart-line-5530601-pickup`) = "1 × ValueRidge Ultra Dish Soap, Lemon Scent, 24 fl oz · Pickup"; `towels-added` (`mini-cart-line-5510202-pickup`) = "2 × ValueRidge Essentials Select-A-Size Paper Towels, 12 Double Rolls · Pickup"; `napkins-added` (`mini-cart-line-5530102-pickup`) = "1 × ValueRidge Everyday Dinner Napkins, 250 Count · Pickup"; `nothing-else` (`mini-cart-summary`) = "4 items · Subtotal $43.39".
- The remembered store on playback: the store step meets a card reading Your store with no Set as my store button; the run passes over it by page state (`state_routed` or `effect_holds`), presses no other store, asks no model, and continues to the search.

The post-run check on playback (the change under test): its request's `resultSummary.flowShape` carries `changed` for the in-place steps of this run, at least the towel Add to cart (lines showing the Added-to-cart panel with "12 Double Rolls" and "Qty 2 · Pickup") and the napkin Add to cart; the "+" step's change is carried unless its diff reports a location change. Both judges answer `answersRequest: yes`; no re-author is routed; the run reports passed. If a judge still says no on the correct cart, record exactly what it was shown (which steps carried `changed`, the lines, the end view) and why it said no, and whether a re-author was routed.

Pass = Lab verdict passed with the five facts exact. Wrong plausible answers that do not pass: wrong size or brand, towels quantity 1, delivery or shipping, store left at Carden Falls, soap changed, more than 4 items, checkout opened, playback failing at the store step, a reported pass whose facts do not hold, or a correct cart reported failed.

On a pass: two provider-free replays (`node scripts/lab/run-lab.mjs replay bigbox-retail --workspace t262-b --project <creation-context project> --flow <saved flow> --instruction-task bigbox-retail-pickup-cart-store-remembered-after-creation`), each with explicit zero provider calls, interventions and harness activations, the saved Flow hash unchanged, and the five facts again. Run 1's Flow in this workspace is not a replay target.

UI checkpoints (screenshots and step logs):

- Chat: one assistant message per step with its reason and an icon card naming the control; no generic "Looking at page"; refused decisions shown as refusals, not as work done (t276 item 9); "Edit the Flow" cards say what changed (t276 item 1); no raw ids (t958, s8) anywhere; composer at the bottom; no flicker.
- Playback: the routed store step reads "Skipped clicking “Set as my store”: … Continuing with …" (or the step's label), never a store index such as "step 15" against "step 8 of 15".
- Overlay: visible on the ValueRidge page during exploration, test and playback; text never cut mid-word (t276 item 8); the Lab sampler's flicker flags compared with run 1 (moments 3, 4, 6, 18 flagged then).
- Ending: on success a truthful done message naming the Flow; on a failure of a cart run, never "It returned no rows".

## Round 3 — run 3 expectations (predeclared 2026-10-06T21:19Z, before launch)

Source: lane tree `fxwork/t262` downstream `f224b38a` (dev `7880abda` differs only in docs), Core `e1551fa3` (= Core dev); Core dist rebuilt 21:06Z, domain dist 21:08Z, extension build 21:10Z, all after their HEAD commits. Same command as runs 1-2 (dry run below), instance `t262-slot-3`, workspace `t262-b`, `--max-attempts 1`, $0.10 build ceiling, 48 logical calls, DeepSeek flash, headed, built from the extension chat. **Off-peak**: launch after 21:00Z Tuesday, outside 01-04 and 06-10 UTC, so tokens bill at the half rate run 1 had (run 2 paid double at peak). Fresh run-owned project; no earlier Flow replayed.

Instruction, what a correct build does, the exact five-fact oracle and the remembered-store playback: unchanged from run 2 above (towels 12 Double Rolls ×2 Pickup, napkins 250 Count ×1 Pickup, soap kept, Millbrook store, "4 items · Subtotal $43.39"; the store step passes by page state on the armed variant).

New on this source, each to be checked in the debug:

- B row 1 (Core `6f8212a5`, `evidence-progress/stall-redirect.ts` `nextOwed`): a stall note with `a2.quantity` owed names `a2.quantity`, never "the one that does a2"; the towel quantity 2 is committed before Add to cart (no Add to cart at quantity 1, no `repeat` for a second pack).
- B row 3 (Core `68c4c9a7`, `decision-handlers/amendment.ts` `KEEP_ADDS_NOTHING_INSTRUCTION`): a decision whose every amendment is `keep` of a step already in the Flow is answered "keep adds nothing ..." and counts as no progress. Must be seen: at most one keep-only round; none after the first answer.
- Lane A loop fix: a rerun/amendment re-sent after it changed nothing is refused unrun (`same_amendment`), history rows say "unchanged"/"refused", never "applied" for refused work; no run of identical amend/rerun decisions.
- Frame-stable digest (`web-state.v4`): the ValueRidge page after a reset digests the same, so repeat refusals and no-progress fire across resets (check `stateBefore`/`stateAfter` in any no-op step).
- t278 / whereToFix / strands_a_step / unreached note: if a repair round or post-run re-author happens, its input carries `checked` rows and `judgement.whereToFix`; an edit stranding a kept step is refused `strands_a_step`.
- Run 1's judge fix (`flowShape[].changed`) is still unexercised: if playback reaches the post-run check, its request carries `changed` for the towel and napkin Add to cart steps and both judges answer yes on the correct cart.

UI checkpoints (t277 "what the next live UI review must see", the items relevant to a cart build):

- Chat: one message per step with reason and an icon card; refusals shown as refusals, never as "it wasn't on the page" when the target was there (R2-U-6); repeated refused reruns fold into one card with "(N times)" (R2-U-7); no internal words ("extraction", "the judge", "next call", "Step N" contradicting the Flow's count, "dedup") in thoughts or cards (R2-U-4); no judge sentence cut at "(e.g." or glued to the next (R2-U-3); "Sending your message" gives way to "Starting…" with the overlay once the build starts (R2-U-5); a check card, if any, says what failed in a clause, never a bare "Didn't pass" (R2-U-1).
- Overlay: present on the ValueRidge page while FluxIQ works; no absent sample 100 ms or more after a new document (R2-U-11); text never cut mid-word.
- Start panel: moment 01 may still show the previous run's "is ready"/ending thread before the Lab selects the project (R2-U-10, known, not a product defect); note it, do not count it.
- Playback: the routed store step reads "Skipped clicking “Set as my store”: … Continuing with …", no raw store index.
- Ending: on success a truthful done message naming the Flow; on failure never "It returned no rows"; R2-U-2 (dollar bookkeeping in the budget ending) is known open.

Pass = Lab verdict passed with the five facts exact, then two zero-call replays and a second independent live pass. A failure: debug end to end, name the cause in source, fail-first test and smallest fix if no other lane has uncommitted source edits in the tree, and return.

Dry run (21:20Z): `FLUXIQ_LAB_INSTANCE=t262-slot-3 FLUXIQ_TEST_ENV_FILES=none pnpm.cmd lab:campaign bigbox-retail-pickup-cart-store-remembered-after-creation --dry-run --max-attempts 1 -- --target persistent-isolated --workspace t262-b` printed `pnpm lab run bigbox-retail --variant store-remembered --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task bigbox-retail-pickup-cart-store-remembered-after-creation --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated --workspace t262-b`, identical to run 2's recorded argv. Ceiling `.env.local` `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.10`, unset in the shell; no ceiling flag, no `--llm-permit`, no guard override. Task (`apps/scenario-lab/src/scenarios/bigbox-retail/live-tasks.ts`): `variantArmedAfterBuild: true`, `judgeBy: "playback-goal"`, no `permits`, no `permissionPoint`. Previous run's debug present (`run-muwaq9w3-baaa4e19.md`); source changed since (fingerprint differs).

## Round 3 — run 3 result (2026-10-06, 21:20-21:28Z)

- Run `run-mux6pndp-16feb842`, launch `launch-mux6peom-990f3a75`, guard admitted (fingerprint `sha256:6475d56e…`), one attempt, exited 1 naturally; no relaunch. Verdict `failed` / `runtime.behavior` (`lab.chat_build_failed`), `flowCreated: false`, oracle not measured. Cost $0.076759 (chat $0.000098, 45 decisions $0.075017, 2 judges $0.001644); 48 calls, the `--llm-max-calls 48` allowance, ended the build with $0.023 of the $0.10 ceiling unspent. Off-peak, a decision cost about half of run 2's.
- Causes, fix, UI review and the new-on-this-source checks: [debug](../../language-driven-flow-loop-plan/debugs/run-mux6pndp-16feb842.md). In short: cause 1 (Core checklist counted an act done by the step that only opened its choices' page) fixed uncommitted with fail-first tests; cause 2 (lasting-act claim on a navigation verified, not followed, in the build test; R2-C8) open; cause 3 (3-Pack lookalike) model; cause 5 (the 48-call allowance binds off-peak) policy; cause 6 (`keepOnly` misses keeps mixed with a no-op drop) open, minor.
- Must-be-seen for B: "no keep-only rounds after the first answer" not met as written (three no-op keep+drop rounds; the keep-only answer never fired because none was keep-only); "owed choice done before its act" held for the choices but the act itself was hidden by cause 1.
- UI: R2-U-7 folding seen working; R2-U-10 not seen (start panel "Loading the conversation…"); R2-U-5 not seen fixed (moment 02 "Sending your message", no overlay, 2 s after Core read the message); new defects U-B3-1 (`write: true` steps never run read "Click · Add to cart · Done"), U-B3-2 ("The Flow so far ran clean from its start" with six steps not run), U-B3-3 (overlay glues "12 Double Rolls$16.47").
- Files changed (Core tree `fxwork/t262/!FluxIQ`, uncommitted): `R/flow-bootstrap/instructed-acts/{standing,contracts,checklist,check,claim-doubt}.ts`, `R/flow-bootstrap/instructed-acts/tests/choice-order.test.ts`, `R/flow-bootstrap/unfinished-build/not-done.ts`, `R/llm/evidence-progress/stall-redirect.ts`, `R/llm/evidence-progress/tests/stall-redirect.test.ts`, `docs/architecture/automation-studio/flow-authoring.md`. Two older test expectations (choice-order "wrongly claimed arrival" and lane A's hub listing case) were flipped on purpose; they pinned "the claim is doubted, and stands".
- Replays and second pass not run (no pass).
