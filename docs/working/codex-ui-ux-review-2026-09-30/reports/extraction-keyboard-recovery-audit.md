# Extraction keyboard and recovery audit

Status: Complete (read-only worker findings; implementation held)
Owner: recording_controls worker
Date: 2026-10-01

## Written brief / evidence boundary

Read parent Current State and exact panel/extraction/{panel.ts,panel-elements.ts,dialog-focus.ts,field-row.ts,preview.ts,preview-table.ts,confirm-payload.ts}; directly owning panel/dialog-focus/preview-reread/confirm-payload tests, proposal fixture, local client/view-model/messages and runtimeSendMessage dependency only. No actual recordings, page data, browser/storage/private state or Core inspected. Product/tests remain unchanged. Automation nine paths remain frozen; supervisor separately owns its explicit summary-matching refinement.

This report contains source call-order findings and proposed synthetic reproductions, not newly executed tests or browser certification. Existing tests were read, not rerun. No broad/heavy/live/browser/provider/panel management/commit/push operations ran. Only this report is owned and written.

## Existing journey / preserve contracts

Entry opens an extraction sheet rooted in the extension document, optionally prepares recording, starts one background page pick, then reads the background session every600ms until picked. Reopening a Firefox document resumes the session without re-preparing/re-starting; a restored recorded session stays closed. Dataset name, column kind/name/handling/removal, page selection, five-row preview, Confirm and Cancel/Close comprise the panel journey. A successful Confirm clears draft/preview immediately and leaves the count/no-record/truncation receipt visible. Failed Confirm keeps the submitted draft available after unlocking. Cancel immediately erases draft/preview before awaiting background acknowledgement; failure leaves a retryable visible shell. These are existing deliberate tests and must survive.

Dialog focus already portals only the sheet, preserves/restores inherited inert state, tracks added body roots and cleans its document listeners/observer on close. Tab wraps only at visible enabled boundaries; IME Escape/browser shortcuts remain alone; busy Escape is consumed without cancelling. Redraw repairs only source-owned extension focus, carries text selection, and chooses a surviving column neighbour after removal. Document.hasFocus/visibility guard explicitly preserves browser-page focus and hidden-document behaviour. Do not replace this with a generic page-level trap or broaden a focus fix into content picker controls.

D12 preview privacy is cohesive: every edit rebuilds held rows from allowed proposal sourceKeys, excluded/changed-kind columns remain permanently stale, and the background preview re-read receives excluded source keys. Preview table uses textContent, not HTML, and confirm-payload has no preview values. Duplicate label record keys are deterministically disambiguated; attribute/header fields are sent only under their applicable kind. Preserve those tested rules; do not re-reveal stale values to make previews appear more complete.

## E1 ? Uncommitted column-name typing is lost on unrelated redraw (high)

field-row.ts:63 writes a column rename only on change. panel.ts:237 render replaces EVERY field row from committed draft; preview completion at229?231 invokes render without first capturing active input value. dialog-focus.ts:79 restores focus/caret but deliberately does not restore value. Therefore: trigger a delayed preview read by excluding a different field; type a new name into a still-focused column without blur; let the preview resolve. The new node uses the old draft label and loses the typed text even though its caret/focus are repaired. The existing caret test dispatches change first, so it cannot detect this loss. A synchronous rename of another column or pagination redraw also exposes this when a programmatic edit occurs during typing.

Prefer committing column-name draft input independently from full redraw, or a keyed row update that preserves uncommitted current value. Preserve current nonempty/trim normalization at the explicit commit boundary rather than trimming away ordinary space insertion on every keystroke. Keep dataset-name input behaviour, native blur-before-button Confirm ordering, source-owned caret and all privacy narrowing intact. No wire change is needed for the local draft fix.

## E2 ? Detached field handlers have no draft-instance lease (high)

panel.ts:248?253 gives every newly constructed row callbacks that test only !busy and then use requireDraft() against whichever draft exists now. field-row.ts listeners capture sourceKey/previous label and remain callable after replaceChildren. Closing/cancelling/capturing sets draft undefined and later busy false: a retained handler can throw requireDraft rather than becoming inert. Cancelling A and opening B with matching sourceKey allows a retained A change/remove/handling callback to modify B. Ordinary same-draft redraw also leaves old listeners callable and lets an old name change overwrite a newer committed name.

