# Report: read-list-collect-design

Lead report (lead-xhigh, design stage only) for the brief "read-list-collect-design" in
`docs/working/mvp-final-month-plan.md`. Read at downstream dev `15bd04f9` and Core dev `e1551fa3`. Both have since
moved (downstream `655a1306`, Core `bd3cf1b4`), but those merges touch none of the files cited here
(`git diff --stat`: two lane-D docs downstream, `service/instruction-authority.ts` and its test in Core).

Prefixes. Downstream: D = `domain/src`, E = `apps/extension/src`, L = `apps/scenario-lab/src/scenarios`,
TR = `packages/test-runner/src`, TC = `packages/test-contracts/src`. Core: AS = `packages/fluxiq/src/programs/automation-studio`,
R = `AS/runtime`, N = `AS/nodes`, S = `AS/storage/project`, C = `packages/contracts/src/record-sets`.

## Outcome

Done. The design covers sections (1) to (7) below. Every current-state claim carries file:line evidence. The open
questions for the user are listed separately, each with a recommended default. No source, test or other doc file was
changed. Nothing was built, tested or run, and no live, Lab, browser or provider call was made.

## What changed and why

Only this report changed. Five read-only investigations (domain read node, extension paging, Core datasets and judges,
Core loops, Lab and migration) wrote to the lead's scratchpad. The lead re-read every load-bearing claim (listed under
"Commands run") before using it.

## The design on one screen

1. **The read reads one page.** `extractList` loses `paginate`. `where` stays on the page. `dedupe`, `sort` and
   `maxItems` keep their names, but they now apply to every row the read collected in the run, not to the pages one
   read followed.
2. **A new web node, `web.output.dom-next_page` ("Next page"),** moves a detected list on by one page. It uses the
   pager logic the read owns today and answers `success` (moved), `ended` (no further page) or `failed`.
3. **Core gains a do-while repeat:** `repeat {through: <next page>, while: <next page>, most: N}`. The span (read,
   any custom steps, next page) runs, then runs again while its last step succeeds. An `ended` route leaves the loop
   cleanly. A bounded pass-counter node gives the loop its bound and its pass numbers.
4. **Collection is what Core already does, made deliberate.** Every pass of a read is a new attempt that appends to
   that read's dataset in the run. Core's assembly names one dataset per read step.
5. **Post-processing is a Core stage at run end.** It turns each dataset's collected rows into its answer:
   - by default each row is kept once (whole row, first seen kept);
   - then the read's declared `dedupe`, `sort` and limit apply.

   The collected rows stay as evidence. The Data window, exports, the Lab and both judges read the answer.
6. **The build test runs the loop page by page** and mirrors the processing, so the build-test judge judges the
   answer and not the raw appends.
7. **Lane C:**
   - Flow: navigate; Decline (optional); Not now (optional); type; read (with `where`); next page; repeat while.
   - It reads 5 pages, the default dedupe removes the boundary repeats, and the answer is the oracle's 13 ordered
     records.

---

## (1) Today's read node, end to end

### 1.1 The request and how a plan names it

- **Request type.** `WebAutomationExtractListRequest` holds `item`, `itemElement?`, `fields`, `paginate?`,
  `maxItems?`, `minItems?`, `where?`, `dedupe?` and `sort?` (D/actions/extraction/request.ts:290-333).
- **`paginate`.** One of `{mode?: "next", next, maxPages}`, `{mode: "loadMore", control, maxPages}`,
  `{mode: "scroll", maxScrolls}` or `{mode: "numbered", pages, maxPages}` (request.ts:157-161). Every bound is at
  most 50 (request.ts:336; read-request.ts:380-385).
- **Handle form.** The model writes `{handle, fields|columns, where, dedupe, sort, paginate, minItems, maxItems}`
  (D/runtime/llm-evidence/plan-resolution/extraction/slot.ts:114).
- **Pagination always comes from the detection's binding**, never from controls the plan names
  (slot.ts:288-290; D/runtime/llm-evidence/structure/handles.ts:78-83). `keptPagination` (slot.ts:314-349) works
  like this:

  | The plan writes | Result |
  |---|---|
  | `paginate` absent | the detected proposal, which is `maxPages: 1` (E/content/extraction/detect-pagination.ts:106,117-122) |
  | `true` | 50 pages |
  | an object with a bound | that bound |
  | an object when nothing was detected | `no_pager_detected` |
  | a bad bound | `malformed` |

  The last row is round 2's R2-1 and R2-2.
- **The model sees only a mode word and a bound**, never the Next control or a handle for it
  (D/runtime/llm-evidence/structure/packet.ts:79,146-148).

### 1.2 Dispatch and the dataset it writes

- **Dispatch.** The node emits one `policy.output.dispatch` with a `recordOutput`
  (D/output-nodes/native-runtime.ts:74-87,135-141). A default timeout becomes 10 s × `maxPages`
  (D/output-nodes/extract-list/dispatch.ts:98-100; request.ts:366-370).
- **No `recordOutput` on the node.** The domain derives one (D/output-nodes/extract-list/derived-record-output.ts:40-84):
  - label `Extracted list: <kept keys>`;
  - `datasetId` = that label plus an FNV digest of `item`, the fields and part of `where`;
  - `writeMode: "append"` and `maxRecords = maxItems ?? 1000` (record-output.ts:61-84, the two values at :81-82).
- **What the digest leaves out:** `paginate`, `dedupe`, `sort`, `maxItems`, and `where`'s text conditions and `not`
  (derived-record-output.ts:69-84). So two reads of one shape append into one dataset (header lines 18-21).
- **When the instruction names columns, Core's assembly writes the `recordOutput` itself**, named after the step
  description or the definition label (R/flow-bootstrap/authoring/normalise.ts:102-118; record-output.ts:90;
  assemble.ts:344). Lane C round 2's read was named this way: `datasetId: web.output.dom-extract_list`
  (`lab-runs/2026-10-05/run-muwansvz-a2b4a987/steps/0026-judge/request.txt:196-197`).

### 1.3 On the page

**Routing and the loop**
- A read with `paginate` goes to the cross-document continuation (E/runtime/action-runner.ts:520-525).
- The loop reads a page, checks the stop, then advances (E/content/extraction/list-reader.ts:505-659;
  pagination.ts:379-396).

**Finding Next** (`nextControlOnPage`, detect-pagination.ts:244-307), in order:
1. the authored selector, unless it names another page;
2. `rel=next` or a strict Next label, walking up from the list;
3. the number after `aria-current`.

