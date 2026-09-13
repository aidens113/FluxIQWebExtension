# i-flow-lane-errors: the Flow lane's missing action and opaque failure

Worker `i-flow-lane-errors`, 2026-09-12. This was a read-only investigation. This
repository is at `HEAD 99eca80` and FluxIQ Core at `368b3c9`. Nothing in either
tree was edited. No `pnpm lab` and no `pnpm build` were run. Probes ran from the
scratchpad against copies of built files, and hashes show the tree files were
byte-identical before and after. File:line references are at those HEADs. For
`apps/extension/src/background/connection.ts` and `server-command-channel.ts`,
which another worker is changing in the working tree right now, the line
numbers are read from `git show HEAD:`.

---

## Outcome

**Done.** Each of the three questions is answered at HEAD with file:line.

- **(a) The race fix is committed** in `ab736a1` (2026-09-12 19:07 -0700). Its
  seven unit tests pass at HEAD. Reverting the order in a scratch copy makes
  both lane tests fail with the defect's signature (`1 !== 4`). **No Lab run
  of any kind has happened since that commit.** The newest run bundle on disk
  started at 01:15Z and the commit landed at 02:07Z, so the fix has never been
  observed live. The exact campaign and its pass condition are below.
  **Exit status alone cannot pass it,** because `basic-form`'s action
  expectation cannot see a lost duplicate `web.dom.type`.
- **(b) There were two causes, and one of them is still open.**
  - **Cause 1 (fixed):** the redaction walk treated any shared object as a
    cycle and threw. This is `L-replay` Defect 2, fixed in `ab736a1`. It is
    proven by a unit test and a scratch mutation, and has not been seen live.
  - **Cause 2 (still open, named nowhere before):** when a Flow's result
    disagrees with the workflow's expectations, the lane throws before it
    publishes its own observation. The run is then published as a
    **recording-lane** run, and the failure the Flow actually reported never
    reaches `evaluation.json`. The bench goes further and records
    `flowCreated: false` with no reported failure. All 11 saved `L-replay`
    Flow runs show `lane: "recording"`. A scratch probe against the built
    HEAD code reproduces it.
  - **Criterion 4 is directly affected.** Every negative variant whose Flow
    reports the wrong category is scored as "reported nothing".
- **(c) The plan's text settles that telling the recording client about a late
  event is not Week 1 scope.** Week 1 reports failures to "the runtime
  harness". Recording "Event feedback" is Phase 3.3 (Week 3), and "Stop
  behavior" producing "understandable behavior rather than silent corruption"
  is Phase 4.3 (Week 4).
  - **Still Week 1, under the words "actions reliable" and "repeatable
    measurements":** the benchmark must be able to see a lost action.
  - **Also Week 1, a reliability defect:** Core must stop tearing down a
    healthy extension connection when an event lands between finalizing the
    recording and removing it from the active set. That path is still open at
    Core HEAD. `L-core-discard` described its error frame as carrying "no
    code"; it actually carries `gateway.receive_failed`.

---

## (a) The race fix: committed, unit-proven, never run live

### Where it is

`ab736a1` added `packages/test-runner/src/flow-lane/finalized-recording.ts`
(+179) and its test (+90), and changed `run-flow-lane.ts` (+20),
`run-scenario.ts` (+70), `recording-flow-proposal.ts` (+11) and
`tests/run-flow-lane.test.ts` (+123), per `git show --stat ab736a1`. In the
working tree the only file under `flow-lane/` that differs from HEAD is
`declared-secrets.ts`, which belongs to another brief.

- `run-flow-lane.ts:70` waits for Core's completion signal (`endedAt`), and
  only then does `:71` ask for the proposal.
- `run-scenario.ts:287` runs `assertCoreRoundTrip`. At `:289` the
  `runtime.settle` event carries each recording's `entryCount`,
  `entriesAppendedAfterStop` and `finalizationWaitMs`.
- `run-scenario.ts:317-326` writes `snapshots/flow-lane.json` with
  `recording.{recordingId, entryCount, entriesAppendedAfterStop,
  finalizationWaitMs, polls}`, `candidateCount` and `proposalIssues`. This
  happens before any expectation is judged (`run-flow-lane.ts:90`).
- Core's half is committed in `368b3c9`. A proposal built from an open
  recording now carries an issue string. `service.ts:2372-2459` calls
  `openRecordingProposalNotice` on every return path.

