# WS-A — First run: kill the blank pane, put the ask up front

Covers P1, P3, P8 (view side), P14 and the Run-panel half of P12, plus P18
reassigned from WS-C. All paths are under
`F:\!FluxIQ\apps\web\src\features\automation-studio\` unless stated otherwise.

## Outcome

**Partial.** Priorities 1, 2, 4, 5 and 6 are done. Priority 3 ("give every
'Select a Flow' empty state a create button") is done as far as the file
partition allows: every dead end now names the exact control that creates the
thing it is waiting for, but **no create *button* could be added**, because no
view in WS-A receives a create command and the files that would supply one are
outside WS-A. See **Open questions** — this is a brief defect, not a decision I
made.

## What changed and why

### 1. The default landing pane is never a blank `aria-busy` div (P1)

`flow-editor/components/FlowEditorView.tsx` previously collapsed two different
situations into one empty `<div aria-busy="true">` with no content:

```tsx
if (!props.taskGraph || props.taskGraph.metadata?.summaryOnly === true) {
  return <div aria-label="Opening node editor" aria-live="polite" aria-busy="true" className="automation-view-loading" />;
}
```

They are now separate:

- `summaryOnly === true` is a genuine load, so it renders the spinner element
  (`.automation-view-loading-indicator`, which was never rendered before) plus
  the words "Opening these steps...".
- `!taskGraph` is *not* loading. It now renders `FlowEditorStartPane`: a
  heading, one plain-English sentence, and — when the selected Flow can be
  authored — the instruction textarea with exactly one primary button.

The error branch and the `Suspense` fallback were also given visible text and a
spinner; the error branch's copy lost the word "Nodes".

### 2. The instruction textarea is lifted out of Runtime Debug (P3)

`BlankFlowAuthoringPanel` was rendered in exactly one place,
`runtime/FlowRunView.tsx:356` — the Runtime Debug tab, bug icon, group
"Evidence", not open by default. It is now rendered by `FlowEditorStartPane`
instead, which is the view the default workspace opens
(`workspace/layout/defaults.ts:27`) **and** the view a tree click on a Flow
opens. It is removed from `FlowRunView` entirely, so there is one home for it
and that home is the landing pane.

The ask is therefore reachable in **one** interaction from a selected Flow
(click the Flow → the pane it opens is the ask), against the audit's count of
three to four from an open project and roughly eleven from landing.

Wiring, all inside WS-A files:

- `live/view-host/canonical-connected-views.tsx` — `AutomationFlowEditorConnectedView`
  now also supplies `projectId` and `authoringFlow` (the top-level Flow from
  `selectAutomationConnectorFlow`, only when no subflow graph is open), and its
  `onActive` loads that Flow's detail when only its summary is cached, so the
  ask can tell whether the Flow is blank and has a model key.
- `flow-editor/components/FlowEditorView.tsx` — a local `FlowEditorViewProps`
  extends `FlowEditorProps` with those two optional fields. `flowEditorHost`
  types itself as `ComponentProps<typeof FlowEditorView>`
  (`views/canonical-view-definitions.tsx:38`), so the host model widened
  automatically and **no file outside WS-A needed a type change**.
- The pane loads its own readiness through `useRuntimeExecutionCommands()`.

`FlowEditorStartPane` falls back to guidance, not a blank box, when the ask
cannot apply: no Flow chosen, readiness failed (with a **Try again** button),
no model key configured (points at Settings), or the Flow already has steps.

### 3. Every "Select a Flow" dead end now says what to do (P8, view side)

`router/RouterContentView.tsx`, `subflows/SubflowsView.tsx`,
`instructions/InstructionWorkbenchPanels.tsx`, `adaptations/AdaptationsView.tsx`,
`clients/ClientGatewayView.tsx`, `inspector/InspectorPanel.tsx`.

Each empty state now names the control that creates the missing thing — the `+`
beside **Flows** at the top of the list, the `+` beside **Subflows**, **New
instruction** — instead of stopping at "Select a Flow". "No clients connected
yet." became a heading plus "Open the FluxIQ browser extension and pair it with
this project."

Four phrases had to be kept verbatim because tests in WS-A's own must-stay-green
set assert them; the new guidance is appended to them rather than replacing
them:

| Kept phrase | Asserted by |
|---|---|
| `Select a Flow to edit its Router` | `router/tests/router-view.test.tsx:18` |
| `Router rules belong to one top-level Flow` | `router/tests/router-view.test.tsx:19` |
| `Router rules send each run to a subflow target.` | `router/tests/router-view.test.tsx:147` |
| `This Flow needs a subflow` | `router/tests/router-view.test.tsx` (same test) |
| `Select a Flow to review adaptations.` | `adaptations/tests/adaptations-view.test.tsx:77`, `large-project-behavior.test.tsx:11` |
| `Select an object to inspect` | `inspector/tests/InspectorView.test.tsx:45`, `large-project-behavior.test.tsx:17` |
| `No subflows yet`, `plus button beside the Subflows folder` | `subflows/tests/subflows-view.test.tsx:41,42` |

So those six strings still carry internal vocabulary in their first sentence.
Removing it needs the assertions updated, in test files WS-A does not own.

### 4. Execution mode is behind "Advanced" with one default (P14)

`runtime/FlowRunView.tsx`. The six-button fieldset was the first control in the
run panel. It is now inside `<details className="automation-runtime-advanced-mode">`
with the summary **Advanced**. What replaces it at the top is one line: the
current mode's name and its description in plain words. The default is
unchanged (`fully_adaptive`), so a first-time person reads "Run it, and let it
fix itself when the page changes. Safe, checked fixes are applied for you." and
presses **Run**.

The six button labels are unchanged on purpose: six tests in `runtime/tests/`
find those buttons by exact direct-child text
(`run-input-interactions.test.tsx:53,58,100`,
`diagnosis-authorization-interactions.test.tsx:74,79,89,122,192`,
`run-permission-request.test.tsx:112,167`), and one of them reads only *direct*
string children, so the label cannot be wrapped in an element either. Renaming
them to §4.3's plain names ("Let it fix itself", "Ask me before changing
anything", "Don't use AI") requires editing those test files.

The `<fieldset className="automation-runtime-mode-control">` and its `> div`
button grid are preserved inside the disclosure so that the grid rule pinned by
`runtime/tests/runtime-layout-contract.test.ts` still applies to the buttons.

### 5. The provider name is gone from user copy (P14)

`runtime/FlowRunView.tsx:396` said "Run one bounded **DeepSeek** diagnosis call;
no patching, retry, promotion, or external side effects." All six mode
descriptions were rewritten in plain English; the new one is "Ask the assistant
once to explain what went wrong. It changes nothing, retries nothing, and
publishes nothing." `grep -n DeepSeek` over every WS-A source file now returns
nothing.

Also rewritten in plain words, none of them asserted by any test: "Readiness
check failed" → "We could not check this automation"; "Complete setup before
running" → "Not ready yet"; "Run Inputs"/"Values passed into this run" →
"Values to use"/"Fill these in before the run starts"; "No run inputs declared"
→ "Nothing to fill in"; "Advanced JSON" → "Raw values"; and the authoring
panel's heading, description, failure messages and cost-confirmation intro.

### 6. The Subflow PIN is masked (P18)

`subflows/SubflowsView.tsx:191` — added `type="password"` and `maxLength={12}`.
`inputMode="numeric"` and the digits-only `onChange` are unchanged.

### 7. `canPause: false` kept

`runtime/FlowRunView.tsx:337` (was :338; one import line was removed above it).
Confirmed by grep. WS-C removes the header button.

### CSS

Appended to `styles/runtime/03-runs-workspace.css` — an existing domain
directory already in the route manifest, so no manifest edit was needed and
`styles/tests/styles-architecture.test.ts` stays green. The file went from 34 to
103 lines, well inside the 700-line cap the same test enforces. New selectors:
`.automation-flow-start-pane`, `.automation-flow-start-intro`,
`.automation-flow-authoring-panel`, `.automation-runtime-mode-summary`,
`.automation-runtime-advanced-mode`.

### One edit outside the WS-A file list

`runtime/index.ts` — added one line:

```ts
export { useRuntimeExecutionCommands, type RuntimeExecutionCommands } from "./runtime-host";
```

Why it was necessary: the landing pane needs the authoring and readiness
commands, which live in `runtime/runtime-host.ts`. `tests/architecture-contract.test.ts:421`
("forbids imports of sibling domain-private modules") counts any import from
`flow-editor` into `runtime/<file>` as a violation with **zero** allowed
residuals; only `runtime` or `runtime/index` is permitted. Adding the export to
the barrel is the sanctioned route.

Why it is safe: it is a pure addition to a barrel; `runtime/index.ts` is claimed
by no workstream in §7 (WS-A owns `runtime/FlowRunView.tsx`, WS-B/C/D own
nothing under `runtime/`), so it cannot collide.

## Commands run and observed results

All run from `F:\!FluxIQ` or `F:\!FluxIQ\apps\web`.

**1. Web package check — `npx tsc --noEmit` in `apps/web`** (this is
`@fluxiq/web`'s `check` script):

```
TSC_EXIT=0
```

No output, exit 0. Run twice: once after the main edits, once after the final
error-handling change.

**2. The WS-A must-stay-green suites** — `flow-editor/tests`, `authoring/tests`,
`router/tests`, `subflows/tests`, `instructions/tests`, `adaptations/tests`,
`clients/tests`, `inspector/tests`, `workspace/tests/layout.test.ts`,
`testing/tests/empty-project-fixture.test.ts`:

```
 Test Files  27 passed (27)
      Tests  140 passed (140)
   Duration  6.46s
