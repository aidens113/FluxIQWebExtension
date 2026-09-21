# Optional Multi-Action Exploration Reconciliation

Status: Active
Status detail: Slices 1-4 pass focused checks behind production default one; the same-code live baseline/variant comparison is active before integration.
Created: 2026-09-20
Last updated: 2026-09-20
Owner: Senior supervisor agent
Scope: Reconcile optional ordered multi-action exploration with current evidence, permission, field-entry, and target-stability contracts, then prove it live against a same-code single-action baseline before integration.
Paired document: `F:\fxwork\t033\!FluxIQ\docs\working\multi-action-exploration-reconcile.md`
Related: [Week 2 automation loop](./mvp-week2-automation-loop-plan.md), [t021 live report](./mvp-week2-automation-loop-plan/reports/w2-batched-actions.md), [open branch audit](./mvp-week2-automation-loop-plan/reports/w2-open-branch-live-audit.md)

---

## Current State

Task t021 proved that the model can emit batch-shaped exploration decisions,
but none completed more than its first action. Calls increased from 15 to 27
and no Flow was created. That Core prototype is now far behind `dev`, uncommitted,
and must not be merged. Since then, downstream field entry and truthful
`targetsUnchanged` evidence have landed, and the permission path has gained
closed consequences and explicit request semantics.

Task t033 is a fresh paired worktree from current `dev`. The reconciliation map
is complete and rejects every mechanical t021 port except the generic concept
of a strict singleton-or-ordered-list decision. Current permission observation,
eligible tools, evidence windows, state recording, target stability, usage,
and diagnostics must remain authoritative.

**Done:** fresh paired current-dev task created; all 21 prototype files mapped
to port/drop/rewrite; slices 1-4 now wire the strict list contract, provider
authentication, atomic whole-list preflight, shared action transition,
permission/evidence visibility, ordered state records, bounded diagnostics,
derived action limits, and an explicit Lab-only run-scoped 1/16 control.
Production/UI callers omit the option and remain default one. The final slice
passed 130 focused Core tests, 58 focused downstream tests, and affected
checks/builds.

**Next:** run one same-code live baseline (`1`) and variant (`16`) from fresh
isolated state, require both to create and execute valid persisted Flows, and
require the variant to complete at least two ordered actions in one provider
decision with exact trace/accounting/state evidence. Do not change the
production default from one based only on receiving a list.

**Blockers:** none for the bounded live A/B. Integration and any production
opt-in remain blocked until every conjunctive live oracle passes.

---

## Worker Briefs

### Brief: w2-multi-action-current-map
- Repository: paired t033 worktrees read-only; stale t021 downstream/Core worktrees read-only as source material.
- Task: map the t021 optional one-or-many prototype onto current `dev`, separating still-needed generic Core behavior from downstream web evidence/action behavior and identifying every stale/superseded hunk.
- Required reads: this Current State; `mvp-week2-automation-loop-plan/reports/w2-batched-actions.md`; `w2-open-branch-live-audit.md` t021 row; t026 field-entry/target-stability report; old t021 diff; current direct counterparts only.
- Owns: `docs/working/multi-action-exploration-reconcile/reports/w2-multi-action-current-map.md` only.
- Must not touch: any source/test, either shared working document, t021 state, user data/port 3000, provider credentials/calls, git history.
- Definition of done: file-by-file port/drop/rewrite table; current contracts for ordered evidence, state transitions, `targetsUnchanged`, and per-action permission/refusal; collision risks; smallest implementation slices; exact same-code live baseline/variant oracle and provider budget.
- Report to: `docs/working/multi-action-exploration-reconcile/reports/w2-multi-action-current-map.md`

### Brief: w2-multi-action-contract-slice
- Repository: paired t033 worktrees; product edits in Core only, report downstream.
- Task: implement slice 1 from `w2-multi-action-current-map.md`: strict canonical `tool_calls` decision surface and explicit effective max-actions-per-decision defaulting to one, with no executor behavior change.
- Required reads: this Current State; the current-map report sections `File-by-file disposition`, `Collision and regression risks`, and slice 1; current direct counterparts named there.
- Owns Core: `runtime/llm/evidence-batch/` new files; `runtime/llm/harness/{provider-result,structured-response,output-validation}.ts`; `runtime/llm/index.ts`; `runtime/loop-limits/evidence-loop.ts`; their nearest focused tests only. Owns downstream report only.
- Must not touch: evidence executor/loop behavior, `service.ts`, permission gate, state recorder, downstream product source, t021, user data/port 3000, provider/browser APIs, shared `dev`, or other reports.
- Required contract: lists are 2-16; each item uses the same tool-specific closed input schema; unknown/ineligible/invalid later items reject the whole decision before execution; max=1 omits list schema and rejects list responses; metadata summaries expose kind/count/tool IDs only, never inputs.
- Definition of done: focused schema/parser/validation tests pass; current singleton fixtures remain byte-for-byte behaviorally valid; no production path can execute a list yet; diff and report identify the exact seam for slice 2.
- Report to: `docs/working/multi-action-exploration-reconcile/reports/w2-multi-action-contract-slice.md`

