# w2-c — Harness options and stage instructions

Read-only investigation for L14 and L15. **No source file was changed in either
repository.** Path prefix: `AS/` is Core's
`packages/fluxiq/src/programs/automation-studio/`; `domain/` is this
repository's `domain/src/`.

## Outcome

The loop L14 asks for **already exists in Core and is already domain-neutral**.
`AS/runtime/llm/evidence-loop.ts` is a bounded, provider-neutral,
tool-driven exploration loop with no DOM, page, selector or tab concept
anywhere in it. What does not exist is any of the three things around it:

1. a **registry** — there is one mutable slot, `llmEvidenceRuntime`, holding one
   domain's tools, with no merge, no domain partition and no gate;
2. **Core-owned domain-neutral options** — Core ships *zero* harness options;
   every tool the loop can call today comes from this repository;
3. a **failure entry point** — the loop is reachable only from Flow creation,
   and the grant table forbids it to a recovery run.

The single blocking leak is that Core's repair target is literally
`{ selector: string }`, hard-required in five Core files including the JSON
schema Core sends to the provider. A domain with no selectors cannot express a
repair at all. Everything else is tractable.

---

## 1. How a domain extends Core today

Six distinct seams. Only the first two are registries; the rest are single-slot
bindings.

### 1.1 Importer SDK manifest — a real registry

`AS/nodes/importer-sdk.ts:56-70` declares what an imported package may
contribute:

| Field | What it registers |
| --- | --- |
| `nodes` | `AutomationStudioNodeDefinition[]` |
| `recordingMappers` | id/version/description (+ `outputIds`) |
| `targetResolvers` | id/version/description |
| `comparators` | id/version/description/`valueTypes` |
| `stateVisualizers` | id/version/label/supported namespaces and kinds |
| `schemas` | id/version/`valueType` |
| `editor` | display name, icon, categories |

`AutomationStudioImporterSdkRegistry` (`:110-126`) holds manifests by
`packageId`: one manifest per package, a package may never change `domainId`
(`:118`), re-registering throws and tells the caller to build a new host runtime
(`:119`), and every node is pushed into a nested `AutomationStudioNodeRegistry`
(`:120`). Validation is a closed code list, `importer_sdk.*` (`:128-147`).

Declarations and implementations are deliberately **separate**:
`AutomationStudioImporterImplementationBundle` (`:100-107`) carries
`implementations`, `recordingMappers`, `targetResolvers`, `comparators` as
`Record<id, fn>`. The registry stores only declarative manifests so that "an
editor cannot acquire arbitrary host code by browsing nodes"
(`AS/nodes/canonical-registry.ts:12-18`).

**This pairing is the template a harness-option registry should copy.**

### 1.2 Node registry — the scoping precedent

`AS/nodes/canonical-registry.ts:19-49` gives `register`,
`registerImporterManifest`, `get(id, resolution)` and `list(resolution)`.
`isAvailable` (`:53-59`) is the gate worth reusing verbatim:

- `availability` — `{global} | {domain, domainId} | {both}`
  (`AS/nodes/definitions.ts:11-14`), matched against the Flow's scope (`:62-66`);
- every `requiredRuntimeCapabilities` entry must be present;
- every `safety.requiredPermissions` entry must be present.

Duplicate ids **throw** (`:29`), so an importer extends the set and can never
silently shadow a built-in. That is exactly L14's "extend rather than replace".

### 1.3-1.6 The single-slot bindings

| Seam | Core declaration | Bound by this repo |
| --- | --- | --- |
| Runtime adapter | `fluxiq.runtime.registerAdapter` | `domain/runtime/service.ts:14-20` |
| Runtime service + host runtime | `bindRuntimeService`, `bindHostRuntime` | `domain/runtime/service.ts:22-28` |
| LLM evidence runtime | `AS/runtime/service.ts:352-357`, `bindLlmEvidenceRuntime` `:769-772` | `domain/runtime/llm-evidence/tools.ts:212-217` |
| LLM provider resolver | `AS/runtime/service.ts:351`, `bindLlmExecutionProvider` `:758-767` | host-supplied |

