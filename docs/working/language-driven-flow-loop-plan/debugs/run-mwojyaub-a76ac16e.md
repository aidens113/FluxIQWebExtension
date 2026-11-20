# Debug: run-mwojyaub-a76ac16e

## Run

| | |
| --- | --- |
| Status | **FAILURE**. Attempt 1 spent the $5 purse without an accepted answer (`budget_out`). Attempts 2 to 4 replayed the saved Flow with zero calls and also read `budget_out`. Lab: failed. |
| Campaign | 2026-11-19 evening, lane B (`fxwork/t960`, instance `campaign-b`) |
| Source | dev, extension 6314624df and Core 71d25f484 |
| Site and task | professional-network, `professional-network-netherlands-data-engineers` |
| Instruction | "... narrow the results to 2nd-degree connections based anywhere in the Netherlands. Go through every page ... columns name, headline and location ... Leave out anything marked as promoted, and list each person once ... in the order the search shows them." |
| Time | 21:36 to 21:50 local; attempt 1 took 514 s |
| Cost | $5.02 ($4.7031 in attempt 1, $0.3122 for attempt 2's replay judge) |
| Steps | `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-19/run-mwojyaub-a76ac16e/steps` |

## Cost by call kind (attempt 1 and 2 together)

```text
total $5.0158
  decide: 140 calls, $2.9482, input 6817240, cache read 70%, output 26540, models haiku/opus/sonnet
  judge: 7 calls, $2.0671, input 1549017, cache read 40%, output 6672, models haiku/opus/sonnet
  chat: 1 calls, $0.0005, input 3188, cache read 0%, output 186, models haiku
  judge 0192 sonnet-5-5: input 126811, cache read 0 (0%), fresh 126811, written 119733, $0.3286
  judge 0235 sonnet-5-5: input 154553, cache read 119733 (77%), fresh 34820, written 30836, $0.1059
  judge 0263 sonnet-5-5: input 168019, cache read 150569 (90%), fresh 17450, written 13315, $0.0633
  judge 0301 sonnet-5-5: input 182525, cache read 163884 (90%), fresh 18641, written 14507, $0.0712
  judge 0327 sonnet-5-5: input 201270, cache read 178391 (89%), fresh 22879, written 17801, $0.0824
  judge 0361 opus-5-5: input 219072, cache read 0 (0%), fresh 219072, written 213994, $1.1037
  judge 0393 haiku-5-5: input 496767, cache read 0 (0%), fresh 496767, written 491565, $0.3122
  | 0031 | loop_decision | core.loop_decision | change_approach on near_repeat x2 | - |
  | 0056 | loop_decision | core.loop_decision | change_approach on near_repeat x2 | - |
  | 0170 | escalate | - | claude-haiku-5-5 -> claude-sonnet-5-5 (no_new_evidence no_progress) | - |
  | 0259 | loop_decision | core.loop_decision | change_approach on exact_repeat x3 | - |
  | 0266 | loop_decision | core.loop_decision | change_approach on exact_repeat x3 | - |
  | 0288 | loop_decision | core.loop_decision | change_approach on exact_repeat x2 | - |
  | 0290 | loop_decision | core.loop_decision | change_approach on exact_repeat x2 | - |
  | 0300 | loop_decision | core.loop_decision | finish_with_best on exact_repeat x3 | - |
  | 0311 | loop_decision | core.loop_decision | change_approach on exact_repeat x2 | - |
  | 0350 | loop_decision | core.loop_decision | change_approach on exact_repeat x3 | - |
  | 0356 | escalate | - | claude-sonnet-5-5 -> claude-opus-5-5 (loop_persisted exact_repeat) | - |
  | 0395 | escalate | - | claude-haiku-5-5 -> claude-sonnet-5-5 (repair_failed) | - |
```

## Climbs and loop decisions

| Step | Event |
| --- | --- |
| 0031, 0056 | `change_approach` on near_repeat x2 (Haiku) |
| 0170 | Climb from Haiku to Sonnet: `no_new_evidence no_progress` |
| 0259, 0266, 0288, 0290, 0311, 0350 | `change_approach` on exact_repeat x2/x3 (Sonnet) |
| 0300 | `finish_with_best` on exact_repeat x3. The judge refused the best result, and the attempt went on. |
| 0356 | Climb from Sonnet to Opus: `loop_persisted exact_repeat` |
| 0395 (attempt 2) | Climb from Haiku to Sonnet: `repair_failed` |

## Why it failed

All six judges refused the result for the same reasons. From 0235 on: the filters were right (32 people over 4
pages), but the table "keeps a promoted ad row" and the rows are out of the search's order. Examples:
- 0301: "The 22 stored rows do not answer the request. The promoted ad row was kept, rows are o...";
- 0361 (Opus, $1.10): "Filters were correct and all 4 pages read, but the table keeps a promoted ad row and a...".

The instruction asks plainly for promoted rows to be left out, so the judges were right and the task is achievable as
worded. No model (Haiku, Sonnet or Opus) got the saved read to exclude the promoted row and keep the search's order.
It is the same family as F3: a row-level condition, here "marked as promoted", that the read never expressed as a
condition or column.

**Cost:** the Opus judge at 0361 continued the decider's conversation on Opus and cost $1.10 for one call. Sonnet
decisions cost about $0.044 each. There were 77 repeated browser calls.

## Classification

- **FUNDAMENTAL (result formation):** rows marked on the page (promoted) are not excluded by the read. Related to F3.
- **Cost observation:** with t965, a judge that follows an Opus decision runs on Opus at $1.10 per call.

## UI

Every attempt's answer turn was drawn (34 rows shown).
