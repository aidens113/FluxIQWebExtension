# Debug: run-mvswh11y-9d462629

Status: **FALSE PASS (product defect in Core's result verification)**. Lab runner verdict `failed: runtime.behavior`;
Lab oracle `failed` (15 rows of the 16 expected); Core reported `passed`. Adaptation gate round 1, everything-store
`deal-wheel`, lane t563, instance `gate-es`, workspace `gate-es-1`. Code under test: downstream `85f7d050`, Core
`4e2e411c` (checked: both t563 trees are at those merges). Read-only debug, 2026-10-28. No source edit, build, Lab run,
model call or git command. Offline probes ran Core's own guard functions from the t563 Core tree on this run's judge
inputs and replies (scratch scripts outside the repository; section 5).

**Cause, in one line.** Trial 1 stored exactly the oracle's 16 rows. A judge invented an exclusion ("ear tips, not
wireless earbuds"), and Core passed that advice to the builder unmarked. Core then dropped the one judge that said to
undo it. Every later yes over the narrower Flow was accepted, even though none quoted the request for the invented
condition. Two gaps in Core's quote guard let them through: a neighbour sentence lends its quote across conditions, and
the answer column word `name` counts as naming the condition.

## 1. How far it got

| Phase | Steps | What happened |
| --- | --- | --- |
| Chat | 0001 | The chat model chose `flow.createHere` with the task instruction verbatim. |
| Plan | 0002-0008 | read_task, one `find_on_page`, write_plan, then dispatch to brief-1. |
| Exploration | 0009-0023 | Open the store, search "wireless earbuds", click "Brightaisle Plus" (1000 to 43 results, `narrowedBefore`). Three `detect_repeating_structure` calls (0019 `target_unobserved`, then 0021 detected). One inspect. |
| Submission 1 | 0024 | `where: [{sponsored is absent}]`, the request's only exclusion. |
| Trial 1 | 0027-0032 | **Stored 16 rows** (`seen 20, kept 16`; condition 1 rejected the 4 Sponsored rows). This is the oracle's answer. Offline check 0029: `refused (no_live_source)`. Judges: 0031 `unknown` (coverage); 0032 `no`, a `kept_not_asked` defect on the ear-tips row: *"which is ear tips, not wireless earbuds"*, advice *"... (e.g. name contains "Earbuds" and not "Ear Tips"), or otherwise exclude accessory rows such as the Replacement Ear Tips."* Verdict `subflow.trial_unsure` / `candidate.trial_unconfirmed`, with 0032's advice handed on as `unconfirmedReading.advice` (0027 `result.json`). |
| Submission 2 | 0033 | The builder followed it: *"Revise the subflow to exclude accessory rows like Replacement Ear Tips"*. Added `{name contains "Earbuds"}` and `{name contains "Ear Tips", not: true}`. |
| Trial 2 | 0036-0041 | 15 rows, `subflow.trial_no`. 0040 said no for a different reason (the organic Lumo listing "is the same product as the sponsored row 2"; advice: dedupe by url). It also called the ear-tips drop "(correct)". **0041 said no for the right reason**: *"Remove condition 2 ... and condition 3 ...; keep only the sponsored-absent condition, since the request asks only to leave out sponsored placements."* Core withheld 0041's advice (section 2b). |
| Submission 3 | 0042 | Followed 0040: kept the invented conditions and added `recordOutput.process: {dedupe: {by: [url]}}`. |
| Trial 3 | 0045-0049 | 15 rows, `subflow.trial_yes`. 0048 and 0049 both said yes; neither quotes the request for condition 3 (0048: *"...removed the Replacement Ear Tips accessory, which is not a wireless earbud product."*). |
| Judged whole run | 0050-0053 | 0051 yes (held by the quote guard), 0052 yes, 0053 yes. Accepted. |
| Completion | 0054-0055, `core.log` 02:14:41 | Build `status=proposed`, applied 02:14:43. |
| Playback on the armed `deal-wheel` | 0056-0061 | Steps navigate, navigate, click, type, click, extract. 0059 type: *"recovered on attempt 2 after absorbing blocking_dialog"*, cleared dialog "Not now"; the store's first-search robot check *"cleared by itself after 9157 ms, untouched"*. 0060 click "Brightaisle Plus": recovered on attempt 2, cleared dialog "No thanks", the deal wheel's decline line (fixture `client/search-script.ts`, `data-decline`). 0061 read 15 rows. |
| Playback result check | 0062-0063 | 0062 yes, held. 0063 yes, accepted. `resultVerification: "confirmed"`, `reportedVerdict: "passed"`. |
| Repair lane | `events.ndjson` seq 26-28, `repair-lane.json` | `laneFailure runtime.behavior`, `application: null`, `replays: []`, `adaptationGate {counted: false, reason: "oracle_failed"}`. |

**How the Flow met the drift (correctly).** The wheel was handled by model-free recovery and interruption learning, with
no repair call (`repair.calls: 0, interventions: 4`). The 4 harness activations are `diagnosis` + `runtime_patch` for
each blocking dialog: 0059 "Not now" and 0060 the deal wheel. Each produced an adaptation (`adaptationCreated: true,
preflightOk: true`), applied in-run as revisions 2 and 3 (`adaptationPersistence`). The harness acted because the
dialogs blocked the first attempt of a recorded step. The oracle's final-state facts all held: `wheel-closed`
(observed false), `first-page-count` "1-16 of 43 results ...", and `never-challenged`. **The drift part of Step A
worked; only the records failed.**

**The oracle: expected vs got** (`snapshots/extraction-mismatches.json`): expected 16, observed 15, all 15 matched
in any order, 60/60 fields. The one missing row is expected position 9: `name` "Replacement Ear Tips for Wireless
Earbuds, Memory Foam Eartips, 3 Pairs (S/M/L), Black", `price` $12.99, `rating` 4.5, `url`
`.../Replacement-Ear-Tips-for-Wireless-Earbuds-Memory-Foam/dp/B0JKYDKPGR`. Positions 10-15 are `moved` up by one
because of it. Nothing else differs.

**Cost and calls:** 30 calls, $0.070159 (sum of step metas; equals `runTotal` seq 26-27 and the live-guard ledger
$0.07015944, ceiling $0.25). By kind: chat 1 ($0.00045), decisions 18 ($0.04250), judges 11 ($0.02721; 9 build, 2
playback). Repair 0 calls. No balance error.

## 2. The false pass

### 2a. The task wording is not the defect

The instruction: *"Search the store for wireless earbuds, narrow the results to Brightaisle Plus items, and collect
**every search result on the first page, leaving out sponsored placements**, ..."*. "Every search result", minus the one
named exclusion, includes the accessory row the search returned.

The contrast with the sibling task is deliberate (`everything-store/live-tasks.ts`):
`everything-store-plus-earbuds-under-50` says *"Leave out sponsored placements and accessories such as ear tips"*, and
this task does not. The oracle (16 rows, ear tips included) is exactly what the wording asks. Trial 1's 16 rows show a
person (and the Flow) can produce it.

Core's own judge prompt states the rule: *"the words a request searches or navigates by say where to look and exclude
nothing"*. Core's t515 header (`request-rows/request-wording.ts`) records the same misreading on this site before
(`run-mv6v2hx5-f448e662`: *"a non-earbud accessory"*). This is a recurring product failure, not a wording failure.

**Judgement call:** rewording to *"leaving out only sponsored placements"* would harden the wording without changing its
intent, and is allowed. I recommend **not** doing it now. It would hide the very product defect this gate exists to
catch, and it would change the frozen source pair. The oracle must not change.

### 2b. Why Core said yes: three Core defects, each reproduced offline

**D1, the invented exclusion reached the builder unmarked**
(`agreement/unsettled.ts`, the `unstated` line).

- Core's t515 screen `automationStudioRequestUnstatedExclusions` marks advice that adds an exclusion the request never
  states. Run on 0032's advice, it returns `["exclude accessory rows such as the Replacement Ear Tips"]` (probe 2), so it
  would have marked it.
- It runs only when `basis === "model_disagreed"` (yes vs no). Trial 1 was unsure plus no (`model_unconfirmed`), so the
  advice went out as `unconfirmedReading.advice` with no mark.
- The builder's 0033 request carries it verbatim, and the builder followed it.

**D2, the one correct no was wholly refuted on a misread count**
(`refuted-no/count-claim.ts`, `STATED_COUNT`).

- 0041's observed text says *"... yet the read saw only 20 items and kept 15"*. The first alternative of
  `STATED_COUNT`, `only N items`, reads "only 20 items" (items seen) as a claim about the stored count.
- `automationStudioResultRefutedReading` therefore returns `{wholly: true, findings: ["Core's record holds 15 stored
  rows, not 20."]}` (probe 4, on the real trial-2 summary).
- No other sentence stands: the third sentence names the conditions only by wording, not as `condition N`.
- So `refuted-labelled.ts` replaced the advice with *"Judge call 2's advice is left out: Core's record contradicts every
  claim its reading makes"*. The builder saw that line in place of the advice at 0042, and `earlierAdvice` repeats it to
  the trial-3 judges (0048 request lines 1301-1305).
- 0041 did mislabel its defect (`kept_not_asked` for a row that was left out). But its claim that conditions 2 and 3
  are not in the request is true, and Core can measure it: condition 3 alone left out a row.

**D3, yeses over the invented condition passed the quote guard without the request's words**
(`request-rows/unquoted-rows.ts` `boundUnquoted` / `accountingSentences`, and `request-rows/summary-reads.ts`
`boundNames`).

- Condition 3 is settled (`settledKind: text`). Core's prompt to the judge says a yes must *"quote, once, in a sentence
  that names condition 3 ... the request's own words leaving out rows whose name says what the condition looks for. If
  the request asks no such thing, these rows are ones it asks for"*. No yes did.
- `boundUnquoted` instead accepts any "accounting" sentence that names the condition, and a sentence counts as quoting
  when a neighbour that names no row lends it a quote. Probe 8 shows the lender in every accepted yes:
  - **0048, 0049, 0052, 0053:** the sentence naming condition 1 carries *"leaving out sponsored placements"* and lends it
    to the next sentence, which names condition 3 and quotes nothing of the request ("Ear Tips", a row label).
  - **0063:** the condition-3 sentence quotes only the searched words "wireless earbuds" (no own words, so not a quote).
    It is lent the spin-to-win clause quote "No thanks, I would rather pay full price" by the next sentence.
- Column alias: `boundNames` adds the tested column as a name of the condition. Here that column is `name`, an answer
  column every reply lists. So a sentence that quotes the request and lists "name, price, rating and url" names condition
  3 on its own:
  - 0063's first summary sentence alone accounts for condition 3 (probe 7);
  - 0052's pair "with name/price/rating/url" plus the condition-1 quote does the same (probe 8).
- Control: put the condition-1 sentence on its own line (no lending) and 0048 and 0049 are held for condition 3
  (probe, variant A). The held yeses 0051 and 0062 had no such neighbour.
- The loophole was known: `value-readings/tests/text-settled-judge.test.ts:88` avoids it in its fixture (*"Each
  condition on a line of its own, so no quote beside another condition is lent to the shelf test's"*) rather than fixing
  it.

**What the judges were shown and missed.**

- They had the request, `leftOutOnlyByThis` naming the ear-tips row under condition 3 (`leftOutCells` with its price,
  rating and url), the settled sentence above, and the task checklist (`notAsked`). The checklist's `asked.p1.goalFacts`
  says *"every first-page result is collected"*.
- They missed that "wireless earbuds" is the search, not a filter on product kind. Each gave its own reason ("an
  accessory, not an earbud"), which the prompt says is no reason.

**Not a Lab or oracle defect:**

- The Lab reported `oracleVerdict: failed` truthfully, and the gate classifier refused to count the run (`oracle_failed`).
- One side effect: the two in-run interruption adaptations were applied to the saved Flow (revisions 2 and 3) on the
  strength of the false confirmation. The handlers themselves are correct.

## 3. The fix (Core, product; no oracle or wording change; no model guidance change)

**F1, primary (fixes the false pass): close the two quote-guard gaps for settled conditions.**

- Files: `runtime/result-verification/request-rows/unquoted-rows.ts` and `request-rows/summary-reads.ts`.
- (a) A settled condition is accounted only by a sentence that itself names that condition and itself quotes the
  request's own words. That is exactly what Core's settled sentence tells the judge ("quote, once, in a sentence that
  names condition N").
  - No lending for `boundUnquoted`. t574's lending stays for row-by-row naming.
  - If lending must stay, a lender must name no condition and no row, and the quote it lends must not be one the reply
    already gives to another condition. Judgement call: (a) without lending is simpler and matches the prompt.
- (b) In `boundNames`, do not add the tested column as a name of the condition when that column is one of the answer's
  own columns (the record set's `columns`). Replies list those routinely, so the word names no condition. `condition N`
  and the condition's wording still name it.
- With (a) and (b), the five accepted yeses of this run (0048, 0049, 0052, 0053, 0063) are held for condition 3, as
  0051 and 0062 already were. This is my reading of the code, verified for 0048 and 0049 by the line-split variant. Each held yes is
  re-asked under the existing t515 path, which needs the request's excluding words beside condition 3. The request has
  none, so the yes cannot honestly be given.
- Residual risk: Core never judges whether a quote excludes the row. A judge quoting unrelated request words in the same
  sentence would still pass.
- Optional, stronger, deterministic: `refuted-no/request-exclusion-test.ts` (t660) can already tell whether a negated
  text test is the request's exclusion. A settled negated text condition whose text shares no own word with the request
  could be left unsettled, so each of its rows is held row by row. Judgement call; it widens t624's scope.

**F2: mark unstated exclusions on an unconfirmed no too.** In `agreement/unsettled.ts`, run `unstatedExclusion` for
`model_unconfirmed` (unsure plus no) as well as `model_disagreed`. This stops the trial-1 advice from reaching the
builder as an instruction. Check `markedAdvice`'s `reasked` argument, which assumes a split.

**F3: a count of items seen is not the stored count.** In `refuted-no/count-claim.ts`, `STATED_COUNT`'s `only N
(items|results)` alternative must not fire where the clause says what the read saw or the page showed ("saw", "seen",
"shows", "on page", "of N items"). Equivalently, skip a stated N that equals a read's `itemsSeen` when such a verb
precedes it. 0041 would then not be wholly refuted, and its "remove condition 2 and 3" advice would reach the builder.

**Regression tests** (Core, fail-first). Use a library or other non-store example; never this store's rows.

1. `request-rows/tests/unquoted-rows.test.ts`: a yes whose sentence naming a settled negated text condition quotes no
   request words, beside a sentence that names another condition with the request's quote, is held for that condition.
   Same for an unrelated request-clause quote in the neighbour sentence.
2. Same file: a sentence that quotes the request and lists the answer's columns ("with title, author and year") does not
   name a settled condition tested on `title`.
3. `value-readings/tests/text-settled-judge.test.ts`: drop the line-88 workaround. The unquoted variant must be held
   with the conditions in one line.
4. `agreement/tests/` (unsettled or ask-again): unsure plus a no whose advice adds an unstated exclusion yields
   `unconfirmedReading.advice` marked as on a split.
5. `refuted-no/tests/`: "the read saw only 20 items and kept 15" with `storedCount` 15 is not refuted. "only 20 rows
   were stored" with 15 stored still is.
6. Existing tests that rely on lending for a settled condition will fail under F1(a). The positive case at
   text-settled-judge line 69 must still pass, so check `AUDIOBOOKS_YES` quotes in the condition's own sentence.

**Before a rerun:**
- Core's narrow checks: the vitest files above plus `result-verification/` and `agreement/`, the package typecheck, and
  the structure audit.
- A provider-free replay of this run's 11 judge replies through `automationStudioResultVerdict`. The probes here are the
  start: every yes from trial 3 onward must come out held.
- Then one paid gate rerun on the store, after the debug note is in the launching lane tree.

## 4. UI (chat and ending)

- Build, revision 2 (`ui-review.local/11-mid-build-panel.png`): *"Check of the run's result: Didn't pass: 15 rows came
  back, but Read kept 15 of 20 items on page 1, excluding the 4 sponsored rows and the Replacement Ear Tips row"*. It is
  truncated: it never says what was wrong (0041's reason, the invented conditions), so the user cannot tell why.
- Build ending (`screenshots/00021`):
  - *"Built Collect Brightaisle Plus wireless earbuds: The subflow ... answered yes in its test run from the start"* and
    *"Spent $0.06 · 23 calls · 3 tests"*;
  - *"Left on the site: The build clicked "Decline", which changed the page ..."* for the optional cookie Decline (0028).
    That is harmless but noisy;
  - at no point did the chat tell the user the Flow leaves out a non-sponsored result. The only description of
    revision 3 is *"removes duplicates by product url so the sponsored copy's product is not stored twice"*.
- Playback (`screenshots/00025`, `ui-review.local/18`, `/19`): "Closed a notice the page put in the way" (the "Not now"
  dialog, unnamed), then *"Learning an interruption: The page put "Spin to win up to 20% off!" in the way and the run
  closed it. The Flow now keeps a step that closes it ..."*. That is correct and clear.
- Ending (`ui-review.local/19-failure-panel.png`, `screenshots/00028`): *"Check of the run's result: Passed: 15 rows
  came back. The result was judged to answer the request."* then "Run finished". **This is the false claim**: the user is
  told the result answers the request, and it is missing one asked row. F1 fixes it at the source; no UI change is
  needed beyond that. Making the revision-2 failure line say its reason is a separate small UI defect.
- The robot-check page shown mid-playback (`screenshots/00024`) cleared by itself; the chat said nothing about it.

## 5. Probes (offline, zero model calls)

- **Setup:** `node --experimental-transform-types` from `C:/Users/osrs_/FluxStuff/fxwork/t563/!FluxIQ/packages/fluxiq`.
  The scripts and parsed inputs are in this worker's scratchpad: each judge's `context` was parsed from `request.json`
  with the tree's `yaml@2.9.0`.
- **Probe 4, real inputs, as recorded:**
  - `automationStudioResultLeftOutRowsUnquoted` returns `[]` for 0048, 0049, 0052, 0053 and 0063, and condition 1 plus
    condition 3 held for 0051 and 0062;
  - `automationStudioResultRefutedReading(0041)` returns `wholly: true`;
  - `automationStudioRequestUnstatedExclusions(0032 advice)` marks one exclusion.
- **Probe 7/8:** single sentences and adjacent pairs that alone account for condition 3, as listed in 2b.
- **Variant A:** the condition-1 sentence on its own line holds 0048 and 0049 for condition 3.

## Not verified

- That F1 to F3 as written fix every yes. Only the line-split variant was run; no Core code was changed or tested.
- That the builder would have removed conditions 2 and 3 given 0041's advice (D2). That is likely but model-dependent.
- Why the "Not now" dialog appeared only in playback, never in the build. It is handled either way.
- The two in-run adaptations' durable reuse; no replay ran (`replays: []`).
