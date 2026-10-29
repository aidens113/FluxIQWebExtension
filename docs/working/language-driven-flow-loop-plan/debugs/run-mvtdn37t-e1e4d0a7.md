# Debug: run-mvtdn37t-e1e4d0a7 (photo-social-newest-likes, round 6d, lane t567)

Status: FAILED, no Flow saved. Diagnosis only (brief D-r6d-4, 2026-10-29). No source edits, builds, browser runs or
paid runs. Code under test: downstream `89a9e2ed`, Core `7a822e42` (lane `fxwork/t567`, both checked with
`git rev-parse`).

Post names follow the previous two debugs (`run-mvskptb1-c9cef4fe.md`, `run-mvswfjbq-d0a95f6e.md`) and the fixture's
own codes (`breadth/newest-likes/expected.ts`):

- **A** `D1OKDvAEHfa` (2 Oct), **B** `DgYZxS8LJOe` (29 Sep, a reel), **C** `DPIEH3I491a` (26 Sep): the oracle's answer,
  newest first.
- **P1** `D96ahbWGjtY`, **P2** `DQwjFQMHFgA`, **P3** `DZcqnvywrLW`: the three pinned posts at the top of the grid.
- `DTCS5BsYbhG` (24 Sep) and `D1cOJBYCLJM` (22 Sep) are the fourth and fifth newest, older than C.

No page text, typed value or token is copied beyond control names, handles, like counts, dates and post codes.

## The run

