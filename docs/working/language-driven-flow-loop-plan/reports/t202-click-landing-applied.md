# t202 report: a click that navigates its own page is applied

## Outcome

Done. Ready to commit: `apps/extension/src/runtime/click-landing.ts`, `apps/extension/src/runtime/navigating-page.ts` (new), `apps/extension/src/runtime/index.ts`, `apps/extension/src/runtime/tests/click-landing.test.ts`, `domain/src/runtime/llm-evidence/node-run/tests/reload-click.test.ts`. Validation (after the supervisor's narrowing): `pnpm --filter @fluxiq-web-extension/extension test` -> `# pass 1491 # fail 0`; `pnpm --filter @fluxiq-web-extension/domain test` -> `# pass 986 # fail 0`; `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0; `node scripts/structure-audit.mjs` -> `structure-audit: passed (131 warning(s), 120 baselined).`

## What changed and why

- **`navigating-page.ts` (new).** `metNavigatingPage(error)` and its `NAVIGATING_PAGE_ERRORS` patterns, copied exactly from `action-runner.ts:375` and `:422-424`. It is exported through `runtime/index.ts`. **At integration, `action-runner.ts` should import `metNavigatingPage` from `./navigating-page` and delete its own copy and `NAVIGATING_PAGE_ERRORS`.** I did not edit it, because t200 owns that file.
- **`click-landing.ts`.**
  - `judgeLanding` now returns `{ kind: "stood" }` for a committed landing that nothing speaks against. `undefined` now means only that nothing committed, whether no navigation started within the grace or it ended without a commit.
  - In the send's `catch`:
    - no commit -> rethrow, as before;
    - `failed` -> the failure result, as before;
    - an error that is not a navigating-page error -> rethrow;
    - otherwise -> a `succeeded` result from `workerActionResult`. Its message is "The click navigated its page before it could answer." Its validation `actual` is "the click navigated its page before it could answer, and the page it landed on loaded". `check_cleared` is wrapped by `clickAfterClearedCheck`.
  - The success path treats `stood` as before (returns the reply).
  - The header comment was updated.
  - The landed URL is not put on the result, so no query is quoted.
- **Extension tests.**
  - (a) Channel closed, then a 200 commit and no check -> exact `succeeded` result, with no query leaked.
  - (b) Channel closed with no navigation within the grace -> rethrows the same error after at least the grace.
  - (c) The existing test "still fails when the tab landed on a refused page" (403 -> `navigation_unexpected`) is kept and labelled as cause 1 (c).
  - Three tests were added beyond the brief:
    - a lost reply onto a self-clearing check -> `succeeded` with the waited-out note;
    - a navigation that ends without a commit -> rethrows;
    - a non-navigating error followed by a 200 commit -> rethrows.
  - The old "a page served 200 rethrows" row is removed, because it asserted the behaviour this task reverses.
- **Domain test.** `reload-click.test.ts` already existed on dev (commit fa611682). I added one case rather than creating the file. The gateway's click answers `succeeded` with the note message and a validation payload, and the first look after it meets the reload. The test asserts that the step is applied (`web.action.succeeded`, `effectApplied: true`, `draft.proposes`, `ranWith` selector), that `replay` is set with its `from` location, that `pageChanged: true` holds, and that the new store's chip is shown. **No domain source change was needed.**

## Follow-up: the click path now uses a narrower predicate (supervisor request)

- `navigating-page.ts` now also exports `unloadedUnderDeliveredMessage(error)`. It matches only "message port/channel closed before a response was received", which means the message was delivered and the page then unloaded. `metNavigatingPage` is unchanged, because action-runner.ts uses it for other cases.
- `click-landing.ts` uses `unloadedUnderDeliveredMessage`. A click that fails with "Receiving end does not exist" is never delivered, so it still rethrows even when a navigation then commits.
- New test `ok 1338 - a click refused before delivery rethrows, even when a navigation then commits a page served 200`.
- Re-run through heavy.sh:
  - `pnpm --filter @fluxiq-web-extension/extension test` -> exit 0, `# tests 1491 # pass 1491 # fail 0`.
  - `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0.
  - `node scripts/structure-audit.mjs` -> `structure-audit: passed (131 warning(s), 120 baselined).` The advisory warning for `click-landing.test.ts` is now at 483 lines.
- The domain test was not re-run, because no domain file changed. The earlier run gave 986 passed and 0 failed.

## Commands run and observed results

All were run from the task tree through `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t202 <what>" ...`:
- `pnpm --filter @fluxiq-web-extension/extension test` -> exit 0, `# tests 1490 # pass 1490 # fail 0`. The new rows are ok 1333-1338.
- `pnpm --filter @fluxiq-web-extension/domain test` -> exit 0, `# tests 986 # pass 986 # fail 0`. The new case is `ok 538 - a click answered only by the note that it navigated its page before answering is applied, with the page after the reload`.
- `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0. It printed only advisory `file-lines` warnings for other packages.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (131 warning(s), 120 baselined).` There is one new advisory warning: `click-landing.test.ts: 470 lines is past the 400-line advisory threshold` (it was 409 before).

## Not verified

- No Lab or browser run, as the brief ordered. That Chromium closes the channel and then commits a 200 top-frame navigation for bigbox's reload is taken from the audit, not observed here.
- Nothing checks the domain's handling of the real extension-to-gateway mapping of this result (`gatewayActionResultFromBrowserResult`). The domain test stubs the gateway's answer.

## Open questions or contradictions found

- **(Closed by the follow-up above.)** "Receiving end does not exist" is one of the shared predicate's patterns. The brief required the same test, so a click refused because no listener was there also stands if the top frame then commits a navigation that is not refused. That could happen when the page was already navigating before the click was sent, for example from an earlier step. In that case the click was never delivered and is reported `succeeded`. Consider restricting the click path to the "message port/channel closed" pattern only.
- The brief called `reload-click.test.ts` a new file, but it already exists on dev. I extended it.
- `click-landing.test.ts` is now 470 lines. That is only an advisory warning, but it is a candidate for splitting the lost-reply rows into their own test file.
