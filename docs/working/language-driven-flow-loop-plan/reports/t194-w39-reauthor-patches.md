# t194-w39: the re-author's rerun patches

## Outcome

Done. Both parts are fixed in Core's merge (`rerun-input.ts`). One description clause was added in `amendment.ts`. Narrow
tests pass, and every new test fails on the old source. Core `pnpm check` exits 0 and the structure audit passes. Key
resolution belongs to the domain, so the domain-side change is a proposed diff below and is not applied.

## What changed and why

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`, under `packages/fluxiq/src/programs/automation-studio/runtime/`:

- `llm/evidence-loop/rerun-input.ts`
  1. **The patch shape.** The previous argument can be a node call (it has `node` and an object `parameters`). When the
     patch names none of `node`, `parameters` or `consequences`, it is now read as `{parameters: patch}`. A patch that
     names one of them is read as written. So is an argument that is not a node call. A mixed patch
     (`{parameters, extractList}`) still reaches the domain as written. The domain refuses it `unexpected_input_keys`
     with `instead: CALL_KEYS`, which is the expected-keys information the brief asks for. No new refusal was added.
  2. **`where` rewritten from the withheld copy.** A re-author's steps are the Flow's nodes with their full parameters
     (`node-tools/draft-from-flow.ts`). The model reads them with denied keys removed (`harness/draft-screen.ts`), which
     for the web means `selector`. An object patch merges, so it keeps those keys. A list patch replaced the whole list,
     so every rewritten condition lost its `read.selector`.

     Now, when a patch writes a list over a stored list, each object **inside** an item takes the full stored object
     from the first of these sources:

     - The stored item it restates. An object restates a stored one when it holds a subset of the stored keys with equal
       values. When several stored items qualify, the order of preference is: same position and same keys, then the
       only one with the same keys, then the only one, then the same position, but only when the list kept its length.
     - The single entry of a sibling map that it restates, read after the merge. This is the "by key" case: a condition
       rewritten against a column that the same patch changed (for example `fields.plus` with `attribute` changed from
       `aria-label` to `alt`) takes that column's merged spec, selector included.

     Nothing else is filled in:
     - A top-level key that the item itself leaves out (for example `not`) stays out.
     - An object with no unique match runs exactly as written, so a guess never puts one column's selector under
       another column's condition.
     - An empty object restates nothing.

     Core still resolves no keys.
- `flow-draft/amendment.ts:140` (the `input` description) gained one clause: "Only the keys that change, and a node's
  parameters may be written without parameters around them; a list replaces whole; null removes a key."
- `llm/evidence-loop/tests/rerun-input.test.ts` has 5 new tests plus 1 new expectation in the existing description
  test. The fixture is run 12's real `where`: 5 conditions, with the `read` specs the model wrote copied from the dump
  `build-2026-10-01T23-38-48-822Z-30488.jsonl`.

### Which layer resolves keys today

Core resolves none. Its merge is RFC 7386, and lists are replaced whole. The domain resolves keys in two places:

- `plan-resolution/extraction/conditions.ts` (`readCondition` → `conditionColumn`) handles a handle-named `extractList`.
  It tries the detected key, then the plan's kept key, then a guess. It emits `{read: <column spec with selector>}`,
  never `field`. Core resolves Flow nodes through it, so the stored Flow, and therefore the re-author's step, carries
  `read` specs.
- `actions/extraction/read-request.ts` handles a literal request's `field: <key of fields>`, with fuzzy key resolution.

So on a rerun in the re-author, a condition can name a column by key only if the model writes `field: "rating"`. The
model never does, because it is shown `read: {kind:"text",required:true}`. The proper fix is to show conditions by key.
That is a domain change, so it is proposed here and not applied:

```diff
--- domain/src/runtime/llm-evidence/plan-resolution/extraction/conditions.ts
@@ readCondition
-  const column = conditionColumn(named, columns, webExtractionComparedShape(...), path);
+  const column = conditionColumn(named, columns, webExtractionComparedShape(...), path);
   if (!column.ok) return column;
+  // A column the plan keeps is named by the plan's own key, so the stored Flow
+  // (and the copy a re-author is shown) says `field: "rating"`, which a rerun
+  // can restate, and which the literal reader resolves against `fields`.
+  const keptKey = Object.hasOwn(columns.kept, column.key) && sameSpec(columns.kept[column.key], column.field)
+    ? column.key
+    : Object.entries(columns.kept).find(([, spec]) => sameSpec(spec, column.field))?.[0];
   ...
-      field: undefined,
-      read: column.field,
+      field: keptKey,
+      read: keptKey === undefined ? column.field : undefined,
```

`sameSpec` compares by JSON. A column that is not kept keeps `read`. That is the case the file's own comment protects,
and it is the case Core's restoration now covers. Caveat: if cause 8's fix (store only the authored schema's columns)
lands, it must keep any column a condition names by key, or the reference dangles.

## Commands run and observed results

All from the Core tree.

- From `packages/fluxiq`: `npx vitest run src/programs/automation-studio/runtime/flow-draft src/programs/automation-studio/runtime/llm/evidence-loop`
  printed `Test Files 32 passed (32)`, `Tests 209 passed (209)`.
- Old-source check: the HEAD versions of `rerun-input.ts` and `amendment.ts` were copied into the tree, the test run,
  and the new versions restored. It printed `Tests 6 failed | 4 passed (10)`. The 6 failures are exactly the 5 new tests
  plus the description test that gained the new expectation.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w39 core check" pnpm check` exited 0 (`exit=0`).
  - The first run failed with 2 TS2353 errors in my test (`where` was inferred as `{read}[]`). After fixing them it
    passed. `fluxiq:check` and `web:check` were built, and the node test runner printed `# fail 0`.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (211 warning(s), 349 baselined)`. It also printed
  "1 baseline entries can be lowered", which does not come from my files.

## Not verified

- No Lab run and no model calls. It is not proven that a live re-author now gets filtered reruns. That also depends on
  cause 1 (reruns run on page 5), which is lane B's.
- Cause 6a is not addressed: `ad: {kind:"text"}` merging over `{kind:"attribute", attribute, selector}` keeps
  `attribute`. The brief did not ask for it.
- The domain diff above is not applied or compiled.

## Open questions or contradictions found

- The brief says "cause 4", but in the debug's cause table these are causes 5 (shape) and 6b (`where`). Cause 4 there is
  the judge's `maxPages` sentence.
- The restoration is structural and does not know the domain's denied-key list. That list lives in the harness
  (`context-packet.ts`), and it cannot be threaded through `rerun-request.ts` or `evidence-loop.ts`, which this brief
  must not touch. A stricter version would restore only the withheld keys, if lane B passed `deniedKeys` to
  `automationStudioLlmEvidenceRerunInput`.
