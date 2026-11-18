# Key and security UX (task t925, sub-supervisor key-security-ux)

Status: phases 1 (audit) and 2 (design) done, the design revised after an adversarial review; phase 3 (fixes) waits for the lead's check of the design and for t924's model-access contract. The lead's extra item (the /chats list not following the change stream) is fixed and checked.

Trees: Core `fxwork/t925/!FluxIQ` (W = `apps/web/src`, U = `packages/ui-components/src`), extension `fxwork/t925/!FluxIQWebExtension` (X = `apps/extension/src`). Instance: production panel http://127.0.0.1:3100, gateway ws://127.0.0.1:4877/client, fresh data in the t925 extension tree's `.fluxiq`, log `test-runs/t925-panel.log`; owner sign-in in `test-runs/t925-panel-credential.txt` (git-ignored). Still running. The extension audit's Playwright browser is still open and paired (`test-runs/key-security-ux/audit-before/extension/daemon.mjs`).

## Phase 1: audit

Worker reports (the full tables, with screenshots and file:line causes):
- `key-security-ux/panel-audit.md`: 37 findings (P1-P37), 270 screenshots in `test-runs/key-security-ux/audit-before/panel/`.
- `key-security-ux/extension-audit.md`: 23 findings (E1-E23), 149 screenshots in `test-runs/key-security-ux/audit-before/extension/shots/`.

Verified by me: both builds passed (Core library steps all reused, `pnpm build` in the extension exited 0); screenshot counts (270 panel, 68 distinct steps x 4 variants; 149 extension); P2 by reading `W/app/api/auth/login/route.ts:122-131` (the session cookie is set whatever `requiresCredentialSetup` says); P10 and P11 in `13-settings-key-saved-dark-1440.png` (oversized radio and checkbox, "Anthropic · On" for a dummy key); E12 in `04-chat-after-send-key-offered-and-chosen-dark-360.png` ("No model key is set up yet, so add one in Settings, under AI keys." with a key saved, offered and chosen). Neither report contains a key value.

### What is wrong, grouped (worst first)

1. **No one can tell whether a key works.** Every place says "On", "Available" or "configured" for a key that cannot answer (P11, E10). The chat then says either "Anthropic refused the request. Send your message again" (panel, P13) or "No model key is set up yet" (extension, E12, the t924 bug), never "this key was turned down, replace it", and nothing links to the fix. Nothing checks a key when it is saved.
2. **Keys live in three places that disagree** (P6-P9, P15, E9): Settings > AI keys (plain form, Anthropic default, needs your password, has Remove only), Security > Keys ("Add Secret Key", "encrypted credential", Type, Scope, "object reference", OpenAI default, asks for a PIN that does not exist, has rotate and reveal), and the Security home's Keys summary (no add). The dock's "Add a model key" goes to the jargon one; the extension's chat sends people to "Settings, under AI keys", which the extension does not have, and its Settings button opens the jargon one.
3. **The extension cannot add, replace, remove or choose a key at all** (E9); it only links to the panel.
4. **False or jargon security words**: "sealed" and "shown to nobody afterwards, including you" while Reveal shows it (P8, P14); "Credential vault: Locked" with no way to unlock (P23; contradicts the connected-client rule); "Set a PIN" and PIN prompts though the MVP has no PIN (P7, P23, P24, P30); "value", "acting user", "security factors", "rotate", "scope", "Mint press grant", hex key ids, raw permission ids (P24-P26, P29, P32); raw client id and discovery JSON (P20, E7).
5. **Security pages are organized around IAM, not a person** (P29, P34): no tab bar, a long Security home repeating summaries, an IAM console (Users / Roles / Authentication Policy) inline under "Your sign-in", provisioning noise in Activity.
6. **Dead ends and silent outcomes**: change password gives no error on mismatch and no confirmation (P26); sign-out leaves the page in place with 401s (P27) and exists only inside the People list; `/connect`, `/connect/authorize`, `/connect/done` say "open the panel" with no link (P21); first sign-in gives no hint that the owner is `admin` (P1); the Forget confirmation in the extension opens below the fold (E19); a stale "Saved." bar stays forever (E4).
7. **Pairing and clients states are wrong or stale**: the extension's first step says "FluxIQ is running" after probing the built-in 127.0.0.1:3000, whatever server the person has (E1, E2; the only way to change it is two addresses under Settings > Advanced); after a revoke the extension says "This browser is approved: Done" (E16, E20) and re-requests pairing by itself (E17); revoked rows pile up and "Windowsextension" runs together (E14, E15); the panel Home pairing card does not update live (E8); initial focus is on Reject in the approval dialog (E7).
8. **Styling**: oversized native radio and checkbox in the key row (P10), Enabled checkbox and Scope row in the Add Secret Key dialog (P7), "Not now" as an amber link beside a button (E11), duplicate chat title (E13).
9. **Other defects found**: removing a key from Settings first sends two failing requests (400s on `identity-access/mint-press-grant` and `secret-keys/delete-key`) and writes "Delete key" three times in Activity (P16, P32); the panel assistant's conversation is missing from /chats (P35); an invitee who has not accepted already shows as an enabled user (P33); picking a model changed the workspace-key note (P17, not traced).
10. **Security defect outside my paths (for the lead now):** P2, the temporary `admin`/`admin` password is not enforced. `W/app/api/auth/login/route.ts:131` sets the full session cookie before the owner replaces it; leaving the setup form keeps a full session on the default password. Fix belongs in the login route (no session, or a setup-only session, until the password is replaced).