### Brief: w2-multi-action-transition-slice
- Repository: paired t033 worktrees; Core product/tests only, downstream unique report only.
- Task: implement slice 2: one feature-control value wires decision schema, DeepSeek schema authentication, provider parsing, and singleton/list execution through one shared current action transition; default remains one.
- Required reads: Current State; contract-slice report `Exact slice-2 seam`; current-map `Ordered actions, evidence, and state`, `Collision and regression risks`, and slice 2; current direct evidence-loop/provider/harness owners.
- Owns Core: `runtime/llm/evidence-loop.ts`; `runtime/llm/evidence-batch/`; `runtime/llm/harness/{run,task-request,provider-result,output-validation}.ts` only as needed; `runtime/llm/deepseek-provider.ts`; loop-limit wiring; nearest focused tests. Downstream owns report only.
- Must not touch: `service.ts`, permission gate, recovery/state recorder/reduction, Flow Bootstrap caller opt-in, downstream product source, t021, provider/browser/user state, shared `dev`, git history.
- Atomic preflight: validate the whole list against this iteration's exact eligible tools, tool-specific inputs, repeat constraints, action/evidence budgets, and list bound before action 1; invalid later item executes none.
- Ordered execution: Core assigns unique call IDs; every item uses the same shared singleton transition/accounting; provider usage applies once; stop on refusal/failure, any non-applied mutation, or missing/false `targetsUnchanged`; observations may continue.
- Feature gate: default one emits/accepts/executes no list and preserves current singleton behavior; only explicit test-level >1 exposes all gates together; no production caller may opt in in this slice.
- Definition of done: focused tests prove default regression, atomic rejection, ordering, unique IDs, one usage, budgets/repeat, target-stability stops, and no production opt-in; package check/build after focused pass; no live/provider call.
- Report to: `docs/working/multi-action-exploration-reconcile/reports/w2-multi-action-transition-slice.md`

### Brief: w2-multi-action-permission-state-slice
- Repository: paired t033 worktrees; Core product/tests only, downstream unique report only.
- Task: implement slice 3: make model-visible evidence explicit, preserve per-action permission termination, and prove ordered recovery state records/reduction for same-iteration actions; production remains default-one.
- Required reads: Current State; current-map sections `Ordered actions, evidence, and state`, `Per-action permissions and refusals`, risks, and slice 3; transition-slice report; current Flow Bootstrap permission wrapper, recovery runtime exploration/recorder/reduction, and evidence-loop publication seam.
- Owns Core: `runtime/llm/evidence-loop.ts` and `evidence-batch/` only where the visibility callback belongs; `runtime/flow-bootstrap/action-permissions.ts`; `runtime/recovery/{runtime-exploration,exploration-state/**}` only as required; their nearest focused tests. Owns downstream report only.
- Must not touch: `service.ts` diagnostics/trace sanitation, Flow Bootstrap limit derivation/caller opt-in, downstream product source, t021, provider/browser/user state, port 3000, shared `dev`, or git history.
- Visibility contract: permission-gate observation occurs only at the exact boundary that publishes evidence to the next model decision. Intermediate batch evidence not present in `core.batch_result` is never treated as model-shown; pre-batch shown evidence remains available to every item.
- Permission contract: every action still invokes the existing wrapper with its own `{kind:"exploration_step", id:toolId, ref:callId}`; the first permission request/refusal is recorded for that action, terminates the run categorically, and executes no later action.
- State contract: the existing recorder wraps every executed item; two actions sharing one provider iteration retain ordered before/action/after digests, distinct call IDs, and deterministic reduction. Do not collapse the list into one state record.
- Definition of done: focused authoring and recovery tests cover hidden-evidence non-leakage, terminal permission after an earlier success, no later side effects, two same-iteration ordered state records and intact reduction; default-one behavior unchanged; Core check/build after focused pass; no production opt-in or live/provider call.
- Report to: `docs/working/multi-action-exploration-reconcile/reports/w2-multi-action-permission-state-slice.md`

