# Manual panel build on eldorado.gg (OSRS mining accounts), 2026-11-27: why Next page stalled and the model re-asked

The user ran a manual build from the FluxIQ web panel: answer-first, `claude-haiku-5-5` for every decision, on the real
site eldorado.gg. The task was: "Go to eldorado.gg. Go to OSRS accounts. Search for mining accounts. Make a flow that
returns all mining accounts where mining lvl is > 30 and return a list of up to 10 pages of results ... just use regex
text search if you can in processing layer."

The debug was done offline from a copy of the panel's step log (`panel-steps-af`, steps 0001-0103; the run was still
writing when the first copy was taken, and step 0103 ended `threw AbortError`, which reads as the user stopping it). It
was traced through the code in the main checkouts of Core (`!FluxIQ/packages/fluxiq`) and this repository, read only.
Nothing was edited, built or run against a browser or provider, and no git command was used.

## Summary

- **The first Next page never pressed anything, and it was still reported as "may have landed".** The model put `list`
  at the top level of the parameters instead of inside the required `nextPage`. Nothing checks a call's parameters
  before it is sent, so the command reached the page with no request. The page failed it in 1 ms with a plain error
  that does not say "nothing was done". Next is a committing act, so the domain read that failure as ambiguous and
  Core held it as uncertain.
