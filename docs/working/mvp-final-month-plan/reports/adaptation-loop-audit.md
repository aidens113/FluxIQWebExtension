# adaptation-loop-audit

Worker report, 2026-10-05. Brief `adaptation-loop-audit` in `../../mvp-final-month-plan.md`.
Read-only: no build, test, Lab run, browser or provider call. One command ran: a campaign `--dry-run --no-build`, which only prints commands. The only file written is this report.
Sources: Core `C:/Users/osrs_/FluxStuff/!FluxIQ` at `3c47ed7d` (dev); this repository at `13bf7450` (dev, includes t262 and t263).
Core paths below are relative to `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

**Done.** The adaptation chain is complete in Core's source for one kind of run: a model-assisted run (`runIntent`) whose Flow keeps its default `fully_adaptive` / `proposalMode: "auto"` settings. In that run Core can go from a failed step to diagnosis, exploration (which can now press, type and navigate), a patch trial, an automatic promotion decision, a resume from the trial's resume point, a judged whole run and an automatic apply. A later run with no `runIntent` then has no model, so it is the zero-call replay.

All four 2026-09-21 blockers are gone from source: the forced `authorizedExternalSideEffects:false`, the retry skipped on granted runs, the risk/side-effect promotion refusal, and exploration unable to act.

Three things still stop the chain from being proven, or used:

1. **No product run asks for a model.** The extension's Automations Run and the chat's "run it" send `{projectId, flowId}` with no `runIntent`. Core then resolves no provider for the repair, unless the Flow has a standing repair authorization, which is off by default. The run fails and nothing adapts.
2. **The Lab's created-Flow playback forces `adaptiveMode: "manual_approval"`.** Core then forces `proposalMode: "manual"`, so a repair can never auto-promote, resume, or be applied after a judged run. The Lab cannot prove "continue" or "persist automatically".
3. **The Lab's repair lane passes a repair it never replayed.** For a form task whose repair was the failed-step re-author, it ends `no_proposal`, runs 0 replays, and passes.

One more thing is unknown and may dead-end the target-override path: whether an instruction-built node declares enough evidence for a trial to verify (`verified` rather than `unverifiable`).

## What changed and why

Only this report was written.

### Step-by-step: a saved instruction-built Flow meets a page that changed after creation

Status key: works = present in current source and reachable for the run described; blocked = current source cannot do it for that run; unknown = could not be settled from source.

| # | Step | What current source does | file:line | Status |
| --- | --- | --- | --- | --- |
| 1 | Start the saved Flow | Extension Automations Run: `run-runtime-session {projectId, flowId}`. Chat "run it": the same call, no `runIntent`. The Lab's created-Flow playback: `runIntent: "explore_and_adapt"` plus `adaptiveMode: "manual_approval"`. The Core handler builds `llmExecution` (whose key pays) only when `runIntent` is present. | ext `apps/extension/src/background/automation-relay/automation-relay.ts:62`; Core `runtime/conversations/commands/run-flow.ts:36`; `api/handlers/runtime-execution.ts:57-61`; ext `packages/test-runner/src/flow-lane/persisted-flow-run.ts:482-486`, `live-llm/live-llm-run.ts:89` | works (runs). Product runs carry no caller. |
| 2 | Adaptation context | The Flow's settings, then a per-run override. `manual_approval` sets `proposalMode:"manual"` and `createAdaptations/promoteAdaptations:false`. An `llmExecution` then turns `invokeLlm/createAdaptations/promoteAdaptations` back on, but leaves `proposalMode` manual. Defaults for a new Flow: `fully_adaptive`, `proposalMode:"auto"`, `allowExternalSideEffects:true`, `requireApprovalForExternalSideEffects:false`. | `runtime/service.ts:2589-2590`; `runtime/service/runtime-adaptation/context.ts:36-55`; `runtime/llm/runtime-session-llm.ts:26-35`; `model/flows.ts:272-288` | works |
| 3 | Detect it cannot continue | The executor ends `failed` at the step (`target_not_found`). The service records the unresolved failed attempt and enters recovery (`recovering: true`). | `runtime/service.ts:2706-2729`; `runtime/recovery/annotation/annotate.ts:123` | works in source; last live proof 2026-09-21 (`run-mubmrcyv`) |
| 4 | Gate and deterministic first | Training mode/budget gate, then the known-adaptation/reroute check before any provider is resolved. A run with no failed attempt is refused before billing. | `annotate.ts:137`, `:171-173`, `:180-192` | works |
| 5 | Resolve a model | The caller's key (`llmExecution`), else the Flow's standing unattended-repair authorization. The host resolver returns `undefined` with no caller. The standing authorization refuses `core.repair.authorization_absent/disabled` unless a person switched its `repair` clause on. | `annotate.ts:203-245`; `runtime/llm/session-key-provider.ts:75`; `runtime/result-check-authorization/repair.ts:82-88`; `runtime/service/runtime-adaptation/repair-authority.ts` | **blocked** for extension/chat runs; works for the Lab (signed-in caller) |
| 6 | Diagnose | `runtime_diagnosis` harness call with failure evidence (the whole page), recovery context, instructions, run thread. Stage B plan from the structured diagnosis. | `annotate.ts:369-404`, `:406` | works in source; live reliability unproven on the current line |
| 7 | Explore | Runs when the plan asks for it (or to check a refusal). The registry is told `mutationsGovernedByPermission: true`, so mutating options are offered whatever the policy flag says. Each action goes to the recovery's permission gate. Moving, opening, typing into an unsubmitted field and similar acts need no permission. Only a lasting consequence (`move_money`, `delete`, `send_or_publish`, `modify_existing`, `create_new`) asks a person, through the run thread when a parking port is bound. `diagnose_and_adapt` skips exploration for failures a target override cannot fix; `explore_and_adapt` does not. **The 2026-09-21 claim (`registry.ts:270-276`, could not press/type/navigate) no longer holds.** | `annotate.ts:421`, `:429-472`; `runtime/recovery/annotation/exploration.ts:28-36`, `:206`; `runtime/llm/harness-options/registry.ts:313-320`; `runtime/action-permissions/consequences.ts:31-36`; `runtime/recovery/annotation/permissions.ts:25-29` | works in source; unproven live |
| 8 | Generate a repair | A `runtime_patch` call restricted to the plan's allowed kinds. `explore_and_adapt` executes the patch (a trial on the live page). `diagnose_and_adapt` only proposes a target override. The side-effect preflight is decided by the gate (`sideEffectPermission:"permitted"`), not the old flag. | `annotate.ts:568-603`; `runtime/recovery/annotation/patches.ts:167-186`, `:271-306`; `runtime/live-patch.ts:147-171` | works |
| 9 | Recognise successful recovery | The trial verdict is `verified` only with a basis: a declared expected state, route, outputs or records, or a downstream assertion. With none, the changed node succeeding gives `unverifiable`. `verified` sets `retryOriginalAction` and the trial confidence that promotion needs. | `runtime/live-patch.ts:316-329`, `:374-388`; `runtime/flow-change/verdict.ts:46-83`, `:137-160` | **unknown** for instruction-built nodes (see blocker 4) |
| 10 | Convert to a reusable change | A target override becomes the durable `edit_action_target`. An inserted step (`temporary_action_sequence`) has no durable form (`edit_recovery`, refused at apply). A Flow that needs a new step, or a control the override check refuses (renamed or moved), goes to the **failed-step re-author route**: the build loop extends the Flow from a brief, then approves and applies it, and the run re-runs from the start. That route needs the run's caller; a standing authorization cannot pay for a build. | `runtime/live-patch.ts:560-569`; `runtime/recovery/refuted-result/step-failure-decision.ts:1-31`; `runtime/service/runtime-adaptation/step-failure-port.ts:35-60`; `runtime/service/runtime-adaptation/reauthor-build.ts:100-115`; `runtime/result-verification/run-outcome.ts:268`, `:402-429` | works (override); works (re-author, with caller) |
| 11 | Promotion decision | Records `autoApply` with `applyAt:"judged_whole_run"`, `applied:false`. Refused when `proposalMode` is `manual`, when there is no succeeded trial, or under `mixed` for structural or high-risk changes. Risk and external-side-effect refusals were removed on 2026-09-28. | `runtime/service/runtime-adaptation/runtime-promotion.ts:32-91`; `runtime/training-modes.ts:329-350`, `:405-409` | works under `auto`; **blocked** under the Lab's and the web panel's `manual_approval` |
| 12 | Continue the current run | `rerunAfterRepair(from:"resume")` resumes at the trial's `resumeFrom` on the unapplied candidate. A trial that ran to the end is adopted as the resumed pass. It needs `retryOriginalAction && approvalDecision.autoApply`. | `runtime/service.ts:2676-2686`, `:2731-2739`; `runtime/service/runtime-adaptation/repair-rerun.ts:111-200`; `runtime/service/adaptations/adaptive-retry.ts:43-61` | works under `auto` plus a verified trial; blocked otherwise |
| 13 | Validate (whole-Flow judged run) | The resumed or re-run session is verified with a repaired-run result check (always checked), judged by the caller's key. Settle rule: applied only if the run `succeeded` and the verdict was performed and `answers`. Otherwise `not_judged`, `refuted`, `run_failed`, `run_parked` and so on. | `runtime/service/runtime-adaptation/result-check.ts:124-131`; `runtime/service/runtime-adaptation/judged-promotion.ts:111-121` | works in source (needs a judge provider) |
| 14 | Persist | A runtime patch is applied through `reviewFlowAdaptation` (actor `runtime`) after the judged run. A re-authored Flow is **approved and applied before its re-run is judged**. Under manual mode nothing applies; the person must review it in Core's web panel Adaptations view. The extension has no approve/apply control (grep: no `review-flow-adaptation` in `apps/extension/src`). | `judged-promotion.ts:316-326`; `reauthor-build.ts:113-114`; `runtime/service.ts:3325` | works (auto); approval surfaced only in the Core web panel |
| 15 | Continue after a person approves | Nothing resumes a parked or approved run; `run_parked` settles final. The person's approval affects the next run. | `judged-promotion.ts:36-37` | blocked (by design) |
| 16 | Replay with zero provider calls | A run with no `runIntent` has no caller, so no provider (and no standing authorization by default). The applied edit is in the stored Flow. The Lab `replay` runs `adaptiveMode: "deterministic"` with the keys removed. | `session-key-provider.ts:75`; ext `packages/test-runner/src/saved-flow-replay/replay-saved-flow.ts:173` | works (dated proof 2026-09-21, single node) |
| 17 | Show it learned | The extension Automations row prints "Learned N new page variation(s)" from `createdAdaptationIds` (the run detail's `adaptationIds`, applied or not). The chat's run command reports only "The run X ended <status>". | ext `apps/extension/src/panel/automations/facts.ts:37`, `summary-copy.ts:19-20`; Core `run-flow.ts:44-49` | partial (row only; may count unapplied adaptations) |

### Ranked blockers, smallest fix, files

1. **Product runs carry no caller, so nothing adapts outside the Lab.** (Blocks MVP items 12-24 in the product, and the user's "watch adaptation" in the extension.)
   - **Fix, Core:** `runtime/conversations/commands/run-flow.ts:36` sends `runIntent: "explore_and_adapt"`. The command port already calls under the person's unlocked session (`api/handlers/conversations.ts:272-274`). Add a test beside it.
   - **Fix, extension Automations Run:** either route it through the same conversation command, or have Core's run handler (`api/handlers/runtime-execution.ts:57-61`) resolve a paired client's actor through `conversations.callerFor` (as `api/handlers/conversations.ts:194` does), and have `apps/extension/src/background/automation-relay/automation-relay.ts:62` send the `runIntent`.
   - **Risk to check first:** a run with a caller makes the scheduled result check spend with the caller's key (`runtime/service.ts:2534-2540`). Item 23 (no unnecessary model calls on a learned run) needs the schedule (`automationStudioRunResultCheck`) to stay quiet on routine runs. Not checked here.
2. **The Lab's created-Flow playback forces `manual_approval`.**
   - **Fix:** in `packages/test-runner/src/flow-lane/persisted-flow-run.ts:484`, send no `adaptiveMode` (or `fully_adaptive`) for `explore_and_adapt`. Keep `manual_approval` for `--llm-task adapt` (`diagnose_and_adapt`), which is proposal-only. Add a test in `flow-lane/tests/`.
   - The `--replays` repair lane then finds the adaptation `applied` already and counts it (`flow-lane/repair/apply-repair.ts:74-79`).
   - Without this fix the target-override path ends the run `failed`: no autoApply, so no resume. The re-author route is also refused (`ladder_patch_executed`), so the created lane fails even when the trial fixed the page.
3. **The repair lane passes a form-task re-author repair with 0 replays.**
   - `resultRepairOf` needs `run.extracted` (`packages/test-runner/src/flow-lane/repair/run-repair-lane.ts:163-166`).
   - A form task repaired by the failed-step re-author has no dataset and no runtime-patch adaptation, so the application is `no_proposal`, and `assertLiveRepairProof` returns early (`flow-lane/repair/prove-repair.ts:83`).
   - **Fix:** accept `resultReauthor.applied` with no datasets (goal-only replay). Add a test in `flow-lane/repair/tests/`.
   - It is assumed, not checked, that the failed-step route writes the same `metadata.resultReauthor` marker (`step-failure-port.ts:57` calls `automationStudioRefutedResultReauthored`).
   - Until this is fixed, run `pnpm lab replay` by hand after each proof run.
4. **(Unknown) Can a trial on an instruction-built node verify?**
   - If built nodes declare no expected state, route, outputs, records or assertions, the verdict is `unverifiable` (`flow-change/verdict.ts:76-81`). The adaptation then stays `testing`, promotion is refused (`training-modes.ts` `promotionEvidenceRefusal`), and `retryOriginalAction` is false, so there is no resume. The re-author route then refuses with `ladder_patch_executed`, which dead-ends the target-override path.
   - **Check:** read the A8 saved Flow's node definitions in the `fxwork/t262` lane tree for `expectedState`, `expectedRoute` or assertion nodes. A grep of `runtime/flow-bootstrap` and `runtime/flow-draft` found no `expectedState`.
   - **Fix if confirmed (Core, design choice):** let the judged whole run be the evidence that a target override worked. Allow the resume and an `autoApply` decision on `changed_node_succeeded` plus a reached continuation, since the judged-promotion settle already refuses an unjudged or refuted run. Files: `runtime/live-patch.ts` (`runtimePatchVerification`), `runtime/training-modes.ts` (`promotionEvidenceRefusal`), `runtime/service/adaptations/adaptive-retry.ts`.
5. **A re-authored Flow is persisted before its re-run is judged** (`reauthor-build.ts:113-114`, then `run-outcome.ts:426-429`).
   - This contradicts the 2026-10-02 rule that judged-promotion enforces for runtime patches. No rollback was found on a refuted re-run.
   - **Smallest fix:** hold the bootstrap apply the way `judged-promotion.ts` does: run the candidate, then apply on `answers`. Files: `reauthor-build.ts`, `step-failure-port.ts`, `refuted-result-port.ts`.
   - This does not block a proof; it is a correctness gap.
6. **Item 24 in the chat.**
   - `run-flow.ts:44-49` could add "learned N" from the answer's `createdAdaptationIds` / `durableBehaviorChanged` (already in the handler payload, `runtime-execution.ts:86-96`).
   - The Automations row's `learned` counts unapplied adaptations (`facts.ts:37`); it should count only `applied` ones, or validated ones.

### Lab "changed after creation" tasks: what each exercises

Common mechanics:

- **Variant.** With `variantArmedAfterBuild`, the build explores the unarmed page. The variant is armed (`set-mode`) only in `prepareFlowPage("playback")` (`packages/test-runner/src/run-scenario.ts:300-305`).
- **Playback.** A run of the Flow the build saved, via `run-runtime-session` with `runIntent:"explore_and_adapt"` and `adaptiveMode:"manual_approval"` (blocker 2), on the Lab account's key. The build itself starts from the extension chat by default; `--direct-api-build` is test-only. Playback does **not** go through the extension's Run or the chat's "run it", so blocker 1 is never exercised.
- **Oracle.** `playback-goal` checks the variant's `expected` (its after-arm page facts, actions and final-state facts). These are the repaired run's expectations.
- **`--replays N`.** Approves and applies the run's adaptations, then replays N times with no model. It fails unless every replay makes 0 provider calls and reaches the final state.

| Task | Variant change | Repair it needs | Oracle (final state) | Notes |
| --- | --- | --- | --- | --- |
| `bigbox-retail-pickup-cart-redesigned-after-creation` | Classes renamed; Add to cart loses its automation id and moves into the buy box; Buy now stands where Add to cart was | Target override to the same-named Add to cart, or re-author | `PICKUP_CART_FACTS`; pressing Buy now fails | Cleanest target-override path: trial, resume, judge, persist. No permission point. |
| `social-network-feed-group-post-regrouped-after-creation` | "Write something..." gone; Create post / poll / event in its place | Re-author (the override check refuses this exact rename: `step-failure-decision.ts:13-16`) | Pending post to admins | `permissionPoint send_or_publish` on "Post": needs `-- --llm-permit send_or_publish`, or it ends at the permission ask. Exercises the failed-step re-author route (blockers 3 and 5). |
| `company-website-quote-request-redesigned-after-creation` | Submit gone; "Get my free quote" at the top of the step; decoy "Save and finish later" in the old place | Override (renamed, so likely refused) or re-author | Path `/quote/received` | Adds a person check (`HUMAN_CHECK`) and a permission point. More moving parts and spend. |
| `job-board-save-halvard-week-redesigned-after-creation` | Heart now follows the company; save moved into an unlabelled More actions menu | Inserted step: re-author only | Shortlist facts | Hardest: a decoy plus a menu step. |
| `crossborder-marketplace-hub-to-cart-flash-deal` | Promotion modal 1.5 s after load blocks the page; big button is a decoy, close glyph dismisses | Dismiss step: inserted step or route-by-state; re-author | `cartCount(3)`, `ordersShipped(0)` | A8's own Flow class (10 nodes). Proves a structural repair, not an override. |
| `identity-drift-rename-redesigned-after-creation` | Save renamed Apply changes, no ids | Target override | Saved name | Cheapest; the 2026-09-21 proof. **Not one of the ten realistic sites**, so it is excluded by the standing rule that live tests run only on those. |
| `bigbox-retail-pickup-towels-list-layout-after-creation`, `crossborder-marketplace-spain-hubs-list-layout`, `local-classifieds-bike-search-list-layout` | List layout after build | Wrong-answer re-author (`resultRepairOf` handles datasets) | Expected dataset | Extraction. Also blocked by C1/C4. Not the cheapest. |
| `crossborder-marketplace-repair-basket-redesign` (Phase 2 candidate list) | Basket redesign | n/a | n/a | A **recorded-Flow** repair task (`--flow --llm-task adapt`, proposal-only), not instruction-built. It does not prove the chain and is out of the measured scope since 2026-09-22. |

### Recommended live proof tasks (after blockers 2 and 3 land, and 4 is checked)

The commands are from `node scripts/lab/live-campaign.mjs --dry-run --no-build <ids> -- --target persistent-isolated --workspace aud-WS --replays 1`. `<ws>` and `<flowId>` are placeholders.

1. **Bigbox, target-override path** (cheapest realistic site; proves trial, resume, judged apply and zero-call replay):
   `pnpm lab run bigbox-retail --variant redesigned-buy-box --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task bigbox-retail-pickup-cart-redesigned-after-creation --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated --workspace <ws> --replays 1`
   then `env -u DEEPSEEK_API_KEY FLUXIQ_TEST_ENV_FILES=none pnpm lab replay bigbox-retail --workspace <ws> --flow <flowId> --instruction-task bigbox-retail-pickup-cart-redesigned-after-creation`
2. **Social feed, re-author path** (proves the structural repair route on a realistic site):
   `pnpm lab run social-network-feed --variant regrouped --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task social-network-feed-group-post-regrouped-after-creation --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated --workspace <ws> --replays 1 --llm-permit send_or_publish`
   then the same `pnpm lab replay social-network-feed ... --instruction-task social-network-feed-group-post-regrouped-after-creation`. The explicit replay is needed until blocker 3 is fixed.
3. **Crossborder, A8 class** (the 10-node Flow the brief names):
   `pnpm lab run crossborder-marketplace --variant flash-deal --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task crossborder-marketplace-hub-to-cart-flash-deal --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated --workspace <ws> --replays 1`
   - An A8-class target-override proof needs a new one-line catalog row: `crossborder-marketplace-hub-to-cart-basket-redesign-after-creation`, variant `basket-redesign`, `variantArmedAfterBuild: true`, in `apps/scenario-lab/src/scenarios/crossborder-marketplace/live-tasks.ts`.
   - The `basket-redesign` variant already declares `RECORDED_ADD_TO_CART_GONE` (`manifest/manifest.ts:57`, `facts.ts:30-31`).

None of these exercise blocker 1 (the product's Run). After blocker 1 is fixed, prove the same chain once by typing "run it" in the extension chat on the saved Flow.

## Commands run and observed results

- `git rev-parse --short HEAD` in Core printed `3c47ed7d` (branch `dev`); in this repository it printed `13bf7450`.
- `node scripts/lab/live-campaign.mjs --dry-run --no-build bigbox-retail-pickup-cart-redesigned-after-creation job-board-save-halvard-week-redesigned-after-creation social-network-feed-group-post-regrouped-after-creation company-website-quote-request-redesigned-after-creation identity-drift-rename-redesigned-after-creation crossborder-marketplace-hub-to-cart-flash-deal crossborder-marketplace-repair-basket-redesign -- --target persistent-isolated --workspace aud-WS --replays 1`
  - It printed `# 7 task(s) ...` and seven `pnpm lab run` lines. The creation lines are as quoted above; the repair task's line is `pnpm lab run crossborder-marketplace --variant basket-redesign --flow --live-llm --llm-profile lab-adapt-repair ... --llm-task adapt ... --llm-max-calls 26`.
  - It read the already-compiled scenario catalog; nothing was built or launched.
