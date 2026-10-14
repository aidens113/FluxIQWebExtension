# A8 launch 8, social-network-feed (`run-mv8ic6mk-09bf12ff`): debug

Worker report for brief `a8-social-run-mv8ic6mk-debug`. Read-only: no source edited, no Lab run, no provider call.
Core read at `!FluxIQ` HEAD `3c176900`, which differs from the pair that ran (`9b4c5a38`) by one docs commit only
(`git log 9b4c5a38..HEAD` lists only `3c176900 docs: ledger t597`; `git status` clean), so every line cited below is
the code that ran. Row-level page data is not quoted: rows are described by count and kind, never by name.

## Outcome

Done. Three Core defects, not the plan, lost this build. **`read_accepted` was right every time.** Every trial of
it stored exactly the four rows the list showed as accepted, in list order, with the mutual-friend text copied
exactly, and every judge reply agreed on that. The build still failed for three reasons:

1. **A passing trial was thrown away because of how the builder wrote its completion.** Brief-3's trial answered
   yes (step 0090). The builder then completed four times with the right receipt plus `ended: "partial"`. Core sent
   any completion with an extra key to the ending check, refused it as `subflow.ending_shape` and showed only the
   honest-ending shape. It never told the builder to send the receipt alone. After four refusals in a row the
   repeat guard stopped the brief, and the dispatcher reported it `partial`, though a yes stood for its latest
   proposal. With this fixed, the build would have reached the whole test about 15 minutes earlier, the way launch 7
   did.
2. **A subflow trial's judging holds the subflow to its predecessor's reads, but takes away the words needed to
   answer for them.** By design, a trial of `read_accepted` runs `confirm_requests` inside the same run. The summary
   therefore carries `confirm_requests`' list read, including the rows its at-least-five condition left out. Core's
   exclusion-evidence check requires the judge to quote the request beside each of those rows. But the judge's
   request text is only `read_accepted`'s own part, so the words that state the bound are not in it. The judge
   could pass only by luck of phrasing. Result: `not_judged` three times, and it fed two more `unsure`s.
3. **t594's out-of-scope rule tells the judge to answer no to the predecessor's presses that Core itself put in
   the trial.** The rule says a trial step that does an out-of-scope part's lasting act means "answer no". The
   judges then said no over `confirm_requests`' Confirm presses inside the trial and advised "remove the
   confirm_requests call", which no builder can do. This produced two `unsure`s and the one judged `no`.

The guards and refusals each did what their code says. The three `amend_plan`s chased a wrong diagnosis that the
return reasons and a t582 warning invited.

## What changed and why

Nothing changed: the brief is read-only. Below are the timeline, the answers to the brief's six questions, root
causes with file and line, verdicts, and fixes.

### Timeline (UTC, 2026-10-14; $0.103 total, 152 model calls)

