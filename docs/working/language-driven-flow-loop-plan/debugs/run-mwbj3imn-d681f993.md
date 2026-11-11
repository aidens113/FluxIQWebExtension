# Debug: run-mwbj3imn-d681f993

Status: Passed. Every attempt ended `achieved` with the right answer and its answer card; every continuation held. Attempts 3–4 ran the saved Flow and stood on its record with no model call. Cost $0.0167.
Source: lane t897 on dev (Core 7912a08d7; extension 752d2cc59), which holds all three round-2 fixes: the absent-interruption reading (Core 3c5cf20a7), the panel reading the replay verdict (extension 6fcb483f2), and the Lab waiting for the card.
Task: social-network-feed-group-post, unchanged, `--attempts 4`, visible browser.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Instance t897, through the machine's heavy slot.

## Per attempt

| Attempt | Path | Calls (interp / judge / decisions) | Cost | Answer card (drawn after) | S9 verdict | Posts (before -> after) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | explore | 9 (1/1/7) | $0.0129 | Done on the site (2 ms) | none | 0 -> 1 |
| 2 | run_flow | 2 (0/2/0) | $0.0038 | Done on the site: nothing changed this time (4 ms) | judged: flow_not_proven | 1 -> 1 |
| 3 | run_flow | 0 | $0 | Done on the site: nothing changed this time (3 ms) | stood on its record | 1 -> 1 |
| 4 | run_flow | 0 | $0 | Done on the site: nothing changed this time (3 ms) | stood on its record | 1 -> 1 |

Attempt 2's two judge calls are one completion: the second is the judge asked again after Core refused a citation of a row the result does not hold, as seen in earlier runs of this task. Attempt 2 is the replay that proves the Flow whole; from then on, replays stand on their record.

## Next

None for t897: the deterministic target is met, live and provider-free (dining, `run-mwbhd4eu-0a8863c9`). D1 (the chat's "Click · Post — Done" for a step not sent again) and the run gate's cross-attempt act carry belong to another lane.
