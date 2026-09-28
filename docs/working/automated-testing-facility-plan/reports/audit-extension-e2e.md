# Audit: Phase 2 (real extension fixture) and browser/toolchain pinning

Audit date: 2026-09-28. Read-only: no source file was changed.
Subject: `docs/working/automated-testing-facility-plan.md` line 168 (Execution Log,
Phase 2) and the `Current State` claims at lines 14-148.

Verdict vocabulary used below: **claim true**, **claim false**,
**claim true but narrower than written**, **could not verify**.

---

## Summary

Phase 2's row is, on the whole, **still accurate**. Every one of the six behaviours
it names still has a live spec, the suite still builds and loads the real production
MV3 artifact, and the toolchain pin has never drifted. The row is also now
*understated*: the same config runs 12 tests, not 8.

Three real problems were found, none of them contradicting the row:

1. The Firefox lane added after Phase 2 (`playwright.content.firefox.config.ts`)
   **cannot launch on this machine** — Playwright 1.51.1 pins Firefox revision 1475
   and only `firefox-1538` is installed.
2. **Only the Chrome/Edge side panel is exercised by the extension e2e layer.** The
   Firefox popup build is produced but never loaded, so the "keep side-panel and
   popup aligned" contract in `AGENTS.md` has no automated enforcement.
3. The loopback guard's Playwright half almost certainly **does not see the MV3
   service worker's own traffic**, which is where the gateway WebSocket lives.

---

## 1. Toolchain pin: what is actually pinned today

**Claim true. No drift.**

| Thing | Pinned value | Evidence |
| --- | --- | --- |
| `@playwright/test` (extension) | `1.51.1`, exact, no range | `apps/extension/package.json:21` |
| Lockfile resolution | `1.51.1` | `pnpm-lock.yaml:321`, `:446`; `playwright-core@1.51.1` at `:351`, `:498` |
| Installed on disk | `1.51.1` | `apps/extension/node_modules/@playwright/test/package.json` `"version": "1.51.1"` |
| Chromium | rev **1161**, **134.0.6998.35** | `node_modules/.pnpm/playwright-core@1.51.1/node_modules/playwright-core/browsers.json:5-8` |
| Firefox (same Playwright) | rev **1475**, **135.0** | same file, `:29-32` |

Three workspace importers pin the identical exact version — extension
(`pnpm-lock.yaml:30-32` region, specifier at `:31`), `apps/scenario-lab`
(`pnpm-lock.yaml:52-54`), and the test-runner package (`pnpm-lock.yaml:155-157`) —
so there is no split-version hazard.

**Did it drift?** No. `git log -S "1.51.1" -- apps/extension/package.json` returns
exactly one commit:

```
5e9d97e7 testing facility that can automatically operate the fluxiq and extension
         on demo website scenarios
```

That is the commit that introduced the facility. The version has never been changed
since, so "Pinned Chromium 134 / Playwright 1.51.1" is as true today as when written.

**How the pin reaches a run.** Both the root config (`e2e/playwright.config.ts:18`,
`channel: "chromium"`) and the content config (`e2e/playwright.content.config.ts:27`)
select Playwright's own downloaded full Chromium rather than a system Chrome. The
extension fixture does not set a channel at all — it calls
`chromium.launchPersistentContext` (`e2e/fixtures/extension-context.ts:62`), which
also uses the bundled build. So the pin is the lockfile's, in every lane.

**Caveat — the pin is by lockfile only, never asserted.** Nothing in the e2e layer
reads or asserts the browser version. `install-and-content.spec.ts` asserts the
*extension's* manifest and id (`:8-12`) but never the browser's. A machine with a
different `ms-playwright` cache would run a different Chromium and no test would
say so. The Phase 3 row's "Chrome 134 was recorded" belongs to the test-runner's
evidence manifest, not to this layer.

**Verified on this machine.** `C:\Users\mrjoh\AppData\Local\ms-playwright` contains
`chromium-1161` (the pinned one, present) alongside `chromium-1234`,
`chromium_headless_shell-1161`, `chromium_headless_shell-1234`, `firefox-1538`,
`ffmpeg-1011`, `winldd-1007`.

**Finding (new, not a plan claim): the Firefox lane cannot run here.**
`playwright.content.firefox.config.ts:26` asks for `browserName: "firefox"`, which
under Playwright 1.51.1 means revision **1475**. Only `firefox-1538` is installed.
The config anticipates this — its comment at `:7-9` and the
`FLUXIQ_FIREFOX_EXECUTABLE` escape hatch at `:13` and `:35` exist precisely for
"a Playwright Firefox build that is present on the machine but not the exact
revision this Playwright version downloads". So the Gecko comparison lane is
**inoperable unless that environment variable is set**, and nothing fails loudly to
say so; Playwright will simply report a missing browser at launch.

