# Phase 2.3 — bounded exploration at run time

Built in FluxIQ Core (`F:\!FluxIQ`) and the web domain (`F:\!FluxIQWebExtension`).
Path prefix: `AS/` is Core's `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

**Done**, with one hand-off: the wiring that makes the exploration run inside a
real recovery needs `AS/runtime/llm/harness-options/binding.ts` and
`AS/runtime/service.ts`, both of which this brief forbids. The exact diffs are
below, worked out against the current files rather than sketched.

No loop was written. `AS/runtime/llm/evidence-loop.ts` is untouched, and so is
every other file under `AS/runtime/llm/**`. What this phase supplies is what was
missing **around** the loop:

1. **Closed exploration outcomes** — seven, exhaustive, with the classification
   tables written as `Record`s over their source vocabulary so an unmapped code
   is a compile error rather than a silent default.
2. **An exploration budget** — wall clock, action count, provider-call count, a
   repeat limit across mutations, a refusal allowance, a domain-enforced scope
   policy, and destructive off as a *type* rather than a flag.
3. **The whole-recovery time limit**, separate from any one exploration's, and
   recorded as its own stop reason so the two never read as the same advice.
4. **The web domain's five harness options**, declared in Core's option shape and
   registered through Phase H's registry — inspect, reveal, safe dismiss or
   click, bounded wait, scoped navigation — with decision L3's semantic refusal
   in the domain that owns the meaning.

**The property the brief said matters most is held by a test that fails loudly
when it is broken.** Ran-out-of-budget, found-nothing, was-refused and succeeded
are four different outcomes, compared against each other in one assertion, and a
mutation that lets them collapse fails ten tests (measured, below).

## What changed and why

### Core — new, `AS/runtime/recovery/`

| File | Lines | What it holds |
| --- | --- | --- |
| `exploration-outcome.ts` | 156 | The seven outcomes, the nine stop reasons, three exhaustive `Record` tables, and the one function that can construct success |
| `exploration-budget.ts` | 320 | The budget type, its defaults and ceilings, the scope policy and its comparison, and `AutomationStudioExplorationBudgetLedger` |
| `recovery-deadline.ts` | 70 | The whole recovery's clock: started once, an absolute instant, never a duration passed around |
| `runtime-exploration.ts` | 307 | `runAutomationStudioRuntimeExploration` and the `exploration` trace event |
| `tests/exploration-outcome.test.ts` | 133 | 27 tests |
| `tests/exploration-budget.test.ts` | 234 | 22 tests |
| `tests/runtime-exploration.test.ts` | 294 | 22 tests |

Modified, all inside `AS/runtime/recovery/`: `index.ts` (four exports),
`trace.ts` (the loop-stage map moved here), `stages.ts` (the `exploration` event
is now real), `tests/stages.test.ts`.

#### The outcomes, and why there are seven

```
evidence_gathered · no_evidence_found · budget_exhausted · unsafe_action_blocked
user_intervention_required · cancelled · failed
```

The four the brief named are four separate members. The other three exist
because collapsing them would repeat the same defect one level down:

- **`cancelled`** is a run stopped from outside. Reporting it as
  `budget_exhausted` would send somebody to raise a limit that was never
  reached; reporting it as `failed` would send them looking for a bug.
- **`user_intervention_required`** is a refusal a person can clear, where
  `unsafe_action_blocked` is one they cannot.
- **`failed`** is the loop breaking, which is not a limit being reached.

**Success is constructible in one place and takes three things.**
`automationStudioExplorationCompletionOutcome` returns `evidence_gathered` only
when an action returned evidence rather than a refusal, that action carried
bytes, and the completion is non-empty. A model that completes on its first turn,
a model whose every call was refused, and a completion of `{}` are each
`no_evidence_found`. That is Phase D's rule one layer further out, and each of
those three shapes is a way an exploration used to arrive downstream as "nothing
was wrong".

**The tables are `Record`s, not lookups with a fallback.** A fallback is how an
unnamed ending goes silent. A new evidence-loop failure code is now a compile
error in `exploration-outcome.ts`, which is where the decision belongs.

#### The budget composes Core's bounds rather than restating them

The loop keeps its own evidence-byte ceiling and its own duplicate and
no-progress checks. The ledger adds five things it cannot see:

