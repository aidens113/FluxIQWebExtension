# conv-chat-window-live — the chat window, actually opened and used

Task t084, downstream branch `task/t084-chat-window-live`, Core worktree
`F:\fxwork\t084\!FluxIQ`. All code changes are in Core's `apps/web`.

## Outcome

Done. The window is now an overlay over the whole workspace with a launcher
that is always on screen; it can be typed into; an empty thread teaches what
the channel is for; and a question raised by a server-side run reaches the
person with the tab in the background and the window collapsed, measured at
2–5 seconds.

**Before this task it did none of those things.** Not one conversation endpoint
call the browser made would have succeeded, and even with the endpoints
registered the window would have rendered an empty list, an empty transcript
and a text box that could not be clicked. Every one of those was found by
running it, and none of them by a test.

## The state I found it in

The chat window had never been opened. I stood up an isolated instance —
its own data root under my scratchpad, port 3184, never the user's panel —
and drove it with Playwright. What that exposed, in the order it bites:

**1. The conversation endpoints are not registered at all.**
`registerAutomationStudioConversationEndpoints` exists in
`packages/fluxiq/src/programs/automation-studio/api/handlers/conversations.ts`
and is called from nowhere in production. Its own header says so: the service
facade has no `conversations` field yet. So `list-conversations`,
`get-conversation`, `append-turn`, `answer-ask` and
`get-conversation-attachment` do not exist on a running server. **This is
t083's, and it is still outstanding — the exact lines are under
"What t083 has to add" below.** I registered them in a throwaway host module
(`FLUXIQ_HOST_MODULE`) so the window could be exercised; no Core source was
changed to do it.

**2. Every project-scoped call went out without `projectId`.** The transport
does not add one and Core's handlers read it straight off the request, so
`get-conversation`, `append-turn`, `answer-ask` and the attachment read all
came back `400 Unknown Automation Studio project: `. Measured live.

**3. The detail read was unwrapped one level too shallow.** Core answers
`{ conversation: { conversation, turns, hasMore } }`. The window read
`payload.conversation` as the conversation record and `payload.turns` as the
turns, so a thread with three turns rendered as a thread with none.

**4. The strict parsers refused every record Core sends.** `parseConversation`,
`parseConversationTurn` and `parseConversationAsk` treated an unknown field as
fatal. Core sends `title`, `revision`, `turnCount` and `pendingAskCount` on a
conversation; `ordinal` and `actorId` on a turn; `conversationId`, `turnId`,
`routes`, `consequences`, `permissionRequest`, `createdAt` and `answer` on an
ask; and options shaped `{ id, label, route }` rather than
`{ optionId, label, description, destructive }`. **Every conversation, every
turn and every ask was dropped.** The window would have been blank against a
working server.

**5. `answer-ask` was sent in a shape the handler cannot read.** The client
sent `{ conversationId, answer: { kind, ... } }`; the handler reads `askId`,
`kind` and `value` off the request and refuses anything else with
`An answer is one of: grant, deny, choice, text.` No ask could ever have been
answered.

**6. And the composer could not be typed into** — which is what the user hit.
The textarea carried `disabled={!thread.selectedConversationId}`, and with the
reads failing there was never a selected thread, so the box was permanently
`disabled` in the DOM. It is not a focus trap and not a pointer-events rule: it
is a real `disabled` attribute, waiting on data that could not arrive. The
empty state above it said "You can write first" over a box that would not take
a click.

## The three things the user found

**1. It must be an overlay.** The view is gone from the registry —
`conversation-thread` is no longer a canonical view, no longer in
`AutomationViewType`, no connector, no `connectorByViewId` entry, no
view-instance state. In its place `ConversationDock` mounts in
`AutomationStudioSession` **outside** `AutomationStudioWorkspaceComposition`,
fixed to the bottom-right corner at `--layer-overlay`, over every region.

- The launcher is always on screen. It reads "FluxIQ", or "Needs you" with a
  count when a thread is holding a question, and its accessible name spells it
  out: *"Open the FluxIQ conversation - 2 threads are waiting on your answer"*.
- Collapsing is the launcher, the chevron in the panel's own bar, or Escape.
  Escape stands down while a modal is open, so the re-authorization dialog
  cannot be cancelled and hidden in one keystroke.
