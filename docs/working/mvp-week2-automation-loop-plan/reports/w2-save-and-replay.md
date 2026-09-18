# Save and replay: can a created Flow be run again later, with no model?

Worker report for unit t019 (`task/t019-replay`, worktree `F:\fxwork\t019-replay`),
2026-09-18.

## Outcome

**Proved, but only after a fix.** A Flow that FluxIQ built from the instruction
for `social-scheduler-week-ahead` was saved, then run four more times in four
separate later invocations. None of those invocations had a model: there was no
key in the environment, no key in FluxIQ, and no grant, so FluxIQ ran the Flow in
deterministic mode. Every replay matched **14 of 14 expected records**
(`matchedRecords: 14`, `expectedRecords: 14`) and 56 of 56 fields. All four stored
byte-identical rows (SHA-256 `23782055ca897a3d…`), checked both by the runner and
straight from FluxIQ's own database.

**Before the fix, the Lab had no working path from a created Flow to a later
replay.** There were three separate reasons:

1. **The isolated target deletes the Flow when the run ends.** The FluxIQ data
   directory sits inside the run directory (`allocation.ts:45` at base,
   `fluxiqRoot = path.join(runRoot, "fluxiq-root")`), and the run's `finally`
   deletes that directory (`run-scenario.ts:626` calls
   `removeRunOwnedTopologyState`, which reaches `coordinator.ts:244`
   `rm(runRoot, { recursive: true })`). Confirmed live: run
   `run-mu7ekvqd-9fbf8185` built `flow.8c2c7e20-b415-4195-817a-c599955d653e` and
   passed 14/14, and afterwards `F:\r19\.work` was empty. That Flow no longer
   exists anywhere. Every campaign result to date was measured on this target, so
   none of those Flows can be replayed.
2. **The persistent target keeps the Flow, but nothing could run it later.**
   `lab run --flow <id>` is refused on `persistent-isolated`
   (`commands.ts:266` at base; `target-config.ts:73-74`).
3. **Even with a way to run it, the Flow pointed at a dead address.** A created
   Flow's first step is a `web.browser.navigate` that stores an absolute URL,
   port included (`domain/src/output-nodes/payloads.ts:72`). The Lab served the
   fixture site on a fresh random port every invocation (`allocation.ts:103` at
   base). Confirmed live: `flow.73ee7f1b-4f0a-4dcd-a4a0-a5cbef190e6d` was saved
   pointing at `http://127.0.0.1:60600`. Replay `replay-mu7f5a3r-22085770` served
   the site on 61538, the navigate step failed (`web.action.failed`), and it matched
   **0 of 14** records.

There is prior art that does not cover this. `pnpm demo:llm:create` followed by
`pnpm demo:llm:replay` (`demo-workspace/creation-lanes.ts:216`) replays a created
Flow provider-free twice. It is one fixed form-fill demo judged by a
"Submitted: Ada / team" string, not the Lab's created-Flow lane, and it judges no
dataset task.

## What changed and why

All the changes are in the worktree and are uncommitted. Nothing in
`run-scenario.ts`, `lane.ts`, `live-llm-run.ts`, `domain/src/runtime/llm-evidence/**`,
`apps/extension/src/**` or Core was touched.

- **`packages/test-runner/src/allocation.ts`: a persistent workspace keeps its
  fixture port.** The first invocation records the Scenario Lab port in
  `<workspace>/scenario-port.json`. Every later invocation binds that port again.
  The FluxIQ web and gateway ports stay fresh. This is the demo workspace's
  existing rule (`demo-workspace/scenario-lab.ts`). Why it is the right fix: a
  real website keeps its address between runs, but the Lab's did not. That is a
  Lab artifact, so the Flow should not carry a workaround for it. If another
  process holds the recorded port, a new port is recorded and the allocation
  reports `scenarioPortRetained: false`. A malformed record fails closed.