### Brief: w2-multi-action-diagnostics-callers-slice
- Repository: paired t033 worktrees; Core product/tests and the minimum downstream Lab/test-runner control needed for same-code live A/B; downstream unique report.
- Task: implement slice 4: bounded diagnostics/trace sanitation, Flow Bootstrap action-limit derivation, and one explicit run-scoped caller control that defaults to one and can select up to sixteen for the later live comparison.
- Required reads: Current State; current-map sections slice 4, collision risks, and live experiment; transition and permission-state reports; current service trace sanitizer, generation-failure diagnostics, Flow Bootstrap evidence-loop limits/caller, and downstream creation-run configuration owner.
- Owns Core: `runtime/service.ts` only at the evidence-loop caller/sanitizer seam; `runtime/flow-bootstrap/{generation-failure,tests/**}`; `runtime/loop-limits/{flow-bootstrap-evidence-loop,tests/**}`; `api/contracts/adaptation.ts` and `api/handlers/llm-generation.ts` only to accept/forward the same bounded run-scoped value; nearest service/API tests. Owns downstream: only the narrow test-runner/Lab run-scoped option and focused tests if required; unique report.
- Must not touch: permission gate/state recorder/reducer semantics already accepted; concrete web tools/executors; UI settings; t021; user state/port 3000; provider/browser calls; shared `dev`; git history.
- Diagnostics: bound action trace rows independently of provider decisions; preserve sanitized `effectApplied`, `resultCode`, and bounded batch position/size/stop; provider-call counts use unique positive iterations/accounting, usage is counted once, and raw inputs/evidence never enter diagnostics.
- Limits: derive total action allowance from effective `maxActionsPerDecision`, capped by existing 64-action ceiling, without increasing provider-call/token/cost ceilings. Absent/default one must preserve current production bytes/behavior.
- Caller: one internal/run-scoped value controls the already-implemented schema/parser/executor path; ordinary production requests omit it/default to one. The Lab can explicitly choose 1 or 16 for otherwise identical arms without changing UI/global state.
- Definition of done: focused tests pin singleton compatibility, enabled derived limits, trace/count sanitation, usage once, and explicit run-scoped 1/16 plumbing; Core check/build and affected downstream check/build pass; no production default change, provider call, or live run.
- Report to: `docs/working/multi-action-exploration-reconcile/reports/w2-multi-action-diagnostics-callers-slice.md`

### Brief: w2-multi-action-live-ab
- Repository: paired t033 worktrees plus two fresh isolated Lab roots/profiles on non-3000 ports; candidate product source is read-only unless a categorical live defect is proven.
- Task: run the exact same-code production-panel/unpacked-extension baseline (`--llm-max-actions-per-decision 1`) then variant (`16`) against social-scheduler, each from fresh state, and evaluate every conjunctive acceptance oracle.
- Required reads: Current State; current-map `Exact same-code live baseline/variant`; diagnostics/callers report; current Lab CLI help/creation command only.
- Owns: ignored run artifacts/profiles and `docs/working/multi-action-exploration-reconcile/reports/w2-multi-action-live-ab.md`; one smallest directly owning fix only after a preserved categorical failure, with no blind retry.
- Must not touch: manual panel/user store/ports 3000+4711, global/UI defaults, raw credentials/page evidence/field values in output, t021/t027, shared `dev`, git history.
- Equality/budget: identical built hashes, fixture/seed/start URL/instruction/settings/provider/browser; only 1 vs 16 differs. Per arm: 26 calls, 560k run tokens, $1 total, zero retries, one attempt; stop before provider use if resolved grants differ.
- Acceptance: both persist plan-valid Flows and execute them through the production extension against the same deterministic oracle; baseline executes no list; variant completes >=2 ordered actions in one decision; call/action/usage/trace/state/permission/stability accounting is exact and bounded; no unintended consequence or auto-apply.
- Definition of done: sanitized report with measurements and exact pass/fail per oracle; focused checks only after a live pass or smallest live-proven fix; no broad suite.
- Report to: `docs/working/multi-action-exploration-reconcile/reports/w2-multi-action-live-ab.md`

---

## Work Ledger

### 2026-09-20 — Current-dev reconciliation started
- Agent: supervisor
- Changed: paired task/document and read-only worker brief.
- Why: the old branch demonstrated model output shape but failed the user-visible outcome and is unsafe to merge as-is.
- Validation: `pnpm task start multi-action-reconcile --worktree --core` -> fresh paired branches built successfully from current dev.
- Outcome: Partial
- Follow-up: file-level reconciliation report.

---

## Open Questions

- Which t021 changes remain necessary after current field-entry, state-digest, consequence, and target-stability work? Owner: `w2-multi-action-current-map`.