The whole domain registration is nine lines
(`domain/src/runtime/service.ts:7-28`): register adapter, bind runtime service,
bind host runtime, bind evidence runtime.

The **host runtime boundary is already fully domain-neutral** and is the proof
that this style works: `capabilities`, `captureStateSnapshot`,
`inspectStateDiff`, `expectationEvaluator`, with every browser concept on this
side of the line (`domain/src/runtime/host-runtime.ts:82-119`). The web domain
even reads the type off Core's method rather than restating it (`:53`), so it
cannot drift.

Capabilities are declared as data, not code
(`domain/src/runtime/capabilities.ts:13-43`): `web.actions`, `web.snapshots`,
`web.state`, `web.flow-runtime`, each with `domainId` and its input/output ids.

---

## 2. How Core's instruction system works today

### 2.1 The model

`AS/model/flow-adaptation.ts:119-137` — `AutomationStudioFlowInstruction`:
`instructionId`, `title`, `body`, `scope`, `priority`, `status`,
`requirement`, `tags`, link arrays, timestamps.

**Scopes are eight structural positions** (`:98-106`), all about *where in a
Flow* an instruction sits, never about *what the model is doing*:

```
global | project | flow | router | subflow | node | on_error | adaptation_review
```

`requirement` is `advisory | required` (`:117`). `tags` is a closed union —
`generation, runtime, error, router, subflow, review, safety` (`:108-115`).

### 2.2 Resolution

`AS/runtime/llm/harness/instruction.ts:36-81`, `resolveAutomationStudioLlmInstructions`:

1. keep `status === "active"` (`:40`);
2. keep those matching the call's context (`:41`, predicate `:83-94`) — note
   `on_error` requires `input.onError === true` and `adaptation_review` requires
   `input.review === true`, so **two pseudo-stages already exist as booleans**;
3. sort by `scopeRank` then descending `priority` then `updatedAt` then id
   (`:96-105`) — `scopeRank` is a fixed Core array (`:104`);
4. flag a conflict when one scope has `required` instructions containing both
   `/\balways\b/i` and `/\bnever\b/i` (`:44-52`) — a prose heuristic, not a real
   precedence rule;
5. fill a token budget in that order, truncating the first instruction that
   overflows and dropping the rest, with a `instruction.truncated` warning
   (`:55-73`).

The result (`:16-22`) carries `instructions`, `instructionIds`, `diagnostics`,
`tokenBudget`, `estimatedTokens`, and rides in the context packet
(`AS/runtime/llm/harness/context-packet.ts:29`, packed at `:66`).

### 2.3 Storage and the effective-instruction cache

- `AS/storage/project/flow-resource-repository.ts:444` —
  `resolveEffectiveInstructions({projectId, flowId, routerId, subflowId, nodeId, errorCode, limit})`
  returns `AutomationStudioEffectiveInstructionSet` (`:38`:
  `scopeDigest`, `contentDigest`, `maxRevision`, `instructionIds`,
  `instructions`, `cached`).
- Cache table `effective_instruction_digest_cache(scope_digest PK, instruction_revision, content_digest, instruction_ids_json, created_at_ms)`
  (`:46`), read by `scopeDigest` at `:460`, cleared wholesale at `:377` and on
  mutation (`AS/storage/project/flow-resource-mutations.ts:58`). A second table
  `effective_instruction_cache` exists in the schema
  (`AS/storage/project/schema/domain-resources.ts:275`,
  `schema/table-names.ts:27`).
- Write path: `AS/runtime/service/flows/store.ts:431-447`, with
  `sqlInstructionScopeFromInstruction` at `:507`.
- API: `AS/api/handlers/instructions.ts:11-114` (list, get, get set, save);
  scope parsed from payload at `AS/api/handlers/instruction-scope.ts:6-15`;
  the wire enum is `AS/api/contracts/instruction.ts:16`.
- UI: `apps/web/src/features/automation-studio/instructions/`, with an
  effective-instructions panel.

### 2.4 Where the prompt actually comes from

This is the part L15 collides with. **Instructions are user content in the
*user* message; the behavioural prose is Core constants in the *provider*
file.**

