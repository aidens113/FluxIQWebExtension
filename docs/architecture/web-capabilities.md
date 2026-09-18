# Web Capabilities

This page is current-state design: what each browser capability does in the
working tree, not what a plan intends. The wire protocol and the recording
path are in the
[extension client architecture](extension-client.md). What each row does not
repeat has a page of its own: how a target becomes an element in
[element identity](element-identity.md), what a capture says about the page in
[page evidence](page-evidence.md), how a failure is named in
[the failure taxonomy](failure-taxonomy.md), and what is withheld from both in
[sensitive values](sensitive-values.md).

## Reading The Matrix

The matrix has 24 rows, one per browser capability.

| State | Meaning |
| --- | --- |
| Fully supported | Does what the capability names, for the scope the row states |
| Partially supported | Works for a stated subset; the rest is missing |
| Unreliable | Can complete as a no-op and still report `succeeded` |
| Unsupported | No action type, output node, input, or manifest output represents it |

**Outcome validated** says whether the action reads the page back and fails
when the expected outcome did not happen. Every result carries a
`validation` the result builders require (decision D4), so a dash marks a row
whose verb only observes and therefore declares `validation: none` with the
reason `evidence-only`.

**Why this state** says what the row does and, for a partially supported row,
what it lacks.

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

No row can complete as a no-op and still report `succeeded`: a failed
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
   the `browserTabId`/`browserFrameId` an action runs in, and a child frame's
   `browserFrameUrlPath`, read as `frameUrlPath` — is read onto the
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
   replies first. A command recorded in a child frame also names that frame by
   its document's path, and goes to the frame now at that path
   ([Child Frames](#child-frames)).
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

| Capability | State | Outcome validated | Represented as | Owning files | Why this state |
| --- | --- | --- | --- | --- | --- |
| Navigate | Fully supported | Yes | `web.browser.navigate` (parameters `url`, `newTab`); input `web.user.navigation_requested` (typed navigations only) | `runtime/action-runner.ts`, `runtime/automation-tab.ts`, `runtime/navigation-outcome.ts` | Reuses the remembered automation tab unless `newTab` or a named tab says otherwise, so a Flow's steps land on the page the previous step left. It waits for the tab to report `complete` and its URL to hold still for 1 s (20 s cap), then compares where the browser actually committed with what was asked for: an http→https upgrade, a `www.` prefix, a trailing slash, and a fragment are the same destination, a different host or path is not, and a query is compared only when the request carried one. A redirect to a login wall fails with `navigation_unexpected`, and an unreadable URL is never counted as arrival. The worker-side result carries the landed URL but no title, element, or snapshot. |
| Click | Fully supported | Yes | `web.dom.click`; input `web.user.element_clicked` | `content/actions/click.ts`, `content/action-runtime/actionability.ts`, `content/action-runtime/in-place-effect.ts`, `runtime/click-landing.ts` | A primary-button click. The target must pass the actionability gate — connected, not `inert`, not `display:none`/`visibility`/`opacity:0`, a non-zero box, not `:disabled` or `aria-disabled`, and, after being scrolled to the viewport centre, the point at its centre must hit it or a descendant — otherwise the result is ACTION_REJECTED carrying `disabled`, `hidden`, or `covered`. The gesture is the sequence a mouse makes, `pointerover` through `click`, dispatched in the element's own window with the focus move a real press performs, so a menu that opens on `pointerdown` sees it. The post-condition is the hit test; a link is held to more. It passes at once when the navigation it names begins, and when the page's own script cancels that navigation it passes only if the page answers the click in place within 5 s (less if the command's `timeoutMs` is shorter): the address moves through the history API, or the rendered text changes while the page's structure moves somewhere other than the link — how a filter, pager or tab strip answers. A link whose click is cancelled and answered with neither, including one whose press only restyles it while a clock ticks elsewhere, reports `output_not_observed` once the window passes. A page already changing on its own in both ways (a live feed) can make a dead link read as answered; an in-place answer with no text, inside a shadow root, or in another window is not seen. A click that takes its own tab to a page the server answered with 400 or above fails with `navigation_unexpected` (`runtime/click-landing.ts`), naming the status and the landed path without its query; a soft 404 served 200 is not caught, and on Firefox, which keeps no response status, the landing is not judged. No right, middle, double, or modifier click. |
| Type text | Fully supported | Yes | `web.dom.type` (parameter `text`); input `web.user.text_entered` | `content/actions/type.ts`, `content/action-runtime/keyboard/type-text.ts`, `content/action-runtime/keyboard/text-edits.ts` | Text fields and `contenteditable` hosts, both gated by actionability first. Existing content is deleted and each character is then a full `keydown`, `beforeinput`, edit, `input`, `keyup` sequence, so a combobox that filters per keystroke reacts; a cancelled `keydown` or `beforeinput` suppresses the character exactly as the browser would, and a field is written through the prototype's native value setter so a framework's own setter cannot swallow it. A read-only or disabled field is never written to. The post-condition is a value read-back, so a page that rewrites the value in its own handler reports `failed`. Segmented inputs (`date`, `number`, `time`) are unexercised and would report a failed read-back rather than a silent success. |
| Clear text | Partially supported | Yes | `web.dom.clear`; input `web.user.field_cleared` | `content/actions/clear.ts`, `content/action-runtime/set-element-value.ts`, `content/action-runtime/input-events.ts` | Gated by actionability, then the native setter writes `""` and one `input` and one `change` follow, and the field is read back: a page that refills it reports `failed` rather than succeeding silently. Two subsets are missing, and both fail rather than pass: the verb requires an `<input>` or `<textarea>`, so a `contenteditable` host reports a failed post-condition, and there is no select-all-and-delete path for a field that reacts only to keyboard deletion, unlike `web.dom.type`, which clears through the keyboard capability. |
| Keyboard input | Partially supported | Yes | `web.dom.keypress` (parameters `key`, `modifiers`); input `web.user.key_pressed` | `content/actions/keypress.ts`, `content/action-runtime/keyboard/press-key.ts`, `content/action-runtime/keyboard/implicit-submission.ts`, `content/action-runtime/keyboard/tab-order.ts` | The key is delivered with `code`, `keyCode`, and modifiers, and then the default action a synthetic event never triggers is emulated: Enter submits through `form.requestSubmit(defaultButton)` — which keeps the `submit` event, constraint validation, and the `submitter` a real Enter reports — or inserts a line break in a multi-line target; Tab walks the document's tab order, treating a radio group as one stop; a printable key with no command modifier inserts its character. A default that cannot be emulated honestly is ACTION_REJECTED as `unsupported_key` naming the verb that does the job: arrow keys on a radio group or a select, Space on a checkbox, radio, or button. Every other key — a shortcut such as Ctrl+A, or Escape closing a page's own widget — is delivered and reported as passed with "no default action on this target", which is what this row lacks: no default beyond Enter, Tab, and a printable character is emulated. A named target is gated by actionability; without a selector the key goes to whatever holds focus. |
| Select/dropdown | Partially supported | Yes | `web.dom.select` (parameters `value`, `option`); input `web.user.option_selected` | `content/actions/select.ts`, `domain/src/client/gateway-action-parameters.ts` | By value, label (whitespace-collapsed, exact), or index, and a Flow can author all three: `option` is declared in the schema and the output node and is read onto the command. An option that does not exist changes nothing and reports a failed post-condition listing what the select does offer, and leaves the select as it was; a `:disabled` option, an `<optgroup disabled>` included, is ACTION_REJECTED as `disabled`. Selection goes through `selectedIndex`, never a value two options could share, and the value is read back, so a handler that reverts the choice reports `failed`. The select itself passes the actionability gate first. Missing: `<select multiple>` (a choice clears the others) and any custom non-`<select>` dropdown. |
| Scroll | Partially supported | Yes | `web.dom.scroll` (parameters `x`, `y`, `smooth`, `scroll`); input `web.user.page_scrolled` | `content/actions/scroll.ts`, `domain/src/output-nodes/payloads.ts` | Three modes plus the legacy absolute move: `by` a delta, `toElement` (which scrolls the target's ancestors and reports whether it ended up in the viewport), and `untilStable`, which scrolls a lazy-loading feed while the document keeps growing, up to the required `maxScrolls` — reaching that cap while the page is still growing is a failed post-condition, not a success. Every mode reads the position back, clamped to what the document allows so a scroll past the end is not a failure, and a `smooth` scroll is waited for rather than measured in flight. `by` and `untilStable` scroll the window only: there is no scrolling of a named scrollable container, and a recorded scroll replays absolute offsets, which do not transfer to a page of different height. |
| Wait | Partially supported | Yes; the wait is its own check | `web.dom.wait_for_selector`, `web.dom.wait_for_text` (parameter `wait`); no action input | `content/actions/wait-for-selector.ts`, `content/actions/wait-for-text.ts`, `content/action-runtime/wait-conditions.ts`, `content/action-runtime/waits.ts` | Six conditions: `present` (the default), `visible`, `enabled`, `absent`, `url`, and `stable`. The engine re-evaluates on every DOM mutation and on a 50 ms poll, because a `pushState` URL change, a CSS reveal, and "the page stopped changing" announce themselves through no mutation. Each outcome reports what the page actually showed, and running out of time is `timed_out` with Core's `timeout` category rather than a flattened `failed`; a malformed request — a condition that needs a selector, asked without one — throws and becomes a plain failure, because it never waited for anything. The default timeout is 10 s and `stable` defaults to a 500 ms quiet window. No network-idle condition. |
| Extract text | Fully supported | — | `web.dom.extract` (default mode); no action input | `content/actions/extract.ts`, `content/action-runtime/extract.ts` | Returns one element's field value or whitespace-collapsed text in `result.extracted`, which `webAutomationActionResultPayload` (`domain/src/client/gateway-mapping.ts`) forwards. Reading is not acting, so the result declares `validation: none` with the reason `evidence-only`: whether the value is the expected one is an authored `web.dom.assert`, not this verb's business. The verb is authored by a Flow and never recorded: the picker refuses a single-value pick outright, so no recorded value extraction exists, and the input that was once registered for one was removed rather than left advertising a trigger that never fires ([Recorded Actions](#recorded-actions)). |
| Extract attributes | Partially supported | — | `web.dom.extract` with `options.mode = "attribute"` and `options.attribute` | `content/action-runtime/extract.ts`, `domain/src/actions/schemas.ts`, `domain/src/output-nodes/definitions.ts` | One attribute per call, and a missing attribute yields `""`. `mode` and `attribute` (like the `"html"` mode) appear in neither the parameter schema, the node parameters, nor the recorded payload, so they are reachable only because the gateway mapping copies raw parameters into `options` — a hand-built command, not anything a Flow can author. Reading several attributes across a repeating structure is `web.dom.extract_list`'s `selector@attribute` form, which is authorable. |
| Structured extraction | Fully supported | Yes | `web.dom.extract_list` (parameter `extractList`); input `web.user.data_extraction_defined` | `content/actions/extract-list.ts`, `content/extraction/field-spec.ts`, `content/extraction/field-reader.ts` | `item` selects each record's root and `fields` maps a record field key to what is read inside it, in the scenario contract's own forms: a plain selector reads text, an empty one the item itself, `selector@attribute` an attribute, and `column:<header text>` the cell under that header so extraction survives a column reorder. The records become `result.extracted`, and the post-condition is that at least `minItems` records were read and every **required** field appeared in every one — a field some record lacked is `output_not_observed` naming it, so a list that quietly dropped a column cannot pass. A field may instead be a structured spec naming its kind: `text`, `attribute`, `link` (an `href` resolved against the page, http(s) only), `value` (a control's live value) and `column`. `required: false` marks a field a record may lack, which carries `null` rather than failing the read (D16), and `handling` decides the column: an `exclude` column is never read at all — not read and then removed (D12) — and `encrypt` is refused as `web.action.not_implemented` until Core builds it. Values are strings, or `null` for an optional field the page could not read. A recorded extraction replays as this verb: the picker records the definition, and the node it becomes carries the dataset to save into and a timeout scaled by the pages it may follow ([Recorded Actions](#recorded-actions)). |
| Repeating/list elements | Fully supported | Yes | `web.dom.extract_list` | `content/extraction/list-reader.ts`, `content/extraction/infer-list.ts` | `querySelectorAll` over the item selector returns the whole collection, bounded by `maxItems`, and each record is read independently. The request can also be inferred rather than written: the `extraction.propose` content message (`content/message-handler.ts`) answers a picked element with the run it belongs to — its siblings sharing the template signature page evidence groups repeating runs by, so both name the same run — a selector accepted only when it matches exactly that run, one field per test id, link, image, table column or text leaf with its coverage across the run, the pagination control beside the list, and a confidence. A field whose element is, or sits inside, a sensitive control is proposed `handling: "exclude"` (D12). A proposal carries selectors, labels built from structure, and counts, never a value read from the page (D3). The single-element verbs resolve exactly one target (`content/action-runtime/resolve-target.ts`); acting on each item of a list is a Flow over an extraction, not one action. The picker asks that same inference of the element the user pressed on, so what a pick proposes and what the message answers are one inference ([the extension client architecture](extension-client.md#defining-an-extraction)). |
| Pagination | Fully supported | Yes | `web.dom.extract_list` with `paginate` and `maxItems` | `content/extraction/pagination.ts`, `content/extraction/detect-pagination.ts`, `domain/src/client/gateway-action-parameters.ts` | Four modes, named by `mode`: `next` (what an absent mode means), `loadMore`, `scroll` and `numbered`. In `next` the control is clicked and the read repeats until it is absent or `maxPages` pages have been read — bounded at `WEB_AUTOMATION_EXTRACT_MAX_PAGES` (50) on both sides of the wire. After each page the verb waits up to 10 s for the list to actually change (detached first item, a different first item, or a different count) rather than for a fixed delay, and a `next` that was followed without the list ever changing fails the action instead of ending the read quietly. Stopping at the cap with a `next` still present is reported as `truncated`; an absent `next` is the list ending. `loadMore` presses its control until the control detaches or reports itself disabled; `scroll` scrolls the list's own scroller and de-duplicates by element *and* content, so a virtualised list that recycles a node for a new record still yields it (D16); `numbered` visits each page control in turn, each exactly once. Every bound is held to the same 50, and stopping at one while the list could go on is `truncated`. Detection proposes `next`, `loadMore` or `numbered` from the controls beside a list — never `scroll`, which only the user picks, because an infinite feed looks like an ordinary list that ends. |
| Open tab | Fully supported | Yes | `web.browser.tab` with `operation: "open"`; also `web.browser.navigate` with `newTab` | `runtime/browser-tab.ts`, `runtime/automation-tab.ts` | Opens a tab, optionally at a URL and optionally in the background, and points the automation tab at it so the next action runs there. With a URL it waits for the tab to settle and compares where it landed, through the same tolerant comparison navigate uses; without one it reports the tab id and address it opened at. Never exercised in a browser: `chrome.tabs` does not exist in the unit runner and no harness covers the background worker. |
| Switch tab | Fully supported | Yes | `web.browser.tab` with `operation: "switch"` and a `tabId`, `urlPattern` or `urlPath`; input `web.user.tab_switched`; the gateway server command `set_active_tab` also activates a tab | `runtime/browser-tab.ts`, `runtime/automation-tab.ts`, `runtime/command-options.ts`, `background/connection/tab-recorder.ts` | Selects the tab with the given id; else, for a `urlPath`, the newest tab whose URL path is exactly that path; else the first whose URL contains the given substring. A path match ignores the origin and never takes a browser or extension page, and it waits for a tab that is still opening, looking again every 100 ms until the command's timeout, or 10 s when it names none. An id or a substring does not wait. "Any tab" is refused rather than picked arbitrarily, and nothing matching is `target_not_found`, expecting `a tab at path "<path>" active` for a path. The switch activates the tab and re-points the automation tab at it. It also remembers the tab the Flow was on, which is the page in front, or the tab that opened the target when the browser has already fronted it, so a later close returns there. A recorded switch replays by its path ([Recorded Actions](#recorded-actions)). A command's own `tabId` and `frameId` are separate from this and reach the runner — `browserTabId`/`browserFrameId` are read onto the command and the runner addresses that frame — so a content action is not confined to frame 0 of one tab. Never exercised in a browser. |
| Close tab | Fully supported | Yes | `web.browser.tab` with `operation: "close"`; input `web.user.tab_closed` | `runtime/browser-tab.ts`, `runtime/automation-tab.ts`, `background/connection/tab-recorder.ts` | Closes the named tab, or the automation tab when none is named, forgets it, and confirms the close by re-reading the tab: one that is still open reports `failed`, not success. Closing the automation tab then fronts the most recently driven tab that is still open, from a history of the last 8 driven tabs, and that tab is the automation tab again. So the actions after a close run where the person who recorded it landed. Closing a named tab that is not the automation tab fronts nothing. Closing with no tab named and none open is refused as ACTION_REJECTED, with the reason in the record’s `actual`. Never exercised in a browser. |
| Downloads | Partially supported | Yes | `web.browser.download` (parameter `download`) | `runtime/browser-download.ts`, `apps/extension/manifest.chrome.json`, `manifest.firefox.json`, `manifest.e2e.json` | Waits for a download to complete — optionally the one with a given file name, matched on the base name and accepting the browser's `name (1).ext` form — through `chrome.downloads`, with a 30 s default bounded to 1–120 s and a 15 s lookback so a download that finished between the click and the wait still counts. A timeout is `timed_out` with Core's `timeout` category. The `downloads` permission is declared in all three manifests, and a build without it fails as a capability refusal rather than hanging. The action only observes: it cannot start a download, choose a destination, or assert anything about the file beyond its name. The wait loop has never run in a browser. |
| Basic file uploads | Fully supported | Yes | `web.dom.upload` (parameter `upload`); input `web.user.files_chosen` | `content/actions/upload.ts`, `content/action-runtime/file-input.ts`, `domain/src/client/gateway-action-parameters.ts`, `domain/src/output-nodes/upload-binding.ts` | Files travel inline as base64 because the page, not the worker, owns the input; they are built into a `DataTransfer`, assigned to the input, and followed by `input` and `change`. The names the input ended up holding are read back off the element, and the post-condition passes only when they are exactly the names asked for, in order, so an upload that put nothing anywhere reports `failed`. The validation compares names but quotes none: `expected` and `actual` say only how many files there are and whether their names match, and a refusal names a file by its position. A chosen file's name is the user's data, and what the verb writes there is kept in Core's saved command attempt. A target that is not a file input, a command with no files, a single-file input given several files, and malformed or oversized content are all refused before anything is dispatched; the 1 MiB per-file and 4 MiB total bounds are enforced by the domain on the way in and again in the page. File contents never appear in a result, a message, or a log. Multi-file uploads are coded but untested. A recorded file choice replays as this action, asking for its files at run time rather than carrying any, and a command whose request the run did not answer is refused before dispatch ([Recorded Actions](#recorded-actions)). |
| Form interaction | Partially supported | Yes | composed from `web.dom.check`, click, type, clear, select, and Enter; `dom.submit` remains a recording event kind only | `content/actions/check.ts`, `content/action-runtime/checkable-state.ts`, `content/action-runtime/keyboard/implicit-submission.ts`, `domain/src/io/input-model.ts` | A checkbox or radio is set to a state rather than toggled, which is what makes a replayed step idempotent, and `checked` is read back after the control's own events run, so a handler that reverted the change reports `failed`. A control that is not checkable, one that is `:disabled` or `aria-disabled` — a disabled `<fieldset>`'s descendants included — and unchecking a radio, which no user gesture can do, are each ACTION_REJECTED rather than faked. `web.dom.check` does not use the actionability gate: it has its own disabled check and does not hit-test, so a control covered by an overlay is still set. There is no submit action — a form is submitted by Enter in a field or by clicking its button — a recorded submit maps to no input, and validation errors are not observed. |
| Dynamic elements | Partially supported | Yes | the two wait actions, `web.dom.assert`, the actionability gate, and the wait a recording proposes before a late click target | `content/action-runtime/wait-conditions.ts`, `content/action-runtime/actionability.ts`, `content/action-runtime/resolve-target.ts`, `domain/src/recording/proposals/late-target-wait.ts` | The gate scrolls a target into view and refuses one that is not yet visible or not yet enabled, with a code saying which, so an action against a half-rendered page fails for a stated reason instead of appearing to work; `web.dom.assert` re-queries its selector until its claim holds or the timeout passes. But no acting verb waits first: `resolveTarget` tries its strategies and then scores the page's candidates once and throws, and nothing in the action path polls or retries. A recording supplies the wait where it saw the page add the target: a recorded DOM addition followed by a click in the same top document proposes `web.dom.wait_for_selector` on that click's selector, ahead of the click ([Recorded Actions](#recorded-actions); how it is recorded and proposed in [the extension client architecture](extension-client.md#a-wait-before-a-late-target)). Every other late target needs a wait authored before the action: in a Flow built by hand, for any verb but a click, for a click in a child frame, and for a target the page revealed without adding a node. |
| Modal/dialog interaction | Partially supported | Yes | `web.dom.dialog` (parameter `dialog`); DOM modals are ordinary elements | `content/actions/dialog.ts`, `content/action-runtime/dialog-control.ts`, `page-world/dialog-override.ts`, `shared/dialog-channel.ts` | A native dialog blocks the page's script, so the answer is armed before the dialog opens: `alert`, `confirm`, and `prompt` are replaced in the page's own world at `document_start`, ahead of any page script, and the verb arms the next dialog's response — accept, dismiss, or accept with `promptText` — through a synchronous DOM handshake. Arming that is not acknowledged means the override is not installed, and the verb fails at once as `dialog_override_missing` rather than arming something nothing will answer. An unarmed dialog is left alone: the page behaves as it would without the extension, and what was answered is recorded as evidence the next action reports. Two gaps: `beforeunload` is in the observed-dialog union but is not a function that can be replaced, so it is unhandled; and `world: "MAIN"` is honoured only from Chrome 111 and Firefox 128, while the Firefox manifest admits 109, so on Firefox 109–127 the override lands in the isolated world and every dialog action fails honestly instead of working. |
| URL checks | Fully supported | Yes | `web.dom.assert` with `kind: "url"`; also the `url` wait condition and navigate's landed-URL comparison | `content/actions/assert.ts`, `content/action-runtime/assertion-evaluation.ts`, `runtime/navigation-outcome.ts` | An authored claim about the address, retried until it holds or the timeout passes (5 s by default, `timeoutMs: 0` for a single immediate check). The landed URL counts as the requested one when it equals it, contains it, or resolves to it against the document's base. A claim that does not hold is STATE_MISMATCH — Core's `unexpected_state`, not retryable, at the `verification` stage — not `output_not_observed`, because the difference between a wrong expectation and an action that did not take is how a Flow recovers. A claim whose subject never appeared at all has not been judged against the page but has run out of time waiting for it, and is `timed_out`. |
| Element existence checks | Fully supported | Yes | `web.dom.assert` with `kind` `exists`, `visible`, or `enabled` | `content/actions/assert.ts`, `content/action-runtime/assertion-evaluation.ts` | The claim is judged immediately and then polled every 50 ms until the deadline, so an element that arrives late satisfies it and a wrong claim fails fast instead of costing a full wait timeout. The selector is re-queried on every attempt rather than resolved once; an element handed over without a selector must still be connected. `exists` with neither a selector nor an element is reported as such rather than guessed at, and an assertion's target may come from coordinates, visual bounds, or a fingerprint, in which case a miss leaves an empty target reported as "nothing matched" rather than a throw. |
| Element nonexistence checks | Fully supported | Yes | `web.dom.assert` with `kind: "absent"`; also the `absent` wait condition | `content/actions/assert.ts`, `content/action-runtime/wait-conditions.ts` | Absence is a first-class outcome on both paths: the assertion holds when nothing matches the selector, or when the element handed to it has detached, and the wait condition satisfies when the selector matches nothing or the text has gone. A spinner disappearing is therefore expressible both as a claim that fails fast and as a wait that reports `timed_out` if it never goes. |

## Actions Outside The 24

- **`web.dom.capture_snapshot`** is a real action type, output node, and
  manifest output, executed by `content/actions/capture-snapshot.ts`. It
  captures evidence rather than performing a browser capability, takes no
  parameters, has no action input, and is classified safe. Its result declares
  `validation: none` with the reason `evidence-only`.
- **Legacy dotted aliases** (`browser.navigate`, `dom.click`, and the rest) are
  accepted on the wire and resolved to their canonical types once, in the
  domain (see below). The map is total over all eighteen types. For seven of
  them — `web.dom.check`, `web.dom.assert`, `web.dom.extract_list`,
  `web.dom.upload`, `web.dom.dialog`, `web.browser.tab` and
  `web.browser.download` — the alias exists only so the two directions cannot
  drift. The content-script dispatcher matches
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
  failure record rather than rewritten into another action.

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
run never prompts for them — the two waits, extract, capture_snapshot,
`web.dom.assert` and `web.dom.extract_list`. The twelve that act on the page or the browser are
`review`, including `web.dom.check`, `web.dom.upload`, `web.dom.dialog`,
`web.browser.tab`, and `web.browser.download` (decision D6). The manifest
output's `safety.level` and `requiresApproval`
(`domain/src/io/manifest-definitions.ts`) and the output node's safety fields
(`domain/src/output-nodes/definitions.ts`) both derive from it, and its
`Record` type forces a classification for every new action type.

### Recorded Actions

Twelve recorded action inputs are bound to eleven outputs
(`actionInputDefinitions` in
[`domain/src/io/input-model.ts`](../../domain/src/io/input-model.ts)). Each
input has exactly one output, and the two tab inputs share one:

| Input | Output |
| --- | --- |
| `web.user.navigation_requested` | `web.browser.navigate` |
| `web.user.element_clicked` | `web.dom.click` |
| `web.user.text_entered` | `web.dom.type` |
| `web.user.field_cleared` | `web.dom.clear` |
| `web.user.option_selected` | `web.dom.select` |
| `web.user.checkbox_toggled` | `web.dom.check` |
| `web.user.key_pressed` | `web.dom.keypress` |
| `web.user.page_scrolled` | `web.dom.scroll` |
| `web.user.files_chosen` | `web.dom.upload` |
| `web.user.tab_switched` | `web.browser.tab` |
| `web.user.tab_closed` | `web.browser.tab` |
| `web.user.data_extraction_defined` | `web.dom.extract_list` |

Because two inputs share `web.browser.tab`, nothing derives an input from that
output alone: the input comes from the event's `tab.operation`. Assert,
dialog, download, `web.dom.extract`, the waits and capture_snapshot are
dispatch-only. No recorded user event maps to one, so their recorded payload is
empty by construction. `web.dom.extract_list` is not among them: an extraction
the user defined with the picker is recorded as `data.extract` and replays as
that verb.

A single-value definition is read by the domain and maps to no input. The
picker refuses to start a `value` pick and refuses one that arrives anyway, and
the confirm path refuses a `value` definition on the run path, so nothing can
produce the event; an input registered for it would advertise a trigger that
never fires, which is the mirror of an unmapped input becoming executable. When
the picker can record a single value, the input comes back as one row.

One function, `webAutomationRecordedAction`, maps a recorded event to its
input, output, and parameters. The live gateway path
(`webAutomationInputIdForRecordedEvent`) and the recording-to-Subflow proposal
mapper (`mapWebRecordingObservation` in `domain/src/web-panel-host.ts`) both
call it. An event is therefore executable on one path exactly when it is on
the other, with the same parameters, including the element fingerprint and
visual target that replay falls back on. An event is executable only when
every parameter its output's schema requires is present; otherwise it stays
evidence. Present means a non-empty string or a request for a withheld secret,
with two exceptions: `upload` must be an upload request, and `tab` must be a
close or a switch that names a path. Beyond the schema, a key press needs a
key, a scroll a coordinate, and a check a known state.

- A navigation is an action only when it was typed, and never the navigation
  that marks where a recording began.
- Scroll is keyed on the `dom.scroll` event the recorder emits. `dom.wheel` is
  never emitted and maps to nothing.
- An input or change on a file input becomes upload, on a `<select>` select,
  and on a checkbox or radio check. On any other control an empty value becomes
  clear and any other value becomes type. The file input is tested first, so a
  file choice never becomes typing or clearing.
- **A checkbox toggle is an action only when its state is known.**
  `web.dom.check` needs the state the control was left in.
  `recordedCheckedState` (`domain/src/output-nodes/payloads.ts`) reads the
  descriptor's `checked`, which `content/describe-element.ts` reports for a
  checkbox or radio input. A sensitive checkbox withholds it, so its toggle
  stays evidence. A radio needs no recorded state: its `change` can only mean
  "now selected", so it maps to `checked: true`.
- A key press on a `<select>` whose only effect is the value change — an arrow,
  Home, End, Page Up/Down, or any single character — is evidence, because the
  recorder already reports that change as its own event.
- **A file choice replays as an upload that asks for its files at run time.**
  - The node's `upload` is Core's state binding
    `{ "$state": { "path": "web.upload.<key>" } }`, with no `fallback`
    ([`domain/src/output-nodes/upload-binding.ts`](../../domain/src/output-nodes/upload-binding.ts)),
    so an unsupplied upload fails instead of uploading nothing.
  - The key comes from `webAutomationRecordedElementKey`
    (`domain/src/output-nodes/recorded-element-key.ts`), the rule a withheld
    secret's request is keyed by: the visual target's state id, else the
    authored test id, `id` or `name`, else the selector.
  - The node carries no file name, count or content, and its element
    fingerprint drops `value`.
  - A run supplies the files as the input `web.upload.<key>`, shaped
    `{ files: [{ name, mimeType, contentBase64 }] }`. A command whose request
    the run left unanswered is refused before dispatch as
    `USER_INTERVENTION_REQUIRED`, naming the parameter and its path only.
- **A cancelled or emptied file choice stays evidence.** A file input recorded
  with `hasValue: false`, or with an `inputValue` of `""`, was left holding no
  files, and no upload reproduces that. A control with nothing to key a request
  on builds no request, and stays evidence too.
- **A tab switch or close replays through `web.browser.tab`.**
  - The recorded payload's `tab` decides the input: `switch` maps to
    `web.user.tab_switched`, `close` to `web.user.tab_closed`, and an entry
    with no `tab` to nothing. The recording-start marker is a `browser.tab`
    event with no `tab`, so it stays evidence.
  - A close builds `{ tab: { operation: "close" } }`.
  - A switch builds `{ tab: { operation: "switch", urlPath } }` and is
    executable only with its path. A path that is not a bare pathname is left
    off rather than trimmed, so that switch stays evidence.
  - No tab id, origin or query is ever written.

  What the recorder counts as a switch or a close is in
  [the extension client architecture](extension-client.md#recording-evidence).
- **An action recorded in a child frame also carries its frame's path.** Beside
  `browserFrameId`, the node gains `browserFrameUrlPath`, the pathname of the
  `url` recorded with the event, which the content script in that frame reports
  as its own document's address. Only a `web.dom.*` node with parameters,
  recorded in a frame above 0 at an http(s) URL, gains one. A top-frame node,
  and a node from an `about:`, `srcdoc` or `blob:` document, never carries a
  path. Replay is under [Child Frames](#child-frames).
- **An extraction the user picked replays as `web.dom.extract_list`.** The
  recorded event is `data.extract`, whose payload is the definition and nothing
  else — no element descriptor, because the element a list extraction was defined
  on is the list and a descriptor would hold its text.
  - `webAutomationRecordedExtraction`
    ([`domain/src/actions/extraction/recorded-definition.ts`](../../domain/src/actions/extraction/recorded-definition.ts))
    rebuilds the definition field by field, so only selectors, field keys,
    labels, counts and the dataset's id and name are stored. A definition it
    refuses stays evidence rather than becoming an extraction that reads
    something other than what was picked.
  - **An excluded column is never read.** It stays in the request declared
    `handling: "exclude"`, and `content/extraction/field-spec.ts` drops it before
    anything on the page is read, so no value of it reaches the records, the
    dataset, an export or the saved trace. The declaration is kept because it is
    the record of the user's decision: without it, field detection proposes the
    column again next time.
  - The node carries a `recordOutput` — the dataset the rows are saved into — and
    a `timeoutMs` from `webAutomationExtractListTimeoutMs`, the per-page wait
    times the pages the request may follow. It carries no `expectedConfirmation`,
    because no extract action is confirmed.
  - A `value` definition maps to `web.dom.extract`, and nothing produces one:
    the extension refuses to start a single-value pick and refuses one that
    arrives anyway. How a pick becomes a definition is in
    [the extension client architecture](extension-client.md#defining-an-extraction).
- Submit, mutation, snapshot, and the never-emitted focus and blur map to no
  input.
- **A page addition before a click proposes a wait for that click's target.**
  A mutation maps to no input, but the recording mapper still reads it. A batch
  that added at least one node proposes `web.dom.wait_for_selector`, with
  `{ selector, wait: { condition: "present" } }`, for the selector of the click
  after it
  ([`domain/src/recording/proposals/late-target-wait.ts`](../../domain/src/recording/proposals/late-target-wait.ts)).
  - The first executable entry after the addition decides, and it must be a
    `web.dom.click` with a non-empty selector. Evidence between the two is
    skipped, unless it names another URL.
  - The click must replay in the top document. Its URL, when it carries one,
    must be the addition's apart from the fragment. A click recorded in a child
    frame proposes nothing.
  - The wait is proposed from the addition's own entry, never the click's
    (`mapWebRecordingObservation` in `domain/src/web-panel-host.ts`), because a
    candidate returned for a click's `action` entry replaces the click Core
    would propose.
  - It carries no source input, because Core refuses one that is not an
    action input, and no expected confirmation, because a wait has no echo to
    confirm.

  How the addition is recorded ahead of the click, and how the mapper proposes
  the wait, is in
  [the extension client architecture](extension-client.md#a-wait-before-a-late-target).

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
The tab recorder likewise records no tab change made while FluxIQ is running a
command, so a replayed switch or close is recorded once, as its confirmation.

The recorder sends no file input value. `readElementValue`
([`content/describe-element.ts`](../../apps/extension/src/content/describe-element.ts))
returns nothing for a file input, because its value is the chosen file's local
name. So the input's descriptor carries no `value`, its `input` and `change`
carry no `inputValue`, and the snapshot ranks it without one. Its descriptor
still carries `inputType: "file"` and `hasValue`.

A succeeded runtime action that has a recorded counterpart is also sent as a
recording event carrying its input ID (`runtimeConfirmationForActionResult` in
[`background/connection/runtime-status.ts`](../../apps/extension/src/background/connection/runtime-status.ts)).
Every recorded executable verb but the two extract verbs has a confirmation:

| Output | Event kind | Input | Also carries |
| --- | --- | --- | --- |
| `web.browser.navigate` | `browser.navigation` | `web.user.navigation_requested` | — |
| `web.dom.click` | `dom.click` | `web.user.element_clicked` | — |
| `web.dom.type` | `dom.input` | `web.user.text_entered` | the value the field was left holding |
| `web.dom.clear` | `dom.input` | `web.user.field_cleared` | `inputValue: ""` |
| `web.dom.select` | `dom.change` | `web.user.option_selected` | the value the field was left holding |
| `web.dom.check` | `dom.change` | `web.user.checkbox_toggled` | no value |
| `web.dom.keypress` | `dom.keydown` | `web.user.key_pressed` | — |
| `web.dom.scroll` | `dom.scroll` | `web.user.page_scrolled` | — |
| `web.dom.upload` | `dom.change` | `web.user.files_chosen` | no value |
| `web.browser.tab`, a switch | `browser.tab` | `web.user.tab_switched` | `tab: { operation: "switch", urlPath }` |
| `web.browser.tab`, a close | `browser.tab` | `web.user.tab_closed` | `tab: { operation: "close" }` |

Each is a `client.recording_event` sent after the action's
`client.action_result`, with `metadata.runtimeConfirmation: true` and the
result's element, visual target and snapshot. An action that did not succeed
confirms nothing, and neither does a tab `open`. Neither extract verb confirms
either, which is why a recorded extraction's node declares no expected
confirmation: Core waits for one whenever it is set, and a confirmation nothing
sends would fail every replay.

A tab confirmation's input depends on the operation the command asked for,
which the result does not carry. `RuntimeStatusTracker.startAction` keeps the
command's `tab` request, and `tabRequestFor` hands it back only for that
command's id. The confirmation's `tab` has the recorded payload's shape, so the
domain maps a replayed tab change as it maps a recorded one:
- a switch's `urlPath` is the pathname of the page the switch left in front,
  never its origin or query;
- that path is absent when the result has no readable URL, when the page is one
  a recording cannot see or has an opaque origin such as a `file:` page, or when
  the path rule refuses its path, and the domain then keeps the switch as
  evidence;
- a close carries no path.

The `type` and `select` confirmations carry the value read from the result's
element descriptor, which the content script fills only while input-value
capture is on. A field that matches the recorder's sensitivity rule carries no
value. A sensitive control's value reaches none of these paths — not the
descriptor, not the recorded event, not the confirmation — and a validation
that has to describe one names its length instead of quoting it; see
[sensitive values](sensitive-values.md).

### Child Frames

A frame id belongs to one tab, and Chrome gives a frame a new one each time it
navigates. A Flow loads its start page before it runs, so the id a recording
captured can name no frame on replay. A command recorded in a child frame
therefore also names the frame by its document's path, `frameUrlPath`, lifted
from the node's `browserFrameUrlPath`. The path is the address, and the
recorded id only breaks a tie.

`runActionInFrame`
([`runtime/action-runner.ts`](../../apps/extension/src/runtime/action-runner.ts))
reads the path through `frameUrlPathForAction` (`runtime/command-options.ts`),
lists the tab's frames, and sends the action where `chooseFrame`
([`runtime/frame-address.ts`](../../apps/extension/src/runtime/frame-address.ts))
says:

| When | The action goes to |
| --- | --- |
| the command carries no path | the recorded id, and no frames are listed |
| the browser lists no frames, because it would not say | the recorded id |
| one child frame is at the path | that frame, whatever the recorded id |
| several child frames are at the path | the recorded id when it is one of them; otherwise nowhere, failing as `TARGET_AMBIGUOUS`, not retryable, with the count |
| no child frame is at the path | nowhere, failing as `TARGET_NOT_FOUND`, retryable because a frame the page is still creating may appear, naming the path and each child frame's path |

Only the pathname of an http(s) document is compared. The origin differs from
run to run, and a query may carry a token. An `about:`, `data:` or `srcdoc`
frame never matches. The top frame is never a candidate, because the domain
gives a path only to a node recorded in a child frame. A refusal names paths
only, never a full URL, and is reported against the recorded id. Otherwise the
frame chosen is the one then checked, pinged, addressed and reported.

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
  `web.action.rejected`, category `blocked_by_capability_or_policy`, never
  retryable, with the capability's own reason in the record's `actual`;
- a wait or an action that ran out of time is `timed_out` with Core's `timeout`
  category, never flattened to `failed`;
- an authored assertion that does not hold is STATE_MISMATCH
  (`web.validation.state_mismatch`, category `unexpected_state`), which is a
  different thing from an action whose effect did not appear.

Every code these builders name comes from the closed set in
`domain/src/runtime/failure/codes.ts`, which also fixes each code's category,
retryable flag and stage; the whole set and the compile-time rule that keeps
it closed are in [the failure taxonomy](failure-taxonomy.md).

Validation text is whitespace-collapsed, never empty, and bounded to 1 024
characters on both sides of the wire, because Core's parser drops an
over-long record whole rather than truncating it. The record survives the
boundary: `gatewayActionResultFromBrowserResult` (`runtime/result-mapping.ts`)
forwards `result.failure` and gives every non-succeeded status its message as
the `error`, and `dispatchWebAutomationOutput`
(`domain/src/io/gateway-output-dispatcher.ts`) passes the command's own status
through, so Core sees `timed_out` rather than a bare failure. `cancelled` is
declared in the status union, and nothing in this repository produces it.

### Expected State, And The Expectation Seam

`web.dom.assert` is not only a verb a Flow can author. Its condition
vocabulary is also how Core asks the host whether a Flow's expectations hold.

Every web output node declares an `expectedState` parameter
(`domain/src/output-nodes/definitions.ts`), shaped
`{ conditions: [{ kind, selector?, expected?, timeoutMs? }], mode?, timeoutMs? }`
with `kind` one of the six `WebAutomationAssertKind` values and `mode` `all` or
`any`. Nothing else in this repository writes that path, and without it Core's
transition comparison falls back to counting keys of an object that is never
there.

Core reads it from two places -- the `builtin.policy.expectation` node and the
transition comparison that follows a successful attempt -- and hands the
conditions to the host boundary's `expectationEvaluator`. This repository binds
that evaluator in `domain/src/runtime/expectation/`, on the same boundary
object as the host runtime's state snapshot and diff
(`domain/src/runtime/host-runtime.ts`, bound by
`bindWebAutomationHostRuntime`), so a host that binds a runtime gets the
evaluator with it and there is nothing to forget.

The judgement happens in the browser. Each condition is dispatched as a
`web.dom.assert` action, because that verb already knows how to wait for a
claim, re-query its selector on every attempt, and report what it saw instead.
Re-implementing `exists` or `visible` in the domain would mean a second
definition of the same words, judged against a stale snapshot.

Three rules keep the seam honest:

- **It never throws.** Core's expectation node awaits the evaluator with no
  catch of its own, so a throw would become a node execution error and a false
  red. An evaluator that breaks reports Core's default pass with nothing
  checked, and says why.
- **A condition that could not be judged is not a condition that failed.** An
  unreadable shape, a client that never answered, a cancelled run, or any
  dispatch status other than `failed` and `timed_out` is left out of
  `checkedConditionCount` and cannot reject the expectation. With nothing
  judged the verdict is an unconditional pass, with a message saying so.
- **No code is written here.** `STATE_MISMATCH` and `TIMEOUT` come from the
  closed set, and a client that reported a code from that same set keeps its
  own record: it stood nearest the page.

Two condition shapes are accepted, because two producers write them: the flat
`{ kind, expected, selector }` a Flow author writes, and the
`{ selector, assert: { kind, expected } }` an authored or recorded
`web.dom.assert` node carries. The kind table is exhaustive by construction, so
a seventh assert kind stops `conditions.ts` compiling rather than being
silently dropped as unreadable.
