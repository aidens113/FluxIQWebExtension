# t267 adaptation-loop unblock — lead report

Status: Stages S1 (committed by the supervisor) and S2 done; S2 handed back uncommitted for the supervisor to verify and commit; S3-S5 not started.
Tree: `C:/Users/osrs_/FluxStuff/fxwork/t267/!FluxIQWebExtension` (branch `task/t267-adaptation-loop-unblock`); Core sibling `fxwork/t267/!FluxIQ` (same branch, from `de8eb8e5`): unchanged in S1, changed in S2.
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

## Stage S2 — Core: blocker 4, the judged whole run as a target override's evidence

### Finding: instruction-built nodes declare no trial evidence (settled)

Source: the A8 saved Flow `flow.379f7414-…` in project `e103266b-…`, workspace `t262-a` (`fxwork/t262/!FluxIQWebExtension/test-runs/instances/t262-slot-2/persistent-isolated/t262-a`), named by `run-mutepu6b-656f8882`'s `snapshots/creation-context.json`.
- The lane tree was not opened for writing. I copied `project.sqlite` to the scratchpad (`t267-s2/a8-project.sqlite`) and read `graph_nodes` from the copy.
- Only structure was printed: definition ids, action types, and parameter and metadata key names. No values were read out and no page data is quoted.

What the 10 nodes are and declare:
- 1 `web.browser.navigate`, 6 `web.dom.click`, 2 `web.dom.type`, 1 `builtin.control.merge`.
- Parameter keys are only `url`/`newTab`, `selector`/`element`/`timeoutMs`, `text`/`submit` and `mergeMode`.
- None declares `expectedState`, `expectedRoute`, `expectedOutputs`, `expectedEffects` or `conditions`.
- There is no assertion or expectation node, and nothing stores records.
- Core's build sources (`R/flow-bootstrap`, `R/flow-draft`) never write those fields.

How the trial is decided (`R` = Core `packages/fluxiq/src/programs/automation-studio/runtime`):
- The trial reads evidence only from those fields: `R/executor/expected-transition.ts`, `R/flow-change/trial.ts:157-190`, `R/flow-change/verdict.ts`.
- So a target-override trial on such a Flow whose changed step succeeds is `unverifiable`, and the resume rule says `no_evidence` (`R/flow-change/resume.ts:46`).

That verdict then blocked every later step:
- `live-patch.ts` gave `retryOriginalAction: false` and status `testing`.
- The promotion gate refused on tier `unverified` (`training-modes.ts`).
- `adaptive-retry.ts` declined the resume.
- Even after a judged `answers`, the apply gate would have refused, because `evaluateFlowAdaptationPromotionGates` (`R/recovery/adaptation-promotion.ts`) wants a succeeded trial or replay.

The audit's blocker 4 is therefore real, and it also covered the apply step, which the audit did not name.

### Design (lead) and the files it touched

One marker, threaded through the chain, all in files this brief owns. No t264 file, `flow-change/**`, `recovery/annotation/**`, `recovery/adaptation-promotion.ts` or `model/**` was edited.

1. `R/live-patch.ts`: the `unverifiable` verification gains `awaitsJudgedRun: true`. It is set only for a `temporary_target_override` whose trial verdict is `unverifiable` with `notResumableCode: "no_evidence"`. That code already means: nothing failed or was unknown, a resume point was named, and the changed node succeeded.
   - `retryOriginalAction` is true for verified or awaiting-judged-run patches, and never for `temporary_action_sequence`.
   - The trial still records no validation result, and the adaptation stays `testing`.
2. `R/training-modes.ts`: `AutomationStudioAdaptationPromotionGateInput.awaitsJudgedRun`. The trial-evidence refusal gives way only when it is true and the tier is `unverified` with no `lastFailure`. Manual mode, the first manual review and `mixed` still refuse. The bootstrap apply gate is unchanged.
3. `R/service/runtime-adaptation/runtime-promotion.ts` passes the marker, and records `evidence: "judged_whole_run"` on an unattended allowance.
4. `R/service/adaptations/adaptive-retry.ts`: a receipt that is `no_evidence` but carries the marker resumes, under every resume-point rule.
5. `R/service/runtime-adaptation/judged-promotion.ts`: on `apply` only (the run `succeeded`, a performed `answers` verdict, a pass ran it), it records `{ kind: "trial", status: "succeeded", basis: ["judged_whole_run"] }` before the apply. The apply gate passes on that record, on both the file-store path and the typed-store path; the typed store keeps `validationResults` (`storage/project/adaptation-store.ts:402-418`).
6. The JSON reading lives once, in `R/service/adaptations/verification-awaits-judged-run.ts`, exported through the `adaptations` barrel.

