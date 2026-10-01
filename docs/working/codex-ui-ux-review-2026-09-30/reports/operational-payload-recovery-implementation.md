# Operational payload recovery implementation

Status: Complete — exact source/tests frozen for supervisor review
Owner: deployment_docs_audit worker
Date: 2026-10-01

## Written brief (planning released; product held)

- Read parent Current State and own frozen operational-payload-validation-audit.md. Only malformed rendered payload recovery; all existing operational lifecycle/selection/locks/polling/Production parameter policy stay intact.
- Exact proposed Core paths: live-views/{compute-control,background-tasks,production-runner}.tsx; operational-payloads/{validateComputeSnapshot.ts,validateBackgroundSnapshot.ts,validateBackgroundRunPage.ts,validateBackgroundRun.ts,validateProductionSnapshot.ts,primitives.ts,index.ts}; owning operational-payloads/tests/validators.test.ts; new live-views/tests/operational-payload-recovery.test.tsx.
- primitives.ts, if needed, exports one cohesive predicate object; each validator exports its one owning guard. No extra helper/source/test paths without explicit supervisor release. Existing source contracts remain unchanged unless root separately owns a truthful relocation update.
- Reject malformed whole snapshots/pages through existing recoverable read channel, retain confirmed state/drafts. Guard Background selected mutation payload without claiming failed action when its acknowledgement succeeded; no automatic replay.
- Validate only rendered fields. Preserve optional unrendered omissions, null where existing contract allows, finite0/false/empty lists, custom displayable kind/status/type strings, scalar Production execution.result and dedicated parameterSchema policy. Never add artificial full-wire/schema/security guarantees or recursively inspect arbitrary private metadata/results.
- Write concrete design and tests-first plan here; source/tests HELD during eighth supervisor Core gates. No source/test creation yet. Supervisor explicitly releases after gates.
- After release, synthetic actual-view regressions first, pure guard edge cases and unchanged owning freshness/selection/operations/parameter tests, narrow heavy and actual-config scoped types, then freeze. No shared hook/API/backend/protocol/style/lock/parameter/polling changes, protected runtime/storage/conversations/context-packet, actual payloads, broad/live/browser/provider/panel operations, commits or shared docs.

## Design / progress

Read parent Current State, this written brief and own frozen operational-payload-validation-audit.md. Exact proposed12paths are sufficient. No product/test source created or changed; no execution checks ran during the eighth Core gate hold.

## Cohesive guard ownership

- primitives.ts exports one predicate object with narrowly named record, string/stringArray, finiteNumber, optionalString, optionalFinite and nullableOptionalFinite/domain-string helpers as actual reuse requires. Record excludes null and arrays. Optional means undefined allowed; null accepted only by explicitly nullable predicates. Avoid truthiness tests that reject0/false/empty strings.
- validateComputeSnapshot.ts exports one guard for the three arrays and their rendered members.
- validateBackgroundRun.ts exports one guard reused by page validation and selected mutation response presentation.
- validateBackgroundSnapshot.ts exports one guard for rendered task definitions and scheduler.running only.
- validateBackgroundRunPage.ts exports one guard preserving existing page scalars (limit50, integer nonnegative total/offset) and validating its runs. Keep the view's existing RunPage type/optional task compatibility; do not invent an optional page.task dependency.
- validateProductionSnapshot.ts exports one guard with private target/run/execution predicates, without exporting implementation internals or modifying the dedicated parameterSchema policy.
- index.ts is the owning barrel. One combined tests/validators.test.ts owns these closely related presentation guards; new live-views/tests/operational-payload-recovery.test.tsx owns real three-view integration.

All guards return boolean/type narrowing only, never normalized/dropped data, logged response contents, default replacements, extra reads, mutations or retained state. Integrate the guards into existing useOperationalSnapshot.validate callbacks so its already verified fixed-error/freshness/retention channel remains authoritative. Remove only each old shallow local validator; retain owner, read, refresh, history, locks, timers and parameters unchanged.

