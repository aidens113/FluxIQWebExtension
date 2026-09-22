# D1 — The exploration-to-Flow seam, as it exists in source

Read-only investigation of FluxIQ Core (`F:\!FluxIQ`) with the web domain
(`F:\!FluxIQWebExtension\domain`) read where it supplies the tools. Nothing was
changed. No live provider call was made and no test was run; every claim below
is from source, cited `file:line`.

Paths are relative to `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`
unless they begin `domain/`, which means `F:\!FluxIQWebExtension\domain\src\`.

---

## 0. The shape of the thing, in one paragraph

An evidence-guided Flow build is one call to
`runAutomationStudioLlmEvidenceLoop` (`runtime/service.ts:1889`). The loop keeps
a flat in-memory array of `{callId, toolId, value}` evidence entries
(`runtime/llm/evidence-loop.ts:271`), shows the model a byte-bounded window of
it on each iteration, and ends when the model answers `{kind:"complete", result}`
instead of asking for another tool. The `result` is **one string**: a plain-text
Flow script (`runtime/flow-bootstrap/plan/evidence-schema.ts:31-45`). Core parses
that string into a plan, derives everything the model did not write, validates
it, and materialises Flow nodes from it. The evidence array itself is a local
`const` that is never returned (`evidence-loop.ts:410` returns only `result`,
`trace`, `accounting`), so **the exploration is a transcript that is thrown away
at the moment the Flow is written**, exactly as the brief suspected.

---

## 1. What each exploration tool call produces, and where it is stored

### 1.1 Which tools a build actually gets

`runtime/service.ts:1881` builds the loop's tool list:

```ts
const harnessOptions = automationStudioHarnessOptionRegistry({ binding: this.llmEvidenceRuntime })
  .evidenceLoopBinding({ projectId, flowId }, { ...resolution, allowSideEffectsWithoutPolicy: true });
