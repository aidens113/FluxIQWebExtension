# Debug: run-mv8id5vg-ed7b89fe

- Instance: a8-slot-4, task `everything-store-plus-earbuds-under-50`, authoring mode `project` (A8 round one, launch 8,
  2026-10-14, pair downstream `24dacba5` / Core `9b4c5a38`), lane tree `fxwork/t567`. Full analysis:
  `automation-project-agents-plan/reports/a8-everything-store-run-mv8id5vg-debug.md`.
- Verdict: failed, no Flow, $0.130 billed, 179 steps; stopped at 25 minutes by the project build bound (t592).
- What happened: the builder stored the oracle's exact 13 rows 3.5 minutes in; 12 later trials stored the same rows and
  all 48 judge calls on them answered yes, yet Core held every yes as unsure, so each trial came back `not_judged`; the
  builder rewrote a correct subflow seven times; the repair could not end honestly; the person was told the supervisor
  could not finish.
- Cause (product defect, Core, both modes): the quote-every-left-out-row rule (t515) is settled by Core only for numeric
  bounds (`result-verification/value-readings/settled-rows.ts:49,60-66`), so rows left out by presence and attribute
  conditions must each be named beside a quote, and Core accepts a row as named only by a long unique label prefix
  (`row-naming.ts`), which these labels without ids make 10-12 words; no run of this task in either mode has passed since
  t515. Also: "not judged" feedback tells a builder to change its subflow though the judges agreed; a builder's honest
  ending is refused when it carries its receipt (`builder-loop.ts:230` vs `:256`); no chat words for the build time limit.
- Fix: two Core tasks after round two (judge side; builder side).
