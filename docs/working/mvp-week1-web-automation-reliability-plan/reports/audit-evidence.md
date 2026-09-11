# Report: audit-evidence

## Outcome

Done. Read-only audit of the browser state/evidence model for Phase 1.4. No
source file, and no working document, was edited. Every claim below cites a
`path:line` or an exported symbol.

Headline findings:

1. There are **two independent evidence pipelines** from the same content-script
   `DomSnapshot`, with different filters, different caps, and different
   orderings: the *state* pipeline (recording evidence → `StateSnapshot` →
   recording timeline) and the *LLM* pipeline (action result → sanitized
   `web-llm-evidence.v1` → prompt). Neither feeds a deterministic check.
2. Of the plan's 16 evidence items, **8 are present, 5 partial, 3 absent**.
   The three absent ones (dialogs/modals, blocking overlays, expected-state
   evidence) have no representation anywhere in either repository.
3. **Nothing compares expected state to observed state today.** The Core
   `builtin.policy.expectation` node returns `passed: true` unconditionally
   (`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\nodes\policy\expectation.ts:31-36`),
   and `compareAutomationStudioTransition` only *counts* the keys of
   `expectedState` (`transition-comparison.ts:21`) without evaluating any of them.
4. The rich state snapshot is deliberately **excluded** from proposal mapping
   and normalization review as "transport, not behaviour"
   (`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\service\recordings\timeline.ts:3-12`).
   Its only consumer is the recording timeline / State View UI.

---

## The 16 evidence items

`present` = produced and carried to at least one consumer; `partial` = produced
but degraded, lossy, or lost at a hop; `absent` = no representation.

