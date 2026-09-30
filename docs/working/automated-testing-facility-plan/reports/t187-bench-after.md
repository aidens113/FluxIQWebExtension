# t187-bench-after: timings after t187 (BASE_D 05b6606a + t187 uncommitted, BASE_C af385f7)

## Outcome

Done, with one departure from the plan. Every setup step, every timed matrix step and the full breakdown ran.
They are in `C:/Users/osrs_/FluxStuff/fxwork/t187-bench/after/results.jsonl`: 37 rows, 15 matrix and
22 breakdown. There were 0 distorted rows and 0 overlapping steps, so no re-runs were needed.

- **The departure is plan step 0 (delete the old bench pair).** The auto-mode permission classifier
  denied `rm -rf` on `t187-bench/!FluxIQWebExtension`, `t187-bench/!FluxIQ` and `t187-bench/fxwork`.
  They are still on disk. Nothing depended on the deletion: the new pair lives under `t187-bench/a/`.
- **Exit codes match the baseline for every label.** Failures in the after run:
  - D.test fails on the same two deterministic test-runner tests as BASE.
  - L.prelude fails on the same runner argument refusal as BASE.

## What changed and why

Only bench-local files changed. The source repositories are untouched: `git status --short` is empty in
both, and the source extension repository has no `task/t185*` branch. The t187 tree was only read from.
The shared store was not cleared. `bench.mjs` was not modified.

- **New clone pair:**
  - `t187-bench/a/!FluxIQWebExtension` (D): `dev` = 05b6606a, plus the t187 changes uncommitted.
  - `t187-bench/a/!FluxIQ` (C): `dev` = af385f7.
  - Both have push URL `DISABLED`.
- **New bench files:**
  - `t187-bench/after/results.jsonl` and `after/logs/`
  - `after/setup.jsonl` and `after/logs/setup.*.log`
  - `after/driver.out`
  - `after/drive-t187-after.sh`: one serial driver. Each timed step calls `bench.mjs` once, and each
    step starts only after the previous one exits.
  - `t187-bench/a-status.txt` and `a-expected.txt`: the status verification.
- **T.start/T.finish created task `t185` in the bench clone.**
  - finish merged `Merge task t185: bench`. It was a no-op because the branch had no commits, so `dev`
    is still 05b6606a.
  - It removed the downstream worktree.
  - Its validation, `pnpm check`, passed.
  - It left the Core side `a/fxwork/t185/!FluxIQ` on `task/t185-bench` open, with 0 unmerged commits.
    It names `pnpm task finish t185` in C as the next step. This is the same as the baseline.

## (1) Setup times

| Step | Seconds | Exit |
| --- | --- | --- |
| 0. delete old bench pair | not run: permission denied | - |
| D: init + fetch + checkout -b dev 05b6606a (push URL DISABLED) | 8.2 | 0 |
| C: init + fetch + checkout -b dev af385f7 (push URL DISABLED) | 6.6 | 0 |
| D: `git apply --binary t187.patch` + copy the 59 untracked paths | 6.2 | 0 |
| C: pnpm install --frozen-lockfile (heavy.sh) | 13.0 | 0 |
| D: pnpm install --frozen-lockfile (heavy.sh) | 2.1 | 0 |
| C: pnpm build (heavy.sh, untimed) | 114.0 | 0 |

- **The status check passed.** `git -C D status --short --untracked-files=all` lists 86 paths. That is
  exactly the patch's 27 modified files plus the 59 paths in `untracked.txt`; the diff against the
  expected list was empty.
- The heavy.sh setup times include any build-slot wait.
- The installs and C build started only after `lab-slots/slot-1` disappeared. It existed when the task
  began, at about 04:16Z.

## (2) Before/after

Seconds exclude slot waits. Pass 3 is edit-one: `// t187 bench edit` is appended to `domain/src/index.ts`,
then reverted with `git checkout --`.

