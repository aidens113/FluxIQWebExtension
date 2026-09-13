# g-core-late-event: a late recording event kills the connection (Core)

Worker report for brief `g-core-late-event` (rows CS1b′, and CS1b for scope),
2026-09-13. Core was at `5d495eb` with a clean tree when work began; extension
HEAD `147fdb4`. Line numbers marked "pre-fix" are Core `5d495eb`; unmarked Core
lines are the working tree after this change.

## Outcome

**Partial.** What is done:

- The fix is written.
- Four new tests pass.
- The race reproduces before the fix and four mutations each fail the tests.
- Core `pnpm check` exits 0.
- The architecture page is updated.

What is not:

- **Core `pnpm docs:check` exits 1.** Adding lines above
  `AutomationStudioClientGatewayBridge` moved the class from `bridge.ts:84` to
  `:91`. The generated framework reference records that line. No export
  changed, and the two generated files are outside my ownership, so I did not
  regenerate them. The supervisor needs to run `pnpm docs:reference` in Core.
  The expected result is the single-line diff quoted below, in both copies.

In plain terms: a message from the browser extension can reach Core in the
instant after Stop has sealed the recording but before the bridge has
forgotten it. That message used to make the WebSocket host send the extension
an error, and the extension then marked a healthy connection as failed. When
the message was a queued snapshot, it instead caused an unhandled promise
rejection in the server. Now any such message is counted and written to the
gateway audit log as discarded, like a message arriving a moment later. No
error reaches the client.

## The trace: how the throw reached the WebSocket host (before the fix)

**Why the window exists.** `stopRecordingFromClient` awaits
`automationStudio.finalizeRecording` (pre-fix `bridge.ts:313-317`). That call
stamps `endedAt` under the recording mutation lock (`runtime/service.ts:1038-1047`).
Only afterwards does the bridge remove the recording from `activeRecordings`
(pre-fix `bridge.ts:318`). The programmatic `stopRecording` has the same order
(pre-fix `:176-177`). A message handled in between still finds the recording
active.

**Route 1: direct appends, which fail the receive.**

- The extension sends `client.recording_event`
  (`recorded-event-intake.ts:127`, `server-command-channel.ts:237`).
- Pre-fix `appendRecordingEvent` finds the recording active (`:328`) and calls
  `recordGatewayInput` (`:343`).
- That calls `AutomationStudioIoRecorder.recordInput` (`runtime/io-bridge.ts:34`
  or `:53`), then `service.appendRecordingEvent` (`service.ts:1011`).
- `appendRecordingEvents` takes the lock and throws
  `new Error("Finalized recordings are immutable.")` at `service.ts:1017`.
- Observed stack in the pre-fix test run: `bridge.ts:549` → `:343` → `:222`
  `handleGatewayEvent` → `client-gateway/service/event-bus.ts:13`. The bus does
  `await Promise.all` over its handlers, so the rejection comes back out.
  From there it passes `client-gateway/service/inbound.ts:83` `receive`, then
  `receiveRaw` (`inbound.ts:40-43`, via `client-gateway/service.ts:148`).
- `client.state_update` with an `inputId` takes the same route through the
  flush. The extension sends these at `active-page.ts:104-115` and
  `recording-evidence.ts:156-169`. Pre-fix `appendStateUpdate` awaits
  `flushRecordingEntries` at `:508`, and the flush's append throws at `:597`.
  Observed stack: `bridge.ts:597` → `:601` → `:508` → `:230` → `event-bus.ts:13`
  → `inbound.ts:66`. If the flush had nothing queued, `recordGatewayInput`
  would throw next, as in route 1.
- The `client.error` marker (pre-fix `:233-246`) appends the same way.
- The WebSocket host catches the rejection
  (`apps/web/src/server/client-gateway-websocket.ts:134-139`). It replies with
  `serverError(error.message)` (`:291-298`), a `server.error` whose payload is
  `{ message: "Finalized recordings are immutable.", code: "gateway.receive_failed" }`.
  No audit entry is written, and the message is lost.

