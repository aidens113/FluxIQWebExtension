# Project tree keyboard ownership implementation

Status: Active
Owner: runtime_contracts
Date: 2026-10-01

## Written brief

- Read Current State of the parent review and your completed tree-keyboard-ownership-plan.md. The paired task is isolated t224; Claude integration/protected code stays untouched.
- Exact two Core paths RELEASED: apps/web/src/features/automation-studio/hierarchy/components/ProjectTree.tsx and NEW components/tests/ProjectTree-keyboard-ownership.test.tsx. Own this report only additionally. All helper/TreeRows/store/command/shared/CSS/original test paths frozen.
- Accepted event policy: only unhandled plain non-composing key events targeted at the actual roving treeitem itself reach the existing keyboard helper. Reject native/synthetic composition, native229, any modifier and defaultPrevented before action/cancellation. Nested native controls retain native event ownership; do not add stopPropagation or alter their clicks.
- Keep existing direct treeitem Enter/Space/root toggle, arrows/Home/End/parent-child/wrapping and focus/scroll/virtualization/selection behavior. No public API/helper/command changes.
- Tests FIRST actual mounted ProjectTree with typed synthetic events and honest minimal DOM focus nodes: nested root Add Flow, row Add inside/main/disclosure, Load more and editable descendants must not invoke parent action or prevent/stop; direct eligible events retain helper behavior. Cover handled/composition/native229/all modifiers and retained current state where relevant.
- Source-confirmed wrong parent command is the defect; no measured browser missing/duplicate click claim. If direct target===treeitem proves incompatible with actual native focus paths, report before choosing broader boundary.
- Run heavy NEW suite plus unchanged nearest ProjectTree and interaction-contracts suites discovered by exact names. Actual-config strict exact two roots includes all dependency diagnostics; whitespace/module budgets. No compiler/assertion/timeout/baseline/harness relaxation or speculative fixes.
- Record baseline, corrections, exact results and limitations progressively. Freeze source/test for root independent verification. No commits/shared docs/broad/live/browser/Lab/provider/panel/private data/protected backend actions.

## Released tests-first progress

Read Current State tail, completed keyboard plan and released exact two-path brief. Added actual mounted ProjectTree/real helper/control declarations fixture with native descendants, direct treeitem activation/traversal and handled/composition/native229/modifier shapes. Existing controller/store/TreeRows/private logic unedited; actual public pagination key helper imported only to construct correct source-owned page state. Synthetic target closest/contains/focus nodes explicitly do not implement browser bubbling/click generation.

Initial new owning suite heavy session70522 active, product unchanged. Guard implementation awaits observed baseline; no baseline/config/harness weakening. Prior Core deletion audit remains Complete/protected handoff, no actual fixtures or backend inspected.

New suite25cases; unchanged product tests-first70522 remains pending with buffered final output. Await result, do not bypass shared heavy admission or infer fixture/defect success. Direct control presence assertions will distinguish fixture mismatch from event-boundary failures. Temporary actual-config strict2root type script prepared; no additional checks started or product edits before red.
