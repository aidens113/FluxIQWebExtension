# Debug: run-mw44rtn1-37dee092

Status: Passed. Lane B's fourth paid run (t876, slot-2), the first on Haiku for this task. Nothing to repair before the next run beyond the act-on-read fix already made.
Source: Core 9edfe6310 / Downstream dfc00bd86 (task/t876-live-breadth-b), as built for runs 1-3. The lane's Core edits for the act-on-read call were made in the tree while this run ran, after its prelude and Core start, so this run used the old Core build.
Task: everything-store-batteries-and-descaler, unchanged, attempt 1 only, typed into the real extension chat in a visible Chrome. Watched live.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 1 --llm-cost-ceiling-usd 1`, normal guards and no overrides.

## Result and distance reached

Answer right. Ended `achieved`, 3 rows stored and 3 shown, 10 live steps, 12 model calls, 73% of input from cache, $0.0232, 142 s. Site change exactly as asked (`cart:B0BAAA48CT:own` +2, `cart:B0TWDESC04:own` +1). Haiku added the descaler first, then pressed Increase twice: activity "added 1 B0TWDESC04", "set L1 to 2", "set L1 to 3". No repeat, no loop caught.

## The chat the person saw (answer-turn.jpg)

The card is true, but its first act reads "Add to cart: Brightaisle.com Shopping Cart.": the act is named after the page's title, not the product added (Sonnet's runs named "Tidewell Kettle Descaler ..."). A person cannot tell from it what was added. Its words come from what the act's step recorded as its target. Noted for the act-label owner; not traced here. The store's cookie banner was left open (Haiku declined the notifications prompt but not the cookies), which changes nothing the task asks. "Running this again may repeat ..." is on the lead's list of lines t869 is fixing.

## The recurring wasted call

Step 0022 again: `amend_draft` refused `act_on_a_read`, the same as runs 1-3 on Sonnet. Fixed in the lane's Core tree after this run started (lane B fix log, entry 2); the next run is the first on the fixed build.

## Next

Haiku twice more on the fixed build: they measure reliability and show whether the act of opening is now named on the opening step.