**Route 2: the timer flush, an unhandled rejection.**

- The extension sends `client.snapshot` (`recording-evidence.ts:138`, `:213`).
- Pre-fix `appendSnapshot` queues it (`enqueueRecordingEntry`). A 25 ms timer
  then calls `void this.flushRecordingEntries(ownerKey)` (`:570`); at 50 queued
  entries the call is at `:564` instead.
- The append throws. The flush has `try { await queue.flushing } finally {…}`
  with no `catch` (`:600-605`), and nobody awaits the `void` call.
- Observed in the pre-fix run: Vitest reported
  `Unhandled Rejection … Error: Finalized recordings are immutable.` at
  `bridge.ts:597` → `:601`.
- No frame reaches the client on this route. Nothing is audited, and the entry
  is lost silently.
- `apps/web` has no `unhandledRejection` handler (a grep for it found nothing).
  What Node or Next does with the rejection in the real server was not
  verified.

**What the extension observes** (HEAD `147fdb4`):

- `server-command-channel.ts:80-91` calls `setLastError(message.payload.message)`,
  so the last error reads "Finalized recordings are immutable.".
- It then asks `classifyRecordingStartRefusal` (`recording-start/refusal.ts:68-70`),
  which returns `undefined` for any code other than
  `recording.project_required` or `recording.project_context_mismatch`.
- So it calls `gateway.markFailed()`, which is `setState("error")` in
  `gateway-session.ts:173-175`.

What the extension does after entering `error` was not traced.

## What changed and why

**`packages/fluxiq/src/programs/automation-studio/client-gateway/bridge.ts`** (687 → 746 lines)

- **`appendOrDiscard`** (new private method, `:496`) runs one append. If it
  throws, the method re-reads the recording (`isFinalized`, `:511-514`).
  - If `endedAt` is set, it reports every message the append carried through
    `noteDiscardedClientMessage` and returns `undefined`.
  - Otherwise it rethrows the original error (`:500`).
  - If the re-read itself fails, the original error propagates.
- **It is wired into every append a gateway receive can reach:**
  - `recordGatewayInput` (`:603`), which covers `client.recording_event`
    (sender at `:361`) and `client.state_update` (`:568`).
  - The `client.error` marker (`:244`).
  - `flushRecordingEntries`, per group (`:655`). This one site covers the timer
    calls (`:618`, `:624`) as well as the awaited ones (`:559`, `:638`).
- **Queue items now carry a `sender`**: the session that sent the message plus
  a description of it, so a flush can report what it discarded. Set at `:226`
  (`client.recording_entry`), `:531` and `:549` (snapshots), and `:581`
  (state-update fallback). `DiscardedClientMessage.kind` gains `"snapshot"`,
  `"state update"` and `"error"` (`:74`). New local types are
  `ClientMessageSender` (`:83`) and `ClientRecordingRef` (`:86`).
- **`rememberClosedRecording` is now idempotent for the same recording**
  (`:418`). A discard in the window remembers the recording first, attributed
  to the right `recordingId`. When Stop then closes the recording, the count is
  kept, not restarted.
- **Unchanged:**
  - `activeRecordings.delete` still runs after `finalizeRecording`
    (`:183-184`, `:322-327`).
  - No `server.error` or other client frame was added (CS1b stays in Week 2).
  - No export changed.

**How the refusal is matched.** Core offers nothing sturdier than the message
text. Both refusal sites (`service.ts:1017`, `:1267`) throw a plain `Error`
with no code or class. Core has typed errors elsewhere, such as
`AutomationStudioLegacyWriteDisabledError` with `code` (`model/legacy-retirement.ts:93`),
but not for this refusal.

The ownership update allowed adding one. I re-check `endedAt` instead, because
a typed error could not be reached cleanly from the files I own:

- A new module would have to be exported from `runtime/index.ts` (not owned),
  or bridge.ts would import it directly.
