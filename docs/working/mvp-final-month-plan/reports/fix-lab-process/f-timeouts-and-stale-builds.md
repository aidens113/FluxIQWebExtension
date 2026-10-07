# t289-F: heavy Core test timeouts (P3) and stale-build gates (P4)

Worker report. Trees: Core `fxwork/t289/!FluxIQ` (branch `task/t289-fix-lab-process`), downstream `fxwork/t289/!FluxIQWebExtension`. No commits, no Lab run, no browser or provider call, no full suite.

## Outcome

Done.
- P3: 32 heavy Core service test files now set their own timeout at the top of the file (60 s or 120 s). Two explicit per-test timeouts in those files were raised as well.
- P4: every downstream `build`, `check` and `test*` script of a package that links Core now runs the Core-build gate first. A new test fails the check if a script is added without it. The refusal names the command that was refused. Core's `apps/web` vitest config refuses a stale or missing `fluxiq`/`contracts` dist.

## What changed and why

### P3: per-file timeouts (Core, `packages/fluxiq/src/programs/automation-studio/`)

Mechanism: `vi.setConfig({ testTimeout: N, hookTimeout: N })` directly after each file's imports, with `vi` added to the vitest import where it was missing. Core's vitest config has one global 15 s value and no per-file mechanism. Vitest 2.1.9 reads `runner.config.testTimeout` when `it()` is defined (`@vitest/runner` dist/index.js:429), and calls `vi.resetConfig()` after every file (`runBaseTests`). So the setting applies to that file only. A scratch proof against Core's own `vitest.config.ts` (`--globals`, two 16 s tests): the file with `vi.setConfig({ testTimeout: 30_000 })` passed in 16.0 s, and the file without it failed with `Test timed out in 15000ms`. Explicit per-test and per-hook timeouts (for example `beforeAll(..., 60_000)` or `180_000`) still override the file value. No test body was changed.

Sizing rule. Every file below timed out at 15 s under full-suite load, and every ledger rerun at `--testTimeout=120000` passed (09-30 night: 24 files and 129 tests; 10-01: 22 files and 103 tests, then 8 files and 80 tests). The worst loaded per-case times on record are from t215 at 100% CPU: instruction-readiness 37.0 s, run-detail-preservation #1 35.8 s, adaptive-loop 33.6 s, execution-digest 27.6 s.
- **120 s:** the slowest test in the file took more than 7.5 s in this session's measurement (all 32 files, `--maxWorkers=2` on the shared machine), or the file has a loaded per-case time over 30 s on record.
- **60 s:** every other file. That is at least 8 times the slowest test measured here, and 4 times the old cap.

Measurement: `npx vitest run --maxWorkers=2 --testTimeout=120000 --reporter=json <32 files>` gave 191 of 191 passed. The "max" column below is the slowest test in each file.

