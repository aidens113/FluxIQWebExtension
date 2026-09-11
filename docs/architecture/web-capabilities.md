# Web Capabilities

This page is current-state design. It records what each browser capability
does in the working tree today, not what the plan intends, and it is updated
at the close of every Week 1 phase. It began as the capability matrix in the
[Week 1 action audit](../working/mvp-week1-web-automation-reliability-plan/reports/audit-actions.md)
(repository at `d848536`) and was last checked against source on 2026-09-11,
during Phase 1.1 of the
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
when the expected outcome did not happen. No row does today. A dash marks a
row with nothing to validate.

**Changed by** names the step of Week 1 Phase 1.2 (Action vocabulary and
outcome validation) that changes the row's state. Phase 1.2's exit check is
this matrix at represent, execute, observe, and validate 24/24. Phases 1.3
(Element identity), 1.4 (Browser state and evidence), and 1.5 (Explicit
failure taxonomy) change target resolution, result evidence, and failure
reporting across every row; the column does not repeat them.

Extension paths are relative to `apps/extension/src/`. Domain paths start
with `domain/src/`.

## Summary

| Measure | Of 24 |
| --- | --- |
| Fully supported | 1 |
| Partially supported | 10 |
| Unreliable | 3 |
| Unsupported | 10 |
| Represented (an action type, output node, or input exists) | 14 |
| Executed | 14 |
| Resulting browser state observed | 13 (navigate executes but returns no page state) |
| Outcome validated | 0 |

## How An Action Runs

Eleven action types are defined once, as `WEB_AUTOMATION_ACTION_TYPES` in
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
2. `ExtensionRuntimeCommandRouter` (`runtime/command-router.ts`) hands it to
   `runBrowserActionCommand`
   ([`runtime/action-runner.ts`](../../apps/extension/src/runtime/action-runner.ts)).
   Navigate runs there, through `resolveAutomationTab`
   (`runtime/automation-tab.ts`); every other action is sent to the tab's
   content script.
3. The content script's `executeAction`
   (`content/action-runtime/execute-action.ts`) passes it to
   `executeContentAction`
   ([`content/actions/execute.ts`](../../apps/extension/src/content/actions/execute.ts)),
   which dispatches it to one module per verb in `content/actions/`.

## Capability Matrix

