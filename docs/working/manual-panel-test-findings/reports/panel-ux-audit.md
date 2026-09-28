# Control panel UI/UX audit — Automation Studio

Read-only investigation. No product code changed. All paths are relative to
`F:\!FluxIQ` unless stated otherwise; `AS/` abbreviates
`apps/web/src/features/automation-studio/`.

Method: read the view registry, the workspace shell, every canonical view's
entry component, the hierarchy sidebar, the overlay/dialog set, the conversation
dock and the studio stylesheets. Every claim below carries a file:line citation.
Nothing here was verified in a running browser — see **Not verified** at the end.

---

## 1. Information architecture

### 1.1 Top-level views: twelve, defined in one registry

`AS/views/canonical-view-definitions.tsx:77-162` defines exactly twelve views.
That file is the only source of view identity; `AS/views/view-registry.ts:51-56`
builds the lookup from it.

| # | Label shown | id | Region | Group | Requires | Line |
|---|---|---|---|---|---|---|
| 1 | Connected Clients | `client-gateway` | main | Workspace | hasProject | :79 |
| 2 | Timeline | `timeline-recording` | main | Evidence | hasRecording | :86 |
| 3 | Nodes | `flow-nodes` | main | Flow | hasSubflowGraph | :93 |
| 4 | Router | `flow-router` | main | Flow | hasTopLevelFlow | :100 |
| 5 | Subflows | `flow-subflows` | main | Flow | hasFlow | :107 |
| 6 | Instructions | `flow-instructions` | main | Flow | hasFlow | :114 |
| 7 | Adaptations | `adaptations` | main | Flow | hasFlow | :121 |
| 8 | Settings | `flow-settings` | main | Flow | hasFlow | :128 |
| 9 | State View | `state-explorer` | main | Evidence | hasSelection | :135 |
| 10 | Runtime Debug | `runtime-debug` | main | Evidence | hasFlow | :142 |
| 11 | Problems | `problems-view` | right | Evidence | hasProject | :149 |
| 12 | Inspector | `global-inspector` | right | Workspace | hasProject | :156 |

Ten are main-region-only, two are right-region-only
(`allowedRegions` at :150 and :157). So the "Add tab" palette offers ten options
in the editor and exactly two in the right sidebar
(`AS/workspace/view-adder.ts:38-50`).

### 1.2 The same twelve names are also the tree

`AS/hierarchy/flow-generation.ts:106-115` gives **every Flow** in the sidebar
seven fixed children with the same names as the tabs: Router (or Nodes),
Subflows, Instructions, Recordings, Adaptations, Runtime Debug, Settings. The
tree is therefore a second, parallel navigation of the same twelve destinations.
Two navigations for one set of destinations is the root IA problem: nothing tells
a person which one is authoritative, and they disagree (the tree row is labelled
`Recordings` at :109 but opens the tab labelled `Timeline`,
`canonical-view-definitions.tsx:86`).

### 1.3 Near-duplicates

- **Nodes / Router / Subflows** are three separate top-level views over the same
  Flow, all in group "Flow", all using the *same* `GitBranch` icon
  (:93, :100, :107). Router is "route into subflows", Subflows is "list the
  subflows", Nodes is "edit one subflow's graph" — one concept split three ways.
- **Timeline / State View / Runtime Debug / Action Preview dock** are four
  surfaces for "what happened in a run or recording" (:86, :135, :142 and
  `AS/workspace/shell/TimelineDock.tsx:68`). The dock is a permanent fifth
  region, not a tab.
- **Inspector / State View** both claim scope "Current selection" (:136, :157).
- **Problems / Inspector** are the only two right-region views and compete for
  the one right pane (:150, :157).

Icon collisions make this worse: twelve views use seven distinct icons. `Radio`
serves both Connected Clients and Timeline (:79, :86); `GitBranch` serves Nodes,
Router and Subflows (:93, :100, :107); `ListChecks` serves Instructions and
State View (:114, :135); `SlidersHorizontal` serves Settings and Inspector
(:128, :156). Tabs are `min-width: 80px` with a truncating label
(`AS/styles/workspace/09-tabs.css:50-63`), so at real widths several tabs are
literally indistinguishable.

### 1.4 Empty or near-empty in a fresh project

With a project open and no Flow created, of the twelve views:

- **Nodes** is the default tab (`AS/workspace/layout/defaults.ts:27,48`) and is
  *blank* — see 2.3. It also requires `hasSubflowGraph`, which the view-adder
  itself reports as "Select a Subflow first" (`AS/workspace/view-adder.ts:28`).
  The app opens by default a view its own availability rules call unavailable.
- **Router** renders "Select a Flow to edit its Router"
  (`AS/router/RouterContentView.tsx:53-63`).
- **Subflows** renders "Select a Flow"
  (`AS/subflows/SubflowsView.tsx:174`).
- **Instructions** renders "Select a Flow"
  (`AS/instructions/InstructionWorkbenchPanels.tsx:28`).
- **Adaptations** renders "Select a Flow to review adaptations"
  (`AS/adaptations/AdaptationsView.tsx:205`).
- **Timeline / Recordings** — no recordings exist
  (`AS/recordings/RecordingListView.tsx:34`).
- **Connected Clients** — "No clients connected yet."
  (`AS/clients/ClientGatewayView.tsx:60`).
- **Inspector** — "Select an object to inspect"
  (`AS/inspector/InspectorPanel.tsx:49`).
- **State View / Problems / Settings / Runtime Debug** — empty or gated too.

That is **twelve of twelve** views empty on a fresh project, eleven of them
showing a "select something first" message with **no button that would create
that something**. Only the Router empty state offers a call to action
("Create Subflow", `AS/router/RouterContentView.tsx:89-91`), and it is
unreachable until a Flow exists.

The tree's own empty state is worse: with no Flows and no filter it reads
"No flows match the current filter." (`AS/hierarchy/components/ProjectTree.tsx:261`)
— it blames a filter the person never set, and offers nothing.

### 1.5 Labels a new user would not understand from the label alone

Eight of twelve: **Nodes**, **Router**, **Subflows**, **Adaptations**,
**State View**, **Runtime Debug**, **Instructions**, **Connected Clients**.
Full replacement proposals in section 4.

### 1.6 Depth

Deepest reachable object, counted as interactions from the project catalog
landing screen:

1. click the project row → project opens (`AS/hierarchy/ProjectBrowser.tsx:153`)
2. expand the Flow row (`AS/hierarchy/components/TreeRows.tsx:63-83`)
3. click the **Subflows** folder child (`AS/hierarchy/flow-generation.ts:107`)
4. expand a subflow category (`appendSubflowCategoryNodes`, :129)
5. click the Subflow
6. click its **Nodes** child (:115)
7. click a node on the canvas
8. read/edit the parameter in the right-pane Inspector
   (`AS/inspector/InspectorView.tsx:43-57`)

So **8 interactions, and tree depth 6** (`aria-level` 1→6). Indentation is
`(level - 2) * 14px` (`AS/hierarchy/components/TreeRows.tsx:59`), i.e. 56px of a
280px sidebar (`AS/workspace/layout/defaults.ts:50`) is consumed by indent
before the disclosure arrow and the icon.

Changing one Flow setting is also 8: Flow → Settings → one of nine sections
(`AS/settings/FlowSettingsView.tsx:19-29`) → field → Save → Security PIN →
"Authorize and Save" (`AS/settings/FlowSettingsView.tsx:338`).

---

## 2. The first five minutes

### 2.1 Landing: the project catalog

`AS/live/components/AutomationStudioSession.tsx:639-651` returns the project
gate whenever no project is active. The gate renders `AutomationProjectBrowser`
(`AS/hierarchy/ProjectBrowser.tsx:46-179`). With nothing created it shows
"No projects yet / Create a project to start building Flows." with a
**Create project** button (:87-94). This screen is fine.

### 2.2 The first hard stop: a Security PIN

Clicking Create project opens `AutomationProjectModalView`. If the account has
no PIN configured, the submit button is permanently disabled and the modal says
"Configure a security PIN in Identity and Access before changing projects or
categories." (`AS/hierarchy/ProjectModal.tsx:80-81`, gated by
`pinReady` at :35 and `disabled={!contentReady || !pinReady}` at :103).

A brand-new user cannot create a project at all without leaving Automation
Studio for another program first. There is no link to it from the notice.

### 2.3 Landing inside a fresh project: a blank pane

Default workspace preferences open one pane whose only tab is `flowEditor`
(`AS/workspace/layout/defaults.ts:26-28` and `:48`). With no Flow the
connector supplies `taskGraph: null`
(`AS/live/view-host/canonical-connected-views.tsx:131-136`), and
`FlowEditorView` then returns:

```
AS/flow-editor/components/FlowEditorView.tsx:23-25
if (!props.taskGraph || props.taskGraph.metadata?.summaryOnly === true) {
  return <div aria-label="Opening node editor" aria-live="polite" aria-busy="true" className="automation-view-loading" />;
}
```

`.automation-view-loading` is `display:inline-flex` with **no content of its
own**; the spinner is a separate child element `.automation-view-loading-indicator`
which is not rendered here (`AS/styles/workspace/04-layout.css:415-432`). So the
first thing a person sees inside a new project is an **entirely empty white pane
that claims `aria-busy="true"` forever**. There is no text, no spinner, and no
call to action.

**There is no call to action on this screen at all.** The only affordance that
creates anything is an icon-only `+` on the "Flows" tree row
(`AS/hierarchy/components/ProjectTree.tsx:283-285`), labelled only by
`aria-label`/`title`.

### 2.4 Where "describe what you want automated" actually lives

The instruction box is `BlankFlowAuthoringPanel`
(`AS/authoring/BlankFlowAuthoringPanel.tsx:245`, the `Website task` textarea with
placeholder "For example: Find a product, add it to the cart, and capture the
order total."). It is rendered in exactly one place:

```
AS/runtime/FlowRunView.tsx:356
<BlankFlowAuthoringPanel commands={...} flow={...} projectId={...} readiness={...} />
```

`FlowRunView` is the **Runtime Debug** view — id `runtime-debug`, icon `Bug`,
group "Evidence" (`AS/views/canonical-view-definitions.tsx:141-147`). It is not
open by default and is not in the default tab set.

Counted from the catalog landing, the primary job costs:

1. Create project (modal: name + PIN + submit) — 3
2. `+` on the Flows tree row — 4
3. Pick the "Flow" card — 5
4. Fill name, pick one of seven "Flow preset" options, enter PIN, Create — 6
   (`AS/workspace/overlays/HierarchyCreateOverlaySurface.tsx:77-108`, live
   equivalent `AS/hierarchy/AutomationHierarchyDialog.tsx:54-70`)
5. Click the Flow in the tree — 7 (this opens **Nodes**, blank again;
   `AS/hierarchy/routing.ts:50`)
6. Click the Flow's "Runtime Debug" tree child, or `+` → Add tab →
   "Runtime Debug" — 8-9
7. Scroll past the run controls, type the task — 10
8. "Explore and create proposal" — 11
   (`AS/authoring/BlankFlowAuthoringPanel.tsx:246`)

**The product's primary job is roughly eleven interactions from landing, and the
box to type it into is on a tab called "Runtime Debug" with a bug icon, filed
under "Evidence".** From an already-open project with a Flow selected it is still
three to four.

### 2.5 The Run panel puts an expert decision first

The first control in the run panel is a six-button "Execution mode" fieldset
(`AS/runtime/FlowRunView.tsx:424-431,454-458`): *Fully adaptive, Manual approval,
No LLM intervention, LLM diagnosis, Diagnose and propose adaptation, Explore and
adapt*. Its help text names the model vendor to the user:
"Run one bounded DeepSeek diagnosis call; no patching, retry, promotion, or
external side effects." (:396). The **Run** button is disabled while any
readiness issue exists (:461), so a first-time user meets a dead primary button
with a list of prerequisites.

---

## 3. Clunk, specifically

### 3.1 Controls that are permanently dead

- **Pause.** The global toolbar renders a Pause button
  (`AS/workspace/shell/WorkspaceHeader.tsx:77`) whose enablement is
  `!actions.runtime?.canPause`. The only registrar of runtime actions sets
  `canPause: false` and `pause: () => undefined` unconditionally
  (`AS/runtime/FlowRunView.tsx:338,341`). The Pause button can never be enabled.
- **Play looks enabled when nothing can play.** `disabled={actions.runtime?.canPlay === false}`
  (`WorkspaceHeader.tsx:76`). When no Runtime Debug view is mounted,
  `actions.runtime` is `null`, so `undefined === false` is `false` and the button
  is **enabled**; clicking it silently does something else — opens the Runtime
  view (`invoke…("play")` returns false, then `props.commands.openRuntime()`).
- **Undo/Redo no-op until an unrelated view is focused.** They read
  `actions.graph` (`WorkspaceHeader.tsx:73-74`), which is populated only by the
  graph editor and only while `active()` is true
  (`AS/workspace/studio-action-registry.ts:90-92`). Switching to any other tab
  disables the global Undo.
- **Play/Stop target the wrong pane with two runtime tabs open.** Runtime actions
  resolve by `latest(runtimeActions)` — last registered, not active
  (`AS/workspace/studio-action-registry.ts:67,100`) — whereas graph actions
  correctly resolve by `active()` (:91). Two Runtime Debug tabs (one per Flow,
  which the object-scoped instance ids make routine, `AS/views/view-registry.ts:75-81`)
  means the header drives whichever mounted last.

### 3.2 State lost on view switch

Inactive tabs stay mounted only while "warm". The warm cap is 6 on desktop and
**3 on constrained widths** (`AS/workspace/commands/warm-activation.ts:6-7`),
and eviction unmounts the least-recently-used view
(`:39-51`, `AS/workspace/shell/MountedViewStack.tsx:56`). Everything a view holds
in `useState` is then gone. That is not marginal: State View keeps its mode,
source, phase, selected evidence and selected fact in local state
(`AS/state/StateExplorerView.tsx:21-25`); Problems keeps six filters and its page
cursor (`AS/problems/ProblemsView.tsx:19-29`); Router keeps ~20 pieces of draft
and paging state including an in-progress route draft
(`AS/router/RouterView.tsx:25-52`). Open four tabs on a 1000px screen and the
first one's filters are reset when you come back.

### 3.3 Tabs accumulate without limit; "preview" does not preview

`openView(viewId, mode = "preview")` routes to `activateMain`, which **appends**
the view to the pane's tabs (`AS/workspace/commands/workspace-commands.ts:96,123-124`
and `:62` `tabs: uniqueTabs([...candidate.tabs, viewId])`). There is no
replace-on-preview behaviour despite the name. Every single click in the
hierarchy tree therefore opens a permanent new tab
(`AS/hierarchy/controller.ts:66`, `AS/hierarchy/components/TreeRows.tsx:87-91`),
and because Nodes/Settings/Adaptations etc. are object-scoped
(`AS/views/view-registry.ts:75-81`) you get one tab **per flow per view**.
Browsing five Flows leaves ~15 tabs in a strip that can display three.

