# A8 wave 9 debug: social-network-feed-confirm-requests, `run-mv9ml775-9872e63e`

Read-only debug. No live or Lab run and no provider call were made, and nothing was committed. Pair: downstream `1ef54cd1`, Core `658d95ff` (`fxwork/t566/!FluxIQ`). Steps are under `lab-runs/2026-10-15/run-mv9ml775-9872e63e/steps/`. The wave 8 comparison run is `run-mv9gbsqg-f10e7718`.

## Outcome

Diagnosed. Three of the build's revisions met the oracle: candidate rev 1, candidate rev 2, and brief-6's subflow rev 1. The task's oracle needs the 4 requests with `mutualCount >= 5` confirmed, the other 4 left `pending`, and a table of only the accepted rows (`oracle/confirm-requests-facts.js`, `content/requests.js`). Each of those three revisions was held back by Core's verification gates, or lost by the supervisor's rescued-pass bookkeeping.

The main cause is in Core's exclusion-evidence gate. Two kinds of left-out row are never "settled" by Core, although Core measured them:

- **Diego Alvarez's empty value.** The row has an empty `mutualFriends` cell, and the condition is a numeric bound.
- **Rows without "Request accepted".** The final read's `contains ["Request accepted"]` condition left out four rows whose witness is `state: absent`.

Because these rows are not settled, every yes must quote the request beside each one, row by row. DeepSeek Flash's yeses kept failing that sentence-shape check. Wave 8 had the same two unsettled rows and passed only because its judges' wording happened to satisfy the check.

## What changed and why

Only this report changed.

### (1) Why 0105's repair was opened after 0099's yes, and whether that yes stood

- **The yes was held for the slow-down.** At 0099, `core.test_candidate` rev 1 returned `ok: true, verdict: "yes"` with the instruction: "The trial passed, but the site asked the run to slow down, and this Flow does not answer that itself yet, so this revision cannot complete." It came with a `slowDown` list for steps 8/12/16/20; step 20 had absorbed `web.action.rate_limited`, with `paceMs` 6898 and way out t921.
- **It was a rescued pass.** It meets `rescuedTest` (`project-agents/supervisor/state.ts`): rev 1 was the latest candidate, its standing verdict was yes, the gate refused completion with `candidate.trial_slow_down_unhandled`, and step 20's own record shows a slow-down.
- **The rechecks were what let the yes through.** The judge calls were 0100 (yes, held for exclusion evidence), its recheck 0101 (yes), 0102 (yes, held), and its recheck 0103 (yes). The rechecks named Diego beside "at least five mutual friends".
- **0104 followed the instruction.** The decision was a t603 repair naming the rescued trial: "the confirm loop needs repeat pace of at least 6.9 s and a way out of the rate-limit notice". 0105 then returned `done` with "Revision 2 of the subflow was tried on its own and its trial answered yes".
- **The rescued pass stopped standing at 0129.** Because the repair came back done and changed the subflow, `recoveryRepairsShort` was never set (`dispatch-tool.ts:175`). `rescuedTest` reads only `controller.latest()`, so when 0129 assembled rev 2, rev 1's rescued pass no longer counted for anything.

### (2) Why that pass did not complete the build at the end

- **The ending path.** The build ended on the plain honest-ending branch of `supervisor/completion.ts`. Step 0220 sent `ended: partial`. `automationStudioProjectSupervisorReliesOnRecovery` called `rescuedTest`, which looked at the latest candidate. That was rev 3 (0169), whose latest whole test 0171 was `unsure`, so it returned `undefined` and t622 had nothing to complete on.
- **The reset and the final ending.** `anyNotDone()` held because brief-6 came back partial, so the ending was allowed. It was first refused at 0221 with `project.completion_reset_first` (acts 61-64 were in place). The reset ran at 0223 ("Every lasting act this build made is undone"), and 0226's `ended: partial` was accepted. No guard ended the build.
- **Why it ended without the Flow.** t622 completes only on a rescued pass of the *latest* assembly. Once a successful repair re-assembled the candidate, the earlier passing revision stopped being a fallback. When rev 2 and rev 3 never reached yes, the build ended without a Flow, although rev 1 had a passing, judged whole test. In `summary.json`, the final outcome says the candidate "was judged unsure".

### (3) Why the later whole tests were unsure, and whether each hold was right

