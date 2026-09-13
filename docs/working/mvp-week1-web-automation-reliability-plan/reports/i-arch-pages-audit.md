# i-arch-pages-audit — which architecture pages are not yet in their finished Week 1 state

Read-only audit of the eight pages under `docs/architecture/`, at this repository's
HEAD `5bad6c3` (working tree as of 2026-09-13), against the code they cite. Core
citations are to the working tree at `F:\!FluxIQ`. Paths without a prefix are
relative to `F:\!FluxIQWebExtension`.

## Outcome

Done. Six of the eight pages need edits. `page-evidence.md` needs only small touches.

- **`testing-facility.md` is the furthest from its finished state:**
  - two claims are now false and would mislead an operator: the auth-gate page
    showing its password, and an omitted `outcome` meaning `succeeded`;
  - one claim is false about the lab itself: "isolated mode does not synthesize
    or persist a FluxIQ Flow";
  - two stale Core and extension facts (the 10 s project window, and the recorder
    that "latches idle");
  - a fixture count that is off by three;
  - it has no description at all of the Flow lane, the bench, the lane rules, the
    run leak check or the recording checks, and no other authored doc has one.
- **`extension-client.md`** is accurate where it speaks. It omits three pieces of
  behaviour committed this session:
  - the recording starts once, and only after its start was sent;
  - a page change is sent before an executable event;
  - a wait is proposed before a click whose target a page change produced.
- **`element-identity.md`** states a scan bound of 600. The code has used 5,000
  since 2026-09-12.
- **`sensitive-values.md`** does not describe the declared-secret run input, or
  Core's withholding of it at rest.
- **`web-capabilities.md`, `repository-layout.md`, `failure-taxonomy.md`,
  `page-evidence.md`:** small gaps, and stale "verified on" dates.
- **Stale line citations: none.** No page cites a line number; a search for
  `<file>.<ext>:<n>` over `docs/architecture/` found none. Every citation is by
  path or symbol, and those spot-checked below resolve at HEAD.

## Findings, ranked by how misleading each is

| Rank | Id | Page | One line |
| --- | --- | --- | --- |
| 1 | T1 | testing-facility | The auth-gate sign-in page is said to print the password; it shows a placeholder |
| 2 | T2 | testing-facility | "an omitted outcome means `succeeded`": every lane now judges presence only |
| 3 | T3 | testing-facility | "isolated mode does not synthesize or persist a FluxIQ Flow": `--flow` does; the Flow lane and bench are undocumented |
| 4 | T4 | testing-facility | The demo and provider-secret leak checks are said to skip databases and binaries; SQLite is scanned |
| 5 | T5 | testing-facility | Core's recording window is said to be 10 s; it is 300 s. The recorder is said to latch idle; it retries |
| 6 | E1 | extension-client | The recording start omits "only after the send settled" and "starts once" |
| 7 | E3 | extension-client | The mapper's late-target wait proposal is undescribed anywhere |
| 8 | T6 | testing-facility | "22 deterministic fixtures": the registry holds 25 |
| 9 | T7 | testing-facility | The finite extension suite is described without the content harness, which does use Scenario Lab |
| 10 | S1 | sensitive-values | No account of a declared secret travelling to Core as a run input, withheld at rest |
| 11 | I1 | element-identity | "600 nodes scanned": 5,000 |
| 12 | E2 | extension-client | A pending page change is sent before an executable event; undescribed |
| 13 | R1 | repository-layout | Package commands omit the content harness |
| 14 | T8 | testing-facility | Declared secrets: no word on the node path, the one-to-one pairing, or uploads |
| 15 | W1, I2 | web-capabilities, element-identity | "must author a wait first": a recording now proposes it |
| 16 | T9, T10 | testing-facility | Recording-lane pagination; auth-gate row wording |
| 17 | R2, P1, F1, W2, S2, I3, P2 | several | Small omissions and stale "verified on" dates |

## Findings by page

Each section is self-contained, so a docs worker can own exactly one page.

### `docs/architecture/testing-facility.md`