The existing epoch fences late async work across close/new picks, but row callbacks never capture/check that epoch or their mounted row identity. Add a cohesive draft/dialog instance or row-instance lease validated before editing; sourceKey membership alone cannot distinguish A from B. Ensure retained handlers after capture/cancel do nothing without exception, and replaced rows cannot edit current rows while fresh current controls remain operable. No claim that a retained disabled browser element naturally fires was made: this is a programmatic/queued callback contract exercised with synthetic retained handlers.

## E3 ? Read/start failure has no direct current recovery action (medium)

refresh catch at196 stops polling and displays notice; there is no Retry control in panel-elements or panel bindings. For an open pick a transient session read failure leaves the sheet saying to pick an item with polling permanently stopped. Entry refuses whenever sheet is already open, so pressing the original entry does not resume it. To recover, the user must cancel the authoritative background session and start over, or recreate the panel per client NO_LISTENER text. Prepare/start refusal has the same modal-with-error/no-retry pattern, though the existing test only checks Close is operable.

Add stage-aware explicit Retry for failed read/preview/start, preserving last confirmed draft and D12-narrowed rows. A read retry must re-read the existing background session before starting another pick, and must not prepare/record again merely because a read failed. A genuine prepare/start retry is a different stage and needs its own ownership/operation guard. Maintain600ms picker polling cadence; do not turn a stopped read into an unbounded automatic retry loop. Cancel retry deliberately preserves its immediate local erasure. Closing a recorded receipt should be reviewed separately from cancellation semantics; do not invent background cancellation success.

## E4 ? Preview errors can publish after their requested selection was superseded (medium)

rereadPreview success checks token + current draft + shownColumnsKey equality. Its catch at233 checks only token === epoch. Exclude A (request1), then exclude B (request2) in the same pick; let request2 succeed and request1 reject later. The obsolete request1 can show its failure on the newer valid selection because field edits do not increment epoch. A subsequent successful reread never clears that notice: only applySession clears refusals/notices, and normal picked editing no longer polls it. Thus obsolete failure can stick beside a successful current preview.

Give the preview-read channel its own operation identity/selection revision and check it on success, failure and local loading/error cleanup. Current successful preview should clear only its OWN previous preview error, not a simultaneous Confirm/cancel/prepare error. Explicitly preserve the epoch fence across picks and column-selection privacy policy. Current same-selection refused read retains narrowed last-good preview and offers direct retry.

## E5 ? Repeated column controls lack column-specific accessible action names (medium)

Every name input is named Column name; every kind select is What this column reads; every remove button is Remove. The div.extraction-field is not an accessible labelled group, so kind/remove controls expose no semantic link to the current column name. Handling radiogroup DOES identify How to handle <label>; Dataset name is properly wrapped in its label, and Exclude explanation is keyboard focusable with its full accessible name. Preserve those working labels.

Give the row a labelled group or link control accessible names to a stable current column label; ensure Remove and read-kind can be distinguished across columns using screen-reader control lists. Keep Remove button text/class and Lab ids intact, continue text-only rendering, and update relevant accessible names after rename. Native radio/arrow key, select key behaviour and full real screen-reader announcements require later browser validation; no keyboard page picker completeness is claimed here.

## E6 ? Client validates receipt numbers by type only (low, defensive)

client capturedOutcome:54?59 accepts any numeric recordCount/pagesRead/durationMs, including NaN, Infinity, negative or fractional counts; receipt text can then report impossible counts. The existing seam test covers a fully populated valid outcome and compatibility bare {ok:true}. Tighten counts to finite nonnegative appropriate integers and duration to finite nonnegative while preserving optional legacy outcome fallback and truthful zero-count receipt. This is malformed-provider hardening, not an observed normal background defect. Likewise readExtractionSession trusts response.session shape; broader runtime proposal/session validation should be its own explicit boundary brief if wanted, not mixed into the keyboard changes.

