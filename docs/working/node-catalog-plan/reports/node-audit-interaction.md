# Node audit: interaction family

Lead: node-audit-interaction. Date: 2026-10-07. Read-only audit (no source, test or build touched).
Family: click, type, select, check, clear, upload, keypress, dialog, scroll, and target resolution.

Evidence labels: **Read** = seen in source at the cited line; **Live** = seen in a Lab debug or lane report
(spot-checked); **Reasoned** = follows from platform behaviour, not yet reproduced here. Paths are relative to
`C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/`. `E/` = `apps/extension/src/content/`, `D/` =
`docs/working/language-driven-flow-loop-plan/debugs/`.

## 1. Shared path (every node in this family)

1. **Definition.** `domain/src/actions/schemas.ts:219-360` declares each action's parameter schema;
   `domain/src/output-nodes/definitions.ts:184-268` turns it into a node `web.output.dom-<verb>`. A node whose
   schema requires `selector` gets `elementTarget: true` and an `item` port for loops (`definitions.ts:235,263`).
   `effect` (observe or mutate) is at `definitions.ts:136-157`: scroll is `observe`; the others are `mutate`.
2. **Model call.** The model runs a node through Core's run-node tool with `selector: {handle: "tN"}`.
   `domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts` resolves the handle to a selector plus
   an identity (`plan-resolution/element-identity.ts:101-118`). `actsOnTheWrongControl` (`resolve-plan-node.ts:312`)
   refuses select on a non-select, and type or clear on select, button, a, option or img. `fittingNodeCode` (`:338`)
   names the node that fits.
3. **Node implementation.** `domain/src/output-nodes/native-runtime.ts:77-94` emits one `policy.output.dispatch`
   effect. Click and navigate gain `checkWaitMs` (`actions/check-wait.ts`).
4. **Gateway.** `domain/src/client/gateway-mapping.ts:154-201` builds `WebAutomationActionCommand`: `selector`,
   `text`, `value`, `key`, `timeoutMs`, `element` (`:215-252`), plus the lifted structured fields from
   `domain/src/client/gateway-action-parameters.ts:70-104`. A required field it cannot read refuses the command
   (`INVALID_PARAMETER`).
5. **Extension.** `E/actions/execute.ts:134-152` wraps every verb in `runWithRecovery` (`E/action-runtime/recovery/`,
   about 5 s). The recovery loop waits out `target_absent` for every verb. It clears covering layers for covered or
   hidden refusals, and for disabled refusals only when `refusedBeforeDispatch` is set. Routing is at
   `execute.ts:180-234`.
6. **Common runtime.**
   - `resolveTarget`: `E/action-runtime/resolve-target.ts:252`.
   - `checkActionability`: `E/action-runtime/actionability.ts:41`. It checks visible, then enabled, then scrolls
     to centre, then hit-tests the centre point.
   - `dispatchClickGesture`: `E/action-runtime/click-gesture.ts:22`.
   - The keyboard: `E/action-runtime/keyboard/`.
   - Results: `E/action-runtime/results.ts`.

**All input is synthetic.** Every event has `isTrusted: false`. The manifest
(`apps/extension/manifest.chrome.json:17-26`) has no `debugger` permission, and nothing calls `chrome.debugger`
(**Read**). Every gap below that says "needs a trusted event" comes from this one design choice. Section 5,
item T1, proposes the strategic fix.

## 2. Per-node findings

### 2.1 click (`web.output.dom-click`, `E/actions/click.ts`)

**Contract.** Parameters: `selector` (required), `element`, `visualTarget`, `target`, `timeoutMs` (default 10 000),
`expectedState`.

| Outcome | When |
| --- | --- |
| `success` | the hit test passed, or for a link, the navigation began or an in-place effect was seen within 5 s |
| `failed` / `TARGET_NOT_FOUND` | no target resolved |
| `failed` / `TARGET_AMBIGUOUS` | several targets tied |
| `failed` / `TARGET_NOT_SHOWN` | the target is hidden |
| `failed` / `TARGET_NOT_ACTIONABLE` | the target is disabled or covered |
| `failed` / `BLOCKED_BY_DIALOG` | a dismissible dialog stands over the target |
| `failed` / `USER_INTERVENTION_REQUIRED` | a robot check, credential or payment challenge is open |
| `failed` / `RATE_LIMITED` | the page said the press came too fast or it is busy |
| `failed` / `REFUSED_BY_PAGE` | the page said it needs something first ("Please select a Color.") |
| `failed` / `OUTPUT_NOT_OBSERVED` | a dead link, or a command control the page ignored twice |

Consequences: mutating. A non-link press that got no answer at all is pressed once more (`click.ts:166-189`).

**Tests.**
- Unit: `E/actions/tests/click.test.ts` (about 30 cases): link in-place and history handling, rate-limit, robot
  check, press-again, refused-by-page.
- e2e: `click.spec.ts` (gesture order, hit point, disabled, covered and hidden refusals, links); `press-answers.spec.ts`;
  `dialog-dismissal.spec.ts`; `shadow-root-controls.spec.ts`; `actionability-gate.spec.ts`.
- Background: `src/runtime/tests/click-landing.test.ts` (25 cases: 404 or 403 landings, robot check after navigation).
- Not tested: hover-dependent controls, double-click or right-click, a press inside a cross-origin iframe, a target
  covered by its own label, an element animating while pressed, a popup opened by `target=_blank` under the popup
  blocker, a press that opened an unarmed native `confirm()`.

**Live failures** (Explore sweep, spot-checked).
- First Add to cart swallowed on bigbox. Fixed by press-again.
- Press reported success with no effect (`D/run-munv9eqy-1827b928.md:69`). Partly fixed by F37.
- Press on plain store-card text, not the "Set as my store" button, returned success while the page was
  byte-identical. Core then counted the act done (`D/run-muxkyfxz-446c3a4e.md:26`,
  `docs/working/mvp-final-month-plan/reports/live-b.md:7,140`).
