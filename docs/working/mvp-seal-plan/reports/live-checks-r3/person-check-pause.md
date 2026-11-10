# A robot check pauses the attempt where it is

Run `run-mwa19obz-abd5d558` (crossborder-marketplace-free-hubs-under-ten, Sonnet 5.5, `--attempts 2`). Worker report, t885.

## Outcome

Done. A person-only check now pauses the attempt where it stands, however many checks the site raises, and Continue resumes the same call or step in place. Five causes stood between the live run and that. Each is fixed in Core, and each has a provider-free test that fails when its fix is reverted. A sixth defect was in the words shown to the person, and it is fixed the same way. The headed scripted proof passes both attempts. In attempt 2, the saved Flow's check and a round's check each paused and resumed in place.

## The answers

### (a) At a person-only check, does the attempt end or park?

It never ended (`waiting_for_person` or `stopped`), and it parked in place for the first three checks only. On the fourth check in one round, or in one saved-Flow run, the work was ended without asking anyone, and the attempt carried on from a page still behind the check.

- **Rounds (the model's calls).** Every call goes through `runtime/automation-parking/person-needed-tool-calls.ts`. That wrapper asks, waits with no clock (`answer-first/person-waits/person-wait.ts`), and the attempt reads `waiting_for_person` / `person_only_check` (`attempt/round.ts:171-176`). That is a park in place. But the wrapper's bound counted every question it had ever put (old line 147: `if (asks >= maxAsks) end("asks_exhausted")`, with `MAX_ASKS = 3`), including the ones the person cleared.
  - The fourth check in a round was never asked. The wrapper aborted its signal and threw, and the round ended.
  - `attempt/rounds.ts` does not treat `asks_exhausted` as an ending (`:58`, `:114`). So a fresh round began, on the check page.
- **Saved Flow run (engine).** `flow-run/person-check-port.ts` together with `engine/automation/step-loop/ask-or-park.ts` (`settleAskInPlace`) also parks in place. But `engine/automation/person-needed.ts` (old `:71`) counted every person-needed ask of the run.
  - On the fourth ask the run ended `failed` with "a person was asked 3 times and the check was still there". That is false when each check was cleared.
  - The attempt then went to rounds, and the model ran the Flow again from step 1.
  - This run's saved Flow met only 2 checks, so this case did not fire here. It has the same cause, and the same fix covers it.
- **Step evidence.**
  - Round 1 of attempt 2 starts at 0030. Checks at 0045 (`run_flow_from5.5`), 0056 (`run_flow_full_2.3`) and 0059 (`run_flow_full_2.9.pass.1`) are each `personCompletedCheck`.
  - The 4th check, at 0066 (`run_flow_from8.9.pass.1`, Next page), reads `threw Error`. No hand-off exists for it. There are 8 hand-offs in `attempt-2/person-hand-offs.json`: 2 in the saved Flow, plus 0045, 0056, 0059, 0081, 0090 and 0097.
  - 0067 is a new round's opening look (`initial.core.run_node`) on the page "Security check … I'm not a robot".
  - The site's activity shows `search-challenge, search-challenge, verify-human`. That is the unasked check, then a fresh one.

### (b) Does Continue resume the parked attempt in place?

Yes, as far as the pause went. `person_done` resolves the wait, the call stands (`standing()`), and the loop takes its next turn in the same round. In the engine, the run goes on down the step's `success` route. It never starts a fresh attempt or re-explores. Three things still made it look like a restart, and two of them really redid work:

1. **The 4th-check round end (a, above).** After it, the model sat on the check page through four completions (0068-0078). It then navigated back to page 1 (0080, which met a new check, cleared at 0081) and ran the paging loop from page 1 again (0082 `core.run_flow {from: 8}`). This is the restart the person saw: "stop completely … when user clicked continue it would restart".
2. **The model's view after Continue stayed on the page before the check.** The cleared call's fresh look was nested under `now`. `runtime/llm/decision-context/current-view.ts` reads the domain's declared view keys (`page`) only at the top of an answer, so `core.current_view` kept naming the call before the checked one. Scripted pair `run-mwa3kh87-d34c2f04`, request 16: after `sort-by-price` was cleared, the current view was still `ceiling-applied`'s page. The detection that followed used a handle from that gone page and was refused `target_unobserved`. A model acting on that view redoes steps the run already got past.
3. **The saved Flow told the next round that a cleared step "failed".** `flow-run/steps-ran.ts` read the checked step's attempt by its status, which stays `failed` with its ask answered down `success`. So `core.attempt_note.flowRun` said `position 4: failed, "The page needs a person before the step can go on."` for a search that the person cleared and the run continued past (scripted pair `run-mwa86qgu-9ded690b`, before this fix). That asks the model to do it again.
   - A related cause was fixed earlier and committed as `9421825cb`: a press that met a check was held as `may_have_landed` and skipped on later passes.

### (c) Was "the same things over and over" only that restart?

No. Besides the restart, Core's loop detection missed one repeat: **completions over unchanged evidence, alternating with and without an answer.**

- 0068, 0071, 0074 and 0077 all completed over one unchanged page (the check) and one set of rows.
- 0074 added an `answer`; the others gave none. So the evidence digests ran A, A, B, A.
- `completion/check.ts` (old `:160`) compared a completion only with the *last* refused digest. 0071 was refused `same_evidence` (with the 0072 steer), but 0077 matched 0069's refusal, not 0075's. So it was judged again (0078, paid), and the ladder's count started over each time.
- The judge requests show it: diffing 0075 against 0078, the only difference is `answerText`, and 0069 and 0078 are identical.

The rest of the repetition was caused by the restart, not missed by the detector:

- The model's three `core.run_flow {from: 8}` calls (0064, 0082, 0091) came from the restart and from the out-of-order rows, which were the cause fixed in `93a6f2b56`.
- The repeat guard allows the second identical call on a page by design ("the second one still runs") and would refuse a third.
- 0064 was in another round, from another page.

## Causes and fixes (Core, `packages/fluxiq/src`)

1. **The bound on asks counted checks a person cleared** (rounds, builds, recoveries).
   - Fix, `runtime/automation-parking/person-needed-tool-calls.ts`: the bound now counts asks in a row about a check that stays (`inARow`, `:157`, `:170`). It starts again whenever a call, or the look after Continue, comes back without a check (`:207`, `:218`). `asks()` still counts every question. Header rewritten.
   - The words in `runtime/flow-authoring/bootstrap/person-needed.ts` and the recovery's `asks_exhausted` sentence (`runtime/adaptation/recovery/runtime-exploration.ts`) now say the same.
   - Tests:
     - `runtime/flow-authoring/bootstrap/tests/person-needed.test.ts`, "asks at every fresh check a person clears, however many".
     - `runtime/adaptation/recovery/tests/runtime-exploration-person-needed.test.ts`, "asks at every fresh check the person clears…".
     - `answer-first/tests/endings/tests/person.test.ts`, "pauses at every fresh check … the same round goes on from each": 5 checks in one round, all asked, one decision per step.
     - The two existing bound tests now drive a check that *stays* (looks that keep meeting it), which is what the bound is for.
2. **The engine's bound counted every ask of the run** (saved Flow runs, every mode).
   - Fix, `engine/automation/person-needed.ts`: `askedInARow` (`:121`) counts person-needed asks since the run's last step that succeeded (`:77`).
   - Test: `engine/automation/tests/person-needed.test.ts`, "asks at every check a person cleared, however many the run meets". Five checks, each followed by a step that reads the page, all asked; the run succeeds, and nothing runs twice. The existing "four checks in a row" and durable-park tests still pass unchanged.
3. **After Continue, the model's current view was the page from before the check.**
   - Fix, `person-needed-tool-calls.ts` `standing()` (`:255`): a fresh look whose answer is an object becomes the call's answer, keys and all, beside `personCompletedCheck` and the note. So it is the loop's current view.
   - A look that is not an object stays under `now`. With no look, there is now a note that does not mention one.
   - The note also says the step "is not to be done again". The wording is generic and names no site or task.
   - Test: `answer-first/tests/endings/tests/person.test.ts`, "waits for the person with no clock…", now also asserts that the next decision's `core.current_view` top group is `read.checked`. Reverted, it gets `initial.library.look`.
4. **The completion check refused only the last refused evidence.**
   - Fix, `answer-first/completion/check.ts`: every refusal of the attempt is kept by digest (`refusals`, `:154`). A completion over any evidence already refused is refused `same_evidence` with that refusal's words, without a judge call (`:176`).
   - Test: `completion/tests/refused-again.test.ts`, "refuses evidence an earlier no refused, not only the last one". The shape is A, then B with an answer, then A.
5. **The saved Flow's note called a cleared step "failed"**, as in (b)3.
   - Fix, `answer-first/flow-run/steps-ran.ts`: an attempt whose person-needed ask was answered down `success` reads `passed`, with "It met a check only a person can complete; the person completed it, and the run went on from this step."
   - Test: `flow-run/tests/steps-ran.test.ts`, "a step whose check the person cleared passed…". It drives a real engine trace through a cleared check.
6. **Wrong words shown to the person.** Attempt 2's answer turn said "The search could not be finished because a robot check (CAPTCHA) appeared", beside rows a judge had confirmed. That answer came from refused completion 0074; the accepted completion 0128 gave none, and `state.answerText` kept the last answer ever given.
   - Fix, `completion/check.ts` (`:166`): it now holds the latest completion's own words, as its doc already said.
   - Test: `refused-again.test.ts`, "the answer a result is shown with…".

**Lab, `packages/test-runner/src/attempt-lane/scripted-model/scripts/crossborder-marketplace-free-hubs-under-ten.ts`.** The script now reads what is already applied from the search address (`freeShipping=y`, `maxPrice=10`, `sort=price_asc`). This lets it drive attempt 2's rounds, which start on the page the saved Flow left. Before, it pressed Free shipping again and turned it off. Test: `scripts/tests/crossborder-marketplace-free-hubs-under-ten.test.ts`, "a second attempt's round starts where its saved Flow left the page…".

Nothing was changed in the extension app, `domain/src`, `ui-components`, fixtures, oracles, task wording or git. The Lab's person play needed no change.

## Commands run and observed results

- **Reverted-fix checks.** Each fix was disabled with `sed`, the tests were run, and the file was restored from a scratch copy.
  - Causes 1, 2 and 4 together: 5 failed. The messages were:
    - engine: `expected … to have a length of 5 but got 3`
    - bootstrap: failed
    - recovery: `… length of 5 but got 3`
    - completion: `expected 3 to be 2` (judged count)
    - answer-first round: `expected [ …(4) ] to have a length of 5 but got 4`
  - Cause 3: `expected 'initial.library.look' to be 'read.checked'`.
  - Cause 5: `expected { position: 1, ran: 'failed', …(1) } to deeply equal { position: 1, ran: 'passed', …(1) }`.
  - Cause 6: `expected 'It could not be finished because of a…' to be undefined`.
  - Each passed again once restored.
- `vitest run` of answer-first `tests`, `run-acts`, `rows`, `attempt` and `completion` → 70 files, 560 tests passed. That was before causes 5 and 6; see the final run below.
- `vitest run src/engine/automation src/runtime/automation-parking src/runtime/flow-authoring/bootstrap src/runtime/adaptation/recovery` → 470 files, 5141 passed, 2 skipped. That was before cause 3's change.
- After cause 3: `vitest run` of automation-parking, flow-authoring/bootstrap, adaptation/recovery, `framework/automation-service/tests/service-bootstrap`, the whole of answer-first, and the engine person-needed test → 494 files, 5151 passed, 2 skipped. Then `pnpm --filter fluxiq check` → exit 0.
- After cause 6: `vitest run` of the whole of answer-first plus `service/end-view` → 102 files, 763 passed.
- After causes 5 and 6, which was the final source: `vitest run` of the whole of answer-first, the engine person-needed test, automation-parking, `flow-authoring/bootstrap/tests` and the recovery person-needed test → 125 files, 1013 passed. `pnpm --filter fluxiq check` → exit 0.
- The structure audit then failed on two `as never` casts in my new steps-ran test. I replaced them with a typed artifact. The test passed 4 of 4; `pnpm --filter fluxiq check` → exit 0; `pnpm structure:check` → "passed (536 warning(s), 1095 baselined)".
- `pnpm structure:check` (Core) → "structure-audit: passed (536 warning(s), 1095 baselined)". It failed once on a packed statement in my test; fixed.
- `pnpm build` (Core) → exit 0 before each Lab run; a final rebuild after the last test edit (see the return contract).
- Extension side:
  - `pnpm --filter @fluxiq-web-extension/test-runner check` → exit 0.
  - The script's test → 6 of 6 passed.
  - `node --test "dist/attempt-lane/scripted-model/**/*.test.js"` → 53 of 53 passed.
  - `node scripts/structure-audit.mjs` → "structure-audit: passed (244 warning(s), 552 baselined)".
- **Headed provider-free proof.** `FLUXIQ_LAB_INSTANCE=t885-proof FLUXIQ_TEST_ENV_FILES=none pnpm lab attempt crossborder-marketplace --task crossborder-marketplace-free-hubs-under-ten --authoring-mode answer-first --scripted-model --attempts 2`, with free memory first at 2.55-2.66 GB.
  - First try: exit 1, `process.startup`, "Core's build inputs changed while the web panel was building". I had edited Core source during its prelude. Nothing ran.
  - Second try, `run-mwa86qgu-9ded690b`: exit 0. `{"status":"passed","answerVerdict":"right","ended":"achieved","live":false,…,"attempts":[{"attempt":1,…,"path":"explore","calls":12},{"attempt":2,…,"path":"run_flow_then_explore","calls":6}],"secondStartedFromFirst":true}`. Attempt 1: 12 live steps. Attempt 2: 13 live steps, 6 calls, 56 s.
  - `attempt-2/person-hand-offs.json` holds 2 hand-offs, both `traffic-screen`, `cleared`, `person_done`, 3.5 s and 3.7 s, with 0 poll failures. Site activity: `beacon, search-challenge, verify-human, search-load, search-load, search-challenge, verify-human, search-load, search-load`.
  - Saved Flow paused in place: its `flowRun` note says position 4, the search that met check 1, was answered by the person, and the run went on: positions 5 and 6 `passed`. It then stopped at position 7 for an unrelated reason: the "Not now" cover was absent (`executor.target.gone`), as the earlier report described.
  - Round paused in place: `ceiling-applied` (step 0029, `personCompletedCheck`) met check 2. The next decision (model request 013) sees its current view from `ceiling-applied`, with `URL ~/search?q=usb+c+hub&freeShipping=y&maxPrice=10`. It then sorts (0031), detects (0033), reads (0035) and completes, judged yes (0037). No step was redone and nothing started over.
  - That run used the build from before causes 5 and 6, so its note still said position 4 "failed".
  - Third run, `run-mwa9oytn-d866da84`, on the final source: exit 0, `"status":"passed"`; attempt 1 `explore`, 12 calls, right; attempt 2 `run_flow_then_explore`, 6 calls, right.
    - Hand-offs: attempt 1 had 1, attempt 2 had 2, all `cleared` / `person_done`, 0 poll failures.
    - The saved Flow's note now reads position 4 `passed`, "It met a check only a person can complete; the person completed it, and the run went on from this step.", then 5 and 6 `passed`.
    - Request 013's current view is from `ceiling-applied` (`freeShipping=y&maxPrice=10`). Then come the sort, detection, read and completion.
    - Neither attempt's answer turn carries stale answer text.

## Not verified

- No live or paid run. A paid rerun of this pair is the real check.
- No scripted run met four or more checks in one round. Crossborder's honest path loads results about five times per attempt, so it meets one or two. The fourth-check case is proven by unit and loop tests only (the engine, the wrapper through the bootstrap and recovery tests, and a whole answer-first attempt).
- The web domain's look never reports a check: only an action that meets one does (`domain/src/runtime/llm-evidence/action-failure/refusal.ts:190`). So in the web domain the "check that stays" bound cannot tell a stayed check from a cleared one by the look. It resets on every Continue, and a person who keeps pressing Continue without clearing is asked again at the model's next action, each time. That pre-existing gap also shows the model a check page after such a Continue. I did not change the domain.
- The extension chat was not driven by a real person. "The chat says so once" rests on one ask per check (`person-hand-offs.json`, one entry per check) and on the code path. I did not inspect the panel's rendering of each check.
- The other authoring modes (`project`, `candidate`) use the same wrapper and engine and get causes 1 and 2's fixes. I ran their unit tests (bootstrap, recovery, service-bootstrap) but no build or run in those modes.

## Open questions or contradictions

1. **A saved Flow stops on a cover that is not there** (step 7, "Not now", `executor.target.gone`). This happened in both scripted pairs. It is not caused by checks, but it sends every second attempt on this task into rounds. Owner: Core's absent-step skip (`step-skip/absent-step.ts`), not traced here.
2. **The web domain's look cannot see a check** (see Not verified). If the bound on a check that stays matters in the web domain, the domain's look should flag a known check page as `personNeeded`, as its actions do.
3. **Judge evidence for paged rows** is unchanged. This was cause 3 of the earlier report, `hubs-attempt-2.md`, and it is still the lead's call.
