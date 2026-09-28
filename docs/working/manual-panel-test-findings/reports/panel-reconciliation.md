# Panel reconciliation — the seams between WS-A, WS-B, WS-C and WS-D

Worker report. All paths under `F:\!FluxIQ\apps\web` unless stated otherwise.
Source paths are relative to `src/features/automation-studio/`.

## Outcome

**Done.** All five brief items plus the two coordinator additions are landed.
The whole `apps/web` suite is **256 files / 1424 tests, 0 failures**, `tsc
--noEmit` is clean, and `node scripts/structure-audit.mjs` passes with no
violation anywhere — including none in a file I own. No file under
`packages/fluxiq/` was edited.

Two deliberate deviations from a literal reading of the brief are in **Open
questions**, both about where the PIN prompts could actually be removed.

---

## 1. The two failing tests

`views/tests/canonical-diagnostics-disclosure.test.ts` and
`views/tests/GraphEditorViews.test.ts` both asserted strings WS-A deliberately
removed. WS-A's change is the intended one, so the assertions moved to the new
copy rather than the copy moving back.

- **Diagnostics disclosure.** The `runtime-debug` policy's evidence list now
  names `"Raw values"` instead of `"Advanced JSON"`. Same `<details>`, same
  run-input document, named for what a person reads rather than the format it is
  stored in.
- **Graph editor boundary.** Four assertions, not the one the brief expected —
  vitest stops a test at its first failure, so three more were hidden behind it:
  - `aria-label="Opening node editor"` → `aria-busy="true"`, `aria-live="polite"`
    and `"Opening these steps..."`. The intent of the old assertion was "a
    summary-only graph announces that it is loading"; what changed is that the
    announcement now carries visible words and a spinner instead of an empty
    labelled div, and a *missing* graph is no longer announced as busy at all
    because it is not loading — it renders the start pane.
  - `"Saved Nodes could not be loaded:"` → `"These steps could not be loaded:"`.
  - `">Retry</button>"` → `">Try again</button>"`.
  - `props.taskGraph.metadata?...` → `props.taskGraph?.metadata?...`, because
    WS-A made the error branch tolerate a missing graph.

## 2. Vocabulary drift

WS-B's twelve-name table is authoritative. Every user-facing string that named a
panel by its old name now names it by its new one.

| Where | Before | After |
|---|---|---|
| `runtime/FlowRunView.tsx` header | Runtime Debug | **Run and test** |
| `clients/ClientGatewayView.tsx` header + search label | Connected Clients / Search connected clients | **Connected browsers** / Search connected browsers |
| `subflows/SubflowsView.tsx` header | Subflows | **Reusable parts** |
| `router/RouterContentView.tsx` × 4 headers | Router | **Choose a path** |
| `adaptations/AdaptationsView.tsx` header | Adaptations | **Suggested changes** |
| `live/components/AutomationStudioSession.tsx:563` breadcrumb fallback | Nodes | **Steps** |
| `hierarchy/AutomationHierarchyDialog.tsx` × 5 | Subflows / Subflow / New subflow / Subflow name | **Reusable parts** / **Reusable part** / New reusable part / Reusable part name |
| `hierarchy/AutomationProjectHierarchySidebar.tsx` filter | Subflows / Instructions / Adaptations | Reusable parts / Guidance notes / Suggested changes |
| `hierarchy/command-executor.ts` × 2 errors | "Subflows must be created inside a Flow's Subflows folder." | "A reusable part must be created inside an automation's Reusable parts folder." |
| `workspace/shell/WorkspaceShell.tsx` narrow-button fallback | Inspector | **Details** |
| `inspector/inspector-identity.ts` title fallback | Inspector | **Details** |

**WS-A's stale empty-state copy** in `subflows/SubflowsView.tsx` pointed at "the
plus button beside the **Subflows** folder"; that tree row is "Reusable parts"
now, and the sentence says so. The same view's six row-menu labels, its six
modal titles, its modal intro copy and its six aria-labels were renamed with it,
because leaving "Rename subflow" beside a panel called "Reusable parts" is the
same drift one level down.

**The two fallback labels matter more than they look.** `WorkspaceShell.tsx`
reads `activeRightView?.view.label ?? "Inspector"` for the narrow-screen button
that opens the right pane. The registry now calls that view "Details", so the
button read one name and the tab it opened read another — and the e2e helper
finds that button by its text.

