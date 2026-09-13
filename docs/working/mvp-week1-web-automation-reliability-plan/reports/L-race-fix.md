# L-race-fix — the Flow lane no longer proposes from a recording Core is still writing

Worker `L-race-fix`, 2026-09-12. Downstream half only: nothing in `F:\!FluxIQ`,
`apps/extension/**`, `domain/`, or `packages/test-runner/src/bench/**` was
touched. No Lab run and no `pnpm build` at the repository root. Every exit
status captured by redirecting stdout and stderr to a file and reading `$?`,
never through a pipe.

---

## Outcome

**Done, pending live confirmation.** The Flow lane now waits for Core's own
completion signal before it asks for a proposal, and fails loudly rather than
proposing when the recording never finishes. The regression test that would
have caught this defect exists and was run both ways: it fails against the
pre-fix ordering with `1 !== 4` candidates — the exact signature of the
defect — and passes against the fix.

**The 24-run Lab reproduction has *not* been repeated against this fix**,
because this brief forbids running the Lab (four instances are live and a
build rewrites the shared `apps/extension/build/`). The defect is fixed in the
sense that its mechanism is closed and unit-proven; it is **not** closed as a
field observation. The supervisor should schedule the campaign.

---

## Does Core expose a completion signal? Yes — `endedAt`

This was the first thing to establish, because it decides which shape of fix
is honest. It is a code read of `F:\!FluxIQ` (read-only; nothing edited).

- `AutomationStudioClientGatewayBridge.stopRecordingFromClient`
  (`packages/fluxiq/src/programs/automation-studio/client-gateway/bridge.ts:257-276`)
  handles the extension's `client.stop_recording`: it waits `stopDrainMs`
  (default 250 ms), calls `flushRecordingEntries`, and only then calls
  `automationStudio.finalizeRecording`.
- `finalizeRecording`
  (`packages/fluxiq/src/programs/automation-studio/runtime/service.ts:1038-1048`)
  takes the **recording mutation lock**, stamps `endedAt`, writes the session
  and rewrites the project's recording index entry.
- `appendRecordingEvents` (`service.ts:1014-1017`) takes the same lock and
  throws `"Finalized recordings are immutable."` when `endedAt` is set.

So `endedAt` is a genuine signal, not a proxy: while it is absent the timeline
can still grow, once it is present the timeline can no longer change. That is
exactly the predicate the lane needed, and it is already on the wire — a
`RecordingSession` carries `endedAt`, and `list-recordings` returns it.

Two further facts shaped the implementation:

- `appendRecordingEvents` calls `writeProjectRecordingIndexSummary` on **every**
  append (`service.ts:1023-1025`), so the project recording index tracks the
  appended-entry count live. `list-recordings` with `summaries: true`
  (`api/handlers/workspace.ts:20-28` → `listRecordingSessionSummaries`,
  `service.ts:854-873`) answers from that index and carries `endedAt` plus
  `metadata.eventCount`.
- `list-recordings` *without* `summaries`, and `get-recording`, return the full
  session; `getRecordingSession` **hydrates every state snapshot ref**
  (`runtime/service/recordings/store.ts:48-52`). Polling that would add
  hundreds of kilobytes of object-store I/O per poll to the very machine that
  is losing the race. The summary form is used for that reason.

Because a signal exists, the fix waits on it. The appended-entry count is read
too, but as a **contradiction detector**, not as the definition of completion —
see "What was rejected".

---

## What changed

### New: `packages/test-runner/src/flow-lane/finalized-recording.ts`

`awaitFinalizedRecording(control, { projectId, recordingId }, bounds, wait)`
polls `list-recordings` (`summaries: true`) until the recording reports
`endedAt` **and** its appended-entry count repeats across a confirming read,
then returns `{ recordingId, endedAt, entryCount, waitedMs, polls,
entriesAppendedWhileWaiting }`. Defaults: 30 s bound, 200 ms interval;
`now`/`sleep` are injectable so the tests drive a virtual clock.

At the bound it throws `RunnerFailure("recording.persistence", …)` with three
distinct messages — the recording was never reported, it was still being
written, or it reported finished while still growing — carrying
`recordingSeen`, `endedAt`, `entryCount`, `entriesAppendedWhileWaiting`,
`waitedMs`, `polls` and `timeoutMs` in `details`. **It never returns a
recording it could not confirm.**