---

## 2. Do the six claimed behaviours still have specs?

**Claim true for all six.** Every behaviour named in the row maps to a live test.
Verified not only by reading but by collecting the suite (see Commands below).

| Claim in the row | Spec | Verdict |
| --- | --- | --- |
| install / UI | `e2e/install-and-content.spec.ts:4` "loads the current MV3 artifact and its extension page" — asserts the 32-char extension id (`:8`), artifact SHA-256 (`:9`), `manifest_version === 3` (`:10`), name/version agreement between disk manifest and `chrome.runtime.getManifest()` (`:11-12`), the side-panel URL (`:13`) and the visible `FluxIQ Recorder` heading (`:14`) | present |
| content injection | `e2e/install-and-content.spec.ts:17` "injects the content script into a loopback scenario page" — real `chrome.tabs.sendMessage` ping, expects `{ ok: true, active: true, version: 2 }` (`:26`) | present |
| production action dispatch | `e2e/action.spec.ts:4` "executes actions through the real content-script message path" — dispatches `web.dom.capture_snapshot` (`:16-19`), `web.dom.type` (`:26-31`), `web.dom.click` (`:34-38`) through `chrome.tabs.sendMessage` with `type: "executeAction"` (`:47-51`), then asserts the page's own DOM changed (`:40`) | present |
| MV3 restart | `e2e/resilience-and-isolation.spec.ts:4` "restarts the MV3 worker and answers a production readiness message" — driven by `restartServiceWorker` (`e2e/fixtures/extension-context.ts:115-145`), which closes the real CDP `service_worker` target (`:123`) and re-wakes it with a production `fluxiq.getStatus` message (`:128`) | present |
| isolation | `e2e/resilience-and-isolation.spec.ts:12` "uses a fresh profile and removes it after shutdown" — writes `chrome.storage.local` in session one (`:13`), proves session two cannot see it (`:18-19`), proves the profile directory is gone (`:23`) | present |
| enforced loopback-only networking | `e2e/network-policy.spec.ts:4`, `:10`, `:16` (three tests), plus the per-session enforcement at `e2e/fixtures/extension-context.ts:44` | present |

**"8/8" is now 12.** The six behaviours are covered by exactly 8 test cases
(2 + 1 + 2 + 3), which is where the row's figure came from and it still holds. Since
then `e2e/runtime/tests/navigate.spec.ts` added 4 more under the same config
(`:91`, `:117`, `:140`, `:159`), covering `web.browser.navigate` in the real browser.
Collected total today: **12 tests in 5 files**. The row's "8/8" should be read as a
historical count, not a current one.

---

## 3. Does the suite still build and load the real production artifact?

**Claim true.** Nothing is mocked: a real unpacked MV3 extension is loaded into a
real Chromium.

- **Build step:** `apps/extension/package.json:12` —
  `"test:e2e": "pnpm test:e2e:build && playwright test -c e2e/playwright.config.ts"`,
  where `test:e2e:build` (`:11`) is `pnpm build`, which is
  `"tsc -p tsconfig.json --noEmit && node scripts/build-extension.mjs"` (`:7`).
- **Artifact path:** `apps/extension/dist/e2e-chromium`, the fixture's default at
  `e2e/fixtures/extension-context.ts:10`, overridable by
  `FLUXIQ_E2E_EXTENSION_PATH` (`:54`).
- **The script does produce it:** `scripts/build-extension.mjs:302` —
  `await buildTarget("e2e-chromium", "manifest.e2e.json");` — alongside `chrome`
  (`:300`) and `firefox` (`:301`). `buildTarget` (`:68-77`) copies the real bundles,
  rewrites module imports, copies popup and side-panel static files, ensures icons,
  and writes the chosen manifest as `manifest.json`.
- **The bundles are the shipped ones.** The five entries at
  `scripts/build-extension.mjs:57-63` are `background`, `content`, `page-world`,
  `popup`, `sidepanel`, built from `src/`. The e2e target gets the same `build/`
  output as the Chrome target; only the manifest differs.
- **Confirmed on disk:** `apps/extension/dist/` holds `chrome`, `e2e-chromium`,
  `firefox`; `dist/e2e-chromium/` holds `background`, `content`, `icons`,
  `manifest.json`, `page-world`, `popup`, `sidepanel`.
