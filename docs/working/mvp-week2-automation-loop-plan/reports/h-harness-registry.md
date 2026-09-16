# Phase H — the harness-option registry and the loop's other entry points

Decision L14, built in FluxIQ Core. Path prefix: `AS/` is Core's
`packages/fluxiq/src/programs/automation-studio/`. No file outside
`AS/runtime/llm/**` was changed.

## Outcome

**Done**, with one hand-off: the wiring `AS/runtime/service.ts` needs is worked
out, type-proved by a test, and written below as an exact diff for the
supervisor to apply, because that file is owned by another worker right now.

The exploration loop was not rewritten. `evidence-loop.ts` is untouched. What
was missing around it now exists:

1. **A registry** of harness options, scoped the way the node registry one
   directory away scopes nodes.
2. **Core-owned domain-neutral options** — six, where Core shipped zero.
3. **The other entry points** — a new grant purpose `explore_and_adapt` lets a
   run that failed, or an existing Flow that met an edge case, reach the same
   loop that Flow creation reaches. The grants a person may already hold keep
   exactly the meaning they were given.
4. **The unscoped `llmEvidenceRuntime` slot** is adapted into a domain-scoped
   bundle by a shim, so a host keeps working after adding one field.

The L14 claim is held by a test rather than by intent: a fictional ERP ledger
domain with no web page in it registers its options, and the real evidence loop
runs offering them alongside Core's. A second test fails the build if any web
noun appears in Core's option declarations or in the registry's own code.

## What changed and why

### New, `AS/runtime/llm/harness-options/`

| File | Lines | What it holds |
| --- | --- | --- |
| `option.ts` | 165 | `AutomationStudioHarnessOption` = the evidence-loop tool plus `availability`, `requiredRuntimeCapabilities`, `safety`, `stages`; its validation; and the projection back to a bare tool |
| `host.ts` | 38 | The narrow port Core's own options read through: `describeFlowGraph`, `describeNode`, `listAvailableNodes`, `captureStateSnapshot`, `inspectStateDiff`, `listPriorAdaptations` |
| `builtin.ts` | 211 | Core's six neutral options, each gated on the host method behind it |
| `registry.ts` | 236 | `AutomationStudioHarnessOptionRegistry`: register, get, list, tools, execute, `evidenceLoopBinding` |
| `binding.ts` | 102 | `AutomationStudioLlmEvidenceRuntimeBinding` and the shim that turns today's single slot into a domain bundle |
| `index.ts` | 29 | Barrel, re-exported from `AS/runtime/llm/index.ts` |
| `tests/registry.test.ts` | 276 | 9 tests, including the non-browser-domain proof |
| `tests/builtin.test.ts` | 100 | 4 tests, including the domain-neutrality guard |
| `tests/binding.test.ts` | 87 | 5 tests, including a compile proof of the service call site |

**Why the option type extends the tool rather than paralleling it.** The loop
already consumes `AutomationStudioLlmEvidenceTool` and the provider already
validates it, so an option is that type plus the gate. The gate reuses the node
registry's vocabulary exactly — `AutomationStudioNodeAvailability`,
`requiredRuntimeCapabilities`, `safety.requiredPermissions` — so a domain
declares an option the way it already declares a node.

**Why `tools()` is a projection and not the options themselves.** This is a
defect the design would have walked into. `deepseek-provider.ts:561` rejects any
tool carrying a key outside the six it knows, so handing the loop the full
option objects would have made every evidence request invalid the moment a
provider saw it. `automationStudioHarnessOptionTool` writes the six fields by
name — no spread, so a renamed field is a compile error rather than a wider
payload — and `registry.tools(resolution)` is what the loop receives.

**Why `evidenceLoopBinding` exists.** It returns `{tools, executeTool}` built
from one resolution, so the grammar the model is given and the gate its call
passes through cannot drift apart. The dispatch re-checks the resolution anyway,
because the model picks the id.

