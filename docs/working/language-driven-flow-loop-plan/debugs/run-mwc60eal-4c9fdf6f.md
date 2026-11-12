# Debug: run-mwc60eal-4c9fdf6f

Status: Passed, 4 of 4 right. Breadth task 3. Sonnet saved all four Mark II sellers whatever the listing called the model, read the Saved sellers list back, and the saved Flow replayed with no decisions. Replays 3 and 4 stood on their record with no model call.
Source: t885 = dev 2d78a6bb2 (extension) / 09a129607 (Core). This includes the write-time loop refusal, the assemblable Flow ranking, the repair reporting and the judge's whole looks.
Task: auction-marketplace-save-mark-ii-sellers, unchanged, `--attempts 4`, visible browser. Lab run queued through `heavy-slot.mjs run t885 --priority`.
Provider: Anthropic claude-sonnet-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Instance t885-live.

## Per attempt

| Attempt | Verdict | Path | Flow | Continuation | Calls (interp / judge / decisions) | Time | S9 decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | right, 4 rows | explore | flow.59b8c33b | - | 36 (1/1/34) | 625 s | - |
| 2 | right, 4 rows | run_flow | flow.59b8c33b | held (from 1) | 1 (0/1/0) | 74 s | judged: deviated, `flow_not_proven` (the first replay proves the Flow) |
| 3 | right, 4 rows | run_flow | flow.59b8c33b | held (from 2) | 0 | 46 s | stood on its record, no judge |
| 4 | right, 4 rows | run_flow | flow.59b8c33b | held (from 3) | 0 | 44 s | stood on its record, no judge |

Whole run $1.9920 (ledger: attempt 1 $1.9366, attempt 2 $0.0554), exit 0.

## The toggle held

Save seller is a toggle: a second press forgets the seller. Attempts 2-4 each started with all four sellers already saved, with no reseed. Each attempt's `site.json` shows `change: {}` and `activity: []`, so the replay pressed no toggle a second time. Each one read the four saved sellers back. The robot check came up in attempt 1 (`passed challenge` in the site activity) and was passed in place.

## Defects seen in attempt 1 (to trace)

1. **A whole-Flow test that cannot start on a no-reset task.** At steps 43 and 56 the harness's own rerun (`rerun.5.place`, `rerun.9.place`, input `replay: "reset"`) was refused `answer_first.no_reset` ("Nothing is put back on this task"). The rerun's outcome was `llm_evidence_loop.rerun_place_unreachable`. The model was given the refusal and carried on by hand; it finally ran the Flow itself with `core.run_flow` at step 65. Why the rerun asks for a reset here, and what it should do instead (judge the change from the recorded before-state, per the 2026-10-27 rule), is to be traced.
2. **The repeat guard matched a model call to the harness's rerun.** At steps 57 and 59 the model's `web.output.browser-navigate` to the 96-per-page list (`add: true`) was refused `llm_evidence_loop.repeat_refused`, `sameAsCall: "rerun.9"`. That earlier call is the failed reset rerun, whose input differs. Which identity the guard compared is to be traced.
3. Step 26 (`target_unobserved`, `malformed_handle` in `extractList.where.0.matches`) was a model input error. Its refusal named the right form, and the model recovered at once. No defect.

## Next

Trace 1 and 2 to their root. Breadth task 4 (company-website-saturday-certificate, Haiku).