**T1 (rank 1). The auth-gate password is said to be printed on its page.**
- **Page:**
  - `:705` says the value is one "which its sign-in page states in plain sight";
  - `:707-709` says "every scenario is a deterministic loopback fixture whose accepted
    credential is printed on its own page".
- **Code:**
  - `apps/scenario-lab/src/scenarios/auth-gate/pages.ts:33` renders
    `authGatePasswordPlaceholder`;
  - `constants.ts:21` defines that placeholder, and `constants.ts:9` says the page
    states the username only;
  - `tests/scenario.test.ts:222` checks the placeholder is not the password, and
    `:228` checks the page withholds the password.
- **Also wrong at `:705`:** the row is named "(corpus row W19)". The sign-in row is
  W18. W19 is the `expired` variant (`packages/test-runner/src/bench/corpus/week1.ts:47-48`).
- **Fix:**
  - the page shows a placeholder, and the value reaches a run only through
    `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD`;
  - name W18, and W19 if its variant also signs in;
  - drop "printed on its own page". Keep the point that these are fixture
    credentials.
- Do not quote the value.

**T2 (rank 2). An omitted `outcome` is said to mean `succeeded`.**
- **Page `:672-677`:** "an omitted outcome means `succeeded`".
- **Code:**
  - `packages/test-runner/src/flow-lane/expectations.ts:8-10` and `:15-18`: an entry
    with no `outcome` matches any attempt of its type;
  - `packages/test-contracts/src/scenario.ts:91-92`: "every lane judges the entry on
    the attempt's presence alone";
  - the existing and clone lanes call the same function
    (`packages/test-runner/src/existing-flow-run.ts:14,110`).
- **Also missing from this paragraph:**
  - **The recordable-action check.** A manifest whose `expected.actions` names an
    action its recording script cannot yield is refused
    (`packages/test-contracts/src/validation.ts:183-197`, table in `recordable-actions.ts`).
    Its paginated-extract rule counts a Next click.
  - **The rejection category.** A contract rejection fails as `fixture.invalid`,
    whether thrown at registry import or by the runner's own check
    (`packages/test-runner/src/scenarios.ts:12,31-44`). Such a failure has no run
    bundle (ledger part 37, `g-lane-consistency`).
- **Fix:** restate the rule, and add the two checks.

**T3 (rank 3). The Flow lane and the bench are absent, and one sentence denies the Flow lane exists.**
- **Page:**
  - `:180-183`: "isolated mode does not synthesize or persist a FluxIQ Flow";
  - `:805-809`: "those two verified lanes do not prove persisted Flow execution";
  - `:153-178` lists five target modes and no lanes.
- **Code:**
  - `packages/test-runner/src/commands.ts:40` says "--flow builds a Flow from the
    run's own recording", refused on the existing and clone targets;
  - `:42` says `--variant` requires `--flow`;
  - Core's proposal is read in `flow-lane/recording-flow-proposal.ts:22-26`, and the
    run is in `flow-lane/persisted-flow-run.ts`;
  - `lane-rules/built-flow.ts:15-17` fails a Flow-lane run that built no Flow as
    `environment.missing`.
- **No authored doc covers any of this.** `docs/` holds only `architecture/` and
  `working/`, and only this page mentions a lane.
