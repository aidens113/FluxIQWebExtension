# i-secret-in-workspace — where the declared auth-gate secret enters Core's workspace

Worker report for `i-secret-in-workspace` in the twenty-third dispatch of
[finish-week1.md](../briefs/finish-week1.md). Repository `6c22e22`
(`6c22e220b42efa7c31af8eaeebad420a37010bcb`) in `F:\fxlab\fxlab-7263534`; Core
`5845f5d` (`5845f5d45c68bc6bc08f0f65003a136fca2656a8`) in `F:\fxlab\!FluxIQ`.
Written 2026-09-13, local time (UTC-7).

- **Evidence rules.** The two runs are single observations. The value itself is
  never printed, hashed or partially quoted here: every figure is a key path, an
  object kind or a count.
- **What "the value" means.** The auth-gate fixture's password constant
  (`apps/scenario-lab/src/scenarios/auth-gate/constants.ts`). The scenario
  declares it as the replay secret `auth-gate-password` for the step
  `enter-password` (`auth-gate/manifest.ts:44,105`). The Lab supplies it as
  `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD`.

## Outcome

**Done. The value reaches Core's workspace by three separate routes. Only one of
them is the declared secret.**

1. **The page shows it as plain text.** This accounts for most occurrences, and
   for all 6 of the recording-lane run's flagged files.
   - The fixture's sign-in page prints the demo password as visible text in a
     `<dd data-testid="demo-password">` element (`auth-gate/pages.ts:26`).
   - It is not a form control, so the sensitive-field rule does not apply to it.
   - The extension captures it as the element's `visibleText` and `text`, the
     domain projects it into web state, and Core persists every state snapshot.
   - It was neither typed nor supplied: it is page content.
2. **The runner supplies it as Flow-run inputs, twice.**
   - The copies are `inputs["auth-gate-password"]` and
     `inputs["web.secret.password"]`, both at `run-flow-lane.ts:130`.
   - Core persists run inputs in the runtime session record and in every
     `run`-kind event of the run's event stream.
3. **Core writes the resolved parameter into the command-attempt record.** The
   Flow's password `web.dom.type` node asks for the value with
   `{ $state: { path: "web.secret.password" } }`. Core resolves it and dispatches
   it as `command.parameters.text`, then writes the command attempt to disk.
   Core's trace withholding covers the Automation Studio trace only, not this
   runtime record.

**Nothing came from the recording as a typed value.**
- The recorder withholds a sensitive control's value at the source
  (`apps/extension/src/content/describe-element.ts:153-155`).
- No flagged key path is a recorded input value.
- The recording-lane run, which types the password and supplies no secret to
  Core, holds the value only in page-text snapshot paths.

**The attestation's 13 and 6 findings undercount.** It skips binary files
(`"skippedBinaryFiles":3` and `2`). Both runs' SQLite databases also hold the
value: in `automation.state` rows, and in a `state_paths` index row. See the
tables below.

## What changed and why

- **A temporary edit, since reverted,** in
  `F:\fxlab\fxlab-7263534\packages\test-runner\src\coordinator.ts` only. The line
  `if (process.env.I_SECRET_KEEP_RUN_ROOT === "1") return;` was added at the top of
  `removeAllocatedRunRoot` (`:204`), so each run kept `.work\<runId>`.
  - `match count=1`, `patched`; `git diff --stat` printed
    `1 file changed, 1 insertion(+), 1 deletion(-)` (saved as `i-secret-keep-root.diff`).
  - `tsc -p tsconfig.json --noEmit` printed `exit=0`.