## Exact compatibility constraints

Compute requires arrays for nodes/commands/leases and object members. Node id/label/status and optional host are strings; domainIds/capabilities are string arrays; optional heartbeat is finite (0 valid); optional metadata is a record. Commands require string id/targetComputeId/kind, finite createdAtMs and optional string status/error. Leases require string id/computeId/holder/purpose and finite expiresAtMs. Do not enumerate status/kind values or change thresholds. Empty label remains legal for existing fallback.

Background requires tasks array of definitions with string id/name/queue, boolean enabled, optional string schedule and finite interval/last-run values; next-run may be undefined/null/finite. Scheduler must be a record with boolean running. Unrendered snapshot.runs and scheduler.pollIntervalMs are not newly required, preserving current minimal fixtures. History requires runs whose id/taskId/status are strings, queued time finite, optional started/finished finite and optional error string. Keep optional payload unrestricted as a JSON wire value; no recursive inspection.

Production requires targets/runs arrays of records. Target id/name/type strings; optional/null domainId; optional description string and metadata record. Run id/name/status strings; optional targetType/targetId strings, loops and rendered timestamps finite; next-run nullable optional finite; metadata optional record. executions may be absent or an array, including empty; each member requires finite loop/atMs and boolean ok, plus optional string error. result stays unrestricted JSON-compatible wire data so scalar execution results remain accepted. ParameterSchema, metadata.message and arbitrary results are not traversed or assigned invented constraints; the dedicated policy continues to handle invalid schema declarations.

Unknown displayable status/type/kind strings and all legitimate absent/null/zero/false/empty cases stay compatible. No uniqueness, timestamps monotonicity, minimum loops, maximum loops, interval syntax, task/run authorization or full wire/security guarantee is added. Arrays cannot themselves stand in for record members. Nonfinite numbers are defensive presentation failures even though real JSON transport cannot deliver them.

## Arbitrary metadata/result boundary

Do not recursively inspect private metadata, task payload or execution results. Guard top-level metadata as an object where the renderer expects it, and guard direct scalar React children only. JSON transport already excludes functions/BigInt/cycles; synthetic providers supplying such impossible wire values are outside this unit's guarantee. Document that limit rather than adding an expensive/deep generic JSON sanitizer or editing shared shortJson. Existing falsy summary display behavior and zero-heartbeat policy remain unchanged.

## Background acknowledged mutation detail

Keep synchronous lock and existing runTask POST envelope/lifecycle untouched. After a current successful acknowledgement, publish selected detail only when an optional returned payload passes validateBackgroundRun. If acknowledgement succeeds but the returned detail is malformed, retain prior valid selected detail and report fixed local wording that the task run was accepted but its detail could not be shown; continue existing snapshot/history reconciliation. Do not report that the accepted action failed or automatically replay it. If result.ok=false, preserve existing refusal semantics. A missing optional payload is not itself a failed acknowledgement, because current mutation fixtures and API behavior may omit it.

This brief validates rendered shape, not task-id correspondence or authorizing response identity; do not quietly change action routing/query policy. Any extra identity requirement needs separate supervisor assessment. No raw exception/response text is introduced by the new validation failure.

## Tests-first sequence after explicit release

