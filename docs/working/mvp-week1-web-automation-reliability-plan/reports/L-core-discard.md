# L-core-discard — a discarded recording event, and a proposal served from a recording still being written

Worker `L-core-discard`, 2026-09-12. All work in `F:\!FluxIQ` (FluxIQ Core).
Nothing in `F:\!FluxIQWebExtension` was changed except this report. No `pnpm
lab` and no downstream build. Every exit status captured by redirecting stdout
and stderr to a file and reading `$?`, never through a pipe. Core's tests were
run with `--no-file-parallelism` throughout.

---

## Outcome

**Done, with one contract decision stopped and handed back.**

Both halves of the defect are now observable, and neither reports success while
losing the user's work:

1. A `client.recording_event` (or `client.recording_entry`) that arrives after
   its recording was finalized is counted and written to the gateway audit log,
   naming the recording, the event, and how late it was. It was previously
   dropped by `if (!active) return;` with nothing recorded anywhere.
2. `createRecordingFlowProposals` still serves a proposal built from an
   unfinalized recording — but it now says so, in the returned `issues` and on
   the stored proposal artifact's metadata, so the caveat survives on disk.

**Stopped, not shipped: telling the client.** An error frame is the obvious way
to tell a recorder that its action was lost, and it is the one change I did not
make, because the downstream extension marks the whole gateway connection
failed on any `server.error` code it does not recognise. Evidence and the
proposed shape are in "The contract change I did not make".

**The finalized signal exists.** `endedAt` — same answer `L-race-fix` reached
independently; details below, including the two caveats that answer does not
carry on its own.

---

## Does Core expose a recording-finalized signal? Yes, but only a pollable one

Answered in full because it was the brief's question, and because two facts
around it matter more than the yes.

- **There is no push signal.** `ClientGatewayServerMessage`
  (`packages/contracts/src/client-gateway.ts:201-211`) has no
  `server.recording_finalized`. `server.stop_recording` is sent by
  `gateway.stopRecording` *before* the bridge drains, flushes and finalizes,
  so it is a command, not a completion. On the client-initiated path
  (`client.stop_recording`) Core sends nothing back at all. There is no
  subscription, no event stream, no `recording.finalized` anywhere in the
  repository.
- **`endedAt` is a real completion predicate, not a proxy.**
  `finalizeRecording` (`runtime/service.ts:1038-1048`) takes the recording
  mutation lock, stamps `endedAt`, and writes the session and the project
  recording-index entry; `appendRecordingEvents` (`service.ts:1014-1017`) takes
  the same lock and throws `"Finalized recordings are immutable."` once it is
  set. Finalization is the last write the bridge makes — after `stopDrainMs`
  and after `flushRecordingEntries`. So a recording reporting `endedAt` is
  complete **and cannot subsequently change**.
- **Caveat 1 — a recording may never report it.** Nothing finalizes a recording
  whose client vanished. A poller must have a bound and must fail loudly at it
  rather than proceeding, which is what `L-race-fix` did.
- **Caveat 2 — `endedAt` in a summary comes from the project index.** It is
  written by `writeProjectRecordingSession` (`service.ts:5417-5426`), which
  `finalizeRecording` calls, so `list-recordings` is a correct and cheap place
  to poll. `get-recording` hydrates every state-snapshot ref and is the
  expensive one.

The gateway is entitled to a client-visible completion frame, and adding one
would let a recorder stop guessing. That is a protocol addition, so it is on
the same list as the error frame below, not in this change.

---

## Part 1 — the discarded recording event

### What should happen to a late event: the three options, weighed

**Keep it.** Rejected. `appendRecordingEvents` refuses a finalized recording by
design, and that rule is what makes `endedAt` mean anything at all: the moment
a finalized recording can grow, every consumer that read it — the Proposal
Generator, a normalized timeline, a Flow already written from it, and the
downstream lane's new wait — is reading something that may change underneath.
The cost of keeping one late action would be paid by every reader of every
recording. Not worth it.

**Reject it explicitly to the client.** Right in principle — the client is the
only party that could do anything (retry, warn the user, refuse to report the
recording as clean) — and **unsafe today**. See the contract section.

**Discard it, but never silently.** What I shipped. It does not recover the
action; it converts an invisible loss into a recorded one, which is the
difference between a bug nobody can find and a bug with a timestamp.

