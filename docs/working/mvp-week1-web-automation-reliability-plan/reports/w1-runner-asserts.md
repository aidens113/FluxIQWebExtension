# w1-runner-asserts — Testing Lab recording lane

Worker report for Phase 1.6a step 2 (`briefs/wave-1.md`, Brief: w1-runner-asserts).

## Outcome

**Partial.** Everything the brief asks for is implemented and verified.
`basic-form` (with its select recorded) and `iframe-checkout` both **passed
live** on isolated topologies, and their bundles pass `inspect` against the
extended contract. Four things keep this from Done:

1. `--workflow` is parsed, but the CLI does not pass it on. That needs a
   one-line change to `cli.ts`, which is on my "Must not touch" list.
2. On this machine, the literal `pnpm lab run … --target isolated` is refused.
   `.env.local` selects an existing-install target, so the live runs went
   through `runScenario` directly (see Open questions 3).
3. `pnpm --filter @fluxiq-web-extension/test-runner test` fails 19 tests, all
   in files I did not change (Open questions 4).
4. The recording lane had a race that made recorded-event assertions
   impossible, and I fixed it (Open questions 10).

## What changed and why

### Step execution moved out of `run-scenario.ts`

`packages/test-runner/src/scenario-steps/` (barrel `index.ts`) now owns
recording-script execution. `run-scenario.ts` keeps only the lanes.

- `parse-target.ts`: the target grammar as a `ScenarioTarget` union.
  - `testid:<id>`.
  - `role:<role>[:<name>]`, with an exact accessible name. The older
    `role:<role>[name=<name>]` spelling, which five current manifest targets
    use, is read the same way.
  - `frame:<title>/<inner>`, which nests.
  - Anything else is raw CSS, so `[data-testid="inventory-row"]:first-child`
    keeps working.
  - A malformed target is `fixture.invalid`.
- `locate-target.ts`: resolves a target in a `TargetScope` (a page, a
  `FrameLocator`, or an item `Locator`) via `locator()`, `getByRole()`, or
  `frameLocator('iframe[title="…"]')`. Frame targets therefore work across the
  cross-origin frame.
- `css-selector.ts`: a CSS projection for the Core round-trip probe, which
  hands FluxIQ a selector string. Role and frame targets have none, so the
  probe uses the first `type` step that has one.
- `step-runner.ts`: `ScenarioStepRunner` performs all fourteen
  `scenarioStepOperations` on the active tab and times every step started,
  including a failed one.
  - `type` uses `fill`, which inserts text as trusted input.
  - `select` goes through the keyboard helper.
  - `press` presses on the target if one is given, otherwise on the focused
    element.
  - `check` calls `setChecked` with a boolean.
  - `upload` uses the deterministic file helper.
  - `switchTab` and `closeTab` go through `ScenarioTabs`.
  - `waitForDownload` goes through `DownloadWatch`.
  - `extract` reads records.
- `scenario-tabs.ts`: `switchTab` moves to the open scenario tab whose URL path
  matches exactly, waiting for one that is still opening. `closeTab` returns to
  the tab before it. The first scenario tab is never closed.
- `download-watch.ts`: collects downloads from every page in the context, so a
  download a preceding click started is found. A wait resolves only on a
  completed download (`failure() === null`), and each download satisfies one
  wait.
- `extract-records.ts`: never clicks and reads only the current page.
  - Per the supervisor note, fields use the same grammar, scoped to each item.
  - An optional `@attribute` suffix reads an attribute; an empty selector means
    the item itself.
  - `column:<header>` reads the cell under the `<th>` whose normalized text
    matches, from `thead` or the first row with `th` cells. Matching is by
    position; colspan is not modelled.
  - A field whose element is absent is left out of its record, not read as `""`.

### Trusted input: `packages/test-runner/src/trusted-input/`

- `select-option.ts`, `selectOptionByKeyboard`: the one select helper.
  1. Focuses the control.
  2. If no other enabled option's label shares the target's initial (a letter
     or digit), presses that key once as typeahead.
  3. Otherwise steps with ArrowDown or ArrowUp over the enabled options.
  4. Verifies `inputValue()`, and fails with expected and actual values if the
     keys did not reach the option.

  It also rejects non-select, multi-select, and disabled controls and options.
  It is now used by the step runner, `interactive-session.ts` (was line 136),
  and `demo-workspace/workspace-lanes.ts` (was line 51).
