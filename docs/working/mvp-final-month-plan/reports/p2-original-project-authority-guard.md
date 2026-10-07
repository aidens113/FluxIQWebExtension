# Original-project authority guard foundation - t320

Status: source/report frozen; owning narrow checks and actual-built child probes passed. Supervisor verification/integration pending. Provision73106 completed0 and supervisor approved contracts/capture-release/persistence paragraph before implementation. Worker: p0_cancel_control. Approved isolated Core source/owning tests and this report now changed. No providers, browser/panel or git operations.

## Proposed owners

Core new `packages/fluxiq/src/programs/automation-studio/storage/project/authority-guard/{contracts,migration,validation,store,index}.ts`, owning `tests/` and bounded child-process probe; additive `storage/project/index.ts`. Proposed existing architecture owner: `docs/architecture/automation-studio/persistence.md`, one scoped foundation paragraph next to staged accepted-state. No activation, namespace, adoption endpoint, all-writer wiring, accepted graph/schema or shared working-doc edits.

## Closed contract proposal for approval

Use original project/resource IDs with current200-character bounds and protocolVersion1. No ID rewriting. Request/record envelopes reject extra fields; digest strings are lowercase SHA256 with a fixed prefix, operation/owner/key identifiers bounded, timestamps/revisions finite safe integers. Persist only IDs, request/result/evidence digests, protocol/revisions, statuses and server-issued timestamps: no caller raw request/result/source/page payload.

`LegacyMutationRequest = { protocolVersion: 1, projectId, operationKey, ownerKind, ownerId, operationKind, requestDigest, expectedRevision }`. expectedRevision is required to avoid claiming against an unnoticed earlier completion. The store is a trusted-owner infrastructure port, not authorization or independent proof of operation semantics.

`LegacyClaimRecord = { request, baseRevision, claimedAt, claimDigest, state: pending|unknown|completed, unknownReason: null|effect_uncertain|completion_uncertain|owner_interrupted, completion: null|LegacyCompletionReceipt }`.

`LegacyCompletionReceipt = { projectId, operationKey, claimDigest, ownerKind, ownerId, operationKind, requestDigest, previousRevision, completedRevision, resultDigest, completedAt, receiptDigest }`. Exact completion increments revision once: completedRevision = previousRevision +1. Immutable receipt has an exact historical predecessor join; validate owner/operation/request/claim/result/revision/digest, not only a borrowed UoW request hash. A later head must not invalidate a valid old receipt or turn it into current clearance.

`ProjectGuardState = { projectId, protocolVersion:1, mode:legacy|capturing, completedRevision, lastCompletedOperationKey:null|string, activeCaptureKey:null|string }`. No active/tombstone/adoption methods in this foundation. Initial state is revision0, legacy, no completed operation/capture; missing or corrupt historical joins refuse, never reseed.

`CaptureRequest = { protocolVersion:1, projectId, captureKey, ownerKind, ownerId, requestDigest, expectedRevision }`. CaptureRecord stores the immutable exact request, capturedRevision, captureDigest, acquiredAt, state:capturing|unknown|released, release:null|{captureDigest, ownerKind, ownerId, requestDigest, releasedAt, evidenceDigest, receiptDigest}. No caller snapshot or success/no-effects Boolean.

## Store surface and ordering

