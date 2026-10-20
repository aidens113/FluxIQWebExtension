# t744 sweep-1020b fixes

## Outcome

Done. Both failures traced to root cause. In both cases the test was wrong and the product was right. No product code, product ceiling or wait was raised.

## What changed and why

### Failure 1, Core: exploration token-ceiling test

File: `packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap/tests/exploration.test.ts`, test "records a build's token totals past one request's ceiling when its budget allows them".

How I found the cause: I temporarily added a line to `llm/harness/run.ts` that dumped each request's measured size. It has since been reverted with `git checkout`, and the file is clean. I then measured the same test against three versions of `packages/fluxiq/src`:

| Core version | 3rd request estimate | Node catalog bytes | Result |
| --- | --- | --- | --- |
| `ca23a8ba` (what sweep 1020 tested) | 19,914 | 31,580 | pass |
| `3b13e394^1` (before t741) | 20,035 | 31,943 | fail |
| `3b13e394` (HEAD) | 20,035 | 31,943 | fail |

- t741 did not cause it. Its judge memory and recording excerpt do not reach this request, and its system-prompt growth (in `loop_verification`) belongs to the judge's request, not to exploration.
- The growth is exactly one catalog entry. t738-b1 added a `records` parameter to `builtin.data.write-records` (3,114 to 3,477 bytes), and the `records` input became optional.
- The packed request carries the whole node catalog. The size check uses the larger of the packed request and the messages actually sent, so the catalog counts toward it, even though it is never sent or billed. The priced input stayed at 9,150 tokens.
- The test had set its own per-request window at 20,000 input / 22,000 total. That left 86 tokens of headroom, and the new parameter used 121.
- The product's real window is 1,000,000 tokens (`AUTOMATION_STUDIO_LLM_DEFAULT_TOKEN_LIMITS`). 22,000 was the test's choice, not a product ceiling.

Decision: the growth is intended model-facing capability and well within the product's window, so the test was stale. I moved its window to the harness default of 28,000 / 2,000 / 30,000. The test's point still holds: the build's total of 60,880 is past one request's 30,000 window, and the 100,000 run budget allows it. The test comment now gives the reason, and says this is the test's window rather than a product ceiling. Every other expectation in the test is unchanged (totals 50,800 / 10,080 / 60,880, five decisions, two judge requests). No model-facing text changed.

### Failure 2, downstream: crossborder `flash-deal-on-arrival` 1000 ms `waitFor`

File: `apps/scenario-lab/src/scenarios/crossborder-marketplace/tests/browser-paths.test.ts`.

- The site has no race and no regression:
  - Nothing has touched crossborder since 2026-10-19. t730's `cart-add-ons` change does not touch the interruption code.
  - The armed home page always includes the promotion template (`interruptionDue` with visit 1).
  - The storefront's inline module script stamps the promotion as it runs, and the browser runs that script before it fires DOMContentLoaded.
- A probe recorded what was on the page right after `reload({ waitUntil: "domcontentloaded" })`. With no extra load it found `flash: true, welcome: false` 3 of 3 times.
- With 16 CPU burners on this 8-core machine and 4 parallel probes: in 20 of 20 loads the promotion was already in the page, yet the old 1000 ms `waitFor` ran out 8 times.
  - That timer measures the test's own round trips to the browser, not the site.
  - In 1 of the 20, the welcome popup's two-second timer fired before the test's next round trip. The test's following "welcome count is 0" check therefore had the same load-sensitive race.
- 10 parallel runs of the old test with no burners all passed, which fits a failure that only appears under heavy load, as in the sweep.

Fix:
- Before each relevant reload, the test now adds a context init script, `RECORD_AT_LOAD`. On DOMContentLoaded the page itself records whether "⚡ Flash Deal" and "Welcome back, Mara!" are visible.
- `shownAtLoad` reads that record. If DOMContentLoaded has not fired yet it waits for the event, never for a clock.
- This is stricter than before (the promotion must be present when parsing finishes, with zero wait) and load cannot break it.
- I applied the same fix to the three other identical 1000 ms waits in this file (`flash-deal-second-item` once, `flash-deal-stuck` twice).
- Negative check: unarmed, the record reads `{ flash: false, welcome: false }`; armed, `{ flash: true, welcome: false }`.

