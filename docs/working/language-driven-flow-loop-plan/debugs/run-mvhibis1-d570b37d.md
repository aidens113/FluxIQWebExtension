# Debug: run-mvhibis1-d570b37d

Status: FAILED (no Flow; candidate kept as a draft). Read-only review, 2026-10-20. No source edit, build,
live or paid run, relaunch or commit.

## The run

- Task `social-network-feed-recent-group-posts`, breadth rerun round 5, slot 3, lane tree
  `C:/Users/osrs_/FluxStuff/fxwork/t566` (downstream e04711f0, Core 3caf1ff0, both clean per `run.json`).
- DeepSeek flash, $0.25 purse. Spent $0.1605 over 115 step folders and 56 model calls. The build ran
  02:53:15 to 03:18:19 UTC (`core.log`: `build end ms=1498438 status=draft`). It ended on the 25-minute
  work limit, not the purse.
- Lab log: no balance error, crash or provider fault. One ui-review scenario screenshot timed out (#52).
- Person's ending: "It was never test-run from the start, so nothing was put into the Flow. I kept what
  I wrote as a draft."

## 1. How far it got

| Steps | What happened |
| --- | --- |
| 0003-0008 | The supervisor looked for "Join group" on the page (0004), planned one subflow, and dispatched brief-1. |
| 0009-0047 | Exploration, 7.5 minutes. Six reads that included the text field were refused `incomplete_text` (0025, 0031, 0033, 0039, 0043, 0045). Each cost about 48 s because `output_not_observed` is retried three times, so 4.8 minutes went on refusals that waiting cannot change. |
| 0049 / 0051 | The first submit was refused because the untilStable scroll had no `maxScrolls`. Revision 2 was accepted: the disclosure shape (context read `posts` with **no conditions**, an optional row-bound "See more" repeated over it, then a final read with conditions). |
| 0053 | **Trial 1** (rev 2, 462 s), the judged whole run (one subflow). The answer set had 6 rows: a condition `groupUrl contains "/groups/"` also kept 3 posts from groups the person has not joined. Judged no. Judge 0056 advised keeping only the joined groups "e.g. by matching those group URLs". |
| 0060 / 0062 | Revision 3 followed that advice and named the three joined groups' URLs. **Trial 2** (447 s) stored an answer set that is **exactly the oracle's three rows**: same group, author, posted and comments, full text, and the disclosure check passed on the kept rows. Judged **no** (0065, 0066). |
| 0068-0076 | Rev 4 was refused `candidate.kept_condition_dropped`, correctly: its date edit dropped 20-30 September. Rev 3 was then re-sent four times (`unchanged_after_no`, then three `repeat_refused`). Brief-1 ended partial. |
| 0078-0096 | Repair brief-2 was seeded from **trial 1**, not trial 2. 0087 was refused `unchanged_after_no`. 0094 was refused `project.trial_out_of_time`: 44 s left, and the last test took 442 s. |
| 0098-0115 | Assemble was refused (no proposal). Brief-3 submitted again, and the work deadline ended the build. `core.log` 03:18:16.991 records a decide throw, `flow_bootstrap.run_budget_cost_exhausted`. |

**Furthest point.** The judged whole run, trial 2 (step 0062, verdict at 0065/0066). It produced the right
answer. Forward progress stopped at that judge's no. After it, no build had both a new revision and the
time to test it.

## 2. Root cause

Each cause below has its own evidence and code location.

### A. Decisive: the judge said no to a correct answer and contradicted its own earlier advice (Core product defect)

- **What 0065 said.** Its `observed` concedes that "the feed's joined-group posts are only these", and it
  names every left-out row as rightly out. Its no rests on two points:
  - condition 1 "hardcodes three group URLs instead of testing membership";
  - condition 2 "admits dates through 2027, wider than asked". This is false: the request says "on or
    after", so later dates are asked for.

  Confidence 0.6. Call 0066 agrees.
- **The contradiction.** Hard-coding the group URLs is what judge 0056 advised one trial earlier. The
  judge request (0065 `request.txt`) carries nothing from the build's earlier judged trial: grep for
  earlier, previous or last trial, or advice, finds nothing.
- **Why the judge read it this way.** The narrowing rule in
  `runtime/llm/diagnosis-instructions.ts` ("a category, option or value the request does not name that
  can leave out items ... answer no") was written for site filters that run before a read. The judge
  applied it to a `where` condition over a set the request defines by a relation ("groups I'm a member
  of").
- **What neither judge did.** Neither named the general alternative. Every unjoined group's row carries
  its own "Join group" control (the trial's page view shows it beside each of the three unjoined-group
  posts), and the instruction itself points at it.
- **Why the builder could not use that control.** The structure the builder read never offered it as a
  field. `web.detect_repeating_structure` (0013, 0019, 0081, 0103) sampled only the first batch of five
  posts (`itemCount: 5`), and none of them is an unjoined-group post. This gap is contributing. I did not
  verify whether a read can take a key the structure did not propose.

### B. No time for a third try (product, with a model choice that the product does not enforce)

- **Trial cost.** Each whole trial took about 7.5 minutes. The project's stored trial trace (Lab instance
  `persistent-isolated/.../objects/sha256/1c/dc/1cdcf7d0….json`) shows why:
  - the optional row press `s12` ran 30 passes, about 13.8 s each, so the loop was about 413 s of a 434 s
    run;
  - within one pass, the before-action state capture took about 2.4 s, the press took 7 to 10 s whether it
    pressed or was skipped as absent, and the after-action capture, taken after the attempt "finished",
    took about 3.8 s.
- **Not new.** Round 4's 0089 took 268 s for 17 passes, so this is not a t743 regression.
- **Why 30 passes (model choice).** The context read had no conditions. The domain's own hint (t743,
  `domain/src/runtime/llm-evidence/rejection-next/next-sentence.ts` `incompleteTextNext`) says to "give
  both reads the same conditions". Nothing checks that it was done. With the same conditions, the loop
  would have walked about 4 rows, the trial would have taken about 2 minutes, and the build would have had
  room for several more revisions.
- **Exploration cost.** About 4.8 minutes of exploration went on the six retried `incomplete_text`
  refusals. This is round 4's observation 6, now about 48 s each.

### C. A latent judge trap, from the same missing conditions (Core product defect)

- **Where the trap comes from.** Every read's rows auto-collect, so the unconditioned context read `s9`
  stored 27 rows as a second record set.
- **What Core told the judge.**
  - `runtime/result-verification/request-rows/summary-with-also-in-result.ts`
    (`automationStudioResultSummaryWithAlsoInResult`, t691) lists the 12 rows that condition 1 left out
    under `storedThoughLeftOut`.
  - It tells the judge "each is a row of the result ... Where the request does not ask for a row in its
    answer, the result should not hold it, and the answer is no".
  - `agreement/` holds back any yes that does not name each row with the request's words.
- **Effect.** The disclosure shape that the domain's hint prescribes cannot be judged yes while its
  context read keeps rows the answer drops. The Lab oracle would not care, because it pairs the last read
  that carries every key (`packages/test-runner/src/flow-lane/creation/judgement.ts` `pairingOrder`).
- **Other symptoms of the same cause.**
  - "Core's record contradicts" notes inside the judge's own text ("…is in the stored rows: another copy
    of it was kept", 0053, 0062) for rows that only the context set holds.
  - Item D.

### D. The repair started from the worse trial (Core product defect)

- **What Core chose.** `runtime/project-agents/contracts/builder-return.ts` `closestTrial`/`trialRank`
  ranks trials with the same verdict by `feedback.stored.rows`, which sums every record set. Trial 1 (33:
  6 answer rows + 27 context rows, 3 of them wrong) ranked above trial 2 (30: the exact 3 + 27).
- **Effect.** The supervisor's 0078 dispatch copied trial 1 as `failingReceipt`. For a filtered request,
  more rows is not closer to passing.

### Classification

- **Product defects:** A, C, D, and the per-pass trial cost in B.
- **Model choices the product should have prevented:**
  - the context read without the hint's conditions (0051);
  - hard-coded membership (0060), made on the judge's advice;
  - a wrong regex edit (0067), which Core refused correctly;
  - re-sending rev 3 four times, which the repeat guard stopped.
- **Not a task or fixture defect.** The task is achievable and unambiguous. The oracle's three rows exist,
  and trial 2 read them. The instruction names the row sign ("a Join group button").
- **Not machine load.**

## 3. Round-4 causes, t743 and t748

- **Gone.**
  - Round 4's primary cause, disclosure checked on rejected rows: the final reads passed with collapsed
    posts among the rejected rows (t743 S5 works).
  - The hidden stop past step 40: the feedback lists step 134, the final read, after step 39.
  - The swapped group and author columns: revision 2 bound them correctly.
- **Carried.**
  - Retried `incomplete_text` refusals (round 4 observation 6).
  - Time per pass in row loops.
- **Exposed by t743, not caused by it.** The new "same conditions" hint is advice only, and a build that
  ignores it meets C and D. t748's items did not touch these paths.
- **The round-5 job weakness does not apply.** No lasting step exists here: "See more" is
  `consequences: none`, and every reset was `site_check admit`.
- **The shared pattern does apply.** A rule Core states in guidance is enforced on one path only. Here the
  hint's "same conditions" is never checked at submit.

## 4. UI review

The chat reads as a clean message stream with clear turns, and a composer was present in every mid-build
panel. Defects and notes:

- **Ending is self-contradictory and repetitive** (`61-failure-panel.png`). It says "tested twice, and its
  last test was judged not to do what was asked", then "never tested from its start" three times ("A whole
  Flow was assembled and never tested…", "It was never test-run from the start…", "Saved candidate draft.
  It was never test-run from the start…"). Both tests were whole runs. It also warns about three popup
  dismissals as acts that "might have left something behind".
- **No composer in the final panel** (`61-failure-panel.png`), though every mid-build panel has one
  (for example `60-mid-build-panel.png`). I did not verify whether the panel had only scrolled.
- **The overlay gives no progress for six minutes.** It sat at "Running step 9 of 10: Expand the post's
  shortened text" for about 6 minutes per trial (#30 to #47 and #53 to #60; `40-mid-build-scenario.png`),
  with no pass count. The chat's card per pass does show progress (`40-`, `60-mid-build-panel.png`).
- **Overlay "not visible" samples were probe timeouts, not disappearances** (#14, #32, #44: "did not
  answer within 1000 ms"). Together with the #52 screenshot timeout, they point to a busy page main
  thread during per-pass captures. The overlay was otherwise present and steady.
- **Minor.**
  - The button reads "Stop" at the start (`02-mid-build-panel.png`) and "Stop build" later.
  - During the trial the scenario page was left scrolled sideways (page view "scrolled to x=237"), with
    the right rail drawn over the feed (`40-mid-build-scenario.png`).

## 5. Recommended fixes (generic; none mirrors this site, task or answer)

1. **Structural: one read discloses its own kept rows** (the two-read disclosure shape has now failed in
   rounds 3, 4 and 5 in three different ways).
   - **The change.** Give `extract_list` a disclosure option: before reading a field, the reader presses
     the row's own disclosure control, but only on the rows its conditions keep. This replaces the
     context read, the row loop and the reread.
   - **Files.**
     - `apps/extension/src/content/extraction/list-reader.ts`, `field-reader.ts` and
       `text-disclosure/text-disclosure.ts`;
     - the domain's extractList parameter contract and its script-format text;
     - `next-sentence.ts` `incompleteTextNext`.
   - **Test first** (`apps/extension/src/content/extraction/tests/list-reader.test.ts`). Use a fake list of
     book reviews with "Read more" on two long reviews, one kept and one rejected by a date condition. With
     the option, the read returns the kept review's full text and never presses the rejected one. Today the
     option does not exist, so the test fails.
   - **Cheaper fallback, if (1) is out of scope.** Make the hint a check: a new Core script statement
     beside `flow-bootstrap/script-statements/listing-order-in-repeat.ts`, wired in
     `llm/harness-options/bootstrap-completion.ts`. It refuses once when a `repeat over` read and a later
     read of the same listing differ in conditions on the fields both read. Test: a plan with an
     unconditioned source read and a conditioned reread is refused, and the same plan with matching
     conditions is accepted.
2. **Judge: relation-defined sets and continuity** (`runtime/llm/diagnosis-instructions.ts` and the
   whole-trial judge input).
   - Where the request defines a set by the person's relation to it, a condition should read the sign of
     that relation that each row shows. The judge then answers no over a literal value list only when it
     can name that row sign in `changed`, and never advises a literal list itself.
   - The judge is given its previous judged trial's `changed` for the same build. Where the new revision
     applied that advice, the judge must say why the advice no longer holds.
   - Example for the guidance: a library's "books I have on loan" kept by each row's Return button.
   - Test (`runtime/llm/tests/`, prompt contract): the instructions carry the rule. Also a judge-input test
     shows the earlier trial's `changed` present on the second whole-trial request.
3. **Judge evidence: working rows** (`summary-with-also-in-result.ts`, `summary-reads.ts`
   `automationStudioRequestRowsStoredBy`). A record set whose read only feeds a later `repeat over`, and
   whose listing a later read re-reads, is working rows. It is not a holder for `storedThoughLeftOut`, and
   it is not "the result" in the contradiction notes. Test: a summary with such a source set and a
   conditioned reread gives no `storedThoughLeftOut` and does not hold a yes.
4. **Closest trial** (`project-agents/contracts/builder-return.ts` `trialRank`). Among the same verdict,
   take the latest, unless the latest stored no answer rows and an earlier trial did. Count only the
   answer set (the last read carrying `recordOutput`), never every record set. Test: two `no` trials,
   stored 33 then 30. `closestTrial` must return the later one; today it returns the earlier.
5. **Structure detection samples past the first batch** (extension `content/extraction/detect-structure.ts`
   / `infer-list.ts`). A column that appears only in later rows, such as a per-row membership control,
   should be offered as a field. I did not verify this, so look before building it.
6. **Throughput (needs the user's call where it touches the retry rule).**
   - The per-pass before and after state captures on a large page cost about 6 s of each 13.8 s pass.
     Capture only the row's scope for a row-bound act with no consequences.
   - A row-bound optional target that is absent from an already resolved row is absent at once. This
     shortens the target wait, which the user's "every node retries, waiting for the target first" rule
     governs.
   - An `incomplete_text` refusal does not change with waiting, so it should not take three retries.
7. **The person's ending** (Core ending text and t748's ending filter). When the plan has one subflow and
   its tests were whole runs, say so. Say "never tested" once and only of the untested candidate. Do not
   list `consequences: none` popup dismissals as possible leftovers.

## Not verified

- That the Lab oracle would have passed trial 2. The answer set's group, author, posted and comments match
  the oracle. The text shown to the judge is truncated for display, but the extension's disclosure check
  passed on those rows. I did not run the oracle.
- Exactly which part of a pass's 7-10 s action time is the 5 s target ladder (`recovery/budget.ts`) and
  which is landing or settling waits. The capture times are measured; the split is inferred.
- Whether a read could take a field key the structure detection did not propose (fix 5).
- Whether the final panel's missing composer is a layout defect or a scroll state.