- A direct import is counted per importing file
  (`scripts/structure-audit/rules/imports.mjs:126-136`). It would grow bridge.ts's
  frozen entry (`.structure-baseline.json:223`, value 1).
- `model/` is already at its 28-file baseline (`.structure-baseline.json:25`).

`endedAt` is the exact condition the service tests before throwing
(`service.ts:1017`). Finalize sets it under the same lock, and it is never
cleared.

The costs and limits of that choice:

- One `getRecordingSession` read per refused append. It hydrates state-snapshot
  refs (`runtime/service/recordings/store.ts:48-52`) and runs only on the
  failure path.
- An append that fails for an unrelated reason at the same instant the
  recording is finalized is reported as discarded rather than raised. That is
  true about the outcome, but the underlying error is not surfaced.

A typed-error version would need a new file in `runtime/` (23 of 25 files used),
an export in `runtime/index.ts`, line-neutral edits at `service.ts:1017` and
`:1267`, and a bridge import through `../runtime/index.ts`.

**`client-gateway/tests/bridge.test.ts`** (427 → 545 lines). Four tests and
four helpers were added. The main helper, `recordingHeldAtFinalization`, spies
`finalizeRecording`: it lets the real call stamp `endedAt`, then holds it open
while a real `client.stop_recording` is in flight through `gateway.receive`.

- `:372` "reports an action that reaches Core while Stop is finalizing, instead of failing the receive".
  - Covers route 1 through `recordGatewayInput`.
  - `receive` resolves, the finalized timeline is empty, and no `server.error`
    is queued.
  - Two `recording.action_discarded` entries carry the recordingId. The second
    one, sent after Stop closed the recording, shows `discardedEvents: 2, discardedActions: 2`.
- `:392` "discards a queued snapshot whose timer flush lands after finalization".
  Covers route 2.
- `:408` "discards evidence a state update flushes and records, and a client error, while Stop is finalizing".
  - Covers the awaited flush, `recordGatewayInput` for a state update, and the
    `client.error` marker.
  - Audit types are `event_discarded` then `action_discarded`, with final
    totals of 4 events and 1 action.
- `:430` "still fails the receive when an append to an open recording fails for any other reason".
  Guards the discriminator.

**`F:\!FluxIQ\docs\architecture\automation-studio\client-gateway.md`**. A new
paragraph at `:98-112` describes:

- the window between finalization and close, and which messages it applies to;
- the timer and caller flush;
- matching by `endedAt`;
- why the refusal must not escape (`gateway.receive_failed`);
- that other failures still fail the receive;
- that snapshots and state updates arriving after close are dropped uncounted.

The "Nothing is sent back to the client" paragraph is unchanged and still true.

## Commands run and observed results

All commands ran from `F:\!FluxIQ`; outputs are saved in my scratchpad as
`g-core-*.txt`.

1. **Baseline, before any edit.**
   `npx vitest run packages/fluxiq/src/programs/automation-studio/client-gateway/tests/bridge.test.ts --no-file-parallelism`
   → exit 0, `Tests  11 passed (11)`.
2. **The same command with the new tests, before the fix**, plus a temporary
   probe test (since removed) → exit 1, `Tests  3 failed | 13 passed (16)`,
   `Errors  1 error`:
   - `× … reports an action that reaches Core while Stop is finalizing, instead of failing the receive`
     `→ promise rejected "Error: Finalized recordings are immutable." instead of resolving`
   - `× … discards a queued snapshot whose timer flush lands after finalization`
     `→ expected [ 'session.connected', …(2) ] to include 'recording.event_discarded'`
   - `× … discards evidence a state update flushes and records, and a client error, while Stop is finalizing`
     `→ promise rejected "Error: Finalized recordings are immutable." instead of resolving`
   - `Unhandled Rejection` / `Error: Finalized recordings are immutable.` at
     `bridge.ts:597`, `:601`.
   - The discriminator test passed, as expected before the fix.
   - Probe output:
     `PROBE-g-core-late-event {"outcome":"resolved","endedAt":1789282651904,"timeline":["domain_event"]}`
     (see open question 4).
