# after-live report (t925)

Outcome: Partial. Journeys A-D and the Settings pass (E) ran live and met their main goals. The approved-client proof was NOT run: the
permission system denied the command (see Proof). Slot released, every process I started is stopped.

## Setup facts
- Slot `t925-live` held about 17:02-17:31 PST of this clock (renewed once at 17:26), released at the end. Queue wait was about 35 min.
- The panel's web build first died with a V8 out-of-memory (heap 2 GB, exit 134) in `next build`. Not the earlier UTF-8 fault (ProjectBrowser.tsx is valid now).
  I relaunched with `NODE_OPTIONS=--max-old-space-size=3584` (environment only, no source edit); the build then passed and the panel served 200 at 17:20.
  A cold build on a default 2 GB heap meets the same crash (cause guess: Turbopack building the whole web app in one worker).
- Panel 3100, gateway 4877 (never 3000/4777/4000). Headed Chromium, fresh profile `after-live/profile`, extension unpacked, side panel opened as a 360 px tab.
- Fresh data: the leftover `.fluxiq` of the failed attempt (config only) was moved to `test-runs/key-security-ux/fluxiq-failed-run/`.
- Owner `owner`; password in `test-runs/t925-panel-credential.txt`. (I printed the OLD sweep password from that file once by mistake before overwriting it; it belonged to dead sweep data. The new one was never printed.)
- Screenshots: `test-runs/key-security-ux/after-live/shots/` (186 PNGs, `NNN-<step>-<width>-<light|dark>.png`; panel 1440 and 390, extension 360). Logs: `after-live/logs/`.
  The panel follows the device theme now (body `rgb(246,243,238)` in light), so light and dark are both real.

## Journeys: steps and timings (before = journey audit, after = this run)

### A. Extension first
| Step | Before | After |
|---|---|---|
| Setup link, choose name + password | admin/admin detour, 2 sign-ins, about 4 typed fields, 2 screens | 1 screen (a01), 3 typed fields, 1 click, landed in 2.3 s |
| Extension finds FluxIQ | Done by itself on 3000 | On 3100 it says "FluxIQ isn't answering at 127.0.0.1:3000" and needs Change + type + Check and save (2 clicks, 1 field, 3.0 s). Test-port only. |
| Connect and approve | 2 steps, Connect click, false "Connected" | one step "Connect and approve"; request and code (428897) shown by itself once the address was saved, no Connect click (a06) |
| Approve in the panel | modal, 175 px buttons at 390 | modal already open on Home with the same code (a07); 1 click; extension flipped 0.3 s after Confirm (a08) |
| Add the key | dead end | Extension Settings > "Add a key": provider, key, Save and check (2 clicks, 1 field). Extension AND panel (on Home, no reload) read Ready 1.68 s after the save (1679 ms / 1681 ms) (a13-a15) |
| First message in the extension | "No model key is set up yet" | reply in 3.1 s: "Hi there, I'm up and running and ready to help you build, improve, or run your FluxIQ Flows!" (a17) |

Totals to the first reply (excluding the test-port address step): 5 clicks, 4 typed fields (name, password, confirm, key) plus the message, 3 screens (setup, panel approval, extension).
Before: about 12 clicks, 6 fields, 5 screens. The extension's chat card only offers "Open FluxIQ"; the key form is in Settings > AI key ("Add a key" there), not in the chat card itself.

### B. Panel, no project selected
Header "Choose a project"; the assistant box was enabled; 1 field + Enter; reply in 2.5 s: "Hi! I'm working and ready to help you with anything in the FluxIQ panel." (b02).
Before: box disabled, 4 extra steps to make a project.

### C. Fake key via Replace
`sk-ant-` + random. Replace asks for the new key AND "Your password" (2 fields). Both clients read "Not accepted" 310 ms (panel) / 311 ms (extension) after the save answered (c04, c05):
"Anthropic did not accept Anthropic key. Check that it was copied in full." Adding a fake key as a first key (no password) read Not accepted in 266 / 268 ms.
Odd: the panel also says "Replaced Anthropic key." and the row still reads "Anthropic · Turned on".

