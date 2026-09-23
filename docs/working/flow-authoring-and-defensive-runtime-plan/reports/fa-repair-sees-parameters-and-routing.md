# t104 — the repair now sees what each step ran with, and the Flow as a graph

All source changes are in **FluxIQ Core**, in the worktree `F:/fxwork/t104/!FluxIQ`
on `task/t104-repair-sees-parameters-and-routing`. The web-extension worktree
`F:/fxwork/t104/!FluxIQWebExtension` has **no source change** — only this report.
Nothing under `runtime/result-check-schedule/` or `flow-bootstrap`'s start
location was touched. No Lab run, campaign or provider run was started. Nothing
was committed or pushed.

## Outcome

Done, with one honest gap named below and one structural finding that was not in
the brief. All three items are built and tested:

1. Each step of the run now reaches the repair with the parameters it ran with
   and what it produced, screened rather than refused.
2. The Flow reaches the repair as a graph — nodes, edges, the router's rules,
   and the failing node located among them — rather than as a flat step list.
3. A retried session is verified against the **patched** Flow, so
   `resultSummary.flowShape` describes the Flow that produced the result.

The five required context pieces are now all present. The table from
`fa-repair-wrong-answer.md`, updated:

| Required | Status | Where it comes from |
|---|---|---|
| The steps that already ran, **with the parameters they ran with** and the results they produced | **Complete, with one caveat** | New `recoveryContext` section `step_parameters`: per step, the screened authored parameters, what was withheld and where, plus route, comparison status, duration, row count, output shape and failure code. The caveat is *authored* rather than *resolved* values — see "The one thing still not carried". |
| The conversation so far | Complete (t099) | `packet.conversation` |
| The page as it was when the failure happened | Complete in practice (t099) | `captureSanitizedFailureEvidence` |
| The Flow itself — nodes, routing, the node that failed in place | **Complete** | New `recoveryContext` section `flow_graph`: nodes, edges with their ports, the router's rules in evaluation order with their conditions and targets, the fallback, and `failingNode` with the edge ids either side of it |
| The failure's own record | Complete (t099) | `recoveryContext.failure` |

## 1. The parameters each step ran with

### The brief's premise was half right, and the correction matters

The brief pointed at `service/summaries/conversions.ts:143` for never copying
`attempt.inputs`. It does not copy them, but **copying them would not have given
the parameters a step ran with.** `collectNodeInputs`
(`runtime/executor/node-inputs.ts`) returns `{ ...values, ...inputs }` — the
run's *whole accumulated value bag* merged with whatever arrived down an edge.
That is why `recovery/context.ts` calls it "live data of unknown sensitivity";
it is not a projection of one node's parameters and never was.

The node's actual resolved parameters are `resolvedParameters.values` in
`runtime/executor/node-execution.ts:49`. They exist for the length of one call
and **are recorded nowhere** — not on the attempt trace, not on the persisted
record.

So the source used is the **Flow document's authored `parameterValues`**, joined
to each attempt record by node id. That is the option `fa-repair-wrong-answer.md`
listed as the alternative, and it is the better one on the merits:

- it is authored data, the same class as `expectedState`, which `context.ts`
  already lets through by name and for the stated reason — the user wrote it and
  it is in the document the model is being asked to change;
- where a parameter was state-bound, what is carried is the **binding**, which
  names where the value came from instead of what it was;
- and it is what a repair edits. A repair rewrites the authored parameter, not
  the resolved one.

### The screen

`runtime/recovery/repair-context/parameter-screen.ts` (new). Built only from
mechanisms that already existed, as the brief required — `screenAutomationStudioLlmEvidence`
for the domain's declared keys and for credential shapes, `locator-text.ts` for a
string shaped like a way to address an element. Four rules:

- **A number or a boolean is carried whole.** A timeout, `minItems: 0`,
  `paginate: false`, a scroll offset. No page and no person is in them.
