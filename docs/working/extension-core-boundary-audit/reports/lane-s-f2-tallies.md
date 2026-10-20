# Lane S-F2 (t728 follow-up 2): Core publishes the largest input and role tallies; the Lab reads them

Worker report for brief F2. Trees: Core `C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQ` and
downstream `C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQWebExtension`, both on
`task/t728-single-sources-telemetry`. Nothing committed; no live or paid run.

## Outcome

Done. Core's Flow spend record and `get-flow-spend` now carry `largestInputTokens` and `byRole`.
The Lab reads them and writes them to the snapshot as `runSpend.largestInputTokens` and
`runSpend.byRole`. Every check the brief names passed (results below), and Core dist was rebuilt.

## What changed and why

Core paths are relative to `packages/fluxiq/src/programs/automation-studio/` (AS).

### Core

- `runtime/llm/build-purse/types.ts`: `onSettled(chargedUsd, call: { judge: boolean; inputTokens: number | null })`.
  Callers with one argument still compile.
- `runtime/llm/build-purse/settlement-ledger.ts`: settle passes `inputTokens`, which is the
  settled usage's `inputTokens` when it is a whole number of 0 or more, and otherwise `null`. This
  is the same `usage` the purse already prices from, and the same figure the step log writes as
  `meta.usage.inputTokens`.
- `runtime/flow-bootstrap/creation-spend/record.ts`: adds two optional fields:
  - `largestInputTokens?: number | null`
  - `byRole?: Record<string, {calls, usd}> | null`
- `runtime/flow-bootstrap/creation-spend/parse.ts`:
  - Both fields always parse as present.
  - Each is `null` when it is absent or `null`, so older records read with both `null`.
  - A role key must be an identifier (`/^[a-z][a-z0-9_-]{0,63}$/`), and each item has the same
    checks as a phase item.
  - It refuses a record that has either field non-null without `byPhase`.
- `runtime/service/creation-spend.ts`:
  - `add` takes `role?` and `inputTokens?` (a non-integer token count throws).
  - An itemised addition (one with a `phase`) can raise `largestInputTokens`, and it grows
    `byRole[role]` when a role is given.
  - In `withFlowPurse`, `onSettled` reads `automationStudioLlmStepLogScope.current()` once, then
    passes `phase`, `role: scope?.role` and `inputTokens: call.inputTokens`.
  - The role names are the ones the step log writes: supervisor, builder, repair and validator.
  - A call that names no agent counts toward no role, so `byRole` is `{}` for a candidate build.
    `step-log-spend.ts` behaved the same way.
- `api/contracts/run.ts`: `FlowSpend` gains `largestInputTokens: number | null` and
  `byRole: Record<string, FlowSpendItem> | null`.
- `api/handlers/runs.ts`: the `get-flow-spend` handler publishes both, as `null` when the record
  lacks them. The brief did not name this file, but publishing the fields needs it.

### Lab (`packages/test-runner/src/`)

- `existing-fluxiq-control/flow-spend.ts`: this is outside `live-llm/**`, but `flowSpendReading`
  drops unknown fields, so `live-llm/` could not see the new fields without this edit.
  - `ExistingFlowSpend` gains `largestInputTokens` and `byRole`.
  - Both read as `null` when absent, so an older Core still parses.
  - It refuses malformed values: a token count that is not an integer, a free-text role key, a
    negative cost, or either field on a record that is not itemised.
- `live-llm/flow-spend.ts`:
  - `LiveLlmRunSpend` gains `largestInputTokens: number | null` and
    `byRole: Record<string, LiveLlmRoleSpend> | null`, where
    `LiveLlmRoleSpend = { calls, estimatedCostUsd }` (rounded to the nano-dollar).
  - `liveLlmRunSpend` maps Core's figures. Where there is no record, both are `null`.
  - The snapshot writes `runSpend` whole (`live-llm-run.ts:615`), so both reach
    `snapshots/live-llm.json` with no change to `live-llm-run.ts` or `spend-reader.ts`.
- `live-llm/index.ts`: exports the `LiveLlmRoleSpend` type.

### Tests

- Core:
  - `creation-spend/tests/parse.test.ts`: a record without the fields reads as nulls, a tallied
    record round-trips, and 7 new refusal cases.
  - `build-purse/tests/settlement-ledger.test.ts`: `onSettled` receives `inputTokens`, or `null`.
  - `service/tests/creation-spend-itemised.test.ts`:
    - Supervisor and builder scopes give `byRole` `{supervisor:{1,0.002}, builder:{3,0.006}}`.
      A judge call that names no role is in no role.
    - The largest input is 30000 and persists.
    - Without usage, the figure is `null` and the roles are `{}`.
  - `api/handlers/tests/runs.test.ts`: covers the published fields and their keys, and nulls for
    an unitemised record.
