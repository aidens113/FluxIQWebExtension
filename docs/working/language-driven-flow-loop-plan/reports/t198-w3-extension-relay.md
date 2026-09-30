# t198-W3: the extension relay offers the chat's capabilities and the person's page

## Outcome

Done. Nothing was committed.

## What changed and why

All paths are under `apps/extension/src/background/panel/`.

- `chat-capabilities.ts` (new): `CHAT_CAPABILITIES`, a frozen list of frozen `{ id }` entries for `flow.createHere`, `flow.describe`, `flow.explore`, `flow.improve`, `run.execute` and `ask.answer`. It sends ids only, because Core supplies the descriptors.
- `page-url.ts` (new, **not named in the brief**): `acceptedPageUrl(value)` accepts an http: or https: URL of at most 2048 characters and returns undefined for anything else. The relay and `panel-control-deps` both need this check, and the one-exported-thing rule meant it could not live in either file. It is exported from the barrel.
- `relay-context.ts`: `PanelRelayContext` gains `pageLocation: () => Promise<string | undefined>`.
- `panel-control-deps.ts`: `pageLocation` calls `chrome.tabs.query({ active: true, lastFocusedWindow: true })`, runs the result through `acceptedPageUrl`, and returns undefined on any throw.
- `conversation-relay.ts`: `turnPayload` is now async and takes the context. It changes two fields:
  - `capabilities`: `CHAT_CAPABILITIES`, then the panel's object entries. A panel entry is dropped when its id is already offered, including a repeat of its own earlier entry. Non-objects and arrays are dropped too. An object with no string id is kept.
  - `onScreen`: the panel's `flowId`, `subflowId`, `runId` and `recordingId`, when each is a trimmed non-empty string, plus `pageUrl`. `pageUrl` is `pageLocation()` when that passes the check, otherwise the panel's own `onScreen.pageUrl` when that passes. `pageLocation` is also wrapped in a try, so a failure there never blocks a send. `onScreen` is left out when empty. The URL is never logged.
  - Other `onScreen` keys the panel sends are no longer passed through, because the old code forwarded the object as given.
  - The header comment now describes all of this and the "open a Flow's chat" path.
- `index.ts`: exports `CHAT_CAPABILITIES` and `acceptedPageUrl`.
- Tests:
  - `tests/conversation-relay.test.ts`:
    - The existing expectations now expect the six ids.
    - New tests cover:
      - the frozen list;
      - dedupe;
      - the `onScreen` fields and leaving it out when empty;
      - the panel `pageUrl` fallback against http, https, chrome-extension, about, file, javascript, garbage, an address over 2048 characters and a non-string;
      - the fallback when the background's page fails the check, and when `pageLocation` throws;
      - `acceptedPageUrl` bounds, with exactly 2048 characters accepted and 2049 refused;
      - an automation's chat: `kind: "open"`, `subjectKind: "flow"`, `subjectId: "flow-7"` gives `open-conversation`, and the next message goes to the returned `c-flow` as `append-turn`.
  - `tests/panel-control.test.ts` and `tests/run-control.test.ts`: the fake contexts gain `pageLocation`. In panel-control it records to `touched`, so the refused-sender test also shows that a refused sender never reads the page.

## Commands run and observed results

- Only the three touched test files, bundled with the package runner's esbuild options into `.test-build-scratch/t198-w3` (the runner and its output were removed afterwards): `# tests 30`, `# pass 30`, `# fail 0`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t198 W3 check" pnpm --filter @fluxiq-web-extension/extension check`: exit 0, twice. Each run was a type check of the source and test projects plus in-memory bundling of every entry. The build cache printed `"build-cache":"build" ... "not stamped, because inputs changed while it ran (core:packages/fluxiq/src)"`. A concurrent Core worker was editing, so the result was not cached. It still passed.

## Not verified

- The full extension `pnpm test` suite and `pnpm check` at the repository root, including the structure audit on the new `page-url.ts` and `chat-capabilities.ts`.
- Live browser behaviour: that `chrome.tabs.query({ active: true, lastFocusedWindow: true })` returns the page beside the side panel in Chrome and the Firefox popup. The popup is itself a window, so the last-focused window may need checking there.
- End-to-end with Core's executor. Core's side is another worker's.

## Open questions or contradictions found

- **`shared/protocol.ts` is out of my scope.** `PanelConversationSendRequest.onScreen` has no `pageUrl`, and its `capabilities` doc comment still says "Left out, an empty list is sent". The relay reads `pageUrl` from the raw message, so the panel can send it at runtime, but a typed panel caller cannot without a cast. The protocol owner should add `pageUrl?: string` to `onScreen` and update the comment.
- **What the panel (lane t191) must do:**
  - Nothing is required for capabilities. It may stop sending its own entries for these six ids, because they are dropped.
  - To open an automation's chat, send `{ type: panelConversationSend, kind: "open", subjectKind: "flow", subjectId: <flowId> }` and use `payload.conversation.conversationId` for later messages.
  - `pageUrl` is optional from the panel. The background supplies it; the panel's copy is only a fallback.
  - The panel should handle `response.execution` as described in the Response contract. In particular, `status: "started"` means the result arrives later as an automation turn with a `panel-capability-result` attachment.
- A new file, `page-url.ts`, was added outside the brief's list, for the reason given above.
