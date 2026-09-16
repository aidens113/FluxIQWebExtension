# MVP Week 2 Automation Loop Plan

Status: Active
Status detail: Executing 2026-09-16. Phases D, G, P, SEC, T, H, S and 2.1-2.3 are built, verified and pushed in both repositories; the Testing Lab now reaches the real DeepSeek provider. Phase 2.3 is inert until three worked-out diffs are applied. Loop phases 2.4-2.9 and X6 are not started.
Created: 2026-09-15
Last updated: 2026-09-15
Owner: Senior supervisor agent
Scope: Week 2 of the 30-day MVP, Phases 2.1-2.9: the automation loop (standardized adaptation context, diagnosis separated from exploration, bounded harness exploration, recovery success detection, converting exploration into reusable automation, validating, persisting, and resuming adaptations, and proving deterministic reuse), with Testing Lab verification. Phase 2.0, the data extraction foundation, lives in first-class-data-extraction-plan.md.
Paired document: `F:\!FluxIQ\docs\working\mvp-week2-automation-loop-plan.md`
Related: [30-Day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md) (Week 2), [Week 1 plan](./mvp-week1-web-automation-reliability-plan.md), [data extraction plan](./first-class-data-extraction-plan.md), [LLM production automation plan](./llm-production-automation-plan.md), [scoping 2.1-2.4](./mvp-week2-automation-loop-plan/reports/w2-scope-context-recovery.md), [scoping 2.5-2.9](./mvp-week2-automation-loop-plan/reports/w2-scope-repair-reuse.md)

---

## Current State

**Phase, as of 2026-09-15: the user gave the go, building is under way, and a
machine crash killed the first nine workers mid-flight.** All four read-only
investigations reported and were supervisor-verified before any code changed.
This is a **flow-improvement loop with three entry points** —
building a new flow, a run failing, and an edge case in an existing flow — not a
recovery loop. Two earlier scoping reports cover Phases 2.1-2.4 and 2.5-2.9 with
file:line evidence. Path prefix: `AS/` is Core's
`packages/fluxiq/src/programs/automation-studio/`.

**Phases SEC, G, T, P, D, H, S and 2.1-2.3 are built, supervisor-verified and
pushed in both repositories.** What each established is archived in
[archive/completed-phase-narrative.md](./mvp-week2-automation-loop-plan/archive/completed-phase-narrative.md);
the file:line evidence is in `reports/w2-a` through `w2-d` and the two scoping
reports. One finding from those investigations is still open: flow bootstrap
refuses any flow that is not blank, so the "improve an existing flow" entry
point cannot reuse it unchanged.

**CORRECTION (2026-09-16): no live run has yet received a DeepSeek response.**
Earlier this document said the Lab reaches a real provider. That was read from
Core's gate reporting `invoked: true` and an intervention naming
`deepseek`/`deepseek-chat`, never from an actual reply. Once the Lab kept Core's
per-call issue codes, every live run showed the same thing: one
`runtime_diagnosis` call at stage `gather`, `validationOk: false`, issue code
`llm.provider_configuration_invalid`, and no reported tokens -- the DeepSeek
adapter refuses the request **before sending it**. Reproduced with per-call
limits of 8,000/2,000/10,000 and 42,000/8,000/50,000, a valid 26-call grant and a
600,000-token run budget (`run-mu4mqftg-...` for the codes,
`run-mu4mwjqi-5757ede8` for the large budget), so the budget is not the cause.
The code is thrown from seven places in `AS/runtime/llm/deepseek-provider.ts`,
and the runtime tests drive recovery through a scripted provider that bypasses
the real adapter, which is why nothing caught it. Worker
`w2-deepseek-preflight-refusal` is reproducing it offline. The Lab's wiring
itself (`reports/w2-live-provider.md`) -- key installation, grant issue,
budgets, redaction -- does work: the redaction attestation passes on every run.
The user's standing instruction is unchanged: a feature is not demonstrated
until it has run against the real DeepSeek key in `.env.local`.

**Not started:** loop phases 2.4-2.9, and X6. Phase 2.4 depends on R0, which is now done, so it is unblocked.

**The fixed call limit is now understood as the defect, not a constraint to
design around (user decision, 2026-09-16).** His words: "I want you to allow as
many calls as are needed for iteration of adaptations! Stop setting hard limits
like this. It should be allowed to automatically explore and whatnot within
reason. Ofc we'll work to reduce tokens where needed, but this hard limit is
causing a lot of problems." Every live blocker recorded above traces back to it:
a runtime recovery ran in a mode hard-capped at exactly two provider calls,
which also forbade the `evidence_tool_decision` task kind, so the model's first
move -- asking to gather more evidence -- had no call available to serve it.
Two real DeepSeek runs (`run-mu3we5jm-38461449`, `run-mu4hob80-7876a32e`)
reached the provider and passed their scenario while diagnosing nothing, both
ending `validationOk: false` at `+stage.gather`. The bounded exploration was
built, wired, tested and still inert for the same reason, and the exploration
allowance added earlier the same day was necessary but could not help, because
the request was never reachable.

The replacement model: an adaptation iterates while it is making progress, and
stops on a guard that means something -- the per-run estimated cost ceiling, the
per-run token budget, the recovery deadline in wall-clock time, or a new
no-progress guard for a loop that is repeating itself or returning no new
evidence. A call ceiling survives only as a far-away, configurable backstop
against a runaway loop, never as a per-mode constant. Token efficiency is a
separate exercise; starving the loop of calls is not how cost is controlled.

The generalizable lesson, recorded because it was missed for most of a day: when
a designed-in limit keeps generating blockers, the limit is the defect. Report
it as such instead of engineering successive workarounds inside it.

**The exploration now runs in production, as of 2026-09-16.** All three diffs
in `reports/w2-3-bounded-exploration.md` are applied and four negative probes
confirm the wiring is load-bearing: removing the exploration call fails four
tests, dropping it from the trace fails two, and dropping either
`recoveryDeadline` or `classifyRefusal` fails one each. R0 was taken rather
than raising the frozen baseline — `maybeAnnotateRunDetailWithRuntimeLlm` moved
into `AS/runtime/recovery/annotation/`, and `service.ts` went 6757 -> 6468 with
the baseline lowered to match, so it can never silently grow back.

**Two silent-no-protection defects were closed, and one of them was live.**
Making `deniedEvidenceKeys` required and fail-closed exposed that Flow
Bootstrap never forwarded the bound domain's declared keys at all: its reusable
context had been reaching the model with only Core's own `target` family
denied, so the web domain's `html`, `innerHtml`, `outerHtml`, `pageSource`,
`cookies`, `headers` and `selector` were not enforced on that path. Fixed by
`automationStudioHarnessInputWithDeniedEvidenceKeys`, forwarded and never
defaulted — a `?? []` there would restore the same hole. Separately, the
structured diagnosis now reads `response.diagnosis` and *refuses* a
diagnosis-shaped key found in `response.metadata`, recording it by field name
and never by value, so a metadata-only `patchNeeded: false` can no longer
cancel a billed patch call.