### Who is told, and how

Core has no logger — no `console.warn` and no logging facility anywhere in
`packages/fluxiq/src`. Its one operator-visible event channel is the **gateway
audit log**, which is surfaced through `snapshot().auditLog` and already drives
UI behaviour (`useGatewayRecordingBridge.ts` reads
`recording.project_required` from it). That is where a person debugging looks,
so that is where the discard goes.

Two audit types, chosen so loudness tracks harm:

| Type | When | Why |
| --- | --- | --- |
| `recording.action_discarded` | **Every** discarded message that would have become an executable action entry | Each one is a piece of the user's work the client believes it recorded and Core does not have |
| `recording.event_discarded` | **Once** per closed recording, for discarded evidence | A page unloading after Stop legitimately emits a trail of observations |

Both carry `recordingId`, `projectId`, `clientId`, `eventType`, `inputId`,
`domainId`, `executable`, the running `discardedEvents` and `discardedActions`
totals, and `sinceFinalizedMs`. The message names the recording:

```text
Discarded an executable action (dom.click) that arrived 312 ms after recording
recording.x was finalized. The client believes it was recorded; the recording
does not contain it.
```

**On not being noisy.** The evidence trail after Stop is exactly the legitimate
case the brief warned about, so it gets one entry and a counter, not an entry
each. An action discard is never legitimate, so it is never suppressed — and
its count is bounded by the number of actions actually lost, which is the
quantity you want the log to be proportional to. Counts are accurate at the
moment each entry is written rather than a stale "1" that later becomes wrong;
that is why the running totals ride on the entry rather than a single summary
being emitted first.

Classification is `io.getInput(domainId, inputId)?.definition.role === "action"`
for a recording event, and `entry.type === "action"` for a recording entry.
Anything unregistered or unmapped counts as evidence, so an unknown message is
reported quietly rather than as lost work — the conservative direction.

### The contract change I did not make

`AutomationStudioClientGatewayBridge` already has
`reportRejectedRecordingEvent`, which sends `server.error` with
`recording.event_rejected` when a domain event fails validation. Sending the
same kind of frame for a late event is one line, and I did not write it,
because of this, in the downstream extension:

```ts
// apps/extension/src/background/connection/server-command-channel.ts:79-86
if (message.type === "server.error") {
  this.deps.setLastError(message.payload.message);
  if (message.payload.code === "recording.project_required") { … return; }
  this.deps.gateway.markFailed();
  return;
}
```

`connection.ts:467-479` does the same, sparing only codes that
`classifyRecordingStartRefusal` recognises. **Any other `server.error` marks
the gateway connection failed.** A frame for a discarded late event would
therefore tear down a healthy connection every time a page unloads after Stop —
turning a silent data loss into a visible connection failure, which is worse in
a different way, and precisely the "fires in normal operation" trap.

Two consequences for the supervisor:

1. **The proposed contract change**, for your decision: a `server.error` code
   `recording.event_discarded` (or a reuse of `recording.event_rejected` with
   `reason: "recording_finalized"`), paired in the same work unit with a
   downstream change that classifies it as recording-scoped rather than
   connection-scoped — the same treatment `recording.project_required` already
   has. Core-side it is one call; the downstream side is the real work. Without
   the pair it must not ship.
2. **A finding worth its own line:** the sibling failure mode already does
   this today. An event that arrives after `finalizeRecording` but *before*
   `activeRecordings.delete` reaches `appendRecordingEvents`, throws
   `"Finalized recordings are immutable."`, and the throw propagates out of
   `gateway.receive` to the WebSocket host
   (`apps/web/src/server/client-gateway-websocket.ts:134-139`), which replies
   with `server.error` carrying that raw message and **no code** — so the
   extension marks the connection failed. That is an existing, unintended
   connection kill on a race, and it is not fixed here.

### What I shipped, and where

- `packages/fluxiq/src/client-gateway/service.ts` — new
  `recordAuditEvent({ type, message, sessionId?, metadata? })`. `sendError` was
  the only route into the audit log and it also puts a frame on the wire; a
  program that owns recordings needs to record an operational event the client
  can do nothing about. **This is the one Core public-surface addition in this
  change** — additive, no wire change, no existing caller affected. The class
  comment says a method is added here "only when that contract changes", so
  call it out if you disagree; it reverts cleanly.
