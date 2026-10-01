# Extraction draft/control recovery implementation

Status: Complete (worker claim); exact four source/test paths frozen for supervisor review
Owner: recording_controls worker
Date: 2026-10-01

## Written brief / exact ownership

Read parent Current State and frozen extraction-keyboard-recovery-audit findings E1/E2/E5. Product release is not granted yet. During current gates this report is the ONLY writable path. After explicit release, exact four candidate paths are panel/extraction/panel.ts, field-row.ts, NEW tests/field-row.test.ts and NEW tests/panel-draft-recovery.test.ts. No helper/barrel/client/preview/confirm-payload/view-model/dialog-focus/wire/session changes. Existing tests/shared fake/harness may not change without explicit evidence and supervisor release.

Automation remains frozen at downstream checkpoint924903b8; supervisor owns explicit detail-summary matching refinement. Core, Chat and other extraction read recovery work are not owned here. No source/test/heavy/broad/live/browser/provider/panel/private-state/commit/push activity occurs while held.

## Concrete design

### Preserve raw typing separately from normalization

Column input currently commits only on change; a preview callback fully reconstructs all field rows from committed labels. Existing caret repair cannot recover a value never saved. Keep two narrow local concepts: settled field label in ExtractionDraft and raw field-name intent in a draft-owned Map keyed by sourceKey. Input stores the exact raw value without trim or full render; this preserves insertion spaces, partial/empty names and IME typing. Render overlays any pending raw value on the field given to field-row, while privacy/sourceKey/kind/handling remain the settled draft's values. A preview render therefore draws the still-focused raw name before existing dialog caret restoration.

Explicit change commits trim(raw) or the last settled field label for that key, then clears pending intent and uses existing rename/edit rendering. Confirm is also an explicit commit boundary: settle pending raw names before constructing the original structure-only payload, so synthetic direct activation does not rely on browser blur to retain intent. The normal browser blur-before-button path produces the same payload. Duplicate labels still derive distinct record keys through unchanged confirm-payload; dataset label rules do not change.

Clear raw intent when its field is removed or draft is cancelled/captured/replaced. Exclusion/kind change privacy narrowing must still run immediately through original retainExtractionPreview; raw labels contain no page preview rows. A removed or excluded field is not resurrected by a saved raw name. The original field-row rename callback contract keeps explicit-commit normalization compatible; one local input-name callback supplies raw input to panel. No public wire field is added.

### Bind editing callbacks to current draft and row instance

Keep epoch as existing pick/dialog fence; add a local field-render generation (or equivalent current mounted row identity) for every replacement of field rows, including no-draft render. Each row's input/rename/kind/handling/remove callbacks capture epoch + current field generation. Before requireDraft or any raw/settled mutation, require current epoch/generation, nonbusy draft and current sourceKey membership. Raw input does not redraw, so current row retains its lease while typing. Any later full redraw retires old handlers even when sourceKey remains identical; cancel/capture/new pick retire them before a subsequent callback can throw or edit a new draft.

The row lease is local UI identity, not authoritative session identity. A failed Confirm re-enables freshly rendered current controls; old callbacks from the frozen submitted draft remain inert. Existing operation epoch, cancellation erasure and receipt retention are preserved. Current fresh callback executes exactly once; stale callback changes no current label/kind/handling/field count and issues no preview re-read.

### Accessible column-specific names

Give each row role=group and a plain-text accessible name identifying its column. Name input, read-kind select and Remove button receive column-specific accessible names; handling group remains How to handle <label>. Keep visible Remove text, all classes, dataset.sourceKey, Lab ids, native input/select/radio controls and keyboard-focusable Exclude explanation. Names update on current input/commit and subsequent redraw. Use text/value/aria attributes only, never HTML. Empty in-progress name receives a neutral column description rather than disappearing semantics. No radio keyboard policy, Enter shortcut or dialog trap change is introduced.

### Keep the existing focus and privacy seam

