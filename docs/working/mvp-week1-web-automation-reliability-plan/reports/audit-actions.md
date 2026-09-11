# Report: audit-actions

Audit of the Phase 1.1/1.2 browser action surface. Read-only; repository at
`d848536` on `dev`. Every claim cites `path:line` or an exported symbol.

## Outcome

Done. The 24-row capability matrix, the extra-actions list, the dead/superseded
list, and the ranked top-five gaps are below. Eleven action types exist; of the
24 plan capabilities, 1 is fully supported, 10 partially, 3 unreliable, and 10
unsupported. No action in the repository validates its own outcome.

## What changed and why

Nothing changed. Read-only investigation, as the brief requires.

## The Action Vocabulary As It Exists

Eleven action types, defined once in `domain/src/actions/types.ts:3-14` and
re-exported as `WEB_AUTOMATION_ACTION_TYPES` (`:63-75`):

`web.browser.navigate`, `web.dom.click`, `web.dom.type`, `web.dom.clear`,
`web.dom.select`, `web.dom.scroll`, `web.dom.keypress`,
`web.dom.wait_for_selector`, `web.dom.wait_for_text`, `web.dom.extract`,
`web.dom.capture_snapshot`.

Each one becomes, mechanically and with no per-action exceptions:

- a JSON parameter schema — `domain/src/actions/schemas.ts:52-99`
  (`webAutomationActionDefinitions`);
- an Automation Studio output node `web.output.<suffix>` —
  `domain/src/output-nodes/definitions.ts:14` (`webAutomationOutputNodeId`),
  `:18` (`webAutomationOutputNodeDefinitions`);
- a manifest output — `domain/src/io/manifest-definitions.ts:111`
  (`webAutomationManifestOutputs`);
- a registered domain output whose dispatch is
  `domain/src/io/gateway-output-dispatcher.ts:124`
  (`dispatchWebAutomationOutput`) — `domain/src/io/web-automation-io.ts:95-99`.

Seven of the eleven additionally have a recorded **action input** that binds to
exactly one output (`domain/src/io/input-model.ts:46-54`,
`actionInputDefinitions`). The four with no action input — both waits, extract,
and capture_snapshot — are flow-authored only and can never arrive from a
recording.

Execution path for a gateway-issued action:

`server.execute_action` → `apps/extension/src/background/connection/gateway-session.ts:276`
→ `browserActionFromGatewayCommand`
(`apps/extension/src/runtime/result-mapping.ts:226` →
`domain/src/client/gateway-mapping.ts:112` `webAutomationActionFromGatewayCommand`)
→ `apps/extension/src/background/connection.ts:517-524`
→ `ExtensionRuntimeCommandRouter.executeAction`
(`apps/extension/src/runtime/command-router.ts:20`)
→ `runBrowserActionCommand` (`apps/extension/src/runtime/action-runner.ts:18`)
→ for navigate, `chrome.tabs.create` via
`apps/extension/src/runtime/automation-tab.ts:5`; for everything else,
`sendToTab` → `apps/extension/src/content/message-handler.ts:45`
→ `executeAction` (`apps/extension/src/content/action-runtime.ts:30`)
→ `executeContentAction` (`apps/extension/src/content/actions.ts:37`).

Two facts govern the whole matrix:

1. **There is no outcome validation anywhere.** `success()`
   (`apps/extension/src/content/action-runtime.ts:107-130`) is called
   unconditionally at the end of each branch; the only way to get `failed` is
   for the branch to throw, caught at `apps/extension/src/content/actions.ts:289`.
   No branch reads the DOM back to confirm the action took effect. Grep for
   assertion machinery in `domain/src` and `apps/extension/src` outside tests
   returns nothing.
2. **There is no retry and no actionability pre-check.** Grep for
   `retry|retries|attempt` across `apps/extension/src/runtime`,
   `apps/extension/src/content`, `domain/src/actions`, `domain/src/output-nodes`
   and `domain/src/io` returns nothing. Only the two explicit wait actions wait.

## Capability Matrix (30-day plan Phase 1.2, 24 capabilities)

