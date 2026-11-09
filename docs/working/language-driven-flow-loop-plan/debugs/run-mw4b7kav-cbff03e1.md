# Debug: run-mw4b7kav-cbff03e1

Status: Failed: answer wrong (`records`, `not_shown`). Lane B's thirteenth launch (t876, slot-2), the first of job-board-save-quillmark-remote on Haiku. The site was left exactly right. The person was shown the wrong table: 3 search-result rows in place of the 5 saved jobs asked for.
Source: Core 54cb095a9 / Downstream 89aef4bf5 plus lane B's uncommitted guarded main-heading rule and startup-log copy. Lane A's A5/A6 (efba88efa) were not in this build.
Task: job-board-save-quillmark-remote, unchanged, attempt 1 only, typed into the real extension chat in a visible Chrome. Watched live.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 1 --llm-cost-ceiling-usd 1`, normal guards and no overrides.

## Result and distance reached

Ended `achieved` after 46 live steps, 53 model calls, 78% cache, $0.1205, 644 s. Every act was right: the three Quillmark remote UK jobs were saved once each, there was no unsave, and nothing doubled (activity "saved m1", "saved g5", "saved d12"). Quillmark Labs and the hybrid London role were left alone. 3 rows were stored and shown. They came from step 0025, a read of the Quillmark search results filtered to the three remote UK jobs ("3 records from 1 page, 4 items left out by where"). The task asks for the saved list, which holds 5 jobs.

## What happened

Haiku saved the three jobs from the search results (with one refused press at 0048 and an `already_so` amendment at 0057). It completed at 0061. The judge was unsure (0062-0063, `answer_first.judged_unsure`): the search page says "Page 1 of 5 jobs" and pages 2-5 had not been read. Haiku then spent about 40 steps checking for more pages: find_on_page searches, next page at 0107 ("ended at once"). At 0109 it opened My jobs (Saved), but it never read that list. It completed at 0110 with its earlier 3 rows. The judge (0111) said yes. Its own words: "The saved list now shows 5 jobs: those three plus Product Designer (Halvard Systems) and Frontend Engineer (Pinecrest Retail) ... Recorded rows match the saved list columns." The rows matched the columns, but there were 3 rows where the saved list has 5.

## Cause

1. **The judge (decisive).** The check said yes to a 3-row table while describing a 5-row saved list. Matching the columns is not the same as holding the rows asked for: the request asks for the saved jobs, and the judge itself saw five. A completion whose rows are not the place the request reads back should be refused. This is in Core's flow-less result verification, which lane A owns. Lane B did not trace it further. Lane A's judge schema change (A6) arrived after this run; whether it covers this is for lane A to say.
2. **The model's path (contributing).** Haiku took the search results it had filtered as the answer, and it treated "Page 1 of 5 jobs" (5 jobs on one page) as five pages. Haiku on this site is slow and costly in calls (53 against Sonnet's 20). The task's wording is clear ("then read the saved list"), so the wording is not changed.
3. Lane B's rows-not-read rule did not apply: a read had run (the search results). That is as designed: it asks for a read, not for the right list.

## The chat the person saw (answer-turn.jpg)

The card shows the 3 search rows as the answer, and the saved list is not shown. "I got what you asked for" is untrue for the table.

## Next

Report the judge's yes to lane A through the lead. Rebuild Core with A5/A6, then a Haiku batteries pair as the live check of the same-words fix. Haiku on quillmark is not rerun until the source changes (the `unchanged` guard).
