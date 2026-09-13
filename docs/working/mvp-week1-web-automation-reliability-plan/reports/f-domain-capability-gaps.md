# f-domain-capability-gaps — upload, tab and frame mapping (domain)

**Task 1 compiled, 2026-09-13.** The wire names were in the domain before any
other task, and `pnpm --dir domain check` exited 0 at that point (both
`tsc -p tsconfig.json --noEmit` and `tsc -p tsconfig.test.json`).

## Outcome

Done. All five tasks are built in the domain and tested, each guard has a
mutation proof, and the supervisor's mid-task addition, exporting the pathname
rule, is done.

- The domain check passes.
- The domain suite fails only the expected W25 row in
  `tests/core-gateway-recording-order.test.ts`, which belongs to another worker
  and waits for a Core build.
- The structure audit's one violation was already there before this work (see
  Open questions).

## What changed and why

### 1. The wire names (task 1)

- **`client/gateway-mapping.ts`**
  - New exported type `WebAutomationRecordedTab = { operation: "switch" | "close"; urlPath?: string | undefined }`.
  - `tab?: WebAutomationRecordedTab | undefined` on `WebAutomationRecordedPayload`.
  - `createWebAutomationRecordingEvent` copies only `operation` and `urlPath`
    onto the stored payload. A tab id or full URL a caller adds never reaches
    the recording.
- **`io/input-model.ts`**
  - `WEB_AUTOMATION_INPUT_IDS.filesChosen` = `web.user.files_chosen`.
  - `WEB_AUTOMATION_INPUT_IDS.tabSwitched` = `web.user.tab_switched`.
  - `WEB_AUTOMATION_INPUT_IDS.tabClosed` = `web.user.tab_closed`.
  - An action input definition for each: "Files chosen" maps to
    `web.dom.upload`; "Tab switched" and "Tab closed" both map to
    `web.browser.tab`.
  - `tab?: JsonObject` on `WebAutomationRecordedInputPayload`.
- **`actions/types.ts`**
  - `urlPath?: string | undefined` on the `switch` member of
    `WebAutomationTabRequest`.
  - `frameUrlPath?: string | undefined` on `WebAutomationActionCommand`.
- **`actions/schemas.ts`**: `urlPath` in `tabSchema`.
- **`client/gateway-action-parameters.ts`**
  - `frameUrlPath` is lifted from the node parameter `browserFrameUrlPath`, and
    from no other name.
  - `urlPath` is lifted by `tabRequestValue`.
  - Both accept only an exact pathname. A malformed `browserFrameUrlPath` is
    refused as an optional field: absent on the command, and named in `refused`.
  - A malformed `tab.urlPath` refuses the whole tab request, so a
    `web.browser.tab` command is rejected with `INVALID_PARAMETER`. Dropping just
    the path would send the switch to whichever tab the other fields name.

### 2. A file choice becomes an upload (P5)

- **New `output-nodes/upload-binding.ts`**
  - Exports `WEB_AUTOMATION_UPLOAD_STATE_PREFIX` (`web.upload.`),
    `webAutomationUploadStatePath(key)`, `webAutomationUploadBinding(key)` and
    `webAutomationUploadBindingPath(value)`.
  - The binding is Core's `{ $state: { path } }` with no `fallback`.
  - It has its own namespace, so a `web.secret.` binding is never read as an
    upload, and an upload binding is never read as a secret.
- **New `output-nodes/recorded-element-key.ts`**
  - Exports `webAutomationRecordedElementKey(payload)`, the key rule moved out of
    `secret-binding.ts` unchanged.
  - The move carries a rename from `webAutomationSecretKeyForRecordedElement`,
    because uploads now use it too.
  - No consumer outside `domain/src` imported the old name (searched `apps`,
    `packages` and `domain/src`).
  - `secret-binding.ts` keeps a one-line pointer to it.
  - The brief named this destination, so it is the supervisor's placement
    decision, not an "extract-and-drop".
- **`io/input-model.ts`**
  - `recordedActionInputId` checks `element.inputType === "file"` before the
    select, checkbox and text branches, so a file input never reaches
    `textEntered` or `fieldCleared`.
  - A file input maps to `filesChosen`, **except** when `inputValue === ""`,
    which stays evidence (see Open questions).
  - `hasExecutableParameters` now goes through `isExecutableRequiredParameter`.
    `upload` counts only as a `web.upload.` binding; every other required
    parameter keeps the old rule (a non-empty string or a secret request).
