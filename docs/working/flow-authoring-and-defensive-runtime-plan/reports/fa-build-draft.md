# fa-build-draft — the build authors by accrual (A1, A3, A4, A5, A6)

Task t077. Every code change is in FluxIQ Core, in the worktree
`F:\fxwork\t077\!FluxIQ` on `task/t077-build-draft`. The downstream repository
has no source change; its worktree was used only to run the Lab.

Paths below are relative to
`F:\fxwork\t077\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`.

---

## Outcome

Done for A1, A3, A4, A5 and A6 as built and unit-tested. **The live proof is
partial**, and the Validation section says how far it got. Proven live, over
seven Lab runs against the real DeepSeek provider: the draft reaches the model
on every call, the model chooses the new `amend_draft` decision and the loop
applies it, and a look after a refused action now runs where it used to be
withheld. Not proven live: a proposed Flow that contains the dismissals, because
no build on this scenario reached a proposal — every one that got past the
environment was stopped by the model repeating an observation until the
no-progress guard ended it, which is round 1's documented top failure cause and
belongs to another task.

The live runs earned their cost twice over: they found two real defects that no
unit test would have, both in this task's own work, and both are fixed here.

One finding the coordinator sent mid-task — a refused call locking the model out
of looking again — is fixed here too, since it lives in `evidence-loop.ts`.

---

## What changed and why

### A6 — the draft is never evicted (the direct fix)

`evidenceContextWindow` has moved since the brief was written: it is now
`automationStudioLlmEvidenceContextWindow` in `runtime/llm/context-window.ts`,
not `evidence-loop.ts:638-670`. Its rule is unchanged and is the cause of the
`everything-store` failure — it takes the newest entry **per toolId** first, and
every dismissal arrives under `web.press_control`, so only the last was certain
to be visible when the model wrote the Flow.

Rather than reserve an allocation inside that function (which this task does not
own), the loop builds a draft entry and places it **beside** the window, exactly
as it already places the budget entry:

