# Post-processing stage: design (worker report, read-only)

## Outcome
Done, as a design. Nothing in either repository was edited. Core was read at `!FluxIQ` dev `71d25f484`. Short answer: the
filtering engine already exists and is good. What is missing is a way for the model to reach it, words telling it when to
use it, a way to change it during a run, the judge seeing it, and four operators.

## What changed and why

### 1. What `process` can express today, and how it gets declared
- **Shape** (`packages/contracts/src/record-sets/process/types.ts:94-105`): `where`, `dedupe` (`{by}`, or `false`; whole
  row when absent), `sort` (up to 4 keys, `processing-vocabulary.ts:20`), `limit` (1 to 10,000), `columns`, `minRows`
  (reported, never a failure). Steps always run in the order where, dedupe, sort, limit, columns (`process-rows.ts:96-118`).
- **Conditions** (`types.ts:39-62`, `condition/holds.ts:80-130`): `is` present/absent; `atLeast/atMost/lessThan/greaterThan`
  on the first number the cell states, page-aware ("$1,299.00", "£72k", continental separators: `read-number.ts:1-22`);
  numeric or text `equals`; `contains/startsWith/endsWith/matches` (case and layout ignored; regex up to 200 characters).
  Date bounds work with `as:"date"`, relative `today`/`yesterday`/`<n> days ago`, and `within` (`holds.ts:12-24`). A list
  inside one condition means any of them, and `not` inverts one condition.
- **Gaps**: every `where` entry must hold, so there is **no OR across conditions or fields** (`process-rows.ts:104`). There
  are **no derived fields** and **no comparing one field with another**: bounds are literals only (`holds.ts:118-121`).
  **You cannot filter on a column you hide from the answer**: `parse-processing.ts:92-95` refuses
  `process_where_column_dropped`, and the sink keeps such columns visible (`answer-first/rows/row-sink.ts:102-103`), which
  is the extra-column judge mismatch from t194 (domain `runtime/llm-evidence/tools.ts:267-273`).
- **How it is declared**: only as `recordOutput.process` on one read call (`answer-first/rows/read-evidence.ts:35,87-92`).
  The domain moves a read's `dedupe/sort/maxItems/minItems` into `process` (`domain/.../record-output-process.ts:41-53`), but
  the read's `where` stays on the page (`one-page-read.ts:9-10`).
- **Mid-attempt**: in practice it is fixed after the first store. The store throws "Run dataset processing changed within one
  run" (`persistence/automation/project/run-dataset-store.ts:185`). The sink keeps sending the first declaration
  (`row-sink.ts:293-295`) and applies a later one only in memory (`row-sink.ts:331,408-409`). Changing it means re-running a
  read step, which reads the page again.
- **Saved and replayed**: yes. Assembly keeps a written `process` on the plan node (`authoring/record-output.ts:45`,
  `assembled-record-output.ts:129-137`), and the store applies it with no model calls at run end (`run-dataset-store.ts:501-513`).

### 2. What the model is told, and why it filters on the page
- In exploration the model is never told about post-processing. Step 0011 of run-mwocg0zw-298c705d has **0** mentions of
  `recordOutput`, `process` or `"sort`. The read tool (`domain/src/runtime/llm-evidence/tools.ts:298`) says "**Narrow the page
  first** for a partial list", and its only filter is the page-side `where`.
- Core's decision instruction pushes toward site filters: "look for the site's own filter ... **prefer choosing it over ...
  reading every item**" (`runtime/llm/evidence-loop-decision.ts:84`). There is no counterweight for conditions that are
  printed on each row.
- **run-mwocg0zw** (Haiku, failed, 27 decisions, $0.22): the model read the `plus` and `sponsored` marks as columns but wrote
  no `where`. Its four `amend_draft add` calls were refused `act_on_a_read` (steps 0013-0035). At step 0038 it said "filter in
  the read" and never did. Both judges (0053, 0056) refused unfiltered rows. Separately, only page 3's rows survived.
- **run-mwodpw10** (passed, 34 decisions, 6 judges, $3.29): the filter worked as a page `where` (0038). Each accessory fix,
  however, re-ran the read step and then the Flow across 5 pages (0058, 0064, 0070, then run_flow 0076 replayed 0077-0088).
  The rows were already collected, so a post-processing change would have cost no page reads.
- **run-mwojyaub, professional-network (lane B run 10, failed, 140 decisions, 7 judges, $5.02)**: the page `where`
  `data-ad-slot absent` (0171) did not catch the ad. The judges show it stored with an empty name and location "Promoted",
  next to a "People also searched" row (0327 defects, 0361, 0393). Today's vocabulary could already drop it with
  `where:[{field:"name",is:"present"},{field:"location",equals:"Promoted",not:true}]`. The model never knew this, and could
  not have changed it mid-run anyway.

