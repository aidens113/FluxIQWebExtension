# Repository State Audit

Status: Active
Status detail: The three pre-Stage-4 issues are remediated and independently verified; broader Core/product risks remain deferred as recorded below.
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

**Remediated before Stage 4**

- The recording finalization bound is now 90 seconds, based on the observed
  25.789-second healthy maximum and the measured two-bench load multiplier.
  Finalization and pairing failures publish only bounded, selected diagnostic
  facts, including the pairing stage and last sanitized status.
- Browser, topology, clone-source verification, and clone-destination cleanup
  now preserve the first scenario failure and append labelled secondary events.
- `lab compare` now owns the tracked six-criterion closeout comparison. It
  fails closed on incomplete report identity, repeats, or comparable metrics,
  and keeps the Flow-only and unarmed populations distinct.

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

- Both Week 1 Current States now distinguish historical pushed pins from this
  remediation work unit and name the actual Stage 4 dependency order.
- The Core worker's claim that node-definition `expectedState` is now retained
  was rejected on supervisor review. The Flow approval path retains it, but
  `recordingCandidateDefinition` / `materializeRecordingNode` still drop it, as
  the Core Current State says.
- Cross-repository links, public exports, and current built declarations are
  coherent. Focused downstream typechecking and both focused test groups pass.

**Verification complete**

- Supervisor review found five acceptance defects in the first integration;
  all five were repaired and re-reviewed with no unresolved acceptance defect.
- The focused restored suite passed 54 tests. Eight targeted source mutations
  each made the intended guard fail and each source file was restored exactly.
- The downstream root `pnpm check`, `pnpm test`, and `pnpm build` gates pass.
  Stage 4 live evidence has not yet run and is not claimed here.

**Next steps**

1. Commit and push the coherent paired `dev` work unit.
2. Run `l-final-proofs` alone at those pushed pins.
3. If the proofs pass, run both complete repeat-three benches at the same pins.
4. Run the tracked comparison and finish the Week 1 ranking and ledger.

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

### 2026-09-13 — The three pre-Stage-4 audit findings are remediated
- Agent: supervisor with workers `r-wait-and-cleanup`, `r-bench-comparison`, `r-week1-doc-truth`, and `r-integration-review`
- Changed: bounded finalization/pairing diagnostics, first-failure precedence, tracked closeout comparison, architecture guidance, paired Current States, briefs, and worker reports
- Why: Make the final campaign load-tolerant, diagnostically honest, and reproducible without temporary scripts.
- Validation: focused restored suite 54/54; eight mutation proofs failed their intended guards and restored source hashes exactly; downstream `pnpm check`, `pnpm test`, and `pnpm build` each exited 0, including 611 test-runner tests; integration review found no unresolved acceptance defect.
- Outcome: Accepted
- Follow-up: push the paired work unit, then obtain the Stage 4 live proofs and benches; no Lab result is claimed by this entry.

## Open Questions

- Whether Core should recursively withhold caller-marked values from every persisted result field, or define a smaller persistable result projection.
- Whether storage-less `AutomationStudioService` should be fully in-memory or refuse file-backed operations.
