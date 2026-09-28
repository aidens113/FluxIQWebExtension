# WS-D — Shell, tabs, responsive band, and the chat's reach

Worker report. Covers **P5 (partly — see below), P9, P11, P15, P16, P19, P21,
P24**, and P17's `closing <viewId>` half. All paths are under
`F:\!FluxIQ\apps\web\src\features\automation-studio\` unless stated otherwise.

## Outcome

**Partial**, and the partial half is the one that matters most.

Items 2–7 of the brief are done and tested. **Item 1 — "give the composer a way
to start a conversation" — cannot be done in this repository.** Core has no
endpoint that opens a thread, and I did not fake one. Details and the exact Core
change needed are in §1.

---

## 1. Item 1: the chat still cannot be started, and this is a Core gap

I read Core rather than assuming, because the audit recorded this as unknown
(`panel-ux-audit.md`, *Not verified*, last bullet).

**What exists in Core.** The conversations collaborator has a real
`openConversation`, and so does the store beneath it:

- `packages/fluxiq/src/programs/automation-studio/runtime/conversations/conversations.ts:179`
  — resolves a subject to its open thread or mints a new one.
- `.../runtime/conversations/store.ts:90` — the idempotent insert.
- `.../runtime/conversations/writer.ts:77` — the only caller. A run, a build or
  a node opens its subject's thread the first time it says anything.

**What does not exist.** `openConversation` is **not registered as an API
endpoint**. `AUTOMATION_STUDIO_ENDPOINTS` names exactly five conversation
endpoints (`api/contracts/endpoints.ts:154-158`):

```
listConversations          "list-conversations"
getConversation            "get-conversation"
getConversationAttachment  "get-conversation-attachment"
appendConversationTurn     "append-turn"
answerConversationAsk      "answer-ask"
```

and `registerAutomationStudioConversationEndpoints`
(`api/handlers/conversations.ts:65`) registers those five and nothing else.
`api/contracts/conversation.ts:1-8` states the asymmetry as deliberate for
*authorship* ("nothing outside Core should be able to post a turn as the
automation") — but the consequence reaches further than authorship: **a person
cannot open a thread either.**

**And `append-turn` will not open one implicitly.** I checked, because minting a
client-side id and appending to it would have been the tempting shortcut:
`store.appendTurn` calls `requireConversation(await readConversation(...))`
(`store.ts:142-144`) and throws when the thread is not already there. So there
is no back door, and building one would have been a lie in the UI.

**Therefore the composer stays `disabled={!thread.selectedConversationId}`.** I
changed nothing about it. The existing copy is honest ("FluxIQ opens a thread as
soon as a run, a build or a Flow has something to say"), and a control that
cannot work must not be made to look as if it can.

### What Core needs, precisely

One endpoint, four files, all inside
`packages/fluxiq/src/programs/automation-studio/`:

1. `api/contracts/endpoints.ts` — add `openConversation: "open-conversation"` to
   `AUTOMATION_STUDIO_ENDPOINTS` beside the other five.
2. `api/contracts/conversation.ts` — a `ConversationOpenRequest`:
   `FlowProjectRequest & { subjectKind: string; subjectId: string; title?: string }`.
   `subjectKind` is already validated by `requestedSubject`
   (`api/handlers/conversations.ts:180-186`), which refuses anything but
   `project`, `flow`, `build` or `run`. For a person starting a thread with
   nothing selected, `subjectKind: "project"` with the project's own id is the
   right subject, and `openConversation` already continues that subject's open
   thread rather than minting a duplicate (`conversations.ts:180-183`).
3. `api/handlers/conversations.ts` — one more `registry.register` calling
   `conversations().openConversation({ projectId, subject, title })`, with
   `permission: "programs.write"` and `classification: "authoring"` (the same as
   `append-turn`: opening a thread is not destructive and must not take a PIN),
   after `await service.assertProjectDomainAccess(projectId, request.scope.domainId)`.
4. `api/handlers/tests/domain-scope.test.ts:58` — add the new endpoint to
   `DOMAIN_SCOPED`, which pins that every project-scoped conversation endpoint
   asserts domain access. That test will fail until it is added, which is the
   right behaviour.

Panel side, once that lands (about fifteen lines, all in files I own):
`startConversation` on `ConversationCommands` (`conversation/conversation-host.ts:46`),
a `startConversation` in `conversation/turn-commands.ts`, and a
`thread.startConversation` the composer calls when
`!thread.selectedConversationId` instead of being disabled. The new endpoint
would also need a line in `PANEL_ENDPOINTS_WITHOUT_A_CAPABILITY` or a capability
of its own, or the capability-coverage ratchet
(`conversation/capabilities/tests/coverage.test.ts`) will fail the build — which
is the ratchet working.

**This is a repository-boundary decision, so I stopped here as instructed.**
Contract 5 of the audit's cross-workstream section assigns the decision to the
supervisor.

---

## 2. Item 2: the conversation is now on the landing screen (P5, second half)

`live/components/AutomationStudioSession.tsx` returned the project gate before
the fragment that mounts the dock, so for the whole of a person's first visit
there was no chat at all. The gate branch now returns a fragment with
`<ConversationDock projectId={null} />` beside it.

`projectId: null` is not a placeholder: `list-conversations` treats it as "every
project this caller can see" and searches exactly what the `projects` endpoint
would return for the request's domain scope
(`api/handlers/conversations.ts:86-94`). So a question raised by a run the
person started earlier reaches them on the landing screen too.

A new case in `conversation/tests/conversation-architecture.test.ts` pins it.
I had to change one assertion in that file: it read
`session.indexOf("<ConversationDock") > session.indexOf("<AutomationStudioWorkspaceComposition")`,
and the gate's dock is earlier in the file, so `indexOf` found the wrong one.
It is now `lastIndexOf`, with the new case asserting the gate's own mount sits
between the gate and the composition — the same intent, checked more tightly.

---

## 3. Item 3: preview previews, and the strip says what it is hiding (P9)

**Preview replaces.** `openView(viewId, "preview")` appended
(`workspace/commands/workspace-commands.ts:62,96,123` before the change), so
"preview" named a behaviour that did not exist. Every click in the hierarchy
tree left a permanent tab, and the object-scoped views made that one tab per
Flow per view.

A pane now holds at most one preview tab, in a new
`workspace/commands/preview-tabs.ts`:

- a tree click (`preview` mode) replaces the pane's previous preview in the
  **same commit** the new one arrives in, so the strip never flickers through a
  state holding both;
- **a dirty view is never dropped** — it is kept and pinned instead, so the
  replacement can never destroy work in progress;
- adding a tab from the palette (`addPaneTab`) pins it; clicking an existing tab
  (`selectPaneTab`) leaves its preview standing, which is how a single-click
  preview behaves in an editor;
- dragging a tab, or closing it, forgets the record.

The registry is deliberately **not persisted**. A preview tab is a transient
reading position; restoring one into a saved layout would be restoring something
the person never asked to keep.

**Hidden-tab count.** `workspace/components/view-container.tsx` gained a
`+N` control in its own grid column, next to the two chevrons and the search
icon, which opens the same tab picker. The rule is a pure exported helper,
`automationHiddenTabCount`, measured from offsets a DOM adapter reads, so it is
testable without a layout engine. The tabs shell grid went from
`28px 1fr 28px 28px` to `28px 1fr auto 28px 28px`
(`styles/workspace/09-tabs.css:4`).

---

## 4. Item 4: state survives a tab switch (P15)

`workspace/commands/warm-activation.ts` — the warm cap went from **6/3** to
**12/6** (desktop / constrained). At six and three, opening a fourth tab on a
1000px screen unmounted the first one and silently threw away everything it held
in `useState` — the State view's mode and selected evidence, the Problems view's
six filters and page cursor, the Router's in-progress route draft.

Eviction already refuses to drop an active or a dirty view
(`warm-activation.ts:43`), so the cap only ever bounded memory, never
correctness. Twelve covers every tab a pane realistically holds now that a
preview replaces rather than appends; six still bounds a phone. I raised it
rather than removing it because each retained view is a mounted React tree.

`live/tests/automation-studio-live-ownership.test.ts:268-269` pinned the two
literals `= 6` and `= 3`; I updated them to the new values with a comment saying
what the pin is actually for. **That test is in `live/tests/`, which the brief
did not name as mine to edit** — flagging it. It asserts on a constant in a file
I own and would otherwise have blocked the change.

---

## 5. Item 5: nothing re-expands or re-scrolls behind the person (P16, P19)

**Folders stay collapsed.** `hierarchy/hooks/useSelectionDisclosure.ts` re-ran on
every change of the `nodes` array identity, and that array is rebuilt on each
project-data revision, so a folder collapsed around the current selection
reopened by itself seconds later. It is now guarded by a selection key
(`automationSelectionDisclosureKey`, exported and tested): a reveal happens once
per selection, not once per refresh.

The effect still depends on `nodes`, on purpose. While the tree has not loaded
far enough to hold the selected object no ancestor resolves, so nothing is
recorded and the reveal still fires on the refresh that finally brings the
object in — the one case where reacting to new nodes is right.

**The tab strip keeps its scroll.** `view-container.tsx`'s scroll effect was
keyed on `props.active`, so focus merely moving between panes — which changes
nothing about which tab is selected — discarded a deliberate horizontal scroll.
The dependency is now `[props.activeViewId, tabOrderKey]`.

---

## 6. Item 6: the 821–1100px band reflows (P11)

`.automation-view-body` is now a named query container
(`container: automation-pane / inline-size`, `styles/workspace/04-layout.css`),
following the Router's own pattern
(`styles/router-subflows/03-router-subflow-details.css:27-45`).

The eleven in-view layout selectors moved out of `@media (max-width: 820px)` and
into `@container automation-pane (max-width: 800px)` in
`styles/workspace/10-responsive-certification.css`. They were **moved, not
duplicated** — a test asserts they are no longer in the viewport-keyed block, or
the conversion would be an addition rather than a fix.

**Why 800px.** The threshold is now a pane width, not a window width:

| Window | Editor pane | Two columns? |
|---|---|---|
| 1440px, one pane | ~840px | yes |
| 1440px, two panes | ~420px each | no — reflows |
| 1280px | ~680px | no — reflows |
| 1100px | ~500px | no — reflows |
| 900px | ~300px | no — reflows |
| 820px (shell already one column) | ~790px | no — reflows, as the media query used to |

So the band the audit measured is covered, and the ≤820px behaviour the media
query used to give is preserved rather than lost.

**I did not change the 820px narrow-mode breakpoint**, so
`workspace/tests/strict-runtime-contract.test.ts:35` — the literal
`window.matchMedia("(max-width: 820px)")` — still holds unchanged. Converting
the in-view rules made moving the shell breakpoint unnecessary, and moving it
would have put drawers on a 1000px laptop.

**Residue, stated plainly:** the container queries fix the *in-view* layouts. The
tab strip itself is still 221–500px wide in that band and still shows two to four
tabs; what changed there is that tabs no longer accumulate and the count now says
how many are hidden. The 280px sidebar and 320px details panel are untouched.

---

## 7. Item 7: one collapse control, and the launcher clear of the chrome (P21, P24)

**One chevron.** `shared/CollapseToggle.tsx` is new and is now the only collapse
chevron the panel draws. Four regions each wrote their own, with three icon
pairs, three classes and four wordings. The rule it follows is the only one that
reads without being taught: **the chevron points the way the panel is about to
move.** The caller gives the edge and the subject; nothing else about a collapse
is decided per region.

Wired into `workspace/shell/RightPaneArea.tsx`, `workspace/shell/TimelineDock.tsx`,
`hierarchy/AutomationProjectHierarchySidebar.tsx` and
`conversation/components/ConversationDock.tsx`. Wording is now "Hide the
sidebar" / "Show the details panel" / "Hide the step preview" / "Hide the
conversation (Esc)". A test asserts none of the four still imports a `Chevron*`
icon of its own.

It lives in `shared/` because `conversation/` and `workspace/` are siblings, and
`workspace/` has no barrel; `shared/` is the existing cross-domain home
(`shared/DetailSection.tsx`) and is outside the architecture contract's
`productDomains` set, so the import is legitimate. Structure audit and the
sibling-domain-private import rule both pass.

`workspace/tests/strict-runtime-contract.test.ts` asserted the literal
`aria-expanded={!state.collapsed}` in the two shell regions; that string now
lives once, in the shared control. The assertions were updated to check the
shared control is used, that each region passes its own `collapsed` state and
edge, and that `aria-expanded` is rendered from it — the same intent, in the
place it now lives. That file is in my directory and the brief anticipated
updating it.

**The launcher.** It is no longer pinned to `bottom: var(--space-lg)`. It reads
`--automation-conversation-dock-bottom`, which:

- `body:has(.automation-studio-shell)` raises to `calc(var(--space-lg) + 44px)`,
  clearing the collapsed step-preview dock — that dock collapses to a single
  36px header row whose own collapse control sits at its right-hand end, which
  was exactly the corner the launcher occupied;
- `body:has(.drawer-panel.automation-preview-sheet)` raises again at ≤768px to
  `calc(max(320px, min(64dvh, 560px)) + var(--space-sm))`, repeating the sheet's
  own height, because the sheet is `bottom: 0; width: 100vw` and the two were
  anchored to the same corner.

---

## 8. Commands run and observed results

Every WS-D suite the audit names, run together:

```
$ npx vitest run src/features/automation-studio/workspace \
    src/features/automation-studio/conversation \
    src/features/automation-studio/live \
    src/features/automation-studio/styles \
    src/features/automation-studio/hierarchy \
    src/features/automation-studio/shared

 Test Files  66 passed (66)
      Tests  449 passed (449)
