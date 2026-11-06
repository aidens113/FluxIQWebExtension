# Debug: run-mw48706v-8ac2cc2d

Status: Passed. Second of three Haiku runs of this task on t875 after fixes A1-A4, run for reliability.
Source: t875 branch with A1-A4 (Core 8cbe83056, d623eb929, 1d16c4a77; Downstream 74e5b5560), same source as run-mw47woi1-932f91dd.
Task: company-website-apprentices, unchanged, attempt 1 only, typed into the real extension chat in a visible browser.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 1 --llm-cost-ceiling-usd 1`, normal guards and no overrides. Instance t875-live, slot-1. One earlier launch was refused by the `loop` guard at no cost.

## Result and distance reached

Answer right. Ended `achieved`, 4 rows stored and 4 shown, 17 live steps, 13 model calls, 71% of input from cache, $0.0251, 180 s. The model filtered on the role from the start this time; one judge call, a yes. The card is right: four rows, "I recorded no changes", "Checked: 4 rows", "Took 3m 0s · $0.03".

## What this does and does not prove

Haiku 2 of 2 on this read since the fixes, at $0.025-0.037. Attempt 2 is still held.

## Next

The third Haiku run, then napkins.
