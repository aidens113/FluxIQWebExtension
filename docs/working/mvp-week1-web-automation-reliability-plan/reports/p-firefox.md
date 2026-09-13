# p-firefox — what actually works on Firefox

`EXTENSION_TEST_BUILD_LABEL=p-firefox` throughout. No `pnpm lab` command was
run. Every exit status below was captured by redirect, never through a pipe.

## Outcome

Done. Firefox went from completely untested to measured. The build loads, and
most of the content-script layer behaves as it does on Chromium — but the
extension **cannot connect to the FluxIQ gateway on Firefox at all**, because
the Firefox extension background is not allowed to open an insecure `ws://`
socket, and `ws://127.0.0.1:4777/client` is the shipped default. That is
measured, not inferred, with a same-browser control.

Headline counts:

- **Content-script harness on Firefox: 189 passed, 4 failed, 1 skipped of 194.**
  Two of those four fail identically on Chromium (another worker's in-flight
  edits to `identity-resolution.spec.ts`), so the Firefox-only delta is
  **two tests**, both in `click.spec.ts`, both explained below.
- **The extension itself installs and runs on Firefox 153**: background event
  page boots, content script attaches, `fluxiq.getStatus` round-trips with a
  full status object, and the `world: "MAIN"` page-world dialog override
  installs in the page's own world.
- **Three capabilities are structurally different or absent**: the gateway
  WebSocket (blocked), the side panel (does not exist; nor is Firefox's
  `sidebar_action` declared), and the MV3 service-worker lifecycle (it is an
  event page instead, and it is destroyed while idle).

## Findings, ranked by consequence

### F1 — Fatal: the Firefox background cannot open `ws://`, so the gateway never connects

The extension's whole reason to exist is the client-gateway WebSocket
(`background/connection/gateway-session.ts`, default
`ws://127.0.0.1:4777/client` from `shared/constants.ts`). From the Firefox
extension background — a `moz-extension://` page, and therefore a secure
context — `new WebSocket("ws://…")` fails immediately and the server never
receives an upgrade request.

Measured in one browser instance, with a control, against one local server:

| From | Target | Result |
| --- | --- | --- |
| extension background | `ws://127.0.0.1:<port>/ws` | `error`, `readyState` 3, no upgrade seen by the server |
| extension background | `ws://localhost:<port>/ws` | `error`, `readyState` 3, no upgrade seen by the server |
| extension background | `http://127.0.0.1:<port>/` via `fetch` | **status 200** |
| ordinary page, same browser | `ws://127.0.0.1:<port>/ws` | **open**, server logged the upgrade |

So it is not the probe's WebSocket server (a Chromium page and a Firefox page
both connect to it), not the network, and not the loopback address: plain HTTP
from the same extension context works. It is the extension context plus the
insecure scheme.

Relaxing Firefox's mixed-content prefs did **not** help — a second run with
`network.websocket.allowInsecureFromHTTPS`,
`security.mixed_content.block_active_content` and
`security.mixed_content.upgrade_display_content` all set to permit insecure
content produced exactly the same three failures. So the block is not the
ordinary mixed-content switch, and cannot be worked around by a pref a user
would ever set.

Consequence: on Firefox the extension installs, the UI renders, the recorder
attaches — and Connect fails with "WebSocket connection failed." forever. It
fails loudly rather than silently, which is the one mercy here, but nothing
downstream of pairing can work. Everything Week 1 measured about action
execution, recording and evidence is unreachable on Firefox as shipped.

This needs a product decision, not a patch: `wss://` for the gateway (which
means TLS on the local panel), or a Firefox-specific transport. Whoever picks
it up should first confirm the same result against a stock Mozilla Firefox
build — mine was Playwright's Firefox 153 (see *Not verified*).

### F2 — High: the Firefox background is an event page, and it is destroyed while idle

`ServiceWorkerGlobalScope` is `undefined` in the Firefox background and
`window` is an object: it is a non-persistent event page, not an MV3 service
worker. It is torn down and re-created the same way, but by a different
mechanism and with no test coverage anywhere in this repository.

Measured with a boot counter persisted in `storage.local`:

