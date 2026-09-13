# i-recording-capability-gaps — P4, P5, P6 and P7 (read-only design)

Read-only. Written against this repository at `eb8bf99` (working tree as `git status
--short` showed it at the start) and Core at `240c73e`. Paths are relative to
`F:\!FluxIQWebExtension` unless they start with `F:\!FluxIQ`. Nothing was built,
tested or run through the Lab; every row below rests on code reading plus the
single-observation bench evidence in `reports/i-bench-triage.md`.

**Cited files with uncommitted changes:**
- `docs/working/mvp-week1-web-automation-reliability-plan.md` (M);
- `briefs/finish-week1.md` (M);
- `reports/i-bench-triage.md` (untracked);
- `packages/test-runner/src/flow-lane/run-flow-lane.ts` (M), owned by
  `f-runner-secret-input`;
- `packages/test-runner/src/flow-lane/declared-secrets.ts` (M).

Every other cited file, in both repositories, was clean. Other workers are editing
`content/dom-events.ts`, `background/connection/runtime-status.ts`,
`pointer-click-filter.ts`, `run-scenario.ts`, `scenarios.ts` and two scenario
manifests in parallel. Line numbers in those files may already have moved.

## Outcome

**Done.** All four defects have a root cause, a design split by file, a blast
radius, the proof each needs, and a Week 1 verdict.

| Id | What is missing, in plain words | Needs | Week 1? |
| --- | --- | --- | --- |
| P5 | A file chosen in a file input is replayed as typing its placeholder path | Domain, extension (one confirmation), test-runner (supplies the file) | **Yes.** W17 is in criterion 1 |
| P4 | Switching to and closing a tab are never recorded, so the Flow's next click runs in whatever tab is in front | Extension recorder and tab verb, domain mapping, a small wire field | **Yes.** W15 is in criterion 1 |
| P6 | A child frame is addressed by an id Chrome renumbers on every page load | Domain (one parameter), extension runtime (find the frame by its path) | **Stretch.** Not in criterion 1, but small, no Core, and W28 is in the smoke corpus |
| P7 | A recorded "dismiss the banner" click cannot be skipped when the banner is absent | Core (a new node outcome and mapper field), domain heuristic, extension recorder signal | **No.** It is Week 2, on the same Core executor seam as `failureRoute` |

**Recommended order: P5, then P4, then P6; P7 goes to Week 2.** The file overlaps
below force part of this order.

## Shared files, which decide the dispatch shape

| File | P4 | P5 | P6 | In flight elsewhere |
| --- | --- | --- | --- | --- |
| `domain/src/io/input-model.ts` | yes | yes | | |
| `domain/src/output-nodes/payloads.ts` | yes | yes | yes | |
| `domain/src/actions/types.ts`, `actions/schemas.ts` | yes | | yes | |
| `domain/src/client/gateway-action-parameters.ts` | yes | | yes | |
| `domain/src/web-panel-host.ts` (labels) | yes | yes | | |
| `apps/extension/src/background/connection/runtime-status.ts` | yes | yes | | `f-recorder-key-order-and-check-confirmation` (P2) |
| `packages/test-runner/src/flow-lane/run-flow-lane.ts` | | yes | | `f-runner-secret-input` |

A dispatch that respects these overlaps:
1. **One domain worker, serial:** P5, then P4, then P6, across the domain files.
2. **Extension tab worker, in parallel with step 1:** P4's recorder, verb and
   automation-tab changes. The brief must fix the wire field names first (see
   P4, "Names to fix in the brief").
3. **Extension frame worker, in parallel:** P6's runtime files.
4. **After P2's worker lands:** one worker for the two `runtime-status.ts`
   confirmations, P4 and P5 together.
5. **After `f-runner-secret-input` lands:** the test-runner's upload input (P5).
6. **Lab:** W15, W17 and W28, plus the rest-of-corpus rows that must not change.

The wire changes in P4 and P6 are substantial under AGENTS.md "Documentation
Maintenance". Recording and action contracts change, so the architecture pages
must be updated in the same work.

---

## P5 — a file input's change is mapped to typing (W17)

### Root cause

1. **The recorder records a file choice as a generic change.**
   - `shouldRecordChangeEvent` includes `type === "file"`
     (`apps/extension/src/content/element-traits.ts:94-100`).
   - The `change` listener emits `dom.change`, with `inputValue` from
     `readElementValue` (`content/dom-events.ts:93-106`).
   - That reader returns the input's `value`, Chrome's `C:\fakepath\<name>`
     (`content/describe-element.ts:153-157`). So the recording carries the file's
     name, never its content.
2. **The domain maps every change that is not a select or a checkbox to text
   entry** (`domain/src/io/input-model.ts:122-130`). The node becomes `web.dom.type`,
   whose `text` is the recorded value (`output-nodes/payloads.ts:47,89-95`).
   - A cancelled choice, `inputValue === ""`, becomes `web.dom.clear` (`:130`).
