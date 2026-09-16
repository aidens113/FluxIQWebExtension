# MVP Week 2 Automation Loop Plan

Status: Active
Status detail: Executing 2026-09-15; the user gave the go and asked for maximum parallelism. Phases D, P, SEC and G are being built in Core; the loop phases follow once their prerequisites land.
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

**L14 is far smaller than it looks.** `w2-c` found the loop already exists and
is already domain-neutral (`AS/runtime/llm/evidence-loop.ts`). What is missing
is a registry of harness options, any Core-owned neutral options at all (Core
ships zero; every tool today comes from this repository), and the other entry
points, which `execution-grants.ts:493-511` bolts shut. **Phase H** delivers it.

**One leak blocked it, and it is now Phase T.** Core's repair target *is* a CSS
selector (`structured-response.ts:14-16`), hard-required at five sites including
the JSON schema, the provider prompt (`deepseek-provider.ts:38,57-73`) and the
service options (`service.ts:356`) — while its sibling `TargetOverrideFailedAction`
(`live-patch.ts:34-37`) is already domain-neutral, so the intent was there and
one type was missed. Three smaller leaks follow: an unscoped `llmEvidenceRuntime`
(`service.ts:352-357,769-772`); the closed task-kind union and hard-coded stage
prose that block L15 (**Phase S**); and Core's sanitizers carrying web nouns.

**What is true today:** no Week 2 exit criterion is met. The parts exist and
are tested, but no runtime loop connects them.
- 2.1: Core's harness packet has slots for most of the MVP capture list, but
  the one runtime caller fills only instructions, recent actions, a 3,000-byte
  page snapshot, and policy. Expected state, the before/after state diff,
  subflow and router context, prior adaptations, and recording context never
  reach the model (`AS/runtime/service.ts:2865-3169`).
- 2.2: a deterministic "is AI eligible" classifier exists but only decorates
  run summaries; the LLM diagnosis is free text; there is no plan stage.
- 2.3: there is no exploration loop at run time (the bounded evidence loop
  serves Flow creation only), no whole-recovery time limit, and none of the
  five required completion states.
- 2.5-2.7: Core can test one LLM patch on a patched copy, save it, auto-apply
  it when low-risk, persist it with rollback, and rerun once, proven only by a
  mock-provider unit test. The shipped app saves one never-run, high-risk
  target-override proposal that a person applies.
- 2.8: "resume" reruns from the start, and is unreachable in the shipped app.
- 2.9: nothing records which adaptation a later run used; FluxBench has no
  adaptation lane, and its Week 2 metrics are typed `null`.

**Defects: five, corrected to seven, now Phase D.** `w2-a` proved two by running
Core's own `live-patch.ts` unmodified in a scratch copy — 19 of 19 expectations
matched — and corrected two of the five descriptions that were wrong as written:
a never-executed proposal does not auto-apply (the harm is that its fabricated
success is indistinguishable from a verified one), and the unwritten
`failureSignature` is not why matching fails (the only production call site
passes no adaptations at all). It found a sixth instance
(`temporary_recovery_subflow_call`) and a seventh path skipping the promotion
gates. Detail: `reports/w2-a-defect-fixes.md`.

**One cause explains all of them: success is recorded from the absence of
contradicting evidence rather than from observed evidence.** The fixes, the
load-bearing order, and the reasoning are below under "The five fixes"; the
per-defect evidence and regression lists are in
`reports/w2-a-defect-fixes.md`.

**L13's first increment needs no new contract.** `w2-b` found a flow is six
stores of which only the graph is transactional: routers, subflows and
instructions have no revisions or inverses, and flow variables, errors and
regions have no write path at all. But action targets, expected state, retries
and wiring are already expressible and revertible as graph operations, so the
first increment can proceed; only router, subflow, instruction and flow-field
changes need a new contract.

**Three findings that are not merely design gaps, now Phase G:** a `delete_node`
inverse omits cascaded edges, so rollback does not restore the graph it removed —
and rollback is the safety net every later phase leans on; structural adaptations
cannot be applied at all, because the promotion gate requires a `proposalId` no
endpoint can create; and two apply engines sit behind the single
`review-flow-adaptation` endpoint with different rollback guarantees, chosen by
deployment configuration.

