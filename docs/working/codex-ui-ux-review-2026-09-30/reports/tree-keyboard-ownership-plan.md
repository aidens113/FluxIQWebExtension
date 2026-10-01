# Hierarchy keyboard event ownership plan

Status: Complete
Owner: runtime_contracts
Date: 2026-10-01

## Written bounded brief and exact reads

Supervisor released READ-ONLY follow-up to the navigation audit's deferred tree finding. Locate actual keyboard helper, TreeRows, ProjectTree and nearest original keyboard tests; maximum four files. Determine actual native Add Flow/button Enter/Space, handled events, IME/modifiers and target filters from source. Own only this report; settings exact2 and floating exact5 remain frozen. No source/test/check/broad/live/private/backend/shared document or commit activity.

Exactly four paired Core files read:
- apps/web/src/features/automation-studio/hierarchy/keyboard.ts
- apps/web/src/features/automation-studio/hierarchy/components/TreeRows.tsx
- apps/web/src/features/automation-studio/hierarchy/components/ProjectTree.tsx
- apps/web/src/features/automation-studio/hierarchy/tests/interaction-contracts.test.ts (actual direct keyboard helper assertions)

No controller/command backend, Menu implementation, stores, runtime or private state read. Command claims below stop at actual called local functions; request/persistence side effects beyond those calls are not inferred.

## Confirmed K1: tree consumes nested native activation as row activation

ProjectTree handleTreeKeyDown:184 finds target.closest(role=treeitem) and verifies tree containment, but does not require the treeitem to own the event. It forwards only event.key to automationHierarchyKeyboardAction. The helper:38 maps Enter and literal Space to open(current item). Parent handler prevents default for every non-none action; open(root-flow) is then routed to toggleFolder(root-flow), and open(non-root node) to openFromTree(row.node, preview).

RootFlowRow:283 renders an actual normal-tab-stop native Add Flow button inside root-flow. It has onClick create({parentId:null,category:flow}) and onPointerDown stopPropagation; no keydown guard or stopPropagation exists. A bubbled Enter/Space keydown from this button therefore produces open(root-flow), prevents default and calls toggleFolder(root-flow) instead of leaving native button activation untouched. Click-level preventDefault/stopPropagation occurs later and cannot undo the parent keydown action. This establishes the wrong actual local command path from source. Whether a particular browser then suppresses or additionally emits the native click was not exercised; do not report a measured missing/duplicate creation. Native Space activation is normally contingent on keyup/default behavior, making cancellation relevant, but no actual browser sequence was run.

TreeRows Add inside button similarly has only click/double-click propagation guards, so Enter/Space reaching the parent yields row openFromTree(preview) regardless of its intended commands.create action. The row-main native button and disclosure native button also lack keydown fencing; their own click operations can be displaced/combined with enclosing-row handling. A Menu sits inside each treeitem, but its actual implementation was not read; claim only that any unhandled native trigger keydown reaching the tree would be consumed as row activation, not that existing Menu definitely bubbles its event.

## Confirmed K2: handled/composition/shortcut state is discarded

Neither parent handler nor pure helper checks defaultPrevented, synthetic/native isComposing, native keyCode229, altKey, ctrlKey, metaKey or shiftKey. The pure helper's API accepts only items/currentId/key, so correct filtering belongs at the actual React event owner. An already-handled Enter/Space reaching parent still opens/toggles; modifier Enter/Space still activate the row. ArrowDown/ArrowUp still call focusRow (wrapping to first/last); Home/End focus endpoints; Right toggles a collapsed container or focuses first child; Left toggles expanded container or focuses parent. These calls ignore shortcut modifiers and composition state whenever event.key matches, including a 229 native event with a recognized synthetic key. Native event mappings during real IME use are unverified; tests should construct the exact supported React event shapes rather than assume every composing event has an activating key.

