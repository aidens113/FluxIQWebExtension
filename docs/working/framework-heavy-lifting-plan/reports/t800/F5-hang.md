# F5-hang report

## Outcome
Done.

## Cause
Test defect in the new `apps/extension/src/content/extraction/tests/item-filter-date.test.ts`, not product code. The test "a within on the page is measured from the page's clock" called `t.mock.method(Date, "now", ...)` twice in one test without restoring between. The second mock wraps the first; on test end node restores in creation order, so the first mock (frozen at NOW) stays installed on `Date.now`. All test files run in one node:test process, so every later test saw a frozen clock. Test 5 of `list-reader-refused-page.test.ts` waits on a real clock (the document holding still for two seconds), so it never finished. In isolation the clock is never frozen, so the single file passed (~4s). The item-filter.ts / read-date.ts changes were not at fault.

## Fix
Same test: one mock reading a mutable `clock` variable that the test advances. Test intent unchanged. No product code or Core touched.

## Commands and results
- Reproduced: full `content/extraction` run stopped at `ok 279`, no `# fail` summary, until timeout.
- Single file `list-reader-refused-page` (before fix): `# pass 5 # fail 0` (duration 4.4s).
- Pair `item-filter-date` + `list-reader-refused-page` (after fix): 8 ok, `# pass 8 # fail 0`.
- `EXTENSION_TEST_BUILD_LABEL=t800 timeout 600 node scripts/test-extension.mjs content/extraction`: `# tests 437 # pass 437 # fail 0`, duration 168.6s.
- `node --max-old-space-size=6144 node_modules/typescript/bin/tsc --noEmit -p apps/extension/tsconfig.json`: exit 0, no output.
- Core contracts not touched, so vitest not run.

## Not verified
The pair run was built after the fix, so the pre-fix hang with the pair alone was not reproduced; the cause rests on the full-run hang before the fix, the node:test restore-order behaviour, and the full run passing after.

## Open
None.