- Built from the real extension chat (0001 `flow.createHere`) on instance rr6d-slot-4, $0.25 purse.
- **Calls and cost: 120 calls, $0.1142** (`snapshots/live-llm.json` `runSpend`; the Lab's figure). About $0.136 of the
  purse was left.

  | Role | Calls | Cost |
  | --- | --- | --- |
  | Supervisor decides (plan, dispatch ×2, complete, page search) | 5 | $0.0037 |
  | Judges (7 trials × 2 calls) | 14 | $0.0173 |
  | Builder (brief-1) | 56 | $0.0625 |
  | Repair (brief-2) | 44 | $0.0305 |
  | Chat | 1 | $0.0002 |

- **Time.** Build 10:10:45 to 10:28:40 (`logs/core.log`, `build end ms=1074786 status=draft`). Brief-1 ran 722 s,
  brief-2 338 s. Seven live trials took 55-101 s each, two recorded-run tests 38-40 s each.
- **Lab result.** `evaluation.json`: `verdict failed`, `failureCategory runtime.behavior`, `flowCreated false`,
  `oracleVerdict null`. First failure (events seq 77): "kept its assembled project candidate as a draft and built no
  Flow: the candidate's test run was judged no (`candidate.trial_judged_no`)". **The Lab's label is right**; no budget
  breach, no facility failure.

## Answer to the brief's questions, in short

1. **How far:** further than either earlier run. Exploration liked two pinned posts. There were 9 accepted revisions,
   7 live trials and 2 recorded-run tests, and **7 trials ran to their end and were judged, all no**. Three revisions
   (9, 13 and 24) read exactly A, B and C. **No trial ever pressed a Like**: the like step never ran on any pass of
   any trial. The supervisor ended `partial` with $0.136 left.
2. **Cause:** the first wrong step that decides the run is **0048**. The model put `only after: dock` on the like step
   and on its wait. Core's script format makes such a step run "only on the passes where that step was done", and
   the dock step was optional. The site remembers the dock collapsed after exploration (0043), so the dock step found
   nothing on every pass. Every like was therefore skipped by design, every trial showed `acts: []` and `proof:
   no_change`, and the judges correctly said no. Core accepted a requested act made conditional, a gap in r4b F4's
   rule (`instructed-acts/optional-act-steps.ts` checks `optional:` only). **Nothing told the builder or the person
   why**: the trial feedback lists only steps that ran, so the like is simply absent (section 2). The
   judges' false date-order claims and the listing's inability to sort the rows a repeat walks then kept the builder
   away from the correct reads. The recent fixes all fired as designed where they were reached. This is **the same
   class of failure for the third time, in a new shape**: a part's lasting act does not happen on a pass, and Core
   neither prevents that structurally nor says which step failed to act and why.
3. **Fix:** four required generic changes (section 3). Fixes 1-2 would have let revision 9 like A, B and C.
4. **UI:** the chat showed the dock step "Skipped: not there, optional" on every pass and nothing at all for the like.
   The ending says the judged run "ran all 25 of its steps", which is false for the one step that mattered. It also
   names the leftover as "clicked 'Like'" without the posts (P1 and P3, both pinned and not asked for) (section 4).

## 1. How far it got

| Phase | Steps | What happened |
| --- | --- | --- |
| Plan | 0003-0008 | One subflow `like_recent_posts` with p1 (like the three newest, reels included, `modify_existing`, effect "adds 3") and p2 (records, column `link`, newest first). `notAsked` covers other likes, look-alike accounts, follows, saves and messages. Correct. |
| Exploration | 0009-0045 | Declined cookies (`t310`), dismissed notifications (`t333`), opened the profile, Reels, then Posts. **0022-0025: opened tile `t432` ("Pinned post icon 2.9K47", P1) and liked it** (`t1300` Like to Unlike, `toggle {via name, gains [unlike], loses [like]}`). 0028-0033: read the grid (`extraction.2`, 24 rows). **0034-0039: opened P1, P2 and P3 by address as "the newest", "second-newest" and "third most recent".** The 0025 page lists all three as `link "Pinned post icon …"`. 0041: the press of P3's Like `t2021` was refused `target_covered`, with `layerControls: ["t2124 (a control with no words in the layer's header)"]`. **0042-0043: the model pressed `t2124` and the dock collapsed** (`layerCleared {layer: fl-dock}`, "Messages gone"). **0044-0045: liked P3** (Like to Unlike, 1,570 to 1,571). |
| Rev 1 refused | 0046-0047 | First script: the like and the wait carry `only after: close the messages dock if it covers the post`. Refused `flow_script.only_after_misplaced`: "… which labels no step. Write `only after: <label>` with the label of the optional step written directly before it." |
| Rev 2 | 0048-0054 | **0048: the dock step labelled `dock`, the like and the wait `only after: dock`.** Accepted (0049). Live trial 0051: pass 1 clicked `t432` (P1). The dock step said "Its control was not on the page, so the step was skipped" with `interruptions: [{kind: dialog, wayOut: t1017}]`, meaning the run closed the post dialog step 10 had just opened. **The like and the wait do not appear.** Pass 2 failed on `t432`, `targetOtherRecord: true`, "Testing this revision unchanged would meet the same other row's control …" (t792 fired). `execution_failed`. Offline 0053: `refused (no_live_source)`. |
| Rev 3 | 0055-0061 | Opens each row by `http://127.0.0.1:58614$row.link`. Live 0058: step 10 `web.action.invalid_parameter` ("url … is relative and there is no web page to resolve it against"); the field already held the whole address. |
| Rev 5 | 0062-0072 | 0063 `unchanged_submission`. Rev 5 opens `$row.link` (correct). **Live 0067: the run ended; on all 3 passes the dock step was skipped and the like never ran.** It stored 24 rows. Judges 0071/0072, both no: the first 3 rows are the pinned posts, 24 links stored, "siteChange shows no change … `result.change_not_seen` for p1". Correct. |
| Revs 6-8 | 0073-0086 | 0074, 0076: `record_output.process_order_in_repeat` (limit in `recordOutput.process`); 0078 `repeat_refused`. Rev 8 sets `maxItems 3` on the grid read. Recorded-run test 0082 judged no (0085/0086): the first 3 are pinned. Correct verdict, but both judges also wrote that the Flow "liked those two pinned posts". That was the exploration likes, which `startedWith` listed. |
| Rev 9 | 0087-0103 | Reads the **home feed** (`extraction.3`, fields `link`, `author`, `when`), `where author equals harbourlight.studio`, `maxItems 3` (0096). **Live 0098: read kept 8 of 20 and cut to A, B, C, exactly the oracle's rows. The like never ran on any pass.** Judge 0102: "Record set holds 3 links: D1OKDvAEHfa, DgYZxS8LJOe, DPIEH3I491a … the read s6 already limits to 3 newest … acts list is empty, so no like is proven", `act_missing` at `…like_recent_posts.s11`. **Judge 0103: "the kept order is feed order, not newest-first: D1OKDvAEHfa (1d) is kept while DTCS5BsYbhG (1w, Sep 24) and D1cOJBYCLJM (1w, Sep 22) were cut"**. That is false: 1d is newer than 1w. Both no. |
| Revs 10-13 | 0104-0117 | 0105 `process_order_in_repeat` (the model wrote `extractList.sort` on the listing; the web listing hands rows on in page order, t751). 0107 `unchanged_after_no`. 0109 `kept_condition_dropped` (it dropped the author condition). Rev 13 (0111) is rev 9 with the like target changed from `t2021` to `t99`, "pressing the post's own Like control"; **`only after: dock` stayed.** Recorded-run test 0113 judged no. **Judges 0116 and 0117 both said C (26 Sep) should give way to `DTCS5BsYbhG` (24 Sep)**, and 0117 says the reel B (4d) "is older than both". Both false. |
| Revs 14-19 | 0118-0138 | Five refusals (`unchanged_after_no` ×3, `kept_condition_dropped`, `process_order_in_repeat`) and one `repeat_refused`. Rev 19 (0131) reads the grid with `attribute aria-label is absent` to skip pins, which also dropped every reel and carousel: kept 14, cut to A, C, `D1cOJBYCLJM`. Live 0133 judged no (0137/0138). Correct. |
| Brief-1 end | 0139-0150 | `process_order_in_repeat`, `unchanged_after_no` ×2, then `repeat_refused` ×3. Brief-1 returned `partial`, stopped for repeating. |
| Repair dispatch | 0151-0152 | Supervisor sent one repair brief from the closest failing trial. The brief's plan (0154 request) shows the like step `s11` with `ensureState {via name, gains [unlike], loses [like]}`, which is correct, and the script with `only after: dock`. |
| Repair rev 20 | 0153-0202 | Re-explored the grid and post pages. Rev 20 (0195): grid read, `maxItems 3`, like target `t3509`, still `only after: dock`. Live 0197: first 3 = P1, P2, P3, like never ran. Judged no (0201/0202). Correct. |
| Repair rev 24 | 0203-0243 | Rev 24 (0236): grid read with field `date` (the image's alt text) and `where date atLeast "2026-09-26" as date`, `maxItems 3`. That is **a cutoff copied from C's own date** (t790's date bound, used to fit this run's answer). Live 0238: kept exactly A, B, C, but the like never ran. Judge 0242: "kept exactly the three newest … But siteChange's proof for the likes is no_change". Judge 0243: the cutoff "is not what the request asks" (right), adding false reasons about a "Sep 24 post and the Sep 6 reel". Both no. |
| Repair end and build end | 0244-0252 | `unchanged_after_no`, then three `repeat_refused` (a retest of rev 24, a resubmit, a retest). Supervisor `complete {ended: partial}`: "… Some likes may already have been placed on the account, and I could not confirm which posts they were …". |

**Resets and undos.** Every reset step is `site_check admit`; every trial started `not_reset` with `startedWith`
act-7 and act-8, the exploration likes. No undo was asked for and none ran. No trial pressed anything lasting
(`leftOnSite` is only act-7 and act-8 in every live trial). **The account ends with P1 and P3 liked**, two pinned posts
the task's "nothing else" forbids, and none of A, B and C liked (`56-failure-scenario.png`: B shows "Like", 1,105).

**No Flow saved because** a judged whole run needs two agreeing yeses (`result-verification/agreement/index.ts`
header), and no trial could get a yes while its like step never ran.

## 2. The cause

### The first wrong step (model, then product): 0048 made the like run only on passes where the optional dock step was done

1. **What Core's format says.** `flow-bootstrap/plan/flow-script-format.ts` line 431: "A step written directly after
   an optional step with `only after: <its label>` runs only on the passes where that step was done". It exists for
   a wait after a slow-down notice (line 433). The model's 0046 script used it as plain sequencing ("like the post,
   only after: close the messages dock"). Given the format text, that is a model misreading.
2. **Core's refusal pointed the wrong way.** 0047's `only_after_misplaced` (`script-statements/guarded-steps.ts`
   line 273) said only how to make the line valid: "Write `only after: <label>` with the label of the optional step".
   It did not say what the line does to a step that carries the part's act. The model followed it to the letter
   (0048).
3. **Core accepted a requested act made conditional (product gap).** r4b F4's rule, "A step that does one of the
   person's requested acts is never optional" (`flow-bootstrap/instructed-acts/optional-act-steps.ts`, header and
   `automationStudioInstructedActOptionalScriptIssues`), reads only `optional: yes`. A step behind `only after:` is
   exactly as conditional, since the guard routes past it on the optional step's `failed` port (`guarded-steps.ts`
   header), and it is never checked. The like step declared `consequences: modify_existing`, the part's own lasting act.
