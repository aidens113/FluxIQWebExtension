# t267 adaptation-loop unblock — lead report

Status: Stage S1 done; S2-S5 not started (S1 handed back for the supervisor to commit).
Tree: `C:/Users/osrs_/FluxStuff/fxwork/t267/!FluxIQWebExtension` (branch `task/t267-adaptation-loop-unblock`, at `f310ca8b`); Core sibling `fxwork/t267/!FluxIQ` at `de8eb8e5`, unchanged in S1.
Brief: `t267-adaptation-unblock` in `../mvp-final-month-plan.md`; blockers numbered as in [the audit](./adaptation-loop-audit.md) "Ranked blockers".

## Stage S1 — Lab: blockers 2 and 3, A8-class catalog row

### Findings (lead, from source)

- **Blocker 2 had a second lock the audit missed.** The per-run `adaptiveMode: "manual_approval"` (`flow-lane/persisted-flow-run.ts` `runLiveFlow`) was one. The other was the Flow itself: `repairAuthorizer` (`live-llm/live-llm-run.ts:419-425`) re-saves the Flow's LLM settings before the playback through `configureFlowLiveLlmExecution`, which stored `adaptationMode: "manual_approval"`. `update-flow-settings` takes a patch that also carries `adaptationPolicySettings` as written (Core `api/handlers/flows.ts` `withStatedInterventionMode`). At run time `mergedFlowSettingsMetadata` (Core `runtime/service/flow-settings/merged-metadata.ts`) canonicalizes a stored `manual_approval` through `withAutomationStudioInterventionMode` (Core `model/flows.ts:82-114`) to `proposalMode: "manual"`, `allowPromotion: false`. So removing only the run override would still have held every repair as a proposal.
- Core has no rule that a model run must be `manual_approval`; the `flow-settings.ts` comment saying so was stale. `authorizedExternalSideEffects: false` (still sent) only matters when a Flow's policy sets `requireApprovalForExternalSideEffects` (default false; Core `runtime/live-patch.ts:155`).
- **Blocker 3 is narrower than the audit stated.** The created lane always hands the repair lane `extracted` as an array (`persisted-flow-run.ts` `outcomeFromDetail`), so a form task gives `[]`. An empty array is truthy, so `resultRepairOf` already found the re-author. The real gaps: it keyed on `extracted` being present (a caller omitting it got `no_proposal` and 0 replays), and with `[]` it checked "the replay stored no rows" rather than a goal-only replay.
- **The failed-step route writes the same marker (confirmed).** `step-failure-port.ts:69-71` records through `automationStudioRefutedResultReauthored` (`recovery/refuted-result/reauthor.ts:192`), and a built edit returns `applied: true` (`reauthor.ts:168`). The marker is `resultReauthor: { routed: true, adaptationId, applied: true, attempts }`. It is saved before the re-run (`result-verification/run-outcome.ts:423-424`), and the re-run uses the same `rerunRepairedFlow` port as the wrong-answer route. The route is taken only when the ladder "executed no patch and made no adaptation" (`step-failure-decision.ts:24-25`, `:115`), so the run's `adaptationIds` hold no unapplied ladder adaptation that the lane would try to approve on top of the re-authored Flow.
- The `basket-redesign` variant fits a created hub-to-cart task. Its facts are start-of-run (`cartCount(0)`, `couponsHeld()`, recorded add-to-cart gone), and its `finalState` is `NOTHING_BOUGHT` (three in the cart), the same shape as the `flash-deal` row. The row joins the HUB_TO_CART instruction family, so the permission-point and person-check catalog tests needed no change.

### Worker briefs (foreground, partitioned by file)

| Brief | Agent | Files | Report |
| --- | --- | --- | --- |
| t267-s1-playback-mode (blocker 2) | worker | `flow-lane/persisted-flow-run.ts` + test, `live-llm/flow-settings.ts` + new test | [s1-playback-mode](./t267/s1-playback-mode.md) |
| t267-s1-repair-lane (blocker 3) | worker | `flow-lane/repair/run-repair-lane.ts` + test | [s1-repair-lane](./t267/s1-repair-lane.md) |
| t267-s1-catalog | worker-low | `crossborder-marketplace/live-tasks.ts` + new `tests/live-tasks.test.ts` | [s1-catalog](./t267/s1-catalog.md) |

