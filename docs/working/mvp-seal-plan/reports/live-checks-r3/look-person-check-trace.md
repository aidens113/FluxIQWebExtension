# A look that shows a robot check: where the person-needed signal is lost

Read-only trace, t885. Run `run-mwaknxf9-7549d126` (bigbox-retail-rated-delivery-towels). Nothing was edited except this report.

## Outcome

Done (trace only). The signal is lost in the extension's **worker**. The domain and Core already handle a look's person-needed answer end to end.

- The domain already turns a look's `USER_INTERVENTION_REQUIRED` into `personNeeded`. It does this at `domain/src/runtime/llm-evidence/capture.ts:570-573`, `structure/detect.ts:201-202`, `tools.ts:432-434` and `node-run/run.ts:648-662`, and its tests assume the client sends that answer (`node-run/tests/person-needed.test.ts:3-5`, `:125`, `:136`).
- Core's hand-off takes any call's `personNeeded`, the round's opening look included.
- But the client never answers a look with `USER_INTERVENTION_REQUIRED`, and it never waits out a self-clearing check seen by a look.

What happened in this run was narrower than "a look saw a check":

- The sort was a `web.dom.select`. Its reply arrived from the old document before the page navigated. The worker judges a state act's landing only when its reply is lost, so the landing on the check was never judged.
- The domain's after-action look then captured the "Robot or human?" page as an ordinary page (step 0014's answer).
- Bigbox's check clears itself: "check your browser again automatically" reads `self_clearing`, and the fixture's `person-check.ts:9-12` says the same. So with either fix below, this run would have waited 8 s and shown results. No hand-off would have been needed.

## 1. How a check is detected for an action, and why a look reports none

Every detector reads the page with `robotCheckIn` / `challengeIn` in `apps/extension/src/content/action-runtime/challenge-evidence.ts:74-101`. A check whose page says it is checking by itself is `self_clearing` (`:98`, `SELF_CLEARING_WORDS` `:146`). One that asks the visitor to prove something is `person_only` (`:97`, `:99`).

There are four sightings, all on action paths:

- **A press in the same document.** `content/actions/click.ts:435-441` uses `watchRobotCheck` (`content/action-runtime/robot-check/robot-check-watch.ts:72-139`). The press fails through `actionNeedsPerson`, `content/action-runtime/results.ts:418-435`, with `USER_INTERVENTION_REQUIRED` and `captcha: …`.
- **A press that navigated: its landing.**
  - `runtime/click-landing.ts:218-275` → `judgeLanding` `:403-427`.
  - That asks the top frame through `runtime/landed-challenge.ts:56-75` (`PAGE_CHALLENGE_MESSAGE`). The frame answers in `content/message-handler.ts:217-224` (`pageChallenge`).
  - A self-clearing check is waited out across document reloads by `runtime/landed-check-wait.ts:66-103` (`settleLandedReading`).
  - A check still standing fails as `checkLandingOutcome` (`click-landing.ts:627-636`), using `navigationChallengeFailure` (`runtime/action-results.ts:129-134`).
- **A navigation's landing.** `runtime/action-runner.ts:145-150` → `navigation/landing.ts`, the same reading and wait.
- **A missing target on a challenge page.** `challengeGateFailure`, `content/action-runtime/results.ts:537-549` (`person_only` only; on page scope a self-clearing check is not `captcha`, `challenge-evidence.ts:81-82`).

Why a look reports nothing:

- **Content.** `content/actions/capture-snapshot.ts:18-25` returns `success` with its snapshot and reads no check.
- **Worker.** In `runtime/action-runner.ts:152-178`, a `web.dom.capture_snapshot` goes through `runOnPage` → `runActionInFrame` → `sendClickCheckingLanding` (`:462`). There `landingKind` (`click-landing.ts:323-329`) returns `undefined` for a look, so it is sent plain. Nothing reads the page for a check, and nothing waits one out.
- **The domain's own comment is false for looks.** It says "Checks that clear themselves were already waited out by the client" (`capture.ts:572`).
- **The gap behind this run.** `sendStateCheckingLanding`, `click-landing.ts:285-315`, returns the reply as is when it arrives (`:296-297`). The header says so deliberately (`:67-71`: "a check or choice that answered is judged by its own read-back, and pays nothing here").

Run evidence for that gap, step `0014-tool-core.run_node/result.json`:

- `read.status: succeeded`, "Option selected."
- `read.url` is still the pre-sort address.
- `location` and `page` are `…&sort=rating_high`, with PAGE "Robot or human?".

The model then completed four times (0015-0022, each refused `answer_first.nothing_to_judge`). Step 0023, a new round's opening look about 25 s later, shows the results: the check had cleared itself.

## 2. The smallest root change on the extension side

