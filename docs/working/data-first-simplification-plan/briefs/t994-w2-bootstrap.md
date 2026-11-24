# t994 W2: Flow build, bootstrap and re-author sweep failures (worker-heavy)

Goal: every listed failure passes for the right reason: a product regression fixed at its cause, or a test pinning deliberately superseded behaviour updated to the new contract, citing the superseding commit and rule. Never weaken an assertion, delete or skip a test, raise a timeout or cap a symptom.
Code: `C:/Users/osrs_/FluxStuff/fxwork/t994/!FluxIQ` (Core, HEAD 2dba34613). Rules: Core `AGENTS.md`; superseding rules are U1 (no model ladder, fixed starting model, judge on the same model), t976 (permission asked once at start), t981 (repeat-safe repair), t984/P2 (automatic data stage), t987/P6 (smaller judge evidence).
Evidence: sweep log `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/b9e846ce-920f-4917-ba85-cff713b3e423/scratchpad/sweep/core-test-clean.txt`; one line per failure (log line number, file > test || first error) in `.../scratchpad/sweep/fails-index.txt`.

Your failing files, under `packages/fluxiq/src/` (group in brackets):
- `framework/automation-service/tests/{service-bootstrap,deepseek-bootstrap,refuted-result,service-adaptation}/tests/*.test.ts` that appear in the index [real-sql]
- `framework/automation-service/service/flow-bootstrap-commands/tests/*` (candidate-describe-call, candidate-generation, candidate-tool-cards, candidate-unusable-reply, service-cancellation) [real-sql]
- `framework/automation-service/service/{runtime-adaptation/tests/repair-followups,datasets/tests/repaired-run-rows,project-build/tests/project-build-facade,tests/provider-unavailable-authoring-modes}.test.ts` [real-sql]
- `programs/automation-studio/api/tests/{caller-paid-result-check,person-project,service-bootstrap-adaptation}.test.ts` [real-sql]
- `runtime/llm/evidence-loop/tests/request-prefix.test.ts` [real-sql]
- `framework/automation-service/service/runtime-adaptation/tests/refuted-result-port.test.ts`, `runtime/adaptation/recovery/refuted-result/tests/refusing-codes.test.ts` [parallel]
Leading symptoms: `totalProviderCallCount` mismatches, "Flow Bootstrap generation failed", `evidence_budget_exhausted`, cost 0.25 vs 0.24, a refusal-code list grown from 24 to 25. Find the few shared causes first; do not patch per test.
Method: reproduce one small file first; find the breaking commit by reading history (`git log -p`, `git show <rev>:<path>`, `git diff <rev>..HEAD -- <path>`); no checkout or bisect (git mutations are forbidden).

Owned (may edit): the test files above and their support files; product source under `framework/automation-service/service/{flow-bootstrap-commands,runtime-adaptation,datasets,project-build}/**`, `framework/automation-service/tests/**` except `person-humanness/**`, `runtime/adaptation/**`, `runtime/llm/evidence-loop/**`, `programs/automation-studio/**`.
Must not touch: `framework/automation-service/service/answer-first/**` (W1, and result-feed is lane t993), `runtime/flow-authoring/**` and other `runtime/llm/**` (W3), `packages/contracts/src/record-sets/process/**`, `apps/web/**`. If the cause lies outside your owned paths, do not edit it: report the diagnosis with a proposed diff.

Run tests only like this (from `packages/fluxiq`), named files only, never the whole suite, one heavy job at a time:
`node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t994-w2 -- node ../../scripts/vitest-groups.mjs --groups=real-sql <files> --maxWorkers=1 --minWorkers=1 --fileParallelism=false`
(use `--groups=parallel` for the two parallel files). No git mutations, no `node -e`, no provider or paid calls, no browsers.

Acceptance: every listed file passes; run `node scripts/structure-audit.mjs` from the Core root if you changed source.
Report: `C:/Users/osrs_/FluxStuff/fxwork/t994/!FluxIQWebExtension/docs/working/data-first-simplification-plan/reports/t994-sweep-fix-core/w2-bootstrap.md`: per cause cluster: cause, breaking commit, fix or test update (with the rule cited), files changed, exact commands with observed pass/fail counts. End with the return contract.
