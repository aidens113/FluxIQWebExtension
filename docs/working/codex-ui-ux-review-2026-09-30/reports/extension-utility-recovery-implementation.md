# Extension utility recovery implementation

Status: Complete — Utility fixes independently verified and all extension gates passed
Owner: Codex supervisor
Date: 2026-10-01

## Open FluxIQ

Original targeted component regressions: 2 failed/2 passed, native1,168.8673ms. Confirmed stale notice installed after an already observed address change and duplicate direct handler activation while acknowledgement pending. Defensive rejected request test was excluded until catch existed because production PanelStore explicitly never throws.

The utility now holds a synchronous pending lock, releases it in finally and only installs failure feedback when the initiating address still matches the latest observed address. Same-address refusals retain original notice/detail/retry behavior. Unexpected exception content is never shown. Labels/icon/style/runtime message remain unchanged; no focus, transport, status or caller changes.

Corrected owning suite: 5/5 passed, native0,143.6335ms through heavy-wrapped esbuild plus node --test. Strict scoped typing extends the actual extension test configuration: two roots, native0, no diagnostics. Broader extension gates wait for the related report-control partition. No browser/provider/panel validation.

## Remaining utility work

Problem report request/file/clipboard recovery is implemented below. Activity-feed out-of-order completion findings are source-confirmed in the frozen audit and assigned to the exact two-path worker brief. Preserve background redaction ownership and never inspect actual diagnostics.

## Problem report implementation

Original selected owning component tests: 2 failed/3 passed, native1,130.5643ms. Confirmed button unlocked while clipboard acknowledgement pending and prior download remained visible during a new request. Missing browser API tests were introduced after defensive catches to avoid original unhandled rejections; production PanelStore itself never throws.

The section holds a synchronous lock across request, file preparation and copying, hides prior download during a new request and releases in finally. Browser delivery methods fail independently: clipboard failure retains the current download; download failure still attempts copying; failure of both displays fixed retry feedback. Replacing a report revokes its previous owned URL with documented best-effort cleanup. Background report schema/redaction/message, pure outcome helper and existing labels remain unchanged; no lifecycle or caller API was introduced.

Corrected component suite9/9/native0/149.9905ms. Combined actual-config scoped Open/report typing: four roots, native0/no diagnostics. Activity feed now has its own exact two-path worker release and report; its source remains independently owned. Broader extension gates follow that worker freeze. Synthetic reports only; no actual diagnostics, browser/provider/panel activity or merge/push.

## Supervisor integrated verification

Activity worker froze exact source/test paths after25 owning tests and strict scoped typing; own report preserves original3 new failures and existing9 pass. Supervisor reviewed lifecycle/read-generation/observation predicates and operation-owned finally, then independently bundled four suites: Activity25, Open5, report9 and unchanged pure plan2. All41 passed/native0/604.5906ms. Utility source now frozen for full extension gates. No actual browser/activity/report payloads inspected; background schema/redaction ownership preserved.

Final supervisor gates: full28915 native0,1821tests/113849.9263ms; actual-config extension typing5771 native0/51888ms; production18201 native0,22files eachChrome/Firefox/e2e/12269ms; structure37957 native0,136warnings119baseline. No live browser validation. Complete coherent utility unit, local checkpoint follows; no merge/push.
