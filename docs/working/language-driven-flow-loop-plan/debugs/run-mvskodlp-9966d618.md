# Debug: run-mvskodlp-9966d618

Status: FAILED, though the Lab's oracle **passed**. Core built the Flow, and the Lab's playback stored exactly the
oracle's rows. Core's own result check on that playback then said no twice, wrongly, and the run was reported failed
with `core.result.does_not_answer_request`. Read-only review, 2026-10-28. No source edit, build, test, live or paid
run, model call or commit.

## The run

- Task `social-network-feed-recent-group-posts` (a read: rows, no lasting acts), rerun round 6b, slot 3, lane tree
  `C:/Users/osrs_/FluxStuff/fxwork/t566`. Downstream 1bb6b93d and Core 6f2d1a6c, both clean per `run.json`.
- DeepSeek flash, $0.25 purse, authoring mode `project`, `--replays 1`.
- Spent $0.0875 over 44 calls. By phase, from the step metas:
  - build: 25 calls, $0.0379;
  - the playback's result check: 2 calls, $0.0060;
  - the result repair: 17 calls, $0.0436.
- Timeline (`core.log`):
  - the build ran 20:39:12 to 20:43:28 (`build end ms=255540 status=proposed`), and the Flow was applied at
    20:43:29;
  - the playback was checked at 20:44:32;
  - the repair ran 20:44:34 to 20:48:37 (`reauthor-build end … edit=no code=flow_bootstrap.build_not_finished`).
- Lab log: no balance error, crash or provider fault. `live-guard` recorded $0.0875 with no build over its ceiling.
- `evaluation.json`:
  - `flowCreated: true` and `oracleVerdict: "passed"`;
  - `extraction`: expected 3, observed 3, matched 3, 15 of 15 fields present, 0 unexpected;
  - `reportedVerdict: "failed"`, from `automationFailureReported {output_not_observed,
    core.result.does_not_answer_request}`.

**Compared with round 6 (`run-mvrj7qg8-c20c132e`).** That run never built a Flow. This one built the right Flow in
two live trials for a fifth of the money, so the build side improved. The failure has moved to the playback, but the
mechanism is the same family: a judge says no over a row the request does not ask for, and Core accepts the no. It
is what is left of round 6's mechanism A after t771. t771 now checks the cell a no quotes, which grounds which group
the row is in. It cannot ground what makes the row one the request asks for (membership), because no cell holds that.
A second gate, the build-yes hold (t660/t664), would have set the no aside, but it requires the build's yes to be
first-ask confirmed, and this build's yes was not (section 3).

## 1. How far it got

### Exploration (0007-0023)

- 0007-0015: it opened the feed, closed the cookie (t476) and notification (t481) prompts, and ran
  `detect_repeating_structure` on the feed twice (0011, 0019).
- 0021: one read, `extraction.2`, with group, author, posted, text and comments. It got "25 records from 1 page".
- 0023: a repeat of the same read was refused `llm_evidence_loop.already_answered`, correctly.
- There was no row loop and no `incomplete_text` refusal.

### Candidates and trials

There is one subflow, so every `core.test_subflow` is the whole run from the start (`wholeTest.said`). Each trial
started `not_reset`, which is right for a read.

| Step | Subflow rev | Membership condition on the read | Trial | Rows stored | Judge calls | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 0025 | 1 | none | refused at submit | - | - | `record_output.replace_in_repeat`, correct (writeMode replace inside the page loop) |
| 0029 | 2 | `group is present` (+ author, posted present) | offline 0031 refused `no_live_source`, so live | 6 | 0033 no, 0034 no | **no, correct** |
| 0038 | 3 | `group equals ["Riverside Allotment Society", "Harbourside Runners", "Old Town Bakers' Circle"]` (+ posted present) | offline 0040 `inconclusive` (14 of 24 recorded operations matched), so live | **3 = oracle** | 0042 no, 0043 yes, 0044 yes, 0045 yes, 0046 yes | **yes** |

- **T1 (rev 2) was rightly a no.** 0033 and 0034 named Kim Tran and Idris Bello (Urban Growers Network) and Rosa
  Delgado (Cycle Commuters of Harbourside) as `kept_not_asked`: posts from groups not joined.
