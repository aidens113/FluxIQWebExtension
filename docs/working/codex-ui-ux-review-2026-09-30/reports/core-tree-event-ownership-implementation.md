# Core Tree event ownership implementation

Status: Active
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