- **It is loaded as a browser extension, not stubbed:**
  `e2e/fixtures/extension-context.ts:68-75` passes
  `--disable-extensions-except=<artifact>` and `--load-extension=<artifact>`, then
  waits for a real MV3 service worker (`:78`, `:147-150`) and derives the id from its
  `chrome-extension://` URL (`:152-158`).
- **The artifact is fingerprinted.** `hashDirectory` (`:181-190`) SHA-256s every file
  in the artifact and the hash is attached to the test report (`:36-39`).

**Two honest limits.**

- **The fixture detects a *missing* artifact, never a *stale* one.**
  `readExtensionManifest` throws `environment.missing` only on `ENOENT`
  (`e2e/fixtures/extension-context.ts:166-172`). Invoking
  `playwright test -c e2e/playwright.config.ts` directly — which is exactly what the
  `--list` and any ad-hoc run do — happily loads whatever `dist/e2e-chromium` was
  left from a previous build. Freshness is guaranteed by the *script chain*, not by
  the fixture. CI does use the chaining script
  (`.github/workflows/testing-facility.yml:134`, `:137`), so CI is safe.
- **`test:e2e` is not part of `pnpm test`.** Root `pnpm test` is `pnpm -r test`
  (`package.json:62`) and the extension's `test` is
  `smoke-test.mjs && test-extension.mjs` (`apps/extension/package.json:9`). The
  Phase 2 suite therefore runs only from the explicit `test:e2e` script or from CI's
  `chromium-smoke` job. A local `pnpm check && pnpm test && pnpm build` will not
  exercise any of it.

---

## 4. Is loopback-only networking still enforced?

**Claim true but narrower than written.** There are two independent enforcement
layers and both are live.

**Layer one — the browser itself** (`e2e/fixtures/extension-context.ts:74`):

```
"--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1"
```

with `"--disable-background-networking"` at `:73`.

**Layer two — the Playwright guard**
(`apps/scenario-lab/e2e/network-policy.ts`, re-exported one line deep through
`apps/extension/e2e/fixtures/network-policy.ts:1`):

```ts
// apps/scenario-lab/e2e/network-policy.ts:3-11
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const LOCAL_SCHEMES = new Set(["chrome-extension:", "data:", "about:"]);

export function isDeterministicBrowserUrlAllowed(value: string): boolean {
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (LOCAL_SCHEMES.has(url.protocol)) return true;
  return (url.protocol === "http:" || url.protocol === "ws:") && LOOPBACK_HOSTS.has(url.hostname);
}
```

```ts
// apps/scenario-lab/e2e/network-policy.ts:25-29
await context.route("**/*", async (route: Route) => {
  const url = route.request().url();
  if (isDeterministicBrowserUrlAllowed(url)) await route.continue();
  else { unexpected.add(url); await route.abort("blockedbyclient"); }
});
```

```ts
// apps/scenario-lab/e2e/network-policy.ts:32-34
assertClean() {
  if (unexpected.size > 0) throw new Error(`network.unexpected: deterministic browser attempted non-loopback destinations:\n${[...unexpected].sort().join("\n")}`);
}
```

The guard is installed on every extension session
(`e2e/fixtures/extension-context.ts:77`) and `assertClean()` is called in the
fixture's teardown and re-thrown after cleanup
(`e2e/fixtures/extension-context.ts:43-46`), so a leak fails the test that caused it
rather than being swallowed. `network-policy.spec.ts:16-21` proves the abort path
end to end against a real `https://example.invalid/blocked` navigation.

**What it would not catch.**

- **The MV3 service worker's own traffic.** `context.route` and the
  `context.on("request")` observer (`network-policy.ts:24`) are page-scoped
  interception. Playwright's request interception has historically not covered
  requests issued by a service worker, and an MV3 background worker is exactly that.
  This matters more than it sounds: the extension's gateway WebSocket is opened from
  the background worker, so the one long-lived connection the product actually makes
  is the one least likely to be seen here. It is not unguarded — the host-resolver
  rule at `extension-context.ts:74` is browser-wide and does cover it — but the
  *assertion* half would stay silent. **Could not verify empirically** (read-only
  audit; confirming it needs a run that makes the worker fetch).