| Capability | Representation | Executes at (file:symbol) | Browser state observed after | Outcome validation | Classification (reason) |
| --- | --- | --- | --- | --- | --- |
| Navigate | action `web.browser.navigate`; node `web.output.browser-navigate`; input `web.user.navigation_requested` (`domain/src/io/input-model.ts:47`) | `apps/extension/src/runtime/action-runner.ts:18` `runBrowserActionCommand` (:20-45) → `apps/extension/src/runtime/automation-tab.ts:5` `resolveAutomationTab` → `chrome.tabs.create`. Never reaches the content script | None in the result: no `title`, no `element`, no `snapshot`; `url` is echoed from the request (`action-runner.ts:40`) | `waitForTabReady` (`automation-tab.ts:38-71`) polls 250 ms until `status === "complete"` and URL unchanged 1 s, caps at 20 s and resolves regardless; landed URL never compared to requested | **Partially supported** — opens a *new tab on every call* (`forceNew = true`, `action-runner.ts:23`) and reports the requested URL as `succeeded` without checking where the browser landed |
| Click | action `web.dom.click`; node; input `web.user.element_clicked` | `apps/extension/src/content/actions.ts:56-61`; target from `action-runtime.ts:61` `resolveTarget` | `describeElement` (`content/describe-element.ts:85`) + `captureSnapshot` (`content/dom-snapshot.ts`) attached by `success` (`action-runtime.ts:127`) | None — `succeeded` whenever `.click()` does not throw | **Unreliable** — untrusted `HTMLElement.click()` with no pointer-event sequence, no disabled/visible/hit-test pre-check and no post-click assertion, so a disabled or overlay-covered control still returns `succeeded` |
| Type text | action `web.dom.type`; node (param `text`); input `web.user.text_entered` | `apps/extension/src/content/actions.ts:62-68` → `setElementValue` (`action-runtime.ts:136`), `dispatchInputEvents` (`:142`, one `input` + one `change`) | `describeElement` + snapshot | None — the typed value is never read back | **Partially supported** — native prototype setter works for `<input>`/`<textarea>` including React-controlled fields, but no key events are emitted (type-ahead/combobox widgets never react) and `contenteditable` throws `Illegal invocation` because the `HTMLInputElement.prototype` value setter is called on a non-input |
| Clear text | action `web.dom.clear`; node; input `web.user.field_cleared` | `apps/extension/src/content/actions.ts:69-75` — same focus/set("")/dispatch path | `describeElement` + snapshot | None | **Partially supported** — same mechanism and the same contenteditable/key-event limits; no select-all + Delete path for fields that only react to keyboard deletion |
| Keyboard input | action `web.dom.keypress`; node (param `key`); input `web.user.key_pressed` | `apps/extension/src/content/actions.ts:91-97` — `new KeyboardEvent("keydown"/"keyup", { key, bubbles, cancelable })` | `describeElement(target)` + snapshot | None | **Unreliable** — untrusted events carrying only `key` (no `code`, no modifiers, no `keypress`/`beforeinput`) perform no default action, so Enter does not submit and Tab does not move focus, yet the result is always `succeeded` |
| Select/dropdown | action `web.dom.select`; node (param `value`); input `web.user.option_selected` | `apps/extension/src/content/actions.ts:76-82` — `element.value = action.value ?? ""` then `dispatchInputEvents` | `describeElement`, which carries `options` and `selectedValue` (`describe-element.ts:117-125`) + snapshot | None — the descriptor holds the post-state but nothing compares it to the request | **Unreliable** — assigning a value matching no `<option>` silently leaves the select unchanged and still returns `succeeded`; no select-by-label/index, no multi-select, and a custom non-`<select>` dropdown merely gains an expando property |
| Scroll | action `web.dom.scroll`; node (params `x`,`y`,`smooth`, `definitions.ts:80-84`); input `web.user.page_scrolled` | `apps/extension/src/content/actions.ts:83-90` — `window.scrollTo({ left, top, behavior })` | Snapshot only (no element) | None — the reached offset is not compared with the request | **Partially supported** — absolute top-window offsets only; no element/container scrolling, no relative delta, no scroll-until-stable, and `webAutomationOutputPayload` (`domain/src/output-nodes/payloads.ts:139-142`) replays the recorded *absolute* offsets, which do not transfer to a page of different height |
| Wait | actions `web.dom.wait_for_selector`, `web.dom.wait_for_text`; two nodes; **no** action input (absent from `actionInputDefinitions`) | `apps/extension/src/content/action-runtime.ts:147` `waitForElement`, `:167` `waitForText` — MutationObserver, 10 s default | Selector: `describeElement` + snapshot. Text: snapshot only | The wait *is* the check; a timeout throws and becomes `failed` via `actionFailure` (`action-runtime.ts:46`) | **Partially supported** — waits for existence / text presence only; no wait for visible, enabled, stable, absent, URL change or network idle, and a timeout reports `failed`, never `timed_out` (nothing in the repository produces that status) |
| Extract text | action `web.dom.extract` default branch; node; **no** action input | `apps/extension/src/content/actions.ts:51-55` → `extractElement` (`action-runtime.ts:184-190`) — control `value`, else normalized `textContent` | `describeElement` + snapshot; value lands in `result.extracted` and is forwarded by `webAutomationActionResultPayload` (`domain/src/client/gateway-mapping.ts:135`) | None — no expected-value comparison; an empty string is a success | **Fully supported** — for a single element's text |
| Extract attributes | same action with `options.mode = "attribute"` + `options.attribute` (`action-runtime.ts:187`) | same | same | None — a missing attribute yields `""` and `succeeded` | **Partially supported** — one attribute per call, and neither `mode` nor `attribute` appears in `selectorSchema` (`domain/src/actions/schemas.ts:43-50`), in `parametersForOutput` (`domain/src/output-nodes/definitions.ts:68-91`) or in the recorded payload (`payloads.ts:145`), so only a hand-built gateway command can reach it |
| Structured extraction | none | — | — | — | **Unsupported** — `extracted` is a single `JsonValue` (`domain/src/actions/types.ts:58`); no schema, field map or shape contract exists in `domain/src/actions` or `domain/src/output-nodes` |
| Repeating/list elements | none | — | — | — | **Unsupported** — `resolveTarget` (`action-runtime.ts:61-91`) uses `document.querySelector` / `elementFromPoint`, each returning at most one element, and no action returns a collection |
| Pagination | none | — | — | — | **Unsupported** — no repeat/until action, no next-page detection, no termination predicate; composing it in a flow needs failure branching that the native node implementation does not provide (see dead/superseded item 8) |
| Open tab | none as an action; a tab is created only as a side effect of navigate (`automation-tab.ts:11`) | — | — | — | **Unsupported** — no `web.browser.open_tab` action type, node, input or manifest output |
| Switch tab | gateway server command `set_active_tab` only (`apps/extension/src/shared/protocol.ts:293`, handled at `background/connection.ts:492-497` and `selectAutomationTab` `:376`) | `apps/extension/src/background/connection.ts:492` | Status emit + `sendBrowserState` | n/a | **Unsupported** as an automation capability — not an action type, output node or runtime capability, so no flow or policy can reach it; `WebAutomationActionCommand.tabId` (`actions/types.ts:35`) is never populated by `webAutomationActionFromGatewayCommand` (`gateway-mapping.ts:116-128`) |
| Close tab | none | — | — | — | **Unsupported** — no `chrome.tabs.remove` call anywhere in `apps/extension/src` |
| Downloads | none | — | — | — | **Unsupported** — no `downloads` permission in `manifest.chrome.json:16-23`, `manifest.firefox.json:14-20` or `manifest.e2e.json:16-23`, and no `chrome.downloads` usage; note `packages/test-contracts/src/scenario.ts:10` already declares a `download` scenario capability the client cannot satisfy |
| Basic file uploads | none | — | — | — | **Unsupported** — no `DataTransfer`/`File`/`input.files` handling; `web.dom.type` cannot work on `<input type=file>` because the value setter rejects a non-empty assignment |
| Form interaction | composed from click/type/clear/select; `dom.submit` exists only as a *recording event kind* (`shared/protocol.ts:226`) with no action counterpart and no case in `runtimeConfirmationForActionResult` (`background/connection/runtime-status.ts:82-97`) | `apps/extension/src/content/actions.ts` (several branches) | per-action `describeElement` + snapshot | None | **Partially supported** — fields can be filled, but there is no submit action, no set-checkbox/radio-to-state semantics (only a toggling click), and no observation of validation errors |
| Dynamic elements | the two wait actions plus the recorder's mutation events | `action-runtime.ts:147`, `:167` | snapshot (+ element for selector waits) | wait timeout only | **Partially supported** — waits must be authored explicitly; no mutating action auto-waits, and `resolveTarget` throws immediately when the element is not yet in the DOM, with no retry anywhere in the action path |
| Modal/dialog interaction | DOM modals are ordinary elements reachable by click/type; native dialogs have no representation | `apps/extension/src/content/actions.ts` | `describeElement` + snapshot | None | **Partially supported** — DOM-only; no `alert`/`confirm`/`prompt`/`beforeunload` handling anywhere and no `debugger` permission, so a native dialog blocks the content script and the action fails on the `chrome.tabs.sendMessage` round trip with a transport error rather than a dialog-specific one |
| URL checks | none as an action; the URL rides on every result (`action-runtime.ts:120`) and every snapshot | — | — | — | **Unsupported** — no action compares the URL to an expectation and no action can fail because of one |
| Element existence checks | `web.dom.wait_for_selector` is the nearest thing | `action-runtime.ts:147` | `describeElement` + snapshot | timeout → `failed` | **Partially supported** — presence can be established only by waiting, so an absent element costs the full timeout, and there is no immediate boolean an author can branch on |
| Element nonexistence checks | none | — | — | — | **Unsupported** — no wait-for-absence, and no action treats absence as success |