- "Please select a Color." read as an ignored press (`D/run-muqk4u32-0b36e58f.md:258`). Fixed by `refused_by_page`.
- A click that reloads its own page refused and dropped from the Flow (t193-wJ). Partly fixed.
- Toggle swatch pressed while already chosen, which un-chose it (`D/run-muqk4u32-0b36e58f.md:257`,
  `D/run-mux6n7m4-8273e7a0.md:139-151`). Partly fixed. The root cause is that click has no idempotent
  "make chosen" form (see 2.4 and N2).

**Bugs.**
- **C-1.** A press on a non-control that the page ignored twice passes as `succeeded`, with only the "pressed once
  more" phrase as a hint (`click.ts:185-188`, `expectsAnswer` at `click.ts:357`). The page view then reported
  `pageChanged: true` for a scroll-only change (live-b.md:144), so the model and Core read it as an act.
  - Fix: on a press where neither attempt was answered, keep `passed` but set a closed `answered: false` (or
    `effect: "none_observed"`) field the domain can read. The node-run result should then say "nothing on the page
    answered this press".
  - Tests: unit `click.test.ts` row "a press on plain text ignored twice states that nothing answered it"; domain
    `node-run` test that such a result is not an act.
- **C-2.** Events are dispatched on the resolved element, not on the deepest element at the hit point
  (`click-gesture.ts:41-54`). A listener bound on an inner node (`<button><span onClick>`) never fires. A real
  browser targets the hit node and bubbles. **Reasoned.** Fix: dispatch on the `hit` from the actionability report
  when it is inside the target. Test: e2e fixture with a handler on the inner span.
- **C-3.** `mouseenter` / `pointerenter` go only to the target (`click-gesture.ts:42,44`). A browser sends them to
  every ancestor the pointer enters. Menus that open on `mouseenter` of the parent `<li>` never see the pointer
  arrive. **Reasoned.** Fix: dispatch the enter pair down the composed ancestor chain. Test: e2e hover-menu fixture.

**Robustness gaps.**
- Only the centre point is hit-tested (`actionability.ts:122-130`). A badge or sticky bar over the centre refuses
  a control whose other half is free. Fix: try the probe points `interference/probe-points.ts` already has before
  refusing as `covered`.
- No stability check. A drawer or carousel still animating is hit-tested at a moving point.
  Fix: require the box to stay equal across two animation frames (bounded, about 100 ms) before the hit test.
- Opacity 0 counts as hidden (`actionability.ts:89`, and `checkVisibility({checkOpacity:true})` at `:96`). An
  opacity-0 element still receives clicks. Playwright treats it as visible. Common in the wild: a transparent
  native `<select>` over a styled box, or a transparent stretched link. Fix: an opacity-0 element is hidden only if
  the hit test does not land on it.
- **Covered by its own label.** When the hit lands on the target's associated `<label>`, or inside it, the press is
  refused as `covered` (`actionability.ts:63-70`). Pressing that label is exactly what a person does. Fix: accept a
  hit on `label.control === element` and press at the hit.
- Synthetic events are untrusted. Effects:
  - pure-CSS `:hover` menus never open;
  - sites that check `isTrusted` ignore the press;
  - `window.open` / `target=_blank` presses fall to the popup blocker;
  - no clipboard or fullscreen actions.
  See T1.
- No double-click, right-click (context menu), modifier-click (ctrl or cmd for a new tab), or click at an offset
  (slider track). See N4.

### 2.2 type (`web.output.dom-type`, `E/actions/type.ts`, `E/action-runtime/keyboard/`)

**Contract.** Parameters: `selector`, `text` (required; may be a secret binding, `schemas.ts:246`), `submit`
(boolean). It runs the actionability gate, refuses a target that cannot hold text, and deletes the field's content.
Each character then gets keydown, beforeinput, a native setter write, input, and keyup (`type-text.ts:20-30`),
followed by `change`. It reads the value back with strict equality (`type.ts:72-73`). `submit` presses Enter, which
calls `requestSubmit`. Without `submit`, the result names the unsent form (`type.ts:120-127`).

**Tests.**
- e2e `keyboard.spec.ts`: event order, replaces existing text, read-only field, contenteditable, combobox filtered
  per keystroke, disabled field.
- e2e `actions.spec.ts`: type, and type with submit.
- Unit `type-unsent-form.test.ts`.
- Not tested: number, date, time or month inputs; masked fields; maxlength; rich-text editors (ProseMirror,
  Lexical, Quill); a handle on a label or wrapper; blur-triggered validation; React-controlled textarea.

**Live failures.**
- Typing did not send the search form, and the result did not say so. Fixed (unsent-form text, `submit`).
- Quantity typing became an unrun step (`D/run-mux74k5q-1c3c2127.md:40-56`). That is a Core and domain draft
  issue, not the verb.
- Invented selectors refused `target_not_a_handle`.
- Typing under a consent wall was covered. That is the interference loop.

**Bugs.**
- **T-1. Value-sanitised input types lose characters.** `insertIntoField` writes the partial string after every
  character (`text-edits.ts:64-73`). For `type=number`, `"1."` and `"-"` are invalid and sanitise to `""`, so
  `"1.5"` ends as `"5"` and `"-3"` as `"3"`. For `date`, `time`, `month`, `week` and `datetime-local`, every partial
  string is invalid, so the field ends empty. The read-back then fails `OUTPUT_NOT_OBSERVED`, which is retryable, so
  it is retried for nothing. **Reasoned** from the HTML value-sanitisation algorithm.
  - Fix: for these types (and `range`, `color` via set-value), dispatch the key events per character but write the
    whole value once through the native setter, then send input and change. Refuse a value the type cannot hold,
    naming the format (`yyyy-mm-dd`).
  - Tests: e2e `keyboard.spec.ts` rows for number `"1.5"` and `"-3"`, date `"2026-10-07"`, and date
    `"10/07/2026"` (refused with the format named).