```

Two intermediate failures were found and fixed before this run: my rewrite of
the Router empty-state copy dropped `Router rules belong to one top-level Flow`
and `This Flow needs a subflow`, and my Subflows rewrite dropped `plus button
beside the Subflows folder`. All three phrases were restored.

**3. The suites covering everything else I touched** — `runtime/tests`,
`styles/tests`, `live/`, `tests/` (which holds `architecture-contract.test.ts`):

```
 Test Files  36 passed (36)
      Tests  237 passed (237)
   Duration  28.14s
```

**4. Both sets together, after the final edit:**

```
TSC_EXIT=0
 Test Files  63 passed (63)
      Tests  377 passed (377)
   Duration  20.77s
```

**5. Structure audit — `node scripts/structure-audit.mjs`:**

First run found one violation of mine:

```
FAIL  [swallowed-failure] apps/web/src/features/automation-studio/flow-editor/components/FlowEditorView.tsx:
      1 failure is silently dropped, at line 74.
```

My readiness `.catch` did surface the failure in the pane, but it neither bound
the error nor reported on every path — the staleness `if` left one path silent,
and the rule only exempts an `if` that tests the caught error. Fixed properly
rather than with the `best-effort:` marker: the handler now derives the message
from the error and the staleness check moved inside the `setReadiness` updater,
so every path carries it. Re-run:

```
structure-audit: 1 violation(s) across 1 rule(s).
AUDIT_EXIT=1
```

The one remaining violation is **not mine** (see below).

**6. Core's package check — `pnpm -r check` from `F:\!FluxIQ`:**

```
packages/contracts check: Done
packages/client-gateway-websocket check: Done
packages/fluxiq check: src/programs/automation-studio/tests/permission-defaults.test.ts(198,24):
  error TS2322: Type '"router_patch"' is not assignable to type 'AutomationStudioChangeProposalKind'.