- `upload-file.ts`, `uploadDeterministicFile`: the bytes depend only on the
  name, and are written to `<runRoot>/scenario-uploads`, which is removed with
  the run.
  - **Deviation from "in-memory file":** the file is handed over by path.
  - Playwright 1.51 applies an in-memory buffer with injected page script
    (`input.dispatchEvent(new Event(…))`), so its events are untrusted and the
    recorder drops them.
  - A path goes through CDP, whose events are trusted. The probe below
    demonstrates both.

### Assertions, workflow resolution, and the recording lane (`run-scenario.ts`, `run-expectations/`)

- **Workflow resolution.** `resolveScenarioWorkflow` resolves the run, and
  `RunScenarioOptions` gains `workflowId` and `variantId`.
  - The script, every expectation, the `steps` metric, and
    `scenarioRequiresCore` use the resolved workflow.
  - Per the supervisor note, the recording lane never arms a variant; a
    `variantId` there is `fixture.invalid`.
  - On `existing`/`clone`, `lab-control/arm-variant.ts` posts the arm to the
    Lab's authenticated `/api/<scenario>/<operation>` before the page opens.
- **`pageFacts`** are asserted on the start page before any script, pairing,
  or Flow.
- **Recording-lane race fixed.** `fluxiq.startRecording` answers before Core
  accepts the recording.
  - A diagnostic run showed `recordingState: "idle"` right after it; the whole
    script ran unrecorded, and the extension's log was empty.
  - The old lane only checked that some recording existed, so this was
    invisible.
  - The lane now polls status until `recordingState === "recording"`, as the
    demo lane does, and fails `recording.persistence` if it does not.
- **`recordingEvents`** (`recorded-events.ts`, `extension-recording-log.ts`,
  `recording-event-types.ts`) are checked against what the extension recorded.
  - The source is its own recording log (`fluxiq.getRecordingLog`), read while
    still recording and tallied by recorded kind. Only the kind and the
    evidence marker are read; labels and details carry page data.
  - Each kind maps to the recording-domain event type the manifest names.
  - Executable and evidence events both count, since the extension records and
    sends both.
  - A listed `count` is exact; without one the type must occur at least once;
    unlisted types are ignored. The check retries for up to 5 s, then fails as
    `recording.contract` with each mismatch and the kind tally.
- **Why the extension, not Core.** I first counted Core's `domain_event`
  entries through `get-recording`. Core records an executable event as a
  gateway input: an `action` entry or an `input.*` observation keyed by input
  id (`client-gateway/bridge.ts` `appendRecordingEvent`, `runtime/io-bridge.ts`
  `recordInput`). Only non-executable events become `domain_event`, and input
  ids do not map back to one event type (for example, `text_entered`). The
  kind → type table mirrors the domain's `webAutomationEventTypeForClientKind`.
  `recording-event-types.test.ts` parses `domain/src/constants.ts` and
  `domain/src/io/input-model.ts` and fails if the two disagree.
- **Round-trip baseline.** The lane now takes a recording baseline before
  starting, so `assertCoreRoundTrip` requires a *new* recording. For
  `persistent-isolated`, which reuses a project, that is stricter than before.
- **`expected.actions`.** The `existing` and `clone` lanes run a Flow, and now
  pass the resolved workflow's `actions` to `executeExistingPersistedFlow`. The
  recording lane runs no scenario actions: its Core probe is two fixed actions.
- **`allowedConsoleErrors`** (`console-errors.ts`): console errors and uncaught
  page errors from scenario tabs, frames included, are collected on every lane.
  Any error not matched by an allowed substring fails the run, with at most 5
  truncated texts in the details. Extension and panel pages are excluded.
- **`playbackGoal.successFacts`** are asserted after `finalState`, for the
  primary workflow.
- **`expected.extracted`** (`extraction.ts`) is asserted right after each
  extract step that has no `pagination`, per the supervisor semantics: `count`
  is exact; `records` is the complete list, compared exactly and in order; both
  must hold when both are given.
