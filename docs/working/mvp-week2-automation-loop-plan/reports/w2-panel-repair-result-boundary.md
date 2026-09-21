# w2-panel-repair-result-boundary

Status: blocked at one terminal live provider result; no retry performed.

## Scope and isolation

- Downstream: `F:\fxlab\t027-repair-result\!FluxIQWebExtension` at t027 head `b5bedf4`.
- Core: `F:\fxlab\t027-repair-result\!FluxIQ` at t027 head `949735d`.
- Disposable live workspace: `F:\fxlab-runs\t027-repair-result\workspace-correct`.
- Panel/gateway: loopback 3364/4934. User port 3000 and user data were untouched. Both isolated listeners were closed at the end.
- Existing local panel/provider credentials were loaded only into the live processes. No credential, response body, page data, or recorded value is included here.

## Live-first result

1. The copied failed run was inspected from durable, sanitized state. Diagnosis had succeeded, while the patch result had no response and carried `llm.provider_input_budget_exceeded`. Its saved estimate (2,472) covered the request envelope, whereas the provider adapter also counted the system prompt and runtime-patch schema; the old 4,000-input profile could not hold the actual visible request.
2. The real Settings UI initially refused the current 48,000/8,000/56,000 profile because its stale UI ceiling was 50,000. The UI/model ceiling was aligned with Core's existing 64,000 per-request hard limit; the Flow settings then saved through the real panel.
3. The real high-token confirmation modal appeared. The driver now waits up to 15 seconds for authenticated preflight instead of treating a cold two-second delay as absence.
4. A pre-provider live run stopped at the grant boundary. Bounded diagnostics identified `llm_grant.key_session_locked`. This was isolated provisioning: an administrator password reset authenticated the copied user but could not re-seal that user's provider key. An untouched copy was restored and the already-authorized local credentials were used process-locally.
5. The one authorized provider-bearing run then crossed the real UI confirmation and grant boundary. Timing from sanitized browser evidence:
   - Run click: `2026-09-21T01:48:10.315Z`.
   - Confirmation observed: `01:48:11.684Z` (1.369 s).
   - First visible runtime action: `01:48:18.331Z`.
   - Runtime action complete: `01:48:19.413Z`.
   - Panel run response complete: `01:48:34.930Z` (24.615 s after click).
6. Durable terminal projection: status `failed`; provider calls `2`; interventions `1` (`diagnosis`); adaptations `0`; change proposals `0`. The diagnosis returned and the patch provider call was spent, but no reviewable patch/proposal was produced. No second provider attempt was made.

The review/apply/oracle/restart phases were correctly not entered because the terminal run produced zero proposals rather than exactly one.

## Root boundaries and candidate changes

Core candidate files:

- `packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/annotate.ts`: carry the first categorical patch error into the recovery trace when a patch result has no usable response.
- `packages/fluxiq/src/programs/automation-studio/runtime/recovery/stages.ts`: record resolution as `failed / patch_failed`, including only the bounded failure code, rather than `skipped / no_change_produced`.
- `packages/fluxiq/src/programs/automation-studio/api/handlers/llm-generation.ts`: project allowlisted grant-issue codes such as `llm_grant.key_session_locked`; never return underlying exception text.
- `apps/web/src/features/automation-studio/settings/flow-settings-model.ts` and `FlowSettingsView.tsx`: align the stale 50k UI validation/labels with Core's 64k request ceiling.
- Direct focused expectations updated in `runtime/recovery/tests/stages.test.ts`, `api/handlers/tests/llm-generation.test.ts`, and `settings/tests/settings-view.test.tsx`.

Downstream candidate files:

- `packages/test-runner/src/demo-llm-adaptation.ts`: use shared current 48k/8k/56k, 30-second request limits for runtime repair.
- `packages/test-runner/src/demo-workspace/adaptation-ui.ts`: tolerate cold authenticated preflight before the high-token modal.
- `packages/test-runner/src/demo-workspace/panel-run.ts`: convert preparation failures to a small allowlist of closed codes.
- `packages/test-runner/src/tests/demo-llm-adaptation.test.ts`: align the pinned profile expectation.

No commits or pushes were made.

## Focused validation after live progress

- Core focused: recovery stages, recovery annotation, and LLM generation handler — 53/53 passed.
- Web focused: Settings view/model — 15/15 passed.
- Downstream build: `@fluxiq-web-extension/test-runner` passed.
- Downstream directly owned compiled tests: adaptation profile and adapting-run timeout — 17/17 passed.
- An attempted package-scoped test command unexpectedly expanded the package's full `dist/**/*.test.js` suite despite file arguments. It was not used as the validation claim; the command reported 1,190 passes and 5 failures, including two invalid raw-TypeScript arguments added to that command. This was broader than intended. The two owned compiled files were subsequently run directly and passed 17/17.
- No repository-wide check/test/build suite was intentionally run.

## Next exact product boundary

The provider-backed patch call is still not durably explainable through the downstream run-detail projection: two calls were counted, only the diagnosis intervention survived, and zero proposal was recorded. The new Core recovery-trace path should be verified against this exact malformed/invalid patch-result case, and the downstream run-detail parser must expose the bounded `failureCode` if Core persisted it. Do not retry the model until the same terminal result can be classified from durable state.

## Reusable capability observation

The journey exposed a useful browser-domain capability gap, though it did not prove that gap caused this terminal result: semantic target drift currently asks repair logic to infer a replacement selector from general evidence. A reusable, bounded native web node that enumerates actionable elements by role/label and returns opaque candidate identities would give creation and repair the same deterministic evidence seam, reduce free-form selector generation, and be reusable across click/fill/select actions. This should be scoped as a downstream web-automation node (DOM/browser concepts prevent promotion to generic Core) and evaluated separately after the durable patch-failure code is visible.

## Disposable residue

The live processes and isolated listeners were stopped. The preserved workspace contains the sanitized evidence needed for supervisor verification. Temporary launcher/inspection helpers contain no literal credentials; cleanup was attempted but the environment rejected deletion, so the supervisor should remove the explicit helpers/archive under `F:\fxlab-runs\t027-repair-result` during normal Lab cleanup.
