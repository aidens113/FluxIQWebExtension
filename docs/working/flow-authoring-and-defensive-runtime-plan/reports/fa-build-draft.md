# fa-build-draft — the build authors by accrual (A1, A3, A4, A5, A6)

Task t077. All code changes are in FluxIQ Core, in the worktree
`F:\fxwork\t077\!FluxIQ` on `task/t077-build-draft`. The downstream repository
has no source change; its worktree was used only to run the Lab.

Paths below are relative to
`F:\fxwork\t077\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`.

---

## Outcome

_(filled in at the end of the run — see Validation)_

---

## What changed and why

### A6 — the draft is never evicted (the direct fix)

`evidenceContextWindow` has moved since the brief was written: it now lives in
`runtime/llm/context-window.ts`, not at `evidence-loop.ts:638-670`. Its rule is
unchanged and is the cause of the `everything-store` failure — it takes the
newest entry **per toolId** first, and every dismissal arrives under
`web.press_control`, so only the last was certain to be visible when the model
wrote the Flow.

Rather than reserve an allocation inside that function (which I do not own), the
loop now builds a draft entry and places it **beside** the window, exactly as it
already places the budget entry:

```
const draftEntry = drafting ? automationStudioFlowDraftEntry({ steps: draftSteps, maxBytes: limits.draftBytes }) : undefined;
const beside = [draftEntry, budgetEntry].filter((entry) => entry !== undefined);
const window = automationStudioLlmEvidenceContextWindow(evidence, limits.maxEvidenceContextBytes - besideBytes, ...maxToolCalls - beside.length);
const shown = [...window, ...beside];
```

The entry is `core.flow_draft`: every changing action the loop took, in order,
with the argument the model gave it, whether it changed anything, its
disposition, and whether it will be in the result. It is bounded (a quarter of
the evidence context, at most 4,000 bytes) and trims arguments before it trims
steps, oldest first, counting anything it could not list. Nothing in it is page
content — every field is Core's bookkeeping or the model's own request — so it
adds nothing the model had not already been shown.

This also means the draft costs the window a little room, which is why it is
bounded and why it renders nothing at all when the loop only observed.

### A1 — the loop keeps the inputs and returns the steps

`AutomationStudioLlmEvidenceLoopResult` now carries `steps` on both branches.
A step is appended at five places: the initial observation, a successful call, a
failed call, a request the loop answered itself, and (for the disposition) an
amendment. Each carries `{position, iteration, callId?, actionId, input, effect,
effectApplied?, resultCode?, stateBefore?, stateAfter?, disposition, settings?}`.

A state-digest hook is exposed as `captureStateDigest` on the loop's input and
is **not wired in `runtime/service.ts`**, which another task owns. It is taken
inside the same attempt as the call it brackets, so a hook that throws makes the
step a recorded failure rather than a step that quietly has no digests.

### A3 — `flow-bootstrap` is wired to `exploration-reduction`

New `runtime/flow-bootstrap/draft-reduction.ts` calls both functions the brief
named. It answers the two gaps the adapter's own header names: the draft
supplies each step's `input` and its two digests through the `stateSource`
callback, and the trace is read by `automationStudioExplorationStepsFromTrace`
as it always meant to be.

Two bases, and the difference is honesty about digests:

- `reduction` — every step has both digests, so `reduceAutomationStudioExploration`
  runs and its receipt says why each dropped step was dropped.
- `accrual` — some step has no digests (the case today, since the hook is not
  wired), so the answer is every step that changed something and was not
  withdrawn, in order. Longer than the minimum and never wrong about what was
  done, which is the property the old path lacked.

### A4 — a sibling assembler that takes the draft

New `runtime/flow-bootstrap/authoring/assemble-draft.ts`. It does **not**
assemble a plan a second way: it writes the draft out in the shape
`assemble.ts` already reads and hands it over, so keys, versions, edges, ports,
the router and every parameter are derived by one piece of code for both paths.
What only the domain knows — which node runs `web.press_control` — is asked for
through a `write` callback; a step the mapping declines becomes the issue
`flow_draft.step_not_written` and refuses the plan, because a step that was
performed and is silently missing is the exact failure this work exists to stop.

### A5 — new decision kinds, and the refused script handed back

Two halves.

1. **`amend_draft`** joins `tool_call` and `complete`. One shape, two required
   fields: `{step, change: "drop"|"exploratory"|"keep", settings?}`. It is
   offered only once the draft has a changing step and only while the run's
   allowance lasts (four by default, held to `maxIterations`). An amendment that
   changed nothing counts toward the no-progress guard, which is what stops a
   model editing one step forever.
2. **The refused script is handed back.** `bootstrap-completion.ts` now carries
   the script the model just sent into the refusal feedback as `previous`, with
   an instruction to send it again with only the listed issues corrected. Every
   decision is a fresh request with no conversation history, so before this the
   model was asked to try again with its own previous answer absent from the
   question — which is how a live build "completed again with those steps
   deleted and the wrong answer in their place".

### Structural work the budget forced

`evidence-loop.ts` was at 796 lines against a hard 800-line limit, so the
decision grammar moved into a new sibling, `runtime/llm/evidence-loop-decision.ts`:
the schema a decision may take, the parsers for a decision, a tool result and a
completion check, the tool-table validator and the decision instruction. One
module says what a decision may be; the loop says what to do about each. Both
`buildAutomationStudioLlmEvidenceLoopDecisionSchema` and
`AUTOMATION_STUDIO_LLM_EVIDENCE_DECISION_INSTRUCTION` are re-exported from
`evidence-loop.ts`, so no consumer changed.

---

## Files

New:

- `runtime/flow-draft/{step,draft,amendment,entry,index}.ts`
- `runtime/flow-draft/tests/{step-entry,amendment,accrual}.test.ts`
- `runtime/flow-bootstrap/draft-reduction.ts` + `tests/draft-reduction.test.ts`
- `runtime/flow-bootstrap/authoring/assemble-draft.ts` + `tests/assemble-draft.test.ts`
- `runtime/llm/evidence-loop-decision.ts`

Changed:

- `runtime/llm/evidence-loop.ts` — accrual, the pinned entry, `amend_draft`,
  `captureStateDigest`, `steps` on the result.
- `runtime/llm/harness-options/bootstrap-completion.ts` — `previous` in the
  refusal feedback.
- `runtime/flow-bootstrap/{index,decision-step-ids}.ts`,
  `runtime/flow-bootstrap/authoring/{accept,contracts,index}.ts`,
  `runtime/index.ts` — barrels, the `amend_draft` step id, `refusedScript`.
- `runtime/llm/harness/{provider-result,structured-response}.ts` — **outside the
  brief's owned list**, and unavoidable: the harness validator rejects an
  unknown decision kind before it reaches the loop, so without these two small
  edits `amend_draft` would be dead code. Flagged for the supervisor.
- Three existing tests updated where the contract deliberately changed.

---

## Commands run and observed results

_(filled in at the end of the run — see Validation)_

---

## Not verified

_(filled in at the end of the run)_

---

## Open questions or contradictions found

_(filled in at the end of the run)_