**Where I stopped.** I did not rename the *concept* "Router" in body copy
("Router references must be removed first", "Still used by Router",
"N Router references"). WS-B's §4.3 — the remaining in-panel copy — is explicitly
unowned, and renaming the Router concept across Subflows, Adaptations and the
Router's own internals is a separate pass. What I renamed is every string that
names a **panel, tab or tree row**, which is what the twelve-name table governs,
plus the object noun (`subflow` → "reusable part") that WS-B's tree-kind map
defines.

Tests updated to match, all of them assertions on copy I changed:
`clients/tests/large-project-behavior.test.ts`, `views/tests/ClientViews.test.ts`,
`subflows/tests/subflows-view.test.tsx`, `router/tests/router-view.test.tsx`,
`workspace/tests/strict-runtime-contract.test.ts`, and four `runtime/tests/`
describe titles.

## 3. WS-C leftovers in WS-A files

### `active()` — P12 finished

`runtime/FlowRunView.tsx:336` now carries `active: () => props.activeRef?.current
?? true`, beside `canPlay`. That needed one more thread than WS-C could see:
`FlowRunView` had no activity prop at all, so `FlowRunViewProps` gained an
optional `activeRef`, and `views/canonical-view-definitions.tsx`'s `runtimeHost`
now destructures `activity` and passes `activity.activeRef` through
`RuntimeCanonicalHost`. `defineAutomationViewHost` already handed `activity` to
every render function, so no host type changed. A registrar that reports no
activity is still treated as active, which is what keeps a single mounted panel
answering the header.

### The three routine-editing prompts

Traced each to the endpoint it sits in front of, in Core, before removing
anything — `_shared/api.ts:118-127` PIN-checks exactly
`classification: "destructive"`, and `authorizeProgramPin` throws
`"PIN is required for this action"` on an empty one.

| View | Actions | Core classification | Outcome |
|---|---|---|---|
| `adaptations/AdaptationsView.tsx` | approve, reject, apply, disable, supersede, revert, request validation, switch manual — all `review-flow-adaptation` | **authoring** | **Prompt deleted entirely.** `reviewPin` state, the `PIN` field, the `reviewPin.length < 4` guards and the "PIN required" header all gone; the wire still carries `authorizationPin: ""`, which the server ignores. Error text moved to a `StatusText`. |
| `subflows/SubflowsView.tsx` | rename, duplicate, enable, disable, archive — `rename/duplicate/enable/disable/archive-flow-subflow` | **authoring** | Prompt removed for all five. |
| same | delete — `delete-flow-subflow` | **destructive** | **Prompt kept.** Field renders only on `delete`; the submit guard only requires a PIN on `delete`. |
| `router/RouterContentView.tsx` | save route, delete route, save group, save fallback, mutate route | **authoring** | Prompt removed for all five: `requestAuthorization` now runs the action on the press. |
| same | delete group — `delete-flow-map-route-group` | **destructive** | **Prompt kept**, retitled "Delete this route group?" with danger styling. |

The Router needed a small refactor to do this honestly: `completeAuthorizedAction`
read the action out of React state, which is not set yet on the tick a button is
pressed. It is now `applyRouterAction(action, pin, mutation)` taking all three as
parameters; `completeAuthorizedAction` calls it with the modal's PIN,
`requestAuthorization` calls it with `""`, and `requestRouteMutation` passes its
mutation straight through instead of racing `setRouteMutation`.

**WS-A was told to harden the Subflows PIN with `type="password"`; WS-C is right
that this contradicts the rule.** The field is gone for the five routine actions
rather than hardened. It stays, masked, on the delete.

### The budget

`authorization/tests/authorization-policy.test.ts`: the "Not yet converted" group
is gone. `adaptations/AdaptationsView.tsx` is out of the budget altogether;
`subflows/SubflowsView.tsx` and `router/RouterContentView.tsx` moved into the
destructive group with the Core endpoint named beside each. Two new guards so the
win cannot be quietly undone:

- `CONVERTED_AWAY_FROM_PROMPTS` — AdaptationsView must stay at zero **and** must
  not reappear in the budget. The ratchet alone would accept a file re-entering
  it, since a new entry only has to be written down.
- A test pinning the budget to exactly five files at exactly one prompt each,
  with the reason: each guards one delete, and Core PIN-checks only `destructive`.

