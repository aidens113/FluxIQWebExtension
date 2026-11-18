# Key and security UX (task t925, sub-supervisor key-security-ux)

Status: phases 1-2 done and approved; phase 3 fixes done and checked by unit tests, typechecks, structure audits and builds; the after-screenshots and the live approved-client proof wait for t928 to land and be merged into t925. The /chats item is fixed.

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

## Phase 3: fixes

Lead's decisions (2026-11-17):
- The design is approved with the reviewer's corrections.
- Reveal is removed: a key is replaced, never shown again.
- Security > Keys moves to Settings > Advanced and no longer handles AI keys.
- Workspace sharing shows only when there is a second person.
- The PIN leaves the UI.
- The budget is nine workers.
- Backend items 1-4, 6, 8 and 9 went to t924 and the key-backend task (t928). The login defect and `AuthShell.tsx` went to t927.
- Ownership was granted for `GlobalClientGatewayPairing.tsx`, `app/connect/**`, `not-found.tsx` and `X/shared/{constants,fluxiq-web-routes}.ts`. Later also for `open-purpose.test.ts`, the test-runner keys-page proof, `prove.ts` and `demo-workspace/panel-navigation.ts`, with the tests beside them.

### Workers
| Worker | Tier | Brief | Outcome | Verified by me |
|---|---|---|---|---|
| shared-model-access | Sonnet | `test-runs/key-security-ux/brief-shared-model-access.md` | Partial. Built the six-state card, `ModelKeysPort`, the compact card in the chat's empty state and the composer's disabled reason; ui-components is now 0.15.0. The duplicate chat title (E13) is not wired yet. | ui-components check; `vitest run src/model-access src/chat`: 112 files, 758 tests; structure audit |
| panel-security | Sonnet | `brief-panel-security.md` | Done. Security has four tabs (Your sign-in, Devices and apps, People, Activity). Also: a plain password dialog, sign-out goes to the sign-in page, no PIN anywhere, the devices list, invite wording, Activity in plain sentences, the account menu, the pairing dialog, and links on the `/connect` and 404 pages. The "Credential vault" row is removed: `vault.unlocked` is a display flag, and nothing on model access or key saving reads it. | web check; 45 files, 341 tests; banned-word grep (I fixed the admin password dialog's "New value", "privileged action" and "Save Credential" myself) |
| panel-keys | Sonnet | `brief-panel-keys.md` | Done. New `W/features/model-keys/` port and card view. Settings > AI keys at `/settings#ai-keys` with the card and a restyled list (P10 was caused by `.settings-page input { min-height: 36px }`). No Reveal. Remove is one call, with no `mint-press-grant` first, which was the cause of the 400s. Sharing is hidden for one person. Dock and Home show the compact card, and Home's pairing card updates live from `useGatewayChanges`. The advanced manager is at `/settings/saved-logins`, `/security/keys` redirects, and Connect a client moved to Security. | web check; 116 files, 934 tests (worker); my re-run of model-keys and chat-widget: 21 files, 173 tests |
| extension-keys-connect | Sonnet | `brief-extension-keys-connect.md` | Partial. The card is in Settings > Model and the chat, with one reader (the duplicate parser and the setup card are deleted). Step 1 checks the configured server against a valid discovery document, takes `gatewayUrl` from it, and offers "Change". Step 4 is never Done while disconnected, with new revoke wording. Small fixes E4, E5, E18, E19, E21. The compact chat card does not refresh after a chat failure. | extension check; 325 tests over panel/{settings,chat,getting-started,open-fluxiq,shell} and shared/tests; extension structure audit |
| chats-list-live | Sonnet | `brief-chats-list-live.md` | Done (see the extra item below) | see the extra item below |
| after-screenshots | Sonnet | `brief-after-screenshots.md` | Not yet run. It waits for t928 to land on dev and be merged into t925 (lead's decision), so the key journeys show the real flow. | - |

The after-screenshots worker is Sonnet, not Haiku as the brief suggested. The UI changed enough that the before scripts must be rewritten and each finding judged.

### Integration edits I made
- **Card state** (`U/model-access/state.ts`, `words.ts`): an optional Core message and action label (for `not_permitted` and `key_unopenable`), and the time of the last answer on Ready.
- **Contract mapper** (`U/model-access/contract/`, new):
  - `CoreModelAccess` is a structural copy of t924's `ModelAccessState`, because ui-components and apps/web do not depend on @fluxiq/contracts.
  - `modelAccessFromCore` maps it exactly as the lead specified:
    - ready -> Ready;
    - no_key -> No key;
    - key_unopenable -> Can't open;
    - not_permitted -> the No key look, with Core's message and "Add your own key";
    - provider_refused -> Not accepted;
    - provider_unreachable -> Can't reach;
    - null -> Update FluxIQ.
  - 4 tests.
- **Card actions:** Try now now re-reads in place (`U/model-access/key/card.ts`). Before, every card action pressed Open FluxIQ. `U/chat/widget/options.ts` (`onModelKeyAction`) and `U/chat/chat-widget.ts` now route the other actions to the host. The panel passes them in `ProgramChatWidget.tsx` and `panel-chat-options.ts`: Change model goes to `/settings#assistant-model`, the rest to `/settings#ai-keys`.
- **Panel port:** `requiresPassword` is false (the lead's interface; Core's secret-keys stops asking for a password once t928 lands). A `modelAccess` in a create or rotate answer is shown without a second read.
- **Extension port:** writes go through `send-key-write.ts` with no password:
  - `fluxiq.panel.modelKeySave {provider, key, name?}`;
  - `modelKeyReplace {key}`;
  - `modelKeyRemove {}`.
  - The answer's `modelAccess` becomes the card state. An unknown-message reply shows as a failed save in its own words. The key value travels in that one message only.
  - The message names are local constants until t928 lands, then `RUNTIME_MESSAGES.panelModelKeySave` and the others.
- **Tests:**
  - open-purpose (background) and the test-runner keys-page proof expect `/settings#ai-keys` only, because the proof runs against the Core beside it.
  - `prove.ts` and `demo-workspace/panel-navigation.ts` find the approval dialog by its new title, "A browser or app wants to connect", and its "Confirm" button.
  - The check `configurationHasNoUnlockFragment` is renamed `configurationOpensAiKeys`. Its only reader was `prove.ts`. The old name remains only in two historical reports, `final-acceptance.md` and `final-live-check.md`; they record past runs and are left as written.
  - The extension's approve line says "press Confirm".
- **Docs:** `docs/user/quickstart.md`:
  - section 3 is rewritten for the one AI-key journey: either provider, Save and check, the five states, no password or PIN;
  - the pairing step uses the new dialog and button names;
  - the getting-started steps are updated.
- **Crash recovery** (machine crash at 17:13):
  - I scanned every changed file in both trees for empty or NUL content. Only `U/model-access/key/tests/card.test.ts` was destroyed (14,500 NUL bytes). I restored it from HEAD read-only and reapplied my edit.
  - I checked my other post-merge edits by content (17 spot checks).
  - I rebuilt the dist outputs through heavy slots.

### Phase 3 checks (observed)
- Core libraries through a heavy slot -> ui-components rebuilt; the other four steps matched their stamps.
- ui-components:
  - `pnpm --filter @fluxiq/ui-components check` -> passed;
  - `vitest run src/model-access src/chat` -> 113 files, 763 tests passed (before the crash);
  - after the restore, `vitest run src/model-access` -> 3 files, 19 tests passed.
- Web:
  - `pnpm --filter @fluxiq/web check` -> passed;
  - vitest on model-keys and chat-widget -> 21 files, 173 passed;
  - vitest on security, accounts, panel-shell, connect, app routes and chats -> 45 files, 341 passed.
- `node scripts/structure-audit.mjs`:
  - Core -> "passed (549 warning(s), 914 baselined)", after I fixed one packing violation in my added test;
  - extension -> "passed (251 warning(s), 551 baselined)".
- Extension, through slots where heavy:
  - `pnpm build` -> exit 0;
  - `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0;
  - `test-extension.mjs panel/settings panel/chat panel/getting-started panel/open-fluxiq panel/shell shared/tests` -> 325 pass;
  - `background/panel` -> 99 pass;
  - `panel/getting-started` after the step-word change -> 47 pass.
- Test-runner:
  - build through a slot -> built;
  - `keys-page.test.js` -> 2 pass;
  - `pnpm test` in packages/test-runner through a slot -> 2,853 tests, 2,848 pass, 0 fail, 0 cancelled.
- Live: the after-screenshots and the approved-client proof under a live slot wait for the t928 merge.

### Open
- **Waiting on t928** (key writes without a password, and the three relay messages). Then:
  - switch `send-key-write.ts` to the shared constants;
  - rebuild;
  - run the after-screenshots and the approved-client proof once under the live slot.
- **Left from the design:**
  - P36: a hidden dialog in the DOM;
  - E18: the "signed in as" line;
  - permission checkboxes ticked by default (a product call);
  - E22/E23: native scrollbars.
- **Other known gaps:**
  - "Could not check what needs you" on Home was not reproduced. Candidate cause: Core `list.ts:20-30` throws when any one project's listing throws.
  - The E13 duplicate title needs `threads/chat-threads.ts:182` to pass the first message.
  - The composer does not yet say the key-state sentence; only its disabled reason does.
  - P3, P28 and E6 wait for t927's AuthShell.
- **Two-step sign-in:** with it on, Core's delete and rotate still ask for the code, which the card does not carry. t928 decides whether they still do.

## Commands run (sub-supervisor)
- `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build` (Core t925) -> all five steps "reuse", no errors.
- `pnpm build` (extension t925) -> exit 0.
- `PORT=3100 FLUXIQ_CLIENT_GATEWAY_PORT=4877 FLUXIQ_PUBLIC_CLIENT_WS_URL=ws://127.0.0.1:4877/client node scripts/run-fluxiq-web.mjs` -> "Ready in 8s", gateway bound at ws://127.0.0.1:4877/client; `curl http://127.0.0.1:3100/` -> 200.
- The Chats checks above.

## Not verified
- Any live look at the phase 3 UI: the after-screenshots, the approved-client proof (`node packages/test-runner/dist/extension-chat-check/cli.js --browser chrome --scenario everything-store --page ./ --no-ask --model-key`) and `pnpm --filter @fluxiq/web build` are deferred until t928 is merged into t925, so each runs once against the final code (lead's decision). The before audit's dummy-key journeys also showed keys failing, which t924 has since fixed.
- Saving a key from either client before t928: the panel card sends no password (Core still asks for one), and the extension's relay does not know the three messages yet. Both show Core's or the relay's refusal.
- The extension audit's first open probed the built-in default 127.0.0.1:3000 (t924's port) once, read-only, before it was pointed at 3100.
- Firefox popup; invite email delivery; two-factor enrolment; the Roles and Authentication Policy tabs; 360 px rendering of the new card in a real browser.

## Follow-ups (lead, 2026-11-17 evening), state at the restart pause
- **Done, uncommitted in Core t925 (13 files):**
  - E13: the thread header gets the chat's first message (`chat/threads/first-person-message.ts` and a `firstMessage()` dep), with an end-to-end test that fails without the fix.
  - A key bar above the composer (`chat/onboarding/composer-key-bar.ts`, the card's new `onState`): the card's words and its one action while the key is not ready, read again after each new reply or failed send.
  - Checks: ui-components `pnpm check` passed; vitest over threads, onboarding, model-access, threads-widget and chat-widget: 11 files, 100 tests passed; Core structure audit passed.
- **Home "Could not check what needs you": not yet confirmed live.** The panel was building on the audit's data under the slot `t925-trace` when the pause came; I stopped it and released the slot. The probe script is `scratchpad/home-probe.mjs`: sign in, then call `list-conversations` (no project), `list-recent-flow-runs`, `list-workspace-flow-summaries`, and each project's `list-conversations`. The candidate cause is in Core `framework/automation-service/service/conversation-requests/list.ts`, which is t911's file: one project's `withStore` or row failure fails the whole cross-project list.
- **To resume:**
  1. Hold a slot, start the panel on the audit's data, run the probe, and send the lead the failing read and its cause.
  2. Stop the panel and release the slot.
  3. Rebuild ui-components and the extension through slots, and re-run the extension chat and settings tests.
  4. Wait for the t928 merge, then do phase 3 steps 1-4.

## Whole-UI wave (2026-11-17/18): journey audit, visual sweep, fixes
User (via lead): "IT SHOULD BE SECURE BUT ALSO VERY EASY FOR PEOPLE TO USE! ... install the extension, create account/log in, connect extension (or any other client), add key, and be able to start talking to fluxiq via client OR panel immediately. No extra steps of any kind!" and "there are still quite a few small issues/bugs that cause weird looking experience".

### Audits
- **Journey audit** (worker-heavy; report `key-security-ux/journey-audit.md`):
  - Step maps for four journeys, an ideal journey of 4 clicks and 2 screens that keeps pairing approval, and a 14-item fix list.
  - Main blocker: neither client can save a key yet (in flight: t928).
  - Home's "Could not check what needs you" was caught live: `list-conversations` returned 400 "schema migration lock was lost", from Core `schema-migrations.ts:128-129,232`, while the first pairing creates a project. Routed to t911, along with the robustness of the cross-project list (`list.ts`).
  - One security finding was kept off-repository; the lead fixed it on Core dev (`96b33bbc3`).
- **Visual sweep** (Sonnet; report `key-security-ux/visual-sweep.md`): 28 findings, with layout-shift measurements. Settings' CLS was 0.16 at 1440 and 0.39 at 390. It stopped early because `renew` re-queued its slot; the lead has since fixed the slot tool.

### Fix workers (Sonnet; reports beside this one)
- `extension-flow`:
  - the connection request goes out by itself (Journey 1: from 4 steps and a Connect click to 3 steps and no clicks);
  - Connect replaces Disconnect after a disconnect; one key card;
  - "Access was removed" and "Not connected" replace the false "approved";
  - the theme follows the device on first run.
- `panel-chrome`:
  - toasts, modal footers, buttons no longer 140-175 px tall on phones, dev pages at 390, pairing-modal rows;
  - the top bar's second row is reserved at 390 (the main cause of the layout shift there); the Ask button;
  - the pairing dialog names the browser; Saved logins opens;
  - sign-in hints (P1, P3, P28, E6's panel side).
  - Its own checks could not run: the slot never came. My checks below cover its files.
- `panel-pages`:
  - chats: assistant chats named "Assistant", untitled ones named from their first words; New chat no longer keeps the old URL;
  - Projects refreshes after a create from the header;
  - Settings' layout shift and column;
  - Home's Connected card shows approved, waiting and folded rows, and drops revoked ones;
  - Activity says "tried to add a key" unless the result is known;
  - hierarchy and programs fixes.
- `assistant-shared`:
  - a message with no project goes to the person's own assistant thread (Journey 2 needs no project step);
  - the chosen project survives a reload and `?project=`;
  - one scrollbar look; the dock's key card is not clipped, and there is only one no-key card.
- `extension-visual`: sweep #20-#25 and the stale step words. It found why the extension's chat list missed assistant chats (the background read only project chats).
- `extension-loose-ends`, the lead's grants:
  - the background merges `list-panel-threads` into the extension's chat list;
  - E6: `purpose: "pairing"` opens home with `?pairing=1`, and the approve step uses it;
  - "Extract Data From This Page" is now "Extract data from this page" in the UI and in the Lab's journey (its unit test passes; no provider-free live journey exists to run).

### My integration edits
- **Hidden-path fix:** `is-hidden-panel-path.ts` no longer reaches into Settings, which failed the structure audit and would have pulled Settings code into the middleware. It lists the one own path, and a test keeps it equal to Settings' list.
- **Panel theme:** follows the device on first run (`parse-theme.ts`, `read-theme.ts`, the init script, the Appearance wording, and tests).
- **Assistant title:** the empty chat is titled "FluxIQ assistant" (`panel-chat-options.ts` with a test).
- **Pairing layout test:** updated, because the browser's name moved from a row into the title.
- **Quickstart** (`docs/user/quickstart.md`): sections 1-2 rewritten for t927's one-time setup link, the extension's three steps, and the automatic connection request. admin/admin and `/get-started` are gone.

### Checks (observed, each through the slot queue)
- `pnpm --filter @fluxiq/ui-components check` -> exit 0. `vitest run src/chat src/model-access src/theme` -> 117 files, 777 tests passed. `ui-components:build` -> exit 0.
- `pnpm --filter @fluxiq/web check` -> exit 0.
- web vitest over app/tests, app/product, app/styles, app/connect, app/(panel), panel-shell, chat-widget, settings-page, chats, projects, security, home, programs, automation-studio/hierarchy, model-keys and accounts -> 1 failed, 1,465 passed. The failure was the outdated pairing layout test; after updating it, the pairing tests passed 15 of 15.
- `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0. `test-extension.mjs` over 13 panel folders, shared/tests and background/panel -> 805 tests, 805 pass.
- `node scripts/structure-audit.mjs` -> Core "passed (552 warning(s), 914 baselined)"; extension "passed (253 warning(s), 551 baselined)".

### Not verified
- Nothing of this wave has been seen live yet. The after-screenshots wait for t928 to be merged into t925, so they show the real key journey.
- A saved key in either client (t928).
- The extension's merged chat list and the `?pairing=1` sign-in against a real Core.
