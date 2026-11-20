# Design review: key-security-ux Phase 2 (t925)

## Outcome
Done. Read-only review of `reports/key-security-ux.md` "Phase 2: design" against both audits, the standing rules and the code. 18 problems, most severe first. Paths: W = Core `apps/web/src`, U = Core `packages/ui-components/src`, F = Core `packages/fluxiq/src`, C = Core `packages/contracts/src`, X = extension `apps/extension/src`.

## Problems and corrections

1. **The fix plan leaves the shared chat (U/chat) with no owner, so its own surfaces cannot change.** The composer placeholder "Chat unavailable" (U/chat/conversation/composer.ts:65,267), the circular "Add one in FluxIQ" line (U/chat/view/empty-state-model.ts:46), the duplicate thread title (U/chat/view/thread-header.ts, E13), the onboarding words (U/chat/onboarding/model-unavailable-words.ts) and `ChatModelsPort` itself (U/chat/ports/transport.ts:168-170) all sit in U/chat. shared-model-access owns only `U/model-access/`; panel-keys owns W/features/chat-widget, which holds only the adapter. Without U/chat, the design's "composer's disabled reason", "dock's empty state", the extension's "chat's empty state" and "composer hint" (design lines 60-61) cannot be built. **Correction:** give shared-model-access U/chat/{conversation/composer.ts, view/empty-state*.ts, view/thread-header.ts, onboarding/**, ports/transport.ts, ports/index.ts, tests/message-transport.ts}, plus the U root barrel.

2. **The extension's setup card and Settings do not use `ChatModelsPort`. They read the key through a second interpreter that duplicates Core.** X/panel/getting-started/extension-setup-port.ts:9-18 (`SetupPort.readModelKey`) and X/panel/settings/settings-view.ts:280 use X/panel/getting-started/model/key/from-reply.ts. Core's `readModelReadiness` (U/chat/onboarding/model-readiness.ts:13) parses the same `panelModelReadiness` reply a second time, for the chat (X/panel/chat/transport/ports/models.ts:7-13). Two parsers already disagree in type: `ModelKeyReading` has an object code, while Core uses a string. The design says the extension "keeps only the port adapter" but names the wrong seam. **Correction:** the extension's `SetupPort` becomes a thin wrapper over the same port and Core's reader (or `U/model-access`'s), and the X key-reading module (`getting-started/model/key/from-reply.ts`, `reading.ts`, `unavailable-line.ts`) is deleted. Then a single interpreter remains.

3. **Better still, the extension's setup card should not exist as extension rendering.** X/panel/getting-started/setup-card.ts:1-7 is a DOM card that hides Core's own key line with CSS and replaces it, so the extension renders key state that the panel dock renders from Core. Under "the extension's chat renders from Core with a thin adapter" (AGENTS.md, Repository Boundaries), the compact `ModelKeyCard` belongs in Core's chat empty state (U/chat/view/empty-state.ts), hosted by both the dock and the extension. **Correction:** mount the compact card from U/chat in both clients. Retire setup-card.ts (keep the getting-started steps 1-4 in X). Only X/panel/settings mounts the full card itself. It can, because both X/panel/settings and U are plain DOM (U package.json: "chat UI as plain DOM and CSS"; settings-view.ts builds with `createElement`).

4. **Extending `ChatModelsPort` with save/replace/remove/check breaks every implementer and puts a write path into the chat's read port.** The port is `{ readKeys() }` (U/chat/ports/transport.ts:168-170). Its implementers are W/features/chat-widget/transport/models-port.ts:10 and X/panel/chat/transport/ports/models.ts:7, and its test double is U/chat/tests/message-transport.ts:170. Its contract says "never a key's value". Settings is not the chat. **Correction:** define a separate `ModelKeysPort` in `U/model-access/` (read, save, replace, remove, check; the value is sent and never returned). Leave `ChatModelsPort` read-only or derive it from the new port. State in the brief that the pasted value must never be put in extension storage, logs, the problem report (X/panel/settings/problem-report-section.ts) or a relay error.

5. **The revoke signal is a Core gateway gap, not only `X/background` (lead item 4 is mis-addressed).** The contract exists: `server.revoked` with `revoked_by_user` (C/client-gateway/message/server-message.ts:21, C/platform/gateway/revocation-reason.ts:17-26). The local revoke never sends it. F/client-gateway/service/access.ts:108-119 only records an audit entry and calls `disconnect(sessionId, "client trust revoked")`. On reconnect with the revoked token, F/client-gateway/service/lifecycle.ts:159-172 issues a new pairing challenge by itself. So "do not re-request pairing until the person presses Connect" cannot be done in the extension alone, and the extension handles no `server.revoked` at all (grep in X finds none). **Correction:** lead item 4 = Core sends `server.revoked {reason}` before closing in `revokeTrustedClient`; the extension background handles it (drop the credential, stop auto-reconnect, push "removed" to the side panel); the gateway answers a revoked token's hello without auto-pairing, or the extension stops sending one. This needs a Core-boundary alert.

6. **No push of key state exists; the design should say so and use what does exist.** The panel change stream carries only `gateway`, `conversation` and `activity` events (W/features/panel-changes/types.ts:41; W/app/api/panel/changes/panel-change-stream.ts:115-116). No key topic exists. The extension only polls every 4 s while the key is missing or unavailable, and it stops once the key is "ready" (X/panel/getting-started/model/key/reader.ts:13,40). A key that goes bad after ready is not seen until the panel regains focus. **Correction:** keep lead item 1. For pairing, which already has a push, tell panel-keys to drive Home's pairing card (E8) from the existing `useGatewayChanges` (W/features/client-gateway-changes/subscription.ts, already used by W/features/settings-page/connect/use-connect-view.ts:4) instead of the one-shot `loadClients` (W/features/home/HomePage.tsx:27).

7. **The "could not be opened → Paste it again" row is wrong for two of the four real codes, and one current sentence is an unlock step.** The real codes are `legacy_recovery_required | host_protection_unavailable | ciphertext_invalid` (C/platform/model-keys/availability.ts:2-4), plus `upgrade_required` (U/chat/onboarding/model-readiness.ts:7). Pasting again cannot fix `host_protection_unavailable` (the host cannot open any key) or `upgrade_required` (an old FluxIQ). `legacy_recovery_required` today says "Sign in to the FluxIQ panel once to finish upgrading it" (model-unavailable-words.ts:7), which is a sign-in step between a connected client and the model and is forbidden by the connected-client rule. **Correction:** map only `ciphertext_invalid` to "Paste it again". Map `host_protection_unavailable` to a host-setup state ("This FluxIQ server can't open saved AI keys. Whoever runs it needs to finish its setup.") and `upgrade_required` to "Update FluxIQ". Send `legacy_recovery_required` to the lead/t924 as a backend fix (migrate without a sign-in), not as UI wording.

8. **"Ready" after a free check will still lie about credit, and nothing updates the state from real calls.** No key-check code exists in F (no `/v1/models` or `/models` call; the adapters only POST to F/runtime/models/providers/anthropic/messages.ts:12 and deepseek/endpoints.ts:2). A free check is plausible: Anthropic `GET /v1/models` and DeepSeek `GET /models` answer 401 for a bad key without billing. But Anthropic's listing does not reveal an empty balance, which shows up only on a real message. So the "provider refused … has credit" row cannot come from the check, and P11's contradiction returns (card "Ready", chat refuses). **Correction:** lead item 2 also needs the runtime to record a provider refusal (auth or billing) against the key and move its state, and the check needs a separate "no credit" state that only a real reply sets. DeepSeek has a free balance endpoint (`GET /user/balance`) that the check can use. The check must run in Core: the extension's structure audit forbids provider hosts in X.

9. **The panel partition is not disjoint, and several needed files have no owner.**
   - Settings > "Connect a client" (P20 JSON, the steps) is W/features/settings-page/connect/** (panel-keys), but the design moves it to Security > Devices and apps (panel-security).
   - The key manager page W/features/security/page/SecurityKeysPage.tsx, its route W/app/(panel)/security/keys/page.tsx and W/features/security/data/load/key-rows.ts all belong to panel-security, while panel-keys does the key work.
   - W/features/security/index.ts (barrel) and security.css (needed for the tab bar) are in neither glob.
   - Settings > Advanced needs a route under W/app/(panel)/settings/** (it has `[tool]` and page.tsx), which nobody owns.
   - The top bar's Sign out is in W/features/panel-shell/** (W/app/(panel)/layout.tsx:4), which nobody owns.

   **Correction:** panel-keys takes security/{page/SecurityKeysPage.tsx, data/load/key-rows.ts}, the keys route and W/app/(panel)/settings/**. panel-security takes settings-page/connect/** and panel-shell (account menu). The supervisor owns the security barrel and CSS, or gives them to one worker and has the other import read-only.

10. **There is a fourth "add a key" link that nobody owns.** Flow settings link to keys via W/features/automation-studio/settings/ai-provider-model.ts:33 (`AI_PROVIDER_SECRET_KEYS_HREF = "/security/keys"`), and W/features/settings-page/model/engine-tools.ts:20 also points there. Once AI keys leave /security/keys, both send people to the wrong place. **Correction:** add ai-provider-model.ts to panel-keys and point every link at Settings > AI keys. X/panel/open-fluxiq/open-fluxiq-button.ts:63 (`purpose: "model-key"`) also needs an owner beside X/shared/fluxiq-web-routes.ts:48-49.

11. **Removing PIN prompts in the UI alone locks out any account that already has a PIN.** The server requires "current password and configured PIN" to add a key and "all configured factors" to remove one (Core docs/programs/global-programs.md:77). remove-key.ts:28-35 and W/features/accounts/proof/ProofForm.tsx:53 branch on a PIN, and IdentityAccessLive.tsx:336 still lets a person set one. **Correction:** lead item 3 must also cover the identity-access side. Stop requiring or offering a PIN, and clear any existing PINs, before the UI drops the PIN field.

12. **The cause of the 400s is already visible, so it is not open work.** remove-key.ts:24-31 always calls `identity-access/mint-press-grant` first and falls back to a plain delete only by matching error text (`NO_CONFIRMATION_NEEDED`, `PIN_ON`). Each miss is a failing call and an Activity row (P16, P32). **Correction:** state in panel-keys' brief that removal makes a single call once lead item 3 settles the authorization, and that error text is never matched.

13. **Hiding "Credential vault: Locked" may hide a real lock.** IdentityAccessLive.tsx:332 reads `snapshot.vault.unlocked` from identity-access (F/programs/identity-access/runtime/service.ts:74,480,491). The rule says "hiding a locked UI is not a fix". **Correction:** before removing the row, the lead or t924 confirms that the vault state gates nothing on model access or key saving. If it does, the fix is a backend fix.

14. **Package and contract files the shared worker needs are outside "U only".** A new `model-access` stylesheet needs `exports` and `files` entries in Core `packages/ui-components/package.json` (only chat, tasks and library CSS are exported). The package is published (`publishConfig`), so a feature needs a minor version bump there. Base radio and checkbox styles in U will not reach the React `KeyList` (W/features/settings-page/ui/KeyList.tsx) unless W renders `ModelKeyCard` or imports the sheet. **Correction:** add package.json to shared-model-access. State whether the W key list is replaced by the U card; if it is not, P10 is fixed in W/features/settings-page/ui/settings-page.css.

15. **Discovery-based address is feasible; it should also fix the false "Done".** X/panel/getting-started/reachability/reader.ts:31-39 already fetches `/.well-known/fluxiq` but accepts any 200. The discovery document carries `gatewayUrl` (C/platform/discovery/discovery-document.ts:48), and `<all_urls>` is granted (manifest.chrome.json:27-28). **Correction:** parse the response with Core's discovery reader, show "Done" only for a valid FluxIQ document, and take `gatewayUrl` from it (E1, E2).

16. **Save, replace and remove over the gateway: the transport already exists.** The background already calls the Secret Keys program as the paired client (X/background/automation-relay/automation-relay.ts:162-163, `deps.call("snapshot", {}, "secret-keys")`). Lead item 3 therefore reduces to (a) authorization in secret-keys for a session or paired-client caller and (b) three relay cases in X/background and their protocol types. No new gateway message is needed.

17. **Findings that fall through, with no design line, no lead item and no "left" mark:**
   - P3: sentences run together; lockout. AuthShell ownership is requested, but nothing in the design addresses this.
   - P12: draft lost on layout switch; "Open a project to start a conversation".
   - P14: using a key updates "last revealed".
   - P17: model pick changed the workspace-key note.
   - P30: "Invite sent" claimed with no mail service.
   - P32: hex key ids need names from the server.
   - P36: hidden dialog.
   - E5: "Open FluxIQ below" under the wrong step, untitled row, unexplained Cancel, no expiry warning.
   - E6: sign-in page does not mention the waiting pairing.
   - E8 tail: Home "Could not check what needs you." (W/features/home/sections/HomeNeedsYou.tsx:20).
   - E11: "Not now" link style and the two empty-state texts. Listed in group 8, but not in the fix plan.
   - E13: duplicate title.
   - E18: no "signed in as" line; permissions ticked by default; disabled "Allow direct requests: Unavailable".
   - E20: Disconnect stays visible.
   - E21: "ids" in the problem report.
   - E22/E23: scrollbars.

   Fix it in, assign it, or list it as knowingly left. P13 and E12 are correctly deferred to t924.

18. **Plain-language and truth problems in the proposed wording.**
   - "Claude is ready" and "Checking with Anthropic..." are wrong for a DeepSeek key. Use the key's provider name.
   - The badge "Add it again" is an instruction, not a state; use "Can't open".
   - "Turned down" is clearer as "Not accepted".
   - The `unknown` row says "Connect to FluxIQ" even when connected and the read failed (`readModelReadiness` returns `unknown` on any error, model-readiness.ts:17,52). Keep two sentences: not connected, and "Couldn't check your AI key just now".
   - The remove confirmation "chats stop until you add another" is false when another key or a workspace key remains, and Flows without AI keep running. Make it conditional.
   - "Saved passwords for Flows" understates what custom Flow secrets hold. Use "Saved logins and keys for Flows".
   - Hiding sharing for a solo owner is safe only if t924 confirms that the owner's own key serves the extension chat without "offer" or "workspace key" (E12 suspects the opposite). Add this to lead item 1.

## Commands run and observed results
Read and Grep only, plus `grep`/`sed`/`ls` in Bash for targeted reads. No builds or tests. The panel on 3100 was not touched.

## Not verified
- Whether identity-access's vault state gates model access (13).
- Whether secret-keys accepts a paired client's identity for writes (16).
- Whether a solo owner's own key is used by the extension chat without offering it (18).
- Whether Anthropic `/v1/models` is free and silent on balance is from provider knowledge, not tested.
- Line numbers come from grep at review time.

## Open questions or contradictions found
- The design's lead item 4 names only `X/background`, but the gap is in Core's gateway (5).
- The design moves the connect steps into Security while the folder stays with panel-keys (9).
