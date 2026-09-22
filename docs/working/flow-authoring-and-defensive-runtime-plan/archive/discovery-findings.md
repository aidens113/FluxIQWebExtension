# Discovery findings — flow-authoring-and-defensive-runtime-plan

The seven discovery reports' findings as first recorded, 2026-09-22. Every
load-bearing claim was re-checked in source by the supervisor and is marked
**verified** where so. The plan keeps a distilled version; the full reports are
in `../reports/`. Two of these were later corrected — see the plan's
`### From wave one's workers`.

### From d2 — the recorded step (2026-09-22)

1. **The recorded state is captured and then never consulted. Verified.** Each
   recorded node carries `stateLink`, `stateSnapshotId`, `stateRef` and
   `screenshotRef` in its metadata
   (`runtime/service/recordings/proposal-candidates.ts`,
   `recordingCandidateStateLinkMetadata`). Every `stateRef` the executor reads is
   the **live** one — `currentStateRef(attempt)` and
   `attempt.stateRefs.afterAction ?? beforeAction`
   (`runtime/executor/transition-comparison.ts:111,149-150`,
   `runtime/executor/node-execution.ts:123`). No execution path reads the
   recorded link. The supervisor grepped every mention in Core's source and found
   writers, the recording contracts, fingerprinting and the recovery context's
   live diff — no reader. **Design Two's rungs 2 to 4 therefore need the runtime
   to read data it already stores, not to capture anything new.** This is the
   cheapest large win in the document.
2. **The only expected state a step carries is a URL path claim.**
   `webAutomationClickLandingExpectation` emits one `url` assertion with a 5 s
   timeout, and only when the output is `web.dom.click`
   (`domain/src/runtime/expectation/click-landing.ts:56-68`,
   `domain/src/web-panel-host.ts:144`). A condition that cannot be read is left
   **unjudged rather than failed** (`runtime/expectation/evaluate.ts:140-142`).
   So the "state checker" the plan leans on barely exists as an authoring
   surface, even though the storage for it does.
3. **The authoring ceiling is the mapper contract, not the action vocabulary.**
   Branch, switch, loop, for-each, merge, parallel and recovery all exist as Core
   node types and are **unreachable from a recording**: approval makes every
   candidate `builtin.policy.action` and wires `nodes.slice(1)` as a straight
   `success → ready` chain (`proposal-candidates.ts:107,134-141`), and a
   candidate carries no node kind, port, edge or predicate
   (`nodes/importer-sdk.ts:20-42`). Even the action node's own `failed` port is
   unreachable. **Design One's branches and loops are an authoring-path problem,
   not a new-capability problem** — materially cheaper than assumed. Also
   unreachable today: a recorded assertion, an authored wait, single-value
   extraction, and any statement of intent or tolerance.
4. **A recorded click does not wait for its target.** `clickAction` calls
   `resolveTarget` synchronously (`content/actions/click.ts:52`); the waiting
   engine is reached only by an explicit `wait_for_*` action. This is a direct
   cause of timing failures on a site we do not control, and it is why rung 2
   must exist.
5. **Rung 1 of the ladder largely exists.** Replay already resolves a target
   through recorded identity, shadow scope, selector, coordinates, visual target
   and fingerprint, then a visibility gate, a four-step veto, a positional
   cross-check, Core's matcher and finally the focused element
   (`content/action-runtime/resolve-target.ts:219-283`). The plan should reuse
   this rather than add to it.
6. **Three contradictions to resolve while here.** `coordinates` is tried second
   in the resolution order but is a declared parameter of no web action
   (`identity/veto.ts:296-300`) — dead precedence. A repair rewrites a node's
   target but leaves its recorded URL claim untouched, so a correctly repaired
   click can still fail on a stale claim. And `expectedConfirmation` and
   `expectedState` are two unreconciled "did it work" mechanisms, each needing
   opt-outs to avoid failing every replay (`web-panel-host.ts:172-177`).

### From d1 — the exploration-to-Flow seam (2026-09-22)

