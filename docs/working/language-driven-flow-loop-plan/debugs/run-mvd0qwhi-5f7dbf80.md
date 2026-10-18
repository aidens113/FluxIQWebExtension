# Debug: run-mvd0qwhi-5f7dbf80

- Instance: bf-slot-3, task `social-network-feed-hide-suggested-posts`, authoring mode `project`, 2026-10-17 UTC,
  lane tree `fxwork/t566` (downstream `fb3919e2` + lane-3 fixes 1-3, Core `76d66fe8` + fixes 2-3, dist rebuilt).
  Steps: 253 (`C:/Users/osrs_/FluxStuff/lab-runs/2026-10-17/run-mvd0qwhi-5f7dbf80/steps`). LLM calls: 126.
- Verdict: **failed** (`runtime.behavior`), no Flow created; build ended `status=draft` at 1,016 s. Billed $0.114
  of $0.25 (builder $0.083, repair $0.027, supervisor $0.004). Largest decision input 87,168 tokens. 18.6 min.
- Shape: 125 decide, 14 submit_subflow, 9 test_subflow (all `execution_failed` or refused), 13
  detect_repeating_structure plus 24 `already_answered` refusals of it; briefs 1 (builder), 2 (repair), 3 (reset).

## How far it got

The builder read the feed's post list (5 rows on page 1), then a `repeat over: posts` click on the row's "Hide
post" control (`target: t701`), a `wait_for_text $row.text`, and `next_page` paging. Pass 1 hid the first post;
every trial then stopped on pass 2.

## Why it failed

**A row-bound click resolved on pass 1 and was ambiguous on pass 2.** Trial feedback (step 79, and fix 3's new
`stoppedBy`): step 17 "hide the suggested post" failed `web.target.ambiguous` ("More than one control matched the
step's control, and none could be chosen") on its second run in the repeat. Hiding replaces the article's children
with a "Hidden ... Undo" bar while the article stays in the list
(`apps/scenario-lab/src/scenarios/social-network-feed/client/unit-script.ts:100-105`), so the second pass runs on a
list whose first item changed shape. Every later revision kept the same row-bound click and failed the same way;
the builder spent 24 calls on refused repeat structure detections and 4 on refused identical submits.

Model error beside it, which the judges would have caught: the read had no condition for "Suggested for you", so
the loop would hide friends' posts as well.

Fix 3 is confirmed live: the execution-failed feedback named the step, its pass and the failure code.

## UI review (chat cards)

Narration cards say what each look was for ("I'll read the feed rows to find a per-row hide control the loop can
target unambiguous[ly]"), and refused repeats show as "This is exactly the step it had already tried, so it was not
done again", which is honest but appeared many times in a row with no sign of what the builder would do instead.

## Next

Root-cause the pass-2 ambiguity of row-bound clicks after an act changes the row (worker), then rerun.
