# Recording persistence measurements

Status: Complete
Owner: recording-persistence-measurement worker
Subject: read-only t380 Core776046504b269bd5921094099e5d60b128272a92
Probe workspace: t381 downstream ignored test-runs/recording-persistence-measurement

## Current State

Actual dist, framework-first import, providers disabled, isolated mkdtemp roots/config through owning FluxIQ.create/setup. No t381 Core WIP loaded/built, source edited, browser/model/panel call, merge or timeout change.

Important assembly evidence: `framework/index.ts:179` calls `_shared/runtime.ts:70`, which supplies storageRootDir/custom node root but no canonical repositories. `AutomationStudioService` therefore defaults to AutomationStudioMemoryRepository, even with layoutv2. Reopen confirmed this. Durable project timeline still uses actual typed projectSQLite, and program/index state produces actual globalSQLite metrics. An explicit canonicalSQLite service is a distinct comparison, not a claim about production default construction.

Pilot revealed own probe issues before measurement: initial canonical-only assertion correctly rejected configured memory mirror; endedAt test constant predating recording start was clamped by the real model, then corrected to a valid stop timestamp; outside measured-scope instrumentation lacked fallback ID and was corrected. None is counted as a product defect.

Corrected pilot passed both assemblies on8synthetic state entries in onebatch: explicitcanonicalSQL drain358.9ms (58global/26projectSQL statements); configuredassembly269.7ms (44global/26projectSQL statements). Exact persisted count/order, FIFO finalization, late mutation refusal, idempotent finalize, restart persistence and normal close all asserted. Pilot timings are smoke evidence, not final comparisons.

Main matrix now planned: two assemblies ×128byte/32KiB synthetic value payloads ×batch1/8 ×three rounds,32entries per cell. Timing wrappers preserve actual method calls/arguments/results/errors. SQL metrics contain only category/count/duration/fingerprint metadata, never raw payloads. Nested phase spans overlap and must not be summed as disjoint cost. Queue measurements are actual service recording lock, not browser gateway backlog.

### Main matrix interruption

First configuredassembly/128byte/batch1/32-entry cell passed exact count/order/FIFO stop and immutability before close, then reopened service returned1entry rather than32. Probe stopped on its assert before publishing a passing result. All services/root closed and cleaned normally. This is a reproduction candidate, not yet classified: batch8pilot reopened8correctly. Requested bounded extra read-only typed persistence/reconstruction owners from supervisor; no source edits or increased wait. No browser backlog fix claimed.

## Classified correctness failure

This is a real owner sequence/reader mismatch, not a synthetic ID collision. Synthetic entry IDs, state IDs, state values and resulting snapshot content are distinct. The input does not supply sequence; actual `model/recording-framework.ts:50/130` assigns the first public timeline entry sequence0. `storage/project/runtime-stream-store.ts:420/677` preserves supplied sequence0; referenced `event-chunk-store.ts:149` rejects any chunk sequence<1. The first typed append therefore throws “event sequence must be positive”. Observed error recorded for append.0 in every matrix cell.

`service/summaries/store.ts:325` catches the typed operation failure and returns null. `service.ts:721` treats that as a reason to write the first batch into timeline.jsonl. Subsequent positive-sequence entries append to typedSQL instead. `runtime-stream-store.ts:398` finalization backfills a whole timeline only when SQL has0events, so it does not reconcile this split. `service/recordings/store.ts:173/265` restart reconstruction reads recording.json and file-only timeline.jsonl, ignoring typedSQL event chunks.

Evidence across every round/payload:
- Before close: public recording32entries in exact order; immutable endedAt/FIFO stop assertions pass.
- Batch1: first1entry in fallbackfile; remaining31in typedSQL.
- Batch8: first8entries in fallbackfile; remaining24in typedSQL.
- Configured assembly: reopened public recording returns only the fallback1or8entries. All12configured matrix cells fail restart exact-count/order assertion.
- ExplicitcanonicalSQL comparison: full globalcanonicalcopy returns all32after reopen, masking the underlying typed-stream omission; all12comparison cells fail a separate typed exact-count assertion (31or24rather than32).
- Normal close, pool closing/zeroopenprojects and safe isolated-root cleanup completed for all24cells. Repeated finalization preserves original endedAt; late append is refused. These successes do not erase the failed durability assertions.

Assertions remain enabled. Measurement mode catches each failed assertion to save numeric phase evidence and continue independent cells, marks every result failed and exits1. No failure was counted as a pass. Pilot's onebatch result passed public reopen only because its fallback file already held the entire8-entry recording; larger matrix exposed the owner split.

Bounded extra owner reads authorized by supervisor: service/recordings/store.ts; storage/project/runtime-stream-store.ts; referenced event-chunk-store.ts; recording-framework.ts append helper; immediate service/summaries/store.ts typed-call wrapper. No unrelated code or t381 Core WIP read for this diagnosis.

## Measurements (three rounds per row,32synthetic state observations)

Supervisor independently reran the preserved configured 32-entry singleton reproduction through the same
actual built subject. Exit 1 at reopen, typedEntries 31, timelineFileEntries 1, actualRestartEntries 1
(6.145 s command). Evidence: ignored supervisor-restart-repro.json. This confirms the durability failure;
the browser backlog remains unproved and the private probe is not a product fix.