### 3.4 The tab strip cannot show the tabs

`.automation-tabs-shell` is `28px | 1fr | 28px | 28px`
(`AS/styles/workspace/09-tabs.css:1-14`); tabs are `min-width: 80px`, no wrap,
`overflow-x: auto` with a hidden scrollbar (`:35-63`). At a typical 1440px window
the main pane is 1440 − 280 sidebar − 320 right = 840px, so about 9 tabs fit; at
1024px the pane is 424px and about 4 fit; at 900px it is 300px and **two** fit.
There is no count of hidden tabs — only two chevrons and a search icon
(`AS/workspace/components/view-container.tsx:95,171-172`).

### 3.5 Scroll containers that reset

- The tab strip auto-scrolls to the selected tab on **every** activation change,
  including when a pane merely becomes active
  (`AS/workspace/components/view-container.tsx:42-53`, dependency
  `[props.active, props.activeViewId, tabOrderKey]`). Deliberate horizontal
  scrolling of the strip is discarded whenever focus moves between panes.
- The hierarchy tree writes `element.scrollTop` directly during keyboard focus
  moves (`AS/hierarchy/components/ProjectTree.tsx:163-182`).
- Folders re-expand themselves. `useSelectionDisclosure` runs on every change of
  the `nodes` array identity and re-expands every ancestor container of the
  current selection (`AS/hierarchy/hooks/useSelectionDisclosure.ts:15-20`). The
  `nodes` array is rebuilt on each project-data revision
  (`AS/live/components/AutomationStudioConnectedRegions.tsx:41-46`), so a folder
  the person collapsed around their selection reopens on the next refresh.

### 3.6 Modal and dialog stacks

