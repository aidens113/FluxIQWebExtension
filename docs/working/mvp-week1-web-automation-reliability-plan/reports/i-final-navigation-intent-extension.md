# i-final-navigation-intent-extension — extension-side intent/ack design

Read-only Stage 4d investigation, 2026-09-13. I read the Week 1 Current
State, the Stage 4d brief, the existing W10 reports, and only the named
extension background composition, test-control handling, navigation intake,
recorder, recording lifecycle, and their closest tests. I made no source,
Core, shared-document, build, Lab, commit, or remote change.

## Conclusion

**High confidence (0.96): the smallest deterministic cross-browser seam is
one extension-owned, test-control-only scripted-navigation intent, indexed by
the manager's current automation tab and a bounded safe destination.** The
intent must claim the same tab's next top-frame commit before the current
browser transition/reload classification, pass its redirect burst through the
existing 250 ms debounce, and emit exactly one ordinary executable
`browser.navigation` event with `metadata.transition = "typed"`. Its await
response may become successful only after that event's existing gateway send
has resolved.

This is necessary because intake currently derives `typed`, `page`, or `other`
solely from `webNavigation.transitionType`
(`recorded-event-intake.ts:105-115`), and only the `typed` branch adds the
metadata which makes the event executable (`recorded-event-intake.ts:146-153`).
The W10 recheck established that a time barrier and a Chromium CDP transition
request still produce one/two-candidate recordings. The new seam does not
weaken W10's oracle and does not add a Core/domain concept.

The supervisor's proposed wire contract is compatible with this design. The
request should not accept a tab id: `FluxIQConnection` derives the active
automation tab from `ActivePage.tabId()` (`active-page.ts:57-62`), preventing a
test page from selecting an arbitrary tab through this new message.

## Exact control contract

All responses are fixed-shape and contain no URL, page title, browser error,
gateway error, token, or recording payload.

| Operation | Request | Response |
| --- | --- | --- |
| Arm | `{ type: "fluxiq.test.armScriptedNavigation", url }` | `{ ok: true, intentId }`, or `{ ok: false, code }` |
| Await | `{ type: "fluxiq.test.awaitScriptedNavigation", intentId }` | `{ ok: true, intentId }` only after the recording-event send, or `{ ok: false, code }` |
| Cancel | `{ type: "fluxiq.test.cancelScriptedNavigation", intentId }` | Always `{ ok: true, cancelled: boolean }`; unknown/already-terminal is `false` |

`code` is a closed, non-descriptive vocabulary:
`invalid_request`, `forbidden`, `not_recording`, `no_automation_tab`, `busy`,
`expired`, `cancelled`, `recording_stopped`, `tab_closed`,
`destination_mismatch`, `send_failed`, and `unknown_intent`. The handler must
not throw a transport/browser error into `background/index.ts`'s generic error
echo (`background/index.ts:74-80`), because that echo preserves an exception's
message.

Arm validation is exact:

- `url` is a string no longer than 2,048 UTF-16 code units and parses once.
- Protocol is `http:` or `https:`; hostname is exactly `127.0.0.1`, `[::1]`, or
  `localhost`; username and password are empty; query and fragment are empty.
- Store only canonical `{ origin, pathname }`, with pathname capped at 1,024
  code units. Never retain or return the request string.
- The manager must be recording, have a non-negative safe-integer active tab,
  and have no non-terminal intent for that tab.
- Lifetime is a fixed extension constant of 30,000 ms. The request cannot
  choose or lengthen it. Use injectable id, clock, timers, and clear-timer
  dependencies in the focused unit test.
- `intentId` is `crypto.randomUUID()` (or an equivalently unpredictable opaque
  128-bit identifier), never a tab id, URL, timestamp, or recording id.

The loopback-only restriction is appropriate because this is Testing Lab
control, not a product navigation API. It makes accidental production use fail
closed and matches the current W10 fixture. If future real-site scenarios need
the seam, that is a separate security decision, not a reason to accept arbitrary
origins now.

## Exactly-once state machine

There is at most one live intent per tab, plus an id lookup so `await` can
arrive after a fast send. Completion is a non-rejecting promise carrying only
the fixed result above.

