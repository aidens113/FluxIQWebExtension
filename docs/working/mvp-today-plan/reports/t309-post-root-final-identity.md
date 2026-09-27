# t309 — Post-root final identity and freshness

Status: **Complete — source/test identity and freshness GO; dry-run still requires immediate one-Lab gate**

Captured at `2026-09-27T05:07:50.1288705Z`, after the supervisor's final Core root test and t298's
Core check/diff-check completed successfully. t309 ran no test, check, build, dry-run, or live
command.

## Validation results this identity follows

- Final Core root test: **PASS, exit 0** — contracts 53/53, client gateway 3/3, FluxIQ 3,994
  passed plus 1 skipped across 413 files, and web 1,346/1,346 across 246 files.
- t298 Core `pnpm check`: **PASS, exit 0** in 22.20 seconds — structure passed and all four
  workspace checks passed.
- t298 scoped three-test `git diff --check`: **PASS, exit 0**; only the two known LF-to-CRLF
  warnings were emitted.

## Repository identity

| Repository | Branch | HEAD |
| --- | --- | --- |
| Core `F:\!FluxIQ` | `task/t170-mvp-today-integration` | `d035e1b7d17977951a2a2ec6b5e51570e3f2c537` |
| Downstream `F:\!FluxIQWebExtension` | `task/t170-mvp-today-integration` | `5b8429c543fdc27eb892c225641717aed43c5dc4` |

Both branch/HEAD pairs are unchanged from t283/t296. Both worktrees remain intentionally dirty;
the fingerprints below, rather than HEAD alone, identify the validation-relevant tree.

The fingerprint input is Git's complete short-status output in emitted order, joined with LF,
given one terminal LF, UTF-8 encoded, then SHA-256 hashed. As in t283, only downstream paths under
`docs/working/mvp-today-plan/reports/**` are excluded from its binding fingerprint.

| Repository | Binding entries | Status counts | Binding SHA-256 |
| --- | ---: | --- | --- |
| Core | 206 | ` M` 116; `??` 88; `D ` 1; `RM` 1 | `79825a3d30638c5c620f4ac122ddd184b482fb088c75c6413a286a71dbaac9f8` |
| Downstream | 136 | ` M` 68; `??` 68 | `91bedf929f7ad0bee1c6e88f067f9118b47454b5ca26ae85d7913381ee2da650` |

The downstream binding count/hash is exactly unchanged from t283. Downstream has 270 total dirty
paths at capture; 134 are excluded report-only paths, up from t283's 110. This report churn does not
change production/test identity.

Core changed from t296's 205 entries / 115 modified paths to 206 / 116 solely by adding the t304
modified web test to the two already-fingerprinted test reconciliations. The other status-code
counts remain unchanged.

## Exact final three-test identity

The combined full-index textual diff for the three paths is 286 lines with normalized SHA-256
`5ad5826677283de24d46f7238d01b5818c9b8954a5a4fa6d447850777dd8dcb4`.

| Test | Working blob | Diff SHA-256 | Last write UTC | Drift from prior evidence |
| --- | --- | --- | --- | --- |
| `packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/tests/patches.test.ts` | `1ac98c6c32ab6b7c28b0d051bb7b3fc8153e6260` | `0df6db8f6db0ff0c737d4621c039c69c4336c3759def87883a87983c7232c338` | `2026-09-27T04:42:58.2192293Z` | Exact t296 match |
| `packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts` | `50b001967224bb14faa71864bdb5919d09b72f7b` | `78a6e3c11eedef7943b5fcd886bd75c54daa5962acd5de0c9cb5c63c9191fb16` | `2026-09-27T04:52:40.2791519Z` | Exact t296 match |
| `apps/web/src/features/automation-studio/runtime/tests/run-permission-request.test.tsx` | `b858be09c93f98289f95aeab0e75fd74f1966f72` | `41f928821ba70e8ecd82c54c052901ef2f9f440ffc698471d68ed89917fe6f6f` | `2026-09-27T05:00:58.0684413Z` | Expected t304 test-only addition |

Each path has Git status ` M`. The corresponding HEAD blobs are respectively
`6b2d02b2c2296e8c56e0f16ce461212805edf071`,
`c3489989df5b9f9886be267d0c2a849a65bdd318`, and
`1f6792ef551b7e965a52655269eecb51099787b5`.

## Production drift verdict

**No production-owner drift since t283/t296.** All seven t258 production owners retain the exact
same Git status, filesystem timestamp, and working blob observed by t296. t290, t293, and t304 are
therefore test-only reconciliations; the final root/check commands did not alter production scope.

## Downstream freshness impact

**No freshness impact; all six comparisons remain strict PASS.** Every output and newest built
dependency timestamp is unchanged from t289/t295:

| Owner | Output UTC | Newest built dependency UTC | Result |
| --- | --- | --- | --- |
| test-contracts | `2026-09-27T04:34:27.5817816Z` | Core contracts `2026-09-27T04:31:56.8327575Z` | PASS |
| test-evidence | `2026-09-27T04:40:58.1776017Z` | test-contracts `2026-09-27T04:34:27.5817816Z` | PASS |
| domain | `2026-09-27T04:34:04.5339326Z` | Core gateway `2026-09-27T04:32:09.2821662Z` | PASS |
| extension | `2026-09-27T04:34:21.3613545Z` | domain `2026-09-27T04:34:04.5339326Z` | PASS |
| Scenario Lab | `2026-09-27T04:34:34.3926137Z` | test-contracts `2026-09-27T04:34:27.5817816Z` | PASS |
| test runner | `2026-09-27T04:41:09.6160474Z` | test-evidence `2026-09-27T04:40:58.1776017Z` | PASS |

The E2E Chromium manifest still exists at the required path with timestamp
`2026-09-12T00:10:16.7076473Z`; it remains existence-only. The final edits were Core tests, not
production inputs or built dependencies, and root test/check did not rebuild these outputs.

## Dry-run decision

**Conditional GO on source/test/freshness; operational NO-GO until the immediate one-Lab gate is
repeated.** The final Core root test, Core check, scoped diff-check, identity, production-drift, and
downstream-freshness gates are closed. t309 did not inspect or reserve Lab/process/lock state, and
t295's earlier GO was only a timestamped snapshot. Immediately before the unchanged provider-free
dry-run, require zero matching Lab/build/test-runner/Scenario-Lab processes and no build lock.

If that immediate gate is clear, the dry-run may proceed. It must still independently return exit
zero, `status:"ready"`, `providerCallCount:0`, `lane:"created-flow"`, `target:"isolated"`, and the
reviewed scenario/workflow/task/oracle/replay facts. A dry-run pass is readiness evidence only: run
2 remains the latest accepted live measurement and the consecutive-pass streak remains 0.

t309 changed no source, test, shared document, generated output, run artifact, browser, provider,
Lab, commit, or push state. This downstream report is its only write.
