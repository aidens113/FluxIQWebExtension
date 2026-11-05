# Debug: run-mw37vz9n-a77a02c2

Status: Failed at `budget_out`, with the acts right. Traced from the step log; the causes marked as read still need confirming in the code. Repairs are required before another paid run on this task.
Source: Core ee91b470a / Downstream cdad6b0cf, both on dev.
Task: local-classifieds-save-dining-tables, unchanged, attempt 1, typed into the real extension chat in a visible browser.
Provider: Anthropic claude-sonnet-5-5 via CLAUDE_API_KEY; $5 attempt purse, `--llm-max-cost-usd 5`, normal guards and no overrides.

## Result and distance reached

Ended `budget_out`: $4.8391, 54 calls, 48 live steps, 2,331,680 tokens, 797 s. No double press. The site gained exactly three saves, one each on the right listings, with no "unsaved", `repeatedActs` empty and `actsWithNoRow` 0. Spend was $0.81 by the first save, about $3.6 by the third, and $4.27 at the last judged no.

The result on the card was wrong in one way: the rows came back in the order 45, 22, 65, 95, 60, where the task asks for cheapest first. The answer scored `records: failed` and `shown: failed` for it.

## Causes

1. **A later, correct read did not become the result (read from the log).** At step 110 the model sorted the saved page and read it in the right order: 22, 45, 60, and so on. The judge at step 112 still saw the old order, so the result is holding the first read of that list and a re-read does not replace it. The model could not see or fix this.
2. **Three refusals in a row burned the rest of the budget.** Steps 116 to 121 are `complete`, refused `answer_first.same_evidence`, three times at about $0.14 each, and the attempt reads `loopsCaught` 0. Repeating a refused completion is what loop detection exists for. The ladder should have steered it, then asked the person.
3. **Nothing was saved.** `saved` is null and the card says "Nothing saved yet", after a run that had a draft with a repeat and did all the work. Saving the best attempt regardless is the centre of the pivot, so a budget ending must not lose it.
4. **A forward run stopped at the first row.** Step 71 answered `attempt.act_already_done` for the row pressed by hand, then step 72 `core.replay.unreproducible`, "the step did not run (target_not_found)", so the second and third rows were not reached. This is the first row by hand, then the written loop on the rest, the design's own path, on a real model. The model then saved them by hand, at a cost of about $1. The cause is not traced.
5. **Two malformed replies.** Steps 48 and 50 ended `llm.provider_malformed_response`, about $0.21 together, with 2,064 output tokens on the first and no usable decision. Not traced.
6. **The card's words on this ending.** "What failed: 5 rows, 3 acts on the site, once against what was asked for" says nothing true. "On the site: Save. Save. Save." names no listing.
7. **Context kept growing.** A call's input went from 20K to 65K tokens, so a late call cost about $0.14 against $0.04 early on.

## What the model did well

It declined the cookie dialog, searched, set the radius, saw Apply swallowed and pressed it again, sorted, recognised sponsored and non-table listings, corrected its own filter when it dropped the glass table, and wrote an idempotent save step so a repeat would not unsave. The judge's three refusals were each correct and specific.

## Supervision

The monitor armed on this run delivered no events during it, so this run was not watched live, though it stayed under its ceiling. The next paid run polls its log on a timer rather than following it.

## Next

Repair 1 to 6 with provider-free proofs, then re-run this task. The Lab refuses unchanged source after a failure.
