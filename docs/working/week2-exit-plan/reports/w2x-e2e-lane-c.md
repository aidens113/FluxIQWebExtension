# w2x-e2e-lane-c: live end-to-end campaign, lane C (auction-marketplace, crossborder-marketplace)

Worker report for `### Brief: w2x-e2e-live-campaign`, lane C (t054, worktree
`F:\fxwork\t054-e2e-lane-c`). Testing only: no source, Lab or scenario file was changed.

## Outcome

**Done.** Every task on both sites was run once, or is recorded below as not runnable, with the reason.
**No task produced a Flow that a model-free replay could judge.**

- No create-flow run built a Flow: 0 of 12 builds (10 Lab runs and 2 panel runs).
- `matchedRecords` was 0 for every dataset task.
- No oracle passed.
- No provider-free replay had anything to replay.

Recorded spend was **$0.350 over 70 provider calls**, well under the $4 cap. The two panel explores are not included, because their driver records no cost on failure (estimate below). There were no HTTP 429s and no RAM-fault retries; every task took one attempt.

What stopped the lane, ranked by how many tasks it hit:

1. **P2: a failed tool call ends the build (`flow_bootstrap.evidence_tool_failed`).** It hit 11 tasks: every creation except two.
2. **Lab defect: the Core action probe loses a race with the sites' start-page overlays.** It blocked 5 of 6 recording lanes and the crossborder repair task.
3. **Exploration stalls, ending in `flow_bootstrap.evidence_repeat_without_progress`.** It hit 2 tasks.
4. **A dismissible promotion modal is classed as needing a person.** Core then refuses to consult the model. This blocked the one recorded Flow that did build, and the auction repair task.

**Revisions.**

| Label | Downstream | Core | Runs |
| --- | --- | --- | --- |
| **R1** | `08e7dc6` | `278c44b` | Step 1 on both sites (7 recording runs); the 5 auction create-flow tasks; auction `place-bid` with no permit |
| **R1b** | `13284d8` | `71e2798` | Everything else: crossborder create-flow, the two `--llm-permit` runs, both repair tasks, both panel creations |

Both R1 and R1b are before P2's fix.

Core `dev` moved past `278c44b` part-way through R1. For 8 R1 runs (the 3 crossborder recordings and the 5 auction creates) I set `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1`, so that they stayed on the brief's pinned `278c44b`. The supervisor's pause then arrived. After it I never used the override again, and the R1b runs passed the Core-commit guard without it.

## Per-task table

Column notes:

