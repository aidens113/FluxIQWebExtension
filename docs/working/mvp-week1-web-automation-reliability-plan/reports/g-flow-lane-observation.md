# Report: g-flow-lane-observation

Worker `g-flow-lane-observation`. It covers four items:
- CS1f: the Lab threw away how targets were resolved.
- B1: a short Flow proposal was compared to nothing.
- D1 and D2 from `i-flow-lane-errors`: a failing Flow-lane run lost its own
  observation.

All the work is in `packages/test-runner`. No extension, domain or Core file
was touched.

## Outcome

**Partial.** Three of the four items are done and proven by unit tests with
mutation proofs. The fourth, CS1f, is done for the record Core actually serves,
but that record is not the one `L-replay` wanted.

- **D1: done.** When a Flow's result did not match what the workflow expected,
  the lane used to throw before telling the runner anything. Now it asks the
  fixture oracle first, builds its observation, and hands that to the runner.
  Only then does it check the expectations. So a failing run still carries
  `lane: "flow"`, the failure category Core reported, and a real oracle
  verdict. As briefed, the oracle is consulted before the asserts.
- **D2: done.** The runner now sets the Flow observation, oracle verdict and
  automation failure from that evidence callback. The old fallback that filed a
  Flow run as a recording-lane run is gone, replaced by a small selector,
  `selectLaneObservation` in `lane-observation.ts`. If a Flow-lane run's lane
  never published anything, the selector reports `lane: "flow"`,
  `flowCreated: false`, which is how the bench already scores it. The error
  event's `details` now also carry `flowReportedFailure: { category, code? }`.
- **B1: done.** A proposal with fewer candidates than the recording pins now
  fails as `recording.contract` before any Flow is approved. The count comes
  from the recorded workflow's `expected.recordingEvents`, using only entries
  that give an exact `count` on an event type that becomes an action. The
  reason for that choice is under *What changed*.
- **CS1f: done for Core's own record, not for the browser's.** I checked Core's
  source. The action record the Lab reads (`get-flow-run-detail`) carries
  **Core's** target resolution at `metadata.targetResolution`, shaped as
  `AutomationNodeTargetResolution`. That is now carried into
  `PersistedFlowAction.targetResolution` and into each action in
  `snapshots/flow-lane.json`. Only the closed-vocabulary fields travel.
  - **The catch.** The **browser's** own `resolution`, which `L-replay`
    Defect 4 is about, does not travel. It sits on the attempt trace's
    `outputs`, and Core's run-detail conversion drops `outputs`. No endpoint
    this lane uses can return it without a Core change (Open question 1).

## What changed and why

### D1: publish before judging (`flow-lane/run-flow-lane.ts`)
- `FlowLaneEvidence` gained `observation: RunLaneObservation`.
- After `executeRecordedFlowRun`, the lane now does these steps in order:
  1. Calls `checkFinalState()`.
  2. Builds `flowLaneObservation({ flowCreated: true, oracleVerdict, run, ... })`.
  3. Calls `recordEvidence({ ..., observation })`.
  4. Only then runs `assertFlowFailure`, `assertFlowActions` and
     `assertFlowExtraction`.
- The returned `FlowLaneOutcome.observation` is the same object.
- **Cost.** A failing run now also waits for the oracle's final-state check.
  That is the price of a real `oracleVerdict`, as the supervisor decided.

### D2: the runner takes the observation from the callback (`run-scenario.ts`, `flow-lane/lane-observation.ts`)
- **Callback.** `recordEvidence` in `run-scenario.ts` sets `flowObservation`,
  `oracleVerdict` and `automationFailure` first, then pushes the action timings
  and writes the snapshot. The three assignments that used to follow
  `runFlowLane` are removed.
