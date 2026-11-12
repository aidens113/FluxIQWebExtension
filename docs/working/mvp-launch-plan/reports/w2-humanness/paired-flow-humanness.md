# Paired client: a Flow's humanness (t898, W2)

Worker report. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t898/!FluxIQ`. Nothing committed.

## Outcome

Done, with one deliberate deviation on the error code (see Open questions). A paired browser can now read
a Flow's settings detail (`get-flow-metadata-detail`) and set or clear that Flow's `metadata.humanness`
through `update-flow-settings`. Every other key it sends is refused before the handler runs, and the refusal
names the field. Cookie callers are unchanged.

## What changed and why

`packages/fluxiq/src/server/program-route/program-route.ts`
- Allowlist: added `get-flow-metadata-detail` and `update-flow-settings` as one group with a one-line
  comment, placed right after the task-memory group (`rename-task`, `update-task-settings`, `remove-task`).
  No other entry was touched.
- `narrowPairedClientRequest`: added `if (name === "update-flow-settings") return narrowFlowHumanness(payload);`.
  Every existing narrowing is unchanged.
- New private `narrowFlowHumanness` plus a helper `unlistedField`. The exact narrowing:
  - The body must be an object whose keys are a subset of `projectId`, `flowId` and `flow`. Any other key is
    refused as `may not carry <key>.`
  - `projectId` must be a non-empty string; `flowId` must be a non-empty string.
  - `flow` must be an object whose keys are a subset of `flowId` and `metadata`. Any other key is refused as
    `may not carry flow.<key>.`
  - If `flow.flowId` is present (an own property), it must be strictly equal to `flowId`. Otherwise:
    `must name the same Flow in flow.flowId as in flowId.`
  - `flow.metadata` must be an object whose keys are a subset of `humanness`. Any other key is refused as
    `may not carry flow.metadata.<key>.`
  - `flow.metadata.humanness` must be present (an own property). Its value must be `null` or a number; the
    handler's `assertFlowHumanness` (humannessSchema) still checks the bounds and the whole-number rule.
  - The payload handed on is rebuilt from the accepted fields only:
    `{ projectId, flowId, flow: { flowId? (= flowId), metadata: { humanness } } }`.
  - `__proto__` sent as a JSON key becomes an own key, so it is refused by name like any other.
- The `PAIRED_CLIENT_PERMISSIONS` doc comment was out of date: it said only the recording proposal and review
  needed `flows.write`. It now lists every allowlisted `flows.write` user, including this one. The permission
  set itself is unchanged.

`packages/fluxiq/src/server/program-route/tests/program-route.test.ts`
- The allowlist snapshot includes the two entries.
- New unit `describe("a Flow's humanness (t898)")` with these tests:
  - Both endpoints are allowed, and `get-flow`, `save-flow`, `apply-graph-patch`, `create-flow`,
    `publish-flow` and `delete-flow` are not.
  - The read passes unchanged.
  - Accepted: 40, null, and with or without `flow.flowId`.
  - Refused by path with the exact message: `flow.metadata.flowSizeSettings`, `llmExecutionSettings`,
    `trainingModeSettings`, `adaptationMode`, `flow.name`, `flow.description`, `flow.visibility`,
    `flow.interface`, `flow.executionDefaults`, `flow.source`, `expectedUpdatedAt`, `authSessionId`, any extra
    top-level key, `__proto__` at the top level and in metadata.
  - Refused: missing humanness, empty `flow`, metadata as an array, body with no `flow`, `flow` as an array,
    mismatched or null `flow.flowId`, missing `flowId`, a non-string `projectId`, humanness of
    `"50"`/`undefined`/`true`/`{}`, an undefined body, an array body.
  - Refusal messages never echo a value, and the accepted payload's keys are exactly
    `projectId, flowId, flow`.
  - A cookie body passes through `withProgramAuthSession` with nothing removed.

`packages/fluxiq/src/server/program-route/tests/handle-program-request.test.ts` (new; carries the
`real-sql` group marker)
- Drives `handleProgramRequest` against a real `GlobalProgramApiRegistry` with `registerAutomationStudioApi`
  and a real `AutomationStudioService` on a temporary directory. `registry.call` is spied on.
- Covers:
  - A paired read of the detail.
  - A paired set to 40, which is stored and read back, then a clear with null, which removes the key.
  - The handler, not the narrowing, refusing 101, with 40 kept.
  - A refusal with 403, `authorization.forbidden` and the field named, the registry never called, and the
    stored Flow (name, description, visibility, updatedAt, metadata) deep-equal before and after. This runs
    for each of `flow.metadata.flowSizeSettings`, `flow.name`, `flow.description`, top-level
    `expectedUpdatedAt`, an extra top-level key (`visibility`), missing `flow.metadata.humanness`, and a
    mismatched `flow.flowId`.
  - A token's `authSessionId` stripped before narrowing and absent from the handler's payload.
  - A token GET of `update-flow-settings` (no body) refused, and token `save-flow`, `apply-graph-patch`,
    `get-flow` and `create-flow` refused, with the registry never called.
  - A cookie caller changing name, description, flowSizeSettings and humanness together, all stored.
- Why a second file: the brief's "no change stored" and "cookie caller can still update" can only be
  observed through a store. Putting a real database in `program-route.test.ts` would have moved that pure,
  fast file into the slow real-SQL group. The new file follows the `a/tests/b.test.ts` rule
  (`handle-program-request.ts` had no test file) and sits in the owned tests folder.

## Refusal codes

All refusals use `errorCode: "authorization.forbidden"` (HTTP 403). The `error` names the refused field by
its path:
- `A paired client's Flow settings change may not carry <path>.` (`<key>`, `flow.<key>`, `flow.metadata.<key>`)
- `... must carry flow.metadata.humanness.`
- `... must carry flow.metadata.humanness as a number, or null to clear it.`
- `... must name the same Flow in flow.flowId as in flowId.`
- `... must name its Flow by a string flowId.` / `... must name its project by a string projectId.`
- `... must name a project and a Flow.` (no object body)