Leave dialog-focus.ts byte-unchanged. It already repairs removed nodes/caret only while extension document owns visible focus, and preserves deliberate external focus/page selection. Full redraw still flows through dialog.render. Existing modal isolation, IME/busy Escape, source-owned neighbour fallback and Firefox session restoration remain required contracts.

Leave preview.ts/preview-table.ts/view-model.ts/confirm-payload.ts/client.ts unchanged. D12 exclusions drop values synchronously, re-included stale fields remain unpreviewed, and Confirm receives structure only. E3/E4 stage-specific Retry/preview operation identity remain serial follow-up; no error-recovery or lifecycle/host/session expansion enters this four-path unit.

## Tests first, before product edits after release

Use existing withDialogDom/proposalFixture read-only and local deferred synthetic replies in new panel-draft-recovery.test.ts. No shared fake extensions should be necessary; its input/change dispatch, focus, selection, deferred runtime responses and current source-key selectors already provide the required observations.

1. Reproduce E1 with delayed preview: exclude a different field to start a read, focus/name another column, insert leading/interior/trailing spaces via input only, then resolve preview. Assert exact raw value, current focus and caret survive, with no extra preview request due to typing. Repeat when raw value is empty/whitespace and assert committed fallback only at explicit change.
2. Confirm with pending raw name, including direct synthetic activation before blur: normalized settled label reaches structure-only payload; duplicate names retain distinct derived keys. Failed Confirm preserves that submitted settled draft after unlock; callbacks while busy do not alter it.
3. Reproduce E2: retain A field callbacks; cancel and acknowledge; open B with identical sourceKey; old input/change/kind/handling/remove invoke no current mutation/preview request. Retained handlers after capture/cancel do not throw requireDraft.
4. Retain same-draft row then trigger redraw/rename; old row cannot overwrite newer name or remove/exclude current field. Fresh row still edits normally. Field removal clears raw intent and current neighbouring focus recovery remains unchanged.
5. Field-row direct tests assert exact raw input callback vs explicit trimmed/nonempty commit behaviour, column-specific group/read-kind/Remove accessible names, updates after rename, plain-text hostile synthetic labels, checked-radio semantics and keyboard-focusable exclusion note. Visible Remove text/classes remain original.
6. Privacy regression: raw edits during exclusion/kind change never restore excluded/stale values; preview and confirmed structure contain no excluded synthetic cell sample. Re-inclusion stays unpreviewed until actual extraction. Existing list/name/key contracts remain unchanged.
7. Blur/page-focus/hidden-document cases: preview redraw stores current raw name without taking real page focus; later extension focus still uses existing repair rules. No document recreation starts/prepares/cancels background pick unexpectedly.

First focused execution must observe meaningful original failures for raw typing, stale callback and accessible action-name tests; record exact counts before changing source. Keep original panel/dialog-focus/preview/preview-reread/confirm-payload/view-model suites in focused gate alongside new two suites. Use external TEMP esbuild harness and actual-config scoped typecheck under heavy.sh after release only. Strict checks must report both owned/global and dependency diagnostics; no config exclusion or fixture weakening. Root owns independent combined/full/types/build/structure and any real browser validation.

## Structure / implementation constraints

panel.ts currently has417 lines and several inherited responsibility blocks. Keep additions narrow with compact local raw-intent/lease handling and reuse existing edit/render/epoch paths; avoid parallel draft coordinators or duplicated normalization. No helper path is currently released. If cohesive implementation cannot remain within structure allowance without extraction, ask supervisor for exact helper ownership rather than changing baseline/config or expanding this unit silently.

## Progress / held return

Planning completed; exact four-path design and test-first matrix recorded. No source or tests created/edited and no gates run. Waiting for explicit supervisor implementation release after ninth extension gates; read/preview Retry, session schema and host disposal remain held separate work.

Implementation release received: ninth full1878/types/build/structure observed by supervisor. Added four original synthetic tests before product changes; narrow reproduction next. No helpers/old tests/shared harness/Core changes.

