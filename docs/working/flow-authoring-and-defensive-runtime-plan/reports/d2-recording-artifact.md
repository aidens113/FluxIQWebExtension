# d2 — The recording artifact, and how it becomes a Flow

Read-only investigation at `dev` (`1f4ecc2`). Nothing in the repository was
changed. Every claim below carries `file:line`; line numbers are from the
working tree at that commit.

The short version: a recorded step is **one element description plus one
snapshot of the page, resolved to exactly one registered output with complete
parameters**. The only thing it says about *what should be true afterwards* is,
for a click and only for a click, **the path the browser landed on**. Everything
else a "state node" would carry is captured, stored, and never compared. The
Flow a recording becomes is a straight chain of `builtin.policy.action` nodes
wired `success → ready`, with no vocabulary at all for a branch, a loop, an
alternative path, or a retry.

---

## 1. What one recorded step contains, field by field

A step exists in three shapes as it travels. They are different objects and the
differences are load-bearing, so all three are enumerated.

### 1a. At capture, in the content script

`describeElement` (`apps/extension/src/content/describe-element.ts:59-118`)
builds the `DomElementDescriptor` declared at
`apps/extension/src/shared/protocol.ts:186-237`:

| Field | Where it is produced | Note |
| --- | --- | --- |
| `tagName` | describe-element.ts:63 | |
| `selector` | describe-element.ts:64, via `selectorFor` (`content/selector/`) | written **within the tree the element is in** — see `shadowHosts` |
| `xpath` | describe-element.ts:80, `xpathFor` (`element-finder.ts:69-84`) | anchored at the first id it meets |
| `id`, `classNames` | describe-element.ts:77-79 | |
| `text`, `visibleText` | describe-element.ts:70-76 | both set to the same string; sensitive contents removed at source (`visibleText`, describe-element.ts:124-136) |
| `value` | describe-element.ts:81-82 | withheld for a sensitive or file control (`readElementValue`, describe-element.ts:152-164) |
| `role` (authored), `name` (authored `name`/`aria-label`), `href`, `inputType` | describe-element.ts:83-89 | |
| `checked` | describe-element.ts:90-91, `checkedState` (177-182) | checkbox/radio only |
| `hasValue` | describe-element.ts:92-93 | presence without contents |
| `bounds`, `documentBounds`, `isVisibleOnViewport` | describe-element.ts:60-68 | viewport rect and page rect |
| `hasClickHandler` | describe-element.ts:69 | |
| `testId` | describe-element.ts:94-95, `testIdFor` (220-225) | `data-testid` → `data-test` → `data-cy` |
| `accessibleName` | describe-element.ts:96-97, `identity/accessible-name.ts` | computed name |
| `label` | describe-element.ts:98-99, `identity/label.ts` | |
| `implicitRole` | describe-element.ts:100-101, `identity/implicit-role.ts` | the role a page with no ARIA still has |
| `context` | describe-element.ts:102-103, `identity/context.ts:65-94` | the equivalence anchor — see below |
| `options`, `selectedValue` | describe-element.ts:104-108, `selectState` (200-209) | `<select>` only |
| `attributes` | describe-element.ts:109-116 | fixed 25-name allowlist, each value cut at 500 chars |
| `changed`, `recentlyInteracted`, `repeatCount` | protocol.ts:219-236 | snapshot-scoped; **never cross the wire** (protocol.ts:325) |

**The equivalence anchors** live on `context`
(`apps/extension/src/shared/protocol.ts:244-291`, produced at
`content/identity/context.ts:72-92`):

- `formId`, `formName`, `formAction`, `fieldsetLegend`, `landmark`,
  `landmarkName`, `heading`, `listPosition {index,total}`,
  `tablePosition {row,column,columnHeader}` — positional/structural context.
  **None of these is scored or gated at replay** (`output-nodes/targets/targets.ts:224-230`).
- `record { keyAttribute, key, text }` — which row/card/list-item the control sat
  in, produced by `recordIdentity` (`content/identity/record.ts:132`). This is
  the one context field the page **acts on**: a candidate in another record is
  refused outright (`identity/veto.ts:229`, `identity/record.ts:153`). It fails
  closed — a candidate in no record, when the recording named one, disagrees
  (`identity/veto.ts:114-117`).
- `shadowHosts: string[]` — the open shadow roots the element sat inside,
  outermost first, each named by its host's selector *in the tree that host sits
  in* (`content/selector/shadow/host-chain.ts:25-31`). Added by **t063**. Without
  it the recorded selector names nothing in the page; with it the resolver scopes
  every lookup to the roots the chain reaches
  (`content/selector/shadow/scope.ts:41-50`).