- **`output-nodes/payloads.ts`**
  - `web.dom.upload` builds `compact({ selector, upload: binding, ...target })`.
  - The fingerprint's `value` is dropped, because on a file input it is Chrome's
    `C:\fakepath\<name>`.
  - No file name, count or content is written.
  - With no key there is nothing to ask for, so it builds `{}`.
- **`client/gateway-mapping.ts`**: an unanswered `web.upload.` request is refused
  the way an unanswered secret is. Message: `Not dispatched: these parameters need
  values supplied at run time that this run did not supply: upload (web.upload.<key>)`,
  with the same failure code as the secret refusal. It is no longer an
  unreadable-parameter refusal.
- **`web-panel-host.ts`**: the label `"web.dom.upload": "Upload files"`.

### 3. A tab switch or close becomes a tab action (P4)

- **`io/input-model.ts`**
  - `recordedTabInputId` reads `payload.tab.operation`: `switch` maps to
    `tabSwitched`, `close` to `tabClosed`, and anything else, including no `tab`,
    maps to nothing.
  - `isExecutableRequiredParameter` accepts `tab` only as a close, or as a switch
    with a non-empty `urlPath`.
- **`output-nodes/payloads.ts`**
  - A close builds `{ tab: { operation: "close" } }`.
  - A switch builds `{ tab: { operation: "switch", urlPath } }`. A path that
    fails the exact-pathname rule is left off rather than trimmed, so that switch
    stays evidence.
  - No `tab` builds `{}`.
  - No tab id, origin or query is ever written.
  - The dispatch-only comment is updated.
- **`web-panel-host.ts`**: the label `"web.browser.tab": "Browser tab"`.
- **The recording-start marker stays non-executable** through two independent
  guards (proofs below).

### 4. A child frame is also named by its path (P6)

- **`output-nodes/payloads.ts`, `withRecordedFrame`**
  - When `browserFrameId > 0` and `payload.url` is an http(s) URL, the node also
    carries `browserFrameUrlPath`, the pathname only.
  - Frame 0, no frame, and `about:`, `srcdoc` or `blob:` documents gain nothing.
  - The top-frame outputs' code path is unchanged, and the new byte-identity row
    pins it.

### 5. No origin, query, tab id, file name or content in a node parameter

Covered by the leak rows below, for each of the three new parameter kinds.

### Supervisor addition: the pathname rule, exported

- **Export:** `webAutomationUrlPath(value: unknown): string | undefined`, in the
  new `domain/src/output-nodes/url-path.ts`.
- **Barrels:** exported from `output-nodes/index.ts`. `client/index.ts` already
  re-exports `../output-nodes`.
- **Import path for the extension:** `@fluxiq-web-extension/domain/client`, which
  maps to `./src/client/index.ts` in `domain/package.json`. For example,
  `import { webAutomationUrlPath } from "@fluxiq-web-extension/domain/client"`.
- **Domain callers:** both domain copies now call it, `payloads.ts` for the tab
  switch path and `gateway-action-parameters.ts` for both lifts.
