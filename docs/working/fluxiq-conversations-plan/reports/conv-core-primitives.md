# conv-core-primitives — what FluxIQ Core already has for talking to a person

Read-only investigation of FluxIQ Core (`F:\!FluxIQ`) at `dev` / `bf8792b`.
Nothing was changed. All paths below are relative to `F:\!FluxIQ`.

## Outcome

Done. All five questions answered with file:line evidence, plus the
"what ends an interaction" survey and the closing attachment section.

Headline: **Core has no conversation, thread, message or turn concept
anywhere.** It has exactly one shape for "the automation has a question for a
person" — `automation-studio.action-permission-request.v1` — and that shape was
deliberately written as a *terminal* payload that ends the run rather than
parking it. Everything else that reaches a person is either an append-only
record they read after the fact, or a UI toast that lives in one browser tab.

---

## 1. Every mechanism by which Core says something to a person

Twelve exist. For each: what it carries, where it is persisted, whether a
person can reply.

### 1a. Action permission request — the only "question"

- Type: `packages/fluxiq/src/programs/automation-studio/runtime/action-permissions/request.ts:52-78`.
- Carries: `requestId`, `requestedAtMs`, `action {kind,id,ref,verb}`,
  `control {name,kind}`, `consequences[]`, `missing[]`,
  `reason {stage, instructionIds[]}`, `authority {granted[], instructed[]}`,
  and `sentence` — Core's own English sentence, never a model's
  (`request.ts:76-77`, built at `request.ts:90-110`).
- Persisted: **on the recovery path only**, into the run record at
  `metadata.permissionRequest`
  (`runtime/recovery/annotation/annotate.ts:449-451`), which lands in
  `project.sqlite` via the runtime stream store or in the legacy
  `runtime/runs/{runId}/run.json`
  (`runtime/service/run-detail-read/flow-run-detail-reader.ts:31-34`).
  **On the authoring path it is not persisted at all** — it exists only in the
  program-API response body (`api/handlers/llm-generation.ts:130-139`).