### 3. Does the judge see the rows and the rules?
**No, not during an attempt.** The completion summary carries `rows` and `readPages` (each read's rows and what its page
`where` left out) plus the trail (`answer-first/completion/check.ts:282-299`). `processed-rows.ts:13-16` throws away the
`account`, and `readBack` returns rows only (`row-sink.ts:383-414`). So the judge sees the processed result, but neither the
declaration nor the rows it dropped. The store's account reaches the judge only through `result-summary.ts:455`
(`processing-account.ts`, t493), and only when a summary is built from the store's dataset list.

### 4. Design: one result-processing stage per Flow
- **Owned by the Flow, not by a step.** Add `result?: { process: Record<datasetId, Processing> }` to
  `AutomationStudioFlowDraft` (`runtime/flow-authoring/draft/draft.ts:14-18`) and to the saved Flow. At assembly, write it onto
  every record output of that dataset. That way the store, the replay and zero-call runs all use the path that exists today.
  A step-level `process` seeds the Flow-level one on first sight. After that, the Flow-level one wins.
- **New Core tool `core.set_result_processing`** (effect `observe`: it never touches the page; `runtime/llm/node-tools/result/`).
  Input `{dataset?, process | null, why}`, and it replaces the declaration whole. The model can call it at any point,
  mid-attempt and after a judge says no. Its answer is the account: kept, filteredOut, duplicates, cut, and per condition the
  rejected count plus the labels it alone left out (already computed: `types.ts:141-178`), together with the first rows. The
  `core.flow_draft` entry (`draft/entry.ts`) gets a "Result:" line listing the conditions in words (`condition/text.ts`).
- **Changeable within a run.** Replace the throw at `run-dataset-store.ts:185` with
  `setRunDatasetProcess(runId, datasetId, process)`: update `process_json`, clear `processing_json`, and process the collected
  rows again (they are kept). Remove the sink's first-declaration lock (`row-sink.ts:293-295,331`).
- **Deterministic**: the one pure function `processAutomationStudioRecordRows` with the run's `now`. A saved Flow carries the
  declaration, so a replay makes zero calls.
- **Operators to add** (`packages/contracts/src/record-sets/process/`; the parser and the domain parity table change together):
  1. `anyOf: Condition[]` as a `where` entry (OR across fields), with its own `not`, nested one level deep.
  2. **Hidden filter columns**: drop `process_where_column_dropped`. A `where` or `sort` field may be any stored column the
     answer's `columns` leave out. The store already processes from the collected rows, not from the answer. The
     `askedColumns` keep-shown rule (`row-sink.ts:102,432`) is removed with it. This is what lets a read collect a badge or
     label as a mark column and filter on it without showing it.
  3. A bound may be `{field}`, to compare two columns of the same row (number or date by the same readers).
  4. `derive: [{id, from, read: "number"|"date"|"text"|"present", pattern?}]`, run before `where`. A derived column can be
     shown in `columns`, and its schema field is marked `handling:"derived"`.
  - Rejected: reusing FluxNode `DATA_OPERATORS` (`contracts/src/fluxnode/data/expression.ts:20-49`). Its `to_number` reads
    only a plain number (`pipelines/expression/apply-operator.ts:20-26`), so "$19.99" would fail. The record readers handle
    page text.
- **The lane B case, required**: when a condition is visible on the row (a badge or label), the read collects it as a field.
  A presence mark holds a value only on rows that carry it. Processing then filters
  `{field: mark, is:"absent"}` with the mark hidden. When the extraction misplaces the label into a value column, use
  `anyOf` with a text test across columns, plus `{field: name, is:"present"}`. Acceptance: the recorded collected rows of
  run-mwojyaub, processed with that declaration, give the oracle's rows (provider-free).
- **Judge**: add `processing` to the FlowLess summary in `check.ts:summaryOf`. It holds the declaration in words and the
  account, screened through the existing `automationStudioResultProcessingAccount`. `processed-rows.ts` returns the
  `account`. Judge wording: "check each result-processing condition against the request's words, and each row it left out
  against the condition", so the judge checks the filtering instead of trusting it.
