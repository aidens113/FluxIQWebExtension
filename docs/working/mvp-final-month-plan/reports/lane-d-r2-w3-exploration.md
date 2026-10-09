# Lane D round 2, W3: exploration and accounting of run-mv0pcfaf-cd251bdc

Read-only walk of `test-runs/instances/t275-slot-4/run-mv0pcfaf-cd251bdc` (task
social-network-feed-confirm-requests, deepseek-flash, candidate authoring, limit 48 calls,
ceiling $0.10). All facts below were read from step folders, `events.ndjson`, `run.json`,
`snapshots/running-*-identity.json`, `logs/core.log`, the campaign log and the Lab spend ledger.

## Outcome

Done. Exploration never pressed Confirm, Delete or Add friend, so it never saw an accepted
card. The build failed because the candidate's last step filtered on a field it never
declared (`confirm`, line 27). The model then sent the same candidate four more times and
was refused each time. Cost was $0.060504 over 23 calls. Every call was priced at DeepSeek's
full peak rate because the calls ran from 08:30 to 08:31 UTC on a Friday. That fully
accounts for the cost per call being about double round 1's.

## Step table (0002-0032)

Handles and words are quoted from the view the call was made against.

| Step | Model's call (callId) | Target / params, and what the view said it was | Result code | What changed |
| --- | --- | --- | --- | --- |
| 0002 | (initial, no model call) `web.output.browser-navigate` | url `http://127.0.0.1:60766/scenarios/social-network-feed/` | web.action.succeeded | Feed loaded with cookie consent dialog t469 "Allow the use of cookies from Circleway on this browser?" (layer t468 covers 99) |
| 0004 | close-consent-1 `dom-click` | t476 button "Decline optional cookies" | web.action.succeeded | Consent gone; feed visible, 120 elements |
| 0006 | nav-friends-1 `browser-navigate` | url `http://127.0.0.1:60766/friends/` (model dropped the `/scenarios/social-network-feed` prefix; the view shows `~/friends/` with `~` = the scenario root) | **web.action.rejected.address_not_shown** | Nothing done. The guard was right: that address appears nowhere in the evidence. `instead` suggested clicking the link or using an evidenced href |
| 0008 | nav-friends-2 `dom-click` | t12 link "Friends" `~/friends/` | **web.action.rejected.target_covered** | Nothing done. A new modal had appeared: layer **t478** (covers 99) holding dialog t469 **"Turn on notifications?"** with t479 button "Close", t481 "Not now", t482 "Turn on". Detail: `instead: [t478]`, `closeWith: [t479, t481]` |
| 0010 | close-notif-1 `dom-click` | t481 button "Not now" | web.action.succeeded | Notifications modal closed |
| 0012 | nav-friends-3 `dom-click` | t12 link "Friends" (same call as 0008, now uncovered) | web.action.succeeded | On `~/friends/`. A chat popup t675 "Chat with Elena Sokolova" covers 10 (it covers Priya Nair's and Jonas Weber's Confirm/Delete). The Friend requests section shows 4 of 8 cards (Tom Becker t566 Confirm …) |
| 0014 | close-chat-1 `dom-click` | t682 button "Close chat" | web.action.succeeded | Chat popup gone; 4 request cards uncovered |
| 0016 | detect-requests-1 `web.detect_repeating_structure` | target t553 h2 "Friend requests" | web.structure.detected (extraction.1) | Wrong container: 2 items, fields are the heading and "See all". Read only |
| 0018 | detect-requests-2 `detect_repeating_structure` | target t557 (Tom Becker's card link) | web.structure.detected (extraction.2) | 4 items, all 7 card columns; `continues` points at "See all" → `~/friends/requests/` |
| 0020 | open-requests-1 `dom-click` | t554 link "See all" (same href as t542 "Friend requests") | web.action.succeeded | On `~/friends/requests/`: "8 friend requests", cards 1/8 to 8/8. **t763 button "Confirm" is in card 1/8, Tom Becker ("1 mutual friend", "2w")** |
| 0022 | detect-requests-3 `detect_repeating_structure` | target t749 h2 "Friend requests" | web.structure.detected (**extraction.3**) | 8 items. The Confirm column `div_…x1507i5_x1mgzeci_xu37y6r` has `at: t763` |
| 0024 | (0023 decided detect-requests-4, same input t749) | — | **refused llm_evidence_loop.already_answered** | Not run. `answeredByCallId: detect-requests-3`, timesAsked 2, no action since. The refusal was right |
| 0026 | extract-requests-1 `dom-extract_list` | `extractList: "extraction.3"`, minItems 0 | web.inspect.succeeded | 8 records, all 7 raw columns; page scrolled to y=151 (`pageChanged: true`) |
| 0028 | extract-requests-2 `dom-extract_list` | `{handle: extraction.3, fields: {name, mutual, confirm}, minItems: 0}` | web.inspect.succeeded | 8 records {name, mutual, confirm}; Diego Alvarez's `mutual` is "" (the view has no mutual-friends line for him). `pageChanged: false` |
| 0030 | (0029 decided extract-requests-3, input identical to 0028) | — | **refused llm_evidence_loop.repeat_refused (changed_nothing)** | Not run. `sameAsCall: extract-requests-2`, `then.outcome: changed_nothing`, refusedInARow 1/3. **The refusal was right**: the identical read on the identical page had already returned all 8 rows in full (`extracted` holds all 8), and the model's stated reason ("to see each request's mutual-friend count") was already answered |
| 0032 | recall-requests-1 `core.recall_result` | callId extract-requests-1 | core.recall.restored | Restored the 0026 read (8 rows, raw column keys). This is a third copy of data the model already held from 0028. It does no harm but spent a decision |

From 0033 on (context for the ending):

| Step | What happened |
| --- | --- |
| 0033→0034 | submit-flow-1 `core.submit_candidate` → refused `flow_bootstrap.evidence_completion_parameters_unresolved:4689ef84`. Issues are all on line 27, step "read the accepted requests": `web.handle.unknown_field` (extraction.3), `web.handle.expected.extract_list.handle_fields`, `web.handle.unknown_field:extractList.where.0`. Its `where: [{field: "confirm", is: "absent"}]` names `confirm`, which that step never declares in `fields` (it declares only name and mutualFriends) |
| 0035→0036 | describe_nodes `dom-extract_list` → ok, `alreadyDescribed` |
| 0037→0038, 0041→0042, 0043→0044, 0045→0046 | The same candidate unchanged (about 600 output tokens each) → repeat_refused (`then.outcome: failed`) |
| 0039→0040 | detect_repeating_structure t749 again → **already_answered** (`answeredByCallId: detect-requests-3`, timesAsked 3). The refusal was right |

## Findings

1. **No Confirm, Delete or Add friend was pressed while exploring.** Every click target was
   t476 (Decline optional cookies), t12 (Friends, twice), t481 (Not now), t682 (Close chat)
   and t554 (See all). The other calls were navigate, detect, extract or recall.
2. **The "You're going too fast" dialog never appeared.** A case-insensitive search for
   "too fast" across every step folder found nothing.
3. **Where the queried handles were printed:**
   - **t479** was printed only in the 0008 view: button "Close" in the "Turn on notifications?"
     modal, inside layer t478. The candidate then used it as "close the cookie banner if it
     shows" (optional). That is mislabelled. The cookie banner's button was t476, and t479 is
     the notifications modal's Close.
   - **t763** was printed in the 0020, 0026 and 0028 views and as `at` in the 0022 extraction.3
     result. It labels **card 1/8's Confirm, which is Tom Becker's ("1 mutual friend")**. Tom
     Becker does *not* meet the "at least five" filter, so the candidate's `confirm the request`
     step targets a row the filter excludes. It is correct only if the repeat-over re-binds
     the click to each kept row's Confirm (the extraction `atNote` says to "use the control
     inside one of the rows it keeps"). The candidate never reached a trial, so this is untested.
   - **extraction.3** was printed by 0022 (t749 on `~/friends/requests/`, 8 items). It was
     used by 0026, 0028 and the candidate.
4. **Exploration never saw a card in its accepted state.** No Confirm was ever pressed, so the
   accepted-row shape (whether the Confirm button disappears, or what replaces it) was never
   observed. The candidate's "accepted" step guessed `where confirm is absent`, and that guess
   on an unseen state is the step that was refused. The refusal code is about the undeclared
   field. Even with that fixed, the filter would rest on a state the run never saw.
5. **The two rejections were right.** For 0006, the model built `/friends/` against the
   server origin instead of the `~` scenario root. For 0008, a second modal appeared after the
   cookie dialog was dismissed, and the guard named both the layer and its close buttons. The
   model followed it exactly at 0010 to 0012.
6. **The model kept re-reading data it already held.** Steps 0023, 0029, 0031 and 0039 re-asked
   reads it already had (two already_answered, one repeat_refused, one recall). Its summaries
   repeatedly said "to see each row's mutual-friends text" after 0028 had returned exactly that.
   This cost 4 decisions, about $0.0097. The loop then spent 4 more decisions (about $0.0114)
   resending a refused candidate unchanged rather than fixing line 27.

## Accounting

Prices were checked against Core `runtime/llm/deepseek/pricing.ts`, where deepseek-flash peak
rates are $0.006/M cache-hit input, $0.30/M cache-miss input and $1.20/M output, and off-peak
is ×0.5. Solving three steps' usage against `costUsd` gives exactly 0.006 / 0.30 / 1.20, so
**every call was billed at the full peak rate**. That matches the clock: calls ran
08:30:22 to 08:31:36 UTC on Friday 2026-10-09, inside the weekday 06:00-10:00 UTC peak window
(`automationStudioDeepSeekOffPeakAt` returns false). No step's meta or request carries an
explicit peak or price field. The rate in force is applied inside the cost estimate.

| Step | Phase | Input | Cache hit | Cache miss | Out | Cost USD |
| --- | --- | --- | --- | --- | --- | --- |
| 0001 chat | chat | 1956 | 1792 | 164 | 84 | 0.000161 |
| 0003 | explore | 14430 | 1408 | 13022 | 79 | 0.004010 |
| 0005 | explore | 15227 | 5888 | 9339 | 89 | 0.002944 |
| 0007 | explore | 15488 | 6272 | 9216 | 78 | 0.002896 |
| 0009 | explore | 16373 | 7296 | 9077 | 78 | 0.002860 |
| 0011 | explore | 16548 | 7424 | 9124 | 75 | 0.002872 |
| 0013 | explore | 15494 | 7936 | 7558 | 82 | 0.002413 |
| 0015 | explore | 15825 | 8192 | 7633 | 75 | 0.002429 |
| 0017 | explore | 16151 | 10112 | 6039 | 72 | 0.001959 |
| 0019 | explore | 16928 | 10368 | 6560 | 82 | 0.002129 |
| 0021 | explore | 17319 | 8704 | 8615 | 73 | 0.002724 |
| 0023 | explore | 18197 | 11520 | 6677 | 70 | 0.002156 |
| 0025 | explore | 18425 | 12288 | 6137 | 96 | 0.002030 |
| 0027 | explore | 23011 | 10240 | 12771 | 214 | 0.004150 |
| 0029 | explore | 21333 | 11520 | 9813 | 213 | 0.003269 |
| 0031 | explore | 21594 | 15360 | 6234 | 73 | 0.002050 |
| 0033 | explore | 23737 | 15360 | 8377 | 640 | 0.003373 |
| 0035 | explore | 25303 | 17792 | 7511 | 84 | 0.002461 |
| 0037 | explore | 25377 | 19200 | 6177 | 603 | 0.002692 |
| 0039 | explore | 26074 | 19328 | 6746 | 70 | 0.002224 |
| 0041 | explore | 26512 | 19968 | 6544 | 603 | 0.002807 |
| 0043 | explore | 26537 | 19328 | 7209 | 607 | 0.003007 |
| 0045 | explore | 26526 | 19712 | 6814 | 606 | 0.002890 |
| **Total** | 23 calls | 444365 | **267008 (60.1%)** | 177357 | 4746 | **0.060504** |

- The total is $0.060504348: 22 build calls at $0.060343596, the figure in the build-finished
  event (`calls: 22`), plus 1 chat call at $0.000161.
- **Calls: 23 of the 48 limit. Cost: $0.0605 of the $0.10 ceiling (60.5%).** No ceiling or
  limit was hit.
- Average cost was $0.00263 per call, against round 1's ~$0.0013. The ×2 is the peak rate. At
  off-peak these same tokens would cost $0.030252, about $0.0013 per call, the same as round 1.
  Cache misses are the bulk of the bill: 177k miss tokens × $0.30/M = $0.0532 of the $0.0605.

## Running identities

All four `snapshots/running-*-identity.json` have `"verified": true`, with expected equal to actual:

- Build (`running-build-identity.json`): `fluxiq.build-identity.v1`, e2e-chromium 0.1.0,
  inputsDigest `cdba7c82…f336`, coreInputsDigest `d28d1c60…10dd`, domainInputsDigest
  `b682ff72…0452`, the same for background and content; `"verified": true`.
- Core (`running-core-identity.json`): `fluxiq.core-runtime-identity.v1` 0.7.0, artifactDigest
  `68ad7d7d…31cf`; `"verified": true`; reachedInputsDigest `44795eeb…004e`.
- Host (`running-host-identity.json`): `@fluxiq-web-extension/domain-host` 0.1.0, artifactDigest
  `e89f3b91…c9f8`; `"verified": true`.
- Server adapter (`running-server-adapter-identity.json`): `fluxiq/web-client-gateway-server`
  0.1.0, artifactDigest `3f8ba915…3225`; `"verified": true`.
- `run.json` repositories: facility commit `0064c9bf4e12…` (dirty: only the report
  `lane-d-candidate.md` was modified), core commit `dcaf8f9fb3e0…` (clean). Extension sha256
  `6281f99f…bb3c`.
- Campaign log: `[lab] live panel: side-panel (verified open)`; the prelude rebuilt nothing and
  reused all 7 build steps by their stamps.

The run's own logs (`logs/*.log`) print no identity-check lines. The only record is the
snapshot files above.

## Build ending

- `events.ndjson` seq 9 (08:31:39.869Z): "The extension's chat: instruction ended".
- seq 10 (08:31:45.150Z), `runtime.settle`: "The live Flow build finished" `{calls: 22,
  interventions: 0, totalEstimatedCostUsd: 0.060343596}`.
- seq 11 (08:31:45.259Z), `error`: `lab.chat_build_failed` / `flow_lane.flow_not_built`. The
  issue codes were `flow_bootstrap.evidence_repeat_without_progress`,
  `candidate.last_submission_refused:1`, `candidate.last_submission_sent_again:4`,
  `…issue:web.handle.unknown_field:line.27` and
  `…issue:web.handle.expected.extract_list.handle_fields:line.27`,
  `llm_evidence_loop.repeat_refused`. `secondsToEnding: 78.3`, `ending: "failed"`.
- **The chat's final message** (`said`): "The build failed: the Flow it wrote was refused
  because the step 'read the accepted requests' points at something that wasn't seen on the
  page, and then it was sent again unchanged 4 times, so nothing was tested. The Flow \"Go
  through my friend requests and confirm everyone I have at least five...\" has no steps yet,
  but it keeps your instruction, so you can build it again."
- seq 12 (08:31:48.412Z): final browser checkpoint. `run.json` status/verdict: failed;
  startedAt 08:27:12.628Z, finishedAt 08:31:49.738Z.
- **Lab ledger finish line** (`C:\Users\osrs_\FluxStuff\lab-slots\spend-ledger.jsonl`, line 194):
  `{"event":"finish","launchId":"launch-mv0pc77s-f36c62dc","at":"2026-10-09T08:31:50.216Z","instance":"t275-slot-4","task":"social-network-feed/social-network-feed-confirm-requests","fingerprint":"sha256:28ceef28…9d46","exitCode":1,"runId":"run-mv0pcfaf-cd251bdc","verdict":"failed","totalEstimatedCostUsd":0.060504348,"buildCeilingUsd":0.1,"maxBuildCostUsd":0.060343596000000006,"buildsOverCeiling":0,"balanceFailure":null}`
- Campaign log line 41: `{"lab":"live-guard","state":"recorded","runs":[{"runId":"run-mv0pcfaf-cd251bdc","verdict":"failed","totalEstimatedCostUsd":0.060504348,…}]}`.
  The totals were providerCalls 23, reportedTokens 447071 and reportedCostUsd 0.06050435.

## Commands run and observed results

These were read-only shell and Python reads of the files above. They found:

- `costUsd` matches 0.006/0.30/1.20 per million exactly (solved over steps 0005/0007/0035 and 0003/0013/0041).
- A grep for "too fast" returned nothing.
- A grep for clicked handles found only t12, t476, t481, t554 and t682.

## Not verified

- Round 1's own token counts and launch time were not read. The ×2 claim rests on this run's
  peak rate, the off-peak recomputation ($0.0013/call) and the brief's round 1 average.
- Screenshots were not viewed.
- I did not check that a repeat-over re-binds t763 to each kept row, because no trial ran.

## Open questions or contradictions found

- The candidate labels t479 "close the cookie banner", but t479 is the notifications modal's
  "Close".
- t763 is Tom Becker's Confirm, and he has 1 mutual friend. This depends on row re-binding.
- The repeat guard reports `maxRefusedInARow: 3`, yet the ending says the candidate was "sent
  again unchanged 4 times". The already_answered refusal at 0040 sat between the 2nd and 3rd
  resends, which presumably reset the in-a-row count. Worth confirming that this is intended.
