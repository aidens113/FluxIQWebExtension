# Web Capabilities

This page is current-state design. It records what each browser capability
does in the working tree today, not what the plan intends, and it is updated
at the close of every Week 1 phase. It began as the capability matrix in the
[Week 1 action audit](../working/mvp-week1-web-automation-reliability-plan/reports/audit-actions.md)
(repository at `d848536`) and was last rewritten against source on 2026-09-11,
after Wave 2 of Phase 1.2 of the
[Week 1 plan](../working/mvp-week1-web-automation-reliability-plan.md). The
wire protocol and the recording path are described in the
[extension client architecture](extension-client.md).

## Reading The Matrix

Each row is one of the 24 capabilities in the 30-day plan's Phase 1.2 list.

| State | Meaning |
| --- | --- |
| Fully supported | Does what the capability names, for the scope the row states |
| Partially supported | Works for a stated subset; the rest is missing |
| Unreliable | Can complete as a no-op and still report `succeeded` |
| Unsupported | No action type, output node, input, or manifest output represents it |

**Outcome validated** says whether the action reads the page back and fails
when the expected outcome did not happen. Every result now carries a
`validation` the result builders require (decision D4), so a dash marks a row
whose verb only observes and therefore declares `validation: none` with the
reason `evidence-only`.

**Changed by (Phase 1.2)** names the step of Week 1 Phase 1.2 (Action
vocabulary and outcome validation) that changed the row, and what is left where
the row is still partial. Step 1 is the result validation model, step 2 the
actionability gate and trusted-input emulation, step 3 the seven new action
types, step 4 navigation and tab reuse, and step 6 this matrix. Phases 1.3
(Element identity), 1.4 (Browser state and evidence), and 1.5 (Explicit failure
taxonomy) change target resolution, result evidence, and failure reporting
across every row; the column does not repeat them.

Extension paths are relative to `apps/extension/src/`. Domain paths start
with `domain/src/`.

## Summary

| Measure | Of 24 |
| --- | --- |
| Fully supported | 14 |
| Partially supported | 10 |
| Unreliable | 0 |
| Unsupported | 0 |
| Represented (an action type, output node, or input exists) | 24 |
| Executed | 24 |
| Resulting browser state observed | 24 (navigate, tab, and download run in the worker and report the landed URL or file name, with no snapshot or element) |
| Outcome validated | 22 (the two extract rows only observe, and say so) |

No row can now complete as a no-op and still report `succeeded`: a failed
post-condition makes the result `failed` with Core's `output_not_observed`
(`content/action-runtime/validation-outcome.ts`).

## How An Action Runs

Eighteen action types are defined once, as `WEB_AUTOMATION_ACTION_TYPES` in
[`domain/src/actions/types.ts`](../../domain/src/actions/types.ts). Each one
becomes, by one mechanism and with no per-action exception, a parameter
schema (`domain/src/actions/schemas.ts`), an Automation Studio output node
`web.output.<suffix>` (`domain/src/output-nodes/definitions.ts`), a manifest
output (`domain/src/io/manifest-definitions.ts`), and a registered output
dispatched to the paired extension (`domain/src/io/gateway-output-dispatcher.ts`).

A gateway-issued action then runs as follows:

1. `server.execute_action` arrives at `background/connection/gateway-session.ts`,
   which maps it through `browserActionFromGatewayCommand`
   (`runtime/result-mapping.ts`) and the domain's
   `webAutomationActionFromGatewayCommand`
   ([`domain/src/client/gateway-mapping.ts`](../../domain/src/client/gateway-mapping.ts)).
   Every structured parameter — `option`, `scroll`, `wait`, `modifiers`,
   `checked`, `assert`, `extractList`, `upload`, `dialog`, `tab`, `download`,
   and the `browserTabId`/`browserFrameId` an action runs in — is read onto the
   command field the verb reads by `domain/src/client/gateway-action-parameters.ts`,
   which refuses a malformed value rather than coercing it. The raw parameters
   still travel in `options`.
