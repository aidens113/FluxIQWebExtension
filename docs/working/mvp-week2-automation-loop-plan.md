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

**Live DeepSeek replies since 2026-09-16 (`run-mu4nxysj-3234c535`).** Before
that no live run had received one: the adapter refused every recovery request
pre-send (fixed `5300d47`), and earlier reports had read "gate invoked" as
"provider reached". Read live results call by call from
`snapshots/live-llm.json`, never from the verdict. The user's standing rule
holds: nothing is demonstrated until it runs against the real key.

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

**Concurrency is five workers, not nine.** Both crashes happened with nine heavy
workers running on a machine with a known memory fault, so this is recorded as a
real resource limit rather than caution.

**Live-testing campaign (user direction, 2026-09-16):** "get to a point where
we have at least basic automation able to be created & repaired by simply
pointing the instructions at a demo, and having it explore and auto-create
flows", across "lots of different demos", including flows that navigate demo
sites and scrape data. Runs serving that goal need no per-run approval. The
full campaign (`test-runs/campaigns/2026-09-17T02-23-20-255Z`, 36 creation and
14 repair tasks, Core `8409ca2` from `F:/fxlab/lab-core`) finished 15 of 50:
forms 6/6, extraction 4/14, navigate-and-extract 1/16, repair 4/14. Scraping
fails three ways (fields missing from records, a repeated tool request ending
the build, malformed record-output or handle placement); six refusal tasks
proposed a substitute control instead of refusing; four tasks never started.
Later campaigns run from the isolated pair (`pnpm lab:pair`).

**Next steps, in order:**
1. In flight (Core): C-6 trial and judge, now also the recorded-step target in
   the trial rerun and the file-based applier; C-7 exploration packets reach
   the repair; `w2-creation-loop-keeps-going` (duplicate requests answered,
   unusable-decision feedback names the accepted shape, extract_list contract
   in the catalog); Core docs for today's changes.
2. In flight (this repository): `w2-created-scrape-fields` (field selectors
   and handle placement for created scrapers; edits only after the campaign
   ends); `w2-lab-pair` (an isolated `F:/fxlab/lab-ext` + `F:/fxlab/!FluxIQ`
   pair, so campaigns stop freezing edits here).
3. After the campaign: W-3 extraction repair, L-5 fixtures, L-2 repair lane,
   the `xpathFor` id-anchor fix (with the identity specs); then C-9, C-10,
   C-11, C-12 (extend mode for non-blank Flows), C-13, L-3, L-4, per
   `reports/w2-back-half-design.md` section 8. Rerun the campaign from the
   pair after each batch of fixes.
4. Before pushing: full checks in both repositories; `pnpm docs:reference` in
   Core.

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

### 2026-09-16 — First full live campaign: forms pass, scraping and refusals do not
- Agent: supervisor; `pnpm lab:campaign --all --max-attempts 4` from this
  checkout against Core `8409ca2` (`F:/fxlab/lab-core`), DeepSeek.
- Validation: supervisor-read
  `test-runs/campaigns/2026-09-17T02-23-20-255Z/summary.json`: totals
  `{"tasks":50,"passed":18,"succeeded":15,"failed":28,"noResult":4,
  "providerCalls":123,"reportedTokens":638885,"reportedCostUsd":0.3071662}`;
  by kind form 6/6, extract 4/14, navigate-and-extract 1/16, repair 4/14.
  Failure codes: `web.validation.output_not_observed` 9,
  `evidence_unusable_decision` 7, `evidence_duplicate_tool_request` 7,
  `evidence_duplicate_call` 1, `environment.missing` 5,
  `web.target.not_found` 3, `web.navigation.unexpected` 2,
  `web.target.ambiguous` 1.
- Repair: the renamed-Save repair and three refusals (locked record,
  blocking offer, blocked popup) succeeded. Six refusal tasks produced a
  target-override proposal instead of refusing (not executed): the loop
  guesses a substitute control. Four tasks never started
  (`environment.missing`, reason lost by the runner); one failed before the
  model was consulted. The supervisor's mid-run report that the
  save-and-exit refusal passed was wrong: its run verdict passed and its
  judgement failed.
