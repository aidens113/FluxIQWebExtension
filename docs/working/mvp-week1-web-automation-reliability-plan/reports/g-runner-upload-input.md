# g-runner-upload-input — the Flow lane supplies the file a recorded upload asks for

## Outcome

**Done, in unit scope.** All six tasks are built or answered.
- Every new guard has a mutation proof. Every mutated file was restored, and
  `sha256sum -c` printed `OK` for all ten owned files.
- **Gates.** Every gate the brief names passes: test-runner, scenario-lab,
  test-contracts, the domain and the structure audit.
  - The domain suite's one failure is the expected W25 Core-order row.
- **Shared dists.** `domain/dist` and `packages/test-contracts/dist` were each
  rebuilt once, before any mutation.
- **Not run.** Nothing ran in a browser, in Core, or in the Lab.

## What changed and why

### Task 1: the upload input (`packages/test-runner/src/flow-lane/declared-uploads.ts`, new)

**`flowUploadRequests(nodes)`**
- Reads every node of the approved Flow whose `parameters.upload` is an upload
  request. It uses the domain's `webAutomationUploadBindingPath` to recognise
  one.
- For each such node it returns:
  - `nodeId`;
  - `path`, the run-input path Core will resolve;
  - `recordedElementPath`, computed as
    `webAutomationUploadStatePath(webAutomationRecordedElementKey(parameters))`.
    These are the domain's own exports, so the key rule is called, not copied.

**`declaredUploadInputs({ scenarioId, steps, requests })`** returns
`Record<path, WebAutomationUploadRequest>`, typed with the domain's type. Each
value is `{ files: [{ name, mimeType, contentBase64 }] }`.
- **`name`:** the file name the recording script's `upload` step gives.
- **`contentBase64`:** the base64 of `deterministicUploadBytes(name)`. These are
  exactly the bytes `uploadDeterministicFile` writes and hands the browser on the
  recording lane.
- **`mimeType`:** `application/octet-stream`. See open question 2.
- **Two nodes asking under one path** get one input. That happens when one choice
  is recorded as both `input` and `change`.

**The run fails before the Flow starts in three cases.** Each failure names node
ids, step ids and paths, never a file name or content:
- **A request whose path is not the domain's key for its own recorded control:**
  `recording.contract`.
- **Requests when the script's `upload` steps name no file:** `fixture.invalid`.
- **Requests when the steps name more than one distinct file:** also
  `fixture.invalid`. The runner cannot tell which control each file belongs to
  without a target matcher (open question 1).

**No request supplies nothing.** A recording whose file choice became no upload
node is left for W17's pinned `web.dom.upload` to judge, as a product result.

### Task 2: spread beside the secrets (`flow-lane/run-flow-lane.ts`)

- `uploadInputs` is derived from the same single read of the Flow's nodes that
  the secret requests use.
- `inputs` is now `{ ...secretInputs, ...uploadInputs, scenarioId, facilityRunId }`.
  The two namespaces, `web.secret.` and `web.upload.`, cannot collide.
- **No file content reaches a log, an event or an evidence file:**
  - The inputs go only to `startPersistedFlow` and `runPersistedFlow`
    (`persisted-flow-run.ts:127-133`).
  - `http-control.ts` has no console, log or write call (a search found none).
  - `FlowLaneEvidence` and `flowLaneSnapshot` carry no inputs. A test row asserts
    the content is absent from both.
  - The runner's failures name only ids and paths (test row below).
- **Core's persisted run inputs hold `[withheld]`, not the file** (task 6). This
  holds in the Core code on disk. Per the plan's Current State, that code is not
  in Core's built package.

### Task 3: W17 pins its upload

- **`apps/scenario-lab/src/scenarios/file-transfer/manifest.ts`:** W17's
  `expected.actions` is now `web.dom.upload` succeeded, then `web.dom.click`
  succeeded.
- **`packages/test-contracts/src/recordable-actions.ts`:**
  - `upload: ["web.dom.upload"]`.
  - `f-tab-recording` has reported, so `switchTab` and `closeTab` are both
    `["web.browser.tab"]`.
  - The doc comment now says what each of the three records.

### Task 4: the domain build