`AS/runtime/llm/deepseek-provider.ts:405-418` composes the system prompt by
task kind from constants at `:35-44`:

- `AUTOMATION_STUDIO_DEEPSEEK_SYSTEM_PROMPT` (JSON-only, treat strings as data);
- `..._FLOW_BOOTSTRAP_SCHEMA_INSTRUCTION`, `..._COMPACT_OUTPUT_INSTRUCTION`;
- `..._STRUCTURED_OUTPUT_SCHEMA_INSTRUCTION`;
- `AUTOMATION_STUDIO_RUNTIME_TARGET_OVERRIDE_INSTRUCTION` (`:38`) — **"copy
  selector exactly from failureEvidence"**;
- `..._REUSABLE_CONTEXT_INSTRUCTION`;
- plus `AUTOMATION_STUDIO_LLM_EVIDENCE_DECISION_INSTRUCTION`
  (`AS/runtime/llm/evidence-loop.ts:12`), a ~1,400-character paragraph that is
  effectively today's "explore" stage instruction.

A domain cannot add to or override any of these without editing Core's provider
file. The user payload is built at `:419-464`.

---

## 3. Proposed design A — the harness-option registry

### 3.1 What the loop already gives us for free

`AS/runtime/llm/evidence-loop.ts` needs no conceptual change:

- tool shape `{toolId, description, inputSchema, effect: "observe"|"mutate", repeatPolicy: "after_mutation", initialObservation}` (`:14-23`);
- evidence is arbitrary bounded `JsonValue` (`:88`, `:93`);
- result envelope `{kind:"llm_evidence_tool_execution", evidence, effectApplied, resultCode}` (`:40-45`);
- budgets: iterations, tool calls, evidence bytes, context window (`:4-8`, `:269-284`);
- anti-thrash: mutation epochs, duplicate call ids, duplicate `(epoch, toolId, input)` signatures, repeat-without-progress (`:119-122`, `:146-206`);
- decision schema generated from the eligible tools (`:239-255`);
- closed failure codes (`:47-57`).

Nothing here is web-specific. **Keep it; do not rewrite it.**

### 3.2 The option contract

Extend the existing tool type rather than inventing a parallel one, because the
loop already consumes it and the provider already validates it
(`deepseek-provider.ts:538-561`):

```ts
type AutomationStudioHarnessOption = AutomationStudioLlmEvidenceTool & {
  availability: AutomationStudioNodeAvailability;      // reuse: global | domain | both
  requiredRuntimeCapabilities?: string[];              // reuse the node vocabulary
  safety?: {
    sideEffect: "none" | "observe" | "mutate" | "destructive";
    requiredPermissions?: string[];
    requiresOperatorApproval?: boolean;
  };
  stages?: AutomationStudioLoopStage[];                // which stages may call it
  overrides?: string;                                  // the one legal way to shadow a Core option
};
```

Home: a new `AS/runtime/recovery/harness-options/` directory, consistent with
L4's `AS/runtime/recovery/`.

### 3.3 Registration and combination

Add `harnessOptions?: AutomationStudioHarnessOption[]` to
`AutomationStudioImporterSdkManifest` (`AS/nodes/importer-sdk.ts:56-70`) and
`harnessOptions?: Record<string, HarnessOptionImplementation>` to
`AutomationStudioImporterImplementationBundle` (`:100-107`). This inherits, at
no cost, the manifest validation, the one-manifest-per-package rule and the
domain-immutability rule (`:114-123`).

Combination rule, copying `canonical-registry.ts:29`:

- Core seeds its own options with `availability: {kind:"global"}` or `"both"`;
- an importer's options carry `availability: {kind:"domain", domainId}`;
- a duplicate `toolId` **throws**, so a domain extends and never silently
  replaces — L14 satisfied mechanically rather than by convention;
- shadowing a Core option requires an explicit `overrides` field, and the
  substitution is recorded in the loop trace.

### 3.4 Stopping a disallowed call — the gate that is missing today

