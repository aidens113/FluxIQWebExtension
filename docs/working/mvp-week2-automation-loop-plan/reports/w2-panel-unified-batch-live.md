# Panel Unified Batch Live

Status: Live panel proposal passed; batch-adoption gate failed, so apply/run was not attempted
Updated: 2026-09-20
Owner: `w2-panel-unified-batch-live`

## Result

The real production panel accepted the typed instruction, presented and
accepted the explicit high-token confirmation, called DeepSeek once, and
rendered a reviewable proposal. The proposal's sanitized persisted audit,
however, records one provider decision, one tool call, and an empty
`batchDecisions` array. The only tool id was `web.inspect_current_page`.

The brief requires a completed decision with at least two actions before the
same proposal is applied and executed. This attempt therefore failed at the
batch-adoption gate. I stopped at that first exact result: Audit/approve/apply,
the four-action run, and the oracle were not attempted. There was no provider
retry and no test run.

## Isolated candidate

- Downstream pair: `F:\fxlab\t027-panel-unified\!FluxIQWebExtension` at
  `e2718ccd0eabfaeab1c505267316b42c4e0616c9`.
- Core pair: `F:\fxlab\t027-panel-unified\!FluxIQ` at
  `949735d22839574a0437de0457802fb6216472a0`.
- Run root: `F:\fxlab-runs\t027-panel-unified-live`.
- Headed production Chromium panel; isolated panel/gateway ports `3369` and
  `4939`. Both ports were closed after the attempt. Port `3000` and the user's
  panel/profile/store were not touched.
- Provider credentials and test identity values were loaded only into child
  process environments. They were not printed, copied into the pair, or
  included in this report.

The Core worktree contains exactly the two-file unified provider-decision
candidate:

- `runtime/llm/evidence-batch/schema.ts`: one provider-facing `tool_calls`
  wrapper accepting one through the existing bounded maximum, with each item
  discriminated by tool id and validated against the real tool input schema.
- `runtime/llm/evidence-loop.ts`: one unified provider decision variant and
  matching one-or-many instruction; internal singular normalization and
  existing ordered/safety behavior remain unchanged.

No completion-format, post-refusal feedback, or no-progress experiment was
carried into this pair. The downstream worktree stayed source-clean.

## Live-first evidence

Prerequisites completed through the same isolated production path:

- paired Core libraries and downstream production extension/runner builds:
  passed;
- Secret Keys UI setup and redaction attestation: passed, with zero findings;
- blank-workspace preparation: passed.

The single provider-bearing attempt was:

- evidence run: `demo-llm-explore-2026-09-21T01-04-25-316Z-b9cf78`;
- evidence verdict: passed;
- elapsed evidence interval: 29.314 seconds;
- high-token confirmation interval: about 13.2 seconds;
- provider/model: DeepSeek / `deepseek-chat`;
- provider calls / decisions: `1 / 1`;
- executed tool calls: `1`;
- sanitized tool vocabulary: `web.inspect_current_page`;
- trace steps: `2`;
- sanitized batch decisions: `0`;
- tokens input/output/total: `6,539 / 251 / 6,790`;
- estimated provider cost: USD `0.00320848`;
- proposal status: `proposed`, visibly reviewable in the production panel.

The authoritative batch count came from the persisted Core adaptation audit at
`$.auditEvents[0].detail.batchDecisions`, queried only for bounded telemetry.
Its array length was zero. No tool input, selector, field value, instruction
text, provider output, page state, screenshot, or recorded page content was
inspected or copied.

## Acceptance ledger

| Gate | Result |
| --- | --- |
| Typed instruction in production panel | Passed |
| Explicit high-token confirmation | Passed |
| Provider proposal visible for review | Passed |
| Completed 2+ action provider decision | **Failed: 0 batch decisions; 1 action total** |
| Audit / approve / apply same proposal | Not attempted after first failure |
| Deterministic created-Flow run | Not attempted |
| Four of four browser actions | Not attempted |
| Scenario oracle | Not attempted |

## Validation and handoff

`git diff --check` passed for the two candidate Core files, with only Git's
existing Windows LF-to-CRLF warnings. No unit, focused, broad, or full test
suite was run because the live lane did not pass. No source edit beyond the
two-file isolated candidate, commit, merge, or push was made.

This attempt shows that the unified schema remains provider-compatible through
the real panel but does not establish reliable batch adoption: the provider
chose a single observation and immediately proposed. The candidate must remain
isolated because the required 2+ batch plus apply/run/oracle proof is absent.