| Capability | State | Outcome validated | Represented as | Owning files | Changed by (Phase 1.2) | Why this state |
| --- | --- | --- | --- | --- | --- | --- |
| Navigate | Partially supported | No | `web.browser.navigate`; input `web.user.navigation_requested` (typed navigations only) | `runtime/action-runner.ts`, `runtime/automation-tab.ts` | Step 4: tab reuse by default, `newTab` option, landed-URL comparison | Runs in the background worker, never in the content script. Opens a new tab on every call, waits at most 20 s for the tab to report `complete` and resolves either way, and returns the requested URL as `succeeded` without checking where the browser landed. The result has no title, element, or snapshot. |
| Click | Unreliable | No | `web.dom.click`; input `web.user.element_clicked` | `content/actions/click.ts`, `content/action-runtime/resolve-target.ts` | Step 2: actionability gate (visible, enabled, centre hit-test, scroll into view); `href` navigation observed | Calls the untrusted `HTMLElement.click()` with no pointer-event sequence and no disabled, visibility, or hit-test check, so a disabled or covered control still returns `succeeded`. |
| Type text | Partially supported | No | `web.dom.type` (parameter `text`); input `web.user.text_entered` | `content/actions/type.ts`, `content/action-runtime/set-element-value.ts`, `content/action-runtime/input-events.ts` | Step 2: per-character key sequence, `contenteditable`, value read-back | The native value setter works for `<input>` and `<textarea>`, React-controlled fields included, followed by one `input` and one `change`. No key events are sent, so type-ahead and combobox widgets never react; `contenteditable` is not supported; the value is never read back. |
| Clear text | Partially supported | No | `web.dom.clear`; input `web.user.field_cleared` | `content/actions/clear.ts`, `content/action-runtime/set-element-value.ts`, `content/action-runtime/input-events.ts` | Step 2: as type | Sets `""` through the same setter and events, with the same limits. There is no select-all-and-delete path for fields that react only to keyboard deletion. |
| Keyboard input | Unreliable | No | `web.dom.keypress` (parameter `key`); input `web.user.key_pressed` | `content/actions/keypress.ts` | Step 2: Enter submits through `requestSubmit`, Tab moves focus, modifiers | Dispatches untrusted `keydown` and `keyup` carrying only `key` (no `code`, no modifiers). They trigger no default action: Enter does not submit and Tab does not move focus, yet the result is `succeeded`. |
| Select/dropdown | Unreliable | No | `web.dom.select` (parameter `value`); input `web.user.option_selected` | `content/actions/select.ts` | Step 2: select by value, label, or index; the option must exist | Assigns `element.value`. A value that matches no option leaves nothing selected (`value` becomes `""`) and still returns `succeeded`. No selection by label or index, no multi-select, no custom (non-`<select>`) dropdowns. The result descriptor carries `selectedValue`, but nothing compares it with the request. |
| Scroll | Partially supported | No | `web.dom.scroll` (parameters `x`, `y`, `smooth`); input `web.user.page_scrolled` | `content/actions/scroll.ts`, `domain/src/output-nodes/payloads.ts` | Step 2: scroll modes | Absolute top-window offsets through `window.scrollTo` only: no element or container scrolling, no relative delta, no scroll-until-stable. A recorded scroll replays absolute offsets, which do not transfer to a page of different height. A recorded user scroll is executable. |
| Wait | Partially supported | No; the wait is its own check, for presence only | `web.dom.wait_for_selector`, `web.dom.wait_for_text`; no action input | `content/actions/wait-for-selector.ts`, `content/actions/wait-for-text.ts`, `content/action-runtime/waits.ts` | Steps 1 and 2: waits for visible, enabled, absent, URL, stable; `timed_out` on timeout | A `MutationObserver` waits, 10 s by default, for an element to exist or text to appear. Nothing waits for visible, enabled, stable, absent, a URL change, or network idle. A timeout reports `failed`, never `timed_out`. |
| Extract text | Fully supported | No | `web.dom.extract` (default mode); no action input | `content/actions/extract.ts`, `content/action-runtime/extract.ts` | Step 1: result validation model | Returns one element's field value or whitespace-collapsed text in `result.extracted`, which `webAutomationActionResultPayload` (`domain/src/client/gateway-mapping.ts`) forwards. There is no expected-value comparison, and an empty string is a success. |
| Extract attributes | Partially supported | No | `web.dom.extract` with `options.mode = "attribute"` and `options.attribute` | `content/action-runtime/extract.ts`, `domain/src/actions/schemas.ts`, `domain/src/output-nodes/definitions.ts` | No step names it; the nearest is step 3's `web.dom.extract_list` field map | One attribute per call; a missing attribute yields `""` and `succeeded`. `mode` and `attribute` (like the `"html"` mode) appear in neither the parameter schema, the node parameters, nor the recorded payload, so only a hand-built gateway command reaches them. |
| Structured extraction | Unsupported | — | none | `domain/src/actions/types.ts` (`extracted` is one `JsonValue`) | Step 3: `web.dom.extract_list` with a field map | No schema, field map, or shape contract exists for an extraction result. |
| Repeating/list elements | Unsupported | — | none | `content/action-runtime/resolve-target.ts` | Step 3: `web.dom.extract_list` | Target resolution returns at most one element (`querySelector`, `elementFromPoint`), and no action returns a collection. |
| Pagination | Unsupported | — | none | — | Step 3: `web.dom.extract_list` with `paginate` and `maxItems` | No repeat-until action, next-page detection, or termination predicate exists. |
| Open tab | Unsupported | — | none; a tab opens only as a side effect of navigate | `runtime/automation-tab.ts` | Step 3: `web.browser.tab`; step 4: `newTab` option | No action type, output node, input, or manifest output. |
| Switch tab | Unsupported | — | the gateway server command `set_active_tab` only | `background/connection.ts`, `domain/src/client/gateway-mapping.ts` | Step 3: `web.browser.tab` | Not an action type, output node, or runtime capability, so no Flow or policy reaches it. The gateway mapping sets neither `tabId` nor `frameId`, so every content action runs in frame 0 of the automation tab. |
| Close tab | Unsupported | — | none | — | Step 3: `web.browser.tab` | The extension makes no `chrome.tabs.remove` call. |
| Downloads | Unsupported | — | none | `apps/extension/manifest.chrome.json`, `manifest.firefox.json`, `manifest.e2e.json` | Step 3: `web.browser.download`; `downloads` permission in all three manifests | No `downloads` permission and no `chrome.downloads` use. |
| Basic file uploads | Unsupported | — | none | — | Step 3: `web.dom.upload` | No `DataTransfer`, `File`, or `input.files` handling; `web.dom.type` cannot fill an `<input type="file">`. |
| Form interaction | Partially supported | No | composed from click, type, clear, and select; `dom.submit` is a recording event kind only | `content/actions/`, `domain/src/io/input-model.ts`, `background/connection/runtime-status.ts` | Step 3: `web.dom.check`; step 2: Enter submits | Fields can be filled, but there is no submit action and no way to set a checkbox or radio to a state (only a toggling click). A recorded checkbox or radio change maps to `web.dom.type`, and a recorded submit maps to no input. Validation errors are not observed. |
| Dynamic elements | Partially supported | No | the two wait actions, plus the recorder's mutation events | `content/action-runtime/waits.ts`, `content/action-runtime/resolve-target.ts` | Step 2: actionability gate; waits for visible, enabled, stable | Waits must be authored explicitly. No acting verb waits first, target resolution throws at once when the element is not yet in the DOM, and nothing in the action path retries. |
| Modal/dialog interaction | Partially supported | No | DOM modals are ordinary elements; native dialogs have no representation | `content/actions/` | Step 3: `web.dom.dialog` | DOM modals only. There is no `alert`, `confirm`, `prompt`, or `beforeunload` handling and no `debugger` permission, so while a native dialog is open the action fails on the message round trip with a transport error. |
| URL checks | Unsupported | — | none as an action; every result and snapshot carries the URL | `content/action-runtime/results.ts` | Step 3: `web.dom.assert`; step 2: wait for URL; step 4: landed-URL comparison | No action compares the URL with an expectation or can fail because of one. |
| Element existence checks | Partially supported | No; presence is established only by waiting | `web.dom.wait_for_selector` | `content/action-runtime/waits.ts` | Step 3: `web.dom.assert` | An absent element costs the full timeout, and there is no immediate true or false to branch on. |
| Element nonexistence checks | Unsupported | — | none | — | Step 2: wait for absent; step 3: `web.dom.assert` | Nothing waits for absence, and no action treats absence as success. |

