# Why building one Flow costs ~20 provider calls and ~200k tokens

Read-only diagnosis. No source file in either repository was changed.

Runs studied: `run-mudw1ktb-0557816b` and `run-mudwci8d-de88aa32`, from
`test-runs/campaigns/ten-sites-r5/`, with their artifacts under
`F:\!FluxIQWebExtension\test-runs\instances\r5\`.

---

## Headline

Three separate things are going on, and only one of them is what the brief
assumed.

1. **The call count in the summary is wrong.** Run 1 made **16** real provider
   calls, not 22. Core counts trace rows, and one kind of decision writes two
   rows. The tokens are real; the call count is inflated by 27%.
2. **The reason each call is ~12,000 input tokens is repetition, not page
   evidence.** About **55% of every request is byte-for-byte identical to the
   previous request** — the node catalog, the tool descriptions, the decision
   schema, the instruction. The single largest item is the node catalog at
   ~18,159 bytes (~5,500 tokens), re-sent on every call and identical every
   time. None of it is arranged so a provider cache can hit it, and Core reads
   no cache-hit figure back.
3. **One reply cannot carry several node runs.** The loop is structurally one
   action per paid call. Nothing in the schema, the prompt or the executor
   supports a batch, so the model could not have used one.

96% of the money is input tokens (run 1: $0.0874 of $0.0907). The cheapest
correct fix is therefore about *how the same bytes are sent*, not about sending
fewer of them.

---

## 1. Can one model reply carry several node runs?

**No. The loop is one action per round trip, by construction.**

### The schema

`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\llm\evidence-loop-decision.ts`,
`buildAutomationStudioLlmEvidenceLoopDecisionSchema`. A decision is a `oneOf`
over exactly three shapes:

- `complete` — one result object.
- `amend_draft` — an array of up to `MAX_AMENDMENTS_PER_DECISION = 16`
  amendments.
- `tool_call` — **one** `callId`, **one** `toolId`, **one** `input`. There is no
  array.

```ts
...tools.map((tool) => ({
  type: "object", additionalProperties: false, required: ["kind", "callId", "toolId", "input"],
  properties: {
    kind: { const: "tool_call" }, callId: { type: "string", pattern: "^[a-zA-Z0-9_.:-]{1,200}$" },
    toolId: { const: tool.toolId }, input: structuredClone(tool.inputSchema)
  }
}))
```

### The executor

`runtime\llm\evidence-loop.ts` — the loop body handles exactly one `decision`
per `await input.decide(...)`. The only place a second execution could have
slipped in is the `amend_draft` → `rerun` path, and that path deliberately
refuses to batch. From `rerunRequest` in the same file:

> **One per decision.** Two reruns in one reply would be two calls, and a
> decision is one call; the rest of the reply's amendments are applied as usual,
> so nothing is lost by taking the first.

So: an `amend_draft` reply may edit sixteen draft steps at once, but it may
*execute* at most one of them. Everything that touches the page is one per paid
call.

### Is the capability described to the model?

There is nothing to describe. The batch capability does not exist, so the
absence from the prompt is correct rather than a prompt defect. For the record,
`AUTOMATION_STUDIO_LLM_EVIDENCE_DECISION_INSTRUCTION` and the `core.run_node`
description
(`runtime\llm\node-tools\run-node.ts`) both speak only in the singular — "Run
one node from the library", "Never repeat the same toolId with the same input".

This is the requirement on record
(`fluxiq-many-actions-per-model-turn`) and it is not implemented anywhere in the
build path.

**What it cost on these two runs.** Run 2's first four decisions were
`dismiss "Not now"`, `accept cookies`, `type into search`, `press Go` — one
obvious opening sequence, four paid calls, ~48,000 input tokens, ~$0.021. Run 1
spent two calls on `navigate` then `click "Continue shopping"`.

---

## 2. What is in the ~12,000 tokens of each call?

### How a request is built

`runtime\llm\deepseek-provider.ts`, `buildDeepSeekMessages`. Every call is a
**fresh, stateless two-message request**: a constant `system` string, and one
`user` message that is `JSON.stringify(providerUserPayload(request))`. There is
no assistant turn, no conversation history, and no incremental delta — the
model's own prior replies are not carried; what it did is re-derived from the
evidence window and the draft entry each time.

### Measured breakdown of one call

Measured by rebuilding the real payload from Core's and the domain's own code
(Core `dist`, domain `dist`, the web-automation registry, and the actual
instruction text of run 1). A call at a full evidence window:

| Part | Bytes | Share | ~Tokens | Varies per call? |
|---|---:|---:|---:|---|
| Evidence window (page packets, tool results) | 24,000 | 45.1% | 7,270 | **yes** |
| `flowBootstrap.nodeCatalog` + selection | 18,159 | 34.1% | 5,500 | no |
| `outputSchema` (the decision grammar) | 5,726 | 10.8% | 1,735 | barely |
| System prompt (incl. decision instruction) | ~2,240 | 4.2% | 680 | no |
| `evidenceLoop.tools` (descriptions) | 2,501 | 4.7% | 760 | no |
| `context.instructions` | 522 | 1.0% | 158 | no |
| `policyGates`, envelope | 193 | 0.4% | 58 | no |
| **Total** | **53,341** | 100% | **~16,160** | |

The observed averages land where this predicts once the window is partly full:
run 1 averaged ~13,000 input tokens per real call, run 2 ~11,900. Run 1's
evidence packets were 5,406 / 812 / 812 / 5,854 ×4 / 5,874 bytes
(`evaluation.json`), so the window carried three or four whole packets.

**Invariant material: 29,341 bytes, 55% of the request, ~8,890 tokens, sent
identically on every single call.**

### Is the whole page evidence re-sent every turn?

**Yes, in full, and by design.** `runtime\llm\context-window.ts`:

> A result leaves whole. It is never cut to fit, because half a page reads to a
> model as a page with half its controls.

The window keeps the newest result per tool whole, then older results newest
first, up to `AUTOMATION_STUDIO_EVIDENCE_CONTEXT_BYTES = 24_000`
(`runtime\loop-limits\flow-bootstrap-evidence-loop.ts`). Results that no longer
fit are replaced by a one-line account each. So evidence is *bounded* but never
*incremental* — the current page packet is retransmitted verbatim every turn.
Given the constraint in the brief, this is the right behaviour and should not be
touched.

### Is prompt caching in use?

**No — not requested, not arranged for, and not measured.**

- `grep -rn "prompt_cache\|cache_hit\|cache_miss\|cached_tokens"` over
  `F:\!FluxIQ\packages\fluxiq\src` returns **nothing**.
- `parseDeepSeekEnvelope` reads only `prompt_tokens`, `completion_tokens`,
  `total_tokens`. DeepSeek's `prompt_cache_hit_tokens` /
  `prompt_cache_miss_tokens` are ignored.
- `estimateAutomationStudioDeepSeekCostUsd` prices **all** input at
  `AUTOMATION_STUDIO_DEEPSEEK_PEAK_CACHE_MISS_INPUT_USD_PER_MILLION_TOKENS =
  0.44`. The constant is named for the miss rate and no hit rate exists in the
  code.
- Worse, **the payload's key order defeats prefix caching at the earliest
  possible point.** `providerUserPayload` emits, in order:
  `taskKind`, `promptVersion`, `expectedOutput`, `outputSchema`, then
  `context.{schemaVersion, projectId, flowId, instructions}`, then
  `evidenceLoop.{iteration, tools, evidence}`, then `policyGates`, then
  `flowBootstrap`.

  Measured byte offsets in the serialized user message:

  ```
      141  "outputSchema"
     5945  "instructions"
     6483  "evidenceLoop"
     6499  "iteration"      <-- first per-call-varying value
     6513  "tools"
     9023  "evidence"
    32663  "flowBootstrap"
    32680  "nodeCatalog"
    50840   total user-message bytes
  ```

  `"iteration": N` changes on every call and sits at byte 6,499. **20,341 bytes
  of identical material — the tool descriptions and the whole node catalog — sit
  behind a counter.** Only the system message plus the first 6,499 bytes can be a
  stable prefix today: ~17% of the request. Reordering alone would make it ~55%.

---

## 3. The 26 "executed actions" in run 1

The classification in the brief needs correcting. The 26 are not 26 browser
actions the model chose; they are the 26 declarations that passed the action
gate, and they come from three different places. Full sequence, from
`snapshots/live-llm.json` → `build.declaredConsequences`:

```
 1  exploration_step  core.run_node  nav.search.1      navigate
 2  exploration_step  core.run_node  click.continue.1  click "Continue shopping"
 3  exploration_step  core.run_node  extract.list.1    extract list
 4  exploration_step  core.run_node  extract.list.2    extract list
 5  exploration_step  core.run_node  rerun.6           extract list
 6  exploration_step  core.run_node  rerun.7           extract list
 7  exploration_step  core.run_node  rerun.5           extract list
 8  exploration_step  core.run_node  rerun.9           extract list
 9  flow_step  web.output.browser-navigate    main.s1   open
