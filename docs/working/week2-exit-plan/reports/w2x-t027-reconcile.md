# w2x-t027-reconcile

Worker report for brief `w2x-t027-reconcile` (Week 2 exit plan). All changes
are uncommitted and unstaged in the paired t027 worktrees
`F:\fxwork\t027\!FluxIQWebExtension` and `F:\fxwork\t027\!FluxIQ` (branch
`task/t027-multi-action-exploration`). Nothing else was touched.

## Outcome

Done. t027's first-generation multi-action surface is removed from both trees.
Production is back to `dev`'s behaviour: one action per model decision, no
list schema, and no Lab max-action control. Every independent t027 change is
kept.

- The negative inventory is empty.
- Both live runs gave the expected results on the reconciled code.
- The focused tests, downstream `pnpm check`, Core `check` and Core `build`
  all pass.
- Two supervisor-authorized ratchet changes keep Core's structure audit
  green. Neither baseline was raised.

## What changed and why

The authority is the integration map
(`bootstrap-no-proposal-investigation/reports/w2-t027-t033-integration-map.md`).
t033 has not landed, so wherever the map names t033 as authoritative, `dev`'s
version is used instead. "dev + X" below means `dev`'s file with only commit
X's hunks replayed, applied with `git apply` from `git show X -- <file>`.
Line counts matched the original commit stats exactly.

### Core (`F:\fxwork\t027\!FluxIQ`)

| File (under `packages/fluxiq/src/programs/automation-studio/` unless noted) | t027 commits (map class) | Treatment |
| --- | --- | --- |
| `api/contracts/adaptation.ts` | ef7892f (superseded) | Restored to `dev` |
| `api/handlers/llm-generation.ts` | ef7892f (superseded), bb430e4 (independent) | `dev` + bb430e4: grant-issue code mapping kept; no `maxActionsPerDecision` |
| `api/handlers/tests/llm-generation.test.ts` | bb430e4 | bb430e4 kept; `readyLlmApiService` mock gains `llmEvidenceRuntime` (supervisor option a) |
| `api/handlers/tests/llm-permission.test.ts` | none (`dev` file) | Mock gains `llmEvidenceRuntime` (supervisor option a) |
| `runtime/flow-bootstrap/generation-failure.ts` | ef7892f, 042562e (superseded), 949735d | `dev` + 949735d: categorical pre-provider codes and accounting |
| `runtime/flow-bootstrap/tests/generation-failure.test.ts` | 042562e, 949735d | `dev` + 949735d |
| `runtime/llm/deepseek-provider.ts` | 4b79c00 (superseded) | Restored to `dev` |
| `runtime/llm/evidence-batch/{decision,index,packet,run,schema,stop}.ts` | ef7892f | Deleted (t027-only) |
| `runtime/llm/evidence-window.ts` | ef7892f | Deleted (t027-only) |
| `runtime/llm/evidence-loop.ts`, `harness/{output-validation,provider-result,structured-response}.ts`, `loop-limits/{evidence-loop,flow-bootstrap-evidence-loop}.ts` | ef7892f | Restored to `dev` |
| `runtime/llm/tests/evidence-loop-provider.test.ts` | 4b79c00 | Restored to `dev` |
| `runtime/llm/index.ts` | ef7892f | `dev` + one barrel line for `resolver-contract.ts` |
| `runtime/llm/resolver-contract.ts` | new | Ratchet move (see below) |
| `runtime/service.ts` | ef7892f, 042562e (superseded), 949735d | `dev` + 949735d (`llmEvidenceRuntimeStatus` data and categorical bootstrap-boundary `failureCode` assignments; no `batchDecisions`), then the two ratchet changes |
| `runtime/tests/deepseek-bootstrap-exploration.test.ts` | 949735d | Restored to `dev` (reason below) |
| `runtime/tests/service-bootstrap/tests/generation.test.ts` | 042562e | `dev` + the readiness `toEqual` shape (supervisor option a) |
| `apps/web/src/lib/fluxiq.ts` (Core root) | 1079ba8, 949735d | Kept; one line now reads the status from the readiness method (option a) |

These independent files are untouched and remain as on t027:

- 1079ba8 (`instrumentation.ts`, lib test);
- b3f772f (operations doc);
- fe6e77a (hierarchy and modal files);
- 680c515 and 2dcf06b (authoring panel, model and test; package export;
  `action-permissions/client`; package-boundaries doc);