Brand: the panel's tokens already match the website (amber `#f5b83d`, ink `#0c0d0f`/`#111214`, FluxIQWebsite `src/app/globals.css`); the departures are unstyled native controls and raw data, not the palette.

## Phase 2: design (revised after the design review)

Reviewed adversarially by worker-heavy `design-review` (`key-security-ux/design-review.md`, 18 problems). I checked its two load-bearing claims in code: a revoke sends only `server.disconnect` and never `server.revoked` (F `client-gateway/service/access.ts:108-121`), and the login route issues the full session at once (above). Every correction below is taken from it unless marked.

### Principles
- One idea per place: an **AI key** is added, checked, replaced and removed through one shared component, wherever the person is.
- **Say the state, and offer the fix beside it.** Every surface shows the same state, in the same words, with the same single action.
- Plain words only. Banned in person-facing text: unlock, locked, vault, custody, seal(ed), credential, secret (for AI keys), scope, rotate, grant, mint, factor, acting user, value, token, ids and hex.
- No PIN in the MVP. No password re-entry between a connected client and the model (AGENTS.md). The password is asked only where it protects the account itself: changing the password, inviting a person, changing someone's access.
- Hiding a state is never the fix for a real lock: anything that gates model access is fixed in the backend (lead items below).

### The model-access state (display contract; data from t924)
One module in U, `model-access/`, holds the state type and the words. The type comes from t924's contract when the lead sends it; until then Core's `readModelReadiness` (U/chat/onboarding/model-readiness.ts) is the only reader. `<Provider>` is the key's provider name (Anthropic, DeepSeek), never a hard-coded "Claude".

