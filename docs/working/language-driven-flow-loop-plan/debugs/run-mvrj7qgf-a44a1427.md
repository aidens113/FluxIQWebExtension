# Debug: run-mvrj7qgf-a44a1427 (photo-social-newest-likes, rerun round 6)

Status: FAILED. Diagnosis only (brief debug-r6-slot4, 2026-10-27). No source edits, builds, browser or paid runs.
Posts are named by their place in the profile grid read (0075): cells 1-3 are the pinned posts, and the task's answer
is cells 4-6 (cell 5 is a reel). "Reel 3" is the third tile of the profile's Reels tab, which is row 18 of the grid
read and is not part of the answer. No page text, typed value or token is copied.

## The run

- Task `photo-social-newest-likes`. It was built from the real extension chat (0001 `flow.createHere`), on instance
  rr6-slot-4, in lane tree `fxwork/t567` (downstream `55fe5c0e`, Core `4ae8444f`), with a $0.25 purse.
- 98 provider calls (`evaluation.json`), $0.148 spent, 213 step folders. The build ran from 03:12:58 to 03:23:09.
  The purse was not the limit, with about $0.10 left.
  - Brief 1: $0.105 over 64 calls. It hit `llm_evidence_loop.iteration_limit` (64 iterations).
  - Brief 2: $0.025 over 20 calls.
  - Brief 3: $0.010 over 7 calls.
- Ended with no Flow. `evaluation.json` says `verdict: failed`, `runtime.behavior`, `flowCreated: false`, and no oracle
  verdict. The supervisor ended `ended: partial` (0213).
- Environment: every `meta.json` is `status: ok` and there is no provider error. `logs/core.log` ends with the build
  trace. **The environment is not the cause.**

## 1. The sequence

**Furthest point: the one whole-run test (0092, revision 2), which failed at its step 12 before any judge was asked.**
Forward progress stopped at **0103**. There, the undo of that test's like landed, but Core kept the act open. Every
test after that was refused before it ran.

| Phase | Steps | What happened |
| --- | --- | --- |
| Plan | 0003-0004 | One subflow `like_posts` carrying p1 (like the three newest, `modify_existing`) and p2 (a records answer with column `link`). `notAsked` lists likes, saves, follows and messages. Correct. |
| Dispatch | 0005-0006 | Brief 1 (build). |
| Brief 1: exploration | 0007-0075 | Declined cookies and dismissed the notifications prompt (0009, 0011). Opened the profile, then the reels tab (0013, 0015). Opened the newest reel (cell 5, 0019) and closed it without liking (0021). **Opened cell 1, the pinned giveaway post, and liked it as "the newest" (0033-0035, act-10).** Its tile's control was named "Pinned post icon …", and its page shows a date a week back. Opened the newest reel twice more and closed it without liking (0039, 0041). The third re-open was refused as a repeat (0043, 0045, 0055). **Liked reel 3 instead (0061-0063, act-16).** Read the grid (0071-0075, `extraction.3`, 24 rows, page order). That read offered a pinned-marker field (coverage 0.5), which the builder did not use. |
| Revision 1 | 0076-0077 | It opens each post with a fixed tile handle (`t424`, cell 1) inside the repeat, likes with `t1558`, then waits for the text "Unlike". It was never tested. |
| Reset 1 | 0078-0088 | Test refused `candidate.trial_reset_required` for act-10 and act-16 (0079). The builder pressed each control back. Core answered `settled` for act-10 (0084) and for act-16 (0088). **Correct.** |
| Revision 2 + whole-run test | 0089-0094 | Revision 2 opens each row's link by address and likes with `t2121` (reel 3's Like handle), then waits for "Unlike". The pre-test site checks admitted it (0093 builder, 0094 supervisor `core.test_candidate`). **The test (0092) was the build's judged whole run** (`wholeTest`, `trial.06e9fe6b…`). Pass 1 opened cell 1 (pinned) and liked it (**act-17**). Step 12, the wait for the text "Unlike", timed out after 4 attempts: `execution_failed`, `candidate.execution_incomplete`. The button's state is in its accessible name, not in the page text. Core's advice said so (drop the wait). **No judge was called.** |
| Revision 3 | 0095-0096 | Drops the wait. It is otherwise the same as revision 2. |
| Reset 2: the livelock | 0097-0146 | Test refused for act-17 (0098), which was right at that point. At 0103 the builder pressed act-17's control back; the click landed, and the control went from `Unlike` to `Like`. **Core answered `open` with "still shows the state this act set: press that same control back".** The second press was refused `candidate.undo_already_back` (0105): "already shows the state this build found". Fresh looks naming act-17 (0107, 0123, 0130, 0134, 0146) all answered `open` with the same words. The test was refused another 7 times (0109-0139). Repeats were refused (0115, 0128, 0132, 0144). Brief 1 ran out of iterations. |
| Re-dispatch | 0147-0148 | The supervisor sent repair brief 2 from the failing receipt, aimed at "the wait". |
| Brief 2 (repair) | 0149-0193 | It re-read the grid (0153) and submitted (0157, 0175, plus three refused as `unchanged_submission`). It never addressed ordering. Every test was refused for act-17 (0161, 0172, 0177, 0190). The undo was refused `undo_already_back` (0164, 0180). The look it was told to make was refused as a repeat (0182, 0186, 0188, 0193). It was stopped `stoppedRepeating`. |
| Ending | 0194-0213 | The supervisor's `ended: partial` was refused with `project.completion_reset_first` (0195). Reset brief 3 (0197): `undo_already_back` again (0202). Its read of the control showed `Like` and still answered `open` (0204). Three completions were refused with `project.reset_acts_in_place` (0206, 0210, 0212), and it ended blocked. The supervisor then ended `partial` (0213) with "that like is still on the account". **That is false**: 0204 and the final screenshot show cell 1 unliked. |