**Pager protections inside the read**
- A Next that links to this same page, or a script button, is swapped for the pager's following page
  (pagination.ts:418; E/content/extraction/pager-reading/pager-reading.ts:39-54).
- `:disabled` or `aria-disabled="true"` ends the read as `control_disabled` (pager-reading.ts:100-102;
  pagination.ts:411).
- After the press, the read waits for the list to change, falling back to `location.assign` (pagination.ts:604-631).
- Page loads are paced (pagination.ts:309-320).
- A 429 or 503 gets a wait and a reload, at most 2 times (pagination.ts:251-269,355-376; list-reader.ts:435-448).
- A checkpoint is carried across documents in worker memory (E/shared/extraction-continuation.ts:26-115;
  E/runtime/extract-list-continuation.ts:316-355).

**Stops.** There are 13 closed stop words (D/actions/extraction/summary.ts:142-155).

**Row order**
- The order is where → dedupe → sort → maxItems (E/content/extraction/order-rows.ts:4-14).
- `where` runs per item on every page (list-reader.ts:550-569).
- `dedupe` uses a composite key and keeps the first row in page order across pages (request.ts:163-177;
  list-reader.ts:577-582).
- `sort` and `maxItems` run over every page read (order-rows.ts:85-100).
- `next` and `numbered` reads also drop whole-row repeats across pages implicitly (`earlierPageRepeats`;
  request.ts:267-271; list-reader.ts:570-575).

**Two rules that break when each read is one page**
- `minItems` defaults to 1 and counts **kept** rows (request.ts:298-308).
- A filtered read that keeps nothing answers with the rows it rejected, marked `unfiltered` ("too much, never
  nothing", E/content/extraction/filtered-answer.ts:1-33,107-118). Nothing on the Flow path gates this:
  - `list-reader.ts:419` sets the flag;
  - `git grep unfiltered` finds no reference in D/output-nodes or in Core's executor or build-test.

### 1.4 Core's datasets

- **Keying.** There is one dataset per (run, datasetId): `run_datasets` has primary key (run_id, dataset_id). Each
  row keeps its `ordinal`, `attempt_id` and `batch_key` (S/schema/run-datasets.ts:10-47).
- **`appendBatch`** (S/run-dataset-store.ts:144-219):
  - a different schema digest throws (:159-160), and the node then fails with `persist_failed`
    (R/executor/node-execution.ts:342-345);
  - `replace` clears the dataset (:173-178);
  - `append` keeps existing rows, and a batch key it has already seen replaces only that batch (:180-187);
  - ordinals continue from the highest (:189-193).
- **Every execution of a node is a new attempt,** `<node>.attempt.<run-wide n>` (R/executor/graph-run.ts:331-334;
  node-execution.ts:103), with a new batch key (R/executor/record-capture.ts:144-175). So every loop pass appends.
- **No processing anywhere.** Core has no dedupe, filter, sort or limit for dataset rows. `schema.primaryKey` is
  parsed and hashed, and nothing reads it (C/parse-schema.ts:130-155; C/stored-schema.ts:18).
- **Readers get `row_json` only, in ordinal order** (run-dataset-store.ts:237,255,528-530), through
  `listRunDatasets`, `getRunDatasetPage` and `exportRunDataset` (R/service/datasets/run-datasets.ts:88-130). The
  result check reads every row (R/result-verification/run-outcome.ts:604-638).

### 1.5 The build test and the judges

**The replay**
- The build test replays a read with its resolved `paginate` (D/runtime/llm-evidence/node-run/replay.ts:333-408).
- It answers with:
  - `said`, carrying the pages and the stop (replay-answer.ts:186-209);
  - `readRows` labels (:248-275);
  - the Flow's own rows on `outputs.records` (:326-336).

**`buildTest.stores`** (R/result-verification/build-test/stores.ts:57-118)
- It gives rows and labels per dataset per pass, and `repeated` means equal labels.
- Only nodes whose parameters hold a `recordOutput` count (stores.ts:20-24,140-148).
- Each answer is the observation's `evidence`, which holds labels, not rows (R/result-verification/build-test/summary.ts:280-281,366-370;
  R/llm/node-tools/replay-span.ts:301).

**The two judges**
- **Build-test judge:** "answer no when it would store a row twice ..." (R/llm/diagnosis-instructions.ts:144).
  Round 2's judge applied it: 82 rows, 6 repeated.
- **Finished-run judge:** it sees every stored row whole (R/result-verification/result-summary.ts:1-6).
  - A read's account is its node's last successful attempt only (R/result-verification/read-account/accounts.ts:70-86).
  - It is told "Do not advise adding paging, filtering or deduplication a read already does"
    (diagnosis-instructions.ts:72).
  - The repair brief writes pages into the read's parameters (R/recovery/refuted-result/brief.ts:83,85).

### 1.6 What the model is taught about pages

- **The read node.**
  - Description: "Scrape a repeating list, table or one record into a dataset, one page or many."
    (D/output-nodes/extract-list/catalog-text.ts:90-94).
  - Tags: "every page", "next page", "load more", "infinite scroll", "pagination" (:50-64).
  - Grammar: `paginate?: {...}: pages to read, not pages present; one page unless asked.` (:224).
  - Example: `paginate: {mode: "next", next: "a.next", maxPages: 5}` (:284-292).
- **The detect tool:** "paginate absent keeps the detected bound, often just 1 page; true reads every page until the
  list ends, up to 50 ..." (D/runtime/llm-evidence/tools.ts:380).
- **Core.**
  - No sentence teaches paging as a Flow loop (grep `paginat|next page|every page|paging|while` over R).
  - `repeat` is taught for lists ("To do one act to every item of a list, three steps ...",
    R/flow-draft/entry.ts:82,89).
  - The authored text forbids "a second copy of a step already added" (entry.ts:89).
  - The `repeat` change is "... once for each row the step given by over produced, or while that step keeps
    succeeding" (R/flow-draft/amendment/schema.ts:20,27).

### 1.7 Loop constructs today

**How `repeat` compiles** (R/flow-bootstrap/authoring/draft-routing.ts:229-282)
- It compiles according to the node of the step it repeats over.
- **An array output** gives a For Each over the rows.
- **Otherwise** it gives a while loop:
  - its check must be the step immediately before the span;
  - the loop exits only when that check fails.
- No other step in the span may be routed (:230-233).

**Bounds and accounting**
- While loops have no bound but the run's 250 steps (R/executor/graph-run.ts:362,717-726).
- For Each grants steps per pass (graph-run.ts:226-243) and counts as progress
  (R/executor/state-routing/progress-guard.ts:11-28). Merge passes do neither.
