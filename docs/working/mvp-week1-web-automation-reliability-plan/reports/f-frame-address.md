# f-frame-address — find a child frame by its path (extension)

## Outcome

**Done.** Both parts of the brief are built:
- **P6:** an action whose recorded child frame was renumbered is now found by
  the path of that frame's document.
- **File input:** the recorder no longer reads a file input's `value`.

**Observed:**
- extension `check` exit 0;
- extension `test` under `EXTENSION_TEST_BUILD_LABEL=ffa`: 435 of 435 passed;
- a mutation proof for every new guard, restored byte-identical;
- the structure audit passed;
- the six content-harness specs that read an element's value: 62 of 62 passed;
- a real-browser observation of what a recorded file input now carries, with
  its own mutation proof.

**Not yet observed:** the path lookup against a real `chrome.webNavigation`,
which only the Lab exercises. The harness runs are single observations.

## What changed and why

### 1. P6: a child frame is found by its document's path

- **`apps/extension/src/runtime/command-options.ts`**: new
  `frameUrlPathForAction`.
  - It reads the domain's typed `frameUrlPath` first, then the raw
    `browserFrameUrlPath` parameter.
  - It holds both to the lift's own rule: a string starting with `/`, with no
    `?` or `#`.
  - It defines no copy of the wire name or type. It compiles against
    `WebAutomationActionCommand.frameUrlPath` as `f-domain-capability-gaps`
    added it.
- **New `apps/extension/src/runtime/frame-address.ts`**, with one exported
  function, `chooseFrame(frames, recordedFrameId, urlPath)`, and two exported
  types, `ListedFrame` and `FrameChoice`. It follows the report's rules:
  - **No path:** the recorded id, unchanged.
  - **An empty frame list:** the recorded id, because empty means the browser
    would not say.
  - **One child frame at the path:** that frame's id.
  - **Several:** the recorded id if it is one of them. Otherwise
    `TARGET_AMBIGUOUS` (`web.target.ambiguous`, not retryable), naming the count.
  - **None:** `TARGET_NOT_FOUND` (retryable). It names the path and each child
    frame's path, never an origin, a query or a full URL.
  - **Matching:** only the pathname of an http(s) URL is compared. `about:`,
    `srcdoc`, unparsable and URL-less frames never match.
- **`apps/extension/src/runtime/action-runner.ts`**, `runActionInFrame`: when the
  action has a path, it lists the tab's frames (`allTabFrames`) and resolves
  through `chooseFrame` before the existing absent and unreachable checks.
  - A refusal is returned through `workerActionResult`, reported against the
    recorded id.
  - Otherwise the frame found is the one checked, pinged, addressed (the
    `sendMessage` option and the body's `frameId`) and reported by `withTarget`.
  - An action with no path lists no frames here, so it makes exactly the calls
    it made before.

**Where this differs from the design, and why:**
- **The frame list is an input, not the tab id.** If `frame-address.ts` called
  `allTabFrames` itself, it would import `../background/tabs`. The `imports`
  rule counts that as a barrel-crossing import with no baseline entry, so the
  audit would fail. `action-runner.ts` already makes that import; its baselined
  count stays at 1. The choice is also a pure function this way.
- **The top frame is never a candidate.** The domain attaches a path only to a
  node recorded in a child frame (`browserFrameId > 0`). Moving that action into
  the top document would send it to a frame it was never recorded in.
- **Outside `runActionInFrame`,** I edited only the two import lines of
  `action-runner.ts`. The function's last parameter is renamed
  `recordedFrameId`, and its doc comment gains one paragraph.
- **The receiving side needs no change.** `content/message-handler.ts:42-46`
  checks only top frame versus child frame, never the numeric id, so a
  renumbered child frame accepts the command.

### 2. The recorder stops reading a file input's `value`

- **`apps/extension/src/content/describe-element.ts`**, `readElementValue`: a
  file input (`HTMLInputElement` whose `type` is `file`) now yields `undefined`.
- **Why this one function:** every capture path reads values through it:
  - the element descriptor's `value`;
  - `dom.change` and `dom.input`'s `inputValue`;
  - the snapshot's ranking and fallback text (`dom-snapshot.ts:242,257,268`).

**What a recorded file input's element now carries.** Observed on a real
Chromium `dom.change`, file-transfer fixture, after choosing a file:
- `tagName: "input"`, `selector: "#upload-file"`, `id`, `xpath`, `testId`;
- `isVisibleOnViewport`, `bounds`, `documentBounds`;
- `inputType: "file"`, `hasValue: true`;
- `accessibleName: "File to upload"`, `label: "File to upload"`;
- `context: { landmark: "form", landmarkName: "Upload a file", heading: "Upload a file" }`;
- `attributes: { id, name: "file", type: "file", aria-describedby, data-testid }`.

It carries no `value`, and the event carries no `inputValue`. The page itself
held `C:\fakepath\ffa-local-receipt.csv`. Two other descriptions are unchanged
in substance and also carry no `value` now:
- the snapshot's form evidence control (`controlType: "file"`,
  `hasValue: true`), which never had a value;