- **New `pnpm lab replay <scenario> --workspace <name> --flow <id>
  [--instruction-task <task>] [--seed N]`** (`src/saved-flow-replay/`, wired in
  `commands.ts`, `cli.ts` and `index.ts`). It runs a saved Flow on the persistent
  workspace and judges it with the same judgement the creation lane uses
  (`judgeCreatedFlowDataset`). It writes `<runs>/replays/<replay-id>.json`. It
  lives in a new module because `run-scenario.ts` was fenced and the `src/` root
  is already at its file budget (48 files).
  - `replay-browser.ts` repeats two small private helpers of `run-scenario.ts`
    (pairing and tab activation), because that file was fenced. **Follow-up:**
    once the sibling unit lands, move both into `run-lifecycle/` and call them
    from both places.
- **`docs/architecture/testing-facility.md`**: a new "Replaying a saved Flow"
  section, plus corrections to the three places that said persistent ports
  change every invocation.
- **Tests**, written after the live proof: `saved-flow-replay/tests/provider-absence.test.ts`,
  `saved-flow-replay/tests/saved-navigation-origins.test.ts`, three new cases in
  `tests/allocation.test.ts` (port kept, held port replaced, bad record refused)
  and one in `tests/commands.test.ts`.

## Where the Flow is saved

- Workspace: `F:\r19\persistent-isolated\t019-replay\` (runs dir `F:\r19`)
- Project: `51caa71d-570a-4c7c-aa50-77e090e4fd55` ("Persistent E2E t019-replay")
- **Flow: `flow.c1542a11-fa27-4942-94e0-41f764d8d317`**, content hash
  `64a9b432e63a199d3be941c1c450d89eb39af0917bd820f7798719ee90a3a569`. Its shape
  is navigate, select, select, extract list. It navigates to `http://127.0.0.1:61538`,
  which is the workspace's recorded port.
- Stored in `fluxiq-root\.fluxiq\global.sqlite`, table `automation.state`, key
  `projects/51caa71d-…/flows/flow.c1542a11-…/flow`, with its graph under
  `…flow.c1542a11-….bootstrap.9005f5e7a19cfac1.main.graph`. Run rows are in
  `artifacts\automation-studio\projects\51caa71d-…\project.sqlite`
  (`run_datasets`, `run_dataset_rows`).

## Exact commands

Build (live, key exported in this shell only):

```bash
export DEEPSEEK_API_KEY=$(sed -n 's/^DEEPSEEK_API_KEY=//p' .env.local | head -1 | tr -d '\r"\047')
FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=persistent-isolated FLUXIQ_TEST_PERSISTENT_WORKSPACE=t019-replay \
  FLUXIQ_LAB_INSTANCE=t019 FLUXIQ_TEST_RUNS_DIR='F:\r19' pnpm lab:campaign social-scheduler-week-ahead
```

Replay (a fresh shell, key explicitly unset):

```bash
env -u DEEPSEEK_API_KEY FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t019 FLUXIQ_TEST_RUNS_DIR='F:\r19' \
  pnpm lab replay social-scheduler --workspace t019-replay \
  --flow flow.c1542a11-fa27-4942-94e0-41f764d8d317 --instruction-task social-scheduler-week-ahead
```

Each replay was run from a shell where `env | grep -ciE '^[A-Z_]*API_KEY='`
printed `0`.

## How I know there was no model

Several independent layers:

1. **No key in the replay process.** The replay refuses to start if any of the 24
   provider credential variables in `PROVIDER_SECRET_ENVIRONMENT_VARIABLES` is set.
   It checks both the process environment and the resolved Lab environment.
   Every replay recorded `environmentCredentialVariables: []`.
   `FLUXIQ_TEST_ENV_FILES=none` also stops `.env.local` from being loaded.
2. **No key in FluxIQ.** A live build installs the Lab's DeepSeek key into
   FluxIQ's Secret Keys (`live-llm/authorize-flow.ts:40`), and a persistent
   workspace keeps it. The replay deletes every `llm` key and reads the store back.
   Replay 1 recorded `before 1, removed 1, after 0`. Replays 2, 3 and 4 recorded
   `0, 0, 0`, because the key stayed gone.
