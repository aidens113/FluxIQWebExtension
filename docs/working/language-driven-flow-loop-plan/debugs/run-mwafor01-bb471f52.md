# Debug: run-mwafor01-bb471f52

Status: Failed, not judged. Attempt 1 never finished: it ended `waiting_for_person` for `stuck_in_a_loop` after 65 live steps and 61 calls; nothing moved for 600 s and the Lab stopped watching (`AttemptProofStuck`). Attempts 2-4 never ran. First live run of this task in answer-first.
Source: t885, Core 74949e67f, Extension 46876e60c, unchanged since run-mwaf6gnt-638d90a0.
Task: bigbox-retail-rated-delivery-towels, unchanged, `--attempts 4`, visible browser.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Instance t885-live, slot-1.

## Result and distance reached

- Cost $0.2038 (ledger), about 28 minutes.
- 0015-0022: Haiku called `complete` four times with nothing read; each was refused `nothing_to_judge` before it looked and read.
- It built a read loop over the Delivery-filtered, rating-sorted list, amended the draft several times (one amendment refused `did_not_work`), and ran the Flow.
- Judges 0062, 0073, 0097 and 0107 each said no and named what was wrong in the task's terms: sponsored listings kept, only page 1 read, then only page 2 kept.
- At the end, the chat's "What failed" said: "Only page 2 was read and kept 5 rows (4.6 to 4.5). Page 1 is on screen and shows qualifying non-sponsored Delivery packs ... not in the rows". It saved notes only and asked the person.

## Causes (worker trace, report `mvp-seal-plan/reports/live-checks-r3/paged-reads-and-next-page.md`)

1. **The result switched lists without the model being told (1d, not yet fixed).** The model re-read page 2 with a fourth condition. That correctly makes a new list, and after the judge's no that 5-row list became the result. Page 1 was never re-read with the four conditions. The model sees only what the result holds after a refusal, never that the result is now a different list from the one it built, so it kept repairing the wrong thing until the loop detector stopped it.
2. **The same class as hubs attempt 1 (1a, fixed in Core).** An exploring read whose own account says its conditions were not applied (`conditions.unfiltered`) was stored as rows and could displace earlier pages. Fixed in `answer-first/rows/found-rows.ts`.

## Next

Fix 1d at its cause (the model is told when the result changes lists), prove it provider-free, then rerun this task at `--attempts 4`.
