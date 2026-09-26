# t155 — An assumed column says so

## Outcome

**Partial, and the partiality is the finding.** The drop the brief named is
closed: `resolve-plan-node.ts` no longer throws the assumption away, and the
whole chain from t149's guess to a screened, wire-shaped
`{path, written, field, how, score}` is built and tested.

**It cannot reach a run artifact from this repository, and emitting it would have
broken every live build.** Core reads the domain's execution result against an
**allow-list of keys** and its own comment says what one key too many costs:

> "a member a caller learns to report and this check has not learned is **not**
> an execution result arriving with a field too many — it is the whole result
> refused as `llm_evidence_loop.tool_result_invalid`, and the call is recorded as
> a failure that never happened."
>
> — `F:\!FluxIQ\...\runtime\llm\evidence-loop-decision.ts`, on the `exactKeys`
> call at line 62

Not the field dropped: **the call**. Every node run of every live exploration
would have been recorded as a failure that never happened. The same is true one
layer down for the resolver's own answer, where Core requires *exactly*
`["status", "parameters"]`.

So the deliverable is: the fact produced and screened right up to the boundary,
the boundary's constraint written down in code for the first time, a test that
fails the moment a result grows a key Core cannot read, and section 5's Core
brief — file, function, and what each must carry.

I did **not** touch `actions/extraction/summary.ts`. Section 4 says why the
extraction summary is the wrong channel; there is no collision with t153.

---

## 1. Where `assumed` is produced, and where it was dropped

Two producers, both from the same standing rule, both computing the same shape.

| | Literal request path (t142) | Detected path (t149) |
| --- | --- | --- |
| Produced by | `domain/src/actions/extraction/field-match.ts`, collected in `read-request.ts:155` | `plan-resolution/extraction/column-match.ts`, collected in `columns.ts:144`, `conditions.ts:123`, `slot.ts:135` |
| Shape | `WebAutomationExtractListFieldAssumption` — `{index, written, field, how, score}` (`read-request.ts:127`) | `WebExtractionColumnAssumption` — `{path, written, field, how, score, among}` (`column-match.ts:86`) |
| **Dropped at** | `read-request.ts:89` — `webAutomationExtractListRequestValue` returns `read.request` and discards `dropped` and `assumed`. Its two production callers are `output-nodes/extract-list/dispatch.ts:57` and `client/gateway-action-parameters.ts:86`, so **neither ever sees it**. Outside the tests, nothing in the repository reads that `assumed` at all. | `plan-resolution/resolve-plan-node.ts:297` (before this task) — `if (slot.status === "resolved") replaced.set(key, {...})`. The slot's `assumed` was in scope and never read; `NodeOutcome` had no member for it. |

The detected path is the one that matters live: it is the path the extraction
node's authoring text steers a model towards, and it is the one t149 measured on
run 8's own words.

## 2. What now carries it, file by file

### 2.1 `runtime/llm-evidence/name-assumption.ts` — new

The wire shape and the screen. `WebLlmNameAssumption` is
`{path, written, field, how, score}` — t142's and t149's four facts in their own
words, with the position rendered as a dotted path from the node's parameters
(`extractList.fields.price`, `extractList.where.0`).

**What may travel.** Every string is held to **Core's own shape for a
caller-supplied diagnostic**, `/^[A-Za-z0-9_.:-]{1,100}$/` — the `ISSUE_CODE`
that screens `resultReason`. It admits a column key and a parameter path and
admits no whitespace, so no page sentence, no page text and no selector can be
spelled in any member. That is the argument
`packages/test-contracts/src/extraction-read/read.ts` already makes for
publishing a read's field keys: these names are already published in full under
`authoredNodes[].parameters`, so this is a subset of what the bundle holds rather
than a new class of string.

**One assumption is deliberately dropped**: a column named as a table *header*
(`column:Unit price`) resolves by header, and a header is the page's own words.
Its written name holds a space, fails the screen, and the entry does not travel.
A header written as one token does.

`score` is rounded to three places — the precision t142 and t149 state their
measurements at — so a similarity cannot become a channel of its own. At most
`MAX_WEB_LLM_NAME_ASSUMPTIONS = 16` travel, which is Core's own bound on the
codes one refusal carries and the refusals one trace row keeps. Absent, never
empty, for a call that assumed nothing.