- Lab:
  - `live-llm/tests/flow-spend.test.ts`: a new case covering project, candidate and older records.
    The unknown-source case asserts both fields are `null`.
  - `live-llm/tests/live-llm-run.test.ts`: a new snapshot case checks
    `runSpend.largestInputTokens` and `runSpend.byRole`. The existing case asserts both are `null`.
  - `live-llm/tests/flow-purse.ts`: the support file takes the two optional totals.
  - New `existing-fluxiq-control/tests/flow-spend.test.ts`: reads, nulls and refusals.
  - `tests/existing-fluxiq-control.test.ts`: the two existing `deepEqual`s now include the null
    fields.

## Commands run and observed results

- Core, from `packages/fluxiq`:
  - `npx vitest run` on `creation-spend/tests`, `llm/build-purse/tests`,
    `service/tests/creation-spend{,-itemised}.test.ts` and `api/handlers/tests/runs.test.ts`:
    13 files passed, 104 tests passed.
  - `npx vitest run` on the three `scripts/task/contract/list.mjs` tests (system-prompt,
    extraction-vocabulary, issue-feedback) plus 11 neighbouring spend tests (result-verification
    flow-purse/verify/split-no-route, creation-purse, candidate-unusable-reply, runtime-adaptation
    flow-spend/refuted-result-port/step-failure-port, in-run-repair, flow-purse-chain,
    service-bootstrap creation-spend): 14 files passed, 178 tests passed.
- `pnpm --filter fluxiq check` printed `check exit 0`.
- `node scripts/structure-audit.mjs` (Core) printed `structure-audit: passed (417 warning(s), 1152 baselined).`
- `pnpm --filter fluxiq build` printed `build exit 0` on the first run (`fluxiq:build` "no stamp;
  stored ... 9310 file(s)"). No collision.
- `pnpm --filter @fluxiq-web-extension/test-runner check` printed `core-build: ... current with its source`
  and then `check exit 0`.
- `node ../../scripts/build-cache/cli.mjs test-runner:build` printed "waited 26.3s for pid 39940's
  run of this step, then inputs and outputs match the stamp". Another process was building at the
  same time. I confirmed my new code is in `dist` with `grep -c largestInputTokens` on the four
  dist files: 6, 3, 5 and 4.
- `node --test dist/live-llm/tests/*.test.js` printed `# tests 143 # pass 143 # fail 0`, including
  "ok 61 - Core's largest input and role tallies ..." and "ok 96 - the snapshot carries Core's
  largest call input and per-role spend".
- `node --test dist/existing-fluxiq-control/tests/flow-spend.test.js dist/tests/existing-fluxiq-control.test.js`
  printed `# tests 28 # pass 28 # fail 0`.
- `node scripts/structure-audit.mjs` (downstream) printed `structure-audit: passed (208 warning(s), 625 baselined).`

## Not verified

- No live run. I have not seen a real project build write role tallies, and I have not seen a
  real DeepSeek usage reach `onSettled`. The usage path is the one the purse already prices from,
  and the tests cover it only with fake usage.
- Like the phase, `byRole` depends on the step-log scope, which is kept only while
  `FLUXIQ_LLM_STEP_LOG_DIR` is set. Every Lab run sets it. When it is unset, `byRole` stays `{}`.
  `largestInputTokens` does not depend on the scope.
- The full suites and `pnpm check` were not run, as the brief directed.

## Open questions or contradictions found

1. **Shape differs from `step-log-spend.ts`.** The old role entry was
   `{calls, estimatedCostUsd, largestInputTokens, byBrief}`. The brief gives Core's `byRole` as
   `{calls, usd}`, so the Lab's entry is `{calls, estimatedCostUsd}`, with no per-role largest
   input and no `byBrief`. If A8 needs those, Core can tally them the same way: `scope.briefId`
   is already in the scope.
2. **Location.** The old fields were at `runSpend.stepLog.{largestInputTokens, byRole}`, and
   `runSpend.stepLog` was removed in D5. They are now at `runSpend.largestInputTokens` and
   `runSpend.byRole`. No script in `scripts/` reads either name (grep found none). The A8 plan
   text (`docs/working/automation-project-agents-plan.md:309`) and lane S-G's
   `testing-facility.md` paragraph still name the old path or say the fields are gone.
3. **Unknown and empty are different values.** The fields are `null` when there is no record or
   the record is unitemised. Before, a missing step log gave `{}` and `null`. An itemised record
   whose calls named no agent gives `byRole: {}`.
4. **An itemised record from before this change** gains role tallies only from the change onward,
   so its `byRole` can sum to less than its spend. `byPhase` has the same caveat.
5. **Files outside the brief's list:** I edited `AS/api/handlers/runs.ts`,
   `test-runner/src/existing-fluxiq-control/flow-spend.ts` and
   `test-runner/src/tests/existing-fluxiq-control.test.ts`, and added
   `existing-fluxiq-control/tests/flow-spend.test.ts`. The reason for each is given above.
6. **Line endings.** Core `creation-spend/record.ts` was CRLF in the working tree; its index copy
   is LF and `core.autocrlf=true`. I kept each file's existing line endings.
