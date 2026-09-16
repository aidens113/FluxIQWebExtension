# P — PIN reclassification (FluxIQ Core), one atomic change

Repository: `F:\!FluxIQ` (Core), branch `dev`. Nothing committed, nothing pushed,
no working document edited.

## Outcome

Done. The saved patch's design is in, extended to every registration site.
`classification` is now a required field on `GlobalProgramApiRegistry.register()`,
the PIN check runs once in `registry.call()` instead of in 57 handler bodies, and
all 220 program endpoints carry a value. Omitting the field, or misspelling one,
is a compile error — both demonstrated below.

One consequence needs the supervisor's hand, because it lands in files I was told
not to touch:

1. **One test assertion is now false** and sits in `AS/runtime/**`. Exact
   one-line fix given in "Handover" below. Until it changes, Core's suite has one
   reproducible red test.
2. **Two `apps/web` call sites will now be refused at runtime** because their
   endpoints gained the PIN. Exact files and the fix shape are in "Handover".

## What changed and why

### 1. The classification is declared, and the registry enforces it

`packages/fluxiq/src/programs/_shared/api.ts`

- New exported `ProgramEndpointClassification`: `read` | `authoring` |
  `destructive` | `program-gated` | `destructive-ungated`, with the doc comment
  the saved patch proposed, amended so `authoring` explicitly covers withdrawing
  access (see the revocation decision below).
- `register()` takes `classification` as a **required** property. TypeScript's
  excess/missing-property check on the object literal is the gate: there is no
  default and no runtime fallback, so coverage needs no test.
- The registry takes an optional `identityAccess` collaborator at construction.
  `call()` runs `authorizeProgramPin` for a `destructive` endpoint only, after
  the permission check and inside the existing try/`withEndpointPerformanceScope`
  block, so a refusal reaches the caller in exactly the shape a handler-thrown
  refusal used to (`{ ok: false, error: "PIN is required for this action" }`).
  A registry built without Identity Access refuses every destructive endpoint —
  fail closed, the same refusal the handlers gave when passed no Identity Access.
- `endpoints()` now returns the classification, which is what the census test and
  the generated API map read.

`packages/fluxiq/src/programs/_shared/runtime.ts` — the registry is constructed
after `identityAccess` exists and is handed it.

`packages/fluxiq/src/programs/_shared/docs-generators.ts` — the generated
"Program API Map" page gained a Classification column, so the published map now
shows the credential regime alongside the permission.

### 2. Every registration site, and the 57 inline PIN calls

All 220 registrations across ten programs gained a `classification`. All 57
`await authorizeProgramPin(identityAccess, payload)` calls were deleted from
handler bodies, and with them the now-dead `authorizeProgramPin` import and
`identityAccess` binding in ten `automation-studio/api/handlers/*.ts` files.

`registerAutomationStudioApi`'s third positional parameter, `identityAccess`, is
**kept**. Nothing reads it any more, but removing it renumbers every caller,
including `AS/runtime/tests/service-flow-bootstrap-adaptation.test.ts:320` which I
may not edit. `handlers/dependencies.ts` now carries a comment saying exactly that
and that the parameter and the field should be removed together. That is the one
piece of deliberate dead weight in this change.

### 3. The classifications

Counts from the live runtime: **94 `read`, 89 `authoring`, 15 `destructive`,
19 `program-gated`, 3 `destructive-ungated` = 220.**

The fifteen PIN-gated endpoints:

`delete-flow`, `delete-flow-subflow`, `delete-flow-map-route-group`,
`delete-project`, `delete-project-category`, `delete-project-artifact`,
`delete-project-hierarchy-node`, `save-project-hierarchy`, `delete-proposal`,
`delete-recording`, `delete-recordings`, `delete-run-datasets`,
`rollback-flow-migration`, `seal-legacy-writes`, `execute-client-action`.

Twelve of those already required a PIN. **Three gain one**: `delete-run-datasets`,
`save-project-hierarchy`, `delete-project-hierarchy-node` — the L16 decision, and
the gap W2-D found.

The large movement is the other way: **54 endpoints lose the PIN**, every one of
them authoring — `create-flow`, `save-flow`, `apply-graph-patch`,
`update-flow-settings`, the nine subflow lifecycle endpoints, the five router
save endpoints, `publish-flow`, `deprecate-flow-publication`,
`review-flow-adaptation`, `create-project`, `update-project`, the category
create/update/reorder trio, the recording append/finalize endpoints,
`approve-policy-proposal`, `review-recording-flow-proposal`,
`start`/`stop-client-recording`, and the rest. An unattended loop can now build
and edit Flows end to end with no operator at the keyboard.

Judgements I made that were not spelled out in the brief, each flagged here so
one line can be flipped if you disagree:

