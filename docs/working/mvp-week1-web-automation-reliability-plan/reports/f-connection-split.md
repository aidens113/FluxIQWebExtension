# f-connection-split — splitting `background/connection.ts`

Worker report, 2026-09-12, tree at `HEAD 99eca80` plus parallel workers' edits.

## Outcome

**Done.** `apps/extension/src/background/connection.ts` is **344 lines, down from 764** (limit 800,
advisory 400). `FluxIQConnection` has **20 methods, down from 38** (limit 40, advisory 25). The
extension behaves identically: a scripted probe drove HEAD's facade and the split facade through
the same 38-step scenario, and the two traces are byte-identical. `check` passes, `test` passes
313 of 313, the structure audit passes, and the content harness passes 202 of 202. Nothing is
committed.

## What was already there at HEAD (re-verification)

- The four collaborator modules that `p-connection-split` designed **were committed** in `ab736a1`
  (the live-validation commit), but they were dead code. Nothing imported them, and
  `connection/index.ts` did not export them.
- Two of the four were written before the recording-start handshake landed, so they encoded the
  *old* behaviour:
  - `active-recording.ts` used a single 750 ms timer, cleared the error by comparing it against one
    fixed string, and had a `noteProjectRequired` method.
  - `server-command-channel.ts` sent a `server.error` to the recording only when its code equalled
    `recording.project_required`.
- The other two, `active-page.ts` and `recorded-event-intake.ts`, matched HEAD's `connection.ts`
  line for line. They are **unchanged**; `git diff` confirms `recorded-event-intake.ts` equals HEAD.

## What changed and why

The facade now owns only the session, settings, status listeners, the error line, and the order its
collaborators are built in. The work lives in four objects under `connection/`, one job each:

| Module | Job | Methods | Lines |
| --- | --- | --- | --- |
| `ActivePage` (unchanged) | which tab is active, and whether its page can be recorded | 10 | 127 |
| `ActiveRecording` (rebuilt) | the recording in progress and every start, refusal, and stop | 16 | 294 |
| `RecordedEventIntake` (unchanged) | the one funnel every recorded event goes through, navigation included | 7 | 136 |
| `ServerCommandChannel` (one branch) | FluxIQ's messages and commands, and the action results sent back | 9 | 264 |

- **`connection.ts`**, rewritten as a facade.
  - Its 16 public methods keep their exact names and signatures, and each now delegates to a
    collaborator.
  - Four private helpers stay on the facade: `persistSession`, `coreApiCredentials`, `emitStatus`,
    `addActivity`.
  - Delegations *return* the collaborator's promise rather than `await` it, so moving a method added
    no asynchronous step to any caller.
  - Where the old code called a public method from inside the object, the collaborator still goes
    back through the facade: `handleRecordingEvent`, `handleTabUpdated`, `stopRecording`,
    `disconnect`. An override or stub on those methods is therefore still honoured, which is what
    `facade-dispatch.mjs` protects.
  - The `recordEvent` port forwards exactly the arguments it is given (see the probe finding below).
- **`connection/active-recording.ts`**, rebuilt onto `RecordingStartHandshake`, which it now creates
  and owns.
  - Each method is a transcription of HEAD code:
    - `start` from `startRecording`;
    - `sendStart` from the handshake's `send` closure, including the per-attempt project lookup;
    - `applyRefusal` from `applyRecordingRefusal`;
    - `beginWithoutAcceptance` from `beginRecordingWithoutAcceptance`;
    - `beginAccepted` from `beginAcceptedRecording`.
  - `dismissBlock` now uses `isRecordingStartRefusalError`.
  - `noteStartRefusal` and `cancelStart` replace the stale `noteProjectRequired` and
    `clearPendingStart`. The stale local 750 ms constant is gone.
  - Why it owns the handshake instead of receiving it: every handshake callback (`send`,
    `beginLocally`, `surfaceRefusal`, `noteRetry`) is a recording transition. Owning it also avoids
    the construction cycle the earlier report's inject-it design would have needed.
- **`connection/server-command-channel.ts`**: `server.error` now goes through
  `classifyRecordingStartRefusal` and then to `recording.noteStartRefusal`, exactly as HEAD's
  `onMessage` did. HEAD's comment came with it.
