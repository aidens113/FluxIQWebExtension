# t194-w32: a plan's page bound kept; a decimal comma read as written

## Outcome

Done. Both gaps are fixed and covered by unit tests. Each new unit test fails on the HEAD source and passes on the new source. The rotterdam G2 row passes, and its `test.fail` marker is removed. The kestrel G3 row now "passes unexpectedly", as the brief predicted.

## What changed and why

### Rotterdam G2: the plan's page bound is kept (`domain/src/runtime/llm-evidence/plan-resolution/extraction/slot.ts`)

- `keptPagination` no longer drops the plan's bound when `paginate.mode` differs from the detected mode. The detected control is still the one read. The bound is the detected mode's own key (`maxScrolls` for scroll, `maxPages` otherwise), and falls back to the other key when that one is absent. It goes through the same check as before: a safe integer from 1 to `WEB_AUTOMATION_EXTRACT_MAX_PAGES`, otherwise `malformed`.
- Where the old rule came from: `git blame` shows lines 216-217 date from `d9d23e3d` (2026-09-16, "Let a created scraper name the detected list and its columns by handle"). Its report (`w2-created-scrape-fields.md`) states the rule ("takes the model's maxPages/maxScrolls when its mode matches") but gives no reason. At the time detection proposed every page (`maxPages: 3` on the catalog), so dropping a bound under a different mode lost nothing. `f24b0687` (2026-09-23, "A pagination proposal asks for one page, not for every page there is") changed the detected bound to 1, which turned the rule into a truncation.
- Why keeping the bound does not reopen the rule: the plan's mode and controls are still ignored, so only the detected control is ever pressed or scrolled. The bound is held to the same cap and refused past it, exactly like a same-mode bound. The function doc comment and the file-header paragraph now say this.
- One behaviour change to note: a bound under a different mode that is out of range (for example `{mode: "numbered", maxPages: 51}`) used to be ignored silently. It is now refused as `web.handle.malformed` at `extractList.paginate`, the same as a same-mode bound.
- `slot.test.ts`: the pinned row `[{mode: "numbered", ..., maxPages: 2}, NEXT]` now expects `{...NEXT, maxPages: 2}`. I added these rows:
  - numbered with no bound: the detected one is kept;
  - `{mode: "scroll", maxScrolls: 2}` on a Next detection: `maxPages: 2`;
  - both keys given: the detected mode's key wins;
  - on the feed (scroll detection), `{mode: "next", maxPages: 4}`: `{mode: "scroll", maxScrolls: 4}`;
  - `{mode: "numbered", maxPages: 51}` on the feed: refused.

### Kestrel G3: a continental amount is read as written (`domain/src/actions/extraction/condition-match.ts`)

- `webAutomationExtractConditionNumber` takes the first number with all of its in-digit separators (`SEPARATED_NUMBER = /-?\d+(?:[.,]\d+)*/u`). It reads that number the continental way only when the whole match fits one of three forms (`CONTINENTAL_NUMBER`):
  - `\d+,\d{1,2}`: a decimal comma ("169,00", "14,5", "16,49");
  - `\d{1,3}(\.\d{3})+,\d+`: dot thousands before a decimal comma ("1.165,00", "1.234.567,89");
  - `\d{1,3}(\.\d{3}){2,}`: two or more dot groups ("1.165.000"), because a number has only one decimal point.
- Every other value goes through the old `NUMBER` path unchanged. So "£1,165.00" is 1165, "1,165" is 1165, "1.165" is 1.165 and "1.5" is 1.5. A lone group of three keeps today's reading. "169, plus postage" is 169.
- The rule is written up in the "What a value is" section of the file header, with the forms and the reasons. Number sorts use the same function (`apps/extension/src/content/extraction/order-rows.ts:148`), so they are fixed by the same change.
- `condition-match.test.ts`: a new test, "a continental amount is read as written, and every English form as before". It has 17 rows: every form the brief and the w25 report list, the ambiguous lone groups, and the English forms. It also checks that `lessThan: 500` holds for "EUR 169,00" and not for "EUR 1.165,00".

### Spec (`apps/extension/e2e/content/tests/live-tasks/tests/professional-network-rotterdam-data-engineers.spec.ts`)

- I removed the G2 `test.fail` and rewrote its comment to record the fix. The G1 marker is untouched.

## Commands run and observed results

All commands ran from the tree root.

