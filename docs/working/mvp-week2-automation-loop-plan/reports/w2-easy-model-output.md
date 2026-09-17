# w2-easy-model-output: the model writes lines, Core derives the rest

Worker report, 2026-09-17. FluxIQ Core only (`F:\!FluxIQ`, branch `dev`, based
on `9d7cc24`); nothing in this repository was edited. No live provider call was
made. Path prefix: `AS/` is
`packages/fluxiq/src/programs/automation-studio/`.

## Outcome

**Done**, for everything inside the files I own, with three things handed back
as diffs because they live in files another worker holds.

A model building a Flow now writes plain lines — `key: value`, one fact per
line, no brackets to balance, no quotes, nothing escaped — and Core derives the
schema version, every key, every id, every version, the output action, the
edges between consecutive steps, the dataset id, the record schema, the records
path and every parameter default. The nested JSON plan is still accepted
unchanged, so nothing that worked stops working.

In plain terms, this is what the model used to have to send to fill in a name
and press a button, and what it sends now:

```json
{"summary":"Enter a name and submit.","plan":{"schemaVersion":"0.1","router":{"name":"Website task",
"rules":[],"fallback":{"kind":"subflow","targetSubflowKey":"primary"}},"subflows":[{"key":"primary",
"name":"Complete website task","role":"primary","nodes":[{"key":"enter_name","definitionId":
"web.output.dom-type","definitionVersion":"1.0.0","parameters":{"selector":"[data-testid=name]",
"text":"Ada"},"outputActionId":"web.dom.type"}, …],"edges":[{"key":"enter_submit","source":
{"nodeKey":"enter_name","portId":"success"},"target":{"nodeKey":"submit","portId":"in"}}]}]}}
```

```text
flow: Enter a name and submit
step: type the name
  node: web.dom.type
  selector: [data-testid=name]
  text: Ada
step: submit the form
  node: web.dom.click
  selector: [data-testid=submit]
```

## What the model had to emit, counted

Read from the shape the evidence-guided call advertised
(`AS/runtime/flow-bootstrap/plan/evidence-schema.ts` at `9d7cc24`, 4,376 bytes
of JSON Schema) and from the three-node reply that shape produced, which is
held as a fixture in `AS/runtime/flow-bootstrap/tests/plan.test.ts` and is
1,110 bytes.

**Required keys, per level, before:**

| Level | Keys the model had to write |
| --- | --- |
| result | `summary`, `plan` |
| plan | `schemaVersion`, `router`, `subflows` |
| router | `name`, `rules`, `fallback` |
| router fallback | `kind`, `targetSubflowKey` |
| each Subflow | `key`, `name`, `role`, `nodes`, `edges` |
| each node | `key`, `definitionId`, `definitionVersion`, `outputActionId`, `parameters` |
| each edge | `key`, `source`, `target` |
| each endpoint (2 per edge) | `nodeKey`, `portId` |

For that three-step Flow that is **48 keys across 17 nested objects**, of which
the model's actual intent — which node, which selector, which text — accounts
for **8**.

**And eleven things it had to keep consistent across the reply:**

1. `router.fallback.targetSubflowKey` equals some `subflows[].key`.
2. every `router.rules[].targetSubflowKey` equals some `subflows[].key`.
3. exactly one Subflow carries `role: "primary"`.
4. every edge endpoint's `nodeKey` equals a node key **in the same Subflow**.
5. node, edge and Subflow keys unique, and all matching `^[a-z][a-z0-9_-]{0,63}$`.
6. `definitionVersion` equals the registry's exact version for that `definitionId`.
7. `outputActionId` equals the definition's fixed value, or one allowed value.
8. `source.portId` is an output of that definition; `target.portId` is an input.
9. no port reused unless the catalog marked it `multiple`.
10. every input port marked `required` connected; one connected acyclic graph.
11. a record output written to Core's record-set contract exactly — dataset id
    syntax, `schema.schemaVersion`, each field's `id`/`label`/`valueType`, the
    `writeMode` vocabulary, and `recordsPath` present or absent by node.

## What the model emits now