```

That includes `workspace/tests/strict-runtime-contract.test.ts`,
`workspace/shell/tests/shell.test.tsx`, `conversation/tests/`,
`live/components/tests/`, `styles/tests/`, and
`hierarchy/components/tests/ProjectTree.test.tsx` — **which I did not edit and
which passes.**

Baseline before any of my changes, same command minus `shared`: 60 files / 419
tests passed. After, same selection: 64 files / 441 tests passed. (The counts do
not differ by exactly my five new files and twenty-one new cases because another
worker removed a test file from this selection while I was working -- see the
whole-app run below.)

Type check:

```
$ npx tsc --noEmit            # apps/web
(no output — clean)
```

Structure audit:

```
$ node scripts/structure-audit.mjs
structure-audit: passed (189 warning(s), 355 baselined).
```

It caught three real violations of mine first — my two new command modules and
their test imported `../../views/view-registry` past the `views` barrel. Fixed
by importing the barrel rather than baselining. It also caught
`workspace-commands.ts` at 345 lines against the shell test's 300-line ceiling;
that is why `pane-layout.ts` and `preview-tabs.ts` exist as separate modules
rather than as more of one file. `workspace-commands.ts` is now 221 lines.

Core's package check:

```
$ pnpm --filter fluxiq check
> tsc --noEmit
(clean, exit 0)
```

Whole-app run:

```
$ npx vitest run             # all of apps/web
 Test Files  2 failed | 254 passed (256)
      Tests  2 failed | 1420 passed (1422)
