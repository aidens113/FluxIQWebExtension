# t212: the Lab enforces the $0.25 ceiling per build, not per call

## Outcome

Done. No Lab run, no commit.

Ready to commit: the 27 files listed under "What changed"; validation: `node --test` over the touched test-runner dist tests -> `# pass 98 # fail 0`; `node --test` over the touched scripts/lab tests -> `# tests 83 # pass 83 # fail 0`; `node scripts/structure-audit.mjs` -> `structure-audit: passed (135 warning(s), 119 baselined)`.

## What was actually wrong (state at the start)

t200's finding ("min($2, 0.25 x calls)") is out of date. Lane B round 2 (`89b8fd5f`) had already capped the run total at `min(0.25, perCall x calls)`. The campaign passes `--llm-max-cost-usd 0.25`, so a campaign build was already held to $0.25. Three things were still wrong:

1. **`--llm-max-cost-usd` was still read per call and multiplied by the call count.** For example, `0.05` with 4 calls gave a $0.20 build, and `0.01` with 20 calls gave $0.20. The plan also kept two copies of the number (`CORE_MAX_COST_USD = 0.25` and `CORE_MAX_TOTAL_COST_USD = 0.25`), and the campaign passed a third copy (`"0.25"` twice in `lab-run/command.mjs`).
2. **No report judged spend per build.** The run spend (`run-spend.ts`), the campaign row (`reportedCostUsd`) and the spend ledger (`totalEstimatedCostUsd`) all report the run's sum. That sum is build + repair + judge + re-author, so it can rightly go past $0.25, and none of them could say whether a single build broke the ceiling.
3. `docs/architecture/testing-facility.md:2529` still describes the $2 per-call model (see Open questions).

## What changed and why

**One definition of the ceiling.** `packages/test-runner/src/live-llm/build-cost-ceiling.ts` (new) defines `LIVE_LLM_BUILD_COST_CEILING_USD = AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD`. The value is imported from Core (`fluxiq/automation-studio`), not copied. It is exported from the `live-llm` barrel.

**The plan (`live-llm-plan.ts`).** `--llm-max-cost-usd` is now the whole build's ceiling: `maxTotalEstimatedCostUsd = automationStudioLlmRunCostCeilingUsd(declared)`. That is Core's own lowering function, never multiplied by calls. `maxEstimatedCostUsd` (the per-call figure) equals that ceiling, because one call cannot outspend its build. Both local copies of 0.25 are gone. The refusal message now says "per-build limit".

**The post-run check (`budget.ts`).** The breach now reads `the build's estimated cost X exceeded its per-build cost ceiling of Y (--llm-max-cost-usd Z, held to Core's per-build ceiling)`. It is still judged per phase: the build in `settleBuild`, the repair in `settleRepair`.

**Run spend (`run-spend.ts`).** `LiveLlmRunSpend` gains `perBuild: { ceilingUsd, builds[], maxBuildCostUsd, overCeiling }`. It holds one entry per build, matching how Core budgets:
- the build;
- the run's recovery (`runtime`);
- each re-author attempt.

No entry is summed with another. The judge is excluded because Core holds it to its own limit outside the run budget. The ceiling is the plan's `maxTotalEstimatedCostUsd`, defaulting to Core's.

**Live run (`live-llm-run.ts`).** It passes the plan's ceiling, writes `observed.perBuild` into `snapshots/live-llm.json`, and adds `buildsOverCeiling` and `perBuildCeilingUsd` to the settle event's `runTotal`, but only when a build went over.

