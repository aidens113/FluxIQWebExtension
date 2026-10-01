# t195-w19c: audit of `professional-network-withdraw-stale-requests` before the first live run

Worker t195-w19c, 2026-10-01. Read-only audit of the downstream tree and Core at `task/t195-live-control-flow`
(downstream `a15a465e`, Core `f3778a8e`). No product file changed. No Lab, no browser, no model call.

## Outcome

Done. One cause makes the first live run fail every time, even when the model builds the right Flow (**B1**). A second
cause fails the run whenever the model repeats the span that run 3 repeated, and nothing in the code refuses that span
(**B2**). Both are proven provider-free:

- **B1** by a scratch unit run against `record.ts`.
- **B2** by running Core's own `check.ts` and `routing.ts` on the run-3 shape.

Four risks follow (R1-R4). R1 is the most expensive: a hidden "Show more" is never read as the end of the list.

The answers to the brief's three questions:

- **(3) Is the site reset before the judged playback?** Yes. Exploration's withdrawals do not change what playback sees.
  They do change what the dry run sees.
- **Permission across many Withdraws.** After one grant, every later `delete` in the same build is allowed without
  asking. This covers exploration, the plan-step checks and the dry run.
- **Does the lane's apply check accept a Flow whose Withdraw runs N times?** Yes. It looks for one grant at the point,
  and a replay has no gate.

## (a) The chain a correct build takes, from the scenario's own source

Paths under `apps/scenario-lab/src/scenarios/professional-network/` unless stated otherwise.

1. **Start on the feed** (`manifest.ts` `startPath: ROOT`). Three overlays arrive and stay until answered, as session
   state on the server:
   - the app prompt at 2.5 s, whose scrim covers everything;
   - a conversation at 3.5 s, over the lower right;
   - the cookie banner (`manifest.ts:20-36` ARRIVE).
2. **Open Sent invitations** at `mynetwork/invitation-manager/sent/`.
   - The manager opens on **Received** (`mynetwork/invitation-manager/`). Received rows offer Ignore and Accept, never
     Withdraw, and its pills are inert (`network/manager-page.ts:143-145`, `manager-client.ts:63-72`).
   - The **Sent** tab is a link (`manager-page.ts:130`).
3. **Narrow to people.**
   - Sent opens on **All (36)**: 28 person rows, 7 page rows and 1 newsletter row.
   - The pills are buttons that reload the page with `?invitationType=CONNECTION|ORGANIZATION|NEWSLETTER`
     (`network/rows.ts:8-13`, `manager-client.ts:23-25`). **People (28)** is the straight route.
   - On All, the kind has to be filtered per row:
     - a person row has a headline `div` (`rows.ts:72`);
     - a page or newsletter row has a sentence `div` instead, and its "Withdraw" is a styled `div`, not a button
       (`rows.ts:76-78`).
   - The pill counts are computed at render (`manager-page.ts:135`). A reload after a withdrawal therefore says
     "People (27)". A client-side withdrawal changes no count.
4. **Read every row.** `extract_list` over `li[data-entity-urn]`:
   - Fields: the name, the `data-entity-urn` attribute, and the age.
   - The age exists **only** in `gl-time-ago`'s open shadow root, as "Sent N … ago" (`rows.ts:69`,
     `shell/client-script.ts:60-66`). The `datetime` attribute holds an ISO instant. F12 makes the field reader and
     structure detection read that text.
   - `paginate: {mode: "loadMore", control: <Show more>, maxPages >= 3}` for People, or `>= 4` for All. Ten rows load
     per page (`rows.ts:15`).
   - The first "Show more" after a load never finishes. It hides itself, a spinner turns, and 1.5 s later
     "Something went wrong. Retry" appears inside the spinner, right after the button. Only the Retry loads the rows,
     600 ms later. Every later Show more loads after 600 ms (`manager-client.ts:47-61`). F6 presses that Retry
     (`apps/extension/src/content/extraction/load-retry.ts`).
   - After the last page, Show more stays in the DOM with `hidden` set (`manager-client.ts:45`).
   - `where: [{field: <age>, matches: "month|year"}]`. "4 weeks" (28 days) fails it. Every row from 33 days up passes.
     Ages map to text through `data/time-ago.ts:22-37`.