- Everything else was `grep`/`sed` reads of the files cited.

## Not verified

- No live behavior: every "works" above is source reading, not a run.
- Whether an instruction-built Flow's nodes declare trial evidence (blocker 4).
- Whether the failed-step re-author writes `metadata.resultReauthor` exactly as the wrong-answer route does (blocker 3).
- Whether `reviewFlowBootstrapAdaptation` apply passes inside a Lab run whose per-run override is `manual_approval` (it reads the stored Flow's mode, which defaults to `auto`).
- Whether the result-check schedule would bill routine runs once product runs carry a `runIntent` (blocker 1 risk).
- How the extension authenticates `run-runtime-session` (paired-client actor or person). The assumption that a paired session has no key comes from the comment at `programs/_shared/runtime.ts:113-117`.
- Whether the Automations row's "Learned N" is gated on `validated` in `summary-copy.ts` beyond line 20.
- The `flash-deal` variant's merge with the base hub-to-cart expectations (coupon facts) was not traced.

## Open questions or contradictions found

1. **The gap map is out of date on four points.**
   - Item 15: exploration can act now.
   - Item 16: the `service.ts:3081` forcing is gone.
   - Item 20: resume exists in source, under `auto`.
   - Item 10: Core now registers `pause-runtime-session` and `resume-runtime-session` (`api/contracts/endpoints.ts:147-148`; not inspected further).
2. **The Lab's playback runs under `manual_approval` while the product default is `fully_adaptive`.** So no Lab run so far could have shown auto-persist. Any "persist" evidence from the Lab is the Lab approving as a reviewer.
3. **The web panel's model-assisted run modes also send `manual_approval`** (Core `apps/web/src/features/automation-studio/runtime/FlowRunView.tsx:195`). A person who asks for a repair there gets a proposal to review, never an applied repair.
4. **Re-author persists before judgement** (blocker 5), against the 2026-10-02 rule.
5. The Phase 2 candidate `crossborder-marketplace-repair-basket-redesign` is a recorded-Flow task and cannot prove the instruction-built chain.
