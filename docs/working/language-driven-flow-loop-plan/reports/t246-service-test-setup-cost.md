# t246 — service test setup cost (Core)

Worker: t246-worker. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t246/!FluxIQ`, branch
`task/t246-service-test-setup-cost`, on top of checkpoint `dfc8811d`. Nothing committed.

## Outcome

Mostly done. The checkpoint's grace pool is kept, because measurement shows it is
what makes a service case slow: it removes 95% of project-database opens (403 → 19
across the 16 cases of the three named files). The debug toggle is gone. Four real
idle-timer races were found and fixed, each with a test that fails on the checkpoint
and passes now. All 111 service test files pass, both one file at a time and in
parallel. One representative case went from about 1.4 s to about 0.8 s on a quiet
machine, and from about 5.9 s to about 2.4 s under load. That is not "well under a
second". What remains is fresh-schema creation and runtime CPU, and both are listed
below as not addressed.

## What changed and why

Core, all under `packages/fluxiq/src/programs/automation-studio/`:

- `runtime/service/projects/database-idle-close.ts` (new):
  `AUTOMATION_STUDIO_PROJECT_DATABASE_IDLE_CLOSE_MS = 1_000`, a named constant with
  the measured reason. It replaces `process.env.T246_IDLE0 ? 0 : 1_000`, so there is
  no env var. No test needs 0, so it is not a service option.
- `runtime/service/projects/files-removal.ts` (new):
  `removeAutomationStudioProjectFiles`. This is the reformatted one-liner from
  `deleteProject` (item 2), moved out of `service.ts` because the structure audit
  refuses any growth of `service.ts` past its 4489-line baseline. It runs
  `closeIdleProject` and then `rm` on a folder layout, and `ProgramJsonStore.deletePath`
  on an object store, which does not remove files on disk.
- `runtime/service/projects/index.ts`: exports both new files.
- `runtime/service.ts`: uses the constant and the helper. It is now 4488 lines, one
  under baseline.
- `storage/project/database.ts` (item 4). Every close the pool starts now goes
  through `closeEntry` and is tracked in `closesInFlight` until it settles.
  - `closeAll` and `closeIdleProject` wait for closes already in flight. Before this,
    an idle close that the timer had just started was not awaited, so either call
    could return while the connection still held `project.sqlite`. Race 1 (closeAll)
    and race 2 (closeIdleProject).
  - `openEntry` waits for the project's previous close before it reopens. Before
    this, a lease taken during an in-flight idle close opened a second connection on
    the same file. Race 3.
  - `closeAll` and `closeIdleProject` use `Promise.allSettled` on pending opens.
    Before this, an open that failed while `closeAll` was running made `closeAll`
    (and so `service.close()`) reject with the lease's error. Race 4.
  - The error-handling forms follow the structure audit's failure-as-empty and
    swallowed-failure rules.
  - Not a race: acquire while the timer is merely pending. It clears the timer in the
    same synchronous step, so the checkpoint's existing test covers it.
- `storage/project/tests/database.test.ts`: a new `idle close races` block with four
  cases, one per race. All four fail against the checkpoint's `database.ts` (I ran
  them with the file reverted, then restored it) and pass now.

Item 3 audit. I looked for places that remove a project directory or the data
directory while a service is alive:

- `deleteProject` is the only production path that removes `project.sqlite`.
  - The folder layout closes first. The existing
    `delete-project-idle-database.test.ts` covers it.
  - Both object-store branches delete documents only, not files, so no lock is
    involved.
- The other `rm` and `deletePath` calls in `service.ts` and `runtime/service/**`
  remove flow, recording, proposal and artifact subfolders, never `project.sqlite`.
- `framework/storage-migration.ts` renames and removes data roots. It runs from
  `FluxIQ.migrateStorage()`, before setup, and not on a live service, so I left it
  unchanged.
- Four test files remove temp dirs with no `close()`:
  - `rootless-storage` constructs no pool.
  - `global-docs` and `uncommitted-v2-adoption` never open a project database.
  - `storage-migration` only lists projects.
- All of these passed in the neighbour run below, so no further file needed a fix.
  No file outside the brief's ownership was edited.

## Measurements

### One representative case

The case: create a Flow, install its primary router, run it, read the run detail.
I timed it step by step with a temporary instrumented test, since deleted.

- Quiet machine:
  - Grace 0: 22 opens, 1.4 s.
  - Grace 1 s: 1 open, 0.8 s.
- Under load: 5.9 s vs 2.4 s.
- With grace, the remaining cost:
  - `createFlow` takes about 270 ms. About 230 ms of that is SQL applying all 24
    schema migrations to a fresh project database.
  - `runRuntimeSession` takes about 300 ms, mostly CPU: about 200 statements, but
    only 40-50 ms of SQL.
- With grace 0, each reopen also paid the pragma script (131 ms over 22 opens) and
  the per-connection migration recheck (158 ms of `update automation_schema_state`
  over 28 calls).

### Opens per test case, the three named files

The count is deterministic. I used a temporary setup file that wraps
`AutomationStudioProjectDatabase.open`, since deleted.

| Case | Grace 0 | Grace 1 s |
| --- | --- | --- |
| run-detail-preservation, repaired-run annotation | 46 | 4 |
| run-detail-preservation, other two cases | 26 and 9 | 1 each |
| service-bootstrap adaptation (9 cases) | 4-54, total 204 | 1-2, total 10 |
| modes (4 cases) | 22-46, total 115 | 1 each |
| **All 16 cases** | **403** | **19** |

### All 111 service test files

The files are `runtime/tests/service-*/tests/**` and `runtime/service/**/tests/**`:
685 tests, 684 passing and 1 skipped (pre-existing). "Loaded" means one vitest
invocation with default file parallelism. "Alone" means `--no-file-parallelism`.
Other lanes were using the machine throughout; the slot owners are recorded in the
logs. Before and after loaded were alternated (b0/a1, b2/a2, b3/a3) to spread that
noise.

| Run | Wall | Sum of test time | p90 | Max | Over 10 s | Failures |
| --- | --- | --- | --- | --- | --- | --- |
| before loaded (3 runs) | 162 / 224 / 171 s | 669 / 970 / 703 s | 3.1 / 4.6 / 3.2 s | 14.6 / 16.0 / 16.8 s | 2 / 8 / 2 | 0 (cases with their own longer timeouts) |
| after loaded (3 runs) | 191 / 157 / 155 s | 786 / 618 / 624 s | 3.4 / 2.6 / 2.5 s | 15.1 / 9.7 / 12.2 s | 3 / 0 / 2 | 0 |
| before alone | 658 s | 386 s | 1.6 s | 15.6 s | 2 | **2 timeouts at 15 s**: adaptation "bridges a generated proposal ID…", proposals "turns mapped observations…" |
| after alone | 520 s | 269 s | 1.0 s | 6.3 s | 0 | 0 |

- The two named tests under load, before → after, sum (max):
  - run-detail-preservation: 8.2-21.2 s (4.8-13.4 s) → 8.4-10.1 s (5.2-6.5 s).
  - adaptation: 17.0-18.5 s (3.7-4.0 s) → 13.0-16.5 s (4.0-6.8 s).
  - Both passed in every run, with all 111 service files in the same invocation.
- Alone, after: run-detail-preservation 2.6 s in total (max 1.5 s), adaptation 3.9 s
  (max 1.1 s), modes 3.7 s (max 1.3 s).
- The first after-loaded run (wall 191 s) coincided with other lanes' builds. The
  two later alternated pairs are the cleaner comparison: about 30% less total test
  time, and about 35% shorter wall time in the worst pair.

## Commands run and observed results

All run in `C:/Users/osrs_/FluxStuff/fxwork/t246/!FluxIQ`, with heavy ones through
`bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t246 …"`.

- `pnpm --filter fluxiq check`: exit 0. The build-cache line `fluxiq:check … ms:19777`
  printed, with no errors.
- `node scripts/structure-audit.mjs`: exit 0, "structure-audit: passed (219
  warning(s), 349 baselined)". It also printed "1 baseline entries can be lowered"
  (`service.ts` is now 4488 against its 4489 baseline). I did not run `pnpm
  structure:baseline`: `.structure-baseline.json` is not mine to edit.
  - An earlier audit run failed on `service.ts` growth (4495), on failure-as-empty
    and swallowed-failure in `database.ts`, and on the scratch test. All of these
    were fixed or removed before the final run.
- Narrow tests, in packages/fluxiq: `npx vitest run` on:
  - `storage/project/tests`
  - `runtime/service/projects/tests`
  - the two named tests
  - every file `dfc8811d` touched: `framework/tests/index`, `client-gateway`
    `bridge` and `bridge-restart`, `entry-removal-command`, `io-bridge`,
    `representation`, `global-automation-studio-workspaces`

  Result: "Test Files 37 passed (37) / Tests 257 passed (257)", exit 0, on the final
  code.
- `npx vitest run storage/project/tests/database.test.ts` with the checkpoint's
  `database.ts`: 4 failed (the four race cases), 12 passed. With mine: 16 passed.
- Neighbour run for item 3. One invocation covering:
  - `src/framework/tests/`, `src/programs/tests/`
  - `client-gateway/tests/`, `automation-studio/tests/`, `automation-studio/api/`
  - `conversations/commands/tests/`, `llm/evidence-loop/tests/`
  - `runtime/tests/deepseek-bootstrap/`, `runtime/tests/refuted-result/`
  - every top-level `runtime/tests/*.test.ts`

  Result: "Test Files 103 passed (103) / Tests 703 passed (703)", exit 0.
- Service measurement runs: the seven listed in the table, all exit 0 except before
  alone (exit 1, the two timeouts). Logs and JSON reports are in the session
  scratchpad as `t246-{before,after}{,2,3}-{loaded,alone}.{log,json}`.
- For measurement only, the constant was set to 0 temporarily; it was restored to
  `1_000` (checked with grep). Both scratch files and the scratch config were
  deleted. `git status` shows only the six files listed below.

## Not verified

- Live browser or Lab runs: no product behaviour change was exercised beyond the
  tests.
- Downstream (`!FluxIQWebExtension` domain) tests that build an
  `AutomationStudioService` and remove its data dir without `close()`. They could now
  hit EBUSY on Windows inside the 1 s grace. I did not run them.
- Core's whole suite: not run, per the brief. Test directories outside those listed
  above that construct a service were not run.
- Timing numbers are from a shared, loaded machine and are noisy. The open counts
  are the deterministic evidence.
- The per-file collect and transform cost: 20-50 s of collect per invocation for the
  service module graph. It does not count against test timeouts, but it dominates
  wall time. Not investigated.
- The fresh-project migration cost: about 230 ms per new project, applying 24
  migrations one transaction each. It could be cut by a squashed baseline schema for
  new databases, or a pre-migrated template file. Both are storage-schema changes
  beyond this brief.

## Open questions or contradictions found

- A brief amendment arrived mid-task. It widened the goal from "finish the grace
  pool" to "profile and remove the per-case cost". I followed it: I profiled, kept
  the pool on the measured evidence, and finished items 1-4. I edited no
  test-helper files under `R/tests/**`, because none was a measured cause.
- `.structure-baseline.json` can be lowered for `service.ts` (4489 → 4488). The
  supervisor should run `pnpm structure:baseline`.
- Under load, a case still costs about 2-6 s, and some cases in files with their own
  larger timeouts run 10-15 s. The remaining cause is CPU contention plus
  fresh-schema creation, not database opens. The t245 timeout raises in `modes.test`
  remain; I did not lower them.

Changed files: `runtime/service.ts`, `runtime/service/projects/index.ts`,
`runtime/service/projects/database-idle-close.ts` (new),
`runtime/service/projects/files-removal.ts` (new), `storage/project/database.ts`,
`storage/project/tests/database.test.ts`.
