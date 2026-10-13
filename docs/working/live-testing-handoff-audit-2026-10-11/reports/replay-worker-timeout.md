# Replay worker timeout: root cause (replay-mv62rwy7-fcb23be8)

Worker report. Read-only investigation of tree
`C:/Users/osrs_/FluxStuff/fxwork/t275/!FluxIQWebExtension` (HEAD 2cb2d1c2, dev f2d100a6 merged).
No Lab, provider, build or test command was run by this worker.

## Outcome

Done. `lab replay` never reaches the t455 recovery. It launches Chrome itself in
`saved-flow-replay/replay-browser.ts:openReplayBrowser` and calls the bare
`awaitExtensionWorker`. The t455 commit 3ca4092f changed only the `lab run` path
(`run-scenario.ts` and `launch-extension-session.ts`), not the replay.
`replay-saved-flow.ts:replaySavedFlow` then drops `RunnerFailure.details` when it
builds the receipt. Nothing masks the first failure. The evidence does not support a profile, lock,
port or Chrome handover race with the preceding build. It cannot fully exclude a
lingering Chrome child process; see section 3. The supervisor's correct rerun
(replay3, `replay-mv62zkqz-aa2333d2`, started later on an idle slot) **passed** and
did not reproduce the failure: run succeeded, 4 of 4 records matched, content hash
unchanged, 0 provider calls, keys preserved.
The cause of the observation gap itself is still unexplained, as it was in t455,
and the replay path keeps no evidence that could explain it.

## What changed and why

Only this report. Findings follow, by question.

### 1. Launch path and the t455 recovery

- Path: `replaySavedFlow` (`packages/test-runner/src/saved-flow-replay/replay-saved-flow.ts:170`)
  -> `openReplayBrowser` (`replay-browser.ts:37`) -> `chromium.launchPersistentContext` (line 42)
  -> `installDeterministicNetworkGuard` (line 47) -> `awaitExtensionWorker(context)` (line 53).
- It bypasses `launchExtensionSession` (`run-scenario/browser-session/launch-extension-session.ts`),
  the only place the one-time normal close and relaunch exists. `git log` on
  `replay-browser.ts` shows 722787d6 (creation) and e144e962 (forget cached workers).
  The file history does not include 3ca4092f, and the 3ca4092f stat does not list the file.
- Even if the replay called the t455 predicate, recovery would not fire.
  `observationGap()` (`launch-extension-session.ts:54`) requires
  `details.extensionStage === "worker"` and `details.workerMs >= timeoutMs`. Only the
  wrapper `extensionControlPage` (`run-scenario/extension-control-page.ts:70-79`) adds
  those two fields. The bare `awaitExtensionWorker`
  (`run-lifecycle/extension-readiness.ts:66-72`) sets only `timeoutMs`,
  `observedWorkerCount` and `browserConnected`.
- The replay launch is weaker than the run launch in three other ways:
  - It omits `networkContainmentArgs`, so there are no host-resolver containment
    switches. `launch-browser.ts:34` has them.
  - It never awaits `guard.serviceWorkersProven()` before pairing. It only calls
    `assertNoViolations()` at the end of a successful replay (`replay-saved-flow.ts:195`).
  - It has no `ExtensionStartTrace`, so there are no CDP target records. The session
    directory is also removed in `finally` (`removeRunOwnedTopologyState`), so a
    replay that fails here leaves no evidence of whether Chrome had the worker target.
- `guarded-browser/tests/launch-containment.test.ts:22,78` sanctions `replay-browser.ts`
  as a direct launcher and checks only that the guard is installed before `newPage(`.
  So nothing structural pushed the replay onto the recovered path.

### 2. Where the details are lost; masking

- The details are lost in `replay-saved-flow.ts:197`, in the `catch` of
  `replaySavedFlow`:
  `state.error = { category: classifyRunnerFailure(error), message: ... }`.
  `SavedFlowReplayResult.error` (line 99) has no field for details, so `resultOf`
  cannot carry them.
- Nothing masks the first failure:
  - `openReplayBrowser`'s catch (lines 67-69) closes the context best-effort and
    rethrows the same error.
  - The replay path has no relaunch.
  - `replaySavedFlow`'s `finally` swallows every cleanup failure.
  - The profile timestamps show a single 30 s Chrome session (see 3).
- Fixing the receipt alone is not enough. Today the bare readiness error has no
  `extensionStage`, so the existing closed projection `extensionStartFailureDetails`
  (`extension-control-page.ts:110`) would return `undefined` for it. The receipt fix
  must land together with routing the replay through `extensionControlPage` /
  `launchExtensionSession` (fix B), or the projection test would pass on fixtures
  only.
