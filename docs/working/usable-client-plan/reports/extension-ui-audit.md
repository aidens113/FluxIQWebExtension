# Extension UI audit (side panel and popup)

Date 2026-11-16. Build audited: `fxwork/t915/!FluxIQWebExtension/apps/extension/dist/chrome` (sidepanel and popup bundles built 12:50). Headed Chromium, fresh profile, 360, 400 and 480 px, dark and light, one pairing approved through the panel at 127.0.0.1:3000.
Screenshots: `fxwork/t915/!FluxIQWebExtension/test-runs/extension-ui-audit/` (`unp-*` unpaired, `p-*` paired, `popup-380.png`, `panel-pairing-modal.png`). Metric logs: `unpaired-metrics.log`, `paired-metrics.log`.

## Outcome in one paragraph
The tokens already match the website (same amber, Geist, mono labels; `ui-components/theme/tokens.css` is imported by `panel/theme/tokens.css`), no screen overflows horizontally at 360, 400 or 480 (scrollWidth equals viewport everywhere), and no browser-default buttons or inputs were found by the computed-style check. The remaining defects are specific: a header that wraps badly between about 461 and 540 px, a border that should not be on Settings, duplicate New chat buttons, an invisible-looking Advanced control, a black slider track in light theme, a blank Library pane, bold URL inputs, and bare "Something went wrong." wording.

## Defects, ranked by harm to a person
| # | Where / state | Screenshot | What is wrong | Cause |
|---|---|---|---|---|
| 1 | Header at 480 (400-540 range, any screen, both themes) | `unp-home-480-dark`, `p-chat-empty-480-light` | Brand and tabs fill row 1; dot, Settings and Open FluxIQ drop to a second row at the far left. Looks broken; costs 48 px of height. At 360-400 it is fine (tabs own row). | `shell.css` `.top-bar{flex-wrap:wrap}` plus the tab-row rule only under `max-width:460px`; the project switcher button has a wide min-content, so 461-540 px wraps the actions instead of tabs. Needs a container-based or wider breakpoint. |
| 2 | Chats list open (chat) | `p-chats-list-360-dark` | Two amber "New chat" buttons stacked (one in the chat bar, one inside the list). Two primary actions, 80 px wasted. | Core `chat/view/thread-header.ts` (`chat-bar-new`) and `chat/view/thread-list/conversation-list.ts` (`chat-thread-new`) both show when the list opens; the bar's button is not hidden while the list is open. |
| 3 | Settings button, every state, both themes | `unp-home-360-dark`, `unp-home-480-dark` | Settings shows a visible outlined border while the neighbouring gear and arrow icons do not; the intent (`border-color:transparent`) is lost. | `shell.css`: `.top-settings{border-color:transparent}` is declared before `.small-button{border:1px solid var(--edge)}` at equal specificity, so the later rule wins. Icon buttons were fixed with a `.top-actions` prefix, this one was not. |
| 4 | Settings > Advanced | `p-settings-bottom-360-dark` | The "Advanced" row has no chevron or marker, so nothing says it opens. Hidden section looks like a static label. | `settings.css` `.settings-advanced > summary{display:flex}` removes the native disclosure marker; no replacement icon. |
| 5 | Settings > Advanced fields | `p-settings-advanced-360-dark` | The two address inputs render in bold (650); hints below are regular. Looks like a heading, not an editable value. | `shell.css` `.field{font-weight:650}` inherits into the input (`input{font:inherit}`); `settings.css` styles only `input[type="url"]`, not `type="text"` (the ws address), and sets no weight. |
| 6 | Library segment (Automations), light | `p-automations-library-400-light` | After selecting Library the pane is a blank off-white strip: no empty message, no loading text, a block of a different colour on the canvas. | Core `screens/library/library.css` / empty state shows an empty container while loading or empty; panel gives it no placeholder. |
| 7 | Humanness slider, light theme | `p-settings-360-light` | The range track is near-black in light theme (thumb amber); in dark it is grey. Heavy, off-brand. | Core `chat/controls/humanness/humanness.css` styles only `accent-color`; Chrome picks the native track colour from `color-scheme`. Needs `::-webkit-slider-runnable-track` and `::-moz-range-track` on `--edge`/`--divider`. |
| 8 | Unpaired project switcher; Automations paired | `unp-switcher-360-dark`, `p-automations-360-dark` | Unpaired: the sheet says "Something went wrong." with Try again; the person has not done anything wrong and should be told to connect. Automations shows the same bare line in an amber notice above a disabled "New automation" card. | Core `project-switcher` error copy and the panel's `automations-tab.ts` fallback are generic; neither knows the "not paired" state. |
| 9 | Disabled buttons (Automations "Show FluxIQ how", "Extract Data", Disconnect, Send) | `p-automations-360-dark` | Labels are hard to read in dark theme (opacity .48 over a transparent button), so the reason text under them is easier to read than the buttons. | `shell.css` `button:disabled{opacity:.48}` and Core `.chat-panel button:disabled{opacity:.48}`: whole-control fade instead of disabled tokens; muted text at 48% falls well under 4.5:1 (not measured). |
| 10 | Tabs and chat context row (chat) | `p-chat-empty-360-dark` | Three stacked header rows (bar, tabs, "All projects / Chats / New chat") use about 160 px of 760 before any content; tabs look like plain text with no pill or underline except bold weight. | `shell.css` `.top-tab.active{background:transparent}` (weight only); Core `.chat-context` row. |
| 11 | Chat page background (light) | `p-chat-empty-480-light` vs `p-automations-library-400-light` | Chat sits on cream `--surface`, other screens on beige `--canvas`; switching tabs flips the page colour. | Core `.chat-panel{background:var(--surface)}` against `shell.css` `.shell{background:var(--canvas)}`. |
| 12 | Native scrollbars | `p-settings-light`, `unp-chat-480-dark` | Windows-style scrollbar with end arrows and a light track in dark theme on Settings (visible at 480). | Only `:root{scrollbar-color}` in Core `theme/tokens.css`; not re-applied on `.settings-screen`, `.automations-screen`. Cause not verified in computed styles. |
| 13 | Getting-started marks | `unpaired-360-light` | Steps 4 and 5 have no body text when To do; the vertical line passes behind step marks fine. Minor: "Next" and "To do" labels are dim 11 px. | `getting-started.css` `.start-state` 11 px muted. Minor, no fix required for usability. |

