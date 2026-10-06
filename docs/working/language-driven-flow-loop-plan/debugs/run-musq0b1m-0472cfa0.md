# Run debug — `run-musq0b1m-0472cfa0`

Written after the run, from its evidence only (worker t174-w110: no provider call, nothing run, no source touched). Sources:

- The Lab bundle `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-03/run-musq0b1m-0472cfa0/`: steps 0001-0089 with every
  `meta.json`, request and response; `snapshots/flow-lane.json`, `snapshots/live-llm.json`; `evaluation.json`,
  `entry.json`, `run.json`, `summary.json`, `logs/core.log`. Screenshots `00020` and `00022` were read for facts only.
- The instance bundle `fxwork/t174/!FluxIQWebExtension/test-runs/instances/t174-slot-1/run-musq0b1m-0472cfa0/`:
  `events.ndjson`, `logs/core.log` (byte-identical to the Lab copy), `snapshots/decision-trace.json`. Also the UI-review
  record `t174-slot-1/run-musq0b1m-0472cfa0.ui-review.local.json`, read for timings only.
- The campaign `test-runs/campaigns/2026-10-03T18-23-27-635Z/` (`summary.md`, `logs/…attempt-1.log`).
- The code named in the Causes table, read at the run's commits with `git show HEAD:<path>`. Both trees are at the run's
  commits; other workers' uncommitted edits were not read.

There is no Core work dir for this run under `t174-slot-1/.work/`. It ran on identical source to the flash run
`run-musp8nz1-dbd3905a`: same downstream `45bd6232` and Core `6beae684`, the same extension sha256 `47dfd998…`, Lab
live-guard fingerprint `sha256:66793cee…`, and every prelude build `reused` (campaign log lines 8-21). Only the model and
the cost ceiling differ.

---

## Why it failed, and how far it got

**Cause: a Lab defect at the Lab-Core contract.** The Lab's live-run plan and Core's Flow-settings validator disagree on
the per-call cost cap. It is not the model, not the product's build, and not machine load.

1. **The run passes `--llm-cost-ceiling-usd 0.30`.** `planLiveLlmExecution` (downstream
   `packages/test-runner/src/live-llm/live-llm-plan.ts`) sets the per-call cap `maxEstimatedCostUsd` and the per-build
   cap `maxTotalEstimatedCostUsd` to the same value: `Math.min(buildCostCeilingUsd, budget.maxEstimatedCostUsd)`. That is
   min(0.30, the `--llm-max-cost-usd` default `LLM_LAB_MAX_ESTIMATED_COST_USD` = 10) = **0.30**. `live-llm.json`
   `authorized.maxEstimatedCostUsd: 0.3`.
   - The plan's own list of "Core's own ceilings on a Flow's LLM execution settings (`assertFlowLlmExecutionSettings`)"
     mirrors the token, timeout and call bounds. It does not mirror the cost bound.
2. **Core refuses the value.** After the build, the lane reached `playback-page` (`lane.ts:398`). It ran
   `resetScenarioLab` and `prepareFlowPage("playback")`; screenshot `00022` shows tab 3 back on "Farbazaar - Online".
   Then `authorizeRun` called `configureFlowLiveLlmExecution` (`live-llm/flow-settings.ts:30`), which posts
   `update-flow-settings` with `llmExecutionSettings.maxEstimatedCostUsd: 0.3`.
   - Core's `assertFlowLlmExecutionSettings` (`packages/fluxiq/src/programs/automation-studio/api/handlers/llm-execution-settings.ts:33`)
     refuses any value above **0.25**: `… || value.maxEstimatedCostUsd > 0.25) throw new Error("LLM estimated-cost limit is invalid.")`.
   - The answer was a 400. `existing-fluxiq-control.ts:161` raises every Automation Studio refusal as
     `RunnerFailure("environment.missing", …)`.
   - Evidence: `events.ndjson` seq 22, 18:27:56.784; `flow-lane.json` `stoppedAt: "playback-page"` and `failure`;
     `summary.json` `firstFailure`.
3. **Why the bounds disagree.** Core commit `fc26cfd6` (2026-10-01) made the per-build ceiling a configurable variable,
   `FLUXIQ_LLM_RUN_COST_CEILING_USD`, allowed up to $10 (`model/run-cost-ceiling/run-cost-ceiling-env.ts`,
   `…_MAX_USD = 10`; its header says "it was a fixed $0.25"). The per-call validator kept the old literal 0.25. Every
   Lab run with a ceiling above $0.25, and no `--llm-max-cost-usd` at or below 0.25, fails at this exact call. It fails
   **after** the whole build has been paid for. The flash run (ceiling 0.10) passed the same call.

**How far it got.**

- **Done:**
  - Exploration ran to completion, with 18 decisions to the first `complete`.
  - The instructed-consequence read ran.
  - Build test 1 was refused: two steps were `unreproducible`.
  - The draft was repaired in 9 more decisions.
  - Build test 2 passed: every step replayed, or was remembered or verified.
  - Two build judges both said yes, with confidence 0.95.
  - The chat ended `created`, and the chat applied the proposal (`review.appliedMutationCount: 2`;
    `decision-trace.json` adaptation `status: applied`).
  - The lane read the Flow (`authoredNodes`, `flowShape`: 15 nodes).
- **Not done:**
  - The Flow was never run. `decision-trace.json` `flows[0].runs: []`, `flow-lane.json` `runtimeRunId: null`, and the
    campaign log says "the Flow's playback is in steps/ as 0 step(s)".
  - The goal facts were never read (`oracleVerdict: null`).
  - There was no post-run result check.
- **What the verdict means.** "Failed" says nothing about pro's Flow. The run spent **$0.212718924 on a build whose
  playback was impossible from launch**.
- **Inference, not measured.** Build test 2's end state matches the requested choices: Space Grey, 7-in-1, Spain,
  quantity 3, total 68,97 € (screenshot `00020`, judge `endView`). So playback would most likely have played as flash's
  did, cancelling pair included.

## Header

- **Run id:** `run-musq0b1m-0472cfa0`. Slot `t174-slot-1`, headed Chromium 134.0.6998.35, side panel, started from the
  extension chat. This is a comparison run against flash's `run-musp8nz1-dbd3905a`.
- **Scenario / variant / task:** `crossborder-marketplace` / no variant / `crossborder-marketplace-hub-to-cart`, seed
  7342. It is judged by `playback-goal` `hub-in-cart` plus the final state facts, and was never judged (above).
- **Command** (`run.json` `invocation`):

  ```text
  scripts/lab/run-lab.mjs run crossborder-marketplace --live-llm --llm-profile lab-create-flow --llm-provider deepseek
    --llm-model deepseek-v4-pro --llm-task create-flow --instruction-task crossborder-marketplace-hub-to-cart
    --llm-max-input-tokens [screened] --llm-max-output-tokens [screened] --llm-max-total-tokens [screened]
    --llm-max-calls 48 --llm-cost-ceiling-usd 0.30
  ```

  There is no `--llm-max-cost-usd` and no `--direct-api-build`. The campaign allowed "up to 3 attempt(s)" and ran 1.
- **Trees** (`run.json` `repositories`): downstream `45bd6232`, dirty with 7 untracked docs and reports only; Core
  `6beae684`, clean.
- **No reply cap:** none of the 31 `request.json` bodies has `max_tokens`. Their keys are `model, messages, temperature,
  thinking, response_format, stream`.
- **Date, provider, model:** 2026-10-03 (a Saturday, so every call was priced off-peak at half rate), DeepSeek
  `deepseek-v4-pro`.
