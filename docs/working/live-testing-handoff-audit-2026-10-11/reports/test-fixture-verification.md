# t380 fixture verification on integrated current source

## Supervisor verification — 2026-10-11

Merged latest integrated Core dev b27c0d64 into this task (9a51dd44); no live lane or dev source changed.
Inspected all four fixture diffs: reusable setup copied only after owner shutdown, sidecar refusal retained,
fresh per-test owners and exact corruption codes/physical-effect assertions preserved. Owning baseline refresh
lowered only creation.test.ts 8 to 7 and whole-fixture.ts 2 to 1; no new allowance.
Fresh owning fluxiq library build executed successfully (181.800 s, 7206 stamped outputs), cache-free package
typecheck exit 0 and Core structure audit exit 0. Independently ran all five named owner/consumer files:
45/45 passed, 115.26 s, including 16 actual-built child-process writer-race/crash probes. Unit is verified and
ready for integration; commit locally and keep dev frozen until active live streaks end.

Status: Ready for supervisor integration; narrow checks passed, baseline refresh owed.
Owner: test-fixture-verification worker.

## Current State

Supervisor integrated current dev into both t380 trees before dispatch. Verified Core HEAD ae67f16519f4be26f0021bc421e9bc80a11b92cb and downstream 81abf33a (task/t380-load-sensitive-tests). Four committed fixture changes ebc3a1b35d68dc24aa78fae9afe4b6bac19b2276 remain; recovery-trace auto-merge verified by passing current tests. Restored current contracts build dependency and executed fresh owning Core library build before process probes. All five focused files pass (45 tests); after correcting two reproduced packing violations, all four affected subject/consumer files pass again (41 tests), actual package typecheck and both audits pass. Only new edits separate statements in creation.test.ts and whole-fixture.ts; no behavior change. Supervisor baseline refresh/integration/commit owed; dev must stay frozen during paid streaks.

## Inspection

Creation fixtures build each mode project once, close project pool, require no SQLite sidecars, copy into unique temporary roots and wire new owners; test subjects still create/save actual Flows. Recovery fixtures close service before copy, assert no sidecars, open each service only after copy and close all services before cleanup. Whole-template helper similarly closes pool, refuses WAL/SHM/journal sidecars before copy, clones identifiers and wires fresh owners. SQL corruption probes assert concrete guard refusal, unchanged physical metadata/feed/receipt counts. Existing whole-operation/whole-process consumers keep their full real subject workload; process child probe loads library dist. Cleanup paths are known mkdtemp test roots; no user profiles/data involved.

### Build dependency correction

Initial `pnpm.cmd --filter fluxiq build` exited 1: current fluxiq source references new client-gateway types (ClientGatewayReconcileAnswer, ClientGatewayActivityRecovery/Skip etc.) absent from retained contracts dist. Owning build cache correctly reports contracts/fluxiq inputs changed; no product source patch warranted. Rebuild contracts prerequisite through owning script, then retry fluxiq library build before process probes. Failed build is not usable fresh-code evidence.

### Fresh build observed; gate issue reproduced

Contracts owner build restored current matching outputs; newly required types confirmed in contracts dist. Retried fluxiq owner build executed actual clean/compiler/declaration rewrite/identity path, exit 0, 60.355 seconds, 7206 current artifacts stored. Whole-process probes now load this current compiled library. Five focused files and actual package typecheck running.

Current Core structure audit fails two existing t380 fixture regressions against newer baseline: creation.test.ts has 11 packed lines (baseline 8), whole-fixture.ts has 4 (baseline 2). Narrow whitespace/statement separation correction will follow completion of running checks; no behavioral/test-timeout changes. Downstream audit exit 0. No artifact-data/secret output included.

### Narrow subject tests completed

Five files / 45 tests passed, exit 0, 96.54 seconds, against actual freshly built current code. Whole-process child race and seven crash phases for SQL/file modes all passed (16 tests); no fixture/copy/WAL/timeout failure. Owning package actual typecheck exit 0. Corrected reproduced statement-packing violations only by separating added fixture setup/cleanup statements in creation.test.ts and whole-fixture.ts; no semantic change, new assertions or timeout increase. Rerun affected tests/consumers and Core audit next; runtime/source output unaffected by test-only formatting.

