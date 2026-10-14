# t573-w8-lab-orphaned-repair-code: report

Brief: `### Brief: W8-lab-orphaned-repair-code`. Worktree `C:/Users/osrs_/FluxStuff/fxwork/t573-w8-lab-orphaned-repair-code`,
branch `task/t573-w8-lab-orphaned-repair-code`. Not committed. No Core, `apps/extension/**` or `domain/**` file touched.
No live run, no provider probe.

## Outcome

Done. All three items from t559's open questions 1-3 are removed or corrected. I checked that nothing calls each one
before I removed it.

## What changed and why

### Callers checked first
- `SCENARIO_REPAIRS` / `ScenarioRepair`: the only readers in `apps`, `packages` and `scripts` were the identity-drift
  barrel and `tests/scenario.test.ts`. Nothing loads a scenario's `repair.js` any more (t559 removed
  `declared-repair.ts`).
- `declaredRepair` on `AdaptationGateInput`: both `classifyAdaptationGate` calls (`run-repair-lane.ts:145,222`) leave
  it out. The only other reader was `gate.test.ts:39`.
- `declared_repair_not_made` is found only in `gate.ts`, its test, and the working-doc reports. No script, contract or
  architecture doc reads the closed reason list.

### scenario-lab identity-drift
- Deleted `apps/scenario-lab/src/scenarios/identity-drift/repair.ts` (with `git rm`, so the deletion is staged).
- `identity-drift/index.ts`: removed the `SCENARIO_REPAIRS` and `ScenarioRepair` exports.
- `identity-drift/tests/scenario.test.ts`: removed the test "renamed-redesign declares its repair..." and its
  `SCENARIO_REPAIRS` import. The helpers it used (`pageIn`, `region`, `submitButton`, `validateWebScenario`) are still
  used by other tests.
- `identity-drift/manifest.ts`: the doc comment no longer says a proposal-only run "is held to `repair.ts`". It now
  says no run is held to a proposal, because the declared repair was retired with that intent. I also removed the
  variant description's last sentence, "A live run that may only propose the repair is judged by its proposal instead
  (repair.ts)...". No run is judged that way any more. The description's other sentences, including the asserted
  "Only a repair can pass this row.", are unchanged.
- `scenarios/person-checks.ts`: dropped "as it loads a scenario's `repair.js`".

### Gate (`packages/test-runner/src/run-evaluation/adaptation/`)
- `gate.ts`: removed the `declaredRepair` input, its check, and the `declared_repair_not_made` reason. Every reason a
  run can still get is kept.
- `tests/gate.test.ts`: removed that assertion, and the test title no longer says "not judged the declared one".

### The six stale comments (t559 item 3)
- `flow-lane/lane-observation.ts`, both comments that cited `evaluateFlowRun`:
  - The `harnessRecovery` doc now says the field is optional because the bench's Flow-lane evaluation was retired.
    I left the type unchanged.
  - The `publishedObservation` doc no longer has the "exactly how the bench scores" sentence.
- `run-evaluation/flow-lane-evidence-sizes.ts`, `run-evaluation/single-run-evaluation.ts` and
  `run-evaluation/tests/flow-lane-evidence-sizes.test.ts`: these no longer call the bench a second Flow-lane producer.
- `person-simulation/check-module.ts`: dropped the `declared-repair.ts` citation.
- `scenario-steps/extract-intent.ts`: "the recording and Flow lanes" now reads "the recording lane".

## Commands run and observed results
- `pnpm --filter @fluxiq-web-extension/scenario-lab check` exited 0 (`scenario-lab:check` built, no errors).
- `pnpm --filter @fluxiq-web-extension/scenario-lab build`: `scenario-lab:build ... stored in the shared store (910 file(s)`.
  - The build does not clean `dist`, so a stale `dist/scenarios/identity-drift/repair.js` was left behind. `dist` is
    git-ignored build output, so I deleted it.
- From `apps/scenario-lab`, `node --test dist/scenarios/identity-drift/tests/*.test.js dist/scenarios/tests/*.test.js dist/tests/*.test.js`
  printed `# tests 78`, `# pass 78`, `# fail 0`.
- `pnpm --filter @fluxiq-web-extension/test-runner check`: `test-runner:check` built, no errors.
- `pnpm --filter @fluxiq-web-extension/test-runner build`: built (2006 files).
- From `packages/test-runner`, `node --test` printed `# tests 522`, `# pass 522`, `# fail 0`, `# skipped 0`. It ran:
  - `dist/run-evaluation/{adaptation,permission-stop,}/tests/*`
  - `dist/flow-lane/tests/{lane-observation,harness-recovery,skipped-attempt,extraction-read}`
  - `dist/flow-lane/repair/tests/*`, `dist/flow-lane/creation/tests/instruction-task`
  - `dist/person-simulation/tests/*`, `dist/scenario-steps/tests/*`, `dist/lane-rules/tests/*`
  - `dist/bench/tests/*`, `dist/tests/commands.test.js`
- `node --test` over `scripts/lab/live-campaign/tests/{lab-run-command,runner}.test.mjs` and `row/tests/*.test.mjs`
  printed `# tests 49`, `# pass 49`, `# fail 0`.
- `packages/test-contracts`, `node --test` over the adaptation-reuse, bench-report and harness-recovery-verdict
  contract tests printed `# tests 39`, `# pass 39`, `# fail 0`.
- `pnpm structure:check` printed `structure-audit: passed (194 warning(s), 639 baselined).` `repair.ts` had no
  baseline entry, so I did not need `structure:baseline`.
- `git diff --check` is clean.

## Not verified
- I did not run the full scenario-lab or test-runner suites, or `pnpm check` (narrow-check rule).
- I did not run anything live.

## Open questions or contradictions found
1. The `renamed-redesign` description is a manifest field, and the scenario-lab build hash goes into a campaign's
   identity. A campaign saved before this change that includes identity-drift may now hit the existing "does not match"
   resume refusal. That refusal is intended.
2. `apps/scenario-lab`'s build does not clear `dist`, so a deleted source leaves its `.js` behind until someone removes
   it by hand. This applies to any future deletion in scenario-lab, not just this one.
3. I left t559 items 4 and 5 as they are, because the brief did not name them:
   - `scripts/lab/live-campaign/row/*` still read `declaredRepair` from old bundles.
   - `runFlowLane` / `flowLaneSnapshot` are still in place.
