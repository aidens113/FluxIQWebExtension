# Run debug: `run-mun5e1ie-5aeefbbd`

## Header

- Run id: `run-mun5e1ie-5aeefbbd`
- Scenario / variant / task: everything-store / none / `everything-store-kettle-to-cart`
- Command: `run-lab.mjs run everything-store --live-llm --llm-profile production --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task everything-store-kettle-to-cart` with 48000/8000/56000 tokens, 48 calls, $0.25
- Date, provider, model: 2026-09-29 20:47-20:53 UTC, deepseek, deepseek-flash. Facility 82a20780, Core 259a11b.
- Provider calls, tokens, cost: 1 call counted by the Lab. No usage, cost 0.
- Verdict as reported: failed, `runtime.behavior`, `flow_bootstrap.provider_transport_unknown` at `provider_request`, providerInvocation `unknown`, Core HTTP 400. Build duration 239,413 ms.
- **Stage reached:** 2, the first exploration decision call. It never returned a decision.

## Stage 1: the instruction and the expected chain

- The instruction: 345 characters, sha256 `82c49c5b...`. Its text is not copied into the bundle; the Lab keeps only its hash.
- Expected chain (from the task's workflow `add-to-cart`, judged at `extract-cart`, step 22): navigate to the store, find and add the kettles, then add or save the instructed items, open the cart, and extract the cart lines.
- A wrong answer that looks right: the starting cart read without adding anything, which is what `run-mum06sfc` returned.

## Stage 2: exploration

| # | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- |
| 1 | `evidence_tool_decision`, about 14,280 estimated input tokens | none | none | The call threw inside the provider wrapper. Harness code `llm.provider_request_failed`, recorded as `provider_transport_unknown`. |

- Repeats: none.
- Rejections: one, and it said nothing that could be routed around.
- NO EVIDENCE: which check threw. Nothing that reached the bundle held the harness code's origin (see Causes).

## Stage 3: the proposed Flow

- None. The build stopped before a proposal.

## Stage 4: replay

- None.

## Stage 5: the answer

- None. No records were produced or compared.

## Stage 6: judgement and repair

- None. No result existed to judge, so no repair was triggered.

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | A refusal by the execution grant on a call is thrown from inside `provider.runTask` (`runtime/llm/execution/grants.ts` `claimCall`, `validateClaimedGrant`, `ensureLiveAuthorization`, `commitCall`). `provider-retry/call.ts:85` normalises any non-provider throw to `llm.provider_request_failed`, and `flow-bootstrap/generation-failure/harness-failure.ts:212` publishes it as `provider_transport_unknown`. The service's own grant-refusal catch (`service.ts`, `automationStudioLlmExecutionGrantRefusalCode`) never sees it, because the harness already wrapped it. | Core | Grant refusals carry a closed reason, and the normaliser and projection keep them: `flow_bootstrap.execution_grant_*` plus issue code `llm.execution_grant.<reason>`. See `reports/t174-live-lane.md` Fix 1. | t174 |
| 2 | Which grant check refused. | Core | Answered by run 2's record | t174 |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | Which check refused the call | `runtime/llm/provider-contract.ts` `normalizedAutomationStudioLlmProviderFailure` (fixed) |
| 2 | Where the 239 s before the first call went. The bundle has no step or decision trace for a build that failed on its first call. | Lab bundle. t177's `snapshots/decision-trace.json` should cover it after dev is merged. |