Stop latency is the measured finalize request's queue wait plus finalization, issued immediately after all appends. It measures service drain, not browser/gateway transport. Values rounded to milliseconds. “Tail” is maximum of three rounds, not a population percentile.

| Assembly | State value bytes | Entries/batch | Stop/drain median ms | Tail ms | Global SQL/cell | Project SQL/cell | Durable result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Configured memory mirror + durable project |128|1|2616|2624|633|419|restart1/32|
| Configured memory mirror + durable project |128|8|726|732|101|55|restart8/32|
| Configured memory mirror + durable project |32768|1|2704|2781|633|419|restart1/32|
| Configured memory mirror + durable project |32768|8|753|855|101|55|restart8/32|
| Explicit canonical SQLite comparison |128|1|3484|3520|864|419|typed31/32; global reopens32|
| Explicit canonical SQLite comparison |128|8|770|776|136|55|typed24/32; global reopens32|
| Explicit canonical SQLite comparison |32768|1|3497|3509|864|419|typed31/32; global reopens32|
| Explicit canonical SQLite comparison |32768|8|851|959|136|55|typed24/32; global reopens32|

Configured128-byte single-entry cells, pooled across96append calls/3finalizes:
- Recording lock:33entries/cell; median wait1198ms, p95~2360ms, max2502ms. Calls ran FIFO; queue drained before stop returned.
- Canonical memory recording get:66/cell, median0.13ms; put33/cell, median0.30ms.
- Prepare normalization + new state dehydration:32/cell, median4.44ms/p95~5.52ms.
- Existing timeline dehydration:33/cell, median0.026ms; previously stored references avoid rewriting each snapshot body.
- Typed project append + summaries:32/cell, median8.63ms/p95~10.31ms; first call fails/falls back.
- State index:33/cell, median2.47ms/p95~3.62ms.
- Project index/pipeline summary:32/cell, median60.70ms/p95~64.86ms, dominates median lock-body77.24ms.
- Finalize full project-session write:1/cell, median124.89ms; typed full-session part median30.38ms.
- Global statement count633/cell includes266pragma scripts,266selects and101inserts. These concern persistent project/program indexes/documents, not the fast memory recording mirror. Project SQL419/cell.

Configured batch8 cuts append transactions from32to4, lock+stop entries33to5, global statements633→101 and project statements419→55. Median stop latency improves ~3.6× in this unit probe. Preparation perbatch rises to~68ms as8new objects are processed; index summaries remain~63ms/batch. ExplicitcanonicalSQL adds real globalrecordingget/put costs, explaining its slower singleton comparison. Do not confuse this comparison with production assembly or claim t381's canonicalwholeoperation hold covers these index calls.

Nested spans overlap: raw-read contains mirror reads; full-session contains typed/index work; append.total includes queue wait/body; finalization includes queuewait/full-session. Their sums are not disjoint elapsed costs. Detailed per-operation median/p95/max/counts and SQL categories are in ignored aggregate.json; no raw payloads/SQL text are in evidence.

## Source/artifact and evidence

Subject HEAD776046504b269bd5921094099e5d60b128272a92 remained unchanged and clean after probes. Actual runtime artifact digest d2b86f4b02999a9f69d899cb5577c3dc3ae280d9305a7da4bd40765b51c7362a; dist was rebuilt/stamped by supervisor before this task and remained read-only. Framework-first load order exactly used before service/storage helpers.

Ignored private evidence in this downstream tree: test-runs/recording-persistence-measurement/probe.mjs, pilot.json, restart-repro.json, results.json(24failedcells), aggregate.json. Roots/config/runtime data created only through owning APIs on isolated synthetic mkdtemp roots, then normallyclosed and removed after resolved-path safety checks. No profiles, captures, recordings or secrets from the user's work were opened.

## Actionable continuation and limits

1. Prioritize correctness before optimizing: reconcile public zero-based timeline sequence with positive SQLchunk cursor at the owning adapter, preserving public timeline/state correlation contracts; add a real dist-backed configuredassembly append/finalize/restart regression with multiple singleton batches. Do not blindly change model sequence convention across consumers.
2. Establish one durable recording read/write authority and reconcile fallback/typed histories; restart loader must read the owning typed stream or explicitly merge/migrate legacy fallback data without duplication/reordering. Finalization must not declare a complete recording while durable owners each hold only fragments. Test failures must not be silently converted into success; retain exact typed failure evidence.
3. After these regressions pass, focus latency probes on perappend project index/pipeline work and the existing program-state connection owner. A bounded append-batch scope or summary coalescing is plausible; require unchanged FIFO stop/count/order/restart/close behavior and no long global transaction or session-lifetime leaked hold. Do not merge t381's competing pool wholesale.
4. This probe does not exercise gateway batching/capture arrival, real DOM snapshots/images, browser rendering, network transport, service restart between queued messages, other processes/poll contention, or the saved B90second waiter. Simple synthetic state blobs do not reproduce actual nested browser state/metadata complexity. Unit stop/drain times do not establish B's browser backlog cause or fix; perform the allowed provider-free bigbox-retail recording run only after correctness/source fixes and current identity checks.

No source fix/build/merge, live/browser/provider call, user-panel action or timeout increase performed. Historical B failure remains unresolved. The task supplied measurements and an independently repeatable correctness failure; it did not fix persistence.

