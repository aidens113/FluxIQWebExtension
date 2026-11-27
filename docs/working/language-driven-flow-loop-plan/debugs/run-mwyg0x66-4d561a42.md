# run-mwyg0x66-4d561a42: kestrel auctions, stopped by the lead, repeating after loop handling had failed

Lane: `live-lane-2` (tree `fxwork/t1059-live-lane-2`). Task: `auction-marketplace/auction-marketplace-kestrel-auctions`,
answer-first, attempt 1 of 4, visible Chrome, run watcher on. fluxiq 0.54.32.
Provider: Anthropic `claude-sonnet-5-5`. Cost: $2.44 over 39 calls when the watcher's last alert fired (step 0078);
the step files record 47 paid calls and $3.31 by step 0095. The lead stopped the run during step 0147, a replay.
Step files: `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-26/run-mwyg0x66-4d561a42/steps/`. Debugged offline from the
step files, the watcher's alerts (`watch-alerts.ndjson`) and the code at 0.54.32 (Core worktree `fxwork/t1070/!FluxIQ`).
No live or paid run was used. Fix: t1070 (report `docs/working/page-diff-delivery-plan/reports/t1070.md` in the t1070 tree).

## What happened

| Steps | Calls | Cost | What it did |
| --- | --- | --- | --- |
| 0001-0018 | 9 | $0.39 | Searched, filtered to auctions, found the list (`extraction.3`), read page 1 with the handle's own keys (`link_text`, `price`, `text_2` ... `text_9`). |
| 0019-0062 | 22 | $1.40 | Declared the result processing 15 times. 14 were refused with `said: "record_output.process_invalid_condition. "` and nothing else (0020, 0024, 0030, 0034, 0036, 0038, 0040, 0042, 0044, 0049, 0051, 0055, 0057, 0061). Loop handling fired at 0045 (`no_progress` x12) and the model chose `change_approach` (0047). It went on sending the same kind of declaration. |
| 0063-0067 | 2 | $0.17 | Without `(?i)` the declaration was taken. 0063 was then withheld for missing evidence (below), so the model wrote the price bound as negative-lookahead regexes over the price text (0065, 0067). |
| 0068-0094 | 13 | $1.27 | The completion was refused `answer_first.not_asked_table` (0071), because the result's columns were the handle's keys, not "title, price, bids, postage". The model re-read the list naming those columns (0081), clicked page link "1" to get back to page 1 (0083), made the new read the result and repeated it through a Next page step (0089-0092), then declared the processing again (0094). |
| 0095-0147 | 1 | $0.08 | `core.run_flow` (0095) replayed the read, the "1" click and Next page 17 times, without end (0096-0146). The lead stopped it in pass 18 (0147). |

The watcher raised `approach_unchanged` at 0059 and 0077 and `no_act_after_loop` at 0062 and 0078.

## Why

1. **Every refusal named only its code, so the model had nothing to correct** (0020-0061, 14 calls, most of $1.40).
   - The tool answers through the answer-first data stage (`answer-first/result-feed/stage.ts`, `amend`). It
     printed `parsed.issues.join(", ")` and the unbound references, and the contract parser
     (`packages/contracts/src/record-sets/process/parse-processing.ts`) returned codes only. A condition the
     condition parser refused was `null`, and nothing said which one or why.
   - Every refused declaration had a `matches` beginning `(?i)`, which is PCRE's inline flag for ignoring case.
     JavaScript's `RegExp` refuses it. Checked offline on 0061's patterns with Node 22.23: `where[2]`
     `(?i)^(new listing)?kestrel 35\b` gives "Invalid regular expression: ...: Invalid group", and so does
     `where[3]`. The pattern reader (`process/condition/holds.ts`, `automationStudioRecordConditionPattern`)
     catches the `SyntaxError` and returns `undefined`.
   - 13 of the 14 also had a pattern longer than the 200 characters a pattern may have (209 to 286). 0061's
     `where[3]` is 230 characters, so it was refused for its length too.
   - Nothing told the model the flavour. The tool's description says `matches` and nothing more. The record-output
     help said "matches a valid regex".
   - 0055 wrote `^(?i)Kestrel 35(...)`, the same flag after the anchor. 0059 left `matches` out and was taken.
     0063 dropped `(?i)` and was taken. So the model found the cause only by elimination.
2. **Loop detection could not help** (0045-0047). The steer said the model was repeating itself, and the model
   chose `change_approach`. It had no information to change on, so the next 6 and then 12 calls stayed the same
   kind (watcher `approach_unchanged`). The steer worked as designed. The missing information was the defect.
3. **A derived column missing on some rows withheld the whole `anyOf`** (0063).
   - `gbp` was derived from `price` with `^£([0-9.]+)$`, so a listing priced in another currency had no `gbp`.
   - The automatic stage reported `answer_first.processing_evidence_missing` for `anyOf[0] gbp from price
     (missing)` on rows 7, 11 and 20. The other group, `approx_gbp lessThan 150`, could have decided those rows.
   - The model then wrote the bound as regexes over the price text (0065: `^(?!£1[5-9][0-9]\.|...)`). That is the
     grammar used as a programming language, which the data-layer rule (AGENTS.md, "stays simple") warns against.
   - Not traced further here, and not changed by t1070: whether a missing derived value in one `anyOf` group should
     count as missing evidence when another group can decide the row (`process/readiness/`).
4. **The result was not the asked table** (0071), as in `run-mwyfx9fs-06a170bf`. The first read named no columns,
   so its rows carried the handle's keys. Renaming meant re-reading, re-pointing the result and declaring the
   processing again (0081-0094, 13 calls).
5. **The final replay looped** (0096-0146). The page-"1" click (0083), made to return to page 1 before the
   re-read, was left inside the repeated range: read (step 11), click "1" (`t1037`, `link "1" current`), then
   Next page (step 15). Each pass went back to page 1, so Next page never ended. Reasoned from the step files
   (0097 runs on `_pgn=2`, 0098 and 0101 on page 1). The draft-compose code that kept the click inside the range
   is not traced here. It belongs to t1073's area.

## Fixed in t1070

- The contract parser now gives `refusals` beside its codes: each refused part (`where[3]`, `anyOf[1][0]`,
  `derive[0]`, `compare[0]`, `sort[1]` ...), its field and operator, and why. A pattern's reason quotes only
  JavaScript's own reason ("Invalid group"), never the pattern. A field id the schema lacks is listed with the
  fields it stores. Every part is read, so one refusal names every broken part.
- The tool's refusal (`stage.ts` `amend`, the binding readiness message, and the legacy `answer.ts`) and a refused
  plan's record output now say those sentences.
- A leading `(?i)`, `(?m)` or `(?s)`, with or without a `^` before it, is read as the JavaScript flag of the same
  letter. Any other inline group is refused with a sentence saying so.
- The tool's description and the record-output help now say the patterns are JavaScript's, how long one may be,
  and that a list of patterns keeps a row when any one matches.
- Proven offline with tests built from 0061's exact declaration. Its `where[2]` is now accepted. Its `where[3]` is
  refused as `where[3] (field "link_text", matches): 230 characters, over the 200 a pattern may have. Write a list
  of shorter patterns instead ...`. Before the fix the same call answered only the code (`0061/result.json`).

## Next

- Causes 3, 4 and 5 are open, and none is in t1070's paths. Cause 5 needs a draft-compose fix (t1073): a
  navigation step taken to get back to a list's first page must not stay inside that list's repeat. Cause 4 is
  the same as in the crossborder debug.
- Rerun this task only after cause 5 is fixed and proven offline on this recording: the draft as it stood at
  0094 must replay the two pages once and stop.
