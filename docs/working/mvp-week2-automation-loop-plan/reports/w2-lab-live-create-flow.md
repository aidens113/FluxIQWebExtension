# w2-lab-live-create-flow — a live "build a Flow from an instruction" lane for the Testing Lab

Worker report, 2026-09-16. I made no live provider calls, ran no command
without `--dry-run`, and did not start the persistent demo workspace. All
evidence below comes from tests and a provider-free dry run.

## Outcome

**Done, with one thing not proven: the live run itself, which the brief kept
for the supervisor.**

`pnpm lab run <scenario> --live-llm --llm-task create-flow --instruction-task <id> ...`
now works as follows, inside the isolated setup the Lab already owns:

1. It picks one task from the instruction catalog (`LIVE_INSTRUCTION_TASKS`).
2. It opens the scenario page and pairs the extension. There is no recording.
3. It creates a new, blank Flow in the run's own project.
4. It asks Core to explore the page and propose a Flow, using the same calls
   the web panel's "Explore and create proposal" button makes:
   - save the instruction;
   - install the key and save the Flow's LLM settings;
   - take out a `build_and_adapt` grant;
   - call `generate-flow-bootstrap-adaptation` with `evidenceGuided: true`.
5. It records what the build spent and holds it to its caps.
6. It approves and applies the proposal.
7. It resets the page state, reloads the page, and runs the created Flow
   deterministically (no model involved in the run).
8. It judges the result:
   - a **form** task passes only if the scenario's playback-goal facts hold;
   - an **extract** task passes only if the records the run stored match the
     scenario's expected dataset. A Flow that navigates but stores wrong
     records, or none, fails.

The run's evidence bundle records the build's provider usage, what happened to
the proposal, and the created Flow's shape. The shape is recorded as action
types and counts only, including extraction and navigation nodes.

The lane fails closed, and a test covers each case:
- **no credential:** refused before anything starts;
- **not an isolated target:** refused before anything starts;
- **with `--flow`:** refused;
- **a build that reached no provider:** fails, after its evidence is written;
- **a build over its budget, or on another model:** fails;
- **a build Core refused:** its usage is recorded, then the run fails with
  Core's code and nothing is applied.

**First live command to run.** Use the dry run first. It needs the key only to
confirm it is there, makes no provider call, and starts nothing:

```
pnpm lab run instruction-only-form --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-chat --llm-task create-flow --instruction-task instruction-only-form-submit --llm-max-output-tokens 4000 --llm-max-total-tokens 12000 --dry-run
```

Then the same command without `--dry-run`. That is the first live run.

- **Why these token limits:** 4,000 output and 12,000 total per call match the
  web panel's exploration profile. With the default 2,000 output tokens, a
  whole Flow plan may be cut off.
- **What the run is allowed to spend:** up to 26 calls (Core's default for a
  run that iterates), 100,000 tokens across the whole run (so no high-token
  confirmation is needed), and at most $0.25 per call, capped at $2 for the
  run.

**Good first targets, in order** (task id → scenario):

1. `instruction-only-form-submit` → `instruction-only-form`. A form task,
   judged by the playback goal. The scenario was built for this.
2. `product-catalog-first-page` → `product-catalog`. A one-page scrape,
   judged by dataset `extract-page-one`.
3. `data-table-inventory` → `data-table`. A table scrape, judged by dataset
   `extract-inventory`.
4. `identity-drift-rename` → `identity-drift`. A form task, judged by the
   playback goal.
5. After those pass: `product-catalog-all-pages`, a scrape across pages, and
   `identity-drift-rename-moved-save`, a form on a drifted variant.

**`basic-form` cannot be a target.** It declares neither a playback goal nor
an expected dataset, so it has no catalog task and nothing to judge a created
Flow by. The catalog worker reports the same gap.

**Confirmed for the campaign runner.** Any `--llm-profile` id works, so
`lab-create-flow` is fine.

**Accepted with `create-flow`, and no `--flow` needed:**
- **`--variant`:** it must match the task's own variant. A different variant,
  or a variant on a task that has none, is refused.
- **`--workflow`:** optional. It must be the workflow that extracts the task's
  dataset.
- **`--instruction-task`:** optional. Without it, the scenario's first task is
  used.

**Declared secrets reach a created Flow the same redacted way the recorded
lane uses.** This covers `auth-gate-account-summary`. Each value comes from its
`FLUXIQ_TEST_SECRET_*` variable, goes to Core only as a run input under the
path the node asks for, and is added to the run's redaction list. Only the
secrets whose step is in the task's own workflow are required.

