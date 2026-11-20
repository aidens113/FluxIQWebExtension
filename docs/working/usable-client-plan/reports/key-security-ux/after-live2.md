# after-live2 report (t925)

## Outcome
Done. Journeys A-D re-run live and the Settings pass ran in both clients (light and dark, panel 1440 and 390, extension 360, a saved value in each section). No source edits. Slot `t925-live2` released; every process I started is stopped; ports 3100 and 4877 are free (never 3000, 4777, 4000).

## Setup facts
- Gate: `checks5.log` showed `t925-extbuild9 exit=0` before I took a slot. Slot held about 23:51 to 00:20 (queue wait about 2 h; no renew needed).
- Panel build ran with no heap override and passed (t951 holds). Panel 3100, gateway 4877, headed Chromium, fresh profile `after-live2/profile`, extension unpacked, side panel opened as a 360 px tab.
- `EXT/.fluxiq` moved (not deleted) to `test-runs/key-security-ux/fluxiq-live1-data/`. This run's data is the new `EXT/.fluxiq`. Owner `owner`; password in `test-runs/t925-panel-credential.txt` (never printed).
- Shots: `EXT/test-runs/key-security-ux/after-live2/shots/` (172 PNGs, `NNN-<step>-<width>-<light|dark>.png`). Before shots: `.../after-live/shots/`. Logs: `after-live2/logs/`.
- Header tabs found by `getByRole("tab", {name:"Chat"})`: count 1 (new defect 7 fixed).

## Journey timings (round 1 vs round 2)
| Step | Round 1 | Round 2 |
|---|---|---|
| Setup link to signed in | 2.3 s | 2.15 s (a01, a03) |
| Extension finds FluxIQ on 3100 | needs Change + type + Check, 3.0 s | same, 3.04 s (a04, a06). Test-port only |
| Approve in the panel, extension flips | 0.3 s after Confirm | 0.29 s (a08) |
| Extension key save to Ready, both clients | 1679 / 1681 ms | 3189 / 3191 ms (slower by about 1.5 s; a14, a15) |
| First message, extension | 3.1 s, "Hi there, I'm up and running and ready to help you build, improve, or run your FluxIQ Flows!" | 3.07 s, same first words (a17) |
| First message, panel with no project | 2.5 s | 2.56 s, "Hi there, I'm working and ready to help you with FluxIQ whenever you need!" (b02) |
| Replace with fake key: "Not accepted" panel / extension | 310 / 311 ms | 284 / 286 ms (c04, c05) |
| Remove: "No key" panel / extension | 174 / 176 ms | 145 / 147 ms (d02, d03) |

Replace and Remove now ask for no password: Replace is one field plus "Replace key"; Remove is one press then "Remove key" (c02, d01). Adding a first or another key: no password.
The Ready time is the only regression. Cause guess: the save now checks with the provider before answering; not traced.

## Settings before / after
Before = `after-live/shots/`, after = `after-live2/shots/` (round 1 "E. Settings jank list").
| # | Item | Verdict | Before | After |
|---|---|---|---|---|
| 1 | Appearance radios | Fixed: chips 83x32, 84x32, 100x32, accent when checked | e02-*, e06-theme-dark-chosen-* | 097/098-f05-appearance-dark-1440, 149/150-h04-advanced-open-1440 |
| 2 | Allowance row | Fixed: input, Save, Use the usual amount in one row, buttons 32 px | e02-* | 137-h01-settings-keyed-fake-1440-light |
| 3 | Humanness slider | Better: styled track and thumb, label "Level", value beside it, helper 13 px; the range input still has no accessible name | e06-humanness-changed-* | 093-f04-humanness-changed-1440-light, 094 (dark) |
| 4 | "Saved." lines push down | Fixed: allowance and model saves move headings 0 px (688/981/1244 before and after) | e06-allowance-saved-* | 085-f02-allowance-saved-1440-light, 089-f03-model-saved |
| 5 | 31 px heading jump | Fixed: not reproduced, 0 px | e06-* | f02, f03 |
| 6 | Stale "default key was removed" | Fixed: true after the remove (d02), gone after a key is added (e04 text) | e04-* | d02-panel-no-key (note shown, true), e04-panel-fake-added (note gone) |
| 7 | Three boxes for one key state | Better: one box with hairlines (card then list); the card still stacks pill, sentence, three buttons | c01, c02, e04-* | 137-h01-settings-keyed-fake-1440-light, 143-h02-add-another-key-390-light |
| 8 | Key row wraps at 390 | Better at 1440 (grid: name, provider, chip, buttons); 390 row only glimpsed in the h02 shot | e04 390 | 139-h01-settings-keyed-fake-390-light |
| 9 | Replace form | Better: password gone; submit still disabled with no hint until a key is typed | c02-* | 145-h03-replace-form-1440-light |
| 10 | Add another key | Fixed: Provider, Key, Name, Save and check, Cancel; no password input | e05-* | 141-h02-add-another-key-1440-light, 143 (390) |
| 11 | Select heights | Better: both Settings selects 38 px at 1440 and 390 (token 36 px, border box 38); tool-page selects not measured | e02, e07 | g03 step; 111-g01-tool-database-manager-390-light |
| 12 | Engine-tools links, empty names | Fixed: 0 unnamed links on all 8 tool pages | control list in e02 | g01 step |
| 13 | Advanced triangle | Fixed: chevron, up when open | e07-settings-advanced-open-* | 149/150-h04-advanced-open-1440 |
| 14 | Tool pages at 390 | Fixed: scroll width 379 on all 8, nothing past the viewport, no one-letter buttons; Deployment Sync 9,725 px (was about 38,000); Runtime no raw id; database stores read Tasks, Nodes, Users (Locked) with a table icon; Docs no route kicker | e07-tool-runtime-390, e07-tool-deployment-sync-390 | 119-g01-tool-runtime-390-light, 107-g01-tool-deployment-sync-390-light, 111-g01-tool-database-manager-390-light |
| 15 | Extension checkboxes vs segmented | Fixed: one family (18 px marks, tick), segmented 28 px | e08-* | 157-x03-ext-permissions-360-light, 158 (dark) |
| 16 | Extension humanness shift | Unchanged: the rest still moves 19 px down. The status line is reserved (18 px) but the label "Starting humanness for new Flows and tasks" wraps from 19 to 38 px when the value goes to two digits (x08 step) | e08-* | 155-x02-ext-humanness-360-light |
| 17 | Advanced hint and draft bar | Better: hint "Where this browser connects to FluxIQ."; bar names the change ("Not saved yet: Starting humanness, Record page snapshots."); Save clears it with "Saved." in 1.5 s. The bar is a sticky foot about 130 px of 760 | e08-* | 164-x06-ext-advanced-360-dark, 157 |
| 18 | "Report a problem" shift | Unchanged: Advanced still moves 43 px when the report appears ("Save report" plus a two-line sentence exceed the reserved line) | e08-* | 161/162-x05-ext-report-360 |

