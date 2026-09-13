# f-recording-start-guard: one recording start when FluxIQ's acknowledgement races the local fallback

Worker report, 2026-09-13, at `HEAD 0d9981c` (dev), label `frsg`. Includes the
supervisor's mid-task amendment: an acknowledgement that crosses the extension's
own Stop.

## Outcome

Done. `active-recording.ts` now starts a recording once, whichever way the
acknowledgement and the local start interleave:

- **Double start fixed.** An acknowledgement while a start is under way waits for
  that start, then links its project. The local start's missing project no longer
  overwrites FluxIQ's.
- **Mismatched id ignored.** An acknowledgement naming another recording is
  ignored while a start is pending, under way, or running.
- **Stop crossing fixed (amendment).** An acknowledgement naming the recording
  this client last stopped is ignored.
- **Lookup bounded.** The project lookup a start waits on now gives up after
  1,500 ms.

The five new rows all failed before the fix, with real assertion diffs. Seven
mutations each fail a row, and each restore was byte-identical. Extension `check`
and `test` pass. The structure audit fails only on the supervisor's two working
documents.

Re-verified at HEAD first: `active-recording.ts` was clean in `git status`, and
`beginAccepted` had no guard for a start under way (`:179-200` at HEAD). The race
was not already settled.

## What changed and why

### `apps/extension/src/background/connection/active-recording.ts` (the one file; it is also where the lookup is bounded)

- **One start at a time (`beginOnce`, `:247-262`).** Both ways into a recording
  go through it:
  - `beginAccepted` (`:207`);
  - the local fallback, `beginWithoutAcceptance` (`:381`).

  A start is marked in `starting` (`:94`) the moment it is decided, before its
  first await. For the local start, that is before its project lookup. Another
  start that arrives meanwhile loops on `starting.finished` (`:248`). It then
  finds the recording running and only calls `linkProject` (`:264`). So the two
  apply in arrival order, and FluxIQ's project is linked after the local start
  finishes.

  The former body of `beginAccepted` is now `startRecording` (`:272`), and its
  statements are unchanged. `finished` never rejects, so a failed start releases
  its waiters, and they re-evaluate.
- **Which acknowledgements are answers (`expectsStart`, `:232`).** A
  `server.start_recording` is ignored when either holds:
  - it names the recording this client last stopped. `stop()` records it at
    `:187`, synchronously, before the stop message is sent, so "stopping" counts
    as well as "stopped";
  - a start is pending, under way, or a recording is running, and the command
    names none of those ids.

  An ignored command changes nothing: no `noteAccepted`, no persist, no link. It
  adds one activity entry, "Recording start ignored" (warning). With nothing
  pending, under way, running or just stopped, the command is still taken as
  FluxIQ's own start from the web panel. The existing row at `:308` relies on
  that.
- **The bound (`lookUpProject`, `:334`; `RECORDING_START_PROJECT_LOOKUP_BOUND_MS
  = 1_500`, `:53`).** It races `projects.resolve` against a timer. It is used by
  `sendStart` (`:309`) for every attempt, and by the local start.

  **When the bound is reached**, the start goes on as it does when no project is
  known:
  1. It logs "Project lookup timed out" (warning).
  2. The attempt is sent without a `projectId` (`metadata.projectId: null`), for
     FluxIQ to accept or refuse. A transient refusal is retried through the
     handshake as before, with a fresh bounded lookup.
  3. When the window has elapsed, the settled send begins the local fallback.
     That local start does not wait on the stalled lookup a second time. The
     marker is `lookupBoundReachedFor` (`:99`), per recording id. It goes on with
     `projects.current()`, records unlinked ("Project context pending"), and takes
     the project from FluxIQ's acknowledgement if one arrives.
  4. The lookup itself is left to finish. `ProjectContext` keeps whatever it
     finds.

  So a fully stalled lookup reaches the local fallback about 1,500 ms after the
  press, plus the gateway send. The alternative was 3,000 ms, waiting twice.
- **Why here and not `core-api.ts:34` or `project-context.ts:48`.** The bound is
  a recording-start policy: how long a pressed Record waits.
  - A fetch timeout in `core-api.ts` would also change the evidence path's lookups
    (`connection.ts:132`).
  - It could only be proven through a second test file this brief does not own.
  - Racing in the caller also bounds a stall anywhere inside `resolve`, including
    `adoptProjectId`'s session write, not only the HTTP read.
- The public methods `noteStartRefusal` and `cancelStart` moved above the private
  helpers. Their text is unchanged. The file is 400 lines, exactly at the 400-line
  advisory threshold, which only warns above 400, so it is not flagged. The class
  has 21 methods (the advisory threshold is 25).

### `apps/extension/src/background/connection/tests/active-recording.test.ts`

- **Helpers.** `fakeTimers` gains `fire(delay)`, which fires only the timers with
  that delay. `harness` gains a `lookup` option, so a row can hold the project
  lookup open.
