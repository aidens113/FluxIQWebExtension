# Debug: run-mw4a2ywt-f935cbc5

Status: Stopped by lane B's supervisor (`pnpm lab stop t876-live`) after attempt 2 waited with no attempt for about 6 minutes. Attempt 1 was right. Attempt 2 never started: Core's chat asked the person a question instead. That is a known product defect, and lane A owns it.
Source: Core with lane B's act-label fix (8b6313eaf), checked-count (54cb095a9), rows-not-read, act-on-read and `$row.url` / Downstream with the act-label fix (89aef4bf5).
Task: everything-store-batteries-and-descaler as an attempt-2 pair (`--attempts 2`), typed into the real extension chat in a visible Chrome, watched live.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 1 --llm-cost-ceiling-usd 1`, normal guards and no overrides.

## Result and distance reached

**Attempt 1: right**, by the evidence it left (the run was stopped before the Lab wrote its verdict lines). It ended `achieved` with 34 steps, about 18 model calls and $0.03 by the step log. Site change exactly as asked: `cart:B0BAAA48CT:own` +2, `cart:B0TWDESC04:own` +1. Activity: "set L1 to 2", "set L1 to 3", "passed soft check", "consent decline", "added 1 B0TWDESC04". No repeat. `answer_first.rows_not_read` refused one no-read completion at 0026; the model then read the cart and completed with 3 rows. The judge said yes.

**Attempt 2: not started.** The same words were typed into the same thread at 01:19:09Z. Core's panel command (Haiku, step 0035, $0.0007) did not start an attempt. It asked: "You already had the AA batteries changed to three packs and the Tidewell kettle descaler added in this cart. Do you want me to do that again, or just show you what the cart holds now as a table?" No person answers in a Lab run, so the attempt lane waited ("no attempt yet") until the run was stopped. Nothing was pressed in attempt 2.

## Cause

Attempt 2: Core's panel-command guidance. The lead reports that lane A found two contradicting sentences in `conversations/commands/answer-first/summary.ts` on its napkins pair, and lane A owns the fix. Under t869's same-words rule, the same words again want the end state and the rows: the chat should start the attempt, which then finds the acts done. Lane B does not trace it. This lane's batteries and quillmark pairs wait for that fix.

## The chat the person saw (attempt-1/answer-turn.jpg)

The card lists two "Increase quantity by one: Brightaisle Basics AA Alkaline Batteries ..." and "Add to Cart: About this item.", then "Checked: 3 rows, 3 acts on the site, once against what was asked for". The add was named by the nearest heading above the control, the product page's "About this item" section, under lane B's first act-label rule. That is wrong. The domain rule has since changed: an act in no list takes the page's main heading only for a control in the page's single main item (not in a card or a repeated group, and in the main landmark), and otherwise nothing, so the line falls back to the control's own words. The fix log has the details.

## Next

Quillmark attempt-1 runs until lane A's panel-command fix reaches this branch, then the pairs.