3. **The type verb refuses correctly.** `holdsText` is false, so the verb reports a
   failed validation (`content/actions/type.ts:51-57`), and Core reports
   `output_not_observed`.
4. **Nothing can build an upload from a recording today.**
   - `web.dom.upload` is dispatch-only (`payloads.ts:62-65`).
   - It requires `upload.files[]` with inline base64 content
     (`actions/schemas.ts:323-327`; `actions/types.ts:178-181`;
     `client/gateway-action-parameters.ts:206-225`). A recording must never carry
     that content.
   - `hasExecutableParameters` would also refuse the node, because it accepts a
     required parameter only as a non-empty string or a `web.secret.` request
     (`input-model.ts:175-178`).

### Design, by file

The node asks for the file at run time, the same way a withheld password does
(`output-nodes/secret-binding.ts:13-32`). Core already resolves a `$state` binding to
any JSON value, nested records included
(`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\nodes\parameter-bindings.ts:54-61,88`).
An unanswered binding fails the node, naming its path
(`F:\!FluxIQ\...\runtime\executor\node-execution.ts:35-51`). **No Core change.**

**Domain**
- **`io/input-model.ts`:**
  - Add the action input `web.user.files_chosen`, "Files chosen", mapping to
    `web.dom.upload` (`:90-99`).
  - In `recordedActionInputId`, check for a file input before the select,
    checkable and text branches (`:122-130`). The test is `element.inputType ===
    "file"`. A file input must never reach `textEntered` or `fieldCleared`. When
    no upload node can be built, it stays evidence.
  - In `hasExecutableParameters` (`:175-187`), accept `upload` only when it is the
    upload request below.