Tally of the rows above — **Fully supported 1**, **Partially supported 10**,
**Unreliable 3**, **Unsupported 10**; 24 rows total.

- Fully supported (1): Extract text.
- Partially supported (10): Navigate, Type text, Clear text, Scroll, Wait,
  Extract attributes, Form interaction, Dynamic elements,
  Modal/dialog interaction, Element existence checks.
- Unreliable (3): Click, Keyboard input, Select/dropdown. These are the three
  that can complete a no-op and still report `succeeded`.
- Unsupported (10): Structured extraction, Repeating/list elements, Pagination,
  Open tab, Switch tab, Close tab, Downloads, Basic file uploads, URL checks,
  Element nonexistence checks.

Against the plan's Phase 1.2 exit criteria, per capability: **represent** 14/24,
**execute** 14/24, **observe resulting browser state** 13/24 (Navigate executes
but returns no page state), **validate expected outcomes** 0/24.

## Actions That Exist But Are Not In The Plan's 24

- **`web.dom.capture_snapshot`** (`domain/src/actions/types.ts:14`) — a real
  action type, output node (`web.output.dom-capture_snapshot`) and manifest
  output, executed at `apps/extension/src/content/actions.ts:40-42`. It is an
  evidence-capture verb rather than a browser capability, which is why it is
  absent from the plan list. It carries no parameters
  (`definitions.ts:89`) and has no action input.
