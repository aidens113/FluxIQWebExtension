# Debug: run-mvswewhy-e4e469d4

Status: UNVERIFIED (Lab runner verdict `failed: runtime.behavior`), though the Lab's oracle **passed**. Core built the
Flow, and the Lab's playback stored exactly the oracle's 3 rows. Core's result check on that playback asked 5 calls.
t785 (F1) fired on both playback nos as predicted, and their re-asks split: one came back yes, confirmed by its quote
re-ask, and the other came back as the same no. Core then ended `unsure` (`refutationUnsupported`, basis
`model_disagreed`), without the lone-yes confirmation, because that confirmation cannot be reached from a double no
(section 2). Read-only review, 2026-10-28. No source edit, build, test, live or paid run, model call or commit.

## The run

- Task `social-network-feed-recent-group-posts` (a read: rows, no lasting acts), rerun round 6c, slot 3, lane tree
  `C:/Users/osrs_/FluxStuff/fxwork/t566`. Downstream 85f7d050 and Core 4e2e411c, both clean per `run.json`.
- DeepSeek flash (temperature 0), $0.25 purse, authoring mode `project`.
- Spent $0.0927 over 27 calls (`events.ndjson` seq 33 `runTotal`). By phase, from the step metas:
  - build (0001-0045): 22 calls, $0.0754. The panel shows "Spent $0.07 · 17 calls · 2 tests" for the builder brief;
  - the playback's result check (0055-0059): 5 calls, $0.0173 (`resultChecks.calls: 5`, `status: "unverified"`);
  - no repair, because nothing was refuted.
- Timeline (`core.log`): build 02:08:33 to 02:13:46 (`build end ms=312968 status=proposed`). The Flow was applied
  at 02:13:47. The playback was judged 02:14:50 to about 02:15:15, and the run settled at 02:15:28.
- Launcher log: `live-guard` admitted and recorded the run at $0.0927, with `buildsOverCeiling: 0`. There was no
  balance error and no provider fault.
- `evaluation.json`:
  - `flowCreated: true`, `oracleVerdict: "passed"`, `harnessActivations: 0`;
  - `extraction`: expected 3, observed 3, matched 3, 15 of 15 fields, 0 unexpected;
  - `reportedVerdict: "unverified"`, `automationFailureReported: null`.

**Compared with the previous run (`run-mvskodlp-9966d618`).**

- The build was cleaner. The first submit passed with no `replace_in_repeat` refusal, and T2's yes was first-ask
  confirmed (0042 and 0043 both yes).
- t785 turned a refuted run into an unconfirmed one. There was no `does_not_answer`, no repair, and no "Couldn't fix
  your Flow".
- It did not get to confirmed.

## 1. How far it got

### Exploration (0003-0025)

- 0003-0008: the supervisor ran `web.find_on_page`, wrote the plan and dispatched brief-1.
- 0009-0023: the builder opened the feed, dismissed the cookie, notification and chat prompts, and ran
  `detect_repeating_structure` twice (0013, 0021).
- 0019 and 0023 were reads (`web.inspect.succeeded`).
- 0025: a repeat was refused `llm_evidence_loop.already_answered`, correctly.
- The structure the builder saw (0035's prompt) offers per-row membership signs:
  - a field labelled `button: 'Join group'` (coverage 0.08);
  - a field labelled `text: 'Suggested for you'`;
  - an `svg aria-label` field whose sample is "Shared with Friends". On joined-group posts it reads "Shared with
    Members of …". The page view has 12 such lines, for example `img "Shared with Members of Riverside Allotment
    Society"`.

### Candidates and trials

There is one subflow, so each `core.test_subflow` is the whole run from the start.

| Step | Rev | Read `where` | Offline | Rows stored | Judge calls | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 0027/0029 | 1 | `group is present`, `posted is present` | 0031 refused `no_live_source` | 24 | 0033 no, 0034 no | **no, correct** |
| 0036/0038 | 2 | + `group equals ["Riverside Allotment Society", "Harbourside Runners", "Old Town Bakers' Circle"]`, `posted matches "(19\|20\|21) September 2026"` | 0040 `inconclusive` | **3 = oracle** | 0042 yes (0.72), 0043 yes (0.72) | **yes, first-ask confirmed** |

- **T1's nos were right.** 0033 and 0034 named personal posts, unjoined-group posts (Urban Growers Network, Cycle
  Commuters of Harbourside, the Kettle & Crumb page) and posts dated before 19 September.
