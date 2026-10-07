# t289-I: two failing Playwright content specs

## Outcome

Partial.

- `shadow-root-controls.spec.ts:109` had a stale expectation. The spec is fixed and now passes.
- `large-page-resolution.spec.ts:94` is a real product regression: a performance cliff in snapshot description. The cause is in files this brief does not own, so I did not fix it and I left the spec unchanged. Raising its timeout would hide the defect. The diagnosis and a proposed fix are below.

## What changed and why

### 1. `apps/extension/e2e/content/tests/shadow-roots/tests/shadow-root-controls.spec.ts:109`: stale spec

- **Observed:** `expect(reply.failure?.code)` expected `"web.action.rejected"` and received `"web.target.not_actionable"`. The `actual` regex on the next line already matched. Status, the closed-root description and the covered wording all held.
- **Cause:** commit `2294dd16` (2026-10-01, t193 lane B) made a deliberate change: "Hidden, covered and disabled refusals were web.action.rejected ... They now have web.target.not_actionable, an unexpected page state the repair may answer." It updated the actionability, click, dialog and other specs but missed this one. `ba9fea58` later moved `hidden` to `TARGET_NOT_SHOWN` and kept `covered` on `TARGET_NOT_ACTIONABLE` (`action-runtime/results.ts`, `PAGE_STATE_CODES`).
- **Fix:** the expected code is now `WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE`, with a comment citing the commit. The spec still proves what it exists for: the refusal names the closed host, nothing inside it is described, and nothing throws.

### 2. `apps/extension/e2e/content/tests/large-page-resolution.spec.ts:94`: product regression, not fixed (outside my ownership)

- **Observed:** the 30 s test timeout ran out. With the timeout raised temporarily (since reverted), the assertions all pass after **40.9 s**. The failure is `web.target.not_found` and `actual` reads "...0 control(s) of the same family in the first 5000 interactive element(s); the scan was cut short there, so the page may hold more...". The wording and the resolver are correct.
- **Where the time goes:** I profiled with a CDP CPU profile in a scratch spec, since deleted. The page was identity-drift with 6,000 `<a>` filler links under one `<nav>`.
  - A bare `captureSnapshot` took **30.1 s**. The miss's `runAction` took 29.3 s, of which 27.5 s was `actionFailure`'s snapshot. Resolution itself was negligible.
  - The spec file's own comment records the 2026-09-12 figures on a 5,000-element page: about 4 s for a bare capture, 3.5 s for this miss.
- **Hot paths:** each costs time proportional to the number of siblings, once for every described element, so a wide sibling list costs O(n^2). Figures are from the capture profile.
  - `xpathFor` (`content/element-finder.ts:84`, called from `describe-element.ts:89`) spreads and filters `parentElement.children` for every element: **12.7 s**.
  - `isLeadStatement` (`content/evidence/lead-statements.ts:79`) calls `directVisibleText(parent)`, which reaches `textOutsideSensitiveControls` and then `ownText` (`content/sensitive-text.ts:57`). That spreads the parent's 6,000 `childNodes` once per child: **10.5 s**.
  - `position` and `sameType` in `content/selector/unique-selector.ts:151` walk every sibling to compute `:nth-of-type`: **3.4 s**.
- **Regressing commit:** `b507d5fa` (2026-09-30, t200), "The look includes every rendered element ... with nothing capped or ranked". Before it, `dom-snapshot.ts` described at most `MAX_SNAPSHOT_CANDIDATES = 2_000` elements (`git show b507d5fa^:apps/extension/src/content/dom-snapshot.ts`, line 63). The uncapping was intended by the user's order. The quadratic cost per element only surfaced once the cap was gone. `selector-memo.ts`'s header still says "A snapshot describes up to 2,000 elements".
- **Proposed fix** (needs a brief that owns `content/element-finder.ts`, `content/selector/**`, `content/evidence/lead-statements.ts` and possibly `content/sensitive-text.ts` / `describe-element.ts`):
  1. Add a per-parent sibling-index table to the capture-scoped `SelectorMemo`. It would be built in one pass over `parent.children` and record each element's same-type index and whether its type is shared. `xpathFor` and `position()` would both read it inside `withSelectorMemo` and fall back to the current walk outside it.
  2. In `isLeadStatement`, run `belongsToMainRegion` before `directVisibleText(parent)`. That one change makes every control (`a`, `button`, ...) and every non-main element answer at once. Also memoise `directVisibleText` per element for the capture (a WeakMap held in the same scope), or have `ownText` stop at the first non-blank text node when only presence is asked. This covers the general case of many text-bearing siblings inside `main`.
  3. Accept the fix when this spec passes within its 30 s budget and a bare capture of the 6,000-link page comes back in a few seconds again.

The large-page spec was restored byte for byte from a scratch copy. `git status` shows no change to it.

## Commands run and observed results

All Playwright runs were from `apps/extension`.

- `node scripts/test-content.mjs --workers=2 large-page-resolution shadow-root-controls`, before any change: 7 passed, 2 failed.
  - `large-page-resolution.spec.ts:94`: "Test timeout of 30000ms exceeded" (40.5 s).
  - `shadow-root-controls.spec.ts:109`: Expected "web.action.rejected", Received "web.target.not_actionable" (line 122).
- With `test.setTimeout(300_000)` on the large-page row, temporarily, `... --workers=1 large-page-resolution -g "cut short"` gave 1 passed. The `runAction` took 40,894 ms, and the failure record is quoted above.
- Scratch profiler spec (`t289i-profile.spec.ts`, deleted): capture 30,074 ms, action 29,280 ms. The aggregated profiles are in the scratchpad (`t289i-profile-*.cpuprofile`, `t289i-agg.mjs`).
- Sibling set `node scripts/test-content.mjs --workers=2 identity-ambiguity identity-signals identity-veto identity-wire-chain identity.spec large-page-resolution resolve-target.spec shadow-roots`:
  - **Before** (spec unchanged): **58 passed, 2 failed**, exactly the two above.
  - **After** the shadow spec fix: **59 passed, 1 failed**. Only `large-page-resolution.spec.ts:94` (timeout, 42.1 s) still fails.
  - The identity-wire-chain and large-page `:66` failures that t281 reported did not appear on this tree.
- `node scripts/structure-audit.mjs` (repo root): "structure-audit: passed (174 warning(s), 118 baselined)".
- `pnpm.cmd --filter @fluxiq-web-extension/extension check`: refused before typechecking. "FluxIQ Core's build at ...\fxwork\t289\!FluxIQ is 25 minute(s) behind its source (Stale: packages/fluxiq/src/ui/activity-action/tested.ts)". Core is not mine to rebuild. I ran the gate's typecheck step directly instead: `node scripts/check-extension.mjs` (tsconfig.json and tsconfig.test.json, which includes `e2e/**`) printed nothing and gave `rc=0`.
- Extension unit tests: none run. No source under `src/` changed.

## Not verified

- The proposed performance fix was not implemented or measured. The profile figures above are the evidence.
- The typecheck ran against Core's dist as it stood, 25 minutes behind Core source that someone else is editing.
- Live browser and Lab: not run.
- The tree's HEAD was `d4c5e0ec`, one commit behind the brief's dev tip `d2d259a0`, which per its subject is a docs-only commit.

## Open questions or contradictions found

1. Real application pages pass 5,000 elements, and some have wide flat sibling lists. On those pages every capture and every failure result may now take tens of seconds. That likely matters for live runs, not only this spec. A worker-high brief owning the files listed under "Proposed fix" should take this.
2. `content/selector/selector-memo.ts`'s header comment ("A snapshot describes up to 2,000 elements") has been stale since t200.