- **The section to add covers these, each with its source:**
  - **Recording lane and Flow lane,** and `--workflow` / `--variant`:
    `commands.ts:35-42`; `run-scenario.ts:201-205` arms a Flow-lane variant only
    after its reset.
  - **Every Flow-lane run starts on the start page:** `flow-lane/reset-scenario-lab.ts:8`.
  - **Lane rules** (`lane-rules/index.ts:1-7`):
    - `core-identity.ts:4-11`: a Flow-lane or clone run always gets a Core identity;
    - `built-flow.ts:5-17`;
    - `probe-step.ts:13-14`: the Core probe types only into a `type` step on the
      start page;
    - `final-state-facts.ts:4-11`: a negative run is not judged on the goal's
      success facts.
  - **Recording completeness,** a run whose recording Core holds short fails:
    `run-expectations/recording-completeness.ts`, called at `run-scenario.ts:318`.
  - **Discard windows,** a discard counts only between `from` and `until`, and the
    run publishes what was excluded: `flow-lane/recording-discards.ts:22-38,57,121-122`.
    A read that fetched no snapshot, or found no audit log, is fetched once more
    (`run-scenario.ts:419-427`).
  - **Comparison status per attempt:** `flow-lane/persisted-flow-run.ts:25-32,191-200`,
    published at `run-flow-lane.ts:190`.
  - **Evidence sizes,** one reader for a run and its bench row:
    `run-evaluation/flow-lane-evidence-sizes.ts:1-25`.
  - **The run leak check:**
    - `run-scenario.ts:451` calls `redaction-attestation/attest-run-redaction.ts:102`;
    - its scopes are the bundle and the Core workspace, the latter bounded by
      `writtenSince` on `persistent-isolated` (`attest-run-redaction.ts:5-15`);
    - SQLite is scanned as bytes in three encodings and cell by cell
      (`secret-leak-attestation.ts:40-52,136-219`; `sqlite-store-reader/`);
    - an unscannable store is an `unscanned-store` finding (`:24,179-214`);
    - the limits are `SECRET_LEAK_ATTESTATION_RUN_LIMITS`.
    - **Known limit:** a literal split across pages SQLite has already freed is
      missed (ledger part 36).
  - **The bench:**
    - `bench/run-bench.ts:91`;
    - corpora `bench/corpus/smoke.ts` and `week1.ts`, which has 29 rows;
    - rate metrics `packages/test-contracts/src/bench-report.ts:19-20`
      (`flowCreationSuccess`, `initialExecutionSuccess`, `falseSuccess`,
      `failureClassificationAccuracy` and others);
    - a row's cause is its own category's message (`bench/failure-cause.ts`,
      `read-run-bundle.ts`);
    - `lab compare --halves` (already at `:1008`).
  - **Uploads on the Flow lane:** each node asking under `web.upload.<key>` is
    checked against the domain's key for its control, and the file the recording
    lane uploads is supplied (`flow-lane/declared-uploads.ts:7-23`,
    `run-flow-lane.ts:129,137-138`).
  - **Recording-lane pagination:** an `extract` step with `pagination` clicks `next`
    as trusted input (`scenario-steps/extract-records.ts:46-70`,
    `run-scenario.ts:294`, `test-contracts/src/scenario.ts:26-27`).
- **Skip in flight:** how W05 `short-catalog` is judged on the Flow lane
  (`i-w05-short-catalog`).

**T4 (rank 4). The leak checks are said to skip databases and binaries.**
- **Page:**
  - `:451-452`: `demo:llm:setup` scans "while excluding intentional database and
    binary storage";
  - `:1126`: the post-run provider-secret attestation "does not inspect explicit
    binary formats".
- **Code:**
  - `packages/test-runner/src/demo-llm-attestation.ts:19-25`: the setup scan covers
    `fluxiq-root/.fluxiq`, which holds Core's SQLite databases, under
    `SECRET_LEAK_ATTESTATION_RUN_LIMITS`;
  - `secret-leak-attestation.ts:40-49`: a SQLite store is read "byte for byte, never
    skipped as binary".
- **Still true:** other known binary extensions are skipped (`:35,135`).
- **Fix:** say databases and their `-wal`, `-shm` and `-journal` files are scanned,
  and only other binaries are skipped.
- **Also state the runtime requirement:** the reader runs Node's `node:sqlite` in a
  child process started with `--experimental-sqlite`
  (`packages/test-runner/src/sqlite-store-reader/read-sqlite-stores.ts:28,41,99`).

**T5 (rank 5). The 10 s Core window, and the recorder that "latches idle".**
- **Page `:309-311`:** Core accepts a start only while the Studio context is "under
  ten seconds old (`resolveClientRecordingProject`, `freshnessMs` 10_000)".
  - **Core:** `F:\!FluxIQ\apps\web\src\lib\automation-studio-context.ts:64` sets
    `AUTOMATION_STUDIO_CONTEXT_LEASE_MS = 300_000`, the default `freshnessMs` at `:70`.
  - `:56-63` records that it was 10 s.