- **A wall clock**, armed at the smaller of this exploration's limit and what is
  left of the whole recovery, as one `AbortController` the loop is given. Which
  of the two clocks bound is recorded: `wall_clock_expired` versus
  `recovery_deadline_expired`.
- **An action count the ledger owns.** The loop's `maxToolCalls` is left at
  Core's ceiling (16) and the ledger is the binding limit, so the cap can be
  reported precisely instead of arriving as `iteration_limit`. **A refused action
  still counts**: the scoping report named "let `maxActions` count only
  successful actions" as a mutation, and it is caught by four tests.
- **A repeat limit across mutations.** The loop refuses an identical request
  inside one mutation epoch; it cannot see a *cycle* — reveal, navigate, reveal,
  navigate — where each repeat is legal because something changed between. The
  ledger counts an action's identity for the whole exploration, so a cycle ends
  at the third turn rather than at the sixteenth tool call.
- **A refusal allowance.** A refusal is feedback the first time and a wall once
  the allowance is spent. This is what turns "it kept being told no" into
  `unsafe_action_blocked` rather than into an exploration that found nothing.
- **A scope policy Core carries and the domain enforces**, as opaque strings.
  `same_scope` with an unknown current scope refuses, and an empty allowlist
  refuses everything — both fail closed rather than meaning "anywhere".

**`allowDestructive` is typed `false`.** Not a default, not a flag: there is no
value a caller can pass. A test casts `{ allowDestructive: true }` through the
resolver — the shape a future call site would use to try — and asserts the answer
is still `false`.

The three ceilings that bound the loop are written out as literals rather than
read from `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS`, with a test pinning them
equal. That is not a preference: `llm/harness/intervention.ts` imports a *value*
from `AS/runtime/recovery/`, so reading one back at module-evaluation time closes
a cycle and leaves the constant holding `undefined`. It was observed, not
theorised — three suites failed with
`TypeError: Cannot read properties of undefined (reading 'maxToolCalls')` before
the literals went in.

#### The runner has one exit

`runAutomationStudioRuntimeExploration` returns one classified result and has a
`finally` that releases the clock. **The ledger's stop reason beats the loop's
code**, because the loop says `cancelled` for every abort there is. `result` is
written on the `evidence_gathered` branch and nowhere else, so a caller cannot
read a finding out of an exploration that was stopped, refused or empty.

`automationStudioExplorationTraceEvent` gives the recovery trace its
`exploration` stage: counts and verdicts only, no model prose. An exploration
that ran and found nothing is `completed`, not `skipped` — calling it skipped
would be the absence standing in for the work again. `stages.ts` no longer says
"the runtime exploration loop is not built yet".

### Downstream — new, `domain/src/runtime/llm-evidence/`

| File | Lines | What it holds |
| --- | --- | --- |
| `capture.ts` | 115 | The session choice, the metadata, the sanitized capture and act-then-capture, extracted from `tools.ts` so authoring and exploration share one |
| `harness-options/safety.ts` | 130 | Decision L3's semantic ladder |
| `harness-options/options.ts` | 135 | The five declarations and the bundle |
| `harness-options/execute.ts` | 203 | What each one does to the page |
| `harness-options/vocabulary.ts` | 68 | Option ids, the refusal classifier, the scope function |
| `harness-options/index.ts` | 29 | Barrel |
| `harness-options/tests/safety.test.ts` | 96 | 17 tests |
| `harness-options/tests/options.test.ts` | 220 | 9 tests |

Modified: `llm-evidence/index.ts`, `llm-evidence/tool-rejection.ts` (one new
code), `llm-evidence/tools.ts` (340 → 289 lines; the capture helpers moved out,
behaviour unchanged).

#### Decision L3, built as a ladder and not a score

`webRecoverySafeActionVerdict` consults no fingerprint, no similarity and no
recorded element. Five rungs, in this order and for these reasons:

1. **Wording that commits** — submit, save, apply, confirm, purchase, pay,
   checkout, transfer, delete, remove, reset, revoke, unsubscribe, send, publish,
   upload, accept — read from the name, the visible text and the selector
   together. First, so a "Delete" styled as a plain dialog button is refused
   before any later rung can wave it through.