| # | Evidence item | Status | Producing file:symbol | Consuming side | Size cap |
| --- | --- | --- | --- | --- | --- |
| 1 | Interactive elements | present | `apps/extension/src/content/dom-snapshot.ts:60 snapshotElements` (candidates at `:91`, inclusion at `:105 shouldIncludeSnapshotElement`, ranking at `:120 snapshotElementBucket` / `:156 elementPriority`) | state pipeline (`domain/src/recording/web-state.ts:99 filterStateElements`) and LLM pipeline (`domain/src/runtime/llm-evidence.ts:268`) | 2,000 kept per frame (`dom-snapshot.ts:31`), 50,000 elements scanned (`:32`); 1,500 into state (`web-state.ts:56`); 40 into LLM evidence (`llm-evidence.ts:15`) |
| 2 | Visible text | present | `apps/extension/src/content/describe-element.ts:180 visibleText`, `:186 directVisibleText`; chosen per element at `:120-126` | both pipelines; `web-state.ts:430 elementStatePayload` carries `text`/`visibleText`; LLM keeps one of them | 500 chars per element (`describe-element.ts:182`, `:193`); 300 chars in LLM evidence (`llm-evidence.ts:12`, applied `:285`) — and dropped entirely when equal to `name` (`:286`) |
| 3 | Forms | partial | No form model. Controls appear as ordinary elements; `forms.<selector>` state is written only by the recording reducer from `dom.input` (`domain/src/recording/reducers.ts:18-20`) | recording state only; declared path `forms.*` at `domain/src/recording/domain.ts:101` | inherits element value cap of 2,000 chars (`describe-element.ts:199`) |
| 4 | Current URL | present | `dom-snapshot.ts:36` (`location.href`); `web-state.ts:68` → `page.url` | state pipeline, LLM evidence `location` (`llm-evidence.ts:321 evidenceLocation`, origin+pathname only — query and hash are stripped) | 2,000 chars (`llm-evidence.ts:11`, enforced `:411 safeUrl`) |
| 5 | Page title | present | `dom-snapshot.ts:37` (`document.title`); `web-state.ts:69` → `page.title` | state pipeline; LLM evidence `title` (`llm-evidence.ts:317`) | 300 chars in LLM evidence |
| 6 | Navigation state | partial | `apps/extension/src/background/connection/navigation-recorder.ts:12 NavigationRecorder` decides which URL changes become `browser.navigation` events; `domain/src/io/input-model.ts:30` maps only `transition === "typed"` to an input | recording timeline / input model | debounce 250 ms (`:5`), initial-navigation grace 10 s (`:8`), explanatory-action window 5 s (`:10`) |
| 7 | Dialogs / modals | **absent** | none — `role="dialog"`, `aria-modal`, and `<dialog>` appear in no selector list, no trait predicate, and no attribute allowlist (grep over `apps/extension/src/content/*.ts` and `domain/src/recording/*.ts` returns nothing) | nothing | n/a |
| 8 | Relevant page regions | **absent** | none — no landmark/region concept. The `region` layers in `web-state.ts:259` and `:331` are per-element bounding boxes inside a `StateVisualFrame`, not page regions | nothing | n/a |
| 9 | Repeating structures | **absent** (and actively harmful, see below) | none. `web-state.ts:422 elementStateId` keys elements by `data-testid`/`data-test`/`data-cy`/`id`, and `filterStateElements` de-duplicates on that key (`web-state.ts:108-110`) | nothing | n/a |
| 10 | Selected elements | present | `dom-snapshot.ts:53-56` (`focusedElement`, `selectedText`); `describe-element.ts:146-148` (`selectedValue` for `<select>`) → `web-state.ts:72-76` (`page.selectedText`, `focus.target`) | state pipeline (UI). LLM evidence keeps only `selectedValue` (`llm-evidence.ts:295`); focus and page selection are **dropped** | `selectedText` 2,000 chars (`dom-snapshot.ts:56`); 20 options, 200 chars each (`describe-element.ts:142-147`) |
| 11 | Recently interacted elements | partial | `apps/extension/src/content/event-elements.ts:176 observedEventElementQueue`, fed by `:179 rememberEventPathElements`; ranked first by `dom-snapshot.ts:121` (bucket 0) | **ordering only — never a field.** `DomElementDescriptor` has no recency flag (`apps/extension/src/content/types.ts:11-32`), and `filterStateElements` re-sorts by its own bucket/score (`web-state.ts:102-105`), discarding the recency order on the state path. The LLM path preserves the order because it reads the raw array | 500 remembered elements (`event-elements.ts:170`) |
| 12 | Changed elements | partial | `apps/extension/src/content/recorder.ts:27` MutationObserver → `dom.mutation` with counts `{added, removed, attributes, text}` only | recording timeline label only (`apps/extension/src/background/connection/recorded-event.ts:62`, `:73`) | batched to one event per 500 ms quiet period (`recorder.ts:39`); **recording-only** — the observer is attached solely by `setRecordingState` (`recorder.ts:66`), so nothing is captured during runtime execution |
| 13 | Relevant attributes | present | `describe-element.ts:151` — a fixed 24-attribute allowlist (`id, class, name, type, autocomplete, data-sensitive, placeholder, title, alt, href, tabindex, aria-label, aria-disabled, aria-expanded, aria-controls, aria-pressed, aria-selected, data-testid, data-test, data-cy, disabled, onclick`) | state pipeline verbatim (`web-state.ts:450`); LLM evidence keeps **no attribute map** — only derivations: `controlType` from `attributes.type` (`llm-evidence.ts:290`), `revealKind`/`expanded` from `aria-expanded`/`aria-controls` (`:430-440`) | 500 chars per attribute (`describe-element.ts:153`) |
| 14 | Loading state | partial | `document.readyState` is sent once, in `content.ready` metadata (`apps/extension/src/content/recorder.ts:50`); tab `status` reaches browser state (`apps/extension/src/background/connection/browser-state.ts:43`). The page snapshot has **no** loading field, and `aria-busy` / spinner detection does not exist | browser-state input (`web.browser.state`) | n/a |
| 15 | Blocking overlays | **absent** | none. `dom-snapshot.ts:105 shouldIncludeSnapshotElement` rejects `hidden`, `aria-hidden`, `display:none`, `visibility:hidden`, `opacity:0` — but never tests occlusion; `visual-bounds.ts:23 visibleViewportBounds` only clips to the viewport. No z-index, `pointer-events`, or hit-test check anywhere | nothing. (Action targeting does hit-test implicitly via `document.elementFromPoint` in `apps/extension/src/content/action-runtime.ts:69`, `:75`, but the overlay it hits is never reported as evidence) | n/a |
| 16 | Expected-state evidence | **absent** | none in this repository. The Core contract slot exists (`AutomationStudioExpectedTransition.expectedState?: JsonObject`, `F:\!FluxIQ\...\runtime\executor\contracts.ts:27`), but no web output node writes `parameterValues.expectedState` (grep over `domain/src` returns nothing) | nothing | n/a |

**Counts: 8 present, 5 partial, 3 absent.**

### Two defects worth carrying into the Phase 1.3/1.4 plan

- **Repeating structures collapse.** `elementStateId` (`web-state.ts:422`)
  resolves to `sanitizeStateId(data-testid ?? data-test ?? data-cy ?? id)` when
  any of those exist. A list whose rows all carry `data-testid="product-card"`
  therefore produces one state id for every row, and `filterStateElements`
  keeps only the highest-scoring one (`web-state.ts:108-110`). The fallback for
  `name` is safer — it appends the selector (`:425-426`), which is why the
  two-radio fixture at `domain/src/tests/domain.test.ts:107-116` keeps both —
  but `data-testid` and `id` have no such disambiguation.