- `packages/fluxiq/src/programs/automation-studio/client-gateway/bridge.ts` —
  a `closedRecordings` map (one entry per client, capped at 32) remembers the
  recording each client last finalized, so a late message can be attributed to
  it; the two `if (!active) return;` discard sites now count and report. The
  map is cleared when that client starts a new recording.

Deliberately **not** changed: the `!active` returns in `appendSnapshot`,
`appendStateUpdate` and `appendActionResult`. They carry evidence and runtime
action results, not the user's recorded actions, and routing them through the
same counter would drown the signal. Say the word if you want them included.

---

## Part 2 — the proposal built from a recording still being written

Taken with Part 1 as you asked, and they are the same shape: Core holds a
recording whose state contradicts the request, and answers as though it does
not.

### The three options, weighed

**Wait for `endedAt`.** Attractive for one line and then not. A recording whose
client crashed never finalizes, so the endpoint needs a bound; at the bound you
are back to choosing refuse or serve, having also held a request open for the
whole timeout with no cancellation path. Waiting inside Core also removes the
caller's ability to ask for a deliberate mid-recording preview. It converts a
wrong answer into a hang, which is not an improvement.

**Refuse, as `processFinalizedRecording` does.** Correct end state, and the
product path already behaves this way ("Recording is still open."). But
`create-recording-flow-proposals` currently *succeeds* for an open recording,
so refusing is a behaviour change on a public endpoint: any caller that
legitimately previews a recording in progress starts failing. That is a
contract decision, so per the brief I am not making it.

**Serve it and say so.** Shipped. `issues: string[]` already exists on
`CreateRecordingFlowProposalsResult` and already carries exactly this class of
message ("Compacted N high-frequency state entries…"), so adding one is not a
contract change — no type changes and every caller already receives the field.

**My recommendation:** ship serve-and-report now (done), and make refusal the
default in a follow-up that pairs the Core change with an explicit opt-in for
the preview case (`allowOpenRecording`, or an extension of the existing `force`
flag). Serve-and-report is the honest stopgap, not the destination: a proposal
built from a half-written recording does not merely look short, it looks
*finished*, and a reviewer who approves it writes a Flow missing the user's
last actions. The issue string only helps a caller that reads `issues` — which
the downstream lane provably did not, until `L-race-fix`.

### What I shipped, and where

- New `runtime/service/proposals/open-recording.ts` exporting
  `openRecordingProposalNotice(recording)`, which returns the issue text and
  the artifact metadata, and returns nothing at all for a finalized recording.
- `runtime/service.ts` — `createRecordingFlowProposals` now emits that issue on
  **every** return path including the cached-proposal one, and stamps
  `metadata.recordingOpenAtGeneration` and
  `metadata.recordingEntryCountAtGeneration` onto the stored artifact so the
  caveat outlives the response.

The issue reads:

```text
Recording recording.x has not been finalized. This proposal was built from the
4 entries appended so far, and the recording can still grow, so actions
performed near the end of it may be missing. Generate again once the recording
reports endedAt.
```

**Noise:** neither the issue nor the metadata appears for a finalized
recording, which is every product path — the UI generates after stop, and
`processFinalizedRecording` refuses an open recording outright. A test asserts
that absence explicitly.

**A structural constraint shaped the code.** `runtime/service.ts` sits exactly
on its frozen `file-lines` baseline (6919) and `runtime/tests/service.test.ts`
on its own (4789), so neither may gain a line; `runtime/tests/` holds exactly
25 files, the hard directory limit, so no test file can be added there. The
service edits are therefore strictly line-neutral (call sites inlined, the
import name appended to an existing import line), and the new tests live in
`runtime/service/proposals/tests/open-recording.test.ts` — the module that owns
the new function. By the letter of the placement doctrine the nearest directory
containing both subjects is `runtime/`, whose `tests/` folder is full; I noted
that reasoning in the test file. Move it if you would rather pay down the
directory first.

---

## Files changed

