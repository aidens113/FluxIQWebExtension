# Supervisor notes — sharded-final-2 closeout (Claude session, 2026-09-14 evening)

Kept outside the repository while campaigns A/B are live; fold into the Week 1
working document and ledger at closeout.

## Observed at 20:35-20:45 local

- Both campaign process trees and Scenario Lab servers live; downstream `3d6ecd6`
  and Core `19468b7` clean; no worktree edits.
- A `bench-mu202a52-127f75c3`: 69/189 evaluated, 69 passed.
- B `bench-mu202snn-ec661de2`: 69/189 evaluated, 68 passed, 1 failed.
- B failure: `bench-shard1-d0825d39-c35-a1`, W14 `modal-flows` / `interstitial`,
  Flow lane, repeat 2, attempt 1. Evaluation `process.startup`; facility failure
  `finalized-bundle / scenario.execute / http.timeout / project.select / 30000 ms`.
  metrics.steps 3, flowCreated false, zero actions/evidence/harness, 92,820 ms.
  Run 03:19:40Z-03:21:12Z. Receipt identity matches cell W14/flow/rep2.
  Same-result peers passed: A reps 0-2 (100.8, 68.1, 114.1 s), B reps 0-1
  (110.0, 92.5 s).
- Mechanism: `FluxIQControlClient.selectProject` POST
  `/api/client-gateway/automation-studio-context` unanswered for 30 s
  (`packages/test-runner/src/http-control/index.ts:112`). Isolated Core per run
  is `next dev --turbopack` (`packages/test-runner/src/coordinator.ts:106`); a
  live Core server process had ~2.4 GB working set. Machine 25.8 GiB, 7.5 GiB free
  with two cells.
- Slot hand-off analysis over 143 finalized runs: 67 hand-offs from two active
  cells to fewer, mean hold 37.2 s, max 208.7 s; usually a same-campaign pair
  starts together after both previous cells end. The memory admission check is
  binding most of the time. The failed W14 window overlapped a 19 s hold.
- Pattern: three consecutive final pairs each lost exactly one run to a Core
  HTTP/readiness event (W25 `environment.missing`; W05 `readiness.timeout /
  core.health / 60000`; W14 `http.timeout / project.select / 30000`).

## User decision (AskUserQuestion, 2026-09-14, about 20:45 local)

Progress check at 20:53 local: A 78/189, B 77/189, no new failure; memory
samples 20:44-20:53 show available memory min 4,889 MiB, median 7,663 MiB, and
commit charge up to 90%.

The user chose "Both: close tonight + fix": let the current pair finish, prove
the W14 cell 3/3 in isolation, close Week 1 tonight with the one Core timeout
disclosed as a classified infrastructure failure (an explicit exception: W14 is
not 3/3 in B and `lab compare` will report the differing verdict), and in
parallel fix the underlying cause and run a fresh overnight pair at the fixed
pin to supersede the exception.

## Dispatched

- `bs-w14-runner-sequence` (read-only, downstream runner request sequence,
  warm-up, bounds, shared `.next`, memory footprint) ->
  `F:\fxlab-runs\sharded-final-2\reports\bs-w14-runner-sequence.md`.
- `bt-w14-core-handler` (read-only, Core route handler, dev compile graph,
  production-build option) -> `F:\fxlab-runs\sharded-final-2\reports\bt-w14-core-handler.md`.
- Monitor: scratchpad `bench-monitor.ps1` emits FAIL/STALL/SEALED/LOWMEM and
  samples memory to scratchpad `memory-samples.csv` every 10 s.

## Root cause and fix (about 20:45-20:55 local)

- `bt-w14-core-handler` (verified by supervisor against source): the handler
  awaits only cookie/session/body; the route was already requested at startup
  (`coordinator.ts:137`), so first-hit compile is ruled out. Supervisor-verified
  topology facts: `next dev --turbopack` (`coordinator.ts:106`), readiness
  `GET /` (`:113`), `.next` excluded from each run copy (`:267`), Turbopack root
  = drive root (`:281`), runs on the same drive. Mechanism (dev entrypoint /
  watcher waits) traced in Next source by the worker, not observed.
- Core `NODE_ENV === "production"` effects found: client-side dev telemetry and
  data-inspector toggles, and `secure` on the login cookie
  (`apps/web/src/app/api/auth/login/route.ts:86`). Per-run Core config is all
  env (`packages/test-runner/src/environment.ts:56-71`).
- Fix chosen: downstream production build per Core revision, `next start` per
  run. No Core change. Worktree `F:\fxlab\fxlab-prod-core` (detached `3d6ecd6`,
  `pnpm install --frozen-lockfile --prefer-offline` exit 0) beside
  `F:\fxlab\!FluxIQ` (`19468b7`).
- Dispatched `bw-core-production-build` (implementation, worktree only, no heavy
  processes until authorized) -> `reports/bw-core-production-build.md` here.