**The `llm` / `recovery` module cycle is now a build failure, not a comment.**
`runtime/llm` may not import a value out of `runtime/recovery`; type-only
imports stay legal because they are erased and cannot cause the fault. Verified
by the supervisor reintroducing the exact cycle, observing the audit fail with
a message naming the three ways out, and reverting. The shared values live in
the new `runtime/loop-limits/`, which neither directory owns.

**Both repositories are green at this point.** Core `pnpm check` exit 0,
`vitest run src/programs/automation-studio/runtime` 884 passed / 884 across 97
files; this repository `pnpm check` exit 0, `test-runner` 940 passed / 0
failed, `structure-audit` passed in both.

**Deferred, not forgotten:** `deniedEvidenceKeys` is optional on Core's binding
and `context-packet.ts:81` defaults a missing declaration to deny nothing — the
same silent-no-protection shape this plan keeps finding. It should be required
and fail closed. Measured cost: 8 call sites, 7 of them in
`AS/runtime/tests/**`; the exact diff is in `reports/w2-harness-loose-ends.md`.
Also outstanding: `recovery/structured-diagnosis.ts:131` still reads
`response.metadata` rather than the new channel, and the two only mean anything
together.

**A module cycle has bitten twice in one day and wants a rule.**
`llm/harness/intervention.ts` value-imports out of `AS/runtime/recovery/`, so a
`recovery` module reading an `llm` constant at the top level gets `undefined` at
run time with a completely clean type check. The same cycle silently emptied the
opaque handle's `pattern`, `maxLength` and `maxProperties` from the schema sent
to the provider. Both were found by a single failing test, not by the type
checker. An `importBoundaries` entry would stop the third instance.

**Concurrency is five workers, not nine.** Both crashes happened with nine heavy
workers running on a machine with a known memory fault, so this is recorded as a
real resource limit rather than caution.

**Next steps, in order:**
1. Land `w2-deepseek-preflight-refusal`: the adapter refuses every real recovery
   request before sending it. Nothing about the loop is demonstrated until a live
   run gets a DeepSeek reply.
2. Then the live `adapt` run on `identity-drift --variant save-and-exit`, read
   call by call from `snapshots/live-llm.json`, not from the verdict.
3. Integration cleanups: `live-patch.ts` policy required; Core settings save
   accepting no `maxCalls`; the stale PIN comment in `runtime-session-grant.ts`;
   `registerAutomationStudioApi` ignoring `identityAccess`; `pnpm docs:reference`.
4. Then Phase 2.4, and 2.5-2.9 after it.

**Blockers:** none. The user's direction is recorded as L12-L16. The earlier
request that he approve L6 and L9 is **withdrawn**: L13 supersedes both, because
the model is to be used freely and approval mode gates *applying* a proposal
rather than producing one. L2 still stands and is now load-bearing rather than a
preference. Still open, and unrelated to this loop: whether an excluded dataset
column means "never stored anywhere" or only "absent from the dataset and
export".

---

## Decisions (recommended, for the user's review)

Settled and archived on 2026-09-16 to
[archive/settled-decisions.md](./mvp-week2-automation-loop-plan/archive/settled-decisions.md).
The user's direction is L12-L16; L6 and L9 were withdrawn because L13
supersedes both.

## The five fixes — approved by the user, to be built as Phase D

Built as Phase D and supervisor-verified; archived on 2026-09-16 to
[archive/settled-phase-d-and-initial-scoping.md](./mvp-week2-automation-loop-plan/archive/settled-phase-d-and-initial-scoping.md).

## Phases

Execution detail (files, tests, mutation targets, Lab proofs) is in the two
scoping reports: 2.1-2.4 in `w2-scope-context-recovery`, 2.5-2.9 in
`w2-scope-repair-reuse`. Phases T, H, S, G and P come from the three
investigations `w2-a`, `w2-b` and `w2-c`.

**The first loop increment needs no new authoring contract.** Action targets,
expected state, retries and wiring are already expressible — and revertible — as
graph operations, the only transactional store of the six a flow is kept in. A
new contract is needed only for router, subflow, instruction and flow-field
changes, which is why those phases come after the first increment rather than
gating it.

