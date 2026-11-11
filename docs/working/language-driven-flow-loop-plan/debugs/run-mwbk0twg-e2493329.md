# Debug: run-mwbk0twg-e2493329

Status: Passed, 4 of 4 right. Towels on Haiku now gets the right answer and replays it deterministically. Replays 3 and 4 stood on their record with no model call.
Source: t885 = dev 0871fb237 (extension) / 3766caea6 (Core). This includes named columns end to end (170d8c4c5), the dining fix (f75373940), S9 wired and t897's panel outcome-reader and absent-interruption fixes.
Task: bigbox-retail-rated-delivery-towels, unchanged, `--attempts 4`, visible browser. Lab run queued through `heavy-slot.mjs run t885 --priority`.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Instance t885-live, slot-1.

## Per attempt

| Attempt | Verdict | Path | Flow | Continuation | Calls (interp / judge / decisions) | Time | S9 decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | right, 16 rows | explore | flow.83f3d690 | - | 31 (1/1/29) | 548 s | - |
| 2 | right, 16 rows | run_flow | flow.83f3d690 | held (from 1) | 1 (0/1/0) | 47 s | judged: deviated, `flow_not_proven` (the first replay proves the Flow) |
| 3 | right, 16 rows | run_flow | flow.83f3d690 | held (from 2) | 0 | 24 s | stood on its record, no judge |
| 4 | right, 16 rows | run_flow | flow.83f3d690 | held (from 3) | 0 | 20 s | stood on its record, no judge |

Whole run $0.0998 (ledger), exit 0. The answer now holds exactly `name, price, rating` (no `link`), and all 16 oracle rows appear in order, including the organic Loftwell Select-A-Size row.

## Notes

- The run's first Core start built Core's web app (`next build`) because dev had changed it. That took about 6 minutes before the instruction was typed; it was not counted in any attempt's time.
- Attempt 1: 548 s, 30 calls. The speed split from the previous run (debugs/run-mwb2kkv5-1baeee11.md) applies: model decisions dominate.

## Next

Breadth round, one task per site at `--attempts 4`.
