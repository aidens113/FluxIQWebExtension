# `t-recorder-mixed-start` — unified final start gate

## Design and progress

In progress. After UI preflight completes, the UI path will wait for any
server-owned start already under way and then, in the same synchronous turn as
`handshake.begin`, recheck the active recording and pending handshake. This
gives the first source reaching the final gate one identity and prevents the
other source from issuing a competing client start.

## Outcome

Complete. Immediately after UI evidence preflight, the UI path waits for a
server-owned `starting` operation already in progress. It then rechecks both
the active recording state and handshake ownership and calls `handshake.begin`
without an intervening await. The first source to own either `starting` or the
pending handshake therefore wins one recording identity; the other source does
not issue a competing client start.

Normal repeated UI presses still share the existing `uiStart` operation and
later presses still use the handshake pending message. A server acceptance for
the running recording still follows `beginOnce`'s existing project-relink path.

## Files changed

- `apps/extension/src/background/connection/active-recording.ts`
- `apps/extension/src/background/connection/tests/active-recording.test.ts`
- regenerated `apps/extension/build/background/index.js` and source map
- this report

## Winner-order proof

- **Server wins:** an old stop is held, UI preflight is held after release, and
  the server start is itself held inside `starting`. Releasing UI preflight
  sends no client start while the server owns that gate. Once released, the
  server identity is the sole new recording and owns the sole new initial tab
  event; client-start count is zero.
- **UI wins:** an old stop and UI preflight are held, then UI reaches the pending
  handshake first. A distinct server identity is ignored, the matching server
  acceptance begins the UI identity, exactly one client start was sent, and
  exactly one new initial tab event carries that identity.

Together the rows prove both source orderings produce one new identity, one new
initial `browser.tab`, and at most one client start.

## Mutation proof

- Replacing the final wait for `starting` allowed UI to race a held server
  start; the suite exited 1 with 502/503 passing.
- Disabling the immediate active-recording/pending-handshake recheck allowed the
  losing UI path to send a competing start; the suite exited 1 with 502/503
  passing.

Both mutations were restored. `active-recording.ts` had the same SHA-256 before
mutation and after restoration:
`CC297C2F604C648DF3308A56D3D2BDC153FEEB29845A8F1E77227E8AF0FC9553`.

## Validation

- Extension check under `t-recorder-mixed-start`: passed.
- Extension smoke/unit suite: 503/503 passed.
- Strengthened final-tree check under `t-recorder-mixed-start-strong`: passed.
- Strengthened full suite: 503/503 passed.
- Final restored-source check: passed.
- Final restored-source full suite: 503/503 passed.
- Final focused active-recording rerun: 24/24 passed.
- Tracked extension build regenerated successfully.
- Scoped `git diff --check`: exited zero with only existing line-ending warnings.

No Lab command was run, no Core or shared document was edited, and I did not
commit or push.