### 2.2 `plan-resolution/resolve-plan-node.ts` — the drop, closed

`WebPlanNodeResolution` keeps exactly the four variants Core accepts and gains a
doc block saying why nothing may be added to it. Beside it:

```ts
export type WebPlanNodeOutcome = { resolution: WebPlanNodeResolution; assumed: WebLlmNameAssumption[] | undefined };
```

- `resolveWebPlanNode(input, stores)` is the new entry point and returns both.
- `resolveWebPlanNodeParameters` — Core's, through `tools.ts` — is now one line
  returning `.resolution`. **The narrow answer is built by construction, not by
  stripping a wider one**: `resolveWebPlanNode` rebuilds
  `{ status: "resolved", parameters }` by name, so a member added to the internal
  outcome cannot reach Core.
- `resolveNode` collects the slot's assumptions with the parameter's own key in
  front of the slot path; `resolveRunOutput` puts `parameters.` in front again, so
  a name assumed inside Core's Run Output payload is reported where a reader
  holding that node's authored parameters will find it.
- A step refused for an undeclared consequence, and one that needs permission,
  both still report what they assumed: the guess happened whatever became of the
  step.

### 2.3 `node-run/run.ts` and `node-run/replay.ts`

Both switch to `resolveWebPlanNode`. `run.ts` gains a named
`WebNodeCallRecord` type, and `record.assumed` is set the moment the resolution
returns, so **every** answer after it carries the guess — the success, a missing
declaration, a permission the person has not given, another origin, and the
page's own failure, which arrives as an exception caught outside the block the
resolution ran in. Threading it through ten call sites instead would mean the one
site somebody forgot silently lost the guess, which is the shape of defect this
task exists to close.

`replay.ts` carries it on all four post-resolution answers, including the one
that replayed cleanly.

### 2.4 `capture.ts` — the declaration, and the withholding

`WebLlmEvidenceToolExecution` gains `assumed?: WebLlmNameAssumption[]`, beside
`resultReason` and `nodeId`, which are the precedents: a fact this domain
computes, Core carries and never reads.

`WebLlmEvidenceToolCallFacts` — what a caller writes — now has **every member
mandatory and possibly `undefined`**, the pairing `present.ts` uses. That is not
cosmetic: it found a call site I had not (`harness-options/execute.ts:124`) as a
compile error rather than as a silently absent field.

New, and the most important thing in the diff:

```ts
export const WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS: readonly string[] = [
  "kind", "evidence", "effectApplied", "targetsUnchanged", "resultCode", "resultReason", "nodeId", "draft"
];
```

Core's allow-list, restated on the producing side, with its comment quoted and
the cost named. `toolExecution` ends in one private `readable()` that removes any
member Core has not learned. Today that is exactly `assumed`. **Widening the list
is one entry here, after Core's list has learned the same key, never before.**

## 3. The constraint nobody had written down, and why it is the real deliverable

This loop has now found the same defect five times — a reason computed at one
layer and discarded at the boundary above it. The brief said to close it here.
What I found is that **the boundary is not a leaky projection; it is a closed
door, and pushing on it breaks the building.** Both of Core's readers are
allow-lists:

| Core reader | Checks | What one unknown key does |
| --- | --- | --- |
| `runtime/llm/harness-options/plan-parameter-resolution.ts:223` | `exactKeys(answer, ["status","parameters"])`, an **equal-length** check | The node is refused `bootstrap.parameter_resolution_invalid`. Every resolved node of every plan fails validation. |
| `runtime/llm/evidence-loop-decision.ts:62` | `exactKeys(value, ["kind","evidence","effectApplied","targetsUnchanged","resultCode","resultReason","nodeId","draft"])`, an **allow-list** | The whole execution result is refused `llm_evidence_loop.tool_result_invalid` and the call is recorded as a failure that never happened. |

Nothing in this repository encoded either fact before today. A field added to
`WebLlmEvidenceToolExecution` in good faith — declared, produced, tested at unit
level — would have passed `pnpm check`, passed 837 domain tests, and destroyed
the next live run, reporting every node call as a failure. The new list and its
test are the guard for every future field, not only this one.