- `browserConnected` is always `false` for a persistent context, which has no
  `browser()` handle (t455 report). The field means nothing here.

### 3. Profile, port, lock and Chrome handover from the build

There is no evidence of a race. Profile times are local (-0700) and converted here to UTC.

| UTC | Event | Source |
| --- | --- | --- |
| 02:41:18.06 | Build final event "Scenario completed" | `run-mv62icw0-070f88ad/events.ndjson` |
| 02:41:21.2 | Build's Chrome last writes `History` and `DIPS` in `t275-d/browser-profile/Default` | profile mtimes |
| 02:41:27.2 | Build bundle complete; ledger finish 02:41:27Z | run dir mtimes, brief |
| 02:42:19.2-.4 | Replay Chrome launches: `Last Version`, `LOG`, `Extension State`, `Service Worker` dir recreated | profile mtimes |
| 02:42:49.59 | Replay Chrome shuts down (`Local State`, `Preferences`, `Default`), exactly 30 s after launch, which is the readiness timeout | profile mtimes |
| 02:42:49.97 | Receipt written | replay json mtime |

- About 58 s separate the build's last Chrome write from the replay's Chrome launch.
- The replay took the workspace `.operation.lock` (`coordinator.ts:97`).
  `acquireWorkspaceOperationLock` throws "already locked by live process" if the
  build's process were still alive.
- `scenarioPortRetained: true` means port 60766 was free.
- `launchPersistentContext` itself succeeded. A live Chrome holding the same
  user-data-dir makes a second launch hand off and exit, so the failure would be at
  launch, not at the worker stage. That is general Chromium singleton behaviour; I
  did not test it here.
- Lane B's replay used another slot and so another profile.
- No handover fix is justified by this evidence.
- Weighing the rerun's timing, as the supervisor asked. Replay1 started about 20 s
  after the build finished and failed. Replay3 started later on an idle slot and
  passed.
  - Spacing: the supervisor says replay3 started about 25 minutes after the build.
    The profile shows replay3's Chrome launching at 02:48:13Z (`Default/Service Worker`
    and `Extension State` recreated at 19:48:13 local), about 6.8 min after the
    02:41:27Z ledger finish. The supervisor should reconcile the two figures. Either
    way, the spacing differs.
  - What one failure and one pass can tell: they cannot separate "soon after a build
    on the same profile" from an intermittent gap. t455 saw the same split with no
    preceding build (C run-mv4p3qri).
  - Against a handover cause: the build's own Chrome had already flushed and exited.
    Its last profile writes were at 02:41:21, 58 s before replay1's launch. Every
    exclusive resource the Lab owns (workspace lock, scenario port, user-data-dir
    singleton) was free when replay1 took it.
  - Not excluded: an orphaned Chrome child process (GPU, utility or crashpad) from the
    build still exiting. I cannot check that now, because process state from 02:42Z is
    gone.
  - So handover is not supported, but it is not ruled out as a contributor. The next
    occurrence should decide it rather than a speculative fix. Add a closed probe to
    the start trace proposed in fix B: before launch, whether
    `<profile>/lockfile` exists (Chrome on Windows holds it while running), and the
    milliseconds since the profile's newest `Default/` write. The probe records codes
    and integers only and gates nothing.
- Caveat: replay3 recreated `Default/Service Worker` at 19:48:13 local, so replay1's
  worker registration state is gone. In replay3 the worker script was cached within
  0.2 s of launch.

### 4. Proposed fix (named files, fail-first tests)

These are not retry-until-pass and do not raise any timeout. The relaunch is t455's
existing one-time, evidence-gated recovery.

**A. Keep the details in the receipt**

- New file `saved-flow-replay/replay-error.ts`, exporting `replayErrorOf(error)`. It
  returns `{ category, message, details? }`, where `details` is
  `extensionStartFailureDetails(error)` imported from `../run-scenario/index.js`. That
  projection is closed: codes and integers only, never the browser's message or URLs.
- `replay-saved-flow.ts:197` uses it, and the `SavedFlowReplayResult.error` type gains
  an optional `details`.
- Fail-first test `saved-flow-replay/tests/replay-error.test.ts`:
  - A worker-stage `RunnerFailure` with `workerMs`, `timeoutMs`, `observedWorkerCount`
    and `browserConnected` keeps those four fields.
  - A non-extension error has no `details`.
  - A details object carrying an extra string or URL field is projected away.