**A second latent defect, fixed at the same seam.** `evidence-loop.ts:309`
rejects the whole configuration when a tool declares
`repeatPolicy: "after_mutation"` and no tool in the same list can mutate. Core's
`core.state_snapshot` declares that policy, so any resolution offering it
without a domain's mutating option beside it would have returned
`llm_evidence_loop.invalid_configuration` — the loop refusing to start at all.
`tools()` drops the policy in that case, and the test plants the un-dropped
version to prove the loop really does refuse it.

**Registration rules, all mechanical.** A duplicate option id throws, so a
domain extends the Core set and can never replace it. A domain bundle may only
declare domain-scoped options and a Core bundle may only declare unscoped ones.
One bundle per domain, as with the importer SDK. Every option needs an
implementation and every implementation needs an option. Declarations and
implementations are stored apart, so `list()` never hands out host code.

**Side effects.** Destructive is never offered — gathering information never
requires destroying anything. Mutating needs permission, and where an adaptation
policy governs the call that policy is authoritative; only where none governs it
does the caller's explicit `allowSideEffectsWithoutPolicy` apply. That second
clause is not decoration: Flow bootstrap has no adaptation policy, so a
policy-only gate would have silently withheld the web domain's `navigate` and
`reveal` tools and broken evidence-guided generation. The call-site diff below
passes it, preserving today's behaviour exactly.

**Core's six options.** `core.flow_graph`, `core.node_detail`,
`core.node_catalog`, `core.state_snapshot` (needs `state-snapshot`),
`core.state_diff` (needs `state-diff`), `core.prior_adaptations`. Each appears
only when the host binds the method behind it, so a host binding nothing behaves
exactly as it did before this phase. None declares an `initialObservation`: the
loop runs at most one, and a Core option taking that slot would take it from
every domain. Each validates its own input and returns a recoverable
`{ok:false,code}` rather than throwing, because the loop passes the model's
input through without checking it against the schema.

### Changed, `AS/runtime/llm/execution-grants.ts`

- `AutomationStudioLlmExecutionGrantPurpose` gains `explore_and_adapt`.
- `requestMatchesGrant` gives it everything `build_and_adapt` has except
  `flow_bootstrap`: `evidence_tool_decision`, `runtime_diagnosis`,
  `runtime_patch`, `instruction_suggestion` and the four change-proposal kinds.
- Default call budget 6, inside the existing ceiling of 8; it still requires an
  exact Flow settings revision, like every non-diagnosis purpose.

**Why a new purpose rather than widening `diagnose_and_adapt`.** That grant is
pinned at exactly two provider calls, and a person who granted it consented to
two calls and no exploration. Widening it would retroactively change what they
agreed to. A new purpose reaches the same loop — one system, three entry points —
while every grant already issued keeps its meaning. The test asserts both halves:
an exploration grant gets past the grant table to the loop's task kind, and a
`diagnose_and_adapt` grant still gets `request mismatch` for the same request.

### Changed, `AS/runtime/llm/index.ts`

One line: `export * from "./harness-options/index.ts";`.

## The diff `service.ts` needs — for the supervisor to apply

Net **−4 lines**, which matters: `service.ts` is 6757 lines against a frozen
baseline of 6758, so it has one line of headroom. Line numbers are as of
`service.ts` at 6757 lines.

**1. Options type — replace lines 354-359 (6 lines) with 1:**

```ts
  llmEvidenceRuntime?: AutomationStudioLlmEvidenceRuntimeBinding;
```

**2. Import on line 118** — add `automationStudioHarnessOptionRegistry` (a
value) and `type AutomationStudioLlmEvidenceRuntimeBinding` to the existing
`from "./llm/index.ts"` import. `AutomationStudioLlmEvidenceTool` and
`AutomationStudioLlmEvidenceToolExecutionResult` may become unused there once
the inline type goes; `tsc` will say.

**3. Loop call site — insert one line before line 1921
(`const loop = await runAutomationStudioLlmEvidenceLoop({`):**

