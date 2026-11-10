# Replay "lost conditions": trace of run-mwaudvnh-c208d32c, attempt 3

## Outcome

Trace done; no edits (read-only). The ancestry check passed: Core t885 `HEAD` is `c47c990e3`, and `git merge-base --is-ancestor dev HEAD` exited 0. No lead message said integration was done, so I stopped at the proposal.

**The replay did not lose its conditions, and the Flow did not lack them.** Attempt 3's deterministic replay (steps 0167-0181) read both pages with all four `where` conditions. It kept **exactly attempt 1's 16 approved rows**, page by page (11 on page 1, 5 on page 2). That was a right answer.

What failed was the judge's evidence of a saved Flow's run. Each read page of an engine run reaches the judge without the rows its conditions left out (`leftOut`). On this site the same product is listed twice, once as an ad and once not. The organic card's row is kept on page 1. The ad card with the **same name** shows "Sponsored" in the page-2 end view. With nothing saying that the ad card was left out, judge 0182 (and 0131 in attempt 2) took the two kept organic rows for their ad copies and said no.

Everything after that came from that wrong no:
- The model's look-only reads replaced the right result twice (0222: 15 unfiltered rows; 0255: 27 rows).
- Twice, a correct result with `leftOut` present was still refused or left unsure (0241, 0260). The same label is both kept and left out, and nothing says which card each one is.
- The loop guard then escalated to `ask_person` at 0273.

Two Core defects, both in or beside my owned areas:
1. A Flow run's read pages carry no `leftOut` (`rows/row-sink.ts:254-274`).
2. The judge's `readPages` never says that a left-out row's label is also a kept row's label (`result-verification/flow-less/read-pages-shown.ts:52-93`).

## What changed and why

Nothing changed (read-only trace; edit gate not met). The findings follow.

### (a) What attempt 2's repair changed, and what it saved

- Attempt 2 opened by replaying the Flow (0116-0130). It produced the same 16 rows as attempt 1, and judge 0131 said no, "two sponsored listings" (the same misreading as 0182, below).
- The repair, in order:
  - 0137 read page 2 with the same four conditions, which added a step 42 to the draft.
  - 0139 `amend_draft [{"step":42,"change":"drop"}]` removed that step again.
  - 0141 went back to page 1.
  - 0143 ran `core.run_flow {from:9,to:10}` (replay 0144-0147).
  - 0155 completed; judge 0156 said unknown.
  - 0158-0163 looked at Sponsored labels.
  - 0164 completed; judge 0165 said yes (16 rows).
- **Net change to the read: none.** The `where`, fields and paging (repeat s8 over read s9 and next page s10) are as attempt 1 saved them. The saved step 9 that attempt 3 replayed at 0225 still carries all four conditions: `div_css-1p4czgx is absent`, `rating atLeast 4.5`, `name not contains "Holder"`, `name not contains "Dispenser"` (`steps/0225-tool-core.run_node/call.json`).
- **What attempt 2 saved: steps.** Attempt 3 started from them: `attempt.json` `didNotEnd.stoodAt.startedFrom = {route:"use", attemptId: attempt.f59e34d8… (attempt 2), stepsDigest: 8bcd1a37…}`.
- "Saved today: notes only. I could not save steps" is **attempt 3's own** end message, in its waiting-for-person chat (`attempt.json` `notScored.message`). It is not a statement about attempt 2.
- **Saved Flow and task memory: not kept.** The run's folder `test-runs/instances/t885-live/run-mwaudvnh-c208d32c/` holds only `run.json`, `snapshots/live-llm.json` and `provider-failures.local.json`. Its `fluxiq-root/.fluxiq` (`packages/test-runner/src/allocation.ts:65-66`) is gone. The `.lab-instances/t885-live` folders under `apps/extension`, `apps/scenario-lab` and `domain` are build outputs, not a Core store. The saved step parameters are known only from the `core.run_flow` replay call (0225).

### (b) Which read ran in attempt 3, with which conditions and on which page