- **A string is carried only where its key is Core's word for what something is
  called** — `label`, `name`, `accessibleName`, `role`, `field`, `column`,
  `kind`, `mode`, `is`, `key` and the rest of a closed 24-word list — **and only
  in the top two naming levels**, where the keys are the node definition's own
  declared ids. `text` and `value` are deliberately absent at every depth: on a
  typing step they are the person's data.
- **A string that is an absolute URL is carried as its origin**, whatever its
  key. An authority carrying userinfo is refused rather than trimmed, because
  what would be trimmed off is a credential.
- **Everything else is withheld**: the key keeps its place with `null` and the
  dotted path is recorded in `parametersWithheld`. So the *shape* of what the
  step ran with is complete even where none of the values could be carried.

**Why the depth bound exists, and it is not arbitrary.** The first draft applied
the name-key list at every depth, and on the campaign's own extraction node that
carried `extractList.fields.name: "productTitle"` while withholding
`extractList.fields.price` — because `name` is in Core's list and `price` is
not. The keys of a field map are the column names *the model chose*, not Core's
vocabulary, so reading them as Core's carried one column's page field and
withheld the next one's for no reason a reader could state. Naming depth stops
at the level where the keys stop being the definition's. An array index is not a
naming level, so `where[3].field` reads as the same kind of key as
`element.name`.

**What this buys, concretely.** For the r5 extraction the repair is now shown
`{extractList: {handle: null, fields: {name: null, price: null, rating: null},
minItems: 0, paginate: false}, timeoutMs: 15000}` with
`parametersWithheld: ["extractList.handle", "extractList.fields.name", …,
"apiKey"]` — the columns it asked the page for, that it paginated, that it
accepted zero rows — and for the click before it,
`{element: {accessibleName: "Sort by: Featured", role: "button"}}` with
`selector` and `target` named as withheld. "It extracted the wrong column" and
"it clicked the wrong control" are now both readable. "It typed the wrong text"
is not, and cannot be without carrying the text.

### The results each step produced

`conversions.ts` now writes `metadata.outputShape` on each attempt record: one
entry per output port, whose value is the list's **length** where the output is a
list and `true` otherwise. Names and counts; never a value. It is screened
against the domain's declared keys where it is projected into the request rather
than where it is written, because only there is a declaration in reach.

Beside it, `step_parameters` carries each step's `status`, `route`,
`comparisonStatus`, `durationMs`, `recordCount` and failure code — all already on
the persisted record, none of it captured anew.

### Fail-closed when nobody declared

`step_parameters` is recorded **`withheld`**, not `absent`, when the deployment
has no bound domain and therefore no `deniedEvidenceKeys`. An absent declaration
means nobody said, never "deny nothing" — the same reading the packet builder
applies to every evidence slot — and the omission list is exactly the mechanism
for keeping "the run took no steps" and "Core refused to project them" apart.

## 2. The Flow as a graph

`runtime/recovery/repair-context/flow-graph.ts` (new), a twelfth section
`flow_graph`, carrying:

- **nodes** — id, definition id, label (≤24);
- **edges** — id, source, target, and both port ids (≤32). This is the thing a
  flat step list cannot express and the thing a reroute is written in terms of;
- **routers** — each router's rules **sorted by their own `order`**, with
  `target`, `status`, `confidence` and the `condition` that selects each one,
  plus the fallback (≤2 routers, ≤12 rules each);
- **failingNode** — the node id with the ids of the edges into and out of it, so
  a repair can say which edge it is rerouting and where it is inserting a step.
  A node id the Flow no longer holds is reported `inFlow: false` rather than
  silently dropped: a refuted result names the last step that stored records, and
  the Flow may have been patched since.

A router's `condition` is carried **whole**. The same argument `context.ts`
already makes for `expectedState`: it is authored Flow-document data, the person
or the build wrote it, it is in the document the model is being asked to change,
and without it a rule is a name with no meaning. Every string in it still goes
through the context's locator screen with the rest of the sections.

