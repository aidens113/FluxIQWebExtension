# p-connection-split — splitting `background/connection.ts` by responsibility

## Outcome

**Blocked** — on a file-ownership collision, not on the work itself.

Another agent is concurrently editing `apps/extension/src/background/connection.ts`
and `apps/extension/src/background/connection/`, which my brief assigns to me
exclusively. Its change is the recording-start handshake
(`connection/recording-start/handshake.ts`, `refusal.ts`, `index.ts`, plus a
`recording-start/tests/` folder, all created 17:41–17:44 while I was writing).
It rewrote the same methods my split claims: `startRecording`,
`handleRecordingProjectRequired`, `clearPendingRecordingStart`,
`handleRecordingStartTimeout`, and the `pendingRecordingStart` field.

I designed the split, wrote the four collaborator modules, and proved they
compile and satisfy every structure-audit rule. I did **not** rewrite
`connection.ts`, because doing so would have discarded another worker's
in-flight, more-detailed work on the very same responsibility.

## The three-plus-one jobs inside `FluxIQConnection`

The 39-method class (38 after the other worker's change) is four objects
wearing one name. Split by what the code does:

1. **Where the browser is** — `connection/active-page.ts`, `ActivePage`
   (10 methods). Owns `activeTabId`, `activeTabUrl`, `unsupportedPage`, and the
   two paths that change them: a tab the browser updated
   (`handleTabUpdated`) and a tab the server asked for (`selectAutomationTab`).
   `refreshActiveTab` and `sendBrowserState` come with them — they read and
   publish exactly this state and nothing else.

2. **The recording in progress** — `connection/active-recording.ts`,
   `ActiveRecording` (14 methods). Owns `recordingState`,
   `recordingStartedAt`, `activeRecordingId`, `pendingRecordingStart`,
   `recordingBlock`, `eventCount`, and every transition into and out of a
   recording: `startRecording`, `stopRecording`, `beginAcceptedRecording`,
   `handleRecordingProjectRequired`, `dismissRecordingBlock`,
   `clearPendingRecordingStart`, `handleRecordingStartTimeout`,
   `resetRecordingLog`.

3. **Turning happenings into recorded events** —
   `connection/recorded-event-intake.ts`, `RecordedEventIntake` (7 methods).
   The single funnel every recorded event passes through:
   `handleRecordingEvent`, `handleContentReady`, `processRecordingEvent`, plus
   the four navigation methods. Navigation belongs here rather than in its own
   module because a committed navigation is only ever interesting as the
   recorded event it becomes — `NavigationRecorder` already holds the policy,
   and these methods are only the conversion.

4. **Commands in, results out** — `connection/server-command-channel.ts`,
   `ServerCommandChannel` (9 methods). `onMessage`, `onSessionReady`,
   `handleServerCommandPayload`, `runtimeCommandRouter`, `sendActionResult`,
   `sendRuntimeActionConfirmation`, `startRuntimeStatus`, `applyRuntimeStart`,
   `finishRuntimeStatus`.

   This is where the brief's "if two methods only make sense together, they
   belong in the same module" bit. Dispatch and reporting look like two jobs
   and are one: `handleServerCommandPayload` opens a runtime status that
   `sendActionResult` closes, and a succeeded action becomes a recorded event
   as well as a reply. Splitting them would have put a status open in one
   module and its close in another.

The facade keeps its 16 public methods as thin delegations plus four pieces of
private glue it genuinely owns (`persistSession`, `coreApiCredentials`,
`emitStatus`, `addActivity`): **20 methods**, comfortably below the 25-method
advisory threshold, not just the 40-method wall.

## What changed and why

Four new files, all under a path my brief owns, all currently **untracked and
unreferenced by any other module**:

- `apps/extension/src/background/connection/active-page.ts`
- `apps/extension/src/background/connection/active-recording.ts`
- `apps/extension/src/background/connection/recorded-event-intake.ts`
- `apps/extension/src/background/connection/server-command-channel.ts`

Nothing imports them, so extension behaviour is unchanged and no build breaks.
They are at the exact paths the finished split needs.

Design decisions, each following the shape already in `connection/`:

- Each module takes a `…Deps` type alias of getters and ports, the pattern
  `RecordingEvidenceReporter`, `ContentAttachment` and `ProjectContext`
  already use. Already-extracted collaborators (`NavigationRecorder`,
  `PointerClickFilter`, `EventSequence`, `GatewaySession`, `ProjectContext`,
  `ContentAttachment`, `RecordingEvidenceReporter`, `RuntimeStatusTracker`,
  `ActivityLog`) are passed as instances rather than re-wrapped in callbacks.
- Cross-module calls that land on a **public** method of the facade
  (`handleRecordingEvent`, `handleTabUpdated`, `stopRecording`, `disconnect`)
  go through a function port supplied by the facade, never straight at the
  owning collaborator. This is what `scripts/structure-audit/rules/facade-dispatch.mjs`
  requires, and it preserves dispatch: an override or stub on a public method
  is still honoured.
- `../tabs` helpers (`activeTab`, `allTabs`, `sendToTab`) and
  `../action-evidence`'s `captureActionBoundary` are injected via deps rather
  than imported, so `connection/` keeps its existing habit of not reaching up
  into `background/`.
- Naming avoided a third `recording-`-prefixed file: `scripts/structure-audit/rules/naming.mjs`
  fails at three siblings sharing a prefix, and `recording-evidence.ts` and
  `recording-manifest.ts` already hold two. Hence `active-recording.ts`.

**Not written:** the rewritten `apps/extension/src/background/connection.ts`
facade. I had it composed — construction order `gateway → projects →
attachment → evidence → page → recording → intake → commands`, with
forward references made lazily through arrow closures — and stopped at the
write.

## Behaviour I moved but did not improve

Per the brief, noted rather than changed:

- `applyRuntimeStart` calls `addActivity` (which emits status) and then
  `emitStatus` again. The double emit is preserved.
- `onMessage` calls `gateway.noteMessageReceived()` unconditionally at the top
  and then a second time inside the `server.ping` branch. Preserved.
- `handleTabUpdate` evaluates `recordingState === "recording"` three times in
  one method. Preserved as three reads rather than hoisted, so the moved code
  is a literal transcription.
- `startRecording` reads `this.unsupportedPage` twice; I bound it to a local
  because the field now lives behind `ActivePage.unsupported()`. Nothing
  mutates it between the two reads, so the value is identical.
- `selectAutomationTab` finished by calling its own public `handleTabUpdated`.
  In `ActivePage.select` that call goes back out through the facade port
  (`deps.updateTab`) instead of straight to `this.handleTabUpdate`, which
  preserves the dispatch the facade-dispatch rule protects. Same behaviour, one
  extra hop.

## Commands run and observed results

All captured by redirect, exit status echoed separately.

- `node scripts/structure-audit.mjs --rule class-methods` (before any change) →
  `exit=0`;
  `warn [class-methods] apps/extension/src/background/connection.ts:85: class FluxIQConnection has 39 methods, past the 25-method advisory threshold`.
  Confirms the trap: 39 against a hard limit of 40, no baseline entry, so the
  next method added fails the build.

- Same command after the other worker's edit landed, run through a scratch
  `GIT_INDEX_FILE` (`git read-tree HEAD` + `git add -A -- apps/extension/src`,
  1281 cached files, real index untouched) → `exit=0`;
  `class FluxIQConnection has 38 methods`. Their change moved it 39 → 38. The
  trap is still one method wide.

- `node scripts/structure-audit.mjs` (all rules, same scratch index, so my four
  untracked files are visible to it) → `exit=0`,
  `structure-audit: passed (31 warning(s), 19 baselined)`. No failures. In
  particular: no `facade-dispatch` finding against the four new modules, no
  `naming` prefix-group finding, no `exported-values` failure, and
  `warn [directory-files] apps/extension/src/background/connection/: 23 source files`
  — past the 15-file advisory threshold but under the 25-file limit.

- `npx tsc -p tsconfig.json --noEmit` in `apps/extension` → `exit=0`, no
  output. Covers all four new modules (`include: ["src/**/*.ts"]`).

- `npx tsc -p tsconfig.test.json` in `apps/extension` → `exit=0`, no output.
  Together these two are `pnpm --filter …/extension run check`.

- `EXTENSION_TEST_BUILD_LABEL=p-connection-split` was exported for the check
  runs.

- Concurrency evidence: a 40-sample, 3-second-interval `md5sum` of
  `connection.ts` and `connection/index.ts` recorded three distinct checksums
  for `connection.ts` inside the first 36 seconds
  (`20e68b7b…` ×6, `52617623…` ×2, `1b89ff83…` ×32), then no further change
  for the remaining ~96 seconds. The file size went 31591 → 32794 bytes during
  that window and `connection/index.ts` changed once at 17:44. None of those
  writes were mine.

## Not verified

- **The split itself is unexercised.** Because the facade was never rewritten,
  no test covers the four new modules; they type-check and nothing more. The
  behaviour-preservation claims above are transcription review, not test
  results.
- `pnpm --filter @fluxiq-web-extension/extension run test` — **not run.** It
  exercises no code of mine (nothing imports the new modules), so a pass would
  report on another worker's in-flight tree, not on this work. Reporting it as
  validation would be misleading.
- `pnpm --filter @fluxiq-web-extension/extension run test:content --workers=4`
  — **not run**, for the same reason, and to avoid contending for a Lab
  instance with the worker that is presently validating.
- No live browser validation. The split touches background/service-worker
  lifecycle, gateway reconnection, and action execution, so the finished
  version needs manual browser validation before it is called done.
- The hardware caveat in the brief (faulty RAM, rerun once before concluding)
  never came into play: nothing failed, so there was no non-reproducible
  failure to re-test.

## Open questions / contradictions found

1. **Two briefs own one file.** `AGENTS.md` is explicit: "If two briefs need
   the same file, the work is serial." Both this brief and the recording-start
   brief needed `apps/extension/src/background/connection.ts`. Whichever
   finishes second has to reconcile a full structural rewrite against a
   semantic change to the same methods. This needs a supervisor decision, not
   a worker's.

2. **Recommended resolution — land the handshake first, then this split.** The
   other worker's `RecordingStartHandshake` is the better-specified piece of
   work (bounded retry, refusal classification, its own tests) and it fits the
   split cleanly: it becomes a collaborator that `ActiveRecording` holds and
   drives. Concretely, once it has landed:

   - Add `recordingStart: RecordingStartHandshake` to `ActiveRecordingDeps`.
   - `ActiveRecording.start()` builds the payload and calls
     `recordingStart.begin({ recordingId, startedAt, initialState })` in place
     of the inline `send` + `setTimeout`.
   - Delete `ActiveRecording.clearPendingStart` and `handleStartTimeout`, and
     the `pendingStart` field and `RECORDING_START_ACCEPT_TIMEOUT_MS` constant
     with them; `recordingStart.cancel()` / `.isPending()` /
     `.noteAccepted()` replace them. That drops `ActiveRecording` from 14
     methods to about 12.
   - `ActiveRecording.noteProjectRequired` becomes the handshake's
     `surfaceRefusal` sink, taking a `RecordingStartRefusal` and using
     `recordingStartRefusalBlock` for the block state.
   - `ServerCommandChannel.handleMessage` routes `server.error` through
     `isRecordingStartRefusalError` / `classifyRecordingStartRefusal` to
     `recordingStart.noteRefusal(...)` instead of straight to
     `noteProjectRequired`.
   - The facade's `disconnect()` calls `recordingStart.cancel()` where it
     currently calls `clearPendingRecordingStart()`.

   The other three modules (`ActivePage`, `RecordedEventIntake`,
   `ServerCommandChannel`) need no change at all from the handshake work —
   only `ActiveRecording` overlaps.

3. **The four staged files: keep or delete?** They are untracked, unreferenced,
   and type-clean, and the structure audit cannot see them (it reads
   `git ls-files`), so they are inert. I left them in place so the follow-up is
   a facade rewrite rather than a redo. If the supervisor would rather the
   working tree matched HEAD for the other worker's validation, deleting the
   four paths listed above is sufficient and reverses nothing else.

4. **`FluxIQConnection` is still one method from failing the build.** Whatever
   is decided about this split, the next agent to add a method to that class
   fails `pnpm check` with no warning shot. That is the condition the brief was
   written to remove, and it is still true.
