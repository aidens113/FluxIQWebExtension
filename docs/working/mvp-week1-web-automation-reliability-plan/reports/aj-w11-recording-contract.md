# `aj-w11-recording-contract` — W11 short-recording guard

**Status:** complete; code and package gates passed.

## Outcome

W11 now requires exactly three `web.scroll.changed` events. A recording that
loses or combines one of the three scripted scrolls therefore fails the existing
recording-contract check before proposal approval instead of producing a short
two-action Flow that can report runtime success and later fail the fixture oracle.

## Files changed

- `apps/scenario-lab/src/scenarios/infinite-feed/scenario.ts` — changed W11's
  scroll expectation from presence-only to exact `count: 3`.
- `apps/scenario-lab/src/scenarios/infinite-feed/tests/scenario.test.ts` — added
  a focused assertion for the exact event type and count.

No FluxIQ Core file, shared working document, generated artifact, or other
scenario was edited by this worker.

## Validation

- `pnpm --filter @fluxiq-web-extension/scenario-lab check` — passed.
- `pnpm --filter @fluxiq-web-extension/scenario-lab test` — passed, 205/205.
- `git diff --check -- <the two owned source/test files>` — passed.

Mutation proof exercised both ways the guard could regress:

1. Changing `count: 3` to `count: 2` made the focused test fail with actual
   `count: 2` versus expected `count: 3`; the full suite was 204/205.
2. Removing `count` made the same test fail with an actual presence-only event
   versus expected `count: 3`; the full suite was 204/205.

After restoring each mutation, the owned files' SHA-256 values matched their
pre-mutation values exactly, and the final check and 205-test suite passed.

## Not verified

No Lab command was allowed or run. Live proof must run W11's primary Flow lane
six times sequentially and under a concurrent A/B repeat condition, requiring
each recording to contain three scroll events, each proposal/runtime to contain
three successful scroll actions, and every final-state oracle to pass. This
guard deliberately fails closed if the separate scroll-settlement timing repair
does not prevent an event loss.
