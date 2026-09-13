# g-recording-completeness: a short recording fails the run on both lanes

Worker report, 2026-09-13, brief `g-recording-completeness` in `briefs/finish-week1.md`
(fix design T1-T3 from `reports/i-recording-loss.md`). Nothing committed.

## Outcome

**Done**, after the coordinator's amendment gave me the two files the first pass
lacked (see "Amendment" below). The first pass was Partial.

- **T1 is done and mutation-proven.** On both lanes, the runner now reads the
  extension's executable-action count before Stop and compares it with Core's
  action count from the full session. A short count fails the run as
  `recording.persistence`.
- **T2 is done and mutation-proven.** A discard that names no recording is counted
  when it came from the run's paired session. The session is passed at both reads.
- **The pinned wiring test is updated.** The T2 call-site change had broken 2
  tests in `run-evaluation/tests/runner-wiring.test.ts`, which pins the text of
  both `readRecordingDiscards(...)` calls. The amendment gave me that file for
  those strings only. The four replacements are in, one runner mutation proves
  the rows still guard the wiring, and the whole suite passes (`# tests 509`,
  `# pass 509`, `# fail 0`).
- **T3 is done in both places.** `runtime.settle` says
  `entriesAppendedAfterFirstPoll`, and `flow-lane.json` groups its figures under
  `secondWait` (`flow-lane/run-flow-lane.ts`, also given by the amendment).

Re-verified at HEAD first: nothing was already settled.
- No completeness module existed.
- `readRecordingDiscards` had no session scope.
- Both bundle writers still used `entriesAppendedAfterStop`.

## What changed and why

### T1: `run-expectations/recording-completeness.ts` (new), its test, and its barrel entry

- **What it does.** `readRecordingCompleteness(control, { projectId, recordingIds, extensionActionCount })`
  reads `get-recording` once per recording the run produced. Core's handler
  returns `{ recording }`, a full session with its timeline
  (`F:\!FluxIQ\...\automation-studio\api\handlers\recordings.ts:13-17`). It sums
  the timeline entries that pass a copy of Core's own
  `recordingEntryIsActionLike` (`runtime/service.ts:5717-5724`, which Core's
  summaries use at `:1538`).
- **What it returns.** `{ extensionActions, coreActions, failure }`. It does not
  throw, the same shape as `readRecordingDiscards`.
- **Short count.** Core < extension fails as `recording.persistence`. The message
  is `Core's recording holds N of the M actions the extension recorded`. The
  details are `{ extensionActions, coreActions }`, and no timeline field travels.
- **Core holding more passes.** An action the page emits between the read and
  Stop reaches Core but not the count.
- **Unreadable counts fail closed.**
  - Extension count missing, not a non-negative integer, or its status read
    rejected: fails as `extension.worker`.
  - `get-recording` throws, returns no timeline, or returns a session for another
    recording: fails as `recording.persistence`, naming the recording id, with
    the cause attached.
- **The extension's count.** `status.eventCount` is
  `ActiveRecording.eventCount()` (`connection.ts:235`). It is reset in
  `beginAccepted` (`active-recording.ts:196`), and the local fallback also goes
  through `beginAccepted` (`:280-282`). It is incremented only for executable
  actions (`recorded-event-intake.ts:171-172`).

### T2: `flow-lane/recording-discards.ts` and its test

- **New scope argument.** The second parameter is now
  `scope: RecordingDiscardScope = { recordingIds; sessionId: string | undefined }`.
  `sessionId` is a required key, so a caller cannot leave it out by omission.
- **When an entry counts.**
  - It names a recording (`metadata.recordingId`, non-empty) that is one of
    `scope.recordingIds`. This rule is unchanged, and it holds even when the
    entry came from the run's own session.
  - Or it names no recording and its top-level `sessionId` equals
    `scope.sessionId`. Core copies the session onto every entry
    (`client-gateway/service/audit-log.ts:20`, `service.ts:192-196`).
  - A different session, or no paired session, counts nothing.
- **Output shape.** `RecordingDiscard.recordingId` is now optional: it is absent
  for an entry counted by session. The session id itself never travels. The
  failure text reads `(N with no recording id)`, and the dedup key uses `null` for
  the missing recording.
- **Whether or not the Core change lands.** Core creates a client's recording
  under the client's own id (`client-gateway/bridge.ts:309`,
  `recordingId: input.recordingId`). The in-progress bridge in `F:\!FluxIQ`'s
  working tree audits with `discarded.recordingId ?? closed.recordingId`
  (`bridge.ts:488`, read, not edited).
  - After the change: an entry names the run's recording and counts by recording.
  - Before it: an entry that names no recording counts by session.
  - Either way the loss is seen. The one gap is in open question 3.