```

Two things follow that matter.

- **No `host` is passed**, so Core's own six built-in options
  (`core.flow_graph`, `core.node_detail`, `core.node_catalog`,
  `core.state_snapshot`, `core.state_diff`, `core.prior_adaptations` —
  `runtime/llm/harness-options/builtin.ts:27-34`) are never registered for a
  build. `automationStudioHarnessOptionRegistry`
  (`runtime/llm/harness-options/binding.ts:180-191`) seeds builtins only when
  `input.host` is present.
- **`resolution` carries no `stage`** (`runtime/service.ts:1838` builds it as
  `{scope, runtimeCapabilities, permissions}`). `stageAllows`
  (`runtime/llm/harness-options/registry.ts:256-259`) withholds every
  stage-pinned option from a call that names no stage, and the web domain pins
  all six of its recovery options to `gather`/`iterate`
  (`domain/runtime/llm-evidence/harness-options/options.ts:59,77,86,95,111,125,137`).

So a build is offered exactly the five bare tools on
`AutomationStudioLlmEvidenceRuntimeBinding.tools`
(`domain/runtime/llm-evidence/tools.ts:216-254`):

| toolId | effect | notes |
|---|---|---|
| `web.inspect_current_page` | observe | `repeatPolicy: "after_mutation"`, `initialObservation: {input:{}}` (tools.ts:222-223) |
| `web.navigate_same_origin` | mutate | refuses cross-origin (tools.ts:273) |
| `web.press_control` | mutate | requires `target` + `consequences` |
| `web.enter_field` | mutate | requires `target` + `value` |
| `web.detect_repeating_structure` | observe | issues an extraction handle |

There is **no wait tool on the authoring path**. The recovery bundle has one
(`options.ts:98-112`) and it is unreachable during a build.

### 1.2 The artifact a call produces

Every one of the five ends in the same capture
(`domain/runtime/llm-evidence/capture.ts:82-105`), producing a
`WebLlmSnapshotBinding` = `{evidence: WebLlmPageEvidence, selectors: Map<handle,
selector>}` (`domain/runtime/llm-evidence/sanitize.ts:53-93`). The packet the
model sees carries `location`, `title`, `elements[]` (each with an opaque
`target` handle), truncation flags — and **never a selector**
(`sanitize.ts:56-66`; `selector` is a denied key, `tools.ts:205`). It is capped
at 6,000 bytes by default, ceiling 12,000
(`domain/runtime/llm-evidence/limits.ts:34-38`).

A mutating call is act-then-recapture (`capture.ts:116-130`), so what comes back
is only *the page afterwards*. Nothing records that a press dismissed a banner,
or what the page looked like before. `pressControl`
(`domain/runtime/llm-evidence/press.ts:55-71`) returns the post-press binding and
nothing else; the only trace of the action is the diff between two packets the
model would have to notice for itself, and only if both survive the window
(§3.2).

### 1.3 Where it is stored during the build

**In Core, for the duration of the loop only:**

- `evidence: Array<{callId, toolId, value}>` — `evidence-loop.ts:271`, appended
  at `:293` (initial observation) and `:466`. **The tool call's `input` is not
  stored with it.** The decision object carrying `input` is discarded after
  dispatch.
- `trace: AutomationStudioLlmEvidenceLoopTrace[]` — `evidence-loop.ts:253`,
  appended at `:294,:324,:339-361,:409,:467`. One entry per iteration:
  `{iteration, decision, callId?, toolId?, evidenceBytes?, effectApplied?,
  resultCode?, usage?}` (`evidence-loop.ts:74-85`). Again, **no input**.
- `answeredRequests`, `observationEpochs`, `latestObservations` —
  `evidence-loop.ts:266-269`. These hold a *canonical hash* of
  `[mutationEpoch, toolId, input]` (`:426`), not the input itself.

When the loop returns, `evidence` goes out of scope. Only `trace` survives
(`runtime/service.ts:1931`).

**In the web domain, across the build (in-process, bounded):**

- `returnedEvidence` (`tools.ts:169`, written at `:181-184`) — the newest packet
  per `{projectId, flowId, sessionId}`; used to bind a `target.N` the model
  quotes back to a live element (`press.ts:113-126`).
- `targetPackets` (`tools.ts:171`, `domain/runtime/llm-evidence/plan-resolution/target-packets.ts:55-90`)
  — per Flow, the newest **8 pages** (`target-packets.ts:34`), each page a map
  `target.N -> {selector, frameId, elementIdentity, shared}`. Store keeps 32
  Flows. A page that ages out makes its handles `stale`.
- `stableHandles` (`tools.ts:176`) — keeps `target.N` naming the same control
  across recaptures of one page.
- `toolSelectors` / `failureSelectors` (`tools.ts:187-194`) — newest 8 packets'
  selector maps (`RETAINED_SELECTOR_BINDINGS = 8`, `tools.ts:166`).
- `extractionHandles` (`tools.ts:170`) — what `extraction.N` stands for.

**This is the whole of the durable exploration→Flow channel: a handle-to-selector
table for the last eight pages.** Everything else about what exploration did is
gone.

---

## 2. What the model emits, and what turns it into Flow nodes

### 2.1 The emission

Completion schema: `AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_COMPLETION_SCHEMA`
(`runtime/flow-bootstrap/plan/evidence-schema.ts:31-45`). It requires exactly one
field, `flow`, a string, plus an optional one-sentence `summary`. Its
`description` embeds `AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT`
(`runtime/flow-bootstrap/plan/flow-script-format.ts:57-122`) — the whole grammar
the model must learn: `flow:`, `step:`, `node:`, parameter lines,
`on <port>: go to <label>`, `subflow <label>:` + `when:` + `end`.

The nested JSON plan schema still exists (`plan/output-schema.ts:6-105`) and is
still accepted, but is no longer advertised for the evidence-guided path
(`evidence-schema.ts:22-30`).

### 2.2 The chain that turns the string into nodes

1. **`checkAutomationStudioFlowBootstrapCompletion`** —
   `runtime/llm/harness-options/bootstrap-completion.ts:73-126`. Wired as the
   loop's `checkCompletion` (`runtime/service.ts:1893-1897`). It runs every check
   *while the model can still be asked again*.
2. **`acceptAutomationStudioFlowBootstrapResult`** —
   `runtime/flow-bootstrap/authoring/accept.ts:26-47`. The one door. Pulls the
   script out of whatever key it arrived under (`SCRIPT_KEYS`, `accept.ts:22`).
3. **`parseAutomationStudioFlowScript`** —
   `runtime/flow-bootstrap/authoring/parse.ts:40-53`. Text to
   `{summary?, blocks[{name, role, when[], steps[{label?, description, node?,
   entries[], branches[]}]}]}`. An unplaceable line is a *warning*, not fatal
   (`parse.ts:166-173`).
4. **`assembleAutomationStudioFlowScriptPlan`** —
   `runtime/flow-bootstrap/authoring/assemble.ts:53-58`. **This is the function
   that writes the Flow's nodes.** Its header (`assemble.ts:1-25`) states the
   division: "Everything the model did not write is derived here… the schema
   version, each Subflow's key, each node's key and definition version, the
   output action a definition fixes, the edge between two consecutive steps, the
   Router that reaches a named block." Steps connect in written order; `on
   <port>:` claims a port.
5. **`parseAutomationStudioFlowBootstrapPlan`** then
   **`resolveAutomationStudioFlowBootstrapPlanParameters`**
   (`runtime/llm/harness-options/plan-parameter-resolution.ts`, called at
   `bootstrap-completion.ts:107-114`), which hands each node to the domain's
   `resolvePlanNodeParameters` (`binding.ts:154-169`). This is where
   `{"handle":"target.7"}` (`plan-node-handles.ts:39-41`) becomes a real
   selector, out of the domain's `targetPackets` table.
6. **`validateAutomationStudioFlowBootstrapPlan`** (`bootstrap-completion.ts:118`).
7. On acceptance the verdict's `buildPlan` reaches
   `createFlowBootstrapAdaptation` (`runtime/service.ts:1972-1984`), which calls
   **`normalizeAutomationStudioFlowBuildPlan`**
   (`runtime/flow-bootstrap/adaptation.ts:118-217`) — the function that
   materialises actual `AutomationStudioFlowArtifact` nodes and edges
   (`adaptation.ts:158-182`), a subflow per block, and a router
   (`adaptation.ts:229+`).

**Answer to "name the file and function that writes the Flow script":** the model
writes the script text; Core turns it into a graph in
`runtime/flow-bootstrap/authoring/assemble.ts` →
`assembleAutomationStudioFlowScriptPlan`, and into persisted Flow nodes in
`runtime/flow-bootstrap/adaptation.ts` → `normalizeAutomationStudioFlowBuildPlan`.

---

## 3. What is available to the writer, and what is discarded

### 3.1 What reaches the decision that writes the Flow

Every decision — including the final one — is a **fresh, stateless two-message
provider request** (`runtime/llm/deepseek-provider.ts:481-484`): a system prompt
and one JSON user payload. The payload carries
(`deepseek-provider.ts:497-516`):

- `instructions` (the person's text),
- `evidenceLoop.tools` — id, description, effect, repeatPolicy only (`:506-511`),
- `evidenceLoop.evidence` — the windowed `{callId, toolId, value}` entries,
- `flowBootstrap` — `nodeCatalog`, `catalogTruncated`, `catalogSelection`, and
  `routing` (`:528-530`),
- `reusableContext` when opted in.

**There is no conversation history.** The model's own previous decisions,
including every `input` it gave a tool, are not in the request. The model cannot
see which handle it pressed, only the page that came back.

`routing` is the one structured channel from exploration to the writer:
`AutomationStudioFlowBootstrapRoutingContext`
(`runtime/flow-bootstrap/plan/routing-context.ts:61-73`), built by
`startAutomationStudioBuildRouting` (`runtime/route-state.ts:130-165`) and
refreshed by the `observing` wrapper at `runtime/service.ts:1900`. After each new
piece of evidence it asks the host to observe route state again and appends
`{seen: "after exploring with <toolId>", state}` (`route-state.ts:157-161`).
Bounded to **6 distinct situations, 24 state entries, 6,000 bytes**
(`routing-context.ts:75-82`), deduplicated by state (`:116-124`), and the `seen`
string names only the toolId — **never the target, the URL, or what the step was
for**.

### 3.2 The evidence window

`evidenceContextWindow` (`evidence-loop.ts:638-670`) takes **the newest entry per
`toolId` first**, then fills the remaining bytes newest-first. Budget is
`maxEvidenceContextBytes = AUTOMATION_STUDIO_EVIDENCE_CONTEXT_BYTES = 24_000`
(`runtime/loop-limits/flow-bootstrap-evidence-loop.ts:59,107`).

Consequence: with packets at up to 6,000 bytes, roughly three or four fit. A
build that presses five controls has all five results under the single toolId
`web.press_control`, so **only the last is guaranteed to be in front of the model
when it writes the Flow**; the earlier ones compete for leftover bytes. The
comment at `evidence-loop.ts:622-633` records that this exact class of loss
already produced a wrong Flow once (`run-mu6efrsv-f5b52d6a`).

### 3.3 The explicit ledger of what is discarded

| Thing exploration knew | Reaches the writer? | Where it dies |
|---|---|---|
| Overlay / cookie dismissal was performed | **No** | A press yields only the post-press packet (`press.ts:65-70`). No step record exists. The model would have to infer it from two packets that may not coexist in the window (§3.2). |
| Which handle each action targeted | **No** | The decision's `input` is never stored in `evidence` (`evidence-loop.ts:466`) nor in `trace` (`:467`); only a hash of it is kept (`:426`). |
| The exact target an action resolved to (selector, frame, element identity) | **Not to the model; to Core only indirectly** | Held only in the domain's `targetPackets` (`target-packets.ts:55-90`), reachable only if the model *quotes the handle back* in the plan and `resolvePlanNodeParameters` looks it up. Bounded to the newest 8 pages per Flow (`target-packets.ts:34`). |
| Waits | **No such concept on this path** | No wait tool is offered (§1.1); the built Flow *can* contain `web.dom.wait_for_selector` / `web.dom.wait_for_text` (`domain/output-nodes/definitions.ts:91-92`), but nothing derives one from what exploration observed. |
| Intermediate navigations | **Only as a page packet** | `web.navigate_same_origin` returns the destination packet (`tools.ts:282-284`). That the build moved, and from where, is not recorded as a step. |
| Page state each action produced | **Partly, briefly** | The packet is the state; it is window-evicted (§3.2). `routing.situations` keeps at most 6 deduplicated host-observed states (`routing-context.ts:78`). |
| Whether a mutation actually changed anything | **No** | `effectApplied` and `targetsUnchanged` are computed (`tools.ts:299,312`; `evidence-loop.ts:461`) and used only for the loop's own epoch bookkeeping. `effectApplied` reaches `trace` but is stripped before storage (§5.3). |
| A state digest before/after each step | **Never taken on this path** | `captureStateDigest` exists on the binding (`binding.ts:100-107`, implemented at `domain/runtime/llm-evidence/tools.ts:329-352`) but the bootstrap loop call (`runtime/service.ts:1889-1927`) passes no digest hook at all. |

---

## 4. Can a build revise, delete or re-test a node it already proposed?

**No. Proposal is a single terminal emission of the whole Flow.**

- The decision grammar has exactly two shapes:
  `{kind:"tool_call", callId, toolId, input}` and `{kind:"complete", result}`
  (`evidence-loop.ts:70-72`, schema built at `:532-548`). There is no
  `propose_node`, `revise_node`, `delete_node` or `test_node`. The tool list is
  the five page tools (§1.1) and nothing else.
- `complete` carries the *entire* Flow script (`evidence-schema.ts:34-44`). There
  is no incremental or partial plan state anywhere in the loop.
- A completion the checker refuses is fed back and the model is asked again
  (`evidence-loop.ts:408-420`). The feedback is issue codes, plan paths, the
  accepted shape of each refused parameter, and a fixed instruction
  (`bootstrap-completion.ts:59-70,135-157`). **The model then re-emits the whole
  script from scratch** — there is no edit operation, and the previously proposed
  script is not even in the request (§3.1), only the refusal feedback is.
- **Nothing executes the proposed Flow during the build.** The plan is checked
  against the node registry and the domain's handle table
  (`bootstrap-completion.ts:100-124`), then persisted with `status: "proposed"`
  (`runtime/service.ts:1989`). Execution happens only after a separate
  `approve` → `apply` review (`runtime/service.ts:2093-2114`). So a proposed node
  is never re-tested against the page it was authored from.
- How many correction rounds exist: `maxConsecutiveUnusableDecisions = 3`
  (`runtime/loop-limits/flow-bootstrap-evidence-loop.ts:109`,
  `loop-limits/evidence-loop.ts:40`), applied as `maxStepsWithoutProgress` —
  three refusals **with the same issue set** ends the loop
  (`evidence-loop.ts:316-327`). A refusal with a *new* issue set resets that
  count to one (`:320-323`), with the far backstop `maxUnusableDecisionsInARow`
  defaulting to `min(12, maxIterations)` (`evidence-loop.ts:46,587-588`).
  `maxIterations` is the provider grant's call count, ceiling 64
  (`flow-bootstrap-evidence-loop.ts:97`, `loop-limits/evidence-loop.ts:28`).
- The `refusedPlan` path is a real but thin improvement: a refused Flow script
  carries "the plan its steps got as far as" so issue paths make sense
  (`bootstrap-completion.ts:94-99`, `accept.ts:39`). That plan is used only to
  look up parameter shapes for feedback; it is not handed back as something to
  amend.

The FEEDBACK_INSTRUCTION at `bootstrap-completion.ts:65-70` is itself a record of
this failure mode: "A live build authored the right acting steps, had each one
refused for a handle it had invented, and completed again with those steps
deleted and the wrong answer in their place." That is the predictable outcome of
re-emission-instead-of-edit.

---

## 5. What the model is told about a failure, and what the trace records

### 5.1 A recoverable refusal — the model is told a bare code

The domain throws `RecoverableToolRejection`
(`domain/runtime/llm-evidence/tool-rejection.ts:44-53`) for eight reasons:
`invalid_input`, `cross_origin`, `out_of_scope`, `no_progress`,
`target_unobserved`, `permission_required`, `sensitive_value`,
`no_repeating_structure` (`tool-rejection.ts:25-34`). `executeTool` converts it
(`tools.ts:325`) into evidence
`{schemaVersion:"web-llm-tool-result.v1", ok:false, code}`
(`tool-rejection.ts:55-57`) with `effectApplied:false` and
`resultCode: "web.action.rejected.<code>"`
(`domain/runtime/llm-evidence/vocabulary.ts:33-40`).

That is **the entire message**: a code and nothing else, by design — "a refusal
can never become a side channel for the page content the refusal was protecting"
(`tool-rejection.ts:1-5`). The model is not told which handle failed, what the
page looked like, or what would have worked. The generic decision instruction
tells it how to read the shape: "Treat a recoverable tool result shaped like
`{ok:false,code:string}` as feedback and choose a different evidence-gathering
action" (`evidence-loop.ts:37`).

### 5.2 A hard failure — the model is told nothing and the build ends

Anything that is not a `RecoverableToolRejection` propagates (`tools.ts:326`).
Every gateway failure is of this kind:
`throw new Error("web evidence snapshot capture failed")` (`capture.ts:95`),
`"web evidence interaction failed"` (`capture.ts:128`),
`"web evidence navigation failed"` (`tools.ts:281`), and `selectSession` when
zero or two clients are connected (`capture.ts:64`).

The loop catches it and **ends immediately**:
`catch { return failure("llm_evidence_loop.tool_failed", ...) }`
(`evidence-loop.ts:449-451`; the initial observation has the same shape at
`:280-282`). That becomes `flow_bootstrap.evidence_tool_failed`
(`runtime/flow-bootstrap/generation-failure.ts:264`) and the whole build is lost.
The model is never asked again and never learns what happened.

### 5.3 What the trace records — and what is then thrown away

Live, the trace entry carries `{iteration, decision, callId?, toolId?,
evidenceBytes?, effectApplied?, resultCode?, usage?}`
(`evidence-loop.ts:74-85`, written at `:467`).

- **On the failure path this is preserved.** `evidenceLoopStep`
  (`generation-failure.ts:388-394`) emits `{toolId, effectApplied?, resultCode?}`
  per step into the generation diagnostic, and `flowBootstrapEvidenceLoopFailure`
  / `...CompletionFailure` / `...PermissionRequiredFailure` all attach it
  (`:282,:306,:330,:356`).
- **On the success path it is stripped.** `createFlowBootstrapAdaptation` stores
  `sanitizeEvidenceLoopTrace(input.evidenceTrace)` (`runtime/service.ts:2067`),
  and that function (`runtime/service.ts:5931-5944`) rebuilds each entry as
  `{iteration, decision, callId?, toolId?, evidenceBytes?, usage?}` —
  **`resultCode` and `effectApplied` are dropped**. The audit detail
  (`evidenceTraceAuditDetail`, `:5946-5962`) is counts and a sorted set of
  toolIds.

So a successfully built Flow keeps a record that says *which tools ran, in what
order, how many bytes each returned* — and cannot say what any of them did, what
any of them acted on, or whether any of them failed.

### 5.4 Two special "failures" the loop answers itself

- A request already answered in this mutation epoch, or an observation no
  mutation has changed: the loop does not run the tool, moves the earlier result
  to the end of the evidence, and appends a note under `core.request_check`
  explaining `already_answered` / `already_observed`
  (`evidence-loop.ts:49-57,332-363`). Three in a row ends the loop as
  `repeat_without_progress` (`:340-343`).
- A refused completion: feedback under `core.completion_check`
  (`evidence-loop.ts:108,415`).

### 5.5 Permission is terminal on this path

`automationStudioFlowBootstrapActionPermissions.executeTool`
(`runtime/flow-bootstrap/action-permissions.ts:72-80`) wraps every call; if the
gate raised a request during that call it **throws**, ending the build with
`flow_bootstrap.permission_required` carrying the request
(`generation-failure.ts:344-359`). The comment at `action-permissions.ts:76-77`
is explicit: "Terminal: the build ends on the first action it was not permitted,
rather than handing the refusal back to the model to route around." Note the
domain also surfaces the same situation as a *recoverable* rejection code
`permission_required` (`press.ts:63`) — which path fires depends on whether the
gate raised a request for that callId.

---

## What would have to change

The brief's target — "exploration should itself BE the recording, editable and
re-testable in flight" — needs the following seams changed, and can reuse several
that already exist.

### Seams that would have to change

1. **`runtime/llm/evidence-loop.ts` — the loop must keep steps, not just
   evidence.** Today `evidence` (`:271`) holds results with no inputs, and
   `trace` (`:74-85`) holds inputs' *hashes* with no results. A recording needs
   one ordered list of `{callId, toolId, input, effect, outcome, evidenceRef,
   stateBefore, stateAfter}`. The minimum change is to retain `decision.input`
   alongside the evidence entry at `:466` and to return the step list from
   `runAutomationStudioLlmEvidenceLoop` (`:410`) rather than discarding it.
   `AutomationStudioLlmEvidenceLoopResult` (`:127-139`) is the contract to widen.
2. **`runtime/service.ts:1889-1927` — the bootstrap loop must take state
   digests.** The binding already exposes `captureStateDigest`
   (`runtime/llm/harness-options/binding.ts:100-107`, implemented at
   `domain/runtime/llm-evidence/tools.ts:329-352`), and the recovery exploration
   runner already brackets each action with it. The bootstrap call passes none.
   Without before/after digests, no reduction is possible (reuse §1 below).
3. **The completion contract must stop being one terminal string.**
   `AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_COMPLETION_SCHEMA`
   (`runtime/flow-bootstrap/plan/evidence-schema.ts:31`) and the decision union
   (`evidence-loop.ts:70-72`) together force whole-Flow re-emission. Making the
   proposal incremental means either (a) new decision kinds
   (`propose_step` / `amend_step` / `drop_step` / `test_step`) added to
   `buildAutomationStudioLlmEvidenceLoopDecisionSchema` (`:532-548`) with a draft
   plan held across iterations, or (b) making the draft an artifact the loop
   carries and shows back so the model amends what it can see. Either way
   `parseDecision` (`:550-560`) and `AutomationStudioLlmEvidenceLoopDecision`
   change.
4. **`assembleAutomationStudioFlowScriptPlan`
   (`runtime/flow-bootstrap/authoring/assemble.ts:53`) must be able to take steps
   Core derived, not only lines the model wrote.** It is currently a pure
   text→plan function. A recording-derived step (a dismissal that actually
   changed the page, a navigation that actually moved it) has no way in. Its
   input contract `AutomationStudioFlowScript`
   (`runtime/flow-bootstrap/authoring/contracts.ts`) is the type to widen, or a
   sibling assembler is needed that takes reduced exploration steps.
5. **`runtime/service.ts:5931` `sanitizeEvidenceLoopTrace` must stop dropping
   `resultCode` and `effectApplied`** if the stored adaptation is to say what the
   build did. The failure path already keeps both
   (`generation-failure.ts:388-394`), so the two records disagree today.
6. **`runtime/flow-bootstrap/adaptation.ts:290`
   `assertAutomationStudioBootstrapHasNoRecordingProvenance` is a hard wall.** It
   throws on *any key* matching `/recording|timeline/i` anywhere in the stored
   adaptation (`:297-299`). If exploration becomes a recording, this assertion
   and the policy behind it must be revisited deliberately, not tripped over.
7. **Re-testing needs an execution seam the build does not have.** A build ends
   at `status: "proposed"` (`runtime/service.ts:1989`) and execution happens only
   through `reviewFlowBootstrapAdaptation` → `applyFlowBootstrapAdaptation`
   (`:2112`, `:4063`). Re-testing a proposed step in flight means running one
   plan node against the live page from inside the loop — i.e. a new harness
   option whose implementation dispatches a node, gated by the same
   `AutomationStudioActionPermissionGate` that `action-permissions.ts:63-70`
   already builds.
8. **The window will lose the recording unless it is exempted.**
   `evidenceContextWindow` (`evidence-loop.ts:638-670`) dedupes by `toolId` and
   drops by bytes. A growing draft/recording shown back to the model needs either
   a reserved allocation or to live outside `evidence` entirely (in the
   `flowBootstrap` half of the packet, beside `routing`).
9. **`web.press_control`'s tidy-up conflicts with recording.** `pressControl`
   un-ticks a checkbox it ticked (`press.ts:68,79-84`). If the exploration is the
   recording, an undone action and a deliberate action must be distinguishable —
   which the reduction's `undone` drop reason already models (reuse §1).

### Already in place and directly reusable

1. **`runtime/exploration-reduction/` — the "exploration is the recording"
   primitive already exists.** `AutomationStudioExplorationStep`
   (`exploration-reduction/step.ts:63-74`) is exactly
   `{actionId, input?, effect, outcome, stateBefore, stateAfter}`.
   `reduceAutomationStudioExploration` (`exploration-reduction/reduction.ts:67-87`)
   returns the minimum replayable sequence with a receipt: every dropped step
   carries one of five reasons — `after_success`, `observation_only`,
   `did_not_succeed`, `changed_nothing`, `undone` (`reduction.ts:28-39`) — plus
   `stateChainIntact` as an honesty flag.
   `automationStudioExplorationStepsFromTrace`
   (`exploration-reduction/evidence-loop-trace.ts`) already adapts an evidence
   loop trace into steps, and its header (`:16-36`) names precisely the two gaps
   this report found independently: the trace carries no state digests and no
   inputs.
   **It is used only by the runtime recovery path** —
   `runtime/recovery/exploration-state/reduction-review.ts:80-102` and
   `runtime/recovery/annotation/exploration.ts:259-263` — and never by Flow
   Bootstrap; nothing under `runtime/flow-bootstrap/` imports it. A reduced
   exploration whose kept `actions` carry their `input` is, almost literally, the
   list of Flow steps the brief wants.
2. **The handle→parameter resolution seam.**
   `AutomationStudioLlmEvidenceRuntimeBinding.resolvePlanNodeParameters`
   (`runtime/llm/harness-options/binding.ts:154-169`) plus
   `AUTOMATION_STUDIO_PLAN_NODE_HANDLE_KEY` (`plan-node-handles.ts:39`) already
   turn an opaque `target.N` into a real selector, with `unchanged` / `resolved`
   / `refused` and a permission check per step. A Core-derived step would use the
   same call, unchanged.
3. **The permission gate is already per-action and already has a third answer.**
   `automationStudioFlowBootstrapActionPermissions`
   (`runtime/flow-bootstrap/action-permissions.ts:52-86`) checks both an
   exploration step and a Flow step, and `endedOnRequest` carries a request back
   to the person. Re-testing a proposed step in flight needs no new permission
   model, only a new caller.
4. **The routing observation loop is the pattern to copy.**
   `startAutomationStudioBuildRouting` (`runtime/route-state.ts:130-165`) already
   wraps `decide` and records a state after each new piece of evidence. It
   observes *host route state*, not the exploration itself, and is bounded to 6
   situations — but the wrapping mechanism (`runtime/service.ts:1900`) is exactly
   where a per-step recorder would hook in.
5. **`checkCompletion` as an in-flight gate** (`evidence-loop.ts:398-420`,
   `bootstrap-completion.ts:73`) is already the place where a proposal is judged
   while the model can still act. An incremental proposal would extend this rather
   than invent a new checkpoint.
6. **A recording→Flow pipeline already exists on the other side of the wall:**
   `RecordingFlowProposalArtifact` / `RecordingFlowActionCandidate`
   (`runtime/recording-flow-proposal.ts:13-67`), with destinations
   `{kind:"flow", writeMode:"append"|"replace_recording_derived"}` (`:40-42`).
   Whatever exploration-as-recording produces should probably land in a shape
   these surfaces can already review, rather than a third one.

---

## Not verified

- No live provider run and no unit test was executed. Every statement is read
  from source.
- I did not trace `applyFlowBootstrapAdaptation` (`runtime/service.ts:4063`) or
  the extension-side execution of `web.browser.navigate`, so I cannot say why the
  `everything-store` build's navigate "did not move the tab". Nothing in the
  authoring path explains it: the model writes a `url:` line, `assemble.ts` puts
  it in `parameterValues`, and `domain/output-nodes/payloads.ts:72` maps it to
  `{url}`. The cause is downstream of this seam.
- I did not read `runtime/flow-bootstrap/plan/validation.ts` (402 lines) or
  `authoring/condition.ts` in full; claims about validation come from call sites
  and module headers.
- `AutomationStudioHarnessOptionStage` values other than `gather`/`iterate` were
  not enumerated; I verified only that the bootstrap resolution supplies none.

## Open questions or contradictions found

1. **Two records of the same build disagree.** The failure diagnostic keeps
   `resultCode` and `effectApplied` per step (`generation-failure.ts:388-394`);
   the stored successful adaptation strips both (`runtime/service.ts:5933-5943`).
   A build that succeeded is less well recorded than one that failed.
2. **`permission_required` has two shapes.** The domain can return it as a
   recoverable rejection the model routes around (`press.ts:63`), while Core's
   gate treats the same situation as terminal (`action-permissions.ts:76-78`).
   Which fires depends on whether the gate raised a request for that callId. This
   sits awkwardly against the standing direction that a blocked action escalates
   to the person rather than being silently refused.
3. **The exploration-reduction module was built for exactly this problem and is
   not wired to the build.** Its own header says the trace lacks state digests
   and inputs; the build is the one caller that could supply both and supplies
   neither.
4. **`assertAutomationStudioBootstrapHasNoRecordingProvenance`
   (`adaptation.ts:290`) forbids the word "recording" anywhere in a bootstrap
   adaptation.** If exploration becomes the recording, this rule's intent needs
   restating before any implementation trips it.
