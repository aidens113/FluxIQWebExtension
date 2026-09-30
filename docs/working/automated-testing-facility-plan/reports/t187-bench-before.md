# t187-bench-before: baseline timings (BASE_D 05b6606a, BASE_C af385f7)

## Outcome

Partial. Every timed matrix step and the full breakdown ran and are in
`C:/Users/osrs_/FluxStuff/fxwork/t187-bench/before/results.jsonl` (61 rows: 24 matrix, 37 breakdown).
There are four departures from the plan (details under "Open questions"):

1. **No trivial commit before T.finish.** Worker rules forbid `git commit` with no exception for
   disposable clones, so T.finish ran on a task branch with no commits of its own.
2. **The clones were built with `git init` + `fetch` + `checkout -b dev <BASE>`, not `clone` + `reset --hard`.**
   The hook blocks `git reset`. The result is the same: `dev` at the base, upstream set to `origin/dev`.
3. **`pnpm lab run everything-store --dry-run` exits 1 on every pass at BASE_D.** This is a product
   argument refusal. At BASE_D there is also no `{"lab":"prelude",...}` step timer.
4. **The first breakdown attempt ran concurrently with itself (my error).** Its 73 rows were set aside.
   The breakdown was then re-run alone, with no overlapping steps.

## What changed and why

Only bench-local files changed. The source repositories are unchanged: both are clean, with no `task/t185*` branch.

- Created the clone pair `t187-bench/!FluxIQWebExtension` (dev = 05b6606a) and `t187-bench/!FluxIQ` (dev = af385f7).
  Both have push URL `DISABLED`, re-verified before T.start.
- Created `t187-bench/before/`:
  - `results.jsonl` and `logs/`
  - `untimed.jsonl`: untimed rebuilds, run through the harness so they hold a slot
  - `step-t187-before.sh`: a wrapper that calls `bench.mjs`
  - `breakdown-t187-before.sh`
  - `breakdown-contaminated-concurrent.jsonl` and `logs/contaminated-breakdown/`: the discarded concurrent run
  - `install-*.log`
- T.start/T.finish created task `t185` in the bench clone.
  - The downstream worktree was removed by finish.
  - `dev` did not move, because the branch had no commits (`merge --no-ff` was a no-op).
  - The Core side, `t187-bench/fxwork/t185/!FluxIQ` on `task/t185-bench`, was left open. finish says to
    finish it in Core; that is not part of the plan.
- `bench.mjs` was not modified.

## Setup times (wall, not via harness)

| Step | Seconds |
| --- | --- |
| D: init + fetch + checkout -b dev 05b6606a | 9.0 |
| C: init + fetch + checkout -b dev af385f7 | 5.6 |
| C: pnpm install --frozen-lockfile | 14.0 |
| D: pnpm install --frozen-lockfile | 2.0 |

## Timed matrix (in run order)