- **Changed row `:308`.** Its second acknowledgement used a *different* id
  (`recording-2`) and asserted a relink. The brief makes that an ignored
  mismatch, so the row now relinks with the same id (`recording-1`). The mismatch
  itself is covered at `:430`.
- **New rows:**

| Row | What it holds |
| --- | --- |
| `:397` | P1's shape: the window fires, the local start is looking its project up, and the acknowledgement for the same id arrives. One start event, one "Recording started", one attach, snapshots `[Initial, Project-linked]`, project `project-1`, session `project-1`. |
| `:420` | Two acknowledgements for the same id, the second before the first finished starting. One start event, one attach, one snapshot. |
| `:430` | A mismatched id while pending: state stays idle, window still open, nothing persisted, "Recording start ignored". While the local start is under way: the local id wins, one start event. While running: id and project link untouched, no snapshot. |
| `:458` | Amendment. A local start runs, then `stop(true)`. An acknowledgement for that id while the stop is being sent, and another after it, leave state idle. One start event, one attach, the stop is the last message, "Recording start ignored". |
| `:483` | Lookup never settles. Nothing sent, and timers `[750, 1500]`. At 750: still idle. At 1500: one send without a project, state `recording` under the sent id, `resolveReasons` `["recording_start"]` (no second wait), project `null`, "Project lookup timed out", nothing left armed. Then a later start looks the project up again. |

All rows stub the socket, so they hold whether or not Core's
`g-core-start-order` acknowledgement has landed.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`. Exit codes were captured by redirecting to a
file and echoing `$LASTEXITCODE`.

1. **Before the fix.** `active-recording.ts` held only the exported constant,
   with no behaviour, so the test could import it. The rows were bundled with
   `pnpm exec esbuild` into `.test-build-scratch/frsg-head` and run with
   `node --enable-source-maps --test`.
   - Result: `bundle exit=0`, `test exit=1`, `# tests 13 # pass 8 # fail 5`.
   - `:397` failed at `:412`: `one start event 2 !== 1`. This is the double start.
   - `:420` failed at `:425`: `one start event 2 !== 1`.
   - `:430` failed at `:439`: `it does not answer the pending start + 'recording' - 'idle'`.
   - `:458` failed at `:473`: `an acknowledgement while the stop is being sent does not restart it + 'recording' - 'idle'`.
   - `:483` failed at `:492`: `Expected values to be strictly deep-equal: [750, -1500]`. Actual was `[750]`, because no bound existed.
   - The existing 8 rows passed, including the edited `:308`.
2. **After the fix, same focused run.** `bundle exit=0`, `test exit=0`,
   `# tests 13 # pass 13 # fail 0`.
3. **`EXTENSION_TEST_BUILD_LABEL=frsg pnpm --filter @fluxiq-web-extension/extension check`.**
   - Result: `check exit=0`. The output was only the two `tsc` command lines.
   - Rerun after the last test edit: `check exit=0` again.
4. **Mutation proofs.** `node <scratchpad>/frsg-mutate.mjs` (script exit 0).
   Each mutation was applied to `active-recording.ts`, the test file was bundled
   and run alone, then the original bytes were written back. Every restore
   printed `sha256 before=8d0c1374…6ba0 after=8d0c1374…6ba0 identical=true`.

| Mutation | Result | Failing row: assertion |
| --- | --- | --- |
| M1: no join (`while (this.starting) await …` removed) | `# fail 2` | `:397` at `:412` `one start event 2 !== 1`; `:420` at `:425` `one start event 2 !== 1` |
| M2: the start is marked only after `await project()` | `# fail 3` | `:397` at `:412` `2 !== 1`; `:420` at `:425` `2 !== 1`; `:430` at `:448` `2 !== 1` (the start under way) |
| M3: a joined start waits, then returns without linking | `# fail 1` | `:397` at `:415`, snapshots missing `'Project-linked snapshot captured'` |
| M4: `expectsStart` returns `true` for any id | `# fail 1` | `:430` at `:439` `it does not answer the pending start + 'recording' - 'idle'` |
| M5: the stopped-recording check removed | `# fail 1` | `:458` at `:473` `an acknowledgement while the stop is being sent does not restart it + 'recording' - 'idle'` |
| M6: the lookup is not raced against the bound | `# fail 1` (rerun) | `:483` at `:500` `at the bound the start is sent without a project 0 !== 1` |
| M7: the local start ignores `lookupBoundReachedFor` | `# fail 1` | `:483` at `:504` `and the local fallback begins + 'idle' - 'recording'` |

   - **M6 on its first run** reported `# pass 12 # fail 0` with the row `not ok`.
     The row awaited the never-settling press before its assertions, so node
     cancelled the test instead of failing an assertion. I moved `await pressed`
     below the assertions and reran M6 alone (`frsg-mutate.mjs M6`). That rerun
     is the failure quoted above, and its restore was identical.
   - **M7's line** was observed before that one-line move. The same assertion is
     now `:503`.
   - **Unmutated reruns** after both scripts: `test exit=0`,
     `# tests 13 # pass 13 # fail 0`.