### What changed

- **Blocker 2 (fixed in the Lab).** `liveFlowAdaptationModeOf(intent)` (`flow-lane/persisted-flow-run.ts`) is the one rule: `explore_and_adapt` gives `fully_adaptive`; `diagnose_and_adapt`, `diagnosis_only`, `verify_result` and `build_and_adapt` give `manual_approval`.
  - `runLiveFlow` sends no `adaptiveMode` for `explore_and_adapt`.
  - `configureFlowLiveLlmExecution` stores the rule's mode, and its read-back now refuses a Flow whose stored `adaptationMode` differs. The worker confirmed that `get-flow` returns the stored mode verbatim.
  - The build still stores `manual_approval`, and the playback re-saves `fully_adaptive` before it runs. A recorded Flow's `--llm-task repair` (also `explore_and_adapt`, `live-llm-plan.ts:203`) now runs `fully_adaptive` too, deliberately.
- **Blocker 3 (fixed in the Lab).** `resultRepairOf` (`flow-lane/repair/run-repair-lane.ts`) takes the re-author whenever `resultReauthor.applied` is true with an `adaptationId`. It passes `expectedDatasets` only when the run stored at least one dataset; otherwise each replay is judged goal-only (zero provider calls, the run succeeding, the fixture goal, `datasetsReproduced: null`). The published `repair: "result_reauthor"` label is unchanged.
- **Catalog.** `crossborder-marketplace-hub-to-cart-basket-redesign-after-creation` (variant `basket-redesign`, `variantArmedAfterBuild: true`, kind `form`, HUB_TO_CART, `playback-goal`), with a test that it equals the base row except for the variant and the arm.
- **Docs.** `docs/architecture/testing-facility.md` gains a new subsection, "How the created Flow's playback adapts", covering both mode locks and how `--replays` treats an applied adaptation and a re-author. Its crossborder catalog row names the new task.

### Lead integration fixes (after the workers returned)

1. The structure audit failed on the playback-mode change in two ways. `persisted-flow-run.ts` reached 808 lines (limit 800), and `live-llm/flow-settings.ts` imported `../flow-lane/persisted-flow-run.js` instead of the barrel. A separate module was not possible:
   - `flow-lane/` already holds 25 source files (the limit).
   - `flow-lane` cannot import `live-llm`, because `live-llm` imports the `flow-lane` barrel.

   So the rule stays in `persisted-flow-run.ts` in compact form (797 lines), and `flow-settings.ts` imports it from `../flow-lane/index.js`.
2. `live-llm/tests/live-llm-run.test.ts` ("a create-flow run repairs the Flow it built with explore_and_adapt...") asserted that the playback's saved settings equal the build's. The playback-mode worker did not run this file. It now asserts they are equal apart from the mode, and that the modes are `manual_approval` for the build and `fully_adaptive` for the playback.

### Validation (lead-run, t267 tree, final state)

- Test runner: the shared `t262-gate/run-subset.mjs` cannot resolve `esbuild` from `packages/test-runner` or `apps/scenario-lab` in an `fxwork` tree. The workers' patched copy at `<scratchpad>/t267-s1/run-subset.mjs` resolves esbuild from `domain/` and bundles `@fluxiq/client-gateway-websocket`. Every scratch build directory was deleted afterwards. They are not git-ignored, and the structure audit scans them (18 false file-line failures when it ran while they were present).
- `node <scratchpad>/t267-s1/run-subset.mjs <test-runner> t267-s1-lead` on 11 files, then `node --test` printed `# tests 138 # pass 138 # fail 0`. The files: `flow-lane/repair/tests/{run-repair-lane,replay-repair,apply-repair}`, `flow-lane/tests/{live-repair-lane,harness-recovery,persisted-flow-run}`, `live-llm/tests/{flow-settings,live-llm-run,reauthor-record}`, `run-scenario/decision-trace/tests/read-decision-trace`, `tests/existing-fluxiq-control`. The first run had 137/1, the `live-llm-run` assertion fixed above.
- The same runner on 6 more files that drive `run-runtime-session` or `repairAuthorizer` printed `# tests 70 # pass 65 # fail 5`. The files: `facility-failure/tests/project-facility-failure`, `flow-lane/creation/tests/lane`, `flow-lane/tests/live-run-settlement`, `tests/{clone-source-exporter,demo-llm-exploration-adaptation,existing-flow-run}`.
  - All 5 failures are ENOENT in `demo-llm-exploration-adaptation`: it reads repository files relative to its module, and the scratch layout is one directory deeper than `dist/`.
  - Under the real layout, `pnpm.cmd --filter @fluxiq-web-extension/test-runner build` then `node --test dist/tests/demo-llm-exploration-adaptation.test.js` printed `# tests 15 # pass 15 # fail 0`.
