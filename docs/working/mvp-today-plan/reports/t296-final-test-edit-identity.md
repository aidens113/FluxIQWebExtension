# t296 — Final test-edit identity

Status: **Complete read-only identity capture**

Captured at `2026-09-27T04:54:54.1283731Z`, after t293 reported settled.
No validation command was executed by t296.

## Core repository identity

| Repository | Branch | HEAD |
| --- | --- | --- |
| Core `F:\!FluxIQ` | `task/t170-mvp-today-integration` | `d035e1b7d17977951a2a2ec6b5e51570e3f2c537` |

Branch and HEAD are unchanged from t283. The Core worktree remains intentionally dirty; HEAD alone
does not identify the validation tree.

The complete output of `git -C F:\!FluxIQ -c core.quotepath=false status --short
--untracked-files=all`, kept in Git's emitted order, joined with LF, given one terminal LF, encoded
as UTF-8, has this identity:

- entries: `205`
- status-code counts: ` M` 115; `??` 88; `D ` 1; `RM` 1
- SHA-256: `94dfbb1e35cbdb53140127a0751b1cd966921e1a4edff1e3206cfd9c358ab658`

Compared with t283, the count is 204 -> 205 and only the ` M` count is 114 -> 115; the other
status-code counts are unchanged. This is the expected addition of the t293 modified test path.
The new fingerprint above, rather than t283's pre-reconciliation fingerprint, binds final root
validation.

## Exact two-test diff fingerprint

The fingerprint input is the complete textual output of:

```powershell
git -C F:\!FluxIQ -c core.quotepath=false diff --no-ext-diff --full-index -- <two paths below>
```

Lines remain in Git's emitted order, are joined with LF, receive one terminal LF, are encoded as
UTF-8, and are hashed with SHA-256. The combined diff is 209 lines with SHA-256
`02a934540077b7a84abf991398f0b69c3b2f69971923cdd36d132bd0c825dcb1`.

| Test path | Status | HEAD blob | Working blob | Diff SHA-256 | Diff lines | Numstat | Last write UTC |
| --- | --- | --- | --- | --- | ---: | --- | --- |
| `packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/tests/patches.test.ts` | ` M` | `6b2d02b2c2296e8c56e0f16ce461212805edf071` | `1ac98c6c32ab6b7c28b0d051bb7b3fc8153e6260` | `0df6db8f6db0ff0c737d4621c039c69c4336c3759def87883a87983c7232c338` | 132 | +47/-20 | `2026-09-27T04:42:58.2192293Z` |
| `packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts` | ` M` | `c3489989df5b9f9886be267d0c2a849a65bdd318` | `50b001967224bb14faa71864bdb5919d09b72f7b` | `78a6e3c11eedef7943b5fcd886bd75c54daa5962acd5de0c9cb5c63c9191fb16` | 77 | +13/-14 | `2026-09-27T04:52:40.2791519Z` |

The first path is the t290 permission-test reconciliation (including the exact mixed held-request
and adjacent create-only assertions described in t290). The second is the t293 deterministic
retryable-timeout fixture reconciliation described in t293. The fingerprints cover each path's
entire current diff from HEAD, not selected hunks.

## Production-owner drift verdict

**Unchanged from t283.** All seven named t258 production owners retain the exact same Git status
and `LastWriteTimeUtc`; therefore neither t290 nor t293 introduced production-owner drift.

| Production owner | Status | Last write UTC |
| --- | --- | --- |
| `packages/fluxiq/src/programs/_shared/runtime.ts` | ` M` | `2026-09-27T01:31:15.9837695Z` |
| `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/run-outcome.ts` | ` M` | `2026-09-27T01:31:12.3314270Z` |
| `packages/fluxiq/src/programs/automation-studio/runtime/service.ts` | ` M` | `2026-09-27T04:29:45.1754382Z` |
| `packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/reauthor-continuation.ts` | `??` | `2026-09-27T01:44:27.9232939Z` |
| `packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/index.ts` | ` M` | `2026-09-27T01:37:44.0342295Z` |
| `packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/bootstrap-target.ts` | `??` | `2026-09-27T04:29:45.1690589Z` |
| `packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/index.ts` | ` M` | `2026-09-27T04:29:45.1690589Z` |

## Final-root validation binding

Adopt a subsequent final Core validation result as belonging to this tree only if branch and HEAD,
the 205-entry full status fingerprint, both test working blobs/diff fingerprints, and all seven
production-owner statuses/timestamps still match. Any mismatch requires a fresh identity capture.

t296 changed no Core source, tests, shared documents, generated output, run artifacts, or live
state. This downstream report is its only write.
