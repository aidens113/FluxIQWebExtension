# Debug: run-mvbr0w7e-6a01c05b

- Instance: a8-slot-3, task `social-network-feed-confirm-requests`, authoring mode `project` (cost round 2, 2026-10-17 UTC, downstream `40b5ee32` / Core `807e4ebe`, after Core t685-t690), lane tree `fxwork/t566`.
  Steps: 122, 28 decisions, 4 judge calls, $0.031 at the full rate.
- Verdict: **failed**. The Flow was created and played back. Playback's result check answered no (`core.result.does_not_answer_request`, `output_not_observed`), and the Lab's oracle failed: it expected the 4 accepted requests, and the answer held all 8 (4 of them matched, in any order).
- Cause: **the trial judge said yes to an answer that was wrong.** The acting half was right. Condition 1 (`mutualFriends atLeast 5`) kept Amara Osei, Jonas Weber, Lin Zhao and Freya Holm, and all four were confirmed. But the builder's last read, s14 "list the accepted requests", had no `where`, so it stored all 8 requests. The trial's two judge calls (0032, 0033) both saw "s14 holds all 8 rows" and still answered yes. Playback ran the same Flow, stored the same 8 rows, and its result check (0054, 0055) correctly answered no.
  - The builder writing this read with no filter is not new. Revision 1 had the same gap in cost round 1 (`run-mvbl9hrv`) and in frozen pair 8 (`run-mvapd33q`). Those runs passed only because their judges answered no.
  - This session's Core changes did not cause it. None of t686-t690 ran on a path that mattered, because the trial produced no "no".
  - Two things made the wrong yes possible, and both are older than this session. (a) Core's `leftOutAlsoInResult` note (t624) told the judge that Tom Becker, Priya Nair, Diego Alvarez and Marta Kowalczyk were "another copy of the same item ... kept", which reassured it about exactly the 4 wrong rows. (b) The second judge call is meant to confirm the first, but its request is byte-for-byte the same and runs at temperature 0, so it adds no independent check.
- Next: build the structural fix described in Detail (5). Keep it general: it is about extra rows in an answer, never this scenario. Then rerun this task in the next cost round.

## Detail

### 1. How far it got

| Phase | Steps | What happened |
| --- | --- | --- |
| Plan | 0002-0006 | Supervisor planned one subflow `confirm_requests` covering p1 (confirm requests with at least 5 mutual friends) and p2 (a table of every request the list now shows as accepted), then dispatched one build brief. |
| Build | 0007-0029 | Builder dismissed cookies, opened the friend requests page, closed the notifications and chat popups, and ran the read three times (one call refused `already_answered`). It submitted revision 1: s8 reads with `where mutualFriends atLeast 5`, s11 confirms each kept row (repeated), s12 waits, and s14 "list the accepted requests" reads with **no `where`** and outputs columns `name, mutualFriends`. |
| Judged trial | 0031-0033 | `core.test_subflow` returned `subflow.trial_yes`. This single-path test is the judged whole run (t679). Judge 0032 answered yes; 0033 sent the identical request and answered yes. |
| Promotion | 0034-0037 | Builder's first `complete` was refused (`subflow.latest_proposal_required`, wrong digest). It completed on the second try, then the supervisor completed. The Flow was created on revision 1. |
| Playback | 0038-0053 | Same steps as the trial. The 4th confirm got `web.action.rate_limited` (0050); a runtime patch handler cleared the "going too fast" notice (0051). s14 extracted 8 rows. |
| Result check | 0054-0055 | Both calls answered no: "s14 read all 8 requests with no filter ... add a where condition keeping only rows marked 'Request accepted'". Event 32 status `refuted`. |
| Repair lane (t688) | 0056-0122 | 11 decisions. Every amendment reran s14 with `where [{field: <status column>, is: present}]`. That status column is present on all 8 rows, so the condition kept 8 every time. Core then refused the repeats: `changes_nothing` (0076, 0078, 0080), `rerun_changed_nothing` (0102), `repeat_refused` (0105, 0107). Two test replays (0081-0095, 0108-0122) still gave 8 rows. Outcome: `flow_bootstrap.build_not_finished`, adaptation stuck at `testing`, nothing applied (event 33, `oracle_failed`). |
| Oracle | evaluation.json | `expectedRecords 4`, `observedRecords 8`, `matchedInAnyOrder 4`, `oracleVerdict failed`. |

### 2. Why

- **The judged yes was wrong.** At the end of the trial, the page showed exactly the 4 qualifying requests as "Request accepted" and the other 4 still with Confirm and Delete. The trial's acting half matched the request. The stored table did not: p2 asks for "every request the list now shows as accepted", and s14 stored all 8.
  - Judge 0032's own reply says "Accepted table s14 holds all 8 rows in list order with mutualFriends verbatim" and then `answersRequest: yes`. It never checked each stored row against the word "accepted".