The router reaches the recovery through a new optional port
`AutomationStudioRuntimeRecoveryPorts.flowRouterForRecovery`, supplied by the
service from `getFlowRouter`. It reads the **parent** Flow's router whether or
not a Subflow graph is what ran: a Subflow graph has no router of its own, and
the rule that selected it is the parent's.

### The byte budget, raised from 4,000 to 8,000, with the arithmetic

The two new sections are not small — measured on the test's r5-shaped fixture,
`flow_graph` is 1,158 bytes and `step_parameters` 1,267, and the whole context
comes to **4,053 bytes with five sections present and eight absent**. At the old
budget the drop order would have done its job correctly and silently: the graph
and the parameters would have been carried by pushing out the state diff, the
failed target and the route context, and the repair would have been worse off
than before.

`context.ts`'s own note says the measured diagnosis request is about 13,000 bytes
against an allowance of roughly 32,000. +4,000 is headroom that exists. The
request that is tight is the patch, where the explored packets take what is left,
so the trade is stated plainly in the code: **one fewer explored page, and the
graph the model is being asked to rewire.**

### Where the two sections sit in the fixed priority list

`failure`, `expected_transition`, `actual_transition`, **`flow_graph`**,
**`step_parameters`**, `state_diff`, `failed_target`, `recovery_candidates`,
`subflow`, `route_context`, `known_adaptations`, `recent_nodes`,
`recording_context`.

This placement is the whole of how one fixed list serves two entry points, and it
was chosen rather than fallen into. A **failed step** is repaired from what it
expected and what it got, so the transitions still come first and nothing about
that reading changed. A **refuted result** has no transition comparison at all —
t099's synthesized attempt claims nothing about the step — so both transition
sections are `absent` and cost nothing, and the two new sections arrive
immediately behind the failure record. No ranking is computed and no section
moves; the same list reads differently only because a different run produced
different sections.

## 3. The flowShape defect t099 left

`retryRuntimeSessionAfterAutoAppliedPatch` now returns
`flow: canonicalFlowDocument(updatedFlow)` — the patched document it re-read in
order to run the retry — and both `if (retry?.session) return await
verifyAutomationStudioRuntimeSessionResult(...)` call sites prefer it. That is
strictly more correct than the previous `canonicalFlowDocument(selectedFlow ??
runtimeCanonical)`: `updatedFlow` is the exact argument the retry passed to
`runCanonicalAutomationStudioFlow`, so it is the Flow that produced the result
being judged.

Pinned by `runtime/tests/service-adaptation/tests/retry-result-verification.test.ts`,
which runs a real service: a Flow of four steps fails, the patch call lands a
`temporary_wait_retry` **and** adds a fifth node (standing in for a structural
repair), the retry re-reads the document, and the verification must be handed
five. **Mutation-checked**: reverting the one expression makes the test fail with
`expected [ 'start', 'extract', 'drift', 'end' ] to contain 'repaired'`.

### The structural finding this test turned up, which is not in any brief

**A provider-backed verification of a retried session is unreachable as the code
stands**, and it is a chain of three deliberate decisions that nobody has looked
at together:

1. `resultPorts.resolveProvider` is wired only when the run carries a grant whose
   purpose includes `loop_verification` (`service.ts`, the `resultPorts` literal).
2. `runRuntimeSession` forces `adaptiveMode: "manual_approval"` for **any** grant
   (`service.ts:2671`, "Manual approval always").
3. Manual approval makes the promotion gate record `autoApply: false`, and
   `decideAutomationStudioAdaptiveRetry` only asks for a retry from an attempt
   whose `approvalDecision.autoApply === true`.

So a granted run never retries, and an ungranted retry never asks a model. I
confirmed this by running it: with a grant the run records
`approvalDecision: {autoApply: false, reason: "Manual adaptation approval mode
requires explicit review."}` and no `adaptiveRetry` at all; without one the retry
happens and the verification records
`{performed: false, code: "core.result.no_model_available"}`.

