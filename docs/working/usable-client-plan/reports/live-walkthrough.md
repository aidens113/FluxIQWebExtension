# Live walkthrough: FluxIQ web panel and Chrome extension

Date 2026-11-16. Chromium (Playwright 1.x, headed, persistent profile, extension loaded unpacked from `apps/extension/dist/chrome`), panel http://127.0.0.1:3000 (profile `local`), gateway ws://127.0.0.1:4777/client. No model key added, no paid calls. Nothing edited in source.
Screenshots and scripts: `C:/Users/osrs_/FluxStuff/fxwork/t915/!FluxIQWebExtension/test-runs/usable-client-walkthrough/` (65 PNGs, numbered by step; scripts `s*.mjs`).

## Journeys

| # | Journey | Result | Evidence |
|---|---|---|---|
| 1 | First-run setup to Home | Works, but not as briefed: no owner-name or setup-code step exists. `/setup` is 404 on the `local` profile. First run is sign in with `admin`/`admin`, forced "Replace the temporary password" (12+ chars), then Home | 01-first, 02-setup, 04-after-admin-login, 05-home-first |
| 2 | Page timings and request counts | Works (see timings) | 06-*.png |
| 3 | Projects: create A and B, rename, open | Works. Create lands on that project's Flows page; rename via row "..." menu; click opens it (header follows) | 09-13-*.png |
| 4 | Settings "Connect a client" | Works: panel address, gateway address, discovery JSON, pending request list | 08-settings.png |
| 5 | Extension before pairing | Works: "Get started" 5-step checklist; no unlock/key step | 14-ext-initial.png |
| 6 | Pair and approve | Works. Connect shows a 6-digit code; the panel auto-opens a "Client pairing request" modal with the same code; Confirm pairing; extension changed 1.7 s later. No unlock, password or key prompt anywhere | 15-*, 17-*.png |
| 7 | Header, switcher, create C, switch | Partly broken. Create C and switching work and header and chat follow. Switcher does NOT list the panel's projects (see D1), header reads "Project" until switcher is opened | 18-switcher, 20-*, 21-*, 24-*.png |
| 8 | New chat, send, second chat, Chats list, switch back | Works with defects D4, D5: reply is the setup-style message, not an unlock; both chats are named "This project"; switching back to the first restored its messages | 22-*, 23-*, 24-switched-back.png |
| 9 | Each project shows its own chats | Works: C has 2 chats, My automations shows "No chats yet." | 24-myauto-chats, 25-C-chats.png |
| 10 | Automations tab | Works (empty): Tasks/Library, "No automations yet", record buttons disabled on an extension page | 26-automations.png |
| 11 | Extension Settings | Works: project row with Change, "Connected to FluxIQ", model "No supported model key is configured", humanness slider, status-on-page, theme Dark/Light/System, Advanced shows connection and web addresses (ws://127.0.0.1:4777/client, http://127.0.0.1:3000) | 26-settings, 27-*.png |
| 12 | "Open FluxIQ", "All projects in FluxIQ" | Works: open http://127.0.0.1:3000/ and http://127.0.0.1:3000/projects in a new tab | 28-*.png |
| 13 | Panel shows what the extension created | BROKEN: neither "Walkthrough C" nor either extension chat appears in the panel Projects or Chats pages (D1, D2) | 21-panel-projects, 29-panel-chats.png |
| 14 | Open to chat usable; idle requests | Works: 352 ms from page load to composer present once paired; 0 requests to :3000 per idle minute (it talks over the WebSocket only; frames not counted) | 18-ext-paired-open.png |

## Timings (ms, headed Chromium, localhost, production build)

Navigation start to shell / content visible / network idle, full page load (`goto`), request count per load:

| Page | 1st open | 2nd open | requests |
|---|---|---|---|
| Home | 348 / 469 / 968 | 102 / 212 / 710 | 35, 36 |
| Projects | 131 / 148 / 717 | 113 / 126 / 688 | 33, 34 |
| Chats | 102 / 117 / 686 | 108 / 118 / 715 | 35, 36 |
| Flows | 118 / 132 / 686 | 112 / 126 / 692 | 35, 36 |
| Runs | 104 / ~130 / 686 | 106 / ~130 / 700 | 39, 40 |
| Data | 124 / 136 / 710 | 110 / 122 / 683 | 33, 34 |
| Security | 141 / 164 / 942 | 126 / 138 / 763 | 41, 42 |
| Settings | 157 / 184 / 904 | 128 / 139 / 776 | 44, 44 |

Runs "content" was logged as 30 s by my script only because the page text is under 200 characters; the screenshot shows it rendered at once. Idle Home for 60 s: 10 requests (8 to `/api/client-gateway/snapshot`, 2 to `/api/ready`), about one snapshot every 7.5 s. Extension: create project about 2.5 s to header change (not tightly timed), pairing confirm to extension ready 1.7 s, send to reply under 5 s (not tightly timed). Every page is fast; the 33-44 requests per load is high but cheap here.

## Defects, most blocking first

D1 (blocks): the extension and the panel do not share projects. The extension switcher lists only "My automations" and the project created in the extension; the panel's "Walkthrough A" and "Walkthrough B2" never appear in it, even after 10 s and a reopen. Expected: the same list as the panel Projects page. "My automations" is not on the panel at all.
D2 (blocks): a project created in the extension ("Walkthrough C") is absent from the panel's Projects page and its project dropdown (All projects, Walkthrough B2, Walkthrough A). Same for both extension chats on the panel Chats page ("There are no chats here yet."). The brief says the panel should show them.
D3: first-run does not match the brief (no owner name, no setup code). The extension's checklist does say "use admin / admin", so a person can follow it, but the default credentials are shown in plain text and the 12-character rule is only discovered on the replacement screen.
D4: chats are all titled "This project" in the Chats list (two chats, identical rows, only "just now"), so a person cannot tell which is which. Switching back worked only by row position.
D5: the no-key reply to "Hello, first chat message" reads "I could not tell what you wanted done... such as run the kettle flow" and in brackets "the saved model key is not available, so check the model key in FluxIQ". It claims a key was saved when none exists, and the actual action (add a key) is hidden after a confusing example. Not an unlock, but not a plain setup message either.
D6: extension header shows the label "Project" (not a project name) right after opening while the chat scope shows "All projects"/"My automations"; it only fills in after opening the switcher or switching. The chat tab also shows a stray "Project chat" label. Latest-open state does persist.
D7: the pairing modal on the panel blocks the inline "Approve" in Settings "Connect a client" (a backdrop covers it). Two approval routes for one request, only the modal works at the time. The modal text is run together ("Chrome on WindowsApprove only when... 310437extension-90ddd2eb...") and focus starts on Reject. An unconfirmed request is lost when the extension page closes (new code each time), which is expected.
D8: panel layout looks partly unstyled: on Projects the search box, icons, counts and the project row are jammed together (11-projects-with-A.png), and a 404 resource error is logged once per load in the console (login page and Projects).
D9: the panel's right "Assistant" pane is empty on every page (no composer, no prompt), presumably because no model key; it gives a person no hint (06-home.png).
D10: extension checklist while paired-but-unapproved says "Sign in to FluxIQ: To do" next to "Connected: Done", and step 1 "Start FluxIQ: Next" while FluxIQ is already running (14-ext-initial.png). The "Add a model key" banner persists on every chat open after pairing until "Not now".

## Not verified

Real browser side-panel docking (the page was opened as a tab); recording and Show me how; sending with a real model key; chat rename/delete; Runs, Data, Security content beyond load; per-minute WebSocket traffic of the extension; Firefox build; project delete.

Browser closed after each script; the panel was left running as instructed. Test owner password was chosen by me and is not recorded here.