packages/fluxiq check: src/programs/automation-studio/tests/permission-defaults.test.ts(230,20):
  error TS2322: Type '"router_patch"' is not assignable to type 'AutomationStudioChangeProposalKind'.
packages/fluxiq check: Failed
CHECK_EXIT=2
```

**This failure is not mine and is not new.** Evidence:

- `git diff --name-only -- packages` lists 15 files; none of them is one I
  edited. My whole diff is under
  `apps/web/src/features/automation-studio/`.
- `permission-defaults.test.ts` itself shows **no** working-tree diff
  (`git diff --stat` on it is empty), so it is at its committed state.
- `AutomationStudioChangeProposalKind` is defined at
  `packages/fluxiq/src/programs/automation-studio/model/flow-adaptation.ts:150`,
  that file is also **not** dirty, and the union there no longer contains
  `"router_patch"`. It was removed by commit `3bca251` ("Insert a learned
  recovery as real nodes, and gate it like one") and this test was left behind.

It is the same file the structure audit's remaining `[imports]` violation names
(`"../runtime/training-modes.ts"` imported past its barrel at line 47) — a
pre-existing Core defect on `dev`, for the supervisor to route.

Because `packages/fluxiq` fails first, `pnpm -r check` never reached
`apps/web`; that is why `npx tsc --noEmit` was run directly in `apps/web`
instead, and it passes.

## Not verified

- **Nothing was run in a browser.** No `pnpm dev`, no extension load, no manual
  panel session. Every claim about what a person now sees is read from the JSX
  and the CSS, not observed.
- **The landing pane's authored path was not exercised end to end.** I did not
  confirm in a live project that `authoringFlow` resolves to a loaded (not
  summary-only) Flow in time for `blankFlowExplorationRequest` to return `ok`.
  If the top-level Flow's detail has not arrived, the pane shows the "One
  setting to go" guidance for a moment before the ask appears. The extra
  `loadFlowDetail` in `onActive` is there to close that window, but its timing
  is unverified.
- **The new CSS was not seen rendered**, at any width. `.automation-flow-start-pane`
  is `max-width: 760px` centred; how it reads in the broken 821–1100px band
  (P11, WS-D's) is unknown.
- **Moving the ask off Runtime Debug is a behaviour change I could not test
  live.** Anyone who learned to find the instruction box on the Runtime Debug
  tab will no longer find it there.
- `pnpm test` for the whole web package was not run — only the automation-studio
  directories listed above. Other workers were editing `settings/`, `views/`,
  `workspace/`, `hierarchy/`, `conversation/` and Core concurrently, so a full
  run would have mixed their in-flight state into my result.
- The two Core failures are attributed by diff and by commit history, not by
  checking out a clean tree and re-running.

## Open questions or contradictions found

1. **The brief asks for a create button that WS-A cannot build.** Priority 3
   says "Give every 'Select a Flow' empty state a create button rather than a
   dead end." None of the six views can: the commands each one receives are
   fixed in `live/view-host/useAutomationConnectorCommands.ts:66-105`, and they
   are `onCreateSubflow` (router, and it needs a Flow to already exist),
   `onOpenSubflow` (subflows), `onSelectedAdaptationChange` (adaptations),
   `onOpenState` (inspector), and nothing at all for instructions and clients.
   There is no module-level create dispatcher to call either — `hierarchy/dialog-store.ts`
   is instantiated per session, and `workspace/studio-action-registry.ts` carries
   only graph and runtime actions. A working **Create automation** button needs
   `live/view-host/useAutomationConnectorCommands.ts` (unowned by any
   workstream) and `live/components/AutomationStudioSession.tsx` (WS-D), which
   already holds `hierarchyBridge.createSubflow` at line 527. **Recommend
   assigning that one wiring change to WS-D** and having WS-A's empty states
   adopt the button afterwards; it is one command threaded to six views.

2. **Renaming the authoring panel's field and button needs a test file nobody
   owns.** §4.3 proposes "Website task" → "What should this do?" and "Explore
   and create proposal" → "Try it and show me a draft". Both are pinned by
   `authoring/tests/blank-flow-authoring.test.tsx`, which finds the textarea by
   `aria-label="Website task"` (10 call sites) and the button by exact text (11
   call sites). WS-A's instruction is that `authoring/tests/` "must stay green",
   with none of the "expect to update fixtures" allowance WS-B was given, so I
   left both alone and reworded everything around them. **The heading did
   change** — the panel is now titled "Tell FluxIQ what to automate" — so the
   surface reads like the primary job even though the field label does not yet.
   This needs a one-line decision: may WS-A update that test file?

3. **Same shape for the six execution-mode labels** (section 4 above) and for
   the six empty-state phrases in the table in section 3. All are blocked on
   test assertions, not on code.

4. **`runtime/index.ts` is unowned.** §7 gives WS-A `runtime/FlowRunView.tsx`
   but no workstream owns the directory's barrel, which any cross-domain use of
   runtime code has to go through. Worth naming an owner before another
   workstream needs it.

5. **`workspace/layout/defaults.ts` was listed to me but not changed.** Changing
   the default tab away from `flowEditor` would break
   `workspace/tests/layout.test.ts:52`, which asserts
   `panes` equals `[{ id: "pane-main-1", activeViewId: "flow-nodes", tabs: ["flow-nodes"] }]`
   — and that file is in my must-stay-green list. Fixing the blank pane in the
   view itself was the better repair anyway: it holds however the default
   changes later, and it also fixes every *other* route into an empty Nodes pane,
   not just the first load.