## What changed and why

All changes are in `packages/test-runner/src`. Nothing in `F:\!FluxIQ`,
`domain/src`, `docs` (apart from this report), the demo files or the scenario
manifests was touched.

### New: `flow-lane/creation/` (the lane, one job per file)

| File | What it does |
| --- | --- |
| `instruction-task.ts` | Reads the catalog's shape and checks each entry. It does not depend on scenario-lab source. Any bad entry rejects the whole catalog as `fixture.invalid`, naming the entry and field but never quoting the instruction. It rejects: unknown fields; ids that are not kebab-case; unknown `kind` or `judgeBy`; instructions over 4,000 characters or containing control characters; a dataset task with no `expectedDatasetId`; a goal task with one; an extract task judged by a goal; duplicate ids. `selectLiveInstructionTask` picks the named task (which must belong to the run's scenario), or the scenario's first. |
| `instruction-catalog.ts` | Loads `<scenario lab build>/scenarios/live-instructions.js`, the same way the scenario registry is loaded. A missing build is `environment.missing`; a module that does not export `LIVE_INSTRUCTION_TASKS` is `fixture.invalid`. |
| `request.ts` | Decides, before any Core or grant exists, what the run builds and how it is judged. A goal task uses the primary workflow and needs a declared playback goal. A dataset task finds the workflow whose script extracts `expectedDatasetId`; 12 of the 31 catalog dataset tasks are in secondary workflows. Refused as `fixture.invalid`: an unknown variant or dataset; a dataset extracted by several workflows; an expected dataset with no count or records; a workflow expected to fail; a `--variant` that differs from the task's. `describeCreatedFlowRequest` is what the dry run prints: ids, the instruction's length and hash, never its text. |
| `blank-flow.ts` | Creates the Flow through Core's `create-flow`, which chooses the id. It then checks the Flow is blank, as Core's bootstrap requires: no nodes or edges, an orchestration Flow, no Subflow, no Router. A Core that seeds new Flows fails here, before a grant is taken. |
| `build-proposal.ts` | The paid step. Order: save the instruction, authorize, select the project, then call the build. Every answer becomes a `CreatedFlowBuild` record: outcome, provider calls, whether a provider was attempted, token and cost totals, evidence-loop counts, and a failure code. **Refusals** are parsed with Core's own `parseAutomationStudioFlowBootstrapFailureDiagnostic`. A body that parser rejects keeps only its HTTP status. **Timeouts:** Core may keep building for up to 675 s, but the client's per-request cap is 300 s. A request that hits that cap is not treated as a failure: the lane polls for the pending proposal until the deadline, as the web panel does. **Proposals** that cannot be shown to be what was paid for are failed records, not Flows: not a pending bootstrap, no evidence audit, no call count, or no page evidence. |
| `review-proposal.ts` | Approve, then apply, through `review-flow-adaptation`. An apply that reports no change fails. |
| `flow-shape.ts` | Maps each node to the output it dispatches, from `parameterValues.outputId` or, for bootstrap nodes whose output is fixed, `metadata.outputActionId`. Counts nodes, action nodes, action types, extraction nodes and navigation nodes. An output name that does not look like an output id is counted as `(unrecognized)` and never copied. A Flow with no action node fails before it runs. |
| `secrets.ts` | `resolveCreatedFlowSecrets` requires only the declared secrets whose step is in the task's workflow. `createdFlowSecretInputs` reads secret requests from either parameter layout (nested for policy-action nodes, flat for domain output nodes). It pairs them with declared secrets through the existing one-to-one `declaredSecretBindingInputs`, and refuses a Flow that asks for a file. A pairing failure is refiled as `runtime.behavior`, because here it means the created Flow did not ask for the secret as declared. |
| `judgement.ts` | Judges a dataset task with the recorded lane's `judgeFlowExtraction` and `assertFlowExtraction`, against the one extract step the task names. The measurement keeps that step's real position in its workflow. A Flow with no extract node fails as exactly that, and the dataset result is the run's oracle verdict. |
| `lane.ts` | `runCreatedFlowLane` puts the steps above in order (see Outcome). It publishes what it observed before judging, as the recorded lane does, so a failing run still records its measurement. |
| `snapshot.ts` | Writes `snapshots/flow-lane.json` with `lane: "created-flow"` and these fields: `task` (the dry-run description), `build`, `review`, `flowId`, `flowShape`, the run's status and failure, and `extraction`. The `actions` array keeps the recorded lane's shape so the evaluation's evidence-size reader still works. It never includes selectors, page text or values; a test checks this. |

