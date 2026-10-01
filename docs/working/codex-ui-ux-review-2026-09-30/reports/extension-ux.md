# Extension UX discovery

Source snapshot: task/t224-codex-ui-ux-review. Supervisor review, source-based;
no live browser or provider calls, and no product edits.

## Surface map

The shared popup/side-panel shell contains Chat, Automations, Settings and gated
Getting Started. Recording controls/review and extraction form additional
journeys. Core owns durable automation editing, rich run inspection and data;
the extension offers recording, chat, quick runs, exports and Open FluxIQ.
Current tab keyboard navigation and labelled settings fields are present.

## Findings

### EXT-01 — Successful send deletes a newer unsent draft (P1)

`apps/extension/src/panel/chat/conversation/composer.ts`, submit:
the textarea remains editable while `send(box.value)` is pending. On success,
the callback unconditionally empties both box and draft storage. Any newer text
typed during the request disappears. Its own comment promises continued typing.

Capture the submitted text and edit revision. Clear only the unchanged submitted
draft; preserve subsequent edits and stored draft. A deferred-send component test
must exercise unchanged success, edits before success, failure and IME behavior.
This is a concrete code defect; visual impact is not browser-tested.

### EXT-02 — Pending settings save overwrites subsequent edits (P1)

`apps/extension/src/panel/settings/settings-view.ts`, save/setSaving/onEdit:
only Save is disabled during the request. Form fields remain editable. Successful
save sets dirty=false, deletes the stored draft and fills the submitted settings,
discarding any later edits. Preserve a revision-bound draft or disable fields
consistently; revision preservation supports continued typing better. Reconnect
must use the saved settings and must not imply newer edits were saved.

Test with deferred save plus subsequent address/toggle edit and pushed status;
assert dirty notice and draft survive until an explicit later save.

### EXT-03 — Automation refresh destroys row focus (P1)

`apps/extension/src/panel/automations/automations-tab.ts`, draw:
every controller onChange calls list.replaceChildren with entirely new buttons.
`controller.ts` calls onChange after refresh and working-state changes;
the active list polls every 30 seconds. A focused row is therefore detached even
when unchanged. Reconcile stable row elements by flowId and update current row
data in their handlers. Preserve selected context, scroll and focus; if a row is
removed, move focus predictably. Add DOM regression for unchanged/refreshed rows,
reordering and deletion. Actual browser focus behavior still needs a live check.

### EXT-04 — Extraction claims modal semantics without focus containment (P1)

`apps/extension/src/panel/extraction/panel-elements.ts` declares role=dialog and
aria-modal=true; `panel.ts` opens by clearing hidden and closes by setting hidden.
Its Escape listener exists, but there is no initial focus, Tab containment,
background inertness or focus restoration in either module. Background shell
controls remain available to keyboard navigation while assistive technology is
told the dialog is modal. Use a focused dialog lifecycle shared by extension
overlays; preserve the real-page picking workflow and Firefox popup reopening.
Test focus entry, Tab/Shift+Tab, Escape/busy behavior, return focus and resumed pick.

## Integration dependencies

Task t219 already fixes selected-automation Core deep links and legacy relay
names; do not duplicate or regress it. Tasks t216/t217 fix waiting/ending feedback
contracts. UX implementation must be based on their integration state, with
Claude retaining ownership of those merges.

## Validation limits

Read source and existing focused test locations only. No visual, responsive,
screen-reader or browser timing claim. Suggested tests are implementation steps,
not tests already executed.
