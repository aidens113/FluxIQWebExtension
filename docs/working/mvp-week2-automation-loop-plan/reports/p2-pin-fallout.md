# P2 — PIN fallout: two reclassifications and the web caller repair

Repository: `F:\!FluxIQ` (Core), branch `dev`. Nothing committed, nothing pushed,
no working document edited.

## Outcome

Done. Both supervisor decisions are implemented, tested and documented.

- The two hierarchy endpoints are `authoring`. The autosave path that fires
  while the user drags items around the workspace no longer hits a PIN gate.
- `delete-run-datasets` keeps its PIN, and the Data window now collects one
  through the existing `AuthorizationDialog` instead of posting without it.

I edited one file beyond the brief's list:
`packages/fluxiq/src/programs/automation-studio/api/handlers/tests/projects.test.ts`.
It asserted the old `destructive` classification for
`delete-project-hierarchy-node` and passed a PIN to it, so it would have gone
red. It sits in the `tests/` folder of the handler file I own, not in
`_shared/**`, not in `AS/runtime/**`, and not in another program's api
directory, so I judged it inside the boundary rather than stopping. Flagging it
here in case that judgement was wrong.

## What changed and why

### 1. Both hierarchy endpoints are `authoring`

`packages/fluxiq/src/programs/automation-studio/api/handlers/projects.ts`

`save-project-hierarchy` and `delete-project-hierarchy-node` moved from
`destructive` to `authoring`, with a nine-line comment above the pair recording
*why*, so the next reader who sees the word "delete" does not flip it back.

I confirmed the supervisor's reasoning against the code rather than taking it
on trust. `AutomationStudioService.deleteProjectHierarchyNode`
(`runtime/service.ts:4972`, read-only for me) reads the hierarchy, walks
`customHierarchyNodes` to collect the target and its descendants, writes back
through `saveProjectHierarchy` with those ids removed from
`customHierarchyNodes` and added to `deletedHierarchyIds`, and returns a count.
It touches nothing else. `saveProjectHierarchy` itself is a one-line delegate to
`projectArtifacts.saveProjectHierarchy`, which persists
`customHierarchyNodes` / `deletedHierarchyIds` / `workspacePrefs`. No Flow,
recording, project, dataset or artifact is reachable from either. What a delete
removes is the filing; the user's work survives and becomes unfiled.

### 2. The classification test

`packages/fluxiq/src/programs/tests/endpoint-classification.test.ts`

- The two endpoints are out of `PIN_GATED`, which now pins **thirteen**
  destructive endpoints. The suite asserts set equality, so this is not a
  weakened test: adding either one back fails
  `gates exactly the endpoints that remove persisted data or act irreversibly outside`.
- New test `keeps workspace filing un-gated, so rearranging the workspace never
  raises a prompt`, pinning all three hierarchy endpoints (`save`, `put`,
  `delete`) as `authoring`, with the reasoning in a comment above it. Without
  this, removing the two names from a list would have left the new position
  unasserted, and the next classification edit would pass silently.

### 3. The handler test

`packages/fluxiq/src/programs/automation-studio/api/handlers/tests/projects.test.ts`

The delete call no longer sends `authSessionId` / `authorizationPin`, and the
assertion became `expect(authorizeSessionPin).not.toHaveBeenCalled()`. The
registry in that test is built *with* a stub Identity Access, so "no PIN was
taken" is a real assertion rather than an artefact of there being nothing to
take it with. The test still proves the delete cascades to descendants and
leaves the sibling alone.

### 4. The Data window collects a PIN

`apps/web/src/features/automation-studio/datasets/dataset-commands.ts`

`authorizationPin: string` is now **required** on `deleteRunDatasets` and on
`RunDatasetCommands.remove`. Required, not optional, is the point: a caller that
forgets it is a compile error rather than a runtime refusal, which is the class
of bug this whole task exists to clean up. `runtime-host.ts` binds the command
through a contextually typed lambda and needed no edit.

`apps/web/src/features/automation-studio/datasets/RunDatasetsPanel.tsx`