**There is no fingerprint hash.** "Fingerprint" in this codebase means the
*bag of signals* above, scored by Core's element matcher at resolve time
(`content/identity/score.ts`), never a precomputed digest.

**There is no expected-state digest and no wait condition on the captured step.**
The only readiness signals a capture carries are `isVisibleOnViewport` and the
snapshot's page evidence (`loading.busy`, `loading.pendingNavigation`,
`dialogs.openCount`, `overlays.blockedCount` — declared at
`domain/src/recording/domain.ts:66-91`), and none of them is compared at replay.

### 1b. On the wire, as a gateway recording event

The background worker funnels every event through `RecordedEventIntake`
(`apps/extension/src/background/connection/recorded-event-intake.ts:172-207`) and
sends it as `client.recording_event`
(recorded-event-intake.ts:193). The envelope is built by
`createWebAutomationRecordingEvent`
(`domain/src/client/gateway-mapping.ts:75-124`):

| Envelope field | Source |
| --- | --- |
| `eventId` = `web.<sequence>.<eventTimestampMs>` | gateway-mapping.ts:82 |
| `recordingId`, `domainId` (`web-automation`) | gateway-mapping.ts:83-84 |
| `eventType` | `webAutomationEventTypeForClientKind` (`domain/src/io/input-model.ts:67-85`) |
| `timestamp` | gateway-mapping.ts:86 |
| `sourceId` = `tab:<id>[:frame:<id>]` | gateway-mapping.ts:87 |
| `target` (Core `ActionTarget`) | `webAutomationActionTargetFromElement` (`domain/src/recording/web-state/action-target.ts:99-110`) |
| `payload.{url,title,sequence,browserFrameId,element,visualTarget,inputValue,key,scroll,mutation,snapshot,actionResult,tab,extraction}` | gateway-mapping.ts:89-117 |
| `metadata.{clientKind,visualTarget,…recorder metadata}` | gateway-mapping.ts:118-122 |
| `metadata.inputId` (when executable) | `gateway-payloads.ts:89-91` |

The element on the wire is **not** the captured descriptor: it is projected
through `elementTarget` (`apps/extension/src/background/connection/gateway-payloads.ts:135-162`),
which is written against `WireElementTarget` (protocol.ts:336) — the descriptor
minus `hasValue`, `selectedValue`, `options`, `changed`, `recentlyInteracted`,
`repeatCount` (protocol.ts:325). A sensitive control additionally loses
`visibleText`, `text`, `value`, `checked` and `accessibleName`
(gateway-payloads.ts:143-157).

The per-step **snapshot** is the cross-frame merged tab snapshot captured once
per executable event (`recording-evidence.ts:97-100`,
`recorded-event-intake.ts:191-192`), and the structured **state** projected from
it is sent separately as `client.snapshot` +
`client.state_update` with id `state.<kind>.<sequence>.<timestamp>`
(`recorded-event.ts:44-47`, `recording-evidence.ts:121-140`).
`shouldRequireStateForEvidence` (`recorded-event.ts:13-22`) decides which kinds
demand it.

### 1c. On the Flow node

`webAutomationRecordedAction` (`domain/src/io/input-model.ts:97-104`) resolves the
event to `{ inputId, outputId, parameters }`, and
`webAutomationOutputPayload` (`domain/src/output-nodes/payloads.ts:15-17`) writes
the node's parameters. For a click
(`payloads.ts:73`, with the shared prologue at `payloads.ts:66-71`):

```
{
  selector: "<recorded selector>",
  element:  { …elementFingerprint(payload.element)… },   // targets.ts:239-280
  visualTarget: { …bounds/documentBounds/statePath… },    // payloads.ts:69
  browserFrameId: 0,                                      // payloads.ts:42-48
  browserFrameUrlPath: "/…"                               // child frames only
}
```

`elementFingerprint` (`domain/src/output-nodes/targets/targets.ts:239-280`) is the
closed vocabulary the node may carry: `selector, xpath, id, classNames,
visibleText, tagName, text, value, role, implicitRole, name, href, inputType,
checked, testId, accessibleName, label, attributes, context`, with Core's
remaining signals explicitly written `undefined` so a new Core signal breaks the
build (targets.ts:263-278). `context` is re-read through the same closed
vocabulary (targets.ts:315-332), including `record` (352-361) and `shadowHosts`
(370-374, added by t063).

### An annotated recorded step — one click on a row action