- **Where rev 2's literal list came from.**
  - Both T1 judges advised it as their example, against their own prompt's rule. The judge prompt (0033) says: "Where
    the request defines its set by the person's relation to each item, a condition should read the sign of that
    relation each row shows … advise that sign, never a literal list of today's values".
  - 0033 advised "keep only rows whose group is one the person has joined (e.g. Riverside Allotment Society,
    Harbourside Runners, Old Town Bakers' Circle — not suggested groups with a Join group button …)".
  - 0034 advised "(e.g. group is one of Riverside Allotment Society, Harbourside Runners, Old Town Bakers' Circle, or
    better, rows whose group header carries no Join group button)".
- **The builder saw F3's note and kept the list.**
  - 0035's trial feedback ends the advice with: "(Core's note: this advice lists values the request does not say.
    These values are what the page shows today; where each row itself shows what makes it one the request asks for,
    test that instead of listing today's values. This is advice to weigh, not a rule.)".
  - The builder's 0035 decision submitted the literal list anyway, with the summary "Revise the feed read to keep
    only posts from joined groups …".
- 0044: the builder completed rev 2. 0045: the supervisor completed it.
- The build ending (18-before-flow-run-panel) reports "answered yes in its test run from the start".

### The Lab's playback (0046-0054)

- It navigated twice, made three optional clicks, read page 1, moved to the next page, read page 2, and found no
  next page.
- The read saw 59 items, kept 8 and stored 3 after dedupe (`processing: collected 8, duplicates 5, kept 3`).
- The 3 rows are the oracle's, and the Lab matched all 15 fields.

### Core's result check (0055-0059)

| Step | What it was | Verdict | Defects named |
| --- | --- | --- | --- |
| 0055 | first ask, call 1 | **no** (0.7) | `asked_missing` Rosa Delgado / Cycle Commuters of Harbourside, Idris Bello / Urban Growers Network, column group |
| 0056 | first ask, call 2 (cache hit 41,472 of 41,617 input tokens) | **no** (0.8) | the same two |
| 0057 | `unsupported-no` re-ask of call 1, carrying F1's finding | **yes** (0.7), without quotes | none |
| 0058 | exclusion-evidence quote re-ask inside call 1's ask | **yes** (0.6), quoting the request for conditions 3 and 4 | none |
| 0059 | `unsupported-no` re-ask of call 2: **a prompt identical to 0057's** (`diff` is empty, 160,796 bytes each) | **no** (0.6) | the same two, plus two Kettle & Crumb rows (column posted) |

Then the run settled `unsure`, `refutationUnsupported` (seq 33: `status: "unverified"`, `calls: 5`).

## 2. Why the ending is unverified

**F1 fired on both playback nos, as t785 intended.**

- 0057's prompt and 0059's carry Core's finding for each no's two defects, for example: "Core's record of "Rosa
  Delgado — Cycle Commuters of Harbourside — Monday 21 September 2026 at 04:00" holds "Cycle Commuters of
  Harbourside" in "group", the value condition 3 (group equals […]) tested and left out as written; the request does
  not say "Cycle Commuters of Harbourside", so whether it asks for that row is not something Core can find in the
  row's cells."
- So neither no was `supported`, and `unsupported-no.ts` re-asked each once.

**The nos were false on their own packet.**

- The packet's page view and endView show both posts under `"Suggested for you"` and `button "Join group"`, with
  `img "Shared with Public"`. In endView they come after `h2 "You're all caught up"` and `h2 "Suggested posts"`
  (t1580-t1596).
- Joined-group posts show `img "Shared with Members of …"`. The final screenshot (24-failure-scenario) shows Idris
  Bello's post under "Suggested for you" with "Join group", and Kettle & Crumb's with "Follow".
- 0057 read this correctly: "both shown with Join group buttons, so not joined … The literal group list is a
  fragility, not a defect of this result". That is the prompt's relation-sign rule, applied.
- 0055, 0056 and 0059 instead asserted membership ("joined-group posts from Cycle Commuters of Harbourside"). They
  argued from the literal list ("Condition 3 hardcodes only three group names").