### What the unit proof covers

At HEAD, `node --test dist/flow-lane/tests/run-flow-lane.test.js
dist/flow-lane/tests/finalized-recording.test.js` exits **0 with 7 of 7
passing**. The built output is dated 23:28 and the source 17:59, so it is
current.

1. The wait returns only once Core has finished, carrying every appended entry.
2. An entry landing after `endedAt` is still picked up, because the count must
   repeat on a second read.
3. An unfinished recording fails at the time bound and is never handed on.
4. A recording Core never reports fails as "unseen", not as "empty".
5. An already-finished recording is confirmed in two reads, and both the
   summary shape and the full-session shape are read.
6. The lane proposes from the finished recording. The fake Core grows its
   timeline on a virtual clock, and the test asserts `candidateCount === 4`
   and that the proposal was requested at or after 1500 ms
   (`run-flow-lane.test.ts:98-112`).
7. A recording Core never finishes fails as `recording.persistence`, and no
   proposal is requested (`:114-123`).

**Mutation proof, repeated by me.** The script is
`scratchpad/ifle-mutate-race.mjs`. It copied the built lane, swapped
`run-flow-lane.js` lines 25 and 26 (proposal first, then the wait), and ran the
unchanged test body against the copy. Result: `node --test` exit 1, **0 of 2
pass**:

```text
not ok 1 - the lane proposes from the finished recording, not from the entries Core happens to have appended
    Expected values to be strictly equal:
    1 !== 4
not ok 2 - a recording Core never finishes fails the run, and no proposal is asked for at all
    the lane must not propose from a recording Core never finished
tree files byte-identical: lane true test true (df313174d337 258f7dea7785)
```

**What the unit proof does not cover:**
- a real Core;
- the 30 s bound under load;
- the permanent-loss variant, where an event arrives after finalization and is
  discarded;
- any assertion that the Flow has as many actions as the extension recorded.
  `snapshots/flow-lane.json` makes a shortfall visible but does not fail on it;
- `run-scenario.ts`'s own wait, which has no unit test.

### The exact Lab campaign and its pass condition

**Command, single Lab instance.** This is the method `L-dropped-action` used
for its 12-of-24 baseline. Run from `F:\!FluxIQWebExtension`, build once, and
capture every exit status by redirect:

```sh
pnpm --filter @fluxiq-web-extension/scenario-lab build
pnpm --filter @fluxiq-web-extension/extension test:e2e:build
pnpm --filter "@fluxiq-web-extension/test-runner..." build
for i in $(seq -w 1 24); do
  FLUXIQ_TEST_ENV_FILES=none node packages/test-runner/dist/cli.js run basic-form --flow --target isolated > race-$i.out 2>&1
  echo "$i exit=$?" >> race-status.txt
done
```

**Command, concurrent instances.** Use
`FLUXIQ_LAB_INSTANCE=<label> FLUXIQ_TEST_ENV_FILES=none pnpm lab run basic-form --flow --target isolated`
in the same loop. `pnpm lab` rebuilds on every invocation under a build lock
(`scripts/lab/run-lab.mjs:55-61`), and an instance gets its own build output
(`scripts/lab/lab-instance.mjs:36-42`). Running the direct CLI under an
instance would need the paths `run-lab.mjs` exports
(`lab-instance.mjs:11-15`); I did not verify that. Optionally add four runs on
`--target persistent-isolated --workspace race-fix-probe`, so that Core's
recording can be read afterwards, as `L-dropped-action` campaign 2 did.

**The flag is `--flow`.** `live-validation-plan.md` step 4b (lines 162-178)
still says "recording lane", "roughly one in four" and "four of five
candidates". All three are stale: the defect lives only in the Flow lane,
measured 12 of 24, with a 4-candidate baseline.

**Pass condition. All of the following must hold for every one of the 24 runs:**

1. `exit=0`.
2. `snapshots/flow-lane.json` has `candidateCount` **exactly 4**, the baseline
   `web.dom.type, web.dom.select, web.dom.type, web.dom.click` from
   `L-dropped-action`. Exit status is not enough: `basic-form` expects
   `[web.dom.type, web.dom.select, web.dom.click]`
   (`apps/scenario-lab/src/scenarios/basic-form/scenario.ts:28`), and
   `assertFlowActions` matches with `some` (`flow-lane/expectations.ts:10`).
   **A Flow that lost the second `web.dom.type` exits 0.**