- **Page `:313-316`:** "its own 750 ms local fallback never fires and the recorder
  latches idle, which no amount of polling recovers".
  - **Extension:** a `recording.project_required` that carries an `activeProjectId` is
    transient, and is re-sent after 400 ms, 1.2 s and 2.4 s
    (`apps/extension/src/background/connection/recording-start/handshake.ts:16-23,34`).
  - `extension-client.md:417-420` already says so, so the two pages contradict each
    other.
  - That code dates from `ab736a1`, 2026-09-12.
- **Still true:**
  - the isolated lane reselects the project before starting
    (`packages/test-runner/src/run-scenario.ts:270-278`);
  - the clone lane does not: its branch starts recording at `:244`, and selects its
    project only once, at import (`:185`).
- **Fix:** restate the reason for the reselect as it now stands (a stale context
  still refuses a start), or cut it to "the lane reselects so acceptance does not
  depend on startup time".

**T6 (rank 8). The fixture count.**
- **Page:** `:715` and `:805` say 22 fixtures (12 foundational and 10 corpus).
- **Registry:** 25 (`apps/scenario-lab/src/registry.ts:23-25,52-54`; `types.ts:7-9`).
- **Missing from both tables,** all added in `ab736a1` on 2026-09-12:
  - `storefront-checkout` (`manifest.ts:53`, "Storefront checkout");
  - `admin-console` (`manifest.ts:80`, "Admin console");
  - `member-directory` (`manifest.ts:75`, "Member directory").
- **Fix:** add a row for each, with its corpus rows if any, and correct both counts.
- `:761`'s "eleven of the twelve" was not checked.

**T7 (rank 9). The finite extension suite.**
- **Page:**
  - `:794-803` lists five things "the implemented specs verify";
  - `:805` says the standalone specs do not use the Scenario Lab registry;
  - `:810-811` says the facility does not prove cross-frame action behaviour.
- **Code:**
  - a second, larger Playwright suite exists: the content harness,
    `apps/extension/e2e/playwright.content.config.ts`, with 25 specs under
    `apps/extension/e2e/content/tests/` (`frames`, `recorder-trust`, `upload-dialog`,
    `failures`, `identity-*` and more);
  - it imports the Scenario Lab registry and server
    (`apps/extension/e2e/content/harness.ts:30-32`);
  - `failures.spec.ts:115-120` opens `auth-gate`;
  - its script is `apps/extension/package.json:10` (`test:content`).
- **Fix:**
  - describe the content harness and its command;
  - keep `test:e2e` (`package.json:12`) as the finite extension suite;
  - re-check the "cross-frame" sentence.
- **Caution:** the ledger says the content harness does not drive the background
  worker, so child-frame addressing by path (`runtime/frame-address.ts`) is not
  proven by it. Do not overclaim.

**T8 (rank 14). Declared secrets, and uploads beside them.**
- **Page `:695-701`, "supplies the value to the Flow run":**
  - **Correct:** the variable name (`flow-lane/declared-secrets.ts:32-33`) and
    `environment.missing` (`:62`).
  - **Omitted:** each value is supplied once, under the `web.secret.<key>` path its
    node asks for. It is paired with its declaration by control, one to one, and a
    pairing that fails stops the run before the Flow starts (`declared-secrets.ts:102-121`,
    `run-flow-lane.ts:121-138`).
- **Core side:** Core 0.4.0 (`6621d66`) keeps a run's input keys and withholds their
  values at rest (ledger, "Core withholding").
- **`:713`:** "joins the run's evidence redaction list" is correct (`run-flow-lane.ts:36`).
- **Fix:** add the path rule, the pairing, the Core withholding, and uploads
  (see T3).

**T9 (rank 16). Step operations.**
- **`:659-661`** matches `packages/test-contracts/src/scenario.ts:29-44`.
- **Add:** `extract` with `pagination` records Next clicks (see T3).

**T10 (rank 16). The auth-gate fixture row, `:749`.**
- "Sign-in form with fixture-only demo credentials" still matches the heading and
  username (`pages.ts:29-30`).
