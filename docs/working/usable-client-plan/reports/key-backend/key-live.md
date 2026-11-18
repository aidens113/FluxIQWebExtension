# key-live (t928, key-backend): live headed proof

## Outcome

Done. All six steps passed on the production build, in a headed browser, with no password, PIN or code at any point. Two paid Claude calls were made, both chat messages. The key value appears 0 times in every file written.

Evidence is under `C:/Users/osrs_/FluxStuff/fxwork/t928/!FluxIQWebExtension/test-runs/t928-key-proof/` (git-ignored). The scripts that produced it are in `scripts/` there.

## What changed and why

No source was edited. The only new files are the evidence folder, this report, and this tree's own `.fluxiq`, which `setup-fluxiq` created on first start.

Setup:
- `scripts/run-fluxiq-web.mjs` ran from the extension tree with `PORT=3300 FLUXIQ_CLIENT_GATEWAY_PORT=5077 FLUXIQ_PUBLIC_CLIENT_WS_URL=ws://127.0.0.1:5077/client`. `FLUXIQ_INSTANCE_ID`, `CLAUDE_API_KEY`, `ANTHROPIC_API_KEY` and `DEEPSEEK_API_KEY` were unset.
- **The build passed** (`panel.log`): "✓ Compiled successfully in 3.4min", then "Runtime build identity is stamped: no placeholder in 1375 server files". build-cache took 394 s, then "✓ Ready in 4.5s" and "Client gateway WebSocket bound ... at ws://127.0.0.1:5077/client".
- The browser was a headed Playwright Chromium 134 with `apps/extension/dist/chrome` loaded unpacked (built 2026-11-18 02:03; it contains `fluxiq.panel.modelKeySave`). Its profile was a temp folder of its own.
- Steps were driven over CDP on 127.0.0.1:9333. Port 4000 was never bound.

## Steps, observations, evidence

**Sign-in and pairing** (`step1-signin-pair.json`, `01`–`07-*.png`)
- I signed in through the panel's own form as admin/admin. The first-sign-in step ("Replace the temporary password") appeared, and I completed it with a test password for this disposable tree.
- The extension sent `fluxiq.connect` from its side-panel page and went to `pairing` with reference code 759041.
- The panel showed its "Client pairing request" modal with the same code (`05-panel-confirm-pairing.png`), and I clicked **Confirm pairing** there.
- The extension then reported `connected` with a session id (`06-sidepanel-paired.png`).

**1. GET /api/keys** (`step1-get-keys.json`)
- Signed in, it answered **200** `{"keys":[]}`, not 503.

**2. Panel writes, no credential** (`step2-panel-key-writes.json`, `08-*.png`)
- The calls were made from the signed-in panel page with only the browser cookie.
- `save-model-key {provider:"anthropic", value:<dummy>}` → 200. `modelAccess.status` was **`provider_refused`**, with the message "Anthropic (Claude) refused the saved model key, so check or replace it in Settings, under AI keys." The key was "Anthropic key", model claude-sonnet-5-5, and `lastCall.outcome` was `provider_refused`.
- `replace-model-key {value:<other dummy>}` → 200, still `provider_refused` (same key id, new check).
- `remove-model-key {}` → 200, `no_key`.

**3. Extension writes, no credential** (`step3-extension-key-writes.json`, `09-*.png`)
- `fluxiq.panel.modelKeySave` → `{ok:true, payload:{modelAccess:{status:"provider_refused", key:{name:"Dummy", provider:"anthropic", model:"claude-sonnet-5-5"}}}}`.
- `modelKeyReplace` → ok, `provider_refused`.
- `modelKeyRemove` → ok, `no_key`.
- None of the answers had a key `id` (the file contains no `"id"` at all), and none echoed the value.