- **T-2. Masked or reformatted fields fail.** Strict read-back (`type.ts:73`) fails a field the page reformats:
  phone `(555) 123-4567`, card spacing, upper-casing, maxlength truncation.
  - Fix: on a mismatch, compare normalised forms (same digits; same letters case-folded). Pass with
    `actual: "the page reformatted it to …"`. Fail only when the content differs. Maxlength: type what fits and
    report the truncation as failed.
  - Tests: e2e fixture with a phone mask and a `maxlength=4` field.
- **T-3. Keyboard events are incomplete.**
  - No legacy `keypress` event is dispatched (`type-text.ts:25`). Older widgets (jQuery autocomplete,
    `onkeypress` Enter handlers) never react.
  - `shiftKey` is never set for upper-case or shifted characters.
  - Punctuation gets `keyCode = charCode` (`key-event.ts:69`): `.` reads as 46 (Delete) and `-` as 45 (Insert) to a
    keyCode reader.
  - Fix: dispatch `keypress` for printable characters and Enter; set `shiftKey`; map punctuation to the US-layout
    `code`/`keyCode` (Period 190, Minus 189, and so on).
  - Tests: unit for `key-event.ts`; e2e with a keypress-listening fixture.
- **T-4. Rich-text editors are corrupted.** For a contenteditable host, `deleteAllContent` calls
  `element.replaceChildren()` (`text-edits.ts:39-41`), which destroys the editor's own block structure
  (ProseMirror `<p>`). `insertIntoHost` appends text nodes outside the editor's model. The read-back of
  `textContent` (`type.ts:109`) passes even when the editor's state, and so what it submits, never changed.
  **Reasoned.**
  - Fix: route editor hosts through a select-all plus `beforeinput` (`insertText` / `deleteContentBackward`)
    sequence the editor handles. Better, use trusted `Input.insertText` (T1). Read back from the editor's rendered
    text after a frame.
  - Tests: e2e fixtures with a minimal ProseMirror-like and Lexical-like editor that ignore direct DOM mutation.
- **T-5. No retargeting.** A handle on a `<label>`, a wrapper `div`, or a custom field's shell fails "holds no typed
  text" (`type.ts:61`, `holdsText` at `:100`).
  - Fix: retarget to `label.control`, or to the single editable descendant (or the single editable inside the
    nearest `[role=combobox]`/`[role=textbox]`). Report the retarget in `actual`.
  - Tests: unit rows in a new `type.test.ts`; e2e with a label handle.

**Robustness gaps.**
- No blur or Tab after typing, so blur-time validation and autosave never run.
- The field is focused with `focus()`, not pressed, so a widget that activates on mousedown (some date pickers,
  react-select) stays closed.
- `submit` on a field outside any form reports `held: true` ("the page receives the Enter key") and does not verify
  that anything happened (`press-key.ts:90-98`). The page's own Enter listener may still act.

### 2.3 select (`web.output.dom-select`, `E/actions/select.ts`)

**Contract.** Parameters: `selector`; `value` (legacy) or `option: {by: value|label|index}`. The target must be a
native `<select>`. The option must exist and be enabled. The verb sets `selectedIndex`, sends input and change, and
reads back `value`.

**Tests.** e2e `select.spec.ts` (12 rows: by value, label and index; missing option; non-select; disabled select;
hidden select; disabled option) and `actions.spec.ts`. Not tested: an opacity-0 styled select, `multiple`, an
option handle, partial or case-different labels, `value` carrying a label.

**Live failures.**
- `dom-select` on the bigbox store chooser's buttons was refused `handle_wrong_kind_of_control` five times and the
  store never switched (`D/run-munnq7vz-98c3481c.md:74-112,168`). The refusal now names `dom-click` (t193-wA).
- Image-only swatches had no chosen state (t229).
- The model invented select entries in amendments (`D/run-mut4fvkm-e2fc03e6.md:103`).

**Bugs.**
- **S-1. A transparent styled select is refused as hidden.** Opacity 0 is hidden (see 2.1), so the common
  transparent native select is refused `hidden` (`select.ts:65-68`). The fix is the opacity rule in 2.1. Test: e2e
  opacity-0 select over a styled span.
- **S-2. Strict matching.** Label matching is exact after whitespace normalisation (`select.ts:151-153`). `value`
  never falls back to label (`:150`), and models write `value: "Large"` where the option's value is `L`.
  - Fix: try value, then exact label, then case-insensitive label, then a unique label prefix or containment.
    Report which rule matched. Two candidates fail with both named.
  - Tests: e2e rows "value naming a label", "Large matches 'Large (+$2)' uniquely", "ambiguous partial label fails
    listing both".
- **S-3. Wrong target element.** An `<option>` handle, or a `<label for=select>` handle, is refused as "not a
  select". Fix: retarget to `option.parentElement` (choosing that option) or to `label.control`.

**Robustness gaps.**
- No multi-select (`multiple`): choosing one option silently deselects the others.
- No custom listbox or combobox, which is most real sites (see N1).
- No wait for options that load after a parent choice (country, then state). The recovery loop only waits for a
  target that is absent, not for an option that is absent.
  - Fix: when the option is missing and the select is `aria-busy` or its option count changes, wait inside the
    command's timeout.

### 2.4 check (`web.output.dom-check`, `E/actions/check.ts`, `E/action-runtime/checkable-state.ts`)

**Contract.** Parameters: `selector`, `checked` (default true). The target must be a native checkbox or radio. If
the control itself is refused as hidden, the gate is retried on its label (`check.ts:80-85`). The verb then sets the
`checked` property and sends input and change (`checkable-state.ts:43-48`). Unchecking a radio is refused.

