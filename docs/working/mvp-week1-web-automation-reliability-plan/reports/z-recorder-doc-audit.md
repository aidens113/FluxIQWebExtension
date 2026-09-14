# `z-recorder-doc-audit` — final lifecycle documentation delta

The current recording section accurately describes the handshake window,
retry schedule, identity arbitration, and the existence of a navigation flush.
It does not yet state the accepted Stop lifecycle invariants below.

## 1. Replace the Stop/navigation paragraph

**Insertion point:** under `## Recording Evidence`, replace the two paragraphs
beginning “Stopping a recording is a synchronization boundary” and “Starting a
new recording advances the navigation generation”.

**Why:** the current prose scopes Stop to an active recording and describes only
navigation flushing. It omits synchronous single-flight ownership, the first
caller's notification policy, the ordinary-event fence, same-generation
re-drain, and the accepted-start marker exception. Its “late callback” wording
also obscures that already-admitted callbacks drain before the generation can
advance.

**Replacement prose:**

> Stop is one synchronous, single-flight lifecycle boundary. The first Stop
> caller installs the shared operation and decides whether Core is notified;
> crossing callers receive that same promise and teardown runs once. From that
> boundary, ordinary content, tab, command-confirmation, and fresh-navigation
> events are no longer admitted.
>
> Before the recorder becomes idle or sends `client.stop_recording`, it drains
> the current navigation generation: pending 250 ms callbacks run immediately,
> callbacks already sending are awaited, and same-generation work exposed while
> they settle is drained too. Only callbacks admitted before Stop may use the
> internal navigation-admission path. A send failure remains the primary error,
> but does not prevent the matching Stop attempt. A later recording advances
> the generation only after this drain, so old callbacks cannot enter or fail
> the new recording.
>
> When Stop crosses a start Core has already accepted, ordinary events remain
> fenced, but that start's one initial `browser.tab` marker is admitted and
> awaited before teardown. Its Stop timestamp is then taken after the marker,
> so Core sees one ordered start marker followed by one close.

## 2. Add pending-start Stop ownership to the handshake section

**Insertion point:** immediately after the final handshake bullet ending
“Disconnecting cancels it.” and before “A recording starts once”.

**Why:** the document does not say that UI preflight, a client handshake, and
accepted `starting` work are non-idle for Stop, or that a detached retry send is
drained before wire closure.

**Insertion prose:**

> Stop owns starts which have not reached the public `recording` state too. A UI
> preflight that has not claimed the handshake is cancelled locally after each
> await and sends neither a false Start nor a false Stop. Once a handshake
> identity exists, Stop synchronously cancels its timers and fallback, drains
> the current send — including a detached retry — and then sends at most one
> matching `client.stop_recording` when notification was requested. A send
> rejection belongs to the cancelled start and does not strand or reject local
> teardown. A late acceptance of that stopped identity is ignored.
>
> If a server acceptance or local fallback already owns `starting`, Stop waits
> for that exact start to finish its sole initial marker and then tears it down
> once. Stop does not resolve while any pre-boundary continuation can later
> activate the recorder.

## 3. Add starts-queued-behind-Stop ordering

**Insertion point:** after the `beginAccepted` identity-case list, immediately
before “FluxIQ Core keeps the same order on its side”.

**Why:** no current prose defines Start-after-Stop ordering or the cancelled UI
owner detachment which prevents both coalescing and a wait cycle.

**Insertion prose:**

> A Start arriving after Stop's boundary captures that Stop and waits for its
> teardown, whether the Stop fulfills or rejects, before rechecking lifecycle
> owners. When Stop cancels an older UI preparation A, it detaches A from the
> public UI single-flight slot while retaining A's promise for its own drain.
> A later press B therefore owns a distinct request and waits one-way behind
> Stop; A's identity-checked settlement cannot clear B. After Stop settles, UI
> and server starts arbitrate at one final no-await gate: the first pending
> handshake or `starting` owner wins, and the loser sends no competing Start.

These three deltas cover stop single-flight, pending-start ownership, event
admission, generation drain, the initial marker, wire closure, and starts queued
behind Stop without repeating the already-correct refusal and identity lists.

This was a read-only audit. I did not build, run Lab, edit product/shared
documents, commit, or push. This report is the only file written.