**The PIN conflict is resolved, and its premise was wrong.** `w2-b` reported
that every flow write endpoint requires a PIN an autonomous loop cannot supply;
`w2-d` disproved the general claim, and the supervisor confirmed it — the PIN
guards *one program*, not writes as such, and several destructive endpoints have
none (Phase P). The user settled the rest as L16. One conflict does remain: flow
bootstrap already demonstrates the right build-a-flow pattern but **refuses any
flow that is not blank**, so the "improve an existing flow" entry point cannot
reuse it unchanged.

**Done:** both scoping reports; this plan and its Core pair; the four
investigations, each supervisor-verified rather than taken on trust.

**In progress**, five workers resuming partial work the crash interrupted:
Phase D (its failing test is on disk and its fix is not, so Core's only type
errors are in that one file), Phase SEC, and Phase G in Core; X4-C and X4-D in
the extension.

**Not started:** Phase P — its partial edit was reverted, because making
`classification` a required field is all-or-nothing across ~223 registration
sites and half-applied it stopped Core compiling. That design survives as
`phase-p-partial.patch` in the session scratchpad and must be redone as one
atomic change. Also Phases T, H and S, the content picker X4-B, and the loop
phases 2.1-2.9.

**Concurrency is five workers, not nine.** Both crashes happened with nine heavy
workers running on a machine with a known memory fault, so this is recorded as a
real resource limit rather than caution.

**Next steps:**
1. **Done.** Every finding that had no phase to deliver it now has one: **T**
   for L2's opaque repair target, **H** for L14's harness-option registry, its
   Core-owned neutral options and the other two entry points, **S** for L15's
   stage protocol, and **G** for the rollback-correctness defects. Phase 2.3 no
   longer writes an exploration loop, because one already exists.
2. **Done**, as `w2-d`, and it found more than an inventory. The PIN does not
   guard destruction today, it guards *one program*: all ~58 checks live in
   `automation-studio`, so moving a node on a canvas needs a PIN while deleting
   a user's captured dataset rows does not. Phase P carries the mechanism.
   Separately, `w2-d` found a **security defect unrelated to the loop** —
   `identity-access/create-session` mints a session for any user id with no
   credential recheck, at the handler and in the service alike. Admin-only to
   reach, so not an unauthenticated escalation, but it sidesteps the recheck the
   rest of the program enforces. Now Phase SEC, recommended for a fix ahead of
   the loop rather than bundled into L16. Counts and the three code findings were
   re-verified by the supervisor against the handler bodies; the worker's
   220/57 is 223/58 by my own count, which changes no conclusion.
3. **Done.** `w2-b`'s finding is folded into the Phases section: the first loop
   increment needs no new authoring contract, so router, subflow, instruction
   and flow-field contracts come after it rather than gating it.
4. Nothing is built until the user says go.

**Blockers:** none. The user's direction is recorded as L12-L16. The earlier
request that he approve L6 and L9 is **withdrawn**: L13 supersedes both, because
the model is to be used freely and approval mode gates *applying* a proposal
rather than producing one. L2 still stands and is now load-bearing rather than a
preference. Still open, and unrelated to this loop: whether an excluded dataset
column means "never stored anywhere" or only "absent from the dataset and
export".

---

## Decisions (recommended, for the user's review)

- **L1. The loop comes first in Week 2.** If capacity runs short, extraction
  beyond X4 and Core's Data window move to Week 3 rather than delay 2.1-2.9;
  Core's credential hardening continues.
- **L2. One repair-target contract for the loop and extraction (E2, X6).**
  Core carries an opaque, domain-owned target object instead of `{selector}`.
  The web domain fills it fingerprint-first, with the selector as a hint, and
  evidence names elements by opaque `target.N` handles. List item and field
  selectors become domain-declared repairable parameters, so an `extract_list`
  repair uses the same contract.
