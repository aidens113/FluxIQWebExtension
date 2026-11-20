# Live campaign 2026-11-19: results

Overnight live campaign (user, 2026-11-19 ~01:50): many live model-backed `lab attempt` runs, answer-first,
`--attempts 4`, Claude models rotated, all ten realistic sites. One row per run; each run's detail is its debug
file `docs/working/language-driven-flow-loop-plan/debugs/<runId>.md` in the lane tree it ran from.

Lanes: A = `fxwork/t959` (instance `campaign-a`, lab slot-1), B = `fxwork/t960` (instance `campaign-b`, lab slot-2).

Verdicts: **SUCCESS** = every attempt right, every continuation held, attempts 2-4 made zero decision calls.
**PARTIAL** = attempt 1 right but a later attempt wrong, not deterministic or not continued (or some attempts
right). **FAILURE** = attempt 1 wrong, budget out or stuck.

## Approved-client proof (provider-free, lane A, before the first live run)

**HELD (2026-11-19 16:55, after the F2 fix).** Lane A at dev 9e200d95d / Core 871bcdeb1 plus the F2 fix.
- Stage `done`, no failure, 29 of 29 checks true.
- Model access was `available` in all five states: configured later, after panel logout, after reconnect, after a
  Core restart, and approved without a password.
- Evidence: `test-runs/approved-client/2026-11-20T00-55-35-896Z-chrome`.

Earlier attempt, before the fix:

**Did not hold (13:10, before the F2 fix).** Lane A, `extension-chat-check --browser chrome --scenario everything-store --no-ask --model-key`.
Evidence: `test-runs/approved-client/2026-11-19T21-10-28-637Z-chrome`. Provider-free.

| Check | Result |
| --- | --- |
| Pair, select project, open side panel | passed |
| Panel turn push reaches the open chat | passed (quiet after 10.3 s, turn shown 664 ms) |
| Model access, configured later | available |
| Model access, after panel logout | available |
| Model access, after reconnect | available |
| Model access, after Core restart | available |
| Panel stream reopens after restart and catches up | passed (next turn shown in 895 ms) |
| Credential copy caught; approval needs no second password; keys page; revocation | not reached: the run timed out waiting for the pairing dialog (finding F2) |

F2 is fixed in lane A (test-runner rebuilt, 14/14 tests pass). Rerunning the proof waits for the lead's go.

## Matrix

Hardest tasks first (multi-page filtered scraping, multi-act carts, consequential acts, checkout quotes).
Each site gets at least two models; a failed task is not rerun in the same lane on unchanged source.

| Site | Round 1 (task, model, lane) | Round 2 (task, model, lane) | Round 3 (task, model, lane) |
| --- | --- | --- | --- |
| everything-store | plus-earbuds-under-50, sonnet, A | office-checkout-review, opus, B | kettle-to-cart, haiku, A |
| job-board | remote-easy-apply, haiku, B | halvard-careers-roles, sonnet, A | save-quillmark-remote, opus, B |
| auction-marketplace | lens-hood-seller-shop, opus, A | save-mark-ii-sellers, haiku, B | cheap-accessory-auctions, sonnet, A |
| professional-network | netherlands-data-engineers, sonnet, B | accept-messaged-invitations, opus, A | kade-lead-contact, haiku, B |
| crossborder-marketplace | free-hubs-under-ten, haiku, A | uk-express-quote, sonnet, B | mint-hub-fallback, opus, A |
| bigbox-retail | new-store-cheapest-towels, opus, B | checkout-quote-without-ordering, haiku, A | rated-delivery-towels, sonnet, B |
| photo-social | august-over-1300, sonnet, A | newest-likes, opus, B | priya-tags, haiku, A |
| social-network-feed | delete-stranger-requests, haiku, B | recent-group-posts, sonnet, A | hide-suggested-posts, opus, B |
| local-classifieds | bikes-within-alex-price, opus, A | test-ride-question, haiku, B | nearby-furniture, sonnet, A |
| company-website | saturday-certificate, sonnet, B | apprentices, opus, A | newsletter-signup, haiku, B |

Task ids are `<site>-<task>`. Models: haiku = `claude-haiku-5-5`, sonnet = `claude-sonnet-5-5`, opus = `claude-opus-5-5`.

