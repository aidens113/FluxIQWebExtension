# t198: the extension chat can build and run automations (lane report)

## Fix log

- **r1 design** (2026-09-30), below. Four workers were dispatched in parallel on disjoint files:
  - W1: Core executor and API wiring (worker-high).
  - W2: Secret Keys unlocked-session lookup.
  - W3: extension relay.
  - W4: web panel through the executor.
- **r1 landed.** All four report Done, and the lead re-ran each worker's checks.
- **Lead fix 1, extension.** W3's relay turned a failure into an empty value in 3 places (`conversation-relay.ts`, `page-url.ts`, `panel-control-deps.ts`). The extension structure audit (`failure-as-empty`) failed on them, and W3 had not run the audit.
  - `page-url.ts` now rethrows anything but the constructor's `TypeError`, the pattern `open-fluxiq.ts` already uses.
  - A failed `chrome.tabs.query` now fails the send with a stated cause ("The browser could not say which page you are on, so nothing was sent: ..."). Before, it sent as though the person were on no page.
- **Lead fix 2, Core, a real defect found by the end-to-end test.** Answering no to "apply this change?" left the proposed change waiting. The next "improve it" was then refused at the build with `flow_bootstrap.pending_adaptation_exists`.
  - A deny on a `conversation-command.` ask now rejects the change: the new `commands/discard-change.ts` (`adaptation.reject`, `review-flow-adaptation` action `reject`).
  - It is wired through `commands/confirmed.ts` (a DECLINABLE map beside CONFIRMABLE) and the `answer-ask` handler.
  - W1's unit test that pinned "a no runs nothing" was updated.