### Changed

- **`live-llm/live-llm-plan.ts`:** `create-flow` now plans a `build_and_adapt`
  grant that iterates, with the operator's call count (default 26, Core's
  default). `refine-recording` and `edit-flow` are still refused.
- **`live-llm/live-llm-run.ts`:**
  - `beginLiveLlmRun` refuses `--flow` with `create-flow` and still requires
    it for every other task. The target and credential refusals are unchanged.
  - New `createsFlow`, `assertLane`, `describe` (used by the dry run; it never
    includes the key), and `buildAuthorizer`.
  - The runtime `authorizer` refuses a build grant, and `buildAuthorizer`
    refuses a runtime grant.
  - `settle` was split so `settleBuild` can reuse it. `settleBuild` writes
    `snapshots/live-llm.json` with an added `build` block, runs the same
    budget and provider-reached checks, and fails a build that Core reports
    ran on another provider or model.
- **`live-llm/build-usage.ts` (new):** turns a build record into the usage
  shape those checks already use.
  - **Call count:** Core's count. Where Core gives none, the build counts as
    1 call if a request was sent or its state is unknown, and 0 only if Core
    says it never sent one.
  - **Per-call records:** `"not recorded"`, with `observedCalls: []`.
  - **When no provider was reached:** the record carries Core's stage and
    code, and the refusal message quotes them.
- **`existing-fluxiq-control.ts`:** new `generateFlowBootstrapAdaptation`,
  which returns Core's whole response on failure so the diagnostic is not
  lost. The file's deliberate NUL byte was preserved: I inserted 18 lines by
  splicing bytes with a script that checked the NUL count (1 before, 1 after)
  and the byte length; `git diff` shows 18 insertions and no deletions.
- **`commands.ts`:**
  - `run` accepts `--instruction-task <id>` and `--dry-run`, but only with
    `--llm-task create-flow`.
  - `--dry-run` takes no value and may appear anywhere.
  - `create-flow` refuses `--flow` and accepts `--variant` without it. For
    every other task, `--variant` still requires `--flow`.
  - `matrix` refuses `create-flow` and points to `lab run`.
- **`cli.ts`:**
  - **Order of checks:** the live-run refusals come first (plan, lane,
    target, credential), then the request is resolved. So a missing key is
    reported before a missing catalog.
  - **With `--dry-run`:** prints `{status: "ready", providerCallCount: 0,
    lane, target, request, live}` and exits 0.
  - **Otherwise:** passes the request, with its workflow and variant, into
    `runScenario`.
- **`run-scenario.ts` (792 lines, under its 800-line limit):**
  - **New `else if (creation)` branch:** no Core probe and no recording.
  - **Shared hook factory `flowRunHooks`:** used by both Flow lanes to prepare
    the page, publish evidence and check the final state. It replaced about
    28 inline lines.
  - **Room made by moving code:** `probeOutcome` moved into
    `flow-lane/lane-observation.ts` as `recordingLaneProbeObservation`, which
    that file's own comment had asked for.
  - **`flowLane` now covers created-Flow runs.** A created-Flow run always
    bootstraps a Core identity and is checked for a built Flow.
  - **Arming a variant:** `armingOf` treats a created-Flow run like the
    recorded Flow lane ("arms after loading"). The first page load is
    unarmed; the lane arms and reloads before exploring and again before the
    run. So both the exploration and the created Flow see the task's variant,
    and the page-fact checks follow the same schedule.
- **`flow-lane/flow-action-types.ts`:** node records carry `outputActionId`
  when Core wrote one. The recorded lane's own action-type map is unchanged,
  and a test checks that.
- **`flow-lane/declared-secrets.ts`:** a test-id target now also pairs with a
  node whose selector is exactly `[data-testid="<id>"]`. That is how a created
  Flow names a control, since it has no recorded element. Looser forms still
  refuse, and a test checks that.
- **`flow-lane/expectations.ts`:** exports `EXTRACT_OUTPUT_IDS`.
- **`flow-lane/run-flow-lane.ts`:** exports `flowExtractionSnapshot`,
  `flowActionsSnapshot` and `assertFlowDidNotStopEarly` for reuse. Its output
  is unchanged.
