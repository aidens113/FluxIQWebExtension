# Debug: run-mvswfjbq-d0a95f6e (photo-social-newest-likes, round 6 rerun 2, lane t567)

Status: FAILED, no Flow saved. Diagnosis only (brief D-r6c-4, 2026-10-28). No source edits, builds, browser runs or
paid runs. Code under test: downstream `85f7d050`, Core `4e2e411c` (lane `fxwork/t567`, both checked).

The posts are named by the fixture's own codes, as `breadth/newest-likes/expected.ts` and the previous debug name them:

- **A** `D1OKDvAEHfa`, **B** `DgYZxS8LJOe` (a reel) and **C** `DPIEH3I491a` are the oracle's answer, newest first.
- **P1** `D96ahbWGjtY`, **P2** `DQwjFQMHFgA`, **P3** `DZcqnvywrLW` are the three pinned posts at the top of the grid.

No page text, typed value or token is copied beyond control names, like counts and post codes.

## The run

- Built from the real extension chat (0001 `flow.createHere`) on instance rr6c-slot-4, $0.25 purse.
- **Calls and cost: 69 calls, $0.0947** (`snapshots/live-llm.json` `runSpend`). The purse was not the limit; about
  $0.155 was left.

  | Role | Calls | Cost |
  | --- | --- | --- |
  | Supervisor | 4 | $0.0068 |
  | Builder (brief-1) | 33 | $0.0409 |
  | Repair (brief-2) | 31 | $0.0466 |
  | Chat | 1 | $0.0003 |
  | Judges | 0 | $0 (no trial ran to its end) |

- **Time.** Build 02:08:55 to 02:22:28 (`logs/core.log`, `build end ms=812233 status=draft`). Six live trials took
  45-112 s each.
- **Lab result.** `evaluation.json`: `verdict failed`, `failureCategory runtime.behavior`, `flowCreated false`,
  `oracleVerdict null`. First failure (events seq 60): "kept its assembled project candidate as a draft and built no
  Flow … `candidate.execution_incomplete`". `productFailure: flow_lane.flow_not_built`. **The Lab's label is right this
  time**; no budget breach, no facility failure, every step `meta.json` is `status: ok`.

## Answer to the brief's questions, in short

1. **How far:** exploration, 5 submissions accepted (subflow revisions 1, 2, 4, 5 and 6), 2 refused for a wrong
   parameter, 3 refused as unchanged and 6 refused as repeats; 6 live trials and 5 offline checks, all
   `execution_failed`, refused or inconclusive. No trial ever ran
   to its end, so no judge was ever called. The repair builder was stopped for repeating an unchanged script, and the
   supervisor ended the build `blocked` with $0.155 left.
2. **Cause:** the first wrong step is **0046**: while exploring, the model pressed B's Like control a second time while
   it showed "Unlike", un-liking the post it had just liked. Core's toggle rule then took that reversal as the asked
   state (`toggle-idempotent.ts`, "the newest such press decides"), so revision 1's like step carried an **inverted
   `ensureState`** and its trial skipped the like as "already in the asked state" (0061). From there four more model and
   product defects each cost trials: a fixed tile handle in the loop with Core telling the model "the step itself is
   right, test again" (0091, 0110, 0115), pinned posts never excluded, and finally the messages dock covering the Like on
   post pages (0130), whose collapse control the model never found. **None of t786/t787's mechanisms caused it.** Two
   were never reached; the trial-learned toggle did not take effect (section 2).
3. **Fix:** six generic changes (section 3). Fixes 1-4 are required.
4. **UI:** the chat told the person a like was "Not pressed: it already showed the asked state" on an unliked post, and
   the ending does not say which post the build left liked (a pinned post, against `notAsked`) (section 4).

## 1. How far it got