```jsonc
{
  "eventId": "web.14.1758500000000",          // gateway-mapping.ts:82
  "recordingId": "rec_2026_09_21_1",
  "domainId": "web-automation",
  "eventType": "web.element.clicked",         // input-model.ts:71
  "timestamp": 1758500000000,
  "sourceId": "tab:7:frame:0",                // gateway-mapping.ts:87

  // Core's ActionTarget, built at action-target.ts:99-110. Core's matcher reads
  // this; metadata carries every signal it is not promoted out of (50-53).
  "target": {
    "type": "button", "id": "row-actions", "label": "Row actions",
    "selector": "[data-testid=\"member-rows\"] > tr:nth-of-type(92) > td:nth-of-type(7) > button",
    "bounds": { "x": 980, "y": 412, "width": 32, "height": 32 },
    "metadata": { "testId": "row-actions", "accessibleName": "Row actions",
                  "label": "Row actions", "implicitRole": "button",
                  "visibleText": "", "xpath": "//*[@id=\"members\"]/table/tbody/tr[92]/td[7]/button",
                  "classNames": ["icon-btn"], "attributes": { … }, "context": { … } }
  },

  "payload": {
    "url":   "https://example.test/members",        // gateway-mapping.ts:90
    "title": "Members",
    "sequence": 14,                                 // restarts in every document
    "browserFrameId": 0,                            // gateway-mapping.ts:101

    // The wire element: WireElementTarget, gateway-payloads.ts:135-162.
    "element": {
      "tagName": "button",
      "selector": "[data-testid=\"member-rows\"] > tr:nth-of-type(92) > td:nth-of-type(7) > button",
      "xpath":    "//*[@id=\"members\"]/table/tbody/tr[92]/td[7]/button",
      "classNames": ["icon-btn"],
      "text": "", "visibleText": "",
      "implicitRole": "button",                     // describe-element.ts:100
      "testId": "row-actions",                      // describe-element.ts:94
      "accessibleName": "Row actions",              // describe-element.ts:96
      "label": "Row actions",                       // describe-element.ts:98
      "bounds":         { "x": 980, "y": 412, "width": 32, "height": 32 },
      "documentBounds": { "x": 980, "y": 3_180, "width": 32, "height": 32 },
      "isVisibleOnViewport": true,
      "hasClickHandler": true,
      "attributes": { "class": "icon-btn", "aria-label": "Row actions", "data-testid": "row-actions" },

      // THE EQUIVALENCE ANCHOR. protocol.ts:244-291 / context.ts:72-92.
      "context": {
        "landmark": "main", "landmarkName": "Members",
        "heading": "Directory",
        "tablePosition": { "row": 92, "column": 7, "columnHeader": "Actions" },
        // The only context field replay GATES on — veto.ts:229, record.ts:153.
        "record": { "keyAttribute": "data-member-id", "key": "usr_9f31" },
        // t063. Absent here (light DOM); present for a control in a shadow root.
        "shadowHosts": undefined
      }
    },

    // Derived from the element when the recorder sent none — gateway-payloads.ts:194-198.
    "visualTarget": { "namespace": "web", "statePath": "elements.<id>",
                      "bounds": { … }, "documentBounds": { … } },

    // The merged tab snapshot taken for THIS event — recorded-event-intake.ts:191.
    "snapshot": { "url": …, "title": …, "viewport": …, "interactiveElements": [ … ],
                  "evidence": { "loading": { "busy": false, "pendingNavigation": false },
                                "dialogs": { "openCount": 0, "modal": false },
                                "overlays": { "blockedCount": 0 }, … } }
  },

  "metadata": {
    "clientKind": "dom.click",                      // gateway-mapping.ts:119
    "inputId": "web.user.element_clicked",          // gateway-payloads.ts:90
    "visualTarget": { … },                          // gateway-payloads.ts:91
    "clientX": 996, "clientY": 428, "button": 0,    // dom-events.ts:258-267
    "pointerId": 1, "pointerType": "mouse",
    "sourceEvent": "pointerdown", "captureTiming": "before-action"   // dom-events.ts:114-115
  }
}
```

The step above becomes **one** Flow node:

```jsonc
{
  "id": "recorded.<candidateId>",
  "definitionId": "builtin.policy.action",          // Core proposal-candidates.ts:107
  "label": "Click",                                  // web-panel-host.ts:106
  "parameterValues": {
    "outputId": "web.dom.click",
    "parameters": { "selector": "…", "element": { …fingerprint… },
                    "visualTarget": { … }, "browserFrameId": 0 },
    "confirmationInputId": "web.user.element_clicked",   // web-panel-host.ts:203
    "confirmationTimeoutMs": 5000,
    // The ONLY expected state a recorded step ever carries — click-landing.ts:67
    "expectedState": { "conditions": [ { "assert": { "kind": "url", "expected": "/members/usr_9f31" } } ],
                       "mode": "all", "timeoutMs": 5000 }
  },
  "metadata": { "stateSnapshotId": "state.dom.click.14.1758500000000",
                "stateRef": "…", "screenshotRef": "…" }   // Core proposal-candidates.ts:146-153
}
```