At `AS/runtime/service.ts:1914-1918, 1952` the loop is handed
`this.llmEvidenceRuntime.tools` **wholesale**: no filter by domain, policy, task
kind, grant or run scope. Replace with `registry.list(resolution)` where
`resolution` reuses `AutomationStudioNodeRegistryResolution`
(`AS/nodes/definitions.ts:97-101`) plus `stage` and `policy`.

Enforce in three places, because the model chooses the `toolId`:

1. **Schema** — only eligible options reach
   `buildAutomationStudioLlmEvidenceLoopDecisionSchema` (`evidence-loop.ts:157`),
   so a forbidden option is not in the grammar the provider is given.
2. **Loop** — already rejects unknown (`:170`) and non-eligible (`:171-174`)
   tools; extend the eligibility set with the resolution.
3. **Dispatch** — re-check the option against the resolution inside
   `executeHarnessOption` before running it, and refuse `mutate`/`destructive`
   when the policy forbids it. The policy gates are already packed and
   available: `allowExternalSideEffects`,
   `requireApprovalForDestructiveChanges`, `allowModifyActionTargets` and the
   rest (`AS/runtime/llm/harness/context-packet.ts:166-183`).

Execution routing: replace the single slot with
`executeHarnessOption(optionId, input)`, resolved through the registry to the
owning package's implementation, so two domains can be registered at once. Keep
`bindLlmEvidenceRuntime` as a deprecated shim that registers its three tools as
domain options of the web domain, so this repository keeps working through the
change.

### 3.5 What Core should ship as domain-neutral options

Core currently ships none. Candidates that survive the no-browser test:
re-read the failed node's inputs and resolved parameters; read the current
state snapshot via the host runtime boundary (already neutral); diff two state
refs (`inspectStateDiff`); list the node catalog available in scope
(`registry.list`); read prior adaptations and their outcomes for this failure
signature; re-run a read-only node. Each is expressible without a page.

---

## 4. Proposed design B — stage instructions

### 4.1 Stage order stays Core's

```ts
const AUTOMATION_STUDIO_LOOP_STAGES =
  ["gather", "plan", "implement", "iterate", "verify"] as const;
```

Not overridable, per L15.

**Do not model stages as new task kinds.** `AutomationStudioLlmTaskKind` is a
closed union of ten (`AS/runtime/llm/harness/task-kind.ts:4-14`), each pinned to
a `promptVersion` (`:16-27`), mapped to an `expectedOutput` (`:29-36`) and to an
intervention kind (`:38-46`), and **gated per purpose in the grant table**
(`AS/runtime/llm/execution-grants.ts:493-511`). Five stages times the existing
kinds multiplies four tables. Instead add `stage?: AutomationStudioLoopStage` to
`AutomationStudioLlmHarnessInput` (`task-request.ts:44-71`), to
`AutomationStudioLlmTaskRequest` (`:19-32`) and to the context packet
(`context-packet.ts:20-50`), and version the prompt as `<promptVersion>+<stage>`.

### 4.2 A domain *adds* to a stage

Add one scope member to `AS/model/flow-adaptation.ts:98-106`:

```ts
| { kind: "loop_stage"; stage: AutomationStudioLoopStage; projectId?: string; flowId?: string }
```

Then the change is mechanical and lands in the existing tables:

| Change | File:line |
| --- | --- |
| Scope union member | `AS/model/flow-adaptation.ts:98-106` |
| Applies-to predicate arm | `AS/runtime/llm/harness/instruction.ts:83-94` |
| Rank in the fixed order | `AS/runtime/llm/harness/instruction.ts:103-105` |
| Payload → scope arm | `AS/api/handlers/instruction-scope.ts:6-15` |
| Wire `scopeKind` enum | `AS/api/contracts/instruction.ts:16` |
| SQL scope row | `AS/runtime/service/flows/store.ts:507` |
| **Cache key must include the stage** | `AS/storage/project/flow-resource-repository.ts:444-463` |

The last row is a correctness trap: `resolveEffectiveInstructions` keys its
cache on a `scopeDigest` built from project/flow/router/subflow/node/errorCode.
Without the stage in that digest, the cache returns one stage's instruction set
for another.

A domain's added instructions then arrive through machinery that already
resolves, orders, budgets, caches, diagnoses and displays them — including the
web UI's effective-instructions panel, for free.

