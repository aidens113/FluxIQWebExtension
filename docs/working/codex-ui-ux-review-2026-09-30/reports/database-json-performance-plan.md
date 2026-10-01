# Database detail JSON performance plan

Status: Complete (source audit and bounded plan; implementation held)
Owner: senior supervisor
Date: 2026-10-01

## Findings

Root inspected exact Core live-views/database-manager.tsx, its owning recovery test and components/data/JsonViewer.tsx. Database detail renders JSON.stringify(selectedRecord.data,null,2) inside a native collapsed details element, so collapsed presentation still pays full serialization on every React render. Existing key-value cells are a separate formatted summary and must retain their behavior. No timing/heap measurement or live data inspection was performed; this is directly observable expression evaluation, not a quantified performance claim.

Shared JsonViewer serializes only while expanded, but its bounded600-item/depth10 preview intentionally truncates content. Replacing database's full raw detail with that component would remove its existing full-detail capability. A lazy full representation requires its own explicit implementation preserving that capability, or a separately authorized export/detail design. Do not silently truncate raw records.

## Proposed narrow implementation

Own exact Core database-manager.tsx and NEW live-views/tests/database-manager-json.test.tsx. Keep all original authorization/detail/recovery tests unchanged. Add record-instance-owned native details state; opening prepares the full pretty representation, closing removes it. Memoize by expanded state and confirmed data identity so unrelated renders do not repeatedly stringify the same expanded data. A new owner, expired/removed sensitive grant, pending/missing/failed detail or new confirmed record must not inherit another record's raw expansion. Retained old toggle callbacks cannot reveal foreign detail. Preserve native summary/keyboard behavior, full content, existing table/cell/navigation semantics and authenticated read ownership; no new backend/export contract.

Tests first with actual DatabaseManagerLive and synthetic API records: count only pretty serialization of the selected data, confirm zero calls while collapsed, exactly one on explicit opening, no additional calls on unrelated renders, full tail properties beyond shared preview limits, closed/new-record behavior, and retained old toggle during owner/grant replacement. Keep the real hook/read/grant behavior rather than mock the feature under test. Root must read final source and observe owning suites/scoped types; broader Core gates require both active Core workers/source freeze. Native details events and browser memory need later live validation, which is not currently authorized.

## Boundaries and next step

No product/tests changed and no commands executed for this audit. Implementation stays held while login lock/environment gates are being consolidated. This is additional UI performance backlog, not a replacement for the active recovery units. All worker slots remain assigned and Claude's checkout stays untouched.
