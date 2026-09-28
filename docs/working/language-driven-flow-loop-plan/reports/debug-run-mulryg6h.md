# Debug: `run-mulryg6h-ff241a12` (everything-store / kettle-to-cart)

Full step-by-step post-mortem of one failed live build. Diagnosis only; no
product code was changed.

**Bundle:** `F:\!FluxIQWebExtension\test-runs\run-mulryg6h-ff241a12\`
**Core commit:** `68bad85f7c540be423e6da353bed457078c4c98c` (clean)
**Facility commit:** `132f28c9ae3b9e45f6be36510d8976dd0caeb0d8` (dirty)
**Wall clock:** 2026-09-28T21:43:46.796Z → 21:48:06.527Z (259,731 ms; the build
itself was 166,532 ms — `snapshots/flow-lane.json` `build.durationMs`).

## The one-sentence answer

The build explored the site competently for thirteen decisions, then tried to
add the record-producing step the instruction requires, and
`web.output.dom-extract_list` failed three times telling the model only the
word `action_failed` with no reason attached. With nothing to correct, the
model could not put a record-producing step in its draft, so Core's
answerability check refused every completion attempt, and the loop ran out its
26 iterations. The failure code is a label applied to an iteration-limit
exhaustion, not a distinct fault.

## Where the evidence is

`run.json` `steps: []` and `actions: []` are empty, and `evaluation.json`
`metrics.steps: 24` is **not a property of this run at all** — it is
`workflow.recordingScript.length` for the pre-recorded `add-to-cart` workflow
(`packages/test-runner/src/run-scenario.ts:625`). The run's own trace is 29 rows
in `snapshots/live-llm.json` → `build.evidenceLoop.steps`, which carries
`usage`, `draft`, `draftChange` and `answerability` per row.
`snapshots/flow-lane.json` holds a reduced projection of the same rows without
those fields, and `provider-failures.local.json` holds a copy of the diagnostic
truncated at 8,000 of 16,818 bytes (`core.bodyTruncated: true`). **Read
`live-llm.json` for this run, not the other two.**

## The instruction

`apps/scenario-lab/src/scenarios/everything-store/live-tasks.ts:47-53`, task
`everything-store-kettle-to-cart`:

> Put two Tidewell electric kettles in sage green, 1.7 litre, sold by
> Brightaisle itself, in my cart, and move the phone case that is already in my
> cart to Save for later. Then give me what is in my cart, leaving out the saved
> items, as a table with columns item, quantity and price, where quantity is a
> plain number and price is the price of one.

345 characters, SHA-256 `82c49c5b5bf16c95cf5d8a4dfd303c02a3622b043b00edbe5b862d3860943817`
— both match `flow-lane.json` `task.instruction`, so this is certainly the
sentence the build was given. The expected answer is two rows (2 × sage kettle,
1 × batteries — `apps/scenario-lab/src/scenarios/everything-store/workflows/add-to-cart.ts:15-18`),
so a repeating structure **does** exist on the correct cart page.

---

## 1. The walk, step by step

Times are offsets from the first row. `it` is the loop iteration; one iteration
is one paid provider call, except that an `amend_draft` carrying a `rerun`
writes two rows for one call (`evidence-failure.ts:146` explains the
distinction).

| # | it | +s | what it did | result | draft | verdict |
|---|----|----|-------------|--------|-------|---------|
| 0 | 0 | 0.0 | free first look, `web.output.dom-capture_snapshot` | `web.action.rejected.not_at_start_location` / `start_location_not_reached` | — | **Expected.** The host makes this look before any decision; the domain answers "you are not there yet" rather than reading a page nobody opened (`service.ts:1567` comment). Not a fault. |
| 1 | 1 | 7.6 | `core.run_node` | `web.action.succeeded` | rev 0→1 | Good. |
| 2 | 2 | 12.2 | `core.run_node` → `web.output.dom-click` | `web.action.rejected.blocked_by_dialog` | rev 1→2, 1,388 B | A dialog stood over the target. Recoverable and correctly named; the model recovered on the next call. |
| 3 | 3 | 16.5 | `core.run_node` | `succeeded`, page **changed** | rev 2→3 | Good. |
| 4-7 | 4-7 | 20.9-36.2 | four `core.run_node` | all `succeeded`, page changed each time | rev 3→7, draft 1,882→2,649 B | **This is the run working.** Six real actions, each moving the page. |
| 8 | 8 | 39.7 | `web.detect_repeating_structure` | `web.structure.detected` | rev 7 | The **only** successful structure detection in the run. |
| 9 | 9 | 45.1 | `core.run_node` | `web.inspect.succeeded` | rev 7→8 | Good. |
| 10 | 10 | 48.0 | `web.detect_repeating_structure` | `llm_evidence_loop.already_answered` | rev 8 | Core answered from the iteration-8 result instead of re-running. First wasted call. |
| 11 | 11 | 53.4 | `core.run_node` | `web.inspect.succeeded` | rev 8→9 | Good. |
| 12 | 12 | 57.1 | `core.decision_amend_draft` | `draft_amended`, 2 applied, 0 refused (`d3`,`d10`) | 3,544 B | Good — the model is editing its own plan. |
| 13 | 13 | 62.7 | `core.run_node` | `succeeded`, page changed | 3,551 B | **Last productive action of the run.** |
| 14 | 14 | 66.0 | `core.decision_amend_draft` | `draft_rerun` on `d12`, 1 applied 1 refused | 3,836 B | Model asks to re-run a step with corrected arguments. |
| **15** | **14** | **77.2** | **`core.run_node` → `web.output.dom-extract_list`** | **`web.action.rejected.action_failed`**, 6,149 B evidence | 3,836 B | **THE DIVERGENCE.** 11.2 s spent, then a bare `action_failed`. No `resultReason`, no detail. |
| 16 | 15 | 80.4 | `core.decision_amend_draft` | `draft_rerun` on `d14` | 3,609 B | Model tries again with a changed argument — the only move a bare `action_failed` leaves it. |
| 17 | 15 | 91.5 | `core.run_node` → `web.output.dom-extract_list` | `action_failed`, **6,149 B — byte-identical** | 3,609 B | Same failure, same bytes. The model learned nothing from attempt 1 and nothing from attempt 2. |
| 18-19 | 16-17 | 102.0, 109.9 | two `web.detect_repeating_structure` | `no_repeating_structure` / `nothing_repeats_around_target`, 206 B each | 3,925 B | Model falls back to re-detecting. Refused twice for naming a target with no repeating siblings. |
| 20 | 18 | 112.8 | `core.decision_amend_draft` | `draft_amended`, **1 applied, 3 refused** (`d15`,`d14`,`d12`,`d10`) | 3,925 B | Draft is now at **3,925 of its 4,000-byte budget**. |
| **21** | **19** | **116.0** | **`core.decision_unusable`** | **`bootstrap.cannot_answer_instruction`**, `answerabilityState: first_observed` | 3,928 B | Model gave up exploring and tried to finish. Core refused: `recordsRequested: true, recordProducerPresent: false, recordStorePresent: false`. |
| 22 | 20 | 130.3 | `core.run_node` → `web.output.dom-extract_list` | `action_failed`, **6,149 B — identical again** | 3,928 B | Third and final attempt at the extraction. 14.3 s. |
| 23 | 21 | 133.6 | `core.decision_amend_draft` | `draft_amended`, 1 applied, **4 refused** | 3,795 B, **`instructionBytes` 1,047 → 575** | The draft entry shrank its own guidance to fit the 4,000-byte budget. |
| 24 | 22 | 137.4 | `core.decision_amend_draft` | `draft_unchanged`, **0 applied, 5 refused** | 3,798 B | Every amendment refused. The model is editing steps that are no longer there. |
| 25-26 | 23-24 | 146.5, 154.6 | two `web.detect_repeating_structure` | `nothing_repeats_around_target`, 206 B each | 3,798 B | Repeat of #18-19 verbatim. |
| 27 | 25 | 157.9 | `core.decision_unusable` | `bootstrap.cannot_answer_instruction` | 3,798 B | Second refused completion. |
| 28 | 26 | 161.3 | `core.decision_unusable` | `bootstrap.cannot_answer_instruction` | 3,798 B | Third refused completion — and iteration 26 of 26. Loop exits. |

### The exact point of divergence

**Row 15 / iteration 14, at +77.2 s: the first `web.output.dom-extract_list` →
`web.action.rejected.action_failed`.**

Everything before it worked: six actions applied, the page changed six times,
one structure detected, two inspections succeeded, the draft grew monotonically
from 0 to 3,551 bytes across eleven revisions. Everything after it is the model
trying to obtain a record-producing step and being told nothing it can act on.
Of the twelve remaining decisions: three were the same extraction failing
identically, four were structure detections refused identically, three were
completion attempts refused identically, and two were amendments of which one
applied nothing.

The **irrecoverable** point is row 22 / iteration 20 (+130.3 s). That was the
last `core.run_node` of the run; the remaining six calls contained no attempt to
execute anything, so from there no record-producing step could enter the draft
under any model behaviour.

---

## 2. Why `flowCreated` is false although exploration succeeded

Exploration and flow creation are different bars. Exploration succeeded at
*acting*; creation requires a **plan that could answer the instruction**, and
that is checked separately with no provider call.

`snapshots/live-llm.json`, rows 21, 27 and 28 each carry the same
`answerability` snapshot:

```json
{ "recordsRequested": true, "recordProducerPresent": false,
  "recordStorePresent": false, "issueCode": "bootstrap.cannot_answer_instruction" }