The goal is that a look answers exactly as a landing does. A self-clearing check is waited out in place. A check that is still standing comes back as `USER_INTERVENTION_REQUIRED` with `captcha: …`. That is the action's shape, and the domain already maps it to `personNeeded`.

**Why the worker, not the content script.** A self-clearing check replaces its own document when it lifts. Only the worker can keep asking across that reload, as `settleLandedReading` already does. The content side needs no change, because `pageChallenge` already answers.

**Why opt-in by `checkWaitMs`.** Three kinds of look must keep reading a check page as a page:

- host state captures (`domain/src/runtime/host-runtime.ts:252-262`). Their failure throws in Core's engine: `engine/automation/host-state/capture.ts:44-46`, "The host state capture could not be read".
- target re-acquire (`runtime/target-reacquire/reacquire-unbound-target.ts:34`).
- the recorder.

The domain already marks the commands that may wait out a check with `checkWaitMs`. It is added by the gateway every build call goes through (`node-run/frozen-execution/dispatch/gateway.ts:12`, from `tools.ts:143`) and by Flow output nodes (`output-nodes/native-runtime.ts:116`). Host captures and re-acquire dispatch without it.

### Files touched

1. **`domain/src/actions/check-wait.ts:70-74`** (`webAutomationCommandWaitsOutChecks`): also true for `web.dom.capture_snapshot`.
   - Build looks, detections, `find_on_page` and `describe_element` captures, and a Flow's snapshot node then carry `checkWaitMs` (mapped to the worker by `domain/src/client/gateway-mapping.ts:205`).
   - The unscoped look names no timeout (`capture.ts:567`), so the worker's budget is the whole `SELF_CLEARING_WAIT_MS`, 15 s (`landed-check-wait.ts:110-114`).
   - Update the header (`:1-43`) and `actions/tests/check-wait.test.ts`.
2. **`apps/extension/src/runtime/look-check.ts`** (new, one export), exported from `runtime/index.ts`.
   - Shape: `judgeLookCheck(action, tabId, startedAt, access: LandedTabAccess)`. It runs `readLandedPage(tabId, access.send)` and then `settleLandedReading(first, tabId, access, checkWaitBudgetMs(action, startedAt))`.
   - A reading still `robot_check` returns a failed `workerActionResult(action, startedAt, outcome)` (`action-results.ts:68`). That outcome's failure is `navigationChallengeFailure("a page to look at", standingCheckWords("the page looked at", checkWait))` (`action-results.ts:129`, `landed-check-wait.ts:130-138`). The validation is failed, and the message is "The page is a robot check, which only a person can answer."
   - A check that cleared returns `clearedCheckWait(wait)` (`landed-check-wait.ts:121`), so the look can carry `checkWait`, as `clickAfterClearedCheck` does (`click-landing.ts:689-695`).
   - Anything else (no check, unread) returns nothing, and the look runs as today.
3. **`apps/extension/src/runtime/action-runner.ts:156-170`** (`runOnPage`): before `runActionInFrame`, when `action.actionType === "web.dom.capture_snapshot" && action.checkWaitMs !== undefined && !addressed`, call `judgeLookCheck(action, tabId, startedAt, LANDED_TAB_ACCESS)`.
   - On a check, return `withTarget(failed, tabId, TOP_FRAME_ID)`.
   - On a cleared wait, take the look and attach `checkWait` to its result.
   - Inside `runOnPage`, a reused kept look (`:173`) pays nothing. A failed look is never kept (`look-reuse/kept-look.ts:104`). Frame-addressed looks (`addressed`, `:155`) are left out because their scope is a frame.
4. **`domain/src/runtime/llm-evidence/capture.ts:779-786`** (`pageRefusal`). This is the one domain gap: an action refused for another reason, whose page capture now meets a check, drops the mark.
   - Pass `refusal.personNeeded ?? (error instanceof RecoverableToolRejection && error.personNeeded ? true : undefined)` in the `catch`.
   - Correct the comment at `:570-572`: the client now waits checks out for looks too.

Nothing else in the domain changes:

- A standalone look (`node-run/run.ts:236-267`), the read before acting (`:268`) and the after-action look (`:477-491`, through `captureAfterAction` `capture.ts:660-676`, which rethrows anything but `page_unreadable`) all reach the `catch` at `run.ts:648-662`. That `catch` applies `withPersonNeeded(refused, personDraft(record))`.
  - A look stands as a look that proposes nothing (`:740-744`).
  - An action whose after-look met the check stands as the act it was (`:745-760`), which is this run's shape.
- Inspect tools: `tools.ts:420-434`.
- State digests already answer "nothing" for a check (`tools.ts:476-484`).

### Companion action-side fix (the cause of this run)

