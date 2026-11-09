# Debug: run-mw4ffp8c-29ff62e8

Status: Passed, both attempts. Lane C (t877), the live check of the named-column fix (Core fcc262fcc, domain e8e860813), on dev's integrated attempt-2 road with the native judge schema taken out. Haiku pairs on this task: 2 of 2.
Source: Core a2c0f911f / Downstream 8075d65cc (dev d1a394580 / fb7a7a865 merged into the lane, including lane C's W7 and W9). No uncommitted change was built into this run: the engine worker (w11) began editing only after the chat opened, and the Lab had already built.
Task: auction-marketplace-lens-hood-seller-shop, unchanged, `--attempts 2`: the same words typed again in the same thread, no reseed, in a visible browser.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 1 --llm-cost-ceiling-usd 1`, normal guards, no overrides.

## Result and distance reached

- Attempt 1: answer right, `achieved`, path `explore`. 8 rows (title, price, shop order), no change on the site. $0.0143, 11 calls, 9 live steps, 72% cache, 74 s.
- Attempt 2: answer right, `achieved`, path `run_flow`, started from attempt 1's saved work (digest proven). The saved Flow's read came back with both title and price, the judge said yes, and nothing else was needed. $0.0012, 1 call (the judge), 5 live steps, 20% cache, 23 s.

Against run-mw49972k-cebf67e5 on the same task and model before the fix: attempt 2 went from `run_flow_then_explore` with 6 calls, $0.0104 and 74 s (the saved read had lost its price column, so a judge "no", a structure detection, an amendment and a second judge) to `run_flow` with 1 call, $0.0012 and 23 s. That is the fix doing what it was for.

## UI review (attempt-2 answer-turn.jpg)

The 8-row table; "On the site: I recorded no changes"; "Checked: 8 rows, against what was asked for"; "Used what I saved. No steps had to be worked out again" (true); "This time 23s and $0.00. First time 1m 14s and $0.01" ($0.0012 rounds to $0.00; the sum is right but it reads as free); "Saved today: the steps. They worked last time"; Run again / What I did. The toast "Working on your task, Step 5 of 5 / Checked" is still up after the run ended (known; t869 fixing). The site's cookie banner is open again under the panel on attempt 2 and covers nothing the task needs.

## Next

Two more Haiku pairs on this task, then crossborder with the Lab person.
