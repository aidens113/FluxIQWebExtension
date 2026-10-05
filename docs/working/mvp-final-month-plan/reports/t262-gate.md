# t262 narrow integration gate

Brief: `t262-gate` in `docs/working/mvp-final-month-plan.md`. Run 2026-10-05 by a worker.
Trees: `C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQ` (HEAD `db538300`) and `.../t262/!FluxIQWebExtension` (HEAD `6fe7f942`), branch `task/t262-mvp-live-continuation`.
Logs: `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/0308f367-bc34-4266-8bc3-8790a8827c7a/scratchpad/t262-gate/NN-*.log` (below, `<L>`).

## Outcome

Partial. 13 of 14 commands passed. One failure, introduced by t262: `extension check` fails with one TypeScript error in a t262 test file. All changed-test subsets pass (Core 939, web 29, domain 139, extension 53, test-runner 141; 0 failures).

Observation: `git status --short` was empty in both t262 trees at the start, so the uncommitted B7/C4 work that Current State describes is no longer in these working trees (moved or discarded before this run; not investigated).

## Commands run and observed results

| # | Command (cwd) | Exit | Summary | Log |
| --- | --- | --- | --- | --- |
| 01 | `pnpm.cmd build` (Core root) | 0 | contracts reuse, fluxiq:build rebuilt (inputs changed, 5397 files), client-gateway-websocket reuse, web:build built (Next build OK, 87 s) | `<L>/01-core-pnpm-build.log` |
| 02 | `node scripts/build-cache/cli.mjs structure-audit:check` (Core) | 0 | `structure-audit: passed (243 warning(s), 349 baselined).` | `<L>/02-core-structure-audit-check.log` |
| 03 | `node scripts/build-cache/cli.mjs --parallel fluxiq:check web:check` (Core) | 0 | both steps built (inputs changed), no errors | `<L>/03-core-fluxiq-web-check.log` |
| 04 | `npx vitest run <65 changed test files>` (`packages/fluxiq`) | 0 | Test Files 65 passed (65); Tests 939 passed (939) | `<L>/04-core-fluxiq-vitest-changed.log` |
| 05 | `npx vitest run <2 changed test files>` (`apps/web`) | 0 | Test Files 2 passed (2); Tests 29 passed (29) | `<L>/05-core-web-vitest-changed.log` |
| 06 | `pnpm.cmd --filter @fluxiq-web-extension/domain build` | 0 | domain:build reuse (stamp match) | `<L>/06-domain-build.log` |
| 07 | `pnpm.cmd --filter @fluxiq-web-extension/domain check` | 0 | core-build gate: Core current; domain:check reuse (stamp match) | `<L>/07-domain-check.log` |
| 08 | `pnpm.cmd --filter @fluxiq-web-extension/extension check` | **1** | `src/panel/chat/stream/tests/target-activity.test.ts(16,67): error TS2741: Property 'projectId' is missing ...` (only error) | `<L>/08-extension-check.log` |
| 09 | `pnpm.cmd --filter @fluxiq-web-extension/test-runner check` | 0 | test-runner:check built (inputs changed), no errors | `<L>/09-test-runner-check.log` |
| 10 | `node scripts/structure-audit.mjs` (downstream) | 0 | `structure-audit: passed (165 warning(s), 118 baselined).` | `<L>/10-structure-audit.log` |
| 11 | domain changed tests, label `t262` (12 files) | 0 | tests 139, pass 139, fail 0 | `<L>/11-domain-tests-changed.log` |
| 12 | extension changed tests, label `t262` (10 files) | 0 | tests 53, pass 53, fail 0 | `<L>/12-extension-tests-changed.log` |
| 13 | test-runner changed tests (19 files): core-build gate, domain-dist, `test-runner:build` (reuse), `node --test dist/<files>.js` | 0 | tests 141, pass 141, fail 0 | `<L>/13-test-runner-tests-changed.log` |
| 14 | `pnpm.cmd --filter @fluxiq-web-extension/extension build` | 0 | extension:build reuse (stamp match) | `<L>/14-extension-build.log` |

Changed-test lists come from `git diff --name-only dev...HEAD | grep -E '/tests/.*\.test\.ts$'` in each repository, split by package; each log's first line records the subset used.

### How the domain and extension subsets ran

`domain/scripts/test-domain.mjs` and `apps/extension/scripts/test-extension.mjs` have no subset option: they bundle and run every `src/**/tests/*.test.ts`. To run only the changed files, a scratch script (`<L>/run-subset.mjs`, outside the repo) bundles just those entries with the same esbuild options (node22 ESM, bundle, same `fluxiq` / `@fluxiq/client-gateway-websocket` externals) into the ignored labelled directory `<pkg>/.test-build-scratch/t262/`, then `node --test` runs the bundles. The extension script's extra `scripts/**/tests/*.test.mjs` imports and `smoke-test.mjs` were not run (no t262 change there).

## Failure diagnosis: 08 extension check

- Error: `apps/extension/src/panel/chat/stream/tests/target-activity.test.ts:16` builds a fixture subject `{ kind: "build", id: "unknown", flowId: "unknown-flow" }` without `projectId`, to model "unknown" (unscoped) activity.
- Core's contract `packages/contracts/src/client-gateway.ts:177` types `ClientGatewayActivity.subject` as `{ kind: "build" | "run"; id: string; projectId: string; flowId?: string }`. `projectId` has been required since Core `42ccb32c` (2026-09-29); t262 does not change `packages/contracts` (`git diff --stat dev...HEAD -- packages/contracts` is empty).
- The line arrived in t262 commit `408ec3da` ("Scope mounted chat creation and add provider-free project setup", 2026-10-03). `dev`'s version of the file has no `unknown` case. **Introduced by t262, not pre-existing on dev.**
- Runtime is unaffected: the test passes under esbuild (log 12), which does not type-check. Codex's recorded gate (continuation doc ledger line 483) lists Core/web/domain/Lab types, not the extension typecheck, which is why it was not caught.
- The fix belongs to the test or the contract, not both: either cast/annotate the fixture (e.g. build the subject as an unknown-shaped value) to keep testing malformed input, or make `projectId` optional in the contract if unscoped activity is a real wire case. That is a design choice for the supervisor; nothing was edited.

## What changed and why

No repository file was edited. Written: the 14 logs and `run-subset.mjs` under `<L>`, and this report. Build output written by the commands: Core `dist`/`.next` and build-cache stamps (01, 03), test-runner check stamp (09), and the ignored `domain/.test-build-scratch/t262/` and `apps/extension/.test-build-scratch/t262/` bundles. `git status --short` in the downstream t262 tree was still empty after the run.

## Not verified

- Several downstream steps were stamp reuses (06, 07, 13 build, 14), not fresh compiles; the build cache's inputs include Core's `packages/fluxiq/dist` and `src`, so a reuse means those inputs matched a stored stamp.
- `dev`'s extension check was not run to prove it passes there; "pre-existing vs introduced" rests on `dev`'s copy of the test lacking the offending line and the contract being unchanged.
- Lab tests (`scripts/lab/**`), extension `smoke-test.mjs` and script tests, full suites, browser and live behaviour: not run (out of brief).
- Core `client-gateway-websocket` and `contracts` checks were not run (brief named only fluxiq:check and web:check).

## Open questions or contradictions found

- Current State says the B7 binding fix and C4 fixture are uncommitted in t262; both trees were clean at this run. The supervisor should confirm where that work went before landing t262.
- Decide the target-activity fixture fix (test-side cast vs optional `projectId` in Core contract) before `pnpm task finish`.