- `builtin.control.loop` advertises `maxIterations` but enforces nothing (N/control-flow/loop.ts:4-22).

**Exit path and outputs**
- A failed check goes through state routing and the recovery ladder before `failed → exit`
  (graph-run.ts:545-675; R/executor/recovery-ladder.ts:50,82-91,150-156).
- Only the last pass's outputs stay in `values` (graph-run.ts:452-455).

**The build test's walker**
- It plans a while span without testing the check's first answer (R/llm/node-tools/replay-span.ts:168-172, against
  its own comment at :341).
- It loops while the check replays (:345-358), with a bound of 100 (:146-149).

**No third route for a web node.** A dispatched web action that succeeds is always route `success`
(R/io-policy.ts:119), and the executor keeps the native route on success (R/executor/node-execution.ts:283).

### 1.8 Lane C's oracle and the store's traps

**Task and answer**
- Task: L/everything-store/live-tasks.ts:20-27.
- Answer: every Plus earbud rated 4.0 or higher and under $50, from the whole result list, in featured order, each
  once (L/everything-store/workflows/plus-under-fifty.ts:14-16,77).
- The comparison is exact: the count, then each record in place (TR/run-expectations/extraction/judgement.ts:164-205).
  52 = 13 × 4 required keys (:90-97).

**How the Lab reads the rows**
- It reads them from Core page by page (TR/flow-lane/run-datasets.ts:114-158).
- It judges the latest dataset that carries the expected keys (TR/flow-lane/creation/judgement.ts:77-95;
  TR/flow-lane/expectations.ts:196-234).
- Pages are not judged in this lane (expectations.ts:85-88).

**The store's traps**
- Page N+1 opens with page N's last result (L/everything-store/catalog/results-page.ts:4-16,45).
- Page 2's Next links to page 2 while it is labelled page 3 (L/everything-store/pages/results/pagination.ts:22-25).
- The last page draws Next as `<span aria-disabled="true">` (pagination.ts:23-25).
- More than 5 results pages in 8 s gets a 429 (L/everything-store/state/throttle.ts:4-22).
- Cards 13 to 17 of a page load on scroll (results-page.ts:53-54).

---

## (2) Collection

**C1. One dataset per read step, per run.**
- Every pass of a read step appends to that step's dataset.
- "One dataset per Flow run" cannot hold every Flow. A Flow may read two different lists, for example a list and then
  each row's detail, and Core refuses one id with two schemas (S/run-dataset-store.ts:160).
- So for a read, "that run's dataset" is the dataset that read step writes in that run.
- **The change:** Core's assembly always writes a read step's `recordOutput`, not only when the instruction names
  columns (R/flow-bootstrap/authoring/normalise.ts:102-118). It uses:
  - `datasetId` = the slug of the step's description plus its stable step id;
  - `label` = the list's name.
- **This closes two gaps:**
  - two reads no longer share a dataset by accident (round 1's 20 unfiltered rows plus 10 filtered rows, stores.ts:4-12);
  - `buildTest.stores` sees every read (the stores.ts:20-24 gap).
- The domain-derived id stays for Flows that arrive with no `recordOutput` (recorded or hand-built).

**C2. Row identity.** The stored `ordinal` and `batch_key` exist already. The answer gets no id column. Dedupe
identity is computed, never stored (see P4).

**C3. Order.** Capture order is pass order, then page order within a pass (ordinals, run-dataset-store.ts:189-193).
The answer keeps first-seen order unless `sort` says otherwise.

**C4. Loop passes append.** Each pass is a new attempt and batch (1.4). A retried attempt replaces only its own batch.
Nothing new is needed.

**C5. What a one-page read must change so that pages collect cleanly.**
- **The empty-page floor moves to the collection.** In a Flow run and in the build test, a filtered read answers the
  rows it kept, even when there are none, and never its rejected rows.
  - Exploration (a live `core.run_node`) keeps today's floor; the 2026-09-24 lesson comes from there
    (filtered-answer.ts:14-27).
  - The page cannot tell a Flow run from an exploration, so the domain sends `answer: "kept"` on Flow and replay
    dispatches.
  - An answer that kept nothing while its reads rejected rows is flagged in the processing account (P8) and reaches
    the judges.
- **The minimum moves to the answer.**
  - A per-read minimum counts the list being present (items seen ≥ 1).
  - A model-written `minItems` becomes the answer's `minRows`.
  - Otherwise a page with no qualifying item would fail the read and stop the loop (request.ts:298-308).
- **Per-read state no longer spans pages.** `earlierPageRepeats` and the in-read dedupe identities live inside one
  read (list-reader.ts:296,570-582), so they stop working across passes. The default dedupe (P4) replaces them.
- **`maxRecords`** (= `maxItems`, record-output.ts:82) becomes a per-page cap. The collection's limit is processing's.

## (3) Post-processing

**P1. Where it lives.** It is a Core stage over each of the run's datasets.
- **When it runs:** when the graph run ends, whether it succeeded, failed or was cancelled, and before result
  verification. The seam is in R/service.ts, between the trace (:2695-2717) and the four calls to
  `verifyAutomationStudioRuntimeSessionResult` (:2685, :2687, :2738, :2741).
- **One pure function**, in Core's contracts, computes the answer from the collected rows and the declaration. The
  run-end stage, `buildTest.stores` (5.1) and any re-processing all call it.
- **Why not a node:**
  - a node runs only if the graph reaches it, so a run that ends early (failure, guard, bound) would leave raw rows;
  - the default must not depend on the model remembering a step;
  - the build test walks the draft and does not run the graph (R/llm/node-tools/replay-draft.ts:254-291);
  - no node can rewrite a run dataset today: N/data/write-records.ts only appends a batch, and
    `builtin.data.filter-list` works on in-memory lists.

**P2. Storage.**
- Collected rows stay where capture writes them (`run_dataset_rows`).
- The answer goes to a new `run_dataset_answer_rows` table: the same columns, with `ordinal` as the answer position.
- `run_datasets` gains `processing_json` and `processed_at_ms`.
- Once a dataset is processed, every reader reads the answer: `getPage`, `readRows`, export, stream, `readRecordSets`,
  and the run detail's `recordCount`.
- Re-processing is a pure function of the collected rows. So a repair re-run that appends under the same run
  (R/service/runtime-adaptation/repair-rerun.ts:178-181, not verified) just processes again.

**P3. The declaration.** It is a Core contract member, `AutomationStudioRecordOutput.process?` (C/output.ts):

| Member | Meaning |
|---|---|
| `dedupe?: {by: string[]} \| false` | absent means the default (P4) |
| `where?: condition[]` | over stored columns only |
| `sort?: [{field, order: asc\|desc, as?: auto\|number\|date\|text}]` | at most 4 keys |
| `limit?: number` | 1 to 10,000 |
| `columns?: string[]` | which stored columns the answer keeps, and in what order |
| `minRows?: number` | default 1; reported, not a failure |

- It applies in the read's established order: where → dedupe → sort → limit → columns (request.ts:279-282;
  order-rows.ts:4-14).
