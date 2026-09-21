# Report: w2-batch-schema-order

Worker report for brief `w2-batch-schema-order`. The experiment ran in the
fresh isolated pair `F:\fxlab\t027-batch-order\!FluxIQWebExtension` and
`F:\fxlab\t027-batch-order\!FluxIQ`, based on the integrated telemetry heads
plus the already-proven downstream host-timeout candidate. The failed prior
batch-wording diff was not carried. No commit or push was made.

## Outcome

Acceptance failed; do not integrate the schema-order experiment.

The identical real-provider created-Flow lane failed at its first provider
call, before Core created an evidence loop. Sanitized evidence records
`lab.generation_http_400` with HTTP status 400, `build.evidenceLoop: null`, no
Flow, no browser actions, and no playback or oracle. Therefore no evidence
decision completed and zero batches were adopted. Because the live-first gate
failed, no source test was added or run.

## Experimental change

Core file:

`packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts`

The existing provider-facing decision variants were reordered from:

```text
complete -> singular tool_call variants -> tool_calls batch
```

to:

```text
complete -> tool_calls batch -> singular tool_call variants
```

No accepted shape, parsing rule, action execution, batch stop rule, telemetry,
instruction, or description changed. The batch description remained the
integrated original byte-for-byte; the failed adoption wording was absent.

The downstream pair also contained the separately proven host-timeout
candidate unchanged so a successful build would not regress into the prior
600-second playback stall. Those two downstream files are not part of this
schema-order experiment.

## Live-first result

- Run: `run-muahlfbz-3dadc0fd`
- Scenario/task: `social-scheduler` /
  `social-scheduler-schedule-post`
- Browser/target: isolated Chromium
- Provider/model: DeepSeek / `deepseek-chat`
- `maxActionsPerDecision`: 16
- Whole evaluated run: 146,990 ms
- Build duration: 77,234 ms
- Observed provider calls: 1
- Build outcome: failed
- Sanitized failure: `lab.generation_http_400`, HTTP 400
- Evidence loop: absent (`null`)
- Flow created: false
- Browser actions: 0
- Reported verdict / oracle: absent / absent
- Harness interventions: 0

Sanitized lifecycle:

| Event | UTC | Result |
| --- | --- | --- |
| Runtime dispatch | 2026-09-21 00:09:19.418 | Created-Flow build started. |
| Runtime settle | 00:10:41.540 | First provider call settled without a proposal. |
| Error | 00:10:41.621 | Run finalized as failed. |

The sanitized artifact deliberately contains no raw provider response and does
not state the provider's explanation for HTTP 400. It supports saying that the
first generation request failed at the provider boundary; it does not support
inventing a more specific provider rejection reason.

## Adoption evidence

This is exact zero-adoption evidence for the attempt:

- `build.evidenceLoop` is `null`, so there were no provider decisions to
  project into `batchDecisions`;
- no Flow was produced;
- zero browser actions ran;
- no batch with two or more executed ordinals exists.

This differs from the earlier successful telemetry run whose explicit
`batchDecisions: []` proved several singular decisions. Here the request failed
before any evidence decision, so an empty batch array was never published.

## Validation and stop rule

- Required Core package builds completed before live execution:
  `@fluxiq/contracts`, `fluxiq`, and
  `@fluxiq/client-gateway-websocket`.
- The Lab built the downstream scenario, extension, host module, domain,
  contracts, evidence, and runner before dispatch.
- `git diff --check` passed for the Core experiment and unchanged downstream
  host-timeout overlay (apart from Git's existing LF-to-CRLF warning).
- No focused source test, package suite, full suite, retry, commit, or push was
  performed after the failed live gate.

## Files and handoff

- Experimental Core diff:
  `F:\fxlab\t027-batch-order\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\llm\evidence-loop.ts`
- Unchanged downstream host-timeout overlay:
  `domain/src/runtime/host-runtime.ts` and its focused test in the paired
  extension worktree.
- This report in the main task working-document report directory.

The senior supervisor should leave the Core ordering diff isolated. This one
attempt neither proves batch adoption nor an end-to-end passing Flow, and the
brief's definition of done is not met.
