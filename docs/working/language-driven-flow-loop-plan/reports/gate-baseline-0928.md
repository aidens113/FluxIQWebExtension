# gate-baseline-0928 — worker report

Read-only validation of Core `F:\!FluxIQ` e82089f and downstream `F:\!FluxIQWebExtension` acc4648a. No source edited. Logs are in the worker scratchpad (`.../24b1e43e-.../scratchpad/*.log`). No native crash (0xC0000005, allocation failure, Turbopack panic) occurred, so nothing was rerun for that reason.

## Outcome

Partial. Core: check, test and the package builds all ran. Downstream: `pnpm check` ran, including `pnpm -r --no-bail check`. The supervisor stopped `pnpm test` midway, and `pnpm build` was not run, because the supervisor said the known `packet.ts` compile break makes further downstream failures uninteresting.

## What changed and why

Nothing in either repository. I wrote only this report.

## Commands run and observed results

### Core (F:\!FluxIQ, e82089f)

1. `pnpm check`: **EXIT 1**. `structure:test` passed 182/0 and `task:test` passed 20/0. The structure audit then **FAILED** with 2 `[imports]` violations:
   - `packages/fluxiq/src/programs/automation-studio/runtime/llm/loop-budget.ts:36` imports `./evidence-loop/exhaustion.ts`.
   - `.../llm/loop-configuration.ts:25` imports `./evidence-loop/resume.ts`.
   Both are type-only imports that bypass the `evidence-loop/index.ts` barrel, which already re-exports both files. **Introduced by e82089f**, which touched both files and added `exhaustion.ts` and `resume.ts`. The audit also says "1 baseline entries can be lowered". Fix: import from `./evidence-loop/index.ts`, then run `pnpm structure:baseline`.
2. `pnpm -r check`, run separately because the chain stops at the audit: **EXIT 0**. contracts, client-gateway-websocket, fluxiq and apps/web type-check clean.
3. `pnpm test`: **EXIT 1**. contracts passed (9 files) and client-gateway-websocket passed (1 file). `packages/fluxiq` had **10 failed files, 424 passed (434)**. apps/web did not run because the recursive run stops at the first failure. The failures:
   - **Logic failures (tests not touched by e82089f; the source they cover was changed by e82089f, so the test expectations are behind the new behaviour):**
     - `runtime/llm/tests/loop-budget.test.ts:23` "is the fewest decisions any bound allows…": received has an extra `limitedBy: "tokens"`. Cause: e82089f changed `llm/loop-budget.ts`.
     - `runtime/flow-bootstrap/tests/evidence-loop-steps.test.ts:20` "carries every refused amendment…": received has an extra `amendmentRefusals: ["9:no_such_step","1:already_so"]`. Cause: e82089f changed `flow-bootstrap/evidence-loop-steps.ts`.
     - `runtime/llm/tests/unusable-decision.test.ts:352` "stops when the same issues come back, whatever their order": expected `stalled on a.issue,b.issue,a.issue`, got `stalled on a.issue,b.issue`. Probable cause: e82089f changed `evidence-loop/no-progress.ts` (+3 lines). `unusable-decision.ts` itself is untouched.
     - `runtime/tests/deepseek-bootstrap-exploration.test.ts:661` "reproduces the measured 26-decision creation exhaustion…": the last two decisions offer `[complete, amend_draft]` without `tool_call`. Cause: the wrap-up/budget change in `loop-budget.ts` and `evidence-loop.ts` (e82089f). The test was last touched by 8b56084.
     - `runtime/tests/service-bootstrap/tests/generation.test.ts:274` "packs opted-in reusable context only after a fresh creation inspection…": `selectedEvidence` has length 2, expected 1. It fails the same way in isolation, so it is deterministic. Probable cause: the e82089f evidence-loop changes (`completion-attempt.ts`, `resume.ts`, `evidence-loop.ts`) or `generation-request.ts`. I did not confirm which.
   - **Load timeouts, not defects:** 7 tests in `run-detail-preservation`, `adaptive-loop` (2), `adaptive-retry-resume`, `modes`, and `recovery-trace` (2) each hit `Error: Test timed out in 15000ms`. Rerun in isolation (`npx vitest run <6 files>` in packages/fluxiq), all 7 **passed** (22/23; the only failure was generation.test.ts above). None of these files was touched by e82089f.
4. `pnpm --filter @fluxiq/web test`, run separately: **EXIT 1**. 1 failed file, 259 passed (260); 19 failed tests, 1498 passed (1517). All 19 are in `apps/web/src/features/automation-studio/conversation/capabilities/tests/core-contract.test.ts`, which **e82089f added** (the in-flight "contract tests through Core's real handlers" worker). It reports "31/47 variants accepted by Core across 39 capabilities". The rejections fall into two groups:
   - The fixture world is missing something: "Flow bootstrap generation runtime is unavailable", "An enabled LLM key is required", or "Flow Bootstrap requires a Flow without a Router".
   - The capability and Core disagree: `authorizationPin` is demanded for create/rename/note/publish/deprecate, `route.delete` never sends `routeId`, and `flow.instruct` never sends title/body.
   These are the findings of an unfinished test, not regressions.
