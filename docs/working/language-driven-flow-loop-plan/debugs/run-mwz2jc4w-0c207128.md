# run-mwz2jc4w-0c207128: kestrel auctions, the replay's search landed on the bot check and was judged not done

Lane: t1059 `live-lane-2`. Task: `auction-marketplace/auction-marketplace-kestrel-auctions`, answer-first,
`--attempts 4`, `claude-sonnet-5-5` for build and judge, fluxiq 0.54.35 (Core `f0b7d9f76`). Attempt 3 ended
achieved and the lead stopped the run as attempt 4 began (the log's last line is attempt 4's instruction being
typed; the step files end at 0106). It was debugged offline from:

- the step files in `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-27/run-mwz2jc4w-0c207128/steps/`;
- the attempt bundle (`attempt-1..3/site.json`, `answer-turn.json`) and the Lab log `kestrel4.log`;
- copies of the run's own stores (`.attempt-work/run-mwz2jc4w-0c207128/fluxiq-root/.fluxiq`), read-only with Python:
  `project.sqlite` `graph_nodes`, `client_gateway_trace_events` and `client_gateway_trace_chunks` (raw deflate), and
  `global.sqlite` `automation.state` (`answer-attempts`). The secret tables were not read;
- the code in the lane tree and in the shared Core `fxwork/!FluxIQ`.

No live or paid run was made, no code was changed, and no git command was used. The full report, with every line
reference, is `docs/working/page-diff-delivery-plan/reports/run-mwz2jc4w-kestrel.md`.

## What happened

| Attempt | Steps | Calls, cost | What it did |
| --- | --- | --- | --- |
| 1 | 0001-0039 | 20 calls, $1.35 | **Explored, and the answer was right.** It rejected cookies, searched "kestrel 35", applied Auction, read both pages, and set result processing. It was judged twice: 0039 re-asked 0038 because one citation, a title two rows share, was qualified "(ends Mon 21 Sep 15:35)" and matched no row. |
| 2 | 0040-0090 | 21 calls, $1.91 ($0.73 judge) | **The replay stopped at the search.** Step 2 (Reject all) was passed over correctly, since consent was remembered. The type with submit (0043) sent the search, and the server sent the tab to the **bot check** ("Pardon the wait", `splashui/challenge`). For 2.16 s the recorded effect (the results page) was looked for and not seen, so the step failed `core.step.effect_not_seen` and the run stopped (0044). The check let the tab on by itself at 14:24:21.3, 2.6 s after the run had stopped. The attempt then re-explored with 18 decisions, and was judged three times (0087 citation re-ask, 0088 unreadable shape, 0090). |
| 3 | 0091-0106 | 1 call, $0.09 | **The replay of attempt 2's Flow worked**, with 0 decisions (the check had already been passed). It deviated from the accepted run, so a judge was asked on its own (0105 `flow_not_proven`, 0106 yes). The brief's "note 0105" belongs here, not to attempt 2. |

## Why the replay stopped (question 1)

- **The search box did not hold old words, and the act did land.** 0040 opened the home page afresh. The type was sent
  (0043 `page.type`, `pressed`). The trace shows the tab on
  `splashui/challenge?ru=…sch/i.html?_nkw=kestrel+35&_sacat=0` from 14:24:16.268. That `ru` is the search the type
  submitted.
- **The bot check was the fixture's own, by design.** `route.ts:11,54-57` sends the fourth results page of a session to
  the check, and attempt 1 had already served three or more. `challenge-script.ts:12` lets the visitor on after 5 s.
  `attempt-2/site.json` records "passed challenge".
- **All six recorded-effect looks saw the check page.** The trace has snapshots at 16.545, 16.572, 17.103, 17.640,
  18.168 and 18.705, every one titled "Pardon the wait". The results page arrived at 21.303.
- **The domain called that absence.** `domain/src/runtime/route-state/effect/seen.ts:56` answers `not_seen` when the
  step added at least 3 control names, none is shown, and the page is not on the step's destination path.
  - The saved step's effect added 16 names, and its destination path is `488e7727` (the results page). The path it
    started from is `5e3745f5` (the home page).
  - The check page was a third address. It showed none of the results page's names, and none of the home page's
    `removed` names either. So the page had **left where the step found it** and had not yet arrived.
  - That is not evidence that the act never happened, which is what `not_seen` is meant to claim (`seen.ts:13-18`).
- **Core then had no way on.**
  - `recorded-effect.ts:83-101`: the window is the 2,000 ms floor (`recorded.ts:35`), because no node of either Flow
    carries `recordedGapMs`. A `not_seen` at the end of it fails the attempt, host-evaluated.
  - `assess.ts:102-104`: a lasting act rejected after success is a true failure. There is no effect check, no retry
    and no alternative. The type is lasting because `submit` makes it a commit (`domain/src/actions/action-effect/table.ts:21`).
  - `graph-run.ts:554`: state routing only takes a step that could not run, so this step never reaches the router's
    "effect already holds" route (`state-routing/decision.ts`, rule 3).
  - `continuation.ts:44`: `output_not_observed` does not survive, so the run stops.
