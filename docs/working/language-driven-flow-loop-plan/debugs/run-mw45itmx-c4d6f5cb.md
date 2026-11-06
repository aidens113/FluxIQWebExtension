# Debug: run-mw45itmx-c4d6f5cb

Status: Failed (answer wrong, `no_result`). Lane B's fifth paid run (t876, slot-2), the second Haiku run of this task and the first on lane B's act-on-read fix. The site was left exactly right; the person was given no table.
Source: Core task/t876-live-breadth-b with the uncommitted act-on-read fix (checklist `openSaid`, `actOnRead` opener way out, `act_on_a_read` told on a written read) / Downstream dfc00bd86 plus that run's rebuild.
Task: everything-store-batteries-and-descaler, unchanged, attempt 1 only, typed into the real extension chat in a visible Chrome. Watched live.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 1 --llm-cost-ceiling-usd 1`, normal guards and no overrides.

## Result and distance reached

Ended `achieved` with 0 rows stored and 0 shown, 8 live steps, 10 model calls, 69% of input from cache, $0.0178, 114 s. Every act landed once: batteries 1 to 3 by two Increase presses, the descaler added once from its own product page (`cart:B0BAAA48CT:own` +2, `cart:B0TWDESC04:own` +1), nothing else moved. The judge (0020) said the request was met. The Lab scored it wrong because no rows were stored: the task asks for the cart as a table.

## What happened

Haiku went home, opened the cart, pressed Increase twice, opened the descaler's product page, pressed Add to Cart, then Go to Cart (0016-0018), and completed at 0019. It never ran a read. It wrote the table into `complete.result.answer` as markdown, from the page view, with the right three rows. That answer text is not rows: nothing was stored, and the card the person saw (answer-turn.jpg) shows the three acts, "Checked: 3 acts on the site, the model's own answer", and "I got what you asked for", but no table.

## Cause

1. The draft's checklist read the read-out "give me what is in my cart ... as a table" as an act of kind `open` (Core `instructed-acts/instruction-acts.ts:151`), and an `open` act is done by a kept step that changed something. **Lane B's own `openSaid` line caused the early tick.** Correction: an earlier version of this note said the line never appeared, and that was wrong. Lane B's worker found it in the 0003 request: "Name a1 on that step ...". At 0003 the model followed it and sent the navigation to the cart with `add: true, act: "a1"`. From 0005 on the checklist showed `a1` `done: 2`, before any read, so the model was shown every act done. The `openSaid` line and the matching way-out sentence in `actOnRead` were reverted before the next run (lane B fix log, entry 2).
2. Core accepted a completion that carried no read rows for an instruction that asks for a table. An answer written as text stood in for the rows (the card's "the model's own answer"), and nothing told the model the rows must come from a read. That breaks the person's rule that a task ends only with its result.

In runs 1-4 the cart had been reached by a navigation, which was not kept as the opener. `a1` stayed undone, and the model read the cart, which is why those runs stored rows. So this is a path that any model can take, not a Haiku quirk.

## Next

Trace and fix, in Core, how a read-out act is ticked and whether a completion with no rows for a table request is accepted. Lane B's fix log has the details. Haiku on this task is not rerun until the source changes, which the `unchanged` guard also enforces. Meanwhile job-board-save-quillmark-remote on Sonnet.