| Time | Steps | What happened |
| --- | --- | --- |
| 19:37:42 | 0001 | Chat: the instruction typed into the extension chat (confirm requests with at least five mutual friends and leave the rest; then a table of the requests now shown as accepted, in list order, columns name and mutualFriends, mutualFriends written exactly). |
| 19:37:52 | 0005-0006 | `write_plan`: p1 (lasting act modify_existing), p2 (read, no act); subflows `confirm_requests` and `read_accepted` (after `confirm_requests`, no inputs or outputs). Warning `project.plan_subflow_constraint` on `read_accepted`. |
| 19:37:53 | 0007-0008 | Dispatch brief-1 (`confirm_requests`) and brief-2 (`read_accepted`). |
| 19:38:52 | 0037-0040 | brief-1: rev 1 trial **yes** (2 judges yes). Done, $0.012. |
| 19:40:47 | 0041 | brief-2 entry: start hook ran, put back act-3..6, arrival loaded, `confirm_requests` ran once. The requests page shows 4 accepted rows and 4 pending (Confirm/Delete). |
| 19:41:00 | 0053-0057 | brief-2 rev 1 trial: **not_judged** (`core.result.exclusion_evidence_missing`). All 4 judge replies said yes. |
| 19:42:11 | 0061-0065 | Same revision retested: **unsure**. 3 yes, 1 no ("remove the confirm_requests call"). |
| 19:42-19:43 | 0066-0077 | Unchanged resubmits, `candidate.unchanged_submission`, `repeat_refused` ×4, one `ending_shape` refusal. brief-2 returned partial (`evidence_repeat_without_progress`). |
| 19:43:37 | 0078-0079 | Dispatch brief-3 (`read_accepted` again). |
| 19:44:43 | 0090-0094 | brief-3 rev 1 trial **yes** (4 judge replies yes). |
| 19:46:01-06 | 0095-0102 | brief-3 completes 4 times with `{subflowKey, revision, digest, ended: "partial", reason}`. Each is refused `subflow.ending_shape`. The brief stops; the return says **partial**. |
| 19:46:09 | 0103-0104 | Amend 1: adds output `accepted` to `read_accepted` and rewrites p1's facts. `confirm_requests` dropped ("its facts changed"). New warning `project.plan_value_unused`. |
| 19:46:11 | 0105-0106 | Dispatch brief-4 (`confirm_requests`) and brief-5 (`read_accepted`). |
| 19:48:14 | 0139 | brief-4 rev 3 trial **yes**. Done, $0.012. |
| 19:50-19:54 | 0144-0200 | brief-5: rev 1 **unsure** (judges no+yes, the no being out of scope); rev 2 **not_judged** twice and **unsure** once (retests 0 left). Mixed-shape completions refused `ending_shape` ×3: the third was a correct blocked diagnosis. Then `repeat_refused`. brief-5 partial, $0.026. |
| 19:54:47 | 0201-0204 | Amend 2: removes the output and adds "and leave every other request as it is" to p1's quote; `confirm_requests` dropped ("its parts changed"). Amend 3: same p1 again; `confirm_requests` dropped again (judged against brief-4's plan). |
| 19:54:52 | 0205-0206 | Repair brief for `read_accepted` alone: refused `project.predecessor_not_done`. |
| 19:54:54 | 0207-0208 | Dispatch brief-6 (`confirm_requests`) and brief-7 (`read_accepted`). |
| 19:57:04 | 0235 | brief-6 rev 3 trial **yes**. Done. |
| 19:59:07 | 0251-0253 | brief-7 rev 1 trial **no**. One judge said yes with `patchNeeded: true` and unquoted predecessor rows, which Core turned into a no. The other said no as out of scope. Then `candidate.unchanged_after_no` and `repeat_refused` ×4. brief-7 partial. |
| 20:00:29 | 0266-0267 | Supervisor ends partial: refused `project.completion_reset_first` (act-64..67 in place). |
| 20:00:31 | 0268-0270 | Reset brief-8: done, 0 acts left. |
| 20:00:39 | 0272 | Supervisor ends `partial`. The Lab records `failed: runtime.behavior` and `flowCreated: false`. |

### (1) What `read_accepted` is meant to read; what each builder tried; what repeated and why; the guard

- **Meant to:** read the friend-requests list after confirmation and keep the rows showing the accepted marker, in
  page order. Output: name and the mutual-friends text exactly as shown. The planned output was the run's dataset.
  Amend 1 added a named output `accepted`, and amend 2 removed it.
- **Correct answer on this page:** 4 rows (the 4 confirmed, i.e. every row whose count is at least five, including
  the row that states its count as "<name> and 4 other mutual friends"). The 4 pending rows are left out.
- **brief-2:** one extract with `where` on the status column `contains` the accepted marker. Rev 1 stored exactly
  the 4 rows. Trials: `not_judged`, then `unsure`. It then resubmitted rev 1 unchanged
  (`candidate.unchanged_submission`), and the repeat guard refused the same submit 4 times.
- **brief-3:** the same read with `contains "accepted"`. Trial **yes**. Lost at completion (root cause 1).
- **brief-5:** rev 1 used `where: status is present` with `output: accepted = $step.accepted.records`. Its trial
  was **unsure**. Rev 2 used `contains` the accepted marker. Its trials: `not_judged` ×2, then `unsure`, with
  retestsLeft at 0. After that, `test_subflow` and `submit` repeats were refused.
- **brief-7:** navigate to the page, an optional Close chat, then the read with `status is present`. Trial **no**.
  It resubmitted unchanged (`candidate.unchanged_after_no`), and the repeat guard refused it.
