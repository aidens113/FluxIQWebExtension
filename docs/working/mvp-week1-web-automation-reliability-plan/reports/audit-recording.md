# Report: audit-recording

Brief: `### Brief: audit-recording` in
`docs/working/mvp-week1-web-automation-reliability-plan.md`.
Scope: Phase 1.1 step 3 — do recorded user actions map to executable outputs?
Read-only investigation. No source file and no working document was modified.

## Outcome

Done. Every recorded event kind, its domain input, its registered output and
output node, and its test coverage are tabulated below. Three orphaned
mappings, two capture gaps, one live-delivery defect, one replay echo, one
mis-mapped control class, and two stale documentation claims were found. No
boundary-rule violation (a passive/state input becoming executable) exists;
the rule is enforced in Core at two points, cited below.

## Mapping table: recording event → input → output → executable

Columns: the client event `kind` on the wire
(`apps/extension/src/shared/protocol.ts:220-236`); the domain input from
`webAutomationInputIdForRecordedEvent` (`domain/src/io/input-model.ts:29-39`);
the registered output from `actionInputDefinitions`
(`domain/src/io/input-model.ts:46-54`); the output node id from
`webAutomationOutputNodeId` (`domain/src/output-nodes/definitions.ts:14-16`);
executable = the event becomes a `type: "action"` recording entry; test
coverage in `domain/src/tests/domain.test.ts`.

| # | Event kind (emitted at) | Domain event type | Domain input | Registered output | Output node | Executable | Test coverage |
|---|---|---|---|---|---|---|---|
| 1 | `content.ready` (`content/recorder.ts:49`) | `web.client.ready` | — | — | — | No (evidence) | none |
| 2 | `browser.tab` (`background/connection.ts:569`) | `web.tab.state_changed` | — | — | — | No (evidence) | none |
| 3 | `browser.navigation`, typed (`background/connection.ts:404`, metadata `transition:"typed"`) | `web.page.navigated` | `web.user.navigation_requested` | `web.browser.navigate` | `web.output.browser-navigate` | **Yes** | `domain.test.ts:52`; mapper `:40-49` |
| 4 | `browser.navigation`, not typed | `web.page.navigated` | — (`input-model.ts:30` returns undefined) | — | — | No (evidence) | `domain.test.ts:50-51` |
| 5 | `dom.click` (`content/dom-events.ts:42`, `:60`) | `web.element.clicked` | `web.user.element_clicked` | `web.dom.click` | `web.output.dom-click` | **Yes** | `domain.test.ts:220`; payload `:229-236` |
| 6 | `dom.input`, non-empty (`content/recorder.ts:94`, `:102`) | `web.element.input_changed` | `web.user.text_entered` | `web.dom.type` | `web.output.dom-type` | **Yes** | `domain.test.ts:221` |
| 7 | `dom.input`, empty value | `web.element.input_changed` | `web.user.field_cleared` | `web.dom.clear` | `web.output.dom-clear` | **Yes** | `domain.test.ts:222` |
| 8 | `dom.change`, `<select>` (`content/dom-events.ts:91`) | `web.element.changed` | `web.user.option_selected` | `web.dom.select` | `web.output.dom-select` | **Yes** | `domain.test.ts:223` |
| 9 | `dom.change`, checkbox/radio/file/date/color/range (same emit site) | `web.element.changed` | `web.user.text_entered` (mis-mapped, see Finding 6) | `web.dom.type` | `web.output.dom-type` | **Yes, wrongly** | none |
| 10 | `dom.submit` (`content/dom-events.ts:101`) | `web.form.submitted` | — | — | — | No (evidence) | `domain.test.ts:224` asserts undefined |
| 11 | `dom.keydown` (`content/dom-events.ts:108`) | `web.keyboard.pressed` | `web.user.key_pressed` | `web.dom.keypress` | `web.output.dom-keypress` | **Yes** | none |
| 12 | `dom.scroll` (`content/dom-events.ts:125`, `:146`) | `web.scroll.changed` | — (see Finding 1) | — | — | **No** | none |
| 13 | `dom.wheel` — never emitted | `web.mouse.wheel` | `web.user.page_scrolled` | `web.dom.scroll` | `web.output.dom-scroll` | Unreachable | none |
| 14 | `dom.mutation` (`content/recorder.ts:37`) | `web.dom.mutated` | — | — | — | No (evidence) | none |
| 15 | `dom.focus` — never emitted | `web.element.focused` | — | — | — | Unreachable | none |
| 16 | `dom.blur` — never emitted | `web.element.blurred` | — | — | — | Unreachable | none |
| 17 | `dom.snapshot` — never emitted as an event | `web.snapshot.captured` | — | — | — | Unreachable | none |
| 18 | `action.result` (`background/connection.ts:634`) | `web.action.executed` | — | — | — | No (evidence) | none |
| 19 | `client.error` — never emitted | `web.client.error` | — | — | — | Unreachable | none |