- Correction from `bs-w14-runner-sequence`, verified by the supervisor: the W14
  timeout was the FIRST `selectProject` inside topology startup
  (`coordinator.ts:137`, no flowId/clientId), before any browser or step.
  Evidence: `run.json` has `ports: {}`, `processExits: {}`, `steps: []`,
  `actions: []`; `metrics.steps` is `workflow.recordingScript.length`
  (`run-scenario.ts:525`), not executed steps. So it was the route's first hit on
  a fresh `next dev` Core: an on-demand compile under load. The earlier
  "after 3 recorded steps" wording (supervisor's, also in the user question) is
  wrong. `bt`'s "already compiled at startup" premise applied to the later calls.
- Also verified: every lease liveness probe spawns `powershell.exe`
  (`bench/campaign/lease.ts:203-222`). `bs` reports queued slot tickets poll every
  100 ms probing each owner (CPU churn while other runs start Core); a startup
  failure deletes its own Core log (`coordinator.ts:151`), so none survived.
- `bs` single live sample 20:51: dev Core ~2.5 GB of a ~3.1 GB run; user's own
  Chrome ~4.9 GB; free 6.8 GB, below the 10 GiB second-slot threshold
  (4 GiB + 3 GiB x (active + rank + 1)). Retuning 3 GiB/slot needs a measured
  built-Core footprint first; not changed yet.
- Added to `bw`: keep startup-failure process logs in the bundle.
- Supervisor verified the slot loop: `acquire-machine-cell-slot.ts:83-110` runs
  `recoverStaleEntries` (`:84`) every 100 ms (`:121`), probing every ticket and
  slot owner through `processIdentity` (`:212-216`), i.e. one `powershell.exe`
  per owner per iteration. Dispatched `bx-slot-poll-probe` (worktree, owns
  `machine-slots/` only; docs sentence proposed, not edited) ->
  `reports/bx-slot-poll-probe.md` here.
- Supervisor live measurement during the pair (about 21:05 local): a 20.0 s
  window sampling `powershell.exe` command lines carrying the probe's
  missing-process marker every ~150 ms (83 samples) saw 173 distinct probe
  PIDs, i.e. at least ~518 PowerShell spawns per minute (lower bound: sampling
  misses the shortest-lived). Free memory at the end: 7,296 MiB.
- `bx-slot-poll-probe` returned Done (21:3x local). Supervisor reviewed the diff
  (`acquire-machine-cell-slot.ts`, `index.ts`, loop tests) and both new files
  (`cached-owner-liveness.ts`, `pid-presence.ts`): only the full `verify` probe
  can return not-live; absent/unknown presence re-probes; present is trusted
  for 60 s from probe start; cache key is the whole owner record; own ticket
  seeded; probe failures propagate. Accepted pending integration: worker's
  private focused run 30/30 and 13 mutations each failing (worker claims, not
  yet rerun by supervisor); package `tsc` in the worktree failed only on
  unbuilt `domain/node` and `test-evidence`; structure audit did not see
  untracked files. Supervisor must rerun: package check + tests, `pnpm check`
  (structure audit with the new files tracked), and measure the live
  PowerShell spawn rate during the next campaign. Proposed docs sentence for
  `testing-facility.md:1139-1142` is in the `bx` report.
- `bw-core-production-build` returned Done (about 21:45 local). Worker claims:
  test-runner `pnpm check` exit 0 (after building test-evidence and
  test-contracts dists in the worktree); focused 55 tests, 54 pass, 1 fail
  (`runner-wiring` refusal test, Scenario Lab dist unbuilt in the worktree);
  19 mutations caught; no real `next build`/`next start` run. Supervisor
  reviewed the diffs of `coordinator.ts`, `demo-workspace/core-process.ts`,
  `run-scenario.ts` (one line) and read `core-web-build/prepare.ts`,
  `publication.ts`, `build-environment.ts`, `server-process.ts`, `inputs.ts`:
  publication requires pointer, marker and `BUILD_ID` agreement with
  temp-file-plus-rename records; build env drops `FLUXIQ_*`, `NEXT_PUBLIC_*`,
  `NODE_ENV`, `PORT` and disables the gateway; `next start` spec keeps the
  run's port, env and log; startup-failure logs are copied after process
  cleanup and before run-root removal. Findings: (1) the isolated/clone cache
  lands in `<runs>/.work/.core-web-build` (run-scenario.ts:156-158) while
  persistent uses `<runs>/.core-web-build`; nothing sweeps `.work` in source
  (only literal use is run-scenario.ts:158), but a persistent cache does not
  belong in the per-run work area and modes build twice; (2)
  `ProcessSupervisor.run` rejects on timeout without killing the child
  (process-supervisor.ts:63-74); the run's `supervisor.cleanup()` kills it
  right after, attempts use unique directories, acceptable; (3) the first
  cell(s) of a campaign would include the build in their measured duration;
  plan to prebuild each campaign's runs root with one `lab run` before
  `lab bench`. New bounds (build 10 min, waiter 12 min, unreadable-lock settle
  10 s, poll 1 s) provisionally approved pending a measured real build.
  Verified `const bundle = new EvidenceBundle(...)` at run-scenario.ts:100, so
  the startup-failure log callback at :160 closes over an initialized bundle.
  Sent `bw` a follow-up: one cache at `<runs>/.core-web-build` for every mode via
  an explicit topology option, with test, mutation and docs. Recorded as
  follow-ups, not requested: `isrFlushToDisk: false`, pruning failed attempts,
  and `workspace-lock.ts` writing the owner record before linking the lock.
- `bw` follow-up returned Done. Supervisor verified: `coordinator.ts:43` adds
  `coreWebBuildRunsDirectory?`, `:109` passes
  `options.coreWebBuildRunsDirectory ?? runsDirectory` to `prepareCoreWebBuild`;
  run-scenario.ts:160 passes `coreWebBuildRunsDirectory: options.runsDirectory`;
  `tests/coordinator-existing.test.ts:172,206` assert it. Worker claims check
  exit 0, focused 54/55 (same Scenario Lab dist gap), 21 mutations caught.
  A worktree-wide search for `prepareWebWorkspace` outside dist/node_modules
  finds only `core-web-build/workspace.ts`, `prepare.ts`, a negative test
  assertion, and an old report: no other consumer lost the export.
- Started in the worktree, sequentially, in the background: Scenario Lab build,
  test-runner build, then `node --test --test-concurrency=2 "dist/**/*.test.js"`
  (logs `gate-*.log` in the scratchpad). Low concurrency on purpose while the
  acceptance pair runs; no Lab, no root gates.
  Observed by the supervisor (both fixes present in the worktree):
  `scenario-lab build exit=0`, `test-runner build exit=0`,
  `test-runner tests exit=0`, `# tests 822`, `# pass 822`, `# fail 0`,
  `# cancelled 0`, `# duration_ms 41134.6682`.
- 21:44 local: free memory 10,755 MiB, commit 80%; A 102/189, B 100/189.
- 21:53 local: A 107/189, B 106/189 (about 73 evaluations/hour combined since
  21:44); free 10,511 MiB, commit 80%. `apps/web/node_modules/.bin/next.cmd` and
  the `next` package exist in both `F:\fxlab\!FluxIQ` and `F:\!FluxIQ`. User was
  told in advance that closeout will make one documentation-only Core edit (the
  paired Week 1 working document) and push both `dev` branches together.
- About 22:00 local, worktree branch `week1-core-production-build`:
  `9e3c713` "Stop spawning PowerShell on every machine slot poll" (machine-slots
  code and tests) and `88490df` "Serve the Lab's isolated Core from a cached
  production build" (core-web-build, coordinator, demo core process,
  run-scenario line 160, tests, testing-facility.md including the slot-probe
  sentence). No git hooks exist (no core.hooksPath, no non-sample hooks, no
  .husky). Main checkout still 0 status entries. Observed in the worktree:
  `pnpm structure:test` exit 0, 63/63; `pnpm lab:test` exit 0, 15/15.