| Test | Revision (vs oracle) | Judge calls | Rule that held it | Right vs oracle? |
| --- | --- | --- | --- | --- |
| 0095 | rev 1 (correct) | 0096 yes with `patchNeeded: true`; 0097 no ("change the where condition on s10 ... to the accepted state") | Split yes/no, `model_disagreed` | No: the result was correct. Retested at 0099. |
| 0131 | rev 2 (correct: 4 confirmed, final read kept 4) | Call 1 = 0132: yes, `patchNeeded: true`, did not quote the request beside Diego. Call 2 = 0133: yes held, then recheck 0134: yes, taken. | **The exclusion-evidence rule plus `patchNeeded`.** In `verdict.ts:175`, a yes with unquoted rows becomes `yesUnconfirmed` and is rechecked *only if* `patchNeeded !== true`. 0132 had `patchNeeded: true`, so `verdict.ts:185` turned it into `does_not_answer` with no reading and no recheck. `why`: "the first was that it does what was asked, without quoting the request's words that exclude each row a condition alone left out, the second that it does". The pair is a split, so unsure. | **Wrong.** Two calls said yes over a correct result. |
| 0136 | rev 2 retest (t632 wording at 0135: "the other call named no defect") | 0137: no, `patchNeeded: true` ("re-applied the condition mutualFriends atLeast 5, so it is not a table of every request the list now shows as accepted ... would drop ..."). 0138: yes held, then recheck 0139: yes. | Split yes/no, `model_disagreed`. t631 weighing did not label the no: its claim is hypothetical, and nothing in the record refutes it. | The hold follows the rule and the no's concern is legitimate design advice, but the result was correct against the oracle. **0140 then repaired on this no.** That brief (0141) removed the condition, which broke the Flow. |
| 0171 | rev 3 (**wrong**: final read "saw 8 rows and kept 8", stored 12 rows, unaccepted rows in the table) | 0172: yes (wrong). 0173: no, `patchNeeded: true` ("Add a where condition ... keeping only rows the list shows as accepted"). | Split, unsure. t631 correctly left the no standing. | Unsure is the right side (an ideal result would have been no). |
| 0208, 0214 (brief-6 subflow trials, called by 0175) | subflow rev 1 (correct: s4 `mutualFriends atLeast 5`, s13 `contains ["Request accepted"]`, each kept 4) | 8 of 8 calls said yes: 0209 and its recheck 0210, 0211/0212, 0215/0216, 0217/0218 | **The exclusion-evidence rule** (`yesUnconfirmed: true`, `candidate.trial_not_judged`): "The checks did not provide the required exclusion evidence". The recheck at 0210 still demanded row-by-row quotes for Diego (s4, "(no value)") and for Tom/Priya/Diego/Marta (s13). | **Wrong.** The revision was correct, and it was the most robust shape the build produced. |

There was no t633 standing-no and no t607/t631 refuted-no in any test. No double no ever happened.

**Why those rows were not settled** (`result-verification/value-readings/settled-rows.ts`):

- **Diego (s4).** His witness is `state: present, value: ""`. A numeric bound settles a row only when the cell reads as a number ("A row whose value states no number, is withheld or empty ... is not settled"). The other three left-out rows were settled: `leftOutSettled` shows Tom, Priya and Marta.
- **The four s13 rows.** Their witnesses are `source: read, state: absent`. `textSettled` settles only `state === "present"` witnesses whose value fails the test. An `absent` witness on a non-negated `contains` is exactly Core measuring the failure, yet it is left for row-by-row quoting.
- **Wave 8 had the same gaps.** `run-mv9gbsqg` 0158 shows the same unsettled Diego and the same `contains ["Request accepted"]` condition, and its 0175/0177 rechecks list the same rows. Its judges' first replies at 0158/0159 happened to pass `unquoted-rows.ts`'s sentence check. This is gate flakiness that judge variance exposes, not a wave-9 regression.
- **How 0210 failed the check.** It quoted the request ("confirm everyone ... leave every other request as it is") in a sentence two sentences away from the one naming the rows. That is not adjacent, so `unquoted-rows.ts` did not count the quote for them.

### (4) Did t631-t635 change behaviour here versus wave 8?

- **t632 did.** It produced the re-test wording at 0131 and 0136 ("Testing this same revision again ... is allowed (retestsLeft ...)"). 0135 followed it, which added one whole test (0136) on rev 2. That retest's split then led the supervisor to repair. Brief-6's subflow trial wording ("do not rewrite it ... Test this same revision again; if its retests run out held the same way, end the brief") was followed. However, 0219 ended partial with `retestsLeft: 1` still showing on 0214 and said "no retests remain". That was a misreading.
- **t631 had no verdict effect.** It weighed 0137's and 0173's nos, labelled neither, and both stood.
- **t633/t634 were inert.** No double no means no `standingNo` and no upheld exclusion to carry across briefs. I did not see a receipt change that altered any decision.
- **t635 is a refactor** and was not observable.
- **The paths differed from wave 8 for other reasons.** Wave 8 kept two subflows (a separate `read_accepted`) and both of its whole tests answered yes. Wave 9 merged everything into one `accept_requests` subflow (0053 amend), whose final read re-applied the bound. That gave the judges a legitimate `patchNeeded` concern (0096, 0132, 0137).

### (5) Root causes and the smallest structural fixes

