# t769 core-design: P6 offline-first trials in builds (read-only design)

Core tree `fxwork/t769/!FluxIQ` on `task/t769-p6-offline-trials-in-builds`. Paths below are under
`packages/fluxiq/src/programs/automation-studio/` (AS) unless they start with another root. Nothing was edited
except this report.

## Outcome

Done (design). Two findings change the spec as written:

- **F1. `core.run_flow` is not offered where the test tools are, and it would not work there.** The candidate loop
  removes it (`runtime/flow-bootstrap/candidate/authoring-loop.ts:151`). Subflow builders never get it
  (`runtime/flow-bootstrap/subflow-candidate/role-tools.ts:9`). It runs the evidence loop's *draft* steps
  (`runtime/llm/node-tools/run-flow.ts:85-104`, which needs `enabled` plus proposed steps with `ranWith`/`replay`).
  Builders submit scripts with `draft: false, dryRun: false`, so the tool has nothing to run. Recommendation (§3):
  when the trace cannot answer (a gap), the live trial runs in the same call.
- **F2. The P4 runner covers only a whole-candidate trial.** `runtime/service/offline-trial/run.ts:59-114` wraps
  `runAutomationStudioCandidateTrial`. A subflow trial needs a twin over `runAutomationStudioSubflowTrial`
  (`runtime/service/subflow-trial/run.ts:137`), which is already environment-aware (U7).
- **F3 (latent bug).** `runtime/project-agents/dispatch/trial-port.ts` copies `prepareStart`, `admissionPredecessors`,
  `checkRows` and `weighed` onto its wrapper, but not `environmentKind`. Today an offline subflow port would look live
  to the brief's gate. P6 must copy both `environmentKind` and the new `offlineFirst`.

## 1. Where the gates get their ports; choosing offline or live for each trial

**Whole candidate trials.** `runtime/service.ts:386` adopts the trial collaborators; `:1584` makes `trialEnvironment`
(`service/trial-ports/environment.ts:30`); `:1585` calls `automationStudioProjectBuildWholeTrials`
(`service/project-build/whole-trials.ts:53`), which wraps `automationStudioCandidateTrialPort`
(`service/candidate-trial/port.ts:38`, `environmentKind` at `:65-66`). A candidate build (no ledger) gets the inner
port unchanged (`whole-trials.ts:72`); a project build gets the wrapper (`:89-91`). Gates: candidate build
`flow-bootstrap/candidate/authoring-loop.ts:122`; project supervisor `project-agents/supervisor/supervisor-loop.ts:256`;
single-subflow brief `project-agents/single-subflow/whole-test-port.ts:36`.

**Subflow trials.** `service/project-build/run.ts:251` calls `automationStudioProjectBuildSubflowTrials`
(`subflow-trials.ts:60`), which wraps `automationStudioSubflowTrialPort` (`service/subflow-trial/port.ts:45`; kind at
`:79-80`, re-exposed at `subflow-trials.ts:113-114`). `run.ts:260` passes it to `brief-ports.ts:247,308`;
`project-agents/dispatch/run-brief.ts:380-383` wraps it with `automationStudioProjectDispatchTrialPort`, and `:410`
hands it to the gate at `flow-bootstrap/subflow-candidate/builder-loop.ts:264`.

**Today's offline decision.** `automationStudioCandidateTrialOffline(port)` (`trial-gate.ts:604`), read once per call:
whole gate `trial-gate.ts:437-445` (hook and reset skipped) and `:476-480` (yes kept as evidence only); subflow gate
`subflow-trial-gate.ts:498-506` and `:547-556`.

**Proposal: an optional port member `offlineFirst`, consulted per call before any site action.**
- **Where the gate calls it.** In both `test()` methods, immediately after the retest-limit check
  (`trial-gate.ts:430-434`, `subflow-trial-gate.ts:492-495`) and before admission, `prepareStart` and the reset. This
  keeps "iterate without acting on the site" true: a demonstrated failure costs no reset and no hook.
- **When the gate calls it.** Only when the port has it and `tried === 0` for this revision and digest. So offline is
  tried at most once per revision, and every retest is live. That rule is the anti-loop rule (§3).