- **Where rev 3's condition came from.** Both T1 judges advised the literal list. 0033: "keeps only rows whose group
  is one the person has joined (e.g. group is one of Riverside Allotment Society, Harbourside Runners, Old Town
  Bakers' Circle, or exclude rows showing a Join group control)". The builder took the first of those two options
  (0035).
- **How T2 reached yes.** Every call saw the same 3 correct rows.
  1. 0042 (first ask) said **no**: `asked_missing` "Cycle Commuters of Harbourside — Rosa Delgado" and "Urban
     Growers Network — Idris Bello", because "condition 1 keeps only three hard-coded group names". That is false:
     both are unjoined groups the request excludes.
  2. 0043 said yes, without quoting the request.
  3. 0044 was the quote re-ask of 0043's yes: yes.
  4. 0045 was the split-no recheck of 0042 ("This same evidence was judged before … another judgement of the same
     evidence said it does"): yes.
  5. 0046 was the quote re-ask of 0045: yes.
  6. The verdict was yes: "The trial was judged twice to do what the instruction asks."
- 0047: the builder completed rev 3. 0048: the supervisor completed the Flow (revision 2).

### The Lab's playback and Core's result check (0049-0059)

- 0049-0057: the playback opened the feed twice, made three optional clicks (cookie, notifications, chat), then read
  page 1, moved on, read page 2, and found no next page.
- It stored the oracle's 3 rows: Elena Sokolova / Riverside Allotment Society / Monday 21 September 2026 at 05:55;
  Sofía Marín / Harbourside Runners / Sunday 20 September 2026 at 20:46; Oliver Hughes / Old Town Bakers' Circle /
  Sunday 20 September 2026 at 03:35. The Lab matched all 15 fields.
- **0058 said no** (confidence 0.7): `asked_missing` "Rosa Delgado — Cycle Commuters of Harbourside, Monday 21
  September 2026 at 04:00", "a group the user has joined".
- **0059 said no**, the same claim plus Idris Bello / Urban Growers Network. 0059's prompt was a cache hit for
  40,192 of its 40,432 input tokens, so it is close to the same draw as 0058, as `build-yes-hold/held-double-no.ts`'s
  header itself says.
- `core.log` 20:44:32.812: `result-check build-yes-hold … held=false because=trial_not_confirmed`.
- Event 43: `resultChecks.status: "refuted"`.

### The result repair (0060-0114): it changed nothing

- Every builder decision was an `amend_draft` rerun of step 9, the read.
- The edits replaced condition 1 with `group is present`, which is the T1 mistake again: it keeps unjoined groups.
  0073 also rewrote the read's fields to generic `kind: text` selectors, which broke the group mapping.
- Core refused or ignored the later edits: `rerun_changed_nothing`, `changes_nothing`, `same_amendment`.
- Both rounds ended `stopped=unusable_decisions`. Their round tests, 8 rows and then 11, were judged `unknown`
  (calls=4, then calls=5).
- The repair then ended `flow_bootstrap.build_not_finished`, and nothing was applied to the saved Flow.

### The oracle

- `qualification/recent-group-posts/expected.ts` is the 3 rows above. The Lab's `extraction` record matched all 3,
  in order.
- The build's T2 stored the same 3 rows. They were not re-compared by script: the hold stopped before its
  `rows_differ` check, and it does not record a comparison.

## 2. The cause

**The run went wrong at 0058/0059.** A double no, false on evidence the judge was shown, was accepted as a
refutation of a correct result. Three things had to line up, and all three are in Core.

1. **The judges' claim was false on their own packet.**
   - The packet (0058 `request.txt`) shows Rosa's row with its cells: `group: Cycle Commuters of Harbourside` and
     `posted: Monday 21 September 2026 at 04:00`. These are the `leftOutCells` added since round 6.
   - Its page view shows that post after `h2 "You're all caught up"` and `h2 "Suggested posts"`, under
     `"Suggested for you"` with `button "Join group"` and `img "Shared with Public"`.
   - The joined groups' posts show `img "Shared with Members of …"` instead.
   - Idris Bello's post (Urban Growers Network) sits in the same suggested block. The final screenshot shows it under
     "Suggested for you" beside "Join group", just above "No more posts to show right now".
   - So it was the model's error, given clear evidence. The same model got it right elsewhere: T1's judges and
     every repair judge (0087, 0110, 0113) called these same rows posts from groups not joined.
2. **Core located the false defect**
   (`runtime/result-verification/located-defects/located-defects.ts`, `notFound` → `askedCellNotFound`).
   - The row was left out by condition 1 alone, so `rowsNamed` finds it.
   - t771's check then asks only whether the row's own `group` cell holds the quoted value. It does:
     `fold("Cycle Commuters of Harbourside")` matches the cell. So the defect is "located".
   - The cell grounds *which group* the post is in. What the no actually claims is that the request asks for that
     group ("one of the groups I'm a member of"). Membership is in no cell and no condition Core measured.
   - The cited value is also exactly the value condition 1 tested and rejected. The defect only restates that the
     no-caller disagrees with the condition's list. In effect, the check accepts the quoted cell as proof of
     membership.
   - Because each no had a located defect, `agreement/unsupported-no.ts` `supportOf` returned `supported`. The double
     no stood with no re-ask, and the outcome was `does_not_answer`, basis `model`.
3. **The build-yes hold did not apply** (`runtime/result-verification/build-yes-hold/held-double-no.ts`).
   - The hold exists for exactly this shape: a playback whose double no lands on the build trial's own rows. It reads
     its preconditions in order and stopped at the third, `trial_not_confirmed`.
   - `firstAskConfirmed` requires the trial's yes to be its first two calls. T2's first call (0042) was the same false
     no, and its yes came through the split recheck (0045).
   - That rule is deliberate (t664, the towels trial whose re-asked yes was wrong). So the hold behaved as designed.

**Why the judges latched on: the Flow's condition is a list of literal values the request never says (contributing;
judgement call).**

- Both playback nos argue from the literal list: 0058 "hardcodes three group names"; 0059 "joined groups beyond the
  three shortcuts". So did 0042 in T2. The invented "joined" status is their justification for that objection.
- The list is today's membership, taken from the page's shortcuts (via T1's advice). It is right on today's data, and
  the oracle passed.
- It is a snapshot, though, not the request's rule. The memory `flows-authored-as-general-structure` and the
  realistic-task rule ask for Flows that generalise.
- The page offered the general signal on every post:
  - the read's own structure (0019) carried an `svg aria-label` / `svg title` field, which on joined-group posts
    reads "Shared with Members of …";
  - the "Join group" button marks unjoined groups.
- Round 6's T2 used the audience text and got the same 3 rows.

**Also contributing, not decisive.**

- **The Flow reads past the bound the request names.** The request says "down to where it says I'm all caught up".
  The read paged on to the list's end, through "Suggested posts", and kept 59 rows seen, against roughly 41 before the
  marker. That is my count from page positions, not verified.
  - Rosa's, Idris's and one Kettle & Crumb row (page 2, items 31, 33 and 34 in `leftOutObservations`) exist in the
    record only because of this.
  - They are the exact rows the false nos named. Their exclusion was right either way, so the output is unaffected.
- **The posted pattern admits "31 September" and every 2027 date.** It is harmless on this data. Repair judges noted
  it as `other`.

**Not a task or oracle defect, and not the Lab.**

- The oracle's rows exist, and the Flow's output matched them.
- The instruction names the sign of non-membership ("one the feed suggests with a Join group button").
- The Lab read Core's verdict correctly: `refuted` maps to `failed` in `lane-observation.ts` `reportedVerdict`.
- Round 6's Lab "unknown" ending defect did not arise, because a Flow was built.

**What the new fixes did here.**

- t771 cells: the judge saw them. The cell check grounded identity but not membership (above).
- t771 lone-yes confirmation: not reached.
- t775, t781, t783: nothing to reset, toggle or undo.
- P6 offline-first trials: both fell back to live, once `no_live_source` and once `inconclusive` after 5.3 s. That
  cost no money, but it did not save a live trial either.

## 3. The fix

**F1 (decisive; Core, `located-defects/located-defects.ts`).** An `asked_missing` defect whose quoted value is only
the value a condition tested and rejected must not count as located unless the request itself says that value.

- Applies when:
  - the row was left out by one condition alone;
  - that condition tests the defect's column against a list of values, or one value (`equals`), that the user did not
    write;
  - the quoted value is that row's tested value in that column.
- Then Core locates the defect only when the request's own words (`record.says`, the same check
  `requestWordsUnsaid` uses) contain that value.
- Otherwise the finding is Core's words, naming no site, for example: "Core's record of "<row>" holds "<value>" in
  "<column>", the value condition N tested and left out as written; the request does not say "<value>", so whether it
  asks for that row is not something Core can find in the row's cells."
- With F1 both playback nos are unsupported, and `unsupported-no.ts` re-asks each once with `recheckWords`:
  - two yeses give `answers`, so the run is `confirmed` and passes;
  - one yes beside a still-unsupported no goes to the lone-yes confirmation;
  - otherwise the outcome is `unsure`, so the run is `unverified`. That is still not a pass, but nothing is refuted
    and no repair runs.
- How likely a yes is on recheck is unverified. Its only evidence is that T2's split recheck (0045) said yes on the
  same evidence.
- Judgement call: a true no in this shape is no longer located on its own, for example a list that misses a member
  when the request defines the set by a property. It would be re-asked, and it would end unsure, not refuted. Where
  the request names the values, F1 locates the defect as today.
- To check before building: whether the read account exposes the condition's structured `field`/`equals` list next
  to `leftOutOnlyByThis`, or only its rendered `condition` text. I did not check.
- Regression test (`located-defects/tests/`):
  - A read with condition 1 `club equals ["A Club", "B Club"]` left out, alone, a row labelled "Ann Lee" with cells
    `{club: "C Club"}`.
  - The request is "every post in a club I belong to".
  - The no: `asked_missing`, row "Ann Lee — C Club", column club, value "C Club", requestWords "every post in a club
    I belong to". It must not be located, and the finding must name condition 1.
  - The same no against the request "every post in A Club, B Club or C Club" must be located.
  - Agreement test (`agreement/tests/`): a double no of the first kind is re-asked. Two re-asked yeses give
    `answers`.

**F2 (policy alternative to F1; Core, `build-yes-hold/held-double-no.ts` `firstAskConfirmed`).**

- Let a build yes reached through the split-no recheck count, when Core's record contradicts part of the first-ask
  no it overturned.
- T2's 0042 named the same rows the playback did. A build yes that beat that exact no once is evidence against the
  playback's repeat of it.
- t664 tightened this rule on purpose. I name it, I do not recommend it.

**F3 (generality, judgement call; Core, the trial feedback or submit check for a read's `where`).** When a read
condition lists literal values that the request does not say, for a column the request defines by a property (in
this run, the groups the person has joined), the trial feedback should say so in generic words. For example: "these
values are what the page shows today; where each row itself shows what makes it one the request asks for, test that
instead."

- It is advice, not a refusal: a request that names its values is unaffected.
- It must never mirror this scenario's words.
- The same rule applies to a judge's `changed` advice. 0033's literal example became the condition.
- Test: a submit whose condition is `club equals ["A Club", "B Club"]`, against the request "posts in clubs I belong
  to", gets the note. The same condition against "posts in A Club or B Club" does not.

**F4 (contributing, small).**

- Bound a read by the request's stated end. This could be a stop at the marker the request names, either as a
  `done when` the read honours or as a condition on the item's position.
- That would keep post-marker rows out of the left-out evidence. I did not check whether `extractList` has such a
  bound today, so this is a design question, not a ready fix.

## 4. UI

- **The ending is wrong about the result.**
  - The chat (32-failure-panel) says "Run failed — it saved 3 rows, but the check found they don't answer what you
    asked, and the fix didn't finish".
  - The toast (32-failure-scenario) says "Couldn't fix your Flow".
  - The 3 rows were exactly right, so "Couldn't fix" tells the user a working Flow was broken.
- **It contradicts itself.** The card just above "Run failed" reads "Check result — Not confirmed: 8 rows would be
  stored … neither no is taken … the run is not marked as failed for it".
  - That card is the repair candidate's round test (8 rows, `group is present`), not the run.
  - Nothing tells the user which result each card is about.
- **Internal words leak.**
  - 20/21-flow-run-panel: "It looked for: Judge call 1: Every post in the home feed …". The "Judge call 1:" prefix
    is Core's internal label.
  - 27-flow-run-panel: during the repair, "The build stopped before the Flow was finished: too many attempts in a
    row went nowhere". The Flow had been finished. It was the repair that stalled.
- **The repair's step cards are confusing.**
  - "Read list — Done (2 times): 7 rows from 1 page" (21, 27): the playback read 2 pages.
  - In the round test (31), "Testing: Next page — Didn't work: it didn't do the same when the test tried it again" is
    shown in red, while `core.log` records the dry run as `ok=true … test=clean`. I did not trace that card.
- **Build ending (16-before-flow-run-panel).**
  - "The subflow was tried on its own and its trial answered yes" next to "checked it with a test run from the
    start": with one subflow these are the same test. This is round 5's fix 7, still open.
  - It shows "Spent $0.03 · 21 calls · 2 tests", which is right for the builder brief.
- **The scenario page is again scrolled sideways** (32-failure-scenario). There is a horizontal scrollbar, the left
  navigation is cut off, and the right rail is drawn over the feed. This is the same as rounds 5 and 6.

## Not verified

- That F1's re-ask would have answered yes. The only evidence is 0045 and the repair judges.
- Whether the read account carries a condition's structured value list, which F1 needs.
- That the T2 trial's stored rows and the playback's are identical by content. It is inferred: the hold stopped
  before `rows_differ`, and both runs stored the oracle's 3 rows by value.
- That Idris Bello's and the Kettle & Crumb post sit after the "You're all caught up" marker. Rosa's does, from the
  packet's page order. Idris's is inferred from the final screenshot and the page-2 item positions.
- The count of rows before the marker (about 41 of 59).
- The red "Next page — Didn't work" card in the repair's round test.
- I did not run the Lab oracle. Its verdict is taken from `evaluation.json`.
