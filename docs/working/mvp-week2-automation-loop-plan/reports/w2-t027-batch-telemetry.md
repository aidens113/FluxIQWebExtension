# t027 Batch Telemetry

Status: Implementation and focused validation complete; supervisor integration pending
Updated: 2026-09-20
Owner: `w2-t027-batch-telemetry`

## Result

The paired isolated batching candidate now publishes content-free batch
telemetry for successful proposals and failed build diagnostics. Each batch
record contains only:

- provider decision number;
- requested action count;
- executed action ordinals and closed result codes (or `null`);
- one closed stop code (or `null`).

It does not publish prompts, action inputs, selectors, values, page evidence,
call IDs, or raw provider output. Existing evidence-loop counts and tool-ID
summaries remain intact.

## Live-first proof

After Core and the downstream runner compiled, I reran only the identical real
DeepSeek created-Flow lane. The provider credential was supplied to the child
process from the authorized local source, environment-file target loading
remained disabled, and no credential value was printed or persisted.

- Run: `run-muag8qna-a02d3b07`
- Isolated instance: `t027-batching-telemetry`
- Run root: `F:\fxlab-runs\t027-batching-telemetry`
- Scenario/task: `social-scheduler` / `social-scheduler-schedule-post`
- Browser/target: isolated Chromium
- Provider/model: DeepSeek / `deepseek-chat`
- `maxActionsPerDecision`: `16`
- Outcome: Flow proposed, reviewed/applied, and played back successfully
- Browser actions: 9 of 9 succeeded
- Reported verdict / scenario oracle: passed / passed
- Harness interventions: 0
- Provider calls: 3
- Input/output/total tokens: 29,506 / 539 / 30,045
- Estimated cost: USD 0.01369412
- Flow-build duration: 31,988 ms
- Playback action-duration sum: 40,452 ms
- Whole evaluated run: 177,711 ms
- Evidence invariant: 18 sanitized packets; largest 5,981 bytes

The new `build.evidenceLoop.batchDecisions` field is `[]`. This is a conclusive
negative observation: the model chose no multi-action decision in this rerun.
The run proves the telemetry seam does not regress the real creation/playback
path, but it does **not** prove that this particular provider attempt completed
a batch. It must not be reported as such. Compared with the earlier successful
batching-enabled run, provider calls fell from 4 to 3 and evaluated duration
fell from 191,088 ms to 177,711 ms; this single stochastic pair is not a fair
performance benchmark.

## Implementation

Core:

- `runtime/service.ts` preserves only bounded categorical batch fields while
  sanitizing a bootstrap trace and adds `batchDecisions` to the successful
  adaptation's created audit detail.
- `runtime/flow-bootstrap/generation-failure.ts` projects decision, position,
  size, and closed stop reason on failed-build evidence steps and parses that
  exact bounded shape.
- Focused service and diagnostic tests cover a completed three-action batch
  and all five allowed stop codes.

Downstream:

- `existing-fluxiq-control.ts` parses and bounds successful audit telemetry:
  unique decisions and ordinals, at most sixteen actions, vocabulary-only
  result codes, and the five closed stop codes.
- `flow-lane/creation/build-proposal.ts` carries the sanitized records into
  `snapshots/live-llm.json` for proposals and reconstructs them from failed
  diagnostic steps.
- The focused build-proposal test covers non-empty projection. Two stale exact
  expectations in that same test were aligned with already-existing
  instructed-consequence reads discovered by the narrow run.

## Post-live validation

- Core build: `pnpm --filter fluxiq build` — passed.
- Downstream test-runner build: `pnpm --filter @fluxiq-web-extension/test-runner build` — passed.
- Core focused tests: generation service plus generation-failure diagnostics —
  58 passed.
- Downstream focused test: compiled `build-proposal.test.js` — 9 passed.
- `git diff --check` in both repositories — passed (Git emitted only the
  existing Windows LF-to-CRLF checkout warnings).
- No full suite, corpus, second provider retry, commit, merge, or push was run.

## Supervisor handoff

Copy or integrate the seven source/test edits from the isolated pair into the
main t027 pair, then review the public telemetry names. The overall t027 batch
acceptance gate remains open because this paid rerun used zero batches. A later
real-provider cohort should be considered successful only when the sanitized
artifact itself contains at least one `batchDecisions` entry with two or more
executed ordinals and the Flow/playback/oracle still pass. Do not rerun this
specific successful product outcome merely to seek a more favorable model
sample.

No commits or pushes were made.