Runtime-confirmation events are a second producer of rows 3, 5, 6, 7, 8, 11
and 12. `runtimeConfirmationForActionResult`
(`apps/extension/src/background/connection/runtime-status.ts:82-97`) sets
`metadata.inputId` **directly** rather than deriving it from the event kind,
and `connection.ts:652-674` sends the result. That path is the only one that
makes `web.user.page_scrolled` reachable (`runtime-status.ts:95`, kind
`dom.scroll`), and the only one that sets `metadata.domainId`
(`connection.ts:666`).

Two remaining outputs have no recording input at all, by design: they are
read-only and can only be dispatched by a flow, never observed from a user
action.

| Output | Output node | Reachable from a recording? |
|---|---|---|
| `web.dom.wait_for_selector` | `web.output.dom-wait_for_selector` | No — dispatch only |
| `web.dom.wait_for_text` | `web.output.dom-wait_for_text` | No — dispatch only |
| `web.dom.extract` | `web.output.dom-extract` | No — dispatch only |
| `web.dom.capture_snapshot` | `web.output.dom-capture_snapshot` | No — dispatch only |

(11 outputs total, `domain/src/actions/types.ts:63-75`; 11 output nodes
asserted at `domain/src/tests/domain.test.ts:256`.)

## Captured but never mapped

1. **`dom.scroll` — the only user action whose event is captured and
   discarded.** The content script emits `dom.scroll` for both the wheel
   listener (`content/dom-events.ts:125`) and the window scroll listener
   (`:146`), but `webAutomationInputIdForRecordedEvent` maps only the kind
   `"dom.wheel"` (`domain/src/io/input-model.ts:33`), which nothing emits. A
   user scroll is therefore recorded as passive evidence and never becomes a
   `web.dom.scroll` action entry. Note the split brain: the *offline* mapper
   `mapWebRecordingObservation` does handle `scrollChanged`
   (`domain/src/web-panel-host.ts:190-197`), so the same user scroll is
   non-executable on the live input path and executable on the proposal path.
2. `dom.submit` (`content/dom-events.ts:101`) is captured and deliberately
   unmapped; `domain/src/tests/domain.test.ts:224` pins that. Defensible —
   a submit is usually already explained by the preceding `dom.click` or
   `dom.keydown` — but it means a form submitted by JavaScript with no
   preceding user click leaves no executable step.
3. `dom.mutation`, `browser.tab`, `content.ready`, `action.result` are
   captured evidence with no input, as intended.

## Mapped but never captured (orphans)

