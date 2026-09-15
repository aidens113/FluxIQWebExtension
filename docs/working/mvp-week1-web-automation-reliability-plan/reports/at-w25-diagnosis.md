# `at-w25-diagnosis` — corrected W25 facility diagnosis

## Corrected outcome

W25 `delayed-ui` / `too-slow` / Flow repeat 0 did not exercise the intended
timeout behavior. Campaign B stored a **finalized failed run bundle** and its
immutable evaluation for `bench-mu1qz69w-e5ab6a03-c55-a1`: verdict `failed`,
facility category `environment.missing`, `flowCreated: false`, null reported
and oracle verdicts, zero actions, zero sanitized evidence packets, zero
truncations, and zero harness activations. Its duration was 74,255 ms. The
runner invariant is `failed: environment.missing`; the workflow expected the
automation failure `timeout` / `web.action.timeout`.

The earlier version of this report incorrectly called that evaluation
synthetic and no-final-bundle. That is contradicted by the immutable receipt:
`evaluateFailedAttempt` would have written verdict `inconclusive` and an
invariant beginning `runner threw before finalizing a bundle`
(`bench/evaluate-run.ts:110-133`). Neither appears here. Every conclusion based
on the former no-final-bundle premise is withdrawn.

This remains a Testing Lab failure before a runnable Flow was observed, not a
W25 product failure. The durable evaluation identifies no narrower operation
stage or cause code, so attributing it to scenario health, Core health,
authentication, extension readiness, pairing, or another individual stage
would exceed the evidence.

## Actual durable boundary

- Generation 103 made this run the active attempt. Generation 104 accepted it
  as completed cell 52. Its immutable evaluation digest matches the checkpoint
  reference. The paused campaign later reached generation 189 with 94 completed
  cells and no ignored checkpoint.
- `runScenario` catches ordinary execution failures at
  `run-scenario.ts:377-395`, preserves the facility category, performs cleanup,
  creates `run.json` and `evaluation.json`, and finalizes the bundle at lines
  485-519.
- The campaign accepts a finalized attempt only after reading and validating
  its run manifest, evaluation, and bench receipt (`bench/run-bench.ts:318-350`).
  W25 followed that path. It did not follow the bundle-less catch at lines
  247-256.
- `flowCreated: false`, null lane verdicts, no actions, and no evidence prove
  only that recording, proposal, or approval did not yield an observed runnable
  Flow. They do not reveal which earlier orchestration step failed.

The bundle may contain a safe failure projection in its event journal, but the
immutable `RunEvaluation` contract carries only `failureCategory`, not a typed
stage or cause code. `readRunBundle` later reduces the matching error event to
message/category and discards `details.failureDetails`. The separate audit in
`au-synthetic-failure-observability.md` documents this durability gap and its
contract remedy. That gap limits diagnosis; it does not turn this finalized
run into a synthetic one.

## Why this is not the W25 behavior

The fixture is deterministic. `delayed-ui/scenario.ts:30` fixes the armed
reveal at 20,000 ms. Its `too-slow` contract at lines 50-58 expects the replayed
wait to fail as `timeout` / `web.action.timeout`, after a Flow has been built
and dispatched. The scenario does not raise `environment.missing` or remove a
topology dependency. Its focused tests pin the delay, inherited recording
script, expected failure, and deterministic arming.

The B observation instead ended with no Flow, action, automation verdict, or
oracle verdict. It therefore says nothing about whether the wait implementation
would have timed out correctly.

## Focused reproduction

The requested narrow validation subsequently passed 3/3 at downstream
`4d5c8a60be5b66778d2a3b5b3fb0b56e4a70cfde` and Core
`19468b72c4472fd5cc58940737702d5e4d72c985`. Three sequential isolated runs of:

```text
pnpm lab run delayed-ui --flow --variant too-slow --target isolated
```

all created a Flow, completed the unarmed four-step recording, executed the
first click, failed the inserted wait as `timeout` / `web.action.timeout`, and
passed the independent `late-action-absent` oracle. Every run had zero harness
activations, a complete bundle, four bounded sanitized packets, zero
truncations, and no `environment.missing`, readiness, or unexplained runner
failure. Durations were 55,502 ms, 60,166 ms, and 59,234 ms.

The focused run report is `as-w25-focused-a.md`. Those run manifests marked the
downstream tree dirty only because the supervisor had already updated working
documents after pausing the full campaign; the worker made no code change. Both
repository commits were the intended pins.

## Classification and next action

The 3/3 focused pass rules out a deterministic W25 fixture, wait, or Flow
contract defect in this sample. Together with the original failure's pre-Flow
shape, it supports classifying B repeat 0 as a single non-repeating facility
observation. It does not prove that resource pressure or a facility dependency
cannot fail again under concurrent full-corpus load.

No W25 production-code change or timeout increase is justified. The intended
20-second page delay and shorter replay wait are working as designed.

The remaining issue is diagnostic durability, not W25 behavior. Implement the
closed, typed `facilityFailure` evaluation field and crash/resume proof designed
in `au-synthetic-failure-observability.md`, then run a fresh clean-pinned
confirmation pair. If a facility failure recurs, that field—not raw logs or an
inference from duration—must select the owning stage and any fix.

## Inspection and validation boundary

This corrected report uses the immutable W25 evaluation/checkpoint metadata,
the owning evaluation paths identified by `au`, and the bounded 3/3 result in
`as-w25-focused-a`. I did not inspect raw events, logs, screenshots, page data,
browser state, credentials, or secret values. I ran no Lab command, changed no
production code, and did not commit or push.
