# Debug: run-mw49972k-cebf67e5

Status: Passed, both attempts. Lane C (t877), first Haiku run on this task and the lane's first attempt-2 pair (the lead released pairs once the `$row.url` fix reached this branch). One pass on Haiku, so no measure of reliability yet.
Source: Core c30a8ad34 / Downstream af5b23723 (lane C's witness fixes committed), no uncommitted change touching this site.
Task: auction-marketplace-lens-hood-seller-shop, unchanged, `--attempts 2`: the same words typed again in the same thread, no reseed, in a visible browser.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 1 --llm-cost-ceiling-usd 1`, normal guards, no overrides.

## Result and distance reached

- Attempt 1: answer right, `achieved`, path `explore`. 8 rows (title, price, shop order), no change on the site. $0.0137, 10 calls, 9 live steps, 73% of input from cache, 70 s.
- Attempt 2: answer right, `achieved`, path `run_flow_then_explore`, started from attempt 1's saved work (digest proven). Nothing changed on the site. $0.0104, 6 calls, 8 live steps, 52% cache, 74 s.

## What to fix: the saved read dropped a column it was written with

Attempt 1's list read (step 17) asked for `title` and `price`, with price bound to the structure's field key `span_currency_amount`, and its rows held both. On attempt 2 the saved Flow's run of that read returned the 8 titles with no price column at all (judge, step 22: `asked_missing`, "the record set has only the title column"). The model then detected the structure again, amended the draft's read (steps 24-27), read again with price, and completed. The answer was right, but attempt 2 cost a judge "no", a structure detection, an amendment and a second judge that a working saved read would not have needed. Cause (traced after this note was first written, lane C worker w6; the parser lines confirmed by the supervisor): not the saved-read binding. Core's instruction column parser (`runtime/flow-authoring/bootstrap/answerability/instruction-columns.ts:60`) reads "with columns title and price exactly as the shop shows them" as `["title"]`: the last item runs past three words, so the list breaks off and "price" is dropped unreported. When the saved Flow is assembled for its run, `bootstrap/authoring/assembled-record-output.ts:56-72` makes that the read's declared schema, and the domain's `output-nodes/extract-list/declared-columns.ts:96-120` then narrows the read to it, treating `price` as a helper column, with `ok: true` and no error. A live `core.run_node` read never goes through that assembly, which is why both exploration reads kept the price.

## UI review (attempt-1 and attempt-2 answer-turn.jpg)

Attempt 2's turn: the 8-row table, "On the site: I recorded no changes", "Checked: 8 rows, once against what was asked for", "Used what I saved as far as it went, then worked out the rest" (true), "This time 1m 14s and $0.01. First time 1m 10s and $0.01", "Saved today: the steps. They have not run on their own yet..." (the repaired steps have not run alone; the earlier ones did run, so this line undersells what happened), Run again / What I did, "I got what you asked for...". The site's cookie banner is open again under the panel on attempt 2. It covers nothing the task needs.

## Next

Haiku repeats on this task (two more), then professional-network as a pair.