- The authoring panel can hold **two** modals whose state is independent — the
  high-token confirmation (`AS/authoring/BlankFlowAuthoringPanel.tsx:253`) and the
  consequence-approval modal (`:259`). The code has to explicitly close the first
  to stop it hiding the second (`:175-177`: "Leaving this modal mounted hides the
  later consequence request behind it").
- The conversation dock has to special-case a modal portal so Escape does not
  collapse the chat underneath an open dialog
  (`AS/conversation/components/ConversationDock.tsx:53-56`).
- `.modal-backdrop` and the conversation dock share `z-index: var(--layer-overlay)`
  (`apps/web/src/app/styles/global-foundation/15-modals-and-drawers.css:4` and
  `AS/styles/conversation/02-dock.css:9`); ordering depends on DOM order only.
- Save is a modal on top of whatever the person was doing, every time
  (`AS/workspace/shell/WorkspaceHeader.tsx:126-132`), including on Ctrl+S (:56-64).

### 3.7 Authorization friction: twelve separate Security PIN prompts

Every mutation in the panel asks for a numeric PIN in its own modal:

| Action | File:line |
|---|---|
| Save Project (also Ctrl+S) | `AS/workspace/shell/WorkspaceHeader.tsx:129` |
| Unsaved-changes guard | `AS/workspace/DirtyViewGuard.tsx:58` |
| Create Flow/Subflow/Folder | `AS/hierarchy/AutomationHierarchyDialog.tsx:63` |
| Delete hierarchy item | `AS/hierarchy/AutomationHierarchyDialog.tsx:73` |
| Create/rename/delete/move project or category | `AS/hierarchy/ProjectModal.tsx:83` |
| Save Router change | `AS/router/RouterContentView.tsx:270` |
| Subflow rename/duplicate/delete/archive/disable/enable | `AS/subflows/SubflowsView.tsx:191` |
| Save instruction | `AS/instructions/InstructionsView.tsx:308` |
| Save Flow settings | `AS/settings/FlowSettingsView.tsx:338` |
| Save Subflow settings | `AS/settings/SubflowSettingsView.tsx:229` |
| Generate deterministic Subflow | `AS/recordings/RecordingTimelineView.tsx:264` |
| (dead duplicates) create/delete overlay | `AS/workspace/overlays/HierarchyCreateOverlaySurface.tsx:151` |

This is the single largest source of perceived clunk: renaming a subflow, saving
a draft instruction and saving the workspace each cost a password dialog.

**Two defects inside that set:**

- `AS/subflows/SubflowsView.tsx:191` — the PIN input has **no `type="password"`**
  and no `maxLength`. The PIN is typed and displayed in clear text.
- `AS/workspace/overlays/HierarchyCreateOverlaySurface.tsx:39` gates Create on
  `draft.pin.length >= 4` with **no** "PIN not configured" notice (unlike
  `ProjectModal.tsx:80`), so a user without a PIN gets a server rejection instead
  of an explanation.

### 3.8 Destructive controls next to routine ones

- The unsaved-changes dialog puts **Discard** between **Cancel** and **Save**,
  all three styled as plain `<Button>` with no danger variant
  (`AS/workspace/DirtyViewGuard.tsx:59-63`). The one button that destroys work
  looks exactly like the one that cancels.
- "Reset workspace layout" — which throws away every open tab, pane split and
  saved view state (`resetLayout` = `defaultAutomationWorkspacePrefs()`) — sits
  unconfirmed in the Preferences footer next to a status line
  (`AS/workspace/components/workspace-preferences.tsx:19,67`).
- Middle-click and the `Delete` key close a tab with no confirmation beyond the
  dirty check (`AS/workspace/components/view-container.tsx:110-115,128-132`).
- The tree row's `…` menu holds "Open settings" and "Delete" as the only two
  entries, adjacent (`AS/hierarchy/components/TreeRows.tsx:125-139`).

### 3.9 Inconsistent affordances for one concept

- **Create** exists in three shapes: an icon-only `+` on the tree root
  (`ProjectTree.tsx:283`), an icon-only `+` on each container row
  (`TreeRows.tsx:100-118`), and a labelled primary button in the project browser
  (`ProjectBrowser.tsx:80`).
- **Collapse** exists as: a chevron in the sidebar heading
  (`AS/hierarchy/AutomationProjectHierarchySidebar.tsx:46`), a chevron in the right
  pane header (`AS/workspace/shell/RightPaneArea.tsx:74-82`), a chevron in the
  timeline dock (`AS/workspace/shell/TimelineDock.tsx:70-78`), and a chevron in
  the chat dock (`AS/conversation/components/ConversationDock.tsx:87-95`) — four
  different icons/directions for the same verb.
- **Two live implementations of the same create/delete dialog.**
  `AS/hierarchy/AutomationHierarchyDialog.tsx` is the one actually mounted
  (`AS/live/components/AutomationStudioConnectedRegions.tsx:56-60`), while
  `AS/workspace/overlays/HierarchyCreateOverlaySurface.tsx`,
  `HierarchyDeleteOverlaySurface.tsx` and `ProjectOverlaySubscriber.tsx` are
  **dead**: `useAutomationStudioLiveOverlays` never supplies a `hierarchy` or
  `project` dispatcher (`AS/live/hooks/useAutomationStudioLiveOverlays.ts:44-57`),
  and `AutomationStudioOverlays` renders those subscribers only when the
  dispatcher exists (`AS/workspace/overlays/AutomationStudioOverlays.tsx:58-59`).
  **Fix workers must not edit the overlay copies — nothing renders them.**

### 3.10 Layout at common widths

The shell is `${sidebarWidth}px minmax(0,1fr)` with `sidebarWidth = 280`
(`AS/workspace/shell/WorkspaceShell.tsx:103`, `AS/workspace/layout/defaults.ts:50`),
and inside it `minmax(0,1fr) ${inspectorWidth}px` with `inspectorWidth = 320`
(`WorkspaceShell.tsx:170`, `defaults.ts:52`). Narrow mode only engages below
820px (`AS/live/hooks/useAutomationExternalLifecycle.ts:17`).

That leaves a **broken band from 821px to roughly 1100px**: chrome consumes
600px, so the main editor pane is 221–500px while it must hold a tab strip, a
pane header, a canvas toolbar and the view body. Several in-view layouts do not
reflow in that band because their responsive rules key off the **viewport**, not
the pane: `.automation-two-pane` stays `minmax(280px, 0.42fr) minmax(0, 1fr)`
(`AS/styles/workspace/01-shell.css:268-272`) and the escape hatch is a
`@media (max-width: 820px)` rule (`AS/styles/workspace/10-responsive-certification.css:176-188`)
that never fires at 900px. The Router is the exception and the model to copy —
it uses `container-type: inline-size` and `@container` queries
(`AS/styles/router-subflows/03-router-subflow-details.css:27-45`).

At ≤820px the route list keeps `min-width: 620px` inside a horizontal scroller
(`AS/styles/router-subflows/02-workbench.css:595-599`), so on a 390px phone the
route table is a 620px sideways scroll.

### 3.11 Actions with no feedback

- `requestProjectSave` calls `props.commands.requestWorkspaceSave()` and then, if
  nothing is dirty, **returns silently** — Ctrl+S with a clean workspace produces
  no confirmation of any kind (`AS/workspace/shell/WorkspaceHeader.tsx:34-40`).
- The preferences save status is an `<output>` with no timestamp or success
  affordance (`AS/workspace/components/workspace-preferences.tsx:66`).
- `AutomationViewEmptyState` says "No data yet" plus
  "<Label> has no data for the current scope."
  (`AS/views/AutomationViewBoundary.tsx:61-67`) — the same text for a view that
  is genuinely empty and a view whose scope is wrong, with no recovery action.

### 3.12 Internal identifiers shown to the user

`closePaneTab` builds the guard prompt as `` `closing ${viewId}` ``
(`AS/workspace/commands/workspace-commands.ts:134`), and `DirtyViewGuard` prints
it verbatim: "Choose what to do before closing …"
(`AS/workspace/DirtyViewGuard.tsx:54`). For an object-scoped view that reads
`closing flow-nodes::object::flow.checkout.subflow.primary.graph`.

Every tree row prints the raw internal kind as its subtitle —
`<small>{node.kind}</small>` (`AS/hierarchy/components/TreeRows.tsx:98`) — so the
sidebar is a column of the words `flow`, `subflow`, `folder`, `flow-object`,
`instruction`, `adaptation`, `proposal`, `run`, `client`, `task`, `routine`.

---

## 4. Naming

Every user-visible string below uses vocabulary a first-time user does not have.

### 4.1 Tabs and views (`AS/views/canonical-view-definitions.tsx`)

| Current | Line | Proposed | Why |
|---|---|---|---|
| Nodes | :93 | **Steps** | "Node" is graph jargon; the user thinks in steps. |
| Router | :100 | **Choose a path** (or **Branching**) | "Router" is networking vocabulary. |
| Subflows | :107 | **Parts** (or **Reusable steps**) | "Subflow" is internal. |
| Instructions | :114 | **Guidance for the assistant** | Ambiguous with "the thing I typed to build this". |
| Adaptations | :121 | **Suggested changes** | "Adaptation" is a Core term, not a user word. |
| State View | :135 | **What the page looked like** | "State" means nothing here. |
| Runtime Debug | :142 | **Run & test** | "Debug" reads as developer-only; this is the main job's home. |
| Connected Clients | :79 | **Connected browsers** | "Client" is protocol vocabulary. |
| Timeline | :86 | **Recording steps** | Collides with the "Action Preview" dock and the tree's "Recordings". |
| Problems | :149 | **Issues** | Acceptable; "Problems" is IDE vocabulary but readable. |
| Inspector | :156 | **Details** | "Inspector" is IDE vocabulary. |
| Settings | :128 | Settings (keep) | — |

Renames must also change `AS/hierarchy/flow-generation.ts:106-115` and
`AS/workspace/components/view-metadata.ts:4-48`, which repeat the same names.

### 4.2 Groups, regions and docks

| Current | Where | Proposed |
|---|---|---|
| "Flow" / "Evidence" / "Workspace" groups | `canonical-view-definitions.tsx:80,87,94,…`; `AS/workspace/components/window-adder.tsx:20` | "This automation" / "What happened" / "This project" |
| "Action Preview" / "Selected recording or run action" | `AS/workspace/shell/TimelineDock.tsx:68` | "Step preview" / "The step you selected" |
| "Preview" (narrow-mode button) | `AS/workspace/shell/WorkspaceHeader.tsx:103` | "Step preview" |
| "Right utilities" | `AS/workspace/shell/RightPaneArea.tsx:36` | "Details panel" |
| "Hierarchy" / "Project hierarchy" | `WorkspaceHeader.tsx:89`; `AS/hierarchy/AutomationProjectHierarchySidebar.tsx:41` | "Your automations" |
| "Search objects" / "All objects" / "Flow objects" | `AutomationProjectHierarchySidebar.tsx:55,62,66` | "Search" / "Everything" / "Parts of a Flow" |
| "Flows / Product automations" | `AS/hierarchy/components/ProjectTree.tsx:281` | "Automations / Things FluxIQ does for you" |
| "Add tab" / "Find a view" | `AS/workspace/components/window-adder.tsx:52,57` | "Open a panel" / "Find a panel" |
| "Main editor tab" / "Inspector tab" | `AS/workspace/view-adder.ts:46` | "Main area" / "Details panel" |

### 4.3 Dialogs and controls

| Current | Where | Proposed |
|---|---|---|
| "Security PIN" (×12) | see 3.7 | Remove the prompt for routine saves; for genuinely destructive acts, "Confirm with your PIN". |
| "Authorize and Save" / "Authorize and save" / "Authorize Router Change" | `InstructionsView.tsx:308`; `RouterContentView.tsx:270-271`; `FlowSettingsView.tsx:338` | "Save" |
| "Flow preset" + 7 options ("Blank visual Flow", "Deterministic workflow", "Recorded automation", "Integration Flow", "Scheduled Flow", "API endpoint", "Reusable component") | `AS/hierarchy/AutomationHierarchyDialog.tsx:61`; `AS/workspace/overlays/HierarchyCreateOverlaySurface.tsx:132-141` | Drop the field for a first Flow; default to blank and offer the rest later. |
| "Build Flow from instructions" | `AS/authoring/BlankFlowAuthoringPanel.tsx:242` | "Tell FluxIQ what to automate" |
| "Website task" | `BlankFlowAuthoringPanel.tsx:245` | "What should this do?" |
| "Explore and create proposal" | `:246` | "Try it and show me a draft" |
| "Build proposal from active instructions" | `:251` | "Build it from the notes I already wrote" |
| "Confirm high-token Flow Build" / "Continue high-token build" | `:253,257` | "This may be expensive" / "Go ahead" |
| "Input tokens per call", "Total tokens for the run", "Provider retries" | `:51-73` | Collapse to one line: "Up to $X and about N minutes." |
| "Confirm Flow action consequences" / "Consequences requiring approval" | `:259,261` | "FluxIQ needs your permission" / "It wants to:" |
| "Flow authoring preflight was rejected…" | `:185` | "FluxIQ can't build this yet — no model key is set up." |
| "Execution mode" + "No LLM intervention" / "Diagnose and propose adaptation" / "Explore and adapt" / "Fully adaptive" / "Manual approval" / "LLM diagnosis" | `AS/runtime/FlowRunView.tsx:424-431,455` | Default to one mode; move the rest behind "Advanced". Plain names: "Let it fix itself", "Ask me before changing anything", "Don't use AI". |
| "…one bounded DeepSeek diagnosis call…" | `FlowRunView.tsx:396` | Never name the provider in user copy. |
| "Readiness check failed" / "Complete setup before running" | `FlowRunView.tsx:466` | "Not ready yet" + the one thing to fix. |
| "Run Inputs" / "No run inputs declared" / "Advanced JSON" | `FlowRunView.tsx:468,478,483` | "Values to use" / "Nothing to fill in" / "Raw values" |
| "Adaptation Change", "Flow Graph" | `AS/inspector/tests/product-vocabulary.test.ts:28,54` (asserted product strings) | "Suggested change", "Steps" |
| "State and Effects", "Evidence Inspector", "Source Evidence" | `AS/state/StateEvidencePanel.tsx`, `AS/runtime/*` | "What happened", "Where this came from" |
| "Effective Values / Resolved configuration" | `AS/settings/FlowSettingsView.tsx:28` | "What's actually in use" |
| "Input Mapping" / "Output Mapping" | `AS/settings/SubflowSettingsView.tsx:26-27` | "Values coming in" / "Values going out" |
| raw `node.kind` subtitle | `AS/hierarchy/components/TreeRows.tsx:98` | a mapped plain-English noun, or nothing |
| `closing flow-nodes::object::<id>` | `AS/workspace/commands/workspace-commands.ts:134` | "closing <tab label>" |
| "Legacy Routine (read-only)" | `AS/workspace/components/view-metadata.ts:23` | Should not be user-visible at all. |

---

## 5. The chat window

**Placement is correct and deliberate.** `ConversationDock` is a fixed overlay,
not a thirteenth view: `position: fixed; right/bottom: var(--space-lg);
z-index: var(--layer-overlay)` (`AS/styles/conversation/02-dock.css:5-18`), with a
pill launcher always on screen (`AS/conversation/components/ConversationDock.tsx:105-119`),
a "Needs you" badge when a thread is waiting (:117-118), Escape-to-collapse with
focus return (:42-60), and collapse-not-unmount so the badge can still light
(:65-74, `hidden` rather than conditional render). It is mounted over the whole
workspace, outside every region
(`AS/live/components/AutomationStudioSession.tsx:664-670`). The file's own header
comment records that it used to be a right-region tab "found only after manually
digging around for it" and was deliberately moved. **No navigation is required to
reach it.** That part of the brief is already satisfied.

Three real defects remain:

1. **It does not exist on the landing screen.**
   `AS/live/components/AutomationStudioSession.tsx:639-651` returns the project
   gate *before* the fragment that renders the dock (:653-671). With no project
   open — which is the first screen every user sees — there is no chat at all.

2. **The user cannot start a conversation.** The composer is
   `disabled={!thread.selectedConversationId}`
   (`AS/conversation/components/ConversationViewContent.tsx:103`), and when no
   thread exists it says "FluxIQ opens a thread as soon as a run, a build or a
   Flow has something to say." (:105). The command surface confirms this is not a
   UI oversight: `ConversationCommands` exposes `listConversations`,
   `loadConversation`, `appendTurn` (to an existing `conversationId`) and
   `answerAsk` — **there is no create-conversation command**
   (`AS/conversation/conversation-host.ts:37-44`,
   `AS/conversation/turn-commands.ts:20-43`). The chat is a reply-and-approve
   channel only. Given that the product's primary job is "describe what you want
   automated", the one surface a person would naturally type that into cannot
   accept it.

3. **It overlaps the bottom-right chrome.** The launcher sits at the bottom-right
   of the viewport, which is exactly where the timeline dock's collapse control
   and the right pane's lower edge are (`TimelineDock.tsx:70-78`,
   `RightPaneArea.tsx:36`). At ≤768px the dock stretches to `left: var(--space-sm)`
   (`AS/styles/conversation/02-dock.css:217-230`) and the open panel covers the
   full width over the narrow-mode "Action Preview" sheet, which is itself
   `bottom: 0; width: 100vw`
   (`AS/styles/workspace/10-responsive-certification.css:216-223`).