- **A gap it closes:** its unit row found a real hole. `//example.test/list`
  starts with `/` and has no `?` or `#`, so the old rule accepted a
  protocol-relative URL, whose first segment is a host, as a path. The exported
  rule is `/^\/(?![/\\])[^?#]*$/u`, which refuses a leading `//` or `/\`.
- **Still exposed:** the extension's copy at
  `apps/extension/src/runtime/command-options.ts:55`, in `frameUrlPathForAction`,
  still has that gap until the extension imports the domain rule.
- **Unit row:** `output-nodes/tests/url-path.test.ts`.

### Tests added or changed

- **`io/tests/input-model.test.ts`**
  - New rows: 2a (switch with path) and 2b (close), both mapping to
    `web.browser.tab`.
  - New evidence rows: 2c (switch without path), 2d (switch path given as a full
    URL), 2e (the marker).
  - File rows: 9c (file change) and 9d (file change with no recorded value) map
    to `web.dom.upload`; 9f is the same for `dom.input`; 9e (emptied) is evidence.
  - The dispatch-only check now allows exactly one shared output,
    `web.browser.tab`.
  - Direct rows: the marker, a tab node's parameters, and an upload node holding
    no file name.
- **`output-nodes/tests/payloads.test.ts`**
  - Upload rows: the binding with no fallback; no file name, `fakepath`,
    `.pdf`, `files` or `contentBase64` anywhere; no key builds nothing.
  - Tab rows: switch and close parameters; no origin, query or tab id; a
    malformed path is left off rather than trimmed; the marker builds nothing.
  - Frame rows: the child-frame path with no origin, port, scheme, query or
    fragment; no path for a non-http document.
  - **The top-frame byte-identity row.** Literal JSON for click (frame 0 and no
    frame), type, clear, select, keypress, scroll and check.
- **New `output-nodes/tests/upload-binding.test.ts`**
  - The prefix and no fallback.
  - A secret binding is not an upload binding.
  - Core's `resolveAutomationNodeParameterValues` answers the binding with a
    nested file list.
  - With nothing supplied it reports `missingPaths: ["web.upload.attachment"]`.
- **New `output-nodes/tests/recorded-element-key.test.ts`**
  - The key-order test, moved from `secret-binding.test.ts`.
  - A row showing the secret and upload requests are keyed by the same rule.
- **`output-nodes/tests/secret-binding.test.ts`**: the moved test and its import
  removed; a `web.upload.` path added to the "only a secret request is one" row.
- **New `output-nodes/tests/url-path.test.ts`**: the rule's accepts, its refusals,
  and the barrel export.
- **`client/tests/gateway-command-parameters.test.ts`**
  - The `urlPath` lift, and a whole refusal for each malformed path.
  - A close carries no path.
  - The `frameUrlPath` lift, and its refusal keeps `frameId`.
  - `frameUrlPath` is read only from `browserFrameUrlPath`.
  - `LIFTED_PARAMETER_NAMES` gains `browserFrameUrlPath`. The refused-whole
    pairs are unchanged.
- **`client/tests/gateway-mapping.test.ts`**
  - The stored tab keeps only its two fields.
  - A close is stored; the marker has no `tab`.
  - A recorded switch reaches the command as its path alone.
  - A child frame's path, end to end, reaches `command.frameUrlPath`.
  - An unanswered upload is refused like an unanswered secret.

## Commands run and observed results

- **`pnpm --dir domain check`**
  - After task 1: exit 0.
  - After all tasks: exit 0.
  - After the refactor onto `webAutomationUrlPath`: exit 0, twice (once before
    and once after the `//` fix).
  - Final run: exit 0.