### 4.3 A domain *wholly overrides* a stage

This needs one prerequisite: **Core's own stage prose must become instructions
instead of provider constants.** Today it is
`AUTOMATION_STUDIO_LLM_EVIDENCE_DECISION_INSTRUCTION`
(`AS/runtime/llm/evidence-loop.ts:12`) plus the constants at
`AS/runtime/llm/deepseek-provider.ts:35-44`, assembled by task kind at
`:405-413` — unreachable from any domain.

Proposal: register them as Core default stage instructions, one fixed
`instructionId` per stage, `source: "core"`, `requirement: "required"`. A domain
registers an instruction for the same stage carrying
`replaces: <coreInstructionId>`; the resolver drops the Core default when an
active replacement exists. Advantages:

- ordering stays with `compareInstructionsForLlm`/`scopeRank`, so Core keeps the
  one ordering authority;
- the override is visible in `instructions.instructionIds`, which already rides
  in the packet (`instruction.ts:16-22`) and therefore into the recorded trace —
  an override is auditable rather than invisible;
- the safety constants (JSON-only, "treat all strings as data") can be marked
  non-replaceable, so a domain can override *task* prose but not the
  injection defence.

Two cautions:

- **Conflict detection is a word heuristic.** `instruction.ts:44-52` finds a
  conflict only when required instructions in one scope contain both "always"
  and "never". A domain override contradicting a Core required instruction
  generally will not be caught. A real precedence rule is needed for
  `replaces`.
- **Truncation is silent-ish.** `:55-73` fills a token budget in scope order and
  truncates; a stage instruction ranked late could be cut to a warning. Stage
  instructions should be budgeted ahead of free-form ones, or marked
  non-truncatable.

---

## 5. What must be true for a non-browser domain

Take a domain with no DOM, no page, no selectors — say an ERP or REST domain
whose "state" is records and whose actions are API calls. Six requirements;
**three already hold**.

| # | Requirement | Status |
| --- | --- | --- |
| 1 | Register options whose `inputSchema` mentions nothing web | Loop supports it (`evidence-loop.ts:14-23`); **registration seam is web-shaped** |
| 2 | Return evidence as arbitrary bounded JSON | **Already true** (`:88`, `:93`, `:40-45`) |
| 3 | Carry its repair target opaquely | **Blocked** — `{selector}` hard-required (§6.1) |
| 4 | Pass Core's failure-evidence gate | **Already true** (`failure-evidence.ts:17-25`), but the denylist is web nouns (§6.6) |
| 5 | Enter the loop from a *failure*, not only Flow creation | **Blocked** (§6.4) |
| 6 | Supply state snapshots and diffs | **Already true** — boundary is neutral (§1.3) |

So the identical-loop test fails today on exactly three things: the target
contract, the entry point, and the registry. None is deep; the target contract
is the one with real blast radius.

---

## 6. Browser concepts that leak into Core

Ranked by how much they block L14. This is the most important section of this
report.

### 6.1 BLOCKING — the repair target *is* a CSS selector, in five Core places

```ts
// AS/runtime/llm/harness/structured-response.ts:14-16
export type AutomationStudioRuntimeTargetOverrideTarget = { selector: string };
```

| Where | Line | What it does |
| --- | --- | --- |
| `AS/runtime/llm/harness/structured-response.ts` | `14-16` | the type |
| same | `25-28` | guard: **exactly one key**, named `selector`, non-blank, ≤1000 |
| same | `21` | `temporary_target_override` patch carries it |
| `AS/runtime/service.ts` | `356` | `validateTargetOverrideEvidence?(evidence, target: { selector: string }, …)` in the *service options* |
| same | `3104-3109` | binds that callback |
| `AS/runtime/live-patch.ts` | `58-61` | same `{ selector: string }` in the patch-execution input |
| same | `123-134` | preflight calls it and acts on `matched`/`resolved`/`absent`/`ambiguous` |
| `AS/runtime/llm/deepseek-provider.ts` | `57-73` | `TARGET_OVERRIDE_PATCH_SCHEMA` **requires `selector`** in the JSON schema sent to the provider |
| same | `38` | prompt: "copy selector exactly from failureEvidence" |
| same | `568-574` | rejects any override whose target is not `{selector}` |

