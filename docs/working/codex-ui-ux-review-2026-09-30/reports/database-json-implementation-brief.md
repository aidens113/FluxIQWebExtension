# Database JSON executable brief

Status: Complete — exact two implementation paths frozen for supervisor verification
Owner: runtime_contracts (preparation); deployment_docs_audit (implementation)
Date: 2026-10-01

## Written brief

- Login exact two Core paths remain frozen for root review and broad gates. Own only this report; no Core source/test mutations.
- Read parent Current State and root database-json-performance-plan.md. Inspect exact Core live-views/database-manager.tsx, directly owning database-manager-recovery/authorization tests and actual database-records hook only as needed for record-instance/authorization semantics. Shared JsonViewer is bounded; do not propose silently replacing full JSON with truncated preview.
- Prepare executable exact two-path source/test brief (database-manager.tsx + NEW live-views/tests/database-manager-json.test.tsx). Specify record/data/expanded ownership and retained toggle guards, useMemo invalidation, native details controlled/unmounted behavior and complete full JSON output. Current timer updates every1000ms regardless of grant; count pretty serialization across synthetic ticks without measuring/reading actual records.
- New actual-view fixture stays in new test. Preserve all original recovery/authorization assertions; meaningful tests reproduce collapsed repeated formatting, expanded unchanged-data redundant formatting, full tail, owner/grant/new-record masking and stale toggle. Avoid global spy effects on unrelated JSON calls: count only actual selected data +null+2 arguments.
- Return exact source algorithm, typed fixture and reproducible scoped/narrow commands, module budget and browser limitations. No tests created until root release, no broad/browser/provider/private data/commits or shared docs.

## Proposed execution

### Supervisor implementation release

Status: Active implementation. Exact two Core paths below now released; no Core broad gate is active. Root read the complete executable algorithm and accepts record/query/grant/eligibility generation, complete lazy/memoized output and native controlled details policy. Existing shared bounded JsonViewer and database-records hook remain unchanged. New actual-view tests first must reproduce eager formatting; preserve all original recovery/authorization assertions. Own this report only additionally, record exact failures/checks, then freeze. Combobox worker owns controls paths; no shared contracts/private data/live/broad/commits. Root independently verifies and runs integrated Core gates after both units freeze.

### Worker execution progress

Owner of released implementation: deployment_docs_audit. Read exact source and real hook, original owning recovery/authorization tests and direct contract types. New actual-view synthetic fixture and 14 cases written in the released owning test. First invocation found a malformed deeply nested fixture literal (zero tests); fixture corrected to typed iterative synthetic nesting. Tests-first then observed native 1, 14 failed, 3.61s: actual collapsed pre already exists and controlled disclosure toggle is absent. Sensitive fixture cases also surfaced a fixture dependency failure to resolve separately; this initial total is not claimed as 14 independent confirmed product defects. Eager collapsed serialization is directly reproduced. Source now uses record/query/grant/eligibility generation and an expanded-generation state, full lazy memoized pretty JSON, keyed native controlled details, retired toggle guards; narrow run in progress. Original suites and hooks remain unchanged. Source not yet frozen.

Post-change first run: 10 passed / 4 failed; three synthetic-window alert dispatch omissions and one async timer flush omission in the new fixture. Corrected only the fixture; new14 then passed native 0 / 5.64s. First scoped strict types found one test-only `vi.spyOn` generic constraint diagnostic; replaced explicit overload parameters with the inferred spy factory type, then strict native 0. Combined owning five suites passed 48 / 48 native 0 / 19.03s. Added three boundary regressions for store and database query replacement, and grant expiry before any render/timer cleanup. Final owning five suites: **51 / 51 passed**, native 0 / 40.36s, including new17 and all unchanged recovery9, authorization14, source-contract2 and hook9 assertions. Exact whitespace native 0; view162lines / test172lines. Final strict recheck4512 against actual web config and final17: **native 0**, all inherited strict options preserved, no dependency diagnostics. Temporary config removed. Both exact source/test paths now frozen for supervisor independent verification. Only synthetic records inspected, no browser/private data, no broad gates or commits.

Final reproducible scoped check: temporary external JSON extends absolute `apps/web/tsconfig.json`, sets `compilerOptions: { incremental: false }`, `include: []` and absolute `files` for database-manager.tsx plus tests/database-manager-json.test.tsx; run heavy `pnpm --filter @fluxiq/web exec tsc --project <temporary-config> --noEmit` from paired Core and remove temporary config afterward. Final owning command below ran from paired Core `apps/web` under heavy label `codex database JSON final owning regressions`.

Observed guarantees: zero selected-root pretty calls while collapsed; one complete pretty serialization on expansion, reuse through ticks/filter/presentation rerenders, no serialization on close and one fresh computation on reopen; full 605-item/depth12/tail data preserved. Retired record, API/actor A-B-A, grant, query and unmounted toggles cannot open a replacement; retained same envelope through rows refresh preserves expansion. No hook, shared JsonViewer, authorization policy, timers, backend, styles, other workers or original assertions changed. Test-renderer checks do not certify browser native toggle coalescing, keyboard delivery, assistive technology, heap reduction or latency savings. Root owns independent/final broad checks.

