# t195-w19a: audit of `social-network-feed-confirm-requests` before the first live run

Worker t195-w19a (read-only audit), 2026-10-01. Trees: downstream `fxwork/t195/!FluxIQWebExtension` at `a15a465e`,
Core `fxwork/t195/!FluxIQ` at `f3778a8e`, both `task/t195-live-control-flow`. `R/` below is Core
`packages/fluxiq/src/programs/automation-studio/runtime/`; `SNF/` is downstream
`apps/scenario-lab/src/scenarios/social-network-feed/`. No Lab, no browser, no model call.

## Outcome

Done. No cause on today's code blocks a pass for a model that does everything right. Two causes are likely to stop
the build, given how every earlier build behaved: B1, a kept consent click that the dry run can never replay, and B2,
a loop whose listing is not the kept step just before the act. A third cause, V1, means a pass would prove little:
the Lab judges the dataset of the first extraction that ran, which in a correct Flow is the listing read before any
Confirm, not the table of accepted requests. **Q3: yes, the Lab resets the site between the build and the judged
playback**, so Tom Becker confirmed during exploration cannot reach the judged dataset.

## What changed and why

Only this report. Below: (a) the chain a correct build takes, (b) the causes ranked, each with a fix spec and a
provider-free test, (c) the causes that belong to other lanes.

### (a) The chain

