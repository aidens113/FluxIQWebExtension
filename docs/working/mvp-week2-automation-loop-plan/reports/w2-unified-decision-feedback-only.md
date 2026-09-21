# Unified Decision Feedback-Only Live Isolation

Status: Provider entry and multi-action batching restored; run stopped on exploration repeat without progress before completion
Updated: 2026-09-20
Owner: `w2-unified-decision-feedback-only`

## Result

Restoring only `flow-script-format.ts` to its exact base text restored provider
entry. The otherwise unchanged candidate completed twelve provider decisions
and executed a four-action batch whose every action succeeded. It also safely
stopped a later two-action batch after the first applied mutation because prior
target handles might have changed.

The run never attempted a completion. It ended after repeated page-inspection
requests with `flow_bootstrap.evidence_repeat_without_progress`, so the retained
post-refusal unknown-parameter guidance was not exercised. No Flow was created,
played back, or judged, and the end-to-end acceptance gate remains unmet.

## Isolated candidate

- Downstream worktree:
  `F:\fxlab\t027-unified-decision\!FluxIQWebExtension`
- Core worktree: `F:\fxlab\t027-unified-decision\!FluxIQ`
- Run root: `F:\fxlab-runs\t027-unified-decision`
- `flow-script-format.ts`: byte-identical to base
- Retained experimental Core diffs:
  - unified one-to-many provider decision schema in
    `runtime/llm/evidence-batch/schema.ts`;
  - unified provider instruction/schema assembly in
    `runtime/llm/evidence-loop.ts`;
  - the post-refusal-only `bootstrap.unknown_parameter` correction sentence in
    `runtime/llm/harness-options/bootstrap-completion.ts`.

The feedback sentence is constructed only after a completion refusal. It is
not part of the initial provider request. Therefore the initial request's
completion-format text was restored while correction guidance remained
available if a later completion were rejected.

## One-shot live result

- Run: `run-muaiy7oq-7cfd4189`
- Scenario/task: `social-scheduler` / `social-scheduler-schedule-post`
- Browser/target: isolated Chromium
- Provider/model: DeepSeek / `deepseek-chat`
- `maxActionsPerDecision`: 16
- Started: `2026-09-21T00:46:56.778Z`
- Build settled: `2026-09-21T00:48:24.121Z`
- Evaluated duration: 133,371 ms
- Build duration: 83,198 ms
- Provider decisions/calls: 12
- Tool calls run: 9
- Input/output/total tokens: 82,299 / 696 / 82,995
- Estimated cost: USD 0.03713028
- Flow created: false
- Browser actions: 0
- Reported verdict / oracle: absent / absent
- Harness interventions: 0
- Terminal failure: `flow_bootstrap.evidence_repeat_without_progress`
- Failure stage: `provider_output_validation`
- HTTP status: 400

## Batch and stop evidence

Sanitized telemetry contains two batch decisions:

1. Decision 3 requested four `web.enter_field` actions. Ordinals 1–4 all ran
   and returned `web.action.succeeded`; stop code was `null`.
2. Decision 4 requested two actions. Ordinal 1, `web.press_control`, ran and
   returned `web.action.succeeded`. The batch then stopped with
   `llm_evidence_loop.batch.targets_may_have_changed`; ordinal 2 did not run.

This is positive proof of multi-action adoption and of the target-stability
stop rule. The second batch did not execute past an applied mutation lacking a
`targetsUnchanged` assurance.

Afterward, the provider requested `web.inspect_current_page`. Two repeats were
answered from existing evidence rather than executed. The third repeat reached
the no-progress guard and was recorded as
`llm_evidence_loop.rejected.repeat_without_progress`. The build then terminated
without a completion decision.

No completion refusal occurred, so the retained feedback-only wording neither
helped nor harmed this attempt.

## HTTP 400 isolation

The two immediately preceding runs with the extra initial Flow-script sentence
both failed before an evidence loop with `lab.generation_http_400`. Removing
only that sentence allowed this attempt to enter and complete twelve provider
decisions. This is strong isolation evidence that the added initial request
text was the differentiating candidate variable. It is not proof of the
provider's internal rejection cause: live provider behavior is external and
the sanitized artifacts publish no response explanation.

The unified decision wrapper itself again reached the provider and elicited
valid one- and multi-action decisions, consistent with the first unified run.

## Stop rule and handoff

- Core was rebuilt so the live process loaded the restored base format.
- No source file other than the explicitly restored format file was changed;
  its final diff is clean.
- No tests, full suite, second retry, commit, merge, or push was performed.

Keep the candidate isolated. It now has repeatable provider-entry and batch-
adoption evidence, but still lacks a single attempt with completion, Flow
creation/application, playback, and a passing oracle. The next bounded unit
should address or diagnose the repeated-observation decision behavior; it
should not widen batch safety or re-add the initial format sentence.

No secrets, tool inputs, page content, selectors, or form values are included
in this report.
