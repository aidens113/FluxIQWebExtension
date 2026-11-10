# Pager, replay and read account (live-checks r3, three fixes)

## Outcome
Partial. Fixes 1 (answer part), 2 and 3 are done with tests that fail without them. Fix 1's "a fault decided before any press carries noEffect" is half done: the page now marks it, but the verb that turns it into a failure code is outside my owned paths.

## What changed and why
1. `apps/extension/src/content/extraction/page-advance/move-page.ts`: a numbered way whose `pages` match no element, on a list that is not still loading (`watchListLoading(...).shown()` from `list-loading.ts`, the readiness evidence the page already holds, no wait added), answers `ended` / `no_following_page`. A list still loading keeps `page_fault`. Both `page_fault`s decided before a press now carry `noEffect: true`.
   `move-outcome.ts`: `failedMove(..., noEffect?)` and `noEffect?: true` on the `failed` outcome.
2. `domain/src/runtime/llm-evidence/node-run/replay.ts` (`readChange`): "the step read nothing where it read N" no longer applies when the list was there (`itemsSeen > 0`) and its conditions, answered as asked, kept none (`unfiltered === false`), via `keptNoneOfItemsSeen`. Matches step 0044 (itemsSeen 20, unfiltered false, records 0). A list that vanished (`itemsSeen` 0) and the `unfiltered` rule still change.
3. `domain/src/runtime/llm-evidence/node-run/shown-rows/account.ts`: when `extraction.conditions.unfiltered === true`, `restOfRows` says the read kept none of the N rows in extracted, the conditions turned every one down, and extracted shows them unfiltered. I also drop `firstRows` for that read, since it presented rejected rows as the first kept rows. Wording is generic.

## Commands run and observed results
- New `page-advance/tests/no-pager.test.ts` (2 tests): `EXTENSION_TEST_BUILD_LABEL=t885-pager node scripts/test-extension.mjs page-advance/tests/no-pager` -> 2 pass, 0 fail. Fix reverted (the `ended` branch replaced by `if (false)`): test 1 failed, 1 pass. Restored.
- Whole `content/extraction/page-advance` extension run -> 94 pass, 2 fail before I corrected my test's selectors (the fake DOM only reads simple selectors); the two failures were the new file only. Not re-run whole afterwards; the new file alone is 2/2.
- Domain: `DOMAIN_TEST_BUILD_LABEL=t885-pager node scripts/test-domain.mjs runtime/llm-evidence/node-run` -> `# tests 573`, `# pass 573`, `# fail 0`.
- Domain tests with fixes 2 and 3 reverted (replay.ts and account.ts), two test files -> 28 tests, 26 pass, 2 fail (the two new ones). Restored.
- `npx tsc -p tsconfig.json --noEmit` in `apps/extension` and in `domain` -> exit 0 each.
- `node scripts/structure-audit.mjs` (worktree root) -> "passed (244 warning(s), 552 baselined)", exit 0.

## Not verified
- `pnpm --filter @fluxiq-web-extension/{domain,extension} check` do not run: the extension one refuses with "Core's build ... is not current with its source" (Core is being edited by another worker, and I may not rebuild it). I ran the tsc half directly. The domain `pnpm check` was not run for the same reason.
- No live or browser run. The test uses the repo's fake DOM, so `watchListLoading` is exercised only for `aria-busy` on the container.
- A different-page pass compared with page 1's `itemsSeen` (a later page that shows 0 items) still reads as "no list"; I keyed only on the conditions evidence, as the replay call carries no reliable current-page marker (`from.location` is the first step's).

## Open questions or contradictions found
- `noEffect` must be consumed in `apps/extension/src/content/actions/next-page.ts` (not mine): its `failed(...)` call for `case "failed"` takes `loaderSettlement.consume(answer, request)`; it should be `|| answer.noEffect === true`. Until then the pre-press `page_fault` still maps to `ACTION_FAILED`. The common hubs case no longer reaches it, because it now ends.
- Rejected rows in `extracted` of an exploring read are still a design question (proposal 3 in the earlier report); this change only makes what the model is told true.
