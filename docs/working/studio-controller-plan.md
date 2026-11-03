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

**Downstream work**

1. t845: the move tool rewrites paths named here, such as `apps/extension/scripts/tests/browser-entries.test.mjs`. About 1,500 `fluxiq/automation-studio` imports are then retargeted to the framework's public entry points.
2. t847: port t843's target and recording ownership to this repository without the admission system, and move page-text extraction out of Core's step log.
3. t846: the extension renders chat from the shared package. Approvals, routing and extension storage stay here behind adapters.

**Blockers:** none.

## Work Ledger

### 2026-11-02 - Task opened

- Agent: lead.
- Changed: this document. t841's uncommitted worker reports saved and pushed as WIP on their own branch.
- Validation: `git status` on the t841 pair -> clean after the save. No downstream product source changed.
- Outcome: downstream changes follow each Core step.

## Open Questions

None requiring the user.