- **Selector.** `selectLaneObservation({ evaluated, flowLane, published,
  automationFailureExpected, recordingLane })` works like this:
  - If the lane published an observation, it is returned.
  - The existing and clone targets (`evaluated: false`) get `undefined`.
  - A Flow-lane run that never published gets
    `flowLaneObservation({ flowCreated: false, oracleVerdict: null, run: undefined })`.
  - Otherwise it builds the recording-lane observation through the callback it
    was given.

  `run-scenario.ts` now calls it in place of the old `flowObservation ?? …`
  expression. The barrel is `export *`, so no barrel edit was needed.
- **Error event.** It gains `flowReportedFailure`. Only the category and code
  are rebuilt from the observation's `automationFailureReported`, which is
  Core's parsed record; nothing else of the record is copied.
- **Knock-on changes on a failing Flow run.**
  - `run.json`'s `automationFailure` now holds the failure the Flow reported.
    Before, it stayed `null` whenever an expectation threw.
  - `evaluation.json`'s `oracleVerdict` is now the Flow oracle's verdict. Before,
    the recording lane's verdict was used.
- One stale comment on `automationFailure` was corrected.

### B1: the proposal must cover the pinned actions (`flow-lane/recording-flow-proposal.ts`, `run-flow-lane.ts`, `run-scenario.ts`)

**What was added.**
- `assertProposalCoversRecording(proposal, recordingEvents)`. It sums the exact
  `count`s declared on these types: `web.element.clicked`,
  `web.element.input_changed`, `web.element.changed` and
  `web.keyboard.pressed`.
- When `proposal.candidateCount` is below that sum, it throws
  `RunnerFailure("recording.contract")`. The details hold `candidateCount`,
  `expectedExecutableActions`, `pinnedEvents` (types and counts) and Core's
  `issues`.
- `runFlowLane` calls it right after `createRecordingFlowProposal`, before
  approval.
- `FlowLaneInput` gained `recordingEvents`. `run-scenario.ts` passes
  `recordingWorkflow.expected.recordingEvents ?? []`, which belongs to the
  unarmed workflow the recording lane just asserted.

**Why count from that declaration.**
- **It is a proven fact about this very recording.** The recording lane checks
  those exact counts against the extension's own log (`assertRecordedEvents`)
  before the Flow lane starts. So if Core proposes fewer candidates, an action
  was lost after the extension recorded it, which is the defect.
- **`expected.actions` cannot express it.** Each entry is satisfied by *some*
  attempt of its type. Auth-gate lists `web.dom.type` once, so losing the
  second type still passes.
- **The recording script cannot either.** It says what the lane did to the
  page, not what the recorder captured. That matters on fixtures like
  `storefront-checkout`, where frame capture is the open question.
- **An entry with no `count` pins nothing,** since it only means "at least
  one".

**Why those four types.**
- The domain maps each recorded event to at most one candidate
  (`webAutomationRecordedAction`, `domain/src/io/input-model.ts:71-78`).
  `mapWebRecordingObservation` calls it once per timeline entry
  (`domain/src/web-panel-host.ts:115-119`).
- Core compacts only state checkpoints and state observations before mapping
  (Core `runtime/service/recordings/timeline.ts:7-13`). Input entries are never
  compacted.
- These types are left out: navigation (only a typed one is an action), scroll
  (only with coordinates), and every evidence type.
- **Two known exceptions.** Neither is pinned by any manifest today; I grepped
  every `recordingEvents` declaration.
  - A checkbox or radio toggle stays evidence until the recorder reports its
    checked state (`input-model.ts:181-184`).
  - A key that only changes a `<select>`'s value is evidence
    (`input-model.ts:153-161`).

**What each pinned manifest now demands, computed by hand from the manifests
at HEAD:**

| Scenario | Minimum candidates |
| --- | --- |
| `basic-form` | 4 |
| `auth-gate` | 3 |
| `identity-drift` | 2 |
| `ambiguous-targets` | 1 |
| `file-transfer` | 1 |
| `modal-flows` | 4 (its two sub-workflows: 2 each) |
| `keyboard-forms` | 1 (`combobox` workflow: 3) |

Every other scenario pins no count, so its minimum is 0.