### Round 1 under t962/t963 (from 2026-11-19 evening): the matrix above is superseded

- **Settings:** every run passes `--llm-model claude-haiku-5-5`. Core's no-thinking ladder climbs to Sonnet, then
  Opus, only when a run is stuck, and each climb is logged as an `NNNN-escalate` step. Models are no longer rotated
  by hand.
- **Judge:** since t963, every judge sees the run's whole trail plus the final data.
- **Order (hardest task per site):**
  - Lane A: everything-store-plus-earbuds-under-50, auction-marketplace-lens-hood-seller-shop,
    crossborder-marketplace-free-hubs-under-ten, photo-social-august-over-1300, local-classifieds-bikes-within-alex-price.
  - Lane B: job-board-remote-easy-apply (the direct test of t963), professional-network-netherlands-data-engineers,
    bigbox-retail-new-store-cheapest-towels, social-network-feed-delete-stranger-requests,
    company-website-saturday-certificate.
- **Self-stop:** the launcher stops a run with `pnpm lab stop` after 5 minutes with no new step, or on the third same
  refused completion in an attempt.

## Runs

Run 1 below ran before t962/t963, on Haiku with no ladder.

| # | Lane | Started | Site | Task | Model (climbs) | Verdict | Answers (a1/a2/a3/a4) | Decision calls (a1/a2/a3/a4) | Cost | Time | Failure stage | Run id |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | B | 13:58 | job-board | remote-easy-apply | haiku | PARTIAL | right / right / stopped by user / not run | 81 / 4 / 125 / - | $0.7601 | 50 min | a2: replay rate-limited at step 5; a3: stray Next page after loop (unmatched_route), then 34 min of judge refusals (Easily apply not in rows) until the user stopped it | run-mwo3dp11-a47a032d |
| 2 | A | 18:12 | everything-store | plus-earbuds-under-50 | haiku -> sonnet (0061, completion_refused_again) | FAILURE (stopped) | a1 unfinished | 27 / - / - / - | ~$0.22 | 15 min | stalled after climbing to Sonnet: no key for the climbed model (F8); before that an act_on_a_read loop (F9) and 2 judge noes (unfiltered rows) | run-mwocg0zw-298c705d |
| 3 | B | 18:16 | job-board | remote-easy-apply | haiku -> sonnet (0099, completion_refused_again) | FAILURE (stopped) | a1 unfinished | 46 / - / - / - | ~$0.07 | 11 min | stalled after climbing to Sonnet (F8); 1 judge no (incomplete, wrong rows) | run-mwoclsg0-6208585e |
| 4 | A | 18:47 | everything-store | plus-earbuds-under-50 | haiku -> sonnet (0032 loop_persisted) -> opus (0073 completion_refused_again); a2 haiku -> sonnet (0130 repair_failed) | PARTIAL (Lab: passed) | right / right / right / right | 30 / 4 / 0 / 0 | $4.70 | 13 min | a2: replay deviated, judges refused with HTTP 400 on a 3.39 MB request made of raw page captures (F10); judges on Sonnet and Opus ($0.34-$0.87 each) emptied the purse (F11); a3 and a4 right with 0 calls but labelled budget_out (F12) | run-mwodpw10-3d5748ab |
| 5 | B | 18:58 | job-board | remote-easy-apply | - | not run (stopped by the supervisor before any call: hold for the judge fix) | - | - | $0 | - | - | run-mwoe3yor-25381846 |
| 6 | A | 20:41 | auction-marketplace | lens-hood-seller-shop | haiku; a4 haiku -> sonnet (0076 repair_failed); loop decision ask_person on cycle x2 (0074) | PARTIAL (Lab: passed) | right / right / right / right | 10 / 0 (+1 judge) / 0 / 16 | $0.58 | 15 min | a2: replay deviated (flow_not_proven), judged; a4: replay click s4 target_not_found x4, re-explored | run-mwohvt8n-a57cad8a |
| 7 | B | 20:53 | job-board | remote-easy-apply | haiku -> sonnet (0067 completion_refused_again); loop decision change_approach (0071); a2 haiku -> sonnet (0130 repair_failed) | PARTIAL (stopped) | right / stopped / not run / not run | 43 / ~10 / - / - | ~$0.95 | 14 min | a1 right, and t963's judge accepted Easily apply; a2 replay deviated, then Sonnet repeated core.run_flow {from:16} 7 times with no loop caught (F15), so the supervisor stopped it | run-mwoi785f-ebe09067 |
| 8 | A | 21:14 | crossborder-marketplace | free-hubs-under-ten | haiku (no climbs) | FAILURE (watchdog stop) | a1 stuck | 10 / - / - / - | ~$0.02 | 7 min | next page to page 3 met the traffic screen; the Lab cleared it but its Continue never reached Core (chat press failed), so Core waited; cause being traced provider-free (F16) | run-mwoiywne-2385504a |
| 9 | B | 21:08 | professional-network | netherlands-data-engineers | haiku | not a result (watchdog false stop) | a1 in progress | 15 / - / - / - | ~$0.03 | ~8 min | the campaign watchdog's repeat rule fired on calls Core had already refused; rule fixed; rerun | run-mwoj9sre-a073c148 |
| 10 | B | 21:36 | professional-network | netherlands-data-engineers | haiku -> sonnet (0170 no_new_evidence) -> opus (0356 loop_persisted); 9 change_approach, 1 finish_with_best | FAILURE | budget_out x4 (34 rows, promoted ad kept, order off) | 140 / 0 (+1 judge) / 0 / 0 | $5.02 | 14 min | no model got the read to leave out the promoted row (F3 family); 6 judge noes, the Opus judge $1.10 | run-mwojyaub-a76ac16e |
| 11 | B | 21:56 | bigbox-retail | new-store-cheapest-towels | haiku -> sonnet (0112 no_new_evidence); change_approach x3 | not a result (watchdog false stop: race) | a1 in progress | ~60 / - / - / - | ~$0.3 | 10 min | the repeat rule read the log before Core's refusal landed; rule fixed (consecutive, results known); rerun | run-mwokmy3r-0764a351 |
| 12 | A | 21:56 | crossborder-marketplace | free-hubs-under-ten | haiku | FAILURE (watchdog stop) | a1 stuck | ~12 / - / - / - | ~$0.03 | 13 min | F16 again: the press at (59, 369) did not reach the "Continue" button | run-mwokogky-ec1e6cfc |
| 13 | B | 22:08 | bigbox-retail | new-store-cheapest-towels | haiku -> sonnet (0206 completion_refused_again; 0286 repair_failed; 0352, 0407 loop_persisted); change_approach x13 | PARTIAL (Lab: failed, budget_out) | right / right / right / budget_out | 101 / 28 / 28 / - | ~$4.6 | 42 min | a2 and a3 replays deviated and were repaired live; Sonnet judges at ~$0.80 each, no cache continuation (F14) | run-mwomryse-e3eaa7cc |
| 14 | A | 22:10 | photo-social | august-over-1300 | haiku -> sonnet (0068 no_new_evidence) -> opus (0130); change_approach, finish_with_best | FAILURE (watchdog: third refused completion) | a1 never right | 63 / - / - / - | ~$1.83 | ~10 min | the read stored only post URLs, not the asked columns; the judge refused finish_with_best | run-mwon94xa-9b075878 |