3. **No grant, so FluxIQ has no provider to call.** The replay passes no
   `llmExecution`. The request then asks FluxIQ for
   `adaptiveMode: "deterministic"` (`existing-fluxiq-control.ts:340`). Without a
   grant, FluxIQ's provider resolver returns `undefined`
   (`F:\fxwork\!FluxIQ\packages\fluxiq\src\programs\_shared\runtime.ts:79-90`,
   `bindLlmExecutionProvider`). This is the mechanism; the two points above make
   it impossible to bypass.
4. **FluxIQ's own records agree.** FluxIQ's stored session for each replay run
   has no `adaptiveRuntime` and no `adaptiveMode`, and has
   `resultVerification: unverified` (no model judged it). The build-run playbacks
   do have them: `adaptiveMode: manual_approval` with a verdict whose
   `basis: model`. The run detail recorded 0 interventions and 0 harness
   activations, and the runner's derived provider call count is 0.
   - **Caveat on the accounting:** for a deterministic run, FluxIQ publishes no
     provider-call accounting at all. `providerCallCount`, `llmAccounting` and the
     per-call lines are all absent (`coreProviderCallCount: null`,
     `accountedCalls: null`). The `calls: 0` is derived from zero interventions.
     So the accounting says "no model activity recorded", not "FluxIQ counted zero".
     Points 1 to 3 are the stronger evidence.
   - `llmGate` was present only on the failed replay 0:
     `invoked: false, "Current training mode or settings do not allow LLM intervention."`

## Results side by side

The replays were separate invocations, each with a fresh FluxIQ process, browser
and ports. The fixture was always at 61538, and `scenarioPortRetained` was `true`
for replays 1 to 4.

| | Replay 1 | Replay 2 | Replay 3 | Replay 4 |
|---|---|---|---|---|
| replay id | `replay-mu7fcgte-68c33753` | `replay-mu7fft3o-4c5b01e3` | `replay-mu7fkogv-37e6eea0` | `replay-mu7fmbk6-cf5ff62d` |
| FluxIQ run id | `aaa7f5eb-…` | `f6f489f1-…` | `1bd3b241-…` | `f95c55f4-…` |
| verdict | passed | passed | passed | passed |
| run status | succeeded (4/4 steps) | succeeded (4/4) | succeeded (4/4) | succeeded (4/4) |
| **matchedRecords / expectedRecords** | **14 / 14** | **14 / 14** | **14 / 14** | **14 / 14** |
| observed / compared records | 14 / 14 | 14 / 14 | 14 / 14 | 14 / 14 |
| fields present / expected | 56 / 56 | 56 / 56 | 56 / 56 | 56 / 56 |
| unexpected fields | 0 | 0 | 0 | 0 |
| row digest (runner) | not yet recorded¹ | not yet recorded¹ | `23782055ca89…` | `23782055ca89…` |
| row digest (FluxIQ DB, independent) | `23782055ca897a3d` | `23782055ca897a3d` | `23782055ca897a3d` | `23782055ca897a3d` |
| provider keys in FluxIQ (before/removed/after) | 1 / 1 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| provider credential variables in the environment | none | none | none | none |
| interventions / harness activations | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Flow content hash before = after | yes | yes | yes | yes |

¹ I added the digest to the replay record after replay 2. The "FluxIQ DB" row
was computed by a separate Python read of `run_dataset_rows` (rows in order, keys
sorted), with none of my runner code involved. It covers all four replays and
agrees with the runner's value where both exist.

Failed replay 0 (`replay-mu7f5a3r-22085770`, the Flow saved before the fix):
navigate failed, `matchedRecords 0 / expectedRecords 14`, 0 provider calls, key
`1 / 1 / 0`.

## Commands run and observed results