3. No `proposalIssues` entry contains `has not been finalized` (Core's
   open-recording notice). That proves the proposal came from a closed
   recording.
4. No run fails `recording.persistence` with "still being written" at the
   bound. If one does, the bound is the finding, not a pass.
5. Report the distribution of `recording.entriesAppendedAfterStop` and
   `finalizationWaitMs` from `runtime.settle`. That shows the wait was
   actually exercised: a non-zero `entriesAppendedAfterStop` means the old
   code would have lost the race.

**How strong a clean result is.** Zero failures in 24 runs rules out a true
failure rate above about 12% at 95% confidence (the rule of three, 3/24).
Against the measured 50%, the chance of 24 clean runs with nothing fixed is
about 6 in 100 million. The defect was load-correlated: runs 18-24 failed
7 of 7 while the machine was busy. So run the campaign alongside other Lab
instances, or record the machine's load. Under the faulty-RAM rule, a run with
`candidateCount < 4` is a real failure; only a uniform or impossible failure
earns a rerun.

**What this campaign cannot show.** It cannot show the permanent-loss variant.
Core records `recording.action_discarded` only in the gateway audit log
(`bridge.ts:426-437`). The runner reads `/api/client-gateway/snapshot`
(`http-control.ts:109-110`) only to count sessions (`run-scenario.ts:495-497`),
and the Lab deletes Core's store at the end of the run. Automation Studio's own
`client-gateway-snapshot` endpoint returns `auditLog: []` unconditionally
(`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\api\handlers\client-gateway.ts:20`).
**A run can still pass having lost an action after finalization.** Fix D3
below closes that gap.

---

## (b) Why a failing Flow-lane run became an opaque runner error

### Cause 1: the redaction walk threw on a shared object (fixed at HEAD, not yet seen live)

**Mechanism, before `ab736a1`:**
- `persisted-flow-run.ts:70` makes the run-level `failure` the same object as
  the first failing action's `failure` (returned at `:76`).
- `run-scenario.ts:324-325` writes both into `flow-lane.json`.
- The old `redactStructured` kept a visited set it never unwound, so the second
  appearance threw a `RedactionFailure`. That throw happens at
  `test-evidence/src/bundle.ts:135`, inside `writeStructured`.
- A `RedactionFailure` is not a `RunnerFailure`, so `classifyRunnerFailure`
  (`test-runner/src/failure.ts:63-69`) returned `unknown`.

**Saved evidence.** In `test-runs/instances/lab-replay`, four event journals
contain `Circular structured evidence cannot be safely serialized`:
`run-mtz3v24x`, `run-mtz3sh3j`, `run-mtz41r86` and `run-mtz44t9p`. Each has
`failureCategory: "unknown"` in `evaluation.json`.

**At HEAD.** `packages/test-evidence/src/redaction.ts:81-102` tracks only the
current path and unwinds on the way back out. Only a true back-edge becomes
`[CIRCULAR]`.
- `node --test tests/evidence.test.mjs` exits **0, 16 of 16**, including
  `redacts a repeated object reference at every occurrence rather than calling
  it a cycle` (`evidence.test.mjs:77-111`).