**Tests.** e2e `check-assert.spec.ts` (5 rows); `actionability-gate.spec.ts` (behind a scrim);
`gate-refusal.test.ts`. Not tested: ARIA checkboxes, switches or radios; React-controlled inputs; a label or
wrapper handle; a clipped visually-hidden input; pill or chip choosers.

**Live failures.** The "Pay at pickup" radio was named without a handle (`target_not_a_handle`), costing up to 7
decisions per run and never set in some runs (`D/run-munovwp3-d898de74.md:130-145`, `run-munvz5x0`, `run-munzrj6r`,
`run-muny5y17`). Its cause is in the domain refusal and the page view, but N2 below would let a label handle work.

**Bugs.**
- **K-1. Framework state is not updated.** Setting `.checked` and dispatching `change` (`checkable-state.ts:43-48`)
  does not fire React's `onChange` for checkboxes and radios, because React listens to `click` for those. React's
  value tracker also absorbs the property write. The read-back then reports `checked` while the app's state is
  unchanged, which is a false success. **Reasoned** (React ChangeEventPlugin behaviour). The Lab fixtures are
  vanilla, so it has not shown live.
  - Fix: when the state differs, press the control with the click gesture (or press its label when the input is
    out of sight). A dispatched `click` runs the checkbox's activation behaviour. Then read back. Keep the property
    write only as a fallback when the press changed nothing, and say so.
  - Test: e2e fixture with a React-style click-only listener and a value tracker; assert the app state changed.
- **K-2. ARIA controls are refused.** `role=checkbox|switch|radio|menuitemcheckbox|menuitemradio` and toggle
  buttons (`aria-pressed`) are refused `not_checkable` (`checkable-state.ts:30-33`).
  - Fix: read `aria-checked`/`aria-pressed`, press when it differs, and read back.
  - Tests: e2e rows for a Radix-style switch and a `button[aria-pressed]` chip.
- **K-3. The label retry only covers hidden.** It does not run for `covered` (`check.ts:82`). A clipped 1x1 input is
  hit-tested onto its own styled span and refused `covered`. Fix: also retry on the label when the hit lands inside
  that label or its styled sibling.
- **K-4. A label or wrapper handle is refused** `not_checkable`. Fix: retarget to `label.control`, or to the one
  checkbox or radio inside the wrapper.

### 2.5 clear (`web.output.dom-clear`, `E/actions/clear.ts`)

**Contract.** Parameter: `selector`. The target must be an input or textarea. The verb sets the value to `""` with
the native setter, sends input and change, and reads back.

**Tests.** e2e `keyboard.spec.ts` (clear; disabled) and `actions.spec.ts`. Not tested: a read-only field,
contenteditable, a field the page refills.

**Live failures.** None of the verb itself. Week 2: a planner built Flows of a lone clear, which is fixed in
ranking (`docs/working/mvp-week2-automation-loop-plan/reports/w2-live-creation-debug.md:78-90`).

**Bugs.**
- **L-1. Writes into read-only fields.** clear writes into a `readOnly` field and reports passed (`clear.ts:51-53`).
  type refuses that case (`text-edits.ts:51-53`). Fix: refuse `readonly` as type does. Test: e2e row.
- **L-2. Not waited out when disabled.** The disabled gate refusal omits `refusedBeforeDispatch: true`
  (`clear.ts:39`), so recovery never waits out a briefly disabled field. Fix: add it, and extend the
  `gate-refusal.test.ts` table to clear.
- **L-3. Wrong events.** It sends `input` with `inputType: "insertText"` for a deletion and no `beforeinput`
  (`input-events.ts:3-6`). Fix: reuse `deleteAllContent` from the keyboard.
- **L-4. No contenteditable support,** unlike type. Fix: same path as type's host branch.

### 2.6 keypress (`web.output.dom-keypress`, `E/actions/keypress.ts`, `keyboard/press-key.ts`)

**Contract.** Parameters: `key` (or `text`), `modifiers`, and an optional `selector`. The schema does not require
it, so the node has no element target and no loop `item` port (`schemas.ts:272`). Without a selector the key goes
to the focused element. The verb emulates defaults:
- Enter: `requestSubmit` in a text field, or a newline in a textarea or editable host.
- Tab: moves focus.
- A printable character: inserted.
- Arrow keys on a radio or select, and Space on a checkbox or button: rejected `unsupported_key`.

**Tests.** e2e `keyboard.spec.ts` (Tab, modifiers, Enter submit W02, combobox W03, radio arrows unsupported,
disabled) and `actions.spec.ts` (Enter submits).

**Live failures.** Enter-to-search landing on a robot check stood as success (`D/run-muqbzqtu-4e6299f9.md:43`).
The fix is ready to commit. No live task drives a combobox by key (scenario-inventory.md:608).

**Bugs.**
- **P-1. Enter does not activate buttons or links.** Enter on a focused `<button>`, `a[href]` or `summary` does
  nothing and reports `held: true` (`press-key.ts:79-98`). A trusted Enter activates them. Fix: emulate with the
  click gesture on button, link and summary. Test: e2e Enter on a focused button submits.
- **P-2. Backspace and Delete are no-ops.** In a text field they fall through to "no default action on this target",
  `held: true` (`press-key.ts:64-77`). Fix: emulate `deleteContentBackward`/`Forward` at the caret, and
  ArrowLeft/Right, Home and End caret moves. Test: e2e Backspace in a field removes one character.
