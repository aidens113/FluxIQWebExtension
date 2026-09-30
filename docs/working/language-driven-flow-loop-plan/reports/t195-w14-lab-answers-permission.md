# t195-w14: the Lab plays the person at a permission ask (fix L1)

Worker t195-w14, lane D (lead t195), 2026-09-30. Tree `fxwork/t195/!FluxIQWebExtension`, Core read-only.

## Outcome

Done. The Lab person now answers pending `kind: "permission"` asks in the created-Flow lane: `grant` at the task's
declared `permissionPoint`, `deny` elsewhere or when no point is declared. A task with `askFirst` has its ask left alone.
Each answer is recorded as `permissionAnswers` in `snapshots/person-hand-offs.json`, apart from `handOffs`. The lane
passes a consequential task's proposed Flow only if Core's own record on the Flow's thread shows a grant at the point.
Otherwise it fails `runtime.behavior` with `permissionPoint: "not_asked"`. The playback needed no change (finding 4).

## What changed and why

- `person-simulation/asks.ts`: `pendingPersonAsks` now also returns pending `permission` asks, as a union member
  `{kind: "permission", missing, controlName}`. `missing` and `controlName` come from the ask's own `missing` and
  `control.name`, falling back to `permissionRequest`, through `permissionQuestionOf`. The new `answerPermissionAsk`
  sends `answer-ask {projectId, askId, kind: "grant" | "deny"}` with no `value`, as Core's handler takes it
  (`api/handlers/conversations.ts:216-233`).
- `person-simulation/permission-answer.ts` (new, in the owned directory): `PermissionPlay`, `PersonPermissionAnswer`,
  and `answerPermissionAskAsPerson`. It reuses `judgeCreatedFlowPermissionStop`, imported from the `flow-lane` barrel
  (the direction `lab-person.ts` already used), and does not copy it.
- `person-simulation/simulation.ts`: permission asks are answered only when the input has `permissions`. Without it
  they are left alone, which is unchanged behaviour and what the recorded-Flow-lane call (run-scenario ~line 476)
  still gets. `stop()` returns `LabPersonSnapshot` = `PersonHandOffSnapshot & {permissionAnswers}`, defined in
  `hand-off-record.ts`. `PersonHandOffSnapshot` itself is unchanged, so `run-evaluation/person-hand-off-evidence.ts`
  and the invariant read nothing new.
- `person-simulation/lab-person.ts`, `index.ts`: optional `permissions` and `publishPermission` inputs, and the
  barrel export.
- `run-scenario.ts`: only the creation-branch `startLabPerson` call changed. It adds
  `permissions: { point: creation.task.permissionPoint }` and `publishPermission`, a `runtime.settle` timeline event.
- `flow-lane/creation/permission-point.ts`: the judge now takes `Pick<request, "missing" | "controlName">`, so an ask
  can be judged. The new `readCreatedFlowPermissionAsks` reads Core's record: every `permission` ask on the Flow's own
  thread (subject `flow` and the flowId), with its status and answer, each judged against the point. It also holds
  `permissionQuestionOf`. `index.ts` now exports this file; the person simulation needs it through the barrel.