- **Fix:** say the password row shows a placeholder, alongside T1.

### `docs/architecture/extension-client.md`

**E1 (rank 6). The recording start.**
- **Page `:409-411`:** "A `client.start_recording` waits 750 ms for FluxIQ to answer;
  on silence the recorder starts locally so no user action is lost."
- **Omitted:**
  - **After the send settles.** The recorder starts locally only once that attempt's
    send has settled, so nothing recorded can reach FluxIQ ahead of its start
    (`background/connection/recording-start/handshake.ts:8-11,48-49`).
  - **Only once.** Core's `server.start_recording` may race the local start, arrive
    twice, name another recording, or cross this client's own Stop. `beginAccepted`
    and `beginOnce` decide each case (`background/connection/active-recording.ts:11-13,205-213,227,242-247`).
  - **Core's side.** `server.start_recording` is the acknowledgement
    (`handshake.ts:7`), and Core orders a client's start with the messages after it
    (Core `g-core-start-order`).
- **Correct:** the values, 750 ms and 400, 1,200 and 2,400 ms (`handshake.ts:29,34`),
  and the refusal cases at `:412-429`.

**E2 (rank 12). A page change is sent before an executable event.**
- **Page:**
  - `:304` lists "batched DOM mutation counts";
  - `:326-334` lists only what flushes pending *typed text*.
- **Code:** `apps/extension/src/content/recorder.ts:8-10,22-23,55`. A pending
  `dom.mutation` batch goes out before any event of an executable kind (`dom.click`,
  `dom.input`, `dom.change`, `dom.submit`, `dom.keydown`). Otherwise the batch
  flushes after 500 ms (`:36`).
- **Why it matters:** E3 depends on it.

**E3 (rank 7). The recording mapper's second proposal: a wait before a late target.**
- **Page:** `:516-573` describes only the click landing claim. No page under
  `docs/architecture/` mentions the wait (searched: `late-target`, "propose a wait",
  "wait before a click").
- **Code:**
  - **The rule:** `domain/src/recording/proposals/late-target-wait.ts:1-17,35-52`. A
    recorded DOM addition proposes `web.dom.wait_for_selector` on the selector of
    the next executable `web.dom.click`, when that click is in the same top document
    and no evidence in between names another URL.
    - It carries no `sourceInputIds` and no `expectedConfirmation`.
    - A click recorded in a child frame proposes nothing.
  - **Wiring:** it is proposed from the mutation's own entry, never the click's
    (`domain/src/web-panel-host.ts:135`).
  - **Why stored order matters:** Core stores a client's recording messages in
    arrival order (Core `949fbb4`, `client-gateway/client-recording-write-order.ts`).
    Without that, the late click was stored before the addition that revealed it.
  - **The pin:** `domain/src/tests/core-gateway-recording-order.test.ts`.
- **In flight:** `late-target-wait.ts:15`, the comment about the wait's timeout, is
  being changed by `g-core-dispatch-deadline`. Describe the rule, not the timeout,
  or dispatch after that worker reports.

**Verified correct:**
- the client message list (`gateway-session.ts:280`, `active-recording.ts:195,311`,
  `recorded-event-intake.ts:174`, `recording-evidence.ts:138,156`; `client.hello` via
  `gateway-session.ts:116,239`);
- click pairing `:318-324` (`pointer-click-filter.ts:1-39`);
- the typed-text flush `:326-334` (`content/dom-events.ts:126,204`);
- navigation timings (`navigation-recorder.ts:7,10,12`);
- the snapshot caps 50,000, 2,000 and 1,500 (`content/dom-snapshot.ts:46-47`,
  `domain/src/recording/web-state/element/selection.ts:16`);
- the 32 `following` entries (Core `runtime/service/recordings/proposal-candidates.ts:17`);
- confidence `0.95` (`domain/src/web-panel-host.ts:192`).

**Skip in flight:** the tab recorder rules at `:380-407`. Why W15's Flow starts
with a close is under `i-w15-w28-flow-order`.

### `docs/architecture/web-capabilities.md`

