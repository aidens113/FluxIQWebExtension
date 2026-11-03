# Runtime Ownership Refactor: Reset Plan

Status: Active
Status detail: User authorized execution after salvage audit; Core foundation and defect batches active.
Created: 2026-11-02
Last updated: 2026-11-02
Owner: Senior supervisor
Scope: Downstream side of the paired Core ownership migration, web audit and subsequent shared chat package.
Paired document: ../!FluxIQ/docs/working/runtime-ownership-reset-plan.md
Related: [existing record](runtime-ownership-refactor.md)

## Current State

The user authorized plan execution on 2026-11-02 ("Ok follow the plan") and additionally requested the fastest safe approach. The paired Core plan (`../!FluxIQ/docs/working/runtime-ownership-reset-plan.md`, relative to this repository root) owns active SQL, callback-guard and bounded stall briefs, and the parallel time-reduction investigation.

Authoring pair remains t843. Audit recommendation: retain coherent migrations and review added behavior separately. Existing source WIP is preserved. No paid/browser/panel run is started; normal rebuilt-package integration passed at the first coordinated Core freeze. Complete runtime acceptance and remaining ownership/chat milestones remain required.

## Authoritative Plan

The paired Core reset plan (`../!FluxIQ/docs/working/runtime-ownership-reset-plan.md`, relative to this repository root) owns the shared milestones, lane partition, defect gates and execution contract.

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

### 2026-11-02 - First resumed foundation public-package validation
- Agent: Codex senior supervisor.
- Changed: paired execution status only; downstream product source unchanged. Core owns the SQL and first callback guard batches, with remaining ownership/composed/chat gates open.
- Validation: `pnpm.cmd --filter @fluxiq-web-extension/domain check` -> exit 0/current-Core guard, 35.830s; domain `build` -> exit 0/2,028 emitted outputs, 30.509s.
- Validation: with DOMAIN_TEST_BUILD_LABEL=t843-reset-foundation, selected target-normalization/target-preparation/native-runtime/opaque-target/manifest tests -> 82 passed, zero failed/cancelled/skipped, 11.518s.
- Validation: `pnpm.cmd --filter @fluxiq-web-extension/extension check` -> exit 0; extension `build` -> exit 0, Chrome/Firefox/e2e-Chromium verified 22 files each. Existing placeholder Firefox add-on ID warning remains; no live browser/provider/panel run.
- Outcome: paired public-package checkpoint validated; task backup only, not whole runtime/ownership acceptance. No full sweep consumed; dev/main unchanged.

### 2026-11-02 - Portable paired-document reference correction
- Agent: Codex senior supervisor.
- Validation: `git push origin HEAD` -> stopped by pre-push before upload: two paired Markdown links resolved outside this repository. Replaced the links with the portable sibling path already defined in paired metadata; no product source changed.
- Outcome: documentation gate rerun before retrying the normal task-branch push; Core checkpoint already pushed.
