# Visual sweep (t925, key-security-ux)

Audit only; no source edited. Paths: W = Core `apps/web/src`, U = Core `packages/ui-components/src`, X = EXT `apps/extension/src`.
Screenshots: `EXT/test-runs/key-security-ux/sweep/shots/NNN-*.png` (the NNN in the table). Marks: "journey #N" and "t927/t928" are known and not re-reported.

## Outcome and method

Partial: both clients were swept live, but the slot lapsed 14 minutes in (see Not verified), so the run stopped before the
"saved key", "long messages in the extension" and "extension disconnected by killing Core" states.

- Fresh data (old `.fluxiq` moved to `test-runs/key-security-ux/fluxiq-journey-data/`), panel on 3100 / gateway 4877, first sign-in admin/admin then a new
  password (saved in `test-runs/t925-panel-credential.txt`, not printed). Headed Chromium, fresh profile, extension loaded unpacked, side panel opened as a tab at 360 px.
- Every panel route (home, projects, flows, runs, data, chats, security x5, settings x8, 404, create-project modal, pairing modal, remove-access confirm) at
  1440 and 390, light and dark. Theme set the way each client stores it (`localStorage fluxiq-theme` + `data-theme`); each screenshot records the body background, so
  light really rendered (`rgb(246,243,238)` vs `rgb(12,13,15)`). Emulating `prefers-color-scheme` alone does nothing on the panel (it defaults to Dark, journey #13).
- Extension at 360: getting-started (address wrong, change address, found, mid-pairing, signed in), connected chat, chat list, Automations, Settings, revoked.
- Per page DOM audit (overflow past viewport, clipped text, buttons taller than 90 px, text under 11 px) and layout-shift entries (PerformanceObserver) with a per-frame
  box of `<main>`.
- States: loading (`page.route` delayed 4 s), error (`page.route` 500), empty, 17 projects (two with 100+ character names, one with no spaces), 17 chats, no AI key, mid-pairing, revoked, long names.
  Chats are created by sending a message with no key (no model call; dummy text only).
- Helpers: `sweep/daemon.mjs`, `sweep/step.sh` (copied from journey/).

## Findings, worst first

| # | Where | What is wrong | Cause (file:line) | Shots | Severity |
|---|---|---|---|---|---|
| 1 | Panel /chats, 1440+390, both themes | Every chat is "Untitled chat" (the assistant itself titles it "Invoices - Find the three cheap..."), and the meta line reads "panel - Open - 2 messages": a raw project id and an internal status word | W/features/chats/chat-rows.ts:22-23 (title fallback; `projectNames.get(..) ?? chat.projectId` prints the id `panel`), W/features/chats/ChatsPage.tsx:70 | 208-211 | broken |
| 2 | Panel, any page when a request fails | The error toast ("Notice / boom": generic title, raw server text) is fixed top-right over the top bar and covers the Account button | W/app/styles/global-foundation/04-feedback-and-status.css:1-9 (`.global-alert-viewport` top/right 14px, z-index toast); message text not mapped | 220, 225 | broken |
| 3 | Panel /settings, 390 and 1440 | Layout shift on load: CLS 0.39 at 390 (one 0.28 jump at 338 ms when the sections replace "Loading your settings..."), 0.16 at 1440 (0.12 jump at 403 ms) | W/features/settings-page/ui/SettingsPage.tsx:28 (status line swapped for sections), model key line grows after its fetch (`P.model-key-line`), no reserved height | 215 (loading), 151-154 | ugly |
| 4 | Panel top bar at 390 (every page) | The second row (Engine / Today / Account) appears about 130 ms late and pushes `<main>` down 40 px (y 49 -> 89): shift 0.059 on every page | W/features/panel-shell/panel-shell.css:97-104 (the bar wraps once the facts mount; no min-height) | 105, 125 | ugly |
| 5 | Panel assistant with no project (Home, Projects, Flows, Chats, Security, Settings), 1440 | The no-key card is cut off at the bottom of the transcript scroller (button half hidden), the sentence "Open a project to start a conversation..." is printed under it AND again as the textarea placeholder, and on Home the "Add an AI key" sentence is on screen three times (Home card, dock card, dock helper) | W/features/chat-widget/options/panel-chat-options.ts:11 and :25 (`unavailableReason` is used as both helper and placeholder); dock scroller in U/chat/chat.css | 103, 152 | ugly |
| 6 | Panel assistant, no key, 1440 | Two different no-key cards for one condition: before a message an amber centred card with a grey "Add an AI key" button; after a message a bordered card with a "No key" pill and a yellow "Add a key". The reply text also differs ("No model key is set up yet, so add one in Settings, under AI keys." vs "Add a model key in Settings to use the assistant.") | U/model-access (two cards) and the server refusal texts; W/features/chat-widget | 200 vs 205, 208 | ugly |
| 7 | Panel /projects when the load fails | The red error line sits above the page title, says "...could not be loaded: boom" (raw text), and the page still shows "No projects yet" + "No projects in this category" beneath it (empty state contradicts the error); both "Retry" and "Try again" are offered | W/features/automation-studio/hierarchy/ProjectBrowser.tsx:88 (and the error line above the header); `Retry` is the Refresh button relabelled | 220 | ugly |
| 8 | Panel dev pages under /settings at 390 | Content past the viewport (373 px): runtime summary strip reaches 524 px, database table 737 px with no scroll box, docs path kicker 667 px in 252 px, background-task title clipped; deployment sync commit buttons are 154-393 px tall (`link-button`, Rollback); Security > Advanced user row is 318 px tall | W/app/styles/global-foundation/12-background-tasks.css:1-36 (`.link-button`, `.summary-strip`), 17-database-explorer.css:153,218 (`.db-grid-wrap` not applied to this table), global-programs/03-docs-workspace.css:80 (`.panel-kicker`), global-programs/01-identity-and-access.css:75 (`.identity-user-link`) | 161, 165, 169, 173, 185, 149 | ugly |
| 9 | Panel /settings/* technical pages | Raw ids and JSON on screen: "runtime.64fe3d3e-2b35-...", "Locked", "T" letter icons, a `{"id":"docs.rebuild","name":...}` table cell, "Technical details" label; the docs path "/framework-docs/working/..." as a kicker | W/features/programs (database manager, runtime, docs viewers) | 159, 171, 167 | minor (developer pages) |
| 10 | Panel dialogs (create project, pairing, remove) | The footer rule stops about 50 px short of the right edge (460 to 930 in a 460-980 dialog) while it bleeds to the left edge | W/app/styles/global-foundation/15-modals-and-drawers.css:92-99 (`.modal-actions` negative margin does not match the dialog's own padding/header grid) | 192, 235 | ugly |
| 11 | Panel pairing modal | Label/value rows misaligned (Name, Code, Time left sit at different baselines; code box taller than its label), and the title "A browser or app wants to connect" is repeated by "Someone is asking to connect" (journey #11 covers the sentence, not the alignment). Confirm/Decline 175 px tall at 390 is journey #9 | W/app/GlobalClientGatewayPairing.tsx, W/app/client-pairing-modal.css | 235, 237 | ugly |
| 12 | Panel /projects, 1440 | The "Updated ..." column wraps to two lines on rows with a description and stays one line on rows without, so the right edge is ragged; every row without a description says "No description"; an empty list shows two empty states ("No projects yet" and "No projects in this category") | W/features/automation-studio/hierarchy/ProjectBrowser.tsx:159-161 | 197, 107 | ugly |
| 13 | Panel page headers | Four header styles: Home and Settings a 28 px H1; Projects an icon + 16 px title + subtitle; Security a smaller H1 with tabs and then a duplicate H2 "Devices and apps" under the tab "Devices and apps"; Flows an H1 with a bare "Search" label (Projects and Chats use other search styles). Main column width also differs: Settings stops at 720 px (right third empty), Home fills | W/features/settings-page/ui/settings-page.css:2 (`max-width:720px`); W/features/home/home.css (hard-coded px/rem); W/features/security/security.css; ProjectBrowser | 103, 107, 151, 247 | ugly |
| 14 | Panel /security at 390 | The four tabs wrap to two rows (People and Activity on the second); the confirm row "Remove access" is solid red with a different type size from the rest; helper text "Nothing is waiting..." is about 11 px; the numbered list uses browser default markers | W/features/security/security.css | 249, 252 | ugly |
| 15 | Both clients, light theme | Thick native grey scrollbars on the main column and the assistant dock (not themed; only one rule sets `scrollbar-width: thin`) | W/app/styles/global-shared-controls.css:81 (single rule); U/theme/tokens.css and U/chat/chat.css have no scrollbar tokens; X chat shows the same | 103, 239 | ugly |
| 16 | Panel Home "Connected" card | "Connected" is the card title and the status of the same row; "last seen not known" and "Built in" are internal words; the pending client appears under Connected (journey #11 covers the list logic) | W/features/home/sections/HomeConnected.tsx | 103, 235 | minor |
| 17 | Panel loading copy | Mixed ellipsis and voice: "Loading...", "Loading your settings...", "Checking your AI key...", "Loading the conversation..." and "Reading the project index."; failures mix "Could not" and "Couldn't" with and without a final stop ("Could not tell whether the engine is running" has none) | W/features/home/sections/HomeEngine.tsx:19, SettingsPage.tsx:28, ProjectBrowser.tsx:88 | 212, 219 | minor |
| 18 | Panel /chats, assistant | On /chats (all projects) the dock shows the last created chat's transcript under the title "FluxIQ assistant"; the list says "Untitled chat" for it | W/features/chat-widget (context for all-projects) | 208 | minor |
| 19 | Panel 390, scrolling | The round "Ask" button sits over row actions (the "..." of Company site); the page reserves room only at the very bottom | W/features/panel-shell/panel-shell.css:132-148 | 198 | minor |
| 20 | Extension chat | The header project selector says "Weekly report" while the chat context bar says "All projects"; in the dark capture taken 0.3 s later the selector read "Project" (the label flips on re-render) | X/panel/projects, X/panel/shell | 239 vs 240, 246 | ugly |
| 21 | Extension header | Settings is a header button (with a highlight) while Chat and Automations are tabs on a second row; in Settings no tab is selected | X/panel/shell | 245 | ugly |
| 22 | Extension Automations | The segmented control says Tasks / Library but "Your automations" is shown under Tasks; button text "Extract Data From This Page" is Title Case while everything else is sentence case | X/panel/automations/automations-tab.ts:74-80, X/panel/extraction/panel-elements.ts:47 | 243 | minor |
| 23 | Extension Settings | Monospace upper-case captions (CONNECTION, MODEL, BEHAVIOUR) that the panel does not use; "FASTEST / MOST HUMAN-LIKE" at 10 px; "MODEL" is journey #7, "Dark is the default" is journey #13 | X/panel/settings/settings.css:47, :56 | 245 | minor |
| 24 | Extension getting started | Step 4 has no line of text until it is active, step 1 uses a "Change" link where steps 2 and 3 use buttons, and the "Change" link is low-contrast amber on the light background; step wording while signed in is journey #6 | X/panel/getting-started | 226, 230 | minor |
| 25 | Extension revoked | Settings says "This browser was approved earlier. Connect to check it still is." after the person removed it (journey #6) and shows "Connect" only inside getting-started | X/panel/getting-started/start/step-words.ts:14 | 253-256 | journey #6/#7 |
| 26 | Panel login (first run) | Disabled "Sign in" is a muddy brown at both widths, and at 390 the card is stuck to the top | W/app/AuthShell.tsx | 001, 004 | t927 (in flight) |
| 27 | Panel /settings/saved-logins | Page is a 404 | journey #8 | 155 | journey #8 |
| 28 | Panel pairing modal at 390 | Buttons 175 px tall | journey #9 | 237 | journey #9 |

## Findings grouped by fix folder

**U/ (shared tokens and base styles)**
- #15 scrollbar tokens (one `scrollbar-color`/`width` in `theme/tokens.css` for both clients).
- #5, #6 dock: the key card clip (the transcript scroller must not cut the card), one no-key card and one wording in `chat/` and `model-access/`.
- #13, #16 root cause of the inconsistent look: W/home and W/settings-page use hard-coded px/rem instead of the tokens; move them to tokens.

**W/app/styles**
- #8 dev pages at 390: 12-background-tasks.css, 17-database-explorer.css, global-programs/01 and 03.
- #10 modal footer rule: 15-modals-and-drawers.css:92-99.
- #2 toast placement: 04-feedback-and-status.css:1-9 (move below the bar or inset past the Account button; give errors a plain title).
- #19 Ask button: panel-shell.css:132-148.
- #11 modal rows: client-pairing-modal.css.

**W/features/<x>**
- chats: #1 (chat-rows.ts:22-23, ChatsPage.tsx:70), #18.
- settings-page: #3, #13 (720 px column), #17.
- panel-shell: #4 (reserve the second row at 390), #19.
- chat-widget: #5, #6, #18.
- automation-studio/hierarchy: #7, #12, #17.
- security: #13, #14.
- home: #16, #13.
- programs: #9.

**X/panel/<x>**
- projects and shell: #20, #21.
- automations and extraction: #22.
- settings: #23.
- getting-started: #24, #25.

## Layout shift (PerformanceObserver, 5 s, cold cache)

Main column box (`<main>`): 1440 is stable at x184 y49 w879 h851 on all four pages. 390: x0 y49 -> y89 at about 280-295 ms (every page), w373 constant.

| Page | 1440 CLS | 390 CLS | Biggest shift |
|---|---|---|---|
| Home | 0.034 | 0.128 | 390: top bar facts 0.059 at 295 ms; model key line 0.042 at 313 ms; 1440: home sections 0.011 at 520 ms |
| Chats | 0.009 | 0.061 | top bar facts 0.059 (390); dock 0.006 (1440) |
| Settings | 0.160 | 0.393 | 390: sections 0.276 at 338 ms; 1440: sections 0.124 at 403 ms plus 0.014 at 298 ms |
| Projects | 0.009 | 0.062 | top bar facts 0.059 (390) |

Settings is the only page over the 0.1 "needs work" line at 1440; Home, Chats, Projects and Settings are all over it or near it at 390 only because of the top bar (#4) and Settings (#3).

## What looks right

- Light and dark both render on both clients, with tokens following the website (amber on near-black ink, warm paper in light); no unthemed white flash found.
- No horizontal page scroll at 390 on the main routes; the eight-place bottom bar (4 x 2) stays readable and the dock opens full-screen behind "Ask".
- Empty, loading and error states exist on Home, Projects, Chats, Runs, Settings and Devices, each with a retry.
- Long names: titles clip with an ellipsis in project rows and the assistant title; a 95-character unbroken name does not break the layout.
- The extension fits at 360 with no overflow in any section; mid-pairing shows the code large and legible; the Settings humanness slider and appearance radios are styled, not native.
- Focus rings are visible (amber) on inputs and the modal's first field.

## Not verified

- A saved key (t928 in flight): chat with a key, key card states, Settings "Ready".
- Slot: `renew t925-sweep 60` at about 22:31 did not extend the hold; it queued me (place 8) and `status` no longer listed me as a holder. I stopped the queued renew, finished the pairing/devices/revoked captures already in progress (about 30 s of work, no new browser), then shut down. Left to do: extension disconnected by stopping Core, long messages in the extension chat, mid-flow responses, extension chat list with entries (it said "No chats yet" while the panel has 17: unverified whether chats are scoped per client by design).
- The Flows, Runs and Data pages have only empty states (no runs without a model); the Flow editor and run detail pages were not reached.
- Focus and scroll glitches beyond a visible-ring check; the project-label flip (#20) was seen once.
- Extension was the build in `apps/extension/dist/chrome` at the time (`build-info.json` version 0.1.0); another worker was editing source, so some extension items may already be fixed.
- Not checked on phones narrower than 390 or on Firefox.

## Cleanup

- Slot `t925-sweep` released (`heavy-slot.mjs release`; status afterwards shows only other holders); the renew I had started was stopped.
- Stopped: `run-fluxiq-web.mjs`, `pnpm start`, `next start` (3100) and the gateway (4877); the Playwright daemon exited on `STOP` (Chromium closed). Ports 3100 and 4877 are free.
- The sweep data is now in `EXT/.fluxiq` (17 projects, 17 chats, a removed browser). The previous data is in `test-runs/key-security-ux/fluxiq-journey-data/`.