- **Evidence** (`evidence-policy/`).
  - The manifest's `evidencePolicy` drives screenshots unless `--evidence`
    overrides it, and a policy of `none` keeps no failure screenshot either.
  - The effective policy goes to the bundle and both capture controllers, and
    is registered again before finalize, so `evidence-policy.json` is exactly
    what was applied.
  - A manifest's `trace`/`video` are published as `off` and listed as
    unsupported: the runner captures neither, and a trace would hold cookies,
    authorization headers, and gateway frames.
  - The failure screenshot now uses the active tab and tolerates a closed one.
- **Error event.** It now carries `failureDetails` for `recording.contract`
  only: event types, counts, and the kind tally, with no page data.

### Cross-origin frames (`network-guard.ts`, `lab-control/frame-origin-proof.ts`)

The Lab serves cross-origin frames from a second port it picks at startup and
never announces. Neither the Lab nor the coordinator is mine to change.

- `DeterministicNetworkPolicy` gains `verifyScenarioOrigin(origin)`. An
  unlisted `http(s)` loopback page origin is proven once, and joins the
  allowlist if the proof holds. Otherwise it is a violation; a proof that
  throws counts as unproven.
- `scenarioLabOriginProof(primary, runToken)` requires an authenticated
  `/__control/health` answer identical to the primary server's. Only the Lab
  holds the run token, and both servers share one state store. The token
  already appears in every fixture page, so this adds no exposure.

### `--workflow` (`commands.ts`)

`run` accepts `--workflow <kebab-id>` at most once and puts `workflowId` on the
parsed command. `matrix` rejects the flag.

### `run.json` (`packages/test-contracts/src/run.ts`, `run-validation.ts`)

All new fields are optional, so older bundles still inspect.

- `workflowId?` and `variantId?`: kebab ids.
- `automationFailure?: { category: ScenarioFailureCategory; code? } | null`.
  `null` means FluxIQ reported no failure; absent means the lane could not see
  one. The type comment separates this from the test-rig `FailureCategory`.
- `steps?: RunStepTiming[]`: `stepId`, operation enum, `startedAt`, integer
  `durationMs`, and `outcome`.
- `actions?: RunActionTiming[]`: `actionType`, `startedAt`, `durationMs`
  (absent while unfinished), and `status`, from the newly exported
  `runActionStatuses`.

`run-manifest/` builds the manifest:

- `create-run-manifest.ts`: `createManifest` moved out of `run-scenario.ts`,
  taking one input object.
- `automation-failure.ts`: maps an action result into the scenario taxonomy,
  keeping only identifier-shaped codes.
- `action-timings.ts`: turns Flow action attempts into timings.

Where the values come from:

- **Recording lane.** The probe's two actions are timed.
- **`existing`/`clone`.** The Flow's attempts are timed. `automationFailure` is
  `null` once the Flow succeeds, and absent if it fails, because
  `executeExistingPersistedFlow` (not mine) throws without the failed run's
  actions.

### Placement

- New directories only: `packages/test-runner/src` (50) and `src/tests` (51)
  are at their directory-file ratchets.
- New tests live in each new directory's `tests/`.
- The network-guard and `--workflow` cases were added to the existing
  `src/tests/network-guard.test.ts` and `commands.test.ts`.
- `run-scenario.ts` is 396 lines, under the 400-line advisory threshold.

## Commands run and observed results

- **`pnpm --filter @fluxiq-web-extension/test-contracts test`**
  - First run failed on `src/index.ts(11,15): error TS2307: Cannot find module
    './bench-report.js'`, a parallel `w1-eval-contracts` edit.
  - Final run: `# tests 53 # pass 53 # fail 0`.
  - `node --test tests/run-manifest.test.mjs`: 6/6 ok.
