# t027 real-provider single-action baseline

Status: Live run complete; product failure found
Updated: 2026-09-20
Worker: `w2-t027-provider-baseline`

## Result

The frozen single-action candidate did not reach a provider completion or
create a Flow. Core stopped the build at `provider_request` with
`flow_bootstrap.provider_evidence_loop_context_invalid`. This is a product
runtime failure, not a provider transient: the provider gate was entered, but
there is no recorded HTTP/provider call, token use, or cost to retry away.

Run: `run-muafn7g4-81347d25`

## Frozen provenance and configuration

- Downstream commit: `0fd9d0d2dfe61bf59475ac7661406cf60fc5eccf`
- Core commit: `ef7892fc50b19667400c4fcb6be82f2e826e6fc0`
- Both validation worktrees were clean when inspected and `run.json` records
  both repositories as `dirty: false`.
- Downstream worktree: `F:\fxlab\t027-baseline\!FluxIQWebExtension`
- Paired Core worktree: `F:\fxlab\t027-baseline\!FluxIQ`
- Instance: `t027-baseline`
- Run root: `F:\fxlab-runs\t027-baseline`
- Target/browser: isolated Chromium, `Chrome/134.0.6998.35`
- Scenario/task: `social-scheduler` /
  `social-scheduler-schedule-post`
- Provider/model/task: DeepSeek / `deepseek-chat` / `create-flow`
- `maxActionsPerDecision`: `1`, confirmed in the live snapshot
- Budget: 48,000 input, 8,000 output, 56,000 total per request,
  600,000 per run, 26 calls, USD 0.25, zero provider retries
- Test environment-file loading remained disabled. The existing credential
  was held only in the retry process environment and was not printed,
  persisted, or copied into this report.

## Measured outcome

| Measure | Observed |
| --- | --- |
| Evaluation duration | 93,754 ms |
| Build duration | 9,378 ms |
| Evaluation LLM calls | 1 |
| Provider invocation | `attempted` |
| Recorded provider calls | 0 |
| Input / output / total tokens | 0 / 0 / 0 |
| Estimated cost | USD 0 |
| Browser actions | 0 |
| Completed action batches | 0 |
| Flow proposed/created | No |
| Flow approved/persisted/played back | No |
| Oracle | Not reached |
| Permission/refusal | None |
| Stop | `flow_bootstrap.provider_evidence_loop_context_invalid` at `provider_request` |

The finalized evaluation verdict is `failed`, category `runtime.behavior`, at
facility stage `scenario.execute`. Its generic facility reason is
`unclassified`, while the live snapshot and sanitized error event supply the
specific Core stop above.

## Call-by-call evidence

There is one accounting attempt and no completed call record:

1. The provider gate was invoked for Flow Bootstrap. The snapshot records
   `providerInvocation: attempted` and accounting `calls: 1`.
2. Core rejected the evidence-loop context at `provider_request` before a
   response was recorded. `observedCalls` is empty, per-call records are
   `not recorded`, and accounting is zero tokens and zero cost.
3. No browser tool action, Flow proposal, playback, or oracle followed.

No later-action boundary was exercised because the failure preceded the first
evidence decision.

## Launch notes and retry accounting

A provider-free preflight initially found that the pinned Core worktree lacked
the generated `@fluxiq/client-gateway-websocket` build. Building that exact
ignored dependency resolved the environment prerequisite without changing
source or provenance. The first launch then stopped before creating a run
because the isolated process did not inherit the provider credential. The one
authorized facility retry used the existing local credential only as a
process-local value and produced the run reported above.

The runtime outcome was not retried: it is a reported product stop, and the
campaign's stop rules prohibit retrying such results.

## Classification and next gate

Classification: **product defect**. The new evidence-loop context is invalid
at the Core provider-request boundary on the frozen candidate. The supervisor
should diagnose that contract/construction seam before spending another
provider run. This lane provides no baseline performance comparison and does
not satisfy the concurrent plan's Flow/oracle acceptance gate.

No source, test, manual-inbox, or other report file was edited. No commit or
push was performed.