| Level | What it writes | What Core derives |
| --- | --- | --- |
| whole reply | one `flow: <sentence>` line | `summary`, `schemaVersion`, the whole Router, the fallback |
| each step | `step: <what it does>`, `node: <catalog id or label>` | node `key`, `definitionVersion`, `outputActionId`, position |
| each parameter | `<id>: <value>`, or `<id>.<path>: <value>` for a part of a structured one | every parameter it left out that declares a default |
| between steps | nothing | the edge, on the node's first output port into the target's first free input |
| a branch | `on <port>: go to <label>` | the edge, the port id, the endpoint objects |
| a named block | `subflow <label>:` … `end`, reached by `step: run subflow <label>` | the Subflow key, role, and the Router rule that reaches it |

**A typical step, before and after.** `web.dom.type` (Type Text) declares
`target`, `selector` (required), `element`, `visualTarget`, `timeoutMs`
(default 10,000), `text` (required, default `""`) and `expectedState`.

| | Fields the model writes | Fields on the created node |
| --- | --- | --- |
| Before | `key`, `definitionId`, `definitionVersion`, `outputActionId`, `parameters`, `parameters.selector`, `parameters.text`, plus the edge's `key`, `source.nodeKey`, `source.portId`, `target.nodeKey`, `target.portId` — **12** | `selector`, `text` |
| After | `step:`, `node:`, `selector:`, `text:` — **4** | `selector`, `text`, `timeoutMs: 10000` |

