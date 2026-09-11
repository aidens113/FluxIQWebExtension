# Report: w1-content-harness

Worker `w1-content-harness`, Phase 1.6a step 1 (T2 content-script harness).
Brief: `briefs/wave-1.md`, section `### Brief: w1-content-harness`.

## Outcome

Done. `pnpm --filter @fluxiq-web-extension/extension test:content` passes
headless: 31 tests in 3 spec files, 4.9 s. The extension build output is
byte-identical before and after the build-script change, compared on one
source snapshot. The structure audit shows no finding for any file I added or
changed. I departed from the brief's layout in three places (spec folder, wire
types, a skip guard); each is forced by the audit or by a file I may not
touch, and each is explained below.

## What changed and why

### `apps/extension/scripts/build-extension.mjs` (export a build function, output unchanged)

- A keyed `extensionEntries` table replaces the inline entry array. The keys
  are `background`, `content`, `popup`, `sidepanel`, in the same order.
- `export async function bundleExtensionEntry(name, outputDir, { logLevel })`
  now holds the esbuild settings (bundle, browser platform, targets,
  sourcemap, legal comments, the workspace plugin), and returns the outfile.
  `bundleExtension()` calls it for every entry into `build/`. The harness
  calls it for `content` into its own directory. Only the log level can be
  overridden, so the harness cannot drift from the shipped bundle.
- The top-level build steps moved into `buildExtension()`. It runs only when
  node runs the file (`isEntryPoint()`), so importing the module never deletes
  `dist/` or rewrites `build/`. The check compares realpaths, lower-cased on
  win32, because the drive letter can be spelled either way.
- The file's CRLF line endings are kept (161 of 161 lines).

### `apps/extension/e2e/content/` (new)

