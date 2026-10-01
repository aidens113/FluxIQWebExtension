# Docs tree navigation implementation

Status: Complete — exact source/tests frozen for supervisor review
Owner: deployment_docs_audit worker
Date: 2026-10-01

## Written brief (planning released; product held)

- Read parent Current State and own frozen docs-tree-navigation-audit.md. Docs recovery has frozen; supervisor owns its request/status/global-contract changes.
- Prepare exact proposed Core paths: live-views/docs.tsx tree-only integration; documentation-tree/{VirtualDocumentationTree.tsx,useDocumentationTree.ts,flattenDocumentationTree.ts,index.ts}; owning tests/{VirtualDocumentationTree.test.tsx,useDocumentationTree.test.tsx,flattenDocumentationTree.test.ts}; existing live-views/tests/docs.test.ts only truthful moved-source expectations.
- Preserve flattenDocumentationTree compatibility export, row type, source-aware order, virtualization budgets, styles, outline/history/sandbox/request behavior. No access redesign, persistence or unsupported browser claims.
- Design independent selection and roving focus; intentional mounted tab entry when focused row is outside slice; collapsed choices survive equivalent/filter/root updates; shrink clamps range; focus removed row reconciles without passive focus claims.
- Deferred DOM focus must fence latest intent, current tree/lifetime, visible active owning document and current control focus. Keyboard modifiers/IME remain native; folder/parent/activation semantics preserved. Precompute sibling/position maps once per rows update, no unsupported timing claim.
- Write detailed tests-first design here. Product/tests stay held during supervisor Core gates; do not create/edit those files or run broad/live/browser/provider/panel commands.
- Supervisor explicitly releases implementation after current gates. Then synthetic component/hook/model tests first, narrow heavy/scoped, freeze. Ask before extra path. No shared docs/API/backend/styles/protected runtime/storage/conversations/context-packet/commit/push.

## Design / progress

Read latest parent Current State, written brief and frozen tree audit. No product/test files created or edited, and no execution checks ran. Exact ownership is sufficient for the proposed component/hook/flattener split; no additional path requested.

### Ownership and compatibility

- flattenDocumentationTree.ts exports the same pure function and DocsVisibleRow type (type plus its one owning function); preserve optional parentPath semantics and existing source-aware preorder. It owns no React state and performs no DOM work.
- useDocumentationTree.ts exports one focused model hook. It owns expansion preferences, selected-vs-focused state, full node ancestry/index maps, flattened rows and sibling position/count maps, and virtual-window calculation. DOM focus stays in the component. Keep derived maps in one memoized pass for each row change; use structural counts instead of fragile timing thresholds.
- VirtualDocumentationTree.tsx exports one component preserving the existing prop contract, class names, row height34, overscan6, ARIA labels and button semantics. It owns viewport measurement, scroll event integration and deferred DOM focus lifecycle. Keep the existing initial viewport fallback420 and ResizeObserver teardown.
- index.ts provides the directory barrel. docs.tsx imports the component, replaces only the private tree section, and re-exports flattenDocumentationTree and DocsVisibleRow for compatibility. No request/status/search/history/outline/sandbox changes. Existing docs.test.ts source expectations point to the actual extracted owner while retaining behavioral helper assertions.

### Expansion preference model

Store explicit folder choices independently of the currently filtered root, as path→boolean overrides. Absent override means apply shouldCollapseDocsFolder's existing default for that folder. Intersect only rendered expansion with current nodes; retain overrides for temporarily absent paths so filtering out/back does not undo collapse. Equivalent metadata roots therefore preserve intent and newly discovered folders receive existing defaults. Parent API-keyed workspace replacement unmounts this model and naturally resets choices; no storage or global cache is introduced.

Build an all-node path/parent/page map once per root, including collapsed descendants, so focused-row reconciliation and explicit selection reveal do not depend solely on currently flattened rows. On a deliberate activePageId change, reveal the selected page's ancestor chain and update its roving target without moving DOM focus. Do not repeatedly expand ancestors or retarget focus when activePageId is unchanged during passive root updates. Initial known selection can receive the same reveal treatment. Choosing arrows or focusing another row must not select a page or invoke onSelect.

### Independent roving focus and bounded mounted entry

Keep focusedPath independent of activePageId. A focused-path update never triggers unconditional assignment back to the selected page. Reconcile an unavailable path using its prior ancestor chain: closest still-visible ancestor first, then a deliberate current selected-row or first-row fallback. A passive reconciliation adjusts model/tab entry only; it never invokes element.focus.

