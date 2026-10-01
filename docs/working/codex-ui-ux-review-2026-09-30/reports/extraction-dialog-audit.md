# Extraction dialog lifecycle audit

Status: Complete (read-only worker proposal)
Owner: worker extraction-dialog-audit
Scope: Read-only t224 downstream source; only this report written.

## Current State

Read-only trace complete. Recommend temporary root mounting for the open sheet, focused modal lifecycle/inert restoration, targeted field-focus restoration and lifecycle epoch protection. Exact six-file implementation ownership and local harness/regressions specified below. Product source untouched while supervisor broad gates run.

## Findings so far

- panel-elements.ts declares role=dialog/aria-modal=true and appends panel beside entry inside caller host. Hidden body during choosing leaves Close/Cancel controls.
- panel.ts open resets local draft/preview, shows sheet, awaits optional recording preparation then startPick and polls600ms; close clears local preview and hides sheet before awaiting background cancellation.
- captured retains sheet with count/status feedback, unlike restored recorded session which closes.
- render rebuilds every field row, including after edits, busy changes and async preview reads; a trap alone cannot preserve edited field focus.
- ExtractControl gates entry from connection/page/working state; mounted sheet availability is a separate concern still under trace.

## Validation

Read-only source inspection only. No tests/builds/browser/Lab/providers/panel or live accessibility claim.


## Traced lifecycle (current code)

1. Build: panel-elements.ts:94 declares a section dialog, aria-modal=true and extractionTitle name; :109 appends both entry and sheet to host. No tabindex, focus call, inert handling or live status role. CSS fixes sheet over extension viewport; hidden ancestors still hide it.
2. Entry: panel.ts:252 shows sheet, resets preview/draft, awaits recording prepare then starts background picker and600ms polling. run(:238) blocks concurrent commands and disables Confirm/Cancel via render(:216); Close remains visually enabled while busy but its click silently does nothing. Field inputs remain editable during Confirm. Prepare/start failures leave an open sheet with notice; no initial focus.
3. Page selection: background control.startPick starts a memory-only session and sends pickStart to the real page's top frame. The extension sheet is in a different document; page input must remain possible. content/picker/session.ts:181 owns page Escape: prevents/drains it, stops picker, reports cancellation to background. The panel's document Escape handler(:282) is separate and neither prevents default nor stops propagation. Do not replace page handling or cancel from panel blur/unload.
4. Choosing/picked: applySession(:134) polls picking/refused states, preserves refusal copy and stops polling on a picked proposal. It constructs local draft only once, keeps D12-screened preview, then renders confirmation. A page Escape/tab removal/navigation can remove background session; next read of no-session invokes close(:100).
5. Editing/preview: edit synchronously drops excluded/stale values, then optionally rereads only selected allowed columns. rereadPreview drops replies for different column keys. Every render rebuilds all fields, so rename/kind/radio/remove, busy changes and preview completion detach focused editable controls. Existing controls already have sourceKey wrapper dataset.field and distinguishing classes/radio values; targeted focus restoration needs no field-row source change.
6. Confirm success: captured(:119) clears local preview/draft but retains sheet showing counts/zero-row/truncation feedback. Restored state=recorded closes, unlike this same-instance success receipt. Preserve this distinction and counts. Close/Cancel currently clear local values and hide before awaiting cancellation; failed cancellation notice is consequently hidden. Busy Escape is ignored by run guard.
7. Reopen: mount read(:290) reconstructs picking/picked view from background memory and opens if draft or poll exists. Firefox click on page destroys popup; fresh document must reread session and resume without starting another pick/recording. Service-worker teardown intentionally loses preview/session; no durable copy or unload cancellation should be introduced. client comment says active-tab session, but actual background readSession uses sessionIdOf(message), absent here, and session-store.get returns most recently started session; do not change this contract in a focus task.
8. Host/status: recording-controls.ts:59-60 mounts once. :143-144 reparents extractionHost between barExtract and extractSlot whenever recording/paused changes. The sheet travels with entry. Shell puts recording.bar and Automations under main, with top bar outside main (mount-panel.ts:104); full root/host inerting would inert sheet too. Shell tab changes or hidden bar/Automations can hide its ancestor even with panel.hidden=false.
9. Disconnect/reconnect: extractControl disables entry for offline/unsupported/working; panel.setAvailable(:296) only changes entry disabled/title. It neither closes nor rereads open sheet. Polling continues unless a session read throws; refresh catch stops polling and shows error. Reconnect does not explicitly restart it. A picked local draft remains; confirmation error is shown by client/work catch. Focus change on availability must not discard draft or alter background session. Any reconnect retry policy is separate scope requiring explicit behavior; modal work can preserve current connection semantics and ensure Close remains a usable exit.
10. Async races: initial mount read or an in-flight poll can arrive after user starts/closes another sheet; there is no lifecycle generation guard. Mount continuation can reopen after close. Column-key equality alone cannot distinguish the same columns in a newer pick. A focus helper must not magnify this by refocusing/reinerting stale sessions.