4. **The site made the guard false on every pass.** The dock remembers being collapsed (`client/overlay-script.ts`
   line 9: "collapses it once, which the account remembers"). Exploration collapsed it at 0043, and under the "reset as
   rarely as possible" rule it stayed collapsed. So in every trial (0051, 0067, 0098, 0133, 0197, 0238, and the
   recorded 0082 and 0113) the dock step answered "Its control was not on the page, so the step was skipped". **The
   like and its wait never ran on any of 21 passes.** This is correct behaviour for the fixture and for the rule.
5. **Nobody was told (product).** `service/candidate-trial/feedback.ts` `steps()` lists "each step that ran". A step
   the guard went past has no attempt, so it is not listed at all. Rev 9's step list goes straight from "close the
   messages dock … skipped" to the next "open the post". The r4b sentence "skipped and what it does was not done"
   (`skippedSaid`, line 453) is said only of a skipped step that itself does an act, here the dock, which does none.
   The judges were given `siteChange.acts: []`, `proof: no_change`, `steps: []` and no reason. Judge 0102 named the
   right step (`act_missing` at `s11`) but could only advise "make the like step s11 actually register". The builder
   read that as a wrong target and changed `t2021` to `t99` to `t3509` (revs 13 and 20), never the guard.

### Contributing (judges; product): false date-order claims on correct reads