| Phase | Work | Owner | Depends on |
| --- | --- | --- | --- |
| D | The five fixes, in the order **1 → 3 → 2 → 5 → 4**, each with a failing test first. Fixes 1-3 all edit `live-patch.ts` and are serial for one worker. Fixes 4 and 5 must come last: once adaptations reach classification, the loop starts skipping the model on the strength of the unverified `validated` records that 1-3 fabricate, so doing them early would look like progress and leave the system worse. Includes the sixth instance (`temporary_recovery_subflow_call`) and the typed-store path that skips the promotion gates entirely | Core | approved; not started |
| P | PIN reclassification (L16). The inventory is done (`w2-d`, supervisor-verified): Core registers ~220-223 endpoints, of which 57-58 call `authorizeProgramPin`, and **every one is in `automation-studio`** — no other program uses it. It is **not middleware**: it is an inline `await` on the first line of ~58 handler bodies, and `register()` has no field in which an endpoint could declare it. **Make the classification declarative** — a required field on `register()`, enforced at the single `registry.call()` chokepoint and returned by `endpoints()` — so TypeScript fails the build when a new endpoint omits it and the scattered call sites disappear. Two limits to carry: the 7 write routes outside the program API (including `POST /api/framework/setup` migrate/rollback, the most destructive operation in Core) are **not** reachable from that chokepoint and need their own gate; and `secret-keys`, `database-manager` and parts of `identity-access` have their own stronger gates that L16 must be stated not to touch | Core | approved; not started |
| SEC | **Security defects found by `w2-d`, independent of L16 and not to be bundled with it.** (a) `identity-access/create-session` (`api/handlers.ts:121-130`) mints a session for **any** `userId` with no credential recheck, while `disable-totp` twelve lines above calls `authorizeSessionCredentials` and returns `requiresRecheck` on failure — the pattern exists and this endpoint skips it. The supervisor traced `service.createSession` (`runtime/service.ts:291-306`): it checks only that the user exists and is enabled, then mints and persists a session, so nothing guards it below the handler either. **Scoped honestly:** the endpoint carries `permission: "identity.manage"`, which of the two built-in roles only `admin` holds (`runtime/roles.ts:3-20`), so this is not an unauthenticated escalation — the caller is already an authenticated admin. It still matters, because FluxIQ's whole recheck model (this program's `authorizeSessionCredentials`, and `authorizeProgramPin` at ~58 sites) verifies against in-process session state: an endpoint that mints arbitrary sessions lets an admin session act as any user without ever re-proving a password, PIN or TOTP, which is precisely what a recheck exists to prevent. (b) `delete-run-datasets` (`datasets.ts:73-87`) deletes a user's captured rows under `flows.write` alone, and (c) `save-project-hierarchy` (`projects.ts:176-189`) performs deletions through its `deletedHierarchyIds` payload with no PIN. (b) and (c) contradict Core's own `docs/architecture/automation-studio/persistence.md:515-521`, which states that endpoints which delete or edit user-authored state are privileged and should use the shared PIN path — so that document is wrong today whatever L16 decides | Core | not started; **recommend fixing (a) ahead of the loop** |
| T | **L2, the opaque repair target.** Replace `AutomationStudioRuntimeTargetOverrideTarget = { selector: string }` (`structured-response.ts:14-16`) with an opaque, domain-owned target at all five Core sites: the type, the JSON schema, the provider prompt (`deepseek-provider.ts:38,57-73`), the service options (`service.ts:356`), and the validator seam. The domain fills it fingerprint-first with the selector as a hint, and evidence names elements by opaque `target.N` handles. Its sibling `TargetOverrideFailedAction` (`live-patch.ts:34-37`) is already domain-neutral and is the model to copy | Core, domain | **prerequisite for H, 2.1 and 2.5** |
| H | **L14, harness options.** The exploration loop already exists and is already domain-neutral (`AS/runtime/llm/evidence-loop.ts`), so this phase opens bolted doors rather than building a loop: a registry of harness options; the first Core-owned domain-neutral options, since Core ships **zero** and every tool today comes from this repository; a domain registration path that **extends** the core set rather than replacing it; and the other two entry points, which means lifting the block at `execution-grants.ts:493-511` that forbids the loop to a recovery run. Also scopes `llmEvidenceRuntime` — today one mutable slot with no domain id and no gate (`service.ts:352-357,769-772`) — the way the node registry one directory away already does | Core, domain | T |
| S | **L15, the stage protocol.** A fixed, non-overridable order — gather and explore, plan, implement, iterate, verify — with per-stage instructions a domain may add to or wholly override through Core's existing instruction system. Blocked today by a closed task-kind union and stage prose hard-coded in the provider file. Also de-webs Core's sanitizers, which carry an html, cookies and headers denylist and a `selector` regex | Core | H |
| G | **Rollback correctness.** A `delete_node` inverse omits cascaded edges, so rolling back a deletion does not restore the graph it removed — and rollback is the safety net every later phase leans on. With it: structural adaptations cannot be applied at all today, because the promotion gate requires a `proposalId` no endpoint can create; and two apply engines sit behind the single `review-flow-adaptation` endpoint, taking different patch kinds with different rollback guarantees, with deployment configuration choosing which runs | Core | with D |
| R0 | Move `maybeAnnotateRunDetailWithRuntimeLlm` out of `service.ts` into `AS/runtime/recovery/runtime-recovery-coordinator.ts`, no behaviour change | Core | review; extraction K4c.1-2 |
| 2.1 | `recoveryContext` builder (fixed section priority, byte budget, withheld copy); packet slot with counts-only `contextSummary`; coordinator passes it; the domain marks the failed target as an opaque handle | Core, domain | R0, L2 |
| 2.2 | Deterministic diagnosis gate (L5); structured LLM diagnosis; recovery plan; `recoveryTrace` stages (diagnosis, recovery_plan, exploration, resolution) and web UI; why W13 and W24 report `runtime.behavior` (W2-1, W2-3), then fixes | Core, domain | R0 |
| 2.3 | Closed exploration outcomes; exploration budget (wall clock, actions, domain-enforced scope policy, destructive off, repeat window); the whole-recovery time limit; the web domain's own harness options, registered through H (inspect, reveal, safe dismiss or click, bounded wait, scoped navigation). **No new loop is written here** — H supplies the registry and the entry points, and this phase supplies the runtime budget, the closed outcomes, and the domain's options | Core, domain | 2.2, H, L3 |
| 2.4 | The full recovery verdict: expected state, outputs including records completeness, required evidence, continuation; domain URL and presence conditions | Core, domain | D, R0; extraction X4 for records |
| 2.5 | Adaptations record observed and expected state and `failureSignature` (defect 5); exploration reduction; a durable deterministic-path patch inserting real action nodes; the L2 target contract with `extract_list` compatibility | Core, domain | 2.3, L2 |
| 2.6 | Validation kinds and a persisted confidence tier (L7); provisional replay promotion after two successes | Core | 2.5 |
| 2.7 | Persisted confidence, signature, and evidence columns; gateway precedence between an adapted target and the recorded element | Core, domain | 2.5, 2.6 |
| 2.8 | Resume from the failed node with an input-state check (L8); in-run use (L9); the domain input-state predicate | Core, domain | 2.4, 2.7 |
| 2.9 | Scripted test provider (L10); per-attempt adaptation provenance; typed FluxBench Week 2 metrics; adaptation-cycle lane; `week2` corpus and fixtures (side-effect counters, item-selector drift); A/B pair and live checkpoint | Core, Lab | 2.5-2.8, extraction X5 |
| X6 | Extraction repair through L2; W04, W08, and item-selector drift in the `week2` corpus | domain, Core | 2.5, extraction X4-X5 |

## Execution partition

- **Serial Core `service.ts` chain** (frozen at 6,807 lines and 223 members;
  every edit offset): extraction K4c.1-2, then R0, then 2.1's coordinator
  change, then the coordinator integration for 2.2-2.4, then 2.8's two call
  sites.
- **Serial Core LLM-contract worker:** `context-packet.ts`, `task-request.ts`,
  `task-kind.ts`, `structured-response.ts`, `provider-result.ts`,
  `deepseek-provider.ts`, `intervention.ts`, `execution-grants.ts`.
- **Serial Core adaptation files:** `model/flow-adaptation.ts` (2.5, 2.6, 2.7),
  `storage/project/adaptation-store.ts` (2.5, 2.6, 2.7, 2.9), `live-patch.ts`
  (D, 2.5, 2.6).
- **Parallel after R0, one new file each:** `AS/runtime/recovery/`
  (`recovery-context`, `diagnosis`, `recovery-plan`, `recovery-trace`,
  `exploration-outcome`, `exploration-budget`, `recovery-verdict`,
  `runtime-exploration`; the integrator owns the barrel);
  `AS/runtime/exploration-reduction/`; `AS/runtime/adaptation-confidence.ts`;
  `AS/runtime/service/adaptations/{provisional,resume}.ts`; downstream
  `domain/src/runtime/llm-evidence/recovery-tools.ts`; downstream expectation
  conditions; the web UI's run detail stages.
