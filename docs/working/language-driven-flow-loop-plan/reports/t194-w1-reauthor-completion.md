# t194-w1: why the refuted-answer re-author cannot complete, and the fix

Worker report. Brief: t194-w1. Trees: Core `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`,
downstream `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension` (task/t194-live-judge-answer).
Evidence: `run-munnhi5q-4867dabe`, `decision-trace.json` `flows[0].runs[0].recovery.resultReauthor.attempts[0]`,
`flow-lane.json`. Core paths below are relative to `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done for cause 1: fixed in Core with a test that fails without the fix. Cause 2 was already fixed by t174 in this
tree. It turned out to be the same `maxSummaryLength` limit on the same `fromDraft` path; the run predates that
change. Question 3 is answered. No downstream file was changed.

## Answers

### 1. `web.step.consequences_undeclared`

**Where it is raised.** It is not raised in Core; it comes from the web domain.
`domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts:328-329` (downstream) refuses when
`webPlanStepPermission(...)` returns `undeclared`. `step-permission.ts:128` returns `undeclared` exactly when
`input.declared === undefined` and `webPlanStepMustDeclare(nodeDefinitionId)` is true, which covers the committing
nodes `web.dom.click`, `web.dom.keypress` and `web.dom.dialog` (`step-permission.ts:79`). The check is skipped when
`gatedByCaller` is set (`resolve-plan-node.ts:316`), but only the domain's own node-run paths set that; Core never
sends it.

**Where Core decides the declaration is absent.** `llm/harness-options/plan-parameter-resolution.ts` reads the
declaration off the plan node (`automationStudioPlanStepConsequences`, `plan-step-consequences.ts:71-80`). It
forwards `declaredConsequences` only when the node carries a `consequences` field (`plan-parameter-resolution.ts`,
the resolver call). A draft-built plan node carries one only if its draft step's `input.consequences` is an array
(`llm/node-tools/draft-step.ts:57-66`).

**Why a re-author trips it every time.** The re-author seeds its draft from the Flow
(`service/flow-bootstrap-commands/extend-subject.ts:46` → `llm/node-tools/draft-from-flow.ts:85-115`). The seed
writes `input: { node, parameters }` and **deliberately no declaration**
(`draft-from-flow.ts:28-31`: "Core does not get to make the second one on the model's behalf"). Flow nodes do not
persist the declaration they were built with either: it is taken off the plan before the registry sees it, and the
adaptation keeps only `AutomationStudioActionDeclarationRecord`s keyed by ref. So every inherited press reaches the
domain with `declaredConsequences === undefined` and is refused. This Flow has three presses
(`flow-lane.json` `flowShape.actionTypes["web.dom.click"] = 3`: Accept, Go, Continue shopping), so every
completion carried that refusal. In the trace, iterations 5-7 and 10-13 show it as the first code. Iterations
9 and 14-16 led with the profile-limit code, but the press refusal was still present, because every check runs.

**What the refusal tells the model.** It is told codes `web.step.consequences_undeclared` and
`web.step.expected.consequences_classes_or_none` at `plan.subflows.0.nodes.<i>.parameters`, which is a plan node
index rather than the draft step position the model edits. It is also told `DRAFT_SCRIPT_NOTE`
(`bootstrap-completion.ts:381`): "Correct it with amend_draft decisions -- drop, exploratory, reorder, rerun".

**Could the model have satisfied it?** Not in any realistic way:
- `rerun` of the press would append a new, declaring step, but it re-presses Accept/Go/Continue shopping on
  whatever page is now showing, out of order. The one rerun it did try (of f9, the extract) was refused
  `target_unobserved`.
- An undocumented route exists: amend the seeded step with `settings: { consequences: "none" }`. Settings are
  written as entries (`draft-step.ts:55`), and the assembler reads `consequences` as its reserved word. Nothing
  tells the model this, and the amendment schema describes settings only as "Settings to carry on the step".
- `drop` removes a step the Flow needs.

So the build could not get a read-only Flow past a gate on steps it never wrote.

### 2. `bootstrap.completion_profile_limit_exceeded`

**Which limit: `maxSummaryLength` (240), on the draft path.** The limit t174 bounds. It applies to the summary
checked at `bootstrap-completion.ts:245` (`automationStudioEvidenceFlowBootstrapLimitsExceeded`,
`flow-bootstrap/plan/profile-limits.ts:68`).

How it was identified, since the bundle does not record `limitsExceeded`:
- The draft is byte-identical from iteration 9 to 16: `draft.bytes = 3976`, `steps = 15`, `withoutInput = 4`
  on every row. Only iterations 9, 14, 15 and 16 hit the limit; 10-13 did not.
- `fromDraft` reads nothing from the reply except `summary` (`bootstrap-completion.ts:352-375`). So the only input
  that varied between these completions was the model's summary. It was sometimes over 240 characters and
  sometimes not.
- No other limit can vary with an unchanged draft. The router, Subflow and rule names are bounded at assembly
  (`flow-bootstrap/authoring/assemble.ts:137,152,162`, `bounded()` at 485). `maxPlanBytes` is at least 65,536.
  `maxNodesPerSubflow` defaults to 100. `maxParametersPerNode` (16) depends on the draft, which did not change.
- The run started at 22:23:38 (first trace `at` = 1790745818213). The t174 source edit is dated 22:37:23 and this
  tree's `dist` was rebuilt at 22:40:28, so the run had no summary bound.

In this tree `fromDraft` now slices the summary to 240 (`bootstrap-completion.ts:360`, t174, unchanged by me).
My re-author test completes with a 376-character summary, which also covers this path.

### 3. Decisions, and the brief

**How many decisions the re-author gets.** It has no budget of its own. `refuted-result-port.ts:76-80` calls the
ordinary build (`mode: "extend"`, `evidenceGuided: true`) through `service.ts:1539`, which gives
`maxIterations = min(provider maxCallsPerRun, 64)` (`loop-limits/flow-bootstrap-evidence-loop.ts:117`; ceiling 64
at `loop-limits/evidence-loop.ts:28`). It did not run out.

**What stopped it** was the unusable-in-a-row guard: `maxConsecutiveUnusableDecisions = min(8, maxIterations)`
(`flow-bootstrap-evidence-loop.ts:147`; `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_DEFAULT_MAX_STEPS_WITHOUT_PROGRESS = 8`
at `loop-limits/evidence-loop.ts:85`). It is enforced at `llm/evidence-loop.ts:342-349`. Iterations 9-16 were eight
consecutive refused completions, which ended the build as `flow_bootstrap.evidence_unusable_decision` at
`provider_output_validation`.

**Whether the brief carries the judge's directive.** Yes. `recovery/refuted-result/brief.ts:92-101` writes
Core's verdict, what was stored, each `directive.fix` line, and the judgement's `expected`, `observed` and
`advice` verbatim ("The check's advice: ..."). The run's brief record agrees: `advised: true`, `fixLines: 1`,
3,514 chars, finding codes `result.counts_look_right` and `result.summary_withheld`. The brief text itself is never
stored, so I could not read the exact wording this build received.

## What changed and why

The fix is in Core only, inside the owned paths. An inherited step that the build left exactly as it was is not
put to the domain's gate again. Every step the build writes still is.

- `llm/harness-options/inherited-plan-nodes.ts` (new). Exports `automationStudioInheritedPlanNodeRefs`, which lists
  the refs of plan nodes written from a step the seed produced and nothing has changed since. Such a step is at
  iteration 0, goes through `core.run_node`, and has no `callId`, no `ranWith`, no `settings` and no
  `input.consequences` (`inheritedAsItStands`, line 67). The build cannot create a step like that: the loop appends
  every step with a call id and a `d<n>` id (`llm/evidence-loop.ts:250-255`). A rerun appends a new, declaring step
  and drops the old one (`llm/evidence-loop/rerun-replacement.ts:23-24`). Amended settings make the step changed.
- `llm/harness-options/plan-parameter-resolution.ts`. New optional input `inheritedNodeRefs` (line 90). In
  `resolveNode`, a node on that list that declared nothing and names no handle returns as it stands, without asking
  the domain (line 161). A node that declared anything or names a handle takes the normal path. The header comment
  says so.
- `llm/harness-options/bootstrap-completion.ts`. `fromDraft` computes the inherited refs (line 373) and the plan
  resolution receives them (line 260). The t174 summary-bounding lines (356-360) are unchanged.
- `flow-bootstrap/authoring/contracts.ts:68`. `AutomationStudioFlowScriptStep.draftStepId?`, set only when a draft
  is written down.
- `flow-bootstrap/authoring/draft-routing.ts:245`. `scriptStep` stamps the draft step id; joins and loops carry
  none.
- `flow-bootstrap/authoring/assemble-draft.ts:78,123,137-148`. Returns `draftStepIdByNodeKey` for an assembled
  plan. A node counts only when its definition is the node its step named. Routing inserts Merge and For Each
  nodes and shifts the keys, which is why positional matching was not good enough; a test covers it.

**The risk-only rule is kept.** A press the build takes must still declare (`run-node.ts` requires `consequences`),
and one that declares `move_money`, `delete` or `send_or_publish` is still put to the person. A press the build
changed is gated again. The only step not re-asked is one the Flow already runs, carried over untouched. That step
entered the Flow through the build or the person that put it there, and re-asking adds no gate that the Flow's own
runs do not already face.

**Test.** `llm/harness-options/tests/inherited-plan-nodes.test.ts` has 5 tests. They seed a Flow
(navigate → press Accept → extract) through the real `automationStudioFlowDraftSeedFromFlow` and run the real
`checkAutomationStudioFlowBootstrapCompletion`, with a binding that refuses as the web domain does:
1. The inherited press builds, with a 376-character summary, and the domain is asked about nothing.
2. The inherited press is still found after `optional` routing inserts a Merge ahead of it.
3. A press the build took without declaring is still refused, and only that one (`nodes.3`).
4. A build-taken press declaring `move_money` gives `bootstrap.step_permission_required`.
5. An inherited press whose settings were amended is gated again.

## Commands run and observed results

All run in Core `packages/fluxiq` unless noted.

- `npx vitest run --minWorkers=1 --maxWorkers=2 src/.../llm/harness-options/tests/inherited-plan-nodes.test.ts`:
  5 passed.
- The same command with the fix disabled (`bootstrap-completion.ts:260` temporarily set to
  `inheritedNodeRefs: undefined`, then restored from a scratch copy and confirmed with grep): 4 failed, 1 passed.
  Test 1 got the issue codes `[web.step.consequences_undeclared, web.step.expected.consequences_classes_or_none]`
  where it expected `[]`. That is the run's refusal.
- `npx vitest run --minWorkers=1 --maxWorkers=2 <runtime>/llm/harness-options <runtime>/flow-bootstrap <runtime>/llm/node-tools <runtime>/recovery/refuted-result <runtime>/service/runtime-adaptation`:
  54 files, 897 tests passed.
- After the type fix, `npx vitest run ... <runtime>/llm/harness-options <runtime>/flow-bootstrap/authoring`:
  14 files, 171 tests passed.
- Consumer check, `npx vitest run ... <runtime>/tests/service-bootstrap <runtime>/llm/decision-context <runtime>/llm/evidence-loop <runtime>/llm/tests`:
  500 passed, 8 failed. None of the 8 is caused by this change:
  - 6 in `rejections.test.ts` fail on an extra `"thrown.Error"` in the failure diagnostic. That code is produced by
    another lane's uncommitted `flow-bootstrap/generation-failure/thrown-issue-codes.ts:20` (untracked), which is
    outside my ownership and not touched by me.
  - 2 timed out at 15 s under the parallel run: `permission-ask.test.ts` "opens the ask..." and
    `rejections.test.ts` "detects a persisted pending duplicate...". Rerun alone, both pass (6.9 s and 7.7 s).
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w1 tsc" npx tsc --noEmit -p tsconfig.json`:
  - First run: one error, TS2375 in my test (`parameterValues` possibly undefined).
  - After the fix: `[heavy] t194-w1 tsc holds b2`, no diagnostics, exit 0.
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (194 warning(s), 354 baselined)`. That
  matches before my edits. `bootstrap-completion.ts` is now 456 lines, which is advisory only (limit 800).

## Not verified

- No live or Lab run (forbidden by the brief). Whether a re-author now completes live depends on the loop reaching a
  completion without other refusals, such as instructed acts or answerability. Those did not surface in this run
  because the first code shown was always one of the two above.
- Core dist was not rebuilt (forbidden), so a Lab run needs a dist build before it sees this change or t174's.
- I inferred the exact limit from the trace rather than reading it: the bundle does not carry `limitsExceeded`.
- I did not see the exact brief text this build received (it is not stored); only its record.

## Open questions or contradictions found

- **The brief's premise is off.** `web.step.consequences_undeclared` is raised downstream
  (`resolve-plan-node.ts:329`), not in Core. The Core-side cause is that the seed carries no declaration and Flow
  nodes do not persist one. I fixed it on the Core side and needed no downstream edit.
- **A decision for the supervisor.** An inherited, untouched press that sends or publishes is also not re-asked. I
  judged that correct: the Flow already does that act on every run, and it was permitted when it entered the Flow.
  A stricter alternative is to persist each node's declaration at build and have the seed carry it back. That needs
  `llm/node-tools/draft-from-flow.ts`, `service/flow-bootstrap-commands/extend-subject.ts` and the adaptation
  apply path, none of which I own.
- **Follow-ups outside my scope.**
  - `service.ts:1614` maps plan keys to existing node ids by position (`automationStudioFlowDraftPlanNodeIds`), so
    the same Merge insertion shifts it. It could read `draftStepIdByNodeKey` instead.
  - `DRAFT_SCRIPT_NOTE` still does not say how a changed seeded press declares. I left it alone rather than
    advertise the settings route.
- **Seed contract.** The inherited test reads the seed's documented fields (iteration 0, no `callId`, no `ranWith`).
  An explicit origin marker on seeded steps (`flow-draft/step.ts`, `draft-from-flow.ts`) would make that contract
  stronger. Both files are outside my ownership.
