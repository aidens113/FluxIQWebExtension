# ui-components navigation (task t915, U4)

CORE = `fxwork/t915/!FluxIQ`, package `packages/ui-components` (`UI` below).

## Outcome
Done. Project switcher, chat bar, project-following chat and injected activity are built, tested and in `dist`.

## Exported signatures (all from `@fluxiq/ui-components`)
```ts
type ProjectSummary = { id: string; name: string; updatedAt?: string };
type ProjectsPort = { list(): Promise<ProjectSummary[]>; create(name: string): Promise<ProjectSummary> };
type ProjectSwitcherOptions = { port: ProjectsPort; onSelect(project: ProjectSummary): void; onOpenAll?: () => void };
type ProjectSwitcher = { readonly element: HTMLElement; setCurrent(p: ProjectSummary | null): void; open(): void; close(): void; refresh(): Promise<void>; destroy(): void };
function createProjectSwitcher(options: ProjectSwitcherOptions): ProjectSwitcher;
function filterProjects(projects: readonly ProjectSummary[], query: string): ProjectSummary[];
// feed/
type ChatActivitySource = { snapshot(): ActivityFeedSnapshot; read(): Promise<void>; subscribe(listener: () => void): () => void };
// ChatWidgetOptions gained:
chatBar?: boolean;              // default true; needs `threads` with layout "drawer"
activity?: ChatActivitySource;  // the host's feed
```
- `onSelect` receives the chosen (or just created) project; the button changes only when the host calls `setCurrent`. A `port` call that rejects shows its `Error.message` in the sheet, so make messages readable.
- `create` is called with the trimmed name; the new project is selected and the sheet closes.
- Styles: `project-switcher.css` is imported by `chat.css` (one import still carries everything) and listed in `package.json` `files`. Switcher rules are under `.project-switcher`, since it lives in the host header, outside `.chat-panel`.

## Behaviour
- Switcher: labelled button (`aria-haspopup`, `aria-expanded`, `aria-controls`), dialog sheet, search, rows with `aria-current`, ArrowUp/Down/Home/End, Tab wraps inside the sheet, Escape closes and returns focus to the button (Escape in the search box clears it first, in the name field cancels only the field), a press outside closes. Loading, empty, no-match and failed-list (with Try again) are worded.
- Chat bar (drawer layout with `threads`): `[chat name][Chats + "N waiting"][+ New chat]`. The name is also a button that opens the existing drawer (`tabindex=-1`, the Chats button is the keyboard route). New chat shows only where the transport has `newThread`, opens the new chat and hands focus to the composer. The bar draws the name, so a host that still passes `threads.onTitle` shows it twice: drop `onTitle` or pass `chatBar: false`. `onTitle` is still called.
- Project follow: when `status.projectId` changes under an unchanged `ownerKey`, the widget now rotates its owner exactly as an `ownerKey` change does (`owner-context.ts` `rotate()`): lists that project's chats, opens its newest or waiting chat, else an empty new chat for it, and sends go to that project. Hosts that put the project in `ownerKey` already got this; the first status is never a change. Fixed in passing: after any owner reset with a thread list, the new controller is now told the project on screen (`controller.setTarget`), where before an empty project read whichever project the transport found.
- `activity`: the widget hears the host's feed (`subscribe` on start, unsubscribe on stop and owner change), calls `read()` on start, never starts or stops the host's feed and never touches `transport.activity`. The host builds the source from the feed it already has: `snapshot`/`read` straight from its `ActivityFeed`, and `subscribe` over the `onChange` it passed to `createActivityFeed`.

## `changes` port (extension supplies this on its transport)
`ChatTransport.changes?: ChatChangesPort`, in `UI/src/chat/ports/transport.ts`:
```ts
type ChatChangesPort = { subscribe(listener: (change: { conversationId?: string }) => void): () => void };
```
The extension's `panelChanges` push `{ projectId, conversationIds?, at }` maps to one `listener({ conversationId })` call per id (or `listener({})` when none). Facts from `read-beat.ts` and the widget:
- Without `changes` the chat polls every 4 s (conversation, answers, thread list: 3+ relay calls). With it the foreground poll is 10 s (`CONVERSATION_POLL_CEILING_MS`); background (collapsed) is 5 s thread-list only either way. I did not change the intervals.
- Each call schedules ONE debounced (300 ms) refresh of the open conversation, the answers and the thread list. The `conversationId` is not used to narrow it, so any change reads all three; push only for changes of the shown project.
- `changes.subscribe` is called on chat start and unsubscribed on stop and owner change (leased by `lease-transport.ts`, so a stale owner's push is dropped).
- The poll stays on purpose: a server-side run writing a turn reaches a client with no push in no other way.

## Commands run and observed
- `pnpm --filter @fluxiq/ui-components exec vitest run src/chat src/project-switcher` (before the last cleanup) -> 742 passed, 1 failed: `chat/view/tests/empty-state-model.test.ts` "saved-key problems..." expects "Sign in to the FluxIQ panel once", gets "This saved model key needs recovery in FluxIQ..." (output of `onboarding/model-unavailable-words.ts`, the other worker's file; not mine, not fixed).
- After moving `chat-bar.test.ts` and lint-style fixes: `vitest run src/chat/threads src/project-switcher src/chat/tests/threads-widget.test.ts` -> 4 files, 47 tests passed.
- `pnpm --filter @fluxiq/ui-components check` -> exit 0, no output (first run, 56 s). A later `tsc --noEmit` showed errors only in `packages/fluxiq/src/ui/index.ts` (missing `@fluxiq/contracts/automation` exports `MODEL_KEY_LOCK_REASONS` etc.), not my files, seen while contracts `dist` was rebuilding.
- `pnpm --filter @fluxiq/ui-components build` -> exit 0; the cache said "inputs changed while it ran (packages/contracts/dist)". A final rebuild is recorded in the return contract.
- `node scripts/structure-audit.mjs` -> no `ui-components` failure after fixes (import via barrel, one statement per line, no `as never`, `chat/tests/` back to 25 files by putting `chat-bar.test.ts` in `chat/threads/tests/`). Other failures in the output are outside my paths (e.g. `apps/web/.../shared-source.ts` swallowed failure).

## Not verified
Real browser rendering and layout at 360 px, focus ring look, dark/light; tests use the fake DOM. The switcher sheet is `position:absolute` under its button, so a host that places it at the far right edge should check overflow. Behaviour against the live extension.

## Open questions
1. `threads.onTitle` duplicates the title when the bar is on (see above); extension should drop it.
2. `package.json` (`files` entry for the new CSS) is outside the stated owned paths; needed so the sheet ships.