- **`pnpm --filter @fluxiq-web-extension/test-runner check`**: exit 0.
- **`pnpm --filter @fluxiq-web-extension/test-runner test`** (final): exit 1,
  `# tests 333 # pass 314 # fail 19`.
  - The failures are in `demo-llm-adaptation` (1), `demo-llm-creation` (1),
    `demo-llm-exploration-adaptation-readiness` (2), `…-revert` (2), `…-wait`
    (1), `demo-llm-exploration-adaptation` (4), `demo-llm-exploration-apply`
    (1), `demo-llm-exploration-request` (6), and `demo-workspace` (1).
  - From the repository root, `node --test "packages/test-runner/dist/**/*.test.js"`
    gave `# tests 330 # pass 323 # fail 7`.
- **Tests covering this change**, run from `packages/test-runner/dist`: every
  new `*/tests/*.test.js`, plus `network-guard`, `commands`,
  `interactive-session`, `demo-llm-setup-script`, `scenario-assertions`, and
  `inspect`. Result: `# tests 95 # pass 95 # fail 0`.
- **Trusted-event probe** (scratch; headless Chromium, `channel: "chromium"`;
  built helpers against `page.setContent`):
  ```text
  helpers [["plan","input",true,"team"],["plan","change",true,"team"],["fruit","input",true,"apricot"],["fruit","change",true,"apricot"],["fruit","input",true,"avocado"],["fruit","change",true,"avocado"],["file","input",true,"C:\\fakepath\\notes.txt"],["file","change",true,"C:\\fakepath\\notes.txt"]]
  playwright-builtins [["plan","input",false,"enterprise"],["plan","change",false,"enterprise"],["file","input",false,"C:\\fakepath\\buffer.txt"],["file","change",false,"C:\\fakepath\\buffer.txt"]]
  ```
- **`node scripts/structure-audit.mjs`**: exit 0.
  - No finding on any path I touched, and no `FAIL`.
  - It prints `structure-audit: 1 baseline entries can be lowered.`, which was
    already present before my edits; the audit does not name the entry.
- **`pnpm lab run basic-form --target isolated`**: the builds succeeded, then
  `{"status":"failed","category":"unknown","message":"--target isolated
  conflicts with FLUXIQ_TEST_TARGET=existing"}`, exit 1 (Open questions 3).
- **Live runs.** A scratch driver calls `runScenario` with
  `target: { mode: "isolated" }` and no `FLUXIQ_TEST_*`, the same call `cli.ts`
  makes after resolution. `evidence` was omitted, so the manifest policy
  applied.
  - Before the fixes, `basic-form` failed three times on `recording.contract`.
    The diagnostics showed Core had persisted only `input.state`,
    `input.event`, and `client.state_snapshot`. The extension's log was `{}`,
    and `recordingState` was `"idle"` after `startRecording`.
  - `basic-form` after the fixes: `{"runId":"run-mtxf3wg8-993a3fff","verdict":"passed"}`,
    exit 0.
    - Recorded: `{"web.form.submitted":1,"web.element.clicked":1,"web.element.input_changed":2,"web.element.changed":1,"web.keyboard.pressed":1,"web.tab.state_changed":1}`.
      The manifest expects `input_changed` 2, `changed` 1, and `clicked` 1;
      the `changed` is the select.
    - `run.json` steps: `enter-name:type:13ms`, `choose-plan:select:58ms`,
      `enter-notes:type:7ms`, `submit:click:29ms`, `submitted:checkpoint:0ms`.
    - `run.json` actions: `web.browser.navigate:succeeded:1911ms` and
      `web.dom.type:succeeded:1553ms`, with `automationFailure: null`.
    - `evidence-policy.json`: `{"screenshots":"events","trace":"off","video":"off","sampleFps":0,"maxScreenshots":100,"maxBytes":26214400,"reviewRequired":false}`.
  - `iframe-checkout` after the fixes: `{"runId":"run-mtxf4xou-389e1c72","verdict":"passed"}`,
    exit 0.
    - Both frame clicks succeeded (the cross-origin one in 35 ms).
    - Recorded `{"web.element.clicked":2,"web.tab.state_changed":1}`.
    - The network guard passed with the second Lab origin proven.
  - `FLUXIQ_TEST_RUNS_DIR=<repo>/test-runs node packages/test-runner/dist/cli.js inspect <id>`
    returned `"valid":true` for both (15 and 13 artifacts), exit 0.

## Not verified

