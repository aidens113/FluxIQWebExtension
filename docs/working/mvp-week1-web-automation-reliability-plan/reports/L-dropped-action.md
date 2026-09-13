# L-dropped-action — the silently dropped recorded action, reproduced and localised

Worker `L-dropped-action`, 2026-09-12. Diagnostic only: **no source file was
changed.** 28 Lab runs on `isolated` and `persistent-isolated`, every exit
status captured by redirect to a file, never through a pipe. No
`--target existing`, `.env.local` untouched, the three pre-existing persistent
workspaces untouched.

---

## Outcome

**Reproduced, 12 failures in 24 runs (50%), and localised — but not where the
plan assumed.**

The action is **not** lost between the page and Core's recording, in the usual
case. Core's recording ends up **complete**. What is short is the *proposal*,
because the Flow lane asks Core to build one while Core is still writing the
recording's timeline. The recording finishes correctly a few seconds later, so
nothing afterwards looks wrong — which is exactly why the defect is silent.

A second, rarer variant does lose the action permanently: the event reaches
Core after the recording has been finalized and is discarded with no error.

Against the brief's three options — recorded-but-never-proposed,
proposed-but-not-persisted, persisted-and-lost-later — the answer is the
**first**, with the important refinement that "never proposed" is a *timing*
failure against a recording that is still being written, not a mapping failure
against a recording that is missing the event.

---

## The numbers

### Campaign 1 — `isolated`, 24 runs

`FLUXIQ_TEST_ENV_FILES=none node packages/test-runner/dist/cli.js run basic-form --flow --target isolated`

Baseline on this tree is **4 candidates**: `web.dom.type, web.dom.select,
web.dom.type, web.dom.click`. (Wave 2's `SELECT_VALUE_CHANGE_KEYS` rule in
`domain/src/io/input-model.ts` now suppresses the select typeahead keypress, so
the "5 candidates" of the Wave 2 report is no longer the passing shape. That
change is deliberate and is not this defect.)

| Result | Runs | Which |
| --- | --- | --- |
| 4 candidates — pass | 12 | 01-07, 09, 11, 15-17 |
| 3 candidates — **click lost** | 3 | 10, 18, 21 |
| 2 candidates — **select and one type lost** | 6 | 08, 13, 14, 22, 23, 24 |
| no proposal at all — **everything lost** | 3 | 12, 19, 20 |

**12 of 24 failed (50%).** Per-run wall time 53-100 s, median about 66 s.

Failures are strongly load-correlated and were not uniform over the campaign:
runs 01-07 (17:04-17:12) were all clean; runs 18-24 (17:22-17:29) all failed.
See "What else was happening on the machine" below.

### The diff that proves it — passing vs failing

The extension's own recorded-event tally is **identical in all 24 runs**,
passing and failing alike:

```
{"web.form.submitted":1,"web.element.clicked":1,"web.element.input_changed":2,
 "web.element.changed":1,"web.keyboard.pressed":1,"web.tab.state_changed":1}
```

Every run recorded the click. Only the proposal differs. So the loss is
downstream of the extension's recording log and upstream of the Flow.

### The three total-loss runs name the stage

Runs 12, 19 and 20 failed at `createRecordingFlowProposal`, and Core said why,
in its own words (from the run bundle's error event):

```
"No mapper-visible entries remained after compacting high-frequency state.
 The recording contains no entries."
"Mapper web-recording-actions emitted no valid action candidates ... It saw 0
 entries (no entries), matched 0, emitted 0 raw candidates, and accepted 0
 valid candidates."
```

Core's recording timeline was **empty** at the moment the proposal was built —
not "missing the click", empty. That rules out the mapper, the candidate
validator and any per-event classification bug: there was nothing to map.

### Campaign 2 — `persistent-isolated`, 4 runs, and the decisive evidence

`... run basic-form --flow --target persistent-isolated --workspace dropped-action-probe`

`persistent-isolated` retains `fluxiq-root/.fluxiq/`, so Core's recording
survives the run and can be read afterwards. All four runs failed. Reading each
recording's `index.json` **after** the run (read-only; no Core state modified):

| Run | Candidates in the proposal | Action entries in Core's recording, read afterwards |
| --- | --- | --- |
| 1 | 2 | **2** |
| 2 | 2 | **4** |
| 3 | 3 | **4** |
| 4 | 1 | **4** |

Three of the four recordings hold **all four actions**. The Flow was built from
two, three and one of them. The action was recorded, was persisted, and was
still missing from the Flow — because the proposal was generated before the
write finished.

### And the append timestamps show why

From run 2's recording index (offsets relative to the recording's `startedAt`;
`started` is the extension's event time, `appended` is when Core actually wrote
the entry):