- Every writer to one dataset must declare the same `process`. A different one is refused at assembly, the same way a
  second schema is refused at capture.

**P4. The default dedupe key is the whole row.**
- It compares every stored column, ignoring layout and case, the way the page's own cross-page repeat rule compares
  "field for field" (request.ts:267-271).
- The first occurrence is kept. A row whose values are all empty is never a duplicate (the rule at
  request.ts:168-173).
- **Why not the link column,** which is the read's own `dedupe: true` default (D/actions/extraction/order-request.ts:213-221):
  - a URL can repeat across distinct rows (two offers, one shared "details" link), and merging those loses data
    silently;
  - a whole-row key removes only rows that carry nothing new.
- The model narrows the key when the instruction says what makes two items the same. "Each pair once" gives
  `dedupe: {by: ["url"]}`.

**P5. The model's words do not change.**
- Inside `extractList` the model writes `dedupe`, `sort` and `maxItems` as today (catalog grammar; slot.ts `keptOrder`
  :197-224).
- Their meaning changes from "over every page this read followed" to "over every row this read collected in the run".
- The domain stops sending them to the page. It writes them into the record output's `process` instead, in both the
  derived and the reconciled output (dispatch.ts:102-110). `maxItems` becomes `limit`.
- `where` stays on the page.

**P6. Row filters stay at read time.** That is the default, and the only place offered to the model. The reasons:
- most conditions test what the page shows but the dataset does not keep: an ad mark, a badge, a column the read
  leaves out (`read` conditions, conditions.ts:161-167,237-242). Lane C's "sponsored absent" and "Plus present" are
  such conditions;
- a row that is left out is never stored, which D12's sensitive-data rule relies on;
- the per-condition accounts that the judges and repairs use (rejected counts, `leftOutOnlyByThis`, C-2) are measured
  at read time (replay-answer.ts:248-275);
- the collected set stays small.

A post-process `where`, over stored columns only, exists in Core's vocabulary for conditions that only the whole
collection can answer, and for a repair that narrows without reading again. It is not offered to the model until a
scenario needs it. `columns` follows the same rule.

**P7. Reading values in Core.** Sort and `where` over stored text cells need the domain's reading of numbers ("$29.99",
the first number) and dates ("3 days ago") (order-request.ts:109-207; request.ts:84-90,182-196). Core gets a generic
implementation in contracts, held to the domain's by a shared table of parity cases.

**P8. The processing account, per dataset.**
- Shape: `{collected, duplicates, filteredOut, cut, kept, keptNone?, passes: [{node, pass, rows, newRows}]}`.
- It is stored with the answer and sent to the judges, the Data window and the Lab.

## (4) The page loop

### 4.1 What today's constructs allow, and why it is not enough

**Shape A:** read (4), press Next (5), the same read again (6), with `{"step": 6, "change": "repeat"}` (over 5).
- It needs a second copy of the read, which entry.ts:89 forbids.
- It leaves the loop only when the press fails:
  - on the store, page 2's Next is enabled and leads back to page 2 (pagination.ts:22), so the loop spins until the
    run's 250 steps and the run fails (graph-run.ts:362,717-726);
  - a press on a disabled Next is `TARGET_NOT_ACTIONABLE` (E/content/action-runtime/actionability.ts:3-9,49-50;
    results.ts:225), and that failure first goes through state routing and the ladder (1.7).

**Shape B:** read, assert Next enabled, press, read again.
- It needs the same second read.
- `assert enabled` checks only the element's own `aria-disabled`, while the click resolver also checks ancestors
  (E/content/action-runtime/assertion-evaluation.ts:277-280 against resolve-target.ts:568-570).

**Both shapes lose the read's own pager protections:**
- the swap of a same-page Next for the following page;
- the cancelled-link fallback;
- pacing;
- the 429 reload;
- the implicit repeat drop.

### 4.2 Design

**(a) A web node, `web.output.dom-next_page` ("Next page": show the next page of a list).**
- **Parameters:**
  - `list`: the detected list's handle (`extraction.N`), which the domain resolves from its binding to
    `{item, pagination?}` (handles.ts:78-83);
  - optional `control`: a page-view handle naming the Next control when the site's pager is its own;
  - a literal `{item, next}` for a list nothing detected.
- **Behaviour (extension).** It does the advance the read does today, as one step:
  1. find the way forward: a Next control, the following page when Next leads to this same page, a numbered page,
     Load more, or a scroll;
  2. never press a disabled or absent control; answer `ended` with the stop word instead (`control_absent`,
     `control_disabled`, `no_following_page`, `scrolled_to_end`);
  3. book the page-load pace, press, and wait for the list to change, with the cancelled-link fallback;
  4. on the new document, wait for the first item;
  5. on a 429 or 503 landing, wait and reload, at most 2 times.
- **Code movement.** `followNext`, `pressLoadMore`, `scrollForMore` and `visitNumberedPage` (pagination.ts:379-554),
  with their helpers, move out of the read into a page-advance module.
- **Across documents.** The worker reuses the continuation's resend (extract-list-continuation.ts:332-355): it
  survives the unload, waits for the tab, re-injects the content script, and asks whether the list arrived. No rows
  are carried.
- **Answers:**
  - `success` with `{page, by}`;
  - route `ended` with the stop word;
  - `failed` with `list_unchanged`, `rate_limited`, `list_vanished` or `page_fault`.
- **Not a lasting act.** It is navigation, so it needs no consequences declaration.
- **Why a node and not a plain click:** only the read's pager logic gets page 2 of the store right, and only an
  answer that is not a failure ends a loop without the recovery ladder.

**(b) Core: a dispatched action may choose one of its node's declared routes.**
- R/io-policy.ts:119 takes `route` from the command result when the node declares an output with that id.
- R/executor/node-execution.ts:283 keeps it.
- This is generic and has no web words.