```ts
          const harnessOptions = automationStudioHarnessOptionRegistry({ binding: this.llmEvidenceRuntime }).evidenceLoopBinding({ projectId, flowId }, { ...resolution, allowSideEffectsWithoutPolicy: true });
```

`resolution` is the `AutomationStudioNodeRegistryResolution` already in scope
from line 1875. `allowSideEffectsWithoutPolicy: true` is what preserves the
current behaviour of this path, where no adaptation policy exists.

**4. Replace line 1922:**

```ts
            tools: harnessOptions.tools,
```

**5. Replace line 1956:**

```ts
            executeTool: harnessOptions.executeTool
```

Line 1918's guard (`if (!this.llmEvidenceRuntime?.tools.length)`) still holds and
needs no change. `bindLlmEvidenceRuntime` (773-776) needs no change.
`captureSanitizedFailureEvidence` (2954, 2961) and
`validateTargetOverrideEvidence` (3117-3119) keep working: both fields survive on
the named binding type.

`tests/binding.test.ts` contains a compile proof of hunks 3-5 — it builds the
registry from a possibly-undefined slot and spreads a real
`AutomationStudioNodeRegistryResolution` into the resolution, so the shapes are
checked by `tsc` rather than asserted here.

## Downstream change this requires

`F:\!FluxIQWebExtension\domain\src\runtime\llm-evidence\tools.ts:212-217` binds
the evidence runtime. It must add one field:

```ts
domainId: WEB_AUTOMATION_DOMAIN_ID,
```

Without it Core will not compile downstream. This is the point of the phase —
the slot had no domain id, so Core could not tell whose tools it held — but it
is a breaking change to a Core binding and belongs in the same work unit.

## Not applied, and why

- **`AS/api/contracts/llm.ts:22`** carries its own literal union
  `"diagnosis_only" | "diagnose_and_adapt" | "build_and_adapt"`. It is not
  derived from Core's type, so nothing broke, but `explore_and_adapt` cannot be
  requested over the wire until it is added there and in
  `AS/api/handlers/llm-generation.ts`. `programs/*/api/**` is not mine.
- **`docs/architecture/automation-studio.md`** describes the grant lanes at
  lines 313-326 and 614-642 and needs the new purpose; the harness-option
  registry needs a section of its own. Not mine to edit.
- **Wiring Core's six options to real data.** They are declared, implemented and
  tested against the host port, but nothing binds that port yet, so in the
  shipped app they are absent and behaviour is unchanged. Binding it means
  adding `describeFlowGraph` and friends to the service, which is service.ts
  work and the natural next increment.

## Commands run and observed results

All run in `F:\!FluxIQ`.

- `npx tsc --noEmit` in `packages/fluxiq` — **exit 0, no output**, both before
  any edit (clean baseline) and after every change.
- `npx vitest run src/programs/automation-studio/runtime/llm` — **10 files
  passed, 117 tests passed, 0 failed** (from 7 files / 107 tests before this
  phase; `execution-grants.test.ts` went 19 → 20).
- `node scripts/structure-audit.mjs` — passed with 0 violations on my first run.
  On later runs it reports **1 violation, in a file I do not own**:
  `[imports] AS/runtime/recovery/adaptation-promotion.ts: 1 import(s) reach into
  another directory's files instead of its barrel, e.g. "../service/json-values.ts"
  at line 3`. That file arrived in commit `a2de143` between my runs.
  `node scripts/structure-audit.mjs 2>&1 | grep -i harness-options` returns
  **nothing**: no finding against any file of mine.
- `npx vitest run src/programs/automation-studio` (whole program) — **1085
  passed, 14 failed across 6 files**, none in `runtime/llm`. The failures are
  `EBUSY: resource busy or locked, unlink ...project.sqlite` in
  `storage/project/tests/runtime-stream-store.test.ts` and similar.
  `runtime/tests/service-flow-bootstrap-adaptation.test.ts` failed in that run
  and **passes alone, 9/9**, so these are contention between concurrent test
  workers on one temp directory, not regressions.