- The worker reports record the new tests failing before their fixes (blocker 2: 32/3; blocker 3: 13/3).
- Scenario-lab: the runner on `crossborder-marketplace/tests/{live-tasks,scenario}` and `tests/live-instructions` printed `# tests 25 # pass 25 # fail 0`.
- `pnpm.cmd --filter @fluxiq-web-extension/test-runner check` exit 0. `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check` exit 0.
- `node scripts/structure-audit.mjs`: downstream `passed (169 warning(s), 118 baselined)`, exit 0. Core (unchanged) `passed (245 warning(s), 349 baselined)`, exit 0. No Core rebuild was needed.
- No CRLF in any changed or new file.

### Blocker state after S1

| # | Blocker | State |
| --- | --- | --- |
| 1 | Product runs carry no caller | Open (S3) |
| 2 | Lab playback forced `manual_approval` | Fixed in source (per-run override and stored Flow mode); live proof owed |
| 3 | Repair lane passed a re-author with 0 replays | Fixed in source (goal-only replay; failed-step marker confirmed in Core); live proof owed |
| 4 | Instruction-built nodes may give `unverifiable` trials | Unknown (S2) |
| 5 | Re-authored Flow applied before its re-run is judged | Open (S4) |

### Proof commands for the Phase 2 live run (not launched)

From `node scripts/lab/live-campaign.mjs --dry-run --no-build crossborder-marketplace-hub-to-cart-basket-redesign-after-creation bigbox-retail-pickup-cart-redesigned-after-creation social-network-feed-group-post-regrouped-after-creation -- --target persistent-isolated --workspace t267-WS --replays 1` (exit 0, 3 tasks):

1. `pnpm lab run crossborder-marketplace --variant basket-redesign --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task crossborder-marketplace-hub-to-cart-basket-redesign-after-creation --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated --workspace <ws> --replays 1`
2. `pnpm lab run bigbox-retail --variant redesigned-buy-box ... --instruction-task bigbox-retail-pickup-cart-redesigned-after-creation ... --replays 1` (same flags)
3. `pnpm lab run social-network-feed --variant regrouped ... --instruction-task social-network-feed-group-post-regrouped-after-creation ... --replays 1 --llm-permit send_or_publish`. The permit is required (permission point `send_or_publish` on "Post"); the dry run above did not add it.

Each run must show, in `snapshots/live-llm.json` and the run detail:
- the playback's `adaptiveMode` metadata `fully_adaptive`, and the Flow's stored `adaptationMode` `fully_adaptive`;
- for (1) and (2), a target-override trial, a resume and a judged `answers` apply (or blocker 4's `unverifiable` refusal, which S2 settles);
- for (3), `resultReauthor.applied` and `snapshots/repair-lane.json` with `repair: "result_reauthor"` and every replay at 0 provider calls.

Blocker 4 (S2) can still dead-end (1) and (2), so run (3) first, or after S2.

### Not verified

- No live, Lab, browser or provider run, so Core's actual promotion, resume and judged apply under `fully_adaptive` in a Lab playback is unproven.
- The repair-lane fix was tested against a fake marker shaped like Core's, not one a real failed-step re-author wrote.
- Whether `fully_adaptive` changes how a recorded Flow's `--llm-task repair` run settles in the Lab's expectations. Recorded Flows are out of the measured scope since 2026-09-22, and none was run.

### Notes for S2 onward

- `flow-lane/persisted-flow-run.ts` is at 797 of 800 lines, and `flow-lane/` at its 25-file limit. The next addition there needs a split first (for example the live-run request into a `flow-lane/live-run/` directory).
- The shared `t262-gate/run-subset.mjs` needs the two fixes above to work for `packages/test-runner` and `apps/scenario-lab` in `fxwork` trees.