- bb430e4 (settings files, `recovery/annotation`, `recovery/stages`).

**Why the deepseek test went back to `dev`.** 949735d's only change to it
expects `resultCode` on a stored `unusable` trace step. That value survives
only because of superseded 042562e's sanitizer hunk: `dev`'s
`sanitizeEvidenceLoopTrace` drops it. No downstream code reads the stored
trace's `resultCode`, so the test returns to `dev`.

**Ratchet changes** (supervisor-authorized). `service.ts` file lines, against
a baseline of 6,404:

| State | Lines |
| --- | ---: |
| t027 HEAD | 6,441 |
| After reconciliation | 6,412 |
| After moving the three resolver-contract types into `runtime/llm/resolver-contract.ts` | 6,385 |
| After the fold below (final) | 6,381 |

The three moved types are `AutomationStudioLlmProviderResolution`,
`AutomationStudioLlmProviderResolverInput` and
`AutomationStudioBuildAndAdaptExecutionGrant`. `service.ts` imports them and
re-exports them, so existing importers are unchanged.

`AutomationStudioService` class methods, against a baseline of 223: 224 after
reconciliation (audit-reported), then 223 final. The fold removed
`llmEvidenceRuntimeStatus()` and returns the same `{ bound, toolCount }` as
`getFlowBootstrapGenerationRuntimeReadiness().llmEvidenceRuntime`.
`apps/web/src/lib/fluxiq.ts` still publishes
`automationStudio.llmEvidenceRuntime` in the same shape, so the panel's
preflight status is unchanged. The API handler still copies only its two
original readiness fields.

**Deviation from the supervisor's suggested name.** The file is
`resolver-contract.ts`, not `provider-resolution.ts`. `runtime/llm` already
holds `provider-contract.ts` and `provider-factories.ts`, so a third
`provider-` file trips the naming rule's prefix-group limit of 3. The
depth exemption does not apply (7 + 1 < 9 segments).

### Downstream (`F:\fxwork\t027\!FluxIQWebExtension`)

| File | t027 commits (map class) | Treatment |
| --- | --- | --- |
| `apps/extension/e2e/content/tests/exploration-state/tests/multi-action-{exploration,safety}.spec.ts` | 719a34d | Deleted |
| `packages/test-runner/src/{cli,commands}.ts`, `flow-lane/creation/lane.ts`, `live-llm/{live-llm-plan,live-llm-run}.ts` | 719a34d (superseded) | Restored to `dev` |
| `packages/test-runner/src/flow-lane/creation/build-proposal.ts` | 719a34d, 88329d0 (superseded) | Restored to `dev` |
| `packages/test-runner/src/flow-lane/creation/tests/build-proposal.test.ts` | 88329d0 | `dev` + 88329d0's three non-batch expectations (reason below) |
| `packages/test-runner/src/existing-fluxiq-control.ts` | 719a34d, 88329d0, 03c20a6 | `dev` + 03c20a6: `batchDecisions` parser dropped, terminal repair outcome kept |
| `packages/test-runner/src/tests/existing-fluxiq-control.test.ts` | 03c20a6 only | Kept unchanged |
| `domain/src/runtime/llm-evidence/tools.ts` | 719a34d sentence, bb1a863 | Kept unchanged, including the 719a34d sentence |

**Why the build-proposal test is a union.** `dev`'s test is stale against
`dev`'s own `build-proposal.ts`, which always returns `instructedConsequences`
and `permissionRequest` and makes one extra `get-flow-adaptation` read. Two
of its tests therefore fail on `dev`'s source. 88329d0 had fixed those
expectations together with its batch fields, so restoring `dev`'s test broke
this branch. The union restores the three non-batch expectations and adds no
`batchDecisions`. **`dev` itself still has this defect.**

## Commands run and observed results

### Negative inventory

I grepped both trees for `MAX_ACTIONS_PER_DECISION`, `maxActionsPerDecision`,
`batchDecisions`, `evidence-window`, `tool_calls` and `evidence-batch`, over
the added lines of `git diff dev -- . ':!docs'` plus the untracked files.

- **Result:** 0 hits in both trees; the new file is clean.
- **Docs:** 17 historical t027 campaign reports under `docs/working/` still
  mention batch terms. The map says to keep them as the measurement record.
  They are outside my scope and were left alone.