```
entry.3 action  started=+1119ms  appended=+2127ms
entry.4 action  started=+1132ms  appended=+2893ms
entry.5 action  started=+1527ms  appended=+3459ms
entry.6 action  started=+1528ms  appended=+4125ms
recording endedAt (the client's stop timestamp) = +1773ms
```

The four user actions happen inside 410 ms. Core takes **2.4 seconds after the
extension has already stopped recording** to finish appending them. Run 4 is
worse: its last two appends land at +6162 ms and +6838 ms.

The Flow lane requests the proposal roughly 0.5-1 s after the stop. The
candidate count in every failing run equals the number of action entries Core
had appended by that instant. That is the mechanism, and the correlation holds
across all four persistent runs.

---

## Why nothing reported it — four silent seams, all real

1. **The lane asks for a proposal without waiting for the recording to close.**
   `packages/test-runner/src/run-scenario.ts:280` calls `assertCoreRoundTrip`,
   which (`run-scenario.ts:461-474`) polls `list-recordings` only until the new
   recording **id** appears. The id exists from `client.start_recording`, so the
   first poll succeeds immediately. `runFlowLane` then calls
   `create-recording-flow-proposals` at once. Nothing anywhere waits for
   `endedAt`.

2. **Core will build a proposal from a recording that is still open.**
   `createRecordingFlowProposals`
   (`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\service.ts:2368`)
   does not check `endedAt` and does not take the recording mutation lock, so it
   reads whatever timeline exists at that moment and reports success.
   `processFinalizedRecording` — the product's own path — *does* refuse an open
   recording ("Recording is still open."), so the product is protected where the
   lane is not.

3. **The lane throws Core's own explanation away.** `create-recording-flow-proposals`
   returns an `issues[]`; `packages/test-runner/src/flow-lane/recording-flow-proposal.ts`
   reads it but surfaces it only on the two throw paths (no proposal, no
   candidate). In the partial-loss runs Core may well have said something useful
   and the lane discarded it. That is why the three total-loss runs are the only
   ones that arrived with a diagnosis attached.

4. **The runner's recorded-event check cannot see the loss, by construction.**
   `assertRecordedEvents` (`packages/test-runner/src/run-expectations/recorded-events.ts`)
   reads only the *extension's* activity log and deliberately collapses
   executable and evidence events into one count per type. The extension writes
   its log entry in `processRecordingEvent`
   (`apps/extension/src/background/connection.ts:413-436`) **before** the
   `captureEventSnapshot` await and **before** `gateway.send`, so the assertion
   can pass on an event Core never received. That is precisely what happened in
   all 12 failures.

---

## The second variant: permanently lost, not merely late

Persistent run 1's recording holds only 2 action entries and always will
(`eventCount: 5, actionCount: 2`, `endedAt` +2145 ms, last append +2312 ms).
Two of the user's four actions are simply not in it.

The mechanism follows from the same slow pipeline. Core's stop handler
(`bridge.ts:263-276`) waits `stopDrainMs` (default **250 ms**), flushes, then
finalizes. Two silent discard points follow:

- `appendRecordingEvent` at `bridge.ts:279-280`:
  `const active = this.activeRecordings.get(...); if (!active) return;` — an
  event arriving after `activeRecordings.delete` is dropped with no error, no
  log, and nothing sent back to the client.
- `appendRecordingEvents` at `service.ts:1017` throws
  `"Finalized recordings are immutable."` for an event that arrives after the
  finalize. The extension sends `client.recording_event` fire-and-forget over
  the socket with no ack
  (`F:\!FluxIQ\packages\client-gateway-websocket\src\transport.ts:71-90`), so it
  never learns the event was refused.

Both discard an action the user really performed while the run reports success.

I did **not** observe which of these two fired for persistent run 1 — that needs
Core-side logging that does not exist today.

## Why the events are late in the first place

Each executable event's `client.recording_event` is sent only *after*
`await this.evidence.captureEventSnapshot(...)`, a cross-frame DOM snapshot
(`connection.ts:427-430`). Four actions inside 410 ms therefore queue four
snapshot captures, then four appends, each of which dehydrates a roughly 25 KB
state object into the object store (observed in the retained project's `objects`
table). Under load the whole chain runs hundreds of milliseconds to seconds
behind the user.

