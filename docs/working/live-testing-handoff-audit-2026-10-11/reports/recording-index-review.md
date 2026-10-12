# t454 recording index independent source review

Status: Read-only review complete; targeted supervisor reproductions recommended before acceptance.
Owner: a-review worker.

## Current State and evidence boundary

Reviewed frozen paired t454 source at Core `1a7e47c6bd031aadb5ef81536a757b206dcce0ec` / downstream supervisor-synced b16ad470, main working Current State/brief and recording-stream-owner.md. All 21 changed/new Core paths below inspected, focusing changed recording wiring rather than unrelated facade/pipeline methods. No tests, builds, runtime probes, browser/provider calls, source edits, commits, merges or shared-document changes performed. Worker test counts/timings/build identities are reported claims, not independently rerun proof. Findings below are concrete code interleavings; their operational reproduction remains supervisor work. No speculative security checklist or unrelated framework/pool redesign proposed.

The positive-cursor adapter and durable projection have a coherent recording-only design. I do not recommend acceptance of broad concurrent-owner or removal-retry claims until the four bounded cases below are resolved or explicitly scoped out. Normal one-facade mutation-lock serialization is distinct from the competing typed-owner interleavings.

## Source-supported strengths

- Public entries retain original zero-based sequence/ID/body. Storage envelopes allocate a separate positive cursor; full reads decode envelopes and retain unwrapped legacy public sequence. No inferred legacy offset.
- Canonical digest recursively sorts object keys, preserves array order, and follows JSON persistence normalization. Projection stores ID, public sequence, digest, time/offset and removal flags; no duplicate page bodies. Existing-ID/public-sequence conflicts reject; removed IDs cannot be retried as active entries.
- Generated-field retry proof restores only originally omitted timestamp/monotonic offset, keyed to actual assigned entry IDs. Supplied time changes and other body differences still conflict. Service omission proof length is checked; public append return retains prepared/public bodies and copies landed original time/offset.
- Projection catch-up reads only chunks beyond durable indexed_cursor. It commits entry identities/counts/cursor in one project-SQL transaction after matching generation and old cursor. Descriptor update/delete/lower-cursor insert triggers invalidate projection; rebuild uses verified chunk owner. The post-catch-up accepted-ID/content/removal checks cover an incoming packet removed while its chunk lands.
- Explicit recording deletion unlinks only exact old event_chunk references before descriptors disappear, then clears chunks/head/entries. Objects/bytes and unrelated runtime/recording/review references remain. Same-ID recreation obtains a new generation. Raw descriptor changes invalidate derived state rather than hand-editing historical bodies.
- Recording-only typed errors now propagate; missing typed storage alone permits file mode. Generic runtime fallback behavior is unchanged. Canonical append/finalize mirror publication follows typed write and later metadata success.
- Legacy JSONL plus SQL merges by proven ID/body/public sequence, deduplicates identical overlap and rejects conflicts. Removals fold after merge so stale file entries cannot revive an explicitly removed ID. Historical reconciliation refuses missing durable entries and ended-time conflicts rather than deleting or renumbering data.
- Cached-open late finalization recovery reads durable completion header and verified merged history, checks complete count, then adopts original endedAt. Incomplete count rejects without advancing the canonical mirror. Public repeated finish keeps its established original-endedAt behavior; direct typed differing end remains refused.

## Finding 1 ? existing removed prefix can be republished from the service cache

Owners: runtime/service/recordings/store.ts:202?204 and :219?227; runtime/service.ts:4087?4088 and :736?737; storage/project/recording-stream/store.ts:48?51.

Reproduction to run: create/open service recording with entry A and a populated canonical cache. Through the legitimate typed removal owner, remove A while preserving the same recording. Then append B through the service and compare its returned/public timeline, header counts and typed read.