- an upload action result's `element`.

**Side effect.** A file input with a file chosen loses the snapshot's +35
meaningful-value ranking score (`dom-snapshot.ts:268`). It keeps its accessible
name, so it still ranks as meaningful.

### Tests

- **New `runtime/tests/frame-address.test.ts`**, eight rows:
  - no path;
  - an empty list;
  - one match despite origin and query;
  - the top frame excluded;
  - a tie broken by the recorded id;
  - ambiguous, as the full record, parsed by Core;
  - not found, naming paths with no origin or query, parsed by Core;
  - non-http(s) URLs never match.
- **`runtime/tests/action-runner.test.ts`:**
  - The stub's frame list also accepts `{ frameId, url }`.
  - Five rows are added:
    1. a stale id with one child frame at the path is sent to that frame (the
       ping, the send option, the body and the result all name it);
    2. two frames at the path, neither with the id, give ambiguous, with nothing
       sent or pinged;
    3. no frame at the path gives not-found, naming paths and never a full URL;
    4. without a path, today's refusal is unchanged;
    5. an unenumerable tab keeps the recorded id.
- **`runtime/tests/command-options.test.ts`:** one row. The typed field comes
  first, then the raw parameter. An empty value, a relative path, a full URL, a
  query, a fragment, a number and null are each refused.
- **New `content/tests/describe-element.test.ts`**, two rows: a file input yields
  no value, and a text input's value is still read. The element classes are
  stubbed in Node.

## Commands run and observed results

Every command ran from `apps/extension` unless noted, with its output redirected
to a file in the scratchpad and `$?` echoed.

**The type check, `pnpm check`:**
- **Before the domain settled:** twice, exit 2. The only errors were in files
  `f-domain-capability-gaps` was editing:
  - `domain/src/client/gateway-mapping.ts(153,22): Cannot find name 'webAutomationUploadBindingPath'`;
  - `domain/src/io/input-model.ts(131,14): Cannot find name 'recordedTabInputId'`;
  - `domain/src/output-nodes/payloads.ts(3,38): ... no exported member 'webAutomationSecretKeyForRecordedElement'`.

  No error named a file of mine.
- **`npx tsc -p tsconfig.test.json`,** meanwhile: exit 2. Its one output line was
  one of those domain errors, and there was none in my test files.
- **The wait:** a background loop reran `npx tsc -p tsconfig.json --noEmit`.
  It printed `extension main project compiles after 4 retries` and exited 0.
- **Then `pnpm check`:** exit 0, both projects.

**The unit tests, `EXTENSION_TEST_BUILD_LABEL=ffa pnpm test`:** exit 0.
- `Extension smoke test passed.`
- `# tests 435`, `# pass 435`, `# fail 0`.
- All 16 new rows are `ok`: frame-address 391-398, action-runner 327-331,
  describe-element 298-299, and command-options 383.

**Mutation proofs:**
- **Setup:** backups were taken with their sha256 hashes. Two mutations were
  applied in separate files:
  - `action-runner.ts`: `const urlPath = frameUrlPathForAction(action);` became
    `const urlPath: string | undefined = undefined;`, which skips the path
    lookup;
  - `describe-element.ts`: the file check's `"file"` became
    `"ffa-mutation-never"`.
- **`EXTENSION_TEST_BUILD_LABEL=ffa node scripts/test-extension.mjs`:** exit 1,
  `# pass 431`, `# fail 4`. Exactly the guarded rows failed:
  - `not ok 298 - a file input yields no value, ...`: `+ 'C:\\fakepath\\expense-receipts.csv'` `- undefined`;
  - `not ok 327 - a stale recorded frame id with one child frame at its path is sent to that frame, ...`: `0 !== 1` (nothing was sent, because the stale id was refused);
  - `not ok 328 - two child frames at the path, neither with the recorded id, fail as target_ambiguous ...`;
  - `not ok 329 - no child frame at the path fails as target_not_found, ...`.
- **The rows that do not use the lookup** (330 without a path, 331
  unenumerable) still passed, as they should.
- **Restored:** `cmp` against both backups printed
  `both byte-identical to pre-mutation backups`.

**What a real browser records for a file input.** The content harness ran a
temporary spec, `e2e/content/tests/ffa-scratch-file-input.spec.ts`, alone:
- **Run 1 (in-memory buffer):** exit 1. No `dom.change` was recorded, because
  Playwright's buffer path fires untrusted events and the recorder drops them
  (`dom-events.ts:100`). The snapshot and the upload result already carried no
  `value` (`SNAPSHOT_HAS_FAKEPATH false`).
- **Run 2 (a file on disk, trusted change):** exit 0, `1 passed`.
  - `PAGE_VALUE "C:\\fakepath\\ffa-local-receipt.csv"`;
  - `WIRE_HAS_FAKEPATH false WIRE_HAS_NAME false`;
  - `SNAPSHOT_HAS_FAKEPATH false`.

  The recorded element is listed under "What changed" above.