5. **Which rows are stale.** People order is newest first (`data/invitations.ts:15-51`):
   - Positions 1-10 (0-17 days): none.
   - Positions 11-20: Hamza 20, Oskar 22, Lieke 24, Sven 26, Julia 27, **Rosa 28 ("Sent 4 weeks ago", stays)**, then
     Aoife 33, Mehmet 38, Ines 45, Kees 52 ("Sent 1 month ago").
   - Positions 21-28: Derek 61, Fleur 66, Emre 80 ("2 months"), Freya 95 ("3 months"), Nadia 124 ("4"), Koen 150 ("5"),
     Elif 199 ("6") and Marit 240 ("8").
   - That makes **12 stale person rows: 4 on page 2 and 8 on page 3.**
   - On All, four month-old non-person rows must be left alone: Pieter Groen (page, 40 days), Sophie Laurent (page,
     70), Anouk Smit (newsletter, 90) and Bas Timmer (page, 130).
6. **Withdraw one kept row while exploring.** A person row's `<button>Withdraw</button>` opens the shared dialog
   (`shell/dialogs.ts:17-31`): title "Withdraw invitation", Cancel, and **"Withdraw"** with
   `data-testid="withdraw-confirm"`.
   - The dialog lives in the modal outlet, outside the list.
   - Confirming closes the dialog synchronously, then posts `withdraw-invitation` (`state.ts:50-53`).
   - The row fades and is removed after 250 ms, and nothing is pulled up (`manager-client.ts:21`).
   - A toast appears at the bottom left (`shell/styles.ts:71`).
   - Declarations: the row press is `[]` (it only opens), and the confirm is `delete`. Core's gate asks about the
     confirm, "Withdraw" (button), missing `delete`. L1 grants it because it is the declared point
     (`live-tasks.ts:47`). The press then goes ahead.
7. **Author the loop.** `amend_draft repeat` on the row press, `over` the listing, **`through` the confirm**. Name the
   act `a1` for the step that does it.
   - The instruction yields exactly one act: `a1 submit:withdraw`, `plural: true`, 251 characters. This was measured
     on dev's `instruction-acts.ts`.
   - Completion runs the instructed-acts check, then the dry run, where the steps of a span are conditional and never
     block (`flow-draft/routing.ts:115-139`). Then comes the proposal.
8. **The Lab.**
   - `assertGrantedAtPermissionPoint` finds the grant (`packages/test-runner/src/flow-lane/creation/lane.ts:393-401`).
   - The Flow is applied.
   - **The scenario is reset** (`lane.ts:318-319`) and the playback page is prepared.
   - Playback: navigate, optionally press People, read all pages, then **For Each over the 12 kept rows**. Each pass
     presses that row's Withdraw, scoped to the row by its values (F4, F5), then the dialog's confirm. The confirm has
     no record and no list position, so it is dispatched unchanged (`domain/src/output-nodes/native-runtime.ts:149-157`).
9. **The judgement.** The playback goal `withdraw-month-old-requests` compares the embedded invitation store with
   `STORE_AFTER_WITHDRAWAL` (`records.ts:30-31`): exactly the 12 stale person urns withdrawn, nothing else changed.
   It is an exact set, so one extra or one missing withdrawal fails it.

## (b) Causes, ranked

### B1 — blocks the first pass, every time: the For Each row gate cannot see the age the extraction read from the shadow root

- **Evidence.**
  - Each pass's row is handed to the body's click as `record.values`: **every** string field of the record, the age
    included (`domain/src/output-nodes/native-runtime.ts:158-166`, `webAutomationRecordValues(Object.values(item))`).
  - The page accepts a candidate only if its record holds **every** value
    (`apps/extension/src/content/identity/record.ts:168-170`, `:225-229`), at both the exact and the scored level
    (`action-runtime/resolve-target.ts:381`, `:513-516`).
  - `rowContents` (`record.ts:252-273`) walks `childNodes` only (`:270`) and never enters `shadowRoot`. So "Sent 1 month
    ago", which F12 now reads into the record (`content/extraction/field-reader.ts` `drawnText`), is in no row's text,
    attributes or links. The age's host carries only `datetime` (ISO) and `class`.
  - No row admits, and the Withdraw on pass 1 fails with no candidate. The condition on age has to read that field, so
    every correct build carries it.