### T3: `flow-lane/finalized-recording.ts`, its test, and `run-scenario.ts`

- **Doc correction.** The doc on `FinalizedRecording.entriesAppendedWhileWaiting`
  now says what it measures: the count from the wait's first poll to its last,
  not from Stop, and 0 on a second wait. One assertion in the "already finished"
  test backs that.
- **Why the field kept its name.** `run-flow-lane.ts:157` and
  `run-flow-lane.test.ts:151,:249` read it, and I do not own them.
- **Bundle key renamed.** In `runtime.settle`, `entriesAppendedAfterStop` is now
  `entriesAppendedAfterFirstPoll`.
- **`flow-lane.json` is relabelled** by the amendment: see "Amendment" below.

### `run-scenario.ts`: only the calls these need, plus the wording the brief added

- **Reading the extension's count.** `let extensionActionCount: unknown` is
  declared. It is set from `fluxiq.getStatus` right after `recordedEvents`, while
  still recording.
- **Discard scope.** `const discardScope: RecordingDiscardScope = { recordingIds: outcome.newRecordingIds, sessionId: paired?.sessionId }`
  is passed to the first read. It is kept as `firstDiscardRead = { scope, discards }`
  and passed again at the second read in `finally`.
- **Completeness check.**
  - `readRecordingCompleteness` is called after `connectionAfterStop`.
  - The "Core persisted the completed recording" event publishes both counts as
    `recordedActions: { extension, core }`.
  - `if (completeness.failure) throw` comes after the discard failure's throw
    and before the Flow lane.
- **Wording.** The `openScenarioStart` doc comment now describes the load before
  every Flow run, armed or not, and adds the W18 unarmed case. Wording only.
- **Size.** The file is 672 lines (warning at 400, budget 800).

### `src/tests/scenario-assertions.test.ts`: wording only

- Messages, comments and one test title no longer describe the Flow lane's load
  as armed-only.
- The local variable `armedLoad` is now `flowLoad`.
- Every pinned source string and every assertion is unchanged.

### Amendment: the two files the first pass lacked

- **`src/run-evaluation/tests/runner-wiring.test.ts`.** The amendment named
  `src/tests/runner-wiring.test.ts`, where no such file exists; the four strings
  identify this one.
  - Only the four pinned strings changed, exactly as open question 1 lists them.
  - Rows `:70` (`audited is in the runner`) and `:90`
    (`firstRead is in the runner`) now pass against the new runner.
- **One runner mutation proves the rows still guard the wiring.** The first
  discard read was changed to pass
  `{ recordingIds: outcome.newRecordingIds, sessionId: undefined }` instead of
  the kept `discardScope`, which drops the paired session. Both rows failed. The
  runner was then restored byte-identical.
- **`src/flow-lane/run-flow-lane.ts`.**
  - `flowLaneSnapshot`'s `recording` now reads
    `{ recordingId, entryCount, secondWait: { entriesAppendedAfterFirstPoll, waitMs, polls } }`.
    It replaces `entriesAppendedAfterStop`, `finalizationWaitMs` and `polls`.
  - Its doc gains three lines: this wait follows the runner's, and counts from
    its own first poll, so it reads 0 once the runner's wait saw the recording
    finished.
  - No code reads the old names (grep over `packages`, `apps`, `scripts`,
    `domain`). No test asserted them, so `run-flow-lane.test.ts` needed no change.

## Commands run and observed results

All from `packages/test-runner` unless noted. No `pnpm build`, no Lab command.
The first table is the first pass; the second is after the amendment.