New defect 1 = row 6, Fixed. New defect 3 (password on Replace, Remove, Add another): Fixed (c02, d01, h02). New defect 7 (tabs not found by role): Fixed.
Coverage: panel AI keys, assistant, spending, connect, humanness, appearance, Advanced, 8 tool pages, Your sign-in (g02); extension Connection, AI key, Behaviour, Permissions, Appearance, Report, Advanced. Saved: allowance 0.40 (persisted), model changed, humanness 10, theme Dark then System (panel); humanness, status "Small", snapshots off, theme, Save changes (extension).

## New defects and things that look off (cause guesses)
1. Extension humanness label wraps at two digits (row 16). Cause: label and value share a row; the value widens.
2. Extension "Save report" adds an action and sentence beyond the reserved line (row 18). Cause: one line reserved.
3. A rejected key still reads "Anthropic · Turned on" and "Replaced Anthropic key."; after adding a key the old "Removed Anthropic key." line stays under the card. Cause: key stored and status written before the check; the action note is never cleared.
4. Panel "The assistant" block: the label "The assistant uses" sits lower than the "Key" and "Model" captions (h01 1440). Cause: fields align to the bottom; the caption is not part of the label.
5. Allowance reads "0.4" after save, not "$0.40". Cause: raw number shown.
6. Humanness range input has no accessible name in the panel. Cause: visible "Level" not tied to the input.
7. Database Manager lists "Targets" twice (111 shot). Cause not traced.
8. Runtime tab row wraps into two uneven rows at 390 (119 shot). Cause: wrapped tabs keep their borders.
9. Extension "Settings" header button toggles: pressing it on Settings returns to Chat (timed out one of my steps). Maybe intended; the gear is not marked pressed.
10. Extension console: 2 ERR_CONNECTION_REFUSED lines at start (probing 3000). Test-port only.
11. The extension needs the address step on any port except 3000 (round 1 defect 5).

## Counts and cleanup
- Paid model calls sent by me: 2 (one message in the extension, one in the panel). The real key was also saved once, which runs a provider check; its billed calls are not countable here.
- Real key: typed once into the extension's key form through the daemon (it scrubs output), replaced by a fake key in the panel, removed; a second fake key was added and removed. Final state "No key" in both clients (z01).
- Key scan of `after-live2/` (profile included) plus `t925-panel-live2.log`: 503 files, full-key matches 0, last-12-character matches 0. Key count: 0.
- Needs-you endpoints: no non-200; no HTTP 4xx/5xx recorded.
- Stopped: the daemon (Chromium closed, 0 chrome processes), `run-fluxiq-web.mjs`, pnpm, `next start` (chain 12776 to 4936) and the gateway; ports 3100 and 4877 free. Slot `t925-live2` released.
- Left in place: `after-live2/` (daemon.mjs, step.sh, shots, logs, profile), `test-runs/t925-panel-credential.txt`, `EXT/.fluxiq` (this run's data), `fluxiq-live1-data/`.

## Not verified
- The 390 key row in a stand-alone view (row 8); tool-page select heights (row 11); the Ready slowdown cause; whether the Settings toggle (new 9) is intended; the approved-client proof (not in this brief).
- All shots exist in light and dark; I opened about ten, the rest are covered by script measurements only.