```ts
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
content — every field is Core's own bookkeeping or the model's own request — so
it shows the model nothing its own tools had not already shown it.

It renders nothing at all when the loop only observed, which is what keeps it
out of the way of recovery explorations that never act.

### A1 — the loop keeps the inputs and returns the steps

`AutomationStudioLlmEvidenceLoopResult` now carries `steps` on both branches. A
step is appended at four places — the initial observation, a successful call, a
failed call, and a request the loop answered itself — each carrying
`{position, iteration, callId?, actionId, input, effect, effectApplied?,
resultCode?, stateBefore?, stateAfter?, disposition, settings?}`.

A state-digest hook is exposed as `captureStateDigest` on the loop's input and
is **not wired in `runtime/service.ts`**, which another task owns. It is taken
inside the same attempt as the call it brackets, so a hook that throws makes the
step a recorded failure rather than a step that quietly has no digests.

### A3 — `flow-bootstrap` is wired to `exploration-reduction`

New `runtime/flow-bootstrap/draft-reduction.ts` calls both functions the brief
named, and answers the two gaps the adapter's own header names: the draft
supplies each step's `input` and its two digests through the `stateSource`
callback, and the trace is read by `automationStudioExplorationStepsFromTrace`
as it always meant to be.

Two bases, and the difference is honesty about digests:

- `reduction` — every step has both digests, so `reduceAutomationStudioExploration`
  runs and its receipt says why each dropped step was dropped.
- `accrual` — some step has no digests (the case today, since the hook's call
  site is another task's), so the answer is every step that changed something
  and was not withdrawn, in order. Longer than the minimum, and never wrong
  about what was done, which is the property the old path lacked.

The mapping from an exploration step back to a draft step is checked rather than
trusted: if the two lists do not line up the module falls back to `accrual`
instead of keeping the wrong steps.

### A4 — a sibling assembler that takes the draft

New `runtime/flow-bootstrap/authoring/assemble-draft.ts`. It does **not**
assemble a plan a second way: it writes the draft out in the shape `assemble.ts`
already reads and hands it over, so keys, versions, edges, ports, the router and
every parameter are derived by one piece of code for both paths. What only the
domain knows — which node runs `web.press_control` — is asked for through a
`write` callback; a step the mapping declines becomes the issue
`flow_draft.step_not_written` and refuses the plan, because a step that was
performed and is silently missing from the result is the exact failure this work
exists to stop.

### A5 — new decision kinds, and the refused script handed back

Two halves.

1. **`amend_draft`** joins `tool_call` and `complete`. One shape, two required
   fields: `{step, change: "drop"|"exploratory"|"keep", settings?}` — drop a
   step, mark one exploratory, and amend its settings, all in one variant
   because they are one thought and three variants would cost three calls. It is
   offered only once the draft has a changing step and only while the run's
   allowance lasts (four by default, held to `maxIterations`). An edit is
   progress on the draft and never on the evidence, so one that landed neither
   clears the no-progress guard nor is spent by it, and one that changed nothing
   counts against it — which is what stops a model editing one step forever, and
   what stops an edit laundering a repeated request. A live run found the first
   version of that rule wrong; see run 6 below.
2. **The refused script is handed back.** `bootstrap-completion.ts` now carries
   the script the model just sent into the refusal feedback as `previous`, on
   **every** refusal path a script can reach — including
   `evidence_completion_parameters_unresolved`, which is where an invented
   handle is caught and so the exact refusal the re-emission failure came from.
   Every decision is a fresh request with no conversation history, so before
   this the model was asked to try again with its own previous answer absent
   from the question, which is how a live build "completed again with those
   steps deleted and the wrong answer in their place".

### The coordinator's finding — a refusal now lets the model look again

Confirmed in source and fixed. The repeat key was
`canonicalJson([mutationEpoch, toolId, input])` and `mutationEpoch` advanced
only on an applied mutation, so a *refused* press left it where it was: the
observation the model needed to recover was withheld as "already observed",
asking for it anyway counted as a step without progress, and three of those
ended the build `repeat_without_progress`.

The fix is a second counter, and the reasoning is in the header of the new
`runtime/llm/repeat-policy.ts`:

- `mutationEpoch` moves when an action **applied**, and keys a repeated
  **action**. Pressing the same control again with nothing having happened is
  still a repeat, and the guard is exactly as strict as it was.
- `attemptEpoch` moves whenever an action **ran at all**, and keys a repeated
  **look** and the eligibility of a protected observation. A refusal is often
  the domain saying the thing it was asked to act on is no longer there, which
  is a statement about the state having moved; and it is new information the
  model can only act on by looking.

`runtime/llm/tests/repeat-policy.test.ts` pins all three halves, including the
one that must not weaken: a run that only repeats itself still ends
`repeat_without_progress`. Run 6 shows it working live — a refused
`web.navigate_same_origin` followed immediately by an inspect that ran.

One consequence to be aware of, since it changes what the campaign will see:
this loosens a guard that was ending builds early. Runs 4 and 5 stopped at ten
and eleven calls; run 6, with the fix in, kept going to the iteration limit at
twenty-seven. That is the intended behaviour — the model was being stopped for
answering a refusal correctly — but it means a build that is genuinely stuck now
costs more before it ends. The amendment fix above closes the largest part of
that, and the cost, token and deadline guards are what bound the rest.

### Structural work the line budget forced

`evidence-loop.ts` was at 796 lines against a hard 800-line limit, so two
cohesive pieces left it rather than comments being shaved off a file at its
budget:

- `runtime/llm/evidence-loop-decision.ts` — the grammar: what shapes a decision
  may take, the parsers for a decision, a tool result and a completion check,
  the tool-table validator, and the decision instruction. One module says what a
  decision may be; the loop says what to do about each.
- `runtime/llm/repeat-policy.ts` — when a request may be made again: the request
  signature and the repeat policy, with the two-counter explanation.

`buildAutomationStudioLlmEvidenceLoopDecisionSchema` and
`AUTOMATION_STUDIO_LLM_EVIDENCE_DECISION_INSTRUCTION` are re-exported from
`evidence-loop.ts`, so no consumer changed. The file is now 776 lines.

---

## Files

New:

- `runtime/flow-draft/{step,draft,amendment,entry,index}.ts`
- `runtime/flow-draft/tests/{entry,amendment,accrual}.test.ts`
- `runtime/flow-bootstrap/draft-reduction.ts` + `tests/draft-reduction.test.ts`
- `runtime/flow-bootstrap/authoring/assemble-draft.ts` + `tests/assemble-draft.test.ts`
- `runtime/llm/evidence-loop-decision.ts`
- `runtime/llm/repeat-policy.ts` + `tests/repeat-policy.test.ts`

Changed:

- `runtime/llm/evidence-loop.ts` — accrual, the pinned entry, `amend_draft`,
  `captureStateDigest`, `steps` on the result, the two epochs.
- `runtime/llm/harness-options/bootstrap-completion.ts` — `previous` on every
  refusal path.
- `runtime/flow-bootstrap/{index,decision-step-ids}.ts`,
  `runtime/flow-bootstrap/authoring/{accept,contracts,index}.ts`,
  `runtime/index.ts` — barrels, the `amend_draft` step id, the accepted script.
- `runtime/llm/harness/{provider-result,structured-response}.ts` and
  `runtime/llm/deepseek-provider.ts` — **outside the brief's owned list**, and
  unavoidable. See Open questions.
- Three existing test files updated where the contract deliberately changed
  (`llm/tests/evidence-loop.test.ts`, `llm/tests/evidence-loop-tool-failure.test.ts`,
  `flow-bootstrap/tests/generation-failure.test.ts`), and two extended with new
  cases (`llm/harness-options/tests/bootstrap-completion.test.ts`,
  `llm/tests/evidence-loop-provider.test.ts`). Each deliberate change carries a
  comment saying which behaviour changed and why.

`runtime/service.ts` was not touched, and neither were `runtime/executor/**`,
`runtime/recovery/**`, `domain/src/**`, `apps/extension/**` or any other
worktree. No commit was made.

---

## Commands run and observed results

### Live, against the real DeepSeek provider from `.env.local`

Six Lab runs of one narrow build, each
`pnpm lab run everything-store --live-llm --llm-task create-flow
--instruction-task everything-store-first-page-plus-earbuds` with the
campaign's own limits. `everything-store` is the scenario the failure came
from, and its consent banner plus the controls a search needs give a build
several presses under one tool id, which is the condition that caused it.

**The worktree cannot run the Lab as configured.** `.env.local` carries
`FLUXIQ_TEST_TARGET=existing` with no `FLUXIQ_TEST_PROJECT_ID`, so `pnpm lab
run` refuses immediately. Every run below therefore used
`FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated
FLUXIQ_LAB_INSTANCE=t077` with `DEEPSEEK_API_KEY` passed through. Worth fixing
for the next worker.

| # | run id | outcome |
| --- | --- | --- |
| 1 | — | refused before starting: `FLUXIQ_TEST_PROJECT_ID is required`. Environment, as above. |
| 2 | `run-mud5frse-d53e6cc5` | `process.startup` — Core's Next.js build died with `uncaughtException [Error: kill EPERM]`. The machine's antivirus, not the code. |
| 3 | `run-mud5kasy-a6a1a28f` | `flow_bootstrap.provider_evidence_loop_context_invalid` — **a real defect this task introduced, found live.** See below. |
| 4 | `run-mud61oap-00e50293` | 10 provider calls, 7 tool calls, **3 applied presses and a navigate**, then `flow_bootstrap.evidence_repeat_without_progress`. |
| 5 | `run-mud67jc3-14795ae6` | 11 provider calls, 8 tool calls, **4 applied presses and a field entry**, then the same `repeat_without_progress`. |
| 6 | `run-mud6ccnv-c26f8986` | 27 provider calls. **The model chose `amend_draft` four times and the loop applied each**, and a look after a refused navigate ran where it used to be withheld. Also found a defect in this task's own work. |
| 7 | `run-mud6jyvq-1aa89a99` | 21 provider calls, **5 applied presses and a navigate**, one `amend_draft` applied, and the guard tripped correctly at the end with the laundering fixed. Still `repeat_without_progress`. |

**What run 3 found, and the fix.** The DeepSeek adapter re-derives the decision
schema from the tools it was given and refuses the request if it does not match
byte for byte (`deepseek-provider.ts:563`). The `amend_draft` variant made it
not match, so every build failed before its first tool call.
`validEvidenceLoopContext` now derives both of Core's two shapes and accepts
either, and still refuses a schema that is not Core's or that is over tools the
request did not offer. This is the kind of defect no unit test would have found
and one live run did.

**What runs 4 and 5 show, and what they do not.** In both,
`build.providerCalls` equals `observed.calls` (10 = 10, 11 = 11), so nothing was
spent outside the build. Both carried the draft entry in every request from the
first applied press onward — the loop has no path that omits it once a changing
step exists, and a malformed or over-budget entry would have been refused by the
same context check that refused run 3, which none of those 21 requests was.
**What neither run shows is the proposed Flow**, because neither reached a
proposal: in both, the model stopped acting and asked for the same observation
three times in a row, ending on the no-progress guard. That is round 1's top
failure cause; it is not a refusal case, so the epoch fix does not touch it, and
it belongs to the worker improving rejection detail rather than to this task.

**What run 6 proves, and what it caught.** Its step list is the best evidence in
this report, and it says three things.

- **A5 works live.** `core.decision_amend_draft` appears four times with
  `llm_evidence_loop.draft_amended`. A real DeepSeek model, offered the new
  decision kind, chose it and the loop applied the edits. Nothing in a unit test
  can say that.
- **The coordinator's finding is fixed, live.** Step 9 is
  `web.navigate_same_origin` with `effectApplied: false` and
  `web.action.rejected.no_progress`; step 10 is `web.inspect_current_page` with
  `web.inspect.succeeded`. Before the second epoch, that look would have come
  back `already_observed` and counted against the guard. It ran.
- **It found a defect in this task's own work, which is now fixed.** An
  amendment that landed called `progressed()`, clearing the no-progress guard.
  The model alternated a repeated `navigate_same_origin` with an edit, each edit
  laundered the repeat before it, the guard never saw two in a row, and the
  build ran to `evidence_iteration_limit` at 27 calls having gathered nothing
  new since its eleventh. An edit is now progress on the draft and never on the
  evidence: it neither clears the guard nor is spent by it, and an edit that
  changed nothing still counts. `flow-draft/tests/accrual.test.ts` pins it.

**What run 7 says about the fix.** With the laundering closed, the same build
made five applied presses and a navigate over 21 calls, took one `amend_draft`,
and then ended on the guard exactly where it should — three
`detect_repeating_structure` requests in a row, the third refused. No edit
cleared the count, and `providerCalls` equalled `observed.calls` again (21 =
21). That is the guard behaving, not the guard being evaded.

**Seven runs, no proposal, and the reason is consistent.** Every run that got
past the environment ended the same way: the build acts — three, four, five
applied presses, a navigate, a field entry — and then the model stops acting and
asks for the same observation until the no-progress guard ends it. That is round
1's documented top failure cause. It is not a refusal case, so the epoch fix
does not reach it, and it belongs to the worker improving rejection detail. The
brief's end-to-end proof is blocked behind that, not behind anything here.

### Deterministic, in place of the part the live runs could not reach

`runtime/llm/tests/evidence-loop-provider.test.ts` now drives the real DeepSeek
adapter with a stubbed `fetch` and asserts on the outbound body: the
`core.flow_draft` entry arrives verbatim carrying **both** presses that share
one tool id, and the amend-enabled schema is accepted while a schema over tools
the request did not offer is still refused before the secret is resolved.

### Unit tests and checks

- `npx vitest run runtime/llm runtime/flow-draft runtime/flow-bootstrap` — all
  pass. New: `flow-draft/tests/{entry,amendment,accrual}.test.ts`,
  `llm/tests/repeat-policy.test.ts`,
  `flow-bootstrap/tests/draft-reduction.test.ts`,
  `flow-bootstrap/authoring/tests/assemble-draft.test.ts`, two cases in
  `llm/harness-options/tests/bootstrap-completion.test.ts` and two in
  `llm/tests/evidence-loop-provider.test.ts`.
- `pnpm check` in Core — **passed**: structure audit passed (173 warnings, 361
  baselined, no budget raised) and every package's `tsc --noEmit` clean.
  `evidence-loop.ts` is 776 lines against the 800-line limit it had been sitting
  on.
- `pnpm --filter fluxiq test` (the whole Core suite) — 2,791 passed, 28 failed
  across 3 files, **every failure an `ENOTEMPTY`/`EBUSY` temp-directory race**
  from running it beside a Lab run, with no assertion failure among them. All
  three files pass in isolation:
  `runtime/tests/service-bootstrap/tests/accounting.test.ts`,
  `storage/project/tests/runtime-stream-store.test.ts` and
  `runtime/tests/service-flows/tests/representation.test.ts`.
- `npx tsc --noEmit` in `domain/` — clean against the rebuilt Core.
- `pnpm check` in the downstream repository — **passed**, every package Done.
  The first attempt of it was run beside a Lab build and reported
  `@fluxiq-web-extension/domain/node has no exported member …` for fifteen
  names; that was the Lab's `clean-dist` removing 447 files from `domain/dist`
  underneath it, not a real failure, and it is worth remembering that this
  repository's own checks cannot be run beside a Lab run in the same worktree.

---

## Not verified

- **The proposed Flow containing the dismissals.** No live build on this
  scenario reached a proposal, so the end-to-end claim the brief asks for is not
  evidenced. Everything up to the model writing the result is.
- **The reduction over a real digest chain.** `captureStateDigest` has no call
  site until `runtime/service.ts` is wired, so every live build took the
  `accrual` basis. The `reduction` basis is covered by unit tests only.
- **Whether a model uses `amend_draft` well.** Run 6 proves it chooses the kind
  and that the loop applies it; what the four edits actually said, and whether
  they improved the draft, is not visible in a redacted run record.
- **The refused-script echo in a live refusal.** Unit-tested on all five refusal
  paths; no live build reached a completion refusal in these six runs.
- **The sibling assembler in a real build.** Nothing calls it yet: it needs the
  `write` mapping, which the web domain owns and this task may not touch.
- Browser behaviour beyond what the Lab exercised, and every scenario other than
  `everything-store`.

---

## Open questions or contradictions found

1. **Three files outside the brief's owned list had to change, all three forced
   by A5.** `runtime/llm/harness/provider-result.ts` and
   `harness/structured-response.ts` reject an unknown decision kind before it
   reaches the loop, and `runtime/llm/deepseek-provider.ts` refuses a decision
   schema it cannot re-derive. Without all three, `amend_draft` is dead code and
   every build fails at its first call. Each change is small and additive.
   Flagging rather than assuming it was in scope.
2. **The web domain has no function shaped for `classifyOutcome`.** It exposes
   `classifyRefusal: (resultCode) => AutomationStudioExplorationStopReason`
   (`domain/src/runtime/llm-evidence/tools.ts:219`), while the reducer's adapter
   wants `AutomationStudioExplorationStepOutcome` — different unions
   (`wall_clock_expired`, `refusal_limit`, … against
   `succeeded`/`failed`/`refused`/`not_run`). Whoever wires `service.ts` needs
   one or a mapping. Not urgent: without it a refused call is classified
   `failed`, which the reduction drops for the same reason, so only the
   receipt's precision suffers.
3. **`assertAutomationStudioBootstrapHasNoRecordingProvenance`
   (`flow-bootstrap/adaptation.ts:290`) still throws on any key matching
   `/recording|timeline/i`.** Nothing here trips it, because the draft is not
   stored in an adaptation — but the moment a wiring task stores it beside one,
   it will. d1 flagged this and it is still unaddressed.
4. **The draft carries the model's own tool inputs back to the provider.** That
   is the point, and it is the model's own writing, never page content. The
   residual risk is that an input containing one of the domain's denied keys
   (`html`, `cookies`, `selector`, …) would make `packEvidenceLoop` throw and
   end the build. The authoring tools' input schemas are
   `additionalProperties: false` over `target`/`value`/`consequences`/`url` and
   the provider's structured output enforces them, so this needs a provider that
   breaks its own schema. Named rather than guarded against.
5. **An `amend_draft` decision the loop did not offer ends the run**
   `llm_evidence_loop.invalid_decision` rather than being fed back. Failing
   closed is the safer default and the schema makes it near-impossible, but it
   is a sharper edge than the rest of the loop's behaviour.
6. **`repeat_without_progress` is the visible ceiling on this scenario, and it
   is now the thing to fix next.** Four clean runs ended there — runs 4, 5 and
   7 on the guard, run 6 on the iteration limit — each after the build had done
   real work. No live build of `everything-store` will reach a proposal until
   the model stops repeating an observation instead of writing the result, so
   the plan's later live measurements are blocked behind that rather than behind
   Workstream A. The pattern is identical every time: the build acts, gathers,
   and then asks the same question until it is stopped.
