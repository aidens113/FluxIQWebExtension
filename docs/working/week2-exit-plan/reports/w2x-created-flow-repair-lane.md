# w2x-created-flow-repair-lane

Worker report, 2026-09-21. Plan step L1, gap step 1 of
`w2x-exit-loop-gap-audit.md`. Task t049, worktree
`F:\fxwork\t049\!FluxIQWebExtension` (branch `task/t049-created-flow-repair-lane`,
t027 tip plus t036). All changes are uncommitted. No Core source was touched.

## Outcome

**Done.** A Flow built from an instruction now goes through the Lab's repair
lane. With `--replays N`, a `create-flow` run approves and applies its
repair, replays the Flow with no grant, and fails unless every replay passes
with zero provider calls.

One live run showed the whole step-1 chain on
`identity-drift-rename-redesigned-after-creation` (persistent-isolated,
`FLUXIQ_TEST_ENV_FILES=none`), and a later `pnpm lab replay` with no key
passed the oracle with zero calls:

- **Run:** `run-mubmrcyv-beaa2a6b`, **passed**.
- **Build:** 2 calls, $0.00655. `build.providerCalls` 2 equals `observed.calls` 2.
- **Fail:** the drift failure, `target_not_found` / `web.target.not_found`.
- **Diagnose:** two diagnoses (the first failed validation, the second passed).
- **Generate Repair:** a proposal-only `temporary_target_override`, preflight
  OK, which saved an adaptation and a change proposal.
- **Declared repair:** judged `repaired`, meaning it names Apply changes.
- **Persist:** the Lab approved and applied it (`proposed` → `applied`).
- **In-run replay:** with no grant, the Flow succeeded with 0 calls and 0
  harness activations, and the goal held.
- **Key-less replay:** `replay-mubmxtvg-93979815` **passed**. No credential
  variables were set, Core's provider keys went from 1 to 0, calls were 0,
  and `playbackGoalHeld` was true.

Core does not reliably propose the patch, which is the brief's fallback case.
Of the five live runs:

- one proposed the patch;
- one ended `llm.runtime_patch_not_requested`;
- two had a diagnosis fail validation with 0 accounted calls and no gate record;
- one timed out in the facility before any Flow ran.

In every no-proposal run the lane correctly refused: the declared repair was
judged `not_proposed`, nothing was applied, and the run failed. The run that
passed ran before a final behaviour-preserving refactor of how inputs are
rebuilt (see below). The final code's refusal path was proven live twice;
its success path is proven by unit tests only.

## What changed and why

**`packages/test-runner/src/live-llm/live-llm-run.ts`**

- `repairsFlow` and `proposesRepairOnly` are now true for `create-flow`: the
  built Flow's playback runs under the `diagnose_and_adapt` grant from
  `repairAuthorizer`. Both getters now read a private `repairPurpose`.
- New `describeRepair()`: the task plus the purpose of the grant that
  produced the repair. For create-flow that is `diagnose_and_adapt`;
  `describe()` would have named `build_and_adapt`.