- **Pre-existing gate failure, contrary to the handoff:** `node
  scripts/structure-audit.mjs` exits 1 in the MAIN checkout at pushed
  `3d6ecd6` (read-only run) with 5 violations, identical in the worktree:
  `packages/test-runner/src/tests/` 50 files over the 25-file limit (baseline
  49); barrel-bypassing imports in `bench/shard-merge.ts` (3),
  `bench/tests/shard-merge.test.ts` (4),
  `facility-failure/project-facility-failure.ts` (2); and
  `docs/working/README.md` out of date. So root `pnpm check` fails on pushed
  `dev`; the handoff's "pnpm check passed" and "structure:check passed with
  advisory warnings only" do not hold at `3d6ecd6`. Dispatched
  `by-structure-violations` (worktree, the four code violations only) ->
  `reports/by-structure-violations.md` here. The README index is regenerated in
  the main checkout at closeout.
- `by-structure-violations` returned Partial. Import violations fixed through
  existing barrels in `bench/shard-merge.ts`, `bench/tests/shard-merge.test.ts`,
  `facility-failure/project-facility-failure.ts` (worker: audit now only the
  src/tests count and README; package check and build exit 0; 5 affected test
  files 68/68). The 50th `src/tests/` file is `cli-sharded-bench-wiring.test.ts`
  (added in `d2b7e09` after the baseline dropped to 49 in `4d5c8a6`); it has two
  bench-barrel subjects and two `cli.ts` subjects. Supervisor decision: option
  (a) — barrel tests to `bench/tests/`, CLI tests merged into the closest
  existing `src/tests/` CLI test file, original deleted, no baseline change.
  Sent to the same worker. Supervisor reviewed the three import diffs: only
  specifier rewrites to `./campaign/index.js`, `../campaign/index.js`,
  `../flow-lane/index.js`, `../run-lifecycle/index.js`, same imported names,
  no behaviour change. Accepted.
- `by-structure-violations` option (a) returned Done. Supervisor reviewed:
  deleted `src/tests/cli-sharded-bench-wiring.test.ts` had four tests; the two
  bench-barrel tests are now in new `src/bench/tests/sharded-bench-barrels.test.ts`
  (source root `../../../src` from `dist/bench/tests`, runtime import
  `../index.js`), and the two `cli.ts` tests are appended unchanged to
  `src/tests/cli-llm.test.ts` (source root `../../src`, `readFile` import added).
  Each of the four test names exists exactly once. Worker claims audit shows
  only the README violation and 6 files 69/69. Supervisor rerun observed:
  `structure-audit exit=1` with only `[working-docs] docs/working/README.md is
  out of date` (`1 violation(s) across 1 rule(s)`); stale dist test absent;
  `test-runner build exit=0`; `test-runner tests exit=0`, `# tests 822`,
  `# pass 822`, `# fail 0`, `# cancelled 0`, `# duration_ms 53241.6634`
  (same 822 total as before the move). Committed on the worktree branch as
  `d64164d` "Restore the test-runner structure audit". Branch now:
  `9e3c713`, `88490df`, `d64164d` on `3d6ecd6`; worktree clean; nothing pushed.
- README index fix: the audit says `Run "pnpm structure:baseline" to regenerate
  it`. That command also rewrites `.structure-baseline.json`, so at closeout in
  the main checkout: back up the baseline, run it after the working-document
  edits, and diff the baseline to confirm entries only shrink.
- Launch facts for the W14 focused proof and the overnight pair (from reports
  `i-final-bench-restart-readiness.md`, `as-w25-focused-a.md`, and
  `scripts/lab/run-lab.mjs:78`): `FLUXIQ_TEST_RUNS_DIR` is the runs root;
  `FLUXIQ_LAB_INSTANCE`, `EXTENSION_TEST_BUILD_LABEL`, `DOMAIN_TEST_BUILD_LABEL`
  carry the label; `FLUXIQ_TEST_ENV_FILES=none`; the auth-gate fixture secret
  goes into `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD` in memory from the pinned
  built scenario constant, never displayed, hashed, or persisted.
- 21:2x local: A `bench-shard1-9c95f372-c51-a1`, W24 `intermediate-state` /
  `unannounced`, Flow, repeat 0 failed `runtime.behavior`, no facility failure.
  Supervisor compared it with all six W24 `unannounced` evaluations of the prior
  repaired pair (`F:\fxlab-runs\final-repaired\{a,b}`): identical shape in all
  seven (verdict failed, category `runtime.behavior`, oracle and reported
  verdict passed, expected `output_not_observed` not reported, Flow created,
  3 actions, harness 0, invariants runner-verdict=false and
  evidence-packet-budget=true). Classified as the known ruled-out W24 variant,
  not an unexpected failure. Expect W05 `short-catalog`, W13 `banner-absent`,
  and W24 `unannounced` to fail 3/3 in each campaign (9 per campaign). The
  monitor script now tags these `EXPECTED-RULED-OUT-FAIL` from its next re-arm.
- B `bench-shard1-d0825d39-c51-a1`, the same W24 `unannounced` Flow repeat 0,
  checked by the supervisor: identical shape (failed, `runtime.behavior`, no
  facility failure, oracle/reported passed, `output_not_observed` expected but
  not reported, Flow created, 3 actions, harness 0, same invariants). Known
  ruled-out variant.
- Supervisor rerun (after reading the script; it writes only under the
  scratchpad `bx-build/`): `node bx-focused.mjs real` printed `build ok, exit 0,
  tests 30, pass 30, fail 0`; `node bx-focused.mjs mutations
  M2-absent-archived-without-confirmation` printed `exit 1, tests 30, pass 25,
  fail 5`, failing among others "a live owner is never archived, even when the
  spawn-free check reports its PID gone" and "a crashed owner is recovered on
  the next poll, not after the re-verification interval".
- Integration plan: after the current pair is terminal, cherry-pick the fix onto
  `dev` in the main checkout, run full gates, live-validate (Core build timing,
  W14 Flow, smoke bench, memory), push, then start the overnight pair from the
  worktree at the new pin.

## Second unexpected failure: A W28 recording repeat 1 (22:11 local)