## 4. Why the extraction summary is the wrong channel (I did not edit `summary.ts`)

The brief asked me to check before touching it. The answer is no, on the same
grounds t142 recorded:

- `webAutomationExtractionSummaryValue` reads a value **the page sent back**. The
  summary's producer is the content script.
- Both assumptions are made **in the domain**: t149's before the request is
  dispatched at all, t142's while reading a request the page has not seen. The
  page cannot report a guess it was never told about, and putting one on the
  summary would mean the domain writing into a channel whose whole point is that
  the page owns it.

So `summary.ts` is untouched and t153 has it to itself.

## 5. The remaining hops, precisely

### 5.1 To make the execution result carry it (closes the detected path)

In `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\`, in this
order:

1. **`llm/evidence-loop-decision.ts`** — add `"assumed"` to the `exactKeys` list
   in `automationStudioLlmEvidenceParseToolExecutionResult` (line 62), widen the
   function's return type, and carry the value **screened rather than fatal**, as
   `resultReason` and `nodeId` already are: an entry that is not
   `{path, written, field, how, score}` with code-shaped strings is dropped, and
   the call still stands. **This must land before this repository adds `"assumed"`
   to `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`.**
2. **`llm/evidence-loop/tool-execution.ts`** — declare `assumed` on
   `AutomationStudioLlmEvidenceToolExecutionResult` (beside `resultReason`, line 28).
3. **`llm/evidence-loop/trace.ts`** (the row type, `resultReason?: string` at
   line 43) and **`llm/evidence-loop/call-record.ts`**
   (`automationStudioLlmEvidenceCallDiagnostic`, line 23) — carry it onto the
   decision row.
4. **`flow-bootstrap/evidence-loop-steps.ts`** — the step type (line 95), the
   projection (line 188), `EVIDENCE_STEP_FIELDS` (line 254) and the second
   projection (line 286). This file copies a fixed field list, so a field absent
   from it is dropped at the published step — the exact hop t146 had to fix for
   `amendmentsRefused`.
5. **`service/flow-bootstrap-commands/evidence-trace.ts`** (around line 97) — the
   stored record's rebuild, the fourth place a row is reassembled member by
   member. Also t146's file.
6. **This repository**: add `"assumed"` to
   `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS` in
   `domain/src/runtime/llm-evidence/capture.ts`, and change the two rows in
   `domain/src/runtime/llm-evidence/tests/name-assumption.test.ts` that assert it
   is withheld. Then declare it in `packages/test-contracts/src/` on whatever row
   carries `resultReason`, so the Lab's validation holds the producer to it.

### 5.2 Core already has a home for this, and nothing reads it

`runtime/flow-bootstrap/plan/name-correction-assumption.ts` declares
`AutomationStudioFlowBootstrapNameAssumption` with
`kind: "parameter_name"`, `how: "normalized" | "nearest"`, `score`, `writtenName`
and `valueShape` — the same four facts — and its own comment invites a second
kind: *"One kind today; a node id resolved the same way would be a second, so
readers switch on this rather than assuming every assumption is about a
parameter."* A name resolved **inside** a parameter value is that second kind.

But: `plan/validation.ts:109` puts `assumptions` on the validated plan and
**nothing in Core reads it** — the only references outside `name-correction.ts`
are its own tests. So Core's own name-correction assumption reaches no artifact
either. Whoever takes the Core task should close both with one publisher, and
that is the most valuable single change left on this rung.

### 5.3 The literal/dispatch path (t142's `assumed`) has no channel at all

`read-request.ts`'s `assumed` is dropped by
`webAutomationExtractListRequestValue`, and both its callers
(`output-nodes/extract-list/dispatch.ts:57`, `client/gateway-action-parameters.ts:86`)
are places with **no diagnostic channel**: the first returns a dispatch payload,
the second reads a command inside the browser. Its honest route is a dispatch
effect Core carries, or the extraction summary once the *page* can be told a
guess was made. It is not blocked on the same hops as 5.1 and it is a separate
task. In practice it fires rarely on a built Flow — plan resolution rewrites
`extractList` into a literal request whose `where` names the plan's own kept keys,
so they match exactly — and mostly for a recorded or hand-written Flow.

### 5.4 Two things this task does not reach

- **A refusal's own packet.** A call refused *before* resolution assumes nothing,
  so nothing is lost. A call refused *after* it now carries the assumption on the
  execution result (withheld), but the `WebLlmToolRejection` the model is handed
  does not mention it, and deliberately: a refusal must not grow a side channel.
- **An amended draft.** If the model amends a node's `fields` after the node run
  (t140's path), plan resolution guesses again over the amended value and the
  exploration's recorded assumption is no longer the one the Flow was built on.
  Publishing the plan-resolution assumption (5.2) is what closes that; the node
  run's own record cannot.

## 6. Commands run and observed results

All from `F:\!FluxIQWebExtension`. Nothing repository-wide was run.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain test` (**baseline, before any edit**) | `# tests 832 / # pass 832 / # fail 0`, exit 0 |
| `pnpm --filter @fluxiq-web-extension/domain test` (final) | `# tests 837 / # suites 0 / # pass 837 / # fail 0`, exit 0 |
| `pnpm --filter @fluxiq-web-extension/domain check` (final) | exit 0 (`tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`) |
| `node scripts/structure-audit.mjs` (**baseline**) | exit 1 — `2 violation(s) across 1 rule(s)` |
| `node scripts/structure-audit.mjs` (final) | exit 1 — `2 violation(s) across 1 rule(s)`, **the same rule, both pre-existing, neither in a file I touched** |

