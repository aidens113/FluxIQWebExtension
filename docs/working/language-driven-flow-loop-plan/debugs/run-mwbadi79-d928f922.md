# Debug: run-mwbadi79-d928f922

Status: Passed. Every attempt ended `achieved` with the right answer, and every continuation held. Attempts 2–4 ran the saved Flow (`run_flow`) with one judge call each and no decisions. Cost $0.020.
Source: lane t897 before its first landing (Core 6bd077088 + t897 working tree; extension 394707565 + t897 working tree): the gate fix, the Lab follower fix, the layer-root node-token fix and the persisted S9 verdict.
Task: social-network-feed-group-post, unchanged, `--attempts 4`, visible browser.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Instance t897.

## Per attempt

| Attempt | Verdict | Path | Continuation | Calls (interp / judge / decisions) | Time | Cost | Replay verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | right | explore | - | 10 (1/1/8) | 59 s | $0.0145 | none |
| 2 | right | run_flow | held (from 1) | 1 (0/1/0) | 16 s | $0.0019 | judged: flow_not_proven |
| 3 | right | run_flow | held (from 2) | 1 (0/1/0) | 17 s | $0.0018 | judged: act_not_done |
| 4 | right | run_flow | held (from 3) | 1 (0/1/0) | 18 s | $0.0019 | judged: act_not_done |

## Presses on Post and the composer

- **Attempt 1:**
  - composer opener pressed once, answered;
  - Post's first press settled unchanged (the fixture's 450 ms trap) and was pressed once more inside the command (t896), then answered;
  - one group-post landed and the post appeared.
- **Attempts 2–4:**
  - the cookie step s2 ended by state route (banner absent);
  - the composer opener was pressed once and the text typed;
  - Post was not dispatched (the run gate: already done);
  - no group-post request; the post count stayed 1, from attempt 1.
  - The chat showed "Click · Post — Done" over an open, unsent composer. That wording is D1, handed to another lane. It is what the user saw.

## Defects this run showed, and where they went

1. **Attempts 3–4 judged for `act_not_done`:** the absent cookie step s2 read as an act not done. Fixed in Core ce0e1f048 (`flow-run/steps-ran.ts`: an interruption step simply not there reads `absent`).
2. **No answer card for attempts 2–4** (`answer-turn.json` null): the panel's outcome reader refused the new `replay` field. Fixed in extension 863e6c381 (`read-task-outcome.ts`, typed against the contract). The Lab now records the card's draw time (bb0d9acfd).
   - Proven provider-free on dining, `run-mwbhd4eu-0a8863c9`: every card drew within 5 ms; attempts 3–4 stood on their record at 0 calls.

## Next

Rerun this task live at `--attempts 4` on the merged tree. Expected: attempt 2 judged once (`flow_not_proven`); attempts 3–4 stand on their record at 0 calls; every attempt has its answer card.
