# W4-B3-ui: conversation list in Core's shared chat (I3)

Worker report, lane t900. Worktree `C:/Users/osrs_/FluxStuff/fxwork/t900/!FluxIQ`, package
`packages/ui-components`. Nothing committed.

## Outcome

Done for the ui-components side. Acceptance tests and tsc pass. The structure audit has no
finding in my paths, but it still prints 3 failures, all in `packages/fluxiq` (another lane's
uncommitted Core work). Two follow-ups sit outside my paths: replacing the native `<select>` breaks
`apps/web/e2e/chat-widget.spec.ts`, which picks threads through
`getByRole("combobox", { name: "Thread" })`, and the new stylesheet needs a `package.json` `files`
entry before publishing. See Open questions.

## What changed and why

Ports (`src/chat/ports/`):

- `transport.ts`, final types verbatim:

```ts
/** Opens a new thread, never an existing one (Core's open-conversation with `fresh: true`). */
export type ChatNewThreadRequest = { projectId?: string; subjectKind?: ChatSubjectKind; subjectId?: string; title?: string };

/** Gives a thread the person's own name for it. */
export type ChatRenameThreadRequest = { projectId?: string; conversationId: string; title: string };

/** Deletes a thread. Core refuses one whose work is still running (code `conversation_run_active`) with a sentence the chat shows. */
export type ChatDeleteThreadRequest = { projectId?: string; conversationId: string };

// on ChatConversationPort, all optional:
  newThread?(request: ChatNewThreadRequest): Promise<ChatResult<{ conversation?: unknown }>>;
  renameThread?(request: ChatRenameThreadRequest): Promise<ChatResult<{ conversation?: unknown }>>;
  deleteThread?(request: ChatDeleteThreadRequest): Promise<ChatResult<{ deleted?: boolean }>>;
```

  These are structurally the brief's inline request types, given names and exported from
  `ports/index.ts` (and so from the package root).
- `threads.ts`: `export type ChatThreadsLayout = "drawer" | "column";` and
  `ChatThreadsOptions.layout?: ChatThreadsLayout` (default `"drawer"`). `onTitle`'s doc now says
  the chat still draws the "Chats" button and the list.

What the chat sends:

- New chat: `{ projectId, subjectKind: "project" }` when the host has a project open, else
  `{ subjectKind: "panel" }`. No `title`, no `subjectId`. The answer's `conversation` is read with
  the existing `parseConversation` (needs `conversationId`, `projectId`, numeric `revision`), and
  that thread opens. An unreadable answer shows "The new chat was made, but it couldn't be opened.
  Pick it from the list."
- Rename: `{ conversationId, title: trimmed, projectId: the thread's own project }`. A blank or
  unchanged name is not sent.