- **Calls b/o** is `build.providerCalls` / `observed.calls` from `snapshots/live-llm.json`. It was equal in every run that called a provider.
- **Wall** is the bundle interval (`summary.json` `finishedAt - startedAt`). It excludes the roughly 40-60 s build prelude that each Lab invocation pays.
- Runs are under `F:\fxwork\t054-e2e-lane-c\test-runs\`.
- Every run used `FLUXIQ_TEST_ENV_FILES=none` and `persistent-isolated`, on workspace `lane-c-auction` or `lane-c-crossborder`.
- Ports were allocated by the Lab; none was 3000 or 4711.

### Step 1: provider-free recording lane (`pnpm lab run <site> [--workflow w] --target persistent-isolated --workspace <ws> --flow`), R1

| # | Site / workflow | Run | Wall | Recording | Flow built | Oracle | Records | Failure (code, stage) | Where it stopped | Class |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | auction / primary (place bid) | `run-mubpua9k-560c97af`, retry `run-mubpxdio-31096721` | 21 s, 33 s | never started | no | — | — | `action.dispatch`, `scenario.execute` | The Lab's Core action probe typed into the home-page search box. The "Bid on the go" app promotion (aria-modal) was already over it, and the probe's type was refused as covered by a modal. Deterministic: 2 of 2. | **Lab defect L1** |
| 2 | auction / `watch-endings` | `run-mubpzr82-329c5003` | 60 s | passed (14 steps, 57 entries) | yes, `flow.05183813-…` (9 candidates) | failed | 0/5 (`not_run`) | `user_intervention_required` / `web.intervention.required`, `execution` | Replay's first node, Accept all at (76,683), was covered by the promotion modal. The recording clicked it within the modal's 2.5 s timer and never met it. Core's replay took longer. `harnessRecovery.refusalCode` `llm.gate.training_mode` (no provider on this lane). | **Product gap C** |
| 3 | auction / `kestrel-auctions` | `run-mubq2ny6-9fbff5a2` | 17 s | never started | no | — | — | `action.dispatch`, `scenario.execute` | Same probe failure as #1 | **Lab defect L1** |
| 4 | crossborder / primary (hub to cart) | `run-mubq5u8i-1cad242e` | 25 s | never started | no | — | — | `action.dispatch`, `scenario.execute` | Probe's type into the search box at (640,31) was rejected as covered. The "Welcome back" coupon popup and cookie banner were up. | **Lab defect L1** |
| 5 | crossborder / `spain-hubs` | `run-mubq76yq-65f44037` | 14 s | never started | no | — | — | same | same | **Lab defect L1** |
| 6 | crossborder / `place-order` | `run-mubq93aa-35e7c1a3` | 20 s | never started | no | — | — | same | same | **Lab defect L1** |

Three earlier crossborder attempts at 20:54:24 were refused by the Lab's Core-commit guard before anything started. There is no bundle and no cost.

### Step 2: instruction tasks, `create-flow` (`pnpm lab:campaign <ids> -- --target persistent-isolated --workspace <ws>`)

No run created a Flow, so no `lab replay` was possible: nothing was saved to replay. The `buildMs` values below are the build's own duration.

| # | Task | Rev | Run | Wall (build) | Calls b/o | Cost USD | Flow | Failure (code, stage, HTTP) | Tool trail (last steps) | Class |
|---|---|---|---|---|---|---|---|---|---|---|
| 7 | auction-marketplace-kestrel-auctions | R1 | `run-mubqbl70-bc8f3d71` | 67 s (46.7 s) | 8/8 | 0.0423 | no | `flow_bootstrap.evidence_tool_failed`, `provider_output_validation`, 400 | inspect, navigate (effect applied), detect ×4, then a repeated detect answered `llm_evidence_loop.already_answered` | **P2** |
| 8 | …-kestrel-auctions-grid-view | R1 | `run-mubqe838-8eac8c1b` | 28 s (8.7 s) | 1/1 | 0.0037 | no | same | Only `inspect_current_page` succeeded before the build ended. The failing call is not in the bundle. The panel run on the same pattern (#21, #22) shows it is a browser action failing. | **P2** |
| 9 | …-kestrel-auctions-feedback-survey | R1 | `run-mubqfkqx-8d012ba5` | 22 s (6.9 s) | 1/1 | 0.0037 | no | same | same as #8 | **P2** |
| 10 | auction-marketplace-watch-endings | R1 | `run-mubqh3nu-6918f653` | 102 s (54.5 s) | 12/12 | 0.0625 | no | same | navigate `web.action.rejected.no_progress`; `already_answered` ×2; `core.decision_unusable` = `web.handle.ambiguous`; last recorded step a successful navigate | **P2** (with stall signals, gap B) |
| 11 | auction-marketplace-place-bid, **no permit** | R1 | `run-mubqk3u1-6360f9c5` | 31 s (7.1 s) | 1/1 | 0.0033 | no | same; `permissionRequest: null` | inspect only | **P2**: wrong outcome for a consequential task. No permission request was raised; the build died before reaching the bid. |
| 12 | crossborder-marketplace-spain-hubs | R1b | `run-mubqp9yq-8a54dd04` | 93 s (13.8 s) | 2/2 | 0.0086 | no | same | inspect, navigate (effect applied) | **P2** |
| 13 | …-spain-hubs-list-layout | R1b | `run-mubqs0op-6aeb3172` | 49 s (28.9 s) | 5/5 | 0.0250 | no | same | …, detect, inspect, then inspect `already_answered` | **P2** |
| 14 | crossborder-marketplace-hub-to-cart | R1b | `run-mubqu8sr-a5586117` | 147 s (123.1 s) | 18/18 | 0.0997 | no | same | press `web.action.rejected.target_unobserved` ×3; `already_answered` ×3; `web.handle.ambiguous`; last recorded step a successful navigate | **P2** (with gap B signals) |
| 15 | …-hub-to-cart-flash-deal | R1b | `run-mubqygwh-0b936d56` | 94 s (75.1 s) | 13/13 | 0.0662 | no | `flow_bootstrap.evidence_repeat_without_progress`, `provider_output_validation`, 400 | press `target_unobserved` ×2, `no_progress`, `web.handle.ambiguous`, `already_answered`, then `llm_evidence_loop.rejected.repeat_without_progress` | **Product gap B** |
| 16 | crossborder-marketplace-buy-hub, **no permit** | R1b | `run-mubr1a31-a28c2716` | 32 s (15.3 s) | 2/2 | 0.0086 | no | `evidence_tool_failed`; `permissionRequest: null` | inspect, navigate (effect applied) | **P2**: wrong outcome. The catalog expects `flow_bootstrap.permission_required` naming "Place order"; the build died first. |
| 17 | crossborder-marketplace-buy-hub, `--llm-permit move_money` | R1b | `run-mubr49tq-7d1c390d` | 59 s (29.2 s) | 6/6 | 0.0231 | no | `evidence_repeat_without_progress` | inspect, navigate (effect applied), navigate `no_progress`, `already_answered` ×2, `rejected.repeat_without_progress` | **Product gap B**: not done; oracle never reached |
| 18 | auction-marketplace-place-bid, `--llm-permit move_money` | R1b | `run-mubr73sj-7773dbc0` | 69 s (15.0 s) | 1/1 | 0.0033 | no | `evidence_tool_failed` | inspect only | **P2**: not done |

On the two permit runs: the Lab refuses any grant that does not echo the asked classes back (`live-llm/execution-grant.ts:132`), and both runs proceeded, so Core's grant held `move_money`. The bundle itself records no permitted classes (see L2).

Consequential tasks: auction `place-bid` and crossborder `buy-hub`, both `move_money`.

- No run, with or without a permit, reached the consequential control.
- So the permission-request outcome was never exercised: there was no Core run detail with a permission request to read. `permissionRequest` is `null` in all four builds.
- `hub-to-cart` ("Do not buy anything") was not treated as consequential. No run of it reached a gated control either.

### Step 3: repair tasks (`pnpm lab:campaign <id> -- --target persistent-isolated --workspace <ws> --replays 1`), R1b

| # | Task | Run | Wall | Calls | Cost | Flow | Oracle / records | What happened | Class |
|---|---|---|---|---|---|---|---|---|---|
| 19 | auction-marketplace-repair-watch-redesign | `run-mubr9wfv-cee55071` | ~150 s | 0 | 0 | yes, recorded `flow.569b2fb6-…` | failed, 0/5 | The recording passed. The Flow's first node (Accept all) was covered by the promotion modal, giving `web.intervention.required`. Core's gate `llm.gate.manual_intervention` ("A person must authenticate or intervene") refused the model: `observed.calls` 0, one diagnosis intervention with `validationOk: false`, no patch, no proposal, no adaptation. It never reached the redesigned listing page. `--replays 1` had nothing to apply. | **Product gap C** |
| 20 | crossborder-marketplace-repair-basket-redesign | `run-mubrcy8p-9cce6b57` | 15 s | 0 | 0 | no | — | Same probe failure as #4 (`blocked_by_capability_or_policy/web.action.rejected`, `scenario.execute`). The recording never starts. **Not runnable on this Lab**: the primary workflow's recording lane cannot get past L1. | **Lab defect L1** |

### Step 4: one creation through the real panel and extension, R1b

Drivers: `demo:llm:setup` → `demo:llm:prepare` → `demo:llm:explore:request` → `demo:llm:explore` (→ apply → run).

Configuration:

- `FLUXIQ_LLM_SCENARIO_ID` set to the site.
- `FLUXIQ_LLM_INSTRUCTION` set to the extraction task's catalog instruction, taken from the built catalog.
- `FLUXIQ_TEST_ENV_FILES=none`.
- Lane-local demo workspaces `test-runs/lane-c-demo-{auction,crossborder}` under this worktree.
- Generated lane-local credentials and ports 53051/53052. None of it came from `.env.local`, whose demo directory points at the main checkout.

| # | Site / task | setup | prepare | readiness | explore | apply / run | Failure and where | Class |
|---|---|---|---|---|---|---|---|---|
| 21 | auction / kestrel-auctions | ok, 73 s | ok, 100 s | ok, 3 s | **failed**, 106 s | not reached | `flow_bootstrap.evidence_tool_failed` (HTTP 400; the panel showed its generic "tool-failed" error). Four tool results: inspect plus three navigations with effect applied. The fifth action, a `web.browser.navigate`, **failed in the browser** and ended the build. Bundle `lane-c-demo-auction/evidence/demo-llm-explore-2026-09-21T21-35-11-247Z-918eea`. | **P2** |
| 22 | crossborder / spain-hubs | ok, 98 s | ok, 75 s | ok, 5 s | **failed**, 134 s | not reached | `flow_bootstrap.evidence_tool_failed`. One inspect, then the model's `web.dom.click` **failed in the browser** on the home page, with the coupon popup and cookie banner up. Bundle `lane-c-demo-crossborder/evidence/demo-llm-explore-2026-09-21T21-40-58-896Z-0f5ed8`. | **P2** |

The panel driver prints no cost on failure, and the demo Core keeps no usage record for a failed generation. From the Lab builds' per-call cost (about $0.004 per call), #21 (4-5 decisions) cost about $0.02 and #22 about $0.004. These are **estimates, not records**.

## Product gaps, ranked by tasks hit

1. **P2: build-ending failed tool call.** 11 tasks, 12 runs: #7-14, #16, #18, #21, #22.
   - A single non-success tool result ends the evidence loop with `flow_bootstrap.evidence_tool_failed`.
   - The panel evidence (#21, #22) shows what failed: an ordinary browser action. The first was a same-origin navigate; the second was a click on a page with a coupon modal and cookie banner up.
   - A repeated identical call answered `llm_evidence_loop.already_answered` is the last recorded step in #7 and #13.
   - Five builds died after one or two calls (#8, #9, #11, #16, #18). So on these two sites, P2 alone is enough to prevent any Flow.
   - This is P2's build-ending failed tool call. It also blocks both consequential tasks from ever reaching their permission point, in either permit state.
2. **B: exploration stalls, then the repeat guard.** 2 tasks end on it (#15, #17). Its signals recur in #10 and #14:
   - `web.action.rejected.target_unobserved` (the model presses a handle the evidence does not hold);
   - `web.action.rejected.no_progress`;
   - `core.decision_unusable` = `web.handle.ambiguous`;
   - `already_answered`, then `llm_evidence_loop.rejected.repeat_without_progress`.

   With P2 fixed, these are the next failures to expect on both sites.
3. **C: a dismissible timed interstitial is classed as needing a person.** 2 tasks: #2 (the only recorded Flow that built) and #19 (auction repair).
   - Hammerline shows an aria-modal app promotion 2.5 s after each home or results page load (`apps/scenario-lab/src/scenarios/auction-marketplace/client/shell-script.ts:103`) until "Not now" is pressed.
   - The extension reports a click covered by a rendered aria-modal as `user_intervention_required` (`apps/extension/src/content/action-runtime/results.ts:324-364`, `blockedByModal`).
   - Core maps that class to `manual_intervention` (`packages/fluxiq/src/programs/automation-studio/runtime/recovery/deterministic-diagnosis.ts:113-133`, `recovery/plan.ts:198-199`), and the LLM gate refuses with `llm.gate.manual_intervention`.
   - As a result, neither the deterministic Flow nor a repair grant can press "Not now", which any honest person would do. The redesign the repair task is about is never reached.
   - Crossborder's coupon popup is not aria-modal, so there the same covering is reported as `web.action.rejected` instead.

## Lab defects and observability gaps

- **L1: the Core action probe races the sites' start-page overlays.** 6 tasks: #1, #3, #4, #5, #6, #20.
  - `proveCoreActionRoundTrip` (`packages/test-runner/src/run-scenario.ts:656-690`) checks occlusion with a trial click on the Lab's own tab (`lane-rules/probe-target.ts`). Core then opens a fresh automation tab on the start page, which restarts the site's overlay timer, and types.
  - Core's type took about 2 s here (e.g. 20:49:33.173 → 35.139), so the promotion (auction) or the coupon popup and cookie banner (crossborder) are up by then. The probe also ignores that the recording script's own first step (`accept-cookies`) is what clears the banner.
  - Deterministic: 2 of 2 on the auction primary; 3 of 3 crossborder workflows on each of two passes.
  - The product's refusal is correct. On these two sites, the probe makes three of three workflows unrecordable in the Lab.
- **L2: the Lab's build record omits the failing tool call.** `flow-lane/creation/build-proposal.ts:184-207` keeps Core's diagnostic steps, and the failed step is not among them, so the Lab runs cannot say which tool failed. Only the panel checkpoints could (#21, #22). Two related gaps:
  - `snapshots/live-llm.json` records no permitted consequence classes, so the permit is proven only by the Lab's own grant check.
  - The panel explore driver records no cost on failure.
- **L3: the wrong tab is screenshotted.** A create-flow run's failure screenshot shows the Lab's original tab (always the home page with its overlays), not the automation tab where exploration stopped. "Where on the site it stopped" can therefore only be read from the tool trail.

No site defect was found: every overlay is dismissible the way a person would dismiss it, and the manifests' own scripts do so. No provider noise: no 429s, and no retries of any kind. Nothing was flaky: every failure repeated wherever it was repeated.

## What changed and why

No repository file changed; `git status` in the worktree is clean at `13284d8`. The only file written in the repository is this report.

Scratch files, including the lane-local demo credentials, are in my session scratchpad only. That covers the run helpers, logs, campaign summaries, the instruction texts and the generated credentials. Persistent state is in the worktree's ignored `test-runs/`:

- the Lab workspaces `persistent-isolated/lane-c-auction` and `persistent-isolated/lane-c-crossborder`;
- the demo workspaces `lane-c-demo-auction` and `lane-c-demo-crossborder`.

## Commands run and observed results

All runs were in `F:\fxwork\t054-e2e-lane-c` with `FLUXIQ_TEST_ENV_FILES=none`.

- `node scripts/lab/run-lab.mjs run <site> [--workflow <w>] --target persistent-isolated --workspace <ws> --flow`, 7 runs (#1-#6 and one retry) → all `failed`: 6 at the probe with `action.dispatch`, and 1 (`watch-endings`) with `runtime.behavior` after the Flow was built.
- `node scripts/lab/live-campaign.mjs <5 auction ids> -- --target persistent-isolated --workspace lane-c-auction` → "0 of 5 runs passed … Provider calls 23; reported tokens 258087; reported cost $0.115517".
- `node scripts/lab/live-campaign.mjs <5 crossborder ids> -- --target persistent-isolated --workspace lane-c-crossborder` → "0 of 5 runs passed … Provider calls 40; reported tokens 465096; reported cost $0.208087".
- `… crossborder-marketplace-buy-hub -- … --llm-permit move_money` → 0 of 1, 6 calls, $0.023141.
- `… auction-marketplace-place-bid -- … --llm-permit move_money` → 0 of 1, 1 call, $0.003311.
- `… auction-marketplace-repair-watch-redesign -- … --replays 1` → 0 of 1, 0 calls, "no diagnosis validated".
- `… crossborder-marketplace-repair-basket-redesign -- … --replays 1` → 0 of 1, 0 calls, "no recovery record: no Flow ran".
- `scripts/setup-demo-llm-key.mjs`, `prepare-demo-llm-workspace.mjs`, `inspect-demo-llm-exploration-request.mjs`, `run-demo-llm-exploration.mjs`, for each site → setup `configured` (leak attestation `findingCount: 0`), prepare `prepared`, readiness `ready`, explore `failed` with "Evidence-guided Flow generation failed (generation.provider-output-validation)".
- Each verdict above was read from the files, not the printed verdict: `evaluation.json`, `summary.json`, `events.ndjson`, `snapshots/live-llm.json`, `snapshots/flow-lane.json`, screenshots and the panel evidence checkpoints. Core's project databases were queried read-only for adaptations; there were none.

## Not verified

- **The permission-request outcome of either consequential task.** No build reached the consequential control, so there was no Core run detail with a permission request to read.
- **Any `lab replay`, `--replays` proof, or panel apply/bound run.** No Flow was created and no adaptation saved.
- **Which tool failed in the Lab's one-call builds (#8, #9, #11, #18).** It is inferred from the panel runs on the same sites, not recorded.
- **The panel explores' provider cost.** Estimated only.
- **Whether Core's roughly 2 s per type is itself a latency defect.** It is what makes the probe race deterministic here.
- **Round-1 auction `place-bid` with no permit was not rerun on R1b**, as instructed, so the no-permit and permit runs of that task are on different revisions.

## Open questions or contradictions found

1. **Gap C against the capability rule.** The extension's modal rule is deliberate: W14 requires `user_intervention_required` for an interstitial. Applied to an app promotion that has a "Not now" button, it contradicts the rule that FluxIQ is capable by default and escalates only destructive acts. Should a dismissible aria-modal remain a person's job, or should the model be allowed to dismiss it?
2. **The recorded Flow in #2 replays too slowly.** Core's replay takes longer than the site's 2.5 s timer, so it meets an interruption the recording never saw. Should a recorded Flow carry an "if this interstitial appears, dismiss it" branch, or is that the harness's job?
3. **L1 invalidates the recording lane on both sites.** The fix is in the Lab probe, not in the scenarios. Until it lands, the crossborder repair task cannot run at all.