1. New actual-view integration file sets synthetic API/visibility fixtures and exercises malformed successful initial snapshots: Compute null node, non-array domains/capabilities, bad command.kind/null command or lease; Background null task/fake scheduler; Production null target/run/non-array executions/null execution. Observe original render failures before wiring guards, without external calls.
2. Pure combined guard suite rejects those unsafe shapes plus direct object-valued React children and nonfinite rendered numbers. Accept both complete typed snapshots and minimal current compatibility fixtures. Cases include undefined/null only where legal,0/false/empty arrays/custom strings, missing unrendered fields and scalar Production execution.result. Invalid/unsupported parameterSchema is accepted by snapshot guard and remains the parameter policy's responsibility.
3. Actual views prove malformed initial success becomes recoverable unavailable/freshness feedback rather than false empty success. Malformed same-owner refresh retains confirmed selection/detail/drafts, then corrected manual Retry recovers. Retain existing polling/backoff/visibility behavior; no new reads per edit or automatic POSTs.
4. Background malformed history read retains prior confirmed page and current query scope; malformed acknowledged run payload cannot crash detail, retains accepted-action feedback and does not trigger a write replay. Absent payload and fulfilled refusal continue existing semantics.
5. Run exact new suites plus unchanged Background/Compute/Production freshness, selection, operations and parameter tests through heavy. Root owns any global source-contract location reconciliation. Use a TEMP scoped config extending actual web config with incremental:false only; no compiler/assertion/baseline relaxation. Freeze all exact paths and return actual observed results for root review.

## Current checkpoint

Planning complete; all product/test source remains held until explicit release after eighth gates. No broad/live/browser/provider/panel commands, protected reads, shared-document edits, commits or pushes ran. Expected integration is validator import/replacement plus the narrowly owned Background returned-detail guard; no helper/API/backend/styles/protocol/lock/parameter/polling changes.

## Released implementation progress

- Supervisor explicitly released exact12paths after eighth gates333files2342tests/types/build17pages passed. Added7operational-payload source files, combined owning guard test and actual-view recovery test, and integrated guard imports into the exact3views. Existing test/source contracts remain untouched; root owns any global source-location reconciliation.
- Tests-first actual views, enclosed in a real render error boundary, reproduced9/9 malformed initial success defects (native1/2.56s). Cases cover null Compute nodes/leases, bad capabilities/command.kind, null Background task/fake scheduler, null Production target/run/execution. Five other authored cases were excluded by the reproduction name filter, not authored skips. Original source threw expected null-member/method errors or displayed false ready state for fake scheduler.
- Presentation predicates validate only required rendered records/arrays/scalars. Preserve undefined/null where compatible, zero/false/empty collections, unknown displayable status/type/kind and scalar Production execution.result; no arbitrary metadata/results traversal. A synthetic metadata getter regression confirms validation does not inspect private values. Dedicated parameterSchema policy remains authoritative.
- Background accepted malformed returned detail receives fixed accepted/detail-unavailable status through its existing StatusText acknowledgement channel; it is not selected, so no detail crash or automatic write replay. Current valid prior detail is retained. Omitted/null optional result payload stays compatible. Existing request/lock/query/reconciliation logic and all other statuses remain intact.
- First post-change run35pass/3fail native1/3.15s: new Retry tests guessed a nonexistent Refresh now label. Corrected tests to invoke the actual existing per-view Refresh controls; no product/button/policy change to satisfy the tests.
- Final focused8files114tests passed native0/4.33s: guards51, new actual-view recovery14, unchanged Background freshness10/Compute freshness4/Production freshness10/Compute selection4/Production operations7/parameter recovery14. No skips or modified existing assertions. Tests certify initial malformed recovery, retained read/history state, corrected manual recovery and accepted malformed run-detail handling.
- Strict scoped typecheck running against TEMP config extending actual apps/web/tsconfig.json; incremental:false only. No compiler/config/baseline relaxation. Exact source is otherwise frozen for supervisor review.
- Final strict scoped check44049 passed native0. Scoped whitespace diff check passed native0; exact12source/test paths are frozen for root's independent verification. Root owns authored architecture/index updates and later broad gates. No remaining worker process or pending validation.
- No broad/live/browser/provider/panel gate, actual payload inspection, backend/API/protocol/style/shared-hook/lock/parameter/polling change, shared-document edit, commit or push ran. These are presentation guards, not full wire/security/authorization validation or impossible non-JSON-result sanitization.