Cached-open load checks durable completion only; an open recording keeps its old prefix. The adapter catches the removal but validates accepted incoming B only. Service then splices the old prefix A with accepted B, upserts counts from A+B and publishes A+B. Typed read folds the control and returns B. This can re-expose removed A in the public mirror and cause later finalize to reject its stale removed entry. The existing regression removes the *incoming* packet before publication; it does not remove a pre-existing cached prefix. This is a concrete source gap for service catch-up under external controls, not a claim that normal same-facade removal bypasses its mutation lock.

Expected narrow supervisor assertion: removed A stays absent from public and typed timelines/counts after next append, or the stale service mutation refuses before publishing any inconsistent mirror. Preserve explicit identity/public sequence; do not silently renumber history or weaken removal proof.

## Finding 2 ? late removal metadata failure has no same-service recovery path

Owners: runtime/service/recordings/store.ts:61?72; storage/project/runtime-stream-store.ts:413?416; recording-stream/store.ts:75?78.

Reproduction to run: use ordinary recordingEntryRemoval on one service; inject rejection in saveRemoval's persist callback *after* actual durable removal control has landed. Restore callback, then public-read and retry the same removal without restarting.

Durable removal succeeds before persist/writeTimeline/canonical publication. Existing cached-open read still returns the old removed entry because completion recovery sees no endedAt. Retry begins store.putRecording(previous stale mirror), and reconciliation rejects that removed ID before it can publish the intended next timeline. Restart full-history read correctly folds the control; immediate retry/recovery is not covered by the new tests. This does not demand cross-document atomic rollback: the unit expressly allows later metadata to remain stale after failure. It does mean the same-service undo retry cannot currently complete its already-durable mutation through that path.

Expected narrow assertion: durable removal remains gone, canonical cache becomes coherent after public read/retry, and successful retry does not append a second control or restore removed content. If unsupported, report restart-only recovery explicitly rather than claiming all landed operations are retryable.

## Finding 3 ? an append can cross durable finalization after its only status check

Owners: recording-stream/store.ts:19?20, :45 and :54?64; runtime-stream-store.ts:404?405 and :436.

Reproduction to run: pause typed append A after its open status read / initial projection synchronization but before writeEntries. A second typed owner puts the complete current recording with endedAt99. Resume A and inspect append outcome, chunks, header and completion read.

There is no transaction/status predicate coupling the initial open check to chunk persistence, nor a later endedAt check before successful return. Append can write a new chunk after the other owner has finalized; the header count update leaves endedAt99 while increasing counts. Normal one-service facade locks serialize append/finalize and cover that normal route. The source does not establish the stronger direct-owner concurrent immutability claim. Removal likewise checks open immediately before an awaited raw write, not atomically with it.

Expected narrow assertion: a finalized recording gains no late entry/control and retains coherent original count/end, with the stale operation refusing. A post-write rejection alone is not evidence that no late chunk landed; inspect durable history. Scope any repair to recording owner synchronization/persistence, not generic connection-pool work.

## Finding 4 ? delayed successful header update can overwrite newer projection counts

Owners: runtime-stream-store.ts:433?436; recording-stream/store.ts:46?52; projection.ts:34?41.

Reproduction to run: append A and pause its update-recordings call after projection reports count1. Append B through another typed owner and allow its count2 update to finish. Resume A's older update. Compare recording header to recording_stream_heads and full active typed history.

Projection transaction preserves a coherent cursor/count generation, but the later header update writes copied counts with only recording_id in its WHERE clause. A delayed older successful update can set header1 after head/history2. This can affect list summaries and completion count proofs. Existing counter test rejects the header update then retries the same packet; it does not delay an older successful update behind a newer successful one. There is no generation/cursor condition on that publication.

Expected narrow assertion: recording header equals latest active projection counts and cannot regress under this interleaving. Include an external removal that changes counts, rather than treating monotonic event count alone as the correct policy.

## Retry scope and unsupported claims

The observed new retry tests cover a stable packet after typed persistence succeeds but later metadata fails while the canonical mirror has not advanced. They do not prove duplicate handling after a fully published mirror whose response acknowledgment is lost. The unchanged public model append still runs for each incoming call; assigned ID/public sequence can change on a new append. Index lookup is by assigned ID/sequence, not correlation/source key. Do not claim general exactly-once gateway append semantics or change model identity to deduplicate acknowledgment loss in this unit.

