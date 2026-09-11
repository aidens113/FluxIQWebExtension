# Report: w1-extension-unit-tests

## Outcome

Done. The extension now has a unit-test runner on the domain's pattern.
`pnpm --filter @fluxiq-web-extension/extension test` runs the smoke check,
then 61 node:test tests in 12 new test files. All 61 pass. `check` now
type-checks the tests in a second pass, and a deliberate type error in a
test fails it. No source file under `apps/extension/src/` changed. No test
exposed a failing defect. Four behaviours that need a decision are listed
under open questions.

## What changed and why

- **`apps/extension/scripts/test-extension.mjs`** (new, 70 lines). It
  mirrors `domain/scripts/test-domain.mjs`. It finds every
  `src/**/tests/*.test.ts` and bundles each one as its own esbuild entry
  (platform node, ESM, `node22`, `.mjs`). It then imports each bundle, and
  node:test runs it. It differs from the domain script in these deliberate
  ways:
  - `EXTENSION_TEST_BUILD_LABEL` has the same kebab-case validation. With no
    label, the run writes to `default`. There is no tracked output directory:
    every run goes to the ignored `apps/extension/.test-build-scratch/<label>/`.
  - Before building, it clears only its own label's directory. A deleted test
    therefore leaves no stale bundle behind, and a run under another label is
    untouched.
  - It uses `sourcemap: "linked"` with `process.setSourceMapsEnabled(true)`,
    so a failure reports the test's source line. The failure probe below
    shows this.
  - It keeps the domain's externals: `fluxiq`, `fluxiq/*`,
    `@fluxiq/client-gateway-websocket` and its subpaths. They resolve at run
    time through `apps/extension/node_modules`. I checked that both load
    under Node 22.11.0. `@fluxiq-web-extension/domain/client` is bundled from
    source.
  - I read `build-extension.mjs` but did not reuse its esbuild settings.
    They are browser settings (platform browser, `chrome109`/`firefox109`,
    iife for the content script), and the brief names the domain's Node
    pattern as the model.