1. **The primitive this plan proposes already exists in Core, and the build path
   does not use it. Verified.** `runtime/exploration-reduction/` implements
   exploration-as-recording: `AutomationStudioExplorationStep` is
   `{actionId, input?, effect, outcome, stateBefore, stateAfter}` — the node
   shape Design One asks for, field for field — and
   `reduceAutomationStudioExploration` returns the minimum replayable sequence
   with a receipt giving one of five drop reasons per discarded step
   (`after_success`, `observation_only`, `did_not_succeed`, `changed_nothing`,
   `undone`) and a `stateChainIntact` honesty flag. The supervisor confirmed the
   module's contents and that **no file under `runtime/flow-bootstrap/` imports
   it**; its only importers are `runtime/index.ts` and two recovery modules.
   **Design One is substantially a wiring job, not a new invention.**
2. **The mechanical cause of the `everything-store` Flow is now known, and it is
   not forgetfulness.** Every decision is a stateless two-message request with no
   conversation history (`runtime/llm/deepseek-provider.ts:481-516`), and
   `evidenceContextWindow` keeps the newest entry **per toolId** before filling
   its byte budget (`evidence-loop.ts:638-670`). Every dismissal, every press,
   shares the toolId `web.press_control`, so **only the last one is guaranteed to
   be visible when the model writes the Flow.** A code comment at `:622-633`
   already records this exact loss producing a wrong Flow in an earlier run. The
   model did not omit its dismissals; it could no longer see them.
3. **The build's entire output is one string.** The completion schema requires a
   single `flow: string` in a plain-text grammar
   (`flow-bootstrap/plan/evidence-schema.ts:31-45`); the transcript is a local
   `const` destroyed when the Flow is written. A refused completion is re-emitted
   **from scratch**, with the previous script absent from the request — which is
   how a build once "completed again with those steps deleted and the wrong
   answer in their place" (`harness-options/bootstrap-completion.ts:65-70`).
4. **There is no wait tool on the authoring path, apparently by accident.** Core's
   six built-in harness options are never registered for a build
   (`runtime/service.ts:1881` passes no `host`), and the web domain's six
   recovery options — including a wait — are stage-pinned to `gather`/`iterate`
   while bootstrap resolution carries no stage, so `stageAllows` withholds all of
   them. The model cannot ask a page to settle.
5. **State digests are available to the build and simply not wired.**
   `captureStateDigest` exists on the binding (`binding.ts:100-107`) and the
   bootstrap loop call passes no digest hook (`runtime/service.ts:1889-1927`).
6. **A tool rejection tells the model nothing.** Rejections are deliberately
   content-free — eight codes, no detail (`domain/.../tool-rejection.ts:25-57`).
   The model is not told which handle failed or what would have worked, which is
   a direct cause of round 1's repeat-without-progress stalls.
7. **Permission is terminal on the authoring path.**
   `action-permissions.ts:72-80` throws on the first unpermitted action, its own
   comment saying this is "rather than handing the refusal back to the model to
   route around", while the domain can surface the same case as a recoverable
   `permission_required` (`press.ts:63`). This contradicts the standing product
   rule that a blocked action escalates to the person for permission rather than
   failing, and this plan should close it.
8. **A successful build's trace is poorer than a failed one's.**
   `sanitizeEvidenceLoopTrace` (`runtime/service.ts:5931-5944`) drops
   `resultCode` and `effectApplied` before a successful adaptation is stored,
   while the failure diagnostic keeps both.

### From d3 — runtime execution and failure (2026-09-22)

1. **No per-node retry exists. Verified** (see Design Two, which this corrected).
2. **The state diff is computed for every web node and decides nothing.**
   `web-state-diff.v2` costs a gateway round trip per node and is recorded on the
   attempt without being read.
3. **Three retry surfaces are inert.** `maxRetriesPerAction` is a cap that only
   *removes* a recovery candidate, not an allowance (`recovery-budget.ts:18`,
   default 1); `builtin.timing.retry` returns its own parameters as outputs and
   retries nothing (`nodes/timing/retry.ts:33`); `RetryPolicy.backoffMs` has no
   consumer at all. `retryable` on a failure code is likewise read by no runtime
   decision.
4. **Only one recovery candidate can execute.** The ladder ranks four kinds, but
   `graph-run.ts:260` executes **only** `deterministic_path`; selecting
   `llm_diagnosis` stops the run outright.
