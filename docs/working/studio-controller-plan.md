# Automation Studio As A Controller Of Core

Status: Active
Status detail: Downstream side of the Core plan. Consumers follow the backend moves on t845; chat package on t846 and web boundary on t847.
Created: 2026-11-02
Last updated: 2026-11-02
Owner: Senior supervisor
Scope: Downstream consumers of the Studio moves, web semantics that belong in this repository, and the extension's move onto the shared chat package.
Paired document: ../!FluxIQ/docs/working/studio-controller-plan.md
Related: [repository layout](../architecture/repository-layout.md)

## Current State

The paired Core plan (`../!FluxIQ/docs/working/studio-controller-plan.md`, relative to this repository root) owns the goals, the lanes, the measurements behind the restart and the branch audit. It replaces the t843 reset plan.

**Downstream work is done** and merged into `task/t845-studio-controller`: t845's imports retargeted to the public entries, t847's web semantics behind hooks on the implementation bundle, and t846's extension chat from `@fluxiq/ui-components`. Approvals, routing and extension storage stay here behind adapters.

**Live:** both tasks pass from the extension chat: `run-mw0jgf2o-478d13da` and `run-mw0l0e9y-a7d8ae51`. The Core plan's ledger has the full record, and `language-driven-flow-loop-plan/debugs/` the notes.

**Next:** the final sweep, then merge after Core's paired task, as the Core plan says.

**Blockers:** none.

## Work Ledger

### 2026-11-02 - Task opened

- Agent: lead.
- Changed: this document. t841's uncommitted worker reports saved and pushed as WIP on their own branch.
- Validation: `git status` on the t841 pair -> clean after the save. No downstream product source changed.
- Outcome: downstream changes follow each Core step.

## Open Questions

None requiring the user.