2. `ExtensionRuntimeCommandRouter` (`runtime/command-router.ts`) hands it to
   `runBrowserActionCommand`
   ([`runtime/action-runner.ts`](../../apps/extension/src/runtime/action-runner.ts)).
   `web.browser.tab` and `web.browser.download` run there first, before any tab
   is resolved (`runtime/browser-tab.ts`, `runtime/browser-download.ts`);
   navigate runs there too, through `resolveAutomationTab`
   (`runtime/automation-tab.ts`). Every other action is sent to the tab's
   content script, in the frame the command named and otherwise in frame 0 with
   `topFrameOnly`, so a page of iframes cannot answer from whichever frame
   replies first.
3. The content script's `executeAction`
   (`content/action-runtime/execute-action.ts`) wires every page-side capability
   and passes the command to `executeContentAction`
   ([`content/actions/execute.ts`](../../apps/extension/src/content/actions/execute.ts)),
   which awaits one module per verb in `content/actions/`. A verb reaches the
   page only through a capability granted there, and cannot build a result
   itself, so it cannot report success without a validation.

An action is refused before it reaches the page when the tab's URL is one the
extension cannot drive — `unsupportedAutomationPageReason`
(`runtime/unsupported-page.ts`), read from the tab rather than from the
connection's last observation. The six observe-only verbs are exempt.

## Capability Matrix

