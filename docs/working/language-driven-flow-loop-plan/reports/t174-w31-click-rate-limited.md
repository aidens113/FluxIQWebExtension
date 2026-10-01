# t174-w31: a click that lands on a 429/503 page is rate-limited, and its tab goes back

## Outcome

Partial. All the code, tests and docs are done, and the whole extension suite passes. Two gates are red only because of other workers' files, which I may not touch:

- `pnpm --filter @fluxiq-web-extension/extension check` exits 1. Its one type error is in w34's probe spec.
- `node scripts/structure-audit.mjs` reports one violation, about the placement of w32's and w35's probe specs.

None of the errors are in my files.

A `web.dom.click` whose own tab's top frame lands on a document served 429 or 503, and that is not a robot check, now does four things:

- **Fails `web.action.rate_limited`.** The failure is retryable, with `effect: unacted`.
- **Tells the origin's pace.** It calls `OriginPace.noteRefusal`, and `retryAfterMs` is `pace.waitBeforeNextLoad(origin)`. With no pace, the wait is 8,500 ms.
- **Takes the tab back.** It calls `chrome.tabs.goBack` to return to the document the click was pressed on, without waiting on the pace first.
- **Judges the back landing.** It compares the landing's address with the URL the tab showed before the click (ignoring the fragment), and reads its served status through `servedStatus`. The record says whether the tab was returned. A failed or wrong return is stated, and the code stays RATE_LIMITED.

Other cases are unchanged:

- Any other status of 400 or above stays `navigation_unexpected`.
- A robot check is still judged first and stays the person's whatever it was served with. It is never told to the pace.
- A click whose reply was lost to the unload goes through the same judgement.

## What changed and why

- **`apps/extension/src/runtime/rate-limited-landing.ts`** (new). This is now the single home of `noteRateLimitedLanding` and its type `RateLimitedLanding`, moved verbatim from `action-runner.ts`. Both callers import it.
- **`apps/extension/src/runtime/action-runner.ts`**
  - The local `noteRateLimitedLanding` and `RateLimitedLanding` are removed and imported instead.
  - The now-unused `PAGE_LOAD_PACE_SETTINGS`, `PAGE_REFUSAL_STATUSES` and `originOf` imports are dropped.
  - `runActionInFrame` passes `pace` to `sendClickCheckingLanding`, and its doc comment says so.
- **`apps/extension/src/runtime/click-landing.ts`**
  - `sendClickCheckingLanding` takes an optional fifth parameter, `pace?: OriginPace`.
  - Once the navigation watch is attached and before the send, it reads the tab URL (`readTabUrl`, via `chrome.tabs.get`).
  - `judgeLanding` reads the served status once. It then checks for a rate limit (`noteRateLimitedLanding`) before the generic refusal check.
  - On a rate-limited landing it calls `returnToPressedPage`. That function starts a new `watchTopFrameNavigation`, calls `chrome.tabs.goBack`, waits for the commit, compares the URL and reads the served status. It answers with one of:
    - `returned`: the tab is back on the page the click was pressed on.
    - `unconfirmed`: the URL before the click went unread.
    - `not_returned`, with why. A `stayed` flag records whether the tab still shows the refused page.
  - It then builds the `rateLimitedLandingOutcome` record:
    - The failure is `webAutomationFailureRecord(RATE_LIMITED, { expected, actual, retryAfterMs })`.
    - `expected` is the module's existing "the page the click leads to loads".
    - `actual` is `the server answered HTTP <n> for <path>: the site refused the load for now and nothing was loaded; <return words>; the same click may be made again after <ms> ms`.
    - Only paths are quoted, never a query or fragment.
  - `refusedLanding` now takes the status that was already read rather than reading it again.
  - The header comment documents all of this.
- **`apps/extension/src/runtime/tests/click-landing-rate-limited.test.ts`** (new, 11 tests). It uses its own stub with `tabs.get` and `tabs.goBack` added. `click-landing.test.ts` needed no change: with no `chrome.tabs`, `readTabUrl` answers undefined, and none of its rows lands on a 429 or 503.
- **Docs**
  - `failure-taxonomy.md`: the RATE_LIMITED paragraph no longer says a click is still `NAVIGATION_UNEXPECTED`. It describes the click path and the return. The emitter list entries for `action-runner.ts` and `click-landing.ts` name RATE_LIMITED and `rate-limited-landing.ts`.
  - `web-capabilities.md`: the Navigate and Click rows add `runtime/rate-limited-landing.ts` to their owning files. The Click row's landing sentence now covers the rate-limited branch and the return.

## Commands run and observed results

