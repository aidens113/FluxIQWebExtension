# Panel UI audit (FluxIQ Core web panel, task t915 build)

Method: Playwright headed Chromium against http://127.0.0.1:3000, signed in as the test owner. 20 routes x dark/light x 1440/390 px (80 full-page screenshots), open states (create-project dialog, change-password dialog, mobile assistant sheet, login error, connect page), and DOM checks (default-looking controls, horizontal overflow, clipped text, odd icon sizes, classes with no rule). Scripts and screenshots: `C:/Users/osrs_/FluxStuff/fxwork/t915/!FluxIQWebExtension/test-runs/panel-ui-audit/` (`set-runtime-dark-390.png`, `i-*.png` open states, `m-*.png` mobile). CORE = `C:/Users/osrs_/FluxStuff/fxwork/t915/!FluxIQ`; W = `apps/web/src`.

Brand check: `packages/ui-components/src/theme/tokens.css` already carries the website palette (#0c0d0f, #111214, #f5b83d amber, Geist). The departure is not the tokens: most panel controls never use them (browser-default look) and several layouts are broken. Projects list, Chats list, dialogs, login card and the dock match the website's flat, hairline, amber look; the rest does not.

## Defect table (worst first)

| # | Route and state | What is wrong | Screenshot |
|---|---|---|---|
| 1 | Settings > Runtime, 1440 and 390 | Header row crushed into a 6-column grid ("Settings / Runtime / note / Technical details" side by side); at 390 the title wraps one letter per line beside a 500px-tall button. Section tabs, search, filter and row buttons are bare browser controls (grey 3D buttons, native select, label glued to input). Tables overflow at 390. | set-runtime-dark-1440, set-runtime-light-390 |
| 2 | Security > Your sign-in; Settings > Background Tasks, Database Manager | Panels squeezed into a 12-track implicit grid: empty 5px ghost block at left, Users card cramped, badges truncated ("Enab...", "O."), "Actions" clipped. Background Tasks: "Qu..." clipped, "0-0 of 0" wraps, "Snapshot loaded" line printed twice. Database Manager: record-detail text overlaps the table header, filter box clipped. | sec-signin-dark-1440, set-bg-dark-1440, set-db-dark-1440 |
| 3 | Phone bottom nav (every route, 390) | Seven labels do not fit: "Security" and "Settings" touch and clip at the edge. The Ask button floats over page content and last rows. | home-light-390, sec-signin-dark-390 |
| 4 | Light theme, rail active item (every route) | Amber `--accent` text (#f5b83d) on `--accent-soft` (#fbefd0): roughly 1.7:1, barely readable. | data-light-1440, runs-light-1440 |
| 5 | Top bar project switcher (every route, both themes) | Native `<select>` with OS arrow, square corners, plain white/grey fill, different from every other control. The most visible control on every page. The package ships a styled project switcher the panel does not use. | top-left of any shot |
| 6 | Settings AI keys form, Security invite form, Chats search, Flows "New project", Sign out/Forget | Inputs, selects and buttons unthemed: 2px inset grey border, 0 radius, default arrow, flat brown disabled button. Chats search placeholder clipped and the field floats mid-page with its label above. | settings-dark-1440, chats-dark-1440, flows-dark-1440, security-light-1440 |
| 7 | Home > Connected card | "Connected" line indented to mid-card while sibling rows are left-aligned. | home-dark-1440 |
| 8 | Login (and mobile) | Password label wraps its required asterisk onto its own line (Username does not). At 390 the card fills the screen with a large empty gap above it. | probe.png, m-login-error-light-390 |
| 9 | Mobile assistant sheet | "Close" is an unstyled grey default button. | m-dock-open-dark-390 |
| 10 | Loading states (Runs, Data, Docs) | Plain "Loading your runs..." text for 2s+, no skeleton. Docs three panes are about 250px each beside the 360px dock, so text wraps heavily. | data-light-1440, late-docs |
| 11 | Chat thread, 390 | A `<time>` element overflows the viewport; title row and Chats/New chat buttons wrap onto two lines. | chat-dark-390 |
| 12 | Tables at 390 (Keys, Sign-in, Background, Database, Deployment) | Header row clipped, scroll bar the only cue; 7px status-badge icon (`status-badge-pill tone-neutral`). | sec-keys-dark-390 |
| 13 | Desktop assistant dock | Always open, no way to close at 1440: the page column is about 830px, which drives 2 and 10. | all 1440 shots |
| 14 | /nope-404 | Default minimal page, not the panel chrome. | notfound-dark-1440 |

Not found: no stylesheet 4xx, no console errors, both themes apply (`data-theme` from localStorage `fluxiq-theme`). The create-project and change-password dialogs are well styled in both themes.

## Causes in code

- Defects 1, 2, 7 (shared cause): `W/app/styles/global-foundation/09-panels-and-pagination.css` lines 6-19 and `13-operations-and-deployment.css` lines 80-92 give `.workspace-panel` `grid-column: span 6` (`:first-child` span 12). They assume the 12-column `.program-workspace-grid` parent, but panels now render inside plain blocks (`.settings-tool`, `.identity-access-workspace`, `.identity-users-layout`). The browser creates implicit columns (measured: `.settings-tool` 6 tracks, `.identity-users-layout` 12 tracks, most 0px). Fix: scope the spans to `.program-workspace-grid > .workspace-panel`.
- Defect 1 (controls): `W/features/settings-page/tools/runtime/RuntimeLive.tsx` renders classless `<nav><button>`, `<label><input>`, `<select>`; `RuntimeInventory.tsx` row buttons likewise.
- Defects 5, 6 (root): `W/app/styles/global-foundation/01-tokens-and-reset.css` sets only `font: inherit` on `button, input, textarea, select`. No base border, radius, fill, colour, focus or select arrow; styling exists only where a component adds `.field > input`, `.button`, `.combobox`. Any raw element gets the browser default: `W/features/panel-shell/top-bar/ProjectSwitcher.tsx`, `W/features/chats/ChatsPage.tsx` line 48, `settings-page/ui/AddKeyForm.tsx`, `accounts/invite/InviteForm.tsx`, about 20 raw `<select>` in `features/automation-studio`, `panel-dock-close`, `.security-button` (`features/security/security.css` line 16). `panel-shell.css` line 30 sets only `min-height`.
- Defect 3: `W/features/panel-shell/panel-shell.css` (max-width 720px block): `.panel-rail li { flex: 1 1 0 }`, 12px text, 7 links in 390px.
- Defect 4: `panel-shell.css` line 56, `.panel-rail-link[aria-current="page"] { color: var(--accent) }`; the token for text on a wash is `--accent-text`. Hard-coded px spacing and radii throughout `panel-shell.css`, `settings-page.css`, `chats.css` instead of `--space-*` and `--radius-*`.
- Defect 8: `W/app/AuthShell.tsx` line 229, password label has a trailing `<span>*</span>` inside `.field-label` (rules in `global-foundation/03-auth-and-fields.css`).
- Defect 9: `W/features/panel-shell/dock/AssistantDock.tsx` line 39, `panel-dock-close` has only `display` rules.
- Defects 10, 13: fixed `360px` dock column in `panel-shell.css`; plain-text loading in the Runs and Data pages.
- Defect 11: chat `<time>` lacks `min-width: 0`/wrap in `W/features/chats/chats.css` or the package's chat.css.

## Fix plan (four briefs, disjoint folders)

1. **Tokens and base styles** (first). Owns `W/app/styles/**`, `W/app/globals.css`, `W/app/AuthShell.tsx`, `W/app/not-found.tsx` if present. Add one low-specificity base layer for bare `button, input, select, textarea` (token border, `--radius-control`, `--surface` fill, `--text`, focus ring, custom select arrow, hover/disabled) so classed components still win. Scope the `.workspace-panel` spans under `.program-workspace-grid >`. Fix label asterisk wrap and 390px login layout. Check: `pnpm --filter web test panel-tokens`, structure audit, re-screenshot defects 1, 2, 5, 6, 8.
2. **Shell and navigation**. Owns `W/features/panel-shell/**`. Replace the native project select with the package `project-switcher` (or style it), `--accent-text` for the active rail item, phone bottom nav that fits (icons or scroll), page bottom padding for the Ask button, style `panel-dock-close`, optional collapsible dock on desktop, tokens instead of px literals. Needs brief 1's base layer.
3. **Settings, Security and tool pages**. Owns `W/features/settings-page/**`, `security/**`, `accounts/**`, `programs/**`. Give `RuntimeLive`/`RuntimeInventory` real classes (`segmented-control`, `.field`, `.button`), use `.button`/`.field` in AddKeyForm, InviteForm, Sign out/Forget, remove the duplicated Background Tasks line, stack three-pane tools (Users, Task detail, Database, Docs) below about 1100px of available width, fix 7px badges and table min-widths at 390.
4. **Home, Chats, Projects, Flows, Runs, Data**. Owns `W/features/home/**`, `chats/**`, `projects/**`, `flows/**`, `runs/**`, `data/**`, `W/app/(panel)/**`. Fix Home "Connected" alignment, Chats search layout, Flows "New project" form, chat `<time>` overflow and 390 header wrap, skeleton/empty states for Runs and Data. Shared chat rendering changes go to `CORE/packages/ui-components/src/chat/**` (cross-repo rule: chat renders in Core).

Order: 1, then 2, 3, 4 in parallel (disjoint folders). Each re-runs the screenshot matrix (`shoot.mjs` and `routes.json` in the audit folder) for its routes.

## Gaps

Flow editor, graph, run detail, a populated Runs/Data table, the pairing modal and the project "..." menu open state were not reached (test data has no Flows or runs; the "..." and security-dialog selectors timed out). Hover and keyboard-focus states were not audited beyond the amber input focus ring (looks right). Contrast ratios are by eye plus the token table, not computed. No dock open/closed toggle exists at 1440.

Outcome: Done (gaps listed above)
Changed: none in source; wrote this report and test-runs/panel-ui-audit/ scripts and screenshots (git-ignored)
Validation: `curl .../api/ready` -> 200; Playwright matrix of 20 routes x 4 combinations ran (report-main.json); causes confirmed by computed styles (`.settings-tool` 6 tracks, `.identity-users-layout` 12 tracks, rail active colour rgb(245,184,61), settings input border 2px inset)
Not verified: flow editor/graph, run detail, "..." menus, pairing modal, hover/focus states, measured contrast ratios
Report: C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/usable-client-plan/reports/panel-ui-audit.md
Notes: Credentials read from the credential file, never printed. state.json in the audit folder holds a session cookie; the folder is git-ignored.