## Tally

| Model | Runs | Success | Partial | Failure |
| --- | --- | --- | --- | --- |
| claude-haiku-5-5 (base, with the ladder from run 2) | 11 (+2 not counted: watchdog errors) | 0 | 5 | 6 (2 by F8, 2 by F16, 1 budget_out, 1 refused x3) |
| claude-sonnet-5-5 | 0 | 0 | 0 | 0 |
| claude-opus-5-5 | 0 | 0 | 0 | 0 |

## Findings

(Kept here because a hook refuses a separate `findings.md`.) Each bug seen in the campaign, with evidence.
**SIMPLE** = fixed in the lane where it showed, with the change and the rerun that proved it. **FUNDAMENTAL** = how
results form, the judge, the build/repair loop or recovery design; recorded for the user's review, no fix. Unfixed
security findings are held outside the repository.

### F0. Lane worktrees started without `.env.local` (SIMPLE, worked around in setup)

Both `fxwork/t959` and `fxwork/t960` had no `.env.local`, so a live run there would have been refused for want of
the key and the $5 ceiling. `scripts/worktree/env-local.mjs` (`copyEnvLocal`) exists to copy it into each task
worktree, but it did not run for these two. Fixed for tonight with a plain file copy from the main checkout
(contents never read). Worth checking that `pnpm task start --worktree` calls `copyEnvLocal`.