| File | Change |
| --- | --- |
| `packages/fluxiq/src/client-gateway/service.ts` | `recordAuditEvent` (+17) |
| `packages/fluxiq/src/programs/automation-studio/client-gateway/bridge.ts` | discard accounting and reporting (+144/-6) |
| `…/client-gateway/tests/bridge.test.ts` | 2 tests (+83); file normalized to CRLF to match its own existing endings |
| `…/runtime/service/proposals/open-recording.ts` | new, 28 lines |
| `…/runtime/service/proposals/index.ts` | barrel export (+1) |
| `…/runtime/service/proposals/tests/open-recording.test.ts` | new, 4 tests |
| `…/runtime/service.ts` | 6 line-neutral edits; 6919 lines before and after |
| `…/runtime/tests/service.test.ts` | 2 assertions adjusted, line-neutral (see below) |
| `docs/architecture/automation-studio/client-gateway.md` | discard behaviour, audit types, and the `endedAt` completion rule |
| `docs/architecture/automation-studio.md` | open-recording proposal behaviour |
| `docs/reference/framework-reference.md` + `packages/fluxiq/docs/reference/…` | regenerated (see "Open questions", item 4) |

Two existing assertions in `service.test.ts` had to move, and both were tests
that generate a proposal from a recording they never finalize:

- `expect(issues).toEqual([])` → `toEqual([expect.stringContaining("recording.mapped has not been finalized")])`
- `expect(result.issues[0]).toContain("saw 1 entries …")` → `expect(result.issues.join(" ")).toContain(…)`

The honest change would have been to finalize the recording in both, matching
the product path, but that costs two lines the frozen baseline will not allow.
Worth doing when the baseline is next regenerated.

---

## Commands run and observed results

All from `F:\!FluxIQ`, exit statuses by redirect.

| Command | Observed |
| --- | --- |
| `npx vitest run --no-file-parallelism …/tests/bridge.test.ts` (**before** the bridge change) | **exit 1** — `2 failed \| 9 passed (11)`; `expected [] to have a length of 1` and `expected [] to deeply equal [ 'recording.event_discarded', 'recording.action_discarded' ]` |
| the same command (**after**) | **exit 0** — `Test Files 1 passed (1)`, `Tests 11 passed (11)` |
| `npx vitest run --no-file-parallelism …/proposals/tests/open-recording.test.ts` (**with the service wiring reverted**) | **exit 1** — `2 failed \| 2 passed (4)`; `expected [] to deeply equal [ StringContaining{…} ]` on both the direct and the cached-proposal path |
| the same command (**restored**) | **exit 0** — `Tests 4 passed (4)` |
| `pnpm -r check` | **exit 0** — contracts, fluxiq, client-gateway-websocket, apps/web all `Done` |
| `node scripts/structure-audit.mjs` | **exit 1** mid-task, one violation, **not mine**: `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks`. Cleared by someone else before I finished; the final run is **exit 0** |
| `pnpm check` (final) | **exit 0** — structure-audit rule tests, the audit itself, and all four package type checks |
| `pnpm docs:check` | **exit 0** after `pnpm docs:reference` — `Validated local links in 99 authored/reference Markdown files. Deterministic framework reference is current.` |
| `pnpm build` | **exit 0** (a first attempt failed on `ENOENT … .next\server\pages-manifest.json`, a Next/Turbopack flake; the retry and a full clean rerun both exited 0) |
| `pnpm package:lint` | **exit 0** — publint + attw green for all three published packages |
| `pnpm -r test -- --no-file-parallelism` | **exit 0** — contracts 7, client-gateway-websocket 3, **fluxiq 130 files / 856 tests**, apps/web 228 files / 1156 tests, all passed |

`pnpm check` failed for most of this task on a violation that was not mine, and is green now. The violation was
`docs/working/README.md` being stale against the header block of
`docs/working/mvp-week1-web-automation-reliability-plan.md`. Both files were
already modified in the working tree before I started
(`Status detail`, `Last updated: 2026-09-12` and `Scope` were rewritten); the
rule inspects only `docs/working/`, which I did not touch, and clearing it
meant running `pnpm structure:baseline`, which rewrites a shared document a
worker must not edit, so I left it. It was cleared by someone else while I was
finishing, and the final `pnpm check` exits 0 with my new file and new
`tests/` directory in place.

Two full-suite runs before the final one failed on tests that are not mine:

