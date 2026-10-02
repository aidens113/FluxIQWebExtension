# t230: Core tests for the $0.10 ceiling (worker report)

## Outcome

Partial. I updated and verified 6 of the 15 failing test files. The other 9 files still fail (21 tests). The configurable-ceiling work was started but is not wired in. The per-Flow purse was not started. I stopped for two reasons:

1. **Permission denial.** The permission classifier denied a read of `packages/fluxiq/src/programs/automation-studio/model/index.ts` (with `flows.ts` in the same command) as "Modify Shared Resources". Both files have to change before the ceiling can be wired through the model. I did not work around the denial.
2. **Scope.** The coordinator's fourth message asks for one purse per Flow across the first build, every re-author, repair, recovery and result check. That is a cross-module redesign of the build purse, the repair purse and their persistence. It needs its own brief. It also changes the meaning of the repair-purse tests that still fail, so fixing those now would be wasted work.

## What changed and why (Core, uncommitted, on top of the supervisor's three files)

Each test now derives its amounts from `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD` and keeps its original meaning.

- `runtime/recovery/annotation/tests/run-budget.test.ts`: all 0.25 literals became `CEILING`. Scenarios are scaled proportionally:
  - the policy 0.1 → `CEILING*0.4`;
  - the resolver total 0.15 → `CEILING*0.6`;
  - the policy 0.2 → `CEILING*0.8`;
  - the repair amounts 0.05/0.03 → `CEILING*0.2`/`*0.12`;
  - the per-call 0.01/0.005 → `CEILING*0.04`/`*0.02`.
- `runtime/recovery/annotation/tests/exploration.test.ts` and `exploration-reduction.test.ts`: the ledgers use the default purse. A fixed $0.05 per call admitted only 2 calls under $0.10, so the per-call reservation is now `CEILING / 5`, which keeps the original five calls.
- `runtime/recovery/annotation/tests/iteration-guards.test.ts`, the 26-call `explore_and_adapt` test:
  - Each call reserves the larger of its even share and its own token worst case. At 8,000 input and 2,000 output tokens the worst case is $0.0048, which is more than $0.10/26 ($0.00385). That stopped the run at 21 calls.
  - I cut the declared limits to 4,000/1,000/5,000, so the worst case is $0.0024 and the even share binds again. Result: 26 calls, $0.098 spent. A comment explains the change.
  - The cost bounds now derive from `CEILING`.
