# A8 wave 15 debug: `run-mv9v3u68-6efbd7ae` (bigbox-retail-pickup-cart, project mode)

Read-only. No live run, no Lab run, no provider call. Pair 2 (downstream `805f7cbd`, Core `797452c1`), sources read in
`C:/Users/osrs_/FluxStuff/fxwork/t563/`.

## Outcome

Done. The `web.target.ambiguous` came from an **optional** "close the popup" step whose saved target was the wrong
control. During the build, the handle the model wrote (`t1841`) was quietly moved from the chat card's close button,
which the model actually clicked, to the "Added to cart" panel's close button. That panel appears only after the
step that comes later. The step therefore could never find its target, at trial or at playback. Core went on past
it as an optional step, the run succeeded, and the oracle passed. The Lab then took that bypassed failure as the
run's deciding failure. There are three defects, two product and one Lab, and none of them is the model's fault.

## What changed and why

Only this report file was written.

### (1) The failing step, its saved target, what it matched

- Step: `add_napkins.s2`, "close the chat popup if it shows". The script it was submitted with, at step 0075, reads
  `target: t1841`, `consequences: none`, `optional: yes`. It is the second node of the third subflow, run straight
  after the navigate to the napkins page (playback step 0096).
- Playback step 0097 (`steps/0097-run-web.dom.click`), 123 ms: "Target ambiguous: element fingerprint in the page's
  open shadow roots matched 3 elements: div (0.54), div (0.54), div (0.54)." The failure was
  `retryable: false, stage: target_resolution, effect: unacted`.
- Saved target (0097 `call.json`): `tagName: div`, `visibleText: "×"`, `classNames: ["css-0jeewbd"]`,
  `selector: "body > aside > div > div"`, `context.landmark: "complementary"`, with no shadow host.
  `body > aside > div > div` with a `×` is the close glyph in the "✓ Added to cart / Customers also bought" panel.
  The fixture (`apps/scenario-lab/.../bigbox-retail/client/product-script.ts` `showAdded()`) creates this `<aside>`
  only after a successful Add to cart.
- What it matched at replay: the panel does not exist yet. That makes the document pass `not_found`, so
  `resolveTarget` widens the search into open shadow roots (`apps/extension/src/content/action-runtime/resolve-target.ts:270-274`).
  There `fingerprintMatches` finds no class match and falls back to the words, so every `div` whose text is `×`
  counts. On a product page the fixture has three such divs in shadow roots: the chat card close and the chat panel
  close (`shell/support-chat.ts`, both `chatCardClose`), and the store picker flyout close (`shell/store-picker.ts`
  `pickerClose`). At 1.2 s after load all three sit inside hidden containers: the chat card opens after
  `CHAT_CARD_DELAY_MS = 3_000`, and the panel and flyout are `hidden`. `gatedPool` keeps every match when none
  passes the gate (line 528-531), scoring ties them at 0.54, and the result is `ambiguous`. No page grew and no
  dialog was open. The three are hidden lookalikes, matched by a single "×" character.
  - Inferred: which three divs those are. The failure names only "div" three times. The identification comes from
    the fixture source plus the timing, not from a DOM capture at step 0097.

#### How the target went wrong (build, brief-3)

- 0069 (after choosing 250 Count): `COVERING ... t1839 covers 6 close t1841 "×"`. This is the chat card.
- 0071 `close-chat-1` clicks `t1841`. The result says `"the point 1228,517 landed on the target"`, which is the
  bottom-right corner where the chat card sits, and it changed
  `"t1842 \"Hi, I'm Val, ValueRidge's virtual assistant.\" gone" ... "t1845 \"Chat with us\" appeared"`. So
  `t1841` was the shadow-root chat card close.
- 0073 Add to cart. The new capture says `COVERING t1847 covers 15 · t1848 "Customers also bought" complementary
  covers 36 close t1841 "×"`, with `'t1841 clickable "×"'`. **The same handle now names the new panel's close.**