- **New `output-nodes/upload-binding.ts`,** exported from `output-nodes/index.ts:**
  - The prefix `web.upload.` and `webAutomationUploadBinding(key)`, which returns
    `{ $state: { path } }` with no `fallback`.
  - `webAutomationUploadBindingPath(value)`.
  - The key comes from the identity rule `webAutomationSecretKeyForRecordedElement`
    already applies (`secret-binding.ts:112-130`). Extract it to a shared
    `recorded-element-key.ts` rather than copying it.
  - It gets its own namespace, not `web.secret.`, because the redaction
    attestation and the runner key on that prefix, and a file is not a declared
    secret.
- **`output-nodes/payloads.ts`:** `web.dom.upload` returns `compact({ selector,
  upload: webAutomationUploadBinding(key), ...target })`. It carries no file name,
  no count and no content.
- **`client/gateway-mapping.ts`:** its refusal for an unanswered request
  (`:40-44`) should name an unanswered `web.upload.` path too. Today it would
  arrive as `refused: ["upload"]`, reported as `INVALID_PARAMETER`
  (`gateway-action-parameters.ts:206-209`). This is minor; Core fails the node
  first.
- **`web-panel-host.ts`:** add the label `"web.dom.upload": "Upload files"` to
  `CANDIDATE_LABELS` (`:101-109`).

**Extension**
- **`background/connection/runtime-status.ts`:** add a confirmation in
  `runtimeConfirmationForActionResult` (`:93-107`). A succeeded `web.dom.upload`
  gives `{ kind: "dom.change", inputId: filesChosen }`, carrying no value.
  - Without it the node fails its 5 s wait (`domain/src/web-panel-host.ts:160`),
    exactly as P2 does for `web.dom.check`.
  - The replayed upload's own `change` is untrusted, so the recorder ignores it
    (`dom-events.ts:95`).
  - **Serial after P2's worker,** which owns this file.
- **Optional hardening, `content/describe-element.ts:156-157`:** stop reading a
  file input's `value`, so the local file name never leaves the page. The domain
  design above does not depend on that value.
- **No verb change.** `content/actions/upload.ts:15-31` already validates the file
  names the input ended up holding.

**Test-runner** (the supplier; serial after `f-runner-secret-input`)
- **New `flow-lane/declared-uploads.ts`,** mirroring `declared-secrets.ts`
  (uncommitted). It builds `web.upload.<key>` as `{ files: [{ name, mimeType,
  contentBase64 }] }`.
  - The source is each `upload` step in the workflow's script
    (`apps/scenario-lab/src/scenarios/file-transfer/manifest.ts:38`).
  - The content is the same deterministic file the recording lane uploads
    (`packages/test-runner/src/trusted-input/upload-file.ts:32`;
    `scenario-steps/step-runner.ts:96`).
  - The key must match the one the domain derives from the recorded element.
- **`flow-lane/run-flow-lane.ts`** (uncommitted): spread these into `inputs`
  beside `secretInputs` (`:120-134`).

### Blast radius on week1

- **W17 flow:** the Flow becomes upload then click.
  - It passes once the runner supplies the input.
  - Without the supply it still fails, but honestly. Core fails the upload node,
    naming `web.upload.<key>`, instead of typing a placeholder path.
- **W17 recording:** unchanged. The recording lane does not replay.
- **W16** (same fixture, download): no file input is used, so it is unchanged.
- **Every other row:** unchanged. `type="file"` occurs only at
  `file-transfer/page.ts:33` among the scenarios.
- **Not changed, noted:**
  - date, time, color and range inputs still map to text entry
    (`element-traits.ts:101-107` into `input-model.ts:130`);
  - no week1 row uses them.

### Proof

- **Domain unit, `io/tests/input-model.test.ts`:**
  - a file input's change maps to `files_chosen` / `web.dom.upload`;
  - with `inputValue: ""` it maps to neither `web.dom.clear` nor `web.dom.type`;
  - mutation: remove the file branch.
- **Domain unit, `output-nodes/tests/payloads.test.ts`:**
  - `upload` is the binding with no `fallback`;
  - no recorded name appears anywhere in the parameters;
  - mutation: add a fallback.
- **Domain unit,** a new `output-nodes/tests/upload-binding.test.ts`: the path
  prefix, and that a `web.secret.` binding is not read as an upload.
- **Extension unit, `background/connection/tests/runtime-status.test.ts`:** a
  succeeded upload confirms, a failed one does not, and the confirmation carries
  no value. Mutation.
- **Test-runner unit:** the input is built from the manifest's upload step; the
  key matches the domain's key for the recorded element; no content reaches a
  log or event.
- **Content harness:** the verb is already covered
  (`apps/extension/e2e/content/tests/upload-dialog.spec.ts:27,49,62`). One optional
  recorder row: a Playwright `setInputFiles` on the harness page records one
  `dom.change` whose element has `inputType: "file"`. It would pin the recorder
  side of the mapping.
- **Lab:** W17 on the Flow lane, 3 of 3.
  - Flow actions `web.dom.upload` succeeded, then `web.dom.click` succeeded, with
    no `web.dom.type`.
  - The final state holds, and the leak rows read 0.

---

## P4 — a recording cannot switch or close a tab (W15)

### Root cause

**Recording side**
1. **No listener for a tab closing.** The background registers `tabs.onActivated`,
   `tabs.onUpdated`, and top-frame `webNavigation.onCommitted` and
   `onHistoryStateUpdated` (`apps/extension/src/background/index.ts:48-68`). It has
   no `tabs.onRemoved` and no `tabs.onCreated`.
2. **An activation records nothing.** During a recording,
   `ActivePage.handleTabUpdate` attaches the newly active tab and sends a
   `client.state_update`, but records no event
   (`background/connection/active-page.ts:90-112`).
3. **The only `browser.tab` recorded event is the recording-start marker**
   (`background/connection/active-recording.ts:295-302`). That is W15's single
   `web.tab.state_changed`.
4. **The new tab's first load is dropped.**
   - A `link` commit counts as a page navigation
     (`background/connection/recorded-event-intake.ts:117-121`).
   - A page navigation survives only when a click in the same tab explains it
     (`navigation-recorder.ts:104-107`, keyed by tab id). The click was in the list
     tab.
5. **The domain maps `browser.tab` to a state event only.**
   - It becomes `web.tab.state_changed` (`domain/src/io/input-model.ts:44`).
   - `recordedActionInputId` returns nothing for it (`:108-134`).
   - No action input maps to `web.browser.tab` (`:90-99`).
   - The payload builder calls tab operations dispatch-only (`payloads.ts:62-65`).

**Replay side**
6. **A DOM node carries no tab.** Only the frame is added (`payloads.ts:28-31`). A
   DOM action with no named tab runs in the tab Chrome reports as active
   (`apps/extension/src/runtime/action-runner.ts:109-111`), which the channel
   re-reads before every action (`background/connection/server-command-channel.ts:166-176`).
7. **The confirm click ran in the wrong tab.** The replayed first click follows a
   `target="_blank"` link (`apps/scenario-lab/src/scenarios/multi-tab/list-page.ts:37`).
   The confirm click then resolved on a page with no control of its family
   (`content/action-runtime/resolve-target.ts:518-520`). Which tab that was is
   inferred, as `i-bench-triage` says.

**The existing verb has three gaps for this use**
8. **A switch matches a URL substring** (`runtime/browser-tab.ts:81-89`).
   `/scenarios/multi-tab/` is a substring of the details URL, so a switch back to
   the list could select the details tab.
9. **A close forgets the automation tab but points it nowhere**
   (`browser-tab.ts:168-169`; `runtime/automation-tab.ts:42-44`). The next action
   then falls to whichever tab Chrome activates. The runner's own side-panel
   control page is a real tab too (`packages/test-runner/src/run-scenario.ts:514`).
10. **A switch does not wait for a tab that is still opening**
    (`browser-tab.ts:131-146`). The runner's `switchTo` does (`scenario-steps/scenario-tabs.ts:22-38`).
11. **No runtime confirmation for `web.browser.tab`** (`runtime-status.ts:93-107`), so a
    mapped tab node would fail its 5 s wait (`web-panel-host.ts:160`), as P2 does.

### Design, by file

A tab change is recorded as an action and replayed with the existing verb, once
the verb addresses tabs exactly. Tabs are named by URL path, never by tab id,
because ids do not survive to a replay.

**Names to fix in the brief, so parallel workers agree:**
- the recorded payload field `tab: { operation: "switch" | "close"; urlPath?: string }`;
- the inputs `web.user.tab_switched` and `web.user.tab_closed`;
- the switch request field `urlPath`, an exact pathname match.

**Extension**
- **`background/index.ts`:** add a `chrome.tabs.onRemoved` listener that calls
  `manager.handleTabRemoved(tabId)`.
- **`background/connection.ts`:** a facade method `handleTabRemoved`, beside
  `handleTabUpdated` (`:309-311`).
- **New `background/connection/tab-recorder.ts`.** It has one responsibility:
  deciding which tab changes are recorded actions.
  - **A switch** is recorded when a supported tab becomes active and differs from
    the last supported active tab, while recording. Unsupported pages give no
    switch (`unsupportedPageForUrl`, `browser-state.ts:39-45`), which excludes the
    runner's control page.
  - **A new tab activates before its URL commits,** so a switch whose URL is
    empty or `about:blank` waits for that tab's first committed URL, with a
    bound.
  - **A close** is recorded when a tab the recording attached is removed.
  - **The path** is the URL's pathname only: origins differ run to run, and a
    query may carry tokens. Reuse the normaliser the landing claim uses
    (`landingLocation`, called at `recorded-event-intake.ts:138`) if it already
    drops the origin and query; otherwise add one here.
  - **The recording-start marker stays non-executable.**
  - **Each recorded tab action is counted exactly as a DOM action is.**
    `recording.noteEvent()` and a `client.recording_event` with an input id
    (`recorded-event-intake.ts:171-183`) are required. Otherwise the extension's
    and Core's recorded-action counts diverge, which the recording-completeness
    check compares.
- **`background/connection/active-page.ts`:** call the tab recorder on activation,
  at `:99-102`.
- **`shared/protocol.ts`** (`RecordingEventPayload`) and
  **`background/connection/gateway-payloads.ts`** (`:58-77`): carry `tab`.
- **`runtime/browser-tab.ts`:**
  - **Switch:**
    - with `urlPath`, match a tab whose URL pathname equals it;
    - when several match, take the most recently opened, which is what the
      runner does (`scenario-tabs.ts:25`);
    - wait up to the action's timeout for a tab still opening, then run
      `waitForTabReady`;
    - a tab already in front succeeds unchanged.
  - **Close:** re-point the automation tab to the tab that was driven before the
    closed one, and activate it.
- **`runtime/automation-tab.ts`:** keep that prior tab: a two-entry history, or a
  stack like `ScenarioTabs` (`scenario-tabs.ts:11-48`).
- **`background/connection/runtime-status.ts`:** a succeeded `web.browser.tab`
  gives `{ kind: "browser.tab", inputId }`. The input id depends on the operation,
  which the result does not carry, so `sendRuntimeConfirmation`
  (`server-command-channel.ts:184-195`) must hand the tracker the command's `tab`
  request. **Serial after P2's worker.**

**Domain**
- **`io/input-model.ts`:**
  - Add the two action inputs, both mapping to `web.browser.tab` (`:90-103`).
  - Add a `tabStateChanged` case to `recordedActionInputId` (`:108-134`): it reads
    `payload.tab.operation`, and returns nothing when `tab` is absent. That is
    what keeps the start marker, which has none, from becoming an action.
  - `hasExecutableParameters` (`:175-187`) needs a tab branch, because its
    required-string check rejects the `tab` object (`:177-178`): a close is
    executable, and a switch is executable only with a non-empty `urlPath`.
- **`client/gateway-mapping.ts`:** add `tab` to the recorded payload (`:73-95`) and
  to `WebAutomationRecordedPayload`.
- **`output-nodes/payloads.ts`** (`:39-66`):
  - a switch builds `{ tab: { operation: "switch", urlPath } }`;
  - a close builds `{ tab: { operation: "close" } }`;
  - no tab id is written;
  - update the dispatch-only comment (`:62-64`).
- **`actions/types.ts:189-193`, `actions/schemas.ts` (`tabSchema`),
  `client/gateway-action-parameters.ts:243-259`:** add `urlPath` to the switch
  request.
- **`web-panel-host.ts:101-109`:** add the label `"web.browser.tab": "Browser tab"`.

**Core:** no change expected.
- The mapper declares every action type as an output (`web-panel-host.ts:81-86`),
  including `web.browser.tab` (`actions/types.ts:402`).
- Core's element-target gate runs only for outputs whose schema requires
  `selector` (`io/manifest-definitions.ts:45-47`). The tab schema does not
  (`schemas.ts:335-339`).

**Alternative considered: give every node a logical tab key.** Actions would say
"run in the recording's second tab", so no switch nodes would be needed. It is
rejected for Week 1:
- the runtime would have to track tab creation and opener during replay;
- the dispatch contract of every DOM node would change;
- a close would still need recording.

### Blast radius on week1

- **W15 unarmed:**
  - The recording gains a switch to the details path, a close, and a switch back
    to the list path. The Flow becomes click, tab, tab, tab, click.
  - The recording contract pins only `web.element.clicked` with no count
    (`multi-tab/manifest.ts:40`), so the new entries do not break it.
  - The row still needs H6 (`g-manifest-extract-entries`) and the Flow-lane
    extraction-expectation decision, because `manifest.ts:41,47` pin an extract.
- **W15 `popup-blocked`:**
  - It records unarmed, so its Flow has the tab nodes too.
  - The first click fails `output_not_observed` before any tab node runs, as the
    bench observed, so the expected category is unchanged.
  - If that click ever succeeded, the switch would fail `target_not_found`, "no
    open tab matched".
- **Every other row:** no fixture opens a tab. `_blank` and `window.open` occur only
  in `multi-tab/list-page.ts:37,63`. Two risks must be ruled out in the Lab:
  - a spurious switch from the runner bringing a page to the front;
  - a recorded close from the runner closing its control page.
- **The recording-start marker exists on every row** and must stay
  non-executable.

### Proof

- **Domain unit, `io/tests/input-model.test.ts`:**
  - a recorded switch with a path and a recorded close each map to
    `web.browser.tab`;
  - the start marker (`recordingState: "started"`, no `tab`) maps to nothing;
  - a switch without a path stays evidence;
  - mutation: drop the `tab` presence check.
- **Domain unit, `output-nodes/tests/payloads.test.ts`:** parameters carry the
  pathname only, never an origin, query or tab id. Mutation.
- **Domain unit, `client/tests/gateway-command-parameters.test.ts`:** `urlPath` is
  lifted and a malformed one refused. Also update `client/tests/gateway-mapping.test.ts`.
- **Extension unit, a new `background/connection/tests/tab-recorder.test.ts`:**
  - a second supported tab activating records a switch;
  - an unsupported tab records nothing;
  - an activation before the URL commits records the committed path;
  - removing an attached tab records a close;
  - the marker is unchanged;
  - each recorded action is counted once.
  - Mutation on the unsupported-page guard.
- **Extension unit, `runtime/tests/browser-tab.test.ts`:**
  - an exact path selects the list tab over the details tab (mutation: substring
    match);
  - a switch waits for an opening tab;
  - a close re-points to the prior tab.
- **Extension unit, `runtime-status.test.ts`:** a succeeded switch or close confirms
  with its input id; a failed one does not.
- **Content harness:** not applicable. Tabs live only in the service worker, and
  the harness drives content scripts (`openHarness` in
  `apps/extension/e2e/content/tests/*.spec.ts`). The full-extension e2e
  (`apps/extension/e2e/action.spec.ts`) has no tab or frame rows. Whether it can
  host one was not checked.
- **Lab:**
  - **W15 unarmed, both lanes:** the recording has two `web.tab.state_changed`
    entries with switch input ids and one with the close input id. The Flow runs
    click, tab ×3, click, all succeeded, and the confirm click runs on the order
    list. The final state holds.
  - **`popup-blocked`:** still `output_not_observed`.
  - **Every other week1 row:** `flow-lane.json` lists no `web.browser.tab` action.

---

## P6 — a recorded child-frame id is replayed after a reload (W28)

### Root cause

1. **The frame is recorded only as a number.** The recorded event carries the
   numeric frame id (`domain/src/client/gateway-mapping.ts:71,85`).
   `withRecordedFrame` copies it onto every DOM node (`output-nodes/payloads.ts:28-31`),
   and the lift sends it as `frameId` (`client/gateway-action-parameters.ts:73`).
2. **Chrome renumbers a frame when it navigates** (`apps/extension/src/runtime/action-runner.ts:260-262`).
   The Flow lane loads the start page before every Flow
   (`packages/test-runner/src/run-scenario.ts:344`, `openScenarioStart` `:644-646`).
   So both iframes get new ids: recorded frame 4, while the tab had 0, 6 and 7.
3. **The runtime refuses an id the tab no longer has** (`action-runner.ts:205-210,271-296`).
   That refusal is correct, but nothing lets the runtime find the same frame again.
4. **The means to find it already exist, unused.**
   - A child frame's content script sends `url: location.href` on every recorded
     event (`content/recorder.ts:131-137`), so the recording already knows the
     frame's document.
   - Chrome lists each frame's URL (`background/tabs.ts:18-26`).
5. **Other places carry the same stale id:**
   - expectation conditions (`domain/src/runtime/expectation/conditions.ts:79-86,95-99`);
   - LLM element evidence (`runtime/llm-evidence/elements.ts:28`);
   - the late-target wait, which already refuses to propose a wait inside a child
     frame (`recording/proposals/late-target-wait.ts:87-88`).

### Design, by file

A child frame is addressed by its document's path, and the id is only a
tie-break.

**Domain**
- **`output-nodes/payloads.ts`** (`withRecordedFrame`, `:28-37`): when
  `browserFrameId > 0` and `payload.url` parses to an http(s) URL, also carry
  `browserFrameUrlPath`, the pathname only.
  - Origins differ per run: the cross-origin frame is served from the second
    loopback port (`apps/scenario-lab/src/scenarios/iframe-checkout/scenario.ts:35-36`).
  - A query may carry tokens.
  - Frame 0 and `about:` or `srcdoc` frames get no path, so every top-frame node
    stays byte-identical.
- **`actions/types.ts:201-205`:** add `frameUrlPath?: string` to
  `WebAutomationActionCommand`.
- **`client/gateway-action-parameters.ts`** (`:45-48,68-101`): lift `frameUrlPath` from
  `browserFrameUrlPath`, and refuse a non-string or empty one.
- **Deferred:** the same locator on `runtime/expectation/conditions.ts:79-99`. No
  week1 claim or expectation targets a child frame.

**Extension**
- **`runtime/command-options.ts`** (`:43`): add `frameUrlPathForAction`.
- **New `runtime/frame-address.ts`,** one responsibility: choosing the frame an
  action goes to. Its inputs are the tab id, the recorded id and the path.
  - **No path:** today's behaviour, unchanged.
  - **A path:** list the frames (`allTabFrames`) and keep those whose URL pathname
    equals the path.
    - **One match:** use that frame's id.
    - **Several:** use the recorded id if it is among them, else
      `TARGET_AMBIGUOUS`, naming the count.
    - **None:** `TARGET_NOT_FOUND`, naming the path and the frames' paths, never
      full URLs.
  - **An empty frame list means "unknown":** fall back to the id, by the rule
    `absentFrameReason` already follows (`action-runner.ts:266-275`).
- **`runtime/action-runner.ts`** (`runActionInFrame`, `:199-219`): resolve through
  `frame-address.ts` before the absent and unreachable checks, and report the
  resolved id on the result (`withTarget`).

**Core:** none. Core never reads the frame id. Its element-target gate scores
candidates only (`F:\!FluxIQ\...\runtime\io-policy.ts:228-247`), and the refusal W28
hit came from the extension, from the message at `action-runner.ts:289-294`.

### Blast radius on week1

- **W28 flow:** both clicks find their frames by path after the start-page load,
  so the row should pass.
- **W28 recording:** unchanged.
- **The smoke corpus:** W28 is one of its two rows (`bench/corpus/smoke.ts:12,22-24`),
  so the smoke bench's Flow-lane row changes too.
- **Every other week1 row:** `<iframe` occurs only in `iframe-checkout/scenario.ts:36`
  among week1 fixture scenarios. `storefront-checkout/checkout-steps.ts:159` is not
  in the corpus. All other nodes are top-frame, so their parameters are unchanged.
  A test must pin that.

### Proof

- **Domain unit, `output-nodes/tests/payloads.test.ts`** (frame rows at `:54-86`):
  - a child-frame click carries its id and path;
  - an origin or query never appears;
  - frame 0 gains no path;
  - mutation: write the full URL.
- **Domain unit, `client/tests/gateway-command-parameters.test.ts`:** the lift, the
  refusal, and `LIFTED_PARAMETER_NAMES` (`:187`) grows by one.
- **Extension unit, `runtime/tests/action-runner.test.ts`** (frame rows exist, e.g.
  `:249`):
  - a stale id with one frame at the path is sent to that frame;
  - two frames at the path, neither with the id, gives ambiguous;
  - no frame at the path gives not-found, naming paths;
  - no path gives today's refusal, unchanged;
  - mutation: skip the path lookup.
- **Content harness:** `frames.spec.ts:70-125` covers id addressing through the
  content scripts. The path lookup needs `chrome.webNavigation` in the worker,
  which the content harness does not drive (not verified), so the unit tests and
  the Lab carry this.
- **Lab:** W28 on the Flow lane, 3 of 3. Both clicks succeeded after the
  start-page load, and the result's frame ids differ from the recorded ones where
  the bundle publishes them.

---

## P7 — a recorded dismissal whose target is absent cannot be skipped (W13 `banner-absent`)

### Root cause

1. **Both clicks were recorded, and arming removes the banner.** The recording
   holds two executable clicks (`modal-flows/manifest.ts:41-45`). The variant sets
   `consent: "absent"` (`modal-flows/mutate.ts:25`), and the banner renders only
   while consent is pending (`markup.ts:86`).
2. **The resolver refuses, and it should.** On replay the extension finds no
   control of that family and returns `TARGET_NOT_FOUND`
   (`content/action-runtime/resolve-target.ts:493-506,518-520`). Clicking something
   else would break corroboration, and W29 depends on this refusal.
3. **A failed node ends the run.** The executor follows a failed attempt's
   `failed` edge only when one exists and the recovery ladder picks it
   (`F:\!FluxIQ\...\runtime\executor\graph-run.ts:125-149`;
   `executor\recovery-ladder.ts:31-39`).
   - An edge is chosen by route name alone (`executor\graph-navigation.ts:5-11`).
     No failure category can select a route, so a `failed` edge would skip the node
     on any failure: an ambiguous target, a covered one, an unreachable frame.
4. **Nothing can mark a node optional.**
   - The mapper candidate has no field for it (`nodes\importer-sdk.ts:19-31`).
   - `failureRoute` is declared on the policy action node but read nowhere at run
     time (`nodes\policy\action.ts:23,40`; `runtime\policy-model.ts:154`).
   - The brief already records: "Nothing in Core honours a node's `failureRoute`
     even for a failed dispatch; that is a Week 2 Core item"
     (`briefs/finish-week1.md:1216-1217`, uncommitted file).
5. **The recording cannot tell a dismissal from any other click.** The recorder's
   mutation summary counts removed nodes, not which ones (`content/recorder.ts:30,124`).
   The banner is removed by the page's own script
   (`modal-flows/client-script.ts:100-104`).

### Design, by file (for Week 2)

**Core**
- **`nodes/importer-sdk.ts:19-31`:** a candidate field, for example `skipWhen: {
  category: "target_not_found" }`, carried onto the proposal and the Flow node.
- **The proposal-to-Flow builder** writes it onto the node. It was not located; see
  Not verified.
- **`runtime/executor/node-execution.ts` and `graph-run.ts:125-150`:** a failed
  attempt skips only when its failure matches the node's `skipWhen` and the
  target had zero candidates.
  - The extension record is `web.target.not_found` with `candidateCount: 0`
    (`resolve-target.ts:500-505`). Core's own gate gives `element_target.no_match`
    (`io-policy.ts:241-247`).
  - Such an attempt becomes `status: "skipped"`, keeps its failure record, and
    follows the success edge.
  - Every other failure fails as today.
- **The trace and evidence schema gain `skipped`.** This is a public contract
  change, needing a `fluxiq` release and a migration note.
- **The natural home is the Week 2 `failureRoute` item,** on the same executor seam.

**Domain**
- **New `recording/proposals/optional-dismissal.ts`,** beside `late-target-wait.ts`,
  exported from `proposals/index.ts`, called from `mapWebRecordingObservation`
  (`web-panel-host.ts:130-136`). It marks a click `skipWhen` only when all of these
  hold:
  - its following entries show that its overlay container was removed;
  - the container was an overlay: `role=dialog` or `alertdialog`, `aria-modal`,
    or a fixed-position region;
  - the click claims no landing.

**Extension**
- **New `content/dismissal-signal.ts`,** used by `content/recorder.ts` on the
  mutation flush after a trusted click. It reports whether the clicked control's
  nearest overlay container was detached or hidden, as a descriptor only: role,
  accessible name, fixed or not.

**Test-runner**
- **`flow-lane/expectations.ts`:** a `skipped` node is neither `succeeded` nor
  `failed`. Decide how `expected.actions` judges it.

### Why not Week 1

1. **A new Core node outcome is needed.** That means a public trace change, a
   release, and a migration note, on the executor seam the brief deferred to
   Week 2.
2. **A cheaper route was checked and rejected.** A domain-generated `failed` edge
   would skip on any failure (`recovery-ladder.ts:31-39`), and a mapper candidate
   cannot write edges at all (`importer-sdk.ts:19-31`).
3. **The heuristic risks a false success in this corpus.** W12's `confirm-invite`
   click closes the invite dialog (`modal-flows/manifest.ts:25`). A loose rule
   would mark it skippable, and a Flow that silently skipped sending the invite
   would report success. It needs its own negative rows first.
4. **W13 is outside criterion 1's W01-W19 set,** per this brief. No Current State
   criterion names `banner-absent`.

### Blast radius, when built

- **W13 unarmed:** the dismissal still clicks when the banner is present, so it is
  unchanged.
- **W13 `banner-absent`:** passes, with the dismissal `skipped`.
- **W12:** must stay unmarked; a pinned row.
- **W14 `armed`:** the offer was never recorded, so it is not a recorded
  dismissal. It must stay `user_intervention_required`.
- **W20-W23, W26 and W29:** not overlays; unchanged. W29 must still fail
  `target_not_found`, and W26 must still report `target_ambiguous`.
- **Outside week1:** `storefront-checkout`'s consent dialog has the same shape.

### Proof, when built

- **Core unit:**
  - a qualifying zero-candidate `target_not_found` gives `skipped`, and the next
    node runs;
  - ambiguous, below-confidence and non-zero-candidate failures still fail;
  - mutation: drop the `candidateCount` check.
- **Domain unit:** marked only for an overlay removed by its own click; W12's
  confirm shape is unmarked. Mutation.
- **Extension unit and content harness:**
  - clicking a banner button that removes its banner records the container;
  - clicking a dialog's confirm that only hides content records per the agreed
    rule;
  - `modal-intervention.spec.ts` is the nearest existing spec.
- **Lab:**
  - W13 `banner-absent` publishes, with the dismissal `skipped`;
  - W13 unarmed clicks it;
  - W14 `armed`, W26 `no-context` and W29 keep their expected categories.

---

## What changed and why

- **Written:** this report only.
- **Scratch file:** `ircg-secret-scan.mjs` in the session scratchpad, outside
  every tree. It is the declared-value scan below.
- **Not touched:** no other repository file, no build, no test and no Lab command.

## Commands run and observed results

- **`git status --short` and `git log --oneline -3`** in both repositories, to
  mark uncommitted citations.
  - This repository: 14 modified files and 6 untracked reports, HEAD `eb8bf99`.
  - Core: 4 modified files (`runtime/service.ts`, `storage/project/runtime-stream-store.ts`
    and their tests), HEAD `240c73e`. None of those four is cited here.
- **Everything else was read-only:** file reads and ripgrep searches. The results
  are cited inline.
- **`node ircg-secret-scan.mjs`,** a declared-value scan of this report that prints
  lengths and counts only. It printed:
  - `auth-gate/constants.ts literals checked=9 hits=0`;
  - `upload name hits=0` and `invite email hits=0`;
  - `file-transfer/manifest.ts literals checked=44 hits=116` and
    `modal-flows/manifest.ts literals checked=71 hits=125`. Those hits are
    ordinary ids and words this report cites, such as `click`, `upload` and
    `consent-then-click`, not values.

## Not verified

- **P4:**
  - **Where a background-originated recorded event enters the send path.** The
    start marker goes through `deps.recordEvent` (`active-recording.ts:295`) and so
    do navigations (`recorded-event-intake.ts:140,153`). Whether that reaches
    `processEvent`'s executable branch, which sends the input id and counts the
    action (`:163-183`), was not read, and neither was `isExecutableRecordedAction`.
  - **Core's live action-entry fallback** for a non-DOM input was not read: whether
    it builds parameters through the domain IO adapter
    (`domain/src/io/web-automation-io.ts`, `gateway-input-hub.ts`).
  - **Whether Chrome fires `tabs.onActivated`** for Playwright's `bringToFront` and
    for a `target="_blank"` page in this harness, and whether `tab.url` is empty at
    that moment.
  - **Which tab W15's confirm click ran in,** carried over from `i-bench-triage`.
  - **Whether `landingLocation` drops origin and query.**
- **P5:**
  - Whether `g-core-input-withholding` withholds every run input, or only declared
    secrets. Base64 file content in Core's persisted run inputs would be fixture
    data, not a leak, but it is bulk.
  - Whether Core bounds a run input's size.
- **P6:**
  - Whether `webNavigation.getAllFrames` lists frames in document order, which
    matters only for duplicate paths.
  - Whether the content harness can drive worker-side frame lookup.
  - Whether W28 passed before `f-flow-start-page`.
- **P7:** the Core module that turns recording proposals into Flow nodes and edges
  was not located. `flow-bootstrap/adaptation.ts:148` writes `sourcePortId` for
  adaptations, but that is not the proposal path.
- **Whether `apps/extension/e2e/action.spec.ts`** can host a tab or frame row.
- **Nothing here was built, unit-tested, harnessed or run in the Lab.** Every
  design is code reading on top of a single bench observation per row.
- **What a Lab run must show:**
  - **P5:** W17's Flow runs `web.dom.upload` then `web.dom.click`, both succeeded,
    with no `web.dom.type`, and its final state holds.
  - **P4:** W15's Flow runs click, three tab actions, click; the confirm click runs
    on the order list; `popup-blocked` stays `output_not_observed`; no other row
    proposes a tab action.
  - **P6:** W28's two frame clicks succeed after the start-page load.
  - **P7** (Week 2): W13 `banner-absent` publishes with a skipped dismissal, and
    W12, W14 `armed`, W26 and W29 are unchanged.

## Open questions or contradictions found

1. **Should P4's switch and P5's upload each get their own runtime confirmation,**
   or should Core stop requiring a confirmation for outputs the recorder cannot
   echo? P2, P4 and P5 are three instances of one gap: `runtime-status.ts:93-107`
   lists seven verbs, while `web-panel-host.ts:160` makes every mapped candidate
   wait. The `f-recorder-key-order-and-check-confirmation` brief's task 3 asks that
   worker to list the rest. Its answer should decide whether this is one table
   fix.
2. **Should the recorder stop sending a file input's value?** Today the local file
   name leaves the page (`describe-element.ts:156-157`). The P5 design does not need
   it.
3. **W17's `expected.actions` pins only `web.dom.click`** (`file-transfer/manifest.ts:48`).
   Once P5 lands, should it also pin `web.dom.upload`, so the bench shows the upload
   ran?
4. **W15's Flow row will still fail on its extract** until H6 and the Flow-lane
   extraction decision land (`multi-tab/manifest.ts:41,47`). P4 alone will not turn
   it green.
5. **P7 against the brief's Week 1 set.** W13 unarmed is inside W01-W19, but this
   brief places W13 outside criterion 1. That reading has been applied to the
   `banner-absent` variant only.
