# `v-stop-state-machine-review` — independent lifecycle model

## Decision after stable-source comparison

**Accepted.** The final source closes every timeline in the independent model.
The prior high-severity `Start A → Stop → Start B` finding is fixed at Stop's
synchronous boundary: Stop cancels and identity-detaches A from the public
single-flight slot while retaining A's promise locally for its drain. B therefore
owns a distinct UI request, captures the installed Stop, waits one-way for it,
and only then enters preflight. A's identity-checked completion cannot clear B.
The exact held-preflight regression proves distinct promises, no early B
preflight or wire Start, one later B Start, and one accepted initial marker.

The detached retry-send timeline is also closed. `cancelAndDrain()` captures the
current send promise before synchronously dropping handshake ownership and both
timers. Stop retains the pending recording identity, waits for that send while
absorbing only its start-path rejection, and places the matching Stop afterward.
The send's late timeout/finally path cannot activate because `startLocally`
requires the cancelled pending object still to be current. Focused facade and
handshake tests cover both the drain ordering and synchronous ownership closure.

The final implementation and tests agree with the model on synchronous Stop
linearization, shared crossing-Stop identity, cancellation of preflight and
handshake fallback, accepted-start/initial-marker completion before teardown,
post-Stop start ordering, mixed-source arbitration, and late acknowledgement
rejection. I found no remaining concrete lifecycle counterexample.

I first completed the model below without reading the implementation report.
After the supervisor declared the tree stable, I read the final source/tests and
`v-recorder-stop-during-start.md` and compared them to every invariant.

## Lifecycle model

The observable phases are:

1. **idle** — no UI preparation, handshake, server/local start, active recording,
   or stop owns the lifecycle;
2. **UI preparation** — page/evidence preflight is running but no client start
   has been sent;
3. **client handshake** — one `client.start_recording` identity owns timers,
   retries, and possible local fallback;
4. **starting** — a server acceptance or local fallback owns one identity while
   persistence/tab initialization awaits;
5. **recording** — one identity/generation admits external events;
6. **stopping** — one synchronous boundary owns every earlier phase/identity,
   refuses new admission, drains already-admitted navigation, performs local
   teardown, and settles the required Core closure.

UI preparation, client handshake, and `starting` are not idle for Stop semantics,
even if the public UI state still says `idle`.

## Minimal invariants

- **One lifecycle owner:** exactly one start identity or stop boundary may own a
  lifecycle epoch. UI and server starts arbitrate immediately before ownership,
  with no await between the final check and claim.
- **Stop linearizes synchronously:** Stop installs one shared token before its
  first await in every non-idle lifecycle phase, not only active recording.
  Crossing stop callers share its result and the first caller's notification
  policy.
- **Pre-Stop work cannot activate afterward:** every UI-preflight, handshake
  fallback, and server/local `starting` continuation is bound to the epoch it
  entered and checks that ownership after each await and immediately before
  changing active identity/state or creating a navigation generation.
- **A sent start is closed:** once `client.start_recording` has been sent or a
  server start accepted, Stop must close that exact identity in Core (or report
  closure as unknown and fail closed). Merely cancelling local timers is not
  enough; it can strand a Core recording.
- **Stop settlement is final:** the stop promise cannot resolve until all
  pre-boundary continuations are either prevented from activation or, if they
  activated before the boundary, fully torn down. Its token clears before the
  public promise settles. A rejected stop may expose failure only after local
  teardown; if Core closure is uncertain, a later start must not silently treat
  the old recording as closed without reconciliation or an idempotent close.
- **Generation ownership:** only an accepted start identity may increment/create
  its navigation generation. Already-admitted callbacks retain the old identity,
  drain once before teardown, and cannot re-enter a later generation. Fresh
  external events after Stop cannot claim internal admission.
- **Handshake cancellation is terminal for that epoch:** cancelling pending
  timers makes any in-flight send's `finally`, acceptance, retry, refusal, or
  local fallback unable to start the cancelled identity.
- **No duplicate protocol operations:** simultaneous UI presses share UI
  preparation; same-ID server acceptances converge; different-ID starts have one
  deterministic winner; crossing Stops yield at most one required Stop send.
- **Failure cannot deadlock ownership:** UI preflight, start initialization,
  navigation drain, Start send, and Stop send rejection each release their
  corresponding single-flight token in `finally`-equivalent ordering while
  preserving the correct final/latching state.

## Ordering checklist for final comparison

- Stop before/during UI page refresh or initial-state capture: UI continuation
  never sends Start after Stop.
- Stop after client Start send but before acceptance/timeout: timers/fallback are
  cancelled and the sent identity cannot remain open in Core unnoticed.
- Stop during server/local `starting` awaits: the start cannot flip to recording
  after Stop; Core closure follows the owned identity.
- Stop during recording: new admission closes synchronously; old navigation
  drains under the old identity; teardown and one Stop send follow.
- Stop rejection: local state is terminal, token clears before rejection, and
  uncertain Core closure is not silently treated as safe for a new start.
- Start during Stop, fulfilled or rejected: it waits for the captured Stop and
  then arbitrates against current owners; it cannot reuse the old generation.
- UI/server start released together: whichever claims pending/starting ownership
  first wins; the loser sends/starts nothing.
- Repeated UI starts in preparation share one promise; later presses during a
  pending handshake do not restart timers or replace identity.
- Same- and different-ID server acknowledgements, late refusal, and local
  fallback cannot revive an identity cancelled by Stop.

No build or test command was run. No implementation, test, shared document,
generated artifact, Core file, commit, or remote was changed; this report is the
only file written.
