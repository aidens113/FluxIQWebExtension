# run-mwy3btww-31d32e0d: bigbox new-store cheapest towels, right item at step 20, then 7 checks lost

Lane: t1015 `paid-bigbox`. Task: `bigbox-retail/bigbox-retail-new-store-cheapest-towels`, answer-first, attempt 1 of 4,
visible Chrome, run watcher on. fluxiq 0.54.30.
Provider: Anthropic `claude-sonnet-5-5` for build and judge. Cost: $3.16 billed, 538 s, 73 calls (interpretation 1,
judge 14, decisions 58).
Step files: `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-26/run-mwy3btww-31d32e0d/steps/`. Debugged offline from the
step files, the Lab log and the attempt bundle. No live or paid run was used. Full audit:
`docs/working/page-diff-delivery-plan/reports/run-mwy3btww-audit.md`.

## Attempt 1

- **Verdict:** a person stopped it (`stopped_by_person`) at step 0151. The oracle did not run. The Lab printed "0 rows
  stored, 0 shown".
- **Path:** the model got the task right by step 0020, about $0.35 in.
  - It set the store (0007) and searched (0009), filtered to Pickup (0011) and sorted by price, low to high (0017).
  - At 0019 it read the first card, "$1.28", "4.5", "Pickup today", and added the single roll (0020).
  - It read the cart's 2 rows (0026). The site's change confirms it: `cart:5510204:pickup +1`, store 2291 to 4419.
- **The other 131 steps:** 7 completion checks were refused (unsure 6 times, no once), and then the person stopped
  the run.

## Why

1. **Every judge that saw the evidence answered in a form Core cannot read** (regression from t1038, fluxiq 0.54.20).
   - The decider now goes as tools. So a continuing judge keeps the decider's tools and answers in plain text
     (`models/providers/anthropic/continuation.ts:31-38`, `llm/anthropic/provider.ts:117`).
   - All 7 continuing judges were unreadable:
     - 4 put prose before the JSON (`reply/case.ts:12`, `content_prefixed`): 0034, 0077, 0104, 0130;
     - 3 called the `complete` tool (`messages.ts:142`, `tool_call_unexpected`): 0039, 0060, 0069.
   - 6 of them said yes. 0034, 0077 and 0104 carried `"answersRequest":"yes"`. The other three said it in prose, for
     example 0039: "rated 4.5 (938 reviews), and it shows 'Pickup today'".
   - In the previous live run, before t1038, the judge answered in JSON text and was read.
2. **The judge it falls back to cannot see the evidence.** After one unreadable reply, the check is asked on its own
   request (`result-verification/unreadable-asks/asks.ts:73-76`).
   - That request has no page views (`captureOmitted: true`).
   - It has no rows from the candidate reads (c15 at 0082, c50 at 0100). The framework draft drops a read that is not
     the result (`flow-authoring/draft/compose/compose.ts`, rule 2, `not_the_result`, t1037). The judge's working reads
     come only from draft steps (`answer-first/result-feed/feed.ts:272`, t1048).
   - Each fresh judge request held "Pickup today" 0 times and "4.5" once (the instruction). Each answered that the
     rating and pickup were not shown, for example 0106: "The 15-row result list was read but its rows and ratings
     are not shown".
3. **The result was emptied just before the Stop** (t1037 edits).
   - At 0144 the model asked for step 36, a second cart read, to be kept and made the result. `keep` was refused as a
     `second_copy` of step 13, but `result` was still applied. The `result` edit has no second-copy check
     (`draft/amendment/apply.ts:182-187` against `:207-211`; `edits/result.ts:9-15`).
   - Step 36 came back as "a new read step" with no pages, so the result went from 2 rows to 0, with
     `answer_first.processing_schema_missing` (`result-feed/stage.ts:66`).
   - At the Stop, a result in `missing-evidence` is withheld (`attempt/ending.ts:51-55`). So the result kept no rows.
     The Lab read none (`attempt-lane/live/attempt/stage.ts:16-18`) and the chat drew no table
     (`answer-turn.json`: `"columns": [], "rows": []`).
   - From 0027 to 0143 the result held the right 2 cart rows. A Stop then would have kept them.
4. **The loop around the refusals.**
   - 4 `same_evidence` refusals and 5 round restarts (0089, 0113, 0120, 0125, 0140). Each restart wiped the decider's
     evidence, so it recalled c50 four times (0116, 0123, 0128, 0143), which set off the watcher's `repeated_call`.
   - Recalled rows sit after the last cache mark, so the next continuing judge (0130) did not get them.

The flow chart: the Lab's in-attempt chart and its end-of-run chart both read `<attempt bundle>/steps`. A live run
writes its steps under `lab-runs/` (`run-attempt-command.ts:191`, `:258`, `:343`; `flow-chart/read/chart-flow.ts:46`).
So every live run since t1039 says "none written, the attempt never got a draft of a Flow". This is not caused by the
Stop.

## Next

- Fix 1, 2 and 3 above (audit findings F1 to F4).
- Prove them offline on this recording before any live run:
  - 0034's, 0077's and 0104's replies read as a yes;
  - a fallback judge built from these steps carries the c50 rows with "4.5" and "Pickup today";
  - 0144's amendment leaves the result at step 13 with 2 rows.
- Then rerun this task live on Sonnet, `--attempts 4`, with the watcher. Accept it only if attempt 1 adds the $1.28
  roll, the first check accepts it, the oracle passes, and attempts 2 to 4 run the saved Flow.
