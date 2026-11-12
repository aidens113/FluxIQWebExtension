# W3 t899: FluxNode API error codes and quickstart key step

Outcome: Done (acceptance sdk-acceptance rerun was still running at writing; see Commands).

## Error codes (Core worktree `!FluxIQ`)

| Code | Condition | Can it arise here? | Result | Test |
| --- | --- | --- | --- | --- |
| `invalid_spec` | The body's `spec` is refused (`POST /specs`, inline `spec` on `POST /runs`). | Yes. The contract parse already refuses it; the handler answered `invalid_request`. | Emitted: `server/fluxnode-api/body-refusal-code.ts` (new) picks `invalid_spec` when every issue path is `/spec` or below, else `invalid_request`; used in `api-handler.ts` `readBody`. 400. | `tests/body-refusal-code.test.ts`; `tests/api-handler.test.ts` (three cases: bad spec on specs, on runs, body outside spec stays `invalid_request`) |
| `no_host` | No connected host for runtime `web`. | The condition can occur, but a refusal here would be wrong. `start` returns as soon as the run is under way and the run, not the call, meets a missing browser; no code in `service/fluxnode` or the handler checks for hosts, and "a task ends only with its result or budget" forbids a new refusal ending. Emitting needs a change in `service/fluxnode/**` (not mine). | Removed from contract, status map, docs. | `contracts .../http/tests/api.test.ts` ("names only codes the engine or the SDK can meet") |
| `rate_limited` | Too many calls. | No. Core's only rate limit is the client-gateway websocket (`client-gateway-websocket/rate-limit.ts`); the FluxNode HTTP API has none, and it is single-owner loopback. | Removed. | same |
| `unavailable` | Engine cannot take the call now. | No. The listener is up or the connection fails (SDK `connection`); nothing answers "not now". | Removed. | same |
| `unauthenticated` | No valid key or session. | Not on the local engine today: open mode only (`check-open-mode-guards.ts` answers `forbidden`); server half of key sessions (`/api/keys/session`) is "P3b" and absent in `packages/fluxiq/src`. | Kept. `sdk/src/client/transport.ts:40` renews the session and repeats once on any 401, `session/create-session.ts` and the SDK fake engine speak it, and `fluxiq dev` prints "Run `fluxiq keys secure` to require one", so a key-requiring engine (local P3b or hosted W5) answers it. Docs now say the open-mode engine never sends it. Caveat: the SDK keys on status 401, not the code; an unknown code would fall to the loose parse path and still work. Removing it is a judgement call; say so if you want it gone. | `api.test.ts` asserts 401; existing `transport.test.ts`, `create-session.test.ts` |

Left in place and flagged: `retryAfterMs` (error body field, `Retry-After` header writer, `FluxNodeApiError.retryAfterMs`, `FluxNodeServiceRefusal.retryAfterMs` at `service/fluxnode/fluxnode-service.ts:39`) is now emitted by nothing. I did not remove it because the service type is in the other worker's directory. Docs say the local engine sends none. Decide whether to drop it as a follow-up.

## Quickstart key step (`docs/fluxnodes/README.md`, quickstart)

Finding: there is no env var or file. Nothing in `packages/fluxiq/src` or `packages/sdk/src/cli/dev-command.ts` reads a provider key (`dev-command.ts` only spawns the engine's `fluxiq dev`; `server/cli/run-dev.ts` prints "Host: ..." and no key line).
- The key is a Secret Keys entry (`kind: "llm"`, provider Anthropic or DeepSeek), resolved per call: `runtime/models/secrets/session-key.ts:55-85` (`releaseAutomationStudioSessionProviderKey`; `callerKeys` at ~L131; error "There is no enabled ... key of yours in Secret Keys." at L59; `AutomationStudioSecretsLockedError` at L84), bound in `programs/_shared/runtime.ts:280-300`.
- Model choice: `FLUXIQ_LLM_DEFAULT_MODEL`, `runtime/models/catalog/default-model.ts:3`.
- Missing key: `runtime/answer-first/pre-model/table.ts:36,89-90` ("No model is available for this. Add or unlock a model key in FluxIQ's settings, then ask again."). Locked key: `service/fluxnode/result-of.ts:29` (`model_key_locked`, run ends `waiting_for_person`).
- Documented exactly that, no value printed or invented.

Gap you should know (not documented as working, not verified): the FluxNode caller is `{ actorUserId: "fluxnode.owner", actorSessionId: "fluxnode.open-mode" }` (`create-fluxnode-service.ts:56`). `callerKeys` offers only keys created by that user or keys with no creator, and the unlock must hold the key. The planned owner vault wrap for local sign-in (`docs/working/fluxnode-plan/reports/panel-design.md:251`, item H) is not in the tree (`secret-keys/runtime/unlocks` has none). So a headless `fluxiq dev` with a panel-added, locked key will likely end `model_key_locked`. I could not run this end to end. A real fix (read the owner's key from an env var or the vault wrap) belongs in `service/fluxnode/**` or secret-keys, outside my brief.

## Changed files (Core)
- `packages/fluxiq/src/server/fluxnode-api/{body-refusal-code.ts (new),api-handler.ts,index.ts,tests/body-refusal-code.test.ts (new),tests/api-handler.test.ts}`
- `packages/contracts/src/fluxnode/{http/error-status.ts,run/error.ts,http/tests/api.test.ts}`
- `docs/fluxnodes/{README.md,reference/errors.md,reference/http-api.md}` (`limits.md` needed no change; SDK needed none: it names no removed code.)

## Commands run and observed
- `pnpm --filter fluxiq exec vitest run src/server/fluxnode-api` (before edits to the handler took effect): 3 files, 37 tests passed. After edits: `api-handler.test.ts` + `body-refusal-code.test.ts` 30 passed.
- `pnpm --filter @fluxiq/contracts exec vitest run src/fluxnode`: 26 files, 142 passed; `src/fluxnode/http` after adding the test: 10 passed.
- `pnpm --filter @fluxiq/sdk exec vitest run`: 19 files, 98 passed, 2 skipped.
- `node scripts/structure-audit.mjs`: passed (531 warnings, 969 baselined; none from my files).
- `pnpm docs:check`: passed (docs-links 0 warnings; "Deterministic framework reference is current.").
- `sdk-acceptance.test.ts` rerun after the edits: started in background, not read at time of writing.

## Not verified
- No typecheck run (`tsc`) of fluxiq/contracts/sdk; grep shows nothing else imports the removed codes.
- Whether a `web` run with no browser waits or ends otherwise (the basis for removing `no_host`).
- The key flow end to end, and the user-visible wording of the missing-key case through a FluxNode run.

## Open questions
- Keep or drop `unauthenticated`; drop `retryAfterMs` everywhere.
- Owner key custody for headless `fluxiq dev` (see Gap).