| Command | Observed |
| --- | --- |
| `pnpm exec tsc -p tsconfig.json --outDir dist-grc` | `tsc exit=0` |
| `node --test "dist-grc/**/*.test.js"` | `test exit=1`; `# tests 509`, `# pass 507`, `# fail 2`. `not ok 170 - Core's audit of discarded recording messages is read after the round trip, published, and fails the run before the Flow lane`: `error: 'audited is in the runner'` at `runner-wiring.test.js:70`. `not ok 171 - Core's discard audit is read a second time, …`: `error: 'firstRead is in the runner'` at `:90`. |
| `node scratchpad/grc-wiring-check.mjs` (both runner-wiring tests with the four replacement strings, plus T1's order: count before Stop, compared after the round trip, published, thrown after the discard failure and before the Flow lane) | `wiring check passed`, exit 0 |
| `Get-FileHash` before mutation | `recording-completeness.ts` `D703E0E3…C6C58B`; `recording-discards.ts` `A2341459…4A4427` |
| First T1 mutation, `false && core.actions < extensionActions` | `mutated tsc exit=2` (TS2339/TS18047: it broke narrowing). Discarded as proof and redone below. |
| Mutations: T1 `const failure = core.actions < 0`; T2 `const ours = recordingId === undefined ? false : wanted.has(recordingId)`. Rebuilt, then `node --test dist-grc/run-expectations/tests/recording-completeness.test.js dist-grc/flow-lane/tests/recording-discards.test.js` | `mutated tsc exit=0`; `mutated test exit=1`; `# tests 15`, `# pass 10`, `# fail 5`. T2: `not ok 3 - a discard that names no recording is counted when the run's paired session sent it, and another session's is not` (`+ []` / `- [ { discardedActions: 1, discardedEvents: 1, entryId: 'audit.ours', type: 'recording.action_discarded' } ]`), and `not ok 4 - a session-counted discard is unioned across reads …`. T1: `not ok 12 - a short count fails as recording.persistence, naming the two counts and nothing recorded` (`assert.ok(completeness.failure instanceof RunnerFailure)`, expected `true`, actual `false`), `not ok 13 - an empty recording fails …`, `not ok 14 - every recording the run produced is read once and counted`. Tests 11 (equal) and 15 (fail closed) passed. |
| Restored both, `Get-FileHash` | Identical: `D703E0E3…C6C58B`, `A2341459…4A4427` |
| Restored `tsc --outDir dist-grc`, then `node --test "dist-grc/**/*.test.js"` | `restored tsc exit=0`; `# tests 509`, `# pass 507`, `# fail 2`, the same two runner-wiring tests. Also `ok 196`-`ok 199` (T1), `ok 103`-`ok 105` (T2), `ok 79` (finalized), `ok 464`, `ok 465` (scenario assertions). The failures reproduced identically across two builds, with real assertion text, so they are not RAM noise. |
| `pnpm check` (test-runner) | `test-runner check exit=0` |
| Repository root: copied `.git/index` to a scratch index, staged the two new files there, `GIT_INDEX_FILE=… node scripts/structure-audit.mjs` | `structure audit exit=1`. The only `FAIL` is `[working-docs] docs/working/README.md is out of date with the documents' header blocks`. No line names a file I changed except the advisory `run-scenario.ts: 672 lines` warning. |
| Removed `dist-grc` | `dist-grc exists after delete: False` |

**The audit failure is not mine.** Evidence for `docs/working/README.md`:
- `git status --short -- docs/working` shows `M` on the plan and on
  `briefs/finish-week1.md`, and `??` on reports `g-core-expectation-record.md`,
  `g-core-start-order.md` and `w19-d1.md`.
- The README was last committed at `c1128cc`.
- I edited nothing under `docs/`. Regenerating the README needs
  `pnpm structure:baseline`, which workers must not run.

**After the amendment:**

| Command | Observed |
| --- | --- |
| `Get-FileHash run-scenario.ts` before the mutation | `B51EAEC1…ABC79DB` |
| `pnpm exec tsc -p tsconfig.json --outDir dist-grc` | `tsc exit=0` |
| `node --test "dist-grc/**/*.test.js"` | `test exit=0`; `# tests 509`, `# pass 509`, `# fail 0`; includes `ok 170 - Core's audit of discarded recording messages is read after the round trip, …`, `ok 171 - Core's discard audit is read a second time, …`, `ok 126 - the flow-lane snapshot carries Core's target resolution on each action that has one` |
| `node scratchpad/grc-snapshot-label.mjs` (imports the built `flowLaneSnapshot`) | `{"recordingId":"recording.one","entryCount":4,"secondWait":{"entriesAppendedAfterFirstPoll":0,"waitMs":892,"polls":2}}`, exit 0. Neither `entriesAppendedAfterStop` nor `finalizationWaitMs` appears. |
| Runner mutation (above), then `node --test dist-grc/run-evaluation/tests/runner-wiring.test.js` | `mutated wiring test exit=1`; `# tests 6`, `# pass 4`, `# fail 2`: `not ok 4 - Core's audit of discarded recording messages …` (`error: 'audited is in the runner'`), `not ok 5 - Core's discard audit is read a second time …` (`error: 'firstRead is in the runner'`) |
| Restored, `Get-FileHash run-scenario.ts` | `B51EAEC1…ABC79DB`, identical, so the whole-suite run above stands for the restored runner |
| `node --test dist-grc/run-evaluation/tests/runner-wiring.test.js` | `restored wiring test exit=0`; `# tests 6`, `# pass 6`, `# fail 0` |
| Removed `dist-grc` | `dist-grc present after delete: no` |
| `pnpm check` (test-runner) | `test-runner check exit=0` |
| Repository root, new files staged in a fresh scratch index, `GIT_INDEX_FILE=… node scripts/structure-audit.mjs` | `structure audit exit=0`. Only line naming a changed file: the advisory `run-scenario.ts: 672 lines` warning. The first pass's `docs/working/README.md` failure no longer appears; I did not touch it. |

## Not verified

**What a Lab run must show:**
- **Clean run, both lanes.** Take a clean `basic-form` run, recording lane and
  `--flow`. The "Core persisted the completed recording" event must show
  `recordedActions.extension === recordedActions.core`, and the run must pass.
- **Too many false failures.** If every run fails `holds N of the M` with N < M,
  Core does not write one action entry per executable client event. The
  comparison would then need a Core-side count, not this predicate.
- **A hidden loss.** If Core is always above the extension, for example an input
  entry and an action entry per event, or evidence entries carrying `actionType`,
  the check cannot see a loss. That also needs reporting.
- **The smoke W01 0-entry shape** now fails as `recording.persistence` with
  `Core's recording holds 0 of the N actions the extension recorded`.
- **Renamed fields.** `runtime.settle` `recordings[]` carries
  `entriesAppendedAfterFirstPoll`. `snapshots/flow-lane.json` carries
  `recording.secondWait.{entriesAppendedAfterFirstPoll, waitMs, polls}`. On a
  Flow run the second wait's count should be 0.

**Not checked in code:**
- A real Core audit entry that names no recording. The fixture is modelled on
  `audit-log.ts`.
- The cost of `get-recording` on a long recording. It hydrates the full session
  once per recording.
- Whether the extension's start handshake retries under the same recording id.
  Open question 3 depends on it.
- No test in `run-flow-lane.test.ts` asserts the new `secondWait` label: that
  file is still not mine. Only the scratch check of the built function covers it.
- No extension or domain tests: nothing there changed.

## Open questions or contradictions found

1. **Resolved by the amendment.** The brief should have included
   `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`, which
   pins the call text T2 must change. These replacements are now applied:
   - `:70` `readRecordingDiscards(await topology.control.gatewaySnapshot(), outcome.newRecordingIds)` becomes `readRecordingDiscards(await topology.control.gatewaySnapshot(), discardScope)`
   - `:87` `const discardAudit = readRecordingDiscards(await topology.control.gatewaySnapshot(), outcome.newRecordingIds);` becomes `const discardAudit = readRecordingDiscards(await topology.control.gatewaySnapshot(), discardScope);`
   - `:88` `firstDiscardRead = { recordingIds: outcome.newRecordingIds, discards: discardAudit.discards };` becomes `firstDiscardRead = { scope: discardScope, discards: discardAudit.discards };`
   - `:92` `…gatewaySnapshot().catch(() => undefined), firstDiscardRead.recordingIds, earlier)` becomes `…gatewaySnapshot().catch(() => undefined), firstDiscardRead.scope, earlier)`
2. **Resolved by the amendment.** T3's `flow-lane.json` label is written by
   `flowLaneSnapshot` in `flow-lane/run-flow-lane.ts:157`, not by
   `run-scenario.ts`. The fix design's `run-scenario.ts:321`, now `:342`, only
   calls it, and `single-run-evaluation.test.ts:163` pins that call line.
   - **Applied change:**
     `recording: { recordingId, entryCount, secondWait: { entriesAppendedAfterFirstPoll: evidence.recording.entriesAppendedWhileWaiting, waitMs: evidence.recording.waitedMs, polls: evidence.recording.polls } }`.
     No assertion was added in `run-flow-lane.test.ts`, which is still not mine.
   - **Safe to rename.** No code in `packages`, `apps`, `scripts` or `domain`
     reads either name. Only working documents do: `live-validation-plan.md:188`,
     `reports/l-stage1.md`, `reports/i-flow-lane-errors.md`.
   - **Optional follow-up.** Renaming the type field itself would also touch
     `run-flow-lane.test.ts:151,:249`.
3. **I kept T2 literal: session matching applies only to entries that name no
   recording.** The one case it misses:
   - The paired session sends messages under a recording id Core never created,
     for example a refused start.
   - And the run still produces a different recording.
   - The extension creates its recording id once per `start()`
     (`active-recording.ts:138`). So this happens only if a retry changes the id,
     which I did not verify.
   - If it can happen, the fix is to count every paired-session entry except
     those naming a recording in the run's baseline.
4. **Precedence differs from Core's summary.** Core's summary prefers
   `metadata.actionCount` over the timeline (`service.ts:1538`). The full-session
   read counts the timeline only, because that is what the proposal is built from.
5. **Possible documentation follow-up.** T1 adds a new
   `recording.persistence` cause, and a new `extension.worker` fail-closed cause.
   `docs/architecture/failure-taxonomy.md` may want a line. It is not in my
   ownership and I did not open it.
