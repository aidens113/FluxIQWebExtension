# Debug: run-mwcdkd7h-832d9262

Status: Passed. All 4 attempts were right and every continuation held. Attempts 3 and 4 replayed the saved Flow with no model call.
Source: lane t898 (W2 Humanness) after checkpoint 8, with dev merged in: Extension fb7a4ebe9, Core 253c7c9d1. It includes the notice-only first press pressed once more inside its command (click.ts) and the humanness record on replay steps.
Task: company-website-apprentices, unchanged, `--attempts 4`, `--humanness 0` (the baseline of the approved humanness live series), visible browser.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Launched through the heavy-slot queue with `--priority`, watched to the end by the W2 supervisor.

## Result and distance reached

| attempt | path | calls | usd | wall | live steps | answer |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | explore | 11 (interpretation 1, judge 1, decisions 9) | 0.0183 | 106 s | 14 | right, 4 rows |
| 2 | run_flow | 1 (judge 1) | 0.0020 | 30 s | 10 | right |
| 3 | run_flow | 0 | 0.0000 | 23 s | 10 | right |
| 4 | run_flow | 0 | 0.0000 | 23 s | 10 | right |

- One Flow (flow.3566b74b-4351-40c3-890e-1abd4d1651c6) for all four attempts; continuation held 1 to 2, 2 to 3 and 3 to 4.
- The total spend is about $0.0203.
- Attempt 2 was judged because its replay deviated from the accepted run (`flow_not_proven`). Attempts 3 and 4 stood on their record, with no judge asked.
- Level 0: no action result and no flow step carries `humanness`. This is today's path, as designed.
- The replay's first press no longer fails. No flow step failed in any attempt (compare run-mwbvboi2-db25b0d8 before the notice-press fix: one `web.action.page_reported_failure` per replay).

## Where the time went

- **Attempt 1 (108.7 s wall):**
  - Model decisions took 68.7 s over 9 calls (65,250 uncached input tokens; 68% of input from cache overall).
  - Browser 23.8 s: `dom-extract_list` x4 at 2.4 s, `dom-next_page` x4 at 2.9 s, one navigate and one click.
- **Replays (about 21-29 s wall):** browser time is about 20 s, mostly `dom-extract_list` x4 at about 2.5 s and `dom-next_page` x4 at about 2.2 s.

## What this run is for

It is the level-0 baseline of the approved humanness live series. The level-100 run follows on the same task. This live Flow pages with `next_page` rather than scrolling and types nothing. So at 100 the humanness effects in reach are:
- Core's node pauses before each step's first arrival. Since checkpoint 8 a chat-started attempt carries the extension's level as its starting value, which the task stores and the Flow run resolves.
- Click aiming.
- Misclicks, only on steps Core marks safe.
- The level recorded on each replay step.

## Next

Run `--humanness 100` on the same task with the same settings, then compare verdicts, calls, Flow continuity, per-step time and the recorded level.