### Confirmed ownership and exact paths

Read parent Current State, root performance plan, actual view, directly owning recovery/authorization/contract tests, actual `useDatabaseRecords` hook and bounded imported type/API signatures. An initial assumed `components/live-views` path did not exist; `rg --files` located actual ownership under `features/programs`. No product/test edits or test commands occurred.

Release only these two Core paths:

1. `apps/web/src/features/programs/live-views/database-manager.tsx`.
2. NEW `apps/web/src/features/programs/live-views/tests/database-manager-json.test.tsx`.

Keep existing recovery/authorization/contract tests and `database-records` hook unchanged. No shared JsonViewer, helper, barrel, API, style, auth policy or timer change is needed. Actual view currently148lines, well below400advisory/800hard budget; anticipated additional state/memo/handler is approximately25–40lines, preserving the cohesive view owner.

`DatabaseManagerLive` already keys workspace replacement by API/currentUser.id generation and synchronously guards old owner callbacks. The hook masks selected detail by confirmed owner/query/authority/readiness/authorization/metadata-target validity; loading starts with `record:null`, successful detail owns a confirmed envelope object, failed/missing states must not receive expansion, and new envelope identity constitutes a new record instance even with the same ID. Row refresh can retain the same selected envelope when still present; that should retain its expansion and memo. Keep these policies intact.

### Exact source algorithm

Place all new hooks after the existing `selectedData` derivation and before `if (!snapshot)` so hook order is unconditional.

1. Compute `rawEligible` from a non-null confirmed `selectedRecord`, no detailLoading/detailError/detailMissing, `!sensitiveLocked`, target present and current search ready. This consumes the real hook's authorization masking rather than recreating a read path.
2. Keep a typed render-updated ref for raw detail ownership: `{ record: typeof selectedRecord; query: typeof query; authority: SensitiveGrant | null; eligible: boolean; generation: number }`. Normalize `activeGrant ?? null` before comparing it. Renew its generation whenever record envelope, query, grant object or eligibility changes. This is a synchronous local lease, not a setState during render. Same-record unchanged-data timer/filter updates do not renew it. A→null→A also renews, so neither a pending detail nor an old retained toggle can revive expansion.
3. Keep expansion state `number | null`, initially null. Define `rawExpanded = rawEligible && expandedGeneration === rawOwner.current.generation`. Old numeric state is harmless and cannot reactivate a renewed instance. Owner remount discards it entirely.
4. Derive pretty text with unconditional `useMemo(() => rawExpanded && selectedRecord ? JSON.stringify(selectedRecord.data, null, 2) : null, [rawExpanded, selectedRecord?.data])`. The full pretty representation remains complete, with no item/depth/byte bound or preview substitution. Confirmed data identity changes invalidate it; ordinary clock/filter rerenders reuse it. Closing makes the memo return null and removes the pre, releasing the retained formatted string. Reopening explicitly formats again; do not retain a record/string cache after close.
5. Render native `<details className="db-raw-record" key={rawGeneration} open={rawExpanded} onToggle={...}>` with unchanged native summary `Detailed JSON`. Render `<pre>{rawJson}</pre>` only while expanded. Key by the renewed generation so record/authorization replacement mounts a fresh native element; this prevents a queued toggle from a reused old details node opening another record. Keep the disclosure present only in the existing confirmed-detail branch.
6. The typed `onToggle(event: React.SyntheticEvent<HTMLDetailsElement>)` captures its generation and confirmed record. Before updating expansion require `current()`, `targetCurrent()`, `queryCurrent()`, ref generation and record equality, eligible current ref, no authorizationLost, and for sensitive data the captured grant's `expiresAtMs > Date.now()`. Read `event.currentTarget.open` synchronously, then set captured generation for opening or null for closing. Ignore retained old-owner/record/query/grant/unmounted handlers. Do not dispatch a request, replace native summary keyboard behavior, call preventDefault or force focus.

Native toggle can be queued/coalesced, including after controlled open changes. Current false/open equality can be treated as a state no-op; the ownership check must run before any mutation. Closing/opening events from the same current element remain ordinary disclosure actions. A replaced element's queued callback is retired even when ID/data values happen to match again. Actual browser delivery/coalescing remains a live-validation limit.

### Typed actual-view fixture

The new test owns its fixture and mocks only `useProgramApi` plus a typed Modal replacement needed to operate synthetic authorization. Do not mock the feature hook, records state, raw disclosure or serializer. Use `CurrentUser` with all required fields, `RecordEnvelope`/`DatabaseManagerSnapshotResponse` from `fluxiq/database-manager`, and `ReturnType<typeof useProgramApi>` for the API adapter. Fixture synthetic responses are `ApiResponse<unknown>`; the adapter's generic get/post return `response as ApiResponse<T>` at the mock boundary after routing known synthetic endpoints. Spy call signatures include actual payload/options so requests remain testable. Use typed deferred `ApiResponse<RecordEnvelope | null>` for held detail.

Example fixture shape (design only; no test created):

