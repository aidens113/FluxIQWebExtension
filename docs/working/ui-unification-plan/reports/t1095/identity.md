# t1095/identity: one conversation model, one current project (Core panel side)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t1095/!FluxIQ` (branch `task/t1095-ui-audit-unify`). No git commands run.
Paths: W = `apps/web/src`, F = `packages/fluxiq/src`.

## Outcome

Partial. Defect 4 and I5 are done on the panel and Core side. Defect 3 is done for the panel: every new chat
is a project chat, and older project-less chats stay readable. The panel words are fixed. I6's target address
is confirmed. Two things are left for the supervisor, both outside my paths:

- The panel assistant can do things a project chat cannot (details below). I could not keep those abilities for
  project chats, because that needs a change in `F/runtime/conversations/**`, which this brief does not give me.
- `web:check` fails, but only in two test files that belong to other workers (details below).

I also had to edit four files outside my owned paths (listed below, each small).

## The final I5 request and response (exact)

`POST /api/client-gateway/automation-studio-context` (add `?domainId=<id>` when the page is scoped to a domain;
a paired client's domain always comes from its own binding)

Request body: `{ "activeProjectId": string | null, "activeFlowId"?: string | null }`

- The panel may still send `clientId` to write one client's own slot. Nothing in the panel does this any more.
- A paired client must not send `clientId`. If it does, the answer is 400:
  `{ "ok": false, "error": "A paired client sets the person's current project for itself, so it names no clientId." }`
- Ids are trimmed. An empty `activeProjectId` means null. `activeFlowId` is dropped when there is no project.

Who may call it: the panel (it needs `runtime.control`, as before) and now a paired client too. IAM decides each
call on the project, or on the Flow when one is named, as before. The domain check is also kept, using the
binding's domain for a paired client.

A client bound to one project (its gateway session has `projectId`) may only set that project, with or without
a Flow. Any other project, or a clear, gets 403:
`{ "ok": false, "error": "This browser was connected for one project only, so it cannot switch to another. Switch projects in the FluxIQ panel, or connect the browser again without choosing a project." }`

Success (200, `cache-control: private, no-store`):
`{ "ok": true, "payload": WorkspaceRuntimePresentation }`. The `payload.automationStudio` part holds
`{ activeProjectId, activeFlowId, updatedAt, contextCount, ...readiness }`. For a paired client the payload is the
restricted view, with no host paths.

Other failures:
- 401 `Authentication required`
- 403 `Selected project is not available in this domain.`
- 403 `Selected Flow is not available in this project.`
- 403 IAM denial
- 409 `A newer context selection has already been requested.`
- 400 bad body
- 503 / 500 as before

A paired client's write goes into the same per-person slot the panel writes (keyed by user, not by client).
The snapshot `GET /api/client-gateway/snapshot` reads that slot back as
`payload.webRuntime.automationStudio.activeProjectId / activeFlowId / activeProjectName`, for the panel and for
paired clients alike. A bound client's snapshot still shows only its bound project. This did not need a code
change; the new test pins it.

## What changed and why

**Defect 4 and I5, Core routes**
- `W/app/api/client-gateway/automation-studio-context/prepare.ts`: paired clients are accepted. They write the
  person's own slot (the presentation has no `clientId`), and naming a `clientId` is refused.
- `.../bound-project.ts` (new): the rule that keeps a bound client to its project.
- `.../validate.ts`: a paired client's domain comes from its binding. The bound rule is checked again after each
  revalidation.
- **Outside my paths:** `W/lib/app-route-iam/contracts.ts`. The IAM table refused paired clients, so I5 cannot work
  without this edit:
  - the context route now lists `callers: { panel: "runtime.control", "paired-client": "none" }`;
  - `first-project` now lists `panel: "none"` (needed for Defect 3).

  **Also outside my paths:** `W/app/api/tests/app-route-iam-parity.test.ts`. I updated the expected rows for these
  two routes and added a comment saying what changed in t1095.

**Defect 4, panel**
- `W/features/panel-shell/context/core-context.ts` (new): a port over `GET /api/client-gateway/snapshot` and
  `POST /api/client-gateway/automation-studio-context`. A failure comes back with its reason; it is never read
  as "no project".
- `use-restored-project.ts`, rewritten. On load the panel uses, in order:
  1. `?project=` in the address;
  2. Core's current project;
  3. localStorage, only when Core cannot be read or holds none (after a restart Core holds none).

  Other rules:
  - A project the person picks before Core answers always stands.
  - Every switch is written to Core.
  - A Flow is written when a page opens one. Leaving that page writes nothing, so a client's open Flow is not wiped.
  - If Core names a project this page cannot see, the panel drops it locally but does not clear it in Core.
  - When the tab becomes visible again, the panel reads Core and follows a project a client switched to.
- `PanelContextProvider.tsx` takes an optional `core` port, used by tests. `requested-project.ts` now returns only
  the address's project.

**Defect 3**
- I checked what the panel assistant can do that a project chat cannot. The assistant thread
  (`F/runtime/conversations/assistant`, used through `F/programs/automation-studio/api/panel-assistant/programs-port.ts`) has:
  - a model loop that can call any program endpoint open to the assistant (`AssistantToolCatalog`, `find_tools`),
    which covers Secret Keys, identity, settings and workspace-wide endpoints;
  - "Allow" cards built from each call's target (`call-target.ts`), with spend checks;
  - a spending allowance per message;
  - the full page context (page and selection, such as a key, dataset, folder, nodes or step numbers).

  A project chat (`append-turn`) has Core's own commands (build here, describe, explore, improve, run Flow, answer
  a question) and the panel's list of capabilities (about 45: projects, Flows, runs, recordings, versions,
  subflows and routes, adaptations, revoking a client). The dock sends it only `flowId`, `runId` and
  `recordingId` from the screen.

  **So new dock chats lose the assistant's open-ended tool use.** I could not keep it for project chats. Doing so
  means having the project chat's interpreter fall back to the assistant loop, writing into the project's
  conversation store. That belongs in `F/runtime/conversations/assistant/**` and `F/runtime/conversations/instructions/**`,
  which I do not own. Building a project-backed store inside `panel-assistant/` would put storage logic in the
  Studio controller, which `AGENTS.md` forbids. I made no change in `panel-assistant/**`, and Core still accepts
  new panel threads: only the dock stopped making them. Older threads still run on the assistant.