- **`flow-lane/lane-observation.ts`:** adds `recordingLaneProbeObservation`.
- **Tests:**
  - **New:** eight files under `flow-lane/creation/tests/` (six test files
    and two support modules).
  - **Extended:** `live-llm-plan`, `live-llm-run`, `lane-observation`,
    `flow-action-types`, `declared-secrets`, `commands`, `cli-llm` and
    `existing-fluxiq-control`.
  - **`run-evaluation/tests/runner-wiring.test.ts`:** I updated two exact-text
    checks on `run-scenario.ts` from `flowLane: options.flow === true` to
    `flowLane`, and added a check that
    `const flowLane = options.flow === true || creation !== undefined;` is
    present. That file checks `run-scenario.ts`, which this brief gave me.
  - **`tests/scenario-assertions.test.ts`:** passes unchanged. I kept the
    hook parameter named `activeTopology` so its exact-text checks still hold.

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` (packages/test-runner): exit 0.
- **`pnpm test` (packages/test-runner):**
  - **Result:** `# tests 1056`, `# pass 1055`, `# fail 1`.
  - **The one failure:** `FIFO tickets prevent a later scheduler from
    overtaking an earlier waiter`, in
    `bench/campaign/machine-slots/tests/acquire-machine-cell-slot.test.js`.
    That is bench code I did not touch, and the failure was an unhandled
    rejection in a file-lock timing test.
  - **Rerun alone:**
    `node --test dist/bench/campaign/machine-slots/tests/acquire-machine-cell-slot.test.js`
    gave `# tests 16`, `# pass 16`, `# fail 0`.
  - **Before my tests existed:** the first full run gave 1013 tests, 1010
    passed and 3 failed. All three were mine and are fixed: the plan test,
    `runner-wiring` #489 and `scenario-assertions` #929. The coordinator's
    note about `tsc` failing at `live-llm-run.ts:75` was a mid-edit state;
    the type check has been clean since.
- `pnpm test` (packages/test-contracts): `# tests 97`, `# pass 97`,
  `# fail 0`, exit 0.
- **`pnpm check` (repository root):**
  - **First attempt:** died inside the test-runner type check with
    `Exit status 3221225477` and a bash `Segmentation fault`, this machine's
    known memory-fault signature.
  - **Rerun once, alone:** exit 0, including structure tests (96 passed),
    `lab:test` (24 passed), and
    `structure-audit: passed (59 warning(s), 17 baselined)`.
- **`node scripts/structure-audit.mjs` (run separately, earlier):**
  - **Result:** 2 failures, neither in my files.
    - The shared working document's Current State was 152 lines.
    - `docs/working/README.md` was out of date.
  - **Later:** someone else fixed both, and the audit inside the passing
    `pnpm check` above shows `passed`.
  - **My files:** the only findings are warnings, including `run-scenario.ts`
    at 792 lines.
- **Focused run** of the creation, live-llm, flow-lane, commands, cli-llm,
  control-client and wiring tests: `# tests 199`, 197 passed, 2 failed.
  - Both failures were my scenario fixture declaring an extraction with no
    count, which the scenario contract rejects.
  - After fixing it, the creation and CLI rerun gave `# tests 34`,
    `# pass 34`.
- **Negative probes** (script
  `scratchpad/w2-create-flow-probes.mjs`). Each probe broke one compiled
  behaviour, ran the tests that should notice, and restored the file,
  checked byte for byte.

  | Break | Tests that failed |
  | --- | --- |
  | Settlement no longer checks that a provider was reached | 1: "a build that reached no provider fails the run closed…" |
  | The lane no longer settles the build | 3: the happy path, "a refused build is settled…", and "a settlement that refuses… stops the lane" |
  | `create-flow` no longer refuses `--flow` | 2: the lane and target refusal test, and the lane-fit test |
  | A dataset task judged by the page oracle instead of its records | 2: the happy path, and "wrong records fails" |
  | Every transport failure treated as a build still running | 1: "a transport failure that is not a bounded wait…" |

  Afterwards, the restored build gave `# tests 35`, `# pass 35`.
- **Provider-free dry path:** covered by
  `tests/cli-llm.test.ts` → "a create-flow dry run resolves the task, plans
  the build grant and starts nothing".
  - **Setup:** `runCli` against a stub scenario-lab build, with a dummy key in
    the environment.
  - **Checks:**
    - exit 0, `status: "ready"`, `providerCallCount: 0`;
    - `purpose: "build_and_adapt"`, `maxCalls: 26`, token limits
      8000/4000/12000;
    - the key and the instruction text are not in the output;
    - no `test-runs` directory was created.
  - **Refusals covered:** a wrong `--variant`, and an unknown task.
  - **Not run by hand** against the real catalog: its command line contains
    `--live-llm`, and the brief barred those.

