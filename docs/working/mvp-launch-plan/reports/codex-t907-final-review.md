# t907 final dependency integration review and fixes

Initial read-only review of the final host-lifecycle changes against current Core `dev`, including the retained t909 target/task/scoped-memory admission. The lead subsequently authorized the scoped regressions and fixes recorded below. Finding line numbers describe the reviewed source before those fixes.

## Findings reproduced and fixed

1. **P2 - built-in owner cleanup failures cannot reject the new service close.**
   Core `packages/fluxiq/src/framework/automation-service/service/fluxnode/create-fluxnode-service.ts:153-156` catches an `owner.release()` failure inside the memoized finalizer, emits a failed step and fulfills the finalizer. Consequently the run worker fulfills at `:158-160`, and `run-registry.ts:57-59` sees no rejected finalization when `close()` drains it. Shutdown can therefore resolve successfully with an execution owner still held. The swallowed cleanup error predates this change on `dev`; the new lifecycle API exposes the gap between reporting a run event and reporting successful shutdown. Original attempt errors must remain visible alongside the cleanup failure.
   Minimum regression: extend the existing simultaneous attempt/release failure case in `tests/managed-hosts.test.ts:228-240` to assert that built-in `close()` rejects, while both existing step events remain present and ownership/host release are each attempted once. Its release mock already throws before the original owner release, so no duplicate fixture is needed. The raw rejecting registry worker in `tests/run-registry-shutdown.test.ts:74-85` does not exercise this swallowed path.

2. **P2 - pipeline admission bypasses managed-runtime refusal for its leaves.**
   Core `create-fluxnode-service.ts:194` and `:201` reject mismatched direct spec/named starts, but both exclude a pipeline's resolved leaf targets. The child path at `:91-100` launches without the same check; registration through `owner-flows.ts:54-55` does not constrain the declared runtime to the bound domain. A pipeline referring to a registered leaf for another runtime can therefore be admitted and acquire durable execution bindings before `run-fluxnode.ts:75` throws `managed_host.runtime_mismatch`. `finish()` at `create-fluxnode-service.ts:311-316` converts that refusal-worthy configuration into a stopped run. No host is acquired, but the caller loses the direct-start refusal semantics and receives an avoidable terminal child result.
   Minimum regression: with a managed `library` pool, register a leaf declaring another runtime and start an input-source pipeline mapping that leaf. Assert `invalid_request` before any run, host or execution-owner admission. Validate all resolved leaves against the pool before committing the parent execution, retaining t909's admitted target versions. Initially source-traced; subsequently reproduced by the authorized red group below.

## Authorized implementation

The lead's `codex-t907-close-failure-brief.md` released only Core `create-fluxnode-service.ts`, `run-registry.ts` and the two named host/shutdown test owners, plus this report. The expansion explicitly required preadmission runtime validation of every reachable registered leaf, including nested pipelines, through the existing immutable target manifest.

Red command, from paired Core through the heavy coordinator: `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t907-close-runtime-red -- "pnpm --filter fluxiq exec vitest run src/framework/automation-service/service/fluxnode/tests/managed-hosts.test.ts src/framework/automation-service/service/fluxnode/tests/run-registry-shutdown.test.ts --maxWorkers 1 --minWorkers 1"` -> exit 1, **5 failed / 11 passed**, 110.63 s. All four missing/other-runtime direct/nested cases were incorrectly admitted; the extended shutdown case resolved `undefined` instead of rejecting. This reproduced both findings behaviorally before the fix. Log: local TEMP/fluxiq-t907-close-runtime-red.log.

Authored fixes: registry-owned cleanup-error collection preserves the run result and failed-step evidence, and `close()` includes those actual errors only after every admission/run settles. Runtime preflight reads every name/hash in the resolved manifest through its frozen finder and refuses a mismatched/missing leaf runtime before key claim or execution-owner acquisition. No extra task status, execution-identity store, retry/cap or release retry was added. The existing simultaneous attempt/owner error test now also holds an unrelated successful owner cleanup, requires repeated `close()` calls to share the rejecting promise, verifies the original result remains readable and checks exactly-once owner/host release. Four direct/nested runtime regressions prove no host/owner/run is admitted.

First green: same two files under heavy label `t907-close-runtime-green` -> exit 0, **16/16 passed**, 67.56 s. Log: local TEMP/fluxiq-t907-close-runtime-green.log.

The lead then identified the matching preadmission cleanup path: the launch catch aggregates the admission and cleanup errors, but a settled/reported admission is removed from tracking before a later `close()`. The lead authorized an extra regression/fix in the same owners. The existing failed-registration case is parameterized for successful/failed release; it first observes the admission rejection, then requires close to retain the cleanup error, one release and no host. Its narrow red (`managed-hosts.test.ts -t registration`, heavy label `t907-close-admission-red`) -> exit 1, **1 failed / 1 passed / 11 skipped**, 68.70 s: the admission aggregate preserved both causes, but later close resolved `undefined` instead of rejecting. Log: local TEMP/fluxiq-t907-close-admission-red.log. The catch now records only the actual cleanup error in the registry before rethrowing the unchanged admission aggregate.

