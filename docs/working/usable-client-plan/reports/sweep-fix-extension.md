# Sweep fix: extension and scenario-lab (t918)

## Outcome
Done. All five tests pass. Four were outdated test support or expectations; no product regression was found. The scenario-lab failure was not reproduced, so its fix addresses a race I inferred, not one I observed.

## What changed and why
1. `apps/extension/src/content/actions/tests/covered-press-clears.test.ts` and `execute.test.ts` (test support only).
   - Cause: commit `d43b357f8` (2026-11-11, "Observe delayed control binding before retrying an unanswered press") added an optional dependency `watchPressReadiness`. `click.ts:569` calls it as `deps.watchPressReadiness?.(...)`.
   - Both tests' dependency Proxy turns any unprovided property into a function that throws `not provided: <name>`. So the optional call threw, and the catch routed to `deps.failure`, which covered-press-clears did not provide. That is where `not provided: failure` came from. In execute.test it surfaced as a failed click.
   - Fix: both tests now provide `watchPressReadiness: () => undefined`, as `click/dependencies.ts` already does. Source untouched.
2. `apps/extension/src/runtime/tests/result-mapping.test.ts` (outdated expectation).
   - Cause: commit `a111d62cd` (2026-11-10, "Read one element as a one-row record, hover like a person...") made `web.dom.hover` a supported act (t903). Commit `7bd4832c5` already made the same correction in the domain's gateway-mapping test.
   - Fix: the "unknown type" cases now use `web.dom.teleport`, which is truly unknown. The assertions are unchanged.
3. `apps/scenario-lab/src/scenarios/photo-social/tests/honest-and-naive-paths.test.ts` ("seven-post union plus a like").
   - It passed alone and in its whole file (13/13) before my edit, so the sweep failure did not reproduce.
   - Likely cause: commit `0d46c0b72` (2026-10-20) made the heart show done only once the server has the like. The test read the account record (`photo-studio-account`, `liked`) immediately after the click and asserted `liked == [DNcepNICLlQ]`. That is a race that fails under sweep load.
   - Fix: after the click, the test polls (up to 15 s) until `liked` is non-empty before asserting. The oracle comparison is unchanged and not weakened.
   - I first tried a Playwright `hasText` wait and it timed out, so I replaced it with the poll.

## Commands run and observed results
- `EXTENSION_TEST_BUILD_LABEL=t918a node scripts/test-extension.mjs covered-press-clears` -> pass 1, fail 0.
- Same runner with `actions/tests/execute.test` -> pass 10, fail 0.
- Same runner with `runtime/tests/result-mapping` -> pass 6, fail 0.
- Same runner with `content/actions/tests runtime/tests` (both full folders) -> tests 732, pass 732, fail 0.
- scenario-lab: `pnpm build`, then `node --test dist/scenarios/photo-social/tests/*.test.js` -> pass 41, fail 0. This is the whole photo-social test folder.
- EXT `node scripts/structure-audit.mjs` -> "structure-audit: passed (251 warning(s), 551 baselined)".

## Not verified
- The extension `tsc -p tsconfig.test.json --noEmit` is not clean on this tree. Every error is in `packages/test-runner` and `e2e` and comes from unbuilt sibling packages, such as `Cannot find module '@fluxiq-web-extension/domain/node'` and the implicit-any errors that follow from it. No error is in the files I changed, and I changed no extension source, only test files. I did not build domain to confirm it goes clean.
- The scenario-lab race is a hypothesis. I could not reproduce the sweep failure, only make the test wait for the server's answer. If it fails again under load, the next step is to capture the actual diff.
- Full scenario-lab suite not run, only the photo-social folder.

## Open questions or contradictions
- The Proxy pattern in extension click tests (an unprovided optional dependency becomes a thrower) will bite again for any new optional dependency. A structural fix would make those Proxies return `undefined` for optional members. I left it alone because it is outside the five named tests.
