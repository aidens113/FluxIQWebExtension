# t140 — A refused amendment tells the model why, and the row records it

## Outcome

Done. A refused amendment now reaches the model as evidence before it is asked
again, and the amend row carries the refusals. Type check clean, the whole
`runtime/llm` suite green (503 tests, 47 files, including 11 new), and the
structure audit shows the same four violations across the same two rules that
were red before I started — no new finding.

## What changed and why

`applyAutomationStudioFlowDraftAmendments` returns `{ applied, refused }`, and
the loop read only `applied`. Every reason it computed — `no_such_step`,
`already_so`, `no_such_position`, `run_by_the_loop`, `no_step_before_it`,
`not_a_kept_step` — was thrown away, so a model whose edit did not take was
asked again with nothing to correct and the record kept one word,
`llm_evidence_loop.draft_unchanged`, for all of it.

**New: `packages/fluxiq/src/programs/automation-studio/runtime/llm/draft-amendment-feedback.ts`**
(120 lines). Exports the entry's tool id,
`AUTOMATION_STUDIO_LLM_EVIDENCE_AMENDMENT_FEEDBACK_TOOL_ID = "core.amendment_check"`
— beside `core.completion_check` and `core.decision_check` — and
`automationStudioLlmEvidenceDraftAmendmentFeedback`, which builds the bounded
JSON the model is shown:

- `refused`: each refused amendment as the step number the model wrote plus the
  closed-vocabulary reason, capped at 16 (the most amendments one decision may
  carry, so nothing is dropped in practice; the cap makes the entry's size this
  module's property rather than the caller's).
- `applied`: how many of the same decision's amendments did land, so a partial
  edit is legible.
- `steps`: how many steps the draft now has.
- `positions`: present only when some refusal is `no_such_step` — the positions
  read off the draft itself, ascending, the highest 32 when there are more.
  Read off the steps rather than assumed as `1..n`, so it stays true if the
  draft ever stops being contiguous.
- `reasons`: one sentence per distinct reason met, from an exhaustive
  `Record<AutomationStudioFlowDraftAmendmentRefusal["reason"], string>` — a
  reason added to the draft's set fails to compile until it is explained here.
- `stepsWithoutProgress` / `maxStepsWithoutProgress` and an `instruction`, the
  same shape the decision and tool-failure feedback take.

Nothing in it is a value from a page: codes, Core's own sentences, integers.
It does not guess which step a refusal meant, so no removal is implied that the
model did not decide.

**`llm/evidence-loop.ts`** (+33 lines, 908 → 941):

- imports the type `AutomationStudioFlowDraftAmendmentRefusal` and the new
  module;
- one optional field on `AutomationStudioLlmEvidenceLoopTrace`,
  `amendmentsRefused?: readonly AutomationStudioFlowDraftAmendmentRefusal[]`,
  documented in the voice of its neighbours and naming `run-muhubegx-9469de5e`,
  set on the amend row beside `amended`;
- in the `amend_draft` branch, when anything was refused: build the feedback,
  `reserveEvidence` it, and push it under the new tool id — exactly as the
  refused completion check does, including ending the loop as
  `llm_evidence_loop.evidence_limit` when the reserve is exhausted.

Two placement decisions worth stating. The row is recorded **before** the
feedback is reserved, so an exhausted reserve still leaves the record saying
what the decision was and why it changed nothing. The push sits **after** the
no-progress guard, which is untouched: the guard's arithmetic is unchanged, and
putting the push after it means the `stepsWithoutProgress` the model is shown is
the count it is actually being held to, rather than the stale one.

The feedback is pushed whenever `refused` is non-empty, including when some
amendments landed and when a `rerun` is about to run — a half-landed edit is
still one the model has to be told about.

**`llm/index.ts`**: the two new symbols re-exported from the barrel.
`AutomationStudioFlowDraftAmendmentRefusal` was already public through
`runtime/index.ts`'s `export * from "./flow-draft/index.ts"`, so the new trace
field is nameable downstream without another re-export.

**New: `llm/tests/draft-amendment-feedback.test.ts`** (11 tests). Five drive the
real loop end to end: a refusal reaching the next decision's evidence with step,
reason, `steps`, `positions` and the count; the row carrying `amendmentsRefused`
beside `amended: 1` when one of two amendments landed; `already_so` recorded
without positions; a clean edit leaving no entry and no field; and the exhausted
reserve ending the loop as `llm_evidence_loop.evidence_limit` with the amend row
still in the trace. Six cover the builder: every member of the reason union
expressible (exhaustive `Record`, so a new member breaks compilation here too),
one sentence per distinct reason, positions only for `no_such_step`, the newest
32 of a 40-step draft, the 16-refusal cap, and the whole entry under 2 KiB.

## Commands run and observed results

From `F:\!FluxIQ\packages\fluxiq`:

- `npx tsc --noEmit` → exit 0, no output. Run twice: after the source change and
  again after the test file.
- `npx vitest run src/programs/automation-studio/runtime/llm/tests/draft-amendment-feedback.test.ts`
  → `1 passed (1)` file, `11 passed (11)` tests.