```

**Neither failure is mine, and both are in files another worker owns:**

| Failing case | Asserts on | Owner |
|---|---|---|
| `views/tests/GraphEditorViews.test.ts > keeps active-tab changes behind the Flow editor render boundary` — `expected … to contain 'aria-label="Opening node editor"'` | `flow-editor/components/FlowEditorView.tsx` | WS-A |
| `views/tests/canonical-diagnostics-disclosure.test.ts > enforces the runtime-debug diagnostics contract` — `expected … to contain 'Advanced JSON'` | `runtime/FlowRunView.tsx` | WS-A |

Both are exactly what WS-A's scope says it would do: remove the blank
`aria-busy` pane (which is where `aria-label="Opening node editor"` lived) and
rewrite the Run panel's copy (where "Advanced JSON" lived). The test files are in
`views/tests/`, which WS-B owns. I touched none of the four files.

---

## 9. Files changed

Product code:

```
workspace/commands/workspace-commands.ts       preview mode; human-readable close prompt; split
workspace/commands/preview-tabs.ts             NEW — the preview registry and the close label
workspace/commands/pane-layout.ts              NEW — pane transforms moved out (300-line ceiling)
workspace/commands/warm-activation.ts          warm caps 6/3 -> 12/6
workspace/components/view-container.tsx        scroll deps; hidden-tab count and its pure helper
workspace/shell/RightPaneArea.tsx              shared collapse control
workspace/shell/TimelineDock.tsx               shared collapse control
hierarchy/AutomationProjectHierarchySidebar.tsx  shared collapse control
hierarchy/hooks/useSelectionDisclosure.ts      reveal once per selection, not per refresh
conversation/components/ConversationDock.tsx   shared collapse control
live/components/AutomationStudioSession.tsx    dock on the project gate
shared/CollapseToggle.tsx                      NEW — the one collapse control
styles/workspace/04-layout.css                 pane query container; dock bottom inset
styles/workspace/06-responsive.css             dock clears the narrow preview sheet
styles/workspace/09-tabs.css                   grid column and styling for the hidden-tab count
styles/workspace/10-responsive-certification.css  media -> @container for eleven view layouts
styles/workspace/03-controls.css               .automation-collapse-toggle
styles/conversation/02-dock.css                launcher reads its bottom inset
```

Tests:

```
workspace/commands/tests/preview-tabs.test.ts       NEW  7 cases
workspace/components/tests/view-container.test.tsx  NEW  4 cases
hierarchy/hooks/tests/useSelectionDisclosure.test.ts NEW 3 cases
shared/tests/CollapseToggle.test.ts                 NEW  3 cases
styles/tests/pane-responsive.test.ts                NEW  4 cases
workspace/tests/strict-runtime-contract.test.ts     updated — collapse control assertions
conversation/tests/conversation-architecture.test.ts updated — lastIndexOf + gate-mount case
live/tests/automation-studio-live-ownership.test.ts  updated — warm cap literals  [see §4]
```

Not touched: `hierarchy/components/tests/ProjectTree.test.tsx`, anything under
`settings/`, and all four dead overlay files.

---

## 10. Not verified

- **Nothing was run in a browser.** No build, no unpacked extension, no live
  panel. Every claim below the type check and the suites is read from source.
- **The container queries are not measured in a rendered page.** The pane widths
  in §6 are computed from the CSS grid declarations and the default preference
  values (280px sidebar, 320px details panel, 14px padding), exactly as the
  audit computed them. That 800px is the right threshold is a reasoned choice,
  not an observation. **This is the item most worth checking in a browser:** drag
  a window across 1100px, 900px and 830px and watch the two-column view layouts.
- **`container-type: inline-size` makes `.automation-view-body` a containing
  block for fixed-position descendants.** I grepped the Studio stylesheets and
  found four `position: fixed` rules — the conversation dock, a project-browser
  rule, and two in `03-controls.css` — none of which render inside a view body,
  and modals portal to `document.body`. But a fixed-position element rendered
  inside a view at runtime would now be positioned against the pane. Unproven in
  a browser.
- **The hidden-tab count is not exercised against real layout.** The rule is unit
  tested from offsets; the DOM adapter, the `ResizeObserver` and the scroll
  listener that feed it are not. jsdom reports every `offsetWidth` as 0, so a
  rendering test would assert nothing real.
- **The preview-tab replacement is not exercised through the tree.** The command
  layer is tested directly; that `hierarchy/controller.ts:66` reaches it with
  mode `"preview"` is read from source, not driven.
- **The dock on the landing screen is asserted structurally, not rendered.** The
  new test reads `AutomationStudioSession.tsx`; it does not mount the gate and
  find a launcher.
- **The warm cap of 12 is not measured for memory.** Twelve mounted view trees
  per project is a judgement, not a profile.

---

## 11. Open questions and contradictions found

1. **The Core gap in §1 is the whole of item 1 and needs a supervisor decision.**
   Everything else in WS-D is landed; this is not.

2. **`live/tests/automation-studio-live-ownership.test.ts` pins constants that
   belong to WS-D but lives outside WS-D's named file list.** I edited two
   literals in it (§4). If the supervisor would rather I had not, the change to
   revert is those two numbers and the constants in
   `workspace/commands/warm-activation.ts`.

3. **The audit says the four collapse chevrons are "four different
   icons/directions for the same verb". The directions were in fact already
   consistent** — each region's chevron already pointed the way its panel moved.
   What actually differed was the icon pair, the class, the size and the wording,
   and that a person had to learn the same affordance four times. The
   unification therefore reads as a naming and consistency fix rather than a
   correctness one, and it removes four hand-written buttons.

4. **`workspace/layout/contracts.ts` would have been the natural home for the
   preview tab id, and it is in no workstream's file list.** I kept the preview
   registry in memory instead, which is defensible on its own merits (a preview
   is transient and should not be restored into a saved layout) but does mean
   the tab strip cannot render a preview tab in italics the way an editor does —
   `PaneArea` has no subscription to that state. If a visible preview marker is
   wanted, it needs a field on `AutomationWorkspacePane`, and that file needs an
   owner.

5. **The 821–1100px band is improved but not solved.** The in-view layouts now
   reflow; the chrome still takes 600px before a view gets anything, so the tab
   strip in that band is 221–500px wide. Narrowing the sidebar and details panel
   in that band, or engaging narrow mode above 820px, would finish it — both are
   shell-level decisions with visible consequences, and neither was in the
   brief.

6. **The capability-coverage ratchet will bite whoever adds `open-conversation`.**
   `conversation/capabilities/tests/coverage.test.ts` re-derives the panel's
   mutating writes from source and fails on an endpoint that is neither declared
   as a capability nor excused with a written reason. That is the ratchet
   working, and worth knowing before the Core task is opened.