**The site** (all from the scenario's own source):

- **Start, `/scenarios/social-network-feed/`.** While `consent` is `pending`, every page load shows a cookie wall
  ("Decline optional cookies" / "Allow all cookies", `SNF/markup/shell.ts:48,96-97`).
  - Three seconds after the wall is answered, "Turn on notifications?" appears, with "Not now", "Turn on" and a
    close control. It comes back on every load while unanswered.
  - Two and a half seconds after the prompt is answered, the "Chat with Elena Sokolova" window opens at the bottom
    right. It reopens on every load while its state is `open` (`SNF/client/shell-script.ts:33-34,120-174`).
  - All three answers are server state (`SNF/state.ts:115-120`). Nothing is kept in browser storage.
- **Top bar.** A Friends link (`friends/`) with a stale badge "4" (`SNF/markup/shell.ts:62`, `content/requests.ts:78`).
- **Friends home, `friends/`.**
  - A "Friend requests" heading with a "See all" link to `friends/requests/`, then only the first four requests: Tom,
    Amara, Priya and Jonas.
  - Below them, "People you may know" in the same card class, with Add friend and Remove (`SNF/markup/friends.ts:15-25`).
  - This is the trap: the four cards and the badge agree with each other, and there are eight requests.
- **Requests page, `friends/requests/`.**
  - A heading, "N friend requests" (8 fresh; it counts only requests still waiting), and "View sent requests".
  - Eight cards, `role="listitem"`, in a `role="list"` grid, in seed order (`SNF/markup/friends.ts:32-38`).
- **One card** (`SNF/markup/friends.ts:56-63`):
  - a photo link (`aria-hidden`), then the name link with the person's name;
  - the mutual line (`mutualLine`, or empty for Diego Alvarez);
  - the age the request was sent;
  - Confirm and Delete, each a `div role=button` with an `aria-label`.
- **What a confirmed card looks like.** The page swaps the buttons for "Request accepted" and a Message link
  (`messages/t/<slug>/`). The card keeps its place and its mutual line, and still reads the same after a reload,
  because the answer is server state (`SNF/client/requests-script.ts:130-141`, `SNF/state.ts:153-158`).
- **The rate limit.** Three confirms in any rolling 15 s (`content/requests.ts:99`).
  - The window lives in page memory (`confirmedAt`, `requests-script.ts:120-124,158-163`), so a page load clears it.
  - The fourth press opens an `alertdialog`: "You're going too fast … You can try again in `<span>N</span>` seconds."
    with an OK button. N counts down.
  - OK confirms nothing. When N reaches 0, "Try again" appears; it confirms the refused card (`requests-script.ts:142-157`).
- **The seed** (`content/requests.ts:66-75`), in list order:
  - Tom Becker, "1 mutual friend"
  - **Amara Osei, "23 mutual friends"**
  - Priya Nair, "4 mutual friends"
  - **Jonas Weber, "Aisha Khan and 4 other mutual friends"** (five)
  - Diego Alvarez, no line
  - **Lin Zhao, "11 mutual friends"**
  - **Freya Holm, "5 mutual friends"**
  - Marta Kowalczyk, "3 mutual friends"
- **The expected dataset `extract-confirmed`** (`SNF/manifest.ts:184,191-196`):
  - exactly four records, in list order: Amara Osei / "23 mutual friends", Jonas Weber / "Aisha Khan and 4 other
    mutual friends", Lin Zhao / "11 mutual friends", Freya Holm / "5 mutual friends";
  - the keys are exactly `name` and `mutualFriends`. The values must be equal strings
    (`packages/test-runner/src/run-expectations/extraction/value-match.ts:41-53`), and a record may carry no other
    key (`judgement.ts:287-293`);
  - `finalState`: the Flow ends on the path `friends/requests/` (`manifest.ts:196`).

**A correct build** (today's grammar):

1. `browser-navigate` to the start. The domain refuses any other node until this navigation has succeeded
   (debug `run-muog33va`, Q2).
2. The cookie wall. Either the in-command defence answers it on the first covered press (F1 declines optional
   cookies), or the model presses it. If the model keeps that press, it must mark it `optional`; see B1.
3. Navigate to `friends/requests/`, or press Friends and then "See all". Keep the step.
4. `dom-extract_list` over the cards, keeping only those to act on:
   - fields: `name` (the name link) and `mutualFriends` (the mutual line);
   - `where: [{ field: "mutualFriends", atLeast: 5 }]`. F8 reads "Aisha Khan and 4 other" as 5, and Diego's empty
     line fails the bound (domain `actions/extraction/condition-match.ts:135-148,196-209`);
   - result: 4 rows. Keep it.
5. Press Confirm on one kept row, with `add` and `act: a1`, declaring `modify_existing`. That declaration does not
   ask a person: only money, delete and send/publish do.
6. `amend_draft repeat` on that Confirm, with `over` = the listing.
   - The listing has to be the kept step immediately before the Confirm (B2).
   - The rows reach the click through For Each `item` (F4) and the row gate (F5): domain
     `output-nodes/native-runtime.ts:158-163`, extension `content/identity/record.ts:168-170,225-229`.
   - The card is a `role="listitem"` record, and its collapsed text holds both row values.
7. A **new** `dom-extract_list` of the accepted cards, with the same two fields:
   - the condition is, for example, a `read` of the status text containing "Request accepted";
   - in the build it returns one row (Amara);
   - it must not be a `rerun` of step 4 (R1).
8. `complete` with `acts` naming a1 on the Confirm.

**The completion gates:**

- **Instructed acts.** One act, `a1` (submit/confirm, `plural: true`; probe below). It is satisfied because the
  Confirm carries `repeat` (`R/flow-bootstrap/instructed-acts/check.ts:224,263-270`).
- **Assembly.** A For Each over the listing's `records` (`R/flow-bootstrap/authoring/draft-routing.ts:209-232`).
- **The dry run** (`R/llm/node-tools/dry-run-gate.ts`). It resets by a navigation to the first step's location and
  never clears what the site remembers (decision D1). Then:
  - the navigations and both reads replay;
  - the Confirm is **verified, not pressed** (`R/flow-draft/verify-only.ts`), and its row is already accepted, so it
    answers `present`. As a step inside the repeat span it is also conditional (F11);
  - a kept cookie or notifications press answers `unreproducible` and blocks (B1).

**Playback** (`packages/test-runner/src/flow-lane/creation/lane.ts:318-320`):

- The site is reset and the tab is left blank. The Flow navigates; the wall is back, and the optional click or the
  defence answers it.
- The Flow navigates to the requests page. The listing returns 4 rows.
- Passes 1-3 confirm Amara, Jonas and Lin.
- **Pass 4, Freya.** The fourth confirm inside 15 s fails `web.action.rate_limited`:
  - the record says `effect: "unacted"`, `stage: "execution"`, retryable, with `retryAfterMs` = N s + 500 ms
    (`domain/src/runtime/failure/codes.ts:217`, extension `action-runtime/rate-limit-notice.ts:77,166-173`);
  - the in-command loop leaves it alone (`recovery/fault.ts:116`);
  - Core assesses it `retry` (`R/executor/defensive/assess.ts:112-127`), waits for the hint, at most 30 s
    (`R/executor/defensive/retry-wait.ts:8,48-59`, `R/executor/graph-run.ts:579-623`), and runs the node again;
  - attempts are counted per arrival (`graph-run.ts:410-450`), so the pass has its own three;
  - on the retry the in-command defence closes the notice with **OK, never "Try again"**
    (`interference/vocabulary.ts:49-59,141-164`), and the press confirms Freya.
- The notifications prompt (3 s after the page loads) and the chat (2.5 s after that) can land in the middle of the
  loop. The in-command defence clears them on the next covered press.
- The accepted read returns 4 rows. The Flow ends on `friends/requests/`.
- Judgement: `lane.ts:350-374`.

### (b) Causes

#### Likely to stop the build (fix before the first run)

**B1. A kept consent press (or "Not now") can never replay in the dry run, and every completion is refused until the
model marks it optional or drops it.**

- **Why.**
  - Once the wall is answered during exploration, the server remembers it. The dry run's reset is only a
    navigation (D1), so the wall never comes back.
  - The replayed click fails `TARGET_NOT_FOUND`. The domain answers `unreproducible` (domain
    `runtime/llm-evidence/node-run/replay.ts:205-222`).
  - Every status except `replayed` blocks unless the step is conditional (`R/flow-draft/dry-run.ts:53-67,199-225`).
  - The old pass for a step "already asked about" is gone (`R/llm/node-tools/dry-run-gate.ts:82-87`). An unchanged
    draft is judged again and refused again (`dry-run-gate.ts:107-125`).
- **Evidence.**
  - Run 33 (`run-muog33va`): `d3`, the click on the home page, came back `unreproducible` in both dry runs. It is
    most likely the cookie press: a Friends link is on every page and would have replayed. The debug records the
    target as NO EVIDENCE.
  - The gate passed `d3` then only under the removed "asked" rule (debug, Stage 2).
  - From iteration 24 on, that model only re-completed. Under today's rule that ends at the no-progress guard
    (8 steps), which is how run 33 ended.
  - Runs 8 and 9 also kept an explicit press (`dismiss-cookies-1`, `dismiss.cookies`). Run 9 also pressed
    `dismiss.notifications`.
- **Fix spec (cross-repository; the dry run is t196's area under D1, so confirm ownership first).** Make
  "dismissed a layer that is not shown now" something the dry run recognises and turns into `optional` itself.
  1. Extension `apps/extension/src/content/actions/click.ts`, plus `action-runtime/results.ts` for the payload field
     and `shared/protocol.ts` if the payload is typed there.
     - Before the press, if the resolved target is inside a layer `overlaysOverPage()` reports, set
       `payload.pressedInLayer: true`. Closed boolean, no text.
     - The rate-limit watch already takes `probe.layers()` before the press (`rate-limit-notice.ts:89`); reuse that
       read.
  2. Domain `runtime/llm-evidence/node-run/replay.ts`. This is not one of t223's files; the statement is built here
     from the payload `run.ts:370,466` passes.
     - `webNodeReplayStatement` records `produced.inLayer: true` when the payload carries `pressedInLayer`.
     - When a replayed step with `produced.inLayer` fails `TARGET_NOT_FOUND`, answer `unreproducible` with
       resultCode `core.replay.layer_absent` (new entry in `node-run/replay-answer.ts`).
  3. Core `R/flow-draft/dry-run.ts`.
     - Export `AUTOMATION_STUDIO_FLOW_DRAFT_REPLAY_LAYER_ABSENT_CODE`.
     - An `unreproducible` outcome with that code, on a step with no routing, does not block.
     - In `R/llm/node-tools/dry-run-gate.ts`, after the replay, set that step's `routing = { kind: "optional" }` and
       say so in the feedback, e.g. `madeOptional: [step]` plus one sentence, so the model is not left believing
       the step always runs.
  - Rejected alternative: treating any target missing on the very page the step acted on as not needed. That would
    also wave through a control that is really gone.
- **Provider-free tests.**
  - Domain `node-run/tests/`: a click whose statement carries `inLayer` answers `core.replay.layer_absent` on
    `TARGET_NOT_FOUND`; one without it stays plain `unreproducible`.
  - Core `R/llm/node-tools/tests/dry-run-gate.test.ts`: a draft `[nav, press(inLayer, layer_absent), nav, read]`
    passes the gate, and the press now has `optional` routing. The same draft with a plain `unreproducible` press is
    still refused.
  - Extension `actions/tests/click.test.ts`: a press on a control inside an injected layer reports `pressedInLayer`.
- **Cheaper interim.** None that is honest. The refusal already tells the model to use `amend_draft optional`
  (`dry-run.ts:257-260`), and run 33's model did not act on comparable feedback.

**B2. The loop's listing must be the kept step immediately before the act. Any kept step between them refuses the
completion, and the refusal's advice builds a wrong Flow that passes every gate.**

- **The rule.** `R/flow-bootstrap/authoring/draft-routing.ts:199`: `overAt !== input.index - 1` →
  `flow_draft.repeat_not_after_its_source`. Lines 204-205 hold the same rule for the emitted head.
- **The amendment accepts the shape.** `R/flow-draft/amendment.ts:274-280` checks only that `over` comes before the
  act. So the refusal arrives only at completion, the way run 33's did.
- **How a step gets between.**
  - Lane B's A1 puts a rerun at the replaced step's old position (`R/llm/evidence-loop/rerun-replacement.ts:58-61`).
    A dismissal kept after the first read, followed by a rerun of that read to add the `where` (which F11 asks for),
    leaves the dismissal between listing and act.
  - The notifications prompt appears 3 s after the requests page loads, which is exactly while the listing is being
    tuned. Run 9 pressed `dismiss.notifications` at iteration 27, after its listings.
  - A dismissal marked `optional` (B1's own remedy) adds a join Merge, which also sits between.
- **The advice is harmful.** "Say repeat with no over to mean the step before this one" makes the dismissal press
  the loop's source. `listPort` finds no array output, so it becomes a while-loop on the dismissal
  (`draft-routing.ts:225-232`):
  - the Confirm runs while "Not now" keeps succeeding, at most once in practice, on the explored row;
  - the act check accepts it, because the step carries `repeat`;
  - the dry run accepts it, because the step is conditional;
  - V1's judge then passes it, because the pre-act listing matches.
- **Probe** (this session, scratch vitest on Core's own assembler and the web node fixture): `[read d1, press d2,
  press d3 repeat over d1, read d4]` → `[["flow_draft.repeat_not_after_its_source","Step 3 repeats over step 1, which
  has to be the step immediately before the span. Move it there with an amend_draft reorder, or say repeat with no
  over to mean the step before this one."]]`.
- **Fix spec.** Core `R/flow-bootstrap/authoring/draft-routing.ts`, function `repeat()`.
  - Replace the adjacency check with `overAt >= input.index` → refuse (`over` must come before the span). Keep the
    existing refusal when the `over` step has been consumed by another construct, or has no emitted entry.
  - Find the `over` step's emitted entry by label in `emitted` and add `branch(rows, each, "items")` to it. Leave it
    unrouted, so it keeps its fall-through into the step after it. The assembler gives a non-routed step's first
    unclaimed output to the next step (`R/flow-bootstrap/authoring/assemble.ts:405-440`).
  - Give the last emitted entry (`head`, which may be the step between or a join Merge) `branch("success", loop,
    "branches")` and `routed = true`.
  - The steps between run once, before the loop.
  - Remove "or say repeat with no over …" from the remaining message. Name the list step's number instead.
- **Provider-free tests** in `R/flow-bootstrap/authoring/tests/draft-routing.test.ts`:
  1. The probe's draft gives no error. The wiring contains `web.output.dom-extract_list:records ->
     builtin.control.for-each:items` and the press between → `builtin.control.merge:branches`.
  2. The same with the press between marked `optional`: the join is between, and the plan is still built.
  3. `validateAutomationStudioFlowBootstrapPlan` accepts both.
  4. A graph run, as in the existing "gives the step's own implementation the row of each pass" case (`:299`),
     proves each pass gets its own row with the step between.

#### Verdict honesty (fix before the run, or a pass proves nothing)

**V1. The Lab judges the dataset of the first extraction node that ran. In a correct Flow that is the loop's listing,
read before any Confirm.**

- **Where.** `packages/test-runner/src/flow-lane/creation/judgement.ts:50`, `candidateOrder:
  executionOrder(run.actions)`, then `flow-lane/expectations.ts:203-206`, `ordered[0]`.
- **Why two datasets.** Every `extract_list` stores its own dataset. The id digests item, fields and `where`
  (domain `output-nodes/extract-list/derived-record-output.ts:46-84`), so the listing and the accepted read never
  share one.
- **False pass.** The listing has the four qualifying requests with `{name, mutualFriends}`: exactly the expected
  records, whatever the loop then did. These Flows would pass:
  - a loop that confirmed nothing past the first pass while the run still "succeeded" (B2's while-loop);
  - a leftover single Confirm on a fixed row (run 6's `s9`/`s11`) that accepts a fifth person.
- **False fail.** If the listing carries any other key (a status, a count), the correct accepted read is never
  looked at, because a record may carry no extra key (`run-expectations/extraction/judgement.ts:287-293`).
- **Fix spec.** In `judgement.ts`, build the candidate order for the one expected step as:
  1. datasets with at least one record whose key set equals the expected record's key set (minus
     `optionalFields`), **latest-run first**;
  2. then the rest, in today's first-run order.
  - The existing `muhrf6c4` test (`creation/tests/judgement.test.ts:78-94`) keeps passing: its second dataset is
    empty, so it has no keys to match.
- **Provider-free tests** in `flow-lane/creation/tests/judgement.test.ts`, built from the scenario's own task and
  manifest (`loadCreatedFlowRequest({ scenarioId: "social-network-feed", taskId:
  "social-network-feed-confirm-requests" })` and `workflow.expected.extracted`):
  - **Honesty.** Dataset 1 (ran first) = the 4 expected records; dataset 2 (ran last) = the first 3. Today
    `createdFlowDatasetHolds` is true; after the fix it is false and measured on dataset 2.
  - **False fail.** Dataset 1 = the 4 records plus a `status` key; dataset 2 = the 4 expected. Today it fails; after
    the fix it holds.
- **For the lead.** This makes a pass harder to earn and honest. The accepted read (step 7) must then be right.

#### Risks (each can fail the run; none is certain)

**R1. A `rerun` of the loop's listing silently moves the loop onto the rerun's rows.**

- **Why.** Since A1, a rerun takes the replaced step's place and inherits every reference to it
  (`rerun-replacement.ts:51-61`).
- **The trap.** If the model reruns the listing to read the accepted cards (run 33 used one listing as both the loop
  source and the answer, debug "Stage 3"), the For Each now walks the accepted read:
  - in the build that read returns rows, so every gate passes;
  - in playback, after the reset, nothing is accepted yet, so the loop walks 0 rows and the dataset is empty.
- **Nothing tells the model.** `R/llm/evidence-loop.ts:686` applies the change and no message says the loop moved.
- **Fix spec.** In Core `R/llm/evidence-loop/rerun-request.ts:41-62`, refuse a `rerun` of a step that a proposed
  step's `repeat` names as `over`.
  - New reason `rerun_of_loop_source`, added to the union at `R/flow-draft/amendment.ts:113` and to
    `R/llm/draft-amendment-feedback.ts`.
  - Feedback: "step N is the list step M repeats over. To read the result after the loop, run extract_list as a new
    step and add it. To change the rows the loop walks, take the repeat off M (`keep`), rerun N, then repeat again."
  - The Lab's copy of refusal reasons must gain it too (`packages/test-runner/src/existing-fluxiq-control/
    publishable-step-value.ts`; F16 found it behind before).
  - Wording-only alternative: add the same sentence to the per-item telling (`amendment.ts:136`,
    `R/flow-draft/entry.ts`) under the entry-budget tests.
- **Test.** `R/llm/evidence-loop/tests/rerun-request.test.ts`: a draft `[read d1, press d2 repeat over d1]` and
  `{step: 1, change: "rerun"}` → refused `rerun_of_loop_source`. Without the repeat it still runs.

**R2. The Friends home shows 4 of 8 requests behind "See all".**

- Run 6 (`run-munq51ik`) listed the Friends home and walked Tom, Amara, Priya and Jonas.
- The badge (4) agrees with the four cards. Only the requests page says "8 friend requests".
- Nothing in the extraction result says that the list's section links to more.
- Route: t223 (what the page view shows of a section's "See all"). A lane-D alternative is an extraction hint:
  `partialList` when the item list's section heading has a closed-list "See all/View all/Show all" link. That hint
  would be fixture-testable from `renderFriendsHome`'s markup.

**R3. The waited retry at pass 4 (F7) is unproven live.**

- Run 6 saw the detector fire live. Every link is unit-tested: `rate-limit-notice.test.ts:17` uses this site's exact
  notice text; the way-out tests; Core `assess`.
- No single test runs the whole Core path: For Each → rate-limited → hinted wait → retry on the same row.
- Test to add, in Core `R/flow-bootstrap/authoring/tests/draft-routing.test.ts`, next to the graph-run case at
  `:299`. The 4-row loop's body is a native click implementation that:
  - returns a failed attempt with a failure record `{ code: "web.action.rate_limited", category: "action_failed",
    retryable: true, stage: "execution", effect: "unacted", retryAfterMs: 11_500 }` on pass 4's first attempt;
  - succeeds otherwise.
- Assert: the run succeeds; pass 4 has two attempts with the same `item`; the injected delay was asked for 11,500 ms.

**R4. Wrong lasting acts during exploration (Tom Becker, runs 8 and 33).**

- They are harmless to the verdict (Q3), and harmless to the Flow: the row gate scopes each pass by its own values,
  whichever card the explored press was on.
- They are still a wrong act on the person's account. Top cause 9 stays open (t195). Not a first-pass blocker.

**R5. A leftover single Confirm kept outside the loop** (run 6 `s9`/`s11`) presses a fixed card in playback.

- F11(b)'s wording says to drop such a step. Nothing enforces it.
- V1 turns the false pass it causes into an honest fail. No further fix recommended now.

**Q3, answered.**

- **The Lab resets.** `flow-lane/creation/lane.ts:318-320` calls `resetScenarioLab` before `prepareFlowPage("playback")`.
  - It posts `/__control/reset` (`apps/scenario-lab/src/server.ts:110-112`), which calls `ScenarioStateStore.reset()`.
  - That rebuilds every scenario's state from `createState` (`apps/scenario-lab/src/state-store.ts:20-23`), so
    `createFeedState()` returns `requests: {}` and every overlay is pending again (`SNF/state.ts:76-96`).
  - The seed is kept, so class names match the build.
  - The site keeps nothing in browser storage. The rate-limit window is page memory and resets on load.
- So a wrong confirm made during exploration cannot reach the judged dataset, and no fix is needed for the verdict.
- What it still touches:
  - the build's own evidence. The dry run never clears site data (D1), so the build's accepted read shows Tom;
  - the person's real account (R4).

### (c) Other lanes

- **t223 (page view).**
  - Which Confirm handle the model sees for which card. That decides whether it presses Tom.
  - `handle_not_in_packet` on `detect_repeating_structure` and on presses (runs 8, 9, 33).
  - Whether the "See all" link and the "8 friend requests" heading are visible (R2).
- **Lane B (`R/recovery/runtime-exploration.ts`).** If pass 4's retry still fails in playback, the run enters the
  repair ladder and its runtime exploration. This task asks nobody, so the decline-as-silence defect there does not
  bite. Any repair exploration of a failed Confirm is lane B's.
- **t196.**
  - The dry run and decision D1, which B1's Core half sits in.
  - The mid-build return to the start location that every dry run makes.
- **t191.** The UI during the build: no chat message when FluxIQ confirms someone while building, and raw codes in
  the overlay (run 33 debug, UI table).

## Commands run and observed results

- Scratch vitest probe of the instructed acts for the live instruction (Core `automationStudioInstructedActs`, run
  from `fxwork/t195/!FluxIQ/packages/fluxiq`, `npx vitest run --root <scratchpad>/t195-w19a-probe`): printed
  `[{"id":"a1","kind":"submit","verb":"confirm","quote":"confirm everyone I have at least five mutual friends with,
  and leave every other request as it is","plural":true}]`, 1 passed.
- Scratch vitest probe of `assembleAutomationStudioFlowDraftPlan` with the web node fixture, draft `[read d1, press
  d2, press d3 repeat over d1 through d3, read d4]`: printed the `flow_draft.repeat_not_after_its_source` issue
  quoted in B2, with no plan; 1 passed.
- Read-only `grep` and `sed` over both trees. Nothing else was built or run.

## Not verified

- Anything live. No Lab, browser or model call.
- Whether this model keeps a cookie or notifications press (B1) or a step between listing and act (B2). Both are
  inferred from runs 8, 9 and 33.
- `overlaysOverPage` and the in-command defence against this site's real scrims, prompt and chat. That needs layout;
  only their unit tests were read.
- The full F7 retry through the executor (R3's test does not exist yet).
- B2's fix wiring: whether the assembler gives the unrouted listing's fall-through to the next step exactly as
  described. That is read from `assemble.ts:405-440`, not executed.
- The run-evaluation layer above the created-Flow lane, beyond `lane.ts`, `oracles.ts` and `persisted-flow-run.ts`.
- No package's own test suite was run.

## Open questions or contradictions found

- B1's Core half is in the dry run, which run 33's debug assigns to t196 (D1). The lead should confirm who takes it.
  B1 also adds a Core-read replay code, so it crosses the repository boundary.
- V1 makes the judge stricter. A Flow that is right only because its pre-act listing matches will fail. That is
  intended, but it is a change to what a pass means.
- R1's refusal adds a reason, and the Lab keeps its own copy of the refusal reasons (`publishable-step-value.ts`).
  Both must change together.
- Contradiction with the lane report's Stage 1 note: it calls Tom Becker's exploration confirm "a wrong answer that
  looks right". With the reset at `lane.ts:319` it cannot reach the judged dataset. It matters only to the build's
  own evidence and to the real account.
