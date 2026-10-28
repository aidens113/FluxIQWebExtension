# Debug: run-mvrj7qg8-c20c132e

Status: FAILED (no Flow; the assembled candidate was kept as a draft). Read-only review, 2026-10-27. No source
edit, build, test, live or paid run, model call or commit.

## The run

- Task `social-network-feed-recent-group-posts` (a read: rows, no lasting acts), rerun round 6, slot 3, lane tree
  `C:/Users/osrs_/FluxStuff/fxwork/t566`. Downstream 55fe5c0e and Core 4ae8444f, both clean per `run.json`.
- DeepSeek flash, $0.25 purse, authoring mode `project`. Spent $0.1711 over 97 step folders: builder brief-1
  $0.0917, judges $0.0639, supervisor $0.0077, repair brief-2 $0.0069, chat $0.0009.
- The build ran 03:13:05 to 03:25:27 UTC (`core.log`: `build end ms=742478 status=draft`). It ended on the
  briefs' money, not the 25-minute limit. Both briefs stopped `flow_bootstrap.run_budget_cost_exhausted`
  (`core.log` 03:23:57.909 and 03:25:24.537).
- Lab log: no balance error, crash or provider fault.
- The Lab's ending (`summary.json` firstFailure, event 55): "kept its assembled project candidate as a draft and
  built no Flow: the candidate's test run was judged **unknown** (candidate candidate.92bd7e9c…); it said: \"I kept
  what I wrote as a draft, and nothing was put into the Flow. You can ask me to build it again.\""

## 0. Why every round-6 ending says "judged unknown" (the shared cause)

**No judge and no Core verdict said "unknown". The word is the Lab's own: it can no longer read the verdict.**

- **The Lab reads the verdict from the chat's words.**
  - `packages/test-runner/src/flow-lane/creation/chat/build-from-chat.ts:186` hands the draft turn's text to
    `createdFlowChatCandidateDraftOutcome` (`packages/test-runner/src/flow-lane/creation/candidate-outcome.ts:151`).
  - That function's `chatDraftVerdict` (line 205) rebuilds Core's sentence for each verdict with
    `automationStudioConversationCandidateDraftSaid({ ...template, trial: { verdict, codes } })` and compares
    strings. If none matches, it returns `"unknown"`.
- **t753 changed the words.**
  - Core `runtime/conversations/commands/build.ts` (commit e4f0e0a2, 2026-10-21, task t753) added `told`.
  - When a project build's ending row has already said how the build ended, Core now says only `TOLD_DRAFT`:
    "I kept what I wrote as a draft, and nothing was put into the Flow. You can ask me to build it again."
  - That sentence names no verdict. The header says every project-mode draft is `told`.
- **The Lab was not updated.** `chatDraftVerdict` calls the function with `told` left at its default, `false`.
  So it can never produce `TOLD_DRAFT`, and every project-mode draft since t753 reads `unknown`.
- **Why round 6 is the first round hit.** Round 5 ran on 2026-10-20, before t753 merged (Core d1c39c0a,
  downstream daabd593). Round 6 is the first round with it.
- **There is no other source the Lab could fall back on.** Core's trial session summaries
  (`candidateTrial` metadata, `runtime/service/candidate-trial/run.ts:145,173`) carry the candidate, revision,
  digest, start, execution and code, but no verdict. `readCandidateTrials` sets `verdict: null` for every trial.

**What it means.**

- The identical ending in all four runs is a Lab reporting defect. It hides four separate product outcomes.
  Neither "unknown" nor the matching words is evidence of a shared product cause.
- In this run, Core's own record is clear.
  - The decisive whole test (step 0092, `trial.8b1d79f9…`, revision 6) was judged **no**, twice, correctly.
  - The chat's ending row says so ("The judged test run of the whole Flow from its start ran all 17 of its steps
    and stored 6 rows, and was judged not to do what was asked", screenshot 00053).
  - The draft stood because its last test was a no, and the briefs' money had run out.

The product failure is in sections 1 to 4.

## 1. The whole-run tests

**Every trial was a whole-run test.** The plan has one subflow, so every `core.test_subflow` ran the whole Flow
from its start. Each one's reset folder records `site_check admit in core.test_candidate` (for example 0043).
Each result's `wholeTest.said` reads "This test ran the whole Flow from its start, as the build's judged run".
Every start was `not_reset` with `startHook: none`, which is correct for a read.

