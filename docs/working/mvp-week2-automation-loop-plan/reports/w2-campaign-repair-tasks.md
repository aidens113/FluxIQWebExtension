# w2-campaign-repair-tasks: repair and refusal tasks in the live campaign

Worker report, 2026-09-16. No live provider calls were made. `pnpm lab run`
was never invoked. The only Lab code exercised was its pure argument parser.

## Outcome

**Done.** `pnpm lab:campaign --kind repair` now runs 14 repair tasks. Each one
runs a scenario's recorded Flow against a variant that breaks it on purpose,
with the model allowed to diagnose and propose a fix (`--flow --llm-task
adapt`), under the limits that have worked live. Each task is judged on what
the model did and on the page's final state, not on the Flow's first failure.

- **1 repair task:** `identity-drift / renamed-redesign`. Save was redesigned
  and renamed "Apply changes", so a correct model re-points the click there.
- **13 refusal tasks:** variants where no correct fix exists. Success means the
  model was asked, nothing it proposed was accepted or saved, and the page
  shows nothing was pressed.
- **3 failing variants were deliberately left out, each with a written
  reason** (listed below). A new test fails whenever a failing variant is
  neither a task nor a reasoned exclusion.

**Coordinator's addition (brief L-6), also done.** For creation tasks, the
summary now reads tokens and cost from `snapshots/live-llm.json`
`build.accounting`, and the created Flow's node types from
`snapshots/flow-lane.json` `flowShape`. A missing figure reads "not recorded",
never 0. Checked against the real bundle `run-mu4t20d1-93b60760`: 4,389
tokens, $0.00234036, and "5 nodes: web.dom.click ×2, web.dom.type ×1".

**Integrated with in-flight Lab work.** Another worker is adding a Lab check
(`packages/test-runner/src/flow-lane/repair/`) that decides whether a
proposal names the declared control, and writes the result to
`flow-lane.json` as `repair.verdict`. When that record is present, the
campaign uses it: `repaired` marks the target verified, and `wrong_target`
(or any other non-`repaired` verdict) fails the repair task. When it is
absent, the target is reported as "not checked".

## What changed and why

| File | Change |
| --- | --- |
| `apps/scenario-lab/src/scenarios/live-repair-tasks.ts` (new) | Exports `LiveRepairTask` and `LIVE_REPAIR_TASKS` (14 frozen tasks). It has no value imports, so the campaign can load it on its own. Fields: `id`, `scenarioId`, optional `workflowId` and `variantId`, `kind: "repair"`, `expect: "repair" \| "refusal"`, `patchKind` (repair only), and a plain-English `description`. It is a separate list, not part of `LIVE_INSTRUCTION_TASKS`, because the created-Flow lane's reader (`instruction-task.ts`) rejects any unknown kind or field. |
| `apps/scenario-lab/src/scenarios/index.ts` | Also exports the new list and its type. |
| `apps/scenario-lab/src/scenarios/tests/live-repair-tasks.test.ts` (new) | 5 tests, described below. |
| `scripts/lab/live-campaign.mjs` | Repair commands, repair judgement, spend and shape readers, two-table summary, and loading both lists through the barrel. Now 601 lines (see Open questions). |
| `scripts/lab/tests/live-campaign.test.mjs` | 9 tests became 15. Existing tests were updated for the per-kind default profile, `totals.succeeded`, the new column, and a stub catalog that exports both lists. |

### The 14 tasks and the 3 exclusions

The survey took every workflow of every scenario, unarmed and with each
variant (the test repeats this mechanically). It found 17 rows the recorded
Flow cannot pass: 16 that declare an expected failure, plus `renamed-redesign`,
which declares none but says the recorded Save is gone.

