# R0 + exploration wiring — `service.ts` split and the recovery path driving it

All work in FluxIQ Core (`F:\!FluxIQ`). `AS/` below is
`packages/fluxiq/src/programs/automation-studio/`. Nothing in
`F:\!FluxIQWebExtension` was touched.

## Outcome

**Done.** Both parts landed.

- **R0.** `service.ts` is **6468 lines**, down from 6757, and
  `.structure-baseline.json` records 6468 — the baseline went **down by 289**,
  not up. `AutomationStudioService`'s method count is unchanged at 223, so the
  frozen `class-methods` entry is untouched too.
- **Exploration.** A recovery whose plan says `explorationRequested` now
  actually runs `runAutomationStudioRuntimeExploration`, and the result reaches
  the recovery trace. Proven by a test that fails when either half of the wiring
  is removed (measured below, not asserted).

## What changed and why

### New: `AS/runtime/recovery/annotation/`

`maybeAnnotateRunDetailWithRuntimeLlm` (313 lines, a private method on
`AutomationStudioService`) moved out whole and split by responsibility.

| File | Lines | What it holds |
| --- | --- | --- |
| `ports.ts` | 68 | `AutomationStudioRuntimeRecoveryPorts` — the eight things the path reaches the service for |
| `annotate.ts` | 369 | `annotateAutomationStudioRunDetailWithRuntimeLlm`: the four stages, every early return, the trace |
| `exploration.ts` | 200 | `runAutomationStudioRecoveryExploration`, the completion schema, and the `decide` helper |
| `patches.ts` | 142 | `applyAutomationStudioRuntimeRecoveryPatches`: each patch executed or proposed, one receipt each |
| `index.ts` | 4 | Barrel |
| `tests/annotate.test.ts` | 337 | 6 tests |
| `tests/exploration.test.ts` | 163 | 2 tests |

`service.ts` keeps `maybeAnnotateRunDetailWithRuntimeLlm` with the same
signature and the same two call sites; its body is now the delegate plus the
inline ports object. The ports object is inline rather than its own method
**because a new private method would have taken `AutomationStudioService` to 224
methods against a frozen 223-method baseline**, which `--update` cannot raise.

Eight ports, named for what the path asks for rather than for the service:
`resolveLlmProvider`, `llmEvidenceRuntime`, `reusableLlmContextEnabled`,
`flowInstructionSet`, `reusableLlmContextForFreshEvidence`, `flowScope`,
`saveFlowChangeProposal`, `saveFlowAdaptation`, `promoteRuntimeAdaptation`.

Two things had to be decided rather than moved:

- **`stringSetting`** is a private helper in `service.ts` with three other
  callers, so it stayed there. The moved code carries its own three-line
  `settingString`, which is the same predicate; it is not a dropped copy of a
  module that should have moved.
- **`flowScope`** is new. The harness-option registry needs an
  `AutomationStudioFlowScope` to decide which options to offer, and the recovery
  path never had one — `AutomationStudioRuntimeAdaptationContext` carries
  project and Flow ids and no scope, and `AutomationStudioFlowDocument` has no
  `scope` field. The port reads the Flow artifact and answers `undefined` when
  it cannot. **`undefined` does not mean "anywhere"**: the exploration is not
  run at all, and the trace records that the plan asked for one and none
  happened. Deriving the scope from the bound domain instead was the tempting
  shortcut and is wrong: it would offer a domain's options to a Flow scoped to a
  different domain, and would withhold Core's own unscoped options the moment a
  host port is bound.

`annotation/` imports `../../service.ts` **type-only** for
`AutomationStudioRuntimeAdaptationContext`,
`AutomationStudioLlmProviderResolution`,
`AutomationStudioLlmProviderResolverInput` and
`AutomationStudioReusableLlmContextFreshEvidenceInput`, which are declared
there. Type-only, so the import is erased and no runtime cycle is created; and
the audit's barrel rule exempts it, because the importer is inside `runtime/`.

### The exploration wiring (hunk 3 of `w2-3-bounded-exploration.md`)

Applied inside the extracted module, with four deliberate differences from the
sketch:

1. **`recoveryDeadline` is started once**, at the top of the path, right after
   the training-mode gate and before the invocation decision — so it covers the
   diagnosis call too, not just the exploration.
2. **`resolution` does not exist on this path.** The sketch's `...resolution`
   came from the Flow-bootstrap path, where the node registry supplies one. Here
   the registry call is
   `{ scope, stage: "gather", policy: input.context.policy }`.
   **`allowSideEffectsWithoutPolicy` is absent**, as the brief requires: a
   runtime recovery always has a policy, the policy is authoritative in
   `sideEffectAllows`, and a mutating option is offered exactly when
   `policy.allowExternalSideEffects` is true. Two tests pin both directions.
3. **`decide`** is `explorationDecision`, modelled on the Flow-bootstrap path:
   one `runAutomationStudioLlmHarness` call, `taskKind: "evidence_tool_decision"`,
   `stage: "gather"`, the run's own `runBudget`, the policy, the recovery
   context, the domain's `deniedEvidenceKeys`, and the loop's
   `iteration / tools / evidence / decisionSchema / canComplete`. A call that
   does not come back as a decision throws.