- **Timeline** (exploration includes the 0002 opening arrival):

  | Phase | From | To | Length |
  | --- | --- | --- | --- |
  | Lab start (`entry.json`) | 18:23:37.456 | — | — |
  | Chat call 0001 | 18:23:57.930 | 18:23:59.432 | 1.5 s |
  | Exploration (loop start to the 0037 `complete`) | 18:24:00.917 | 18:25:24.970 | 84.1 s |
  | Read 0038 | 18:25:25.052 | 18:25:27.709 | 2.7 s |
  | Build test 1 | 18:25:27.713 | 18:26:10.096 | 42.4 s |
  | Repair | 18:26:10.106 | 18:26:47.044 | 36.9 s |
  | Build test 2 | 18:26:47.061 | 18:27:28.240 | 41.2 s |
  | Judges | 18:27:29.638 | 18:27:36.567 | 6.9 s |
  | Chat ending (`events.ndjson` seq 20) | 18:27:53.631 | — | — |
  | Build settled (seq 21) | 18:27:56.021 | — | — |
  | Settings refused (seq 22) | 18:27:56.784 | — | — |
  | `run.json` finished | 18:28:16.010 | — | — |
  | `entry.json` finished | 18:28:22.900 | — | — |

  - `build.durationMs` is 235,437 and `chat.secondsToEnding` is 235.4.
  - The whole run took 278.6 s (`evaluation.json` `durationMs` 278,554). Lab start-up before the chat was only 21 s,
    against 167 s for flash: every build was reused.
  - **17.1 s between the last judge and the chat ending are unaccounted for.** The `core.log` build trace ends at
    18:27:28.240, and the overlay still read "Building your Flow | The result answers the request" at 18:27:38.46
    (UI-review moment 13). Flash's same gap was 1.5 s (Instrumentation gaps).
- **Provider calls, tokens, cost: 31 calls, $0.212718924**, 572,700 input (271,872 cache hits, 47.5%) / 4,137 output
  tokens. These are sums of every step's `meta.json`, grouped by `part`/`phase`/`taskKind`:

  | Phase (meta `part` / `phase` / `taskKind`) | Calls | Steps | Input / output tokens | Cost (USD) |
  | --- | --- | --- | --- | --- |
  | Chat (none / `chat` / `panel_command`) | 1 | 0001 | 1,584 / 78 | 0.001199880 |
  | Build decisions, first pass (`creation` / `explore` / `evidence_tool_decision`, iterations 1-18) | 18 | 0003-0037 odd | 329,788 / 2,236 | 0.139198400 |
  | Build decisions, repair after test 1 (same, iterations 19-27) | 9 | 0052, 0054, 0056, 0058, 0060, 0064, 0068, 0070, 0074 | 225,570 / 1,048 | 0.064632392 |
  | Instructed-consequence read (`creation` / `read`) | 1 | 0038 | 2,246 / 138 | 0.001755600 |
  | Build-test judges (`creation` / `judge` / `loop_verification`) | 2 | 0088, 0089 | 13,512 / 637 | 0.005932652 |
  | Post-run result check | 0 | — | — | — (no playback) |
  | **Total** | **31** | | **572,700 / 4,137** | **0.212718924** |

  **Reconciliation.** Every ledger agrees to the micro-dollar:
  - `entry.json` `costUsd` 0.212718924 = the 31 step `meta.json` costs, chat included. `evaluation.json` `llm.calls` = 31.
  - `flow-lane.json` `build.accounting` is 30 calls, 571,116 / 4,059 tokens, $0.211519044. That is the 27 explore
    decisions plus read 0038 plus judges 0088/0089:
    - input: 555,358 + 2,246 + 13,512 = 571,116;
    - output: 3,284 + 138 + 637 = 4,059;
    - cost: 0.203830792 + 0.0017556 + 0.005932652 = 0.211519044.
  - `build.providerCalls` is 30 and `loopProviderCalls` 27. The same 30 / $0.211519044 appears in `events.ndjson` seq 21,
    in `decision-trace.json` (adaptation `accounting`), and in `live-llm.json` `observed.accounting` (`budgetBreaches 0`,
    `pendingCalls 0`).
  - `live-llm.json` `runSpend.phases`:

    | Phase | Calls | Cost (USD) |
    | --- | --- | --- |
    | build | 27 | 0.203830792 |
    | judge | 2 | 0.005932652 |
    | read | 1 | 0.0017556 |
    | chat | 1 | 0.00119988 |
    | runtime | null | — |
    | reauthor | null | — |
    | **Sum** | **31** | **0.212718924** |

    - `stepLog` is 31 / $0.212718924 with `unattributed` 0.
    - `fromBuild` (judge 2 + read 1) is 3 / $0.007688252.
    - `verification` is `null`: there was no post-run check.
  - **Not reconciled per call:**
    - `live-llm.json` `observed.observedCalls` has 27 rows, the loop decisions only. Every row has `requestId`,
      `taskKind` and `promptVersion` null, beside `unrecordedCalls: 3` and `perCallRecords: "not recorded"`. The chat,
      the read and both judges have no row.
    - The campaign `summary.md` reports the run's "Cost USD (reported)" as 0.21151904400000002, which is the build only.
      The chat's $0.00119988 is missing from the campaign figure (Instrumentation gaps).
  - **Purse (t254):** `perBuild.ceilingUsd` 0.3, `maxBuildCostUsd` 0.211519044, `overCeiling` 0, `budgetBreaches` 0,
    `gate.invoked: true`. **Left at the end: $0.088480956 of $0.30.** The build used 70.5% of the purse, against 23%
    for flash's $0.10.
- **Verdict as reported:** **failed.**
  - `entry.json`, `run.json` and `evaluation.json` all say failed: `failureCategory: environment.missing`,
    `facilityFailure: {boundary: finalized-bundle, stage: scenario.execute, reason: unclassified}`.
  - `oracleVerdict: null`, `reportedVerdict: null`.
  - `flowCreated: false`. That is wrong: the Flow exists and its proposal was applied (Instrumentation gaps).
  - Invariant `person-hand-off` passed: "1 hand-off(s): traffic-screen at build, cleared after 4.3 s".
  - `harnessActivations: 0`.
- **Stage reached: 3 (proposal)**, plus the build's own replay (two build tests) and the build judgement. Stages 4
  (playback), 5 (the answer) and the post-run judgement never ran (Causes 1).

## Stage 1 — the instruction and the expected chain

Reused verbatim from `run-musp8nz1-dbd3905a.md` (itself from `run-murwd8le-79e735a8.md`). The instruction in
`0001-chat/decision.json` is identical to flash's, string for string (compared programmatically, 219 characters). The
`flow-lane.json` `task.instruction` `sha256` is `2e6f5e7d…a405` in both runs.

- The instruction, verbatim: "On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official Store in my
  cart: Space Grey, the 7-in-1 version, shipped from Spain. Collect that store's coupon while you are on the item. Do
  not buy anything."
- The node chain a correct Flow must have, written before looking at the run:
  1. Navigate to the storefront start.
  2. Dismiss the "Welcome back" coupon popup (optional: may be absent).
  3. Type "Voltbay USB-C hub" into the search field and submit.
  4. Open the Voltbay Official Store listing (opens a new tab).
  5. Dismiss the consent banner (optional).
  6. **Make sure** Space Grey is the chosen colour: press it only when it is not already chosen. A press of an option
     already chosen may un-choose it.
  7. Choose 7-in-1.
  8. Choose Spain as ships-from.
  9. Press Get coupons (the page may answer "busy"; retry).
  10. Set the quantity to 3.
  11. Press Add to cart, and read what the page answers (a cart count change, or a validation notice).
  12. Stop. No checkout, no Buy now.
- **What a wrong answer that looks right would look like here:** every node "succeeded" and every act is marked done,
  but the cart is empty because an option was toggled off or Add to cart was refused with a notice; or Buy now was
  pressed in place of Add to cart.
  - Goal facts (`manifest/facts.ts`):
    - `cart-line` = "Voltbay Official Store · Voltbay USB C Hub … · Space Grey · 7-in-1 · Ships from Spain · × 3";
    - `store-coupons` = the Voltbay Official Store coupon;
    - the final state `cart-count` = "Cart (3)" and `orders-shipped` = "Orders to be shipped (0)".

## Stage 2 — exploration

One row per model call, in order: 28 build calls, being 27 decisions and the read. The chat call is row 0, and the
judges are in Stage 6. A tool result is the step after the call. Cost is in USD. "Draft step" numbers are the ones the
model saw at the time.

