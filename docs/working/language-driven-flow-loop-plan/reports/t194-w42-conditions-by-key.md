# t194-w42: stored conditions name kept columns by key; a kind change drops the old kind's member

## Outcome

Done. Both tasks are applied and covered by tests. Every test that pins the new behaviour fails on the old source. Domain
tsc (src and tests) passes, the narrow domain tests pass, the Core evidence-loop vitest passes, Core `pnpm check` exits
0, and both structure audits pass. `read-request.ts` was not changed, because the dispatch reader already accepts
`field: <key>` with an exact match.

## What changed and why

### Domain, `domain/src/runtime/llm-evidence/plan-resolution/extraction/conditions.ts`

- `readCondition` now calls `keptKeyOf(column.key, column.field, columns.kept)`.
  - When the plan keeps a column that reads the same value as the condition's column, the condition is stored as
    `field: <kept key>`, with no `read`.
  - Otherwise it carries `read: <column spec>`, as before.
- How the kept key is chosen:
  - It prefers the key the condition found its column by, when the plan keeps that very column under that key.
  - Otherwise it takes the first kept key whose column reads the same value.
  - "Reads the same value" compares the specs as JSON with sorted keys and ignores `required`. Whether a row may lack
    the column is a question about the row. The item filter tests a condition by key against the row's value, and that
    value is `undefined` when missing, which is exactly how it tests a condition's own read
    (`apps/extension/src/content/extraction/item-filter.ts`).
- Consequences:
  - A condition naming the detected key of a kept column, such as `product-price` kept as `cost`, is stored as
    `field: "cost"`.
  - A kept key that reads a different column is never used. Example: `fields: {"stock-badge": "product-price"}` with a
    condition on the detected `stock-badge` still stores `read: BADGE`.
  - The same applies to a column kept under another reading. Example: `link: "product-link@href"` is an attribute
    spec, so a condition on the detected `product-link` keeps `read: LINK`.
- The header comment was rewritten to explain the two forms and to point at `declared-columns.ts`.
- Excluded columns: an earlier draft had a guard against naming an excluded kept column. I removed it. A handle's kept
  specs never carry `handling` (`structure/packet.ts:257`), and the item filter refuses a condition over an excluded
  column in both forms anyway.

### F34 agreement

`output-nodes/extract-list/declared-columns.ts` (`readingItsOwnColumn`) already rewrites a `field` condition over a
helper it drops into `read: <spec without required>`. A helper named by an ordering stays in `fields`, so a `field`
condition over it stays valid. The two agree, and nothing in `declared-columns.ts` changed.

### Domain tests, `plan-resolution/extraction/tests/`

- Four existing expectations were updated: `conditions.test.ts` (2 tests), `column-match.test.ts` (1) and
  `slot.test.ts` (1). Each condition over a kept column now expects `field: <kept key>`.
- New in `conditions.test.ts`:
  1. "a condition over a kept column is stored by the key the plan keeps it under, however it named the column". It
     covers four cases:
     - the detected key of a kept column;
     - the plan's own key, where `required` differs (kept `required: false`, detected `true`);
     - an `@href` attribute column that must keep `read`;
     - a column that is not kept.

     It also checks that `webAutomationExtractListRequestValue` reads the stored `where` back unchanged, which is the
     path a rerun restating `field: "cost"` takes, and that `webAutomationExtractListIssues` returns `[]`.
  2. "a condition by key over a column the declared schema then drops reads that column through its own spec". The
     resolver stores `{field: "stock"}`. `webAutomationDeclaredColumnsRead` with schema `[title]` then gives
     `fields {title}` and `where [{read: BADGE without required, is: "absent"}]`.

### Core, `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/rerun-input.ts` (cause 6a)

- New helper `oldKindMember`. When a patch object changes `kind` from one string to another, the stored member named
  after the old kind leaves with it, unless the patch writes that member again. An example is `attribute` for the kind
  `attribute`. `mergePatch` deletes it before merging. Every other member merges as before, so the withheld `selector`
  is kept.
- Core cannot know each kind's full member set. That set is the domain's vocabulary, and Core must not import the
  domain. So Core applies the one convention a kinded object states for itself: a kind owns the member named after it.
  The header comment says so and names the gap (see Open questions).
- I rejected a "learn the member set from sibling objects of the new kind" rule. It can silently drop `selector` or
  `required` when the siblings happen to lack them.