- `open({pool,projectId,captureReleaseOwner?})` migrates current administration plus next local `0028_original_project_authority_guard_v1`, opens existing UoW, and owns leases/close. It does not initialize an actual user project or touch legacy files. Explicit authorized first claim may initialize guard row; opening/read alone creates no mode/claim/head. Project identity must match the lease on every request.
- `claimLegacy(request)` runs one UoW transaction, validates exact prior-key joins first, compares revision/mode, rejects unresolved other claims, inserts durable pending claim and its mutation receipt, and COMMITs before returning execution permission. New claim gets an opaque live completion capability. Existing exact key returns executionAllowed:false plus recorded outcome, even pending/unknown; it never resumes/replays the external callback. Same-key different owner/operation/digest/revision conflicts.
- `completeLegacy(capability,{resultDigest})` requires the live store-issued ownership capability, exact claim and current predecessor revision, and writes immutable whole-operation receipt/revision/change in one UoW. No capability is reconstructed from a JSON key after restart. Repeated identical completion reconciles/replays the original receipt without revision increment; different result digest refuses. Only the trusted outer-operation owner may call this; a nested helper cannot manufacture its capability. Completion after a pending/unknown effect can only be supplied by that still-live owning operation when it attests the entire final result; foundation provides no arbitrary restart force-complete API.
- `markLegacyUnknown(capability,reason)` preserves unresolved claim and never releases it or decrements revision. A committed matching receipt wins; no error/finally path silently clears pending. Unreachable owner/process death leaves pending, already an adoption blocker. Unknown reasons are diagnostics, not expiry instructions.
- `runLegacyMutation(request,operation)` is a convenience wrapper built from these primitives: claim COMMIT -> one callback -> complete COMMIT. The callback returns an actual in-memory value and a bounded redacted resultDigest; only the digest persists. Existing-key branches do not call it. A preclaim failure gives zero effects; an error after callback admission conservatively records unknown. Completed replay returns receipt-only `result_unavailable`, not a fabricated live value. A lost completion acknowledgement re-reads exact joined receipt; unknown remains closed.
- `beginCapture(request)` validates exact replay first, then compares completedRevision and checks zero pending/unknown claims in the same BEGIN IMMEDIATE transaction as inserting capture record and changing mode to capturing. New acquisition returns acquired:true; existing key returns acquired:false with its original record, never reacquires a released capture. Later legacy claims refuse while mode capturing. Capture does not increment legacy revision or stage/activate snapshots.
- `releaseCapture({captureKey,ownerKind,ownerId,requestDigest,captureDigest})` accepts identity only. An injected trusted read-only capture owner must match the exact recorded owner/protocol and independently provide its bounded release evidence through `verifyReadOnlyRelease(record)`; no caller evidence/success/no-effects field is accepted. Callback runs outside SQL; final UoW rereads and CASes the same capture/mode/revision and commits immutable release receipt plus mode legacy. An absent/mismatched/unverifiable owner leaves capture blocked. Released exact replay returns recorded receipt without calling verification again or releasing a newer capture. A restarted trusted owner may verify/release the exact old read-only capture; this is trusted owner infrastructure, not independent certification that arbitrary external code had no effects.
- `markCaptureUnknown(identity,reason)` keeps mode capturing. It cannot release or expire capture and cannot supersede a released receipt. Exact recorded owner/digest required.
- `readState`, `reconcileLegacy(request)`, `reconcileCapture(request)` are read-only joined queries, returning absent/pending/unknown/completed or capturing/unknown/released plus exact recorded digests/receipts. They never invoke effects, acquire a fresh key, release a claim, reset a head, or claim current activation. Corrupt/missing/borrowed historical joins return explicit outcome_unknown/refusal, not permission to execute again.

All UoW callback SQL uses context.sql; never nest a queued database transaction or call the pooled database behind an open transaction. A pre-effect claim is committed by a distinct UoW call, not the uncommitted started row of the external operation. Same-key replay validation must include mutation owner/operation/status/request/response and original immutable rows independently of UoW's digest-only replay seam. Store timestamps are generated internally; no TTL, expiry, automatic release, history pruning, or replay callback on restart.

## Capture release limits and required tests

Capture is read-only coordination ownership. Its release verifier is an injected trusted port bound to recorded owner; this foundation cannot prove no old uninstrumented writer exists or no arbitrary filesystem mutation occurred. Legacy pending/unknown claims prevent capture; a read-only capture release cannot clear them. No generic unlock/force-release Boolean. One-time old-writer deployment drain and actual capture/compiler/all-writer/read joins stay separate unavailable work.

Proposed real-SQL tests: two owners serialize original-project claims; legacy completion invalidates old expected revision once; pending/unknown blocks capture; capture blocks later claim; replay after release never reacquires; old release cannot clear new capture; malformed/foreign/borrowed request/claim/receipt/revision/UoW joins refuse; preclaim rollback zero callbacks; multi-step sentinel error stays unknown; committed completion lost ack reconciles once; release verifier absent/mismatched/throw blocks and stale verifier CAS cannot release changed capture. Actual child kill after sentinel before completion retains pending and replay callback count0; child completion then death before response reopens completed receipt/revision and callback count0. Bounded owned temp/process cleanup and provider-free counts; no real project/user data.

Supervisor approved these shapes, live completion capability/receipt-only replay, recorded-owner release port and persistence paragraph after provisioning READY. Implementation remains limited to the foundation.

## Implementation evidence so far

- Supervisor approved additional focused `authority-guard/records.ts` read/verify owner and tests to separate history validation from store transitions; no baseline increase.
- Scaffolding run failed collection because implementation imports did not yet exist; zero tests. This is not behavioral fail-first evidence.
- First actual4-case run failed3/4: records reader treated the current started UoW transition as corruption. Fixed exact in-flight exception confined to that transaction; independent readers still reject uncommitted history.
- A deterministic late-unknown race failed before correction: completion committed after unknown's initial read, then unknown borrowed the completion digest under its own key, creating an orphan durable mutation. Changed already-completed/released branches to roll back that attempted transition and retain the original committed receipt.
- Latest ordinary owning run31/31 across store13/records9/validation9, zero skips (4.65s vitest duration). More process/check evidence pending. Strict owner/op/request/result/predecessor joins and bounded plain input hashing implemented; only IDs/digests/statuses/timestamps persist.
- Package typecheck and Core structure audit currently running; process probe prepared for actual newly built JS, not yet exercised.
- Open explicitly creates/migrates infrastructure SQL. Wrapper resultDigest and capture verifier evidence are trusted producer assertions, not independent semantics. No official writer/adoption/source/head/compiler/read/executor/promotion wiring.