**W1 (rank 15). Dynamic elements, `:137`.**
- **Page:** "a Flow against a page that renders late must still author a wait before
  the action".
- **Code:** a recording that saw the page add the target now proposes that wait
  (`domain/src/recording/proposals/late-target-wait.ts:1-17`, `domain/src/web-panel-host.ts:135`).
- **Still true:** the acting verbs do not wait. The row stays Partially supported.
- **Fix:** add the proposal, and link to E3's section once it exists.

**W2 (rank 17). The header date.**
- `:5-11` says "re-verified against source on 2026-09-12 after Wave 3".
- The page was changed on 2026-09-13 (`b274fb4`, `9efd8c2`, `d775b5e`).

**Verified correct:**
- the six observe-only verbs exempt from the unsupported-page refusal, `:112`
  (`runtime/action-runner.ts:339-347`);
- the switch lookup by newest tab at an exact path, `:132` (`runtime/browser-tab.ts:104-116`);
- the switch's 100 ms poll and 10 s default wait (`:49,51,143`);
- the 8-tab history, `:133` (`runtime/automation-tab.ts:13`);
- the confirmation table, `:351-381` (`background/connection/runtime-status.ts:28,41,122-125,154`);
- the child-frame table, `:407-413` (`runtime/frame-address.ts:35-36,84,97`).

**Skip in flight:**
- the upload row's validation text, `:135` ("the names the input ended up holding
  are read back … and compared"), which `f-upload-validation-names` changes;
- the switch and close tab rows, `:132-133` (W15).

### `docs/architecture/element-identity.md`

**I1 (rank 11). The candidate scan bound, `:117`.**
- **Page:** "bounded to 600 nodes scanned and 60 candidates kept".
- **Code:**
  - `apps/extension/src/content/identity/candidates.ts:106` sets `MAX_SCANNED = 5_000`;
  - `:21-26` and `:90-99` record that it was 600, and why that enumerated nothing
    on large pages;
  - it changed in `ee25ac9` on 2026-09-12;
  - `MAX_CANDIDATES = 60` is correct (`:108`).
- **Also undescribed:** the pool reports `examined` and `truncated` (`:56-69`), which
  separates "no such control" from "stopped looking".

**I2 (rank 15). Limits, `:193-195`.**
- "a Flow against a page that renders late must author a wait first". Same fix as
  W1.

**I3 (rank 17). The header date, `:5`.**
- It says "verified against source on 2026-09-12".

**Verified correct:** `TARGET_SCORE_FLOOR` 0.35 (`identity/score.ts:127`),
`TARGET_SCORE_MARGIN` 0.2 (`:136`), and `TARGET_VETO_FLOOR` 0 (`identity/veto.ts:130`).

### `docs/architecture/sensitive-values.md`

**S1 (rank 10). A declared secret's path through Core is undescribed.**
- **What the page covers:** capture, the wire and the readers.
- **What it does not say:**
  - a Flow run types a withheld value from a run input bound at `web.secret.<key>`;
  - Core 0.4.0 keeps the key and withholds the value at rest: the run session's
    `metadata.inputs`, run summaries, the trace, and saved command attempts'
    `command.parameters`, `result.message`, `result.error` and `attempt.message`
    (Core `6621d66`, ledger "Core withholding").
- **Known gap to state:** a node that copies an unbound input into another key leaves
  it in clear at that copy.
- **The page-text route:** `:171-174`, "Not a rule about page text", is the gap
  `i-secret-in-workspace` measured. A page showing a secret puts it into every
  state snapshot and Core's workspace. Fix 6, a sensitive-display rule, was deferred
  to the Phase 1.6b ranking. Say so there.
- **Cross-link:** testing-facility's run leak check (T3).

**S2 (rank 17). The header date, `:5`.**
- It says "verified against source on 2026-09-12". Uploads were added 2026-09-13.