The reader accepts Core's envelope, `automationStudioCall`'s unwrapped payload,
or a bare array, and takes the entry count from `metadata.eventCount` when
present and `timeline.length` otherwise — so it is correct against both the
summary and the full session shape, and does not silently read `0` if a Core
build ignored `summaries`.

### `packages/test-runner/src/flow-lane/run-flow-lane.ts`

The wait is now the lane's first step, before `createRecordingFlowProposal`.
`FlowLaneInput` gains an optional `recordingWait` (bounds and clock; production
passes none), and the finished recording travels on `FlowLaneEvidence` and
`FlowLaneOutcome` so the runner can record it.

### `packages/test-runner/src/run-scenario.ts`

`assertCoreRoundTrip` returned as soon as the new recording **id** appeared,
which it does immediately — the id exists from `client.start_recording`. It now
awaits `awaitFinalizedRecording` for each recording the run produced, so its
own capture event, "Core persisted the completed recording", is true when it
says so. The wait applies only when a recording baseline was supplied: without
one every recording in the project counts as "new", and an unrelated open
recording must not fail the run. The Flow lane holds the same wait on the exact
recording it builds from, so nothing depends on that.

The run bundle now records what was waited for. `snapshots/flow-lane.json`
carries `recording: { recordingId, entryCount, entriesAppendedAfterStop,
finalizationWaitMs, polls }` beside `candidateCount`, and the
`runtime.settle` capture event carries the same per-recording figures. A Flow
short of an action is now visible as **fewer candidates than timeline entries**,
in the bundle, on a passing run.

### `packages/test-runner/src/flow-lane/recording-flow-proposal.ts`

`RecordingFlowProposal` now carries Core's `issues`, and
`snapshots/flow-lane.json` writes them on every run. They were read and dropped
on the success path, surfacing only when the proposal was empty — which is why
the *partial* runs arrived with no explanation and why this defect survived
from Wave 2. (Fix-list item 3 of `L-dropped-action`; it is in an owned file and
costs three lines.)

---

## What was rejected, and why

- **A fixed delay before proposing.** The same bug with a longer fuse. The
  observed spread was 2.4 s typically and 5 s in one run, on a machine under
  load that will be slower again; any constant is both too short and too long.
- **Polling until the candidate or entry count is non-zero.** That is the
  failure mode itself — runs 08, 13, 14, 22, 23, 24 proposed from a non-zero
  count of 2.
- **Proceeding at the timeout.** Proposing from a partial recording *is* the
  defect. The bound raises `recording.persistence` and the run fails.
- **Count-stability as the primary rule.** It was the honest fallback only if
  no signal existed; one does. A stability rule alone cannot distinguish a
  frozen timeline from one that paused for a poll interval, which is precisely
  the confusion that produced 3-candidate runs. The count is kept as a second
  read that must repeat, so an entry landing after `endedAt` — which Core's
  immutability rule says cannot happen — is picked up rather than proposed
  past, and so the numbers reach the bundle.
- **Polling `get-recording` or the unsummarised list.** Correct but expensive:
  both hydrate every state snapshot ref on every poll, adding I/O load to the
  race being waited out.
- **Putting the wait only in `run-scenario.ts`.** Cheaper by one call, but it
  leaves the lane's precondition unowned and untestable. The lane now
  guarantees its own input; `assertCoreRoundTrip` also waits so the non-Flow
  lanes stop reporting a completed recording that is still open.
- **Anything in Core, the extension, or the recorded-event assertion.** Core's
  `createRecordingFlowProposals` should refuse an unfinalized recording the way
  `processFinalizedRecording` does, and the two silent discards should be made
  loud; that is the Core worker's half. `run-expectations/recorded-events.ts`
  cannot see this loss by construction (fix-list item 5) and is not mine.

---

## The test that would have caught it

`packages/test-runner/src/flow-lane/tests/run-flow-lane.test.ts` drives
`runFlowLane` against a fake Core whose timeline grows on a virtual clock:
one action entry visible at t=0, the rest landing at 300/600/900 ms, `endedAt`
at 1500 ms — and whose `create-recording-flow-proposals` returns **one
candidate per entry visible at the moment it is called**, which is what Core
actually does. The Lab reset is stubbed at `globalThis.fetch`.