Actual target filter currently checks only closest treeitem and containment. Load-more treeitem wrappers lack data-tree-item-id; any recognized key from their native Load more button defaults currentId to root-flow. Although load-more rows are excluded from keyboardRows, that fallback means a recognized nested-button event can focus/toggle the root. This source path is confirmed; no real pagination/browser reproduction occurred.

## Compatibility and exact narrow proposed implementation

Proposed exact two Core paths: existing hierarchy/components/ProjectTree.tsx plus NEW hierarchy/components/tests/ProjectTree-keyboard-ownership.test.tsx. Keep original keyboard.ts, TreeRows.tsx, interaction-contracts.test.ts and ProjectTree.test.tsx untouched. No new public props, command/store/controller/helper/CSS/shared native primitive changes required.

Apply event-ownership guard BEFORE helper/cancellation: unhandled, plain, non-composing event from the actual roving treeitem itself; synthetic and native composition plus native229 excluded; already-prevented events and Alt/Ctrl/Meta/Shift shortcuts excluded. Prefer explicit event.target===resolved treeitem for a source-confirmed simple owner policy: roving treeitem focus emits on the treeitem; native descendant buttons/fields/editable triggers own their native behavior. If root chooses broader descendant support, it must explicitly name interactive/control/contenteditable boundaries and prove nested controls, rather than rely on an incomplete CSS selector. Do not mutate keyboard helper's existing mapping, browser click behavior or TreeRows button handlers merely to suppress bubbling.

Preserve ordinary direct treeitem Enter/Space activation, root disclosure semantics, parent/child and wrapping traversal, virtualization, focus scroll, selected state and native sidebar controls. Native root Add Flow/row Add inside/Load more/disclosure/main buttons must receive their own native events and clicks without tree preventDefault/command hijack. Ignoring modifiers protects OS/browser/application shortcuts; it does not create new tree multi-selection policy. No request-owner/lifetime change is claimed for this keyboard boundary unit.

## Tests-first plan and source release needs

Actual mounted ProjectTree with deterministic synthetic DOM currentTarget/closest/contains/frame geometry and real local keyboard helper; no mocking the helper or component. Use public callbacks and current mounted tree/render output to observe command/focus behavior. Existing controller/commands are transitive dependencies: release implementation can run them through the mounted subject, but any source reads beyond these four files require exact supervisor expansion.

Regression cases: root Add Flow native target Enter/Space never calls tree preventDefault or toggles; explicit button click still delivers actual create request. Non-root Add inside and Load more native target cannot open enclosing node or fall back to root; native click remains intact. Plain direct treeitem Enter/Space still produce existing root/non-root behavior; direct Arrow/Home/End/Left/Right preserve mappings and focus geometry. Already-prevented event no additional work. Synthetic composition, native composition and native229 no work. Each modifier on an otherwise recognized activation/navigation key no work. Foreign/non-tree target no work. Inner icon/span inside native button must remain excluded too. Count real public requestAction/openView callbacks and changed render disclosure, not only stub-helper calls. Avoid pretending manually invoking click proves browser synthesized-click timing.

For meaningful mounted tests, root must authorize narrow fixture reads of the subject's actual callback/node type contract if needed, retaining source edit partition at two paths. Narrow owning new+unchanged helper/tree suites and actual-config exact-root strict dependency diagnostics only after explicit release. Test failures must establish wrong local command/prevention before edits; preserve all existing assertions. Actual native browser Enter/Space click ordering remains outside synthetic evidence and should be stated clearly.

## Limits and return

No checks or product/test mutations performed. Source-confirmed wrong local keyboard-to-command/preventDefault paths are established from actual helper plus actual parent/native row declarations. Browser-generated click/default scheduling, Menu own behavior, native IME implementation, accessibility-tool event synthesis, retained owner/controller lifetime and backend/persistence outcomes remain unverified. Original helper owning test declares traversal/toggle/activation but no actual React event-boundary, modifiers, handled/native button or IME assertions. Supervisor reviews these findings and owns any future release/verification; settings and floating source remain frozen.