2. **A control that submits** — `type="submit"`, that input type, that role.
   Structural, because an unlabelled submit carries no word to catch at rung 1.
3. **A control the page put in a form.** Exploration never drives a form.
4. **An actionable control**, by allowlist, so anything unrecognised is refused
   rather than reasoned about.
5. **Identity with corroboration — L3's second clause.** A candidate with an
   identifier needs one agreeing signal; **a candidate missing only that
   identifier needs two.**

The agreeing signals are `dismissal_wording`, `modal_dialog`, `dialog_landmark`,
`reversible_disclosure`, `view_switch`. **"It is a button" is deliberately not
one**, although it was on the first draft: rung 4 already requires an actionable
control, so counting it again would have let every named button clear rung 5 on a
fact already used — a corroboration requirement that corroborates nothing.

The regression test that names the danger: a "Details" control and a "Delete"
control that are **identical in every other field**, in the same dialog, with the
same selector. The first clears; the second is refused at rung 1. A similarity
score would have scored them the same.

#### The five options

`web.recovery.inspect`, `.reveal`, `.act_safe`, `.wait_for_change`,
`.navigate_in_scope`. Three declaration choices are load-bearing:

- **Every option is pinned to `stages: ["gather", "iterate"]`.** Phase H's
  registry withholds a stage-pinned option from a call naming no stage, and Flow
  authoring names none, so these are unavailable while a Flow is being built and
  available while a failure is being explored. The old single `llmEvidenceRuntime`
  slot could not express that at all: its three tools went to every caller.
- **Nothing declares `sideEffect: "destructive"`**, because the registry never
  offers one — declaring it would be declaring something unreachable. The
  destructive rule belongs in `safety.ts`, as a test of a real control.
- **Nothing declares a required runtime capability or permission.** It was
  tempting and it would have been the silent-no-protection shape: the registry
  withholds an option whose declared capability the caller does not supply, and
  nothing in this repository supplies one today, so every option would have been
  silently absent and the exploration would have "found nothing to do".

`web.recovery.inspect` takes the loop's single `initialObservation` slot, which
Phase H's Core options deliberately left free.

A real defect was found by the tests here: `actAndCapture` recaptured with the
origin the action *started* from, which is right for a click and wrong for a
scoped navigation the policy legitimately allowed. It now takes the expected
origin, defaulting to the current one, so the post-condition still holds and
still means something rather than being waived.

#### The refusal classifier

Core is handed an opaque result code and answers in its own closed vocabulary.
Only `target_unsafe` → `destructive_action_refused` and
`out_of_scope`/`cross_origin` → `out_of_scope_refused` are classified.
`invalid_input`, `no_progress`, `target_unobserved` and `sensitive_value` are
deliberately left as ordinary feedback, and the reasons are written into the
function's own comment so the omission is a visible decision rather than a gap.
Every unclassified refusal is still charged against the action budget, so a model
that does nothing but get refused ends in `budget_exhausted` — honest — rather
than in an exploration that quietly found nothing.

`out_of_scope` is a new member of `WEB_LLM_TOOL_REJECTION_CODES`. It is a
different claim from `cross_origin`: the latter is this domain's fixed rule for
the authoring tools, the former is a refusal under a Core policy that may be an
allowlist of several places.

## The diffs Core needs — for the supervisor to apply

`service.ts` is at **6757 lines against a frozen 6757 baseline**, so it has zero
headroom. Both service hunks below are written to be net-zero or negative; if the
baseline is raised instead, say so deliberately.

### 1. `AS/runtime/llm/harness-options/binding.ts` — one bundle per domain, two sources

The registry allows **one bundle per domain**, so a second `register()` for the
web domain throws by design. The recovery options therefore have to arrive
*through the binding the host already supplies*, which also means `service.ts`
needs no registration change at all.

On `AutomationStudioLlmEvidenceRuntimeBinding`, add:

```ts
  /**
   * Options the domain declares in full, rather than as bare tools. Unlike
   * `tools`, these carry their own availability, safety and stages, so a
   * runtime-only option never reaches Flow authoring.
   */
  harnessOptions?: AutomationStudioHarnessOptionBundle;
```

In `automationStudioHarnessOptionBundleFromBinding`, after the `tools` map:

```ts
  const declared = binding.harnessOptions;
  if (declared) {
    if (declared.domainId !== binding.domainId) throw new Error(`Automation Studio harness options declare domain "${declared.domainId}" on a runtime bound for "${binding.domainId}".`);
    for (const option of declared.options) {
      const implementation = declared.implementations[option.toolId];
      if (!implementation) throw new Error(`Automation Studio harness option "${option.toolId}" has no implementation.`);
      options.push(option);
      implementations[option.toolId] = implementation;
    }
  }
```

In `automationStudioHarnessOptionRegistry`, widen the guard so a host that binds
options but no bare tools still registers:

```ts
  if (input.binding && (input.binding.tools.length || input.binding.harnessOptions?.options.length)) {
    registry.register(automationStudioHarnessOptionBundleFromBinding(input.binding));
  }
```

Net: about +14 lines in a file with no frozen limit.

### 2. Downstream, same work unit — `domain/src/runtime/llm-evidence/tools.ts`

In the object `createWebAutomationLlmEvidenceRuntime` returns, beside
`deniedEvidenceKeys`:

```ts
    harnessOptions: webAutomationRecoveryHarnessOptionBundle({ gateway, scopePolicy: { kind: "same_scope" } }),
```

`same_scope` is the safe default and is what the authoring `navigate` tool
already enforces. A per-run allowlist is a later increment: the policy is
per-exploration and the binding is per-host, so threading it needs the
coordinator, not this line. I did **not** make this edit, because it is inert
until hunk 1 lands and would leave `tools.ts` carrying a field Core does not read.

### 3. `AS/runtime/service.ts` — running the exploration

The recovery path is `maybeAnnotateRunDetailWithRuntimeLlm` (2872–3185). It
already passes `stage: "gather"` to the diagnosis harness call (3027), so a
stage-pinned option is reachable there without further change.

After the plan is built and before the patch call, where `plan.explorationRequested`
is true:

```ts
      const exploration = plan.explorationRequested
        ? await runAutomationStudioRuntimeExploration({
          loop: automationStudioHarnessOptionRegistry({ binding: this.llmEvidenceRuntime }).evidenceLoopBinding({ projectId: input.context.projectId, flowId: input.context.flowId, runId: input.detail.summary.runId }, { ...resolution, stage: "gather", policy: input.context.policy }),
          decide: (decision) => this.decideExplorationStep(decision, provider),
          budget: resolveAutomationStudioExplorationBudget(),
          recoveryDeadline,
          classifyRefusal: this.llmEvidenceRuntime?.classifyRefusal,
          ...(input.graphOptions?.signal ? { signal: input.graphOptions.signal } : {})
        })
        : undefined;
```

and at line 3180, add one field to the existing call:

```ts
recoveryTrace: automationStudioRuntimeRecoveryTrace({ invocation, policy: input.context.policy, plan, ...(exploration ? { exploration } : {}), diagnosisOk: result.ok, ... })
```

Two things that hunk needs and does not yet have, both outside my ownership:

- **`recoveryDeadline`** must be started once per recovery, at the top of
  `maybeAnnotateRunDetailWithRuntimeLlm`:
  `const recoveryDeadline = startAutomationStudioRecoveryDeadline({ startedAtMs: Date.now() });`
  Starting it inside the exploration instead would make it this exploration's
  clock, which is the distinction the whole file exists to keep.
- **`decide`** needs a provider call that returns an evidence-loop decision.
  `runAutomationStudioLlmHarness` is the shape the Flow-bootstrap path uses at
  1917; the runtime path has no equivalent helper yet, and writing one is
  `service.ts` work. **`allowSideEffectsWithoutPolicy` is deliberately absent**:
  a runtime recovery always has an adaptation policy, and where a policy governs
  the call the policy is authoritative, so the mutating options appear exactly
  when `policy.allowExternalSideEffects` is true.
- **`classifyRefusal`** would be a new optional field on
  `AutomationStudioLlmEvidenceRuntimeBinding` — one line beside
  `harnessOptions` — so the domain's
  `webAutomationExplorationRefusalClassifier` reaches the runner without
  `service.ts` importing anything web-shaped.