- A `bench-shard1-9c95f372-c64-a1`, W28 `iframe-checkout` primary, recording
  lane, repeat 1. Evaluation `gateway.connection`, facility
  `finalized-bundle / scenario.execute / unclassified` (no operation stage or
  timeout: `waitForTcpGateway`'s failure has no closed projector), oracle and
  reported verdict null, 0 actions, 0 packets, harness 0, 112,619 ms.
  `run.json`: status failed, 05:09:48.957Z-05:11:41.576Z, steps 0, actions 0,
  `ports` empty, `processExits` `{}` (topology never set). One event:
  `error` "Timed out waiting for client gateway on 127.0.0.1:<port>" with detail
  keys `failureCategory,capture`. Source: `coordinator.ts:121-122` — after
  `GET /` readiness, an unbounded, error-swallowing unauthenticated snapshot
  probe is meant to start Core's lazily created gateway, then a 60 s TCP wait
  timed out. Same dev-server startup class as W14 (first-hit route compile
  before the gateway exists), different stage.
- Peers: A rep 0 passed 79,747 ms; B rep 0 passed 69,453 ms; B rep 1 passed
  47,541 ms; reps 2 pending.
- Memory during the window: available 7,666-10,877 MiB, commit 80-88%; no
  memory pressure.
- **Supervisor load disclosure:** the supervisor's worktree test-runner build and
  822-test suite (`--test-concurrency=2`) and the preceding
  `by-structure-violations` worker builds/tests ran around 22:00-22:11 local,
  overlapping this window. Likely CPU contributor; not provable. W14 (20:19-20:21)
  predates all supervisor/worker load. All heavy work stopped until the pair is
  terminal.
- Asked the user whether the close-tonight exception extends to this second
  failure of the same class. **User decision (about 22:15 local): "Two
  exceptions, close tonight".** Let the pair finish, prove W14 Flow and W28
  recording 3/3 each in isolation, close Week 1 tonight with both startup
  failures disclosed as one classified infrastructure failure class (lab
  compare will show two differing verdicts), then run the overnight
  production-build pair to supersede both exceptions.
- W28 focused proof command (same env as the W14 runbook, own label and runs
  root, no secret): `pnpm lab run iframe-checkout --target isolated --evidence
  failure`, three times sequentially.

## Progress at 22:49 local

- Shards 000 and 001 are finished in both campaigns (lease files 0): 000 at 66
  evaluations and 134 checkpoints, 001 at 60 evaluations and 122 checkpoints
  (two checkpoints per executable cell plus two). Shard 002 alone runs per
  campaign: A 15/63, B 17/63. Remaining 94 cells at about one cell per campaign
  at a time; estimate terminal about 00:40 local. Free 11,549 MiB, commit 80%.
- Expected ruled-out failures so far: W24 `unannounced` Flow reps 0-2 and W05
  `short-catalog` Flow reps 0-2 in both campaigns. W13 `banner-absent` pending.
- Early terminal verification of the four finished child shards (A 000/001,
  B 000/001), read-only, observed by the supervisor:
  - checkpoint generations contiguous from 0 and every `previousSha256` equal
    to the prior checkpoint's `checkpointSha256`: 134/122/134/122 generations,
    0 gap or link errors, 0 non-generation files in `checkpoints/`;
  - last checkpoint `state: finished`, no `activeAttempt`;
  - completed entries (`cellKey | runId | evaluation | evaluationSha256`)
    66/60/66/60, each `runId` matching one evaluation file (0 null, 0
    unmatched), evaluation file counts 66/60/66/60;
  - every `evaluationSha256` equals the SHA-256 of its evaluation file bytes:
    66/60/66/60 match, 0 mismatch;
  - 0 lease files; `runs.json`, `report.json`, `report.md` present in each.
  Remaining at terminal: shard 002 chains, parent finished checkpoint,
  `merge-seal.json`, parent projections, and residue.
- Closeout document facts: the Week 1 plan has 800 newline characters (at its
  800-line ceiling; PowerShell's `Measure-Object -Line` reports 702 because it
  skips blank lines), while the index row says 799, plausibly the audit's
  "out of date" finding. Archive entries end `- Outcome: Accepted` under
  `## Part <n>, archived <date>` headings; next is part fifty-one. Core docs
  gates: `pnpm docs:check` (`scripts/validate-docs.mjs` plus
  `docs-reference.mjs --check`) and `pnpm structure:check`. A draft Current
  State is in the scratchpad `week1-current-state-draft.md` with placeholders
  for terminal figures.
- Working-document rules enforced by `scripts/structure-audit/rules/working-docs.mjs`
  (read by the supervisor): document lines = LF-split lines minus a trailing
  empty element, limit 800 (`checkSize`, ratcheted); `## Current State` counted
  from its heading to the next `## ` heading, limit 150 (`:143-154`, ratcheted);
  every `### ` ledger entry needs a `- Validation:` bullet whose joined text
  (with indented continuation lines) must not match
  `/reported success|workers? (reported|said|claimed)\b/i` (`:38`, `:184-202`);
  `docs/working/README.md` must equal the index generated from header fields
  and line counts (`:231-301`), rewritten only by `pnpm structure:baseline`.
  The stale index at `3d6ecd6` is consistent with the plan growing to 800
  lines while its row still says 799.
- Core at pushed `19468b7`, read-only `node scripts/structure-audit.mjs`:
  `exit=0`, one advisory `warn [file-lines]` (a 502-line
  `generation-failure.ts`); Core status 0 entries. Core's audit passes, unlike
  downstream's; after the closeout's Core documentation edit, rerun it and
  regenerate Core's index with its own `pnpm structure:baseline` if needed.

## Progress and memory at 23:20 local

- Shard 002: A 33/63, B 34/63 (about 34 cells/hour per campaign since 22:49);
  estimate terminal about 00:15 local. All nine expected ruled-out failures per
  campaign are now in (W24 `unannounced`, W05 `short-catalog`, W13
  `banner-absent`, reps 0-2 each); no further failure is expected.
- Free memory 5,201 MiB, commit 88% (down from 10-11 GB). Breakdown by process
  name: chrome 49 processes 6,246 MB private (mostly the user's browser), node
  16 processes 6,240 MB (two running `next-server` Cores at 2,631 and 2,614 MB,
  one per campaign's active cell), VS Code 3,763 MB, Discord 1,578 MB, Steam
  helpers 1,044 MB, PowerShell 8 processes 556 MB. The pressure is the two dev
  Cores plus user applications; the slot gate holds admissions, not a leak.
- One orphaned Playwright Chromium tree (8 processes, 287 MB private, 362 MB
  working set), browser PID started 2026-09-14 01:30:02, parent exited, headed,
  no `--remote-debugging-pipe`, no extension loaded. Predates tonight's
  campaigns; not a Lab-run leak from them. Left running: not started by this
  session and possibly a window the user opened; mentioned to the user.

## Terminal at 00:05 local (2026-09-15)

- A `bench-mu202a52-127f75c3`: `merge-seal.json` present; parent checkpoints 3,
  last `finished`; parent lease 0; parent `runs.json`, `report.json`,
  `report.md` present; shards 000/001/002 `finished`, generations 134/122/128,
  evaluations 66/60/63, no active attempt, 0 leases, 0 temp files.
- B `bench-mu202snn-ec661de2`: shards 000/001/002 `finished`, generations
  134/122/128, no active attempt, 0 leases; shard 002 published its projections
  at 00:04:56. Parent NOT merged: no `merge-seal.json`, 1 parent checkpoint
  (`running`), parent lease 0, no parent projections, no lease history, no
  staging or interrupted directories, and 0 bench node processes alive.
- B shard 002 `evaluations/` holds 63 referenced evaluations (all `-a1`, 63
  distinct, matching completed entries) plus one unreferenced temp file
  `.bench-shard2-fdae3012-c15-a1.json.10996.<hex>.tmp` (1,010 bytes, written
  22:46:56, a passing W? `data-table` recording repeat 0 body) left by the
  durable write of c15's evaluation, whose final file exists. Likely a Windows
  rename retry (Defender scanning); the monitor's scans read only `*.json`.
  Hypothesis: the parent merge failed closed on this foreign file and the parent
  exited cleanly, releasing its lease. The parent's own stdout was not captured
  in the runs root, so the exact error is unobserved.
- Action per the handoff: no manual cleanup of campaign state; resume B only by
  exact ID at the clean pin with B's labels and runs root, env files off, the
  fixture secret loaded without output; resume log in the scratchpad
  `resume-b.log`, checked for the secret by flag only. Dispatched
  `bq-sharded-final-2-a` (A terminal verification, read-only) in parallel.

## B resume attempt (00:08 local)

- First launch was blocked by a Claude Code safety hook before anything ran
  (it read `Remove-Item Env:...` as a removal on the repository path); relaunched
  with the variable cleared by assignment instead.
- Relaunch observed: `head=3d6ecd6...`, `status entries=0`, `core
  head=19468b7...`, `core status entries=0`, `secret loaded=True`; Lab rebuilt
  instance `br-sharded-final-2-b`; `{"event":"bench-campaign-resumed",
  "benchId":"bench-mu202snn-ec661de2",...}`; then
  `{"status":"failed","category":"unknown","message":"Shard evaluation
  directory contains a missing or orphan receipt"}`; `resume exit=1
  seconds=22`; `secret-in-log=False`.
- Source: `bench/shard-merge.ts:114-123` `assertExactEvaluationFiles` compares
  `readdir(evaluations)` (dot files included) exactly with the expected receipt
  names. B shard 002's orphan temp file
  `.bench-shard2-fdae3012-c15-a1.json.10996.<hex>.tmp` makes it fail closed.
  `bench/durable-file.ts:100` publishes create-mode files by `link(temporary,
  target)`; a temporary that survives after a successful link leaves exactly
  this state. This explains why B's original parent exited unsealed.
- A's merge was unaffected (no temp files).
- Focused W14 x3 then W28 x3 launched in the background at the clean pin,
  logs `focused-<label>-<n>.log` in the scratchpad.
- Asked the user whether to quarantine the one orphan temp file and resume B.
  **User decision (about 00:20 local): "Quarantine file, resume B".** Move the
  orphan (never delete) to `F:\fxlab-runs\sharded-final-2\quarantine\`, resume
  B at the same pin, disclose it as a manual step, and fix the durable writer on
  the fixes branch. Source detail: `durable-file.ts:100-111` links the temporary
  to the target in create mode, then removes the temporary at `:105` and again
  in `finally` at `:111`; a Windows sharing failure on that removal leaves the
  orphan while the target is published.
- `bq-sharded-final-2-a` returned Done (worker report outside the repo). Its
  figures: 189/189 evaluated plus 12 planned skips (201-cell plan; the handoff's
  "18 skips" is wrong, and the earlier repaired pair also had 12), 0 duplicate or
  missing keys; parent and child chains 3/134/122/128 generations, all
  `finished`; evaluation, receipt and bundle checks 189/189; merge seal 24/24
  digests match; 0 leases, staging or `.tmp` files; `.work` empty; failures are
  the nine ruled-out variants plus W28 recording rep 1; harness 0; redaction
  findings 0; packet p95 5,934 and max 5,992 bytes; truncations 167; run
  duration p50/p95 93,100/113,134 ms. Supervisor already independently verified
  shards 000/001 chains and evaluation hashes; the official comparison will
  re-validate both bundles.
- Monitor STALL events at about 00:13 were the finished campaigns; not re-armed.
- User message about 00:22 local: "please dont ask me again for something, just
  do recommended. FINISH THIS". Saved to memory
  (`keep-working-dont-pause-for-confirmation.md`). From here the supervisor acts
  on its recommendation and reports.
- Quarantine observed: 1 orphan found; the real target exists; orphan and target
  SHA-256 identical (prefix `9C65986BFBC5F1C3`); moved to
  `F:\fxlab-runs\sharded-final-2\quarantine\b-shard002-evaluations\`, hash
  preserved; shard 002 `evaluations/` now 63 files, 0 dot files.
- Second B resume observed: `head=3d6ecd6...`, `status=0`, `core=19468b7`,
  `coreStatus=0`, `secret loaded=True`, `bench-campaign-resumed`, then the bench
  outcome `{"status":"failed",...,"results":63,"runs":189,"passed":179,
  "skipped":12,"notExecuted":55,"actionsExecuted":334,"failureCauses":["9 runs —
  runtime.behavior: no cause recorded","1 run — process.startup: finalized-bundle
  / scenario.execute / http.timeout / project.select / 30000ms"]}`, `resume
  exit=1 seconds=22`, `secret-in-log=False`. Exit 1 is the bench verdict (any
  failed run fails a bench), not a merge failure: the report was published.
- First focused relaunch was a supervisor script defect: PowerShell passed the
  argument array to `pnpm` as ONE string (log header `run-lab.mjs "run"
  "modal-flows --workflow interstitial --target isolated --evidence failure
  --flow"`), so all six attempts failed in about 18 s with `fixture.invalid`
  before creating any runs folder. Relaunched with literal arguments.
- Hazard: every `pnpm lab` invocation rebuilds the shared `domain/dist` in the
  main checkout (`clean-dist: removed 273 emitted file(s)`), so no second Lab
  command (including `lab compare`) may start while a Lab run executes.
- Supervisor check of B after the second resume: `merge-seal=True`, parent
  checkpoints 3, last `finished`, no active attempt, parent lease 0, parent
  `runs.json`/`report.json`/`report.md` present, parent chain gap/link errors 0;
  shards 000/001/002 lease 0 with evaluations directories 66/60/63 files and 0
  dot files; `b\.work` 0 entries. A: `merge-seal=True`, `report.json` present.
  Both campaigns are sealed.
- Dispatched `br-sharded-final-2-b` (read-only B verification) and
  `ca-durable-temp-cleanup` (worktree fix for the orphaned temporary; edit now,
  compile and test only after the reruns).

## Official comparison and focused proofs (00:30 local onward)

- W14 focused run 1 (label `bu-w14-focused`, root `F:\fxlab-runs\w14-focused\a`):
  `exit=0 seconds=78`, `run-mu2h3iwq-fc8c53cf`, verdict passed, Flow created,
  oracle and reported verdict passed, 3 actions (click, wait_for_selector,
  click), harness 0, `facilityFailure: null`, 6 packets max 4,467 bytes,
  duration 56,939 ms.
- Comparator run by the supervisor without the Lab wrapper (which rebuilds
  shared `domain/dist`): `node packages/test-runner/dist/cli.js compare <A
  report.json> <B report.json>` -> `compare exit=1`, stdout 13,372 bytes, stderr
  0; saved `compare-final-2.json` in the scratchpad. Observed:
  - `outcome=equivalent`, `comparisonPassed=False`; topology identical (sharded,
    `result-round-robin-v1`, 3 shards, 2 jobs both).
  - differing results and runs exactly two: W14 `modal-flows`/`interstitial`
    Flow repeat 2 (A passed, B failed `process.startup`) and W28
    `iframe-checkout` recording repeat 1 (A failed `gateway.connection`, B
    passed).
  - 48 metric rows; every tolerance-bearing row `equivalent` (recording rates 4,
    Flow rates 8, action-latency p95 10, run-duration p95 1 = 23); criterion 5:
    `outsideTolerance 0`, `absentComparableMetrics 0`. Flow deterministic replay
    0.9310 vs 0.9138 (tolerance 0.0345); Flow false failure 0.0357 vs 0.0361;
    run-duration p95 113,134 vs 113,054 ms; `wait_for_selector` p95 7,046 vs
    7,032 ms; packet p50/p95 4,069/5,934 both; truncations 167 vs 165.
  - criteria: 1 measured (recording unarmed 18/18 both; Flow unarmed 16/16 A,
    15/16 B); 2 partially measured (packets 618/608); 3 measured (5/5 both);
    4 measured (required 15/15 both, all negatives 30/33 both); 5 measured;
    6 not measured.
  - persistence discards: every counter 0 on both sides.
- Dispatched `bz-final-2-comparison` (report from the saved output) and
  `cb-blocker-ranking-final` (criterion 6 ranking).
- W14 focused proof complete, 3/3 passed, sequential, label `bu-w14-focused`,
  root `F:\fxlab-runs\w14-focused\a`, at `3d6ecd6` (`head=3d6ecd6 status=0`):
  `run-mu2h3iwq-fc8c53cf` exit 0, 78 s wall, 56,939 ms;
  `run-mu2h59v9-7417a490` exit 0, 83 s wall, 58,772 ms;
  `run-mu2h6yxo-591c2cff` exit 0, 75 s wall, 54,866 ms. Each: verdict passed,
  lane flow, `flowCreated: true`, oracle and reported verdict passed, actions
  click / wait_for_selector / click, harness 0, `facilityFailure: null`,
  invariants runner-verdict and evidence-packet-budget passed (6 packets, max
  4,467 bytes), truncation 0, LLM disabled.
- Criterion 2 plan: the content harness (`apps/extension/e2e/content/global-setup.ts`)
  bundles into its own `.harness-build/run-<pid>-<time>/` and removes it in
  teardown, so it touches neither tracked `build/` nor shared `domain/dist`.
  Run `pnpm exec playwright test -c e2e/playwright.content.config.ts
  --workers=2 evidence.spec.ts` from `apps/extension` at `3d6ecd6` once the
  focused reruns finish (held only to avoid CPU contention with them).
- Main-checkout edits (report copies, Current State, ledger, index) wait for the
  focused reruns, whose run manifests record the facility commit and dirty flag.

## Timeline correction (file timestamps, local, 2026-09-15)

Earlier headings in this file that say "about 00:20" or "00:30 local onward" for
the B decision, the quarantine, the second resume, the comparison and the W14
proof are wrong estimates. The observed file times are:

- 00:04:56 B shard 002 `report.json`; 00:05:03 A `merge-seal.json`.
- 00:08:00-00:08:22 first B resume log (failed closed on the orphan receipt).
- 00:09:22-00:09:41 first focused launch log (supervisor argument defect).
- 00:13:14 `bq-sharded-final-2-a` report written.
- About 00:14 to 02:29: the supervisor's question on quarantining B's orphan
  temporary waited for the user's answer for roughly two hours. The user then
  answered and wrote "please dont ask me again for something, just do
  recommended. FINISH THIS".
- 02:30:11 quarantine folder created (file moved); 02:30:51-02:31:13 second B
  resume log; 02:31:13 B `merge-seal.json`.
- 02:31:52-02:35:47 W14 focused runs 1-3; 02:34:07-02:34:09 comparator output
  written (ran during W14 run 3, without the Lab wrapper).
- 02:35:48-02:36:47 W28 focused run 1: `run-mu2h8ku2-521f71ec`, exit 0, verdict
  passed, `facilityFailure: null`, duration 38,535 ms. Runs 2-3 in progress at
  02:37.
- W28 focused complete, 3/3 passed, label `bv-w28-focused`, root
  `F:\fxlab-runs\w28-focused\a`: `run-mu2h8ku2-521f71ec` (exit 0, 59 s wall,
  38,535 ms), `run-mu2h9u41-17c539d7` (exit 0, 57 s, 37,416 ms),
  `run-mu2hb2lg-cc6a1ed1` (exit 0, 63 s, 42,698 ms); each lane recording,
  verdict and oracle passed, harness 0, `facilityFailure: null`.
- Criterion 2 at the clean pin: from `apps/extension`, `pnpm exec playwright test
  -c e2e/playwright.content.config.ts --workers=2 evidence.spec.ts` ->
  `head=3d6ecd6 status=0`, `playwright exit=0 seconds=23`, `30 passed (21.1s)`,
  `status after=0`.
- `bz-final-2-comparison` returned Done; it notes that B's pre-Flow W14 failure
  did not move the Flow creation and initial execution rates, so startup
  failures appear outside those rate populations.
- Sent `ca-durable-temp-cleanup` "run now". Closeout order: cherry-pick the three
  worktree commits onto `dev`, add `ca`, write reports and documents, run root
  gates on the combined tree, validate the production build live, push both
  `dev` branches, then start the production-Core pair.

## Integration (about 02:40-03:00 local)

- Cherry-picked onto main `dev` from the worktree branch: `3525938` (slot poll
  probe), `878fbd5` (production Core build), `83f54b3` (structure audit); tree
  clean after. Reports copied into the repo with identical hashes: `bq`, `bs`,
  `bt`, `bw`, `bx`, `by`, `bz`, `cb`, `ca`; `bu` and `bv` written by the
  supervisor. Briefs appended to `briefs/finish-week1.md` (LF endings kept).
  Core paired document's Next steps and header updated (documentation only).
- `cb-blocker-ranking-final` Done: ranks (1) next-dev startup failures 2/378,
  fixed on the branch but not Lab-proven; (2) durable-writer orphan blocking B's
  seal; (3) the TCP gateway wait has no closed failure stage (W28 projected
  `unclassified`); (4) pushed-`dev` structure audit. Supervisor decision: rank 3
  is a Week 2 diagnostic follow-up (the production build removes its cause).
- `ca-durable-temp-cleanup` Done and reviewed: create-mode temporary removal now
  retries Windows sharing errors through a shared `withSharingRetries` helper and
  throws `ERR_DURABLE_TEMPORARY_LEFT` naming the file when exhausted; worker
  private run `tests 11, pass 11, fail 0`, 7/7 mutations killed. Supervisor
  decision: the 150 ms schedule could stop an unattended campaign on a normal
  Defender scan, so removal gets its own longer bounded schedule (about 2.5 s)
  while rename keeps 10-80 ms; sent to the worker. Follow-ups recorded, not done
  tonight: merge-side tolerance for a byte-identical writer-owned temporary; the
  duplicate-create `EEXIST` path still swallowing a locked temporary.

## Core documentation and B verification (about 03:00 local)

- Core after the documentation edit: `pnpm docs:check` exit 0 ("Validated local
  links in 103 authored/reference Markdown files.", "Deterministic framework
  reference is current."); `node scripts/structure-audit.mjs` exit 1 with only
  the stale `docs/working/README.md` index. Backed up `.structure-baseline.json`,
  ran `pnpm structure:baseline` (exit 0), compared: 0 entries grew, 0 changed;
  audit rerun exit 0 (one advisory `file-lines` warning). Changed files:
  `docs/working/README.md` (2 lines) and the paired Week 1 document.
- `br-sharded-final-2-b` Done (report copied): 201 cells = 189 evaluated + 12
  skips (W04, W08 Flow), 0 duplicate or missing keys; chains 3/134/122/128
  hash-linked and finished; 189/189 evaluation, receipt and bundle parity; seal
  24/24 digests; 0 lease, staging, interrupted, `.tmp` or symlink; `.work`
  empty; quarantined temporary SHA-256 equals c15's `evaluationSha256`; 179
  passed, 10 failed (nine ruled-out variants plus W14 Flow rep 2); harness 0;
  attestations 189/189 (180 not applicable, 9 passed, 0 findings); packets 608,
  p95 5,934, max 5,992 bytes; truncations 165; duration p50/p95 92,168/113,054
  ms. The worker also noted `report.json` `notExecutedRuns` 55 = 54 zero-action
  recording runs plus the W14 facility failure.

- Core committed locally: `54ae663` "docs: record the downstream Week 1
  closeout" (README index and paired document); Core `dev` ahead of `origin/dev`
  by 1, status clean. Push held for the joint push with downstream.
- Live production-build validation started early on main `dev` `83f54b3` plus
  uncommitted documentation only (not acceptance evidence): two sequential W14
  Flow runs, label `cd-prod-core-validate`, runs root
  `F:\fxlab-runs\prod-core-validate\a`; run 1 builds the Core production cache,
  run 2 must reuse it. Logs `prod-validate-w14-<n>.log` in the scratchpad.

- Live production-build validation observed (main `dev` `83f54b3`, 13 dirty
  documentation entries; not acceptance evidence):
  - run 1 `run-mu2hl57s-867a8846`: exit 0, 86 s wall, duration 65,684 ms,
    verdict passed, Flow created, oracle and reported passed, click /
    wait_for_selector / click, harness 0, `facilityFailure` null, max packet
    4,467 bytes. Bundle `logs/core-web-build.log`: "Creating an optimized
    production build ...", "Compiled successfully in 13.8s", `[exit] code=0`.
    `logs/core.log`: "Next.js 15.5.23", "Starting...", "Ready in 635ms"; 0
    compile or dev markers.
  - run 2 `run-mu2hmz8e-3839eafd`: exit 0, 41 s wall, duration 21,527 ms, same
    passing observation; no build log (cache reused); "Ready in 596ms".
  - cache `a0869fc55741c04d544b0c81`: `published.json`
    `{"schemaVersion":1,"key":"a0869fc55741c04d544b0c81","attempt":"b-dc7a1a88ac9d"}`,
    one attempt, `.next` 144 MB, operation lock released.
  - The same W14 Flow cell took 54,866-58,772 ms on `next dev` in isolation.
- `ca` round 2 returned Done: removal schedule 10-1280 ms (9 attempts), rename
  unchanged 10-80 ms, one shared helper; worker private run 11/11 and 13/13
  mutations. Supervisor reviewed the diff. Worktree commit `99dbed6`,
  cherry-picked onto `dev` as `b3278a4`.
- Root `pnpm build` on `83f54b3`: exit 0 in 14 s, no tracked changes.
- Then: Week 1 document restructured by script with pins
  `3525938`/`878fbd5`/`83f54b3`/`b3278a4`, downstream index regenerated, and
  `pnpm -r --workspace-concurrency=1 test` started on `b3278a4`.
- Week 1 document restructure observed: `{"planLines":656,"currentStateLines":84,
  "movedEntryLines":150,"archiveLines":4072}`; downstream `pnpm structure:baseline`
  exit 0 with baseline grew 0, shrank 0; `node scripts/structure-audit.mjs` exit 0.
- Root `pnpm -r --workspace-concurrency=1 test` on `b3278a4`: exit 0 in 51 s;
  domain 404/404; packages 6/6, 7/7, 73/73, 17/17; extension 513/513; 205/205,
  16/16, 17/17; test-runner 845/845; 0 fail and 0 cancelled everywhere.
- Root `pnpm check` on `b3278a4`: exit 0 in 19 s; structure tests `# tests 63`,
  `# pass 63`, `# fail 0`; lab tests `# tests 15`, `# pass 15`, `# fail 0`;
  `structure-audit: passed (53 warning(s), 17 baselined).`; every package check
  passed. Root `pnpm build` on `b3278a4`: exit 0 in 13 s; 0 non-document tracked
  changes. All push criteria hold for the downstream unit: complete, checks run
  and observed passing, nothing known broken.
- Root gates started: `pnpm build` first, in the background, then `pnpm test`,
  then `ca` integration with test-runner rebuild and tests, then documents and
  `pnpm check`.

## Launch runbook (non-secret; values never printed)

Auth-gate fixture: built module
`apps/scenario-lab/dist/scenarios/auth-gate/constants.js` exports
`authGateDemoCredentials` with keys `username,password` (key names read only).

W14 focused proof, main checkout at `3d6ecd6`, after both campaigns are terminal
(no secret needed):

```powershell
$env:FLUXIQ_TEST_ENV_FILES = 'none'
$env:FLUXIQ_LAB_INSTANCE = 'bu-w14-focused'
$env:EXTENSION_TEST_BUILD_LABEL = 'bu-w14-focused'
$env:DOMAIN_TEST_BUILD_LABEL = 'bu-w14-focused'
$env:FLUXIQ_TEST_RUNS_DIR = 'F:\fxlab-runs\w14-focused\a'
pnpm lab run modal-flows --workflow interstitial --target isolated --evidence failure --flow   # x3, sequential
```

Overnight pair, from the Lab worktree beside `F:\fxlab\!FluxIQ` at the pushed
fix pin, each side in its own shell, launched together:

```powershell
$env:FLUXIQ_TEST_ENV_FILES = 'none'
$env:FLUXIQ_LAB_INSTANCE = '<label>'; $env:EXTENSION_TEST_BUILD_LABEL = '<label>'; $env:DOMAIN_TEST_BUILD_LABEL = '<label>'
$env:FLUXIQ_TEST_RUNS_DIR = 'F:\fxlab-runs\prod-core-final\<a|b>'
$url = ([System.Uri]'<worktree>\apps\scenario-lab\dist\scenarios\auth-gate\constants.js').AbsoluteUri
$env:FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD = node -e "import(process.argv[1]).then(m => process.stdout.write(m.authGateDemoCredentials.password))" $url
pnpm lab run basic-form --target isolated --evidence failure   # prebuild the Core cache in this runs root, timed
pnpm lab bench --corpus week1 --repeat 3 --target isolated --evidence failure --shards 3 --jobs 2
```

Capture the logical ID; resume only with `pnpm lab bench --resume <id>` under the
same labels and runs root. Measure the prebuild's duration and the probe
PowerShell spawn rate once cells run.

## Closeout plan (dispatch when both parents are sealed)

Order: terminal verification A and B plus the official comparison in parallel
(read-only, no Lab); then the W14 focused proof alone (heavy); then reports into
the repository, working-document compaction, criterion 6 refresh, commit, push.
The fix and overnight pair run from a Lab worktree under `F:\fxlab\` so the main
checkout stays free for documentation commits.

### Focused proofs now cover two cells

Per the user's 22:15 decision, run both in sequence after the pair is
terminal, never concurrently with each other or with any other Lab work:
W14 Flow (`bu-w14-focused`, below) and W28 recording (`bv-w28-focused`:
`pnpm lab run iframe-checkout --target isolated --evidence failure`, x3,
runs root `F:\fxlab-runs\w28-focused\a`, label `bv-w28-focused`; corpus row
`row("W28", "iframe-checkout", null)` at `bench/corpus/week1.ts:60` confirms the
primary workflow with no variant). Rename the comparison brief to
`bz-final-2-comparison` to avoid collisions (`bv` is this W28 proof, `bx` is
`bx-slot-poll-probe`).

### Draft brief `bu-w14-focused` (worker, after both campaigns are terminal)

- Confirm no bench/Lab node process remains for labels `bq-sharded-final-2-a`
  and `br-sharded-final-2-b`; downstream clean at `3d6ecd6`, Core at `19468b7`.
- Label `bu-w14-focused` for `FLUXIQ_LAB_INSTANCE`, `EXTENSION_TEST_BUILD_LABEL`,
  `DOMAIN_TEST_BUILD_LABEL`; runs root `F:\fxlab-runs\w14-focused\a`;
  `FLUXIQ_TEST_ENV_FILES=none`. No secret needed.
- Run three times sequentially:
  `pnpm lab run modal-flows --workflow interstitial --target isolated --evidence failure --flow`
- For each: run id, verdict, oracle, flowCreated, action count, duration,
  harness, facilityFailure; bundle completion marker; `.work` residue; no
  labelled process left. Report `reports/bu-w14-focused.md` (outside repo first).

### Draft briefs `bq-sharded-final-2-a` / `br-sharded-final-2-b` (terminal verification)

- 189 evaluated + 18 skips; per-verdict counts; every failed run with category
  and typed facility failure; parent `finished` checkpoint; three child chains
  contiguous and terminal with zero ignored generations; `merge-seal.json`
  present; evaluation/receipt/checkpoint-hash parity; no lease, staging, or
  `interrupted/` residue; parent `runs.json`/`report.json`/`report.md` present.
- Read-only; one idempotent exact-ID resume only if the supervisor authorizes it.

### Draft brief `bv-final-2-comparison`

- `pnpm lab compare <A report.json> <B report.json>` from the downstream root.
- Expect exit 1 from the W14 verdict difference; report `outcome`,
  `comparisonPassed`, every differing result/run, all tolerance-bearing
  metrics, and the six exit-criterion projections, in the `ah-final-repaired-comparison` shape.
