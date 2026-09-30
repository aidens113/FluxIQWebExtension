# t194-w3: extract_list conditions that "applied to nothing", and the filters the Flow could not express

Worker report. Run under investigation: `run-munnhi5q-4867dabe`, node `...main.s9`
(`web.dom.extract_list`), action attemptIndex 8.

## Outcome

**Partial.** All three questions are answered from code and bundle evidence. The
fix for question 1 has been built and verified, but not applied to the tree. It needs
`apps/extension/src/shared/extraction-continuation.ts`, which is outside this
brief's ownership, and the half inside my ownership (`list-reader.ts`) cannot compile
without it. So the whole fix is at the end of this report as one exact diff
(4 files). It applies cleanly (`git apply --check`), type-checks, and its tests fail
on the current tree and pass with it.

The brief's premise for fix 2 is false: numeric comparison exists and the model is
shown it. Nothing needed adding for rating or price. The one predicate the Flow could
not express is **Plus eligibility**. The reason is not the grammar: detection never
offers a column for an icon-only badge. That fix is a detection change, and it is
proposed below without being implemented (see Open questions).

No tree file was edited. Only my scratchpad and the ignored
`apps/extension/.test-build-scratch/t194-w3-overlay/` were written, and that directory
has since been removed.

## What changed and why

### Q1. What `applied`, `kept` and `rejected` count, and why they read 0

- **Definitions.** `apps/extension/src/content/extraction/filtered-answer.ts:44-63`
  defines them. `applied` counts the items the conditions were asked about. `kept`
  counts the items every condition held for, which is not the same as `recordCount`.
  `rejected` holds one count per `where` position. `unfiltered` says the read answered
  with the rejected rows because nothing survived.
- **They are counted per document, not per read.**
  `apps/extension/src/content/extraction/list-reader.ts:324-330` starts
  `applied = 0`, `kept = 0` and `rejectedEach = where.map(() => 0)` in every document.
  The comment there says as much: "these counts say what this document did and
  `filtered` says what the whole read did". The report is emitted from them at `:376`.
  A Next that loads a new document destroys the content script. The read goes on in
  the next document from the checkpoint (`list-reader.ts:290-300` →
  `apps/extension/src/shared/extraction-continuation.ts:26-56`), and that checkpoint
  carries `records`, `pagesRead`, `filtered` and `itemsSeen` but **no condition
  counts**. `readExtractionCheckpoint` (`:82-103`) rebuilds the object, so an extra
  member would be dropped anyway. The report a multi-document read answers with is
  therefore only its **last document's**.
- **Why the last document had 0.** In any document with conditions, every
  newly read item increments `applied` (`list-reader.ts:467-468`, before any
  repeat or dedupe check), so `applied: 0` means the answering document named **no
  item at all**. Three things point to that document being the store's rate-limit
  page:
  - `pagesRead: 5` with `itemsSeen: 56` across the earlier documents.
  - A `durationMs` of 14,735, which fits about 4.7 s of reading plus the full
    10,000 ms `RENDER_WINDOW_MS` (`page-render.ts:159`, `:175-187`,
    `list-wait.ts:63-72`). That window is paid only on a document with no item and
    no pager.
  - The store limits results pages to 5 in 8 s (`everything-store/state/throttle.ts:12-13`).
    The search and the soft check's "Continue shopping" already account for two of them.
  - The build's own screenshots show "going a little too fast" mid-pagination.

  The bundle cannot confirm this directly (see Not verified).