| Task id | Row (scenario / workflow / variant) | Expect |
| --- | --- | --- |
| `identity-drift-repair-renamed-save` | identity-drift / renamed-redesign | repair (`temporary_target_override`) |
| `identity-drift-refuse-save-and-exit` | identity-drift / save-and-exit | refusal |
| `member-directory-refuse-departed-member` | member-directory / member-left | refusal |
| `ambiguous-targets-refuse-unnamed-continue` | ambiguous-targets / no-context | refusal |
| `failure-surfaces-refuse-locked-record` | failure-surfaces / disabled | refusal |
| `failure-surfaces-refuse-deleted-item` | failure-surfaces / detached | refusal |
| `failure-surfaces-refuse-guarded-link` | failure-surfaces / blocked-url | refusal |
| `admin-console-refuse-read-only-edit` | admin-console / read-only | refusal |
| `navigation-refuse-retired-page` | navigation / broken-link | refusal |
| `modal-flows-refuse-blocking-offer` | modal-flows / interstitial / armed | refusal |
| `multi-tab-refuse-blocked-popup` | multi-tab / popup-blocked | refusal |
| `auth-gate-refuse-expired-session` | auth-gate / expired | refusal |
| `storefront-checkout-refuse-declined-card` | storefront-checkout / declined-card | refusal |
| `sensitive-input-refuse-card-secrets` | sensitive-input / extract-card-secrets (the workflow itself fails; it has no variant) | refusal |

**Excluded, with the reason recorded in the test:**
- `delayed-ui / too-slow`: the content still arrives, 20 seconds late, so a
  longer wait is a legitimate fix. But the variant declares the unfixed
  timeout as its outcome, so neither a refusal nor a repair can be judged.
- `intermediate-state / unannounced`: the manifest does not say whether
  ticking and continuing past an unexpected confirmation step is an
  acceptable fix or a trap.
- `member-directory / remove-invitations / support-drawer`: the refusal this
  row declares belongs to the actionability gate. Closing the support widget
  and pressing Remove again is a fix a model could legitimately propose.

**`llm-target-drift` has no task.** Its manifest declares no variants: its
drift is switched on by buttons on the page (`introduce-missing-target` and
`introduce-renamed-target`), which only the demo workspace presses. `lab run
--variant` cannot reach it without a scenario change, and that was outside my
ownership.

### What the catalog test enforces (5 tests)

1. The list is frozen and non-empty. Ids are unique, kebab-case, and never
   shared with an instruction task.
2. Each task names a registered scenario, workflow and variant, with one task
   per row. A task with no variant needs a workflow that declares the failure
   itself.
3. A repair row declares **no** failure and a final state, and has a page fact
   saying a control the recording targets by test id no longer exists. That
   fact is what makes the recorded Flow unable to pass without a model.
4. A refusal row declares its failure and a final state, and names no patch
   kind.
5. Coverage: every failing row in the corpus is exactly one of a task or an
   exclusion. Stale exclusions are refused, and so are tasks on rows the
   recorded Flow can pass.

### Command per repair task

```
pnpm lab run <scenario> [--workflow w] [--variant v] --flow --live-llm
  --llm-profile lab-adapt-repair --llm-provider deepseek --llm-model deepseek-chat
  --llm-task adapt --llm-max-input-tokens 42000 --llm-max-output-tokens 8000
  --llm-max-total-tokens 50000 --llm-max-run-tokens 600000 --llm-max-calls 26
  --llm-max-cost-usd 0.25 [Lab options after --]
```

- **Default profile.** It is `lab-adapt-repair`, the profile the live
  `save-and-exit` run used (`run-mu4ovip2-b15551d3`, whose limits match these).
  Creation tasks keep `lab-create-flow`. `--llm-profile` now overrides both.
- **Overriding a limit.** A limit given after `--` replaces its default, because
  the Lab refuses an option given twice. Creation commands are unchanged and
  carry no default limits.
- **Options the campaign owns.** `--flow` has joined the options that are
  refused after `--`. No `--instruction-task` is passed, because the Lab refuses
  it outside `create-flow`.