- **Serial Lab chain, after extraction X5's files:**
  `packages/test-contracts/src/{evaluation,evaluation-validation,bench-report}.ts`,
  `packages/test-runner/src/flow-lane/persisted-flow-run.ts`,
  `packages/test-runner/src/bench/*`, then the new
  `flow-lane/adaptation-cycle/` and `bench/corpus/week2.ts`.
- At most four code workers run at once on this machine.

## Worker Briefs

Recorded at dispatch on 2026-09-15. All three are **investigations that change
no source file**, because the user will review the proposals before anything is
built.

### Brief: w2-a-defect-fixes
- Repository: FluxIQ Core (`F:\!FluxIQ`), read-only
- Task: propose a fix for each of the **five defects** listed in this document's
  Current State. For each one give, in this order: the failing test that
  demonstrates the defect, the fix, the exact files and functions it touches,
  what could regress, and how confident you are that you have the real cause
  rather than a symptom. Reproduce each defect rather than restating it — read
  the code paths and say plainly which of the five you actually proved and which
  you only reasoned about. Where a test would prove it, write the test **in a
  scratch copy outside both repositories** and report the observed failure.
- All five share a shape — the system reports success when nothing succeeded —
  so also say whether one underlying cause explains several of them, and whether
  fixing them in a particular order avoids rework.
- Required reads: `AGENTS.md`; this document's Current State and decisions
  L5, L7, L12; `AS/runtime/live-patch.ts`; `AS/runtime/service.ts` around the
  lines the defects name; `AS/storage/project/adaptation-store.ts`;
  `AS/runtime/service/adaptations/patches.ts`; `AS/runtime/adaptive-orchestrator.ts`
- Owns (may edit): only its report file
- Must not touch: **every source file in both repositories**. This is design for
  the user's review, not implementation
- Validation: none to run beyond scratch-copy reproduction; do not run repository
  gates
- Report to: `F:\!FluxIQWebExtension\docs\working\mvp-week2-automation-loop-plan\reports\w2-a-defect-fixes.md`

### Brief: w2-b-flow-authoring-surface
- Repository: FluxIQ Core (`F:\!FluxIQ`), read-only
- Task: L13 says the loop may propose anything a person can do to a flow.
  Establish what that surface actually **is**, and how much of it is reachable
  programmatically today. Enumerate the operations a user performs on a flow
  through the web panel — nodes, wiring, parameter values, subflows, routers,
  instructions, expected state, ports, variables — and for each say whether a
  caller inside Core can already perform it, whether it exists only as a UI
  path, and whether it is covered by the graph-operations or mutation record so
  a change can be reviewed, applied, and rolled back.
- Then answer the design question: what would a single "proposed flow change"
  object have to contain to express any of those operations, be shown to a
  person for approval, be applied atomically, and be reverted? Say whether
  Core's existing adaptation and graph-operation records can carry it or whether
  a new contract is needed, and give the reasoning either way.
- Required reads: `AGENTS.md`; `docs/architecture/code-structure.md`; this
  document's L12 and L13; Core's automation-studio service, `model/`,
  `storage/project/schema/` (especially graph operations and mutation records),
  and the web panel's flow-editor feature directory
- Owns (may edit): only its report file
- Must not touch: every source file in both repositories
- Report to: `F:\!FluxIQWebExtension\docs\working\mvp-week2-automation-loop-plan\reports\w2-b-flow-authoring-surface.md`

### Brief: w2-c-harness-options-and-instructions
- Repository: FluxIQ Core (`F:\!FluxIQ`) and this repository, read-only
- Task: L14 and L15 make exploration a Core capability that an imported domain
  extends. Establish how a domain extends Core **today** — the importer SDK,
  registered capabilities, runtime adapters, output actions, and whatever else
  a domain package contributes — and how Core's **instruction system** works,
  including scopes, bindings, and the effective-instruction cache.
- Then propose the design for two things. First, a **harness-option registry**:
  how Core declares the domain-neutral information-gathering actions the loop
  may take, how an imported domain registers more, how the two sets combine, and
  how the loop is stopped from calling one that the current domain or policy
  does not allow. Second, **stage instructions**: how a domain adds to or wholly
  overrides the instructions for a single stage while Core keeps ownership of
  the stage **order**, and where that lands in the existing instruction tables.
- Say explicitly what would have to be true for a non-browser domain — one with
  no DOM, no page, no selectors — to use the identical loop, and name anything
  in the current design that would leak a browser concept into Core.
- Required reads: `AGENTS.md`; `docs/architecture/code-structure.md`;
  `docs/architecture/package-boundaries.md`; this document's L14 and L15; Core's
  `AS/nodes/importer-sdk.ts`, instruction storage and runtime, and LLM task
  contracts; downstream `domain/src/runtime/` for how the web domain plugs in
- Owns (may edit): only its report file
- Must not touch: every source file in both repositories
- Report to: `F:\!FluxIQWebExtension\docs\working\mvp-week2-automation-loop-plan\reports\w2-c-harness-options-and-instructions.md`

### Dispatched 2026-09-16 — applying the four written-up next steps

Partitioned by file across Core. Concurrency held at five per the recorded
resource limit. The supervisor kept two edits it already understood from the
reports rather than dispatching them, and holds the live provider run until
Core is green, because `pnpm lab` builds Core's web panel from the sibling
checkout and would otherwise build a half-edited Core.

**Supervisor, done before dispatch (not delegated).**
`AS/runtime/llm/harness-options/binding.ts` gained `harnessOptions?` and
`classifyRefusal?` on `AutomationStudioLlmEvidenceRuntimeBinding`, the declared
bundle merges in `automationStudioHarnessOptionBundleFromBinding` with its two
throws, and `automationStudioHarnessOptionRegistry` now registers a binding
carrying options but no bare tools — hunk 1 of `w2-3-bounded-exploration`.
Downstream, hunk 2: `domain/src/runtime/llm-evidence/tools.ts` declares
`harnessOptions` (`same_scope`) and `classifyRefusal`, and its
`WebAutomationLlmEvidenceRuntime` type carries both. Core and domain
`tsc --noEmit` exit 0; `node scripts/structure-audit.mjs` passes.
`deniedEvidenceKeys` was deliberately left optional here so one worker owns the
breaking moment end to end rather than leaving Core red for the others.

