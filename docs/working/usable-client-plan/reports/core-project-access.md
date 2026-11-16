# Core paired-client project access (U2, task t915)

CORE = `C:/Users/osrs_/FluxStuff/fxwork/t915/!FluxIQ`. Nothing committed.

## Outcome
Done. A paired token may now call `projects` and `create-project`. `update-project` and `delete-project` are still refused to tokens.

## Step 1 decision: scoped to the approving person, not to one project; no IAM change
A paired client's authority was never limited to one project. These four pieces of code set it:
- **Actor** (`pairedClientActor`): the person who approved the pairing. They keep their role's permissions, cut down to programs.read/write, runtime.control and flows.write.
- **Scope**: the domain the pairing bound (`pairedClientDomainScope`). The trust record holds no project.
- **Project check** (`refuseProjectOutsideDomain`): this only checks that the named project, or the session's current one, is in the bound domain.
- **IAM**: decides each project for that user exactly as it does for the person's own login. On the `service` profile this includes the owner condition, and the `projects` list filter (`filterProgramList`) drops projects the person cannot read.

Tenancy is enforced before the route runs. On a hosted server, `resolveServiceClientHttpRoute(token)` (apps/web `program-context.ts`) selects the tenant's own FluxIQ instance. Another tenant's project id is therefore unknown to this instance, and the domain check refuses it with `authorization.project_domain`. So no widening was needed and no IAM files were touched. The comment block "What a pairing approves" now says this.

## What changed and why
- `packages/fluxiq/src/server/program-route/program-route.ts`
  - Allowlisted `projects` (read) and `create-project` (authoring).
  - Narrowing:
    - `projects`: the payload is always `{}`.
    - `create-project`: the payload is rebuilt as `{ name }`. Every other key is ignored, as briefed (description, categoryId, domainId, authorizationPin, projectId). authSessionId is already stripped earlier.
    - A missing or non-string name gets 403 `authorization.forbidden`.
  - Projection: both answers are rebuilt from the needed fields, never copied and pruned. A refusal keeps only its error and errorCode.
  - New private `PAIRED_CLIENT_PROJECTLESS_ENDPOINTS`. `pairedClientProjectTarget` takes an optional 4th `endpoint` argument. Both endpoints now target no project, so they are never refused because of the session's current project. Without this, a session whose project was deleted, or moved to another domain, could not list projects to recover.
- `packages/fluxiq/src/server/program-route/handle-program-request.ts`: passes `endpoint` into that check. The change is 3 lines.
  - **This file is outside the literal "program-route.ts" in the brief.** It is in the same module, and nothing else changes there.
- `handlers/projects.ts`: unchanged, because the projection belongs in the route like the other token projections.

## Response shapes for a token caller
- `projects` (GET or POST, any body ignored):
  - Returns `{ ok: true, payload: { projects: Array<{ id: string; name: string; updatedAt: number }> } }`.
  - Only the projects the approving person may read in the bound domain are listed, newest first.
  - `updatedAt` is epoch milliseconds.
  - Owners, description, category, domain and the categories list are never included.
- `create-project` with body `{ name: string }`:
  - Returns `{ ok: true, payload: { project: { id, name, updatedAt } } }`. The name comes back trimmed. The project is created in the bound domain and owned by the approving person.
  - A non-string or missing name gets HTTP 403 `{ ok:false, errorCode:"authorization.forbidden", error:"A paired client's new project must carry its name as a string." }`.
  - A blank name gets `{ ok:false, error:"Project name is required." }` from the handler. The tests did not assert its exact HTTP status.
- **Contract note for U3:** the Stable Interface types `PanelProjectSummary.updatedAt` as `string`, but Core sends a number. Core's own timestamps are numbers, so I kept them. The extension relay should convert, or the lead should change the interface.

## Step 4: conversation, Flow and run reads
An explicit `projectId` is honoured across the person's projects whatever the session's current project is. This was already true; it is now tested end to end. Refusals:

| Project named | Answer |
|---|---|
| Another person's (service profile) | `ok:false` |
| Another domain's | 403 `authorization.project_domain` |
| Another tenant's (id from a separate store) | 403 `authorization.project_domain` |

## Tests
- `tests/program-route.test.ts`:
  - The allowlist assertion now includes the two endpoints, and checks update, delete and category endpoints are refused.
  - Covers narrowing and the projection, including that no identity leaks.
  - Checks that neither endpoint targets a project.
- New `tests/paired-client-projects.test.ts`, 7 tests: the whole route on the `service` profile with a real runtime, two people, two domains and a second tenant store. It covers:
  - list only own projects, by GET and by POST, without leaking owners;
  - listing still works when the session's project is deleted;
  - create ignores the extra fields;
  - blank and missing names are refused;
  - update, delete and category endpoints are refused before any handler runs;
  - open, append, get and list conversations, plus Flow and task reads, work in a second project;
  - cross-person, cross-domain and cross-tenant refusals.

## Commands run and observed results
- `pnpm --filter fluxiq exec vitest run src/server/program-route` (final run) -> 6 files, 138 tests passed.
- `pnpm --filter fluxiq check` (final run) -> 1 error, TS6053: `src/runtime/models/secrets/person-wait-clock.ts` not found. That path is another worker's must-not-touch area, and the file probably moved mid-edit. There are no errors in my files. Earlier runs showed errors only in other workers' secret-keys, unlock and conversation files.
- `node scripts/structure-audit.mjs` (final run) -> 12 violations, none in `program-route`; all are in `packages/ui-components` and `apps/web`, other workers' files. program-route.ts has advisory warnings only: 671 lines and 12 exported values; the line-count warning was already there at 589 lines.

## Not verified
- No live extension or hosted multi-tenant server was run. Cross-tenant behaviour is shown with a second store's id, not through `resolveServiceClientHttpRoute`.
- `append-turn` with `capabilities` (the model path) was not exercised. `list-flow-runs` and `get-flow-run-detail` were not called, because no run existed.

## Open questions or contradictions
1. **apps/web test will fail and I cannot fix it.** `apps/web/src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts` hard-codes `ALLOWLISTED` and asserts it equals `PAIRED_CLIENT_ENDPOINTS` (line 270). The lead or the apps/web owner needs to add `projects` and `create-project` there; its `it.each` body table may also need a `{ name }` body for create-project.
2. `updatedAt` type mismatch (number from Core vs string in the extension interface), as noted above.
3. Gateway pushes are still limited to the session's current project. `activity-publisher.ts` `acceptsActivity` drops activity for other projects. This matters to U3's `panelChanges` feed, but not to program calls.
