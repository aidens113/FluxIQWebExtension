# t261 — Run-3 machine-readiness snapshot

Snapshot time: **2026-09-27T01:37:43.3827956Z**
Decision at snapshot: **NO-GO**

This is a read-only, point-in-time machine inventory while t258 is still changing the Core tree.
No Lab, browser, provider call, dry-run, build, generated-output change, run-artifact change, or
shared-document change was made. The machine is free for a later single Lab run, but the final
tree has not passed the serial release gates and its Core outputs are stale.

## Exact checks and results

### Single-Lab availability

The t249 process expression was evaluated through `Win32_Process`, excluding the inspecting
PowerShell PID and returning only process name and PID. It found **0** matching processes. The
repository-local `.lab-locks/build.lock` was **absent**.

Result: **GO at snapshot only.** Repeat immediately before the zero-provider dry-run and again
immediately before the live invocation. This observation is not a reservation of the machine.

### Core production outputs

All Core production owners named by t249 plus t260 were checked. The newest was:

```text
packages/fluxiq/src/programs/automation-studio/runtime/service.ts
2026-09-27T01:37:10.2722748Z
```

The required Core outputs existed but both predated that source:

```text
packages/fluxiq/dist/index.js       2026-09-27T01:11:49.8635383Z  STALE
apps/web/.next/BUILD_ID             2026-09-27T01:12:24.7247406Z  STALE
```

Result: **NO-GO.** The ordered Core root build must run after Core editing stops, and both outputs
must then be newer than every final changed production owner.

### Downstream output presence and provisional freshness

All four direct-CLI outputs required by t249 existed:

```text
packages/test-runner/dist/cli.js                       2026-09-27T00:04:24.8074165Z
domain/dist/index.js                                   2026-09-26T23:51:17.8875204Z
apps/extension/dist/e2e-chromium/manifest.json         2026-09-12T00:10:16.7076473Z
apps/scenario-lab/dist/server.js                       2026-09-27T00:02:59.4843194Z
```

The latest tracked non-test production input sampled for each owner was older than the relevant
compiled output: test runner `extraction-read.ts` at `2026-09-26T19:53:35.6727693Z`; domain
`definitions.ts` at `2026-09-26T22:04:11.3381565Z`; extension `action-runner.ts` at
`2026-09-26T21:20:32.0323257Z`; and Scenario Lab `package.json` at
`2026-09-23T06:12:08.6585691Z`. The extension manifest is a timestamp-preserving copy of
`manifest.e2e.json` (both `2026-09-12T00:10:16.7076473Z`); representative generated bundles
`content/index.js` and `sidepanel/index.js` were built at `2026-09-26T23:51:23Z`, after the latest
extension production input and the domain output. Test-contract and test-evidence outputs at
`2026-09-27T00:02:54.6408887Z` and `2026-09-27T00:02:53.5896080Z` also predated the test-runner
CLI as required by its dependency order.

Result: **presence GO; reuse remains conditional.** The downstream outputs appear fresh relative
to their own sampled tracked production inputs and built dependencies, but t249 still requires
the downstream `pnpm check` against the newly rebuilt sibling Core and a final ownership-graph
freshness check. The current snapshot cannot satisfy that gate because the final Core build does
not yet exist.

### Pending-debug readiness

`docs/working/language-driven-flow-loop-plan/debugs/pending-t249-run-3.md` was absent, and the
run-debug template was present.

Result: **GO to create later, not created now.** Create and fully populate the new pending debug's
header and Stage 1 only after final validation, build/freshness, and zero-provider readiness are
green. Preserve the absence now so the supervisor can establish the no-hindsight chronology.

### Completion/review evidence visible at snapshot

No t258 final report and no t259 integrated-review report were present under the expected report
set at the snapshot. t260 explicitly remains conditional on final t258 validation.

Result: **NO-GO** until both the final implementation report and the independent integrated review
exist with no unresolved lifecycle, authority, privacy, or validation finding.

## Remaining serial gates

Run these in order after t258 stops editing:

1. Accept the final t258 report only if the decisive composition and all declared final-tree
   focused/package/root gates are green; accept t259 only with no unresolved security finding.
2. Run t249's integrated focused Core command, including all continuation, hold, grant,
   run-outcome, accounting, and real-grant reauthor-service suites. Preserve the exact successful
   call order `loop_verification, loop_verification, evidence_tool_decision, loop_verification`,
   zero-provider selected-Subflow replay, final success, and zero active grants.
3. Run `pnpm --filter fluxiq check`, Core root `pnpm test`, Core root `pnpm check`, and ordered Core
   root `pnpm build` on the settled tree.
4. Recheck Core runtime/web freshness against every final changed production owner.
5. Run downstream `pnpm check` against that rebuilt Core, then repeat the downstream ownership-
   graph freshness check and rebuild only any stale dependency closure.
6. Repeat the one-Lab/process/lock gate, then execute t249's exact zero-provider dry-run and verify
   status `ready`, `providerCallCount: 0`, lane `created-flow`, target `isolated`, the expected
   scenario/workflow/task/oracle at step 16, and exactly one replay.
7. Create the new pending debug from the template and complete Header plus Stage 1 before any
   provider call. Repeat the one-Lab/process/lock gate.
8. Invoke exactly once, through the established disposable-shell helper, without any max-call,
   token, cost, timeout, Lab-instance, target, or run-root override:

```powershell
node packages/test-runner/dist/cli.js run everything-store `
  --target isolated `
  --live-llm `
  --llm-profile mvp-hard-scenario `
  --llm-provider deepseek `
  --llm-task create-flow `
  --instruction-task everything-store-plus-earbuds-under-50 `
  --replays 1
```

The absence of `--llm-max-calls` preserves the unchanged default 26-call profile. Immediately bind
the pending debug to the real run ID, inspect only sanitized evidence, and fully debug the run
before any later provider call. A passing run 3 starts the streak at one; it does not complete the
required two-pass streak.