**Structural decision taken, not asked.** The ~11 lines the exploration wiring
needs land in `service.ts`, which sits at exactly its frozen 6757-line
baseline. Of the report's two options — raise the baseline, or R0 the method
out — R0 was taken. Raising a frozen baseline to fit eleven lines is the
deferral this repository's standards forbid.

### Brief: w2-r0-service-exploration
- Repository: Core
- Task: move `maybeAnnotateRunDetailWithRuntimeLlm` (`service.ts` ~2872-3185)
  into its own module under `AS/runtime/recovery/` with no behaviour change and
  re-baseline downward; then apply hunk 3 — recovery deadline started once per
  recovery, `runAutomationStudioRuntimeExploration` where
  `plan.explorationRequested`, `exploration` into the recovery trace, and the
  `decide` helper modelled on the Flow-bootstrap path at `service.ts:1917`
- Owns: `AS/runtime/service.ts`, new modules under `AS/runtime/recovery/`,
  `recovery/index.ts`, their tests, Core `.structure-baseline.json`
- Must not touch: `harness-options/**`, `recovery/structured-diagnosis.ts`,
  `llm/harness/intervention.ts`, `llm/context-packet.ts`, this repository
- Report to: `.../reports/w2-r0-service-exploration.md`

### Brief: w2-denied-evidence-keys
- Repository: Core
- Task: make `deniedEvidenceKeys` required on the binding, make
  `context-packet.ts:81` fail closed instead of defaulting to deny-nothing, and
  update all 8 call sites (7 under `AS/runtime/tests/**`) in one work unit so
  the tree is never left red
- Owns: `harness-options/binding.ts`, `llm/context-packet.ts`, the listed call
  sites, new fail-closed tests
- Must not touch: `service.ts`, `recovery/**`, `llm/harness/intervention.ts`,
  `domain/src/runtime/llm-evidence/tools.ts`
- Report to: `.../reports/w2-denied-evidence-keys.md`

### Brief: w2-diagnosis-channel
- Repository: Core
- Task: point `recovery/structured-diagnosis.ts:131` at the named diagnosis
  channel Phase 2.2 added instead of scraping `response.metadata`, and stop a
  metadata-only diagnosis passing as validated
- Owns: `recovery/structured-diagnosis.ts` and its tests
- Must not touch: any other `recovery/` file including `index.ts`,
  `service.ts`, `harness-options/**`, `llm/harness/intervention.ts`,
  `llm/context-packet.ts`
- Report to: `.../reports/w2-diagnosis-channel.md`

### Brief: w2-import-cycle
- Repository: Core
- Task: break the `llm/harness/intervention.ts` -> `AS/runtime/recovery/` value
  import that has caused two run-time defects under a clean type check, by
  moving the shared values to a neutral module outside `recovery/`; then forbid
  it mechanically with an `importBoundaries` rule in
  `scripts/structure-audit/config.mjs`, proven by reintroducing the cycle once
  and observing the audit fail
- Owns: `llm/harness/intervention.ts`, the new neutral module and its barrel,
  `scripts/structure-audit/config.mjs`
- Must not touch: `service.ts`, `recovery/**`, `harness-options/**`,
  `llm/context-packet.ts`, `.structure-baseline.json`, this repository
- Report to: `.../reports/w2-import-cycle.md`

## Validation

- Every step: the test and mutation targets its report names, rerun by the
  supervisor; Core with `--no-file-parallelism`.
- Lab proofs per phase as the reports give them: counts-only context sections
  on W13 and W24 (2.1); stage order in `recoveryTrace` (2.2); every exploration
  trap ends in its named outcome within budget (2.3); W24, W13 before
  dismissal, W19, and an extraction under-read are not resumable, and a scripted
  W13 recovery is (2.4); a run-2 zero-call replay naming the adaptation and a
  side-effect counter of 1 (2.8, 2.9).
- Root gates in both repositories, one at a time; the `week2` A/B pair on the
  production-Core topology and `lab compare`.

## Risks

- `service.ts` contention with extraction K4c; R0 waits for it.
- L2, L6, and L9 change what a repair may persist and what a grant may execute;
  they need the user's explicit acceptance.
- E56 design A (corroboration) has not been explicitly accepted by the user,
  and exploration relies on it.
- The provider-resolver seam a Lab scripted provider needs is unverified.
- E57 and E58: validation reruns and resumes add captures on large pages;
  measure on `member-directory` in the `week2` corpus.
- Long Lab campaigns on this machine's faulty RAM carry an error bar.

## Worker Briefs — initial scoping

Delivered and archived on 2026-09-16: see
[archive/settled-phase-d-and-initial-scoping.md](./mvp-week2-automation-loop-plan/archive/settled-phase-d-and-initial-scoping.md).
The briefs produced `w2-scope-context-recovery` and `w2-scope-repair-reuse`.

## Work Ledger

### 2026-09-16 — Iteration replaces fixed call counts (in progress)
- Agent: supervisor; workers `w2-iterating-recovery-session`,
  `w2-guards-not-call-counts`, `w2-lab-iterating-calls`,
  `w2-demo-iterating-calls`, `w2-grant-budget-integration`; in flight at the
  time of writing: `w2-adaptation-certificate-calls`,
  `w2-flow-creation-iterates`, `w2-core-contracts-and-docs`
- Why: the user's decision recorded in Current State. A Claude Code crash
  stopped the first two workers mid-task with two workers running — well
  under the recorded five-worker limit, so not a load crash; both were resumed
  from their transcripts with their partial work intact.
- The same fixed limit turned up in seven places, each of which alone would
  have stopped an iterating recovery: Core's two-call runtime purpose; Core's
  per-mode grant constants; the web panel's runtime request; the web panel's
  Flow-creation request (4 calls) and Core's Flow Bootstrap loop (4, capped at
  8); the Lab's contract ceiling and live-run planner; six demo scripts and the
  adaptation certificate; and -- the least visible -- grant expiry, checked on
  every call, defaulting to 60 s and capped at 5 minutes, which would have cut
  a recovery off regardless of its deadline. A saved per-Flow `maxCalls: 1`
  written by the authoring defaults was a further trap: honouring it would have
  pinned every adapting run to a single call, so the panel no longer uses it
  for adapting runs.