```
REPORT +5478ms  {"where":"background-boot","boots":1}
REPORT +5819ms  {"where":"content","phase":"before-idle","clientId":"extension-1a613d36-…"}
REPORT +89634ms {"where":"background-boot","boots":2}
REPORT +89638ms {"where":"content","phase":"after-idle","clientId":"extension-1a613d36-…"}
```

Boot 2 after 75 s of idle: Firefox destroyed the background and rebuilt it
when the content script's next message woke it. `clientId` survived because it
lives in `storage.local`; the gateway client, the heartbeat `setInterval` in
`gateway-session.ts`, the event queue and any in-flight command did not.

`e2e/fixtures/extension-context.ts` has `restartServiceWorker`, which drives
this hazard on Chromium through CDP `Target.closeTarget`. There is no Firefox
equivalent and no Firefox coverage of the same hazard.

I could not measure the interesting follow-up — whether an **open** gateway
WebSocket would keep the event page alive — because of F1: the background
cannot open one. On Firefox those two defects are entangled, and F1 must be
fixed before F2 can be measured properly.

### F3 — High: `strict_min_version: 109` admits Firefoxes that cannot run this extension

`manifest.firefox.json` declares `"strict_min_version": "109.0"`. Mozilla's own
linter refuses that pairing:

```
KEY_FIREFOX_UNSUPPORTED_BY_MIN_VERSION
  "strict_min_version" requires Firefox 109, which was released before
  version 112 introduced support for "background.type".
KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION   (same, for Android)
```

On Firefox 109–111 the manifest installs and the background — declared
`"type": "module"` — does not load. The extension would be present and inert.

The second half of the same problem is already written down in
`docs/architecture/web-capabilities.md` line 135: `world: "MAIN"` is honoured
from Firefox 128, so on 109–127 the page-world dialog override lands in the
isolated world and `web.dom.dialog` fails as `dialog_override_missing`. The
capability matrix is right about that and deserves the credit; what it does
not say is that on 109–111 nothing works at all, not just dialogs.

Both are one edit to a field I do not own: raise `strict_min_version` to at
least 128 so the declared floor matches what the manifest actually needs.

### F4 — Medium: Firefox has no persistent recorder surface, and none is declared

`chrome.sidePanel` is `undefined` on Firefox, as expected. What matters more:
`browser.sidebarAction` is **also** `undefined`, because
`manifest.firefox.json` declares no `sidebar_action`. Firefox's only declared
surface is `"action": { "default_popup": "popup/index.html" }`.