- **Proof, provider-free.**
  - A scratch test bundled against `record.ts`, with stub rows shaped like `rows.ts:71-73` (an age host with a shadow
    root).
  - `agreesWithRecordedRecord({values: [name, urn]}, button)` gave `true`.
  - `agreesWithRecordedRecord({values: [name, urn, "Sent 1 month ago"]}, button)` gave **`actual: false`**.
- **Where it shows.** Only in playback. Exploration and the dry run run the press with no `item`, so they never meet
  the gate. A green build therefore ships a Flow that fails at the first pass.
- **Fix spec.**
  - In `apps/extension/src/content/identity/record.ts`, change `rowContents`: when an element has an open `shadowRoot`,
    walk its shadow root's child nodes too.
    - Push them after the light children, so the stack visits them first, at the host's position.
    - Use the same `MAX_ROW_NODES` budget and the same sensitive-control skip.
    - Skip `STYLE`, `SCRIPT`, `TEMPLATE` and `NOSCRIPT` subtrees there, because a component stylesheet must not use up
      `MAX_ROW_TEXT`.
    - Attribute values and links inside the shadow root count in `exact`, as light ones already do.
  - Leave `recordText` and `recordIdentity` alone. Recording and replay are blind there consistently.
  - Update the header paragraph "What counts as a record" with one sentence saying that shadow-drawn words count for
    row values.
  - Optional, and better long-term: move w9's `drawnText` walk into one shared module, so the field reader and the gate
    cannot disagree again. w9 recommended this for `sensitive-text.ts`. That widens the change to other readers, so do
    it only as its own brief.
- **Test** (`apps/extension/src/content/identity/tests/record.test.ts`, new cases, extending that file's stub `el()`
  with an optional `shadowRoot: {childNodes, children}`):
  1. A person row as `rows.ts:71-73` draws it. Values `[name, urn, "Sent 1 month ago"]` admit its own Withdraw and
     refuse a neighbour whose shadow root says "Sent 4 weeks ago".
  2. A `<style>` inside the shadow root is not what a value matches.
  3. A row with no shadow root reads exactly as before, as a regression guard.

  Case 1 must fail on HEAD; the scratch run above shows it does.

### B2 — blocks the pass whenever the model ends the repeat at the row press (run 3's shape); nothing refuses it

- **Evidence.**
  - The amendment schema still tells the model "`through`: … Leave it out to repeat this step alone"
    (Core `runtime/flow-draft/amendment.ts:142`). The code defaults `through` to the step itself (`:271`).
  - The instructed-acts check accepts a plural act whose claimed step is anywhere in a span
    (`flow-bootstrap/instructed-acts/check.ts:224`, `:263-270`). It never asks whether the act's last step, the
    dialog's confirm, follows the span instead.
  - Only steps inside a span are exempt in the dry run (`flow-draft/routing.ts:128`, `:134-139`).
  - A confirm after the loop that declares `delete` is only *verified* in the dry run, not run (`flow-draft/verify-only.ts:85-89`).
    With the dialog shut, that check reads either `present` (same page) or `failed hidden`, depending on how the
    resolver answers (`domain/.../node-run/verify.ts:133-139`, `:151-171`). So the shape can reach a proposal.
  - Playback then fails on pass 2 with `web.action.blocked_by_dialog`. This is exactly run 3
    (`debugs/run-munnyvbr-11c28a0f.md`, causes 1-2: s7 then s5, s6, s7 failing four times; s9 never reached).
- **Proof, provider-free.** Core's `check.ts` and `routing.ts` were run under `node --experimental-strip-types` on the
  real instruction, with a draft of listing d1, row press d2 (`consequences: []`, `repeat over d1 through d2`) and
  confirm d3 (`["delete"]`):

  ```text
  claim row press ok=true
  claim confirm ok=false ["act_needs_repeat"]
  conditional (dry run exempt): [ 'd2' ]
  ```

  F15's `repeatWith` is right only when the model claims the confirm.