- **Frame coverage differs by pipeline.** Recording evidence merges every frame
  and translates child-frame bounds into top-frame coordinates
  (`apps/extension/src/background/connection/dom-snapshot.ts:66
  captureMergedTabSnapshot`, 150 ms per-frame timeout at `:13`). The
  action-result path used by the LLM tools is **top-frame only**
  (`apps/extension/src/runtime/action-runner.ts:48-53`, `topFrameOnly` when no
  `frameId` is given), so iframe content never reaches `web-llm-evidence.v1`.

---

## The snapshot pipeline, end to end

### Hop 1 — capture in the content script

`captureSnapshot()` — `apps/extension/src/content/dom-snapshot.ts:34` — returns
DTO **`DomSnapshot`** (`apps/extension/src/content/types.ts:37`), whose elements
are **`DomElementDescriptor`** (`types.ts:11`), built by `describeElement`
(`describe-element.ts:109`).

Candidates are gathered in four passes (`dom-snapshot.ts:79`): the remembered
event-path elements, then a fixed control selector list, then semantic text
tags, then media tags, then a capped generic `*` sweep. Each survives
`shouldIncludeSnapshotElement` (`:105`), is ranked by
`snapshotElementBucket` (`:120`, event-backed first) then `elementPriority`
(`:156`) then document order, and is truncated to 2,000.

A child frame first resolves its viewport offset:
`captureSnapshotForResponse` (`action-runtime.ts:25`) awaits
`requestFrameGeometry()` before capturing.

### Hop 2 — wire message

Two distinct routes carry the same DTO:

- **Recording route.** `chrome.runtime.sendMessage({type: CONTENT_EVENT, payload})`
  (`apps/extension/src/content/recorder.ts:59`) with DTO
  **`RecordingEventPayload`** (`types.ts:46`, mirrored on the background side as
  `apps/extension/src/shared/protocol.ts:237`). A snapshot is attached only for
  the five kinds in `shouldAttachStateSnapshot` (`content/snapshots.ts:1`:
  `dom.click`, `dom.input`, `dom.change`, `dom.submit`, `dom.keydown`) and only
  when `captureSettings.snapshots` is on (`recorder.ts:117`).
- **Action route.** `{type: "executeAction"}` → `executeContentAction`
  (`content/actions.ts:37`) → DTO **`BrowserActionResult`** (`types.ts:78`),
  whose `snapshot` field carries a fresh `DomSnapshot` on **every** action type
  (`actions.ts:41-96`) and on failure (`action-runtime.ts:46 actionFailure`).

The background worker re-reads and merges frames for the recording route:
`captureMergedTabSnapshot` (`background/connection/dom-snapshot.ts:66`) →
DTO **`DomSnapshotPayload`** (`:9`, structurally
`Parameters<typeof createWebAutomationStateFromSnapshot>[0]`), validated by
`isDomSnapshotPayload` (`:22`).

### Hop 3 — domain state conversion

`createWebAutomationStateFromSnapshot(snapshot, input)` —
`domain/src/recording/web-state.ts:62` — takes DTO
**`WebAutomationDomSnapshotInput`** (`:29`) with elements
**`WebAutomationElementStateInput`** (`:9`) and returns Core's
**`StateSnapshot`**.

It writes, under namespace `web` (`recording/state.ts:16`):
`page.url`, `page.title`, `viewport.bounds`, `scroll.position`,
optional `page.selectedText`, optional `focus.target` (an **`ActionTarget`**
from `webAutomationActionTargetFromElement`, `:129`), `elements.count`, and one
`elements.<id>` JSON value per surviving element (`:190 addElementStateValues`,
payload from `:430 elementStatePayload`).

It then attaches two **`StateVisualFrame`**s via `withScreenVisualFrame` (`:218`):
`screen` (viewport-screenshot space, optional `screenshot` image layer plus one
`region` layer per element) and `document` (document-map space, a `viewport`
marker plus one `region` layer per element). Both are capped at
`MAX_VISUAL_FRAME_ELEMENTS = 1_000` (`:57`).

The recording reducer `webAutomationStateReducer`
(`domain/src/recording/reducers.ts:5`) merges that snapshot state into the
running state and adds `forms.<selector>`, `runtime.lastActionResult`,
`runtime.lastActionVisualTarget`, and `runtime.lastError`.