- **Run 3 (the describe-element mutation applied):** exit 1, `1 failed`.
  - The recorded `element.value`, the snapshot's `value`, `"inputValue"` and the
    upload reply's element each read `"C:\\fakepath\\ffa-local-receipt.csv"`.
  - `WIRE_HAS_FAKEPATH true WIRE_HAS_NAME true`, `SNAPSHOT_HAS_FAKEPATH true`.
  - It failed at `expect(wire).not.toContain("fakepath")`.
- **Afterwards:** restored (`cmp` printed `byte-identical`). The spec was moved
  out of the tests folder to the scratchpad; `e2e/content/tests` now lists 0
  `ffa` files. My artifact folder under `test-results/content/artifacts` was
  removed.

**The specs that read an element's value:**
`pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2 redaction.spec recorder-trust.spec identity.spec upload-dialog.spec evidence.spec selection-redaction.spec`.
It ran after the restores were confirmed: exit 0, `Running 62 tests using 2
workers`, `62 passed (13.4s)`.

| Spec | Tests |
| --- | --- |
| `evidence.spec.ts` | 19 |
| `redaction.spec.ts` | 14 |
| `identity.spec.ts` | 12 |
| `recorder-trust.spec.ts` | 6 |
| `upload-dialog.spec.ts` | 6 |
| `selection-redaction.spec.ts` | 5 |

**The structure audit** (from the repository root). The index was copied to a
scratch file, and the three new files were added to that copy only:
- `GIT_INDEX_FILE=<scratch> node scripts/structure-audit.mjs`: exit 0,
  `structure-audit: passed (39 warning(s), 17 baselined)`.
- One new warning is on a file I touched, advisory only:
  `apps/extension/src/runtime/tests/action-runner.test.ts: 558 lines is past the
  400-line advisory threshold`.
- No finding names `frame-address.ts`, `command-options.ts`,
  `describe-element.ts` or `content/tests`.
- The only later changes to source were the mutations, restored byte-identical,
  so the audit covers the final bytes.

**Cleanup:**
- `.test-build-scratch/ffa` removed (`ls` lists 0 `ffa`).
- The folders left under `e2e/content/.harness-build` all predate this session;
  my harness runs left none.

## Not verified

- **The Lab, W28 on the Flow lane, 3 of 3.** A Lab run must show:
  - both clicks succeed after the start-page load;
  - no `target_not_found` whose `expected` names a frame id;
  - where the bundle publishes the result's `frameId`, it differs from the
    recorded `browserFrameId`, and each click reached the frame at the recorded
    path;
  - the smoke corpus's W28 Flow row changes the same way.
- **The path lookup against a real `chrome.webNavigation.getAllFrames`** in a
  loaded extension. Only a stub drives it. The content harness does not run the
  worker, and a real browser may report a child frame's `url` differently, for
  example after a redirect.
- **The Lab's recording of W17:** that a recorded file input carries no `value`,
  and that the domain's P5 upload mapping works without it. The domain design
  says it does not need the value; I did not run the domain side.
- **Not run:** `frames.spec.ts` (id addressing through the content scripts,
  whose code did not change), Firefox, and the root `pnpm check`, `pnpm test`
  and `pnpm build`.
- **Single observations:** each harness result above ran once.
- **No permanent harness row** pins the file-input behaviour. See open
  question 2.

## Open questions or contradictions found

1. **The pathname rule is written twice:** in the domain's private
   `urlPathValue` (`domain/src/client/gateway-action-parameters.ts:314`), and
   again in `frameUrlPathForAction` for the raw parameter. Exporting the rule
   from the domain's `client` barrel would leave one copy. That needs a domain
   file this brief does not own.
2. **Should the scratch harness row become permanent?** It proved on a real page
   that a trusted file choice records no value, and it failed under the
   mutation. It is not in my Owns. The natural home is
   `e2e/content/tests/upload-dialog.spec.ts` or `redaction.spec.ts`; it must set
   the files from a path on disk, or the recorder ignores the untrusted change.
   Its source is at
   `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\4f264c80-323b-4673-a09a-bde5851669f3\scratchpad\ffa-scratch-file-input.spec.ts`.
3. **Two design choices for the supervisor to accept or reverse:** the top frame
   is never a path candidate, and `chooseFrame` takes the frame list rather than
   the tab id. The reasons are under "What changed".
4. **Still deferred, as the design report says:** expectation conditions
   (`domain/src/runtime/expectation/conditions.ts:79-99`) and LLM element
   evidence still carry the recorded frame id. No week1 claim targets a child
   frame.
5. **`action-runner.test.ts` is now 558 lines,** past the 400-line advisory,
   under the 800 limit. The frame-routing rows could move to their own test
   file if the supervisor wants it below the advisory.
