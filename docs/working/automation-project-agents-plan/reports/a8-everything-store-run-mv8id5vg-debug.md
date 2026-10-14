# A8 launch 8: everything-store `run-mv8id5vg-ed7b89fe` debug

Read-only investigation. Core at `9b4c5a38` (the checkout's HEAD `3c176900` differs only in two docs files, so the
source read is the source that ran). No model provider was called. The offline replays below ran Core's own compiled
modules from `fxwork/t567/!FluxIQ/packages/fluxiq/dist` against the recorded judge requests and replies.

## Outcome

Done. **The builder had the right answer 3.5 minutes into the build, and Core never accepted it.** Revision 3 of
`find_earbuds` stored exactly the oracle's 13 records, in the oracle's order, at 19:42:55. From then on, 12 trials
(8 by the builder, 4 by the repair) each stored those exact 13 records. 48 judge calls answered "yes" on them, and
every one was held as `core.result.exclusion_evidence_missing`. Each trial came back `not_judged`, so no revision
could complete. The builder kept rewriting a correct subflow until the repeat guard stopped it. The repair re-authored
it, reached the same correct answer and was held the same way. The 30-minute bound's work deadline (25:00) ended the
build. The person was told "the supervisor ended it because it could not finish the Flow", which is not why it ended.

## Timeline (UTC, 2026-10-14)

