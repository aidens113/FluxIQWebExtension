# `p-recorder-stop-fence` — recorder stop single-flight and admission fence

## Scope and design

In progress. The stop boundary will be established synchronously, before the
navigation drain begins. Concurrent callers will receive the same in-flight
operation; the first caller determines whether the server is notified. Ordinary
content and fresh navigation admission closes at that boundary, while navigation
callbacks already held by the current recorder generation retain a narrow path
to finish before teardown.

Owned changes are limited to extension recorder/intake source, their colocated
tests, the regenerated tracked extension build, and this report.

## Outcome

Complete. `ActiveRecording.stop` is now non-`async` at its public boundary and
installs a shared `StopUnderWay` promise synchronously before starting the drain.
Every crossing caller receives that same promise, teardown runs once, and the
first caller's notification decision is authoritative: a server-originated stop
is not echoed if it wins the race, while a UI-originated stop sends exactly one
`client.stop_recording` if it wins.

`endedAt` is captured in the same synchronous turn as the fence. The public
recording state remains `recording` only so previously admitted navigation work
can finish; `acceptsEvents()` closes ordinary admission for content-ready,
content events, and new navigation commits. A navigation callback scheduled
before the fence re-enters the normal facade with a narrow internal admission
flag, then follows the existing event/evidence path. Fresh and scripted
navigations do not receive that flag.

## Files changed

- `apps/extension/src/background/connection.ts`
- `apps/extension/src/background/connection/active-recording.ts`
- `apps/extension/src/background/connection/recorded-event-intake.ts`
- `apps/extension/src/background/connection/tests/active-recording.test.ts`
- `apps/extension/src/background/connection/tests/navigation-recorder.test.ts`
- `apps/extension/src/background/connection/tests/recorded-event-intake.test.ts`
- regenerated `apps/extension/build/background/index.js` and source map
- this report

The earlier navigation-drain implementation in `navigation-recorder.ts` was not
changed by this follow-up. Its missing adversarial cases are now pinned by tests.

## Focused proof

- Two concurrent notifying stops return the same promise and produce one gateway
  Stop, one teardown activity, and one recording-state broadcast.
- Server/UI crossings in both arrival orders share one operation and follow the
  first caller's notification decision.
- The fence is observable before the navigation drain's first await. A focused
  intake row refuses late content, content-ready attachment work, and fresh
  navigation while still draining the already-scheduled typed navigation.
- A timer-fired rejected navigation is captured without becoming unhandled,
  reported once by `flush`, and removed before the next flush.
- A callback that schedules another navigation while settling is re-drained in
  the same generation.
- A cleared stale timer cannot run or delete its replacement callback.
- Final focused run: 51/51 passed across active recording, navigation recorder,
  and recorded-event intake.

## Mutation proof

Two independent mutations were compiled and exercised:

1. Removing `stopping === undefined` from `acceptsEvents()` made the extension
   suite exit 1 with 495/497 passing. The two synchronous-boundary assertions in
   the pending-drain and concurrent-stop rows failed.
2. Disabling the `if (this.stopping)` single-flight return also made the suite
   exit 1 with 495/497 passing. The concurrent notifying-stop and server/UI
   crossing rows failed on distinct promises before duplicate teardown could be
   accepted.

Both mutations were restored. The SHA-256 of `active-recording.ts` before the
first mutation and after both restorations was identical:
`07F8CA834054582C66052E38F64B09B286EF3F27D9FB3358B8800727E00442CB`.

## Validation

- Extension `check` under `p-recorder-stop-fence`: passed.
- Extension smoke/unit suite under `p-recorder-stop-fence`: 497/497 passed.
- Restored-source extension `check` under `p-recorder-stop-fence-final`: passed.
- Restored-source extension smoke/unit suite: 497/497 passed.
- Final three-file focused rerun: 51/51 passed.
- Tracked extension build regenerated successfully.
- Scoped `git diff --check`: exited zero; only existing line-ending warnings
  were emitted.

No Lab command was run for this follow-up, because the live W19 lane had already
finished and the lifecycle lane was deliberately held until this rebuilt source
was stable. I did not edit Core or shared working documents and did not commit or
push.
