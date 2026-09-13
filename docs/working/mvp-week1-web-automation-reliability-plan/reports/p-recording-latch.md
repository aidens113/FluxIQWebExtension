# p-recording-latch

Worker report. Task: a recording start that FluxIQ refuses currently latches the
extension idle with no retry. Make a refused start recoverable rather than
terminal, distinguishing the refusals that deserve a retry from the ones that do
not, with a bound that cannot hide a persistent refusal.

## Outcome

**Done.** Refusals are now classified, transient ones are retried a bounded
number of times, and every refusal the extension stops fighting is surfaced.
Extension `check` exit 0 and `test` exit 0 (268 tests, 0 failures, 14 of them
new). The structure audit passes with no new finding.

**Not proven live.** I cannot run the Lab, so no real Core refusal was ever
observed against this code. Everything below about Core's behaviour is read from
Core's source, not from a running system. See "Not verified" — one item there is
material to whether the retry helps a real operator at all, and the supervisor
should read it before treating this as closed.

## The three refusal classes, and why they get different answers

They are not alike, and the important part is that **two of them arrive under
the same wire code**. Core's `resolveClientRecordingProject`
(`F:\!FluxIQ\apps\web\src\lib\automation-studio-context.ts:34-51`) refuses on a
single condition:

```ts
const isFresh = context ? now - context.updatedAt < freshnessMs : false;  // freshnessMs = 10_000
if (!context?.activeProjectId || !isFresh) {
  return { ok: false, code: "recording.project_required", activeProjectId: context?.activeProjectId ?? null, contextUpdatedAt: context?.updatedAt ?? 0 };
}
```

Two unrelated failures share that `return`, and they need opposite responses.

| Class | How it is told apart | Response | Why |
| --- | --- | --- | --- |
| **`project_not_selected`** — persistent | `recording.project_required` with `activeProjectId` null or absent | Surface immediately, never retry | Nobody has chosen a project. No amount of retrying changes that; it is the user's move. A retry loop would only bury the one message that asks them to make it. |
| **`context_stale`** — transient | `recording.project_required` with a non-empty `activeProjectId` | Bounded retry, then surface | The operator *does* have a project open. Reaching that branch with a non-null `activeProjectId` is only possible through the `!isFresh` half, so the request was correct and merely arrived after the context stamp aged out. The identical request succeeds once the context is stamped again. |
| **`project_mismatch`** — persistent | `recording.project_context_mismatch` | Surface immediately, never retry | Core has a fresh project and it is not the one the extension asked for. Re-sending re-sends the same wrong project: a guaranteed loop. |

The discrimination is sound rather than heuristic: given the code is
`recording.project_required`, a non-null `activeProjectId` **implies**
`!isFresh`, because the only other disjunct is `!context?.activeProjectId`.

The metadata that carries it was already on the wire and simply unread.
`apps/web/src/lib/fluxiq.ts:126-130` attaches `activeProjectId` and
`contextUpdatedAt` to the refusal, `client-gateway/bridge.ts:208-213` merges its
own fields and sends them as the `server.error` payload's `metadata`, and
`packages/contracts/src/client-gateway.ts:211` declares
`server.error` as `{ message: string; code?: string; metadata?: JsonObject }`.
No Core change was needed and none was made.

### The bound

`RECORDING_START_RETRY_DELAYS_MS = [400, 1_200, 2_400]` — at most three retries,
about four seconds in total, then the refusal is surfaced exactly as a
persistent one is, carrying the attempt count ("Retried 3 times."). The delays
are spaced rather than immediate because an instant re-send cannot outrun
whatever went stale; four seconds is short enough that the user who pressed
Record is still watching. A recorder that retried forever and told nobody would
be a worse failure than the current latch, because the latch is at least
visible.

## What changed and why

Three new files and two edited, all under `apps/extension/src/background/`.

**New — `connection/recording-start/refusal.ts`.** Pure classification.
`classifyRecordingStartRefusal(payload)` returns the table above, or `undefined`
for any server error that is not a start refusal, so every other error keeps its
existing handling. Also `recordingStartRefusalBlock(refusal, attempts)` (the
panel state, which says it retried when it did) and
`isRecordingStartRefusalError(value)` (so dismissing the block clears exactly
the error the block set and leaves a newer unrelated one alone — it replaces a
hard-coded string comparison in `dismissRecordingBlock`).

**New — `connection/recording-start/handshake.ts`.** `RecordingStartHandshake`:
one pending start at a time, an acceptance window per attempt, the bounded
retry. Its governing rule is that **a refusal is an answer, not silence**, so a
refusal ends the acceptance window immediately instead of racing it. Each
attempt therefore has exactly one outcome:

- *accepted* — the handshake is over;
- *unanswered* — the 750 ms window elapses and recording begins locally, which
  is the pre-existing fallback, unchanged;
- *refused* — the window is cancelled and `refusal.kind` decides: surface, or
  re-send after a delay with a fresh window of its own.

This is the actual bug from the open question. Previously
`handleRecordingProjectRequired` called `clearPendingRecordingStart()`, which
cancelled the 750 ms timer, so a refusal took the recorder to idle and left it
there with nothing scheduled to move it.

