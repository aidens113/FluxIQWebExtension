# W4-B5a: extension panel screens as built (lane t900)

Capture only. No product code changed. Nothing committed. Pictures are in `screens/` beside this file.

## Outcome

Partial. Everything the brief asked for is captured except the real Firefox toolbar popup (no frame, no real toolbar
icon in Firefox). Cause not found after four attempts, see "Not captured".

## Files (all in `screens/`)

Harness = the real panel (`mountPanel`) over a scripted background, in a frame on the company-website scenario page, headed
Chromium. Chrome frame 400 x 900, Firefox frame 380 x 580 (the popup's CSS size, `html[data-surface="popup"] body`). Real = the
browser's own window photographed from the screen (Lab window-capture helper), so frame, fonts and scrollbars are the browser's.
Real Chrome side panel is the scripted panel loaded as the side panel page of a COPY of `dist/e2e-chromium` in a temp folder (the
build itself is untouched), driven through `chrome.extension.getViews()` (untrusted clicks). Its inner width is 360 x 655.

| File(s) | Browser | Screen | Theme | How |
| --- | --- | --- | --- | --- |
| `chrome-getting-started-{dark,light}.png`, `firefox-getting-started-{dark,light}.png` | Chrome 400 / Firefox popup 380 | getting started / setup card | both | harness |
| `chrome-chat-empty-{dark,light}.png`, `firefox-chat-empty-{dark,light}.png` | both | chat empty (welcome) | both | harness |
| `chrome-chat-thread-{dark,light}.png`, `firefox-chat-thread-{dark,light}.png` | both | thread: person turn, reply, step cards incl. "Already done — not pressed again", "Run finished", ask with two buttons | both | harness |
| `chrome-composer-idle-dark.png`, `firefox-composer-idle-dark.png` | both | composer with Show me how (same state as the thread) | dark | harness |
| `chrome-drawer-{dark,light}.png`, `firefox-drawer-{dark,light}.png` | both | Chats drawer: 5 rows, "Waiting on you", selected row | both | harness |
| `*-drawer-search-dark.png` | both | drawer with "hours" typed in search | dark | harness |
| `*-drawer-rename-dark.png` | both | a row in rename mode | dark | harness |
| `*-drawer-delete-confirm-dark.png` | both | a row in "Delete this chat?" confirm | dark | harness |
| `chrome-automations-dark.png`, `firefox-automations-dark.png` | both | Automations tab (Tasks list, Your automations, New automation) | dark | harness |
| `*-recording-question-dark.png`, `*-recording-running-dark.png`, `*-recording-review-chip-dark.png` | both | recording: the question, the red bar with Stop and Extract, the chip on the composer after Stop | dark | harness |
| `*-extraction-asks-what-to-record-dark.png` | both | pressing Extract with no recording running asks what to record first | dark | harness |
| `chrome-extraction-dark.png`, `firefox-extraction-dark.png` | both | extraction panel (columns, include/exclude, Confirm) | dark | harness |
| `chrome-settings-1-top-{dark,light}.png`, `chrome-settings-2-scrolled-{dark,light}.png`, `chrome-settings-advanced-open-dark.png`; `firefox-settings-{1-top,2-scrolled,3-scrolled}-{dark,light}.png`, `firefox-settings-advanced-open-dark.png` | both | Settings, top to bottom: Connection, Model, Behaviour (Humanness slider), Status on the page, Permissions, Save, Appearance, Report a problem, Advanced | both | harness |
| `chrome-real-getting-started-{dark,light}.png` | Chrome | getting started | both | REAL side panel, cropped from the window photograph |
| `chrome-real-chat-empty-{dark,light}.png`, `chrome-real-chat-thread-dark.png` | Chrome | chat empty, thread | both / dark | REAL side panel |
| `chrome-real-drawer-{dark,light}.png`, `chrome-real-drawer-rename-dark.png`, `chrome-real-drawer-delete-dark.png` | Chrome | drawer, rename, delete confirm | both / dark | REAL side panel |
| `chrome-real-settings-{1,2,3}-{dark,light}.png` | Chrome | Settings, three scroll positions (1218 px of content in 607 px) | both | REAL side panel |
| `chrome-window-with-real-sidepanel-dark.jpg`, `chrome-window-toolbar.jpg` | Chrome | whole window with the panel open / the toolbar with the FluxIQ icon pinned | n/a | REAL window (JPEG, 1296 x 854, about 200 KB) |
| `chrome-toolbar-icon-zoom8x.png`, `chrome-toolbar-strip-zoom3x.png` | Chrome | crops of the real toolbar: the pinned icon at 8x (nearest neighbour; the photograph itself is JPEG) and the right end of the toolbar at 3x | n/a | REAL |
| `chrome-icon16-8x.png`, `chrome-icon32-8x.png`, `firefox-icon16-8x.png` | both | `dist/*/icons/icon16.png` and `icon32.png` scaled 8x, nearest neighbour | n/a | file |
| `firefox-window-toolbar-default.jpg`, `firefox-window-toolbar-pinned-attempt.jpg`, `firefox-toolbar-strip-zoom4x.png` | Firefox | the real Firefox window with the add-on installed (default placement; and with a `browser.uiCustomization.state` placing it on the nav bar) | n/a | REAL window |

Three of the real-panel PNGs are 213-218 KB (the photograph is JPEG, so the PNG carries its noise); the rest are under 200 KB.

## Not captured, and why

- **Real Firefox toolbar popup** (empty chat, drawer, settings in the real popup): not captured. Playwright cannot navigate any page to
  the temp add-on's `moz-extension://<uuid>/popup/index.html` here: `goto` times out and the URL stays `about:blank`, so the control
  page that calls `browser.action.openPopup()` never exists. Ruled out: the scripted popup page (the unmodified `dist/firefox` build
  does the same), a new tab versus the first tab, the pinned `uiCustomization` pref. Not ruled out: the add-on not actually running
  after the RDP install (consistent with no FluxIQ button anywhere in the Firefox toolbar, see below), or Playwright's Firefox 1475
  refusing moz-extension navigations. The Lab's own `open-firefox-session.ts` does the same install, so a live Lab Firefox run is the
  next thing to check. The Firefox pictures above are therefore the harness (frame 380 x 580), not the real popup frame.
- **FluxIQ icon in the real Firefox toolbar**: the add-on's button is not on the nav bar by default, and my attempt to place it with
  `browser.uiCustomization.state` showed nothing either (`firefox-window-toolbar-pinned-attempt.jpg`). Only the generic Extensions
  puzzle button is there. `firefox-icon16-8x.png` is the file itself.
- Harness frames are 900 px tall, not the whole screen height; the real Chrome panel is 655 px tall.
- Tasks in the Automations list are both "Working": the task contract's ended statuses need more fields than I could confirm.
- Not tested: Chrome's own side-panel pin button, or the panel at other widths.

## Defects seen (as built)

1. Native checkboxes and radios keep the system blue accent, not the brand amber: Permissions checkboxes in `chrome-settings-2-scrolled-dark.png`,
   `chrome-real-settings-2-dark.png`, `firefox-settings-2-scrolled-light.png`; Include/Exclude radios in `chrome-extraction-dark.png`. (The
   Appearance radios are amber, so it is inconsistent.)
2. The Permissions checkbox labels ("Record page changes" ...) are about 16 px against 13 px hints and other settings text: `chrome-settings-advanced-open-dark.png`.
3. Getting-started step 1 reads like a developer note: "In the !FluxIQWebExtension folder on this computer, run pnpm dev, and leave that window open": `chrome-getting-started-light.png`.
4. Chrome's own side-panel header shows the manifest name "FluxIQ Web Automation Client (E2E)" (e2e build) with a light header and light surround
   around the dark panel: `chrome-real-*.png`, `chrome-window-with-real-sidepanel-dark.jpg`. The frame is Chrome's; the name is ours.
5. The rename field's selected text uses the system blue selection colour: `chrome-drawer-rename-dark.png`.
6. Native scrollbars are the light-grey system style on the dark panel: `chrome-recording-review-chip-dark.png`, `chrome-extraction-dark.png`.
7. The 16 px icon: the amber dot is about 3 px (see `chrome-icon16-8x.png`) and at 1x in the toolbar it reads as a faint speck, not a dot: `chrome-toolbar-icon-zoom8x.png`.
8. Real panel is 360 px wide in Chrome (not 400), so lines that fit at 400 may wrap: compare `chrome-chat-thread-dark.png` with `chrome-real-chat-thread-dark.png`.
9. No Geist fallback seen: panel text is Geist everywhere it was loaded (harness through the FontFace API, real Chrome from the build's own assets). Chrome's panel header and the toolbar are system fonts, as expected.
10. The extraction sheet's preview table is below the fold in both frames; only the column editor shows: `chrome-extraction-dark.png`.

## Commands run and observed results

- `heavy-slot run t900 -- pnpm --filter @fluxiq-web-extension/extension build` -> built, `extension build: firefox: verified 26 files`, `e2e-chromium: verified 26 files` (the queue held it about 25 minutes; no failure in `src/background/connection`).
- `heavy-slot run t900 -- pnpm --filter ... test:content all-screens-capture --headed --workers=1` -> `2 passed (2.6m)`, `CAPTURE-DONE chrome problems=[]`, `CAPTURE-DONE firefox problems=[]`.
- `heavy-slot run t900 -- ... playwright.real-capture.config.ts` with `FLUXIQ_REAL_BROWSER=chrome` -> `1 passed (40.5s)`: `side panel views 1`, panel size `360,655`, every drive step `ok`.
- Same with `FLUXIQ_REAL_BROWSER=firefox` -> failed, four times (each time after the toolbar photograph where it got that far), last: `control goto: TimeoutError: page.goto: Timeout 20000ms exceeded.` then `waitForURL` timeout.

## Tooling added or changed (all under `apps/extension/e2e/`, none is product code)

- `content/tests/screens/tests/all-screens-capture-company-website.spec.ts` (new): the harness capture. Set `FLUXIQ_CAPTURE_DIR` to choose the output folder.
- `content/tests/screens/all-screens-entry.ts` (new): the scripted background shared by both captures (thread, step cards, ask, drawer list, tasks, recording, extraction).
- `real-panel-capture.spec.ts` + `playwright.real-capture.config.ts` (new): the real-browser capture. Env: `FLUXIQ_REAL_BROWSER=chrome|firefox`, `FLUXIQ_CAPTURE_RAW`, `FLUXIQ_FIREFOX_PIN`, `FLUXIQ_FIREFOX_PLAIN`. The Chrome part launches twice in a temp profile to pin the extension through `Preferences`.
- `content/tests/screens/panel-frame.ts` (changed): the panel's styles now import Geist as `.woff2`, which `bundlePanel` could not load ("No loader is configured for .woff2"), so every existing screens spec failed to bundle. It now bundles fonts as data URLs and loads them through the `FontFace` API, because the scenario page's CSP refuses a font by URL. Worth a look by whoever owns those specs.
- Scratch (not in the repo): `crop.mjs` and the raw window photographs, in the session scratchpad.

## Not verified

- That the harness panel matches the real one pixel for pixel in the states I scripted (the real panel only ever ran the same scripted background).
- Any state needing a live Core: the real unconnected panel in Chrome, real task or conversation data, a real connected popup.
- Light theme for the recording, extraction and automations screens (dark only).

## Open questions or contradictions found

- The Lab's window-capture helper lists only `chrome.exe` and `msedge.exe` (`window-capture-source.ts`, the `processes` query), so `captureBrowserWindows("firefox", ...)` in `extension-chat-check` can never find a Firefox process. I found Firefox's through WMI instead; the helper's `capture <pid>` then worked.
- Whether the Lab's Firefox session really loads the add-on's pages in this Playwright build; see "Not captured".
- The heavy-slot queue was 4 to 8 deep throughout; each run waited 10 to 30 minutes.