- **L3. E54, option 3.** A candidate missing only an identifier clears the
  `destructive` rung only with a second agreeing signal, and exploration's
  destructive refusal is semantic (submit, delete-like, control role and type),
  never a similarity score.
- **L4. Names.** The harness context contract is `recoveryContext`, in a new
  Core `AS/runtime/recovery/` directory; the existing
  `AutomationStudioRuntimeAdaptationContext` (policy and budget) is untouched.
- **L5. Deterministic first is enforced.** The classifier gates the LLM: no
  provider call when a deterministic path or a known adaptation applies, or the
  failure is policy, auth, user intervention, or graph; no patch request unless
  the diagnosis says a patch or exploration is needed.
- **L6. A distinct grant purpose for runtime recovery,** explicit grant only,
  with its own call count and wall-clock budget, documented as an
  authorization boundary in Core's `automation-studio.md`.
- **L7. Confidence tiers.** An executed in-run success is Medium (used now,
  kept provisional); High only after a zero-LLM replay passes; a structural,
  never-executed validation never counts as success; Low asks a person.
- **L8. Resume, not restart.** Continue from the failed node, or the patch's
  start node, with accumulated values, after a host check that the node's input
  state still holds; restart only when no side-effecting node has run.
- **L9. In-run use on the explicit-grant lane.** A target override the domain
  validator matched or resolved against sanitized evidence may execute once in
  the current run without persisting, never for submit-like actions.
- **L10. Lab.** A provider-free scripted provider (Core test-only, loopback and
  a grant required) drives loop cells; loop lanes are their own lane class so
  deliberate harness activations do not read as Week 1 regressions; a `week2`
  corpus; a new A/B baseline after the loop phases, plus one live DeepSeek
  checkpoint through the existing demo lane.
- **L11. Recent browser events** are captured only if the W13 and W24
  dry-run diagnoses show the state diff is not enough; 2.1's Lab proof decides.

### Decisions the user gave on 2026-09-15, which reshape the plan

These are the user's instructions, not recommendations, and they supersede parts
of L5, L6, and L9 above.

- **L12. One improvement loop, three entry points.** This is not a recovery
  loop. The same machinery runs when a user asks for a **new** flow, when a run
  fails, and when an existing flow meets an edge case. The entry points differ
  only in what seeds the context and in what counts as done; they must not fork
  into separate systems. Everything below that says "recovery" is the failure
  entry point of this one loop.
- **L13. The model's action surface is the whole flow-authoring surface.**
  Anything a person can do to a flow — add and remove nodes, wire them, set
  parameter values, create subflows and routers, attach instructions, declare
  expected state — the loop may propose. FluxIQ should use the model **freely**
  to improve a flow in real time, first build or later failure alike.
  **Approval mode gates applying a proposal, never producing one:** in approval
  mode the loop still explores, iterates, and presents a complete proposed
  solution, and only the final application waits for a person. This replaces
  L6's restrictive separate grant as the default posture, and widens L9.
- **L14. Exploration is a Core framework capability, not a web one.** Core owns
  the exploration loop, its budget, its outcomes, and a **registry of harness
  options** — the actions the loop may take to gather information. Core ships
  the domain-neutral ones. An **imported domain package registers additional
  harness options that extend the core set rather than replacing it**, so a
  non-browser domain gets the same loop. No DOM, selector, tab, or browser
  concept may appear in Core to serve this.
- **L15. A fixed order of work, with domain-extensible instructions.** The loop
  follows an explicit protocol — gather information and explore, plan,
  implement, iterate, verify — and the model is instructed in that order rather
  than left to choose one. An importing domain may **add** instructions to any
  stage or **completely override** that stage's instructions, through Core's
  existing instruction system. The ordering itself is Core's and is not
  overridable; what happens inside a stage is the domain's to extend.
