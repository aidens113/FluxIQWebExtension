# Debug: run-mw4d2rwb-fc03c3ac

Status: Passed, both attempts. This is lane B's first job-board-save-quillmark-remote pair (t876, slot-2), and it is the toggle case: attempt 2 pressed no heart. Nothing to repair.
Source: Core efba88efa / Downstream 9ac3d6231 (lane B's act-label, guarded main-heading card rule and private lone-card words, all committed).
Task: job-board-save-quillmark-remote, unchanged, `--attempts 2`: the same words twice in one thread, with no reseed. Visible Chrome, watched live through both attempts.
Provider: Anthropic claude-sonnet-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards and no overrides.

## Result and distance reached

**Attempt 1: right.** 5 rows stored and shown, 18 live steps, 19 calls, 78% cache, $0.4641, 193 s. It saved the three Quillmark remote UK jobs once each ("saved m1", "saved g5", "saved d12"), with no unsave, and left the two jobs already saved as they were.

**Attempt 2: right.** It found "Quillmark's remote jobs saved" already done, and the site's change and activity are both empty: no heart pressed, nothing unsaved. Its path was `run_flow_then_explore`. It started from attempt 1's saved work, which the digest proves. 5 rows stored and shown, 7 live steps, 3 calls, 22% cache, $0.1000, 54 s: a fifth of attempt 1's cost.

## The chat the person saw (attempt-2/answer-turn.jpg)

"Checked: 5 rows, 3 acts on the site, against what was asked for", "Left out 3 that looked already done", "Used what I saved as far as it went, then worked out the rest", "This time 54s and $0.10. First time 3m 13s and $0.46." Then the saved line, which says "except the one that did "Step 12" (it was left out of the Flow)". That "Step N" wording and "Running this again may repeat ..." are with t869's untrue-lines worker. "Left out 3 that looked already done" is true in this attempt: the three saves were already in place.

## Next

The same pair on Haiku. Its attempt 1 failed on run-mw4b7kav-cbff03e1, before lane A's A6. The source has changed since, so the `unchanged` guard allows it.