## E7 ? Detached-host restoration/lifetime needs an integration decision (conditional)

The exported handle contains only setAvailable. There is no dispose entry point/retired-mounted flag. A delayed mount read can call refresh(true), apply a picked session and dialog.open after the host has been removed; open appends the sheet to the live document body and installs isolation/listeners. Existing host-detachment test covers close while already open, not late restore after host removal. A pending read/600ms pick timer also has no explicit teardown cancellation hook. This is a source-level possibility, not evidence that current shell actually remounts or removes a live extraction host.

Investigate host lifetime in the caller before implementing a disposal API. If caller teardown exists, release panel handle + caller cleanup + direct tests together. Do not treat temporary reparenting as disposal, abandon durable background sessions on document blur, or cancel a page pick just because Firefox popup disappears. Local disposal should fence callbacks/remove extension isolation without pretending issued mutation/background pick was cancelled.

## Session/context limitation held for separate investigation

Frontend messages.ExtractionSessionView exposes state/proposal/preview/refused only. mount does not receive ExtensionStatus owner context, and client Confirm/cancel/read request does not capture a local owner/session proof. Fixture objects contain synthetic sessionId/tabId, but those fields are not part of the frontend typed view; this audit does not infer a valid production identity contract from extra fixture properties. A background active-tab/session change while a local draft exists therefore needs an explicit cross-lane read-only contract investigation before any owner/wire fix. Do not copy the automation owner revision into extraction or invent session wire fields without synchronized background/shared/domain authorization. Current source-local E1?E5 can be fixed without claiming durable background ownership or complete cross-owner extraction recovery.

## Proposed bounded implementation partitions (all HELD)

1. Extraction draft/control identity: exact panel.ts + field-row.ts + new tests/field-row.test.ts + new tests/panel-draft-recovery.test.ts (and only necessary truthful local fixtures in existing panel.test.ts). Implement E1/E2/E5 together since panel owns row callback leases and field-row owns input/accessibility events. Preserve dialog-focus source; it remains the existing repair seam. Test before editing: delayed preview completes during unblurred typing; stale A handler vs B same sourceKey; stale same-draft renamed row; retained handler after receipt; duplicate Remove/read-kind accessible names.
2. Stage-owned read recovery: exact panel.ts + panel-elements.ts + new tests/panel-read-recovery.test.ts, with any narrowly released existing panel-test fixture changes. Serial after partition1 because panel.ts overlaps. Implement E3/E4 with separate preview request/error state, current-only Retry and stage-specific busy/local status. Preserve all cancellation/recorded acknowledgement/IME/browser focus assertions. New helper only if supervisor explicitly releases a cohesive channel module to keep panel.ts below its current structure budget.
3. Receipt boundary: exact client.ts + new tests/client.test.ts. Independent only when supervisor authorizes; E6 malformed numeric response matrix, legacy undefined outcome, valid zero/multiple pages and existing structure-only payload rules. No shared/wire/background change.
4. Host lifetime/session identity: read-only caller/background contract investigation first, then separately scoped multi-layer brief if warranted (E7/context limitation). Do not claim implementation authorization from this report.

## Required next tests / validation limits

Before source changes reproduce E1/E2/E4 in current local dialog fake using deferred synthetic responses; do not write actual page values into reports. Cover operation ordering: read/error/retry success, old failure after current success, old finally after new operation, Confirm while preview pending, busy programmatic duplicate activation, all exclusions/removed last column, and no repeated prepare/start on session retry. Keep existing panel/dialog-focus/preview/confirm-payload/view-model suites in the owning focused gate and actual-config scoped typecheck for released paths. Root runs independent combined/full/type/build/structure gates. Browser validation later must explicitly distinguish Chrome side panel vs Firefox popup recreation and keep real browser-page focus free; no live run is authorized by this audit.

## Return

Only reports/extraction-keyboard-recovery-audit.md changed. All product/tests stayed read-only; no new execution gates ran. High-priority local findings are typed-name preservation and draft-bound callback identity, followed by direct recovery and preview-error ownership. Implementation is held pending explicit supervisor release and exact path partition.