**(c) The repeat vocabulary.** `repeat` gains two members:
- **`while: <step>`** names the last step of the span: "run the span, then run it again while its last step
  succeeds".
  - An `ended` route of that step, or any declared route other than `success` and `failed`, leaves the loop.
  - `failed` is a failure, as it is anywhere else.
- **`most: <n>`** is the most passes: default 50 (today's page ceiling, request.ts:336), at most 500. Reaching it
  ends the loop and says so (`bound`); it does not fail the run.
- The amendment is
  `{"step": <read>, "change": "repeat", "through": <next page>, "while": <next page>, "most"?: n}`.
- `over` keeps its two meanings: a list loop, and a while loop whose check comes first.

**(d) Compilation** (`repeat` in draft-routing.ts).
- Graph: `prev → loop(Merge) → pass(Repeat).body → read → [custom steps] → next`.
- Edges: `next.success → loop.branches`, `next.ended → exit(Merge)`, and `pass.done → exit` (the bound).
- **The Repeat node** is a new bounded pass counter in N/control-flow:
  - it keeps its iteration state through `context.iteration`, as For Each does;
  - its outputs are `body`, `done` and `pass`.
- The step allowance (graph-run.ts:226-243) and the progress mark (progress-guard.ts:11-28) count For Each by
  definition id. That check becomes the set {for-each, repeat}.
- **Why a node rather than a counter on Merge:** the node brings the bound, the pass number the activity needs, and
  the step allowance, all on machinery For Each already has.

**(e) The build test.**
- The walker plans a do-while span from `while`. It runs the span's members pass by pass and ends on the last
  member's `ended` answer; `replayed` goes on. The bound is `most`.
- Observations carry `pass` and, for reads, each row's identity (5.1).
- Two existing defects are fixed at the same time:
  - the while plan must require that the check held (replay-span.ts:168-172);
  - a check that comes before the span has its first ask excused (R/flow-draft/routing.ts:151-161).

**(f) Custom logic between pages.** Every step between the read and the next page is in the span and runs on every
pass: dismissing a dialog, a wait, a scroll. This is the user's reason for making paging the Flow's.

**(g) What the model is taught, by file.**
- **Read node description** (catalog-text.ts:90-94): "Read the rows of a list or table shown on this page, or one
  record, into the run's dataset. Detect the list first and name it by its handle. It saves its rows itself: no save
  step." Also:
  - `paginate` leaves the grammar and the example;
  - `dedupe`, `sort` and `maxItems` are described as working over everything the read collects in the run;
  - the paging tags move to the next-page node.
- **Next-page description:** "Show the next page of a detected list -- Next, a numbered page, Load more or scrolling
  -- or answer ended when there is none."
- **Detect tool** (tools.ts:380): drop the `paginate` sentences. `pagination` says how the list continues, and every
  page is covered by Next page on the same handle with `repeat`.
- **Lists line** (D/runtime/llm-evidence/system-instructions/instructions.ts:47), version `web-5`: "Every page of a
  list is a loop: read the list, then Next page on the same list, then amend_draft repeat on the read through Next
  page while it succeeds (most N for 'the first N pages'); the Flow keeps each row once."
- **Core, in generic words:**
  - amendment/schema.ts:20,26,27: add `while` and `most`;
  - entry.ts:82,89: "To go through a list that continues, the step that reads it, then the step that moves it on, and
    repeat on the read through that step with while: each pass reads once, and the Flow keeps each row once". With
    this shape the "second copy" rule no longer conflicts;
  - dry-run.ts:351: the pass words;
  - diagnosis-instructions.ts:72: reads no longer page themselves; name the loop's bound or the read's condition;
  - diagnosis-instructions.ts:144: "runs" gains "repeated while a step succeeds, at most N passes";
  - R/recovery/refuted-result/brief.ts:83,85: drop "a pagination setting";
  - R/llm/evidence-loop/rerun-input.ts:97: drop `maxPages`.
- **The build itself** runs Next page once live and states the loop. It never has to repeat a call, which
  evidence-loop-decision.ts:70 forbids.

**(h) The R2-1, R2-2 and R2-4 class leaves the read.**
- The read needs no pager any more.
- Next page finds the pager live from the list even when the detection carried none: `nextControlOnPage` walks up
  from the first item (detect-pagination.ts:244-260).

## (5) Judges and verification

**5.1 The build-test judge.**
- Each dataset in `stores[]` becomes
  `{dataset, steps, passes, collected, answer: {rows, labels}, removed: {duplicates, filteredOut, cut}, repeated?}`.
  `repeated` is computed on the answer.
- The words "answer no when it would store a row twice" stay (diagnosis-instructions.ts:144). They now apply only to
  a key that neither the default nor a declared dedupe covered.
- stores.ts mirrors the processing with the shared function. Labels alone cannot tell two rows apart, so the walker
  adds each read row's identity to the observation (replay-span.ts:301; summary.ts:280-281) beside its label. The
  identity is a digest over the stored columns and carries no values.

**5.2 The finished-run judge.**
- Record sets are the answers, every row as today (run-outcome.ts:604-638), each with its processing account.
- A read's account aggregates every pass of its node, instead of the last attempt (accounts.ts:70-86):
  - pages read;
  - rows kept per page;
  - why the loop ended (`ended`, `bound`, or a failure).
- diagnosis-instructions.ts:72 changes from "the pages it read ... whether it already pages" to the loop's passes,
  its end and its bound.

**5.3 Core's own arithmetic** adds one finding: a collection that kept nothing while its reads rejected rows (the
moved floor, C5). It carries counts, like `result.rows_identical` (R/result-verification/repair-directive.ts:301-347).

**5.4 Lane C's oracle.**
- The Lab needs no change. It reads the answer through `get-run-dataset-page`, pairs it as the latest dataset that
  carries name, price, rating and url (judgement.ts:77-95), and compares 13 records and 52 fields in place.
- How each look-alike from the debug's Stage 1, and each store trap, is met:

| Look-alike or trap | What prevents it |
|---|---|
| 3 records (page 1 only) | the loop |
| 14 or more (the boundary repeat) | the default whole-row dedupe, which keeps the first and so keeps featured order |
| 10 (the charging-case pairs dropped) | the read's `where`. This is model judgement, which C-2's left-out accounts check |
| 30 (an unfiltered read beside the filtered one) | per-step datasets: the judge sees both, and the Lab judges the later |
| sponsored rows kept | `where` "sponsored absent", at read time |
| page 2's Next looping back to page 2 | Next page follows the pager's following page (pagination.ts:418) |
| the 429 on a fast sweep | the pace and the reload, now in Next page |
| lazy cards | each one-page read reveals the end of the list before reading (list-reader.ts:470-503) |