**4. Push to both clients** (`step4-push.json`, `10-*.png`, `11-*.png`)
- Listeners only recorded what arrived: `chrome.runtime.onMessage` on the side-panel page, and an `EventSource('/api/panel/changes')` on the panel page. Neither page reloaded or polled the server, and nothing arrived before the saves.
- **Panel save:**
  - The side panel heard `fluxiq.panel.modelAccessChanged` twice: `ready` at +39 ms, then **`provider_refused` at +160 ms**. Neither carried a key id.
  - The panel stream emitted `event: model-access` `{"version":1}` at +40 ms and `{"version":2}` at +163 ms.
- **Extension save:**
  - The panel stream emitted `event: model-access` versions 3, 4 and 5, at +48, +71 and +169 ms.
  - The side panel also heard `ready` (+69 ms), then `provider_refused` (+163 ms).
- Clean-up: `remove-model-key` twice, ending at `no_key`.

**5. Real key** (`step5a-real-key-save.json`, `12`, `13-*`, `14`–`16-*`)
- The value was read from `.env.local` inside the script and passed only in the runtime message.
- `modelKeySave` from the extension → `ok:true`, **status `ready`**, key "Claude (t928 live proof)". There was no key id and no echo.
- Extension chat: I typed in the side panel composer: "Hello! This is only a question, not a task: in one short sentence, what are you?". Real reply after about 2 s: "I'm the FluxIQ assistant that operates the control panel for you, building, improving and running Flows that automate tasks on websites in your browser." (`13-extension-chat-answered.png`)
- Panel chat: I picked project "My automations" in the top bar, pressed New chat in the assistant, and typed: "Hi from the panel! Only a question, not a task: in one short sentence, what can you help me with?". Real reply after about 3 s: "I can help you work with FluxIQ on your behalf, such as creating flows, ..." (`16-panel-chat-answered.png`)
- Afterwards I removed the real key from this tree's store with `modelKeyRemove` (→ `no_key`, `step5d-real-key-removed.json`), so no real key is left saved there.

**6. Key scan** (`step6-key-scan.json`)
- I searched for the value, as UTF-8 and UTF-16, in three places:
  - the evidence folder: 33 files, **0** occurrences;
  - my scratch folder, including the whole Chrome profile: 337 files, **0**;
  - this tree's `.fluxiq`: 16 files, **0** in plaintext;
  - the copied scripts: **0**.

**Shutdown**
- I killed the browser tree and the panel tree (run-fluxiq-web → pnpm → next start).
- Afterwards, `netstat` showed no LISTEN on 3300, 5077 or 9333; only TIME_WAIT entries remained.
- Slot `key-live` was released.

**Paid calls:** two chat messages, one per client. Each was answered after 2–3 s, which fits one call each. The free check (GET /v1/models) also ran on every save.

## Commands run and observed results

- `node .../heavy-slot.mjs acquire key-live 60` → waited about 25 min in line, then "key-live holds a slot". `renew` → "renewed for 60 min". `release` → "key-live released".
- `env -u FLUXIQ_INSTANCE_ID ... PORT=3300 FLUXIQ_CLIENT_GATEWAY_PORT=5077 FLUXIQ_PUBLIC_CLIENT_WS_URL=ws://127.0.0.1:5077/client node scripts/run-fluxiq-web.mjs` → build passed, server ready. The exit code 1 at the end comes from my taskkill.
- `node step1-signin-pair.mjs`, `step2-panel-writes.mjs`, `step3-extension-writes.mjs`, `step4-push.mjs`, `step5a-real-key-save.mjs`, `chat-send.mjs side ...`, `chat-send.mjs panel ...`, `remove-real-key.mjs` → results as above.
- `node scan-key.mjs <evidence> <scratch> <.fluxiq>` → 0 / 0 / 0.

## Not verified

- **Exact number of provider calls per chat message.** The store keeps no per-call record (only the last outcome per key, in the model-access ledger), and the panel log prints nothing per call. "One call each" is inferred from the 2–3 s replies and the plain-question wording, not measured.
- The side panel opened as an extension tab (`sidepanel/index.html`), not Chrome's docked side panel. It is the same page, the same runtime messages and the same broadcasts.
- The panel's key UI (t925's card) is not on this branch. I made the calls its card makes, from the panel page.
- Firefox was not tested.

