# conv-chat-window — the chat window in Core's own web application

Task t085, branch `task/t085-chat-window`, worktree `F:\fxwork\t085\!FluxIQ`.
All work is in `apps/web`; no file under
`packages/fluxiq/src/programs/automation-studio/runtime/**` was read from the
working tree, changed, or imported except through Core's published
browser-safe barrel `fluxiq/automation-studio/action-permissions`.

## Outcome

Done. The conversation is a first-class Automation Studio view, a turn can
carry something the panel draws itself, an ask is answered inside the turn that
asked it, and a pending question reaches the person on any page of the product.
Built against the plan's fixed contract; two places where the contract was
silent are named under **Open questions**, neither of which is a disagreement
with it.

## What changed and why

### 1. A chat window as a first-class Studio view

`conversation-thread`, declared in `views/canonical-view-definitions.tsx`:
group `Workspace`, **region `right`** with `allowedRegions: ["right", "main"]`,
`requires: "hasProject"`, `addable`, `dataIntensity: "paged"`, and
**`lifecycle(false)`** — `sleepUntilActivated: false`, matching `clients` and
`problems`. A view that sleeps never receives an answer, so this is the one
lifecycle setting the surface cannot compromise on; it is asserted in
`conversation/tests/conversation-architecture.test.ts`.

The id is `conversation-thread` rather than `conversation` deliberately: the
architecture gate counts every string literal equal to a canonical view id
outside the three registry owners as a violation, and `"conversation"` is a
word that would collide with ordinary code.

Wiring touched (the report's nine, plus four the report did not predict):

| # | File | What |
|---|---|---|
| 1 | `views/canonical-view-definitions.tsx` | the definition and its `defineComponentAutomationViewHost` adapter |
| 2 | `views/view-types.ts` | `"conversation"` added to `AutomationViewType` |
| 3 | `conversation/components/ConversationView.tsx` + `conversation/conversation-host.ts` | the component and its command hook |
| 4 | `conversation/functionality-contract.ts` | the declarative behaviour matrix |
| 5 | `live/view-host/conversation-connected-view.ts` | the connector |
| 6 | `live/view-host/connected-view-entries.tsx` | `connectorByViewId` registration |
| 7 | `live/view-host/useAutomationConnectorCommands.ts` | `onSelectedConversationChange`, `onOpenAttachment` |
| 8 | `styles/conversation/01-thread.css` + the Studio CSS manifest | one sheet, one `@import` |
| 9 | `tests/architecture-contract.test.ts` | `canonicalEntryViews`, `productDomains`, `approvedTopLevelDirectories` |
| 10 | `styles/tests/styles-architecture.test.ts` | `expectedDomains` gains `conversation` |
| 11 | `testing/tests/data-intensive-view-coverage.test.ts` | a non-`light` view must carry empty/large/loading/error/permission coverage |
| 12 | `flow-editor/tests/canonical-view-functionality.test.ts` | the canonical behaviour-matrix gate gains the 13th contract |
| 13 | `views/tests/canonical-diagnostics-disclosure.test.ts` | every registered view needs a diagnostics policy |
| 14 | `live/components/AutomationStudioSession.tsx` + `live/hooks/useConversationWorkspaceNavigation.ts` | selection persistence and attachment navigation |

Items 11–14 are gates the panel-UI report did not list. Each one failed on a
bare `pnpm --filter @fluxiq/web test` run and was satisfied rather than
loosened: the conversation view now carries the same declared behaviour matrix,
scale policy, diagnostics policy and large-collection evidence as the other
twelve.

### 2. The transcript

`conversation/components/ConversationThread.tsx`. An `<ol>` with
`aria-label="Conversation transcript"` and `aria-live="polite"`, one
`ConversationTurn` per row carrying author, `formatRuntimeTimestamp` (reused
from the runtime barrel, as `AdaptationsView` already does) and text.

Two behaviours the panel had nowhere:

- **Tail-following.** `conversationFollowsTail()` decides from scroll metrics,
  with a 48 px slack, whether the person is at the bottom. An arriving turn
  scrolls into view only if they were; otherwise a **New turns below** control
  appears and their scroll position is left alone.
- **Bounded mounting.** `visibleConversationTurns()` mounts the most recent 200
  turns and puts the rest behind one **Show N earlier turns** control.

**A deviation from the panel-UI report, stated plainly.** The report proposed
copying `RunActionLogView`'s hand-rolled virtualiser. That virtualiser assumes
a fixed 38 px row. A turn is variable height — text, plus possibly a consequence
list, two buttons and a rendered diff — so fixed-row virtualisation would
mis-measure every row and break the scroll maths that tail-following depends
on. A tail window is the honest equivalent at this scale; the large-collection
test drives 5,000 turns through it.

### 3. Answering an ask inline

`conversation/thread/answers.ts` turns an ask into a presentation: a title,
Core's consequence phrases (read from Core's own exhaustive map, never
re-worded here), and a list of actions each carrying `label`, `variant` and a
`destructive` flag. `ConversationAskForm` renders it inside the turn.