5. **`EXTENSION_TEST_BUILD_LABEL=frsg pnpm --filter @fluxiq-web-extension/extension test`.**
   `test exit=0`, `# tests 405 # pass 405 # fail 0 # cancelled 0`. The tree
   also held other workers' uncommitted extension changes
   (`content/recorder.ts`, untracked `content/tests/recorder.test.ts`), so that
   count includes them.
6. **`node scripts/structure-audit.mjs`.** `audit exit=1`,
   `structure-audit: 2 violation(s) across 1 rule(s).`
   - `FAIL [working-docs] docs/working/mvp-week1-web-automation-reliability-plan.md: 862 lines exceeds the 800-line …`.
     `git status`: ` M`. Not mine.
   - `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks`.
     `git status`: clean. It is most likely stale because of the plan's header.
   - On my files, the only finding is a warning, not a failure:
     `warn [file-lines] …/tests/active-recording.test.ts: 516 lines is past the 400-line advisory threshold`.
     `active-recording.ts` (400 lines) is not listed.
7. **Cleanup.** The scratch folders `frsg-head`, `frsg-one` and `frsg-mut` were
   removed (`Test-Path` → `False` for each). The runner's own
   `.test-build-scratch/frsg` stays; it is ignored.

## Not verified

- **No Lab or browser run** (none allowed in this dispatch). Lab Stage 2 should
  exercise this at a commit that has Core's `g-core-start-order`, which now sends
  `server.start_recording`. What a Lab run must show:
  - exactly one `browser.tab` event with `recordingState: "started"` per
    recording, and one "Recording started" activity, including runs where the
    acknowledgement lands after the 750 ms window;
  - when FluxIQ has a project, the recording ends linked to it, and the
    extension's `activeRecordingProjectId` is not `null`;
  - after Stop, the extension stays idle. There is no second start event and no
    discard audit for entries after the Stop;
  - no "Recording start ignored" or "Project lookup timed out" in ordinary runs.
    Either one appearing under load is itself a finding: a crossing Stop, or a
    project lookup slower than 1,500 ms.
- **The 1,500 ms value was chosen, not measured.** I did not measure how long
  `GET /api/client-gateway/snapshot` takes under two-instance Lab load.
- **Core's acknowledgement was not exercised.** All rows stub the socket. I did
  not read Core.
- **Content harness not run.** The change is background-only.
- **A real `fetch` that stalls** was not driven. The rows stub
  `ProjectContext.resolve`, not `core-api.ts`.

## Open questions or contradictions found

1. **A second Record press while a local start is under way starts a second
   handshake.** `start()` refuses only while `handshake.isPending()`, and the
   handshake cancels itself before the local start begins. A press during the
   local start's lookup or tab query sends a new `client.start_recording` under a
   new id. This is older than this change, and I did not fix it: the brief's
   three cases are about the acknowledgement. The fix is one condition,
   `|| this.starting`, in `start()`, plus a row.
2. **A refusal or a Stop during a start under way is lost.**
   - `stop()` returns unless the state is `recording`.
   - `applyRefusal` sets the state to idle and the block.

   In both cases the start then carries on to `recording`. Both are older than
   this change, and I did not probe them.
3. **Is an acknowledgement with nothing pending, running or just stopped really
   FluxIQ's own start?** I kept that path, because the web panel can start a
   recording, and the row at `:308` covers it. The brief's "neither the pending
   nor the active recording's" is read as applying only when one of those
   exists. The supervisor should confirm.
4. **A stalled lookup can still link a project silently later.**
   `project-context.ts:54` does `this.activeRecordingProjectId ??= projectId`,
   which also replaces `null`. If the lookup outlives its bound and later
   answers, the running recording is linked without a "Project-linked snapshot".
   That is not owned here.
5. **Still unbounded:**
   - `fetchProjectIdFromCoreSnapshot` (`core-api.ts:34`) still has no timeout;
   - the evidence path's `resolveProjectId` (`connection.ts:132`) is not bounded;
   - the gateway send itself (`gateway-session.ts`) can still hold the local
     fallback, as `handshake.ts`'s comment says.
6. **The barrel is not updated.** `RECORDING_START_PROJECT_LOOKUP_BOUND_MS` is
   not re-exported from `connection/index.ts`, which is not owned. Only the test
   imports it, directly from the file.
7. **The test file is past the advisory threshold** at 516 lines (warning, not
   failure). A later brief could move the start-race rows into their own test
   file under `connection/tests/`.
8. **The structure audit's two failures** are the supervisor's working documents,
   as in `f-recording-start-send`.