| label | pass | before s | after s | exit before/after |
| --- | --- | --- | --- | --- |
| D.build | 1 | 74.4 | 50.4 | 0/0 |
| D.build | 2 | 82.6 | 4.5 | 0/0 |
| D.build | 3 | 100.2 | 35.4 | 0/0 |
| D.build.forced | 1 | n/a (new label) | 36.3 | -/0 |
| D.check | 1 | 245.0 | 82.6 | 0/0 |
| D.check | 2 | 180.7 | 34.2 | 0/0 |
| D.check | 3 | 270.9 | 53.6 | 0/0 |
| D.finish-check | 2 | 313.6 | 35.6 | 0/0 |
| D.test | 1 | 541.1 | 180.8 | 1/1 |
| D.test | 2 | 224.6 | 182.2 | 1/1 |
| L.prelude | 1 | 77.9 | 6.4 | 1/1 |
| L.prelude | 2 | 81.0 | 7.0 | 1/1 |
| L.prelude | 3 | 1.9 | 9.0 | 1/1 |
| T.start | 1 | 138.7 | 112.9 | 0/0 |
| T.finish | 1 | 142.2 | 103.2 | 0/0 |

**Machine conditions differed from the baseline.**
- Free RAM before each step was 4.8 to 5.8 GB, against 3.3 to 5.6 GB at baseline.
- Every step got a slot within 1.6 s.
- Another lane held b1 at the start and b1 again at the end. For most steps this bench held b1 and the
  other slot was free or held by others; I did not record the other slot's owner per step.

**Some rows are not like-for-like:**
- **D.build p1 is not a warm-store case.** See (5): nothing was restored from the store.
- **L.prelude p3 measures different work.** At BASE it stopped at the stale-domain guard after 1.9 s.
  After t187, the prelude restores the three domain-dependent builds from the store (5.2 s) and then
  reaches the same runner refusal.
- **T.start/T.finish mostly measure BASE scripts.** The worktree runs BASE package scripts; only
  `scripts/task/**` and `scripts/worktree/**` are new.
- **D.test is compared as totals only.** At BASE, D.test p2 stopped early at the scenario-lab flake, so
  it never reached test-runner. After t187, both passes ran every package.

## (3) Breakdown (once, warm, nothing changed, serial, same package order as the baseline)

| label | before s | after s | exit |
| --- | --- | --- | --- |
| D.part.check-prefix (the combined `node --test` part of root `check`) | 37.0 (the sum of structure-test 6.5 + lab-test 6.1 + task-test 24.4) | 28.4 | 0 |
| D.part.structure-audit | 8.6 | 6.5 | 0 |
| D.part.check.extension | 31.6 | 13.0 | 0 |
| D.part.build.extension | 16.6 | 9.0 | 0 |
| D.part.check.scenario-lab | 19.0 | 1.3 | 0 |
| D.part.build.scenario-lab | 17.2 | 1.6 | 0 |
| D.part.check.domain | 14.6 | 1.6 | 0 |
| D.part.build.domain | 6.8 | 2.4 | 0 |
| D.part.check.agent-orchestrator | 2.8 | 1.2 | 0 |
| D.part.build.agent-orchestrator | 2.5 | 1.2 | 0 |
| D.part.check.boundary-audit | 2.4 | 1.1 | 0 |
| D.part.build.boundary-audit | 2.4 | 1.2 | 0 |
| D.part.check.real-site-policy | 2.2 | 1.2 | 0 |
| D.part.build.real-site-policy | 2.2 | 1.2 | 0 |
| D.part.check.test-contracts | 2.7 | 1.2 | 0 |
| D.part.build.test-contracts | 2.9 | 1.2 | 0 |
| D.part.check.test-evidence | 2.4 | 1.2 | 0 |
| D.part.build.test-evidence | 2.5 | 1.2 | 0 |
| D.part.check.test-matrix | 2.7 | 1.2 | 0 |
| D.part.build.test-matrix | 2.5 | 1.2 | 0 |
| D.part.check.test-runner | 18.2 | 1.8 | 0 |
| D.part.build.test-runner | 21.6 | 3.9 | 0 |