| State | Accepted input | Transition and invariant |
| --- | --- | --- |
| absent | valid arm | `armed`; allocate id, tab, safe destination, completion, and expiry timer |
| armed | another arm for tab | no transition; return `busy` |
| armed | top-frame commit for another tab | no transition and return “not owned”; ordinary intake continues |
| armed | top-frame commit for its tab | return “owned” immediately and submit `{id, tab, commit}` to the existing per-tab debounce; browser transition label, including `reload`, is not inspected |
| armed | later same-tab commit before 250 ms | remain `armed`; replace the pending callback through `NavigationRecorder.schedule`, preserving its current redirect-collapse rule (`navigation-recorder.ts:79-90`) |
| armed | debounced callback, safe destination matches | atomically `sending` before the first await; claim the final URL in `NavigationRecorder` and invoke the existing recording-event path once with a `typed` event |
| armed | debounced callback, destination differs | terminal `destination_mismatch`; send no fabricated action |
| sending | another commit/callback | never send again; it cannot acquire the already-claimed id |
| sending | recording event resolves | terminal `sent`; resolve completion success only now |
| sending | recording event rejects | terminal `send_failed`; expose no error text |
| armed/sending | cancel, expiry, recording stop, tab close, disconnect/reset | terminal fixed failure; clear expiry and tab ownership; late debounce/send settlement cannot overwrite terminal state |
| terminal | await | return the latched result, delete id state, clear residual timer |
| terminal/unknown | cancel | idempotent success with `cancelled: false` |

If success happens before the runner calls await, retain the terminal result by
opaque id until await or the original 30-second lifetime, whichever comes
first. Remove tab ownership immediately on any terminal result, so no terminal
entry can make the tab permanently busy. If an await runtime request is already
open, cancellation/expiry resolves it negatively. Service-worker loss yields
`unknown_intent` after restart, which is a safe failed acknowledgement.

### Commit and send ordering

Intent ownership must be the first branch of
`RecordedEventIntake.noteNavigationCommitted`, before the existing
`transitionType === "reload"` return and before origin selection
(`recorded-event-intake.ts:105-114`). `background/index.ts` already discards
subframes at the browser boundary (`background/index.ts:64-67`), but intake and
the intent must still require `frameId === 0` defensively.

The owned commit must not also enter ordinary `scheduleNavigation`; otherwise
a naturally `typed` commit can produce two candidates. The intent's debounced
callback creates the same current payload shape:

```text
kind: browser.navigation
sequence: EventSequence.next()
url: the validated armed URL
metadata.transition: typed
tabId: the derived automation tab
```

It then re-enters `FluxIQConnection.handleRecordingEvent`, preserving the one
intake/gateway/evidence path. `RecordedEventIntake.processEvent` awaits
`gateway.send("client.recording_event", ...)` before evidence and return
(`recorded-event-intake.ts:156-176`), so resolving the intent only after that
public call resolves is stronger than the required post-send acknowledgement.
It also preserves the existing domain mapping without a new wire field.

Before sending, call `NavigationRecorder.noteRecordedTab` with the safe armed
URL so a later ordinary callback cannot record the same destination again
(`navigation-recorder.ts:118-130`). Do not call `shouldRecord`: the intent is
the explicit intent proof and must not be dropped merely because its URL is the
recording's seeded URL or because a preceding click remains explanatory
(`navigation-recorder.ts:95-115`).

Cancellation on recording stop must happen synchronously before
`ActiveRecording.stop` changes `recordingState` to idle
(`active-recording.ts:174-193`). Apply the same ordering to the refusal path
before its state change (`active-recording.ts:355-369`). Thus a queued callback
cannot call the facade after idle and mistake its no-op for a successful send.
The conditional terminal transition also ensures a send which resolves after
stop/cancel never overwrites the negative result.

## Exact file partition

### Extension source

1. **New** `apps/extension/src/background/connection/scripted-navigation-intent.ts`
   owns the state machine, safe-destination comparison, opaque ids, fixed
   lifetime, non-rejecting completion, commit claim, and late-settlement guard.
   It receives narrow ports for debounce, claim-recorded URL, and send-event;
   it does not know Chrome runtime messages or Core.
2. `apps/extension/src/background/connection/index.ts` exports that one focused
   collaborator, consistent with the existing barrel (`index.ts:1-85`).
3. `apps/extension/src/background/connection.ts` constructs it beside the
   existing `NavigationRecorder` (`connection.ts:67-81`), injects it into
   intake/recording, and exposes narrow arm/await/cancel methods. It cancels on
   disconnect, reset-through-disconnect, and tab removal before delegating the
   current handlers (`connection.ts:280-338`).
4. `apps/extension/src/background/connection/recorded-event-intake.ts` gives the
   intent first refusal of top-frame commits, constructs the one existing typed
   event through the public recording facade, and does not ordinary-schedule an
   owned commit.
5. `apps/extension/src/background/connection/active-recording.ts` adds only the
   synchronous stop/refusal cancellation port described above. Start clears
   stale intent state before seeding recording tabs.