- Whether any of the 5 pages holds no qualifying item is not verified. C5 makes it not matter.

## (6) Migration of `paginate`

**6.1 Model-built Flows.** `paginate` leaves the grammar.
- A handle-form plan that writes `paginate`, `maxPages` or `maxScrolls` is refused `web.handle.malformed` at that key.
  The expected hint names the loop: `web.handle.expected.extract_list.next_page`. Today slot.ts:114,123-128,140-141
  accepts all three.
- It must never be dropped silently. The tolerant dispatch reader ignores keys the schema does not declare
  (issues.ts:30-32), so dispatch refuses a stored `paginate` with `web.extract_list.paginate_retired` rather than
  reading one page.

**6.2 Stored Flows.**
- `extractList.paginate` is kept in several places:
  - `flow.json` (R/service/flows/store.ts:288-297);
  - `project.sqlite` `graph_nodes.parameter_values_json`, graph history and compiled plans
    (S/schema/domain-resources.ts:103-123,169,398);
  - generated source (R/service/flows/writer.ts:254-260).
- **Recommended:** no rewrite at load. A stored read that carries `paginate` fails with `paginate_retired` and a plain
  sentence ("This step used to go through pages by itself; the Flow now needs a Next page step and a repeat"). The
  failure sends the run to repair, whose brief knows the pattern.
- **Alternative,** if the user has stored Flows to keep: a domain-owned upgrade at load that rewrites the node into
  read, next page and repeat while. It would run on the way out, as the flow-settings migrations do
  (R/service/flows/store.ts:79-85), but it is a graph rewrite, which no migration does today.

**6.3 Recordings and the picker.**
- The "Read every page" checkbox records the detected pagination with `maxPages: 1` (detect-pagination.ts:106,117-122;
  E/panel/extraction/confirm-payload.ts:36). So it already reads one page.
- Remove the checkbox and its confirm member: E/panel/extraction/{panel.ts,panel-elements.ts,view-model.ts,confirm-payload.ts};
  E/background/extraction/definition.ts:68; E/shared/extraction-messages.ts:299.
- A recorded definition that carries `paginate` gets the same refusal.
- Recording a page loop is later work. The recorder records a person's own Next press as an ordinary click
  (E/content/recorder.ts).

**6.4 The Lab.**
- **Created-Flow lane:** the 13 paging live tasks keep their oracles. Pages are already unjudged in this lane
  (expectations.ts:85-88). The task list is in the worker report rlc-e Q2.
- **Recording lane:** TR/scenario-steps/extract-intent.ts:109-113 maps a step's `pagination` to the recorded
  `paginate`. Stop the mapping, and exclude paged steps from this lane (TC/flow-lane-exclusion.ts) until recordings
  can produce loops.
- **Lab-side data stays.** The scenario `pagination` stays as the reference reader's data
  (TR/scenario-steps/extract-records.ts:46-82 is Lab code).
- **Bench:** `paginationAccuracy` (TR/bench/extraction-metrics.ts:47,92,170) becomes the loop's pass count, or is
  retired.
- **Pairing:** several extract steps writing into one dataset mis-pair (expectations.ts:203-206). Per-step datasets
  avoid that.

