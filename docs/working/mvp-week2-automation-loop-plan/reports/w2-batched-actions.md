# w2: batched actions per model turn (t021)

Worker report. Core worktree `F:\fxwork\t021\!FluxIQ` (branch `task/t021-batch`, base `a0f9985`). Downstream worktree `F:\fxwork\t021\!FluxIQWebExtension`: I made no downstream edits. Nothing is committed. I shortened the scope when the coordinator warned that quota was nearly used up.

## Outcome

**Partial.** Core now lets one model turn carry an ordered list of actions. The list stops at the first failure and after any action that may have changed what the target handles refer to. The whole turn comes back as one evidence packet, inside the existing budget. The model is told it may batch, and real DeepSeek replies used a batch 4 times. Every batch stopped where it should have.

The live form task did not get faster, and it produced no Flow either before or after. On this base, no exploration tool can type into a field. The opener for the "New post" form is also refused by the reveal rule that t011 replaces. Batching cannot fix either problem, so there was nothing on this task for it to save.

## Which path the user saw, and its call count

No exploration path fills form fields on this base. Creation exploration (`web.inspect_current_page`, `web.navigate_same_origin`, `web.reveal_safe`, `web.detect_repeating_structure`) cannot enter text, and neither can the repair options. What the user saw as one call per field is one action per paid call spent circling a form.

Baseline for `social-scheduler-schedule-post`: **15 provider calls, 6 actions, 274 s, no Flow** (`evidence_repeat_without_progress`, run `run-mu7f4gft-df61f4eb`). Of those 15 calls, 7 produced an unusable decision and 2 were answered repeats.

The loop's default of 8 tool calls was not the choke. No production caller uses it: creation used `iterations + 1` (27 on a 26-call grant), and repair has its own ledger. Creation's `iterations + 1` would become a new choke once a turn can carry up to 16 actions. It is now `min(iterations × 16 + 1, 64)`: derived from the call budget and the list ceiling, held under Core's existing 64-action ceiling.

## The contract

- **Decision shape.** New form: `{kind:"tool_calls", calls:[{toolId, input}, ...]}`. The existing `{kind:"tool_call", callId, toolId, input}` is unchanged, and a list of one runs as a lone call.
- **Forgiving reading.** Also accepted: the list under `actions`; `kind:"tool_call"` with a list; a missing `input` (treated as empty); a missing call id (the loop assigns one). A key it does not recognise is refused.
- **List ceiling.** At most `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_MAX_ACTIONS_PER_DECISION` = 16 actions per turn. Anything past that is reported as not run, not refused.
- **Unknown tools.** A tool that was not offered, anywhere in the list, refuses the whole list before any action runs.
- **Same rules as a lone call.** Each action goes through the same execution primitive as a lone call: the same repeat checks against the current state, the same tool-call ceiling, and its own `executeTool` call. It is therefore individually subject to the permission check.
- **Permission seam for t018.** It is marked `PERMISSION SEAM (t018)` in `evidence-batch/stop.ts` and `run.ts`. Today a needed permission ends the run from inside `executeTool`, and the batch returns at once without running the next action (this is tested). No result code is treated as a permission request.

## When a batch stops

`evidence-batch/stop.ts` defines four stops:

- **`action_refused`:** the result has the shape `{ok:false}`. This is the first-failure rule.
- **`effect_not_applied`:** a mutating action reported that its effect did not happen.
- **`targets_may_have_changed`:** a mutating action took effect, and its domain did not send `targetsUnchanged: true` (a new optional field on the tool result).
- **`action_limit` / `batch_limit`:** the run's action ceiling or the 16-action list ceiling was reached.

Stable handles only mean the same thing on one page; after a navigation the web domain numbers controls afresh. Core cannot tell a press on the same page from a navigation, so it stops after any applied mutation unless the domain says the handles still hold.

**Domain follow-up needed.** The web domain does not send `targetsUnchanged` yet, so today every applied mutation ends the batch. A later unit, after t011 merges, should set it on press results where the page address did not change. That work is in `domain/src/runtime/llm-evidence/**`, which another unit owns.

## Evidence stays in budget

Each turn produces one `core.batch_result` entry: every action's outcome in order, the evidence after the last action that ran (under `latest`), and the reason if it stopped early. Earlier values are carried only when they add something: an observation's finding, or the last full state before a refusal. Otherwise they are marked `superseded`. A value that does not fit is marked `size`.

- **Size bound.** Each action's evidence is capped at the window size minus 512 bytes, minus room for the outcome lines. The packet then fits the window a lone result fits: 23,488 of the 24,000 bytes in creation.
- **Charged once.** The packet's bytes are charged once against the evidence byte budget.
- **Measured live.** Packets were 8,279 bytes (a page) and 702 or 704 bytes (a refusal). Input per call ranged from 6,705 to 11,552 tokens, against a 48,000-token request ceiling. The instruction and schema add about 200 tokens per call.
- **Counting.** Provider calls and actions are counted separately: the loop's `iterations` against `toolCalls`, and the build audit's `providerCallCount` (now counted by iteration) against `toolCallCount`. The trace bounds were raised so a longer trace from batches is not refused; see Changed files.