Net line cost in `service.ts`: about +11 against zero headroom. It should land
with a `.structure-baseline.json` change, or after `R0` moves
`maybeAnnotateRunDetailWithRuntimeLlm` out of the file as the plan already
intends.

## Commands run and observed results

**Core (`F:\!FluxIQ`)**

```
packages/fluxiq: npx tsc --noEmit
  -> TSC_EXIT=0, no output (baseline before any edit: also 0)

npx vitest run src/programs/automation-studio/runtime --root packages/fluxiq --no-file-parallelism
  baseline, before my first edit -> Test Files 90 passed (90),  Tests 789 passed (789)
  after                          -> Test Files 95 passed (95),  Tests 871 passed (871)
  (+3 files and +75 tests are mine: 27 + 22 + 22 in the three new files and 4
   added to stages.test.ts. The remaining +2 files / +7 tests arrived from other
   workers' commits between the two runs. No failures, no timeouts.)

npx vitest run src/programs/automation-studio/runtime/recovery --root packages/fluxiq --no-file-parallelism
  after -> Test Files 11 passed (11), Tests 160 passed (160)
  (I did not take a clean before-number for this directory alone; the runtime
   figures above are the honest before-and-after pair.)

node scripts/structure-audit.mjs
  -> structure-audit: passed (140 warning(s), 254 baselined).  AUDIT_EXIT=0
  Filtered to my directory, the only finding is a pre-existing advisory on
  another phase's file: `recovery/context.ts: 447 lines is past the 400-line
  advisory threshold`. No finding of any kind against the four new files.
  No baseline entry was added or moved; `.structure-baseline.json` is untouched.

git status --short  ->  11 entries, every one under AS/runtime/recovery/.
```

**Domain (`F:\!FluxIQWebExtension`)**

```
domain: npx tsc -p tsconfig.json --noEmit   -> EXIT=0
domain: npx tsc -p tsconfig.test.json       -> EXIT=0

domain: DOMAIN_TEST_BUILD_LABEL=w2-3-final node scripts/test-domain.mjs
  -> # tests 522   # pass 522   # fail 0
  (26 of those are new: 17 in safety.test.ts, 9 in options.test.ts)

node scripts/structure-audit.mjs
  -> structure-audit: passed (57 warning(s), 17 baselined).  AUDIT_EXIT=0
  Filtered to `llm-evidence` and `harness-option`: no findings at all.
```

Core's dist was rebuilt once (`npx tsc -b tsconfig.build.json` then
`rewrite-declaration-imports.mjs`, exit 0) so the domain could type-check against
the new Core exports. Only `dist/` was written.

### Negative probes — five, each reverted, each observed

The tests are not vacuous, and one probe found a hole before it could ship.

1. **Map `llm_evidence_loop.iteration_limit` to `failed`** (the mutation the
   scoping report named). **First run: the suite still passed.** My table test
   only checked that the table was total and its values were outcomes, not the
   classifications themselves. Fixed by adding sixteen explicit rows; re-probed:
   `× reads llm_evidence_loop.iteration_limit as budget_exhausted —
   AssertionError: expected 'failed' to be 'budget_exhausted'`.
2. **Count only successful actions against `maxActions`** — 4 failed across two
   files, including `charges refused actions against the action budget rather
   than only the successful ones`.
3. **Let the loop's failure code outrank the ledger's stop reason** — **10
   failed**, including `gives budget exhaustion, emptiness, refusal and success
   four different outcomes in one comparison`. This is the collapse the phase
   exists to prevent, and it is caught loudly.
4. **Drop L3's second-signal requirement for an unidentified control** — 2
   failed, including `lets an unlabelled control through only when two
   independent things agree`.