- The same prompt at temperature 0 gave yes in 0057 and no in 0059. So the outcome is a draw between two readings of
  one packet, and the packet does not invite the misreading less than before. The membership sign is only in the
  page view, 59 items deep. It is in no left-out cell, because the Flow does not read it.

**What the re-asks did, through `agreement/unsupported-no.ts`.**

1. `nos = [1, 2]`, and both nos are unsupported, so each is re-asked.
2. Call 1's re-ask is 0057 yes, then 0058 yes (the quote re-ask inside the same `ask`). The answer is a model yes,
   so call 1 is not in `notTaken`.
3. Call 2's re-ask is 0059's no.
   - Its Rosa and Idris defects are F1-unlocated again.
   - Its Kettle & Crumb defects name rows "Kettle & Crumb — Sunday 20 September 2026 at 01:40 — …". Core's record
     labels those rows `18 comments` and `40 comments` (`leftOutOnlyByThis: "18 comments — group: Kettle & Crumb"`),
     so `rowsNamed` matches no label. The read's stop is `ended`, so the defect is "no record". This is inferred: the
     verdict shows the no was unsupported, and no other branch fits.
   - So `notTaken = {2}`.
4. `standing` is none, and `yes` is call 1's.
5. The lone-yes confirmation is guarded by `if (yes && nos.every((call) => notTaken.has(call)))`. Call 1 is a no
   that turned yes, so it is not in `notTaken`, and the guard is false. **No confirming ask was made.**
6. The outcome is `unsure`, basis `model_disagreed`.

**The previous debug's prediction was wrong about the code.** It said "one yes beside a still-unsupported no goes to
the lone-yes confirmation". In a double no, every yes can only come from a re-asked no, and that call then leaves
`notTaken`. So `nos.every(notTaken.has)` and `yes` can never both hold, and the confirmation is reachable only from
a split (one first-ask yes and one no).

**The build-yes hold did not take part.** `held-double-no.ts` acts only on an outcome of two agreeing nos (basis
`model`). This outcome was already unsure. The hold also "never makes a yes", so it could not have confirmed the run
either. T2 being first-ask confirmed changed nothing.

**So the remaining blocker is, in order:**

1. **Core's rule (decisive):** the lone-yes confirmation is unreachable in the double-no path. The run held one
   re-asked yes that was quote-confirmed (0057, 0058) beside one no that Core twice found ungrounded (0056, 0059).
   That is the same shape t771 confirms in a split, and here nothing was asked.
2. **The judge's reading (contributing):**
   - three of the five calls invented membership that the packet contradicts;
   - the prompt already carries the relation-sign rule, and 0057 followed it;
   - more prompt words are unlikely to settle a coin-flip reading. Evidence in the cells would (fix 4).
3. **The Flow (contributing, and a real defect of generality):** the literal group list and the three-day date
   regex are what every no argued from. See fix 4.

## 3. The fix

**Fix 1 (decisive; Core, `runtime/result-verification/agreement/unsupported-no.ts`).** Make the lone-yes
confirmation reachable from a double no whose re-asks split.

- Change the guard from `yes && nos.every((call) => notTaken.has(call))` to `yes && taken.every(modelYes)`, which
  means every call Core takes is a yes and every other call is a refused no.
- Ask `CONFIRM_LONE_YES` in a refused no's place: `[...notTaken.keys()][0]`, not `nos[0]`. In a split these are the
  same call. In this run it is call 2, while `nos[0]` would be call 1, the yes's own call.
- A second yes then stands as two yeses (`agree(yes, confirming)`). Any other answer leaves the outcome unsure, as
  today.
- This weakens nothing:
  - the confirming words are Core's neutral ones ("Judge it once more from the evidence alone … Answer yes only after
    checking every requirement");
  - a no that names a defect Core finds still stands (`standing`);
  - a double no whose re-asks both stay ungrounded asks nothing and stays unsure (the existing test
    `tests/reask-route/tests/lone-yes-route.test.ts` "a double no Core refused every defect of (t771)").
