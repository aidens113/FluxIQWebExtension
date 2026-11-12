# W4-B3-ext: the extension's conversation list ports and relays (lane t900)

## Outcome

Done. The narrow tests pass (115/115). `check-extension` and the structure audit pass when run through the heavy slot.

Worktree `C:/Users/osrs_/FluxStuff/fxwork/t900/!FluxIQWebExtension`. Nothing is committed. Core ui-components `dist` was rebuilt through the heavy slot before any extension work.

## Contract (verbatim)

### Message names (`apps/extension/src/shared/constants.ts`)

```ts
panelConversationRename: "fluxiq.panel.conversationRename",
panelConversationDelete: "fluxiq.panel.conversationDelete",
```

Both are in `PANEL_MESSAGES` (`background/panel/panel-control.ts`), so each is accepted only from the side panel or the popup. Anything else gets `{ ok: false, code: "forbidden", error: "Only the FluxIQ panel can do that." }` before anything is touched.

### Message shapes (`apps/extension/src/shared/panel-conversation.ts`, re-exported by `protocol.ts`)

```ts
// PanelConversationReadRequest gains a third variant:
| { kind: "list-all"; projectId?: string | undefined; limit?: number | undefined }

// PanelConversationSendRequest gains:
fresh?: boolean | undefined;   // with kind: "open" = New chat

export type PanelConversationRenameRequest = {
  projectId?: string | undefined;
  conversationId: string;
  title: string;
};

export type PanelConversationDeleteRequest = {
  projectId?: string | undefined;
  conversationId: string;
};
```

### Port to message (`panel/chat/transport/ports/conversation.ts`)

| Port method | Runtime message sent (fields written by name through `present<T>()`) |
| --- | --- |
| `listAllThreads({ projectId?, limit })` | `{ type: "fluxiq.panel.conversationRead", kind: "list-all", projectId?, limit }` |
| `newThread({ projectId?, subjectKind?, subjectId?, title? })` | `{ type: "fluxiq.panel.conversationSend", kind: "open", fresh: true, projectId?, subjectKind?, subjectId?, title? }` |
| `renameThread({ projectId?, conversationId, title })` | `{ type: "fluxiq.panel.conversationRename", projectId?, conversationId, title }` |
| `deleteThread({ projectId?, conversationId })` | `{ type: "fluxiq.panel.conversationDelete", projectId?, conversationId }` |

### Message to Core call (one call each; Core's payload returned as sent)

| Message | Core endpoint and exact body |
| --- | --- |
| read `kind: "list-all"` | `list-conversations` `{ projectId: <given> \| null, limit? }`. With no project it sends `null`, meaning every project; it never sends the session's project. |
| send `kind: "open", fresh: true` | `open-conversation` `{ projectId, subjectKind?, subjectId?, title?, fresh: true }`. `projectId` is the given one or the session's (`no_project` refusal before Core when neither exists). A subject of `panel`, `project` with no id, or no subject is left out, so Core opens the project's own thread. Core's `requestedSubject` refuses `panel`, and the widget sends `panel` when the host has no project. Any other subject is sent whole. |
| `conversationRename` | `rename-conversation` `{ projectId?, conversationId, title }` |
| `conversationDelete` | `delete-conversation` `{ projectId?, conversationId }` |

- **Rename and delete leave `projectId` out when the list row had none.** They never put the session's project in its place, because the list spans every project when none is open. Core then searches the projects this browser may change.
- **Only the fields Core's `narrowThreadChange` accepts are sent.** The tests send extra fields (`text`, `fresh`, `subjectKind`) and prove they are dropped.
- **Local refusals before Core:** a missing `conversationId` gives `invalid_request` ("Say which conversation to rename." / "...to delete."), and a non-string `title` gives "Give the conversation a name."
- **Core judges an empty or too-long name.** Such a name is passed through, and Core answers it in its own words.
- **New chat is `kind: "open"`, so `panel-control.ts` never wraps it in `activity.sending`.** This is tested.

### Refusal mapping

