# t358 — Integrated Core progress instrumentation review

## Verdict

**GO after t360 re-review.** The original review was NO-GO on three findings. All three
are now corrected in the settled source and covered by focused tests. The contract remains
content-free, dependency direction remains sound, answerability crosses the service
callback, and the stored/public projections remain bounded and backward-compatible.

## t360 correction re-review

- **Model-visible action semantics — resolved.** `evidence-loop.ts:246-252` now uses
  `automationStudioFlowDraftStepIsAction` for revision changes. A failed or refused action
  listed in the next model-visible draft therefore advances the revision even though it is
  not proposable. `draft: false` still leaves revisions at zero. The former contradictory
  assertion in `evidence-loop-tool-failure.test.ts:29-46` now pins `0 -> 1`, `changed`,
  while continuing to prove the failed action is the draft line shown next.
- **Iteration-zero page state — resolved.** `evidence-loop.ts:424-459` now captures
  `stateBefore` and `stateAfter` around the initial observation, passes `stateBefore` to
  the existing failure path, derives page state from the pair, and records it through the
  same closed enum as later tool rows. `evidence-loop-progress.test.ts:112-131` covers
  equal, different, and one-missing digest pairs.
- **Distinct target ids — resolved.** `evidence-loop-steps.ts:363-377` now rejects a
  `targetedStepIds` array whose `Set` size differs from its length. The strict parser test
  includes duplicate ids among the rejected malformed cases.
- **No new privacy or dependency regression found.** The revision fix reads only the
  existing structural action predicate; digest values remain local and only their closed
  comparison state is projected; duplicate checking only compares already bounded stable
  ids. The coordinator still imports through the existing Flow-draft barrel, generic LLM
  code does not import Flow-Bootstrap answerability, and none of these corrections adds a
  prompt, page value, selector, tool input, state digest, feedback, or provider output to
  stored/public evidence.

No tests were run by this re-review, as required by the follow-up brief. The updated
focused assertions were inspected only; supervisor/t359 execution evidence remains the
validation authority.

## Defects

### 1. Failed/refused action appends are reported as no draft change

- Source: `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts:245-252`.
- `draftRecord` appends every returned step to `draftSteps`, but reports a revision change
  only when `automationStudioFlowDraftStepIsProposable(appended)` is true.
- The actual model-visible draft uses `automationStudioFlowDraftStepIsAction`, not the
  proposability predicate: it deliberately lists failed/refused actions with
  `inResult: false` so the next decision can inspect or amend them
  (`runtime/flow-draft/entry.ts:86-92`, `runtime/flow-draft/step.ts:177-201`).
- Consequently, the row can say `draftState: "unchanged"` and `0 -> 0` even though the
  next provider decision receives a new draft line. This violates t350's explicit rule
  to use the same inclusion rule as the actual draft and not `effectApplied` as a proxy.
- The mismatch is visible in
  `runtime/llm/tests/evidence-loop-tool-failure.test.ts:29-46`: the test expects an
  unchanged revision while also proving the failed action appears in the draft shown on
  the next decision.

Precise fix: import/use `automationStudioFlowDraftStepIsAction` and have `draftRecord`
return `drafting && automationStudioFlowDraftStepIsAction(appended)`. Update the failed
action assertion to expect `0 -> 1`, and add a focused refused-action case so an action
listed with `inResult: false` is still one structural revision. Keep `draft: false` at
revision zero.

### 2. The iteration-zero tool row bypasses the available page-state hook

- Source: `runtime/llm/evidence-loop.ts:417-451`.
- Ordinary tool calls bracket execution with `captureStateDigest` and derive
  `changed`/`unchanged`/`unobserved` (`:684-729`). The initial observation calls
  `executeTool` directly without either digest and records no `pageState` transition.
- Therefore an iteration-zero `tool_call` is always published as `unobserved`, even when
  the caller supplied a working digest hook. This leaves the first real page transition
  unmeasured and violates the stated “for a tool row” page-state semantics.

Precise fix: bracket the initial execution with `digest(callId, initialTool.toolId)` in the
same try block used for normal tool rows, pass the captured `stateBefore` into
`toolFailed`, and pass the derived page state into `recordRow` on success. Add focused
initial-observation tests for equal, different, and one-missing digest pairs. Preserve
the existing rule that a digest exception makes the tool attempt a recorded failure.

### 3. The strict stored-step parser does not enforce distinct target identities

- Source: `runtime/flow-bootstrap/evidence-loop-steps.ts:363-377`.
- The loop correctly de-duplicates amendment target ids in request order, but the parser
  accepts a claimed Core step containing duplicate `targetedStepIds`.
- This does not expose content, but it weakens the stable-identity invariant that the
  strict parser is meant to attest.

Precise fix: require `new Set(value.targetedStepIds).size ===
value.targetedStepIds.length` in `evidenceStepDraftChange` and cover duplicate rejection
in the parser/projection tests. This is lower severity than defects 1 and 2, but belongs
in the same correction.

## Confirmed properties

- Dependency direction remains valid: Flow Bootstrap computes an owned structural
  snapshot; the generic evidence loop only carries its closed equivalent. No generic LLM
  module imports the Flow-Bootstrap answerability implementation.
- Revision zero and seeded-id continuation are coherent. New `dN` allocation begins
  after the largest seeded Core `dN`; reorder/drop/rerun retain existing ids and rerun
  replacement receives a fresh id.
- Applied edits and accepted rerun withdrawal increment once per amendment row; the
  replacement tool row increments separately when it adds a visible action.
- Completion snapshots cross the service boundary via `return verdict.check`; first,
  repeated, changed, and unobserved states are derived without prompts or feedback.
- Answerability contains only three booleans and one closed issue literal. Progress,
  draft-change, and draft measurements contain only bounded numbers, ids, and enums; no
  state digest, page value, selector, input, script, prompt, or provider output is
  projected.
- New stored/public members are optional, so old records remain readable. Sanitization
  drops malformed optional members; the public claimed-Core parser rejects malformed or
  extra nested fields. Revision/count ceilings cover the loop's configured call/row
  maxima.
- Provider prompts, completion acceptance, budgets, retry limits, and accounting folding
  are not changed by the reviewed instrumentation path.

## Unverified

- No tests, type checks, builds, provider calls, live runs, or raw artifacts were run or
  inspected because the brief prohibited validation while parallel edits were active.
- This review did not inspect the downstream snapshot/parser implementation; downstream
  parity is outside this Core-only brief.
- Repository-wide structure, type, test, and build closure remains for the supervisor
  after the two source defects and their focused tests are corrected.

## Files reviewed

- MVP Current State and t350 contract design
- Core `AGENTS.md`
- loop progress/answerability/draft-change/trace contracts and barrel
- evidence-loop coordinator and completion-check parser
- Flow-Bootstrap answerability source and completion harness
- service completion callback
- stored trace sanitizer and public evidence-step parser/projection
- focused progress, answerability, completion, and projection test changes

This report is the only file written. No source, shared plan, commit, or push was changed.