This does not make the fix wrong — the wrong Flow was reaching the verification
either way, and `flowShape` is also read by whoever opens the run afterwards. It
does mean the verification of a repair's own product, which t099 built as gate 4,
cannot currently spend a call. It is the same standing-authorization question
`fa-training-mode-design.md` raises as its blocking item, seen from the other
end, and the two should be settled together.

Because of it, the test asserts the Flow handed to
`verifyAutomationStudioRuntimeSessionResult` (through a `vi.mock` wrapper around
the module) rather than a `loop_verification` request body. The test says so, in
those words, at the top of the file.

## The one thing still not carried, stated rather than buried

**A step's resolved values.** What is shown is the Flow's authored parameters. If
a parameter was bound to state, the model sees the binding and not what it
resolved to; if a domain rewrote a parameter between authoring and dispatch, the
model sees the authored one. Closing that means recording
`resolvedParameters.values` on the attempt trace, which is a new class of live
data in Core's storage and a decision above this task. For the wrong-answer
repair the gap is small — an extraction's field map and a click's control name
are authored, not resolved — and for a Flow built from a recording it is smaller
still.

**The typed text itself** is not carried, by the screening decision, and that is
the deliberate cost: "it typed into the wrong box" is now visible through the
control's name, and "it typed the wrong text" is not.

## The pre-send check, which did not check this slot at all

`recoveryContext` was never examined by
`automationStudioLlmRequestEvidenceRefusal`, and for most of its life that was
defensible: every section was Core's field names over Core's values. It is not any
more — `step_parameters` projects the Flow's authored parameters and a domain's
output port ids, and `flow_graph` carries a router's authored conditions.

So the slot is now checked like every other evidence-bearing slot, under its own
new pre-flight code `llm.provider_recovery_context_invalid` (added to the code
list, to `failure-disposition.ts` as `end_grant`, and to `flow-bootstrap`'s
mapping — all three tables are exhaustive records, so the type checker forced
them). It refuses a context that is on the wrong task kind, carries a credential
shape, carries a key the bound domain denies, or carries anything the locator
screen still recognises. The locator half is a **contract** between the builder
and the check rather than a second opinion: the builder puts every section
through `automationStudioWithoutLocators`, so a locator shape arriving here means
the two have drifted — which is exactly the failure mode that killed every repair
call in t099 before it was caught.

The leak test drives the finished patch packet through the real check and
poisons it three ways in turn — a denied key, a credential, a locator — and
asserts each is refused with that code.

## Two structural moves the audit required, both improvements

**`recovery/locator-text.ts` moved to `llm/harness/locator-text.ts`** (with its
test). `scripts/structure-audit/config.mjs` forbids `runtime/llm` importing a
*value* out of `runtime/recovery` — that edge closes a module cycle, and the
config's comment records two same-day incidents where a constant read at
module-evaluation time arrived `undefined` with a clean type check. The pre-flight
needs the locator screen, so the screen moved to where the other screens are:
`evidence-screen.ts` and `failure-evidence.ts` are its siblings, all three are
screens applied to what leaves for a provider, and `recovery` importing a value
out of `llm` is the direction that is allowed. Nothing outside Core imported it.

**`flowHasPriorManualAdaptationReview` moved out of `service.ts`** to
`service/adaptations/prior-manual-review.ts`, because `service.ts` is ratcheted at
its line count and this work added lines to it. It is a genuine improvement
rather than a shuffle: it now answers three states instead of two
(`reviewed` / `never_reviewed` / `unreadable`), which the previous
`.catch(() => false)` collapsed into one, and it took two swallowed failures out
of `service.ts` on the way. `service.ts` is **net 10 lines shorter** than it
started (4,610 → 4,600), with one fewer method and two fewer
`failure-as-empty` findings; `pnpm structure:baseline` lowered all three.

## Changed files (Core)

New:
- `runtime/recovery/repair-context/{parameter-screen,step-parameters,flow-graph,index}.ts`
- `runtime/recovery/repair-context/tests/{parameter-screen,flow-graph}.test.ts`
- `runtime/service/adaptations/prior-manual-review.ts`
- `runtime/tests/service-adaptation/tests/retry-result-verification.test.ts`