A different packet after the partial failure, before the original retry heals the cache, is also untested: stale public sequence can collide with the already-landed entry and refuse. That is strict conflict behavior, not proof that FIFO recording capture continues through arbitrary failed packets. Recommend a narrow diagnostic case only if the supervisor intends to promise that progress behavior; retain the distinction from exact same-packet retry.

Projection rollback covers its project-SQL identities/count/cursor transaction only. Chunks/content objects and separate metadata/index/canonical documents are written at other stages and can remain after a later rejection. The report appropriately excludes cross-database/document atomicity. Completion recovery proves count coherence plus verified durable history, not a header-stored whole-history digest or arbitrary raw-SQL rewrite authority.

Index linearity is scoped: warm valid append catches newly landed chunks and indexed incoming identities; cold/invalidation rebuild reads a prefix. readTimeline/page/remove/reconcile still scan history, and service model/canonical/index operations still handle timeline state. It is not an overall constant-time append, general speed or live browser backlog claim. In-place external content-byte corruption without a descriptor change is outside the immutable content-owner contract; do not introduce a broad security gate as part of this review. A real valid descriptor replacement/delete test would strengthen the current noop-sha update/backfill coverage and should assert generation invalidation, rebuilt identities/counts and no accidental unrelated-reference cleanup.

## Test adequacy and recommended supervisor order

Read test assertions rather than accepting reported counts: adapter tests check zero public sequence, positive pagination cursor beyond the32-chunk window, legacy overlap/conflicts, removed-ID refusal, projection rollback, raw controls/backfill and exact delete reference retention. Service tests cover early write failure, immediate stable/omitted-time retry, prepared snapshot/public return behavior, legacy file conflict, late completion and insufficient completion count. Four separate actual-dist process cases preserve40/39 IDs/order/public sequences/end99 and normal pool close; their source is meaningful but was not run by this reviewer. Worker source still uses15s deadlines and has no assertion/timeout bypass.

First run the existing actual-built new/legacy/removed/late-finalize cases on the supervisor's synchronized artifact. Then prioritize Finding2 (single-service late undo failure) and Finding1 (existing removed cached prefix); follow with deterministic competing-owner Finding3/4 barriers if those owner concurrency guarantees are required. Also verify canonical nested-key reordering versus actual changed payload, supplied timestamp/offset conflict, and real descriptor update/delete using owned valid chunks. These are bounded recording tests, not a whole suite or new fixture website.

## Reviewed paths

All paths below relative to Core packages/fluxiq/src/programs/automation-studio:

1. runtime/service.ts (recording-only diff/wiring)
2. runtime/service/recordings/index.ts
3. runtime/service/recordings/store.ts (changed return/removal/load/completion sections)
4. runtime/service/recordings/load-timeline.ts
5. runtime/service/recordings/tests/process-probe.mjs
6. runtime/service/recordings/tests/process-restart.test.ts
7. runtime/service/recordings/tests/storage-restart.test.ts
8. runtime/service/summaries/store.ts (strict recording collaborator)
9. runtime/tests/service-recordings/tests/storage.test.ts (changed assertions)
10. storage/project/administration.ts (migration registration)
11. storage/project/index.ts
12. storage/project/runtime-stream-store.ts (recording methods/count publication)
13. storage/project/schema/index.ts
14. storage/project/schema/table-names.ts
15. storage/project/schema/recording-stream.ts
16. storage/project/schema/tests/recording-stream.test.ts
17. storage/project/recording-stream/entry.ts
18. storage/project/recording-stream/projection.ts
19. storage/project/recording-stream/store.ts
20. storage/project/recording-stream/index.ts
21. storage/project/recording-stream/tests/store.test.ts

No other source or planning-doc discovery performed. This report is an independent read-only assessment; supervisor acceptance requires actual reproductions and final checks, not this review or the implementation worker's completion claim alone.
