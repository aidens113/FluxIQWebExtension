# Lane S-F: Core owns the recording-capture and direct-request policy (t728, audit finding 7)

## Outcome

Done on the Core side, in `C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQ`. Nothing committed and no dist built. The web vitest files could not run, because the web vitest config will not run against a stale Core dist and the brief forbids building it (see Not verified).

## What changed and why

### 1. Policy definition (browser-safe), `@fluxiq/contracts/automation-studio`

New directory `packages/contracts/src/recording-capture/`, re-exported from `packages/contracts/src/automation-studio.ts`:

- `policy.ts` holds the types:
  - `AutomationStudioRecordingCaptureSwitchPolicy = { allowed: boolean; default: boolean }`
  - `AutomationStudioRecordingCapturePolicy = { captureInputValues, captureSnapshots, captureMutations: SwitchPolicy; directRequests: { allowed: boolean } }`
  - `AutomationStudioRecordingCaptureSettings = { captureInputValues, captureSnapshots, captureMutations, directRequests: boolean }`, the effective settings
  - `AutomationStudioRequestedRecordingCaptureSettings = Partial<AutomationStudioRecordingCaptureSettings>`
- `default-policy.ts` holds `AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY`, deep-frozen. Every capture switch is `{ allowed: true, default: true }` and `directRequests` is `{ allowed: false }`. This matches today's behaviour: the extension has all three switches on and requests off, and the domain's request policy defaults to `enabled: false`.
- `clamp.ts` holds `clampAutomationStudioRecordingCaptureSettings(requested, policy): AutomationStudioRecordingCaptureSettings`:
  - A switch the policy forbids is always `false`.
  - An allowed switch takes the requested boolean, or the policy default when the request is absent or not a boolean.
  - `directRequests` is `policy.directRequests.allowed && requested.directRequests === true`.
- `index.ts` is the barrel. `tests/clamp.test.ts` has 9 tests.

Import paths:
- **Extension and domain (browser code):** `import { AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY, clampAutomationStudioRecordingCaptureSettings, type AutomationStudioRecordingCapturePolicy, type AutomationStudioRecordingCaptureSettings, type AutomationStudioRecordingCaptureSwitchPolicy, type AutomationStudioRequestedRecordingCaptureSettings } from "fluxiq/automation-studio/nodes";`
  - These are re-exported by name in the new `packages/fluxiq/src/programs/automation-studio/nodes/recording-capture.ts` and added to `nodes/index.ts`. Test: `nodes/tests/recording-capture.test.ts`.
  - Do not import them from the `fluxiq/automation-studio` barrel, which pulls in `node:crypto`.
- **Core:** `@fluxiq/contracts/automation-studio`, using the same names.

### 2. Read endpoint `get-recording-capture-policy`

- `AUTOMATION_STUDIO_ENDPOINTS.getRecordingCapturePolicy = "get-recording-capture-policy"` is in `api/contracts/endpoints.ts`. That file also carries another worker's uncommitted `getFlowSpend` line, which I left untouched.
- The request and response types are at the end of `api/contracts/recording.ts`, which is exported from `fluxiq/automation-studio` via the api contracts barrel:
  - `GetRecordingCapturePolicyRequest = { projectId?: string | null }`
  - `GetRecordingCapturePolicyResponse = { policy: AutomationStudioRecordingCapturePolicy }`
- The handler is registered first in `registerRecordingEndpoints` in `api/handlers/recordings.ts`, with permission `programs.read` and classification `read`.
  - It reads `projectId`: a trimmed non-empty string, otherwise `null`.
  - It answers `{ ok: true, payload: { policy } }`.
- I put the endpoint in the recordings files because recordings own capture, and no new file was needed. `api/handlers/` already holds 25 files, the limit.
- **The seam for a per-project store** is the optional `recordingCapturePolicy?: (projectId: string | null) => Promise<AutomationStudioRecordingCapturePolicy>` on `AutomationStudioApiDependencies` (`api/handlers/dependencies.ts`). When it is left out, which is the case today because `register.ts` does not set it, the endpoint answers `AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY`. To wire a store later, `registerAutomationStudioApi` supplies the field.
- There are 4 new tests in `api/handlers/tests/recordings.test.ts`:
  - the endpoint is registered as a read under `programs.read`
  - it answers the default with a project, without one, and with an undefined payload
  - when a source is injected, the source receives the trimmed project id, or `null` for a non-string id
  - a caller without `programs.read` is refused

