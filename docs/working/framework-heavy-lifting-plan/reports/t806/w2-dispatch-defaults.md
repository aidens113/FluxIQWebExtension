# w2 dispatch defaults (t806)

## Outcome
Partial. Code and tests written. The first supervisor test run passed everything except one error in my own new test, which I fixed. The re-run and the package typecheck never ran, because the heavy-check lock was held by other workers for over 2 hours.

## What changed and why
Root: packages/fluxiq/src/programs/automation-studio/runtime/project-agents/supervisor/
- brief-defaults.ts (new): `automationStudioProjectSupervisorBriefDefaults`.
  - Fills an omitted `kind` with `repair` when the subflow's latest build or repair return (`state.latestFor`, plan in force) is not done and its builder ran (`calls > 0`), else `build`.
  - Fills omitted `parts` for build or repair from `structure.partOf[subflowKey]`.
  - Fills an omitted repair `failingReceipt` with the closest non-passing trial of the subflow's returns (`RETURN.closestTrial`, `trialRef`; the last verdict-less trial of a done return is skipped as the yes it ended on), else the latest non-passing whole test; otherwise it leaves it absent, so the old refusal stands.
  - Sent values are never overridden; briefs without a known subflow key are left for the reading to refuse.
- whole-test-receipt.ts (new): shared helper for the whole-test receipt. `failingTrials` now uses it, and so do the defaults.
- dispatch-tool.ts:
  - The `rescued` computation moved to the top, and the defaults are applied to the sent value before the reset check, sizing and the reading.
  - `unchangedAgain` now runs right after the brief reading, on `read.briefs`, before `failingTrials` and the repeat check. The old call after the repeat filter is removed.
- tests/dispatch-defaults.test.ts (new): omitted kind and parts for a first build; a build again after a done return; repair with the receipt defaulted from a listed trial; repair with the receipt defaulted to the whole test; a sent kind, parts or receipt not overridden and still refused; nothing to repair from keeps `project.brief_failing_receipt`; `repair_unchanged` answered ahead of a bad receipt, and also when kind, parts and receipt are all omitted.

## Commands run and observed results
- `npx vitest run .../supervisor/tests`, run under the lock before my last test fix: 27 of 29 files passed, 224 of 225 tests.
  - The one failing test was in my new file: after a first repair, the second repair came back `repair_unchanged`, so my receipt assertion saw a different answer. I reordered it so the bad receipt is sent first (the test asserted the old order wrongly).
  - provider-stopped.test.ts reports "No test found in suite". It has an empty `describe("a supervisor a guard stopped...")`. The file is unmodified by me and the failure predates this work.
  - All existing repair-repeats, closest-trial and other supervisor tests passed, so the reorder broke none of them.

## Not verified
- The re-run of dispatch-defaults.test.ts after my fix; a background job is still queued on the lock.
- `node scripts/build-cache/cli.mjs fluxiq:check` (typecheck) was never run, so the new files are untested by tsc. Notably, `Pick<AutomationStudioProjectSupervisorState, "latestFor" | "answeredFor">` and `JsonValue` typing in brief-defaults.ts are unchecked.
- The barrel (index.ts) is unchanged: it exports neither dispatch-tool nor brief-input, so the new internals follow that.

## Open questions or contradictions
- tools.ts (not owned) still lists `required: ["kind","subflowKey"]` on the brief schema, and the schema lists `parts` as well probably. A provider that enforces the schema will not let the supervisor omit kind, parts or receipt until that file and guidance.ts text change. I did not touch either.
- A defaulted `repair` with nothing to repair from is refused (`project.brief_failing_receipt`) rather than falling back to build, per the brief.
- When one call has both an unchanged repair and a blocked-repeat brief, the unchanged answer now comes first.