**Consequence.** A short proposal fails before approval, so that run has no
`flow-lane.json`. Its evidence is the error event's `failureDetails`, which
`run-scenario.ts` already publishes for `recording.contract`. Through the D2
selector, its evaluation reads `lane: "flow"`, `flowCreated: false`.

### CS1f: Core's target resolution reaches the bundle (`flow-lane/persisted-flow-run.ts`, `run-flow-lane.ts`, `run-scenario.ts`)

**Where the field lives in Core** (read only, not edited):
- The shape is `AutomationNodeTargetResolution` (`nodes/contracts.ts:116-125`):
  `status` is one of `matched`, `unresolved_no_candidates`, `no_match` or
  `below_confidence`, plus `candidateCount`, `minimumConfidence`, and optional
  `candidateId`, `confidence`, `normalizedScore`, `matchedSignals` and
  `failedSignals`.
- `io-policy.ts:51,113,171,185-190` returns it as `targetResolution`.
- `executor/attempt-trace.ts:35` puts it on the attempt.
- `service/summaries/conversions.ts:169` copies it to the run-detail record's
  `metadata.targetResolution`. The record type is
  `AutomationStudioFlowRunActionAttemptRecord` (`model/flow-adaptation.ts:277-292`).

**What travels.**
- `PersistedTargetResolution` = `status`, `candidateCount`,
  `minimumConfidence`, and optionally `confidence` and `normalizedScore`.
- `targetResolutionOf` rebuilds it field by field. An unknown status, missing
  counts, or a non-object is treated as absent.

**What stays behind, and the sensitive-value check.**
- `candidateId` stays behind. Core takes it from the page's own `id`, `testId`,
  `automationId` or a state path (`fingerprinting/element-fingerprint.ts:207`).
  That is page-authored text, though not a control's value.
- The two signal lists stay behind: they name fingerprint paths, and a bundle
  has no redaction rule for them.
- With only an enum and numbers left, the record cannot carry a sensitive
  control's value. Nor can it carry anything like `candidateLabel`'s text
  (`v-matcher-calibration`).

**Where it is written.**
- `PersistedFlowAction.targetResolution` is set in `flowAction`.
- The `snapshots/flow-lane.json` document moved out of `run-scenario.ts` into
  `flowLaneSnapshot(evidence)` in `run-flow-lane.ts`, a file I own. This makes
  its content unit-testable: `run-scenario.ts` has no unit test, and
  `src/tests/` has no headroom. The content is unchanged except that each
  action now carries `targetResolution` when present. `run-scenario.ts` calls
  it. `run.json` is untouched, as briefed.

**Why the browser's `resolution` does not travel.**
- The browser's `WebAutomationTargetResolution` reaches Core inside the
  dispatch payload.
- `io-policy.ts:49,111` stores that payload on the attempt's
  `outputs.result`.
- `runtimeActionAttemptsFromSession` (`conversions.ts:137-173`) builds the
  run-detail record without `outputs`.
- `getFlowRunDetail` (`service.ts:3847-3862`), `list-flow-run-actions` and
  `get-flow-run-action-detail` all serve that same record.
- `L-replay` read it by copying Core's store files off disk with a watcher, not
  through the API.

### Tests (all under `flow-lane/tests/`)

`run-flow-lane.test.ts`:
- **D1 test (i).** The Flow reports `target_not_found` where
  `target_ambiguous` was expected. The rejection is still `runtime.behavior`.
  The recorded evidence has `observation.lane "flow"`, `flowCreated true`,
  `automationFailureReported { target_not_found, web.target.not_found }`, and
  `oracleVerdict "failed"`, which proves the oracle ran before the throw.
- **D1 test (ii).** The Flow succeeds where a failure was expected:
  `reportedVerdict "passed"`, `automationFailureReported null`,
  `oracleVerdict "passed"`.
