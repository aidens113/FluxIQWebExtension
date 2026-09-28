# WS-C — Authorization friction and destructive-control safety

Covers P4, P6, P12 (header half), P13, P18 (not mine — see below), P22, P23.
All paths are under `F:\!FluxIQ\apps\web\src\features\automation-studio\`
unless stated otherwise.

## Outcome

**Done.** The twelve PIN prompts are down to three, all of them deletes. The
dead Pause button is gone, Play is honest, Discard is destructive-looking and
separated, "Reset workspace layout" confirms, a clean Ctrl+S answers, runtime
actions resolve by `active()`, and the four dead overlay files and their
contract types are deleted. A test now fails the build if any routine action
re-acquires a prompt.

Two pre-existing test failures and three structure-audit violations remain in
the tree. **None of them are in files I own** — they belong to WS-A and WS-D,
who were editing concurrently. Detail at the end.

## The finding that made the removals safe

Before removing anything I traced the PIN to the server, because removing a
client gate that the server enforces would have broken saving outright.

`F:\!FluxIQ\packages\fluxiq\src\programs\_shared\api.ts:118-127` —
`GlobalProgramApiRegistry.call` runs `authorizeProgramPin` for **one** reason:

```ts
if (registration.classification === "destructive") {
  await authorizeProgramPin(this.identityAccess, pinAuthorizationPayload(request.payload));
}
```

Every endpoint the panel's twelve prompts sat in front of — `create-project`,
`update-project`, `create-flow`, `save-flow`, `update-flow-settings`,
`save-flow-instruction`, `update-flow-subflow`, `enable/disable/archive-flow-subflow`,
`create-recording-flow-proposals`, `review-recording-flow-proposal`,
`update-recording`, `append-recording-note`, `append-recording-marker`,
`finalize-recording` — is registered `classification: "authoring"`. The server
never looked at the PIN for any of them.

So the prompts were pure panel-side ceremony. They bought no safety at all; they
only stood between a person and the work they had asked for. FluxIQ Core already
draws the product owner's line — only `destructive` endpoints ask — and the
panel was the side that had drifted.

The genuinely destructive automation-studio endpoints are: `delete-flow`,
`delete-flow-subflow`, `delete-flow-map-route-group`, `delete-project`,
`delete-project-artifact`, `delete-project-category`, `delete-proposal`,
`delete-recording`, `delete-recordings`, `delete-run-datasets`,
`execute-client-action`, `rollback-flow-migration`, `seal-legacy-writes`.

## What changed and why

### 1. Twelve prompts to three (P4, P6)

| Surface | File | Before | After |
|---|---|---|---|
| Save Project / Ctrl+S | `workspace/shell/WorkspaceHeader.tsx` | PIN modal | saves, then says so |
| Unsaved-changes guard | `workspace/DirtyViewGuard.tsx` | PIN field | Save / Cancel / Discard |
| Create Flow / Subflow / Folder | `hierarchy/AutomationHierarchyDialog.tsx` | PIN field | name + location only |
| Create / rename / move project or category | `hierarchy/ProjectModal.tsx` | PIN, disabled without one | no PIN |
| Save Flow settings | `settings/FlowSettingsView.tsx` | "Authorize and Save" modal | Save Settings saves |
| Save Subflow settings | `settings/SubflowSettingsView.tsx` | "Authorize and Save" modal | Save saves |
| Save instruction | `instructions/InstructionsView.tsx` | "Authorize Instruction Save" modal | Save saves |
| Generate deterministic Subflow | `recordings/RecordingTimelineView.tsx` | PIN field | destination Flow only |
| Rename / note / marker / finalize recording | `recordings/RecordingActionDialog.tsx` + `useRecordingActionController.ts` | PIN for all five kinds | PIN for delete only |
| Save node graph | `live/hooks/useAutomationSessionDirtyGuards.ts` | threw "A security PIN is required to save the graph." | saves |
| Dead create/delete overlay | `workspace/overlays/HierarchyCreateOverlaySurface.tsx` | PIN field | file deleted |

**Still asking, correctly:** deleting a project or category
(`hierarchy/ProjectModal.tsx`), deleting a Flow / Subflow / folder
(`hierarchy/AutomationHierarchyDialog.tsx`), deleting a recording
(`recordings/RecordingActionDialog.tsx`). Three prompts, all deletes, all
matching an endpoint Core registers `destructive`.

The gates were **removed**, not reconfigured: the state, the modal JSX, the
`pin.length < 4` submit guards and the "Authorize and…" button labels are gone
from those files rather than defaulted to off. Where a command's wire shape
still carries `authorizationPin`, the panel passes `""` — that is plumbing the
server ignores on an authoring endpoint, not a prompt, and the enforcement test
deliberately matches the labelled field rather than the wire field for exactly
that reason.

`hierarchy/dialog-transaction.ts` now requires a PIN only when
`transaction.kind === "delete"`; the error text moved from "Enter your PIN
before changing hierarchy items." to "Enter your PIN before deleting this item."

### 2. "PIN not configured" is no longer a dead end (P4)

New module `authorization/`:

- `action-consequence.ts` — `AutomationStudioActionConsequence`:
  `"routine" | "delete" | "checkout" | "payment"`.
- `authorization-policy.ts` — `AUTOMATION_STUDIO_PIN_GATED_CONSEQUENCES`
  (`delete`, `checkout`, `payment`) and `automationStudioActionRequiresPin`,
  with the Core cross-reference in the doc comment.
- `PinRequirementNotice.tsx` — `AutomationPinRequirementNotice`, an
  `InlineNotice` carrying a **"Set up a PIN"** link to
  `/programs/identity-access` (the href `AuthShell.tsx:20` uses).
- `index.ts` barrel, `tests/authorization-policy.test.ts`.

`hierarchy/ProjectModal.tsx` previously disabled submit behind the sentence
"Configure a security PIN in Identity and Access…" with no way to get there.
Now creation does not ask at all, and the delete path renders the notice with
the link. `hierarchy/AutomationHierarchyDialog.tsx` and
`recordings/RecordingActionDialog.tsx` carry the same link inline under their
PIN field.

**One gap, deliberately not closed:** `AutomationHierarchyDialog` has no
`pinConfigured` signal available — `live/components/AutomationStudioConnectedRegions.tsx`
does not receive `currentUser`, and threading it would have meant editing three
files no workstream owns. It shows the link unconditionally instead of a
conditional "PIN not configured" notice. The audit names the dead end only at
`ProjectModal.tsx:80-81`, which is fully fixed.

### 3. Discard, reset and Ctrl+S (P13, P23)

- `workspace/DirtyViewGuard.tsx`: Discard is `variant="danger"` (`.button-danger`),
  relabelled "Discard changes", and pushed to the opposite end of the action row
  with `style={{ marginRight: "auto" }}` — `.modal-actions` is
  `display:flex; justify-content:flex-end`, so this separates it with no new CSS.
  Order is now Discard … Cancel, Save.
- `workspace/components/workspace-preferences.tsx`: "Reset workspace layout" is
  a two-step confirm. First click arms it; the status line becomes "Reset closes
  every open tab, undoes every pane split, and restores the default sizes." and
  the footer offers "Keep my layout" / "Reset it anyway" (danger). No new CSS.
- `workspace/shell/WorkspaceHeader.tsx`: Ctrl+S on a clean workspace now says
  "Everything in this project is already saved."; a real save says "Saved N
  editors."; a failure says why. It uses `notifyGlobalAlert`, which
  `app/layout.tsx` already mounts app-wide through `GlobalAlertViewport` — again
  no new CSS, and no new file in `styles/`.

### 4. Pause removed, Play honest (P12, header half)

`workspace/shell/WorkspaceHeader.tsx`: the Pause button is deleted along with
its `Pause` import. It could never enable — the only registrar
(`runtime/FlowRunView.tsx:338,341`, WS-A's file, untouched) sets
`canPause: false` and `pause: () => undefined` unconditionally.

Play was enabled when `actions.runtime` was `null`, because
`undefined === false` is `false`; clicking it then opened a view instead of
starting anything. Now:

```tsx
const runtimeMounted = Boolean(actions.runtime);
const playLabel = runtimeMounted ? "Play automation" : "Open the run panel";
disabled={runtimeMounted && actions.runtime?.canPlay !== true}
```

Disabled exactly when a mounted run panel says it cannot play; when none is
mounted it says what it will really do.

### 5. Runtime actions resolve by `active()` (P12)

`workspace/studio-action-registry.ts` replaced `latest(runtimeActions)` with
`activeRuntimeActions()`, used by both `invokeAutomationStudioRuntimeAction` and
`publish()`. `AutomationStudioRuntimeActions.active?()` is **optional** so that
`runtime/FlowRunView.tsx` — WS-A's file, which I must not edit — still
type-checks; a registrar that reports no activity is treated as active, so a
single mounted panel still answers the header.

**This is half a fix and I want to be explicit about it.** The registry now
prefers the active panel, but nothing supplies `active()` yet, so with two
Runtime Debug tabs open the header still falls back to the newest registration.
Completing it is one line in `runtime/FlowRunView.tsx:336` —
`active: () => <the view's activeRef>.current` beside the existing
`canPlay` — mirroring `flow-editor/components/FlowGraphCanvas.tsx:80`. That file
belongs to WS-A.

