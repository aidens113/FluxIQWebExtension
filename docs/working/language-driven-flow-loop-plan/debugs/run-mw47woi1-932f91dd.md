# Debug: run-mw47woi1-932f91dd

Status: Passed. First Haiku run of this task on t875 after fixes A1-A4. It is also the first live proof of A2: the judge's yes was refused for its citations, re-asked within the same check, and the second yes held.
Source: t875 branch with A1-A4 (Core 8cbe83056, d623eb929, 1d16c4a77; Downstream 74e5b5560), same source as the Sonnet runs.
Task: company-website-apprentices, unchanged, attempt 1 only, typed into the real extension chat in a visible browser.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 1 --llm-cost-ceiling-usd 1`, normal guards and no overrides. Instance t875-live, slot-1. The first launch was refused by the `loop` guard (three starts in 30 minutes, nothing spent), and relaunched once the window cleared.

## Result and distance reached

Answer right. Ended `achieved`, 4 rows stored and 4 shown, 14 live steps, 17 model calls, 66% of input from cache, $0.0371, 237 s (451 s launch). About a seventh of Sonnet's cost, at 2.4 times the time.

## What the model did

1. Read the team grid through Load more, but without a filter, so the first completion held all 28 cards. The judge (step 29) said no, correctly: "keeps all 28 team cards, including 24 people who are not apprentices". Two repeats of a failed call were refused by the repeat guard (steps 27, 32), and the model moved on.
2. It amended the draft to keep only the apprentice role, ran it, and completed with the 4 rows.
3. The judge (step 38) said yes but cited a column "role and branch" that the result does not store. Core refuted it (A1's check), and A2 re-asked within the same check with `citationsNotMatched`. The re-ask (step 39) cited the `branch` column, which held, and the yes stood.

## The chat

`answer-turn.jpg`: the card shows the model's own words block (the four rows as text, labelled "In the model's words"), "On the site: I recorded no changes", "Checked: 4 rows, once against what was asked for", "Took 3m 57s · $0.04", Run again and What I did, and "I got what you asked for, and it was checked once against what you asked." The newsletter pop-up had come back over the page by the end (its timer), which does not touch the answer.

One line may be untrue: "checked once". The judge answered three times across two checks (a no, then a yes asked twice). Whether "once" means the one yes or the number of checks is not settled here; it is close to the known "Checked: …" counting line t869 is fixing, so I note it and do not trace it.

## Next

Two more Haiku runs of this task, then napkins.