- **Where Core's sentence was lost:** `panelRequest` (`panel/state/request.ts`) turns any relay `error` that is not in its fixed table into "Something went wrong.". Without a change, Core's `conversation_run_active` sentence would not reach the person.
- **The fix:** the thread-change ports use the new `transport/reply/thread-change-of.ts`. When the background named a failure `code`, its own words (`detail`) become the `ChatResult.sentence`. Those words are Core's for `failed`, or the relay's from `relay-failure.ts` / `core-api.ts`.
- **Failures with no code** (the background did not answer) keep the panel's sentence and cause.
- **The end-to-end test** sends a stubbed `chrome.runtime.sendMessage` reply `{ ok:false, code:"failed", httpStatus:409, error:<Core's run-active sentence> }` through the real `panelRequest` into `deleteThread`. It gets back `{ ok:false, sentence:<that sentence>, detail:<same>, code:"failed" }`.

### chat-panel.ts

- **The widget gets `threads`:** `{ layout: "drawer", unavailableReason, onSelected }`.
- **`unavailableReason`** is the relays' existing `no_project` wording: "FluxIQ has not said which project this browser belongs to yet. Connect, then try again."
- **Selection memory.** The selected conversation is kept per browser window in `chrome.storage.session` under the key `fluxiq.chatThread.<windowId>` as `{ conversationId, projectId }`. The panel had no memory of its own to reuse.
- **Why restore rides on the list read.** The widget reads `initialConversationId` only when it is created, while the storage read is async. So the restore wraps `listAllThreads` (`thread-memory/restoring-thread-list.ts`):
  - the first list read waits for the memory;
  - if the list holds the remembered thread and the chat still shows "latest", it calls `widget.open({ kind: "thread", ... })` before the list lands;
  - a thread that is not listed, or a memory that cannot be read, is ignored.
- **Browsers without session storage.** With no `storage.session` or `windows` (Firefox before 115), nothing is remembered.

## What changed and why

- `apps/extension/src/shared/constants.ts`: adds the two message names.
- `apps/extension/src/shared/protocol.ts` and the new `apps/extension/src/shared/panel-conversation.ts`: the shape changes are the `list-all` read variant, `fresh` on send, and `PanelConversationRenameRequest` / `PanelConversationDeleteRequest`.
  - **Why the new module.** These additions took `protocol.ts` to 803 lines, over the audit's 800-line limit.
  - **What moved.** The five `PanelConversation*Request` types (the only part of `protocol.ts` this brief owns) moved unchanged to `panel-conversation.ts`.
  - **Importers are unaffected.** `protocol.ts` re-exports them (`export type { ... } from "./panel-conversation"`), so every importer and doc reference still names `shared/protocol.ts`. `protocol.ts` is now 722 lines.
- `apps/extension/src/background/panel/conversation-relay.ts`: adds the `list-all` branch and `freshOpening`, and updates the header comment.
- `apps/extension/src/background/panel/thread-change-relay.ts` (new): the rename and delete relay.
- `apps/extension/src/background/panel/panel-control.ts`: adds the two messages to `PANEL_MESSAGES`, routes them to `relayThreadChange`, and updates the header comment.
- `apps/extension/src/background/panel/index.ts`: exports `relayThreadChange`.
- `apps/extension/src/panel/chat/transport/ports/conversation.ts`: the four optional methods.
- `apps/extension/src/panel/chat/transport/reply/thread-change-of.ts` (new) and the `reply/index.ts` export: the refusal mapping above.
- `apps/extension/src/panel/chat/thread-memory/` (new; `index.ts`, `session-thread-memory.ts`, `restoring-thread-list.ts`): the per-window memory and restore. **It is outside the brief's literal owned list.** It is a new folder beside `chat-panel.ts` that serves only it, and no other file was touched for it.
- `apps/extension/src/panel/chat/chat-panel.ts`:
  - passes `threads`;
  - wraps the conversation port with the restore;
  - adds a `threadMemory` option, used as a test seam and kept out of the widget's options.