- **P-3. Wrong submission path.** Implicit submission calls `form.requestSubmit(submitter)` (`implicit-submission.ts:49`).
  The HTML spec instead fires a synthetic `click` at the default button. Sites whose logic is in the submit
  button's `onClick` (with `preventDefault`) never run it, and the form posts natively instead. **Reasoned.** Fix:
  dispatch a click on the default button when there is one; keep `requestSubmit()` for the single-field,
  no-button case. Test: e2e fixture with click-only submit logic.
- **P-4. Emulable keys refused.** The unsupported refusals cover cases that can be emulated honestly:
  - Space on a button or checkbox: the click gesture.
  - Arrow keys in a radio group: check the next radio and send input and change.
  - Arrow keys on a select: step `selectedIndex` and send input and change.

  Fix: emulate each, keeping the read-back. Test: invert the e2e row "radio arrows reported unsupported".
- **P-5. No native Escape.** Escape has no native default: an open modal `<dialog>` (cancel, then close) and an
  open `[popover]` stay open. Fix: emulate when the page did not cancel the key. Test: e2e with a native dialog.
- **P-6. Fingerprint-only targets ignored.** `named = Boolean(action.selector)` (`keypress.ts:27`) means a command
  carrying only an element fingerprint ignores it. The gate refusal also omits `refusedBeforeDispatch`
  (`keypress.ts:42`). Fix both.

### 2.7 upload (`web.output.dom-upload`, `E/actions/upload.ts`, `E/action-runtime/file-input.ts`)

**Contract.** Parameters: `selector`, `upload: {files: [{name, mimeType, contentBase64}]}`, with a 1 MiB per-file
and 4 MiB total bound (`file-input.ts:21-22`, domain twin). Recorded steps bind the files at run time
(`output-nodes/upload-binding.ts`). The verb refuses a disabled or inert input, assigns a `DataTransfer`, sends
input and change, and reads back the file names.

**Tests.** Unit `upload.test.ts` (8 rows). e2e `upload-dialog.spec.ts` (4 rows) and `actionability-gate.spec.ts`
(hidden, disabled and inert inputs).

**Live failures.** Never exercised live: no live task uses upload (`reports/scenario-inventory.md:607`).

**Bugs and gaps.**
- **U-1. The handle must be the file input.** A handle on the visible "Upload" button, the `<label>`, or a drop zone
  is refused `upload_rejected` "not a file input" (`file-input.ts:36-38`). A model is usually shown the button, not
  the hidden input.
  - Fix: retarget to `label.control`, or to the one `input[type=file]` inside the target's nearest form or region.
    For a drop zone with no input, dispatch dragenter, dragover and drop with the `DataTransfer`.
  - Tests: e2e rows for a label handle, a button handle and a drop zone.
- **U-2. Inputs made on click are unreachable.** Some uploaders create the file input when the button is pressed
  and call `.click()`, so nothing exists to assign to. Fix: a page-world hook on `HTMLInputElement.prototype.click`
  and `showPicker` that records the input, or `Page.setInterceptFileChooserDialog` under T1.
- **U-3. Constraints unchecked.** `accept` is not checked (the page silently rejects a mismatched type), and the
  1 MiB limit is below a typical resume PDF or photo.
- **U-4. Not waited out when disabled.** The gate's disabled refusal omits `refusedBeforeDispatch` (`upload.ts:38`).

### 2.8 dialog (`web.output.dom-dialog`, `E/actions/dialog.ts`, `E/page-world/dialog-override.ts`)

**Contract.** Parameter: `dialog: {response: accept|dismiss, promptText?}`. It arms the answer to the next native
`alert`, `confirm` or `prompt` through the MAIN-world override (all frames, at `document_start`). It passes when the
page world acknowledges the arming. No selector and no item port.

**Tests.** Unit `dialog.test.ts` (5 rows). e2e `upload-dialog.spec.ts` (4 rows: armed dismiss, armed accept,
prompt length, no request).

**Live failures.** The node never appears in a live run. Every live "dialog" was a page layer, handled by the
interference loop.

**Bugs.**
- **G-1. An unarmed native dialog hangs the run.** The override calls the native dialog (`dialog-override.ts:84-94`).
  `alert`/`confirm` then block the renderer's main thread, so the content script is blocked inside
  `dispatchClickGesture` and the click command ends only at its timeout. TIMEOUT is retryable, and only a person
  can unstick the tab. A model has to foresee every confirm. **Reasoned.**
  - Fix: while an automation command is in flight in that tab, answer unarmed dialogs by policy instead of
    blocking. Auto-accept `alert`. Auto-dismiss `confirm` and `prompt`, since dismissing is the safe default.
    Record the dialog, and put it on the press's result: "the press opened a confirm 'Delete this item?', which was
    dismissed because no answer was armed; arm web.dom.dialog accept before the press".
  - Tests: e2e "a click that opens an unarmed confirm returns within 1 s and names the dialog"; unit on the override.
- **G-2. The triggering press does not report the dialog.** The handled dialog is carried only on the dialog verb's
  own later result (`dialog.ts:41`); click, keypress and type results never carry it. Fix: read
  `dialogControl.observed()` around every mutating verb and attach the dialogs handled during it.
- **G-3. Arming is stale or lost.**
  - An arming never expires (`takeArmed`, `dialog-override.ts:58`). An unused arming answers some unrelated later
    dialog.
  - An arming is lost when the page navigates before the dialog opens.
  - An arming in the top frame does not cover a dialog from a child frame unless `frameId` is set.

  Fix: expire the arming at the end of the next mutating command (report "armed answer not used"). Arm in every
  frame of the tab. Re-arm on the next document when a navigation is in flight.

### 2.9 scroll (`web.output.dom-scroll`, `E/actions/scroll.ts`)

**Contract.** Parameters: optional `selector`; `scroll: {mode: by|toElement|untilStable, x, y, maxScrolls}`; legacy
`x`/`y`/`smooth`. Effect is observe. `by` and the legacy form scroll the **window**; `toElement` scrolls the target
into view; `untilStable` scrolls the window to the bottom until `documentElement.scrollHeight` stops growing
(900 ms window).