1. **Core, primary: Core does not settle left-out rows it measured as failing.** Smallest fix, in `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/value-readings/settled-rows.ts`:
   - **Text tests.** Settle a text test's row whose witness is `absent` when `automationStudioRecordConditionHolds(condition, <no value>)` is false as written. A non-negated `contains`/`startsWith`/`endsWith`/`matches`/`equals` fails on no value; a negated one would pass, so its rows are never left out this way.
   - **Numeric bounds.** Settle a numeric bound's row whose witness or cell shows an empty or absent value ("found no `<column>`"), with its own settled sentence. It must say there is no value, not that the value "fails as a number".
   - **What still applies.** Both kinds keep the existing one quote of the request per condition (`boundUnquoted`). A no over such a row still stands. The judge instruction's `leftOutSettled` sentence in the verification prompt (the copy in `request.txt` line 29) needs the "no value" case added. Its source is the loop_verification task text; I did not locate the file.
   - **Tests.** Generic fixtures in `value-readings/tests/` and `request-rows/tests/`, on a different kind of site, never this scenario's names.
2. **Core, secondary: a quote-lacking yes with `patchNeeded: true` becomes a reading-less no.** In `result-verification/verdict.ts` (lines 175-193), let that yes be held as `yesUnconfirmed`/`exclusionEvidenceMissing` and rechecked like any other yes. Keep its `patchNeeded`, so a passing recheck becomes `answersWithChangeAdvised`; under t515, a build test's two yeses still finish on that. Today it forces a split out of two yeses (0131).
3. **Core, supervisor: a rescued pass dies when a repair re-assembles the candidate.** In `project-agents/supervisor/state.ts` (`rescuedTest`), `completion.ts`, and `supervisor-loop.ts` (the guard-end path), keep the newest rescued pass as the build's fallback until a later revision gets a yes or a standing no. On an honest or guard ending with no later pass, complete on that revision, which needs the candidate controller to accept it (it is no longer `latest()`). The person is told the Flow relies on the run's own recovery, as t622 already does. This is a larger change than fixes 1 and 2, so it should get its own brief.
4. **Contributing, model-side, no Core fix proposed.** 0140 repaired on a split's hypothetical no ("would drop any accepted request ..."), which broke a correct revision (rev 3). No model guidance mirroring this task is proposed. Fix 1 removes most of the splits that invited it.

Lab: no defect found. The slot ran, the reset hook ran before each trial, the oracle files are consistent, and the cost was $0.088.

## Commands run and observed results

- `python .../scratchpad/a8-summary.py run-mv9ml775-9872e63e` printed the dispatch/assemble/test timeline above. The same command on `run-mv9gbsqg-f10e7718` showed wave 8 with whole tests 0125 yes and 0157 yes.
- Python dumps of `result.json` for 0099, 0131, 0136, 0171, 0208 and 0214: verdicts, `why`, `yesUnconfirmed`, `slowDown`, `retestsLeft`, and the readings, as quoted above.
- A Python table over every judge `decision.json` (`answersRequest`, `patchNeeded`, `confidence`, recheck present). Diffs of judge `request.txt` pairs (0133/0134, 0100/0101, 0102/0103) found the recheck blocks. A grep of 0209's `request.txt` showed `leftOutObservations` (Diego `present ""`, s13 rows `absent`) and `leftOutSettled` listing Tom, Priya and Marta only.
- I read Core's `agreement.ts`, `verdict.ts`, `verify.ts:200-247`, `exclusion-evidence/recheck.ts`, `request-rows/unquoted-rows.ts`, `value-readings/settled-rows.ts`, `supervisor/completion.ts`, and `supervisor/state.ts` (`rescuedTest`).
- I read the scenario's `oracle/confirm-requests-facts.js`, `content/requests.js` (Diego `mutualCount: 0`, no `mutualLine`), and `live-tasks.js`.

## Not verified

- **Whether fix 1 alone passes these replies.** I did not replay the recorded replies (0132-0134, 0209-0218) through `automationStudioResultLeftOutRowsUnquoted` with fix 1 applied. For s13, the one quote naming condition 1 may still be missing from 0210-style replies, because their quote is the site's "Request accepted", not the request's words. A replay against fixtures built from these replies is the fix's acceptance test.
- I did not locate the source file of the judge prompt's `leftOutSettled` instruction.
- I did not check the server-side oracle state after each trial. I relied on the reads, `endView` and the judges' accounts. The oracle verdict is `null` because no Flow was built.
- I did not trace why 0225's completion, a `summary`-only result, produced no answer step.

## Open questions or contradictions found

- 0219 says "no retests remain", but 0214 reported `retestsLeft: 1`.
- The t515/t574 header in `unquoted-rows.ts` already cites this scenario's Diego row from an earlier run (`run-mv7vmvhd`). The "(no value)" bound row has been a recurring failure in new shapes, which is a case for the structural settle in fix 1 over more quote-shape leniency.
- Fix 3 is a policy choice: completing on a non-latest revision that passed but relies on the run's own recovery. It needs the supervisor's or the user's agreement.