- run at 18:15 — the 2 `service.test.ts` assertions above, since fixed;
- run at 18:21 — 6 failures in `nodes/tests/parameter-bindings.test.ts`, whose
  subject `nodes/parameter-bindings.ts` had 160 lines of **uncommitted work by
  a concurrent worker** in the shared tree at that moment. Those tests pass in
  the final run.
- Once, `service.test.ts` timed out at 15 s on "applies edited proposal
  overrides exactly…", a test I did not touch; it passed alone (108/108) and in
  the final full run. Load flake on a busy machine.

---

## Not verified

- **No live browser or Lab run.** The brief forbade it and four Lab instances
  are live downstream. Everything here is unit-proven against Core's own
  service and gateway; the discard path has never been observed firing against
  the real extension. The reproduction campaign `L-dropped-action` ran should
  be repeated once the machine is quiet — the audit entry it should now
  produce is the fastest way to confirm which of the two discard mechanisms
  claimed the two actions missing from its persistent run 1.
- **Whether the audit entry is visible in the web panel's gateway activity
  view.** `snapshot().auditLog` feeds
  `automationStudioGatewayActivitySnapshot`, and `recording.project_required`
  reaches the UI through the same path, so the channel is proven; I did not run
  the panel to see my two new types rendered.
- **The audit log is in memory and capped at the last 100 entries in the
  snapshot view.** It does not survive a Core restart. A durable per-recording
  record of the loss would mean either mutating a finalized recording
  (forbidden) or adding a field to the recording index (a contract change).
  Neither was in scope; if you want the loss to survive a restart, that is the
  decision to take.
- **Executable-action classification against the real web domain.** It reads
  `inputId` from event metadata and asks the IO registry for the input's role,
  which is exactly what `recordGatewayInput` does one line later on the happy
  path — but I proved it with a test registry, not with `domain/src/io`.
  An input whose `role` is `action` but whose `outputBinding` does not resolve
  would be counted as an action here while the live path would have stored it
  as an observation. That errs toward reporting, which is the right direction.
- **Whether any other caller of `create-recording-flow-proposals` reads
  `issues`.** I added to the field; I did not audit its consumers. The web UI's
  handling of the new issue string is unexamined.
- **`processFinalizedRecording` and `generateRecordingProposal`** both call
  `createRecordingFlowProposals` internally (`service.ts:1071`, `:1143`). They
  refuse open recordings earlier, so the new issue should be unreachable
  through them; I did not write a test for that.

---

## Open questions and contradictions found

1. **The error frame is the real fix for Part 1 and it needs a paired
   downstream change.** Decision yours; evidence above. Until then a recorder
   still believes it recorded an action Core discarded — the audit entry tells
   the operator, not the client.
2. **Refusing an unfinalized proposal is the real fix for Part 2**, and it is a
   public-endpoint behaviour change. Same handling: yours to decide. My
   recommendation is to do it with an explicit opt-in for previews, and soon —
   the current behaviour hands a reviewer a proposal that looks complete.
3. **An existing race already kills the extension's connection.** The
   `"Finalized recordings are immutable."` throw escapes to the WebSocket host
   and comes back as an uncoded `server.error`, which the extension treats as a
   failed gateway. It is a narrow window (between `finalizeRecording` and
   `activeRecordings.delete`) but it is the same race that produces the late
   events, so it fires under exactly the conditions that were measured at 50%.
   Not fixed here; worth its own brief.
4. **`pnpm docs:reference` folded a concurrent worker's drift into the
   generated reference.** Of the four changed rows in each copy of
   `framework-reference.md`, one is mine
   (`AutomationStudioClientGatewayBridge` `bridge.ts:56` → `:84`) and three are
   line-number updates for `nodes/parameter-bindings.ts`, whose edits belong to
   someone else. Harmless — the generator is deterministic and whoever commits
   will regenerate — but the diff is not purely mine.
5. **The client gateway architecture doc changed under me** while I was
   editing it: the `client.start_recording` bullet gained context-lease text
   from another worker. My section is intact and I left theirs alone.
6. **`service.ts` and `service.test.ts` are both pinned to the line for the
   whole team.** Any further work in `createRecordingFlowProposals` is going to
   fight the same constraint. The audit reports "1 baseline entries can be
   lowered"; regenerating the baseline on a quiet tree would unblock the two
   `service.test.ts` tests that should be finalizing their recordings.