**Tests.** e2e `scroll.spec.ts` (6 rows, all window scrolling) and `actionability-gate.spec.ts` (covered target).

**Live failures.** The only live scroll was one scroll on an infinite feed; it captured a quarter of the rows and
was reported passed (`docs/working/mvp-week2-automation-loop-plan/reports/w2-live-create-c.md:128-131`). That was a
Flow-shape error, but see SC-1.

**Bugs.**
- **SC-1. Inner scrollers report a false pass.** Only the window scrolls (`scroll.ts:94,141`). On an app whose
  scroller is an inner element (SPA layouts, chat panes, sidebars, modals, data grids), the document cannot scroll:
  - `by` clamps its target to 0 and reports `passed` with nothing moved (`scroll.ts:79,171-177`);
  - `untilStable` reports "the document stopped growing" after one pass (`scroll.ts:150`), which tells the Flow a
    feed is exhausted when it never moved.

  Fix:
  - With a selector, scroll that element's nearest scrollable ancestor-or-self.
  - Without one, scroll the window, or when the window cannot scroll, the largest visible scrollable element.
  - Fail `by` when movement was requested, none happened, and the scroller was not already at its limit.
  - Measure growth on the scroller's `scrollHeight`.

  Tests: e2e fixture with an `overflow:auto` feed: `by` moves it, and `untilStable` loads every post.
- **SC-2. The selector is ignored in `by` mode** (`scroll.ts:77-84`) although the schema accepts it. Fix as SC-1.
- **SC-3. `untilStable` settles too early on slow loaders.** It uses a fixed 900 ms growth window
  (`scroll.ts:57`) and measures document height only. That misses a loader slower than 900 ms and virtualised
  lists, whose height stays constant. Fix: also count new descendant items (or watch a MutationObserver), and allow
  `stableForMs` as the wait already does.
- **SC-4. Default parameters can scroll to the top.** The node declares `x` and `y` defaults of 0
  (`definitions.ts:291-292`). A node with no `scroll` request and default-filled `x`/`y` scrolls to the top.
  Fix: drop the defaults, or ignore the legacy absolute form when both are default.
- **SC-5. No wheel events.** Pages that load or scroll-jack on `wheel` never react. Fix: dispatch `wheel` before
  each programmatic scroll.

### 2.10 Target resolution (`E/action-runtime/resolve-target.ts`, `E/element-finder.ts`, `E/identity/`)

**Contract.**
- Exact strategies, in order: selector, coordinates, visual target, fingerprint (stable signals, then the
  accessible name for role-less targets, then text).
- Each is gated on visible, enabled and the recorded tag, and counted only in the recorded record (row or card).
- The identity veto (`identity/veto.ts`) and the stable-name reading guard a single match.
- Level 2 scores the family through Core's matcher.
- Failures: TARGET_NOT_FOUND or TARGET_AMBIGUOUS, carrying a measurement.
- An open-shadow-root widening runs when the document misses.

**Tests.**
- Unit: `resolve-target.test.ts` (11), `wrong-row-resolution.test.ts` (3), and the `identity/tests/*` (10 files).
- e2e: `resolve-target.spec.ts` (10), `identity-resolution.spec.ts` (17), shadow roots.
- Well covered for drift and twins. Not tested: an invalid selector, a page with more than 60 same-family
  controls before the target, `"` inside a test id, an empty selector.

**Live failures.**
- A title-named swatch was never re-found (F1). Fixed by the name scan at `resolve-target.ts:498-501`.
- A state-named chip was vetoed, or thrown ambiguous with one leader (t193-wJ P2, still open).
- A state-labelled "Added" button was vetoed (`D/run-muny76m9-bab4e6ba.md:68`).
- Unstable handles. Fixed by t223.
- In the armed variant, resolution was not the cause; the moved Add to cart resolved at 0.643.

**Bugs.**
- **R-1. Focused-element fallback for every verb.** When no strategy is supplied (including an empty `selector: ""`
  plus no fingerprint), every verb falls back to `document.activeElement`, usually `<body>` (`resolve-target.ts:352-355`).
  A click then presses `<body>` and passes its hit test. Fix: allow the fallback only for keypress (and type with an
  explicit "focused" flag). Elsewhere fail TARGET_NOT_FOUND "the command named no target". Test: unit row.
- **R-2. Invalid selectors read as not found.** An invalid selector (`button:contains('Add')`, `:has-text()`) is
  swallowed as an ordinary miss (`resolve-target.ts:752-760`, `element-finder.ts:129-132`). The model is told
  "nothing matched" rather than "this is not CSS". Fix: report `INVALID_PARAMETER` "the selector is not valid CSS"
  when the selector strategy alone threw a SyntaxError and nothing else resolved. Test: unit row.
- **R-3. Scoring cap of 60.** `MAX_CANDIDATES = 60` in document order (`identity/candidates.ts:106-108`). On a
  search-results page with 200 links, a drifted target after the sixtieth link is never weighed, although the
  comment claims "extra rows cannot change which one wins". Fix: pre-filter the family on a cheap signal the
  recording carries (name or text token overlap, test id, href path) before applying the cap. Test: unit row with
  the target at position 120.
- **R-4. Quote escaping.** `cssString` double-escapes `"` (`element-finder.ts:140`). `CSS.escape` already escapes it,
  and the extra `replace` breaks the selector, so a test id or name containing a quote never matches. Fix: drop the
  `replace`. Test: unit row.
- **R-5. Text fallback is brittle.**
  - It compares `textContent` (which includes hidden text and `<script>`/`<style>` text) for whole-string equality
    (`resolve-target.ts:503-505`).
  - Its scan is capped at 2 000 elements of the tag, or of `*` when no tag was recorded (`:199,509-520`).
  - Fix: compare the rendered or accessible text (the module `composed-rendered-text.ts` exists), and report
    truncation as the family scan does.
