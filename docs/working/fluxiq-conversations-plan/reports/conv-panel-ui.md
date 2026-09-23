# conv-panel-ui — what the FluxIQ Core web panel already is

Read-only investigation of `F:\!FluxIQ\apps\web`. Nothing was changed, no server was
started, no git command other than reads. Every claim below carries `file:line`;
paths are relative to `F:\!FluxIQ\` unless stated.

**One note on the brief's exclusion.** The brief said to stay out of
`packages/fluxiq/src/programs/automation-studio/runtime/**`. Question (3) is about
task t060, whose panel code turned out to live at
`apps/web/src/features/automation-studio/runtime/**` — a different tree, inside the
repository I was given, so it was read normally. The Core contract that UI depends
on (`action-permissions`) *is* inside the excluded path, so I read it through
`git show HEAD:<path>` from the object store rather than touching the working tree.

---

## 1. The application shell and navigation

There are **two** levels of "top-level view", and a conversation has to pick one.

### Level one: programs

The panel is a Next.js App Router application. `app/layout.tsx:12-24` is the root
layout: it renders `{children}`, then two always-mounted global surfaces —
`GlobalAlertViewport` and, for an operator with `runtime.control`,
`GlobalClientGatewayPairing` (`app/layout.tsx:19-20`).

`app/page.tsx:7-24` is the launcher. It reads the program catalog from Core
(`defaultGlobalProgramCatalog()`, `app/page.tsx:10`) and renders `ProgramLauncher`.
The catalog is Core's, not the panel's:
`packages/fluxiq/src/programs/_shared/catalog.ts:13-24` lists ten global programs —
Automation Studio, Identity & Access, Secret Keys, Database Manager, Background
Tasks, Compute Control, Deployment Sync, Runtime Control, Docs, Production Runner.
Each gets a route `/programs/<id>` (`catalog.ts:27,34`).

Nine of those ten render through a generic program workspace
(`app/programs/[programId]/page.tsx`, `ProgramWorkspace.tsx`, `ProgramLiveViews.tsx`)
with a per-program live view module registered in
`features/programs/live-views.tsx:1-8`. Automation Studio has its own route,
`app/programs/automation-studio/page.tsx` + `layout.tsx`, because it owns its own
stylesheet manifest and its own workspace shell.

**Adding a program is a Core change**, not a panel change: the catalog entry lives in
Core's `_shared/catalog.ts`. This is the wrong seam for a conversation.

### Level two: Automation Studio views

Inside Automation Studio, a "view" is a tab that a person can add to a pane. This is
the seam a conversation surface would actually use.

A view is **declared once**, as a data record, in
`features/automation-studio/views/canonical-view-definitions.tsx:77-162`, through
`defineAutomationStudioViews` (`views/view-definition-types.ts:92-96`). The record's
shape is `AutomationStudioViewDefinitionInput`
(`views/view-definition-types.ts:65-90`): `id`, `aliases`, `kind`, `label`, `icon`
(a lucide icon), `group` (`"Flow" | "Evidence" | "Workspace"`), `region`
(`"main" | "right" | "bottom"`), `allowedRegions`, `scope` (a human sentence),
`requires` (one of `hasProject | hasFlow | hasTopLevelFlow | hasSubflowGraph |
hasRecording | hasSelection`, `view-definition-types.ts:7`), `isAvailable`,
`addable`, `lifecycle` (`sleepUntilActivated`, `keepMounted: "warm"`), `cache`
(`schemaVersion` + optional `migrateSavedState`), `functionality` (a contract
object), and `host` (the render adapter).

**The twelve current views**, with id, label, group and region
(`canonical-view-definitions.tsx:78-161`):

| key | id | label | group | region | requires |
|---|---|---|---|---|---|
| clients | `client-gateway` | Connected Clients | Workspace | main | hasProject |
| recordingTimeline | `timeline-recording` | Timeline | Evidence | main | hasRecording |
| flowEditor | `flow-nodes` | Nodes | Flow | main | hasSubflowGraph |
| router | `flow-router` | Router | Flow | main | hasTopLevelFlow |
| subflows | `flow-subflows` | Subflows | Flow | main | hasFlow |
| instructions | `flow-instructions` | Instructions | Flow | main | hasFlow |
| adaptations | `adaptations` | Adaptations | Flow | main | hasFlow |
| settings | `flow-settings` | Settings | Flow | main | hasFlow |
| state | `state-explorer` | State View | Evidence | main | hasSelection |
| runtime | `runtime-debug` | Runtime Debug | Evidence | main | hasFlow |
| problems | `problems-view` | Problems | Evidence | **right** | hasProject |
| inspector | `global-inspector` | Inspector | Workspace | **right** | hasProject |

Five ids are retired and migrate forward rather than 404:
`views/retired-view-migrations.ts:1-17` maps `config`/`config-default` →
`flow-settings` and `proposal-generator`/`proposal-workbench`/`pipeline-workbench` →
`adaptations`, and `views/view-registry.ts:83-99` resolves them.

**The full wiring an added view needs** (this is the cost estimate for any new
surface):

1. `views/canonical-view-definitions.tsx` — the definition record, plus a host
   adapter built with `defineAutomationViewHost` or
   `defineComponentAutomationViewHost` (`view-definition-types.ts:45-63`).
2. `views/view-types.ts:15` — add the `kind` to `AutomationViewType`.
3. `<feature>/<Name>View.tsx` — the component, and `<feature>/<name>-host.ts`
   exporting `…ViewHostModel`, `…ViewHostCommands` and the `use…Commands()` hook
   (pattern: `runtime/runtime-host.ts:9-60`).
4. `<feature>/functionality-contract.ts` — a declarative contract with
   `canonicalViewId`, `productPurpose`, `owningScope`, `data`, `states` and `scale`
   (`runtime/functionality-contract.ts:1-50`).
5. `live/view-host/canonical-connected-views.tsx` — a connector via
   `createAutomationDirectViewConnector` (example:
   `canonical-connected-views.tsx:124-129`).
6. `live/view-host/connected-view-entries.tsx:163-170` — register it in
   `connectorByViewId`.
7. `live/view-host/useAutomationConnectorCommands.ts:65-106` — register its commands.
8. A stylesheet under `features/automation-studio/styles/<domain>/NN-*.css` plus an
   `@import` in `app/programs/automation-studio/automation-studio.css:1-38`.
9. Two gate tests must be updated or they fail:
   `features/automation-studio/tests/architecture-contract.test.ts:34-51`
   (`canonicalEntryViews`), `:58-71` (`productDomains`), `:73-79`
   (`approvedTopLevelDirectories`); and
   `features/automation-studio/styles/tests/styles-architecture.test.ts:15-24`
   (`expectedDomains`).

Once declared, the rest is automatic: the registry indexes it
(`views/view-registry.ts:51-56`), the host registry renders it
(`views/view-host-registry.tsx:33-45,51-56`), the view adder offers it in the right
group with a disabled-reason when its `requires` is unmet
(`workspace/view-adder.ts:32-51`), and the region router places it
(`workspace/layout/regions.ts:6-9`).

---

## 2. How the panel learns about a running Flow — and how live it is

**There is no push channel to the browser at all.** A grep of `apps/web/src` for
`EventSource`, `new WebSocket` and `text/event-stream` returns only a type named
`AutomationStudioContextEventSource` (`features/automation-studio/live/gateway-context-publication.ts:36`),
which is a DOM-event abstraction, not SSE. The WebSocket server in
`src/server/client-gateway-websocket.ts:26-34` binds `ws://127.0.0.1:4777/client`
and serves the **extension**, not the panel.

Everything the panel knows, it asked for over HTTP POST.

### The transport

All Studio data goes through `ProgramCommandTransport`
(`features/automation-studio/data/program-transport.ts:3-6`), which posts to
`/api/programs/<programId>/<endpoint>` (`app/api/programs/[programId]/[endpoint]/route.ts:29-40`).
Timeouts and retries are set per endpoint shape in
`features/programs/program-request-coordinator.ts:19-28`:

- a **read** (`GET`, or an endpoint starting `get-`/`list-`): 15 s, 2 retries,
  deduplicated, 150 ms retry delay;
- a **mutation**: **30 s, no retries, no deduplication**;
- four long-running mutations (`rebuild`, `sync`, `rollback`, `run-migration`):
  120 s.

A timeout aborts and returns `{ ok: false, status: 408, code: "request_timeout" }`
(`program-request-coordinator.ts:95,104`).

### The run endpoints

`features/automation-studio/runtime/run-queries.ts:15-51`:
`list-flow-runs`, `get-flow-run-detail` (compact), `list-flow-run-actions`
(page size 50, `run-queries.ts:4`), `list-flow-run-events` (cursor, page size 100,
`run-queries.ts:5`), `get-flow-run-action-detail`, `get-flow-run-event-detail`.
Mutations in `run-commands.ts:5-30`: `start-runtime-session`,
`run-runtime-session`, `preflight-llm-execution`, `issue-llm-execution-grant`,
`cancel-runtime-session`, `export-flow-run-audit`.

### The three refresh mechanisms, and their real latency

**(a) The in-page mutation bus.** `stores/mutation-transaction-store.ts:1-29` defines
five mutation kinds — `subflow.changed`, `flow-settings.changed`,
`instruction.changed`, `router.changed`, `runtime-run.changed` — committed by the
code that caused them (`runtime/run-commands.ts:24-26`) and delivered synchronously
to filtered subscribers (`mutation-transaction-store.ts:73-79`). Latency: zero, but
it only fires for things **this tab did**.

**(b) The project change feed.** `sync/project-sync.ts:229-253` fetches
`list-project-change-feed` (`sync/useAutomationProjectDataPlatform.ts:62-70`) with a
cursor, page size 100, reconnect delay 1 s (`project-sync.ts:178`). Critically, it
is **not on a timer**. `fetchNext` is called on `start()`, on `hasMore`, on retry
after an error, and on `notifyMutation()` (`project-sync.ts:215-227`), and
`notifyMutation` is wired to a `program-api:mutation` DOM event that this tab
dispatches after its own mutating call
(`sync/useProjectSynchronization.ts:54-58`). It pauses entirely when the document is
hidden and resumes on `visibilitychange` (`project-sync.ts:269-281`). So a change
made by a **server-side run, or another tab, is not learned about until this tab does
something.**

**(c) Focus and visibility.** `runtime/RunHistory.tsx:70-99` re-lists runs on
`visibilitychange` and `window.focus`, and on a `runtime-run.changed` mutation, both
guarded by `document.visibilityState !== "visible"`.

### What that means for a run in flight

`FlowRunView` starts a run and then **awaits the POST**
(`runtime/FlowRunView.tsx:243-251`). While it is in flight the panel shows a spinner
and a local elapsed-seconds counter driven by a 1 s `setInterval`
(`FlowRunView.tsx:442`, rendered at `:481`) — the seconds tick, but nothing is
fetched. The action log is **not** polled: `RunActionLogView` loads a page when
mounted and when its `key` changes (`RunHistory.tsx:129` remounts it by bumping
`selectedRunRevision`), and the event stream loads only on an explicit **Load Event
Stream** / **Next Events** button (`RunActionLogView.tsx:290`).

The one genuine poll in the run path is the **read-back after a cut-short request**:
if the 30 s mutation times out, `readRunBack` polls `get-flow-run-detail` every
**2 s for up to 15 minutes** until the run reaches a terminal status
(`FlowRunView.tsx:60-61,185-199`).

The only other pollers in the panel are `createActivePoller` at **5 s** for the
Connected Clients view (`clients/active-poller.ts:6-33`,
`clients/useClientGatewayController.ts:111-113`) and the global pairing prompt's
backoff, **1 s while something is pending, decaying ×1.6 to a 10 s ceiling**
(`app/GlobalClientGatewayPairing.tsx:60,76-80`), which drops to a 5 s beat while
hidden (`:64-67`).

**Conclusion for a conversation.** Nothing in the panel today would deliver a turn
written by a server-side run. A live thread needs either a new poll (the pairing
prompt's adaptive backoff is the precedent that already works, and is already
mounted globally) or a new push channel. The 5 s client poll and the 2 s run
read-back bound what "feels live" currently costs.

---

## 3. What task t060 added for a run's permission request

Commit `bd26f24` "Show a run's permission request in the panel and let the person
answer it" (`Task: t060`, `Worker: w2x-run-permission-ui`), merged in `fde073b`.
Three files: `runtime/FlowRunView.tsx` (+183/−22), `runtime/RunPermissionRequest.tsx`
(+62, new), `runtime/run-input-model.ts` (+11/−1), plus
`tests/run-permission-request.test.tsx` (+323).

### Where it lives

Not a modal and not its own view. It is an **inline `<section>` inside the "Last
Run" summary block of Runtime Debug**: `RuntimePostRunSummary`
(`FlowRunView.tsx:501-528`) renders `<RunPermissionRequest>` at
`FlowRunView.tsx:512`, directly under the "Last Run" header and above the adaptation
notice and the summary strip. It is only mounted when the permission's run id equals
the last run's id (`FlowRunView.tsx:377`).

### What the person sees

`RunPermissionRequest.tsx:36-53`, styled with the existing
`automation-runtime-readiness` class and `role="status"`,
`aria-label="Permission requested by this run"`:

- a `ShieldAlert` icon;
- the heading **"This run stopped to ask for permission."**;
- **Core's own sentence**, `request.sentence` — never the model's. Core builds it in
  `automation-studio/runtime/action-permissions/request.ts:90-110`; for a recovery
  repairing a Flow step it reads *"To repair the step that failed, the Flow would
  &lt;verb&gt; \"&lt;control&gt;\" (&lt;kind&gt;) each time it runs, which would
  &lt;consequences&gt;. Neither its instruction nor a grant allows that, so the
  repair stopped to ask."*;
- a `<ul aria-label="Consequences requiring approval">` of the **missing**
  consequence classes, rendered through Core's exhaustive phrase map
  (`action-permissions/consequences.ts:67-73`): "spend, refund or move money",
  "delete or remove something", "send or publish something that others will receive
  or see", "change something that already exists", "create something new that stays";
- when the run already held some classes, a line *"Already allowed for this run: …"*
  (`RunPermissionRequest.tsx:43`);
- a reassurance line: *"The run did not do this, and no repair was proposed. Allowing
  starts a new run whose grant permits only the consequences listed above."*
  (`:45`).

The request is read out of `runDetail.metadata.permissionRequest` and passed through
Core's **strict** parser, `parseAutomationStudioActionPermissionRequest`
(`RunPermissionRequest.tsx:56-62`); a record with an unknown field, an unknown
consequence, or a control name that could carry markup renders **nothing**
(`request.ts:121-140`). A request whose `reason.stage` is `authoring` is filtered out
here — it belongs to the build panel (§ below).

### What "Allow and run again" sends

`FlowRunView.tsx:316-329` → `authorizeLlm(pending.mode, false, request.missing)`
(`:279-315`). Concretely:

1. It first re-checks that the Flow, project, run inputs **and step limit** are still
   exactly what the run asked with; if not it clears the request and says *"The Flow
   or its run inputs changed since this run asked. Run it again before allowing
   anything."* (`:322-326`).
2. It builds the grant request from the Flow
   (`runtimeLlmExecutionRequestFromFlow`) and adds
   `permittedConsequences: [...request.missing]` — **exactly the missing classes, not
   the full declared set** (`:282`).
3. `preflight-llm-execution` (`:286`). If the preflight says >100 000 tokens it
   diverts to the high-token `Modal` (`:293`, rendered `:383`) and remembers the
   permitted classes so the confirmed grant still carries them (`:116,293`).
4. `issue-llm-execution-grant` with `ttlMs: 300_000` (`:296`) — five minutes, raised
   from Core's one-minute default because a recovery only claims its grant after the
   Flow has run to the failing step (`FlowRunView.tsx:63-70`).
5. `runFlow(mode, grantId)` — the **same run intent** as before, carried as
   `runIntent: mode` alongside `llmExecutionGrantId` (`:219`).

So: a new run, with a new grant, widened by exactly what was refused. There is no
resumption; Core keeps no parked run (`request.ts:3-12`).

### What "Don't allow" sends

**Nothing.** `onDismiss` is `() => setRunPermission(null)`
(`FlowRunView.tsx:380`). The Flow and the page stay as the run left them. The test
`"sends nothing when the person does not allow it"`
(`tests/run-permission-request.test.tsx:215`) pins this.

### Two other shapes worth knowing

- **No grant to widen.** If the run carried no LLM grant, `onAllow` is omitted
  (`FlowRunView.tsx:381` gates on `isAutomationRuntimeExplicitLlmRunMode`) and the
  person is told *"It ran without an LLM grant, so there is no grant to extend: run
  the Flow again with Explore and adapt to allow it."* (`RunPermissionRequest.tsx:46`).
- **The creation-stage equivalent is a different, unshared UI.** A
  `flow_bootstrap.permission_required` diagnostic during a build is handled entirely
  separately in `authoring/BlankFlowAuthoringPanel.tsx:211-221,250,259-263`: a
  dismissible inline notice with a **Review requested permissions** button, then a
  `Modal` titled *"Confirm Flow action consequences"* with **Cancel** /
  **Allow and continue**. It duplicates the sentence and the consequence list
  (`:260-261`) rather than reusing `RunPermissionRequest`. **Two hand-built surfaces
  for the same question is the strongest single argument in this report for a general
  channel.**

`run-input-model.ts` gained `explore_and_adapt` as an explicit LLM run mode
(`run-input-model.ts:8-9`), surfaced as a sixth mode button
(`FlowRunView.tsx:430`) described as *"If a step fails, explore the live page to find
a repair… Anything with a lasting effect stops and asks for your permission first."*
(`FlowRunView.tsx:398`).

---

## 4. The adaptation review UI — the closest existing "model proposes, person
approves" precedent

`features/automation-studio/adaptations/`, 609 lines across five source files.
The view is `AdaptationsView.tsx` (342 lines), a two-pane master/detail inside
`automation-runs-workspace` (`:186-321`).

**The inbox** (`:190-214`): search (250 ms debounced, `:53-56`), status filter over
eight statuses (`:13`), risk filter (low/medium/high/destructive, `:197`), sort and
direction, a `role="table"` list with columns Trigger / Risk / Updated / Status
(`:202-203`), and offset pagination at 25 per page (`:11,207-213`).

**The detail** (`:215-308`) has five tabs — Summary, Changes, Evidence, Validation,
Audit (`:221-227`) — each independently paginated at 8 rows (`:12,300-306`).

**The changed-fields table** is `AdaptationChangeCard.tsx:34-37`: a
`role="table" aria-label="Changed fields"` grid of **Field / Previous / New**, one
row per differing leaf path. The diff itself is computed client-side by
`adaptation-model.ts:3-29` — a recursive structural walk of `before` vs `after`
capped at 50 fields, rendering `undefined` as "Not set", `null` as "None", `""` as
"Empty", booleans as "Yes"/"No". Each card also carries a target link
(`AdaptationChangeCard.tsx:31`, `adaptation-model.ts:37-43` maps a patch kind to a
Router / Subflows / Instructions / Nodes jump) and a `JsonToggle` escape hatch
(`:38`). Applied adaptations render a second list of durable mutations with the same
card (`AdaptationsView.tsx:255-258`).

**Note what is absent:** the diff is *field-level only*. `adaptation-model.ts` has no
node/edge or Flow-script awareness. The Week 2 audit records this as the gap —
"Core renders a field-level 'Changed fields' before/after table
(`adaptations/AdaptationChangeCard.tsx:34-36`); no driver asserts it. No Flow-script
or structural diff exists"
(`docs/working/week2-exit-plan/reports/w2x-ui-e2e-audit.md:63`).

**Revert, reject and the PIN.** The available actions are a pure function of status
and kind (`adaptation-model.ts:47-59`): `proposed` → approve / reject /
request_validation / switch_manual; `validated` → apply / reject / disable /
supersede / …; `applied` → **revert only**. A `flow_bootstrap` adaptation gets a
narrower set. Each action carries fixed copy — title, description, button label and a
`danger` flag (`adaptation-model.ts:61-73`); reject, disable, revert and supersede
are `danger`.

The buttons live at the bottom of the **Audit** tab under a header that reads
"Review Actions / PIN required" (`AdaptationsView.tsx:294-297`). Choosing one opens a
`Modal` (`:310-320`) containing: a required **Reason** textarea for reject and
supersede (`:312`), a required **Replacement adaptation ID** for supersede (`:313`),
and always a required **PIN** field with `inputMode="numeric"`, stripped to digits
and capped at 12 (`:314`). The submit button is disabled until `reviewPin.length >= 4`
and the conditional fields are filled (`:318`), and the same guards are re-checked
server-side-bound in `reviewAdaptation` (`:133-142`). The call is
`reviewAdaptation({ projectId, flowId, adaptationId, action, authorizationPin, reason?, supersededByAdaptationId? })`
(`:145-153`); on success it replaces the selected adaptation with the returned one
and re-lists the current page (`:159-164`).

**This is the shape a conversation should borrow from and the shape it should not
copy.** Borrow: Core-supplied copy per action, danger flagged in data, a reason
demanded for destructive decisions, a re-authentication step for anything durable, an
optimistic replace followed by a re-list. Do not copy: burying the decision buttons
on the fifth tab of a detail pane.

---

## 5. Conventions a new surface must follow

### State management

Three layers, and the choice between them is not free-form.

1. **Local `useState` inside the view** for everything transient. Every existing view
   does this heavily — `AdaptationsView.tsx:30-52` holds 19 pieces of state plus
   three request-generation refs; `FlowRunView.tsx:101-122` holds 18.
2. **A scoped external store** for anything the workspace shell must re-render on.
   `stores/external-store.ts` provides `createScopedExternalStore`, consumed via
   `useSyncExternalStore` with a selector and an explicit equality function
   (`workspace/render-store.tsx:1-30`, `workspace/studio-ui-store.tsx:1-70`,
   `stores/use-store-selector.ts`). Every selector call is named for the render
   metric (`runtime/useAutomationRuntimeStatusState.ts:11-13`).
3. **The mutation bus** for cross-view "this changed" notifications
   (`stores/mutation-transaction-store.ts:91-97`). **A new mutation kind must be added
   to the union at `:1-29`** — it is a closed discriminated union, so a conversation
   turn landing would need e.g. `"conversation.changed"` there.

Request sequencing is done by hand and consistently: a monotonic
`requestRef.current` compared after every await
(`AdaptationsView.tsx:75,89`; `RunHistory.tsx:42,55`), plus an `AbortController` per
in-flight read for the heavier views (`RunActionLogView.tsx:60-69,79-86`).
A generation counter invalidates stale async work when the Flow changes
(`FlowRunView.tsx:118,144,203`).

`localStorage` is used, but guarded and size-capped, and the guard is tested
(`views/tests/GraphEditorViews.test.ts:31-42`,
`flow-editor/palette-preferences-repository.ts`).

### Styling

**No CSS-in-JS, no CSS modules, no Tailwind.** Plain global class names on plain
elements, defined in numbered stylesheets and pulled in by an import-only manifest:
`app/globals.css:1-27` (18 foundation + 6 program + 2 extra sheets) and
`app/programs/automation-studio/automation-studio.css:1-38` (38 Studio sheets under
eight domain folders).

Enforced rules:

- The manifests are **import-only** and route-scoped — `globals.css` may not contain
  `{` or `.automation-`, and the Studio manifest must be imported by the Studio
  layout, not the root layout
  (`features/automation-studio/styles/tests/styles-architecture.test.ts:52-60`).
- Every `.css` file under `styles/` must be imported exactly once and live in one of
  eight approved domain folders (`styles-architecture.test.ts:15-24,38-50`).
- Colors come from role tokens — `--surface-shell`, `--surface-pane`,
  `--surface-tool`, `--surface-selected`, `--surface-code`, `--content-code` — and
  literal hex surface values are rejected
  (`features/programs/tests/surface-contract.test.ts:8-20`).
- Typography: no font-size at or below 10px, `letter-spacing` must be `0` everywhere,
  no viewport-scaled text (`features/programs/tests/typography-contract.test.ts:6-16`).
- Layout: `100dvh` not `100vh`, and named breakpoints at 1024 / 768 / 390 px, each
  with asserted behaviour (`features/programs/tests/responsive-contract.test.ts:13-30`).

A new surface therefore gets **a new numbered `.css` file in an existing domain
folder**, one `@import` line, and nothing else.

### Accessibility

Not aspirational — asserted. Modals isolate focus via `inert` on siblings rather than
mutating `document.body.style.overflow`, and this is checked by reading the component
source (`features/programs/tests/component-contracts.test.tsx:24-38`,
`features/programs/overlay-environment.ts`). Shared primitives exist for the rest:
`Modal` / `ModalContent` / `Drawer` / `AlertDialog` / `AuthorizationDialog`
(`features/programs/components/overlays/`), `Field` with `label`/`hint`/`error`/
`required`, and the `role="status"` / `role="alert"` split used consistently
(`RunPermissionRequest.tsx:37` status; `FlowRunView.tsx:376` alert).
Tab strips use `role="tablist"`/`role="tab"`/`aria-selected`
(`FlowRunView.tsx:496`) or `aria-pressed` for segmented buttons
(`AdaptationsView.tsx:227`, `FlowRunView.tsx:456`). Resize handles carry
`aria-valuemin/max/now` and keyboard handlers
(`workspace/shell/TimelineDock.tsx:28-37`).

### Testing

Vitest with `react-test-renderer` (`tests/run-permission-request.test.tsx:1-2`),
plus Playwright for `e2e/`. **Tests live in a `tests/` folder beside their subject**,
never loose — every feature folder has one. Three distinct kinds are in use, and a
new surface will be expected to carry all three:

1. **Behavioural** — mount the `…Content` component with injected command doubles and
   drive it. `run-permission-request.test.tsx:92-108` is the model: every view splits
   into `XView` (reads commands from a hook) and `XViewContent` (takes them as
   props), exactly so the content form can be mounted in a test
   (`FlowRunView.tsx:93-99`, `RunHistory.tsx:12-18`, `AdaptationsView.tsx:23-28`).
   Notably `run-permission-request.test.tsx:28-45` builds its fixture by running
   **Core's real gate** and JSON round-tripping it, rather than hand-writing a payload.
2. **Source-text architecture assertions** — `readFileSync` the module and assert what
   it does and does not contain (`views/tests/ClientViews.test.ts:12-24` forbids
   `setInterval` and requires `createActivePoller`;
   `features/automation-studio/tests/architecture-contract.test.ts` runs a TypeScript
   AST pass over every production source).
3. **CSS-manifest contract tests** — §Styling above.

Budgets are also enforced: `features/programs/ui-performance-budgets.ts:1-25`
(view switch 100 ms, run list open 500 ms, run log open 600 ms, run detail ≤256 KB,
≤4 requests per interaction, ≤40 studio renders), and the repository-wide structure
audit caps a file at 800 lines with a 400-line warning and a directory at 25 files
(`F:\!FluxIQ\.structure-baseline.json`).

### Is there an existing timestamped-list component?

**No reusable one. Three partial precedents, all bespoke.**

- The **closest** is the ordered event stream in
  `runtime/RunActionLogView.tsx:287-297`: an `<ol>` with `maxHeight: 360`,
  `overflowY: auto`, a hand-rolled virtualiser (38 px rows, 6 rows of overscan,
  spacer `<li>`s top and bottom, `onScroll` → `setEventScrollTop`,
  `:239-243,293-297`), each row a button carrying sequence number, title,
  `StatusBadge` and kind, with a detail `<aside>` opening beside it (`:298`). It is
  cursor-paged by an explicit button, not auto-loaded.
- `recordings/RecordingTimelineView.tsx:23-29` is a five-lane recording timeline —
  domain-specific, window-paged (`recording-model.ts`), with its own keyboard model.
- `features/programs/components/data/List.tsx` + `ListRow.tsx` are generic but
  **untimed**: `ListRow` takes `title`, `description`, `leading`, `meta`, `actions`,
  `selected`, `onOpen` (`ListRow.tsx:12-31`). A timestamp would go in `meta`.

Timestamp formatting is centralised but trivially so:
`runtime/run-format.ts:19-21` `formatRuntimeTimestamp` (locale string, `"-"` for a
non-number) and `:23-26` `formatRuntimeDuration` (`"<n>ms"`, or `"in progress"` when
either end is missing). `AdaptationsView` imports `formatRuntimeTimestamp` from the
runtime barrel (`AdaptationsView.tsx:6`), so cross-feature reuse of it is already
established practice.

**A conversation transcript would be a genuinely new component.** It is also the
first thing in the panel that would need auto-scroll, grouping by author, and
incremental append — none of which exist anywhere.

---

## Which of the three UI-less journeys a thread can serve

The Week 2 audit (`docs/working/week2-exit-plan/reports/w2x-ui-e2e-audit.md:36-41`)
named three.

### (a) A permission request from a run or a repair — **a thread serves this fully.**

It is the best fit of the three and should be the first caller. The evidence:

- The payload is already conversational. `AutomationStudioActionPermissionRequest`
  (`action-permissions/request.ts:52-78`) carries `requestId`, `requestedAtMs`, a
  Core-authored `sentence`, the consequence classes, what authority the run already
  held, and *"`requestId` is the key a store would hold it under, and nothing in it
  assumes the run has already ended"* (`request.ts:6-10`). Core has already designed
  it to be parked.
- It is rendered **twice today**, differently, by two features that do not share code
  — `RunPermissionRequest.tsx:36-53` and
  `authoring/BlankFlowAuthoringPanel.tsx:259-263` — and Core already tags which is
  which with `reason.stage` (`request.ts:31`), a field the run-side UI uses only to
  *discard* the other's requests (`RunPermissionRequest.tsx:61`). One thread keyed on
  the work item collapses both.
- Both current surfaces are only reachable **if you happen to be on Runtime Debug
  looking at the Last Run block**. The audit records that the creation-stage dialog
  has never once been observed in a live panel run
  (`w2x-ui-e2e-audit.md:64`). A thread with an unanswered-question indicator fixes
  the reachability problem, which is the actual failure.
- The answer is small and closed: allow the listed classes, or refuse. That is a
  turn with two buttons, not a screen.

The only visual element it needs inside the turn is the consequence list — five fixed
phrases from `consequences.ts:67-73` — and, when Core can carry it, the control name.

### (b) Improving an existing Flow — **a thread serves the conversation; the result still needs the existing views.**

The audit's finding is a *capability* gap, not a rendering gap: "Authoring requires a
blank Flow" (`w2x-ui-e2e-audit.md`, journey 12), and the constraint is real —
`authoring/blank-flow-authoring-model.ts:98-106` refuses unless the Flow has zero
nodes, zero edges, no router and no subflows. `BlankFlowAuthoringPanel` is mounted
unconditionally inside Runtime Debug (`FlowRunView.tsx:356`) and simply renders
nothing when that predicate fails.

So the *entry point* — "tell FluxIQ what you want changed, and talk about it" — is
exactly a thread: free text in, questions back, a proposal out. But the **outcome**
of that conversation is an adaptation, and an adaptation already has a good home:
the Adaptations view's changed-fields table, evidence tabs and PIN-gated apply
(§4). The thread should carry the discussion and a link, not re-render the diff.

### (c) A structural repair diff — **this genuinely needs a visual surface, and it does not exist yet.**

`adaptation-model.ts:3-29` is a leaf-path scalar differ. A repair that adds a node,
rewires an edge, splits a subflow or changes a route produces `before`/`after`
objects whose honest rendering is a graph, not a two-column table — the audit says so
outright (`w2x-ui-e2e-audit.md:63`: "No Flow-script or structural diff exists").
Rendering it as 50 rows of `nodes.3.parameters.selector` would be worse than nothing.

A thread can **announce** it and hold the decision, but the diff itself must be a
component — and the panel already owns a graph renderer
(`flow-editor/components/FlowGraphCanvas.tsx`, `FlowNode.tsx`, `FlowEdge.tsx`) that a
read-only before/after variant could reuse. That is separate work.

**Net:** one of three is served outright, one is served at the conversation end with
existing screens for the outcome, one needs a real visual surface that a turn embeds.
Which is precisely the design the thread has to support: **a turn must be able to
carry a rendered component, not only text.**

---

## Where the conversation surface goes

A concrete proposal, justified by §5.

### Three surfaces, not one

**1. A Studio view — the thread itself.** Declare `conversation` in
`views/canonical-view-definitions.tsx` as:

```
conversation: {
  id: "conversation", aliases: [], kind: "conversation",
  label: "Conversation", icon: MessagesSquare,
  group: "Workspace", region: "right", allowedRegions: ["right", "main"],
  scope: "Current project, Flow, or run", requires: "hasProject",
  isAvailable: available("hasProject"), addable: true,
  lifecycle: lifecycle(false), cache,
  functionality: functionality("conversation", "…", ["project", "flow"],
    ["thread summary", "unanswered questions"],
    ["turns", "permission requests", "proposed changes"], "paged"),
  host: conversationHost
}
```

`region: "right"` places it alongside Inspector and Problems in the right utilities
pane (`workspace/shell/RightPaneArea.tsx:36`, tabs at `:30`), which is where a
persistent companion belongs — visible while the person works in Nodes or Runtime
Debug in the main pane, exactly as Problems is. `lifecycle(false)` means
`sleepUntilActivated: false`, matching `clients` and `problems`
(`canonical-view-definitions.tsx:81,151`): the thread must keep its poll alive while
the tab is in the background, or an answer would never arrive.
`allowedRegions: ["right", "main"]` lets a long conversation be promoted to a full
main-pane tab. `dataIntensity: "paged"` is required by
`views/tests/view-contracts.test.ts:45-48` for anything non-trivial.

**2. A global indicator — so an unanswered question is reachable from anywhere.**
Mount a `GlobalConversationPrompt` next to `GlobalClientGatewayPairing` in
`app/layout.tsx:19-20`. Copy that component's proven shape
(`app/GlobalClientGatewayPairing.tsx:57-97`): adaptive backoff, 1 s while something
is pending, ×1.6 to a 10 s ceiling, 5 s while the document is hidden, resume on
`visibilitychange`. It is the only mechanism in the panel that already delivers a
server-originated question to a person who is not looking at the right screen, and
§2 established that nothing else will.

**3. A non-blocking notice for informational turns.** `notifyGlobalAlert`
(`features/programs/components/feedback/notifyGlobalAlert.ts`, viewport at
`GlobalAlertViewport.tsx:16-65`) already supports a title, a tone, a TTL and an
**action button with a callback** (`:32-33,85-89`). A model turn that only reports
progress should be an alert with an "Open conversation" action, not a modal.

### Files

| Path | What |
|---|---|
| `features/automation-studio/conversation/ConversationView.tsx` | `ConversationView` (hook) + `ConversationViewContent` (props), per `FlowRunView.tsx:93-99` |
| `features/automation-studio/conversation/ConversationThread.tsx` | the scrolling transcript |
| `features/automation-studio/conversation/ConversationTurn.tsx` | one turn; dispatches on payload kind |
| `features/automation-studio/conversation/turns/PermissionRequestTurn.tsx` | the §3 payload, reusing Core's `sentence` + `AUTOMATION_STUDIO_ACTION_CONSEQUENCE_PHRASES` |
| `features/automation-studio/conversation/ConversationComposer.tsx` | the person's reply box |
| `features/automation-studio/conversation/conversation-host.ts` | `ConversationViewHostModel`, `…HostCommands`, `useConversationCommands()`, per `runtime/runtime-host.ts:9-60` |
| `features/automation-studio/conversation/conversation-queries.ts` / `-commands.ts` | `list-conversation-turns`, `get-conversation`, `post-conversation-turn`, `answer-conversation-question` |
| `features/automation-studio/conversation/conversation-model.ts` | turn ordering, unanswered-question selection, grouping |
| `features/automation-studio/conversation/functionality-contract.ts` | per `runtime/functionality-contract.ts:1-50` |
| `features/automation-studio/conversation/index.ts` | barrel |
| `features/automation-studio/conversation/tests/*.test.tsx` | behavioural + source-architecture |
| `features/automation-studio/styles/conversation/01-thread.css` | one sheet, one `@import` in `automation-studio.css` |
| `app/GlobalConversationPrompt.tsx` + `app/api/conversations/pending/route.ts` | the global indicator and its poll route |

Edits to existing files: `views/canonical-view-definitions.tsx`,
`views/view-types.ts:15`, `live/view-host/canonical-connected-views.tsx`,
`live/view-host/connected-view-entries.tsx:163-170`,
`live/view-host/useAutomationConnectorCommands.ts:65-106`,
`app/programs/automation-studio/automation-studio.css`, `app/layout.tsx`,
`stores/mutation-transaction-store.ts:1-29` (a `"conversation.changed"` kind), and
the two gate tests (`tests/architecture-contract.test.ts:34-51,58-71,73-79`;
`styles/tests/styles-architecture.test.ts:15-24`).

### Component shape

```tsx
// ConversationThread.tsx — modelled on RunActionLogView.tsx:287-297
<ol className="automation-conversation-thread"
    aria-label="Conversation"
    aria-live="polite"
    onScroll={…}
    style={{ overflowY: "auto" }}>
  {visibleTurns.map((turn) => (
    <li key={turn.turnId}>
      <ConversationTurn turn={turn} busy={busy}
                        onAnswer={answer} onOpenTarget={openTarget} />
    </li>
  ))}
</ol>
```

- **Virtualise it from day one.** `RunActionLogView.tsx:239-243,293-297` is the
  working pattern: fixed row height, overscan, spacer `<li>`s. `aria-live="polite"`
  on the list makes an arriving turn announced; individual turns stay silent.
- **Auto-scroll only when already at the bottom** — new behaviour, but the scroll
  position is already tracked the same way (`RunActionLogView.tsx:59`).
- **`ConversationTurn` dispatches on payload kind**, so a turn can carry a rendered
  component. This is what makes the §(c) structural diff possible later without
  redesigning the thread: a `structural-diff` payload renders a read-only graph, a
  `permission-request` payload renders §3's consequence list and two buttons, a plain
  payload renders text.
- **Every payload is parsed strictly before render**, exactly as
  `RunPermissionRequest.tsx:56-62` does — a turn is the one place a model's words
  reach a person, so nothing Core did not build should render.
- **A destructive answer re-uses the existing authorization dialog**
  (`features/programs/components/overlays/AuthorizationDialog.tsx`, used with
  `requirements={{ pin: true }}` per `views/tests/ClientViews.test.ts:22`) rather
  than inventing a second PIN field.
- **State**: local `useState` for composer text, scroll, and busy; the
  `requestRef`-generation guard for every read (`AdaptationsView.tsx:75,89`);
  `commitAutomationStudioMutation({ kind: "conversation.changed", … })` after posting
  a turn, so any other mounted surface refreshes without a poll.
- **Do not use `setInterval`.** `views/tests/ClientViews.test.ts:18` already fails a
  view whose controller contains it; use `createActivePoller`
  (`clients/active-poller.ts:6-33`) for the in-view poll and the pairing prompt's
  backoff for the global one.

### The one thing this cannot decide

Whether an answer **resumes** a parked run or **starts a new one**. Today it starts a
new one, deliberately: Core keeps no pending-request store and no resumable run
(`action-permissions/request.ts:3-10`), and the panel re-runs with a widened grant
(`FlowRunView.tsx:316-329`). The panel side of a resuming design is not materially
different — the same turn, the same two buttons — but the sentence shown to the
person changes, because `RunPermissionRequest.tsx:45` currently promises *"The run
did not do this"*. That copy is Core's to own, and the conversation's Core-side
design has to settle it.
