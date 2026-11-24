# t994 W3: parallel-group sweep failures in runtime and authoring (worker)

Goal: every listed failure passes for the right reason: a product regression fixed at its cause, or a test pinning deliberately superseded behaviour updated to the new contract, citing the superseding commit and rule. Never weaken an assertion, delete or skip a test, or cap a symptom. A wording pin updated to new wording must still pin the meaning the test exists for.
Code: `C:/Users/osrs_/FluxStuff/fxwork/t994/!FluxIQ` (Core, HEAD 2dba34613). Rules: Core `AGENTS.md`; superseding rules are U1 (no model ladder: a task keeps its starting model; `escalate_model` removed), t976 (permission asked once at start), t981 (repeat-safe repair), t984/P2 (automatic data stage), t989 (collection guidance wording). Model guidance never mirrors a realistic scenario.
Evidence: sweep log `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/b9e846ce-920f-4917-ba85-cff713b3e423/scratchpad/sweep/core-test-clean.txt` (lines 2962-3458 for these); index `.../scratchpad/sweep/fails-index.txt`.

Your failing files (all in the `parallel` group), under `packages/fluxiq/src/`:
- `tests/anthropic-session-panel.test.ts` ("invalid message envelope")
- `runtime/llm/tests/run-call-record.test.ts` (charged reserved vs reported)
- `runtime/llm/node-tools/tests/{dry-run-gate,replay-draft}.test.ts` (new `consequences: []` field in observations)
- `runtime/llm/node-tools/result/tests/answer.test.ts` (`core.set_result_processing` description)
- `runtime/flow-authoring/bootstrap/authoring/tests/record-output-part-defaults.test.ts`, `.../candidate/tests/refusal-locator-corpus.test.ts`, `.../plan/tests/loop-format.test.ts`, `runtime/flow-authoring/draft/amendment/tests/apply.test.ts`
- `framework/automation-service/service/answer-first/attempt/tests/remember-acts.test.ts` (undefined `processingDeclaration`), `.../answer-first/loop-signal/tests/completion-refused-again.test.ts` (pins the removed ladder: U1), `.../answer-first/result-processing/tests/inputs.test.ts` (undefined `process`)
For each: decide whether the product or the test is wrong. Find the commit that changed the behaviour by reading history (`git log -p`, `git show <rev>:<path>`); no checkout or bisect (git mutations are forbidden).

Owned (may edit): the test files above and their own fixtures; product source under `runtime/llm/**` except `evidence-loop/**`, `runtime/flow-authoring/**`, `runtime/models/**`.
Must not touch: any other answer-first source (W1; `result-feed/**` is lane t993), `runtime/llm/evidence-loop/**` and `runtime/adaptation/**` (W2), `packages/contracts/src/record-sets/process/**`, `apps/web/**`. If a cause lies outside your owned paths, do not edit it: report the diagnosis with a proposed diff. Answer First tests' shared support under `answer-first/tests/**` belongs to W1: report a needed change there rather than editing it.

Run tests only like this (from `packages/fluxiq`), named files only, never the whole suite, one heavy job at a time:
`node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t994-w3 -- node ../../scripts/vitest-groups.mjs --groups=parallel <files> --maxWorkers=1 --minWorkers=1 --fileParallelism=false`
No git mutations, no `node -e`, no provider or paid calls, no browsers.

Acceptance: every listed file passes; if you changed source, the tests beside that source pass too and `node scripts/structure-audit.mjs` (Core root) passes.
Report: `C:/Users/osrs_/FluxStuff/fxwork/t994/!FluxIQWebExtension/docs/working/data-first-simplification-plan/reports/t994-sweep-fix-core/w3-parallel.md`: per file: cause, breaking commit, fix or test update (rule cited), files changed, exact commands with observed counts. End with the return contract.