- **R-6. No "label → control" or "text → enclosing control" step.** A handle on the words of a control (a span
  inside a button, the text of a card) resolves to the text node's element. That element is pressed, and no
  command control is found for the "expects an answer" rule. Fix: in click, when the target is not interactive but
  has exactly one interactive ancestor within its record, press that ancestor and say so. This is the
  store-card-text press in live-b.

## 3. Ranked fixes (fix or extend existing nodes)

Ranked by expected live impact (real-site breadth multiplied by how silently it fails), then by cost. Each row
names the tests that prove it. Files are disjoint where noted, so rows can be partitioned.

| # | Fix | Files | Proving tests |
| --- | --- | --- | --- |
| 1 | G-1 + G-2: unarmed native dialogs answered by policy during automation; triggering press reports the dialog | `E/page-world/dialog-override.ts`, `E/shared/dialog-channel.ts`, `E/action-runtime/dialog-control.ts`, `E/action-runtime/results.ts` | e2e: unarmed confirm on click returns in <1 s, dismissed, named on the click result; unit on override |
| 2 | K-1 + K-2 + K-4: check presses instead of property-setting; ARIA checkbox, switch, radio and pressed-chip support; label or wrapper retarget | `E/action-runtime/checkable-state.ts`, `E/actions/check.ts`, domain `resolve-plan-node.ts` (stop refusing role=checkbox for check) | e2e: React-style click-only checkbox updates app state; Radix switch; `aria-pressed` chip idempotent; label handle |
| 3 | T-1: sanitised input types (number, date, time, month, week, datetime-local) typed as whole values; format refusal | `E/action-runtime/keyboard/text-edits.ts`, `type-text.ts` | e2e: number `1.5` and `-3`, date ISO, date in the wrong format refused with the format named |
| 4 | SC-1 + SC-2 + SC-3: scroll the real scroller; fail a `by` that moved nothing; growth by scroller and items | `E/actions/scroll.ts` (+ a small `scroll-container.ts` helper) | e2e: overflow feed `by` and `untilStable`; virtualised list; window case unchanged |
| 5 | C-1 + R-6: a press nothing answered states `answered:false`; text inside a control presses the control | `E/actions/click.ts`, `E/action-runtime/results.ts`, domain `node-run/outcome.ts` | unit `click.test.ts`; domain node-run test that it is not an act; e2e store-card text |
| 6 | Opacity-0 and covered-by-own-label rules in the gate; multi-point probe; two-frame stability | `E/action-runtime/actionability.ts` | e2e: transparent select, clipped checkbox, centre covered by a badge, animating drawer |
| 7 | T-5 + S-3 + U-1: retarget label, wrapper, option or button to the real control (one shared `retarget-control.ts`) | new `E/action-runtime/retarget-control.ts`; `type.ts`, `select.ts`, `upload.ts` | e2e: label handle types; option handle selects; upload button handle uploads; drop zone |
| 8 | S-2: forgiving option matching with a uniqueness rule | `E/actions/select.ts` | e2e rows in `select.spec.ts` |
| 9 | P-1..P-5: Enter activates buttons and links; Backspace/Delete/caret keys; implicit submission clicks the default button; Space and arrows emulated; Escape closes a native dialog or popover | `E/action-runtime/keyboard/*` | e2e `keyboard.spec.ts` rows (invert the "unsupported" row) |
| 10 | T-3: legacy `keypress`, `shiftKey`, punctuation codes | `keyboard/key-event.ts`, `type-text.ts` | unit `key-event`; e2e keypress-listener fixture |
| 11 | T-2: masked or reformatted read-back; maxlength honesty | `E/actions/type.ts` | e2e phone mask, maxlength |
| 12 | R-1, R-2, R-4: activeElement fallback only for keypress; invalid-CSS refusal; quote escaping | `resolve-target.ts`, `element-finder.ts` | unit rows in `resolve-target.test.ts` |
| 13 | R-3: pre-filter before the 60-candidate cap | `E/identity/candidates.ts` | unit: target at position 120 |
| 14 | L-1..L-4, P-6, U-4: clear refuses read-only and uses delete events; `refusedBeforeDispatch` on clear, keypress and upload gate refusals | `clear.ts`, `keypress.ts`, `upload.ts` | extend `gate-refusal.test.ts` table; e2e read-only clear |
| 15 | C-2 + C-3: dispatch at the hit node; enter events down the ancestor chain | `click-gesture.ts` | e2e inner-span handler; parent `mouseenter` menu |
| 16 | T-4: rich-text editor typing via beforeinput, or trusted input | `keyboard/text-edits.ts` | e2e ProseMirror-like and Lexical-like fixtures |
| 17 | G-3: arming expiry, every frame, survives navigation | `dialog-override.ts`, `dialog-control.ts`, background routing | e2e: stale arm reported unused; confirm on the next page answered |
| 18 | SC-4, SC-5: drop the x/y defaults; wheel events | `definitions.ts`, `scroll.ts` | domain `definitions.test.ts`; e2e wheel-loader |

## 4. New nodes proposed for this family

Each node is a schema row in `domain/src/actions/schemas.ts` (plus `definitions.ts` parameters, the effect table,
the gateway reader, an `E/actions/<verb>.ts`, and an `execute.ts` route), so it reaches the model through
`runsNodes` with nothing else to edit.

**N1. `web.dom.choose` ("Choose Option", mutate).**
- Parameters: `selector` (the trigger: a native select, `[role=combobox]`, a listbox button, or the group of a chip
  or radio set), `option: {label | value | index}`, `timeoutMs`.