## Later narrow checks and limits

- Final ordinary source tests33/33, zero skips: store15/records9/validation9, vitest5.37s. Includes an actual COMMIT followed by an injected lost acknowledgement and unchanged external callback count1; caller noEffects release assertion refuses while unknown capture remains fenced. Process file's default2 skipped is deliberate until explicit probe enablement, not restart proof.
- Initial typecheck failed on assertion-object annotation and installed ForkOptions lacking windowsHide. Fixed explicit validation export type and used spawn with windowsHide. Initial structure audit found two silently swallowed unknown-persistence failures; replaced with surfaced errors/AggregateError while preserving pending claims.
- Final package check exit0, actual command67.244s. Final Core audit0:281 warnings/349 baselined; downstream audit0:176 warnings/117 baselined. No baseline changes. Source is frozen while final package build completes.
- Record parsing limits8KiB canonical JSON/depth12/nodes1024. Complete history is bounded at4096 records, with admission refusal before adding beyond that boundary; no pruning/truncation or implicit clear. Historical predecessor validation caches within each transaction and refuses cycles. Future scale/indexed-history work must be separately reviewed.
- Real SQLite old-key receipt evidence is distinct from current head clearance; replay never returns an opaque extracted/live result. Direct ordinary writer participation and actual adoption remain unavailable.

## Final freeze receipt and handoff

- Final Core package build exit0, actual command77.492s, generated6058 files/17,595,178 bytes; owning generator regenerated runtime stamps. No generated output edited/tracked.
- Explicit actual-built child process probe2/2, zero skips, testtotal850ms/vitest2.07s. Child imports the current built guard/database JS. SIGKILL after external sentinel leaves pending revision0; fresh owner returns outcome_unknown without another callback. SIGKILL after completed receipt before response reopens revision1/result_unavailable; sentinel remains exactly one effect. Parent reopen uses current source store against the literal child's SQL database; this is not a running web/server or actual legacy writer proof. Owned children are closed and guarded temporary roots removed; stderr is bounded, inherited secret/token/key credentials excluded, no provider runtime instantiated.
- Final ordinary tests33/33 and package typecheck0, Core/downstream audits0 as above. First/default process run's2 skips were not claimed as proof; explicit probe subsequently exercised both. No full suites, panel/user profiles/providers/git or main shared-document edits.

Exact source owners changed: Core authority-guard `{contracts,migration,validation,store,records,index}.ts`; owning `tests/{store,records,validation,process}.test.ts` and `tests/process-probe.mjs`; additive `storage/project/index.ts`; approved scoped `docs/architecture/automation-studio/persistence.md`. Downstream only this report. New migration0028 leaves old migrations/checksums unchanged. No active/tombstone/adoption/head/source/promotion method exists.

Independently runnable checks from paired t320 Core:

```powershell
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/storage/project/authority-guard/tests/store.test.ts src/programs/automation-studio/storage/project/authority-guard/tests/records.test.ts src/programs/automation-studio/storage/project/authority-guard/tests/validation.test.ts
pnpm.cmd --filter fluxiq check
pnpm.cmd --filter fluxiq build
$env:FLUXIQ_AUTHORITY_GUARD_PROCESS_PROBE='1'
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/storage/project/authority-guard/tests/process.test.ts
node scripts/structure-audit.mjs
# Paired downstream:
node scripts/structure-audit.mjs
```

No extension/domain source changed, so no extension e2e/source typecheck was invoked; browser behavior is not claimed. The child probe's phase after-completion observes committed completion before IPC acknowledgement; it is a real process kill/reopen test, not a power-loss/disk durability certification. Whole-operation resultDigest remains a trusted outer-owner assertion. Capture release remains a trusted recorded read-only owner assertion with exact SQL CAS, not proof that arbitrary external code had no effects. Missing verifier and stale released-key cases exercised; separate malicious verifier semantics are outside this trusted port. Actual all-writer/canonical global ownership/original capture/compiler/pinned-reader/native-dispatch/acceptance joins and old-writer deployment drain are explicitly unavailable.

## Independent supervisor verification
Root reviewed actual original-ID guard store, frozen envelopes, immutable full-history UoW joins/predecessors, pending/unknown admission, separate durable pre-effect claim, completion capability, capture revision CAS and recorded-owner release. Independent real SQL owning33/33 zero skips5.49s. Explicit current-built child SIGKILL/reopen2/2 zero skips2.55s (tests1.04s): pending external-effect interruption remains unknown/revision0, completion interruption returns receipt-only result_unavailable/revision1, each sentinel exactly one effect and no callback replay. Root actual nonincremental Core tsc0 (owning wrapper first reused stamp), direct Core audit0 281warnings/349baseline. No source changes/baseline increase; original all-writer/global resource/capture/pinned-reader/activation joins absent. Combined t317-base checks and task integration pending.