| # | Step | Cost | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 0001 | 0.001200 | Chat: route the typed instruction (1,584 tokens, none cached) | `flow.createHere` with the instruction verbatim | — | Build started |
| — | 0002 | — | (Core, no model) opening arrival | — | `browser-navigate` `…/crossborder-marketplace/` | succeeded, `ARRIVED reload`; welcome popup `t476` covers 55 elements |
| 1 | 0003 | 0.009194 | First decision (13,787 tokens in, 0 cached) | (no summary) look for the item | `web.find_on_page` "Voltbay" | 0004: 0 matches; the answer names the search field `t489` |
| 2 | 0005 | 0.009356 | Next step | "Search the site for Voltbay USB-C hub…" | `dom-type` `t489` "Voltbay USB-C hub", submit, not added | 0006 **`target_covered`** `covered_by_layer`: `instead [t476]`, `closeWith [t478, t488]`, `next` "press one of closeWith…, then make this same call again, unchanged" |
| 3 | 0007 | 0.010575 | After the refusal (15,776 in, 0 cached) | (no summary) close the popup | `dom-click` `t478`, add, no act | 0008 succeeded, `control "×"`, 8 change lines (welcome popup gone) |
| 4 | 0009 | 0.008691 | Next step | "Search the site…" | `dom-type` `t489` "Voltbay USB-C hub", submit, add, **act `a1`** | 0010 succeeded, `…/search?cat=&q=Voltbay+USB-C+hub` |
| 5 | 0011 | 0.006428 | Next step | "Open the Voltbay USB-C hub item page" | `dom-click` `t676`, add, **act `a1`** | 0012: new tab `item/1005008123450`. View: **`t974 "Space Grey" marked`**, `t984 "4-in-1" marked`, `t991 "China" marked`, `t998 Quantity ="1"`, `t1042 "Add to cart" covered-by t1067` (consent covers 5). Checklist now `a1 done: 6` (the listing click) |
| 6 | 0013 | 0.006573 | Next step. View `t974 … marked`; system prompt line 20: "Choices. An option already marked … is chosen: leave it, as pressing it again can undo it." | "Select Space Grey, 7-in-1, Spain…" | **`dom-click` `t974`, add, act `a1.colour`** | 0014 **`choice`: "This press un-chose "Space Grey": it was chosen before."**; `t974 no longer marked`, "186 pieces available" gone |
| 7 | 0015 | 0.006952 | Next step, with 0014's `choice` sentence; first `afterActSaid` (a1.colour after step 6) | "Select Space Grey, 7-in-1, Spain, quantity 3…" (does not name the repair) | **`dom-click` `t974`, add, act `a1.colour`** (`select_space_grey_again`) | 0016 `choice` "chose "Space Grey""; `t974 now marked` |
| 8 | 0017 | 0.006696 | Next step | "Select the 7-in-1 version and Spain…" | `dom-click` `t985`, add, act `a1.version` | 0018 `choice` "chose "7-in-1""; `t984 "4-in-1" no longer marked` |
| 9 | 0019 | 0.006596 | Checklist: `a1 done: 6` (listing click). **`afterActSaid` ×2:** "a1.colour is made by step 8, after step 6 does a1 … **amend_draft reorder on step 8 with to 6** moves step 8 to position 6, just before that step" (the same for a1.version, step 9) | "reorder the variant selections before the add-to-cart step…" | **`amend_draft` [8 reorder to 6, 9 reorder to 6]** | 0020 applied 2. Space Grey (second press) and 7-in-1 now come **before the listing click**, on the search page (Causes 2) |
| 10 | 0021 | 0.006055 | Next step | "Select Spain…" | `dom-click` `t992`, add, **act `a1`** | 0022 `choice` "chose "Spain"". The `a1` claim moves to this step (draft step 10) |
| 11 | 0023 | 0.006412 | Next step | "collect the store coupon and add three hubs…" | `dom-click` `t968`, add, act `a2` | 0024 **`refused_by_page`** `page_busy_try_later`, `notice ["t969 \"Network busy, please try again\""]` |
| 12 | 0025 | 0.010948 | After the refusal (cache hits fell to 3,328) | "Retry collecting the store coupon…" | `dom-click` `t968`, add, act `a2` | 0026 succeeded: "Coupon collected. It will be applied at checkout." appeared |
| 13 | 0027 | 0.011276 | Next step | "…setting quantity to 3 and clicking Add to cart" | `dom-type` `t998` "3", submit false, add, act `a1.quantity` | 0028 succeeded, `control "Quantity"`, `t1040 "68,97 €" was "22,99 €"` |
| 14 | 0029 | 0.006596 | `afterActSaid`: "a1.quantity is made by step 13, after step 10 does a1 … reorder on step 13 with to 10" | "Reorder quantity step before Spain selection…" | `amend_draft` [13 reorder to 10] | 0030 applied (harmless: quantity before Spain) |
| 15 | 0031 | 0.006535 | Next step | "Adding the final Add to cart step…" | `dom-click` `t1042`, add, act `a1` | 0032 **`target_covered`** by `t1067` (consent). `next`: "close or answer it with one of its own controls" (no `closeWith`) |
| 16 | 0033 | 0.006727 | After the refusal | "Close the cookie consent overlay…" | `dom-click` `t1075` (**"Accept all"**), add | 0034 succeeded, consent text gone |
| 17 | 0035 | 0.006700 | Next step | "Add the Voltbay hub to the cart…" | `dom-click` `t1042`, add, act `a1` | 0036 succeeded: `t1126 "Added to cart!" appeared`; "recovered on attempt 2 after absorbing blocking_dialog, closing 1 dialog" (not named) |
| 18 | 0037 | 0.006888 | Next step (22,112 tokens in) | complete: "…selects Space Grey, 7-in-1, and Spain, collects the store coupon, sets quantity to 3, and adds the item to the cart." | complete | `completion check ok=true` (`core.log` 18:25:25.021) |
| 19 | 0038 | 0.001756 | Instructed consequences (2,246 tokens) | `complete` with `instructed: [{modify_existing, "put three … in my cart"}, {create_new, "Collect that store's coupon while you are on the item"}]` | — | `build.instructedConsequences` = both. The coupon is now withheld in tests (`verified`) |
| — | 0039-0051 | — | **Build test 1** | — | — | **refused** (`llm_evidence_loop.dry_run_refused`): draft steps 6 (7-in-1) and 7 (Space Grey) `unreproducible`, `target_not_found` on the **search** page (Stage 4) |
| 20 | 0052 | 0.008476 | `core.dry_run.1`: one row per step with outcome only; no location, no change lines. `costLeftUsd 0.1423`, `decisionsLeft 18` | "Repair the unreproducible steps by reordering them…" | `amend_draft` [6 reorder to 8, 7 reorder to 9] | 0053 applied |
| 21 | 0054 | 0.008087 | Next step (draft still shows the test-1 `replayed:` marks) | same summary | `amend_draft` [6 to 9, 7 to 10] | 0055 applied |
| 22 | 0056 | 0.004590 | Next step | same summary | `amend_draft` [6 to 7, 8 to 9] | 0057 applied |
| 23 | 0058 | 0.004596 | Next step | "…match the successful exploration order" | `amend_draft` [7 to 9, 9 to 7] | 0059 **ignored**: `llm_evidence_loop.draft_amendment_undone` |
| 24 | 0060 | 0.008307 | Next step | "Repair … by rerunning them with corrected targets" | `amend_draft` [7 rerun `t985`, 9 rerun `t974`] | 0061 `partly_applied`: step 9 refused `run_by_the_loop` (only the first rerun of a decision runs). 0062 reset `rerun.7.place` to the item page (a **reload**). 0063 **`target_unobserved` `handle_not_in_packet` `t985`**: the reloaded page numbered 7-in-1 `t1194` |
| 25 | 0064 | 0.008462 | 0063's page (7-in-1 = `t1194`) | "Rerun step 7 with the correct 7-in-1 handle from the current page" | `amend_draft` [7 rerun `t1194`] | 0066 reset (reload). 0067 **`handle_not_in_packet` `t1194`**: this reload numbered 7-in-1 `t985` |
| 26 | 0068 | 0.008017 | 0067's page (`t984 "4-in-1" marked`, `t985 "7-in-1"`) | "make the 7-in-1 selection step optional, **since it is already selected by default** on the item page" (false: 0012, 0063 and 0067 all show 4-in-1 marked) | `amend_draft` [7 optional] | 0069 applied: `a1.version` now `todo: step_is_optional` |
| 27 | 0070 | 0.006954 | Next step | "Repair the unreproducible 7-in-1 selection step by rerunning it…" | `amend_draft` [7 rerun `t985`] | 0072 reset (reload). 0073 succeeded, "chose "7-in-1"". `t985` matched only because this reload numbered it `t985` again |
| 28 | 0074 | 0.007143 | Checklist `a1.version todo: step_is_optional`; `costLeftUsd 0.0848`, `decisionsLeft 9` | complete: same sentence; chat summary "all acts are done" (false: `a1.version` is todo) | complete | `completion check ok=true` (18:26:47.061). Build test 2 passes (Stage 4) |

