# Fix F7: navigation address resolution (worker report)

## Outcome

Done. A navigate whose `url` is relative is now resolved against the web page the Flow is on before anything reaches the browser. With no web page to resolve it against, or when the address is the extension's own, the step fails as `web.action.invalid_parameter` with an honest `actual`, never `permission_denied`. No new failure code was needed.

## What changed and why

- New `apps/extension/src/runtime/navigation/address.ts`, exported from `navigation/index.ts`. One function, `navigationAddress(url, { pages, ownOrigins, extensionUrl })`, returns `{ url }` or `{ refused }`:
  - An address that parses on its own passes through unchanged (the original string, as before).
  - A relative address (root-relative, dot-relative, bare, query-only) is resolved against the first page in `pages` that is http(s) and not one of FluxIQ's own origins. A browser page, an extension page, `about:blank`, `file:` or the panel is never a base.
  - Refusals: `url "<x>" is relative and there is no web page to resolve it against, so nothing was sent to the browser`, and `url "<x>" is the extension's own address, which a Flow never navigates to, so nothing was sent to the browser`. The own-address check compares scheme and host, lower-cased, not `URL.origin`. `chrome-extension:` is not a special scheme, so its origin is `"null"`.
- `apps/extension/src/runtime/action-runner.ts`, `runBrowserActionCommand`: right after the existing no-value check and before `paceNavigation`, `tabRequestFor`, `unsupportedPageReasonFor` and `verifyNavigationLanding`, a navigate's url goes through `navigationAddress`, and `action` is replaced with the resolved copy. `action` became `let` for this. New helpers in the same file:
  - `navigationBasePages`: the candidate base pages, in this order: the named tab, the leased automation tab, the tab in front, the last-driven automation tab. Tab URLs are read only when the url does not parse as absolute, so absolute navigations make no extra `tabs.get` calls.
  - `extensionBaseUrl`: guarded `chrome.runtime.getURL("")`.
  - `navigationAddressFailure`: INVALID_PARAMETER through `workerBlockedFailure`, the same shape as `navigateWithoutValueFailure`. Its `actual` does not start with `no value:`, so the domain reads it as `parameter_not_readable` rather than `parameter_has_no_value`.
- The base is computed before `afterClosingOpenedTabs`, so a reset whose item tab is about to be closed still resolves against the page the Flow was on.
- `domain/src/runtime/failure/browser-api.ts` was not touched. `extract.ts` was not touched.

## Commands run and observed results

All extension commands ran from `apps/extension` in the worktree.

- `EXTENSION_TEST_BUILD_LABEL=f7-address node scripts/test-extension.mjs src/runtime/navigation/tests/address.test.ts src/runtime/tests/action-runner.test.ts src/runtime/tests/navigate-action.test.ts` -> `# tests 76 # pass 76 # fail 0`.
- The same command on the address and action-runner test files alone -> `# pass 47 # fail 0`. The 8 address rows and the 4 new seam rows are among them:
  - root-relative goes to `tabs.update` as `http://127.0.0.1:58327/scenarios/auction-marketplace/str/the_camera_loft`;
  - a new-tab relative navigate goes to `tabs.create` as the absolute address;
  - with no web page (no tab, `about:blank`, extension page), the result is invalid_parameter and neither `tabs.update` nor `tabs.create` is called;
  - the extension's own address is refused the same way.
- Red check: with the resolution block temporarily disabled (`if (false && ...)`, restored from a backup copy afterwards and confirmed by grep), `src/runtime/tests/action-runner.test.ts` -> `# pass 35 # fail 4`. All 4 new seam rows failed.
- `npx tsc -p tsconfig.json --noEmit` (extension typecheck) -> no output, exit 0.
- `node scripts/structure-audit.mjs` (repository root) -> `structure-audit: passed (212 warning(s), 638 baselined).`, exit 0. `action-runner.ts` is 586 lines and `action-runner.test.ts` is 776 lines, both under the 800-line limit and past the 400-line advisory.

## Not verified

- I ran no live browser test. The tests do not prove that Chrome resolves the absolute address correctly, or how Firefox handles relative urls in `tabs.update`.
- A schemeless host such as `www.example.com/x` is now resolved as a path on the current page, as a link would be, where before it went to the extension origin (already broken). No test covers model-written schemeless hosts.
- I did not run whole package suites, per the brief.

## Open questions or contradictions found

- The diagnosis was unsure which tab supplied the base in the failing trial. The runner takes the first web page among the named tab, the leased tab, the tab in front and the last-driven tab. If the tab in front is a person's own unrelated web page while the Flow drives another tab, the base is the page in front. This matches the tab a navigation that names no tab drives (`navigationTargetTab`), but it is a choice, not a measured fact.
- The optional reader alignment in `extract.ts` (resolving `href` in single-value attribute reads) was left alone, as the brief required.
