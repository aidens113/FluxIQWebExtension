# t733-v0: BEFORE baseline (headed, provider-free)

## Outcome

Done. Worktree created and installed. All three defects reproduced on commit 50500e8a, run headed. No LLM calls, no Lab runs, no commits.

## What changed and why

- New detached worktree `C:/Users/osrs_/FluxStuff/fxwork/t733-validate` at `50500e8a`. It is a throwaway; keep it for the AFTER run.
- Temporary probe `C:/Users/osrs_/FluxStuff/fxwork/t733-validate/apps/extension/e2e/content/tests/zz-capture-cost.spec.ts`. It exists only in that worktree, is untracked, and must never be committed. It opens company-website the way large-page-resolution row 2 does (`openQuietPage`: consent essential, newsletter and chat greeting dismissed through the Lab API, then reload). Next it prepends N filler anchors with the same `prependInteractiveFiller`. Then it times a single `harness.capture()` (the harness's `captureSnapshot` request) and prints `T733_PROBE anchors=N elapsed=Xms`. There are three rows: 0, 1000 and 6000 anchors.
- This report.

## Setup (repeatable)

```sh
cd "C:/Users/osrs_/FluxStuff/fxwork/t733/!FluxIQWebExtension"
git worktree add --detach C:/Users/osrs_/FluxStuff/fxwork/t733-validate 50500e8a
cd C:/Users/osrs_/FluxStuff/fxwork/t733-validate
npm_config_workspace_concurrency=1 pnpm install --frozen-lockfile --config.confirm-modules-purge=false --offline
```

The install arguments are the ones `scripts/worktree/install-worktree.mjs` uses (`INSTALL` plus `--offline` first). It finished in 4.2 s. No separate build step is needed. `test:content` runs `scripts/check/core-build.mjs`, which reported the shared Core build "current with its source". It also restores `test-contracts:build` from the build cache, and the global setup bundles the content script for each run. `test-content.mjs` passes every argument straight to Playwright, so `--output=<dir>` works as is.

Overhead: every `test:content` invocation took about 4 to 4.5 minutes of wall time beyond the test durations Playwright reported (for example 5m46s wall against 86 s of tests). This is global setup bundling plus teardown, not test time. Batch rows into one invocation where you can.

## Commands run and observed results

All commands ran from `C:/Users/osrs_/FluxStuff/fxwork/t733-validate`, with `O=C:/Users/osrs_/AppData/Local/Temp/claude/t733-validate-out`. The full logs are at `$O/<name>.log`.

### a. large-page-resolution

`pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/large-page-resolution.spec.ts --headed --workers=1 --trace=off --output=$O/large-page`

| Row | Result | Time |
| --- | --- | --- |
| 1 "a control past the old scan bound is enumerated and recovered" | FAIL: `Test timeout of 30000ms exceeded`, inside `page.evaluate` (harness.ts:113 deliver), from `runAction` at spec:126 | 40.2 s |
| 2 "a scan the bound does cut short says so" | FAIL: same timeout, from `runAction` at spec:153 | 40.1 s |
| 3 "an ordinary page still reports its same-family count" | pass | 6.1 s |

Summary: `2 failed, 1 passed (5.4m)`. Exit status 1.

### b. click.spec in-place row, 5 runs

`pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/click.spec.ts -g "in-place filters" --repeat-each=5 --headed --workers=1 --trace=off --output=$O/click-inplace`

| Run | Result | Time |
| --- | --- | --- |
| 1 | FAIL | 2.1 s |
| 2 | pass | 1.8 s |
| 3 | FAIL | 2.1 s |
| 4 | FAIL | 2.3 s |
| 5 | FAIL | 2.2 s |

All four failures are the same assertion, at click.spec.ts:524: `expect(await page.locator("[aria-busy]").getAttribute("aria-busy")).toBe("false")` got `"true"`. The earlier assertions passed in every run: the reply was `succeeded` with validation `passed` and an `IN_PLACE_CONTENT` actual. So the reply arrives while the results column is still busy. Screenshots are under `$O/click-inplace/*/test-failed-1.png`. Summary: `4 failed, 1 passed (4.4m)`.

### c. Capture cost probe

`pnpm --filter @fluxiq-web-extension/extension test:content -- zz-capture-cost.spec.ts --headed --workers=1 --trace=off --timeout=1200000 --output=$O/capture-cost`

| Anchors | Bare capture elapsed | Row time |
| --- | --- | --- |
| 0 | 226 ms | 2.1 s |
| 1,000 | 28,401 ms | 52.5 s |
| 6,000 | 303,764 ms | 5.3 m |

Summary: `3 passed (9.2m)`, wall time 9m57s. For comparison, t730's report measured 371,716 ms at 6,000 anchors. The September figure in the spec's comment was about 4 s for a 5,000-element page.

To run one row only, add `-g "with 1000 anchors"` (or `with 6000 anchors`, or `with 0 anchors`). Read the result with `grep T733_PROBE` on the log.

## Not verified

- Only the content harness ran: no extension load, no side panel, no Firefox.
- There was one probe sample at each size, so run-to-run variance is unmeasured.
- I did not investigate the root cause of any defect, because the brief asked for a measurement only.

## Open questions or contradictions found

- `pnpm install`'s `prepare` script runs `git config core.hooksPath .githooks`, which writes the shared repository config. The value is presumably identical to what is already set, but I did not check.
- The test-name filter `content/tests/large-page-resolution.spec.ts` works because Playwright matches it as a regex against the full path under `e2e/content/tests`.