| File (under automation-studio/) | Evidence (timed out at 15 s under load) | Max here | Timeout |
| --- | --- | --- | --- |
| api/handlers/tests/runs.test.ts | t192 baseline (09-29) | 15.9 s | 120 s |
| runtime/service/run-detail-read/tests/flow-run-detail-reader.test.ts | t192 both runs; sweep 10-05 (x4) | 9.2 s | 120 s |
| runtime/service/summaries/tests/run-detail-preservation.test.ts | t192; ledger 09-30-to-10-01; conv-parking; t215 35.8 s loaded | 13.8 s | 120 s |
| runtime/tests/service-adaptation/tests/adaptive-loop.test.ts | t192; ledger 09-30-to-10-01; t215 33.6 s loaded | 8.1 s | 120 s |
| runtime/tests/service-adaptation/tests/adaptive-retry-resume.test.ts | t192; t252; sweep 10-05; sweep 10-06 | 10.8 s | 120 s |
| runtime/tests/service-bootstrap/tests/catalog.test.ts | t192 baseline; t193 (15.276 s) | 8.5 s | 120 s |
| runtime/tests/service-flows/tests/execution-digest.test.ts | t192; ledger 09-30-to-10-01; t215 27.6 s loaded | 9.8 s | 120 s |
| runtime/tests/service-flows/tests/instruction-readiness.test.ts | t192; ledger 09-30-to-10-01; t252; sweep 10-05 (twice); t215 37.0 s loaded | 19.6 s | 120 s |
| runtime/tests/service-recordings/tests/recorded-gap.test.ts | t252 | 7.6 s | 120 s |
| runtime/tests/service-adaptation/tests/durable-patches.test.ts | t192 | 3.0 s | 60 s |
| runtime/tests/service-adaptation/tests/failed-start.test.ts | t192 (3 tests) | 4.5 s | 60 s |
| runtime/tests/service-adaptation/tests/modes.test.ts | t192; ledger 09-30-to-10-01 | 7.2 s | 60 s |
| runtime/tests/service-adaptation/tests/llm-diagnosis.test.ts | t192 after | 1.4 s | 60 s |
| runtime/tests/service-adaptation/tests/llm-run-caller.test.ts | t192 after | 6.2 s | 60 s |
| runtime/tests/service-adaptation/tests/iterating-recovery.test.ts | t192 after | 3.7 s | 60 s |
| runtime/tests/service-adaptation/tests/subflow.test.ts | fa-draft-routing (15 s + EBUSY) | 2.3 s | 60 s |
| runtime/tests/service-bootstrap/tests/rejections.test.ts | t192 (2 tests, EBUSY) | 2.5 s | 60 s |
| runtime/tests/service-bootstrap/tests/adaptation.test.ts | t192 after; t252-lead; sweep 10-05 | 3.6 s | 60 s |
| runtime/tests/service-bootstrap/tests/permission.test.ts | t192 after | 2.0 s | 60 s |
| runtime/tests/service-bootstrap/tests/plan-parameters.test.ts | t192 after | 0.7 s | 60 s |
| runtime/tests/service-bootstrap/tests/accounting.test.ts | t192 after; t193 (15.098 s) | 0.9 s | 60 s |
| runtime/tests/service-flows/tests/subflows.test.ts | t192 | 5.0 s | 60 s |
| runtime/tests/service-flows/tests/subflow-pagination.test.ts | t192 baseline; ledger 09-30-to-10-01; sweep 10-05 | 2.9 s | 60 s |
| runtime/tests/service-flows/tests/scale-pages.test.ts | t192 after | 5.8 s | 60 s |
| runtime/tests/service-flows/tests/runs.test.ts | t192 after | 1.8 s | 60 s |
| runtime/tests/service-flows/tests/flow-map.test.ts | t192 after; ledger 09-30-to-10-01 | 3.0 s | 60 s |
| runtime/tests/service-flows/tests/representation.test.ts | sweep 10-05 | 1.8 s | 60 s |
| runtime/tests/service-recordings/tests/assets.test.ts | t192 | 1.8 s | 60 s |
| runtime/tests/service-recordings/tests/proposal-approval.test.ts | t192 (2 tests) | 3.1 s | 60 s |
| runtime/tests/service-recordings/tests/proposals.test.ts | t187 p1 and rerun; t192; sweep 10-05; conv-service-headroom | 6.9 s | 60 s |
| runtime/tests/service-recordings/tests/task-proposals.test.ts | t192 after | 2.1 s | 60 s |
| runtime/tests/service-recordings/tests/storage.test.ts | t192 after | 3.5 s | 60 s |

Evidence sources: `automated-testing-facility-plan/reports/t192-bench-before.md` (table), `t192-bench-after.md` (both / baseline-only / after-only lists), `t187-bench-before.md`, `t193-seed-A.md`; `language-driven-flow-loop-plan/archive/ledger-2026-09-30-to-10-01.md` (09-30 entry); `language-driven-flow-loop-plan/reports/t215-slow-service-tests.md`; `general-flow-authoring-plan/reports/t252-lead.md`; `flow-authoring-and-defensive-runtime-plan/reports/fa-draft-routing.md`; `mvp-final-month-plan/reports/sweep-2026-10-05.md`; `mvp-final-month-plan.md` (10-06 sweep 1).