- Tests:
  - `background/panel/tests/thread-change-relay.test.ts` (new);
  - `background/panel/tests/conversation-relay.test.ts` (+3 tests: list-all bodies, fresh-open bodies, non-fresh open unchanged and no-project refusal);
  - `background/panel/tests/panel-control.test.ts`: both names are added to the control-page rejection loop, plus a routing test and a test that New chat is not under `sending`;
  - `panel/chat/transport/tests/thread-list-ports.test.ts` (new);
  - `panel/chat/thread-memory/tests/thread-memory.test.ts` (new);
  - `panel/chat/tests/chat-panel.test.ts`: the drawer is drawn, the list is read through `list-all` with the project, the remembered thread is reopened over the newest, and the thread on screen is kept.

## Commands run and observed results

- `cd !FluxIQ/packages/ui-components; node .../heavy-slot.mjs run t900 -- pnpm build`: exit 0 (`build-cache ... ui-components:build ... stored`).
- `cd apps/extension; node scripts/test-extension.mjs src/background/panel/tests`: 84 tests, 84 pass, 0 fail.
- `cd apps/extension; node scripts/test-extension.mjs src/background/panel/tests src/panel/chat/tests src/panel/chat/transport/tests src/panel/chat/thread-memory/tests src/panel/chat/conversation/tests`: 115 tests, 115 pass, 0 fail.
- **Setup the check needed.** The first `check-extension` (through the slot) failed only on a missing `@fluxiq-web-extension/domain/node`, in e2e and `packages/test-runner` files, none of mine:
  - **Why `domain/node` was missing:** this worktree's `domain/dist` was never built.
  - **Why domain would not build:** `domain build` refused because Core's libraries were stale against the Core worker's uncommitted changes (contracts, fluxiq).
  - **What I ran:** one slot run, `bash scratchpad/t900-b3-full.sh`, which:
    - built `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/sdk --filter @fluxiq/ui-components build` in Core (CORE_EXIT=0);
    - ran `pnpm --filter @fluxiq-web-extension/domain build` (DOMAIN_EXIT=0);
    - ran `node scripts/check-extension.mjs` (CHECK_EXIT=0);
    - ran `node scripts/structure-audit.mjs` (AUDIT_EXIT=1). It found two violations, both mine:
      - `[file-lines] shared/protocol.ts: 803 lines`;
      - `[statement-packing] panel-control.test.ts line 335`.
- **After fixing both** (the protocol split described above, and unpacking the test's `sending` stub):
  - the narrow tests again gave 115/115 pass;
  - a slot run of `cd apps/extension; node scripts/check-extension.mjs` gave **CHECK_EXIT=0**;
  - `node scripts/structure-audit.mjs` at the extension root printed **`structure-audit: passed (245 warning(s), 552 baselined).`** with AUDIT_EXIT=0.

## Not verified

- **Live behaviour in a browser.** I did not test the real `chrome.storage.session` / `chrome.windows.getCurrent` from the side panel or the Firefox popup, the drawer UI, or a real Core answering these endpoints through a paired token.
- **Docs are not updated.** `docs/architecture/extension-client.md` (around lines 1250-1300, the conversation relay section) does not yet describe `list-all`, `fresh`, or the two new messages; it was not in my owned paths.
- **Shell-mounted panel.** The shell (`panel/shell/mount-panel.ts`, must-not-touch) mounts the chat with threads now on; its own tests were not run separately.

## Open questions or contradictions found

1. **Refusal codes are lost before the panel.** `background/connection/core-api.ts` `callCoreProgram` reads Core's `errorCode` but returns it (as `diagnosticCode`) only for four authority codes, and `panelRequest` keeps `diagnosticCode` only for those. So `conversation_run_active` arrives as `code: "failed"` with Core's sentence, not as its own code. The person sees Core's words, and the widget branches on the sentence alone today. Passing every `errorCode` through needs edits to `core-api.ts` and `panel/state/request.ts`, which are outside this brief.
2. **Core opens no `panel` subject.** The widget's New chat sends `{ subjectKind: "panel" }` when the host has no project. Core's `open-conversation` requires a project and accepts only project/flow/build/run subjects. The relay therefore opens the session project's own thread, and refuses with `no_project` when no project can be resolved. A real "panel-wide thread" needs Core support.
3. **Docs.** `docs/architecture/extension-client.md` needs the new messages documented (see Not verified).