**Assembly:** none. This was a single-subflow plan, so the builder's `core.test_subflow` was the judged whole run
(0092 `wholeTest.said`).

**Judge verdicts:** none in the whole run. All 213 folders are supervisor, builder or repair roles. There is no
judge request and no judge code in any result.

## 2. Why the whole-run test was "judged unknown"

**No judge ever saw it, so "judged unknown" is the Lab's label, not a verdict.**

- The only whole run, `trial.06e9fe6b…`, failed during execution: `execution_failed`, `candidate.execution_incomplete`
  at step 12 (0092), so no judge was called. Every later test was refused before it ran.
- The Lab built its failure sentence (events seq 46, `lab.candidate_not_promoted`, `verdict: "unknown"`, `codes: []`)
  in `packages/test-runner/src/flow-lane/creation/candidate-outcome.ts`:
  - `chatDraftVerdict` matches the chat's closing words against Core's verdict templates for each verdict;
  - "I kept what I wrote as a draft, and nothing was put into the Flow" matches none of them, so it returns
    `unknown`;
  - `createdFlowCandidateDraftFailure` then words that as "the candidate's test run was judged unknown".
- Its own `trials` entry says `execution: failed`, `code: candidate.execution_incomplete`.
- **None of the gates named in the brief produced it:**
  - t766's act grounding and t752's grounded judging never ran, because no judge was called;
  - t757 and t764's requested-output gate never fired: no requested-output or `process_order_in_repeat` code appears
    in any result;
  - t751's reset admission and settlement did not produce the label either, but **t751 is what prevented any later
    judged run** (section 4).
- Lab wording defect (minor): a run that was never judged should say "never judged: its only whole run stopped at step
  12", not "judged unknown".

## 3. Each reset refusal, and whether it was right

