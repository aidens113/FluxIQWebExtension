# Debug: run-mw4736gn-6bff0086

Status: Passed. Second of three Sonnet runs of this task on t875 after fixes A1-A4, run for reliability (the person's rule: a pass is repeated twice on its model).
Source: t875 branch with A1-A4 (Core 8cbe83056, d623eb929, 1d16c4a77; Downstream 74e5b5560), same source as run-mw46r5ol-6112668a.
Task: company-website-apprentices, unchanged, attempt 1 only, typed into the real extension chat in a visible browser.
Provider: Anthropic claude-sonnet-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards and no overrides. Instance t875-live, slot-1.

## Result and distance reached

Answer right. Ended `achieved`, 4 rows stored and 4 shown, 14 live steps, 11 model calls, 72% of input from cache, $0.2525, 104 s (189 s launch: Core's web build was reused). Ledger recorded id, verdict and cost.

The answer card shows the four rows, CSV and JSON, "On the site: I recorded no changes", "Checked: 4 rows, once against what was asked for", "Took 1m 44s · $0.25", Run again and What I did. All true.

## What the model did

The same road and the same call count as the previous run; one judge call, a yes with no defects.

## What this does and does not prove

Two passes in a row on this source at $0.25-0.26. Nothing about attempt 2, Haiku, or the citation fixes live (no citation was given).

## Next

The third Sonnet run, then Haiku.