Two explicit per-test timeouts would have overridden the file value, so they were raised:
- `proposals.test.ts` line 183: `}, 15_000)` changed to `}, 60_000)`.
- `permission.test.ts` line 172: `}, 30_000)` changed to `}, 60_000)`. Its own comment says "about 6 s alone, past 15 s beside other files".

Other explicit `60_000` per-test values in these files were left as they are.

### P4: stale-build gaps found and closed

Audit of every downstream `build` / `check` / `test*` script, plus the sweep path:

| Gap | Effect | Fix |
| --- | --- | --- |
| `domain build` had no Core gate | tsc compiles against old Core declarations, giving a false TS2305 failure or a false pass | gate added |
| `extension build`, `test:e2e:build`, `test:e2e`, `test:content` had no Core gate | the bundle embeds the old Core dist; test:content specs import the domain runtime, which loads Core | gate added |
| `test-runner build`, `check` had no Core gate (only `test` had one) | the 10-05 sweep's `pnpm build` failed test-runner tsc with 9 TS errors that were only exports missing from the old dist | gate added |
| `test-contracts build`, `check`, `test` had no Core gate; the package links and imports `@fluxiq/contracts` | compiles against an old contracts dist | gate added |
| Nothing stopped a new Core-linked script from omitting the gate | the gap reopens | `scripts/check/core-build/tests/package-gates.test.mjs` fails on any `build` / `check` / `test` / `test:*` script (except `test:e2e:report`) of a package that depends on `fluxiq` or `@fluxiq/*` and does not start with the gate. This runs in `pnpm check` through `scripts/check/**/tests`. |
| The refusal always said "pnpm check: ... run pnpm check again", even when a build or test refused | wrong instruction | `gate-name.mjs` names the refused command from pnpm's `npm_lifecycle_event` / `npm_package_name` (for example `pnpm --filter @fluxiq-web-extension/domain build`). `coreBuildFreshness` takes `{ gate }`, and the message still names the rebuild command and the Core directory. |
| Core `apps/web` vitest imports `fluxiq` through package exports, which resolve to dist (10-02: two conversation tests failed on a stale dist) | false failure or pass in Core's own `pnpm test` / sweep | `apps/web/vitest.config.ts` refuses at config load when `packages/{contracts,fluxiq}/dist` is missing or older than their non-test source. The message names `pnpm --filter @fluxiq/contracts --filter fluxiq build (in <Core>)`. |

Rebuild versus refuse: everything refuses. The Core beside a downstream checkout or worktree is shared by sibling tasks and running Labs, and a rebuild deletes modules under them. That is the same reasoning as the existing `core-build/freshness.mjs`.

Already covered, so not changed:
- The domain dist for test-runner: `domain-dist.mjs` rebuilds it through the build cache (t225).
- The Lab: `run-lab.mjs` checks Core missing or stale before the build phase, and `domain-build-staleness.mjs` checks after it.
- The extension, domain `check` and domain `test` resolve the domain from `src` (`exports` "." and "./client"). Only `./node` is dist, and only test-runner and the Lab use it.
- Core `fluxiq` and `client-gateway-websocket` vitest run from source or source aliases.

## Commands run and observed results

- Fail-first, before the gate change: `node --test "scripts/check/**/tests/*.test.mjs"` gave `# pass 4 # fail 3`:
  - freshness "a refusal names the command it refused" failed.
  - gate-name.test.mjs failed (`does not provide an export named 'gateName'`).
  - package-gates listed 11 ungated scripts: domain build; extension build, test:content, test:e2e:build, test:e2e; test-contracts build, check, test; test-runner build, check.
