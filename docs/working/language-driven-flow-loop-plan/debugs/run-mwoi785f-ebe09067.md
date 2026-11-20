# Debug: run-mwoi785f-ebe09067

## Run

| | |
| --- | --- |
| Status | **PARTIAL**, stopped by the campaign supervisor. Attempt 1 right (7 rows, `achieved`). Attempt 2 looped on `core.run_flow` and was stopped at 05:07:26Z with `pnpm lab stop`. Attempts 3 and 4 never ran. |
| Campaign | 2026-11-19 evening, lane B (`fxwork/t960`, instance `campaign-b`) |
| Source | dev, extension 6314624df and Core 71d25f484 (t962 ladder, t963 judge, t964 key fix, t965 judge sizing and caching) |
| Site and task | job-board, `job-board-remote-easy-apply`, the direct test of t963 |
| Time | 04:53Z to 05:07Z (about 14 min) |
| Cost | about $0.95 by the step log (see below) |
| Steps | `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-19/run-mwoi785f-ebe09067/steps` |

## Cost by call kind (provider-reported)

```text
total $1.2709
  decide: 61 calls, $1.0283, input 2349286, cache read 69%, output 12091, models haiku/sonnet
  judge: 4 calls, $0.2421, input 279687, cache read 27%, output 4048, models haiku/sonnet
  chat: 1 calls, $0.0005, input 3211, cache read 0%, output 204, models haiku
  judge 0058 haiku-5-5: input 51210, cache read 0 (0%), fresh 51210, written 45843, $0.0068
  judge 0100 sonnet-5-5: input 76977, cache read 0 (0%), fresh 76977, written 71166, $0.1984
  judge 0101 sonnet-5-5: input 77422, cache read 71166 (92%), fresh 6256, written 0, $0.0275
  judge 0124 haiku-5-5: input 74078, cache read 3537 (5%), fresh 70541, written 65187, $0.0093
  | 0067 | escalate | - | claude-haiku-5-5 -> claude-sonnet-5-5 (completion_refused_again near_repeat) | - |
  | 0071 | loop_decision | core.loop_decision | change_approach on near_repeat x2 | - |
  | 0130 | escalate | - | claude-haiku-5-5 -> claude-sonnet-5-5 (repair_failed) | - |
```

## Attempt 1: right, and t963's judge accepted Easily apply

- **First judge (0058, Haiku):** no. "It keeps rows that do not offer Easily apply".
- **Climb (0067):** the completion was refused again, and the ladder climbed from Haiku to Sonnet
  (`completion_refused_again near_repeat`).
- **Loop decision (0071):** the model chose `change_approach` on near_repeat x2.
- **Judges 0100 and 0101 (Sonnet):** yes, "The 7 rows match every Easily apply, Remote (UK) job with a salary on the
  date-sorted ...". The answer was right, so the job-board judge failure (F3) did not recur.
- **Caching:** judge 0101 read 71,166 of its 77,422 input tokens from cache (92%), so the pair's second judge reuses the
  first judge's cache. The first judge of each pair still writes its whole trail fresh (F14, narrowed).

## Attempt 2: the replay deviated, then a run_flow loop

- **The replay deviated** (0123, `flow_not_proven`). The judge at 0124 (Haiku) said the extraction "kept 7 rows across
  all three result pages, but the request asked for Ea...".
- **Climb (0130):** the repair failed, and the ladder climbed from Haiku to Sonnet (`repair_failed`).
- **The loop:** Sonnet then called `core.run_flow {from: 16}` seven times: 0184, 0194, 0204, 0214, 0226, 0236 and 0249.
  - At 0184 it said "Run the saved Flow forward from step 16 to re-read all pages with the filter and finish".
  - Each replay ended normally, for example 0191: "the list has no next page (control_absent), so the loop over its
    pages ends here".
  - The model then ran the same replay again instead of completing.
- **Why nothing caught it:** the replays succeed, so the repeat guard (which refuses repeated failed or no-effect calls)
  did not fire. Loop detection wrote no loop row after 0071.
- **Totals:** 80 `core.replay.replayed` steps, about $0.03 per decision.

## Findings

- **F15 (FUNDAMENTAL: loop detection):** a successful tool call repeated with the same input is never caught. Here that
  was seven `core.run_flow {from: 16}` calls in about 8 minutes, each a full multi-page replay. Why the model would not
  complete after a clean replay is not traced.
- **Date sort:** the lead asked to watch for attempt 3's Flow saved before the date sort was found. It did not show:
  attempt 1's judge named the "date-sorted" results, and the run never reached attempt 3.

## UI

Attempt 1's answer turn was drawn with 7 rows. Attempt 2 was stopped mid-run.
