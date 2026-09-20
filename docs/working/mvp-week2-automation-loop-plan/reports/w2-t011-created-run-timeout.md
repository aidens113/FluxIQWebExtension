# Report: w2-t011-created-run-timeout

Worker report for brief `w2-t011-created-run-timeout`. Read-only diagnosis;
no source, build, test, commit, or push was performed. The run bundle was read
only through closed lifecycle/accounting fields. No page evidence, credential,
or recorded value is reproduced here.

## Outcome

Done — the run identity/read-back path is distinguished from the later stuck
runtime, and the smallest live-first fix point is identified.

**t022's `newRunId` path worked. The 30-second failure remained because the
named Core run itself never reached a complete readable outcome during the
following 600-second read-back window.** The failed stage is the created
Flow's playback, specifically the synchronous
`run-runtime-session` request and its terminal-detail recovery, not Flow
bootstrap, review, or proposal application.

The smallest supported fix is in the downstream web host-runtime dispatch:
give host snapshot/route-state gateway commands a finite command timeout. At
present those two calls can wait forever for the browser while the ordinary
Flow action path is bounded. After that fix, rerun only
`social-scheduler-schedule-post` live. Do not raise either the 30-second HTTP
bound or the 600-second read-back bound; neither ends the stuck Core run.

## What changed and why

Only this report was added. It records the call-by-call run diagnosis and the
source seam that should be changed next; the brief prohibited implementation,
builds, and tests.

## Exact live timeline

Run bundle: `F:\r11\run-mua7yzln-7c8d0a9d`.

| UTC | Offset from prior event | Durable fact |
| --- | ---: | --- |
| 2026-09-20 19:38:58.607 | - | Created-flow lane dispatched. |
| 19:39:45.729 | 47.122 s | Flow build settled `proposed`: 5 provider calls, 5 decisions, 3 tool calls; the build itself took 42.073 s. |
| 19:50:20.205 | 634.476 s | Repair settlement finished with the named playback run and zero provider calls/interventions. This is consistent with a 30 s request timeout followed by the 600 s granted-run terminal read-back. |
| 19:50:50.215 | 30.010 s | The original `run-runtime-session` HTTP timeout became the scenario failure. The extra 30 s is failure-capture/finalization latency; it is not a second playback window. |

`evaluation.json` records `environment.missing` at
`scenario.execute`, operation stage `control.request`, endpoint
`/api/programs/automation-studio/run-runtime-session`, and timeout 30,000 ms.
The bundle duration is 719,464 ms. No flow-lane result was published, so
`flowCreated` is false in the evaluation despite the successful proposal.

## Named run and terminal state

The runner named the playback run
`a0bf5e00-eda2-4f31-8a4b-f55923077314` before sending it. That identity is
present as `repair.runId` in `snapshots/live-llm.json`.

The run **did exist in Core**. `settleRepair` records a non-null observed
accounting object only when `getRunDetail(projectId, runId)` succeeds
(`packages/test-runner/src/live-llm/live-llm-run.ts:274-295`). The snapshot has
that object (`calls: 0`, `interventions: 0`) and has no
`run_detail_unreadable` settlement marker. Core can synthesize a run detail
from an existing runtime session when no completed detail has yet been saved
(`runtime/service/run-detail-read/flow-run-detail-reader.ts:25-43`).

It had **not reached a settled terminal result with a verdict** by the end of
the read-back window. `awaitTerminalRunDetail` returns only for a terminal
status with at least one durable action and, for a granted run, a settled
result-verification value
(`packages/test-runner/src/flow-lane/persisted-flow-run.ts:408-450`). It polled
for Core's 600,000 ms grant lease and exhausted that window, then rethrew the
original request timeout (`persisted-flow-run.ts:298-310,418-433`). The bundle
therefore contains no terminal status and no result-verification verdict. The
available evidence supports `running/incomplete, verdict absent`; it does not
support inventing a terminal status after the isolated workspace was removed.

## Request and read-back path

1. For a granted run, the runner generates a UUID and calls
   `onRunIdentified` before dispatch
   (`persisted-flow-run.ts:287-295`).
2. `runGrantedFlow` sends that UUID as `newRunId` on
   `run-runtime-session` (`persisted-flow-run.ts:326-339`).
3. Core validates that it is a fresh lowercase UUID and applies it to the new
   session (`runtime/service/runtime-session/requested-run-id.ts:37-50`;
   `runtime/service.ts:3095-3105`).
4. Core writes the session as `running` before graph execution
   (`runtime/service.ts:3132-3145`). The API handler waits for all graph,
   adaptation, and result-verification work before answering
   (`api/handlers/runtime-execution.ts:42-68`).
5. The Lab HTTP client cuts that request off at its default 30 s
   (`packages/test-runner/src/http-control/index.ts:195-215,268-271`). A timed
   out granted run is then polled by its already-known id for 600 s
   (`persisted-flow-run.ts:24-39,298-310`).

Thus this run is not the pre-t022 defect where the request timeout lost the
run identity. The identity survived and was used; the run failed to finish.

## Root cause

The directly evidenced root cause is an **unbounded browser host-state command
inside Core graph execution**:

- Core captures host state before every page action and awaits it without a
  deadline (`runtime/executor/node-execution.ts:81` and
  `runtime/executor/host-state.ts:6-16`). A router can likewise observe route
  state before the first action.
- The web domain implements both captures by dispatching
  `web.dom.capture_snapshot` (`domain/src/runtime/host-runtime.ts:88-122`).
- Neither request supplies `timeoutMs`. The dispatcher explicitly forwards a
  timeout only when the caller supplies one, then awaits the gateway action
  (`domain/src/io/gateway-output-dispatcher.ts:6-23`).
- By contrast, normal `builtin.policy.action` execution always supplies a
  5,000 ms default (`Core nodes/policy/action.ts:23-29,54-74`), and Core's
  runtime races a command carrying a timeout against that deadline plus its
  answer margin (`Core runtime/service.ts:354-389`).
- Core's granted-run 600 s lease aborts an in-flight **LLM provider call**; it
  is not wired to the graph's `abortController`. The graph controller is
  created and passed to execution at `runtime/service.ts:3106-3112`; it is
  aborted only by explicit run cancellation (`runtime/service.ts:3299-3305`).
  Consequently the downstream 600 s poll is only a reader deadline. Expiring
  it cannot end a browser command that never answered.

This explains all observed facts without blaming `newRunId`: Core stored the
named running session, no action/result verdict became durable, no repair or
verification provider call occurred, and read-back exhausted exactly the
whole-run lease.

The bundle cannot distinguish whether the unanswered capture was initial
route-state observation, the first `before_action` snapshot, or a later host
snapshot, because Core does not persist a node attempt until the awaited host
call returns. A source-level diagnostic must therefore not claim a more
specific capture point than the evidence contains.

## Smallest fix location

Make the web host-runtime's two snapshot dispatches bounded:

- extend `WebAutomationExpectationDispatch`'s request shape to admit optional
  `timeoutMs` (`domain/src/runtime/expectation/evaluate.ts:72-76`), or give the
  host runtime its own narrower dispatch type;
- pass a finite snapshot timeout from both calls in
  `domain/src/runtime/host-runtime.ts:92-102,115-120`;
- allow the existing `dispatchWebAutomationOutput` forwarding at
  `domain/src/io/gateway-output-dispatcher.ts:17-23` to put it on the browser
  command.

That is the narrow live fix. A later hardening should make Core's host-runtime
boundary accept the graph signal/deadline so every importing domain is
fail-closed, but that cross-repository contract expansion is not needed to
prove this blocker first.

## Focused live proof

With `DEEPSEEK_API_KEY` already exported without printing it, from
`F:\fxwork\t011-exploration-reveal-safety`:

```powershell
$env:FLUXIQ_TEST_ENV_FILES='none'
$env:FLUXIQ_TEST_TARGET='isolated'
$env:FLUXIQ_LAB_INSTANCE='t011'
$env:FLUXIQ_TEST_RUNS_DIR='F:\r11'
pnpm lab run social-scheduler --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-chat --llm-task create-flow --instruction-task social-scheduler-schedule-post --llm-max-input-tokens 48000 --llm-max-output-tokens 8000 --llm-max-total-tokens 56000 --llm-max-run-tokens 600000 --llm-max-cost-usd 0.25
```

Pass criteria for this focused proof:

- if the initial 30 s request times out, the named run is recovered rather
  than lost;
- every host snapshot command settles within its own finite bound;
- playback reaches a terminal run detail with at least one durable action;
- `resultVerification` is present for a succeeded granted run;
- the lane publishes its flow observation and judges the page outcome.

## Commands run and observed results

- Bounded PowerShell JSON projections over `evaluation.json`,
  `snapshots/live-llm.json`, `run.json`, `summary.json`, and `events.ndjson`:
  observed the four-event timeline, the exact HTTP failure projection, the
  named repair run, and non-null zero-call settlement. Page/task payloads and
  credentials were not printed.
- `rg` and line-numbered `Get-Content` over the named downstream and Core
  implementation paths: observed the `newRunId` handoff, 600 s polling gate,
  Core session lifecycle, result-verification write order, and unbounded web
  host snapshot dispatch.
- `git diff --check -- docs/working/mvp-week2-automation-loop-plan/reports/w2-t011-created-run-timeout.md`
  -> exit 0.
- Builds/tests: not run; diagnosis-only brief explicitly prohibited them.

## Not verified

- The exact individual capture (route, before-action, or after-action) that
  failed to answer; the completed bundle intentionally contains no page or
  command payload trace for the unfinished run.
- A source fix or live rerun; this brief was diagnosis-only.
- Unit, package, or full-suite checks; none were run.
- The isolated project's post-cleanup state. The report states only what was
  durably observable before cleanup.

## Open questions or contradictions found

- The bundle proves an unbounded host-state dispatch blocked completion, but
  intentionally cannot say whether it was route-state, before-action, or
  after-action capture. The focused rerun should add only closed lifecycle
  timing if that distinction remains necessary after the timeout is fixed.
- Calling Core's 600 s grant lease a whole-run deadline is misleading: the
  lease aborts provider work, while this graph's browser wait survived it.