**`packages/test-runner/src/flow-lane/repair/run-repair-lane.ts`** (accepts the
created lane's repair grant)

- `LiveRepairRun` now asks for `describeRepair()`.
- New optional `expectation`: the declared repair, judged by `judgeFlowRepair`
  before anything is applied, as `runFlowLane` does for a recorded Flow. The
  created lane judges none itself.
- Anything other than `repaired` writes `snapshots/repair-lane.json` with the
  judgement, `application: null` and no replays, publishes the verdict, and
  fails through `assertFlowRepair`. A missing or wrong proposal is never
  approved onto the Flow.
- New optional `rebuildInputs(nodes)`: the rule of the lane that built the
  Flow, used to rebuild its run inputs. Absent, the recorded lane's rule
  applies. It is injected rather than imported: importing the `creation`
  barrel would create a cycle (`creation/lane` → `run-flow-lane` →
  `repair/index`), and the structure audit forbids importing
  `creation/secrets.js` directly.

**`packages/test-runner/src/run-scenario.ts`** (798 lines; the limit is 800)

- With `--replays`, a created run of a variant that declares a repair is held
  to the declared proposal-only outcome, as the recorded `adapt` lane already
  is. `withDeclaredFlowRepair` gets `flowLane: flow || (creation && replays)`.
- The created lane receives `flowWorkflow`. Without `--replays`, created runs
  behave exactly as before.
- The recorded lane's 12-line `runLiveRepairLane` call became one shared
  `proveRepair` closure, which both lanes call. The created lane calls it
  after `runCreatedFlowLane`, passing the created lane's rule
  (`createdFlowSecretInputs`) and the declared `expectation`.
- `checkGoal` still judges the variant's real expectations (Saved), never the
  held-to outcome.

**`packages/test-runner/src/commands.ts`**

- `--replays` is accepted with `--llm-task create-flow`, which needs no
  `--flow`; `creationOptions` already refuses `--flow` for create-flow.
- `diagnose` is still refused. The error text, usage string and comment were
  updated to match.

**`scripts/lab/live-campaign/**`**

- `-- --replays N` already passed through to creation tasks; the Lab used to
  refuse it.
- The row now reads `snapshots/repair-lane.json`:
  - `row/bundle.mjs` reads the file;
  - the new `row/replay-summary.mjs` summarizes it: application, declared
    verdict, replays that ran and passed, and replay provider calls;
  - `summarize-task.mjs` adds a `repairLane` field to every row;
  - `repair-outcome.mjs` fills `replayProviderCalls` from it.
- The creation table gains a "Repair and replays" column.

**Tests**

- `run-repair-lane.test.ts` gets three created-Flow cases:
  - the proposal is judged, then applied and replayed under the grant that made it;
  - a wrong target, or no proposal, is never applied, and the judgement is written first;
  - the rule the caller hands in is used, with the real `createdFlowSecretInputs`.
- `live-llm-run.test.ts` covers the getters for create-flow, adapt, repair and diagnose.
- `commands.test.ts`: the test pinned the old refusal, which this brief
  deliberately changes. It now accepts create-flow with `--replays`, still
  refuses `--flow` with create-flow, adds a `diagnose` refusal, and keeps
  every other refusal.
- Campaign tests:
  - new `row/tests/replay-summary.test.mjs`;
  - a passthrough test in `lab-run-command.test.mjs`;
  - `creation-rows` and `runner` pinned regexes gain the new column's `—` cell.

## Commands run and observed results

All from `F:\fxwork\t049\!FluxIQWebExtension` unless noted. Every live run used
`FLUXIQ_TEST_ENV_FILES=none pnpm lab run identity-drift --variant renamed-redesign --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-chat --llm-task create-flow --instruction-task identity-drift-rename-redesigned-after-creation <campaign CREATE_LIMITS> --target persistent-isolated --workspace t049-drift-<x> --replays <n>`,
the command `pnpm lab:campaign ... --dry-run -- --target persistent-isolated --workspace ... --replays 1` printed.

- **First attempt:** refused, "FluxIQ Core's build is 1 minute(s) behind its
  source". `git status` in the t049 Core worktree was clean; `service.ts` was
  37 seconds newer than dist by timestamp only. `pnpm --filter fluxiq build`
  in `F:\fxwork\t049\!FluxIQ` exited 0 and left the Core tree unchanged.

**Live runs**

| Run | Workspace, replays | Verdict | Calls (build + repair) | Cost USD | What happened |
| --- | --- | --- | --- | --- | --- |
| `run-mubmkvcr-85e141ca` | a, 1 | failed, runtime.behavior | 2 + 1 | 0.00879 | Drift failure as declared, oracle passed. Two diagnoses, then gate `patchSkippedCode: llm.runtime_patch_not_requested`; exploration skipped. Lane: `declaredRepair: not_proposed`, `application: null`. |
| `run-mubmrcyv-beaa2a6b` | b, 1 | **passed** | 2 + 2 | 0.01054 | Full chain as above. Adaptation `...temporary-target-override.1790018561927` went `proposed` → `applied`. Replay 1: `succeeded`, providerCalls 0, harnessActivations 0, goalPassed true. Wall clock 141,545 ms. |
| `run-mubndbiw-af8c5932` | c, 2 | failed, environment.missing | 1 + 0 | 0.00304 | Facility `http.timeout` (30,000 ms) on `review-flow-adaptation`, while the created lane applied its build proposal, before any Flow run. My code was not reached. |
| `run-mubnkqz3-17a3c434` | d, 2 (final code) | failed, runtime.behavior | 2 + 0 | 0.00655 | Drift failure as declared, oracle passed. One diagnosis, `validationOk: false`, `validationCodes: []`; 0 accounted calls, gate `null`. Lane: `not_proposed`, nothing applied. |
| `run-mubnqdey-c8434d69` | e, 2 (final code) | failed, runtime.behavior | 1 + 0 | 0.00310 | Same as d. |

Total provider spend over the five runs: $0.0320.

**Key-less replay**

`env -u DEEPSEEK_API_KEY FLUXIQ_TEST_ENV_FILES=none pnpm lab replay identity-drift --workspace t049-drift-b --flow flow.1d41045b-788a-45cb-8988-e58f62677f43 --instruction-task identity-drift-rename-redesigned-after-creation`
exited 0 with `replay-mubmxtvg-93979815`:

- `verdict: passed`, `playbackGoalHeld: true`;
- `environmentCredentialVariables: []`, `coreProviderKeys {before 1, removed 1, after 0}`, `executionGrant: null`;
- `calls: 0`, `interventions: 0`, `harnessActivations: 0`, `coreProviderCallCount: null`;
- run `succeeded` (type succeeded, click succeeded);
- `flowContentHash` identical before and after.

**Checks**

- `npx tsc -p tsconfig.json` in `packages/test-runner` exited 0.
- Focused tests, after the final change:
  `node --test dist/flow-lane/repair/tests/*.test.js dist/live-llm/tests/live-llm-run.test.js dist/tests/commands.test.js dist/flow-lane/tests/*.test.js`
  gave `# tests 219`, `# pass 219`, `# fail 0`.
- `dist/flow-lane/creation/tests/lane.test.js` (run earlier alongside) has
  one failure that was already on this base: "a dataset task is built,
  settled, applied, run on a freshly presented page, and passes on the
  records it stored". The expected call sequence lacks the
  `get-flow-adaptation` read at `creation/build-proposal.ts:262`, added in
  t027's reconcile commit `f1db4e9`. My diff touches nothing under `creation/`.
- `node --test "scripts/lab/live-campaign/**/tests/*.test.mjs"` gave 38 of 38 passing.
- `node scripts/structure-audit.mjs`:
  `structure-audit: passed (84 warning(s), 122 baselined)`. It first flagged
  two violations of mine, both fixed: the `../creation/secrets.js` import and
  a third `repair-` file in `row/`.
- `pnpm check` (third run, after the final change) exited 0. Structure,
  `lab:test` and `task:test` reported `# fail 0`, the audit passed, and every
  package check printed `Done`. The first two runs exited 1 on flakes in
  files I did not touch:
  - `scripts/lab/tests/lab-instance.test.mjs` "the build lock excludes a
    second holder": a 40 ms timeout that took 199 ms under the suite. It
    passed alone three times out of three.
  - `scripts/worktree/tests/remove.test.mjs`, 2 tests: "Bad control character
    in string literal in JSON" while reading the machine's process list. The
    file passed alone, 6 of 6.

## Not verified

- **The final code's success path live.** Run b passed with the pre-refactor
  wiring: `builtFrom: "instruction"` with a `createdFlowSecretInputs` call
  inside the lane. The final code passes that same function in as
  `rebuildInputs`. For identity-drift both produce `{}`: it has no declared
  secrets, and the Flow requests none. Runs d and e ran the final code, but
  Core proposed nothing, so only the refusal path ran live. A created Flow
  that needs declared secrets or uploads was not run live.
- **Why runs d and e made 0 accounted calls.** Core recorded a failed
  diagnosis with no accounted call and no gate record. The Core log kept in
  the bundle has 8 lines and says nothing about it. This may be an unaccounted
  failed provider call, but I could not tell from the Lab side.
- **Recover and Resume**, which step 1 does not claim.
- **Core's own count on the key-less replay:** `coreProviderCallCount` stays
  `null`, the gap the audit already names.
- A live `--replays` run through `pnpm lab:campaign`. Only its dry run and
  unit tests ran.
- Full `pnpm test` / `pnpm build`, by the brief.

## Open questions or contradictions found

1. **Core's side of the chain is unreliable here.** One of four runs that
   reached playback proposed the repair. The others ended
   `llm.runtime_patch_not_requested` (once) or with a diagnosis that failed
   validation with 0 accounted calls (twice). This is L4–L6 territory. The
   0-call diagnosis may also be an accounting gap worth Core's attention.
2. **The gap audit's step 1 did not mention that `runCreatedFlowLane` throws
   on the drift failure.** Calling the repair lane after it therefore needed
   the created run held to the declared proposal-only outcome. I did that
   only with `--replays`, so plain create-flow runs keep their old verdicts.
   A campaign given `-- --replays N` changes that task's verdict to "passes
   only if the declared repair is proposed, applied and replays green".
3. **`run-scenario.ts` is at 798 of 800 lines.** Any further lane work there
   (L6, U-series) needs a split first.
4. **The created lane's `lane.test.ts` failure is not mine.** It comes from
   `f1db4e9` and belongs to the t027 gate triage.
5. **I rebuilt Core's dist in the t049 Core worktree** to clear the Lab's
   stale-build refusal. That is generated output only; the Core tree is clean.
6. **Workspaces `t049-drift-a` to `t049-drift-e` remain** under this
   worktree's `test-runs/`. The repaired Flow is in `t049-drift-b` as
   `flow.1d41045b-788a-45cb-8988-e58f62677f43`.
