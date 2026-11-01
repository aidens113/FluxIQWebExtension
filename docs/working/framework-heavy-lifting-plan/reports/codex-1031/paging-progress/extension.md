# Extension semantic paging producer — t839

Outcome: Done for the final worker-owned observer/provenance partition. Source and report frozen after the authorized accessor correction; root owns integration and final acceptance.

## Original source diagnosis

- `page-advance/load-more.ts` stops its `watchIgnoredPress` at the first section mutation and refuses its existing extra press after any signal. A status-only spinner therefore suppresses recovery without establishing semantic row growth.
- `ignored-press/page-press-listener.ts` already exposes continuous request-start/navigation/focus/change observation internally. An owning-barrel export can reuse it without changing generic click policy.
- `ignored-press/settled-look.ts` already observes exact origin section state, reachable shadow roots and document changes, retaining request/navigation/focus observation while excluding only declared notice regions. It can prove `true` / `announced` when state matches, but may settle after 250ms of quiet; it does not itself establish that no deferred callback remains pending.
- `ignored-press/request-start-mark.ts` and `page-world/request-starts.ts` report requests begun since a physical press, including starts before their responses. They do not report pending deferred work. A future delayed request cannot safely be called absent merely because the observation window expired.
- `appending-control.ts` intentionally accepts an arbitrary authored control outside row items for its first press. Additional recovery must distinguish that choice from the actual loader returned by current list detection, and rebind by the original row/list identity.
- `PageMoveOptions` carries timeout, document-resume mark and host callbacks. `PageMoveMark` carries only movement kind/refusal counts, and the background continuation token is fresh per transport command. No stable authenticated cross-Host-attempt origin identity is currently available here. Keying a pending checkpoint by a selector alone could join distinct operations and is unsuitable.
- Domain acceptance worker measured that `OUTPUT_NOT_OBSERVED` plus canonical `effect: "unacted"` still stops at Core's post-act verification gate. A different existing no-effect code may be required; no Core or Domain source was changed by this worker.

## Approved implementation basis

Keep the authored first-press behavior, while authorizing recovery only for an actually detected current loader, same document/list origin checkpoint, no pending request/deferred work or other possible effect, and a still-actionable uncovered non-submit control. Keep observers active through semantic settlement and settle already-landed progress without another physical press. Use private browser-local identity/proof storage so copied or model-authored data cannot grant a retry. Request lead approval before extending the page-world observation query or adding cross-attempt origin metadata. Preserve generic click and arbitrary/lasting control safety.

## Implemented worker-owned observation

Added the four-event internal work query, supported causal tracker, synchronous click/assigned-handler hooks, scheduling hooks and content mark reader. Private continuation identities bind an actual detected non-form loader to its current document/list/origin records; copied/stale bindings, changed documents, arbitrary authored controls and placeholder-only growth refuse provenance. Supported nested timers/microtasks/site-registered Promise reactions retain ownership until completion. Visible async/await/generator/dynamic/native/uninspectable callbacks and returned Promise/thenable results remain unknown. No settlement observer is attached to returned Promises, preserving the original Promise and native unhandled rejection behavior.

Registered handler wrappers preserve native capture/removal identity with one stable wrapper per callback and let the native implementation alone read options. Event-name coercion occurs once; nullish listeners remain no-ops. Dynamic `handleEvent` lookup occurs inside the causal frame. Invalid microtask callbacks preserve synchronous TypeError, and noncallable Promise reaction arguments preserve native no-op semantics. The same bounded source gate covers actual scheduled callbacks.

Request health is separate from legacy mark/since behavior: fetch/XHR baseline observation is required; partial, replaced or late-supplied API slots refuse positive health. The local health method is optional for compatibility, and new positive paging settlement requires an explicit healthy result. Unsupported message/worker/service-worker sends, IndexedDB/storage, scheduler entry points and later-event registrations taint marks where intercepted.

The page-world channel is observation in mutable page code, not authentication against a hostile site. Opaque synchronous helpers can hide native async work beyond the visible callback gate; this approved practical limit is documented rather than called a universal no-future-JS guarantee. Model/copied data cannot manufacture the private content continuation/proof identity. Positive settlement additionally requires exact origin restoration outside declared status regions and no other observed effect.