- **Raw IP literals.** `--host-resolver-rules=MAP * ~NOTFOUND` only intercepts name
  *resolution*. `http://93.184.216.34/` needs no resolution and is unaffected by it.
  For a page-context request the Playwright guard still aborts it (the hostname is
  not in `LOOPBACK_HOSTS`), but for a service-worker request neither layer would.
- **Anything before the guard is installed.** `installDeterministicNetworkGuard` runs
  at `extension-context.ts:77`, after `launchPersistentContext` at `:62`. Requests
  made during browser and extension startup are outside it.
- **WebSocket frames, and WebSockets outside a page.** WebSockets are only
  *observed*, never blocked — `page.on("websocket", ...)` at `network-policy.ts:21`
  records the URL. A `ws://127.0.0.1:...` socket is allowed by policy and its
  payloads are never inspected, so nothing here would notice recorded page data or a
  pairing token crossing that socket.
- **Loopback *ports*.** Any port on 127.0.0.1 or localhost is allowed. A test that
  accidentally talks to a developer's real local FluxIQ panel instead of an isolated
  fixture passes cleanly.
- **Non-loopback IPv6 and unusual loopback spellings.** `127.0.0.2` (still loopback
  on most stacks) is rejected; `[::1]` and `::1` are allowed. The set is literal, not
  range-based — safe in the conservative direction.

---

## 5. Chrome/Edge side panel vs Firefox popup

**Claim: not made by Phase 2's row, but the repository contract is not met. Only the
side panel is covered.**

`AGENTS.md` ("Engineering Structure And Modularity") requires: "Keep Chrome/Edge
side-panel and Firefox popup behavior aligned where the product contract is shared,
respecting manifest and browser API differences." Both surfaces exist and are built:

- `manifest.chrome.json:13-15` declares `side_panel.default_path`;
  `manifest.e2e.json:13-15` declares the same.
- `manifest.firefox.json:8` declares `action.default_popup: "popup/index.html"`, and
  `:10-13` uses `background.scripts` rather than a `service_worker`.
- Both `popup` and `sidepanel` are real build entries
  (`scripts/build-extension.mjs:61-62`), both static trees are copied into every
  target (`:73-74`), and `dist/firefox/` exists.
- Both HTML files carry the same `FluxIQ Recorder` heading
  (`apps/extension/src/popup/index.html:14`, `apps/extension/src/sidepanel/index.html:14`).

**But the e2e layer opens only the side panel.** A repository-wide grep of
`apps/extension/e2e/**/*.ts` for `popup|firefox|sidepanel|side_panel` returns:

- `e2e/fixtures/extension-context.ts:81` —
  `await extensionPage.goto("chrome-extension://${id}/sidepanel/index.html")`
- `e2e/install-and-content.spec.ts:13` — asserts that same side-panel URL
- `e2e/content/tests/dialog-refusal.spec.ts:24`, `:129` — the word "popup" used for a
  *page's* coupon dialog, unrelated to the extension popup
- the three Firefox/baseline config files, which configure the **content-script**
  harness only

There is **no test anywhere in the e2e tree that opens `popup/index.html`**, and
none that loads the Firefox build. That is structural rather than an oversight:
Playwright cannot load an unpacked extension into Firefox, and
`playwright.content.config.ts:1-3` states the content harness runs "with no extension
loaded". So the Gecko lane
(`playwright.content.firefox.config.ts`) tests the content-script bundle in Firefox,
never the popup UI or the Firefox background script.

Net: `dist/firefox` is built and type-checked but never loaded by any automated test,
and the side-panel/popup alignment contract is enforced by nothing mechanical.

---

## 6. Rot check

**Clean on the usual markers; two softer notes.**

- **Skipped, `.only`, `fixme`, `fail`:** none.
  `grep -rn "\.only(\|test\.skip\|test\.fixme\|test\.fail(\|describe\.skip\|it\.only" --include=*.ts apps/extension/e2e`
  returned **no matches**. `forbidOnly: Boolean(process.env.CI)` is set in all four
  configs (`playwright.config.ts:8`, `playwright.content.config.ts:19`,
  `playwright.content.chromium-baseline.config.ts:15`,
  `playwright.content.firefox.config.ts:19`).
- **TODO / FIXME / XXX / HACK:** none.
  `grep -rn "TODO\|FIXME\|XXX\|HACK" --include=*.ts apps/extension/e2e` returned
  **no matches**.