### Post-correction gates observed

Core structure audit now passes (330 warnings, 1159 baselined) and requests lowering two baseline entries. Baseline file is outside this worker's ownership; supervisor refresh owed before integration. Actual owning typecheck rerun after formatting exits 0. Post-format creation/whole-sql/whole-operation all pass; whole-process final receipt pending. No library rebuild needed after test-only formatting (library tsconfig excludes tests).

## Final observed results

| Check | Observed |
| --- | --- |
| Initial 5-file focused run | 45/45 tests passed, 96.54 s, exit 0 |
| Post-format 4-file affected run | 41/41 tests passed, 74.70 s, exit 0 |
| Recovery-trace auto-merge | 4/4 tests passed in initial run; untouched afterward |
| Actual-built process probes | 16/16 passed in both runs: SQL/file two-writer races, seven per-mode kill phases; held authority prevented later writes |
| Typecheck before/after formatting | actual tsc, exit 0 both times, task-specific incremental cache |
| Core audit after formatting | exit 0, 330 warnings / 1159 baseline; 2 entries can be lowered |
| Downstream audit | exit 0 |
| Diff validation | git diff --check clean; only 2 owned Core fixture formatting changes plus own downstream report |

Fresh Core artifact identity digest: `70ceb9d536c291d465b04e9bc49deb54f0eae7e64a9ef380c1db239fb0427faf`. Source/test-only edits excluded by owning library build config, so later formatting does not change the tested production artifact. Existing child probe imports actual `dist` after framework-first initialization.

Exact owning test files (Core, relative to packages/fluxiq/src/programs/automation-studio):

- `runtime/service/flows/tests/creation.test.ts` (5).
- `runtime/tests/service-adaptation/tests/recovery-trace.test.ts` (4).
- `storage/canonical-authority/tests/whole-sql.test.ts` (14).
- `storage/canonical-authority/tests/whole-operation.test.ts` (6).
- `storage/canonical-authority/tests/whole-process.test.ts` (16).
- Shared changed helper: `storage/canonical-authority/tests/whole-fixture.ts`.

## Commands

Core tree, no whole-suite invocation:

```text
pnpm.cmd --filter @fluxiq/contracts build
pnpm.cmd --filter fluxiq build
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/service/flows/tests/creation.test.ts src/programs/automation-studio/runtime/tests/service-adaptation/tests/recovery-trace.test.ts src/programs/automation-studio/storage/canonical-authority/tests/whole-sql.test.ts src/programs/automation-studio/storage/canonical-authority/tests/whole-operation.test.ts src/programs/automation-studio/storage/canonical-authority/tests/whole-process.test.ts
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/service/flows/tests/creation.test.ts src/programs/automation-studio/storage/canonical-authority/tests/whole-sql.test.ts src/programs/automation-studio/storage/canonical-authority/tests/whole-operation.test.ts src/programs/automation-studio/storage/canonical-authority/tests/whole-process.test.ts
pnpm.cmd --filter fluxiq exec tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/t380-fixture-verification.tsbuildinfo
node scripts/structure-audit.mjs
```

Downstream: structure audit and own authored report only. Supervisor needs `pnpm structure:baseline` to record the two lower entries, outside worker file ownership.

## Limits and integration handoff

Ready bounded test-only unit, with supervisor baseline refresh and independent verification owed. No artificial stress loop or whole suite, no universal claim that timeout can never recur. Copied fixture paths are isolated mkdtemp roots; template sidecar fences passed, fresh owners opened, normal and killed child lifecycles verified by subject assertions. No new test/assertion/timeout/provider/browser/user-panel changes; no product-source edits, shared working docs, commits, merges or pushes. Live A-D source/streaks untouched. Historical t380 report remains unchanged as requested ownership; this current report supersedes its stale uncommitted/suite-needed claims.