- `runtime/llm/tests/session-key-provider.test.ts`: the expected defaults use the constant.
- **New, not wired in:** `model/run-cost-ceiling/run-cost-ceiling-env.ts` and its `index.ts` barrel.
  - Exports `FLUXIQ_LLM_RUN_COST_CEILING_USD` (the env name), the default 0.1, the maximum 10 (the run ledger's server ceiling) and `resolveAutomationStudioLlmRunCostCeilingUsd(env)`.
  - The resolver reads the environment lazily through `globalThis.process`, so it is browser-safe.
  - It throws a clear message on an invalid value and never falls back to the default.
  - Nothing imports it yet. It is not exported from `model/index.ts` because that read was denied.

## Commands run and observed results

- First run of the brief's vitest set (`runtime/llm`, `flow-bootstrap`, `model`, `api/handlers`, `runtime/recovery`): 22 failed / 2451 passed, in 5 files.
  - All 5 are the files fixed above.
  - None of the files the brief listed failed. Their 0.25 literals are explicit inputs, not the default.
- `npx vitest run src/programs/automation-studio`, the whole tree, run before my edits to the 4 iteration and exploration files: 21 failed / 4919 passed / 1 skipped. Failing files:
  - `runtime/loop-limits/tests/flow-bootstrap-evidence-loop.test.ts`: 7 tests
  - `runtime/route-state/tests/build-routing.test.ts`: 1
  - `runtime/service/runtime-adaptation/tests/refuted-result-port.test.ts`: 6 ("the repair's one purse")
  - `runtime/service/runtime-adaptation/tests/step-failure-port.test.ts`: 1 ("what the re-author may spend")
  - `runtime/tests/recovery-default-limits.test.ts`: 1
  - `runtime/tests/service-adaptation/tests/run-consequence-permission.test.ts`: 1
  - `runtime/tests/service-bootstrap/tests/cost-ceiling.test.ts`: 1 (it asserts the constant `toBe(0.25)`)
  - `runtime/tests/service-bootstrap/tests/generation.test.ts`: 2
  - `runtime/tests/service-flows/tests/creation.test.ts`: 1
- The 6 edited files plus `flow-execution-limits/`: 7 files, 57 tests, all passed.
- `npx tsc --noEmit -p .` in `packages/fluxiq`, through heavy.sh: exit 0, no output.

## Not verified

- The 21 tests listed above. They are not fixed and still fail.
- `structure-audit` and `docs:check` were not run.
- The docs (`docs/architecture/automation-studio/*.md` lines 439 and 646 of `llm-flow-bootstrap.md`) and the product comments that still say "$0.25" were not updated:
  - `harness/token-limits.ts`, `harness/run.ts`, `run-budget.ts:63`, `session-key-provider.ts:12`;
  - `loop-limits/flow-bootstrap-evidence-loop.ts:10,88`;
  - `recovery/annotation/run-budget.ts:17,115,130,140,167`, `refuted-result/purse.ts:4,8`;
  - `build-purse/purse.ts:4,11`, `unfinished-build/phases.ts:48`, `generation-failure/build-ending.ts:24`;
  - `model/tokens-per-run/...cleared-key.ts:9`, `service/flow-settings/tokens-per-run-default-migration.ts:14`, `result-check-authorization/contracts.ts:71,150`;
  - `service/runtime-adaptation/refuted-result-port.ts:21`.
- None of the Lab, env-knob, `.env.example` or per-Flow-purse requirements have been done.

## Open questions or contradictions found

- **Hard-coded $0.25 values in product code.** These are product logic, so the brief did not let me change them. They may need a decision:
  - `api/handlers/llm-execution-settings.ts:33` refuses a per-call `maxEstimatedCostUsd > 0.25`.
  - `runtime/llm/flow-execution-limits/resolution-within-flow-settings.ts:32` has `FLOW_MAX_COST_USD = 0.25`.
  - `runtime/llm/harness/token-limits.ts:29` has the default per-call `AUTOMATION_STUDIO_LLM_DEFAULT_MAX_ESTIMATED_COST_USD = 0.25`.
  - `runtime/result-check-authorization/contracts.ts:155` has `repairMaxCostUsdPerRun: 0.25`. Its comment calls this "Core's own ceiling".

  All of them are lowered by the ceiling, so none of them raises spend.
- **The brief's failing-file list did not match what actually failed** (see the first command above).
- **Proposed design for the configurable knob, for the next brief:**
  - Replace the constant with the accessor `automationStudioLlmRunCostCeilingUsd()`, called with no arguments, which reads the model resolver on every call.
  - `session-key-provider` defaults become a getter, and `model/flows.ts` calls the resolver inside `defaultAutomationStudioFlowSettingsMetadata()`.
  - Validate once at the top of `createGlobalProgramRuntime`. The env files are loaded before it runs (`framework/index.ts:177`).
  - Remove the constant so nothing can read a stale value. The Lab's `build-cost-ceiling.ts` imports it and must move to the accessor.
- **The per-Flow purse** needs a design brief. It has to decide:
  - where a Flow's cumulative spend is stored across separate build and re-author runs;
  - whether a result check draws on the same purse;
  - how the honest ending is reported.

## t230c: the Lab's tests under the configurable per-build ceiling

### Outcome

Partial. 10 of the 11 tests pass with amounts derived from Core's resolved ceiling. The eleventh, "the per-build ceiling has one definition, Core's, and the Lab contract's bound is that number", still fails. Its remaining assertions compare the test-contracts mirror `LLM_LAB_MAX_ESTIMATED_COST_USD` (and `DEFAULT_LLM_LAB_BUDGET.maxEstimatedCostUsd`), which is `0.25` in `packages/test-contracts/src/llm.ts:48`, against Core's ceiling. That file is outside this brief, and the assertions were not deleted.

### What changed and why

- `packages/test-runner/src/live-llm/tests/live-llm-plan.test.ts`: a `CEILING` (= `LIVE_LLM_BUILD_COST_CEILING_USD`) replaces each 0.25. "Below the ceiling" uses `CEILING / 2` and "over" uses `CEILING * 9`. The campaign-row sweep tries `CEILING / 2`, `CEILING` and `CEILING * 1.2`. The literal-pin `assert.equal(C, 0.25)` is now `assert.equal(C, resolveAutomationStudioLlmRunCostCeilingUsd())`, which checks that the Lab's value is the one Core resolves. Two titles were renamed to say "Core's ceiling".
- `.../tests/budget.test.ts`: the pricey case is 26 calls at `C/25` (1.04 times C). The breach pattern is built from the computed amounts through a small `escaped()` helper.
- `.../tests/live-llm-run.test.ts`: the Flow setting and the authorized totals use C. `buildThenRepair` uses `0.8C` under and `1.04C` over, and `isCostBreach` interpolates C. The historical `run-mup2u8o3` overspend keeps its proportion (`C * 1.18775841599`, rounded to the nano-dollar), and its comment records the $0.25 ceiling at that time. One title was renamed.
- `.../tests/run-spend.test.ts`: the empty run's `ceilingUsd` is Core's. The per-build case uses `0.8C` each. The over-ceiling case (which already passed) was also made relative to C, so a configured ceiling cannot break it. A `nano()` helper matches the report's 9-decimal rounding.
- Comments: `live-llm/build-cost-ceiling.ts` (names the variable, the $0.10 default and the flag) and `live-llm/budget-over-product-failure.ts` ("the ceiling then").
- `scripts/lab/live-campaign/lab-run/command.mjs`: the comment names the variable, the default and the flag, and now says that only the variable can raise the ceiling.
- `docs/architecture/testing-facility.md`: corrected the $0.25 statements at the chat-build limit, the default allowance and the campaign spend-ceiling paragraph. Added a subsection, "The per-build cost ceiling", under "Live-run waste guards". It covers the variable, its default, the $10 maximum, the start-time refusal and the order the Lab resolves it in (flag, environment, `.env`, `.env.local`), and calls it the developer and Lab knob, not the product's spending control.

### Commands run and observed results

- `bash .../heavy.sh "t230c baseline test" pnpm --filter @fluxiq-web-extension/test-runner test` before any edit: `# tests 1744 # pass 1729 # fail 15`. These were the 11 named tests plus 4 ui-e2e files with `ENOENT domain/dist/...`.
- The first run after the edits: `# tests 1586 # pass 1557 # fail 29`. Of the 29, only test 793 is a ceiling failure. The rest are file-level `ENOENT ...domain/dist/actions/effect.js`: the shared domain/dist was being rebuilt by someone else at the same time.
- Rerun: `# tests 1756 # pass 1755 # fail 1`. The one failure is `not ok 793 - the per-build ceiling has one definition, Core's, and the Lab contract's bound is that number`, with `0.25 !== 0.1` at the `LLM_LAB_MAX_ESTIMATED_COST_USD` assertion.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (155 warning(s), 118 baselined).`

### Not verified

- I did not run the tests with `FLUXIQ_LLM_RUN_COST_CEILING_USD` set to a non-default value. The derived amounts are meant to hold for any ceiling from $0.0x to $10, but that was not exercised.
- No live run was made.

### Open questions or contradictions found

1. The contract mirror: `LLM_LAB_MAX_ESTIMATED_COST_USD = 0.25` in test-contracts bounds `--llm-max-cost-usd` and sets `DEFAULT_LLM_LAB_BUDGET.maxEstimatedCostUsd`. A static mirror can no longer equal a configurable ceiling. Two fixes are possible, and the supervisor needs to choose:
   - set it to 0.1, which makes test 793 pass at the default but refuses `--llm-max-cost-usd` above $0.10 even when the ceiling is raised; or
   - make the contract bound Core's maximum (`AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_MAX_USD`, 10) and change test 793 to say "the contract never refuses what Core allows; the plan clamps to Core's ceiling".

   Either way `packages/test-contracts/src/llm.ts` and test 793 have to change, and `tests/commands.test.ts:144` (`0.26 -> /0.25/`) will follow.
2. The Lab's own value can disagree with Core's. `LIVE_LLM_BUILD_COST_CEILING_USD` is resolved from the Lab process's environment only. `--llm-cost-ceiling-usd` and `.env.local` reach the Core child (`buildFluxIQEnvironment`) but not the Lab's plan, post-run check or spend report. So with the flag set to 0.5, Core allows $0.50 while the Lab clamps the Flow setting to $0.10. That flag is still refused by the contract above $0.25.
3. Other $0.25 amounts are outside this brief and were left alone: `demo-llm-create-ui/limits.ts` (the code values and a comment saying "Core's $0.25 ceiling"), `demo-llm-adaptation.ts`, `demo-llm-live.ts`, `demo-llm-profile.ts`, `demo-workspace/diagnosis-ui.ts`, and the doc's `demo:llm:diagnose` "at most $0.25". Core now clamps these to its ceiling.

# t230b: finish the Core tests for the $0.10 ceiling (worker report)

## Outcome

Partial. 18 of the 21 failing tests now pass, with test-only edits. 3 still fail:

- 2 fail at $0.25 as well, so the ceiling did not cause them.
- 1 needs a decision on a product requirement.

No product code, `model/index.ts` or `model/flows.ts` was touched.

## What changed and why (Core, uncommitted, test files only)

Every amount derives from `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD` (`CEILING`). Scenarios are scaled proportionally, so each keeps its meaning whatever the ceiling (or `FLUXIQ_LLM_RUN_COST_CEILING_USD`) is set to. No assertion was removed.

- `runtime/loop-limits/tests/flow-bootstrap-evidence-loop.test.ts` (7 tests):
  - 0.25 became `CEILING`.
  - The resolution and Flow figures became fractions of it: 0.2 → `CEILING*0.8`, 0.15 → `*0.6`, 0.12 → `*0.48`.
  - The passing "a Flow set to $0.10 gets $0.10" test was renamed and moved to `CEILING*0.4`. At $0.10 it no longer tested a lowering.
- `runtime/service/runtime-adaptation/tests/refuted-result-port.test.ts` (6 tests, all in "the repair's one purse"):
  - Every amount is a fraction of `CEILING`, rounded to the billionth by a local `usd()` helper, the same way the purse rounds.
  - The two passing tests ("first build spent the purse", "a Flow's $0.10") were scaled the same way, so they still test what they say: the Flow figure is `CEILING*0.4`.
- `runtime/service/runtime-adaptation/tests/step-failure-port.test.ts` (1 test), "what the re-author may spend":
  - Ladder spend `CEILING*0.8`, handed `CEILING*0.2`.
  - The build's own spend is `CEILING*0.08`, through an overridden `generate`. The shared `deps()` default of 0.02 is not changed.
  - `spentUsd` is asserted with `toBeCloseTo(CEILING*0.88, 9)`.
  - "Lowered by the Flow" uses a Flow figure of `CEILING*0.4`. "Ladder left nothing" uses `CEILING`.
- `runtime/tests/service-bootstrap/tests/cost-ceiling.test.ts`:
  - `costPerCall = CEILING*0.12` (as 0.03 was of 0.25).
  - The message match is ``spending limit of $${CEILING.toFixed(2)}``, the product's own format.
  - `expect(CEILING).toBe(0.25)` became `expect(defaults.maxTotalEstimatedCostUsd).toBe(CEILING)`. `flow-execution-limits/tests/run-cost-ceiling.test.ts` already pins 0.1.
- `runtime/tests/service-bootstrap/tests/generation.test.ts` (2 cases): a new Flow's `maxEstimatedCostUsdPerRun` is `CEILING`. The per-request 0.25 assertion is unchanged and still passes: that value is the harness's per-call default, not the ceiling.
- `runtime/tests/service-flows/tests/creation.test.ts`: the default `maxEstimatedCostUsdPerRun` is `CEILING`.

## Still failing

1. **`runtime/route-state/tests/build-routing.test.ts`, "before and after, for the three recorded builds". Not caused by the ceiling.**
   - Run with `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25`, it fails identically.
   - For everything-store-run4, expected `before 29 / afterUnreported 29 / callsBeforeUnseen 3`; received `30 / 28 / 2`.
   - Forcing `maxCostUsd: 0.25` into the replay's budget (`llm/decision-context/tests/recorded-runs.ts`, then reverted) changed nothing either.
   - It looks like a loop behaviour change from a recent merge, perhaps t193's repeat guard or t195. Whoever owns that change should decide whether the new counts are right.
2. **`runtime/tests/service-adaptation/tests/run-consequence-permission.test.ts`, "stops at permission_required when the run permits nothing". Not caused by the ceiling.**
   - It also fails identically at `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25`. The env took effect: charged $0.1667 against $0.0667.
   - The person's "deny" is answered and the press is not taken, but the recovery then makes a `runtime_patch` call, and `llmGate` has no `patchSkippedCode`.
   - Probably from Lane B's "a person's no is a decline" (Core `2a5ad68c`).
3. **`runtime/tests/recovery-default-limits.test.ts`, "gives a default run a diagnosis, a patch and decisions left over". Caused by the ceiling; it needs a product or requirement decision, so I did not change it.**
   - It asserts at least 8 exploration decisions at a 30,000-token page with 8,000 output tokens. On deepseek-flash rates that page costs about $0.0186 a decision.
   - Under $0.10, after the diagnosis (about $0.0087) and the held patch share (about $0.019), only 3 fit. Under $0.25 about 11 fit. At least 8 needs about $0.18.
   - The ways to make it pass are:
     - lower the floor, which weakens the test;
     - shrink the scenario's pages, which changes its meaning;
     - make a product change, such as smaller per-decision reservations or a smaller patch hold.
   - The supervisor should choose.

## Commands run and observed results

- Baseline: `bash heavy.sh "t230b vitest" npx vitest run --testTimeout=120000 src/programs/automation-studio` (in `packages/fluxiq`): `Test Files 9 failed | 526 passed (535)`, `Tests 21 failed | 4919 passed | 1 skipped (4941)`.
- After the edits, same command: `Test Files 3 failed | 533 passed (536)`, `Tests 3 failed | 4946 passed | 1 skipped (4950)`. The 3 are the tests above. No timeouts occurred, so no re-run was needed.
- Per-file runs, each passing: loop-limits 18/18, refuted-result-port 13/13, step-failure-port 12/12, cost-ceiling 1/1, generation "past eight decisions" 2/2.
- `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25 npx vitest run` on route-state and run-consequence-permission: each still 1 failed, with the same diff.
- `bash heavy.sh "t230b tsc" npx tsc --noEmit -p .`: exit 0, no output.
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (210 warning(s), 349 baselined)`, plus "1 baseline entries can be lowered". Exit 0.

## Not verified

- I did not bisect which commit broke route-state and run-consequence-permission.
- Under a non-default `FLUXIQ_LLM_RUN_COST_CEILING_USD`, `creation.test.ts` depends on `model/flows.ts` reading the same resolver. It does (`resolveAutomationStudioLlmRunCostCeilingUsd()`), but I only ran it at the default.

## Open questions

- Recovery-default-limits floor: see item 3 above.
- `model/index.ts` now shows as modified in Core. It was not me; probably the supervisor wiring `model/run-cost-ceiling/`.

### t230c, second pass (supervisor decisions 1-3)

**Outcome:** Done. The test-runner suite has 0 failures both at the default ceiling and with `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.07`. The test-contracts suite has 0 failures. The structure audit has one violation, and it is not from this task (see below).

**What changed**
1. The contract mirror. `LLM_LAB_MAX_ESTIMATED_COST_USD` is now `10`, Core's largest configurable ceiling, and has a comment saying so (`packages/test-contracts/src/llm.ts`). `DEFAULT_LLM_LAB_BUDGET.maxEstimatedCostUsd` follows it, so an unset `--llm-max-cost-usd` plans the ceiling itself. Test changes:
   - `tests/llm-contracts.test.mjs`: the default is 10, and 10.01 is refused.
   - Test 793 is renamed "the build's ceiling is Core's resolved value, and the Lab contract's bound is Core's maximum". It asserts the following:
     - the Lab given Core's own environment equals `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD`;
     - with nothing set, the Lab gives Core's default;
     - "0.07" gives Core's resolver's value;
     - "abc" is refused naming the variable;
     - the mirror and the default equal `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_MAX_USD`.
   - `commands.test.ts:144` now refuses `LLM_LAB_MAX_ESTIMATED_COST_USD + 0.01` with the contract's message.
2. One value for the Lab and for Core.
   - The constant is gone. `liveLlmBuildCostCeilingUsd(repositoryRoot, args = process.argv, env = process.env)` (`live-llm/build-cost-ceiling.ts`) reads `labCostCeilingValue` (flag, then environment, then `.env`/`.env.local`) and resolves it through Core's `resolveAutomationStudioLlmRunCostCeilingUsd`.
   - `planLiveLlmExecution(profile, buildCostCeilingUsd)` now requires the ceiling. It refuses a non-positive one and holds the build to `min(ceiling, declared)`. It no longer uses Core's import-time `automationStudioLlmRunCostCeilingUsd`.
   - `beginLiveLlmRun` resolves the ceiling from `costCeilingSources`. These default to `process.argv` and `process.env`, the same defaults `buildFluxIQEnvironment` uses. `buildFluxIQEnvironment` gained an `args` parameter (default `process.argv`) so a test can drive it.
   - `liveLlmRunSpend`'s `ceilingUsd` is now required, and the run passes its plan's.
   - Post-run check, `budget.ts`: each call's cost is now held to `plan.maxEstimatedCostUsd` (the declared figure held to the ceiling). The message is `call N cost X against its per-call cap of C (--llm-max-cost-usd D, held to Core's per-build ceiling)`. Before, it compared against the declared figure, which with the contract at 10 would have let an unset run's calls go to $10 each. The suite caught this in `observed-usage.test.ts`.
   - Tests:
     - `live-llm/tests/lab-ceiling.ts` (new) gives `LAB_CEILING_USD` and `planAtLabCeiling`, resolved for this checkout, and every plan test uses them.
     - `live-llm/tests/cost-ceiling-reach.test.ts` (new) checks three cases with a temporary checkout:
       - a flag value (it beats the environment and the file) reaches both Core's environment and the Lab's plan;
       - a `.env.local` value reaches both;
       - with nothing set, Core gets none and the plan uses Core's default.
     - In `observed-usage.test.ts`, the over-cap call and the reserved charge are now relative to the ceiling. The fixed 0.0769 failed at 0.07.
     - The plan test adds "the plan holds a build to the ceiling it is given, and refuses one that is not an amount".
3. The `demo-llm-*` limits were left as they were.
- Docs and comments: `testing-facility.md` describes `liveLlmBuildCostCeilingUsd`, the $10 contract bound, and the plan and post-run check using Core's value. `command.mjs` names the function.

**Commands and results**
- `pnpm --filter @fluxiq-web-extension/test-contracts test` gave `# tests 156 # pass 156 # fail 0`.
- `pnpm --filter @fluxiq-web-extension/test-runner test` (through heavy.sh) gave `# tests 1760 # pass 1760 # fail 0`.
- `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.07` with the same command gave `# tests 1760 # pass 1760 # fail 0`.
- A direct plan at 0.07 printed `{ core: 0.07, lab: 0.07, planPerCall: 0.07, planTotal: 0.07 }`.
- `node scripts/structure-audit.mjs` printed one violation: `[working-docs] docs/working/README.md is out of date with the documents' header blocks`. It did not appear on the earlier audit. It most likely comes from this untracked report file or from another agent's working-doc edit. `docs/working/README.md` is not mine to regenerate; `pnpm structure:baseline` regenerates it.
  - Two violations of my own appeared on the way and were fixed: a test added to `src/tests` (over its 25-file limit, moved to `live-llm/tests`) and a fixed temporary path (now `mkdtemp`).

**Not verified:** no live run. `cli.ts` passes no explicit sources to `beginLiveLlmRun` and relies on the shared defaults. Its `repositoryRoot` is assumed to be the coordinator's `repositoryRoot`; I did not trace that.