10  flow_step  web.output.dom-click           main.s2   press "Continue shopping"
11  flow_step  web.output.dom-extract_list    main.s3   run
12  flow_step  web.output.dom-extract_list    main.s4   run
13  exploration_step  core.run_node  dryrun.1.reset    go to page
14  exploration_step  core.run_node  dryrun.1.2        navigate
15  exploration_step  core.run_node  dryrun.1.3        click
16  exploration_step  core.run_node  dryrun.1.5        extract list
17  exploration_step  core.run_node  dryrun.1.8        extract list
18  flow_step  web.output.browser-navigate    main.s1   open
19  flow_step  web.output.dom-click           main.s2   press "Continue shopping"
20  flow_step  web.output.dom-extract_list    main.s4   run
21  flow_step  web.output.dom-extract_list    main.s5   run
22  exploration_step  core.run_node  dryrun.2.reset    go to page
23  exploration_step  core.run_node  dryrun.2.2        navigate
24  exploration_step  core.run_node  dryrun.2.3        click
25  exploration_step  core.run_node  dryrun.2.5        extract list
26  exploration_step  core.run_node  dryrun.2.8        extract list
```

Classified:

| Group | Count | Paid calls | Verdict |
|---|---:|---:|---|
| Model-decided live node runs (1–8) | 8 | 8 | see below |
| Permission-gate checks of the *proposed plan* (9–12, 18–21) | 8 | 0 | correct — these never touched a browser |
| Dry-run replays of the draft (13–17, 22–26) | 10 | 0 | correct — Core replays the draft with no model attached (`runtime\flow-draft\dry-run.ts`) |

**Nothing was executed and then wrongly dropped from the Flow.** Of the 8
model-decided node runs, 4 became the Flow's 4 action nodes (navigate, click,
two extractions). The other 4 — `rerun.6`, `rerun.7`, `rerun.5`, `rerun.9` — are
the same extraction node's parameters being corrected four times, each one a
full paid call. They are not "steps the Flow needs and does not have"; they are
**four paid attempts at one step's arguments**.

The corrections did not succeed: the Flow returned 24 rows where 13 were
expected, with 0 matched (`evaluation.json`, `snapshots/extraction-mismatches.json`),
i.e. the "rated 4.0 or higher and under $50" filter was never applied. That is a
correctness thread, not a cost thread, but it is where ~4 of run 1's 16 calls
went.

Run 2, same shape: 25 declarations = **5** model-decided node runs + 9 plan-gate
checks + 11 dry-run replay steps.

### The call count itself is wrong

`runtime\service\flow-bootstrap-commands\evidence-trace.ts`:

```ts
const providerDecisions = clean.filter((item) => item.iteration > 0);
...
providerCallCount: providerDecisions.length,
decisionCount: providerDecisions.length,
```

It counts **trace rows**, not iterations. An `amend_draft` decision carrying a
`rerun` pushes *two* rows in one iteration (`evidence-loop.ts`: the `amend_draft`
row, then the `tool_call` row after the rerun executes). Run 1's trace has 20
rows, 4 of them `llm_evidence_loop.draft_rerun`, each immediately followed by a
`core.run_node` row — so the loop made **15** paid decisions, not 19, plus 1
instruction-authority call = **16 real provider calls**, reported as 22. Run 2
has no reruns, so its 14 is correct.

The Lab faithfully echoes Core's number:
`packages\test-runner\src\live-llm\build-usage.ts` — `const calls =
build.providerCalls ?? ...`, which is Core's `totalProviderCallCount`. So this is
a Core reporting defect, not a Lab one. Corrected per-call figures:

| | Reported calls | Real calls | Input tokens | Input tok/call |
|---|---:|---:|---:|---:|
| run-mudw1ktb | 22 | **16** | 198,640 | **~12,400** |
| run-mudwci8d | 16 | **14** | 167,084 | **~11,900** |

### Calls that produced nothing usable

Run 1 (3 of 15 loop calls): `llm.provider_output_invalid`,
`llm_evidence_loop.dry_run_refused`, `llm_output.invalid_evidence_decision`.

Run 2 (5 of 13): `web.action.rejected.page_unreadable`, then **two**
`llm_evidence_loop.already_answered`, then `web.action.rejected.target_unobserved`,
then `dry_run_refused`.

Run 2's pair of `already_answered` is a genuine loop defect, not model error —
see fix F below.

---

## 4. The cheapest correct fixes, ranked

None of these caps the loop, shortens the evidence, or reduces what the model is
allowed to do. **Five of the six are FluxIQ Core; one is this repository.**

### A. Make the invariant half of the request a contiguous cache prefix — **Core**

**File:** `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\llm\deepseek-provider.ts`
— `providerUserPayload()` and `buildDeepSeekMessages()`.

**Change:** emit the constant material first and the varying material last.
Order: `taskKind`, `promptVersion`, `expectedOutput`, `instructions`,
`evidenceLoop.tools`, `flowBootstrap` (the node catalog), `policyGates`, then
`outputSchema`, then `evidenceLoop.iteration` and `evidenceLoop.evidence`.
Cleaner still: move the whole constant block into a second `system` message, so
it is unambiguously a prefix and cannot be reordered back by accident.

**Saves:** 29,341 of 53,341 bytes per call (~8,890 of ~16,160 tokens) become a
reusable prefix instead of ~8,900 bytes today. If DeepSeek's cache-hit input
price is roughly a tenth of the miss price, the input bill — 96% of the total —
falls by about half: run 1 ~$0.094 → ~$0.050, run 2 ~$0.078 → ~$0.042. Prefill
time should fall too, which would take a bite out of the 8m31s / 7m28s, though I
have not measured that.

**Could break:** `validEvidenceLoopContext` and `validFlowBootstrapContext` in
the same file re-derive and compare the decision schema; they read by key, not by
order, so they are safe. `estimateAutomationStudioDeepSeekInputTokens` measures
total bytes and is unaffected. The provider tests
(`runtime\llm\tests\evidence-loop-provider.test.ts`,
`deepseek-evidence-preflight.test.ts`) assert payload contents and may need
updating if any of them compares a serialized string. One real caveat:
`outputSchema` is *not* perfectly constant — it changes when `canAmend` flips and
on the final decision when tools are withdrawn — which is why it belongs at the
end of the constant block rather than at its head.

**This is the single highest-value change and the lowest-risk one.**

### B. Read and price the cache figures — **Core**

**File:** same file — `parseDeepSeekEnvelope` (reads `usage`) and
`estimateAutomationStudioDeepSeekCostUsd`.

**Change:** read `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens` into the
usage summary and price them separately; add the hit rate as a named constant
beside the existing `...PEAK_CACHE_MISS_INPUT_USD_PER_MILLION_TOKENS = 0.44`.

**Saves:** nothing directly. Without it, nobody can tell whether fix A worked, and
every cost figure in every campaign is an over-estimate of unknown size.

**Could break:** `validUsage` in `evidence-loop-decision.ts` holds the usage
object to an exact key list, and `sanitizedBootstrapAccounting` in
`flow-bootstrap\review-projection.ts` writes it out field by field. Both must
learn the new fields or the decision is rejected as unusable. Small, but it
touches a strict validator, so it is a change to make carefully.

Do A and B together; B is how A is proved.

### C. Stop a refused tool result from blocking its own retry — **Core**

**File:** `F:\!FluxIQ\...\runtime\llm\evidence-loop.ts`, the block around
`answeredRequests.set(toolRequestSignature, callId)`.

**The defect.** The signature is registered before the call runs and deleted only
if the call *threw* or returned something unreadable. A call that returns
correctly but carries a rejection — `{ ok: false, code: "..." }`, e.g.
`web.action.rejected.page_unreadable` — stays registered as having *answered* the
request. The identical retry is then refused with
`llm_evidence_loop.already_answered` and never run, and the model is pointed at an
evidence entry that is a refusal carrying nothing.

`repeat-policy.ts` already argues the right principle in its own header — "a look
repeated after a failed action is a new question" — but only for a look after
*another* action failed, not for a look that itself failed. `attemptEpoch` moves
only for a `mutate` record, so a failed observation leaves the world's key
unchanged.

**Change:** when the execution result's `resultCode` marks a rejection and
`effectApplied` is false, delete the signature as the throw path already does.

**Saves:** 2 of run 2's 14 calls — ~24,000 tokens, ~$0.011, ~14% of that run. It
also nearly ended the build: two `already_answered` in a row each increment
`stepsWithoutProgress`.

**Could break:** it loosens the repeat guard, so a tool that fails
deterministically on the same input could be retried indefinitely. The
no-progress guard still bounds it, but `answerRequest`'s
`stepsWithoutProgress` accounting would no longer see those retries, so the
guard's counter needs to pick them up on the failure path instead
(`toolFailed` already does `stepsWithoutProgress += 1`; the rejection path
currently calls `progressed()` and resets it — that is the part to get right).

### D. Let one reply carry several node runs — **Core**

**Files:** `runtime\llm\evidence-loop-decision.ts` (the schema — either a
`tool_call` variant carrying an ordered array, or let `amend_draft` execute more
than one `rerun`), `runtime\llm\evidence-loop.ts` (run the batch step by step
through the same `executeTool`, stop at the first failure or refusal and feed
back what ran), `runtime\llm\node-tools\run-node.ts` (describe the capability in
the tool's own words), and `deepseek-provider.ts`'s `validEvidenceLoopContext`,
which re-derives and compares the schema Core sent.

**Saves:** 3 calls on run 2 (its four opening presses), 1 on run 1 — roughly 20%
and 7% of those runs. This is the requirement on record and the right thing to
build; it is simply worth less in tokens than fix A, because a batch removes
whole calls while fix A removes half of *every* call.

**Could break:** more than anything else here. The loop's entire safety model is
one call per decision — the permission gate, the state digest either side of a
step, the mutation and attempt epochs, the repeat signature, the no-progress
guard and the draft all key off it. A batch that runs past a permission refusal
would be a serious regression. It must execute strictly sequentially, advance
the epochs per step, and abandon the remainder the moment a step is refused or
fails. Build it after A, B and C.

### E. Count provider calls, not trace rows — **Core**

**File:** `runtime\service\flow-bootstrap-commands\evidence-trace.ts`,
`evidenceTraceAuditDetail`.

**Change:** count distinct `iteration` values above zero, not rows.

**Saves:** no money. It is why the brief's premise said 22 calls when 16 were
made, and it silently inflates every per-call figure anyone computes.

**Could break:** that file's own comment warns that a downstream reader
(`packages\test-runner\src\existing-fluxiq-control.ts`, in this repository) holds
the record to `decisionCount === providerCallCount` and `iterationCount` within
one of it. Both counts move together here, so the equality holds, but
`iterationCount` (total rows) would then sit up to four above them and that
reader's tolerance must widen in the same work unit.

### F. The four extraction reruns — **this repository**

**Files:** `domain\src\output-nodes\extract-list\` (the `where` vocabulary and
its numeric bounds) and its catalog text in `catalog-text.ts`; the tool prose in
`domain\src\runtime\llm-evidence\tools.ts`.

Run 1 spent 4 of its 16 calls rerunning one extraction node's parameters and
still shipped a Flow that returned 24 rows instead of 13, with the value filter
unapplied. The catalog tells the model it may bound a numeric column with
`atLeast` / `atMost` / `lessThan` / `greaterThan`, and the instruction asked for
exactly that ("rated 4.0 or higher", "under $50"). Whether those bounds can read
`$49.99` and a star rating is the question to answer; if they cannot, the model
has no way to express the filter and will always burn calls discovering that.

**Saves:** up to 3 calls on run 1 (~36,000 tokens, ~$0.016), and — much more
importantly — it is the difference between a Flow that answers and one that does
not.

**Could break:** parsing more shapes out of a column risks matching the wrong
number in text like "3.7 out of 5 stars, 412 reviews". Needs its own tests
against the fixture rows already captured in
`snapshots\extraction-mismatches.json`.

### Not recommended

**Trimming or paging the node catalog.** It is 34% of every request and 100%
invariant, which makes it tempting. But the model needs an entry's parameter text
to write a node it has not used yet, so cutting it, or hiding it behind a tool
call, removes capability to save bytes — exactly what the brief rules out. Fix A
makes it nearly free without taking anything away. Leave it whole.

**Shrinking the evidence window.** Same reasoning, and `context-window.ts`
already documents a live build that failed because the page it had to write the
Flow from had been pushed out of an 8,000-byte window.

---

## Commands run and what they printed

All read-only. Measurement scripts were written to the session scratchpad, not
to either repository.

- `node` against `F:\!FluxIQ\packages\fluxiq\dist\...\automation-studio\index.js`
  and `F:\!FluxIQWebExtension\domain\dist\index.js`, building the real registry
  (`registry.registerImporterManifest(dom.createWebAutomationOutputNodeManifest())`)
  and the real catalog with run 1's own instruction text:
  - `registry.list -> 59 definitions; 18 web`
  - `catalog byteBudget 42132`
  - `nodeCatalog entries 25 of 59 | bytes 17997 | truncated true`
  - `flowBootstrap block bytes 18159`
  - `run_node tool bytes 4251 ( enum of 59 ids )`
  - `decisionSchema allowAmend=false 2625 bytes` / `allowAmend=true 4759 bytes`
  - `completionSchema(draft) 452 bytes`, `amendmentSchema 1942`,
    `flowBootstrapOutputSchema 3546`, `decisionInstruction 1661 chars`
- Same script, serializing a full payload in `providerUserPayload`'s own key
  order and reporting offsets — the table under "Is prompt caching in use?"
  above. Total user message 50,840 bytes; `"iteration"` at offset 6,499; 20,341
  invariant bytes stranded after it.
- `grep -rn "prompt_cache\|cache_hit\|cache_miss\|cached_tokens" --include=*.ts F:\!FluxIQ\packages\fluxiq\src`
  → no matches. Only `dist` and `src` occurrences of
  `AUTOMATION_STUDIO_DEEPSEEK_PEAK_CACHE_MISS_INPUT_USD_PER_MILLION_TOKENS`.
- `python` over `run-*/snapshots/live-llm.json`, `flow-lane.json`,
  `evaluation.json`, `extraction-mismatches.json` for the accounting, the
  evidence-loop step list and the declared-consequence sequences quoted above.
- Cost arithmetic against Core's own constants (0.44/M input, 1.32/M output)
  reproduces both runs' recorded `estimatedCostUsd` to the cent, confirming the
  input/output split: run 1 $0.0874 input + $0.0033 output = $0.0907.

## Not verified

- **DeepSeek's actual cache-hit price and its exact prefix-matching rules.** Core
  encodes no hit rate and reads no hit figure, so "roughly a tenth" is from
  general knowledge of DeepSeek's pricing, not from anything in either
  repository. Fix B is what would settle it. The size of fix A's saving depends
  on that ratio; the *share of the request that becomes cacheable* — 17% → 55% —
  is measured and does not.
- **Whether any caching is happening today.** DeepSeek's context caching is
  automatic, so the ~8,900-byte stable head may already be hitting. Nothing in
  the artifacts records it.
- **The exact per-call token split.** Core records no per-call payloads
  (`perCallRecords: "not recorded"`), so the breakdown table is a reconstruction
  from Core's and the domain's own code, calibrated against the recorded totals.
  It lands within a few percent of both runs' observed averages.
- **The 16-real-calls figure for run 1** is derived from the loop's code (an
  `amend_draft` + `rerun` writes two trace rows in one iteration) plus the four
  `draft_rerun` rows in the published step list. Iteration numbers are stripped
  by `automationStudioFlowBootstrapEvidenceSteps` before publication, so it is
  not directly readable from the artifact.
- **Wall-clock effect of any fix.** Not measured. No run of any kind was
  launched.
- The token estimate uses 3.3 bytes per token for minified JSON; Core's own
  conservative estimator uses 3.

## Open questions

1. Fix A's ordering and fix B's usage fields are both in
   `deepseek-provider.ts`, and `validUsage` in `evidence-loop-decision.ts` is a
   strict exact-key check on the usage object. Does the supervisor want those as
   one unit of work? They are hard to separate.
2. Fix C changes when a retry is allowed. The no-progress accounting on the
   rejection path currently calls `progressed()`, which resets the counter — so
   the fix needs a decision about whether a rejected observation counts as
   progress. It arguably does (the model learned the page was unreadable) but
   then two of them in a row cost nothing toward the guard.
3. Fix E's downstream reader is in this repository
   (`packages\test-runner\src\existing-fluxiq-control.ts`), so that fix crosses
   the repository boundary in one work unit.