`RecordingEvidenceReporter.sendRecordingEvidence`
(`apps/extension/src/background/connection/recording-evidence.ts:66`) pairs the
state with a screenshot when it can and sends `client.snapshot` with
`kind: "state"` — DTO **`ClientGatewaySnapshot`** — otherwise
`client.state_update` — DTO **`ClientGatewayStateUpdate`** with
`metadata.inputId = web.recording.evidence`.

### Hop 4 — Core state/evidence contract

Core DTOs, all from `F:\!FluxIQ\packages\contracts\src\automation-studio.ts`:
**`StateSnapshot`** (`:49`) → **`StateNamespace`** (`:41`) →
**`StateValue`** (`:28`), with **`StateBounds`** (`:8`),
**`EvidenceAnchor`** (`:12`), **`ActionTarget`** (`:88`),
**`ActionVisualEntityTarget`** (`:101`), **`StateDelta`** (`:54`), and the
timeline entries **`StateCheckpointEntry`** (`:139`) and
**`ObservationEntry`** (`:140`).

`AutomationStudioClientGatewayBridge.appendSnapshot`
(`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\client-gateway\bridge.ts:340`)
turns a `kind: "state"` snapshot into an `observation` timeline entry with
`observationType: "client.state_snapshot"`; `appendStateUpdate` (`:392`) does the
same with `client.state_update`. **Both return early when no recording is
active** (`:341-342`) — outside a recording the state snapshot is discarded.

Downstream of that, both observation types are filtered out again:
`recordingTimelineForProposalMapping`
(`F:\!FluxIQ\...\runtime\service\recordings\timeline.ts:7`) drops them before
proposal mapping, and `isHighFrequencyStateObservation`
(`F:\!FluxIQ\...\normalization\default-normalizer.ts:140`) classifies them as
high-frequency noise. The comment at `timeline.ts:3-5` states the intent:
"state checkpoints and client state snapshots are transport, not behaviour".

### Parallel hop 3′/4′ — the LLM evidence path

`createWebAutomationLlmEvidenceRuntime`
(`domain/src/runtime/llm-evidence.ts:137`) calls
`gateway.executeAction(sessionId, {actionType: "web.dom.capture_snapshot"})`,
reads `result.payload.snapshot` — the **raw** `DomSnapshot`, passed through
unchanged by `webAutomationActionResultPayload`
(`domain/src/client/gateway-mapping.ts:135`) — and sanitizes it into
**`WebLlmPageEvidence`** (`llm-evidence.ts:43`) with elements
**`WebLlmEvidenceElement`** (`:19`).

That packet reaches the model as `context.evidenceLoop.evidence`
(`F:\!FluxIQ\...\runtime\llm\deepseek-provider.ts:447`;
shape at `...\runtime\llm\harness\context-packet.ts:39`).

`produceWebReusableEvidence` (`domain/src/runtime/reusable-evidence.ts:52`)
then derives **`WebReusableEvidenceFingerprint`** (`:20`) and
**`WebReusableEvidencePromptProjection`** (`:36`) — selector values replaced by
digests (`:113`) — for the reusable LLM-context store via
`mapCompletedWebReusableEvidenceToPutRequest`
(`domain/src/runtime/reusable-evidence-coordinator.ts:62`).

---

## `web-llm-evidence.v1` sanitization, and its 12 KB / 40-element cap

Schema constant: `WEB_LLM_EVIDENCE_SCHEMA_VERSION = "web-llm-evidence.v1"`
(`domain/src/runtime/llm-evidence.ts:5`). Entry points:
`sanitizeWebLlmSnapshot` (`:264`) → `sanitizeWebLlmSnapshotWithBindings` (`:268`).

Caps and limits:

| Limit | Value | Location |
| --- | --- | --- |
| Elements | 40 | `MAX_ELEMENTS`, `:15`; enforced `:276-278` |
| Default byte budget | 6,000 | `DEFAULT_MAX_EVIDENCE_BYTES`, `:16` |
| Hard byte ceiling | 12,000 | `HARD_MAX_EVIDENCE_BYTES`, `:17`; `Math.min` applied in `evidenceByteLimit`, `:462` |
| Caller-supplied budget | 1…100,000, then clamped to 12,000 | `:462` |
| URL | 2,000 chars | `MAX_URL_LENGTH`, `:11` |
| Text / name / title | 300 chars | `MAX_TEXT_LENGTH`, `:12` |
| Selector | 500 chars | `MAX_SELECTOR_LENGTH`, `:13` |
| `<select>` options | 20 options × 200 chars | `:428 sanitizedOptions` |
| Target handle | `^target\.[1-9][0-9]?$` (so 1–99) | `TARGET_HANDLE_PATTERN`, `:14` |
| Reusable-evidence source cap | 40 elements / 20 actions / 20 capabilities | `reusable-evidence.ts:8-10`, enforced `:60-62` |
| Reusable projection | 24 facts / 4,096 bytes | `reusable-evidence.ts:11-12` |