---

## 2. Where the step is captured, and where it is mapped

**Capture — `apps/extension/src/content/`**

- `dom-events.ts:98-209` registers every listener in the capture phase and
  ignores untrusted events. `pointerdown` → `dom.click` (99-119), `click` →
  `dom.click` (121-134), `input` → debounced `dom.input` (136-148), `change`
  (71-85, 150), `submit` (88-93, 152), `keydown` → `dom.keydown` (161-178),
  wheel/scroll → `dom.scroll` (180-208).
- `shadow-root-events.ts` re-registers `change`/`submit` inside each open shadow
  root an interaction enters (dom-events.ts:95-96, 104, 158, 165), because
  neither event is composed.
- `describe-element.ts:59-118` + `identity/` produce the descriptor.
- `selector/` produces the selector and (t063) the shadow host chain.

**Background funnel — `apps/extension/src/background/connection/`**

- `recorded-event-intake.ts:83-92` de-duplicates the pointerdown/click pair via
  `clickEventSignature` (`recorded-event.ts:51-64`).
- `recorded-event-intake.ts:172-196` decides executable-vs-evidence
  (`recorded-event.ts:9-11`), captures the merged snapshot, and sends.
- `navigation-recorder.ts:86-231` decides which URL changes survive and whether a
  navigation is a click's *landing* (`shouldRecord`, 180-204); the landing is
  emitted as a non-executable `browser.navigation` with
  `metadata.transition: "explained"`, `explainedBy`, `explainedByEventId`
  (`recorded-event-intake.ts:146-160`).
- `gateway-payloads.ts:23-97` maps to the input id and builds the gateway event.

**Domain mapping — `domain/src/`**

- `io/input-model.ts:158-205` — recorded event → registered **input**.
  `io/input-model.ts:131-133` — input → **output** (one row per pair,
  116-129). `io/input-model.ts:245-257` — the completeness gate: an input whose
  output parameters are incomplete stays passive evidence.
- `output-nodes/payloads.ts:66-99` — output → **node parameters**.
- `output-nodes/targets/targets.ts:239-280` — the element identity carried.
- `web-panel-host.ts:137-146` — the registered recording mapper
  (`mapWebRecordingObservation`), bound at `web-panel-host.ts:83-93`. This is the
  seam where a recording becomes Flow nodes.
- `runtime/adapter.ts` + `client/gateway-mapping.ts:152-222` — node parameters →
  the browser command replay runs.

---

## 3. Expected-state checking on a recorded step today

### What is proposed

**One thing, for one verb.** `mapWebRecordingObservation` attaches an
`expectedState` only when the output is `web.dom.click`
(`domain/src/web-panel-host.ts:144`), and it is produced by
`webAutomationClickLandingExpectation`
(`domain/src/runtime/expectation/click-landing.ts:56-68`):

```
{ conditions: [ { assert: { kind: "url", expected: "<pathname>" } } ], mode: "all", timeoutMs: 5000 }
```

It is the **path only** — no query, no hash, no selector, no element text, no
typed value (click-landing.ts:16-19). It is claimed only when an *explained*
navigation in the following entries names this click by `explainedByEventId`
(click-landing.ts:74-82), and it is dropped when the landing path equals the
click page's own path or `/` (click-landing.ts:66). Core shows the mapper at
most 32 following entries (`!FluxIQ` `…/nodes/importer-sdk.ts:93-94`).

Two adjacent proposals exist and are not expected state:

- `expectedConfirmation { inputId, timeoutMs: 5000 }` on every recorded action
  (`web-panel-host.ts:203`) — Core waits for the echo of the same input the
  recording mapped from. Deliberately omitted for the extraction candidate and
  the late-target wait (`web-panel-host.ts:172-177`, `late-target-wait.ts:17-19`).
- A `web.dom.wait_for_selector` node proposed by a recorded DOM **mutation** when
  the next executable entry is a click on a light-DOM selector in the same
  document (`domain/src/recording/proposals/late-target-wait.ts:59-99`). This is
  the only readiness condition a recording can produce, and it is a separate
  node, not a property of the click.

### How it is evaluated at replay

The host evaluator is `createWebAutomationExpectationEvaluator`
(`domain/src/runtime/expectation/evaluate.ts:95-107`). Core calls it from two
places (evaluate.ts:3-6): the `builtin.policy.expectation` node, and the
transition comparison after a **successful** attempt
(`!FluxIQ` `…/runtime/executor/transition-comparison.ts:96-137`).