5. Package builds needed downstream (`domain/package.json` links `packages/fluxiq` and `packages/client-gateway-websocket`; contracts is their dependency): `pnpm --filter @fluxiq/contracts build && pnpm --filter fluxiq build && pnpm --filter @fluxiq/client-gateway-websocket build` gave **EXIT 0**. Core's AGENTS.md names only `pnpm build`. I did not run the `@fluxiq/web` (Next/Turbopack) build because downstream does not consume it.

### Downstream (F:\!FluxIQWebExtension, acc4648a)

1. `pnpm check`: **EXIT 1**. `structure:test` passed 182/0, `lab:test` passed 106/0, and `task:test` passed 120/0; `task:test` includes `scripts/worktree/tests/`. The structure audit then **FAILED** 1 rule:
   - `[working-docs] docs/working/README.md is out of date`. Cause: the index embeds line counts. `automated-testing-facility-plan.md` shows 520 in the README but has 523 lines; `manual-panel-test-findings.md` shows 276 but has 311. Those lines were added by 1fb57cbc, ea93f549 and 0a3362c8, **not acc4648a**. Fix: `pnpm structure:baseline`.
2. `pnpm -r check`: **EXIT 2**. `domain` failed with `src/runtime/llm-evidence/structure/packet.ts(127,66) TS2345: … missing the following properties from type 'OptionalFields<WebAutomationExtractListRequest>': sort, dedupe`. acc4648a added `sort`/`dedupe` in `domain/src/actions/extraction/request.ts` and `schema.ts`. `packet.ts` was last touched by f3e8fec9, not acc4648a. The supervisor already knows about this break.
3. `pnpm -r --no-bail check`: **EXIT 1**. The same `packet.ts` error also fails `apps/extension`. `packages/test-runner` has 64 errors: `TS2835`/`TS2834` from `domain/dist/index.d.ts` (specifiers without extensions), plus missing exports from `@fluxiq-web-extension/domain/node`. The `domain/dist` is dated 22:14:00 today, so it came from a domain build run by another process, not me. In that build `tsc` failed on `packet.ts`, so `rewrite-dist-specifiers.mjs` never ran. This is a knock-on of the same break. Every other package checked clean.
4. Uncommitted `scripts/worktree/tests/core-sibling.test.mjs` (+4 lines): `node --test scripts/worktree/tests/core-sibling.test.mjs` gave **6/6 pass**. It also passed inside `task:test`.
5. `pnpm test`, started 22:40:38: **stopped on supervisor request** before it finished.
   - Partial results: boundary-audit, test-contracts, real-site-policy, test-matrix, agent-orchestrator and test-evidence finished Done. `domain` passed **865/865** (its test build does not hit the `packet.ts` error). `apps/extension` was still running at ok 953 when stopped.
   - `apps/scenario-lab` failed its browser tests (not ok 28–39+, `hookFailed`) with `browserType.launch: Executable doesn't exist at C:\Users\osrs_\AppData\Local\ms-playwright\chromium-1161\chrome-win\chrome.exe`. This is environmental: the Playwright browser is not installed. See the playwright note below.
6. `pnpm build`: **not run**, per the supervisor's instruction.

### Repository and auth state

- `F:\!FluxIQ` `git status -sb`: `## dev...origin/dev`. Clean, and neither ahead nor behind after `git fetch`.
- `F:\!FluxIQWebExtension` `git status -sb`: `## dev...origin/dev`. Neither ahead nor behind after fetch. It shows ` M scripts/worktree/tests/core-sibling.test.mjs` and `?? docs/working/language-driven-flow-loop-plan/reports/inflight-audit-0928.md`, which is not mine, plus this report.
- `gh auth status`: "You are not logged into any GitHub hosts. To log in, run: gh auth login". Pushing through `gh` or HTTPS may need a login.

### Processes (supervisor query)

- Mine: the 22:40:38 `pnpm test` (bash 15092). I killed the bash wrapper, but its pnpm tree survives: **PID 13664 → 14568 → 1216 → 6320** (`pnpm build && node --test dist/**/*.test.js`). A further `taskkill /T /F /PID 13664` was **denied by the permission classifier**, so the supervisor or user must stop it.
- Not mine: the `pnpm exec playwright install chromium` running since 21:53:48 (PID 12956, from a different shell snapshot, `5qtyq1`) and the 22:14:00 `pnpm test` (PID 9960). I left both alone. The playwright install is probably hung or starved, and it explains the missing chromium-1161.

## Not verified

- Downstream `pnpm test` did not finish (extension, test-runner and later packages), and downstream `pnpm build` was not run.
- Core `pnpm build` of `@fluxiq/web` was not run.
- The exact root cause of `generation.test.ts` (evidence length 2 vs 1). I did not bisect against e82089f^.
- The 7 Core timeouts pass in isolation. I did not re-check them under a quiet machine running the full suite, and the other session's concurrent `pnpm test` was probably contributing load.

## Open questions or contradictions found

- Should the e82089f behaviour changes (`limitedBy`, `amendmentRefusals`, wrap-up without `tool_call`, the stall message) be adopted by updating the 4–5 tests, or are they unintended? The worker reports under `docs/working/**/reports/` should say which.
- Core's AGENTS.md does not name which packages downstream needs built, so I inferred them from `domain/package.json` links plus the Core build order.