**Campaign (lane C's F15 reporting).**
- The new `scripts/lab/live-campaign/row/build-spend.mjs` (`perBuildSpend`, exported from the row barrel) reads `observed.perBuild`. For older snapshots it falls back to build accounting plus repair, judged against `authorized.maxTotalEstimatedCostUsd`. It never supplies a ceiling of its own: with no recorded ceiling it returns `null`. A build whose cost was not recorded is counted as `unrecorded`, not treated as $0.
- Each row gains `perBuildSpend`.
- `totalsOf` gains `buildsOverCeiling`, and the markdown summary line states it.

**Campaign command (`lab-run/command.mjs`).** The `["--llm-max-cost-usd", "0.25"]` copies were removed from `REPAIR_LIMITS` and `CREATE_LIMITS`. A run now takes the default budget, which the plan holds to Core's ceiling. An operator may still lower it after `--`. The usage example in `live-campaign.mjs` now shows lowering to 0.1.

**Spend ledger (`scripts/lab/live-guards`).**
- `run-outcomes.mjs` adds `buildCeilingUsd`, `maxBuildCostUsd` and `buildsOverCeiling`, using the same `perBuildSpend` through the row barrel.
- `close-launch.mjs` writes these fields on each finish entry.
- The `ledger.mjs` typedef and comment were updated.
- The `run-lab.mjs` "recorded" note now prints them.

There is no budget across runs, and `windowSpend` is unchanged.

**Tests.**
- `live-llm-plan.test.ts`:
  - updated per-call expectations (0.01 x 20 now gives 0.01, not 0.2; 0.05 x 4 now gives 0.05);
  - a new single-definition test: the Lab's constant equals Core's, and the contract mirror and default budget equal Core's;
  - a new exhaustive test: for each of 4 tasks, every call count from 1 to 64, and caps 0.001, 0.05, 0.25, 0.3 and 2, the plan never exceeds the per-build ceiling, is never scaled by calls, and per-call stays at or below per-build.
- `budget.test.ts`: the per-call reading (4 x $0.05 = $0.20 against a $0.05 build) now fails.
- `live-llm-run.test.ts`: message text.
- `run-spend.test.ts`: three new per-build tests (build, recovery and two re-authors at $0.20 each, all within; over-ceiling flagged; a lowered plan ceiling).
- `row/tests/build-spend.test.mjs` (new, 6 tests).
- `admit-live-run.test.mjs`: two new ledger tests.
- `lab-run-command.test.mjs`: no default `--llm-max-cost-usd`.
- `tasks.mjs`, `command-line.test.mjs` and `runner.test.mjs` were updated for the removed flag and the new total.

Files changed:
- **test-runner `src/live-llm`:**
  - `build-cost-ceiling.ts` (new)
  - `live-llm-plan.ts`
  - `budget.ts`
  - `run-spend.ts`
  - `live-llm-run.ts`
  - `index.ts`
  - `tests/live-llm-plan.test.ts`
  - `tests/budget.test.ts`
  - `tests/run-spend.test.ts`
  - `tests/live-llm-run.test.ts`
- **scripts/lab:**
  - `run-lab.mjs`
  - `live-campaign.mjs`
  - `live-campaign/lab-run/command.mjs`
  - `live-campaign/row/build-spend.mjs` (new)
  - `live-campaign/row/index.mjs`
  - `live-campaign/row/summarize-task.mjs`
  - `live-campaign/row/tests/build-spend.test.mjs` (new)
  - `live-campaign/summary/totals.mjs`
  - `live-campaign/summary/markdown.mjs`
  - `live-campaign/tests/tasks.mjs`
  - `live-campaign/tests/command-line.test.mjs`
  - `live-campaign/tests/lab-run-command.test.mjs`
  - `live-campaign/tests/runner.test.mjs`
  - `live-guards/run-outcomes.mjs`
  - `live-guards/close-launch.mjs`
  - `live-guards/ledger.mjs`
  - `live-guards/tests/admit-live-run.test.mjs`

## Every place the Lab reads or passes the ceiling

| Place | What it does | State now |
| --- | --- | --- |
| `packages/test-runner/src/live-llm/build-cost-ceiling.ts` | the one Lab definition | imports Core's `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD` |
| `live-llm/live-llm-plan.ts` `planLiveLlmExecution` | plans per-call and per-build cost; refusal message | per build, using Core's lowering function |
| `live-llm/flow-settings.ts` | writes `llmExecutionSettings.maxEstimatedCostUsd` and `adaptationPolicySettings.maxEstimatedCostUsdPerRun`, then reads them back | unchanged; carries the plan's values |
| `live-llm/authorize-flow.ts` | passes the plan through | no cost field of its own |
| `live-llm/budget.ts` `liveLlmBudgetBreaches` | post-run total and per-call checks | total judged per build |
| `live-llm/live-llm-run.ts` (dry-run print, `settleRepair` `authorized`, snapshot `authorized`, `spend()`, `spendSummary`) | records and reports | adds `perBuild` |
| `live-llm/run-spend.ts` | sums the phases | adds per-build entries against the ceiling |
| `packages/test-runner/src/commands.ts:167-195` | parses `--llm-max-cost-usd`, defaults to `DEFAULT_LLM_LAB_BUDGET.maxEstimatedCostUsd` | unchanged |
| `packages/test-contracts/src/llm.ts:48` `LLM_LAB_MAX_ESTIMATED_COST_USD`, used at `:146` (default) and `llm-validation.ts:171` (validation bound) | mirror of 0.25 | unchanged; pinned to Core by a test (see Open questions) |
| `scripts/lab/live-campaign/lab-run/command.mjs` | used to pass `--llm-max-cost-usd 0.25` twice | removed |
| `scripts/lab/live-campaign.mjs:17` | usage example | now shows lowering |
| `scripts/lab/live-campaign/row/build-spend.mjs`, `summarize-task.mjs`, `summary/totals.mjs`, `summary/markdown.mjs` | campaign reporting | per build |
| `scripts/lab/live-guards/run-outcomes.mjs`, `close-launch.mjs`, `ledger.mjs`, `scripts/lab/run-lab.mjs:248` | spend ledger | per build, beside the total |
| Demo paths, not the Lab campaign: `demo-llm-adaptation.ts:36`, `demo-llm-live.ts:31`, `demo-llm-profile.ts:10-11`, `demo-llm-create-ui/limits.ts:13,33,44` | hard-coded `0.25` | **not changed**; outside the brief |

## Commands run and observed results

- `bash .../heavy.sh "t212 test-runner build" pnpm --filter @fluxiq-web-extension/test-runner build` -> exit 0, `{"build-cache":"build","step":"test-runner:build",...}`.
- `node --test dist/live-llm/tests/*.test.js` (in packages/test-runner) -> `# pass 98 # fail 0`.
- `node --test scripts/lab/live-guards/tests/*.test.mjs scripts/lab/live-campaign/tests/*.test.mjs scripts/lab/live-campaign/row/tests/*.test.mjs scripts/lab/live-campaign/summary/tests/*.test.mjs` -> `# tests 83 # pass 83 # fail 0`. By folder: live-guards 26, live-campaign 21, row 33, summary 3.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (135 warning(s), 119 baselined)`. The first run failed on a cross-directory import (`run-outcomes.mjs` -> `row/build-spend.mjs`); it now goes through the row barrel.
- `bash .../heavy.sh "t212 test-runner test" pnpm --filter @fluxiq-web-extension/test-runner test`:
  - The Core freshness gate passed: `core-build: FluxIQ Core's build at ...\fxwork\!FluxIQ is current with its source.`
  - Result: `# tests 1721 # pass 1718 # fail 3`, exit 1.
  - The 3 failures are all in `flow-lane/creation/tests/authored-nodes.test.js` (326, 328) and `flow-lane/creation/tests/lane.test.js` (364). They expect the navigate node's `url` withheld as the origin (`parametersWithheld: ['url']`) but get the full scenario URL. Those are files t212 did not touch, and the cause is not cost. They look like a dev regression from an earlier merge (t200's whole-page work), and they were not investigated.

