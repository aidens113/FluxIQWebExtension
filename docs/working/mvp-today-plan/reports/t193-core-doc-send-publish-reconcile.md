# t193 Core send/publish documentation reconciliation

Status: Complete

## Result

Reconciled the three permission sections updated by t188 with t189's retained high-risk consequence set. The Core architecture documentation now consistently names the exact gated classes as `move_money`, `delete`, and `send_or_publish`; states that `create_new` and `modify_existing` remain ungated merely by consequence class; and preserves the instruction-or-explicit-grant authorization contract for the retained high-risk set.

No live behavior claim was added.

## Files changed

- `F:\!FluxIQ\docs\architecture\automation-studio.md`
- `F:\!FluxIQ\docs\architecture\automation-studio\llm-flow-bootstrap.md`
- `F:\!FluxIQ\docs\architecture\package-boundaries.md`
- `docs/working/mvp-today-plan/reports/t193-core-doc-send-publish-reconcile.md`

## Validation

- Targeted searches across the three owned permission sections confirmed the exact three-class set and found no remaining current two-class contract statement in scope.
- `git diff --check` passed for the three Core documentation files.
- Reviewed the scoped documentation diff against the t186, t188, and t189 reports.

## Boundaries

Documentation-only reconciliation. I did not edit source or shared working documents, run builds or tests, start the Lab, use a provider or browser, commit, or push. No live validation is claimed.
