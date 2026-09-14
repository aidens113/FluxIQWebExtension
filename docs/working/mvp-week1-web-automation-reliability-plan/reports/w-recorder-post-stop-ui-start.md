# `w-recorder-post-stop-ui-start` — completion report

## Result

Implemented the precise cancelled-UI-owner detachment. At Stop's synchronous
boundary, the captured UI request A is marked cancelled and removed from the
public `uiStart` single-flight slot, while Stop retains A's promise locally and
awaits it. A later UI request B therefore receives a distinct promise, captures
the Stop owner, and proceeds only after teardown.

The pre-existing identity checks on both UI settlement callbacks remain in
place. When A later settles, `this.uiStart === A` is false, so it cannot clear
B's slot.

## Test added

The exact held-preflight `Start A → Stop → Start B` ordering now proves:

- A and B return distinct promises;
- B does not enter preflight and neither request sends a client start before
  Stop completes;
- releasing A lets Stop settle without A sending;
- B then sends exactly one `client.start_recording`;
- accepting B publishes exactly one initial `browser.tab` marker and closes its
  handshake timer.

## Mutation evidence

Replaced only the identity-checked detachment assignment with a no-op. The full
extension suite failed 1 test (the new A/Stop/B regression). Restored the
assignment and reran all final checks successfully.

## Files changed

- `apps/extension/src/background/connection/active-recording.ts`
- `apps/extension/src/background/connection/tests/active-recording.test.ts`
- generated `apps/extension/build/background/index.js` and source map (via the
  owning build)

## Validation

- Focused A/Stop/B bundled test — passed: 1/1.
- `pnpm --dir apps/extension check` — passed.
- `EXTENSION_TEST_BUILD_LABEL=w-recorder-final pnpm --dir apps/extension test`
  — passed: extension smoke test and 513/513 unit tests.
- `pnpm --dir apps/extension build` — passed; tracked build regenerated.

No browser/Lab run was requested. I did not edit Core or shared working
documents, and did not commit or push.