| File | Exports | Role |
| --- | --- | --- |
| `bundle-env.ts` | `CONTENT_HARNESS_BUNDLE_ENV` | Name of the env var that carries the bundle path from global setup to the workers. |
| `global-setup.ts` | default `globalSetup` | Builds the content bundle once per run with `bundleExtensionEntry("content", …)` into `.harness-build/run-<pid>-<ms>/`, sets the env var, and returns a teardown that deletes the run directory. A concurrent `pnpm build` (which deletes `dist/`) or a second harness run cannot touch it. |
| `runtime-stub.ts` | `installRuntimeStub`, type `HarnessDelivery` | A self-contained `chrome.runtime` stub, serialized into the page. It records every `sendMessage` as a JSON copy. `deliver(message)` follows Chrome's reply rules: the first `sendResponse` wins, a listener returning `true` keeps the channel open, and otherwise the result is `responded: false`. |
| `harness.ts` | `openContentHarness`, types | Starts the Scenario Lab in-process (`startScenarioLab`, imported from source as the lab's own e2e does), seeded by default with the scenario's own seed. Installs one init script (stub, then bundle) that runs at document start in every frame, like the manifest's `document_start` / `all_frames`. Opens the fixture and requires `fluxiq.contentReady`. Exposes `runAction(command)`, `capture()`, `deliver(message)`, `setRecording(on, settings)`, `messages()`, `recordedEvents(kind?)`, `finalState()` (the lab oracle), and `close()`. |
| `fixture.ts` | `test` (and re-exports `expect`) | An `openHarness(scenarioId, options?)` factory fixture that closes every lab it opened. An auto fixture skips the test when the bundle env var is unset, before any browser starts (see Open questions 1). |
| `index.ts` | barrel | What specs import. |
| `tests/resolve-target.spec.ts` | none | 13 tests (8 on `ambiguous-targets`, 5 on `long-document`). |
| `tests/actions.spec.ts` | none | 14 tests on `basic-form`. |
| `tests/recorder-trust.spec.ts` | none | 4 tests on `basic-form`. |

`runAction` sends exactly what `runtime/action-runner.ts` sends for an action
with no frame id: `{ type: "executeAction", action, topFrameOnly: true }`.
Command and reply types come from `src/shared/protocol.ts`, which is the
background's wire contract. The wire names `fluxiq.contentReady` and
`fluxiq.contentEvent` are written out on purpose, so that renaming them in
`messages.ts` would break the harness instead of passing silently.

**Fidelity limits, also stated in `harness.ts`:**
- The bundle runs in the page's main world, not an isolated world.
- There is no background worker, tab routing, or frame routing.
- Messages are read from, and delivered to, the top frame only.

### The specs: what they pin (today's behaviour)

**`resolve-target.spec.ts`** covers all four strategies on both fixtures,
plus the fallbacks:
- **Selector.** On `ambiguous-targets`, the ambiguous `button` resolves to
  the first match (primary), and the oracle records `{selected:"primary"}`.
  On `long-document`, a selector below the fold resolves, the click scrolls
  it into view, and the result is "Reached".
- **Coordinates.** A viewport point hits the secondary button. A point below
  the fold fails with `No target resolved from coordinates X,Y.`
- **Visual target.** The centre of `bounds` resolves.
  - `documentBounds` are de-scrolled: they fail at scroll 0 and resolve once
    the target is in view.
  - Stale `bounds` win over correct `documentBounds`: the click lands on
    another element, still reports `succeeded`, and the oracle shows
    `reached:false`.
- **Fingerprint.**
  - Matching `visibleText` takes the first match.
  - A `data-testid` match is exact.
  - A name carried only by a `<label>` does not resolve
    (`No target resolved from element fingerprint.`).
  - A `data-testid` match below the fold resolves.
- **Order and fallbacks.**
  - A selector hit beats coordinates; a selector miss falls through to them.
  - With no strategy supplied, the focused element is used.
  - When every strategy misses, the failure message lists each miss in order:
    `No target resolved from selector [data-testid="missing"], coordinates -10,-10, visual target -95,-95, element fingerprint.`

**`actions.spec.ts`** runs each of the ten content-script action types once,
checking the reply and the effect on the page. It adds the `captureSnapshot`
request, and asserts that `web.browser.navigate` is rejected by the content
script, since the background handles it.
- `type`: the value is set, and one untrusted `input` and one untrusted
  `change` fire.
- `clear`: the field is emptied.
- `select`: `selectedValue` is reported. A missing option is still
  `succeeded`, and the select's value becomes `""`.
- `click`: submits the form; the oracle shows
  `{submitted:true, submissionCount:1, values:{name:"Ada",plan:"team",notes:""}}`.
- `scroll`: `scrollY` is 60 at an 800x200 viewport.
- `keypress`: an untrusted Enter does not submit the form. As a control, a
  real Enter in the same field does.
- `wait_for_selector` and `wait_for_text`: succeed when an element appears
  150 ms later. A selector timeout reports `failed`, not `timed_out`.
- `extract`: returns text, an attribute (`aria-live` gives `polite`), and a
  field's value.

**`recorder-trust.spec.ts`:**
- These events are not recorded: `input`/`change` dispatched by a page
  script, and those from Playwright's `selectOption`. As a control, one real
  key press in the same session is recorded as `dom.keydown` then `dom.input`.
- Real typing of "Ada" is recorded as 3 `dom.keydown` events (`A`, `d`, `a`)
  and one `dom.input` with `inputValue: "Ada"`.
- A real ArrowDown on the select is recorded as one `dom.change` with the
  value `team`.
- Replayed `type`, `clear`, and `select` actions record nothing.

Stopping recording flushes the debounced `dom.input`, so these assertions do
not depend on timers. This covers the `dom-events.ts` half of the
recorder-hygiene regression specs the supervisor planned. The runtime
confirmation half lives in `background/` and is out of the harness's reach.

### `apps/extension/e2e/playwright.content.config.ts` (new)

- `testDir: ./content/tests`, `globalSetup: ./content/global-setup.ts`.
- Headless, with `browserName: "chromium"` and `channel: "chromium"`.
- `fullyParallel`; `retries` only on CI.
- Artifacts and the HTML report go under `test-results/content/`, so they
  never clobber the extension e2e report.

### `apps/extension/package.json` (the `test:content` script only)

`"test:content": "pnpm --filter @fluxiq-web-extension/test-contracts build && playwright test -c e2e/playwright.content.config.ts"`.
Scenario Lab source imports `assertWebScenario` from the `test-contracts`
build output at runtime, so that package is built first. This matches the
Scenario Lab's own `test:e2e`. No Scenario Lab build is needed.

### `.gitignore` (one line)

`apps/extension/e2e/content/.harness-build/`. The
`domain/.test-build-scratch/` line above it in the diff is not mine; it was
already modified when I started.

### Deviations from the brief

1. **Specs are in `e2e/content/tests/`, not directly in `e2e/content/`.**
   The audit's `test-placement` rule fails any `*.spec.ts` whose directory
   is not named `tests` or `e2e`. `e2e/content/*.spec.ts` would have been a
   new finding.
2. **Types come from `src/shared/protocol.ts`, not `src/content/types.ts`.**
   The audit's imports rule treats `src/content/index.ts` as that
   directory's barrel. It counts `import type` too, so importing
   `src/content/types` from outside would be a new finding. `src/shared/`
   has no barrel.
3. **An auto skip guard, not in the brief.** It exists because the existing
   config collects these specs (Open questions 1).

## Commands run and observed results

All run from `F:\!FluxIQWebExtension` or `apps/extension`. The logs are in my
scratchpad.

- **`node scripts/structure-audit.mjs`, before any edit.** Two `FAIL
  [working-docs]` lines, both for docs I don't own, and `structure-audit: 1
  baseline entries can be lowered.`
- **Byte identity: scratch A/B.** Both scripts were run back to back, with
  output redirected to scratch, on the same source snapshot. The source
  hashes were identical at start and end: `src` `4a09d5cf…`, `domain/src`
  `04bb3b17…`, manifests `14af9477…`. Pristine and new both produced 59
  files with tree `50f89d4520d63e2699e32270def6511211e707588c087ce7bec1127cef9e31f8`.
  Result: `scratch A/B: IDENTICAL`.
- **Byte identity: real location.** `cd apps/extension && node
  scripts/build-extension.mjs` with the pristine script (sha256
  `8627591771392bc5802d24cd621e1a253a17bfc2669813a3df4c81b65fdc24c6`), then
  with the new one (`c0af591c6c1c7d3c22c72513974dab37ed2422883a01281b8621eb3eb9f60649`):

  | | `build/` | `dist/` |
  | --- | --- | --- |
  | Pristine script | 8 files, tree `08ec501883929f6436ed057f071adb9bf434ffec11972a96bf328ffb38d832f1` | 51 files, tree `2fba589720816fd914b59f6222a8417066256ee79ac18d1e3a81177fbb1c18c6` |
  | New script | identical tree | identical tree |

  Result: `real before/after: IDENTICAL`. A tree hash is the sha256 of the
  sorted per-file `sha256sum` listing.
- **The first A/B attempt differed.** Only `background/index.js` and its map
  changed, because `apps/extension/src` changed between the two runs
  (`2a60ede6…` to `4a09d5cf…`) from a parallel worker's edit. Rerunning on
  one snapshot gave identical output, as above.
- **`pnpm --filter @fluxiq-web-extension/extension test:content`, final run
  after all edits.** `Running 31 tests using 6 workers` / `31 passed
  (4.9s)`, exit 0, 8 s wall clock including the `test-contracts` build. The
  first run also passed: `31 passed (5.9s)`.
- **Stability.** `npx playwright test -c e2e/playwright.content.config.ts
  --repeat-each=3 --reporter=dot` gave `93 passed (15.0s)`. It ran
  concurrently with `pnpm --filter @fluxiq-web-extension/extension build`,
  which exited 0 (log shows `tsc -p tsconfig.json --noEmit && node
  scripts/build-extension.mjs` and the esbuild output).
- **Guard under the existing config.** `npx playwright test -c
  e2e/playwright.config.ts --list` lists 31 of `Total: 39 tests in 7 files`
  as mine. Running only my files there (`--reporter=list --output
  <scratch>`) gave `31 skipped`, exit 0.
- **Type-check.** A scratch `tsc -p <scratch tsconfig>` extending
  `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, Bundler resolution) over the config, barrel,
  global setup, and 3 specs exited 0. That was after I fixed its one error,
  a missing guard on the stub lookup in `harness.ts`.