```ts
type ProgramApi = ReturnType<typeof useProgramApi>;
const user: CurrentUser = { id: "synthetic-user", displayName: "Synthetic", roleId: "test", pinConfigured: false, totpEnabled: false };
const row: RecordEnvelope = { id: "synthetic-a", kind: "public.rows", scope: {}, data: { label: "synthetic row" }, createdAtMs: 1, updatedAtMs: 2 };
const detail: RecordEnvelope = { ...row, data: syntheticFullData };
const page = { records: [row], total: 1, limit: 50, offset: 0 };
```

Use actual ReactTestRenderer/act, typed ReactTestInstance helpers and fake clock/window timers matching the existing real-hook recovery suite. `vi.spyOn(JSON, "stringify")` defaults to the real function. Count only spy calls whose first argument is an exact selected synthetic data object and whose second/third arguments are `null`/`2`; renderer snapshots, summary-cell formatting, request mocks and expectation construction must not enter the count. Compute expected full text before installing the spy or use the saved original function. Restore spies, window, fake timers, mounted renderer and any deferred jobs after each case.

### Tests-first executable cases

1. Mount actual view, await metadata/rows, inspect synthetic row, leave details collapsed. Expect no raw pre and zero selected-root pretty calls after confirmation, three1000ms clock ticks and unrelated column-filter/current-user presentation updates. Current implementation must fail this because it formats during confirmation/rerenders.
2. Invoke current details toggle with typed minimal native-event fixture `currentTarget.open=true` inside act. Expect open true, one matching pretty call and complete pre text. Advance ticks and unrelated UI renders; expect same one call and unchanged text. Current eager implementation must fail the count.
3. Use full synthetic data with a605-item array, nesting deeper than10 and final tail property; require exact pretty output and last item/deep leaf/tail visible. Preserve content beyond the shared preview limits. Full output is synthetic, never actual database records.
4. Close current disclosure; pre disappears and no new matching call occurs. Reopen; exactly one additional call. This verifies intentional discard/recompute policy rather than permanent hidden formatted content.
5. Inspect B while A is expanded with B detail deferred. Pending state has no raw pre. Resolve B; fresh details is collapsed with zero B-root pretty calls. Invoke retained A toggle and require B stays collapsed; current B toggle then formats only B once.
6. Reinspect same ID with a new confirmed envelope/data instance. Require closed fresh generation; opening formats new data. Keep same retained envelope across a successful rows refresh and require expanded memo reuse. This follows actual hook record ownership rather than comparing ID alone.
7. Replace API owner and actor ID separately with old toggle retained. Capture commit visibility through a typed wrapper layout effect; no A raw content/foreign expansion during the replacement commit, no API dispatch by stale toggle, fresh owner detail collapsed. Include A→B→A with retained first-A callback.
8. Use synthetic `secret.keys`, real authorization flow, short grant and confirmed detail. Expand, expire through real fake clock timers, expect raw removed and sensitive locked; retained old toggle does nothing. Obtain new grant and new record, require collapsed; old-grant toggle cannot open it. Exercise list/detail authorization refusal (`requiresRecheck`/403) similarly without recreating grant logic.
9. Change search/store/query and remove target from refreshed metadata while expanded; old disclosure is masked/unmounted and old callback cannot set a future record expanded. Missing/malformed/rejected detail and retry completion remain closed. Existing owning suites keep all original assertions.

Test-renderer events prove React ownership/state and serialization work counts, not native browser event delivery, keyboard handling, browser heap reduction or measured wall-clock performance. Do not claim browser certification or quantified latency savings.

### Reproducible validation and freeze

After explicit source/test release, first create only the new test fixture and run `pnpm exec vitest run src/features/programs/live-views/tests/database-manager-json.test.tsx` from Core `apps/web` through heavy, observing meaningful failures on unchanged product source. Implement exact source algorithm, then run narrow actual owning suites together:

```text
pnpm exec vitest run src/features/programs/live-views/tests/database-manager-json.test.tsx src/features/programs/live-views/tests/database-manager-recovery.test.tsx src/features/programs/live-views/tests/database-manager-authorization.test.tsx src/features/programs/live-views/tests/database-manager.test.ts src/features/programs/database-records/tests/useDatabaseRecords.test.tsx
```

All heavy invocations use `C:/Program Files/Git/bin/bash.exe C:/Users/osrs_/FluxStuff/build-slots/heavy.sh 'codex <label>' <command>`. Scope strict type checking to the two changed roots with actual web tsconfig/type declarations and report all dependency diagnostics; use an ignored TEMP script, no tracked config/injection API. Review exact diff/check budgets and freeze both paths. Supervisor owns independent verification, any shared source-contract adaptation, integration docs and full gates after both Core workers freeze. These commands were proposed during read-only preparation; actual released execution and observed outcomes are recorded above.

### Login wording check

The frozen login report already distinguishes the retained full-suite failure from the deterministic injected scenario and explicitly says the earlier full-run native cause is not established. Its source findings call pending deletion a possible mechanism, not proof; no correction is needed and its two source/test paths remain frozen. No other worker/shared report was changed.
