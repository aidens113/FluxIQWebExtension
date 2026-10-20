# t737 unit 4: realistic-scenario scan over every browser test

## Outcome

Partial. The scan now walks the whole repository and finds every browser test
there. Its rule is unchanged. Run over the wider set, it flags three
env-gated identity probes in `packages/test-runner`. Each one launches Chromium
against an HTML page that its own HTTP server serves. None of the three can be
fixed mechanically, so I did not edit them. The scan spec stays red until the
supervisor decides what to do with them (see Open questions).

## Inventory (before the change)

How the old scan worked: it covered every source file in two hard-coded
Playwright trees (`apps/scenario-lab/e2e`, `apps/extension/e2e`). It also
covered files in a `tests` folder under `apps/scenario-lab/src` whose source
matched a Playwright `from` import, and that match included `import type`.

Browser tests in the repository today. Excluded throughout: node_modules,
dist, build, `.test-build*`, test-runs, test-results and `.harness-build`.
- Playwright configs: `apps/scenario-lab/e2e/playwright.config.ts`, plus
  `apps/extension/e2e/playwright{,.content,.content.chromium-baseline,.content.firefox}.config.ts`
  and `apps/extension/e2e/user-script-feasibility/playwright.config.ts`. There
  are no configs under `packages/**`, `scripts/**` or `domain/**`. The two
  trees hold 15 and 156 source files.
- Node tests outside those trees that drive a real browser: 44.
  - 40 are in `apps/scenario-lab/src/scenarios/<realistic>/tests`. Some import
    Playwright directly. Others use a kit: `site-driver.ts`,
    `browser-harness.ts`, `browser-kit.ts`, `browser-session.ts`. The old scan
    missed the kit users.
  - 1 is `packages/test-runner/src/guarded-browser/tests/...`, a direct launch.
  - 3 are the `run-scenario/browser-session/*-identity/tests/server-probe.test.ts`
    files, which call `chromium.launch` directly.
- About 15 `packages/test-runner` unit tests import Playwright types only
  (`import type { Page }`) and run against fake pages. They open no browser,
  so they are not browser tests, and the scan leaves them alone. Most of them
  name synthetic scenarios.
- Nothing in `scripts/**` or `domain/**` launches a browser. No file uses
  Puppeteer.

## Scan change

All new code is in `apps/scenario-lab/e2e/realistic-scenario-guard/`:
- `find-browser-test-files.ts` (new): `findBrowserTestFiles(root)` walks the
  repository in sorted order. It returns two kinds of file:
  - Every source file under a directory that holds a `playwright*.config.*`
    (`why: "playwright-tree"`).
  - Every test file anywhere else, meaning one in a `tests` folder or named
    `*.test.*` / `*.spec.*`, that drives a real browser
    (`why: "launches-a-browser"`).

  It skips dependencies, build output, run evidence and browser state. The walk
  takes about 0.2 s.
- `drives-a-browser.ts` (new): `drivesABrowser(file, cache)` returns true for
  a file that does any of these:
  - imports a value, not only types, from `@playwright/test`, `playwright`,
    `playwright-core`, `puppeteer` or `puppeteer-core`, whether by `from`,
    dynamic `import()` or `require`
  - calls `chromium|firefox|webkit.launch*(` or `launchPersistentContext(`
  - imports a value from a test kit (a module inside a `tests` folder) that
    drives a browser, at any depth

  It does not follow production modules (explained under Not verified).
- `index.ts`: exports both from the barrel and updates the header comment.
- `tests/browser-specs-scan.spec.ts`: the two old scan tests (two trees, then
  lab source) become one test over `findBrowserTestFiles`. The
  "launches a browser inside a synthetic scenario directory" check now applies
  to every file found. A new test fails if the walk stops finding browser
  tests in any of five areas: scenario-lab e2e, extension e2e, the content
  harness, the lab scenarios and test-runner. It also fails if any found path
  sits under node_modules, dist, test-runs or `.test-build*`. The
  `findSyntheticPageUses` rule itself is unchanged.

