# A8 frozen pair 6, candidate towels `run-mvac1av6-f7b0f9e2`: a correct Flow refuted after playback

Read-only debug. Downstream `49b65bc9`, Core `4e51c1da` (checked: the Core checkout is at that commit).
Run bundle: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-15/run-mvac1av6-f7b0f9e2`. Lane `fxwork/t567`
(slot a8-slot-4), task `bigbox-retail-pickup-towels`, mode `candidate`, 76 LLM calls, $0.242.

## Outcome

Done. The cause is **general**. Core's result check refuted a correct playback on two judge
nos. Both nos blamed one pre-read site filter, s10 "4 & up" (Customer Rating). Core's own record
of that step says the page showed **16 results before it and 16 after**, so it removed no row.
Core keeps that measurement and shows it to the judge, but no rule weighs a no against it.
`refuted-no/unseen-row-claim.ts` lets any sentence that blames a step stand ("whether the
narrowing was right is the judge's to weigh"). The t655 narrowing rule covers only an *unsure*
that says the request "does not name" an option. The judge prompt never says what `resultCount`
means. So two nos that Core's measurement contradicts became "refuted". A re-author then spent
48 decisions removing a filter that did nothing, broke the read, and ran out of budget.

## What changed and why

Nothing in the repositories changed. My only write is this report.

### 1. The playback's stored rows against the oracle: exactly right

- Lab evaluation (`evaluation.json` `extraction[0]`): expected 9, observed 9, compared 9, matched
  9 (9 in any order), fields 36/36, no unexpected fields, `oracleVerdict: passed`.
- The 9 stored rows the playback judge saw (step 0059 request) are identical to the rows the build
  trial judge accepted (step 0043): the md5 of the 9 names and of the 27 price, unitPrice and rating
  lines match.
- The read account matches too: 2 pages, list ended, 22 rows seen, 7+2 kept, the same five
  conditions and the same left-out rows. The `narrowedBefore` steps match as well: s8 ValueRidge
  32→23, s9 Today 23→16, **s10 "4 & up" 16→16** in both. The two requests differ only in node-id
  prefixes (`173d9b45…` in the trial, `176ddb18…` in the saved Flow), in `startView` (trial only),
  in `policyGates` (playback only), and in two counts the playback lacks (s1 `effect`/`before`,
  s9 `after`). The system prompts are identical.
- During playback, s10's check needed retries. Step 0052 failed with `web.target.not_found`, step
  0053 with `output_not_observed`, and step 0054 succeeded. This is the built-in retry working and
  is unrelated to the refutation.

### 2. The judge calls on the playback result, and how Core reached "refuted"

Path: `result-verification/run-outcome.ts` `runVerification` → `verify.ts`
`verifyAutomationStudioRunResult`, without `confirmAnswer`, which is the runtime result check →
`agreement.ts`.

| Step | Answer | What it claimed |
| --- | --- | --- |
| 0059 | `answersRequest: no`, patchNeeded, confidence 0.8 | `observed`: "the read ran after s10 chose the site's "4 & up" rating filter, which keeps only 4.0-4.4 rated items too … Rows rated 4.0-4.4 that the request wants are missing though no left-out row names one." `changed`: "Remove or replace node.bootstrap.176ddb18abf9a33d.main.s10 … redundant and narrower than the request." Its own `summary`, written after the verdict, argues the opposite and ends "So all narrowing steps are correct … Final answer: yes." |
| 0060 | `answersRequest: no`, confidence 0.7 | "the pre-read filter …s10 chose "4 & up (32)", which keeps 4.0-4.4 items the request excludes … the site filter is broader than the request … the result is therefore not exactly what the request asks for". `changed`: remove or replace s10. 20,352 of its 20,513 input tokens were cache hits, so it is the first call repeated. |

Both nos name exactly one defect: a step whose words are *broader* than the request's bound. The
prompt itself calls that correct, since only a step that "keeps less than the request asks" earns
a no. Core's record also says the step removed nothing (16→16).

How Core combined them (`agreement.ts` header and `verify.ts:210-228`):

1. The first call said no, so `automationStudioResultVerificationAskAgain` asked a second call
   with the same evidence.
2. Two agreeing nos refute (`agreement.ts`: "Only two agreeing negatives refute").
3. Before that, each no's reading is weighed against Core's record (t607,
   `refuted-no/weigh.ts`). A sentence with no checkable claim "stands as a reason of its own where
   it says something is wrong … of something Core can name: … a step by its node id". 0060's
   s10 sentence names the full node id and contains a negative word ("excludes"), so it stands.
   `advice-condition.ts` refutes advice only when that advice changes *conditions* by number. Advice
   that removes a *step* is never weighed. `unseen-row-claim.ts` (t654) returns early when a
   sentence `blamesAStep`. Neither no was "wholly refuted", so `reask.ts` made no re-ask. The
   evaluation records exactly two `resultChecks`, both `diagnosis`.
4. The outcome was `refuted`, `core.result.does_not_answer_request`, with the reading's advice
   ("Remove or replace node…s10"). `resultRepair` targeted s13 (the read), and `resultReauthor`
   was routed (steps 0061-0267).

### 3. Whether the t652-t655 judging fixes apply on this path

The judging code is shared. The build trial (`build-test/judge.ts`) and the playback check
(`run-outcome.ts`) both call `verifyAutomationStudioRunResult`, so t653 (a reply cut after its
verdict), t652 (split-no labels, `standingNo` on every outcome), t654 (unseen rows) and t655
(narrowing doubts) all run on the playback path. None of them covers this case:

- **t654** (`unseen-row-claim.ts`) refutes a *condition* said to miss a row no read saw, and
  explicitly lets any sentence that blames a step stand.
- **t655** (`unsure-doubts/narrowing.ts`) weighs only an **unsure** call, and only one whose
  sentence says the request "does not name/mention/specify" the option, and only where the option
  passes the request-text test. Here both calls said **no**, the claim was "keeps 4.0-4.4", and
  "4 & up" is not the request's wording. t655 also put `resultCount` into the judge's copy, but
  uses it only as words in its own recheck sentence. Nothing in `refuted-no/` or `standing-no/`
  reads it. A grep for `resultCount` in `result-verification` finds only `narrowing-group.ts`, the
  contract, and the recheck wording in `unsure-doubts/narrowing.ts`.
- **t652** `standingNo` and kept conditions feed the build's trial gate
  (`standing-no/kept-conditions.ts`). They are about conditions, not steps, and the runtime
  check has no gate that reads them.

How the two paths really differ:

- (a) The build test sets `confirmAnswer`, so a yes needs two yeses. The runtime check does not,
  so one yes stands. That does not matter here.
- (b) The runtime check knows nothing of the build's judged yes. `run-outcome.ts` reads the
  run's record sets, run detail and instructions. It records judgements per graph version
  (`automationStudioResultRecordFlowGraphJudgements`) but never consults an earlier one.
- (c) The judge's input differs only in `startView`, `policyGates` and two counts (section 1).

So the different outcome comes from judge variance on the same measured evidence: two yeses in
the build (0043, 0044) and two nos in playback (0059, 0060). Core has no rule that turns its own
measurement into a refutation of a no about a step.

### 4. Minimal structural change (general)

These fixes are listed in order of priority. None makes a yes, and each keeps the rule that a yes
needs two yeses.

**A. Refute a no about a step Core measured as removing nothing** (Core, `result-verification/refuted-no/`; new
`narrowing-step-claim.ts` and `advice-step.ts`, wired into `weigh.ts`).

- *Sentence claim.* A sentence of `observed` that names a `narrowedBefore` step is refuted when
  every step it names meets both tests below. A sentence can name a step by full node id, by its
  trailing `.sN` short id, by label, by control words, or by `chose`.
  - Core measured `resultCount.before === resultCount.after`, both present.
  - The step only added a choice: its `group` had no option chosen before it, and exactly one
    option became chosen (the t655 group detection already finds this). Without this test, a
    switch inside a single-choice group could keep the same count with different rows.
  The finding reads: "Step "<label>" chose "<option>": the page stated 16 results before it and
  16 after, so it removed no row; no row the request asks for can be missing because of it."
- *Advice claim.* An advice that only removes or replaces such steps is refuted the same way.
  This mirrors `advice-condition.ts` (t631) for conditions.
- *Effect, through existing t607 machinery.* A wholly refuted no is re-asked once with the
  finding (`reask.ts`). A no still refuted becomes **unsure**, never a no and never a yes. In
  this run, both nos would have been re-asked. The worst outcome is then `unverified`, never
  `refuted`, and no re-author runs.
- *What it does not weaken.* A step whose count did change (s8 32→23, s9 23→16) still stands as
  the judge's to weigh. A missing count refutes nothing. A yes still needs two yeses in a build
  trial. It applies on both paths because `weigh.ts` is shared.

**B. Tell the judge what `resultCount` is** (Core, the `loop_verification` judge instructions,
next to the `narrowedBefore` paragraph). One generic sentence: "`resultCount` is the number of
results the page stated before and after the step; a step after which that number did not change
removed no row, whatever its words." It gives no example, or reuses the existing library example,
so it never mirrors a scenario. Today the prompt asks the judge to read only a step's *words*,
which is exactly what both nos did wrong.

**C. (Optional, a backstop for objections Core cannot measure) Hold the build's judged-yes
record at runtime** (`run-outcome.ts`). The trigger is a double no on a run of a Flow version that
meets all of these:
- its build test was confirmed by two yeses;
- it has the same instruction digest;
- its judged summary is equal on Core's record: stored rows, the read's conditions and left-out
  accounts, pages, and `narrowedBefore` choices and counts, compared by content because node ids
  are re-minted when the Flow is saved.

Such a double no is a 2-2 disagreement on identical evidence. It should be recorded `unverified`
(disagreed), not `refuted`, and not repaired. This preserves "Core refutes only what it measured"
for objections A cannot reach. It never confirms a run. I did not check whether the build trial's
yes is currently written to the flow-version judgement store (`flow-version/contracts.ts`
`AutomationStudioFlowGraphJudgement`).

### 5. Why 68 decisions

68 `decide` steps in total: **20 in the build** (steps 0003-0045) and **48 in the re-author**
(steps 0061-0255).

- *Build (20): reasonable.*
  - 13 exploration decisions before the first submit (0003-0027): search, consent, filters,
    detect structure, a `recall_result`, reads.
  - The first candidate (0030) navigated to the invented host `https://valueridge.test/search?...`
    and failed `web.browser.permission_denied` at 0032. That cost 2 decisions (0033, 0034). This is
    a **general** issue: the model wrote a URL instead of the one it explored. A small cost here.
  - Trial 2 (0036) got a correct double no: it kept "Loftwell Countertop Paper Towel Holder,
    Bamboo".
  - Trial 3 (0042) got two yeses (0043, 0044), then `complete` (0045).
