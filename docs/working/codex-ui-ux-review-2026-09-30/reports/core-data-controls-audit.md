# Core data controls audit

Status: Complete — bounded source audit; no product/test/check changes
Owner: deployment_docs_audit
Date: 2026-10-01

## Written brief

- Tooltip exact three paths remain frozen for root verification. Own only this downstream report. Read parent Current State; no source/test/check commands.
- Inspect exact Core apps/web/src/features/programs/components/data/{DataTable,Pagination,ListRow,List,JsonViewer}.tsx, relevant unchanged component-contracts sections and at most two actual consumer call sites needed to establish real behavior. CodeViewer is root-owned and excluded from this audit.
- Supervisor additionally releases read-only live-views/production-runner.tsx JsonViewer call sites only to establish actual string-preview contracts, without broader file/backend reads. Audit actual data navigation, keyboard/native semantics, disabled/current selection, pagination boundaries/loading/error/empty behavior and truthful JSON preview truncation. Preserve established bounded JsonViewer contract; no demand to render unlimited records in every preview. Distinguish caller responsibilities, source-confirmed active defects, dormant primitive gaps and unmeasured browser geometry.
- Return ranked concrete findings with exact independent product/test partitions and meaningful regressions. Do not propose cosmetic snapshots, undocumented rewrites or speculative performance claims. No shared docs/source/tests/checks/commits/browser/Lab/providers/panel/private data. Request precise extra read scope only if necessary; root owns later releases.

## Progress and evidence boundary

Read exact DataTable, Pagination, ListRow, List and JsonViewer; relevant shared table/pagination/list/JSON contract sections. Two actual consumers read: AutomationStudioDataInspector and RunDatasetTable. CodeViewer remains excluded and Tooltip exact paths frozen. No checks/tests/product changes occurred. Root explicitly authorized an additional production-runner JsonViewer call-site-only search; neither JsonViewer nor JsonToggle appears there. No broader production-runner/backend read occurred, and this report does not claim Production Runner uses this primitive or contains a long payload.

## Confirmed findings so far

### D1: Long-string preview truncation does not set the truncation notice flag

JsonViewer's visitor shortens a string longer than2,000 characters and adds `...[truncated]`, but does not set its `truncated` variable in that branch. InlineNotice is conditional on that flag, so a string-only truncation omits the existing bounded-preview guidance. This is directly source-confirmed for root/nested strings under a small object/array; the existing shared regression covers only many-object-property truncation. Marker text exists, so this is missing explanatory feedback, not a claim of completely silent data loss. No actual records or real long string were inspected.

Exact independent proposed unit: `components/data/JsonViewer.tsx` + NEW `components/data/tests/JsonViewer-preview.test.tsx`, no export/helper/CodeViewer/CSS/consumer changes. Tests first actual rendered preview for strings at2,000 and2,001 characters, nested string-only truncation, marker and bounded guidance together, full untruncated string preserved at the limit, and all existing item/depth/array/object notice behavior preserved. Keep collapsed serialization lazy and bounded; do not replace previews with full exports or change database full-detail capability. No performance latency claim.

### D2: DataInspector pending server read can claim no samples; rejected requests do not release loading

Actual DataInspector `refresh()` sets loading=true and awaits the API without catch/finally. A rejected Promise skips loading=false/error feedback; the refresh/cache buttons continue receiving busy=true. `clearUiCache()` has the same rejected-Promise recovery gap. This is a caller-owned request defect, not a DataTable error policy failure; source establishes the rejection sequence, not a live server reproduction.

EndpointTable always supplies `empty="No endpoint samples."` and never loading; initial empty endpointMetrics therefore renders that successful-empty wording while the initial `get-performance-metrics` call is pending. SQL uses a loading-specific empty string, but does not pass the primitive loading prop either. No server samples were examined. Refresh and clear-cache also share one unsynchronized loading Boolean, so either completion could clear another pending request if their functions overlap; retained callbacks have no local owner/lifetime/duplicate guards. Both buttons receive busy, which may suppress ordinary new clicks; no real overlapping native click sequence was reproduced. Their actual authorization/backend cache contract was not inspected, and this audit does not approve changing cache mutation behavior or retrying it automatically.