Docs: Core `docs/architecture/package-boundaries.md` gains an unreleased migration note, and both `framework-reference.md` copies were regenerated (`node scripts/docs-reference.mjs`).

The worker added one strictness beyond the brief: the gate requires tier `unverified`, so a missing or malformed confidence decision is still refused.

Worker: t267-s2-judged-run-evidence (worker-high), [report](./t267/s2-judged-run-evidence.md). It reports every new test failing before its fix. For the end-to-end file it disabled the marker, saw both tests fail, and restored it.

### Validation (lead-run, t267 trees, final state)

- `npx vitest run` in Core `packages/fluxiq`, 11 files: `11 passed (11)`, `157 passed (157)`. The files:
  - `R/tests/live-patch-target-override`, `training-modes`, `live-patch`;
  - `R/service/adaptations/tests/adaptive-retry`;
  - `R/service/runtime-adaptation/tests/judged-promotion`, `runtime-promotion` (new), `repair-rerun`;
  - `R/tests/service-adaptation/tests/judged-run-evidence` (new), `judged-promotion`, `promotion-tier`, `adaptive-loop`.

  The worker reports the same 157/157 on two runs.
- The new end-to-end test runs the real `AutomationStudioService` with a stub model. A press that declares nothing fails until re-aimed; the override is trialled and auto-promoted, and the run resumes. When the run is judged `answers` the change ends `applied`, with the judged-run trial recorded and the stored target replaced. When the run is refuted it stays unapplied (`notAppliedReason: "refuted"`, no validation result, target unchanged).
- Core: `node scripts/build-cache/cli.mjs fluxiq:check` exit 0 (cache stamp reused on identical inputs). `node scripts/structure-audit.mjs` `passed (247 warning(s), 349 baselined)`, exit 0. `pnpm.cmd docs:check` "Deterministic framework reference is current.", exit 0. `pnpm.cmd build` exit 0.
- Downstream, against the rebuilt Core: `pnpm.cmd --filter @fluxiq-web-extension/domain check` exit 0; `pnpm.cmd --filter @fluxiq-web-extension/test-runner check` exit 0. The structure audit passes, and no downstream file imports the changed Core types.
- Both reference docs are LF in the index and the working copy (`git ls-files --eol`). The "LF will be replaced by CRLF" warning comes from this machine's `autocrlf`.

### Blocker state after S2

| # | Blocker | State |
| --- | --- | --- |
| 1 | Product runs carry no caller | Open (S3) |
| 2 | Lab playback forced `manual_approval` | Fixed in source (S1, committed); live proof owed |
| 3 | Repair lane passed a re-author with 0 replays | Fixed in source (S1, committed); live proof owed |
| 4 | Instruction-built nodes give `unverifiable` trials | Confirmed on A8's Flow. Fixed in source for target overrides: the judged whole run is the evidence. Live proof owed |
| 5 | Re-authored Flow applied before its re-run is judged | Open (S4) |

### What the Phase 2 live run must show for blocker 4

On a target-override proof (bigbox `bigbox-retail-pickup-cart-redesigned-after-creation`, or crossborder `...-basket-redesign-after-creation`), the run detail's `runtimePatchAttempts[]` (also in the bundle's `snapshots/decision-trace.json`) must show:
- `verification: { status: "unverifiable", awaitsJudgedRun: true }`;
- `retryOriginalAction: true`;
- `approvalDecision: { autoApply: true, applyAt: "judged_whole_run", evidence: "judged_whole_run" }`;
- `adaptiveRetry.attempted: true`.

After `resultVerification` `answers`, the adaptation must be `applied`, with a `validationResults` entry whose `basis` is `["judged_whole_run"]`. The `--replays 1` replay must then make 0 provider calls.

### Not verified (S2)

- Nothing ran live, and the real A8 Flow was not replayed.
- Whether the domain's target-override equivalence check accepts crossborder's renamed control: the redesign changes "Add to cart" to "Add to basket". If it refuses, the run goes to the failed-step re-author instead (blocker 5 applies there). Bigbox's redesign keeps the control's name, so it is the cleaner first proof of this path.
- Full Core suite: not run (narrow checks only, per the twice-a-day rule).

### Notes for S3 onward

- Core `R/tests/live-patch-target-override.test.ts` is at 791 of 800 lines; its next addition needs a split first.
- `R/live-patch.ts` is 667 lines and `R/training-modes.ts` 453.