**6.5 Retiring the read's paging,** after the live proof:
- **Extension:**
  - the paged loop, checkpoint and resume in E/content/extraction/list-reader.ts;
  - E/content/extraction/continued-read/**;
  - E/content/action-runtime/extraction-continuation.ts;
  - E/runtime/extract-list-continuation.ts, whose resend Next page reuses.
- **Domain:**
  - `paginate` in request.ts, `paginationValue` in read-request.ts, schema.ts:61;
  - slot.ts `keptPagination`, `everyPage` and `liftedBounds`;
  - the paginate issues in issues.ts;
  - page timeout scaling (request.ts:366-370; dispatch.ts:98-100).

  `paginationStop` moves to Next page's answer.
- **Core:**
  - read-account paging (accounts.ts:53-57,100-118,192-211, plus `judge-paging.ts`, `pages-clause.ts`, `stop.ts` and
    `page-bound-sentence.ts`);
  - "page through" in person-words.ts.
- **Tests:** each stage moves or deletes the tests its files own:
  - extension: 19 unit files and 14 e2e specs (rlc-b Q6);
  - domain: 32 test files (rlc-a Q9);
  - Core: 35 test files (rlc-e Q3).

**6.6 Docs.**
- **Downstream `docs/architecture/`:**
  - build-loop.md:171;
  - web-capabilities.md:114-116,125,148,172-180;
  - extension-client.md:1550,1673,1857-1868;
  - testing-facility.md:895,939-940,982,1002,1014,1021-1026,1110-1126,1200,2307,2457.
- **Core:**
  - docs/architecture/automation-studio/flow-authoring.md:550-552;
  - llm-flow-bootstrap.md:700-712,794,1244-1247;
  - automation-studio-native-nodes.md:273-306;
  - package-boundaries.md:294;
  - the generated references, regenerated.

## (7) Staged implementation plan

Each stage is one task branch, partitioned by file. Its tests are written to fail first. Its gate is the tests beside
the changed files plus the package checks and audits (no full suites, per AGENTS.md).

| Stage | Repo | Owns (files) | Fail-first tests | Depends on |
|---|---|---|---|---|
| S1 Collection answer | Core | C/output.ts, C/parse-output.ts, new C/process/{process-rows,row-identity,value-reading,account,index}.ts; S/schema/run-datasets.ts (answer table, processing columns, migration), S/run-dataset-store.ts; R/service/datasets/{run-datasets,types}.ts; R/service.ts (the run-end call); R/flow-bootstrap/authoring/{normalise,record-output}.ts (always a per-step `recordOutput`) | rows A,B,C,c',D, where c' equals C ignoring case and layout, answer A,B,C,D with duplicates 1; all-empty rows never merged; `by: [url]` keeps the first; sort and limit over all rows; two batches of one node (A,B,C then C,D) give an answer of A,B,C,D, collected 5, recordCount 4; processing again is idempotent; export returns the answer; a read with no `recordOutput` and no named columns gets one, distinct per step | none |
| S2 The loop | Core | R/flow-draft/{routing,entry,excused,dry-run}.ts and amendment/{types,changes,route,schema,repeat-revalidation}.ts; R/flow-bootstrap/authoring/draft-routing.ts; N/control-flow/{repeat.ts (new),index.ts}; R/executor/{graph-run,node-execution}.ts, state-routing/progress-guard.ts; R/io-policy.ts; R/llm/node-tools/{replay-span,replay-draft}.ts | `repeat {through, while, most}` assembles Merge, Repeat, read, next, with `success` back to the loop, `ended` to exit and `done` to exit; with fake natives, `ended` on pass 3 gives 3 reads, the run succeeds, with no ladder and no state routing; `most: 2` ends the loop with `bound` and the Flow goes on; an undeclared dispatched route is ignored; the walker's do-while runs 3 passes; a parity test against `runAutomationStudioGraph`; the while plan requires the check to have held; the progress mark counts Repeat passes | none (parallel with S1) |
| S3 Judges and build test | Core | R/result-verification/build-test/{stores,summary,read-rows}.ts; R/result-verification/{contracts,result-summary,repair-directive}.ts; read-account/{accounts,judge-paging,pages-clause,stop,sentence,page-bound-sentence}.ts; R/llm/diagnosis-instructions.ts; R/recovery/refuted-result/brief.ts; R/llm/evidence-loop/rerun-input.ts | two passes with a boundary repeat give answer = collected − 1, no `repeated` and `removed.duplicates: 1`; a read node with 5 attempts gives one account with 5 pages and stop `ended`; the kept-none finding; instruction snapshots regenerated through their script | S1, S2. Activity words wait for t279, which owns R/activity/** |
| S4 Domain | downstream | D/actions/extraction/{request,read-request,schema,summary,schemas}.ts, new D/actions/next-page/**; D/output-nodes/{definitions,native-runtime,payloads}.ts, extract-list/{catalog-text,dispatch,issues,parameters,record-output,derived-record-output,reconciled-record-output}.ts, new output-nodes/next-page/**; plan-resolution/{extraction/slot,resolve-plan-node,issue-position}.ts; structure/{packet,handles}.ts; llm-evidence/{tools,system-instructions/instructions}.ts; node-run/{replay,replay-answer,catalog,call-words}.ts; D/client/{gateway-mapping,gateway-action-parameters}.ts | handle-form `paginate` refused with the next-page hint; stored literal `paginate` refused `paginate_retired`; `dedupe`, `sort` and `maxItems` land in `recordOutput.process` and not in the page request; Flow and replay reads carry `answer: "kept"`; `minItems` becomes `minRows`; a next-page handle resolves to the item and the detected pager; next page's `ended` maps to route `ended`; catalog bounds hold; instructions `web-5` | S1's `process` type and S2's route contract (stub locally until Core lands) |
| S5 Extension | downstream | new E/content/actions/next-page.ts and a page-advance module split from E/content/extraction/pagination.ts; E/content/extraction/{list-reader,filtered-answer,detect-pagination}.ts, pager-reading/**; E/content/actions/{execute,extract-list,types}.ts; E/runtime/{action-runner,extract-list-continuation}.ts; E/shared/{protocol,extraction-continuation}.ts; E/panel/extraction/**; E/background/extraction/definition.ts | on the store-pager fixture: page 2 whose Next links to itself moves to page 3 (`by: following`); a last page with a disabled span Next answers `ended control_disabled`; a cancelled link uses `location.assign`; a 429 landing waits and reloads once; a Flow-run read that keeps none answers `[]`; an exploration read keeps the fallback; the content e2e store spec walks 5 pages | S4's action types |
| S6 Migration, Lab, docs | both | TR/scenario-steps/extract-intent.ts, TC/flow-lane-exclusion.ts, TR/bench/extraction-metrics.ts; the docs in 6.6; the affected e2e specs | a paged recording step is excluded, not mis-recorded; scenario validation still passes | S4, S5 |
| S7 Retire the read's paging | both | the files in 6.5 | none new; the moved tests pass | the live proof |

**Lanes.** S1, S2 and S4/S5 touch disjoint files and can run as three parallel lanes. S3 follows S1 and S2, and S6
follows S4 and S5.

**Proofs, in order:**
1. **A provider-free Core build test of lane C's shape.** A fake host serves 5 pages, with page N+1 opening with page
   N's last row, and Next page answers `ended` after page 5. The test expects:
   - `stores` holds an answer of the expected rows, with no `repeated` and the duplicate count set;
   - the judge request carries the answer and the account;
   - a stored-Flow run with fake natives stores the same answer.
2. **The extension e2e on the everything-store fixture:** read plus Next page through the content harness, covering
   page 2's trap and the last page's `ended`.
3. **The live proof (lane C),** one round, after S1 to S5 and S3 have merged and the lane trees are synced
   (memory: live runs wait for all agreed changes):
   - task: `everything-store-plus-earbuds-under-50`;
   - expected Flow: navigate; Decline (optional); Not now (optional); type "wireless earbuds"; read with `where`
     (sponsored absent, Plus present, rating at least 4, price under 50, accessories out); Next page; repeat on the
     read through Next page while it succeeds;
   - expected build test: 5 passes, `ended` on page 5, `stores` with collected N, duplicates removed and an answer of
     13 rows;
   - expected Lab verdict: `passed`, with 13 records and 52 fields;
   - UI review: the pass cards name the page ("Reading page 3"), the loop's end reads "the list ended after 5 pages",
     and no internal word ("paginate") appears.

## Open questions for the user (each with a recommended default)

1. **Where a read's rows are collected.** Default: one dataset per read step in the run; all its passes append.
   The alternative, one dataset for the whole Flow run, cannot hold two different lists.
2. **What counts as the same row by default.** Default: the whole row (every stored column, layout and case ignored),
   first one kept. The model narrows it ("by url") when the instruction says what the same item is.
3. **The "press Next" step.** Default: the page-aware Next page node, which also handles a Next that leads back to
   the same page, a disabled Next, Load more and scrolling, and ends the loop cleanly. A plain click on Next is not
   taught.
4. **Keeping the collected rows beside the answer.** Default: keep both. Everything a person or a judge sees reads the
   answer; the collected rows stay as evidence of what each page gave.
5. **Where filters go.** Default: on the read, at page time, as today. A post-process filter exists in Core but is not
   offered to the model until a task needs it.
6. **Saved Flows that page by themselves.** Default: they stop with a plain reason and go to repair, which rebuilds
   the loop. No automatic rewrite.
7. **The loop's bound.** Default: at most 50 passes (maximum 500). Reaching the bound ends the loop and is reported as
   incomplete, never silently.
8. **A page with no matching rows.** Default: it adds nothing in a Flow run. "A read that kept nothing returns the
   rows it rejected" now applies only while exploring, and a collection that kept nothing at all is flagged.
9. **Recording.** Default: the picker's "Read every page" box is removed (it already reads one page). Recorded paged
   steps leave the recording lane until recordings can produce a loop.
10. **Failed runs.** Default: the answer is computed for every run, failed or cancelled too, so the Data window never
    shows raw duplicates.

## Commands run and observed results

All were read-only. No build, test, Lab, browser or provider command was run.

**HEADs**
- `git log --oneline -1` printed:
  - downstream `4190d639` at the start, `655a1306` at the end;
  - Core `e1551fa3`, then `bd3cf1b4`.
- `git diff --stat e1551fa3 bd3cf1b4` (Core) changed only `service/instruction-authority.ts` and its test.
- `git diff --stat 15bd04f9 655a1306` (downstream) changed only two lane-D docs.

**Core claims the lead re-read**
- S/schema/run-datasets.ts:10-47 and S/run-dataset-store.ts:144-219: the keying, the schema-digest throw, replace,
  batch retry and ordinals.
- R/executor/graph-run.ts:325-366 and :445-458: attempt numbering, `maxSteps` 250, and `values` overwrite.
- node-execution.ts:98-106 and :247-283: the attempt id, and the success merge keeping the route.
- record-capture.ts:144-175: the batch key.
- R/flow-bootstrap/authoring/draft-routing.ts:186-296: list loop against while loop, the check immediately before the
  span, the routed-body refusal.
- R/llm/node-tools/replay-span.ts:140-182 and :335-385: the while plan made without the check's status, and bound 100.
- graph-run.ts:222-250 and state-routing/progress-guard.ts:1-60: the allowance and the mark are For Each only.
- N/control-flow/for-each.ts:1-80.
- R/io-policy.ts:75-140: success is always route `success`.
- R/result-verification/build-test/stores.ts:1-60 and :120-165: only a parameter naming a `datasetId` counts.
- R/flow-bootstrap/authoring/record-output.ts:50-110, normalise.ts:90-130, assemble.ts:338-348: assembly writes a
  `recordOutput` only when the instruction names columns.
- read-account/accounts.ts:70-86: the last attempt only.
- diagnosis-instructions.ts:144 ("answer no when it would store a row twice") and :72 ("Do not advise adding paging,
  filtering or deduplication a read already does").
- build-test/summary.ts:280-292 and :360-372: observations carry `evidence` only.

**Downstream claims the lead re-read**
- D/output-nodes/extract-list/{parameters,parameter-contract,record-output,derived-record-output}.ts.
- request.ts:160-180 and :255-335.
- catalog-text.ts:1-120.
- L/everything-store/{live-tasks.ts:18-30, workflows/plus-under-fifty.ts:10-20 and :55-80,
  pages/results/pagination.ts:16-36, catalog/results-page.ts:1-16 and :40-60}.
- TR/flow-lane/expectations.ts:196-234 and creation/judgement.ts:74-96.
- E/content/extraction/detect-pagination.ts:100-126, panel/extraction/confirm-payload.ts:30-40, panel.ts:432-442:
  "Read every page" records `maxPages: 1`.
- filtered-answer.ts:1-40 and :90-125: the unfiltered fallback.

**Searches and lab-run evidence**
- `git grep unfiltered`, across D/output-nodes, the client, the extract-list verb and list-reader, plus Core's
  executor and build-test: no Flow-path gate.
- `lab-runs/2026-10-05/run-muwansvz-a2b4a987/steps/0026-judge/request.txt:196-197,363-369` (`recordOutput.datasetId:
  web.output.dom-extract_list`, stores 82 rows, append), read-only.
- Worker reports: five scratchpad files (rlc-a to rlc-e). Their remaining citations are used as reported.

## Not verified

- **Lane C's numbers.** That `RECORDS.length` is 13 was not recomputed; it is quoted from debugs and the 52-field
  formula. Whether any of lane C's 5 pages has no qualifying item is also unknown (C5 makes it not matter).
- **Repair re-runs.** That a repair re-run appends under the same run id (repair-rerun.ts:178-181) is inferred, not
  traced.
- **The failure path.** That state routing, `skip_satisfied_node` or `sometimesPresent` can send a failed while check
  back into the body is inferred from code paths (Core loops report, Q6).
- **The extension's route word.** How its action result would carry a route word is design; today's results carry
  none.
- **The page view.** That the compact page view shows `disabled` tokens is stated at
  D/runtime/llm-evidence/system-instructions/instructions.ts:39 and was not traced.
- **Timeouts.** Whether the background scales a replayed read's timeout (D/.../node-run/replay.ts:343 bypasses
  dispatch) was not checked.
- **Citations taken from worker reports without a lead re-read:** extension paging internals (pagination.ts,
  list-reader.ts, resolve-target.ts, assertion-evaluation.ts line numbers); Core prompt line quotes other than :72 and
  :144; Lab Q2 task table; docs line list; Core persistence paths (6.2).

## Open questions or contradictions found (engineering, not for the user)

- **The walker against its own comment:** replay-span.ts:341 says the while span is planned only when the check held;
  :168-172 never checks.
- **Unhonoured control parameters:** `builtin.control.loop` advertises `maxIterations` but enforces nothing
  (N/control-flow/loop.ts:21), and Merge's `mergeMode` is not honoured.
- **The derived dataset id digest** leaves out `where`'s text conditions and `not` (derived-record-output.ts:69-84),
  against its own header's C5 rationale (:61-68).
- **Stale comments:**
  - R/result-verification/contracts.ts:84-99 still describes capped sample rows;
  - D/actions/schemas.ts:323 still says "following pagination";
  - the panel label "Read every page ... up to N pages" (panel.ts:432-442) and the header at
    detect-pagination.ts:42-45 describe a bound the proposal sets to 1;
  - E/content/actions/extract-list.ts:360-363 calls `rate_limited` new, but the closed set already holds it.
- **Two "enabled" checks:** `web.dom.assert enabled` reads only the element's own `aria-disabled`, while actionability
  and the resolver also read ancestors.
- **Required columns:** a string-grammar field is `required` in the record schema (record-output.ts:73) but optional
  on the page (request.ts:40-53). Not verified at run time.
- **The ownership boundary:** S3 overlaps t279's ownership of R/activity/**. The pass and "list ended" activity words
  wait for t279 to land.