Next source-based recovery design unit, exact proposed paths: `features/automation-studio/development/DataInspector.tsx` + NEW `features/automation-studio/development/tests/DataInspector-recovery.test.tsx`; existing DataInspector.test.ts stays untouched. Before implementation, root must release bounded actual telemetry/cache imported contracts and confirm mutation authorization/acknowledgment semantics, without backend/private traversal. Test meaningful pending metadata, rejection release/local retry, previously confirmed stale samples, owner/project replacement and duplicate/overlapping control intent. Clear-cache rejection may permit a new explicit attempt; never synthesize an automatic mutation retry. Prefer scoped local request ownership over changing shared DataTable, generic API or telemetry storage. This report does not authorize source changes.

### D3: DataTable index-keyed stateful rows require caller ownership evidence

DataTable deliberately accepts optional rowKeys and otherwise keys rows by index. Actual DataInspector rows are display strings, so this audit found no migrated child-state defect there. RunDatasetTable does not supply rowKeys and renders stateful JsonToggle cells keyed only by field ID inside each row. If row content/dataset changes while row slots and the enclosing component are reused, a previously expanded cell can inherit another record's value. However actual RunDatasetTable parent replacement/keying and JsonToggle ownership are outside the two-consumer read budget; append-only row pagination can safely preserve index identity. This remains a conditional caller-lifetime risk, not a proven current dataset leak or active navigation regression.

Later read-only partition must name exact RunDatasetTable parent call sites and actual JsonToggle wrapper ownership before a fix. Do not invent row IDs from cell contents or remount all shared table rows on every render. Any implementation should belong to the actual dataset/row owner, with a meaningful expanded-cell/data-owner replacement regression, leaving generic rowKeys behavior stable.

## Other primitive conclusions

DataTable labels/caption/column scopes, caller-provided stable keys and loading-empty feedback exist. It intentionally owns no request/error state, navigation or data validation. Empty columns produce colSpan0 and populated empty rows can render blank cells; RunDatasetTable permits null schema and maps such rows to empty arrays. Actual parent readiness/recovery semantics are not inspected, so report this as a caller contract edge, not a demonstrated user-visible failure.

Pagination clamps its displayed page to pageCount and disables native navigation/size controls during loading or at boundaries. It assumes finite/nonnegative totals and positive pageSize: pageCount calculation guards size, but range arithmetic does not normalize it. Invalid pageSize0/negative/NaN can produce misleading arithmetic; no real invalid caller was established. Retained callbacks capture old props and have no lease, but backend/read ownership belongs to the caller; this audit does not justify inserting generic async ownership into an otherwise controlled paginator. Existing shared tests verify ordinary page2/25/80 range and labels only, not actual navigation/failure recovery.

List/ListRow correctly use labelled native list/listitem, a native main button with current-state description and secondary actions as siblings. `leading` is presentation-hidden, so callers must not put required executable controls there; no violating caller found within scope. They own no busy/request/disabled contract, and no active selection/activation defect was established.

JsonViewer formats only while open, but repeats its bounded traversal on each parent render. Memoizing globally by object identity would assume immutable values, which the public unknown value contract does not state; no proven redundant-render sequence/quantified savings is claimed. Its WeakSet treats repeated shared object references as circular even when non-cyclic, and Object.entries enumerates complete shallow objects before applying its150-entry cap. Those are source facts about generic in-memory values, but plain API JSON usually lacks shared references/getters, and no actual problematic consumer was inspected. Keep any later serializer correctness/performance unit separately scoped with consumer evidence; do not turn this audit into an arbitrary payload traversal or backend work.

## Return and next partition order

1. D1 is a sufficient bounded serializer feedback fix proposal regardless of actual payload content; release exact JsonViewer + new owning preview test only if root chooses it. Keep CodeViewer frozen/root-owned and preserve full database JSON separately.
2. D2 merits its own read-only DataInspector recovery brief before implementation because clear-cache is an actual mutation and imports telemetry/cache contracts. Initial pending-empty and rejection sequences are source-confirmed; root must establish exact safe recovery/ownership semantics and original test ownership first.
3. D3 and malformed schema/page arithmetic remain conditional caller-contract risks requiring the named actual parent evidence. No global remount, generic paginator mutation lease, unbounded JSON preview or speculative visual rewrite is warranted here.

Only this report changed. Source/control behavior was inspected, not executed. Existing shared assertions were read, not rerun or changed; no runtime/browser/private data inspected, no checks/broad/heavy/live/provider/panel/commits. Tooltip three paths and DB/Field/shell prior paths remain frozen. Native keyboard/event delivery, loading display and browser geometry need actual validation under a later authorized unit; this worker's source findings do not substitute for root independent verification.