- **What it answers** (a union in a new flow-bootstrap module; no trace types reach flow-bootstrap):
  - `{ kind: "kept", result, standingNo?, checked }`: a failure the recording demonstrates. `result.verdict` is
    `no` or `execution_failed`; the gate refuses anything else by treating it as `live`.
  - `{ kind: "live", note }`: run live in this same call, with `note.outcome` one of `passed`, `gap` (with `step` and
    `why`), `inconclusive` or `not_tried`.
- **How the gate uses it.**
  - `kept` takes the place of `this.ask(...)`. The weighing that follows is unchanged (standing nos, `closedDigests`
    on a no, `recordStop`, earlier advice). Skipped: `reset.trialRan` and `leftOnSite`, because nothing touched the
    site.
  - `live` runs today's path, and the evidence gains `offlineCheck: note`.
  - An offline yes never becomes the gate's answer, so Decision 3 holds by construction. The existing
    `environmentKind` path stays for hosts and tests.

**New modules** (one export per file, a barrel in each, tests in `tests/` beside them):

- `runtime/flow-bootstrap/offline-first/` (new directory; `flow-bootstrap/candidate/` is at 24 files plus tests):
  `contracts.ts` (the `offlineFirst` function type and answer union); `gate-step.ts`
  (`automationStudioTrialOfflineFirstStep`: validates an answer, returns `{ keep } | { live, note }`); `words.ts`
  (`AUTOMATION_STUDIO_TRIAL_OFFLINE_FIRST_WORDS`, generic sentences only); `index.ts`; `tests/gate-step.test.ts`.
- `runtime/service/offline-first/` (new): `installation.ts` (`AutomationStudioOfflineTrialInstallation`: the host's
  gateway, `storeFor`, `sessionViewFor`, installed like `gateway-trace/installation.ts`); `sources.ts`
  (`AutomationStudioOfflineFirstSources`, §2); `answer.ts` (`automationStudioOfflineFirstAnswer`, a pure mapping from
  runner outcome to gate answer); `whole.ts` (`automationStudioOfflineFirstWhole`); `subflow.ts`
  (`automationStudioOfflineFirstSubflow`); `index.ts`; `tests/`.
- `runtime/service/offline-trial/`: new `matcher-session.ts` (run.ts's matcher setup and teardown, lines 66-96,
  extracted and used by both runners); new `subflow-run.ts` (`runAutomationStudioOfflineSubflowTrial`); `contracts.ts`
  adds the subflow input and outcome; `evidence-result.ts` widens `trial` to the
  `{ record: { execution, revision, digest }, result: { verdict } }` shape both outcomes share (it reads only those,
  lines 60-111).

**Callers that change**
- Types:
  - `flow-bootstrap/candidate/contracts.ts:164` gains `offlineFirst?` on `AutomationStudioCandidateTrialPort`;
  - the subflow preparing-port type in `subflow-trial-gate.ts` (around l.260-300) gains the same.
- Gates: `trial-gate.ts` and `subflow-trial-gate.ts` (the `test()` bodies only).
- Wrappers:
  - `whole-trials.ts`: attach `offlineFirst` to the inner port before `:72`, for a candidate build only. A project
    build's whole trial is the final judged run and stays live.
  - `subflow-trials.ts`: attach it, record each answer it keeps in `answered` so `weighed` reaches the proposals, and
    copy it onto the wrapper next to `environmentKind`.
  - `project-agents/dispatch/trial-port.ts`: copy `environmentKind` (F3) and `offlineFirst`. A `kept` answer is
    listed through the receipts the way a port answer is; `dispatch/receipts.ts` needs an `add` path for it, so the
    supervisor and repair briefs see the failing trial.
- No change in `authoring-loop.ts`, `builder-loop.ts` or `supervisor-loop.ts`: the member travels on the port.
- No change to `service.ts`, which is frozen by the baseline: the installation is read from the trial-ports layer,
  not threaded through service.ts.

## 2. Finding the build's latest live test trace of the same scope

