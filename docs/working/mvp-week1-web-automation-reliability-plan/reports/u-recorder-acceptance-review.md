# `u-recorder-acceptance-review` — final lifecycle decision

## Decision

**Not accepted.** The revised final gate correctly closes the reported mixed
UI/server duplicate-start race in both winner orders, including the no-await
claim boundary and a rejected prior stop. However, the reciprocal start/stop
crossing remains material: a stop arriving while a start is under way but before
`recordingState` becomes `recording` is silently lost.

## Finding — stop is a no-op during pre-recording start work

**Severity:** high

**File/lines:** `apps/extension/src/background/connection/active-recording.ts:218-220`
returns a resolved promise whenever state is not yet `recording`. A server start
sets `starting` at lines 335-345, but `startRecording` does not set
`recordingState = "recording"` until line 374, after awaiting project persistence
and `allTabs()` at lines 360-372. A UI start likewise remains idle throughout
its preflight and pending-handshake period.

**Concrete trace:** `beginAccepted("recording-new")` installs `starting`, then
blocks in `persistSession` or `allTabs()`. A crossing server/UI stop calls
`stop(false/true)`, observes state `idle`, and returns successfully without
installing a stop token or cancelling/waiting for the start. The held start then
continues, sets state to `recording`, and publishes its initial `browser.tab`.
The stop has already completed, so the recording remains active contrary to the
stop order. The same outcome occurs when Stop crosses a UI handshake that has
been sent but not yet accepted: Stop does not cancel the pending handshake, and
the later acceptance starts recording.

**Correction:** make Stop own pending/preparing starts as well as an active
recording. It should synchronously establish the single-flight stop boundary,
cancel a pending handshake, and either cancel an in-progress local start through
an epoch/token check or await it and immediately tear down the recording it
created. Add held `persistSession`/`allTabs` and pending-handshake tests proving a
crossing stop settles only with the recorder idle and no later acceptance can
revive that start.

## Rechecked final-gate behavior

- Server wins: UI waits for `starting`, then sees the active recording and sends
  no competing client start.
- UI wins: `handshake.begin` claims pending ownership synchronously after the
  final checks; a distinct server identity is then ignored.
- Stop tokens clear before public fulfillment or rejection, and captured stop
  rejection does not prevent the next start after teardown.
- Simultaneous UI starts share `uiStart`; later ordinary presses observe the
  pending handshake and do not duplicate it.
- Old navigation is drained before either tested post-stop start source creates
  a new generation.
- No deadlock or duplicate start remains in those intended post-stop timelines.

I read only the requested reports, final recorder source, and changed focused
tests. I ran no build and changed no product, test, shared document, generated
artifact, Core, commit, or remote state. This report is the only file written.