5. **Design constraint for the new rungs:** any deterministic candidate on offer
   suppresses the model (`adaptive-orchestrator.ts:92`), so a new rung must be
   *consumed and dropped from the list* or it will permanently block escalation.
6. The three known blockers on granted runs are confirmed, with one correction:
   the forced `manual_approval` at `service.ts:3060` is normalization, and the
   real refusal is `runtime-session-grant.ts:62-74`, which **throws**. A fix must
   change the refusal list, not that line.

### From d5 — existing coverage (2026-09-22)

1. **Design One's mechanism is built but attached to the wrong entry point** —
   the same finding d1 reached independently, from the plans' side: the step
   recorder, digest port and reduction are landed and live-proven, used only in
   *recovery* exploration, and the output is discarded.
2. **The model already authors routing and Subflows, and it is proven.** A
   model-built Flow replayed down two routes 14 of 14 with zero provider calls.
   So branches are not new work for model authoring — d2's finding that branches
   are unreachable applies to the **recording** path, not the script path. Design
   One's branch and loop work is therefore only about expressing them *in the
   accruing draft*.
3. **Three recorded decisions this plan touches.** Resolved below rather than
   reversed silently.

### From d4 — target resolution and existing defenses (2026-09-22)

1. **The `everything-store` navigate is fully explained. Verified.**
   `compareNavigatedUrl` compares the **requested** URL against the **landed**
   one (`apps/extension/src/runtime/navigation-outcome.ts:25-30`), so a navigate
   issued while the tab is already on that URL matches trivially and reports
   success. The only thing that would make it do work is `updateTabUrl`'s reload
   (`runtime/automation-tab.ts:132-141`), and nothing verifies the reload
   happened. Worse, there is **no evidence with which to catch it**: a
   worker-side result carries status, validation, message, timestamps, url,
   failure and visualTarget and nothing else
   (`runtime/action-results.ts`, `workerActionResult`) — no snapshot, no title,
   no element, no resolution. Together with d1's finding on the evidence window,
   the campaign's single created Flow is now explained end to end.
2. **The "did the page answer?" mechanism exists twice and is wired almost
   nowhere.** `content/action-runtime/in-place-effect.ts` implements exactly the
   right shape — a rendered-text baseline, a structural-movement requirement and
   address polling — and is armed for `a[href]` clicks only
   (`actions/click.ts:76-80`). `domain/.../llm-evidence/state-digest.ts`
   implements an exhaustive page-state digest reachable only from
   `captureStateDigest`, whose input is the authoring loop's. **No replay path
   takes a before-and-after digest.** Design Two's rungs are, again, mostly
   wiring.
3. **A wait cannot see into a shadow root.** `wait-conditions.ts` resolves every
   selector with a bare `document.querySelector` (`:74,:82,:90,:96`) although
   `resolveShadowScope` exists for precisely this, so a Flow that waits for a
   control inside a widget times out and then resolves it fine immediately
   afterwards. No justification for this was found.
4. **Three actions skip actionability entirely.** `check`, `scroll` and `upload`
   never call `checkActionability`, so a covered or inert checkbox is set
   straight through an overlay with no `covered` refusal — a silent wrong result
   rather than a failure.
5. **Sequencing dependency. Verified.** Per-Flow handle numbering, the look-alike
   cues and dialog-controls-first packets are **not on `dev`** — the supervisor
   confirmed `look-alikes.ts` is absent there. They exist only on
   `task/t070-exploration-handles` and the t075 integration branch. Any phase
   that assumes them is blocked until that integration lands, which is the
   worker already running.

### From d6 — what the Lab can measure (2026-09-22)

1. **The dry run already exists as a loop. Verified.** `replayRepairedFlow`
   (`packages/test-runner/src/flow-lane/repair/replay-repair.ts:79-125`) is
   Design One's dry run exactly: `prepare()` → `executeRecordedFlowRun` with no
   `llmExecution` → count provider calls from **Core's own accounting** → check
   the goal. Its `prepare` is `resetScenarioLab` + arm variant + load start page,
   so **the Lab can already reset a scenario to a known start state mid-run**
   without restarting the topology. A7 is therefore far cheaper than scoped: what
   is missing is a node id on the published attempt and somewhere to record the
   verdict, not the loop.