- Behaviour: a native select uses the select path. Otherwise the node:
  - presses the trigger, or focuses it and types the label when it is an editable combobox;
  - waits for `[role=listbox]`/`[role=menu]` (or the `aria-controls` target) to appear;
  - presses the option whose accessible name matches (exact, then unique partial);
  - verifies the trigger's displayed value, `aria-activedescendant` or `aria-selected` now names it.
  For a chip or radio group it presses the matching child and verifies `aria-checked`/`aria-pressed`/`marked`.
- Outcomes: `success`; `failed` with `OUTPUT_NOT_OBSERVED` (no option or not kept, listing up to 20 options);
  `TARGET_AMBIGUOUS`.
- Live case it closes: the bigbox store chooser picked by `dom-select` five times. Also autocomplete pick lists
  (the gaps lead owns task ranking).
- Tests: e2e react-select-like, headless-UI listbox, ARIA combobox with async options, chip group; unit option
  matching.

**N2. `web.dom.set_state` ("Make Chosen / Set Toggle", mutate).**
- Parameters: `selector`, `state: on | off`.
- Generalises check to any toggle: native checkbox or radio, ARIA checkbox, switch or radio, an `aria-pressed`
  button, a `details`/`summary` open state, an `aria-expanded` disclosure, and a swatch drawn `marked`.
- Reads the current state, presses only when it differs, and verifies.
- Live case it closes: the swatch un-chose itself because a press toggles (F1); the Pay at pickup radio.
- Could be folded into check (rename the node label "Set State") rather than added. Recommended: extend
  `web.dom.check` and give its description these kinds.

**N3. `web.dom.hover` ("Hover", observe-ish, declared `mutate` because it can open a layer).**
- Parameters: `selector`, `holdMs`.
- Behaviour: pointer enter and move down the ancestor chain to the target, kept until the next command (no leave
  events). Verifies a newly visible element appeared in the target's region or `aria-expanded` turned true.
- Needed for hover menus and tooltips. Pure-CSS `:hover` needs trusted input (T1), and the node must say
  `unsupported_without_trusted_input` when nothing appeared and the page has `:hover` rules on the target chain.
- Tests: e2e JS hover menu; CSS hover menu (expected unsupported until T1).

**N4. Click variants as parameters of `web.dom.click`, not new nodes.**
- `button: left|right|middle`, `count: 1|2` (double-click), `modifiers` (ctrl/meta for a new tab, shift for a
  range), `offset: {x, y}` as a fraction of the box (for slider tracks and canvas).
- Tests: e2e dblclick-to-edit cell, context-menu fixture, click at 75% of a range track.

**N5. `web.dom.set_value` ("Set Value", mutate).**
- Parameters: `selector`, `value`.
- For controls a person sets rather than types: `range`, `color`, `date`/`time` family. A custom slider with
  `role=slider` is driven by arrow keys or End/Home until `aria-valuenow` equals the value.
- Writes the whole value through the native setter with input and change, and verifies.
- Tests: native range, ARIA slider, date input.

**N6. `web.dom.focus` / blur (mutate, small).**
- Parameters: `selector`, `blur: boolean`.
- Puts focus where a person's Tab or click would, or leaves a field so blur-time validation and autosave run.
- Pairs with keypress (which goes to the focused element).

**N7. `web.dom.drag` (owned by the gaps lead; noted for completeness).**
- Parameters: from `selector` to `selector` or an offset.
- Pointer down, moves, up, plus HTML5 `dragstart`/`dragover`/`drop` with a `DataTransfer`.

**N8 (alternative to G-1). `web.dom.dialog` gains `policy: "until_cleared"`.** The answer stays armed for every
dialog until the Flow re-arms or the run ends. That suits pages that confirm on every row of a loop.

## 5. Strategic item for the supervisor

**T1. Trusted input through `chrome.debugger` (Chrome/Edge only).** The family's deepest limits all share one root:
CSS hover, `isTrusted` checks, rich-text editors, date-field typing, native keyboard defaults, popup-blocked
`_blank` presses, unarmed native dialogs (`Page.handleJavaScriptDialog`), and file-chooser interception
(`Page.setInterceptFileChooserDialog` + `DOM.setFileInputFiles`). `Input.dispatchMouseEvent`, `dispatchKeyEvent` and
`insertText` produce trusted events.

Costs:
- the `debugger` permission;
- Chrome's "is debugging this browser" infobar;
- no Firefox equivalent, so the synthetic path stays as the fallback and the shared contract;
- every verb's emulation layer must still report honestly.

Recommendation: an escalation path, not the default. Use it after a synthetic press is ignored twice on a command
control, for hover, for unarmed dialogs, and for editor hosts. Put it behind a capability flag so Firefox stays
aligned. This crosses manifest, permissions and background architecture, so it needs a decision before stage
planning; it is not a lane-local fix.

## 6. Script fallbacks

The Explore sweep found no Lab run where a model-written script did an interaction (searches for script, evaluate,
run_script and javascript hit only harness and scenario source). The nearest substitutes were invented CSS
selectors (refused `target_not_a_handle`) and model-composed item URLs (later refused `address_not_shown`). So no
fix in this report is motivated by a script use. N1, N3 and N5 are where scripts would otherwise be written for
custom dropdowns, hover menus and sliders.

## 7. Not verified

- Every **Reasoned** item: K-1 (React checkbox `onChange`), T-1 (number and date sanitising), T-4 (editors),
  P-3 (submission via click), G-1 (unarmed confirm blocks the content script), C-2 and C-3. Each needs its e2e
  fixture before or as part of the fix. No build, test, Lab or browser was run (read-only brief).
- Live-failure attributions come from an Explore sweep of the debugs and lane reports. Three were spot-checked
  (`run-mux6n7m4` F1, `w2-live-create-c.md:128`, `scenario-inventory.md:606-609`); the rest were not opened.