- Model now in the tree: iterating purposes default to 26 calls (a diagnosis,
  a patch, and exploration's 24-decision default) with a 64 backstop; a grant
  token budget `maxTotalTokensPerRun` (default min(per-call x calls, 100,000))
  on which the high-token confirmation is judged; a call and a token/cost
  margin held back for the patch; `explore_and_adapt` given its grant's budget
  rather than the $0.25 no-grant one; a 600 s recovery deadline; a
  no-progress guard with its own outcome; and a grant `ttlMs` that is only a
  claim window, with claimed grants under a 600 s lease that exchanges expired
  key authorizations one for one. Worst case for one default recovery: 26
  calls, 100,000 tokens, $2.00 estimated, 600 s; about $0.09 at DeepSeek peak
  prices.
- Validation: supervisor-run, not taken from reports. The grant-lifetime design
  was reviewed as authorization behaviour before acceptance. Its seven tests
  pin that an unclaimed grant expires and is revoked, a claimed grant is
  refused at the end of its lease, the exchange never reveals more keys than
  the call count, revocation wins at any point, the grant dies with the
  actor's session and Secret Keys unlock (the test asserts refusal,
  `activeGrantCount() === 0` and zero reveals), and a revocation racing a mint
  revokes the fresh authorization. `vitest run .../execution-grant-lifetime.test.ts`
  -> "Tests 7 passed (7)". Web panel: `vitest run
  src/features/automation-studio/runtime` -> "Tests 44 passed (44)",
  `tsc --noEmit` exit 0. Lab: `test-contracts` -> "# pass 94", "# fail 0";
  `test-runner` -> "# pass 976", "# fail 0"; audit passed. Core
  `.structure-baseline.json` lowered `service.ts` 6468 -> 6434.
- Not verified yet: no live provider run since the change; no browser; Core
  must be rebuilt before a Lab run because the Lab loads Core's compiled
  output, which still carried the old limits mid-task.

### 2026-09-16 — Four workers integrated; the exploration runs and two holes close
- Agent: supervisor, integrating workers `w2-r0-service-exploration`,
  `w2-denied-evidence-keys`, `w2-diagnosis-channel`, `w2-import-cycle`
- Changed: Core `AS/runtime/recovery/annotation/**` (new), `recovery/index.ts`,
  `recovery/structured-diagnosis.ts`, `recovery/tests/{plan,stages,runtime-exploration}.test.ts`,
  `service.ts`, `llm/harness-options/{binding.ts,index.ts}`,
  `llm/harness/{context-packet.ts,intervention.ts,task-request.ts}`,
  `llm/evidence-loop.ts`, `runtime/loop-limits/**` (new), `llm/tests/**`,
  `tests/service-adaptation/**`, `tests/service-bootstrap/**`,
  `.structure-baseline.json`, `scripts/structure-audit/{config.mjs,rules/imports.mjs,rules/tests/imports.test.mjs}`;
  this repository `scripts/structure-audit/rules/imports.mjs` and its test
  (mirrored from Core, which was identical at HEAD before today)
- Supervisor's own integration work, not a worker's: the two fixture helpers in
  `recovery/tests/{plan,stages}.test.ts` that still built the abandoned
  `metadata` route (the diagnosis worker was forbidden to touch them and
  returned Partial); the Flow Bootstrap forwarding fix; and moving that fix out
  of `service.ts` into `automationStudioHarnessInputWithDeniedEvidenceKeys` in
  `binding.ts`, because six lines in `service.ts` breached the freshly lowered
  6468 baseline and the audit refused them — which is the ratchet working.
- Validation: supervisor-run, after all four landed. Core `pnpm check` -> exit 0
  (audit passed, all four packages typecheck). Core
  `vitest run src/programs/automation-studio/runtime` -> "Test Files 97 passed
  (97)", "Tests 884 passed (884)". This repository `pnpm check` -> exit 0;
  `test-runner` -> "# pass 940", "# fail 0"; `structure-audit` -> passed.
  The import rule was verified adversarially, not read: the exact cycle was
  reintroduced as a value import, the audit failed naming it, and it was
  reverted. Restoring the probe also revealed that `git checkout --` on that
  file had discarded the worker's comment edit; it was restored from a backup
  taken before the probe.
- Not verified: no live provider run and no browser. The user asked on
  2026-09-16 to stop for review before the real DeepSeek step, so that is a
  deliberate stop, not a blocker.
- Open, needs the user: the run budget's default of 2 provider calls leaves no
  allowance for an exploration, so a real recovery that explores would record
  `budget_exhausted`. The recommendation is an explicit exploration allowance
  rather than borrowing from the diagnosis/patch pair. Raised at the review gate
  because it changes what a live run costs.

### 2026-09-16 — The binding contract, two swallowed causes, and compaction
- Agent: supervisor (not delegated; four Core workers dispatched in parallel
  alongside this and still in flight at the time of writing)
- Changed: Core `AS/runtime/llm/harness-options/binding.ts`; downstream
  `domain/src/runtime/llm-evidence/tools.ts`,
  `packages/test-runner/src/secret-keys-ui.ts`,
  `scripts/setup-demo-llm-key.mjs`; this document and its new `archive/`
- Why: hunks 1 and 2 of `w2-3-bounded-exploration` are the contract every other
  pending diff depends on, so the supervisor kept them rather than serializing
  four workers behind one file. `deniedEvidenceKeys` was deliberately left
  optional here so that a single worker owns the breaking moment end to end
  rather than leaving Core red for the other three.
- Also: the two bare `catch` blocks `w2-live-provider` identified as the reason
  `pnpm demo:llm:setup` reports one uninformative sentence now carry the cause.
  The first attempt put the cause in the failure's message and broke the test
  "rejects secret-bearing or unsafe response metadata without echoing it" —
  which is a real property, not a stale assertion: that test pins the message to
  its exact constant so untrusted snapshot metadata can never reach it. The
  message is therefore fixed again and the redacted detail travels on `cause`
  and `details`, with `setup-demo-llm-key.mjs` walking the chain to surface it.
- Validation: supervisor-run. Core `npx tsc --noEmit -p packages/fluxiq` ->
  exit 0. Downstream `npx tsc --noEmit -p domain` and `-p packages/test-runner`
  -> exit 0. `node --check scripts/setup-demo-llm-key.mjs` -> ok.
  `pnpm --filter @fluxiq-web-extension/test-runner test` -> "# pass 940",
  "# fail 0" (939/1 before the message was pinned back).
  `node scripts/structure-audit.mjs` -> "passed (57 warning(s), 17 baselined)".
- Compaction: recording the four briefs took this document to 803 lines and the
  audit refused to baseline a compaction-threshold violation, which is the rule
  working as intended. Phase D's five approved fixes and the initial scoping
  briefs are settled, so both moved to
  `archive/settled-phase-d-and-initial-scoping.md`; 803 -> 707 lines.
- Not verified: nothing about the exploration actually running, which is the
  four workers' subject; and no live provider run — the user asked on
  2026-09-16 to stop for review before the real DeepSeek step, so that run is
  held deliberately rather than blocked.

