# Unified Decision Provider Reproduction

Status: Pre-decision HTTP 400 reproduced on unchanged completion-repair candidate
Updated: 2026-09-20
Owner: `w2-unified-decision-provider-repro`

## Result

The unchanged completion-repair candidate again failed on its first provider
request with sanitized `lab.generation_http_400`. No evidence loop was created,
so no provider decision, batch, completion, Flow, playback, or oracle existed.

This reproduces the immediately preceding run's pre-decision boundary on the
same bytes. It is therefore not supportable to classify that earlier 400 as a
one-off transient for this candidate. It also does not show that the unified
decision schema alone is invalid: the earlier pre-wording run entered the same
provider with that unified schema, completed eight provider decisions, and
executed a successful two-action batch. The safe classification is narrower:
the current completion-repair candidate is rejected before decision entry in
two consecutive attempts, and sanitized evidence does not publish the
provider's explanation.

## Frozen candidate

- Downstream worktree:
  `F:\fxlab\t027-unified-decision\!FluxIQWebExtension`
- Core worktree: `F:\fxlab\t027-unified-decision\!FluxIQ`
- Downstream base: `f505bfccb3838b14a43e70264ea50d65f93e530e`
- Core base: `042562ea644dd2282ff7b436a174be53b8581b44`
- Isolated run root: `F:\fxlab-runs\t027-unified-decision`
- Candidate diffs were byte-for-byte unchanged from the completion-repair run
- Environment-file target loading stayed disabled; the authorized provider
  credential was supplied only to the child process and was not printed or
  persisted

No source or test file was edited for this brief.

## Identical one-shot run

- Run: `run-muaisdn4-e86781c5`
- Scenario/task: `social-scheduler` / `social-scheduler-schedule-post`
- Browser/target: isolated Chromium
- Provider/model: DeepSeek / `deepseek-chat`
- `maxActionsPerDecision`: 16
- Started: `2026-09-21T00:41:45.389Z`
- Build settled: `2026-09-21T00:43:03.922Z`
- Evaluated duration: 85,334 ms
- Build duration: 74,217 ms
- Evaluator provider-call observation: 1
- Build accounting/provider calls: absent
- Provider invocation classification: `unknown`
- Failure: `lab.generation_http_400`, HTTP 400
- Evidence loop: absent (`null`)
- Flow created: false
- Browser actions: 0
- Reported verdict / oracle: absent / absent
- Harness interventions: 0

The prior unchanged-candidate run, `run-muain918-d2c35ea4`, recorded the same
failure with one evaluator-observed call, a 70,786 ms build, and no evidence
loop. The two attempts therefore agree on boundary and outcome.

## What this establishes

- Provider entry did not succeed.
- The current candidate's pre-decision HTTP 400 reproduced twice consecutively.
- There is no `batchDecisions` value to call empty: the evidence loop itself is
  absent.
- The completion wording was not exercised in either reproduction attempt.
- The earlier positive two-action batch remains valid evidence for the
  pre-wording unified schema, but does not satisfy the current candidate's
  end-to-end gate.
- The sanitized failure exposes no response body or rejection reason. It does
  not justify attributing the 400 to a particular schema keyword, prompt
  sentence, account state, or provider subsystem.

## Stop rule and handoff

The requested single reproduction attempt was the only run. No retry, source
change, test, full suite, commit, merge, or push followed it.

Acceptance remains unmet: this attempt has neither a completed 2+ action batch
nor Flow creation/application, playback, or a passing oracle. Keep the unified
completion-repair candidate isolated. The next useful unit should diagnose the
provider request boundary itself from bounded request-shape metadata or a local
schema preflight before spending another live call; it should not infer a
completion bug from a request that never entered the loop.

No secrets, raw provider output, or page content are included in this report.