3. **The same command after the fix** → exit 0, `Tests  15 passed (15)`, no
   errors.
4. **Mutation proofs** (`node g-core-mutations.mjs`, scratch). Each mutation
   was applied to bridge.ts, the test file run, and the original bytes
   restored:

   | Mutation | Exit | Result |
   | --- | --- | --- |
   | M1: `if (!await this.isFinalized(recording)) throw error;` → `throw error;` (remove the guard) | 1 | `3 failed \| 12 passed`, `Errors 1 error`: the same three tests and the same unhandled rejection as before the fix |
   | M2: the same line → `if (false) throw error;` (discard every failure) | 1 | `1 failed \| 14 passed`: `× … still fails the receive when an append to an open recording fails for any other reason` `→ promise resolved "undefined" instead of rejecting` |
   | M3: flush calls `appendRecordingEvents` directly (flush unguarded) | 1 | `2 failed \| 13 passed`, `Errors 1 error`: the timer-snapshot and state-update tests, with the unhandled rejection |
   | M4: remove the `rememberClosedRecording` idempotency line | 1 | `2 failed \| 13 passed`: `→ expected { …(12) } to match object { …(3) }` (action test) and `→ expected [ 'recording.event_discarded', …(3) ] to deeply equal [ 'recording.event_discarded', …(1) ]` |

   After every restore the SHA-1 of the raw bytes was
   `5619126dc8cee82a888149952ae15add43e48c39 identical`. Afterwards,
   `git hash-object` on bridge.ts gave `df1ec47a8e8a4f6cd45a7fa574156721cf23ecd1`,
   the same value as right after the fix. (git normalizes line endings, hence
   two different hashes for one file.)
5. **`pnpm check`** → exit 0.
   - `structure-audit: passed (120 warning(s), 256 baselined).`
   - `packages/contracts`, `packages/client-gateway-websocket`, `packages/fluxiq`
     and `apps/web` each printed `check: Done`.
   - Advisory warnings only: bridge.ts at 746 lines and bridge.test.ts at 545
     are "past the 400-line advisory threshold".
6. **`pnpm docs:check`** → exit 1.
   - `Validated local links in 99 authored/reference Markdown files.`
   - `Error: docs/reference/framework-reference.md is stale. Run \`pnpm docs:reference\` and commit the result.`
7. **Scratch generation of the reference**, a copy of `scripts/docs-reference.mjs`
   writing to scratch, diffed against both tracked copies. Only line 238
   differs, identically in each:
   `bridge.ts:84` → `bridge.ts:91` on the `AutomationStudioClientGatewayBridge`
   row. `grep` confirms `91:export class AutomationStudioClientGatewayBridge {`.
8. **`git status --short`** (Core) shows exactly
   `docs/architecture/automation-studio/client-gateway.md`, `bridge.ts` and
   `tests/bridge.test.ts` modified: 213 insertions, 20 deletions.

Each result above is a single run.

## Not verified

- **Live behavior.** No Lab run and no Core build, per the rules. This
  repository imports Core through `dist`, so the Lab keeps running the old
  bridge until the supervisor builds Core. A Lab run must show the following
  across the 24-run `basic-form --flow` campaign, under the same concurrent
  load as the baseline:
  - zero `server.error` frames with code `gateway.receive_failed` and message
    "Finalized recordings are immutable.";
  - the extension's gateway state never `error` after Stop (read via
    `fluxiq.getStatus`);
  - any message caught in the window shows up as `recording.action_discarded`
    or `recording.event_discarded` in the client-gateway snapshot audit log,
    carrying the run's recordingId;
  - no unhandled rejection with that message in the web server output.

  The harness cannot yet read the audit log automatically (row D3 in
  `i-flow-lane-errors`), so the audit condition needs D3 or a manual read of
  `/api/client-gateway/snapshot`.