**The brief's floor was 828 (t149's number); the tree's actual baseline was 832**
— four tests landed from other workers between t149 and me. I measured the
baseline myself before editing rather than trusting the figure, and 837 is 832
plus my five.

### The structure-audit findings

Both are `[working-docs]` and both are the supervisor's, as the brief says:

1. `FAIL [working-docs] docs/working/language-driven-flow-loop-plan.md: "## Current State" is 173 lines, over the 150-line budget.`
2. `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks.`

The first one's *message* changed while I worked — at my baseline run it read
`802 lines exceeds the 800-line compaction threshold`, then `163 lines`, then
`173 lines`, because the supervisor is editing that file concurrently. The count
(2) and the rule (1) are identical before and after my change.

The two findings t149 recorded are both gone: `run-scenario.ts` is now 688 lines
and no longer a `FAIL`, so that split landed. The audit also says `1 baseline
entries can be lowered`; I did **not** run `pnpm structure:baseline`.

**No FAIL in my files, and every advisory in them was already red.**
`resolve-plan-node.ts` 410 → 492 lines, `run.ts` 584 → 619, both past the 400-line
advisory before I started. `domain/src/runtime/llm-evidence/` 22 → 23 source
files, past the 15-file advisory before my file existed. `capture.ts` appears in
no finding. The `contract-spread` rule, which covers this whole directory, reports
nothing: `name-assumption.ts` and every value I added are written member by
member.

## 7. Tests added

`domain/src/runtime/llm-evidence/tests/name-assumption.test.ts` — new, 5 tests.
It sits in `llm-evidence/tests/` because its subject spans `name-assumption.ts`,
`plan-resolution/resolve-plan-node.ts` and `capture.ts`, and that is the `tests/`
folder of the nearest directory holding all three.

- **a near match survives the resolver** — run 8's own words (`name`, `price`,
  `rating`) over the captured `product-catalog` columns, coming back as
  `extractList.fields.name → product-name, nearest, 0.733` and its two
  neighbours; a `normalized` variant (`productName`, score 1); and a condition's
  column at its own position;
- **an exact match assumes nothing** — `assumed` is `undefined`, not `[]`, and a
  node with no handle is `{ resolution: { status: "unchanged" }, assumed: undefined }`;
- **the answer Core reads has exactly `["parameters","status"]`** — checked both
  with an assumption in hand and without one;
- **an execution result carries no key Core's reader has not learned** — through
  the real runtime, detection tool and node run, asserting every key of the
  result against `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`, that `assumed` is the
  member withheld, and that the resolver reported two assumptions for the very
  call whose result carries none;
- **the screen** — what may be spelled (separators, dots, colons), what may not
  (a header phrase, `column:Unit price`, a whole selector, a name over 100
  characters, a path segment with a space), the three-place score, a `how` outside
  the vocabulary, a score outside 0..1, `NaN`, and the 16-entry cap keeping the
  first entries made.

