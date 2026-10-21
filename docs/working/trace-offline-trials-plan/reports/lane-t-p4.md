# Report: lane-t-p4 (t746 offline-trials-tier1)

## Outcome
Partial (2026-10-20). Offline trials tier 1 work end to end through the one production path: the candidate trial
runner with a `trace` environment, a strict trace matcher answering through the real intake, a virtual clock whose
deadlines fire in logical time, explicit evidence gaps and the U5 result (an offline pass stays evidence only; the
offline trial's own trace is derived). Source tests T05-T08, T10, T12-T16, T20, T22-T24 pass (table below). On round
4's real social traces an offline trial reproduces each live trial's judged outcome exactly. Not met as worded: "a
corrected candidate for the breadth round's social failure reproduces the judged result" -- that run was never traced,
and the round-4 build's own correction changes a filter inside the extension's read, which tier 1 rightly answers with
an evidence gap (tier 2, P5); no tier-1 correction exists in the traced data (details under Gate).

## Plan

Brief `t746-offline-trials-tier1` (plan P4): the production executor runs against a trace environment (the t734
port), strict operation matching (action type, target fingerprint, arguments, occurrence, preceding operations), a
virtual clock, explicit evidence gaps. Gate: source tests T05-T08, T10, T12-T16, T20, T22-T24, and an offline trial of
a corrected candidate for the breadth round's social failure reproducing the judged result. Offline trials stay out of
exploration and never satisfy the whole-run gate (decisions 2, 3); live remains the default.

Trees `fxwork/t746/{!FluxIQ,!FluxIQWebExtension}`, branch `task/t746-offline-trials-tier1`. Avoid t743's files (brief
seeding, gate refusals, completion, element identity, state-diff rows, site-reset ledger, list-reader, step-log
summary) and t745's (content-store addressing, gateway-trace storage addressing). Real-SQL marker on tests opening
SQLite.

Design (lead):
- One code path: an offline trial is the candidate trial runner with `ports.environment` = a trace environment
  (`createAutomationStudioScopedRunEnvironment`, kind `trace`). Inside its channel scope the only client is a trace
  matcher session attached to the live gateway; every command the executor, the host runtime and the evidence tools
  send reaches it through the gateway as live, and every answer comes back through `receiveRaw` (the real intake).
- Strict matching (tier 1): the matcher keeps a cursor over the recorded `server.execute_action` operations; the next
  command must equal the next recorded operation on action type, canonical target, canonical parameters (declared
  transport-only fields excluded: command id, the trace stamp, the host lease), occurrence and the matched prefix. On a
  match it feeds the recorded answers to that command and the unsolicited inputs recorded until the next operation, in
  recorded order, with the command id translated (documented correlation bookkeeping). On a mismatch it answers a
  classified, non-retryable failure (an evidence gap with a U5 reason code) and every later command too: an unrelated
  recorded suffix is never consumed. It never delivers anything recorded after the matched point (no future leakage).
- Virtual clock: time moves only through explicit waits (executor delays) and the matcher's recorded latencies, never
  on idleness (an idle detector would fire deadlines while real storage I/O is pending). Deadlines are virtual timers
  that fire when time passes them: the executor's region timeout and the gateway's answer waits for a scoped session
  use the scope's timers, so a recorded late answer meets the production timeout logic at its logical time with no
  wall-clock wait.
- Result: the U5 contract (`AutomationStudioTrialEvidenceResult`): origins recorded + pure_computation, scope
  full_recorded_path (or segment), source episode = the live trial whose trace it ran on, missing evidence from the
  matcher's gaps (verdict inconclusive when any); its own capture is a derived trace (T24). Judges still run (model
  calls are never replayed, T22); the gate keeps an offline yes as evidence only (t734).

| Unit | Worker | Owns |
| --- | --- | --- |
| P4a virtual timers | worker-high | AS `runtime/environment/**`, `executor/region-execution.ts` (+ the option type), gateway scope timers (`client-gateway/service/{channel-scope,commands}`, `command-ledger/dispatch.ts`, `command-reconcile/reconciler.ts`) |
| P4b trace matcher | worker-high | new `client-gateway/trace-matcher/**` |
| P4s social survey | worker (read-only) | report only |
| P4c offline trial runner | after P4a, P4b | AS offline-trial runner and its tests |
| P4d social gate experiment | after P4c | downstream test-runner tool |

## Worker briefs
(the dispatch prompts; summaries in the table above)

## Decisions