- **Dangling fixture and route references:** none found. Every external target the
  specs name still exists:
  - `startScenarioLab` from `../../../../scenario-lab/src/server.js`
    (`e2e/runtime/tests/navigate.spec.ts:27`) → exported at
    `apps/scenario-lab/src/server.ts:26`, with `RunningScenarioLab` at `:18`.
  - `/scenarios/everything-store/` (`navigate.spec.ts:33`) → declared at
    `apps/scenario-lab/src/scenarios/everything-store/manifest.ts:27` and
    `scenario.ts:23`.
  - `/scenarios/everything-store/s?k=...` (`navigate.spec.ts:34`) → the `s` subpath
    is routed at
    `apps/scenario-lab/src/scenarios/everything-store/route.ts:76`.
  - The asserted title `"Brightaisle.com. Spend less. Smile more."`
    (`navigate.spec.ts:132`) → still produced at
    `apps/scenario-lab/src/scenarios/everything-store/pages/home.ts:36`.
  - `src/runtime` imported by `e2e/runtime/harness-entry.ts:17` → exists, with
    `index.ts` and `command-router.ts` present.
  - `bundleExtensionEntry` imported by `e2e/content/global-setup.ts:15` → exported at
    `scripts/build-extension.mjs:97`.
  - `FluxIQ Recorder` heading asserted at `install-and-content.spec.ts:14` → present
    at `apps/extension/src/sidepanel/index.html:14`.
- **Stale committed artifacts:** none. `git ls-files apps/extension/e2e` lists 72
  files, all source; the `test-results/` trees present on disk are untracked and
  covered by `.gitignore:18`, and `e2e/content/.harness-build/` by `.gitignore:25`.
- **Soft note — a comment pinned to a Playwright version.**
  `e2e/fixtures/extension-context.ts:137-140` reasons explicitly about "Playwright
  1.51" worker-wrapper behaviour and falls back three ways (`:141-143`). Correct
  today; it is the one place that would need re-reading on a Playwright upgrade.
- **Soft note — a fixture whose first response may not be the one assumed.**
  `navigate.spec.ts:140` navigates to `/s?k=wireless+earbuds`, but
  `everything-store/route.ts:49` serves a *soft check* page on a session's first
  search. The spec asserts only `status: "succeeded"`, the requested URL, and a
  truthy title (`:150-153`), so it passes either way — but it is not asserting the
  results page it reads as if it were.

---

## Claim-by-claim verdict

| Plan claim | Verdict |
| --- | --- |
| "Pinned Chromium 134 / Playwright 1.51.1" (line 168) | **claim true** — 1.51.1 exact in three importers, Chromium 134.0.6998.35 rev 1161, never changed since `5e9d97e7` |
| "loaded the freshly built E2E artifact" (line 168) | **claim true** via `test:e2e` → `test:e2e:build` → `pnpm build` → `dist/e2e-chromium`; the fixture itself detects only a *missing* artifact, not a stale one |
| "install/UI ... pass" | **claim true** — `install-and-content.spec.ts:4` |
| "content injection ... pass" | **claim true** — `install-and-content.spec.ts:17` |
| "production action dispatch ... pass" | **claim true** — `action.spec.ts:4` |
| "MV3 restart ... pass" | **claim true** — `resilience-and-isolation.spec.ts:4` |
| "isolation ... pass" | **claim true** — `resilience-and-isolation.spec.ts:12` |
| "enforced loopback-only networking ... pass" | **claim true but narrower than written** — enforced in two layers; the assertion half is page-scoped and likely blind to MV3 service-worker traffic |
| "8/8 on Windows" | **claim true as a historical count**; the same config now collects **12 tests in 5 files** |
| Side-panel / popup alignment (`AGENTS.md` contract) | **claim false as automation** — only the side panel is opened by any e2e test; the Firefox build is never loaded |
| Phase 2 suite passes today on this machine | **could not verify** — not run; it is a headed browser suite and the brief scoped this audit to read-only |

---

## Commands run and observed results

1. `git log --oneline -S "1.51.1" -- apps/extension/package.json`
   → exactly one line: `5e9d97e7 testing facility that can automatically operate the
   fluxiq and extension on demo website scenarios`. No drift.
2. `grep -n "playwright" pnpm-lock.yaml`
   → `'@playwright/test@1.51.1'` at 321 and 446; `playwright-core@1.51.1` at 351 and
   498; `playwright@1.51.1` at 356 and 500; specifier `1.51.1` at three importers
   (30/52/155 regions).
3. `grep -n -A3 '"name": "chromium"' .../playwright-core/browsers.json`
   → `"revision": "1161"`, `"browserVersion": "134.0.6998.35"`. Firefox in the same
   file: rev `1475`, `135.0`.
