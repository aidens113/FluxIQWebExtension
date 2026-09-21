# W2 Node-Library Gap Live Audit

Status: Complete; one provisional web-node gap ranked for defer, and no build-now node justified
Updated: 2026-09-20
Owner: `w2-node-library-gap-live`

## Result

The five assigned t027 live reports do not justify adding a purpose-built node
now. Four journeys explicitly identify their observed gap as UI, runtime, or
test-harness behavior, and the reconnect journey passed without a gap. One
bounded read-only web capability remains a credible catalog candidate:
enumerating actionable elements by semantic role/name/label and returning
opaque candidate identities. It is ranked below, but deferred because the
repair-result journey says it did not prove that this gap caused its terminal
failure, and the unified-progress journey does not prove that this observation
would have changed the provider decision.

This audit compared the candidate with the downstream web output catalog and
Core built-ins. It rejects additions already covered by `web.dom.extract_list`,
`web.dom.capture_snapshot`, `web.dom.extract`, `web.dom.assert`, wait/action
nodes, Core list/object transforms, or the newly registered privileged
`web.dom.run_javascript` escape hatch.

## Ranked candidate

### 1. Query actionable elements by semantic identity — **Defer**

- **Repeated live evidence:** The repair-result lane observed semantic target
  drift and reported that repair currently infers a replacement selector from
  general evidence. Separately, the unified-progress lane reproduced a bounded
  evidence loop that inspected the page, received
  `web.action.rejected.no_repeating_structure`, then terminated for repeated
  evidence without progress. Together they show two creation/repair paths
  needing a narrower deterministic observation than another broad inspection.
  They do **not** prove this proposed node would have repaired either run.
- **Existing-node overlap:** `web.dom.capture_snapshot` exposes broad structured
  page evidence; `web.dom.extract` reads a known target; `web.dom.extract_list`
  reads an already-described repeating structure; assert/wait/click/type/select
  consume known targets. Core's `filter-list` and `map-object` can transform a
  returned list but cannot observe the DOM. None enumerates action candidates
  by semantic role/name/label. `web.dom.run_javascript` could perform the query,
  but using privileged source for this recurring read-only behavior would
  defeat the purpose-built-node preference.
- **Owning repository:** downstream web-automation repository. DOM discovery,
  browser execution, and opaque web target identity are domain/extension
  responsibilities, not generic Core built-ins. Core should only consume the
  registered importer definition and its bounded result.
- **Smallest contract:** a safe, read-only output such as
  `web.dom.query_actionables`; input is an optional bounded filter
  (`roles`, semantic name/label match, optional scope target, `maxResults`), and
  output is a bounded list of opaque candidate identities with allowlisted
  semantic metadata (role, accessible name/label, and actionable state). It
  must not execute an action or return arbitrary DOM/HTML. Creation and repair
  must use the same result shape.
- **Recommendation:** defer until the durable patch-failure code is visible and
  a second controlled creation/repair run proves that general snapshot evidence
  is insufficient while semantic candidates would be consumed. If that proof
  lands, build this before allowing the same behavior to recur through
  JavaScript.

## Rejected node-shaped interpretations

| Observation | Classification | Why no node |
| --- | --- | --- |
| Extraction result appears only after Runtime Debug reload/reopen | Panel UI state-synchronization defect | The picker compiled one `web.dom.extract_list`, playback persisted all rows, and the oracle passed. Refresh/focus must consume terminal run mutation; it is not executable Flow vocabulary. |
| Repair ended after two provider calls with no proposal or durable categorical patch result | Core recovery/result-projection defect | The report identifies annotation, recovery-stage classification, and allowlisted API projection seams. A browser node cannot recover a lost/misclassified provider result. |
| Every action paid an unconditional readiness delay | Extension runtime defect | The live A/B reused the existing `web.dom.capture_snapshot` readiness proof and improved latency while preserving the oracle. A second snapshot/readiness node would duplicate the catalog and expose scheduling internals. |
| Rebuilt MV3 bundle silently reused a prior service worker | Test-harness defect | Fresh profiles or explicit extension reload/build-identity checks belong to live-test control, not Flow execution. |
| Reconnect and saved-Flow reuse | No gap | The exact saved Flow and graph reconnected and replayed 4/4 actions with zero LLM activity. |
| Repeating-structure discovery node | Duplicate / unproved | The successful extraction lane already used picker discovery plus `web.dom.extract_list` and explicitly found no node gap. The unified lane already received a categorical no-structure answer; another Flow node for the same query would not address its repeated-decision defect. |
| Provider evidence batching or “try a different observation” node | Orchestration defect | The unified-progress counts and terminal category were unchanged after guidance. Batch/decision policy belongs in Core authoring orchestration, not a user-visible executable node. |

## Catalog coverage checked

- Downstream web outputs: navigate; click/type/clear/select/scroll/keypress;
  selector/text waits; extract/snapshot/check/assert/extract-list;
  upload/dialog; browser tab/download; and privileged reviewed JavaScript.
- Core built-ins: control flow, policy/recovery, routines/approval, logic,
  arithmetic/random, variables/constants/object/list transforms, record writes,
  database operations, and timing/retry/debounce.

The semantic actionable-element query is not a renamed duplicate in either
registry. No other missing reusable behavior met the brief's live-evidence
threshold.

## Validation and scope

- Read only the assigned t027 extraction-exit, panel repair-result boundary,
  runtime command-latency trace, reconnect/reuse, and panel unified-progress
  reports, plus the downstream output definitions/action catalog and Core
  built-in registry.
- No provider call, browser run, product-source edit, test, build, commit, or
  push was performed.
- Only this worker report was authored.