- **Totals:** the D breakdown sums to 221.4 s before and 83.7 s after.
- **The check prefix now dominates a no-change `pnpm check`.** It takes 28.4 of D.check p2's 34.2 s.
  It now also runs the `scripts/worktree` and `scripts/build-cache` tests, which the baseline's three
  scripts did not.
- **A cache hit costs about 1.2 s per package**, which is essentially pnpm plus node start-up.
- **The extension breakdown rows (13.0 s and 9.0 s) are an ordering artifact, not "nothing changed".**
  - L.prelude p3 (edit-one) restored the edited domain `dist` from the store, and the source was then
    reverted.
  - The breakdown runs extension before domain. extension therefore saw the reverted domain source
    beside the edited domain dist, a combination no store entry held, and so it built.
  - `D.part.build.domain` then restored the unedited domain from the store, and `D.part.build.test-runner`
    restored its entry too.

## (4) L.prelude per pass

Every pass ends in the same refusal after the prelude:
`{"status":"failed",...,"message":"--instruction-task and --dry-run require --live-llm --llm-task create-flow"}`.

- **p1: prelude total 2367 ms**, `rebuilt: []`, all 6 reused.
  - Steps: core-commit 132, core-quiet 381, core-entries 8, core-staleness 106, build-lock 1653,
    repository-staleness 81.
  - `build-cache` lines (all `reuse`, `source: stamp`, "inputs and outputs match the stamp"):
    test-contracts 66, scenario-lab 161, domain 310, extension 342, test-evidence 42, test-runner 379 ms.
- **p2: prelude total 2587 ms**, `rebuilt: []`.
  - Steps: core-commit 187, core-quiet 390, core-entries 9, core-staleness 105, build-lock 1809,
    repository-staleness 81.
  - `build-cache` lines (all `reuse` from the stamp): test-contracts 75, scenario-lab 177, domain 349,
    extension 392, test-evidence 45, test-runner 390 ms.
- **p3 (edit-one): prelude total 5220 ms**, `rebuilt: []`, `reused` all 6.
  - Steps: core-commit 130, core-quiet 384, core-entries 8, core-staleness 107, build-lock 4504,
    repository-staleness 80.
  - `build-cache` lines:
    - from the stamp: test-contracts 66, scenario-lab 159, test-evidence 44 ms;
    - `source: store`, "restored from the shared store (inputs changed: domain)": domain 1087,
      extension 597, test-runner 2212 ms. These were the entries D.build p3 stored for the same edit.

## (5) Reused / restored-from-store / built, per D.build and D.check pass

| pass | reused (stamp) | restored from store | built | reasons for building |
| --- | --- | --- | --- | --- |
| D.build p1 | 1 | 0 | 10 | "no stamp; stored in the shared store" for all 10 package builds. The 1 reuse is `test-contracts:build`, re-requested by scenario-lab after being built earlier in the same run |
| D.build p2 | 11 | 0 | 0 | - |
| D.build p3 | 8 | 0 | 3 | "inputs changed: domain": domain, extension, test-runner |
| D.build.forced p1 | 0 | 0 | 11 | "FLUXIQ_BUILD_FORCE=1" (store off) |
| D.check p1 | 0 | 0 | 10 | "no stamp; stored in the shared store (0 files)" for all 10 package checks |
| D.check p2 | 10 | 0 | 0 | - |
| D.check p3 | 7 | 0 | 3 | "inputs changed: domain": domain, extension, test-runner checks |
| D.finish-check p2 | 7 | 3 | 0 | The 3 restores were domain, extension and test-runner checks. They are the reverted-state entries D.check p1 stored |
| D.test p1 / p2 (the builds inside test) | 11 / 11 | 0 | 0 | - |