## Dialog placement comparison

| Option | Advantages | Risks/cost |
| --- | --- | --- |
| Move only open sheet to stable ownerDocument.body; restore hidden sheet to original host on close | Fixed CSS and IDs remain; entry can reparent without moving modal; inert only body siblings; hidden ancestor no longer suppresses open sheet; no recording/shell edit | Must restore original parent/current host safely, previous inert values, listeners/observer and return target; body-child mutations need coverage |
| Keep sheet in host; inert siblings at every ancestry level | Avoids portal and preserves original hierarchy | Must recompute ancestry/inert snapshots after every recording host move; avoid inerting any ancestor; hidden ancestry remains a separate problem; requires host-move notifications or subtree observer and more coupling |

Recommend temporary root mounting during open. Preserve original parent/node reference and nextSibling, move sheet alone; original host may move freely. On close hide sheet, remove modality listeners/observer, restore every prior inert value (including already-inert branches), restore sheet to original still-connected host, then restore focus to current visible enabled entry or selected top tab. If original parent was removed, leave hidden sheet detached; do not resurrect obsolete DOM. Do not portal entry, create a second sheet, remove existing IDs or change extraction CSS/picker/session ownership. A body direct-child MutationObserver can inert new background siblings and restore owned mutations on close; it must never watch or act on the real page.

## Minimal bounded implementation proposal

Exact product ownership (six files; two new source/test subjects, no shared harness changes):
- apps/extension/src/panel/extraction/panel.ts ? connect lifecycle, generation guard, before/after render focus reconciliation and busy Escape/close behavior. Keep privacy reducers, request payloads,600ms polling, page picker and capture counts.
- apps/extension/src/panel/extraction/panel-elements.ts ? programmatic panel/status focus targets and feedback roles; preserve section/IDs/labels/current hidden CSS. Root move belongs in lifecycle helper, so builder's original host placement remains compatible.
- apps/extension/src/panel/extraction/dialog-focus.ts (new) ? one focused exported factory handling open-root placement, inert snapshots, visible enabled tabbables, Tab/Shift+Tab boundary wrap, extension-only focusin guard, focus entry/return, render snapshot restoration, cleanup.
- apps/extension/src/panel/extraction/index.ts ? synchronize helper reexport with owning barrel.
- apps/extension/src/panel/extraction/tests/dialog-focus.test.ts (new) ? isolated lifecycle subject.
- apps/extension/src/panel/extraction/tests/panel.test.ts (new) ? public mount handle/component async/session seams.

No edits needed to field-row.ts, preview.ts, recording-controls.ts, shell, content picker, background, contracts or shared fake DOM. Existing preview/preview-reread tests can be rerun unchanged once source is frozen, alongside new tests. If a generic utility is promoted later, rehome deliberately; one consumer does not justify an unrelated UI framework.