1. Each condition is read by `webAutomationExpectationCondition`
   (`domain/src/runtime/expectation/conditions.ts:117-138`); a shape it cannot
   read is **unjudged**, not failed (evaluate.ts:140).
2. A readable claim that names nothing askable is refused before dispatch
   (`conditions.ts:191-205`) and is likewise unjudged (evaluate.ts:141-142).
   `absent` with no selector is called out as the dangerous one
   (conditions.ts:25-31).
3. A surviving condition is dispatched to the page as a real `web.dom.assert`
   action (evaluate.ts:146-159, payload built at conditions.ts:146-157), which
   re-queries and waits.
4. The verdict is `{ passed, checkedConditionCount, message, failure }`
   (evaluate.ts:196-233). **`passed: true` means "nothing judged said
   otherwise"**, and the shortfall `conditions.length - checkedConditionCount` is
   the only way "unknown" is carried (evaluate.ts:29-45).

### What happens when it does not match

`attemptWithHostExpectationEvaluation`
(`!FluxIQ` `…/runtime/executor/transition-comparison.ts:96-137`): on
`passed: false` the already-**succeeded** attempt is rewritten to
`status: "failed"`, `route: "failed"`, with the host's failure record — the
domain's `web.validation.state_mismatch` (`domain/src/runtime/failure/codes.ts:35`,
built at `evaluate.ts:188`) or Core's `core.policy.expectation_rejected`
(`…/nodes/policy/expectation.ts:14-19`). The transition comparison status becomes
`missing_expected_state` / `unexpected_state`
(transition-comparison.ts:14-30, 174-181), and the run then routes it exactly as
it routes any failed attempt — i.e. down the node's `failed` port, into whatever
recovery the Flow has.

### The part that exists and is never checked

Every recorded step carries a **state link**: `stateSnapshotId`, `stateRef` and
`screenshotRef` are written onto the node's metadata
(`!FluxIQ` `…/service/recordings/proposal-candidates.ts:146-153`, built at
`…/runtime/service.ts:5643-5657`). No executor path reads it: the only `stateRef`
the runtime uses is the *live* one for the current attempt
(`…/executor/node-execution.ts:123`, `…/executor/transition-comparison.ts:149-150`).
**The recorded state a step produced is provenance and UI, not an assertion.**

---

## 4. What a recording cannot currently express

The ceiling is the mapper contract, not the domain's action vocabulary. A
recording mapper may return one candidate or a flat list of candidates
(`!FluxIQ` `…/nodes/importer-sdk.ts:20-42`), and a candidate has exactly these
fields: `outputId`, `parameters`, `sourceInputIds`, `expectedConfirmation`,
`expectedState`, `recordOutput`, `timeoutMs`, `confidence`, `evidence`, `label`,
`description`. There is **no node kind, no port, no edge, no predicate, no
target node**.

What the approval then builds
(`!FluxIQ` `…/service/recordings/proposal-candidates.ts:98-143`):

- every candidate becomes `definitionId: "builtin.policy.action"` (line 107) —
  one node type for the whole recording;
- edges are `nodes.slice(1).map(…)` with `sourcePortId: "success"`,
  `targetPortId: "ready"` (lines 134-141) — **a straight chain, in timeline
  order, and nothing else**.

So, concretely, a recording cannot express:

| Missing | The Flow primitive that exists and a recording cannot reach |
| --- | --- |
| A branch on a condition | `builtin.control.branch` (`!FluxIQ` `…/nodes/control-flow/branch.ts:5`) |
| A multi-way choice | `builtin.control.switch` (`…/control-flow/switch.ts:4`) |
| A loop | `builtin.control.loop` (`…/control-flow/loop.ts:5`) |
| A loop over a list | `builtin.control.for-each` (`…/control-flow/for-each.ts:12`) |
| Re-joining alternative paths | `builtin.control.merge` (`…/control-flow/merge.ts:4`) |
| Concurrency | `builtin.control.parallel` (`…/control-flow/parallel.ts:4`) |
| Retry / fallback after a failure | `builtin.policy.recovery`, strategies `retry` / `fallback-action` / `abort` with `maxAttempts` (`…/nodes/policy/recovery.ts:3-28`) |
| A standalone check step | `builtin.policy.expectation` (`…/nodes/policy/expectation.ts:21-45`) |
| Taking the `failed` port anywhere | `builtin.policy.action` has `success`, `failed` and `records` ports (`…/nodes/policy/action.ts:18-22`); a recording wires only `success → ready` |

Also unreachable from a recording, inside the web domain itself:

- **An assertion step.** `web.dom.assert`, `web.dom.dialog` and
  `web.browser.download` are dispatch-only: no recorded event maps to one
  (`domain/src/output-nodes/payloads.ts:95-98`). A user cannot record "check that
  the total says £42".