| State | Badge | Sentence | Action |
|---|---|---|---|
| ready | green "Ready" | "<Provider> is ready, using <key name>." | Change model |
| no key | amber "No key" | "Add an AI key to start. FluxIQ uses it to understand and build what you ask." | Add a key |
| can't open (`ciphertext_invalid`) | red "Can't open" | "FluxIQ saved <key name> but can't read it any more. Paste it again to keep going." | Paste it again |
| server can't open keys (`host_protection_unavailable`) | red "Server setup" | "This FluxIQ server can't open saved AI keys. Whoever runs it needs to finish its setup." | none (link to the setup doc) |
| old FluxIQ (`upgrade_required`) | grey "Update FluxIQ" | "This FluxIQ is too old to use your AI key. Update it." | none |
| not accepted (provider refused) | red "Not accepted" | "<Provider> did not accept <key name>. Check that it was copied in full." | Replace key |
| no credit (set only by a real reply, or DeepSeek's balance check) | red "No credit" | "<Provider> says the account behind <key name> has no credit left." | Replace key |
| unreachable | grey "Can't reach <Provider>" | "FluxIQ couldn't reach <Provider> just now. It tries again on your next message." | Try now |
| checking | spinner | "Checking with <Provider>..." | none |
| not connected (extension) | none | "Connect to FluxIQ to see your AI key." | Connect |
| couldn't check | none | "Couldn't check your AI key just now." | Try again |

`legacy_recovery_required` gets no wording: today it says "Sign in to the FluxIQ panel once", a sign-in step the connected-client rule forbids, so it goes to the lead as a backend migration (item 9).

### One add-key journey
- `U/model-access/` renders `ModelKeyCard` as plain DOM (the package and the extension's Settings are both plain DOM): the state line, and when the action is Add, Paste again or Replace an inline form: **Provider** (Anthropic (Claude) first and default, DeepSeek), **Key** (masked paste field, "Where do I get one?" link to the provider's key page), **Name** (optional, default "<Provider> key"). One button, "Save and check": the card moves to checking, then to ready or a failure state, in place. Replace keeps the name and default. Remove is one inline confirm whose sentence depends on what remains ("Remove <name>? Chats will use <other key>." or "...Chats need a new key; Flows that don't use AI keep running."). After ready, a one-line **Model** select (recommended model first).
- A new `ModelKeysPort` in `U/model-access/` (read, save, replace, remove, check; a key's value is sent, never returned). `ChatModelsPort` stays read-only and is derived from it, so no current implementer breaks. The pasted value never reaches extension storage, logs, the problem report or a relay error.
- The **compact card** lives in Core's chat empty state (U/chat/view/empty-state*.ts), so the panel dock and the extension chat show the same thing from the same code; the composer's disabled text becomes the state's sentence instead of "Chat unavailable". The **full card** is mounted by Settings > AI keys (panel) and Settings > Model (extension).
- Extension: `SetupPort.readModelKey` becomes a thin wrapper over Core's reader; the extension's duplicate parser (`X/panel/getting-started/model/key/`) is deleted; the getting-started card keeps steps 1-4 and stops drawing its own key line (it hides Core's line with CSS today).
- Panel: the dock's "Add a model key" opens the form in place. Every "add a key" link points at Settings > AI keys: the dock (W/features/chat-widget/navigation/panel-open-control.ts:23), Flow settings (W/features/automation-studio/settings/ai-provider-model.ts:33), Engine tools (W/features/settings-page/model/engine-tools.ts:20), the extension's Open FluxIQ (`X/panel/open-fluxiq/open-fluxiq-button.ts:63`, `X/shared/fluxiq-web-routes.ts:48-49`).
- Security > Keys stops handling AI keys: the advanced manager moves to Settings > Advanced > "Saved logins and keys for Flows", without the LLM type. Reveal leaves the person's UI (lead to confirm), which makes "never shown again" true. Sharing ("Offer to the workspace", "workspace's key") appears on the key row only when the workspace has more than one person, if t924 confirms an owner's own key serves the extension chat unoffered.
- Removal makes a single call once the authorization is settled (item 3); it never matches error text (today `remove-key.ts:24-31` tries `mint-press-grant` first, causing the 400s and the triple Activity rows of P16 and P32).

### Where the state shows
Panel: dock header (dot plus badge), dock empty state, composer, Home's status card, Settings > AI keys rows. Extension: Settings > Model, chat empty state, composer. A chat reply that fails because of the key carries the state's sentence and action (Core's reply wording belongs to t924). Live updates need a key-state push (item 1); until it exists, each surface reads on open and after its own save, replace or remove.

### Security pages for a person
A tab bar with four short tabs:
1. **Your sign-in**: name; Change password (Current, New, Repeat; inline mismatch error; "Password changed."); Two-step sign-in, optional, in plain words; Sign out of this browser, also in the top bar's account menu, which goes to the sign-in page. PIN and "Credential vault" rows leave only after items 3 and 8 confirm nothing depends on them.
2. **Devices and apps** (was clients and pairing; takes Settings > Connect a client): waiting requests first (browser name, code, Approve focused, Decline); connected browsers and apps, one row each ("Chrome on Windows · paired 9 Nov · last used 2 min ago", "Remove access"); removed ones folded under "Removed (n)". How-to-connect steps here; the panel address shown plainly; discovery JSON behind "Technical details".
3. **People**: one card per person with the role in words; invite (email, name, role, then your password only); pending invites with Copy link, Resend, Cancel, and "Invite created" instead of "Invite sent" unless mail is set up. Roles and policy editing behind "Advanced access controls".
4. **Activity**: plain sentences with key names (no hex ids), one row per act, system provisioning behind "Show system activity".

### Extension connecting
- Step 1 says what it found: "FluxIQ found at 127.0.0.1:3100 · Change". It shows Done only for a valid FluxIQ discovery document (parsed with Core's reader; today any HTTP 200 counts), and takes the connection address from the document's `gatewayUrl`, so a person types one address, the panel's.
- Steps: "Open FluxIQ" sits under the sign-in step it belongs to, every step has a title, Cancel says what it cancels, the code shows its time left.
- After a revoke: "FluxIQ removed this browser. Connect again to ask for approval.", step 4 To do, no automatic new pairing request (needs item 4).
- The "Saved." bar clears on leaving the section; the Forget confirmation scrolls into view; Disconnect hides once pressed; "Allow direct requests: Unavailable" is hidden, not shown disabled; the problem report says "versions and recent failures" (no "ids").

### Fix plan (phase 3, by folder; shared first)
1. **shared-model-access** (worker, Sonnet), Core U: `model-access/**` (new), `chat/view/empty-state*.ts`, `chat/view/thread-header.ts` (E13 duplicate title), `chat/conversation/composer.ts` (state sentence; P12 draft kept across a layout switch), `chat/onboarding/**`, `chat/ports/{transport,index}.ts`, `chat/tests/message-transport.ts`, the U root barrel, base radio, checkbox and select styles in the package's CSS, and `packages/ui-components/package.json` (export the new stylesheet; minor version bump, the package is published). Runs first.
2. **panel-keys** (worker), W: `features/settings-page/**` except `connect/`, `features/security/keys/**`, `features/security/page/SecurityKeysPage.tsx`, `features/security/data/load/key-rows.ts`, `app/(panel)/security/keys/**`, `app/(panel)/settings/**`, `features/chat-widget/**`, `features/automation-studio/settings/ai-provider-model.ts`, `features/home/**` (status card; the pairing card driven by the existing `useGatewayChanges` instead of one read, E8; "Could not check what needs you"). Traces P17.
3. **panel-security** (worker), W: `features/security/**` except the paths in 2, `features/accounts/**`, `features/settings-page/connect/**`, `features/panel-shell/**` (account menu with Sign out), `app/(panel)/security/**` except keys. Owns `features/security/index.ts` and `security.css`; panel-keys only imports from them.
4. **extension-keys-connect** (worker), X: `panel/settings/**`, `panel/getting-started/**`, `panel/chat/**` (port adapters), `panel/open-fluxiq/**`, `popup/**`, and `shared/{constants,fluxiq-web-routes}.ts` if the lead grants them.
5. **after-screenshots** (worker-light): rerun both audit scripts into `audit-after/` and list differences.
2, 3 and 4 run in parallel after 1. The state display binds to t924's contract last. Integration edits (barrels, conflicts) are mine.

Knowingly left: P36 (a hidden dialog in the DOM, no visible effect); E18's "signed in as" line (the extension has no identity to show until the gateway gives one); the three permission checkboxes ticked by default (a product call, not a defect); E22/E23 native scrollbars (cosmetic; fixed only if worker 4 has time). P13 and E12 belong to t924.

### What phase 3 needs from the lead (exact)
1. **t924's contract**: the state type (including whether "no credit" exists), where each client reads it, and a push of key-state changes: a panel change-stream topic (`W/app/api/panel/changes/panel-change-stream.ts`, outside my paths) and a `server.*` message to paired clients. Also: does an owner's own key serve the extension chat without "offer to the workspace"?
2. **A key check** in Core (never in the extension; its structure audit forbids provider hosts): Anthropic `GET /v1/models`, DeepSeek `GET /models` plus `GET /user/balance`, no billed call; run after save and replace and on "Try now"; a panel route plus a relay case. The runtime must also record a provider refusal or an empty balance against the key, or "Ready" goes on contradicting the chat.
3. **Key writes from a connected client without the password or a PIN**: secret-keys must authorize a panel session or a paired client for save, replace and remove (Core `docs/programs/global-programs.md:77` requires password and PIN today). The extension's transport already exists (`X/background/automation-relay/automation-relay.ts:162-163` calls `secret-keys`); it needs three relay cases in `X/background` and their protocol types. Identity-access must stop requiring and offering a PIN, and clear existing PINs, before the UI drops the field.
4. **Revoke is a Core gateway gap (boundary alert)**: `revokeTrustedClient` should send `server.revoked {reason: revoked_by_user}` (the contract exists, C `client-gateway/message/server-message.ts:21`) before closing; the gateway should not open a new pairing request by itself for a revoked token's hello (F `client-gateway/service/lifecycle.ts:159-172`); the extension background handles `server.revoked` (drop the credential, stop auto-reconnect, tell the side panel "removed").
5. **Login (P2, security)**: no full session until the temporary `admin` password is replaced (`W/app/api/auth/login/route.ts:131`).
6. **Invitees shown as enabled users (P33)**, and **using a key updating "last revealed" (P14)**: server side.
7. **Ownership additions**: `W/app/AuthShell.tsx` (first sign-in hint for `admin`, P1; sentences run together, P3; landing page after sign-in, P28; mention a waiting pairing, E6), `W/app/GlobalClientGatewayPairing.tsx` (approval dialog: no client id, Approve focused, E7), `W/app/connect/**` and `W/app/not-found.tsx` (dead ends, P21), `X/shared/constants.ts` and `X/shared/fluxiq-web-routes.ts` (E1, E9).
8. **"Credential vault: Locked"**: confirm the vault state (F `programs/identity-access/runtime/service.ts:74,480,491`) gates nothing on model access or key saving; if it does, that is a backend fix, not a hidden row.
9. **`legacy_recovery_required`**: migrate such keys without a sign-in (t924), so no client ever shows a sign-in step for the model.
10. **Product calls**: remove Reveal from the person's UI; move the advanced manager to Settings > Advanced without AI keys; show sharing only with a second person.
11. **Budget**: four workers used (two audits, the design review, the Chats fix); the plan needs five more, nine in all, one over the brief's 6-8.

## Extra item (done): the /chats list follows the change stream
Worker `chats-list-live` (Sonnet, report `key-security-ux/chats-list-live.md`). Two causes, both in owned paths:
- `W/features/chats/ChatsPage.tsx` never subscribed to the page's shared change stream. New `use-reload-on-chat-changes.ts` reloads the list on each `conversation` change and when the stream reopens (a change may have been missed), skipping the `opened` sent at subscribe; no timer, no second stream.
- `load-chats.ts` never read `list-panel-threads`, so the assistant's own chats were missing (P35). New `parse-panel-threads.ts` reads those flat records; they are merged into the list.
- My integration edit: assistant threads belong to no project, so they are read only for the all-projects list, not when the page is scoped to one project (`load-chats.ts`), with a test (`keeps assistant threads out of one project's list`).
- Verified by me: the diff read in full; `useLoaded`'s `reload` is stable (`useCallback`, W/features/flows/use-loaded.ts:38), so the subscription does not churn; rows sort by `updatedAt`.
- Checks run by me: `npx vitest run src/features/chats` (apps/web) -> 3 files, 12 tests passed; `pnpm --filter @fluxiq/web check` -> web:check built, no tsc errors; `node scripts/structure-audit.mjs` (Core) -> "structure-audit: passed (549 warning(s), 914 baselined)".
- Not verified: live on 3100 (the running instance serves the build from before the change); that an assistant chat's row link (`/chats/<id>?project=panel`) opens the thread (the chat widget routes project `panel` to the assistant's own port, `features/chat-widget/transport/composed-conversation-port.ts:39`, so it is likely); `pnpm --filter @fluxiq/web build` (not run: it rewrites the `.next` folder the running instance serves from; to run when the instance is restarted for phase 3).

## Commands run (sub-supervisor)
- `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build` (Core t925) -> all five steps "reuse", no errors.
- `pnpm build` (extension t925) -> exit 0.
- `PORT=3100 FLUXIQ_CLIENT_GATEWAY_PORT=4877 FLUXIQ_PUBLIC_CLIENT_WS_URL=ws://127.0.0.1:4877/client node scripts/run-fluxiq-web.mjs` -> "Ready in 8s", gateway bound at ws://127.0.0.1:4877/client; `curl http://127.0.0.1:3100/` -> 200.
- The Chats checks above.

## Not verified
- Anything about keys working: expected broken until t924 lands.
- The extension audit's first open probed the built-in default 127.0.0.1:3000 (t924's port) once, read-only, before it was pointed at 3100; nothing was sent there beyond the reachability probe.
- Firefox popup; invite email delivery; two-factor enrolment; the Roles and Authentication Policy tabs.