| Command | Result |
|---|---|
| Brief's isolated build (`FLUXIQ_TEST_TARGET=isolated … lab:campaign social-scheduler-week-ahead`) | `run-mu7ekvqd-9fbf8185` passed. `matchedRecords 14/14`, 56/56, 3 provider calls, $0.00980. `F:\r19\.work` empty afterwards. |
| Persistent build 1 (before the fix) | `run-mu7esd39-fb7668be`. Proposed a Flow (5 calls, $0.01696) and saved `flow.73ee7f1b…`. The Lab run then failed with `http.timeout`, 30 s, `control.request`. |
| `lab replay … --flow flow.73ee7f1b…` | Failed as predicted: 60600 saved, 61538 served, navigate failed, 0/14. |
| Persistent build 2 (after the fix) | `run-mu7f75pv-291e3a69`. Proposed and saved `flow.c1542a11…` (3 calls, $0.01067), navigating to the retained 61538. The Lab run again failed with `http.timeout` (see below). |
| `lab replay … --flow flow.c1542a11…` ×4 | All passed, results above. |
| `npx tsc -p packages/test-runner/tsconfig.json --noEmit` | exit 0 |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (77 warning(s), 122 baselined)` |
| `node --test` on the 4 new and changed test files | 44 pass, 0 fail |
| `pnpm test` in `packages/test-runner` | `# tests 1168`, `# pass 1168`, `# fail 0` |

Live provider spend: 11 calls, about $0.037, all on builds. The replays spent
nothing.

## Not verified

- **I did not run the root `pnpm check` / `pnpm test` / `pnpm build`.** I ran the
  structure audit, the test-runner type check and the full test-runner suite.
- **Only one task was replayed** (`social-scheduler-week-ahead`, a dataset task).
  The playback-goal branch of `lab replay` (`finalStateFacts`) and the
  secret-input path have not been run live. No task with a variant or a declared
  secret was replayed.
- **The row digests were not compared against the isolated baseline run.** Its
  FluxIQ database was deleted, which is finding 1.
- **The retained-port change only ran live on this workspace.** It was not
  exercised live with `lab:interactive` or with the bench on persistent targets.
  The held-port fallback is covered by a unit test only.
- **The port retention is not bulletproof.** Between releasing the probe socket
  and the Scenario Lab binding it, another process could take the port. That is
  the same race the existing allocation already accepts.
- **The Flow is replayable only while the workspace's port stays free.** After a
  reboot or a port clash, a replacement port breaks every Flow saved against the
  old one. The replay then reports `servedAtSavedAddress: false` rather than
  hiding it. A real site has no such problem.

## Open questions and contradictions found

1. **The brief's "established" point is out of date on this base.** The
   created-Flow lane's playback now carries a `verify_result` grant
   (`lane.ts:56`, `:135`). The build-run playback is therefore not model-free:
   FluxIQ stored a model-based verdict on it (`basis: model`). In the isolated
   baseline, `live-llm.json` shows `observed.calls 3 = build.providerCalls 3`
   while the same run shows `harnessActivations: 1` and one intervention. So the
   verification call does not appear in the Lab's spend accounting, and I could
   not find its usage recorded anywhere I read. Owner: the sibling unit on
   `lane.ts` and `live-llm-run.ts`.
2. **The model's result check gave opposite answers on identical rows.** The
   build playbacks of `flow.73ee7f1b` (`c510edcf`) and `flow.c1542a11`
   (`72b19723`) stored byte-identical rows (`23782055ca897a3d`), which the oracle
   scores 14/14. FluxIQ's model verdict was `confirmed / answers` for the first and
   `refuted / does_not_answer` for the second. The refutation made FluxIQ mark
   that run `failed` even though every step succeeded and the answer was right.
   That is one false refutation out of two on the same data.
3. **Both persistent builds failed the Lab run on a 30-second HTTP timeout after
   the Flow was saved.** The isolated build did not. The stored sessions show the
   runs themselves finished in about 19 s and about 22 s. The likely cause is the
   `verify_result` call after the run pushing the synchronous request past 30 s.
   A granted run's id is unknown until the response returns, so
   `executeRecordedFlowRun` cannot recover it (`persisted-flow-run.ts:257-278`),
   and the lane writes no `flow-lane.json`. That is why the campaign reported
   "judgement not measured" although the Flow was right. This is two observations
   on this machine and was not rerun alone. It is not the faulty-RAM signature,
   which would be uniform or impossible failures. Owner: the sibling unit.
4. **Getting the Flow id is manual.** A build that fails after saving, like
   the two in point 3, writes no Flow id into its bundle. I read it from the
   workspace database. `lab replay` checks that the id exists, but it cannot
   find it for you.