- Node `node.bootstrap.12a4684fc1cc5116.main.s9` (`web.output.dom-extract_list`) ran twice inside repeat s8:
  - 0175 on page 1;
  - 0176 next page (s10);
  - 0179 on page 2;
  - 0180 next page;
  - 0181 merge.
- The flow-step folders log only `meta.json`, so the parameters are not on disk for those steps. They are proven two ways:
  - The rows. Judge 0182's `readPages`: page 1 kept the same 11 labels as attempt 1's approved 0114; page 2 (`place: page=2`) kept the same 5. No holder, no rating below 4.5, and none of the ad copies attempt 1 left out (for example "Tidemark Paper Towels, 12 Mega Rolls").
  - The saved step's own parameters at 0225, which hold all four conditions.
- **So the conditions were lost nowhere:** not in the save, not in replay binding, not in a skipped conditional step.
- **What was lost is their account.** 0182's `readPages` has `keptRows` but no `leftOut` (one `leftOut` hit in the file, the question text only). 0114/0165 (live reads) and 0241/0260 (`core.run_flow` replays) each list three `leftOut` sets per page.
- Cause, by code:
  - A saved Flow's run stores rows through `onRecordBatch` (`answer-first/flow-run/flow-run.ts:145`).
  - The sink's `recordBatch` (`answer-first/rows/row-sink.ts:254-274`) builds the page from `batch.rows` and `batch.location` only (lines 266-269). It never sets `leftOut`.
  - `leftOut` exists only on the `fromCall` path (`rows/read-evidence.ts:94-107`), which reads a `core.run_node` answer's `readRows` or `rejectedRows`.
  - The engine's batch (`engine/automation/contracts.ts:656-685`, built in `engine/automation/records/capture.ts:76,148-165`) carries `location` but nothing of the read's left-out rows.
- The data does exist on the run's answer:
  - A played-back Flow's read asks the page for `rejectedSamples: "alone"` (`domain/src/output-nodes/extract-list/dispatch.ts:66-75`; `apps/extension/src/content/actions/extract-list.ts:58-68`).
  - Its answer's `extraction` holds per condition the alone rows, the together rows and the observations.
  - Core already parses them: `framework/automation-service/service/summaries/extraction-summary.ts:191-221` gives `conditions.aloneRows`, `aloneObservations` and `togetherRows`.
- The run_node fix of run-mwaknxf9 (`dropped-organic-row.md`) covered exploring reads and `core.run_flow` replays. It missed the engine's own run, which is exactly the deterministic replay of a later attempt.

### (c) Why paging "stopped at page 1"

**It did not, in the replay.** 0182's `readPages` has two pages (kept 11 and 5).

Judge 0222's "the read stopped at page 1 of 21 results" describes the result **after the model's look-only read at 0219**:
- 0219 was `extract_list` with an added `sponsored` column, **no `where`**, page 1 only.
- Its answer (`steps/0220-tool-core.run_node/result.json`) carries `resultList.code = answer_first.result_list_replaced`, rows 15, pages `[{kept:15}]`, `replaced: {rows:16, pages:[{place:"page=2",kept:5},{kept:11}]}`.
- The read's arguments differed from the list's, so it made a list of its own, and the result became that list alone. That is the row sink's "latest read is what it says" rule (`rows/row-sink.ts:25-50,201-252`).
- 0222's `readPages` is that one unfiltered page: 15 rows, with an ad copy, the holder and the 4.2-rated 2-Pack.

Likewise:
- **0202 and 0212:** 0201 (no `where`) and 0211 (rating condition only) each replaced the result the same way.
- **0255 (27 rows):** 0250, an unfiltered page-2 read with the same arguments as 0219, joined 0219's list (15 + 12). It replaced the 16 rows the 0224 `core.run_flow` had restored (`0251/result.json` `resultList`).

The model was told each time, with "where the replaced list was the right one, read it again as it was asked". It did not do so until 0224 and 0257.