- **Judgement call:** the yes here was reached through Core's recheck words ("named no defect Core can find"), not
  on a first ask. It also had to pass the quote re-ask (0058) and would need the neutral confirming ask, so it is
  three yes answers against two nos Core could not ground. This is the same evidence standard t771 accepted for a
  split. Lead decision.
- With fix 1, this run would have made a 6th call. Whether it would have said yes is unverified: 0057 and 0059 show
  this packet draws both ways.
- **Regression test** (`agreement/tests/membership-reask.test.ts`, on the club-posts fixture):
  - both first asks return `TESTED_CLUB_NO`;
  - the first recheck returns `CLUB_POSTS_YES`;
  - the second recheck returns `TESTED_CLUB_NO` again;
  - the request carrying `CONFIRM_LONE_YES` returns `CLUB_POSTS_YES`;
  - expect `verdict: "answers"`, the confirming ask on call 2, and `FailsRun` false. A twin case whose confirming
    ask returns the no must expect `unsure`, `code` `refutationUnsupported` and `unsupportedNo.calls: [2]`.

**Fix 2 (small; Core, the same file, the `reason` text).** The single-no reason reads "Asked once more to list each,
it named one, so that no is not taken" (the template is `${both ? "neither" : "it"} named one`). The singular branch
says the opposite of what happened. It should read "it named none". Test: the single-no reason contains "it named
none".

**Fix 3 (latent refutation path; Core, `located-defects/located-defects.ts` with `tested-value-only.ts`; judgement
call).** An `asked_missing` defect quoting a column that the row's only left-out condition did not test is located
today if the cell holds the value.

- This run escaped only because the Kettle & Crumb rows' labels ("18 comments") did not match 0059's names. Had they
  matched, the `posted` cells hold the quoted dates, so the defect would have been located, the no supported, and the
  run refuted.
- It also bites the general Flow of fix 4. Suppose condition N tests an audience mark. A false no quoting the row's
  `group` cell would be located (`askedCellNotFound` finds the group name, and F1 needs the same column and an
  `equals`), and the same misreading would refute.
- Rule: where a row was left out by one condition alone, a defect is located only if its column is that condition's
  column. Otherwise Core's words, naming no site, are along these lines: "Core's record of <row> was left out only by
  condition N (<wording>), which tests "<col>"; the defect quotes "<other col>", which condition N did not test, so
  it does not show why condition N should keep that row."
- The no is then re-asked as today. A true defect stays locatable by quoting the tested column's own value. F1 still
  covers the case where that value is only the rejected value of an `equals` list.
- Trade-off: a true no that quotes only another column (for example, a condition the request never asks for) ends
  unsure, not refuted, until its re-ask quotes the tested column.
- Test (`located-defects/tests/`): a read whose condition 1 `club equals ["A Club", "B Club"]` alone left out "Ann
  Lee" with cells `{club: "C Club", posted: "3 May"}`; the no is `asked_missing`, column posted, value "3 May". It
  must not be located, and the finding names condition 1. The same row quoted by column club with a value the
  request says must be located.

