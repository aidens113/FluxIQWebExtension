# W2 flow-level humanness (Core, worktree t898)

## Outcome
Done. All paths relative to Core `packages/fluxiq/src` unless noted.

## What changed and why
- NEW `framework/automation-service/service/flow-settings/flow-humanness.ts`: `automationStudioFlowHumanness(metadata): number | undefined` (uses `humannessSchema`; a stored bad value reads as undefined). Exported from `flow-settings/index.ts`.
- NEW `flow-settings-requests/assert-flow-humanness.ts`: `assertFlowHumanness(value)`; absent/null pass, else `humannessSchema` or throws "humanness must be a whole number from 0 to 100, or null to clear it."
- NEW `flow-settings-requests/flow-humanness-patch.ts`: `withFlowHumannessPatch(merged, patch)` deletes the key when patch.humanness === null.
- NEW `flow-settings-requests/humanness-detail.ts`: `withFlowHumanness(detail, flow)` puts `metadata: { humanness }` on the detail (only when stored). Needed because get-flow-metadata-detail returns the SQL row, which has no metadata; like `withFlowSizeSettings`.
- `flow-settings-requests/update.ts`: validate (line ~17), null-removal wrapping the metadata merge (line ~28), detail return adds humanness (end). `index.ts` exports the three new files.
- `programs/automation-studio/api/handlers/flows.ts`: get-flow-metadata-detail wraps with `withFlowHumanness`; create-flow validates `payload.humanness` (returns `{ok:false,error}` naming humanness, creates nothing), creates, then if a number was given stores it through `updateFlowSettingsForRequest` and returns `service.getFlow`. Absent: returns the created Flow unchanged. (service.ts untouched.)
- `api-contracts/automation/flow.ts`: `CreateFlowRequest.humanness?: unknown`.
- Core `packages/contracts/src/program-api/automation-studio/flows/flow.ts`: `createFlowInput` gets optional `humanness: humannessSchema` (needs contracts rebuild for dist; supervisor). It imports `../../../humanness/index.ts`.

## Shapes
- Set: `update-flow-settings` `{projectId, flowId, flow:{flowId, metadata:{humanness:N}}}` (metadata sits under `flow`, as every other setting). Clear: `humanness:null`. Response `payload.flow` = settings detail with `metadata:{humanness:N}` when stored, absent otherwise.
- Read: `get-flow-metadata-detail` -> `payload.flow.metadata.humanness` (detail row + added `metadata`).
- Create: `create-flow` `{projectId, name?, description?, flowId?, humanness?}` -> `payload.flow` the Flow artifact, `metadata.humanness` set when given.
- Refusal: `{ok:false, error:"humanness must be a whole number from 0 to 100, or null to clear it."}`.

## Commands run
- `pnpm --filter fluxiq exec vitest run` flows-humanness + flow-humanness + flow-settings-requests + handlers/tests/flows.test.ts: 5 files passed, 1 failed (my id-path deep-equal, fixed after).
- `vitest run .../handlers/tests/flow-settings src/framework/automation-service/service/flow-settings` (after fixes): 9 files, 69 tests passed. Covers set 0/50/100, clear null, refuse 101/-1/2.5/"50", other metadata unchanged both ways, detail read, create with/without (absent: equal to `service.createFlow` after replacing the Flow id), create refusal creates nothing. Earlier combined run also passed existing flows.test.ts and flow-settings-requests tests.
- `pnpm structure:check`: one FAIL, not mine: `service/answer-first/tests/` 26 files over the 25 limit (another lane). My two earlier failures (tests dir file count, test placement, statement packing) fixed.
- Tests: `handlers/tests/flow-settings/tests/flows-humanness.test.ts` (real-sql marker), `flow-settings/tests/flow-humanness.test.ts`.

## Not verified
Contracts zod schema change (createFlowInput) untested here: contracts dist not rebuilt; typecheck/build left to supervisor. `packages/contracts/dist/humanness/resolve.d.ts` was still absent (dist stale); I only needed `humannessSchema`, which exists. Assistant-facing tool input not exercised.

## Open questions
create-flow is create then update (two saves, not atomic); a failure between leaves a Flow without the level. Doing it in one step needs service.ts / flow-creation (not owned).