## Not verified

- Not run: a live Lab run (forbidden by the brief), so Core's acceptance of `maxEstimatedCostUsd == maxTotalEstimatedCostUsd` for an operator-lowered value was not exercised live. Campaign runs are unchanged at 0.25/0.25, which lane B already ran.
- Not run: the whole `pnpm check`, eslint, or other packages' suites.
- Not checked: whether the 3 `flow-lane/creation` failures also occur on unmodified `dev`. They are in untouched files and have no cost dependency.

## Open questions or contradictions found

1. **The test-contracts mirror.** `LLM_LAB_MAX_ESTIMATED_COST_USD = 0.25` remains, because `@fluxiq-web-extension/test-contracts` depends only on `@fluxiq/contracts`, which does not export the ceiling. A test now fails if it drifts from Core's value. Removing it fully needs either Core to export the ceiling from `@fluxiq/contracts`, or test-contracts to depend on `fluxiq`. That is a Core or dependency decision for the supervisor.
2. **Stale doc.** `docs/architecture/testing-facility.md:2529` still says "held to the smaller of $2 and the per-call ceiling times the authorized calls" and "`--llm-max-cost-usd 0.25`". The docs were not in the brief, so they were not edited. Suggested wording: "`--llm-max-cost-usd` is the build's spend ceiling, held to Core's per-build $0.25 (`AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD`) and never multiplied by the call count; the campaign passes none."
3. **Changed operator meaning.** `--llm-max-cost-usd X` with X below 0.25 now means $X per build, where before it meant $X per call. Any script or person relying on the per-call reading now gets a tighter build.

## Follow-up (supervisor, round 2)

### 1. The three flow-lane/creation failures: this is (a), now fixed

**Reproduced on dev.** `dev` is `ab9a352b`, which is this tree's base. `git diff --stat ab9a352b HEAD -- packages/test-runner/src/flow-lane packages/test-contracts` is empty, so t212 touched none of the failing code. The first full `pnpm test` here showed exactly these three failures (326 and 328 in `authored-nodes.test.js`, 364 in `lane.test.js`), with Core's freshness gate reporting current.