What sanitization does:

- Rejects the whole snapshot unless the URL is a bounded, credential-free
  HTTP(S) URL (`:410 safeUrl`), and unless `interactiveElements` is an array (`:273`).
- Optionally pins the origin: `expectedOrigin` mismatch throws "web DOM snapshot
  escaped the expected origin" (`:271`) — used after a navigation (`:194`) and a
  reveal (`:354`).
- Drops sensitive controls entirely (`:454 sensitiveElement`): `type=password`,
  `autocomplete` of `current-password` / `new-password` / `one-time-code` /
  `cc-*`, or `data-sensitive="true"`.
- Emits **no raw values**: only `hasValue` (a boolean, and only for safe fill
  tags — `:294`, `:441 safeFillTag`) and `selectedValue` (only when it matches a
  sanitized option — `:429`).
- Reduces the URL to `origin + pathname`, discarding query and hash
  (`:426 evidenceLocation`); `href` is kept only when same-origin (`:427`).
- Collapses whitespace and slices every string (`:455 optionalText`).
- Replaces the selector with an opaque handle `target.N` in model-facing use;
  the real selector is kept out-of-band in the `selectors` map
  (`WebLlmSnapshotBinding`, `:36`, populated `:315`). Note that the `selector`
  field *is* still present on each returned element (`:301`), so the handle is a
  stability device, not a selector-hiding device.
- Labels the packet `trust: "untrusted-page-evidence"` (`:320`).

The byte cap is applied **after** assembly, by popping elements off the tail
until the serialized packet fits, setting `truncated: true` each time, and
throwing `"web DOM snapshot exceeds the evidence byte limit"` if the element
list empties first (`:326-331`). Because the tail is popped, the content
script's ranking decides what survives — which is why the LLM path keeps the
recency ordering that the state path discards.

`validateWebRuntimeTargetOverrideEvidence` (`:63`) is the one place where a
proposed target is checked deterministically, and it checks only against the
bounded packet already given to the model: exact-selector match, then
action-compatibility filtering via `targetCompatibleWithFailedAction` (`:442`),
returning `matched` / `resolved` / `absent` / `ambiguous`.

### The snapshot filter that retains empty identified controls

Two filters, one on each side of the wire, both deliberately keep a control that
has **no text and no value** as long as it has an author-supplied identifier:

- Content script: `hasMeaningfulInteractableIdentity`
  (`apps/extension/src/content/dom-snapshot.ts:131`) accepts an interactable
  element on `stableElementId(...)` alone — `data-testid`, `data-test`,
  `data-cy`, `id`, or `name` (`describe-element.ts:215`) — or on `title`, `alt`,
  `placeholder`, or `href`. It is reached through `shouldIncludeSnapshotElement`
  (`:113-117`), which routes interactables to this stricter test while ordinary
  elements need presentation (`:149 hasElementPresentation`).
- Domain: `shouldCaptureElementState` (`domain/src/recording/web-state.ts:117`)
  keeps an element when
  `isLikelyInteractableElement(...) && hasMeaningfulElementIdentity(...)`, and
  `hasMeaningfulElementIdentity` (`:512`) is satisfied by
  `hasStableElementIdentity` alone (`:525`: `data-testid`, `data-test`,
  `data-cy`, `aria-label`, `name`, `id`). Bounds are still required (`:118`).

Evidence in the test suite: `domain/src/tests/domain.test.ts:70-76` — the empty
`input[name=search]` with only `attributes: {name: "search"}` survives while
`button.icon` (no bounds, no identity) is dropped; `:107-117` — two empty radios
sharing `name: "plan"` both survive, giving `elements.count === 2`.

---

## How "expected state" is represented and compared today

**Representation.** Three slots exist, all in Core, all free-form:

1. `AutomationStudioExpectedTransition.expectedState?: JsonObject`
   (`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\executor\contracts.ts:27`),
   filled by `expectedTransitionForNode`
   (`...\runtime\executor\expected-transition.ts:5`) from either
   `node.parameterValues.expectedState` (`:8`) or, for
   `builtin.policy.expectation` only, `{conditions, mode}` lifted from the node's
   parameters (`:55-60`).
2. `AutomationStudioFlowAdaptation.observedState` / `.expectedState`
   (`...\model\flow-adaptation.ts:343-344`), persisted as adaptation evidence
   (`...\runtime\service.ts:5666`, `...\storage\project\adaptation-store.ts:334-349`).