## Open questions or contradictions found

- **Transient `ready`.** Each dummy save first pushes `ready`, then about 120 ms later `provider_refused`, once the free check fails. A client could flash "ready" briefly. This may be intended (save, then check); worth a decision.
- **Side panel banner lag.** It still showed the "Add a model key" banner 1 s after the real key answered `ready` (`12-sidepanel-real-key-saved.png`). By the next screenshot, about a minute later and with no reload (`13-extension-chat-typed.png`), it was gone. So it does update by push, but the delay was not measured.
- The brief's "Not accepted" for `provider_refused` is presumably t925's UI label. The status matched; the server message is the sentence quoted in step 2.

## Recheck after the notice fix

The lead asked for this recheck after Core's notice fix. It was step 4 only, with no paid calls: no real key and no chat. The rules were the same as before: slot `key-live`, ports 3300 and 5077, `FLUXIQ_INSTANCE_ID` unset, a headed browser, and the tree's own `.fluxiq`.

**Setup**
- `scripts/run-fluxiq-web.mjs` rebuilt the production web build because packages/fluxiq had changed (`panel-recheck.log`). It passed: "✓ Compiled successfully in 2.3min", then "Runtime build identity is stamped: no placeholder in 1375 server files", then "✓ Ready in 3.7s".
- The panel accepted the signed-in session: `GET /api/keys` answered 200 `{"keys":[]}` (`recheck-get-keys.json`).
- The extension reconnected as an already-trusted client with no new pairing: `connected`, with a session id (`recheck-signin-pair.json`, `r01`–`r07-*.png`).

**Method** (`step4b-push-recheck.mjs`)
- Listeners only, as before: `chrome.runtime.onMessage` on the side-panel page and an `EventSource('/api/panel/changes')` on the panel page. Neither page reloaded or polled.
- After each write I recorded everything that arrived in the next 4 s. Nothing arrived before the first write.

**What arrived after each write** (`step4b-push-recheck.json`, `17-recheck-sidepanel-after-panel-writes.png`, `18-recheck-panel-after-extension-writes.png`; times are ms after the write started)

| Write | Answer | Side panel `modelAccessChanged` | Panel stream |
| --- | --- | --- | --- |
| panel `save-model-key` (dummy) | `provider_refused` | exactly one: `provider_refused` at +1089, no key id | `model-access` v1 and v2, both at +1096 |
| panel `replace-model-key` | `provider_refused` | exactly one: `provider_refused` at +119 | `model-access` v3 and v4, both at +125 |
| extension `modelKeySave` | `provider_refused` | exactly one: `provider_refused` at +148 | `model-access` v5 and v6, both at +151 |
| extension `modelKeyReplace` | `provider_refused` | exactly one: `provider_refused` at +148 | `model-access` v7 and v8, both at +152 |

**Result**
- No `ready` broadcast arrived for any of the four writes. Before the fix, `ready` arrived about 120 ms ahead of `provider_refused`.
- Each panel stream event now comes after the free check.
- The stream still emits two `model-access` events per write, but both arrive in the same millisecond, after the check. This is harmless: each event carries only a version and prompts a re-read.

**Clean-up**
- `remove-model-key` twice: first → `provider_refused`, then → `no_key`. Two keys existed because the extension's save added a key beside the panel's.
- The side panel heard `provider_refused`, then `no_key`. No dummy key is left.

**Shutdown**
- I stopped the browser and the panel trees.
- No listener remained on 3300, 5077 or 9333.
- Slot `key-live` was released.

**Key scan (recheck)**
- Evidence folder: 65 files, 0 occurrences.
- Scratch folder, including the profile: 390 files, 0 occurrences.