- D26 Virtual time moves only through explicit waits and the matcher's recorded latencies, never on idleness; deadlines
  are virtual timers (`AutomationStudioVirtualClock.startTimer`/`advance`), used by the executor's region timeout
  (`options.startTimer`, wired in `graph-run.ts` by the lead) and by the gateway's answer, durable and reconcile waits
  for a scoped session (the channel scope carries its timers).
- D27 Matching excludes, by name, only fields proven transport-only: the command id, the `metadata.trace` stamp, the
  host lease, the caller `metadata` (the domain's tool metadata is correlation -- source, project, flow, call id,
  domain -- and the extension's action mapping drops it) and `timeoutMs` (the candidate's own deadline is applied to
  the recorded latency by the virtual clock). An order change is `ambiguous_context`; every command after the first
  gap is `missing_transition` (`after_gap`).
- D28 Outcomes are honest: a source trace that is not a live episode -> `source_not_live`; not judged or unsure ->
  inconclusive `judgement_unavailable`; a failed delivery of a recorded input or artifact -> a structured gap; zero
  operations reaching the recorded client -> `missing_transition`; an inconclusive result's assertion is `unverified`.
  U5's closed vocabulary gained `source_not_live` and `judgement_unavailable` (lane T owns U5).
- D29 A trace without a recorded session view (captured before P3) runs only with a caller-supplied view (in
  production, the live session's public view for the same client; P6 wires it); the recorded view always wins; with
  neither, the runner refuses with `incomplete_capture`. The matcher never attaches a default capability-less session.
- D30 "Reproduces the judged result" provider-free means: the same trial outcome the judge saw (stored rows, read
  counts, executed steps, where it stopped) and the task oracle's verdict equal to the live judged result; the model
  judge itself is never called offline in experiments (no paid runs), and in production it is called live (model
  answers are never replayed, T22).

## Progress log

### 2026-10-20 - Wave 1: P4a virtual timers, P4b trace matcher, P4s social survey; lead wiring
- P4a (Core): `runtime/environment/{virtual-clock,channel-scope,environment,scoped,executor-options}.ts`,
  `runtime/executor/{region-execution,contracts}.ts`, `client-gateway/service/{commands.ts,channel-scope/source.ts,
  command-ledger/dispatch.ts,command-reconcile/reconciler.ts}`; tests `environment/tests/{virtual-timers,
  scoped-deadlines}.test.ts` (T13), `client-gateway/service/tests/scope-timers.test.ts`,
  `runtime/executor/tests/region-timeout/tests/region-execution.test.ts`. Reconcile waits are tagged as answer waits
  (the wait type has one kind). Report `reports/lane-t-p4a-virtual-timers.md`.
- Lead: `runtime/executor/graph-run.ts:412` passes `options.startTimer` to `executeWithRegionTimeout` (outside P4a's
  brief). Check: `pnpm exec vitest run src/programs/automation-studio/runtime/executor
  src/programs/automation-studio/runtime/environment` -> `Test Files 113 passed (113)  Tests 946 passed (946)`; `tsc` ->
  `0`.
- P4b (Core): new `client-gateway/trace-matcher/**` (matcher, trace-admission, recorded-deliveries,
  operation/{fields,read,differences,match}, contract-compatibility, gap-answer, command-id-translation, gap-reasons,
  types; tests matcher-replay, matcher-gaps, operation-match + episode-recording, trial-gateway support). Report
  `reports/lane-t-p4b-trace-matcher.md`.
- P4s (read-only): run-mvfq957o-40103539 (the breadth social run) is untraced; its revision 10 -> 9 differs only in
  Core's `recordOutput.process` filter and revision 9 was the exact oracle answer live. Round 4's social run
  run-mvgw3ve5-294881b5 has 9 traces (1 exploration, 8 trial); its later revisions differ in `extractList.where`, a
  filter inside the extension's read. Store copied (hash-verified, t566 idle) to `test-runs/round4/`. Report
  `reports/lane-t-p4s-social-survey.md`.

### 2026-10-20 - P4c offline runner; P4d-prep experiment tools
- P4c (Core): new `runtime/service/offline-trial/{index,contracts,run,evidence-result,reader-contracts}.ts` + tests
  (offline-harness, parity, edits, provenance, gap-vocabulary); `runtime/gateway-trace/{types,episodes,index}.ts`, new
  `gateway-trace/replay-sources.ts`, `wiring/trial.ts` + `wiring/tests/trial-origin.test.ts`: a trial in a non-live
  environment records a derived (replay) trace naming its source. Exploration refused (`offline_not_allowed_in_phase`).
  Report `reports/lane-t-p4c-offline-runner.md`.
- P4d-prep (downstream): new `packages/test-runner/src/offline-trial-experiment/**` (trace-to-revision mapping,
  rebuild of revisions through Core's own authoring modules with digest verification, the task oracle, a tier-1
  derivability check, CLI). Only revisions 10 and 16 rebuild with verified digests (others name handles that lived only
  in the build's memory), so the revisions 2/4 cross-trace control is impossible; revision 10 never stored the `text`
  column and its `group` column holds the author, so no Core-side correction can reach the oracle. Report
  `reports/lane-t-p4d-prep.md`. Note: the rebuild loads three unexported Core modules from the built files, guarded by
  the digest check (fails loudly on drift).

### 2026-10-20 - F-a honest outcomes; lead fix of a T12 test race
- F-a (Core): U5 `model/offline-trial/vocabulary.ts` (+ validate test) gains `source_not_live`, `judgement_unavailable`;
  `runtime/service/offline-trial/{run,evidence-result}.ts` + tests honest-outcomes, export, provenance, gap-vocabulary;
  `client-gateway/trace-matcher/{matcher,types,gap-reasons}.ts` + `tests/matcher-deliveries.test.ts` (a failed
  delivery is a structured gap); the runner exported from `programs/automation-studio/runtime/index.ts`. Report
  `reports/lane-t-p4-fa-honest-outcomes.md`.
- Lead: the T12 matcher test failed 3 of 5 runs alone: its `setImmediate`-deferred read of the settled flag raced the
  next feed (the state event's entry saw the completion's settle; feed order itself was correct). The read is now
  synchronous at each feed; the ack and state event must be unsettled, the result must be the completion's payload
  (still catches an ack read as completion). Check: 10 of 10 runs `Tests 6 passed (6)`.

### 2026-10-20 - P4d experiments on round 4's social traces; F-b session view and unreached client
- P4d-run found two Core defects: (1) a pre-P3 trace has no recorded session view, so the matcher attached a
  capability-less session, the web domain never sent a command, 0 of 19 operations matched, and U5 reported a definite
  fail with no missing evidence; (2) an inconclusive result marked its assertion `violated`. Report
  `reports/lane-t-p4d-run.md`.
- F-b (Core + downstream): D28/D29 implemented (`trace-matcher/{matcher,types}.ts` + `matcher-session-view.test.ts`;
  `offline-trial/{contracts,run,evidence-result}.ts` + `session-view.test.ts`); the experiment passes the extension's
  declared view through the runner's `sessionView` (labelled supplied), its workaround deleted. Report
  `reports/lane-t-p4-fb-session-view.md`.
- Experiments (provider-free, non-model judge, task oracle; fresh store copy per run):

  | Run | Matcher | Gaps | Stored rows offline / live | U5 | Oracle vs live judge |
  | --- | --- | --- | --- | --- | --- |
  | E1 revision 10 on its trace f53b350b | 19/19 | none | 15 / 15, all equal | inconclusive `judgement_unavailable` | fail = live "no" |
  | E1 revision 16 on its trace 3e353455 | 19/19 | none | 0 / 0 | inconclusive `judgement_unavailable` | fail = live "no" |
  | E2 revision 16 (the build's correction) on f53b350b | 16/19 | `argument_mismatch` `parameters.extractList.where` (seq 78), then `after_gap` | none stored | inconclusive, segment, assertion unverified | no live result for this pairing |
  | E3 tier-1 sample (minRows only) on f53b350b | 19/19 | none | 15 / 15, recomputed | inconclusive | fail |
  | No session view (pre-P3 trace) | refused | `incomplete_capture` | -- | refused before running | -- |

  E1 also matched read counts, steps and stopping point; revision 10 offline took 12.9 s wall for 53.0 s of virtual
  time (55.1 s live). Every run's own trace is derived (replay of its source).
- Lead's checks: offline-trial tests 12 of 12 runs `Tests 23 passed (23)` (one unexplained inconclusive seen once by
  F-b, not reproduced in 19 runs since); final Core `vitest run` over client-gateway, U5, offline-trial,
  candidate-trial, subflow-trial, gateway-trace, environment, executor, flow-bootstrap/candidate -> `Test Files 246
  passed (246)  Tests 1816 passed (1816)`; fluxiq `tsc --noEmit` -> `0`; Core audit -> `passed (430 warning(s), 1152
  baselined)`; downstream `core-build.mjs` -> current; test-runner `tsc` -> `0`; `node --test
  "dist/offline-trial-experiment/**/*.test.js"` -> `# tests 46 # pass 46 # fail 0`; downstream audit -> `passed (218
  warning(s), 618 baselined).` Removed 4.7 GB of stale experiment copies (ignored `test-runs/p4d-run/`).
- UNIT READY (Core, under packages/fluxiq/src/): `client-gateway/trace-matcher/**`, `client-gateway/index.ts`,
  `client-gateway/service/{commands.ts,channel-scope/**,command-ledger/dispatch.ts,command-reconcile/reconciler.ts}`
  and `client-gateway/service/tests/scope-timers.test.ts`; `programs/automation-studio/model/offline-trial/**`;
  `programs/automation-studio/runtime/{environment/**,executor/{region-execution,contracts,graph-run}.ts,executor/tests/region-timeout/**}`;
  `programs/automation-studio/runtime/service/offline-trial/**`; `programs/automation-studio/runtime/gateway-trace/**`;
  `programs/automation-studio/runtime/index.ts`. Downstream: `packages/test-runner/src/offline-trial-experiment/**`
  and `docs/working/trace-offline-trials-plan/reports/lane-t-p4*.md`.

## Gate (plan P4)

| Source test | Proven by |
| --- | --- |
| T05 changed computation executes | `offline-trial/tests/edits.test.ts`; E3 |
| T06 new computation over unused recorded fields | `offline-trial/tests/edits.test.ts` |
| T07 changed action args/target/order -> gap | `trace-matcher/tests/matcher-gaps.test.ts`, `operation-match.test.ts`; E2 |
| T08 same command twice, different results | `trace-matcher/tests/matcher-replay.test.ts` |
| T10 no future leakage | `trace-matcher/tests/matcher-replay.test.ts` |
| T12 ack, unsolicited event, completion in order | `trace-matcher/tests/matcher-replay.test.ts` (race fixed by the lead) |
| T13 logical timeout durations | `environment/tests/scoped-deadlines.test.ts`, `executor/tests/region-timeout/**` (+ `graph-run.ts` wiring) |
| T14 truncated / broken / missing / incompatible | `trace-matcher/tests/matcher-gaps.test.ts`, `matcher-deliveries.test.ts`; runner refusals |
| T15 node structure refactor keeps matching | `trace-matcher/tests/operation-match.test.ts` |
| T16 recorded failure then retry | `offline-trial/tests/parity.test.ts` / `edits.test.ts` (production retry consumes recorded attempts) |
| T20 unsupported op blocked, no live fallback | `trace-matcher/tests/matcher-gaps.test.ts`; channel scope (t734) |
| T22 changed model request not reused | `offline-trial/tests/edits.test.ts` (judge called on the new run; no recorded model answer) |
| T23 no stale checkpoint inherited | `offline-trial/tests/edits.test.ts` |
| T24 derived diagnostic trace | `offline-trial/tests/provenance.test.ts`, `gateway-trace/wiring/tests/trial-origin.test.ts`; every experiment run's trace |
| Exploration refused; offline yes never completes | runner refusal test; the gate (t734 tests) |

Social gate: met for original parity on real traces (E1: both live trial outcomes reproduced exactly, oracle verdict =
live judged "no"). Not met for "a corrected candidate reproduces the judged result": the named breadth run
(run-mvfq957o-40103539) predates trace capture, and in the traced round-4 run the build's correction (revision 16)
changes `extractList.where`, a filter applied inside the extension's read, so tier 1 answers it with an explicit
`argument_mismatch` gap (E2) instead of passing revision 10's rows off as revision 16's -- which is the intended tier-1
behaviour. A reproduction needs either tier 2 (P5: re-run the read over the captured page snapshot) or a traced live
run whose correction is Core-side only (like the breadth run's revision 10 -> 9; a paid run, the supervisor's call).

## Not verified

- No live or paid run; the experiments are provider-free on copied round-4 traces with a non-model judge.
- Production does not yet pass the live session's view to the runner (only the argument exists; P6 wires it with the
  phase choice).
- One offline-trial test run came back inconclusive once (F-b); not reproduced in 19 runs since; cause unknown.
- E3's reads differed from live only in a word digest (cause not investigated; rows and counts equal).
- Chromium only.

## Open questions or contradictions found

1. The social gate as worded needs tier 2 or a traced Core-side correction (above).
2. U5 has no fields for coverage counts or normalizations, so the runner's outcome carries `sessionView`,
   `normalizations` and `supported {matched, recorded}`; adding them to U5 is a model change for the supervisor to
   weigh when P6 surfaces offline results.
3. The experiment's revision rebuild loads three unexported Core authoring modules (digest-guarded); a Core export for
   rebuilding a recorded revision would remove that coupling.
4. A recorded input the gateway now refuses stays a note, not a gap: the original may have refused it too; telling
   which needs comparing against the recorded disposition.
5. `pnpm structure:baseline` can lower `service.ts` file-lines (supervisor).