**Fix 4 (the Flow's generality; Core builder vocabulary and guidance; judgement calls).** This Flow is genuinely not
general, though it is right on today's data.

- **Group list.** Suppose the person joined a fourth group. Its posts would carry "Shared with Members of <group>"
  and no "Join group", and condition 3 would leave them out, which is a true `asked_missing`. Suppose they left a
  group. Its posts would show "Join group" and still be kept, which is a true `kept_not_asked`. The request defines
  the set by the person's relation ("groups I'm a member of"), so the right Flow tests each row's own sign. That is
  `svg aria-label startsWith "Shared with Members of"`, or the "Join group" field `is absent`. The structure offered
  both.
- **Date regex.** `posted matches "(19|20|21) September 2026"` drops every post dated 22 September or later, but the
  request says "on or after Saturday 19 September 2026". The `where` vocabulary has no date bound
  (`flow-bootstrap/plan/flow-script-format.ts` `AUTOMATION_STUDIO_FLOW_CONDITION_RULES`: presence, number and text
  only, although `sort` takes `as: date`). So the builder had no general way to write it. 0059 objected to this too.
  - Fix 4a: a date comparison in `where`, for example `{"field": "posted", "atLeast": "2026-09-19", "as": "date"}`,
    through the processing vocabulary (`@fluxiq/contracts` `processing-vocabulary.ts`), the domain item condition,
    the shared reader and the script format, with tests. This is a contract change across Core and downstream.
  - Judgement call: size and priority.
- **The sign advice.** The relation-sign rule in the judge prompt and F3's note at the builder were both present and
  both lost to an "e.g." list.
  - Fix 4b: give the builder a concrete, Core-computed alternative where the note fires. For example, name the
    read's structure fields whose value differs between the rows the list condition kept and those it left out
    ("field <label> reads "<prefix>…" on every row this condition keeps and on none it leaves out"). Generic, naming
    no site.
  - Judgement call: it is a design question. Core holds the structure's samples, and I did not check whether it
    holds per-item values for every field.
  - It stays advice, not a refusal: a request that names its values is unaffected.
- **Why this matters for confirmation too.** With the sign read as a column, every left-out row's cells would show
  "Shared with Public" beside its group. The judges would no longer have to dig through 59 page-view items, and the
  "hard-coded list" objection behind every no would be gone. That requires fix 3 first, or the general Flow refutes
  on the same misreading.
- Product behaviour the user should get: a Flow that keeps the joined-group posts by their own mark and the date by
  comparison, so it is correct tomorrow as well as today. The Lab cannot see this, because the oracle checks one
  fixture state. Optional, judgement call: a fixture variant with a fourth joined group or a later post, under the
  realistic-task rule. It would change the task's fixture, never weaken its oracle.

**Still open from the previous debug.**

- F4 there: the read pages past the request's own end. The Flow has `done when: text t1748 contains "You're all
  caught up"`, yet it read on to "No more posts to show right now". Rosa's, Idris's and Kettle & Crumb's rows, which
  every no named, all lie after that marker in the page view.
- The Kettle & Crumb rows are labelled by their comment count (`18 comments`), which no judge can name them by.

## 4. UI

- **Ending (23/24-flow-run-panel, "Check of the run's result").**
  - It says: "Not confirmed: 3 rows came back. This result was checked with the same evidence, and a check answered
    that it does not do what was asked without naming a defect Core can find … Asked once more to list each, it
    named one, so that no is not taken. Neither answer counts for more than the other, so the result is not
    confirmed, and the run is not marked as failed for it."
  - It is honest that nothing is wrong and nothing was repaired, an improvement on the previous run's "Couldn't fix
    your Flow".
  - Wrong: "it named one" is fix 2's bug; it means "named none".
  - It is long and internal for a person ("a defect Core can find in its own record of this run"). It never says that
    the other check, asked twice, answered yes, or which rows came back.
- **Build ending (18-before-flow-run-panel).**
  - It shows "Built Collect group posts from the home feed — The subflow, which is the whole Flow here, answered yes
    in its test run from the start" and "Spent $0.07 · 17 calls · 2 tests". That is round 5's fix 7, now worded
    right.
  - "Left on the site: The build ran the step "close the chat window if it shows", which changed the page and might
    have left something behind". Closing a chat window is not a lasting act, so this warning is noise.
- **Playback (19-22).** The cards "Read list — Done", "Records saved" and "Next page — Done" repeat in pairs, and the
  status line says "The list ended after 2 pages". They are accurate, and no internal "Judge call 1:" prefix showed
  in the panel shots I read (18, 21, 23, 24).
- **Scenario tab (24-failure-scenario).** The left navigation is intact this time. A horizontal scrollbar still
  shows under the right rail.

## Not verified

- That fix 1's confirming ask would have answered yes. 0057 and 0059 got an identical prompt and answered opposite
  ways.
- Which `located-defects` branch refused 0059's Kettle & Crumb defects. I inferred a label mismatch from
  `leftOutOnlyByThis` and the unsure verdict, because Core does not write `unsupportedNo` findings into the run's
  files.
- That 0058 was the exclusion-evidence re-ask inside call 1's `ask` and not a separate ask. I inferred it from its
  prompt (the recheck plus "Your affirmative judgement lacked required exclusion evidence") and from the five calls.
- Whether Core holds per-item values for every structure field (needed by fix 4b).
- That the playback's rows and T2's are identical by content. Both match the oracle by value.
- I did not run the Lab oracle or any test. Verdicts are from `evaluation.json` and `events.ndjson`.