### F1. Core web production build crashed with a stack overflow under concurrent build load (not a product run; observation)

- **What happened:** on 2026-11-19 at about 02:58, lane B's Core `pnpm build` ran `web:build` while lane A's
  extension build ran beside it, with about 1-4 GB free. The Next.js build worker exited with code 3221225725
  (0xC00000FD, STATUS_STACK_OVERFLOW) after 100 s, and the build cache correctly left it unstamped.
- **Rerun:** at 13:05, on an idle machine (4.5 GB free, no other slot holder), the same tree built cleanly
  (`Compiled successfully in 33.5s`, exit 0).
- **Status:** not fixed and not a root cause yet. An overflow rather than an out-of-memory error suggests the worker
  thread's stack, not the heap, so it is worth a look if it recurs. Lane A's web build (02:57) succeeded.
  Evidence: the supervisor's scratchpad build logs `build-b.log` and `build-b2.log`.

### F2. The Lab's pairing step still looked for the old pairing dialog title (SIMPLE, fixed in lane A)

- **Evidence:** the approved-client proof at 13:10, evidence in
  `test-runs/approved-client/2026-11-19T21-10-28-637Z-chrome`. It failed at `claim approved-client model access`
  with `locator.waitFor: Timeout 30000ms exceeded`. Every access check before that passed.
- **Cause:** Core's t925 commit eac42630b (2026-11-18) titles the pairing prompt `pairingTitle(...)`, which reads
  "<client> wants to connect" (for example "Chrome on Windows wants to connect"). Before, it read "A browser or app
  wants to connect". Two Lab callers still asked for the old name:
  - `packages/test-runner/src/extension-chat-check/prove/approved-client/prove.ts`;
  - `packages/test-runner/src/demo-workspace/panel-navigation.ts` (`approvePairingInPanel`).
- **Fix:** both callers now match the dialog by Core's title shape, `/^.+ wants to connect$/u`, and
  `demo-workspace/tests/pairing-approval.test.ts` asserts that pattern. The dialog's Confirm button,
  `[data-modal-submit]`, is unchanged in Core.
- **Rerun:** the approved-client proof held at 16:55, with 29 of 29 checks true (see the top of this file).

### F3. A read condition that is not a column cannot be verified, and the judge flips (FUNDAMENTAL)

- **Run:** run-mwo3dp11-a47a032d (job-board-remote-easy-apply, Haiku).
- **Cause:** the saved read declares the columns title, company and salary. "Easily apply" was a read condition, and
  Core notes that the saved read drops the columns it does not declare. So no row carries the evidence for it.
- **Effect:** the judge said yes on attempts 1 and 2 (0212/0213, 0234/0235) and "unknown, nothing shows Easily
  apply" on attempt 3 (0380, 0391, 0457, 0481, 0510), over the same 7 rows. There were 14 to 16 refusals in all.
- **Area:** result formation and the judge. Recorded for review.

### F4. A manual Next page is saved after the paging loop, so replay ends in `unmatched_route` (FUNDAMENTAL)

- **Run:** run-mwo3dp11-a47a032d, attempt 3: the replay ran the loop through 5 pages (0247-0266), then a stray
  `dom-next_page` (0267), giving `executor.graph.unmatched_route` at step 52.
- **Earlier occurrence:** the same defect appeared in run-mwcncux8-d888f3a0 on 2026-11-11, so it recurs.
- **Area:** authoring. Recorded for review.

### F5. A rate-limited click in a Flow replay is not handled as an interruption (FUNDAMENTAL)

- **Run:** run-mwo3dp11-a47a032d, attempt 2: `dom-click` failed `web.action.rate_limited` (0220), the retries found no
  target (0221-0223), and the replay stopped at step 5.