Example: `POST /api/programs/automation-studio/get-recording-capture-policy` with body `{ "projectId": "p1" }` returns `{ ok: true, payload: { policy: { captureInputValues: {allowed:true,default:true}, captureSnapshots: {allowed:true,default:true}, captureMutations: {allowed:true,default:true}, directRequests: {allowed:false} } } }`.

### 3. Paired-client allowlist

- `apps/web/src/lib/program-route.ts` now lists `"get-recording-capture-policy"` in `PAIRED_CLIENT_ENDPOINTS["automation-studio"]`, with a comment marking it as a read that is not projected.
- No request narrowing is needed. The route's project-domain gate applies to `projectId` as it does for every allowlisted endpoint.
- The tests were updated to match:
  - `apps/web/src/lib/tests/program-route.test.ts`: the exact-list assertion now includes the new endpoint, and an `isPairedClientEndpoint(...) === true` check was added.
  - `apps/web/src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts`: the `ALLOWLISTED` and `CLASSIFICATIONS` mirrors now include it as `read`.

## Commands run and observed results

- `npx vitest run src/recording-capture` in `packages/contracts`:
  - before the implementation: 1 file failed to load (red)
  - after: `Test Files 1 passed (1)`, `Tests 9 passed (9)`
- `npx vitest run src/programs/automation-studio/nodes/tests/recording-capture.test.ts` in `packages/fluxiq`: `2 passed`.
- `npx vitest run .../api/handlers/tests/recordings.test.ts`: `Tests 9 passed (9)`.
- Final rerun of the two files above after the as-never fix: `Test Files 2 passed (2)`, `Tests 11 passed (11)`.
- `pnpm --filter @fluxiq/contracts check`: exit 0.
- `pnpm --filter fluxiq check`: exit 0. The build cache says "not stamped, because inputs changed while it ran". Other workers are editing the tree.
- `pnpm --filter @fluxiq/web check`: exit 0, with the same cache note.
- `node scripts/structure-audit.mjs`:
  - first run: 1 FAIL, `[as-never]` for my `service: {} as never` in `recordings.test.ts`. I replaced it with `{} as AutomationStudioApiDependencies["service"]`.
  - rerun: `structure-audit: passed (412 warning(s), 1152 baselined)`.
- Web vitest (`src/lib/tests/program-route.test.ts`, `route.test.ts`, `route-domain-gate.test.ts`): not run. The vitest config's `refuseStaleCoreBuild` refused with "The web tests import the COMPILED dist ... Rebuild ... pnpm --filter @fluxiq/contracts --filter fluxiq build", and the brief forbids building dist.

## Not verified

- The three web vitest files above did not run because of the stale-dist guard. The edits are mechanical additions to list mirrors, and `pnpm --filter @fluxiq/web check` passes. The supervisor should run them after a Core build.
- I did not run the handler tests red before implementing them; they were written first and then run together with the implementation.
- I made no extension or domain changes, and none were in scope. The extension still uses its own defaults and hard-coded `requestsEnabled: false`, and the domain still keeps `requests/policy/validation.ts`, until a downstream brief adopts the clamp and the endpoint.
- No browser or live validation.

## Open questions or contradictions found

- The brief calls D read-only but gives the report path inside D. I wrote only this report file there.
- `api/contracts/endpoints.ts` and `api/handlers/recordings.ts` sit beside other workers' uncommitted edits in the same tree (`getFlowSpend` in `endpoints.ts`). My hunks are separate, so the supervisor should commit by hunk if the tasks are split.
- The policy is per project in shape only. When a store arrives, decide whether a paired client's request with no project should resolve the session's current project. The route's `pairedClientProjectTarget` already gates the project it names.