## Flags and disposition

| File:line | What | Disposition |
| --- | --- | --- |
| `packages/test-runner/src/run-scenario/browser-session/core-identity/tests/server-probe.test.ts:40` | `chromium.launch` (line 19), then `page.goto` on a forked HTTP server that answers `/` with `text/html` ("Owned identity probe") | Not edited |
| `packages/test-runner/src/run-scenario/browser-session/host-identity/tests/server-probe.test.ts:63` | Same pattern ("Owned built-host proof"), launch at line 36 | Not edited |
| `packages/test-runner/src/run-scenario/browser-session/server-adapter-identity/tests/server-probe.test.ts:53` | Same pattern ("Owned adapter proof"), launch at line 27 | Not edited |

Why these are not mechanical fixes: each probe opens its own server's origin
so that `page.evaluate(fetch(...))` can call that server's runtime-identity
endpoint from the same origin. Pointing the page at a realistic scenario would
need a Scenario Lab instance, and the fetch would become cross-origin (CORS).
That changes what the test proves, so the brief rules it out. All three are
skipped unless `FLUXIQ_{CORE,HOST}_IDENTITY_PROBE=1` or
`FLUXIQ_SERVER_ADAPTER_PROBE=1` is set, so they are opt-in proofs, not part of
the default suite.

## Commands run and observed results

- `npx playwright test -c e2e/playwright.config.ts e2e/realistic-scenario-guard --reporter=list --workers=1 --output <scratchpad>/u4`
  from `apps/scenario-lab`: `1 failed, 8 passed (37.6s)`. The one failure is
  "no browser test in the repository opens a synthetic scenario or serves its
  own page", listing exactly the three server-probe lines above.
  - An earlier run counted type-only imports as browser tests and flagged 54
    uses in 15 files. That is how I found and removed the false positives.
  - I ran `browser-specs-scan.spec.ts` alone again after the final edit:
    3 passed, 1 failed, with the same three flags.
- `npx tsc -p tsconfig.e2e.json --noEmit`: exit 0, after fixing a narrowing
  error from `includes`. `npx tsc -p tsconfig.json --noEmit`: exit 0.
- `node scripts/structure-audit.mjs` at the repo root: 1 violation, nothing in
  `realistic-scenario-guard`. It is
  `FAIL [directory-files] domain/src/runtime/llm-evidence/node-run/tests/: 26 source files exceeds the 25-file limit`,
  caused by the untracked
  `domain/src/runtime/llm-evidence/node-run/tests/shown-addresses-stored.test.ts`,
  which another t737 worker added. Not mine.

## Not verified

- Production modules that drive a browser (the Lab runner in
  `packages/test-runner/src`, such as `demo-workspace`, `ui-e2e` and
  `run-scenario`) are not scanned. They are not tests, and their scenario
  choice is enforced at runtime by `unrealisticScenarioRefusal` at the launch
  entries.
- A unit test that uses a production browser launcher (rather than a `tests`
  kit) is not counted as a browser test. Its own source shows no browser
  launch, and following production imports flagged about 40 browser-free tests
  (lab-runs, build-time, bench) through barrels.
- Imports by workspace package name (`@fluxiq-web-extension/...`) are not
  followed. Only relative imports are.
- I did not build the extension, run any full suite, or do a live run.

## Open questions or contradictions found

- The three env-gated identity probes break AGENTS.md's realistic-only rule:
  they launch a browser on a self-served page. The supervisor or the user
  needs to choose one of these:
  - move the probe's HTTP calls out of the browser, using Node `fetch` instead
    of `page.evaluate`, if Chromium does not matter to what they prove
  - serve the probe origin through a realistic scenario
  - record an explicit exemption in AGENTS.md, which only the user can grant

  Until then the scan spec fails on them, by design.