3. `NodeStateRuntimeComparison` (`...\model\node-state.ts:46`) — the richest
   shape, with `matches` / `mismatches` carrying `factPath`, `expected`, and
   `actual`. **It has a validator (`...\model\validation\node-state.ts`) and
   tests, but no producer anywhere in Core `src`** (grep for the symbol outside
   `model/` and `tests/` returns nothing).

**Comparison.** `compareAutomationStudioTransition`
(`...\runtime\executor\transition-comparison.ts:6`) computes
`stateCheckCount = Object.keys(expected.expectedState ?? {}).length` (`:21`) and
uses it in exactly one place: `classifyTransitionComparisonStatus` (`:68`)
returns `missing_expected_state` when `stateCheckCount > 0` **and** the actual
route is `failed` or the `failed` output is true. The values inside
`expectedState` are never read, never resolved against a state path, and never
compared to a `StateSnapshot`. Everything else the comparison decides comes from
route, status, output ids, and effect types (`:9-20`).

The `builtin.policy.expectation` node itself is a stub: its `execute` returns
`{status: "success", route: "passed", outputs: {passed: true, failed: false}}`
unconditionally and merely echoes its conditions into a
`policy.expectation.checked` effect
(`F:\!FluxIQ\...\nodes\policy\expectation.ts:31-36`). Its `timeoutMs` parameter
("How long to wait for expected state to appear", `:28`) is not honoured.

**On the web side there is nothing at all.** No web output node writes
`expectedState`; no web node type corresponds to an expectation; the browser
`StateSnapshot` is never read back at execution time (the bridge discards it
outside a recording). The only expected-vs-actual behaviour that exists for web
automation today is `validateWebRuntimeTargetOverrideEvidence`
(`domain/src/runtime/llm-evidence.ts:63`), which validates an LLM-proposed
*selector*, not a state expectation.

The Core plan the brief points at describes the intended design in its
section 9, "Add runtime expected-vs-actual comparison"
(`F:\!FluxIQ\docs\working\node-state-evidence-view-plan.md:755-793`), marked
"implemented 2026-08-12" with acceptance criterion "Runtime failures identify
which expected facts did not match". As above, only the DTO and its validator
landed; no code produces a `NodeStateRuntimeComparison`. This contradiction is
recorded below.

---

## Compactness

Two measurements, one from the repository's own fixture and one computed here.

**Sanitized LLM evidence packet (representative, measured).** The
maximum-window fixture at `domain/src/tests/domain.test.ts:327-333` — 40
elements, each with `tag`, `selector`, `role`, `name`, and a ~80-character
`text` — serializes to **7,226 bytes**; the test asserts the range
`>= 6_500 && <= 7_488`. Each element costs about **174 bytes**.

The consequence is worth planning around: **7,226 bytes exceeds the default
budget of 6,000** (`DEFAULT_MAX_EVIDENCE_BYTES`). A real 40-element page with
that much text is trimmed by the pop-loop at `llm-evidence.ts:326` down to
roughly 33–34 elements unless the caller raises `maxEvidenceBytes`; only at the
12,000-byte hard ceiling do all 40 survive. (The fixture is a hand-built literal
and never passes through the sanitizer, so the test does not exercise that
trimming.)

**Raw `DomSnapshot` (computed, not measured from a live page).** A single
`DomElementDescriptor` carrying the fields `describeElement` typically emits —
tag, selector, xpath, id, three class names, text and visibleText, role, name,
viewport and document bounds, `isVisibleOnViewport`, `hasClickHandler`, and a
seven-entry attribute map — serializes to **634 bytes**. At that rate:

| Elements | Approx. serialized size |
| --- | --- |
| 40 (LLM cap) | 25 KiB |
| 200 (a modest page) | 124 KiB |
| 1,000 (visual-frame cap) | 605 KiB |
| 1,500 (state cap) | 907 KiB |
| 2,000 (content-script cap) | 1,209 KiB |

So the raw snapshot crossing the wire in every `BrowserActionResult` is roughly
**two orders of magnitude larger** than the sanitized packet the model sees, and
nothing bounds it by bytes — only by element count. Strings within it are capped
individually (500 chars for text, 2,000 for values, 500 per attribute), so a
pathological page can push the per-element cost several times higher than the
634-byte figure above.

---

## What changed and why

Nothing. This brief is read-only investigation; no source file, no working
document, and no baseline was modified. The only file written is this report.

## Commands run and observed results

All read-only. Reads via `cat -n` / `sed -n`, searches via `grep -rn`.

