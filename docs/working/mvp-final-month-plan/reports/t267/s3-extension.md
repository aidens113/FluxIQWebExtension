# t267 S3 extension report

## Outcome

Done. Both tasks are implemented and their tests pass. The package `check` gate refused to run because Core's dist is stale. I ran the type check it wraps directly, and that passed (see below).

## What changed and why

- `apps/extension/src/background/automation-relay/automation-relay.ts`: `runAutomation` now sends `run-runtime-session` `{ projectId, flowId, runIntent: "explore_and_adapt" }`, so a saved automation can be repaired with the person's own key. `testGeneratedAutomation` is now its own case and still sends `{ projectId, flowId }`, because repairing a test would hide what the recording got wrong. Each case has a short comment.
- `apps/extension/src/shared/protocol.ts` (comments only): the header now says a run may carry only the `explore_and_adapt` intent (`runAutomation`). The `runAutomation` line names the new payload. The `testGeneratedAutomation` line used to say "as `runAutomation`", which is no longer true, so it now names its own payload with no intent.
- `docs/architecture/extension-client.md`: the shared table row is now two rows, `runAutomation` and `testGeneratedAutomation`, each with its payload and reason. The sentence "never carries ... an LLM run intent" now says the only intent a panel run carries is `explore_and_adapt` on `runAutomation`.
- `apps/extension/src/panel/automations/facts.ts`: `learned` now works as follows:
  - When `ids` (`createdAdaptationIds ?? adaptationIds`) and `adaptationStatuses` are both known, it is the number of those ids whose status is `applied`.
  - Otherwise, when `durableBehaviorChanged === false`, it is 0.
  - Otherwise it is undefined.
  - `run.adaptationCount` no longer feeds it, and `validated` and `futureRunsUpdated` are unchanged. The header comment is updated.
- `apps/extension/src/panel/automations/controller.ts`: one-line logic change in `needsDetail`, plus a two-line comment edit.
  - Old: `(facts.learned ?? 0) > 0 && ...`
  - New: `(details.get(run.runId)?.adaptationIds?.length ?? run.adaptationCount ?? 0) > 0 && ...`
  - Why: the re-read poll was gated on `learned > 0`. Under the new rule, a run whose adaptations are still proposed or testing has `learned` 0 or undefined, so the poll stopped. Once an adaptation became `applied`, the row would never show it. `mount-panel-navigation.test.ts` "passive name echo ... learned-run polling continues" failed on exactly this (expected 1 detail read, got 0). The poll is now gated on the run having adaptations at all, with the same stop conditions as before.
- Tests:
  - `automation-relay.test.ts`: the run-payload test now expects `runIntent: "explore_and_adapt"` on `runAutomation` and no intent on `testGeneratedAutomation`. The panel's own `runIntent: "build_and_adapt"` in that test is still dropped.
  - `facts.test.ts`: the old "learned prefers created ids" test is replaced by two tests:
    - applied is counted, while validated, proposed and testing are not;
    - another run's adaptation is not counted;
    - detail ids stand in for reply ids;
    - `durableBehaviorChanged:false` gives 0, even with `adaptationCount` 4;
    - created-only gives undefined, as does `adaptationCount` alone.

## Does a just-finished run's row show "Learned N" without being opened?

Yes, as long as the panel focus has not changed during the run.

1. After the run reply, `run()` clears `detailsAsked` for that run.
2. It then calls `refresh`, then `loadDetail(flowId, runId)`, with the guard `op.focus === focusRevision`.
3. The `runDetail` relay returns the Flow's `list-flow-adaptations`, which fills `adaptationStatuses`.
4. `factsOf` then joins the reply's `createdAdaptationIds` with those statuses.

The existing `controller.test.ts` row test passes and still shows "Learned 1 new page variation". If the adaptation is not yet `applied` at that read, the fixed `needsDetail` re-reads the detail on the next refresh or focus until it settles.

## Commands run and observed results

- Runner: my own copy at `scratchpad/t267-s3-ext/run-subset-ext.mjs`. It resolves esbuild from `apps/extension` and also marks `@fluxiq/client-gateway-websocket` external, matching `scripts/test-extension.mjs`.
- Fail-first:
  - The relay test against the changed relay: `not ok 4 - a run sends only the project and the Flow...`, `# pass 9 # fail 1`.
  - The new facts tests against `HEAD`'s facts.ts: `not ok 4`, `not ok 5`, `# pass 5 # fail 2`.
- After the facts change, before the controller fix: all of `src/panel/automations/tests/*.test.ts`, plus the relay test and `src/panel/shell/tests/mount-panel-navigation.test.ts`, gave `# pass 119 # fail 1`. The failure was `mount-panel-navigation.test.ts:218` (expected 1, actual 0).
- After the controller fix, the same set: `# tests 120 # pass 120 # fail 0`.
- `pnpm.cmd --filter @fluxiq-web-extension/extension check`: exit 1, refused by `scripts/check/core-build.mjs`. Core's build in `fxwork/t267/!FluxIQ` is 17 minutes behind its source (`runtime-adaptation/result-check.ts` is newer than dist). I did not rebuild Core, because that writes into the Core tree, which I must not touch.
- `node scripts/check-extension.mjs` in `apps/extension` (the `tsc` pair the gate wraps): exit 0, no output.
- `pnpm.cmd --filter @fluxiq-web-extension/extension build`: exit 0. It printed "verified 22 files" for chrome, firefox and e2e-chromium, plus the usual gecko.id placeholder warning.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (169 warning(s), 118 baselined)`.
- I deleted `apps/extension/.test-build-scratch/t267-s3-ext`, and `.test-build-scratch` is now empty.

## Not verified

- The full extension unit suite: I ran only the automations tests, the relay test and the shell navigation test.
- `pnpm check` through its gate against a fresh Core build.
- A live browser run.
- That Core accepts the new payload. Core's `narrowRunRuntimeSession` in `apps/web/src/lib/program-route.ts` currently refuses a token run carrying `runIntent`, so `runAutomation` from the panel is refused until the lead's Core change lands.
- I searched `apps/extension/e2e` for `run-runtime-session`, `learned` and `Learned` and found nothing.

## Open questions or contradictions found

- `summary-copy.ts` (not owned) shows "Checking the change..." when `learned > 0 && validated === undefined`. Under the new rule, `learned > 0` implies an `applied` status, which makes `validated` true, so that line can no longer appear.
- The same file's "The change didn't hold up, so future runs stay the same" needs `learned > 0 && validated === false`. With every adaptation dropped, `learned` is 0, so that line is also unreachable now.
- The supervisor should decide whether `summary-copy` should key those lines off created adaptations, or whether the lines should go. Its tests still pass, because they feed `RunFacts` directly.
