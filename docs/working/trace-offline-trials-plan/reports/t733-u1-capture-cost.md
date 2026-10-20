# t733-u1: snapshot identity capture cost

## Outcome

Done. Inside a capture scope (`withSelectorMemo`), the row climb in `identity/control-row/` now looks answers up in an index built once per root instead of walking the page. `record.ts` reads each row title and each record's words once per scope. Outside a scope, every function walks the live page exactly as before. All 181 identity tests pass. The new cost test failed on the old code and passes now.

## What changed and why

- **Moved `identity/control-row.ts` to `identity/control-row/`.** The file now sits in a feature directory with a barrel. `record.ts` still imports `./control-row`, which now resolves to the barrel.
  - `control-row.ts`: `controlRow` and `ControlRow`. The rule itself is unchanged.
  - `sole-ancestors.ts`: `soleAncestors` and `SoleAncestors`. Results are memoised per control per scope, so `controlRow`, `recordSubject`, `repeatedRowOf` and `inNamedRow` share one climb. Each call returns a copy of the ancestors array. Inside a scope there are three paths:
    1. **Nameless control:** returns no ancestors, as before.
    2. **No reachable alike:** used when the group has no member other than the control, or when every other member is an ancestor of the control or inside it. The walk never visits those, and this is checked one member at a time for groups of up to 8. No walk runs. At each level the code checks `desc(p_i) - desc(control) - (i+1) > 2000`; if true the climb is out of budget, otherwise it pushes the parent and continues to the depth bound or the top. Before each visit the walk tests `budget <= 0`, so it runs out exactly when the cumulative count is above 2,000. The boundary tests use 2,000 and 2,001.
    3. **Otherwise:** the same walk in the same order, but an element counts as alike when it is in the group `Set` (`element !== control && members.has(element)`). No name is computed during the walk.
    If a descendant count is missing, the code falls back to the walk; this cannot happen for a root's own elements. Outside a scope the code is the original `alikeTo` and walk.
  - `captured-alike.ts`: `capturedAlike(control)` returns `undefined` outside a scope. Inside one it builds a per-scope index for `control.getRootNode()`:
    - It enumerates the root's light tree through `children`, with no shadow descent.
    - It reads every element's kind (`controlKind`) once.
    - It names elements (`accessibleNameFor`) and groups them by name lazily, the first time a control of that kind asks. Each element is named once per scope.
    - It keeps every element's descendant count, plus the root itself when the root is an element.
  - `control-kind.ts`, `row-bounds.ts` (`{ depth: 12, scan: 2000 }`) and `index.ts` (barrel).
- **New `identity/scoped-memo.ts`.** `scopedMemo<K, V>()` keeps a table per scope through a `WeakMap<SelectorMemo, Map>`, the same pattern as `hasOwnWords` in `lead-statements.ts`. Outside a scope it computes every time.
- **`identity/record.ts`.** `rowTitleElement` and `recordText` are memoised per element per scope, and the header paragraph that said "Nothing here is memoized" is rewritten. I memoised `recordText` as well as what the brief asked for: every control in a record re-reads the same record's words, and inside a read-only scope the answer is exact. It is 750 lines, under the 800-line limit.
- **Comments only:** `identity/index.ts` and `identity/own-run.ts` now say `control-row/` instead of `control-row.ts`.
- **Tests:**
  - `identity/tests/capture-scope-equivalence.test.ts` (7 tests). Each test compares `soleAncestors`, `controlRow`, `recordIdentity`, `recordSubject`, `repeatedRowOf` and `agreesWithRecordedRecord`, comparing elements by identity. It does this outside a scope and twice inside one, so the second round reads the memo. It also first asserts that the fixture really reaches the case it is named for. The fixtures cover:
    - a twin found;
    - a far twin (header and footer);
    - a nameless control;
    - an alike element nested inside the control, and an alike ancestor;
    - a lone control;
    - no twin within budget (50 unique links);
    - a budget cut short by a 2,100-node sibling, with and without a twin;
    - the exact 2,000 and 2,001 boundaries;
    - the depth bound;
    - controls in a shadow root, next to a light-tree control with the same name.
  - `identity/tests/capture-scope-cost.test.ts`:
    - 3,000 uniquely named links, described with `recordIdentity` and `recordSubject` inside one scope. It counts `children` reads and `getAttribute` calls by patching the stub prototypes in the test only, and checks the counts after every link. The limit is a one-time allowance per root (2 children reads and 16 attribute reads per page element) plus 8 children reads and 150 attribute reads per link.
    - A second test checks that outside a scope, a change to the page is seen.
  - `identity/control-row/tests/captured-alike.test.ts` (3 tests): no index outside a scope; group membership by kind, name and root; descendant counts; a nameless control.

