# Report: t752 judge consistency and read speed (lane lead)

Trees (both on `task/t752-judge-consistency-and-read-speed`): Core `C:/Users/osrs_/FluxStuff/fxwork/t752/!FluxIQ`,
downstream `C:/Users/osrs_/FluxStuff/fxwork/t752/!FluxIQWebExtension`. No commits, merges or pushes.
Evidence: round-5 social debug note `docs/working/language-driven-flow-loop-plan/debugs/run-mvhibis1-d570b37d.md`,
the run's judge steps 0056-0058 (trial 1) and 0065-0066 (trial 2) read for the design only; no page data is copied
here or into any test.

## Units and owners

| Unit | Owner | Files (partition) | Status |
| --- | --- | --- | --- |
| A closest trial | worker | Core `project-agents/contracts/builder-return.ts`, `project-agents/dispatch/receipts.ts` (+ tests) | dispatched |
| B working rows | worker-high | Core `result-verification/request-rows/**` | dispatched |
| C read discloses kept rows | worker-high | extension `content/extraction/{list-reader,field-reader}.ts`, `text-disclosure/**`, `item-record/**`; domain `actions/extraction/**`, `output-nodes/extract-list/**`, `rejection-next/next-sentence.ts` | dispatched |
| D structure detection | worker | extension `content/extraction/{detect-structure,infer-list,infer-fields}.ts`; domain `extraction/structure-detection.ts` | dispatched |
| J judge consistency | worker-high (after map) | Core `result-verification/{agreement,refuted-no,verdict,build-test}/**`, `llm/diagnosis-instructions.ts`, gates | designing |
| R headed reproduction | worker | extension `e2e/judge-consistency/**` (new), `e2e/site-reset/scripted-provider.ts` (judge hook) | after J/C |

## Concurrency checks

- 2026-10-20: `git status --short` in t751 (both repos) and t753 (both repos): clean. t749 Core touches
  `project-agents/dispatch/index.ts`, `project-agents/single-subflow/**`, `service/project-build/whole-trials.ts`,
  trace-matcher, offline-trial; t749 downstream touches `apps/extension/e2e/content/tests/extraction/tests/social-read-completion.spec.ts`,
  `runtime/action-runner.ts`, `runtime/result-mapping.ts`, `domain/src/runtime/llm-evidence/plan-resolution/extraction/index.ts`.
  None of those are in this lane's partition; `social-read-completion.spec.ts` is not to be edited here.

## Progress log

- 2026-10-20: lane started; read the brief, Current State, shared rules, the debug note and the trial judge steps.