## Adversarial note: what a paired token can and cannot do now

Can:
- Read any Flow's settings detail in its bound domain. This is the SQL detail row: name, description,
  status, settings, input and output ports with their default values, variables with their initial values,
  and the error table, with `metadata.humanness` merged in. The answer is not projected. This read was
  cookie-only before. A port default or variable initial value that someone put a literal secret into would
  now be readable by the paired person's browser. The reach is still the approver's own: they could read the
  same thing with their login, in the same domain. The supervisor may want a projection if the extension
  only needs humanness.
- Set or clear one Flow's humanness. The handler re-saves the Flow merged with exactly `{ humanness }`. The
  cost-limit, intervention-mode and check-authorization helpers are no-ops on a patch that holds only
  humanness, and `null` removes the key. There is no `expectedUpdatedAt`, so this is a last-write-wins
  overwrite of one key. It can race a panel edit in progress, but it cannot clobber any other key because the
  merge is over the stored metadata.

Cannot, through this endpoint:
- Rename, describe, change visibility, interface, execution defaults or code-source dependencies.
- Touch any other metadata key: model/LLM execution settings, cost limits, size limits, training/adaptation
  settings, or the check's authorization.
- Name a second Flow through `flow.flowId` (the IAM resource and the handler both read `flowId` first, and
  the narrowing forces equality).
- Pass an `expectedUpdatedAt`, or speak for another session.
- Reach save-flow, apply-graph-patch, get-flow, create-flow, publish-flow or delete-flow. These are still
  not allowlisted, and the destructive-classification guard is unchanged.

Domain and permission gates are unchanged:
- The body's `projectId` must be in the bound domain (`refuseProjectOutsideDomain`).
- The actor holds only `programs.read`, `programs.write`, `runtime.control` and `flows.write`.
- Both endpoints are `read` and `authoring`, which the route's classification gate allows.

## Commands run and observed results

- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t898-pair -- pnpm --filter fluxiq exec vitest run src/server/program-route`
  printed `Test Files 3 passed (3)`, `Tests 65 passed (65)`; program-route.test.ts 50 tests,
  handle-program-request.test.ts 13 tests, program-json-text.test.ts 2.
  - Caveat: the run started at 07:44:49. My last edit to the new test file landed at 07:45:24, during the
    128 s collection; it replaced an `as never` Identity Access stub with `new GlobalProgramApiRegistry()`.
  - Re-run on the final file (started 07:57:52):
    `node .../heavy-slot.mjs run t898-pair -- pnpm --filter fluxiq exec vitest run src/server/program-route/tests/handle-program-request.test.ts`
    printed `Test Files 1 passed (1)`, `Tests 13 passed (13)`. `program-route.ts` and `program-route.test.ts`
    were last modified at 07:32, before the first run.
- `pnpm structure:check` first printed `FAIL [as-never] ... handle-program-request.test.ts ... line 22`.
  After the fix it printed `structure-audit: passed (533 warning(s), 969 baselined).`
  - Advisory warnings on my files: `program-route.ts` is at 510 lines (past the 400-line advisory before this
    change, at 459). `program-route.test.ts` is at 408 lines and is newly past the advisory. Both are warnings,
    not failures.

## Not verified

- No TypeScript typecheck of the package was run, because vitest does not typecheck. The supervisor's
  library build will catch type errors in the new test, for example `service.createFlow({ description })` or
  `saved.visibility`.
- The web app's mirrored route test (`apps/web/src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts`)
  was not run and not edited (outside ownership). Its `ALLOWLISTED` copy already lacked
  `update-task-settings`. It keeps passing because its endpoint mock classifies any unlisted endpoint as
  `destructive`, so the "refused on every other endpoint" test still gets 403. The mirror has drifted and
  should list the three entries.
- Live browser behaviour with the extension.

## Open questions or contradictions found

1. Error code. The brief asked for a named code "following the file's existing naming, e.g.
   `paired.flow_settings_field_refused`". The file has no such code. Every narrowing refusal uses
   `authorization.forbidden` and names the field in `error`, and the type is a literal: in
   `PairedClientRequestNarrowing` here, and in `Narrowed` and `refuse()` in `handle-program-request.ts`.
   A distinct code would mean editing `handle-program-request.ts`, which I do not own. I followed the
   existing convention. If a distinct code is wanted, it is three type edits:
   - widen `PairedClientRequestNarrowing.errorCode` here;
   - widen `Narrowed` in `handle-program-request.ts`;
   - widen `refuse()`'s `errorCode` parameter there.
   Then change `forbidden()` for this narrowing only.
2. `authSessionId`. The brief lists it among the refused keys. At the narrowing level it is refused. Through
   the route, `withoutAuthSession` strips it before narrowing, as on every endpoint, so the call succeeds and
   the handler never sees it. That is pinned by a test. Changing it is not in my files.
3. Merge overlap with W4 (t900), which edits the same allowlist array and its snapshot test. My entries are
   one contiguous group after `remove-task`, so a conflict, if any, is adjacent-line only.
4. No IAM or generated catalog change was needed. Paired access is decided by the allowlist plus the
   registry's existing classification. Both endpoints were already registered with actions in the catalog.
