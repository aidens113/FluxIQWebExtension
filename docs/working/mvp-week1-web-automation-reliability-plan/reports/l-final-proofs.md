# l-final-proofs

## Status

Done. Every accepted Stage 4 proof command passed, and no blocker was observed.

## Scope and pins

- Downstream pin: `4cde72dd63d1f855f3a09ffa98d4bc5f9cbf3736`.
- Core pin: `19468b72c4472fd5cc58940737702d5e4d72c985`.
- Owned worktree: `F:\fxlab\fxlab-7263534`.
- Run root: `F:\fxlab-runs\final\proofs`.
- Core is built once and then used read-only.
- Results below report only bounded facts, counts, categories, and timings. No
  credential, token, declared literal, recorded data, or raw run log is copied.

## Progress

- Intake found both Lab worktrees clean at their prior pins. The final run root
  did not yet exist.
- Both worktrees were moved to the exact final pins. Core contracts, `fluxiq`,
  and the WebSocket gateway built sequentially in 1.8 s, 7.9 s, and 1.7 s.
  Downstream domain, test contracts, and Scenario Lab built sequentially in
  3.0 s, 1.5 s, and 2.5 s. Each build exited 0, and both worktrees remained
  clean.
- A CLI-help probe was interpreted as a Lab command and performed setup work;
  it is excluded from proof evidence. It left no owned Lab process or run.
- The first evidence command selected `product-catalog`'s actionless primary
  workflow and was correctly refused as `fixture.invalid` in 18.4 s. It is a
  command-selection mistake, not proof evidence or a product blocker. The
  tracked CLI documentation identifies the action-bearing `search` workflow;
  the evidence proof is being rerun against that workflow.

## Run outcomes

### 1. Evidence packets

- `product-catalog` / `search`, Flow lane, exited 0 in 86.6 s. The run,
  evaluation, reported, and oracle verdicts were `passed`; the Flow status was
  `succeeded`.
- All 3 web actions succeeded with `comparisonStatus=matched` and
  `harnessActivations=0`.
- Each action carried one `beforeAction` and one `afterAction` packet: 6 packets
  total. The largest was 5,992 bytes, within the 6,000-byte budget. All 6
  packets were marked truncated, and evaluation `truncationCount` was 6.
- The retained Core event stream contained 3 `beforeAction` state references,
  3 `afterAction` references, and 3 `stateDiff` records: complete coverage for
  the 3 actions.
- Both `runner-verdict` and `evidence-packet-budget` invariants passed.
- External hard-link preservation retained 32 workspace files, including Core
  JSON state and SQLite sidecars. The keeper reported one transient enumeration
  warning while the run was deleting temporary state, but retained the event
  stream needed for the state-reference count.

### 2. The LLM stays off

- W25 `delayed-ui` / `too-slow`, Flow lane, ran 3 times. All exited 0 in
  71.0 s, 76.1 s, and 77.0 s. Each test verdict passed, each reported the
  expected failed Flow as `timeout` / `web.action.timeout`, and each recorded
  `harnessActivations=0`.
- W15 `multi-tab` / `popup-blocked`, Flow lane, ran 3 times. All exited 0 in
  67.9 s, 66.2 s, and 73.0 s. Each test verdict passed, each reported the
  expected failed Flow as `output_not_observed` /
  `web.validation.output_not_observed`, and each recorded
  `harnessActivations=0`.
- The categories therefore match the required prior observations across all
  6 runs, with no harness activation.

### 3. Leak rows with snapshots stored

- `auth-gate` ran 3 times on the recording lane (60.5 s, 55.6 s, 55.3 s)
  and 3 times on the Flow lane (79.3 s, 81.2 s, 78.3 s). All 6 commands
  exited 0; all run and evaluation verdicts passed. Every redaction
  attestation passed with 1 declared literal, 0 findings, and both bundle and
  workspace scopes, including SQLite. The retained workspaces held 30, 31,
  31, 40, 41, and 42 files.
- `sensitive-input` ran 3 times on the recording lane (57.9 s, 55.2 s,
  51.0 s) and 3 times on the Flow lane (77.3 s, 73.0 s, 72.2 s). All 6
  commands exited 0; all run and evaluation verdicts passed. Every redaction
  attestation passed with 2 declared literals, 0 findings, and both bundle and
  workspace scopes, including SQLite. The retained workspaces held 10, 9, 10,
  16, 15, and 15 files.
- Across these 12 accepted commands, 18 declared-literal repetitions were
  attested over 24 bundle/workspace scopes with 0 findings.
- One preliminary `sensitive-input` Flow command omitted its required
  process-only replay inputs and was refused as `environment.missing` before a
  run existed. It is excluded as a command-setup mistake. The accepted Flow
  commands received both values only through their process environment; no
  value was logged or written to this report.

### 4. Provider-free demo

- `demo:record` exited 0 in 108.2 s and returned the bounded status `recorded`.
- `demo:run` exited 0 in 94.0 s and returned the bounded status `passed`.
- Both commands shared one fresh retained workspace and the same three freshly
  generated credentials, supplied only as process variables. Five known
  provider-key variables were removed before either command; the driver
  observed 0 provider variables set.
- The resulting workspace has both a latest recording identity and latest
  runtime-run identity. It left 0 session directories, 0 owned Node processes,
  and 0 listeners on its two fixed loopback ports after shutdown.
- The demo build rewrote 10 tracked files, all under the generated
  `apps/extension/build/` tree. They were restored to the pinned versions after
  both commands completed. The downstream and Core worktrees are clean at the
  exact dispatched pins.
- One preliminary demo driver used static RNG helpers unavailable in this
  PowerShell runtime, so its empty credentials were rejected before a usable
  workspace existed. It is excluded as a driver-setup mistake. The accepted
  driver used the runtime-compatible cryptographic RNG instance API and never
  printed or wrote its credentials.

## Memory guard

- Setup began with 12.29 GiB free. The excluded actionless command began with
  12.09 GiB free and reached a 15-second sampled minimum of 11.589 GiB. No
  other `run-lab.mjs` process was present before it.
- Through proof step 2, 40 memory samples reached a minimum of 8.122 GiB. No
  Lab command began with another `run-lab.mjs` process present.
- Through proof step 3, 96 samples reached a minimum of 7.604 GiB. Every
  accepted command began above the 3 GiB floor and with no other
  `run-lab.mjs` process present; no memory wait or timing-only rerun was needed.
- The complete accepted campaign produced 112 samples. The lowest free memory
  was 6.291 GiB, above both the 3 GiB pause floor and the 6 GiB threshold that
  would govern a timing-only rerun.

## Blocker status

None. The final benches may start at these pins.

## Verified and not verified

Verified live in isolated Chromium/Core:

- the evidence packet count, points, byte budget, truncation count, state-diff
  coverage, action statuses, comparison statuses, and budget invariant;
- 3-of-3 failure categories with the LLM/harness off for W25 `too-slow` and
  W15 `popup-blocked`;
- 3-of-3 leak attestations on both lanes for both secret-bearing scenarios,
  including the workspace and SQLite scope, with retained workspace files;
- the provider-free record-and-run demo; and
- clean exact pins and bounded memory/process cleanup.

Not verified by this worker:

- the two final complete Week 1 benches, their A/B comparison, or the final
  blocker ranking;
- any headed/manual inspection outside the automated demo and Lab browser
  sessions; or
- Firefox behavior.
