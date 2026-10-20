# Lane S-D5 (t728): the Lab reads Core's run accounting and stops rebuilding it

Worker report for brief D5 (audit finding 6). Tree:
`C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQWebExtension`. Core
`C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQ` was only read, never edited or
rebuilt. Nothing was committed, and no live or paid run was made.

## Outcome

Done. The brief's checks could not run exactly as written, because the domain
package is broken by another worker's uncommitted edits (see "Commands run").
I ran the same checks a different way, described below:

- The test-runner typecheck: no errors in any file of this package.
- The compiled tests beside my changes: 266 of 266 passed.
- The structure audit: no violations in my files.

## What changed and why

Paths are relative to `packages/test-runner/src/`.

### Deleted

These were the Lab's own rebuild of figures Core now publishes:

- `live-llm/run-spend.ts`
- `live-llm/step-log-spend.ts`
- `live-llm/step-log-instructed.ts`
- their three tests in `live-llm/tests/`

### Reading the Flow's spend from Core

- **`existing-fluxiq-control/flow-spend.ts`** (new). This is the reader for
  Core's `get-flow-spend` answer: `flowSpendReading(value)` returns
  `ExistingFlowSpend | null`.
  - It refuses a malformed record rather than coercing it: a negative dollar
    amount, a count that is not a whole number, or `calls` present without
    `byPhase` (or the reverse).
  - Core's six phases are in `EXISTING_FLOW_SPEND_PHASES`.
  - It is exported through `existing-fluxiq-control/index.ts`, where I added
    one line and one comment line.
  - This file is in the reader directory of the control, next to the file the
    brief named. I put it there because `existing-fluxiq-control.ts` is at the
    800-line limit.
- **`existing-fluxiq-control.ts`**. Adds
  `getFlowSpend(projectId, flowId, bounds?)`, which calls `get-flow-spend`. It
  also re-exports the `ExistingFlowSpend` type. The file is now exactly 800
  lines; the limit fails only above 800.

### Turning Core's record into the snapshot fields

- **`live-llm/flow-spend.ts`** (new). `liveLlmRunSpend(spend, ceilingUsd, unknownBecause)`
  converts Core's record into the shape the snapshot and the ledger already
  read. It adds up nothing Core did not publish.
  - `source` says where the figures came from:
    - `flow_purse`: an itemised record.
    - `flow_purse_unitemised`: a total only. `calls` and the phases are `null`.
    - `no_record`: Core holds no record. Every figure is `null`.
    - `flow_unknown`: the Lab could not tell which Flow the run built.
    - `unreadable`: the read failed.
    - `not_settled`: nothing has settled yet.
  - `calls`, `totalEstimatedCostUsd` and `builds` are Core's figures, or `null`.
  - `phases` has the keys `build`, `read`, `judge`, `runtime`, `reauthor` and
    `chat`. A phase that spent nothing is `null`.
  - `perBuild` keeps its existing field names. It has one `flow` entry, judged
    once against the ceiling. `parts` lists one entry per phase, plus
    `unattributed` for spend the record held before Core started itemising.
    When the cost is unknown, the `flow` entry has `estimatedCostUsd: null`, so
    `scripts/lab/live-campaign/row/build-spend.mjs` counts the run as
    `unrecorded`.
- **`live-llm/spend-reader.ts`** (new). `LiveLlmFlowSpendReader` works out which
  Flow the run spends on and reads that Flow's spend.
  - **How it finds the Flow.** In a direct build and in the playback, the Flow
    is named by `buildAuthorizer` or `repairAuthorizer`, and again by the run
    detail's `summary.flowId`. A chat build names no Flow, so
    `chatBuildAuthorizer` lists the project's Flows before the chat is sent.
    At settlement the reader takes the one Flow the project gained, leaving out
    Subflow graphs (the same rule as `chat-thread.ts` `projectFlowIds`).
  - If there is no new Flow, or more than one, the result is `flow_unknown`.
  - It never raises an error. A failed read comes back as `unreadable`.
  - It only lists Flows when the control can also read spend, so
    `tests/environment.test.ts` still passes unchanged.

### Changes to the live run

**`live-llm/live-llm-run.ts`**:

- The Flow's spend is read from Core (`refreshSpend`) before each snapshot is
  written:
  - in `settleBuild`;
  - in `settleRepair`, after the run detail has named the Flow.