- **Fix spec.** Core, `packages/fluxiq/src/programs/automation-studio/runtime/`. `check.ts` is shared with t174, as
  the fix log says, so coordinate before editing it.
  - **Rule:** take a plural act whose claimed step is repeated by a kept span (carrier through `through`). Let N be the
    next *proposed* step after `through`. The act is refused with the new reason **`span_stops_short`**, its step and a
    new field `after: <N's position>`, when all of these hold:
    - N is `effect: "mutate"`;
    - N declares a lasting consequence, read the way `verify-only.ts` `declaresLasting` reads
      `ranWith.consequences ?? input.consequences`;
    - N is not itself repeated;
    - no act's claim names N.

    Steps claimed for another act stay legal, for example "add every X to the cart, then place the order".
  - Files to change:
    - `flow-bootstrap/instructed-acts/check.ts`: `automationStudioInstructedActStepFault` takes `steps` already. Add
      the rule after the `act_needs_repeat` test, and add a `SPAN_INSTRUCTION` sentence to `REASON_INSTRUCTIONS`: "a
      reason of span_stops_short means the step right after your repeat (after) does part of the act on each row, such
      as the confirmation the press opened, but runs once after the loop: repeat through it."
    - `flow-bootstrap/instructed-acts/contracts.ts:133` and `checklist.ts:47`: the union gains `span_stops_short`, and
      `missingActs.acts[]` gains an optional `after`.
    - `flow-bootstrap/unfinished-build/not-done.ts:22`: add a wording entry, "part of it ran once after the loop
      instead of on every item".
    - `llm/harness-options/repeat-suggestion.ts`: for `span_stops_short`, suggest
      `{step: <carrier position>, change: "repeat", over: <carrier's over>, through: <after>}`.
    - `flow-draft/amendment.ts:142`, the `through` description: append "A press that opens a confirmation repeats with
      it: name the confirmation as through." Check the description budget in `flow-draft/tests/entry-budget.test.ts`.
- **Tests.**
  - `flow-bootstrap/instructed-acts/tests/check.test.ts` gains four cases:
    1. The run-3 shape claimed on the row press is refused `span_stops_short`, `after: 3`.
    2. The same draft with `through: d3` is accepted.
    3. A loop of adds claimed `a1`, followed by a `move_money` "Place order" claimed `a2`, is accepted.
    4. A step after the span declaring `[]` is accepted.
  - `llm/harness-options/tests/repeat-suggestion.test.ts`: the suggestion's `through` is the step after.
  - Cases 1 and the suggestion case must fail on HEAD; the probe above shows case 1 does.

### R1 — risk, high: a hidden "Show more" is not read as the end of the list

- **Evidence.**
  - `pressLoadMore` ends the list only on an absent or disabled control
    (`apps/extension/src/content/extraction/pagination.ts:411-424`, `isDisabled` `:544-546`). Guildline leaves the
    control in the DOM with `hidden` after the last page (`manager-client.ts:45`).
  - With `maxPages` equal to the page count (3 for People, 4 for All), the read stops `truncated`/`page_limit`. The
    model is told "the page bound … was reached while the list went on -- raise it to read more"
    (`content/actions/extract-list.ts:318`).
  - With a higher `maxPages`, the hidden button is clicked. The site appends nothing (`fetchMore` past the last urn),
    the read waits the full 10 s (`pagination.ts:416-422`), and it ends `list_unchanged` with "the page ignored its
    pagination control" and "the read ends with the pages it has" (`extract-list.ts:265`, `:321`).
  - The rows are complete either way. Every read nonetheless costs 10 s and claims the list is incomplete, in
    exploration, in every dry-run replay and in playback.
  - Run 3's model already answered extraction trouble by asking for fewer rows (`debugs/run-munnyvbr-11c28a0f.md` it 5,
    14).
- **Fix spec.** In `apps/extension/src/content/extraction/pagination.ts`, `pressLoadMore`: before the page-bound test,
  treat a found control that is not rendered as the list ending, after a short grace. Not rendered means the `hidden`
  attribute, or `getClientRects().length === 0`. The grace polls for up to 1 s for a control a page hides only while it
  settles. Return `ended("control_absent")`; a hidden control is absent to a person. That is an ordinary end, so it
  needs no domain wire change and no phrase (`extract-list.ts` `ORDINARY_END`). Update the header bullet for
  `loadMore` (`:35-40`).
