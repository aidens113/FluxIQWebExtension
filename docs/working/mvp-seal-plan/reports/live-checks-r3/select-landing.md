# Select/check landing (t885)

## Outcome
Done.

## What changed and why
- `apps/extension/src/runtime/click-landing.ts`: `sendStateCheckingLanding` now keeps the reply it got. A succeeded reply is judged by `judgeLanding` with start window 0 when `pageSawNoNavigation(reply, watch)`, else the existing 300 ms `NAVIGATION_START_GRACE_MS`. A failed verdict becomes `failedClick` (plus `checkWait` when it cleared), a cleared check adds `checkWait`, `stood` or no commit returns the reply unchanged. A non-succeeded reply is returned as before. The lost-reply path is unchanged. File comment and function doc updated. No click grace, window.open grace or post-press window code was touched (those are t891's and stay for clicks).
- `domain/src/actions/check-wait.ts`: `web.dom.select` and `web.dom.check` are given the 15 s allowance in `webAutomationCommandWaitsOutChecks` (the proposal still held; `webAutomationActionWaitsOutChecks` list unchanged).
- Tests: three in `click-landing-state.test.ts` (person-only check after an answered select; self-clearing check gives reply plus `checkWait`; `navigation:{began:false}` returns with no 300 ms grace); one in `check-wait.test.ts`.

## Commands run and observed results
- Extension tests (`runtime/tests/click-landing runtime/look-check/tests runtime/tests/action-runner`): 118 pass, 0 fail.
- Reverted (HEAD copies of click-landing.ts and check-wait.ts): `click-landing-state` 2 fail (the person-only and self-clearing tests), 12 pass; `check-wait` 1 fail (the select/check test). Change restored afterwards; domain `check-wait`: 7 pass, 0 fail.
- `pnpm --filter ...extension check` exit 0; `...domain check` exit 0 (Core build reported current).
- `node scripts/structure-audit.mjs`: passed (244 warnings, 552 baselined), exit 0. No new file added; runtime/ still 31 entries as counted by `ls` (includes subfolders and tests dir).

## Not verified
- The no-grace test passes with the change reverted too (the old code returned at once); it guards against the grace being applied unconditionally, which I did not mutate-test.
- No live or browser run. The caveat stands: where a reply carries no `navigation` report (no Navigation API), every succeeded select or check pays the 300 ms start grace, as a click does.
- Not checked whether content-side select/check paths read `action.timeoutMs` raw, so they may gain the 15 s on their own waits.

## Open questions
- `ls runtime | wc -l` printed 31 (it counts directories); the audit passed, so the file limit is not hit.