- **Why they repeated:** each builder had a correct subflow and nothing to change. Every non-yes verdict either
  named no defect in the subflow (`not_judged`) or named the predecessor call as the defect ("remove
  subflow-trial-root.call0"), which the builder cannot change. So the builders resubmitted or retested the same
  thing. The brief-5 builder said so in its own words at step 0182: the trial's own Confirm step creates the
  accepted rows, so the result is "the trial's own doing".
- **Guard verdict:** `llm_evidence_loop.repeat_refused` and `flow_bootstrap.evidence_repeat_without_progress` were
  **right as written**: identical calls on an unchanged page. In brief-5 they refused retests only after
  `retestsLeft` reached 0. The defects are upstream: the verdicts they repeated against, and in brief-3 the
  completion refusal they counted.

### (2) Entry each time (t593 phase start)

| Brief | Subflow | Hook | Put back | Arrival | Predecessors | Began on |
| --- | --- | --- | --- | --- | --- | --- |
| brief-1 | confirm_requests | ran | (none) | opening | none | site home |
| brief-2 | read_accepted | ran | act-3..6 | loaded | confirm_requests ran, prepared | requests page, 4 accepted / 4 pending |
| brief-3 | read_accepted | ran | act-15..18 | loaded | confirm_requests ran, prepared | same |
| brief-4 | confirm_requests | ran | act-23..26 | opening | none | site home |
| brief-5 | read_accepted | ran | act-30..33 | loaded | confirm_requests ran, prepared | same 4 / 4 |
| brief-6 | confirm_requests | ran | act-50..53 | opening | none | site home |
| brief-7 | read_accepted | ran | act-56..59 | loaded | confirm_requests ran, prepared | same 4 / 4 |
| brief-8 (reset) | main | ran | act-64..67 | opening | none | site home |

The predecessor's confirmations survived the start hook every time: the hook ran first, then the predecessor
re-confirmed. Every `read_accepted` builder and every trial had the 4 accepted rows to read, and every read kept
exactly them. t593 worked as designed here. The phase start is not a cause.

### (3) Is the plan sound?

Yes. The supervisor guidance (`project-agents/supervisor/guidance.ts:53-55`) says that "a part asks for something
to be done or read". t582's constraint warning (`guidance.ts:212`) says "If its parts read something the person
asked for, keep it", and this is that case. A separate read subflow after the acting one is legitimate. It is the
same plan that passed in launch 7 (`run-mv8cam5t-436efa46`). Folding the read into `confirm_requests` would have
dodged defects 2 and 3, because the read would then be the subflow's own and the presses in scope, but that is a
workaround, not a reason the plan was wrong.

The two t582 warnings pull in opposite directions for a read-only subflow. With no output it gets
`plan_subflow_constraint`. With an output (amend 1) it gets `plan_value_unused`. Each warning tells the model to
amend, and the supervisor went round both (amends 1 and 2). Neither warning says a read's rows are already the
Flow's answer and need no output.

### (4) The amends, and whether Core kept or dropped proposals rightly (t590, t595)

| Amend | Change | Core answer | Verdict |
| --- | --- | --- | --- |
| 1 (0104) | `read_accepted` gains output `accepted`; p1's goalFacts rewritten; notAsked reworded | `confirm_requests` dropped, "its facts changed" | **Right** by `supervisor/state.ts:279-280`, `partChange` at `:296-303`. Facts are what its trial was judged against. The rewrite was unforced. |
| 2 (0202) | output removed; p1's quote gains "and leave every other request as it is." (8 words, which are in the instruction); facts reworded again | `confirm_requests` (brief-4's rev 3) dropped, "its parts changed" | **Right**: more than `EDGE_WORDS = 2` (`state.ts:289`). Also unforced. |
| 3 (0204) | identical p1 to amend 2; only the name differs | `confirm_requests` dropped, "its parts changed" | **Right**. The latest done proposal was still brief-4's, built under amend 1's plan, so it is compared with that plan. The supervisor's reason claimed "its done proposal is kept", which the answer contradicted. |

