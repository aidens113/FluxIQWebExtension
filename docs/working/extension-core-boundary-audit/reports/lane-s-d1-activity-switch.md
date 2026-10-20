# Lane S-D1 (t728): the extension takes the activity status from Core's `fluxiq/ui`

## Outcome

Done. The extension's copies of the activity headline, pacer, clock, fan-out
gate, unit readers and wording are deleted, along with the tests the S-B worker
ported to Core. The two activity barrels now re-export those names from
`fluxiq/ui`, next to the modules that stay in the extension. No importer
outside the two directories had to change. Nothing was committed.

## What changed and why

Deleted from `apps/extension/src/`:

- `background/activity/`: `headline`, `pacer`, `unit-situation`, `unit-history`, `run-retry`,
  `candidate-trial`, `supervisor-ending`, `ending-kind`, `fan-out-gate` and `clock` (`.ts`).
- `background/activity/tests/`: the `candidate-trial-live`, `candidate-trial`, `fan-out-gate`,
  `headline`, `pacer`, `supervisor-ending` and `unit-history` tests (`.test.ts`). All were
  ported to Core's `activity-status/tests/`.
- `shared/activity/`: `wording`, `not-tried`, `declined-submission`, `cut-at-word`, `word-cut`,
  `headline-echo`, `model-thought`, `internal-step`, `history-limits`, `step-recovery`,
  `step-skip` and `activity-display` (`.ts`).
- `shared/activity/tests/`: the whole folder. Its six tests (`cut-at-word`,
  `declined-submission`, `model-thought`, `step-recovery`, `step-skip` and `wording`) were all ported.
- `shared/activity/project/`: the whole folder (`agent.ts`, `project-card.ts`, `index.ts`
  and `tests/{agent,project-card}.test.ts`). Its tests were ported to `activity-status/project/tests/`.

Changed:

- `background/activity/index.ts` re-exports these names from `fluxiq/ui`, the same set it exported before:
  - `ACTIVITY_DETAIL_INTERVAL_MS`, `ACTIVITY_FAN_OUT_INTERVAL_MS`
  - `ActivityPacer`, `activityHeadline`, `activityWording`, `FanOutGate`
  - `systemActivityClock`, `UnitHistory`, `UnitSituation`
  - types: `ActivityClock`, `ActivityHeadlineSituation`, `ActivityPacerOptions`,
    `ActivityTimer`, `ActivityWaitReason`, `ActivityWording`, `UnitState`

  The relay, send-start, send-answer, overlay-target and overlay-preference exports
  are unchanged. `RunRetry`, `CandidateTrial`, `SupervisorEnding` and `endingKindOf`
  were not in this barrel before and are not added.
- `shared/activity/index.ts` re-exports these names from `fluxiq/ui`:
  - `ACTIVITY_HISTORY_LIMITS`, `activityAgent`, `activityWording`, `cutAtWord`, `declinedSubmission`
  - `isHeadlineEcho`, `isInternalStep`, `isModelThought`, `longestWordCut`, `notTriedOutcome`
  - `projectCard`, `stepRecovery`, `stepSkip`
  - types: `ActivityAgent`, `ActivityDisplay`, `ActivityProjectCard`, `ActivityStepRecovery`,
    `ActivityStepSkip`, `ActivityWording`, `ClientGatewayActivity`, `ClientGatewayActivityPhase`

  The last two types were re-exported from `@fluxiq/client-gateway-websocket` before.
  `ACTIVITY_MESSAGES`, `ACTIVITY_DONE_VISIBLE_MS`, `ACTIVITY_RECENT_LIMIT` and the extension-state types stay local.
- Kept files whose imports moved to `fluxiq/ui`:
  - `background/activity/activity-relay.ts`: clock, pacer, fan-out gate and unit history.
  - `background/activity/send-start.ts`: the clock types.
  - `shared/activity/extension-activity-state.ts`: `ActivityDisplay` and `ClientGatewayActivity`. One doc comment was also updated.
  - `background/activity/tests/fake-clock.ts`, `activity-relay.test.ts` and `activity-replay.test.ts`.
- Kept as they were: `build-trace-events.ts`, `fixtures/t174-build-trace.ts`, `fake-clock.ts`,
  and the `activity-relay`, `activity-replay`, `send-start`, `send-answer` and
  `overlay-target` tests. Their subjects stay in the extension.

## Commands run and observed results

- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=lane-s-d1 node scripts/test-extension.mjs background/activity shared/activity`
  printed `# tests 45`, `# pass 45` and `# fail 0`.
- `pnpm --filter @fluxiq-web-extension/extension check` exited 0 with no type errors.
  - `core-build` reported Core's build "is current with its source".
  - The build cache did not stamp the result ("inputs changed while it ran (apps/extension, domain)"),
    because other workers were editing at the same time.
- `pnpm --filter @fluxiq-web-extension/extension build` exited 0. All five entries bundled.
  - chrome, firefox and e2e-chromium each "verified 22 files".
  - The node-only import guard raised nothing.
  - `fluxiq/ui` has no alias in `scripts/build-extension.mjs`, so it resolves through
    the package's `exports` to `dist/ui/index.js`.
  - The background sourcemap lists `!FluxIQ/packages/fluxiq/src/ui/activity-status/*.ts`
    through the chained dist maps. `build/background/index.js` contains Core's
    headline text "Waiting for you: answer in the FluxIQ panel".
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (209 warning(s), 638 baselined)`.
  - No baseline entry names `background/activity` or `shared/activity`, so `pnpm structure:baseline` was not run.
  - The only warnings in my paths are advisories that were already there: `activity-relay.ts`
    is 422 lines and `activity-relay.test.ts` is 479 lines.

## Not verified

- Live browser behaviour of the overlay or the panel status. Bundled code
  changes only where it imports from; Core's behaviour is the same as the
  deleted copies (S-B copied them verbatim).
- Test folders of other importers: none changed, so none were run separately.
  `check` typechecked all of them.

## Open questions or contradictions found

- Doc comments outside my paths still point to deleted files:
  - `content/activity-overlay/model-prose.ts:8` and `content/activity-overlay/overlay-view.ts:5` (`pacer.ts`).
  - `content/activity-overlay/tests/overlay-view.test.ts:5` (`wording.ts`).
  - `docs/architecture/extension-client.md` around lines 551-603 names `headline.ts`, `ending-kind.ts`,
    `supervisor-ending.ts`, `run-retry.ts` and `wording.ts`.

  These are comments and documentation only and break nothing. The supervisor
  or the documentation owner should point them at `fluxiq/ui` (Core
  `packages/fluxiq/src/ui/activity-status/`).