- **`apps/extension/tsconfig.json`**: added `"exclude": ["src/**/tests/**"]`.
  The source pass (the first half of `check`, and `build`'s type check) now
  sees no test file, so source cannot come to depend on test-only code.
  Without the exclude, the existing `include: ["src/**/*.ts"]` would have
  silently pulled the tests into `build`'s type check.
- **`apps/extension/tsconfig.test.json`** (new): extends `tsconfig.json`,
  sets `noEmit: true`, keeps the same `include`, and sets `exclude: []` so
  the tests are back in. This is the domain's two-pass approach, as
  reported by w1-domain-test-typecheck.
- **`apps/extension/package.json`**:
  - `check` is now `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`.
  - `test` is now `node scripts/smoke-test.mjs && node scripts/test-extension.mjs`.
  - `test:content` (from w1-content-harness) and `build` are unchanged.
  - My first attempt at this edit used a node one-liner. It stopped at its
    own canonical-form guard before writing anything, so I made the edit with
    the Edit tool instead.
- **`.gitignore`**: one line, `apps/extension/.test-build-scratch/`.
- **Tests**: 12 files, 61 tests. Each file imports its subject module
  directly (for example `../runtime-status`) rather than the directory
  barrel, so a Node bundle carries only what its subject needs. The audit's
  `imports` rule allows a `tests/` folder to import its parent directory's
  files, and the domain's tests use both forms.

| Test file | Tests | What it covers |
| --- | --- | --- |
| `src/runtime/tests/result-mapping.test.ts` | 8 | **Brief item 1.** An unknown type is rejected, never rewritten. `gatewayActionResultFromRejection` gives `status: "failed"`, `completedAt`, `message` equal to `error`, and `metadata: { code: "ACTION_REJECTED", requestedActionType }`. The requested type comes back verbatim for `""`, `"WEB.DOM.CLICK"`, `"click"` and `"web.dom.hover"`. All 11 known types pass through unchanged. Target and parameters map to `selector`, `text`, `timeoutMs`, `coordinates` and `options`. The legacy `dom.click` arrives as `web.dom.click`. A browser result maps to a gateway result: status, `startedAt`, `completedAt` from `finishedAt`, message, a target from the element, the payload, and a visual target derived from the element. `error` is set only on `failed`. An explicit visual target wins over the derived one, and `extracted` is kept. |
| `src/background/connection/tests/runtime-status.test.ts` | 10 | **Brief item 2.** `runtimeConfirmationForActionResult` for all 11 action types. The expected table is a `Record<BrowserActionType, …>`, so it will not compile if a type is added without being classified. It is also checked against the domain's runtime `WEB_AUTOMATION_ACTION_TYPES`. `type` and `select` carry the value only when the element has one: an empty string is kept; with no element, or with input capture off, the key is absent; `selectedValue` is not used as a fallback. `clear` carries `""`, and no other type carries a value. Ten sensitive descriptors, each for both `type` and `select`, confirm with no `inputValue` (strict deep equality proves the key is absent): `password`, `PASSWORD`, `current-password`, `new-password`, `New-Password`, `one-time-code`, `cc-number`, `cc-csc`, a select with `cc-exp-month`, and `data-sensitive="true"`. Five near misses keep their value. **Brief item 3:** labels, result targets and the status tracker. |
| `src/runtime/tests/action-runner.test.ts` | 1 | `browserActionFailure` |
| `src/background/connection/tests/value-readers.test.ts` | 7 | all 8 readers |
| `src/background/connection/tests/recorded-event.test.ts` | 7 | all 8 functions |
| `src/background/connection/tests/browser-state.test.ts` | 6 | `unsupportedPageForUrl`, `actionTypesFromCapabilities`, `describeActiveTabLike`, `browserStateFromTabs` |
| `src/background/connection/tests/recording-manifest.test.ts` | 4 | the three source-id functions, `tabSourceId`, `recordingSources`, `recordingActionChannels` |
| `src/background/connection/tests/frame-geometry.test.ts` | 4 | `translateFrameElements`: no offset; viewport bounds; bounds known only from the frame document; no geometry |
| `src/background/connection/tests/gateway-payloads.test.ts` | 5 | `recordedInputId` over 12 rows, including `dom.wheel` mapping to no input; `gatewayRecordingEventFromPayload`; `recordingEvidencePayload` |
| `src/background/connection/tests/activity-log.test.ts` | 5 | `ActivityLog`: ordering, the 20-entry and 500-entry limits, page clamping, `clearRecent` and `reset` |
| `src/background/connection/tests/pointer-click-filter.test.ts` | 2 | `PointerClickFilter`, driven by a hand-built fake `setTimeout`. node:test's MockTimers prints an `ExperimentalWarning` on Node 22.11 (probed). |
| `src/background/connection/tests/event-sequence.test.ts` | 2 | `EventSequence` |

**Brief item 3: further pure functions covered.**

- `runtime-status.ts`: `runtimeActionLabel`, `runtimeResultTarget`,
  `RuntimeStatusTracker`.
- `action-runner.ts`: `browserActionFailure`.
- `value-readers.ts`: all eight readers.
- `recorded-event.ts`: all eight functions.
- `browser-state.ts`: `unsupportedPageForUrl`,
  `actionTypesFromCapabilities`, `describeActiveTabLike`,
  `browserStateFromTabs`.
- `recording-manifest.ts`: `eventSourceId`, `observationSourceId`,
  `stateSourceId`, `tabSourceId`, `recordingSources`,
  `recordingActionChannels`.
- `frame-geometry.ts`: `translateFrameElements`.
- `gateway-payloads.ts`: all three exports.
- `activity-log.ts`: `ActivityLog`.
- `pointer-click-filter.ts`: `PointerClickFilter`.
- `event-sequence.ts`: `EventSequence`.

**Left uncovered, and why.**

- `recordingEnvironment` reads `chrome.runtime.getManifest()` and
  `navigator`.
- `browserStateSnapshotFromTabs` passes straight through to the domain's
  `createWebAutomationStateFromTabs`, so asserting its output would test
  the domain.
- The rest of `src/runtime/` uses `chrome.tabs`.
- I did not read the other `background/connection/` modules:
  `gateway-session`, `content-attachment`, `core-api`, `dom-snapshot`,
  `navigation-recorder`, `project-context`, `recording-evidence` and
  `state-assets`. I cannot say whether they hold more cheap pure functions.

## Commands run and observed results

All were run from `F:\!FluxIQWebExtension` unless noted.

1. **Baseline, before any edit.**
   - `pnpm --filter @fluxiq-web-extension/extension check` ran
     `tsc -p tsconfig.json --noEmit` and exited 0.
   - `pnpm --filter @fluxiq-web-extension/extension test` printed
     `Extension smoke test passed.` and exited 0.
   - `node scripts/structure-audit.mjs` exited 0 and printed
     `structure-audit: 1 baseline entries can be lowered.` and
     `structure-audit: passed (27 warning(s), 19 baselined).` I saved the
     full output to scratch for comparison.
2. **The tsconfig edit leaves build output unchanged.** A scratch script,
   `w1-ext-unit-bundle-hashes.mjs` in my scratchpad, calls the exported
   `bundleExtensionEntry` for all four entries. It writes to a scratch
   directory, never to `build/` or `dist/`, and hashes each bundle and map.
   Before and after the `exclude` edit, the eight hashes were identical and
   the diff was empty (`HASHES IDENTICAL`). Two of them:
   `11209e68b778…cf526e3  content/index.js` and
   `82e8177b16f1…ec220c27  background/index.js`.
3. **`check`.** `pnpm --filter @fluxiq-web-extension/extension check` ran
   `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json` and exited
   0 with no diagnostics.
4. **What each config covers** (`npx tsc -p <config> --listFilesOnly`, run
   in `apps/extension`).
   - `tsconfig.json`: 75 files under `apps/extension/src/`, none of them
     under `tests/`.
   - `tsconfig.test.json`: 87 files, which is those 75 plus the 12 test
     files, each listed by name.
5. **`test`, as the brief names it.**
   `pnpm --filter @fluxiq-web-extension/extension test`, with no label,
   exited 0. It printed `Extension smoke test passed.` and then TAP output:
   `# tests 61`, `# pass 61`, `# fail 0`, `# cancelled 0`, `# skipped 0`,
   `# todo 0`, `# duration_ms 101.3585`. There were no warnings. An earlier
   labelled run (`EXTENSION_TEST_BUILD_LABEL=w1-extension-unit-tests`), with
   11 of the files written at that point, passed 47 of 47.
6. **Deliberate type error.** I appended
   `const w1ExtensionUnitTestsProbe: number = "not a number";` to
   `value-readers.test.ts`.
   - The old check command, `npx tsc -p tsconfig.json --noEmit`, exited 0,
     so it misses the error.
   - The new `check` exited 2 with
     `src/background/connection/tests/value-readers.test.ts(56,7): error TS2322: Type 'string' is not assignable to type 'number'.`
   - I restored the file from a backup. The script printed
     `REVERTED: hashes match (049e3bed…7e9525d)`, grep found 0 probe lines,
     and `check` exited 0 again.
7. **A failing test fails the run.** I appended a `test(...)` that asserts
   `1 === 2` to `event-sequence.test.ts` and ran under the label
   `w1-extension-unit-tests-probe`.
   - The run exited 1 with
     `not ok 14 - w1 probe: a failing assertion fails the run`,
     `# tests 62`, `# pass 61`, `# fail 1`.
   - The stack named `event-sequence.test.ts:24:66`, the source line, so the
     source maps work.
   - I restored the file; the hashes matched (`11189bea…18fa7a`). I removed
     the probe's build directory.
8. **Ignore rule.**
   `git check-ignore -v apps/extension/.test-build-scratch/default/runtime/tests/result-mapping.test.mjs`
   printed `.gitignore:26:apps/extension/.test-build-scratch/`. `git status`
   does not list the scratch directory. I removed my labelled directory;
   only `default` remains, from the command in item 5.
9. **Structure audit including the new files.** The audit reads only
   tracked files, so I made it see mine without touching the real index:
   - I copied the git index to scratch and ran `GIT_INDEX_FILE=<copy> git add`
     on my new files. The real index is unchanged: `git diff --cached` is
     empty and the files still show as `??`.
   - `GIT_INDEX_FILE=<copy> node scripts/structure-audit.mjs` exited 0. Its
     output is byte-identical to the baseline
     (`AUDIT OUTPUT IDENTICAL TO BASELINE`), and no line names a new file.
   - `--json` shows `failures: []` and one lowerable entry,
     `{"rule":"imports","key":"domain/src/client/index.ts","value":1,"recorded":2}`
     (`../runtime/capabilities` at line 7). It was already present before my
     changes. I did not run `pnpm structure:baseline`.
   - The `git add` into the copied index wrote loose blob objects to
     `.git/objects`. Nothing references them, and they are harmless.
10. **Line counts** (`wc -l`). The largest new file is
    `runtime-status.test.ts` at 181 lines, and every new file is under the
    400-line advisory threshold. `background/connection/tests/` holds 10
    files, under the 15-file advisory threshold.

## Not verified

- I did not run `pnpm build` or the root `pnpm check`, `pnpm test` and
  `pnpm build`. `build` deletes `dist/` and rewrites the tracked `build/`,
  which lab runs by other workers use. Item 2's bundle-hash comparison
  shows build equivalence instead.
- I ran the runner only on Windows with Node 22.11.0.
- Two concurrent runs without a label share `default`, and the second
  clears the first's bundles. Labels exist for that case.
- These tests cover pure logic only. Nothing here exercises the chrome
  APIs, the content script, the gateway, or a browser.
- I did not check editor behaviour. Editors attach a test file to the
  nearest `tsconfig.json`, which now excludes it. This is the same caveat
  as the domain's.
- I did not check that `background/connection.ts` calls
  `runtimeConfirmationForActionResult` only for succeeded results. That
  file was outside my reads.

## Open questions or contradictions found

1. **`timed_out` and `cancelled` results are treated inconsistently.**
   `gatewayActionResultFromBrowserResult` sets `error` only when
   `status === "failed"` (`result-mapping.ts:62`), so these results reach
   the gateway with no `error`. `RuntimeStatusTracker.finish` treats every
   non-succeeded status as failed and sets `error`
   (`runtime-status.ts:41`, `:54`). The tests assert only the brief's two
   cases: `failed` has an error and `succeeded` has none. The supervisor
   should decide which behaviour is right; it probably belongs with Wave 3's
   structured failure field.
2. **`unsupportedPageForUrl` misses some pages** (`browser-state.ts:21`).
   Its pattern requires `://`, so `about:blank` and other `about:` URLs,
   `view-source:` and `data:` URLs do not match and are reported as
   recordable. The current Chrome Web Store host,
   `chromewebstore.google.com`, and the Edge add-ons store are not matched
   either. `action-runner.ts:60-66` repeats the same patterns with
   different wording. I asserted neither way.
3. **Multi-token `autocomplete` values are not treated as sensitive.** The
   worker's rule compares the whole `autocomplete` value, so `billing
   cc-number` and `section-a new-password` pass. w1-recorder-hygiene
   already raised this (its item 3). I left it unasserted, since a test
   would either lock the gap in or fail on it.
4. **`runtimeConfirmationForActionResult` ignores `result.status`.** A
   failed `type` result still yields a confirmation that carries the value.
   The function's comment implies the caller passes only succeeded
   actions. I did not verify the caller.
5. **Mixed line endings in `.gitignore`.** The working copy already mixes
   CRLF and LF, and my line is LF. With `core.autocrlf=true`, git
   normalizes the file on commit.