## Canonical seam and final partition

Lead corrected the original brief: `OUTPUT_NOT_OBSERVED` plus unacted still stops at Core's verification gate. Established no-pagination-effect uses existing `NO_EFFECT` (execution/unacted/certainNoEffect); unproven cases remain protected. No Core, Domain, public action schema, generic click retry policy or cross-command retry-group token was changed by this worker.

Worker retains `shared/{press-work-event,request-start-event}.ts`; `page-world/{index,request-starts}.ts`; `page-world/press-work/{tracker,handlers,scheduling,index}.ts` and direct tests; `content/action-runtime/ignored-press/{work-mark,request-start-mark,index}.ts` and direct tests; `page-advance/loader-progress/continuation.ts` and direct tests. Lead explicitly expanded/froze those paths. The new work-mark source was renamed with approval to avoid a three-file prefix group; no preexisting file moved.

The worker initially authored settlement/private fault/outcome transfer and action receipt consumption, then transferred exact ownership of `load-more.ts`, `loader-progress/settlement.ts`, `move-page.ts`, `actions/next-page.ts`, integration barrels and integration tests to root before root wired the producer. Host/Core owns first-plus-three counted attempts; there is no new internal click ladder. Root reports its own integration validation separately; worker has not independently verified it.

## Observed validation

```powershell
$env:EXTENSION_TEST_BUILD_LABEL = 't839-paging-progress'; pnpm.cmd --filter @fluxiq-web-extension/extension exec node scripts/test-extension.mjs page-world/press-work/tests page-world/tests/request-starts.test content/extraction/page-advance/loader-progress/tests/continuation.test content/action-runtime/ignored-press/tests/request-start-mark.test content/action-runtime/ignored-press/tests/press-work-mark.test | Select-Object -Last 15
```

Observed exit 0: 25 tests, 25 pass, 0 fail/cancelled/skipped, `duration_ms 645.5518`; wall 1.726 seconds. A child-process regression proves exactly one unhandled rejection from the exact original Promise, with no observer-created rejection. Node's no-op undefined-listener warning is expected in its compatibility regression. Earlier bounded runs passed 3 provenance, 6 initial observer, then 18 and 22 expanded cases. Reviewer findings were corrected before this run, with no baseline, suppression or new double-cast.

Not verified by worker: package types/builds, structure audit, actual browser/page-world transport, final producer integration, Host retry integration, full suites, paid/provider calls or accepted Flow. Root owns these checks; no repository-wide audit ran against root's concurrent edits. No worker Git mutation, browser/provider call, Lab pin change or shared Core edit occurred. Normal unit scratch output only.

## Final accessor-safety correction and verification

Reviewer found `covered()` could execute a page-defined `onclick` getter while deciding coverage, outside causal ownership. The authorized fix now resolves property descriptors without invoking custom accessors, permits only canonical handler descriptors captured at install, and calls their captured native getter directly. The onclick attribute is read through captured Element prototype access too. Own/inherited custom accessors refuse coverage without running.

Related health checks formerly read slots dynamically, allowing an accessor returning the saved hook to execute during a health query and appear unchanged. They now require an own data descriptor with the exact installed value, including request constructor identity checks, without evaluating replacement accessors. Direct regressions assert unknown/false health with zero getter calls and no scheduled task. These edits began only after root announced its frozen-tree checks had finished and authorized the correction.

The exact owning command above, after this correction and the filename/barrel/import update, returned exit 0: `# tests 29`, `# pass 29`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# duration_ms 426.4749`; wall 1.397 seconds. This is the final worker test result. Root's earlier browser/affected-suite success is separate and predates this accessor correction; root owns any fresh acceptance required for the final source.

Lead-requested audit formatting separated 47 packed statement boundaries in 13 owned files using TypeScript statement-list positions, without changing behavior. A focused invocation of `scripts/structure-audit/rules/statement-packing.mjs` over those exact frozen owned files returned exit 0, `ownedFiles: 13`, `statementPackingFindings: 0`, `findings: []`. No baseline or suppression changed; the full structure audit remains lead-owned.
