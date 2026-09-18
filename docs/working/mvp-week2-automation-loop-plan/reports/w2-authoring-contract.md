# w2-authoring-contract — why a narrowing or interaction node was never built

Outcome: **Partial.** The brief's premise turned out to be half right, and the
half that was wrong is the more important half. The authoring path never
refused an interaction node — it accepted one before I changed anything. What
refused it was the *instruction* layer, then, once the model started writing
one, two separate handle defects. Both are now fixed and the authoring path
demonstrably expresses and accepts a narrowing Flow live. The brief's numeric
acceptance criteria (14 of 280, and 0 rows) are **not** met.

---

## 1. What I reproduced, and where each rejection is raised

I reproduced every rejection before changing anything, as the brief required.
Three of the four findings contradict the brief's summary.

### 1a. Core's authoring path accepts click, type and select — and always did

Unit-level reproduction through the real completion check
(`checkAutomationStudioFlowBootstrapCompletion`,
`AS/runtime/llm/harness-options/bootstrap-completion.ts`), with the web
domain's real node definitions and a stub domain resolver, on this Flow script:

```
flow: List the posts scheduled for the week ahead
step: open the scheduler
  node: web.browser.navigate
  url: https://social.test/scheduler
step: choose the week ahead range
  node: web.dom.select
  target: target.12
  value: week
step: apply the filter
  node: web.dom.click
  target: target.14
step: read the filtered rows
  node: web.dom.extract_list
  extractList: extraction.1
```

Result, on unmodified Core: `{ ok: true }`. Same for a `type` + `click` search
shape. So:

- the allowed-kind sets in `harness/output-validation.ts` and
  `provider-result.ts` are **not** the blocker;
- the Flow-script node vocabulary is **not** the blocker.
  `flow_script.unknown_node` is raised at
  `AS/runtime/flow-bootstrap/authoring/assemble.ts:132`, and only when a step
  names no node in the catalog at all;
- the registry validation is **not** the blocker.

### 1b. `bootstrap.unknown_parameter` — raised in the authoring key matcher

Raised at `AS/runtime/flow-bootstrap/authoring/assemble.ts` (`buildNode`) and
`.../authoring/normalise.ts`, both through `matchAuthoringParameter` returning
`undefined`. Reproduced exactly for a bare

```
  fields: title, date          -> bootstrap.unknown_parameter at ...parameters.fields
  location: https://…          -> ...parameters.location
  handle: extraction.1         -> ...parameters.handle
  paginate: false              -> ...parameters.paginate
```

These are the **same words the tool descriptions and Core's own completion
instruction tell the model to write**. They are legal only as dotted sub-keys
(`extractList.fields.title`, `target.location`). Nothing said so.

### 1c. The refusal could not be learned from

`automationStudioFlowBootstrapIssueFeedback` reads the node definition out of
`input.plan.subflows[...]`. For a Flow-script reply, `bootstrap-completion.ts`
passed the raw `{summary, flow}` object as that "plan", which has no
`subflows`, so `definitionAt` returned `undefined` and the `accepted` shape was
**never produced**. Reproduced: the model's feedback for the `fields:` case was

```json
{ "code": "bootstrap.unknown_parameter",
  "path": "plan.subflows.0.nodes.1.parameters.fields" }
```

— a path into a plan it never wrote, and nothing else. That is the mechanism
behind "one task re-proposed the same invalid parameter five times".

### 1d. `web.action.rejected.target_unsafe` — and the inference it invited

Raised at `domain/src/runtime/llm-evidence/tools.ts`, reveal branch, via
`reveal.ts:safeRevealElement` → `recoverable("target_unsafe")`. The creation
exploration offers exactly four tools (`vocabulary.ts`): inspect, navigate
same-origin, reveal-safe, detect-structure. None can enter text, choose an
option or press a filter, by design, and `web.reveal_safe`'s own description
said "Form entry, option selection, submission, generic action buttons … are
unavailable" with nothing to say that this bounds *exploring* rather than the
Flow. Core's decision instruction reinforced it ("never mutate merely to
perform an eventual workflow step that belongs in the generated result") and
never stated the converse.

**This is why 0 of the campaign's Flows contained an acting step.** It was not a
refusal at all — it was the only reading of the instructions available to the
model.

### 1e. `web.handle.malformed` — measured live, after the instruction fix

Raised at `domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts`
(`resolveTarget`). With the instruction fixes in place, the first live build
authored **exactly the right Flow**:

```
run-mu6b6lvl-db87c27f
web.output.browser-navigate{url,newTab}
web.output.dom-select{target,value,timeoutMs}
web.output.dom-select{target,value,timeoutMs}
web.output.dom-click{target,timeoutMs}
web.output.dom-extract_list{extractList,recordOutput,timeoutMs}

flow_bootstrap.evidence_completion_parameters_unresolved
  web.handle.malformed:target   (nodes 1, 2 and 3)
```

Cause: the model copied the handle *shape from the Flow-script format's own
example* (`control.7`, `field.2`), which the evidence never issues. Its
extraction handle was correct, because the detection tool spells that shape
out; nothing spelled out the target one. Replacing the example handles with
descriptions of the handle to copy made it worse — the next build wrote the
description as the value and was refused
`bootstrap.invalid_parameter_value` (`run-mu6bgyc8-3d355b20`).

### 1f. A second, silent defect: positional handles move under the plan

Measured, not supposed (`domain/src/runtime/llm-evidence/tests/stable-handles.test.ts`):

| page | `target.2` resolves to |
| --- | --- |
| `[banner, beds, band, search]` | `#beds` (the Bedrooms select) |
| banner dismissed, page recaptured | `#band` (the Price-band select) |

No refusal, no warning. `sanitize.ts` numbers elements `target.${index + 1}`
with no memory, and `plan-resolution/target-packets.ts` binds a handle against
the **newest** packet for that page. An ordinary recapture — what a successful
`web.reveal_safe` does, and what a second inspect does — renumbers everything
after any element that appeared or disappeared.

Live this arrived as a run-time failure, with the Flow already built:

```
run-mu6btt9u-8ba762fd / run-mu6cbb47-7ceb3aac / run-mu6cedna-3dd46e49
web.validation.output_not_observed
  expected "a select element to choose value \"5\" in"
  actual   "the target is a <button>"
```

`reveal.ts:currentElementForReturnedTarget` and the detection tool's
`boundTarget` already defend against exactly this and say so in their comments;
the plan resolver could not, because by then the packet that issued the handle
is gone.

### 1g. And the model names the wrong control even when the packet is right

Traced packet for `property-listings` (`run-mu6cedna-3dd46e49`), tags only:

```
total=175  target.1=button target.2=button target.3..12=a
           target.13=select target.14=select target.15=select target.16=select
           target.17=input  target.18..22=label …
```

The selects are described. The model named a button for the "choose 5 bedrooms"
step. The authoring path accepted it and the page refused it.

---

## 2. Which layer was wrong

Not the allowed-kind sets, not the node vocabulary, not the registry
validation. Four layers, in the order they bite:

1. **Instruction** — Core's Flow-script format, Core's evidence decision
   instruction, and the domain's tool descriptions all told the model, by
   inference or omission, that a Flow may not act.
2. **Authoring key contract** — a key the model was told to write had no place
   to go, and the refusal could not name one.
3. **Value reading** — `authoringNestedValue` read `extractList.minItems: 0` as
   `false` and `maxItems: 1` as `true`, because it tested the boolean word sets
   (which contain `0` and `1`) before the number. A count silently became a
   boolean the request reader then refused.
4. **Handle identity** — an example-shaped handle, a handle that moves under
   the plan, and no check that the named control is one the step can act on.

---

## 3. What I changed

### FluxIQ Core (`F:\!FluxIQ`)

| File | Change |
| --- | --- |
| `AS/runtime/flow-bootstrap/plan/flow-script-format.ts` | Says a step may act; says to narrow a collection before reading it and to write `extractList.minItems: 0` where the answer may be no rows; says a key a parameter takes is written inside it; says the example handles are a shape to copy from evidence, never to reuse. Adds a worked narrow-then-read example. |
| `AS/runtime/llm/evidence-loop.ts` | Decision instruction: a tool that refused you, or was never offered, bounds only what you may do while gathering evidence, never what the result may contain. |
| `AS/runtime/llm/harness-options/bootstrap-completion.ts` | Refusal feedback for a Flow script now reads the node definitions out of the plan the script got as far as, so `bootstrap.unknown_parameter` answers with the parameters the node does declare. Feedback instruction: correct a refused step, never delete one the instruction needs; a handle is refused when it is not one the evidence printed. |
| `AS/runtime/flow-bootstrap/authoring/assemble.ts` | Returns the refused plan under `refusedPlan` for feedback only; routes a stray key into the structured parameter that declares it. |
| `AS/runtime/flow-bootstrap/authoring/accept.ts`, `contracts.ts` | Carry `refusedPlan` on a refusal. Nothing builds from it. |
| `AS/runtime/flow-bootstrap/authoring/matching.ts` | New `matchAuthoringParameterContaining`: a key exactly one structured parameter declares in its own `example` is read as having been written inside it. Deterministic or nothing. |
| `AS/runtime/flow-bootstrap/authoring/normalise.ts` | Same routing for the nested-JSON door. |
| `AS/runtime/flow-bootstrap/authoring/values.ts` | Under a dotted key, a number is read before a boolean word. Fixes `minItems: 0` → `false`. |
| `AS/runtime/flow-bootstrap/plan/tests/web-domain-definitions-fixture.ts`, `plan/tests/issue-feedback.test.ts` | Fixture kept in step with the domain's example. |