- Dispatched: `w2-repair-refuses`, `w2-w3a-recovery-detection` (W-3 split:
  detection in recovery and retained selector hints now; extraction-repair
  resolution after `w2-created-scrape-fields`), `w2-campaign-tasks-start`.
  Held for a slot: L-2, the `xpathFor` fix. Next campaign runs from the pair.

### 2026-09-16 — Trial and judge, exploration reaches repair, campaign pair
- Agents: C-6 (`w2-c6-trial.md`, Core `8329477`), C-7
  (`w2-c7-exploration-handoff.md`, Core `a8ce814`), `w2-lab-pair`
  (`scripts/lab/pair.mjs`, `F:/fxlab/lab-ext` + `F:/fxlab/!FluxIQ`).
- C-6: a change is trialled against the failed attempt and judged per node
  by the flow-change verdict, with the run's remaining steps rather than 50.
  The trial rerun and the file-based applier now use the shared
  `actionTargetParameterValues`, so every path repairs a recorded step.
  Open: the executor must expose remaining steps (C-9 passes them);
  `verifiesState` is not wired yet; `live-patch.ts` is 744/800, so C-11
  splits it into `runtime/live-patch/` first.
- C-7: the patch request carries the explored packets and the target check
  accepts their handles, written `explored.N:<handle>` because the domain
  numbers handles per packet (accepted by the supervisor). Found: the
  provider's pre-send check skips the explored slot, and exploration's own
  requests do not apply the domain's denied keys (older); both dispatched as
  C-7b. The domain's recovery options never `retain` selectors, so explored
  repairs resolve by fingerprint only (added to W-3).