| Capability | State | Outcome validated | Represented as | Owning files | Changed by (Phase 1.2) | Why this state |
| --- | --- | --- | --- | --- | --- | --- |
| Navigate | Fully supported | Yes | `web.browser.navigate` (parameters `url`, `newTab`); input `web.user.navigation_requested` (typed navigations only) | `runtime/action-runner.ts`, `runtime/automation-tab.ts`, `runtime/navigation-outcome.ts` | Step 4, landed | Reuses the remembered automation tab unless `newTab` or a named tab says otherwise, so a Flow's steps land on the page the previous step left. It waits for the tab to report `complete` and its URL to hold still for 1 s (20 s cap), then compares where the browser actually committed with what was asked for: an http→https upgrade, a `www.` prefix, a trailing slash, and a fragment are the same destination, a different host or path is not, and a query is compared only when the request carried one. A redirect to a login wall now fails with `navigation_unexpected`, and an unreadable URL is never counted as arrival. The worker-side result carries the landed URL but no title, element, or snapshot. |
| Click | Fully supported | Yes | `web.dom.click`; input `web.user.element_clicked` | `content/actions/click.ts`, `content/action-runtime/actionability.ts` | Step 2, landed | A primary-button click. The target must pass the actionability gate — connected, not `inert`, not `display:none`/`visibility`/`opacity:0`, a non-zero box, not `:disabled` or `aria-disabled`, and, after being scrolled to the viewport centre, the point at its centre must hit it or a descendant — otherwise the result is ACTION_REJECTED carrying `disabled`, `hidden`, or `covered`. The gesture is the sequence a mouse makes, `pointerover` through `click`, dispatched in the element's own window with the focus move a real press performs, so a menu that opens on `pointerdown` sees it. The post-condition is the hit test; a link is held to more, and one whose handler swallows the click and navigates nowhere reports `output_not_observed`. No right, middle, double, or modifier click. |
| Type text | Fully supported | Yes | `web.dom.type` (parameter `text`); input `web.user.text_entered` | `content/actions/type.ts`, `content/action-runtime/keyboard/type-text.ts`, `content/action-runtime/keyboard/text-edits.ts` | Step 2, landed | Text fields and `contenteditable` hosts, both gated by actionability first. Existing content is deleted and each character is then a full `keydown`, `beforeinput`, edit, `input`, `keyup` sequence, so a combobox that filters per keystroke reacts; a cancelled `keydown` or `beforeinput` suppresses the character exactly as the browser would, and a field is written through the prototype's native value setter so a framework's own setter cannot swallow it. A read-only or disabled field is never written to. The post-condition is a value read-back, so a page that rewrites the value in its own handler reports `failed`. Segmented inputs (`date`, `number`, `time`) are unexercised and would report a failed read-back rather than a silent success. |
| Clear text | Partially supported | Yes | `web.dom.clear`; input `web.user.field_cleared` | `content/actions/clear.ts`, `content/action-runtime/set-element-value.ts`, `content/action-runtime/input-events.ts` | Step 2, landed; a `contenteditable` path and a keyboard-deletion path remain | Gated by actionability, then the native setter writes `""` and one `input` and one `change` follow, and the field is read back: a page that refills it reports `failed` rather than succeeding silently. Two subsets are still missing, and both now fail honestly rather than passing: the verb requires an `<input>` or `<textarea>`, so a `contenteditable` host reports a failed post-condition, and there is still no select-all-and-delete path for a field that reacts only to keyboard deletion, unlike `web.dom.type`, which clears through the keyboard capability. |
| Keyboard input | Partially supported | Yes | `web.dom.keypress` (parameters `key`, `modifiers`); input `web.user.key_pressed` | `content/actions/keypress.ts`, `content/action-runtime/keyboard/press-key.ts`, `content/action-runtime/keyboard/implicit-submission.ts`, `content/action-runtime/keyboard/tab-order.ts` | Step 2, landed; defaults beyond Enter, Tab, and printable characters remain | The key is delivered with `code`, `keyCode`, and modifiers, and then the default action a synthetic event never triggers is emulated: Enter submits through `form.requestSubmit(defaultButton)` — which keeps the `submit` event, constraint validation, and the `submitter` a real Enter reports — or inserts a line break in a multi-line target; Tab walks the document's tab order, treating a radio group as one stop; a printable key with no command modifier inserts its character. A default that cannot be emulated honestly is ACTION_REJECTED as `unsupported_key` naming the verb that does the job: arrow keys on a radio group or a select, Space on a checkbox, radio, or button. Every other key — a shortcut such as Ctrl+A, or Escape closing a page's own widget — is delivered and reported as passed with "no default action on this target", which is the remaining gap. A named target is gated by actionability; without a selector the key goes to whatever holds focus. |
| Select/dropdown | Partially supported | Yes | `web.dom.select` (parameters `value`, `option`); input `web.user.option_selected` | `content/actions/select.ts`, `domain/src/client/gateway-action-parameters.ts` | Step 2, landed; multi-select and custom dropdowns remain | By value, label (whitespace-collapsed, exact), or index, and a Flow can author all three: `option` is declared in the schema and the output node and is read onto the command. An option that does not exist changes nothing and reports a failed post-condition listing what the select does offer, where before it assigned the unmatched value and blanked the select; a `:disabled` option, an `<optgroup disabled>` included, is ACTION_REJECTED as `disabled`. Selection goes through `selectedIndex`, never a value two options could share, and the value is read back, so a handler that reverts the choice reports `failed`. The select itself passes the actionability gate first. Still missing: `<select multiple>` (a choice clears the others) and any custom non-`<select>` dropdown. |
| Scroll | Partially supported | Yes | `web.dom.scroll` (parameters `x`, `y`, `smooth`, `scroll`); input `web.user.page_scrolled` | `content/actions/scroll.ts`, `domain/src/output-nodes/payloads.ts` | Step 2, landed; container scrolling and relative replay remain | Three modes plus the legacy absolute move: `by` a delta, `toElement` (which scrolls the target's ancestors and reports whether it ended up in the viewport), and `untilStable`, which scrolls a lazy-loading feed while the document keeps growing, up to the required `maxScrolls` — reaching that cap while the page is still growing is a failed post-condition, not a success. Every mode reads the position back, clamped to what the document allows so a scroll past the end is not a failure, and a `smooth` scroll is waited for rather than measured in flight. Still window-level only for `by` and `untilStable`: there is no scrolling of a named scrollable container, and a recorded scroll still replays absolute offsets, which do not transfer to a page of different height. |
| Wait | Partially supported | Yes; the wait is its own check | `web.dom.wait_for_selector`, `web.dom.wait_for_text` (parameter `wait`); no action input | `content/actions/wait-for-selector.ts`, `content/actions/wait-for-text.ts`, `content/action-runtime/wait-conditions.ts`, `content/action-runtime/waits.ts` | Steps 1 and 2, landed; network idle remains | Six conditions: `present` (the default), `visible`, `enabled`, `absent`, `url`, and `stable`. The engine re-evaluates on every DOM mutation and on a 50 ms poll, because a `pushState` URL change, a CSS reveal, and "the page stopped changing" announce themselves through no mutation. Each outcome reports what the page actually showed, and running out of time is `timed_out` with Core's `timeout` category rather than a flattened `failed`; a malformed request — a condition that needs a selector, asked without one — throws and becomes a plain failure, because it never waited for anything. The default timeout is 10 s and `stable` defaults to a 500 ms quiet window. No network-idle condition. |
| Extract text | Fully supported | — | `web.dom.extract` (default mode); no action input | `content/actions/extract.ts`, `content/action-runtime/extract.ts` | Step 1, landed | Returns one element's field value or whitespace-collapsed text in `result.extracted`, which `webAutomationActionResultPayload` (`domain/src/client/gateway-mapping.ts`) forwards. Reading is not acting, so the result declares `validation: none` with the reason `evidence-only`: whether the value is the expected one is an authored `web.dom.assert`, not this verb's business. |
| Extract attributes | Partially supported | — | `web.dom.extract` with `options.mode = "attribute"` and `options.attribute` | `content/action-runtime/extract.ts`, `domain/src/actions/schemas.ts`, `domain/src/output-nodes/definitions.ts` | Step 3 covers the structured case; the single-attribute parameters remain unauthorable | One attribute per call, and a missing attribute still yields `""`. `mode` and `attribute` (like the `"html"` mode) appear in neither the parameter schema, the node parameters, nor the recorded payload, so they are reachable only because the gateway mapping copies raw parameters into `options` — a hand-built command, not anything a Flow can author. Reading several attributes across a repeating structure is `web.dom.extract_list`'s `selector@attribute` form, which is authorable. |
| Structured extraction | Fully supported | Yes | `web.dom.extract_list` (parameter `extractList`) | `content/actions/extract-list.ts`, `content/action-runtime/list-extraction.ts` | Step 3, landed | `item` selects each record's root and `fields` maps a field name to a selector inside it, in the scenario contract's own forms: a plain selector reads text, an empty one the item itself, `selector@attribute` an attribute, and `column:<header text>` the cell under that header so extraction survives a column reorder. The records become `result.extracted`, and the post-condition is that every declared field appeared in every record — a field some record lacked is `output_not_observed` naming it, so a list that quietly dropped a column cannot pass. Values are strings. |
| Repeating/list elements | Fully supported | Yes | `web.dom.extract_list` | `content/action-runtime/list-extraction.ts` | Step 3, landed | `querySelectorAll` over the item selector returns the whole collection, bounded by `maxItems`, and each record is read independently. The single-element verbs still resolve exactly one target (`content/action-runtime/resolve-target.ts`); acting on each item of a list is a Flow over an extraction, not one action. |
| Pagination | Fully supported | Yes | `web.dom.extract_list` with `paginate` and `maxItems` | `content/action-runtime/list-extraction.ts`, `domain/src/client/gateway-action-parameters.ts` | Step 3, landed | The `next` control is clicked and the read repeats until it is absent or `maxPages` pages have been read — bounded at `WEB_AUTOMATION_EXTRACT_MAX_PAGES` (50) on both sides of the wire. After each page the verb waits up to 10 s for the list to actually change (detached first item, a different first item, or a different count) rather than for a fixed delay, and a `next` that was followed without the list ever changing fails the action instead of ending the read quietly. Stopping at the cap with a `next` still present is reported as `truncated`; an absent `next` is the list ending. Append-style pagination is implemented but unexercised; an infinite feed is `scroll` with `untilStable`. |
| Open tab | Fully supported | Yes | `web.browser.tab` with `operation: "open"`; also `web.browser.navigate` with `newTab` | `runtime/browser-tab.ts`, `runtime/automation-tab.ts` | Steps 3 and 4, landed | Opens a tab, optionally at a URL and optionally in the background, and points the automation tab at it so the next action runs there. With a URL it waits for the tab to settle and compares where it landed, through the same tolerant comparison navigate uses; without one it reports the tab id and address it opened at. Never exercised in a browser: `chrome.tabs` does not exist in the unit runner and no harness covers the background worker. |
| Switch tab | Fully supported | Yes | `web.browser.tab` with `operation: "switch"`; the gateway server command `set_active_tab` still exists | `runtime/browser-tab.ts`, `runtime/command-options.ts` | Step 3, landed | Selects the tab with the given id, or the first whose URL contains the given substring, activates it, and re-points the automation tab; "any tab" is refused rather than picked arbitrarily, and nothing matching is `target_not_found`. A command's own `tabId` and `frameId` are separate from this and now reach the runner — `browserTabId`/`browserFrameId` are read onto the command and the runner addresses that frame — so a content action is no longer confined to frame 0 of one tab. Never exercised in a browser. |
| Close tab | Fully supported | Yes | `web.browser.tab` with `operation: "close"` | `runtime/browser-tab.ts`, `runtime/automation-tab.ts` | Step 3, landed | Closes the named tab, or the automation tab when none is named, forgets it, and confirms the close by re-reading the tab: one that is still open reports `failed`, not success. Closing with no tab named and none open is refused as `web.tab.no_target`. Never exercised in a browser. |
| Downloads | Partially supported | Yes | `web.browser.download` (parameter `download`) | `runtime/browser-download.ts`, `apps/extension/manifest.chrome.json`, `manifest.firefox.json`, `manifest.e2e.json` | Step 3, landed; starting a download and reading the file remain | Waits for a download to complete — optionally the one with a given file name, matched on the base name and accepting the browser's `name (1).ext` form — through `chrome.downloads`, with a 30 s default bounded to 1–120 s and a 15 s lookback so a download that finished between the click and the wait still counts. A timeout is `timed_out` with Core's `timeout` category. The `downloads` permission is declared in all three manifests, and a build without it fails as a capability refusal rather than hanging. The action only observes: it cannot start a download, choose a destination, or assert anything about the file beyond its name. The wait loop has never run in a browser. |
| Basic file uploads | Fully supported | Yes | `web.dom.upload` (parameter `upload`) | `content/actions/upload.ts`, `content/action-runtime/file-input.ts`, `domain/src/client/gateway-action-parameters.ts` | Step 3, landed | Files travel inline as base64 because the page, not the worker, owns the input; they are built into a `DataTransfer`, assigned to the input, and followed by `input` and `change`. The names the input ended up holding are read back off the element and compared with what was asked for, so an upload that put nothing anywhere reports `failed`. A target that is not a file input, a single-file input given several files, and malformed or oversized content are all refused before anything is dispatched; the 1 MiB per-file and 4 MiB total bounds are enforced by the domain on the way in and again in the page. File contents never appear in a result, a message, or a log. Multi-file uploads are coded but untested. |
| Form interaction | Partially supported | Yes | composed from `web.dom.check`, click, type, clear, select, and Enter; `dom.submit` remains a recording event kind only | `content/actions/check.ts`, `content/action-runtime/checkable-state.ts`, `content/action-runtime/keyboard/implicit-submission.ts`, `domain/src/io/input-model.ts` | Step 3, landed; a submit action and validation-error observation remain | A checkbox or radio can now be set to a state rather than toggled, which is what makes a replayed step idempotent, and `checked` is read back after the control's own events run, so a handler that reverted the change reports `failed`. A control that is not checkable, one that is `:disabled` or `aria-disabled` — a disabled `<fieldset>`'s descendants included — and unchecking a radio, which no user gesture can do, are each ACTION_REJECTED rather than faked. `web.dom.check` does not use the actionability gate: it has its own disabled check and does not hit-test, so a control covered by an overlay is still set. There is still no submit action — a form is submitted by Enter in a field or by clicking its button — a recorded submit maps to no input, and validation errors are not observed. |
| Dynamic elements | Partially supported | Yes | the two wait actions, `web.dom.assert`, and the actionability gate | `content/action-runtime/wait-conditions.ts`, `content/action-runtime/actionability.ts`, `content/action-runtime/resolve-target.ts` | Step 2, landed; waiting inside the acting verbs remains | The gate scrolls a target into view and refuses one that is not yet visible or not yet enabled, with a code saying which, so an action against a half-rendered page fails for a stated reason instead of appearing to work; `web.dom.assert` re-queries its selector until its claim holds or the timeout passes. But no acting verb waits first: `resolveTarget` throws at once when nothing matches, and nothing in the action path retries, so a Flow against a page that renders late must still author a wait before the action. |
| Modal/dialog interaction | Partially supported | Yes | `web.dom.dialog` (parameter `dialog`); DOM modals are ordinary elements | `content/actions/dialog.ts`, `content/action-runtime/dialog-control.ts`, `page-world/dialog-override.ts`, `shared/dialog-channel.ts` | Step 3, landed; `beforeunload` and older Firefox remain | A native dialog blocks the page's script, so the answer is armed before the dialog opens: `alert`, `confirm`, and `prompt` are replaced in the page's own world at `document_start`, ahead of any page script, and the verb arms the next dialog's response — accept, dismiss, or accept with `promptText` — through a synchronous DOM handshake. Arming that is not acknowledged means the override is not installed, and the verb fails at once as `dialog_override_missing` rather than arming something nothing will answer. An unarmed dialog is left alone: the page behaves as it would without the extension, and what was answered is recorded as evidence the next action reports. Two gaps: `beforeunload` is in the observed-dialog union but is not a function that can be replaced, so it is unhandled; and `world: "MAIN"` is honoured only from Chrome 111 and Firefox 128, while the Firefox manifest still admits 109, so on Firefox 109–127 the override lands in the isolated world and every dialog action fails honestly instead of working. |
| URL checks | Fully supported | Yes | `web.dom.assert` with `kind: "url"`; also the `url` wait condition and navigate's landed-URL comparison | `content/actions/assert.ts`, `content/action-runtime/assertion-evaluation.ts`, `runtime/navigation-outcome.ts` | Step 3, landed | An authored claim about the address, retried until it holds or the timeout passes (5 s by default, `timeoutMs: 0` for a single immediate check). The landed URL counts as the requested one when it equals it, contains it, or resolves to it against the document's base. A claim that does not hold is STATE_MISMATCH — Core's `expected_state_missing`, retryable, at the `verification` stage — not `output_not_observed`, because the difference between a wrong expectation and an action that did not take is how a Flow recovers. |
| Element existence checks | Fully supported | Yes | `web.dom.assert` with `kind` `exists`, `visible`, or `enabled` | `content/actions/assert.ts`, `content/action-runtime/assertion-evaluation.ts` | Step 3, landed | The claim is judged immediately and then polled every 50 ms until the deadline, so an element that arrives late satisfies it and a wrong claim fails fast instead of costing a full wait timeout. The selector is re-queried on every attempt rather than resolved once; an element handed over without a selector must still be connected. `exists` with neither a selector nor an element is reported as such rather than guessed at, and an assertion's target may come from coordinates, visual bounds, or a fingerprint, in which case a miss leaves an empty target reported as "nothing matched" rather than a throw. |
| Element nonexistence checks | Fully supported | Yes | `web.dom.assert` with `kind: "absent"`; also the `absent` wait condition | `content/actions/assert.ts`, `content/action-runtime/wait-conditions.ts` | Steps 2 and 3, landed | Absence is now a first-class outcome on both paths: the assertion holds when nothing matches the selector, or when the element handed to it has detached, and the wait condition satisfies when the selector matches nothing or the text has gone. A spinner disappearing is therefore expressible both as a claim that fails fast and as a wait that reports `timed_out` if it never goes. |

## Actions Outside The 24

- **`web.dom.capture_snapshot`** is a real action type, output node, and
  manifest output, executed by `content/actions/capture-snapshot.ts`. It
  captures evidence rather than performing a browser capability, takes no
  parameters, has no action input, and is classified safe. Its result declares
  `validation: none` with the reason `evidence-only`.
- **Legacy dotted aliases** (`browser.navigate`, `dom.click`, and the rest) are
  still accepted on the wire and resolved to their canonical types once, in the
  domain (see below). The map is total over all eighteen types, but the seven
  added in Week 1 were never on the wire under a dotted name: their alias exists
  only so the two directions cannot drift. The content-script dispatcher matches
  canonical types only, and the protocol's action-type union makes a dotted
  comparison a compile error.

## Behaviour Across All Rows

### Action Type Resolution

`normalizeWebAutomationActionType`
([`domain/src/client/gateway-mapping.ts`](../../domain/src/client/gateway-mapping.ts))
is the one place a requested action type is resolved:

- a canonical type passes;
- a legacy dotted alias becomes its canonical type, read from the reverse of
  `WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER` (`domain/src/actions/types.ts`),
  so the two directions cannot drift;
- anything else, a missing type included, is rejected with Core's structured
  failure record rather than rewritten into another action. Before Phase 1.1
  an unknown type silently became `web.dom.extract`.

`webAutomationActionFromGatewayCommand` returns either the browser command or
a `WebAutomationActionRejection`,
`{ commandId, status: "rejected", actionType, message, failure }`, whose
`actionType` is exactly the one requested and whose `failure` is one record in
Core's taxonomy (decision D11):

```json
{
  "category": "blocked_by_capability_or_policy",
  "code": "web.action.unsupported_type",
  "retryable": false,
  "stage": "dispatch"
}
```

A client refusing an action type it does not implement is a capability
refusal, decided before anything is dispatched; Core forbids that category
from ever being `retryable`, and `parseAutomationStudioFailureRecord` drops a
record that contradicts the rule whole rather than repairing it. The domain's
contract is that nothing is dispatched for a rejection.

**Extension side.** `browserActionFromGatewayCommand`
(`runtime/result-mapping.ts`) returns the rejection as it is, and
`background/connection/gateway-session.ts` answers it at once with
`gatewayActionResultFromRejection`: a `failed` `client.action_result` carrying
that record on Core's `failure` field, with the `requestedActionType` in
`metadata`. Nothing is dispatched to the page. The wire has no `rejected`
status, so it is the failure record, not the status, that names the refusal.

### Safety Classification

`WEB_AUTOMATION_ACTION_SAFETY`
([`domain/src/actions/safety.ts`](../../domain/src/actions/safety.ts)) is the
one safety classification of every output. Six outputs only observe or wait, so
they are `safe`: unprivileged, with no operator approval, and a provider-free
run never prompts for them — the two waits, extract, capture_snapshot, and the
two added in Week 1 that only read the page, `web.dom.assert` and
`web.dom.extract_list`. The twelve that act on the page or the browser are
`review`, including `web.dom.check`, `web.dom.upload`, `web.dom.dialog`,
`web.browser.tab`, and `web.browser.download` (decision D6). The manifest
output's `safety.level` and `requiresApproval`
(`domain/src/io/manifest-definitions.ts`) and the output node's safety fields
(`domain/src/output-nodes/definitions.ts`) both derive from it, and its
`Record` type forces a classification for every new action type.

### Recorded Actions

Eight outputs have a recorded action input, each bound to exactly one output
(`actionInputDefinitions` in
[`domain/src/io/input-model.ts`](../../domain/src/io/input-model.ts)):
navigate, click, type, clear, select, check, keypress, and scroll. Assert,
extract_list, upload, dialog, tab, download, the waits, extract, and
capture_snapshot are dispatch-only — no recorded user event maps to one, so
their recorded payload is empty by construction.

One function, `webAutomationRecordedAction`, maps a recorded event to its
input, output, and parameters. The live gateway path
(`webAutomationInputIdForRecordedEvent`) and the recording-to-Subflow proposal
mapper (`mapWebRecordingObservation` in `domain/src/web-panel-host.ts`) both
call it. An event is therefore executable on one path exactly when it is on
the other, with the same parameters, including the element fingerprint and
visual target that replay falls back on. An event is executable only when
every parameter its output's schema requires is a non-empty string, a key
press has a key, a scroll has a coordinate, and a check has a known state;
otherwise it stays evidence.

- A navigation is an action only when it was typed, and never the navigation
  that marks where a recording began.
- Scroll is keyed on the `dom.scroll` event the recorder emits. `dom.wheel` is
  never emitted and maps to nothing.
- An input or change on a `<select>` becomes select, a checkbox or radio
  becomes check, an empty value becomes clear, and any other value becomes
  type.
- **A recorded checkbox toggle is still evidence, not an action.** `web.dom.check`
  needs the state the control was left in, and nothing produces it: the element
  descriptor (`content/describe-element.ts`) carries no `checked` field and its
  attribute allowlist has no `aria-checked`, so `recordedCheckedState`
  (`domain/src/output-nodes/payloads.ts`) finds nothing to read. A radio is the
  exception — its `change` can only mean "now selected", so it maps to
  `checked: true` and is executable.
- A key press on a `<select>` whose only effect is the value change — an arrow,
  Home, End, Page Up/Down, or any single character — is evidence, because the
  recorder already reports that change as its own event.
- Submit, mutation, snapshot, and the never-emitted focus and blur map to no
  input.

`GatewayInputHub`
([`domain/src/io/gateway-input-hub.ts`](../../domain/src/io/gateway-input-hub.ts))
delivers recorded inputs to live subscribers. It reads the event's top-level
`domainId` first, then `metadata.domainId`, as Core's gateway bridge does, so
a user-recorded action reaches live input subscribers, not only a runtime
confirmation. The web-panel host uses this hub and the shared output
dispatcher rather than copies of them.

### Recorder Trust And Runtime Confirmations

The recorder
([`content/dom-events.ts`](../../apps/extension/src/content/dom-events.ts))
ignores untrusted `pointerdown`, `click`, `input`, `change`, `keydown`, and
`wheel` events. A click the page dispatches is not recorded as the user's,
and a replayed `type`, `clear`, or `select` is recorded once, as its runtime
confirmation, not a second time from the synthetic `input` and `change` it
dispatches. `submit` and window `scroll` are recorded without a trust check.

A succeeded runtime action that has a recorded counterpart is also sent as a
recording event carrying its input ID (`runtimeConfirmationForActionResult` in
[`background/connection/runtime-status.ts`](../../apps/extension/src/background/connection/runtime-status.ts)).
Seven of the eight action inputs have a confirmation; `web.dom.check` has none
yet, so a replayed check produces no recording event. The `type` and `select`
confirmations carry the value the field was left holding, read from the result's
element descriptor, which the content script fills only while input-value
capture is on. A field that matches the recorder's sensitivity rule carries no
value; `clear` carries `""`. The recorder's own events and a result's
`element.value` are not yet redacted; see
[Recording Evidence](extension-client.md#recording-evidence).

### Results And Failures

Every result carries a `validation` (decision D4), because the builders in
[`content/action-runtime/results.ts`](../../apps/extension/src/content/action-runtime/results.ts)
and `runtime/action-results.ts` require one and a verb cannot assemble a result
itself. `success()` takes the post-condition as an argument rather than
defaulting it, so a verb with nothing to check has to say so — `none` with the
reason `evidence-only` or `not-yet-validated` — and the gap is visible rather
than silent. What a validation implies is decided in
`content/action-runtime/validation-outcome.ts`, free of the DOM so it can be
tested directly:

- a failed validation is not a success: the result is `failed` with Core's
  `output_not_observed`, retryable, at the `verification` stage, carrying the
  two values that disagreed;
- a target that was disabled, hidden, or covered is ACTION_REJECTED —
  `blocked_by_capability_or_policy` with the capability's own code as
  `web.action.<code>`, never retryable;
- a wait or an action that ran out of time is `timed_out` with Core's `timeout`
  category, never flattened to `failed`;
- an authored assertion that does not hold is STATE_MISMATCH
  (`expected_state_missing`), which is a different thing from an action whose
  effect did not appear.

Validation text is whitespace-collapsed, never empty, and bounded to 1 024
characters on both sides of the wire, because Core's parser drops an
over-long record whole rather than truncating it. The record now survives the
boundary: `gatewayActionResultFromBrowserResult` (`runtime/result-mapping.ts`)
forwards `result.failure` and gives every non-succeeded status its message as
the `error`, and `dispatchWebAutomationOutput`
(`domain/src/io/gateway-output-dispatcher.ts`) passes the command's own status
through, so Core sees `timed_out` rather than a bare failure. `cancelled` is
still declared in the status union and nothing produces it.
