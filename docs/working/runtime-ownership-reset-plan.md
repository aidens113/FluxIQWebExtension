# Runtime Ownership Refactor: Reset Plan
Status: Active
Status detail: Planning only after the user's explicit stop; no implementation release.
Created: 2026-11-02
Last updated: 2026-11-02
Owner: Senior supervisor
Scope: Downstream side of the paired Core ownership migration, web audit and subsequent shared chat package.
Paired document: ../!FluxIQ/docs/working/runtime-ownership-reset-plan.md
Related: [existing record](runtime-ownership-refactor.md)

## Current State

All workers stopped and all runtime/test/build processes ended. Current authoring pair is t843, not the older IDE t842 checkout.
Latest pushed task backups: Corec0dee9bbe/downstream460a5af6. Dev/main unchanged for this unit. Normal guarded domain tests82/82, domain check/build and extension check/build passed at that checkpoint. That does not establish complete Core runtime acceptance.
Newer Core SQL/descriptor/log scaffolding is local and unvalidated in aggregate. Preserve it. Implementation stays stopped pending plan review.

## Authoritative Plan

The [paired Core reset plan](../../../!FluxIQ/docs/working/runtime-ownership-reset-plan.md) owns the shared milestones, lane partition, defect gates and execution contract.

Downstream required batches:

1. Preserve completed target/recording policy ownership and the original migrated browser-test oracles. Review remaining active browser/DOM/selector/URL interpretation and all consumer imports.
2. Consume each coherent Core public seam through normal rebuilt-package guards; verify focused changed behavior and browser bundle boundaries. Core must never import this repository.
3. Keep extension/browser APIs, DOM access, web adapters and the browser testing facility here. Generic framework capabilities remain Core-owned.
4. After both full ownership audits pass, extract the actual extension chat rendering/data/styles to a reusable Core UI package. Keep approvals, browser routing and extension storage behind adapter ports. Integrate this extension plus a second real client.
5. Require preserved stream updates, activity/results, questions/actions, cancellation, focus/keyboard accessibility and standalone browser-safe consumption. Run required paired gates before dev/main integration.

Known Core runtime defects are named explicitly in the paired plan; no downstream green suite substitutes for those acceptance requirements. No additional feature or broad hardening task may silently join the critical path.

## Work Ledger

### 2026-11-02 - User stopped implementation for a concrete plan
- Agent: senior supervisor.
- Changed: recorded the downstream plan and worker freeze. No source changes during planning.
- Validation: reviewed stop reports and git status only; no tests/builds/providers/browser operations.
- Outcome: planning pending review; earlier rolling estimates do not constitute a delivery commitment.

## Open Questions

Review the paired migration/defect split before any implementation resumes.