### (d) Why the rounds after the first no did not converge

| Judge | Result judged | `leftOut` shown | Verdict and why |
| --- | --- | --- | --- |
| 0182 | replay's correct 16 rows | no (engine run, `recordBatch`) | no: same-name ad cards labelled Sponsored in the page-2 end view, taken for the kept organic rows |
| 0222 | 0219's unfiltered page 1 (15 rows) | – | no, correctly: the result really was wrong |
| 0241 | correct 16 rows, restored by 0224 `core.run_flow` | yes | no anyway: "two rows kept from page 1 are labelled Sponsored on the page 2 view" |
| 0255 | 0219 + 0250 unfiltered (27 rows) | – | no, correctly |
| 0260 | correct 16 rows | yes | unknown: "the page-1 read both keeps and leaves out two rows" |

- Two different defects keep the loop going:
  1. The first no stands on missing evidence (b). The model then had a right result and a judge saying it was wrong. It had no real defect to fix, so it made look-only reads, and two of them replaced the right result (c).
  2. With `leftOut` present, the same label sits in a page's `keptRows` and in a `leftOut` set ("Loftwell Select-A-Size … 12 Double Rolls" and "Hearthside Paper Towels, 12 Double Rolls" on page 1; "Hearthside Select-A-Size … 8 Double Rolls" and "ValueRidge Essentials Select-A-Size … 6 Double Rolls" kept on page 1, left out on page 2). Nothing tells the judge that the kept row is a different item that passed every condition.
- On identical evidence, 0114 and 0165 said yes while 0241 and 0260 said no or unknown. This is ambiguity, not a judge rule. Core has the cure on the run-account path already: `result-verification/request-rows/summary/with/also-in-result.ts` (t624, "also in the result"). The flow-less `readPages` has no equivalent.
- The loop guard (0185, 0246, 0265, 0268, 0273: `near_repeat` completions on the same evidence, then `ask_person`) worked as built. Nothing in the speed lane's `completion/**` needs to change for this.

## Proposed root fix (not applied)

**Fix 1: a Flow run's read pages carry what their conditions left out.** This is the cause of the first no and of attempt 2's opening no.

- **Preferred: the batch carries it, at the one point every dispatch path reaches.**
  - In `engine/automation/records/capture.ts:76`, beside `automationStudioRecordReadLocation(outputs.result, segments)`, copy the answer's left-out account onto the batch as a never-stored member, as `location` is: the `extraction` member's `rejectedSamples`, `rejectedSamplesAlone`, `rejectedObservations` and `conditions`, found on the same holders `read-location.ts:9-23` walks.
  - Also copy the read's authored `where`/`fields` from the effect payload, so the conditions can be worded.
  - Add the optional member on `AutomationStudioRecordBatch` (`engine/automation/contracts.ts:656-685`). The store copies named fields only, so it is never stored.
  - Then `rows/row-sink.ts:266-269` sets `page.leftOut`, through a third reader in `rows/read-evidence.ts` beside `fromReadRows`/`fromRejectedRows`, built on `extractionSummaryFromOutputs` (`summaries/extraction-summary.ts:191`): `aloneRows` → `kind:"alone"`, `togetherRows` → `kind:"together"`, `aloneObservations` → `found`.
  - `engine/automation/records/**` and `contracts.ts` are **not** in my owned areas, so the lead must assign them.
- **Owned-only alternative:**
  - After the engine returns (`flow-run/flow-run.ts:120-132`), walk `executed.trace.attempts`. For each list read, take `extractionSummaryFromOutputs(attempt.outputs)` and the node's `where`/`fields` (`automationStudioResultReadParameters(node.parameterValues)` from `executed.graph`).
  - Hand them to the sink by `(nodeId, attemptId)`. A new sink method sets `leftOut` on the page whose batch had that `nodeId`/`attemptId`, which `recordBatch` would then record on the page.
  - Weaker: it matches by ids after the run, and a Call Flow child's batches (whose `batchKey` carries the enclosing attempt path) need care.