- **`revoke-client-trust` → `authoring`** (it had a PIN). This is your
  `revoke-session` / `lock-vault` decision applied to its exact analogue:
  revoking a paired browser's trust removes access, not persisted data, and it is
  the action you want fastest when a client is compromised. Note the asymmetry it
  fixes — `approve-pairing`, the granting direction, has never had a gate.
- **`deployment-sync/sync`, `deployment-sync/rollback`,
  `database-manager/run-migration` → `destructive-ungated`.** These are
  destructive and nothing checks a credential. Calling them `authoring` would be
  a lie; calling them `destructive` would gate a program you did not ask me to
  change, and would gate it *impossibly*, because `withProgramAuthSession` never
  stamps an auth session onto payloads for those programs. `destructive-ungated`
  states the gap, changes no behaviour, and is written into the architecture doc.
- **`database-manager/put-record`, `delete-record`, `list-records`,
  `get-record` → `program-gated`**, per your instruction to leave that program
  alone, with the same caveat you accepted for `update-user`: the gate is real
  only for the two sensitive stores, and the label describes the strongest branch.
- **`compute-control/command`, `background-tasks/run`, `production-runner/start`
  → `authoring`**, following W2-D's recommendation to treat "causes work
  elsewhere" separately from L16.
- **`inspect-flow-migration` → `read`.** It writes nothing. I left its
  mislabelled `flows.write` permission alone; changing a permission is a
  different decision from classifying an endpoint.
- The twelve identity-access values are exactly those decided in
  `sec-create-session.md`, unchanged.

### 4. Tests

New: `packages/fluxiq/src/programs/_shared/tests/api.test.ts` (8 tests) — the
registry takes the PIN for `destructive`, refuses without one before reaching the
handler, refuses a wrong PIN, fails closed with no Identity Access, adds nothing
for `authoring`, `program-gated` or `destructive-ungated`, reports the
classification, and checks the permission *before* the PIN so an unauthorized
caller learns nothing from the PIN gate.

New: `packages/fluxiq/src/programs/tests/endpoint-classification.test.ts`
(6 tests) — a census over the real runtime. It does not police coverage (the
compiler does); it pins the two lists where the classification is a security
statement: the exact fifteen `destructive` endpoints and the exact three declared
gaps. Reclassifying anything now fails a named test rather than passing silently.
It also pins that flow authoring stays un-gated and that revocation stays
un-gated.

Updated, all in `tests/` folders I own: `api/handlers/tests/flows.test.ts`,
`subflows.test.ts` (both now assert the PIN is *not* taken for an authoring
endpoint, with Identity Access present in the registry so the assertion means
something), `datasets.test.ts` (delete now supplies a PIN, plus a new case that
deleting without one is refused and the store is never reached),
`projects.test.ts` (put is authoring, delete takes the PIN), `runs.test.ts`
(classification in the registration assertion), and `programs/tests/index.test.ts`.

`programs/tests/global-identity-access.test.ts` needed real surgery: two of its
tests used `create-project-category` as their PIN-gated example, and that endpoint
is now authoring. Both now create a category with no PIN — which is itself the new
rule under test — and use `delete-project-category` for the PIN ladder
(sign-in-required → wrong PIN → missing PIN → success). The tests still prove what
they proved before: no PIN verifier survives a restart, and a legacy stored
verifier is removed.

### 5. Documentation

`docs/architecture/automation-studio/persistence.md` — the false paragraph at
515-521 is gone. In its place, a section "Which endpoints ask for the operator's
PIN" that states the rule (the PIN guards destruction, not authorship), gives the
five-value table, lists the fifteen gated endpoints, explains the three deletions
deliberately left un-gated because they are how a Flow is edited, records the
revocation rule, and keeps the sentence about proposal-generation endpoints that
was true. Then a "Declared gaps" section listing the three `destructive-ungated`
endpoints with the reason no PIN can reach them, and a table of the **seven write
routes outside the program API** — the three `POST /api/framework/setup` actions,
`approve-pairing`, `dismiss-pairing`, the bearer-token state-asset upload, and
login — with the recommendation to route `framework/setup` and `approve-pairing`
through the same check or move them behind the program API.

## Commands run and observed results

All from `F:\!FluxIQ`.

1. `pnpm --filter fluxiq check` (`tsc --noEmit`) → **no output, exit 0.**

2. **A registration that omits `classification` does not compile.** I added a
   temporary registration to `docs/api/handlers.ts` with no classification:

   ```
   src/programs/docs/api/handlers.ts(6,21): error TS2345: Argument of type
   '{ programId: string; endpoint: string; permission: "programs.read"; handler: () => Promise<{ ok: true; }>; }'
   is not assignable to parameter of type
   '{ programId: string; endpoint: string; permission: Permission; classification: ProgramEndpointClassification; handler: ProgramApiHandler<unknown, unknown>; }'.
     Property 'classification' is missing ... but required ...
   ```

   And a misspelled value in the same file:

   ```
   src/programs/docs/api/handlers.ts(10,5): error TS2322:
   Type '"destructive-maybe"' is not assignable to type 'ProgramEndpointClassification'.
   ```

   The file was restored from a scratchpad copy both times;
   `git diff --numstat` for it reads `4 0`, its four classification lines.