- **Structure audit with my files visible.** The audit reads `git ls-files`,
  and my new files are untracked. I made them visible through a scratch copy
  of the index (`GIT_INDEX_FILE=<scratch> git add -N …`); the real index was
  not touched. The output was byte-identical to the run without them, and no
  line names `e2e/content`, `playwright.content`, or `build-extension`. It
  ended `structure-audit: passed (27 warning(s), 19 baselined)`.
- **"Can be lowered" line, for the supervisor:** `structure-audit: 1
  baseline entries can be lowered. Run "pnpm structure:baseline" to record
  the improvement.` It was present before my edits too. I did not run
  `pnpm structure:baseline`.
- **`pnpm test` (extension smoke):** `Extension smoke test passed.`
- **Cleanup after the run.** `.harness-build/` is empty after teardown.
  `git check-ignore -v` gives `.gitignore:25:apps/extension/e2e/content/.harness-build/`.

## Not verified

- **Real extension context.** Isolated world, background routing, and
  iframe delivery are outside the harness by design.
- **Firefox, headed mode, and CI.** None were run.
- **ArrowDown on non-Windows.** On a closed `<select>`, ArrowDown changes
  the value on Windows (observed) and on Linux. On macOS it opens the
  popup, so that `recorder-trust` test would fail there.
