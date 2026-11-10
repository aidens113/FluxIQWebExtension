# Debug: run-mwaudvnh-c208d32c

Status: Failed (not judged). Attempts 1 and 2 were right. **Attempt 3 regressed**: it ended `waiting_for_person` for `stuck_in_a_loop` after 42 live steps and 44 calls; nothing moved for 600 s and the Lab stopped watching (`AttemptProofStuck`). Attempt 4 did not run.
Source: t885 = dev after the integration (Core 050730058, Extension c0f2f5473): fixes 12-17 included (judge kept/left-out rows, look check, select landing, cleared-check effect). The act-gate fix (cd0d3bb6a) was not in this run.
Task: bigbox-retail-rated-delivery-towels, unchanged, `--attempts 4`, visible browser.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Instance t885-live, slot-1.

## Per attempt

| Attempt | Verdict | Path | Flow | Continuation | Calls (interp / judge / decisions) | Time | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | right (16 rows) | explore | flow.59b01e9c | - | 53 (1/3/49) | 900 s | $0.1788 |
| 2 | right | run_flow_then_repair | flow.59b01e9c | held (from 1) | 18 (1/3/14) | 344 s | $0.0624 |
| 3 | not judged: stuck_in_a_loop | (saved Flow, then rounds) | flow.59b01e9c | - | 44 | about 23 min | - |
| 4 | not run | - | - | - | - | - | - |

The towels fix from run-mwaknxf9-7549d126 holds: attempt 1 kept all 16 rows (the organic Loftwell Select-A-Size included), and judges now see each read's kept and left-out rows.

## Attempt 3

The judges said no at 0182 ("two sponsored listings ... kept"), 0222 ("the read stopped at page 1 of 21 results, and the 15 kept rows include a 4.2-rated ..."), 0241 ("two rows kept from page 1 are labelled Sponsored"), 0255 ("27 rows ... keeps 6 sponsored rows") and 0260 ("cannot be confirmed"). Loop steers came at 0185, 0246, 0265 and 0268 (change_approach), then ask_person at 0273. The chat said "Saved today: notes only. I could not save steps" and showed 16 rows.

The Flow that attempt 2 repaired, replayed in attempt 3, keeps sponsored and low-rated rows and stops at page 1. So either attempt 2's repair saved a Flow without the conditions, or the replay ran the read without them. To be traced.

## Next

Trace attempt 3's regression from the step files (read only while the lead integrates), then fix at the cause and rerun this task at `--attempts 4`.