- **Expected:** the standing rule asks for a wait, dismiss and return-to-loop branch with backoff.
- **Area:** recovery design. Recorded for review.

### F6. `ask_person` from the loop guard does not end or park the attempt (FUNDAMENTAL)

- **Run:** run-mwo3dp11-a47a032d, attempt 3: `core.completion_check` escalated to `ask_person` at near-repeat
  x3 and kept going to x11 (0516-0572). Each round ended and a new one began.
- **Effect:** the attempt kept making calls for 34 minutes until the user stopped it by hand (0574,
  `llm.provider_aborted`).
- **Area:** loop detection. Recorded for review.
- **Standing rule from the lead, for when launches resume:** stop a run at once if it repeats the same refused
  completion three times, or makes no progress for 5 minutes.

### F7. Report wording and speed split (SIMPLE, not fixed yet)

- **Wording:** `attempt-report.txt` says "Attempt 4 did not run: a person stopped the first attempt", but attempt 3
  was the one stopped.
- **Speed split:** the speed section reports "thinking about 0.0 s" while decisions average 9.6 s per call (210 calls,
  2012 s, about 1,890 output tokens each). The lead reads 85-90% of that as hidden thinking, which the Lab does not
  split out.

### F8. A model-ladder climb finds no key, and the attempt retries forever (FUNDAMENTAL; the lead is fixing it with option (a))

- **Runs:** run-mwocg0zw-298c705d (lane A) and run-mwoclsg0-6208585e (lane B). Both stopped by the supervisor.
- **What happened:** after `escalate claude-haiku-5-5 -> claude-sonnet-5-5`, every decision failed in under 200 ms with
  `flow_bootstrap.provider_secret_unavailable`. The cause is Core `runtime/models/secrets/session-key.ts`,
  `isProviderLlmKey`: it takes a key only when the key's saved model equals the requested model, and the Lab's key is
  saved with the run's model (Haiku).
- **Second defect:** the failure is marked `retryable: false`, yet the attempt retried every 60 s, re-reading the page
  each time. The run looked alive while making no progress.
- **Fix in progress (the lead):** keys become provider-scoped, an exact model match is preferred, and any key of the
  same provider serves a climbed model.
- **Watchdog change:** the campaign watchdog now counts only decision, judge, loop, escalate and Flow steps as progress.

### F9. Haiku tries to attach the next-page act to a read step; refused four times (FUNDAMENTAL: the build's amendment vocabulary and guidance)

- **Run:** run-mwocg0zw-298c705d (everything-store-plus-earbuds-under-50), steps 0013 to 0040.
- **What Haiku did:** at 0013 its plan was "add the next-page loop to the draft and read the remaining pages". It
  amended with `{step: 4, change: "add", act: "a1"}`, attaching an act to step 4, which is `dom-extract_list`.
- **What Core did:** it refused each time with `act_on_a_read` (0014 partly applied, then 0016, 0018 and 0035). Its
  feedback said to "run the press that does it as a new call with add true and its act".
- **Loop decisions:** the model's own loop decisions fired. At 0021 it chose `ask_person` on `same_fix` x2, but the
  attempt continued, as in F6. At 0038 it chose `change_approach` on `same_fix` x3, and its next amendment was
  refused as `already_in_flow` (0040).
- **What it shows:** the model wants "a paging loop around this read", and the amendment vocabulary offers no direct
  way to say that.
- **Also:** an `ask_person` loop decision still does not park the attempt.

### F10. Raw page captures in the judge's trail overflow the request, and the size estimate undercounts (FUNDAMENTAL; t965 in progress) (corrected)

- **Run:** run-mwodpw10-3d5748ab. Attempt 2's judge request was 3.39 MB (0117); attempt 1's was 538 KB (0091). The
  provider answered HTTP 400 (`llm.provider_http_error`, not retryable) at 0117, 0124 and 0127, each giving
  `answer_first.not_judged`.