- **Test** (`apps/extension/src/content/extraction/tests/pagination.test.ts`, with a stub `document` global like
  `load-retry.test.ts`'s):
  1. A `loadMore` control that is present and hidden gives `{outcome: "ended", stop: "control_absent"}`, its `click`
     is never called, and it returns well under 10 s.
  2. With `pagesRead === maxPages` and the control hidden, the result is ended, not truncated.
  3. A visible control at the bound is still `truncated`.

  Cases 1 and 2 fail on HEAD.

### R2 — risk, medium: no question is asked if the model declares the withdrawal `modify_existing`

- **Evidence.**
  - The gate asks only about `move_money`, `delete` and `send_or_publish`
    (`action-permissions/destructive.ts:50-56`, `gate.ts:305-315`).
  - Run 3 declared both Withdraw presses `modify_existing` (`debugs/run-munnyvbr-11c28a0f.md` stage 3).
  - With no ask, no grant exists, and the lane refuses the proposal `permissionPoint: "not_asked"`
    (`packages/test-runner/src/flow-lane/creation/lane.ts:398-401`).
  - The declaration cross-check sees instructed `delete` as `undeclared`, but by design it refuses nothing
    (`action-permissions/cross-check.ts:20-33`, `flow-bootstrap/adaptation.ts`). Its premise, "the instruction is the
    authority for permitting", has been stale since F10.
  - Run 10 declared `delete`, so this depends on the model. The `core.run_node` wording says "a node that … deletes …
    names its class" (`llm/node-tools/run-node.ts:77`).
- **Fix spec.** Core, again `instructed-acts`, so coordinate with t174.
  - `instruction-acts.ts`: an act carries the gated class its verb implies, from a closed list on the **instruction**
    (not on controls):
    - `withdraw`, `delete`, `remove`, `cancel`, `unsubscribe` imply `delete`;
    - `order`, `buy`, `pay`, `check out` imply `move_money`;
    - `send`, `post`, `publish`, `submit`, `apply`, `request` imply `send_or_publish`.
  - `check.ts`: a claimed act step whose span declares none of that class is refused with the new reason
    `act_consequence_undeclared`. Its sentence: "the person's words ask to withdraw; rerun the step that does it
    declaring delete; the person will be asked."
  - Contract and wording entries as in B2.
- **Test** (`check.test.ts`): a confirm declared `["modify_existing"]` for `a1 withdraw` is refused; declared
  `["delete"]` it is accepted. In `instruction-acts` tests, the withdraw act carries `delete`.

### R3 — risk, model and page view: page and newsletter invitations pass an age-only condition

On All, four month-old non-person rows pass `matches: "month|year"` (chain, step 5). Their Withdraw is a `div`
(`rows.ts:78`), so the pass on Pieter Groen fails, because no button is in that row. That is pass 3 in All order. If
the row is resolved at all, a page invitation is withdrawn and the exact-set goal fails.

The right build presses People, or adds `{field: <headline>, is: "present"}`. The headline column is the
`:scope > div:nth-of-type(1) > div:nth-of-type(2)` one that w9 measured.

No code fix here. It is what the model is shown, which is t223's. A provider-free check for t223: detection on the All
list proposes a column present on person rows only.

### R4 — risk, low: the dry run sees exploration's withdrawals; playback does not

The dry run's reset is a navigation (`flow-draft/dry-run.ts:69-74`). After exploration withdraws a stale row:

- the listing replays with N-1 rows. A `minItems` set to the explored count fails `fewer_records_than_required` on a
  step that is not in the span, so it blocks;
- the People pill reloads as "People (27)" (`manager-page.ts:135`). Whether a recorded "People (28)" press resolves
  then rests on `identity/stable-name.ts`. That is not verified.

Both can be corrected by the model and are absent from playback, which is reset. Watch the first run's dry-run lines;
no fix is specced.

## Answers to the brief's questions

- **The loop and the dry run.**
  - A correct span (row press through confirm) dry-runs clean. Both steps are conditional (`routing.ts:128`).
  - A confirm declared `delete` is verified, never run (`verify-only.ts:85-89`), so the dry run does no lasting act.
  - A row press declared `[]` is replayed for real with no `item` (the dry run is linear), so it may open the dialog
    on whichever row sits at the recorded list position. That is harmless while the confirm is verify-only.
- **Row wiring.**
  - F4 hands `item` to both span steps.
  - F5 scopes only the row press. The confirm has no `record` or `listPosition` (`identity/context.ts:226-233`), so it
    is untouched.
  - F9 gives a post-loop step no row.
  - Only B1 breaks this.
- **F20 (ignored press) inside the loop.** The row press shows no request, no change in its section (the dialog is
  outside the `section` card) and no focus move. So F20 considers a second press. It does not make one: the open scrim
  makes the button non-actionable (`content/actions/click.ts:155-157`). The confirm sends a request and is not pressed
  twice. No cause here, only an 800 ms wait per pass.
- **Permission across many Withdraws.**
  - A grant adds the request's `missing` classes to the build's permitted set (`action-permissions/gate.ts:207`).
  - Every later `delete` action is permitted unasked (`gate.ts:314-315`). That holds for exploration presses, the
    completion's plan-step checks (same gate, `flow-bootstrap/action-permissions.ts:210-219`) and the dry run, whose
    checks declare `[]` (`domain/.../node-run/verify.ts:97`).
  - Nothing is refused and nothing is asked again.
  - The grant clears `latest` (`gate.ts:208`), so the proposal carries no request, and
    `assertAutomationStudioBootstrapPermissionRequestAnswered` passes (`flow-bootstrap/adaptation.ts:355`).
- **The lane's apply check with N presses.** It accepts them. It checks only that one ask on the Flow's thread was
  granted at the point on a named control (`lane.ts:398-401`). A saved Flow replays with no gate, by design
  (`adaptation.ts:345-346`), so twelve presses are judged only by the goal.
  - One caveat: the request names the control only when "Withdraw" appeared in evidence the model was shown
    (`gate.ts:367-373`). Otherwise L1 denies the ask as unnamed, and P1 remembers that decline for that name and kind.
    t223's page view must keep the button's name visible. It does today.
- **(3) Reset.** Yes.
  - `lane.ts:318-319` calls `resetScenarioLab` (`flow-lane/reset-scenario-lab.ts:13-19`), which POSTs
    `/__control/reset` (`apps/scenario-lab/src/server.ts:110-112`). `ScenarioStateStore.reset()` re-creates every
    scenario's state (`state-store.ts:20-23`, `createNetworkState`: nothing withdrawn, no consent, prompt not
    dismissed).
  - This happens after the build and before `prepareFlowPage("playback")`, so exploration's and the dry run's
    withdrawals never reach the judged playback.
  - The same reset brings back the app prompt, the conversation and the cookie banner, so playback meets them again.
    Run 3's playback got past them.