- *Re-author (48): all chasing a non-defect.* Its brief was the refuted reading's advice, "remove
  or replace s10". Removing a filter that changed nothing has no effect on the result, so the
  model looped:
  - It unchecked, rechecked (0097, "checked: true") and dropped s10, then rewrote the read's
    conditions.
  - Of 41 answers: 16 amendments applied, 14 refused (`already_in_flow`, `changes_nothing`),
    1 partly applied, 1 ignored (`draft_rerun`), 5 `complete` attempts refused
    `full_run_required`, 3 refused `bootstrap.missing_parameter`, and 2 refused
    `repeat_refused`.
  - It also replayed steps 0160-0210 to satisfy "every carried step ran in this build".
  - Its final judge (0267) correctly said **no**: the re-authored read now stored "Pickup today" as
    the product *name*. **The repair turned a correct Flow into a broken one.**
  - It ended with `flow_bootstrap.evidence_budget_exhausted` (`evaluation.json`
    `harnessRecovery.resultReauthor`).
  - Cause: **general**. It follows from the false refutation (fix A removes it), and a repair
    brief can carry advice that, by Core's own measurement, changes nothing.

## Commands run and observed results

- `ls steps | grep -c decide` printed `68`. Build decides (steps up to 0045): 20. After 0059: 48.
- `cat summary.json evaluation.json run.json`: `oracleVerdict: passed`, `reportedVerdict: failed`,
  `automationFailureReported.code: core.result.does_not_answer_request`, extraction 9/9 matched
  and 36/36 fields, `resultChecks` two `diagnosis` entries, `resultReauthor.failureCode:
  flow_bootstrap.evidence_budget_exhausted`, `costUsd 0.242`.