- **Runs:** two bundles under `F:\fxlab-runs\secret\`. Their kept workspaces are
  deleted.
- **Scratch files,** all prefixed `i-secret-` or `l-stage2-i-secret-`: the key-path
  mapper `i-secret-keypaths.mjs`, the SQLite mapper `i-secret-sqlite.cjs`, the plan,
  and the logs and outputs. None prints the value.
- No tracked file in either repository is changed.

## Commands run and observed results

### Pre-checks and runs

- **Before:**
  - `F:\fxlab\fxlab-7263534 HEAD=6c22e22 status-lines=0 locks=0`;
  - `F:\fxlab\!FluxIQ HEAD=5845f5d status-lines=0 locks=0`;
  - `lab processes: 0`; `FreeGB 15.10`.
- **Runs:** `l-stage2-lab-seq.ps1` with plan `i-secret-plan.txt`, label `i-secret`,
  `FLUXIQ_TEST_ENV_FILES=none`, `I_SECRET_KEEP_RUN_ROOT=1`, and
  `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD` set for both runs, as in Stage 2.
  `labs before: 0`. Status lines:
  ```
  name=flow index=1 … seconds=67.5 exit=1 otherLabsBefore=0 freeGBBefore=15.22 args=run auth-gate --flow --target isolated secretSupplied=True
  name=recording index=1 … seconds=51.0 exit=1 otherLabsBefore=0 freeGBBefore=14.82 args=run auth-gate --target isolated secretSupplied=True
  ```

| Run | Bundle | Exit | `run.json` | Errors | Attestation |
| --- | --- | --- | --- | --- | --- |
| Flow lane | `F:\fxlab-runs\secret\run-mtzstkh6-859ed277` | 1 | facility `6c22e22…` `dirty=True` (the edit), Core `5845f5d…` `dirty=False`, `redactionState=failed` | `The Flow produced 0 extraction result(s), expected 1`; `Redaction attestation found 13 file(s) holding a declared literal or left unread` | `status=failed literalCount=1 findingCount=13`; workspace `scannedFiles=37`, `skippedBinaryFiles=3` |
| Recording lane | `F:\fxlab-runs\secret\run-mtzsv0d1-cccba2de` | 1 | the same flags | `Redaction attestation found 6 file(s) holding a declared literal or left unread` | `status=failed literalCount=1 findingCount=6`; workspace `scannedFiles=28`, `skippedBinaryFiles=2` |

Both runs reproduce Stage 2's counts: 13 findings on the Flow lane, and 6 on
the recording lane (the bench's W18 recording row).

### How the objects were read

- **JSON files.** `node i-secret-keypaths.mjs <.fluxiq root> <constants.ts>` walks
  every file. For each file holding the value it prints the JSON key paths whose
  strings contain it, and allow-listed id and kind fields.
  - Flow lane: `files scanned=40 files holding the literal=15`.
  - Recording lane: `files scanned=30 files holding the literal=8`.
  - The extra 2 files in each run are SQLite databases, which the attestation
    skipped.
- **SQLite files.** `node i-secret-sqlite.cjs <sqlite3 module> <db> <constants.ts>`
  opens each database read-only, using Core's `sqlite3@6.0.1`. For each column
  it counts `instr(CAST(col AS TEXT), ?) > 0` rows, with the value bound as a
  parameter. It prints table, column, row ids and key paths.
- **Object kinds.** Taken from each object's own schema fields, and from
  `project.sqlite` `object_references` (`owner_kind`, `purpose`),
  `state_snapshots`, `indexes/objects.json` (`mediaType`) and the recording's
  `index.json` (`states.<snapshotId>.stateRef`).

### Flow lane: every flagged object

Project `498cc211-839f-4483-986c-01389e3a5a30`; recording
`client.extension-b9bf57ae-4bc8-4a28-a709-815716754aa8.1789303050427`; runtime
session `1ff37d38-1a1c-4ec9-b365-770401cfc618`. Paths are under
`fluxiq-root/.fluxiq/artifacts/`.

| # | Object | Kind | Key paths holding the value (occurrences) | Source |
| --- | --- | --- | --- | --- |
| 1 | `automation-studio/projects/<p>/objects/sha256/4f/de/4fdea388….json` | Run record: a runtime event chunk (`schemaVersion` `automation-studio.event-chunk.v1`, `streamKind` `runtime`, `streamId` = the runtime session, sequence 1; `object_references` `owner_kind=runtime_run purpose=event_chunk`) | `$.events[0].payload.inputs.auth-gate-password` (1); `$.events[0].payload.inputs.web.secret.password` (1) | declared secret, as run inputs |
| 2 | `…/objects/sha256/cc/e2/cce273ba….json` | the same kind, sequence 2 | the same two paths | declared secret |
| 3 | `…/objects/sha256/f3/b0/f3b0b517….json` | the same kind, sequences 3–6; events 1–3 are attempt events (`attemptId`, `comparisonStatus`, …) with no value | the same two paths, on `events[0]` only | declared secret |
| 4 | `…/objects/sha256/e5/82/e582d82c….json` | the same kind, sequences 7–9; events 1–2 are a route decision and a subflow entry, with no value | the same two paths, on `events[0]` only | declared secret |
| 5 | `…/objects/sha256/6b/8e/6b8e3157….json` | State snapshot body, the recording's initial state (`object_references` `owner_kind=state_snapshot purpose=state_body`; `state_snapshots` `source_kind=recording sequence=0`) | `$.namespaces.web.values.elements.demo.password.value.visibleText` (1); `….value.text` (1); `….elements.demo.password.presentation.label` (1); `$.presentation.visualFrames[0].layers[8].label` (1); `$.presentation.visualFrames[1].layers[9].label` (1) | page text |
| 6–10 | `automation-studio/projects/<p>/recordings/<recording>/objects/{36f54863…, 475e84ce…, af37d67b…, d6e41b3c…, ed19cdba…}.json` | Recording state snapshots (`indexes/objects.json` `mediaType=application/vnd.fluxiq.state-snapshot+json`, with the recording id). They are the recording index's `states` for entries `entry.2`, `entry.10`, `entry.11`, `entry.12` and `entry.13` | the same 5 paths as #5, in each | page text |
| 11 | `runtime/command-attempts/attempt.65336973-…/attempt.json` | Runtime command attempt, `web.dom.type` (`$.attempt.command.kind=execute_action`, `status=succeeded`) | **`$.attempt.command.parameters.text` (1)**; `$.attempt.result.payload.result.snapshot.interactiveElements[8].text` (1), `.visibleText` (1), `.accessibleName` (1) | `parameters.text`: declared secret, resolved from `web.secret.password`. The snapshot paths: page text |
| 12 | `runtime/command-attempts/attempt.8baf3df7-…/attempt.json` | Runtime command attempt, `web.dom.type` (the username node; `parameters` has a `text` key, which does not hold the value) | `$.attempt.result.payload.result.snapshot.interactiveElements[8].text`, `.visibleText`, `.accessibleName` (1 each) | page text |
| 13 | `runtime/command-attempts/attempt.80a404db-…/attempt.json` | Runtime command attempt, `web.dom.click` | `$.attempt.result.payload.result.snapshot.interactiveElements[9].text`, `.visibleText`, `.accessibleName` (1 each) | page text |

**Not flagged, because the attestation skips binary files,** but holding the value:

| Database | Table.column | Row | Key paths (occurrences) | Kind | Source |
| --- | --- | --- | --- | --- | --- |
| `.fluxiq/global.sqlite` | `"automation.state".data` | rowid 6, `id=projects/<p>/recordings/<recording>/recording` | `$.recording.initialState.namespaces.web.values.elements.demo.password.value.visibleText`, `….value.text`, `….presentation.label`; `$.recording.initialState.presentation.visualFrames[0].layers[8].label`, `[1].layers[9].label` (1 each) | Recording session document | page text |
| the same | the same | rowid 7, `id=…/recordings/<recording>/snapshots/initial-state` | the same 5 paths under `$.initialState` | Recording initial state | page text |
| the same | the same | rowid 21, `id=projects/<p>/runtime/sessions/1ff37d38-…` | `$.session.metadata.inputs.auth-gate-password` (1); `$.session.metadata.inputs.web.secret.password` (1) | Runtime session record | declared secret |
| `…/projects/<p>/project.sqlite` | `state_paths.scalar_text` | rowid 36, `snapshot_id=web.snapshot.1789303050427 namespace=web path=elements.demo.password value_type=json` | `$.visibleText` (1); `$.text` (1) | State path index | page text |
| `…/projects/<p>/runtime/sqlite/global.sqlite` | none | — | `matching rows=0` | — | — |

The `-wal` sidecars are 0 bytes. The `-shm` files, 32768 bytes each, were not
scanned separately; the whole-file scan found no value in them.

### Recording lane: every flagged object

Project `f3c60b4b-2a1d-4136-971e-a42a8d0fcb36`; recording
`client.extension-6df4502b-ea44-4b11-bde3-8386e26f62da.1789303114740`.

| # | Object | Kind | Key paths | Source |
| --- | --- | --- | --- | --- |
| 1 | `…/objects/sha256/e7/be/e7be78f5….json` | State snapshot body, the initial state (`owner_kind=state_snapshot purpose=state_body`) | the same 5 page-text paths as Flow #5 | page text |
| 2–6 | `…/recordings/<recording>/objects/{0d6da864…, 1376509e…, 76ed2283…, 78779828…, ca72fff5…}.json` | Recording state snapshots | the same 5 paths in each | page text |

Not flagged, but holding the value:
- `global.sqlite` `"automation.state".data`, rowid 6 (`…/recording`) and rowid 7
  (`…/snapshots/initial-state`): the same page-text paths. No runtime session row
  holds it, since the recording lane runs no Flow.
- `project.sqlite` `state_paths.scalar_text`, rowid 36
  (`path=elements.demo.password`): `$.visibleText`, `$.text`.

**Recording lane total: 6 flagged objects plus 3 database rows, all page text.**
Nothing is from the declared secret, which the recording lane never passes to Core
(`run-scenario.ts:70`), and nothing is from typing.

### The code that writes each kind

**Page text → state snapshots, attempt snapshots, state index, recording documents**

| Step | Code |
| --- | --- |
| The fixture prints the value as page text | `apps/scenario-lab/src/scenarios/auth-gate/pages.ts:26`, `<dd data-testid="demo-password">${escapeHtml(authGateDemoCredentials.password)}</dd>` |
| The extension reads an element's visible text, with no sensitivity rule for non-controls | `apps/extension/src/content/describe-element.ts:50-54` (`descriptor.visibleText = text`), `:126-127` (`textContent`). The sensitive-control rule is only `readElementValue`, `:153-155` |
| Action results carry a page snapshot of interactive elements | `apps/extension/src/content/dom-snapshot.ts:70` (`interactiveElements: entries.map((entry) => entry.descriptor)`) |
| The domain projects each element into web state | `domain/src/recording/web-state/state-values.ts:85,94` (presentation `label` from `element.visibleText`), `:123-124` (`visibleText`, `text` in the stored blob). `isSensitiveElementDescriptor` (`:82`, `:125`) withholds only a control's `value` |
| The domain labels visual-frame layers | `domain/src/recording/web-state/visual-frame.ts:87,173`, from `elementLayerLabel`, `:206` (`element.name ?? element.visibleText ?? element.text …`) |
| Core stores the initial state as a state-snapshot body | `programs/automation-studio/storage/project/runtime-stream-store.ts:310` (`putStateSnapshot({ sourceKind: "recording", … snapshot: recording.initialState })`), `:340-351`; via `storage/project/content-store.ts:87-88` (`putJson`) → `:53-63` (`objects/sha256/…`) |
| Core indexes state paths | `runtime-stream-store.ts:360` (`insert into state_paths (… scalar_text …)`) |
| Core stores recording state snapshots per recording | `programs/automation-studio/storage/object-store.ts:47,58` (`putBytes` with `recordingId`) → `:375-383` (`recordings/<id>/objects`) |
| Core writes the recording session and initial state documents | `programs/automation-studio/runtime/service.ts:5364-5372` (`recording.json`, `snapshots/initial-state.json` through `ProgramJsonStore`), stored as `"automation.state"` rows (`programs/_shared/storage.ts:249-252`) |
| Core persists each command attempt, result snapshot included | `runtime/service.ts:269-276` (`settleAttempt` sets `attempt.result`), `:293-296` → `runtime/storage.ts:51-52,67-68` (`command-attempts/<id>/attempt.json`) |

**Declared secret → run inputs → session record and event chunks**

| Step | Code |
| --- | --- |
| The runner resolves the declared secret from the environment | `packages/test-runner/src/flow-lane/declared-secrets.ts` `resolveDeclaredSecrets`; Flow lane only (`run-scenario.ts:70`) |
| Copy 1, keyed by the secret id | `declared-secrets.ts:78-80` (`declaredSecretFlowInputs`: `[secret.id, secret.value]`). Its only non-test caller is `run-flow-lane.ts:130` |
| Copy 2, keyed by the binding path | `declared-secrets.ts:130-160` (`declaredSecretBindingInputs`, keyed by `web.secret.<key>`, with the prefix at `domain/src/output-nodes/secret-binding.ts:46`) |
| Both sent as run inputs | `packages/test-runner/src/flow-lane/run-flow-lane.ts:130` (`inputs: { ...declaredSecretFlowInputs(input.secrets), ...secretInputs, … }`) |
| Core copies inputs into the session metadata and writes the session | `programs/automation-studio/runtime/service.ts:2832` (`metadata: { …, inputs: input.inputs ?? {} … }`), `:2834` (`writeRuntimeSession`) |
| Core copies inputs into every run-envelope event | `storage/project/runtime-stream-store.ts:509-520` (`runDetailEnvelope`: `inputs: detail.inputs`), appended at `:173`, `:207` |
| Core writes event chunks as content objects | `storage/project/event-chunk-store.ts:55` (document `automation-studio.event-chunk.v1`), through the content store (`content-store.ts:87-88`) |

**Declared secret → resolved parameter → command attempt**

| Step | Code |
| --- | --- |
| The recorded password node asks for the value | `{ $state: { path: "web.secret.password" } }`, per `declared-secrets.ts:94-98` |
| Core resolves the binding before execution | `programs/automation-studio/nodes/parameter-bindings.ts:58` (`readAutomationStatePath(scope.state, value.$state.path)`) |
| The resolved parameters are the node's execution context | `programs/automation-studio/runtime/executor/node-execution.ts:101` (`parameters: resolvedParameters.values`) |
| Dispatched as a runtime command, whose attempt persists `command.parameters` | `runtime/service.ts:293-296` → `runtime/storage.ts:51-52` |
| Core's withholding covers the Automation Studio trace only | `programs/automation-studio/runtime/executor/trace-withholding.ts:1-44`. It rewrites `payload`, `outputs`, `inputs`, `values`, `metadata` and similar keys of the trace. It does not touch the framework runtime's `command-attempts` store, the runtime session record, or the run event stream |

### Revert

- `git -C F:\fxlab\fxlab-7263534 checkout -- packages/test-runner/src/coordinator.ts`:
  `checkout exit=0`.
- `pnpm -C F:\fxlab\fxlab-7263534 --filter @fluxiq-web-extension/test-runner build`:
  `rebuild exit=0 seconds=5.9156238`.
- `git -C F:\fxlab\fxlab-7263534 status --short` printed nothing (`status lines=0`).
- `hash=d2ce20caed917d7dbdbdecb7b19b5978bfd58eb9 head-blob=d2ce20caed917d7dbdbdecb7b19b5978bfd58eb9`;
  `dist has I_SECRET_KEEP_RUN_ROOT: 0`; `HEAD=6c22e220b42efa7c31af8eaeebad420a37010bcb`.

### Deleting the kept workspaces

- **Reparse points.** A non-following walk of `F:\fxlab-runs\secret\.work` found
  `reparse points before: 36`. They are the Core junctions each run creates:
  `core-workspace\packages -> F:\fxlab\!FluxIQ\packages\`, and
  `core-workspace\apps\web\node_modules\{.bin, fluxiq, next, react, sqlite3, …}`
  into `F:\fxlab\!FluxIQ`. Each was removed non-recursively with
  `[System.IO.Directory]::Delete(path, $false)`, leaving
  `reparse points after junction delete: 0`.
- **The first recursive delete failed part-way.** PowerShell 5.1's `Remove-Item`
  cannot handle paths over 260 characters, and the Flow's `…graph\source\flows\…flow.ts`
  exceeds that.
- **The retry succeeded.** After a second walk found
  `reparse points before final delete: 0`, `node fs.rmSync(…, { recursive: true })`
  printed `removed run-mtzstkh6-859ed277 exists-after=false` and
  `removed run-mtzsv0d1-cccba2de exists-after=false`; `.work entries after: 0`.
- **Core is intact:**
  `core packages intact: fluxiq=True contracts=True gateway=True fluxiq-dist=True next=True`,
  `core HEAD=5845f5d porcelain=0`.
- **No copy of the value remains in my files.** The value was counted, as UTF-8 and
  UTF-16, over every file under `F:\fxlab-runs\secret` (the two kept bundles) and
  every `i-secret*` scratch file:
  `value scan after deletion (F:\fxlab-runs\secret and i-secret scratch files): files=57 totalHits=0`.

## Fix design, partitioned by file

This is a design only; nothing here was implemented. The fixes are ordered by
what they close. Core changes cross the repository boundary, and the supervisor
decides how to brief them.

### 1. The fixture, the largest source (this repository)

**`apps/scenario-lab/src/scenarios/auth-gate/pages.ts:21-26`.**
- **Change:** stop rendering the demo password as page text. The sign-in page's
  "demo credentials" block puts a declared secret into every snapshot.
  - A page that shows its own password defeats every secret test: no product
    rule can know that a `<dd>`'s text is a credential.
  - Either drop the `demo-password` `<dd>`, since the runner already has the
    constant, or render a fixed placeholder.
- **Unit proof:** a scenario-lab test (`auth-gate/tests/`) asserting that the
  rendered sign-in HTML does not contain the password constant. Mutation:
  restore the `<dd>`.
- **Lab proof:**
  - `auth-gate` recording lane: attestation `findingCount` 0;
  - `auth-gate --flow`: the 6 page-text objects and the 3 page-text database rows
    are gone, which a kept-workspace re-run of this probe shows by key path.

### 2. The runner's duplicate input (this repository)

**`packages/test-runner/src/flow-lane/run-flow-lane.ts:130` and
`flow-lane/declared-secrets.ts:78-80`.**
- **Change:** send only the binding inputs (`secretInputs`, keyed `web.secret.*`),
  and remove `declaredSecretFlowInputs` from the run's inputs.
  - Nothing reads the id-keyed copy: a grep finds no non-test caller other than
    `:130`, and the Flow's nodes ask only for `web.secret.<key>`.
  - This halves the value's copies in the session record and event stream.
  - It does not remove them; that needs fix 3.
- **Unit proof:** update `flow-lane/tests/declared-secrets.test.ts:33,72`, which
  pin `declaredSecretFlowInputs`, and add a `run-flow-lane` wiring row. The row
  asserts that the inputs passed to `executeRecordedFlowRun` hold no secret-id key.
  Mutation: re-add the spread.
- **Lab proof:** `auth-gate --flow` still passes pairing, and its password node
  still types (`web.dom.type:succeeded` twice).

### 3. Core: run inputs must not be persisted in clear (FluxIQ Core)

**`programs/automation-studio/runtime/service.ts:2832-2834` (session metadata) and
`storage/project/runtime-stream-store.ts:509-520` (`runDetailEnvelope` `inputs`).**
- **Change:** Core treats a run's supplied inputs as run-time data of unknown
  sensitivity, as `trace-withholding.ts:29-34` already argues for trace values.
  - Persist the input keys with each value replaced by
    `AUTOMATION_STUDIO_WITHHELD_VALUE`, or persist the inputs sealed through the
    content store's existing `protect: true` path (`content-store.ts:48-51`).
  - Keep the unwithheld inputs in memory for the run only.
  - This is a behaviour and compatibility change for any reader of
    `metadata.inputs` or event `payload.inputs`, so it needs a compatibility note.
- **Core unit proof** (vitest, `--no-file-parallelism`):
  - a service row: create a run session with inputs, and assert that the persisted
    `"automation.state"` session row and every runtime event chunk hold the
    withheld marker, never the input value;
  - a stream-store row for `runDetailEnvelope`.
  - Mutation: restore `inputs: input.inputs`.
- **Lab proof:** `auth-gate --flow` with a kept workspace. No `inputs.*` key path,
  in any event chunk or in `global.sqlite` session rows, holds the value.

### 4. Core: the runtime command-attempt store persists resolved parameters (FluxIQ Core)

**`runtime/service.ts:269-276,293-296` and `runtime/storage.ts:51-52`,** fed by
`programs/automation-studio/runtime/executor/node-execution.ts:101`.
- **Change:** apply the trace-withholding rule to the command attempt before it is
  persisted.
  - The executor already records what resolution supplied
    (`automationStudioTraceWithholding().record`,
    `trace-withholding.ts:83-96`). That withholding must travel with the dispatched
    command, so the framework runtime can apply it to the saved attempt: its
    `command.parameters` and the prose in `result.message`.
  - The seam must stay generic: the framework must not learn `web.secret.`, as
    `trace-withholding.ts:29-34` requires.
  - One shape: a dispatch-context field naming the withheld values, applied by
    `persistCommandAttempt`.
- **Core unit proof:**
  - a runtime service row: dispatch a command whose parameter came from a
    `$state` binding, and assert that `attempt.json` holds the withheld marker at
    `command.parameters.text`, while an authored parameter persists unchanged;
  - an executor row proving the withholding reaches dispatch.
  - Mutation: skip the rewrite in `persistCommandAttempt`.
- **Lab proof:** `auth-gate --flow`, kept workspace: no
  `$.attempt.command.parameters.*` path holds the value, and the password node
  still types, `web.dom.type:succeeded`.

### 5. The attestation must scan what it now skips (this repository)

**`packages/test-runner/src/secret-leak-attestation.ts` (scanner) and
`redaction-attestation/run-redaction-scopes.ts`.**
- **Change:** a workspace scope must not count a SQLite database (`*.sqlite`, and
  its `-wal` and `-shm` files) as skipped binary.
  - Scan its bytes for each literal, as UTF-8 and UTF-16LE. The raw-byte search
    this probe used finds values stored as SQLite TEXT.
  - Or report such a file as a finding category `unscanned-store`, rather than
    only in `skippedBinaryFiles`.
  - This run's databases held the value in 4 rows that the attestation never
    reported.
- **Unit proof:** a `redaction-attestation/tests/` row that plants a literal inside
  a real SQLite file (created with the test-runner's own dependency, or a
  byte-level fixture) and asserts a finding. Mutation: restore the binary skip.
- **Lab proof:** before fixes 1–4, `auth-gate` recording lane reports
  `findingCount` 8 or more (6 objects plus the databases). After fixes 1–4, both
  lanes report 0.

### 6. Defence in depth, optional (this repository)

**`domain/src/recording/web-state/state-values.ts:85,123-124` and
`apps/extension/src/content/describe-element.ts:50-54`.**
- **Why it is not the fix here:** a page's visible text is page data, and no
  generic rule can tell a credential in a `<dd>` from a product name. Fix 1 is the
  real fix.
- **The rule it would add:** the domain drops `visibleText` and `text` for an
  element whose descriptor marks it sensitive (`data-sensitive` attribute), not
  only `value`. Pages that label a secret-bearing display element that way would
  then be covered.
- **Unit proof:** a `state-values` test row with a `data-sensitive` non-control
  element.
- **Content-harness proof:** a row showing the descriptor keeps the attribute and
  withholds its text.

### Proof order

1. Fixes 1 and 2 need only this repository's unit tests plus one Lab pair: the
   `auth-gate` recording lane and `--flow`, alone.
2. Fixes 3 and 4 need Core's tests, a Core build, and the same Lab pair re-run
   with a kept workspace, as this probe did.
3. Fix 5's Lab proof should run before 1–4, to show that it catches the database
   rows.

Criterion 2's leak row passes only when both lanes report `findingCount` 0 with
fix 5 in place.

## Not verified

- **A single observation per lane.** Each lane ran once; the counts match Stage 2's
  13 and 6.
- **Other stores.** Only the `.fluxiq` workspace was examined, as the attestation
  scopes it. Not examined:
  - the Next.js `core-workspace` build output and `logs/`, which are in the
    bundle, and the bundle scan found 0 hits;
  - the browser profile, where page text could be cached;
  - the `-shm` sidecars, as separate SQLite pages. The whole-file count found
    nothing in them.
- **`project.sqlite` FTS or shadow tables.** Every table in `sqlite_master` was
  queried (79 and 77), and only `state_paths` matched.
- **The Core writer chain for the 5 `recordings/<id>/objects` state files,**
  followed only to `object-store.ts:47,58,375-383` and the recording index's
  `stateRef`s. The exact call site that snapshots each recording state update was
  not traced.
- **Whether other scenarios leak declared secrets.** `sensitive-input` passed its
  attestation 3 of 3 in Stage 2. It runs on the recording lane only, so fixes 3
  and 4 are untested there.
- **No fix was implemented or tested.** The proofs above are designs.

## Open questions or contradictions found

1. **The auth-gate fixture tests the wrong thing.** Its sign-in page displays the
   declared secret, so criterion 2's leak row can never pass on auth-gate while
   `pages.ts:26` renders it. Fix 1 is a fixture change, but the other three routes
   are real product defects: run inputs and resolved parameters persisted in
   clear.
2. **Core's trace withholding has a documented gap.** `trace-withholding.ts:16`
   says "the whole trace is persisted by `runtime/service.ts`", and it is
   withheld. But the same run's resolved value reaches `command-attempts` and the
   session record, which the module does not cover.
3. **The attestation's `skippedBinaryFiles` hides a leak.** SQLite stores hold
   the value in plain TEXT, so a `passed` attestation with `skippedBinaryFiles>0`
   is not proof of absence.
4. **The runner's two input copies** (`auth-gate-password` and
   `web.secret.password`) look like an earlier seam (`declaredSecretFlowInputs`)
   that the binding seam replaced but did not remove.
