# T027 Panel Preflight Diagnosis

Status: Reproduced; Core-owned evidence-runtime/diagnostic seam identified
Date: 2026-09-20
Worker: `w2-t027-panel-preflight-diagnosis`

## Live-first result

The production `pnpm panel:golden` lane was rerun in headed Chromium against
the isolated panel/Core pair on ports `3357` and `4927`. The user's port-3000
panel was not touched.

Preparation passed again:

- run: `demo-llm-blank-prepare-2026-09-20T23-52-00-230Z-af97d2`

Exploration reproduced the same first product blocker:

- run: `demo-llm-explore-2026-09-20T23-52-36-892Z-dfc6ee`
- elapsed: `20.880 s`
- event/screenshot counts: `124` / `100`
- HTTP status: `400`
- closed stage: `pre_provider_validation`
- closed reason code: `flow_bootstrap.pre_provider_validation_failed`
- provider call count: `0`
- response parsed: `true`
- issue codes: none supplied by Core
- proposal persisted: no

The high-token confirmation was explicitly approved and the observer waited
for the real response; this was not the previously fixed modal busy race.

## Contract trace

The downstream request is the production UI contract: project, Flow, grant,
and `evidenceGuided: true`. It passed request parsing, blank-Flow validation,
canonical settings/grant validation, active-instruction validation, node
catalog construction, required-capability selection, and provider resolution.
Those earlier paths have their own closed reason codes.

Core then enters the evidence-guided branch in
`packages/fluxiq/src/programs/automation-studio/runtime/service.ts`. At line
`1903`, it requires a non-empty host-bound `llmEvidenceRuntime.tools` and emits
exactly the observed generic code when that binding is unavailable:

```text
if (!this.llmEvidenceRuntime?.tools.length)
  throw flowBootstrapPhaseFailure(
    "pre_provider_validation",
    undefined,
    "flow_bootstrap.pre_provider_validation_failed"
  );
```

The downstream host does register the expected runtime:

- `domain/src/web-panel-host.ts` calls `registerWebAutomationRuntime(fluxiq)`;
- `domain/src/runtime/service.ts` calls
  `bindWebAutomationLlmEvidenceRuntime(fluxiq)`;
- `domain/src/runtime/llm-evidence/tools.ts:415-420` binds a runtime containing
  the five web evidence tools.

Therefore there is no downstream request/Flow-settings correction to make.
The failing seam is Core's live web-runtime availability of that already-bound
host evidence runtime (or an exception immediately before the explicit check).
Core currently makes those two cases indistinguishable: its catch at
`runtime/service.ts:2024-2027` also collapses an unexpected exception while the
preflight fallback is active to the same generic code.

The exact Core follow-up is to preserve a distinct closed code for an absent
evidence runtime (for example an evidence-runtime-unavailable member of the
published pre-provider vocabulary), and then trace why the API request's
`AutomationStudioService` instance does not see the binding registered by the
host. The web runtime's bounded status surface also does not currently project
evidence-runtime binding/tool count, so it cannot disambiguate this without a
Core change. Per brief, this lane did not edit Core.

## Downstream observability

No new downstream source edit was needed. The existing sanitizer already
projects the response as the closed stage code
`generation.pre-provider-validation`, keeps only Core-published reason codes,
and admits only bounded literal issue codes. The exploration evidence recorder
emitted the closed reason and bounded numeric facts only. No response body,
prompt, page data, key, token, or credential was retained in this report.

## Narrow check after live

The panel run rebuilt the affected packages successfully. After the live
reproduction, only the directly owned sanitizer/evidence tests ran:

```text
node --test \
  packages/test-runner/dist/demo-llm-create-ui/tests/failure-sanitizer.test.js \
  packages/test-runner/dist/demo-llm-create-ui/tests/exploration-failure-evidence.test.js \
  packages/test-runner/dist/demo-llm-create-ui/tests/refused-plan-issue-codes.test.js
```

Result: `7/7` passed. No broad suite ran.

Assigned ports were closed after the run. Artifacts were preserved. No commit
or push was made.