- **Legacy dotted action aliases** — `browser.navigate`, `dom.click`,
  `dom.type`, `dom.clear`, `dom.select`, `dom.scroll`, `dom.keypress`,
  `dom.wait_for_selector`, `dom.wait_for_text`, `dom.extract`,
  `dom.capture_snapshot`. A second, parallel action vocabulary; see the
  dead/superseded list below.
- No other action-type string literal exists in source. A scan of
  `"web.(browser|dom).*"`, `"dom.*"` and `"browser.*"` literals across
  `apps/*/src`, `apps/*/e2e`, `packages/*/src`, `domain/src` and `scripts`
  produced only the eleven canonical types, the eleven legacy aliases, and the
  sixteen *recording event kinds* (`dom.input`, `dom.change`, `dom.submit`,
  `dom.focus`, `dom.blur`, `dom.keydown`, `dom.wheel`, `dom.mutation`,
  `dom.snapshot`, `browser.tab`, `browser.navigation`, `content.ready`,
  `action.result`, `client.error` — `apps/extension/src/shared/protocol.ts:220-236`).

Note the namespace collision: `dom.click` and `dom.scroll` are simultaneously
legacy *action types* (`apps/extension/src/content/actions.ts:56,83`) and
recording *event kinds* (`apps/extension/src/content/dom-events.ts:42,125`).

## Dead Or Superseded API

Symbols with **zero references** in source. (`apps/extension/build/` is tracked
build output and was excluded; each of these appears there only as compiled
text.)

1. `legacyBrowserActionType` — `domain/src/client/gateway-mapping.ts:131`.
   Exported through `domain/src/client/index.ts`; never called.
2. `runStateReadViaSnapshot` — `apps/extension/src/runtime/state-reader.ts:8`.
   The whole module is unused; its own comment says it stands in until the
   protocol grows `server.read_state`.
