# Paired detail narrowing (t898, W2 Humanness)

## Outcome

Done. A paired browser using its pairing token, not a cookie, gets exactly `{ flow: { flowId, metadata: { humanness? } } }` from `get-flow-metadata-detail`. Its request may carry only `{ projectId, flowId }`, both strings. Any other key is refused with its name. Cookie callers get the same bytes as before.

I made one change beyond the brief, and it was needed to close the boundary: `update-flow-settings` gets the same projection for paired callers. Its handler reads the full detail back after saving (`updateFlowSettingsForRequest` ends with `getFlowMetadataDetail`). So a token could re-send its current level and receive every input default, variable initial value and setting that the read withholds. No source in the extension or `ui-components` reads that response (grep found only tests). The existing route test that checks `set.body.payload.flow.metadata.humanness` still passes.

## What changed and why

All changes are in Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t898/!FluxIQ/packages/fluxiq/src/server/program-route/`. I did not touch `handle-program-request.ts`.

- **Response seam.** No new seam was needed. `projectPairedClientResponse` already exists, and `handle-program-request.ts` `respond()` calls it only for paired callers; cookie callers go through `withWebRuntimeStatus` instead. I extended that function:
  - It now matches program and endpoint trimmed and lower-cased, the same way the registry's `apiKey` does. No spelling of the name can reach the handler and skip the projection.
  - For `get-flow-metadata-detail` and `update-flow-settings` it calls a new private `projectFlowHumannessDetail`. That function builds the answer from scratch instead of copying and pruning the detail, so a field a handler adds later is not handed out by default:
    - success: `{ ok: true, payload: { flow: { flowId, metadata: humanness is a number ? { humanness } : {} } } }`
    - a missing or malformed Flow: `{ ok: true, payload: { flow: null } }`, which is what a cookie caller gets for a missing Flow
    - a failure: `{ ok: false, error?, errorCode? }` only, with any payload dropped.
  - Its signature changed from generic `<TResponse>` to a concrete `ProgramAnswer` (`{ ok; payload?; error?; errorCode? }`), so the rebuilt object needs no cast. Both callers (`handle-program-request.ts` and the re-export in `apps/web/src/lib/program-route.ts`) still compile.
- **Request narrowing.** In `narrowPairedClientRequest`, `get-flow-metadata-detail` now goes to a new `narrowFlowHumannessRead`. It allows only the keys `projectId` and `flowId`; any other key is refused as "A paired client's Flow settings read may not carry <field>.", including an own `__proto__` key. Both must be non-empty strings, and the payload passed on is rebuilt from those two fields. A GET (no body) is refused. `unlistedField` gained a `subject` parameter, defaulting to the update's wording.
- **Comments.** I updated the allowlist comment and the doc comment of `projectPairedClientResponse`.
- **Exports.** I added none. The file has 569 lines, past the 400-line advisory threshold but under the 800-line limit; it was already 510.

## Tests

- **`tests/program-route.test.ts`** has a new `reading it` block inside the t898 block, with 7 tests:
  - the read takes only `{projectId, flowId}`; extra keys, `__proto__`, missing or non-string ids, an undefined body and an array are each refused by name, and no value is echoed back
  - the projection of a detail with humanness 40, input defaults, variable initial values, settings (`llm.model`, `secretKeyId`, `budgetUsd`, `executionDefaults`), errors, `flowSizeSettings` and a check authorization equals exactly `{ flowId, metadata: { humanness: 40 } }`, and the serialized answer contains no sentinel
  - metadata is `{}` when there is no level, no metadata, or a level that is not a number; a level of 0 is kept
  - `{ flow: null }` for a missing or malformed Flow; a failure keeps only `error` and `errorCode`
  - extra top-level and payload fields are dropped
  - the update's answer is projected the same way
  - mixed-case and padded names are projected and narrowed.
- **`tests/handle-program-request.test.ts`** runs the real registry and a real SQL store. I added a `seed()` helper that saves a Flow with an input default, a variable initial value, `llmModel`, `flowSizeSettings` and a description. It has 6 new tests:
  - a token read with humanness 40 answers exactly `{ ok: true, payload: { flow: { flowId, metadata: { humanness: 40 } } } }`. The spy's result shows the handler did return `ACCT-do-not-leak` and `VAR-do-not-leak`, and the raw body contains none of them.
  - a token read with no level answers `{ flow: { flowId, metadata: {} } }`
  - extra request keys `flow`, `includeInputs` and `name` get a 403 with the exact error, and a GET gets a 403; the registry's `call` is never invoked
  - a cookie read with an extra key: the raw body equals `JSON.stringify(<handler result>)` (byte-identical), with name, description, inputs' `defaultValue` and variables' `initialValue` present
  - a token's update answers only id and level, and `{}` after clearing with null
  - a cookie update's raw body equals the handler's output byte for byte.
- **Mutation check.** I renamed the projection match so it never fired. All 7 projection tests (5 unit, 2 route) then failed and the cookie test still passed. I restored the match, confirmed the `MUTATED` marker was gone, and re-ran (75 pass). The update projection was added and tested after this check.

## Adversarial note

- **Case and whitespace.** The registry resolves `" Get-Flow-Metadata-Detail "` to the same handler, and the projection and narrowing normalise the same way (tested).
- **The other route to the same data.** `update-flow-settings` was a second token-reachable endpoint answering with the full detail, and is now projected. As far as I can find, no other allowlisted endpoint returns a Flow's settings detail: I checked that `get-flow` and `save-flow` are not allowlisted. I did not audit every allowlisted handler's answer for Flow inputs or variables, for example `list-flow-summaries`, `get-flow-run-detail` and `list-flow-subflows`. The comments say summaries hold names and statuses.
- **`authSessionId`.** A token's `authSessionId` is silently removed before narrowing (`withoutAuthSession`), as on every endpoint, so it is not refused by name. This matches the update's existing behaviour and test.
- **Failure messages.** These still pass through as text. Registry refusals and handler throws are sentences such as "not found" or "forbidden"; neither handler puts Flow content in an error.
- **Probing.** A token can still learn whether a Flow id exists in its own bound domain's project (`flow: null` versus an object). Cookie callers can learn the same, and the domain gate still applies.

## Commands run and observed results

- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t898-pair2 -- pnpm --filter fluxiq exec vitest run src/server/program-route` -> final run: "Test Files 3 passed (3) / Tests 78 passed (78)". Earlier: 75 passed before the update projection; 7 failed, 9 passed and 59 skipped with the projection mutated (`-t read`).
- `pnpm structure:check` -> first run, after the read change: "structure-audit: passed (534 warning(s), 969 baselined)". Final run: "1 violation(s)" — `FAIL [directory-files] packages/fluxiq/src/framework/automation-service/tests/: 27 source files exceeds the 25-file limit`. That is caused by another worker's new untracked files there (`answer-first-person-humanness.test.ts`, `run-session-person-humanness.test.ts`), not by this change. My files raise only advisory warnings (exported values 12 > 8, file lines).
- `pnpm --filter fluxiq check` (tsc, through heavy-slot; not required by the brief) -> 6 errors, all in other workers' files: 4 in `engine/automation/pacing/tests/humanness-helpers.test.ts` (`humannessSeed`) and 2 in `programs/automation-studio/api/handlers/tests/flow-settings/tests/flows-humanness.test.ts` (`revision`). There were none under `server/program-route`.

## Not verified

- I did not run a live browser test or the extension side. The extension does not call either endpoint yet (grep of `apps/extension/src`).
- I did not build or run `apps/web`, which re-exports `projectPairedClientResponse`. It is type-compatible, but its typecheck was not run.
- I did not audit other allowlisted endpoints' answers for Flow inputs or variables (see the adversarial note).

## Open questions or contradictions found

- The brief scoped the projection to `get-flow-metadata-detail`, but the goal — every other setting stays cookie-only — also required projecting `update-flow-settings`, so I did that. If a paired client needs anything more than the level back from the update, that would have to be a deliberate widening.
- The structure-audit failure in `framework/automation-service/tests/` is another worker's. It has to be resolved before this lane merges.
