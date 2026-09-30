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

## Not verified

- **No live or browser run.** A provider-free Lab run cannot exercise a build, because the build needs the model. A run through `lab-slots/ui-1` would only show that the relay reads the tab. So `chrome.tabs.query({active, lastFocusedWindow})` from Chrome's side panel and Firefox's popup is unexercised. Live lanes should exercise it after integration.
- **The key mapping is unproven against the real Secret Keys.** In the end-to-end test, the session resolver and the provider's session check are fakes. `unlockedSessionFor` itself is unit-tested.
- **The web panel's chat through Core is not exercised in a browser.** Only its unit tests ran.

## Worker reports

`t198-w1-core-executor.md`, `t198-w2-secret-keys-session.md`, `t198-w3-extension-relay.md`, `t198-w4-web-panel.md` (this folder).