- `bash .../heavy.sh "t194-w32 tsc" npx tsc -p domain/tsconfig.json --noEmit`: exit 0, no output.
- `bash .../heavy.sh "t194-w32 tsc test" npx tsc -p domain/tsconfig.test.json --noEmit`: exit 0, no output.
- Unit tests. I used a scratch runner, `domain/.test-build-scratch/t194-w32-runner.mjs`, with the same esbuild options as `scripts/test-domain.mjs`. Its output went to `.test-build-scratch/t194-w32`, and both have been deleted. It ran every `*.test.ts` in `domain/src/runtime/llm-evidence/plan-resolution/extraction/tests/` and `domain/src/actions/extraction/tests/`, 14 files: `# tests 100`, `# pass 100`, `# fail 0`, exit 0. The changed tests passed:
  - `ok 3 - a continental amount is read as written...`
  - `ok 92 - the handle keeps every detected column and the detected pagination unless the plan says otherwise`
  - `ok 94 - a table's columns may be named by header, and a feed's by attribute, with its scroll bounded`
- How I checked that the new tests fail on the old source. A second scratch runner, since deleted, used an esbuild `onLoad` plugin to serve `git show HEAD:` for `slot.ts` and `condition-match.ts`. The working tree was not touched. I ran it on `slot.test.ts` and `condition-match.test.ts`: `# tests 23`, `# pass 20`, `# fail 3`, exit 1.
  - the slot pagination test: `+ maxPages: 3, - maxPages: 2`;
  - the feed test: `+ maxScrolls: 50, - maxScrolls: 4`;
  - the continental test: `expected: 169`, `actual: 16900`.
- `node scripts/structure-audit.mjs`: exit 1, with 2 violations, both in other workers' uncommitted files:
  - `[directory-files] apps/extension/src/content/extraction/: 27 source files` (untracked `composed-value.ts` and `placeholder-run.ts`);
  - `[naming] apps/extension/src/content/action-runtime/ignored-press/: 3 files share the prefix "press-"` (untracked `press-roots.ts`).

  My files raise one advisory warning only: `slot.test.ts: 462 lines`. The file was already 451 lines at HEAD, past the 400-line advisory threshold.
- `bash .../heavy.sh "t194-w32 T2 specs" pnpm --filter @fluxiq-web-extension/extension test:content -- <rotterdam> <kestrel> <item-conditions> --reporter=list --output=e2e/test-results/t194-w32`: exit 1, `4 failed`, `18 passed (2.6m)`.
  - Rotterdam: `ok 19 ... a plan that names the numbered pager it sees keeps the page bound it asked for (14.7s)`. That is G2, now unmarked, and it passes. G1 (`:338`) failed as expected (`x 18`). Every other rotterdam row passed.
  - item-conditions: all 5 passed.
  - Kestrel G3 (`:612`): "Expected to fail, but passed." This is my fix. The lead owns the marker.
  - Kestrel rows I did not cause, all in detection code:
    - `:531` "keyword route, G2: the detection says how the results continue": "Expected to fail, but passed."
    - `:663` "grid-view, G1: a detected column holds every owed title": "Expected to fail, but passed."
    - `:542` "keyword route: through the evidence runtime the read stops at page one...": failed at line 567, because `request.paginate` was expected to be undefined and was `{"maxPages":1,"mode":"numbered","pages":"main > div > div > nav:nth-of-type(2) > a.css-00y0ria"}`. The detection now carries the numbered pager.

    These rows exercise extension-side detection (`detect-pagination.ts`, `infer-fields.ts`), and other workers have uncommitted edits to those files in this tree. My `slot.ts` change returns the detected pagination unchanged when the plan gives no `paginate`, so it cannot produce the `:542` value.
  - Kestrel `:504` "filter route, G1" failed as expected (`x 8`).

## Not verified

- I did not run the rotterdam G2 row against the old source in this session. The spec loads the domain from source, and I did not swap files in a tree where a live run is in progress. The "before" state is the w27 observation (`maxPages: 1`).
- I did not run `:531`, `:542` and `:663` without the other workers' extension edits. Their attribution to those edits rests on the code paths involved, not on a run.
- No `pnpm check`, `pnpm test` or build was run, as the brief requires.
- Amounts grouped with spaces ("1 165,00 €", including NBSP or narrow NBSP groups) are not handled and still read as their first digit run ("1"). A plain space is too easily a gap between two numbers.

## Open questions or contradictions found

- `apps/extension/src/content/extraction/order-rows.ts:31` has a comment describing the number reader ("the first run of digits, thousands ..."), which is now incomplete for continental forms. That file is outside my ownership, so whoever owns it should update the comment.
- The kestrel `:542` row asserts that the handle carries no pagination. Once the detection-side G2 lands, that row has to be rewritten, not just unmarked. It is the lead's row.
- The `"and N others"` count still reads `1.204` as 1.204 (it uses its own `\d[\d,]*`). I left it alone because no fixture writes it that way.
