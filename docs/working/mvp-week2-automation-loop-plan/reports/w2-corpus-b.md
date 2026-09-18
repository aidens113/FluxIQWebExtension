# w2-corpus-b: live creation tasks on Lab instance corpus-b

Replaces the earlier blocked report for this slice. The Core staleness guard now
reports `quiet` (Core `dist` newest 2026-09-18T05:40:33Z), and every run below
used real DeepSeek (`deepseek-chat`) on the isolated target. No source, test,
Core build or git history was touched. `FLUXIQ_LAB_ALLOW_STALE_CORE` was never set.

## Outcome

Done as a measurement. **0 of 9 tasks succeeded.** Flows were built for 8 of the 9.
Every property Flow that ran to completion **reported success while the oracle
failed it** (5 of 5). The known "reports success on the wrong table" defect is
still present, and in this batch every one of those runs was wrong.

Headline findings, in plain terms:

1. **Every property extraction matched 0 records.** In every run, some required
   fields came back empty (for example 41 of 50 on the first page), so not one
   home's row equals the expected row. The Lab keeps counts only, so which
   field is missing is not recorded. The first missing-field record was record 1
   (3 fields missing) on the first page, record 1 (2 fields) on the agent-withheld
   variant, and record 3 (3 fields) on Kelford.
2. **Kelford-homes collected the right homes across pages:** 57 of 57, where the
   site shows 10 per page. The Flow chose Kelford, pressed Search, and paged to the
   end. The pages it followed are not observable on this lane
   (`pagesFollowed: null`, `unjudged: ["pages"]`), but 57 records from a 10-per-page
   list requires 6 pages. The count and filter are right; the row values are not.
3. **Renamed pagination stopped at page one** (10 of 57), the known failure.
4. **Cheapest-home acted correctly but over-collected.** It set area, bedrooms and
   sort, pressed Search, then extracted the whole first page (10 records, expected
   1). The one compared record carried all 5 required fields and still did not
   match.
5. **Home-facts never built a Flow**, twice. FluxIQ's Flow-build endpoint returned
   HTTP 400 with a diagnostic body the Lab's parser rejects, so only the status
   survived (`lab.generation_http_400`, `providerInvocation: unknown`). It shows
   as 1 call, no tokens, $0. Builds lasted 34.6 s and 93.5 s, which is too long
   for a purely local refusal, so **spend was probably incurred and not recorded**.