4. **A completion schema was needed and did not exist.**
   `AutomationStudioLlmContextPacket["evidenceLoop"].completionSchema` is
   required, so `AUTOMATION_STUDIO_RECOVERY_EXPLORATION_COMPLETION_SCHEMA` is
   declared here: `findings` (required) and `unresolved`, and deliberately
   nothing shaped like a repair — deciding what to change is the patch stage's
   work, and a completion schema that accepted a patch would let the model skip
   the stage that is answerable to a policy.

`exploration` is passed into the existing `automationStudioRuntimeRecoveryTrace(...)`
call as `...(exploration ? { exploration } : {})`.

### One thing the wiring exposed, and what was done about it

**The exploration is billed to the run's own LLM budget, and that budget refuses
it far more often than expected.** The run budget's default is
`maxCallsPerRun = 2` and `maxTokensPerRun = 12_000`; the diagnosis takes one
call, the patch takes the other, and an exploration decision is refused with
`llm_budget.run_call_limit` or `llm_budget.run_total_limit`. That is correct
accounting — it is model spend on this run — but the *ending* was reported
wrongly: a refused decision throws, the loop answers
`llm_evidence_loop.invalid_decision`, and the runner classifies that as
`failed`, which reads as "the loop broke" rather than "a limit was reached".

`AUTOMATION_STUDIO_EXPLORATION_OUTCOME_FOR_RUN_BUDGET` already existed in
`exploration-outcome.ts`, documented as "for an exploration refused before it
starts", with no caller. It has one now:
`runAutomationStudioRecoveryExploration` keeps the first run-budget diagnostic
code it sees and, **only when the runner's own answer was `failed`**, renames
the outcome through that table — so `budget_exhausted`, with
`endedBy: "llm_budget.run_call_limit"`. The exploration's own ledger always
outranks this: a wall clock, a recovery deadline, an action cap or a refusal
that fired first leaves an outcome that is not `failed` and is left alone.

**This does not size the budget, and sizing it is still open** (below).

## Commands run and observed results

All in `F:\!FluxIQ`.

```
pnpm check
  -> pnpm structure:test  : # fail 0  (rule tests)
  -> node scripts/structure-audit.mjs : structure-audit: passed (140 warning(s), 254 baselined)
  -> pnpm -r check        : packages/contracts, packages/client-gateway-websocket,
                            packages/fluxiq, apps/web -> all "Done", CHECK_EXIT=0

node scripts/structure-audit.mjs --update
  -> lowered [file-lines] .../runtime/service.ts: 6757 -> 6468
  -> baseline written: 254 entries across 7 rules (1 lowered, 0 removed)
  -> `git diff .structure-baseline.json` shows exactly that one line changed.

npx vitest run src/programs/automation-studio/runtime --root packages/fluxiq --no-file-parallelism
  -> Test Files 96 passed | 1 failed (97),  Tests 883 passed | 1 failed (884)
  The one failure is not mine; see "Open questions" below.

npx vitest run src/programs/automation-studio/runtime/recovery/annotation --root packages/fluxiq --no-file-parallelism
  -> Test Files 2 passed (2),  Tests 8 passed (8)

wc -l runtime/service.ts  ->  6468   (was 6757)
```

`node ./node_modules/typescript/lib/tsc.js --noEmit` in `packages/fluxiq` was
run directly several times during iteration; final run `TSC_EXIT=0`.

Two runs died with a Windows access violation / a crash inside TypeScript's own
parser and were clean on an immediate rerun with no change in between. That is
this machine's known RAM fault, not a code defect.

### Negative probes — four, each reverted, each observed

1. **Remove the call into `runAutomationStudioRecoveryExploration`**
   (`if (false && plan.explorationRequested ...)`) → **4 of 6 tests fail**,
   including `runs a bounded exploration when the plan asks for one, and takes
   an action to do it` (`expected [] to deeply equal [ 'test.inspect' ]`).
2. **Stop passing `exploration` into `automationStudioRuntimeRecoveryTrace`** →
   **2 fail**: the trace stage is still `skipped` where it should be `completed`
   with `outcome: evidence_gathered`, and the budget-exhaustion test loses its
   `outcome`/`endedBy`.
3. **Stop passing `recoveryDeadline` into the runner** → `stops before the first
   provider call when the whole recovery is already out of time` fails: the
   provider is called and the option runs
   (`expected [ 'provider', 'test.inspect', 'provider' ] to deeply equal []`).
4. **Stop passing `classifyRefusal`** → `ends in unsafe_action_blocked when the
   domain refuses what the model asked for` fails: the refusal is not counted,
   so the exploration runs on instead of stopping.

All four were restored from backups and the suite re-run green.

### What the eight tests assert

`tests/annotate.test.ts` drives the whole recovery path with eight stub ports, a
scripted provider and a two-option domain bundle — no service, no project
directory, no filesystem. That is only possible because of R0.

- an exploration runs, takes a real action, and reaches the trace as
  `completed` / `evidence_gathered` with `observedActions: 1`, `providerCalls: 2`;
