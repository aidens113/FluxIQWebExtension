# `n-recorder-flush` — close the click-landing stop race

## Outcome

Complete. A recording stop now drains every pending navigation debounce and
awaits navigation callbacks already sending while the recording remains active.
Only after that work settles does the recorder become idle and send
`client.stop_recording`. Redirect replacement remains per-tab and last-commit
wins.

Navigation callback rejection is captured rather than becoming an unhandled
promise. Stop still tears down local state and notifies FluxIQ, then rejects with
the navigation failure. Starting a new recording cancels pending callbacks and
isolates already-running work and late rejection from the new generation.

## Files changed

- `apps/extension/src/background/connection/navigation-recorder.ts`
- `apps/extension/src/background/connection/recorded-event-intake.ts`
- `apps/extension/src/background/connection/active-recording.ts`
- `apps/extension/src/background/connection/tests/navigation-recorder.test.ts`
- `apps/extension/src/background/connection/tests/active-recording.test.ts`
- This report.

No barrel change was required.

## Focused proof

- `navigation-recorder.test.mjs`: 14/14 passed. The added rows cover immediate
  pending flush, redirect replacement, an already-running callback, deterministic
  rejection, pending cancellation, and generation isolation for running work.
- `recorded-event-intake.test.mjs`: 15/15 passed. Its callback now returns the
  `recordNavigation` promise to the recorder instead of discarding it.
- `active-recording.test.mjs`: 16/16 passed. The added stop-before-debounce row
  holds the landing send open and proves state remains `recording` and Stop is
  not sent until it settles. A rejection row proves teardown and server Stop
  still occur before the landing failure is returned.

## Mutation proof

I replaced the awaited flush in `ActiveRecording.stop` with an unreachable
branch. The extension suite exited 1 and the two new lifecycle guards failed:

- `stop flushes a pending navigation while the recording is active before notifying FluxIQ`
  failed with expected `recording`, actual `idle`.
- `a rejected landing still closes and notifies the recording, then reports the landing failure`
  failed with `Missing expected rejection.`

The mutation was restored. The source file's SHA-256 before and after the
mutation was identical:
`E8FB628DD412EABEA8C89DD1714BC45ECACD45C5A5929D4B29EDC8F712F56279`.

## Package validation

With `EXTENSION_TEST_BUILD_LABEL=n-recorder-flush`:

- `pnpm --filter @fluxiq-web-extension/extension check`: passed.
- `pnpm --filter @fluxiq-web-extension/extension test`: 491/491 passed.

The final focused reruns also passed 14/14, 15/15, and 16/16 respectively.

## Not verified

No Lab run was permitted by the brief. The live W19 proof must show the unarmed
recording retains its landing-bearing shape and every `expired` Flow replay
reports structured `auth_required`; because the original drift appeared only
under concurrent A/B load, the final concurrent benches must also retain the
landing and classification on every repetition.

I did not edit Core or shared documentation and did not commit or push.