- **Cause (the lead's diagnosis):** the trail did not grow across attempts. Attempt 2's judge held only attempt 2's
  own 23 saved-Flow steps. Three of those steps each carried the domain's raw page capture, about 1 MB each, in
  `found.outputs`. Core's size estimate (UTF-8 bytes / 3) undercounts dense JSON, so window fitting stopped too early.
- **First reading, withdrawn:** the campaign supervisor first read this as "the trail grows across attempts". That was
  wrong.
- **Fix in progress (t965):** take raw captures out of the trail; measure conservatively or with Anthropic's own token
  count; fit and resend on a size refusal; keep the judge on the base model; cache the trail.

### F11. The judge climbs with the model ladder on the whole trail, and the cost empties the Flow's purse (FUNDAMENTAL; the lead's fix is in progress)

- **Run:** run-mwodpw10-3d5748ab.
  - 0062: Sonnet, 160k input tokens, $0.34.
  - 0091 and 0092: Opus, 211k input tokens, $0.87 each.
- **Effect:** attempt 1 cost $3.28 and attempt 2 $1.42, so the run spent $4.70 of the $5 purse, and attempt 2 ended
  `budget_out`.
- **Also seen:** before the ladder (run 2), a Haiku judge on the same page cost $0.08.
- **Fix in progress:** the judge stays on the base model.

### F12. An attempt that delivered the right answer with zero calls is labelled `budget_out` (FUNDAMENTAL: ending formation)

- **Run:** run-mwodpw10-3d5748ab, attempts 3 and 4: `run_flow`, 0 calls, right answer and 13 rows shown, yet
  `ended: budget_out`.
- **Why:** each replay was flagged for judging ("deviated from the accepted run: flow_not_proven", 0154 and 0178), and
  the empty purse left no judge to run.
- **Effect:** the person's result arrives, but the attempt reads as out of budget and the Flow stays unproven.

### F13. Calls the provider refused are charged to the Flow's purse at their reserved cost (needs the lead's call: looks local, but it is Core's money accounting)

- **Run:** run-mwodpw10-3d5748ab, attempt 2. Its 7 calls carried a provider-reported cost of $0.0087 in total: four
  Haiku decisions (0119, 0123, 0126, 0129) and three judges refused with HTTP 400 and no usage (0117, 0124, 0127).
- **The charge:** Core's attempt record charges attempt 2 `usd 1.4233` (`attempt.json`, `attempt.spend`). The refused
  judges' reservations, estimated for a 3.39 MB request, were kept, not released.
- **Effect:** attempt 1 cost $3.28 and attempt 2 was charged $1.42, so the $5 purse was spent. That is the real reason
  attempts 2 to 4 ended `budget_out` (see F12).
- **Note:** t965 stops oversized judge requests being sent. A refused or failed call with no usage still keeps its
  reservation.

### F14. The judge does not reuse the decider's cache: large cache writes, about 2% reads (t965 caching not taking effect)

- **Run:** run-mwohvt8n-a57cad8a.
  - Base-model Haiku judges 0029 and 0057: 190,670 and 92,811 input tokens, of which only 3,537 were read from cache.
    They wrote 184,966 and 85,412 tokens as new cache.
  - Judge 0089 after the climb to Sonnet: 112,817 input tokens, 0 read, 110,566 written, $0.287.
- **Expected (t965):** a judge that follows a decision continues the decider's cached conversation, with a large
  cache read and little fresh input.
- **Seen:** every judge pays for writing its trail to cache and never reads it back. Recorded for the lead.
- **Narrowed by run 7 (run-mwoi785f-ebe09067):** the second judge of a pair does read the first one's cache (0101 read
  71,166 of 77,422 tokens, 92%). The first judge of each pair still writes fresh, and none continues the decider's
  conversation.

### F15. A successful tool call repeated with the same input is never caught as a loop (FUNDAMENTAL: loop detection)

- **Run:** run-mwoi785f-ebe09067, attempt 2. After a repair failed and the ladder climbed to Sonnet, the model called
  `core.run_flow {from: 16}` seven times (0184 to 0249).
- **Each replay ended normally** ("the list has no next page ... the loop over its pages ends here"), and the model
  ran it again instead of completing.
- **Why nothing caught it:** the repeat guard refuses only repeated failed or no-effect calls, and loop detection wrote
  no row after 0071.
- **Stopped by the campaign supervisor** after about 8 minutes of this, under the standing no-progress rule.

### F16. The Lab clears a person check but its Continue never reaches Core, so the attempt waits (SIMPLE, Lab driver, fixed in lane A; live rerun pending)