New test: `AS/runtime/flow-bootstrap/authoring/tests/stray-parameter-key.test.ts`.

### Web-extension domain (`F:\!FluxIQWebExtension`)

| File | Change |
| --- | --- |
| `domain/src/runtime/llm-evidence/tools.ts` | Inspect description now states the target-handle contract the way the detection tool states the extraction one ("copy that handle exactly into the step's target, as `target: target.3`; an invented handle names nothing"). Reveal description: the restriction "bounds exploring only, not the Flow you author". Detect description: its count is the whole list; narrow in the Flow first; `minItems: 0`. Every authoring capture is restamped through the stable-handle registry. |
| `domain/src/runtime/llm-evidence/stable-handles.ts` (**new**) | A control keeps its handle across recaptures of one page, and a number once given is never given to another control. Bounded per page and per Flow, 1..99, and falls back to positional numbering rather than reusing a number. |
| `domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts` | New refusal `web.handle.wrong_control`: a choose step handed a non-`<select>`, or an entry step handed a `select`/`button`/`a`/`option`/`img`, is refused at build time instead of failing on the page. Only contradictions the registered output itself enforces. |
| `domain/src/output-nodes/extract-list/catalog-text.ts` | `minItems` added to the `extractList` example, which is what Core reads as the declaration of which keys belong inside that parameter. |

New test: `domain/src/runtime/llm-evidence/tests/stable-handles.test.ts`.
Updated tests: `llm-evidence/tests/tools.test.ts`,
`plan-resolution/tests/resolve-plan-node.test.ts`,
`structure/tests/detect.test.ts` (two documented contract changes, below).

**Contract changes a reader should know about.** A control whose selector
changed between two captures of one page is now `web.handle.unknown` rather
than silently rebinding to whatever stands where it stood; and a control a page
has not addressed before takes the next number the page has not spent, not its
position. Both are held by tests.

---

## 4. Live record counts, before and after

Command, exactly as briefed, `FLUXIQ_LAB_INSTANCE=auth-fix`, real DeepSeek.
Core rebuilt (`pnpm --filter fluxiq build`) before every run.

**Before** (tonight's campaign, quoted from the brief and re-confirmed in
`run-mu6aybv5-916326b2` / `run-mu6b0lcb-0a2caf69` on the unmodified tree):

| task | Flow built | rows returned | expected |
| --- | --- | --- | --- |
| `social-scheduler-week-ahead` | none (`evidence_repeat_without_progress`) | — | 14 of 280 |
| `property-listings-no-matches` | `navigate, extract_list` | **288** | **0** |

**After**, across 11 live builds this session:

- **5 builds authored the correct narrowing shape** —
  `navigate, select, select, click, extract_list` — which the authoring path
  **accepted and persisted** (`run-mu6btt9u-8ba762fd`, `run-mu6cbb47-7ceb3aac`,
  `run-mu6cedna-3dd46e49`, `run-mu6c8ynj-10ff7475`, `run-mu6b6lvl-db87c27f`).
  Before the change, across the whole campaign, zero did.
- 6 builds still authored `navigate, extract_list`. The choice is stochastic
  run to run.

Final verification run on the cleaned build
(campaign `2026-09-18T02-45-29-714Z`, 13 provider calls, $0.0346):

| task | run | rows | expected |
| --- | --- | --- | --- |
| `social-scheduler-week-ahead` | `run-mu6cwk2q-2d7d4200` | **33** (247 rows invalid) | 14 |
| `property-listings-no-matches` | `run-mu6czuef-25577514` | **288** | 0 |

**The brief's acceptance criteria are not met.** What changed is the kind of
failure: the authoring contract now expresses and accepts a narrowing Flow, and
what remains is downstream of it.

### What now stands between here and 14 of 280

1. **The model names the wrong control.** The packet lists the selects; it
   picked a button. Now refused at build time by `web.handle.wrong_control`,
   which has **not** yet fired in a live run.
2. **`record_schema.duplicate_field_id`.** Twice
   (`run-mu6c8ynj-10ff7475`, `run-mu6cp4vc-0d18496b`) a correct narrowing Flow
   was refused for the extract node's `recordOutput`, unrelated to narrowing.
   Not investigated.