- Delete: `{ conversationId, projectId: the thread's own project }`. `ok: false` shows `sentence`
  (for example Core's `conversation_run_active` sentence) in a `role="alert"` line over the list;
  `ok: true` with `deleted: false` shows "That chat wasn't deleted. Try again.". A thrown request
  shows "Couldn't reach FluxIQ. Try again.".

No-DOM model:

- `conversation/thread-list/catalog.ts`: `hasMore()` (the last read came back full), `more()`
  (adds 25 to the limit for this and later reads; `forget` resets to 25), `drop(id)` (takes a
  deleted thread out at once). The 25-thread page stays, and "Show older chats" now reaches the rest.
- New `when.ts` (`threadWhen`: "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago",
  "Oct 3", "Dec 30, 2025", plus the full day "October 3, 2026"), `rows.ts` (`threadRows`,
  `ThreadRow`), `filter.ts` (`filterThreadRows`: every word of the search in name or time, any case).
- `threads/thread-actions.ts` (new): New chat, Rename and Delete; one press at a time; reads the
  list after each answer; delete of the open thread opens the next thread of the list, else the
  one before, else `{ kind: "latest", projectId: host project }` (the empty chat when nothing is
  left); `reset()` on owner change makes an in-flight answer land nowhere.
- `threads/chat-threads.ts`: composes catalog, actions, header and list; owns the drawer's
  open state; `ChatThreads.element` was replaced by `layout` and
  `frame(top, rest)`, which returns the panel's children with the list in place.

DOM:

- `view/thread-header.ts` rewritten. Drawer: `button.chat-thread-toggle` (`aria-expanded`,
  `aria-controls` = the list's id) holding messages-square icon, "Chats", the chat's title
  (hidden when the host takes the title via `onTitle`), a "N waiting" badge, chevron. Column: the
  title alone, header hidden when the host takes the title.
- New `view/thread-list/conversation-list.ts` (`nav.chat-thread-nav[aria-label=Chats]`): New chat
  (only with `newThread`), search box (`type=search`, `aria-label="Search chats"`), the alert line,
  `ul.chat-thread-rows[role=list]`, an empty line ("Loading chats…", "No chats yet.", "No chats
  match “x”."), "Show older chats". Rows are kept per conversation and moved with `placeChildren`,
  so focus and an edit in progress survive each read. ArrowUp/ArrowDown/Home/End between rows,
  ArrowDown from search into the rows, ArrowUp from the first row back to search; Escape clears a
  non-empty search, else closes the drawer.
- New `view/thread-list/conversation-row.ts`: `button.chat-thread-open` (name, relative time,
  "Waiting on you", `aria-current="true"` on the chat on screen, full day as `title`), then Rename and
  Delete (only when the port has them; `aria-label` "Rename <name>" / "Delete <name>"). Rename swaps
  the button for an input (Enter saves, Escape or blur cancels). Delete shows "Delete this chat?"
  with Delete and Cancel in place (`role="group"`), Escape is Cancel; no `window.confirm`.
- `chat-widget.ts`: passes the three port methods through the owner of the moment (present exactly
  when the client's transport has them), `focusComposer`, builds the panel through
  `threads.frame(...)` and sets `data-thread-layout` on `.chat-panel`. A chat picked from the list or
  a new chat closes the drawer and hands the caret to the composer.
- `lease-transport.ts`: leases `newThread`, `renameThread`, `deleteThread` like `listAllThreads`
  and leaves each out when the client does.
- `chat.css` + new `view/thread-list/thread-list.css`: the old picker rules removed. The list's
  rules took chat.css to 870 lines, over the audit's 800-line limit, and could not be compacted
  under it. So they live in their own sheet beside the list view, which chat.css `@import`s first
  thing (hosts still import `styles/chat.css` alone). chat.css is now 787 lines. Styles come
  from tokens only (amber `--focus` ring at
  `--focus-width`, inset so the scrolling list never clips it; selected row `--accent-row` with a
  2 px `--accent` bar; waiting dot `--warning`; New chat `--accent`/`--accent-ink`; refusal
  `--danger-soft`/`--danger-text`). Drawer open hides `.chat-main`, `.chat-dock` and `.chat-pending`
  through sibling selectors; column makes `.chat-panel` a row with the list at
  `clamp(220px, 28%, 300px)`. Rename/Delete show on hover, focus-within and the selected row, and
  always under `(hover: none)`.
- `README.md`: new "Conversation list" section (ports, options, layouts, hook classes).

Options: `ChatThreadsOptions.layout?: "drawer" | "column"` (default `"drawer"`). Nothing else added.

Class names. Kept: `chat-thread-header`, `chat-thread-title` (now a `span`, inside the toggle in a
drawer). Removed: `chat-thread-picker`, `chat-thread-select` (no use found outside ui-components
except the apps/web e2e selector by role, see below). New: `chat-thread-toggle`,
`chat-thread-toggle-label`, `chat-thread-badge`, `chat-thread-nav` (`data-layout`), `chat-thread-tools`,
`chat-thread-new`, `chat-thread-search`, `chat-thread-notice`, `chat-thread-rows`,
`chat-thread-row` (`data-conversation-id`, `data-selected`, `data-waiting`, `data-mode`),
`chat-thread-open`, `chat-thread-name`, `chat-thread-meta`, `chat-thread-when`,
`chat-thread-waiting`, `chat-thread-actions`, `chat-thread-rename`, `chat-thread-rename-input`,
`chat-thread-delete`, `chat-thread-confirm`, `chat-thread-confirm-text`,
`chat-thread-confirm-delete`, `chat-thread-confirm-cancel`, `chat-thread-none`, `chat-thread-more`,
and `chat-body` (column layout's thread side).

Tests: `threads-widget.test.ts` updated from the picker to the list and extended end to end through
the fake Core (`tests/threads-core.ts` gained `actions: true` and `deleteFails`): controls absent
without the port methods, New chat (project and panel), Rename (Enter/Escape), Delete in place,
delete of the open thread (next, then the empty chat), delete of another thread, Core's
`conversation_run_active` sentence shown and cleared, drawer Escape/pick, column layout. New:
`view/thread-list/tests/conversation-list.test.ts`, `conversation/thread-list/tests/rows.test.ts`,
`threads/tests/thread-actions.test.ts`; `view/tests/thread-header.test.ts` rewritten for
drawer/column; `tests/lease-transport.test.ts` covers the three new methods.

## Commands run and observed results

All in `C:/Users/osrs_/FluxStuff/fxwork/t900/!FluxIQ`. Free RAM was checked before each heavy
command. It read 2.38 GB, just under the 2.5 GB floor, as the first vitest run and the second audit
started. Each other heavy command waited for at least 2.5 GB.

- `pnpm check` (packages/ui-components), first run: one error,
  `src/chat/stream/step/messages.ts(218,56): error TS2322: Type 'string | null' is not assignable to type 'string | undefined'`
  (the other worker's stream file); nothing in my files.
- `pnpm check`, final run after the CSS split: no `error TS` lines,
  `{"build-cache":"build","step":"ui-components:check","reason":"no stamp; stored in the shared store ...}`, so it passed.
- `pnpm exec vitest run src/chat/tests src/chat/view/tests src/chat/conversation/thread-list src/chat/ports src/chat/threads src/chat/view/thread-list`,
  run before and after the CSS split: `Test Files 36 passed (36)`, `Tests 233 passed (233)` both times.
- `node scripts/structure-audit.mjs` (repo root), first run: `FAIL [file-lines] packages/ui-components/src/chat/chat.css: 870 lines exceeds the 800-line limit`
  (mine), plus 2 failures in packages/fluxiq. Final run: `structure-audit: 3 violation(s) across 3 rule(s).`, all outside my paths:
  `[directory-files] packages/fluxiq/src/programs/automation-studio/api/handlers/tests/: 26 source files`,
  `[failure-as-empty] packages/fluxiq/src/runtime/conversations/commands/work.ts:39`,
  `[imports] packages/fluxiq/src/framework/automation-service/service/conversation-requests/run-links.ts:27`.
  These are in files with uncommitted changes I did not make (`git status`: another lane's Core
  conversation work). My only finding is the advisory `warn [file-lines] chat.css: 787 lines`.
  So the audit did not print "passed"; it will pass once that lane fixes its three findings.

## Not verified

- No real browser: layout at 360/400 px, the drawer's sibling-selector hiding, focus movement and
  the visible focus ring were checked only by reading CSS and through the fake DOM (whose `focus()`
  is a no-op; tests spy on it). No screenshot.
- Core's real `newThread`/`renameThread`/`deleteThread` endpoints are being built in parallel; the
  shapes of their answers (`conversation` record with `revision`, `deleted`) are assumed from the
  brief and the existing `parseConversation`.
- Whether Core honours `listAllThreads` limits above 25 ("Show older chats").
- Package version: a public export changed (`ChatThreads.element` gone, `createThreadHeader`
  signature changed; both reachable only through internal barrels, `chat/index.ts` does not export
  them) and new ports were added; `package.json` is not mine to bump.

## Open questions or contradictions found

1. `apps/web/e2e/chat-widget.spec.ts` (`pickThread`, lines 62-66 and 136-143) selects threads with
   `getByRole("combobox", { name: "Thread" })`, `selectOption(id)`, asserts the tag is `SELECT` and
   reads "(waiting on you)" from option text. The brief replaces that select, so this spec will fail
   until updated. Suggested replacement: open the drawer with `getByRole("button", { name: /^Chats/ })`,
   then click `.chat-thread-row[data-conversation-id="<id>"] .chat-thread-open`; the waiting mark is
   `.chat-thread-waiting` ("Waiting on you").
2. `threadOptions`/`ThreadOption` (the old picker's labels) no longer have an internal consumer.
   They stay because `chat/index.ts` (not owned) exports them publicly; the lead may drop them.
3. New chat's subject: the brief left it open. I chose `subjectKind: "project"` with the host's
   project, else `"panel"` with none. If Core's fresh open-conversation needs something else for the
   panel case, only `thread-actions.ts` `create()` changes.
4. `package.json` (not mine): `"files"` lists `src/chat/chat.css` only. Add
   `"src/chat/view/thread-list/thread-list.css"` before the next publish, or the published
   chat.css will `@import` a missing file. Workspace consumers (apps/web, the extension) resolve it
   from the source tree, but neither bundle was built here to prove the `@import` resolves
   (esbuild and Next's css-loader both follow relative `@import`s). Also suggest a minor version
   bump for the new ports.
5. The extension's `apps/extension/src/panel/tests/css-tokens.test.ts` scans
   `src/chat/chat.css` for `var()` names; it does not follow `@import`, so the list sheet's tokens
   are checked only by ui-components' own `styles.test.ts`, which now follows `@import`s.
6. `src/chat/stream/step/messages.ts` failed tsc on the first run (the other worker's file); by
   the final run it no longer did.