- **Repeats, and what the loop believed was progress:**
  - **Space Grey was pressed twice (0013 off, 0015 on), both added with act `a1.colour`.** It is the same cancelling
    pair as flash, repaired one turn later from the `choice` sentence. The pair cost $0.013525512 (0013 + 0015).
  - **Two reorders followed Core's `afterActSaid` sentence to the letter.**
    - 0019 moved the second Space Grey and 7-in-1 to position 6. Because the model had named `a1` on the listing click
      (0011), position 6 was *before* the item page opened. This is what broke test 1.
    - 0029 moved quantity before Spain, which was harmless.
    - Together they cost $0.013191376. The repair they made necessary cost $0.064632392 (9 decisions) plus a second
      build test (41.2 s).
  - **Four reorder decisions 0052-0058 went round in circles ($0.025748228).** The draft entry still carried the
    test-1 marks (`replayed: unreproducible`) on steps whatever their new position: the final draft shows Space Grey
    step 10 `replayed: unreproducible` although it now follows the listing click. So nothing told the model a reorder
    had fixed anything. 0058 was recognised as undoing an earlier amendment and ignored.
  - **Three reruns of 7-in-1 (0060, 0064, 0070) plus one `optional` (0068) cost $0.031740940.** Each rerun resets
    (reloads) the item page and only then sends the model's handle, which came from the page before the reload. Handles
    alternated between `t985` and `t1194` across reloads, so the first two missed and the third hit by coincidence
    (Causes 4).
  - `a1` (put in cart) was claimed on four steps in turn: the search (0009), the listing click (0011), Spain (0021) and
    Add to cart (0035). Only the last is the act.
  - Tool calls: 19 (`evidenceLoop.toolCallCount`), `core.run_node` and one `web.find_on_page`. There was no
    `capture_snapshot` and no `core.run_flow`.