`packages/test-runner/src/flow-lane/tests/finalized-recording.test.ts` covers
the wait itself: the signal, the confirming read, the loud timeout on an
unfinished recording, the unseen recording, and the full-session payload shape.

### Against the old behaviour — fails

The pre-fix ordering was restored by moving `awaitFinalizedRecording` to
*after* `createRecordingFlowProposal` (the source was backed up and restored;
this reproduces the defect exactly — the proposal is requested before the
recording is finished — while keeping the file compiling against the new
evidence type).

`node --test "dist/flow-lane/tests/run-flow-lane.test.js"` → **exit 1**,
2 tests, 0 pass, 2 fail:

```
not ok 1 - the lane proposes from the finished recording, not from the entries Core happens to have appended
  error: |-
    Expected values to be strictly equal:

    1 !== 4
  expected: 4
  actual: 1

not ok 2 - a recording Core never finishes fails the run, and no proposal is asked for at all
  error: |-
    the lane must not propose from a recording Core never finished
    + actual - expected

    + [
    +   0
    + ]
    - []
```

One candidate of four, requested at virtual time 0 — the same shape as
persistent run 4 of `L-dropped-action` (1 candidate, 4 entries on disk).

### Against the fix — passes

`node --test "dist/flow-lane/tests/run-flow-lane.test.js" "dist/flow-lane/tests/finalized-recording.test.js"`
→ **exit 0**, 7 tests, 7 pass, 0 fail:

```
ok 1 - the wait returns only once Core has finished the recording, with every entry it appended
ok 2 - an entry that lands after Core's completion signal is still picked up, because the count must repeat
ok 3 - an unfinished recording fails at the bound and is never handed on, carrying what was observed
ok 4 - a recording Core never reports fails as unseen rather than as empty
ok 5 - a recording already finished is confirmed in two reads, and the full session shape is read as well as the summary
ok 6 - the lane proposes from the finished recording, not from the entries Core happens to have appended
ok 7 - a recording Core never finishes fails the run, and no proposal is asked for at all
```

The source was restored from the backup before this run and the package
rebuilt, so `packages/test-runner/dist` matches `src`.

---

## Commands run and observed results