- **Guidance** (generic; examples from another kind of site; never a scenario's site, task, product or answer):
  - Core decision instruction, appended after the site-filter sentence at `evidence-loop-decision.ts:84`: "When the
    condition is printed on each row, read it as a column (marks and badges included) and keep, drop, order or cut rows with
    core.set_result_processing: it runs on rows already read, costs no page step or re-read, and every later run applies it.
    Use a site filter instead only when it cuts the pages to read by a lot, or when the condition is not printed on the rows.
    Use internal filtering when the site's filter is missing, slow, unreliable or not exactly the request's words. Rows a later
    step acts on are still narrowed by the read's where."
  - Read tool (`tools.ts:298`): replace "Narrow the page first for a partial list" with "Narrow on the page only when a
    filter cuts reading a lot; otherwise read the columns that decide and narrow with core.set_result_processing", staying
    inside the 2,000-character budget (`tools.ts:286-290`).
  - Tool description example: "on a recipe site: keep rows whose time is at most 30 minutes, drop rows carrying a featured
    mark, newest first".

### 5. Files by repository and package, overlap with t905, tests, live plan
- **Core `packages/contracts`** (no overlap): `record-sets/process/{types,parse-processing,parse-condition,process-rows,
  processing-vocabulary,value-reading-cases}.ts`, a new `derive.ts`, and `condition/{holds,text}.ts`.
  Tests: `process/tests/{process-rows,any-of,derive,hidden-filter-column,field-bound}.test.ts`.
- **Core `packages/fluxiq`, no overlap**: `persistence/automation/project/run-dataset-store.ts` (+ `tests/run-dataset-store.test.ts`:
  processing changed within a run, then processed again); `runtime/flow-authoring/draft/{draft,entry}.ts`;
  `bootstrap/authoring/assembled-record-output.ts` (projection); new `runtime/llm/node-tools/result/` (+ tests);
  `runtime/llm/evidence-loop-decision.ts`.
- **Overlaps t905, so it lands after t905 merges**: `answer-first/rows/{row-sink,processed-rows}.ts`,
  `answer-first/completion/check.ts`, `answer-first/attempt/run-attempt.ts` (tool wiring), and
  `runtime/result-verification/{processing-account,record-set-summary}.ts`. To keep the overlap small, put the new logic in a
  new `answer-first/result-processing/**` and add one-line hooks in those files. Tests: `rows/tests/` (mid-run change shows
  in readBack), `completion/tests/` (the summary carries the processing account).
- **Extension `domain`**: `runtime/llm-evidence/tools.ts` (read wording), `output-nodes/extract-list/{process-issues,
  declared-columns,stored-columns}.ts` (hidden filter columns), `actions/extraction/condition-grammar.ts` (parity for
  `anyOf` and field bounds). Tests: beside each file, in `tests/`.
- **Provider-free proof first**: replay the collected rows recorded by run-mwocg0zw, run-mwodpw10 and run-mwojyaub through
  the new declarations and compare them with each task's oracle rows.
- **Live measurement** (Claude, per Lab rules; `lab attempt --attempts 4`): everything-store plus-earbuds-under-50 and
  professional-network netherlands-data-engineers, plus one scraping task each on job-board and local-classifieds. The
  baseline is the measured runs: mwocg0zw 10.5 min, 27 decisions, $0.22, failed; mwodpw10 5.8 min, 34 decisions, 6 judges,
  $3.29, passed; mwojyaub 10 min, 140 decisions, 7 judges, $5.02, failed. Record wall time, decisions, judges, page reads
  (extract_list runs, replays included), cost and verdict. For attempts 2-4, also record the continuation proof and the
  model calls, expected to be 0. Success means: fewer page reads per filter change (0 instead of one full-Flow re-read),
  fewer decisions and judges, and the professional-network task passing.

## Commands run and observed results
Read-only `grep`/`sed`/`cat`/`python` over Core dev and the three lab runs. The cost, decision and time figures above come
from each run's `steps/index.md` and `meta.json` (python sum: 0.22 / 3.29 / 5.02). No tests were run, because this is a
design.

## Not verified
- Whether the judge of a saved Flow's replay (`flow_not_proven`) receives the store's processing account through
  `result-summary.ts`. I read the attempt completion path only.
- Why mwocg0zw kept only page 3's rows (a `startedOver` replace, probably). This is outside this design.
- That the hidden-column relaxation keeps the invariant "processing the answer again gives the same rows" in
  `build-test/stores.ts`.

## Open questions or contradictions found
- The t378 rule (rows a repeat acts on are narrowed by the page `where`) stays. Result processing never decides which rows an
  act visits. The tool must refuse when it would be the only filter in front of an acting repeat.
- The Core sentence "prefer the site's filter over reading every item" (`evidence-loop-decision.ts:84`) conflicts with the
  user's 2026-11-19 ask. The proposed wording limits it to conditions that are not printed on the rows.