## Commands run and observed results

- Test first, on the old code with only the new tests added. Command: `EXTENSION_TEST_BUILD_LABEL=t733u1 node scripts/test-extension.mjs src/content/identity/tests/capture-scope` (from `apps/extension`). Output:
  `not ok 1 - describing 3,000 uniquely named links in one scope costs a constant per link, not a walk of the page` / `error: '108256 attributes reads after 2 links; at most 96448 allowed'`; `# pass 8`, `# fail 1`. The 8 passes are the equivalence tests and the outside-scope test, which pass on the old code as expected. The limits at that point were looser (4 children, 200 attributes per link); I tightened them after measuring.
- After the fix, measured with a temporary log that I then reverted. Command: `EXTENSION_TEST_BUILD_LABEL=t733u1 node scripts/test-extension.mjs src/content/identity/tests/capture-scope-cost`. Output: `COUNTS {"children":12004,"attributes":288003} 6003`, which is about 4 children reads and 96 attribute reads per link, in 764 ms for 3,000 links on the stub.
- `EXTENSION_TEST_BUILD_LABEL=t733u1 node scripts/test-extension.mjs src/content/identity` printed `# tests 181`, `# pass 181`, `# fail 0`.
- `cd apps/extension && node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`: one error, in a file I do not own: `src/background/connection/gateway-payloads.ts(137,37): error TS2345 ... Property 'sensitive' is missing`.
- `node node_modules/typescript/bin/tsc -p tsconfig.test.json --noEmit`: the same error, plus `src/background/connection/tests/gateway-payloads.test.ts(129,44): error TS2344: Type '"sensitive"' does not satisfy the constraint 'never'`. Both files are outside my scope and appear to come from the concurrent sensitive-marker work. No errors in `content/identity`.
- `node scripts/structure-audit.mjs` (repo root) printed `structure-audit: passed (211 warning(s), 625 baselined).` None of the warnings is about the new files. `identity/` stays at 21 source files. `identity/tests/` went from 17 to 19 files, which was already past the advisory threshold. Before my change the audit printed 210 warnings. The extra warning is not on any path I touched. Other workers were editing the same tree at the same time.

## Not verified

- No live browser or real-DOM run. The real `children` and `getRootNode` on `Document` and `ShadowRoot` are assumed to match the stub, which models them on the DOM.
- The 372 s → seconds result was not measured on the 6,000-anchor page or a CPU profile. The only evidence is the stub's read counts.
- Groups with reachable alike controls still walk, at no name cost but up to 2,000 `Set` lookups each. A page where many controls each have one distant twin pays that per control. The descendant-count derivation could be extended to such groups with a reverse-preorder index, finding the twin by binary search. I did not do this because the brief prescribed the walk for that case.
- No full suites, by design.

## Open questions or contradictions found

- I ran `git mv` for the move, so the rename `identity/control-row.ts -> identity/control-row/control-row.ts` is **staged** in the index. Nothing was committed.
- Two historical reports still name `identity/control-row.ts`: `docs/working/state-aware-recovery-plan/reports/t463-...md` and `docs/working/language-driven-flow-loop-plan/debugs/run-mvecxeci-...md`. I did not touch them because they are outside my scope.
