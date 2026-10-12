# Storage reuse review — 2026-10-11

Status: Complete
Owner: storage-reuse-review worker
Scope: Read-only t381 WIP and current Core t435 comparison; saved B provider-free recording failure.

## Current State

Do not merge 08eafd1a wholesale. It is committed WIP, despite its older report saying nothing is committed. It replaces the repository connection API that t435 subsequently changed. Preserve its useful canonical-operation optimization and tests, reconcile them onto the current owner, and validate narrow lifecycle/process seams. It does not establish or fix B recording persistence by itself. No tests, builds, source edits, merges or launches were performed in this review.

## Ownership and overlap

| Owner | Current dev behavior | t381 WIP behavior | Recording relevance |
| --- | --- | --- | --- |
| Database-manager SQLiteRepository/global.sqlite | Optional `connections` pool; file operation queue; per-call open/prepare/close outside a pool scope | Process-wide static pool, own per-file queue; any repository can `hold(scope)` | Recording sessions use this repository, but t381 gives their append path no explicit hold |
| t435 program state | `programStateConnections.keepWhile` around runRuntimeSession; AsyncLocalStorage scope; state root resolution retained; every call reads fresh data | Earlier t381 knows none of these later seams | Run session optimization does not wrap recording append or finalization |
| Project database/project.sqlite | Separate lease-based project pool, ready/schema memo and statement cache; close tracking; runtime-held leases | Not changed | Recording typed events/indexes still use project storage through their own leases |
| Canonical whole operation | Existing guarded create/save phases on separate transactions | Holds global database while project/Flow create or save runs | This is the only added hold owner; recording append is not a canonical Flow save |

Current `automation-studio/storage/sqlite-repository.ts:33` constructs canonical repositories without the optional pool. Its recordingSessions member at line 87 uses automation.recording_sessions. Current `runtime/service.ts:721-738` serializes recording mutation, reads the session, prepares/dehydrates objects, writes the global recording session, then typed project timeline/state/index summaries. No `keepWhile` wraps this owner. A connection scoped around program state alone cannot optimize this canonical recording repository unless the repository also receives the chosen pool.

## Confirmed merge conflicts and design constraints

- Current SQLiteRepositoryOptions includes `connections?: SQLiteConnectionPool` and callers in `_shared/storage.ts:334/342` use it. t381 replaces this API and removes the connector/current operation-queue implementation. Retaining the t381 version would break t435 callers/typechecks or silently lose run scope behavior if manually papered over.
- Current pool is `storage/connection-pool.ts`; t381 adds a different `storage/sqlite-connection-pool.ts`, both named SQLiteConnectionPool. Leaving both as independent authorities would duplicate handle lifetime and serialization rules. Keep one file queue for all repository operations; do not nest the same queue around an operation that re-enters it.
- Current pool verifies file device/inode before reuse, explicitly closes on failed operations, and framework close awaits program-state pool shutdown. t381 lacks file-identity verification and owner shutdown API; it relies on holders releasing. A reconciled implementation must preserve current protections and close integration.
- t381 atomic upsert with RETURNING removes the select/write race and retains original creation time. Preserve its write metrics (rowsChanged/rowsReturned) and make it a bounded independent part of the migration.
- t381 explicitly sets synchronous=FULL on global connections. Current global code does not override SQLite's default; project database explicitly uses NORMAL. Keep global authority write-ahead durability distinct from project WAL policy; do not lower global synchronization while optimizing connection reuse.
- Whole canonical operation must keep its phases as separate transactions. Holding a handle must not wrap project/file effects in one long global transaction or weaken project authority guards.
- t381 resolves paths but does not normalize Windows casing/aliases. A reconciled pool and queue must agree on one file identity; test mixed casing/aliases if accepted by supported callers.

## B saved evidence: scope established, root cause still unproved