- **Why provider-free did not catch it.** Recovery-matrix case 14 (`packages/test-runner/src/recovery-matrix/flows/hood-seller-shop.ts`)
  is this exact search-into-the-check. But its search step is authored and carries no recorded effect, so
  `recorded-effect.ts:77-79` returns before judging anything. Every answer-first Flow's steps carry one.

## Why attempt 2 cost more than exploring (question 3)

Of attempt 2's 21 calls, 18 were decisions ($1.18) and 3 were judges ($0.73). With the replay standing, it would have
needed none of the decisions.

- **The handoff told the model something false.** `round-note.ts:23,74` said "The page is where it left it. Fix that
  step". By 0045 the page was the results page, and step 3 needed no fix.
- **The carried result read silenced every new read (0052-0058, 4 calls, $0.29).**
  - The saved Flow's read (step 6, not run this attempt) stayed in the draft as the result. Each new read was marked
    `not_the_result`, and the Auction click `dead_end` (0052's draft).
  - Meanwhile the result header said "the draft has no read step yet … Capture the required source fields".
  - The model re-read three times, then dropped steps 6-7 by hand. `compose.ts:98-110` (`named`) is the likely
    cause. The feed and the composer disagreed: 0051 "the result is now step 11's", and then at 0052 "step 11 left the
    draft".
- **The rows read before the result moved were not counted (6 calls, $0.39).** After the amend, step 14 "(v1) has
  read no page yet". So the paging loop was rebuilt (0060, 0062), processing was refused for want of that read's schema
  (0064), the loop ran from page 2 only (0066), and it ran again from page 1 (0076, 0078).
- **The rest was ordinary exploration (6 calls, $0.36):** the Auction click 0046, detect 0048, read 0050, processing
  0074 and 0084, and complete 0086.
- **Model slips (0070, 0072, 2 calls, $0.14).** A pattern of 206 characters, over the 200 the tool states. A price
  regex that missed some rows.
- **Judges (0088, 0090, $0.49).**
  - 0088 was a re-ask because a citation of a title two rows share, "Kestrel 35 Rangefinder Camera (ends …)", matched
    no row (`citation-refuted.ts:36-40`). Attempt 1 paid the same re-ask (0039).
  - 0090 was a re-ask because 0088's reply arrived in the wrong shape (question 2).

## The judge reply at 0088 (question 2)

- **The shape Sonnet sent.** It wrote `diagnosis` as a JSON string holding the first half of the object
  (`answersRequest` … `checked`). It then put `answerRecords`, `explorationNeeded`, `patchNeeded`, `confidence` and
  `summary` beside it, at the top level.
- **Why it could happen.** 0087 got the same schema right. `core_check_answer` is sent non-strict, because strict tools
  share one budget of 24 optional parameters per request (`judge-answer-tool.ts:18-22`,
  `decision-tools-wire.ts:36-52`). The six strict decision tools use 23 of them, and this tool needs about 12. Without
  constrained decoding a nested object can be serialised as a string, and nothing stops it.
- **What prevents it.** A strict schema. Make it fit by reshaping the answer so it costs almost no optional
  parameters: every member required, the few that may be absent nullable. A clearer description would not help, since
  the same description worked at 0087.

## Shared with bigbox run-mwz29d50 (question 4)

Both runs have the same kind of defect: a replay rule reads a recorded route signature but does not ask **where the
page is now, relative to where the step started and where it went**.

- In bigbox, `not-arisen.ts` passed over a step whose effect was a navigation.
- Here, `seen.ts` judged a step undone because the page was at a third address.
- Both standalone `flow_not_proven` replay judges came from the same path (bigbox F2). Here the rows carried their own
  evidence, so it answered yes.
- The read itself is fine in both runs. bigbox's `output_not_observed` is a read on the wrong page. Here it is
  `core.step.effect_not_seen`: same category, different code and cause.

## Fixes proposed (no caps; offline proofs in the report)

- **K1 (root, domain `route-state/effect/seen.ts` and `sign.ts`):** `not_seen` only when the page stands where the step
  found it.
  - Sign the start path (`from`) beside `path`.
  - A page at a third address, showing neither the step's start nor what it brought, is `unknown`: the act's answer
    stands, and the next step's own wait and retries meet the interstitial (recovery-matrix case 14 already proves
    that part).
  - Old effects without `from` fall back to "none of `removed` shown".
- **K2 (Core `answer-first/attempt/round-note.ts`, the replay stop):** the stop is told as Core observes the page at
  handoff.
  - Where the stopped step's recorded effect holds by then, the replay goes on from the next step through the existing
    "effect holds" route, rather than "the page is where it left it".
- **K3 (Core `flow-authoring/draft/compose/compose.ts` and the answer-first result feed):** a carried read that has not
  run this attempt must not hold the result against a fresh read of the same list, and the header and the draft must
  name the same result.
- **K4 (Core judge answer tool):** zero-optional reshape so `core_check_answer` is sent strict, last, within the
  24-optional budget.
- **K5 (Core `result-verification/cited-yes/`, row ids):** rows that share a label get distinct handles in the judge's
  copy, and the citation rule says so.
  - Today `id.ts:17-19` gives them one id, and the text never says a shared label may be cited as written.