- `npx vitest run src/programs/automation-studio/runtime/llm`
  → `Test Files 47 passed (47)`, `Tests 503 passed (503)`.
- `npx vitest run src/programs/automation-studio/runtime/flow-draft src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/runtime/service/flow-bootstrap-commands`
  (not in the brief; run because the trace row's shape changed and these read
  amend rows) → `Test Files 1 failed | 27 passed (28)`, `Tests 1 failed | 349
  passed (350)`. The one failure is **pre-existing and unrelated**: see below.

From `F:\!FluxIQ`:

- `node scripts/structure-audit.mjs`, before starting and after finishing. Both
  runs: `4 violation(s) across 2 rule(s)`, and both print
  `1 baseline entries can be lowered` (I did not run `pnpm structure:baseline`).
  The four, all red before I started:
  - `FAIL [failure-as-empty] .../runtime/llm/deepseek/provider.ts` line 248.
  - `FAIL [file-lines] .../runtime/flow-bootstrap/generation-failure.ts: 817`.
  - `FAIL [file-lines] .../runtime/llm/deepseek/provider.ts: 811`.
  - `FAIL [file-lines] .../runtime/llm/evidence-loop.ts` — **908 before, 941
    after**. Already over the 800-line limit with no baseline entry, as the
    brief said; my 33 lines make an existing violation larger without creating a
    new one.
  - Warnings only, not ratcheted: `directory-files` for `runtime/llm/` moved to
    21 files and `runtime/llm/tests/` to 24, both already past the 15-file
    advisory threshold before this task.

### The pre-existing failure, in full

`src/programs/automation-studio/runtime/flow-draft/tests/entry.test.ts` →
"the draft entry a decision is shown > drops arguments before it drops steps,
oldest first, and counts what it could not list" fails with
`Cannot read properties of undefined (reading 'steps')` at line 46:
`automationStudioFlowDraftEntry` returned `undefined` where the test expects an
entry. It cannot be mine — that test imports only `../entry.ts` and `../step.ts`,
neither of which I touched, and `git status` shows no modification under
`flow-draft/`, so it fails against committed `dev`. I did not investigate it
further; it is outside this brief's files.

## Not verified

- **No live run.** Nothing here was exercised against a real provider, so
  whether the model acts on the feedback is unmeasured. The mechanism is proven
  only to the extent that the entry is in front of the next decision.
- **The published record does not carry the new field yet.**
  `runtime/flow-bootstrap/evidence-loop-steps.ts` copies a fixed field list
  (`EVIDENCE_STEP_FIELDS = ["toolId", "iteration", "callId", "effectApplied",
  "resultCode", "resultReason", "nodeId", "evidenceBytes", "amended", "at",
  "usage"]`) and `service/flow-bootstrap-commands/evidence-trace.ts` re-parses
  the same shape. Both drop `amendmentsRefused`, so it lives on the loop's trace
  row in memory and will **not** appear in a run's stored record until those two
  are extended. Both are outside my owned files; this needs a follow-up task,
  and until it lands the row's evidence is only visible to an in-process reader.
- `pnpm check`, `pnpm test` and `pnpm build` were not run (Core build forbidden
  by the brief); only the checks named above.
- I did not read the `run-muhubegx-9469de5e` evidence myself, so the doc
  comments repeat the brief's counts (nine amend decisions, seven applying
  nothing, five consecutive) rather than figures I measured. Which reasons that
  run actually met is unknown to me.

## Open questions or contradictions found

1. **A `rerun` that cannot run is still silent.** The loop filters `rerun`
   amendments out of the apply call (`decision.amendments.filter((amendment) =>
   amendment.change !== "rerun")`) and asks `rerunRequest` for the first runnable
   one. When `rerunRequest` finds none — no step at that position, or the step's
   tool is not in the offered set — the amendment is dropped with no refusal
   produced anywhere, so nothing reaches the row or the model and the row reads
   `draft_unchanged`. `run_by_the_loop` therefore never occurs on the loop path
   at all; only a direct caller of
   `applyAutomationStudioFlowDraftAmendments` sees it. Fixing that means the
   loop synthesising a refusal for a `rerun` it could not carry out, which is
   beyond "carry `amended.refused` instead of discarding it", so I left it. If
   the live run's seven silent amendments included reruns, this gap is the other
   half of the same defect.
2. **Another worker is editing Core concurrently.** `git status` in `F:\!FluxIQ`
   was clean when I started and now also shows
   `M packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/parameter-screen.ts`,
   which is not mine. My `tsc` and `vitest` runs therefore included that
   in-flight change; they passed, but the supervisor should know the tree was not
   mine alone when I measured it.
3. **`no_such_step` may mean something subtler than the number being out of
   range.** Draft positions are contiguous `1..n` over *all* steps, but the draft
   entry the model reads lists only action steps
   (`automationStudioFlowDraftStepIsAction`), so the numbers it sees are a sparse
   subset of the numbers that exist. An amendment naming an unlisted observation
   step is *applied* rather than refused. `positions` now tells the model which
   numbers exist, which is the honest answer to the refusal, but it does not tell
   it which of those it was shown — worth watching if `no_such_step` keeps
   recurring live.