- **B1 integration test.** The finished recording has 4 entries but Core
  proposes 3. The result is `recording.contract` with `candidateCount 3` and
  `expectedExecutableActions 4`. No proposal was reviewed, no run started, and
  no evidence was recorded.
- **CS1f snapshot test.** `flowLaneSnapshot` carries `targetResolution` on the
  action that has one, and none on the action that does not.
- **Existing tests.** The first test now passes `basic-form`'s real
  declaration (4 pinned) and still gets 4 candidates. The fake Core gained
  `lostCandidates`, `attempt`, `runStatus` and `reviewedProposals`. The W18
  tests from `f-w18-secret-leg` are unchanged and pass.

`lane-observation.test.ts`:
- **D2 selector, never published.** A Flow-lane run that never published
  gives `lane "flow"`, `flowCreated false`, a null `oracleVerdict`,
  `reportedVerdict` and failure, no actions, and a valid `RunEvaluation`. The
  recording-lane builder is never called.
- **Published wins.** A published observation is returned by identity.
- **Other lanes.** A recording-lane run gets the recording observation. An
  unevaluated target gets `undefined`.

`persisted-flow-run.test.ts`:
- **CS1f, closed fields.** Core's `unresolved_no_candidates` record travels as
  status and numbers only. `email-address`, `matchedSignals`,
  `failedSignals` and `accessibleName` are absent from the serialised outcome.
  A `matched` record keeps `confidence` and `normalizedScore`.
- **CS1f, absent or invalid.** No record, or an invalid one (unknown status,
  missing count, string count, an array), gives no `targetResolution`.

`recording-flow-proposal.test.ts`:
- **B1, accepted.** `basic-form` passes at 4 and 5; `auth-gate` passes at 3.
- **B1, refused.** `auth-gate` at 2 (the lost second `web.dom.type`) fails with
  exact `details`. `basic-form` at 3 fails, and so do three pinned key presses
  at 2.
- **B1, nothing pinned.** Unpinned types and non-action types (submit, scroll,
  navigation, snapshot) demand nothing.

## Commands run and observed results

All were run from `F:\!FluxIQWebExtension` in Git Bash. Each exit status was
captured by redirecting output to a scratch file and echoing `$?`.
- **No reruns were needed.** No failure had the uniform or impossible shape the
  faulty-RAM rule describes.
- **Labels.** `EXTENSION_TEST_BUILD_LABEL=g-flow-lane-observation` was set on
  the first check only. No extension or domain tests were run, so the labels
  had nothing to separate.

1. `pnpm --filter @fluxiq-web-extension/test-runner check`, **before any
   edit**: `exit=0`.
2. `pnpm --filter @fluxiq-web-extension/test-runner check`, after the edits:
   `exit=0`, and no `error TS` lines.
3. `node scripts/structure-audit.mjs`: `exit=0` and
   `structure-audit: passed (34 warning(s), 17 baselined).` The only finding on
   a file I touched is the advisory
   `warn [file-lines] packages/test-runner/src/run-scenario.ts: 610 lines is past the 400-line advisory threshold`.
   It was already past 400, at 607 lines.
4. `pnpm --filter @fluxiq-web-extension/test-runner test` (build plus full
   suite): `exit=0`, `# tests 471`, `# pass 471`, `# fail 0`. All 13 new or
   changed tests reported `ok`, for example `ok 106 - a proposal short of the
   actions the recording pins fails the run before any Flow is approved`.

### Mutation proofs

- Hashes were recorded before any mutation:
  - `run-flow-lane.ts`: `e7a33749…35530`
  - `lane-observation.ts`: `395f0ec4…d828f`
  - `persisted-flow-run.ts`: `89eebeca…2b2f4`
  - `recording-flow-proposal.ts`: `e45bb0ca…131ba`
- Each run below was `pnpm build` (exit 0), then `node --test` on the affected
  compiled test files.

**Run 1: M1, M2 and M3 applied together.** Each is in a different file and
breaks only its own subject's tests. The run showed `# tests 24`, `# pass 20`,
`# fail 4`, one failure per mutation, as below.

