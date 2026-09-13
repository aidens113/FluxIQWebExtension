# f-recording-start-send: begin locally only after the start was sent

Worker report, 2026-09-13, at `HEAD 31a921c` (dev), label `frss`.

## Outcome

Done. E1 is in: the acceptance window is still armed before the send, but an
elapsed window now begins recording locally only once that attempt's send has
settled. Three handshake rows cover it, and the brief's mutation fails one of
them, as do three more mutations. Both C2 behaviours are confirmed with file:line
and now each has a row.

One contradiction was found and proven with a probe (see Open questions 1): the
second behaviour, "an acknowledgement after a local start changes nothing but a
project link", holds only once the local start has *finished*. An
acknowledgement that arrives while the local start is still under way starts the
recording twice and drops the project link. The fix belongs in
`active-recording.ts`, which this brief does not own.

Re-verified at HEAD first: `handshake.ts` was unmodified (`git status` clean for
`recording-start/`), and `acceptWindowElapsed` called `beginLocally`
unconditionally, so E1 was not already settled.

## What changed and why

### `apps/extension/src/background/connection/recording-start/handshake.ts`

- `PendingStart` gains `inFlightSend` (the latest attempt's send, until it
  settles) and `localStartDue` (that attempt's window elapsed while its send was
  in flight).
- `sendPending` (`:150-169`) still arms the window first. It records the send's
  promise (`:161`). When the send settles, the promise is checked against the
  latest attempt's (`:165`), so a late earlier attempt settling is ignored. If
  the window elapsed meanwhile, recording begins locally then.
- `acceptWindowElapsed` (`:172-180`) marks the start due instead of beginning
  while a send is in flight. `startLocally` (`:182-186`) begins only if this is
  still the pending start (object identity, not the recording id).
- `noteRefusal` clears the due mark (`:121`): a refusal is still an answer after
  the window elapsed, while only the send was left.
- An acceptance needs no change: `noteAccepted` → `cancel` (`:96-105`) drops the
  pending start, so the settling send finds it gone and begins nothing.
- Comments: the header's `unanswered` line and the comment above `sendPending`
  now state the new rule and its price. A send that never settles never falls
  back: the start stays pending, and a second press says so, until it is
  cancelled. The old comment called that case "exactly the silence the local
  fallback exists for", which is no longer true. The send's lookup,
  `fetchProjectIdFromCoreSnapshot` (`core-api.ts:34`), has no timeout. The
  gateway send (`gateway-session.ts:183-199`) awaits `client.send` or the
  offline-queue write.

### `recording-start/tests/handshake.test.ts`

The file gains a `heldSends()` helper (sends the test settles by hand), a
`settle()` helper, and an optional `hold` argument to `harness`. Three rows:

- `:196` An elapsed window begins locally only once the start's send has
  settled. It asserts no `beginLocally` before release, that the start is still
  pending, then exactly one local start after release.
- `:216` An answer between the elapsed window and the settled send still
  decides:
  - an acceptance: nothing begins;
  - a transient refusal: nothing begins, and the retry stays armed.
- `:239` A retry's window waits for the retry's own send, not an earlier
  attempt's.

### `apps/extension/src/background/connection/tests/active-recording.test.ts` (C2 rows)

- `:334` An acknowledgement inside the window starts the recording once, and the
  window never fires.
- `:358` An acknowledgement after a local start changes nothing but the project
  link. It checks that the id and the event count are kept, and that the project
  goes from `null` to `project-1` with one project-linked snapshot. It also
  checks: no second start event, no re-attach, and nothing sent. A repeated
  acknowledgement changes nothing.

Both rows stub the socket, so they hold whether or not Core's C2 acknowledgement
has landed.

### Item 2: the two behaviours, with file:line