- **`DOMAIN_TEST_BUILD_LABEL=f-domain-capability-gaps pnpm --dir domain test`**
  - **First run:** exit 1. `# tests 396`, `# pass 395`, `# fail 1`.
  - **Final run:** exit 1. `# tests 399`, `# pass 398`, `# fail 1`.
  - **The one failure, both times:** `not ok ... W25: the live delayed-ui messages
    through Core's client gateway ... propose click, wait, click`, at
    `.test-build-scratch/f-domain-capability-gaps/tests/core-gateway-recording-order.test.mjs`.
    This is the other worker's row, expected to fail until a Core build.
  - **Plain-assert entries:** each printed its passed line ("Web automation input
    model tests passed.", "... gateway command parameter tests passed.", "...
    gateway mapping tests passed."). No entry failed to load.
- **Structure audit, twice.** Run as `node scripts/structure-audit.mjs` with a
  scratch `GIT_INDEX_FILE` that adds the six new files: exit 1, `1 violation(s)
  across 1 rule(s)`. The violation is `FAIL [working-docs] docs/working/README.md
  is out of date`.
  - The same run on the real index (no new files) gives the same single FAIL, so
    it is not from this work.
  - No new file appears in any warning. Warnings on files I changed:
    - `domain/src/actions/types.ts`: 444 lines, advisory. It was 432 at HEAD,
      already past 400.
    - `domain/src/client/gateway-mapping.ts`: 429 lines, advisory. It was 413.
    - `domain/src/client/tests/gateway-mapping.test.ts`: 583 lines, advisory.
  - None of the three is baselined, and all are under the 800-line limit.
- **Tracked build:** `git status --short domain/.test-build` printed nothing, so
  the tracked build was never regenerated.
- **Mutation-run helper.** Mutation runs used a scratch runner
  (`fdcg-run-entries.mjs` in my scratchpad).
  - It bundles only the named test entries, exactly as `test-domain.mjs` does,
    into `domain/.test-build-scratch/f-domain-capability-gaps-mutation`, which
    was deleted at the end.
  - Unmutated baseline: exit 0, the three plain-assert entries passed,
    `# tests 42`, `# pass 42`.
  - After the `//` fix: `# tests 45`, `# pass 45`.

### Mutation proofs

Each guard was broken, the observing test failed as quoted, and the guard was
restored. Byte identity was confirmed with `sha256sum -c` against hashes taken
before the mutations:

- baseline 1 for M1, M2, M6, M9 (first run) and M10;
- baseline 2 for the rest, taken after the refactor onto `webAutomationUrlPath`.

Every check printed `OK` for every mutated file. The one exception was
`output-nodes/index.ts` against baseline 1, which had gained the intended
`url-path` export in between; it is `OK` against baseline 2.

| # | Guard broken | Observed failure |
| --- | --- | --- |
| M1 | file branch removed (`input-model.ts`) | `row 9c dom.change, file input: live input` |
| M4 | `upload` branch of `isExecutableRequiredParameter` removed | `row 9c dom.change, file input: live input`, actual `undefined`, expected `'web.user.files_chosen'` |
| M5 | emptied file input no longer evidence | `row 9e dom.change, file input emptied: live input` |
| M2 | `fallback: { files: [] }` added to the upload binding | `not ok - the request is a path under its own namespace, with no fallback`; `not ok - with nothing supplied Core names the path, rather than uploading nothing`; `not ok - a file choice asks for its files through an upload request with no fallback` |
| M14 | upload binding path reads any `$state` path | `not ok - only a request on the upload namespace is an upload request, and a secret request is not one`: `{"$state":{"path":"web.secret.attachment"}}` |
| M3 | file input's `value` kept in the upload fingerprint | `not ok - no recorded file name, count or content appears anywhere in an upload's parameters`: `tax-return must not reach the node` |
| M10 | unanswered upload clause removed (`gateway-mapping.ts`) | actual `'Not dispatched: web.dom.upload requires upload, and what was sent could not be read.'` |
| M6 | recorded tab spread into the switch parameters | `not ok - tab parameters carry the pathname only, never an origin, a query or a tab id`: `127.0.0.1 must not reach the node` |
| M7 | switch executable without a path | `row 2c browser.tab, a switch without a path: live input` |
| M11 | malformed `tab.urlPath` no longer refuses the tab request | `web.browser.tab was dispatched: a switch path that is not a bare pathname: "http://127.0.0.1:4173/scenarios/multi-tab/list"` |
| M13 | recorded tab stored whole | diff `+ tabId: 41`, `+ url: 'http://127.0.0.1:4173/scenarios/multi-tab/details?session=tok-123'` |
| M9 | `frameUrlPath` lifted with `nonEmptyString` (run before and after the refactor) | `refused: "http://127.0.0.1:5174/payment"`, both times |
| M15 | full URL written as `browserFrameUrlPath` | `not ok - a child-frame action also carries its frame's URL path, and nothing else of the URL`; `not ok - a child frame whose document is not http(s) gains no path`; the gateway-mapping chain: actual `undefined`, expected `'/scenarios/iframe-checkout/payment'` |
| M8b | frame 0 gains a path (`> 0` changed to `>= 0`) | `not ok - every top-frame node's parameters are byte-identical to what they were before the frame path`: `web.dom.click` |
| M12 | leading `//` guard removed from `webAutomationUrlPath` | `not ok - a full URL, a query, a fragment, a relative path or a non-string is no path, ...`: `"//example.test/list"` |
| Marker | two guards: A, `payloads.ts` builds nothing without a tab; B, `recordedTabInputId` maps no operation to nothing | **Both broken:** `row 2 browser.tab: live input`, actual `'web.user.tab_closed'`; plus `not ok - the recording-start marker, which has no tab, builds nothing`. **A broken alone:** the same payloads row fails and input-model passes, so B holds alone. **B broken alone:** every observing test passes (`# fail 0`), so A holds alone. |

**The marker's input-id guard has no single-site proof.** Guard B alone is
defence in depth: the payload guard and the required `tab` parameter already
keep the marker non-executable, so no test can see B break on its own. This is
reported rather than hidden.

## Not verified

- **Other packages' compiles.** Extension and test-runner `check` were not run;
  the brief named only the domain gates, and other workers are editing both.
  What they would depend on:
  - the rename of `webAutomationSecretKeyForRecordedElement` to
    `webAutomationRecordedElementKey` (a repository search found no consumer
    outside `domain/src`);
  - the new exports;
  - the three new input ids, where the search found no exhaustive
    `Record<WebAutomationInputId, …>` in `apps` or `packages`.
- **Core resolution is unit-level only.** An object-valued `web.upload.` binding
  was shown resolving through Core's exported
  `resolveAutomationNodeParameterValues` in a unit test, not in a Core run.
- **Candidate labels.** No test asserts "Upload files" or "Browser tab" on a
  proposed candidate; the mapper suite passed with them.
- **Whether the recorder emits `dom.input` for a file input.** If it emits both
  `input` and `change` for one choice, the domain would propose two upload nodes
  (rows 9c and 9f both map). The same double existed before as two text entries.
- **Whether a child frame's recorded `url` is the frame's own document.**
  `payloads.ts` relies on the recorded `payload.url` being the frame's
  `location.href`, as the design report cites (`content/recorder.ts:131-137`). I
  did not read that file.
- **What a Lab run must show:**
  - **W17, Flow lane, 3 of 3.** Flow actions are `web.dom.upload` succeeded then
    `web.dom.click` succeeded, with no `web.dom.type`; the final state holds; the
    leak rows read 0. This also needs the runner's `web.upload.<key>` input and
    the upload runtime confirmation.
  - **W15 unarmed, both lanes, 3 of 3.** The recording has two
    `web.tab.state_changed` entries with `web.user.tab_switched` and one with
    `web.user.tab_closed`. The Flow is click, tab, tab, tab, click, all
    succeeded; the final state holds.
  - **W15 `popup-blocked`.** Still `output_not_observed`.
  - **W28, Flow lane, 3 of 3.** Both clicks succeed after the start-page load,
    with `browserFrameUrlPath` on both nodes.
  - **Every other week1 row.** `flow-lane.json` lists no `web.browser.tab`
    action, and top-frame node parameters are unchanged.

## Open questions or contradictions found

1. **An emptied file input stays evidence.**
   - **What the brief says:** "a file input's change maps to `web.dom.upload`".
     The design report's proof only required that `inputValue: ""` maps to
     neither clear nor type.
   - **What I did:** a recorded `""` means the input was left holding no files,
     and an upload that asks for files cannot reproduce that. So that one case
     stays evidence (row 9e). An absent value, which is what the recorder sends
     once it stops reading a file input's `value`, and a non-empty value both
     map to the upload.
   - **Consequence:** after the extension change, a cancelled choice and a real
     choice both arrive with no value and cannot be told apart. Both map to
     upload.
2. **The pathname-rule gap is still in the extension.** The `//host` gap is fixed
   in the domain, but the copy at `apps/extension/src/runtime/command-options.ts:55`
   has it until it imports `webAutomationUrlPath` from
   `@fluxiq-web-extension/domain/client`.
3. **Are supplied upload files persisted in Core?** A supplied upload's file
   content arrives as a run input under `web.upload.<key>`. The redaction
   attestation and declared-secret supplier key only on `web.secret.`, by design.
   I did not check whether `g-core-input-withholding` withholds every run input
   or only declared secrets. If it is only secrets, the fixture file's base64
   content would be persisted in Core's workspace. Worth checking before the
   runner's upload input lands.
4. **Two inputs share one output.** `web.user.tab_switched` and
   `web.user.tab_closed` both map to `web.browser.tab`. Anything that derives an
   input id from an output id must use the command's `tab.operation`. The
   `runtime-status.ts` confirmation worker needs this, as the design report
   already says.
5. **For the later workers.**
   - **Test-runner upload worker:** build the input path with
     `webAutomationUploadStatePath(webAutomationRecordedElementKey(recordedPayload))`,
     or read the `upload` binding's path off the approved node with
     `webAutomationUploadBindingPath`.
   - **Architecture pages:** not updated, per the brief's single later pass.
6. **Pre-existing structure-audit failure.** `docs/working/README.md` is out of
   date with the documents' header blocks. It reproduces on the real index
   without my files, and I did not run `pnpm structure:baseline`. No baseline
   entry needs to change for this work.
