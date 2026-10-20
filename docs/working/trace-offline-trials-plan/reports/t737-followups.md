# t737 session follow-ups: lead log

Trees: `fxwork/t737/!FluxIQWebExtension` and `fxwork/t737/!FluxIQ`, both on
`task/t737-session-followups`. Lead: lane lead (no commits). Worker reports sit beside this file as
`t737-u<N>-*.md`.

## Plan (2026-10-20)

Five independent units, partitioned by file, dispatched in parallel:

| Unit | Owner files | Worker |
| --- | --- | --- |
| 1 Fixture teardown and missing hello after worker restart | `apps/extension/e2e/fixtures/extension-context.ts`, `apps/extension/e2e/reconnect.spec.ts`, `apps/extension/src/background/**` start path (if a product defect) | worker-high, the only browser worker; owns extension builds |
| 2 `shown-addresses` over Core's 64 KiB per-value limit | `domain/src/runtime/llm-evidence/node-run/shown-addresses.ts`, `.../build-state/persistence.ts` and their tests (Core only if the owner turns out to be Core) | worker |
| 3 `summarize-task.mjs` repair-call double count | `scripts/lab/live-campaign/row/summarize-task.mjs` and its test | worker |
| 4 Browser-test scan extended to the whole repository | `apps/scenario-lab/e2e/realistic-scenario-guard*`, `browser-specs-scan*` and their tests; any spec it flags | worker |
| 5 Reset span inside trial runs, read by the build-time baseline | Core trial runner files emitting `core.test_subflow` / `core.test_candidate`, `packages/test-runner/src/build-time/**` | worker |

Rules for every unit: tests first; narrow checks (tests beside the change, touched typechecks, both
structure audits); own test build labels (`t737-u<N>`); no live or paid runs; no secrets or page data.

## Log

### 2026-10-20 - Unit 3: summarize-task repair double count (worker; verified by lead)
Real defect. `live-llm.json` `observed.calls` is the whole run's purse count (`runSpend.calls`, written in
`packages/test-runner/src/live-llm/live-llm-run.ts` `writeSnapshot`), repair already inside it; the row added
`repair.observed.calls` again. New private `providerCallsOf`: whole-run count used as is when `runSpend.calls`
is a number; older snapshots still sum build and repair. Test with a synthetic post-repair snapshot failed
first (expected 9, got 12). Lead: `node --test scripts/lab/live-campaign/row/tests/*.test.mjs` -> `# pass 41 # fail 0`.
Summaries written before the fix overstate repaired runs' calls by the repair's count.
UNIT READY: scripts/lab/live-campaign/row/summarize-task.mjs, scripts/lab/live-campaign/row/tests/summarize-task.test.mjs, docs/working/trace-offline-trials-plan/reports/t737-u3-summarize-task.md