### 6. Dead overlays deleted (P22)

Removed: `HierarchyCreateOverlaySurface.tsx`, `HierarchyDeleteOverlaySurface.tsx`,
`ProjectOverlaySubscriber.tsx`, `HierarchyActionOverlaySubscriber.tsx`, and
`hierarchy-overlay-model.ts` (dead once the four above went).

Now-unused contract types removed from `workspace/overlays/contracts.ts`:
`ProjectOverlayTarget`, `ProjectCategoryOverlayTarget`, `ProjectOverlayRequest`,
`ProjectOverlayCommand`, `HierarchyItemKind`, `HierarchyFolderOption`,
`HierarchyFolderOptionSource`, `HierarchyOverlayRequest`,
`HierarchyOverlayCommand`, `FlowOrigin`, and the `project` / `hierarchy` slots of
`AutomationStudioOverlayState`.

Consequential edits, all inside `workspace/overlays/` except the last:
`index.ts` (re-exports), `overlay-state-store.ts`
(`defaultAutomationStudioOverlayState`), `root-adoption.ts` (two channels and
two adoption-map entries; the adoption step about hierarchy folder sources went
with them), `AutomationStudioOverlays.tsx` (two dispatchers, two subscribers, the
`pinConfigured` binding), and one line in
`live/components/AutomationStudioWorkspaceComposition.tsx:167` that passed
`pinConfigured` to the deleted subscriber. `props.currentUser` is now unused in
that component; I left the prop declared because removing it would reach into
`live/components/AutomationStudioSession.tsx`, which is WS-D's.