- 0075 submit resolves `target: t1841` against the newest packet for that page, which gives the panel close. That is
  the description that was saved.
- Mechanism: `domain/src/runtime/llm-evidence/stable-handles.ts`, `rebound` tier 4 (`reboundByPlace`). "Place" is
  page + frame + record + tag (`placesOf`), and the shadow-host chain is left out. The chat close (`div`, "×", inside
  `<vr-assist>`) was hidden by the click and so dropped out of the capture. The panel close (`div`, "×", light DOM)
  was the only element in the capture with that place and those words, and `t1841` was the only unclaimed number
  last seen with them. Tier 4 was written for "a reload that rewrote the selector's shape". Here there was no
  reload, and a control from a different shadow root inherited the number.

### (2) Same step at build trials: identical failure, hidden by the optional shape

- The subflow trial (0077, step 8) and the whole-candidate trial (0084, step 14) both report
  `"label": "close the chat popup if it shows" ... "status": "failed", "failureCode": "web.target.ambiguous",
  "happened": "More than one control matched the step's control, and none could be chosen."`. The next step is
  `builtin.control.merge` with `succeeded`, and both trials ended `verdict: yes`.
- So nothing differed at playback: same start (the reset hook, then a navigate), same ~1 s timing, same three hidden
  shadow-root divs. The trials accept a failed optional step because Core's optional way-on
  (`runtime/executor/step-skip/optional-step.ts`) is "what the Flow says to do, not a recovery". The Lab's
  playback verdict does not accept it (see 3).
- The paper-towels optional dismiss (`add_paper_towels.s2`, a `span "×"` inside a shadow host, the chat pill close)
  resolved by selector at playback (`candidateCount 1, bestScore 0.676`). Not verified: whether that was the control
  the model clicked during the build.
- The wave 12 project-mode pass (`run-mv9t73fh-a6bf13df`) submitted no `optional: yes` step (grep count 0 in all
  three `submit_subflow` calls). In that run the interruption handler closed the popups, so this path never arose.

### (3) End state and how it was reported

- Core playback: `status: "succeeded"`, `resultVerification: "confirmed"`. Every other node succeeded: steps
  0088-0096 and 0098-0099, and the napkins "250 Count" check and "Add to cart" ran after the merge. The result judge
  (0100) said: "The request is satisfied: store switched, two packs of the paper towels and one pack of the napkins
  added for pickup, existing cart contents untouched".
- Oracle `passed`. All five facts held: store `Millbrook Crossing Supercenter`, soap kept, towels `2 × ... 12 Double
  Rolls · Pickup`, napkins `1 × ... 250 Count · Pickup`, `4 items · Subtotal $43.39`.
- The Lab reported `failed`. `packages/test-runner/src/flow-lane/persisted-flow-run.ts:555` picks "the first
  structured failure Core recorded on a node whose last attempt did not succeed". The bypassed optional node had
  exactly one attempt, `failed`, so its record became `run.failure`. `lane-observation.ts:196` `reportedVerdict` →
  `failed`, and `expectations.ts:51` `assertFlowFailure` threw "The Flow reported an unexpected target_ambiguous
  failure" (event 30, `runtime.behavior`). Core's own verdict was a success. The "failed" is the Lab's reading of it.
- Side effects of that misreading: Core's harness logged 2 interventions (a diagnosis and a runtime_patch, no LLM
  calls, $0) and created adaptation `0abc84…`. The repair lane then wrote event 29 with `adaptationGate.reason:
  "oracle_failed"`, although the oracle passed. The label means "lane verdict failed" and is misleading.

### (4) Root causes and smallest structural fixes

1. **Product, domain: a handle rebound to a different control (`stable-handles.ts` tier 4).** Two possible fixes:
   - Smallest: add the unpositioned shadow-host chain to `placesOf`. A reload never moves a control between the
     light document and a widget's shadow root, so this keeps tier 4's reload case and refuses this case.
   - Stronger: allow tier 4 only on a capture that follows a document load. Within one document a vanished control
     is gone, and a new control with the same tag and words is a new number.

   Test: `domain/src/runtime/llm-evidence/tests/` (the stable-handles test). Click a shadow-root `div "×"`, a
   light-DOM `aside div "×"` appears, and it must get a new number.
