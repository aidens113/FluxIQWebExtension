# Core collection controls audit

Status: Complete - read-only audit; implementation held
Owner: recording_controls
Date: 2026-10-01

## Written brief

- READ-ONLY new bounded Core audit. Read parent Current State; paired Core is C:/Users/osrs_/FluxStuff/fxwork/t224/!FluxIQ. Keep all extension source/test frozen for root gates and Claude protected/integration ownership intact.
- Exact four source reads under apps/web/src/features/programs/components: data/Tree.tsx, data/DataTable.tsx, data/Pagination.tsx and controls/Segmented.tsx. No unrelated helper/store/controller/backend/shared styles/private state traversal.
- Audit public UI keyboard/focus semantics, current-selection and disabled/pending behavior, table/collection naming, empty/invalid pagination input and clear recovery. Identify actual local wrong action/render from these files; distinguish required caller contract from source-confirmed defect.
- Discover nearest test filenames without reading more test bodies. Recommend at most two concrete fixes with exact owning source/NEW test partitions, public compatibility, acceptance and validation criteria. Do not alter existing public API or invent backend authority claims.
- If direct dependency needed, state exact missing read and why rather than expand. Persist source reads/findings/held plans honestly in this own report only; no source/tests/shared docs/commits/checks/broad/live/browser/Lab/providers/panel/private/protected implementation actions.

## Current State

Completed exact four-source inspection in paired t224 Core and nearest filename-only test discovery. Parent Current State confirms isolated worktrees, Claude integration ownership and protected runtime/storage/private boundaries. No Core or extension product/test/config/helper/shared documentation changed; only this downstream own report was written. No test/build/type/live/browser/provider/panel operation ran. Both proposed implementation partitions remain held. Prior preview reports and lazy-tail source/test remain frozen.

## Findings

### C1 - Tree events are not bounded to the originating item/control

Tree.tsx nests child treeitem li elements within their parent's li. onKeyDown always invokes handleKeyDown(event, node), without checking event.target, currentTarget or the nearest treeitem. React keyboard events bubble, and preventDefault does not stop propagation. Therefore Enter/Space on an enabled child calls onSelect(child.id), then the enabled parent's handler calls onSelect(parent.id). Arrow navigation likewise runs once for the child and again for its ancestor, possibly scheduling conflicting focus targets. The click handler already checks nearest treeitem, demonstrating the intended item boundary; its keyboard counterpart lacks that guard.

onFocus similarly calls setFocusedId(node.id) without filtering descendant events. Focusing a child bubbles through the parent and can leave the parent's roving tabIndex=0 while focus is physically on the child. This is separate from any unresolved focus-ID helper behavior: event bubbling and unconditional setters are visible in this exact file.

A node.actions descendant has only a click propagation guard. Enter/Space from an action button can reach the li handler, prevent the button's normal keyboard activation and select the tree node. Arrow keys in action controls may also be intercepted by the tree. The exact supplied action contents belong to callers, but the component explicitly permits arbitrary ReactNode actions and provides a clickable action slot; a native button is a legitimate synthetic boundary case. Do not require callers to patch propagation to make ordinary action controls work.

Disabled nodes suppress onSelect but still support navigation and expansion. This may be intentional selection-only disable semantics; do not change it without caller-contract review. Parent-child keyboard leakage remains wrong even when a child is disabled and an enabled ancestor responds. Whether actual browsers retain focus after removing/collapsing a node needs runtime evidence and the direct resolveTreeFocusId helper read; no claim is made here.

### C2 - Pagination mixes normalized divisor with raw values

Pagination.tsx computes pageCount using max(1, pageSize), but start/end use raw pageSize. For pageSize=0, total=10, page=1, the visible range is 1-0 of 10 while pageCount is 10; Next emits 2 and the range remains 1-0. For a negative pageSize, negative end/range values are possible. For NaN page/size/total, Math.min/max propagate NaN into the display and next/previous callbacks. A fractional page such as 1.5 can remain fractional and cause Next to emit 2.5. These are actual local arithmetic results for typed number inputs, not backend claims.

No integer/finite/nonnegative prop contract is documented in this component, though real callers may already supply only valid values. Thus malformed-input reachability in a production view is not established. The normal page clamp handles finite out-of-range integer page inputs and zero total reasonably: pageCount stays at least one and total=0 renders 0-0 of 0. Keep that existing empty-page model.

Navigation has clear First/Previous/Next/Last labels, current page uses aria-live=polite, the nav is named and receives aria-busy, and page-size selection receives a Rows per page name and disabled loading prop. IconButton's actual DOM/disabled behavior is outside this read scope; do not equate the passed disabled prop with independently verified native disabling.

### Other reviewed behavior and limits