- **L16. The PIN guards destruction, not authorship.** The user's decision:
  **remove the PIN from most writes; only deleting and genuinely destructive
  actions keep it.** This resolves the conflict `w2-b` surfaced, where every
  flow-write endpoint required a PIN that an automatic loop cannot supply, which
  would otherwise have forced the loop to wait for a person even with approval
  mode off. Two things keep this a bounded loosening rather than an open one:
  1. **Destructive is an explicit, exhaustive classification of every write
     endpoint**, decided in one place rather than judged at each call site.
     Deleting a flow, project, recording or dataset, anything that removes
     persisted user data, and anything taking an irreversible external action
     keep the PIN. Creating and editing flow content does not.
  2. **A test fails the build when any write endpoint has no classification**, so
     the default can never quietly become "no PIN" as endpoints are added. Per
     the standing rule, this is enforced by a check rather than by a note.
  The first step of this work is an inventory of every write endpoint; the plan
  must name the PIN-keeping set explicitly rather than describing it.

## The five fixes — approved by the user, to be built as Phase D

The user approved these on 2026-09-15 and asked that they be **planned, not
started**: they are Phase D below, and no code changes until he says go.

Detail, including the executed reproductions and the per-fix regression lists,
is in `reports/w2-a-defect-fixes.md`. Summary:

- **Fix 1 — stop inferring success from silence.** Replace the boolean
  `runtimePatchRestoredExpectedState` with an outcome that can say *I could not
  tell*: `verified`, `unverifiable`, `contradicted`, `not_executed`. Only
  `verified` writes a `validationResults` entry; `unverifiable` writes none and
  leaves the adaptation `testing`. There are **two** vacuous-true paths, not one
  — `!comparison` and `[].every()` on an empty expectation — so fixing only the
  first leaves the defect alive.
- **Fix 2 — stop writing a success that declares itself not to have run.** Delete
  the fabricated `validationResults` entry from
  `targetOverrideProposalAdaptation` and record the structural check as
  `metadata.structuralChecks`. Count only executed validations in
  `adaptation-store.ts:161`.
- **Fix 3 — make patch application total and fail closed.** `applyRuntimePatchToFlow`
  has **no branch at all** for `temporary_action_sequence`, so it silently
  returns the unmodified flow and the rerun validates the *original* flow.
  Make the switch exhaustive, return `not_executed` for an unapplied kind, and
  only then implement real application. Stop writing the dead
  `parameterValues.recovery`.
- **Fix 4 — wire the gate that already exists.** `decideAutomationStudioLlmInvocationGate`
  implements L5 correctly, is tested, and has **zero production callers**. Call
  it before resolving the provider, and chain the patch call on the diagnosis
  actually succeeding and calling for a patch — today the two calls are
  independent and the second bills even when the first failed.
- **Fix 5 — thread the adaptations into classification.** The signature is
  genuinely never written, but that is not why matching fails: the only
  production call site passes **no adaptations at all**, so the match set is
  always empty. This is a seam change, not a one-line edit.

**The single underlying cause, which is why these are one job and not five:**
success is recorded from the *absence of contradicting evidence* rather than
from observed evidence of the intended effect. Making `validationResults`
constructible **only** from an executed-and-compared run dissolves fixes 1-3 and
leaves every downstream gate correct as written — those gates already ask "is
there a succeeded validation?", and the question becomes trustworthy for free.
That is also exactly what L7's confidence tiers require.

**Order: 1 → 3 → 2 → 5 → 4, and the order is load-bearing.** Fixes 4 and 5 must
come **last**. Once adaptations are actually passed to classification, matches
start returning results, which flips the model's eligibility to false — so doing
4 and 5 first would make the loop skip the model on the strength of exactly the
unverified `validated` records that defects 1-3 fabricate. It would look like
progress and would make the system worse. Fixes 1, 2 and 3 all edit
`live-patch.ts` and are serial for one worker.

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

Recorded at dispatch on 2026-09-15, before the three investigations above.