Lifecycle behavior:
- Open once: save prior focused element, portal sheet, apply body-sibling inertness, focus label for ready proposal or programmatically focusable status/panel for choosing/busy. Do not repeat initial focus on poll/preview. Focus calls require visible extension document with document.hasFocus(); never handle browser-window blur by refocusing or cancelling. Restored popup session receives the same open path once; no duplicate startPick/prepare.
- Trap only extension document: enabled visible controls excluding hidden ancestors; include keyboard-accessible info hint and nonnegative tabindex. Boundary Tab/Shift+Tab wraps. If busy disables all controls, panel/status is fallback. External browser/page interaction stays possible; no global blur/unload/window-focus trap.
- Escape: consume only when visible sheet owns event, respect IME/composition and busy work; perform at most one background cancellation. Disable Close consistently while busy. One helper callback replaces old duplicate document handler.
- Render: snapshot a currently focused field by sourceKey + control class/radio value and caret/selection immediately before actual redraw; restore corresponding replacement only if redraw detached that focus, document remains active, and focus did not move elsewhere. Removed fields choose next/previous original field label, then Dataset name. Preserve label value and newer edits. An async preview completion with focus elsewhere does nothing to it. Stable keyed field/control nodes are a valid larger alternative, but require field-row.ts ownership and more event/data reconciliation; targeted revision/identity restoration is smaller here.
- Successful receipt: keep modal/count sentence, move focus to status only if focused proposal/Confirm becomes unavailable, retain Close/Cancel; no focus-steal when user is on page. Announce counts/errors once via status/alert role without quoting preview values.
- Close/failed cancel: preserve immediate local preview deletion. Keep a visible pending/error shell until cancellation acknowledges; only then close modality/return focus. On failure user can retry Close. Lifecycle epoch invalidates old mount/poll/preview responses and rejects replay into a new pick. Stale work must not reopen, reinert or steal focus. Recording completion/absent session closes through same lifecycle. Changing cancellation-error behavior requires explicit approval in next brief (currently defect is hidden error).
- Return focus: visible enabled connected initiating entry first; then visible selected shell tab; otherwise no hidden/disabled focus. Only restore if extension document owns focus; never pull user back from real page. Cleanup inertness/listeners regardless of focus eligibility.

## Test harness and meaningful regressions

Use local DOM harness inside new dialog-focus.test.ts / panel.test.ts (or one narrowly named approved extraction/tests/dialog-dom.ts support file only if reuse warrants exact clearance). Existing chat FakeElement has no parentElement/body/contains/querySelectorAll, inert/tabIndex, activeElement tracking, document event bubbling, getClientRects, selection ranges or MutationObserver. Do not silently extend shared fake. Local focused fake must model removal/reparent focus loss, hidden ancestors, direct-body-child observer notifications, focus calls/options, disabled state and keyboard preventDefault/stopPropagation. Reuse fake primitive by local subclass/decorator where possible; for body and native event semantics supply only what subject uses. Mock runtime replies/deferred promises and own polling clock; no real page data/provider.

Required cases:
1. Open from entry sets named initial target, saves/restores preexisting inert=true and inert=false siblings, leaves dialog ancestors interactive; repeat open does not overwrite restoration snapshot.
2. Tab/Shift+Tab boundaries, hidden pagination/body, disabled controls, focusable hint, zero enabled controls and IME/busy Escape; no double cancellation or background event propagation.
3. Programmatic extension-background focus stays inside while modal; document.hasFocus=false/page selection causes no focus call and no cancel. Body background insert during open becomes inert; observer/listeners cleaned on close.
4. Recording preparation/status reparents host while sheet open: sheet remains rooted/visible and Close returns hidden sheet to current host; opener hidden/disabled/removed falls back to selected visible tab, not hidden controls.
5. Mount restores picking/picked session without start/prepare; recreated Firefox document preserves background session. Page Escape/no-session and recorded session close correctly; same-instance confirmation stays visible with captured counts.
6. Field rename/kind/radio/include/exclude/removal focus/caret through redraw; preview arriving after focus moved elsewhere does not steal; privacy dropped before rendering and reread excludes sensitive/stale data unchanged.
7. Confirm busy disables editable controls/Close consistently, no-new-edit-loss; captured body removal lands on status/Close only when prior focused control vanished.
8. Close/cancel pending/failure/success: visible error and retry, all local preview gone, inert restore exactly once. Deferred mount/poll/preview replies after close/new-open cannot resurrect stale view or affect focus.
9. Disconnect/unavailable entry while open keeps safe local context and usable Close; close return uses selected tab when entry disabled. No new reconnect session/privacy policy without explicit scope.

## Limits and handoff

No product edits, tests/builds/heavy jobs, live browser/Lab/provider/panel process, shared document changes, Core/other-worktree edits, commits or pushes. This is a source trace/design, not accessibility or browser certification. Cross-document selection, Firefox destruction/reopen, browser focus/inert semantics and screen-reader announcements require later authorized live verification. Implementation must wait for explicit ownership brief and supervisor freeze release.