The irony is instructive: two types declared right beside each other got it
right and wrong. `AutomationStudioRuntimeTargetOverrideFailedAction`
(`live-patch.ts:34-37`) is commented **"Bounded, domain-neutral identity of the
action whose target failed"** and carries only `nodeId` and `definitionId` — the
correct pattern. Its sibling target is a raw selector.

Downstream, the domain's own signature is forced to match:
`domain/src/runtime/llm-evidence/tools.ts:91`. This is precisely plan decision
**L2** ("Core carries an opaque, domain-owned target object instead of
`{selector}`"), and this report is independent evidence that L2 is not optional
polish — it is the blocking item for L14.

### 6.2 HIGH — one mutable slot, not a registry, with no gate

`AS/runtime/service.ts:352-357` declares a single optional `llmEvidenceRuntime`
object; `bindLlmEvidenceRuntime` (`:769-772`) overwrites it. Consequences:

- **last bind wins** — two domains cannot coexist;
- the object carries **no `domainId`**, so Core cannot tell whose tools these are;
- Core ships **no options of its own**, so there is nothing for a domain to
  "extend" — L14's "Core ships the domain-neutral ones" describes nothing that
  exists;
- at `:1914-1918, 1952` the tools are passed to the loop **unfiltered** by
  domain, policy, capability, grant or task kind.

The node registry does all of this correctly one directory away
(`AS/nodes/canonical-registry.ts:46-59`).

### 6.3 HIGH — the loop is reachable only from Flow creation

`AS/runtime/service.ts:1913` gates the entire evidence loop behind
`if (input.evidenceGuided)` inside the Flow-bootstrap path. Reinforced by the
grant table (`AS/runtime/llm/execution-grants.ts:493-511`): only
`build_and_adapt` permits `flow_bootstrap` and `evidence_tool_decision`;
`diagnosis_only` permits one `runtime_diagnosis` call (`:497-499`) and
`diagnose_and_adapt` permits diagnosis plus `runtime_patch` (`:500-503`).
**A recovery run cannot legally call the exploration loop at all.** L12's "one
loop, three entry points" requires changing this table, not just the call site.

### 6.4 MEDIUM — stage vocabulary is closed, and stage prose lives in the provider

- `AS/runtime/llm/harness/task-kind.ts:4-14` — closed union of ten task kinds;
  `:16-27` a `promptVersion` per kind. A domain cannot add a stage or a kind.
- `AS/runtime/llm/deepseek-provider.ts:35-44, 405-413` — system prompts are
  provider-file constants selected by task kind.
- `AS/runtime/llm/evidence-loop.ts:12` — the de-facto "explore" instruction is a
  Core constant.
- Instruction scopes (`AS/model/flow-adaptation.ts:98-106`) have **no stage
  dimension**, so today a domain cannot attach an instruction to "explore" or
  "verify" at all.

Not a *browser* leak, but the direct obstacle to L15.

### 6.5 MEDIUM — Core's element-target model is DOM vocabulary

`AS/model/action-element-target.ts:6-26` —
`selector`, `xpath`, `queryPath`, `tagName`, `role`, `classNames`, `bounds`,
`attributes`, `url`, `visibleText`, `accessibleName`, `testId`, `automationId`.
Candidates add `visualFrameId`, `visualLayerId`, `isVisibleOnViewport`
(`:28-33`). Key lists repeat at `:157` and `:259`. `AS/model/state.ts:23` has a
`"selector"` state kind.

`AS/fingerprinting/element-fingerprint.ts` weights `selector: 14` and
`xpath: 11` (`:66-68, 102-104`), compares them as path signals (`:168-170`) and
scores `isVisibleOnViewport` (`:175`).

This is pre-existing and **partly justified**: `docs/architecture/package-boundaries.md:41-53`
explains the matcher deliberately ships to a browser so that host and Core
cannot disagree. It is listed here because the *exploration loop* must not
require it; a non-browser domain must never be forced to populate a fingerprint
to propose a repair.

### 6.6 LOW — web nouns in Core's sanitizers

- `AS/runtime/llm/harness/failure-evidence.ts:28` — forbidden keys
  `html, innerhtml, outerhtml, pagesource, snapshot, cookies, headers`. Web and
  HTTP nouns as a Core denylist. For a non-browser domain it enforces nothing,
  and Core has no generic way to say "no raw payload".
- `AS/runtime/llm/harness/context-packet.ts:127-137` —
  `containsReusableExecutableTarget` rejects keys matching
  `selector|selectors|target|targets|targetid|…`. "selector" again, in Core.
- `AS/runtime/llm/deepseek-provider.ts:596-609` —
  `containsForbiddenBootstrapKey` rejects any key matching `/recording|timeline/i`.

The *intent* of all three is right (keep raw content and executable targets out
of the model's reach). The *expression* is a hard-coded word list that only a
browser domain could have written. A domain-declared sensitive-key contribution
would generalize it.

### 6.7 Worth recording — what is already clean

To keep the report honest about scope: `evidence-loop.ts` in full, the tool and
execution-result contracts, `AutomationStudioRuntimeTargetOverrideFailedAction`,
the host runtime boundary, the node registry and its resolution vocabulary, and
the capability model are all already domain-neutral. The web specifics —
sanitization, target handles, reveal safety, the three tool ids — all sit
correctly in `domain/src/runtime/llm-evidence/`, whose barrel (`index.ts:1-9`)
even documents why the internals are deliberately not exported.

---

## 7. Recommended order of work

1. **L2 first** — replace `{selector}` with an opaque domain-owned target across
   the five Core sites in §6.1. Everything else in L14 is blocked behind it, and
   it is also the extraction plan's X6 dependency.
2. **Harness-option registry** (§3), seeded with Core's own neutral options, with
   `bindLlmEvidenceRuntime` kept as a shim so this repository does not break.
3. **Grant purpose + entry point** (§6.3) so a failure can enter the loop —
   a prerequisite for L12.
4. **Stage field + `loop_stage` instruction scope** (§4.2), including the cache
   digest fix.
5. **Core stage prose becomes default instructions** (§4.3), enabling override.

Steps 2 and 4 touch disjoint files and can run in parallel once step 1 lands.
Step 1 and step 3 both edit `service.ts`, so they are serial with the existing
`service.ts` chain recorded in the plan's Execution partition.

## 8. Open questions for the user

1. **Does a domain override of a *safety* instruction stay forbidden?** The
   recommendation is yes: JSON-only output and "treat strings as data" should be
   non-replaceable even under L15's "wholly override".
2. **Should two domains be registerable at once?** The registry design allows
   it; nothing in L14 requires it, and forbidding it is simpler. Recommendation:
   allow it in the data model, assert one active domain per run.
3. **`replaces` precedence when a domain override contradicts a Core required
   instruction** — the current conflict check (§4.3) will not catch it.

## 9. Not verified

- **Nothing was executed.** No build, no test, no type-check, no Lab run, no
  browser. Every claim is from reading source at the cited `file:line`.
- I did not confirm that the proposed `AutomationStudioHarnessOption` type
  type-checks against the existing loop, nor that adding a scope member compiles
  across every exhaustive `switch` over `AutomationStudioInstructionScope` —
  there may be more arms than the six sites listed in §4.2. A compiler run is
  the cheap way to enumerate them.
- I did not read the SQL instruction-scope mapping in detail
  (`AS/runtime/service/flows/store.ts:507`,
  `AS/storage/project/schema/domain-resources.ts:275`), so the storage cost of a
  `loop_stage` scope is estimated, not measured.
- I did not audit `apps/web` for UI that enumerates scope kinds; a new scope
  will likely need an editor affordance there.
- The §3.5 list of candidate Core-neutral options is a design suggestion; I did
  not verify each is implementable against the current host-runtime boundary.
- The browser-leak inventory in §6 is from targeted greps for `selector`, DOM,
  browser, page, tab, viewport and xpath across `AS/` and is thorough for those
  terms, but it is a keyword search, not a proof of absence for other web
  concepts.