- New `describe` block in `tests/rerun-input.test.ts`, with 3 tests:
  1. `{ad: {kind: "text"}}` over `mark("data-ad-id", ".ad")` gives `{kind: "text", selector: ".ad", required: false}`.
  2. The same patch plus a condition rewritten as `{read: {kind: "text", required: false}, is: "absent"}`. The
     condition takes the changed column's merged spec, selector included, and no `attribute`.
  3. Guards for cases that must not change:
     - the same kind;
     - a kind change that writes the new kind's member;
     - a change out of a kind that owns no member;
     - the old member written again in the same patch.

## Commands run and observed results

Downstream tree `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension`:

- `heavy.sh "t194-w42 narrow tests" node .../narrow-tests.mjs <domain> t194-w42 runtime/llm-evidence/plan-resolution output-nodes/extract-list`
  - First run, after the source change and before any test edits: `# pass 112`, `# fail 4`. The 4 failures were the
    expected representation changes.
  - After the test edits and the new tests: `narrow: 19 test files`, `# pass 118`, `# fail 0`.
- Old-source check:
  - HEAD `conditions.ts` was copied in, the same narrow run was repeated, and my version was restored. The run printed
    `# pass 112`, `# fail 6`.
  - The 6 failures are the 4 updated tests and the 2 new ones.
  - `git diff --stat` confirmed the restore (`59 insertions(+), 9 deletions(-)`).
- Wider run: `... narrow-tests.mjs <domain> t194-w42 runtime/llm-evidence output-nodes actions/extraction` printed
  `narrow: 120 test files`, `# pass 836`, `# fail 0`.
- `heavy.sh "t194-w42 domain tsc" npx tsc -p domain/tsconfig.json --noEmit` printed `exit=0`.
- `heavy.sh "t194-w42 domain tsc test" npx tsc -p domain/tsconfig.test.json --noEmit` printed `exit=0`.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (154 warning(s), 118 baselined).`
  - The only warning on a file I touched is `slot.test.ts` at 462 lines. That was pre-existing; my edit changed one line
    and added none.

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`:

- From `packages/fluxiq`, `npx vitest run src/programs/automation-studio/runtime/llm/evidence-loop` printed
  `Test Files 23 passed (23)`, `Tests 134 passed (134)`.
- Old-source check:
  - HEAD `rerun-input.ts` was copied in, `npx vitest run .../tests/rerun-input.test.ts` was run, and my version was
    restored. It printed `Tests 2 failed | 11 passed (13)`.
  - The 2 failures are new tests 1 and 2. New test 3 holds guard cases that pass on both versions by design.
- `heavy.sh "t194-w42 core check" pnpm check` printed `exit=0`. The log is in the scratchpad at
  `t194-w42-core-check.log`. It printed `structure-audit: passed (211 warning(s), 349 baselined)`, plus "1 baseline
  entries can be lowered", which is not from my files.
  - `fluxiq:check` was reused from a stamp, so I also ran `heavy.sh "t194-w42 core tsc" npx tsc --noEmit -p
    tsconfig.json` in `packages/fluxiq`. It printed `exit=0`.

## Not verified

- No Lab run, no model calls and no browser run. Not checked:
  - that the page's item filter handles the `field` form in a live read (it is the existing path the dispatch
    already accepts);
  - that a live re-author now writes `field: "<key>"` in its reruns.
- The extension package's tests and e2e specs were not run. No extension source changed.
- Dataset ids change for newly resolved Flows with a condition over a kept column. `derived-record-output.ts`
  `shapeDigest` hashes `field` and `read` separately, so such a Flow's derived `datasetId` differs from the one the same
  plan resolved to before. Flows already stored keep their stored form and id. Not measured further.
- `t194-w43-declared-columns.md` exists in the tree, so another worker appears to be changing `declared-columns.ts`.
  My F34 test pins its current behaviour and could need adjusting if w43 changes that behaviour.

## Open questions or contradictions found

- Cause 6a only covers a kind that owns a member named after itself. A table column's own member is `header`, not
  `column`, so `{kind: "text"}` over `{kind: "column", header}` still keeps `header`. There are two complete fixes.
  Both are outside this brief's files.
  - The caller, `rerun-request.ts` (lane B's), passes a per-kind member list from the domain.
  - The domain's dispatch reader drops a member the field's kind does not take, instead of refusing the field. That
    would be in `actions/extraction/read-request.ts` or the field-spec reader.
- A bonus effect: `node-run/numeric-text-filter.ts` only explains `field` conditions. Resolved Flows filtering on a kept
  column now get its "reads as numbers" sentence, where before they never did.