| Phase | Steps | What happened |
| --- | --- | --- |
| Plan | 0003-0006 | One subflow `like_recent_posts` with p1 (like the three newest, `modify_existing`, "adds 3") and p2 (records, column `link`). `notAsked` lists other likes, saves, follows and messages. Correct. |
| Exploration | 0007-0057 | Declined cookies (0009, t310) and dismissed notifications (0011, t325). Opened the profile, then the **Reels tab** (0015) and took B, the newest reel, as "the newest post" (0016). **0026: liked B** (`t1012` Like to Unlike, 1,105 to 1,106; `toggle {via name, gains [unlike], loses [like]}`). Re-opened B from the grid (0035), read `t1012` as "Unlike" twice (0037 describe, 0041 find). **0046: pressed `t1012` again, "I'll open the newest … post and like it"; 0047 shows Like, 1,105, `toggle {gains [like], loses [unlike]}`. B was un-liked.** The messages dock (`t909`/`t565`, "layer covers N") was on screen all run and was never collapsed. 0055/0057: two repeated calls refused `repeat_refused`. |
| Rev 1 | 0058-0064 | Opens the posts with the **fixed tile `t424` (P1, pinned)** in a loop, likes `t1012`, waits for the text "Unlike". Core gave the like step `ensureState {gains [like], loses [unlike]}` (0079, the plan handed to the repair). Offline: `refused:no_live_source` (0063). **Live (0061): pass 1 opened P1, whose Like showed "Like" (2,987); step 11 was skipped, "Its control already showed the asked state, so it was not pressed"**; the wait for "Unlike" timed out after 4 attempts; `execution_failed`. |
| Revs 2-3 | 0065-0076 | 0066 `candidate.unchanged_submission` (the model's summary said "open each post by its own link"; the script was unchanged). 0068, 0070: `evidence_completion_parameters_unresolved` (`web.handle.not_a_handle:selector` on a `wait_for_selector` given a `target`). 0072-0076: the same script three times, `repeat_refused`. Brief-1 returned `partial`, `stoppedRepeating`, $0.0409, 33 calls. |
| Repair dispatch | 0077-0078 | Supervisor sent one repair brief from trial 0061. |
| Repair rev 2 (subflow revision 2) | 0079-0094 | Like on `t1813` (P1's own Like, read after trial 1), close the dialog. **Live (0091): pass 1 liked P1 (Like to Unlike, 2,988; `leftOnSite act-16`)**; pass 2 step 15 "open the post" failed `web.target.not_found` ("refused a in another record"); Core: "**The step itself is right.** Nothing in your script needs to change for this: test this same revision again". Offline: inconclusive, 16 of 29 operations matched (0093). |
| Repair rev 4 | 0095-0117 | 0100 unchanged (summary again said "by its own row link"). Rev 4 still opens `t424`, returns to the profile by address. **Live (0110): pass 1 pressed P1's Like while it showed "Unlike" (back to Like, 2,987; `act-19`)**; pass 2 the same not-found, the same advice. **0114: the model obeyed and re-tested unchanged. Live (0115): P1 pressed again, Like to Unlike (2,988; `act-21`)**; same failure; Core now closed the revision to re-testing. Offline 0112: 18 of 39. |
| Repair rev 5 | 0118-0124 | Opens each row by `$row.item_url` (correct), likes `t1813`. Live (0121): step 11 `web.target.not_found` (the saved control had a dialog context; a post opened by address has none). Offline 0123: 14 of 39. |
| Repair rev 6 | 0125-0133 | 0126 opened P1 by address: its Like `t2076` shows "Unlike" and is `covered-by t1505` (the dock). Rev 6 likes `t2076`, waits for "Unlike". **Live (0130): step 11 `web.target.not_actionable`, "the point 886,361 landed on a … part of fl-dock … whose controls are \"Lena Moss…\", \"Saltmarsh Goods…\", \"Kofi Ade…\""**, 4 attempts, `retryable: false`. Offline 0132: 16 of 31. |
| Repair ending | 0134-0155 | Described the dock (0135), searched "fl-dock", "Close", "Dismiss" (0137-0143); `find_on_page` pointed at the icon-only control: "Some controls here show no words, only an icon: t1509". The model never described or pressed `t1509`. 0146-0154: "a revised subflow that closes that dock" four times, each the unchanged rev 6 script; `unchanged_submission`, then three `repeat_refused`. Brief-2 returned `partial`, `stoppedRepeating`, $0.0466, 31 calls. |
| Build ending | 0156 | Supervisor `complete {ended: blocked}`: "… so nothing was liked and no table of links was produced. Nothing was changed on the account." **False**: P1 is left liked (`leftOnSite act-21` at 0130; 0126 and 0130 show P1 "Unlike", 2,988). The dispatcher had said the stopped brief "may be sent once more unchanged". |

**Resets and undos.** All 12 reset steps are `site_check admit`; no undo was requested and none ran (`start: not_reset`
in every trial). P1 went Like, Unlike (0091), Like (0110), Unlike (0115). B went Like, Unlike inside exploration (0026,
0046). The account ends with **P1, a pinned post, liked**, which the task's "do not like … anything else" forbids.

**No Flow saved because** no revision ever ran to its end (Core promotes only on a judged whole run), and the build
ended blocked.

## 2. The cause

### The first wrong step (model, then product): 0046 reversed the build's own like, and Core took the reversal as the asked state

1. **The model's choice.** At 0045 the page showed `t1012 button "Unlike"` and "1,106 likes"; the model had read
   "Unlike" itself at 0037 and 0041. Its 0046 summary says "like it". Pressing a control that already shows the state
   the part asks for is a plain model error, given what it was shown.
2. **Nothing stopped it.** The exploration press ran as an ordinary `modify_existing` press. Core already knew `t1012`
   was a toggle this build had flipped (0027 answered `toggle`), but an exploration press is never held to its own
   earlier toggle.
3. **Core inverted the step (product).** `flow-bootstrap/script-statements/toggle-idempotent.ts`,
   `automationStudioFlowPlanToggleSteps`, line 90: `[...input.explored].reverse().find(…)`, "The newest such press
   decides". Both presses of `t1012` are in `explored-toggles.ts`; the newest is 0046's reversal. Revision 1's like got
   `ensureState {via name, gains [like], loses [unlike]}` (0079 `yourSubflow` plan, node `s10`).
4. **The trial did the opposite of the part (0061).** P1's Like showed "Like"; the client found it already "in the asked
   state" and pressed nothing (`runtime_action_summaries`, `skipped already_in_state`). The wait for "Unlike" then timed
   out. The model and the chat were told the like was already done.

Revision 1 would have failed anyway on pass 2 (fixed tile, below), so this was not the last cause, but it is the first,
and it would recur on any build that re-presses its own toggle once while exploring.

### Contributing (product, Core): "the step itself is right, test again" for a fixed row inside a repeat

- Revs 1-4 opened every pass with `t424`, P1's tile. On pass 2 the extension's record veto refused it: "No target
  resolved … (refused a in another record)" (`apps/extension/src/content/identity/veto.ts` line 312). The veto was right.
- Core's near-miss rule (`service/candidate-trial/target-on-page.ts`, t420) saw a well-scored candidate and told the
  model "The step itself is right. Nothing in your script needs to change for this: test this same revision again"
  (0091, 0110, 0115). It does not know the candidate was refused for being another row's.
- Cost: trial 0115 was a pure retest on that advice (0114), and 0110 repeated 0091's failure. Each trial pressed P1
  again.

### Contributing (product, Core; cause not verified): the trial-learned toggle (t787) did not reach revisions 2 and 4

- The client did report the trial press as a toggle: gateway trace `trace.32f8f9d5…` seq 107 (trial 0091),
  `"toggle":{"via":"name","gains":["unlike"],"loses":["like"]}`.
- Yet revision 4's like pressed P1 both ways: 0110 from "Unlike" to "Like", 0115 from "Like" to "Unlike". No
  `ensureState` of either signature allows both, so **revision 4's like step carried none**.
- t787's path is `service/subflow-trial/run.ts:231` (`ports.exploredToggles?.trial(frames.attempts)`) into
  `explored-toggles.ts` `trial()`, then `toggle-idempotent.ts` matching `trialNodes` that end in
  `.like_recent_posts.s10`. The node keys match (`s10` in both revisions), the shared record is wired
  (`service.ts:1584`, `brief-ports.ts:266`), and the dispatcher lifts `toggle` to the top of the dispatch payload
  (`domain/src/io/gateway-output-dispatcher.ts:80`). **Where the record is lost is not verified**: the persisted
  attempts (`runtime_action_summaries`, event chunks) do not keep `outputs`, and revisions 2-6's plans are not in the
  run files.

### Contributing (model): mistakes that recurred

| Mistake | Where | Corrected? |
| --- | --- | --- |
| The newest reel (Reels tab) taken for the newest post; the pinned posts never excluded | 0016, then every revision (`limit 3` over a grid that starts with P1-P3) | No. No trial reached a judge, so the judge's advice that fixed this in the previous run never came. |
| A fixed tile handle inside the repeat | Revs 1-4 | Rev 5 (`$row.item_url`) |
| A summary that says the script changed when it did not | 0065, 0099, 0146, 0150, 0152, 0154 | No; ended both briefs by the repeat guard |
| A wait for the text "Unlike" | Revs 1, 6 | Not reached in rev 6 |
| Looking for the dock's control by words ("Close", "Dismiss", the tag `fl-dock`) instead of the icon control `t1509` that Core pointed at | 0137-0143 | No |

### Contributing (product, domain and Core): the covered-target feedback names the wrong controls

- 0130: "a layer over the page whose controls are \"Lena Moss…\", \"Saltmarsh Goods…\", \"Kofi Ade…\"". Those are
  message threads; pressing one opens a conversation, which `notAsked` forbids. The layer's own collapse control (an
  icon button in its header, `t1509` on the page the model then read) is not named, and no handle is given.
- The dock blocked only on post pages opened by address (rev 5-6), where the action bar sits under it (x 867-1247). In
  the post dialog (revs 1-4) it did not cover the Like, so exploration never had to collapse it.

### Contributing (model, supervisor): ending with money left

The dispatcher's `next` at 0078 said a `stoppedRepeating` brief "may be sent once more unchanged". At 0156 the
supervisor ended with $0.155 of $0.25 unspent. A reasonable call after two stalled builders; a judgement call, not a
defect.

### t786 and t787: caused, exposed, or not reached

| Mechanism | In this run |
| --- | --- |
| Layer handlers from a cleared layer (t787) | **Not reached.** No exploration press cleared a layer that a later step met; the dock was never collapsed. |
| In-run handler `fact` from `op`, `recovery.fact_kind_unread` (t787) | **Not reached.** No playback and no in-run repair. |
| Toggle signatures learned from trial presses (t787) | **Did not take effect** for revisions 2 and 4 (above); cause not verified. Not a cause of this run's failure, but P1 was flipped three times, the exact harm it exists to stop. |
| `ensureState` reaching subflows (t787) | Worked for revision 1, with the inverted signature from t775's newest-press rule. |
| One witness per pass, `contradicted` (t787) | **Not reached.** No trial ran to its end; 0 judge calls. |
| Stale-target re-acquire (t786) | Not a cause. The record veto refused another row's tile on every attempt, which is correct. Whether re-acquire ran is not logged. |

**The decisive defects predate t786/t787:** the exploration double press (model) with t775's newest-press rule, and
t420's retest advice.

### Not a task, fixture or Lab defect

- The task is achievable and unambiguous: the grid marks pinned posts ("Pinned post icon", coverage 0.42-0.5 in
  extractions 3-5) and the post images carry their dates. The honest workflow (`breadth/newest-likes/workflow.ts`)
  collapses the dock first (`collapseDockSteps`) and skips the pins.
- The dock is a designed obstacle (`client/overlay-script.ts`, collapse button `part="collapse-button"`).
- The Lab reported `runtime.behavior` and `flow_not_built`, which is what happened.

## 3. The fix (generic: nothing names likes, posts, docks or this site)

**1. A build's own toggle is never reversed by accident, and never taught backwards (required; Core).**

- `flow-bootstrap/action-permissions.ts` (exploration gate): an exploration press on a control this build already
  flipped (a record in `explored-toggles.ts` tied by handle or resolved target) runs with `ensureState` = that record's
  signature, so a second press of the asked state presses nothing and answers `already_in_state`. A call that means to
  undo says so through the undo path the reset rules already have.
- `script-statements/toggle-idempotent.ts`: when the presses tied to one step carry different signatures, the newest is
  a reversal and names the build's before-state, never the asked state. The step takes the signature of the earliest
  tied press, the one that moved the control away from where the site was before the build.
- **Judgement call:** an item already in the asked state before the build, whose first press flipped it the wrong way,
  would still be taught wrong. The domain could report, with each press, whether it returned the control to the state
  it had before this build first pressed it. The rule above is the narrow one.
- **Tests (fail first):** `script-statements/tests/toggle-idempotent.test.ts`, "two tied presses with opposite
  signatures give the step the first one's"; `flow-bootstrap/tests/action-permissions.test.ts`, "a second exploration
  press on a control this build flipped is run with its ensureState".

**2. A trial's toggle reaches the next revision (required; Core; first find where it is lost).**

- Reproduce with the real payload shape: a project-build test (`service/project-build/tests/`) whose subflow trial
  attempt carries `outputs.result` exactly as `domain/src/runtime/adapter.ts` builds it (the dispatcher payload with
  `toggle: {signature}` at its top), then a repair brief's submission of the same step. Assert the step carries
  `ensureState`.
- Today's tests (`project-build-shared-toggles.test.ts`, `trial-toggles.test.ts`) put `toggle` in hand-built outputs.
  The gap is between them and this run.
- Also persist each recorded toggle (node, `trialNodes`, signature) in the build record, so a debug can see it.

**3. A refused other-row target is never "the step itself is right" (required; extension, domain, Core).**

- The extension's veto already knows why (`refusedBecause: "other-record"`). Carry that closed word in the resolution
  summary the domain returns (`outputs.result.result.resolution`).
- `service/candidate-trial/target-on-page.ts`: on `other-record` the step is not a near miss and is never told to
  re-test. It says that a step inside a repeat names one row's control, and that each pass needs its own row's: from
  the row's value, or a control inside what the pass opened.
- **Test:** `candidate-trial/tests/target-on-page.test.ts`, "a well-scored candidate refused in another record is not
  `targetOnPage`".
- Would have saved 0110 and 0115 and pointed the model at `$row.item_url` two revisions earlier.

**4. A covered target names the covering layer's own controls (required; domain, Core).**

- `domain/src/runtime/llm-evidence/` (the `covered_by_layer` report) and the trial feedback for `web.target.not_actionable`:
  name the layer's handle and its own controls with handles, icon-only ones included (as "a control with no words in
  the layer's header"), listed before links inside it. Never list content links as "its controls".
- Then the model can press the collapse control while exploring, and t787's explored-interruption record turns it into
  a handler of the Flow mechanically, as designed.
- **Judgement call:** letting the client's interference clearing press a layer's only icon control by itself is
  riskier (it could be "expand" or "send"). Naming it is preferred.
- **Test:** a domain test where a fixed layer with a header icon button and three links covers a target; the report
  names the icon button and its handle first.

**5. The ending never says nothing changed when the build left an act in place (required; Core).**

- `project-agents` completion: a `blocked` or failed ending with acts in place (`lastingActsInPlace > 0`,
  `leftOnSite`) cannot claim "nothing was changed"; Core replaces that sentence with its own leftover list.
- The leftover list names the item (the page or row the act landed on, as the ledger's `pages` map holds it), not "ran
  the step like the post". Presses with no lasting consequence (tabs, open and close) are not listed as possible
  changes.
- The undo-or-tell question for acts `notAsked` covers is the user's (previous debug, fix 6).

**6. Supervisor guidance on a stopped brief (optional; Core; judgement call).** When money is left and a return is
`stoppedRepeating`, the supervisor's `next` could put the resend first and ending second. Not required; the current
words allow either.

**Would these have saved a correct Flow within the purse?** Likely, not certain.

- Fix 1 makes trial 1 like rather than skip. Fix 3 moves the model to row links by revision 2.
- Fix 4 lets the model collapse the dock while exploring; t787 then adds the handler.
- A trial that runs to its end then reaches the judge, which in the previous run named the pinned posts and led to the
  correct read. That run needed $0.05 of build; this one had $0.155 left.
- Excluding the pins is the model's own work, and no fix here teaches it.

## 4. UI review

43 moments in `run-mvswfjbq-d0a95f6e.ui-review.local/`.

- **Wrong (moment 11, `11-mid-build-panel.png`):** "Click · like the post — Not pressed: it already showed the asked
  state". P1 was not liked; the inverted `ensureState` made the chat say the opposite of what was on the page.
- **Misleading (moment 30, `30-mid-build-panel.png`):** "Testing one part of the Flow — The AI model expected this
  version to do what was asked, but the test showed it doesn't yet", shown as the next test starts. It is the previous
  test's verdict on a card for the new one, and the test is the whole Flow, not one part.
- **Ending (`43-failure-panel.png`):**
  - "FluxIQ could not finish the Flow. … never got working: two attempts to build it both stalled without ever
    completing a successful run…". The supervisor's false "Nothing was changed on the account" was cut at the "…", so
    the person did not see it; it stays in the build record.
  - "The judged test run of the whole Flow from its start ran 10 of its 11 steps … It was tried 6 times." True.
  - "These changes the build made are still on the site: ran the step \"like the post\"." True but does not say which
    post: a pinned post the task said not to like.
  - "It also clicked \"Reels\" and \"Posts\"; and ran the steps \"open the post\" and \"close the post\", which changed
    the page and might have left something behind." Tab clicks and opening a post are not lasting; the list buries the
    one real leftover.
  - "I kept what I wrote as a draft, and nothing was put into the Flow." True.
- **Page (`43-failure-scenario.png`):** P1 opened by address, the expanded Messages dock over the action bar, the
  overlay "Build failed — Build stopped: only a draft was kept" bottom-left, 16 of 16 samples visible.
- **Mid-build (`42-mid-build-panel.png`):** "Change the Flow — Working on it" for a submission that was the unchanged
  script and was refused. The card does not say it was refused as unchanged.

## Rerun notes

- Each run starts from a reset site and a fresh workspace.
- Without fix 1, any exploration that presses its own toggle twice teaches the step backwards.
- Without fix 4, any Flow that opens posts by address meets the dock with no named way to close it.

## Not verified

- **Where t787's trial toggle record is lost** for revisions 2 and 4 (section 2). Inferred from P1 pressed both ways
  with the client's toggle report present.
- **The plans of revisions 2-6.** Only revision 1's resolved plan is in the run files (0079).
- **Whether t786's re-acquire ran** on the not-found attempts; the veto message is all that is logged.
- **That the fixes would pass this task.** Inferred from the previous run's path through the judge; not run.
- **Where else the supervisor's "Nothing was changed on the account" is shown** (only the chat was reviewed).

## Evidence

- Steps (`test-runs/instances/rr6c-slot-4/run-mvswfjbq-d0a95f6e/steps`):
  - 0003-0006: plan and dispatch;
  - 0016-0027: B taken from Reels and liked; 0035-0047: B read as Unlike, then un-liked;
  - 0058, 0088, 0107, 0118, 0127: revisions; 0066, 0100, 0147: `unchanged_submission`; 0068, 0070: parameter refusals;
  - 0061, 0091, 0110, 0115, 0121, 0130: live trials; 0063, 0093, 0112, 0123, 0132: offline checks;
  - 0079: revision 1's plan with the inverted `ensureState`;
  - 0126: P1's Like covered by the dock; 0134-0155: the dock search and the repeats; 0156: the blocked ending.
- Run files: `summary.json`, `evaluation.json`, `events.ndjson` seq 60, `snapshots/live-llm.json` (`runSpend`),
  `logs/core.log`.
- Workspace `claude-photo-likes-t567-20261028-r9`, project `c30c68e1…`, `project.sqlite` (read-only):
  - `runtime_action_summaries` node `like_recent_posts.s10`: P1's before and after states per trial;
  - `client_gateway_trace_events` `trace.32f8f9d5…` seq 107: the client's `toggle` on trial 0091's press;
  - `conversation_turns`: the four chat turns.
- Code (Core `packages/fluxiq/src/programs/automation-studio/runtime/`):
  - `flow-bootstrap/script-statements/toggle-idempotent.ts` (line 90), `flow-bootstrap/explored-toggles.ts`,
    `flow-bootstrap/explored-interruptions.ts`, `flow-bootstrap/candidate/submission.ts` (line 232);
  - `service/subflow-trial/run.ts` (line 231), `service/project-build/brief-ports.ts` (line 266), `service.ts` (line 1584);
  - `service/candidate-trial/target-on-page.ts`, `executor/node-execution/already-in-state.ts`.
- Code (downstream):
  - `domain/src/io/gateway-output-dispatcher.ts` (lines 70-99), `domain/src/runtime/adapter.ts`,
    `domain/src/actions/toggle-signature/shown.ts`;
  - `apps/extension/src/content/actions/click.ts` (`withToggle`), `apps/extension/src/content/identity/veto.ts`;
  - `apps/scenario-lab/src/scenarios/photo-social/client/post-script.ts`, `client/overlay-script.ts`,
    `breadth/newest-likes/workflow.ts`.
- Launcher log: `lab-runs/2026-10-28/round6c-slot4.log`.