- **A wait the user chose.** The only wait a recording can produce is the
  mutation-derived `wait_for_selector` (late-target-wait.ts:59-99), and only for
  a light-DOM click in the top frame in the same document (late-target-wait.ts:60-68, 90-98).
- **A single-value extraction.** `web.dom.extract` is authorable but no recorded
  event maps to it (`domain/src/io/input-model.ts:22-38`).
- **Iteration over results.** A list extraction paginates *inside* one node
  (`WebAutomationExtractListPagination`, protocol.ts:482), so the loop is opaque
  to the Flow graph.
- **Per-step intent.** Nothing on a candidate says *why* a step was taken or what
  it was trying to achieve; `label` is a fixed lookup table
  (`domain/src/web-panel-host.ts:103-114`).
- **A step that permits a range of outcomes.** `expectedState.mode` is `all`/`any`
  (`conditions.ts` reads it via `expectationRequest`, transition-comparison.ts:141-146),
  but a recording only ever emits `mode: "all"` with one condition
  (click-landing.ts:67).

---

## 5. Which parts of the recorded step replay uses, and in what order

`resolveTarget` (`apps/extension/src/content/action-runtime/resolve-target.ts:219-283`).

**Step 0 — the recorded identity is chosen.** `recordedTarget`
(resolve-target.ts:605-613) reads `action.element` (the declared fingerprint the
domain chose at `domain/src/client/gateway-mapping.ts:211-222, 244-249`) and falls
back to the raw `options.element`.

**Step 1 — scope.** `resolveShadowScope(target.context.shadowHosts)`
(resolve-target.ts:224, `selector/shadow/scope.ts:41-50`). Every strategy and the
scoring below look **only** in the roots the chain reached; a chain that reaches
none yields an empty scope and a not-found failure (scope.ts:15-22). t063.

**Step 2 — exact strategies, in this order** (`exactAttempts`,
resolve-target.ts:356-379):

1. `selector` — `action.selector`, queried in every root in scope (358-360).
2. `coordinates` — `action.coordinates` (361-367). *No web action declares this
   parameter* (veto.ts:296-300), so in practice it never fires.
3. `visual-target` — the centre point of `visualTarget.documentBounds`, corrected
   for the current scroll, else `bounds`/`anchor.bounds`
   (368-375, `pointFromVisualTarget` 648-655).
4. `fingerprint` — `findClosestFingerprint` per root
   (376-378, 395-414), which itself tries, in order
   (`element-finder.ts:21-55`): `selector` → `xpath` (documents only, and only if
   the stored expression is lexable, 28-31, 107-121) → `id` → `attributes["data-testid"]`
   → `name`/`aria-label` → the full `classNames` set → exact `visibleText`
   (repeated in resolve-target.ts:402-413 so ties can be counted, capped at 2,000
   elements scanned, line 166).

**Step 3 — gate each strategy's matches** (`gatedPool` 423-431): keep those that
are the recorded `tagName`, visible (442-450) and enabled (453-456). If the gate
rejects everything, the raw matches stand (425).

**Step 4 — one survivor: the veto** (resolve-target.ts:247-251,
`identity/veto.ts:223-236, 247-267`), in this order:

1. **record gate** — `agreesWithRecordedRecord(target.context.record, element)`
   (veto.ts:229, 251; `identity/record.ts:153`). Refuses whatever it scores; no
   number is produced (veto.ts:196-206).
2. **precondition** — did the recording name anything distinguishing at all?
   `visibleText | accessibleName | label | id | testId | attributes["data-testid"]`
   (veto.ts:308-313). If not, the match is acted on unweighed.
3. **rule 1, contradiction** — Core's `normalizedScore < 0` refuses
   (veto.ts:234, floor at 150).
4. **rule 2, corroboration** — at least one recorded signal must agree *exactly*
   (veto.ts:235, `identity/corroboration.ts`).

A veto is a **miss**, not an abort: the next strategy, then scoring, still run
(resolve-target.ts:248-251).

**Step 5 — positional answers are cross-checked.** For `coordinates` and
`visual-target` only (`POSITIONAL_STRATEGIES`, resolve-target.ts:289), the
recorded target's whole family is enumerated and scored, and a tie fails
`web.target.ambiguous` (254-257).

**Step 6 — several survivors, or nothing matched: Core's matcher.**
`scoreTargetCandidates` over the same-family candidates
(resolve-target.ts:265-267, 279-282, `scoreFamily` 297-300), family =
`tagName` + (`role || implicitRole`) (344-347). Resolution requires clearing a
floor, beating the runner-up by a margin, and agreeing exactly on something
(resolve-target.ts:78-88). Otherwise `TARGET_AMBIGUOUS` (466-500) or
`TARGET_NOT_FOUND` (527-540).