| label | pass | seconds | exit | slot | wait s | free RAM MB |
| --- | --- | --- | --- | --- | --- | --- |
| C.build | 1 | 170.7 | 0 | b1 | 0.0 | 5147 |
| C.build | 2 | 162.0 | 0 | b1 | 0.0 | 5188 |
| C.build | 3 | 199.7 | 0 | b1 | 0.0 | 4946 |
| D.build | 1 | 74.4 | 0 | b1 | 0.0 | 5640 |
| D.build | 2 | 82.6 | 0 | b1 | 0.0 | 4683 |
| D.build | 3 | 100.2 | 0 | b1 | 0.0 | 3813 |
| D.check | 1 | 245.0 | 0 | b2 | 55.2 | 3551 |
| D.check | 2 | 180.7 | 0 | b2 | 0.0 | 3568 |
| D.check | 3 | 270.9 | 0 | b2 | 0.0 | 3562 |
| D.finish-check | 2 | 313.6 | 0 | b2 | 165.6 | 3306 |
| D.test | 1 | 541.1 | 1 | b2 | 0.0 | 3529 |
| D.test | 2 | 224.6 | 1 | b2 | 0.0 | 4100 |
| D.test.rerun | 1 | 275.8 | 1 | b2 | 115.3 | 4434 |
| C.check | 1 | 89.6 | 0 | b1 | 0.0 | 3518 |
| C.check | 2 | 44.9 | 0 | b1 | 0.0 | 4000 |
| C.check | 3 | 57.1 | 0 | b1 | 0.0 | 4851 |
| C.test | 1 | 452.5 | 1 | b1 | 0.0 | 4281 |
| C.test | 2 | 455.2 | 1 | b1 | 0.0 | 4499 |
| C.test.rerun | 1 | 409.7 | 1 | b1 | 0.0 | 4561 |
| L.prelude | 1 | 77.9 | 1 | b1 | 125.8 | 4891 |
| L.prelude | 2 | 81.0 | 1 | b1 | 5.5 | 4452 |
| L.prelude | 3 | 1.9 | 1 | b1 | 0.5 | 4678 |
| T.start | 1 | 138.7 | 0 | b1 | 15.0 | 4443 |
| T.finish | 1 | 142.2 | 0 | b1 | 10.0 | 4569 |

- Pass 3 is always edit-one: `// t187 bench edit` is appended to `domain/src/index.ts` (D) or
  `packages/fluxiq/src/index.ts` (C), then reverted with `git checkout --`.
- The wait is excluded from `seconds`.
- **Other agents' heavy jobs held the other build slot during most steps.** Owners seen: t186 lead check,
  t189-wB3 vitest, t190-w4 domain test. Free RAM was 3.3 to 5.6 GB throughout. Timings are therefore
  under realistic contention, not on an idle machine.
- D.finish-check ran as `npm_config_workspace_concurrency=1 node bench.mjs ... -- pnpm check`. The
  environment variable was set on the harness, because the harness spawns through cmd.exe, where inline
  `VAR=x` does not work. The harness passes the variable through, so the recorded `command` reads `pnpm check`.

Untimed rebuilds, all exit 0 (from `untimed.jsonl` unless noted):

| Rebuild | Seconds |
| --- | --- |
| C `pnpm build` after C.build p3 (plain shell, no slot; see below) | not timed |
| C `pnpm build` after C.check p3 | 147.7 |
| D domain build before L.prelude | 9.2 |
| D domain build after L.prelude p3 | 8.6 |

## Breakdown (warm, nothing changed, serial, sorted by seconds)

| label | seconds | exit | slot |
| --- | --- | --- | --- |
| C.part.build.web | 97.7 | 0 | b1 |
| D.part.check.extension | 31.6 | 0 | b2 |
| D.part.task-test | 24.4 | 0 | b2 |
| D.part.build.test-runner | 21.6 | 0 | b1 |
| C.part.check.fluxiq | 21.4 | 0 | b1 |
| C.part.build.fluxiq | 20.6 | 0 | b1 |
| D.part.check.scenario-lab | 19.0 | 0 | b2 |
| D.part.check.test-runner | 18.2 | 0 | b1 |
| D.part.build.scenario-lab | 17.2 | 0 | b2 |
| D.part.build.extension | 16.6 | 0 | b2 |
| D.part.check.domain | 14.6 | 0 | b2 |
| D.part.structure-audit | 8.6 | 0 | b2 |
| C.part.structure-audit | 8.5 | 0 | b1 |
| C.part.check.web | 7.0 | 0 | b1 |
| D.part.build.domain | 6.8 | 0 | b2 |
| D.part.structure-test | 6.5 | 0 | b2 |
| D.part.lab-test | 6.1 | 0 | b2 |
| C.part.check.contracts | 4.2 | 0 | b1 |
| C.part.check.client-gateway-websocket | 3.5 | 0 | b1 |
| C.part.structure-test | 3.3 | 0 | b1 |
| C.part.build.contracts | 2.9 | 0 | b1 |
| C.part.build.client-gateway-websocket | 2.9 | 0 | b1 |
| D.part.build.test-contracts | 2.9 | 0 | b2 |
| D.part.check.agent-orchestrator | 2.8 | 0 | b2 |
| D.part.check.test-contracts | 2.7 | 0 | b2 |
| D.part.check.test-matrix | 2.7 | 0 | b1 |
| D.part.build.agent-orchestrator | 2.5 | 0 | b2 |
| D.part.build.test-evidence | 2.5 | 0 | b2 |
| D.part.build.test-matrix | 2.5 | 0 | b1 |
| D.part.check.boundary-audit | 2.4 | 0 | b2 |
| D.part.build.boundary-audit | 2.4 | 0 | b2 |
| D.part.check.test-evidence | 2.4 | 0 | b2 |
| D.part.build.real-site-policy | 2.2 | 0 | b2 |
| D.part.check.real-site-policy | 2.2 | 0 | b2 |
| C.part.task-test | 0.8 | 0 | b1 |
| X.part.pnpm-version | 0.7 | 0 | b1 |
| X.part.node-noop | 0.1 | 0 | b1 |