- **Run:** run-mwoiywne-2385504a (crossborder-marketplace-free-hubs-under-ten).
- **What happened:** the press to page 3 met the "I'm not a robot" traffic screen, and Core waited inside the tool call
  (0022). The Lab logged "the Lab played the person at a check: traffic-screen, cleared, answered nothing".
- **Where the answer was lost:** in `person-simulation/simulation.ts` (`handOffOne`), `answer` is null only when
  sending it throws. Here it is pressed in the chat, via `attempt-person.ts` `chatAnswerer`, with a 30 s press.
- **Repro attempt:** a provider-free scripted run of the same task in lane A, run-mwojshmc-57adba2a (instance
  `campaign-a-probe`), met the same traffic screen. There the Lab "cleared, answered person_done in the chat", and
  the attempt was right. The live failure did not reproduce, so it is intermittent or depends on the live run.
- **Why the live error is lost:** the hand-off note is written only when the attempt ends, and the stopped run never
  wrote it.
- **Diagnostic fix (SIMPLE, lane A):** `attempt-lane/live/attempt-person.ts` now puts the hand-off's note on the
  attempt's log line (`... answered nothing (the answer did not reach Core: <error>)`), so the next occurrence names
  its cause. The note is the Lab's own bounded reason, never page text.
- **Live rerun:** run-mwokogky-ec1e6cfc. The note gave the cause: "The side panel showed no enabled "Continue"
  button to press: the press at (59, 369) did not reach the "Continue" button".
  - The panel's own hit test (`view-target-press/in-panel-target.ts`) finds the button enabled and unobstructed
    there.
  - The trusted CDP press (`Input.dispatchMouseEvent` on the side panel's target) produces no click on it, so after
    30 s of retries the Lab gives up.
- **Root cause (worker-heavy, verified by the supervisor):** the press script's locate step called
  `button.scrollIntoView({ block: "center" })` and then hit-tested the button it had just moved. Core's chat
  (`@fluxiq/ui-components` `chat/view/scroll-follower.ts`) puts back any scroll that is not the person's own, so by
  the time the trusted mouse press arrived, one CDP round trip later, the button was gone from that point.
  - It was intermittent because the script scrolls only when the button is not already where it would centre it.
  - The tab-focus hypothesis was tested in 6 focus states in real Chrome, and the press landed in all of them.
- **Fix:** `view-target-press/in-panel-target.ts` no longer scrolls. It works out what shows (the view, cut down by
  every clipping ancestor) and presses a visible button where it stands. A button scrolled out of view is answered with
  the wheel turn a person would make, and `press-in-view-target.ts` sends that turn as a real `mouseWheel`, which the
  chat keeps as the person's scroll. No waits or retry counts changed. New tests are in
  `extension-chat-check/tests/panel-driver-press.test.ts`; two of them fail on the old code with the live error.
- **Verified by the supervisor:**
  - `node --test dist/extension-chat-check/tests/panel-driver-press.test.js dist/extension-chat-check/tests/panel-driver.test.js`
    gives 9 pass, 0 fail.
  - The person-simulation and attempt-lane dist tests give 78 pass, 0 fail.
  - `node scripts/structure-audit.mjs` passed.
  - The worker's scripted crossborder attempt (run-mwoo9ota-6cff4f80) logged "answered person_done in the chat",
    answer right.
- **Report:** `reports/live-campaign-2026-11-19/f16-side-panel-press.md`.
- **Pending:** a live rerun of crossborder in lane A.

### F17. Rows marked on the page (promoted) are not excluded by the read; every model fails and the purse runs out (FUNDAMENTAL: result formation, F3 family)

- **Run:** run-mwojyaub-a76ac16e (professional-network-netherlands-data-engineers). The instruction says "Leave out
  anything marked as promoted ... in the order the search shows them".
- **What the judges said:** all six said the filters and the 4 pages were right, but the table kept a promoted ad
  row and the rows were out of order.
- **Effect:** Haiku, then Sonnet, then Opus never got the read to drop the row. Attempt 1 ended `budget_out` at $4.70.
  The Opus judge that continued the decider cost $1.10 for one call.