- **`connection/index.ts`**: exports `ActivePage`, `ActiveRecording`, `RecordedEventIntake`,
  `ServerCommandChannel` and their `…Deps` types.
- **Four new test files in `connection/tests/`** (19 tests):
  - `active-recording.test.ts`: the start manifest on the first attempt and on a retry; a second
    press while a start is pending; cancel; silence starts recording locally; transient and
    persistent refusals and the resulting block; dismissal keeps an unrelated error; project re-link
    while recording; stop payload and count; a server-initiated stop is not echoed back.
  - `server-command-channel.test.ts`: a refusal is not a socket failure; stop and disconnect go back
    through the facade; the snapshot command's runtime status; the order of steps when a session
    becomes ready; `set_active_tab` records the tab first.
  - `recorded-event-intake.test.ts`: nothing while idle; a pointerdown and its click count once;
    executable actions versus passive evidence; navigation and content-ready go back through the
    facade.
  - `active-page.test.ts`: tab adoption, attach and publish; unsupported pages; selection finishes
    through the facade's update path; an action result updates the tab and URL.

Behaviour moved but deliberately not "improved", as in the earlier report:
- `server.ping` still notes the message twice.
- A runtime start still emits status twice.
- An unsupported page's `reason` is read into a local variable. No code runs between the two reads.

Construction order is gateway → projects → attachment → evidence → page → recording → intake →
commands. Anything reached through a closure is read only when called, never during construction.

## Commands run and observed results

All exit codes were captured by redirecting output to a file and echoing `$?`.
`EXTENSION_TEST_BUILD_LABEL=f-connection-split` was set throughout.

1. **Type check.** `pnpm run check` in `apps/extension` → `check exit=0`. Run three times; the last
   run was after every edit.
2. **Unit tests, first run.** `pnpm run test` → `test exit=1`, `# tests 313 # pass 310 # fail 3`.
   - All three failures were in my new `active-recording` tests:
     `TypeError: Cannot read properties of undefined (reading 'runtime')` at
     `browserDescriptor (src/shared/browser.ts:19:30)`.
   - Cause: the start manifest reads `chrome.runtime.getManifest()`, and the test installed no
     `chrome`. It was not a code defect.
   - Fix: a `chrome` stub installed per test and removed afterwards.
3. **Unit tests, rerun.** `pnpm run test` → `test exit=0`, `# tests 313 # pass 313 # fail 0`. That is
   HEAD's 294 plus my 19.
4. **Structure audit on tracked files, before the tests existed.** `node scripts/structure-audit.mjs`
   → `audit exit=1`. The only failure:
   `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks`.
   The tree at that moment had `docs/working/README.md` and the plan document modified by another
   session. It is not mine and has nothing to do with this split.
5. **Structure audit with my new test files visible.** Scratch `GIT_INDEX_FILE`
   (`git read-tree HEAD`, then `git add -A` of `connection.ts` and `connection/`), then the same
   command → `audit exit=0`, `structure-audit: passed (34 warning(s), 17 baselined).`
   - Warnings on my paths: `connection/: 23 source files` (unchanged from HEAD) and a new
     `connection/tests/: 17 source files` (advisory threshold 15, limit 25).
   - No `class-methods`, `facade-dispatch`, `naming`, `imports` or `exported-values` finding against
     any of these files. The warning `FluxIQConnection has 39 methods` that `p-connection-split`
     recorded is gone.
   - The real git index was untouched: `git status` still shows my four test files as untracked.
