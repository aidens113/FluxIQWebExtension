# W4-FX: the real Firefox toolbar popup (lane t900)

Capture only. No product code changed. Nothing committed. No file added under the repo except pictures in the ignored `test-runs/`.

## Outcome

Done. The real Firefox toolbar popup (toolbar button pinned, popup open, anchored under the button) is captured, in both the unmodified build (unpaired, "Get started") and a scripted-background copy (chat empty, thread, drawer, settings).

## Why it works now and why b5a's attempt failed

The Playwright-driven Firefox in b5a (Juggler) cannot navigate to `moz-extension://` pages. Here Playwright's Firefox binary
(`%LOCALAPPDATA%/ms-playwright/firefox-1475/firefox/firefox.exe`, Firefox 135.0, no desktop Firefox is installed) is started by Mozilla's
`web-ext run` instead (no Juggler), which installs the add-on temporarily through the debugger protocol. Then:

- web-ext 10.8.0 was installed in a throwaway folder in the scratchpad (`scratchpad/webext`), not in the repo.
- The popup is opened with `browser.action.openPopup()` called by an extra background script that exists only in a COPY of `dist/firefox` (pref `extensions.openPopupWithoutUserGesture.enabled=true`). It is the genuine toolbar popup (380 x 580 CSS px, `getViews({type:"popup"})` = 1), not a window of the popup page. No click on the button was made, so button press itself is not exercised.
- Pinning: `browser.uiCustomization.state` passed with `--pref` is written to `user.js` by web-ext unescaped (invalid string), which is why b5a's pin did nothing. Writing it into the profile's `prefs.js` (valid escaped JSON, `currentVersion` 21, button id `fluxiq-web-automation_example_local-browser-action` in `nav-bar`) pins the button.
- Photographs: the Lab's `window-capture` helper captured the main window only (identical frames, popup missing: the popup is a separate native window). A PowerShell `CopyFromScreen` of the Firefox window rectangle (DPI aware) does include the popup. First attempt with the helper and a wrong profile match are the two dead ends (below).
- web-ext's `--firefox-profile` copies the profile unless `--keep-profile-changes` is given, so the process command line did not contain my profile path; fixed by that flag and by matching on the profile folder name.

## Files (in `test-runs/w4-brand-screens/firefox-real/`, all under 190 KB)

| File | What |
| --- | --- |
| `window-*.jpg` | the whole real Firefox window (1296 x 944) with the popup open on the company-website scenario |
| `popup-*.png` | crop of the real popup frame (392 x 592) from the same photograph, 1x |
| `popup-getting-started-{dark,light}`, `popup-chat-empty-{dark,light}`, `popup-chat-thread-dark`, `popup-drawer-{dark,light}`, `popup-settings-{1,2,3}-{dark,light}` | scripted-background copy (no Core, model or paid calls), same states as b5a's harness pictures |
| `popup-plain-start-{dark,light}`, `popup-plain-settings-{dark,light}` | the UNMODIFIED build's real unpaired popup: Get started, and Settings (opened by clicking `#settingsButton` in the popup document) |
| `toolbar-icon-zoom8x.png`, `toolbar-strip-zoom3x.png` | the pinned FluxIQ button in the real toolbar, nearest-neighbour zoom |

Light/dark is the popup's own `data-theme` attribute, not Firefox's theme (the browser chrome stays light in all frames).

## What I saw against the brand (looked at: getting-started dark, settings-2 dark, chat-thread dark, drawer light, toolbar icon)

- Dark ink ground, amber accent (Connect button, step 1 ring, "1 waiting" chip, selected drawer row, checkbox ticks), Geist-like type: all as built, in the real frame.
- Popup frame is 380 x 580; content scrolls inside (a native light-grey scrollbar sits on the dark ground at the right edge in getting-started and settings: matches defect 6 of b5a).
- Settings Permissions checkboxes are amber-ticked in Firefox (b5a defect 1 was blue in Chrome and in the light settings; check `popup-settings-2-light.png`).
- The popup is anchored under the pinned button and its dark frame has a thin native border; the page behind stays visible.
- 16 px toolbar icon: dark tile with white F and amber dot about 3 px; at 1x it reads as a small amber speck (b5a defect 7 confirmed, `toolbar-icon-zoom8x.png`). Firefox highlights the button grey while the popup is open.
- Header status dot is grey on the unpaired popup, green on the scripted one.
- Defects not re-assessed pixel by pixel; I only looked at the five pictures named.

## Commands run and observed results

- `npm i web-ext` in scratchpad -> web-ext 10.8.0.
- Probe 1 (`heavy-slot run t900 -- node drive.mjs ...`, web-ext + start-url, pinning via `--pref`) -> add-on installed (`Installed ... as a temporary add-on`); the process match found no Firefox, no photograph.
- Run 2 (session with Lab window-capture helper) -> `EXT openPopup resolved`, `views 1 size 380,580,1,1296,944`; all 14 photographs 147043 bytes, byte-identical; main window only, no popup, no FluxIQ button (pin pref invalid).
- Run 3 (screen capture, valid pin in `prefs.js`, `--keep-profile-changes`) -> all shots `ok 1296 x 944`; plain popup start dark/light, plain settings dark/light, scripted getting-started, chat-empty, thread, drawer, settings x3 per theme, all showing the real popup. `EXT` log lines: `openPopup resolved`.
- Scenario served by `apps/scenario-lab/dist/server.js` (`startScenarioLab`, port 18765), page `/scenarios/company-website/`; the scenario server was stopped afterwards.
- Heavy runs went through `heavy-slot run t900 --` (queue waits 20-60 min each).

## Not verified

- A real mouse click on the toolbar button (the popup was opened by `openPopup()`, which Firefox treats the same as the toolbar popup but not the click path).
- A signed/release Firefox; this is Playwright's Firefox 135 patched build with a temporary add-on.
- Pairing/connected states with a real Core; the popup in other widths; Windows theme variants; focus ring (not exercised; see the list below).
- The scripted copy's `popup/index.html` loads the panel via `scripted.js`; Geist loaded from the page bundle's data-URL fonts, not from the build's own assets (the plain build pictures use the build's own: they look the same).

## Reuse

Scratch scripts (not in the repo): `scratchpad/drive2.mjs` (web-ext driver + step server), `build-scripted.mjs`, `opener-walk.js`, `capture.ps1`, `crop.ps1`. Not worth adding to `APP/e2e/` as they hold absolute paths; say if you want them cleaned up and kept.

## Manual check list for a person (for what this run did not exercise)

1. `about:debugging#/runtime/this-firefox` -> Load Temporary Add-on -> `apps/extension/dist/firefox/manifest.json`.
2. Puzzle button -> gear next to FluxIQ -> Pin to Toolbar. Look at the 16 px icon at 100% zoom: amber dot visible against dark tile?
3. Click the button on a scenario page: popup is 380 x 580, dark ink ground, amber accent, Geist font, scrolls inside.
4. Tab with the keyboard through the popup: the focus ring is visible and amber on every control (not exercised here).
5. Settings: Connection, Model, Behaviour (humanness slider), Status on the page, Permissions, Appearance, Report a problem, Advanced; check labels, checkbox accent, scrollbar style.
6. Chats drawer: search focus ring, rename, delete confirm.
7. Click away and reopen: popup state survives; the "open in tab" arrow (top right) opens the full page.
8. OS dark/light mode: the popup should follow its own theme setting.

## Open questions

- The Lab's `window-capture` helper cannot photograph a Firefox popup (main window only, and lists only chrome/msedge); `extension-chat-check`'s Firefox pictures would miss the popup for the same reason. A screen-rectangle capture works.
