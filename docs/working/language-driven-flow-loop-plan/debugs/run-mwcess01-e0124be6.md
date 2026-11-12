# Debug: run-mwcess01-e0124be6

Status: Passed. All 4 attempts were right and every continuation held. **But attempt 2 was not a clean replay**: the saved Flow kept all 28 team cards, the judge refused it, and a repair (4 decisions, 2 judge calls) added the apprentice filter. Attempts 3 and 4 then replayed the repaired Flow; attempt 4 made no model call.
Source: lane t898 (W2 Humanness) with dev (including t899) merged in: Extension fb7a4ebe9-era tree after the merge, Core rebuilt (exit 0).
Task: company-website-apprentices, unchanged, `--attempts 4`, `--humanness 100` (the approved humanness live series; its level-0 baseline is run-mwcdkd7h-832d9262), visible browser.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Launched through the heavy-slot queue with `--priority`, watched to the end by the W2 supervisor.

## Result and distance reached

| attempt | path | calls | usd | wall | live steps | answer |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | explore | 13 (interpretation 1, judge 1, decisions 11) | 0.0239 | 142 s | 15 | right, 4 rows |
| 2 | run_flow_then_repair | 6 (judge 2, decisions 4) | 0.0147 | 129 s | 14 | right |
| 3 | run_flow | 1 (judge 1) | 0.0021 | 61 s | 10 | right |
| 4 | run_flow | 0 | 0.0000 | 49 s | 10 | right |

- One Flow (flow.a2b01920-6dc3-4e8f-adf0-267e0a1b11c1), with continuations held. The total spend is about $0.041.
- The level is recorded on the replay's page steps, for example step 0033 `web.output.dom-click`: `"humanness": {"level": 100, "aimed": true}`.
- No replay flow step failed. No misclick happened; no step declares an empty consequence list.

## Attempt 2's repair: an authoring defect, not humanness (for W1)

- **The judge (0052):** "The stored result has 28 rows, one per team card, not only apprentices. The 4 apprentice rows are correct ... The other 24 rows ... were kept without being asked for." It answered `answersRequest: no`, with `kept_not_asked` defects.
- **The Flow's steps:**
  - `click.our-team` (0006): the "Our team" link, not a filter;
  - `read.our-people.p1` (0010): `dom-extract_list` of every card (name, role, branch);
  - `next.our-people.p1` (0014): `dom-next_page`.
- **How the filter was lost:** attempt 1 then amended its draft twice (0016 `llm_evidence_loop.draft_amended`, 0018 `draft_rerun`). Its answer showed only the 4 apprentices, but the saved Flow's read kept every card, so the first replay delivered 28 rows.
- **Humanness is excluded as the cause:** the click is navigation and succeeded; the read of all 28 cards is a correct read; the filter was never a page act.
- **Comparison:** the level-0 run's exploration took a different path and saved its filter (run-mwcdkd7h-832d9262, attempt 2 judged yes).
- **Next for W1:** a filter applied to the answer by a draft amendment must be saved into the Flow the replay runs.

## Where the time went, and a humanness defect found and fixed

- **Replays:** 49-61 s against 23-30 s at level 0.
- **Arrival pauses** were held before every node, including Core's own control nodes, which never touch the page. Examples: 0067 `builtin.control.merge` 1.2 s, 0075 merge 3.5 s, 0076 `builtin.control.repeat` 3.0 s, 0088 merge 3.5 s.
- **Fix (t898, after this run):** `engine/automation/pacing/arrival-pause.ts` pauses only before nodes that act through a client (a domain's nodes and `builtin.policy.*`), never before Core's control, data, database, flow, logic, math, random, routine or timing built-ins. W3's step-gap floor follows the same rule. Tests are in `pacing/tests/humanness-helpers.test.ts`.
- The pauses before the page steps themselves (navigate, click, extract, next page) are the designed ones: mean about 1.2 s at level 100.

## Next

- Rerun `--humanness 100` on this task after the control-node fix, to measure the designed added time alone. That needs approval.
- Route the filter loss on save to W1.