## (c) Causes that belong to other lanes

- **t174:** `flow-bootstrap/instructed-acts/check.ts` is the file B2 and R2 change; the fix log records t174's claim on
  it. Hand both fix specs over, or get t174's release before a t195 worker edits it.
- **t223:** what the model sees.
  - R3: the kind of a row, and the headline column.
  - B1's prerequisite: the age column is offered with a usable key.
  - The control name "Withdraw" stays in evidence, which the permission caveat above depends on.
- **t196:** the dry run replays on live state with a navigate-only reset (R4), and the replays restart from the first
  step (top cause 1).
- **Lane B** (`recovery/runtime-exploration.ts`, `recovery/plan.ts:97`): run 3's repair could only re-point a click, and
  a structural span error needs a re-author. Out of scope here; named only.
- **t195, open, not specced here:** top cause 9. Exploration may withdraw a fresh row before the filter. It is not
  judged, because of the reset, but it is a real act on the person's account.
- **t191:** panel and overlay during the ask (run 10 UI review).

## What changed and why

Nothing in the product or in the shared documents. This report is the only file written in the repository. A scratch
test bundle was placed in the extension's ignored `.test-build-scratch/t195-w19c/` and removed afterwards. Scratch
sources live in the session scratchpad `w19c/`.

## Commands run and observed results