---

## 6. Priority

Ranked by how much each hurts someone opening the panel for the first time.

### Blocking — a new user cannot get started

| # | Finding | Evidence |
|---|---|---|
| P1 | Landing inside a fresh project is a **completely blank pane** with `aria-busy` forever: default tab is `flowEditor`, which renders an empty `<div>` when `taskGraph` is null. | `AS/workspace/layout/defaults.ts:27,48`; `AS/flow-editor/components/FlowEditorView.tsx:23-25`; `AS/styles/workspace/04-layout.css:415-422`; `AS/live/view-host/canonical-connected-views.tsx:131-136` |
| P2 | **No call to action anywhere** on that screen. The only create affordance is an icon-only `+` on a tree row; the tree's empty state blames a filter that was never set. | `AS/hierarchy/components/ProjectTree.tsx:261,283-285` |
| P3 | The **primary job is ~11 interactions away** and lives on a tab named "Runtime Debug" with a bug icon under "Evidence". | `AS/runtime/FlowRunView.tsx:356`; `AS/views/canonical-view-definitions.tsx:141-147` |
| P4 | **A Security PIN is required before anything can be created**, and if none is configured the user must leave the program entirely. | `AS/hierarchy/ProjectModal.tsx:35,80-81,103` |
| P5 | The **chat cannot be started by the user** and is absent on the landing screen. | `AS/conversation/components/ConversationViewContent.tsx:103-108`; `AS/conversation/conversation-host.ts:37-44`; `AS/live/components/AutomationStudioSession.tsx:639-651` |