- After: same command, `# pass 9 # fail 0`.
- `node --test "scripts/check/**/tests/*.test.mjs" "scripts/lab/prelude/tests/*.test.mjs" "scripts/lab/tests/*.test.mjs"` (D) gave `# tests 36 # pass 36 # fail 0`, EXIT=0.
- `node --test "scripts/build-cache/tests/*.test.mjs"` (D; the registry test parses package.json scripts) gave `# tests 53 # pass 53 # fail 0`.
- `node scripts/structure-audit.mjs` (D) gave `structure-audit: passed (172 warning(s), 118 baselined).`
- `node scripts/build-cache/cli.mjs structure-audit:check` (C root) gave `structure-audit: passed (265 warning(s), 349 baselined).`, EXIT=0.
- Live gate wording in D, where t289's Core dist is stale from another worker's `fallback.ts` edit:
  - `pnpm --filter @fluxiq-web-extension/domain build` was refused with "pnpm --filter @fluxiq-web-extension/domain build: FluxIQ Core's build at ...\t289\!FluxIQ is 9 minute(s) behind its source ... then run pnpm --filter @fluxiq-web-extension/domain build again: pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build (in ...)".
  - `pnpm --filter @fluxiq-web-extension/test-runner check` was refused the same way.
  - `node scripts/check/core-build.mjs` took 4.5 s wall and refused as "pnpm check: ...".
- Core web guard:
  - Real tree: `npx vitest run src/app/tests/GlobalClientGatewayPairing.test.ts` gave EXIT=1 with "apps/web tests: Core's library build is 9 minute(s) behind its source. Stale: ...fallback.ts ... Rebuild, then run the tests again: pnpm --filter @fluxiq/contracts --filter fluxiq build (in ...)".
  - Scratch fake Core (the config copied, `node_modules` junctioned and removed afterwards):
    - Fresh dist, with only a newer `tests/*.test.ts` in src: `Tests 1 passed`, EXIT=0.
    - Newer source: EXIT=1, "3 minute(s) behind".
    - `fluxiq/dist` removed: EXIT=1, "packages/fluxiq/dist is missing ...".
- `npx tsc --noEmit -p .` in C `apps/web`: EXIT=0. In C `packages/fluxiq`: EXIT=0.
- `npx vitest run instruction-readiness.test.ts proposals.test.ts api/handlers/tests/runs.test.ts` (C `packages/fluxiq`, no timeout flag) gave `Test Files 3 passed (3)`, `Tests 16 passed (16)`. The slowest test this time was 11.2 s, so this run did not itself exceed 15 s. The scratch 16 s proof above is what shows the file timeout takes effect.
- Measurement run: all 32 files, `Tests 191 passed`, per-file maxima as in the table.

## Not verified

- No full suite was run (forbidden), so it is not shown that the next sweep has no 15 s timeouts. That is for the supervisor's next sweep.
- The gate's pass path was not shown on the real tree, because t289's Core dist is stale from concurrent work and I did not rebuild it while others use the tree. The unit tests cover the pass path (`a Core built after its newest source is fresh`). For the web guard, the fake-tree run covers it.
- `pnpm task start` was not exercised. It runs `pnpm build` after building or moving Core, so the new build gates should see a fresh Core. A paired task whose existing Core worktree is built but stale would now be refused at that `pnpm build`, after the worktree exists (`scripts/task/start.mjs:75` only builds an unbuilt Core). I do not own that file.
- Extension `test:e2e` and `test:content` were not run; only the script text changed.

## Open questions or contradictions found

- `storage/project/tests/runtime-stream-store.test.ts`, the million-event case, timed out at its own explicit 60 s under load (t192, t193), with EBUSY cascades into later tests. I left it unchanged because no loaded duration is recorded to size it from. If wanted, measure it and raise that explicit timeout.
- The gate checks all of Core's packages, so test-contracts (which needs only `@fluxiq/contracts`) is refused when only `fluxiq` is stale. This is stricter than necessary, but the fix (rebuild Core's libraries) is the same.
- Possible follow-up for the supervisor: `task/start.mjs` could rebuild a stale (not only unbuilt) private Core worktree before its `pnpm build`.