4. `ls C:/Users/mrjoh/AppData/Local/ms-playwright`
   → `chromium-1161 chromium-1234 chromium_headless_shell-1161
   chromium_headless_shell-1234 ffmpeg-1011 firefox-1538 winldd-1007`.
   Pinned Chromium present; pinned Firefox (1475) **absent**.
5. `node .../@playwright/test/cli test -c e2e/playwright.config.ts --list`
   → collected without error:
   ```
   Total: 12 tests in 5 files
   ```
   with `action.spec.ts:4`, `install-and-content.spec.ts:4` and `:17`,
   `network-policy.spec.ts:4`/`:10`/`:16`, `resilience-and-isolation.spec.ts:4`/`:12`,
   `runtime\tests\navigate.spec.ts:91`/`:117`/`:140`/`:159`.
   This also proves every spec's imports resolve and typecheck under Playwright's
   transform today.
6. `grep -rn "\.only(\|test\.skip\|test\.fixme\|test\.fail(\|describe\.skip\|it\.only" --include=*.ts apps/extension/e2e`
   → no output.
7. `grep -rn "TODO\|FIXME\|XXX\|HACK" --include=*.ts apps/extension/e2e`
   → no output.
8. `grep -n "buildTarget\|e2e-chromium" apps/extension/scripts/build-extension.mjs`
   → `:300` chrome, `:301` firefox, `:302` e2e-chromium.
9. `ls apps/extension/dist && ls apps/extension/dist/e2e-chromium`
   → `chrome e2e-chromium firefox`; artifact holds `background content icons
   manifest.json page-world popup sidepanel`.
10. `git ls-files apps/extension/e2e` → 72 tracked source files, no build output.
11. `grep -rn "test:e2e" ...` → CI invokes it at
    `.github/workflows/testing-facility.yml:134` (Linux, under `xvfb-run`) and `:137`
    (Windows), after `playwright install chromium` at `:133`/`:136`. Root `pnpm test`
    does not (`package.json:62`, `apps/extension/package.json:9`).

## Not verified

- **The suite was not executed.** Every "pass" verdict above is about a spec
  *existing and collecting*, never about it passing today. The brief scoped this to
  read-only, and `test:e2e` launches headed browsers (`extension-context.ts:63`,
  `headless: false`), which would also contend with any live Lab run in flight.
- **Whether Playwright 1.51.1's `context.route` intercepts MV3 service-worker
  requests.** Stated above as a likely gap on the basis of how the interception is
  wired; confirming it needs a run in which the worker makes a request.
- **Whether the Firefox content lane actually fails to launch here.** Inferred from
  the revision mismatch (pinned 1475, installed 1538) plus the config's own comment;
  not reproduced.
- **Linux/CI behaviour.** Everything above was read on Windows.
- Files outside the brief's ownership — the test-runner package, evidence tooling,
  and `packages/test-contracts` — were not examined, so Phase 2 claims that depend on
  those were not re-checked here.

## Open questions / contradictions found

1. **The row's "8/8" is stale as a count.** It is right about the six behaviours and
   right about the number at the time, but the same config now collects 12. Worth
   either dating the figure or updating it, since a reader checking the plan against
   a run will see a mismatch and not know which side moved.
2. **The Firefox content lane is dead weight on this machine.** It is configured and
   committed but cannot start without `FLUXIQ_FIREFOX_EXECUTABLE`, and nothing says
   so at run time. Either install the pinned revision, document the variable as
   required, or have the config fail with a clear message.
3. **No automated enforcement of the side-panel/popup alignment contract.** The
   `AGENTS.md` rule is real and the code honours it by construction, but nothing
   would catch a divergence. Given Playwright cannot load a Firefox extension, the
   realistic options are a structural assertion over the two HTML/TS trees or an
   explicit, documented acceptance that this contract is reviewed by hand.
4. **The Phase 2 suite is outside `pnpm check` / `pnpm test` / `pnpm build`.** A
   contributor running the documented local gates never runs it. This is consistent
   with the project's "enforce standards mechanically" preference being unmet for
   this suite; CI does run it, but only on schedule or when the selector job enables
   the browser smoke.
5. **Artifact staleness is unguarded outside the script chain.** Since the fixture
   errors only on a *missing* artifact, a hand-run `playwright test` can silently
   certify a build from an hour ago. A recorded build fingerprint already exists
   (`artifactSha256`, `extension-context.ts:56`); comparing it against a freshly
   computed source hash would close this cheaply.