## How the model is told

1. The list variant's `description` in the decision schema (`evidence-batch/schema.ts`). On its own this was **not enough**: run 1 below had 24 decisions and not one was a list.
2. A sentence appended to `AUTOMATION_STUDIO_LLM_EVIDENCE_DECISION_INSTRUCTION` (`evidence-loop.ts`, line 37). Both paths receive it: the creation system prompt and the repair `gather` stage.

With the sentence, real replies batched at iterations 2, 5, 6 and 10: `[navigate, reveal]` twice (stopped after the navigate: `targets_may_have_changed`) and `[reveal, inspect]` twice (stopped after the refused reveal: `action_refused`). A temporary probe captured this (counts and tool ids only). The probe has been removed.

## Before and after, same task (`social-scheduler-schedule-post`)

| | Provider calls | Actions | Wall-clock (campaign) | Result |
| --- | --- | --- | --- | --- |
| Before (`run-mu7f4gft`) | 15 | 6 | 274 s | no Flow, `evidence_repeat_without_progress` |
| After, schema only (`run-mu7g5p89`) | 25 | 13 | 313 s | no Flow, `evidence_unusable_decision`, 0 batches |
| After, instructed (`run-mu7gd9ok`) | 27 | 21 | 338 s | no Flow, `evidence_iteration_limit` (26-call grant), 4 batches |

**No gain, and no correct result either side.** The model wanders differently on each run; each after-run row is a single run. Every batch stopped after its first action, correctly, so none of them saved a call.

Reference form that passes on this base: `instruction-only-form-submit` took 1 call, 1 action and 152 s, and passed (3-node Flow). It has nothing to batch, and I did not rerun it after the change.

A real before/after needs t011 merged (so the opener can be pressed), a field-entry exploration tool, and the domain sending `targetsUnchanged`.

## Validation

- `npx tsc --noEmit -p tsconfig.json` in `packages/fluxiq`: exit 0.
- `npx vitest run` over `runtime/llm`, `runtime/loop-limits`, `runtime/flow-bootstrap`, `runtime/recovery`: 65 files passed.
- New `runtime/llm/tests/evidence-batch.test.ts`: 10 passed. I also updated 4 existing tests that pinned the old decision schema, the 27-call ceiling, or the old trace bound.
- **Mutation 1** (continue past a refused action): the refusal test failed. **Mutation 2** (run on past a navigation): the navigation test failed. Both reverted, and the suite is back to 10 of 10.
- `node scripts/structure-audit.mjs` (Core): `passed (165 warning(s), 361 baselined)`.
- Full `vitest run src/programs/automation-studio`: 13 files failed under load, mostly 15 s timeouts. Rerun alone, all but one passed. The one that still fails, `api/contracts/tests/llm.test.ts` ("lists every runtime-session purpose"), **also fails on the untouched base `a0f9985`**, so it predates this work.

## Changed files (Core only)

- **New:** `runtime/llm/evidence-batch/{decision,schema,stop,packet,run,index}.ts`, `runtime/llm/evidence-window.ts` (the unchanged window function, moved so `evidence-loop.ts` stays under 800 lines; it is now 751), `runtime/llm/tests/evidence-batch.test.ts`.
- **`evidence-loop.ts`, for the t018 merge:**
  - imports (about line 10)
  - line 37 (the instruction constant)
  - the decision, trace and tool-result types (about lines 82, 97 and 106)
  - `answerRequest`'s `findIndex` (line 376)
  - new closures before the `for` loop (lines 382–427)
  - the window call (line 440)
  - the dispatch after `unusableInARow = 0` (lines 487–516)
  - the lone-call execution now going through `executeCall`/`recordRan` (lines 540–546)
  - `parseToolExecutionResult`, the schema builder and `parseDecision`
  - the window function removed.
- **Harness:** `harness/provider-result.ts`, `structured-response.ts`, `output-validation.ts`.
- **Barrel and limits:** `llm/index.ts` (exports the batch module); `loop-limits/evidence-loop.ts` (the new constant); `loop-limits/flow-bootstrap-evidence-loop.ts` (the ceiling).
- **Trace bounds:** `service.ts` (2 lines, count unchanged at 6,405); `flow-bootstrap/generation-failure.ts` (trace bound).
- Tests as listed above.

## Not verified

- Any drop in calls or time on a correct result. That was not reachable on this base, for the reasons above.
- The repair exploration path live. It runs the same loop; only unit tests cover it.
- The domain side of `targetsUnchanged`.
- Downstream checks: I changed nothing downstream. The Lab built and ran against this Core three times.
- **Open issue for t018:** the permission gate records every execution as something the model was shown. A batch shows the model only the latest state and kept values, so the gate may quote a control name from an intermediate capture the model never saw.