- **permission** — `Allow` sends `{ kind: "grant", consequences: [...ask.missing] }`,
  exactly the classes the ask listed and nothing wider. `Don't allow` sends
  `{ kind: "deny" }`.
- **choice** — one action per option; the answer is `{ kind: "choice", optionId }`.
- **confirm** — `Confirm` / `Cancel`.
- **open** — a textarea and `{ kind: "text", text }`.

**Borrowed from the adaptation review:** per-action copy as data, `destructive`
as a flag in that data rather than a judgement the component makes, and a
re-authentication step for a consequential answer — the shared
`AuthorizationDialog` with `requirements={{ pin: true }}`, not a second PIN
field. **Not borrowed:** the review's placement. The review hides its decision
buttons on the fifth tab of a detail pane; here the answer lives in the turn
that asked for it. Granting and picking a destructive option re-authorize;
refusing, cancelling and answering in words do not, because a PIN demanded for
everything is a PIN nobody reads.

### 4. A turn that carries something the panel draws

The seam is `conversation/components/attachment-registry.ts`: a kind → component
map, plus a label for an unknown kind. `ConversationAttachmentPanel` looks the
kind up, resolves the reference, and renders; for an unknown kind, or when
nothing can resolve the reference, it names what the turn carries and offers to
open it. That degradation matters because the contract gives a turn only
`{ kind, ref }` — a reference, never a payload.

One kind is rendered: `flow-graph-diff`, in `FlowGraphDiffAttachment.tsx` —
added / removed / changed nodes and edges as a read-only `role="table"` grid,
with its own strict parser, so an unreadable diff shows its reference rather
than half a Flow.

**A second deviation, and the reason.** The brief pointed at `FlowGraphCanvas`,
`FlowNode` and `FlowEdge` for read-only reuse. `FlowGraphCanvas` takes a
`FlowEditorController` — around sixty fields of drag, reconnect, palette,
selection and viewport state built for editing a graph the person owns — and
registers itself with the workspace's graph action registry. Mounting that
inside a transcript entry would pull the editor's entire mutation surface into
a piece of evidence. The structural diff is drawn directly instead. Drawing the
same data on a canvas later is a change to one file behind the registry.

### 5. Reachability — the hard problem

Confirmed before building: no `EventSource`, no client `WebSocket`, and the
change feed fires only on a mutation the same tab dispatched. A turn written by
a server-side run would never arrive.

`conversation/thread/poller.ts` is the answer: the pairing prompt's adaptive
backoff, extracted and made testable. Fast beat 1 s while something is pending;
×1.6 decay while idle and ×1.8 after a failure, both capped at 10 s; 5 s while
the tab is hidden; an immediate read on `visibilitychange`. It never overlaps
two reads and stops on dispose. `nextConversationPollDelayMs` is a pure
function so the decay is asserted without a clock.

`createActivePoller` (the Connected Clients poller) was deliberately **not**
reused: its delay is fixed at construction, and the whole point here is that
the delay moves with what the last read found.

Three refresh paths, all pre-existing panel mechanisms:

1. **The mutation bus** — a new closed-union kind `"conversation.changed"`
   (`stores/mutation-transaction-store.ts`), committed after a reply or an
   answer, so a second mounted thread refreshes with no beat at all.
2. **The backoff poll** — for a change a server-side run caused.
3. **A monotonic request counter plus an `AbortController`** per detail read,
   the panel's own staleness guard, so a slow answer never overwrites a newer
   one.

**The global prompt.** `apps/web/src/app/GlobalConversationPrompt.tsx`, mounted
in `app/layout.tsx` beside `GlobalClientGatewayPairing`, for any authenticated
user. It uses a plain `fetch` rather than `useProgramApi`, which would pull
`useSearchParams` into every route's root layout, and it shows one question at
a time; answering or dismissing reveals the next, with dismissals bounded at 20
exactly as the pairing prompt bounds its own.

It offers only the non-destructive answers. Anything that would grant a
consequence class is not answerable from a global modal — it carries a notice
pointing at the Conversation view, where the answer is re-authorized.

### 6. A first-load regression found and fixed

The first build put the whole conversation view — transcript, composer,
re-authorization dialog — into the chunk shared by **every** route, because the
global prompt imported the feature barrel. Measured: **First Load JS shared by
all went from ~141 kB to 412 kB**, and `grep`ping the built chunks found the
transcript's own copy in `chunks/49182aa30139d326.js`.

Fixed by splitting the feature: `conversation/thread/` now holds the pure
domain — contracts and their strict parsers, transcript model, answer copy,
poller, pending-ask selection — with no React in it, and the prompt imports
only that. Rebuilt: **shared first load is 153 kB**, of which the prompt's own
chunk is 12 kB; the transcript components appear only in Studio route chunks.
This is also the better shape: the thread domain is now testable and reusable
without the view.

### Conventions followed

Plain global CSS in one numbered sheet under a new `conversation` style domain,
behind the import-only manifest, role tokens only (`--surface-pane`,
`--surface-tool`, `--surface-selected`, `--surface-code`, `--content-code`,
`--color-border`, `--color-text-muted`), no literal surface colours, no
`letter-spacing`, no font-size at or below 10 px, breakpoints at 768 px and
390 px, appended after the existing media blocks so the responsive contract's
block-slicing assertions are untouched. State through `useState` plus the
existing mutation store; no browser persistence in any view component. Every
view split into `ConversationView` / `ConversationViewContent`. No `setInterval`
anywhere, asserted by source text in my own architecture test.

Two shared-surface edits were needed to keep the structure audit's barrel rule
green without weakening it:

- `views/index.ts` now re-exports the view registry. Nothing imported that
  barrel before, so the risk is confined to the new importers.
- `live/view-host/conversation-connected-view.ts` is a separate `.ts` module
  rather than a 13th export of `canonical-connected-views.tsx`, which is at its
  ratcheted one-component-per-file ceiling. A connector needs no JSX, so the
  ceiling stays where it is.

## Commands run and observed results

Run from `F:\fxwork\t085\!FluxIQ`, or from `apps/web` / `packages/fluxiq` for
package suites. The panel server was never started.