- **`apps/extension/src/runtime/click-landing.ts:285-315`** (`sendStateCheckingLanding`): when the reply arrives `succeeded`, also judge a navigation that commits. Use the press's window (`:257-270`: `pageSawNoNavigation` ⇒ 0 ms grace, so a choice that does not navigate pays nothing) and `judgeLanding(…, noun)`. Then:
  - `failed` → `failedClick(reply, outcome)`
  - `check_cleared` → `clickAfterClearedCheck`
  - otherwise the reply as it is
  - Rewrite the header at `:67-71`.
- **`domain/src/actions/check-wait.ts:70-74`**: also give `web.dom.select` and `web.dom.check` the allowance. This run's select had `timeoutMs: 10000`, so its budget would be about 8.8 s against an 8 s check plus a reload.

With part 2 alone, this run would already wait in the after-look. The companion fix records the wait on the act that caused it.

## 3. Core: does a look's person-needed answer pause and resume in place?

It already works once the answer carries `personNeeded`. No Core change is required.

- Every answer-first round wraps its executor in `automationStudioPersonNeededToolCalls` (`framework/automation-service/service/answer-first/attempt/round.ts:51-60`, used at `:118`).
- The round's opening look goes through that same executor (`runtime/llm/evidence-loop.ts:549-560`).
- The wrapper does not care which kind of call it is (`runtime/automation-parking/person-needed-tool-calls.ts:215-225`):
  - It asks with no clock and parks the attempt `waiting_for_person` / `person_only_check`.
  - On Continue it takes a fresh look (`:187-212`) and asks again if the check is still there (`:202-205`).
  - The call then stands with its observe draft and the fresh look as its answer (`standing`, `:245-267`), and the same round goes on.
- `automationStudioToolResultNeedsPerson` (`:117-119`) reads only `personNeeded === true`.
- Recovery exploration (`runtime/adaptation/recovery/runtime-exploration.ts:296`, `annotation/exploration.ts:229`) and builds (`runtime/flow-authoring/bootstrap/person-needed.ts:97`) use the same wrapper.
- A saved Flow's snapshot node that now fails `user_intervention_required` parks through `engine/automation/person-needed.ts:52-54`.

Core files to change: none. One test should be added (section 5).

## 4. The system text and proposed wording

`domain/src/runtime/llm-evidence/system-instructions/instructions.ts:81`:

> "Limits. Never solve a robot check (CAPTCHA); say that one blocks you."

Its test is at `system-instructions/tests/instructions.test.ts:121-123`. "Say that one blocks you" is what the model did at 0015-0021: it completed with "Stopped: a robot check blocks…". No Core prose repeats the instruction; Core's only model-facing check words are the post-Continue note at `person-needed-tool-calls.ts:87-91`.

Proposed replacement for line 81. It is generic and names no site, scenario or task:

> "Robot checks. Never press, type into, solve or reload a robot check (a CAPTCHA, or any check that asks whether you are a person). FluxIQ waits out one that clears by itself and hands any other to the person, pausing your work where it is; once they complete it you are shown the page again and go on from there. A robot check is never a reason to complete or to stop."

To ship it:

- Bump `version` to `web-13` (`:67`).
- Add a `web-13` line to the header log (`:9-57`) citing `run-mwaknxf9-7549d126`.
- Replace the test at `:121-123` so it asserts:
  - "Never press, type into, solve or reload a robot check"
  - "hands any other to the person"
  - "never a reason to complete"
- The text stays under the 3,600-character test (`:55-57`). It is about 2,580 characters now, and the new line adds about 330.

## 5. Provider-free test plan

### Unit, extension