- Two negative probes, both reverted, to prove the new guards are not vacuous:
  planting `"page selector"` in a Core option description made
  `builtin.test.ts > names no browser concept` fail as intended; leaving
  `repeatPolicy` on the state-snapshot tool made the loop return
  `llm_evidence_loop.invalid_configuration`, which is now asserted in the test
  rather than only reasoned about.
- `node scripts/structure-audit.mjs --update` was run once **into a scratch copy
  and immediately restored**, only to identify the "1 baseline entry can be
  lowered" message. The entry is
  `file-lines: AS/runtime/service.ts 6758 → 6757` — another worker's file. The
  baseline was left untouched; `git status .structure-baseline.json` is clean.

## Not verified

- **The service.ts diff was never applied or compiled.** Its types are proved by
  a test, and the line numbers were read off the current file, but no run has
  executed the loop through the registry inside the real Flow-bootstrap path.
- **No live browser run, no provider call.** The evidence-loop tests use scripted
  decisions, as the existing loop tests do.
- **Core's six options have never returned real data**, because no host binds the
  port. Their implementations are tested against a stub host only.
- **The downstream repository was not touched or compiled.** The one-line
  `domainId` change is stated, not made.
- **`pnpm check` and `pnpm build` were not run whole.** The audit and the package
  type check were run directly; the repository has other workers' edits in
  flight, so a whole-repository gate would not attribute cleanly.
- The whole-program test run's 14 failures were diagnosed as contention from one
  file passing in isolation; I did not rerun the full suite serially to confirm
  all six.

## Open questions or contradictions found

1. **The registry forbids shadowing outright; `w2-c` proposed an `overrides`
   escape hatch.** I did not build it. L14 says a domain "extends the core set
   rather than replacing it", and a duplicate id throwing is the mechanical form
   of that. A domain wanting different behaviour registers a different id.
   Reversible later if a real case appears.
2. **Stages are typed as opaque strings, not a closed union.** Phase S owns the
   stage protocol. The registry carries the dimension and gates on it today; when
   Phase S lands its vocabulary, narrowing `AutomationStudioHarnessOptionStage`
   changes no registration. An option pinned to stages is withheld from a call
   that names no stage, rather than treated as a wildcard — a widening avoided,
   but worth confirming against Phase S's intent.
3. **`explore_and_adapt` is a fourth purpose, where the plan's L6 asked for "a
   distinct grant purpose for runtime recovery" and L13 replaced L6's restrictive
   posture.** I read L13 as being about approval mode gating application rather
   than about removing the grant, and kept the grant. If the intent was that a
   failure entry uses `build_and_adapt` directly, this should be revisited —
   though `AS/api/handlers/llm-generation.ts:36` forbids a `build_and_adapt`
   grant from carrying runtime flags, which is a second reason it does not fit a
   run that failed.
4. **The third entry point — an edge case in an existing Flow — shares
   `explore_and_adapt` with the failure entry point.** They differ in what seeds
   the context, not in what they are authorized to do, so one purpose covers
   both. If the two need different budgets, that is a split to make later.
5. **`service.ts` has one line of headroom against its frozen baseline.** The
   diff above is net −4, but anything else landing in that file first could make
   even a small change impossible. Worth applying this diff early.
6. **Phase H's code is already inside another phase's commit.** Commit `a2de143`
   ("Record success only from evidence that something actually happened",
   Phase D) swept up eight of my files mid-write, including
   `execution-grants.ts`, `llm/index.ts` and four of the new
   `harness-options/` files. I committed nothing; a broad `git add` during
   another phase's commit caught work in progress. Nothing is lost — the rest is
   in the working tree — but the commit history now attributes Phase H to
   Phase D, and a later `git add -A` will do the same again while several
   workers are writing at once. At the time of writing, still uncommitted:
   `harness-options/binding.ts`, `harness-options/tests/binding.test.ts`, and
   modifications to `harness-options/registry.ts`, `harness-options/index.ts`
   and `harness-options/tests/registry.test.ts`.