### D. Remove
Remove asks for the password (1 field), then "Remove key": both clients read "No key" 174 ms (panel) / 176 ms (extension) after the click (d02, d03).
Home, Settings > AI keys and Security (Your sign-in, Devices and apps, People, Activity) all rendered (d04-d06). Activity reads "owner removed a key.", "owner replaced a key." and, for the fake key,
"owner added a key." (never "could not ..."), plus raw action names ("owner send panel message.", "append turn.", "open conversation.", "save model key."), a raw project id, and about 8 "owner used a key." lines per message (e05c).

## Comparison with the before audits (observed in the live run; not every item was re-run individually)
Fixed: P1 and journey 4 (setup page with instructions, no admin/admin: a01); P2 (no temporary password); P5-P6 (dock says "Add an AI key", the same card: e02 tall);
P7-P9 (one key form, in Settings and Home; Security has no Keys tab); P8 (no password for the first key); P10 (key row is a card: c01); P11 (a bad key reads "Not accepted": c04);
P12 (dock enabled with no project: b01); P13 (reply works); P15-P16 (Replace and Remove exist in Settings, still behind a password); P17-P18 (model and allowance save and persist);
E1, E3, E9-E12 (the extension has the key form, live key state and a reply); E5 (one connect step); E7 (modal "Chrome on Windows wants to connect": a07); E8 (panel Home showed "Online" without a reload: a09);
journey 1, 2, 5 (a project "My automations" exists after pairing), 8 (Saved logins page renders: e07-tool-saved-logins), 10-13 (theme follows the device); sweep #5-#6 partly (one no-key card style in e02 tall).
Better: P37 and sweep #26/#28 not rechecked beyond e02; E6.
Unchanged: P14, P19, P23-P36 (Security still has "Change capitals in your sign-in name" and "Set up two-step sign-in"; Activity still shows raw names, P32); E2 (Advanced still says
"Usually ws://127.0.0.1:4777/client" and shows two addresses); sweep #8-#9 (dev pages, raw ids, overflow: see E14); journey 3 and 14.
Worse: none observed. Not reached: P3-P4, P20-P22, P25, P27, P33-P35, E14-E15, E17-E22, sweep #1-#4, #7, #10-#25, #27.

## New defects (with cause guesses)
1. Stale warning: after the key is removed and another is added, "Your default key was removed, and there is no other model key. Add one in Settings." stays in Settings (e04). Cause: a note kept in the AI-keys section state, cleared only on reload.
2. A "Not accepted" key still reads "Anthropic · Turned on", "Replaced Anthropic key." and Activity "added/replaced a key". Cause: the save stores the key first and checks after; the status and audit are written from the store step (journey fix 10 unchanged).
3. Replace, Remove and "Add another key" still ask for "Your password" (the first key does not). Against "no extra steps" (decision for the lead).
4. "Save and check" answers in under 2 s and says "It last answered just now", so the check looks like a provider call; Activity shows about 8 "used a key" lines per message. I cannot tell how many billed provider calls ran: I sent exactly two messages, so the real count may be higher.
5. The extension needs the address step on any port but 3000 (a04).
6. The production panel build needs more than the default 2 GB V8 heap (Setup).
7. In extension Settings the header tabs were not found by role (`getByRole("button",{name:"Chat"})` timed out) though they render; possible accessible-name or inert-region fault (X/panel/shell).