1. **A `server.start_recording` inside the window is accepted, and recording
   starts once.**
   - The chain: `server-command-channel.ts:128-130` → `beginAccepted`
     (`active-recording.ts:179`).
   - `:180` calls `handshake.noteAccepted()` synchronously, before any await.
     That clears the acceptance timer and the pending start
     (`handshake.ts:96-105`).
   - The start path (`active-recording.ts:191-218`) then runs once.
   - Existing coverage did not drive this:
     - `server-command-channel.test.ts:142-151` stubs `beginAccepted`;
     - `active-recording.test.ts:301` calls it with no start pending;
     - the handshake row "an accepted start cancels the pending retry" covers
       only the retry timer.
   - New row `:334`. Mutation M4, where `noteAccepted` does not cancel, fails it
     ("the acknowledgement closed the window").
   - Note: `beginAccepted` never compares the command's `recordingId` with the
     pending id. Any `server.start_recording` ends a pending start and records
     under the command's id (see Open questions 2).
2. **One arriving after a local start changes nothing but a project link**
   (`active-recording.ts:184-190`).
   - True once `recordingState` is `"recording"` (`:200`).
   - `:301` covered this branch only for a recording begun by an acknowledgement
     with a different id. The new row `:358` covers the C2 shape: a local
     fallback, then Core's acknowledgement for the same id.
   - Not mutated: the guard is in `active-recording.ts`, which is not owned.
   - It does **not** hold while the local start is in progress (Open
     questions 1).

## Commands run and observed results

All from `F:\!FluxIQWebExtension`. Exit codes captured by redirecting to a file
and echoing `$?`.

1. Focused run. `pnpm exec esbuild` bundled the two edited test files into
   `apps/extension/.test-build-scratch/frss-one`, then
   `node --enable-source-maps --test` ran them. Result: `bundle exit=0`,
   `test exit=0`, `# tests 18 # pass 18 # fail 0`.
2. `EXTENSION_TEST_BUILD_LABEL=frss pnpm --filter @fluxiq-web-extension/extension check`
   → `check exit=0`. The output was only the two `tsc` command lines.