Moved:
- `runtime/recovery/locator-text.ts` → `runtime/llm/harness/locator-text.ts`
- `runtime/recovery/tests/locator-text.test.ts` → `runtime/llm/harness/tests/locator-text.test.ts`

Modified:
- `runtime/recovery/context.ts` — two sections, the `flow`/`routers`/`deniedEvidenceKeys` inputs, the budget raise
- `runtime/recovery/annotation/{annotate,ports}.ts` — the router port, and the Flow, router and declared keys threaded into the context
- `runtime/recovery/index.ts` — locator-text export removed
- `runtime/llm/harness/evidence-screen.ts` — `automationStudioExecutableTargetKey`, extracted from `context-packet.ts`'s private copy and now used by both
- `runtime/llm/harness/context-packet.ts` — uses that predicate instead of its own regex
- `runtime/llm/harness/request-evidence-check.ts` — the recovery-context slot
- `runtime/llm/harness/index.ts` — three exports the new module needs through the barrel
- `runtime/llm/provider-contract.ts`, `runtime/llm/failure-disposition.ts`, `runtime/flow-bootstrap/generation-failure.ts` — the new pre-flight code
- `runtime/service.ts` — the router port, the retry's returned Flow, both verification call sites, `prior-manual-review` extracted out
- `runtime/service/adaptations/index.ts` — barrel
- `runtime/service/summaries/conversions.ts` — `metadata.outputShape`
- `.structure-baseline.json` — three `service.ts` entries lowered
- Tests updated for deliberate changes: `recovery/tests/context.test.ts`,
  `recovery/tests/request-locator-shapes.test.ts`,
  `llm/tests/failure-disposition.test.ts`,
  `service/summaries/tests/conversions.test.ts`,
  `tests/service-adaptation/tests/llm-diagnosis.test.ts`,
  `tests/refuted-result/tests/repair-context.test.ts`

## For Core's paired working document

- **Decision.** A step's parameters are **screened, not refused**, for the repair
  request. The source is the Flow's authored `parameterValues`, which are the
  same class of data as `expectedState`; the run's resolved values stay unread
  and are in any case recorded nowhere.
- **Decision.** Core's rule for a string parameter is read off its **key**, from
  a closed 24-word list, and only in the top two naming levels — below that the
  keys are the author's, not the definition's.
- **Decision.** A withheld parameter keeps its key with `null` and its path is
  named. Shape without values is the half that can always be given.
- **Decision.** A router rule's `condition` is carried whole, on the
  `expectedState` precedent.
- **Decision.** `AUTOMATION_STUDIO_RECOVERY_CONTEXT_MAX_BYTES` is 8,000. The
  cost is the explored packets' share of the patch request.
- **Decision, reversed from t099.** A retried session is verified against the
  patched Flow, which `retryRuntimeSessionAfterAutoAppliedPatch` now returns.
- **Contract additions.** Sections `flow_graph` and `step_parameters`;
  `AutomationStudioRuntimeRecoveryContextInput.{flow,routers,deniedEvidenceKeys}`;
  `AutomationStudioRuntimeRecoveryPorts.flowRouterForRecovery`; attempt record
  `metadata.outputShape`; pre-flight code
  `llm.provider_recovery_context_invalid`; `automationStudioExecutableTargetKey`
  and `locator-text.ts` now exported from `runtime/llm/harness`.
- **Invariant pinned.** The recovery context is now an evidence-bearing slot and
  is re-checked before sending, on the domain's keys, on credentials and on
  locator shapes. The builder's screen and the check are two statements of one
  rule and a test drives a real patch packet through both.
- **Open, and above this task:** persisting a step's *resolved* parameters;
  **and the chain that makes a provider-backed verification of a retried session
  unreachable** (grant ⇒ manual approval ⇒ no auto-apply ⇒ no retry), which
  should be settled with `fa-training-mode-design.md`'s standing-authorization
  question rather than separately.

## What the Lab side would need to observe this