3. **The model's answer to any refusal is to delete the acting steps** and
   complete with the read-everything shape. The feedback instruction now tells
   it not to; that alone was not enough.
4. **Run-to-run variance.** Roughly half the builds still never try.

---

## 5. Commands run and observed results

```
# Core, from inside packages/fluxiq
npx tsc --noEmit                                   -> exit 0
npx vitest run …/flow-bootstrap …/llm              -> 39 files, 518 tests passed
pnpm --filter fluxiq build                         -> exit 0 (run before every live run)

# Web extension
pnpm --filter @fluxiq-web-extension/domain check   -> exit 0
pnpm --filter @fluxiq-web-extension/domain test    -> 679 tests, 0 failed
node scripts/structure-audit.mjs (extension)       -> 1 violation, pre-existing
node scripts/structure-audit.mjs (Core)            -> 1 violation, pre-existing

# Live, real DeepSeek, FLUXIQ_LAB_INSTANCE=auth-fix
pnpm lab:campaign social-scheduler-week-ahead property-listings-no-matches
  -> 2 tasks, 0 passed, 13 provider calls, 74,238 tokens, $0.0346
  -> week-ahead 33 of 280 (expected 14); no-matches 288 (expected 0)
```

Total live spend this session: roughly $0.15 over 11 builds.

**Pre-existing failures I did not cause and did not fix:**

- Core structure audit: `AS/runtime/service.ts` is 6,411 lines against a 6,405
  baseline. Confirmed at `HEAD` with `git show HEAD:… | wc -l` → 6411; I did not
  touch that file.
- Extension structure audit: `[naming] scripts/lab/` three `core-` files.
- `pnpm --filter @fluxiq-web-extension/test-runner test`: 10 failures, all in
  `live-llm/budget` and grant planning (token limits, run budgets). My diff
  touches no limit, budget or grant file; the repository's newest commit is
  "Pin the campaign's token limits by name, not by position", so these look like
  an in-flight change whose test-runner expectations have not landed.

---

## 6. Not verified

- **`web.handle.wrong_control` has never fired in a live run.** It landed after
  the last run in which the model named a button; the three runs since then
  authored read-only Flows. Unit-tested only.
- **No browser-level proof that a `select` + `click` Flow actually filters the
  fixture**, because no run reached the extraction with correct handles. The
  filter narrowing is proven only by the scenario's own recording script.
- **`record_schema.duplicate_field_id`** — seen twice, cause not investigated.
- **The stable-handle change under a real page that re-renders with new
  selectors.** Unit-tested with synthetic pages; the live fixtures happened to
  be stable (the traced packets were byte-identical across three captures).
- **Whether the 99-number pool is ever exhausted** on a real page. The fallback
  resets the page's numbering, restoring the old hazard for that page.
- **Whether the instruction changes help or hurt the other campaign slices.** I
  ran only the two tasks the brief names.
- **The 40-element packet cap** as a contributing cause. The property-listings
  packet carried 36 of 175 elements; the filters survived, but a page whose
  controls sit below the cut would be unreachable. Not investigated.

---

## 7. Open questions and contradictions found

1. **The brief's central claim is wrong and the working document should say so.**
   "The authoring path refuses it" was not true: Core accepted
   `select`/`click`/`type` before any change. Every brief in this effort that
   rests on that sentence needs revisiting. What was true is that the model was
   told, by four separate texts, that it may not act.
2. **A build that recovers after a refusal records nothing about what refused
   it.** `steps[]` in the failure diagnostic only exists for builds that fail;
   every insight in this report came from a temporary stderr trace I added and
   removed. Three campaign slices' worth of refusals are unrecoverable. A
   durable record of completion refusals — codes and plan paths only — would
   have saved this whole investigation.
3. **`acceptAutomationStudioFlowBootstrapResult` can return `ok: true` with
   error issues**, and `bootstrap-completion.ts` drops them. Parse errors from
   `parseAutomationStudioFlowScript` that do not stop assembly are silently
   ignored. I did not widen scope to fix it; it deserves a look.
4. **Should the creation exploration be allowed to narrow?** Everything here
   works by telling the model to author blind. Letting it *try* a filter and
   observe the result would let it verify before it commits, and would make the
   wrong-control mistake self-correcting. That means a new evidence tool with a
   safety rule distinct from Decision L3's destructive ladder — a real design
   question, deliberately not decided here.
5. **`invalidRows: 247`** on the week-ahead run: the extraction read 280 items
   and rejected 247 for a missing required field, leaving 33. That is a
   different wrong answer from 280, and it is not narrowing. Worth its own look.