- Judge `response.txt` and `decision.json` for 0043, 0044, 0059, 0060 and 0267 were read in full
  (quoted above).
- `diff` of 0043 and 0059 `request.txt` (folded) showed only the system prompt as identical. The
  user payload differs in `startView`, `policyGates`, node-id prefixes, s1/s9 counts and the
  `[withheld]` scenario path.
- Hashes of the stored rows in both requests matched: names `10100be6…`, value lines `d79dda6c…`.
- `grep -c resultCount` over the judge system prompt printed `0`.
- Core code read at `4e51c1da`: `verify.ts`, the `agreement.ts` header, `run-outcome.ts`
  (`runVerification`), `refuted-no/weigh.ts`, `refuted-no/unseen-row-claim.ts`,
  `refuted-no/node-ids.ts`, `narrowed-before.ts`, `narrowing-group.ts`,
  `unsure-doubts/narrowing.ts`, and a grep of `resultCount` / `narrowedBefore` across
  `result-verification`.

## Not verified

- I did not run fix A or B. Whether a re-ask with the finding turns either no into a yes is
  untested. Under A the floor is `unverified`, but how the Lab reports an `unverified` playback
  (passed or failed) was not checked.
- Whether the `sN` short-id form resolves cleanly: 0059's `observed` says "s10", not the full id.
  A must match the trailing `.sN` of a `narrowedBefore` node id. That is a design note, not
  tested.
- Whether the build trial's two yeses are written to the flow-version judgement store (fix C's
  input).
- I did not trace the exact budget rule behind the re-author's `evidence_budget_exhausted`, or
  why five `complete` calls were refused `full_run_required: steps 1`.
- `core.log` held no lines that match verification, refutation or budget.

## Open questions or contradictions found

- Judge 0059 wrote `answersRequest: no` and then, in `summary`, reasoned to "Final answer: yes".
  t653 asks for `kind` and `diagnosis` before `summary`, so this model commits its verdict before
  the free-form reasoning that follows it. Core reads only the fields, which is correct, but the
  order may cost accuracy. This is **general** and needs a measurement before any change.
- The second check repeats the first and hits cache: 0060 had 20,352 of 20,513 input tokens
  cached, and 0044 had 23,168 of 23,383. So "two agreeing" answers are highly correlated in both
  directions, and the 2-yes build and 2-no playback amount to one draw each. This supports fix C.
- A repair brief built from a refuted reading's advice reached the builder even though Core's
  record showed the advised change would change no row. Fix A removes it at the source.
  Separately, a gate that refuses a re-author whose advice targets only steps measured as
  removing nothing would also have saved $0.12 here.