- Reply: yes, but only as a *new run* carrying a wider grant. See §3.
- Note the header comment at `request.ts:1-12`: "**It ends the run; it does not
  park it.** … There is no pending request store and no resumable run,
  deliberately (the user's decision). But the payload is written so that
  parking can be added without changing it: `requestId` is the key a store
  would hold it under, and nothing in it assumes the run has already ended."
  That is the single most important sentence in Core for this plan.

### 1b. Flow-bootstrap generation diagnostic

- Type: `runtime/flow-bootstrap/generation-failure.ts:168-216`; code vocabulary
  at `:100-158`.
- Carries: `code`, `stage`, `retryable`, `providerInvocation`,
  `providerResponse`, optional `accounting` (tokens/cost), `evidenceLoop`
  (iteration/decision/tool-call counts and per-decision `{toolId, resultCode}`),
  `issueCodes[]` (codes only, max 16, never a message — `:203-208`), and
  `permissionRequest` when and only when the code is
  `flow_bootstrap.permission_required` (`:242-243`).
- Persisted: **nowhere.** It is thrown, parsed out of the error, and returned
  in the endpoint's payload (`api/handlers/llm-generation.ts:129-141`). Close
  the tab and it is gone.
- Reply: no. The panel turns it into prose
  (`apps/web/src/features/automation-studio/authoring/BlankFlowAuthoringPanel.tsx:76-85`).

### 1c. Run detail — interventions, receipts, traces

- Type: `model/flow-adaptation.ts:348-364`. Interventions at `:297-315`
  (`kind`, `reason`, `promptVersion`, `provider`, `model`, `instructionIds`,
  `contextSummary`, `structuredResult`, `validation`, `tokenUsage`).
- Carries also: `metadata.llmGate` — provider call records, cost accounting,
  `patchSkipped`/`patchSkippedCode`/`patchHeldCode`, the permission summary,
  `recoveryContext`, `structuredDiagnosis`, diagnostics
  (`runtime/recovery/annotation/annotate.ts:428-448`), plus
  `runtimePatchAttempts` and `recoveryTrace` (`:452`).
- Persisted: typed rows in `runtime_runs` + `runtime_event_chunks`
  (`storage/project/schema/domain-resources.ts:281-312`), or the legacy JSON
  detail file; read back through
  `runtime/service/run-detail-read/flow-run-detail-reader.ts:25-43`.
- Reply: no. Read-only forensics.

### 1d. Adaptations and change proposals — the one real review surface

- Types: `model/flow-adaptation.ts:414-437` (adaptation, with
  `status`, `author`, `riskLevel`, `diagnosis`, `patch[]`,
  `validationResults`), and `:209-227` (change proposal, with `status`,
  `createdBy`, `reviewedBy`, `reviewedAt`).
- Persisted: `adaptations`, `adaptation_evidence`, `adaptation_artifacts`,
  `adaptation_audit_events` (`storage/project/schema/table-names.ts:35-38`;
  audit table DDL at `schema/adaptations.ts:34-45`, which has an `actor_id`,
  `from_status`, `to_status` and a **free-text `reason` column**).
- Reply: **yes, and it is the closest thing Core has to a person answering.**
  `review-flow-adaptation` takes
  `action: "approve" | "reject" | "apply" | "disable" | "revert" | "supersede"
  | "request_validation" | "switch_manual"` plus an optional free-text
  `reason` (`api/contracts/adaptation.ts:166-172`; handler at
  `api/handlers/runs.ts:131-153`; service at `runtime/service.ts:3933-3953`).
  The panel is the "adaptation inbox"
  (`apps/web/src/features/automation-studio/adaptations/functionality-contract.ts:32`).
  It is a state machine with a comment field, not a dialogue: one decision per
  artifact, no follow-up question, no reply from Core.

### 1e. Policy proposal approval

- `approve-policy-proposal` (`api/contracts/endpoints.ts:94`, handler
  `api/handlers/recordings.ts:324-335`). A person approves a policy mined from
  a recording. Same shape as 1d: one-shot approve, no dialogue.

### 1f. Client gateway audit log

- `packages/fluxiq/src/client-gateway/service/audit-log.ts:6-27`. Entry type
  `ClientGatewayAuditEntry { id, timestamp, sessionId?, type, message,
  metadata? }` (`packages/contracts/src/client-gateway.ts:167-174`).
- **In-memory only** — a private array on the instance, no store, no file. The
  last 100 entries are handed out in the gateway snapshot
  (`client-gateway/service/views.ts:48`, `AUDIT_LOG_SNAPSHOT_ENTRIES = 100` at
  `:9`). A restart erases it.
- Recorded at: pairing created/dismissed/rejected/paired
  (`service/pairing-flow.ts:62,93,125,153`), session
  connected/disconnected/reconnected/credential-rejected
  (`service/lifecycle.ts:54,65,100,118`), trust revoked (`service/access.ts:65`),
  command dispatched and client error (`service/commands.ts:78,103`).
- Reply: no. But the **pairing challenge itself** is a genuine person-answers-a-
  prompt flow (`service/pairing-flow.ts`), and is the only other one in Core.

### 1g. Run dataset audit events

- `storage/project/run-dataset-store.ts:31-40`; table at
  `storage/project/schema/run-datasets.ts:48-58`. Types: `exported`,
  `export_truncated`, `export_failed`, `deleted`. Ids and counts only — "no
  free-text column" is stated in the migration header (`schema/run-datasets.ts:1-3`).
- Persisted in `project.sqlite`. Reply: no.

### 1h. Reusable-LLM-context audit events

- Tables `reusable_llm_contexts`, `reusable_llm_context_audit_events`
  (`schema/table-names.ts:44-45`). Per
  `docs/architecture/automation-studio/persistence.md:190-196`, the audits
  "retain IDs, scope, counts, byte/token accounting, and disposition only —
  not prompt content." Reply: no.

### 1i. Project change feed

- `api/contracts/change-feed.ts:20-31`: `{projectId, sequence, transactionId,
  entityKind, entityId, parentId?, operation, revision, changedAt,
  hierarchyScope?}`. `entityKind` is `… | string` (`:3-13`), so it is open.
- Persisted in `mutation_records` / `mutation_touched_entities`
  (`schema/table-names.ts:55`), written through
  `storage/project/unit-of-work.ts:37-38` (`recordChange`, `recordTouchedEntity`).
- Read by the panel through `list-project-change-feed`
  (`apps/web/src/features/automation-studio/sync/useAutomationProjectDataPlatform.ts:62-66`,
  driven by `sync/project-sync.ts:236`).
- Reply: no — it is a synchronisation signal, not content. **But it is the
  push channel a conversation would ride to make a new message appear without
  a refresh.**

### 1j. Global alerts (panel toasts)

- `apps/web/src/features/programs/components/feedback/notifyGlobalAlert.ts:18-21`
  dispatches a `window` `CustomEvent("fluxiq:global-alert")`;
  `GlobalAlertViewport.tsx:16-47` renders at most four, each expiring after
  6 s (10 s for errors).
- Persisted: nowhere. One tab, one moment. Carries `tone`, `title?`,
  `message`, optional `actionLabel`/`onAction`.
- Reply: only the single optional action button.

### 1k. Project problems list

- `list-project-problems` (`api/contracts/endpoints.ts:3`), service at
  `runtime/service.ts:3344-3389`, item type
  `{id, severity, message, artifactKind?, artifactId?}`
  (`api/contracts/project.ts:40-46`).
- **The source is a single hard-coded placeholder row** —
  `baselineAutomationStudioProblems()` at `runtime/service.ts:5445-5451`
  returns exactly one `info` row saying "Automation Studio is ready for
  host-owned artifacts." All the filtering, paging and cursor machinery above
  it operates on that one row. There is a `problems` panel view
  (`apps/web/src/features/automation-studio/views/view-types.ts:13`) with
  nothing real behind it. **This is an empty, fully-plumbed surface a
  conversation could claim.**

### 1l. Background task runs

- `programs/background-tasks/types.ts:3` — status `queued | running |
  succeeded | failed | cancelled`, stored in `global.sqlite` under
  `background.tasks` with a 10-second write batching window
  (`docs/architecture/current-system.md`, "Data Model"). Reply: no.

### Not present

No email, webhook, SSE, push, or any outbound channel of any kind (grepped
across `packages/fluxiq/src` and `apps/web/src`). The only way a person learns
anything is by having the panel open, or by reading a stored record later.

---

## 2. Any thread / message / conversation concept, however partial

**None.** Grepping `conversation|Conversation` across `packages/` and `apps/`
returns exactly three hits, all comments saying the opposite:

- `runtime/flow-bootstrap/authoring/contracts.ts:77` — "fresh request with no
  conversation history, so without this the model is …"
- `runtime/llm/harness-options/bootstrap-completion.ts:71` — "Every decision is
  a fresh request with no conversation history, so a model …"
- `runtime/llm/tests/execution-grant/tests/execution-grant-fixture.ts:35` —
  test fixture prose.

`thread` / `Thread`: one hit, `apps/web/src/features/programs/ui-performance-budgets.ts:136`,
`"main thread"`. `chat`: only `deepseek-chat` the model id.

Four things are *adjacent* and worth reusing:

1. **The provider call is exactly two messages, always.**
   `runtime/llm/deepseek-provider.ts:437-440` returns
   `[{role:"system",…},{role:"user", content: JSON.stringify(providerUserPayload(request))}]`.
   There is no message array to append to, and the type is
   `Array<{ role: "system" | "user"; content: string }>` at `:411` — the
   literal union has no `"assistant"`, so a turn history cannot be expressed
   without widening it.

2. **The evidence loop is the de facto transcript.** It accumulates
   `evidence: Array<{callId, toolId, value}>` across iterations and re-sends
   the whole list on every call (`runtime/llm/evidence-loop.ts:381,453,687`;
   carried into the packet at
   `runtime/llm/harness/context-packet.ts:72-79`). Each call is stateless at
   the provider; continuity lives entirely in that array.

3. **Core already replies to the model in that array.** When a decision comes
   back unusable, Core pushes a pseudo-evidence record under
   `core.decision_check` (`runtime/llm/unusable-decision.ts:45`, pushed at
   `evidence-loop.ts:575`); likewise `core.completion_check`
   (`evidence-loop.ts:134,604`) and `core.request_check`
   (`evidence-loop.ts:73,491`). That is a Core→model turn in all but name, and
   it is the mechanism a person's reply would naturally be injected through.

4. **The loop has a fixed stage protocol** — `gather → plan → implement →
   iterate → verify`, frozen, with named refusals for out-of-order moves
   (`runtime/llm/stages/protocol.ts:25-46`). A conversation turn would have to
   fit inside a stage or be a stage; it cannot sit outside the order.

---

## 3. How a permission request reaches a person today, end to end

Two paths. They share the payload and nothing else.

### Path A — authoring (build / explore)

1. The person issues an LLM execution grant from the panel, optionally with
   `permittedConsequences`
   (`api/handlers/llm-generation.ts:57`; grant type
   `runtime/llm/execution-grants.ts:157,396`).
2. `generate-flow-bootstrap-adaptation` reads the grant's
   `permittedConsequences` and hands them to the service
   (`api/handlers/llm-generation.ts:122-125`).
3. `automationStudioFlowBootstrapActionPermissions` builds one
   `AutomationStudioActionPermissionGate` for the build, stage `"authoring"`
   (`runtime/flow-bootstrap/action-permissions.ts:63-70`).
4. Every exploration tool call and every plan step is handed a check
   (`action-permissions.ts:72-80`, and `planStep` at `:36`). The gate's
   authority is the grant's classes **plus** the classes the person's own
   instruction was read to ask for (`runtime/action-permissions/instructed.ts:1-23`
   — the model quotes the person's words, Core verifies the quote is verbatim
   in an active instruction, and the derivation is stored with the Flow as
   `metadata.bootstrapInstructedConsequences`, `runtime/service.ts:4125`).
5. The first action whose consequences neither covers raises the request and
   aborts the gate's signal (`runtime/action-permissions/gate.ts:133-161`).
   The control's name is carried only if it already appeared in evidence the
   model was shown (`gate.ts:113-130, 186-192`) — otherwise the sentence says
   "a control it cannot name here" (`request.ts:98`).
6. The build throws (`action-permissions.ts:78`) and is converted to
   `flowBootstrapPermissionRequiredFailure(request, progress, accounting)`
   (`runtime/flow-bootstrap/generation-failure.ts:344-358`), producing
   `code: "flow_bootstrap.permission_required"`, `stage:
   "provider_output_validation"`, `retryable: false`, `providerInvocation:
   "attempted"`, `providerResponse: "received"`, `evidenceLoop`, and
   `permissionRequest`.
7. The handler catches it and returns
   `{ ok:false, error: "Flow Bootstrap generation failed (…)", payload: { diagnostic } }`
   (`api/handlers/llm-generation.ts:129-141`).
8. The panel reads `payload.diagnostic.permissionRequest` back through Core's
   own strict parser, and only accepts `reason.stage === "authoring"`
   (`BlankFlowAuthoringPanel.tsx:211-223`).
9. It shows a modal with `request.sentence` and one bullet per `missing` class
   (`BlankFlowAuthoringPanel.tsx:259-264`, phrases from
   `runtime/action-permissions/consequences.ts:68-72`). "Allow and continue"
   re-runs the whole exploration with a **new grant** whose
   `permittedConsequences` are exactly `request.missing`
   (`BlankFlowAuthoringPanel.tsx:200`). It refuses to continue if the website
   task or Flow changed since the question was asked (`:166-171, 186-192`).

**Nothing in this path is stored.** Reload the page and the question is gone.

### Path B — recovery (what task t060 added)

t060 is Core commit `bd26f24` ("Show a run's permission request in the panel and
let the person answer it"), five files:
`runtime/FlowRunView.tsx` (+205), `runtime/RunPermissionRequest.tsx` (+62 new),
`runtime/run-input-model.ts` (+12), and two test files.

1. Recovery builds its gate at stage `"recovery"` and shares it between the
   exploration and the patch stage
   (`docs/architecture/automation-studio.md:971-978`).
2. If an exploration action is refused, the exploration ends with outcome
   `user_intervention_required`, stop reason `operator_approval_required`, and
   carries the request (`runtime/recovery/runtime-exploration.ts:406-418`).
   If instead the *repair* would act, the patch stage records
   `permissionOutcome: "required"` on its receipt and does not run
   (`runtime/recovery/annotation/patches.ts:294-317`).
3. `annotate.ts` writes the request into the run record at
   `metadata.permissionRequest` (`runtime/recovery/annotation/annotate.ts:449-451`),
   beside `llmGate.permissions` (granted / instructed / lapsed, `:440`) and
   `llmGate.patchHeldCode: "llm.runtime_patch_permission_required"` (`:439`).
4. The panel reads the run back **by id** (t060 fixed a real defect here: a run
   longer than 30 s was previously lost). `readRunPermission` loads the compact
   run detail and only stores it if `metadata.permissionRequest !== undefined`
   (`apps/web/src/features/automation-studio/runtime/FlowRunView.tsx:163-179`);
   `readRunBack` polls to the limit for a run that outlived the request
   (`:180-198`).
5. `RunPermissionRequest.tsx:27-54` renders it: Core's `sentence`, a bullet per
   `missing`, what was "Already allowed for this run" from
   `authority.granted`, and two buttons. It parses through Core's strict
   parser and shows nothing rather than something Core did not say
   (`:56-62`), and it accepts only `reason.stage === "recovery"` — an
   authoring request belongs to the authoring panel (`:21-22, 61`).
6. "Allow and run again" (`FlowRunView.tsx:319-329`) re-authorizes with
   `request.missing` and re-runs the same intent, refusing if the Flow or its
   inputs changed. "Don't allow" only forgets the question. `onAllow` is
   omitted entirely when the run carried no grant — there is then no grant to
   widen (`RunPermissionRequest.tsx:26, 44-46`).

### What `flow_bootstrap.permission_required` carries

Declared at `runtime/flow-bootstrap/generation-failure.ts:151-155` inside the
`provider_output_validation` phase group. The parse rule at `:242-243` enforces
a strict biconditional: a `permissionRequest` travels with this code **and
never without it**, and this code never travels without a request. Built at
`:344-358`. The request itself is §1a. Its `missing` array is precisely "what a
later run's grant must add" (`request.ts:63`), which is what makes the
one-click retry possible.

---

## 4. The persistence layer a new conversation would live in

### How a project's resources are stored

Three layers, all under
`.fluxiq/artifacts/automation-studio/projects/{projectId}`
(`docs/architecture/automation-studio/persistence.md:6-70`):

1. **The canonical file tree** — `project.json`, `hierarchy.json`,
   `workspace.json`, `indexes/*.json`, and per-entity folders. Indexes are
   lightweight navigation summaries; full documents load only on demand
   (`persistence.md:71-78`).
2. **`project.sqlite`** — the typed relational mirror. Tables listed in
   `storage/project/schema/table-names.ts:3-57`; pooled per project by
   `storage/project/database.ts:29-70`.
3. **A content-addressed object store** for large payloads
   (`objects`, `object_references` tables;
   `storage/project/object-repository.ts`), optionally AES-256-GCM protected
   through a host-owned key resolver (`storage/project/content-protection.ts`,
   described at `persistence.md:197-206`).

### What a new resource type must implement

Six things, in this order:

1. **A schema migration module** under
   `storage/project/schema/`, exporting one
   `AutomationStudioSchemaMigration` with a numbered `id` and its `create
   table` statements. Example: `schema/run-datasets.ts:7-9` — `id:
   "0019_run_datasets"`.
2. **Registration in two places**: re-export from
   `schema/index.ts` (the barrel is explicitly "one module per table group, in
   migration order", `schema/index.ts:1-3`), and append to
   `AUTOMATION_STUDIO_PROJECT_ADMINISTRATION_MIGRATIONS`
   (`storage/project/administration.ts:79,150`). Append only — order is the
   migration order.
3. **Table names** added to `AUTOMATION_STUDIO_PROJECT_DOMAIN_TABLES`
   (`schema/table-names.ts:3-51`), which is what assertion and sweep code reads.
4. **A store class** in `storage/project/`, opened via
   `static async open({pool, projectId})` that acquires a lease, runs
   `AutomationStudioSchemaMigrationRunner`, and releases on failure — the exact
   shape at `storage/project/run-dataset-store.ts:115-130`.
5. **Mutations through the unit of work** if the resource participates in the
   change feed: `unit.runIdempotent({mutationId, operationKind, ownerKind,
   ownerId, request, changedAt}, ctx => …)` with
   `ctx.recordChange({entityKind, entityId, operation, revision})` inside.
   The worked example is `saveInstruction` at
   `storage/project/flow-resource-mutations.ts:46-60`; the context API is
   `storage/project/unit-of-work.ts:37-38, 71, 110-118`.
6. **API surface**: endpoint names in
   `api/contracts/endpoints.ts`, request/response types in a
   `api/contracts/<kind>.ts` module, and a
   `register…Endpoints(dependencies)` function in `api/handlers/`.

### What the most recent resource type did — run datasets

Added in commit `0e5c447` ("Make structured data extraction a first-class Core
capability, and harden keys"). It is the template to copy:

- Migration `0019_run_datasets` with five tables:
  `run_datasets`, `run_dataset_rows`, `run_dataset_batches`,
  `run_dataset_audit_events`, `run_dataset_catalog`
  (`schema/run-datasets.ts:10-70`). Note the audit table has **no free-text
  column** and a `check (event_type in (…))` constraint (`:48-58`).
- Store `AutomationStudioProjectRunDatasetStore`
  (`storage/project/run-dataset-store.ts:110-130`), 614 lines.
- Service collaborator `AutomationStudioRunDatasets` exposed as a **plain
  readonly property** on the facade, not as methods:
  `readonly runDatasets: AutomationStudioRunDatasets;`
  (`runtime/service.ts:655`), constructed at `:721`. Handlers then call
  `service.runDatasets.listRunDatasets(…)`
  (`api/handlers/datasets.ts:35`). **This is the pattern that avoids adding
  methods to `AutomationStudioService`** — see §6.
- Collaborator directory `runtime/service/datasets/` with its own barrel
  (`runtime/service/datasets/index.ts:1-6`).
- Six endpoints (`api/contracts/endpoints.ts:148-153`), each asserting
  `service.assertProjectDomainAccess(projectId, request.scope.domainId)`
  before reading anything, with reads on `programs.read` and deletion on
  `flows.write` (`api/handlers/datasets.ts:1-20, 30-38`).
- A `contractSpreadPaths` entry in the structure audit so no wire field can
  arrive through a spread (`scripts/structure-audit/config.mjs:68-72`).
- A run-time hook: `onRecordBatch` installed on graph options when the store is
  available (`runtime/service.ts:3104`; handler at
  `runtime/service/datasets/run-datasets.ts:58-64`).

---

## 5. How the model is given context today

### The request shape

`AutomationStudioLlmTaskRequest`
(`runtime/llm/harness/task-request.ts:23-43`):
`requestId`, `idempotencyKey`, `timeoutMs`, `estimatedInputTokens`, `taskKind`,
`promptVersion`, `context`, `expectedOutput`, `tokenLimits`,
`maxEstimatedCostUsd`, `deniedEvidenceKeys?`, `dryRun?`, `metadata?`.

`expectedOutput` is a closed union: `"diagnosis" | "runtime_patch" |
"change_proposal" | "instruction_suggestion" | "flow_bootstrap" |
"evidence_tool_decision"` (`task-request.ts:31`). **A conversation reply is not
one of them.**

### What may appear in the context packet

`AutomationStudioLlmContextPacket`
(`runtime/llm/harness/context-packet.ts:32-82`):
`schemaVersion: "0.1"`, `taskKind`, `stage?`, `promptVersion`, `projectId`,
`flowId`, `runId?`, `subflowId?`, `nodeId?`, `instructions`, `stateDiffs?`,
`routeHistory?`, `recentActions?`, `failureEvidence?`, `explorationEvidence?`,
`recoveryContext?`, `diagnosis?`, `resultSummary?`, `relevantRuns?`,
`relevantAdaptations?`, `reusableContext?`, `subflows?`, `availableActions?`,
`flowBootstrap?`, `evidenceLoop?`, `policyGates?`, `metadata?`.

The caller-facing input is `AutomationStudioLlmHarnessInput`
(`task-request.ts:73-168`); the packet is built by
`packAutomationStudioLlmContext` (`context-packet.ts:158`).

Instructions — the person's own written words — reach the model through
`resolveAutomationStudioLlmInstructions`
(`runtime/llm/harness/instruction.ts:52-90`): active instructions in scope,
sorted, budgeted (default 2,000 tokens, `:56`), with the stage protocol
budgeted **ahead** of the Flow's own instructions so a long Flow loses its own
tail rather than the protocol (`:46-51`).

### Validation that would reject a new field

Four gates, in increasing severity:

1. **The provider's whole-context bound**: `boundedJson(request.context)` →
   `llm.provider_request_context_unbounded`
   (`runtime/llm/deepseek-provider.ts:332`).
2. **A hard allowlist for `flow_bootstrap`**:
   `const allowed = new Set(["schemaVersion","taskKind","promptVersion",
   "projectId","flowId","instructions","flowBootstrap","reusableContext",
   "metadata"]); if (Object.keys(context).some(k => !allowed.has(k))) return false;`
   (`deepseek-provider.ts:510-511`), refusing with
   `llm.provider_flow_bootstrap_context_invalid`
   (`deepseek-provider.ts:337`). **A `conversation` field added to the packet
   would fail every authoring build here, before the request leaves the
   process.** `metadata` is also allowlisted down to a single `source` key
   (`:517-520`).
3. **`validEvidenceLoopContext`** for `evidence_tool_decision`
   (`deepseek-provider.ts:538+`) — bounds iteration, tools and evidence
   against the loop's own ceilings.
4. **The pre-send evidence check**, Core's shared one, refusing per slot
   (`deepseek-provider.ts:334-336`; codes at
   `runtime/llm/provider-contract.ts:11-39`, which is a closed frozen list —
   a new refusal reason needs a new code there).

Also note: `providerUserPayload` **rebuilds** the context field by field for
`flow_bootstrap` and `evidence_tool_decision`
(`deepseek-provider.ts:441-475`). A field not named there is silently dropped
from what is actually sent, even if it survived the allowlist.

And the message array itself is typed
`Array<{ role: "system" | "user"; content: string }>`
(`deepseek-provider.ts:411`) with exactly two elements (`:437-440`). Prior
conversation turns cannot be represented as messages without widening that
type; today they would have to be carried **inside the JSON user payload**, and
the natural slot is `evidenceLoop.evidence[]`, which Core already writes its
own replies into (see §2.3).

---

## 6. What currently *ends* an interaction that should instead ask a person

These are the call sites a conversation would replace. Grouped by how they end.

### Ends with a request that dies unanswered

- **The authoring permission request** — thrown at
  `runtime/flow-bootstrap/action-permissions.ts:78` ("Flow Bootstrap stopped:
  an action needs permission"), returned only in an HTTP body
  (`api/handlers/llm-generation.ts:129-141`), never stored. If nobody is
  looking at the tab, the question is lost.
- **The recovery permission request** — stored on the run, but the run is over
  (`runtime/action-permissions/gate.ts:159` `this.stopped.abort()`;
  `annotate.ts:449-451`). Answering means re-running everything.

### Ends with a refusal that has nobody to ask

- `automationStudioActionPermissionDenied`
  (`runtime/action-permissions/gate.ts:200-203`) — "the check for an action run
  where no run stands behind it, so there is nobody to ask". Permits nothing
  with a consequence, full stop.
- `refusal(...)` in the exploration downgrades a domain's
  `operator_approval_required` to `destructive_action_refused` because "a
  domain code read as one here is a refusal with nobody to ask"
  (`runtime/recovery/runtime-exploration.ts:492-497`). A domain that knows a
  person should be asked cannot say so.
- `permissionOutcome: "undeclared"` — the repair did not declare its
  consequences, so it does not run, with the issue text "nobody can be asked to
  allow a consequence nobody declared"
  (`runtime/recovery/annotation/patches.ts:308, 312-314`).

### Ends with the model saying a person is needed — and nobody being told

- **`no_repair` with reason `person_required`**: "only a person can settle
  this" (`runtime/llm/harness/structured-response.ts:40`). It is recorded as a
  declined-repair receipt
  (`runtime/recovery/annotation/patches.ts:395-406`) with
  `verification.status: "not_executed", reason: "declined"` — and that is the
  end of it. **This is the sharpest instance: the model has literally said a
  person must decide, and nothing asks one.** The other four reasons
  (`control_gone`, `control_refused`, `several_alike`, `destination_gone`,
  `structured-response.ts:36-39`) are all cases where one sentence from a
  person would unblock the run.
- The diagnosis "not achievable" answer, steered by
  `ACTION_PERMISSIONS_OTHERWISE`
  (`runtime/llm/harness/context-packet.ts:98-105`) — the comment records that
  a model told only "a person is asked" once read an ungranted press as
  unachievable "and ended the recovery with no request, the silent refusal
  this replaces".

### Ends on a limit that a person could have widened

`AUTOMATION_STUDIO_EXPLORATION_STOP_REASONS`
(`runtime/recovery/exploration-outcome.ts:73-84`) and their sentences
(`runtime-exploration.ts:473-484`): `wall_clock_expired`,
`recovery_deadline_expired`, `action_limit`, `provider_call_limit`,
`repeat_window`, `no_progress`, `destructive_action_refused`,
`out_of_scope_refused`, `refusal_limit`. Each produces a Core sentence that is
already written *for a person to read* — and reaches nobody in real time. The
outcome vocabulary itself distinguishes `user_intervention_required` as its own
member (`exploration-outcome.ts:54-55`), but only the permission gate can ever
produce it (`exploration-outcome.ts:104`).

### Ends on a build failure code, with prose invented in the browser

The 24 `flow_bootstrap.*` codes (`generation-failure.ts:100-156`) reach the
panel and are turned into four hand-written English sentences plus a fallback
(`BlankFlowAuthoringPanel.tsx:76-85`). Twenty of the codes get the fallback.

### A genuinely parked run that nothing can resume

`builtin.routine.approval` (`nodes/routine/approval.ts:3-31`) — "Pause a
routine until an operator approves or rejects it". It returns
`status: "waiting"` and emits an effect
`{type: "routine.approval.requested", payload: {prompt, timeoutMs,
defaultRoute}}` (`:30`). The executor honours `waiting` and returns from the
graph run with the current node id (`runtime/executor/graph-run.ts:290-300`),
and `waiting` is a real run status everywhere
(`model/flow-adaptation.ts:233`, `runtime/executor/contracts.ts:14`,
`runtime/service/runtime-session/admission.ts:12`).

**Nothing consumes `routine.approval.requested`.** The only other reference is
the expected-transition table (`runtime/executor/expected-transition.ts:39,48`).
There is no endpoint to answer it, no UI, and no resume path — `flow-change/resume.ts`
is about resuming a *change trial*, not a waiting run. So Core already has a
node whose entire purpose is to ask a person, a run status for it, and no way
to answer. A conversation is the missing half of a feature that is already
half-built.

---

## Where a conversation would attach

### Concrete modules

**Core model / payload.**
`runtime/action-permissions/` is where the vocabulary already lives:
`consequences.ts` (the five classes and their person-facing phrases),
`request.ts` (the payload, its parser, and Core's sentence builder),
`gate.ts` (the one place a question is raised), `instructed.ts` (what the
person's own words already authorise). A conversation message type belongs
*beside* these, not inside them — `request.ts:1-12` says the payload was
written so parking can be added without changing it, and `requestId` is "the
key a store would hold it under". **That is the designed seam. Take it.**

**Raise points.** Exactly two today:
`runtime/action-permissions/gate.ts:143-160` (the only place a request object
is constructed) and, indirectly, `patches.ts:294-317`. A conversation would add
raise points at the six §6 sites, all of which already have Core-authored
sentences ready to send.

**The loop side.** `runtime/llm/evidence-loop.ts` already carries Core→model
turns under `core.decision_check` / `core.completion_check` /
`core.request_check`. A person's answer is a fourth pseudo-tool in that array —
no new provider shape, no message-role change, no allowlist breakage, because
it rides inside `evidenceLoop.evidence[]` which is already sent
(`deepseek-provider.ts:463`). **This is by far the cheapest way to get a reply
back to the model.** The alternative — a new top-level `conversation` field on
the context packet — is refused by `deepseek-provider.ts:510-511` for every
authoring build and dropped by `providerUserPayload` for both bootstrap task
kinds.

**The panel.** `apps/web/src/features/automation-studio/runtime/RunPermissionRequest.tsx`
is the existing question component (62 lines) and
`BlankFlowAuthoringPanel.tsx:259-264` the existing modal. A view type would be
added to `AutomationStudioView`
(`apps/web/src/features/automation-studio/views/view-types.ts:3-13`) and
registered in `views/canonical-view-definitions.tsx` / `views/view-registry.ts`.
The `problems` view is already declared, fully plumbed, and backed by one
hard-coded row (`runtime/service.ts:5445-5451`) — the most honest place to put
a real inbox.

### The persistence seam

`storage/project/` + `storage/project/schema/`, following run datasets exactly:
a numbered migration module, a barrel re-export
(`schema/index.ts`), an append to
`AUTOMATION_STUDIO_PROJECT_ADMINISTRATION_MIGRATIONS`
(`administration.ts:150`), names into
`AUTOMATION_STUDIO_PROJECT_DOMAIN_TABLES` (`schema/table-names.ts`), a store
with the `static open({pool, projectId})` lease/migrate/release shape
(`run-dataset-store.ts:115-130`), and mutations through
`unit-of-work.ts` `runIdempotent` + `recordChange` so the panel learns via the
existing change feed. `AutomationStudioChangeFeedEntityKind` is `… | string`
(`api/contracts/change-feed.ts:13`), so a `conversation` / `conversation_message`
kind needs no contract change.

Message bodies, if they can be long, belong in the content-addressed object
store with only metadata in SQL — the pattern reusable LLM context uses
("SQL filtering uses metadata only, then hydrates only the bounded unexpired
result page", `persistence.md:150-152`).

### Structure rules that constrain it

These are hard gates in `pnpm check`
(`package.json` `"check": "pnpm structure:test && pnpm task:test && node
scripts/structure-audit.mjs && pnpm -r check"`). The audit currently **passes**
(verified: `structure-audit: passed (174 warning(s), 361 baselined)`).

1. **`runtime/service.ts` is exactly on its ratchet: 6,275 lines and 223
   methods** (`.structure-baseline.json` `file-lines` and `class-methods`
   entries). The ratchet law is "a fail finding with `ratchet:true` is
   suppressed while its value is at or below the recorded value, fails when it
   exceeds it" (`scripts/structure-audit/baseline.mjs:1-9`, enforced at
   `:52-58`). **Adding even one line to `service.ts` fails the build.** The
   escape is the run-datasets pattern: a collaborator behind a plain readonly
   property. But even `readonly conversations: …;` plus `this.conversations =
   new …` is +2 lines. Something must come out of `service.ts` first, or the
   conversation must be reached without touching the facade at all (a handler
   could construct its collaborator from `dependencies` directly).
   A plain property declaration does *not* count toward `classMethods` —
   only method declarations, accessors, and properties initialised to a
   function (`scripts/structure-audit/rules/class-methods.mjs:11-23`) — so the
   223-method ceiling is survivable; the 6,275-line one is not.

2. **Directory file limit 25, advisory at 15**
   (`scripts/structure-audit/context.mjs:45-60`), ratcheted, and a
   subdirectory does not count
   (`rules/directory-files.mjs:1-2`). Current counts:
   `automation-studio/runtime/` **24** (one from failing),
   `api/handlers/` 22, `storage/project/` 22, `api/contracts/` 18,
   `storage/project/schema/` 16, `apps/web/.../automation-studio/runtime/` 19.
   **A conversation must therefore be a new subdirectory
   (`runtime/conversations/`), never loose files in `runtime/`.** Only two
   directories are baselined above the limit
   (`apps/web/.../hierarchy` 30, `automation-studio/model` 28), so
   `model/` cannot take a new file either.

3. **Max path depth 9 segments including the filename, and it does not
   ratchet** (`context.mjs:57`; `rules/naming.mjs:36-42`, `severity: "fail",
   ratchet: false`). Twenty-three directories under `packages/fluxiq/src` are
   already at 9 — including `runtime/action-permissions/client`,
   `runtime/llm/harness`, `runtime/llm/stages`, `runtime/recovery/annotation`,
   every `runtime/service/*`, and `storage/project/schema`. **None of them can
   gain a subdirectory.** `runtime/conversations/<file>.ts` is 8;
   `runtime/conversations/<sub>/<file>.ts` is 9 and is the floor. Anything
   deeper is rejected outright with no baseline escape.

4. **File line limit 800** (fail, ratcheted), advisory at 400
   (`context.mjs:46-47`). Only two files are baselined above it. A new
   conversation store will want splitting before it reaches 800 —
   `run-dataset-store.ts` is 614 and already carries an advisory warning.

5. **Exported values: 15 max, 8 advisory; one exported class per file; one
   exported component per file; barrels exempt**
   (`context.mjs:52-55`; `rules/exported-values.mjs:1-7`). Three files sharing
   a filename prefix in one directory force a subdirectory
   (`prefixGroup: 3`, `rules/naming.mjs:91-100`) — so `conversation-store.ts`,
   `conversation-message.ts`, `conversation-thread.ts` in one directory is a
   failure that demands `conversations/` anyway.

6. **Domain neutrality**: every name declared or read under `packages/` is
   checked against a web/DOM vocabulary rule
   (`config.mjs` `domainNeutralPaths: ["packages"]`,
   `rules/web-vocabulary.mjs`). A conversation type must not name a page, a
   tab, a selector or a control. `consequences.ts:1-9` is the model to
   imitate — classes of consequence, never of control.

7. **Contract-spread ban** already covers
   `runtime/action-permissions` — "the action-permission gate builds the
   request a run carries out to a person … Write each field by name, passing
   an absent value as `null`" (`config.mjs:73-79`). Any conversation payload
   built in that directory inherits it, and it is the right rule to extend to
   wherever a message is constructed.

8. **Facade dispatch**: inside `runtime/service/`, a call to a public method of
   `runtime/service.ts` must go through the facade or a port object, not
   straight at a collaborator (`rules/facade-dispatch.mjs:1-19`). A
   conversations collaborator that needs, say, `getFlowRunDetail` must take it
   as a port, exactly as `flow-run-detail-reader.ts:8-13` does.

9. **Tests** live in a `tests/` subfolder of the directory owning the subject
   (`rules/test-placement.mjs`, `config.mjs` `testRootDirNames`), and test
   files are exempt from the depth rule (`rules/naming.mjs:33-34`).

10. **Boundary**: this is Core, so the conversation must remain domain-neutral
    and must not import the web-extension repository
    (`config.mjs` `forbiddenImports`). The downstream repo's own
    `.structure-baseline.json` and the same mirrored audit apply there.

### One design consequence worth stating

The whole permission mechanism was built around "the run ends, the person
answers by starting a new run with a wider grant". Two things follow for a
conversation design. First, `permittedConsequences` on the LLM execution grant
is already the wire by which a person's decision reaches a run
(`execution-grants.ts:157, 396`) — a conversation does not need to invent
authority, only to carry the question durably and let the answer arrive without
losing the run's work. Second, `builtin.routine.approval` plus the `waiting`
run status plus `flow_bootstrap.permission_required`'s stable `requestId` mean
the *parking* half is already sketched in three separate places and connected
in none. A conversation store with a `requestId`-keyed row is what joins them.

---

## Commands run and observed results

- `node scripts/structure-audit.mjs` (in `F:\!FluxIQ`) →
  `structure-audit: passed (174 warning(s), 361 baselined).` Read-only; the
  audit writes nothing without `--update`.
- `git log --oneline -30` → confirmed t060 is Core commit `bd26f24`,
  "Show a run's permission request in the panel and let the person answer it",
  merged at `fde073b`.
- `git show --stat bd26f24` → the five files listed in §3 Path B.
- `node -e` reads of `.structure-baseline.json` → `file-lines` has exactly two
  entries, one of which is
  `packages/fluxiq/src/programs/automation-studio/runtime/service.ts: 6275`;
  `class-methods` has exactly one,
  `…/service.ts::AutomationStudioService: 223`; `directory-files` has two,
  `apps/web/src/features/automation-studio/hierarchy: 30` and
  `packages/fluxiq/src/programs/automation-studio/model: 28`.
- `wc -l packages/fluxiq/src/programs/automation-studio/runtime/service.ts`
  → `6275`. Exactly on the ratchet.
- Directory file counts via `git ls-files` (direct children only):
  `automation-studio/runtime` 24, `api/handlers` 22, `storage/project` 22,
  `api/contracts` 18, `storage/project/schema` 16,
  `apps/web/.../automation-studio/runtime` 19.
- `git ls-files "packages/fluxiq/src/**" | awk -F/ 'NF==9 {…}'` → the 23
  directories already at the 9-segment depth ceiling, listed in §"Structure
  rules" item 3.
- Greps for `conversation|Conversation`, `thread|Thread`, `chat|inbox|askUser`,
  `webhook|sendMail|EventSource|server-sent` — results reported inline in §2
  and §1 "Not present".

## Not verified

- I did not run any Core unit tests, `pnpm check` in full, or any live provider
  call. I ran only `node scripts/structure-audit.mjs` (read-only).
- I did not read the full 6,275-line `runtime/service.ts`; I read the sections
  named above (`3020-3110`, `3330-3400`, `3500-3520`, `3917-3953`, `4120-4130`,
  `5445-5475`) and grepped the rest.
- I did not verify the downstream web-extension side of any of this.
- I did not exhaustively enumerate every `throw` in Core; §6 covers the
  permission, repair, exploration and build paths the brief named, not e.g.
  argument-validation throws in handlers.
- Commit `bd26f24` is the t060 landing in Core; I did not check whether the
  web-extension repository's t060 added anything further on its side.
- I did not confirm whether `apps/web` ships a Data window view that registers
  the datasets feature; the datasets components are mounted from a run's detail
  panel, and `AutomationStudioView` lists no `data` member.

## Open questions or contradictions found

1. **`builtin.routine.approval` is dead.** It emits
   `routine.approval.requested` and parks the run at `status: "waiting"`, and
   nothing in Core or the panel consumes the effect or resumes the run. Either
   it is the intended home for conversations, or it should go. Worth a decision
   before designing a parallel mechanism.
2. **Project problems is a stub.** `baselineAutomationStudioProblems()`
   returns one hard-coded `info` row
   (`runtime/service.ts:5445-5451`) behind a full filter/page/cursor
   implementation and a registered panel view. Is that view the intended
   conversation inbox, or should it stay separate?
3. **Authoring questions are not durable and recovery questions are.** Same
   payload, two different fates (§3). If conversations become the primary
   channel this asymmetry has to go — but note that persisting the authoring
   request means the build path gains a store it deliberately does not have.
4. **`service.ts` is at its ratchet with no headroom.** Some extraction out of
   `runtime/service.ts` is a prerequisite for wiring anything new into the
   facade. Worth scoping as its own task rather than discovering it mid-build.
5. **The provider message array has no `assistant` role.** If conversations are
   meant to give the model real dialogue rather than a re-sent evidence array,
   `deepseek-provider.ts:411` and `providerUserPayload` (`:441-484`) both need
   widening, and the `flow_bootstrap` context allowlist at `:510-511` has to
   admit a new key. That is a larger change than it looks, and the comment at
   `bootstrap-completion.ts:71` shows the codebase currently *relies* on every
   decision being a fresh request.