Use a bounded pinned-roving-row strategy: render the normal virtual slice plus the single current roving row when it lies outside that slice, sorted by absolute row index and deduplicated. That row alone has tabIndex0; all others remain-1. This preserves an actual mounted entry and a focused DOM element during manual virtual scrolling, without rendering the entire tree or introducing aria-activedescendant. Native Tab entry may scroll its target into view; passive metadata/scroll changes must not invoke DOM focus. This is a proposed strategy, not browser-certified behavior.

The row count is bounded by the current viewport window, overscan and at most one pinned row. Preserve each rendered row's complete-tree aria-level/posinset/setsize rather than deriving them from the mounted slice. Empty trees mount no fabricated row; nonempty trees always retain the intentional entry row.

### Window and scroll reconciliation

Clamp the virtual start/end to current row count, including when retained scrollTop exceeds a shrunken tree's content. Derive a valid render window immediately, before any browser scroll event can repair state. Reconcile viewport.scrollTop to the valid content range in a layout effect only when needed; no focus movement accompanies passive shrink/filter/collapse. For keyboard navigation, calculate the target row index, adjust the viewport and model scroll offset synchronously, then schedule current-intent focus after the target is mounted. Do not rely solely on browser delivery of a later scroll event.

### Deferred focus ownership

Each keyboard focus request captures its source element, owning document, viewport, requested path and tree revision, plus a monotonically increasing intent generation. Queue one animation frame and cancel the prior frame. Unmount, root revision replacement, source-owned focus loss or a newer request invalidates old work.

Before focusing, verify all of: mounted component; latest intent generation; identical current viewport/root revision; requested path still present in current visible model; source and destination belong to the same connected owner document; owning document is visible and has focus; source/current activeElement still owns the keyboard interaction (or is the exact current tree-controlled focus descendant); target is connected, visible and not inside hidden/inert content. A new request from another tree row can supersede the old one; a user moving to a filter, other control or hidden drawer cannot be pulled back by a retained frame. If the source was unmounted due to the request's own legitimate window adjustment, the pinning strategy should keep it present until the current request completes; do not guess that body focus authorizes reclaiming focus.

Use explicit supplied synthetic node/document properties in tests. Real browser event ordering, tab scrolling and assistive-technology outcomes remain uncertified until separately authorized. No active browser/profile/test facility or panel startup is part of this unit.

### Keyboard semantics

Preserve existing Up/Down/Home/End and Left/Right parent/folder operations. Enter and Space use native button activation; no duplicate custom onKeyDown selection handler. Check modifiers and isComposing before intercepting navigation keys; preserve user/browser shortcuts. OnFocus records the actual row without loading a document. Folder activation toggles one explicit preference. Type-ahead, ARIA hierarchy/group redesign and persistent preferences are outside this recovery brief.

## Tests-first exact sequence after release

1. Before moving source, add failing behavioral cases through existing DocsLive where practical: selected-page focus versus another row's onFocus, collapse surviving equivalent metadata refresh, and selected off-window entry count. New owning component test file can temporarily import DocsLive until the extraction exists. Preserve current request fixtures and never edit supervisor request tests.
2. Copy the pure flatten contract into its owner, retain docs compatibility re-export, and run the existing1,250-page completeness/source-order assertions plus new pure ancestor and sibling-metadata expectations. No dropped nodes or changed source-aware paths.
3. Model-hook tests cover independent focus/selection, explicit collapse/filter-out/filter-back/root-equivalent updates, initial/new selected-page reveal, new-folder defaults, focused descendant removal/collapse, valid shrink windows, correct sibling positions and bounded pinned row selection. No wall-clock assertions.
4. Actual component synthetic viewport tests cover sole roving tab stop, off-window selected/pinned row, bounded mounted count, real onFocus state, Arrow/Left/Right/Home/End semantics without onSelect until activation, modifiers/IME, ResizeObserver cleanup and layout clamping. Use real component/hooks, not a mirrored implementation.
5. Deferred-frame ownership cases: A then B frames flushed out of order; root replaced with identical path; component unmounted; source moved to another control; owning document hidden/unfocused; drawer hidden/inert; missing/disconnected target. Only current keyboard intent with current owned focus can invoke focus. Passive root update, scrolling or selection synchronization must make zero focus calls.
6. Validate unchanged helper/view request tests and truthful moved source assertions through the narrow heavy-wrapped suite. Run strict scoped types extending the actual web tsconfig, with no assertion/config/baseline relaxation. Freeze exact files and report observed results for root's independent review; root owns broader checks and architecture/index updates.

## Risks and decisions requiring care during implementation

