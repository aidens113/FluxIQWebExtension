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

## Cause (traced; report `mvp-seal-plan/reports/live-checks-r3/replay-lost-conditions.md`)

The first reading above was wrong: **the replay was right**. Attempt 2's repair added a page-2 read and dropped it again, so the Flow was unchanged. Attempt 3's replay ran node `main.s9` at 0175 (page 1) and 0179 (page 2) with all four conditions, and kept exactly attempt 1's 16 approved rows.
1. **The judge was not shown what the Flow run's conditions left out.** A Flow run stores rows through `onRecordBatch` (`answer-first/flow-run/flow-run.ts:145`). The sink (`rows/row-sink.ts:254-274`) records only rows and address; the engine's record batch (`engine/automation/records/capture.ts`) drops the read's rejected rows, which the page did return. So judge 0182 saw "Sponsored" ad copies of the same names in the end view, with nothing saying they had been left out, and took the kept organic rows for the ads. Attempt 2's opening replay was misjudged the same way (0131).
2. **The same label appears both kept and left out**, and nothing told the judge that the kept row is a different card that passed every condition. That kept 0241 and 0260 from passing even with the left-out rows shown.
3. Following the wrong no, the model made look-only reads with no conditions (0219, 0250). Each replaced the right result (`answer_first.result_list_replaced`), which produced the "page 1 only" (0222) and "27 rows" (0255) verdicts.
4. "Saved today: notes only" was attempt 3's own ending, after it asked the person (stuck_in_a_loop).

## Next

Fix 1 (a Flow run's read pages carry their left-out rows to the judge) and fix 2 (a left-out label that matches a kept row's label is named as a different card). Then a provider-free `--attempts 4` proof, and rerun this task at `--attempts 4`.