- **New tests before the click change.** I ran them with a scratch single-file esbuild runner (`<scratchpad>/w31-run.mjs`, output in the ignored `apps/extension/.test-build-scratch/t174-w31/`), with `rate-limited-landing.ts` and the `action-runner.ts` move in place but `click-landing.ts` not yet changed. Result: `# tests 11 / # pass 3 / # fail 8`.
  - All 8 failures show `expected: 'web.action.rate_limited'` and `actual: 'web.navigation.unexpected'`.
  - The 3 that pass are regression guards that cannot fail on HEAD: the 404 landing, the robot check served 429, and the 200 landing.
- **The same runner after the change**, over `click-landing-rate-limited`, `click-landing`, `navigate-action` and `action-runner`: `# tests 99 / # pass 99 / # fail 0`.
- **First whole-suite run.** `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174 w31 ext test" pnpm --filter @fluxiq-web-extension/extension test` exited rc=1 before any test ran. The guard reported: `FluxIQ Core's build at ...\fxwork\t174\!FluxIQ is 860 minute(s) behind its source. Stale: ...\packages\fluxiq\src\runtime\client-gateway-transport.ts`.
  - Core's tree was clean, with `git status` empty, at `f3778a8e`.
  - I regenerated its untracked dist with the command the guard names: `bash heavy.sh "t174 w31 core build" pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`. It exited rc=0: contracts reused, client-gateway-websocket built, and fluxiq built in 126 s.
  - Afterwards, `git status` in Core was still empty.
- **Whole-suite rerun**, same heavy.sh test command: rc=0, `# tests 1731`, `# pass 1731`, `# fail 0`, `# cancelled 0`.
- **Extension check.** `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174 w31 ext check" pnpm --filter @fluxiq-web-extension/extension check` exited rc=1.
  - The single `error TS` is `e2e/content/tests/lane-a-probes/t174-w34.spec.ts(231,19): error TS2379 ... Types of property 'resultCode' are incompatible`. That is w34's untracked probe spec, not my file.
  - `check-extension.mjs` type-checks both projects and bundles every entry before it fails, so no error in my files is being hidden.
- **Structure audit.** `node scripts/structure-audit.mjs` gives `structure-audit: 1 violation(s) across 1 rule(s).`
  - The violation is `FAIL [test-placement] apps/extension/e2e/content/tests/lane-a-probes/: 2 test files sit beside their source`, about the untracked `t174-w32.spec.ts` and `t174-w35.spec.ts`.
  - My files raise only advisory warnings: `click-landing.ts` is 457 lines, past the 400-line advisory threshold, and `action-runner.ts` is 585.
- **Retry of both gates**, run after this report was first written: same results.
  - The check exited rc=1 with the same single `t174-w34.spec.ts(231,19): error TS2379`.
  - The audit gave `FAIL [test-placement] ... lane-a-probes/: 4 test files sit beside their source` and `structure-audit: 1 violation(s) across 1 rule(s).`

## Not verified

- No Lab and no live browser (no Lab of any kind was permitted).
- I have not proved three things about real Chromium:
  - that `chrome.tabs.goBack` from a 429 document restores the pressed page from the back/forward cache;
  - that `webNavigation` fires `onBeforeNavigate` and `onCommitted` with a `documentId` for that restore;
  - that the restored document's navigation entry keeps its original `responseStatus`.

  If a restore fires no commit within the 300 ms start grace, the record will say "going back committed no page" even though the tab may have gone back. If the history traversal reloads instead, the site may refuse it again, and the record says so.
- Firefox keeps no `responseStatus`, so a click landing there is never judged rate-limited, and the go-back code never runs on Firefox.
- The root `pnpm check`, `pnpm test`, `pnpm build` and the domain tests were not run. Nothing under `domain/` was edited.

## Open questions or contradictions found

- **Other workers' files break the gates.** The extension check is red only because of w34's probe spec, and the structure audit only because the lane-a-probes specs sit directly in `e2e/content/tests/lane-a-probes/` rather than in a `tests/` subfolder. The w32 to w35 briefs give exactly that path, so the brief's path conflicts with the `test-placement` rule.
- **Core dist rebuilt.** I regenerated Core's dist in `fxwork/t174/!FluxIQ`. It is untracked build output, but other workers reading the tree concurrently may have seen it change mid-build.
- **Stale comments in files I could not edit.** `background/page-pace/refusal-statuses.ts` and `origin-pace.ts` (`waitBeforeNextLoad`) still name only `runtime/action-runner.ts` as the reporter of a rate-limited landing. Both are read-only for me.
- **A click refused before delivery.** If a click is refused before delivery ("Receiving end does not exist") and the tab then commits a 429 page, the click is still failed as rate-limited and the tab goes back. This matches how the module already fails a 403 landing in that case, which predates this change. I did not narrow it.
