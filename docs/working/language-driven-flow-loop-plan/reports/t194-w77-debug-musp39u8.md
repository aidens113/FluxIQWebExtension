# t194-w77: full debug of run-musp39u8-9ac026ab

## Outcome

Done. The debug is `docs/working/language-driven-flow-loop-plan/debugs/run-musp39u8-9ac026ab.md` and every template
field is filled. It was written from the run's artifacts only; nothing was re-run and no source was edited.

## What changed and why

- New file `debugs/run-musp39u8-9ac026ab.md`, laid out like this lane's previous debug (`run-murwcmx2-a1c6edf7.md`).
  It has:
  - an order-of-events table;
  - Stage 2 with one row per build decision 0001-0110, and the re-author grouped by try and round, with what each
    rerun returned;
  - Stage 3 with the stored Flow's nodes, including withheld selectors (taken from the 0113 seed);
  - Stage 4 with the playback and the three build tests;
  - Stage 5 with the 13 stored rows against the oracle;
  - Stage 6 with all six judge calls and their pair outcomes, the two re-author tries, a 113-row cost table and a
    split by part;
  - the UI review, the causes table and the instrumentation gaps table.
- This report.

## Commands run and observed results

All were read-only (node/grep/sed over the bundle; `git show HEAD:` and `git grep HEAD` in both trees).

- Step tabulation over `steps/*/meta.json`, `decision.json`, `call.json` and `result.json`.
  - 113 step folders carry `costUsd`, summing to **$0.185891154**. That equals `live-llm.json`
    `runSpend.totalEstimatedCostUsd` and `evaluation.json` `llm.calls: 113`.
  - The split by part is printed in the debug. It reconciles with `runSpend.phases`: build 36 calls $0.085969,
    judge 6 calls $0.006138, reauthor 69 calls $0.093457, chat 1, read 1.
- `decision-trace.json` `resultReauthor.attempts[0..1]`.
  - Try 1: ending `budget_exhausted` / `rounds`, 37 decisions, $0.049579.
  - Try 2: ending `budget_exhausted` / `cost`, 32 decisions, $0.043878.
  - Both are `attempt: 1` with `brief.earlierAttempts: 0`. The purse spent $0.093457 of $0.10.
  - Per-step result codes: 11 `decision_shape_invalid`, 31 `changes_nothing`, 3 `full_run_required`, and 11
    `target_not_a_handle` (Decline 0249/0283; type 0142, 0154, 0167, 0187, 0200, 0238, 0253, 0271, 0287).
- `evaluation.json`: oracle `passed`, 13/13 records matched in place, 52/52 fields, `expectedPages` and
  `pagesFollowed` null.
- `logs/core.log`:
  - "completion check ok=true" is printed for the refused completes (18:12:49.014, 18:12:59.712, 18:13:01.111).
  - Try 2 ends with `decide throw ... flow_bootstrap.run_budget_cost_exhausted` (18:13:01.121).
  - Nothing marks the try boundary: only `loop start` at 18:11:07.016.
- UI review JSON: all 35 moments tabulated with overlay text sequences, `pageLoads`, `pageLoadGaps` and `windowMs`.
  I viewed the pictures for moments 1, 2, 3, 6, 13, 19, 20, 21, 22, 26, 33, 34 and 35, panel and scenario for each.
- `git status` shows both trees dirty with other workers' uncommitted fixes:
  - Core: `read-account/judge-paging.ts`, `sentence.ts`, `reauthor.ts`, `verify.ts`, and others.
  - Downstream: `node-run/run.ts`, `tool-rejection.ts`.

  So every code reference in the debug is to HEAD (`6beae684` / `45bd6232`), the trees the run used.

## Checks of the lead's triage, and disagreements

Confirmed: the cost figures; the answer was right (oracle passed, 13/13, 52/52); round 1 wrote the paginated read
and its test kept 10; 0086 no 0.9 then 0087 yes 0.9 went to round 2 unsettled with 0086's reading; round 2 test kept
13 with 0108 and 0109 both yes; R1's mechanism (the raw `pagesRead 5` / `pageLimit 5` pair plus "the most it may
read", while Core's sentence was right); R2; R3's rerun refusal list (all 11 step numbers match); 11 rounds and 69
decisions, all `not_tested`; both tries ended at a budget; maxPages 60 reread 5 pages and returned 13 rows three
times per try; R4 (`reauthor-build.ts:131`, retryable, both `attempt: 1`, no `core.log` line); R5 (HEAD
`run.ts:312` has `missing: undefined`).

Where I disagree or add:

1. **Round 0 "resent an undetected extraction.4 four times".** Only the first resend (0026) had an undetected
   handle. At 0028 the model detected and got `extraction.4`, and the next three resends (0030, 0032, 0034) were
   still refused `repeat_refused`. Those three refusals were a repeat-guard error that ended round 0 (new C-B1).
2. **"The build judges saw ... with no page limit."** Not quite. The build judges also saw `maxPages: 5` in the
   Flow (0108 request.txt:221) and the same "65-70 of over 1,000" banner (:421). What they lacked was the
   `pagesRead`/`pageLimit` pair in a reads block and the "most it may read" gloss.
3. **"With R1 fixed the first call (0111's reasoning) would answer yes and stand."** Unproven. 0112 would still
   have called the three charging-case pairs accessories (R2), so a yes-then-no could still come out unsettled.
4. **R3 is not the only wall.**
   - The two carried merges (f3, f5) are `not_run_in_this_build` too, and `full_run_required` listed them at 0279.
     The domain catalog runs only web outputs (`D/node-run/catalog.ts:13-16`), so by code reading even fixed
     click/type reruns could not open the test gate for any Flow with an optional step (new R3b; not exercised,
     since each merge rerun was refused only as a second rerun in a decision).
   - The completes were refused `full_run_required` (0279, 0290, 0291), and `core.log` misreports them as
     "completion check ok=true" (new R3c).
5. **"A handle would not help either, since Core reloads the step's start page before the rerun."** No artifact
   answers this: the model never sent a handle. I recorded it as NO EVIDENCE, not as a finding.
6. **"Batched reruns of steps 1-7 (0227, 0246, 0280)."** Only 0227 was steps 1-7. 0246 was steps 2-6 and 0280 was
   steps 2, 4, 6. In each, the first rerun ran and the rest were refused `run_by_the_loop`.
7. **New: R6.** The re-author brief carried Core's correct "How the read went" ("a higher page bound would read
   nothing more") alongside the contrary advice. It then told the model to "Act on the check's findings and advice
   ... Where the advice names a fix, make it" (`brief.ts:67`), so the model was instructed into the maxPages loop.
8. **New: R7.** 11 `decision_shape_invalid` (rerun with no `input`), five in a row at 0179-0183. The refusal text
   never says that a rerun needs `input`.
9. **UI, U1.** The overlay window at moment 2 was 18:02:28.3-31.3, and the build loop's first call was at
   18:02:32.3. So this is the gap between sending and the build starting, not "build running".
10. **UI, new defects.**
    - U5 (moment 2): the sent message stays in the composer with no user bubble.
    - U6 (moment 22): internal keys and node ids from the judge are shown to the person.
    - U7 (moment 26): a refused carried-step rerun is a red "Didn't work" card, followed by "already ran exactly
      this way" for a step that never ran.
    - U8 (moment 33): unusable decisions are shown as "Updating the draft Flow" work.
    - U9 (moments 7, 27, 28): the overlay alternates "Deciding the next step" with the summary about once a second.
11. **UI fixes from 1002-M that hold.** Named test cards (moment 19). No merge cards, and the count is "Step 5 of 5"
    (moment 21).

## Not verified

- Whether a page handle from the round's opening look would have let the type or Decline rerun run after the
  put-back reload. No call tried it.
- Whether `core.run_node` would refuse a merge rerun asked for alone (R3b). This is from code reading of HEAD
  `catalog.ts` and `not-run.ts` only.
- Whether R1's fix alone would have let the result stand (the second judge call and R2).
- I did not view the pictures for moments 4, 5, 7-12, 14-18, 23-25 and 27-32. For those I used only their JSON
  (overlay text sequences, loads, gaps).
- The UI review timestamps in the table are overlay start times, some approximated from `at` minus about 3 s.

## Open questions or contradictions found

- `core.log` names try 2's end `flow_bootstrap.run_budget_cost_exhausted`, while `decision-trace.json` and
  `evaluation.json` say `flow_bootstrap.evidence_budget_exhausted` (bound `cost`). Two codes for one ending.
- The resume at 0139 says "Steps 1, 2, 3, 4, 5, 6 ... notRunInThisBuild", while the draft beside it had already
  been renumbered by the navigate rerun (old navigate now step 2, type now step 7). The model used the draft's
  numbering correctly, but the two numberings disagree in one request.
- 0177 put the page back to **results page 5** before rerunning the navigate (step d7's recorded start was where
  the previous rerun ran). That was harmless here, but a navigate rerun "put back" to a results page is odd.