### 2026-09-15 — Stage protocol, de-webbed sanitizers, and the test split
- Agent: supervisor; workers `s-stage-protocol`, `w2-test-split`, `h-harness-registry`
- Changed: Core `AS/runtime/llm/stages/**` (new), `llm/harness/**`,
  `deepseek-provider.ts`, `evidence-loop.ts`, `service.ts`,
  `AS/runtime/tests/**` (split into four subject subfolders),
  `.structure-baseline.json`; downstream `domain/src/runtime/llm-evidence/tools.ts`
- Why: L15 (a fixed order of work the domain extends but cannot reorder), the
  last of Phase T's leftovers (Core's sanitizers carried web nouns), and the
  runtime test directory sitting at exactly its 25-file budget, which blocked
  every remaining loop phase from adding a test
- Validation: the supervisor ran each itself. Core `npx tsc --noEmit` -> exit 0.
  `vitest run .../runtime/llm --no-file-parallelism` -> "Test Files 12 passed",
  "Tests 127 passed". `vitest run .../runtime/tests/service.test.ts` -> 108
  passed. Full `vitest run .../runtime` after the split -> "Test Files 84
  passed", "Tests 726 passed", no timeouts. `node domain/scripts/test-domain.mjs`
  -> 490 passed. Both structure audits pass
- Outcome: Accepted
- **Three pushes of mine were defective and each was caught by a worker reading
  the result, not by me.** A broad `git add` of a *directory* swept another
  phase's in-flight files three separate times; the third left HEAD unable to
  build from a clean checkout, because a swept file imported a directory that
  was still untracked. It compiled locally only because the directory existed in
  a working tree. Staging explicit file paths prevents this; a directory
  argument does not, because it takes whatever happens to be inside it
- The de-webbing had a real interim cost, recorded because it is the kind of
  thing that gets forgotten: Core stopped refusing `html`, `cookies` and the
  rest by name before anything passed the domain's declaration, so raw page
  payload could reach the provider on that path. Closed by wiring three
  `service.ts` sites and the domain's declaration
- Two deliberate choices in that list: `snapshot` is no longer denied, because
  it is Core's own noun and Core's own state-snapshot option produces one — the
  nested `html` is what is refused. `selector` is denied, because it is the
  domain's word for a target and stopped being Core's business when the repair
  target became opaque
- **Still to do, deferred rather than forgotten:** `deniedEvidenceKeys` is
  optional on Core's binding, and `context-packet.ts:81` defaults a missing
  declaration to `[]` — deny nothing. That is the same silent-no-protection
  shape this plan keeps finding, so the field should be required and the default
  should fail closed. Deferred because it breaks nine call sites across three
  files and Phase 2.2 is mid-edit in two of them; forcing an all-or-nothing
  change into an active file is what broke the build during Phase P
- The test split raised per-test contention and pushed two 10,000-item cases
  past the suite's 15s timeout. They now carry their own 60s budget: raising the
  global one would blunt a hang-detector for 700-odd tests to accommodate two,
  and those two assert their own speed explicitly (under 500ms per page and
  search), so the timeout was never what held performance honest

### 2026-09-15 — Endpoint classification landed; two supervisor corrections
- Agent: supervisor; workers `p-pin-classification`, `x4f-extraction-docs`
- Changed: Core `_shared/{api,runtime,docs-generators}.ts`, all 26 `*/api/**`
  registration files, `programs/tests/endpoint-classification.test.ts` (new),
  `_shared/tests/api.test.ts` (new), `persistence.md`; this repository's
  `docs/architecture/{extension-client,web-capabilities,sensitive-values}.md`
- Why: L16 — the PIN guards destruction, not authorship — and the extraction
  feature was built without its authored documentation following
- Validation: the supervisor ran the classification suites itself ->
  "Test Files 2 passed", "Tests 14 passed". The worker's `pnpm check` -> exit 0
  and `pnpm --filter fluxiq test` -> 1445 passed / 6 failed, of which one is the
  stale assertion below and five pass when their file runs alone
- Outcome: Accepted, with one known-red assertion and the push withheld
- **The commit is deliberately not pushed.** Making `review-flow-adaptation`
  authoring leaves a test in `AS/runtime/tests/service-flow-bootstrap-adaptation.test.ts:383`
  still expecting a PIN. It is stale rather than wrong-headed, and the worker
  owning that file is correcting it; `AGENTS.md` forbids pushing a unit that
  includes something known to be broken
- **Supervisor correction, recorded because it reverses an earlier decision of
  mine.** I previously classed `save-project-hierarchy` and
  `delete-project-hierarchy-node` as destructive, from the inventory's
  description. Reading `service.ts:4972` shows they touch only
  `customHierarchyNodes`: no flow, recording, project or dataset is removed, so
  the user's work survives and merely becomes unfiled. They destroy
  organization, not data, and the granular one is an **autosave** path that
  fires while the user drags items around — gating it would put a PIN prompt in
  the middle of ordinary editing, which trains reflexive PIN entry and weakens
  the PIN everywhere it actually matters. Both are now `authoring`, and they
  move together because leaving the bulk save gated while the granular delete is
  not would simply be a bypass
- `delete-run-datasets` keeps its PIN: it really does delete captured rows. The
  Data window's delete is correctly refused today, and the fix is in the panel,
  which must collect a PIN rather than route around the gate
- Four findings from the docs worker, none fixed: there is **no mechanical
  link or anchor check for `docs/architecture/`** (only `docs/working/` has
  one); both documents had stale action-input counts, now corrected;
  `web.user.value_extraction_defined` is registered but unreachable, since the
  worker refuses a `value` pick at two points; and `PICKER_PREVIEW_MAX_ROWS` and
  `EXTRACTION_PREVIEW_MAX_ROWS` are two constants that must agree, both 20, with
  no test holding them equal

### 2026-09-15 — Graph rollback inverse fixed and verified
- Agent: supervisor; worker `g-rollback-inverse`, resumed after the crash
- Changed: Core `automation-studio/storage/project/graph-store.ts` and its tests
- Why: a `delete_node` inverse omitted cascaded edges, so rolling back a
  deletion did not restore the graph it removed. Rollback is the safety net
  every later loop phase leans on — an autonomous change is only safe to propose
  if a bad one can be truly reverted
- Validation: the supervisor ran
  `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/storage/project/tests/graph-store.test.ts`
  itself -> "Test Files 1 passed (1)", "Tests 9 passed (9)", including the row
  "restores the graph exactly for every patch operation's inverse"
- Claimed but not independently reproduced: the worker ran the same suite with
  `graph-store.ts` restored from HEAD and reported 3 failed / 4 passed. That
  would show the tests catch the defect rather than passing either way, but the
  supervisor did not re-run it, so it is the worker's claim and not evidence