- **Other tests.** Only the bridge test file ran. Root `pnpm test` was not run
  (forbidden), nor any other Core test file, such as `open-recording.test.ts`.
- **The window in practice.** Its real-world width was not measured; the tests
  force it by holding finalization open.
- **The `client.error` route before the fix** was not observed on its own: the
  state-update step of that test rejected first. Its fixed behavior is
  observed, and M1 fails that test.
- **Programmatic `bridge.stopRecording`** uses the same order and the same
  guarded code, but has no dedicated test.
- **The real server's reaction** to the timer-route unhandled rejection, and
  what the extension does after `markFailed()`.
- **`appendActionResult`**, reached through `bridge.executeAction`, still
  appends unguarded. Its failure goes to the `executeAction` caller, not to a
  gateway receive. Unchanged and untested.

## Open questions or contradictions found

1. **The brief's premise is partly off.** It places the throw "inside
   `flushRecordingEntries`". For the extension's `client.recording_event`, it
   is thrown in `recordGatewayInput` (pre-fix `bridge.ts:549` via `:343`). The
   flush is reached by `client.state_update` (awaited, `:508`) and
   `client.snapshot` (timer, `:564`/`:570`). I guarded all three routes and the
   `client.error` marker, all inside `bridge.ts`.
2. **Contradicts `i-flow-lane-errors` "(c) Code-read aside".** It says the
   extension sends only `client.recording_event` and so never reaches the flush
   route. At extension HEAD `147fdb4` it also sends:
   - `client.snapshot` (`recording-evidence.ts:138`, `:213`);
   - `client.state_update` with an `inputId` (`active-page.ts:104-115`,
     `recording-evidence.ts:156-169`).

   Both flush routes are reachable in normal operation.
3. **Stale citation in `c-remaining` CS1b.** It cites `background/connection.ts:467-477`
   as a second handler that calls `markFailed()`. At HEAD `147fdb4`,
   `connection.ts` has no `server.error` handling. The only handler is
   `server-command-channel.ts:80-91`.
4. **A new Core defect, not fixed because it is outside my files.**
   `appendRecordingDomainEvent` (`service.ts:1477-1487`) and
   `processRecordingDomainEvent` (`model/recording-domain.ts:172` onward)
   never check `endedAt`.
   - A `client.recording_event` whose input is not registered in the IO
     registry, arriving in the same window, is written into the finalized
     recording.
   - Observed once through the temporary probe: `"outcome":"resolved"`, `endedAt` set,
     `timeline: ["domain_event"]`.
   - That breaks the documented promise that "a recording that reports
     `endedAt` is complete and will not change" (the `client-gateway.md`
     paragraph beginning "There is no push notification").
   - Whether the Lab's web-automation inputs are registered, which would keep
     the extension off this route, was not checked.
   - Smallest fix: the same `endedAt` refusal inside `appendRecordingDomainEvent`'s
     lock, plus `appendOrDiscard` around the bridge's domain-event call. I did
     not wrap that call now, because it cannot throw today, so a guard there
     could have no mutation proof.
5. **Brief ownership gap.** Changing bridge.ts lines above the exported class
   makes two tracked generated files stale:
   `docs/reference/framework-reference.md` and
   `packages/fluxiq/docs/reference/framework-reference.md`. Only
   `pnpm docs:reference` fixes them, and the ownership update limited that
   command to export changes. The supervisor should run it in Core and commit
   the one-line diff shown above.
6. **Timer-flush failures other than finalization** (for example a storage
   error at `:618`/`:624`) are still unhandled rejections. Design row C1 asked
   for "a catch on the timer-driven flush". I covered the finalization refusal
   there, but not other errors: those need a decision about where to report
   them, such as a new audit type or a log.
7. **Structure.** No baseline entry needs to change. No new imports, files, or
   exports.