Final green: both named files under heavy label `t907-close-runtime-final-green` -> exit 0, **17/17 passed**, 85.62 s. Log: local TEMP/fluxiq-t907-close-runtime-final-green.log. The unchanged registry cases still cover controller drain, admission drain, finalization failure and stopping late registrations before work. All source readers have exited.

Final source evidence: `create-fluxnode-service.ts:156` and `:169` retain actual owner cleanup failures from both worker finalization and failed admission; `run-registry.ts:40` records them and `:63-64` aggregates them after drain. The manifest runtime preflight is at `create-fluxnode-service.ts:213-219`. Regression owners begin at `tests/managed-hosts.test.ts:153`, `:182` and `:265`.

## Inspected boundary

- Reviewed the four named FluxNode service/run files and their diff from current `dev`, plus the five named adjacent tests. With the lead's explicit expansions, inspected `result-of.ts`, `owner-flows.ts`, `hosts/host-pool.ts`, `act-scope/execution-targets.ts`, its barrel and `tests/library-lane.ts`.
- The merged scoped-memory check, resolved target check and atomic task binding still run under the execution owner before `runs.add()` (`create-fluxnode-service.ts:116-151`). Their refusal path still releases ownership before returning the safe refusal (`:163-167`). No whole-file overwrite of t909 admission was found.
- Synchronous admission closure, tracking of accepted operations, stopping a late-added run before worker scheduling, waiting for controller finalization, and the shared memoized finalizer remain intact. The tests explicitly cover queued Stop, late registration, parent cleanup and simultaneous attempt/cleanup errors.
- Error fallback after a leased attempt releases its owner is not an additional finding: `finish()` supplies `answered: undefined`, and `result-of.ts:89-98` consequently performs no stored-dataset read in that fallback.
- Existing generic unexpected-error-to-stopped fallback remains on `dev`; this review does not propose another failure ending or a retry/budget cap.
- The lead independently inspected `run-dev.ts:49-55` and confirmed shutdown continues pool/managed-host, listener and instance cleanup after the service close rejection, aggregating failures afterwards. This is lead-verified evidence; this worker did not read or change that caller.

## Validation and limits

Read-only `git diff dev -- <four named files>`, `git show dev:<create-fluxnode-service.ts>` and exact-path numbered source/test reads completed. Initial abbreviated paths returned no diff / file-not-found; the package-prefixed paths above supplied the review evidence. Owned `git diff --check` -> exit 0, only the existing LF-to-CRLF advisory. All test/type/audit readers ran serially through the heavy coordinator with source frozen, never a full sweep.

Final gates, from paired Core via `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t907-close-runtime-gates -- "pnpm --filter fluxiq check && node scripts/structure-audit.mjs"`:

- Validation: `pnpm --filter fluxiq check` -> passed, `fluxiq:check` command receipt 83.033 s.
- Validation: `node scripts/structure-audit.mjs` -> passed, 544 warnings / 916 baselined; one baseline entry can be lowered by the lead. No baseline or rule was changed.
- Validation: `pnpm --filter fluxiq exec vitest run src/framework/automation-service/service/fluxnode/tests/managed-hosts.test.ts src/framework/automation-service/service/fluxnode/tests/run-registry-shutdown.test.ts --maxWorkers 1 --minWorkers 1` -> final 2 files / 17 tests passed, 85.62 s.

No browser run, paid call, panel operation, build, git mutation or other-lane/private-runtime-data read occurred. The lead's broader 31-case integration group was not repeated by this worker. Scoped-memory and atomic task-binding helper internals remain outside scope; the frozen target-manifest helper was inspected. This work does not establish production model custody.

Outcome: Done
Changed: Core packages/fluxiq/src/framework/automation-service/service/fluxnode/{create-fluxnode-service.ts,run-registry.ts,tests/managed-hosts.test.ts}; downstream docs/working/mvp-launch-plan/reports/codex-t907-final-review.md
Validation: Focused red -> both findings reproduced; additional registration red -> later close gap reproduced; final focused group -> 17/17 passed; `pnpm --filter fluxiq check` -> passed; `node scripts/structure-audit.mjs` -> passed, 544 warnings / 916 baselined
Not verified: Broader lead integration group on this final delta, scoped-memory/atomic-task helper internals, browser behavior, builds, production model custody or paid operation
Report: docs/working/mvp-launch-plan/reports/codex-t907-final-review.md
Notes: Both P2 findings fixed, including the lead's additional failed-admission cleanup path. Run results/events, frozen target binding and once-only releases remain intact. No shared-document/source changes outside the three owned Core files; no git mutations.
