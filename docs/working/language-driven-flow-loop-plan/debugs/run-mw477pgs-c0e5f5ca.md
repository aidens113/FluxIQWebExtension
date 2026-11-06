# Debug: run-mw477pgs-c0e5f5ca

Status: Passed. Third of three Sonnet runs of this task on t875 after fixes A1-A4: three passes in three on this source.
Source: t875 branch with A1-A4 (Core 8cbe83056, d623eb929, 1d16c4a77; Downstream 74e5b5560), same source as the two runs before.
Task: company-website-apprentices, unchanged, attempt 1 only, typed into the real extension chat in a visible browser.
Provider: Anthropic claude-sonnet-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards and no overrides. Instance t875-live, slot-1.

## Result and distance reached

Answer right. Ended `achieved`, 4 rows stored and 4 shown, 14 live steps, 10 model calls, 72% of input from cache, $0.2292, 96 s (199 s launch). Ledger recorded id, verdict and cost. The answer card is the same as the two runs before and true: four rows, "I recorded no changes", "Checked: 4 rows", "Took 1m 36s · $0.23".

## What this does and does not prove

Sonnet on this read: 3 of 3 since the fixes, $0.23-0.26 and 96-104 s each, the same road every time. Attempt 2, Haiku and the citation fixes live remain unproven.

## Next

Haiku on this task (`--llm-max-cost-usd 1 --llm-cost-ceiling-usd 1`).
