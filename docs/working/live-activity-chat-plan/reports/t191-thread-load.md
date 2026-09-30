# t191-thread-load (worker), lane t191

## Outcome

Done. All three items are addressed, and I made no Core edits.

- **Cause of "Couldn't load the conversation." (review #4).** It is reproduced with the real relay.
  - The chat now retries a failed read quietly.
  - It shows a notice only once reading has kept failing for about 6-7 s. The notice names the step that failed and why, and has a Retry button.
- **"Add an AI model key: To do" (U5).** It came from the deleted Simple Mode checklist. The new panel has no model-key step, and a test now pins that.
- **"Latest chat".** It is now the project's own open thread (subject `project`), not the most recently touched thread of any kind.

The extension `check` exits 0, and `test` passes 1306 of 1306. The structure audit passes. No browser run was made (see Not verified).

## What changed and why

### 1. The load error while connected

**Where the screenshot came from.** `after-blank-1-working-window.png` is not from a live build. It comes from the t191-overlay worker's probe (`scratchpad/t191-overlay/probe.mjs`, lines 61-64).

- The probe's stand-in FluxIQ served the gateway WebSocket.
- It answered every HTTP request with `200 text/html`, including `POST /api/programs/automation-studio/list-conversations`.

**Reproduced.** I bundled the real `callCoreProgram` and `relayConversation` against that exact server (scratch `t191-thread/repro-entry.ts`). The relay answered the panel's list request with:

`{"ok":false,"code":"failed","httpStatus":200,"error":"FluxIQ answered 200."}`

**How that became the error.** The old controller turned any failed read into `readError = "Couldn't load the conversation."` at once. The 4 s poll failed the same way every time, so the error never cleared while connected.

**A real-Core cause of the same symptom mid-build (found, not fixed).** The race is in `storage/project/database.ts`, which I may not edit. `AutomationStudioProjectDatabasePool.acquire` awaits the pool entry before it increments `leases`. If the last lease is released in that gap, the entry is closed, and the new lease gets a closed database.

- Reproduced against Core's built `dist` (scratch script, since deleted). It printed `second read failed: Automation Studio project database p1 is closed.`
- During a build, many short leases hit the same project database. A conversation read that loses this race throws, and the route answers 400, which the relay reports as `failed`. That is the "mid-build while connected" transient.
- The panel now absorbs it. The Core race itself should be fixed in Core's storage (see Open questions).

**The fix** (`apps/extension/src/panel/chat/conversation/`):

- `read/retry.ts` (new) holds `READ_RETRY`: quiet re-reads after 1 s, 2 s and 4 s. The notice needs at least 3 failed reads in a row over at least 6 s. It also defines the `ConversationClock` seam.
- `read/failure.ts` (new) holds `readFailureNotice(step, failure)`.
  - The notice reads "This chat isn't updating: <step> failed (<cause>)."
  - The step is "finding this chat in FluxIQ" (`list-conversations`) or "reading this chat's messages from FluxIQ" (`get-conversation`).
  - The cause comes from the relay code:
    - `unreachable` gives "FluxIQ can't be reached";
    - `timed_out` gives "FluxIQ didn't answer in time";
    - `no_project` and `not_paired` each give their own plain sentence;
    - `unreadable` gives "FluxIQ's answer isn't in a form this panel reads";
    - `failed` gives Core's own error text, bounded to 160 characters, and never the token.
- `read/notice.ts` (new) holds `createReadNotice(retry)`. It is hidden until `readError` is set, then shows the sentence and a Retry button, which reads "Retrying..." and is disabled while a read is running.
- `read/index.ts` is the barrel. The files sit in `read/` because the audit refuses three `read-` prefixed files.
- `controller.ts`:
  - A read failure goes through `readFailed(step, result)`. It keeps what is on screen and schedules one quiet retry at a time, up to the three.
  - `readError` is set only once the failure has lasted. After that it follows the newest cause.
  - A good read, a target change or a disconnect clears the failure count, the pending retry and the notice.
  - New `retry()` reads at once and starts the quiet retries over. New `state().reading`.
  - The third constructor argument is an optional clock. The panel passes none, so it uses the real timers.
  - `unsupported` and `refused` still turn the chat into its fallback.
- `thread-tail.ts`: an unparseable page now fails with `code: "unreadable"` instead of carrying the old sentence.
- `core-thread.ts`, `index.ts`: comments and barrel exports.
- `panel/chat/chat-panel.ts` is outside my listed ownership, but the fix needs it. I changed 4 lines there:
  - it mounts `createReadNotice(() => void controller.retry())` in place of the bare `<p>`;
  - it renders the notice from the state;
  - two comments.

  I also added and then removed one line in `chat.css`; its net diff from me is nil.

### 2. U5: "Add an AI model key: To do"

**Where it came from.** It was the old `panel/simple/start/setup-steps.ts` (at HEAD).

- The step was fed by `model-key.ts`, which read Core's `secret-keys` `snapshot` and reported "missing" unless a key had `kind === "llm"` and was enabled.
- The Lab's live provider evidently does not appear in that snapshot, so the checklist said "To do" beside a working build. I did not trace where the Lab's key lives.

**The new panel.** The t191 shell deleted that checklist, and nothing in `panel/getting-started/**` or `panel/settings/**` reads `modelReadiness`. `startGuide` has only open, connect and approve, and it does not gate while connected.

**The test I added** to `getting-started/tests/start-steps.test.ts` covers both halves:

- connected, with the runtime idle, running or absent: not gated, and no step left undone;
- every connection state: no step other than open, connect and approve, and no step mentions a model or a key.

The background `modelReadiness` relay (`background/simple-panel/`) is now unused by the panel. I left it, since it is outside my paths.

### 3. "Latest chat" is the project thread

**Decision.** Yes, and Core's API allows it. `list-conversations` narrows by an exact subject, and a subject must be sent whole: `requestedSubject` refuses a kind without an id. The project thread's subject is `{ kind: "project", id: projectId }`.

- `thread-requests.ts`: the latest target lists with `subjectKind: "project"`. A first message still opens with no subject, which Core defaults to the project.
- `background/panel/conversation-relay.ts`: a list with `subjectKind: "project"` and no `subjectId` gets the resolved project id.
  - With no project known, including an explicit `projectId: null`, it answers `no_project` before calling Core. It is never widened to every thread.
  - The chat then shows that as a failed read, and as the notice if it lasts.
- **Trade-off.** Asks Core writes into run-subject threads (graph-run parking, `service.ts:2615`) no longer surface in "Latest chat". Flow-subject asks still show in that automation's chat. See Open questions.

### Tests (in `tests/` folders)

**`conversation/tests/controller.test.ts`** has five new tests and three rewritten ones.

New:

- review #4: one failure with the probe's exact answer shows nothing, keeps the thread, and retries once;
- Core's database race on `get` never reaches the person;
- a read that keeps failing is quiet for three reads, then shows exactly "This chat isn't updating: finding this chat in FluxIQ failed (FluxIQ answered 200)."; Retry reads, shows `reading`, and re-arms the retries; a good read clears it;
- the thread step is named;
- the notice follows the newest cause, and a disconnect or a new target clears it.

Rewritten:

- the unreadable-answer test;
- the "other relay codes" test;
- the first test's request, which now carries `subjectKind: "project"`.

All use `tests/manual-clock.ts` (new), so no real timers run.

**`conversation/tests/target-switch.test.ts`:**

- "latest after using an automation" now expects the project thread. Before the fix it asserted the automation's thread.
- New: a run's thread touched later is never shown as the latest.
- The request test now expects the project subject.
- `tests/target-core.ts` mirrors the relay's fill-in.

**Other test files:**

- `conversation/read/tests/notice.test.ts` (new), under the fake DOM.
- `background/panel/tests/conversation-relay.test.ts`: two new tests, for the fill-in and for `no_project`.
- `getting-started/tests/start-steps.test.ts`: the U5 test above.

## Commands run and observed results

- Reproduction: esbuild-bundled `repro-entry.ts`, then `node repro.mjs`. It printed `relay reply for the panel's list request: {"ok":false,"code":"failed","httpStatus":200,"error":"FluxIQ answered 200."}`.
- Core race: `node t191-thread-pool-race.scratch.mjs` against `packages/fluxiq/dist`. It printed `second read failed: Automation Studio project database p1 is closed.` The file was deleted afterwards, and Core's `git status` shows only other workers' activity files.
- `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` in `apps/extension`: no output, exit 0.
- Focused runner (scratch `run-focus.mjs`, `panel/chat` only): `# tests 102`, `# pass 102`, `# fail 0`, across three runs.
  - With `background/panel` and `getting-started` bundled into the same process, one chat-panel test failed with "Cannot assign to read only property 'chrome'". That is global pollution between files in my ad hoc runner.
  - The official runner shows no such failure.
- `node scripts/structure-audit.mjs`:
  - The first run failed with `[naming] conversation/: 3 files share the prefix "read-"`. I fixed it by moving them into `read/`.
  - The final run printed `structure-audit: passed (124 warning(s), 120 baselined)`. No warning is under `panel/chat`, `background/panel` or `getting-started`.
- `EXTENSION_TEST_BUILD_LABEL=t191-thread bash .../heavy.sh "t191 thread check+test" ...` printed `check exit=0` and `test exit=0`.
  - The test log shows `# tests 1306`, `# pass 1306`, `# fail 0`.
  - Every new test name appears as `ok` (for example `ok 923 - a read that keeps failing shows a notice ...`, `ok 937 - the latest chat never shows a run's ...`, `ok 1047 - U5: ...`).
  - Logs are copied to scratch `t191-thread/`.
- Core `pnpm --filter fluxiq check` was not run, because Core is unchanged.

## Not verified

- **No browser run.** Free RAM was 3.89 GB, and a live lane held `lab-slots/slot-4`. That is under the 4 GB rule for a provider-free browser run, so I did not start one. As a result, these are unit-tested but not seen in the real side panel:
  - the notice's rendering;
  - the Retry click;
  - the project-thread list against real Core.
- **Real Core's `list-conversations`** with `subjectKind: "project"` and `subjectId: <projectId>` was read from the handler and store code (`requestedSubject` and the `subject_kind` / `subject_id` equality), not exercised.
- **Whether the Core pool race is what live users hit.** It is reproduced in isolation, not caught in a live build's logs.
- **Why the Lab's key was missing from the `secret-keys` snapshot** (U5's original trigger) was not traced. The panel no longer reports on the key.
- **Docs.** `docs/architecture/extension-client.md`'s chat section was not updated for "latest = project thread" or for the retry and notice behaviour. It is outside my paths.

