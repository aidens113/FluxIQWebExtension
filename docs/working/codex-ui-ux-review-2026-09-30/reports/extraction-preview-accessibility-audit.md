# Extraction preview accessibility audit

Status: Complete - read-only audit; implementation held
Owner: recording_controls
Date: 2026-10-01

## Written brief

- Preserve the lazy-list source/test candidate unchanged while its queued scoped check closes. No source edits are released by this follow-up; no duplicate checks.
- READ-ONLY exact four downstream files: apps/extension/src/panel/extraction/preview.ts, preview-table.ts, panel-elements.ts and dialog-focus.ts. Parent Current State establishes isolated t224/Claude ownership; prior panel session binding and draft recovery stay intact.
- Audit actual preview loading/empty/error/results announcements, table headings/cell content accessibility, retry/confirm labels and dialog keyboard/focus/restore behavior from these files. Separate source-confirmed defects from conditional wiring or unmeasured native browser concerns.
- Recommend at most two precise bounded fixes with exact source/NEW owning test partitions, existing test names discovered by filenames only and acceptance criteria. Do not infer panel/controller currentness outside the four-file scope or inspect private/runtime/browser data.
- Write only this report progressively; mention which source evidence supports each finding and missing direct dependency if any. No shared docs/commits/source/test/broad/live/provider/browser/Lab/panel commands. Finish the original strict check honestly and report its frozen status separately.

## Current State

The exact four-file source audit is complete. No product, test, fixture, shared document or generated state was changed, and no test/browser/build command was run for this audit. Two disjoint implementation partitions are proposed below; neither is released. The separately released lazy-tail unit is frozen: its original queued strict two-root check closed native 0 with zero owned/global and dependency diagnostics; the focused four-suite result was 48/48, native 0, 42130.2133 ms. Those results are not preview accessibility validation.

## Source findings and existing safeguards

- preview.ts selects included, non-stale columns and retains only allowed source keys in preview rows. It has no DOM announcement or loading lifecycle responsibility. Preserve this D12 erasure boundary when improving presentation.
- preview-table.ts draws at most five rows, uses native th scope=col headers and writes page-derived cell values with textContent. Preserve those properties. The table builder in panel-elements.ts supplies no caption or accessible-name association; the nearby Preview heading is not linked to the table. Empty, missing and null cell values are displayed identically as two hyphens. That gives users an ambiguous placeholder; actual screen-reader pronunciation was not measured. This is a source-confirmed presentation gap, not a claim that unnamed native tables categorically fail an accessibility standard.
- panel-elements.ts names the dialog through extractionTitle, uses aria-modal, labels Dataset name and the pagination checkbox, gives the close button an accessible Close label, exposes status with role=status and recovery/notice text with role=alert. Native Cancel and Confirm buttons are labeled; Confirm begins disabled. Preserve identifiers, dialog title, existing control labels and operation rules.
- previewNote is a plain span; summary and preview table updates have no local live annotation in these files. However the status and notice elements already support announcements. These four files do not show which elements receive loading, empty, failure, result-count or retry messages. Do not assert that actual preview failures/results are silent from this static observation alone.
- entry and sheet recovery containers exist, but Retry construction, its current accessible label, pending disable rules and retry outcomes are outside this read scope. Missing dependency: panel.ts and the directly invoked recovery presentation module would need an explicit future read release before auditing that wiring. No currentness, selected-session or authorization claims follow from this audit.
- dialog-focus.ts traps extension-document Tab focus, honors IME composition, suppresses Escape dismissal when busy, restores each sibling's previous inert state and handles later body children. It checks document visibility/focus before moving focus, preserving browser-page focus. Close restores the opener only when focus belonged to the dialog. These are positive source safeguards; native browser/assistive-technology behavior is unmeasured.
- dialog-focus.ts render captures the active input selection, repairs a replaced field by stable field key and control identity, or falls back to a surviving neighboring field/initial control. Its final setSelectionRange applies the captured selection to any text-like fallback input. Therefore removing field A can transfer A's selection range to field B, or to the dataset-name initial input when no row remains. This is a source-confirmed cross-control selection ownership defect; whether a particular redraw reaches it is determined by its supplied work callback. Preserve neighbor/initial focus recovery while restricting caret restoration to the matched original control.
- Rendering nonempty rows with zero columns creates empty table rows and still reports the drawn row count. The four files do not establish whether callers can reach that combination. Record it as conditional wiring behavior, not an additional released fix.

## Proposed partition A: preview table semantics

Exact product ownership: apps/extension/src/panel/extraction/panel-elements.ts and apps/extension/src/panel/extraction/preview-table.ts.
Exact NEW owning test: apps/extension/src/panel/extraction/tests/preview-accessibility.test.ts.

Name the native table with a static, explicit Extraction preview accessible name, without introducing an ID collision or altering the named modal. Replace the ambiguous empty-cell hyphens with plain No value text for the existing null/missing/empty equivalence. This is display-only; do not change raw rows, retain excluded values, add innerHTML, broaden the sample, infer loading states, or change Confirm/Cancel behavior. The exact empty-cell wording remains a reviewable product choice; No value describes the current renderer's combined empty representation without claiming a schema distinction.

Tests first, against the actual builder/renderer: reproduce the currently absent table name and ambiguous placeholder; assert the completed table has the static name, all headings retain native scope=col and their supplied labels, all three empty representations receive the agreed text, literal page strings remain textContent, and more than five rows still draw five. Assert inputs to the renderer are not mutated and excluded-column data is not synthesized into the DOM. Do not weaken any existing delivery/privacy assertion. Before execution root should release the smallest existing fake-DOM support read needed by this NEW test; this audit did not read test bodies or helpers.

## Proposed partition B: selection belongs to its original control

Exact product ownership: apps/extension/src/panel/extraction/dialog-focus.ts.
Exact NEW owning test: apps/extension/src/panel/extraction/tests/dialog-focus-selection.test.ts.

Record whether focus recovery found the same field key and equivalent original input control. Restore the captured selection only for that successfully matched text input. Continue focusing the next surviving field, previous surviving field or initial control when the original row/control disappears, but leave that different control's selection untouched. Preserve deliberate focus changes, enabled/visible checks, document focus/visibility gates, radio identity, Tab/Escape/IME behavior, modal isolation and close restoration.

Tests first, using the actual focus helper: preserve same-field replacement selection; remove field A and verify field B receives focus without A's selection; remove the final field and verify the initial text input receives focus without inherited selection; test previous-row fallback and a same-row different-control fallback; preserve deliberately moved focus; ensure a hidden or unfocused document does not gain focus. Record selection-call ownership as well as activeElement, so a coincidentally clamped caret cannot mask the defect. No timer, wire, session, backend or controller expansion is needed. Root should separately release the existing focused fake-DOM support read before implementation.

Partitions A and B share no product/test file and can run independently after explicit releases. No third fix is proposed; dynamic preview announcements and recovery wiring remain a separately scoped audit dependency.

## Test discovery and limits

Filename-only discovery identified existing owning suites preview.test.ts, preview-reread.test.ts, panel.test.ts, panel-session-ownership.test.ts, panel-read-recovery.test.ts, panel-draft-recovery.test.ts and dialog-focus.test.ts under panel/extraction/tests. No existing test body was read or assertion altered. No direct preview-table or panel-elements owning suite was discovered by the bounded filename search.

Evidence is source inspection of the four released files. No live browser, keyboard session, screen reader, accessibility-tree capture, private recording, panel process or provider operation was exercised. Proposed NEW tests can prove local DOM and focus contracts; they do not certify native assistive-technology announcements. Root owns release, integration, independent review and wider checks.
