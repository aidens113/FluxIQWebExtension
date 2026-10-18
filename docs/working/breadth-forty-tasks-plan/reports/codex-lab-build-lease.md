# Codex Lab Core build lease (t720)

Status: Complete; targeted tests, syntax checks and structure audit passed. Awaiting supervisor integration.

## Change

The launcher now holds the **owning Core build-cache locks**, resolved by importing that exact checkout's `scripts/build-cache/index.mjs`, for `contracts:build`, `fluxiq:build` and `client-gateway-websocket:build`. Core's actual `resolveStep` supplies the stamp path; Core's actual `acquireStepLock` acquires `${stampPath}.lock`. No copied cache-path convention or parallel Lab-only lock was introduced. Core sources were not edited.

Waste admission still runs first. The lease then covers Core commit/output/build validation, the downstream build prelude, runner child execution, live finish recording and the final Core output scan. Stop and read-only commands preserve their existing no-Core behavior. Unsupported package caches fail closed as setup failures. A valid local-stamp reuse may proceed because it does not replace module contents; store restores and forced builds take the locks and wait.

Each lock starts its own 30-second heartbeat immediately upon acquisition, including while the next lock is awaited. Its owned file descriptor updates mtime without rewriting JSON; the token is checked before every heartbeat. Loss aborts the runner and is checked before launch and after the final scan. Async release on completion/exceptions and synchronous explicit-exit cleanup remove only owned tokens. Dead-owner recovery stays Core's implementation. Launcher signals are forwarded to the runner while the parent retains the lease until child close; a child spawn/abort error waits for close before rejecting.

Changed files: `scripts/lab/core/build-lease/{index,lease}.mjs`, owning `tests/{fixture,lease.test}.mjs`, `scripts/lab/core/index.mjs`, `scripts/lab/run-lab.mjs`, `docs/architecture/testing-facility.md`. Additional supervisor-authorized changes: `core/build/tests/unbuilt.test.mjs` now creates a supported cache fixture to preserve its missing-build launcher regression; `core/build/watch.mjs` header clarifies the old quiescence-only argument is historical.

## Evidence so far

- Initial six real-child tests passed **6/6**, 20.8 seconds. The fixtures copy only Core's build-cache scripts, excluding its tests, into newly created temporary Git roots. They create all package manifests/source/build scripts themselves and copy no runtime/private data.
- Combined affected run: **34 passed, 1 skipped, 0 failed**, 20.8 seconds. The existing optional real-Core-output probe skipped because its derived path has no Core build; every new race test and the missing-build launcher regression ran and passed.
- The initial structure audit found two issues in this change: imports bypassed the worktree barrel, and the synchronous exit cleanup catch lacked the required best-effort annotation. Both corrected; final audit pending.
- Added two further tests: heartbeat loss is reported and cannot delete a replacement owner's lock; unsupported package cache refuses before acquiring any lock. Final targeted run passed **24/24**, no skips, 44.3 seconds.
- Final audit then caught two packed statements in the new signal handling; expanded them to separate lines. Final structure audit passed: **208 warnings, 638 baselined**, native **AUDIT_EXIT=0**. `git diff --check` and `node --check` for launcher/lease passed. A filtered PowerShell pipeline initially reported shell exit 1 despite the pass summary; the explicit native exit-code check confirmed 0. An attempted inline Node wrapper failed from shell quoting before invoking any audit; no implementation failure.

Exact final test command from the t720 root:

```powershell
node --test --test-timeout=45000 scripts/lab/core/build-lease/tests/lease.test.mjs scripts/lab/core/build/tests/unbuilt.test.mjs scripts/lab/scenario-guard/tests/lab-scenario-refusal.test.mjs
```

Earlier wider run also included `scripts/lab/core/build/tests/watch.test.mjs` and `scripts/lab/core/build/tests/stale.test.mjs`. Structure command: `node scripts/structure-audit.mjs` (output filtered for failures/summary on subsequent runs only).

## Boundaries and remaining verification

No paid/live/browser test or repository build was launched. No commits, merges or pushes. The real forced-build and restore tests use Core's actual `runStep`, store and lock implementation in scratch trees, with small genuine child build commands; they do not compile the product or mutate any live lane. Independent-root builds prove they are not globally serialized.

Direct commands bypassing Core's build cache remain outside the protection. Core's own no-Git fallback also bypasses its lock, so supported operation requires a working Git checkout and working Git tooling; the lease checks checkout presence and cache-owned package scripts. It does not freeze Core source edits. Explicit exit and exception cleanup are tested; a full real-run signal/descendant teardown has not been exercised in this worker's tests. Final parent review and narrow rerun are required before integration.