### Severe — the panel is usable but exhausting

| # | Finding | Evidence |
|---|---|---|
| P6 | **Twelve PIN dialogs** for routine saves and renames. | see 3.7 |
| P7 | **Eight of twelve tab names** are internal vocabulary; each name exists in three files. | §4.1 |
| P8 | **Twelve empty states, eleven with no way out** — "Select a Flow" with no create button. | §1.4 |
| P9 | **Tabs accumulate on every tree click** ("preview" appends), in a strip that shows 2–4. | `AS/workspace/commands/workspace-commands.ts:62,96,123`; `AS/styles/workspace/09-tabs.css:50-63` |
| P10 | **Three parallel views over one Flow** (Nodes/Router/Subflows), all with the same icon; the tree duplicates all twelve destinations. | `canonical-view-definitions.tsx:93,100,107`; `AS/hierarchy/flow-generation.ts:106-115` |
| P11 | **Layout breaks between 821px and ~1100px**: narrow mode does not engage, viewport-keyed media queries do not fire, the editor pane is 221–500px. | `AS/live/hooks/useAutomationExternalLifecycle.ts:17`; `AS/styles/workspace/01-shell.css:268-272`; `AS/styles/workspace/10-responsive-certification.css:176-188` |
| P12 | **Dead controls**: Pause can never enable; Play is enabled when nothing can play; Undo/Redo die on tab switch; Play/Stop target the wrong pane. | `AS/workspace/shell/WorkspaceHeader.tsx:73-78`; `AS/runtime/FlowRunView.tsx:338,341`; `AS/workspace/studio-action-registry.ts:67,90-92,100` |
| P13 | **Discard sits between Cancel and Save with identical styling**; "Reset workspace layout" is unconfirmed. | `AS/workspace/DirtyViewGuard.tsx:59-63`; `AS/workspace/components/workspace-preferences.tsx:19,67` |
| P14 | The run panel opens with a **six-way expert mode choice** naming the model vendor, above a disabled Run button. | `AS/runtime/FlowRunView.tsx:396,424-431,455-461` |