- **Tests (provider-free, each failing with the fix reverted):**
  - Extend `rows/tests/run-read-pages.test.ts` (the real engine into the real sink) with two reads whose answers carry `extraction.rejectedSamples`/`rejectedSamplesAlone`. Expect each `readPages` entry to carry `leftOut` with the alone set under its condition.
  - Add a `flow-run` test that a replayed Flow's judged summary (`readPages`) names the left-out row.

**Fix 2: the judge is told when a left-out row's label is also a kept row's label.** This is the cause of 0241 and 0260.

- In `runtime/result-verification/flow-less/read-pages-shown.ts:52-93`, collect every kept label of the result's reads. Each left-out row whose label is among them is said with Core's sentence: another item with this same label passed every condition of its read and is the row kept; this one is the item the condition turned down. This is the flow-less twin of t624's `also-in-result.ts`.
- `flow-less/question.ts:19` gains one sentence saying what the marker means. It is generic and names no site, product or task.
- The claim is true by construction: a kept row is one item that met all of its read's conditions.
- **Test:** `flow-less/tests/` with a read whose `keptRows` and a `leftOut` set share a label. Expect the marker on the left-out row, and none on a label kept nowhere.

**Not proposed as a fix: look-only reads replacing the result (c).** It is the sink's designed rule, the model was told each time, and here it only followed from the wrong no. With Fixes 1 and 2, 0182 has the evidence 0114 approved. If the lead wants a guard anyway: a read with no `where` against a list whose reads all had one is a look, not the list (`rows/row-sink.ts:134-142,204-205`). That rule needs its own decision.

**Outside my areas:** none needed. The domain already sends the samples on playback, and `completion/**` behaved as designed.

## Commands run and observed results

- `git log --oneline -1` (Core t885) → `c47c990e3 Merge lane t885 into dev: the act gate never reads a control's kind as its words`.
- `git merge-base --is-ancestor dev HEAD` → exit 0.
- Step evidence was read with `grep`/`awk`/`node` (a scratch script in my scratchpad) over:
  - `steps/index.md`;
  - judges 0114, 0131, 0156, 0165, 0182, 0222, 0241, 0255 and 0260 (`request.txt`, `decision.json`);
  - decisions 0132-0164 and 0183-0273;
  - `0225/call.json`;
  - `0202/0212/0220/0251/result.json` (`resultList`);
  - the Lab's `attempt.json`, `attempt-report.txt` and `attempt-{1,2}/answer-turn.json`.
- `leftOut` hits per judge request: 0131 1, 0182 1, 0222 1, 0255 1 (the question text only); 0156 3, 0241 3, 0260 3.
- `totalRecordCount`: 0222 15, 0241 16, 0255 27, 0260 16.
- No vitest, check or structure run (no code changed).

## Not verified

- The replayed read's own answer (0175/0179). Flow-step folders log `meta.json` only, so the presence of `extraction.rejectedSamples` in this run's engine answer is inferred from the domain's dispatch code and the Core parser, not observed.
- The saved Flow itself: the run's Core store was not kept. Step 9's parameters are known from the 0225 replay call only.
- Whether attempt 1's saved steps digest equals attempt 2's `8bcd1a37…`.
- Whether Fix 2 alone would have turned 0182 to yes. 0182 also lacked `leftOut`, which is Fix 1.

## Open questions or contradictions found

- The debug note's two hypotheses ("a Flow without the conditions" or "a replay without them") are both false. The replay's result was right, and attempt 2's opening replay was misjudged the same way (0131), which the note does not mention.
- The earlier report `dropped-organic-row.md:61` expected the page-1 `keptRows` beside the page-2 `leftOut` to settle same-name cards. 0241 and 0260 show that judges still refuse on that evidence without an explicit marker.
- Fix 1's preferred place (`engine/automation/records/**`, `contracts.ts`) is outside my owned areas, and the lead must assign it.