6. **New** `apps/extension/src/background/scripted-navigation-control.ts` owns
   sender/message validation and fixed response translation. Keeping this out
   of the side-effectful background entrypoint makes the security boundary
   directly unit-testable.
7. `apps/extension/src/background/index.ts` routes the three test messages to
   that handler and nothing else. `apps/extension/src/shared/constants.ts`
   names the three strings beside the existing runtime names
   (`constants.ts:16-30`); these remain internal protocol names, not Core API.

No domain or Core file changes. Do not modify the existing event/input schema,
gateway payload, mapper, extension manifest, storage, or CDP adapter for this
extension half.

### Closest tests

1. **New** `apps/extension/src/background/connection/tests/scripted-navigation-intent.test.ts`:
   injectable deterministic coverage of arm/busy, exact tab ownership, all
   browser transition labels including reload, redirect replacement, safe
   destination match/mismatch, exactly-one send, post-send acknowledgement,
   send rejection, expiry, cancel, late-send precedence, terminal retention,
   and timer cleanup.
2. `apps/extension/src/background/connection/tests/recorded-event-intake.test.ts`:
   extend the current transition/debounce cases (`:205-245`) to prove an owned
   natural-typed commit produces one event, an owned link/other/reload commit
   produces the same one typed event, redirect bursts produce only the settled
   event, and an unowned commit retains every current rule. Assert executable
   count one and gateway send completion before acknowledgement, building on
   the existing typed re-entry assertion (`:225-244`).
3. `apps/extension/src/background/connection/tests/navigation-recorder.test.ts`:
   pin claiming the scripted safe URL against a later duplicate while leaving
   click-explanation and ordinary redirect behavior unchanged. If no new
   recorder API beyond existing `noteRecordedTab` is needed, this file needs no
   source-driven addition.
4. `apps/extension/src/background/connection/tests/active-recording.test.ts`:
   stop/refusal synchronously cancel an armed and a sending intent before idle;
   a late send cannot change the result.
5. **New** `apps/extension/src/background/tests/scripted-navigation-control.test.ts`:
   own-extension sidepanel/popup sender accepted; tab/content sender, wrong id,
   malformed id/URL, non-loopback URL, credentials, query, fragment, excessive
   length, missing recording, missing tab, and duplicate arm rejected with only
   fixed fields. Cancel is idempotent and no rejected browser/gateway text is
   reflected.

## Security and compatibility constraints

- Accept these messages only when `sender.id === chrome.runtime.id`,
  `sender.tab === undefined`, and `sender.url` is exactly this extension's
  `sidepanel/index.html` or `popup/index.html`. A content script, ordinary web
  page, externally connected extension, or server command cannot arm an
  intent. The current Lab opens the sidepanel extension page
  (`apps/extension/e2e/fixtures/extension-context.ts:81`).
- Never persist intent state, put it in extension status/activity logs, queue
  it to Core, broadcast it to content scripts, or include it in screenshots or
  evidence. MV3 restart intentionally loses it and causes a closed failure.
- Never include a query, fragment, credentials, raw commit URL, tab URL,
  recording id, or caught exception in the control responses. The ordinary
  recording event contains only the already-validated armed URL.
- The seam is inert unless explicitly armed and recording. Ordinary user
  recording therefore retains the present 250 ms redirect debounce, 5-second
  explanatory window, click-landing linkage, initial-page grace, and browser
  transition classification (`navigation-recorder.ts:7-12,57-115`).
- Chrome/Edge and Firefox share the runtime-message and background
  webNavigation design; there is no CDP dependency and no fallback to an
  unlabelled `page.goto` result. Browser-specific popup/sidepanel sender paths
  are allowlisted explicitly.

## Required acceptance proof

Before live W10, run the two new focused suites plus the modified intake,
recorder, and active-recording suites, package check, and a mutation that
removes the owned-commit early return: the mutation must produce two events for
a naturally typed commit or otherwise fail the exactly-once row. A second
mutation resolving before the deferred gateway send must fail the post-send
ack row. Restore both exactly.

Live proof remains W10 primary and `broken-link` at least 3/3: every finalized
recording has two extension/Core actions and two proposal candidates; primary
executes click then navigate and passes both verdicts; `broken-link` begins at
candidate zero and reports the expected first-click
`navigation_unexpected`. Since this changes the downstream extension pin and
all prior final benches contain a known W10 race, both complete final benches
must restart from repeat zero after targeted acceptance.

## Verification limits

This report specifies, but does not implement or execute, the seam. I did not
inspect raw bundles, page data, screenshots, logs, or secrets in this pass.
