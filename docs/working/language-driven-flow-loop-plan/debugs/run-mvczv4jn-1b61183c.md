# Debug: run-mvczv4jn-1b61183c

- Instance: bf-slot-3, task `social-network-feed-recent-group-posts`, authoring mode `project`, 2026-10-17 UTC,
  lane tree `fxwork/t566` (downstream `fb3919e2` + lane-3 fixes 1-3 uncommitted, Core `76d66fe8` + fixes 2-3, dist
  rebuilt). Steps: 135 (`C:/Users/osrs_/FluxStuff/lab-runs/2026-10-17/run-mvczv4jn-1b61183c/steps`). LLM calls: 74.
- Verdict: **failed** (`runtime.behavior`), no Flow created. Billed $0.091 of $0.25 (supervisor $0.038, builder
  $0.036, repair $0.017). Largest decision input 80,118 tokens. Duration 20.7 min.
- Shape: 59 decide, 14 judge, 15 submit_subflow, 7 test_subflow; brief 1 (builder) then brief 2 (repair); both
  ended in a run of `llm_evidence_loop.repeat_refused` identical submits.

## How far it got

Fix 1 holds: every trial paged the home feed by scroll to the end (3 pages, 71 items, "No more posts to show"),
read 34 distinct rows and deduped 8. Fix 2 was not exercised (no invalid parameter written). The first trial
stored 5 rows from the three member groups; the judges asked for the date clause; every later revision added a
`matches` date condition on `posted` that rejected all 71 rows.

## Why it failed

**A positional column key means different things in different item templates.** The detection
(step 21, `web.detect_repeating_structure`) keyed the timestamp column from the first item, a personal post:
`div... > div.x1egldpr... > span:1 > a...` ("link: '1h'"). In a group post the meta line is
`author · time · audience` (`apps/scenario-lab/src/scenarios/social-network-feed/markup/unit.ts` `postHead`), so the
same position is the author link. The read stored `posted: Elena Sokolova` for every group post (judge request,
step 40, `sampleRows`), and the `author` key (`h3 > span > strong > a`, coverage 0.6) exists only in personal
posts, so group rows had no author. The date pattern `(19|2[0-9]|30) September 2026|...` is an unanchored search
(`domain/src/actions/extraction/condition-match.ts:151`) and was right for the site's dates; it rejected every row
because it was tested against author names. The judges, shown the page, kept saying the pattern missed "Monday 21
September 2026 at 05:55" and never that the column held names, so the builder rewrote the pattern until the loop
guard refused identical submits.

Two further gaps the run shows, not yet reached: the full date exists only as the time link's `aria-label`
(`timeLink`), which the detection does not offer as a column (it offers the visible "1h"); and `text` is the
shortened post ("… See more"), which the request excludes.

Lane 1 is changing the same detection and field files (`content/extraction/{detect-structure,infer-fields,
field-reader,field-spec}.ts`, `domain/src/actions/extraction/*`), so this cause was sent to the coordinator to route
rather than fixed in parallel here.

## UI review (chat cards)

The repair brief card states the asked condition in full ("keep only posts from groups the person is a member of
dated on or after Saturday 19 September 2026") with its allowance ($0.15), and the progress line ("Fixing your Flow
- Opening where the Flow starts") is accurate. No new card defect beyond run 1's (lane 4 owns the failed-build
wording).

## Next

Route the template-dependent column cause (and the aria-label column gap); move to `hide-suggested-posts` meanwhile.
This task has failed on two different causes (paging, template columns).