3. `getWebAutomationOutputNodeDefinition` —
   `domain/src/output-nodes/registry.ts:5`. Its sibling
   `listWebAutomationOutputNodeDefinitions` is used only by
   `domain/src/tests/domain.test.ts:255`.
4. `isProbablySecureGateway` — `apps/extension/src/shared/browser.ts`.
5. `EXTENSION_NAME`, `PROTOCOL_VERSION` —
   `apps/extension/src/shared/constants.ts:1-2`. `PROTOCOL_VERSION` is
   superseded by `CLIENT_GATEWAY_PROTOCOL_VERSION` re-exported at
   `apps/extension/src/shared/protocol.ts:20`.
6. `createWebAutomationStructuredSnapshot` —
   `domain/src/client/gateway-mapping.ts:98`.
7. `webAutomationRuntimeCommandFromOutput` and
   `webAutomationOutputResultFromRuntimeResult` —
   `domain/src/runtime/commands.ts:12,33`. Both exported through
   `domain/src/client/index.ts:8`; neither is called. The live path builds the
   gateway command inline at `domain/src/io/gateway-output-dispatcher.ts:131-139`
   instead.

Superseded, duplicated or unreachable structures:

8. **Two parallel domain hosts.** `registerWebAutomationDomain`
   (`domain/src/host.ts:7`) registers IO through
   `createWebAutomationDomainIo` (`domain/src/io/web-automation-io.ts:78`);
   `registerFluxIQHost` (`domain/src/web-panel-host.ts:31`) re-implements the
   same registration inline (`:34-59`), with its **own** copy of
   `GatewayInputHub` (`web-panel-host.ts:98`, duplicating
   `domain/src/io/gateway-input-hub.ts:181`) and its **own**
   `dispatchWebAction` (`web-panel-host.ts:138`, duplicating
   `dispatchWebAutomationOutput` including a verbatim copy of the session
   selection predicate). Two implementations of one concept.
9. **A re-export shim with no content.** `domain/src/web-panel/output-nodes.ts`
   is one line: `export * from "../output-nodes";`, imported only by
   `domain/src/web-panel-host.ts:21`.
10. **Cross-repository deep import.** `domain/src/web-panel-host.ts:2` imports
    `AutomationStudioNativeNodeRuntime` from
    `../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/runtime/native-node-runtime.js`
    — a relative path into the sibling Core checkout's build output, bypassing
    the public package seam. Flagging it here because it is in this brief's
    read set; it is a repository-boundary question for the supervisor.
11. **Two definitions of the legacy alias map.**
    `LEGACY_BROWSER_ACTION_TO_WEB_AUTOMATION`
    (`domain/src/actions/types.ts:77-89`) is used only to derive its own
    reverse map; the live normalization at
    `domain/src/client/gateway-mapping.ts:152-168` hard-codes the same eleven
    pairs a second time.
12. **The content script's legacy branches are unreachable.** Every branch in
    `apps/extension/src/content/actions.ts:40-287` accepts both `web.dom.x` and
    `dom.x`, but the only producer of a `BrowserActionCommand` is
    `webAutomationActionFromGatewayCommand`, which normalizes first
    (`gateway-mapping.ts:115`). The legacy half of each condition is dead.
13. **Unknown action types are silently rewritten, not rejected.**
    `normalizeWebAutomationActionType` (`gateway-mapping.ts:152-168`) returns
    `"web.dom.extract"` for any unrecognized string. A typo or a future action
    becomes a read of the page rather than an error.
14. **Duplicate protocol types.** `apps/extension/src/content/types.ts:61-91`
    declares its own `BrowserActionCommand` / `BrowserActionResult` /
    `DomElementDescriptor` / `DomSnapshot`, structurally parallel to
    `apps/extension/src/shared/protocol.ts:170-286`, but with
    `actionType: string` instead of `BrowserActionType`, no `tabId`/`frameId`/
    `url`, and a `visualTarget` lacking `namespace`/`statePath`. The content
    script therefore compiles against the loose copy, and an unsupported action
    type is caught only at runtime (`actions.ts:288`).
15. **`updateTabUrl` is unreachable.** `apps/extension/src/runtime/automation-tab.ts:32`
    runs only when `initialUrl` is set *and* an existing automation tab is
    reused, but the sole caller sets `initialUrl` and `forceNew: true` together
    (`action-runner.ts:22-24`), so the reuse branch never has a URL.