| Command | Observed |
|---|---|
| `npx tsc --noEmit` (in `apps/web`) | clean, no output |
| `npx vitest run src/features/automation-studio/conversation/tests/` (in `apps/web`) | **5 files, 45 tests, all passed** |
| `npx vitest run` (in `apps/web`) | **245 files, 1302 tests, all passed** |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (175 warning(s), 361 baselined)` — no FAIL lines, no baseline entry raised |
| `pnpm check` | structure rule tests 20/20, task tests, structure audit passed, `tsc --noEmit` Done for `packages/contracts`, `packages/fluxiq`, `packages/client-gateway-websocket`, `apps/web` |
| `pnpm build` | `✓ Compiled successfully in 18.9s`; `First Load JS shared by all 153 kB` |
| `pnpm -r --no-bail test` | contracts 53/53 pass, client-gateway-websocket 3/3 pass, **`packages/fluxiq` 17 tests failed** |
| `pnpm --filter fluxiq test` | **6 tests failed** (5 × `Test timed out in 15000ms`, 1 DeepSeek deadline assertion) |
| `npx vitest run .../instruction-readiness.test.ts` (in `packages/fluxiq`) | **passed** in isolation, 10.7 s |

**On the `packages/fluxiq` failures.** They are not mine and not caused by this
work, on three pieces of evidence. Every failing file is under
`programs/automation-studio/runtime/**` or `storage/**`; `packages/fluxiq` does
not depend on `apps/web`, and `git status` shows every change I made is inside
`apps/web`. The failing *set* differs between the two runs — 17 files under the
concurrent `-r` run, 6 under the package-only run, and the two sets are almost
disjoint — which is the signature of contention, not a regression. And one of
them passes in isolation. The failures are 15-second timeouts plus one flaky
live-provider deadline test.

## Not verified

- **Live browser behaviour.** Nothing was exercised in a real browser. Three
  things in particular rest on assertions about source and model rather than on
  a running page: a turn arriving from a server-side run while the tab is in the
  background and being announced on return; tail-following measured against
  real scroll geometry (`react-test-renderer` gives host refs as `null`, so the
  layout effect no-ops in tests, and the decision function is tested directly
  instead); and focus behaviour of the re-authorization dialog.
- **The endpoints themselves.** `list-conversations`, `get-conversation`,
  `append-turn`, `answer-ask` and `get-conversation-attachment` belong to the
  API task. Everything here is built against command doubles. Nothing was run
  against a live service, so no payload has ever made the round trip.
- **The `packages/fluxiq` suite is not green** on this machine, for reasons
  argued above but not proven by bisection.
- **The 141 kB pre-change first-load figure** is inferred (153 kB minus the
  prompt's own 12 kB chunk), not measured on a clean tree.

## Open questions or contradictions found

1. **`list-conversations(projectId)` — is `projectId` nullable?** The global
   prompt is mounted in the root layout, which knows no project, so it calls
   `list-conversations` with `projectId: null` meaning "every project this
   person can see". The contract names the parameter but not its nullability.
   I read it as a filter rather than a requirement and built on that. If the
   API task makes it required, the prompt needs another way to learn a project,
   and there is no good one from the root layout.

2. **Resolving an attachment needs a read the contract does not name.** A turn
   carries `attachment: { kind, ref }` — a reference, never a payload — so
   something must resolve the reference before the panel can draw the thing. I
   added `get-conversation-attachment(conversationId, turnId, ref)` as an
   **optional** command: when it is absent the turn renders the attachment as a
   named reference with an Open action, which is exactly what the contract
   promises and nothing more; when it is present the attachment is drawn in
   place. So nothing breaks if this endpoint never lands, but requirement (4)
   of the brief is only half met without it. This is the one addition to the
   contract's endpoint list and it needs the API task's agreement.

3. **The consequence union is not on Core's browser-safe barrel.**
   `fluxiq/automation-studio/action-permissions` exports
   `AUTOMATION_STUDIO_ACTION_CONSEQUENCE_PHRASES` and the request parser, but
   not `AutomationStudioActionConsequence`. That barrel is inside the path this
   task must not touch, so the union is derived downstream as
   `keyof typeof AUTOMATION_STUDIO_ACTION_CONSEQUENCE_PHRASES` — exhaustive and
   self-maintaining, but a one-line export on the client barrel would be
   cleaner and belongs to whoever owns that file.

4. **Two reads at mount.** In a browser the view does a from-start read when a
   conversation is selected and the poller's first beat immediately follows with
   a cursor read. Harmless and cheap, but it is two requests where one would do,
   and a live run is what would show whether it matters.

5. **What the prompt should do with a destructive answer.** It currently refuses
   to offer one and points at the Studio view. That is the safe reading of "a
   consequential answer is re-authenticated", but it means the most urgent class
   of question — a permission ask — cannot be answered from the prompt that
   found the person. Putting the authorization dialog in the global prompt is a
   small change if that is wanted; it was not obviously in scope.