- **Structure audit on the real index.** I checked it through a scratch
  index. Run `node scripts/structure-audit.mjs` after staging to confirm.
- **Root `pnpm check`.** Not run. The extension's `tsc` ran as part of
  `build`. `e2e/` is outside the extension tsconfig, so `check` would not
  type-check these files anyway.
- **Concurrent-build isolation, exercised only briefly.** The concurrent
  build took about 2 s against a 16-second run. The real guarantee is
  structural: the harness never reads `build/` or `dist/`.
- **Cleanup after a killed run.** Teardown would not run, so the run
  directory would be left behind; it is ignored and harmless.

## Open questions or contradictions found

1. **The existing `e2e/playwright.config.ts` collects these specs.** Its
   `testDir` is `"."`, and it lists 31 of its 39 tests from
   `content/tests/`. The guard makes them skip there, so `test:e2e` output
   will now report `31 skipped`. Suggested fix for the supervisor, who owns
   that file: add `testIgnore: ["content/**"]`. The guard can stay as a
   backstop.
2. **Contradiction with `audit-actions.md`.** The audit says a select with
   no matching option "silently leaves the select unchanged". In Chromium I
   observed the select's value becoming `""` (no option selected), while the
   reply is still `succeeded`. The spec asserts what I observed.
3. **Parallel fixture workers can break harness runs.** Importing the
   Scenario Lab from source means a broken scenario file breaks a run,
   because the registry imports every scenario. The Scenario Lab's own e2e
   has the same exposure.
4. **Parallel `test-contracts` edits can fail `test:content`.** It builds
   `test-contracts` first, so another worker's in-progress edits there can
   fail that step. Rerun once.
5. **Two harnesses in one test share a page.** A second `openHarness` in the
   same test reuses the page's init script and navigates it. `messages()`
   reads only the current document.