- **Playback did not differ from the trial.** It ran the same steps and stored the same 8 rows. The only extra was the rate-limit handler.
- **The result check judged correctly.** Its no is right, and its advice was right too (filter s14 on the row's "Request accepted" state).
- **Why the trial judge said yes when earlier rounds said no.** The judge's input had the same shape as in round 1's revision 1 (0032/0033 there, both no) and pair 8 (0086 no, 0087 yes). A diff with node ids normalised shows only the popup steps differ. Three factors made yes possible:
  1. The judge prompt (`llm/diagnosis-instructions.ts`) is built almost entirely around rows that were **left out**: `leftOutOnlyByThis`, `leftOutSettled`, quotes for each exclusion. It has no equally firm duty to check each **stored** row against the request's own restricting words. "The wrong records" appears only once, in a list.
  2. `request-rows/summary-with-also-in-result.ts` (t624) marks a row as also-in-result if its label matches a row in **any** record set. Here the 4 rows condition 1 left out of the act reappear only because a different read, s14, has no condition. Core still told the judge "another copy of the same item was kept ... none of these rows is an item the condition took out of it". `request-rows/unquoted-rows.ts` (`inResult`) also exempts those rows from needing a quote. That note was written for second copies inside one read; here it vouched for the wrong rows.
  3. Confirming a yes (`agreement/ask-again.ts`, `confirmAnswer`) sends the **identical** request: the two request.txt files are identical, and both run at temperature 0. So "two judges agreed" was one opinion counted twice.

### 3. Did this session's Core changes cause or allow it?

- **t686** (`agreement/no-reasons.ts`): this rule applies only when a no is asked again. The trial gave no no, and the result check's two nos stood (`refuted`). **Not involved.**
- **t687** (request-exclusion kept conditions; refuted advice not passed on): this runs on a judged no. There was none in the build. **Not involved.**
- **t688** (repair lane): it ran after playback. It replayed correctly from where the page stood (0061-0070, 0081-0095), but it could not repair the Flow (see 4). **Did not cause the failure; failed to recover from it.**
- **t689** (kept conditions carried on the single path): this holds a judged no's conditions for the builder. There was no no. **Not involved.**
- **t690**, part by part:
  - The builder's new read sentence about filter option words is about a site's own filters. The builder used none, and it had already left the s14 `where` out in round 1 and pair 8, before t690. **Not a cause.**
  - The page-loop hint appeared in the repair's `changes_nothing` advice (0076: "If it moves the list on to its next page instead ... repeat while 15"). It was irrelevant to a read whose condition kept every row: noise, not a cause.
  - Step copies and the `verify.ts` record touch only stalls and the re-ask of a narrowing no. **Not involved.**
- **t679/t685** (the single-path test is the judged run, and how it is paid for):
  - **t679 allowed it.** The trial's yes promoted the Flow directly, and no other judged run happened before playback. Round 1 was under the same rule and passed only because its trial said no. Pair 8, before t679, also had judged runs after assembly.
  - t685 (funding) played no part. $0.031 is far below the $0.25 limit.

### 4. Where the decisions went (28 decisions, 4 judge calls, $0.0313)

| Who | Decisions | Cost | Notes |
| --- | --- | --- | --- |
| Supervisor | 3 | $0.0028 | Plan, dispatch, complete. |
| Builder | 14 | $0.0094 | Popups: 4. Navigation: 2. Structure checks: 3 (one refused). Read: 1. Submit: 1. Test: 1. Complete: 2, of which 1 was avoidable (wrong digest). |
| Trial judge | 2 calls | $0.0021 | Identical requests, both yes. |
| Result check | 2 calls | $0.0026 | Both no, correct. |
| Repair lane | 11 | $0.0142 | 45% of the run's spend. Six of the eleven resent the same `is present` condition, which could never narrow the list: at 0059, 0072, 0075, 0077, 0079 and 0101. |

### 5. Structural fix (general; Core)

Today Core checks rows that are missing from an answer; it should check rows that should not be there with the same rigour. Every example in the guidance must use another kind of site.

1. **Mark "also in the result" only for the same read.** In `result-verification/request-rows/summary-with-also-in-result.ts`, mark a left-out row as also-in-result only when its stored copy came from the same read's own record set. When a **different** read stored it, mark it as something new, `storedThoughLeftOut`: "condition N left these rows out of what the Flow acted on, and read sM stored them". In `request-rows/unquoted-rows.ts`, stop exempting those rows (`inResult`). Instead, in the agreement (`agreement/said.ts`, as is done for `leftOutNamingTheItem`), a yes must name each such row and quote the request's words that ask for it in the answer. A yes that does not is not taken.
   - Library-catalogue example: renew the overdue books, then list the books now shown as renewed. A final read that also stores the books that were not renewed has to say why each is there.
2. **A read that keeps everything after an act is a doubt.** In the read accounts (`result-verification/read-account/accounts.ts`), flag a read that has no condition, kept every item it saw (`kept == itemsSeen`), and runs after an act repeated over a narrower read of the same list. Its record set's rows must be checked one by one against the request's words for the answer. The trial gate (`build/subflow-candidate/subflow-trial-gate.ts`) should treat this as a reason to ask again.
3. **Make the second ask a real second opinion.** `agreement/ask-again.ts` (`confirmAnswer`) should ask the converse question, not the same one. For example: list the stored rows and, for each, ask whether the request asks for it in its answer, with the words that do. At minimum, never count an identical temperature-0 repeat as agreement.
4. **Tell the repair what its condition did.** A rerun whose new condition rejected no row should say so, with the values the condition read on those rows. That means the condition account in the read result (downstream `apps/extension/src/content/extraction/item-filter.ts`, which today reports only rejections) and the `changes_nothing` advice in Core's `llm/draft-amendment-feedback.ts`. The advice should name the condition that kept every row, not the next act after the read (t690's page-loop hint). Here that would have turned `is present` into a text condition after one round instead of six identical decisions.