**There is no store index by build or scope.** `ClientGatewayTraceStore` (`client-gateway/trace/types.ts:370-378`)
reads only by `traceId`. The trace id is random (`gateway-trace/episodes.ts:92`) and is surfaced only in the parent
build trace's `child_episode_opened` marker (`:198`). The trial context (`AUTOMATION_STUDIO_GATEWAY_TRACE_CONTEXT
.subflowTrial`, `subflow-trial/run.ts:167`) and `metadata.subflowTrial` on the runtime session (`:179,216`) name
build, brief, subflow, revision and digest, but nothing can query them.

**So the build remembers its sources as it runs.**
- Each runner reads the open episode's `traceId` inside its traced work, through
  `AutomationStudioGatewayTraceInstallation.current()?.current()?.traceId`, and records it as `traceId?` on its
  record (`candidate-trial/contracts.ts:52`, `subflow-trial/types.ts`). The episode is closed before the work
  returns (`episodes.ts:105-110`), so the next read sees a closed manifest.
- `AutomationStudioOfflineFirstSources`, one per port factory and therefore one per build, keeps the latest eligible
  record for each scope. A whole candidate's key is `whole:<candidateId>`. A subflow's key is `<buildId>/<subflowKey>`:
  the latest across briefs and plans, because a predecessor that changed shows up as matcher gaps.

**Eligible:** a live port's record (never one from the offline runner, which bypasses the port records) with
`trialRunId` and `traceId` present and `execution` not `not_run`; for a subflow, `entryPrepared === true`; and a
manifest with `origin.kind === "live"` (the runner re-checks, refusing `source_not_live`).

**Ineligible:** exploration (the build episode is never a trial record); derived traces (offline captures, T24); a
trial with no trace id (tracing off, or the trace failed to open); a trace the matcher refuses (incomplete, another
contract, an ambiguous session); and a trace with no `session.claimed` and no supplied view, refused
`incomplete_capture`. Pre-P3 traces fall in the last group unless a view is supplied (§6).

**The candidate's same-scope match** is the matcher's per-operation match (P4b) over that one trace. The trial
request is the live one, unchanged.

## 3. Outcome mapping (`service/offline-first/answer.ts`, pure)

| Runner outcome | Gate answer | Effect |
| --- | --- | --- |
| `refused` (no source, exploration, `source_not_live`, `incomplete_capture`, …) | `live`, `not_tried` | today's live trial |
| `ran`, evidence `fail`, no gaps, verdict `no` | `kept` | recorded repair feedback; digest closed as a live no would close it |
| `ran`, no gaps, `execution_failed` on recorded support | `kept` | recorded repair feedback; the stop is recorded |
| `ran`, `pass` (yes, no gaps) | `live`, `passed` | reset and hook, then live; the live answer is kept |
| `ran`, any gap (`inconclusive`) | `live`, `gap` + step + why | live trial in the same call (F1) |
| `ran`, judge `unsure` / `not_judged`, or unaffordable | `live`, `inconclusive` | live (it refuses unaffordable itself) |

**Details**
- **Counting.** A `kept` answer counts as one trial of the revision (`trials.set(tried+1)`). Its `execution_failed`
  stop counts toward the same-failure rule: it is a demonstrated stop on recorded support. Because offline runs only
  at `tried === 0`, the next test of that revision is live, so a second identical live stop closes it. That is the
  intended "twice the same" rule. Flagged for the supervisor: you may prefer that offline stops not count toward
  same-failure.
- **Evidence on a kept answer.** `checkedAgainst: "recorded_run"`, `resultCode` `candidate|subflow.trial_<verdict>`,
  and an instruction prefixed with the generic words sentence ("This test ran against the recording of the last live
  test, not the site …").
- **Gap step.** The step is the first feedback step whose `failureCode` is a matcher gap reason (the gap answer's
  `failure.code`, `client-gateway/trace-matcher/gap-answer.ts`). `why` is the reason code, worded in `words.ts`.
- **The next test of the same revision.** `tried > 0`, so it is live, with no repeat of the same gap. After any live
  trial the new trace becomes the scope's source, so the next revision runs offline against it (this is T21).
- **On F1.** Telling the builder to run that part live itself would cost a model turn and still need a live trial
  before completing. So the same-call live fallback is cheaper and keeps "live only on errors". A real part-run of a
  submitted proposal would be a new Core tool, a separate decision.
- **Spend.** An offline trial calls the real judge (T22). An offline pass therefore pays the judge twice. `whole.ts`
  and `subflow.ts` keep offline records apart (`offlineRecords()`) and add their judge spend to the factory's
  `spent()`. Live `records()` stay live-only, and promotion reads only those.
- **Inputs.** The runner gets `phase: "repair"` for a repair build (`project.repair`, or `repairBrief` in
  `service.ts`), otherwise `"test"`. Its exploration refusal stays as the guard.

## 4. Live-success and trial counts

- **Core.** Promotion trials (`service.ts:1590`, `trials.records()`), generation-failure `trialCount`
  (`flow-bootstrap/generation-failure/candidate-kept.ts:52,101`), the chat's "test-run N times"
  (`conversations/commands/build.ts:121-123`, `progress.ts:147,168`) and project spend (`project-build/run.ts:252`)
  must stay live-only. They need no change provided offline records are kept apart (§3).
  `tallyAutomationStudioLiveEpisodes` and `satisfiesAutomationStudioWholeRunGate` have no production caller; keep it
  that way and prove it with T19 (§8).
- **Lab (downstream, must change).** `packages/test-runner/src/build-time/category-rules.ts:31-32` and
  `measure-build-time.ts:6,51,110` count every `core.test_*` tool window as a trial. Add category `offline` from the
  new step-log kind, with precedence `reset > offline > trial > model > exploration`, and `liveTrialCount` = windows
  without a kept offline answer. Update `types.ts:11,75,100`, `aggregate-build-times.ts:3`, `render-build-time-table.ts:4`.

## 5. Chat and step log

- **Chat.** `activity/observer.ts:340` calls `automationStudioActivityCandidateResult` (`activity/candidate/result.ts`),
  which calls `automationStudioActivityCandidateTrialWords` (`activity/candidate/trial-words.ts:44-58`). Today an
  offline yes would read "the test passed and the Flow did what you asked". Add, in plain words only (never a
  revision, digest, run id or trace id; t362): for `checkedAgainst === "recorded_run"`, "Checked against the recorded
  run, not the site: …"; for `offlineCheck.outcome === "passed"`, "It passed against the recorded run, then on the
  site: …"; for `gap`, "The recorded run couldn't answer step N (its action changed), so it was tested on the site: …".
- **Step log** (`runtime/llm/step-log/`). Add `offline-trial-step.ts`: `automationStudioLlmStepLogOfflineTrial`,
  modelled on `reset-step.ts:28-65`. It writes an `NNNN-offline` folder holding only `meta.json`: kind
  `offline_trial`, `trialToolId`, `outcome` (`kept_no`, `kept_failed`, `passed`, `gap`, `inconclusive`,
  `refused:<code>`), `matched`/`recorded` operation counts, and no trace content or trace id. The gate wraps its
  `offlineFirst` call in it; export it from the barrel and document the folder in `step-log/index.ts:27-30`. The test
  tool's own `result.json` already carries `checkedAgainst` / `offlineCheck` through the evidence.

## 6. The live session's public view in production

- The service does not hold the gateway. It is built in `programs/_shared/runtime.ts:93`, beside
  `createAutomationStudioGatewayTraceHost`.
- Install `AutomationStudioOfflineTrialInstallation` there when tracing is on, with: `gateway` = `clientGateway`
  (satisfies `AutomationStudioOfflineTrialGateway`, `service/offline-trial/contracts.ts:20`); `storeFor` = the trace
  host's (`gateway-trace/wiring/host.ts:51`; expose it on `AutomationStudioGatewayTraceHost` in `wiring/types.ts`);
  and `sessionViewFor(projectId)`. That picks from `clientGateway.snapshot().sessions` the connected,
  `!isScopedSession` sessions of the build's `projectId` with the action capability. Exactly one is mapped through
  `clientGatewayTraceSessionView` (`client-gateway/service/trace-tap/session-view.ts`) and then
  `readClientGatewayTraceHello` (`client-gateway/trace-replay/walk/hello.ts:14`; export it from the barrel if
  needed): the same mapping a recorded `session.claimed` goes through. None or several gives `undefined`, so the
  runner refuses and the trial runs live.
- Since P3 every live trial trace records `session.claimed` (`trace-tap/tap.ts:281-291`), so the supplied view is
  only a fallback. Uncertain: whether "same client" should be matched by `clientId` from the source trace instead;
  that requires reading its `session.claimed`, which is circular for exactly the traces that lack one.
- Optional: production does not bind the domain's reevaluator (downstream `domain/src/runtime/offline-reads/
  reevaluator.ts`). Without it every changed read is a gap and runs live. Binding it is a downstream binding change
  (an evidence runtime binding field). I propose P6b.

## 7. Model-facing text

- **What changes.** The kept-answer instruction prefix and the `offlineCheck` note, as constants in
  `flow-bootstrap/offline-first/words.ts`; the reason-to-words map is keyed by plain code strings, so nothing is
  imported from the trace code. Optionally one sentence in each test tool's description ("a test may first run
  against the recording of this build's last live test …") in the tool definitions in `trial-gate.ts` and
  `subflow-trial-gate.ts`. `AUTOMATION_STUDIO_CANDIDATE_OFFLINE_YES_INSTRUCTION` (`trial-gate.ts:322`) is unchanged;
  only the `environmentKind` path uses it.
- **Prompt-contract tests.** None of the three in Core `scripts/task/contract/list.mjs:14-18` (system prompt,
  extraction vocabulary, plan issue feedback) cover the gate words, so they should stay green. Run them anyway
  (`pnpm task finish` does).
- **Keeping trace content out of guidance.**
  - Add `runtime/flow-bootstrap/offline-first/words.ts` to the `from` list of the "trace-free model guidance" boundary
    in Core `scripts/structure-audit/config.mjs:167-181`. `service/offline-first/` imports `service/offline-trial/`,
    which is in `to`, so no `from` module may import it.
  - Offline feedback, meaning the new run's steps over recorded answers, reaches the model only as that call's
    evidence. This is the rule's own remedy, and the same build's live trial already showed it.

## 8. Tests to write first

| Source / plan test | New test file (exists?) |
| --- | --- |
| T09 new external query: faithful if supported, else gap | `service/offline-first/tests/answer.test.ts` (gap→live, step named); `service/offline-trial/tests/subflow-run.test.ts` (added command → gap). Matcher side exists: `client-gateway/trace-matcher/tests/matcher-gaps.test.ts`, `matcher-reevaluation.test.ts` |
| T17 identical states, different episodes: no merge | `service/offline-first/tests/sources.test.ts`: only the same build and scope, one trace per trial, never across candidates or subflows, derived never a source |
| T18 recorded success, wrong output | `flow-bootstrap/candidate/tests/offline-trial/tests/offline-first-gate.test.ts`: judge no on the offline run → kept, `checkedAgainst`, no reset, no hook, digest closed. Judge-on-new-run exists (`service/offline-trial/tests/edits.test.ts`, T22) |
| T19 1,000 replays: live counts unchanged | `service/offline-first/tests/whole.test.ts`: N offline-first calls leave `records()` and `tallyAutomationStudioLiveEpisodes` unchanged. Pure tally exists (`model/offline-trial/tests/live-episode-tally.test.ts`) |
| T21 missing transition through a real probe | `service/offline-first/tests/subflow.test.ts`: gap → live in the same call; the new live trace becomes the scope's source; the offline run's derived trace never does |
| Refused in exploration / initial build | Runner exists (`service/offline-trial/tests/gap-vocabulary.test.ts`, `provenance.test.ts`); new: `sources.test.ts`, where the first test of a scope (no source) gives `not_tried` and runs live |
| Offline pass never satisfies the whole-run gate | Exists: `flow-bootstrap/candidate/tests/offline-trial/tests/offline-trial-gate.test.ts`, `flow-bootstrap/subflow-candidate/tests/subflow-trial-offline.test.ts`, `model/offline-trial/tests/whole-run-gate-eligibility.test.ts`. New: `offline-first-gate.test.ts` (passed → live no → completion refused; a `kept` yes is refused) and extended `subflow-trial-offline.test.ts` |
| No secrets in traces | Exists: `gateway-trace/tests/screening-sink.test.ts`, `gateway-trace/wiring/tests/host-protection.test.ts`. New: `llm/step-log/tests/offline-trial-step.test.ts` (meta has no trace id or content) |
| Trace content never reaches guidance | Exists: `scripts/structure-audit/rules/tests/module-reach.test.mjs`; new: the config entry (§7), proven by the audit |
| Chat words | `activity/candidate/tests/` (new case file): offline and gap wording, with no ids |
| Retest/no-loop rule | `offline-first-gate.test.ts`: an offline kept stop, then a retest is live; a gap, then the retest is live |
| Wiring | `service/project-build/tests/project-build-offline-first.test.ts`; dispatch `tests/` (environmentKind and offlineFirst copied, kept answer listed) |

## 9. Worker briefs (partitioned by file, in order)

**Wave 1 (parallel).** B1 (worker-high): `service/offline-trial/{matcher-session.ts new, run.ts, subflow-run.ts new,
contracts.ts, evidence-result.ts, index.ts}`, `tests/subflow-run.test.ts` (+ `offline-harness.ts` if needed).
B2 (worker): `service/candidate-trial/{run.ts, contracts.ts}`, `service/subflow-trial/{run.ts, types.ts}` + a test in
each `tests/` (`traceId` on records). B3 (worker-high): `flow-bootstrap/offline-first/**` new + Core
`scripts/structure-audit/config.mjs`. B4 (worker): `llm/step-log/{offline-trial-step.ts new, index.ts}` + test.
B5 (worker): `activity/candidate/trial-words.ts` + tests. B6 (downstream, worker): `packages/test-runner/src/
build-time/{category-rules, types, measure-build-time, aggregate-build-times, render-build-time-table}.ts` + tests.

**Wave 2 (after B1-B4).** B7 (worker-high): `flow-bootstrap/candidate/{contracts.ts, trial-gate.ts}` +
`tests/offline-trial/tests/offline-first-gate.test.ts`. B8 (worker-high):
`flow-bootstrap/subflow-candidate/subflow-trial-gate.ts` + `tests/subflow-trial-offline.test.ts`. B9 (worker-high):
`service/offline-first/**` new (installation, sources, answer, whole, subflow, tests).

**Wave 3 (after B7-B9).** B10 (worker): `service/project-build/{whole-trials.ts, subflow-trials.ts}` +
`tests/project-build-offline-first.test.ts`. B11 (worker): `project-agents/dispatch/{trial-port.ts, receipts.ts}` +
tests. B12 (worker): `programs/_shared/runtime.ts`, `gateway-trace/wiring/{host.ts, types.ts}`, and the
`client-gateway/trace-replay` barrel if the hello reader needs exporting.

**Last.** The supervisor: integration, docs (Core `docs/architecture` trial and trace pages, downstream plan), a
provider-free proof on one realistic scenario (a revision that fails on the recording runs no reset), and the narrow
gates. Directory limits: `flow-bootstrap/candidate/` (24 files plus tests) and `service/project-build/` (25 files)
take no new files, which is why the new modules are their own directories.

## Commands run and observed results

Read-only inspection with `ls`, `grep`, `sed`, `cat` and `wc` over both trees. No build, test or audit was run (a
design brief).

## Not verified

No code was run; line numbers are as read on this branch today. Assumed or inferred, not checked: the 25-file
directory limit (from the Current State note and my counts; I did not read the audit rule); whether `receipts.ts` can
list an answer without a port call (I read only `wrap`/`weighed`); that predecessors changed between briefs show up as
matcher gaps; that the gap step is always the first feedback step with a gap `failureCode` (from `gap-answer.ts`);
and the downstream Lab classifier beyond the lines cited.

## Open questions or contradictions found

1. F1: the spec's `core.run_flow` for gaps is unavailable in both builder loops. The recommendation is a same-call live
   fallback. Confirm, or decide on a new part-run tool for submitted proposals.
2. An offline pass pays the judge twice (offline, then live). Accept, or skip the offline judge when
   execution matched fully and only a no matters? Skipping cannot demonstrate a no without a judge.
3. Do offline-demonstrated `execution_failed` stops count toward the same-failure rule? Proposed: yes.
4. F3: the dispatch wrapper drops `environmentKind` today. Fix it in B11 regardless of P6.
5. Should offline-first be switchable off (an env setting), or always on when tracing is installed? Proposed: on with
   tracing, no new switch.
6. Binding the domain reevaluator in production (P6b) decides how often a changed read runs live.