3. Mutation proofs: `node <scratchpad>/frss-mutate.mjs` (script exit 0). For
   each mutation the script applied it, bundled and ran the two test files,
   wrote the original bytes back, and compared SHA-256 hashes:
   - **M1 (the brief's):** `acceptWindowElapsed` begins locally at once.
     `test exit=1`, `# pass 15 # fail 3`:
     - `handshake.test.ts:196:1`: "the window elapsed, but the start is not on
       the wire yet";
     - `:216:1`: "FluxIQ accepted, so the settling send begins nothing";
     - `:239:1`: "the first send settling says nothing about the retry's".
   - **M2:** the settle check `pending.inFlightSend === send` replaced with
     `true`. `# fail 1`: `:239:1` "the first send settling says nothing about
     the retry's".
   - **M3:** the `localStartDue = false` in `noteRefusal` removed. `# fail 1`:
     `:216:1` "a refusal answered the window, so the settling send begins
     nothing".
   - **M4:** `noteAccepted` no longer cancels. `# fail 3`:
     - `handshake.test.ts:216:1`;
     - `handshake.test.ts:258:1` ("an accepted start cancels the pending retry");
     - `active-recording.test.ts:334:1`: "the acknowledgement closed the
       window".
   - After each mutation: `restored handshake.ts: sha256
     before=1bbd7ab5…dec5 after=1bbd7ab5…dec5 identical=true`.
   - **P1 (probe, not kept):** a temporary row appended to
     `active-recording.test.ts`. `test exit=0`, and it printed
     `PROBE {"state":"recording","startEvents":2,"recordingStartedLabels":2,"attached":[7,7],"snapshots":["Initial snapshot captured","Initial snapshot captured"],"activeProject":null,"resolveReasons":["recording_start","recording_start_timeout"]}`.
     Then `restored active-recording.test.ts: sha256 before=abf53c30…3017
     after=abf53c30…3017 identical=true`.
   - Unmutated rerun at the end: `test exit=0`, `# pass 18 # fail 0`.
4. `EXTENSION_TEST_BUILD_LABEL=frss pnpm --filter @fluxiq-web-extension/extension test`
   → `test exit=0`, `# tests 395 # pass 395 # fail 0`.
5. `node scripts/structure-audit.mjs` → exit 1,
   `structure-audit: 2 violation(s) across 1 rule(s).` Neither is in a file this
   brief owns:
   - `FAIL [working-docs] docs/working/mvp-week1-web-automation-reliability-plan.md: 819 lines exceeds the 800-line compaction threshold`.
     `git status`: ` M` (a supervisor edit, not mine).
   - `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks`.
     `git status`: clean. It is most likely stale because of the plan document's
     header edit.
   - A search of the audit output for `recording-start|active-recording` found 0
     lines, so there is no warning on my files. Line counts: `handshake.ts` 187,
     `handshake.test.ts` 281, `active-recording.test.ts` 386 (under the
     400-line advisory).
6. `git diff --stat` on the three files: `3 files changed, 181 insertions(+), 14 deletions(-)`.

The run-scoped build folders `frss-one` and `frss-mut` were removed afterwards.
The runner's own `.test-build-scratch/frss` stays; it is ignored.

## Not verified

- **No Lab or browser run** (none allowed in this dispatch). What a Lab run must
  show, on a run whose start did the project lookup (one
  `GET /api/client-gateway/snapshot` in `core.log` before the start):
  - no recording entry, event, snapshot or state update from the extension
    reaches Core before its `client.start_recording`;
  - no discard audit naming that run's recording id before activation;
  - Core's recording holds every action the extension counted;
  - exactly one `browser.tab` event with `recordingState: "started"` per
    recording.
- **Whether the lookup ran during Stage 1** is inferred by `i-recording-loss`;
  I did not re-check it.
- **The cost of E1 was not exercised.** A stalled project lookup now keeps the
  start pending with no local fallback, and nothing bounds that lookup. I did not
  re-read whether the facade cancels a pending start on disconnect. The handshake
  row "disconnecting cancels the handshake" calls `cancel()` directly.
- **Core's C2 acknowledgement** was not checked or exercised. The rows stub the
  socket.
- **The guard for behaviour 2** (`active-recording.ts:184-190`) was not mutated,
  because the file is not owned.
- **Content harness** not run: the change is background-only, and the E1 design
  says "Content harness: none".

## Open questions or contradictions found

1. **An acknowledgement during a local start starts the recording twice.** The
   local start first waits on `projects.resolve` (`active-recording.ts:281`). Its
   `beginAccepted` then waits on `persistSession` (`:182`) and `allTabs` (`:198`)
   before `recordingState` is set (`:200`). An acknowledgement in that window
   also passes the `:184` check and runs the full start.
   - **Observed (probe P1):**
     - two start events and two "Recording started" entries;
     - the tab attached twice and two initial snapshots;
     - the project link ends `null`, because the local start's `null` overwrote
       the acknowledgement's `project-1`.
   - **Why E1 makes it likelier.** With C2, Core answers as soon as it has opened
     the recording. After E1, a window that elapsed during a slow send begins
     locally the instant that send settles, which is exactly while Core is
     opening the recording. So E1 makes this collision likelier in the slow-send
     case it fixes. The race already existed at HEAD whenever Core took longer
     than 750 ms.
   - **Suggested brief:** own `active-recording.ts` and its test. Make a start
     in progress visible synchronously at the top of `beginAccepted`, or have
     both paths join one starting promise, and never replace a linked project
     with `null`. Add this probe as the row.
2. **`beginAccepted` ignores which recording is pending.** A
   `server.start_recording` for a different id (for example a start requested
   from the web panel) cancels the extension's pending start and records under
   the command's id. The brief's wording "for the pending id" holds, but a
   mismatched id is not rejected. Is that intended?
3. **Should the send be bounded?** E1 trades "a hung send falls back after
   750 ms" for "a hung send never falls back". A timeout on
   `fetchProjectIdFromCoreSnapshot` (`core-api.ts:34`, `project-context.ts:48`),
   or a second, longer ceiling in the handshake, would restore a bounded
   fallback. Supervisor's call; neither file is owned here.
4. **The structure audit's two failures** are the supervisor's working documents
   (plan document at 819 lines; `docs/working/README.md` index stale). `pnpm check`
   will fail on them until they are compacted and regenerated.
