# Classifieds conditional permission diagnosis

Status: Read-only diagnosis complete; no product defect established
Owner: reset_review (worker)
Date: 2026-10-18
Source inspected: downstream59832522 / pairedCorec74af911, t566
Run: run-mveaglx4-22f23baf (slot3)

## Finding

The finalized proposal was NOT a proved dormant conditional send. Its final
42-line Flow contains no executable routing/branch/repeat guard; the threshold
occurs only in the Flow title. An unguarded open-offer/type/declared-send sequence
follows extraction. Core stopping at that proposed send is consistent with the
existing permission contract. The final summary's conditional description is not
evidence that the submitted executable Flow retained the condition.

The first divergence is model authoring syntax, not a live permission-refused
press. There is no justified permission-bypass or fixture/oracle/task fix here.
A general policy question about recovering from an erroneously included plan
send is separate; this run does not prove that authoring a genuinely guarded
branch is rejected incorrectly.

## Finalized receipts and instruction authority

Global evidence root:
C:/Users/osrs_/FluxStuff/lab-runs/2026-10-18/run-mveaglx4-22f23baf/steps
Local snapshots root: own t566/test-runs/instances/bf-slot-3/run-mveaglx4-22f23baf.
Only closed structural findings are recorded; no row/model/page text reproduced.

- 0002 project.read_task: one instruction source. 0006 plan's one part quote
  EXACTLY equals that instruction text and contains both conditional outcomes.
  Its lastingActs is [send_or_publish], and the sole builder covers that part.
  This is scope, not new permission. Actual live-llm permittedConsequences=[].
- 0009/0011/0013/0015/0017 actual core.run_node calls: navigation, click, search
  type, listing click, chat-dismiss click; all declarations empty; all succeeded.
  Search type is the search query, not the offer amount. No executed send control
  and no executed offer-amount type appear. No trial ran.
- 0013,0015,0017 actual readable pages carry current and former currency prices.
  Last observation has exactly two currency tokens: current ABOVE instruction
  threshold, then former price; current is first. It also has the condition label.
  Thus the false send condition was observable before any Flow submission; this
  is not inferred from the final chat or only from the expected fixture answer.
- 0021 first submit_subflow: ok=false, revision0, subflow.scope_refused with
  subflow.when_refused at flow.line.41. A builder may not write routing situations
  as subflow-local when lines; the supervisor structure plan owns situations.
- 0023 second submission: ok=false, revision1,
  flow_bootstrap.completion_refused; repeat_most_misplaced at43/50 and repeat_invalid
  at34. This is another malformed branch encoding, not a permission refusal.
- 0025 final submission:42lines; no when/on/repeat/if/unless/stop guard tokens;
  threshold only on line1 title. Extract node precedes click/type/click nodes;
  final click declares send_or_publish at41. Result is AbortError, code=null.
  The final declared send is executable straight-line work, not a dormant branch.
- 0008 finalized dispatch return (which includes its nested builder execution):
  one return blocked, ending reason names missing send_or_publish permission;
  lastingActsInPlace0, trials0. Final live-llm build has no durable permissionRequest
  object, so a request id/decline/timeout is not reconstructed as known.

No send was dispatched in the complete actual tool transcript and no lasting
act/trial was recorded. There is no separately persisted terminal account oracle
snapshot: noFlow meant oracle/judge/replay never ran. Accordingly this diagnosis
does not claim an independently evaluated account-state oracle pass.

## Minimal source trace

Downstream source:
- apps/scenario-lab/src/scenarios/local-classifieds/live-tasks.ts:18/52 defines
  conditional instruction and selects extraction oracle; no permissionPoint.
- apps/scenario-lab/src/scenarios/local-classifieds/breadth/price-check.ts:16-39
  documents the above-threshold condition and an honest read-only path; expected
  positive row plus unchanged account remain intact.
- domain/src/runtime/llm-evidence/plan-resolution/step-permission.ts:120-141 puts
  a declared committing plan step to Core. resolve-plan-node.ts:455-468 returns
  needs_permission for a refusal; resolving a submitted node executes no press.

Paired Core source:
- runtime/flow-bootstrap/subflow-candidate/scoped-submission.ts:243-247 refuses
  builder-owned situation routing. The first receipt follows that exact rule.
- runtime/service/project-build/brief-ports.ts:233-237 narrows granted classes by
  part classes. Empty project grant stays empty even though the part permits a
  send class within its scope. Line294 passes permissions.planStep to submission.
- runtime/llm/harness-options/plan-parameter-resolution.ts:245-260 resolves EVERY
  proposed subflow node with its permissionFor check and returns needs_permission;
  it does not infer a false runtime condition from a title or earlier observed price.
- runtime/flow-bootstrap/action-permissions.ts:290-305 applies existing person
  ask policy;401-408 planStep aborts when not permitted. This explains0025 AbortError.
- runtime/service/project-build/brief-ports.ts:460-467 maps that stopped gate into
  the concrete missing-permission builder ending reported by finalized dispatch.

Paths above are relative to packages/fluxiq/src/programs/automation-studio/ except
where explicitly downstream. No source or test edits and no tests/build/browser/
provider/paid invocation were made for this read-only diagnosis.

## Least next step and limits

No source-fix map is justified by this evidence. Preserve the send safety gate.
The model must author a valid conditional structure or the observed no-send path,
not replace a failed guard encoding with straight-line send steps. If root chooses
a generic recovery change, it needs its own bounded design proving that removal
of an unrequested plan act is recoverable without permitting/performing it; this
is not authorization or a proved fix requirement from this diagnosis.

Existing owner seams, if a future separate policy brief warrants tests:
Core flow-bootstrap/subflow-candidate/tests/scoped-submission.test.ts;
runtime/service/project-build/tests/project-build-permissions.test.ts;
runtime/flow-bootstrap/tests/action-permissions.test.ts;
runtime/llm/harness-options/tests/plan-step-consequences.test.ts.
No changed-source rerun or paid retry is authorized by this report.

Root owns the prior price report, required debug, shared plans and integration;
those files were not edited. Accepted t719 feedback source/report remain frozen.