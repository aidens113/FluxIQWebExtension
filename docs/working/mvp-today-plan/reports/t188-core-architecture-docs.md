# t188 -- Core architecture documentation

Status: Complete
Repository scope: `F:\!FluxIQ`, with this report in `F:\!FluxIQWebExtension`
Date: 2026-09-26

## Result

Updated the three assigned Core architecture documents from the t182
documentation-impact audit. No Core source, downstream source, shared working
document, generated output, or other architecture document was changed.

## Files and reconciled contracts

- `docs/architecture/automation-studio.md`
  - documents the default provider retry seam, three-attempt ceiling, typed
    retryability, grant-use accounting, `providerRetryCount` bounds, and the
    distinction between the persisted zero-retry Flow setting and execution
    grant retries;
  - removes task-kind authorization from grant purpose while retaining purpose
    for issuance, entry-point compatibility, accounting, and audit;
  - documents screened flow shape, withheld-parameter signals, and the
    structured `automation-studio.result-repair-directive.v1` path into
    recovery without persisting arbitrary provider prose;
  - documents the default defensive node-dispatch seam, throw and legacy
    failure classification, defence ledger, bounded waits and hints,
    side-effect-aware retry safety, and policy-authorized non-fatal
    continuation;
  - records the currently exported destructive set as `move_money` and
    `delete`, while all five consequence classes remain recorded and
    cross-checked.
- `docs/architecture/automation-studio/llm-flow-bootstrap.md`
  - aligns authoring permission prompting with the two-class destructive set;
  - states that only an uncovered destructive subset creates a permission
    request and preserves the existing parked-question/apply-refusal lifecycle.
- `docs/architecture/package-boundaries.md`
  - adds 0.6.0 compatibility notes for provider retry/grant accounting,
    purpose semantics, screened verification and repair directives, defensive
    execution, and the narrowed destructive export.

## Validation

- `git -c core.safecrlf=false diff --check --` on all three owned Core
  architecture documents: passed.
- Targeted searches confirmed the stale purpose-to-task authorization and
  hidden/no-provider-retry wording is absent from the owned documents.
- Reviewed the complete scoped diff against the t182 requirements and the
  targeted Core contracts used to verify the wording.

Documentation-only task: no test, build, Lab, live provider/browser run,
commit, or push was performed. No live-provider success is claimed.
