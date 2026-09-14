# `ai-scroll-step-settlement` — separate scripted scroll recordings

**Status:** complete; implementation and package validation passed. No Lab run.

## Outcome

`ScenarioStepRunner` now waits 500 ms after each successful trusted
`page.mouse.wheel` call. The interval is named and documented beside the
runner: the content recorder waits for 400 ms without another scroll event,
so an exact 400 ms runner delay can still race the recorder timer; the extra
100 ms is a scheduling margin before the next scenario step may start.

The wait is confined to the `scroll` switch branch. A narrow injected
`settleScroll` seam keeps the production default as a real timer while letting
the owning test prove the exact bound and event order without sleeping.

## Files changed

- `packages/test-runner/src/scenario-steps/step-runner.ts`
- `packages/test-runner/src/scenario-steps/tests/step-runner.test.ts`

## Verification

- `pnpm --filter @fluxiq-web-extension/test-runner check` — passed.
- `pnpm --filter @fluxiq-web-extension/test-runner test` — passed: 706 tests,
  zero failures.
- Focused final source build and
  `node --test packages/test-runner/dist/scenario-steps/tests/step-runner.test.js`
  — passed: 4/4.
- `git diff --check` on both owned source files — passed.

Mutation checks were performed and then reverted:

- Reducing the settlement from 500 ms to the recorder's exact 400 ms failed
  both the all-operations ordering assertion and the focused bound test.
- Removing the settlement call failed the same two tests because the expected
  post-wheel settlement was absent.

## Not verified

Per the brief, no Lab command or live browser run was performed. The supervisor
must integrate this with the separate W11 exact-event-count guard and obtain
the requested live W11 proof. I did not commit or push.