**None of it was necessary to prove this work, so none of it was done.** Nothing
in `packages/test-runner/` or `apps/scenario-lab/` changed. t099's four items
stand unchanged and are restated here so they are not lost:

1. `flow-lane.json` should publish `metadata.recoveryTrace` and
   `metadata.resultRepair` for a refuted run.
2. `persisted-flow-run.ts:450` takes the **first** non-null `action.failure`, so
   a recovered transient miss outranks the run-result failure appended last.
3. `lane-observation.ts:198` writes a bare `ambiguous_or_unknown` with no code;
   a refuted run now has `core.result.does_not_answer_request` to put there.
4. `terminal-run-wait.ts:48`'s `RECOVERY_RECORD_WAIT_MS = 300_000` is still five
   dead minutes for a run that plans `stop`.

One item this task adds to that list: **the recovery context's `included` /
`omitted` section names are the cheapest possible Lab assertion for this work.**
`summarizeAutomationStudioRuntimeRecoveryContext` already carries section names,
byte counts and omission reasons and no content at all, so a lane can assert that
`flow_graph` and `step_parameters` were *included* for a repair — without the Lab
ever holding page data. If the Lab publishes one new thing for this, publish
that.

## Commands run, and what they printed

In `F:/fxwork/t104/!FluxIQ`:

- `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` → exit 0, no output. Run
  four times across the work; clean each time.
- `node scripts/structure-audit.mjs` → first run **failed** with five violations
  I caused: one `failure-as-empty` (a `try/catch` around `new URL` answering
  `undefined`), one `file-lines` (`service.ts` 4,619 against its 4,606
  baseline), and three `imports` reaching past a directory barrel. All five
  fixed rather than baselined — the URL parse became a pattern match, the line
  count came down by extracting `prior-manual-review.ts`, and the imports now go
  through `llm/harness/index.ts`. Final run:
  `structure-audit: passed (177 warning(s), 360 baselined).`
- `node scripts/structure-audit.mjs --update` → `lowered [class-methods]
  …service.ts::AutomationStudioService: 223 -> 222`; `lowered
  [failure-as-empty] …service.ts: 20 -> 18`; `lowered [file-lines] …service.ts:
  4606 -> 4600`.
- `pnpm check` → `structure-audit: passed (177 warning(s), 360 baselined)`;
  `packages/contracts check: Done`, `packages/client-gateway-websocket check:
  Done`, `packages/fluxiq check: Done`, `apps/web check: Done`.
- `npx vitest run src/programs/automation-studio/runtime/recovery/repair-context`
  → `Tests 16 passed (16)` — the parameter screen (10) and the flow graph (6).
- `npx vitest run src/programs/automation-studio/runtime/tests/refuted-result`
  → `Tests 14 passed (14)` — the repair packet, including the two new context
  assertions, the three-way leak test through the real pre-send check, and the
  "carries none of it anywhere in the request" sweep.
- `npx vitest run …/retry-result-verification.test.ts` → `Tests 1 passed (1)`.
  With the fix reverted: `Tests 1 failed (1)`, on `expected [ 'start',
  'extract', 'drift', 'end' ] to contain 'repaired'`. Restored and re-run green.
- `npx vitest run src/programs/automation-studio/runtime/recovery` →
  `Tests 382 passed (382)`.