Evidence resides in `fxwork/t262/!FluxIQWebExtension/test-runs/instances/t262-slot-3/run-mv4jgt1w-d3c5237f/`, not lab-runs. Summary/evaluation/event 68 agree: provider disabled, zero model calls, 29 workflow steps, failed recording.persistence. After 91,386 ms and 130 polls, Core had 106 entries, 81 appended during waiting, and no endedAt. The run lasted about 305 seconds overall. The Lab correctly refused to build from an unfinished timeline.

`packages/test-runner/src/flow-lane/finalized-recording.ts:86-135` waits for endedAt and two consecutive equal finished counts; widening its 90-second bound would conceal ongoing backlog. Counts show progress, not a deadlocked writer. Per-call connection overhead is plausible, but the saved summary does not separate object preparation, serialization size, global database calls, project writes, poll contention, gateway queue or finalization. Calling connection reuse the proven cause would overstate evidence. t381's hold is absent from appendRecordingEvents, so even its original code keeps sequential recording writes per-call unless queue overlap happens incidentally.

## Concrete continuation and validation plan

1. Preserve 08eafd1a history. On its task unit integrate current dev normally and resolve SQLiteRepository around the current connector/pool/operation-queue seam. Avoid replacing t435 wholesale or introducing a second singleton. Implement canonical whole-operation scope on the chosen pool while preserving current run scope, inode checking, close ownership and fresh reads.
2. Run only owning database-manager repository/pool tests, `_shared` state-root/storage tests, performance-metrics write accounting and canonical whole-operation/process tests. Add tests for overlapping run/canonical scopes, nested scopes, two different tables sharing a file, last owner release during queued writes, unused scope, double release, exception/cancellation, rollback failure, setup/open/close failure, re-open after replacement, and no global handle/sidecars after completion. Distinguish cleanup errors from operation errors.
3. Rebuild affected Core library using owning command before all process probes. Verify dist contains the chosen implementation. Run actual dist-backed canonical process.test.ts and whole-process.test.ts children in production framework-first import order, including kill/restart at reservation/project claim/effect/completed phases. Both parent and child must use rebuilt code; the old t381 report explicitly had stale child dist.
4. Retain raw SQLite cross-process visibility/contention tests, but add a second rebuilt-Core-process test: each process uses the real repository, sees committed writes on a held handle, preserves createdAt under concurrent upserts, serializes writers, and does not reuse rollback-poisoned connections. Kill after committed write and reopen to check persistence; treat this as crash/restart evidence, not proof of OS power-loss durability. Explicitly inspect pragma journal_mode/synchronous/foreign_keys on global handles and project handles separately.
5. Record phase timings and counts for actual recording batches before choosing a fix: gateway queue length/drain, recording lock wait, object preparation/dehydration, global session get/put, project event/state/index operations, polling reads, stop/finalize ordering. Use isolated data, no captured page bodies or secrets. A dist-backed provider-free append/drain probe should preserve count/order and end only after all preceding entries persist. Compare operation count/open count and median/tail latency, not only elapsed pass/fail.
6. If connection overhead dominates, explicitly scope an existing pool across one bounded recording batch (and provide that pool to the participating canonical recording repository). Preserve FIFO append/stop order, recording mutation lock, immutability, project persistence and two-read completeness gate. Do not hold a global transaction for an entire recording or leave handles for a browser session lifetime without a close owner.
7. Validate recording-owning service-recordings storage/finalization tests, client-gateway bridge/bridge-restart/write-order tests and downstream finalized-recording/completeness tests; use current package typecheck and structure audit for integration. Full Core/package suites are not a prerequisite under the newer user rule. After measured fixed-source probes, rerun the allowed bigbox-retail provider-free recording scenario and inspect endedAt, exact entry/action count, zero calls and output identities before claiming B recording fixed.

## Verification limits

The historical 111 tests and timings belong to the old worker report and were not rerun. This review inspected six commit files, current owning source and saved sanitized verdict/count fields; no model calls, browser runs, process probes, builds or tests were launched. Original WIP and shared documents are untouched. Source integration and runtime verification remain owed.