- `domain/dist` was stale: it was built 2026-09-12 18:47 and had no
  `upload-binding.js`.
- I rebuilt it once, shared, with `pnpm --filter @fluxiq-web-extension/domain
  build`. That was after the task 5 edit and before any mutation.
- `domain/dist` is untracked (`git ls-files` counts 0). No tracked build changed:
  `git status --short domain/.test-build apps/extension/build` printed nothing.

### Task 5: a cancelled choice stays evidence (`domain/src/io/input-model.ts`, file-input branch only)

- The branch now returns evidence when
  `payload.inputValue === "" || element?.hasValue === false`. Otherwise it returns
  `filesChosen`, as before.
- The comment says why: a cancelled or emptied choice holds no files, and the
  runner would fill it.
- **New rows in `io/tests/input-model.test.ts`:**
  - 9g: `dom.change`, `hasValue: true` maps to `web.dom.upload`. This is the shape
    the recorder sends since `f-frame-address`.
  - 9h: `dom.change`, `hasValue: false` is evidence.
  - 9i: `dom.input`, `hasValue: false` is evidence.

### Task 6: what Core keeps of a supplied `web.upload.<key>`

This is read from `F:\!FluxIQ` as it was on disk on 2026-09-13, not probed.
Another worker (`g-core-withholding-execution`) is editing Core's runtime. Per
Current State, Core's built package (`187f40d`) predates the session and attempt
withholding.

**The session record**
- `startRuntimeSession` writes `metadata.inputs` with every key's whole value
  replaced by `[withheld]` (`programs/automation-studio/runtime/service.ts:2832`).
- So the saved session holds `{"web.upload.<key>": "[withheld]"}`: no name and no
  content.
- The run-detail envelope on the runtime stream does the same
  (`storage/project/runtime-stream-store.ts:514,527-529`).

**Trace values**
- `withholdRunInputs` (`runtime/executor/graph-run.ts:104-134`) rewrites
  `values["web.upload.<key>"]` and each attempt's `inputs` entry in place:
  `{ files: [{ name: "[withheld]", mimeType: "[withheld]", contentBase64: "[withheld]" }] }`.
- Before the first node runs, `recordDeclaredStateBindings` (`graph-run.ts:71-81`)
  resolves the node's `upload` binding. That records the name, the MIME type and
  the base64 content as withheld texts (`trace-withholding.ts:130-167`).
- `withholding.apply` then replaces those texts, as substrings, in two places:
  - under every data key: `payload`, `outputs`, `inputs`, `values`, `metadata`,
    `data` and the others;
  - under the prose keys: `message`, `reason`, `label`, `expected`, `actual`.

  The substring rule is `runtime/text-withholding.ts:25-49`.
- **Side effect:** any message quoting `expense-receipts.csv`, and any
  `application/octet-stream` under those keys, reads `[withheld]`.

**Command-attempt parameters**
- The texts travel in three steps:
  - `node-execution.ts:172-176` hands `withheldValues` to the dispatcher;
  - `io-policy.ts:99` passes them to the framework runtime;
  - `runtime/service.ts:188-204` saves the attempt as `withheldCommand`.
- In that saved copy, `upload.files[0].name`, `.mimeType` and `.contentBase64`
  read `[withheld]`. So do the result's `message` and `error` (`:429-436`).
- The target still receives the real command (`:224`).

## Commands run and observed results

Exit statuses were captured by redirecting output to a file and echoing `$?`.