- **`apps/extension/src/runtime/tests/look-check.test.ts`** (new), with a fake `LandedTabAccess` in the style of `tests/landed-check-wait.test.ts:132` (bigbox's 8 s check). It should check:
  - A person-only reading fails `USER_INTERVENTION_REQUIRED` with `captcha:`.
  - A self-clearing reading that lifts returns nothing to fail on and gives `checkWait.waitedMs`.
  - A self-clearing reading still up at the budget fails with the `not_cleared` words.
  - An unread frame returns nothing.
- **`tests/action-runner.test.ts`**, with the chrome stub's top frame answering `PAGE_CHALLENGE_MESSAGE`:
  - A look carrying `checkWaitMs` on a person-only page returns failed and never sends `executeAction`.
  - The same look without `checkWaitMs` (a host capture) returns the snapshot unchanged.
  - A frame-addressed look is untouched.
- **`tests/click-landing-state.test.ts`** (companion fix): a select whose reply arrives and whose page then commits onto a check fails `USER_INTERVENTION_REQUIRED` ("the choice was made…"). A self-clearing check gives `checkWait`. A select that navigates nowhere pays no grace.

### Unit, domain

- **`actions/tests/check-wait.test.ts`**: `capture_snapshot` (and select/check) carry `checkWaitMs`.
- **`node-run/tests/person-needed.test.ts`**:
  - The existing `:125` ("a press that worked, whose page then shows a robot check, stands as a proposing press") and `:136` ("a look at a robot check needs a person and proposes nothing") already prove the domain half.
  - Add this run's shape: a `web.output.dom-select` that succeeds, whose after-look fails `USER_INTERVENTION_REQUIRED`. Expect `personNeeded`, and the draft stands as a proposing select.
- **`capture.ts` `pageRefusal`**: a refused press whose page capture meets a check carries `personNeeded`.
- The system-instructions test, as in section 4.

### Unit, Core

`framework/automation-service/service/answer-first/tests/endings/tests/person.test.ts`, new case in "a check only a person can clear": "a look that meets a check pauses in place". Fault the round's opening look (`initial.core.run_node`) and a model's observe call with `personNeeded`. Expect:

- the attempt `waiting_for_person` / `person_only_check`
- a person-needed ask with `timeoutMs: null`
- after Continue, the next decision in the same round, `core.current_view`'s top group being the cleared look, and one decision per step (nothing re-run)

This locks the "already works" claim in section 3. Today's cases fault a read node (`READ_LOANS`, `:115-177`), not a look.

### Scripted Lab

- **bigbox-retail.** It can show the look path waiting out a self-clearing check. No script exists in `packages/test-runner/src/attempt-lane/scripted-model/scripts/`, so one must be written: `bigbox-retail-rated-delivery-towels.ts`, plus a test under `scripts/tests/`.
  - Its honest path is search submit (load 1), the Delivery facet `dom-check` (load 2), then "Sort by" `dom-select` "Highest rating" (load 3). The third search load is the check (`apps/scenario-lab/src/scenarios/bigbox-retail/state/robot-check.ts:4-12`), so the script replays this live run exactly.
  - Before the fix, the after-look shows PAGE "Robot or human?".
  - With part 2, the look waits it out: the answer's page is the results with `clearedWait`, then read, then complete. With the companion fix, the select's own result carries `checkWait`.
  - Bigbox's check lifts in 8 s, inside the 15 s wait (`person-check.ts:9-12`), so the Lab shows the wait, not a hand-off.
- **crossborder-marketplace.** It has a person-only check ("I'm not a robot"), but it cannot show a hand-off from a look as built.
  - Its checks come on press and typed-submit loads, which are already action sightings: Free shipping, OK and "Price ↑" are all `clickable` presses (`scripts/crossborder-marketplace-free-hubs-under-ten.ts:82-90`). The existing script exercises only the action path.
  - No realistic scenario today has a person-only check that only a look sees.
  - A Lab proof of the look hand-off would need a fixture or variant change, for example a person-only check served on a select or facet load. That changes a task's fixture and is the lead's call. Until then, the look hand-off and resume is proven at unit level: the extension worker, the domain node-run, and Core answer-first.

## Commands run and observed results

These were read-only: `ls`, `cat`, `sed -n`, `grep`, `git log -S` in both trees and in the run folder.

- `git log -S "A look that met a robot check is the person"` on `capture.ts` → `0faee6e66`. That commit wired the domain side; the client side was never added.
- `wc -c` of the system text lines → 2,566 characters without newlines.

No build, test or Lab command was run, as the brief required.

## Not verified

- No test was run, so every proposed change is unexecuted.
- I did not confirm Core's command deadline for a look with no `timeoutMs`. `check-wait.ts:110-112` says Core waits its own default, "which is longer" than 15 s.
- I did not confirm that every look `find_on_page` and `describe_element` take goes through `webNodeFinalGateway`. `tools.ts:143` builds it as the tools' gateway, but I did not read every inner call site.
- I did not check whether a saved Flow ever contains a `capture_snapshot` node. If one does, the engine parks on it as described.
- I did not read the panel's rendering of a hand-off that came from a look.

## Open questions or contradictions

1. **The domain contract was never implemented on the client.** `capture.ts:570-572` and `node-run/tests/person-needed.test.ts:3-5` both say the client answers `USER_INTERVENTION_REQUIRED` for a look of a check and waits self-clearing ones out; it does neither. This was also noted as open question 2 in `person-check-pause.md`.
2. **The state-act landing exemption** (`click-landing.ts:67-71`) was a deliberate speed choice (t407). The companion fix keeps the zero-grace path for a choice that does not navigate.
3. **Opting in by `checkWaitMs`** stretches what that field means ("may wait out a check" becomes "may wait out and hand off a check"). The alternative is to judge every look and make `host-runtime.ts` `readPageState` answer a check as "no state" instead of throwing. That is more files, and it changes what saved Flow runs record.