1. `grep -n "^## \|^### Brief" docs/working/mvp-week1-web-automation-reliability-plan.md`
   → 11 headings; located `### Brief: audit-evidence` at line 164.
2. `sed -n '1,82p' …/mvp-week1-web-automation-reliability-plan.md` and
   `sed -n '164,196p'` → read `## Current State`, the shared `## Worker Briefs`
   rules, and this brief.
3. `wc -l apps/extension/src/content/*.ts domain/src/recording/*.ts domain/src/runtime/*.ts`
   → 3,683 lines total; largest relevant files `web-state.ts` (644) and
   `llm-evidence.ts` (463).
4. Read in full: `content/dom-snapshot.ts`, `content/types.ts`,
   `content/describe-element.ts`, `content/element-traits.ts`,
   `content/visual-bounds.ts`, `content/dom-events.ts`, `content/event-elements.ts`,
   `content/recorder.ts`, `content/actions.ts`, `content/snapshots.ts`,
   `content/message-handler.ts`, `content/capture-settings.ts`;
   `background/connection/dom-snapshot.ts`, `browser-state.ts`,
   `recording-evidence.ts`, `navigation-recorder.ts`;
   `runtime/snapshot-runner.ts`, `runtime/result-mapping.ts`;
   `domain/src/recording/{web-state,state,reducers,domain,observations}.ts`;
   `domain/src/runtime/{llm-evidence,reusable-evidence,reusable-evidence-coordinator}.ts`;
   `domain/src/io/input-model.ts`.
5. `grep -rn "dialog\|modal\|aria-modal\|overlay\|z-index\|pointer-events\|landmark\|readyState\|aria-busy\|aria-live" apps/extension/src/content/*.ts domain/src/recording/*.ts -i`
   → **one** hit: `content/recorder.ts:50` (`readyState`). Basis for the three
   `absent` rows and the `loading state` row.
6. `grep -rn "expectedState|expectation|expected" packages/contracts/src/*.ts` (Core)
   → **no output**; the expectation vocabulary is not in the public contracts package.
7. `grep -rln "expectedState" packages/fluxiq/src` (Core) → 20 files; read
   `runtime/executor/expected-transition.ts`, `runtime/executor/transition-comparison.ts`,
   `runtime/executor/contracts.ts`, `model/flow-adaptation.ts`,
   `nodes/policy/expectation.ts`, `model/node-state.ts`.
8. `grep -rn "NodeStateRuntimeComparison" --include=*.ts packages/fluxiq/src --exclude-dir=tests | grep -v "model/"`
   → **no output**: the type has a validator and tests but no producer.
9. `grep -rn "client.snapshot\|client.state_update" packages/fluxiq/src --exclude-dir=tests`
   → located `client-gateway/bridge.ts:340 appendSnapshot`,
   `runtime/service/recordings/timeline.ts:10`,
   `normalization/default-normalizer.ts:140`; read each.
10. `grep -rn "MAX_ELEMENTS|MAX_SNAPSHOT_CANDIDATES|MAX_STATE_ELEMENTS|MAX_VISUAL_FRAME_ELEMENTS|HARD_MAX_EVIDENCE_BYTES|DEFAULT_MAX_EVIDENCE_BYTES" domain/src apps/extension/src`
    → the 16 cap constants tabulated above.
11. `node <scratchpad>/evidence-size.mjs` (a standalone script; imports nothing
    from either repository) → observed output:

    ```
    sanitized web-llm-evidence.v1, 40 elements: 7226 bytes
      per element: 174 bytes
    raw DomElementDescriptor (typical, all common fields): 634 bytes
      raw DomSnapshot.interactiveElements x40: 24.8 KiB
      raw DomSnapshot.interactiveElements x200: 123.8 KiB
      raw DomSnapshot.interactiveElements x1000: 619.1 KiB
      raw DomSnapshot.interactiveElements x1500: 928.7 KiB
      raw DomSnapshot.interactiveElements x2000: 1238.3 KiB
    ```

No build, no test run, no Testing Lab, no browser, no panel.

## Not verified

- **No code was executed from either repository.** Both byte figures come from
  standalone JSON serialization: the 7,226-byte figure re-serializes the literal
  at `domain/src/tests/domain.test.ts:327-331` (the same object the committed
  test asserts against), and the 634-byte figure is a hand-built descriptor
  matching `describeElement`'s field set, not a capture from a live page. A real
  page's average will differ, probably upward on text-heavy sites.
- `domain/src/tests/domain.test.ts` was **not run**; its assertions are quoted as
  committed source, not as observed passes. There is a prebuilt
  `domain/.test-build/domain.test.mjs`, deliberately left unexecuted.
