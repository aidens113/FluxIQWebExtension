# t280 Post-Build Run-3 Readiness

Snapshot: `2026-09-27T04:33:58.7619170Z` (`2026-09-26 21:33:58 -07:00`)
Repositories: `F:\!FluxIQ` and `F:\!FluxIQWebExtension` (read-only)
Outcome: **NO-GO for run 3 until the remaining Core validation evidence, downstream rebuild/freshness gates, and provider-free readiness gate complete. Core build freshness and the current one-Lab snapshot are GO.**

## Settled Core evidence

The final t258 report is present at `t258-grant-continuation-wiring.md`. It records a settled-tree
focused result of 135/135 across 10 files, FluxIQ package check, Core root check including structure,
Core root build, and diff check as passing. It reports no unresolved implementation caveat and no
live/Lab work.

The newest production input in the t263 list augmented with t258's final internal continuation and
bootstrap-target modules is `packages/fluxiq/src/programs/automation-studio/runtime/service.ts` at
`2026-09-27T04:29:45.1754382Z`.

| Core marker | Timestamp UTC | Newer than newest production input |
| --- | --- | --- |
| `packages/contracts/dist/index.js` | `2026-09-27T04:31:56.8327575Z` | Yes |
| `packages/fluxiq/dist/index.js` | `2026-09-27T04:32:07.1082369Z` | Yes |
| `packages/client-gateway-websocket/dist/index.js` | `2026-09-27T04:32:09.2821662Z` | Yes |
| `apps/web/.next/BUILD_ID` | `2026-09-27T04:32:50.5891686Z` | Yes |

**Core output freshness: GO.** The required runtime and web markers are strictly newer than the
newest listed production input; the contracts and gateway dependency markers are also fresh.

## Downstream freshness snapshot

The strict t263 comparison currently produces:

| Owner | Output timestamp UTC | Newest source/dependency timestamp UTC | Current result |
| --- | --- | --- | --- |
| test-contracts | `2026-09-27T00:02:54.6408887Z` | Core contracts `2026-09-27T04:31:56.8327575Z` | **Stale** |
| test-evidence | `2026-09-27T00:02:53.5896080Z` | test-contracts `2026-09-27T00:02:54.6408887Z` | **Stale** |
| domain | `2026-09-26T23:51:17.8875204Z` | Core gateway `2026-09-27T04:32:09.2821662Z` | **Stale** |
| extension Chromium E2E bundle | `2026-09-26T23:51:23.0676366Z` | Core gateway `2026-09-27T04:32:09.2821662Z` | **Stale** |
| Scenario Lab | `2026-09-27T00:02:59.4843194Z` | old test-contracts `2026-09-27T00:02:54.6408887Z` | Fresh now, but invalidated by the required test-contracts rebuild |
| test runner | `2026-09-27T00:04:24.8074165Z` | Core FluxIQ `2026-09-27T04:32:07.1082369Z` | **Stale** |

The E2E Chromium manifest exists. Its timestamp was not used as the extension freshness marker, in
accordance with t263.

**Downstream freshness: NO-GO.** Rebuild the complete dependency closure serially even though the
current Scenario Lab marker is newer than the old test-contracts marker: rebuilding test-contracts
will make that Lab output stale.

Required order remains:

1. `@fluxiq-web-extension/domain`
2. `@fluxiq-web-extension/test-contracts`
3. `@fluxiq-web-extension/test-evidence`
4. `@fluxiq-web-extension/extension`
5. `@fluxiq-web-extension/scenario-lab`
6. `@fluxiq-web-extension/test-runner`
7. downstream root `pnpm check`
8. repeat t263's strict downstream freshness comparisons against the new outputs

## One-Lab snapshot

At the snapshot time, the sanitized process scan found no matching Lab, test-runner CLI, or Scenario
Lab server process, and `.lab-locks/build.lock` was absent.

**Current one-Lab state: GO as a snapshot only.** It is not a reservation and must be repeated
immediately before the provider-free dry-run and again immediately before the live invocation.

## Exact remaining serial gates

1. Close the remaining t270 Core evidence gaps on the unchanged tree. T258 proves its 10-file
   135-test focused set, package/root checks, and build, but its final report does not record the
   complete 15-file t270 focused matrix or a final-tree Core root `pnpm test`. Run and record those
   missing validation gates. If either causes a source fix, repeat Core check/build and this
   freshness comparison.
2. Rebuild all six downstream owners in the dependency order above, then run downstream root check.
3. Re-run the strict downstream freshness procedure and require every generated marker to be newer
   than all of its source and rebuilt dependency markers.
4. Repeat the one-Lab process/lock gate, then run the unchanged provider-free `--dry-run`. Require
   exit zero, `status:"ready"`, `providerCallCount:0`, `lane:"created-flow"`, `target:"isolated"`,
   and the expected scenario/task/oracle/replay facts. This snapshot did not run that command.
5. Create and populate the no-hindsight pending run-3 debug record before any provider call, repeat
   the one-Lab gate, load credentials process-only, and use the unchanged default 26-call live
   command with only `--dry-run` removed.

A passing run 3 starts the consecutive-pass streak at one; it does not satisfy the two-pass exit
condition.

## Scope and limitations

This task read t258, t263, and t270; inspected only current process/lock state and input/output
timestamps; and wrote this report. It did not run tests, builds, freshness-generating commands,
dry-run/live/provider/browser/Lab commands, baseline generation, or source/shared-document edits.