A retry re-sends the **same** `recordingId`, `startedAt` and captured
`initialState`, so it is one logical recording rather than a second one. That is
safe against duplication because Core refuses in `startRecordingFromClient`
*before* `createRecording` (`bridge.ts:206-215`), so a refused start left nothing
behind to collide with. The project id is resolved again per attempt (reason
string `recording_start_retry`), since a retry exists precisely because the
project context moved. `metadata.startAttempt` goes on the wire for diagnosis.

**New — `connection/recording-start/index.ts`,** the directory barrel. The
subdirectory rather than two flat files is deliberate: `connection/` already
holds `recording-evidence.ts` and `recording-manifest.ts`, and two more
`recording-*` siblings would have hit the structure audit's three-file prefix
rule (`scripts/structure-audit/rules/naming.mjs`), which asks for exactly this
directory. It also kept my footprint out of the files the concurrent split
worker is moving.

**Edited — `connection.ts`.** The `pendingRecordingStart` field and its two
helpers are gone, replaced by the collaborator. `handleRecordingProjectRequired`
became `applyRecordingRefusal(refusal, attempts)`, taking its wording from the
classified refusal instead of hard-coding one refusal's text;
`handleRecordingStartTimeout` became `beginRecordingWithoutAcceptance`, same
body. The `server.error` branch now classifies before falling through to
`gateway.markFailed()`.

Two smaller corrections came with that:

- A `recording.project_context_mismatch` used to fall past the
  `project_required` check into `this.gateway.markFailed()`, tearing down a
  healthy socket over a recording-scoped refusal. It is now surfaced as the
  persistent refusal it is. Flagged rather than silent because it is a
  behaviour change slightly beyond the brief's letter.
- `startRecording` resolved the project id once for an activity-log string and
  the send now resolves it again; the pre-resolve became
  `this.projects.current()` (no I/O) so a cold start does not make two Core
  snapshot lookups and log two "Project context unavailable" warnings.

**Edited — `connection/index.ts`,** five names added to the barrel. Kept to what
`connection.ts` actually imports rather than the module's full surface, to keep
the conflict surface small for the split worker.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=p-recording-latch` throughout. Exit statuses
captured by redirect to a scratchpad file and `echo $?`, never through a pipe.
No `pnpm lab` command was run.

1. `pnpm --filter @fluxiq-web-extension/extension check` → **exit 0**, no output
   beyond the two `tsc` invocations. Run four times across the change (the first
   run failed with four `TS2339 Property 'refusal' does not exist on type
   'never'` errors in my own test file — `assert.deepEqual(x, [])` narrows `x`
   to `never[]` through `@types/node`'s `asserts actual is T` overload; replaced
   with `assert.equal(x.length, 0)`).
2. `pnpm --filter @fluxiq-web-extension/extension test` → **exit 0**,
   `# tests 268 / # pass 268 / # fail 0 / # cancelled 0 / # skipped 0`. Run
   three times, identical each time.
3. The 14 new tests, confirmed present in that run by name (`ok 15` onward
   belongs to pre-existing files):
   - `ok 1 - a transient refusal is retried, and the retry re-sends the same recording`
   - `ok 2 - a transient refusal that never resolves is surfaced after the bound, and stops`
   - `ok 3 - a persistent refusal is surfaced on the first answer and is never retried`
   - `ok 4 - a persistent refusal mid-retry ends the retries immediately`
   - `ok 5 - silence still starts the recording locally, once, and only for the pending start`
   - `ok 6 - an accepted start cancels the pending retry`
   - `ok 7 - disconnecting cancels the handshake, and a new start replaces the old one`
   - `ok 8 - a refusal that still names an active project is the freshness check, so it is transient`
   - `ok 9 - a refusal naming no active project is nobody having chosen one, so it is persistent`
   - `ok 10 - the not-selected refusal keeps the wording the panel and the runner already read`
   - `ok 11 - a project mismatch is persistent: re-sending sends the same wrong project`
   - `ok 12 - a server error that is not a start refusal is not classified at all`
   - `ok 13 - an exhausted refusal says it was retried; a first refusal does not`
   - `ok 14 - dismissing a block clears a refusal's error and leaves an unrelated one alone`

   Test 2 is the one the brief asks for on both counts: it drives three
   transient refusals through the bound and then asserts `timers.count() === 0`
   and `handshake.isPending() === false` — nothing left running, nothing left
   pending, no silent loop — with the refusal surfaced once, carrying
   `attempts === 3`. Test 3 is its opposite: a persistent refusal surfaces on the
   first answer with `retries.length === 0` and one send.
4. `node scripts/structure-audit.mjs` → **exit 0**,
   `structure-audit: passed (31 warning(s), 19 baselined)`. No new failing
   finding. `connection.ts` grew from 745 to 764 lines — the constructor's
   handshake wiring is larger than the two helpers it replaced — and
   `FluxIQConnection` reports 38 methods. Both were already past their advisory
   thresholds before this change and neither is near its failing limit (800
   lines, 40 methods), but the file is not getting smaller and the split worker
   is the one addressing that.