There is also a narrower race worth recording:
`apps/extension/src/background/connection/gateway-session.ts:183-186` tests
`this.client?.connected` and then awaits `client.send`, which throws if the
socket closed in between. That rejection escapes to a fire-and-forget
`chrome.runtime.sendMessage` listener
(`apps/extension/src/background/index.ts:152-155`), so the event is neither
queued to the offline queue nor retried — it is simply gone. I did not observe
this firing; it is a code-read finding.

---

## What the fix would be (not implemented, per the brief)

In rough order of value:

1. **Make the Flow lane wait for the recording to be closed.** Extend
   `assertCoreRoundTrip` (or add a step before `runFlowLane`) to poll until the
   new recording reports `endedAt`, and only then request the proposal. This
   alone would have turned 9 of my 12 failures green, and it is a one-function
   change in `packages/test-runner/src/run-scenario.ts`. It is a *test-lane*
   fix, so it must not be mistaken for a product fix.
2. **Make Core refuse, or at least flag, a proposal built from an open
   recording.** `createRecordingFlowProposals` should either reject an
   unfinalized recording the way `processFinalizedRecording` does, or return an
   issue saying the recording was still open. This is a FluxIQ Core change
   (`packages/fluxiq/src/programs/automation-studio/runtime/service.ts`) and it
   crosses the repository boundary — the supervisor should raise that with the
   user before anyone starts it.
3. **Stop discarding Core's `issues`.** Have the Flow lane record
   `proposal.issues` into `snapshots/flow-lane.json` on every run, not only on
   failure. Cheap, local to this repository, and it would have shortened this
   investigation to one run.
4. **Make the two silent Core discards loud** — `bridge.ts:280` and the
   immutable-recording throw should report a client error, so a recording that
   lost an event says so.
5. **Make the harness able to see the difference at all.** The recorded-event
   assertion should compare Core's action count against the extension's
   executable-event count rather than tallying the extension's log alone. Today
   a recording that reached Core with half its actions is indistinguishable from
   a perfect one.

I would **not** start with the extension's snapshot-before-send ordering. It
makes the window wide, but the window exists regardless, and the correctness bug
is that a consumer reads a recording before it is closed.

---

## Instrumentation I wanted and did not have

Stated because the brief asked for it. None of it was added.

- The **raw** extension tally with the `evidence:` prefix intact (the runner
  computes it in `readExtensionRecordingLog` and then collapses it). Without it
  I could not tell an executable click from an evidence-only click at the
  extension boundary; I had to get Core-side truth instead.
- The extension's `queueSize`, `eventCount` and connection-state transitions in
  the run bundle. `recordingStartDiagnostic` already collects exactly these
  fields but only writes them when the recording fails to start.
- Core's `issues` on a successful proposal (item 3 above).
- A Core-side log line on each of the two silent discards.

---

## Commands run and observed results