## Actions Outside The 24

- **`web.dom.capture_snapshot`** is a real action type, output node, and
  manifest output, executed by `content/actions/capture-snapshot.ts`. It
  captures evidence rather than performing a browser capability, takes no
  parameters, has no action input, and is classified safe.
- **Legacy dotted aliases** (`browser.navigate`, `dom.click`, and the other
  nine) are still accepted on the wire and resolved to their canonical types
  once, in the domain (see below). The content-script dispatcher matches
  canonical types only; Phase 1.1 step 4b removed its alias matching, and the
  protocol's action-type union makes a dotted comparison a compile error.

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
one safety classification of every output. The two waits, extract, and
capture_snapshot only observe or wait, so they are `safe`: unprivileged, with
no operator approval, and a provider-free run never prompts for them. The
seven outputs that act on the page are `review`. The manifest output's
`safety.level` and `requiresApproval` (`domain/src/io/manifest-definitions.ts`)
and the output node's safety fields (`domain/src/output-nodes/definitions.ts`)
both derive from it, and its `Record` type forces a classification for every
new action type. Before Phase 1.1 the two disagreed about the waits and
capture_snapshot.

### Recorded Actions

Seven outputs have a recorded action input, each bound to exactly one output
(`actionInputDefinitions` in
[`domain/src/io/input-model.ts`](../../domain/src/io/input-model.ts)):
navigate, click, type, clear, select, keypress, and scroll. The waits,
extract, and capture_snapshot are authored in a Flow only.

One function, `webAutomationRecordedAction`, maps a recorded event to its
input, output, and parameters. The live gateway path
(`webAutomationInputIdForRecordedEvent`) and the recording-to-Subflow proposal
mapper (`mapWebRecordingObservation` in `domain/src/web-panel-host.ts`) both
call it. An event is therefore executable on one path exactly when it is on
the other, with the same parameters, including the element fingerprint and
visual target that replay falls back on. An event is executable only when
every parameter its output's schema requires is a non-empty string, a key
press has a key, and a scroll has a coordinate; otherwise it stays evidence.

- A navigation is an action only when it was typed, and never the navigation
  that marks where a recording began.
- Scroll is keyed on the `dom.scroll` event the recorder emits. `dom.wheel` is
  never emitted and maps to nothing.
- An input or change on a `<select>` becomes select, an empty value becomes
  clear, and any other value becomes type, checkboxes and radios included.
  Phase 1.2 step 3 adds `web.dom.check`.
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
The `type` and `select` confirmations carry the value the field was left
holding, read from the result's element descriptor, which the content script
fills only while input-value capture is on. A field that matches the
recorder's sensitivity rule carries no value; `clear` carries `""`. The
recorder's own events and a result's `element.value` are not yet redacted;
see [Recording Evidence](extension-client.md#recording-evidence).

### Results And Failures

`success()`
([`content/action-runtime/results.ts`](../../apps/extension/src/content/action-runtime/results.ts))
ends every action branch without reading the page back, so `succeeded` means
only that nothing threw. A thrown error is caught by `executeContentAction`
and becomes a `failed` result through `actionFailure`. No action retries or
checks actionability first; only the two waits wait. `timed_out` and
`cancelled` are declared in the result status unions, but nothing produces
them. Phase 1.2 step 1 adds `validation: { expected, actual, passed }` to the
result and makes `success()` require it.
