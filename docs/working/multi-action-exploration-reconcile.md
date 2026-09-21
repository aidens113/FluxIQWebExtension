# Optional Multi-Action Exploration Reconciliation

Status: Active
Status detail: The stale t021 one-or-many exploration prototype is being mapped onto current Core/downstream contracts before any implementation or provider rerun.
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

Task t033 is a fresh paired worktree from current `dev`. The first phase is
read-only: map each still-useful t021 change onto its current owner, identify
superseded code, preserve per-action permission checks, and define the exact
state/evidence window between ordered actions. No provider call or code port is
authorized until that map is reviewed.

**Done:** fresh paired current-dev task created; old live failure and branch
disposition recorded.

**Next:** produce a file-level reconciliation map and a narrow live comparison
design: same instruction and code, batching disabled then enabled, with at
least one batch completing two ordered actions and both Flows/oracles passing.

**Blockers:** provider execution waits until one of the two current provider
lanes closes; source reconciliation is not blocked.

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
