# t244 — Partial runs, and a full run judged success before a Flow is accepted

Lead: t244 (lead-xhigh). Trees: `fxwork/t244/!FluxIQ` and `fxwork/t244/!FluxIQWebExtension`, branch
`task/t244-partial-runs-full-judged-gate`. `R/` = `packages/fluxiq/src/programs/automation-studio/runtime/` in Core.

User rule (2026-10-02, binding): "When testing, the repair loop/general LLM should be able to run from a certain
node to only test parts hte flow. One thing thouhg, it must test the entire flow & have that judged success at least
one time". Supervisor's reading: (1) a tool that runs the Flow from a chosen node, optionally to a chosen end node, on
the target as it stands; (2) a build cannot propose or finish, and a repair cannot be accepted, until a whole-Flow run
from its start was judged successful on the Flow as it finally stands; an edit after that run needs another.

## Design

### How it works today (read from the code)

- **The build's "Flow" is the draft.** Proposed draft steps (`R/flow-draft/step.ts`) are assembled into the Flow.
  Each step that ran in this build carries `ranWith` (the argument the Flow runs it with) and `replay` (the domain's
  opaque `from` — for the web `{location}` — and `produced`).
- **The whole-Flow test is the dry run** (`R/flow-draft/dry-run.ts`, `R/llm/node-tools/{replay,replay-draft,dry-run-gate}.ts`).
  On a completion the check accepts, the gate resets the target to the first proposed step's `replay.from`, then
  sends every proposed step through the loop's permission-gated executor as `{...ranWith, replay:"step"|"verify"}`
  (verify for a step that declares a lasting consequence, D1). No provider call; the replay calls are not counted as
  model tool calls. A clean verdict is cached by `automationStudioFlowDraftReplaySignature` — actionId plus
  `ranWith ?? input` per proposed step, **routing excluded** — and a passing test is handed to `observeTest`.
- **The judge** (`R/service/flow-bootstrap-commands/build-judge.ts` -> `R/result-verification/build-test/judge.ts`)
  keeps the round's last passing test (`lastTest`) and, when the loop ends accepted, judges a summary built from it.
  Verdicts: `yes`, `no`, `unknown` (unsure), `not_judged` (no cost, purse refused, deadline, not performed).
- **Phases** (`R/flow-bootstrap/unfinished-build/phases.ts:313`): `no` repairs; **every other verdict finishes the
  build**, `unknown`/`not_judged` as "unverified". Nothing ties the verdict to the Flow version it judged; it is
  only true by construction that `lastTest` was the accepted draft's test.
- **Re-author** (`R/recovery/refuted-result/reauthor.ts`, wrong answer and failed step) is an extend build seeded by
  `draft-from-flow.ts`: carried steps `f<n>` have `input = {node, parameters}`, **no `ranWith`, no `replay`, no
  consequence declaration**. The draft is therefore not replayable, the gate does not apply, `lastTest` stays
  empty, the judge answers `unknown` with `untestedCarried`, and the build *finishes unverified*. The port then
  approves and applies it immediately (`reauthor.ts:161`), and only the re-run after apply runs it whole. Nothing
  rolls an applied extend back (`service.ts:3660` refuses even a manual revert of an extend).
- **The patch ladder** (`R/recovery/annotation/annotate.ts`) is single structured calls plus an optional evidence
  loop over recovery tools with no node library and no draft (`recovery/annotation/exploration.ts:198`). A runtime
  patch is trial-run from the changed node (`flow-change/trial.ts`, `startNodeId`), then auto-applied mid-run by
  `maybePromoteRuntimeAdaptation` (`service.ts:2468`, gate `decideAutomationStudioAdaptationPromotionGate`, a
  succeeded trial suffices) before the run resumes and before its result is judged.
- **Executor:** `AutomationStudioGraphExecutionOptions.startNodeId` exists (`R/executor/contracts.ts:332`,
  `graph-run.ts:396`); there is no stop/end node, and `runRuntimeSession` exposes neither.

### (1) The partial-run tool: `core.run_flow`

- **What it runs.** Input `{from, to?}`: draft step numbers as the draft entry shows them. It runs the *proposed*
  steps with `from <= position <= to` (to the last proposed step when `to` is absent), in order, **on the target as
  it stands: no reset**, each with the very call the dry run would send (`automationStudioNodeReplayStepCall` /
  `VerifyCall`, D1 mode), through the loop's permission-gated `input.executeTool`. A step the Flow would not always
  run (`optional`, `only_if`, ...) that does not pass is reported and the run goes on, as the Flow would; any other
  step that does not pass stops the run there, leaving the target where it broke. A step with nothing to run it
  with (a step carried from an earlier Flow that never ran in this build) stops the run as `not_run_in_this_build`:
  it carries no consequence declaration, and running it would bypass the permission gate (`webActionPermission`
  reads an absent declaration as "no consequence").