- `W/features/chat-widget/transport/`:
  - `person-project.ts` and `ask-first-project.ts` (new) ask `POST /api/client-gateway/first-project` from the
    panel, the same way the extension asks.
  - `project-to-start.ts` (new) picks the project a new chat starts in.
  - `conversation-port.ts` (send) and `thread-changes.ts` (New chat) start in the person's project when none is
    open, then tell the host which project it was.
  - `composed-conversation-port.ts` (rewritten):
    - New chat and a first message always go to the project.
    - The list shows the open project's chats (every project's when none is open), then the earlier chats with no
      project, titled `No project · <title>`.
    - Earlier chats are read, continued, answered, renamed and deleted where they live.
    - A chat is never started on the reserved `panel` id.
  - `project-for.ts` now reads: "This chat is not in a project yet. Send a message and FluxIQ puts it in your
    project." It no longer says "choose a project".
  - Small edits: `options.ts`, `program-chat-transport.ts`, `index.ts`, and a header note in `panel-conversation-port.ts`.
- `ProgramChatWidget.tsx`: new `onProjectFound` prop. The panel is told about the found project one tick after
  the send's answer lands, because opening the project gives the chat a new owner and would otherwise drop that
  answer. A target whose project is `panel` never becomes the project a chat starts in. `ChatDock.tsx` passes
  `onProjectFound` through. In `options/panel-chat-options.ts` the `assistant` flag is renamed `personProject`,
  and its empty title is now "New chat".
- `W/features/panel-shell/dock/AssistantDock.tsx`: when a chat starts with no project open, the dock opens the
  person's project (dispatch), which also writes it to Core.
- `W/features/chats`:
  - `chat-href.ts`: an earlier chat links to `/chats/<id>` with no `?project=panel`.
  - `chat-rows.ts`: its row says "No project (an earlier chat)".
  - `ChatThreadPage.tsx`: an address with no project opens the earlier chat where it lives, with a short note.
  - Wording fixes in `ChatsPage.tsx` and `load-chats.ts`.