| Step | What the build tried | Core's answer | Right? |
| --- | --- | --- | --- |
| 0079 | Test revision 1 | `trial_reset_required`: act-10 (cell 1 like), act-16 (reel 3 like) | Yes. Both likes were on the site. |
| 0083-0088 | Press each back, under `undoes` | Landed, then `settled` act-10 (0084) and act-16 (0088) | Yes. t751's toggle settlement worked for explored acts. |
| 0093/0094 | Pre-test site checks for revision 2 | Admitted | Yes. |
| 0098 | Test revision 3 | `trial_reset_required`: act-17 | Yes. The test's like was on cell 1. |
| 0103 | Press act-17's control back | **Landed, but `open`**: "still shows the state this act set" | **No.** The control now read `Like`. |
| 0105, 0164, 0180, 0202 | Press it again | `candidate.undo_already_back` | Right about the site, but it contradicts the settlement. |
| 0107, 0123, 0130, 0134, 0146, 0166, 0204 | Fresh looks naming act-17 | `open`, with the same "press back" words | **No.** The 0107, 0134, 0146, 0166 and 0204 looks read cell 1's page showing `Like`. The 0123 and 0130 snapshots were on the home page and could not have settled anything. |
| 0109-0139 (7×), 0161, 0172, 0177, 0190 | Test again | `trial_reset_required` for act-17 | **No.** Nothing of the build was on the site. |
| 0195 | Supervisor ends | `project.completion_reset_first` | The rule is right, but its premise (act-17 in place) is false. |
| 0206, 0210, 0212 | The reset brief completes | `project.reset_acts_in_place` | **No**, same premise. The words offer `cannotUndo`, but `cannotUndo` "never settles a reversible act", so the reset brief had no way out. |
| 0043/0045/0055, 0115, 0128, 0132, 0144, 0182-0193, 0208 | Repeated calls | `repeat_refused` | Mostly right. 0182-0193 refused the very look that `undo_already_back` asks for, but that look could not have settled the act anyway. |

## 4. Root causes

### Decisive (product, Core reset settlement, cross-repository contract): a looped pass's original is filed under the wrong place, so a restored like can never settle

t751's final-acceptance change (Core `76f0a59c`, "stamp each looped pass's own item") added a per-pass original in
`flow-bootstrap/site-reset/ledger.ts` `stamped`.

**What it does.** When a trial pass pressed a different item than the one the step's control receipt was read on, the
act's `controlOriginal` becomes:

- `place: stamped.place`, the **receipt's** place;
- `before: pass.before`, the counts at the **pass's own** place;
- `at`: the pass's location.

The code comment and its test (`site-reset/tests/trial-witness.test.ts`, "witnesses a looped pass that pressed another
item…") assume that "every item's control has the same place token". The test uses `pl:star` for both items.

**What the web domain gives.** A place token embeds the page address: `domain/src/runtime/llm-evidence/control-spot/place.ts`
`webControlPlace` hashes `resetResource \0 evidence.location \0 control \0 role \0 record`. So cell 1's Like and reel 3's
Like have different place tokens.

**The chain in this run.** Each step below is inferred from the code and fits every observed answer. No ledger trace
is logged.

1. Revision 2/3's like step targets `t2121`, reel 3's Like. Its plan stamp is reel 3's control receipt: 0090
   `changedPaths` shows `nodes.9.resetWitness.ref` changed when the target moved from cell 1's handle to reel 3's. Reel
   3 was read with `Like` (0061) before act-16, so the receipt is proven.
2. The whole run's acts go to the **supervisor's** ledger (`service/project-build/whole-trials.ts:80`; 0195 names
   act-17 with `"brief":"supervisor"`). That tracker never pressed cell 1, so `itemPressed` is false and the pass's
   diff is used. Its location (cell 1) differs from the receipt's (reel 3), so `otherItem` is true.
3. act-17's `controlOriginal` becomes {place: **reel 3's place**, before: **cell 1's counts** (one `Like`), at: cell
   1's address}. `act.spot.place` is overwritten with reel 3's place as well.
4. **Settlement** (`reset-settlement/judge.ts` `evaluate`, then `control-tracker.ts` `originalStanding`):
   - it finds the fresh read at cell 1's address and looks up reel 3's place in it, which is absent, so current = `{}`;
   - the act's toggle sits at cell 1's place, so `toggle.place !== original.place`, and the states compared fall back
     to every key;
   - `before.Like = 1` against `current.Like = 0` gives `open`, which `decision.ts` words as `toggle`: "press that same
     control back".
   - This holds **whatever the site shows**. Every settle string named cell 1's address, as `originalStanding` would.
5. **Admission** (`site-reset/undo-admission.ts`) reads the act's toggle from its own press (`judge.toggleOf`, falling
   back to `act.press`), at cell 1's real place:
   - the first press, with the control showing `Unlike`, was admitted `own` (0103);
   - every later press, with the control showing `Like`, gets `undo_already_back`.