- Revs 9, 13 and 24 kept exactly A, B and C. In revs 9 and 13 at least one judge, and in rev 13 both, said the rows
  were "not newest first". Each claimed an older post (24 Sep, 22 Sep) was newer than a kept one (1d, 4d, 26 Sep)
  (0103, 0116, 0117, 0243). Every claim is contradicted by the dates the judges were shown.
- Core's t511 check (`result-verification/value-readings/order-claim.ts`) contradicts an order claim only against a
  `sortRead`, and these reads had no sort. Revs 9 and 13 read a `when` datetime field and rev 24 a `date` field, but
  the record set shown to the judge carried only `link` (0103 request, `recordSets[0].columns: [link]`). Core had no
  value to check the claim against.
- These nos were right as verdicts (no like ran), so they did not decide this run. They cost the builder its correct
  read: after 0103 it spent 0104-0150 (about 25 calls) chasing an order that was already right. Had the like run,
  revision 9 would have met a split at best: judge 1 likely yes, judge 2 a false no that Core could not refute.

### Contributing (product, Core and domain): a listing cannot hand a repeat its rows in date order

- The script format tells the model to "put the order on the listing step too, `extractList.sort`" where its node can.
  The web listing hands its rows on in page order (`script-statements/listing-order-in-repeat.ts` header, t751), and
  each `extractList.sort` (0104, 0139, 0229) was refused under a sentence about `recordOutput.process`. The model had
  not written that key.
- "The three most recent" on a grid that puts pinned posts first therefore had no direct way to be said. The model
  tried the home feed (revs 9 and 13; right this time, but only because the feed happened to be newest first), an
  attribute filter that also dropped reels (rev 19), and a hard-coded date cutoff (rev 24).
- This is F7 in the framework plan ("the grammar cannot say dates, relations or marks") plus a missing Core sort of the
  rows a For Each walks.

### Contributing (model): mistakes that recurred