| Time | Elapsed (build clock) | What happened |
| --- | --- | --- |
| 19:33:59 | - | Lab start; prelude 104.6 s (extension rebuilt) |
| 19:38:04 | - | Chat turn, `flow.createHere` |
| 19:38:05.504 | 0:00 | `build start`, so the supervisor clock starts (`supervisor-loop.ts:113`) |
| 19:38:05-11 | 0:00-0:06 | Supervisor: `read_task`, `write_plan`, `dispatch` of one build brief (`find_earbuds`) |
| 19:38:12-19:39:10 | 0:07-1:05 | Builder explores: navigate, Decline banner (first try `target_covered`, then OK), search, detect structure, inspect, recall; submits rev 1 |
| 19:39:11-19:40:20 | 1:06-2:15 | Trial 1 (rev 1): 15 rows, both ear-tip and charging-case accessories kept, so **no** (correct) |
| 19:40:24-19:41:36 | 2:19-3:31 | Rev 2, trial 2: 10 rows, the 3 earbuds sold with a charging case dropped, so **no** (correct; judge 37 wrongly said yes, judge 36's no carried it) |
| 19:41:39-19:42:55 | 3:34-4:50 | **Rev 3, trial 3: 13 rows, exact oracle match, `not_judged`** (4 judge calls, all yes) |
| 19:42:57-19:53:59 | 4:52-15:54 | Rev 3 retest, revs 4, 5, 8, 9 and 10: 7 more oracle-exact trials, all `not_judged`. Revs 6 and 7 regress (rev 7: name must contain "earbuds", 15 rows, **no**, correct). Two `already_answered` and one `unchanged_submission` refusal along the way |
| 19:54:02-19:54:10 | 15:57-16:05 | Three identical `submit_subflow` calls refused `llm_evidence_loop.repeat_refused (same_answer)`, so the builder stalls: `flow_bootstrap.evidence_repeat_without_progress`. Brief returns partial: 75 calls, $0.0896, proposal rev 9 |
| 19:54:10-12 | 16:05-16:07 | Supervisor dispatches a **repair** brief with `failingReceipt` = the last `not_judged` trial (t595 worked) |
| 19:54:12-19:54:54 | 16:07-16:49 | Repair re-explores (navigate, 3 detects, inspect) and re-authors from scratch; rev 1, then an unchanged resubmit |
| 19:54:55-19:56:14 | 16:50-18:09 | Repair trial (rev 1): 10 rows, the case-included earbuds dropped again, so **no** (correct) |
| 19:56:17-20:02:05 | 18:12-24:00 | Repair revs 3 and 4: 4 oracle-exact trials, all `not_judged` (16 judge calls, all yes) |
| 20:02:06-20:02:11 | 24:01-24:06 | Repair completes `{subflowKey, revision, digest, ended:"partial", reason}`: refused `subflow.ending_shape` **three times** |
| 20:02:12-20:03:05.880 | 24:07-25:00.4 | Repair tests rev 4 again; the trial is aborted with `TimeoutError` at the **work deadline** (30 min minus 5 min ending reserve) |
| 20:03:05.937 | 25:00.4 | Dispatch returns: repair partial, "The build was stopped before this brief finished" (37 calls, $0.0370) |
| 20:03:05.988 | 25:00.5 | `build throw ms=1500484`: `flow_bootstrap.post_provider_validation_failed`, issues `project.build_time_limit`, `project.build_blocked`. No reset was dispatched (nothing undoable). The ending took about 50 ms |
| 20:03:06.7 | - | Chat ended; Lab verdict `failed`, `lab.chat_build_failed`; $0.1296, 116 calls |

Where the 25 minutes went: 16 trials at 67-94 s each (median about 77 s, roughly 16 s of it judges) is about 20.5 min.
Exploration was about 1.6 min, and decisions the rest.

Spend: builder decisions $0.0360 (37), builder judges $0.0537 (38), repair decisions $0.0158 (19), repair judges $0.0212
(18), supervisor $0.0028 (3). **Judges were 58% of the money and 56 of 115 calls.**

## (1) What the builder tried across its 75 calls

37 decisions plus 38 judge calls. Pages: the search results, read across all 5 pages by a `repeat while: next` read with
`where` conditions (Plus present, sponsored absent, rating at least 4, price under 50, plus an accessory-name
exclusion). Paging was correct on every trial: `pagesRead 5, stop ended`, 94 items seen.

Every trial's stored rows compared with the oracle (`plus-under-fifty.ts`, computed from the compiled scenario):

| Step | Rev | Rows | Against the oracle | Core verdict | Judges (yes/total) | Were the judges right? |
| --- | --- | --- | --- | --- | --- | --- |
| 29 | 1 | 15 | +2 accessories (ear tips $12.99, charging case $24.99) | no | 0/2 | yes |
| 35 | 2 | 10 | -3 earbuds sold with a charging case (Lumo Audio Drift Pro, Aurelle Pods Fit ... with Wireless Charging Case, Trevio T5 Rose Gold) | no | 1/2 | split; the "no" was right |
| 41, 47 | 3 | 13 | **exact** | not_judged | 4/4, 4/4 | yes (held) |
| 55, 61 | 4 | 13 | **exact** | not_judged | 4/4, 4/4 | yes (held) |
| 69 | 5 | 13 | **exact** | not_judged | 4/4 | yes (held) |
| 81 | 7 | 15 | +2 accessories | no | 0/2 | yes |
| 87, 97, 109 | 8, 10, 9 | 13 | **exact** | not_judged | 4/4 each | yes (held) |
| 138 (repair) | 1 | 10 | -3 earbuds with case | no | 0/2 | yes |
| 144, 150, 160, 166 (repair) | 3, 3, 4, 4 | 13 | **exact** | not_judged | 4/4 each | yes (held) |

**Judge verdict (t574 evidence):** the judges were right 55 times out of 56. The one wrong call is judge 37 (a "yes" over
the 10-row result that dropped earbuds sold with a case); agreement overruled it. Judge 45 doubted whether the two
Aurelle Pods Fit Ivory listings were one pair, but still said yes; the oracle holds both, so yes was right.

**What repeated, and why.** Each `not_judged` trial ran four judge calls: the first call, its exclusion recheck, the second
call, and its recheck. Core's offline replay (`automationStudioResultLeftOutRowsUnquoted` from the compiled dist, fed
each recorded reply and its own request's `resultSummary` and instructions) reproduces every live hold. On every yes,
some of these rows were still "unquoted": condition 1 (Plus present) had 8 rows left out by it alone, all
`plus: (no value)`; condition 2 (sponsored absent) had 4; and the accessory-name condition had 2. The best recheck
(step 73) still left 6 of the 8 Plus rows unquoted. The judges argued per condition ("the 8 rows left out only by
condition 1 carry no Brightaisle Plus value, so the request's words "Brightaisle Plus eligible" exclude each of
them"), or gave two "e.g." rows. Core counts a row as named only by its distinguishing prefix. Here that prefix is
**10-12 words** for 6 of the 8 Plus rows (for example "tessaro arc wireless earbud bluetooth 5 3 headphone with 48h playtime
built"), because the store's labels share long prefixes, and the left-out labels carry no id.

The builder could not see any of this. A `not_judged` result gives only "The checks did not provide the required
exclusion evidence". The instruction says "Test it again, or change and resubmit it if the feedback names a cause in the
subflow" (`subflow-trial-gate.ts:72`). The builder read "exclusion" as its accessory condition, and its summaries say
so. Revs 4-11 are all rewrites of a correct accessory regex. Rev 7 regressed to "name contains earbuds", and revs 9-11 were
resubmitted until the repeat guard ended the brief. The retest allowance (`retestsLeft`) was never exhausted.

## (2) Did the repair receive its failing trial (t595)?

Yes. The supervisor's `dispatch.2` named `failingReceipt` `subflow-trial.ba8eb051…`, and the repair's first prompt holds
`repairOf` with `verdict: not_judged` and the full `said` (stored 13, reads, conditions, paging). But a `not_judged`
trial gives a repair nothing to fix: it does not say that every judge answered yes. The repair also did not get the
builder's standing script (rev 9), only the receipt and its feedback. So it re-explored (5 calls, 38 s) and
re-authored. Its rev 1 repeated the builder's rev-2 mistake (10 rows). It reached the exact 13 rows at rev 3 and was
held 4 times. Then it tried to end honestly, and that was refused 3 times (see `subflow.ending_shape` below).

## (3) Timing, the bound, the honest ending and the reset

- **The 30-minute bound stopped it, at its 25-minute work deadline.** `supervisor-loop.ts:127-133` (`startClock`)
  aborts `work` at `maxMs - endingMs` = 1,800,000 - 300,000 ms. The build threw at `ms=1500484`, 25:00.5 after
  `build start`, and the in-flight repair trial threw `TimeoutError` at 25:00.4. The Lab did not cut it short:
  `secondsToEnding` was 1502.6.
- **The honest ending (t592) ran.** `timedOut` was set (`supervisor-loop.ts:189`), an ending was recorded, and the failure
  carries `project.build_time_limit` plus `project.build_blocked` (`service/project-build/run.ts:182`). The outcome is
  `blocked`, not `partial`, because `state.anyDone()` (`project-agents/supervisor/state.ts:212`) counts no done brief,
  although correct proposals stood. The recorded reason says "reached its time limit of 30 minutes"
  (`supervisor-loop.ts:199`, `spoken(clock.limit.maxMs)`), but the work stopped at 25.
- **The reset (t586) was correctly skipped.** The dispatch reports `lastingActsInPlace: 0`. `resetBeforeEnding` returns
  early on `!left.undoable` (`supervisor-loop.ts:262-266`), and "Nothing this build did is still on the target" is
  true. The 5 minutes reserved for the ending went unused: the ending took about 50 ms.

## (4) Comparison: a single-agent candidate build

- The brief's `run-mv4v1v25-c7d57567` **did not pass**. It is verdict `failed`, "it ran out of time", after 6 trials (2 no,
  4 unsure): 30 decisions and 12 judge calls over 8.6 min of build. I noted it as a contradiction (below) and also
  profiled a real pass.
- The last passing candidate build of this task is `run-mv6p75tm-3bf4e2c1` (2026-10-13, 13:09Z). It took **18 decisions,
  8 judge calls and 3 trials** (no, no, yes), and passed about 6 min into the build (13:13:16 to 13:19:19). The 7
  passing candidate runs of this task (`mv5tusi6`, `mv5yaapy`, `mv66s8yl`, `mv6eq0m8`, `mv6i27oi`, `mv6itasw`, `mv6p75tm`)
  are **all from before t515** (`3d3e569c`, 2026-10-13 17:08Z), which introduced the row-by-row quote rule
  (`request-rows/unquoted-rows.ts`). No run of this task has passed since. All seven project runs on 10-14 failed,
  including `run-mv7vor5f-ea4d08b4`, which t574 itself cites as storing exactly the 13 rows.
- So the project build is not what failed this run. The builder spent its calls the way a candidate build does:
  explore about 10 calls, then submit and trial. It reached the right result after 3 trials, as the passing candidate
  did. The difference is that its yes could not be confirmed.

## (5) What the person was told

From the final panel (`61-failure-panel.png`): a "Partly repaired Find eligible wireless earbuds — The build was stopped
before this brief finished" row, a Return card ("Spent $0.04 · 37 calls · 5 trials"), "The supervisor ended the build: it
could not finish the Flow. — Nothing this build did is still on the target.", and then "The build failed: the supervisor
ended it because it could not finish the Flow. The Flow "Find every pair of wireless earbuds in the store's search
results that is..." has no steps yet, but it keeps your instruction, so you can build it again."

This is wrong in two ways. The time limit ended the build, not the supervisor: `conversations/commands/progress.ts:190-198`
has no words for `project.build_time_limit`, so `supervisorEndingWords` picks `project.build_blocked`, and the chat row
uses `ENDED_WORDS.blocked` (`service/project-build/run.ts:200-203`). And nothing says that a version was tested 12 times
with a result that could not be confirmed, which the candidate build's ending does say ("A version of it was test-run
from the start 6 times, and the last test run could not be confirmed").

## Root causes (Core, `packages/fluxiq/src/programs/automation-studio/runtime/`)

1. **A correct yes cannot be confirmed when a presence condition leaves out many rows with similar labels.**
   - `result-verification/value-readings/settled-rows.ts:49,60-66`: `numericOnly` settles only numeric bounds. A presence
     row Core itself read as `(no value)` (here 8 rows), or one an `absent` condition left out (4), is not settled.
   - So `result-verification/request-rows/unquoted-rows.ts:70-77` demands that each of those rows be named beside a
     quote.
   - And `request-rows/row-naming.ts:17-31` names a row only by a prefix unique among the read's 46 labels: 10-12 words
     here, with no id in the label.
   - `result-verification/verdict.ts:170-179` turns each such yes into `exclusion_evidence_missing`.
     `result-verification/agreement.ts:126-132` makes the two calls unsure. `result-verification/build-test/judge.ts:272`
     reports `not_judged`, and `service/candidate-trial/feedback.ts:204` passes it on.
   - The recheck (`result-verification/exclusion-evidence/recheck.ts:18-28`) passed 0 of 24 times.
   - This is the same failure t574 was meant to fix (`run-mv7vor5f-ea4d08b4`), back in a new shape: t574 settled the
     numeric rows, and the presence rows remain.
2. **A `not_judged` result tells the builder to change a correct Flow.**
   - `flow-bootstrap/subflow-candidate/subflow-trial-gate.ts:72` (and `flow-bootstrap/candidate/trial-gate.ts:127`) say
     "change and resubmit it if the feedback names a cause". The feedback's `why` reads like a cause, and the result
     never says that every call answered yes.
   - Cost: 7 needless revisions, one regression, and the repeat-guard stall.
3. **The builder's honest ending contradicts its own completion schema.**
   - `flow-bootstrap/subflow-candidate/builder-loop.ts:256` allows `subflowKey`, `revision`, `digest`, `ended` and
     `reason` in one object.
   - `builder-loop.ts:230` refuses any key besides `ended` and `reason`.
   - The repair's well-formed partial ending was refused 3 times, and its next act was killed by the deadline.
4. **The person is told the wrong ending.** See (5): `progress.ts:190-198` and `service/project-build/run.ts:200-203`.

## Verdict on each guard, refusal and judge

| Item | Verdict |
| --- | --- |
| Judges (`loop_verification`) | Right on 55 of 56 calls; all 48 oracle-exact yeses were right |
| Exclusion-evidence rule (t515 quote rule, t574 settlement) | **Wrong outcome**: held 48 correct yeses on 12 oracle-exact trials. Root cause 1 |
| Exclusion recheck | Ineffective: 0 of 24 rechecks passed; it lists 14 full labels and asks for a quote beside each |
| Agreement split on trial 2 | Right: no plus yes came out no |
| `trial_not_judged` instruction | Misleading: invites changing a correct subflow. Root cause 2 |
| `candidate.unchanged_submission`, `llm_evidence_loop.already_answered` | Right |
| Repeat guard (`repeat_refused same_answer`, then `evidence_repeat_without_progress`) | Right as a guard (identical resubmits), but it ended a brief whose proposal was correct, because nothing upstream could confirm it |
| `subflow.ending_shape` | **Wrong**: schema and check contradict each other. Root cause 3 |
| Repair carries failing trial (t595) | Worked, but a `not_judged` receipt gives a repair nothing to fix, and the standing script is not carried |
| 30-minute bound (t592) | Fired as designed at the 25:00 work deadline; ending recorded with the right issue codes. The 5-min reserve sat idle with nothing to undo, and the reason says 30 min |
| Reset before ending (t586) | Correctly skipped (no lasting acts) |
| Person-facing ending | **Wrong reason** ("the supervisor ended it"). Root cause 4 |

## Recommended fixes

All of these are mechanical Core checks or Core wording. None adds model guidance shaped like any scenario's task, site
or items.

1. **Settle presence and absence rows Core measured** (`value-readings/settled-rows.ts`). For a row an `is: present`
   condition alone left out, on which Core's read found no value, and for a row an `is: absent` condition left out on which
   it found one, treat the row as measured, exactly like a numeric bound. Route it through `boundUnquoted`
   (`unquoted-rows.ts:88-98`), so that one quote of the request beside a sentence naming that condition covers all its
   rows. Replayed here, that clears 12 of the 14 rows.
2. **Make rows nameable by a short id.** Where the read stored a url or id column, append a short distinguishing token to
   each `leftOutOnlyByThis` label (`read-account/alone-rows.ts`). `row-naming.ts` already accepts a 6-character id, so a
   judge can then name 2-4 text-condition rows without 12-word prefixes.
3. **Say "every call answered yes" on a hold.** When every call answered yes and only the exclusion evidence was missing,
   say so in `feedback` (for example `answeredYes: 2 of 2`, with `code: core.result.exclusion_evidence_missing`). Change
   the `not_judged` instruction (`subflow-trial-gate.ts:72`, `trial-gate.ts:127`) to say that no change to the Flow is
   asked for in that case. Carry the same to the supervisor's return and to the repair's `repairOf`.
4. **Bound the loop where the judges keep agreeing.** The same digest's result held N times with every call yes should
   end in Core's own words, not in builder rewrites. Ending as "partial: result found but not confirmable" would let the
   supervisor end honestly and tell the person the truth.
5. **Honest ending shape** (`builder-loop.ts:230`): accept an ending that also carries receipt keys matching the latest
   proposal, or drop them. Alternatively, make the `completionSchema` at `:256` a `oneOf` of receipt or ending.
6. **Person wording.** Add `project.build_time_limit` to `progress.ts`, ahead of the supervisor-ending words: "it reached
   its time limit of 30 minutes". Give `run.ts` `ENDED_WORDS` a timed-out form. Count a brief with a standing,
   repeatedly tested proposal as partial rather than blocked, and say how many times a version was tested and not
   confirmed.
7. **Smaller fixes.**
   - Have the repair brief carry the subflow's standing script beside its failing receipt.
   - When nothing is undoable at the work deadline, let the work run nearer the bound.
   - Have the recorded reason say the stop came at the working deadline (25 of 30 minutes).

## Commands run and observed results

- Read `steps/index.md`, every `meta.json` (timeline above), the trial `call.json`/`result.json` files, and the judge
  `decision.json`/`request.txt` files. Read `logs/core.log` (build-trace lines quoted above) and `summary.json`, the
  test-run `events.ndjson`, and the final panel screenshot.
- `node oracle.mjs` (scratchpad `a8dbg/`, imports the compiled `plus-under-fifty.js`) printed 13 oracle records.
- `node cmp.mjs` printed, for every trial, rows against the oracle: 12 `ORACLE-EXACT` and 4 wrong (table above).
- `node replay.mjs` ran Core's compiled `automationStudioRequestWording` and `automationStudioResultLeftOutRowsUnquoted`
  over all 50 yes replies. Every yes still had unquoted rows (condition 1 x6-8, condition 2 x2-4, name condition x2), which
  matches the live `not_judged` on every trial.
- `node naming.mjs` printed the distinguishing prefixes (10-12 words for 6 of 8 Plus rows; no ids).
- `git log --grep` dated t515 at `3d3e569c` (2026-10-13 17:08Z), t574 at `316b3604`, t592 at `e99510e2` and t595 at
  `d24d62af`.

## Not verified

- The offline replay covers the unquoted-rows check only. I did not replay the whole `automationStudioResultVerdict` or
  the agreement, but its outcome matches every live verdict.
- I did not read the build record's stored ending text, which is under `.fluxiq`. Its reason is inferred from
  `supervisor-loop.ts:199`.
- I did not check the final cart state against the oracle's `cart-count = 2`. The build reports no lasting acts.
- I have not checked whether fix 1 alone would have passed: the 2 accessory rows still need row-level quotes, which fix 2
  addresses.

## Open questions and contradictions

- The brief calls `run-mv4v1v25-c7d57567` "an earlier passing candidate build". It failed ("it ran out of time").
  `run-mv6p75tm-3bf4e2c1` is the latest real pass.
- No candidate-mode run of this task has run since t515, so I cannot say whether a single-agent build passes under the
  current rule. The project-mode evidence (7 of 7 failures, two of them with oracle-exact results held) suggests it would not.