Nothing in t743's or t742's files was touched.

## Commands run and observed results

- Core, `npx vitest run .../deepseek-bootstrap/tests/exploration.test.ts -t "past one request"`: before the fix it failed reproducibly with `flow_bootstrap.pre_provider_request_total_exceeded`, `estimatedInputTokens: 20035`. After the fix, run alone 3 times: `Tests 1 passed | 7 skipped (8)` each time.
- Core, `npx vitest run .../deepseek-bootstrap/tests/` (the directory), 3 times: `Test Files 2 passed (2)`, `Tests 11 passed (11)` each time.
- Core, `pnpm check` in `packages/fluxiq` (tsc --noEmit): exit 0, `fluxiq:check` built in 81,867 ms with no errors.
- Core, `node scripts/structure-audit.mjs`: `structure-audit: passed (428 warning(s), 1152 baselined)`. It also printed "1 baseline entries can be lowered". This edit changed only lines inside an existing test, so it did not cause that. I did not run `structure:baseline`.
- Downstream, scenario-lab build (`scripts/build-cache/cli.mjs scenario-lab:build`): rebuilt.
- Downstream, before the fix: `node --test --test-name-pattern="flash-deal-on-arrival" dist/.../browser-paths.test.js` passed alone 3 of 3. The crossborder directory passed 2 of 3; the run that failed did so on a different test (`follow-official-store`, step `chat-arrives`, 6000 ms) while Core vitest was running in parallel.
- Downstream, after the fix: `--test-name-pattern="flash-deal"` (all four flash tests) run alone 3 times: `# pass 4  # fail 0` each time.
- Downstream, after the fix: `node --test dist/scenarios/crossborder-marketplace/tests/*.test.js` 3 times: `# tests 59  # pass 59  # fail 0` each time.
- Downstream, `pnpm check` in `apps/scenario-lab` (tsc src and e2e): exit 0, no errors.
- Downstream, `node scripts/structure-audit.mjs`: `structure-audit: passed (218 warning(s), 618 baselined)`.
- Prompt contract tests: not run, because no model-facing text changed. Only a test's token limits and comment changed.

## Not verified

- Under the extreme synthetic load (16 burners plus 4 parallel browsers), 2 of 4 runs of the fixed test failed later in the recorded path, at `choose-spain` (click, the harness's 12 s step timeout). The new at-load assertion passed in those runs. I did not diagnose this, because it is a heavier load than the sweep's, and the fix would need the shared step timeout or the path itself, which is outside this brief.
- The earlier `follow-official-store` `chat-arrives` timeout under concurrent load was not investigated. It is not one of the two sweep failures.
- The welcome half of the at-load record has only been seen reading `false`. The welcome only ever appears by timer, so I could not show it reading `true` at load. It uses the same visibility logic as the promotion half, which was checked both ways.
- No full suites were run, per AGENTS.md.

## Open questions or contradictions found

- The brief guessed t741 or t738's guidance. The real cause was t738-b1's write-records `records` parameter, which entered through the node catalog, not through guidance or prompt text.
- The size check counts the packed request, including the whole catalog, so any catalog growth moves every test that sets a narrow window. Other tests that set tight `tokenLimits` may be close to the edge as well. I did not audit them.
- The Core structure audit reports one baseline entry that can be lowered, unrelated to this change.

UNIT READY: C:/Users/osrs_/FluxStuff/fxwork/t744/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap/tests/exploration.test.ts, C:/Users/osrs_/FluxStuff/fxwork/t744/!FluxIQWebExtension/apps/scenario-lab/src/scenarios/crossborder-marketplace/tests/browser-paths.test.ts
