# t281-f1-resolver: resolve a title-named control by its accessible name, counted

## Outcome

Done in the files I own. Two specs I may not touch now fail because the change works as intended (see Open questions). The supervisor must update them before the merge.

## What changed and why

- `apps/extension/src/content/action-runtime/resolve-target.ts`, `fingerprintMatches`:
  - After `findClosestFingerprint` misses and `target.accessibleName` is set, it scans `root.querySelectorAll(target.tagName || "*")` across the roots in scope.
  - It keeps every element where `accessibleNameFor(element) === normalizedText(target.accessibleName)`. The scan is bounded by `MAX_TEXT_SCAN` and counts every match.
  - A non-empty result is returned. Otherwise the existing `visibleText` scan runs unchanged.
  - Both scans now share the helper `scanMatches`.
  - `accessibleNameFor` and `normalizedText` are imported from the `../identity` barrel.
  - The doc comment of `fingerprintMatches` now explains the name scan, the live run and the counting. The module header stays true: "the recorded element fingerprint" still covers it, and the veto, record gate and scoring paths are unchanged.
- `element-finder.ts` is not touched. `RecordedTarget` already carries `accessibleName`.
- `apps/extension/e2e/content/tests/identity-resolution.spec.ts`:
  - **New describe** "a control named only by its title resolves by that name once its selector drifts", with two rows:
    1. On `basic-form` the test injects `div.sw[title="Space Grey"]` and `div.sw[title="Silver"]`. Each is a 40px div holding only `<img alt="">`, with a click listener that sets `data-pressed`. The command has the stale `selector: "#g1 > div:nth-of-type(1)"` and `options.element = {tagName:"div", accessibleName:"Space Grey", selector}`. Expected: `succeeded`, `resolution {strategy:"fingerprint", candidateCount:1}`, Space Grey pressed and Silver not.
    2. Two divs titled "Space Grey" plus one "Silver". Expected: `failed`, `TARGET_AMBIGUOUS`, `resolution {strategy:"fingerprint", candidateCount:2}`, and nothing pressed.
  - **Updated row** "reworded-aria: the surviving accessible name resolves the right control". It now resolves at Level 1 by the name scan, so the row expects `{strategy:"fingerprint", candidateCount:1}` and no runner-up. The pinned 0.389 / 0.366 is unchanged, because the veto measures the same score. The header paragraph, the "four shapes" sentence and the measurement table were updated to match.

### Veto check for a title-only match (the report did not trace it)

It passes, and the reason is traced here.
- `recordedDistinguisher` is true because `accessibleName` is set.
- `candidateFingerprint` reads the candidate's name through `accessibleNameFor`, which reads `title` (accessible-name.ts:53). So the `accessibleName` contribution agrees exactly, and `corroboratesExactly` (rule 2) holds.
- No record was recorded, so rule 0 passes.
- The stale selector costs some weight, but the score stays at or above 0, so rule 1 passes.
- Observed: new row 1 succeeds with `strategy:"fingerprint"`. A veto refusal would have demoted the strategy to a miss and ended in not-found, since Level 2 cannot enumerate a role-less div.
- On reworded-aria the veto's accepted measurement is 0.389 at confidence 0.366, identical to what Level 2 scored before.

## Commands run and observed results

All Playwright runs were from `apps/extension` through `node scripts/test-content.mjs` (the config's `pnpm test:content` wrapper, `playwright test -c e2e/playwright.content.config.ts`). test-contracts dist was already present.

- **Before the fix:** `... --workers=2 identity-resolution.spec.ts -g "named only by its title"` gave 2 failed. Row 1: "No target resolved from selector #g1 > div:nth-of-type(1), element fingerprint." with status `failed`. Row 2: code `web.target.not_found`, expected `web.target.ambiguous`.
- **After the fix, whole spec:** `... --workers=2 identity-resolution.spec.ts` gave 25 passed and 1 failed (reworded-aria: strategy `fingerprint`/1, expected `scored-candidate`/2). After updating that row: **26 passed (59.3s)**.
- **Sibling resolver specs**, run read-only: `... --workers=2 identity-ambiguity identity-signals identity-veto identity-wire-chain identity.spec large-page-resolution resolve-target.spec shadow-roots` gave 55 passed and 5 failed. To find which failures predate the change, I temporarily restored HEAD's resolve-target.ts and re-ran `identity-wire-chain large-page-resolution shadow-root-controls`: 9 passed and 2 failed. My version was restored afterwards and the diff checked.
  - Already failing before my change: `large-page-resolution.spec.ts:94` ("a scan the bound does cut short says so") and `shadow-roots/tests/shadow-root-controls.spec.ts:109` ("a closed shadow root ... names the host without throwing").
  - Caused by my change, all on the reworded-aria rendering and all only `strategy`/`candidateCount`: `identity-wire-chain.spec.ts:93` (both rows, which expected `scored-candidate`/2 with 0.389/0.366 and got `fingerprint`/1) and `large-page-resolution.spec.ts:66` (expected `strategy: "scored-candidate"`, got `fingerprint`). Status `succeeded`, the right control pressed and Discard untouched hold in all three.
- **Typecheck:** `npx tsc -p apps/extension/tsconfig.json --noEmit` (repo root) exited 0 with no output.
- **Extension unit suite:** `EXTENSION_TEST_BUILD_LABEL=t281-f1 node scripts/test-extension.mjs` ran all of them, including `action-runtime/tests/resolve-target.test.ts`, because the script has no filter. Result: tests 2498, pass 2498, fail 0, exit 0, 2m47s.

## Not verified

- No live browser or Lab run. The scenario-lab swatch page itself (rotating id, `addEventListener` click) was not exercised; the injected fixture stands in for it.
- I added no unit test beside resolve-target. Per the report, the unit stub DOM answers only `"*"`, so the e2e harness is where this can be shown.
- Performance of the name scan: `accessibleNameFor` costs more per element than `textContent`. It runs only after every stable lookup missed and is bounded at 2,000 elements, but it was not timed. The large-page timing row was not among the failures.
- Other workers were editing `domain/` while the content-harness and unit bundles were built from it. Results reflect domain as it stood at that moment.

## Open questions or contradictions found

1. **Two specs outside my ownership need updating** for the new Level 1 route on reworded-aria:
   - `identity-wire-chain.spec.ts:112`: expect `{strategy:"fingerprint", candidateCount:1}`. bestScore 0.389 and confidence 0.366 still hold, and there is no runner-up.
   - `large-page-resolution.spec.ts:66-88`: this row exists to prove that Level 2 enumeration reaches a control past the old 600 bound. With the name scan, Level 1 answers first and the row no longer exercises enumeration. To keep its intent, record the Save without `accessibleName` (strip it from `recorded`), or pick a rendering where the name also drifted. Rewriting the expectation to `fingerprint` would lose that coverage.
2. Behaviour change worth knowing: a recording whose accessible name differs from its visible text, for example an aria-label "Close" on a "×" button, now resolves by name before the text scan. Before, the text scan found every "×". This is the intended direction, and both scans still count ties.
3. The two sibling failures that predate this change (`large-page-resolution:94`, `shadow-root-controls:109`) are unrelated to F1 and were not investigated.