**D.build p1 restored nothing from the shared store.**
- The store held 44 entries before this run, created 20:50 to 21:19 local. None matched the fingerprints
  of BASE plus t187. Its entries carry steps and fingerprints but no tree path, so I could not tell which
  tree wrote them.
- As a result, p1 is a fresh-clone cold build that also fills the store. It is not a measurement of a new
  tree reusing a warm store.
- **The store does restore when an entry exists.** It did so in D.finish-check, L.prelude p3 and the
  breakdown.

## (6) Failures, with cause and how far each got

- **D.test p1: exit 1 after 180.8 s. D.test p2: exit 1 after 182.2 s.** Both passes were identical.
  - Every package passed except test-runner: boundary-audit 6/6, real-site-policy 7/7,
    test-contracts 149/149, test-matrix 17/17, domain 882/882, agent-orchestrator 16/16,
    test-evidence 17/17, extension 1153/1153, scenario-lab 602/602.
  - test-runner: 1554 of 1556 passed. The two failures are the same deterministic ones as BASE:
    - `not ok 854`, `run-evaluation/tests/runner-wiring.test.js:119`: the redaction-attestation source
      assertion, expected true, actual false.
    - `not ok 1307`, `tests/demo-workspace.test.js:38`: the demo-workspace headless expectation.
  - The BASE scenario-lab flake (auction-marketplace `maxbid` not visible) did not occur.
  - This is product drift already present at BASE, not the bench environment, so it was not re-run.
- **L.prelude p1, p2 and p3: exit 1** after 6.4, 7.0 and 9.0 s.
  - The prelude completed every time (see (4)).
  - The runner then refused its arguments with the same message as BASE. Paths resolved and no browser
    was launched.
  - This is deterministic, so it was not re-run.
- **Step 0: not run.** The permission classifier denied the deletion; see Outcome.

## Commands run and observed results

Every timed step was run as:

`node C:/Users/osrs_/FluxStuff/fxwork/t187-bench/harness/bench.mjs --out .../after/results.jsonl --label <L> --pass <n> --cwd <D> [--lab] -- <cmd>`

It was called from `after/drive-t187-after.sh all`, which exited 0 and printed `DRIVER-DONE all 2026-09-30T04:37:14Z`.

- Checks on the results:
  - `results.jsonl` has 37 rows, `distorted: true` count 0.
  - Checking each step's start (`at - ms`) against the previous row's end found 0 overlaps.
- L.prelude used `--lab`; slot-2 was claimed by the harness and released.
- The inline `VAR=x` forms of D.build.forced and D.finish-check ran as written. The harness now runs
  commands through `bash -c`, and the forced log shows `reason: "FLUXIQ_BUILD_FORCE=1"` for all 11 steps.

## Not verified

- **Timings on an idle machine.** Other lanes held build slots during parts of the run.
- **A new tree reusing a store warmed with the same inputs.** No such entry existed; see (5).
- **Which tree wrote the 44 pre-existing store entries.**
- **T.finish with a real merge commit.** No commit was made, as at baseline.
- **Core-side `pnpm task finish t185`.** Not in the plan; left open.
- **C.build, C.check and C.test.** They are not in the after plan, so there is no after comparison for them.

## Open questions or contradictions found

1. **Plan step 0 is refused by the auto-mode classifier for a worker.** The supervisor (or the user) has to
   delete `t187-bench/!FluxIQWebExtension`, `t187-bench/!FluxIQ` and `t187-bench/fxwork`. They are plain
   disposable bench files; their `node_modules` junctions appear as links under Git Bash, so `rm -rf`
   does not follow them.
2. **D.build p1 does not measure the "fresh clone, shared store" case the plan names.** To measure it,
   build a second fresh clone at the same inputs after this one. It would then find the entries D.build p1
   stored.
3. **The breakdown's fixed package order runs extension before domain.** After an edit-one pass leaves a
   restored domain dist, extension looks changed. A breakdown meant to show pure cache-hit cost should
   run `pnpm build` once first, or order domain before its dependants.