1. A scratch `record-shadow.test.ts` was bundled with esbuild (from `apps/extension`) and run with
   `node --test .test-build-scratch/t195-w19c/record-shadow.test.mjs`. It printed `not ok 1`, `error: with the age the
   extraction read from the shadow root`, `expected: true`, `actual: false`, `# pass 0`, `# fail 1`. The first
   assertion in the same test, without the age, passed. The directory was then removed.
2. `node --experimental-strip-types --no-warnings acts.mjs` (scratchpad), importing Core
   `instructed-acts/instruction-acts.ts`, printed
   `251 [{"id":"a1","kind":"submit","verb":"withdraw","quote":"withdraw every connection request I sent a month or more ago that is still waiting for an answer","plural":true}]`.
3. `node --experimental-strip-types --no-warnings span.mjs` (scratchpad), importing Core `instructed-acts/check.ts` and
   `flow-draft/routing.ts`, printed `claim row press ok=true`, `claim confirm ok=false ["act_needs_repeat"]` and
   `conditional (dry run exempt): [ 'd2' ]`.
4. The rest was reading: `git log -1` on both trees (`a15a465e`, `f3778a8e`), and `grep` and `sed` over the files cited.

## Not verified

- No live or Lab run, by order. B1's effect on a real page (a Chromium `ShadowRoot`) is inferred from the code and the
  stub test, not watched.
- Which branch the dry-run verify of a hidden dialog confirm takes, `present` or `failed hidden` (B2). It depends on
  how the resolver treats the hidden `[data-testid="withdraw-confirm"]`. Not run.
- Whether `identity/stable-name.ts` lets "People (28)" resolve as "People (27)" (R4).
- Whether F4 and F5 resolve the right row once B1 is fixed. That rests on w4's and w5's unit tests, which were not
  re-run here.
- That the app prompt and conversation, re-armed by the reset, never cover a row's Withdraw during the For Each. Run
  3's playback got past them, but only through pass 1.
- The R1 timings: 1.5 s plus 0.6 s, then 0.6 s per page, then the 10 s wait. Read from the code, not measured.

## Open questions or contradictions found

1. **The cross-check's premise is stale.** `action-permissions/cross-check.ts:20-33` still says "the instruction is the
   authority for permitting" and refuses nothing. Since F10, an instructed `delete` is not a permission, so an
   undeclared `delete` is a bypass of the ask. It is not a harmless difference. R2 is one answer; the supervisor may
   prefer the cross-check itself to refuse.
2. **An unfiltered fallback can feed a destructive loop.** A `where` that keeps nothing answers with every row it
   rejected (`content/actions/extract-list.ts` `readSummary`, "returned unfiltered"). A Flow whose For Each acts on that
   listing would withdraw all of them. Not a first-pass cause: the build would have seen it, and after the reset the
   same `where` keeps the same rows. It deserves a decision on whether a listing feeding a mutating loop may ever fall
   back unfiltered.
3. **B2's rule has a false positive.** It would refuse a "select every row, then press Delete selected" Flow when the
   per-row tick is the claimed step. Today's `act_needs_repeat` already refuses that pattern when the bulk press is
   claimed, so the product does not support it either way. Recorded as a known limit.

```text
Outcome: Done
Changed: docs/working/language-driven-flow-loop-plan/reports/t195-w19c-audit-withdraw-stale.md
Validation: scratch record-gate test -> "actual: false" (age from shadow root refused); Core check/routing probe -> "claim row press ok=true", "conditional: [ 'd2' ]"
Not verified: live/Lab behaviour; dry-run verify branch for a hidden confirm; stable-name on "People (27)"; F4/F5 tests not re-run
Report: C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQWebExtension/docs/working/language-driven-flow-loop-plan/reports/t195-w19c-audit-withdraw-stale.md
Notes: B1 (record.ts shadow blindness) fails every correct build at For Each pass 1; B2 (span ends before confirm) is unguarded.
Notes: Reset before playback: yes (lane.ts:318-319). After one grant every later delete is allowed; lane accepts N presses.
Notes: B2 and R2 edit check.ts, which t174 has claimed; coordinate before dispatch.
```