- **`--workflow` end to end and any `workflows[]` run live.** The CLI does not
  pass the flag, and the ten placeholder fixtures were being replaced in
  parallel.
- **Variant arming, and the `existing`/`clone` lanes after my edits.** There is
  no existing installation here; these are compile-checked only.
- **`switchTab`, `closeTab`, `waitForDownload`, `upload`, `extract`, `press`,
  and `check` in a live Lab run.** They are covered by unit tests with fakes,
  and upload also by the trust probe. No DoD fixture uses them.
- **The select change in `interactive-session.ts` and `workspace-lanes.ts`
  live.** Existing tests plus compile only.
- **macOS**, where arrow keys open a closed select.
- **An allowed console error in a live run.** Both runs had no console errors.
- **The literal `pnpm lab run … --target isolated` CLI command** on this
  machine.

## Open questions or contradictions found

1. **`--workflow` needs a `cli.ts` line.** `cli.ts` passes `runScenario` an
   explicit field list. The supervisor needs to add
   `...(command.workflowId ? { workflowId: command.workflowId } : {})` to the
   call at `cli.ts:46`.
2. **The manifest evidence policy is unreachable from the CLI.**
   `evidenceMode()` in `commands.ts` defaults to `"failure"`, so the CLI always
   overrides the manifest. Making the flag optional touches that default, the
   `LabCommand` type, and several `commands.test.ts` expectations. That is
   beyond "the `--workflow` flag only", and those tests are not mine.
3. **`.env.local` blocks `--target isolated`.** It sets `FLUXIQ_TEST_TARGET`,
   `_BASE_URL`, `_GATEWAY_URL`, `_USERNAME`, `_PASSWORD`, `_PIN`, and
   `_RUNS_DIR` (I read key names only). `resolveTargetConfiguration` refuses
   that combination for finite runs by design. The CLI command needs
   `.env.local` moved aside.
4. **The 19 failing tests are not in any file I changed.**
   - 12 depend on the working directory. They read repository-root-relative
     paths (`scripts/run-demo-llm-*.mjs`, `apps/scenario-lab/dist/registry.js`,
     `package.json`), while pnpm runs them from `packages/test-runner`. They
     pass from the root.
   - Tests 159, 164, 165, 172, 176, and 179 match regexes against an empty
     slice of `src/demo-workspace.ts`, whose code moved to `demo-workspace/`
     in commit e800499.
   - Test 144 asserts LLM budget constants (`maxCallsPerRun` 1, actual 2).
   - A grep of the failing test files finds no path I touched.
   - I have no clean pre-edit baseline: the first attempt was blocked by the
     bench-report gap, and `git stash` would disturb parallel workers.
5. **The interactive session is still single-origin.** `interactive-session.ts`
   installs the guard without `verifyScenarioOrigin`, so an interactive
   `iframe-checkout` still blocks the cross-origin frame. That is a one-line
   change outside my select-call ownership.
6. **A Flow lane cannot see its automation failure.**
   `executeExistingPersistedFlow` throws a message-only error, so
   `automationFailure` stays absent on a failed `existing`/`clone` run.
7. **`expected.failure` is not asserted.** The brief does not list it, and
   negative variants arm only on Flow lanes.
8. **The new directories are not in the package's public surface.** They have
   barrels but are not re-exported from `packages/test-runner/src/index.ts`,
   which is not mine.
9. **New error-event field.** `failureDetails` is added for
   `recording.contract` only.
10. **The recording-lane race was never visible.** Before this change, no
    isolated run recorded any scripted user action, because the script ran
    before recording was accepted. The Flow lanes (`existing`, `clone`) still
    start recording without waiting. They assert only that a new recording
    exists, and I could not validate them here, so I left them unchanged.
11. **Keyboard selection records its keystroke.** `basic-form` recorded
    `web.keyboard.pressed` ×1, the typeahead key; arrow steps would record one
    keydown each. A manifest that pins `web.keyboard.pressed` must count them,
    and a Flow built from the recording may carry that keypress.
12. **The parity guard couples to domain source layout.** It parses
    `domain/src/io/input-model.ts`, which `w1-domain-mappings` is editing. If
    that function moves or becomes a table, the guard fails with a message
    saying to update the mirror, not silently.