- The 37 steps sum to 395.0 s.
- The overlap check on start and end times found 0 overlapping steps.
- **Filters used:** D packages by `@fluxiq-web-extension/<name>`; Core packages by `@fluxiq/web`,
  `@fluxiq/client-gateway-websocket`, `@fluxiq/contracts` and `./packages/fluxiq`. The path filter is
  needed because Core's root package and `packages/fluxiq` are both named `fluxiq`.
- **Floor per package step:** about 2.2 s, of which `pnpm --version` alone takes 0.7 s.

## L.prelude step lines per pass

At BASE_D, no `{"lab":"prelude","step",...,"ms"}` lines exist; `scripts/lab` contains no "prelude" timer.
The `{"lab":...}` lines each pass did emit were:

- p1 (77.9 s):
  - `{"lab":"core-build","state":"quiet",...,"files":4112,"waitedMs":714}`
  - builds of extension/scenario-lab/test-runner
  - `{"lab":"paths",...}` (twice)
  - then the runner printed `{"status":"failed","category":"unknown","message":"--instruction-task and --dry-run require --live-llm --llm-task create-flow"}`
- p2 (81.0 s): the same sequence. `core-build` quiet with `waitedMs` 580, then `paths`, then the same refusal.
- p3 (edit-one, 1.9 s):
  - `{"lab":"core-build","state":"quiet",...,"waitedMs":404}`
  - `{"lab":"repository-build","state":"stale","build":"domain","behindMs":29236,...}`
  - then the refusal "Rebuild with: pnpm --filter @fluxiq-web-extension/domain build". At BASE_D the Lab
    refuses a stale domain build instead of rebuilding it, so pass 3 measures a refusal, not a rebuild.

Each pass's time therefore covers the full run-lab prelude (Core guard, stale guards, lab builds) plus
the runner start and its argument refusal. No browser was launched.

The scenario id is valid: `apps/scenario-lab/src/scenarios/everything-store/manifest.ts` declares
`id: "everything-store"`. The RAM wait never approached 20 minutes; the longest was 125.8 s, and it
included the build-slot wait.

## Failures, with cause and how far each got

- **D.test p1: exit 1 after 541 s.**
  - Every package before test-runner passed: boundary-audit 6, test-contracts 149, real-site-policy 7,
    test-matrix 17, domain 882, agent-orchestrator 16, test-evidence 17, extension 1153, scenario-lab 602.
  - test-runner: 1551 passed, 2 failed.
  - `demo-workspace.test.js:53` fails `assert.equal(config.headless, true)`: the demo config now defaults
    to headed, and the test still expects headless.
  - `runner-wiring.test.js:142` asserts that the runner source contains a literal `runRedactionScopes({ ... workspaceWrittenSince: ... })` call, and it does not.
  - Both are drift between tests and product at BASE_D. They are not caused by the environment: no
    `FLUXIQ_*`, `PLAYWRIGHT*` or `CI` variables were set.
