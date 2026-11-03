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

The user authorized a read-only salvage-versus-restart audit on 2026-11-02. The [Core audit](../../../!FluxIQ/docs/working/runtime-ownership-reset-plan.md#restart-audit) recommends retaining coherent migrations and reviewing added behavior separately; no source reset, restoration or implementation was performed. Audit reports are under Core's `runtime-ownership-reset-plan/reports/`.

Today's downstream dev (`d6e5448c`) already includes t842. Its first parent (`c9056f1a`) is the immediate pre-t842 baseline. Resetting to dev would discard t843 only. Lead source comparisons verified nineteen moved normalization function bodies against their original Core dev implementation; hook registration and completion-policy behavior still require paired runtime acceptance. Core's read-only structure audit exposed unfinished SQL source gates; this audit does not certify the current paired runtime.

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

### 2026-11-02 - User-authorized salvage audit
- Agent: Codex senior supervisor, with three read-only audit workers.
- Changed: paired reset-plan documentation; source untouched.
- Validation: `git status --short` -> downstream clean before audit documentation; `git merge-base dev HEAD` -> `d6e5448c`; `git diff --shortstat dev...HEAD` -> 105 files, 2,845 insertions and 174 deletions including tests/docs. TypeScript comparisons -> nineteen normalization function bodies preserved after whitespace/public-name normalization.
- Outcome: retain downstream normalization/preparation and tests; review paired hook/override/completion behavior separately. No tests/builds/browser/provider runs, reset or source restoration performed.

## Open Questions

Review the paired migration/defect split before any implementation resumes.