3. `node scripts/structure-audit.mjs` →
   `structure-audit: passed (136 warning(s), 256 baselined).`, exit 0.
   It also prints `1 baseline entries can be lowered`. I checked what that entry
   is by copying `.structure-baseline.json` aside, running `--update`, diffing,
   and restoring: it is
   `automation-studio/runtime/service.ts: 6758 → 6757`, **another worker's file**.
   `.structure-baseline.json` is byte-identical to HEAD (`git status` clean for
   it). The `AS/runtime/service.ts` overrun you warned about is no longer failing;
   that worker fixed it during my task.

4. `pnpm check` (structure:test + structure-audit + `-r check`) → all 63
   structure-audit unit tests pass, `structure-audit: passed (137 warning(s), 256
   baselined)`, and `packages/contracts`, `packages/fluxiq`,
   `packages/client-gateway-websocket`, `apps/web` all `check: Done`. Exit 0.

5. `pnpm --filter fluxiq test` (full Core package suite), final run →
   **`Test Files 4 failed | 175 passed (179)`, `Tests 6 failed | 1445 passed (1451)`.**
   The six:

   | Failure | Mine? | Evidence |
   | --- | --- | --- |
   | `service-flow-bootstrap-adaptation.test.ts > bridges a generated proposal ID through standard PIN-gated Adaptation Audit ...` — `expected "spy" to be called 2 times, but got 0 times` | **Yes** | `review-flow-adaptation` is now authoring, so `authorizeSessionPin` is never called. The file is under `AS/runtime/**`. See Handover. |
   | `global-docs.test.ts > generates a TypeDoc-backed framework reference` — `Test timed out in 15000ms` | No | Passes alone in 11.9s against a 15s timeout; it is TypeDoc under parallel load. |
   | `_shared/tests/runtime-llm-grants.test.ts > issues a sanitized build grant ...` — `Test timed out in 15000ms` | No | `vitest run src/programs/_shared` alone → `Test Files 13 passed (13)`, `Tests 118 passed (118)`. |
   | `runtime-stream-store.test.ts` × 3 — `Test timed out in 60000ms` and `EBUSY: resource busy or locked, unlink '...project.sqlite-shm'` | No | That file alone → `Test Files 1 passed (1)`, `Tests 8 passed (8)`. Million-event SQLite test under load. |

6. An earlier full run also showed 4 failures in `AS/runtime/tests/service.test.ts`
   (sanitized failure evidence, target overrides, diagnose_and_adapt patches) and
   2 in `database-manager/api/tests/handlers.test.ts`. Run in isolation:
   `service.test.ts` reproduced them at that moment, `database-manager` passed
   `19 passed (19)`. By the final full run **all six had disappeared** — the
   `AS/runtime` worker changed those files under me mid-task. None of them touch
   `registry.call()` or anything I edited; `service.test.ts` calls the service
   directly and never builds a registry.

7. `pnpm --filter @fluxiq/web --filter @fluxiq/contracts --filter @fluxiq/client-gateway-websocket test` →
   `apps/web`: `Test Files 237 passed (237)`, `Tests 1215 passed (1215)`;
   `contracts`: 9 files, 53 tests; `client-gateway-websocket`: 1 file, 3 tests.
   All pass.

8. `node scripts/validate-docs.mjs` →
   `Validated local links in 134 authored/reference Markdown files.`

9. Endpoint census, printed from `createGlobalProgramRuntime().api.endpoints()`:
   220 endpoints, `read 94 / authoring 89 / destructive 15 / program-gated 19 /
   destructive-ungated 3`. 220 `classification:` lines across the `*/api/`
   directories; 0 `authorizeProgramPin` call sites remain outside
   `_shared/api.ts`.

## Handover — the two things I could not do

**a. One line in a file I must not edit.**
`packages/fluxiq/src/programs/automation-studio/runtime/tests/service-flow-bootstrap-adaptation.test.ts:383`

```ts
    expect(identityAccess.authorizeSessionPin).toHaveBeenCalledTimes(2);
```

should become

```ts
    expect(identityAccess.authorizeSessionPin).not.toHaveBeenCalled();
```