- Outcome: Accepted
- Follow-up: the worker **rewrote the inherited rollback test**, which asserted
  bookkeeping before it ever compared the graph and so would have passed without
  proving the fix — worth noting as the same failure mode this plan exists to
  correct, found in the plan's own test. It generalized to a table-driven
  round-trip across all eight operation inverses (only `delete_node` failed on
  HEAD) and fixed a second instance of the class in `restoreSnapshot`, which
  restored only x/y and parameters while silently dropping label, definitionId,
  ports, metadata, disabled and sizes. `restoreSnapshot` has no production
  callers, so that change is exercised only by tests

### 2026-09-15 — Identity Access credential recheck fixed and verified
- Agent: supervisor; worker `sec-create-session`, resumed after the crash
- Changed: Core `identity-access/{api/contracts.ts, api/handlers.ts,
  api/tests/handlers.test.ts (new), runtime/service.ts,
  runtime/tests/service.test.ts}`
- Why: `create-session` minted a session for any user id with no credential
  recheck, at the handler and in the service alike. The worker found a second
  defect in the same area: a user with **no credential record** unlocked the
  vault with nothing proved, because `requireCredential` mints an empty
  credential
- Validation: the supervisor ran
  `pnpm --filter fluxiq exec vitest run src/programs/identity-access` itself ->
  "Test Files 3 passed (3)", "Tests 35 passed (35)", including the new
  `api/tests/handlers.test.ts` (6 tests). The tests were read, not just counted:
  each asserts the refusal (`ok:false, requiresRecheck:true`) **and** that the
  side effect did not happen (`sessions` still length 1), so a refusal that
  still minted a session would fail. Passwords in them are dummy values at a
  test-only weak KDF setting
- Outcome: Accepted
- Follow-up: the same class survives in `create-user`, which mints a brand-new
  **admin** with a chosen password and no recheck — worse than the original,
  because the account outlives the session that made it — and in
  `begin-totp`/`confirm-totp`, which re-enroll another user's authenticator.
  Both are being closed now, with scope widened to the one web view they touch
- Supervisor decision, so it is not re-argued: `revoke-session` and `lock-vault`
  are **not** destructive and must never require a PIN. They remove access
  rather than persisted user data, and gating revocation slows cutting off a
  compromised session at the moment speed matters most. Phase P classifies them
  as authoring

### 2026-09-15 — Machine crash killed nine workers; partial work triaged
- Agent: supervisor
- Changed: reverted `_shared/api.ts` and `_shared/runtime.ts` in Core; five
  workers re-dispatched to resume, not restart
- Why: the machine crashed with nine workers in flight. None wrote a report, so
  none completed, but ~418 lines survived in Core and ~408 in the extension.
  Phase P's partial edit was the dangerous one: it had made `classification` a
  **required** field on `register()`, which is the right design but is
  all-or-nothing — every one of the ~223 registration sites must gain the field
  in the same change, so half-applied it stopped Core compiling and would have
  buried three freshly dispatched Core workers in type errors in files they do
  not own. Its design work is preserved as a patch rather than discarded, at
  `<scratchpad>/phase-p-partial.patch` (131 lines), and Phase P must be redone
  as ONE atomic change
- Validation: `git diff --stat` -> 418 insertions across 9 Core files before the
  revert; `git status --short` after the revert -> only worker-owned files
  remain modified; the patch file is 131 lines. Core type check run separately
- Outcome: Accepted
- Follow-up: Phase P re-dispatched atomically from the saved patch; T, X4-B and
  the pooled-rate fix still to restart, none of which left anything on disk
- Note: concurrency is now **five** workers, not nine. Two crashes have both
  occurred with nine heavy workers running, and this machine has a known memory
  fault, so the correlation is treated as a real resource limit rather than
  caution

### 2026-09-15 — User gave the go; four Core phases dispatched, inventory verified
- Agent: supervisor; worker `w2-d-write-endpoint-inventory`, then `d-five-fixes`,
  `sec-create-session`, `p-pin-classification`, `g-rollback-inverse`
- Changed: this document (Status detail, Current State, Phases T/H/S/G/P/SEC,
  Open Questions)
- Why: the user said to continue and to use maximum parallelism. The phase table
  named findings it assigned to no phase — L2's opaque target, L14's harness
  registry, L15's stage protocol, and the rollback defects — so each got one
- Validation: `grep -rn "registry\.register(" packages` excluding tests -> 223,
  and `authorizeProgramPin` sites -> 58, against the worker's 220/57; the
  qualitative claim held, every site being under `programs/automation-studio`
  or `_shared`. Read `identity-access/api/handlers.ts:121-130` directly:
  `create-session` calls `service.createSession` with no recheck, and
  `runtime/service.ts:291-306` adds none. `runtime/roles.ts:3-20` -> only
  `admin` holds `identity.manage`, so the defect is admin-only to reach.
  `persistence.md:515-521` confirmed to state the PIN rule the code violates
- Outcome: Accepted; the worker's counts corrected rather than adopted
- Follow-up: verify each dispatched worker's claim before treating it as done

### 2026-09-15 — Phased loop plan written from both scoping reports
- Agent: supervisor; workers `w2-scope-context-recovery`,
  `w2-scope-repair-reuse`
- Changed: this document (Current State, Decisions L2-L11, Phases, Execution
  partition, Validation, Risks, Open Questions); its new Core pair
- Why: the user asked for the rest of Week 2 to be planned and reviewed before
  building; the reports found no exit criterion met and five defects by reading
- Validation: not validated; planning documents only, no code changed
- Outcome: Accepted
- Follow-up: the user's review; then phase D and R0

### 2026-09-15 — Plan created; scoping investigations dispatched
- Agent: supervisor; workers `w2-scope-context-recovery`,
  `w2-scope-repair-reuse`
- Changed: this document
- Why: the user pointed out that Week 2 is for refining the automated loop,
  while every worker was on extraction and Core credential hardening and the
  loop phases had no plan
- Validation: not validated; planning document only
- Outcome: Partial
- Follow-up: write the phased plan from both reports

## Open Questions

- ~~L2, L6, and L9 acceptance~~ — **closed, and not the user's to decide any
  more.** L13 supersedes L6 and L9: the model is used freely, and approval mode
  gates *applying* a proposal rather than producing one. L2 stopped being a
  preference to accept when `w2-c` showed Core's repair target is a CSS
  selector; L14's harness options cannot be domain-neutral while that is true,
  so L2 is a prerequisite that Phase T delivers.
- **E56 design A.** The corroboration predicate that exploration relies on has
  not been explicitly accepted. Owner: the user.
- **Provider-resolver seam.** How the web-panel host supplies Core's provider
  resolver, which the Lab's scripted provider needs (Core
  `docs/architecture/automation-studio.md:606-612`). Owner: senior supervisor
  agent, a read-only check before 2.9's briefs.