- `usage.calls` is Core's call count. Where Core kept no itemised record, it is
  instead the calls Core's build record and the playback's run detail reported:
  a lower bound, not a total. I did this because `LlmUsage.calls` must be a
  number.
- `withoutResultChecks` (the repair's own figures) takes the purse's `runtime`
  phase when the record is itemised, and the run detail's own figures when it
  is not.
- A build's instructed consequences come from Core's build record only. The
  step log is no longer read for them.
- `LiveLlmRunDetailReader` now also requires `getFlowSpend`.
  `run-scenario.ts` passes the full control client, so it compiles unchanged.

### Other source changes

- **`live-llm/build-usage.ts`**. When the build record has no call count, the
  calls come from the purse: `build`, `read` and `judge` at the time the build
  settles. This replaces the step log's `byPart.creation`.
- **`live-llm/reauthor-record.ts`**. An attempt's `calls` is read first from the
  attempt record (`callsFrom: "attempt"`, which Core added in t728).
  - The `loop_decisions` source, which treated the decision count as the call
    count, is removed.
  - `loop`, `adaptation`, `adaptation_unreadable` and `not_recorded` remain.
- **`flow-lane/creation/build-proposal.ts`**. On the refusal path,
  `createdFlowBuildFromDiagnostic` sets `instructedConsequences` from the
  diagnostic's `instructedConsequences`, as `{ consequence, quote: null }`.
  - Core keeps classes only, never the person's words, so there is no quote.
  - The type of that field's `quote` is now `string | null`.
  - It is still `null` when the diagnostic names no consequences.
- **`live-llm/call-rows.ts`** is kept. It lists one row per call from the step
  log. It does not build totals: its only use of a count is the
  `perCallRecords`/`unrecordedCalls` comparison. I changed its comments only.
- **`live-llm/index.ts`**. The barrel now exports `flow-spend.js` and
  `spend-reader.js` instead of the three deleted modules. Nothing outside
  `live-llm/` imported them.

### Tests

- New:
  - `live-llm/tests/flow-spend.test.ts`
  - `live-llm/tests/spend-reader.test.ts`
  - `live-llm/tests/flow-purse.ts` (a support file that builds an
    `ExistingFlowSpend`)
  - one `get-flow-spend` case in `tests/existing-fluxiq-control.test.ts`
  - one diagnostic case in `flow-lane/creation/tests/build-proposal.test.ts`.
    It covers the balance code and the instructed classes.
- Reworked:
  - `live-llm/tests/live-llm-run.test.ts`. The fake Core now has a settable
    purse. The step-log tests became two kinds of test: Core-record tests, and
    tests that unknown spend is reported as unknown.
  - `live-llm/tests/canonical-judge-spend.test.ts`
  - `live-llm/tests/call-rows.test.ts`
  - `live-llm/tests/build-usage.test.ts`
  - `live-llm/tests/reauthor-record.test.ts`

### Field names (nothing a script reads was renamed)

- **Kept**, where a name's source changed but the name did not:
  - `observed.calls`, `observed.totalEstimatedCostUsd`, `observed.phases` and
    `observed.perBuild`, with `ceilingUsd`, `builds[].{phase, attempt, estimatedCostUsd, overCeiling}`,
    `parts[]`, `maxBuildCostUsd` and `overCeiling`.
  - `runSpend.{calls, totalEstimatedCostUsd, phases, perBuild}`.
  - The settle event's `runTotal.{calls, totalEstimatedCostUsd, buildsOverCeiling, perBuildCeilingUsd}`.
  - `instructedConsequencesFrom`.
- **Can now be `null`** where Core holds no figure:
  - `observed.calls`, `observed.totalEstimatedCostUsd`, `runSpend.calls`,
    `runSpend.totalEstimatedCostUsd`, `runTotal.calls`,
    `runTotal.totalEstimatedCostUsd` and `perBuild.maxBuildCostUsd`.
  - The scripts already fall back when they meet `null`:
    - `run-outcomes.mjs` `costOf`
    - `reported-spend.mjs` `withRunSpend`
    - `build-spend.mjs`
    - `adversarial/measurement.mjs`
    - `summarize-task.mjs`
- **Removed** (no script reads them):
  - `runSpend.uncountedPhases` and `runTotal.uncountedPhases`.
  - `runSpend.stepLog`, which held `filledReauthorCalls`, `unattributed`,
    `fromBuild`, `largestInputTokens` and `byRole`.
  - The `reauthor` per-attempt entries in `perBuild.parts`. There is now one
    `reauthor` part.
- **Added**:
  - `runSpend.source` and `runSpend.builds`.
  - `runTotal.spendSource`, present only when the record is not itemised.
- **Changed value**:
  - A phase that spent nothing is `null`. Before, `runtime` read `{calls: 0, estimatedCostUsd: 0}`.
  - `instructedConsequencesFrom` is never `"step_log"` now. `"proposal"` means
    Core's build record: its proposal, or its failure diagnostic.

## Commands run and observed results

All commands were run in the tree above.

1. `pnpm --filter @fluxiq-web-extension/test-runner check` failed before it
   reached this package. Its `domain:build` step failed with TS2305/TS2459/TS2345
   errors:
   - `domain/src/runtime/llm-evidence/node-run/held-literals/memory.ts(43)`
     imports `webNodeOpensBuild` and `WebNodeBuildKey` from `../arrival`, which
     does not export them.
   - `node-run/own-layers/memory.ts(51)` has the same import.
   - `node-run/run.ts` (lines 154–774) has `WebNodeBuildKey` shape mismatches.
   - `llm-evidence/tools.ts(336, 343)`.

   These are another worker's uncommitted domain edits (`git status` shows
   `node-run/arrival.ts` modified and `node-run/build-state/` untracked). I did
   not touch them. The failed build left `domain/dist` re-emitted with
   extensionless specifiers.
