# P2 candidate requirement and evidence receipts

Status: Partial; source frozen for supervisor verification/integration
Created: 2026-10-06
Owner: p2-candidate-evidence worker (t300)
Scope: New domain-neutral verification modules/controller; supervisor owns integration.

## Current State

Supervisor approved design and confirmed provisioning before edits. Implemented immutable original instruction/source-span brief, candidate/requirements/base identity, prepared-start/execution/observation receipts, deterministic field predicates with quantified subject coverage and one-attempt acceptance/promotion controller. Final 31 provider-free controller tests pass. Newness cites actual start observation reference and explicit interpretation gate defaults unknown. Source frozen; final typecheck and structure audit passed.

## Decisions and ledger

- Observation provenance cannot come from a source label. Controller accepts no builder packet/verdict; only trusted observer adapter callback yields fields/coverage. No semantic/model yes is an input to acceptance.
- Requirements retain original instruction text/IDs and validated source offsets. Builder/discovery annotations cannot rewrite them. Requirement digest joins candidate identity and accepted base; asynchronous stages reread current identity.
- Explicit subject IDs belong to immutable brief; all-subject scope requires complete enumeration from independent observer. Field completeness and generation/time/run/start identity checked. Known contradiction refutes even when other evidence is incomplete.
- Create requires performed command matching subject, trusted new-result attribution and not-present-at-start evidence; zero-node/withheld/no-op/unknown writes cannot prove it. Ensure may verify already-satisfied observed state.
- Receipt preserves execution and observation facts separately from requirement outcomes. Verdict is satisfied/unsatisfied/unknown, no model booleans or success labels trusted.
- Controller caches one attempt/promotion promise to avoid concurrent duplicate dispatch/promote. Project store MUST implement atomic candidate/requirements/base compare, signal authority and durable receipt idempotency; crash durability is not implemented here.
- No existing barrel, service/API/storage/adapter file touched. No automatic graph apply; controller calls only supervisor-supplied promotion port after receipts pass.

## Remaining work

Supervisor independent verification and serial adapter/persistence/facade integration required. Browser start reset, actual detached runtime, original-intent interpretation, durable version joins and shared bootstrap/repair promotion wiring remain supervisor work. No live qualification claimed.

## Final contract refinements

- `interpretationStatus` must explicitly be complete, and every original instruction must have a source-mapped requirement. Missing/partial/unmapped intent stops before dispatch. This is a trusted interpreter contract, not proof of complete intent interpretation; the real interpreter is NOT implemented. It must mark unsupported numeric comparisons, ordering, qualifier semantics or ambiguous intent partial/unknown, never silently omit them and claim complete.
- Start receipt carries baseline observation IDs, subject identity, existence, time and page generation. Create's result cites a matching baseline observation ID with existed:false plus matching performed command. A notPresentAtStart boolean alone no longer proves newness.
- Enumeration completeness has its own observation ID/time/page generation and candidate/run/start packet identity. Explicit subjects cannot be narrowed by observed subset; all-subject requirements need complete independently enumerated scope. Empty complete scope cannot prove create.
- Partial lower counts or missing membership remain unknown; an already-too-large exact count refutes, and concrete scalar mismatch outranks incomplete coverage. Supported predicates are exists, equals, contains, count_equals and count_at_least. Generic numeric comparison/minimum/ordering/universal predicate language is NOT implemented.
- A thrown promotion acknowledgment retains satisfied receipt as `candidate.promotion_outcome_unknown` for reconciliation, with no retry. Status draft here means no confirmed promotion receipt; callers must not infer proven-not-applied from that code. Durable store reconciliation remains required.

## Validation ledger

- Initial owning fixture: 21/21 pass. Expanded negative coverage: 26/26; unknown promotion acknowledgment: 27/27; final original-intent/newness/empty-scope cases: 31/31 pass (0.945s).
- First fluxiq typecheck failed only test exact-optional and discriminated-union fixture typings; corrected without weakening contract. Subsequent typecheck exit0 (7.341s). Final newness/interpretation source check passed exit0 (9.232s), executed and stamped.
- Initial structure audit failed inherited Core working ledger missing Validation bullet. Supervisor corrected main and t300 mirrored ledger; worker did not touch shared docs. Rerun passed (279 advisory warnings/349 baselined). Final newness/interpretation source audit passed exit0 (279 advisory warnings/349 baselined).
- No provider or browser/live calls, full suites, git mutation/commit/merge, runtime data reads/writes, or existing source owners touched.

## Exact owned source paths

Core relative to paired t300 !FluxIQ:

- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/verification/contracts.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/verification/identity.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/verification/predicates.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/verification/controller.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/verification/index.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/verification/tests/controller.test.ts`

Owned report: `C:/Users/osrs_/FluxStuff/fxwork/t300/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/p2-candidate-evidence.md`. Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t300/!FluxIQ`.

## Precise remaining integration obligations

1. Supervisor adds verification barrel to existing flow-bootstrap/index.ts after t299, not before; wire candidate static draft to controller with canonical topology/exact executor receipt, original instruction interpretation and current base identity authority.
2. `prepareStart` is a trusted reset/start adapter. It must establish requested clean conditions and capture independent baseline/newness/subject scope receipt; navigating alone is insufficient. Fixture reset/browser adapter not implemented here.
3. `execute` must run exact candidate revision/digest detached via normal runtime, deriving status/commands/subjects/count from real executor facts. It must not accept model/script-returned claimed success. Unsupported topology stays draft.
4. `observe` must capture actual run-end fields with subject/page/coverage/provenance independently; field names map to original requirement qualifiers. Shipping origin cannot be filled from seller address. Complete all-subject scope cannot be a model-selected subset. Semantic mapping is not implemented; missing/unsupported mapping remains unknown.
5. `promote` must preserve existing apply-time registry, permissions, ownership/handle and dependency validation; atomically compare candidate/requirement/base identity and cancellation, store receipt/version join, dedupe exact receipt idempotency key durably, reconcile unknown acknowledgement. Controller deduplication is one in-memory attempt only; restart/crash durability NOT implemented.
6. Persist private evidence/receipts in existing Core project ownership; screen diagnostics and user-facing material. Controller emits no logs, but receipts include original instruction/evidence data for storage and must not be printed wholesale.
7. Wire bootstrap, reauthor and repairs serially through this gate, verify exact adapter/runtime behavior provider-free before a live probe. This task proves controller fixtures only; NO shared product promotion path has been exercised or changed.

## Bounded create semantics

Create currently supports a new record/result identity absent at the declared start. It does NOT yet support a delta/relation receipt proving an increment on an existing stable subject, such as adding two towels when that cart row already exists. Such instructions remain unsupported/unknown until a trusted before/after quantity delta contract is added. Ensure can represent a user asking for a desired final quantity, but an explicit add/increment instruction must never be relabelled ensure merely to pass. The real interpreter must retain this distinction. Supervisor identified this bounded limitation; no source edits made after freeze.

- Final Core/downstream diff checks exit0. No tracked Core edits outside the new verification directory (supervisor's ledger correction is separately committed). Worker report complete; P2 product/runtime/adapter integration remains partial.