16. **The `failed` output port is never taken by the node implementation.**
    Every node declares `success` and `failed` ports
    (`domain/src/output-nodes/definitions.ts:9-12`), but
    `createOutputNodeImplementation`
    (`domain/src/output-nodes/native-runtime.ts:45-61`) returns
    `status: "success", route: "success"` unconditionally and emits a
    `policy.output.dispatch` effect. Whether Core later re-routes on the
    dispatch result is a Core question this audit did not verify.
17. **Two disagreeing safety registries.**
    `domain/src/io/manifest-definitions.ts:117` marks `web.dom.capture_snapshot`
    as `level: "review"` and marks both waits and capture_snapshot as
    `requiresApproval: true`; `isSafeOutput`
    (`domain/src/output-nodes/definitions.ts:93-95`) treats all three as safe,
    so the node sets `privileged: false, requiresOperatorApproval: false`. The
    same output is privileged in one registry and not in the other.
18. **Statuses with no producer.** `"timed_out"` and `"cancelled"` are in the
    result union at `domain/src/actions/types.ts:51`,
    `apps/extension/src/shared/protocol.ts:276` and
    `apps/extension/src/content/types.ts:81`, and
    `packages/test-runner/src/interactive-session.ts:171` accepts them, but no
    code in `apps/extension/src` or `domain/src` ever emits either.
19. **The unsupported-page guard is bypassed for gateway actions.**
    `action-runner.ts:31` consults `request.unsupportedPageReason` only when
    `action.tabId !== undefined`, and `tabId` is never populated from a gateway
    command, so the live "this page cannot be automated" state is consulted for
    navigation only.
20. **Cross-frame execution is unreachable.** `action-runner.ts:48-53` sends
    with `frameId = action.frameId ?? 0` and `topFrameOnly: action.frameId === undefined`;
    since the gateway mapping never sets `frameId`, every action runs in frame 0
    and child frames are excluded by `message-handler.ts:46`.
21. **The node parameter list and the JSON schema disagree.**
    `parametersForOutput` (`definitions.ts:68-91`) exposes a `target`
    ("Adapted Target") parameter that `selectorSchema` (`schemas.ts:43-50`) does
    not know about, while the schema's `required: ["selector"]` is copied onto
    the node parameter (`definitions.ts:24-28,55`) — so a node driven purely by
    an adapted `target` is still flagged as missing a required `selector`.

## Top Five Gaps For Week 1

Ranked by how many of the eighteen FluxBench workflow categories (30-day plan
Phase 1.6) each gap blocks or renders unmeasurable.

**1. No outcome validation: `succeeded` means only "nothing threw". Blocks
18/18.**
`success()` is called unconditionally at the end of every branch
(`action-runtime.ts:107`); no action reads the DOM back. A disabled button, a
`select` set to a non-existent option, a key event with no default action, and a
navigate that landed on an error page all report `succeeded`. This makes the
plan's Phase 1.2 exit criterion 4 ("validate expected outcomes where
applicable") unmet for every capability, and it makes FluxBench's *Initial
execution success rate*, *Deterministic replay success rate* and *False failure
rate* uncomputable, because the client's own verdict is not evidence.

**2. No check/assert vocabulary and no failure branch. Blocks 10/18** —
Conditional behavior, Paginated extraction, Infinite scrolling, Search,
Multi-page navigation, Modals, Unexpected popup, Unexpected intermediate state,
Dynamic interfaces, Changed text.
There is no URL check, element-existence check, element-nonexistence check, or
text check action (matrix rows 22–24), and the native node implementation always
routes `success` (dead/superseded item 16), so a flow has nothing to branch on
even when the underlying dispatch failed. Termination predicates for pagination
and infinite scroll have no representation at all.

**3. No actionability wait before a mutating action. Blocks 8/18** — Dynamic
interfaces, Infinite scrolling, Modals, Unexpected intermediate state, Search,
Forms, Multi-page navigation, Paginated extraction.
`resolveTarget` throws the instant the element is absent
(`action-runtime.ts:89`) and there is no retry anywhere in the action path. The
two wait actions check existence only — never visible, enabled, stable, or
settled — so a correct flow must hand-author a wait before every step and still
cannot wait for the condition that actually matters.