- **What it costs.** One model decision (the call), counted as one tool call. The inner calls make **no provider
  call** and are not counted as tool calls (as the dry run's are not). Each inner call is an ordinary executor call,
  so the chat and step log see it as the dry run's calls are seen.
- **What it records.** One history/trace row (`toolId: core.run_flow`, result code `core.run_flow.ran` or
  `core.run_flow.stopped`, refusals `run_flow.*` with `ok:false`); one evidence entry: each step's word
  (replayed / verified / present / remembered / failed / changed / unreproducible / not_run_in_this_build), where it
  stopped, and the domain's evidence of the step that stopped it (else the last that ran). State digests are the
  first inner call's `before` and the last one's `after`. It records **no draft step**, never writes
  `step.replayed`, never touches the dry-run gate's clean verdict, and is never the Flow's test.
- **Where it is offered.** The evidence loop offers it whenever it drafts and the dry run is on, and only while the
  draft has at least one proposed step that can run again: so the build, every repair round of a build, and the
  re-author (an extend build). The ladder's exploration loop has no draft, so it is not offered there — see (3).

### (2) The gate: a whole-Flow run, judged success, on the Flow as it finally stands

- **Flow signature** (`R/flow-draft/flow-signature.ts`, new): what a Flow version *is* for a test and a judge — per
  proposed step, in order: `actionId`, `ranWith ?? input`, `settings`, `routing`, `interruption`, `acts`. Unlike the
  replay signature it includes routing and settings, because an edit to either changes the Flow (supervisor:
  "an edit to the Flow after that run requires another full run").
- **Dry-run gate** (`R/llm/node-tools/dry-run-gate.ts`): clean and refused verdicts are keyed by the Flow signature.
  The pass "on an earlier replay's outcomes once failing steps were marked optional" is removed: marking a step
  optional changes the Flow, so it is run again. A pass where the replay itself made a sometimes-present step
  optional keys on the signature *after* that change (the run that proved it is the run of that Flow). The report
  handed to `observeTest` carries `signature`. A completion whose proposed steps include a carried step that never
  ran in this build is refused `llm_evidence_loop.full_run_required`, naming those steps and telling the model to
  rerun each (amend_draft rerun with its consequences) so it becomes a step that ran — the only way a re-authored
  Flow can be tested whole.
- **Phases** (`R/flow-bootstrap/unfinished-build/phases.ts`): a round finishes **only** on a judge verdict `yes`
  whose `flowSignature` equals the Flow signature of the steps the loop accepted. `unknown`, `not_judged`, or a `yes`
  about another version (or none) is a round judged wrong: it goes to a repair round with the judge's account, under
  the same funding and progress bounds (a purse that cannot fund another decision and judge ends the build
  `budget_exhausted`/cost, with the Flow kept). The verdict is tied to the version it judged by
  `build-judge.ts` stamping `flowSignature = lastTest.signature` on every verdict.
- **Re-author / adaptation apply.** The re-author's `generate` resolves only with an adaptation from a *finished*
  build, so approve + apply (`reauthor.ts:161`) now happens only after a judged-success full run of the re-authored
  Flow, carried steps included. No separate gate is needed at `applyFlowBootstrapAdaptation`.
- **No judge.** A phases caller without a judge still finishes unjudged; the service always passes one for an
  evidence-guided build (`service.ts:1618`). The one-shot (not evidence-guided) build path runs no test and no
  judge and produces a proposal for review; it is outside the loops this rule names (stated, not changed).

### (3) The patch ladder — needs routing by the supervisor

- **Tool.** The ladder repairs a stored Flow version during a run, so "run from node X to node Y on the target as
  it stands" is an executor run. Needed in `R/executor/**` (t243's area, not edited here):
  `AutomationStudioGraphExecutionOptions.stopAfterNodeId?: string` — `graph-run.ts` stops after that node has run
  (its outcome recorded), ending the run `succeeded` with a stop reason `stopped_at_node`, never following its
  outgoing edge; `runCanonicalAutomationStudioFlow` passes it to the root graph only (as `startNodeId`). Then a
  Core harness option `core.run_flow` for the recovery stages (`gather`, `iterate`) whose implementation runs the
  run's current Flow (patched candidate when one is in trial) from `startNodeId` to `stopAfterNodeId` with the
  run's session and the values the run holds at that node (as `flow-change/trial.ts` seeds them).
- **Gate.** `maybePromoteRuntimeAdaptation` auto-applies a runtime patch mid-run on a trial alone. Under the rule it
  must instead be applied only after the run that trialled it finished whole from its start and its result was
  judged `answers` by the result check; the resume would run the unapplied candidate. That reorders
  `service.ts:2468-2527`, `service/runtime-adaptation/repair-rerun.ts` and the result-verification outcome — outside
  this lane's ownership and next to t245's repair-rerun work — so it is reported as a follow-up brief.

## Work

(Filled as it lands.)