| Orphan | Declared at | Consumed by | Producer |
|---|---|---|---|
| kind `dom.wheel` | `shared/protocol.ts:231` | `gateway-mapping.ts:41` → `web.mouse.wheel`; `input-model.ts:33` → `web.user.page_scrolled`; `recorded-event.ts:60`; `web-panel-host.ts:190` | **none** |
| kind `dom.focus` | `shared/protocol.ts:228` | `gateway-mapping.ts:38` → `web.element.focused`; recording-domain event `recording/events.ts:82` | **none** |
| kind `dom.blur` | `shared/protocol.ts:229` | `gateway-mapping.ts:39` → `web.element.blurred`; `recording/events.ts:83` | **none** |
| kind `dom.snapshot` | `shared/protocol.ts:234` | `gateway-mapping.ts:44` → `web.snapshot.captured`; `recording/events.ts:88` | **none** — snapshots travel as `client.snapshot` messages (`recording-evidence.ts:90`), not as recording events |
| kind `client.error` | `shared/protocol.ts:236` | `gateway-mapping.ts:46` (fallthrough) → `web.client.error`; `recording/events.ts:90`; reducer `recording/reducers.ts:29` | **none** |

Verification: `grep -rn 'dom\.focus\|dom\.blur\|dom\.wheel' apps/extension/src/content/`
returned no matches; `grep -rn 'emit("' apps/extension/src` returned exactly
`dom.click`, `dom.change`, `dom.submit`, `dom.keydown`, `dom.scroll`,
`dom.mutation`, `dom.input`, plus `content.ready` via `sendReady`
(`content/recorder.ts:49`).

The three orphaned *domain event types* (`web.element.focused`,
`web.element.blurred`, `web.mouse.wheel`, `web.snapshot.captured`,
`web.client.error`) are still registered in the recording domain
(`domain/src/recording/events.ts:74-91`), so FluxIQ advertises event types the
client cannot produce.

## Boundary-rule violations

**None found.** No mapping turns a passive/state input into an executable
action. The evidence:

- The two non-action inputs are declared `role: "state"` and `role: "event"`
  with no `outputId` (`domain/src/io/input-model.ts:41-44`); only
  `actionInputDefinitions` carries an `outputId`, and each maps to exactly one
  registered output (`:46-54`, wired at `domain/src/io/web-automation-io.ts:34-39`).
  `domain/src/tests/domain.test.ts:227` asserts no state input has role
  `"action"`.
- Core refuses to record a non-action input as an action:
  `AutomationStudioIoRecorder.recordInput` takes the action branch only when
  `role === "action"` and an output binding resolves, otherwise it writes an
  `observation` entry with `policyEligible: false`
  (`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\io-bridge.ts:31-63`).
- Core refuses a mapper candidate that cites a state-eligible input:
  `"Recording mapper source input ... is state-eligible and cannot be
  reclassified as an action."`
  (`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\service.ts:4695`,
  with the same check for the confirmation input at `:4701` and an
  unregistered-output check at `:4690`).

The one thing worth watching: row 9 above is not a *role* violation but is a
mis-classification of one user action as another, which produces an
executable step that does the wrong thing. See Finding 6.

## End-to-end path: Browser Event → Browser Action

1. **Browser event.** Capture-phase listeners registered by
   `installRecordingEventListeners`
   (`apps/extension/src/content/dom-events.ts:32-149`). `pointerdown`,
   `click`, `keydown` and `wheel` require `event.isTrusted`
   (`:35`, `:56`, `:106`, `:122`); `input`, `change`, `submit` and `scroll` do
   not (see Finding 4).
2. **Element identity.** `describeElement`
   (`apps/extension/src/content/describe-element.ts:18-66`) with
   `selectorFor` (`:69-86`), `accessibleName` (`:114`), `linkHref` (`:118`),
   `xpathFor` (`content/element-finder.ts`); the acted-on element is chosen by
   `pointerActivationTarget` / `actionEventTarget`
   (`content/event-elements.ts:45-61`).
3. **Recorded event.** `emit` → `basePayload`
   (`content/recorder.ts:55-60`, `:108-127`) builds a `RecordingEventPayload`
   (`shared/protocol.ts:238-253`), debouncing typing through
   `scheduleInputEvent` / `flushPendingInput` (`recorder.ts:82-98`) and
   attaching a snapshot when `shouldAttachStateSnapshot`
   (`content/snapshots.ts:1-7`) allows it. Sent on `CONTENT_EVENT`
   (`content/messages.ts:7`).