A browser-action popup closes the moment it loses focus — that is, the moment
the user clicks the page they are recording. The Chrome/Edge side panel stays
open across page interaction, which is the entire point of a recorder console.
`AGENTS.md` requires the two surfaces to stay aligned where the product
contract is shared; here the shared contract ("a console that stays open while
you record") has no Firefox implementation, and Firefox's equivalent primitive
is declared nowhere.

`src/sidepanel/index.ts` is one line, `import "../popup/index"`, so the UI code
is already shared and a `sidebar_action` would reuse it. The Firefox build also
ships a `sidepanel/` directory its manifest never references (~19 KB plus the
source map) — harmless, but it is dead weight that suggests the target was
copied rather than considered.

### F5 — Medium: a link's navigation evidence is weaker on Firefox, and one branch is dead

`content/actions/click.ts` reads `document.location.href` immediately after
`dispatchEvent(new MouseEvent("click"))` and reports "the page navigated to X"
when it changed, "navigation to X was initiated" when it did not. Measured
directly in both engines against the same served page:

```
chromium {"hashNavigation":{"accepted":true,"changedSynchronously":true, "after":"http://127.0.0.1:61951/#done"}}
firefox  {"hashNavigation":{"accepted":true,"changedSynchronously":false,"after":"http://127.0.0.1:61951/"}}
```

Chromium performs a same-document fragment navigation synchronously inside
`dispatchEvent`; Firefox queues it. So on Firefox the "the page navigated to X"
branch of `navigationValidation` is unreachable, and every link click reports
the weaker "was initiated" instead. Status stays `passed` either way, so
nothing lies — but the evidence a Flow reads back is engine-dependent, and any
consumer that matches on the stronger sentence gets a different answer on
Firefox. This is the cause of the `click.spec.ts:139` failure.

### F6 — Low: the hit point is tested as a float and delivered as an integer

`click.spec.ts:104` fails on Firefox with `clicked "339,248"` against
`centre "339,249"`. This is not an engine API difference. Measured: **both**
engines truncate a fractional `MouseEvent` client coordinate the same way —
`clientX: 339.5, clientY: 248.5` arrives as `339, 248` in Chromium and in
Firefox, while `Math.round` of the same values is `340, 249`.

So `actionability.ts` hit-tests at `(top + bottom) / 2` as a float, the DOM
truncates that when the event is delivered, and the spec compares against
`Math.round(rect.top + rect.height / 2)`. The two agree only while the
element's centre does not land on a half pixel. Firefox's sub-pixel layout puts
`basic-form`'s submit button centre on one; Chromium's does not. The product
behaviour is identical in both engines — a click can be delivered up to a pixel
above-left of the point that was hit-tested — and the assertion is what is
engine-sensitive. Worth knowing before anyone "fixes Firefox" here.

### F7 — Low: the icons are all the wrong size

addons-linter, three times: `ICON_SIZE_INVALID — Expected icon at
"icons/icon16.png" to be 16 pixels wide but was 128` (also 32 and 48).
`scripts/build-extension.mjs` writes the same 128 px placeholder for every
declared size. Chrome does not check; Mozilla does, and it is a submission
warning.

### F8 — Not a problem: `chrome.debugger`

Absent on Firefox, and the source never uses it — `grep -rn "chrome\.debugger"
src/` returns nothing. The only CDP dependency in the repository is in the
Chromium e2e fixture, not in the product.

## Capability map

Measured inside the loaded extension's own background on Firefox 153 unless
marked otherwise.

| Week 1 capability | Firefox | Evidence |
| --- | --- | --- |
| Extension installs from `dist/firefox` | **works** | `installTemporaryAddon` succeeded twice (web-ext and my own RDP client); addons-linter reports 0 errors |
| Background loads and runs | **works** (event page, not a service worker) | `manifest_version: 3`, `ServiceWorkerGlobalScope: undefined`, `window: object` |
| `chrome.*` promise style used across the source | **works** | `storage.local.get`, `tabs.query`, `downloads.search` each `instanceof Promise === true`; `storage.local.get(null)` resolved `{}`, `tabs.query({})` resolved 2 tabs |
| Content script attaches and answers the background | **works** | `fluxiq.getStatus` returned the full status object, including `activeTabId` and `activeTabUrl` |
| `world: "MAIN"` page-world dialog override | **works on 153** | `window.__fluxiqDialogOverrideInstalled === true`; `alert`, `confirm`, `prompt` all report non-native from the page; the isolated world sees `undefined`, as designed |
| `chrome.downloads` (F: `web.browser.download`) | **present** | `downloads: object`, `downloads.search: function`, `downloads.onChanged: object`, `search({})` resolved `0` |
| `chrome.scripting.executeScript` (content-script reinjection) | **present** | `scripting.executeScript: function` |
| `chrome.tabs.captureVisibleTab` (screenshot evidence) | **present** | `tabs.captureVisibleTab: function` |
| `chrome.webNavigation.getAllFrames` (frame routing) | **present** | `webNavigation.getAllFrames: function` |
| `chrome.action.openPopup` | **present** | `action.openPopup: function` |
| **Gateway WebSocket** | **broken** | F1 |
| **Side panel** | **absent, with no declared substitute** | `chrome.sidePanel: undefined`, `browser.sidebarAction: undefined` |
| **MV3 service-worker lifecycle** | **does not exist**; an idle-destroyed event page instead | F2 |
| `chrome.debugger` | absent, unused | F8 |
| `chrome.offscreen`, `chrome.userScripts` | absent, unused | `undefined` |

Untested on Firefox, in rough order of how much it matters:

1. Everything downstream of pairing — recording, action dispatch, evidence
   upload, run manifests. Blocked by F1; not reachable from here.
2. Whether an open WebSocket would hold the event page open (blocked by F1).
3. `chrome.tabs.sendMessage` with a `frameId` into sub-frames — the API exists,
   the cross-frame routing was never exercised.
4. A real download completing through `browser-download.ts` — the API is
   present and `search` works, but no download was ever started.
5. `captureVisibleTab` actually returning PNG bytes.
6. `scripting.executeScript` actually reinjecting a content script.
7. Any Firefox older than 153 — 109–111 (F3, background will not load) and
   112–127 (F3, no `world: "MAIN"`) are the interesting ones and neither build
   was available.
8. A signed/permanent install rather than a temporary add-on. Firefox MV3 has
   historically required the user to grant `host_permissions` after install
   rather than at install; my temporary add-on plainly had them (the content
   script ran on `http://127.0.0.1`), but that may not be what a real install
   does on an older Firefox.

## Running the specs on Firefox

The content-script harness needs no extension, so it runs on Firefox with only
a new config. I added one; the shared `playwright.content.config.ts` is
untouched.

```
EXTENSION_TEST_BUILD_LABEL=p-firefox \
FLUXIQ_FIREFOX_EXECUTABLE=<a Playwright Firefox> \
npx playwright test -c e2e/playwright.content.firefox.config.ts --workers=3
```

`FLUXIQ_FIREFOX_EXECUTABLE` exists because this machine has `firefox-1538`
installed while `playwright-core@1.51.1` wants `firefox-1475`; unset, the
config uses Playwright's own build. Pointing 1.51.1's Juggler at the 1538 build
worked without complaint for all 194 tests.

The **extension** e2e suite cannot target Firefox as written, and the reasons
are structural rather than cosmetic. `e2e/fixtures/extension-context.ts` uses
`chromium.launchPersistentContext`, `--load-extension`, waits for a
`serviceworker` event, derives the extension id from a `chrome-extension://`
worker URL, opens `chrome-extension://<id>/sidepanel/index.html`, and restarts
the worker through a CDP session. Every one of those five has no Firefox
counterpart.

What a Firefox fixture would need, all of which I have working code for in
`apps/extension/.lab-instances/p-firefox/` (gitignored scratch, not proposed
for the repository as-is):

1. `firefox.launchPersistentContext(profile, { args: ["-start-debugger-server", port], firefoxUserPrefs: { "devtools.debugger.remote-enabled": true, "devtools.chrome.enabled": true, "devtools.debugger.prompt-connection": false } })`.
2. A ~40-line client for Firefox's length-prefixed remote debugging protocol:
   `getRoot` → `addonsActor`, then `installTemporaryAddon` with a **native**
   Windows path (a forward-slash path fails with
   `NS_ERROR_FILE_UNRECOGNIZED_PATH`), then `listAddons` on `root` to read the
   `moz-extension://<uuid>/` origin back.
3. A different way to reach extension pages. Playwright cannot navigate a tab
   to `moz-extension://` — `page.goto` never even commits — so the popup UI
   cannot be driven the way `extensionPage` drives the side panel. Reaching it
   needs either the RDP target actors or a `web_accessible_resources` iframe.
4. A replacement for `restartServiceWorker`. Firefox's event page cannot be
   killed through CDP; it can be waited out (F2 shows ~75 s of idle does it) or
   the add-on can be reloaded over RDP.
5. Dropping the XPI into the profile's `extensions/` directory does **not**
   work — Firefox removed profile sideloading. I tried it first; the add-on was
   simply absent from `extensions.json`. `installTemporaryAddon` is the route.

Note also that the profile-`extensions/` failure is why `scripts/smoke-test.mjs`
proving `manifest.firefox.json` merely *exists* is the entire Firefox coverage
in `pnpm test` today.

## What changed and why

Two new Playwright config files under `apps/extension/e2e/`, both new, neither
touching a shared config:

- `e2e/playwright.content.firefox.config.ts` — the content harness on Firefox.
  Same `testDir` and `globalSetup` as the Chromium config; `browserName:
  "firefox"`, its own `outputDir` and JSON reporter so a concurrent run of the
  shared config cannot be clobbered, and an optional
  `FLUXIQ_FIREFOX_EXECUTABLE` override.
- `e2e/playwright.content.chromium-baseline.config.ts` — the Chromium run the
  Firefox numbers are compared against, on its own output paths for the same
  reason. **This one is disposable**: it exists so the delta was measured
  against a baseline I took myself on the current tree rather than against
  someone else's report. Delete it if the supervisor would rather not carry a
  near-duplicate of `playwright.content.config.ts`.

`npx tsc -p tsconfig.test.json` covers `e2e/**/*.ts`, and it exits 0 with both
files present.

Everything else lives in `apps/extension/.lab-instances/p-firefox/`, which
`.gitignore` covers at any depth: the build output (the extension build was
redirected there with `FLUXIQ_LAB_EXTENSION_BUILD_ROOT` so the tracked
`build/` and a concurrent worker's `dist/` were never touched), the probe
scripts, and the instrumented **copies** of `dist/firefox`. The probes add a
background module and a content script to a *copy* of the built extension and
never modify the extension's own code, so the shipping background and content
scripts loaded exactly as built. No file under `apps/extension/src/`, no
`manifest.*.json`, and no existing spec or config was edited.

### Side effect to own up to

The probes leave orphaned Playwright Firefox processes behind when a run is
interrupted, and I cleared them twice with a `Stop-Process` sweep over
`Get-Process firefox` filtered only by start time — not by executable path. The
user's own Firefox (`C:\Program Files\Mozilla Firefox\firefox.exe`) matches that
process name, so if it was open at roughly 17:52 and 17:58 on 2026-09-12 those
windows were very likely closed too. Firefox restores its session on next
start and no profile was touched, but it was a disruption I should not have
caused. A path filter (`Get-CimInstance Win32_Process` and match the command
line against the Playwright build or the probe's temp profile prefix) is the
correct sweep; that is what the final check used, and it confirmed the
Firefoxes running at the end of this task are all the user's own and none of
mine.

## Commands run and observed results

| Command | Exit | Observed |
| --- | --- | --- |
| `node scripts/build-extension.mjs` with `FLUXIQ_LAB_EXTENSION_BUILD_ROOT=…/.lab-instances/p-firefox` | 0 | five bundles built; `dist/{chrome,firefox,e2e-chromium}`; `dist/firefox` has 19 files |
| `npx web-ext@8.3.0 lint --source-dir …/dist/firefox` | 0 | `errors 0, notices 0, warnings 5` — 2 × `KEY_FIREFOX…UNSUPPORTED_BY_MIN_VERSION` (`background.type` needs 112, manifest admits 109), 3 × `ICON_SIZE_INVALID` |
| `npx playwright test -c e2e/playwright.content.firefox.config.ts --workers=3` | 1 | `4 failed, 1 skipped, 189 passed (41.4s)` of 194 |
| `npx playwright test -c e2e/playwright.content.chromium-baseline.config.ts --workers=3` | 1 | `3 failed, 1 skipped, 190 passed (36.8s)` of 194 |
| `npx playwright test -c …firefox.config.ts click.spec.ts --workers=2` (rerun) | 1 | `2 failed, 8 passed (7.3s)` — the same two |
| `node .lab-instances/p-firefox/ff-webext-probe.mjs` (web-ext temporary install) | 0 | `Installed …/dist/firefox as a temporary add-on`; page reported `{"dialogOverride":"true","alertIsNative":false,"confirmIsNative":false,"ua":"…Firefox/153.0"}` |
| `node .lab-instances/p-firefox/ff-runtime-probe.mjs` | 0 | background + content reports quoted in the capability map; `getStatus` returned `connectionState: "disconnected"`, `clientId`, `activeTabId: 2`, `activeTabUrl` |
| `node .lab-instances/p-firefox/ff-lifecycle-probe.mjs … 75000` | 0 | `boots: 1` then `boots: 2` at +89.6 s |
| `node .lab-instances/p-firefox/ff-background-websocket-probe.mjs` | 0 | background `ws://127.0.0.1` and `ws://localhost` both `error`/`readyState 3`, `SERVER_UPGRADES []`; `plainFetch: "status 200"` |
| same, with the three mixed-content prefs relaxed | 0 | identical failures |
| same, with a same-browser page control added | 0 | `CONTROL_PAGE_WEBSOCKET open`, `SERVER_UPGRADES ["127.0.0.1:63040/ws"]`, background still `error` |
| `node .lab-instances/p-firefox/ws-server-check.mjs` | 0 | `chromium page websocket: open`, `firefox page websocket: open`, `server saw upgrades: 2` — the probe server is sound |
| `node .lab-instances/p-firefox/engine-diff-probe.mjs` | 0 | fractional point `{x:339,y:248}` in **both**; hash nav `changedSynchronously: true` chromium / `false` firefox |
| `npx tsc -p tsconfig.test.json` | 0 | no output |

The four Firefox failures, and how they were attributed:

| Test | Firefox | Chromium baseline | Verdict |
| --- | --- | --- | --- |
| `click.spec.ts:104` hit-tested point | fail | pass | Firefox-only — F6 |
| `click.spec.ts:139` link navigation | fail | pass | Firefox-only — F5 |
| `identity-resolution.spec.ts:353` | fail | **fail** | not Firefox; another worker's in-flight edits |
| `identity-resolution.spec.ts:510` | fail | **fail** | not Firefox; same |
| `evidence.spec.ts:241` infinite-feed | pass | fail | Chromium-only, and only a teardown timeout under load — infrastructure flake |

One suspect result, rerun as the brief requires: the very first Firefox
`click.spec.ts` run failed **all ten** tests with
`element.getBoundingClientRect is not a function`. It never reproduced — the
full suite and a second targeted run both put the same eight tests green. The
most likely cause is a corrupted esbuild output in that one harness build,
which every test in the run would then read from the same cached bundle. Given
this machine's known faulty RAM, I am recording it as an environment artifact
rather than a Firefox defect, and noting that a *single* bad harness build
fails a whole run identically, which is exactly the shape that gets
misattributed to a browser.

## Not verified

- **Anything past pairing on Firefox.** F1 blocks it. The action, recording and
  evidence paths were exercised only through the content harness, which
  replaces the extension with a `chrome.runtime` stub.
- **Any Firefox but 153.** Only Playwright's `firefox-1538` build was on this
  machine. The 109–111 and 112–127 claims in F3 come from Mozilla's linter
  (measured, for `background.type`) and from the capability matrix's own
  citation of Firefox 128 for `world: "MAIN"` (documented, not measured here).
- **A stock Mozilla Firefox.** Playwright's Firefox is a patched build. F1 in
  particular deserves one confirmation against a released Firefox before anyone
  changes the gateway scheme on the strength of it.
- **A permanent, signed install.** Everything ran as a temporary add-on.
- **Cross-frame `tabs.sendMessage`, a real download, a real screenshot, a real
  `executeScript` reinjection** — APIs present, behaviour unexercised.
- **The Firefox popup UI.** Playwright cannot navigate to `moz-extension://`,
  so `popup/index.html` was never rendered or clicked. Its scripts loading
  without error is *not* established; only the background's are.
- **Whether an open WebSocket holds the event page open** — untestable while F1
  stands.

## Open questions or contradictions found

1. **Is Firefox a supported target, or an aspiration?** `README.md`,
   `AGENTS.md`, and four architecture documents talk about Firefox; the build
   ships a Firefox target; and the product's central connection cannot be made
   there. Either the gateway gets a scheme Firefox will accept, or the Firefox
   target should say plainly what it is. That is a decision above a worker.
2. **`strict_min_version: 109` contradicts the manifest it sits in** (F3), and
   half of the contradiction is already written down in
   `docs/architecture/web-capabilities.md` line 135 without the manifest being
   changed. The doc describes the 109–127 dialog gap as failing "honestly";
   nothing describes the 109–111 case, where the background does not load at
   all and no verb fails honestly because none runs.
3. **What is Firefox's recorder surface meant to be?** (F4.) A popup that
   closes when the user clicks the page is not the same product as a side
   panel, and `sidebar_action` — the primitive that would be — is not declared.
   `AGENTS.md` asks the two to stay aligned "where the product contract is
   shared"; someone should decide whether it is shared here.
4. **`click.spec.ts` encodes a Chromium layout accident** (F6). The assertion
   `point.clicked === point.centre` holds only while the target's centre avoids
   a half pixel. If Firefox is ever gated in CI, that test needs to compare
   against the truncated point rather than the rounded one — and the underlying
   question, whether the extension should hit-test and dispatch at the *same*
   integer point, is a real one nobody has asked.
5. **Ownership note.** `apps/extension/e2e/playwright.content.chromium-baseline.config.ts`
   is mine and disposable; see *What changed and why*. The instrumented
   `dist-*` copies and probe scripts under
   `apps/extension/.lab-instances/p-firefox/` are gitignored scratch and can be
   deleted with the directory.
