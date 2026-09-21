# w2-panel-repair-result-boundary

Status: result boundary repaired and verified provider-free through the real managed panel/runtime; no retry performed.

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
6. Durable terminal projection: status `failed`; provider calls `2`; interventions `1` (`diagnosis`); adaptations `0`; change proposals `0`. Subsequent durable-event inspection corrected the first interpretation: call 2 was `evidence_tool_decision`, not `runtime_patch`. The structured diagnosis said `patchNeeded: false`, `stillAchievable: no`, and `explorationNeeded: true`; therefore no patch call was made. No second provider attempt was made.

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

## Provider-free result-boundary continuation

The terminal result is now durably explainable. The root cause was not malformed patch output: Core ran exploration when the plan requested a look even though its unachievable verdict made `patchRequest.request` false. Since recovery does not re-plan after exploration, the evidence had no consumer and could never become a patch or proposal. The downstream wait then compounded this by requiring two interventions even after the run was terminal; this run had only its diagnosis intervention, so the driver waited indefinitely.

Smallest candidate repair:

- Core `runtime/recovery/annotation/annotate.ts` now runs exploration only when the plan both requests exploration and requests a patch, publishes `llm.runtime_patch_not_requested` (or the corresponding closed grant/unavailable code), and carries it into recovery resolution detail. Patch-call failures remain separately classified with their bounded diagnostic code.
- Core `runtime/recovery/stages.ts` records the closed `skipCode` for a skipped resolution and the bounded `failureCode` for a failed patch result.
- Downstream `existing-fluxiq-control.ts` reads the published closed code and derives `llm.runtime_patch_not_requested` for preserved older evidence that has `patchSkipped` plus `structuredDiagnosis.patchNeeded === false`.
- Downstream `demo-llm-exploration-adaptation-wait.ts` treats every terminal status as terminal and includes only the bounded recovery code when no exact proposal exists.
- Downstream `demo-workspace/adaptation-lane.ts` exposes that bounded code in the sanitized state projection.

Provider-free live verification used the preserved actual run through a freshly started authenticated managed panel/runtime on unique loopback ports 3367/4937. The result was: `failed`, one `diagnosis` intervention, provider-call count still `2`, zero adaptations, zero change proposals, and `recoveryCode: llm.runtime_patch_not_requested`. This read created no run and made no provider request. All isolated listeners were closed afterward.

Focused validation after that live result:

- Core annotation + recovery stages: 38/38 passed (the command explicitly excluded generated `.tmp` build copies).
- Downstream test-runner build passed.
- Downstream run-detail parser + terminal wait tests: 25/25 passed by direct compiled-file invocation.
- `git diff --check` passed in both isolated repositories (line-ending notices only).
- No broad suite was run.

## Reusable capability observation

The journey did **not** justify a new actionable-elements node. `web.dom.capture_snapshot` already captures interactive elements, and `web.inspect_current_page` already sanitizes them into bounded `web-llm-evidence.v2` elements carrying opaque target handles plus semantic `tag`, `role`, accessible `name`, visible text, control type, form/landmark/heading context, and frame identity. The downstream target validator already checks action compatibility and recorded-target equivalence. A duplicate node would reproduce an existing capture/sanitization seam.

The smallest reusable missing capability is instead a deterministic **repair-candidate projection/ranker** over the existing failure/current-page packet: filter elements by the failed action's repairable parameter role, compare them with the recorded fingerprint using the existing equivalence rules, and expose only a bounded ordered list of opaque handles plus closed match/refusal categories to the repair prompt. This belongs in downstream `domain/src/runtime/llm-evidence/target/` and can be attached to the existing failure-evidence/runtime binding; Core should remain browser-neutral and merely carry the bounded candidate projection.

## Disposable residue

The live processes and isolated listeners were stopped. The preserved workspace contains the sanitized evidence needed for supervisor verification. Temporary launcher/inspection helpers contain no literal credentials; cleanup was attempted but the environment rejected deletion, so the supervisor should remove the explicit helpers/archive under `F:\fxlab-runs\t027-repair-result` during normal Lab cleanup.