2. `npx tsc -p tsconfig.json --noEmit` in `packages/test-runner`, run directly,
   gave the same domain-caused errors in other files and no error in any of my
   files.
3. To typecheck and run tests, I ran `node domain/scripts/rewrite-dist-specifiers.mjs`.
   This is the domain build's own last step. It printed "2040 specifier(s) in
   671 file(s)". This changes generated output only, and the next domain build
   cleans and rebuilds it.
4. After that, `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`
   in `packages/test-runner` exited 2 with exactly 2 errors, both in
   `domain/dist/runtime/llm-evidence/node-run/{held-literals,own-layers}/memory.d.ts`
   (the other worker's). There were no errors in `packages/test-runner/src`.
5. `node ../../scripts/build-cache/cli.mjs test-runner:build` emitted `dist`.
   It is not stamped, because tsc exits 2 on those two domain errors.
6. Running the compiled tests against the tree's `domain/dist` cannot work:
   - `node --test dist/live-llm/tests/*.test.js` printed 95 passed and 8 failed.
   - Every failing file fails at load: "The requested module '../arrival.js'
     does not provide an export named 'webNodeOpensBuild'". That is the other
     worker's domain again.
7. So I built the domain from `HEAD` in my scratchpad:
   - `git archive HEAD domain tsconfig.base.json`, then a junction to the real
     `domain/node_modules`.
   - `tsc` exited 0, and `rewrite-dist-specifiers` ran.
   - I ran the tests with a scratch loader hook that redirects only
     `@fluxiq-web-extension/domain/node` to that build.
   - Afterwards I removed the scratch copy, unlinking the junction first. The
     real `domain/node_modules` is intact.
8. With that loader, `node --import <loader> --test dist/live-llm/tests/*.test.js dist/flow-lane/creation/tests/build-proposal.test.js dist/tests/existing-fluxiq-control.test.js dist/flow-lane/creation/tests/lane.test.js dist/flow-lane/creation/chat/tests/*.test.js dist/tests/environment.test.js`
   printed `# tests 266  # pass 266  # fail 0` on each of the last two runs.
   - Before the last rebuild, my new build-proposal case failed once. The cause
     was that Core's diagnostic parser rejects an `accounting` that has no
     `requestId` or `estimatedInputTokens`. I fixed the fixture.
   - I confirmed the parser's behaviour directly against Core's built
     `parseAutomationStudioFlowBootstrapFailureDiagnostic`:
     - It accepts `flow_bootstrap.provider_balance_exhausted` with
       `instructedConsequences: ["modify_existing","create_new"]`.
     - It rejects the same classes in the reverse order.
9. `node scripts/structure-audit.mjs`, final run:
   `structure-audit: 1 violation(s) across 1 rule(s)`, which is
   `domain/src/runtime/llm-evidence/node-run/run.ts: 801 lines`, the other
   worker's file. An earlier run listed 8 violations, all under `domain/src`.
   There are no violations in my files, only advisory warnings:
   - `existing-fluxiq-control.ts` is at 800 lines.
   - `LiveLlmRun` has 26 methods.
   - `live-llm/` has 24 files.
10. I converted the line endings of the files I edited back to LF. My Python
    edit scripts had written CRLF. I re-checked them with
    `grep -c $'\r'`, which gave 0.

## Not verified

- **No live run.** I have not seen a real run's `get-flow-spend` answer, and I
  have not seen the chat-build Flow discovery work against a real Core. It is
  covered only by `spend-reader.test.ts` with a fake `list-flows`.
- **Coverage of the result check.** Core's record covers the post-run result
  check only if Core's runtime-session Flow purse wraps result verification.
  The S-A report says both purse entry points itemise with the `judge` flag; I
  did not trace it in Core.
- **The tree's own domain.** The tests ran against a domain built from `HEAD`,
  not against this tree's in-progress domain, which does not load. Any file of
  the package that needs the other worker's new domain exports was not
  exercised.
- **The brief's exact commands.** `pnpm --filter @fluxiq-web-extension/test-runner check`
  never completed (cause above).
- **The scripts.** They were not run. Their reading of the new `null` figures
  was checked by reading the code only.

## Open questions or contradictions found

1. **Lost diagnostics.** `step-log-spend.ts` also gave `runSpend.stepLog.largestInputTokens`
   and `byRole` (the per-agent and per-brief tallies of a project build that
   A8 compares). Deleting the file as the brief asked removed them, and Core's
   purse has no equivalent. If A8 still needs them, either Core publishes them
   or a small step-log reader that only lists them comes back.
2. **`instructedConsequencesFrom`'s union is in `flow-lane/creation/lane.ts`,
   which I do not own.** Suggestion: change `"proposal" | "step_log" | null` to
   `"proposal" | "failure_diagnostic" | null`, and set
   `instructedFrom = build.outcome === "proposed" ? "proposal" : "failure_diagnostic"`
   in `live-llm-run.ts` `settleBuild`.
3. **For lane H (`scripts/**`, not edited):**
   - `scripts/lab/live-guards/balance-failure.mjs` `detectBalanceFailure`:
     before `if (status !== 402 && match === null) continue;`, add
     `const coreCode = typeof provider.code === "string" ? provider.code : null;`
     and change the condition to
     `if (status !== 402 && match === null && coreCode !== "flow_bootstrap.provider_balance_exhausted" && coreCode !== "llm.provider_balance_exhausted") continue;`,
     with `evidence` reading `coreCode` when it matched by code.
     - The sidecar already records Core's code in `provider.code`
       (`provider-failure-record.ts` reads `diagnostic.code`), and
       `step-log-outcome.mjs` already passes the step log's `meta.error.code` as
       `provider.code`.
     - So that one edit covers both files, with no sidecar type change. Core's
       new safe message ("balance is exhausted") does not match `BALANCE_TEXT`,
       so without this a balance failure is caught only by its 402 status.
   - `scripts/lab/live-guards/step-log-outcome.mjs` header: replace the mention
     of `live-llm/step-log-spend.ts` (deleted). It now counts on its own, for a
     run killed before `finalize`.
   - `scripts/lab/live-campaign/row/reported-spend.mjs:29`: change "`run-spend.ts`"
     to "`flow-spend.ts`, Core's Flow purse".
   - `scripts/lab/live-campaign/row/summarize-task.mjs:39` adds
     `repair.observed.calls` to `observed.calls`. `observed.calls` has been the
     whole run's total since before this change, so the runtime calls are
     counted twice. This is an existing issue, worth a check.
4. **Docs, not edited (not owned):**
   - `docs/architecture/testing-facility.md` lines 2120–2131 describe the step
     log reconstruction and the request-id matching of result checks. They
     should say the totals are Core's Flow purse (`get-flow-spend`, by phase),
     unknown when Core holds no itemised record.
   - Lines 2133–2141 (`largestInputTokens`/`byRole`) describe a field that no
     longer exists.
   - Lines 2154–2158 list `loop_decisions`. Replace it with `attempt`, the
     count Core writes on a failed attempt.
   - The comment at `run-scenario.ts:153` names `live-llm/step-log-spend.ts`.
     It should say the step log gives the per-call rows (`call-rows.ts`).
5. **Generated output I changed.** `domain/dist` now holds the other worker's
   failed build with rewritten specifiers. It is generated, and their next
   `domain:build` cleans it. Whoever owns `domain/src/runtime/llm-evidence/node-run/*`
   must make the domain build pass before any narrow check of this package can
   run as written.