## 4. The blocked create button

`FlowEditorStartPane` — the pane a project opens on — now renders a real
**Create automation** button when nothing is selected. The chain:

- `live/hooks/useAutomationHierarchyCommandBridge.ts` gained `createFlow`: it
  requests `{ action: "create", category: "flow", parentId: null }` (the project
  root, which `automationHierarchyCreateCommandCanDispatch` allows for the `flow`
  category) and then dispatches `set-create-kind: "flow"`, which skips the type
  picker so the person lands on the name field in one press instead of two.
- `live/view-host/useAutomationConnectorCommands.ts` gained `createFlow` and
  hands it to the flow-editor view as `onCreateFlow`.
- `live/components/AutomationStudioSession.tsx` binds it to
  `hierarchyBridge.createFlow`.
- `flow-editor/components/FlowEditorView.tsx` declares `onCreateFlow` on
  `FlowEditorViewProps`, which widens the host model automatically because
  `flowEditorHost` types itself as `ComponentProps<typeof FlowEditorView>`.

The pane's copy dropped "use the + button beside Flows at the top of that list"
for "or make a new one here", since the control is now on the pane.

**Create a Flow, not start a conversation — and why.** The coordinator asked me
to choose. The landing pane's whole job, per P3, is the ask: "tell FluxIQ what to
automate", which is `BlankFlowAuthoringPanel`, and that panel needs a Flow to
write into — `blankFlowExplorationRequest` and `blankFlowAuthoringRequest` both
refuse without one. A thread opened first would be a thread about a project with
nothing in it, and the person would still have to make a Flow before anything
could happen. Creating the Flow puts them one step from the ask; opening a thread
puts them two. The conversation is not left out, though: the dock is already
mounted on the landing screen (WS-D), and its composer is now live (below), so
someone who would rather talk first can.

## 5. e2e label references

Every selector in the browser suite resolves a view by its visible name, so all
of them had gone stale. Fixed across nine files:

`e2e/support/app-fixture.ts` (the `StudioViewTitle` union and five helpers),
`automation-studio-render-loop.spec.ts`, `performance-baseline.spec.ts`,
`phase8-accessibility-matrix.spec.ts`, `phase8-hierarchy-workflows.spec.ts`,
`phase8-performance-certification.spec.ts`, `phase8-resilience-workflows.spec.ts`,
`phase8-workspace-workflows.spec.ts`, `surface-matrix.spec.ts`.

Three occurrences that look like labels and are **not**, left alone deliberately:
`BROWSER_METRIC_NAMES` holds `"Nodes"` (a Chrome CDP metric),
`getByLabel("Nodes whiteboard")` is the canvas's own aria-label, and
`verify-fixtures.mjs`'s `expectedSubflows` is a domain count.
`surface-matrix.spec.ts` also listed `"Flow"` where the label was `"Nodes"` — it
was already wrong before the rename — and now reads `"Steps"`.

**The contract test now derives the list instead of holding a copy.**
`testing/tests/phase8-browser-suite-contract.test.ts` read a hand-written twelve-name
array and grepped spec text for it, which is exactly why it stayed green while
every selector went stale: it compared one stale list against another. It now reads
`automationStudioViewDefinitions()` from the `views` barrel, asserts there are
twelve, and requires each registry label to appear both in the accessibility
matrix and in `StudioViewTitle`. Renaming a view now fails this test until the
browser suite is updated too.

`tsc` covers `e2e/**/*.ts`, so the `satisfies readonly StudioViewTitle[]`
constraints in `phase8-performance-certification.spec.ts` are real static
validation of the rename, not just a text substitution.

---

## Coordinator addition 1 — the `open-` prefix and the conversation capability

`"open-"` is now in `MUTATING_VERBS`
(`conversation/capabilities/tests/coverage.test.ts`), between `"normalize-"` and
`"pack-"`. Opening is not reading: `open-conversation` creates a thread that
outlasts the request.

Adding the prefix alone changes nothing, because the panel did not post
`open-conversation` anywhere — Core had the endpoint and the panel had no way to
call it. So the panel side went in too, and the ratchet then caught it: with the
prefix added and before the capability was declared, the coverage test failed
with exactly one gap, `"open-conversation (written by conversation/turn-commands.ts)"`.
That is the ratchet working, and it is the evidence that the prefix is not
decorative.

