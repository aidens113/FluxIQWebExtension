# PANEL-003 Browser Autofill Semantics

Status: Implemented and live-validated in isolated t027-storage pair
Date: 2026-09-20
Worker: `w2-panel-autofill`

## Outcome

The real Automation Studio Create Project and Add Flow dialogs no longer
present their ordinary text fields and numeric security PINs as unnamed,
default-autocomplete credential candidates. Every affected field now has an
explicit feature-specific name and `autocomplete="off"`. The real login form
is unchanged and retains standards-correct `username` and `current-password`
semantics for password managers.

The change is uncommitted for supervisor review. It shares the isolated Core
worktree with the already completed runtime-initialization diff but touches
only disjoint hierarchy UI files and their owned test.

## Live reproduction first

Environment:

- Core frozen base: `ef7892fc50b19667400c4fcb6be82f2e826e6fc0`
- Downstream frozen base: `0fd9d0d2dfe61bf59475ac7661406cf60fc5eccf`
- Panel: real Next.js application at `http://127.0.0.1:3320`
- Browser: isolated headless Chromium
- Storage: new disposable importer root under `F:/fxlab/`; no user storage

Chromium inspected the actual rendered controls before any source edit:

| Surface | Rendered fields before fix |
| --- | --- |
| Login positive control | `name=username`, `autocomplete=username`; `name=password`, `autocomplete=current-password` |
| Create Project | unnamed project name and description with default autocomplete; unnamed password-type numeric PIN with only `autocomplete=off` |
| Add Flow | unnamed Flow name with default autocomplete; unnamed password-type numeric PIN with no autocomplete directive |

The ordinary dialogs therefore matched the common credential-form heuristic:
a generic text field followed by a password-type field, with no stable field
names and at least one default autocomplete policy. This reproduces the
semantic cause of the user's saved username/password suggestions. A clean
headless profile has no saved credentials, so the browser-owned suggestion
popup itself was not used as the oracle.

## Repair

Changed only the production components that the live panel actually rendered:

- `apps/web/src/features/automation-studio/hierarchy/ProjectModal.tsx`
  - project name, description, category name, and authorization PIN now use
    distinct `automation-project-*` names and `autocomplete="off"`.
- `apps/web/src/features/automation-studio/hierarchy/AutomationHierarchyDialog.tsx`
  - hierarchy item name and both create/delete PIN controls now use distinct
    `automation-hierarchy-*` names and `autocomplete="off"`.
- `apps/web/src/features/automation-studio/hierarchy/tests/ProjectModal.test.ts`
  - guards the exact non-credential field contracts.

An initially inspected overlay implementation was not the component rendered
by the current live path. Those exploratory edits were fully reverted before
validation; no overlay file remains changed.

## Focused live retest

After a clean panel restart, Chromium repeated the same login, Create Project,
project creation, and Add Flow path:

- login remained `username` plus `current-password`;
- Create Project rendered:
  - `automation-project-name`, `autocomplete=off`;
  - `automation-project-description`, `autocomplete=off`;
  - `automation-project-authorization-pin`, `autocomplete=off`, numeric,
    password-masked;
- Add Flow rendered:
  - `automation-hierarchy-item-name`, `autocomplete=off`;
  - `automation-hierarchy-authorization-pin`, `autocomplete=off`, numeric,
    password-masked;
- project submission still returned HTTP 200 and opened the created project.

Result: **passed for the two live Automation Studio forms that reproduced the
finding, while preserving login password-manager semantics**.

The user's saved-profile browser remains the best final confirmation that its
specific password manager no longer displays suggestions; request a manual
retest after integration.

## Narrow checks after live pass

- `pnpm --filter @fluxiq/web test --
  src/features/automation-studio/hierarchy/tests/ProjectModal.test.ts
  src/app/tests/AuthShell.test.tsx` — passed, 7 tests.
- `pnpm --filter @fluxiq/web check` — passed.
- No full suite was run.

## Integration notes

Autofill production ownership is exactly two Core hierarchy components plus
one focused test. The work does not alter authentication forms, credential
change forms, authorization-password dialogs, storage, migration, or
downstream production code. Port 3320 was stopped after validation. The
disposable isolated importer root remains outside both repositories.
