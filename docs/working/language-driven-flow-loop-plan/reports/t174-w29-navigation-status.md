# t174-w29: a navigation the server refuses is not a success

## Outcome

Done. A `web.browser.navigate` whose landed page was served HTTP 400 or above now fails `navigation_unexpected`, naming the status and the landed path without query or fragment. The status read now lives in a new module, `served-status.ts`, which clicks and navigations both use.

## Cause

Lane A run 23, cause #13. `action-runner.ts` `navigationResult` judged a landing by four things: a robot check, Chrome's error page (`errorOccurred`), the destination, and tab movement. It never looked at the HTTP status. bigbox-retail answers an unknown item address with 404 and `{"error":"not_found"}` at the requested address, so all four checks passed and the navigation reported `succeeded`. Clicks already read the status in `click-landing.ts`.

## What changed and why

- `apps/extension/src/runtime/served-status.ts` (new). One function, `servedStatus(tabId, documentId)`, takes the status read from `click-landing.ts` with the same targeting: it addresses the document by `documentIds` when known, otherwise frame 0. It runs `performance.getEntriesByType("navigation")[0].responseStatus` through `chrome.scripting.executeScript` and accepts only positive integers.
  - **Deviation from the brief:** the brief asked for `undefined` when the browser will not say. The function returns `{ status } | { unread: why }` instead. The moved `catch { return undefined; }` broke the structure audit's `failure-as-empty` rule. It was baselined only under `click-landing.ts`, and `.structure-baseline.json` is outside my ownership. The tagged answer is the fix the rule itself recommends: the caller can tell an unread status from a real one. Every caller still treats unread exactly as before, so missing evidence never becomes a failure. The file exports this function and the `ServedStatus` type.
- `click-landing.ts`: the private `servedStatus` and `readServedStatus` are removed and the module is imported instead. `refusedLanding` reads `"status" in served`. Behaviour is unchanged; all 27 click-landing tests pass without edits. The header note says where the read now lives.
- `action-runner.ts`:
  - **Navigation branch:** when `loadFailed` is false, it calls `servedStatus(tabId, drive?.documentAfter)` and passes `served` in `NavigationLanding`.
  - **`navigationResult`:** the order is robot check, then destination comparison, then the new status check, then movement. A status of 400 or above fails with `navigationUnexpectedFailure(comparison.expected, "the server answered HTTP <n> for <path>")` and the message `Navigation landed on <path>, which the server answered with HTTP <n>.`.
  - **Comments and helpers:** a local `landedPath` gives the path without query or fragment, and `FIRST_ERROR_STATUS` is set to 400. The doc comment and the inline branch comment are updated.
- `navigation-outcome.ts` (comments only): the header now says that the robot check and the served status are judged around it in `navigationResult`.
- Docs:
  - `web-capabilities.md`: the Navigate row describes the status check and its limits (a soft 404 is not caught, Firefox gives no status, a 403 robot check stays the person's) and lists `served-status.ts`. The Click row notes the shared module.
  - `failure-taxonomy.md`: the existing `action-runner.ts` emitter entry now includes `NAVIGATION_UNEXPECTED` for a refused landing.

## Tests, before and after

The new cases are in `navigate-action.test.ts`. Its stub gained `chrome.scripting.executeScript`, controlled by a per-tab `served` value. If `served` is absent, the stub rejects the call (the existing tests take this path, so they are unchanged). If `served` is `"none"`, the result is undefined, as in Firefox. "Before" is a scratch run of this file against the unchanged source: 24 tests, 22 pass, 2 fail.

| Test | Before | After |
| --- | --- | --- |
| served 404 fails `navigation_unexpected`; `actual` = `the server answered HTTP 404 for /scenarios/bigbox-retail/ip/no-such-item/000` (query and fragment dropped); targets `documentIds: ["document.1"]`; Core parser accepts | FAIL (`expected 'failed'`, `actual 'succeeded'`) | pass |
| served 200 succeeds and the status was read | FAIL (injection count `expected 1`, `actual 0`, because nothing read the status) | pass |
| unreadable (injection rejects; Firefox `undefined`) succeeds | pass (vacuous: nothing read the status) | pass |
| robot check served 403 stays `web.intervention.required` | pass | pass |
| page the browser could not load is not asked for its status | pass | pass |
| `served-status.test.ts` (new, 4 tests: documentId target, frame-0 fallback, `undefined`/`0`/`404.5`/`"404"` read as unread, a rejected injection is unread with its reason) | n/a (no module) | 4/4 pass |
| `click-landing.test.ts`, unchanged | 27/27 pass | 27/27 pass |

## Commands run and observed results

- Scratch single-file runner (an esbuild bundle like `scripts/test-extension.mjs`, written under `apps/extension/` and deleted after use):
  - Before: `navigate-action.test.ts` printed `# tests 24 / # pass 22 / # fail 2`.
  - After: `navigate-action.test.ts click-landing.test.ts` printed `# tests 51 / # pass 51 / # fail 0`, and `served-status.test.ts` printed `# tests 4 / # pass 4 / # fail 0`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174-w29 ext test" pnpm --filter @fluxiq-web-extension/extension test` returned rc=0 and printed `# tests 1673`, `# pass 1673`, `# fail 0`, `# cancelled 0`, `# skipped 0`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174-w29 ext check" pnpm --filter @fluxiq-web-extension/extension check` returned rc=0. The build-cache line was `{"build-cache":"build","step":"extension:check","reason":"no stamp; ...","ms":59222,...}`.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (136 warning(s), 118 baselined).` An earlier run, with the plain `return undefined` catch, printed `FAIL [failure-as-empty] apps/extension/src/runtime/served-status.ts ... at line 33` and `1 violation(s)`. That failure is what led to the tagged answer.

## Not verified

- No Lab and no live browser run (the STOP is in force). It is not proven that a real Chrome document served 404 by bigbox reports `responseStatus` 404 through `executeScript` with `documentIds: [drive.documentAfter]` at this point in the navigation. This is the same mechanism `click-landing.ts` already uses.
- The extension test suite ran before the comment-only edit to `navigation-outcome.ts`. `check` and the audit ran after it.
- The `pnpm build`, root `pnpm check` and domain tests were not run. Nothing under `domain/` was touched.

## Open questions or contradictions found

- `.structure-baseline.json` still lists `failure-as-empty` count 1 for `apps/extension/src/runtime/click-landing.ts`, which now has 0. The audit passes, but the supervisor may want to run `pnpm structure:baseline` to ratchet it down. I did not, because the baseline file is not mine.
- The new 404 check runs before the movement check. A 404 page that the tab already showed and the browser did not reload reports the 404 rather than the no-op. This seemed the more useful of the two failures, since the brief put the check "after the destination comparison" without saying where it goes relative to movement.
- `docs/working/language-driven-flow-loop-plan/reports/t174-live-lane.md` was already modified before I started; I did not touch it.
