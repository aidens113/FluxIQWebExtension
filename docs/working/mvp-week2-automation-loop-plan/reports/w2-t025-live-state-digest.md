# Report: t025 live exploration state digest

Date: 2026-09-20  
Owner: senior supervisor agent

## Outcome

The web state-digest port is reconciled with current `dev` and proven through
the real Chromium content-script path. Core can now recognize a page-state
reversal and publish the remaining successful action as replayable.

## Changes

- Ported the state projection and `captureStateDigest` binding from the old
  t005 commit.
- Added the current evidence contract's `repeats` field to the exhaustive
  projection.
- Supplied the current tool request's explicit optional permission slot.
- Added one focused live-browser spec. Provider choices are scripted for a
  deterministic path; captures, presses, sanitization, state hashing, Core's
  exploration recorder, and reduction all run as production code.

## Live proof

The Chromium page begins with two closed disclosures. Exploration performs its
automatic inspection, opens the wrong disclosure, closes it, opens the right
one, then completes. Observed assertions:

- four recorded steps and no state-digest failures;
- inspection leaves the digest unchanged;
- opening changes it;
- closing returns exactly to the pre-open digest;
- opening the right disclosure changes it again;
- `stateChainIntact: true`, `replayable: true`;
- inspection and the two reversed presses are dropped, leaving one press;
- the wrong panel is closed and the right panel visible in Chromium.

Command: `pnpm --filter @fluxiq-web-extension/extension test:content --
exploration-state/tests/live-state-digest.spec.ts --workers=1` -> 1 passed.

## Post-live checks

- Domain TypeScript check: passed.
- Extension check: passed.
- Only `state-digest.test.ts`, bundled to an ignored task-labelled scratch
  directory and run with `node --test`: 7 passed, 0 failed.
- No full unit suite was run during iteration.

## Remaining work

This proves the single-action recovery reducer, not optional multi-action model
output. The next dependency order remains: add a recovery field-entry option,
emit truthful `targetsUnchanged`, reconcile t021's stale batching work, then
measure the batched path live before broad regression testing.
