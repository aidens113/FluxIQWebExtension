# t342 — Run-4 provider-free dry-run audit

## Decision

**GO for the dry-run gate.** The supplied sanitized result satisfies t331/t332's provider-free readiness contract: the exact frozen run-4 arguments were used with only `--dry-run` added, environment-file loading was isolated to the process, the command exited 0 with parseable `status: "ready"`, and it reported `providerCallCount: 0`, lane `created-flow`, target `isolated`, and no run artifact.

This is readiness evidence only. It does not itself authorize the provider call or replace t332's required second immediate process/lock/machine gate.

## Contract comparison

| Gate | Supplied sanitized observation | Audit |
| --- | --- | --- |
| Invocation | t331's exact frozen arguments plus `--dry-run`; process-only environment-file isolation | PASS |
| Provider/run isolation | exit 0; parsed ready; `providerCallCount: 0`; no run artifact | PASS |
| Lane and target | `created-flow`; `isolated` | PASS |
| Selection | scenario `everything-store`; workflow `plus-under-fifty`; instruction task `everything-store-plus-earbuds-under-50` | PASS |
| Oracle | `expected-dataset`, `extract-plus-under-fifty`, step 16 | PASS |
| Replay | `--replays 1` accepted by command parsing | PASS; replay count is an execution option, not a field in the dry-run live-plan description |
| Live plan | DeepSeek; task `create-flow`; purpose `build_and_adapt` | PASS |
| Authorization ceilings | 26 calls; 560,000 run tokens; 25,000 ms effective timeout; USD 0.25 per call; USD 2 total | PASS |

The values are ceilings, not predictions of calls, tokens, duration, or spend.

## Token-limit selector clarification

The three reported nulls are **not missing authorization**. They resulted from selecting nonexistent fields `tokenLimits.input`, `tokenLimits.output`, and `tokenLimits.total`.

The source-defined and serialized dry-run shape is:

- `tokenLimits.maxInputTokens`: **48,000**
- `tokenLimits.maxOutputTokens`: **8,000**
- `tokenLimits.maxTotalTokens`: **56,000**

`commands.ts` supplies the unchanged defaults as `maxInputTokens: 48_000`, `maxOutputTokens: 8_000`, and `maxTotalTokensPerRequest: 56_000`. `planLiveLlmExecution` converts the last name to the live-plan field `maxTotalTokens`, and `LiveLlmRun.describe()` emits the resulting `plan.tokenLimits` object unchanged. Therefore querying the shorthand names can serialize as null in a reporting projection while the authorization is present and valid.

The same source path also explains the other effective defaults: `create-flow` maps to iterating purpose `build_and_adapt`; 26 is the default call ceiling; the absent run-token override resolves to Core's 560,000-token threshold; the 30,000 ms profile default clamps to Core's 25,000 ms maximum; and total estimated cost clamps to `min(USD 2, USD 0.25 × 26) = USD 2`.

## Privacy and scope

No credential value, raw stdout object, instruction body beyond the already-authored Stage-1 contract, provider/page content, hash, or artifact content was used or reproduced. I did not open `test-runs`, invoke a provider, repeat the dry-run, run a browser/Lab command, or modify source/shared documentation/generated output. This report is the only file written.