- **Lead fix 3, Secret Keys (from W2's note).** `unlockedSessionFor` skips an unlock that opens no key. A wrong password still holds a keyless session, and with a later expiry it would have won. A test was added.
- **Lead: W5 was never dispatched.** The end-to-end test in Core could not go to a worker, because the subagent limit was full ("Concurrent subagent limit reached ... Do not retry"). The lead wrote `commands/tests/extension-chat.test.ts` itself.
- **Lead: docs and drift.**
  - Core `docs/architecture/automation-studio/client-gateway.md` gains "The chat runs capabilities in Core (conversation commands)".
  - Extension `docs/architecture/extension-client.md` gains "The chat builds and runs automations".
  - The stale `capabilities` comment in `shared/protocol.ts` was corrected, and `onScreen.pageUrl` added to its type.
  - The `client-gateway:` prefix pin in `apps/web/src/lib/tests/program-route.test.ts` now names the Core constant that depends on it.

- **r2 triage of the WIP commit 6587257d** (2026-09-30, worker). The fix log did not describe the WIP, so it was read whole. It held two pieces:
  - `apps/extension/src/background/panel/chat-page.ts` (+ test, barrel, `panel-control-deps.ts`). The chat's page is now the first active tab that is a web page and not FluxIQ's own origin: the last-focused window's first, then every window's. This is kept. It passes `check` and its 4 tests.
  - `packages/test-runner/src/extension-chat-check/` (+ the `extension-chat-check` script). This is a headed, provider-free check of the relay in Chrome's side panel and Firefox's popup, and it is kept. Its one defect: **both browsers opened pages with no network guard.**
    - Firefox launched Playwright's Firefox directly, which `guarded-browser/tests/launch-containment.test.ts` failed on.
    - Chrome used the sanctioned `launchBrowser` but never installed the route guard that `run-scenario.ts` installs after it, which the structural test could not see.
  - The fix:
    - New `extension-chat-check/chat-network-policy.ts`: the run lane's policy with the recording proxy added as a FluxIQ origin.
    - `firefox/launch-firefox.ts` installs `installDeterministicNetworkGuard` before it installs the add-on or returns.
    - `open-chrome-session.ts` installs the guard right after `launchBrowser`, before any `goto` or `newPage`, and closes the browser if it cannot.
    - The session carries `guard`, and `run-chat-check.ts` fails the check at stage `network guard` on any violation.
    - The structural test sanctions `launch-firefox.ts` and pins the order in both files.
  - Firefox limits, stated in `launch-firefox.ts`: there are no containment switches, and the add-on's background page is not a service worker, so the route guard is not known to see its requests.
- **r3 browser proof, stopped by the user's order** (2026-09-30, worker, from the `fxwork/t198` tree after the branch merged to dev as 9d3461a3).
  - Slot: `lab-slots/ui-1/owner` was claimed at 19:02:36Z and cleared (removed) afterwards.
  - Builds: extension, scenario-lab and test-runner were rebuilt, and `cli.js --prepare-core-web-build` ran. The fresh bundles contain the chat-page code.
  - **Chrome**: `node packages/test-runner/dist/extension-chat-check/cli.js --browser chrome --scenario social-network-feed --page friends/requests/`, headed, no provider, exit 2.
    - It got as far as stage `claim relay`: the isolated Core, the recording proxy and the approval Flow were saved; Chrome opened; the extension paired (`connectionState connected`); the cookie prompt was declined; and the **real side panel opened** (`panelMode side-panel`).
    - It failed there: "The panel sent no append-turn for the message within 60000 ms". The extension called only `list-conversations`, 30 times, all 200. The panel read "Couldn't send that. Try again." and, under Recent automations, "Something went wrong."
    - Evidence: `C:/Users/osrs_/FluxStuff/evidence/t198/2026-09-30T19-16-25-751Z-chrome/`.
    - So the active-tab read was **not reached**: the send was refused before `pageLocation` ran.
  - **Cause, a product defect.** The log said "extension project after selecting it: unset". The relay's send refuses with `no_project` when `connection.projectId()` is empty, and that is only the stored session value. A just-paired browser learns its project only when a recording resolves it from Core's snapshot (`connection/project-context.ts`), so a person who pairs and chats before recording could never send.
  - **Fix.** Validated by unit tests only.
    - `PanelRelayContext.projectId` may now return a promise (`panel/relay-context.ts`).
    - `panel-control-deps.ts` passes `connection.resolveProjectId("panel")`, a new method on `connection.ts` that calls `ProjectContext.resolve`: the stored project, or else Core's snapshot, then remembered.
    - `conversation-relay.ts` and `run-control.ts` await it.
    - A new test in `panel/tests/conversation-relay.test.ts` covers it.
  - **Firefox was never started**: all Labs were stopped by the user's order before it.
  - The Chrome run ended by itself. No chat-check process was left running.

## Why it could not work (confirmed 2026-09-30)

Walkthrough sections 2.5 and 6 hold. The paired path had three more blockers:

1. **The token cannot reach a build.** `apps/web/src/lib/program-route.ts` `PAIRED_CLIENT_ENDPOINTS` does not list `create-flow`, `save-flow-generation-instruction`, `generate-flow-bootstrap-adaptation` or `review-flow-adaptation`. `narrowPairedClientRequest` also pins a token's `run-runtime-session` to `no_llm_intervention`.
2. **The token never gets the person's model key.** A paired actor's session is `client-gateway:<gateway session>`. Secret Keys releases a key only to an unlocked identity session. So the chat model always fell back to offline matching for the extension, and a build would fail on the key.
3. **A build's questions go to the Flow's thread, not the chat.** The parking port is built on subject `{kind:"flow"}`.

## Design (decided 2026-09-30, lane lead)

- **Core executes a chosen capability** (`packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/`). After `respondToPersonTurn` decides `invoke` with `runNow`, `append-turn` runs the invocation server-side when Core's catalog has that id.
  - It calls the program registry in-process with the caller's own actor and scope, so every endpoint's permission and handler checks apply.
  - It refuses any endpoint not classified `read` or `authoring`: deletes and payments keep their PIN.
- **Catalog:**
  - `flow.createHere`: create, save the instruction, explore from the page, then approve and apply onto the new blank Flow.
  - `flow.describe`.
  - `flow.explore`: saves an instruction if given, builds, and applies only onto a blank Flow.
  - `flow.improve`: save the change, build with `extend`, then a confirm ask. A grant applies the change (`adaptation.apply`), and a deny rejects it (`adaptation.reject`).
  - `run.execute`.
  - `ask.answer`: the thread's pending ask, answered from the person's words.
  - Core's descriptor replaces a client's for these ids, so the extension sends ids only.
- **Long commands run in the background.** These are create-here, explore, improve and run.
  - The response says `execution.status = "started"`.
  - The result arrives as an automation turn with attachment `panel-capability-result` (ref = capability id). A failure says why it stopped and how far it got.
  - An ambient conversation context (`runtime/conversations/context/`, AsyncLocalStorage) routes the build's or run's own asks into the chat thread. It also stamps `conversationId` on activity events.
- **A paired caller spends the approving person's key only while that person has a live unlocked session** (`SecretKeysService.unlockedSessionFor`). Permissions stay the paired set.
  - This deliberately changes "no token call reaches an LLM". The HTTP allowlist is unchanged: only Core's own command, building its own payload, reaches a build.
- **The page is the start location.** `onScreen.pageUrl` comes from the active tab (http or https, at most 2048 characters, no whitespace or control characters). It becomes the build's `startLocation`. The model sees only origin and path.
- **A thread about a Flow means that Flow.** With no `onScreen.flowId`, the conversation's Flow subject supplies it.
- **The web panel keeps working.** `sendConversationInstruction` runs nothing locally when `execution` is present, and still dispatches locally what Core does not execute.

## Response contract (append-turn with capabilities)

`payload.response.execution: null | { capabilityId, status: "done" | "started" | "failed", summary, error?, flowId?, runId?, adaptationId? }`. It is null when Core does not execute the chosen id, or nothing runs now. `answer-ask` on a `conversation-command.` ask answers `{ ask, execution }`.

## Needs from t191 (extension panel, `apps/extension/src/panel/**`)

Nothing is required for the chat to work: the relay adds the capabilities and the page itself. To make it good:

1. **Show `response.execution`.** On `started`, show the work as running until a turn with attachment `panel-capability-result` and the same ref arrives. The chat's 4 s poll and its activity refresh already pick that turn up. On `failed`, show `summary`, which says the cause and how far it got.
2. **Offer Yes and No on a confirm ask whose turn attachment kind is `conversation-command`** ("Apply this change?"). Send them as `panelConversationAnswer` `grant` / `deny`. Typing "yes" works too, through `ask.answer`.
3. **Automations list, "open chat".** Send `panelConversationSend` with `kind: "open"`, `subjectKind: "flow"` and `subjectId: <flowId>`. Core continues that Flow's open thread, and "run it" there means that Flow.
4. **A failed send whose error begins "The browser could not say which page you are on"**: keep the words in the composer and offer a retry.
5. **A thread turn whose text says "Your model key is locked for this browser"**: offer "Open FluxIQ" (`panelOpenFluxIQ`), so the person can unlock their keys.

## Validation (observed 2026-09-30)

- **Core end-to-end** (the real registry, handlers, store, executor, build, review and run; only the model and the page are fake). The caller is the paired actor, and the messages are exactly what the relay sends.
  - Command: `npx vitest run src/programs/automation-studio/runtime/conversations/commands/tests/extension-chat.test.ts`.
  - Result: `Tests 7 passed (7)`. It covers create-here from the page, with `startLocation` equal to the page, the build on the unlocked session and not the token's, and activity stamped with the thread. It also covers describe, explore plus apply, improve (no rejects, yes applies), run from the automation's own thread, `ask.answer` on a robot-check-style ask, and the locked-key failure with its distance.
- **Core suites.** `npx vitest run src/programs/automation-studio/runtime/conversations src/programs/automation-studio/api/handlers/tests src/programs/secret-keys src/programs/automation-studio/runtime/activity src/programs/automation-studio/runtime/parking` gave `Tests 2 failed | 287 passed (289)`.
  - The first failure was W1's no-path unit test, updated to the new contract. `execute.test.ts` then gave `Tests 10 passed (10)`.
  - The second was `api/handlers/tests/runs.test.ts`, "exports a real run's audit", a file this lane did not touch. Alone it gave `Tests 5 passed (5)`, taking 14.7 s against a 15 s limit. It timed out only under the 43-file parallel load.
  - `npx vitest run src/programs/secret-keys/runtime/tests/unlocked-session-for.test.ts`: `Tests 7 passed (7)`.
- **Core checks.**
  - `heavy.sh npx tsc --noEmit -p packages/fluxiq`: exit 0.
  - `heavy.sh node scripts/structure-audit.mjs`: `passed (197 warning(s), 354 baselined)`, with "1 baseline entries can be lowered". Not recorded.
  - `node scripts/structure-audit.mjs --rule docs-links`: `passed`.
- **Web** (Core `apps/web`).
  - `heavy.sh npx tsc --noEmit`: exit 0.
  - `npx vitest run --minWorkers=1 --maxWorkers=2 src/features/automation-studio/conversation src/lib/tests/program-route.test.ts`: `Test Files 17 passed (17)`, `Tests 220 passed (220)`. The default pool first crashed with an unexpected child exit at 1.4 GB free physical memory, and ran clean at two workers.
- **Extension.**
  - `heavy.sh pnpm --filter @fluxiq-web-extension/extension test`: `# tests 1334`, `# pass 1334`, `# fail 0`.
  - `heavy.sh pnpm --filter @fluxiq-web-extension/extension check`: exit 0, run again after the protocol change.
  - `node scripts/structure-audit.mjs`: `passed (125 warning(s), 120 baselined)`.

- **r2 triage (2026-09-30, worker)**, in `fxwork/t198`:
  - `heavy.sh pnpm --filter @fluxiq-web-extension/extension check`: exit 0.
  - `heavy.sh pnpm --filter @fluxiq-web-extension/extension test`: `# tests 1456`, `# pass 1456`, `# fail 0`. This includes the 4 `chat-page` tests.
  - `heavy.sh pnpm --filter @fluxiq-web-extension/test-runner check`: exit 0, before and after the guard fix.
  - `heavy.sh pnpm --filter @fluxiq-web-extension/test-runner test`, first run: `# fail 42`.
    - 39 of the failures were from a `test-contracts` dist built before dev was merged: "does not provide an export named 'personHandOffResponses'".
    - One was the WIP's own unguarded Firefox launch: "These files launch a browser without the network guard ...: extension-chat-check/firefox/launch-firefox.ts".
  - After `pnpm --filter @fluxiq-web-extension/test-contracts build` and the guard fix: `# tests 1692`, `# pass 1690`, `# fail 2`.
    - All 3 launch-containment tests and all 7 chat-check unit tests pass.
    - The 2 failures are in code this branch does not change (`git diff dev...HEAD -- packages/test-runner` touches only `extension-chat-check/` and `package.json`):
      - `run-evaluation/tests/runner-wiring.test.ts:122`, "a persistent-isolated workspace is bounded to what this run wrote ...".
      - `tests/demo-workspace.test.ts:38`, "resolves one reusable demo directory below the configured runs root".
  - `heavy.sh node scripts/structure-audit.mjs`: `passed (130 warning(s), 120 baselined)`.

## Not verified

- **No browser proof (r2).** Step 2 was skipped as the brief directs, because the orphaned t191 interactive Lab is still alive:
  - `tasklist /FI "PID eq 7468"` shows `node.exe 7468`, and its command line is `node scripts/lab/run-lab.mjs interactive "company-website" --target persistent-isolated --workspace t191-corepanel`, started 03:20 local.
  - `lab-slots/ui-1` does not exist, so nothing was claimed or cleared.
  - The proof needs no model provider. `extension-chat-check/cli.ts` scrubs provider secrets, and it only asks "What can you do?", which Core answers offline.
  - To run it once the slot is free: `pnpm --filter @fluxiq-web-extension/test-runner build`, then `node packages/test-runner/dist/extension-chat-check/cli.js --browser both --scenario social-network-feed --page friends/requests/`. The extension's `dist/firefox` build is needed for Firefox.
  - The harness has never been run end to end, before the guard fix or after it.
- **The 2 remaining test-runner failures were not reproduced on dev itself.** It is only shown that this branch does not touch their code.
- **No live or browser run.** A provider-free Lab run cannot exercise a build, because the build needs the model. A run through `lab-slots/ui-1` would only show that the relay reads the tab. So `chrome.tabs.query({active, lastFocusedWindow})` from Chrome's side panel and Firefox's popup is unexercised. Live lanes should exercise it after integration.
- **The key mapping is unproven against the real Secret Keys.** In the end-to-end test, the session resolver and the provider's session check are fakes. `unlockedSessionFor` itself is unit-tested.
- **The web panel's chat through Core is not exercised in a browser.** Only its unit tests ran.

## Security change, in plain words

**Which key and where it lives.** The key is the person's own model-provider API key (DeepSeek), stored sealed in Core's Secret Keys. Core never gives it to the extension.

**How long it is unlocked.** When the person signs in to FluxIQ's web panel, `apps/web/src/app/api/auth/login/route.ts` calls `secretKeys.unlockSession` with their password. That holds the password-derived decryption keys in Core's process memory only (`packages/fluxiq/src/programs/secret-keys/runtime/held-keys.ts`). They are held until that sign-in session expires (`DEFAULT_SESSION_TTL_MS`, 12 hours, `identity-access/runtime/service.ts`), until logout (`auth/logout/route.ts` calls `revokeSessionUnlock`), or until Core stops. The buffers are zeroed when dropped.

**The path a chat request takes.**
1. The person types in the side panel or the popup.
2. The background worker accepts that message only from those two exact extension pages (`apps/extension/src/background/control-page.ts`, checked in `background/panel/panel-control.ts`).
3. It adds the chat's capability ids and the active tab's address (`background/panel/chat-page.ts`, `page-url.ts`). Then it calls Core's `append-turn` or `answer-ask` with the extension's own pairing token (`background/panel/conversation-relay.ts`, `connection.ts` `coreApiCredentials`). That token is in `chrome.storage.local` and never goes to the panel.
4. Core's HTTP layer lets a token call only its paired allowlist, which is unchanged (`apps/web/src/lib/program-route.ts`, `PAIRED_CLIENT_ENDPOINTS`).
5. Inside Core, `runtime/conversations/commands/caller.ts` sees the `client-gateway:` session and swaps in the approving person's live unlocked session id (`secretKeys.unlockedSessionFor`, `secret-keys/runtime/service.ts`). This skips expired sessions and unlocks that opened no key.
6. The chat model and Core's own commands then run under that session, with the paired client's permissions unchanged. Core's commands include create-here, explore, improve, run and answer, and Core builds their payloads itself. Each command goes through `commands/port.ts`, which calls only endpoints classified `read` or `authoring` and refuses anything that deletes or pays.

**What extension code can and cannot do.** Extension code never sees the key, its decryption keys, or the person's session id. It sends only words, capability ids, Flow and run ids, and a page address. It cannot choose which endpoint a command calls or what payload the command builds.

**A compromised page.** The page cannot send chat messages, because content scripts fail the control-page check. It can influence a build only through what the build reads from it, and the model is told only its origin and path as the start page. A build exploring a hostile page is still exposed to what that page shows.

**A compromised extension.** An attacker holding the pairing token can already call every paired endpoint. What this change adds is this: while the person is signed in with an unlocked session, the attacker can make Core spend the person's model key on chat replies, builds, improvements and runs. Two details make that reach wider than a direct token call:
- A chat run goes through the registry in process, so it is not pinned to `no_llm_intervention` the way a direct token `run-runtime-session` is (`narrowPairedClientRequest`).
- A "yes" typed into the chat applies a proposed change.

The attacker still cannot read the key, cannot call build endpoints directly, and cannot reach delete or payment endpoints through a command, so those keep their PIN. Nothing is spent once the person signs out or the session expires.

## Ready to commit

Ready to commit (r3, on top of 9d3461a3):
- `apps/extension/src/background/connection.ts`
- `apps/extension/src/background/panel/relay-context.ts`
- `apps/extension/src/background/panel/conversation-relay.ts`
- `apps/extension/src/background/panel/run-control.ts`
- `apps/extension/src/background/panel/panel-control-deps.ts`
- `apps/extension/src/background/panel/tests/conversation-relay.test.ts`
- this report

Validation (r3):
- `heavy.sh pnpm --filter @fluxiq-web-extension/extension test` -> `# tests 1457`, `# pass 1457`, `# fail 0`.
- `extension check` -> exit 0.
- `node scripts/structure-audit.mjs` -> `passed (130 warning(s), 120 baselined)`.
- The browser proof is still unproven: Chrome and Firefox must be re-run once Labs are allowed again.

Ready to commit (r2, already merged as 9d3461a3):
- `packages/test-runner/src/extension-chat-check/chat-network-policy.ts`
- `packages/test-runner/src/extension-chat-check/firefox/launch-firefox.ts`
- `packages/test-runner/src/extension-chat-check/open-chrome-session.ts`
- `packages/test-runner/src/extension-chat-check/open-firefox-session.ts`
- `packages/test-runner/src/extension-chat-check/run-chat-check.ts`
- `packages/test-runner/src/extension-chat-check/types.ts`
- `packages/test-runner/src/extension-chat-check/index.ts`
- `packages/test-runner/src/guarded-browser/tests/launch-containment.test.ts`
- `docs/working/language-driven-flow-loop-plan/reports/t198-extension-chat-builds.md`

The WIP in 6587257d is kept as it is.

Validation:
- `heavy.sh pnpm --filter @fluxiq-web-extension/test-runner test` -> `# tests 1692`, `# pass 1690`, `# fail 2`. Both failures are outside this branch's changes; see Validation r2.
- `extension test` -> `# pass 1456`, `# fail 0`.
- `extension check` and `test-runner check` -> exit 0.
- `structure-audit` -> `passed`.

## Worker reports

`t198-w1-core-executor.md`, `t198-w2-secret-keys-session.md`, `t198-w3-extension-relay.md`, `t198-w4-web-panel.md` (this folder).