- `npx vitest run src/programs/automation-studio` (the whole Core
  automation-studio suite) → `Test Files 2 failed | 306 passed (308)`,
  `Tests 2 failed | 2702 passed | 1 skipped (2705)`. Both failures diagnosed:
  - `llm-diagnosis.test.ts` asserted `byteBudget: 4_000`, which this work
    deliberately changes. Updated to `8_000`; the file now reports
    `Tests 8 passed (8)`.
  - `deepseek-bootstrap-exploration.test.ts > asks again after a decision that
    runs past its deadline` is a 3,000 ms deadline test in a file this work does
    not touch, whose own comment says "a heavily loaded machine can take a
    second to get there". Run alone: `Test Files 1 passed (1) / Tests 8 passed
    (8)`. Same signature t099 recorded for this file.
- Final targeted re-run after both test fixes, over `recovery`, `llm`,
  `result-verification`, `service` and `tests/refuted-result` →
  `Test Files 101 passed (101)`, `Tests 1069 passed | 1 skipped (1070)`; and
  over `tests/service-adaptation` → `Test Files 14 passed (14)`,
  `Tests 56 passed (56)`.
- `pnpm --filter fluxiq build` → completed with no output, rebuilding `dist` for
  the downstream worktree.

In `F:/fxwork/t104/!FluxIQWebExtension`:

- `pnpm check` → `structure-audit: passed (100 warning(s), 121 baselined)`, then
  all ten projects `Done`: `domain`, `packages/real-site-policy`,
  `packages/boundary-audit`, `packages/test-contracts`, `packages/test-matrix`,
  `apps/extension`, `apps/scenario-lab`, `packages/agent-orchestrator`,
  `packages/test-evidence`, `packages/test-runner`. (t099 recorded a
  `working-docs` failure here; it did not reproduce — the index is current on
  this branch.)
- `pnpm --filter @fluxiq-web-extension/domain test` →
  `# tests 762 / # pass 762 / # fail 0`.

No access violation (`3221225477`) or segmentation fault occurred in this task.

## Not verified

- **No live behaviour.** No Lab run, no campaign, no provider call. Whether the
  model, shown a graph and a step's parameters, actually authors a better repair
  is what a single live verification is for. What is proven is that the request
  carries them, that they are screened, and that the provider's own pre-flight
  agrees.
- **The end-to-end flowShape path through a provider.** It cannot be exercised
  today, for the reason set out in section 3. The test asserts the Flow handed to
  the verification, one call short of a `loop_verification` request body.
- **`metadata.outputShape` against a real domain's output port ids.** It is
  covered by the conversions test and the repair packet fixture; no run of the
  web domain was made, so no real port id has been through the screen.
- **`flowRouterForRecovery` against a project with a real router.** The port is
  one line in the service (`this.getFlowRouter`) and the section builder is
  covered by unit tests with a hand-built router; no service-level test drives a
  stored router into a repair.
- **Whether 8,000 bytes is the right budget under a real patch request.** The
  arithmetic is stated and the measured fixture is 4,053 bytes, but no live patch
  request has been built at the new budget, so how much the explored packets
  actually yield is unmeasured.
- **`packages/test-runner`'s own tests** were not run; its typecheck passes.

## Open questions and contradictions found

1. **The brief's premise about `attempt.inputs` was not accurate**, and the
   correction is load-bearing: those are the run's whole value bag, not a node's
   parameters, and the node's resolved parameters are recorded nowhere. The work
   took the authored-parameter route instead, which is the route
   `fa-repair-wrong-answer.md` listed as the alternative. If resolved values are
   genuinely wanted, recording them is its own task with its own storage
   decision.
2. **A granted run cannot auto-apply a patch, so it cannot retry, so a repair's
   own product can never be judged by a model.** Three separate deliberate
   decisions compose into this and I do not think anyone intended the
   composition. It is the same question `fa-training-mode-design.md` calls its
   blocking item and should be settled once, for both.
3. **`recent_nodes` is now largely redundant.** `step_parameters` carries the
   same chain with more on it. `recent_nodes` was left alone because removing a
   section changes the contract and t099's tests read it, but the next person
   into this file should consider folding it in; it is near-last in the drop
   order, so it costs little either way.
4. **`screenAutomationStudioLlmEvidence`'s credential shapes are the only thing
   standing between an authored parameter and a leaked secret**, and they are
   deliberately narrow — they catch a PEM key, a JWT, a bearer token, `sk-`,
   AWS, GitHub and Slack. A password typed as a literal into a Flow's authored
   `text` parameter would not match any of them. It does not reach the model
   today, because `text` is not a name key, but the day somebody adds a key to
   `NAME_KEYS` without reading why the list is short, it would.