- No live browser, no extension load, no snapshot taken from a real page. Every
  behavioural claim about the content script is read from source, so anything
  depending on real DOM geometry, computed styles, or frame timing is unverified.
- The consuming-side column reflects static call-graph reading. I traced each
  DTO to its handler but did not observe a message in flight, so I cannot rule
  out an additional consumer reached dynamically (for example through the
  `web-panel` host or a Core API endpoint I did not open).
- I did not audit `domain/src/web-panel/`, `apps/extension/src/page/`, or Core's
  UI layer; a State View renderer there could consume evidence fields I marked
  as reaching "UI" only generically.
- Screenshot/asset capture (`state-assets.ts`) was read only as far as its call
  site in `recording-evidence.ts`; the image pipeline itself is out of scope for
  this brief and unverified.

## Open questions or contradictions found

1. **The brief's required read does not exist as specified.**
   `F:\!FluxIQ\docs\working\node-state-evidence-view-plan.md` has **no
   `## Current State` section** (its headings run `Purpose`, `Non-goals and
   invariants`, `Target concepts`, `Target UI`, sections 1–10,
   `Recommended implementation slices`, `Open decisions`, `Progress log`). Its
   header says `Status: Complete`, "Implemented and validated with pnpm check,
   test, build, and docs:check per the ledger". I read the header and section 9
   instead, and read nothing else from that document.
2. **Section 9 of that Core plan is marked implemented, but is not.** It claims
   "Runtime failures identify which expected facts did not match", yet
   `NodeStateRuntimeComparison` has no producer, and the only comparison in the
   executor counts `expectedState` keys without reading them. Either the plan's
   status is wrong or the implementation was reverted. Phase 1.5 should not
   assume expected-vs-actual comparison exists.
3. **`builtin.policy.expectation` is a stub that always passes.** Any Week 1
   scenario that routes through an expectation node will report success
   regardless of page state. This should be treated as a Phase 1.5 blocker, and
   it is a Core change, so it crosses the repository boundary.
4. **Declared state paths that nothing produces.**
   `domain/src/recording/domain.ts:91-100` declares `elements.*.selector`,
   `.stableId`, `.tagName`, `.text`, `.label`, `.value`, `.href`, `.visible`,
   `.enabled`, and `.bounds` as first-class state paths, but
   `addElementStateValues` (`web-state.ts:190`) writes **one** `elements.<id>`
   JSON blob and no sub-paths. The committed test even asserts the absence:
   `domain.test.ts:134` — `Object.keys(webValues).some(path => path.endsWith(".selector")) === false`.
   Any expectation authored against `web.elements.*.enabled` would therefore
   resolve to nothing. Is the declaration aspirational, or is the reducer wrong?
5. **Possible sensitive-value leak in the raw snapshot.**
   `describe-element.ts:132` sets `descriptor.value = readElementValue(element)`
   for any input whenever `captureSettings.inputValues` is on, **without
   consulting `isSensitiveFormControl`** — which the same file's header comment
   claims it does ("Sensitive values are filtered here, not by the caller.",
   `:95`). `isSensitiveFormControl` is used only for `hasValue` (`:140`) and
   `selectedValue` (`:146`). A password field's value therefore appears to reach
   the raw `DomSnapshot`, the `BrowserActionResult`, and the recording state
   (where `web-state.ts:204` merely marks it `sensitive: true`). The LLM path is
   safe — `sensitiveElement` drops the element entirely (`llm-evidence.ts:454`) —
   but the recording and action-result paths are not. I did not execute anything
   to confirm this, so it is a reading of the code, not a demonstrated leak; it
   needs a live check before being acted on, and it is security-relevant enough
   to raise now rather than at Phase 1.4.
6. **Which pipeline should Phase 1.4 improve?** The state pipeline and the LLM
   pipeline share a producer but diverge in filter, ranking, frame coverage, and
   cap. Adding an evidence item (dialogs, overlays, loading) to one does not add
   it to the other. The plan should say explicitly whether Phase 1.4's target is
   the `StateSnapshot` (today consumed only by the timeline/UI, and filtered out
   of proposal mapping) or `web-llm-evidence.v1` (consumed by the model and by
   the one deterministic selector check that exists). On current consumers, the
   LLM packet is where added evidence actually changes behaviour.
7. **`elements.count` counts kept elements, not page elements.**
   `web-state.ts:78` records the post-filter length, so a page with 5,000
   controls and a page with 1,500 look identical. If Phase 1.4 wants truncation
   to be visible to a consumer, the pre-filter total and a `truncated` flag need
   to be carried — the LLM packet has `truncated` (`llm-evidence.ts:324`), the
   state snapshot has no equivalent.