**4. Untrusted input events and no native dialog handling. Blocks 6/18** —
Search, Forms, Modals, Dynamic interfaces, Unexpected popup,
Authentication-compatible workflows.
`HTMLElement.click()` (`actions.ts:249`) and bare `KeyboardEvent`s
(`actions.ts:284-285`) are `isTrusted: false` and trigger no default behaviour;
Enter does not submit, Tab does not move focus, and no modifier can be
expressed. Typing emits one `input`+`change` with no keystrokes, so combobox and
autocomplete widgets never open. Native `alert`/`confirm`/`beforeunload` dialogs
have no handler and no `debugger` permission to install one, and while one is
open the content script cannot answer at all.

**5. Single-element, unstructured extraction. Blocks 5/18** — Table extraction,
Paginated extraction, Infinite scrolling, Search, Simple extraction (multi-field
cases).
`extractElement` returns one `JsonValue` from one `querySelector` match
(`action-runtime.ts:184-190`); there is no list, table, or schema-shaped
extraction, and even the single-attribute mode is unreachable from the node UI
and from recorded payloads (matrix row "Extract attributes").

Immediately behind these: **tab lifecycle** (no open/switch/close action, and
navigate opens a new tab every time — blocks Multiple tabs, Unexpected popup,
Authentication-compatible workflows, Multi-page navigation: 4/18), and
**downloads and uploads** (no permission, no API — blocks Downloads outright and
the upload half of Forms: 2/18, but each is an unconditional blocker for its
category).

## Commands run and observed results

All read-only; no build, no Testing Lab, no browser, no panel.

- `find domain/src apps/extension/src -type f -name '*.ts' | sort`, plus
  `wc -l` over the brief's read set — 46 domain files, 47 in the three extension
  directories; the largest in scope is
  `apps/extension/src/shared/protocol.ts` at 297 lines.
- `cat -n` over every file the brief names in `domain/src/actions/`,
  `domain/src/output-nodes/`, `domain/src/io/`, `domain/src/client/`,
  `apps/extension/src/runtime/`, `apps/extension/src/shared/`, and the
  action-execution files `content/actions.ts`, `content/action-runtime.ts`,
  `content/element-finder.ts`, `content/describe-element.ts`,
  `content/message-handler.ts`, `content/capture-settings.ts`,
  `content/types.ts`.
- `grep -rhoE '"(web\.(browser|dom)\.[a-z_]+|dom\.[a-z_]+|browser\.[a-z_]+)"' apps/*/src apps/*/e2e packages/*/src domain/src scripts | sort | uniq -c`
  — 37 distinct literals; the eleven canonical action types, the eleven legacy
  aliases, and the recording event kinds. No twelfth action type.
- Unreferenced-export scan over the brief's read set (script at
  `<scratchpad>/deadscan-actions.sh`; for each exported symbol, count references
  outside its defining file, excluding `node_modules`, `dist`,
  `.test-build`, `.script-build`) — 21 symbols with no external reference. A
  follow-up count including the defining file narrowed this to the seven
  genuinely dead symbols listed above (the rest are used only inside their own
  module or are part of an exported type shape).
- `grep -rn -i "retry|retries|attempt"` over `apps/extension/src/runtime`,
  `apps/extension/src/content`, `domain/src/actions`, `domain/src/output-nodes`,
  `domain/src/io` — **no output**. No retry logic in the action path.
- `grep -rn -iE "\bassert(ion)?\b|expected(Text|Url|State)|verif(y|ication)"`
  over `domain/src` and `apps/extension/src`, excluding tests — **no output**.
  No outcome-validation machinery.
- `grep -rn "timed_out|\"cancelled\""` over `apps/extension/src`, `domain/src`,
  `packages/*/src` — matches only in type unions and in
  `packages/test-runner/src/interactive-session.ts:171`; no producer.
- `grep -rn -iE "downloads|\.files\b|DataTransfer|upload"` over
  `apps/extension/src` and `domain/src` — only Core-API screenshot upload
  helpers (`background/connection/core-api.ts:72`, `state-assets.ts`); no
  download or file-input handling.
- `grep -n -A 12 '"permissions"'` over all three manifests — `activeTab`,
  `scripting`, `storage`, `tabs`, `webNavigation`, (+`sidePanel` on
  Chrome/e2e). No `downloads`, no `debugger`.
- `grep -rn "resolveAutomationTab|waitForTabReady|selectAutomationTab" apps --include=*.ts`
  — `resolveAutomationTab` has exactly one caller,
  `apps/extension/src/runtime/action-runner.ts:30`.
