# Journey audit (t925, key-security-ux)

Worker: journey-audit. Date: 2026-11-17, live session 21:23-21:53 PST on the t925 trees (already built).
Panel: `scripts/run-fluxiq-web.mjs` on 3100, gateway on 4877. Extension: `apps/extension/dist/chrome`, unpacked, in
fresh Playwright persistent profiles. Screenshots (256): `test-runs/key-security-ux/journey/shots/` (`NNN-<step>-<width>-<scheme>.png`).
Logs: `journey/logs/` (needs-you.log, http-errors.log, console.log, ws-client-1.log, panel-j1.log, panel-j2.log).

## Outcome

Partial. All four journeys ran live. No first message ever reached a model, because **no key can be saved from any
place in this tree** (panel or extension). That is in flight (t928), but it blocks the user's goal today.
The intermittent "Could not check what needs you." was **reproduced once and traced to a cause** (below).
Security finding filed off-repository.

## Step maps

Columns: clicks / typed fields / screens / wait. Class: S = Needed-for-security, N = Needed (the person's own input),
R = Removable. Waits are measured from the click until the next state showed.

### Journey 1: extension first (shots 001-054)

| # | Step | Clicks/fields/screens/wait | Class | What the person sees, and the cause of any trouble |
|---|---|---|---|---|
| 1 | Install (load unpacked) | 1/0/0/- | N | No welcome page opens. |
| 2 | Open the side panel | 1/0/1/3.2 s | N | "Get started with FluxIQ", 4 steps (001). No "add a key" step anywhere in the list. |
| 3 | Start FluxIQ: Change, type address, Check and save | 2/1/0/0.6 s | R | Only because this test used port 3100; on 3000 it shows Done by itself. Gateway URL is derived (4877). |
| 4 | Sign in: Open FluxIQ | 1/0/1/2.3 s | N | New tab: "Sign in to continue" with **no word on how a first-time person signs in** (007), though the extension promised "the page tells you how". in flight: t927 |
| 5 | Sign in with admin/admin (only in docs) | 1/2/0/2.6 s | R | Temporary password detour. in flight: t927 |
| 6 | Replace the temporary password | 1/2/1/3.5 s | S | Choosing the owner password is the account's security; one screen is right (011). |
| 7 | Back to the extension | tab switch/0/0/- | R | "Sign in to FluxIQ" still says **Next** although this browser is signed in (019): the step cannot see the panel session. |
| 8 | Connect | 1/0/0/0.5 s | R | Code shows at once. Step 3 says "Done / Connected" and step 2 "In progress" while nothing is approved yet (021): confusing. Connect could fire by itself once FluxIQ is found. |
| 9 | Switch to the panel, check code, Confirm | 1+switch/0/1/3.4 s | S | Modal already open with the same code (023). This is the approval gate; keep it. At 390 px the Decline/Confirm buttons are 175 px tall (025). |
| 10 | Add a key in the extension: Settings, Add a key, paste, Save and check | 3/1/1/<=20 s | N | **Dead end**: "This extension doesn't support that yet." (041). in flight: t928 |
| 11 | Add a key in the panel: Add a key, paste, Save and check | 2/1/0/**30 s** (1 s on a retry) | N | **Dead end**: "Invalid username or credentials" (051). Nothing stored. Security > Activity then says "Administrator added a key." in flight: t928 for the save. The Activity wording is a separate defect. |
| 12 | First message in the extension | 1/1/0/6-7 s | N | "No model key is set up yet, so add one in Settings, under AI keys." (045). The extension's section is named MODEL, not AI keys. |

Totals to a first message (without the dead ends): about 12 clicks, 6 typed fields, 2 tab switches, 5 screens, about 19 s
of waiting. Removable: steps 3 (test only), 5, 7 and 8.

### Journey 2: panel first (fresh data and profile; shots 301-328)

| # | Step | C/F/S/wait | Class | Notes |
|---|---|---|---|---|
| 1 | Open the panel | 0/0/1/1.9 s | N | Same unexplained sign-in. `/get-started` (quickstart step 1) only redirects to Home, and `/setup` is 404 on `local`. |
| 2 | admin/admin, then a new password | 2/4/2/2.6+3.5 s | S+R | As in journey 1, steps 5-6. in flight: t927 |
| 3 | Home | 0/0/1/- | - | The assistant's box is **disabled**: "Open a project to start a conversation…" (301). No project exists. |
| 4 | Add a key (Home card or the assistant's card) | 2/1/0/1 s | N | Same dead end: "Invalid username or credentials" (321). in flight: t928 |
| 5 | Projects, Create project, name, Create project | 3/1/1/2.6 s | R | Lands on Flows with the project chosen and the box enabled (313). The form says "Create a workspace for Flows, recordings, runtime history, and settings." |
| 6 | First message in the assistant | 1/1/0/6.2 s | N | No-key reply (317). |
| 7 | Connect the extension: open, (Change address), Connect, switch, Confirm | 3+switch/0/2/0.5 s + approval | S | Works. The extension opens on the panel's project and shows the same chat (327). "Sign in to FluxIQ" again stayed **Next** in a browser already signed in. |

Totals to a first message: about 8 clicks, 7 typed fields, 5 screens, about 16 s of waiting. Removable: 2 (detour) and 5.

### Journey 3: another client (shots 189-208)

- **Gateway client, as `client-gateway-websocket.md` shows** (`journey/ws-client.mjs`; clientType sdk): `client.hello` got
  `server.pairing_required` with a code in 0.1 s. The panel modal appeared on any page with the client's name and code (189).
  Confirm sent `session_ready`. Revoke (Security > Devices and apps > Remove access > Remove access) closed the socket at once
  with "Client trust was revoked."; the saved token afterwards got a new pairing request, not a session. Works, 1 click to approve.
  The doc still says to revoke from "Automation Studio's Client Gateway view" (`docs/integrations/client-gateway-websocket.md:259`).
- **FluxNode / SDK, as `docs/fluxnodes/README.md` shows:** `fluxiq init` worked (with `FLUXIQ_CONFIG_DIR` in the journey folder).
  `fluxiq runs --url http://127.0.0.1:3100` gave "did not say its instance id at /.well-known/fluxiq". The panel serves no
  FluxNode API. The SDK needs `fluxiq dev`, a separate headless engine (default 3000/4777, data in `~/.fluxiq/data`), and its
  key must be added "in the FluxIQ web panel's Secret Keys settings, against the same data directory". **No person-level path
  exists**: nothing tells a person how to point a panel at that data directory, and the page is now called "AI keys".
  `fluxiq dev` was not started (it would be a second engine).

### Journey 4: every other flow

| Flow | Panel | Extension | Result |
|---|---|---|---|
| Project create (header picker) | 2 clicks + name, 2.5 s | - | Header switches to it, but the **Projects list still shows 1 project** until a reload (099). |
| Project create (Projects page) | 3 clicks + name | - | Good (journey 2). |
| Project switch | Projects > row: opens Flows | picker: 2 clicks, 2 s | Works. A **full page load drops the chosen project** ("Choose a project" after reload, even on `/chats/<id>?project=…`). |
| Chats: list, open | 1 click | Chats: 1 click | Works and stays in step: a rename in the panel showed in the extension. |
| Chat rename | Chats > Rename, type, Enter | same component | Works (123). |
| New chat | Chats > New chat | - | Works, but the **URL keeps the previous chat's id**, so a reload reopens the old chat. |
| Chat delete | Delete > "Delete this chat?" > Delete | - | Works and persists. |
| Chat page layout | `/chats/<id>` | - | The chat plus the assistant beside it, whose box is disabled with "Open a project…" (115): two chats on one screen. |
| Flows, Runs, Data | empty states, 2.2 s each | Automations: empty | Only empty states reachable: no Flow can be built without a key. |
| Settings | AI keys, assistant, allowance, humanness, theme; 7 advanced tools render | Settings: Connection, Model, Behaviour, Permissions, Appearance | **Saved logins and keys for Flows is 404** through its own link (187). |
| Security, four tabs | Your sign-in, Devices and apps, People, Activity, plus Advanced | - | All render (063-086). Activity said "added a key" for a save that failed. |
| Sign out / in | Account > Sign out, 2.6 s; sign in 3 s | keeps working | After sign-out the panel API answers 401. The extension stays connected (the user's rule). |
| Revoke a client | 2 clicks, 1.5 s | sees it in under 3.7 s | Works. The extension then says "This browser was approved earlier. Connect to check it still is." (209): wrong after a revoke. |
| Extension Disconnect | Settings > Disconnect | - | **Dead end in Settings**: it says "Connect to check…" but has no Connect button. Connect is only on the Chat tab, where it reconnects in 0.5 s without a new approval. |
| Home "Connected" card | - | - | Lists pending clients ("Waiting to be paired") under Connected, one row per reconnect attempt (the SDK client 3 times), revoked clients as "Not connected", and "Web Automation Gateway Runtime / Built in / last seen not known". |
| Theme | Dark by default | Dark by default | Neither follows the device until "System" is chosen, so shots 001-058 are dark in both columns. |

### The intermittent "Could not check what needs you."

**Reproduced** in journey 1, 4.25 s after Confirm on the **first** pairing. That pairing also creates the first project
("My automations"), and the extension opened its chat at once. Home showed the message (033). The failing request was
`POST /api/programs/automation-studio/list-conversations` with **400**, error
`"Automation Studio schema migration lock was lost for project 05a54ad8-…"`, code `null`, at 05:31:58.801Z.
`list-workspace-flow-summaries` and `list-recent-flow-runs` returned 200 in the same second.
Not seen after the SDK approval, the SDK revoke, the extension revoke, the extension re-pair, or the journey 2 pairing, where
the project already existed. Three create-project calls raced against six list-conversations calls also stayed 200.
Cause (from reading the code, consistent with the log): `packages/fluxiq/src/framework/persistence/automation/schema-migrations.ts:128-129`.
When the ledger shows nothing pending, a reader calls `markReady(null)`. Its `status != 'migrating'` update (`:226`) changes
0 rows while the opener of the new project still holds the lock, and `:232` throws "lock was lost". That fails the whole read.
Home never recovers by itself: `useResource` (W/features/home/data/use-resource.ts) retries only when the tab is shown again,
and only `clients` follows the gateway's revision (W/features/home/HomePage.tsx:28-32).

## The ideal journey (fewest steps that keep pairing approval)

1. Install the extension and open its panel. It finds FluxIQ (default address or discovery) and **sends the connect request by
   itself**, showing one line: "Approve this browser in FluxIQ" with the code and Open FluxIQ.
2. Open FluxIQ. The first visit, via the launcher's setup link (t927), asks for the owner's new password: one screen, 2 fields.
3. The approval modal is already open with the same code: **Confirm** (the security gate).
4. The same landing shows the AI key card: paste, **Save**. Both clients show Ready.
5. Type the first message in either client. A default project exists for both clients, so the assistant is never disabled.

That is 4 clicks, 3 typed fields and 2 screens before the first message, down from about 12 clicks, 6 fields and 5 screens.
Approval and the owner password are the only security steps.

## Prioritised fix list (by folder; for the lead to route)

1. **packages/fluxiq/programs/secret-keys** (in flight: t928). `create-key` still requires `authorizationPassword`
   (`api/handlers.ts:268-285`, `runtime/service.ts:171,696`), but the t925 card sends none
   (W/features/model-keys/port/create-panel-model-keys-port.ts:53-63). Every save fails with the identity error after up to 30 s.
   Fixed: keys save and the first message reaches the model.
2. **X/background** (in flight: t928). The background has no handler for `fluxiq.panel.modelKeySave/Replace/Remove`
   (X/panel/chat/transport/ports/model-keys/send-key-write.ts:13-17), so X/panel/state/request.ts:43 shows "This extension
   doesn't support that yet." Fixed: the key can be added from the extension.
3. **packages/fluxiq/framework/persistence/automation/schema-migrations.ts:128-129,232**. With nothing pending and a live
   `migrating` lock held by another caller, wait for that lock (or read the ledger as ready) instead of throwing.
   Fixed: no "Could not check what needs you." after a first pairing.
4. **W/app/AuthShell.tsx** (in flight: t927). The first sign-in gives no instructions, and the person goes through the
   admin/admin detour. Fixed: removes 1 screen and 2 typed fields, and the dead end of not knowing what to type.
5. **W (assistant + panel context)**. The assistant is disabled with no project in view, and a panel-first person has none.
   The chosen project lives only in React state (W/features/panel-shell/context/PanelContextProvider.tsx:9) and is not read
   from `?project=`. Create a default project at first sign-in, as `first-project` does at pairing, persist the selection,
   and honour `?project=`. Fixed: removes 4 steps on panel-first, and reloads keep the person's place.
6. **X/panel/getting-started**. Merge "Connect" and "Approve" into one step that sends the request by itself once FluxIQ is
   found. Detect the panel session for "Sign in" (it stays Next). Say "Access was removed" after a revoke, not
   APPROVED_EARLIER_LINE (start/step-words.ts:14). Add the key as step 5. Fixed: 1 click fewer and no false states.
7. **X/panel/settings**. After Disconnect, Settings needs a Connect button (dead end today). Rename MODEL to "AI key" so it
   matches Core's sentence (packages/fluxiq/src/runtime/models/secrets/caller-key-choice.ts:37). The empty-chat card offers
   only "Open FluxIQ" while the card after a message offers "Add a key": use one card.
8. **W/app/product/preset/is-hidden-panel-path.ts:14-15** (this tree, t925). It hides `/settings/<segment>` unless the
   segment is a preset tool id. The Saved logins page lives at `saved-logins`, but its tool id is `secret-keys`
   (W/features/settings-page/model/engine-tools.ts:20), so the page is 404. Fixed: Saved logins opens.
9. **W/app/styles/global-responsive-certification.css:225-226 with 254-258**. At narrow widths `.modal-actions` becomes a
   column while `.modal-actions .button` keeps `flex: 1 1 140px`, so each button is 140-175 px tall. Use `flex: none` in
   the column. Fixed: a usable approval modal on phones.
10. **W/features/security/activity/model/activity-sentence.ts:47-52** (and the Core audit emitter it reads). An `allowed`
    authorization reads as done, so a failed key save shows "added a key". Record or read the operation's own result.
11. **W/features/home/sections/HomeConnected.tsx**. Show pending clients only under "Waiting for approval", fold repeat
    attempts into one row, drop revoked clients, and hide the built-in runtime row or say what it is.
    W/app/GlobalClientGatewayPairing.tsx:213: replace "Someone is asking to connect" with "Chrome on Windows wants to connect".
12. **W/features/chats**. Project create from the header picker does not refresh the Projects list. New chat keeps the old
    conversation id in the URL. On `/chats/<id>`, hide the assistant's second (disabled) box.
13. **W and X theme**. Default to System, or follow the device on first run (both say "Dark is the default").
14. **Docs** (lead to route): EXT docs/user/quickstart.md:16,28 (admin/admin, `/get-started` does not exist);
    Core docs/integrations/client-gateway-websocket.md:259 (revoke now lives in Security > Devices and apps);
    Core docs/fluxnodes/README.md ("Secret Keys settings", and no person-level way to give `fluxiq dev` a key).

## What works

- The panel finds a client's pairing request at once on any page. The code matches, and approval reaches the extension in
  3.4 s. A revoke takes effect at once; a revoked token is refused; a disconnect and reconnect needs no new approval.
- Chats are shared: the extension and the panel show the same chat, and rename and delete persist.
- Sign out ends the panel session (401 from the API). Sign in again takes 3 s.
- No key or token value appeared in any page; key fields are password inputs and are cleared.
- The extension derives its gateway address from the web address (one field, not two).

## Not verified

- A first message with a saved key (the key's refusal text): blocked by fix 1 or 2. Flows, runs and Data have only empty states.
- The real Chrome side panel (opened as a tab at 360 px), the toolbar button, Firefox, and Edge.
- `fluxiq dev` and a FluxNode run; the extension's Report a problem; Security > Advanced edits; People invites by email.
- The migration-lock cause comes from code reading plus one failing request. A deterministic reproduction was not built.
- Light-scheme screenshots before the theme was set to System (001-058) show the dark default in both columns.

## Housekeeping

- Original data moved (not deleted) to `test-runs/key-security-ux/fluxiq-before-data/`. Journey 1's data is in
  `journey/data-j1/`. Journey 2's fresh data stays at `EXT/.fluxiq`; its owner sign-in is in `test-runs/t925-panel-credential.txt`.
- Heavy slot `t925-journey` was acquired at 21:21 and **released** at 21:53 (status showed it gone), so no renew was due.
  Stopped: both `run-fluxiq-web.mjs` trees, including `next start` on 3100/4877 (netstat shows nothing listening), both
  Playwright Chromium daemons, and the ws-client (it exited on revoke). No process of mine remains.
- Side notes: the SDK owner key test files are in `journey/sdk-config/`; the test client's (revoked) gateway
  token file was deleted. Three "Race probe" projects exist in data-j1.