`overlay-command-models.test.ts` was deleted — both its subjects are gone.
`overlay-architecture.test.ts`, `overlay-hardening.test.ts` and
`overlay-state-store.test.ts` were updated, and `overlay-architecture.test.ts`
gained a test that fails if any of the five files comes back.

### 7. Mechanical enforcement

`authorization/tests/authorization-policy.test.ts` — four tests:

1. the policy gates exactly `delete`, `checkout`, `payment`;
2. **no file in the whole `automation-studio` tree may hold an authorization
   prompt unless it is in `AUTHORIZATION_PROMPT_BUDGET`** — a new prompt
   anywhere fails the build with a message naming the rule;
3. no budgeted file may grow another prompt (counts may only fall);
4. the six surfaces this repair cleaned are pinned at zero.

The prompt pattern matches the labelled PIN field
(`/label=(?:"(?:Security )?PIN"|\{`?(?:Security )?PIN)/`), not the wire field,
because `authorizationPin: ""` on a command is harmless plumbing while a PIN box
in front of a person is the defect. It currently finds six real prompts across
the tree, so the test is not vacuous.

The budget is a ratchet with two groups:

- **Destructive, permanent:** `hierarchy/ProjectModal.tsx`,
  `hierarchy/AutomationHierarchyDialog.tsx`, `recordings/RecordingActionDialog.tsx`.
- **Not yet converted, owned by WS-A:** `subflows/SubflowsView.tsx` (P6/P18),
  `router/RouterContentView.tsx`, `adaptations/AdaptationsView.tsx`. Each gates
  ordinary editing and must reach 0. They are commented as such in the file.

`workspace/tests/routine-actions-never-authorize.test.tsx` adds five rendered /
source assertions: the header saves with no PIN and no password input; no "Pause
automation" control and Play labelled "Open the run panel" when nothing is
mounted; the guard has no PIN, Discard carries `variant="danger"` and precedes
Cancel; the reset confirms.

### Files I touched outside the WS-C list, and why

| File | Reason |
|---|---|
| `recordings/RecordingActionDialog.tsx`, `recordings/useRecordingActionController.ts` | Four routine recording actions asked for a PIN. Unowned by any workstream (`recordings/RecordingTimelineView.tsx` is mine; these two siblings are in nobody's list) and they would have failed the new enforcement test. |
| `live/hooks/useAutomationSessionDirtyGuards.ts` | Threw "A security PIN is required to save the graph." the moment the registry stopped carrying one. Unowned. |
| `live/components/AutomationStudioWorkspaceComposition.tsx` | One line: the `pinConfigured` prop of a deleted subscriber. Unowned. |
| `live/view-host/tests/phase3-mounted-render-stability.test.tsx` | Used the deleted `hierarchy` overlay channel; repointed to `viewAdder`, which tests the same render-stability property. |
| `workspace/overlays/index.ts`, `overlay-state-store.ts`, `root-adoption.ts` | Consequential to deleting the contract types; inside my directory, and the audit forbids other workstreams from touching `workspace/overlays/`. |
| `tests/architecture-contract.test.ts` | Its closed top-level taxonomy needed `"authorization"`. |
| `flow-editor/tests/communication-boundary.test.ts` | Asserted `callbacks.current.save(authorizationPin)` and `saveDirtyAutomationViews(savePin)`; now asserts the no-PIN forms and that neither file contains "Security PIN". |
| Test fixtures in `hierarchy/tests/`, `settings/tests/`, `instructions/tests/`, `workspace/tests/` | Encoded the removed prompts. |

## Commands run and observed results

```
$ cd F:\!FluxIQ\apps\web && npx tsc --noEmit
tsc exit=0                                   # no output
```

```
$ cd F:\!FluxIQ\apps\web && npx vitest run
 FAIL  src/features/automation-studio/views/tests/canonical-diagnostics-disclosure.test.ts
       > enforces the runtime-debug diagnostics contract
       AssertionError: expected '"use client";\n\nimport { DataTable, …' to contain 'Advanced JSON'
 FAIL  src/features/automation-studio/views/tests/GraphEditorViews.test.ts
       > keeps active-tab changes behind the Flow editor render boundary
       AssertionError: expected '"use client";\n\nimport { lazy, memo,…' to contain 'aria-label="Opening node editor"'
 Test Files  2 failed | 254 passed (256)
      Tests  2 failed | 1420 passed (1422)