## E. Settings jank list (before the fix step)
W = Core `apps/web/src`, X = extension `apps/extension/src`. The panel Settings sections are client code in W; only the assistant dock comes from `@fluxiq/ui-components`.
1. Appearance radios (W/features/settings-page/appearance/AppearanceSection.tsx:20): native 16x16 radios with the label below each, no frame; unlike the extension's chip radios (e02 tall; audit `appearance=auto`).
2. Allowance (W/.../ui/AllowanceSection.tsx): input 520 px wide at 1440, but "Save" and "Use the usual amount" are full-column stacked buttons: ragged widths (e02).
3. Humanness slider (W/.../humanness/StartingHumannessSection.tsx): thin dark track, tiny thumb; the bold label repeats the section title; the value "0" sits far right; 11-12 px helper lines (e02, e06-humanness).
4. "Saved." lines (AllowanceSection.tsx:21, AssistantModelSection.tsx:18, humanness) each insert a row and push everything below down about 20 px (Spending per message 738 -> 758; Appearance 1356 -> 1377; layout-shift entries 0.002-0.007). Fix: reserve the line.
5. In the allowance save pass headings moved 31 px (status row or scroll anchoring); recheck in the fix step.
6. The stale warning (new defect 1) is a full-width box with a border colour unlike the key card above it (e04).
7. Key card (c01, c02, e04): pill + sentence + button in one bordered card, a second bordered note, then the list: three boxes for one state.
8. Key list row (W/.../ui/KeyList.tsx:36): radio, name button, "Anthropic · Turned on", "Default", Replace, Remove on one line; wraps at 390 (e04 390).
9. Replace form (c02): "New key" and "Your password" stacked; submit disabled with no hint why; Cancel differs in height.
10. "Add another key" (e05): a disclosure row then Name, Provider, Key, Your password; two password inputs have no accessible label (audit `?`).
11. Selects: 34 px high in Settings, 38 px in the database tool, 32 px in Saved logins: three heights.
12. Nine Engine-tools links have empty accessible names (control list shows `a ""`).
13. Advanced uses the native disclosure triangle; the extension uses a chevron.
14. Tool pages at 390: /settings/runtime has four controls past the viewport by 134 px (Refresh Runtime, Transports and adapters, filter, Next page) and a raw id "runtime.edf3b2d5-..." (e07-tool-runtime).
    /settings/deployment-sync: each commit-hash button is 14 px wide and 250-390 px tall (vertical text), "Rollback" 38x154, branch buttons 92x81, about 60 rows (38,000 px page) (e07-tool-deployment-sync).
    /settings/database-manager: "T" letter icons, "Locked", `identity.users`, `secret.credential-unlocks`. /settings/docs: "/framework-docs/working/..." kicker. All in W/features/settings-page/tools/* (sweep #8, #9 unchanged).
Extension Settings (X/panel/settings, 360; e08) is clean: no raw ids, no overflow (docScrollWidth 360). Items:
15. Checkboxes and radios are native 13x13 (amber accent) beside 26 px segmented buttons "Full / Small / Off": two control styles; 13 px hit areas.
16. A humanness change inserts a status line and pushes the rest down 19 px (Permissions 896 -> 915).
17. Advanced still says "Usually ws://127.0.0.1:4777/client." (X/panel/settings/form-fields.ts:62). A draft bar "You have changes that aren't saved yet. Save changes" (settings-view.ts:75) shows at the foot of Advanced after toggles above changed: autosave and explicit save mixed.
18. "Report a problem" adds two lines and shifts 0.02, the largest in the pass.
Screenshots: panel `e02-*`, `e03-*`, `e04-*`, `e05-*`, `e05b-*`, `e06-*`, `e07-*`; extension `e08-*`, `a11-*`, `a12-*`, `c05-*`, `d03-*`.

## Proof (approved-client proof)
Not run. Command: `node packages/test-runner/dist/extension-chat-check/cli.js --browser chrome --scenario everything-store --page ./ --no-ask --model-key` from EXT.
The Claude Code permission system denied it ("Destructive or Unwanted Actions") before it started, so there is no exit code and no check values. I did not work around the denial.
It needs a permission rule from the user, or the lead to run it. The panel and browser were already stopped at that point; the slot is now released.

## Counts and cleanup
- Paid model calls sent by me: 2 (one message in the extension, one in the panel); see new defect 4.
- Real key: typed once into the extension's key form, then replaced by a fake key and removed through the UI; a fake key added later was also removed (final state "No key"). It only passed through the daemon, which scrubs its output.
- Key scan of `after-live/` (profile included) and `test-runs/t925-panel-live.log`: 530 files, full-key matches 0, last-12-character matches 0. Key count: 0.
- Stopped: the daemon (STOP), Chromium (none left), `run-fluxiq-web.mjs` and `next start` on 3100 and the gateway on 4877 (both ports free). Slot `t925-live` released.
- Left in place: `test-runs/key-security-ux/after-live/` (daemon.mjs, step.sh, shots, logs, profile), `test-runs/t925-panel-credential.txt`, `EXT/.fluxiq` (this run's data).
