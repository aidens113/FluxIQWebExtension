# Debug: run-mw43h5ew-a04a583d

Status: Failed. The rows were right, but Core refused the judge's yes, the attempt looped on the same evidence until it asked a person, and then the Lab threw away the run's evidence. Two product defects and one Lab defect, all being repaired on t875 before this task runs again.
Source: Core 9edfe6310 / Downstream c6ae6144f (t875 branch = dev plus t869's attempt-2 road).
Task: company-website-apprentices, unchanged, attempt 1 only, typed into the real extension chat in a visible browser.
Provider: Anthropic claude-sonnet-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards and no overrides. Instance t875-live, slot-1.

## Result and distance reached

The model got the right answer by step 25: the 4 apprentice rows (Rhian Taverner, James Whitlock, Ollie Pratchett, Megan Ashdown, all Apprentice Heating Engineer, with the right branches), read through a Load more repeat and replayed whole with `core.run_flow`. The judge (step 26) answered yes, with no defects, and left out the other James Whitlock correctly.

Ended `waiting_for_person` for `stuck_in_a_loop` at step 60, 694 s, 19 model calls, $0.54, 69% of input from cache. The Lab then failed with `runtime.behavior`: "Core stored 4 record(s) for a run dataset and returned 28". No `attempt.json`, no `answer-turn.jpg` and no verdict were kept, and the ledger's finish line has `runId: null` and no cost. The chat was not seen.

## Causes

1. **Core refused a right yes over how the judge named rows.** The judge's prompt says to list each checked row "as its label in row" but never says what a label is. Sonnet wrote `row: "1"` to `"4"`. Core matches a cited row only by its label, the first stored column's value (`result-verification/cited-yes/citation-refuted.ts`), so all four citations were "no row the result holds". The yes became `unsure` (`core.result.yes_citation_refuted`), refused as `answer_first.judged_unsure`.
2. **Nothing could move that unsure.** The completion check only asks the judge again on new evidence. The rows were right, so every honest re-read returned the same rows and was refused as `same_evidence` (steps 38, 52, 59). The loop ladder climbed steer, change approach, ask a person. This was the product's doubt about its judge's citation, not about the result, so the model could not answer it.
3. **The Lab loses a paid run's evidence when its dataset read throws.** The run dataset's summary said 4 records while the page read returned 28 (seven reads of the same 4 rows). `readRunDatasets` throws, and the attempt command exits before it writes the attempt record, the answer picture or the ledger's run id and cost.

## What this does and does not prove

It shows Sonnet doing the task right in Answer First on this tree, and the judge agreeing. It does not prove the answer card, which was never captured, or any attempt 2.

## Next

Fix 1 in Core (cite a row by its position as well as its label, and say what a label is), fix 3 in the Lab (find which side of 4 against 28 is right, and keep the evidence whatever a later read throws). Cause 2 goes to the lead as an open question: a citation-refuted yes on unchanged evidence should be re-judged once, not refused for ever. Then rerun this task on Sonnet.
