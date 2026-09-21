# t027 Real-Provider Batching Lane

Status: Live correctness passed; multi-action batch proof inconclusive
Updated: 2026-09-20
Owner: `w2-t027-provider-batching`

## Frozen candidate and lane

- Downstream commit: `0fd9d0d2dfe61bf59475ac7661406cf60fc5eccf`
- Core commit: `ef7892fc50b19667400c4fcb6be82f2e826e6fc0`
- Both validation worktrees were clean before launch. The only preparation was
  regenerating the missing ignored Core `@fluxiq/client-gateway-websocket`
  build output from the frozen source.
- Worktrees: `F:\fxlab\t027-batching\!FluxIQWebExtension` and paired Core
  `F:\fxlab\t027-batching\!FluxIQ`.
- Instance: `t027-batching`; run root:
  `F:\fxlab-runs\t027-batching`; environment-file loading disabled.
- Browser/target: isolated Chromium.
- Provider/model: DeepSeek / `deepseek-chat`.
- Task: created-Flow `social-scheduler-schedule-post`.
- Candidate setting: `maxActionsPerDecision: 16`, confirmed in the sanitized
  `live-llm.json` snapshot.
- Budget: 48,000 input, 8,000 output, 56,000 tokens per request, 600,000 per
  run, 26 calls, $0.25, zero provider retries.

The first launch stopped before browser/provider work because the paired Core
gateway package had no generated `dist`. Rebuilding that package from the
frozen commit passed. The next authorization preflight stopped with no calls
because the worker process had not inherited the provider credential. With
supervisor authorization, the existing local credential was supplied only as
an in-memory process value while environment-file loading stayed disabled.
No credential value was printed, persisted, or inspected. The actual live run
below was the one provider attempt; its product outcome was not retried.

## Live result

- Run: `run-muafnzak-5d8948dc`
- Started: `2026-09-20T23:14:15.022Z`
- Finished: `2026-09-20T23:17:26.366Z`
- Evaluated duration: 191,088 ms (about 3m 11s).
- Flow: created and applied; 9 nodes / 9 action nodes.
- Playback: succeeded with 9 browser actions.
- Reported verdict: passed.
- Scenario oracle: passed.
- Result-verification field: `no_result`; the independent scenario oracle is
  the result assertion for this run.
- Harness recovery/interventions: none.
- Permission request, refusal, or build failure: none.
- Security/redaction invariant: passed; 18 sanitized evidence packets, largest
  5,981 bytes. Page contents were not inspected for this report.

### Provider and timing accounting

| Measurement | Observed |
| --- | ---: |
| Provider decisions/calls | 4 |
| Input tokens | 41,407 |
| Output tokens | 987 |
| Total tokens | 42,394 |
| Estimated cost | $0.01952192 |
| Budget breaches / pending calls | 0 / 0 |
| Flow-build duration | 37,435 ms |
| Playback action-duration sum | 38,621 ms |
| Whole evaluated run | 191,088 ms |

The remaining approximately 115 seconds cover isolated setup, server/browser
startup, waits, capture, evaluation, and other orchestration not separately
timed by the current sanitized summary.

## Decision and batch evidence

The sanitized build audit reports:

- decision count: 4;
- tool-call trace steps: 3;
- evidence bytes: 16,969;
- tool IDs: `web.detect_repeating_structure`, `web.inspect_current_page`, and
  `web.press_control`;
- build outcome: `proposed` after four provider calls;
- no permission request or failure.

This proves that the enabled candidate remained behaviorally correct and
completed in four decisions. It does **not** prove that any one decision
contained two or more actions. The published sanitized artifact collapses the
trace to aggregate counts and a de-duplicated tool-ID set. It does not include
the action-to-decision association, batch size, position, per-action result
code, `stoppedBy`, or whether `core.batch_result` was emitted. The general
`exploration` snapshot is explicitly `source: absent` / `toolDetail:
not-published` for this created-Flow build.

Accordingly, completed batch sizes/positions and later-action stop boundaries
are **not observable** from the permitted sanitized artifacts. There was no
top-level stop, refusal, permission event, or failed action in this successful
run, but absence of those outcomes cannot substitute for a per-batch trace.
The acceptance requirement "at least one decision completed two or more
ordered actions" remains open. A small sanitized telemetry addition should
publish, per provider decision, only action count, ordinal positions, result
codes, and stop code; no inputs or page evidence are needed.

## Classification and A/B status

- Product correctness for the batching-enabled lane: **passed live**.
- Multi-action execution proof: **inconclusive due to missing sanitized batch
  telemetry**; do not report this run as a completed batch.
- Provider/facility outcome: healthy on the actual run. The two earlier stops
  were pre-provider environment preparation and spent no provider calls.
- Fair A/B performance conclusion: pending the frozen baseline report. This
  lane alone records 4 calls, 42,394 tokens, $0.01952192, and 191,088 ms.
- No source, test, or other report was edited; no commit or push was made.
