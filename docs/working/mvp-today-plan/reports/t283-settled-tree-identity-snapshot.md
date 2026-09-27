# t283 — Settled-tree identity snapshot

Status: **Complete read-only identity capture**

Captured at `2026-09-27T04:37:50.2779404Z` (`2026-09-26 21:37:50.2779404 -07:00`).
The t283 report path was created before capture, so its untracked path is included in the
downstream dirty scope. Filling this already-untracked report does not change the status scope.

## Repository identity

| Repository | Branch | HEAD |
| --- | --- | --- |
| Core `F:\!FluxIQ` | `task/t170-mvp-today-integration` | `d035e1b7d17977951a2a2ec6b5e51570e3f2c537` |
| Downstream `F:\!FluxIQWebExtension` | `task/t170-mvp-today-integration` | `5b8429c543fdc27eb892c225641717aed43c5dc4` |

Both worktrees are intentionally dirty. No claim that HEAD alone identifies the tested tree is
made.

## Exact validation-relevant dirty-path scope fingerprints

The fingerprint input is the complete output of:

```powershell
git -C <repository> -c core.quotepath=false status --short --untracked-files=all
```

Lines remain in Git's emitted order, are joined with LF, receive one terminal LF, are encoded as
UTF-8, and are hashed with SHA-256. This fingerprints only Git status codes and paths; it does not
read or disclose file contents. For downstream only, paths under
`docs/working/mvp-today-plan/reports/**` are excluded from the binding fingerprint because
concurrent report-only agents keep adding immutable evidence reports while validation is being
coordinated. No source, test, architecture document, working plan, debug, archive, or other path is
excluded.

| Repository | Binding entries | Status-code counts | Top-level path counts | Binding-scope SHA-256 |
| --- | ---: | --- | --- | --- |
| Core | 204 | ` M` 114; `??` 88; `D ` 1; `RM` 1 | `.structure-baseline.json` 1; `docs` 3; `packages` 200 | `21d6f703eec63c70c80972be3414bf8b8fde2cbd50d2eebd04030cfca49b8bb7` |
| Downstream | 136 | ` M` 68; `??` 68 | `apps` 26; `docs` 14; `domain` 44; `packages` 52 | `91bedf929f7ad0bee1c6e88f067f9118b47454b5ca26ae85d7913381ee2da650` |

The Core `D ` and `RM` entries are staged/index states; the fingerprints preserve their two-column
porcelain codes exactly. There are no generated-output or run-artifact paths in this report.

### Separately reported report-only churn

At capture, downstream had 246 total dirty-path entries. Of those, 110 were untracked paths under
the excluded `docs/working/mvp-today-plan/reports/**` prefix, with status-scope SHA-256
`a586eec8c02678753412ab661a9272441d3fde1a7345c3130702c6892d306c21`. The t283 report itself is one
of those 110 paths. Additions under that exact prefix do not invalidate the production/test binding;
any change outside it does.

## Final t258 production owner timestamps

All timestamps are filesystem `LastWriteTimeUtc` values captured in the same snapshot. Status is
the exact Git short-status code for the named owner.

| Core owner | Status | Last write UTC |
| --- | --- | --- |
| `packages/fluxiq/src/programs/_shared/runtime.ts` | ` M` | `2026-09-27T01:31:15.9837695Z` |
| `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/run-outcome.ts` | ` M` | `2026-09-27T01:31:12.3314270Z` |
| `packages/fluxiq/src/programs/automation-studio/runtime/service.ts` | ` M` | `2026-09-27T04:29:45.1754382Z` |
| `packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/reauthor-continuation.ts` | `??` | `2026-09-27T01:44:27.9232939Z` |
| `packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/index.ts` | ` M` | `2026-09-27T01:37:44.0342295Z` |
| `packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/bootstrap-target.ts` | `??` | `2026-09-27T04:29:45.1690589Z` |
| `packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/index.ts` | ` M` | `2026-09-27T04:29:45.1690589Z` |

## Final t258 test owner timestamps

| Core owner | Status | Last write UTC |
| --- | --- | --- |
| `packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/tests/reauthor-continuation.test.ts` | `??` | `2026-09-27T04:29:51.7091305Z` |
| `packages/fluxiq/src/programs/automation-studio/runtime/tests/refuted-result/tests/reauthor-service.test.ts` | `??` | `2026-09-27T01:51:58.4628052Z` |
| `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-bootstrap/tests/accounting.test.ts` | ` M` | `2026-09-27T01:47:41.5588048Z` |
| `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-bootstrap/tests/extend.test.ts` | ` M` | `2026-09-27T01:51:45.5028468Z` |
| `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/run-outcome.test.ts` | ` M` | `2026-09-27T01:40:29.5625967Z` |

## Validation binding rule

Before adopting a subsequent validation result as belonging to this snapshot, require:

1. both branch names and HEAD values still match;
2. the validation-relevant dirty-scope fingerprints still match after applying the one explicit
   downstream report-directory exclusion;
3. every t258 owner timestamp above still matches; and
4. no validation command overlaps an active source/test editor.

A mismatch does not prove a bad change, but it means the result belongs to a different tree and a
new identity snapshot is required. This specified identity does not hash dirty file contents; the
owner timestamps are therefore part of the binding rather than optional context.

No source, shared document, generated output, run artifact, provider/browser/Lab state, commit, or
push was changed. This downstream report is the only file written by t283.
