# Repository State Audit

Status: Active
Status detail: Audit complete; three pre-Stage-4 issues and four broader Core/product risks are confirmed, with no source fixes attempted.
Created: 2026-09-13
Last updated: 2026-09-13
Owner: Senior supervisor agent
Scope: Read-only audit of FluxIQWebExtension and FluxIQ Core at their current dev heads, with confirmed findings and prioritized follow-up.
Paired document: `F:\!FluxIQ\docs\working\repository-state-audit.md`
Related: [Week 1 reliability plan](./mvp-week1-web-automation-reliability-plan.md), [working document protocol](./agent-working-doc-protocol.md)

---

## Current State

The audit completed against downstream `f3771ac` and Core `0a2dc53`. Both
trees were clean and aligned with their local `origin/dev` tracking refs at
intake. Only this audit's documents and worker reports changed.

**Confirmed before Stage 4**

- `f-lab-wait-bounds` is absent: the finalization wait remains 30 seconds, its
  safe diagnostic details are dropped, and pairing timeouts retain neither the
  last sanitized extension status nor the pre-/post-approval stage.
- `run-scenario.ts` lets browser or topology cleanup overwrite an earlier
  functional failure with `process.startup`. Under final-bench load this can
  corrupt the classification rate. Preserve the primary failure and append a
  labelled cleanup failure; use cleanup as primary only when nothing failed.
- The final criterion comparison depends on a 49 KB script in a Claude temp
  directory. Promote it to a tracked, tested tool or replace it with an equally
  durable procedure before Phase 1.6b closes.

**Confirmed broader issues and limits**

- Core intentionally withholds caller-marked values only from command
  parameters and result prose. `result.payload`, `target`, `failure`, and
  `metadata` can persist a value an adapter echoes. The web adapter's current
  sensitive type/upload paths sanitize their result, so this is not by itself
  a Stage 4 blocker; it is a Core hardening/design gap.
- Core explicitly documents that a run input copied without a state binding to
  another output key remains in the saved trace. Current replay secrets use
  bound paths, so treat this as a Week 2/4 security case and add an echo/copy
  proof before broadening the at-rest guarantee.
- A default `AutomationStudioService()` with no storage root forgets a project
  immediately and can leave partial `indexes/` and `recordings/` data in the
  process working directory. Production injects storage, but the public default
  is unsafe and non-atomic.
- Core's public `failureRoute` remains ignored. This is a real, already-deferred
  product defect.

**Documentation truth**

- Both Week 1 Current States contain stale Git/working-tree statements.
- The Core worker's claim that node-definition `expectedState` is now retained
  was rejected on supervisor review. The Flow approval path retains it, but
  `recordingCandidateDefinition` / `materializeRecordingNode` still drop it, as
  the Core Current State says.
- Cross-repository links, public exports, and current built declarations are
  coherent. Focused downstream typechecking and both focused test groups pass.

**Next steps**

1. Fix and mutation-test `f-lab-wait-bounds` and cleanup-failure precedence.
2. Make the final comparison procedure durable.
3. Correct both Week 1 Current States in the same work unit.
4. Re-run affected gates, commit and push both `dev` branches as appropriate,
   then begin Stage 4.

**Blockers:** none.

---

## Objective

Find concrete defects, stale claims, integration risks, missing tests, and
validation gaps that could invalidate the current Week 1 state or obstruct its
final campaign. This audit does not authorize implementation fixes.

## Worker Briefs

### Brief: audit-downstream
- Repository: this repository
- Task: Audit downstream source and tests for correctness issues, with emphasis on the queued wait-bounds work and Week 1 Lab paths.
- Required reads: this document's Current State; `AGENTS.md`; the Week 1 plan Current State; `f-lab-wait-bounds`; affected source and colocated tests.
- Owns (may edit): `docs/working/repository-state-audit/reports/audit-downstream.md`
- Must not touch: every other file; Core; run artifacts; runtime state.
- Definition of done: prioritized evidence-backed findings with file:line references; run narrow read-only checks where useful; distinguish defects from unverified risks.
- Report to: `docs/working/repository-state-audit/reports/audit-downstream.md`

### Brief: audit-core
- Repository: FluxIQ Core
- Task: Audit Core's current Week 1 implementation and tests for correctness, persistence, runtime, recovery, and compatibility issues affecting downstream.
- Required reads: Core `AGENTS.md`; paired audit Current State; Core Week 1 Current State; source/tests directly relevant to current open items.
- Owns (may edit): `F:\!FluxIQ\docs\working\repository-state-audit\reports\audit-core.md`
- Must not touch: every other file; downstream; generated/runtime state.
- Definition of done: prioritized evidence-backed findings with file:line references; narrow checks where useful; compatibility impact stated.
- Report to: `F:\!FluxIQ\docs\working\repository-state-audit\reports\audit-core.md`

### Brief: audit-integration
- Repository: both repositories, read-only except the report
- Task: Audit cross-repository contracts, linked-package/build freshness, working-document truth, final-campaign readiness, and validation coverage at both heads.
- Required reads: this Current State; both Week 1 Current States; repository-layout docs; Stage 4 briefs; package manifests and relevant generated-output policy.
- Owns (may edit): `docs/working/repository-state-audit/reports/audit-integration.md`
- Must not touch: every other file; Lab worktrees/runs; runtime state.
- Definition of done: exact mismatches and risks, prioritized by whether they can invalidate Stage 4; no broad source audit duplicated from the other briefs.
- Report to: `docs/working/repository-state-audit/reports/audit-integration.md`

## Work Ledger

### 2026-09-13 — Both repositories audited at the pushed Week 1 heads
- Agent: supervisor with workers `audit-downstream`, `audit-core`, and `audit-integration`
- Changed: paired audit documents and three worker reports only
- Why: Find correctness, integration, validation, and documentation issues before the final campaign.
- Validation: downstream `pnpm check` -> exit 0; `pnpm exec tsc -p packages/test-runner/tsconfig.json --noEmit` and three built test files -> exit 0, 17 tests passed; Core `pnpm check` -> exit 0; Core focused sequential Vitest -> 4 files and 49 tests passed; `pnpm structure:check --rule working-docs` -> passed in both repositories. Both structure audits reported advisory warnings but no violations.
- Outcome: Accepted
- Follow-up: repair the three pre-Stage-4 issues, then run Stage 4.

## Open Questions

- Whether Core should recursively withhold caller-marked values from every persisted result field, or define a smaller persistable result projection.
- Whether storage-less `AutomationStudioService` should be fully in-memory or refuse file-backed operations.