Original reproduction observed: native1,0/4 passing,486.6845ms. Column group unnamed; delayed preview reverted raw name to Price; retired handler renamed next pick Foreign draft; retained Remove after receipt threw requireDraft. Product edits now active in exact panel.ts/field-row.ts only.

Progress checkpoint: exact four-path implementation resolves all four original failures. Intermediate8-suite64 native0/656.321ms (original43 plus new21); strict actual-config4roots zero owned/global and zero dependency diagnostics; exact diff-check0. Original tests/helpers and protected focus/privacy/client/wire source unchanged. panel435lines and field-row176lines; no helper extraction/baseline/config relaxation. Final current-control and retired-commit boundaries added before freeze.

## Frozen implementation return

Exact four changed paths: panel/extraction/panel.ts, field-row.ts, NEW tests/field-row.test.ts, NEW tests/panel-draft-recovery.test.ts. No extra helper/barrel/old test/shared fixture was changed. Product diff is41 insertions/8 deletions across two sources; panel435lines, field-row176lines.

Raw names live only in local draft-owned rawNames map. Input stores exact text without trim/redraw; render overlays raw labels on settled field snapshots so asynchronous or synchronous unrelated redraw preserves current typing/caret. Explicit change normalizes against settled label, and Confirm normalizes pending intent before constructing the unchanged structure-only payload. Raw intent clears on field removal/cancel/capture/new pick. It never contains preview cell values.

Epoch plus field-render generation and current field membership fence every field callback before requireDraft/mutation; busy guards remain effective. Retired controls after same-draft redraw, cancel/capture/new pick do nothing even with matching sourceKey. Current controls still edit kinds/handling/labels/remove correctly. Existing failed Confirm retains submitted normalized label and unlocks freshly rendered controls.

Rows have labelled group semantics; label/read-kind/Remove/handling names identify current column and update with raw/committed rename. Native controls/classes/visible Remove and focusable privacy explanation remain. Strings remain text/aria attributes. Optional inputName callback preserves original standalone field-row commit API compatibility. Existing dialog focus repair and privacy helpers are unchanged.

Observed verification:

- Before product edits, original synthetic reproduction native1,0/4 passing,486.6845ms, four substantive failures recorded above.
- Final heavy focused8-suite66/66 native0,919.3558ms: original43 unchanged plus new23 (field-row4/panel-draft19), no skipped/cancelled tests. External TEMP/codex-t224-extraction-draft-focused.mjs, ignored scoped bundle directory only.
- Final heavy actual extension config scoped4roots native0: zero owned/global diagnostics, zero unowned dependency diagnostics. No config exclusions or relaxed strict settings. External TEMP/codex-t224-extraction-draft-scoped-types.mjs.
- Owned-path git diff --check native0. Protected extraction source/original tests/dialog fake comparison to HEAD native0 and empty: dialog-focus/client/view-model/confirm-payload/preview/preview-table/panel-elements and all six original test suites/helper are unchanged.

Synthetic coverage includes delayed read during unblurred spaces/blank typing, explicit normalization/Confirm without blur, duplicate key derivation, busy and failed Confirm, old same-key callback channels after new pick, captured/cancelled/same-draft retained callbacks, stale commit vs pending intent, fresh current controls, exclusions/stale values, removed field focus and visible last-field Confirm disabled state, and page-focused/hidden-document redraw without focus reclaim.

No package/broad/type-all/build/structure/live/browser/provider/panel/private-state/commit/push operations ran. Stage-specific read Retry/old preview errors (E3/E4), true background owner/session contract and conditional host disposal remain held separate work. Live IME composition, native screen-reader announcements and actual Chrome/Firefox browser behaviour are not certified by synthetic DOM. Supervisor owns independent review and broader gates; checks against a tree where another Chat worker is active remain provisional until coordinated freeze.

All four source/test paths are frozen now. Do not reopen without explicit supervisor follow-up.