### Brief: w2-scope-context-recovery
- Repository: this repository and FluxIQ Core (`F:\!FluxIQ`), read-only
- Task: for MVP Phases 2.1-2.4 (Standardize Adaptation Context, Separate
  Diagnosis From Exploration, Bounded Harness Exploration, Recovery Success
  Detection), read each phase's build items and exit criteria, then document
  with file:line what already exists in this repository and in Core
  (adaptation context, diagnosis, exploration harness, recovery detection,
  their tests, and Testing Lab coverage), what is missing against each exit
  criterion, and which Week 1 carry-overs bear on them (the Week 1 plan's Next
  steps and open questions E2, E54, and E56). Recommend concrete steps per
  phase, partitioned by file, with tests, mutation targets, the Lab proof, and
  repository ownership (Core or here), and note where the extraction plan's
  phases interact (X4 lands before Phase 2.4).
- Required reads: `AGENTS.md`; `MVP_AGENT_INSTRUCTIONS.md`; the MVP plan's
  "Week 2 Objective" and Phases 2.1-2.4; the Current State of
  `mvp-week1-web-automation-reliability-plan.md` and the named entries in its
  `open-questions.md`; D1 of `first-class-data-extraction-plan.md`; the Current
  State of `llm-production-automation-plan.md`; the code those lead to
- Owns (may edit): its report only
- Must not touch: all source and documents; no builds, test suites, Lab runs,
  or web panel
- Definition of done: every exit criterion of 2.1-2.4 mapped to what exists
  and what is missing, with file:line and recommended steps
- Report to: `F:\!FluxIQWebExtension\docs\working\mvp-week2-automation-loop-plan\reports\w2-scope-context-recovery.md`

### Brief: w2-scope-repair-reuse
- Repository: this repository and FluxIQ Core (`F:\!FluxIQ`), read-only
- Task: for MVP Phases 2.5-2.9 (Convert Exploration Into Reusable Automation,
  Validate Proposed Adaptations, Persist Adaptations, Resume Current Execution,
  Prove Deterministic Reuse), read each phase's build items and exit criteria,
  then document with file:line what already exists in this repository and in
  Core (proposal and patch flow, adaptation validation, persistence, resume,
  reuse proof, their tests, and Testing Lab and FluxBench coverage), what is
  missing against each exit criterion, and which Week 1 carry-overs bear on
  them (the Week 1 plan's Next steps and open questions E2, E57, and E58).
  Recommend concrete steps per phase, partitioned by file, with tests,
  mutation targets, the Lab proof, and repository ownership (Core or here), and
  note where the extraction plan's X6 (drift variants through adaptation, an
  extraction workflow in Phase 2.9's reuse proof) interacts.
- Required reads: `AGENTS.md`; `MVP_AGENT_INSTRUCTIONS.md`; the MVP plan's
  "Week 2 Objective" and Phases 2.5-2.9; the Current State of
  `mvp-week1-web-automation-reliability-plan.md` and the named entries in its
  `open-questions.md`; X6 and D1 of `first-class-data-extraction-plan.md`; the
  Current State of `llm-production-automation-plan.md`; the code those lead to
- Owns (may edit): its report only
- Must not touch: all source and documents; no builds, test suites, Lab runs,
  or web panel
- Definition of done: every exit criterion of 2.5-2.9 mapped to what exists
  and what is missing, with file:line and recommended steps
- Report to: `F:\!FluxIQWebExtension\docs\working\mvp-week2-automation-loop-plan\reports\w2-scope-repair-reuse.md`

## Work Ledger

### 2026-09-15 — Graph rollback inverse fixed and verified
- Agent: supervisor; worker `g-rollback-inverse`, resumed after the crash
- Changed: Core `automation-studio/storage/project/graph-store.ts` and its tests
- Why: a `delete_node` inverse omitted cascaded edges, so rolling back a
  deletion did not restore the graph it removed. Rollback is the safety net
  every later loop phase leans on — an autonomous change is only safe to propose
  if a bad one can be truly reverted
- Validation: the supervisor ran
  `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/storage/project/tests/graph-store.test.ts`
  itself -> "Tests 9 passed (9)", including
  "restores the graph exactly for every patch operation's inverse". The worker
  reported the same suite with `graph-store.ts` restored from HEAD ->
  3 failed / 4 passed, so the tests demonstrably catch the defect rather than
  passing either way
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
