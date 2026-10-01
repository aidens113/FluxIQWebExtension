# Core Tree event ownership implementation

Status: Complete - exact source/test frozen; root verification pending
Owner: recording_controls
Date: 2026-10-01

## Written brief

- Read parent Current State and your frozen core-collection-controls-audit.md. Root read actual Tree.tsx and accepts C1; generic Tree is separate from the other worker's hierarchy ProjectTree. No broad Core gates are active; extension remains frozen for root gates.
- Exact two Core paths RELEASED: apps/web/src/features/programs/components/data/Tree.tsx and NEW data/tests/Tree-event-ownership.test.tsx. Own this report only additionally. Read direct data/resolveTreeFocusId.ts and unchanged programs/tests/component-contracts.test.tsx for fixture/contracts; do not edit them or any other helper/store/shared source.
- Accepted keyboard owner: event.target equals receiving treeitem/currentTarget, unhandled/plain/non-composing, native229/modifiers excluded BEFORE action or cancellation. Native nested actions/toggles keep event ownership. onFocus updates roving ID only for that direct item's focus, excluding nested child and action-control events. No stopPropagation addition.
- Preserve public API/direct item arrows/Home/End/parent-child expansion/Enter/Space, disabled selection-only semantics, click nearest-item guard, stable selection/expanded IDs/ref handling and controlled behavior. No rAF/owner/caller/backend/group-ID scope expansion.
- Tests FIRST actual mounted Tree with nested child/ancestor and current host refs. Explicitly deliver a single typed target event through child/ancestor handlers to reproduce bubbling if renderer has no native propagation. Label this simulated React event propagation honestly; no real browser native-click/assistive-technology claim. Use actual public callbacks and focus nodes, no copied production logic.
- Regressions: nested child Enter/Space select once without ancestor; disabled child never selects enabled parent; arrows/expansion schedule only intended current target; child focus leaves its row roving, action-control focus/key leaves tree ownership intact; handled/composition/native229/all modifier keys unconsumed. Preserve ordinary direct/pointer behavior and native action click callback as separately exercised control behavior.
- Run heavy NEW suite plus unchanged programs/tests/component-contracts.test.tsx. Actual-config strict two roots including actual declaration roots and ALL dependency/config diagnostics; whitespace/module budgets. No original assertion/harness/compiler/baseline/timeout relaxation.
- Record baseline and all fixture corrections before product fix, final results/limits progressively; freeze source/test/report for root independent review. No commits/shared docs/broad/live/browser/Lab/provider/panel/private/protected runtime/storage or Claude integration actions.

## Progress

Read direct helper and unchanged component-contract suite. Added NEW actual mounted react-test-renderer owning suite with explicit simulated bubbling through child/ancestor handlers and host refs. Baseline heavy suite is active (session 32911); Tree product remains unchanged. The fixture separately invokes existing action/toggle click callbacks, which is not native keyboard-generated click validation. Existing source/test helpers remain unchanged.

Baseline session 32911 CLOSED native 1: NEW suite 21 failed / 1 passed (22), tests 179 ms, total duration 2.28 s. No fixture correction was needed before product edit. Actual mounted simulated child/ancestor propagation reproduces callback, focus, nested-control and handled/composition/modifier leaks. Applied only Tree keyboard early-return origin/key guards and direct-focus origin check; no propagation stop or public API/helper changes. Final owning + unchanged contracts and actual-config strict checks now dispatched.

First final observed 42/42 (NEW22+unchanged20), tests397ms/total7.02s, but outer PowerShell native-stderr adaptation returned1 without child exit marker; no native0 claim. Explicit exit capture repeat3030 active on unchanged bytes. Strict7451 CLOSED with exactly1 test-only TS18046: createNodeMock node.props unknown. Product not implicated. Pending fixture type assertion will be recorded and applied after existing repeat closes, without assertion/compiler/harness relaxation; rerun final+strict afterward.

Explicit repeat3030 CLOSED:42/42, tests399ms/total17.14s; Native Vitest exit0 and Native heavy exit0 observed. After closure added only an exact JSX fixture children prop-shape assertion at createNodeMock; all22 test cases/assertions and product unchanged. This corrects TS18046 without weakening checks. Final paired/strict checks reissued for these corrected test bytes with explicit native exit capture.

## Final freeze / resume handoff

User wind-down relayed by root: finish observing existing42680 only, then freeze; no new source/tasks/checks. Existing corrected paired42680 CLOSED with native Vitest0 and native heavy0: NEW22 + unchanged component-contracts20 =42/42; tests480ms, total7.05s. Corrected strict13770 CLOSED native heavy0: exact2 roots, actual2 declaration roots, zero config/program/dependency diagnostics. All owned sessions are closed.

Frozen exact Core paths:
- apps/web/src/features/programs/components/data/Tree.tsx
- apps/web/src/features/programs/components/data/tests/Tree-event-ownership.test.tsx

Product diff: four inserted lines and one changed focus handler;119 lines total. NEW test100 lines. Earlier exact-path whitespace check passed before the final fixture-only type annotation; no subsequent behavioral/source change. Direct resolveTreeFocusId and existing component-contract source/tests were not edited. No public API, propagation stop, rAF ownership, caller, group-ID, backend or protected scope change.

Original product baseline observed21 failures/1 pass across22 NEW cases; fixture required no behavior correction. The later single TS18046 correction is explicitly only the NEW fixture's precise node.props JSX shape assertion; test expectations unchanged. Final checks used actual web configuration and all dependency diagnostics; no compiler/assertion/config/baseline/timeout relaxation. External TEMP focused/types harnesses add only exit observation; no tracked harness.

Evidence limits: mounted react-test-renderer, explicitly simulated React key/focus bubbling and direct callback/ref checks. Separate action/toggle click callback checks do not prove native keyboard-generated clicks; no browser, assistive technology, broad Core/extension gate, private state or provider operation occurred. Root owns independent review, checkpoint and any broader/resume work. No commit/push performed.

Read-only core-state-panels-ui-audit.md is separately Complete/frozen with two held proposals. Earlier preview audits stay Complete/frozen. No further work initiated after wind-down.