5. Wording strings the runner and panel already read were checked to be
   unchanged for the `project_not_selected` case (`recording.project_required`,
   `Project Required`, `Open a FluxIQ project before recording.`) — test 10
   pins them, so `run-scenario.ts:487`'s `recordingBlockCode` diagnostic and the
   popup overlay behave as before.

## Not verified

- **No live Core refusal, of any class.** I cannot run the Lab, so nothing here
  has been exercised against a running gateway. The classification is derived by
  reading Core's resolver, provider and bridge; the wiring is proven only by
  unit tests with hand-driven timers. A Lab run that forces the 10 s freshness
  race — the controlled reproduction `w1-recording-start-flake` describes, a
  deliberate pause before the start — is what would actually prove it.
- **No browser validation.** This is background/service-worker lifecycle and
  timer code. Nothing was loaded into Chrome, Edge or Firefox, and no panel or
  side-panel rendering of the new block message was seen.
- **`apps/extension/build/` was not regenerated.** It is tracked, and `pnpm
  build` was deliberately not run: it rewrites tracked artifacts outside my
  brief's Owns paths while other workers are editing extension source. The
  committed build is stale with respect to this change.
- **The `project_mismatch` metadata shape** is read from Core's source, not
  observed. If Core ever sent a mismatch without `activeProjectId`, the
  classification would still be persistent, which is the safe direction.
- `structure-audit` reports `1 baseline entries can be lowered`. It is not from
  this change — every baselined key is under `packages/` or `scripts/`, and I
  touched only `apps/extension`. I did not run `pnpm structure:baseline`,
  because `.structure-baseline.json` is shared state outside my brief.

## Open questions or contradictions found

1. **The retry may have nothing to wait for, and this is the important one.**
   A transient refusal is only worth retrying if something restamps Core's
   context inside the retry window. In the product, nothing does on a timer.
   `apps/web/src/features/automation-studio/live/hooks/useGatewayRecordingBridge.ts:29-48`
   posts the context on mount, on `window` `focus`, and on `visibilitychange`
   **when the document is visible** — there is no heartbeat, and I found no
   `setInterval` anywhere in that feature that refreshes it. Core's freshness
   window is 10 s. So an operator who presses Record in the side panel while
   sitting on the target page — the ordinary case — has a context last stamped
   whenever they last focused the Automation Studio tab, which is very often
   more than 10 s ago, and that tab will not restamp while it stays in the
   background.

   The consequences, and they cut both ways:
   - The stale refusal is probably not a rare edge case in the product; it may
     be the common path for any extension-initiated start. That makes the
     missing retry worth fixing, and it also means my fix alone may not be
     enough.
   - The retry does recover the realistic case where the operator reacts to the
     block by switching to the Automation Studio tab, which fires `focus` and
     restamps, and the next attempt succeeds. It also covers a start issued from
     a focused panel. It cannot recover an operator who never returns to that
     tab within four seconds.
   - The durable fix looks Core-side: either the Automation Studio page
     heartbeats its context, or the freshness window stops being 10 s against an
     event-driven stamp. That is a Core decision and outside this brief, so I
     made no Core change and did not raise it with the user. **Supervisor:
     this deserves its own open-questions entry against Core.**
2. **A refusal arriving while a recording is live still tears that recording
   down.** `applyRecordingRefusal` sets `recordingState = "idle"` when the state
   is `"recording"`, which is exactly what `handleRecordingProjectRequired` did
   before, so this is not a regression and I did not change it. But it means a
   refusal for some *later* start — one the web panel asked for, say — kills a
   running recording that had nothing to do with it. Deciding whether a refusal
   should be scoped to the start it answers is a behaviour change I judged
   outside this brief.
3. **A locally started recording after a refused start captures nothing
   durable.** If the acceptance window elapses and recording begins locally,
   `client.recording_event` messages are appended against Core's
   `activeRecordings` map — which has no entry, because the start was never
   accepted (`bridge.ts:181-203`). Events are dropped. This is pre-existing and
   unchanged; it matters mainly as a reason not to "recover" by silently
   recording locally forever, which is why exhaustion surfaces instead.
4. **Concurrent-edit risk with `p-connection-split`, not yet an actual
   collision.** `reports/p-connection-split.md` did not exist when I started or
   when I finished. As I finished, five untracked files appeared in
   `connection/` — `active-page.ts`, `active-recording.ts`,
   `recorded-event-intake.ts`, `server-command-channel.ts` and my own
   `recording-start/`. That worker has **not** modified `connection.ts` or
   `connection/index.ts`; both diffs there are mine alone, verified with
   `git diff`. So we have not collided, but their integration into
   `connection.ts` is still ahead of them and will land on top of my edits.
   The recording-start work is confined to the collaborator directory plus a
   contained region of `connection.ts` (the constructor's handshake wiring,
   `startRecording`, the `server.error` branch, `applyRecordingRefusal`,
   `beginRecordingWithoutAcceptance`), which should move as a unit into
   whichever module ends up owning recording start.
