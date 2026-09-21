# Unified Evidence Decision Live Experiment

Status: Live adoption proved, end-to-end acceptance failed; experiment remains isolated
Updated: 2026-09-20
Owner: `w2-unified-evidence-decision-live`

## Result

The unified provider-facing decision shape caused the real DeepSeek lane to
execute a two-action batch. Both actions succeeded in order and the batch had
no stop code. This is the first sanitized telemetry proof in the t027 series
that the provider actually adopted a multi-action decision.

The same run later failed during provider-output validation with
`bootstrap.unknown_parameter`, so it did not create, play back, or judge a
Flow. The brief's end-to-end definition of done is therefore not met, and this
experiment must remain isolated. Per the live-first stop rule, I did not retry
the provider attempt or run focused or broad tests.

## Isolated candidate

- Downstream worktree:
  `F:\fxlab\t027-unified-decision\!FluxIQWebExtension`
- Core worktree: `F:\fxlab\t027-unified-decision\!FluxIQ`
- Downstream base: `f505bfccb3838b14a43e70264ea50d65f93e530e`
- Core base: `042562ea644dd2282ff7b436a174be53b8581b44`
- Run root: `F:\fxlab-runs\t027-unified-decision`
- Environment-file target loading disabled; the authorized provider credential
  was supplied only to the live child process and was not printed or persisted

The Core experiment changes two files:

- `runtime/llm/evidence-batch/schema.ts` exposes one `tool_calls` wrapper for
  every tool decision. Its list accepts one through the existing bounded
  maximum, and each item is discriminated by tool id with the tool's real input
  schema.
- `runtime/llm/evidence-loop.ts` removes provider-facing singular tool variants
  and describes the single wrapper. A one-item list is still normalized to the
  existing internal `tool_call` path. Lists of two or more still use the
  existing coordinator, ordered execution, per-action permission seam, and all
  existing stop rules.

Completion remains its own variant. The internal singular decision type and
parser remain backward-compatible for callers; only the schema shown to the
provider was unified.

## Live-first attempt

The Core `fluxiq` package was compiled because the live process imports its
generated package output. No source test ran before the live attempt.

- Run: `run-muaibves-62a48bc2`
- Scenario/task: `social-scheduler` / `social-scheduler-schedule-post`
- Browser/target: isolated Chromium
- Provider/model: DeepSeek / `deepseek-chat`
- `maxActionsPerDecision`: 16
- Started: `2026-09-21T00:29:43.087Z`
- Build settled: `2026-09-21T00:30:54.131Z`
- Evaluated duration: 125,670 ms
- Build duration: 62,698 ms
- Provider decisions/calls: 8
- Tool calls that ran: 5
- Input/output/total tokens: 63,989 / 1,187 / 65,176
- Estimated cost: USD 0.029722
- Flow created: false
- Playback actions: 0
- Reported verdict / oracle: absent / absent
- Harness interventions: 0

## Positive batch evidence

Sanitized `build.evidenceLoop.batchDecisions` contains exactly one record:

- provider decision: 2;
- requested action count: 2;
- executed ordinal 1: `web.action.succeeded`;
- executed ordinal 2: `web.action.succeeded`;
- stop code: `null`.

The two actions were both `web.enter_field`. This proves that the unified shape
removed the earlier zero-adoption condition for this attempt: one provider
decision executed two ordered actions and did not cross any refusal, failed
effect, target-instability, action-limit, or batch-limit boundary.

Other sanitized evidence-loop steps used observation, one press, and repeating-
structure detection. No tool inputs, selectors, values, page state, raw provider
output, or other recorded content was inspected or included here.

## Exact first terminal failure

After the successful batch, two decision-validation feedback steps recorded
`bootstrap.unknown_parameter`. The build terminated with:

- failure code: `flow_bootstrap.evidence_unusable_decision`;
- stage: `provider_output_validation`;
- HTTP status: 400;
- issue codes: `bootstrap.unknown_parameter`;
- build outcome: failed.

This is a later generated-Flow parameter failure, not a batch execution failure.
The sanitized artifact does not expose a safe field-level value that would
justify a repair in this unit. I stopped without inspecting raw output, retrying,
or broadening scope.

## Comparison to prior identical lanes

| Lane | Provider calls | Build | Total | Batch evidence | End-to-end |
| --- | ---: | ---: | ---: | --- | --- |
| Earlier telemetry run | 3 | 31,988 ms | 177,711 ms | zero batches | passed |
| Earlier batching candidate | 4 | 37,435 ms | 191,088 ms | not observable at the time | passed |
| Unified-decision experiment | 8 | 62,698 ms | 125,670 ms | one completed two-action batch | failed before Flow creation |

The shorter total time of the failed candidate is not a speed improvement: it
ended before creation, playback, and oracle. Its build used more calls, time,
tokens, and cost than either successful comparison. These single stochastic
runs are evidence of behavior, not a performance benchmark.

## Validation and stop rule

- `pnpm --filter fluxiq build`: passed before live execution.
- Real provider attempt: failed at the exact boundary above.
- `git diff --check`: passed for the two experimental Core files, with only
  Git's existing Windows LF-to-CRLF warnings.
- No focused test, full suite, corpus, second provider attempt, commit, merge,
  or push was performed.

## Handoff

Do not integrate this candidate as-is. It proves the schema can elicit an
actual successful multi-action decision, but it does not satisfy the required
creation/playback/oracle gate. The smallest next investigation should use the
sanitized `bootstrap.unknown_parameter` diagnostic path to determine whether
the later completion normalization can safely repair that output without
weakening fail-closed validation; that is a separate unit and provider run.

No secrets or page data are included in this report.