- `git rev-parse --short HEAD` → `d848536`.

## Not verified

- **No browser execution.** Nothing here was run in Chrome, Edge or Firefox. The
  behavioural claims about untrusted events (Enter not submitting, Tab not
  moving focus), the `contenteditable` `Illegal invocation` throw, the
  file-input value-setter rejection, and native dialogs blocking the content
  script are read from the code and from platform semantics, not observed. Each
  is a cheap live check and should be confirmed before the Phase 1.2 plan is
  finalized.
- **Core-side behaviour.** Whether Core's automation-studio runtime re-routes a
  node to its `failed` port after a `policy.output.dispatch` effect returns
  `ok: false` was not checked; it requires reading
  `F:\!FluxIQ`, which this brief does not cover. Item 16 in the dead/superseded
  list is stated as what *this* repository does, not as a claim about the flow
  outcome.
- **Snapshot and evidence content.** `content/dom-snapshot.ts`,
  `content/recorder.ts`, `content/dom-events.ts` and the
  `background/connection/*evidence*` modules were deliberately not audited —
  `audit-evidence` and `audit-recording` own them. The "state observed after"
  column therefore names `DomSnapshot`
  (`apps/extension/src/shared/protocol.ts:207-218`) as a shape without judging
  its contents.
- **Target resolution quality.** `resolveTarget`'s ordering
  (selector → coordinates → visual bounds → fingerprint) and
  `findClosestFingerprint` (`content/element-finder.ts:13`) were read only far
  enough to describe execution; `audit-targeting` owns whether they are
  *correct*. One observation to hand over: the visual-target branch uses
  `document.elementFromPoint`, which returns the topmost element at the point
  and may be an overlay or a descendant, and nothing checks the result against
  the fingerprint before acting on it.
- **Failure taxonomy.** `domain/src/runtime/errors.ts` holds a single
  `WebAutomationRuntimeError` class with a free-form `code`; classification of
  failures is `audit-failures`' subject.
- **Test coverage.** `domain/src/tests/domain.test.ts` and the extension tests
  were not read for coverage of the action surface; no test was run.

## Open questions or contradictions found

1. **Which host is the real one?** `domain/src/host.ts` and
   `domain/src/web-panel-host.ts` both register the domain, its IO and its
   output dispatch, by different code paths. If both can run in one process the
   `ioSnapshot(...).inputs.length` guards make the winner
   order-dependent. Week 1 should collapse these to one.
2. **Is the legacy dotted vocabulary still a supported wire contract?** It is
   normalized on the way in (`gateway-mapping.ts:152`), matched again in the
   content script where it can no longer arrive (`actions.ts:40-287`), and
   mapped twice (`actions/types.ts:77` and `gateway-mapping.ts:154`). Either
   it is a live compatibility surface — in which case it needs one owner and a
   test — or it should be deleted.
3. **Should `normalizeWebAutomationActionType` reject unknown types?** Falling
   back to `web.dom.extract` (`gateway-mapping.ts:167`) converts a protocol
   error into a silent page read. This looks like a bug, not a policy, but it is
   load-bearing for the fallback path so I did not assume.
4. **Why does navigate force a new tab?** `action-runner.ts:23` sets
   `forceNew = true` unconditionally for navigation. A multi-page workflow
   accumulates one tab per navigation, and it makes `updateTabUrl` unreachable.
   If this is deliberate isolation, the plan should say so and add a tab-reuse
   mode; if not, it is a one-line fix with a large effect on the Multi-page
   navigation and Multiple tabs FluxBench categories.
5. **Which safety registry wins?** `manifest-definitions.ts:117` and
   `definitions.ts:93` disagree about `web.dom.capture_snapshot` and the two
   waits (item 17). An operator-approval prompt on a snapshot would stall
   provider-free benchmark runs.
6. **Is `apps/extension/src/content/types.ts` meant to stay a separate copy of
   the protocol types?** Its header calls the shapes "a contract with
   `background/`", which suggests deliberate duplication, but the looser
   `actionType: string` is what lets an unknown action reach
   `actions.ts:288` at runtime instead of failing to compile.
7. **The plan's 24 capabilities do not include snapshot capture, and this
   repository's twelfth action is exactly that.** Worth confirming with the
   supervisor that `web.dom.capture_snapshot` stays out of the Phase 1.2
   vocabulary count and is treated as evidence infrastructure.