```

So at every one of the three completion attempts, Core read the instruction,
saw that it plainly asks for a set of records ("as a table with columns item,
quantity and price"), walked the model's completed plan, and found **no step
whose result carries rows and no step that saves rows into a dataset**.

The draft's trajectory says why. `keptStepCount` stays at **7** from row 12
(iteration 12) to row 24 (iteration 22) — seven kept, proposable steps for the
whole second half of the run. The steps the model kept targeting with
amendments — `d10`, `d12`, `d14`, `d15`, `d18` — are the extraction attempts,
and by row 24 all five were refused (`appliedCount: 0, refusedCount: 5`):
the model was amending steps the draft no longer held, because a `rerun`
withdraws the step it replaces (`evidence-loop.ts:604`) and the re-run then
failed. The seven kept steps are the navigation and the clicks. None of them
returns rows.

`generate-flow-bootstrap-adaptation` therefore never got a proposable plan at
all. There is no partial Flow to inspect: `flow-lane.json` has
`flowShape: null`, `authoredNodes: null`, `status: null`, `actions: []`, and
`build.outcome: "failed"`. `flowId` (`flow.3e78d2e8-…`) was minted before the
loop and nothing was ever written to it.

**Not verified:** the bundle does not contain the draft's step list or its node
ids, only byte counts and the amendment target ids. I inferred which draft steps
were the extractions from the amendment pattern and the interleaved
`extract_list` runs; I could not read the draft itself.

---

## 3. What `flow_bootstrap.evidence_unusable_decision` means in Core

### Where the issue code is raised

`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\flow-bootstrap\answerability\check.ts:57-95`:

```ts
export function checkAutomationStudioFlowBootstrapAnswersInstruction(input: {…})
  : AutomationStudioFlowBootstrapAnswerability {
  const ask = automationStudioFlowBootstrapInstructionAsk(input.instructionText ?? "");
  const found = automationStudioFlowBootstrapPlanRecordSets(input);
  const answerability = {
    recordsRequested: ask.records,
    recordProducerPresent: found.returning.length > 0,
    recordStorePresent: found.storing.length > 0
  };
  if (!ask.records) return { ok: true, answerability };
  if (!automationStudioFlowBootstrapLibraryReturnsRecords(input)) return { ok: true, answerability };
  if (answerability.recordProducerPresent || answerability.recordStorePresent) return { ok: true, answerability };
  return {
    ok: false,
    answerability: { ...answerability, issueCode: "bootstrap.cannot_answer_instruction" },
    …
  };
}
```

**The exact condition, all three conjuncts required:** the instruction plainly
asks for a set of records, **and** the bound node library contains at least one
node that returns rows (so the refusal is actionable), **and** the completed
plan has neither a step that returns rows nor a step that stores them. All three
held here. The check is correct and it cost nothing — `contracts.ts:20` notes
"nothing here calls a provider".

### Which part of the provider's output failed validation

Not the JSON shape, not the parameters, not the node names — the model's
`complete` decision parsed fine all three times. What failed is the
**capability** check on the plan the `complete` carried: it named no
record-producing step. `check.ts:82`: *"The instruction asks for a set of
records and no step of this Flow produces or saves one, so no run of it could
answer."*

### How that becomes an HTTP 400

The refused completion is recorded as an unusable decision
(`llm\evidence-loop.ts:571-583`), which increments `unusableInARow` and is fed
back to the model. The loop then ran out of iterations, and:

`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\llm\evidence-loop.ts:337-342`:

```ts
const exhausted = (): AutomationStudioLlmEvidenceLoopResult => {
  if (!unusableInARow || !input.unusableDecisions) return failure(draftSteps, "llm_evidence_loop.iteration_limit", trace, accounting);
  const spent = input.unusableDecisions.stalled({ issueCodes: lastIssueCodes, trace: [...trace], accounting: { ...accounting } });
  if (input.propagateDecisionErrors) throw spent;
  return failure(draftSteps, "llm_evidence_loop.invalid_decision", trace, accounting);
};
```

`exhausted()` is reached from `evidence-loop.ts:764`, the fall-through after
`for (let iteration = 1; iteration <= limits.maxIterations; …)` at line 462.
`stalled` is wired at `runtime\service.ts:1578` to
`flowBootstrapEvidenceUnusableDecisionFailure`, which
(`flow-bootstrap\generation-failure\evidence-failure.ts:58-73`) builds exactly
the diagnostic the bundle shows: `code:
"flow_bootstrap.evidence_unusable_decision"`, `stage:
"provider_output_validation"`, `retryable: false`, `issueCodes:
["bootstrap.cannot_answer_instruction"]`.

**Finding: the code misnames what happened.** `exhausted()` reports an
*iteration-limit* exit as an *unusable-decision* failure whenever the last paid
decision happened to be unusable. Had iteration 26 been a tool call instead of
a completion attempt, the identical run would have reported
`flow_bootstrap.evidence_iteration_limit`. Neither unusable guard fired:
`maxStepsWithoutProgress` and `maxUnusableDecisionsInARow` are both **24**
(`loop-limits\flow-bootstrap-evidence-loop.ts:158` gives
`min(24, maxIterations)`; `llm\loop-configuration.ts:307-309` then sets
`maxUnusableDecisionsInARow = max(24, min(3, 26)) = 24`), and the run had at
most two unusable decisions in a row. `retryable: false` is likewise wrong for
this run — the thing it ran out of was calls.

---

## 4. The token discrepancy

**There is no discrepancy. 403,958 is a run total; 48,000 is a per-request
bound. Nothing exceeded anything.**

Per-call input tokens, from `snapshots/live-llm.json`
`observed.observedCalls[*].inputTokens` (26 rows): 9,175 · 11,882 · 13,412 ·
15,847 · 16,591 · 15,916 · 16,254 · 16,418 · 16,215 · 15,686 · 15,811 ·
**16,632 (max)** · 16,631 · 16,331 · 16,111 · 16,038 · 16,121 · 16,206 ·
16,409 · 16,164 · 16,205 · 16,173 · 16,217 · 15,636 · 15,720 · 14,157.
**Sum = 403,958.** The largest single request was 16,632 — 35 % of the 48,000
bound. `observed.accounting.budgetBreaches: 0` agrees.

`maxTotalTokensPerRun` was 560,000 and the run used 406,566 total, so that bound
was not reached either.

### Yes, `maxInputTokens: 48000` is enforced — in five places

- `llm\harness\run.ts:97-98` — the packed request's estimated input is compared
  to `request.tokenLimits.maxInputTokens` before sending;
  `llm_budget.input_limit_exceeded`.
- `llm\deepseek\provider.ts:98` and `llm\deepseek\preflight.ts:38` — the same
  check on the provider path.
- `llm\deepseek\request-shape.ts:171` — a negative `inputHeadroom` is reported.
- `llm\harness\token-limits.ts:77` and `llm\deepseek\response-envelope.ts:40` —
  the **provider-reported** usage is checked after the fact
  (`llm_usage.input_limit_exceeded`).

### Were 403,958 input tokens really sent? Yes — and what dominates

They were genuinely sent, 26 times over. The per-call input is flat at
~16.1 k from call 12 onwards, which is deliberate: `runtime\service.ts:1608`
passes `flowBootstrap: { registry, resolution, maxInputTokens: 16_000, … }`
to the evidence-decision harness, with the comment *"Reserve evidence-decision
input capacity for the dynamic tool schema and accumulated evidence instead of
allowing the node catalog to consume the ordinary Bootstrap input allocation."*
That 16,000 becomes a **byte** budget for the node catalog via
`flow-bootstrap\plan.ts:20-31` at 3 UTF-8 bytes per token
(`llm\token-estimation.ts:1-9`), capped at `maxCatalogBytes: 49_152`
(`flow-bootstrap\plan\limits.ts:14`).

**The component that dominates is the static prompt prefix — the node catalog
plus the decision and completion JSON schemas — re-sent in full on every one of
the 26 calls.** The provider's own cache accounting proves it: across the 13
calls whose `cacheHitInputTokens` survives the truncation in
`provider-failures.local.json`, the cached prefix runs 9,472–15,616 tokens
against a 14,157–16,632 total. On call 13 it is 15,616 of 16,631 — 94 % of that
request was a prefix identical to the previous one. The variable parts are
small by construction: the evidence window is capped at 24,000 bytes
(`loop-limits\flow-bootstrap-evidence-loop.ts:91`, ≈ 6 k tokens after the
`besideBytes` deduction at `evidence-loop.ts:511`) and the draft at 4,000 bytes
(`llm\loop-configuration.ts:311`, ≈ 1.3 k tokens).

That prefix cache is also why 403,958 input tokens cost only $0.047.

### A real finding buried in the token data: the draft was being truncated

`draft.bytes` reaches **3,925 / 4,000** at row 18 and stays pinned there. At
row 23 `instructionBytes` drops **1,047 → 575**. That is the draft entry
shrinking itself to fit — "its arguments, then the length of its guidance, then
the oldest steps" (`evidence-loop.ts:519-527`). So from iteration 21 onward the
model was shown a draft with its guidance nearly halved, at exactly the point it
was trying to repair that draft. The 4,000-byte cap is
`Math.min(4_000, Math.floor(maxEvidenceContextBytes / 4))`
(`llm\loop-configuration.ts:311`) — a quarter of a 16,000-byte context window,
except the window here is 24,000 bytes, so 4,000 is the hard cap rather than the
proportional share.

---

## 5. Did the run exhaust `maxCallsPerRun: 26`? Yes — and that ended it

`evaluation.json` `llm.calls: 26`; `flow-lane.json`
`build.evidenceLoop.decisionCount: 26` and `iterationCount: 26`. The loop's
`maxIterations` is `Math.min(maxCallsPerRun ?? 64, 64) = 26`
(`loop-limits\flow-bootstrap-evidence-loop.ts:130-131`), and the run reached
iteration 26. It did not stop on a guard — it stopped at
`evidence-loop.ts:764`, the end of the `for`.

**The exhaustion caused the ending; the answerability refusal caused the
failure.** Those are two different things and the bundle conflates them. Had the
budget been larger the run would have had more calls, but on the evidence it was
not converging: iterations 23-26 repeat iterations 16-19 almost exactly (two
identical structure refusals, then a refused completion), with a draft frozen at
3,798 bytes and 13 steps from row 24 onward. More calls would most likely have
bought more identical repetition, because nothing in the loop was telling the
model anything new.

### Where 26 came from — and it should have been 48

The run's `declared` block in `snapshots/live-llm.json` is
`{maxInputTokens: 48000, maxOutputTokens: 8000, maxTotalTokensPerRequest: 56000,
maxCallsPerRun: 26, timeoutMs: 30000, maxRetries: 0}`. That is **byte-for-byte
`DEFAULT_LLM_LAB_BUDGET`** (`packages\test-contracts\src\llm.ts:121-151`), so
this run was launched with **no `--llm-*` budget flags at all**.

It therefore did not go through the campaign wrapper. `scripts\lab\live-campaign\lab-run\command.mjs:38-55`
gives a **creation** task `["--llm-max-calls", "48"]`, with a comment recording
precisely this problem:

> Leaving the call count unnamed inherited `DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun: 26`,
> which mirrors Core's grant default of a diagnosis, a patch and 24 exploration
> decisions — a shape that predates a build exploring by running the library's
> own nodes. … 48 is above what a build of these pages has been observed to need
> and below the contract ceiling of 64.

This run is `lane: "flow"`, `task: create-flow`, `purpose: build_and_adapt` — a
creation — and it ran on the repair-shaped budget of 26.

**Not verified:** I could not recover the launch command from the bundle; the
inference is from the exact match of the declared budget to the defaults.

### Not the cause: the process exits

`run.json` `processExits` shows `scenario-lab: 1` and `fluxiq-web: 1`. The error
event is at 21:48:05.991 and `finishedAt` is 21:48:06.527, so those are teardown
after the failure, not before it. `evaluation.json`'s
`facilityFailure: { boundary: "finalized-bundle", stage: "scenario.execute",
reason: "unclassified" }` is the facility's own unclassified wrapper around the
same product failure, not a second fault.

---

## 6. Ranked causes

### 1. A failed page action tells the model a bare code and drops the diagnosis Core already computed

**This is the single change most likely to make this run succeed.**

The extension computes a full account of why an extraction failed.
`apps\extension\src\content\actions\extract-list.ts:96-108` (`summaryOf`) builds
`recordCount`, `pagesRead`, `truncated`, `missingFields`, `fieldNames`,
`itemsSeen`, `emptyRecords`, `listPresence`, and
`listWait.{stoppedOn, waitedMs, waitedFor}`. `validationFor`
(`extract-list.ts:129-140`) turns a shortfall into an `actual` phrase naming it.
`apps\extension\src\content\action-runtime\results.ts:172-177` attaches all of
it to the failure record.

Then it is thrown away. `domain\src\runtime\llm-evidence\node-run\run.ts:283-285`
turns any non-succeeded result into
`pageRefusal(…, webActionFailureRejectionCode(result), …)`, and
`domain\src\runtime\llm-evidence\capture.ts:376` is:

```ts
return new RecoverableToolRejection(code, undefined, page);
```

— `detail` hard-coded `undefined`. And the code itself is lossy:
`domain\src\runtime\llm-evidence\action-failure.ts:42` is a fall-through —

```ts
return typeof code === "string" && Object.prototype.hasOwnProperty.call(BY_FAILURE_CODE, code)
  ? BY_FAILURE_CODE[code]! : "action_failed";