- **Not dropped and not misread.** `rejected` has two positions, and it is sized from
  the request's `where` after the domain reader (`list-reader.ts:330`). A dropped
  entry would have been removed by `domain/src/actions/extraction/read-request.ts:236-246`
  (`dropped.push(\`where.${index}\`)` at `:244`), which would leave one position. Both
  conditions are well formed for the store:
  - The attribute read with no selector reads `data-ad-id` off the card itself
    (`field-reader.ts:58`).
  - The text read uses `contains` plus `not`.

  Most likely both ran on the earlier pages. The page's own phrase uses the
  whole-read `filtered` (`content/actions/extract-list.ts:212`, "N items left out by
  where"), and that would have been correct. Only the structured `conditions` counts
  were wrong. The model was therefore told nothing false in prose; the structured
  report was what lied. The dry run had nothing to refuse, because the filters were
  valid.
- **The "silent success" point.** Once the counts travel, a read that filtered cannot
  report `applied: 0` for items it asked about. The fix is in the diff below: the
  counts are carried in the checkpoint, and the read starts from them.

### Q2. What the `where` grammar can express, and what the model is shown

- **Grammar.** Defined in `domain/src/actions/extraction/request.ts:107-134`, judged by
  `condition-match.ts:52-56`, `:89-97` and `:122-148`, used by both the page
  (`item-filter.ts:128-133`) and the resolver (`plan-resolution/extraction/conditions.ts:140-165`).
  - Numeric: `atLeast`, `atMost`, `lessThan`, `greaterThan` and numeric `equals`
    compare against the first number in the value. `"$29.99"` reads as 29.99, and
    `"4.3"` or `"4.3 out of 5 stars"` read as 4.3.
  - Text: `contains`, `startsWith`, `endsWith` and `matches`, with any-of lists.
  - Presence: `is: "present" | "absent"`, and a condition with no comparison is a
    presence test.
  - `not: true` inverts any of these.

  So `{field: "price", lessThan: 50}`, `{field: "rating", atLeast: 4}` and a badge
  presence test are all expressible.
- **What the model sees.** `domain/src/output-nodes/extract-list/catalog-text.ts:197-198`
  shows `where?: [{field: "colKey", is: "absent"}, {field: "yourKey", atLeast: 4, lessThan: 50}]`,
  which is the instruction's own bounds, followed by "where is optional: omit it, keep
  every item, narrow later. ... atMost/greaterThan/equals, contains/.../matches (text);
  not: true inverts". The resolver accepts the plan's own column keys
  (`conditions.ts:41-58`, `:187-205`). s9 kept `price` and `rating` as columns, so
  `{field: "rating", atLeast: 4}` would have resolved. **Rating and price were
  expressible, and the model did not write them.** Why it did not is **NO EVIDENCE**:
  the build's decision parameters were screened out. Four `dry_run_refused`
  completions carry no issue code, so a refused condition that the model then removed
  cannot be ruled out.
- **Plus eligibility was not expressible through the detected list.** The card marks
  Plus as `<i role="img" aria-label="Brightaisle Plus"></i>` with no text
  (`everything-store/pages/results/result-card.ts:39-44`). Column inference offers:
  - an `<img>` (src and alt),
  - an `<a href>`,
  - a form control,
  - a test id,
  - a text leaf (`apps/extension/src/content/extraction/infer-fields.ts:333-372`,
    with `isTextLeaf` at `:576-578` requiring non-empty text).

  An empty `<i>` with an accessible name matches none of them, so no column exists
  for it. The model is never shown a selector or a value (D3,
  `domain/src/runtime/llm-evidence/structure/packet.ts:1-4`), so a Flow built from the
  detected list has no way to say "Plus eligible". This is the grammar-side cause
  the brief was looking for. It is a **vocabulary (detection)** gap, not a grammar gap.

### Q3. Did 5 pages cover every results page, and what a rate limit does mid-pagination

- **Coverage.** The unfiltered search has 5 results pages
  (`everything-store/tests/scenario.test.ts:101`). A `pagesRead` of 5 whose last
  document named no item means at most 4 results documents were read. The read did
  **not** cover every page. The store also has a Next on page 2 that leads back to
  page 2 (`pages/results/pagination.ts:22`), so any read that follows Next alone stops
  with `page_repeated`.
- **Rate limit mid-pagination.** The limiter answers with a 429 page that has no card
  and no pager (`pages/challenges/throttled.ts`). The read waits out the 10 s render
  window, finds no item and no control, and stops with `paginationStop:
  "list_vanished"` (`list-reader.ts:549-550`). The phrase for it is
  `content/actions/extract-list.ts:274`: "a rate limit, a check page or an error, not
  the list ending". So the stop is **named**, but it is **not a fault**:
  - the action is `succeeded`,
  - `truncated` is `false`,
  - `Retry-After` is not honoured.

  The lane's snapshot also drops `paginationStop`: `packages/test-runner/src/flow-lane/extraction-read.ts:76`
  destructures `conditions` but not `paginationStop` or `order`, so the bundle never
  shows it. For every reader of the snapshot, the truncation was effectively silent.

## Commands run and observed results

1. Overlay tests, patched sources (scratch runner `t194w3/run-overlay.mjs`: esbuild
   bundles the overlay test files as the extension's runner does, resolving relative
   imports as if in the tree). Command: `OVERLAY_SOURCES=1 node run-overlay.mjs`.
   Output: `sources: overlay (patched)` / `# tests 19` / `# pass 19` / `# fail 0`.
2. The same tests against the **unpatched tree** sources: `node run-overlay.mjs`.
   Output: `# tests 19` / `# pass 15` / `# fail 4`, failing:
   - 12: "a continued read reports what its conditions did across the whole read"
   - 13: "a read that ends on a page with none of the list keeps the counts it was handed"
   - 14: "the checkpoint a filtering read hands on carries its condition counts"
   - 19: "the condition counts cross the document boundary"

   Test 13's failure prints `actual {applied: 0, kept: 0, ...}`, which is the live
   signature reproduced.
3. Type check of the overlay against the extension's `tsconfig.json`, with `rootDirs`
   `[src, overlay]`:
   `node <typescript/bin/tsc> -p t194w3/tsconfig.overlay.json` → `tsc exit=0`.
   `--listFiles` confirmed that the overlay's list-reader and test were compiled
   against the overlay's `shared/extraction-continuation.ts`.
4. `git apply --check <diff>` in the tree → no error ("apply-check ok").
5. `node scripts/structure-audit.mjs` → `structure-audit: passed (124 warning(s), 120 baselined).`,
   exit 0 (tree unchanged by me). With the patch, `list-reader.ts` goes from 665 to 686
   lines, under the 800 hard limit. Its 400-line advisory warning already exists.
   The test file is 399 lines.

## Not verified

- **Which document the read ended on.** That it was the 429 page is inferred from
  timing, the throttle arithmetic, the empty-document signature and the build's
  screenshots. `paginationStop` and `itemFaults` were not kept in the snapshot, and
  the action's comparison text is not in the bundle.
- **Whether the two conditions actually rejected items on pages 1-4.** Only
  `filtered` would say, and it is not in the snapshot either.
- **The in-tree whole-suite runs.** `pnpm --filter @fluxiq-web-extension/extension test`
  and the full extension check were not run, because I changed no tree file. They
  should be run after the diff is applied. The Playwright content spec
  (`e2e/content/tests/extract-list.spec.ts`) was not run, because the brief forbids
  browser runs.
- **No domain test was run**, because no domain file changed.

## Open questions or contradictions found

1. **The brief's premise for fix 2 is wrong.** Numeric comparison is already in the
   grammar, the reader, the page and the model's vocabulary. Nothing was added.
2. **Proposed next fix, not implemented: offer the icon-only mark as a column.** It
   belongs in `infer-fields.ts` `elementSources` (`:333-372`) and is my file, but I
   held it back for two reasons:
   - It changes detection output for all ten scenarios. It could displace another
     partial column under `RESERVED_PARTIAL_FIELDS` (8).
   - It can only be proven by the browser content spec, which this brief forbids.

   The change: add a branch before the text-leaf case for an element with no words
   and a non-empty `aria-label`, i.e. `role="img"` or an empty element:
   `sources.push({ kind: "attribute", label: \`${label} aria-label\`, selector, attribute: "aria-label", sensitive })`.
   This mirrors `<img>` alt. The condition would then be `{field: <key>, is: "present"}`.

   There is a remaining D3 question for the supervisor. A path label with hashed
   classes does not tell the model that the column means "Plus". The model sees
   labels and coverage but no values, so it would have to guess. Labelling a mark
   column with its constant accessible name, as a header labels a column, would fix
   that, but it needs a D3 decision.
3. **Q3 follow-ups, outside this brief's fix list.**
   - Treat `list_vanished` after page 1 as a shortfall (`truncated: true`, or a named
     validation failure) in `content/actions/extract-list.ts`, which is not my file.
   - Optionally honour the throttle page by waiting and retrying once, in
     `pagination.ts`, which is my file.
   - Add `paginationStop` and `order` to the lane projection at
     `packages/test-runner/src/flow-lane/extraction-read.ts:76`, so a bundle can show
     how a read ended.
4. **Mixed builds.** A checkpoint without `conditions` restarts the counts at 0, as
   before. That is fine within one extension build.

## Proposed diff (apply from the repository root; verified as described above)

Files: `apps/extension/src/shared/extraction-continuation.ts` (not owned by this
brief), `apps/extension/src/shared/tests/extraction-continuation.test.ts` (not owned),
`apps/extension/src/content/extraction/list-reader.ts`, and
`apps/extension/src/content/extraction/tests/list-reader.test.ts`.

```diff
diff --git a/apps/extension/src/shared/extraction-continuation.ts b/apps/extension/src/shared/extraction-continuation.ts
index c2efbdc..7fc85ca 100644
--- a/apps/extension/src/shared/extraction-continuation.ts
+++ b/apps/extension/src/shared/extraction-continuation.ts
@@ -53,6 +53,30 @@ export type ExtractionCheckpoint = {
    * worse than either (`content/extraction/list-reader.ts`).
    */
   itemsSeen?: number | undefined;
+  /**
+   * What the request's `where` conditions did so far, across every document
+   * read: items asked about, items every condition held of, and one rejection
+   * count per condition, positionally (C5).
+   *
+   * It travels for the reason `itemsSeen` does, and its absence was measured.
+   * Live run `run-munnhi5q-4867dabe` read five pages, the last a document with
+   * no card on it (the store rate-limits a fast sweep), and reported
+   * `conditions: {applied: 0, kept: 0, rejected: [0, 0]}` for a read whose two
+   * conditions had run on every card of the pages before: the counts restarted
+   * at each document, so the read answered with its last document's, and a
+   * read that filtered looked like one whose filters did nothing.
+   *
+   * Absent in a checkpoint from a read that named no conditions, or from a page
+   * build that did not carry them.
+   */
+  conditions?: ExtractionCheckpointConditions | undefined;
+};
+
+/** The condition counts a checkpoint carries: the report's counts without `unfiltered`, which only the read's answer can decide. */
+export type ExtractionCheckpointConditions = {
+  applied: number;
+  kept: number;
+  rejected: number[];
 };
 
 /**
@@ -81,7 +105,7 @@ export type ExtractionCheckpointMessage = {
  */
 export function readExtractionCheckpoint(value: unknown): ExtractionCheckpoint | undefined {
   if (typeof value !== "object" || value === null) return undefined;
-  const { records, pagesRead, scrolls, missingFields, filtered, itemsSeen } = value as Record<string, unknown>;
+  const { records, pagesRead, scrolls, missingFields, filtered, itemsSeen, conditions } = value as Record<string, unknown>;
   if (!Array.isArray(records) || !records.every(isRecord)) return undefined;
   if (!isCount(pagesRead) || !isCount(scrolls)) return undefined;
   if (!Array.isArray(missingFields) || !missingFields.every((name) => typeof name === "string")) return undefined;
@@ -92,16 +116,29 @@ export function readExtractionCheckpoint(value: unknown): ExtractionCheckpoint |
   // items. Refusing rather than dropping the member is what keeps an absent count
   // meaning one thing: not counted, never counted wrongly.
   if (itemsSeen !== undefined && !isCount(itemsSeen)) return undefined;
+  // And again: sent but unreadable is refused, never read as no conditions.
+  const conditionCounts = conditions === undefined ? undefined : conditionCountsValue(conditions);
+  if (conditions !== undefined && conditionCounts === undefined) return undefined;
   return {
     records: records.map((record) => ({ ...record })),
     pagesRead,
     scrolls,
     missingFields: [...missingFields],
     ...(filtered === undefined ? {} : { filtered }),
-    ...(itemsSeen === undefined ? {} : { itemsSeen })
+    ...(itemsSeen === undefined ? {} : { itemsSeen }),
+    ...(conditionCounts === undefined ? {} : { conditions: conditionCounts })
   };
 }
 
+/** A checkpoint's condition counts, copied, or `undefined` when any member is not a count. */
+function conditionCountsValue(value: unknown): ExtractionCheckpointConditions | undefined {
+  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
+  const { applied, kept, rejected } = value as Record<string, unknown>;
+  if (!isCount(applied) || !isCount(kept) || kept > applied) return undefined;
+  if (!Array.isArray(rejected) || !rejected.every(isCount)) return undefined;
+  return { applied, kept, rejected: [...rejected] };
+}
+
 function isRecord(value: unknown): value is ExtractionCheckpointRecord {
   if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
   return Object.values(value).every((field) => typeof field === "string" || field === null);
diff --git a/apps/extension/src/shared/tests/extraction-continuation.test.ts b/apps/extension/src/shared/tests/extraction-continuation.test.ts
index f284560..644d156 100644
--- a/apps/extension/src/shared/tests/extraction-continuation.test.ts
+++ b/apps/extension/src/shared/tests/extraction-continuation.test.ts
@@ -51,3 +51,24 @@ test("the item count crosses the document boundary, and an absent one stays abse
   // as one rather than folded into absence.
   assert.equal(readExtractionCheckpoint({ ...CHECKPOINT, itemsSeen: 0 })?.itemsSeen, 0);
 });
+
+test("the condition counts cross the document boundary, and unreadable ones refuse the checkpoint rather than becoming none", () => {
+  // Without them a read that filtered four pages and ended on a fifth with no
+  // item reported `applied: 0` (`run-munnhi5q-4867dabe`).
+  const counted = { ...CHECKPOINT, conditions: { applied: 56, kept: 28, rejected: [20, 8] } };
+  const read = readExtractionCheckpoint(counted);
+  assert.deepEqual(read, counted);
+  assert.notEqual(read?.conditions?.rejected, counted.conditions.rejected);
+  assert.equal("conditions" in (readExtractionCheckpoint(CHECKPOINT) ?? {}), false);
+  for (const conditions of [
+    null,
+    [],
+    { applied: 1, kept: 1 },
+    { applied: -1, kept: 0, rejected: [] },
+    { applied: 1, kept: 2, rejected: [] },
+    { applied: 2, kept: 1, rejected: [1.5] },
+    { applied: 2, kept: 1, rejected: "1" }
+  ]) {
+    assert.equal(readExtractionCheckpoint({ ...CHECKPOINT, conditions }), undefined, JSON.stringify(conditions));
+  }
+});
diff --git a/apps/extension/src/content/extraction/list-reader.ts b/apps/extension/src/content/extraction/list-reader.ts
index 196256a..9a606d8 100644
--- a/apps/extension/src/content/extraction/list-reader.ts
+++ b/apps/extension/src/content/extraction/list-reader.ts
@@ -298,7 +298,8 @@ export async function extractList(request: WebAutomationExtractListRequest, opti
         scrolls: progress.scrolls,
         missingFields: [...missing].sort(),
         filtered,
-        ...(seen === undefined ? {} : { itemsSeen: seen })
+        ...(seen === undefined ? {} : { itemsSeen: seen }),
+        ...(rejects === undefined ? {} : { conditions: { applied, kept, rejected: [...rejectedEach] } })
       });
     };
   }
@@ -321,13 +322,19 @@ export async function extractList(request: WebAutomationExtractListRequest, opti
   // And neither can it say, of the first, whether it waited for the list at all.
   let listWait: ListWait | undefined;
   let filtered = resume?.filtered ?? 0;
-  // Items the conditions were asked about in this document, and how many of
-  // them each condition rejected. A continued read carries its predecessor's
-  // `filtered` and not its rejected rows, so these counts say what this
-  // document did and `filtered` says what the whole read did.
-  let applied = 0;
-  let kept = 0;
-  const rejectedEach = (request.where ?? []).map(() => 0);
+  // Items the conditions were asked about, and how many of them each condition
+  // rejected, across the whole read: a continued read starts from the counts its
+  // predecessor checkpointed, as it starts from its `filtered` and `itemsSeen`.
+  // Until 2026-09-30 these restarted at each document, so a read that paged
+  // through documents of cards and ended on one with none -- the store's
+  // rate-limit page, by every sign the bundle kept -- reported `applied: 0`, as
+  // if its conditions had done nothing (`run-munnhi5q-4867dabe`). Its rejected
+  // rows still do not travel, which is `filtered-answer.ts`'s concern, not the
+  // count's.
+  const carried = carriedConditionCounts(resume, request.where?.length ?? 0);
+  let applied = carried.applied;
+  let kept = carried.kept;
+  const rejectedEach = [...carried.rejected];
 
   // Items the selector named, counted once each, whichever page or scroll named
   // them: a set rather than a running sum, because a `loadMore` or `scroll` read
@@ -554,6 +561,20 @@ export async function extractList(request: WebAutomationExtractListRequest, opti
   return outcome({ timedOut });
 }
 
+/**
+ * The condition counts a continued read starts from: its predecessor's, or
+ * zeros for a read that began here, and zeros too for counts that do not fit
+ * this request's `where` -- one rejection count per condition is the only shape
+ * a positional count can be added to, and the same request always has it.
+ */
+function carriedConditionCounts(resume: ExtractionCheckpoint | undefined, conditions: number): { applied: number; kept: number; rejected: number[] } {
+  const carried = resume?.conditions;
+  if (carried === undefined || carried.rejected.length !== conditions) {
+    return { applied: 0, kept: 0, rejected: Array.from({ length: conditions }, () => 0) };
+  }
+  return { applied: carried.applied, kept: carried.kept, rejected: [...carried.rejected] };
+}
+
 /** Whether a throw is a refusal of the whole read, which carries its own failure record, rather than a page fault. */
 function isRefusal(error: unknown): boolean {
   return error instanceof Error && typeof (error as { failure?: unknown }).failure === "object" && (error as { failure?: unknown }).failure !== null;
diff --git a/apps/extension/src/content/extraction/tests/list-reader.test.ts b/apps/extension/src/content/extraction/tests/list-reader.test.ts
index 8e91e9a..91171cf 100644
--- a/apps/extension/src/content/extraction/tests/list-reader.test.ts
+++ b/apps/extension/src/content/extraction/tests/list-reader.test.ts
@@ -312,3 +312,88 @@ test("a read that names neither dedupe nor sort carries no order report and answ
     page.restore();
   }
 });
+
+// And the condition report across a document boundary. Live run
+// `run-munnhi5q-4867dabe` read the everything store's results with two `where`
+// conditions, ended on a document with no card on it (a rate-limit page), and
+// reported `conditions: {applied: 0, kept: 0, rejected: [0, 0]}`: the counts
+// restarted at each document, so the read answered with its last document's and
+// a read that had filtered four pages looked like one whose filters did nothing.
+
+/** What the four documents before the rate-limit page handed over: 56 cards asked about, 28 kept, the first condition rejecting 20 and the second 8. */
+const FILTERED_SO_FAR: ExtractionCheckpoint = {
+  ...START,
+  records: Array.from({ length: 28 }, (_, index) => ({ title: `T${index}`, posted: "", url: `/t${index}` })),
+  pagesRead: 4,
+  itemsSeen: 56,
+  filtered: 28,
+  conditions: { applied: 56, kept: 28, rejected: [20, 8] }
+};
+
+/** JOBS with a second condition, so the report has two positions as the live read did. */
+const TWO_CONDITIONS: WebAutomationExtractListRequest = {
+  ...JOBS,
+  where: [{ read: attribute("sponsored"), is: "absent" }, { field: "title", contains: ["ear tips", "charging case"], not: true }]
+};
+
+test("a continued read reports what its conditions did across the whole read, not only in its own document", async () => {
+  const page = fakeRows([
+    { title: "Earbuds", posted: "", url: "/e" },
+    { title: "Sponsored earbuds", posted: "", url: "/ad", sponsored: "yes" },
+    { title: "Foam ear tips", posted: "", url: "/tips" }
+  ]);
+  try {
+    const outcome = await extractList(TWO_CONDITIONS, { resume: FILTERED_SO_FAR });
+    assert.deepEqual(outcome.conditions, { applied: 59, kept: 29, rejected: [21, 9], unfiltered: false });
+    assert.equal(outcome.filtered, 30);
+    assert.equal(outcome.records.length, 29);
+  } finally {
+    page.restore();
+  }
+});
+
+test("a read that ends on a page with none of the list keeps the counts it was handed, rather than reporting conditions that applied to nothing", async () => {
+  // The rate-limit page: no item, no control. The read ends on it (here on its
+  // deadline, which is the quickest way a stand-in page can end it), and what
+  // its conditions did is still what they did on the four pages before it.
+  const page = fakeRows([]);
+  try {
+    const outcome = await extractList(TWO_CONDITIONS, { resume: FILTERED_SO_FAR, timeoutMs: 100 });
+    assert.equal(outcome.records.length, 28);
+    assert.deepEqual(outcome.conditions, { applied: 56, kept: 28, rejected: [20, 8], unfiltered: false });
+    assert.notDeepEqual(outcome.conditions?.rejected, [0, 0]);
+  } finally {
+    page.restore();
+  }
+});
+
+test("the checkpoint a filtering read hands on carries its condition counts, its predecessor's included", async () => {
+  const taken: ExtractionCheckpoint[] = [];
+  const page = fakeList(["E", "F"], { selector: ".more", onClick: () => page.add("G") });
+  try {
+    const outcome = await extractList(
+      { ...READ, where: [{ field: "name", equals: "F", not: true }], paginate: { mode: "loadMore", control: ".more", maxPages: 3 } },
+      {
+        resume: { records: [{ name: "A" }], pagesRead: 1, scrolls: 0, missingFields: [], itemsSeen: 2, filtered: 1, conditions: { applied: 2, kept: 1, rejected: [1] } },
+        checkpoint: async (progress) => { taken.push(progress); }
+      }
+    );
+    assert.equal(taken.length, 1);
+    assert.deepEqual(taken[0]?.conditions, { applied: 4, kept: 2, rejected: [2] }, "two handed over plus E kept and F rejected");
+    assert.deepEqual(outcome.conditions, { applied: 5, kept: 3, rejected: [2], unfiltered: false });
+  } finally {
+    page.restore();
+  }
+});
+
+test("counts that do not fit the request's conditions are not added to, and a read that began here starts from zero", async () => {
+  const page = fakeRows([{ title: "Earbuds", posted: "", url: "/e" }]);
+  try {
+    const misfit = await extractList(TWO_CONDITIONS, { resume: { ...START, conditions: { applied: 9, kept: 9, rejected: [0] } } });
+    assert.deepEqual(misfit.conditions, { applied: 1, kept: 1, rejected: [0, 0], unfiltered: false });
+    const fresh = await extractList(TWO_CONDITIONS, { resume: START });
+    assert.deepEqual(fresh.conditions, { applied: 1, kept: 1, rejected: [0, 0], unfiltered: false });
+  } finally {
+    page.restore();
+  }
+});
```
