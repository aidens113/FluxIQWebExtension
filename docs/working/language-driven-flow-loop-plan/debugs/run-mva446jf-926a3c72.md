# Debug: run-mva446jf-926a3c72

- Instance: a8-slot-4, task `bigbox-retail-pickup-towels`, authoring mode `candidate` (A8 wave 22, 2026-10-15, frozen pair 4, downstream `9c1e164d` / Core `0df06e34`, round 1), lane tree `fxwork/t567`.
  Steps: 51.
- Verdict: **failed** (`lab.chat_build_failed`): no Flow saved; $0.036 of $0.25.
- Cause (general, two Core defects that stack): (1) Core t641's `candidate.kept_condition_dropped` refusal invites the
  same change sent again, but the generic repeat guard records the refused submission as failed on the standing
  revision and refused the invited resend unrun three times (steps 0046-0050), ending the build; (2) the condition
  Core held, `retailer startsWith "ValueRidge"`, tests the product's own name, and the request-words test counted its
  left-out rows as failing the request's words, so Core overruled correct judges and t641 vindicated it (7 of its 8
  kept-out rows are in the oracle). Full chain: `docs/working/automation-project-agents-plan/reports/a8-towels-run-mva446jf-debug.md`.
- Fixes: t650 (an invited resend is admitted once by the repeat guard), t651 (a row's own label is never the request's
  words).