Two measurements corrected against t149's own table while writing these, worth
recording because both look like they should resolve and do not: **`ratings`
resolves to nothing** (only `product-ratings` does, at 0.933) and **`prce`
resolves to nothing** (only `product-prce` does, at 0.923). A typo of a *short*
name shares no token with a long detected key. And the condition path's
assumption is recorded at `extractList.where.0`, not `…where.0.field`:
`conditions.ts` names the clause rather than the key inside it, one step coarser
than a `fields` entry. All three are measured, not assumed, and are now asserted.

## 8. Not verified

- **No live run, and no browser.** That an `assumed` entry a reader sees really
  corresponds to the column a person meant is argued from the specs, not measured.
- **`assumed` reaches no run artifact.** It is produced, screened, and withheld at
  one named line. Nothing in `test-runs/` will show it until section 5.1 lands.
  This is the honest state and it is the brief's item 2 left open, with the reason.
- **I did not run the extension build.** My files are under
  `domain/src/runtime/llm-evidence/`, which the extension's entry point
  (`@fluxiq-web-extension/domain/client`) does not reach, and
  `name-assumption.ts` imports nothing — so no new value import crosses the
  extension's barrier. Another worker is editing `apps/extension/src/`, so a build
  would have reported their tree rather than mine.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run whole**, as instructed.
- **Core's readers were read, not exercised.** I read
  `plan-parameter-resolution.ts` and `evidence-loop-decision.ts` and both
  `exactKeys` implementations at `F:\!FluxIQ`, and edited nothing there. That
  emitting `assumed` today *would* refuse a call is read off that source and off
  Core's own comment saying so; I did not prove it by running Core.
- **The scores in the tests are Core's current output**, pinned as literals, like
  t149's. A change to Core's similarity function or floor fails these rows, which
  is intended — they are the measurement.
- **No architecture document was updated.** None enumerates the execution
  result's members: `docs/architecture/testing-facility.md` names
  `llm_evidence_tool_execution` and `resultCode` only, and `resultReason` and
  `nodeId` were added by t145/t146 without a change there. A withheld member is
  less than either. Section 5 is where the next reader needs the detail, and it is
  in this report.

## 9. Open questions or contradictions found

1. **The brief's item 2 cannot be satisfied from this repository, and attempting
   it would have broken the next live run.** That is the headline. The brief is
   right that this is the same defect a fifth time; it is wrong that this side of
   the boundary is where it can be closed. Section 5.1 is the task that closes it,
   in Core, and it is now a brief rather than a rediscovery.
2. **Core computes a name assumption already and publishes it nowhere**
   (`flow-bootstrap/plan/validation.ts:109`, read by nothing but its own tests).
   So the same hole exists in Core for Core's own corrected *parameter* names.
   One publisher closes t142's shape, t149's, and Core's at once, and that is the
   argument for doing 5.2 rather than only 5.1.
3. **`WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS` is a second copy of a Core list,
   and copies drift.** I judged the trade worth it — the same judgement
   `packages/test-contracts` makes when it restates Core's bounds "because this is
   the side that checks rather than the side that produces" — but the honest risk
   is that Core widens its list and this one is never widened, leaving the field
   withheld forever with nothing going red. A test in Core asserting the two lists
   agree is not possible across repositories; the mitigation I have is that the
   test asserts `"assumed"` is *absent* today, so whoever adds it must read the
   comment saying Core comes first.
4. **`resolve-plan-node.ts` is at 492 lines**, past the 400-line advisory (410
   before me). The extraction slot is already its own directory and the
   step-permission and issue-position halves are already split out; what remains
   is one coherent subject — turning handles into parameters — so I did not split
   it to chase the advisory. It is the fourth-largest file in that tree and none of
   the others has been split for this reason either.
5. **A guess that is right is indistinguishable from a guess that is wrong, by
   design.** `assumed` says a name was resolved and with what confidence; whether
   the resolved column is the one the person meant is the evaluator's question,
   not this field's. A reader who finds `nearest, 0.733` on a wrong answer still
   has to decide whether the column or the instruction was at fault. That is the
   right division, but it means this field narrows a diagnosis rather than
   settling one.