**Verified correct:**
- a file input's `value` is dropped from the fingerprint (`domain/src/output-nodes/payloads.ts:101-102`);
- `confirmedValue` (`background/connection/runtime-status.ts:154`);
- `webAutomationSecretSafeValidation` (`domain/src/client/gateway-mapping.ts:322`);
- `describeFieldValue` (`content/actions/value-redaction.ts:25`);
- `sanitizedEvidenceElement` (`domain/src/runtime/llm-evidence/elements.ts:82`).

**Dependent:** once `f-upload-validation-names` lands, add under "The Wire" that the
upload post-condition compares names but quotes none (thirty-second dispatch
decision).

### `docs/architecture/repository-layout.md`

**R1 (rank 13). The content harness is absent from the commands.**
- **Page:** `:232-246` lists domain and extension `check`, `test` and `build`.
- **Missing:** the content harness, which every brief uses:
  `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2 <spec>`
  from `apps/extension`, and the `test:content` script (`apps/extension/package.json:10`).
- **Also missing:** the `EXTENSION_TEST_BUILD_LABEL` / `DOMAIN_TEST_BUILD_LABEL`
  labels, which appear only in passing at `:100`.
- **Verify first:** the briefs' binding rules say the
  `pnpm --filter … test:content --` form finds no tests. Ledger part 21
  (`g-integration-small-fixes`) says the script was fixed. I did not run either.

**R2 (rank 17). The domain tree omits `src/recording/proposals/`.**
- That is where the W25 wait rule lives (`:38-46`). Optional.

**Verified correct:**
- `domain/src/web-panel/` exists (`output-nodes.ts`);
- `lab:test` is part of `pnpm check` (`package.json:11,50`);
- `webPanelHostModulePath` (`packages/test-runner/src/environment.ts:47`);
- `domain:dist` (`packages/test-runner/package.json:10-12`).

### `docs/architecture/failure-taxonomy.md`

**F1 (rank 17). The header date, `:5`.**
- It says "verified against source on 2026-09-12". The page changed on 2026-09-13
  (`d775b5e`, `b274fb4`).

**Verified correct:**
- the closed set has 15 codes (`domain/src/runtime/failure/codes.ts`, 15 `"web.` values);
- the worker-side producers, `:150-165`: `runtime/browser-tab.ts:69,83,162,205,231,244`;
  `browser-download.ts:49,60`; `action-runner.ts:82-89,169,309,335`;
  `command-router.ts:2,33`; `frame-address.ts:84,97`; `action-results.ts:98`;
- the cited test files, `:181-184`, exist;
- `RunEvaluation.automationFailureReported` (`packages/test-contracts/src/evaluation.ts:85`).

**Optional:** under "Two Axes", `:208-218`, name `fixture.invalid` for a rejected
manifest (`packages/test-runner/src/scenarios.ts:31-44`).

**Skip in flight:** whether W25 `too-slow` reports Core's dispatch timeout or the
client's `web.action.timeout` (`g-core-dispatch-deadline`). The page says nothing
about it today. Revisit after that worker reports.

### `docs/architecture/page-evidence.md`

**P1 (rank 17). `:127-128`, "The action path is top-frame only unless a command addresses a frame".**
- Still true.
- A command now addresses a child frame by id or by path (`runtime/frame-address.ts:35-36`).
- Link to `web-capabilities.md#child-frames`.

**P2 (rank 17). The header date, `:7`.**
- It says "verified against source on 2026-09-12".

**Verified correct:**
- `apps/extension/src/shared/present.ts` and `domain/src/page-evidence/capture.ts` exist;
- the 150 ms frame timeout (`background/connection/dom-snapshot.ts:77`);
- thirty `evidence.*` paths (`domain/src/recording/domain.ts`, 30 occurrences);
- the 6,000 and 12,000 byte budgets (`domain/src/runtime/llm-evidence/limits.ts:23-24`).

## Suggested docs dispatch (one worker per page)