- Pinning one off-window row preserves focus/tab entry but real browser scrolling on Tab needs later authorized validation; do not claim that synthetic tests certify it.
- A newly selected hidden page can intentionally reveal ancestors, while passive refresh cannot undo an explicit collapse. Drive reveal by selection intent/ID transition, not every root identity change.
- Tree changes can make old source rows unavailable. Reconcile model state without interpreting that as permission to move actual focus elsewhere.
- Keep render-derived ancestry/index work cohesive and immutable; guard queued focus before it touches a current ref, so a stale callback cannot cancel newer work.
- Group hierarchy/type-ahead remain recorded follow-ups rather than an unrequested accessibility redesign. No additional product path is needed unless actual structure/type ownership rules demand a separate type module; obtain exact release first if so.

## Current result

Planning complete. All product/test source remains held during supervisor seventh gates. No tests, types, build, live/browser/provider/panel operation, commit, push or shared-document edit ran for this unit.

## Released implementation checkpoints

- Supervisor explicitly released exact product/test paths after seventh gates2199/types/build17pages passed. Product extraction is tree-only: Docs request/status hook, local acknowledgement and page-recovery code remain intact. Only tree imports/component/helper definitions and the unused old moveTreeFocus tree helper moved/removed.
- Tests first through actual DocsLive reproduced selected-focus override (-1 instead of0), missing off-window entry (zero instead of1), and collapse reset on a fresh equivalent metadata root (true instead offalse). Initial run2fail/1pass native1/2.30s; collapse fixture corrected to provide a new equivalent pages array, then that regression independently failed native1/2.08s. Name-filter exclusions were not authored skips.
- Added focused component/model/flattener/barrel within exact paths. Expansion overrides survive filtering/equivalent roots; independent focus reconciliation prefers prior visible ancestor; one-pass sibling positions retain complete-tree counts; window clamps and pins at most one entry row. Original flatten export/type and1,250 completeness remain compatible.
- Deferred focus uses generation, lifetime, current root/viewport, source-owned active focus, connected visible same-document source/destination, document focus/visibility and hidden/inert checks. Blur/new focus cancels pending work. Keyboard modifiers and composing events remain native. Current source remains mounted until frame completes; target pinning precedes current-intent focus, then viewport offset reconciles. No passive focus calls.
- First extracted run15pass/1fail: unchanged source-string test still expected old private name/location; those exact assertions now follow VirtualDocumentationTree/useDocumentationTree ownership while preserving virtualization, keyboard, history and helper requirements.
- Extended run37pass/1fail: one new ordinal fixture assumed p1249 was lexically last under existing source sorting; changed its subject to the actual final sorted row, retaining expected1250 ordinal/full sibling count and bounded mount assertions. No product order change or requirement weakened.
- First scoped types caught three strict typing issues: React keyboard composition property ownership, unknown test renderer props and async act callback returning a mock. Corrected actual React/native-event checks and precise synthetic test typing; real compiler options remain unchanged. Strict scoped retry running.
- Current validation commands are narrow heavy-wrapped only. No broad/live/browser/provider/panel checks, backend/API/styles changes, shared-document edit, commit or push. Browser scrolling/screen-reader behavior remains uncertified.
- Corrected narrow run17703 passed38/38 native0/9.53s across5files. Strict scoped retry14819 passed native0. Additional source-owned focus/pinned navigation cases passed41/41 native0/12.14s and strict check3666 native0.
- Final review also invalidates queued focus on same-root active-page navigation and requires its requested path still be the current roving entry. Added that regression; all exact source/tests frozen thereafter. Final targeted run42980 passed42/42 native0/11.94s: component22, model6, flattener1, unchanged request/status9 and helper/contracts4. Final strict scoped types87889 passed native0. TEMP config extends actual web tsconfig, incremental:false only; no compiler/assertion/baseline relaxation. Final whitespace diff check passed native0.
- Exact changed product paths: docs.tsx tree-only integration plus new documentation-tree/{VirtualDocumentationTree.tsx,useDocumentationTree.ts,flattenDocumentationTree.ts,index.ts}. Exact changed test paths: new documentation-tree/tests/{VirtualDocumentationTree.test.tsx,useDocumentationTree.test.tsx,flattenDocumentationTree.test.ts}; existing live-views/tests/docs.test.ts only moved-owner source assertions. Docs request/status code and tests remain unchanged.
- Integration note sent to supervisor: existing explorer hint says only visible rows are mounted, while the repaired renderer includes normal overscan plus at most one pinned off-window row. That old product hint was left untouched pending root review; root may remove/correct it. No unsupported performance or browser certification claims.
- Root independently reviews/validates this completion claim and owns architecture/index updates and subsequent broad gates. No further source improvement is authorized in this worker before review.