6. **Behaviour-comparison probe.** Scratch only, never in the repository.
   - Files: `driver.ts` and `build.mjs` in my scratchpad
     `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\4f264c80-323b-4673-a09a-bde5851669f3\scratchpad\fcs\`.
     The bundles are in the ignored `apps/extension/.test-build-scratch/f-connection-split-probe/`.
   - How it works: esbuild bundles `FluxIQConnection` twice. One bundle uses HEAD's `connection.ts`
     (from `git show`, substituted at load time with imports resolved against the real directory).
     The other uses the working tree. Every collaborator is the same file in both.
   - Both bundles run one 38-step scenario with a deterministic stubbed `chrome`, clock, timers,
     `Math.random`, `crypto.randomUUID` and `fetch`, and a fake connected gateway client.
   - Scenario: start while disconnected; session ready; tab update; start; a second start while
     pending; transient refusal and retry; server accept; pointerdown and click de-duplication;
     input; content-ready; typed, link and history-state navigation; selecting a supported and an
     unsupported tab; ping; `set_active_tab`; `capture_snapshot`; `execute_action`; server stop;
     local start after the acceptance window; persistent and mismatch refusals; dismissal; user
     stop; pairing required; heartbeat; other server error; `server.disconnect`; an event while
     offline.
   - Observability: the public methods `handleRecordingEvent`, `handleTabUpdated`, `stopRecording`
     and `disconnect` were replaced on the instance with logging wrappers, so the trace shows
     whether code inside the object still reaches them.
   - Trace contents: every chrome call, gateway send, status emission, fetch, timer, thrown error,
     unhandled rejection and override call.
   - Run history:
     - First runs differed between two runs of the same build: generated ids used `Math.random`.
       Stubbed.
     - Second run: HEAD versus new differed in **exactly three places**. The browser-tab event from
       `beginAccepted` reached the `handleRecordingEvent` override with three arguments
       (`payload, undefined, undefined`), where HEAD passed one. The values were identical, but the
       argument count differed.
     - Fixed by making the facade's `recordEvent` port forward its arguments unchanged.
     - Third run: `af55558d48c0273d4386d7e5d0eb1a6c` for HEAD ×2 and new ×2, byte-identical. But that
       stub lacked `chrome.runtime.getManifest` and some `on*` event objects, so every
       `client.start_recording` send threw in *both* builds.
     - Fourth and final run, stubs completed: **all four traces
       `b52acaf1acdfa8a4b7c104b84759c633`, 362 entries, byte-identical.**
   - Final trace contents:
     - gateway sends: `client.state_update` 17, `client.start_recording` 4 (attempt 0 three times,
       retry attempt 1 once), `client.snapshot` 4, `client.recording_event` 3,
       `client.action_result` 1, `client.stop_recording` 1;
     - override calls: `handleRecordingEvent` 10, `handleTabUpdated` 2, `stopRecording` 2,
       `disconnect` 1;
     - one throw, the intended refusal of the unsupported tab
       (`The requested automation tab is unavailable or unsupported.`).
7. **Mutation proofs.** Each file was copied to scratch, broken with one `sed` whose pattern matched
   exactly once, built, restored by copy, confirmed byte-identical with `cmp`, and only then was the
   build run. The file was broken only for the length of one esbuild call.
   - **M1** `active-recording.ts`, `"recording_start_retry"` → `"recording_start"`: `test exit=1`,
     `not ok 4 - a transient refusal is re-sent with a fresh project lookup; a persistent one locks the recorder`,
     `+ 'recording_start' - 'recording_start_retry'`. Restored, md5 `ef851367ad3b94262bacacdeb1e7aebd`.
   - **M2** `server-command-channel.ts`, `if (refusal) {` → `if (refusal && false) {`:
     `test exit=1`,
     `not ok 1 - a refused recording start goes to the recording and leaves the socket healthy`,
     `expected: 1 actual: 0`. Restored, md5 `b1e84a1b1c4aec3887cdbadbb23c5974`.
   - **M4** `recorded-event-intake.ts`, content-ready's `this.deps.recordEvent(...)` →
     `this.accept(...)`: `test exit=1`,
     `not ok 4 - a typed navigation and a content-ready page re-enter through the facade's public path`.
     Restored, md5 `6cb637effb82b2677c779b8cee27e7a1`, and `git diff` shows it equal to HEAD.
   - **M3** `connection.ts`, the `recordEvent` port → `this.intake.accept(...args)`, checked with the
     probe: `probe detects: trace differs from HEAD`, `override:handleRecordingEvent HEAD=10 mutated=5`.
     Restored, md5 `a7c9d640dc220f362468cb04a76dab88`.
8. **Content harness, first run.**
   `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2`, run in the background
   while the light mutation scripts ran → `content exit=1`, `1 failed, 201 passed (42.2s)`. The failure:
   `actions.spec.ts:131 › scroll: moves the window to the requested offset`,
   `TypeError: runMicrotasks is not a function`. That is a Node-internal name, in a harness whose
   bundle does not contain `background/` at all: the faulty-RAM shape. Rerun alone.
9. **Content harness, rerun alone.** Same command → `content exit=0`, `202 passed (40.9s)`. The first
   run's failure rests on a single observation and did not reproduce.

## Not verified

- **The content harness says nothing about this split.** Its config loads "the content-script bundle
  in headless Chromium on Scenario Lab fixtures, with no extension loaded", so `connection.ts` is
  never executed there. It was run because the brief requires it.
- **The probe is stubbed, not a browser.**
  - The `chrome` APIs, the clock and the gateway client were fakes. `connect()`, the real WebSocket,
    reconnect backoff, the heartbeat interval, pairing through a real client, `listCoreRecordings`
    and `updateSettings` were not driven. Their code did not move, apart from `beforeConnect` and
    the heartbeat now calling `page.refresh()` and `page.sendBrowserState()`.
  - The identity claim covers only the paths the 38 steps drive. Anything else is transcription
    review.
- **Service-worker restart and WebSocket reconnection**, per the brief, need the Lab. A Lab run must
  show, with the rebuilt extension loaded:
  1. Connect and pair, then press Record with a project open: FluxIQ accepts, the status goes to
     recording, and a `browser.tab` start event plus an initial snapshot arrive.
  2. Record with FluxIQ silent: recording starts locally after about 750 ms with "Project context
     pending".
  3. A stale-context refusal: "Recording start delayed … (1 of 3)", then a retry with
     `startAttempt 1`. A no-project refusal: the "Project Required" block, and dismissal clears it.
  4. A recorded click appears once, not twice for pointerdown plus click. A typed navigation is
     recorded. A link navigation is not.
  5. A runtime `execute_action` produces `client.action_result` plus its confirmation recording
     event, and `set_active_tab` activates the tab.
  6. The MV3 service worker restarts mid-recording, then reconnects, flushes the queued events, and
     recording state and status recover as before the split.
  7. `server.disconnect` and a manual disconnect during recording log "Disconnected during
     recording".
- **`pnpm build` not run, per the rules.** The tracked `apps/extension/build/background/index.js`
  will change when the supervisor builds.
- **Firefox** popup build not checked. This change touches no manifest or browser-specific code.
- **Root `pnpm check` / `pnpm test` not run.** Only the extension package's `check` and `test` ran.

## Open questions or contradictions found

1. **Stale comments in files I do not own** still say `connection.ts` sends the recording event,
   which `RecordedEventIntake` now does:
   - `connection/recording-evidence.ts:47` and `:89`;
   - `connection/tests/recording-evidence.test.ts:6` and `:118`;
   - `background/tests/recording-evidence-pipeline.test.ts:1`.

   They are accurate about the order of operations and wrong only about the file name. Reword them,
   or brief their owner.
2. **A facade-level wiring test belongs in `background/tests/connection.test.ts`** under the
   test-placement rule, which is outside this brief's ownership. The probe proves feasibility:
   `connection.ts` and every import load in Node under a `chrome` stub, with no top-level `chrome`
   use. The override-dispatch check and the start/refusal/accept scenario are the parts worth
   promoting. Until then the facade's wiring is proven only by the scratch probe, not by a test that
   runs in `pnpm test`.
3. **The directory budget is nearly spent.** `connection/` holds 23 of 25 source files, and
   `connection/tests/` has just passed its advisory threshold at 17. The recording-latch work that
   waits on this split will hit the limit at two more files in `connection/`. Grouping, for example
   `ActiveRecording` with `recording-start/` under a `recording/` directory, is the likely next move
   and should be briefed deliberately.
4. **No baseline entry needs to change.** `connection.ts` never had one, and no finding was
   ratcheted.
5. **The working-docs audit failure** (`docs/working/README.md` out of date) belongs to whichever
   session edited the working documents. It had cleared by the time of the audit in step 5.
6. **Scratch outputs are left in place:** the ignored `apps/extension/.test-build-scratch/` label
   directories `f-connection-split`, `f-connection-split-probe` and `f-connection-split-mutation`.
   Delete them freely.