6. **Last-page reached the last page, then failed on a superfluous "next".** Three-bed
   Kelford is 19 homes, 2 pages. Executed: navigate, select, select, click, click,
   click(failed `target_not_found` on `[data-testid="next-page"]`, "1 control(s) of
   the same family are on the page"). Inferred, not observed: the second click
   reached page 2 and the Flow then pressed a next that no longer exists.
7. **Both inbox backlog runs were stopped at their first action by the reply
   dialog.** The select landed on `div[data-testid="reply-scrim"]` ("a modal
   dialog is open over the page") → `user_intervention_required`. That dialog
   opens only when a row's Reply control is pressed (`client-script.ts:255,322`),
   and nothing the Flow ran presses one. Most likely (unverified) the build-time
   exploration left it open: both builds used `web.reveal_safe`. Load-more
   behaviour was never reached, so it is unmeasured.

## Per-task results

Tokens, cost and calls are from `snapshots/live-llm.json` `observed.accounting`.
"Rep/Orc" is `reportedVerdict` / `oracleVerdict` from `evaluation.json`.

| Task | Run | Exp / Obs / Matched | Req. fields present | Flow action types (built) | Executed | Rep / Orc | Calls, tokens, $ | Failure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| newest-homes (probe) | run-mu6j6drm-8a228da2 | 10 / 10 / 0 | 41/50 | navigate 1, extract_list 1 | navigate, extract_list | **passed / failed DISAGREE** | 7, 57 712, 0.0262 | record 1 missing 3 required fields |
| newest-homes-agent-withheld | run-mu6jbah9-d069e855 | 10 / 10 / 0 | 34/40 | navigate 1, extract_list 1 | navigate, extract_list | **passed / failed DISAGREE** | 3, 22 905, 0.0105 | record 1 missing 2 required fields |
| kelford-homes | run-mu6jdfb7-fad34ee8 | 57 / 57 / 0 (expectedPages 6, pagesFollowed null) | 267/285 | navigate 1, select 1, click 1, extract_list 1 | navigate, select, click, extract_list | **passed / failed DISAGREE** | 4, 30 507, 0.0140 | record 3 missing 3 required fields |
| kelford-homes-renamed-pagination | run-mu6jg1bu-ad9d13fa | 57 / 10 / 0 of 10 compared (pagesFollowed null) | 47/50 | navigate 1, select 1, click 1, extract_list 1 | navigate, select, click, extract_list | **passed / failed DISAGREE** | 5, 38 511, 0.0176 | yielded 10, expected 57 (stopped at page one) |
| cheapest-home | run-mu6jit0f-d9698213 | 1 / 10 / 0 of 1 compared | 5/5 | navigate 1, select 3, click 1, extract_list 1 | navigate, select ×3, click, extract_list | **passed / failed DISAGREE** | 6, 45 237, 0.0206 | yielded 10, expected 1 |
| home-facts | run-mu6jlj95-dcc457b8 | 1 / — / — (not measured) | — | no Flow built | none | null / null | 1, not reported, $0 reported | `lab.generation_http_400`, build 34.6 s |
| home-facts (rerun, alone) | run-mu6jwdm1-3cf56f93 | 1 / — / — (not measured) | — | no Flow built | none | null / null | 1, not reported, $0 reported | `lab.generation_http_400`, build 93.5 s |
| last-page (playback goal) | run-mu6jnax5-98780123 | n/a | n/a | navigate 1, select 2, click 3, extract_list 1 | navigate, select ×2, click ×2, click (failed) | failed / failed | 5, 30 218, 0.0139 | `target_not_found` `web.target.not_found` on next-page |
| social-inbox-unanswered-backlog | run-mu6jq4ev-8dc0aeba | 28 (2 pages) / 0 / 0 (not_run) | 0/0 | navigate 1, select 3, click 1, extract_list 1 | navigate, select (blocked) | failed / failed | 5, 38 627, 0.0180 | `user_intervention_required`: reply-scrim covers target |
| social-inbox-unanswered-backlog-quiet | run-mu6jswim-fc5f6be7 | 3 (1 page) / 0 / 0 (not_run) | 0/0 | navigate 1, select 3, click 1, extract_list 1 | navigate, select (blocked) | failed / failed | 4, 30 289, 0.0138 | same as above |

Totals: probe 7 calls, 57 712 tokens, $0.0262; main campaign
(`2026-09-18T05-44-53-303Z`) 33 calls, 236 294 tokens, $0.1085; rerun
(`2026-09-18T06-01-06-717Z`) 1 call, 0 reported, $0. **Reported total: 41 calls,
294 006 tokens, $0.1346**, which undercounts whatever the two home-facts builds
spent.

Checklist items from the brief:

- **Did Flows act?** Yes, wherever the task needed it. Kelford, renamed pagination,
  cheapest, last-page and both inbox Flows contain select and click nodes. The two
  newest-homes Flows are navigate + extract, which is what a first-page read needs.
  No Flow fell back to navigate + extract where acting was required.
- **Missing floor area never invented: not measurable here.** Expected records mark
  an unpublished floor area as `null` (`records.ts:12`), `floorArea` is an optional
  field, and a record matches only when every present value is exactly equal
  (`extraction.ts:233`). So an invented area would make its record fail. But every
  record already fails on missing required fields, and the run keeps counts only,
  so floor-area invention can be neither confirmed nor ruled out.
  `unexpectedFields` was 0 everywhere and `nonStringValues` 0.
- **Inbox load-more:** not reached. Both runs stopped before the extract step.
- **Reported vs oracle disagreed on 5 of 9 runs.** All five are "passed / failed"
  on the property extractions. Where the Flow itself failed (last-page, inbox ×2),
  both agree on failed. Home-facts has neither.
- **Locally refused calls:** none of the 1-call/0-token/$0 kind in the brief's
  sense, except that home-facts looks like one in the totals. It is a Core Flow-build
  endpoint 400 after a long build, with provider invocation unknown, which is not
  the same thing.
- **`security.redaction` false failure:** did not occur. All 9 redaction
  attestations were `passed` with 0 findings; no verdict was capped by it.
- **`ENOENT` in `domain/dist`:** did not occur. There were no RAM-fault retries
  (`ramFaults: []`) and every task finished on attempt 1.

## What changed and why

Nothing in the repository was edited. Side effects of running:

- Run folders under `test-runs/instances/corpus-b/` (the ten runs above).
- Campaign folders `test-runs/campaigns/2026-09-18T05-40-59-264Z` (probe),
  `2026-09-18T05-44-53-303Z` (main 8), `2026-09-18T06-01-06-717Z` (home-facts rerun).
- Scratch files in my scratchpad only: logs `corpus-b-probe3.log`,
  `corpus-b-main.log`, `corpus-b-homefacts-rerun.log`; the read-only summariser
  `corpus-b-summarise.mjs` and its output `corpus-b-main-summary.txt`.
- This report file, which replaces the blocked one.

## Commands run and observed results

All with `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated FLUXIQ_LAB_INSTANCE=corpus-b`
and `DEEPSEEK_API_KEY` exported from `.env.local` by the brief's one-liner. The key
was never printed; only its length (35) was checked.

1. `pnpm lab:campaign --no-build property-listings-newest-homes`. The guard reported
   `state: waiting` ("build output was written moments ago"), then `quiet` after
   4.5 s, then ran. Result: `{"tasks":1,"failed":1,"providerCalls":7,
   "reportedTokens":57712,"reportedCostUsd":0.02615888}`. `live-llm.json`:
   provider deepseek, model deepseek-chat, credential "the process environment",
   `observed.calls 7`, `accounting.totalTokens 57712`, `budgetBreaches 0`, so the
   **probe made real calls with non-zero tokens**.
2. `pnpm lab:campaign --no-build` with the 8 follow-on tasks. Guard `quiet` before
   each task. Final line: `{"tasks":8,"passed":0,"succeeded":0,"failed":8,
   "noResult":0,"judgementsPassed":0,"providerCalls":33,"reportedTokens":236294,
   "reportedCostUsd":0.10847144}`.
3. `pnpm lab:campaign --no-build property-listings-home-facts`, run once alone to
   test reproducibility. Result: `{"tasks":1,"failed":1,"providerCalls":1,
   "reportedTokens":0,"reportedCostUsd":0}`, with the same `lab.generation_http_400`.
4. Read-only inspection of each run's `evaluation.json`, `snapshots/live-llm.json`,
   `snapshots/flow-lane.json`, `snapshots/redaction-attestation.json` and
   `events.ndjson`, plus the scenario sources `property-listings/manifest.ts`,
   `records.ts`, `social-inbox/client-script.ts` and `live-instructions.ts`, and the
   oracle `packages/test-runner/src/run-expectations/extraction.ts`.
5. Page counts from the corpus-b scenario build (`search.js`, read-only): page size
   10; Kelford 57 homes, 6 pages; three-bed Kelford 19 homes, 2 pages.

## Not verified

- **Which field** is missing or wrong in the property extractions. Artifacts carry
  counts only (by design), and I did not open the isolated instance's store to
  read page values.
- Whether any floor area was invented (see the checklist above).
- Whether cheapest-home's first extracted home was actually the cheapest (i.e.
  whether the sort applied), or the value mismatch is formatting.
- `pagesFollowed` for the Kelford runs; this lane leaves it null. "6 pages" for
  kelford-homes is inferred from 57 records at 10 per page.
- That last-page stood on page 2 when it failed; this is inferred from the step
  order and the page count.
- What opened the inbox reply dialog. The `web.reveal_safe` exploration explanation
  is a hypothesis.
- What the home-facts 400 says, and whether DeepSeek tokens were spent during those
  34.6 s and 93.5 s builds. The Lab discards a diagnostic body its parser rejects.
- Each failing task ran once (home-facts twice). These are single observations on a
  machine with faulty RAM, although none shows a hardware signature: failures are
  specific and assertion-shaped, and there were no RAM-fault retries.

## Open questions or contradictions found

- **Success-while-wrong persists.** Five Flows reported `passed` with 0 matched
  records. The runtime does not check that required columns came back filled.
- **Home-facts: Core returns a 400 whose diagnostic the Lab cannot parse,** so the
  failure reason and any spend are lost. Either Core's diagnostic shape drifted
  from `parseAutomationStudioFlowBootstrapFailureDiagnostic`, or the 400 comes from
  a path that does not emit that diagnostic. Reproduced 2 of 2.
- **Accounting blind spot.** A failed build with a long duration is reported as
  1 call, $0, which matches the brief's "refused locally" signature but is
  probably not one. Campaign totals undercount it.
- **Inbox: a dialog left open before the Flow ran** blocks the Flow's first step.
  If exploration opens dialogs, either the run should start from a fresh page or the
  exploration should close what it opened.
- **Last-page: fixed click count.** The Flow appears to hard-code two "next" presses
  instead of pressing until next disappears (or stopping on arrival).
- The brief listed eight follow-on tasks (nine including the probe). All eight ran.