**Words**
- The dock is "Chat" everywhere: `aria-label="Chat"`, the bar says "Chat", and the opener says "Chat" /
  "Open the chat" / "Close the chat".
- Nav hints: Chats is "Every chat, in every project". Security is "Sign-in, devices, people and activity" (it no
  longer says "Keys").
- **Outside my paths:** `W/features/flows/editor/focus-assistant.ts`. It found the dock by the old aria-labels, so
  renaming them would have broken the "Ask about selected steps" button. The dock now carries `data-panel-dock` and
  `data-panel-dock-opener`, and this file uses those instead.

**I6 target:** `/chats/<conversationId>?project=<projectId>` mounts the project chat on that conversation and makes
that project the panel's current one, so it is also written to Core. A test now pins this.

**Core:** `F/programs/automation-studio/api/person-project.ts` gets a new `unscoped` option for the panel on a page
with no domain. It then reads the panel's own unscoped project list. A paired client with no domain still gets
none, so the existing test "with no domain declared, is none" still holds. The `first-project` route passes the
panel's page domain and `unscoped`.

**Tests updated to the new behaviour:** the "Assistant" dock and composed-port tests, and the chat-rows test. One
`ChatDock.test.tsx` heading expectation changed from "FluxIQCompany website" to "FluxIQNew chat": the uic worker's
I3 change in `packages/ui-components` now titles a chat with no thread "New chat", never the project.

## Commands run and observed results

- `cd apps/web && npx vitest run src/app/api/client-gateway src/lib/app-route-iam src/app/api/tests/app-route-iam-parity.test.ts src/app/api/tests/app-route-iam-service.test.ts`
  → `Test Files 17 passed (17)`, `Tests 237 passed (237)`. This was the last run, after the first-project tests
  were added.
- `cd apps/web && npx vitest run src/features/chats src/features/chat-widget src/features/panel-shell` → all pass.
  These ran in parts; the last runs were:
  - `src/features/chat-widget/transport` → 9 files and 60 tests passed;
  - `src/features/panel-shell src/features/chat-widget/tests/ChatDock.test.tsx` → 11 files and 68 tests passed;
  - the earlier full run of chats + chat-widget + panel-shell → 33 files, with one failure in
    `panel-conversation-port.test.ts` (a missing import), which I fixed and re-ran in the transport run above.
- `cd packages/fluxiq && npx vitest run src/programs/automation-studio/api/tests/person-project.test.ts src/programs/automation-studio/api/panel-assistant`
  → `Test Files 7 passed (7)`, `Tests 58 passed (58)`, including the new `unscoped` test on both profiles.
