# Debug: run-mwa19obz-abd5d558

Status: Passed, with a cost defect. Both attempts right, but attempt 2 cost 3.6 times attempt 1 ($1.91, 39 calls, 797 s, against $0.52, 13 calls, 158 s): the saved Flow did not carry the second attempt, the opposite of what saving it is for. Being traced (report `mvp-seal-plan/reports/live-checks-r3/hubs-attempt-2.md`).
Source: t885, Core 72829676a (dev + 1657dadda), Extension 843bb9aa3, unchanged since run-mwa0t77i-8277ba59.
Task: crossborder-marketplace-free-hubs-under-ten, unchanged, `--attempts 2`, visible browser. First answer-first run of a crossborder task.
Provider: Anthropic claude-sonnet-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Instance t885-live, slot-1.

## Result and distance reached

- **Attempt 1, right:** `achieved`, 10 rows stored and shown, 12 live steps, 13 calls, 67% cache, $0.5240, 158 s. The Lab played the person at a traffic screen (person_only_check, cleared) once. Judge 0027 yes.
- **Attempt 2, right but expensive:** path `run_flow_then_explore`, digest proven, no site change.
  1. The saved Flow's run stopped at step 9: `builtin.control.repeat` `repeat.no_progress` (0029). The Lab played the person at the traffic screen again.
  2. Judge 0032 unsure: rows ascending 2,89-9,87 €, but the view it was shown was page 3 of 45 (from 21,74 €), so it could not see pages 1-2 or each row's shipping and ad marker.
  3. The model reran the Flow (0034, 0044, 0053, 0064, 0082, 0091, 0102); the stored rows came back out of order (9,87, 8,99, 2,89, 5,42, ...), and judges 0051, 0069, 0075, 0078 said no for the order. One run step threw (0066). A completion was refused `same_evidence` with a loop steer (0072-0073).
  4. The model then rebuilt the draft: nine amendments, three only partly applied (`strands_a_step`, `no_such_step`, `already_so`), a refused repeat of a failed call (0111), and finally a filtered view; judge 0129 yes ("Sorting by price means no cheaper item can sit on later pages. An earlier unfiltered attempt hit a robot check on page 2").
  58 live steps, 39 calls, 73% cache, $1.9070, 797 s.
- Whole run: $2.4311 (ledger), exit 0.

## Causes (to be confirmed by the trace)

1. The saved Flow's paging loop stops on the second run (`repeat.no_progress`), plausibly where the traffic screen interrupts paging.
2. Rows from several Flow runs within one attempt seem to merge into one dataset out of the site's order, so a right read reads as wrong.
3. The judge is shown the page the run ended on (page 3) as its view, not the pages the rows came from.

## Next

Trace and fix through a worker, prove provider-free, rerun this pair.