- **Rejections and refusals received, and whether each said enough to route around:**
  - 0006 `target_covered`: yes. It named the layer and two closers; the model closed the popup and re-sent the search.
  - 0024 `refused_by_page` / `page_busy_try_later`: yes. It quotes the notice, and one retry worked.
  - 0032 `target_covered` (consent): yes, though without `closeWith`. The model found "Accept all" itself. Flash chose
    "Reject non-essential" in the same place.
  - 0061 `run_by_the_loop`: enough ("only the first rerun of a decision runs -- ask for one, and do the rest in the next
    decision"), and the model then reran one step per decision.
  - 0063 / 0067 `target_unobserved` `handle_not_in_packet`: **not enough.** `instead` lists only generic forms
    (`web.handle.unknown`, `target: {"handle": "tN"}`). It does not say the rerun reloaded the page and renumbered it, so
    the model's correction (0064: take the handle from the page it was just shown) was right in kind and still missed.
  - Information that was not a refusal, ignored once:
    - the `marked` view and the "Choices" line (0013);
    - the view showing 4-in-1 marked (0068 "already selected by default").
  - Acted on at once:
    - 0014's `choice` sentence (0015);
    - `afterActSaid` (0019, 0029). The model followed it exactly, and it was wrong when the act claim was wrong.
- **Where the context was evicted or truncated:** nowhere. Every result is `truncated: false` and `evaluation.json`
  `truncationCount` is 0.
  - Decision input grew from 13,787 tokens (0003) to 25,836 (0074).
  - Cache hits ran from 0 to 18,688 per call, and fell twice: to 3,328 at 0025-0027, and to 13,184 at 0060/0064 after
    0056/0058's 18,688.
  - Change lists were cut at "and N more changes": 0018 (3), 0022 (6), test 0080 (5), 0084 (7), 0073 (6).

## Stage 3 — the proposed Flow

- **Node list as authored.** Ids and definitions come from `flow-lane.json` `authoredNodes`. Selectors and typed text
  come from build-test-2 `call.json` 0076-0087, which match `authoredNodes` element identities node for node. There
  was no playback to compare against.

  | Node | Definition | Parameters |
  | --- | --- | --- |
  | s1 | `web.output.browser-navigate` | url `http://127.0.0.1:59121/scenarios/crossborder-marketplace/` (snapshot withholds it: `"http://127.0.0.1:59121"`), newTab false |
  | s2 | `web.output.dom-click` (optional) | div "×", `body > div:nth-of-type(4) > div > div:nth-of-type(1)` (draft 4) |
  | s3 | `builtin.control.merge` (inferred) | joins s2's success and skip |
  | s4 | `web.output.dom-type` | input accessibleName "Autumn Mega Sale: up to 70% off" `#fbofx0n4`, text "Voltbay USB-C hub", submit true (draft 5) |
  | s5 | `web.output.dom-click` | a (listing title), `main > div > section > div:nth-of-type(2) > div:nth-of-type(4) > div > a` (draft 6) |
  | s6 | `web.output.dom-click` **optional** | div "7-in-1", `main > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(4) > div:nth-of-type(2) > div:nth-of-type(2)` (draft 7, act `a1.version`, `runs: optional`) |
  | s7 | `builtin.control.merge` (inferred) | joins s6's success and skip |
  | s8 | `web.output.dom-type` | input label "Quantity", `main > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(6) > div:nth-of-type(2) > input`, text "3", submit false (draft 9, `a1.quantity`) |
  | s9 | `web.output.dom-click` | div accessibleName "Space Grey", `main > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(1)` (draft 10, `a1.colour`) |
  | s10 | `web.output.dom-click` | div accessibleName "Space Grey", **the same selector as s9** (draft 11, no act) |
  | s11 | `web.output.dom-click` | div "Spain", `#fbqexb15 > div:nth-of-type(2) > div:nth-of-type(2)` (draft 12) |
  | s12 | `web.output.dom-click` | div "Get coupons" in shadow host `main > div:nth-of-type(2) > div:nth-of-type(2) > fb-store-coupon`, `div:nth-of-type(1) > div:nth-of-type(2)` (draft 14, `a2`) |
  | s13 | `web.output.dom-click` (optional) | div "Accept all", `body > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(3)` (draft 16) |
  | s14 | `builtin.control.merge` (inferred) | joins s13's success and skip |
  | s15 | `web.output.dom-click` | div "Add to cart", `[data-testid="add-to-cart"]` (draft 17, `a1`) |

  - Shape: 15 nodes, 12 actions (1 navigate, 9 clicks, 2 types), no extraction (`flowShape`).
  - The three missing ids (s3, s7, s14) are the non-action nodes. Optionality of s2 and s13 is inferred from them: the
    draft shows no `runs` line for draft steps 4 and 16, which were `remembered`. As in flash, it was set at proposal.
  - Nothing is declared: every node's `consequences` is `[]`. `consequenceCrossCheck` verdict `undeclared`: instructed
    `modify_existing` and `create_new` were declared by nothing. Flash's s14 declared `create_new`.
  - There is no repeat, no binding and no Flow input.
- **Divergences from the stage 1 chain, one line each, naming the node:**
  - **s9 and s10: Space Grey pressed twice — the cancelling pair, as in flash.** The colour arrives chosen (0012), so
    s9 un-chooses it and s10 chooses it again. Test-2 change lines prove it: 0082 "no longer marked", 0083 "now marked".
  - **s6: 7-in-1 is optional.** If its press fails, the Flow carries on with the default 4-in-1, and the cart gets the
    wrong version with nothing raised. Stage 1 step 7 is required.
  - s8 before s9-s11: quantity is typed before the colour and ships-from presses. It is harmless here: the total kept 3
    × the price through the toggle (0083 "59,97 €" appeared), and the test-2 end state reads quantity 3, total 68,97 €
    (`00020`). It would break on a page that resets quantity on a variant change.
  - s13: "Accept all" cookies, a consent the person did not give. Flash pressed "Reject non-essential".
  - s15 has nothing after it that reads the page's answer. Both tests verified it without pressing (by design).
  - s2 optional with s3, s5 the listing, s11 Spain and s12 the coupon match Stage 1.
- **For each divergence:**
  - s9/s10: **misread the page** at 0013 (pressed an option shown `marked`, against the "Choices" line). The model
    recovered at 0015 on the `choice` sentence but kept both presses. **Could not express** dropping the pair: neither
    the draft entry nor the judge rows carry the `choice` sentences (flash Causes 1-2).
  - s6 optional: **misread the page** at 0068, claiming the 7-in-1 was "already selected by default" when 4-in-1 was
    marked. This came after **could not express** a working rerun: each rerun reloads and renumbers the page before
    using the handle (Causes 4).
  - The order problems that cost test 1 (7-in-1 and Space Grey before the listing) were **misread the grammar** on the
    model's side (claiming `a1` on the listing click, 0011) **amplified by Core**. Core's `afterActSaid` turned that
    claim into a literal instruction to move the choices to position 6 (Causes 2-3).
  - s13 "Accept all": model choice. The refusal named no closer, so the model picked one.

## Stage 4 — replay

**Build test 1** (0039-0051, `dryrun.1.*`). The reset `dryrun.1.reset` was "the page was put back", a navigation only.

| Draft step | Step | Outcome | Duration | What it says |
| --- | --- | --- | --- | --- |
| reset | 0039 | `replayed` | 1,295 ms | "the page was put back" |
| 1 navigate | 0040 | `replayed` | 2,253 ms | "the step ran again" |
| 4 × | 0041 | `remembered` | **7,366 ms** | target gone: the popup was closed in exploration |
| 5 search | 0042 | `replayed` | 1,844 ms | — |
| 6 7-in-1 | 0043 | **`unreproducible`** | 5,822 ms | "the step did not run (target_not_found)", on `…/search?cat=&q=Voltbay+USB-C+hub` |
| 7 Space Grey | 0044 | **`unreproducible`** | 5,977 ms | the same, on the search page |
| 8 listing | 0045 | `replayed` | 3,061 ms | opens another item tab |
| 9 Space Grey | 0046 | `replayed` | 2,268 ms | **`t974 "Space Grey" no longer marked`** (this Flow ended with no colour) |
| 10 quantity | 0047 | `replayed` | 1,340 ms | — |
| 11 Spain | 0048 | `replayed` | 2,332 ms | `t1140 "Spain" now marked` |
| 13 coupon | 0049 | **`verified`** | 1,171 ms | "target is on the page, visible and enabled; it was not run" |
| 15 Accept all | 0050 | `remembered` | **6,375 ms** | consent answered in exploration |
| 16 Add to cart | 0051 | `verified` | 1,179 ms | not run |

- Test 1 refused the Flow for steps 6 and 7. Had it been played, it would also have added with no colour, since
  step 9's single remaining Space Grey press un-chose the colour. The test cannot see that, because Add to cart is
  verified, not pressed.

**Build test 2** (0075-0087, `dryrun.2.*`):

| Draft step (node) | Step | Outcome | Duration | What it says |
| --- | --- | --- | --- | --- |
| reset | 0075 | `replayed` | 1,308 ms | "the page was put back" |
| 1 (s1) | 0076 | `replayed` | 2,269 ms | — |
| 4 (s2) × | 0077 | `remembered` | **7,388 ms** | target gone |
| 5 (s4) search | 0078 | `replayed` | **7,097 ms** | `personCompletedCheck: true`: a **traffic-screen** check appeared, FluxIQ handed it to the person, and the Lab cleared it in 4.3 s (`events.ndjson` seq 16, 18:27:04.604, `asks.personCheck 1`) |
| 6 (s5) listing | 0079 | `replayed` | 3,099 ms | opens another item tab |
| 7 (s6) 7-in-1 | 0080 | `replayed` | 2,407 ms | `"7-in-1" was "4-in-1"`, `"4-in-1" no longer marked` |
| 9 (s8) quantity | 0081 | `replayed` | 1,445 ms | `t1040 "59,97 €" was "19,99 €"` |
| 10 (s9) Space Grey | 0082 | `replayed` | 2,254 ms | **`t974 "Space Grey" no longer marked`**, "Poland" no longer disabled |
| 11 (s10) Space Grey | 0083 | `replayed` | 2,368 ms | **`t974 "Space Grey" now marked`**, "59,97 €" appeared |
| 12 (s11) Spain | 0084 | `replayed` | 2,367 ms | `"Spain" now marked`, "and 7 more" |
| 14 (s12) coupon | 0085 | `verified` | 1,311 ms | not run |
| 16 (s13) Accept all | 0086 | `remembered` | **6,449 ms** | consent answered in exploration |
| 17 (s15) Add to cart | 0087 | `verified` | 1,336 ms | not run |

- **Waits on targets that were gone:** the `remembered` steps took 13.7 s of test 1's 42.4 s and 13.8 s of test 2's
  41.2 s. Test 1's two `unreproducible` steps added another 11.8 s (Causes 8).

**Playback: none.** `NO EVIDENCE:` of any node's execution. The lane stopped at `playback-page`, before
`executeRecordedFlowRun` (`lane.ts`), on the settings refusal (Causes 1). `flow-lane.json` `actions: []`,
`runtimeRunId: null`, `recoveredFailures: []`.

- **Any node that reported success while doing nothing:**
  - s9 reports success while undoing a choice; s10 rescues it (test 2).
  - In test 1, the single Space Grey press on the item page un-chose the colour, and nothing after it noticed.
- **Provider calls during replay (expected: zero):** zero in both tests (no step `meta.json` carries usage between
  0039-0051 or 0075-0087). There was no playback to count.

## Stage 5 — the answer

- **Records expected vs returned:** none declared; this task is judged on page facts.
- **Fields compared, matched, mismatched:** **none compared.** `NO EVIDENCE:` the oracle never ran (`oracleVerdict:
  null`; `flow-lane.json` has no `oracles`) because playback never ran (Causes 1).
- **Every fact, observed value beside expected:**

  | Fact (subject) | Expected | Observed | Held |
  | --- | --- | --- | --- |
  | `cart-count` (`mini-cart-count`) | `Cart (3)` | not measured | — |
  | `orders-shipped` (`orders-summary`) | `Orders to be shipped (0)` | not measured | — |
  | `cart-line` (`mini-cart-line`) | `Voltbay Official Store · Voltbay USB C Hub … · Space Grey · 7-in-1 · Ships from Spain · × 3` | not measured | — |
  | `store-coupons` (`store-coupons`) | `Store coupons: Voltbay Official Store 2,00 € off orders over 25,00 €` | not measured | — |

  - Nearest evidence, which is not the Flow's result: build test 2's end state, from screenshot `00020` and the judge
    `endView`. Colour Space Grey, Specification 7-in-1, Ships From Spain, Quantity 3, "4 pieces available", Total
    68,97 €.
  - The cart badge "3 Cart" and the coupon "Collected" in that view are **exploration's** (0026, 0036). Both tests
    withheld the coupon and the add.
- **If the comparison was count-only, say so:** there was no comparison.

## Stage 6 — judgement and repair

- **Did the system judge its own result, and what did it conclude:** yes, the build was judged. Two calls on build
  test 2, both yes:
  - **0088:** `answersRequest: yes`, confidence 0.95, `patchNeeded: false`. "The end view confirms the selections are
    marked and the coupon is collected. The only flagged issue is that the 7-in-1 selection step is optional, but it was
    replayed and the end view shows it marked, so the request is fulfilled."
  - **0089:** the confirming call. Its request is identical to 0088's (diff empty past the header), with 6,656 of 6,756
    tokens cached. Yes, 0.95, `patchNeeded: false`. "End view shows **cart count 3**, coupon collected, and all options
    marked correctly."
  - There was no post-run check, because there was no playback.
- **What each saw:**
  - **`endView`** (`after: 17`, request line 443) shows `t918 "3 Cart"` and `t968 "Collected"`. Both are
    **exploration's** state: the test's reset is a navigation, and s12 and s15 were verified, not pressed. 0089 cites
    "cart count 3" as the Flow's result (flash Causes 3, recurred).
  - **`buildTest.steps`** rows carry an outcome word only. Both Space Grey rows read `replayed`, with no change lines,
    though 0082/0083 recorded "no longer marked"/"now marked". So no judge could see the cancelling pair (flash Causes 2,
    recurred).
  - Step 5's row reads `replayed`, with nothing about the person clearing a traffic screen during it. The judge prompt
    holds no "person" line beyond the limits text.
  - **`missingActs`** flagged `a1.version` `reason: step_is_optional`, and both judges dismissed it because it "was
    replayed". An optional act step that replayed in one test is not one the Flow will always run (Causes 5).
- **Did the build finish on a judged yes about the standing Flow:** **yes.**
  - Judges 0088/0089 judged test 2.
  - Test 2's 12 steps match `authoredNodes` node for node (selectors and texts compared, 0076-0087).
  - No decision or amendment follows 0074. The `core.log` build trace's last line is test 2's 18:27:28.240; the next
    record is the judges' steps, then the chat ending (seq 20, 18:27:53.631).
  - Gap (carried): the finishing verdict and the judged `flowSignature` are not on any record (`build.outcome:
    "proposed"`). This is proved from sequence.
- **How FluxIQ's ending is recorded:**
  - `flow-lane.json` `build.chat` is `{ending: "created", became: "build", resultTurn: 5, secondsToEnding: 235.4, asks:
    {permission: 0, personCheck: 1, other: 0}}` and `build.outcome` is `"proposed"`.
  - `events.ndjson` seq 20 is "instruction ended" and seq 21 is "The live Flow build finished" (30 calls,
    $0.211519044).
  - **The words FluxIQ ended with are in no record** (carried R1: `lane.ts:347` `said` is used only in failure throws).
    Screenshots `00020`/`00022` show the chat scrolled to the test's first rows, not the ending turn. `NO EVIDENCE:` of
    FluxIQ's ending text.
  - The last model summary in the chat, "Completing the Flow: all acts are done and steps are in the draft" (0074), is
    false: `a1.version` was todo.
- **If the answer was wrong, did a repair trigger automatically:** there was no answer, so none was due and none ran
  (`runtimePatchAttempts`/`interventions` absent, `harnessActivations: 0`). The build's own repair after test 1 ran
  inside round 0: every meta has `round: 0`, and there is no `core.resumed` in any request.
- **What context did the build-test repair receive:**
  - Present: `core.dry_run.1` with per-step outcome codes and Core's instruction text (0052 request lines 1067-1136);
    the draft with `replayed:` marks; the evidence history; the budget.
  - Absent from the dry-run rows: the page each step ran on (the search page was visible only in the route-state entries
    and the last view), the replay change lines, and any sign that a mark is stale after a reorder.
- **Was the repair persisted, and did the re-run use it:** yes, inside the build. Test 2 ran the repaired draft. No Flow
  run followed.

### This round's questions, answered

- **(a) The build may generalise (t252): offered yes, used no.** That is correct for one item. No response carries
  `write: true`, `repeat`, `bind`, `$row` or `$input` (grep over all 31 responses: 0).
- **(b) The purse (t254): it behaved.**
  - Money left before each decision (`core.budget` `costLeftUsd`; it equals the $0.30 ceiling less spent, less in
    flight, less about $0.0168 kept back for judging, per `loop-budget.ts:160-169`):

    | Decisions | `costLeftUsd` |
    | --- | --- |
    | 0005 | 0.274 |
    | 0011 | 0.2454 |
    | 0019 | 0.2188 |
    | 0027 | 0.1888 |
    | 0037 (first complete) | 0.1509 |
    | 0052 (after test 1) | 0.1423 |
    | 0060 | 0.1165 |
    | 0068 | 0.0998 |
    | 0074 (last complete) | 0.0848 |

  - `decisionsLeft` fell from 29 to 9, and `secondsLeft` from 533 to 376.
  - The build tested and judged before ending: test 2 (0075-0087) and both judges (0088/0089) came before the chat
    ending. The judges' $0.005932652 fit inside the amount kept back.
  - It did not end at cost. `budgetBreaches: 0`, `overCeiling: 0`, **$0.088480956 left of $0.30**.
- **(c) Records whole:**
  - FluxIQ's ending recorded: **partly**. The kind (`created`) and the timing are recorded; the words are not (R1).
  - The judge booked apart from the build in `live-llm.json`: **yes.** `runSpend.phases.build` holds the 27 decisions
    ($0.203830792); `judge` 2 / $0.005932652 and `read` 1 / $0.0017556 are separate, with `stepLog.fromBuild` naming
    them.
  - Core's answer folders for amendments: **yes, thin** (carried R3). For example, `0061-answer-amend_draft/` holds
    `meta.json` and `result.json` with `refused [{9, run_by_the_loop}]`, but not the reason text the model was given.
    It reports `applied: 0` beside `draftChange.appliedCount: 1` for the same answer (Instrumentation gaps).
  - UI review (t257): present, with 15 moments; it is reviewed in w111's report. `frontTabs` lists only the front tab
    (carried R7).

### Carried causes from the flash debug (`run-musp8nz1-dbd3905a`), rechecked on pro

| Flash cause | Recurred on pro? | Evidence |
| --- | --- | --- |
| 1 cancelling Space Grey pair kept | **Yes** | s9/s10 same selector; 0014 "un-chose", 0016 "chose"; test 2 0082 "no longer marked", 0083 "now marked". The model added both presses (0013, 0015, `add: true`, act `a1.colour`) |
| 2 nobody downstream shown the pair | **Yes** | judge `buildTest` rows 10/11 both `replayed`, no change lines (0088 request lines 318-338) |
| 3 build judges read exploration's cart | **Yes** | `endView` `t918 "3 Cart"`, `t968 "Collected"`; 0089 "End view shows cart count 3" |
| 4 pressed an option shown `marked` | **Yes** | 0013 on `t974 … marked` with the "Choices" line in the system prompt (line 20) |
| 5 instructed read missed the coupon | **No** | 0038 named `create_new` for the coupon and `modify_existing` for the cart, so both tests `verified` Get coupons instead of relying on `remembered` (0049, 0085) |
| 6 an amendment that changed nothing | Different shape | 0058 ignored `draft_amendment_undone`; 0061 partly applied `run_by_the_loop`; four reorders that circled (0052-0058) |
| 7 remembered waits | **Yes** | 7,366 + 6,375 ms (test 1), 7,388 + 6,449 ms (test 2) |
| 8 tabs accumulate | **Yes** | `00020`/`00022` tab strip: about:blank, FluxIQ, the home tab, two "Voltbay USB-C hub" tabs and the active item tab. Item tabs were opened at 0012 (exploration), 0045 (test 1) and 0079 (test 2); none were closed |
| R1 ending words | **Yes** | `build.chat` has no text |
| R2 finishing verdict not persisted | **Yes** | `build.outcome: "proposed"` only |
| R3 answer folders thin | **Yes** | 0061 (above) |
| R4 `observedCalls` nulls | **Yes** | 27 rows all null; 4 calls unlisted; `unrecordedCalls: 3` |
| R5 playback evidence thin | n/a | no playback |
| R6 step folder order and names | **Yes** | the read is `0038-decide` |
| R7 tabs not recorded | **Yes** | `frontTabs` 1 entry per moment |

## Comparison with the flash run (`run-musp8nz1-dbd3905a`)

Same source, same instruction, same seed and same Lab build. Only `--llm-model` and the ceiling (0.10 → 0.30) differ.

| | flash `run-musp8nz1` | pro `run-musq0b1m` | pro / flash |
| --- | --- | --- | --- |
| Verdict | **passed** (4/4 facts held, post-run check confirmed) | **failed**: Lab settings refusal at `playback-page` (Causes 1); facts not measured | — |
| Stages reached | 6: proposal, build test, judges, playback, facts, post-run check | 3 plus the build test and judges; no playback, facts or post-run check | — |
| Provider calls | 20 | 31 | 1.55× |
| Calls by phase | chat 1, explore 15, read 1, build judges 2, post-run 1 | chat 1, explore 27 (18 + 9 repair), read 1, build judges 2, post-run 0 | — |
| Cost | $0.024166530 | $0.212718924 | **8.8×** |
| Build cost / purse used | $0.023029884 of $0.10 (23%) | $0.211519044 of $0.30 (70.5%) | 9.2× |
| Tokens in / out | 291,439 / 2,541 | 572,700 / 4,137 | 1.97× / 1.63× |
| Cache-hit share of input | 49.2% (143,360) | 47.5% (271,872) | — |
| Rates, Saturday off-peak (`deepseek/pricing.ts`, half of peak) | miss 0.15, hit 0.003, out 0.60 $/M | miss 0.66, hit 0.022, out 1.98 $/M | 4.4× / 7.3× / 3.3× |
| Mean explore-decision cost | $0.001456 (15) | $0.007549 (27) | 5.2× |
| Chat call | $0.000139 (1,587/86) | $0.001200 (1,584/78) | 8.6× |
| First build judge (uncached) | $0.000789 | $0.005093 | 6.5× |
| Explore-decision latency | mean 1,354 ms (1,087-1,668) | mean 2,732 ms (1,934-4,539) | 2.0× |
| Decisions to the first `complete` | 15 | 18 | — |
| Build tests | 1, passed | 2: first refused (2 unreproducible), second passed | — |
| Build wall time | 98.6 s (explore 52.5, test 36.6, judges 4.8) | 235.4 s (explore 84.1, test 42.4, repair 36.9, test 41.2, judges 6.9, unexplained 17.1) | 2.4× |
| Whole run | 304.5 s (167 s Lab start-up) | 278.6 s (21 s start-up; builds reused) | — |
| Judges | 0046 yes 0.9, 0047 yes 0.9, 0048 post-run yes 0.9 | 0088 yes 0.95, 0089 yes 0.95, no post-run | — |
| Ending | `created`, resultTurn 3, words unrecorded | `created`, resultTurn 5 (one person check), words unrecorded | — |
| Person hand-offs | 0 | 1 (traffic screen in test 2's search, 4.3 s) | — |

**Flow shape, side by side** (pro's s3/s7/s14 and flash's s3/s7 are merges):

| # | flash node | pro node | Note |
| --- | --- | --- | --- |
| 1 | s1 navigate | s1 navigate | same |
| 2 | s2 × (optional) | s2 × (optional) | same selector |
| 3 | s4 type "Voltbay USB-C hub" + submit | s4 same | same `#fbofx0n4` |
| 4 | s5 listing link | s5 listing link | same selector |
| 5 | s6 "Reject non-essential" (optional) | — | pro dismisses consent later, with "Accept all" (s13) |
| 6 | s8 7-in-1 | s6 7-in-1 **(optional)** | pro's step can be skipped (Causes 5) |
| 7 | s9 Space Grey (un-chooses) | s8 quantity "3" | pro types quantity before the colour |
| 8 | s10 Space Grey (re-chooses) | s9 Space Grey (un-chooses) | pair in both |
| 9 | s11 Spain | s10 Space Grey (re-chooses) | |
| 10 | s12 Get coupons | s11 Spain | |
| 11 | s13 quantity "3" | s12 Get coupons | |
| 12 | — | s13 "Accept all" (optional) | consent beyond the instruction |
| 13 | s14 Add to cart (declared `create_new`) | s15 Add to cart (declares nothing) | |
| | 14 nodes, 12 actions, 2 merges | 15 nodes, 12 actions, 3 merges | |

**Where pro did better:**

- **Its instructed read was complete.** It named the coupon (`create_new`) as well as the cart, so its tests verified
  Get coupons rather than relying on the site to remember it (flash Causes 5 did not recur on pro).
- **Its test runs exercised more.** They had change lines for 7 steps and handled a person check, and the second test
  replayed every kept step.
- **It used fewer recovery turns in places.** It never needed `find_on_page` again, and it named the quantity control
  at once.

**Where pro did worse:**

- **Cost:** 8.8× for the same task, of which 4-7× is price and the rest is 11 more decisions and 1.97× the tokens.
- **Act claiming:** it named `a1` on the search, the listing click and Spain before Add to cart (0009, 0011, 0021).
  Core's `afterActSaid` then told it, correctly by position and wrongly by meaning, to move the choices before the
  listing click. It did exactly that (0019). This cost a refused test, 9 repair decisions ($0.064632392) and a second
  41 s test. Flash named `a1` only on Add to cart and never saw the sentence.
- **Repair:** it reordered in circles (0052-0058) against stale `replayed:` marks, then spent three reruns fighting
  handles renumbered by the rerun's own reload. It finally made the 7-in-1 optional on a false reading of the page
  (0068).
- **Consent:** "Accept all" where flash rejected non-essential cookies.
- **The cancelling Space Grey pair:** pro made the same mistake as flash, with the same `marked` view and the same
  "Choices" line. This is not a weak-model artefact; the fix belongs in Core (flash Causes 1).

**Why:**

- The price difference is the model's rate card.
- The extra decisions trace to one model behaviour (loose act claims) meeting two Core seams:
  - Core's choice-order sentence prescribes a reorder by position, without checking that the act's step is the act;
  - the rerun reloads before resolving the model's handle.
- Neither seam fires when the model claims acts only on the step that does them, as flash did.

## UI review

See reports/t174-w111-ui-musq0b1m.md (merged by the lead).

## Causes

"Located" means the file and function were read in this debug. "Inferred" means the location follows from the evidence
but the code path was not read. Ranked by impact: the failure first, then correctness of the Flow, then cost.

| # | Cause, precisely | Repo and file | Fix | Located / inferred |
| --- | --- | --- | --- | --- |
| 1 | **The run failed because the Lab's per-call cap (0.30) exceeds Core's settings bound (0.25).** `planLiveLlmExecution` sets `maxEstimatedCostUsd = maxTotalEstimatedCostUsd = min(--llm-cost-ceiling-usd 0.30, --llm-max-cost-usd default 10)`. `configureFlowLiveLlmExecution` saves it, and `assertFlowLlmExecutionSettings` refuses `> 0.25` with a 400, "LLM estimated-cost limit is invalid.", at `playback-page` after the build. Core made the per-build ceiling configurable to $10 (`fc26cfd6`, 2026-10-01) but kept the old fixed 0.25 per-call literal. **Every run with a ceiling above $0.25 pays for a full build and then cannot play back.** Here that was $0.212718924. | Core `packages/fluxiq/src/programs/automation-studio/api/handlers/llm-execution-settings.ts:33`; downstream `packages/test-runner/src/live-llm/live-llm-plan.ts` (`planLiveLlmExecution`, the "Core's own ceilings" list), `live-llm/flow-settings.ts:30` | Core: bound `maxEstimatedCostUsd` by the run-cost ceiling's maximum (`AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_MAX_USD`) or by the Flow's own per-run ceiling, not a literal. Lab: mirror Core's bound in the plan and refuse (or clamp the per-call cap) before the run starts, with a plan test pinned to Core's export as the token bound is. Add a Lab pre-flight that posts the settings, or validates them against Core's function, before the first provider call | located |
| 2 | **Core's choice-order sentence prescribed a reorder that put the choices before the page they live on.** `automationStudioInstructedChoiceAfterAct` fires on position alone ("a1.colour is made by step 8, after step 6 does a1 … reorder on step 8 with to 6") and trusts the act claim. Here step 6 was the listing click the model had wrongly named `a1`. The model obeyed (0019). Test 1 then failed with 7-in-1 and Space Grey `unreproducible` on the search page, costing 9 repair decisions ($0.064632392), a second build test (41.2 s) and the 0019 reorder itself ($0.006596). 0029 repeated the pattern on Spain, harmlessly. | Core `runtime/flow-bootstrap/instructed-acts/choice-order.ts` (`automationStudioInstructedChoiceAfterAct`), shown through `checklist.ts:201-204` | Do not prescribe a reorder when the act's step cannot be the act: it navigated or opened a page, or its control is not an add/collect/submit control. Say instead that the act is claimed on a step that does not do it, and name the step that does. Never prescribe moving a step ahead of the step that brought its control onto the page (the choice's recorded `from` page differs from the target position's) | located |
| 3 | **The model named `a1` ("put … in my cart") on three steps that do not do it**: the search (0009), the listing click (0011) and Spain (0021). Core accepted each claim and moved `a1` to the latest step, although the draft instruction says "name an act only on a step whose `does` is that act". This is the precondition for Cause 2. Flash claimed `a1` only on Add to cart. | model; Core `runtime/flow-draft/act-claim.ts` (`automationStudioFlowDraftClaimAct`) | Refuse, or answer with information, an act claim whose `does` cannot match the act's verb (a link press for "put in cart"), and keep the claim on the earlier step until a matching one appears | inferred (claim path named in the flash debug, not re-read for this check) |
| 4 | **A rerun reloads the page before resolving the model's handle, so the handle is stale by construction.** `step-place.ts` puts the target back (`{replay: "reset", from}`; the page shows `ARRIVED reload`) and then sends the rerun with the handle from the page before the reset. Handles alternated between `t985` and `t1194` across reloads: 0063 and 0067 were refused `handle_not_in_packet`, and 0073 hit by coincidence. The refusal's `instead` does not say the page was reloaded. Cost: 0060, 0064 and 0070 reruns plus the 0068 retreat to `optional` = $0.031740940. | Core `runtime/llm/node-tools/step-place.ts` (the reset before a rerun) and `runtime/llm/evidence-loop/rerun-request.ts:113`; handle allocation in downstream capture (inferred) | After the reset, resolve the rerun target by the element identity the handle had on the pre-reset page (selector, name, role), or re-map the handle onto the reloaded page. On a miss, say the page was put back and renumbered and show the control's new handle | located (reset rule and callIds); inferred (renumbering) |
| 5 | **The Flow's 7-in-1 step is optional, on a false premise, and nothing stopped it.** At 0068 the model said 7-in-1 was "already selected by default", while every view showed `4-in-1` marked. Core applied `optional` to the only step doing `a1.version` (checklist `todo: step_is_optional`). The completion check passed (`ok=true`, 18:26:47.061), and both judges dismissed the flag ("it was replayed"). In playback, a failed 7-in-1 press would carry on and add the 4-in-1. | model; Core completion check (`runtime/llm/evidence-loop/` completion, inferred) and judge prompt (`result-verification/build-test/summary.ts` `missingActs`) | Treat an act whose only step is optional as not done at completion: refuse with "the act's only step may be skipped", unless an `only_if` check guards it. Tell the judge that a `step_is_optional` act passing one test is not evidence the Flow always does it | inferred |
| 6 | **The draft keeps last test's `replayed:` marks on steps after they move**, so a reorder that fixes an `unreproducible` step still shows it `unreproducible`. The final draft shows Space Grey step 10 `replayed: unreproducible` after the listing click. The model reordered four times (0052-0058, $0.025748228), and the fourth was undone. The dry-run rows also carry no location, although the failed steps ran on `…/search?…`. | Core flow-draft entry serialization (`flow-draft/step.ts`, inferred); `core.dry_run` rows (`llm_evidence_loop.dry_run_refused` value) | Clear or mark `stale` a step's `replayed` mark once it is reordered or rerun. Give each dry-run row the page it ran on beside the page the step acted on | inferred |
| 7 | **Flash Causes 1-3 recurred unchanged**, on a stronger model: the cancelling Space Grey pair (s9/s10); no `choice` sentence in the draft or the judge rows; and the judges reading exploration's "3 Cart"/"Collected" as the Flow's result. This shows the pair is a Core gap, not a weak-model artefact. | see `run-musp8nz1-dbd3905a.md` Causes 1-3 | as there | located (as there) |
| 8 | **Remembered and unreproducible waits:** 13.7 s and 13.8 s per test on `remembered` targets, plus 11.8 s on test 1's `unreproducible` steps (flash Causes 7, recurred). | downstream `domain/src/runtime/llm-evidence/node-run/replay.ts:328` | as flash Causes 7 | inferred |
| 9 | **"Accept all" cookies** was added to the Flow (s13), a consent the person did not ask for. The refusal at 0032 named no closer (`closeWith` absent, unlike 0006). | model; Core/downstream covered-by-layer refusal (`target_covered` without `closeWith` for a consent layer) | Offer the consent layer's least-consent closer in `closeWith` ("Reject non-essential"), as the popup case does | inferred |
| 10 | **Tabs accumulate** (flash Causes 8, recurred): item tabs from exploration, test 1 and test 2, none closed. | Core `runtime/flow-draft/dry-run.ts` reset; Lab `resetScenarioLab` | as flash Causes 8 | inferred |
| R1 | **The refusal is filed as `environment.missing` / `unclassified`**, so the campaign reads it as an environment fault ("Flow created: no", "environment.missing; unclassified"). It is a Lab-Core contract refusal of a value the Lab chose. | downstream `packages/test-runner/src/existing-fluxiq-control.ts:161` (every Automation Studio refusal → `environment.missing`) | Classify a 400 from a settings endpoint as a facility contract failure (for example `facility.contract`), naming the field | located |
| R2 | **`evaluation.json` `flowCreated: false` while the Flow exists and its proposal was applied** (`flow-lane.json` `flowId`, `decision-trace.json` adaptation `status: applied`); the campaign row says "Flow created: no". | downstream evaluation writer (inferred: `flowCreated` set from the playback record) | Set `flowCreated` from the build record (`flowId` with `outcome: proposed`), not from playback | inferred |
| R3 | **17.1 s between the last judge (18:27:36.567) and the chat ending (18:27:53.631) are in no record.** The `core.log` build trace stops at 18:27:28.240, and the overlay still read "Building your Flow" at 18:27:38. Flash's gap was 1.5 s. | Core build trace (`[FluxIQ build-trace]` has no judge, apply or ending lines) | Trace the judges, the apply and the chat ending in the build trace with timestamps | inferred |
| R4 | **The campaign's "Cost USD (reported)" (0.211519044) leaves out the chat call**: the run spent $0.212718924. | downstream campaign summary writer, `scripts/lab/live-campaign/…` (inferred) | Report `runSpend.totalEstimatedCostUsd` | inferred |
| R5 | **Carried from flash:** the ending words are not recorded (flash R1); the finishing verdict is not persisted (R2); answer folders hold codes not words (R3, plus `applied: 0` vs `appliedCount: 1` at 0061); `observedCalls` rows are null (R4); the read folder is named `decide` (R6); tabs are not recorded (R7). | as flash R1-R7 | as there | as there |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 4-6 | Everything after the build: playback, facts and the post-run check. The run never reached them (Causes 1). This is not a recording gap, but no record says it was impossible from launch | Core `llm-execution-settings.ts:33` / Lab `live-llm-plan.ts` |
| Header | Why the failure is `environment.missing` / `unclassified` rather than a contract refusal | `packages/test-runner/src/existing-fluxiq-control.ts:161` |
| Header | `evaluation.json` `flowCreated: false` for a Flow that exists | downstream evaluation writer (inferred) |
| 6 | What happened in the 17.1 s between the last judge and the chat ending | Core `[FluxIQ build-trace]` (no judge, apply or ending lines) |
| 6 | FluxIQ's ending words on a created ending (carried) | `packages/test-runner/src/flow-lane/creation/lane.ts:347` |
| 6 | The build's finishing verdict and judged `flowSignature` (carried) | Core `unfinished-build/phases.ts`; `flow-lane.json` `build.outcome` only |
| 6 | Whether a person cleared a check during a build-test step (the judge row reads `replayed`) | Core `result-verification/build-test/summary.ts` rows (inferred) |
| 2 | Whether a draft step's `replayed` mark predates a reorder (stale marks) | Core flow-draft entry (inferred) |
| 2 | The page each dry-run row ran on, beside the page its step acted on | Core `core.dry_run` value (inferred) |
| 2 | The words Core answered an amendment with; `applied: 0` vs `appliedCount: 1` in one answer (0061) | Core `runtime/llm/step-log/answer-step.ts` |
| Header | Per-call request ids, task kinds and prompt versions in `observedCalls` (27 null rows; 4 calls unlisted) | `packages/test-runner/src/live-llm/live-llm-run.ts` |
| Header | The run's whole cost in the campaign summary (chat call missing) | campaign summary writer (inferred) |
| 3, 6 | Each draft step's `choice` sentence in the draft and the judge rows (carried) | Core `flow-draft/step.ts` (inferred), `result-verification/build-test/summary.ts` |
| UI | How many tabs were open at each moment (carried) | `packages/test-runner/src/run-scenario/ui-review/choose-scenario-tab.ts` |
| 4 | Core command attempts (no `.work/run-musq0b1m-0472cfa0`) | instance work-dir retention (inferred) |