**B. Put the replay on the recovered path**

- `saved-flow-replay/replay-browser.ts` replaces lines 41-55 with
  `launchExtensionSession(topology, input.extensionPath, { scenarioOrigins: scenarioNetworkOrigins(topology.scenarioOrigin), trace, onLaunched: s => (latest = s.context) })`,
  imported from `../run-scenario/index.js`. There is precedent: `extension-chat-check`
  already imports `launchBrowser` from there.
- That one call brings everything the replay lacks:
  - containment arguments and forgotten cached workers (`launchBrowser`);
  - the guard (`installRunNetworkGuard`);
  - worker-stage details and the control-page retry (`extensionControlPage`);
  - the t455 one-time normal close and relaunch;
  - an awaited `serviceWorkersProven()` before pairing.
- On failure, close `latest`. `launchExtensionSession` leaves the final context to its
  caller.
- Keep a real `ExtensionStartTrace` and write its sidecar beside the receipt
  (`replays/<id>.extension-start.local.json`, via `writeExtensionStartSidecar`; check
  its signature). The next natural gap would then show whether Chrome's CDP had the
  worker target while Playwright saw none.
- Add an optional `launchSession` injection point to `openReplayBrowser` for tests.
- Fail-first tests:
  - `saved-flow-replay/tests/replay-browser.test.ts`: with the fake
    `launch`/`openControl`/`findTarget` seams used in
    `launch-extension-session.test.ts`, a first proved observation gap closes the
    first context and returns a session from the second launch. A second failure
    closes the second context and keeps the original error. Today `openReplayBrowser`
    has no such path, so the test fails.
  - `guarded-browser/tests/launch-containment.test.ts`: remove `replay-browser.ts`
    from `SANCTIONED`. Assert that it contains `launchExtensionSession(` before
    `newPage(` and matches no direct `LAUNCH`. This fails today.
- Update the replay contract in `docs/architecture/testing-facility.md` (the t455
  recovery section) so it names the replay path. Remove the duplication note at the
  top of `replay-browser.ts` if `pairScenarioExtension` and `activateScenarioTab` move
  to `run-lifecycle/` at the same time. That move is optional and is the same
  ownership note the file already carries.

**C. Profile handover**

No change. The evidence in section 3 rules out a race for this incident.

## Commands run and observed results

All were read-only inspection.

- Read the receipt `test-runs/instances/t275-slot-4/replays/replay-mv62rwy7-fcb23be8.json`:
  error `extension.worker` "Timed out waiting for the Chrome extension service worker",
  no details, `run:null`, hash after `null`.
- Read `d-r12-replay1.log`: the prelude finished at 6892 ms, then the receipt was
  printed and `ELIFECYCLE` exit 1.
- `d-r12-replay2.log` was ignored per the supervisor's correction.
- Read `d-r12-replay3.log` and the receipt `replay-mv62zkqz-aa2333d2.json`: verdict
  passed, run `succeeded`, hash before = after `1a9e1c57...`, calls 0, keys
  preserved 1/1, error null.
- Slot-4 replay history: mv4vpbu9 failed (not extension.worker); mv4xm81z, mv5k0lge,
  mv5u87p9 and mv62zkqz passed; mv62rwy7 failed with extension.worker.
- `ls --time-style=full-iso` on the workspace, profile, `Default` and the build run
  directory gave the timeline in section 3.
- `git log` and `git show --stat 3ca4092f` gave the file lists cited in section 1.

## Not verified

- The natural cause of the Playwright worker observation gap. It is still
  unreproduced and has no trace on the replay path.
- What replay1's `observedWorkerCount` was. It was dropped, so I cannot say whether
  t455's predicate would have matched on that count.
- Whether Chrome registered the worker in replay1; replay3 overwrote that store.
- That a Chrome holding the same profile fails at launch, not at the worker stage. I
  reasoned this from Chromium's singleton behaviour and did not test it.
- The exact signature of `writeExtensionStartSidecar`.
- The dispatch from `run-lab.mjs replay` to `replaySavedFlow`. I inferred it from the
  receipt shape and the fact that `replayId` is produced only there; I did not trace
  it through `cli.ts`.
- None of the proposed tests were written or run.

## Open questions or contradictions found

- `launch-containment.test.ts` sanctions a replay launch that has no containment
  switches. Its rationale ("installs the guard before opening any page") is true, but
  the replay is weaker than the run lane, and the test does not notice.
- The replay discards its session logs on every outcome, including failure. Should a
  failed replay keep them (or the trace sidecar) the way a run bundle does?