The inline `Confirm delete` / `Cancel` pair is replaced by `AuthorizationDialog`
from `../../programs/shared-ui` with `requirements={{ pin: true }}` — the same
component `ClientGatewayView` uses for revoke / start-recording / execute-action,
so nothing new was invented. `Delete` opens it; the primary action stays
disabled until the PIN is at least four digits (the dialog's own rule); on
authorize the panel posts `authorizationPin` with the payload. The route stamps
`authSessionId` itself for `automation-studio`
(`apps/web/src/lib/program-route.ts`), so the PIN is the only credential the
panel supplies.

Two behaviours worth naming:

- **A refusal keeps the prompt open and clears the PIN.** A mistyped PIN costs
  one retry instead of a dismissed dialog and a message with no way back. The
  server's own text is shown in the dialog's error slot.
- **The PIN is never held past the request.** `closeDeletePrompt()` drops it on
  cancel, on success, and when the selected dataset or run changes; the failure
  path clears it too. It is in component state only, never logged.

### 5. Documentation

`docs/architecture/automation-studio/persistence.md`

- The destructive list is now thirteen, with `delete-project-hierarchy-node` and
  `save-project-hierarchy` removed, plus a pointer to the test that pins it.
- New subsection **"The workspace hierarchy is filing, not data"** giving the
  reason in full: what the endpoints actually write, the autosave argument
  (a prompt during routine work trains reflexive PIN entry, which weakens it
  everywhere), and the bypass argument (the granular delete can remove the same
  nodes one at a time, so the two must move together). It closes by contrasting
  this with deleting a project, category, artifact or recording, which stay
  `destructive` because they remove the content itself.
- A new paragraph naming `AuthorizationDialog` as the panel-side collector for
  gated endpoints, and stating that a caller without `authorizationPin` gets
  `{ ok: false, error: "PIN is required for this action" }` and the handler
  never runs.

## Commands run and observed results

All from `F:\!FluxIQ` unless noted. **The working tree moved under me during
this task** — other workers committed and edited `AS/runtime/**`,
`identity-access/**` and `_shared/**` files while I ran. Where that affected a
result I ran the check again and recorded both observations.

1. `pnpm --filter fluxiq check` (`tsc --noEmit`) → **no diagnostics, exit 0.**

   An intermediate run of the same command failed with two errors in
   `src/programs/automation-studio/tests/opaque-target-execution.test.ts`
   (`TS2724 '"../runtime/index.ts"' has no exported member named
   'AutomationStudioHostRuntimeBoundary'` and `TS7006`). That file is another
   worker's, was uncommitted and mid-edit, and I never touched it; the next run
   was clean.

2. `npx vitest run src/programs/tests/endpoint-classification.test.ts
   src/programs/automation-studio/api/handlers/tests/projects.test.ts`
   (in `packages/fluxiq`) →
   **`Test Files 2 passed (2)`, `Tests 10 passed (10)`.**
   The classification suite is now 7 tests; its set-equality assertion passing
   is the proof that exactly thirteen endpoints are `destructive`.

3. `npx vitest run src/programs/tests src/programs/automation-studio/api`
   (wider sweep for collateral) → `Test Files 2 failed | 23 passed (25)`,
   `Tests 2 failed | 91 passed (93)`. Both failures were `Test timed out in
   15000ms`, no assertion diffs:
   - `api/handlers/tests/runs.test.ts > exports a real run's audit ...` — alone:
     **`Test Files 1 passed (1)`, `Tests 4 passed (4)`**, the test itself 3.9s.
   - `programs/tests/global-docs.test.ts > generates a TypeDoc-backed framework
     reference` — alone, first attempt still timed out (16.1s of test against a
     15s budget); alone a second time **passed in 11.2s**,
     `Tests 6 passed (6)`. This is the TypeDoc-under-load flake P already
     recorded, made worse by other workers running concurrently. It is not
     mine: I changed two classification values, which the generator prints but
     does not compute.

4. `pnpm --filter @fluxiq/web check` (`tsc --noEmit`) → **no diagnostics,
   exit 0**, run after every web edit including the test.

5. `npx vitest run src/features/automation-studio/datasets` (in `apps/web`) →
   **`Test Files 3 passed (3)`, `Tests 13 passed (13)`.** Two of those are new
   or rewritten:
   - `deletes a table only after the operator supplies a PIN` — asserts the
     confirm button alone cannot send the request (the dialog's action is
     `disabled` with no PIN), then that entering one posts
     `{ projectId, runId, datasetId, authorizationPin: "123456" }`.
   - `keeps the prompt open and clears the PIN when the server refuses it` —
     asserts the server's message renders, the input is back to `""`, and the
     action is disabled again.

   The test stubs `programs/components/overlays/Modal`, because `Modal`
   portals into `document.body` and these tests run without a DOM. That is the
   idiom `runtime/tests/diagnosis-authorization-interactions.test.tsx` already
   uses; I had to stub the module rather than the `shared-ui` barrel, because
   `AuthorizationDialog` imports `./Modal` directly. The dialog, its `Field` and
   its `Button` are the real components, so the assertions are against the real
   prompt.

6. `pnpm --filter @fluxiq/web test` (whole app) →
   `Test Files 1 failed | 236 passed (237)`, `Tests 2 failed | 1214 passed
   (1216)`. Both failures in `src/app/api/auth/login/tests/route.test.ts`
   (login attempt bounds), one of them taking 29.3s. Alone:
   **`Test Files 1 passed (1)`, `Tests 8 passed (8)` in 5.7s**, the slowest
   test 2.1s against 29.3s under load. Load flake, unrelated to datasets.

7. `node scripts/structure-audit.mjs` →
   **`structure-audit: passed (137 warning(s), 256 baselined).`, exit 0.**

   An earlier run of the same command reported
   `structure-audit: 2 violation(s) across 1 rule(s)` — `[imports]` in
   `_shared/tests/api.test.ts` and `automation-studio/tests/
   opaque-target-execution.test.ts`. `git diff HEAD --stat` showed both files
   had uncommitted edits at that moment (2 and 6 changed lines) that were not
   mine; a later run was clean. It also still prints
   `1 baseline entries can be lowered`, which P attributed to
   `AS/runtime/service.ts`. `.structure-baseline.json` is untouched.

8. `node scripts/validate-docs.mjs` →
   `Validated local links in 134 authored/reference Markdown files.`

## Not verified

- **No live browser validation.** Nothing was clicked in a running panel. That
  the Data window's delete now succeeds end to end is inferred from the payload
  shape the registry requires and the panel's unit tests, not observed. The two
  things a browser would add that tests cannot: that the modal renders correctly
  over the Runtime Debug panel (the tests stub `Modal`, so its real portal and
  styling are unexercised), and that a genuinely correct PIN is accepted by a
  live Identity Access session.
- **The hierarchy autosave path was not exercised live either.** I did not
  drag anything in a workspace to confirm the prompt is gone. The claim rests on
  the classification value, the registry's single check, and
  `endpoint-classification.test.ts`.
- I did not run `pnpm check` (the repo-wide form), `pnpm test` at the root,
  `pnpm build`, or the Core suite in full. I ran the two package type checks,
  the structure audit, the full `apps/web` suite, and the Core slices covering
  what I changed.
- I did not regenerate `.fluxiq/cache/docs/programs/api-map.md`; the generated
  Classification column still shows the old values for the two hierarchy
  endpoints until something rebuilds it. That directory is generated output.
- I did not check the downstream web-extension repository. My change only
  *removes* two gates, so nothing that worked can have broken; P already
  verified nothing downstream calls `delete-run-datasets`.

## Open questions and contradictions found

1. **`AuthorizationDialog` is reached through `shared-ui`, but its `Modal` is
   not.** Testing anything built on the dialog means stubbing the deep module
   `programs/components/overlays/Modal`, because the dialog imports `./Modal`
   directly while the rest of the app imports through the barrel. Cheap fix if
   it recurs: have `AuthorizationDialog` accept a rendered shell, or give the
   dialog a DOM-less fallback the way `Modal` already returns `null` without a
   `document`.
2. **Other Data-window-adjacent PIN prompts are now pointless.** P noted that
   `clients/` still collects a PIN for `revoke-client-trust`,
   `start-client-recording` and `stop-client-recording`, all now `authoring`.
   Still true; outside my files. The field is ignored, so this is dead UI, not a
   defect.
3. **The `authoring` label is now carrying two different meanings.** It covers
   "creates or edits user content", "withdraws access", and now "rearranges how
   content is filed". All three are correctly un-gated, but if a fourth kind
   arrives the word will stop explaining itself. A `filing` value is not worth
   adding today; the doc subsection is the cheaper answer.
4. **`registerAutomationStudioApi`'s dead `identityAccess` parameter** is still
   there, as P reported. Unchanged by me.

No PIN, token, session value or recorded data appears in this report, in the
code, or in the tests; the tests use dummy digits only, and the panel never
logs the PIN or keeps it after the request.