5. **Remove the semantic committing-word rung** — **8 failed**, including
   `refuses a delete that took the place of the recorded control, however alike
   they look` and, through Core's own runner, `ends a run that asked for a
   destructive click in unsafe_action_blocked`.

All five source files were restored from backups and the suites re-run green.

## Not verified

- **Nothing drives the exploration in production.** The three diffs above were
  never applied or compiled. What exists is the vocabulary, the budget, the
  runner, the domain's options and the tests; no run has yet reached
  `runAutomationStudioRuntimeExploration` from `service.ts`.
- **No live browser and no provider call.** Every test uses a scripted decision
  function and a fake gateway, as the existing loop tests do. The web options
  have never touched a real page: `web.dom.click`, `web.browser.navigate` and
  `web.dom.capture_snapshot` are asserted as commands issued to a stub.
- **No Lab proof.** The plan's 2.3 proof — "every exploration trap ends in its
  named outcome within budget" — needs the fixture scenarios and the scripted
  provider, which are Phase 2.9's and were not in this brief.
- **The wall-clock timer was tested through an injected clock, not by waiting.**
  `remainingMs()` and the admit-time check are exercised with a controllable
  `now`; the real `setTimeout` path that fires mid-provider-call is not, so a
  provider that blocks past the deadline without the loop reaching a check point
  is reasoned about rather than observed.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run whole** in either
  repository. Other workers have edits in flight in `packages/test-runner/` and
  `domain/.test-build/`, so a whole-repository gate would not attribute cleanly.
  The package type checks, the owned suites and both audits were run directly.
- **`domain/.test-build/` is now stale.** It is tracked and I added two test
  files, but every domain run here used `DOMAIN_TEST_BUILD_LABEL` so the tracked
  directory was never written — and it already shows seventeen modified files
  from another worker's run. Regenerating it would sweep that work, so it is left
  for the supervisor to run `node scripts/test-domain.mjs` once, unlabelled, when
  the tree is quiet.
- **`user_intervention_required` is unreachable from the web domain today.** No
  web refusal code means "a person must act", so the outcome is exercised only
  through a stub classifier in Core's own tests. It is part of the closed
  vocabulary a domain may return, not dead code, but nothing in this repository
  returns it yet.

## Open questions or contradictions found

1. **The registry's one-bundle-per-domain rule and the plan's wording are in
   mild tension.** The plan says the domain "registers additional harness options
   through H's registry"; the registry throws on a second bundle from the same
   domain, by design, and `service.ts` is the only place that builds one. Routing
   the options through the binding (hunk 1) resolves it without loosening the
   rule. If the supervisor prefers a separate `bundles` argument on
   `automationStudioHarnessOptionRegistry`, the duplicate-domain check has to be
   relaxed, and I would argue against that — it is what makes "extends, never
   replaces" mechanical.
2. **The scope policy is per-exploration but the binding is per-host.** The
   default is `same_scope`, which matches today's behaviour exactly. A run that
   should be allowed a wider allowlist needs the policy threaded from the
   coordinator into the option implementations, which means the bundle factory
   would take the policy per call rather than per host. Worth doing when a real
   case appears; not worth inventing the seam before one does.
3. **Two trace statuses carry three outcomes.** `budget_exhausted`, `cancelled`
   and `failed` all render as the trace status `failed`, and
   `unsafe_action_blocked` and `user_intervention_required` both as `refused`.
   The precision lives in `detail.outcome`, which is asserted, so nothing is lost
   — but a UI that reads only `status` will not distinguish them. `trace.ts`'s
   status vocabulary is Phase 2.2's and I did not widen it.
4. **`maxRepeatsPerAction` is named for what it does; the plan calls it "a repeat
   window".** There is no recency window: an action's identity is counted for the
   whole exploration, which is strictly stronger and is what closes the
   across-mutation cycle the loop cannot see. The stop reason is still
   `repeat_window` so the plan's vocabulary is greppable.
5. **`llm/harness/intervention.ts` imports a value from `AS/runtime/recovery/`,
   which makes `recovery` and `llm` mutually dependent.** Nothing is broken —
   the remaining value import in `runtime-exploration.ts` is read inside a
   function body, not at module evaluation — but it is a live trap: the next
   person who reads an `llm` constant at the top level of a `recovery` module
   will get `undefined` at run time with a clean type check, exactly as I did.
   Worth a separate look at whether `summarizeAutomationStudioRuntimeRecoveryContext`
   belongs where it is called from.
6. **The scoping report's second named mutation, "map `auth_required` to
   `FAILED`", has nothing to mutate.** It assumed a table from Core's failure
   *categories* to exploration outcomes. I did not build one: an exploration is
   entered from a plan that has already classified the failure, and
   `manual_intervention` is resolved before exploration is ever requested, so a
   category table here would have had no caller. If Phase 2.4's verdict wants
   one, it belongs beside the verdict.
