# Debug: run-mwc6ut8u-52e3c1b3

Status: Failed, not judged. Breadth task 4. Attempt 1 stopped at `waiting_for_person` for `stuck_in_a_loop` after 91 live steps and 119 calls, and the proof stopped waiting after 600 s with nothing moving. No attempt ended, so no replay ran.
Source: t885 = dev 2d78a6bb2 (extension) / 09a129607 (Core).
Task: company-website-saturday-certificate, unchanged, `--attempts 4`, visible browser. Lab run queued through `heavy-slot.mjs run t885 --priority`.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Instance t885-live.
Spend: $0.3111 (ledger). The ask came with $4.69 of the $5 purse left.

## What happened

The model read the slot states correctly by step 34: the page view marks a taken slot `disabled`. Its own summaries at steps 216 and 243 name exactly the oracle's two rows, 2026-10-03 11:30 and 2026-10-17 09:00. But a result is only what a read returned, and no read in this run could hold those rows. The full trace, with file:line evidence, is `docs/working/mvp-seal-plan/reports/live-checks-r3/saturday-certificate-loop.md`.

## Root causes

| # | Class | Cause |
| --- | --- | --- |
| R1 | extension | A read has no column for a control's disabled state. State columns cover only aria-pressed, aria-checked and aria-selected (`content/extraction/item-mark/state-sources.ts:28`). |
| R2 | extension + domain | The calendar reads only as one row per day, with slot positions as columns. It is never read as one row per slot with its day's heading as a column. Hence the day labels and columns a-d. |
| R3 | Core | Each re-detection mints a new handle, and the dataset id includes the handle (`answer-first/rows/dataset-of-read.ts:31-39`). So each week's read replaced the result instead of adding to it. |
| R4 | extension, inferred | The detected pager was the booking wizard's Next button. The fixture's "Later" control is a plain div that is never a pager candidate (`detect-pagination.ts:71`, `:265`). |
| R5 | extension | next_page said "moved" when the widget redrew the same week (`page-advance/list-change.ts:175-181`; steps 109 and 150). |
| R6 | Core | The repeat refusals (`same_result`) did not point to the earlier view, which had left the context. The model got past them by changing `timeoutMs` 13 times, because a timing parameter is part of the key (`repeat-guard/outcomes.ts:491,625`). |
| R7 | Core | The last rung of the ladder parked the task with a question that is not for the person (`completion-refused-again.ts:56-64`, `stuck-ask.ts:11`). That ends the task with neither its result nor its budget gone. It reverses answer-first D14 step 4, so the lead must confirm it with the user. |
| S1 | web page view, secondary | Fold rule F3 hid the wizard's error line (`page-view/fragment-merge.ts:18-19`). |

No fixture or task defect: the year is on the page, and the oracle matches `slots.ts`.

## Next

Lane t903 landed reads, detection, reveal and load-more changes (dev c8379f323). R1, R2, R4 and R5 are rechecked against them after dev is merged in. Then the remaining causes are fixed in that order: R3, R6, then R7 once the lead confirms it. The honest path is proved provider-free before the task is rerun live.