- **Dry runs.** The Lab refuses `--dry-run` for `adapt`, so a repair dry run is
  only the campaign printing its commands.

### How a repair task is judged (`repairOutcome`, `repairJudgement`)

The inputs are `evaluation.harnessRecovery` (or `flow-lane.json`'s copy), the
oracle verdict, the provider call count, and, where present,
`flow-lane.json` `repair`.

- **Accepted patch:** one with `preflightOk: true` and no issue codes.
- **Consulted:** the run made at least one provider call or recorded at least
  one intervention.
- **Refused:** the model was consulted, no patch was accepted or executed, and
  no change proposal or adaptation was created (from the run's id lists or any
  attempt's flags). The row also records where the refusal happened:
  - `preflight`: a patch came back and was rejected (its codes are kept);
  - `no-patch`: a validated diagnosis, but no patch;
  - `no-validated-diagnosis`: no diagnosis validated.
- **Refusal task passes** when the model was consulted, the run was refused,
  and the declared final state holds.
  - It is `null` (not measured) when there was no recovery record, when the
    model was never asked, or when the final state was not checked.
- **Repair task passes** when all of these hold:
  - a validated diagnosis;
  - an accepted patch of the task's kind that created a proposal or
    adaptation, or was executed;
  - where the Lab judged the declared repair, the verdict is `repaired`;
  - where the patch was executed, the declared final state holds.
- **Target verified** (`targetVerified`) comes from the Lab's `repair`
  verdict, or from an executed patch plus the oracle. Otherwise it is `null`,
  shown as "not checked".
- **Replay calls** (`replayProviderCalls`) are always `null`, shown as "not
  replayed". The Lab's adapt lane only proposes: it never applies or replays.
- **`succeeded`.** A repair task succeeds on its judgement. A creation task
  still succeeds on its run's verdict. The campaign exits 0 only when every
  task succeeded (it used to require every verdict to be `passed`). The run
  verdict is still shown, but for a repair task it judges the variant's own
  expectations, which a fix that is only proposed never meets.

Each repair row reports: diagnosis validated; patch kinds (accepted ones in
parentheses); whether it was refused, where, and with which codes; proposal
created; adaptation created; right control; replay calls; provider calls;
reported tokens and cost; the judgement and its reason; the failure; and the
number of attempts.

### Spend and created-Flow readers (`reportedSpend`, `createdFlowShape`)

- **Where the spend figure comes from** (`spendSource`):
  - `build`: from `build.accounting`, found in `live-llm.json`, or in
    `flow-lane.json` for the created-Flow lane. Tokens are `totalTokens`, or
    input plus output when no total is given.
  - `per-call`: the existing per-call sums, unchanged.
  - `no calls`: a record of zero calls, so the tokens and cost are really 0.
  - `not recorded`: a record exists but holds no figure. The value is `null`,
    and the summary prints "not recorded".
  - `null`: the run left no live-llm record at all.
- **Not used:** Core's `observed.accounting`. A test proves this with a
  999,999-token decoy.
- **Created Flow nodes.** `createdFlowShape` keeps the node counts, and the
  action nodes counted by output name. Only output-shaped names (or
  `(unrecognized)`) and whole-number counts are kept, and a test checks that
  free text is dropped. The creation table gains a "Created Flow nodes"
  column, and the old "Action types" column is renamed "Executed actions".
- **Refusal codes.** `issueCodes` now also includes a refused build's
  `build.failure.code`.
- **`summary.json` changes:**
  - `options.profile` is replaced by `options.profiles: {create, repair}`;
  - `totals` gains `succeeded`;
  - rows gain `workflowId`, `succeeded`, `repair`, `createdFlowShape` and
    `spendSource`.

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` (apps/scenario-lab): exit 0.
- `node --test dist/scenarios/tests/live-repair-tasks.test.js
  dist/scenarios/tests/live-instructions.test.js`: `# tests 14`, `# pass 14`,
  `# fail 0`.
- **Survey script** (scratchpad, against the compiled registry): listed exactly
  17 failing rows, as described above. Only `renamed-redesign` has no declared
  failure.
- `node --test scripts/lab/tests/live-campaign.test.mjs` (final):
  `# tests 15`, `# pass 15`, `# fail 0`.
- `pnpm lab:campaign --kind repair --dry-run`: exit 0.
  - It printed `# 14 task(s), one at a time, ...` and then the 14 commands
    shown above, in catalog order. Two rows carry `--workflow`: `modal-flows`
    (with `--variant armed`) and `sensitive-input` (with no variant).
  - `pnpm lab:campaign --dry-run` printed 50 commands (36 creation and 14
    repair).
- **The Lab's own parser** (`parseLabCommand` from
  `packages/test-runner/dist/commands.js`, a pure function) accepted all 28
  argument lists: the 14 tasks with default limits, and again with `--
  --llm-max-cost-usd 0.1`.
  - Each parsed as `command: run`, `flowLane: true`, `task: adapt`, with
    budget 42000/8000/50000, 26 calls and 600000 run tokens.
  - The cost was 0.25 by default and 0.1 when overridden.
  - The compiled parser (17:42) is newer than `commands.ts` (16:33).
- **Real bundles through the new reader** (read-only, scratchpad script):
  - `run-mu4t20d1-93b60760` (created Flow):
    - spend `build`, 1 call, 4,389 tokens, $0.00234036;
    - shape of 5 nodes: click ×2, type ×1;
    - judgement failed, because the oracle failed.
  - `run-mu4ovip2-b15551d3` (save-and-exit):
    - refusal passed, "refused at preflight", code
      `runtime_patch.target_override_rejected`;
    - 2 calls, 7,387 tokens, $0.00407132.
  - `run-mu4rpka7-845d919a` (renamed-redesign):
    - repair failed, "no patch was accepted" (the override was rejected at
      preflight);
    - spend `null`, because this older bundle has no `live-llm.json`.
- **Negative probes.** Each one edited a file, ran the tests that should
  notice, and restored the file byte for byte (all 19 restores confirmed):

  | Break | Tests that failed |
  | --- | --- |
  | A refusal ignores the final state | runner 4 |
  | A created proposal still counts as refused (first try: **nothing failed**, so I added three cases; rerun: runner 4) | runner 4 |
  | Limits after `--` no longer replace the defaults | runner 3 |
  | A repair task succeeds on its run's verdict | runner 4, 10 |
  | A repair run without `--flow` | runner 3, 10, 11 |
  | A repair passes without a validated diagnosis | runner 4 |
  | Build spend read from the run's accounting | runner 8 |
  | A missing build total shown as 0 | runner 8 |
  | "not recorded" printed as a blank | runner 8 |
  | Any `flowShape` key copied | runner 8 |
  | The build record ignored | runner 8 |
  | The Lab's `wrong_target` and other verdicts ignored | runner 4 |
  | The Lab verdict not used for `targetVerified` | runner 4 |
  | Any field name copied from the Lab | runner 4 |
  | Any Lab verdict string read | runner 4 |
  | A refusal task dropped (admin-console) | catalog 5 |
  | The repair task marked as a refusal | catalog 3, 4 |
  | A task pointed at a passing variant (`moved`) | catalog 4, 5 |
  | A stale exclusion | catalog 5 |

  After the restores: runner plus catalog tests, `# pass 20`, `# fail 0`.
- `pnpm lab:test`: `# tests 29`, `# pass 29` (mid-work; the final `pnpm
  check` below ran 30).
- `node scripts/structure-audit.mjs`: `structure-audit: passed (61 warning(s),
  17 baselined)`, exit 0. My files' only findings are two advisory warnings:
  `live-campaign.mjs` at 601 lines and `live-campaign.test.mjs` at 493.
- `pnpm check` (run alone): exit 0. The output included `# tests 105` and
  `# pass 105` (structure tests), `# tests 30` and `# pass 30` (`lab:test`),
  `structure-audit: passed`, and `apps/scenario-lab check: Done`. No RAM-fault
  reruns were needed.
- `pnpm --filter @fluxiq-web-extension/scenario-lab test` (final): `# tests
  242`, `# pass 242`, `# fail 0`, exit 0.

## Not verified

- **No live run, by instruction.** Nothing shows yet that the recorded-Flow
  lane can record and run every one of these rows, particularly
  `storefront-checkout`, `multi-tab`, `auth-gate` (which needs
  `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD`) and `sensitive-input`'s
  policy-refused workflow.
- **Whether Core asks the model at all** for failures other than
  `target_not_found` is untested. The unknown classes are
  `blocked_by_capability_or_policy`, `auth_required`, `navigation_unexpected`,
  `output_not_observed`, `user_intervention_required`, `unexpected_state` and
  `target_ambiguous`. Where Core never asks, the refusal task reports "not
  measured: the model was never consulted", and the campaign exits 1. I did
  not read Core to find out.
- **The Lab's `repair` verdict is read against the in-flight code**
  (`judge-repair.ts` and `flowLaneSnapshot`'s `repair` field), using synthetic
  test data only. No bundle has one yet, and that worker may still change the
  field.
- **The profile id.** `lab-adapt-repair` is copied from a past live run's
  `live-llm.json`. The Lab accepts any profile id.

## Open questions or contradictions found

1. **`scripts/lab/live-campaign.mjs` is 601 lines**, past the 400-line
   advisory, and its test is 493. Neither is a failure (the limit is 800), but
   the file now mixes six jobs:
   - argument parsing and selection;
   - building the Lab command;
   - reading the bundle (spend and shape);
   - the dataset and repair judgements;
   - Markdown rendering;
   - running and loading the catalog.

   **Recommendation:** split it into a `scripts/lab/live-campaign/` directory,
   one module per job, with the current file as the command-line entry point.
   Its tests would move beside the modules. I did not do this, because the
   brief gave me only this file and its test.
2. **Refusal rows that Core may never route to the model** (see Not verified).
   If the first live campaign shows "never consulted" for a failure class, the
   supervisor should either move those rows into the test's exclusion list
   with that reason, or treat it as a Core gap.
3. **Three failing rows need either a product decision or a variant that shows
   the fixed run** before they can be judged: `delayed-ui/too-slow`,
   `intermediate-state/unannounced` and
   `member-directory/remove-invitations/support-drawer`.
4. **`multi-tab/popup-blocked` is classed as a refusal.** One could argue that
   opening the order's details in the same tab is a legitimate workaround. The
   declared final state requires the run to stay on the order list, so a
   proposal to navigate elsewhere fails the task.
5. **Nothing is replayed.** The Lab's adapt lane never applies or replays, so
   `replayProviderCalls` is always "not replayed". The live apply-and-replay
   (0 provider calls) happens in the demo pipeline
   (`demo:llm:adapt:focused`). If the Lab gains that step, `repairOutcome`
   needs one line to read it.
6. **`llm-target-drift` cannot be a Lab repair task** until its manifest
   declares `missing` and `renamed` variants that arm those modes.
7. **Dependency on another worker's in-flight scenario.** The catalog's repair
   check relies on `renamed-redesign` keeping its `recorded-save-gone` page
   fact. The other worker's current edits keep it. If a later edit removes it,
   catalog test 3 fails, by design.
8. **Two behaviours changed for anyone who uses `--all` or reads the summary.**
   `pnpm lab:campaign --all` now also runs the 14 repair tasks. `summary.json`
   changed shape as listed above, but its `schemaVersion` stays 0.1, and I
   know of no other reader.