## Open questions or contradictions found

1. **Core race, which needs a Core fix outside my allowed files.** In `packages/fluxiq/src/programs/automation-studio/storage/project/database.ts`, `acquire` must take the lease before awaiting the entry, or re-check that the entry is still current after the await. Otherwise a concurrent last `release()` closes the database under a new lease. It is a two-line change plus a test. Every Automation Studio store, not only conversations, can hit it during a busy build.
2. **Asks in run threads.** With "Latest chat" pinned to the project thread, a permission ask that Core parks on a run-subject thread (`service.ts:2615`) is visible in no panel chat. Before this change it showed only when that thread happened to be the most recently touched. If asks must always reach the panel, one of these is needed:
   - Core lists open threads with pending asks (a `pendingOnly` filter);
   - or the panel reads them separately.

   That is a follow-up for the lead.
3. **The brief's framing.** It described the screenshot as a live build. The run that produced it used a stand-in FluxIQ with no conversation API, so its error was, in its own terms, correct. The fix stops a transient failure from showing, and names a persistent one precisely ("FluxIQ answered 200") instead of the old generic sentence.
4. **`background/connection/core-api.ts`** (outside my paths) reports a 200 non-JSON answer as "FluxIQ answered 200.". A sentence such as "answered with something that is not FluxIQ's API" would be clearer for a wrong address.