**Step 7 — nothing was even attempted:** the focused element
(resolve-target.ts:270-273).

**After resolution, before acting:** `checkActionability`
(`action-runtime/actionability.ts:35-45`) — visible, enabled, hit-testable after
scrolling — which is a *refusal*, not a wait. **A recorded click does not wait
for its target**: `clickAction` calls `deps.resolveTarget(action)` synchronously
(`content/actions/click.ts:52`). The waiting engine exists
(`action-runtime/waits.ts:29-40`, `wait-conditions.ts:42-54`) but is reached only
by an explicit `wait_for_*` action.

Fields of the recorded step that replay's target resolution **never** reads:
`context.formId/formName/formAction/fieldsetLegend/landmark/landmarkName/heading/listPosition/tablePosition`
(carried but unscored — `output-nodes/targets/targets.ts:224-230`), `bounds` as a
comparison signal (targets.ts:273-275), the per-step `snapshot`, and the
`stateSnapshotId`/`screenshotRef` on the node.

---

## Gaps for model authoring

What a model-driven exploration would need that the recorded-step contract does
not carry today. Each is a gap in the *contract*, not in the model.

1. **No graph.** A recording produces a flat candidate list
   (`!FluxIQ` `…/nodes/importer-sdk.ts:20-42`) that Core wires as a straight
   `success → ready` chain of `builtin.policy.action` nodes
   (`…/service/recordings/proposal-candidates.ts:107, 134-141`). A model that
   wants a branch, a switch, a loop, a for-each, a merge, a parallel or a
   recovery node has **no field to put it in**, although every one of those node
   types exists in Core. This is the single largest gap: the artifact is a list,
   and authoring needs a graph.

2. **No `failed`-port authoring.** The action node has `success`, `failed` and
   `records` ports (`…/nodes/policy/action.ts:18-22`); the recording wires only
   `success`. Retries, fallbacks and "if this fails, try that instead" are
   therefore inexpressible even though `builtin.policy.recovery` accepts
   `retry` / `fallback-action` / `abort` with `maxAttempts`
   (`…/nodes/policy/recovery.ts:19-27`).

3. **Expected state is one URL path, on one verb.** `click-landing.ts:56-68` is
   the whole of it. There is no way for a step to claim "the row count is 57",
   "the banner is gone", "this field now holds X", "we are on a page that shows
   the confirmation" — although `web.dom.assert` already supports
   `exists | absent | text | url | visible | enabled`
   (`domain/src/runtime/expectation/conditions.ts:60-67`) and the evaluator
   already dispatches arbitrary condition lists with `mode: all|any`
   (evaluate.ts:109-124). The plumbing for defensive state nodes is built; the
   authoring surface for them is a single hard-coded URL claim.

4. **The recorded state is captured and thrown away.** A full merged snapshot and
   a projected state are stored per step
   (`recorded-event-intake.ts:191-194`, `recording-evidence.ts:121-140`) and
   linked from the node (`…/service/recordings/proposal-candidates.ts:146-153`),
   but nothing at run time compares against it
   (`…/executor/transition-comparison.ts:149-150` uses the live ref only). To
   "run defensively against recorded state nodes", the recorded `stateRef` has to
   become an input to the comparison — today it is metadata.

5. **No preconditions, only post-conditions.** A step says nothing about what
   must be true *before* it runs. The only pre-step readiness a recording can
   produce is the mutation-derived `wait_for_selector`
   (`late-target-wait.ts:59-99`), which is restricted to a light-DOM click in the
   top frame of the same document (90-98) and is inferred, never authored.

6. **No intent, no alternatives, no tolerance.** A candidate carries `label` from
   a fixed table (`domain/src/web-panel-host.ts:103-114`), `confidence` as a
   constant `0.9` (web-panel-host.ts:203), and nothing else. There is no place to
   say "this step means 'apply the filter'", "if the cookie banner is there,
   dismiss it first", "any of these three controls will do", or "a different
   landing path is acceptable".

7. **Positional context is captured, carried and unused.** `listPosition`,
   `tablePosition`, `landmark`, `heading` and the form fields all cross the wire
   and sit on the node, and nothing scores or gates them
   (`output-nodes/targets/targets.ts:224-230`). A model that wants to say "the
   second result", "the row whose Status column reads Overdue" has the data
   already present in the artifact and no consumer for it. Only
   `context.record` is acted on (`identity/veto.ts:229`).

8. **The equivalence anchor is single-valued and exact.** `context.record` gates
   on one `keyAttribute`/`key` pair or, failing that, bounded record text
   (`content/identity/record.ts:132, 153`; `targets.ts:352-361`). There is no way
   to express "the record whose key comes from the run's input", which is what a
   parameterised Flow would need.