and the test title at line 296 ("bridges a generated proposal ID through standard
**PIN-gated** Adaptation Audit get, approve, and apply endpoints") no longer
describes what it tests; "standard Adaptation Audit" is accurate. The four
`authorizationPin: "1234"` fields in its payloads are now inert and can stay or go.
I left the file alone because the brief forbids `AS/runtime/**` and a silent
collision with that worker's next write would be worse than a reported red test.

**b. Two `apps/web` call sites now fail at runtime.** Both post an endpoint that
gained the PIN, with no PIN in the payload, so the registry will answer
`{ ok: false, error: "PIN is required for this action" }`:

- `apps/web/src/features/automation-studio/datasets/dataset-commands.ts:16` —
  `deleteRunDatasets` posts `{ projectId, runId, datasetId? }`. The Data window's
  delete action breaks until the panel collects a PIN.
- `apps/web/src/features/automation-studio/hierarchy/useHierarchyPersistence.ts:141` —
  posts `delete-project-hierarchy-node` with `{ projectId, nodeId, mutationId }`.
  This one deserves a product decision, not just a fix: it is an **autosave** path
  that fires as the user rearranges the workspace, so gating it means a PIN prompt
  during ordinary editing. Options are (i) collect the PIN once per session for
  hierarchy edits, (ii) reclassify `delete-project-hierarchy-node` as authoring
  and keep only the bulk `save-project-hierarchy` destructive, or (iii) prompt per
  delete. The machinery exists either way —
  `hierarchy/AutomationHierarchyDialog.tsx` already renders a "Security PIN" field
  for folder create/delete.

  `save-project-hierarchy` itself has **no live caller** in `apps/web` (only a
  metric name in `program-api.ts:255` and an entry in `data-request-policy.ts`;
  `useHierarchyPersistence`'s own test asserts it is never posted), so gating it
  breaks nothing today.

Nothing in the downstream web-extension repository calls any newly gated endpoint;
I grepped `apps`, `domain` and `packages` there for all fifteen. `packages/test-runner`
still sends `authorizationPin` to `create-project`, `create-flow`, `save-flow` and
the adaptation review endpoints — all now authoring, so the extra payload field is
simply ignored. Nothing downstream needs changing.

Also worth one line of your time: `apps/web/src/features/automation-studio/clients/`
still collects a PIN for `revoke-client-trust`, `start-client-recording` and
`stop-client-recording`, which no longer need one. Harmless (the field is ignored),
but the prompt is now pointless.

## Not verified

- **No live browser validation.** Nothing was clicked in a running panel. The two
  breakages in (b) above are read from the call sites and the new registry rule,
  not observed in a browser.
- **I did not prove the non-mine test failures by reverting the other worker's
  files.** They are in flight and I may not touch them. My attribution rests on:
  each file passing in isolation, the failing subjects being the other worker's
  edit area, and `service.test.ts` never constructing a registry.
- I did not run `pnpm build` or `pnpm package:validate`.
- I did not regenerate `.fluxiq/cache/docs/programs/api-map.md`; the generator now
  emits a Classification column but the cached copy under
  `apps/web/.e2e-host/.fluxiq/cache/docs/` is stale until something rebuilds it.
  That directory is generated output, not authored.
- The `read` classification for `deployment-sync/dry-run`,
  `automation-studio/pack-reusable-llm-contexts` and
  `compute-control/poll-commands` rests on reading the handler and the service
  method it calls, not on observing that nothing is persisted. `poll-commands` in
  particular claims commands for a node, which is arguably a write; I classified
  it `authoring`, not `read`.

## Open questions and contradictions found

1. **`delete-project-hierarchy-node` on an autosave path** — item (b) above. This
   is the one place where "the PIN guards destruction" collides with a flow the
   user drives by dragging things around. It needs your call, and it is the only
   classification in this change I would not defend without you.
2. **`registerAutomationStudioApi`'s dead `identityAccess` parameter.** Removing it
   is a three-line change plus renumbering ~20 call sites, one of which is in
   `AS/runtime/tests/`. Worth doing once that worker is finished.
3. **The seven ungated write routes outside the program API** are now documented
   but still ungated. `POST /api/framework/setup {action:"migrate"}` remains the
   most destructive operation in Core behind a permission check alone. The
   classification mechanism cannot reach it; either those routes move behind the
   program API, or `apps/web` grows an equivalent check.
4. **`inspect-flow-migration` still demands `flows.write` to write nothing.** I
   classified it `read` and left the permission, so the registry now documents the
   contradiction rather than hiding it. Tidying the permission is a one-word change
   whenever someone wants it.
5. **Biome's `files.includes` lists `packages/fluxiq/src/programs/permission-matrix.test.ts`**,
   which does not exist — the file is at `programs/tests/permission-matrix.test.ts`.
   Pre-existing, unrelated to this change, but `biome.json` is silently linting
   nothing there.

No PIN, password, token or session value appears in this report or in any test I
wrote; the tests use dummy digits only.
