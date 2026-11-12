# B3 fix: the latest chat refused typing with no project (lane t900)

## Outcome

Done. The regression was real, and the fixture is unchanged. With the conversation list enabled, the extension
gated the latest chat on the panel status naming a project, although its background names the session's project
at send time. A new browser could not type its first message. The person can now type into the latest chat with
or without a project in the status, and with or without threads. The web panel keeps its gate.

## Cause

The failing shell test is a real behaviour regression. The fixture is not outdated.

- The fixture's status is connected and paired with no `projectId`
  (`apps/extension/src/panel/tests/status-fixture.ts`; the test passes only `connectionState` and `paired`).
  A new browser is in exactly this state before FluxIQ names a project.
- With `threads` set, Core's thread list treats a latest chat with no project as
  "nowhere": `packages/ui-components/src/chat/threads/chat-threads.ts:159-162` (`nowhere()`), before the fix.
  Two things follow from that:
  - `unavailable()` (`chat-threads.ts:201`) hands `unavailableReason` to the composer
    (`chat-widget.ts:497` `composer.setUnavailable(threads?.unavailable())`). The composer is then disabled and its
    placeholder reads "Chat unavailable" (`conversation/composer.ts:65`, `:267`).
  - `withoutProject()` (`chat-threads.ts:200`) makes the controller skip reading the latest thread
    (`conversation/controller.ts:282-285`).
- The extension passed `unavailableReason: NO_PROJECT_REASON` (`apps/extension/src/panel/chat/chat-panel.ts:94`
  before the fix), so it opted into that gate.