```

`BY_FAILURE_CODE` (lines 24-33) maps only eight codes. Everything else —
including `web.validation.output_not_observed`, which is what a zero-record
extraction produces (`results.ts:264-268`, `unobservedOutputCode`) — collapses
to the undifferentiated word `action_failed`.

That is exactly what the model saw, three times, 6,149 bytes each and
**byte-identical**: the same code, the same page packet, no detail. A model told
only "it failed" has nothing to change, so it changed an argument, got the same
answer, and eventually stopped trying.

This is the same defect the domain has already fixed once on the detection path.
`domain\src\runtime\llm-evidence\structure\refusal.ts:1-11` records it:

> on `run-mug25fdp-21ba8385` … 24 of 30 decisions were
> `web.detect_repeating_structure` answered `no_repeating_structure`, 85 bytes
> each and identical, until Core's no-progress guard ended the build. Nothing was
> executed, no Flow was built, and it cost 29 provider calls and 316,536 tokens.
> A model told only "no" has nothing to change, so it asks again.

The action path is the unfixed half of that finding. The fix is the same shape:
give `WebLlmToolRejectionDetail` (`domain\src\runtime\llm-evidence\tool-rejection.ts:275-313`)
closed-vocabulary counts for a failed read — `recordsRead`, `itemsSeen`,
`emptyRecords`, the `missingFields` keys (the model's own declared field names,
not page text), and `listWait.stoppedOn` — and stop passing `undefined` at
`capture.ts:376`. Every one of those is a count or a key the model wrote itself,
so none of them crosses the "a refusal must never become a side channel for page
content" line the same file draws at line 27.

*Confidence:* high that the model was told nothing actionable — the identical
6,149-byte evidence and `capture.ts:376` prove it. **Lower** on which underlying
failure code it was: the bundle does not carry it. `web.validation.output_not_observed`
(a read that returned fewer than `minItems`, default 1 —
`extract-list.ts:117-119`) is the best fit, because each attempt burned ~11-14 s,
consistent with the list wait running to exhaustion and returning zero rows, and
because a genuine timeout would have been reported as `action_timed_out`
(mapped, `action-failure.ts:32`) and a bad handle or column as
`extraction_handle_required` / `column_not_in_detected_list`
(`tool-rejection.ts:359-360`) rather than `action_failed`. I cannot rule out
`web.action.invalid_parameter` or `web.action.failed`, which fall through
identically.

### 2. `web.detect_repeating_structure` refused four times for naming a target, and the model never stopped naming one

`domain\src\runtime\llm-evidence\structure\refusal.ts:121-125`:

```ts
function whyNothingRepeats(evidence, counts, target): WebLlmToolRejectionReason {
  if (pageIsNotTheContent(evidence, counts)) return "page_is_not_the_content";
  if (target !== undefined) return "nothing_repeats_around_target";
  return counts.groups >= A_RUN || counts.rows >= A_RUN ? "repeating_groups_not_readable" : "nothing_repeats_on_page";
}
```

All four refusals were `nothing_repeats_around_target`, which by that branch
means the call **named a target**. The refusal's own documented next move is
"Detect without a target, or name an element inside a row of the list actually
wanted" — and the model did neither, four times, at 206 bytes each. The refusal
carries `groupsSeen`, `rowsSeen` and `controlsSeen`, so unlike cause 1 the model
was given something; it just did not use it. Worth checking whether the
`instead` field or the phrasing makes "detect without a target" discoverable,
since the expected cart page genuinely has two repeating rows.

### 3. A creation run executed on the repair-shaped call budget

26 instead of 48, from `packages\test-contracts\src\llm.ts:147` because the
launch named no `--llm-max-calls`, where
`scripts\lab\live-campaign\lab-run\command.mjs:55` would have given 48. This did
not by itself cause the failure — the run was repeating, not converging — but it
removed the margin, and it means the measurement was taken on the wrong budget.
Fixing it is cheap. The durable fix is to make the default *for a creation task*
48 rather than relying on the campaign wrapper to say so.

### 4. `exhausted()` mislabels an iteration-limit exit as a validation failure

`evidence-loop.ts:337-342`. A run that ran out of calls is reported as
`flow_bootstrap.evidence_unusable_decision` / `provider_output_validation` /
`retryable: false` purely because its last decision happened to be an unusable
one. This cost real debugging time on this run and will keep doing so: it hides
budget exhaustion behind a code that reads like a model defect, and marks as
non-retryable something that a larger budget could retry. The diagnostic should
carry both facts — that the loop exhausted, and what the last refusal was.

### 5. The draft budget squeezed the model's guidance at the moment it needed it

`draft.bytes` pinned at 3,925-3,928 of 4,000 from iteration 16, and
`instructionBytes` cut from 1,047 to 575 at iteration 21. `draftBytes` is
`Math.min(4_000, Math.floor(maxEvidenceContextBytes / 4))`
(`llm\loop-configuration.ts:311`) — the 4,000 cap binds, not the proportional
share of the 24,000-byte window. A 13-step draft does not fit in 4,000 bytes
with its guidance intact, and this build's later amendments applied 1 of 4 and
then 0 of 5. The connection between the truncation and the refused amendments is
**suggestive, not proven** — I cannot tell from the bundle whether the model was
shown the steps it tried to amend. A run that recorded `draftShown` (which
`evidence-loop.ts:530` computes for exactly this purpose) in the bundle would
settle it.

### 6. Bundle ergonomics cost time and should be fixed

- `evaluation.json` `metrics.steps: 24` is the recording's length
  (`run-scenario.ts:625`), not this run's. It reads as a run statistic and is
  not one.
- `run.json` `steps: []` / `actions: []` are empty on a run that made 19 tool
  calls.
- `flow-lane.json` silently drops `usage`, `draft`, `draftChange` and
  `answerability` from the trace rows that `live-llm.json` keeps.
- `provider-failures.local.json` truncates the diagnostic at 8,000 of 16,818
  bytes, cutting off the second half of the step list.
- The draft's contents, the tool inputs, and the underlying
  `WebAutomationFailureCode` for a rejected action are nowhere in the bundle,
  which is what made question 1 partly inferential.

---

## Not verified

- **Which page the extraction ran against.** The bundle carries no URLs and no
  page packets, so I cannot confirm the run reached the cart page. The expected
  cart has two rows, so `nothing_repeats_around_target` on the *correct* page
  would need explaining; on a product or search page it would not.
- **The underlying failure code behind `action_failed`.** Not in the bundle.
  Reasoned to `web.validation.output_not_observed` above, with alternatives
  named.
- **The draft's step list and node ids.** Only byte counts and amendment target
  ids survive.
- **The launch command.** Inferred from the exact match of `declared` to
  `DEFAULT_LLM_LAB_BUDGET`.
- **No code was run.** This was a read of the bundle and of the two source
  trees; I executed no tests, no build and no live run.

## Open questions

1. Was this run part of the agreed campaign? If so, why did it not get the
   campaign wrapper's `--llm-max-calls 48`? If it was launched by hand, the
   measurement should be repeated on the campaign budget before the result is
   carried forward.
2. `web.detect_repeating_structure` at iteration 8 succeeded and the same tool
   was refused four times later — was that the same page? If the page changed at
   iteration 13 and invalidated the detection, a stale extraction handle would
   be expected to refuse as `target_unobserved` / `handle_no_longer_on_page`
   (`structure\refusal.ts:90-95`), not `action_failed`. The fact that it did not
   is itself a signal about which failure code fired.
3. The scenario's Save-for-later control is deliberately flaky — it fails its
   first request of a session and only offers "Try again" after four seconds
   (`workflows\add-to-cart.ts:33-35`). Whether the build ever cleared that gate
   is not recoverable from this bundle, and if it did not, the cart would never
   have reached the expected two-row state.