### 2026-10-20 - Unit 2: shown-addresses over 64 KiB (worker; verified by lead)
Owner is domain (`node-run/shown-addresses.ts`, writing through Core's build-state store). Over 64 KiB Core
refused every write and a restart read only the last copy that fit. Now the stored copy is bounded to 48 KiB
(3/4 of `AUTOMATION_STUDIO_DOMAIN_BUILD_STATE_LIMITS.maxValueBytes`): typed texts first (newest first), then
the most recently shown addresses; an address shown again moves to newest; the page location is remembered
after its links. In-process memory is unbounded as before. Rule and reason (splitting would compete for
the 256 KiB per-build scope; forgetting can only refuse, never allow) in the header and
`docs/architecture/build-loop.md`. New `build-state/stored-prefix.ts` with its test. Lead:
`DOMAIN_TEST_BUILD_LABEL=t737-lead node scripts/test-domain.mjs src/runtime/llm-evidence/node-run/tests src/runtime/llm-evidence/node-run/build-state/tests`
-> `# pass 263 # fail 0`; `npx tsc -p tsconfig.test.json --noEmit` (domain) -> 0.
UNIT READY: domain/src/runtime/llm-evidence/node-run/shown-addresses.ts, domain/src/runtime/llm-evidence/node-run/build-state/{index.ts,stored-prefix.ts,tests/stored-prefix.test.ts}, domain/src/runtime/llm-evidence/node-run/tests/shown-addresses.test.ts, docs/architecture/build-loop.md, docs/working/trace-offline-trials-plan/reports/t737-u2-shown-addresses.md

### 2026-10-20 - Unit 5: reset step inside trials (worker-high; verified by lead)
Core has no span helper on the trial path; the classifier reads the step log, so the "span" is a new
step kind `reset` (`NNNN-reset/meta.json`: stage `start_hook` or `site_check`, trialToolId, outcome code,
timing; nothing the reset saw). Written by `llm/step-log/reset-step.ts` around the start hook
(`service/candidate-trial/run.ts`, the one function every start goes through) and the site check in both
trial gates; nothing written when no reset runs or the step log is off. Downstream: rule `trial-reset`, and
precedence now reset > trial > model > exploration so reset time leaves the trial once. Behaviour change:
a model-labelled reset inside a trial now also counts as reset (P0 data had none); the dated P0 report
`lane-t-u1-baseline.md` still states trial > reset. Core rebuilt in the t737 Core worktree. Lead: Core
`npx vitest run` on the 4 touched test files -> `4 passed (4)`, `44 passed`; Core structure audit ->
`passed (421 warning(s), 1152 baselined)`; downstream `node --test dist/build-time/tests/*.test.js` ->
`# pass 12 # fail 0` (core-build current, build cache reused).
UNIT READY: Core packages/fluxiq/src/programs/automation-studio/runtime/{llm/step-log/{reset-step.ts,index.ts,tests/reset-step.test.ts},flow-bootstrap/candidate/{trial-gate.ts,tests/trial-gate-reset.test.ts},flow-bootstrap/subflow-candidate/{subflow-trial-gate.ts,tests/subflow-trial-gate.test.ts},service/candidate-trial/{run.ts,tests/start-lease.test.ts}}; downstream packages/test-runner/src/build-time/{category-rules.ts,measure-build-time.ts,types.ts,render-build-time-table.ts,tests/measure-build-time.test.ts,tests/trial-reset.test.ts}, docs/architecture/testing-facility.md, docs/working/trace-offline-trials-plan/reports/t737-u5-reset-span.md

### 2026-10-20 - Unit 4: repository-wide browser-test scan (worker, then worker for 4b; verified by lead)
The scan now walks the whole repository: every source under a directory holding a Playwright config, and
every test file elsewhere that imports a real Playwright/Puppeteer value, launches a browser, or uses a kit
that does (type-only imports do not count). It finds 171 files in the two Playwright trees and 44 outside
them (no Playwright configs under packages, scripts or domain). It flagged three opt-in identity probes that
opened Chromium on a synthetic page only as an HTTP/WebSocket client; unit 4b replaced the browser with
Node's `fetch`/`WebSocket`, every assertion and step order unchanged. Lead: guard specs
`npx playwright test -c e2e/playwright.config.ts e2e/realistic-scenario-guard --workers=1` -> `9 passed`;
`tsc -p tsconfig.e2e.json` (scenario-lab) and `tsc -p tsconfig.json` (test-runner) -> 0.
Not verified: the probes end to end. The `FLUXIQ_CORE_IDENTITY_PROBE=1` run failed before any request with
"Owned Core identity child did not start": the probe's own 20 s child start-up timer, against a freshly
copied Core whose imports took 72.8 s to load on the loaded machine (6.7 s against Core directly).
Pre-existing, unrelated to the client swap; not raised here.
UNIT READY: apps/scenario-lab/e2e/realistic-scenario-guard/{find-browser-test-files.ts,drives-a-browser.ts,index.ts,tests/browser-specs-scan.spec.ts}, packages/test-runner/src/run-scenario/browser-session/{core-identity,host-identity,server-adapter-identity}/tests/server-probe.test.ts, docs/working/trace-offline-trials-plan/reports/t737-u4-browser-scan.md, docs/working/trace-offline-trials-plan/reports/t737-u4b-probes.md

### 2026-10-20 - Unit 1: fixture teardown and missing hello (worker-high; verified by lead)
Missing hello was a product race: `chrome.runtime.onInstalled` read the settings and wrote them back with
defaults, so a settings save landing in between (a test storing its gateway address) was replaced and the
restarted worker dialled the default gateway (the failing trace shows "Can't reach FluxIQ" every ~2.3 s).
The handler (`background/extension-installed.ts`) now writes no saved state: settings are read with
defaults (`storage.ts` `readSettings`) and the start-up (`buildConnection`) creates the client id. Unit test
failed against the old handler, passes now; a browser probe lost stored settings in 3/12 launches before,
0/12 after. Teardown time is Chromium's own graceful exit (0.6-25 s, profile flush); the fixture's own steps
take milliseconds, so the `extensionSession` fixture gets its own 90 s budget for launch and close, reason
in a comment; the fixture also waits for the worker's start-up (a status answer) before handing over. No
test wait raised, no assertion loosened. Worker: 5 consecutive headed runs `3 passed`. Lead:
`EXTENSION_TEST_BUILD_LABEL=t737-lead node scripts/test-extension.mjs src/background/tests` -> `# pass 100 # fail 0`;
`npx tsc -p tsconfig.test.json --noEmit` -> 0; two more headed runs of `e2e/reconnect.spec.ts --workers=2` ->
`3 passed (1.0m)`, `3 passed (37.9s)`. Not reproduced: the 2026-10-19 saturated load; other specs on the
changed fixture not run.
UNIT READY: apps/extension/src/background/{extension-installed.ts,index.ts,tests/extension-installed.test.ts}, apps/extension/e2e/fixtures/extension-context.ts, docs/working/trace-offline-trials-plan/reports/t737-u1-fixture-hello.md

### 2026-10-20 - Lead: tree-wide checks
`node scripts/structure-audit.mjs` downstream -> `passed (212 warning(s), 618 baselined)`; Core ->
`passed (421 warning(s), 1152 baselined)`. This log is part of every unit above.
