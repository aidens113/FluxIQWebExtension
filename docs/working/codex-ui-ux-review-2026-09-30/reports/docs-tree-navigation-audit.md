# Docs tree navigation audit

Status: Complete — read-only, implementation requires release after Docs freeze
Owner: deployment_docs_audit worker
Date: 2026-10-01

## Written brief

- Deployment implementation stays frozen. Read only Core documentation tree/virtualization modules and owning tests under apps/web/src/features/programs; discover exact paths with rg. Docs recovery worker owns docs.tsx and documentation-workspace; do not edit or broadly read those in-flight files.
- Inspect previously identified C6: roving focus reset to selected path on every focusedPath change, folder collapse resets when root changes, and sibling scans per row. Establish keyboard expectations from actual accessibility patterns and tests; distinguish confirmed behavior from performance hypotheses.
- Write progressively here: exact source evidence, bounded proposed file partition, behavior-preserving design and meaningful deferred/current-focus tests. No implementation release yet.
- No shared docs, source edits, protected runtime/storage/conversations/context-packet reads, global checks, browser/provider/panel activity, commits or pushes. Read Current State of parent only for coordination. Return prioritized findings and uncertainties.

## Inspection and validation limits

Read parent Current State, this brief, the exact VirtualDocsTree/flatten/default-expansion/merge sections of in-flight docs.tsx only, documentation tree definitions/build/sort/collapse portions of shared.tsx, and unchanged owning docs.test.ts. Discovered no separate tree module. Did not broadly read the Docs request implementation or change the Docs worker's files. No tests, typecheck, build, browser or other execution gates ran.

The owning tests verify helper outline generation, tree source ordering, flattening1,250 pages and source-string presence. They do not execute keyboard/focus/scroll/deferred-frame behavior. Findings below are current source/data-flow evidence, not certified browser or assistive-technology outcomes.

## Keyboard expectations

Current tree deliberately uses separate selection and focus: arrows change focusedPath without calling onSelect; file-button activation selects a document. Preserve that model. The official [WAI-ARIA APG tree-view pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) distinguishes DOM focus from selection, describes arrow/Home/End navigation without unrelated selection changes, and calls for explicit hierarchy position attributes when virtualized nodes are omitted. Existing aria-level/posinset/setsize and nonselectable folder states should survive a fix. Type-ahead is recommended rather than a mandatory prerequisite for this recovery batch.

## Prioritized source-confirmed findings

### T1: Keyboard exploration resets its roving stop to the selected page

Current docs.tsx:147-154 finds activePath in flattened rows. The effect depends on focusedPath and always sets focusedPath=activePath when activePath exists. onFocus at225 and focusRow at173 set another target, which triggers that effect and resets its tabIndex to-1 on the next render while the selected page becomes tabIndex0. This contradicts this tree's explicit separate-focus navigation model. Physical DOM focus may still remain on the explored row; the source defect is incorrect roving state and re-entry, not a claim that every Arrow key visibly jumps focus.

Fix only reconciles focus when the target disappears or an explicit external-selection change warrants selected-page entry; passive re-renders and onFocus must not continually retarget it. When a descendant disappears on folder collapse, prefer its nearest visible ancestor rather than arbitrary first row. Do not select/reload a document merely to move keyboard focus.

### T2: Virtualization can render no keyboard entry point

Rows are sliced by scrollTop/viewportHeight (165-167); tabIndex0 is granted only to focusedPath (229), while the tree container has no tabIndex. Selecting a page outside the visible slice, then scrolling so its row unmounts, leaves all mounted rows tabIndex-1. This is a direct prop/render result. A related sequence is initial selection far below the first viewport: activePath exists in all flattened rows and becomes the roving target even though it is not mounted.

Provide exactly one usable tree entry strategy with the target mounted/visible when keyboard entry occurs. Preserve virtualization rather than mounting the full tree. Choose a coherent model: retain roving DOM focus with a bounded pinned focused row/entry fallback, or deliberately migrate to a focusable container plus active descendant. The latter changes the interaction model and requires broader accessibility verification, so a focused roving repair is preferable for this batch. Do not move actual focus merely because the user passively scrolls or metadata refreshes.

### T3: Collapsed-folder intent is lost on every root change

mergeExpandedDocsPaths at258-263 intersects old expanded paths with current nodes, then re-adds every path from defaultExpandedDocsPaths. Closing a normally expanded folder removes its path; changing source/search or refreshing metadata supplies a new root and restores that default. Temporary filtering also forgets user expansion choices for paths absent from the filtered tree.

Track explicit expand/collapse preferences independently of the filtered tree, apply defaults only for paths without an explicit choice, and reconcile display rows without clearing preferences during temporary filtering. Actual workspace/domain replacement can reset these choices because the parent owner is keyed. Distinguish metadata removal from filtered absence if memory pruning is introduced. No persisted storage or backend ownership is needed.

### T4: Deferred focus lacks current intent and root/context fencing

focusRow queues requestAnimationFrame that queries viewportRef.current by captured path and focuses any match. It does not store/cancel the frame or compare the latest intent/root revision. Multiple queued keyboard intents can focus an earlier target temporarily; replacement with an equivalent path can let old-root work focus its new counterpart. Unmount normally clears the ref, but there is no explicit deferred-work lifecycle contract. Clicking another control before the frame runs can still let queued focus reclaim it. These are possible source sequences; browser event ordering and exact visual effects were not exercised.