DataTable.tsx uses a named native table with a visually hidden caption, scope=col headings, caller row keys when supplied, an aria-busy wrapper and a truthful Loading rows... versus empty message when there are no rows. Existing rows remain visible while loading; there is no local retained-data explanation or live result region. This can be intentional caller policy, not a source-confirmed wrong action. Row widths, unique headings/keys and nonempty columns are caller-provided; columns=[] makes an empty row's colSpan zero and duplicate strings duplicate header keys. These structural edge cases warrant a future contract decision, not a third fix in this audit. No sorting/selection/action API exists here, and no unsupported behavior is invented.

Segmented.tsx uses a named group, native type=button controls and aria-pressed for the supplied current value. Standard native Tab/Enter/Space operation is appropriate for this button-group API; do not convert it to a tablist/radio group without a consumer requirement. It has no disabled/loading prop, which is an explicit API capability gap rather than a demonstrated wrong action. A value absent from options leaves all buttons unpressed; empty/duplicate options are unvalidated caller input. The component does not own asynchronous outcomes or recovery, so no backend/currentness claim follows.

Tree has a named root, native treeitem/group roles, expanded/selected/disabled/level/position metadata, roving tab indices, hidden decorative icons and explicitly named expand/collapse buttons. Keep these semantics. Group IDs sanitize arbitrary node IDs; distinct IDs can sanitize to the same group ID (for example a:b and a/b), so callers must currently avoid that collision. Record this additional edge case without proposing another implementation partition.

## Held partition A - originating Tree item and nested-control ownership

Exact product path: apps/web/src/features/programs/components/data/Tree.tsx.
Exact NEW owning test: apps/web/src/features/programs/components/data/tests/Tree-event-ownership.test.tsx.

Fence keyboard handling to events originating on the receiving treeitem itself; native descendant action controls and toggle buttons retain their own keyboard behavior. Fence roving-focus updates to the corresponding origin rather than ancestor bubbling. Preserve direct item Arrow/Home/End/Enter/Space behavior, click nearest-item guard, expansion semantics, stable IDs, controlled selected/expanded props and current public API. Do not introduce a new helper or alter resolveTreeFocusId in this unit.

Tests first against mounted actual Tree: Enter/Space on a nested child select exactly that child once and never an ancestor; child ArrowDown/Home/End and left/right expansion execute only the intended item operation/focus target; child focus leaves exactly its item as the roving tab stop; disabled child selection does not leak into enabled parent; action button Enter/Space invokes its own native activation without node selection; nested controls retain their keys; direct parent/item selection and pointer selection remain intact. Use realistic bubbling focus/keyboard events rather than invoking handler props in isolation. Any existing DOM fixture needed requires a separately released read; no old assertion/harness edit is implied.

## Held partition B - consistent finite Pagination display/actions

Exact product path: apps/web/src/features/programs/components/data/Pagination.tsx.
Exact NEW owning test: apps/web/src/features/programs/components/data/tests/Pagination-inputs.test.tsx.

Choose and document one local normalization policy: finite nonnegative integer total (invalid to zero), finite positive integer page size (invalid to one, matching current pageCount divisor intent), and finite integer page clamped into 1..pageCount (invalid to one). Use these same values for page count, visible start/end and emitted navigation destinations. Preserve all valid finite integer caller behavior, callback signatures, zero-total one-page model, navigation labels and loading props. Do not issue onPageChange merely to synchronize props during mount/render. Do not fabricate selectable page sizes or silently change page-size callback semantics; invalid/duplicate supplied options and current size absent from options need separate contract review if later required.

Tests first: reproduce zero/negative/NaN page-size inconsistent range, nonfinite totals/pages and fractional destinations; pin the chosen display and integer navigation result; cover normal first/middle/last pages, total=0, out-of-range page clamp, loading props, clear labels and page-size callbacks for valid configured options. Native button disabled behavior needs exact direct dependency read apps/web/src/features/programs/components/controls/IconButton.tsx before implementation assertions; the current audit only verifies the props forwarded by Pagination. Do not mock that dependency in a way that hides the user control contract.

These product/test partitions are disjoint and retain public APIs. Root should release them only after frozen gates close and appropriate owning fixture/dependency reads are granted. No source fix or executed regression is claimed here.

## Discovery and validation record

Filename-only discovery under the four subjects' common components root found data/tests/JsonViewer-preview.test.tsx, CodeViewer.test.tsx, CodeViewer-download.test.tsx and controls/tests/Menu-keyboard.test.tsx, Field.test.tsx, Combobox.test.tsx, ClipboardButton.test.tsx, plus existing overlay/layout test filenames. No direct Tree/DataTable/Pagination/Segmented owning test filename was found by that search. No test body was inspected.

Direct dependencies named, not read: data/resolveTreeFocusId.ts for removed-selection focus policy and controls/IconButton.tsx for actual native disabled/label semantics. Unrelated consumers, stores, styles, runtime and private data remain uninspected. Evidence is source-based; no actual browser, assistive technology or keyboard session was executed. Root owns release, independent verification and integration.