Not one amend touched a cause. Every amend reason blamed the plan shape ("its builder could not give it a valid
ending shape", "cannot close a subflow that only reads"). That reading came from the return reasons, which named
`subflow.ending_shape` and repeat refusals but never said that brief-3's latest revision **had passed**. The t582
constraint warning reinforced it. The guidance on keeping proposals is already explicit (`guidance.ts:79-80`); the
supervisor rewrote parts anyway. That is model behaviour, not a Core defect. Cost of the churn: two extra
`confirm_requests` builds ($0.023) and two extra `read_accepted` builds.

Refusal `project.predecessor_not_done` (0206): **right**. The repair brief named `confirm_requests` as its
predecessor after amend 3 had dropped it, and the refusal's `why` said so in Core's words.

### (5) How the build ended, and what the person was told

The supervisor tried to end partial with 4 lasting acts in place and got `project.completion_reset_first`
(**right**). The reset brief undid act-64..67 and left 0 in place. It then ended `partial`, saying `read_accepted`
"never produced a passing proposal" (inaccurate: brief-3's had passed). The chat's last cards (`61-failure-panel.png`)
said:

- Reset the site: every lasting act undone.
- "Checking whether the Flow is finished: read accepted has failed repeatedly."
- "The supervisor ended the build with only part of the Flow built. Nothing this build did is still on the
  target."
- "The Flow ... has no steps yet, but it keeps your instruction, so you can build it again."

This is honest about what is on the site. It is misleading on cause: it says "failed repeatedly" for a subflow
whose result was correct each time and once passed its trial. The person is not told that the checks could not
confirm a correct read. "Only part of the Flow built" is beside "has no steps yet", because no proposal is saved
when a build ends unassembled.

### (6) Judge calls and verdicts (35 calls, $0.035)

The judges were right about `confirm_requests` (3 trials yes): 4 of 8 confirmed, exactly the rows at five or more.
The row stating "and 4 other" counts as five, and the row with no count shown was left pending.

For `read_accepted` every stored result was correct. So **every non-yes trial verdict on it was wrong**, and every
one traces to the predecessor's presence in the trial:

| Trial | Judge replies (first / recheck) | Core verdict | Why |
| --- | --- | --- | --- |
| 0053 brief-2 r1 | yes, yes(recheck), yes, yes(recheck) | not_judged | The recheck demanded quotes for `confirm_requests.s6`'s unsettled row (no count) and its bound. The judges, told the read was out of scope, did not quote. `agreement.ts:126-131`. |
| 0061 brief-2 r1 | yes, yes(recheck), yes, **no**(recheck: "remove call0") | unsure | The recheck pushed one call to the out-of-scope no. |
| 0090 brief-3 r1 | yes ×4 | **yes** | Passed: Core read the reply text as covering the predecessor's rows by luck of phrasing (see below). |
| 0156 brief-5 r1 | **no** (out of scope), yes, yes(recheck) | unsure | t594 rule. |
| 0167 / 0173 brief-5 r2 | yes ×4 each | not_judged ×2 | As 0053. |
| 0185 brief-5 r2 | **no** (out of scope), yes, yes(recheck) | unsure | t594 rule. |
| 0251 brief-7 r1 | yes (`patchNeeded: true`, tighten `is present`), **no** (out of scope) | **no** | `verdict.ts:172-188`: a yes with unquoted left-out rows and `patchNeeded` becomes does_not_answer, so two nos. The advice given was "remove call0". |

One judge objected that brief-7's `status is present` is not the request's own criterion. That is a fair quibble,
but the read kept the correct rows. Brief-3's yes, and launch 7's yes on its fifth `read_accepted` trial (launch 7
also had 2 unsure and 3 not_judged first), were luck. `unquoted-rows.ts` accepts a row named anywhere in the reply
next to any request quote, across reads (`:62-66`, `:76`). A settled bound counts as named when a quoting sentence
mentions the condition's column (`:93-96`), and this request's own column is also called `mutualFriends`. So a
reply that happens to put the predecessor's rows and that column beside a quote of p2 passes; one that sets them
aside as out of scope fails.

## Root causes, with file and line (Core `9b4c5a38`)

**RC1: a passing builder's completion refused for its shape, and the pass lost** (decisive in this run).

- `flow-bootstrap/subflow-candidate/builder-loop.ts:243-245`: `checkCompletion` sends any result with a key a
  receipt lacks to `endingCheck`.
- `builder-loop.ts:228-231`: `endingCheck` refuses the shape first, with an instruction that names only the
  honest-ending shape.
- `builder-loop.ts:236-238`: the `ENDING_AFTER_YES` branch would have answered "Revision N passed ... complete with
  exactly {...}", but it is unreachable for a mixed result.
- `builder-loop.ts:256`: the completion schema puts receipt keys and `ended`/`reason` in one object, which invites
  the mix. The trial's own words, "It is a partial trial ... Complete with exactly this subflowKey, revision and
  digest", sit beside the ending option "partial ... while a proposal stands". Builders mixed the two shapes 9
  times across briefs 2, 3 and 5.
- `project-agents/dispatch/ending.ts:66-79`: `done` needs `loop.ok`. A builder stopped by a guard whose latest
  proposal has a standing yes with its entry prepared returns `partial`. Core's own trial receipt is ignored.

**RC2: the predecessor's reads are judged as the target's, with words the judge does not have.**

- `flow-bootstrap/verification/detached-subflow.ts:6-17, 33-40`: predecessors run inside the trial, and the run
  "answer[s] as one -- one receipt, one trace".
- `service/subflow-trial/run.ts:151-153`: the summary is built from every record set and action attempt of the
  run, so the predecessor's reads, record sets and flowShape are included.
- `result-verification/request-rows/summary-reads.ts:83` and `request-rows/unquoted-rows.ts:60-84`: every read in
  the summary is held to the quote rule.
- `service/project-build/subflow-trials.ts:101-110`: the judge's only instruction is the brief's own parts, and it
  says "This trial ran only the subflow ...", which is false here.
- `result-verification/verify.ts:202` and `request-rows/request-wording.ts:62`: the request wording comes from that
  scoped instruction. The words stating the predecessor's bound are not in it, so the check cannot be met for the
  predecessor's unsettled row or for its bound line.
- `result-verification/agreement.ts:126-131`: missing evidence on either call means `not_judged`.

**RC3: t594's out-of-scope rule fires on Core's own entry preparation.**

- `result-verification/build-test/task-checklist.ts:48-50` (`OUT_OF_SCOPE`): "A step of this trial that does what
  an outOfScope part asks -- above all a lasting act -- is outside this subflow, and a trial with such a step does
  not do what was asked: answer no". Nothing tells the judge that the `subflow-trial-root.callN` steps and the
  predecessor's frames are Core's preparation of the entry rather than this subflow's steps. Brought in by t594
  (`7b996c2c`). Launch 7's judge prompts carry no `outOfScope` (`grep` of its 27 judge requests found none), so
  this is a regression that launch 7 did not have.

**Contributing: the return reasons and warnings steered the supervisor.**

- `project-agents/dispatch/ending.ts:183-184`: `trialSaid` says nothing when the last trial was yes. So brief-3's
  return led with "stopped by subflow.ending_shape" and never said that its latest revision passed.
- `supervisor/plan-input.ts:134` with `guidance.ts:211-212`: the two t582 warnings disagree for a read-only
  subflow.

## Recommended fixes (none mirrors a realistic scenario's task, site or products)

1. **RC1, in `builder-loop.ts`.** In `checkCompletion`, when a result names the latest proposal's subflowKey,
   revision and digest and a yes stands for it with its entry prepared, take it as the receipt and ignore
   `ended`/`reason`. Otherwise, at least run the `ENDING_AFTER_YES` check before the shape check. When a mix names
   the latest proposal and no yes stands, take it as the honest ending. When it refuses, name both shapes. Write
   `completionSchema` as a `oneOf` of the receipt and the ending.
2. **RC1 safety net, in `dispatch/ending.ts:71`.** Return `done` whenever the latest proposal has a standing yes
   with its entry prepared, however the loop stopped. The trial receipt is Core's evidence, not the builder's
   words.
3. **RC2, scope the judged evidence to the target.** In the subflow-trial summary (`run.ts:151`) or in the judge
   port (`subflow-trials.ts:75-79`), mark the reads, record sets, flowShape steps and acts that belong to
   predecessor frames and to the trial root's calls as `entry` (prepared by subflows whose own trials passed). The
   quote, unaccounted and kept-number checks (`unquoted-rows.ts`, `unaccounted-rows.ts`, and the `keptNumber` path
   in `verdict.ts`) then skip entry reads. Give the judge a `startView` taken at the target's entry, so that only
   the target's changes are credited. Fix `scopeInstruction`'s wording: the earlier subflows ran first to prepare
   the entry, and their steps are not this subflow's.
4. **RC3, in `task-checklist.ts:48-50`.** Exempt the entry. A step inside a call to a subflow Core ran to prepare
   the entry, named by nodeId, is never this subflow's step, and its acts are not this subflow's lasting acts. Add
   a unit test in which a predecessor call that acts precedes a read-only target.
5. **Returns, in `ending.ts:183`.** When a brief stops after a yes for its latest revision, say so first ("revision
   N passed its trial; the brief stopped on <code> at completion"). Then the supervisor briefs again or completes
   instead of amending.
6. **Warnings, in `guidance.ts:211-212`.** Make the constraint warning say that a read the person asked for keeps
   its subflow with no output, because its rows are the run's dataset. Make `plan_value_unused` not tell the model
   to add an output to a subflow that already reads the answer.
7. **Chat ending.** When an ending follows judge disagreement over a correct result, say so ("its result could not
   be confirmed") rather than "has failed repeatedly". Do not say "only part of the Flow built" when no step was
   saved.

## Commands run and observed results

- `ls` / `sed` / `python -c` (stdlib json) over `lab-runs/2026-10-14/run-mv8ic6mk-09bf12ff/steps/*`: 272 step
  folders (index lists 116 decide, 35 judge, 13 test_subflow, 6 dispatch, 3 amend_plan). The figures above come
  from `result.json`, `decision.json`, `meta.json` and `request.txt`. A tally of judge replies printed
  `answersRequest` per call, as summarised in (6).
- The python cost sum over `meta.json` printed `total 0.103`. Judge calls total $0.0350; brief-5 alone used $0.0258
  ($0.0125 decide + $0.0133 judge).
- `git -C !FluxIQ log --oneline 9b4c5a38..HEAD` printed only `3c176900 docs: ...`, and `git status --short` was
  empty.
- `grep` in Core for `required exclusion evidence`, `subflow.ending_shape`, `outOfScope`, `its parts changed`,
  `plan_subflow_constraint` and `subflow-trial-root`. The files and lines read are cited above.
- `grep -l outOfScope` over launch 7's (`run-mv8cam5t-436efa46`) judge requests matched none. Its index shows
  `read_accepted` trials unsure, unsure, not_judged, not_judged, not_judged, then yes.
- I viewed `fxwork/t566/.../a8-slot-3/run-mv8ic6mk-09bf12ff.ui-review.local/61-failure-panel.png` for the chat's
  ending text.

## Not verified

- No fix was written or tested. The claim that RC1's fix alone would have reached the whole test rests on brief-3's
  yes plus launch 7, where the same assembled plan passed `core.test_candidate`. Its whole-run judge would face the
  same exclusion-evidence rule over both reads, but with the full instruction, so the bound's words would exist.
- I did not replay `unquoted-rows.ts` on the archived replies to prove exactly which sentence passed brief-3's 0091
  and 0093. The "phrasing luck" mechanism comes from reading the code (`:62-66`, `:76`, `:93-96`) against the
  replies.
- I did not read the `absorbedByStartReset` and `leftOnSite` act labelling in the trial feedback (act-7..10 and
  act-11..14 both labelled "trial step 12..24"). It looks like double labelling of the entry preparation and the
  trial's own predecessor run. It did not affect the outcome.
- `core.log` was searched only for ending words and was not otherwise read.

## Open questions or contradictions found

- `scopeInstruction` (`subflow-trials.ts:108`) tells the judge "This trial ran only the subflow X". The trial
  design (`detached-subflow.ts` header) runs the predecessors in the same run. One of the two is wrong, and the
  judges kept tripping on the gap.
- t594's out-of-scope rule and t578/t593's in-trial predecessor run were designed separately. Neither header
  mentions the other.
- The brief says launch 7's `read_accepted` "came back done on the second try". Its index shows the yes came on
  brief-3's third trial (the fifth trial overall) after 2 unsure and 3 not_judged. So launch 7 also met RC2 and
  passed by luck. It did not show the defect was absent.