All from `F:\!FluxIQWebExtension` with `EXTENSION_TEST_BUILD_LABEL=l-race-fix`.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/test-runner check` (first, after the edits) | exit 0 |
| `pnpm --filter … test` (run 1) | exit 1 — 435 tests, 434 pass, **1 fail**: my own `finalized-recording` stability test asserted a stronger property than the code delivers. Test and documentation corrected (see "Open questions", item 1) |
| `pnpm --filter … test` (run 2) | exit 1 — 399 tests, 392 pass, 7 fail, **all** `ERR_MODULE_NOT_FOUND … node_modules/fluxiq/dist/programs/automation-studio/index.js` in `demo-llm-*`/`demo-workspace` files. FluxIQ Core's `dist` was being rewritten by the concurrent Core worker. My seven tests passed in this run |
| `pnpm --filter … test` (run 3, rerun per the hardware rule) | **exit 0 — 435 tests, 435 pass, 0 fail** |
| `node scripts/structure-audit.mjs` | exit 0 — "passed (31 warning(s), 19 baselined)"; every warning pre-existing |
| `node --test dist/flow-lane/tests/run-flow-lane.test.js` (pre-fix ordering) | exit 1 — 2 tests, 0 pass, 2 fail, quoted above |
| `node --test dist/flow-lane/tests/{run-flow-lane,finalized-recording}.test.js` (fix) | exit 0 — 7 tests, 7 pass, 0 fail, quoted above |
| `pnpm --filter … check` (final, attempt 1) | exit 2 — 48 errors, **all** `Cannot find module 'fluxiq/…'` from `domain/dist/*.d.ts`; Core's `dist` mid-rebuild again (`find … -newermt "-3 minutes"` showed live writes) |
| `pnpm --filter … test` (final) | **exit 0 — 435 tests, 435 pass, 0 fail** |
| `pnpm --filter … check` (final, rerun) | **exit 0 — 0 errors** |

No `pnpm lab`, no root `pnpm build`, no `--target existing`, no persistent
workspace touched, `.env.local` untouched.

**On the machine.** Two of the failures above were caused by the FluxIQ Core
worker rebuilding `F:\!FluxIQ\packages\fluxiq\dist` while my checks ran; both
cleared on rerun with the same source. Neither fits the faulty-RAM signature
(both were deterministic module-resolution errors naming the file being
rewritten), and neither involved a file I changed. The package `test` script
runs `pnpm build` first, so it rebuilds `packages/test-runner/dist` — the
brief authorises that; it does not touch `apps/extension/build/`.

---

## Not verified

- **The 24-run Lab reproduction against this fix.** Not run, by instruction.
  This is the proof that matters and it is outstanding. Expect the campaign to
  be run on `isolated` and on `persistent-isolated`.
- **Any live Core call.** `list-recordings` with `summaries: true`, the shape
  of its response, and the latency of the poll are code reads of
  `F:\!FluxIQ` plus unit tests over both response shapes. No request was made
  to a running Core.
- **The 30 s bound.** Chosen against an observed worst case of about 5 s. It
  has never been hit in anger, and whether it is generous enough on a loaded
  machine with four Labs is unmeasured. If a run fails with "Core was still
  writing the run's recording after 30000 ms", the bound is the first thing to
  question — but the failure is loud, which is the point.
- **The second, rarer variant of the defect.** `L-dropped-action`'s persistent
  run 1 lost two actions *permanently*: they reached Core after the finalize
  and were discarded. Waiting for `endedAt` cannot recover those, and this
  change does not claim to. It makes them **visible** —
  `snapshots/flow-lane.json` now shows `recording.entryCount` beside
  `candidateCount`, so a recording that reached Core short is legible — but it
  does not *assert* the extension's executable-event count against Core's
  entry count, which is fix-list item 5 and lives in
  `run-expectations/recorded-events.ts`, a file I do not own. **A run can still
  pass having lost an action this way.**
- **Firefox and any non-Chromium browser.** Not exercised.
- **Scenarios other than `basic-form`.** The change is scenario-independent,
  but nothing was run.
- **Whether the added wait changes run duration materially.** It adds one
  confirming poll (~200 ms) per wait in the common case, twice per Flow run
  (`assertCoreRoundTrip` and the lane), plus however long Core actually needs —
  time the lane previously spent racing. Unmeasured against a real run.

---

## Open questions and contradictions found

1. **My first stability test asserted more than a signal-plus-one-repeat design
   can deliver**, and it failed: with appends 300 ms apart and a 100 ms poll,
   two identical reads occur mid-stream, so the wait returned 3 entries where
   the test demanded 5. I did not weaken the check silently. The design
   question is real: a repeat-once rule is a contradiction detector, not a
   completion rule. Because `endedAt` *is* the completion rule and Core refuses
   appends after it, one confirming read is the proportionate weight, and the
   test and the module documentation now say exactly that. If Core's
   immutability guarantee were ever relaxed, this check would need a settle
   window instead.
2. **`assertCoreRoundTrip` without a recording baseline still does not wait.**
   Every current caller passes one. I left the unbaselined path alone rather
   than guess which recording it meant, and the Flow lane's own wait makes the
   guarantee unconditional where it matters. Worth removing the optionality
   later.
3. **Core's half is still open and is the more important half.**
   `createRecordingFlowProposals` builds a proposal from an unfinalized
   recording and reports success, while `processFinalizedRecording` — the
   product's own path — refuses it. Until Core refuses or flags it, every other
   client of that endpoint has the same defect the lane just fixed for itself.
4. **The structure audit says "1 baseline entries can be lowered."** I did not
   run `pnpm structure:baseline`: `.structure-baseline.json` is shared and the
   improvement is not mine to claim. The supervisor should regenerate it when
   the tree is quiet.
5. **The backup of the pre-fix source** is at
   `…\scratchpad\run-flow-lane.ts.fixed` (the *fixed* file, used to restore
   after the old-behaviour run); the captured outputs are `check1.txt`,
   `test1.txt`, `test2.txt`, `test3.txt`, `old-behaviour.txt`,
   `new-behaviour.txt`, `structure.txt`, `check-final*.txt`, `test-final.txt`
   under
   `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\d34796a3-e118-42bc-aed6-635ca623e0da\scratchpad`.