- **Mutation, repeated by me** (`scratchpad/ifle-mutate-redaction.mjs`): a copy
  of `dist/redaction.js` with `ancestors.delete(current);` removed fails that
  test's verbatim body with `AssertionError: Expected values to be strictly
  equal ... + undefined`. The unmodified built module passes. Tree file
  byte-identical (`aadb998a6b08`).

**Not yet seen live.** No Flow-lane run exists after `ab736a1`.

### Cause 2: an expectation mismatch drops the lane's own observation (open at HEAD)

**This is what still makes a failing Flow-lane run unexplainable in its
evaluation.**

- `run-flow-lane.ts:90` records the evidence. `:92-94` then asserts the
  expected failure, actions and extraction. Any mismatch throws a
  `RunnerFailure("runtime.behavior")` **before** `:95` consults the fixture
  oracle and **before** `:101-106` builds the `flowLaneObservation`.
- In `run-scenario.ts`, `:333-335` never runs, so `flowObservation`,
  `oracleVerdict` and `automationFailure` stay at their earlier values. For an
  isolated target, `automationFailure` starts as `null` (`:99`).
- `run-scenario.ts:403-409` then substitutes a **recording-lane** observation:
  `lane: "recording"`, `flowCreated: null`. It is built by `probeOutcome`
  (`:598-603`) over the Flow's own actions, which were pushed at `:316`. The
  result is `reportedVerdict: "passed"` when every action succeeded, and
  `{category: "ambiguous_or_unknown"}` otherwise.
- **Result:** the category Core actually reported, which is sitting in
  `snapshots/flow-lane.json`, never reaches `evaluation.json`.
- The bench then discards any non-Flow observation (`bench/evaluate-run.ts:82`)
  and publishes `flowCreated: false`, `automationFailureReported: null` and
  `actions: []` (`:86-95`), **even though a Flow was created and ran**.
- `bench/aggregate-report.ts:116` counts a classification hit only when
  `automationFailureReported.category` equals the expected category. Such a run
  is therefore a classification miss **and** a Flow-creation miss.

**Which runs this hits.** Every Flow-lane run whose Flow:
- reports a different failure category or code than expected;
- succeeds where a failure was expected;
- fails where success was expected; or
- misses an expected action or extraction.

That includes every negative-variant run criterion 4 is meant to measure.
There are 14 `failure: { category` declarations across 11 scenario files under
`apps/scenario-lab/src/scenarios` (a count only, not a mapping of which are
Flow-lane rows).

**Saved evidence.**
- All 11 saved `L-replay` Flow runs (`test-runs/instances/lab-replay/*/evaluation.json`)
  have `"lane": "recording"` and `"flowCreated": null`, although every one ran
  with `--flow`.
- `run-mtz3jzwf` (`ambiguous-targets` / `no-context`, `L-replay` run 4): the
  Flow ran and clicked successfully where `target_ambiguous` was expected. Its
  evaluation reads `reportedVerdict: "passed"`,
  `automationFailureReported: null`,
  `automationFailureExpected: {category: "target_ambiguous", code: "web.target.ambiguous"}`,
  `failureCategory: "runtime.behavior"`, `lane: "recording"`.
- These bundles predate `ab736a1`, but the ordering has not changed. At
  `1b6f5df` the asserts were at `run-flow-lane.ts:83-84`, the observation at
  `:91`, and the fallback at `run-scenario.ts:391`. At HEAD they are at
  `:92-94`, `:101` and `:403`.

**Probe at HEAD** (`scratchpad/ifle-probe-lane-observation.mjs`, against the
built `runFlowLane`, the Flow succeeding, `expected.failure = target_ambiguous`):

```text
rejected: RunnerFailure(runtime.behavior): The Flow reported no structured failure, expected target_ambiguous
error carries an observation: false
recordEvidence called 1 time(s); run.status=succeeded; run.failure=null
fixture oracle consulted: false
```

### Residual path, code read only: some transport errors still become `unknown`

- `persisted-flow-run.ts:64` re-throws anything that is not a `RunnerFailure`.
- `http-control.ts:154-165` turns timeouts and aborts into `RunnerFailure`, but
  a plain `fetch` rejection propagates as it is. Node's `fetch failed`
  `TypeError` carries its code on `cause`, not on the error.
- `classifyRunnerFailure` reads only `error.code` (`failure.ts:65`), so a reset
  socket mid-run would be filed as `unknown`.

Not observed and not probed.

---

## (c) A late recording event reaching the client

### What Core does at HEAD (`368b3c9`)

There are two late-event paths, and they behave differently.

1. **After the bridge has removed the recording from its active set**
   (`bridge.ts:318`). `appendRecordingEvent` finds no active recording
   (`:332-339`) and calls `noteDiscardedClientMessage` (`:426-437`). That
   records `recording.action_discarded` for every executable action, and
   `recording.event_discarded` once per closed recording for evidence. Nothing
   is sent to the client. Core's documentation says so
   (`docs/architecture/automation-studio/client-gateway.md:82-103`: "Nothing is
   sent back to the client. `server.error` is the only wire frame the gateway
   has for this, and a client is entitled to read one as a failed connection,
   so telling a recorder that its action was lost needs a protocol addition
   rather than a reused error code."). Core's tests
   `reports a client action that arrives after its recording was finalized`
   (`bridge.test.ts:310`) and
   `reports discarded evidence once but every discarded action` (`:341`) pass.
   `npx vitest run --no-file-parallelism` on `bridge.test.ts` and
   `open-recording.test.ts` gave **2 files, 15 tests passed, exit 0**.
2. **Between finalization and that removal. Still open; code read, not
   observed.** The chain:
   - `stopRecordingFromClient` awaits `finalizeRecording` (`bridge.ts:313-317`),
     which stamps `endedAt` under the recording mutation lock
     (`service.ts:1038-1047`). It removes the recording from
     `activeRecordings` only afterwards (`bridge.ts:318`).
   - A `client.recording_event` arriving during that await still finds the
     recording active. `recordGatewayInput` (`bridge.ts:543-555`) appends
     through the service, which throws
     `"Finalized recordings are immutable."` (`service.ts:1017`).
   - The gateway event bus awaits every handler
     (`client-gateway/service/event-bus.ts:13`), so the throw escapes
     `receiveRaw`.
   - The WebSocket host catches it
     (`apps/web/src/server/client-gateway-websocket.ts:135-139`) and sends
     `server.error` with **code `gateway.receive_failed`** (`:291-297`).
   - The extension treats any code other than a recording-start refusal
     (`recording-start/refusal.ts:57-70`) as a failed connection:
     `markFailed()` at HEAD `connection.ts:467-477` and
     `server-command-channel.ts:79-85`. That sets the gateway state to `error`
     (`gateway-session.ts:173-175`).
   - No audit entry is written on this path. It is the same load-sensitive
     window that produced the 50% race.

**Code-read aside.** The `client.recording_entry` path flushes on a timer
without awaiting (`void this.flushRecordingEntries(...)`, `bridge.ts:564`,
`:570`). The flush has `try/finally` and no `catch` (`:600-605`), so an append
refused after finalization there would be an unhandled rejection. At HEAD the
extension sends only `client.recording_event` (HEAD `connection.ts:448`, `:702`;
`server-command-channel.ts:232`), so this client does not reach that path.

**The contract.** `server.error` carries `{ message, code?, metadata? }`
(`F:\!FluxIQ\packages\contracts\src\client-gateway.ts:211`). There is no
recording-finalized push message (`client-gateway.md:105-110`).

### What the 30-day plan says

- Week 1 Objective (line 23): *"Create a reliable browser automation foundation
  that allows FluxIQ to execute real workflows, understand browser state,
  identify failures precisely, and provide high-quality evidence to the runtime
  harness."*
- Phase 1.1 step 3 (line 53): *"Verify that recorded user actions correctly map
  to executable outputs."*
- Phase 1.5 exit criteria (line 285): *"The runtime harness receives enough
  structured information to reason about why execution stopped progressing."*
- Week 1 exit criteria (lines 354, 358): *"Core browser actions are reliable."*
  and *"FluxBench exists and produces repeatable measurements."*
- Phase 3.3, Week 3 (lines 745-747): *"Clear recording state"*,
  *"Recording start/stop"*, *"Event feedback"*. Exit criteria (line 756):
  *"Recording feels like a product feature rather than an internal
  development/debug interface."*
- Phase 4.3, Week 4 (lines 1095, 1106): *"Extension reconnect"*,
  *"Stop behavior"*. Requirement (line 1118): *"Failures should leave the
  system in a known recoverable state whenever possible."* Exit criteria
  (line 1122): *"Common operational failures result in understandable behavior
  rather than silent corruption."*
- Priority 1 (line 1460): *"Anything causing otherwise supported workflows to
  behave unpredictably."*
- Rule 1 (lines 1486-1492): *"Do not implement functionality merely because it
  seems useful. ... Which MVP phase, benchmark, acceptance criterion, or
  core-loop problem does this solve? If none apply, defer it."*

### Recommendation

**Out of Week 1: a client-visible error frame for a late event.** Record the
reason in the plan. Week 1 addresses its failure information to "the runtime
harness" (lines 23, 285). Telling the recorder is recording "Event feedback"
(Phase 3.3, line 747). A Stop that loses data is Phase 4.3's "Stop behavior"
(lines 1106, 1122). No Week 1 phase, benchmark row or exit criterion names
client notification, so Rule 1 defers it.

**When it is done, ship both halves in one work unit.** The extension must
first classify the new code as recording-scoped. Without that, Core's frame
would trigger `markFailed()` and tear down a healthy connection.

**In Week 1:**

1. **Close the finalize-to-removal window in Core** (fix C1 below). It is a
   reliability defect under Priority 1: under load, a normal Stop can mark a
   working connection failed. It also emits a `server.error` that no audit
   entry explains.
2. **Make the benchmark able to see a recording that reached Core short**
   (fixes D3 and D4 below). "Recorded user actions correctly map to executable
   outputs" (line 53) and "repeatable measurements" (line 358) cannot be
   claimed while a run that lost an action exits 0.

Core's refusal to build a proposal from an open recording is not needed for
Week 1. The lane now waits for `endedAt`, and Core's issue notice already flags
the case.

---

## Fix design, partitioned by file

The downstream files are listed first, then Core's. Files that share a row
share an owner. D2 and D3 both edit `run-scenario.ts`, so they are serial.

### This repository

| # | Files | Change | Unit proof | Content harness | Lab proof |
| --- | --- | --- | --- | --- | --- |
| D1 | `packages/test-runner/src/flow-lane/run-flow-lane.ts`, `flow-lane/tests/run-flow-lane.test.ts` | Build the `flowLaneObservation` right after `executeRecordedFlowRun` and publish it through `recordEvidence`: add `observation` to `FlowLaneEvidence`, `:44`. Only then run the asserts at `:92-94`. There is a choice about the oracle. Consulting `checkFinalState` before the asserts gives a real `oracleVerdict` but adds latency to failing runs. Publishing `oracleVerdict: null` when the asserts fail avoids that. This is a supervisor decision. | Two new tests. (i) The Flow reports `target_not_found` where `target_ambiguous` is expected: the recorded evidence carries `observation.lane === "flow"` and `automationFailureReported.category === "target_not_found"`, and the rejection is still `runtime.behavior`. (ii) The Flow succeeds where a failure is expected: `reportedVerdict "passed"`, `automationFailureReported null`. **Mutation:** move the publish back after the asserts, and both tests must fail. | None; no extension code changes. | See D2's row. |
| D2 | `packages/test-runner/src/run-scenario.ts`; `flow-lane/lane-observation.ts`, `flow-lane/tests/lane-observation.test.ts` | Set `flowObservation`, `oracleVerdict` and `automationFailure` from the evidence callback (`:315-327`), replacing `:333-335`. Replace the `:403-409` fallback with a small exported selector in `lane-observation.ts`. When `options.flow` is set, it returns `flowLaneObservation({ flowCreated: false, ... })`, matching `bench/evaluate-run.ts:75-79`; otherwise the recording-lane observation. The barrel is `export *` (`flow-lane/index.ts:7`), so no barrel edit is needed. Add the Flow's reported category and code to the error event's `details` at `:348` (Core vocabulary only, no page data). | A selector test in `lane-observation.test.ts`: a Flow-lane run whose lane never published yields `lane: "flow", flowCreated: false`. **Mutation:** return the recording-lane observation, and the test must fail. `run-scenario.ts` itself has no unit test, and `src/tests/` has no headroom (`f-test-runner-ratchet`), hence the selector. | None. | `FLUXIQ_TEST_ENV_FILES=none pnpm lab run ambiguous-targets --flow --variant no-context --target isolated` gives `evaluation.json` `lane: "flow"`, `flowCreated: true`. `... run identity-drift --flow --variant reworded-aria --target isolated` gives `automationFailureReported.category` equal to `snapshots/flow-lane.json` `failure.category`, and no `Circular structured evidence` in `events.ndjson`, which proves Cause 1 live. The invariant for every Flow-lane bundle: when `flow-lane.json` exists, `evaluation.json` says `lane "flow"` and `flowCreated true`. |
| D3 | `packages/test-runner/src/run-scenario.ts` (serial with D2) | After `assertCoreRoundTrip` (`:287`), read `topology.control.gatewaySnapshot()` (`http-control.ts:109-110`). Use this route, whose full snapshot includes the audit log (`F:\!FluxIQ\apps\web\src\app\api\client-gateway\snapshot\route.ts:23-28`); the Automation Studio endpoint returns `auditLog: []`. Write the run recording's `recording.action_discarded` and `recording.event_discarded` entries (type, recordingId, `discardedActions`, `discardedEvents`, `sinceFinalizedMs` only) into `runtime.settle` details. Fail with `recording.persistence` on any `action_discarded` for that recording. Also record the extension's connection state after Stop, via `fluxiq.getStatus`, so fix C1 is observable. | Extract the audit filter into a pure function under `flow-lane/` or `run-expectations/`, with a test in that folder's `tests/`. **Mutation:** drop the recording filter or the fail rule. | None. | The 24-run `basic-form --flow` campaign: every run shows 0 `action_discarded` entries and connection state not `error` after Stop. |
| D4 | `packages/test-runner/src/run-expectations/recorded-events.ts` and its `tests/` (or `flow-lane/finalized-recording.ts`, which already reads the summary) | Compare the extension's executable-event count (the raw tally, `evidence:` prefix kept, per `L-dropped-action`'s instrumentation note) with Core's action count for the recording. Fail as `recording.persistence` when Core has fewer. `service.ts:1538` computes `actionCount` in a recording summary; whether `list-recordings` summaries carry it is **unverified**. Check before building on it. | Tests for equal counts, a short Core count (fails), and an evidence-only extra (does not fail). **Mutation:** compare the collapsed tally. | None. | The 24-run campaign: counts equal on all 24 runs. |
| D5 | `packages/test-runner/src/failure.ts` (optional) | Also read `error.cause.code`, so an undici `fetch failed` with `ECONNRESET` classifies as `process.startup` rather than `unknown`. | A test beside `failure.ts`; its `tests/` location may hit the `src/tests/` ratchet. | None. | Not directly; it shows up as fewer `unknown` rows in the bench. |
| D6 | `docs/working/mvp-week1-web-automation-reliability-plan/live-validation-plan.md` (supervisor-owned) | Step 4b: "recording lane" becomes `--flow`, the rate is 12 of 24, the baseline is 4 candidates, and the pass condition is the one in section (a). | n/a | n/a | n/a |

### FluxIQ Core (user alert required before any edit)

| # | Files | Change | Unit proof | Content harness | Lab proof |
| --- | --- | --- | --- | --- | --- |
| C1 | `packages/fluxiq/src/programs/automation-studio/client-gateway/bridge.ts`, `.../client-gateway/tests/bridge.test.ts` | Route a recording-scoped append refused because the recording has finalized into `noteDiscardedClientMessage`, instead of letting it escape `handleGatewayEvent` (`:203-246`). This covers `recordGatewayInput`, `appendRecordingDomainEvent` and the `client.error` marker. Do not move `activeRecordings.delete` ahead of `finalizeRecording`: that would discard appends that currently win the lock and are kept. Do not match on message text. Add a typed error (a new module, with `service.ts:1017` and `:1267` changed line-neutrally, because `L-core-discard` reports `service.ts` sits exactly on its line baseline; not re-verified), or re-check `endedAt` after catching. Also add a `catch` to the timer-driven flush (`:564`, `:570`, `:600-605`). Update `docs/architecture/automation-studio/client-gateway.md:82-110` in the same unit. | A new `bridge.test.ts` case: hold `finalizeRecording` open, deliver a `client.recording_event`, and assert `gateway.receive` resolves, no `server.error` is sent, and one `recording.action_discarded` is recorded. **Mutation:** remove the guard, and `receive` must reject with `Finalized recordings are immutable.` Run `npx vitest run --no-file-parallelism` on the file. | None. | Through D3: across the 24-run campaign, zero `gateway.receive_failed` and the extension never reaching `error` after Stop. The window is load-sensitive, so run it under the same concurrent load as the baseline. |
| Deferred, not Week 1 | `packages/contracts/src/client-gateway.ts`, `bridge.ts`; downstream `recording-start/refusal.ts` or a sibling classifier, `server-command-channel.ts`, `connection.ts`, panel UI | A recording-scoped `server.error` code for a discarded late action, paired with the extension classifying it as recording-scoped rather than a connection failure, plus user-facing feedback. | n/a | n/a | n/a |

---

## Commands run and observed results

| Command | Observed |
| --- | --- |
| `git log --oneline --diff-filter=A -- packages/test-runner/src/flow-lane/finalized-recording.ts ...` | `ab736a1 Live validation: what the green gates were actually measuring` |
| `git log -1 --format='%h %ci' ab736a1` | `ab736a1 2026-09-12 19:07:56 -0700` |
| `git show --stat 368b3c9` in `F:\!FluxIQ` (filtered) | `bridge.ts` +144, `open-recording.ts` +28, `client-gateway/service.ts` +17, both tests, both architecture docs |
| `stat` on test-runner `src` and `dist` flow-lane files | `dist` 23:28:56 is newer than `src` 17:59:11, so the built output is current |
| `node --test dist/flow-lane/tests/run-flow-lane.test.js dist/flow-lane/tests/finalized-recording.test.js` (packages/test-runner) | exit 0; `# tests 7 # pass 7 # fail 0` |
| `node --test tests/evidence.test.mjs` (packages/test-evidence) | exit 0; `# tests 16 # pass 16 # fail 0`, including test 3 on repeated references |
| `node scratchpad/ifle-mutate-race.mjs` | mutant `node --test` exit 1, 0 of 2 pass, `1 !== 4`; tree hashes identical |
| `node scratchpad/ifle-mutate-redaction.mjs` | mutant FAIL `AssertionError`; built module PASS; tree hash identical |
| `node scratchpad/ifle-probe-lane-observation.mjs` | quoted in (b): rejects `runtime.behavior`, no observation, oracle not consulted |
| `npx vitest run --no-file-parallelism .../client-gateway/tests/bridge.test.ts .../proposals/tests/open-recording.test.ts` (F:\!FluxIQ\packages\fluxiq) | exit 0; `Test Files 2 passed (2)`, `Tests 15 passed (15)` |
| `node scratchpad/ifle-list-runs.mjs` plus decoding run ids under `test-runs/instances/*` | The newest bundles are from `L-dropped-action` (00:03-00:34Z) and `L-replay`/`lab-smoke` (to 01:15Z). **None is after `ab736a1` (02:07Z).** |
| Grep over `test-runs/instances/lab-replay/*/evaluation.json` and `events.ndjson` | 11 of 11 evaluations have `lane "recording"`; 4 journals contain `Circular structured evidence cannot be safely serialized` |

---

## Not verified

- **No Lab run.** The brief forbids it, and none exists after `ab736a1`, so
  neither the race fix nor the redaction fix has ever run live. Section (a)'s
  campaign, plus D2's two runs, is what a Lab run must show.
- **The mutation proofs ran against built JS copies in the scratchpad, not the
  TypeScript source.** The redaction mutation ran the verbatim body of
  `evidence.test.mjs` test 3 rather than the file itself, which imports
  `../dist/index.js` and the contracts package.
- **Core's finalize-to-removal path is a code read only.** It has not been unit
  tested, probed or observed. I inferred the coverage of `bridge.test.ts:310`
  and `:341` from their names and outcomes; I did not read their bodies.
- **Whether `list-recordings` summaries carry `actionCount`**, which D4 depends
  on.
- **`fetch failed` classifying as `unknown`**, and the unhandled rejection on
  the timer-driven flush: code reads only.
- **The cost or safety of consulting the fixture oracle before the asserts**
  (D1's choice): not measured.
- **Load.** No Lab run happened, so no load-correlated behaviour was measured.
  Every number quoted from `L-dropped-action` and `L-replay` is theirs.
- **The extension working tree** differs from HEAD under another worker
  (`connection.ts` 722 changed lines, `server-command-channel.ts` 9). I cited
  HEAD lines; the split may move the `server.error` handling into
  `recorded-event-intake.ts` or elsewhere.

## Open questions or contradictions found

1. **`L-core-discard` says the host's `server.error` for the immutable throw
   carries "no code".** At Core HEAD it carries `gateway.receive_failed`
   (`client-gateway-websocket.ts:297`). The consequence is the same: the
   extension marks the connection failed.
2. **Current State Open work item 1 treats "a failing Flow-lane run became an
   unexplained runner error" as one defect.** Its serialiser half is fixed at
   HEAD. The lane-substitution half (Cause 2) is still open, is not recorded
   anywhere, and it distorts criterion 4's accuracy and Flow-creation success
   in every bench report.
3. **`live-validation-plan.md` step 4b is stale** (it says the recording lane,
   one in four, five candidates), and its implied pass test ("does it still
   happen") cannot be judged by exit status, because of
   `expectations.ts:10`'s `some` matching.
4. **`basic-form`'s `expected.actions` lists `web.dom.type` once**
   (`scenario.ts:28`) although the recording has two. Whether expectations
   should assert counts is a fixture-contract decision, not something this
   investigation settles.
5. **The Lab's Core audit log is unreadable from the bundle today.** The
   operator-visible signal that `L-core-discard` built cannot confirm, from a
   run, that zero actions were discarded. D3 exists for that.