| Gate | Command | Observed |
| --- | --- | --- |
| Domain check | `pnpm --dir domain check` | `exit=0` |
| Domain test | `DOMAIN_TEST_BUILD_LABEL=g-runner-upload-input node scripts/test-domain.mjs` | `exit=1`, `# tests 399`, `# pass 398`, `# fail 1`: `not ok 380 - W25: the live delayed-ui messages through Core's client gateway ... propose click, wait, click` (expected). `Web automation input model tests passed.` |
| Domain dist (shared, once) | `pnpm --filter @fluxiq-web-extension/domain build` | `exit=0`; `clean-dist: removed 255 emitted file(s)`; `rewrite-dist-specifiers: 394 specifier(s) in 121 file(s)`; `upload-binding.js` and `recorded-element-key.js` present |
| Test-contracts dist (shared, once) | `pnpm --filter @fluxiq-web-extension/test-contracts build` | `exit=0` |
| Test-contracts test | `node --test tests/*.test.mjs` (not `pnpm test`, which would rebuild dist) | `exit=0`, `# tests 66`, `# pass 66`, `# fail 0` |
| Test-runner check | `pnpm check` (in `packages/test-runner`) | `exit=0` |
| Test-runner build | `pnpm exec tsc -p tsconfig.json --outDir dist-grui` | `exit=0` |
| Test-runner test | `node --test "dist-grui/**/*.test.js"` | `exit=0`, `# tests 555`, `# pass 555`, `# fail 0`; rerun after all mutations were restored: `555` / `555` / `0` |
| Scenario-lab check | `pnpm check` (in `apps/scenario-lab`) | `exit=0` |
| Scenario-lab build | `FLUXIQ_LAB_SCENARIO_OUT_DIR=dist-grui node scripts/build-scenario-lab.mjs` | `exit=0` |
| Scenario-lab test | `node --test "dist-grui/**/*.test.js"` | `exit=0`, `# tests 204`, `# pass 204`, `# fail 0` |
| Structure audit | `node scripts/structure-audit.mjs`, scratch `GIT_INDEX_FILE` with both new files added | `exit=0`; one advisory: `run-flow-lane.test.ts: 425 lines is past the 400-line advisory threshold` |
| Byte identity | `sha256sum -c` against hashes taken after the final edits and before any mutation | all 10 files `OK` |

**The new test rows**
- **Test-runner:**
  - `ok 72 - W17's upload step is answered with the file the recording lane chose, under the path the domain derives from the recorded control`.
    - It loads W17 from the built registry, maps a recorded file choice through
      the domain's `webAutomationRecordedAction`, and compares the supplied bytes
      with the file `uploadDeterministicFile` wrote.
    - It also compares the sha256.
  - `ok 73 - each request is read under the path the domain derives from its recorded control, and a node keyed any other way fails before the run`.
  - `ok 74 - only an upload request asks for files, two nodes asking under one path get one input, and no request supplies nothing`.
  - `ok 75 - a request no single named file answers fails before the run, naming steps and paths, never a file's name or content`.
  - `ok 145 - the run's inputs carry the recording lane's file once, under the path the upload node asks for, and the lane's evidence never does`.
- **Test-contracts:** `ok 64 - an upload step records web.dom.upload, and a tab switch or close records web.browser.tab`.
- **Scenario-lab:** the W17 row now also asserts `expected.actions`
  (`ok 69 - upload workflow W17 ...`).

### Mutation proofs

- Each mutation was made with Edit, observed in a private build, and restored
  with Edit.
- **Test-contracts:** mutations were built into a private `.dist-grui-mut`, and a
  copy of the validation test was pointed at it. The shared dist stayed built
  from the final source.
- **Domain:** the mutation was bundled alone with esbuild into
  `.test-build-scratch/g-runner-upload-input-mut`.

| # | Guard broken | Observed failure |
| --- | --- | --- |
| M1 | `\|\| element?.hasValue === false` removed (`input-model.ts`) | `AssertionError [ERR_ASSERTION]: row 9h dom.change, file input recorded holding no files: live input` |
| M2 | `upload: []` (`recordable-actions.ts`) | `not ok 14 - an upload step records web.dom.upload, ...`: `[{"path":"$.workflows[0].expected.actions[0].action","message":"names web.dom.upload, which no step ..."}]` |
| M3 | `switchTab: []` | same test: `"path":"$.workflows[1].expected.actions[0].action","message":"names web.browser.tab, ..."` |
| M4 | `closeTab: []` | same test: `"path":"$.workflows[2].expected.actions[0].action","message":"names web.browser.tab, ..."` |
| M5 | W17's upload pin removed (`manifest.ts`) | `not ok 3 - upload workflow W17 ...`: diff `- action: 'web.dom.upload'` |
| M6 | supplied bytes `Buffer.from(name)` instead of `deterministicUploadBytes(name)` | `not ok 1 - W17's upload step ...`: `the supplied content is byte for byte the file the recording lane chose` / `false !== true`; `not ok 15 - the run's inputs carry ...`: `the run is started and executed with the file once, under the node's path` |
| M7 | control keyed by `element.testId` instead of `webAutomationRecordedElementKey` | 4 of 4 declared-uploads tests fail; ok 72: `RunnerFailure: ... Node node.upload asks under web.upload.input-upload-file-2; its recorded control is keyed web.upload.upload-file.` |
| M8 | key cross-check disabled (`if (unkeyed.length && Date.now() < 0)`) | `not ok 2 - each request is read under the path ...`: `Missing expected exception.` |
| M9 | `...uploadInputs` dropped from the run's `inputs` (`run-flow-lane.ts`) | `not ok 15 - the run's inputs carry ...`: `the run is started and executed with the file once, under the node's path` |

