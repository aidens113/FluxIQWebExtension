# P3: broad collection and automatic processing guidance

Status: Prepared; task branch and implementation not started.
Owner: Lead until reassigned; no worker is dispatched by this brief.
Context: paired data-first plan Current State; P1 retained-schema contract and P2 automatic declaration/readiness.
Goal: collection guidance agrees with actual automatic processing and one exploration returning the final result.

## Source ownership proposed
- Core `packages/fluxiq/src/runtime/answer-first/guidance/{guidance.ts,tests/}`.
- Core `packages/fluxiq/src/runtime/llm/evidence-loop-decision.ts` prose only, and owning provider-task/system-prompt tests and generated pins.
- Core `packages/fluxiq/src/runtime/flow-authoring/bootstrap/authoring/draft-routing.ts` diagnostic prose only and owning tests, if its obsolete extraction advice is reached by automatic tasks.
- Downstream `domain/src/runtime/llm-evidence/system-instructions/{instructions.ts,tests/}`.
- Downstream `domain/src/output-nodes/extract-list/catalog-text.ts`, its owning tests and `domain/src/output-nodes/tests/definitions.test.ts` still describe manual filtering/field selection; align the actual offered tool grammar too.
- Core `runtime/flow-authoring/bootstrap/plan/{flow-script-format,record-output-contract}.ts` prose and owning tests need the same check. P2 currently owns record-output-contract for dynamic input binding: wait for serial handoff, never overlap edits.
- Must not touch P2 interpretation prompt, result tool, shared service/attempt files, P6 projection, or historical recording replies.
- P2 worker confirmed no ownership overlap with these proposed paths on 2026-11-22.

## Findings and required behavior
- General evidence guidance still presents optional `core.set_result_processing` as the route to filtering and directs a data predicate into the read's `where`.
- Answer-first guidance already requires all requested rows/pages in the initial live pass and explicitly overrides Flow-only guidance. Preserve that priority.
- Web Lists guidance still says not to read every page during exploration; clarify that a generalized paging loop must actually run forward during the same task to obtain all required rows.
- Keep all safe source fields, including condition/identity/mark/date fields, rather than limiting capture to requested output columns. Explicit exclusions remain authoritative.
- Collect candidates broadly; automatic deterministic processing applies the declared criteria, deduplication, ordering and output projection. Missing fields need real source evidence, not weaker conditions or invented values.
- Do not instruct an unnecessary second processing tool call for every read; deliberate amendments remain explicit and evidence based.
- Action-target selection stays narrow before any mutation: a broad dataset is never permission to act on every collected row.
- A site filter can reduce necessary reading or establish a condition not exposed per row; do not infer compound conditions from unrelated filter labels.
- Do not introduce scenario names, benchmark answers, provider/model ladders, artificial caps, new stop conditions, or raw capture persistence.
- Preserve legacy/nonautomatic semantics in shared prose where that path remains supported; do not promise automatic behavior without a supported declaration/readiness path.

## Acceptance
- Review final emitted prompts for answer-first, legacy builder and patch roles; no contradictory collection/completion instructions.
- Owning guidance/composition tests prove automatic collection, narrow action selection, real-result completion and no Lab-specific advice.
- Regenerate only intended prompt pins using the owning mechanism; never edit historical recorded model replies.
- Narrow Core/Down types and structure audit, plus affected prompt tests; no full sweep.
- Record changed prompt versions, exact commands/results and remaining offline/live evidence. Prompt change requires the approved supervised smoke after provider-free proof, within the existing total allowance; no launch by this brief.

Report: `docs/working/data-first-simplification-plan/reports/p3-collection-guidance.md` in its eventual task tree.