- **D.test p2: exit 1 after 225 s.**
  - scenario-lab stopped the recursive run: 601 passed, 1 failed.
  - The failure is `auction-marketplace/tests/browser.test.js:69`, "the bid workflow's honest path...":
    `locator.fill` on `input[name="maxbid"]` timed out after 10000 ms with "element is not visible".
    This looks like a flake under machine load; it passed in p1 and in the rerun.
  - test-runner was not reached.
- **D.test.rerun (the one rerun): exit 1 after 276 s.**
  - It reproduced exactly the same two test-runner failures as p1 (852 and 1304), so those two are deterministic.
- **C.test p1: exit 1 after 453 s.**
  - contracts 9/9 and client-gateway-websocket 1/1 files passed.
  - fluxiq: 7 files failed, 453 of 460 passed. Every failure is a vitest `Test timed out in 15000ms`,
    or 60000ms for the million-event runtime-stream-store test.
- **C.test p2: exit 1 after 455 s.**
  - fluxiq: 5 files failed, 455 of 460 passed.
  - The set of failing tests differs from p1, and all are 15000 ms timeouts.
- **C.test.rerun (the one rerun): exit 1 after 410 s.**
  - fluxiq: 1 file failed, 459 of 460 passed. It was `service-recordings/tests/proposals.test.ts`,
    with a 15000 ms timeout; that test also failed in p1.
  - Cause: timeouts that vary under load, with another agent's vitest and pnpm check holding the other
    slot. This is not a bench-environment defect, so it was not fixed.
- **L.prelude p1, p2 and p3: exit 1.** Each was caused by the argument refusal or stale guard described
  above. Because the refusal is deterministic, no rerun was made; p2 serves as the repeat.

## Commands run and observed results

Every timed step was `node t187-bench/harness/bench.mjs --out t187-bench/before/results.jsonl --label <L> --pass <n> --cwd <dir> [--lab] -- <cmd>`,
called through `before/step-t187-before.sh`. Results are as tabled above.

## Not verified

- **Timings on an idle machine.** Other agents' jobs held the other build slot for most steps.
- **Whether D.test's two test-runner failures and C.test's timeouts also occur in the source checkouts
  at the same commits.** I did not run anything there.
- **T.finish with a real merge commit.** The commit was not made, as described above.
- **Core-side `pnpm task finish t185`.** Not in the plan; left open.

## Open questions or contradictions found

1. **The brief says to make a trivial commit in the bench worktree, but worker rules forbid `git commit`
   outright.** I followed the worker rule. If the after phase needs a real merge in T.finish, the
   supervisor must make that commit, or authorize it through a mechanism the hook allows.
2. **`git reset --hard` in the plan's setup is blocked for workers.** The init + fetch + `checkout -b`
   route gives the same state. The after phase should use the same route so setup times are comparable.
3. **The plan's L.prelude command is refused by the runner at BASE_D.** `--dry-run` requires
   `--live-llm --llm-task create-flow`. If t187 changes that, before and after measure different things
   after the prelude.
4. **Pass 3 of L.prelude stops at the stale-domain guard after 1.9 s.** It is not comparable to a pass
   that rebuilds.
5. **The plan's `npm_config_workspace_concurrency=1 pnpm check` form does not work in the harness's
   cmd.exe shell.** The variable has to be set on the harness process.
6. **My slot-discipline lapses, both finished before any timed step overlapped them:**
   - The first untimed C rebuild, after C.build p3, ran without a slot.
   - One untimed `node scripts/lab/run-lab.mjs --help` ran for about 10 s while D.finish-check was
     waiting for its slot. It only read the Core guard and the stale check.
   - The discarded first breakdown ran two copies at once.
7. **The task id came out as `t185`, from the bench clone's history.** It is not t187-specific. The
   after phase's re-clone will assign its own id.
