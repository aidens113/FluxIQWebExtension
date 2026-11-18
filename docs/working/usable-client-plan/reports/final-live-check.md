# Final live check (task t915)

Date 2026-11-16. Chromium headed, built extension (apps/extension/dist/chrome), panel http://127.0.0.1:3000 (production build), gateway ws://127.0.0.1:4777/client. No model key, no paid calls, no source edited.
Screenshots and scripts: `C:/Users/osrs_/FluxStuff/fxwork/t915/!FluxIQWebExtension/test-runs/usable-client-final/` (a1, b1, c1, c2 .mjs; shots below by number).

## Build and start
- Core libs (contracts, sdk, fluxiq, client-gateway-websocket, ui-components) built, exit 0. Extension build exit 0; guard: "FluxIQ Core's build at ...fxwork\t915\!FluxIQ is current with its source."
- Panel: `node scripts/run-fluxiq-web.mjs`, web build took about 520 s, then "Ready in 6.3s". Log: scratchpad/panel.log. STILL RUNNING (curl / returns 200).
- Test owner sign-in works with the existing test password; it is written to `test-runs/panel-test-credential.txt` for the audit workers (git-ignored, not printed here).

## Checks
| | Check | Result | Evidence |
|---|---|---|---|
| a | Switcher lists panel projects | Works: shows Walkthrough C, My automations, Walkthrough B2, Walkthrough A | 21-switcher |
| a | Project made in extension on panel Projects | Works: "Final Check Project" present | 25-panel-projects |
| a | Its chats on panel Chats | Works: both chats listed under Final Check Project | 26-panel-chats |
| b | Distinct titles from first message | Works on the panel and after reopening the list ("Plan my weekly grocery run", "Check flight prices to Lisbon"). Minor: right after sending, the extension's own Chats list still shows the newest chat as "New chat" until reopened | 24-chatslist, 27-chatslist-reopen |
| c | No key: plain message | Works: "no model key is set up yet, so add one in Settings, under AI keys". But the reply still opens with the old "I could not tell what you wanted done... such as run the kettle flow" (see Trip hazards) | 23-chat-a, 23-chat-b |
| d | Header names project at once | Works: "Walkthrough C" at 0.3 s on open; after create the header showed the old name at 0.3 s and "Final Check Project" by 2.5 s | 20-ext-open-0.3s, 22-after-create |
| e | Panel Assistant pane | Works: shows its intro, "FluxIQ needs a model key... Add a model key" button; composer says "Chat unavailable" | 03-home-assistant, 02-projects |
| f | Pairing pop-up layout and Approve | Works: laid out cleanly (client, id, code, time left, Reject/Confirm pairing); Confirm pairing paired the extension, composer 2.5 s later | 12-panel-pairing-modal, 14-ext-paired |
| g | No unlock/password/key step after pairing | Works: none seen; no password field in the modal; ext Settings says "FluxIQ approved this browser" | 14, 28-ext-settings |
| h | Page timings | Mostly as before; Home is slower (below) | table |

## Timings (ms, shell / content / network idle, requests)
Round 1 / round 2. Home 755/2086/2908 (46) / 227/1979/2476 (47). Projects 191/243/900 / 210/243/822. Chats 192/219/1034 / 159/193/1088. Flows 425/438/920 / 192/272/778. Runs 167/201/1724 / 162/190/1244. Data 199/211/1392 / 204/227/1023. Security 221/259/1143 / 178/213/957. Settings 242/272/1093 / 365/377/943. Requests 37-47 per load.
Regression: Home content is about 2.0 s, versus 0.2-0.5 s in the earlier walkthrough; every other page is the same or faster. Cause not traced.

## Free model-access proof
`node packages/test-runner/dist/extension-chat-check/cli.js --browser chrome --scenario everything-store --page ./ --no-ask --model-key` ran beside the running panel (no port or build-directory clash). Exit 2: `failure:null`, 19 of 20 checks true, including every modelAccess and noUnlockPrompt check (configured-later, after-panel-logout, after-reconnect, after-core-restart, approved-without-password), approvalNeedsNoSecondPassword, revoke checks.
The one false check: `configurationHasNoUnlockFragment`. The proof (packages/test-runner/src/extension-chat-check/prove/approved-client/prove.ts:98) requires the "model-key" Open FluxIQ address to be exactly `<coreApi>/programs/secret-keys`. The extension now builds it via `fluxIQWebPageAddress({kind:"keys"})` and the panel keeps keys in Settings, so this is probably a stale assertion, not a product fault. I did not confirm the actual URL.
Evidence: `C:/Users/osrs_/FluxStuff/evidence/t198/2026-11-16T21-04-19-739Z-chrome/` (result-chrome.json, 6 scenario shots). Log: scratchpad/proof.log.

## Trip hazards for a person testing
- Chats created earlier (before the fix) keep their stored old reply and "Untitled chat" title on the panel; use new chats.
- The no-key reply still leads with the "kettle flow" example before the key instruction.
- Console shows one 401 and one 400 per sign-in (login page); harmless but noisy.
- Extension "Get started" checklist, before pairing: steps 1 and 2 read "Next"/"To do" although FluxIQ is running.
- The inline "Approve" in panel Settings (one such button on the page) sits behind the modal backdrop while the modal is open; only the modal button works.
- The same extension profile reuses its client id across reopen; pairing state persists.

Outcome: Partial
Changed: test-runs/usable-client-final/*, test-runs/panel-test-credential.txt (both git-ignored), this report
Validation: builds exit 0; panel "Ready in 6.3s", curl 200; walkthrough checks a-h as above; proof exit 2 with 19/20 checks true
Not verified: real side-panel docking; real model key; Firefox; whether the proof's failing check is a stale test or real URL mismatch; cause of slower Home
Report: C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/usable-client-plan/reports/final-live-check.md
Notes: Panel left running on :3000 (gateway :4777). Proof failure is one address assertion, all access checks pass.