4. **Background routing.** `chrome.runtime.onMessage` →
   `apps/extension/src/background/index.ts:152-156` →
   `FluxIQConnection.handleRecordingEvent`
   (`background/connection.ts:314-330`), which drops the duplicate half of a
   pointerdown/click pair via `clickEventSignature`
   (`connection/recorded-event.ts:39-52`) and `PointerClickFilter`
   (`connection/pointer-click-filter.ts:6-24`). Background-originated events
   enter the same function: navigation at `connection.ts:400-411` (gated by
   `NavigationRecorder`, `connection/navigation-recorder.ts:36-53`),
   recording-start tab state at `:568-575`, action results at `:633-643`.
5. **Classification.** `processRecordingEvent`
   (`connection.ts:413-429`) asks `isExecutableRecordedAction`
   (`connection/recorded-event.ts:9-11`), which is
   `recordedInputId(payload) !== undefined`
   (`connection/gateway-payloads.ts:15-28`), which is
   `webAutomationInputIdForRecordedEvent`
   (`domain/src/io/input-model.ts:29-39`). Executable events go out as
   `client.recording_event` **and** as evidence; everything else is evidence
   only.
6. **Domain input.** `gatewayRecordingEventFromPayload`
   (`connection/gateway-payloads.ts:50-75`) calls
   `createWebAutomationRecordingEvent`
   (`domain/src/client/gateway-mapping.ts:49-83`), which stamps
   `eventType` via `webAutomationEventTypeForClientKind` (`:30-47`),
   `target` via `webAutomationActionTargetFromElement`, `visualTarget` via
   `webAutomationActionVisualTargetFromElement`, and puts `inputId` into
   `metadata` (`gateway-payloads.ts:67-69`). Sent by `GatewaySession.send`
   (`connection/gateway-session.ts:183-205`).
