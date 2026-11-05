# Debug: run-mw3if5xt-a2bc72ae

Status: The product did the task; the Lab's final check was too narrow. Check corrected for the next run. The answer is not re-scored, so this run stays recorded as failed.
Source: Core c434fdecc / Downstream adc6a56a8, both on dev.
Task: local-classifieds-save-dining-tables, unchanged, attempt 1, typed into the real extension chat in a visible browser.
Provider: Anthropic claude-sonnet-5-5 via CLAUDE_API_KEY; $5 attempt purse, `--llm-max-cost-usd 5`, normal guards and no overrides.

## Result and distance reached

Ended `achieved`: $0.7938, 34 calls, 29 live steps, 81% of input from cache, 279.7 s, against $4.84 on the run before it. Exactly three saves, one each on the right listings, no "unsaved", `repeatedActs` empty, `actsWithNoRow` 0. The card holds all five saved items cheapest first, 22, 45, 60, 65, 95, matching the expected records (`records: held`, `shown: held`, `change: held`). `saved` reads `partly_works`.

The Lab scored the answer wrong on `final_state` alone.

## Cause

The fact `SAVED_TOTAL` reads a total printed only on the Saved page. The task asks for saves and a table, and never to finish on that page. The judge answered unsure at step 60, because only one table's distance was on the evidence. The model steered correctly, reopened the 5-mile search to read the distances, and the judge said yes at step 68, leaving the browser on the search page. So the fact could not be read. The site's state was right.

The fact now reads the Saved badge, which is on every page, for the same count. That is the same fact in the site's own terms, and not a weaker oracle: `change` still holds the exact listings. Every realistic task's final facts are being audited for the same fault.

## What this proves

The cache fix and the repairs work on a real model. The refused repeat of `complete` at step 62 was steered once, `near_repeat` x2 in `loopsCaught`, and the model then did the right thing. No malformed reply came up, so the earlier two remain unexplained.

## Still wrong

The card's site lines read "Save. Save. Save." and name no listing, though the repair said they would. The Flow stays `unproven`, since it has not run from its start on its own.

## Next

Haiku 5.5 on this task, capped at $1, after the person approved testing it.
