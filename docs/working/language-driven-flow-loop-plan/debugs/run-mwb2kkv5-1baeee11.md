# Debug: run-mwb2kkv5-1baeee11

Status: Failed. Attempt 1 ended `achieved` with all 16 right rows, in the right order. But it **delivered an extra column the person never asked for** (`link`), so the Lab scored `records` and `not_shown` wrong. The judge said yes on its first call. Attempts 2-4 did not run (a wrong attempt 1 leaves the site in no known state).
Source: t885 = dev after the integration (Core 158467bdc, Extension 5262b3cb2): fixes 18-21 plus t894 (S6 routing, optional steps passed over at once).
Task: bigbox-retail-rated-delivery-towels, unchanged, `--attempts 4`, visible browser.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Instance t885-live, slot-1.

## Result and distance reached

- Attempt 1: explore, 41 live steps, 28 calls (interpretation 1, judge 1, decisions 26), 69% cache, $0.0871, 486 s. Flow flow.c4afa2fc.
- **Rows:** all 16 match the oracle exactly in name, price, rating and order (`qualification/rated-delivery-towels.ts`). The organic Loftwell Select-A-Size row is kept; the left-out evidence fixes hold. The judge said yes at once (0074), with no false "sponsored" doubt this time.
- **Columns:** the answer holds `name, price, rating, link`. The instruction asks "with name, price and rating".
- Note 0075: "A saved read drops a column it was written with that nothing uses, because its declared columns leave it out: link." So Core narrows the **saved Flow's** read to the declared columns, but the answer delivered to the person, and shown in the chat, keeps the extra column.
- The judge saw `columns: name, price, rating, link` and did not object.

## Where attempt 1's time went (facts for the speed lanes)

Wall time 490 s (Lab speed lines, `attempt-report.txt`). The three largest contributors:
1. **Model decisions, 386.7 s (79%)**: 26 calls, about 14.9 s each, with 336,561 uncached input tokens. Time to first token is not logged.
2. **Browser, 68.5 s**: 38.5 s of action and 30.0 s of overhead over 34 steps.
   - `dom-extract_list` ×11: 2.4 s each (`page.extract_list` 1.76 s, `send.extract_list` 2.0 s).
   - `dom-next_page` ×8: 2.0 s each (`send.capture_snapshot` 0.78 s of overhead).
   - `dom-select` ×2: 6.0 s each (`page.select` 4.4 s; the sort lands on the site's self-clearing robot check, which is waited out).
3. **Judge, 21.9 s** (1 call).
Then gaps 8.9 s, interpretation 3.1 s, other tools 1.2 s.

## Cause (traced; report `mvp-seal-plan/reports/live-checks-r3/named-columns-answer.md`)

The rows came from replayed read 0066, whose record output declared `name, price, rating, link`. The replay builds its record output without the person's named columns (`runtime/llm/node-tools/replay/replay.ts:266-289`, unlike the saved Flow's assembly at `boot/authoring/normalise.ts:121`). The answer's row sink is created with no instruction text (`attempt/run-attempt.ts:163`), so it never knew the named columns. Its read-back, which feeds both the chat and the judge, therefore kept `link`.

## Earlier reading

The answer's result is built from the read as the model made it, not from the columns the person named. Core already knows the declared columns at save time (0075). The delivered result and its shown table should use the same set. Whether the judge should be told which columns the person named is part of the trace.

## Next

Fix where the answer's columns are set (the person's named columns win, as at save), with a test. Prove it provider-free, then rerun at `--attempts 4`.
