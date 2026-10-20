# lane-t-p3-repin-claim

## Outcome
Partial. 5 of the 6 tests pass after the pin changes. "matches the recording at every delivery point" still fails, and not because of a count or sequence. The replay marks the recorded `session.claimed` entry `outside` where the test expects `matched`. I did not touch that assertion.

## What changed and why
Core worktree `packages/fluxiq/src/client-gateway/`:
- tests/trace-tap.test.ts: `expect(afterRefusal).toBe(2)` changed to `3`. Lifecycle list `["session.disconnected"]` changed to `["session.claimed", "session.disconnected"]`.
- trace-replay/tests/replay-parity.test.ts:
  - Kind list: `"lifecycle:session.claimed"` added as the first entry.
  - Mutated divergence: sequence 6 changed to 7.
  - Wait divergence: sequence 10 changed to 11.
  - Removed-event test: removed `event.sequence === 2` changed to `3`, so it removes the same inbound state_update as before. Capture-gap entries changed from 2/3 to 3/4, with the detail text "sequence 2 is missing" changed to "sequence 3 is missing".
  - Matched count left at 12, which is what I observed, because the claim entry is not counted as matched. I briefly set it to 13; the run showed 12, and I put it back.

## Commands run and observed results
- `pnpm exec vitest run src/client-gateway src/programs/automation-studio/runtime/gateway-trace src/programs/automation-studio/client-gateway src/programs/automation-studio/runtime/environment` (run while the count was set to 13): Test Files 1 failed | 57 passed (58); Tests 2 failed | 378 passed (380).
- After putting the count back to 12, re-ran only the two files: Tests 1 failed | 17 passed (18). The one failure: `expected [ 'outside', 'matched', …(13) ] to deeply equal [ 'matched', 'matched', …(13) ]`.
- `pnpm exec tsc --noEmit`: exit 0.

## Not verified
I did not re-run the full four-directory command after putting the count back to 12. The only difference from the previous run is the one test that now passes.

## Open questions or contradictions found
The replay puts the `lifecycle:session.claimed` entry (sequence 1) in status `outside`, not `matched`. Replay either needs to regenerate and compare the claim event, or the test needs to accept `outside` for that entry. That is a decision about how replay should behave, not a pin, so it is left for the owner of trace-replay.