| Worker scope | Findings | Wait for |
| --- | --- | --- |
| `testing-facility.md` | T1-T10 | nothing; T3 is the bulk. Leave W05 `short-catalog`'s judgement until `i-w05-short-catalog` reports |
| `extension-client.md` | E1-E3 | `g-core-dispatch-deadline`, if E3 describes the wait's timeout; the W15 fix, if the tab-recorder rules change |
| `web-capabilities.md` | W1, W2 | `f-upload-validation-names` for the upload row; the W15 fix for the tab rows |
| `sensitive-values.md` | S1, S2 | `f-upload-validation-names`, for the name rule |
| `element-identity.md` | I1-I3 | nothing |
| `repository-layout.md` | R1, R2 | nothing; R1 must run the command it documents |
| `failure-taxonomy.md` | F1 | `g-core-dispatch-deadline` |
| `page-evidence.md` | P1, P2 | nothing |

## What changed and why

Only this report was written. Nothing else was edited, because the brief is
read-only.

## Commands run and observed results

All were read-only. No build, test or Lab command ran.

- **`wc -l docs/architecture/*.md`:**
  - element-identity 195, extension-client 599, failure-taxonomy 225,
    page-evidence 164;
  - repository-layout 283, sensitive-values 179, testing-facility 1126,
    web-capabilities 509.
- **`git log`, over recent commits and each path:**
  - the architecture pages last changed in `b274fb4` (2026-09-13 07:20);
  - code commits since then: `d0d81c3` and `69f40c1`;
  - `admin-console`, `member-directory` and `storefront-checkout` were added in
    `ab736a1`;
  - `recording-start/refusal.ts` and `handshake.ts` were added in `ab736a1`;
  - `MAX_CANDIDATES` was last changed in `ee25ac9`.
- **`ls`** of `apps/scenario-lab/src/scenarios/` gave 25 directories. Also listed:
  `packages/test-runner/src/` and its `flow-lane`, `lane-rules`, `bench`,
  `redaction-attestation`, `run-evaluation`, `scenario-steps` and
  `sqlite-store-reader`; `apps/extension/e2e/content/tests/` (25 specs); and `docs/`
  (`architecture`, `working`).
- **`grep -n` in `package.json`, `apps/extension/package.json` and
  `packages/test-runner/package.json`:** the lines quoted above.
- **`node --version`:** `v22.11.0`.
- **The rest used the Grep and Read tools** on the files cited above, in both
  repositories.
- **A search over `docs/architecture/` for line-number citations**
  (`\.(ts|md|mjs|json):\d+|lines? \d+`) found none.
- **No page shows a password value,** and I read no secret value. The auth-gate
  constants were read by export name only.

## Not verified

- **The probe step's 1 s visibility bound.** No `1_000` literal is in `lane-rules/probe-step.ts`; it may be named elsewhere.
- **testing-facility `:761`** ("scenario-pages.spec.ts covers eleven of the twelve"),
  and whether the three unlisted fixtures carry corpus rows.
- **What the content harness's `frames.spec.ts` proves** about cross-frame actions.
- **Whether `pnpm --filter @fluxiq-web-extension/extension test:content -- <spec>`
  finds tests today.**
- **Core's own architecture pages.** Core workers updated them, and they were out of
  scope.
- **The web-capabilities summary counts (`:52-59`), and the per-row states other
  than those named above.**
- **A renderer's view of anchors.** No link check was run.

## Open questions or contradictions found

1. **`packages/test-runner/src/run-scenario.ts:270-277` is a code comment with both
   stale claims from T5:** the 10 s `freshnessMs`, and the start that "stays idle for
   good". It is not a page. Its owner should correct it when the page is corrected,
   or the two will disagree again.
2. **`testing-facility.md:317-318` and the clone lane.** The page says the clone lane
   does not reselect, and that still holds at `run-scenario.ts:241-245`. With Core's
   window now 300 s, is the reselect still needed anywhere? Consider trimming the
   paragraph rather than preserving an exposure that may no longer bite.
3. **T3 is large enough for one worker's whole budget.** If the supervisor prefers
   two workers, the only file-safe split is by page. So the section should be
   drafted by one worker, in one file.
4. **No page records the Lab worktree and Core pin rule** from `l-stage0`: a worktree
   pins Core only beside a Core worktree. Current State states it with a
   machine-specific path. Decide whether `repository-layout.md` "Running Several Labs
   At Once" should carry the general rule. I did not verify it in code.