7. **Recording (Core).** `AutomationStudioClientGatewayBridge` →
   `appendRecordingEvent`
   (`F:\!FluxIQ\...\automation-studio\client-gateway\bridge.ts:278-317`).
   With both `domainId` (read from the event's **top-level** field, `:281`)
   and `metadata.inputId` present it calls `recordGatewayInput` (`:405-430`),
   which is where the input becomes a recording entry.
8. **Generated node parameters.** `AutomationStudioIoRecorder.recordInput`
   (`F:\!FluxIQ\...\runtime\io-bridge.ts:20-64`) resolves the adapter's
   `outputBinding`, whose `toPayload` is
   `webAutomationOutputPayload(outputId, event.payload)`
   (`domain/src/io/web-automation-io.ts:38`,
   `domain/src/output-nodes/payloads.ts:8-28`), and writes a
   `type: "action"` entry carrying `outputId`, `parameters`,
   `confirmationInputId` and `origin: "operator"`.
9. **Runtime output.** A flow dispatches the output through
   `dispatchWebAutomationOutput`
   (`domain/src/io/gateway-output-dispatcher.ts:6-32`), which rebuilds the
   target with `outputTargetFromPayload`
   (`domain/src/output-nodes/targets.ts:5-26`) and calls
   `executeAction` on the gateway; the extension receives it at
   `connection/gateway-session.ts:276` via
   `webAutomationActionFromGatewayCommand`
   (`domain/src/client/gateway-mapping.ts:112-129`).
10. **Browser action.** `ExtensionRuntimeCommandRouter`
    (`apps/extension/src/runtime/`) → `sendToTab` → content
    `installMessageHandler` (`content/message-handler.ts:35-41`) →
    `executeAction` (`content/action-runtime.ts:30-44`) →
    `executeContentAction` (`content/actions.ts:37-101`), with target
    resolution selector → coordinates → visual bounds → fingerprint
    (`action-runtime.ts:61-91`).
11. **Result back into the recording.** `sendActionResult`
    (`connection.ts:621-644`) emits `client.action_result` and an
    `action.result` recording event, then `sendRuntimeActionConfirmation`
    (`:648-675`) re-injects the action as the recorded event a user would have
    produced, closing the loop at step 6.

## Core entry point: recording → deterministic Subflow

Located by grep only, as the brief requires.

- **Entry point:** `AutomationStudioService.createRecordingFlowProposals`
  (`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\service.ts:2368`).
  HTTP surface: `create-recording-flow-proposals`
  (`...\api\contracts\endpoints.ts:95`, handler `...\api\handlers\recordings.ts:326-330`).
  It requires a bound importer runtime and IO registry (`service.ts:2373-2374`),
  lists the domain's recording mappers (`:2375`), walks the recording timeline
  (`:2401-2435`), and validates every candidate through
  `validateRecordingCandidate` (`:4686-4720`).
- **Approval into a Subflow:** `reviewRecordingFlowProposal`
  (`service.ts:2467`), which calls
  `flowSubflowMigration.ensureProposalPrimarySubflow` (`:2495`) and writes the
  candidates onto that Subflow graph via `appendRecordingProposalToFlow`
  (`:2523`), stamping `source: "recording_flow_proposal"` (`:2512`, `:2532`).
  The policy-proposal sibling does the same at
  `...\runtime\service\proposals\approval.ts:112`.
- **Downstream contract it consumes:** the importer SDK recording-mapper
  contract —
  `AutomationStudioRecordingMapperDefinition`,
  `AutomationStudioRecordingMapperObservation`,
  `AutomationStudioRecordingMapperCandidate`,
  `AutomationStudioRecordingMapperImplementation`
  (`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\nodes\importer-sdk.ts:9-30`, `:78`)
  — plus the domain's registered IO: every candidate `outputId` must satisfy
  `io.hasOutput(domainId, outputId)` (`service.ts:4690`) and every
  `sourceInputIds` / `expectedConfirmation.inputId` must be a registered input
  with `role === "action"` (`:4693-4701`).
- **This repository's implementation of that contract:**
  `mapWebRecordingObservation` (`domain/src/web-panel-host.ts:161-199`),
  registered as mapper `web-recording-actions` with
  `outputIds: WEB_AUTOMATION_ACTION_TYPES` at `domain/src/web-panel-host.ts:78-88`.

## Findings

**Finding 1 — recorded user scrolls are never executable (live path).**
See "Captured but never mapped" §1. `input-model.ts:33` keys on `dom.wheel`,
which no producer emits; the emitted kind is `dom.scroll`. Fix is one line,
but the two mappers must be reconciled together (`input-model.ts:29-39` and
`web-panel-host.ts:190-197`), since they currently disagree.

**Finding 2 — recorded action events are filtered out of the live input
stream.** `GatewayInputHub.accept` gates on `metadata.domainId`
(`domain/src/io/gateway-input-hub.ts:30`, duplicated verbatim at
`domain/src/web-panel-host.ts:119`). `createWebAutomationRecordingEvent`
puts `domainId` at the **top level** of the event, not in `metadata`
(`domain/src/client/gateway-mapping.ts:58` vs `:77-81`), and
`gatewayRecordingEventFromPayload` adds only `inputId` to metadata
(`connection/gateway-payloads.ts:67-69`). So a user-recorded `dom.click`
never reaches a `web.user.element_clicked` subscriber. Only two paths pass the
filter: runtime confirmations, which set `metadata.domainId` explicitly
(`connection.ts:666`), and state updates, where
`createWebAutomationStateUpdate` adds it (`gateway-mapping.ts:92`). Core's
bridge is unaffected — it reads the top-level field (`bridge.ts:281`) — so
recording persistence and Subflow generation still work; what is broken is the
documented contract that "registered input adapters also subscribe to the live
gateway stream so runtime consumers can wait for browser confirmation events"
(`docs/architecture/extension-client.md`, Declared Inputs And Outputs) for
anything other than a runtime-originated action.

**Finding 3 — recording evidence with a DOM snapshot never reaches the
`web.recording.evidence` input.** When a snapshot is available the evidence
goes out as `client.snapshot` (`connection/recording-evidence.ts:90-106`);
only the snapshot-less fallback goes out as `client.state_update` carrying
`inputId: recordingEvidence` (`:108-121`). The hub subscribes to
`client.recording_event` and `client.state_update` only
(`gateway-input-hub.ts:27`). Since `shouldRequireStateForEvidence`
(`connection/recorded-event.ts:13-22`) requests a snapshot for exactly the
interesting events, the evidence input is live only in the degraded case.

**Finding 4 — replaying an action while recording produces a duplicate
recorded event.** `dispatchInputEvents` fires untrusted `input` and `change`
events after `web.dom.type`, `web.dom.clear` and `web.dom.select`
(`content/action-runtime.ts:142-145`, called from `content/actions.ts:66`,
`:73`, `:80`). The recorder's `input` and `change` listeners have no
`isTrusted` guard (`content/dom-events.ts:69`, `:82`; only pointerdown, click,
keydown and wheel check it, `:35`, `:56`, `:106`, `:122`). The same executed
action therefore lands twice: once from `sendRuntimeActionConfirmation`
(`connection.ts:648`) and once as a fresh user `dom.input`/`dom.change`.
Clicks are safe because `element.click()` is untrusted and the click listeners
do check.

**Finding 5 — the runtime confirmation for `web.dom.type` / `web.dom.select`
loses its value.** `runtimeConfirmationForActionResult` sets `inputValue` only
for `web.dom.clear` (`connection/runtime-status.ts:92`); the `type` and
`select` branches (`:91`, `:93`) pass no value, and `BrowserActionResult`
(`shared/protocol.ts`, `domain/src/actions/types.ts:48-61`) does not carry the
text either. `webAutomationOutputPayload` then falls back to `""`
(`domain/src/output-nodes/payloads.ts:16-17`), so a confirmation-derived
action entry types an empty string.

**Finding 6 — checkbox, radio, file, date and range changes map to
`web.dom.type`.** `shouldRecordChangeEvent` routes them to the `change`
listener (`content/element-traits.ts:92-106`, `content/dom-events.ts:90-94`),
where `readElementValue` returns `element.value` — `"on"` for a default
checkbox regardless of checked state
(`content/describe-element.ts:105-112`). `webAutomationInputIdForRecordedEvent`
only special-cases `tagName === "select"`
(`domain/src/io/input-model.ts:34-37`), so the event becomes
`web.user.text_entered` → `web.dom.type`, and replay calls `setElementValue`
on a checkbox (`content/actions.ts:62-68`) instead of toggling it. No test
covers this row. There is no `web.dom.check`/`web.dom.toggle` output to map to
(`domain/src/actions/types.ts:63-75`), so this is a Week 1 vocabulary gap, not
only a mapping bug.

**Finding 7 — the recording→Subflow mapper drops the element fingerprint.**
`mapWebRecordingObservation` emits candidates whose parameters carry only
`selector` (`domain/src/web-panel-host.ts:176`, `:181`, `:185`, `:188`),
whereas the live input path preserves the full fingerprint and visual target
through `webAutomationOutputPayload`
(`domain/src/output-nodes/payloads.ts:9-25`) so that
`outputTargetFromPayload` can fall back when a selector drifts
(`domain/src/output-nodes/targets.ts:5-26`). A Subflow generated from a
recording is therefore strictly more selector-fragile than the same action
recorded live. Relevant to Phase 1.3.

**Finding 8 — password and sensitive control values are captured verbatim.**
`isTextEntryElement` includes `type === "password"`
(`content/element-traits.ts:84`), and `describeElement` gates `value` only on
`captureSettings.inputValues` (`content/describe-element.ts:40-41`);
`isSensitiveFormControl` is applied only to a `<select>`'s `selectedValue`
(`:55`) and to `hasValue` (`element-traits.ts:117`). The value then travels as
`element.value` and `payload.inputValue` into the recording event
(`content/recorder.ts:83`, `content/dom-events.ts:93`) and into the
`web.dom.type` parameters. The domain marks `elements.*.value` and `forms.*`
`sensitive: true` (`domain/src/recording/domain.ts:27`, `:32`), but that is
downstream labelling, not capture-time redaction. The file's own header claims
"Sensitive values are filtered here, not by the caller"
(`content/describe-element.ts:4`), which is not what the code does.

**Finding 9 — two duplicated implementations of one concept.**
`GatewayInputHub` exists twice, character-for-character in behaviour:
`domain/src/io/gateway-input-hub.ts:9-47` (typed) and
`domain/src/web-panel-host.ts:98-136` (`any`-typed, with the comment
"avoiding an ESM runtime import in the CJS host module"). Both carry the
Finding 2 defect, so a fix must be applied twice. Likewise the input→output
mapping exists twice with divergent behaviour:
`webAutomationInputIdForRecordedEvent` (`domain/src/io/input-model.ts:29-39`)
and `mapWebRecordingObservation` (`domain/src/web-panel-host.ts:161-199`);
they disagree on scroll (Finding 1).

**Finding 10 — test coverage.** Of the 19 event rows, 6 have any coverage, all
in `domain/src/tests/domain.test.ts` (`:50-52`, `:220-224`, plus the mapper at
`:30-49` and the click output payload at `:229-236`). Uncovered:
`dom.keydown` → `web.dom.keypress`, every scroll row, every orphan, the
checkbox mis-mapping, `runtimeConfirmationForActionResult`,
`gatewayRecordingEventFromPayload` metadata, and both `GatewayInputHub`
filters. There is no test anywhere under `apps/extension` —
`find apps/extension -name "*.test.ts" -not -path "*/node_modules/*"`
returned nothing — so every extension-side symbol in the path above is
untested.

## Commands run and observed results

All read-only (`find`, `grep`, `sed`, `wc`, `cat`). No build, no test run, no
browser, no panel.

- `find domain/src/recording domain/src/client domain/src/io -type f` and the
  same for `apps/extension/src/background apps/extension/src/content` →
  the 14 + 43 files listed in the brief's required reads; each was read in
  full or in the cited ranges.
- `grep -rno --include=*.ts -E '"(dom|browser|content|action)\.[a-z_.]+"' apps/extension/src domain/src packages apps/scenario-lab`
  → the full literal inventory used to build the orphan table; `"dom.wheel"`
  appeared at `shared/protocol.ts:231`, `gateway-mapping.ts:41`,
  `recorded-event.ts:60`, `input-model.ts:33` and nowhere in `content/`.
- `grep -rn 'dom\.focus\|dom\.blur\|dom\.wheel' apps/extension/src/content/`
  → no matches.
- `grep -rn 'emit("' apps/extension/src` → 10 sites, kinds `dom.click` (×2),
  `dom.change`, `dom.submit`, `dom.keydown`, `dom.scroll` (×2),
  `dom.mutation`, `dom.input` (×2).
- `grep -n 'isTrusted' apps/extension/src/content/dom-events.ts` → lines 35,
  56, 106, 122 only; `grep -n 'addEventListener('` on the same file → 8
  listeners, so `input`, `change`, `submit`, `scroll` are unguarded.
- `grep -rn 'recording_entry' --include=*.ts . --exclude-dir=node_modules --exclude-dir=dist`
  → no matches in this repository; the type exists only in Core
  (`packages/contracts/src/client-gateway.ts:192`,
  `packages/client-gateway-websocket/src/automation-studio.ts:54`).
- `grep -rn 'client.recording_event' --include=*.ts apps/extension/src domain/src`
  → two senders (`connection.ts:421`, `:674`), two hubs
  (`gateway-input-hub.ts:27`, `web-panel-host.ts:116`).
- Core, grep only:
  `grep -rn 'createRecordingFlowProposals' packages/fluxiq/src`,
  `grep -rn -i 'recordingMapper' packages/*/src`,
  `grep -rn 'client.recording_event' packages/*/src apps/*/src`,
  plus `sed -n` reads of the four cited ranges
  (`service.ts:2368-2440`, `:2490-2545`, `:4686-4720`;
  `bridge.ts:278-317`, `:405-430`; `io-bridge.ts:10-69`;
  `importer-sdk.ts:1-40`; `contracts/src/client-gateway.ts:44-54`;
  `domains/index.ts:18-34`; `proposals/approval.ts:90-120`).
  These confirmed: the bridge reads `event.domainId` at the top level
  (`bridge.ts:281`), `recordGatewayInput` requires a registered input
  (`:415`), and the role check that blocks state→action reclassification
  (`io-bridge.ts:31`, `service.ts:4695`).

## Not verified

- **Nothing was executed.** No `pnpm check`, `pnpm test`, `pnpm build`, no
  Testing Lab, no browser. Every claim is read from source, not observed at
  runtime. In particular Findings 1–6 are static readings of the control flow;
  they predict runtime behaviour and were not reproduced.
- Finding 2 in particular deserves a live check: it depends on the gateway
  server not enriching `metadata` between
  `apps/extension/src/background/connection/gateway-session.ts:183` and
  `domain/src/io/gateway-input-hub.ts:30`. I traced that with grep to
  `F:\!FluxIQ\packages\fluxiq\src\client-gateway\service\inbound.ts:82-83`,
  which re-emits `message` verbatim, but I did not read the WebSocket
  transport in full and did not observe a live envelope.
- I did not read Core broadly, per the brief: `service.ts` (≈6 000 lines) was
  sampled only at the four cited ranges. There may be other recording→flow
  paths I did not see.
- Element-identity quality, snapshot/evidence content, failure taxonomy and
  the action vocabulary itself belong to the other four audits; I touched them
  only where the recording mapping crosses into them (Findings 6, 7, 8).
- `apps/extension/src/runtime/*` was listed but not read in depth; step 10 of
  the end-to-end path is cited at directory granularity for the router.

## Open questions or contradictions found

1. **Two mappers, one concept, divergent behaviour.**
   `webAutomationInputIdForRecordedEvent` (live) and
   `mapWebRecordingObservation` (offline proposal) must agree, and do not
   (scroll; also the offline one carries no fingerprint). Should the offline
   mapper be derived from the live one, or vice versa? This is a Phase 1.1
   consolidation decision, not a bug fix.
2. **Is Finding 2 a defect or a deliberate gate?** Making
   `createWebAutomationRecordingEvent` stamp `metadata.domainId` would
   immediately start delivering user-recorded action inputs to every live
   subscriber, which nothing in this repository currently subscribes to. The
   safer reading is that the hub should test the event's top-level `domainId`
   the way Core's bridge does (`bridge.ts:281`). Either way, both copies of
   the hub (Finding 9) must change together.
3. **Documentation contradiction A.** `docs/architecture/extension-client.md`,
   Recording Evidence, lists "click/input/change/submit/focus/blur" among the
   evidence content scripts emit. Focus and blur are never emitted.
4. **Documentation contradiction B.** The same section states "Primary user
   actions are also sent as `client.recording_entry` action entries so
   Automation Studio timelines can distinguish operator actions from passive
   state observations." The extension never sends `client.recording_entry`
   (grep above). The action entry is created on the Core side from
   `client.recording_event` + `metadata.inputId`
   (`bridge.ts:283`, `io-bridge.ts:34-49`). The outcome the sentence describes
   does happen; the mechanism it names does not.
5. **Documentation contradiction C.** `content/describe-element.ts:4` claims
   "Sensitive values are filtered here, not by the caller." See Finding 8.
6. **Should `dom.submit` stay unmapped?** Currently pinned by
   `domain.test.ts:224`. If Week 1 wants "Form interaction" as a first-class
   capability, a JavaScript-initiated submit with no preceding click produces
   no executable step today.
7. **No `web.dom.check` / `web.dom.toggle` output exists.** Finding 6 cannot
   be fixed by remapping alone; it needs a vocabulary addition, which overlaps
   the `audit-actions` brief. Worth the supervisor reconciling the two reports
   before Phase 1.2 is scoped.