- `conversation/turn-commands.ts` — `startConversation()` posting
  `open-conversation`, with `subjectKind`/`subjectId` sent only together (Core
  refuses half a subject rather than ignoring it).
- `conversation/conversation-host.ts` — `startConversation` on
  `ConversationCommands`.
- `conversation/useConversationThread.ts` — an internal `openThread()` plus a
  public `startConversation()`. `sendReply` now opens a thread when none is
  selected: writing into a project that has said nothing yet is asking for a
  thread, not an error to report back, and Core continues a subject's open thread
  rather than minting a second.
- `conversation/components/ConversationViewContent.tsx` — the composer is
  disabled only when there is no project to open a thread on, which is the dock
  mounted on the landing screen before a project is picked. WS-D was right that
  the composer could not be honestly enabled before; it can now.
- `conversation/capabilities/catalog/conversations.ts` (new) — `conversation.start`,
  **declared, not excused**, under a new `"Conversation"` group.

Only one `open-*` endpoint exists in Core, so nothing else was surfaced and
nothing else needed excusing.

## Coordinator addition 2 — importing Core's destructive list

`conversation/capabilities/contract.ts` imported
`AUTOMATION_STUDIO_DESTRUCTIVE_ACTION_CONSEQUENCES` and deleted the local
`Object.freeze(["move_money", "delete"])`.

**The subpath in the brief was wrong and I used the right one.** The constant is
not on `fluxiq/automation-studio/panel-capabilities` — that barrel exports the
capability vocabulary and parser. It is on
**`fluxiq/automation-studio/action-permissions`**
(`runtime/action-permissions/client/index.ts`, re-exporting `destructive.ts`),
which is browser-safe, is already imported by `runtime/FlowRunView.tsx`, and is
built in `dist`. `capabilities/tests/registry.test.ts` still asserts the two
classes, and that assertion now reads through to Core.

---

## Commands run and observed results

All from `F:\!FluxIQ` or `F:\!FluxIQ\apps\web`.

```
$ cd F:/!FluxIQ/apps/web && npx tsc --noEmit
TSC_EXIT=0          # no output
```

```
$ cd F:/!FluxIQ/apps/web && npx vitest run
 Test Files  256 passed (256)
      Tests  1424 passed (1424)
   Duration  34.65s
```

```
$ cd F:/!FluxIQ && node scripts/structure-audit.mjs
structure-audit: passed (189 warning(s), 355 baselined).
AUDIT_EXIT=0
```

The audit failed once on a violation of mine and was fixed rather than
baselined — my contract-test import reached
`../../views/canonical-view-definitions` past the `views` barrel; it now imports
`automationStudioViewDefinitions()` from `../../views`.

Intermediate runs worth recording:

```
# after the prefix, before the capability was declared
$ npx vitest run src/features/automation-studio/conversation/capabilities/tests/coverage.test.ts
 × declares or excuses every one of them, with no gap
 +   "open-conversation (written by conversation/turn-commands.ts)",
```

```
# starting state named in the brief
 Test Files  2 failed | 254 passed (256)
      Tests  2 failed | 1420 passed (1422)
```

### A third failure the brief did not know about

The brief said two failures. A whole-suite run found **twelve**: the two named,
plus eleven in `runtime/tests/run-permission-request.test.tsx` and one in
`runtime/tests/runtime-views.test.tsx`. The eleven are not from the four UX
workstreams — they are from the Core worker landing
`send_or_publish` coming **off** the gated consequence list on 2026-09-28
(`packages/fluxiq/.../action-permissions/destructive.ts`). The test's fixture
built a request whose only missing class was `send_or_publish` and asserted
`verdict.permitted === false`; with sends no longer gated, nothing is missing and
the gate permits.

Fixed on the `apps/web` side, which is where the test lives: the fixture now uses
`delete`, one of the two classes Core still gates. The subject of those tests is
what the panel does with a permission request, not which class produced it, so
repointing the fixture keeps the contract and matches Core's new line. Eight
assertions moved (`consequences`, `missing`, the rendered phrase, `onAllow`'s
missing list, and four `permittedConsequences`).

---

## Not verified

- **Nothing was run in a browser.** No `pnpm dev`, no Playwright, no unpacked
  extension, no live panel. Every claim about what a person now sees is read from
  the JSX and the CSS.