**Cause, with evidence.** `createdFlowAuthoredNodes` (`authored-nodes.ts`) used Core's `automationStudioScreenedNodeParameters` as its only screen. Core commit `711eab8c` ("The model sees the whole page"; Task t200; merged into Core dev as `c0e35235`, "Merge task t200 ... integration round 3") rewrote `repair-context/parameter-screen.ts` and deleted `parameter-vocabulary.ts`. Core HEAD contains that commit (`merge-base --is-ancestor` succeeded). The rewrite removed four things:
- the reduction of a URL to its origin; the deleted comment said "the path and the query are where an order number, a search term and a session token live";
- the rule that a string is carried only under one of Core's closed words;
- the 80-character string bound;
- the key, item, depth and withheld-path bounds.

Those removals are right for the model. The run artifact inherited them, though: `snapshots/flow-lane.json` `authoredNodes` would now carry a navigation's full path and query, and any free text a Flow was authored with (typed text, for example). The artifact used to screen all of that.

The repository's own contract for this record still promises "never page text, never a value a person or a page supplied" (`packages/test-contracts/src/authored-flow-node.ts`). Its validator (`authored-flow-node-validation.ts`) only bounds text to 80 characters or an origin. A short URL path, which the test fixture has, therefore passed the validator. The tests were not pinning an incidental detail. The artifact's own screening had gone, and only secret-shaped values and query parameters (Core's) still held. So this is (a).

**Fix (only the artifact is screened).**
- The new `packages/test-runner/src/flow-lane/creation/artifact-screen.ts` (`createdFlowArtifactScreen`) runs after Core's screen and keeps every decision Core made: secrets, secret-named keys, locators, denied keys and target keys. It then holds what survived to the artifact's envelope, which is the pre-t200 rule now owned by the Lab:
  - an absolute URL is carried as its origin, and its path is named as withheld;
  - a string travels only under a classifier key (`mode`, `kind`, ...) at any depth, or under a naming or comparand key at the first two levels, and only up to 80 characters;
  - containers are limited to 3 levels and 12 keys an object (extra keys are named), 6 list items beside the list's `count`, and 16 withheld paths.
- List items are aligned with the authored list, so a path the Lab names is the item's authored index, even where Core dropped an earlier item.
- `authored-nodes.ts` now composes the two screens. What the model sees is unchanged, because Core's screen is untouched.
- The three existing tests now pass as originally written.
- The new `creation/tests/artifact-screen.test.ts` adds 4 tests:
  - the model sees `https://shop.example/orders/48213?q=jane+doe&page=2` whole, while the artifact gets `https://shop.example` with `["url"]` withheld;
  - typed free text is withheld from the artifact but still reaches the model; closed words and numbers travel;
  - everything Core withholds stays withheld, and list-index paths stay aligned;
  - the container bounds hold.

### 2. Docs

`docs/architecture/testing-facility.md:2529` no longer describes the $2 per-call model. It now says:
- the ceiling is $0.25 per build, whatever the call count, and has one definition (Core's constant, imported as `LIVE_LLM_BUILD_COST_CEILING_USD`);
- `--llm-max-cost-usd` is the whole build's ceiling: it can only lower it, is never multiplied by calls, and the campaign passes none;
- each build, recovery and re-author is held to the ceiling on its own;
- spend is reported per build in three places: `observed.perBuild`, the campaign's `perBuildSpend` and `buildsOverCeiling`, and the ledger's `buildCeilingUsd`, `maxBuildCostUsd` and `buildsOverCeiling`;
- there is no spend budget across runs.

### Validation (round 2)

- `heavy.sh ... pnpm --filter @fluxiq-web-extension/test-runner build` -> exit 0.
- `node --test dist/flow-lane/creation/tests/*.test.js` -> `# pass 86 # fail 0`.
- `heavy.sh ... pnpm --filter @fluxiq-web-extension/test-runner test` -> exit 0. Output: `core-build: FluxIQ Core's build at ...\fxwork\!FluxIQ is current with its source.`, then `# tests 1725 # pass 1725 # fail 0`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (135 warning(s), 119 baselined)`.

Not verified: no real run bundle was written; there was no Lab run. The fix is proven by unit tests over Core's live screen only.

Ready to commit:
- `packages/test-runner/src/flow-lane/creation/artifact-screen.ts` (new)
- `packages/test-runner/src/flow-lane/creation/authored-nodes.ts`
- `packages/test-runner/src/flow-lane/creation/tests/artifact-screen.test.ts` (new)
- `docs/architecture/testing-facility.md`
- this report

Validation: `pnpm --filter @fluxiq-web-extension/test-runner test` -> `# tests 1725 # pass 1725 # fail 0`.