**What each trial carried.**

- The packet was `loop_verification` v3 (about 133 KB): `resultSummary` (`recordSets` with `sampleRows`,
  `reads` with each condition's `leftOutOnlyByThis`, `leftOutSettled` and `leftOutTogether`, `flowShape`,
  `endView`), `earlierAdvice` from the second trial on, and `taskChecklist`.
- The checklist carried the supervisor's declared `answer` (0006): `{kind: records, columns: [group, author,
  posted, text, comments]}`, with no lasting acts and four `notAsked` items.

**The trials.** The oracle is 3 rows (see section 2).

| Trial | Test step | Revision: membership condition | Rows stored | Calls: raw answers | Core's verdict |
| --- | --- | --- | --- | --- | --- |
| T1 | 0041 | rev 1: none (group present + date) | 14 | 0044 no, 0045 no | no (correct) |
| T2 | 0049 | rev 2: `shared startsWith "Shared with Members of"` | **3 = oracle** | 0052 no, 0053 no | **no (wrong)** |
| T3 | 0059 | rev 4: `groupurl contains "/groups/"` | 6 (3 unjoined) | 0062 no, 0063 no | no (correct) |
| T4 | 0067 | rev 5: groupurl + `shared contains "Members of"` | **3 = oracle** | 0070 no, **0071 yes**, 0072 no (split-no re-ask), 0073 no (unsupported-no re-ask) | **unsure** |
| T5 | 0075 | rev 5 again, unchanged | **3 = oracle** | 0078 no, 0079 no, 0080 no, 0081 no (both re-asked) | **unsure** |
| T6 | 0092 | rev 6 (repair): groupurl only | 6 (3 unjoined) | 0095 no, 0096 no | no (correct) |

No first call ever said yes, so t757/t764's held first yes and its skipped confirming call never applied.
Every second call was a plain second judgement. The only yes was the second call of T4 (0071, confidence 0.72),
and it was right.

### How each wrong verdict came about (code paths)

- **T2: a wrong double no that Core accepted.**
  - Both calls claimed that condition 1 "dropped joined-group posts shared with Public". 0052 named, as
    `asked_missing`, "Nadia Rahman — Saturday 19 September 2026 at 08:50" and "Aisha Khan — Tuesday 15 September
    2026 at 05:40". 0053 named "rows not read" and an `other` defect: the date pattern admits October to December
    2026 and 2027.
  - Both posts are the friends' own posts, with audience Public and no group (`content/units.ts` `p_8f1420`,
    `p_a71d6f`). The fixture has no joined-group post shared with Public.
  - In `runtime/result-verification/agreement/unsupported-no.ts`, `supportOf` takes a no as supported when
    `automationStudioResultDefectsLocated` locates any one defect, and returns `settled` before any re-ask.
  - `located-defects/located-defects.ts` `notFound` locates an `asked_missing` row when the row exists and was
    left out without being accounted for by the request's words, or was `seen` (left out by two conditions
    together; Aisha's row is in conditions 1+6 `leftOutTogether`).
  - It never checks whether the request asks for that row. The judge's claim that the row belongs to a joined
    group went unchecked, and the double no stood as `candidate.trial_judged_no` (0049).
  - I inferred which defect was located from the code and the request. The trace does not record it.
- **T4: a correct yes held as unsure.** The four calls, in order:
  1. 0070 said no: `asked_missing` "Maya Lindqvist — Riverside Allotment Society, Sunday 20 September 2026 at
     13:10". Maya's open-day post is her own post, Public, with no group (`OPEN_DAY_POST`). The judge took
     "Riverside Allotments" from the post's text.
  2. 0071 said yes and named every left-out row correctly.
  3. 0072 was the split-no re-ask (`agreement/reask-split-no.ts`, t725, recheck words in `split-no-words.ts`). It
     said no again: Maya, plus "Aisha Khan — Riverside Allotment Society, Tuesday 15 September". Both are invented
     group attributions.
  4. Core weighed 0072 (`unsupported-no.ts` → `notFound`) and found no defect. It re-asked with
     `recheckWords`.
     - Core's finding sent to the judge was false: "\"Maya Lindqvist — Riverside Allotment Society, …\" is a row
       the result holds".
     - `rowsNamed` falls back to `automationStudioResultSentenceRows`, which matched the stored row labelled
       "Riverside Allotment Society" (Elena's) inside the judge's sentence.
     - The conclusion (not located) was right, but the reason given was wrong.
  5. 0073 said no again and listed Urban Growers Network ×2, Cycle Commuters of Harbourside and Kettle & Crumb as
     `asked_missing`. These are exactly the unjoined groups the request excludes. Core found them settled and did
     not locate them.
  6. Outcome, from `unsupported-no.ts`: `notTaken` is call 1 and the taken call is the yes, so the result is
     verdict `unsure`, basis `model_disagreed`, code `refutationUnsupported` ("never a no, and never a yes Core
     made"). The feedback code is `candidate.trial_unconfirmed`.
- **T5: two false nos, both refused, still unsure.**
  - The builder retested rev 5 unchanged (0074: "its trial's kept rows match the request, and the disagreeing
    judge call cited rows the trial never kept").
  - All four calls named the invented "Maya Lindqvist — Riverside Allotment Society" row.
  - Core refused both nos. With no model yes beside them, the outcome is `unsure` (`model_unconfirmed`).
- **Where the false premise came from, and how it spread.**
  - T2's judges invented "joined-group posts shared with Public". T2's double no was accepted, so its advice went
    into `resultSummary.earlierAdvice` for every later judge (0070 request lines 1897-1923, rev 2 entry: "…so
    joined-group posts shared with Public are kept while friends' posts and suggested-group posts are dropped").
  - Every later no repeats that premise. Advice from a no whose defects were wrong reached the next judges as
    context.
- **What the judges could not see.**
  - Left-out rows reach the judge as bare labels (`leftOutOnlyByThis`, `leftOutTogether`), with no cells.
  - The read's `group` column is bound to the post's h3 link. On the friends' own posts that is the author's
    name: `group is present` rejected only 4 of 59, and those rows are labelled "Maya Lindqvist", "Nadia Rahman"
    and so on. This is inferred from the counts and labels.
  - A left-out row therefore looks like a row with a group. Nothing in the packet shows that it has no
    `groupurl` and an audience of Friends or Public.

**Did Core downgrade a yes or no?**

- Yes:
  - T4's single correct yes became unsure by design.
  - T2's double no was kept although it rested on rows the request does not ask for.
- No: the last trial (T6, 0092), the one the draft's ending reports. Both calls said no, correctly; Core recorded
  `candidate.trial_judged_no`.

## 2. Were the rows right?

The oracle (`qualification/recent-group-posts/expected.ts`) is three rows in feed order:

1. Elena Sokolova, Riverside Allotment Society, Monday 21 September 2026 at 05:55, 18 comments;
2. Sofía Marín, Harbourside Runners, Sunday 20 September 2026 at 20:46, 24 comments;
3. Oliver Hughes, Old Town Bakers' Circle, Sunday 20 September 2026 at 03:35, 15 comments.

**T2, T4 and T5 stored exactly these.**

- Group, author, posted and comments match, in the same order.
- The full text matches the oracle's three strings exactly (compared by script against `sampleRows` in 0052,
  0070 and 0078).
- Each set was deduplicated (`collected 8, duplicates 5, kept 3`). Paging read 2 pages and the list ended.

**T1, T3 and T6 were rightly judged no.**

- T1 kept friends' posts.
- T3 and T6 kept Kim Tran and Idris Bello (Urban Growers Network) and Rosa Delgado (Cycle Commuters). Rosa's post
  even comes after "You're all caught up".

**Not verified.** I did not run the Lab oracle. The table rests on matching values, and the account check
(no lasting act) is trivially met.

## 3. The sequence

| Steps | What happened |
| --- | --- |
| 0003-0008 | The supervisor searched the page (0004), wrote a one-part plan declaring a records `answer` with the 5 columns (0006), and dispatched brief-1. |
| 0009-0037 | Exploration (~3.5 min): it closed the cookie, notifications and chat popups, ran `detect_repeating_structure` 3× and the read 5×, then `recall_result` and `describe_nodes`. No `incomplete_text` refusals this time, and no row loop: trials took 68-97 s each, against 7.5 min in round 5. |
| 0039-0045 | Rev 1 submitted, then T1: no/no. |
| 0047-0053 | Rev 2 adds `shared startsWith "Shared with Members of"`. T2 stored the oracle and was judged no/no (section 1). |
| 0055 | Rev 3 was refused `candidate.kept_condition_dropped`, correctly: it dropped the date condition. |
| 0057-0063 | Rev 4 followed T2's advice: `groupurl contains "/groups/"`, 6 rows. T3: no/no, correct. |
| 0065-0073 | Rev 5 is groupurl + `shared contains "Members of"`, the oracle again. T4: no/yes/no/no, unsure. |
| 0075-0081 | Rev 5 retested, the oracle again. T5: four nos, refused, unsure. |
| 0083 | The builder, persuaded by the advice, re-sent rev 4's content and was refused `candidate.unchanged_after_no`, correctly. The next decide threw `run_budget_cost_exhausted`. Brief-1 returned `allowance_spent`: $0.1444 spent of $0.2169. |
| 0084-0096 | The supervisor sent repair brief-2 from T5, correctly chosen as "closest" (unsure over no), with an allowance of only $0.0212. The repair followed the judges' false advice (0089: "drop the 'Members of' condition that wrongly excluded joined-group posts shared with Public"). Rev 6 stored 6 rows, and T6 was no/no, correct. Then the money ran out again. |
| 0097 | The supervisor called `complete` with "partial", saying the part "either stored too few posts or could not confirm the rows it kept". |

**Notes on the sequence.**

- **Resets.** Every reset was `site_check admit`. Nothing lasting was done, so t751 had nothing to undo.
- **Assembly.** There was no separate assembly test. With one subflow, the subflow trial is the candidate trial.
- **Money left over.** Brief-1 stopped with $0.07 of its own allowance unspent. Calls are held at their worst case
  (`runtime/llm/run-budget.ts:198-201`; the `build-purse/top-up.ts` header says a cached call settles at about a
  tenth of its hold). I did not reconstruct which hold refused.

## 4. Root cause

**Decisive: the judge cannot be held to the rows it names, so a correct answer is never confirmed (Core).**

This run produced the right answer three times (T2, T4, T5) and none stood:

- T2's false no was accepted.
- T4's true yes was held as unsure, because one yes beside refuted nos is "never a yes Core made".
- T5's false nos were refused, leaving nothing.

The judge kept saying no because it named rows the request does not ask for and Core could not tell. Three
mechanisms, each generic:

- **A. `asked_missing` is located by existence, not by fit**
  (`runtime/result-verification/located-defects/located-defects.ts`, `notFound`, `rowsNamed`).
  - A row the judge calls asked is "located" if it exists and was left out (or was `seen`), whatever its cells
    say. The judge's claim about the row's identity ("— Riverside Allotment Society") is never compared with the
    row's own cells, which Core holds: no `groupurl`, audience Friends or Public.
  - The sentence matcher also resolves a fabricated row to another stored row that has a substring label in
    common, and tells the judge something false ("is a row the result holds").
  - Fix: an `asked_missing` defect, like `wrong_value`, must name the row by Core's id or its whole label, and
    quote the cell (`column`/`value`) that makes it asked. Core then compares that value with the left-out row's
    read cells, and the row is located only where the cell supports it.
  - `rowsNamed` must never resolve a defect's row through another row's label found inside the sentence. A named
    row that resolves to none is "not a row any read saw", never "a row the result holds".
  - Test (`located-defects/tests/`): a left-out row "Ann Lee", whose `group` cell is absent, named
    `asked_missing` as "Ann Lee — Chess Club" with column group = "Chess Club", is not located. The same row with
    a `group` cell of "Chess Club" is located. A fabricated "Bo Kim — Chess Club", beside a stored row labelled
    "Chess Club", yields "no row any read saw", not "a row the result holds".
- **B. Left-out rows reach the judge without their cells**
  (`runtime/result-verification/request-rows/` summary of `leftOutOnlyByThis`, `leftOutTogether`).
  - A judge reading "Maya Lindqvist" cannot see that the row has no group and an audience of Public. It invents
    one from the post's text.
  - Fix: list each left-out row with its answer columns' cells (bounded, as the stored `sampleRows` are), at
    least the columns the request's set is defined by.
  - Test: a summary whose read left a row out by a text condition carries that row's answer-column cells beside
    its label.
- **C. Advice from a no that Core cannot ground is carried forward as context** (`summary.earlierAdvice`, built
  in the whole-trial judge input; the reading in `runtime/result-verification/agreement/`).
  - T2's invented premise ("joined-group posts shared with Public") reached every later judge, and it reached the
    repair builder through `unconfirmedReading.advice`. The repair then dropped the right condition (0089).
  - Fix: `earlierAdvice` and a repair's reading carry only the defects Core located, each with its row and the
    request's words. They never carry free advice prose from a no whose defects Core did not locate, or that a
    later judgement refuted. Where a later revision went back on that advice and stored fewer rows, say so.
  - Test: two trials, the first a no whose only defect is unlocated. The second trial's `earlierAdvice` carries no
    advice text from the first.

**Lab defect (the shared ending, section 0).** `candidate-outcome.ts` `chatDraftVerdict` reads Core's verdict by
matching Core's prose, and t753 changed that prose.

- Fix in Core: write the trial's standing verdict into the session's `candidateTrial` metadata once it is judged
  (`runtime/service/candidate-trial/run.ts` and `subflow-trial/run.ts`), or put it on the `candidate-draft` turn's
  attachment.
- Fix in the Lab: read that verdict, and match the prose only as a fallback. The fallback must also try
  `told = true`; on the told sentence it takes the last trial's recorded verdict, never `unknown`.
- Test (`packages/test-runner/src/flow-lane/creation/tests/candidate-draft.test.ts`): a project draft whose turn is
  the told sentence, with a last trial whose verdict is `no`, records `no`. Today it records `unknown`.
- This is a cross-repository contract, so it needs the usual boundary note.

**Policy question (for the supervisor, not decided here).**

- When every no is refused as unsupported after its re-ask and one model yes remains, the outcome is unsure by
  rule.
- After A, nos like these would be refused earlier, and the retest would face the same coin flip.
- Whether a lone yes beside wholly refuted nos may stand, perhaps after one fresh confirming call, is a rule
  change. I am naming it, not recommending it.

**Contributing.**

- Brief money: brief-1 was refused with $0.07 of its own allowance left, and brief-2 got $0.021 (one trial).
- The supervisor's closing text says the part "stored too few posts", which is false.

**Not a task or fixture defect, and not machine load.** The oracle's rows exist. The instruction names the sign
of membership: "a Join group button". The site shows "Shared with Members of …" only on joined-group posts here.

**Same mechanism in the act runs (slots 1, 2 and 4)?**

- The "unknown" label: certainly the same (section 0). It applies to every project-mode draft.
- The deeper mechanism (unsure from refuted nos, and false defects carried forward as advice): plausible.
  - t766 made act defects locatable by step.
  - A no naming an act on a thing the request does not ask about meets the same existence-only check in
    `act-located.ts`.
  - I did not read those runs. Their debuggers should look at the judge rows, not the ending text.

## 5. UI review

- **Ending (00053, 00056).** The chat has a composer this time, so round 5's "no composer" is fixed.
- **Defects in the ending text:**
  - It reports one test twice: "The one part tested on its own … tested 6 times" and "The judged test run of the
    whole Flow". With one subflow they are the same tests (round 5 fix 7, still open).
  - "The build ran the step 'show more of the feed', which changed the page and might have left something
    behind" contradicts the line just above it, "Nothing was changed on your account". A scroll for the next page
    is not a lasting act.
  - The supervisor's reason ("stored too few posts") blames a correct three-row answer.
  - The toast says "Build failed / Build ended: no Flow was built", while the chat heading says "stopped with the
    Flow only partly built". The two framings differ.
- **During trials (00030, 00039).** The overlay and the chat cards agreed ("Testing your Flow, step 4 of 8",
  "Check result: Working on it"). The overlay counts 8 steps, while the ending says "all 17 of its steps".
  Different units, and unexplained.
- **The scenario page** was again left scrolled sideways during and after trials, with the left navigation cut
  off and the right rail drawn over the feed (00039, 00056). Same as round 5.
- **Start (00003).** The first reply is clear about building and test-running once from the start.

## Not verified

- The Lab oracle's own verdict on T2, T4 or T5 (inferred from exact value matches).
- Which of 0052's defects `notFound` located (inferred from the code: Nadia's row was left out by condition 1
  alone, and Aisha's was `seen` under conditions 1+6).
- That the `group` cell on the friends' own posts holds the author's name (inferred from the `group is present`
  counts and the left-out labels).
- Which worst-case hold refused brief-1 with $0.07 left.
- Slots 1, 2 and 4: not read.