### Notable

| # | Finding | Evidence |
|---|---|---|
| P15 | **State lost on tab switch** past a warm cap of 6 (3 when narrow). | `AS/workspace/commands/warm-activation.ts:6-7,39-51` |
| P16 | **Collapsed folders reopen** on every data refresh. | `AS/hierarchy/hooks/useSelectionDisclosure.ts:15-20` |
| P17 | **Internal ids in user copy** — `closing flow-nodes::object::…`; raw `node.kind` under every tree row. | `AS/workspace/commands/workspace-commands.ts:134`; `AS/hierarchy/components/TreeRows.tsx:98` |
| P18 | **PIN shown in clear text** in the Subflow action dialog. | `AS/subflows/SubflowsView.tsx:191` |
| P19 | **Tab strip scroll resets** on every pane activation. | `AS/workspace/components/view-container.tsx:42-53` |
| P20 | **Two stackable modals** in the authoring flow, worked around in code rather than fixed. | `AS/authoring/BlankFlowAuthoringPanel.tsx:175-177,253,259` |
| P21 | **Four different collapse chevrons** for one verb; three different create affordances. | §3.9 |
| P22 | **Dead duplicate dialogs** that fix workers will mistake for live code. | `AS/live/hooks/useAutomationStudioLiveOverlays.ts:44-57` |
| P23 | Ctrl+S with a clean workspace gives **no feedback at all**. | `AS/workspace/shell/WorkspaceHeader.tsx:34-40` |
| P24 | **Chat launcher overlaps** the timeline dock control and the narrow-mode preview sheet. | `AS/styles/conversation/02-dock.css:5-18,217-230` |

---

## 7. Workstream partition