**Cleanup.** All my private directories were deleted:
- test-runner `dist-grui`;
- scenario-lab `dist-grui`;
- test-contracts `.dist-grui-mut` and `.grui-mut-tests`;
- domain `.test-build-scratch/g-runner-upload-input` and `-mut`.

## Not verified

- **The Lab.** A W17 Flow-lane run must show, 3 of 3:
  - Flow actions `web.dom.upload` succeeded, then `web.dom.click` succeeded, with
    no `web.dom.type`;
  - the final state `Uploaded expense-receipts.csv` holds;
  - the leak rows read 0;
  - no persisted Core object, whether session, trace or command attempt, contains
    the base64 content or `expense-receipts.csv`.

  That last point needs a Core build that includes the session and attempt
  withholding. **The leak attestation does not look for upload content,** which
  is not a declared secret, so the Lab run must search for it explicitly.
- **Core resolving the input end to end.** Resolution of an object-valued input
  through Core's HTTP API and a real run was not exercised. Task 6 is read from
  code, not probed.
- **The MIME type.** The recording lane's browser types the file from its
  extension (`.csv`), while the Flow supplies `application/octet-stream`. The
  fixture reads only name and size. Not exercised live.
- **A cancelled choice in Chrome.** Whether Chrome sends a `change` with
  `hasValue: false` for one was not exercised in a browser.
- **Stale scenario-lab dist.** The test-runner suite reads the shared
  `apps/scenario-lab/dist`, which I did not rebuild.
  - Its W17 upload step is unchanged, so row 72 is sound.
  - Its W17 `expected.actions` still reads click only until the supervisor
    rebuilds scenario-lab. A Lab run needs that rebuild.
- **Readers during the shared rebuilds.** `domain/dist` is deleted before being
  re-emitted, and `packages/test-contracts/dist` was rebuilt in place. Another
  worker's test-runner run during either build could briefly have failed to
  resolve its imports.

## Open questions or contradictions found

1. **Several distinct upload files fail closed.**
   - To pair each file with its control, the runner needs the manifest target
     matcher, `targetMatchesRequest`, which is private in
     `flow-lane/declared-secrets.ts`. I do not own that file.
   - Today only W17 uploads, with one step, so nothing is blocked.
   - If multi-file scenarios arrive, export that matcher (or move it to a shared
     module) and pair by target.
2. **The MIME type is `application/octet-stream`.** Matching the browser's
   `text/csv` would need a second extension-to-type table, which I did not want
   to create. Change it if a fixture starts reading the type.
3. **The barrel.** `flow-lane/index.ts`, which I do not own, does not export
   `declared-uploads.ts`. `run-flow-lane.ts` imports it directly, and the audit
   passed. Add `export * from "./declared-uploads.js";` if the barrel should list
   every module.
4. **The key-mismatch category is `recording.contract`.** Such a node asks under
   a path its own recorded control does not derive. Say if another category fits
   better.
5. **Test file size.** `run-flow-lane.test.ts` is now 425 lines: advisory, not
   baselined, and under 800. No baseline entry needs to change.
6. **Core's withholding of mere text.** Core withholds `application/octet-stream`
   and the file name wherever they appear as text in the trace. A message such
   as "Uploaded expense-receipts.csv" would read "Uploaded [withheld]" in saved
   traces and attempts. This is by Core's design, not a defect here.