No focus ring problems found: shell, settings, automations, switcher and the chat all set `:focus-visible` outlines in tokens. Contrast was checked by the token comments in `tokens.css` (all text pairs at least 4.5:1) apart from item 9.

## Where it departs from the website
Dark theme: same colours, Geist, mono uppercase section labels, amber primary. Differences: the website is dark only (`color-scheme: dark`), the extension adds a derived cream/beige light theme, which is where items 7, 11 and the scrollbar mismatch show. The website has no tab row, project switcher or disclosure rows to compare; the plain-text tabs (item 10) and a native-looking slider and scrollbar (items 7, 12) are the least website-like parts.

## Fix plan (three briefs, disjoint folders)
1. **Extension shell and getting-started** (owns `apps/extension/src/panel/shell/`, `getting-started/`, `theme/`): items 1, 3, 9 (panel buttons), 10 (tab active state), 11 (canvas vs surface decision, coordinated with brief 3), 13. Add a width test or screenshot check at 360, 400, 480 and 520.
2. **Extension settings and automations** (owns `apps/extension/src/panel/settings/`, `automations/`, `tasks/`, `library/` adapters): items 4, 5, 8 (automations wording, not-paired copy), 12 (scrollbar-color on its scroll containers), Library placeholder text from the adapter side of item 6. No shared files with brief 1; `settings.css` and `automations.css` are separate from `shell.css`.
3. **Core ui-components** (owns `!FluxIQ/packages/ui-components/src/chat/`, `project-switcher/`, `screens/`): items 2, 6 (Library empty/loading state), 7 (slider track), 8 (switcher not-paired copy via a port flag), 9 (disabled style), 11. Core is a repository boundary: alert the user before the first edit, follow Core's AGENTS.md, then rebuild the extension.
Order: briefs 1 and 2 run in parallel on the extension; brief 3 in its own Core worktree, then a re-run of this audit script.

## Not verified
- Chat message flow: the chat stayed on "Loading the conversation..." and the project sheet on "Loading projects..." for the whole paired run (the test panel was answering in 15-22 s per page, shared with other workers), so an empty chat, a sent message, the Chats list contents, the no-key setup message and a populated project sheet with search results were not exercised. Items 2 and 10 are from the loading state.
- Spacing and contrast numbers for item 9 are by inspection, not measured. Item 12's cause is not confirmed.
- Firefox popup only checked unpaired (`popup-380.png`).
- Light and dark were switched by setting `data-theme` on the root, not through the Settings radio (the radio itself renders correctly in both).

## Deviations from the brief
- The wait condition "manifest newer than the wait start" never held: the manifest is only rewritten when it changes (still 10:06) while the bundles were rebuilt at 12:50 and the panel answered 200, so I audited after waiting 35 minutes.
- Pairing took many attempts: the test panel's sign-in button stays disabled if the fields are filled before the page hydrates. A pairing is lost when the browser closes, so the paired sweep ran in the same session as the approval. The credential was read from file and never printed.
- A stale Chromium locked the first profile, so later runs use `profile-b` under the same folder (ignored run artifacts).

```text
Outcome: Partial
Changed: none in source; audit artifacts only under C:/Users/osrs_/FluxStuff/fxwork/t915/!FluxIQWebExtension/test-runs/extension-ui-audit/ and the report
Validation: `node uiaudit/unpaired.mjs` and `node uiaudit/all3.mjs` (Playwright, scratchpad) -> 30 unpaired and 60 paired screenshots, scrollWidth equals viewport at all widths, no browser-default controls flagged, pairing approved ("clicked confirm", extension showed the connected header with a green dot)
Not verified: chat messages, sent message, Chats contents and no-key setup message (chat stuck on "Loading the conversation..." on the slow test panel); contrast ratios for disabled controls; Firefox paired popup
Report: C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/usable-client-plan/reports/extension-ui-audit.md
Notes: Top defects are the 461-540 px header wrap, duplicate New chat in Core, and the Settings border cascade bug.
Notes: The test panel was very slow (15-22 s per page) during the run, which blocked the chat checks.
```