| Mistake | Where | Corrected? |
| --- | --- | --- |
| Pinned posts taken as "the newest", and liked while exploring | 0022-0025 (P1), 0034-0045 (P3) | No. Both likes stay on the account. |
| `only after:` used as sequencing on the act step | 0046, 0048, then every revision | No |
| "Make the like register" read as a wrong target | revs 13, 20 (`t99`, `t3509`) | No |
| `$row.link` prefixed with the origin | rev 3 | Rev 5 |
| A fixed tile handle in the repeat | rev 2 | Rev 3 (t792's other-row advice) |
| A date cutoff copied from the answer's own last row | rev 24 | No. Judge 0243 rejected it, rightly. |

### Contributing (product; cause not traced): the run closed a dialog the Flow had just opened

In trial 0051, pass 1, step 10 opened P1's post dialog by its tile. Step 11, the optional dock step, reported
`interruptions [{kind: dialog, wayOut: t1017}]`, "A dialog was over the page, and the run closed it": `t1017` is that
post dialog's own Close. Harmless here, because the like was guarded off anyway and rev 3 moved to opening by address.
But closing what the previous step opened is wrong. The code path (interference clearing before an absent optional
target) is not traced.

### Recent fixes: fired, not reached, or defeated

| Mechanism | In this run |
| --- | --- |
| t787 covered-layer controls | **Fired as intended.** 0041 named `t2124 (a control with no words in the layer's header)` as the layer's own control, and the model pressed it at 0042. This is the first of the three runs where the dock was collapsed in exploration. |
| t787 layer handler from a cleared layer | **Recorded, then deferred by design.** 0043 carries `layerCleared {layer: fl-dock}`. The plan already had the model's own step pressing `t2124`, so Core left it to the model (`layer-handlers/explored.ts` line 25: "A press a step of the plan already makes is the model's own answer and is left to it"). No handler appears in any plan. That model step is the one that guarded the like. |
| t787 / t792 toggles and `ensureState` | **Fired correctly.** One exploration press per control, so no conflicting signatures. The like step `s11` carries `ensureState {gains [unlike], loses [like]}` (0154 request). Never exercised, because the step never ran. |
| t792 earliest press, identity ties | Not reached in a way that matters: no control was pressed twice. |
| t792 other-row outcome | **Fired as intended** (0051: `targetOtherRecord: true`, "Testing this revision unchanged would meet the same other row's control"). The model moved to row links in the next revision. |
| t791 creation witnessed / unwitnessed trial runs unproven | **Not reached.** The part is `modify_existing`, not a creation, and no act ran. The only witness (`w1`) sat on P3's page from exploration, with `steps: []`. Whether a per-pass witness would have replaced it had the like run is not verified. |
| t790 date bound | **Fired**: rev 24 used `atLeast … as date`, but to copy the answer's own cutoff. t790's confirming ask was not reached, since no call said yes. |
| t786 stale-target re-acquire | Not visible in this run. |

**Same cause recurring?** Yes, in the class, not the line of code. In all three runs the part's one lasting act did not
land on the passes that needed it. mvskptb1: a remembered dock covered it in playback. mvswfjbq: an inverted toggle
skipped it, and fixed-row and covered-layer controls then broke it. This run: an optional dismiss step guarded it off.
Each time Core saw the result only indirectly (a judge, `no_change`), and handed the model text rather than owning
the mechanism. Each fix closed one way of not acting, and the next run found another.

### Not a task, fixture or Lab defect

- The task is achievable and unambiguous. The grid marks pins ("Pinned post icon"), and each post and image carries
  its date. The remembered dock is a designed obstacle that t787's handler is meant to own.
- The Lab reported `runtime.behavior` and `flow_not_built`, which is what happened.

## 3. The fix (generic: nothing names likes, posts, docks or this site)

**1. A step that does a requested act never runs only after an optional step (required; Core).**

- `flow-bootstrap/instructed-acts/optional-act-steps.ts`: extend r4b F4 from `optional: yes` to `only after:`. A
  written step that does one of the instruction's requested acts, or declares a lasting consequence one of its parts'
  `lastingActs` asks for, and carries `only after: <label>` is refused at that line. Wording, Core's own: "This step
  does what the request asks, and `only after:` makes it run only on passes where `<label>` was done; on a pass where
  `<label>` finds nothing to press it is passed over and the act is not done. Take `only after:` out so it runs on
  every pass."
- `script-statements/guarded-steps.ts` (line 273): when the step a misplaced `only after:` sits on does an act, the
  refusal states what the line means, not only how to label it.
- **Judgement call:** matching by declared consequence against the part's `lastingActs` is more robust than the
  word-reading the optional rule uses, which a "Like" control passes only through Core's vocabulary. Prefer both.
- **Tests (fail first):** `instructed-acts/tests/optional-act-steps.test.ts`, "a requested-act step behind `only after:`
  an optional dismiss is refused at its `only after:` line". `script-statements/tests/guarded-steps.test.ts`, "a
  misplaced `only after:` on an act step says what it does".

**2. A step a guard went past is said, per pass, and an act not done is a Core fact (required; Core).**

- `service/candidate-trial/feedback.ts` `steps()`: from the graph, list each guarded step a pass went past, with
  "Not run on pass N: it runs only after `<label>`, which was skipped" and, for a step with a lasting consequence, "so
  what it does was not done". `executor/step-skip/act-not-done.ts` gives the run the same sentence.
- `result-verification/site-change/` proofs: a part whose acting steps never ran on any pass gets proof `not_run`,
  naming those steps and why, instead of `no_change` with `steps: []`. The judge and the builder then read "the like
  step never ran", not "the like did not register".
- **Tests:** `service/candidate-trial/tests/feedback.test.ts`, "a guarded act step passed over on every pass is listed
  as not run, with its act not done". `result-verification/site-change/tests/`, "a part whose act step never ran is
  `not_run`, naming the step".
- With fixes 1-2, revision 9 (0096) would have had its guard refused at submission, or would have been told "not run"
  after its first trial, and A, B and C would have been liked.

**3. A judge's order claim is checked against the rows' own date values (required; Core; P5).**

- `result-verification/value-readings/order-claim.ts`: beside `sortRead`, use any date-typed field the read stored
  (`read-date.ts` already reads absolute and relative forms). Where the kept rows are in descending order of it and
  every cut row is older, a reading that says "not newest first", or names a cut row as newer, is contradicted (t511's
  label and re-ask).
- **Unverified premise:** whether fields left out of `recordOutput.columns` are stored and reachable at judging. If
  they are not, they must be (as `process.columns` already allows: stored, not shown).
- **Test:** `value-readings/tests/order-claim.test.ts`, "a no calling date-ordered kept rows not newest-first is
  contradicted by their own date values".

**4. Core orders the rows a repeat walks (required for this task class; Core; P7; judgement call on the shape).**

- The For Each is Core's. When the listing node answers `page_order`, an `extractList.sort` (or a span-level `repeat
  order:`) is applied by Core to the rows the For Each receives, and the limit after it. That replaces the t751
  refusal. Then "the N most recent" is a sort plus `repeat most: N`, with no feed tricks, attribute filters or
  copied cutoffs.
- Until then, the t751 refusal sentence must not speak of `recordOutput.process` when the model wrote `extractList.sort`
  (it already computes `writtenPath`; the `MESSAGE` constant is shared).
- **Test:** `script-statements/tests/listing-order-in-repeat.test.ts`, "a sort on a page-order listing feeding a lasting
  repeat is applied by Core before the loop".

**5. The ending names what the build left and what never ran (required; Core; repeats fix 5 of the previous debug).**

- The ending's "ran all 25 of its steps" counts attempts, merges included. It must say which steps never ran ("its
  step 'like the post' never ran").
- The leftover list names the item for each act: act-8's `where` is P3's address. act-7 has no `where` in
  `leftFromEarlier` (0102 request), which should be found and filled. The supervisor should not be left to write "I
  could not confirm which posts they were".

**6. Do not close a dialog the Flow itself just opened (contributing; Core or domain; trace first).** Trial 0051 step
11 shows it. The t661 opener rule already knows which step opened a layer, so the clearing should honour it.

**Would these have saved a correct Flow within the purse?** Likely, not certain. With fixes 1-2, revision 9 (at $0.06
of spend) likes A, B and C. Then judge 2's false order claim must be refuted (fix 3), or a split leaves it unsure.
Excluding pins without a sort (fix 4) is still the model's own work.

## The structural answer: what stops this class

The deciding object in all three runs is the same: **each pass of the span that carries a part's lasting act must
actually perform that act on that pass's own item, and Core must know whether it did and why not.** Core has every
piece of this, spread over several mechanisms: guards, `ensureState`, the other-row veto, layer handlers, witnesses
and `siteChange` proofs. Today each piece is either written by the model or reported to it as text. The change is to
make it one Core-owned obligation, a **per-pass act ledger**:

- **At authoring,** a requested act's step is unconditional on its span: never `optional:`, never `only after:`, and
  never behind an optional step's success port (fix 1).
- **At trial,** for each pass Core records the act step's outcome: ran, not run (guarded or unreached), skipped
  (absent, already in state), refused (other row, covered), and what the pass's own witness saw. That ledger is the
  first thing the feedback and the judge see (fix 2).
- **At verdict,** a pass whose act did not run is a Core no without a judge call, with the step and reason named (P5's
  "a computed fail is a Core no").
- **Interruptions stay Core's:** a dismiss for a layer Core recorded as cleared is Core's handler, never a model step
  the act can depend on.

**Where the framework-heavy-lifting plan already says this, and where it does not:**

- **P6** owns the interruption half. Responsibility map rows 22-23 give handlers and `optional:` on dismiss steps to
  Core, from obstructions (CC7). Its pass witnesses (`trial-change/pass-witnesses.ts`, "one witness per pass") and
  `ensureState` from trial presses are the toggle half. **But P6 as written keeps this run's exact shape**: "there is no
  handler for a layer whose control the Flow itself presses". It needs one amendment: a model step that presses a
  recorded layer's dismiss is lowered into Core's layer handler (or refused, pointing at the handler). Either way no
  step can depend on it through `only after:`.
- **P5** owns the verdict half ("typed effect proofs", "every repeat pass passed", "a computed fail is a Core no",
  "sort order from `sortReading`"). **But "every repeat pass passed" would have counted this run's passes as passed**:
  every attempted step succeeded. P5's computed facts need "each pass ran the step carrying the part's act", and the
  order fact needs to read date fields, not only `sortReading` (fix 3).
- **P4** (undo and reset) is not the cause here. Its closed leftover ending would name P1 and P3 (fix 5).
- **P7** (dates, marks) and a Core-side sort before a For Each (fix 4) remove the read workarounds.
- **Not in the plan:** fixes 1 and 2, the authoring rule and the per-pass "not run" account. They are the smallest
  units that would have saved this run, and they belong ahead of P6 and P5, in Lane E
  (`instructed-acts/`, `script-statements/`) and Lane C (`service/candidate-trial/feedback.ts`, `site-change/`).

## 4. UI review

56 moments in `run-mvtdn37t-e1e4d0a7.ui-review.local/`.

- **Silent skip (moment 28, `28-mid-build-panel.png`, trial of rev 9):** "Open page · open the post — Done", "Click ·
  close the messages dock if it covers the post — Skipped: not there, optional", then the next "Open page · open the
  post". There is no card for the like on any pass. The overlay said "Testing your Flow on the site, Step 8 of 10".
  The person could only notice the like by its absence.
- **Refusals (moment 30):** "Change the Flow — Not done: it was the same Flow the check had already found doesn't do
  what was asked …" and "Saving one part of the Flow — The AI model sent a version … but it was refused". These are
  honest, and they repeat many times between 0104 and 0150.
- **Ending (`56-failure-panel.png`):**
  - "FluxIQ stopped with the Flow only partly built. I could not finish liking the three most recent posts …" True.
  - "The judged test run of the whole Flow from its start ran all 25 of its steps, counting each pass of a repeat and
    stored 3 rows, and was judged not to do what was asked. It was tried 9 times." **Misleading**: the like step never
    ran on any pass. "25 steps" counts what ran, merges included.
  - "These changes the build made are still on the site: clicked 'Like'." True, but it does not say which posts: two
    pinned posts the task said not to like. The supervisor's own reason, "Some likes may already have been placed on
    the account, and I could not confirm which posts they were", is in the build record. Core holds act-8's address.
  - "It also clicked 'Reels' and 'Posts'; and ran the step 'open the post', which changed the page and might have left
    something behind." Tab clicks and opening a post are not lasting. This buries the real leftovers, as in the
    previous run.
  - "I kept what I wrote as a draft, and nothing was put into the Flow." True.
- **Page (`56-failure-scenario.png`):** post B open, its Like showing "Like" (1,105, unliked), the dock collapsed
  ("Messages ^"), the overlay "Build failed — Build stopped: only a draft was kept" bottom left, 16 of 16 samples
  visible.

## Rerun notes

- Each run starts from a reset site and a fresh workspace. The dock starts expanded, and the build's first collapse
  makes it stay collapsed for every later trial.
- Without fix 1, any Flow that writes its act step `only after:` a dismiss the site remembers will never act in a
  trial.
- Without fix 3, a correct newest-first read can still be failed by a judge misreading relative dates.

## Not verified

- **That revision 9 with the guard removed would have passed.** Judge 0103's false order no would likely still have
  split the verdict.
- **Whether a per-pass witness would have replaced `w1`** (P3's page, `steps: []`) had the like run.
- **Whether fields outside `recordOutput.columns` (`when`, `date`) are stored** and reachable for fix 3.
- **The code path that closed the post dialog** in trial 0051 step 11.
- **Why act-7 has no `where`** in `leftFromEarlier`.
- **Whether t786's re-acquire ran**; nothing in the run files shows it.

## Evidence

- Steps (`test-runs/instances/rr6d-slot-4/run-mvtdn37t-e1e4d0a7/steps`):
  - 0003-0008: plan and dispatch;
  - 0022-0025: P1 liked; 0034-0039: P1-P3 opened as "newest"; 0041-0045: covered refusal, dock collapsed (`layerCleared`), P3 liked;
  - 0046-0048: `only after:` written, refused for the label, relabelled;
  - live trials 0051, 0058, 0067, 0098, 0133, 0197, 0238; recorded-run tests 0082, 0113; offline checks 0053, 0060, 0069, 0084, 0100, 0115, 0135, 0199, 0240;
  - judges 0071/0072, 0085/0086, 0102/0103, 0116/0117, 0137/0138, 0201/0202, 0242/0243;
  - refusals: 0047 (`only_after_misplaced`), 0074, 0076, 0105, 0121, 0140, 0230 (`process_order_in_repeat`), 0109, 0125, 0234 (`kept_condition_dropped`);
  - 0154 request: the repair plan with `ensureState` on `s11`; 0252: the `partial` ending.
- Run files: `evaluation.json`, `summary.json` (`firstFailure` seq 77), `snapshots/live-llm.json` (`runSpend`), `logs/core.log`.
- Code (Core `packages/fluxiq/src/programs/automation-studio/runtime/`):
  - `flow-bootstrap/plan/flow-script-format.ts` (lines 431, 433), `flow-bootstrap/script-statements/guarded-steps.ts` (header, line 273);
  - `flow-bootstrap/instructed-acts/optional-act-steps.ts`, `executor/step-skip/act-not-done.ts`, `executor/step-skip/optional-step.ts`;
  - `service/candidate-trial/feedback.ts` (`steps()`, `skippedSaid` lines 449-456);
  - `flow-bootstrap/layer-handlers/explored.ts` (line 25), `flow-bootstrap/explored-interruptions.ts`;
  - `flow-bootstrap/script-statements/listing-order-in-repeat.ts` (t741, t751);
  - `result-verification/agreement/index.ts` (two yeses, t511), `result-verification/value-readings/order-claim.ts`.
- Code (downstream): `apps/scenario-lab/src/scenarios/photo-social/client/overlay-script.ts` (the remembered collapse),
  `breadth/newest-likes/expected.ts`.
- Plan: `C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/framework-heavy-lifting-plan.md` (Current State, F1, F4, F5,
  F7, responsibility rows 22-26, P4-P6).
- Launcher log: `lab-runs/2026-10-29/round6d-slot4.log` (live-guard record, $0.1142).