- `flow-lane/creation/lane.ts`: the lane keeps the build's `permittedConsequences` by wrapping `authorizeBuild`.
  The new `assertGrantedAtPermissionPoint` runs after a proposal and before approval or apply. It applies when a
  point is declared, the task is not `askFirst`, and its class was not permitted. It needs a grant at the point in
  Core's record, or it throws `runtime.behavior` with details `{permissionPoint: "not_asked", consequence,
  adaptationId, permissionAsks: [{askId, status, answer, verdict, reason?}]}`. Stop handling for a build that ends on
  its request is unchanged. Doc comments no longer call that stop "the pass".
- Tests: `person-simulation/tests/{asks,simulation}.test.ts` and
  `flow-lane/creation/tests/{permission-point,lane}.test.ts`. `fake-creation-core.ts` gains `flowThreadAsks`, and
  the lane test harness gains `permitted`.
- `docs/architecture/testing-facility.md`: the person-simulation paragraph now says permission asks are answered in
  the created-Flow lane, and a new paragraph describes the rule, the record, the verdict and the playback finding.

**Why the lane reads Core instead of the Lab's record.** The brief lets me change only the `startLabPerson` call in
`run-scenario.ts`, so the lane cannot be handed the Lab person's answers. `flow-lane` also must not import
`person-simulation`, because `person-simulation` already imports `flow-lane` and that would be a cycle. The answer
that released the build lives only on Core's ask: after a grant the gate forgets the request
(`AS/runtime/action-permissions/gate.ts:165-170`), so the proposal carries none. So Core's own record is the evidence.

## Finding (brief step 4): what the playback run does at the consequential step

The Flow's own steps are not gated at all, so the playback will not end on the request and no classes need carrying.
- `AS/runtime/flow-bootstrap/adaptation.ts:344-346`: "a saved Flow replays with no gate in front of it, by design,
  because a replay has no model". The one hold is at apply: an unanswered or denied request blocks the proposal
  (`adaptation.ts:355-362`, `service/flow-bootstrap-commands/permission-hold.ts:28-36`). After a grant the proposal
  has no request (gate.ts:165-170), so nothing holds it.
- Domain nodes are neither privileged nor approval-gated (`domain/src/output-nodes/definitions.ts:193-210`). The
  executor raises an ask only from a node's effects or a person-needed step (`AS/runtime/executor/graph-run.ts:485-503`).
- Only a repair during the playback is gated. The run's `permittedConsequences` go only to the recovery annotation
  (`AS/runtime/service.ts:2561-2563, 2598, 2719, 2777`). With the run's thread bound as a parking port
  (`service.ts:2620`), the repair parks on a permission ask and waits 120 s (`AS/runtime/recovery/annotation/annotate.ts:311-328`,
  `recovery/runtime-exploration.ts:340-367`). The same Lab person answers it by the same rule (stage `run`).

So I did not add the build's granted classes to the playback's `permittedConsequences`. The build does wait for the
answer: the endpoint the Lab calls sets `permissionAskTimeoutMs: 120_000` (`AS/api/handlers/llm-generation.ts:96-99`),
and without it the build would open the ask and refuse at once (`parking/permission-ask.ts:59-62, 101`).

## Commands run and observed results

- `bash .../build-slots/heavy.sh "t195 w14 tsc" npx tsc -p packages/test-runner/tsconfig.json --noEmit`: the first
  run gave one error, `exactOptionalPropertyTypes` in `permission-answer.ts:60`. I fixed it, and every later run
  printed only `[heavy] t195 w14 tsc holds bN`: no errors, including the final run after all edits.
- `npx tsc -p packages/test-runner/tsconfig.json --outDir packages/test-runner/.t195w14-dist`: exit clean. The
  tsconfig has no incremental or composite option, so nothing was written to `dist/`.
- Then `node --test person-simulation/tests/*.test.js flow-lane/creation/tests/*.test.js lane-rules/tests/*.test.js
  run-evaluation/tests/*.test.js`: `# tests 192, # pass 191, # fail 1`. The failure is
  `runner-wiring.test.js` "the redaction attestation scans once Core has stopped...". It is a source pin on the
  `runRedactionScopes(...)` line (`runner-wiring.test.ts:156-158`) and has nothing to do with my one-call edit. The
  Current State (F10 row) records it as t174's stale redaction pin.
- After tightening one lane assertion, `node --test person-simulation/tests/*.test.js flow-lane/creation/tests/*.test.js`:
  `# pass 103, # fail 0`.
- Revert checks, each run by patching the compiled JS in the private dir, running the owning test file, then
  restoring:
  - asks, permission branch off: 2 fail (tests 1, 3).
  - asks, answer sent as a choice: 1 fail (test 4).
  - simulation, permission asks skipped: 2 fail (tests 4, 5).
  - `askFirst` answered anyway: 1 fail (test 5).
  - reader returns `[]`: 1 fail (permission-point test 11).
  - lane verdict call removed: 2 fail (lane tests 22, 23).
  - permitted-class exemption removed: 1 fail (lane test 24).
  - "leave alone without a play" guard removed: 2 fail (simulation tests 1, 6).
  - After restoring, the suites were 103/103 again.
- `rm -rf packages/test-runner/.t195w14-dist` (and my revert script). Deleted.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (129 warning(s), 120 baselined)`. Of my files only
  `lane.ts` warns, at 474 lines against the 400 advisory threshold; it was already 430 lines, over the threshold,
  before this change. An earlier audit run, made while `.t195w14-dist` still existed, failed on that build output;
  that is why the private directory has to be deleted before the audit.

## Not verified

- No Lab, browser or live run (forbidden by the brief). Live proof is still pending: bigbox-retail-pickup-order should
  ask at "Place order", the Lab grants, the build resumes and proposes, the lane's read-back finds the grant, and the
  playback places the order.
- I did not check that the Lab's own HTTP bound on `generate-flow-bootstrap-adaptation` outlasts a build parked for
  up to 120 s. The Lab answers within about 1 s of the ask, so this should not matter.
- The whole test-runner suite was not run, only the four named directories.

## Open questions or contradictions found

- The brief says "a stop is never a pass" (dev `f2f80024`). In this tree `lane.ts` still returns
  `CreatedFlowLanePermissionStop` rather than throwing, and `run-scenario.ts` turns it into `stopped_for_permission`.
  I kept that as the brief says, and only corrected the comments that called it the pass.
- A build asks at most once (`flow-bootstrap/action-permissions.ts`: "One question at a time, and at most one wait").
  If its first ask is elsewhere and the Lab denies it, the build can never ask at the point, and it ends on the earlier
  request. That is Core's behaviour, and the lane reports it honestly (`permission.required`, `control_differs` or
  `class_not_missing`). It is worth watching in live runs, where a cookie wall or another `create_new` act could come
  before the real act.
- `lane.ts` is now 474 lines (advisory limit 400). It is a candidate to split in a later structural pass. Not done
  here, to stay within the brief.