All from `F:\!FluxIQWebExtension`, one Lab process at a time, never two at once.
Every exit status captured by redirecting stdout and stderr to files and reading
`$?`; never through a pipe.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/scenario-lab build` | exit 0 |
| `pnpm --filter @fluxiq-web-extension/extension test:e2e:build` | exit 0; `apps/extension/build/` clean afterwards (`git status --short apps/extension/build` empty) |
| `pnpm --filter "@fluxiq-web-extension/test-runner..." build` | exit 0 |
| `FLUXIQ_TEST_ENV_FILES=none node packages/test-runner/dist/cli.js run basic-form --flow --target isolated` x 24 | 12 x exit 0, 12 x exit 1; candidate counts 4/3/2/none as tabulated above |
| `FLUXIQ_TEST_ENV_FILES=none node packages/test-runner/dist/cli.js run basic-form --flow --target persistent-isolated --workspace dropped-action-probe` x 4 | 4 x exit 1; candidates 2, 2, 3, 1 |
| `node --experimental-sqlite` read-only reads of the retained workspace, plus reads of `recordings/*/index.json` | no write; used only to count timeline entries by type |

`pnpm lab` itself was **not** used: it rebuilds on every invocation, and this
task needed 28 runs against one fixed build. The three prebuild steps above are
exactly `pnpm lab`'s own prefix, run once; the runs then used the built CLI
directly, as `v-facility` section 7 recommends.

## What else was happening on the machine

Reported because it bears on the numbers.

- The tree moved under me. At my build (17:02) `apps/extension/src/content/**`
  and `apps/extension/src/background/**` were clean. By 17:38 roughly twenty
  files under `apps/extension/src/content/**` were modified, and
  `apps/extension/build/content/index.js` (a **tracked** artifact) was rewritten
  at **17:35** — that is a `pnpm build` by someone else while my Lab campaign was
  running, the exact hazard the plan's safety rule 3 names. My last run finished
  at 17:35, so at most the final persistent run overlapped it.
- My results therefore characterise **commit `1b6f5df` plus the uncommitted
  `packages/test-runner/**` changes present at 17:02**, not the tree as it stands
  now. `apps/extension/build/content/index.js` and its map are currently dirty;
  they were clean immediately after my build, so that change is not mine.
- The failure rate climbed from 0/7 to 7/7 across the campaign as the machine
  got busier. That is consistent with the diagnosis (a race won or lost on write
  latency) and is not consistent with a content-dependent bug.

**On the faulty RAM.** None of these failures fits the hardware signature. They
are not uniform (four distinct outcomes), they carry real assertion diffs, they
reproduce 12 times in 24, and the mechanism is confirmed by timestamped state
Core wrote to disk. Two runs also showed the known parallel-load symptoms (login
7.8-8.4 s) without failing. I am confident this is a product/lane defect, not
memory corruption.

## Not verified

- **Which of the two silent Core discards** claimed the two actions permanently
  missing from persistent run 1. Both paths exist in code; neither logs.
- **Whether the extension ever failed to send** an event, as opposed to sending
  it too late. The extension emits no delivery record and the gateway sends no
  ack, so this cannot be distinguished from outside without new instrumentation.
- **The gateway-session `connected`-then-throw race** is a code read only; I
  never observed it fire.
- **The exact instant the lane's proposal request reached Core.** The
  correlation between candidate count and appended-entry count is exact across
  four runs and the append timestamps bracket it, but I did not capture the
  request timestamp itself.
- **Firefox, and any browser other than Chromium.** Not exercised.
- **Whether the same race affects other scenarios.** Only `basic-form` was run.
  Any recording lane with several actions in a short burst should be equally
  exposed; `iframe-checkout` and the multi-step rows are the ones to check.
- **Whether fix (1) alone makes the lane green.** Untested — I changed nothing.

## Open questions and contradictions found

1. **The brief says "recording lane"; the defect lives in the Flow lane.**
   Candidates only exist on the Flow lane (`--flow`), which is what Wave 2's
   `w2-flow-lane` actually ran. The plain recording lane never builds a proposal
   and so cannot show this defect — which also means **the `week1` bench, being
   recording-lane only, would never have caught it.** I ran the Flow lane; the
   open-questions entry and the plan's step 4b should be corrected to say so.
2. **The open-questions entry says the rate is "one in four" and the rerun
   passed.** On this tree at this load it is one in two, and reruns keep failing
   once the machine is busy. The entry understates it.
3. **Two of the four Wave 2 runs failed, not one.** Both historical bundles are
   still on disk: `test-runs/run-mtxnnve4-d922e2c2` (4 candidates, click lost)
   and `test-runs/run-mtxn37ng-24c53313` (4 candidates where 5 were expected).
   The second was read at the time as an action-type-join failure, but its
   candidate count shows it lost an action too.
4. **A fix in FluxIQ Core is part of the real answer** (item 2 of the fix list).
   That crosses the repository boundary and needs the user told first.
5. **The `dropped-action-probe` persistent workspace is left in place**, at
   `test-runs/persistent-isolated/dropped-action-probe/`. It holds the four
   recordings this diagnosis rests on. It is mine and new — the three
   pre-existing workspaces were not touched — and it is safe for the supervisor
   to delete once the evidence has been read. I did not delete it because
   deleting persistent workspaces by hand is the plan's documented hazard, and
   because it is the only surviving copy of the decisive data.
6. **28 new run bundles** are under `test-runs/` (git-ignored). The failing ones
   worth keeping are runs 08, 10, 12, 18, 19 and 20 of the isolated campaign; my
   per-run captures are in the scratchpad at
   `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\d34796a3-e118-42bc-aed6-635ca623e0da\scratchpad\L-dropped-action\{isolated,persistent}\`.