6. **No exit.** The judge's `unmet` treats a `toggle` reason as meetable, so it is never closed as
   `gate_unsatisfiable`. Core's `lookFirst` only re-reads `look` reasons. Trials stay refused for the rest of the build
   (round 4's pattern (a): a Core answer that leaves no executable call).

**Why this is decisive.** Every step from 0103 to 0213 (110 step folders, across briefs 1, 2 and 3) was spent between those two answers. No
second judged run was possible, so the build could not finish even with a correct Flow.

### Contributing (product, Core): the ending tells the person a like is left that is not

- `standing()` in `site-reset/ledger.ts` keeps act-17 `in_place`. The supervisor's reason (0213) and the chat ending
  then say a liked post is still on the account.
- 0204 and the final screenshot (`33-failure-scenario.png`) show cell 1 unliked.
- act-10 and act-16 were settled correctly, so **the site was left as the build found it**. The person is told the
  opposite. This is round 4's wrong ending again (that note's contributor 4).

### Contributing (model): the Flow would still have liked the pinned posts

These would have been the next failure.

- **Pinned posts treated as newest.** Exploration took cell 1 for the newest post (0026, 0032-0035) although its
  tile's control name carried the pinned marker. The grid read offered that marker as a field (0071) and the builder
  ignored it.
- **No ordering in the Flow.** Revisions 2 and 3, and brief 2's revisions 3 and 6, read the grid in page order with no
  exclusion and `repeat most: 3`. Trial pass 1 went to cell 1 (0092 `pageAfterTrial`). With the reset working, the
  judged run would have liked cells 1-3, which a judge should answer no.
- **Rounds 1, 3, 4 and 5's ordering gap recurred.** It was hidden this time behind the reset livelock.
- **Other mistakes:**
  - revision 1 used a fixed tile handle inside a repeat, as round 2 did (it was never tested);
  - the wait for the text "Unlike" read a state that lives in the accessible name (0092). Core's advice was correct;
  - in exploration it opened and closed the newest reel three times without liking it. The repeat guard then refused
    the re-open, and the builder liked reel 3, which is not in the answer.

### Contributing (supervisor, minor)

- 0147 sent a repair aimed at "the wait". The return also listed two `trial_reset_required` answers in a row, which
  was the real blocker.
- No repair could pass while act-17 could not settle. Core never closed the act (`gate_unsatisfiable`), so nothing told
  the supervisor that no test could run.

### Not a task or fixture defect

- The audit row holds. The grid marks pinned tiles (the 0071 field, and the pin icons in the scenario screenshots),
  and each post shows its date. The expected answer (`breadth/newest-likes/expected.ts`) is cells 4-6, newest first.
- The only rewording ("reels included") came from the audit and was read correctly: the plan and the builder both
  went to the reels.

### Rounds 1-5: what recurred

