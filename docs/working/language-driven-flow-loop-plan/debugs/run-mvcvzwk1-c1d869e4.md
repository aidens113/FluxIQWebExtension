# Debug: run-mvcvzwk1-c1d869e4

- Instance: bf-slot-3, task `social-network-feed-recent-group-posts`, authoring mode `project`, 2026-10-17 UTC,
  lane tree `fxwork/t566` (downstream `5e59a563`, Core `76d66fe8`). Steps: 103 (`C:/Users/osrs_/FluxStuff/lab-runs/2026-10-17/run-mvcvzwk1-c1d869e4/steps`). LLM calls: 55.
- Verdict: **failed** (`runtime.behavior`), no Flow created; the build stopped at its time limit (build 1,502 s,
  `build end status=draft`). Billed $0.076 of $0.25 (supervisor $0.016, builder $0.059). Largest decision input
  82,233 tokens. Duration 26.6 min.
- Shape: 46 decide, 8 judge, 11 run_node, 10 submit_subflow, 7 test_subflow, 5 detect_repeating_structure; one
  brief, six trials, no whole-Flow pass.

## How far it got

The supervisor read the task, planned one part and dispatched it (steps 2-14, after three malformed supervisor
answers, steps 5-10, `llm.provider_malformed_response reply=content_mismatched`, $0.0016). The builder explored the
feed, detected the post list and built a Flow: open the feed, dismiss three overlays, `extract_list` with a group
condition, `repeat while: next` over a paging step, `done when` the "You're all caught up" heading.

## Why it failed

1. **`web.dom.next_page` ended a scroll-loaded feed after page 1.** Trials 1, 2, 3 and 5 (steps 47, 53, 69, 95)
   used `web.dom.next_page {list: extraction.2}`. Core's read record says `pagesRead: 1, stop: ended`, "the step
   that moves it on found no page after page 1". The home feed loads its next batch of five on a window scroll
   (`client/feed-script.ts`: sentinel within 600 px of the viewport bottom, 350 ms), which the node's description
   says it handles ("Next, a numbered page, Load more or scrolling"). Core's `pagingNote` then tells both judges a
   reading that says there are more pages is mistaken, so every judge was steered to blame the condition, not the
   paging. Every trial stored one row (Elena's post); the builder rewrote the condition four times.
2. **An invalid `web.dom.scroll` passed submit and ran as a no-op 40 times.** Revisions 6 and 7 (steps 81, 101)
   replaced paging with `node: web.dom.scroll` / `scroll: {"until":"stopsGrowing"}` and `repeat most: 40`. The
   schema (`domain/src/actions/schemas.ts:100-110`) requires `mode` (`by|toElement|untilStable`) and has no
   `until`; submit returned ok. The trial screenshots show the feed at its top on "page 19", so the scroll appears
   to fall back to the legacy absolute move (to 0,0). Each loop read the same five posts; trials at steps 83 and 85
   each ran about 500 s and ended `subflow.trial_execution_failed`, 16.5 of the build's 25 minutes.
3. **The trial failure feedback named no failing step** (`candidate.trial_port_failed`, steps 83, 85): it told the
   builder to "read the feedback for the step that failed" but carried none, so it retested the same revision
   unchanged and lost another 8 minutes. The third test (step 103) threw `TimeoutError` at the build deadline.

Not reached because of the above: the date filter (on or after 19 September; the builder never conditioned on
`posted`), full text behind See more, and the duplicate recap.

## UI review (chat cards)

Plan, Read list and Scroll cards are clear and the running test names its step and page ("Running step 8 of 8:
Scroll the feed further down on page 19"), which faithfully showed the stuck loop. The end card says "reached its
time limit of 30 minutes" while the build ran 25 minutes, and three consecutive messages repeat that nothing was
put into the Flow and the draft was kept ("A whole Flow was assembled and never tested...", "It was never
test-run from the start...", "Saved candidate draft. Verification pending..."). The person needs it once.

## Next

Fix 1 (next_page on scroll-loaded lists) and 2 (refuse invalid action parameters at submit) structurally, with
tests beside each; consider 3. Rerun on the changed source.
