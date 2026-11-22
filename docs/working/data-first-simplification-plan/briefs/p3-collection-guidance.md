# P3 / t989: collection guidance
Role: lead-owned implementation while all three workers own active acceptance lanes.
Goal: align collection instructions with retained source fields and declared automatic processing.
Owned Core: answer-first/guidance/guidance.ts and tests; llm/evidence-loop-decision.ts prose and owning prompt tests/pins; flow-authoring/bootstrap/plan/flow-script-format.ts prose and tests; bootstrap/authoring/draft-routing.ts diagnostic prose and tests.
Owned Down: domain runtime/llm-evidence/system-instructions/instructions.ts and tests; output-nodes/extract-list/catalog-text.ts and owning/definitions tests; authored architecture guidance.
Must not touch: P2 processing/interpreter/validation, P6 semantic recovery, historical recorded replies, model/provider routing, budgets or completion endings.
Context: plan Current State; existing prepared P3 findings; P1 retained extraction accepted; P2 dynamic-binding owner released prose only.
Behavior: retain all safe original fields; exclusions stay authoritative; collect candidates and required pages during the task; automatic declared processing filters/dedupes/orders/projects results; missing data requires actual source evidence.
Keep action selection narrow before mutation. Preserve legacy build-only semantics where supported. No unconditional promise of automatic processing without its declaration.
Do not require a redundant set_result_processing call per read; evidence-based amendments remain available.
Checks: affected prompt/catalog/composition owners; exact package types; structure audits; regenerate intended pins using owning generator.
No full sweep or paid/browser run by this brief; supervised prompt smoke follows provider-free proof under the existing approval.
Report: docs/working/data-first-simplification-plan/reports/p3-collection-guidance.md