- **M1 (D1)** moved `recordEvidence` back after the three asserts in
  `run-flow-lane.ts`.
  - `not ok 20 - a Flow that reports the wrong category is published as the
    Flow run it was, …` failed with `the evidence is recorded before the
    expectation throws … 0 !== 1`.
  - `not ok 21 - a Flow that succeeds where a failure was expected is published
    as passed, …` failed with `+ undefined - 'flow'`.
- **M2 (D2)** made the selector's Flow-lane branch return
  `input.recordingLane()`.
  - `not ok 6 - a Flow-lane run whose lane never published is a Flow run that
    created no Flow, never a recording-lane run` failed with
    `+ 'recording' - 'flow'`.
- **M3 (CS1f)** changed `flowAction` to call `targetResolutionOf({})`.
  - `not ok 15 - Core's target resolution travels with the attempt, rebuilt
    from its closed fields only` failed with
    `+ undefined - { candidateCount: 0, minimumConfidence: 0.55, status: 'unresolved_no_candidates' }`.
- All three were restored. `sha256sum` then printed identical hashes,
  `diff` was empty, and the output said `IDENTICAL`.

**Run 2: M4b (B1 counting)** removed `web.element.input_changed` from the
executable set. The run showed `# tests 16`, `# pass 14`, `# fail 2`:
- `not ok 7 - a lost second web.dom.type fails as a recording contract, …`
  failed with `'a proposal of 2 candidate(s) was accepted against
  [{"type":"web.element.input_changed","count":2},{"type":"web.element.clicked","count":1}]'`.
- `not ok 11 - a proposal short of the actions the recording pins fails the
  run before any Flow is approved` failed with `'Missing expected rejection.'`.
- Restored: `IDENTICAL`.

**Run 3: M4a (B1 wiring)** called
`assertProposalCoversRecording(proposal, [])` in `runFlowLane`. The run showed
`# tests 16`, `# pass 15`, `# fail 1`:
- `not ok 11 - a proposal short of the actions the recording pins fails the
  run before any Flow is approved` failed with `'Missing expected rejection.'`.
- Restored: `IDENTICAL`.

### After restoring every mutation

- `pnpm --filter @fluxiq-web-extension/test-runner check`: `check exit=0`, and
  `0` `error TS` lines.
- `pnpm --filter @fluxiq-web-extension/test-runner test`: `test exit=0`,
  `# tests 471`, `# pass 471`, `# fail 0`, `# cancelled 0`.
- `git status --short -- packages/test-runner` showed my 9 files modified. It
  also showed files belonging to other workers, which I did not touch:
  `run-manifest/create-run-manifest.ts`, `redaction-attestation/`, and
  `run-manifest/tests/create-run-manifest.test.ts`.

## Not verified

**No Lab run and no build of the extension or domain**, as this dispatch
requires. What a Lab run must show:

- **D2's invariant, on every Flow-lane bundle:** whenever
  `snapshots/flow-lane.json` exists, `evaluation.json` says `lane "flow"` and
  `flowCreated true`.
- **D1 and D2 live.**
  - `FLUXIQ_TEST_ENV_FILES=none pnpm lab run ambiguous-targets --flow --variant no-context --target isolated`
    must give `evaluation.json` `lane: "flow"`, `flowCreated: true`, and an
    `oracleVerdict` that is not null.
  - `… run identity-drift --flow --variant reworded-aria --target isolated`
    must give `automationFailureReported.category` equal to
    `snapshots/flow-lane.json` `failure.category`. `events.ndjson`'s error
    event must carry `flowReportedFailure` with that category and code, and
    there must be no `Circular structured evidence`.
- **CS1f live.** On element-target dispatches, each action in `flow-lane.json`
  must carry `targetResolution`. At HEAD this is expected to read
  `status "unresolved_no_candidates"`, `candidateCount 0` (CS2c).
  - This rests on source reading only. I did not trace whether Core's typed
    stream store (`runtime-stream-store.ts` `getRunDetail`, which rebuilds
    attempts from stored `action_attempt` payloads, `:460`, `:500`) keeps
    `metadata` intact. It stores the same record objects, so I expect it does.