```

```
$ cd F:\!FluxIQ && node scripts/structure-audit.mjs
  FAIL  [imports] apps/web/.../workspace/commands/pane-layout.ts: 1 import(s) reach into
        another directory's files instead of its barrel, e.g. "../../views/view-registry" at line 11.
  FAIL  [imports] apps/web/.../workspace/commands/preview-tabs.ts: ... at line 17.
  FAIL  [imports] apps/web/.../workspace/commands/tests/preview-tabs.test.ts: ... at line 12.
structure-audit: 3 violation(s) across 1 rule(s).
```

Every suite the WS-C section names is green:

```
$ npx vitest run src/features/automation-studio/{workspace,hierarchy,settings,instructions,recordings,authorization}
 Test Files  46 passed (47)   # earlier run; the one failure was workspace/shell/tests/shell.test.tsx,
                              # WS-D's 345-line workspace-commands.ts, and WS-D has since fixed it
```

Final state of those suites, confirmed inside the full run above: `workspace/tests/`,
`workspace/overlays/tests/`, `workspace/shell/tests/shell.test.tsx`,
`hierarchy/tests/command-executor.test.ts`, `hierarchy/tests/ProjectModal.test.ts`,
`settings/tests/`, `instructions/tests/`, `recordings/tests/` — all passing.

### Failures that are not mine

I did not fix these, per the brief.

1. **`views/tests/canonical-diagnostics-disclosure.test.ts`** — asserts
   `runtime/FlowRunView.tsx` contains `"Advanced JSON"`. WS-A's scope removes
   the Run-panel JSON disclosure; `git diff --stat` shows 47 changed lines in
   that file, none of them mine. The test file is WS-B's.
2. **`views/tests/GraphEditorViews.test.ts`** — asserts
   `flow-editor/components/FlowEditorView.tsx` contains
   `aria-label="Opening node editor"`. That is exactly the blank-pane `<div>`
   P1 told WS-A to remove; 111 changed lines in that file, none mine.
3. **Three structure-audit `[imports]` violations** — all in
   `workspace/commands/`, which is WS-D's file set. `preview-tabs.ts` and
   `pane-layout.ts` are new files from WS-D's preview work importing
   `../../views/view-registry` directly instead of the `views` barrel.
4. Earlier in the session I also observed
   `workspace/shell/tests/shell.test.tsx` failing on
   `workspace-commands.ts: expected 345 to be less than or equal to 300`, and
   four failures in WS-D's own new `workspace/commands/tests/preview-tabs.test.ts`
   (`expected [ 'flow-nodes', 'timeline-recording' ] to include 'client-gateway'`).
   Both had cleared by the final run — WS-D was editing live.

## Not verified

- **Nothing was run in a browser.** No build, no live panel session. Every claim
  about what a person sees is from source, from `renderToStaticMarkup`, or from
  the CSS declarations — not from a rendered page. The header's global-alert
  feedback in particular (Ctrl+S on a clean workspace) is asserted only by the
  code path, since `notifyGlobalAlert` dispatches a `window` event that
  `GlobalAlertViewport` renders elsewhere.
- **`pnpm check` and `pnpm build` were not run.** I ran the web package's own
  check (`tsc --noEmit`) and the repository structure audit. The full `pnpm check`
  also runs `structure:test`, `task:test` and the Core package's `check`, which I
  did not exercise; nothing I changed is in `packages/fluxiq`.
- **The server-side claim is read, not exercised.** I traced
  `classification: "destructive"` through `_shared/api.ts` and the handler
  registrations, and did not run a request against a live server to confirm an
  authoring endpoint accepts `authorizationPin: ""`. If any of those endpoints is
  re-registered `destructive` later, the corresponding save will start failing
  with "PIN is required for this action" and the panel will show that error
  rather than a prompt.
- **The `active()` fix is half-complete** — see section 5. The registry prefers
  an active run panel; no panel declares one yet.
- **`AutomationHierarchyDialog` cannot tell whether a PIN is configured** — see
  section 2. It links unconditionally instead.
- I did not check whether `execute-client-action` (a `destructive` endpoint) has
  a panel-side prompt anywhere; it is not among the twelve and no file in my set
  calls it.

## Open questions and contradictions found

1. **The audit assigns P18 to WS-A but the rule assigns the file to me.**
   `subflows/SubflowsView.tsx:191` shows the PIN in clear text *and* asks for it
   on rename, duplicate, archive, disable and enable — five routine actions.
   WS-A's one-line instruction is to add `type="password"`, which hardens a
   prompt that should not exist. Recommendation: WS-A deletes the field for the
   five routine actions and keeps it only for `delete` (Core registers
   `delete-flow-subflow` `destructive`), then removes the file from
   `AUTHORIZATION_PROMPT_BUDGET`. Same for `router/RouterContentView.tsx:270`
   (Router saves reach `save-flow-map`, authoring) and
   `adaptations/AdaptationsView.tsx:314`.
2. **The budget entries will fail the build when WS-A lands, and that is
   intended.** The three `pending` entries use `<=`, so removing a prompt passes;
   but leaving a stale entry costs nothing and hides the win. Whoever integrates
   WS-A should delete those three lines.
3. **`runtime/FlowRunView.tsx` needs one line to finish P12.** Stated in section
   5. It is a cross-workstream contract the audit did not anticipate: contract 1
   only says WS-A keeps `canPause: false`.
4. **`AutomationStudioWorkspaceComposition` now takes a `currentUser` it does not
   use.** Removing the prop reaches `live/components/AutomationStudioSession.tsx`
   (WS-D). Worth one line of cleanup at integration.
5. **`recordings/RecordingActionDialog.tsx` and `useRecordingActionController.ts`
   were in no workstream's file list**, and neither was
   `live/hooks/useAutomationSessionDirtyGuards.ts`. The partition in section 7 of
   the audit is not a cover of the files the change actually reaches; the PIN
   plumbing runs through the dirty-view registry into `live/hooks/`.