- `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1095-identity -- node scripts/build-cache/cli.mjs fluxiq:build fluxiq:check web:check`
  → **exit 2**.
  - `fluxiq:build` built in 198 s.
  - `fluxiq:check` was reused ("inputs and outputs match the stamp").
  - `web:check` failed with 3 errors, none in my files:
    - `src/app/tests/GlobalClientGatewayPairing.test.ts(17,15)` TS2379 (`requestedBySessionId: undefined`). That file
      belongs to the pairing worker.
    - `src/features/panel-shell/top-bar/projects/tests/port.test.ts(38,18)` and `(46,18)` TS2722 ("possibly
      undefined"). This comes from the uic worker making `ProjectsPort.create` optional (I1). `panel-shell/top-bar`
      is not in my paths.
- `node scripts/structure-audit.mjs` → no violations ("9 baseline entries can be lowered"). An earlier run flagged
  three `failure-as-empty` violations in my new files; I fixed them, and the re-run is clean.

## Not verified

- No live browser or panel run, so these have not been exercised for real: the panel adopting Core's project after
  a reload, the extension switching and the panel following when its tab becomes visible, and a dock send with no
  project creating "My automations".
- `web:check` has not passed as a whole because of the two other workers' test files above. My own files raise no
  errors in that run.
- Not updated or run, because they are outside my paths and still use the old words or behaviour:
  - `apps/web/e2e/chat-widget.spec.ts`: lines 51, 80, 336 and 345 use "Open the assistant", "Assistant" and
    "Close the assistant", and tests D1, V8 and the panel-thread tests expect the old dock;
  - `apps/web/e2e/panel-settings.spec.ts:135`;
  - `apps/web/e2e/support/panel-fixture.ts`, lines 31 and 35.
- Docs are not updated (outside my paths): `docs/architecture/automation-studio/client-gateway.md` around line 464
  (first-project is browsers only) and `docs/integrations/client-gateway-websocket.md` around line 667 (the context
  route).

## Open questions or contradictions found

1. **The assistant's abilities in project chats** (see Defect 3 above). This needs a brief for `F/runtime/conversations/**`.
   Until then, Core still accepts new panel threads; only the dock stopped making them.
2. **The recording lease conflicts with a lasting current project.** `W/lib/automation-studio-context.ts` keeps the
   5-minute `AUTOMATION_STUDIO_CONTEXT_LEASE_MS` for recordings a client starts. Now that the panel and clients really
   write this value, a recording from the extension works only within 5 minutes of the last switch. A recording
   that names a different project in that window is refused with `recording.project_context_mismatch`. Before this
   change nothing wrote the value, so such recordings got `project_required`. The shared value is meant to last, so
   the lease should change. That file is not mine.
3. Live follow without a tab focus would need a change signal for the context in `W/app/api/panel/changes/topics/gateway.ts`,
   which is in "must not touch". Today the panel follows on load and when its tab becomes visible.
4. The IAM contract edits and `focus-assistant.ts` are outside my paths (listed above). Revert them if you want them
   done another way.

## Follow-up (sub-supervisor's four items)

### Outcome

Items 1-4 are done in code, and their tests pass. One edit falls outside the paths you gave me: `W/lib/workspaces/presentation/{context.ts,tests/context.test.ts}`, needed for item 2 (details there). The acceptance results are under "Commands run" below.

### 1. Panel project chats keep the panel assistant's abilities, using the assistant's own code

The assistant's code is reused as it is: its model loop, tools, Allow cards and consent checks, purse and allowance, and the page selection. What changed is where it reads and writes the thread.

- **A project thread as the assistant's thread** (`F/runtime/conversations/assistant/store/`):
  - `thread-store.ts` (new) is the interface the loop and `PanelAssistant` now use.
  - `PanelAssistantThreads` implements it. It gains `keepWaitingCall` and `hasWaitingCall`, and `storedAttachment` (how a step's attachment is stored).
  - `project-threads.ts` (new), `PanelAssistantProjectThreads`, writes into a project's thread through the project's own conversations collaborator, adding automation turns and asks exactly as Core does.
  - The call a card waits on stays in the person's own panel database, so only the person who raised the card can run it.
- **`F/runtime/conversations/conversations.ts`**: new `recentTurns(...)`, which reads a project thread back.
- **`PanelAssistant`** (`panel-assistant.ts`):
  - It takes an optional `projectThreads` factory.
  - New `workInProject(actor, scope, { projectId, conversationId, words, onScreen })`. It runs the same loop into the project thread. The context's `projectId` is always the thread's own project.
  - New `answerInProject(...)`. Anyone other than the person who raised the card is refused before the ask is settled. A repeated answer replays the first and runs nothing.
  - New `isCardInProject(...)`.
  - Panel threads behave as before; every existing assistant test passes.
- **Card ids**: every assistant card is now `ask.assistant.<uuid>` (`loop/card-ask.ts`), so a project's `answer-ask` can recognise one.
- **Where the hand-off happens**: Core's conversation command `panel.assistant` (`F/runtime/conversations/commands/panel-assistant/hand-off.ts`, background).
  - The project chat's own reading of a message still decides first: build, run, describe and the other Core commands, plus the panel's capabilities. When the model picks "Anything else in the FluxIQ panel", the command calls the assistant's endpoint `work-in-project-thread`.
  - That endpoint is in `F/programs/automation-studio/api/panel-assistant/register.ts`, listed in `PANEL_ASSISTANT_PROJECT_ENDPOINTS`. It is decided on the project, and paired clients are refused as on every assistant endpoint.
  - It reads the person's stored turn for their words and selection, runs the loop, and returns `{ ending, spentUsd }`.
  - The command's closing line says how the work ended. Because it runs in the background through Core's command work, a delete of the thread is refused while the assistant is still working on it.
- **Program side** (`api/panel-assistant/project-chat.ts`, wired into `api/handlers/conversations.ts`). Each piece is a short controller function; the logic itself is in `runtime/conversations/assistant/project-chat.ts`.
  - `append-turn`: a panel caller's vocabulary is offered `panel.assistant`. A paired client is never offered it.
  - `answer-ask`: an `ask.assistant.` ask is answered by the assistant. A paired client is refused with "This question was asked by the FluxIQ panel's tools. Answer it in the FluxIQ panel." This gives clients no new authority.
  - `get-conversation-attachment`: the assistant's navigation steps, and its references into another project, are read the way a panel thread's are, with IAM and the domain checked for each project.
- **Page selection**: the panel's dock stores what the person had open with each message, as a person-turn attachment `panel.on-screen` holding base64url JSON of `onScreen` (page, selection, flowId, runId).
  - This is done by `W/features/chat-widget/transport/with-on-screen.ts`, which wraps the project port's `append-turn`.
  - Core reads it back strictly, through `panelAssistantContextOf` (`runtime/.../context/on-screen-attachment.ts`). An Allow pressed later is judged against that stored selection, not against whatever is on screen at the press.
  - The panel hides this attachment kind (`panel-attachment-port.ts`).
  - The whole value must fit the store's 1000-character reference limit. If it does not, it keeps the page and the named ids and leaves out the step and node lists.
- **Why not simpler**: the selection had to travel this way because `framework/automation-service/.../on-screen.ts` and the web's `sendConversationInstruction` both drop page and selection, and neither file was in my paths. Sending it in a person-turn attachment also stores it with the message.
- **Tests**:
  - `api/panel-assistant/tests/project-chat.test.ts` (new, real-sql, 4 cases):
    - the loop runs into the project thread, using the stored selection and the thread's own project;
    - a card is raised there, only the person who raised it can Allow it, and only once; anyone else is refused, and so is a paired client;
    - the per-message allowance stops the work;
    - a paired client cannot hand a message over and is never offered `panel.assistant`.
  - `runtime/.../commands/panel-assistant/tests/hand-off.test.ts` (new, 3 cases): the hand-off call; refusals, including that a paired client never hands over; a panel's vocabulary parses it and replaces it with Core's own descriptor.
  - `chat-widget/transport/tests/with-on-screen.test.ts` (new, 3 cases): the selection travels on the dock's project send and on nothing else; an oversized selection keeps its page and ids; the attachment is hidden.

### 2. Recording lease: why it existed, and what changed

- **Why it existed**: from its own history (doc comment, b891e67 note), `AUTOMATION_STUDIO_CONTEXT_LEASE_MS` (5 minutes) never granted authority. Who may start a recording is decided by pairing, by the operator identity on the gateway session, and by the context route's permission. The lease guarded against a stale choice: the value used to be written only by an open Studio page, as a sign that the page was still there with that project open, so a browser that vanished could not keep sending recordings into its last project.
- **Why it no longer fits**: since t1095 the value is the person's lasting current project. The panel writes it on every switch and adopts it on load, and a client can set it for itself. Its age says nothing any more, and the lease would refuse a recording just because nobody switched project for five minutes.
- **What changed**: `resolveClientRecordingProject` reads the lasting value with no age check. The guard now lives where the value is set: IAM and the domain decide every write, a client bound to one project can set no other, and clearing it is an explicit write. A request naming a different project is still refused with `recording.project_context_mismatch`, and a person with no current project still gets `recording.project_required`. The constant is gone.
- **Files**:
  - `W/lib/automation-studio-context.ts` (the reasoning is in its doc comment) and `W/lib/tests/automation-studio-context.test.ts`;
  - **outside the paths you gave me**: `W/lib/workspaces/presentation/context.ts` (it passed `now` into the removed age check) and `W/lib/workspaces/presentation/tests/context.test.ts` (it asserted the lease).

### 3. Live follow when a client switches project

- **Signal**: new `context` topic in `W/app/api/panel/changes/topics/context.ts`.
  - The context route sends a signal to that person's streams after a committed write (`automation-studio-context/route.ts`).
  - The listeners live in one registry on `globalThis` under `Symbol.for("fluxiq.web.panel-context-changes")`. This is because the writing route and the stream route may be bundled separately.
  - The signal carries only the workspace and the person; a stream hears only its own caller's signals.
  - The stream route adds the topic next to the gateway topic, so the person's paired-client streams hear it too.
- **Stream**: `panel-change-stream.ts` treats `context` like `gateway` and `model-access` (merged with repeats, carries only a version).
- **Client**: `W/features/panel-changes/{types,connection}.ts` add the `context` event and a `context()` listener.
  - The panel's current-project hook (`use-restored-project.ts`, given `changes` by `PanelContextProvider`) reads Core again on `context`, and on `opened` in case a switch arrived while the stream was down. It then follows without writing anything back.
  - This replaces the earlier tab-visibility listener.
- **Tests**:
  - `topics/tests/context.test.ts` (new): a person's own streams in their own workspace hear the signal, nobody else's do, and nothing is heard after stop;
  - `shared-context.test.ts` (new case): a committed write signals the person's streams, and a refused write signals nobody;
  - `connection.test.ts` (new case): the `context` event;
  - `restored-project.test.tsx` (new case): the panel follows a client's switch when the stream says so, and on `opened`, without writing back.
- **Pairing worker's changes**: kept. Its `gateway.ts`, `types.ts` and `panel-change-stream.ts` edits were already in place, and I only added to those files.

### 4. E2E specs (edited only, not run)

- `apps/web/e2e/support/panel-fixture.ts`:
  - the dock is found by the name "Chat", and the opener is "Open the chat";
  - `signInToPanel` now clears the person's current project in Core before the first page load, because that value now outlives a test (it is no longer kept per browser).
- `apps/web/e2e/panel-settings.spec.ts:135`: the dock is found by the name "Chat".
- `apps/web/e2e/chat-widget.spec.ts`:
  - new words: "Chat", "Open the chat", "Close the chat";
  - the list now holds 5 rows and 4 of them waiting (3 earlier chats plus the small project's 2), and "No project · Planning notes";
  - with no project open, the dock lists every project's chats;
  - V4 also answers `list-conversations` with an empty list;
  - one new case: New chat with no project open lands in the person's project, and the top bar opens it.

### Commands run and observed results (follow-up)

- `cd packages/fluxiq && npx vitest run src/programs/automation-studio/api/panel-assistant src/runtime/conversations src/programs/automation-studio/api/handlers/tests/conversations.test.ts src/programs/automation-studio/api/tests/person-project.test.ts`
  → `Test Files 69 passed (69)`, `Tests 507 passed (507)`. After the last `offered` signature change I re-ran
  `project-chat.test.ts` and `commands/panel-assistant` → `2 passed`, `7 passed`.
- `cd apps/web && npx vitest run src/features/chat-widget src/features/chats src/features/panel-shell src/features/panel-changes src/app/api/client-gateway src/app/api/panel/changes src/lib/app-route-iam src/lib/tests/automation-studio-context.test.ts src/lib/workspaces/presentation src/app/api/tests/app-route-iam-parity.test.ts src/app/api/tests/app-route-iam-service.test.ts src/features/flows/editor`
  → `Test Files 60 passed (60)`, `Tests 535 passed (535)`.
- `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1095-identity -- node scripts/build-cache/cli.mjs fluxiq:build fluxiq:check web:check`
  → **exit 0**: `fluxiq:build` "no stamp; stored" (230 s), `fluxiq:check` "inputs changed: packages/fluxiq; stored" (88 s), and
  `web:check` "no stamp; stored" (88 s). No stamp was reused, so `FLUXIQ_BUILD_FORCE` was not needed.
  - An earlier run (heavy3) failed `fluxiq:build` with TS2375 in `panel-assistant/project-chat.ts` (the capabilities type
    under `exactOptionalPropertyTypes`). I fixed it by having `offered` take and return `unknown[]`.
- `node scripts/structure-audit.mjs` → no violations ("9 baseline entries can be lowered").
  - An earlier run flagged 8 violations in my new files: `as never` casts, imports that skipped a barrel, a controller
    function over budget, and packed statements. I fixed them all, moving the logic to `runtime/conversations/assistant/project-chat.ts`.

### Doc deltas this follow-up needs (not edited, as you asked)

- `docs/architecture/automation-studio/client-gateway.md` around line 86, and `docs/integrations/client-gateway-websocket.md` around line 682: both describe `AUTOMATION_STUDIO_CONTEXT_LEASE_MS`, which is gone. Recordings now use the person's lasting current project.
- The client-gateway docs, where the context route is described: a paired client may now set it for itself, and a client bound to one project gets 403 for any other. Also, a `context` event on `GET /api/panel/changes`.
- The panel-assistant or chat architecture doc: a project chat in the panel offers `panel.assistant` and hands the message to the assistant through `work-in-project-thread`. Cards are `ask.assistant.*` and are answered through the project's `answer-ask`. The `panel.on-screen` person-turn attachment stores the page and selection.
- `first-project` now also serves the panel's chat (from my first report).

### Not verified (follow-up)

- No live run, and no e2e run.
- `panel-assistant.spec.ts` (not mine, not edited) sends new dock messages and expects the scripted panel assistant to reply. New messages now go through the project chat's interpreter first, so that spec probably needs the e2e conversation model to choose `panel.assistant`, or a rewrite.
- **For ext-ui**: the extension draws the same project threads, so it should hide person-turn attachments of kind `panel.on-screen`. It should also show an `ask.assistant.*` card as "answer in the FluxIQ panel"; answering it from the extension is refused with a sentence.
- **For ext-bg**: there is a `context` event on the change stream if the extension wants to follow the panel's switches.

## Follow-up 2

### Outcome

All three items are done (the e2e spec, the docs, and the IAM catalog drift). Every requested check passes, and the e2e folder typechecks. E2E was not run, as you asked. One file outside the paths you gave me was edited: `packages/fluxiq/src/programs/_shared/runtime.ts`, a single binding line. The new Core code is covered by vitest but has not had a full fluxiq typecheck (see "Not verified").

### 1. `apps/web/e2e/panel-assistant.spec.ts` follows the new hand-off

- **Scripted chat model.** The interpreter's model on the e2e fixture host is now scripted from the same script the assistant replays. I did this rather than weaken any assertion.
  - The scripted model is `runtime/conversations/assistant/model/scripted/chat-model.ts`, bound by `model/chat-model-binding.ts`.
  - It is bound only under the same two conditions as the scripted assistant: the fixture marker and `FLUXIQ_E2E_SCRIPTED_ASSISTANT`. Either one missing leaves the normal key-chosen chat model.
  - A scenario's message is read as `{ do: "panel.assistant", with: { request } }`, or as the capability named by the scenario's optional new `chat` field. Any other message is answered with `otherwise`.
  - The script reader is now shared: `scripted/read-script.ts`, used by both the assistant and the chat model.
  - **Outside my paths:** `programs/_shared/runtime.ts` now binds `automationStudioFixtureHostChatModel({ rootDir, env, fallback: createAutomationStudioCallerKeyChatModel(...) })`, the same way the scripted assistant source is bound. `runtime/llm/**` was not touched.
  - Test: `model/tests/chat-model-binding.test.ts`. It checks that the binding is refused without the marker, without the variable, or without a data directory, and that on the fixture host the model hands off, honours `chat`, and replies otherwise.
- **Spec changes.**
  - All three original cases keep every assertion. Each now also checks that the project chat's hand-off line, "I'll work on that with the panel's own tools here.", appears.
  - The "delete it" case also checks that the chat starts with no project and that afterwards the top bar has a project (from first-project).
  - **New case:** a chat made the old way, with no project (through `open-panel-thread`), opens at `/chats/<id>` with the "started before every chat belonged to a project" note. It still answers through the panel's tools, and no project-chat hand-off happens.
  - `e2e/README.md` describes the scripted chat reading.
- **e2e typecheck:** `tsc` with a throwaway tsconfig that extends `apps/web/tsconfig.json` and includes only `e2e/**/*.ts` (removed afterwards) → exit 0, no errors.

### 2. Docs: `docs/architecture/automation-studio/workspace.md` ("The Chat UI")

- **New "Every chat belongs to a project":**
  - every new dock chat is a project conversation, started through first-project when no project is open (unscoped, for a panel page with no domain);
  - the list holds the open project's chats (every project's when none is open), then earlier chats titled "No project · ", which still work where they live; `/chats/<id>` has no project, and `/chats/<id>?project=` is the I6 target;
  - the `panel.assistant` hand-off through `work-in-project-thread`, with its body and answer;
  - `ask.assistant.*` cards answered through `answer-ask`, where only the person who raised the card can answer and a paired client is refused with the exact sentence;
  - how the assistant's step attachments are read;
  - the `panel.on-screen` person-turn attachment;
  - the scripted reading on the fixture host.
- **New "The person's current project":**
  - one value per person, set through the context route (whose own details are left to the client-gateway doc);
  - how the panel adopts it on load, writes it on every switch, and drops a project it cannot see without clearing it in Core;
  - following on the `context` event;
  - recordings use this value, and the lease is gone.
- **Smaller edits:**
  - the change-stream bullet now lists `model-access` and `context`;
  - the old "The assistant dock's threads" heading is now "The panel assistant's endpoints", introduced as earlier chats;
  - the dock is called "Chat".
- `client-gateway.md` and `client-gateway-websocket.md` were not touched.

### 3. IAM catalog drift

- **Cause:** the new `work-in-project-thread` endpoint registers the action `studio:WorkInProjectThread`. The generated action catalog in `packages/contracts/src/iam/actions.generated.ts` had not been regenerated, so it was missing that action.
- **Fix:** I ran the documented step, `FLUXIQ_REGENERATE_IAM_CATALOG=1 npx vitest run src/platform/iam/catalog` → 3 files and 12 tests passed. The generated catalog gained exactly one entry:
  `{"action":"studio:WorkInProjectThread","accessLevel":"Write","resourceTypes":["*"],...,"endpoint":"work-in-project-thread"}`.
  - Its `resourceTypes` matches `studio:AppendTurn` and `studio:SendPanelMessage`.
  - The read-only and destructive lists did not change. No test expectations were changed.
- `packages/contracts` was named in the original brief's must-not-touch list. This generated file is the catalog you said I could edit.

### 4. Structure fix along the way

- The audit's naming rule flagged three files in `assistant/model/` sharing the `fixture-` prefix. I named the new binding `chat-model-binding.ts` instead of creating a third `fixture-` file, and updated its test and the doc references to match.

### Commands run and observed results (follow-up 2)

- `cd packages/fluxiq && npx vitest run src/platform/iam src/programs/automation-studio/api/panel-assistant src/runtime/conversations/assistant/model` → `Test Files 41 passed (41)`, `Tests 356 passed (356)`.
- Before that: `npx vitest run src/runtime/conversations/assistant src/programs/automation-studio/api/panel-assistant` → 22 files and 123 tests passed, and `src/runtime/conversations/assistant/model` → 5 files and 28 tests passed.
- `node scripts/structure-audit.mjs --rule docs-links` → `structure-audit: passed (0 warning(s), 0 baselined).`
- `node scripts/docs-reference.mjs --check` → `Deterministic framework reference is current.`
- `node scripts/structure-audit.mjs` → no violations ("9 baseline entries can be lowered"). An earlier run flagged the `fixture-` prefix group, now fixed.
- e2e typecheck (throwaway tsconfig, `e2e/**/*.ts` only) → `tsc exit 0`.

### Not verified (follow-up 2)

- No e2e run.
- No heavy-slot `fluxiq:check` / `web:check` this round: the slot is congested and the brief did not ask for it. This round's Core changes (the scripted chat model, its binding in `runtime.ts`, the regenerated contracts catalog) are covered by vitest, which skips type checking. The next heavy-slot `fluxiq:build`/`check` will typecheck them.
- After the regeneration, `packages/contracts` needs its dist rebuilt before the web tests see the new catalog entry. The next `fluxiq:build`/heavy run does this.