- **The e2e rename is not exercised.** It type-checks, and the contract test now
  ties the labels to the registry, but no selector was driven against a real page.
  A Playwright run is the only thing that proves it, and the one-live-run-at-a-time
  rule forbade starting one.
- **`e2e/phase7-visual-fixture.spec.ts` still shows the old words** and I left it
  alone on purpose. It is a self-contained HTML string that never selects against
  the app, and it is compared to committed screenshots in
  `e2e/phase7-visual-fixture.spec.ts-snapshots`; changing its sample labels
  invalidates those baselines, which only a Playwright run can regenerate. WS-B
  excluded it from its list of nine for the same reason. **Follow-up: update it in
  the same pass that regenerates the phase 7 baselines.**
- **The create-automation button was not clicked.** That `createFlow` opens the
  dialog on the name step is read from `dialog-store.request` plus
  `reduceAutomationHierarchyDialogTransaction` (`set-create-kind` sets
  `step: "details"`), not observed. The command reaches the view through
  `connected-view-entries.tsx`, which types commands as
  `Record<string, unknown>` — so `onCreateFlow` arriving is by the same mechanism
  as the existing `onSaveGraph`, but it is not statically checked and no test
  mounts it.
- **The composer's new thread-opening path is unit-tested, not live.** A new case
  in `conversation/tests/conversation-view.test.tsx` drives the form submit with
  no threads and asserts `open-conversation` is posted and the turn appended
  against the returned thread; the real endpoint was not called.
- **The server-side classification claims are read, not exercised.** I traced
  every endpoint in section 3 to its `registry.register` in Core and read
  `_shared/api.ts` and `authorization.ts`. No request was made against a running
  server. If any of those endpoints is re-registered `destructive` later, the
  corresponding save will start failing with "PIN is required for this action".
- **`pnpm check` and `pnpm build` were not run** — only the web package's own
  `tsc --noEmit`, the whole-package vitest run, and the repository structure
  audit.
- **Removing the Adaptations PIN removes the only focusable field** from the
  approve/apply/revert dialogs. The `Modal` handles initial focus and
  `data-modal-submit` is on the action, so this should be fine; it was not
  observed in a browser.

## Open questions or contradictions found

1. **"Delete those prompts" and Core's server-side gate cannot both hold for two
   of the three files.** The brief says the three views' prompts must come out of
   the budget entirely. But `delete-flow-subflow` and `delete-flow-map-route-group`
   are registered `destructive` in Core, and `authorizeProgramPin` rejects a
   missing or short PIN outright — so deleting a reusable part or a route group
   from a view with no PIN field would fail at the server every time. I removed
   every prompt in front of an `authoring` endpoint (which is all of the routine
   editing the brief is about, and all of WS-C's actual complaint) and kept the
   two in front of `destructive` ones, moving their budget entries into the
   permanent group with the endpoint named. Only `AdaptationsView` left the budget
   entirely, because `review-flow-adaptation` is `authoring`. **WS-C's own report
   contains this contradiction too** — its recommendation 1 says to keep the
   Subflows PIN for `delete` *and* remove the file from the budget, which its own
   enforcement test would fail.
2. **The coordinator's subpath for the destructive list was wrong.** See addition
   2. `panel-capabilities` does not export it; `action-permissions` does. Worth
   correcting wherever that instruction came from, in case another worker is
   given the same path.
3. **`views/canonical-view-definitions.tsx` is WS-B's file and I edited it**
   (three lines, to thread `activity.activeRef` into the run panel). There was no
   other route: the runtime host is where a view's activity is available, and
   WS-C's half-fix cannot be completed without it. Flagging it because the audit's
   partition gave that file to WS-B.
4. **`live/view-host/connected-view-entries.tsx` types commands as
   `Record<string, unknown>`**, so nothing statically checks that the commands a
   view declares are the commands the connector supplies. `onCreateFlow` is
   correct by construction and by following the existing pattern, but a typo in
   that map would compile. Worth a ratchet of its own at some point.
5. **Audit §4.3 still has no owner**, and is now the largest remaining vocabulary
   gap: "Router" as a concept in body copy, "Adaptation Change", "Flow Graph",
   "State and Effects", "Evidence Inspector", "Source Evidence", "Effective
   Values", "Input Mapping" / "Output Mapping". I deliberately stayed out of it.