2. **A dry run costs about 2.3 s per node plus about 1 s of reset**, measured
   across 111 evaluations on disk (median 2,268 ms per node) against a median
   created-Flow run of 80.7 s — **6 to 30% more wall clock per attempt and zero
   extra provider calls.** Campaign tasks run sequentially, so it is additive.
   That is affordable for what it buys.
3. **Not one of the five deterministic rungs is observable today**, so the
   measurement must be built before the ladder can be judged. Two hard blockers:
   `flowActionsSnapshot` (`run-flow-lane.ts:428-437`) **drops the node id**, so a
   retried node cannot be joined back to its node; and
   `WebAutomationTargetResolution.strategy`
   (`domain/src/actions/types.ts:387-393`) — the exact rung-1 evidence — is
   dropped because Core's run detail drops `outputs`
   (`persisted-flow-run.ts:149-153`).
4. **The zero-call expectation is currently inverted. Verified.**
   `assertLiveLlmProviderWasReached` (`live-llm/budget.ts:101-109`) **throws when
   a `--live-llm` run made no provider call**, to catch "a deterministic pass
   wearing a live run's clothes". That guard is correct for the creation lane —
   but an adversarial variant that is *supposed* to be absorbed by rung 2 with
   zero calls would fail under exactly the flag that makes the model available.
   The fix is a **declared**-zero-calls expectation, not removing the guard, and
   it must land before any variant is authored or every correct absorption reads
   as a failure. The precedent to copy is `expected.failure` +
   `declaredFailureVerdict` (`run-evaluation/declared-failure-verdict.ts:43-70`),
   which overrides only dispatch and targeting and never the oracle.
5. Smaller gaps worth folding in: `evidenceLoop.steps` is `null` on every
   **proposed** build and populated only on refused ones
   (`build-proposal.ts:73-74`) — so the successful builds we most want to study
   are the ones we cannot; `snapshots/repair-lane.json` is written and read by
   nobody, leaving `replayProviderCalls` hard-coded `null`; no campaign row
   carries a duration; and the `navigation` and `state.change` evidence triggers
   exist in the contract but were emitted **zero** times across 219 bundles.

### From d7 — where this can live in Core (2026-09-22)

1. **`service.ts` has zero headroom. Verified.** The structure baseline records
   6,275 lines and 223 methods on `AutomationStudioService`, and the file is
   *exactly* 6,275 lines with *exactly* 223 methods. The audit reports
   `lowerable 0` — every ratcheted entry sits at its recorded value. **Not one
   line and not one method may be added to the service.** `model/` is 28 of 28
   files, `runtime/tests/` 25 of 25, `deepseek-provider.ts` 797 of 800. Every
   step here therefore lands in new modules; edits inside `service.ts` may only
   change lines, never add them. B8's guard changes qualify; nothing else may
   touch it.
2. **Four rules cannot be baselined away.** Path depth over nine segments fails
   outright, and `runtime/llm/harness`, `harness-options`, `stages` and
   `flow-bootstrap/plan` are **already at maximum depth and can never gain a
   subdirectory**. Plus forbidden imports; the `runtime/llm` → `runtime/recovery`
   value-import boundary, whose prescribed remedy is to put shared values in
   `runtime/loop-limits/`; and facade dispatch, so collaborators under
   `runtime/service/` call public methods through `AutomationStudioFacadePorts`.
3. **The dry run needs no new execution machinery** — `runAutomationStudioGraph(flow,
   { allowLlmDiagnosis: false })` already exists (`graph-run.ts:53`,
   `recovery-ladder.ts:55`). But it **crosses a documented boundary**: see
   decision 4 below.
4. **An ordered deterministic-before-model ladder already exists twice** —
   `executor/recovery-ladder.ts` and `runtime/recovery/`. Design Two extends one
   of them; it must not become a third.
5. **Draft-edit tools go through the existing harness-option registry** (cap 32
   options, Core owns 6) emitting `AutomationStudioGraphPatchOperation`, not a
   second vocabulary. Proposed homes: `runtime/flow-draft/`,
   `harness-options/builtin-edits.ts`, `runtime/draft-rehearsal/`, and an
   extension of `runtime/recovery/`.
