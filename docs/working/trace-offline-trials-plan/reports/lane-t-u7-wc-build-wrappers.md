# lane-t-u7-wc-build-wrappers report

## Outcome

Done. Both project-build trial wrappers now keep the inner port's `environmentKind`, and the whole-trial wrapper no longer writes an offline trial's acts to the reset ledgers.

## What changed and why

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t734/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/service/project-build/`.

- `whole-trials.ts`: works out `offline = automationStudioCandidateTrialOffline(trials.port)` once, when the port is made. The two `trialRan` ledger writes (the supervisor brief ledger and `AutomationStudioProjectBuildActsRecord`) now run only when `!offline && result.acts?.length`. The returned port gets `environmentKind` (and `prepareStart` when the inner port has one) at creation through `Object.assign(run, { environmentKind, prepareStart })` or `Object.assign(run, { environmentKind })`. There is no later assignment and no `as never`. I added a header paragraph explaining this. The no-ledger path (`return trials`) already returned the inner port unchanged.
- `subflow-trials.ts`: the wrapper function is now `run`. The port is `Object.assign(run, { environmentKind: trials.port.environmentKind })`, written at creation. `prepareStart` and `weighed` are still assigned afterwards, as before (both are mutable optional fields). I added a header bullet.
- New test `tests/project-build-trial-environment-kind.test.ts`, which has 6 tests. They run the real wrappers over real inner ports: `trialFixture` from the candidate-trial tests and `subflowTrialFixture` from the subflow-trial tests. Offline ports get `createAutomationStudioScopedRunEnvironment({ kind, clock: new AutomationStudioVirtualClock(100) })` as `environment`.
  - Whole trial, live: the port reports `environmentKind` "live", is not offline, keeps `prepareStart`, and a trial with one lasting act puts 1 act in `ledger.snapshot()`.
  - Whole trial, trace and fixture: the kind survives the wrapper, the port counts as offline, there is no `prepareStart` (the inner port offers none offline), the trial still returns 1 act, and the ledger snapshot stays empty.
  - Subflow trial: live reports "live"; trace and fixture keep their kind and count as offline.
- Folder count: `tests/` held 22 files (2 of them non-test helpers) and now holds 23, under the 25 limit. Existing tests are unmodified.

## Commands run and observed results

- Test first: I reverse-applied my two source edits, then ran `pnpm exec vitest run src/.../project-build/tests/project-build-trial-environment-kind.test.ts`. Result: `Tests 6 failed (6)`. Then I re-applied the edits.
- `pnpm exec vitest run src/programs/automation-studio/runtime/service/project-build` (from packages/fluxiq): `Test Files 21 passed (21)` / `Tests 96 passed (96)`.
- `pnpm exec tsc --noEmit` (from packages/fluxiq): no output, `tsc exit 0`.
- `node scripts/structure-audit.mjs` (from the repo root): `structure-audit: passed (413 warning(s), 1152 baselined).` A grep of its output found no warning for the three files I touched.

## Not verified

- No live or Lab run.
- I did not test the subflow wrapper's offline trial execution end to end, only the kind on the port. The brief asked only that the subflow port carry the kind; that wrapper writes no ledgers.
- I did not test the trial gates' behaviour over these wrapped ports. That belongs to other lanes and the gates' own tests.

## Open questions or contradictions found

- `AutomationStudioSubflowTrialPreparingPort` has other optional fields: `standingNos` and `checkRows` (seen in `flow-bootstrap/subflow-candidate/tests/kept-every-row-check.test.ts`). The project-build subflow wrapper does not copy them from the inner port. It did not before this change either, and this brief does not cover it. Worth a check if the inner port ever sets them.