- `git diff --check` is clean in both trees.

### Live run 1: `pnpm panel:golden`

Setup: fresh run root `F:\fxlab-runs\w2x-t027-reconcile`, ports 3463/4993,
headless Chromium with the unpacked Chrome build, DeepSeek from `.env.local`.

- **Key setup.** The one-time `pnpm demo:llm:setup` into the fresh store
  returned `configured` with zero redaction findings, exit 0, 129.7 s.
  Bundle: `demo-llm-key-setup-2026-09-21T18-15-33-882Z-3cf0b1`.
- **Top level.** `pnpm panel:golden` exited 1 after 194.6 s with
  `{"status":"failed","reasonCode":"panel_golden_path.failed"}`, at the
  repair stage as the brief expected. The bundles are under
  `F:\fxlab-runs\w2x-t027-reconcile\workspace\evidence\`.
- **Prepare.** `demo-llm-blank-prepare-2026-09-21T18-20-37-136Z-124fd1`.
- **Explore.** `demo-llm-explore-2026-09-21T18-20-58-516Z-1ea03e`: verdict
  passed, 118 events. HTTP 200, no visible error, proposal
  `statusProposed: true`. 1 provider call and 1 evidence tool call; tokens
  6,398 in, 243 out, 6,641 total.
- **Apply.** `demo-llm-exploration-request-apply-2026-09-21T18-21-27-536Z-3c592b`:
  passed; flow-adaptation count 1.
- **Bound run.** `demo-llm-exploration-request-run-2026-09-21T18-21-50-184Z-e5af83`:
  passed. 4/4 actions succeeded (type, select, click, wait_for_text) in No-LLM
  mode, and `runtime-run` took 8,221 ms. The lane stops with a failure if the
  manifest oracle fails, or if `validateBoundExplorationRun` sees any provider
  call or intervention. The golden path went on to the repair stage, so both
  checks passed.
- **Repair (expected failure).** `demo-llm-exploration-adaptation-2026-09-21T18-22-14-796Z-9b5e79`:
  failed. The drifted first action failed, then one bounded diagnosis ran.
- **Durable readback.** A provider-free script in my scratchpad started the
  isolated Core and read the bound Flow (8.7 s, ports released):
  - **Adaptations:** exactly one on the Flow (the creation proposal), now
    `applied`.
  - **Created-Flow run:** `succeeded`, 4/4 actions, 0 provider calls, no
    interventions.
  - **Repair run:** `failed`, 1 provider call, 1 `diagnosis` intervention,
    0 runtime patch attempts, 0 adaptations, 0 change proposals.
  - **Repair outcome code: `llm.runtime_patch_not_requested`.**

### Live run 2: one replay of the saved four-action Flow

Setup: the saved store was copied with robocopy (215 files, 10,801,077 bytes,
identical) from `F:\fxlab-runs\t027-runtime-trace\workspace-final` into
`F:\fxlab-runs\t027rp\workspace`, without its browser profiles. It ran on the
store's original ports 34127/49127, because the saved state checks its
origin.

- **Command.** `pnpm demo:run`: exit 0 after 58.5 s,
  `{"status":"passed", runtimeRunId 1680aadc-bafd-4747-aea4-4ab8838c57ec}`.
- **Bundle.** `demo-playback-2026-09-21T18-26-01-989Z-48bf10`: verdict passed,
  102 events, 86 screenshots. `runtime-run` took 8,260 ms (the earlier proof
  was 8,165 ms). 4/4 actions succeeded (type, select, type, click). The lane
  gates on the submitted-page oracle and on every action succeeding.
- **Durable readback.** `succeeded`, 0 provider calls, 0 interventions,
  0 adaptations, 0 change proposals, 1 route decision, 1 subflow.

I made no fixes after the live runs, because they found no failure caused by
the reconciliation.

### Which Core code the live runs used

The Lab's Core web build bundles `fluxiq` from `packages/fluxiq/src`, through
`tsconfig.base.json` paths and a junction to the worktree's `packages`.

- My last Core source edit was at 11:17:47. The golden run started at 11:19:21
  and built its panel at 11:19:46. The replay reused that cached build. So
  both runs used the reconciled Core.
- The downstream host module imports five symbols from `fluxiq/*` through
  package exports, which resolve to `dist`. That `dist` was stale (t027 HEAD)
  until the Core build below, but none of those symbols' sources were touched
  by the superseded commits. This is reasoned, not measured.

### Focused tests (after the live runs)

- **Core package**, `npx vitest run` from `packages/fluxiq`: 9 files,
  **126/126 passed**. Files: generation-failure, llm-generation,
  llm-permission, service-bootstrap generation, action-permissions client,
  recovery annotate, recovery stages, deepseek-bootstrap-exploration,
  evidence-loop-provider.
- **Core web**, from `apps/web`: blank-flow-authoring and lib `fluxiq`,
  2 files, **41/41 passed**.
- **Extension**: automation-tab and action-runner, **34/34 passed**.
- **Domain**: target candidates and llm-evidence tools, **18/18 passed**.
- **How extension and domain ran.** A scratch runner bundled only the named
  files with the package's own esbuild settings. It wrote to that package's
  ignored `.test-build-scratch/w2x-t027-rec` directory, removed it afterwards,
  and ran the bundles with `node --test`.
- **test-runner**, from `dist`: commands, existing-fluxiq-control,
  browser-session and build-proposal. The first run gave 56/58, with 2
  build-proposal failures (the stale `dev` expectations described above).
  After the union and a rebuild: **58/58 passed**.

### Repository gates

- **Core structure audit**, run before the live runs to settle the ratchet:
  passed, 170 warnings, 361 baselined. It notes that one baseline entry can be
  lowered.
- **Core `pnpm check`:** exit 0 in 36.1 s. Structure tests 182/182; task
  tests 20/20; audit passed; `tsc --noEmit` Done for contracts,
  client-gateway-websocket, fluxiq and web.
- **Core `pnpm build`:** exit 0 in 65.6 s. The rebuilt `dist` has
  `resolver-contract.d.ts` and the `llmEvidenceRuntime` readiness field, and
  no `llmEvidenceRuntimeStatus`.
- **Downstream `pnpm check`:** exit 0 in 55.6 s. Structure tests 182/182;
  lab tests 74 pass and 0 fail of 75; task tests 113/113; structure audit
  passed; all ten package checks Done.

## Not verified

- **No pre-reconciliation live baseline.** I relied on earlier t027 reports.
- **Permission path.** The permission-dialog continuation was not exercised:
  the provider asked for no permission.
- **Unreached golden stages.** Stages after repair (repair apply, restart
  reuse, recording, recording replay) were not reached. This is expected.
- **Browsers.** Headless Chromium only; the Firefox build was not tested.
- **Suites.** No full suites were run, by design.
- **Class-method count at t027 HEAD** was not measured separately. 224 is the
  audit's count after reconciliation.
- **Host-module imports from `dist`** during the live runs were judged
  unaffected by reasoning, not by measurement.

## Open questions or contradictions found

1. **`dev` defect.** `packages/test-runner/src/flow-lane/creation/tests/build-proposal.test.ts`
   fails 2 tests against `dev`'s own `build-proposal.ts`. `dev` needs the same
   three-line fix, or t033 must carry it.
2. **Baseline can be lowered.** `service.ts` is now 6,381 lines against a
   6,404 baseline. I did not touch `.structure-baseline.json`, which is not
   mine. The supervisor can run `pnpm structure:baseline` in Core to lock in
   the reduction.
3. **Orphaned Core build output.** `packages/fluxiq/dist/.../llm/evidence-window.js`
   and `dist/.../llm/evidence-batch/` remain, because `tsc -b --clean` does not
   remove outputs of deleted sources. They are ignored and nothing references
   them. A clean `dist` rebuild would remove them.
4. **Weak golden-path failure reporting.** The launcher collapses every inner
   failure to `panel_golden_path.failed`. The repair outcome code was only
   recoverable by a separate durable readback. The planned `ui:e2e` lane
   should report the inner `recoveryCode` itself.
5. **Map name versus audit.** The suggested `provider-resolution.ts` name would
   fail the naming audit; `resolver-contract.ts` is used instead.

## Residue

- **Run roots** `F:\fxlab-runs\w2x-t027-reconcile` and `F:\fxlab-runs\t027rp`
  are disposable and retained for inspection. All their listeners are closed.
- **Scratch files.** The launchers, readback scripts and focused-test runner
  live only in my session scratchpad.
- **Untouched:** port 3000, the user's store and profile, and `dev`.