## Not verified

- **No live run, by instruction.** Everything about Core's real answers is
  untested against a real Core and DeepSeek. That covers:
  - whether `create-flow` needs the PIN I send;
  - whether evidence tools reach the paired extension's scenario tab;
  - whether a real proposal's nodes match what the lane reads
    (`outputActionId`, or nested versus flat parameters);
  - whether a created Flow runs to completion without the model.
- **The real catalog was not loaded end to end.** The loader and resolver
  were tested against a stub catalog and a stub scenario registry. The real
  catalog's shape matches my reader (36 tasks; kind and judgement pairs are
  7 form→goal, 14 extract→dataset, 16 navigate-and-extract→dataset). I did
  not import the real module.
- **Secrets on a real created Flow.** The pairing works only if the model
  writes the secret binding `{ $state: { path: "web.secret.<key>" } }` and
  names the control exactly `[data-testid="password"]`. Nothing I could check
  offline shows that Core's bootstrap prompt tells the model to do either, so
  expect `auth-gate-account-summary` to fail cleanly with "The created Flow
  could not be given its secret values" until Core supports it.
- **The two new run-scenario paths** (the created-Flow branch and the shared
  hooks) are covered only by type checks and by the exact-text tests. Like
  the rest of `runScenario`, they need a live Lab to exercise.
- **The domain build may be stale.** Other workers have uncommitted changes
  in `domain/src` (output-node definitions and parameter contracts), and the
  test-runner type-checks against whatever domain build exists. I did not
  rebuild the domain.

## Open questions or contradictions found

1. **Core caps a build's recorded totals at 50,000 tokens, while the run's
   budget is 100,000.**
   - **Where:** `sanitizedBootstrapAccounting` in Core's `runtime/service.ts`
     and `boundedAccountingInteger` in `api/handlers/llm-generation.ts`
     reject any input, output or total count above 50,000.
   - **Effect:** a legitimate evidence-guided build that uses between 50,001
     and 100,000 tokens would probably be refused after the provider was
     paid.
   - **Next step:** this is a Core defect to check on the first live runs.
2. **Core does not record a build's calls one by one.** A proposal carries
   only a call count and provider-reported totals. So for `create-flow`
   bundles, `snapshots/live-llm.json` has `observed.observedCalls: []` and
   `perCallRecords: "not recorded"`. The real numbers are in `build.accounting`
   and `observed.accounting`; for a build these are provider-reported totals,
   not reservations.
   - **Impact on the campaign:** its summary reader adds up per-call tokens,
     so it will show 0 reported tokens for every create-flow run. It needs
     one line that reads `build.accounting` for these bundles.
   - **Other fields the campaign can use:** `flow-lane.json` has
     `lane: "created-flow"` and `flowShape.actionTypes`, the created Flow's
     node types and counts, which the campaign said no bundle had published
     before. There is no `proposalIssues` field.
   - **Longer term:** itemizing a build's calls would be a Core change.
3. **The per-call timeout is held to 25 s.** Core's Flow Settings ceiling is
   25 s, and the plan uses one timeout for both the settings and the grant.
   The web panel's exploration grant allows 45 s per call. If evidence
   decisions time out live, this is why.
4. **A created Flow's `expected.actions` are not checked.** A created Flow is
   judged on outcomes: the goal facts or the records, the expected failure,
   and no early stop. `expected.actions` lists the action types a *recorded*
   script produces, so requiring them would judge how the Flow was built,
   not what it achieved.
5. **Repair is a separate step.** The created Flow runs without a grant. To
   "run and repair" (build on the unarmed page, run on a drifted variant,
   repair with `explore_and_adapt`), the lane needs a second grant issued for
   the created Flow. I left this out of scope.
6. **`flow-lane/` now re-exports the whole created-Flow lane** through its
   barrel, so `cli.ts` and `run-scenario.ts` import it from there. The
   catalog type is restated structurally in `instruction-task.ts`. If the
   supervisor wants a single definition, moving `LiveInstructionTask` into
   `packages/test-contracts` would let the scenario lab import it, which is
   a two-file change.