Guard queued focus by latest request generation, current mounted viewport/tree owner, current target membership and source-owned focus intent. Cancel/ignore superseded requests. A passive render, refresh, hidden drawer or stale scheduled callback must not steal focus from another control. Synchronously arrange the virtual slice for the intended row before executing a current focus request; current code relies on a later browser scroll event to update scrollTop after assigning DOM scrollTop.

### T5: Row shrink can temporarily produce an empty rendered slice

start is calculated solely from retained scrollTop and is not clamped to current rows length. A user deep in a long tree can apply a narrow filter or close a large folder; if start exceeds new row count, rows.slice(start,end) is empty despite available rows. Browsers may later clamp scrollTop and emit an event, but source has no immediate clamp. Treat empty-slice calculation as confirmed; duration/browser impact remains unverified. Clamp virtual range and reconcile scroll position without unsolicited focus movement.

### T6: Per-row whole-tree sibling scans are avoidable, not measured slowness

Each visible row calls rows.filter and siblings.findIndex (214/218), giving O(visible rows × flattened rows) work plus repeated arrays on every relevant render. Data size1,250 already exists in helper tests; no runtime duration was measured. Precompute parent/depth sibling position/count and path/index maps once per flattened-row change, retaining exact aria semantics and source order. No performance threshold or speedup claim until measured.

### T7: Accessibility hierarchy and recommended type-ahead are follow-ups

All flattened treeitems are direct descendants of one generic div, with no owned/nested role=group for parent-child groups. APG describes parent/child ownership through groups; explicit level/position attributes are already present. This is a structural difference requiring assistive-technology validation, not an automatic WCAG failure assertion. A future group/aria-owns design must preserve virtualized reading order and cannot be casually added as an unrelated wrapper.

No printable-character type-ahead exists. APG recommends it, particularly for larger trees; treat this as optional enhancement after focus/expansion recovery, preserving modifier and IME shortcuts. No implementation requested or released here.

## Proposed exact post-freeze implementation partition

Wait for the Docs recovery worker to freeze; there is no safe concurrent ownership of its current docs.tsx. Supervisor then releases one cohesive extraction and integration brief:

- Existing live-views/docs.tsx: replace private tree implementation with imported tree component; retain exported flattenDocumentationTree compatibility by re-exporting the owning model helper, so existing callers/tests do not break. Remove old definitions only after all consumers migrate; preserve docs outline/history/sandbox/request code.
- New programs/documentation-tree/VirtualDocumentationTree.tsx: one exported component owns rendering, keyboard, viewport and deferred focus lifecycle.
- New programs/documentation-tree/useDocumentationTree.ts: one exported hook owns explicit expansion preferences, focus intent/reconciliation and derived rows/indices/window model. Keep generic framework behavior out of this domain-owned helper.
- New programs/documentation-tree/flattenDocumentationTree.ts: one exported pure flattener retains the existing row data contract; associated type colocated or a separately released types.ts if actual structure rules require it.
- New programs/documentation-tree/index.ts barrel and tests/{VirtualDocumentationTree,useDocumentationTree,flattenDocumentationTree}.test.tsx/test.ts as subjects require.
- Existing live-views/tests/docs.test.ts: only truthful source-location assertion updates where virtualization moved; preserve original helper behavior assertions and1,250-page completeness. Root owns global source-contract reconciliation.

The exact new paths are a proposal, not released ownership. Prefer a smaller component/model split if implementation stays cohesive; avoid oversized hooks and needless wrappers. Do not introduce styles, API/backend changes, persisted preferences or broad accessibility redesign silently.

## Meaningful validation cases after release

1. A selected leaf stays selected while ArrowDown/Up and focus callbacks leave another row as the sole roving stop; no onSelect or document request occurs until activation.
2. Initial/offscreen selected leaf, manual virtual scroll and a deep-list filter still leave an intentional accessible tree entry, with mounted-row count bounded; passive changes do not call DOM focus.
3. Collapse a folder, update root with equivalent metadata, filter it out/back, then refresh: explicit collapse remains. New unknown folders receive defaults; owner replacement resets workspace preferences.
4. Focus a child then collapse/remove/filter it: reconcile to a visible ancestor or deliberate fallback, not a stale path. Root shrink clamps the viewport window and avoids a blank tree with nonempty data.
5. Queue focus A then B; flush A/B out of order: only latest B can focus. Queue A then change owner/root, unmount, hide drawer or focus another control: old request cannot reclaim focus. Use synthetic viewport/focus/RAF tests for ownership and later authorized real-browser verification for actual scheduling and keyboard behavior.
6. ArrowRight/Left/Home/End retain folder/parent semantics, Enter/native button activation selects exactly once, and modifiers/IME remain unconsumed as appropriate. Preserve aria-expanded/selected/level/position/count and source-aware duplicate-label paths.
7. Verify one derived sibling-index pass with a large deterministic tree and correct values; avoid brittle wall-clock assertions or claiming measured performance from source complexity alone.

## Return

Only this worker report changed; Deployment product remains frozen and Docs in-flight source untouched. No execution tests ran. T1/T2/T3 and virtual-range shrink are highest-priority concrete recovery work; deferred focus needs explicit ownership tests, and browser/assistive-technology behavior remains uncertified.
