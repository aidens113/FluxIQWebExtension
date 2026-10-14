# Debug: run-mv85vjqo-4c022aec

- Instance: a8-slot-2, task `bigbox-retail-pickup-cart`, authoring mode `project` (A8 round one, launch 6,
  2026-10-14, pair downstream `6fbf6b6f` / Core `2db229e9`), lane tree `fxwork/t565`. Full analysis:
  `automation-project-agents-plan/reports/a8-bigbox-run-mv85vjqo-debug.md`.
- Verdict: failed, no Flow, $0.031 billed, 109 steps.
- What happened: `switch_store` and `add_napkins` came back done with passing trials (four judge calls, all right);
  `add_paper_towels` twice ended `evidence_repeat_without_progress`; two repair briefs and one more were refused; after
  `amend_plan` three dispatches were refused `project.predecessor_not_done`; the build ended on the refusal-run guard
  with the store switch left on the site.
- Cause (product defects): a builder opening on its prepared entry (t580) with a look is not "arrived" for the web
  domain, so its typed search was refused `not_at_start_location`; after it navigated, the repeat guard refused the
  now-valid search as a repeat; returns carried no cause or receipt refs; `amend_plan` dropped an unchanged subflow's
  passing proposal; a JSON key named `code` was refused as executable code; no honest ending or reset on a stall.
- Fix: Core t585 (prepared entry counts as arrival, with the domain), t586 (honest ending on a stall), t587 (repeat
  lifted after the precondition is met; the `code` false positive), t588 (returns name the cause and carry receipt refs;
  amend keeps unchanged proposals).