The created node gained `timeoutMs` without the model writing it: a parameter
with a default is now materialised explicitly, so a person opening the Flow in
the UI sees the value the step will use instead of a blank. A parameter with no
default and no requirement — `expectedState` here — is left absent; nothing is
invented for a node that does not ask for it. Both are tested
(`authoring/tests/script.test.ts`, "writes in the default of every parameter the
model left out, and leaves the rest absent").

**Byte cost.**

| | Before | After |
| --- | --- | --- |
| The shape advertised to the model | 4,376 bytes of JSON Schema | 2,134 bytes, of which 1,714 is the format and its worked example |
| A three-step reply | 1,110 bytes | 366 bytes (344 of them the Flow itself) |

The format is described in the completion schema's `description`, which
`buildAutomationStudioLlmEvidenceLoopDecisionSchema` copies verbatim under
`decision.result` (`AS/runtime/llm/evidence-loop.ts:525`), and the provider
serialises the whole context, decision schema included, into the user message.
The advertised shape got 2,242 bytes **smaller** even though it now carries a
worked example.

## The format

Grammar, in full (`AS/runtime/flow-bootstrap/plan/flow-script-format.ts` is what
the model is shown; `authoring/parse.ts` is what reads it):

- A line is `key: value`. The **first** colon ends the key; everything after it
  is the value exactly as written. A value may therefore contain colons,
  quotes, braces or commas, and **nothing is ever escaped**:
  `url: https://shop.test/members?tab=all` round-trips verbatim (tested).
- A line with **no colon** continues the value above it on a new line. That is
  how a value spans lines — no terminator, no quoting, no escape:
  `text: The member was renamed.` / `It may take a moment to appear.` becomes
  one value with a newline in it (tested).
- Blank lines and indentation mean nothing at all, so whitespace can never
  change meaning.
- Keys match ignoring case, spaces, `-` and `_` (`authoringKey`), plus a small
  synonym table (`link`/`address`/`page` → `url`, `columns` → `fields`,
  `records`/`dataset` → `recordOutput`, …).
- A line the parser cannot place is a **warning**, not fatal:
  `flow_script.unrecognized_line`, carrying the line number. A model that opens
  with "I will now build the Flow" still gets its Flow (tested).
- Comments: a line starting `#` or `//` is ignored. `end` alone closes a block.

**Branching**, exactly as the coordinator specified, with one adjustment forced
by the plan contract:

- Sequence is the default. A linear Flow carries no edge line at all, and the
  edges Core derives are the same ones a hand-written JSON plan carried:
  `s1:success>s2:in`, `s2:success>s3:in` (asserted).
- `step <label>: <what it does>` gives a step a free-form label, matched
  case-insensitively. Labels are the only way one step names another.
- `on <port>: go to <label>` sends one output port to a labelled step. The port
  is matched against the ids and labels the catalog shows for that node, plus
  role synonyms (`failure`/`error` → the port with role `failure`). A port with
  no line falls through to the next step in order; a port a branch claims does
  not also carry the fall-through edge.
- `subflow <label>:` … `end` is a named block; `step: run subflow <label>`
  reaches it.
- **Adjustment, and why.** The plan contract has no node that calls a Subflow:
  `AutomationStudioFlowBootstrapEdge` connects two nodes inside one Subflow, and
  the only way a plan reaches a non-primary Subflow is a Router rule
  (`plan/contracts.ts:31-46`). `builtin.routine.subroutine` is not it — its
  `routineId` references a *saved routine*, so pointing it at a bootstrap
  Subflow key would build a Flow that fails when it runs. So
  `step: run subflow <label>` becomes a **Router rule** targeting that Subflow,
  with the label as its route tag, and creates no node. The block itself becomes
  a `plan.subflows[]` entry with role `utility` unless a `role:` line says
  otherwise. Tested: the two-block script produces
  `subflows [["main","primary",1],["read-prices","utility",1]]` and
  `rules [{key:"r1", targetSubflowKey:"read-prices", routeTags:["read prices"]}]`.
- A branch may not cross a block (`flow_script.branch_across_blocks`), because
  an edge cannot.

## What is normalised rather than refused

All of it in one place, `AS/runtime/flow-bootstrap/authoring/`, called from one
door (`acceptAutomationStudioFlowBootstrapResult`), which
`checkAutomationStudioFlowBootstrapCompletion` now calls before anything else.

- A bare string where an object belongs: `target: control.7` →
  `{"handle":"control.7"}`.
- One item where a list belongs; a comma-separated line where a list belongs.
- A known synonym key, at node level and inside a record output.
- A value at the **node's** top level rather than inside `parameters`: a key
  naming a declared parameter is moved in; a `handle`/`location` pair at node
  level moves into the node's one object parameter, or into `target` when there
  are several.
- `true`/`yes`/`on` and `false`/`no`/`off` for a boolean; a numeric string for a
  number; a number or boolean for a string.
- A dotted key builds a nested value without any JSON:
  `extractList.fields.name: product-name`.
- A record output is completed from what the node already knows (below).
- Defaults are materialised.

## Every campaign failure code, and what addresses it

| Code | Written by the model | Now | Where |
| --- | --- | --- | --- |
| `record_output.unknown_key` | `{dataset, columns, mode, notes}` | keys mapped to `datasetId`, `schema`, `writeMode`; a key that is neither the contract's nor a spelling of one is **dropped with a warning**, never carried into the Flow | `authoring/record-output.ts` |
| `record_output.invalid_dataset_id` | `datasetId: "Product Catalogue"` | `"Product-Catalogue"`, derived from the name that was written; failing that, from the step's own words | `authoring/keys.ts` `authoringDatasetId` |
| `record_schema.not_object` | `schema: ["name","price","rating"]` | `{schemaVersion:"0.1", fields:[{id,label,valueType}…]}`, labels titleised and de-duplicated, value types mapped (`text`→`string`, `link`→`url`, …) | `authoring/record-output.ts` |
| `record_output.missing_records_path` | no `recordsPath`, or a guessed one | the node's own path is used: dropped when the definition declares `metadata.recordsPath`, replaced for `builtin.data.write-records` | `authoring/record-output.ts` via `automationStudioFlowBootstrapSuppliedRecordsPath` |
| `web.handle.misplaced` | `handle` at the node's top level | moved into the parameter that takes one, with its `location` | `authoring/json-plan.ts` `writtenParameters` |
| `web.handle.malformed` | a bare name where the reference object belongs | wrapped as `{"handle": …}`; in the line format a handle is just `target: control.7` | `authoring/values.ts` |

Each record-output row is proved **from both sides** in
`authoring/tests/accept.test.ts`: the value as written is still refused by
`automationStudioFlowBootstrapRecordOutputIssues` with that exact code, and the
value after normalisation is accepted by the same function. A record output
that names a dataset but no columns anywhere is still refused, as
`record_schema.not_derivable`, with the contract's keys and example fed back.

## What is still refused, and what the refusal says

Genuine ambiguity only, each naming the slot and what was accepted:

- `flow_script.unknown_label` — "The branch at line 4 goes to \"nowhere\", which
  labels no step."
- `flow_script.duplicate_label` — "The label \"warn\" names more than one step;
  a label names one step."
- `flow_script.unknown_port` — "The branch at line 4 names the port \"maybe\";
  this node declares success, failed."
- `flow_script.unknown_node` — the near matches by catalog id, or "names no node
  in nodeCatalog".
- `flow_script.branch_across_blocks`, `flow_script.no_steps`,
  `flow_script.too_many_lines`.
- `bootstrap.unknown_parameter` — unchanged, and still answered with the node's
  parameter ids by the existing feedback machinery.
- `bootstrap.invalid_parameter_value` — a value no reading makes into the
  declared type (an object where a string belongs).
- `record_schema.not_derivable` — a dataset with no columns to save in it.

## Validation after normalisation is unchanged

The plan the acceptor returns still goes through
`parseAutomationStudioFlowBootstrapPlan`, the evidence profile limits,
`resolveAutomationStudioFlowBootstrapPlanParameters` and
`validateAutomationStudioFlowBootstrapPlan`, in that order and untouched. No
check was removed or weakened, and nothing a created Flow may contain was
widened: `plan/parsing.ts`, `plan/validation.ts` and
`plan/record-output-contract.ts` are byte-for-byte unchanged.

Three existing tests asserted refusals that are now normalisations. Each was
rewritten to a case that is still genuinely unreadable, not deleted:

- `service-bootstrap/tests/rejections.test.ts`: "wrapper shape" was
  `{summary, plan, unexpected:true}` → now `{}`; "plan structure" was
  `schemaVersion: "0.2"` → now a Subflow with no nodes; "evidence profile
  limits" was a 241-character summary → now 17 nodes in one Subflow.
- `service-bootstrap/tests/plan-parameters.test.ts`: the refused value was
  `text: 42` on a string parameter (now read as `"42"`) → now
  `text: {value:"Ada"}`, which no reading makes into a string.
- `harness-options/tests/bootstrap-completion.test.ts`: the record-output
  refusal was `{name, fields}` (now read) → now a dataset with no columns. A
  test was added there asserting the *accepted* case builds, and another
  asserting the handle a built plan carries is the reference shape the resolver
  reads.

## Catalog: parameters are never trimmed away

Proved in `plan/tests/catalog.test.ts`, "what the catalog may never trim away".
The smallest budget at which the catalog offers anything at all is **473 bytes**
(found by binary search in the test itself; at 472 it offers nothing). At that
budget, and at 673, 2,000, 6,000, 20,000 and the full 49,152, every offered
entry's parameter list is asserted **field by field** against the definition:
`id`, `type`, `required`, `defaultValue`, `options`, `constraints`, and the
input and output port counts.

The condensed form is exercised: at 473 bytes the single entry's parameter JSON
is 74 bytes against 228 whole — only the structured parameter's prose was
dropped, and the contract is identical. No fix to the trimming order was needed:
`compactDefinition` already maps every parameter in both forms and only the
description length differs (`plan/catalog.ts:121-141`,
`plan/parameter-text.ts:33-52`). The test is what stops that changing.

## Diffs for files I do not own

Nothing below is needed for the evidence-guided path — the one the campaign
runs. It already works end to end with no change to any file another worker
holds, because the reply still arrives as JSON with **one string field in it**.
These diffs are for the two remaining JSON surfaces.

### What remains JSON, and why

1. **The decision envelope.** The evidence loop's reply is
   `{"kind":"evidence_tool_decision","summary":"…","decision":{"kind":"complete","result":{…}}}`.
   It stays JSON because the loop has to tell a tool call from a completion
   before it reads either, and because DeepSeek is asked for
   `response_format: {type:"json_object"}` (`deepseek-provider.ts:450`). What
   changed is that `result` is now `{"flow":"<the whole Flow as lines>"}` — one
   string, no nesting, no per-key quoting. The only escape left anywhere is
   `\n` between lines inside that one JSON string.
2. **The non-evidence `flow_bootstrap` task.** The `else` branch of
   `generateFlowBootstrapAdaptation` in `service.ts` (around line 1969) still uses
   `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_OUTPUT_SCHEMA`, the nested plan, because
   its reply is parsed into `{kind:"flow_bootstrap", summary, plan}` by
   `harness/provider-result.ts` and `deepseek-provider.ts`, both of which are
   yours. That path is the first-live, no-exploration build; the campaign does
   not use it.

### Diff 1 — `AS/runtime/llm/harness/structured-response.ts`

The brief named `AS/runtime/llm/structured-response.ts`; the file is at
`AS/runtime/llm/harness/structured-response.ts`. Let the `flow_bootstrap`
variant carry a script instead of a plan.

```diff
@@
 export type AutomationStudioLlmStructuredResponse =
-  | { kind: "flow_bootstrap"; summary: string; plan: AutomationStudioFlowBootstrapPlan; metadata?: JsonObject }
+  // `flow` is the line-oriented Flow script
+  // (`flow-bootstrap/plan/flow-script-format.ts`); `plan` is the nested shape
+  // that preceded it. Exactly one of the two is present, and
+  // `acceptAutomationStudioFlowBootstrapResult` reads either.
+  | { kind: "flow_bootstrap"; summary: string; plan?: AutomationStudioFlowBootstrapPlan; flow?: string; metadata?: JsonObject }
   | { kind: "evidence_tool_decision"; summary: string; decision: { kind: "tool_call"; callId: string; toolId: string; input: JsonObject } | { kind: "complete"; result: JsonObject }; metadata?: JsonObject }
@@
 export function stripAutomationStudioLlmResponseMetadata(response: AutomationStudioLlmStructuredResponse): AutomationStudioLlmStructuredResponse {
-  if (response.kind === "flow_bootstrap") return { kind: response.kind, summary: response.summary, plan: response.plan };
+  if (response.kind === "flow_bootstrap") {
+    return {
+      kind: response.kind,
+      summary: response.summary,
+      ...(response.plan ? { plan: response.plan } : {}),
+      ...(response.flow !== undefined ? { flow: response.flow } : {})
+    };
+  }
@@
 export function summarizeAutomationStudioLlmResponse(response: AutomationStudioLlmStructuredResponse): JsonObject {
-  if (response.kind === "flow_bootstrap") return { kind: response.kind, subflowCount: response.plan.subflows.length, nodeCount: response.plan.subflows.reduce((count, subflow) => count + subflow.nodes.length, 0), edgeCount: response.plan.subflows.reduce((count, subflow) => count + subflow.edges.length, 0) };
+  if (response.kind === "flow_bootstrap") {
+    const subflows = response.plan?.subflows ?? [];
+    return {
+      kind: response.kind,
+      subflowCount: subflows.length,
+      nodeCount: subflows.reduce((count, subflow) => count + subflow.nodes.length, 0),
+      edgeCount: subflows.reduce((count, subflow) => count + subflow.edges.length, 0),
+      ...(response.flow !== undefined ? { flowLines: response.flow.split("\n").length } : {})
+    };
+  }
```

`stripAutomationStudioLlmResponseMetadata` must keep `flow` or the script is
dropped between the provider and the caller. Everything else in that file is
untouched.

### Diff 2 — `AS/runtime/llm/harness/provider-result.ts`

```diff
@@
   const commonFields = ["kind", "summary", "metadata"];
   rejectUnexpectedFields(value, kind === "flow_bootstrap"
-    ? [...commonFields, "plan"]
+    ? [...commonFields, "plan", "flow"]
@@
   if (kind === "flow_bootstrap") {
-    const parsed = parseAutomationStudioFlowBootstrapPlan(value.plan);
-    diagnostics.push(...parsed.issues.map((issue) => ({ ...issue, severity: issue.severity, path: issue.path ? `response.${issue.path}` : "response.plan" })));
+    // A script is checked where every other shape is: by the acceptor, against
+    // the registry. Here it only has to be a bounded string.
+    if (typeof value.flow === "string") {
+      if (!value.flow.trim() || value.flow.length > 12_000) {
+        diagnostics.push({ severity: "error", code: "llm_output.invalid_flow", message: "A Flow script must be a bounded, nonempty string.", path: "response.flow" });
+      }
+    } else {
+      const parsed = parseAutomationStudioFlowBootstrapPlan(value.plan);
+      diagnostics.push(...parsed.issues.map((issue) => ({ ...issue, severity: issue.severity, path: issue.path ? `response.${issue.path}` : "response.plan" })));
+    }
   } else if (kind === "evidence_tool_decision") {
```

`harness/output-validation.ts:21` also reads `response.plan` for a
`flow_bootstrap` response; it needs the same "only when there is no `flow`"
guard. I did not read enough of that function to write its diff; it is three
lines from the same shape.

### Diff 3 — `AS/runtime/llm/deepseek-provider.ts`

```diff
@@ around line 546
-  if (request.taskKind !== "runtime_patch") return request.taskKind === "flow_bootstrap" ? AUTOMATION_STUDIO_FLOW_BOOTSTRAP_OUTPUT_SCHEMA : undefined;
+  // The Flow's own shape is no longer a schema: it is the line format, stated
+  // once in `AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT`, and the reply carries it
+  // as one string under `flow`.
+  if (request.taskKind !== "runtime_patch") return request.taskKind === "flow_bootstrap" ? AUTOMATION_STUDIO_FLOW_BOOTSTRAP_SCRIPT_OUTPUT_SCHEMA : undefined;
@@ around line 462
   const systemPromptBase = request.taskKind === "flow_bootstrap"
-    ? `${AUTOMATION_STUDIO_DEEPSEEK_SYSTEM_PROMPT} ${AUTOMATION_STUDIO_FLOW_BOOTSTRAP_SCHEMA_INSTRUCTION} ${AUTOMATION_STUDIO_FLOW_BOOTSTRAP_COMPACT_OUTPUT_INSTRUCTION}`
+    ? `${AUTOMATION_STUDIO_DEEPSEEK_SYSTEM_PROMPT} ${AUTOMATION_STUDIO_FLOW_BOOTSTRAP_SCHEMA_INSTRUCTION} ${AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT}`
@@ around line 689
   if (request.taskKind !== "flow_bootstrap") return structured as AutomationStudioLlmStructuredResponse;
   if (!isRecord(structured)
-    || Object.keys(structured).some((key) => !["kind", "summary", "plan"].includes(key))
+    || Object.keys(structured).some((key) => !["kind", "summary", "plan", "flow"].includes(key))
     || structured.kind !== "flow_bootstrap"
     || typeof structured.summary !== "string"
     || structured.summary.trim().length === 0
     || structured.summary.length > AUTOMATION_STUDIO_FLOW_BOOTSTRAP_LIMITS.maxStringLength) outputInvalid();
+  if (typeof structured.flow === "string") {
+    if (!structured.flow.trim() || structured.flow.length > AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_LIMITS.maxResultBytes) outputInvalid();
+    return { kind: "flow_bootstrap", summary: structured.summary, flow: structured.flow };
+  }
   const parsed = parseAutomationStudioFlowBootstrapPlan(structured.plan);
```

`AUTOMATION_STUDIO_FLOW_BOOTSTRAP_SCRIPT_OUTPUT_SCHEMA` does not exist yet; it
is the four-line sibling of the evidence one, and I will add it to
`plan/flow-script-format.ts` on request rather than guess at your sequencing:

```ts
export const AUTOMATION_STUDIO_FLOW_BOOTSTRAP_SCRIPT_OUTPUT_SCHEMA: JsonObject = {
  type: "object", additionalProperties: false, required: ["kind", "summary", "flow"],
  description: AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT,
  properties: { kind: { const: "flow_bootstrap" }, summary: { type: "string", minLength: 1, maxLength: 240 }, flow: { type: "string", minLength: 1, maxLength: 12_000 } }
};
```

That branch of `service.ts` then calls
`acceptAutomationStudioFlowBootstrapResult({ result: { summary, flow }, registry, resolution })`
in place of `parseAutomationStudioFlowBootstrapPlan(result.response.plan)`, and
the rest of that branch is unchanged. `containsForbiddenBootstrapKey` in
`deepseek-provider.ts` still has to run over the reply; a Flow script is a
string, so it passes it trivially, but I did not read that function closely
enough to promise it needs nothing.

### Optional, for a genuinely plain-text wire

If you also want DeepSeek to reply in text rather than JSON at all, the change
is `response_format: { type: "json_object" }` → dropped, and the decision
envelope replaced by two leading lines the same parser reads
(`tool: <id>` / `input.<key>: <value>`, or `complete:` followed by the Flow).
That is a larger change to `deepseek-provider.ts` and `evidence-loop.ts` and I
did not write it: the gain over one JSON string field is one `\n` escape, and
the loss is the envelope's unambiguity. I recommend not doing it.

## Files changed

All in `F:\!FluxIQ`. Nothing committed.

New, `AS/runtime/flow-bootstrap/authoring/`:
`accept.ts`, `assemble.ts`, `contracts.ts`, `index.ts`, `issue.ts`,
`json-plan.ts`, `keys.ts`, `matching.ts`, `normalise.ts`, `parse.ts`,
`record-output.ts`, `values.ts`, and `tests/script.test.ts`,
`tests/accept.test.ts`.

New elsewhere: `AS/runtime/flow-bootstrap/plan/flow-script-format.ts`,
`AS/runtime/flow-bootstrap/plan/tests/index.ts` (a fixture barrel, so a test
outside that directory may reach the web-domain fixture without reaching past
a barrel).

Changed: `AS/runtime/flow-bootstrap/index.ts` (publishes authoring),
`AS/runtime/flow-bootstrap/plan/index.ts` (publishes
`flow-script-format.ts` and `record-output-contract.ts`; authoring is published
from the parent barrel instead, so the two cannot form a cycle),
`AS/runtime/flow-bootstrap/plan/evidence-schema.ts` (the completion schema),
`AS/runtime/llm/harness-options/bootstrap-completion.ts` (calls the acceptor),
and five test files.

Two structural notes. The `authoring/` directory sits at
`flow-bootstrap/authoring/`, not `flow-bootstrap/plan/authoring/`, because the
audit's 9-segment depth limit refuses the latter. The handle key is declared in
`authoring/values.ts` rather than imported from
`llm/harness-options/plan-node-handles.ts`, because that directory imports this
one and the import would close a module cycle — the exact fault the audit's
`importBoundaries` entry exists to prevent. The two are held equal by a
behavioural test in `harness-options/tests/`, which builds a plan through the
acceptor and asserts `automationStudioPlanNodeHandleSites` sees a reference.

## Commands run and observed results

From `F:\!FluxIQ\packages\fluxiq` unless stated.

- `FLUXIQ_TEST_ENV_FILES=none npx vitest run src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/runtime/llm`
  → `Test Files 38 passed (38)`, `Tests 511 passed (511)`.
- `FLUXIQ_TEST_ENV_FILES=none npx vitest run src/programs/automation-studio`
  → `Test Files 2 failed | 234 passed (236)`, `Tests 2 failed | 2092 passed | 1 skipped (2095)`.
  Both failures are examined below; neither is mine.
- `npx tsc --noEmit -p packages/fluxiq` (from `F:\!FluxIQ`) → no output, exit 0.
- `node scripts/structure-audit.mjs` (from `F:\!FluxIQ`) →
  `structure-audit: passed (159 warning(s), 361 baselined)`.
- No provider call of any kind. `FLUXIQ_TEST_ENV_FILES=none` on every run.

**The two failures in the wider run.**

1. `runtime/tests/service-adaptation/tests/llm-diagnosis.test.ts`, "captures
   sanitized failure evidence once …": expects `maxEvidenceBytes: 2400`, gets
   `3000`. That number is computed in
   `AS/runtime/recovery/annotation/annotate.ts:165`, which is another worker's
   area and is **unmodified in the working tree** — `git status` in Core lists
   only my eleven files. So it fails on the committed tree as well. Not mine,
   and I did not touch it.
2. `runtime/tests/deepseek-bootstrap-exploration.test.ts`, "asks again after a
   decision that runs past its deadline": fails inside the full-suite run and
   **passes twice when run alone** (46.8 s for that file, the case itself
   5.5 s). It is a wall-clock deadline test; this machine's known behaviour
   under load explains it. I ran it alone twice to be sure.

## Not verified

- **No live provider call, by instruction.** That the model *produces* better
  replies in this format is not demonstrated — only that every reply shape I
  could write, and every captured shape I could reconstruct, is now read.
- **No byte-identical captured reply was replayed.** I looked for raw
  `flow_bootstrap` completion bodies under
  `C:\Users\mrjoh\AppData\Local\Temp\claude\context-audit\requests`,
  `test-runs/campaigns/2026-09-17T02-23-20-255Z/logs` and the per-run
  `snapshots/` of `run-mu4x7und-4a367e42`, `run-mu4yk4u1-60a1c3a4` and
  `run-mu4wwkbc-df6cfe60`. The captured request bodies are all
  `runtime_diagnosis` / `runtime_patch` / `evidence_tool_decision` from the
  recovery loop; the runs record a Flow's *shape* (`flow-lane.json`), not the
  reply. The six failure codes in my brief do not appear anywhere in the
  campaign logs either. What I replayed instead is the canonical JSON reply
  fixture held in `flow-bootstrap/tests/plan.test.ts` — the shape the
  evidence-guided contract asked for, three real web-domain nodes with keys,
  versions, output actions and edges — plus hand-written near-misses of each of
  the six codes. If a raw captured body exists somewhere I did not look, it is
  worth running through the acceptor before this ships.
- **The format text reaching the wire is read, not run.** I verified that
  `buildAutomationStudioLlmEvidenceLoopDecisionSchema` copies the completion
  schema verbatim under `decision.result` (`evidence-loop.ts:525`) and that the
  provider serialises `request.context` into the user message
  (`deepseek-provider.ts:486`). I did not build a request body and grep it for
  the format text, because the only test that does so lives in `llm/tests/`.
- **Diffs 1-3 are untested.** They are written against the current text of
  files I do not own and were never compiled.
- `harness/output-validation.ts` needs the same `flow`-aware guard as
  `provider-result.ts`; I read its first lines only and did not write its diff.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run** — only the three
  checks the brief named, plus the wider `automation-studio` suite.
- **The downstream repository was not touched or exercised.** The web domain's
  `resolve-plan-node.ts` is what finally resolves a handle; I tested against
  Core's copy of the domain's definitions
  (`plan/tests/web-domain-definitions-fixture.ts`), not against the domain.

## Open questions and contradictions found

1. **`step: run subflow <label>` cannot be a node.** Stated above with the
   file:line reason. If the intent was that a Subflow is *called* mid-sequence
   and control returns, the plan contract cannot express it and a new node
   would have to exist in Core first. What I built is "the Router can reach this
   block", which is what the contract offers.
2. **A bare word for an object parameter becomes a handle.** `target: submit`
   becomes `{"handle":"submit"}` and is then refused by the domain as a handle
   it never issued, rather than refused here as "not a handle". The refusal is
   correct and the feedback names the handle slot, but the code the model sees
   is the domain's. Say if you would rather Core refuse it first.
3. **Warnings are collected and currently discarded.** The acceptor returns
   `issues` on success — `flow_script.unrecognized_line`,
   `record_output.dropped_key` — and `checkAutomationStudioFlowBootstrapCompletion`
   drops them on the `ok: true` path. They belong on the adaptation record, so a
   person can see that a line was not read. That is a small follow-up I did not
   take because the adaptation record is outside my files.
4. **`maxEvidenceBytes` 2400 vs 3000** is failing on Core's `dev` tree
   independently of this work. Whoever owns `runtime/recovery/` should see it.