9. **`sequence` is not a stable step identity.** The content script restarts it in
   every document (`navigation-recorder.ts:38-43`), so steps are named by
   `web.<sequence>.<timestamp>` (`gateway-mapping.ts:82`). A model editing an
   existing Flow has no durable per-step id to address, beyond the node ids Core
   mints at approval (`proposal-candidates.ts:101-104`).

10. **The mapper sees at most 32 following entries** (`…/nodes/importer-sdk.ts:93-94`)
    and each candidate is produced from one observation. Anything a model wants to
    infer across a whole recording — a repeated sub-sequence that should become a
    loop, a pair of steps that should become a branch — has no call in which it
    could see both.

---

## Commands run and observed results

- `git log --oneline --all | head -40` → confirmed `5f1d109 Record and replay the
  exact target and the state each step produced` (t063) and its merge `40d5473`.
- `git show --stat 5f1d109` → 27 files, 714 insertions; the t063 surfaces are
  `navigation-recorder.ts`, `recorded-event.ts`, `resolve-target.ts`,
  `dom-events.ts`, `element-finder.ts`, `identity/candidates.ts`,
  `identity/context.ts`, `selector/shadow/*`, `shadow-root-events.ts`,
  `shared/protocol.ts`, `domain/src/actions/types.ts`,
  `domain/src/output-nodes/targets/targets.ts`,
  `domain/src/recording/proposals/late-target-wait.ts`.
- File reads only thereafter (`cat -n`, `sed -n`, `grep -n`) in
  `F:\!FluxIQWebExtension` and, for the Core contracts that bound the answers,
  `F:\!FluxIQ`.

**No tests were run** and nothing was built. Running the domain suite writes
`domain/.test-build/`, which is outside the paths this brief owns and could
collide with a concurrent worker, so I read the tests instead:
`domain/src/runtime/expectation/tests/click-landing.test.ts:47-60` pins the URL
claim shape and the event-id rule, and
`domain/src/output-nodes/targets/tests/targets.test.ts:16-58` pins the identity
signals a target carries.

## Not verified

- **Live behaviour.** Nothing here was observed in a browser. The replay ordering
  in §5 is read off `resolve-target.ts` and its callees, not measured.
- **Core at run time.** `F:\!FluxIQ` was read for the mapper-candidate contract,
  the proposal→flow projection, the control-flow node ids and the transition
  comparison. I did not trace Core's full executor, so "routes it as any failed
  attempt" (§3) is read from `transition-comparison.ts:124-137` and the node port
  definitions, not from an end-to-end run.
- **The extraction and upload branches** of `recordedOutputParameters`
  (`payloads.ts:91-92, 112-141`) were read but not enumerated field by field;
  §1c's worked example is a click.
- **Whether any consumer outside the executor reads the node's `stateLink`** — I
  grepped Core for `stateSnapshotId`/`stateRef` and found only recordings,
  storage, API contracts and fingerprint metadata. A UI-only consumer would not
  change the conclusion, but I did not read the panel.

## Open questions or contradictions found

1. **`identity/context.ts:91` calls `shadowHostChain(element)` for every described
   element**, including the up-to-2,000 elements of a snapshot, and that function
   calls `selectorFor` per host (`host-chain.ts:28`). The file's own header says
   "no rule here may walk the whole document" (context.ts:9-11). Not a
   correctness problem, but it is the one context rule with no explicit bound.
2. **`coordinates` is a resolution strategy with no producer.** `veto.ts:296-300`
   states plainly that `coordinates` is a declared parameter of no web action.
   It is still tried second, ahead of `visual-target` and the fingerprint
   (resolve-target.ts:361-367). Dead precedence, harmless today, but it means the
   documented strategy order is not the order that actually runs.
3. **`expectedState` survives into the node, but nothing invalidates it when the
   step is repaired.** A repair rewrites the target
   (`output-nodes/targets/targets.ts:132-144`); the recorded URL claim is left
   untouched. If a repair moves a click to a control that lands somewhere else,
   the step now fails on a claim the repair should arguably have revised.
4. **Two sources of truth for "did the step work".** `expectedConfirmation` (the
   input echo, `web-panel-host.ts:203`) and `expectedState` (the URL claim) are
   both attached to a recorded click and are checked by different mechanisms.
   Nothing reconciles them, and the extraction candidate and the late-target wait
   each had to opt *out* of the confirmation to avoid failing every replay
   (`web-panel-host.ts:172-177`, `late-target-wait.ts:17-19`) — which suggests the
   confirmation is a default that does not generalise.