- a Flow with no readable scope gives `skipped` and *"The plan asked for
  exploration and none was run."* — the absence is stated, not silent;
- with `allowExternalSideEffects: false` the model is offered `["test.inspect"]`
  only; with it true, `["test.inspect", "test.reveal"]`;
- a run budget of one call ends the exploration in `budget_exhausted` /
  `llm_budget.run_call_limit`, with no action taken;
- a plan that asked for nothing gives `skipped` / *"The plan did not call for
  exploration."*

`tests/exploration.test.ts` covers the two things the caller has to carry and
can silently drop: an already-expired recovery deadline stops the exploration
before the first provider call with `recovery_deadline_expired` (explicitly
*not* `wall_clock_expired`), and a domain refusal classified as
`destructive_action_refused` ends it in `unsafe_action_blocked` with no
`result`.

## Not verified

- **No live browser, no real provider, no Lab run.** Every test uses a scripted
  provider and a stub domain bundle. Nothing here has touched a real page, and
  the plan's 2.9 proof is untouched.
- **The downstream half of hunk 2 was not applied.** `domain/src/runtime/llm-evidence/tools.ts`
  still does not pass `harnessOptions` on its binding, so in the shipped
  extension the recovery exploration would today find an empty option list from
  the web domain. That edit is in `F:\!FluxIQWebExtension`, which this brief
  forbids. **Until it lands, the wiring runs but has nothing to run with.**
- **`pnpm test` and `pnpm build` were not run whole.** `pnpm check` was, and the
  Automation Studio runtime suite was. Other workers have edits in flight, so a
  whole-repository test gate would not attribute cleanly.
- **The run-budget rename is exercised through `llm_budget.run_call_limit`
  only.** The other five codes in `AUTOMATION_STUDIO_EXPLORATION_OUTCOME_FOR_RUN_BUDGET`
  are typed as total by the `Record` but not each driven by a test.
- **`patches.ts` has no test of its own.** Its behaviour is unchanged from the
  method it came out of and is covered by the existing service-adaptation
  suites, which pass; but the extraction itself is verified by type check and by
  those suites, not by a test written against the new function.
- **The `now` seam is an injected clock, not a wait.** The recovery-deadline
  test drives an expired deadline through `now`, not by sleeping.

## Open questions or contradictions found

1. **The run budget has no room for an exploration by default, and sizing it is
   not settled.** With `maxCallsPerRun = 2` (the default when nothing is
   configured) the diagnosis and the patch take both calls, so a real recovery
   will usually record `budget_exhausted` for its exploration before it does
   anything. Three options, none of which I invented on my own authority:
   raise the default call allowance when a plan asks for exploration; give the
   exploration its own sub-allowance carved out of the run budget; or leave it
   and treat exhaustion as the honest answer. **My recommendation is the second
   — carve out an explicit exploration allowance — because it is the only one
   where the number a person sets means what it says.** This wants a decision
   before the Lab proof, or the proof will measure the budget rather than the
   exploration.
2. **`recovery/tests/runtime-exploration.test.ts` needed a one-line fixture fix
   that was not mine to make.** Another worker made
   `AutomationStudioLlmEvidenceRuntimeBinding.deniedEvidenceKeys` **required**
   and updated four test files but missed this one, leaving `pnpm check` red. I
   added `deniedEvidenceKeys: []` to the fixture so the gate could pass. It is
   not on my brief's "must not touch" list, but the supervisor should know the
   edit is in the tree in case that worker touches the same file.
3. **One pre-existing runtime test failure, which is not mine.**
   `runtime/tests/service-bootstrap/tests/generation.test.ts > packs opted-in
   reusable context ...` fails with
   `flow_bootstrap.provider_request_failed`. The cause is another worker's new
   `declaredDeniedEvidenceKeys` in `llm/harness/context-packet.ts`, which now
   **throws** when a request carries `reusableContext` or `failureEvidence`
   without `deniedEvidenceKeys` — and `generateFlowBootstrapAdaptation`'s
   evidence-loop call passes `reusableContext` and no `deniedEvidenceKeys`
   (`service.ts` ~1930). It is a real production defect in the Flow-bootstrap
   path, not a stale test: that path will now throw for any opted-in reusable
   context. The recovery path I own passes the key list on every call that
   carries either, so it is unaffected. **Somebody must fix the bootstrap call
   site.**
4. **The plan's `explorationRequested` can only be set by the model.**
   `buildAutomationStudioRuntimeStructuredDiagnosis` starts from
   `explorationNeeded: false` deterministically and only a `response.diagnosis`
   field raises it. So with no provider, or with a provider that does not fill
   the field, no exploration ever runs — by construction. That may be intended
   (L5: the cheaper answer first), but nothing deterministic can currently ask
   for a look at the live environment, and the plan reads as though something
   should be able to.
5. **`patches.ts` takes `reusableContextMetadata` where the original read
   `reusableContextResult` for its presence.** The two are equivalent today
   because `metadata` is always present on that result, and the field is
   documented as "present exactly when reusable context was consulted". If that
   result ever gains an absent-metadata shape, the adaptation would silently
   stop recording the receipt.