- The gate is wrong for the extension. A message that names no project goes to the session's project, which the
  background resolves at send time: `background/panel/conversation-relay.ts:105` `projectFor` calls
  `connection.resolveProjectId("panel")` (`panel-control-deps.ts:23`). That is `ProjectContext.resolve`
  (`background/connection/project-context.ts:76-82`), which asks Core for the current project and, when this
  browser has none stored, asks Core for a first project (`:122-124`, "a browser's chat has nowhere to be without
  one"). So "the status names no project" does not mean "there is nowhere to send".
- The gate also deadlocked a new browser. The skipped read was the request that would have made the background
  resolve and adopt a project. Without it, the status never gained a `projectId`, the owner key never changed,
  and the composer stayed "Chat unavailable" until some other read resolved a project or a thread was listed.
- In the failing test, a followed run of another automation opens the latest chat with no project
  (`stream/run-target.ts:41-42` scopes from the automation target, which has no project). The composer is gated.
- The web panel (`apps/web/src/features/chat-widget/options/panel-chat-options.ts:23`) still needs the gate:
  there, no project open really means nowhere to send ("Open a project to start a conversation.").

So whether a project-less chat has somewhere to send is the host transport's property. Core assumed every
threads host lacks one.

## Fix

- Core, `packages/ui-components/src/chat/ports/threads.ts`: `ChatThreadsOptions.unavailableReason` is now
  optional, and its documentation states the contract. Set it when the transport has nowhere to send a message
  that names no project. Leave it out when the transport finds the project itself (the session's project). The
  project-less latest chat is then read and written to as it is without a thread list, and its composer is never
  disabled for want of a project. The change is backward compatible: the web panel still passes the field, and its
  `Omit<ChatThreadsOptions, "unavailableReason">` still type-checks.
- Core, `packages/ui-components/src/chat/threads/chat-threads.ts`: `nowhere()` is false when the host gave no
  reason, so neither `withoutProject()` nor `unavailable()` gates. The header comment is updated.
- Extension, `apps/extension/src/panel/chat/chat-panel.ts`: it no longer passes `unavailableReason`, and the
  `NO_PROJECT_REASON` constant is removed. A comment cites `project-context.ts` as the reason. A send that still
  finds no project answers with the relays' own `no_project` sentence, as before threads.

## Tests (each fails before the fix)

- Core `src/chat/tests/threads-widget.test.ts`, "a host whose transport finds the session's project gives no
  reason: the project-less latest chat reads, takes typing and sends". Before the fix it failed at `:266`
  ("the latest chat is listed as without a thread list ...": no list call was made).
- Extension `src/panel/chat/tests/chat-panel.test.ts`, "a new browser with no project named and no thread yet can
  still write: the first message goes to the session's project". The composer is enabled with "Message FluxIQ"
  and no reason is shown. The first message is sent with no `projectId` and is shown.
- The existing shell test `mount-panel-navigation.test.ts:328` failed before the fix ("Chat unavailable") and is
  unchanged.

## Commands run and observed results

- Before, `cd apps/extension; node scripts/test-extension.mjs panel/shell/tests` -> `# pass 56`, `# fail 1`:
  `not ok 18 - a followed run of another automation ...`, `expected: 'Message FluxIQ'`, `actual: 'Chat unavailable'`.
- Before the Core fix, with the new Core test, `pnpm exec vitest run src/chat/tests/threads-widget.test.ts` ->
  `1 failed | 24 passed (25)`, at `threads-widget.test.ts:266` (no list call).
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t900 -- pnpm build` (in packages/ui-components)
  -> `took slot-1`, build-cache `"inputs changed: packages/ui-components"`, `exit=0`. The extension bundles
  ui-components from `dist/`, so this rebuild was needed before the extension tests could see the fix.
- Probe: I temporarily passed `unavailableReason` again from `chat-panel.ts` over the rebuilt Core, then removed it.
  `node scripts/test-extension.mjs panel/shell/tests panel/chat` -> `not ok 23 - a new browser with no project
  named ...` (`expected: false`, `actual: true`: the composer was disabled) and `not ok 95 - a followed run ...`
  (`'Chat unavailable'`). Both new and old tests catch the regression.
- After, `cd apps/extension; node scripts/test-extension.mjs panel/shell/tests panel/chat` -> `# tests 134`,
  `# pass 134`, `# fail 0`.
- After, in Core packages/ui-components,
  `pnpm exec vitest run src/chat/threads src/chat/tests src/chat/view/thread-list src/chat/conversation` ->
  `Test Files 48 passed (48)`, `Tests 321 passed (321)`.

## Not verified

- No whole-package typecheck ran for the extension (`tsc` through the slot), for the Core ui-components test files
  (vitest does not type-check, and the build tsconfig compiles only sources), or for `apps/web`. The web panel's
  `Omit<ChatThreadsOptions, "unavailableReason">` plus spread still holds when the field is optional. That is by
  reading, not by a run.
- No live browser check. A new browser's first send was not exercised against a real background and Core (the
  `project-context.ts` resolve path was read, not run).
- The web panel's behaviour is unchanged by construction (it still passes the reason). Its tests were not run.

## Open questions or contradictions found

- Paths outside the brief's owned list: `packages/ui-components/src/chat/ports/threads.ts` (the
  `ChatThreadsOptions` port type, which this lane had already modified) had to change, because the fix is a
  contract change. Nothing listed as must-not-touch was edited.
- Not edited, but the supervisor should update them because they are outside my ownership:
  - Core `packages/ui-components/README.md`, "Conversation list". Suggested line: "`unavailableReason` disables the
    composer, with that sentence, for a latest chat with no project and no thread. Set it only when the transport
    has nowhere to send a message that names no project. A host whose transport names the session's project (the
    extension) leaves it out."
  - Extension `docs/architecture/extension-client.md` around line 1273, "The conversation list". Suggested
    sentence: "The extension gives no `unavailableReason`: its relays name the session's project for a message that
    names none, so the latest chat takes a first message before the status names a project."
- Tooling defect, not fixed (not owned): my first `heavy-slot.mjs run t900` (pid 5008) lost its queue ticket while
  still alive. It would have waited forever, because `run()` breaks only when its own ticket is at the head
  (`fxwork/.tools/heavy-slot.mjs:78`) and never re-creates a missing ticket. I stopped it and queued again. The
  cause was not traced. A likely suspect is another lane's `tickets()` judging pid 5008 dead (`alive()` at `:20-22`)
  and removing the file at `:33`.
- Related, not changed: `open({ kind: "latest" })` from a `thread` target does not inherit a project
  (`chat-widget.ts:425` excludes `thread`). For a host that gives a reason and has a project, Back to the latest chat
  could still show "Chat unavailable" when no thread is listed. In practice `adopt()` opens a listed thread at
  once. I did not reproduce it and left it alone.