Four workstreams, one worker each, **disjoint file sets**. All paths are under
`F:\!FluxIQ\apps\web\src\features\automation-studio\` unless prefixed.

### Rules that apply to every workstream

- Do **not** edit `workspace/overlays/HierarchyCreateOverlaySurface.tsx`,
  `workspace/overlays/HierarchyDeleteOverlaySurface.tsx` or
  `workspace/overlays/ProjectOverlaySubscriber.tsx` — nothing renders them
  (`live/hooks/useAutomationStudioLiveOverlays.ts:44-57`). Retiring them is a
  separate cleanup, assigned to WS-C below.
- New CSS must go in an existing domain directory under `styles/` and be added to
  the manifest; a test enforces both
  (`styles/tests/styles-architecture.test.ts:16-50`).
- Any view rename must change **all three** naming sites
  (`views/canonical-view-definitions.tsx`, `hierarchy/flow-generation.ts`,
  `workspace/components/view-metadata.ts`). All three are owned by WS-B, so only
  WS-B renames views. WS-A/C/D must use whatever labels exist at the time.
- `live/components/AutomationStudioSession.tsx` is owned only by WS-D.

---

### WS-A — First run: kill the blank pane, put the ask up front

Covers **P1, P3, P8 (view-side), P14**, and the Run-panel half of P12.

Owns:

```
workspace/layout/defaults.ts
flow-editor/components/FlowEditorView.tsx
live/view-host/canonical-connected-views.tsx
runtime/FlowRunView.tsx
authoring/BlankFlowAuthoringPanel.tsx
authoring/blank-flow-authoring-model.ts
router/RouterContentView.tsx
router/RouterView.tsx
subflows/SubflowsView.tsx
instructions/InstructionWorkbenchPanels.tsx
adaptations/AdaptationsView.tsx
clients/ClientGatewayView.tsx
inspector/InspectorPanel.tsx
styles/runtime/*.css
```

Scope: give the default landing pane real content with one call to action; give
every "Select a Flow" empty state a create button; lift the instruction textarea
out of Runtime Debug so it is reachable in one step from a selected Flow; collapse
the six-way Execution mode behind an "Advanced" disclosure with one sensible
default; remove the DeepSeek mention. Keep `canPause: false` in
`FlowRunView.tsx:338` — WS-C removes the header button.

Must stay green: `flow-editor/tests/`, `authoring/tests/`, `router/tests/`,
`subflows/tests/`, `instructions/tests/`, `adaptations/tests/`, `clients/tests/`,
`inspector/tests/`, `workspace/tests/layout.test.ts`,
`testing/tests/empty-project-fixture.test.ts`.

---

### WS-B — Names, icons and the view registry

Covers **P7, P10, P17 (tree-kind half)**, and §4.1/§4.2.

Owns:

```
views/canonical-view-definitions.tsx
views/view-types.ts
views/view-registry.ts
views/view-migrations.ts
views/ViewHost.tsx
views/AutomationViewBoundary.tsx
views/RetiredViewRecovery.tsx
workspace/components/view-metadata.ts
workspace/components/window-adder.tsx
workspace/view-adder.ts
hierarchy/flow-generation.ts
hierarchy/components/TreeRows.tsx
hierarchy/tree-icons.ts
```

Scope: rename the twelve view labels and the three group names per §4.1/§4.2,
keeping the `id`s unchanged so deep links and saved layouts survive
(`view-registry.ts:83-99` handles aliasing); give each view a distinct icon (seven
icons currently cover twelve views); map `node.kind` to plain English in the tree
row subtitle instead of printing the raw kind; replace "No data yet" with
per-view copy.

Must stay green: `views/tests/`, `workspace/tests/view-adder.test.ts`,
`hierarchy/components/tests/ProjectTree.test.tsx` (asserts label strings — expect
to update fixtures), `hierarchy/tests/`, `inspector/tests/product-vocabulary.test.ts`,
`tests/navigation.test.ts`.

---

### WS-C — Authorization friction and destructive-control safety

Covers **P4, P6, P12 (header half), P13, P18, P22, P23**.

Owns:

```
workspace/shell/WorkspaceHeader.tsx
workspace/studio-action-registry.ts
workspace/DirtyViewGuard.tsx
workspace/dirty-view-registry.ts
workspace/components/workspace-preferences.tsx
workspace/components/primitives.tsx
hierarchy/AutomationHierarchyDialog.tsx
hierarchy/dialog-transaction.ts
hierarchy/ProjectModal.tsx
settings/FlowSettingsView.tsx
settings/SubflowSettingsView.tsx
instructions/InstructionsView.tsx
recordings/RecordingTimelineView.tsx
workspace/overlays/HierarchyCreateOverlaySurface.tsx   (delete only)
workspace/overlays/HierarchyDeleteOverlaySurface.tsx   (delete only)
workspace/overlays/ProjectOverlaySubscriber.tsx        (delete only)
workspace/overlays/HierarchyActionOverlaySubscriber.tsx (delete only)
workspace/overlays/AutomationStudioOverlays.tsx
workspace/overlays/contracts.ts
workspace/overlays/hierarchy-overlay-model.ts
```

Note: `subflows/SubflowsView.tsx:191` (the clear-text PIN, P18) sits in a file
owned by WS-A. **Assign P18 to WS-A** with the one-line instruction
"add `type=\"password\"` and `maxLength={12}` to the PIN input at line 191" so the
file has a single owner.

Scope: reduce the twelve PIN prompts to the genuinely destructive set — this is
the pinned FluxIQ rule that grants gate only high-risk actions (delete, checkout,
payment), never the product doing its job, so saving a draft, renaming a subflow
and saving the workspace must not ask; surface "PIN not configured" wherever a PIN
is still required, with a link; give **Discard** a danger variant and separate it
from Cancel/Save; confirm "Reset workspace layout"; remove the permanently dead
Pause button and make Play's disabled state honest; resolve runtime actions by
`active()` like graph actions do; give a clean Ctrl+S a confirmation; delete the
four dead overlay files and their now-unused contract types.

Must stay green: `workspace/tests/`, `workspace/overlays/tests/`,
`hierarchy/tests/command-executor.test.ts`, `hierarchy/tests/ProjectModal.test.ts`,
`settings/tests/`, `instructions/tests/`, `recordings/tests/`.

---

### WS-D — Shell, tabs, responsive band, and the chat's reach

Covers **P5, P9, P11, P15, P16, P19, P21, P24**, and P17's `closing <viewId>` half.

Owns:

```
workspace/commands/workspace-commands.ts
workspace/commands/warm-activation.ts
workspace/components/view-container.tsx
workspace/shell/WorkspaceShell.tsx
workspace/shell/PaneArea.tsx
workspace/shell/RightPaneArea.tsx
workspace/shell/TimelineDock.tsx
workspace/shell/ResponsiveDrawers.tsx
workspace/shell/MountedViewStack.tsx
hierarchy/AutomationProjectHierarchySidebar.tsx
hierarchy/components/ProjectTree.tsx
hierarchy/hooks/useSelectionDisclosure.ts
conversation/components/ConversationDock.tsx
conversation/components/ConversationViewContent.tsx
conversation/components/ConversationComposer.tsx
conversation/conversation-host.ts
conversation/turn-commands.ts
conversation/useConversationThread.ts
live/components/AutomationStudioSession.tsx
live/hooks/useAutomationExternalLifecycle.ts
styles/workspace/*.css
styles/conversation/*.css
```

Scope: make "preview" actually preview (replace an unpinned tab rather than
append) and show a hidden-tab count; raise or remove the warm cap so filters and
drafts survive a tab switch, or persist the affected view state; stop
`useSelectionDisclosure` re-expanding folders the user collapsed; stop the tab
strip auto-scrolling on mere pane activation; convert the viewport-keyed
`@media (max-width: 820px)` in-view rules to `@container` queries on the pane
(follow `styles/router-subflows/03-router-subflow-details.css:27-45`) so the
821–1100px band reflows; unify the four collapse chevrons; mount `ConversationDock`
on the project gate as well as inside a project; give the composer a way to start
a thread (this needs a Core `start-conversation` command — if Core has none,
**stop and report it rather than faking it**, since Core changes belong in Core);
keep the launcher clear of the timeline dock and the narrow preview sheet.

Must stay green: `workspace/tests/`, `workspace/shell/tests/shell.test.tsx`,
`conversation/tests/`, `hierarchy/components/tests/ProjectTree.test.tsx`
(shared fixture file with WS-B — **WS-D must not edit it**; if a WS-D change
breaks it, report the break to the supervisor rather than editing),
`live/components/tests/`, `styles/tests/`,
`workspace/tests/strict-runtime-contract.test.ts` (asserts the literal string
`window.matchMedia("(max-width: 820px)")` at line 35 — changing the breakpoint
requires updating that assertion, which lives in WS-D's own directory).

### Cross-workstream contracts

1. WS-A keeps `canPause: false` in `runtime/FlowRunView.tsx:338`; WS-C removes the
   header Pause button. Neither touches the other's file.
2. WS-B owns every view label. WS-A, WS-C and WS-D reference labels, never
   redefine them.
3. `hierarchy/components/tests/ProjectTree.test.tsx` is the one test file both
   WS-B and WS-D can break. WS-B owns edits to it.
4. WS-C deletes the dead overlay files; WS-D must not import them.
5. The Core-side `start-conversation` gap (P5) is a **repository-boundary
   question**, not a panel fix. WS-D reports it; the supervisor decides whether to
   open a Core task.

---

## Not verified

- Nothing was run in a browser. No build, type check, test run or live panel
  session was performed — this brief was read-only and forbade product changes.
- Pixel measurements in §3.4 and §3.10 are computed from the CSS grid
  declarations and the default preference values, not measured in a rendered
  page.
- "Twelve of twelve views empty on a fresh project" (§1.4) is derived from each
  view's `requires` field and its component's early-return branches, not from an
  observed fresh project.
- The `AutomationHierarchyDialog` vs. overlay-surface liveness conclusion (§3.9,
  P22) is read from the dispatcher wiring in
  `live/hooks/useAutomationStudioLiveOverlays.ts:44-57`; I did not run the app to
  confirm the overlay subscribers never mount.
- Click counts in §1.6 and §2.4 assume the default layout and the shortest path a
  first-time user would plausibly find; a user who already knows the "Add tab"
  palette can shave one or two.
- I did not read FluxIQ Core, so whether a `start-conversation` command exists
  server-side is unknown — only that the panel exposes none.
