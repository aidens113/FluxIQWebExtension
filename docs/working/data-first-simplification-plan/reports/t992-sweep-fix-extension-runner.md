# t992 report: sweep failures in the extension, test runner and check scripts

## Outcome
Done for five of the six; the sixth (the act-mark watch test) is fixed by making its precondition explicit, but the test file that leaks `chrome` in the sweep's order was not identified. The test-runner test (216) was edited but its rerun was still queued behind the machine's heavy-slot memory gate when this was written (see Not verified).

## What changed and why
1. **2026/2027/2028, `shown-value.test.ts` (getComputedStyle is not defined).** Product is fine. `shown-value.test.ts` installs `globalThis.getComputedStyle` once at load. `content/evidence/tests/set-apart.test.ts` (2026-11-11, 8959e4fa4) ran before it in the one shared process and ended two tests with an unconditional `delete globals.getComputedStyle`, removing the stub. Fixed in `set-apart.test.ts`: both tests save the prior descriptor and put it back, as the other eight stubbing tests already do. Passes in the sweep's order (evidence before extraction) in my subset run.
2. **3716, `runtime/act-mark/tests/watch.test.ts`.** `watchActMark(TAB, 0, undefined)` takes the default parameter, the worker's ambient `chrome.runtime.onMessage`, so the test depended on no earlier file leaving a `chrome` with `onMessage` (watch code from t968, a3aaa7270, 2026-11-19). It passes alone and with every subset I ran. I did not find which file leaks it (bisecting content/ and panel/ whole was blocked by the slot queue). Fix: the test now sets `chrome` to undefined for its own assertion and restores the previous descriptor. The leak source stays unidentified.
3. **216, `packages/test-runner/src/attempt-lane/tests/lab-attempt-command.test.ts`.** Superseded test, not a regression: `--recorded-model FILE` joined `lab attempt` (14a645262, 2026-11-22), so the error now reads "exactly one of --scripted-model, --recorded-model FILE or --live-llm ...". Both regexes updated to the new sentence; assertions kept (same two failure cases).
4. **722, `scripts/worktree/tests/core-build.test.mjs:122`.** Core's root build script gained `cloud:build` (Core e36af5873, 2026-11-18). Nothing downstream imports `@fluxiq/cloud` (grep finds no package.json or ts reference), so a worktree's compile list `CORE_PACKAGES` stays as is. `FULL_CORE_PACKAGES`, which the shared Core is built with and which the test holds to Core's root script, now includes `@fluxiq/cloud` between the libraries and `@fluxiq/web`, and `fullCoreDistPaths` counts `packages/cloud/dist/index.js` so an older shared Core is rebuilt. Fixtures updated: `core-build.test.mjs` expected calls, `scripts/task/tests/sync-core.test.mjs` library list and expected built steps.
5. **Extra, found while bisecting:** `panel/state/tests/request.test.ts` called `replyWith(t, ...)` twice in one test; the second captured the first's non-writable stub as "previous" and put it back last, leaving a read-only `chrome` that failed 20 tests in any run that reached `panel/state` after it (`panel/state/` alone failed 20, now passes). Split into two tests.

## Commands run and observed results
- `node --test scripts/worktree/tests/core-build.test.mjs scripts/task/tests/sync-core.test.mjs scripts/lab/core/build/tests/*.test.mjs scripts/check/core-build/tests/*.test.mjs` -> tests 49, pass 48, fail 0 (one skipped). Earlier run of core-build, apply-move, shared-core-move, sync-core: 24 of 25 passed, the one failure being my own wrong first expectation, since corrected.
- `node scripts/test-extension.mjs runtime/act-mark/tests panel/state/ content/evidence/tests content/extraction/item-mark/tests` -> pass 101, fail 0.
- Before the fixes: `item-mark/tests runtime/act-mark/tests` alone passed 17 of 17 (the three seat tests and the watch test are order-dependent, not broken alone); `panel/state/` alone failed 20; `request.test store-probe` failed 7.
- `pnpm run check` in packages/test-runner (after building `@fluxiq-web-extension/browser-host`, whose dist this worktree lacked) -> exit 0, `test-runner:check` built.

## Not verified
- Runner test 216 rerun (`node --test dist/attempt-lane/tests/lab-attempt-command.test.js` after `pnpm run build`): the build waited on the heavy slot (free memory about 2.0 GB, below its 2.5 GB gate) at the time of writing.
- The extension package `check` (tsc) and `node scripts/structure-audit.mjs` were not run for the same reason.
- The identity of the file leaking a `chrome` with `onMessage` before `runtime/act-mark` in the sweep order.
- No full extension suite, as the brief forbids it, so no proof of the sweep's whole order.

## Open questions
- Should `watchActMark` take an explicit "no channel" rather than treating `undefined` as the default? That would remove this hazard in the product signature; left alone.
