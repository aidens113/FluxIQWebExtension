# W2 repair/reuse live report

## Result

Status: **blocked before the first provider request**. The isolated real Chromium
lane reached Core's `Confirm high-token Flow Build` dialog, but the downstream
exploration driver deliberately refuses to confirm it. No model decision was
made or retried, so the requested drift / repair / apply / rerun / restart-reuse
matrix could not begin.

The run did prove and repair one prerequisite driver defect first: three exact
label locators in the blank-project dialog were stale against the current Core
form semantics. The isolated candidate now reaches and completes blank Flow
preparation through the panel UI.

## Frozen candidate and isolation

- Downstream: `748aca844131f541eee17bbdb8ba521a20987dd6` at
  `F:\fxlab\t027-repair-reuse\!FluxIQWebExtension`.
- Core: `042562ea644dd2282ff7b436a174be53b8581b44` at
  `F:\fxlab\t027-repair-reuse\!FluxIQ`.
- Effective run root: `F:\fxlab-runs\t027-repair-reuse-v2`; workspace and both
  browser profiles are beneath that root.
- Unique panel/gateway endpoints: `127.0.0.1:3347` and `127.0.0.1:4897`.
- Scenario: `instruction-only-form`, whose registered oracle is
  `Submitted: Ada / team` after type/select/click.
- The user's port-3000 panel, profile, data, t028 candidate, recording lane, and
  batch lane were not read, stopped, restarted, or mutated.

## Live evidence and timings

| Stage | Result | Wall time | Exact evidence |
|---|---:|---:|---|
| Provider-key setup in fresh v2 root | passed | not separately instrumented | Sanitized setup attestation passed; no model call. |
| First fresh blank preparation | failed | 62,289 ms | Create-project dialog opened; `blank-project-name` timed out after 30,088 ms because the driver required exact accessible label `Project name` while current Core exposes required-field semantics. |
| Preparation after name repair | failed at next locator | 81,164 ms | `blank-project-name` passed; `blank-project-description` timed out after 30,086 ms. |
| Preparation after description repair | failed at next locator | 64,088 ms | Name and description passed; `blank-project-pin` timed out after 30,016 ms. |
| Preparation after normalizing the three dialog label assumptions | **passed** | 58,471 ms | Real panel UI created the project and genuinely blank Flow. Prepared project `8c98cd9c-f7d3-4fad-b49a-89d3072ae8db`; seed blank Flow `flow.63f00024-85bf-47d6-9eb5-995cb0e9f2b1`. |
| Evidence-guided creation proposal | **blocked** | 25,524 ms command; 12,709 ms evidence run | UI reached `Confirm high-token Flow Build` after instruction entry and target reactivation. Sanitized diagnostic says `apiRequestObserved:false` and `confirmationAttempted:false`; therefore provider calls = 0. |

The creation evidence run contains 113 events and 92 screenshots. Its last
passed UI action was `explore-propose`; the next observable state was the
high-token confirmation dialog. The dialog displayed the configured input,
output, per-call, run, call-count, timeout, cost, and retry bounds before any
request left the panel.

## Isolated driver repair

Only
`packages/test-runner/src/demo-llm-blank-workspace.ts` changed in the isolated
candidate. The patch removes `{ exact: true }` from the `Project name`,
`Description`, and `Security PIN` `getByLabel` calls. It does not alter product
form semantics, values, sensitive evidence suppression, authentication, or
password-manager behavior. Successive real-UI reruns proved each repaired
locator and the final blank-preparation pass. No unit or full suite was run.

This source diff remains uncommitted in the isolated candidate; it was not
copied into t027 `dev` by this worker.

## First remaining blocker and mutation boundary

The blocker is intentional driver policy in
`demo-llm-create-ui/explore-proposal-ui.ts`: any
`high_token_confirmation` terminal calls `fail(...)` rather than selecting
`Continue high-token build`. The sanitized diagnostic also exposes a contract
disagreement worth resolving before changing that policy:

- Core's visible dialog says the 312,000-token run requires confirmation above
  100,000 tokens.
- The downstream diagnostic records aggregate authorized tokens 560,000,
  confirmation threshold 560,000, and
  `configuredProfileRequiresConfirmation:false`.

The current brief did not authorize changing this high-token confirmation
policy, so mutation stopped there. Continuing live requires one narrow driver
decision: explicitly authorize and evidence the real UI confirmation for this
bounded test lane, while retaining fail-closed behavior elsewhere and aligning
the diagnostic threshold with Core's current contract. That would be a source
change, not a retry of a model decision, because no provider request occurred.

## Requested matrix status

| Required checkpoint | Status |
|---|---|
| Same created Flow identity established | blocked before bound creation proposal |
| Intended target-drift failure | not run |
| LLM diagnosis and repair proposal | not run |
| Reviewable repair and apply | not run |
| Repaired rerun plus manifest oracle | not run |
| Runtime restart and saved reuse | not run |
| Restarted reuse provider calls = 0 | not run |

There is no creation adaptation ID, repair adaptation ID, failed run ID,
repaired run ID, or reuse run ID to report. Reporting any continuity claim from
the prepared seed Flow would be false.