2. **Product, extension: hidden lookalikes reported as ambiguous instead of absent
   (`resolve-target.ts` `gatedPool`/`resolveIn`).** When several elements match and *none* passes the
   visible/enabled gate, the target is not on the page for a click, so return `not_found` and not a scored tie of
   hidden elements. The lone-hidden-match exception for assertions stays as it is. Core's
   `automationStudioAbsentStepSkip` then skips the optional step cleanly as `target_absent` (no failure record, the
   attempt reads `skipped`), and the Lab already treats that as success. A second hardening: for a recorded target
   with no shadow host and a `body > ...` selector, do not widen into shadow roots on words alone. Test:
   `apps/extension/src/content/action-runtime/tests/resolve-target.test.ts`.
3. **Lab: a failure on an optional step that took its way-on counts as the run's failure
   (`persisted-flow-run.ts` `outcomeFromDetail` and `lane-observation.ts` `reportedVerdict`).** Core's rule is that
   the way-on is the Flow's path and not a fault. The Lab should apply the same rule the trial gate does: a failed
   attempt on a node for which `automationStudioOptionalStepWayOn` holds, whose next attempt is the way-on's target
   (the merge), is moved to a new `bypassedOptional` list rather than to `failure`. Both the Flow graph and the
   attempt order are already in the run detail. Ideally Core exports this predicate (as it does for
   `hasUnvisitedAutomationStudioNodes`) or marks the attempt, so the Lab does not keep a second copy of it. With
   this fix alone, this run reads `passed`. Also rename the repair-lane gate reason so a passed oracle with a failed
   lane verdict does not read `oracle_failed`.

Priority: fix 1 is the cause (the Flow saved the wrong control). Fix 3 is why a correct end state was reported
failed. Fix 2 turns the leftover miss into a clean skip. None of them involves model guidance.

## Commands run and observed results

- Read `summary.json`, `evaluation.json` and `events.ndjson` (events 24-31), plus `snapshots/flow-lane.json`
  (authoredNodes, authoredGraph edges, actions, oracles, failure), `repair-lane.json` and `adaptation.json`.
- Read the steps `0063-0077`, `0084`, `0096`, `0097` and `0100` (call/result/meta, page text).
- `grep` for the Lab message (found at `expectations.ts:51`). I also read `persisted-flow-run.ts:290-579`,
  `lane-observation.ts:170-262`, `resolve-target.ts` (whole file), `stable-handles.ts:1-420`, Core
  `executor/step-skip/{optional-step,absent-step}.ts`, `graph-navigation.ts:40-80` and `recovery-ladder.ts:75-120`,
  and the fixture `support-chat.ts`, `store-picker.ts` and `product-script.ts:60-100`.
- Compared with `run-mv9t73fh-a6bf13df`: its steps index shows playback 0070-0079 all succeeded, and it has 0
  `optional: yes` submits.

## Not verified

- The identity of the three tied divs (inferred from fixture source and timing, with no DOM capture at 0097), and
  whether the first, document-only pass saw the shell promo close carrying the same `css-0jeewbd` class.
- Whether the paper-towels optional step clicked the same control it was built from.
- None of the proposed fixes is implemented or tested. Exactly what Core's two $0 harness interventions and its
  runtime patch changed was not checked.

## Open questions or contradictions found

- Core's trial gate and executor treat a failed optional step as routed success, while the Lab's playback verdict
  treats it as failure. One rule, two readings. The predicate should be shared.
- The repair-lane event 29 says "judgement failed ... (oracle_failed)" while `oracleVerdict` is `passed`.
- `resolve-target.ts` widens into shadow roots after a light-DOM selector miss even for a target recorded with a full
  `body > ...` path. The comment justifies the widening for model handles that carry no host chain, but this target
  had an exact light-DOM address.