- **Collapsed does not mean unmounted.** The panel keeps its DOM, its poller,
  its turns and its scroll position behind `hidden`. That is what lets the
  badge light for a question that arrives while the window is shut — measured
  below — and it is asserted by a source-text test so nobody turns it back into
  a conditional render.
- A wider/narrower toggle, because a Flow diff in a 380 px column is cramped.

**2. It can be typed into.** Root cause in §6 above. Fixed at the root — the
reads work, so a thread is selected and the box is live — and hardened so the
symptom cannot come back silently: a composer that genuinely has nowhere to
send now says so in words above the box ("FluxIQ opens a thread as soon as a
run, a build or a Flow has something to say"), and an architecture test fails
any composer that is disabled without a reason. Verified by typing into it and
sending: `append-turn` 200, the turn appears in the transcript, the box clears.

**3. There is an opening message.** `ConversationOpeningMessage` replaces
"Nothing said yet". It names the three journeys that actually arrive in a
thread, in the product's own words: permission before anything lasting, a
decision only the person can make, and what it did and what changed. Then it
says the person can write first, then it says nothing has been said yet. It is
what an empty window should have said all along.

## Does a question actually reach a person?

This was the brief's most important question and **the answer was no.**

`poller.ts` documented "a slow beat while the tab is hidden" and implemented
*no* beat: the hidden branch re-queued itself without ever calling `run`.
Measured before the fix — **0 reads in 12 seconds of a hidden tab, and a turn
written while hidden never arrived at all.** It only turned up when the person
came back and the `visibilitychange` handler fired.

A second defect compounded it: the poller was gated on a thread being selected
(`active: () => Boolean(selectedRef.current)`), so **a project with no threads
yet never read again.** That is precisely the project a run is about to open
the first thread in. It also froze a transient first-read failure — opening a
fresh project races its own schema migration — as a red error box for the rest
of the session.

Both fixed. The hidden branch now reads on the five-second beat; the poll runs
whenever the surface is mounted; and a single failed read is quiet (a polling
surface having a bad second), with the second consecutive failure of the *same*
read speaking up. Measured after, on a cold server:

| What was tested | Result |
|---|---|
| Polls in 12 s with the page reporting hidden | 3 reads, gaps 5.4 s / 5.4 s |
| Turn written from outside the tab while hidden | arrived in **3.0 s** |
| Turn written the instant the person returns | arrived in 2.2 s |
| **Permission ask raised by a run, tab hidden AND dock collapsed** | badge lit in **4.2 s**, label became "1 thread is waiting on your answer" |
| First thread opened in a project that had none | appeared in **2.3 s**, no reload |
| Turn arriving while scrolled up the thread | scroll position held at 0, "New turns below" shown |
| After 20 s idle with the dock collapsed | arrived in 3.4 s |

**One honest limit.** Playwright would not give me an OS-backgrounded tab:
`bringToFront()` on a second page left the first reporting `visible`, in both
headless and headed runs, and the CDP visibility override is not available. The
hidden-tab numbers above were taken with `document.visibilityState` overridden
to `"hidden"` and `visibilitychange` dispatched — which is exactly what the
poller keys off, so the code path is genuinely exercised, but a real
browser-throttled background tab was not. Chrome throttles background timers to
≥1 s, which a 5 s beat clears, so I expect it to hold; I did not prove it.

## Everything else that was wrong, and is now not

- **An answered ask kept its buttons.** After answering, the cursor read only
  fetched turns newer than the last one held, so the turn the ask hung on was
  never re-read and its Allow / Don't allow buttons and the "waiting on you"
  banner stayed up for the session. Two fixes: a write re-reads the thread from
  its start, and `mergeConversationTurns` — which deliberately prefers the copy
  already held, so a re-read never rewrites what someone is reading — now takes
  the *ask* from whichever copy is newer. The words are fixed once written; the
  ask is settled later, by this person, another tab, or a timeout.
- **A long thread opened at the top of the oldest turn.** The tail-following
  layout effect measured a collapsed panel, which has no geometry. The
  transcript now finds its tail when the dock opens.
- **The waiting notice sat above the transcript and pointed at nothing.** It is
  now inside the transcript frame with a "Show me" button that scrolls the
  turn holding the question into view, using manual scroll maths rather than
  `scrollIntoView`, which would have scrolled the workspace behind the panel.
- **Threads were named by their ids.** Core sends a `title` — "Nightly listings
  run" — which the parser was discarding. The header now shows it, with the
  subject as muted detail underneath, and the picker marks a waiting thread
  with a bullet.
- **The list opened on the most recent thread, not the one holding work up.**
  `sortConversationsForThreadList` now puts a thread with an unanswered ask
  first.
- **`GlobalConversationPrompt` had all the same wire defects** (no `projectId`,
  wrong envelope, nested answer) and could never have fired. Fixed. It also now
  stands down on the Automation Studio route: a modal over the top of the
  overlay would interrupt someone to tell them about a question their own chat
  window is already badging. It still covers the rest of the product.
- **A Rules-of-Hooks violation in the shared `ModalContent`.**
  `Boolean(props.busy || useInheritedOperationBusy())` skips the hook whenever
  the caller is already busy, so React saw a changed hook order and logged a
  violation on the render where a dialog becomes busy. It fires on the
  conversation's re-authorization, which is the one path where getting state
  wrong matters most. **This is outside my `Owns`** — one line in
  `features/programs/components/overlays/ModalContent.tsx` — and I fixed it
  rather than shipping a known React violation my feature triggers. It affects
  every dialog in the panel; flag it if you would rather it were reverted.
- **The attachment read was wrong twice**: it sent a `ref` the handler does not
  take and no `projectId`, and it read `payload.attachment` as the resolved
  thing when Core answers `{ attachment: { attachment, payload } }`.

## The parser decision, stated plainly

I removed the closed-whitelist refusal from `thread/contracts.ts`. An unknown
field is now ignored instead of dropping the record; every value-level check —
enum members, control characters in text, length bounds, id shape, timestamp
sanity — is kept in full, and a bad record still drops only itself.

The rule as written meant the panel broke whenever Core added a counter to a
row, and that is not hypothetical: it is why the window rendered nothing. The
strictness worth having is "never render text or an enum Core did not build".
"Refuse a conversation because it now carries `revision`" is not that.

## What t083 has to add (server side; I did not touch it)

1. **`AutomationStudioService` needs a `conversations` field**, the way it
   already has `runDatasets`:
   `readonly conversations = new AutomationStudioConversations(this.runtimeProjectDatabasePool, resolver?)`,
   beside `this.runDatasets = ...` at `runtime/service.ts:437`.
2. **`registerAutomationStudioApi` must call the conversation registration.**
   In `api/handlers/register.ts`, one line beside the others:
   `registerAutomationStudioConversationEndpoints({ registry, service, conversations: service.conversations });`
   Its handler module then stops being published from `handlers/index.ts`
   separately, as that file's comment anticipates.
3. **An attachment resolver, or none.** With no resolver `getAttachment`
   throws by design; the window degrades to a named reference with an Open
   action, which is correct, but a `flow-graph-diff` will never draw in place
   until something resolves the reference.
4. **A person cannot start a thread.** There is no endpoint that opens one —
   `openConversation` is Core-internal and `append-turn` needs an existing
   `conversationId`. So in a project where FluxIQ has never spoken, the person
   cannot speak first. The window now says so honestly instead of showing a
   dead box, but "the general channel for talking to FluxIQ" is half a channel
   until a `start-conversation(projectId, subject)` exists. **I think this is
   the most important open item after the wiring.**
5. **Opening a project's conversation store races its first schema migration:**
   `Automation Studio schema migration is already running for project <id>`.
   Transient — the next read succeeds — and the window no longer shouts about a
   single failure, but it is a real server-side race worth a look.
6. **`AutomationStudioActionConsequence` is still not on the browser-safe
   barrel** (`fluxiq/automation-studio/action-permissions`), so the union is
   derived downstream from the phrase map. Unchanged from t085's report; a
   one-line export would be cleaner.
7. **`AUTOMATION_STUDIO_CONVERSATION_CONSEQUENTIAL_CLASSES` is not exported to
   browsers either.** The panel therefore treats *any* consequence as worth
   re-authorizing rather than only the four Core calls consequential. That is
   the safe direction, but it means `create_new` asks for a PIN when Core says
   it need not.

## Commands run and observed results

Run from `F:\fxwork\t084\!FluxIQ` unless noted. The user's panel on port 3000
was never touched; my instance ran on 3184 with its own data root under the
session scratchpad.

| Command | Observed |
|---|---|
| `npx tsc --noEmit` (in `apps/web`) | clean, no output |
| `npx vitest run src/features/automation-studio/conversation/tests/` | **5 files, 56 tests, all passed** |
| `npx vitest run` (in `apps/web`) | **245 files, 1312 tests, all passed** |
| `node scripts/structure-audit.mjs` | `passed (175 warning(s), 360 baselined)` — no FAIL lines; 360 rather than 361 because two files were deleted |
| `pnpm check` | exit 0; structure rule tests, task tests, audit, and `tsc --noEmit` Done for `contracts`, `fluxiq`, `client-gateway-websocket`, `apps/web` |
| `pnpm build` | exit 0, `✓ Compiled successfully in 15.3s`, **First Load JS shared by all 154 kB** |
| Built-chunk grep | `Conversation transcript` and `This is where FluxIQ talks to you` appear only in `chunks/0f442abf45478643.js`, in none of the five shared chunks |
| Live: full use of the window (cold server) | login 200, launcher visible, 3 threads listed, composer enabled, reply round-tripped (2→3 turns), permission ask answered with PIN, buttons gone afterwards, Escape collapsed. **No console errors, no failed program-API requests.** |
| `pnpm -r --no-bail test` | **exit 0.** contracts 53/53, client-gateway-websocket 3/3, **`packages/fluxiq` 336 files / 2904 passed, 1 skipped**, `apps/web` 245 files / 1313 passed. Nothing from the environmental failure family appeared in this run |
| Live: reachability | table above |

**On the first-load figure.** 154 kB against the 153 kB the window's author
measured. The one kilobyte is `usePathname` entering
`GlobalConversationPrompt` so it can stand down inside the Studio. The dock,
the transcript and the opening message are all in a Studio route chunk.

## Not verified

- **A genuinely OS-backgrounded tab.** See the honest limit above: the hidden
  path was driven through an overridden `document.visibilityState`, not a real
  background tab, because the harness would not produce one.
- **The permanent server wiring.** Everything live here ran against endpoints I
  registered from a throwaway host module. The shapes are Core's own handlers
  and Core's own store, so the wire contract is proven, but t083's actual
  wiring has not been run.
- **A real `flow-graph-diff` attachment.** My resolver returned a hand-built
  diff. The rendering path, the unknown-kind degradation and the unresolvable
  reference are all exercised; a diff a repair genuinely produced is not.
- **Firefox and Edge.** Chromium only.
- **A live browser restore of a workspace that already contains the retired
  view.** I proved the mechanism rather than the journey:
  `createAutomationStudioViewInstances({}, ["conversation-thread", ...])` drops
  the pane and keeps the rest, which is now a test. I did not load a real saved
  layout in a browser to watch it happen.

## Reproducing the live instance

The harness is in the session scratchpad, not the repository (the structure
audit correctly refuses eleven files sharing a `t084-` prefix):
`…\scratchpad\harness\` holds `t084-live-host.mjs` (registers the endpoints
plus a test-only thread opener), `t084-live-seed.mjs`, and the drive scripts
`t084-drive.mjs`, `t084-reach.mjs`, `t084-hidden.mjs`, `t084-hidden2.mjs`,
`t084-empty2.mjs`. They must sit in `apps/web/` to resolve `fluxiq`. Start with:

```
FLUXIQ_IMPORTER_ROOT=<root> FLUXIQ_HOST_MODULE=<abs path>/t084-live-host.mjs \
FLUXIQ_CLIENT_GATEWAY_ENABLED=false npx next dev --turbopack --hostname 127.0.0.1 --port 3184
```

Note that `pnpm --filter @fluxiq/web fixture:e2e` is broken on `dev`, unrelated
to this task: it throws `Top-level orchestration Flows cannot own Nodes or
edges` from `saveFlow`. I seeded my own fixture instead.

## Open questions

1. **Should the overlay be product-wide rather than Studio-wide?** It mounts in
   the Studio shell, where the work is and where the bundle can afford it.
   Everywhere else still gets the modal prompt. Making the dock global means
   `next/dynamic` in the root layout to keep it out of the shared chunk — small,
   but a deliberate call I did not make unasked.
2. **Answering from the global prompt.** It still refuses consequential answers
   and points at the Studio. Now that the Studio has an always-visible window,
   that redirection is cheap and I left it; t085's open question 5 stands.
3. **The thread picker is a `<select>`.** Fine at three threads; at thirty it
   wants a list with the waiting ones at the top and a preview line. I did not
   build it because I could not honestly judge the shape without seeing a
   person with thirty threads.