- Validation: each change was verified alone in a clean Core worktree
  (`F:/fxlab/verify-core`, HEAD plus only that worker's files, the main
  checkout's `node_modules` joined in). C-6: `npx tsc --noEmit -p
  packages/fluxiq` -> exit 0; `vitest run` service-adaptation
  `--no-file-parallelism` -> "12 passed"; flow-change, live-patch, store,
  policy-action and recovery -> "27 passed", "435 passed". In parallel the
  service tests timed out at 5 s under load, a different set each time. C-7:
  tsc exit 0; recovery, llm and service-adaptation serially -> "52 passed",
  "595 passed". Pair: `node --test "scripts/lab/pair/tests/*.test.mjs"` ->
  "# pass 37"; `pnpm lab:test` -> "# pass 67"; non-live `basic-form` from the
  pair passed (`run-mu4xja1g-acac85a7`, worker-reported).
- Campaigns from the pair: export the four variables `pnpm lab:pair` prints
  and `DEEPSEEK_API_KEY` from the main checkout's `.env.local` into the
  process, never copying the file; summaries land under
  `F:/fxlab/lab-ext/test-runs/instances/lab-pair/campaigns/`.
- Found: a fresh Windows checkout of Core fails its own `working-docs` audit
  rule (index stale), seen in `F:/fxlab/verify-core` and the pair. Fixed
  (Core `6964d63`, here `7c763e5`, report `w2-audit-line-endings.md`): the
  rule compared the CRLF checkout byte for byte with its LF index.
  Validation: `node scripts/structure-audit.mjs` in `verify-core` with a CRLF
  README -> "passed (153 warning(s), 355 baselined)"; `pnpm structure:test`
  -> "# pass 166", "# fail 0" in both repositories; `cmp` of both files
  identical across the three trees.

### 2026-09-16 — An approved repair now changes what a recorded step clicks
- Agent: `w2-typed-apply-gates`, integrated by the supervisor as Core
  `c0b04be`.
- A recorded step (`builtin.policy.action`) dispatches its recorded payload, so
  a repair written beside it had no effect. The typed store now writes it into
  `parameters.target`, rolls back exactly, and refuses every apply without the
  promotion gates. The web domain already prefers `parameters.target` over the
  recorded selector (`domain/src/output-nodes/targets/targets.ts`, supervisor
  read). The same gap remains in the file-based applier
  (`service/adaptations/patches.ts:57`) and in the trial rerun
  (`live-patch.ts:~528`); C-6 now owns both, sharing one moved helper.
- Validation: `npx tsc --noEmit -p packages/fluxiq` -> exit 0 (after the
  supervisor added the gates argument at `service.ts:4798` and widened a
  catalog test helper's literal type); `vitest run` on the store, the new
  policy-action test and `catalog.test.ts` -> "3 passed", "42 passed";
  `node scripts/structure-audit.mjs` -> "passed (152 warning(s), 320
  baselined)".
- Dispatched: C-7 (exploration packets reach the repair request and target
  check), Core docs for today's changes, and `w2-created-scrape-fields` (the
  campaign's first two scraping tasks built navigate -> `extract_list`, found
  all 8 records and missed name, price, rating and url in some of them:
  `run-mu4wwkbc-df6cfe60`, `run-mu4wyfaw-001d0bcc`; no recovery was attempted
  because extraction repair is fail-closed until W-3). That worker edits
  nothing here until the campaign's `finishedAt` is set. Later, from the
  campaign's next eleven rows (1 of 11 scraping tasks passed):
  `w2-creation-loop-keeps-going` (Core; `run-mu4xder7-e00d5bf0`,
  `run-mu4xeh1g-de1433bb`, `run-mu4x6p3f-f7f8b450` ended on a repeated detect
  request; `run-mu4xatjs-12a5a5c7`, `run-mu4x5m2p-a4a4a29d` on three unusable
  plans: `record_output.*`, `web.handle.misplaced`/`malformed`), the handle
  half added to `w2-created-scrape-fields`, and `w2-lab-pair`. Held until the
  campaign ends, because each campaign run rebuilds this checkout: W-3, L-5,
  L-2.
- Also landed: the `swallowed-failure` audit rule (Core `42bd90a`, mirrored
  here; report `w2-audit-swallowed-writes.md`), 61 and 94 existing instances
  baselined. Validation: `pnpm structure:test` -> "# pass 162", "# fail 0" in
  both repositories; the 12 mirrored files `cmp` identical; a supervisor probe
  file with `await work().catch(() => undefined)` and `catch {}` failed the
  Core audit ("2 failures are silently dropped, at lines 2, 3") and was
  removed; this repository's audit -> "passed (60 warning(s), 122
  baselined)" after the index was regenerated.
- Core docs (`a32fdc9`, report `w2-core-docs-loop-changes.md`): grants,
  guards, per-call records, plan handles, catalog reservation, refusal
  reasons, gated typed applies, migration 0020. Validation: Core
  `structure-audit.mjs --rule docs-links` -> "passed (0 warning(s), 0
  baselined)"; supervisor checked the handle bounds against
  `plan-node-handles.ts` (64, 16, `MAX_LOCATION_LENGTH = 2_048`) and the
  review action's `classification: "authoring"` (`api/handlers/runs.ts:135`).
  Recheck after C-6: the "at most 50 steps" lines and the typed-store-only
  `parameters.target` wording. `evaluateBootstrapAdaptationApplyGates` is
  still uncalled by design; C-12 wires it.
- Not verified: recording-definition nodes drop an applied `parameters.target`
  when materialized (`service/recordings/candidate-definitions.ts:86`);
  recorded Flows use `builtin.policy.action` and are unaffected.

### 2026-09-16 — A Flow built live from an instruction passes its goal
- Agent: `w2-live-creation-debug` (live), verified by the supervisor; Core
  `8409ca2`, this repository `269e351`.
- Why the created plans failed: the page evidence names elements by `target`,
  so the model wrote handles into each node's `target` parameter, and the web
  domain accepted a handle only under `selector`; every created step kept a
  guessed selector. Plan resolution now accepts a handle under `target`,
  `element` or `selector` and replaces a guessed literal. Rename tasks built a
  Flow that only cleared the field because "rename" and "save" ranked no node;
  they now prefer typing and clicking. A refused build lists each decision
  with its refusing code.
- Validation: supervisor-read `test-runs/run-mu4vs7j1-aca950d7`
  (`evaluation.json`, `snapshots/live-llm.json`, `snapshots/flow-lane.json`):
  verdict `passed`, oracle `passed`, executed start -> `web.dom.type` ->
  `web.dom.select` -> `web.dom.click` -> end, build `proposed`, 4,659 tokens,
  $0.0024926, redaction `passed`. First campaign
  (`test-runs/campaigns/2026-09-17T02-00-12-342Z/summary.md`): 2 of 6 form
  tasks passed, 9 calls, 42,191 tokens, $0.021; the 4 rename failures each
  built only `web.dom.clear`, fixed after, and each passed when rerun alone
  (worker report). Core flow-bootstrap 118/118; this repository domain 614/614,
  test-runner 1097/1097.
- Also landed today (Core): `cb9c54b` and `fce62f9` (silent reads propagate; a
  run that fails to start ends failed, releases its grant, and no longer
  blocks the next run; promotion reads the tier), `2a01e81` (migration 0020,
  node stamps), `79f0ceb` (promotion by trials and replays), `1d208ed` and
  this repository `d4e3cc6` (`failure-as-empty` audit rule, 132 and 77
  instances baselined).
- Not verified: the full campaign (running now, all 36 creation and 14 repair
  tasks); scraping created live.

### 2026-09-16 — Created Flow runs every step; plans then refused under iteration
- Agent: supervisor, live, against a clean Core worktree; repair, catalog,
  identity and back-half workers integrated (Core `f09d18a`, `aab40c1`,
  `a719531`, `b90dd43`, `2ae5894`; this repository `ec19ed0`, `6f006e5`,
  `06ead88`, `c356174`).
- Validation: live `pnpm lab run instruction-only-form --live-llm --llm-task
  create-flow --instruction-task instruction-only-form-submit ...`
  -> Core `6be4698` with created-node identity: `run-mu4u2qui-969f0f76`, build
  `proposed`, one call, 4,389 tokens, $0.00234212; the created Flow ran all
  steps (type, click, click) with no error, but the scenario's playback goal
  failed -- the plan field is a `<select>` and no select node was used.
  -> Core `2ae5894` with the catalog fix: `run-mu4v1zqq-f2af9f06`, build
  `failed`, `flow_bootstrap.evidence_unusable_decision`, 4 decisions, 1
  inspect, 14,574 tokens, $0.00774312; redaction `passed` on both. The Lab kept
  no plan issue codes. Live repair: `run-mu4tlmls-f7ac6101` passed
  (`repaired`), with the recorded Flow's failed action identified by output id
  and the model told the repairable parameter is `element`.
- Suites at integration: Core flow-bootstrap plan 36/36, override tests 46/46,
  change records and executor 316/316; this repository domain 613/613,
  test-runner 1092/1093 (the sanitizer test, then fixed and 1096/1096),
  scenario-lab 242/242, extension 652/652.
- Not verified: a created Flow that passes its goal -- `w2-live-creation-debug`
  is iterating on it live; the campaign has not been run.

### 2026-09-16 — Live creation targets the real element; back half designed
- Agent: supervisor; workers `w2-bootstrap-survives-and-resolves`,
  `w2-extension-selectors-and-bundle-guard`, `w2-back-half-design`.
- Changed: Core `6be4698` (creation iterates, fed-back plans, handle
  resolution call site, apply indexes Subflow graphs, token cap follows the
  grant; `service.ts` baseline 6434 -> 6422); this repository `f39499b`
  (unique selectors, a browser-bundle check in `pnpm check`, the web output
  bundle registers its parameter contracts).
- Validation: supervisor-run. Core creation tests `vitest run
  .../llm/harness-options .../llm/tests/unusable-decision.test.ts
  .../loop-limits .../flow-bootstrap/tests/generation-failure.test.ts
  .../tests/deepseek-bootstrap-exploration.test.ts .../tests/service-bootstrap`
  -> "Tests 194 passed (194)". Domain -> "# pass 577"; extension unit -> "#
  pass 649"; extension check exit 0. Live: `pnpm lab run instruction-only-form
  --live-llm --llm-task create-flow --instruction-task
  instruction-only-form-submit --llm-max-calls 26 ... --llm-max-run-tokens
  600000` with `FLUXIQ_CORE_ROOT` at a clean `6be4698` worktree ->
  `run-mu4t20d1-93b60760`: build `proposed`, one call, 3,924 in / 465 out,
  $0.00234036, one inspect; a 5-node Flow (one type, two clicks) whose type
  selector was the real `[data-testid="instruction-name"]` from its handle;
  the run then failed at that step, `web.target.not_found`, "scoring 0.17 with
  nothing the recording named agreeing"; redaction `passed`.
- Why it failed: the extension's resolver scores a target against a recorded
  node's identity, and a created node carries none. `w2-plan-handle-identity`
  fills it from the element the model was shown.
- Back half: `reports/w2-back-half-design.md` gives one pipeline for all three
  entry points (trial, verdict, save, apply, continue, replay, promote), 23
  briefs by file, and defects D-1 to D-6. Dispatched now: C-1+C-3, C-2, C-4,
  W-1, W-2, L-1 (L-6 folded into `w2-campaign-repair-tasks`).

### 2026-09-16 — First live repair applied and replayed without the model
- Agent: `w2-live-explore-create-repair` (live), reported to the supervisor;
  Core was `fcc5423` plus the private `applyFlowBootstrapAdaptation` index fix
  in an uncommitted worktree, so this result rests on that fix until it lands.
- What happened, on the demo pipeline's recording-derived Flow: the page
  drifted; DeepSeek diagnosed (3,205 tokens) and returned a patch (3,163
  tokens); Core resolved the target to a `target.N` handle; a proposal was
  created, reviewed, **applied**, and the Flow was **replayed without the
  model**. That is fail -> diagnose -> repair -> apply -> deterministic re-run,
  live, once.
- Then the whole lane in one invocation, 17:22, `pnpm demo:llm:adapt:focused`
  (same private Core): two DeepSeek calls (diagnosis 2,924 in / 407 out, patch
  3,016 / 229), approved, applied, post-apply validation succeeded, final
  replay `abf586e0` with **0 provider calls**, safety passed, leak attestation
  passed. An operator revert of an applied repair also worked (17:19).
- Validation: from the worker's report only; to be rerun by the supervisor on
  shared code once the index fix lands.
- Found: **silent loss of run audit.** After that apply and replay, and two
  Core restarts, both earlier runs' stored details lost `llmGate`,
  `runtimeAdaptationContext`, `trainingMode`, `runtimePatchAttempts` and
  `summary.tokenUsage`; the remaining shape equals a detail rebuilt from the
  raw session. Candidate: an unreadable run index treated as empty and every
  run re-saved. Assigned to `w2-run-detail-annotation-loss`.

### 2026-09-16 — Live Lab creation and live repair on a repairable drift
- Agent: supervisor, against a clean Core worktree at `59dbb22`
  (`FLUXIQ_CORE_ROOT=F:/fxlab/lab-core`, never committed).
- Why: the campaign's first live runs through the new Lab creation lane and
  on `identity-drift --variant renamed-redesign`.
- Validation: `pnpm lab run instruction-only-form --live-llm --llm-task
  create-flow --instruction-task instruction-only-form-submit
  --llm-max-output-tokens 4000 --llm-max-total-tokens 12000` ->
  `run-mu4rmgsm-5e9d930f`, one DeepSeek call, 3,822 in / 469 out, $0.00230076,
  build `failed`, `flow_bootstrap.evidence_completion_plan_invalid`, stage
  `provider_output_validation`, `evidenceLoop: null`, no issue codes;
  redaction `passed`. `pnpm lab run identity-drift --variant renamed-redesign
  --flow --live-llm --llm-task adapt ...` -> `run-mu4rpka7-845d919a`: a
  validated diagnosis and a validated `runtime_patch` reply proposing a
  `temporary_target_override`, refused at preflight with
  `runtime_patch.target_override_rejected`; no change proposal; redaction
  `passed`; `snapshots/live-llm.json` **not written** because the Flow lane
  threw first.
- Not verified: why the correct override was refused (the domain check accepts
  it when called directly) -- `w2-renamed-repair-rejected`; why the plan was
  invalid -- `w2-bootstrap-survives-and-resolves` now feeds invalid plans back
  to the model and records their issue codes.
- Also found and fixed by the supervisor: the extension build broke because
  `domain/src/output-nodes/extract-list/dispatch.ts` value-imported the whole
  `fluxiq/automation-studio` entry point, which reaches `node:crypto`; it now
  imports from `fluxiq/automation-studio/nodes`. `pnpm --filter
  @fluxiq-web-extension/extension test:e2e:build` -> exit 0.

Entries from the first live DeepSeek reply through the binding-contract
integration (2026-09-16, early) are archived in
[archive/ledger-2026-09-16-early.md](./mvp-week2-automation-loop-plan/archive/ledger-2026-09-16-early.md).

Entries dated 2026-09-15 and earlier are archived in
[archive/ledger-2026-09-15-and-earlier.md](./mvp-week2-automation-loop-plan/archive/ledger-2026-09-15-and-earlier.md).

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