- **Recurred:**
  - **Reset settlement livelock**, in a third shape: round 4 was a group witness that was `look` forever; round 5
    re-liked a post from a wrong start; round 6 is an original filed under the wrong place. Settlement has been
    decisive or contributing in rounds 2, 4, 5 and 6.
  - **Wrong ending** that names a leftover that is not there (round 4).
  - **Ordering gap**: the pinned posts taken as newest (rounds 1 and 3-5).
  - **Fixed tile handle** in a loop (round 2's model mistake), in revision 1 only.
- **Did not recur:**
  - round 5's decisive `process_order_in_repeat`: the model never wrote a limit or a sort;
  - round 5's re-like from a seeded start: t751 R1 held for act-10 and act-16, and the end state is clean;
  - round 2's withheld settle location: every settle string named a real address;
  - round 4's and round 5's dialog act with no place: act-17 had one.

## 5. UI review

Screenshots are in `test-runs/instances/rr6-slot-4/run-mvrj7qgf-a44a1427.ui-review.local/`: 33 moments, with the
overlay sampled about every 200 ms for about 3 s at each.

- **Start** (`01-start-panel.png`): "Loading the conversation…" with a composer. Round 5's model-key notice is gone.
  `02` shows the instruction bubble, "Starting…" and Stop. Fine.
- **Chat, mid-build:**
  - `22-mid-build-panel.png`: "Put back · Like — Not done: it was already tried exactly this way and did not work".
    That was a repeat refusal of an undo whose real answer was "already back", so the words misstate it. "Testing one
    part of the Flow — The test of this part didn't go through, so it showed nothing about this version" does not say
    why (a put-back was required).
  - `28-mid-build-panel.png`: "Put back · Like — Working on it", with the overlay showing "Putting the site back:
    clicking 'Like'" (moments 28 and 31). That press was refused unrun (0164, 0202). Nothing was clicked, so a refused
    call is shown as in progress.
  - Internal terms still show: "The AI model sent the same steps again, unchanged" (`28`), and "one part of the Flow"
    for the only part.
- **Ending** (`33-failure-panel.png`):
  - The supervisor's internal summary sits above the ending: "…could not undo the one like left on the target…".
  - "These changes the build made are still on the site: ran the step 'like the post'" is **false**; the like was
    undone at 0103.
  - "It also clicked 'Reels', which changed the page and might have left something behind" lists a navigation as a
    possible leftover.
  - "The one part tested on its own did not pass its own test… The judged test run of the whole Flow… ran 11 of its 12
    steps" describes one test twice, in build jargon. The overlay meanwhile counted "Step 9 of 9".
  - The composer is visible.
- **On-page overlay:**
  - It was present in 32 of 33 moments (absent only at start).
  - It flickered at moments 10, 22 and 27, and went missing across a page load at 7, 12, 14 and 23.
  - It jumps between four positions (y 16, 100, 184 and 620), within one window at moments 3, 7, 12 and 22.
  - At y 16 it covers the site's logo (`16-mid-build-scenario.png`, `33-failure-scenario.png`).
  - "Testing one part of the Flow" is shown for tests refused before they ran (moments 21-25).

## Recommended fix (generic; nothing names likes, posts, pins or this site)

**1. One place per act, read the same way by admission and settlement (required, Core; the structural fix for the
recurring settlement failures).**

- `site-reset/ledger.ts` `stamped`: for a pass on another item, build the original from that pass's own press. Its
  place is `act.spot.place` (the place its diff's `before` and `after` belong to), never `stamped.place`. Do not
  overwrite `act.spot.place` with the receipt's place.
- One function answers "is this act's own control back at its place?" for both `undo-admission.ts` (`already_back`)
  and `judge.ts` `evaluate` (`originalStanding` and `standing`). Then an admission that answers `already_back` and a
  settlement that answers "press it back" cannot both hold.
- Closure rule: an act whose own control a fresh read shows in its found state, but whose settlement stays open, is
  answered `gate_unsatisfiable` (closed, named to the supervisor). It is never left open as meetable.
- **Tests that fail first:**
  - Core `site-reset/tests/trial-witness.test.ts`: the existing per-pass case with **distinct place tokens per item**,
    as the domain gives them. Pressing back on the pass's item must reach `restored`; today it stays `in_place`.
  - A property test beside it: for any act, after a landed undo, a fresh read that admission calls `already_back` must
    make `standing` return `restored`.
  - Domain `runtime/llm-evidence/control-spot/tests/`: a contract test that two pages' same-role controls get
    different places. That pins the assumption Core must not make.

**2. A never-judged run is not "judged unknown" (Lab).** In `packages/test-runner/src/flow-lane/creation/candidate-outcome.ts`:

- when no trial reached a judge, report `not_judged` with the trial's own execution code;
- `chatDraftVerdict`'s `unknown` must not be worded as a verdict.

**3. The ending names only what a read shows (Core and extension).**

- Leftovers come from settlement after fix 1, never from a recorded press alone.
- Navigation clicks are not listed as possible leftovers.
- The supervisor's internal summary is not shown above the person-facing ending.

**4. Ordering (Core guidance, generic).** Round 5's fix 1 still stands: put the order or exclusion on the rows a
lasting repeat walks. This run did not reach it.

**5. UI (extension).**

- Show a refused call as refused ("not needed: already as it was"), never "Working on it" or "clicking".
- Keep the overlay in one corner, clear of the page's logo.
- Do not show "Testing" for a test refused before it ran.
- Use one step count in the overlay and the ending.

Not proposed: loosening `undo_already_back`, which was right about the site every time, or loosening the repeat guard.

## Rerun notes

- The site is clean: act-10, act-16 and act-17 are all undone (0084, 0088, 0103, final screenshot). A fresh workspace
  is still advisable.
- Rerun after fix 1. Without it, any loop that likes, stars or follows an item other than the one its step was
  recorded on reproduces this livelock on its first failed trial.

## Not verified

- No ledger trace is logged. These are inferred from the code and from the observed answers, not seen directly:
  - the step's witness was reel 3's control receipt (only the `changedPaths` entry for `resetWitness.ref` is visible);
  - `otherItem` was true;
  - act-17's `controlOriginal.place` was reel 3's place.
- That the domain gives cell 1's Like and reel 3's Like different place tokens is read from `place.ts`, not observed.
- The final site state comes from the 0204 read and the final screenshot. No oracle ran.

## Evidence

- Steps (`test-runs/instances/rr6-slot-4/run-mvrj7qgf-a44a1427/steps`):
  - 0003-0006: plan and dispatch;
  - 0033-0035 and 0061-0063: exploration likes act-10 and act-16;
  - 0071-0075: grid read;
  - 0076, 0089, 0095: revisions 1-3;
  - 0079: first reset refusal;
  - 0084 and 0088: settled;
  - 0090: `resetWitness.ref` changed;
  - 0092: the whole run (`execution_incomplete`, step 12, act-17 left);
  - 0098: act-17 to undo;
  - 0103: undo landed, still `open`;
  - 0105: `undo_already_back`;
  - 0107-0146: the livelock;
  - 0148 and 0197: brief returns;
  - 0164, 0180, 0202: `undo_already_back`;
  - 0195: `completion_reset_first`;
  - 0204: control reads `Like`, still `open`;
  - 0206-0212: `reset_acts_in_place`;
  - 0213: the ending.
- Events: `events.ndjson` seq 46 (`lab.candidate_not_promoted`, `verdict: unknown`, `codes: []`).
- Code (Core `packages/fluxiq/src/programs/automation-studio/runtime/`):
  - `flow-bootstrap/site-reset/ledger.ts` (`trialRan`, `stamped`, `standing`);
  - `flow-bootstrap/site-reset/undo-admission.ts` (`alreadyBack`);
  - `flow-bootstrap/reset-settlement/judge.ts` (`evaluate`, `toggleOf`, `unmet`);
  - `flow-bootstrap/reset-settlement/control-tracker.ts` (`originalStanding`, `latest`);
  - `flow-bootstrap/reset-settlement/decision.ts`;
  - `flow-bootstrap/site-reset/tests/trial-witness.test.ts` (the same-place fixture);
  - `service/project-build/whole-trials.ts:80`.
  - Core commit `76f0a59c` (t751).
- Code (downstream):
  - `domain/src/runtime/llm-evidence/control-spot/place.ts`;
  - `packages/test-runner/src/flow-lane/creation/candidate-outcome.ts`.
- Task: `apps/scenario-lab/src/scenarios/photo-social/live-tasks.ts` (`NEWEST_LIKES`);
  `breadth/newest-likes/expected.ts`; audit `docs/working/breadth-forty-tasks-plan/reports/audit-photo-social.md`.
