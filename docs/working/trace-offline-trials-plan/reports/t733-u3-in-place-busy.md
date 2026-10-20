# t733-u3: in-place link click held while a busy region it saw change is loading

## Outcome

Done. `watchInPlaceEffect` now holds its content answer, inside the settle window, while a region it saw change is still busy, and gives the answer once those regions clear. The busy-region rule lives in one shared module that both `loading.ts` and `in-place-effect.ts` use. The brief's test set passes (68/68) and the structure audit passes. Both typechecks fail, but only in `background/connection/gateway-payloads.ts` (the `sensitive` field). That file is outside this brief and comes from the concurrent dom-element/sensitivity work.

## What changed and why

- `apps/extension/src/content/evidence/painted.ts` (new): `isPainted`, moved unchanged out of `loading.ts`. It has to be its own export because `loading.ts` still uses it for indicators, and the busy rule needs it too. Under one-export-per-file that means a second new module, not the single one the brief expected. It is not in the barrel because nothing outside `evidence/` imports it.
- `apps/extension/src/content/evidence/busy-region.ts` (new): `isBusyRegion(element)` returns true when the element matches `[aria-busy='true']` and `isPainted` is true. This is the one shared rule.
- `apps/extension/src/content/evidence/index.ts`: one line added, `export { isBusyRegion } from "./busy-region";`.
- `apps/extension/src/content/evidence/loading.ts`: busy regions are now `queryComposedInOrder("[aria-busy]").filter(isBusyRegion)`. This selects the same elements in the same order as the old `queryComposedInOrder("[aria-busy='true']").filter(isPainted)`. The candidate selector only prefilters, so the value rule is written in one place. The local `isPainted` was removed and is imported instead. A header paragraph notes the split. `loadingEvidence`'s output shape and logic are otherwise untouched.
- `apps/extension/src/content/action-runtime/in-place-effect.ts`:
  - New header paragraph. It describes the job-board sequence (menu closes, the column goes `aria-busy="true"`, the fetch takes 400 ms or more, the rows swap in, the flag clears) and states the rule, the "saw change" definition, the perpetual-spinner exclusion, the in-link exclusion, the deadline fallback (a region still busy at the deadline is ignored, so the answer is the same as before the hold) and that address answers never wait.
  - `busyCandidates` is collected in two ways:
    - from attribute records whose `attributeName === "aria-busy"` and whose target is outside the link (`structuralChange === "page"`);
    - from elements added outside the link, plus their descendants, that carry an `aria-busy` attribute of any value. A candidate holds only while `isBusyRegion` is true, so an element added with `"false"` never holds.
  - `check()` returns `undefined` when `!final && stillBusy()`, which means some candidate is `isConnected && isBusyRegion`. This happens after the structure/dirty gate and before the text read, and it leaves `dirty` set so the text is read once the regions clear.
- Tests:
  - `action-runtime/tests/in-place-effect.test.ts`: the stub-DOM harness gained `getAttribute`, `hasAttribute`, `matches` (attribute selectors), `parentElement`, `isConnected`, `getBoundingClientRect`, `removeChild`, a `setAttribute` and a `remove` helper, and `attributeName` on records. There is also a `jobBoard()` fixture and six new tests.
  - `evidence/tests/busy-region.test.ts` (new): four tests of the shared rule.
  - The `getComputedStyle` stubs are installed per test, not in hooks. A top-level `beforeEach` in node:test runs before every test of every file in the same run. My first version did that and broke `set-apart.test.ts` and my own tests when the files ran together.

## Commands run and observed results

Test-first: the new tests were added before any source change and run against the old `in-place-effect.ts`.
`EXTENSION_TEST_BUILD_LABEL=t733u3 node apps/extension/scripts/test-extension.mjs src/content/action-runtime/tests/in-place-effect.test.ts` printed `# tests 16 # pass 12 # fail 4`:
- not ok 11, "the menu closing is not the answer while the results column it marked busy is still loading";
- not ok 12, `'answered after 0 ms, before the rows landed'`;
- not ok 13, the added busy element did not hold;
- not ok 16, `'answered after 0 ms, before the deadline'`.

Tests 14 (perpetual spinner) and 15 (busy inside the link) passed before the change, as expected, because they guard against the hold overreaching.

After the change:
- `EXTENSION_TEST_BUILD_LABEL=t733u3 node apps/extension/scripts/test-extension.mjs src/content/action-runtime/tests/in-place-effect.test.ts src/content/evidence/tests` exited 0 and printed `# tests 68 # pass 68 # fail 0` (duration about 4.5 s).
- `cd apps/extension && node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` exited 2 with one error:
  - `src/background/connection/gateway-payloads.ts(137,37): error TS2345 ... Property 'sensitive' is missing ... OptionalFields<WireElementTarget>`.
  - This comes from the concurrent work on `shared/dom-element.ts` and sensitivity. There are no errors in any file I own.
- `node node_modules/typescript/bin/tsc -p tsconfig.test.json --noEmit` exited 2 with the same error, plus one more in the same area:
  - `src/background/connection/tests/gateway-payloads.test.ts(129,44): error TS2344: Type '"sensitive"' does not satisfy the constraint 'never'`.
  - Again, there are no errors in any file I own.
- `node scripts/structure-audit.mjs` (repo root) printed `structure-audit: passed (211 warning(s), 625 baselined).` and exited 0. The one warning on an owned file is advisory: `[file-lines] apps/extension/src/content/action-runtime/tests/in-place-effect.test.ts: 480 lines is past the 400-line advisory threshold.`

## Not verified

- No browser run. The headed click.spec in-place row on job-board belongs to the lead. The stub DOM does not show that Chrome delivers the `aria-busy` attribute record with `attributeName`, or that job-board's column is painted while busy.
- `loadingEvidence`'s output was not exercised by a unit test, because it needs a real `document`, `queryComposedInOrder` and `selectorFor`. Equivalence rests on reading the code: `[aria-busy]` filtered by `matches("[aria-busy='true']") && isPainted` gives the same set and order as before.
- No full suites were run, per the brief.

## Open questions or contradictions found

- The brief allowed "a new focused module", but one-export-per-file needed two (`painted.ts` and `busy-region.ts`), because `isPainted` is still shared with the loading indicators.
- `in-place-effect.test.ts` is now 480 lines, past the 400-line advisory threshold. The audit treats this as a warning, not a failure. Splitting it would mean moving the fake DOM into a test-support file such as `tests/in-place-page.ts`, which this brief does not own.
- The in-place watch uses the global `getComputedStyle`, through `isPainted`, while `composed-rendered-text.ts` uses `document.defaultView`. In a content script both are the same window, so I left it as it was.