- **The second Next (a click on the pager's Next button) did land.** Its acknowledgement and the look after it both
  timed out, the click had no `expectedState`, and so nothing checked the page. A page turn has an effect anyone can
  see on the page (the address, the pager's current mark, the rows), but nothing reads it.
- **The repeated "this is exactly the step it had already tried" came from three defects stacked together:**
  - a full-page capture that failed was filed as an answer;
  - a full page that did not fit the budget showed only its first tenth, which holds no pager and no rows;
  - repeats answered from memory never pass through loop detection, so the 2-repeat rule never fired, and only the
    12-call no-progress window caught the loop, at 16.
- **The read on `page=2` was not refused as a repeat.** The look before it timed out. An unreadable page in an arrived
  build is reported as "not at the start location, go to `https://www.eldorado.gg/`". That is wrong, and it is the
  same bytes as the previous refusal, so the domain called it "the same answer as before". The repeat guard's page
  identity keeps the whole address, query included.
- **The two unusable replies were sent to tools that could not be strict.** `core_run_node` and `core_loop_decision`
  each hold an open object, so the grammar could not constrain them. One reply wrote function-call markup into a
  string. The other filled an `act` field that `core.loop_decision` should never have been offered.
- **Under all of it, every command on the listing page waited about 20 s before the page acted** (the readiness wait,
  task t1094). That is why acknowledgements and captures ran into their roughly 35 s timeouts. This debug does not fix
  it.

Cost through step 0092: 46 decisions, $0.127. Of those, 17 decisions ($0.056, 44%) went on calls refused as repeats,
and 2 ($0.0055) on unusable replies.

## Timeline

| Steps | What happened |
| --- | --- |
| 0001-0009 | An earlier "try agian" chat. The build asked the person what to do four times, then the provider call was aborted. Not part of this task. |
| 0010-0017 | Chat turned the instruction into a build. The build navigated to eldorado.gg, opened Accounts and then OSRS (all fast, about 1-4 s per step, on the home page). |
| 0018-0027 | On the OSRS listing (`/osrs-accounts-for-sale/a/10-1-0?pageSize=24`) the build detected the list (one wrong handle first) and got one unusable reply (0022). It read 24 rows and declared regex processing on the title, which kept 2 rows. The site search for "mining" was never used. |
| 0028-0029 | **Next page #1**: `web.output.dom-next_page` with `{"list": "list.02b9..."}`, which leaves the required `nextPage` missing. It came back `action_failed` with `outcome_uncertain` after 73.6 s. The page it returned still showed `button "1" current` and `"Previous page" disabled`. |
| 0030-0031 | The model asked `core.full_page` to check. The capture timed out (35.5 s) and came back `core.full_page.unavailable`. |
| 0032-0045 | `core.full_page {}` was asked 7 more times. Each was answered "already answered ... it will get this same answer until an action runs". |
| 0046-0047 | **Next page #2**: `dom-click` on `t2770` ("Next page"). Its acknowledgement timed out (35.1 s) and so did the capture after it (35.1 s), giving `action_timed_out` and `outcome_uncertain`, with no page on the result. |
| 0048-0049 | `core.full_page` captured the page: `?pageSize=24&page=2`. It is 180,566 characters, shown as "part 1 of 10". |
| 0050-0059 | `core.full_page {}` was asked 5 more times and answered from memory each time. The model wrote "URL now shows page=2" (0054) and still asked. |
| 0060-0061 | next_page in the right shape (`nextPage: {list, control}`). The look before it timed out (37.7 s), giving `not_at_start_location`, `startLocation: https://www.eldorado.gg/`. |
| 0062 | **Loop detection's first finding**: steer, `no_progress x16`. |
| 0063-0064 | Unusable reply on `core.loop_decision` (`act: ""`). |
| 0065-0078 | change_approach, then 3 more `full_page {}` refused as `near_repeat x6`. An extract_list on page 2 was refused `not_at_start_location` with `repeatedAnswer: 2` (0076, look timed out at 36.1 s). |
| 0079-0080 | "The round kept repeating itself": a fresh round started from the page as it stood (`page=2`), not from the start page. |
| 0081-0103 | Same pattern: `full_page {}` captured, then asked again and answered from memory (0086, 0090, 0097, 0099). The model said it wanted to "find the Next page control" (0098). A replay of the read kept 24 rows. 0103 was aborted. |

## Question 1: why a page turn is held as an uncertain lasting act

### Next page #1 (0029): an invalid call was sent, and its plain failure was read as "may have landed"

- **The call.** `call.json` holds `{"node": "web.output.dom-next_page", "parameters": {"list": "list.02b9091a89067d0b0d25bb16664c"}}`.
  The node declares one required parameter, `nextPage: {list: "extraction.N", control?: "tN"}`; the description the
  model saw is on the 0029 result under `describedNodes`. Core's note on the result says `undeclaredParameters: ["list"]`.
- **Nothing refuses it before dispatch.** `!FluxIQ/.../runtime/llm/node-tools/describing-failures.ts:92` works out the
  undeclared keys only *after* a call has failed, to explain it. The domain's resolution
  (`domain/src/runtime/llm-evidence/plan-resolution/next-page-slot.ts`) sees `nextPage` undefined, returns `literal`,
  and leaves the call as written. `domain/src/client/gateway-action-parameters.ts:97` maps `nextPage` to `undefined`
  and drops `list`. So the extension receives a `web.dom.next_page` command with no request.
  - Playback does refuse this case before sending (`domain/src/output-nodes/next-page/dispatch.ts`,
    `web.next_page.invalid_request` at stage `dispatch`). The build path does not.
- **The page fails it in 1 ms, and the failure does not say nothing was done.** The 0029 spans show `send.next_page`
  starting at 22.66 s and `page.next_page` running at 43.93 s for 1 ms (after the readiness wait), then `failed`.
  - `apps/extension/src/content/actions/next-page.ts:66` reads
    `if (!request) return deps.failure(action, new Error("web.dom.next_page needs nextPage parameters."), startedAt);`.
    That is a plain `Error` with no failure record, so `actionFailure` (`content/action-runtime/results.ts:157`) files
    it as a generic failure with no `effect: "unacted"` and no `dispatch` stage.
- **Next is a committing act, so a failure that does not say "unacted" is "ambiguous".**
  `domain/src/actions/action-effect/table.ts:35` has `"web.dom.next_page": { effectClass: "commit" }`.
  `domain/src/runtime/lasting-act-statement.ts:80` states such a failure `effect: "ambiguous"` unless it was unacted.
  Core then holds it back and reports `lastingAct: "uncertain"` (`node-run/retries/dispatch.ts`). The domain turns
  that into `outcome_uncertain` (`node-run/retries/uncertain-outcome.ts`), whose words say "this step was sent to the
  page ... making it twice could do it twice".
- **What was actually true.** Nothing was pressed. The page returned with that very result shows `button "1" current`
  and `"Previous page" disabled`, so the list never moved.

### Next page #2 (0047): the click landed, and nothing checked the page for it

- **The call.** `dom-click` on `t2770`, the pager's "Next page" button. The spans show `look.before` at 22.1 s, almost
  all of it the readiness wait. `send.click` then ran 35.1 s and ended `timed_out` with no page-side span, and the
  capture after it also ended `timed_out` after 35.1 s. The page answered nothing in time. The next capture (0049)
  says `ARRIVED reload` on `&page=2`, so the click most likely reloaded the document and the acknowledgement was lost
  with it.
- **The effect check could only say "unknown".** `node-run/retries/effect-check.ts:45` judges only the call's own
  `expectedState`, and returns `unknown` when there is none, as there was here. So Core kept the press as uncertain,
  and the result carried no page at all, only the `outcome_uncertain` words.
- **What was actually true.** The press landed. 0049 shows `?pageSize=24&page=2` with the pager marking
  `button "2" current` and `"Previous page"` enabled. Exactly one page turn landed in the whole run, which matches #1
  never pressing.

### Is the effect check unknown because the 20 s readiness wait ran out?

- **For #1, no.** The call was invalid and nothing was pressed. The readiness wait only delayed the 1 ms failure.
- **For #2, partly.** About 20 s of the command's roughly 35 s went to the readiness wait. The reload then left no
  page to answer the acknowledgement or the look after it in the time left.
- **But the deeper cause is the same in both cases.** The page turn's effect is never checked from the page; there is
  only an `expectedState` the model did not write. Every command on the listing page waited about 20 s before the
  page acted. For example, step 0025 ran five commands in 110.9 s, each page-side span starting about 20.3 s after it
  was sent; on the home page (0013, 0017) the wait was under 0.1 s. That wait is t1094's to fix.

### Should a page turn ever be held from retry?

- **From a blind retry, yes.** A page turn is not idempotent: pressing Next again after a move that did land skips a
  page and loses its rows from the result. Keeping `next_page` as `commit` is right.
- **Left "uncertain" for the model to settle, no, whenever the page can answer.** A page turn's effect is plain on the
  page: the address, the pager's current mark, and the list's first rows. The framework should settle it the way the
  extension's own `next_page` already decides `moved` against `list_unchanged`. With that:
  - a move that landed counts as done;
  - a page that answered and still shows the same list and pager can safely be pressed again (it did not land);
  - only a page that cannot be read stays uncertain.

  This keeps the user's rule (never repeat a lasting act that may have landed) and stops handing the model a question
  it cannot answer cheaply.

### Fixes

1. **Refuse a call that misses a required parameter, or names one its node does not declare, before anything is sent.**
   - Put the check where the definition is already held: Core's run-node library
     (`describing-failures.ts` already holds the definition and computes `undeclared`). A domain declares any shorthand
     it accepts (such as a bare handle).
   - The refusal names the parameter and its shape, which the node definition already carries. It costs no page
     action and no 70 s.
2. **A verb that fails before it touches the page says so.** In `next-page.ts:66`, the missing request fails with a
   record at stage `dispatch` with `effect: "unacted"` (as playback's `invalidRequest` does). Then
   `webLastingActStatement` keeps it `unacted`, and Core retries or refuses it plainly instead of calling it uncertain.
   The same applies to every verb's guard that runs before any gesture.
3. **Give page turns an effect check read off the page** (domain, `retries/effect-check.ts`).
   - When a next_page, or a press on the control a detected list names as its pager, loses its acknowledgement: wait
     for a readable page (as `captureAfterAction` already waits out a reload), then compare it with the page the call
     found:
     - the address, which keeps its query (`page=2`);
     - the pager's current mark;
     - the list's first-row identity.
   - The verdicts:
     - **landed** when any of them moved forward;
     - **not_landed** only when the page answered and the list and pager are unchanged, since an unchanged list is the
       verb's own definition of failure (`list_unchanged`);
     - **unknown** only when no page could be read.
   - Generic presses keep their current rule: a change can prove that a press landed, but no change does not prove it
     did not.

### Offline proof on this recording

- **Fixes 1 and 2.** Run 0029's `call.json` through the domain's node-run with a gateway that records commands, as
  `node-run/tests/` already does. Assert that no `web.dom.next_page` command is sent and that the refusal names
  `nextPage`.
  - Extension unit test: `nextPageAction` with no `nextPage` gives `failure.effect === "unacted"` at stage `dispatch`.
  - Then `webLastingActStatement("web.dom.next_page", {}, failure, failure).effect === "unacted"`.
- **Fix 3.** Feed the effect check the recorded pages:
  - Found = 0029's result page (`?pageSize=24`, `"1" current`) and after = 0049's capture (`&page=2`, `"2" current`)
    must give `landed`. This is the outcome step 0047 should have had.
  - Found = after = 0029's page must give `not_landed`, which is what #1 really was.
  - No after page, like 0047's own timed-out capture, must give `unknown`.

## Question 2: why the model kept re-sending a refused identical call, and why loop detection was slow

The re-sent call is `core.full_page` with `input: {}`: 7 times on page 1 (0033-0045), 5 on page 2 (0051-0059), 3 after
the steer (0068, 0074, 0078), and 4 in the next round (0086, 0090, 0097, 0099). Four defects combine.

### A. A capture that failed was filed as an answer (0031, then 0033-0045)

- **What 0031 returned.** `view-channel/binding.ts:77` returns
  `{unavailable: "The whole page could not be captured just now; the page each result carries is still current."}`,
  with no `ok: false` and no state digest.
- **Why that counts as an answer.** The loop registers a request as answered before it runs. A look that refuses
  itself is un-registered only when its evidence says `ok: false` (`repeat-policy.ts:136`,
  `automationStudioLlmEvidenceLookWasRefused`). This one did not say so, so it stayed answered.
- **Why the look was not taken again.** The once-only fresh look on a repeat runs only when the answering call left a
  state (`decision-handlers/answer-check.ts:47`), and this one left none.
- **What the model was then told, 7 times.** "It was answered at iteration 10 and no action has run since ... it will
  get this same answer until an action runs."
- **The deadlock.** The `outcome_uncertain` words tell the model to check with `core.full_page` before pressing again.
  The check came back "unavailable", and the repeat guard says the check will not be run again until it presses.
  Every rule it had been given closed the way out. The unavailable text is also false here: "the page each result
  carries is still current" when 0047's result carried no page at all.

### B. The whole page showed its first tenth, which holds neither the pager nor the rows (0049, 0082, 0095)

- **Size and makeup.** The capture is 180,566 characters: 1,087 attribute lines (131,936 characters, of which `href`
  is 45 KB, `class` 20 KB, `src` 12 KB and Angular `_ngcontent` 8 KB) and 945 hidden-element lines. Hidden navigation
  menus come first in page order. The list's pager starts at character 145,759 (part 8 of 10).
- **What part 1 can tell.** Part 1 (20,000 characters) shows the URL line with `page=2` and nothing that says whether
  the list moved.
- **A full page replaces the page the model had.** `view-channel/projection.ts` says "a `core.full_page` capture is
  delivered whole and starts that key again from it". So after 0049, the page the model sees for this address is part
  1 of 10.
- **Stale page-1 views stay visible beside it.** Refusals nest their page under `page`, outside the projected member,
  so those views stay inline. In request 0050, the pager appears only as `button "1" current` (inside the 0019 and
  0029 refusals). `button "2" current` appears nowhere.
- **So the model held two answers that disagreed:** the URL said page 2, and the only pager it could see said page 1.
  It kept "checking" with `{}`.
- **What the refusal said.** "use it, choose a different tool or input, or complete". It never said that parts 2 to 10
  exist, nor which part holds what it was after. The window's `rest` line did say "Call core.full_page with part 2",
  but on a 90K-token request Haiku never took it.
- **Measured.** The page as anyone sees it, without hidden elements and attributes, is 17,831 characters and fits the
  budget whole, with the pager at character 8,435. The compact result view at 0029 (17,316 characters) carried the
  pager too. Asking for the whole page made the model see *less* of what mattered.

### C. Repeats answered from memory never reach loop detection

- **Where the check is skipped.** `evidence-loop.ts:764` reads
  `admitted.triedHere ?? (rerunning || admitted.answered ? undefined : automationStudioLlmEvidenceLoopCheck(...))`.
  A request answered from memory skips the loop check. It goes to `watch.answered`
  (`repeat-guard/loop-detection/watch.ts:218`) and then `detector.unrun` (`detector.ts:391`), which only counts.
  `unrun` returns no finding, so the near-repeat rule (`limits.ts:5`, 2 runs) cannot fire for these calls.
- **What fired instead, and when.** The no-progress window (`limits.ts:25`, 12 calls) is reported only from `ran()`,
  when some *other* call runs. That first happened at 0061 (the next_page that came back `not_at_start_location`).
  The window then stood at 16, and 0062 is `steer no_progress x16`.
- **What happened after the steer.** The ladder then refused `full_page {}` itself (0068 `near_repeat x6`). The first
  dozen repeats had cost one decision each with no steer at all.

### D. The framework left an observable outcome for the model to settle

Both "check" loops start from `outcome_uncertain`. With Question 1's effect check, 0047 would have come back as a
landed page turn. There would have been nothing to check, and the model would have read page 2.

### Fixes

1. **A capture that could not be taken is a refusal** (`binding.ts`).
   - Answer `{ok: false, code: "core.full_page.unavailable", ...}`, so `LookWasRefused` frees the identical retry
     and the next ask really captures.
   - Say what is true: name the newest page the window holds, or that no current page is held.
   - The capture timing out is t1094's; this only stops a failed look being treated as an answer.
2. **When the whole page does not fit, its first part is the page as anyone sees it** (Core `view-channel/parts`, or
   the domain's full view order).
   - Order: visible elements first, in page order, then hidden elements and attributes in later parts.
   - When a split answer is asked again, the already-answered note names the parts not yet shown and how to ask for
     one.
   - Optionally, the domain drops attributes that carry no meaning for acting, such as framework-generated `_ng*`
     markers and inline SVG path data. That is a cleaning choice, so it needs the user's page-diff rules. The ordering
     alone fixes this run.
3. **Repeats answered from memory go through loop detection like any other refused call.**
   - `detector.unrun` returns the near-repeat finding once an entry reaches `NEAR_REPEAT_AT`.
   - `watch.answered` and `watch.guardRefused` hand it to `found()`, as `ran()` does.
   - The loop then steers or asks for a loop decision at the 2nd ask, not the 16th. No count ends anything; this only
     moves where the existing ladder is told.
4. **Question 1's effect check** removes the "check before pressing again" instruction where the page can answer.

### Offline proof on this recording

- **Fix 1.** Core evidence-loop test with a `core.full_page` binding that answers unavailable and then captured, and
  the recorded decisions 0030 and 0032. The second call runs and captures; it is not `already_answered`.
- **Fix 2.** Split 0049's `pageView` lines with `automationStudioLlmPageParts` under the visible-first order. Part 1
  must contain `t2764 button "2" current` and `t2770 button "Next page"`; today it contains neither.
- **Fix 3.** Build loop-replay events from this step log (`packages/test-runner` `loop-replay/` and Core's
  `automationStudioLlmLoopReplay`). The answered refusals become `answered` events.
  - Today the replay must reproduce the first firing at step 0062 (`no_progress x16`).
  - With the fix, it must fire `near_repeat` at the second answered ask, at step 0035 or earlier.

## Question 3: does the repeat guard's page identity drop `?page=2`?

**No.**

- **The guard keeps the whole address.** The repeat guard and loop detection key a call on the page state digest. The
  domain builds that digest with `location: evidence.location`
  (`domain/src/runtime/llm-evidence/state-digest/state-digest.ts:156`), query included. The page-2 calls were counted
  apart from the page-1 calls: the `near_repeat x6` at 0068 counts 0049 plus the five answered asks 0051-0059, all
  on the page-2 state, and none of the seven page-1 asks.
- **The query is dropped only where the user's rule drops it.** The page channel's key (`pageView.key`,
  `.../a/10-1-0`) drops the query as the user's 2026-11-25 rule says, for diffs only, and the URL line still shows it.
- **What the user actually saw at the page-2 read was a different defect.** Step 0076, an extract_list with the
  address on `page=2`, came back `not_at_start_location` with `startLocation: https://www.eldorado.gg/` and
  `repeatedAnswer: 2`.
  - The look before it timed out (36.1 s). The capture's failure becomes `page_unreadable`
    (`domain/src/runtime/llm-evidence/capture.ts:584`). For a build told a start location,
    `node-run/frozen-execution/page/readable.ts:17` turns every `page_unreadable` into "no page". `run.ts:280` then
    answers any non-navigation call `notThereYet`. `webNodeCurrentPage` (`frozen-execution/page/current.ts`) means
    "not arrived" by `undefined`, and an unreadable page in a build that has arrived arrives at the same `undefined`.
  - "The same reason as the time before" is the domain's repeated-refusal note, which is kept per build and tool
    (`repeated-refusal.ts:87`). 0061 (next_page) and 0076 (extract_list) are both `core.run_node`, and both got the
    same bytes, because the refusal carries no page.
  - The refusal tells the model to go back to the start page. That goes against the user's 2026-11-24 rule that
    nothing sends the browser back to the start page once the attempt has reached it.

### Fix

An unreadable page in a build that has arrived (`run.arrivals.arrived(...)`) is refused as what it is:
`page_unreadable`, carrying the host failure (`timed_out`) and which look it was. Only a build that has not arrived
gets `not_at_start_location`. `webNodeCurrentPage` should return the two cases apart (not arrived, or unreadable)
instead of one `undefined`.

### Offline proof

Domain node-run test, beside `node-run/tests/start-location.test.ts` and `arrival.test.ts`: arrive with 0011's
navigation, then replay 0076's `call.json` with a gateway whose `web.dom.capture_snapshot` answers `timed_out`. The
refusal is `page_unreadable` (timed out), not `not_at_start_location`. A build that has not arrived still gets
`not_at_start_location`.

## Question 4: what made the two replies unusable

Neither tool was sent `strict`. `models/providers/anthropic/grammar.ts:47` marks a schema with an open object
unrepresentable, and `decision-tools-wire.ts` then sends it non-strict:

- `core_run_node`'s `input.parameters` is `{type: "object"}`;
- `core_loop_decision`'s `input.result` is `{type: "object"}`.

The strict tools in these requests were `complete`, `web_detect_repeating_structure`, `web_describe_element`,
`core_describe_nodes`, `core_recall_result` and `core_full_page`. Nothing constrained what the model sampled for the
other two.

- **0022 (`core_run_node`, read the list).** The streamed tool input has `"input": "\n<parameter name=\"node\">web.output.dom-extract_list"`,
  a string that holds the model's own function-call markup. `parameters` and `consequences` sit beside `input`
  instead of inside it. The misses: `response.decision.input must be an object`; `parameters` and `consequences` are
  keys the wrapper does not take. This is the known failure of a nested input the grammar does not hold. Haiku wrote
  it once in about 45 decisions.
- **0063 (`core_loop_decision`, change_approach).** The decision itself was sound (stop pressing Next, read page 2 by
  its address), but the reply carried `act: ""`, which fails `^a[1-9][0-9]{0,2}([.][a-z]{1,16})?$`.
  - `act`, `place` and `add` are offered on every tool-call variant (`runtime/llm/evidence-loop-decision.ts:403`,
    `AUTHORING_CALL_PROPERTIES` at 415 and 424). That includes `core.loop_decision` and `core.full_page`, whose calls
    are never steps of the Flow and do no act.
  - The model filled a field that should not have been offered, and a whole paid decision was re-asked.

### Fixes

- **0063.** Offer `act`, `place` and `add` only on tools whose calls can become steps: `core.run_node`, and any other
  tool whose call the draft keeps. Close `core.loop_decision`'s `result` with the completion's own result schema
  (`complete` is already strict), so the tool can go strict.
- **0022.** `core_run_node` can be strict only if its `parameters` is closed, for example with each described node's
  parameters as a closed schema. That has to fit the grammar's per-request limits (20 strict tools, 24 optional
  parameters, 16 unions) and its compiled size: `strict-answer-schema.ts` records the API refusing a schema that met
  the counted limits.
  - This is t1093's subject ("strict tools fit the provider's grammar"), so this debug only gives it the fixture.
  - Reading 0022's reply some other way would be a guess, so it should keep being refused.

### Offline proof

- **0063.** Build `automationStudioAnthropicDecisionToolsWire` from 0063's recorded `request.json` tools with the
  change. `core_loop_decision` has no `act`, `place` or `add` and is `strict: true` within the counted limits. With
  `act` gone from the offer, the grammar cannot produce 0063's reply; the API-side compiled-size check needs one live
  request, which is t1093's.
- **0022.** It becomes a regression fixture for t1093. Its raw reply is in `0022-decide/response.json`.

## The round restart (what the user saw as item 5)

- **What ended the round.** At 0079 the ladder reached `change_approach` on `near_repeat x6`, after refused repeats
  in a row (`AUTOMATION_STUDIO_LLM_LOOP_REFUSALS_BEFORE_CHANGE = 3`, `limits.ts:31`). The round ended as
  `repeat_without_progress`, which is loop detection acting on a repeat, not a step count.
- **Where the new round started.** It began on the page as it stood: 0080 looked at `&page=2`, not the start page.
  That part behaved as the user's rules ask.
- **Why the restart did not help.** It was the end of the deadlock in Question 2, and it fixed nothing: the new round
  went straight back to `full_page {}` and was answered from memory again (0086, 0090, 0097, 0099). Fixes A-D remove
  the cause.

## Other observations (not asked; recorded for the lead)

- **The search was skipped.** The build never used the site search for "mining". It read the whole OSRS listing at 24
  per page, and the regex kept 2 of 24. Ten pages at that rate would yield about 20 rows.
- **The chat may have misread "10 pages".** The chat's reading of the instruction (0010) included
  `process: {..., limit: 10}`, which reads "up to 10 pages" as ten *rows*. The build's own processing declaration
  (0027) dropped `limit`, so it had no effect here. The panel-command reading needs a look.
- **The regex uses an inline flag.** The declared regex starts with `(?i)`, which JavaScript's `RegExp` rejects as
  written. The result said `kept 2` and `leftOut 22`, so Core accepted it somehow; how it treats `(?i)` was not traced.

## Owned elsewhere

- **The ~20 s readiness wait** before every command on the listing page, and the ~35 s timeouts it pushes into: t1094.
- **Making `core_run_node` strict:** t1093.

## Not verified

- **Whether 0047's lost acknowledgement was caused by the reload or only by the wait.** 0049's `ARRIVED reload`
  suggests the click reloaded the document; the extension's trace was not read.
- **Exactly where the "1 current" views in request 0050 come from.** They are visible inside the refusals of 0019 and
  0029. That refusal pages are never projected by the page channel is inferred from where they sit in the request,
  not traced in `projection.ts`.
- **Whether the API would compile a strict `core_loop_decision` beside the other strict tools.** It needs one live
  request.
- **None of the offline proofs above has been written or run.** They are designs for the lanes that take the fixes.