- **B1 live.**
  - In the 24-run `basic-form --flow` campaign, a proposal under 4 candidates
    must fail `recording.contract` naming `candidateCount` and
    `expectedExecutableActions`.
  - No pinned manifest may false-fail. For example, a corpus run of every
    scenario with the minimums in the table above must not fail on B1 where
    the Flow otherwise passes.
  - What the recorder emits on a pinned fixture is not verified, including
    whether a pinned `web.element.changed` on `modal-flows` is a select.
- **Oracle latency.** How much time consulting the oracle before the asserts
  adds to a failing run was not measured.
- **`run-scenario.ts` wiring is type-checked only.** It has no unit test, so
  these were only compiled: the three assignments in `recordEvidence`, the
  `recordingEvents` pass-through, the `selectLaneObservation` call, the
  `flowReportedFailure` details, and the call to `flowLaneSnapshot`.
- **`run.json` validation.** `automationFailure` on a failing Flow run now
  carries the reported failure. Whether that manifest passes
  `assertRunManifest` was not exercised.
- **Where Core keeps the browser's resolution.** The exact path inside the
  attempt trace is inferred, not re-traced: `outputs.result`, then the
  dispatch payload's `result.resolution` (domain `runtime/adapter.ts:96,113`).
  `L-replay` names it `attempt.result.payload.result.resolution`.
- **Parallel work.** The supervisor's declared-secrets mutation and rebuild ran
  during this dispatch. Every test-runner run I made was green or failed only
  where a mutation was meant to fail, so none needed a rerun.

## Open questions or contradictions found

1. **CS1f cannot deliver what `L-replay` Defect 4 asked for without a Core
   change.** The browser's `resolution` is not on any record Core serves to the
   Lab.
   - The smallest Core change: `runtimeActionAttemptsFromSession`
     (`service/summaries/conversions.ts:163-171`) would lift the dispatched
     result's `resolution` into the attempt's `metadata`, validated to its
     closed shape. This needs a user alert.
   - One detail to check if that is done: Core's trace withholding
     (`executor/trace-withholding.ts:60,148`) replaces numbers under `outputs`
     that equal a resolved state value. A candidate count could read
     `[withheld]` on a run that resolved a matching number.
   - Reading Core's store files from the runner, as `L-replay` did, would go
     around Core's public API, and I do not recommend it.
   - The supervisor should decide whether CS1f closes on Core's record or
     stays open for the browser's.
2. **B1's exceptions.** If `g-recorder-signals` lands `checked`, a checkbox
   toggle becomes an action and that exception disappears. Until then, a future
   manifest that pins an exact `input_changed` or `changed` count on a checkbox
   would false-fail B1. The failure would name the counts and Core's issues.
   A more precise count would be D4's raw extension tally with the `evidence:`
   prefix kept, but D4 owns `run-expectations/recorded-events.ts`, which I did
   not touch.
3. **One small move the brief did not name.** The `flow-lane.json` document
   builder moved from `run-scenario.ts` into `flowLaneSnapshot` in
   `run-flow-lane.ts`, so CS1f's snapshot content has a unit test. Both files
   are mine.
4. **A run that fails B1 writes no `flow-lane.json`.** `recordEvidence` needs a
   run, and B1 fires before one exists. If the supervisor wants the proposal
   and recording counts in a snapshot on that path too, `FlowLaneEvidence`
   would need a shape without a run. Today the counts are in the error event's
   `failureDetails`.
5. **`git diff` includes another worker's change.** Against HEAD, the diffs of
   `run-flow-lane.ts` and `tests/run-flow-lane.test.ts` include
   `f-w18-secret-leg`'s uncommitted change. I built on it and kept it, and its
   two W18 tests pass.
6. **No structure-baseline entry should change.**
