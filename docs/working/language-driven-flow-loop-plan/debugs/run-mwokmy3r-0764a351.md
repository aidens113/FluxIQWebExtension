# Debug: run-mwokmy3r-0764a351

| | |
| --- | --- |
| Status | Stopped in error by the campaign watchdog at 22:06:20 local, while it was making progress. Not a product result. |
| Campaign | 2026-11-19 evening, lane B (`fxwork/t960`, instance `campaign-b`) |
| Source | dev, extension 6314624df and Core 71d25f484 |
| Site and task | bigbox-retail, `bigbox-retail-new-store-cheapest-towels`, Haiku base |
| Reached | attempt 1, 183 steps, about 60 calls |
| Steps | `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-19/run-mwokmy3r-0764a351/steps` |

## Seen before the stop

| Step | Event |
| --- | --- |
| 0047 | `change_approach` on near_repeat x2 |
| 0112 | Climb from Haiku to Sonnet: `no_new_evidence no_progress` |
| 0114 | `change_approach` on no_progress x12 |
| 0163 | `change_approach` on same_fix x2 |
| 0169 | `answer_first.rows_not_read` refusal |
| 0170 | `llm.provider_output_invalid` |

## Why the stop was wrong

- The model called `web.detect_repeating_structure {target: t2756}` at 0175, 0177, 0179 and 0181.
- Core refused the repeats (0180 and 0182, `already_answered`), and the model chose `change_approach` (0184).
- The watchdog read the log between decision 0179 and Core's refusal (0180), and counted earlier, non-consecutive
  calls with the same target.

## Fix (campaign tooling)

The repeat rule now:
- skips a decision whose result is not logged yet;
- fires only when the last 4 unrefused decisions are one call, back to back (paging `core.run_node` aside).

Retested on six runs plus this run's race window: it still catches run-mwoi785f-ebe09067's `core.run_flow` loop, and
nothing else.

Rerun the task in lane B.
