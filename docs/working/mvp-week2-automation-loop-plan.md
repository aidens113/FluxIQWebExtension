# MVP Week 2 Automation Loop Plan

Status: Active
Status detail: Executing 2026-09-20. Live creation, reduction, field entry, batch safety, real-panel creation/run, recording, and deterministic saved-Flow reuse are proven; repair/presentation and batch acceptance remain under live work.
Created: 2026-09-15
Last updated: 2026-09-20
Owner: Senior supervisor agent
Scope: Week 2 of the 30-day MVP, Phases 2.1-2.9: the automation loop (standardized adaptation context, diagnosis separated from exploration, bounded harness exploration, recovery success detection, converting exploration into reusable automation, validating, persisting, and resuming adaptations, and proving deterministic reuse), with Testing Lab verification. Phase 2.0, the data extraction foundation, lives in first-class-data-extraction-plan.md.
Paired document: `F:\!FluxIQ\docs\working\mvp-week2-automation-loop-plan.md`
Related: [30-Day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md) (Week 2), [Week 1 plan](./mvp-week1-web-automation-reliability-plan.md), [data extraction plan](./first-class-data-extraction-plan.md), [LLM production automation plan](./llm-production-automation-plan.md), [scoping 2.1-2.4](./mvp-week2-automation-loop-plan/reports/w2-scope-context-recovery.md), [scoping 2.5-2.9](./mvp-week2-automation-loop-plan/reports/w2-scope-repair-reuse.md)

---

## Current State

**Phase, as of 2026-09-17: the loop's parts are built and being repaired
against live evidence; the measurement is the next full campaign.** This is a
**flow-improvement loop with three entry points** — building a new flow, a run
failing, and an edge case in an existing flow — not a recovery loop. Entry
point three is not started. Two earlier scoping reports cover Phases 2.1-2.4
and 2.5-2.9 with file:line evidence. Path prefix: `AS/` is Core's
`packages/fluxiq/src/programs/automation-studio/`.

**Standing direction on what the model must emit (user, 2026-09-17):** make it
as easy as possible to produce — required fields carry intent, Core derives
versions, keys, edges, ids and defaults, and a reply is normalized before a
strict, fail-closed validation. Built as `w2-easy-model-output`.

**Give a worker its own worktree, not the shared tree.** `pnpm task start <slug>
--worktree --core` provisions an isolated pair in ~50s; a shared run reports
other workers' state. Run Core tests from inside `packages/fluxiq`, never the
repository root, or they take vitest's 5,000 ms default, not 15,000 ms.

**Phases SEC, G, T, P, D, H, S and 2.1-2.3 are built, supervisor-verified and
pushed in both repositories.** What each established is archived in
[archive/completed-phase-narrative.md](./mvp-week2-automation-loop-plan/archive/completed-phase-narrative.md);
the file:line evidence is in `reports/w2-a` through `w2-d` and the two scoping
reports. One finding from those investigations is still open: flow bootstrap
refuses any flow that is not blank, so the "improve an existing flow" entry
point cannot reuse it unchanged.

**Read live results call by call** from `snapshots/live-llm.json` and each
run's `evaluation.json`, never from the verdict: a run reporting `passed` while
its oracle says `failed` was the commonest defect found on 2026-09-17.

**Built and landed:** 2.4 resume point, two live fail-opens closed; 2.5
deterministic-path patch gated by a compile-checked record
(`runtime/service/adaptations/gates.ts`); Core's exploration-reduction seam;
2.6 replay recorder (t007); a run that refuses to continue
on `resumable: false` and resumes from the failed node (t006); fail-closed
result verification on `loop_verification`. Token limits derive from one
constant sized to the model's 64k context, in all ten places that held a copy.

**Landed and pushed 2026-09-18:** t010 in-place link clicks; t014/t023 the
redaction scan reads the run's own store at any size (no leak ever existed; the
check failed only runs that worked); t012 a created Flow's result is judged, and
an unjudged run reports `unverified`; t015 extraction mismatches recorded field
by field; t013 shared Core kept current, its web build cache outside
`node_modules` (inside it crashed 4/4 as an illegal instruction), repeats no
longer blamed on RAM; t019 save-and-replay; t022 a run names its own id first, so
a granted run is read back after a timeout (fixed a regression t012 caused);
t018 permission contract in Core, the instruction itself a grant; t020 routing
and subflows the model can author, with context; t016 created-Flow repair.

**Completed 2026-09-20:** t024 integrated t011's read-only reveal wording and
proved the schedule-post creation lane through a normal runtime-session return.
On its task branch, t025 ported t005's state digest onto current contracts and
proved it in Chromium: inspect, open the wrong disclosure, close it, open the
right disclosure; Core reported an intact state chain and reduced the four
steps to the one replayable press. t021's multi-action work remains stale;
reconcile it only after field entry and truthful `targetsUnchanged` evidence.

**In progress 2026-09-20 (t027):** t026 is integrated. Chromium A/B reduced
six actions from six decisions to three; all five focused batch-safety rows
passed. Matching real-provider baseline and batching runs both created and
passed the same nine-action Flow oracle. New sanitized telemetry proved two
later provider runs chose zero batches, so adoption remains open; the failed
wording experiment was excluded. Panel storage initialization and autofill
repairs and bounded host-state playback are integrated on t027. The real panel now completes instruction, high-token confirmation, one-call provider proposal, visible Audit/approve/apply, and a 4/4-action passing oracle; warm request-to-proposal was 11.6 seconds. The production panel plus loaded extension also passes recording through generated Subflow and rendered-layout validation in 18.9 seconds; two separate runtime/browser lifetimes replayed the exact saved graph with zero LLM activity. Removing redundant Lab screenshots around Core snapshots reduced its measured runtime step from 15.8 to 14.8 seconds without weakening state capture. Explicit safe adoption of a marker-less v2 root is merged and pushed on t028, but applying it to the user's root still requires an approved stop, private backup, hash check, and restart. Concurrent work is specified in
[the live-testing plan](./mvp-week2-automation-loop-plan/reports/w2-concurrent-live-testing-plan.md):
same-code configuration, isolated worktrees/services/profiles/stores, at most
two provider lanes, a panel UI lane, supervisor evidence barriers, and unit /
full gates only after live behavior passes.

**Open, for the next session, in priority order:**
1. Finish t027 panel evidence binding, bounded playback, recording/reuse,
   and a real-provider completed batch; then close the golden path and integrate.
2. The model result check disagrees with itself on identical input at
   temperature 0. Designed fix (t022 report): a single "does not answer" triggers
   one repeat; disagreement records `unverified`, never pass or fail.
3. Repair editing structure (t020 piece 3): repair returns a revised Flow script,
   Core shows the person a DIFF; closes "a Flow missing a step can only be
   declined". Designed in `reports/w2-routing-and-subflows.md`, not built.
4. Recovery path does not yet receive the permitted set (t018 report).
5. Under `explore_and_adapt`, a repair needing a side effect is dropped rather
   than proposed (`recovery/annotation/patches.ts:142`); it should become a
   permission request.
6. Core stores each action's full page snapshot 4-5 times in one session
   document rewritten every step (85.5 MiB stores; t023 report).
7. Core's `targetResolution: unresolved_no_candidates` is a constant on every web
   action and is fed to the repair model as `failed_target` (t017 report: fix at
   `io-policy.ts:242`, then lift the browser's real resolution in
   `conversions.ts`).
8. The model can mark every extract field optional and disarm Core's
   required-field check (`record-output.ts:73`); an empty cell reads `""` not
   missing (the 5 wrong company rows).
9. A structure-audit rule: this repository may import, never define, Core's
   `AutomationStudio*` names. The test-runner build never clears stale `dist`,
   so moved tests keep running (hit twice).
10. Batching follow-ups (t021): a fill-field exploration tool, the domain sending
    `targetsUnchanged`, then reconcile optional multi-action output onto current
    `dev` and run a fair live before/after.
**Not started:** 2.9, X6, the third entry point (improving an existing Flow).

**The fixed call limit was the defect, not a constraint to design around (user
decision, 2026-09-16).** An adaptation iterates while it is making progress and
stops on a guard that means something: the per-run cost ceiling, the token
budget, the recovery deadline, or a no-progress guard. A call ceiling survives
only as a far-away, configurable backstop, never a per-mode constant; starving
the loop of calls is not how cost is controlled. The generalizable lesson: when
a designed-in limit keeps generating blockers, the limit is the defect — report
it as such instead of engineering workarounds inside it.

**Live-testing campaign (user direction, 2026-09-16):** "get to a point where
we have at least basic automation able to be created & repaired by simply
pointing the instructions at a demo, and having it explore and auto-create
flows", across "lots of different demos". **Runs serving that goal need no
per-run approval**, reinforced 2026-09-17. The 2026-09-17 push hold is
discharged; its policy is `agent-git-workflow-plan.md`, built and pushed.

**Live first, one problem at a time (user, 2026-09-18).** "LIVE TESTING FIRST,
unit tests absolute last after you think everything is working properly", and
fix one problem at a time rather than "running the entire suite every single
time you make a change". A brief therefore orders the work: reproduce with one
live task, change the code, re-run that same task live until it is right, then
run unit tests, `pnpm check` and the suites as a regression net. The corpus
measures where the product stands when a fix is believed finished; it is never
the development loop.

**Reaffirmed by the user, 2026-09-20.** Resume t011 from its preserved
worktree. Live reproduction and same-scenario reruns come before unit tests;
do not run the full suite after each change. The first target remains the
schedule-post permission mismatch, followed by the created-lane timeout only
after that scenario behaves correctly.

**Live integration direction, 2026-09-20.** Add t021's optional multi-action
exploration output to live testing after t011's permission path works, along
with the missing field-entry option and `targetsUnchanged` signal needed for a
fair measurement. Audit every other open task branch against `dev`; bring only
coherent, still-needed work into the live sequence, with its own focused proof.

**Next steps:** add field entry and `targetsUnchanged`; reconcile t021's
optional multi-action output and exercise it live; then use the corpus as the
Week 2 measurement.

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

Dispatched briefs whose work has landed are archived in
[archive/settled-worker-briefs.md](./mvp-week2-automation-loop-plan/archive/settled-worker-briefs.md).
Current briefs live in the reports named by the Work Ledger.

### Brief: w2-t011-live-permission-resume
- Repository: this repository, with read-only inspection of FluxIQ Core
- Task: resume t011 by reproducing `schedule-post` live, then make the smallest
  browser-domain prompt/contract change needed so opening/showing/ticking a
  control declares `[]`; rerun the same live scenario until its next real
  blocker is established. Do not start with unit tests or run the corpus.
- Required reads: this document's Current State; `reports/w2-reveal-not-commit.md`;
  `domain/src/runtime/llm-evidence/harness-options/{exploration-terms,vocabulary}.ts`;
  `domain/src/runtime/llm-evidence/{permission,press}.ts`; the live instruction
  and Lab command paths already named by the report
- Owns (may edit): the t011 worktree's browser-domain files listed above and
  `domain/src/runtime/llm-evidence/tools.ts`,
  `domain/src/runtime/llm-evidence/harness-options/options.ts`, and
  `reports/w2-t011-live-permission-resume.md`
- Must not touch: FluxIQ Core source; shared `dev` checkout; other reports;
  tests until the live scenario behaves correctly; commits or pushes
- Definition of done: one pre-change live run inspected call-by-call; smallest
  focused change; same live scenario rerun and inspected; narrow tests only
  after live success or a precisely evidenced next blocker
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t011-live-permission-resume.md`

### Brief: w2-t011-core-permission-seams
- Repository: FluxIQ Core, read-only
- Task: trace the existing instruction-derived permission comparison and the
  plan-node handle parser to identify the smallest domain-neutral changes for
  consequence reconciliation and Flow-step declarations. Do not implement,
  build, or test while the live baseline is still running.
- Required reads: downstream Current State and `reports/{w2-permission-request,w2-reveal-not-commit}.md`;
  Core `runtime/action-permissions/`; `runtime/llm/harness-options/plan-node-handles.ts`;
  the immediate callers that consume parsed plan handles
- Owns (may edit): only
  `reports/w2-t011-core-permission-seams.md` in the t011 extension worktree
- Must not touch: any Core source, any other report, either working document,
  test files, commits or pushes
- Definition of done: exact data-flow and file:line evidence; proposed minimal
  compatibility behavior; risks and one focused live proof for each seam
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t011-core-permission-seams.md`

### Brief: w2-open-branch-live-audit
- Repository: this repository; paired Core branches read-only where present
- Task: audit every open task branch against current `dev`, its existing report,
  and current landed code. Identify which unmerged changes are still needed for
  live Week 2 testing, which are already superseded, and which must remain held.
- Required reads: this document's Current State; `pnpm task list`; each open
  branch's commits/diff stat; only the report directly associated with that task
- Owns (may edit): only
  `reports/w2-open-branch-live-audit.md` in the shared `dev` checkout
- Must not touch: source, tests, other reports or working documents, task
  branches/worktrees, Core source, commits or pushes
- Definition of done: one evidence-backed row per open branch with disposition
  `integrate-live`, `superseded/close`, or `hold`, dependencies, overlap risks,
  and the narrow first live proof; explicitly assess t021 batching
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-open-branch-live-audit.md`

### Brief: w2-t011-created-run-timeout
- Repository: this repository and FluxIQ Core, read-only
- Task: diagnose why live run `run-mua7yzln-7c8d0a9d` still exhausted the
  granted-run read-back window despite t022's `newRunId` path. Inspect the run
  bundle call-by-call and the current request/read-back implementation; do not
  expose page data or secrets and do not implement yet.
- Required reads: this document's Current State; `reports/w2-run-timeout.md`;
  the run's `evaluation.json`, `snapshots/live-llm.json`, and bounded lifecycle
  events; `flow-lane/{persisted-flow-run,creation/lane}.ts`; Core requested-run
  id and runtime-session/result-verification paths
- Owns (may edit): only `reports/w2-t011-created-run-timeout.md` in the t011
  extension worktree
- Must not touch: source, tests, other reports/working docs, commits or pushes
- Definition of done: exact failed stage and timeline, whether the named run
  exists and its terminal/verdict state, root cause with file:line evidence,
  smallest fix location, and one focused live rerun command
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t011-created-run-timeout.md`

### Brief: w2-t011-missing-result-verification
- Repository: this repository and FluxIQ Core, read-only
- Task: diagnose live run `run-mua8g4li-6a746736`, whose named playback is
  durably `succeeded` with 9/9 actions but no result-verification record while
  the runner waits. Determine why the verification call was skipped or stuck.
- Required reads: the bounded run bundle/project status; t012/t022 reports;
  current execution-grant issuance, `result-verification/`, runtime-session
  completion, and downstream settlement/read-back paths
- Owns (may edit): only `reports/w2-t011-missing-result-verification.md` in the
  t011 extension worktree
- Must not touch: source, tests, other reports/working docs, commits or pushes
- Definition of done: exact gate/call state with file:line evidence, smallest
  coherent fix, and the same single-scenario live proof; no secret/page output
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t011-missing-result-verification.md`

### Brief: w2-t024-project-database-lifetime
- Repository: paired task t024, FluxIQ Core implementation with downstream live proof
- Task: make the smallest coherent project-database pool lifetime change that
  prevents a durable run-detail save from stalling during close/reopen races;
  then rerun only `social-scheduler-schedule-post` live. Do not begin with tests.
- Required reads: this document's Current State;
  `reports/w2-t011-missing-result-verification.md`; Core
  `storage/project/database.ts`, its direct pool users, and only its focused test
- Owns (may edit): Core `packages/fluxiq/src/programs/automation-studio/storage/project/database.ts`,
  temporary env-gated stage markers in Core `runtime/service.ts` and
  `runtime/result-verification/run-outcome.ts` (removed before handoff), its
  directly owned focused test if live behavior succeeds, and downstream
  `reports/w2-t024-project-database-lifetime.md`
- Must not touch: other Core/extension source, existing reports/working docs,
  task t011, commits or pushes; no corpus or full suite
- Definition of done: fix pool lifetime; same live scenario reaches terminal
  playback plus durable `resultVerification.status: no_result` and fixture
  oracle, or records the next precise blocker; only then run the narrowest
  pool/type check
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t024-project-database-lifetime.md`

### Brief: w2-t024-post-success-await-trace
- Repository: paired task t024, both sides read-only
- Task: while the current t024 schedule-post run remains live, trace the exact
  unresolved await after its 9/9 successful playback. Distinguish run-detail
  save, store release, session write, dataset listing, and verification entry
  using closed lifecycle/SQLite/process evidence; reassess the pool hypothesis.
- Required reads: Current State; t024 pool brief and t011 missing-verification
  report; Core service post-success path, typed run-detail writer/repository,
  database pool, result-verification ports; bounded live run state
- Owns (may edit): only `reports/w2-t024-post-success-await-trace.md` in the
  t024 extension worktree
- Must not touch: source, tests, other reports/working docs, processes, commits
  or pushes; no page data, secrets, build, unit suite, or new live run
- Definition of done: name the exact unresolved promise or narrow it to the
  smallest instrumentable boundary, explain why the first fix failed, and give
  the next one-change live experiment
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t024-post-success-await-trace.md`

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

### 2026-09-20 — Live field entry and unchanged-target contract (t026)
- Agent: supervisor, paired Core/downstream task.
- Live first: the focused Chromium content-harness scenario opened the real
  social-scheduler composer and entered its textarea, select, date, and time.
  The modal-opening press reported unstable targets; every subsequent field
  entry reported stable targets and the entered text/date/time stayed withheld
  from their field evidence.
- Changed: one inferred `enter_field` option now dispatches `web.dom.type` or
  `web.dom.select`; Core accepts the optional `targetsUnchanged` result member;
  authoring computes it from same-location handle-to-selector continuity.
  Recovery emits `false` because its captures do not yet use stable handles.
- Validation: `pnpm --filter @fluxiq-web-extension/extension test:content --
  exploration-state/tests/field-entry-target-stability.spec.ts --workers=1`
  printed 1 passed; `pnpm --filter @fluxiq-web-extension/domain check` passed;
  the isolated target-stability unit printed 3/3 passed; Core's focused
  evidence-loop unit printed 23/23 passed; and the serial downstream domain
  suite printed 690/690 passed. Integration gates remain before merge.
- Evidence: `reports/w2-t026-field-entry-target-stability.md`.
- Follow-up: port current t021 batching semantics onto current Core, then run a
  same-code single-action baseline and multi-action live comparison.

### 2026-09-20 — Live exploration state reduction works in Chromium
- Agents: supervisor. Ported t005's one downstream commit onto current `dev`
  as t025 and reconciled the added `repeats` evidence field plus the explicit
  permission slot required by the current request contract.
- Live first: a focused content-harness run used the real Chromium DOM and
  content-script action/capture path while scripting only provider decisions.
  It inspected the page, opened and closed a wrong disclosure, opened the right
  disclosure, and completed with four recorded steps, no digest failures, an
  intact state chain, and one replayable reduced press. The wrong panel was
  closed and the right panel visible at the end.
- Validation: `pnpm --filter @fluxiq-web-extension/extension test:content --
  exploration-state/tests/live-state-digest.spec.ts --workers=1` -> 1 passed;
  only afterwards,
  domain and extension checks passed and the isolated state-digest unit file
  passed 7/7. No full suite was run during iteration.
- Outcome: Accepted for task integration. Detailed evidence is in
  `reports/w2-t025-live-state-digest.md`.
- Follow-up: field entry, truthful `targetsUnchanged`, then t021 batching live.

### 2026-09-20 — Live creation returns; empty dataset shells no longer deadlock verification
- Agents: supervisor, `w2-t011-live-permission-resume`,
  `w2-t024-project-database-lifetime`, and focused read-only trace workers.
- Why: the schedule-post Flow played back successfully but the Lab timed out
  waiting for the created runtime session, so no later live campaign could be
  trusted. The user required same-scenario live iteration before unit suites.
- Found: the action Flow creates one dataset catalog row with zero stored and
  zero refused rows. Verification used dataset-count presence to enter provider
  resolution, revalidating the already-used execution grant and never
  returning. A first database-pool hypothesis was falsified live. Several
  reruns also exposed stale Next artifacts; the decisive run used a fresh cache
  whose source maps contained the new predicates and none of the old gate.
- Changed: read-only reveal presses are described as declaring no consequences;
  result verification uses total stored rows for its provider-free branch, and
  records `no_result` only when both stored and refused row counts are zero.
  All-refused output remains a deterministic Core failure.
- Validation: live `run-muabdpmu-6c1f639d` returned normally in 160,663 ms,
  performed 9 actions, used 3 creation calls and 0 recovery calls, skipped
  instruction/provider resolution after summarizing one empty dataset shell,
  persisted `resultVerification: "no_result"`, and completed both runtime and
  run-detail writes. `pnpm --filter fluxiq build` then passed after temporary
  tracing was removed. No unit or full suite was run during the live loop.
- Outcome: Accepted for integration.
- Follow-up: port t005, then field entry plus `targetsUnchanged`, then reconcile
  and live-test optional multi-action exploration output from t021.

### 2026-09-18 — Save, replay, route and repair, with no model in the replay
- Agents: supervisor, plus t013, t015, t016, t018, t019, t020, t022, t023
  landed; t011 held for the permission seam; t021 built and not landed.
- Why: the user set the measure of success — a created Flow replayed with no
  model and producing the right answer — and asked that the model route, create
  and edit subflows with context, that FluxIQ ask for permission rather than
  refuse, and that live testing come first.
- Found: no Flow from any campaign could ever have been replayed (the isolated
  target deleted it, the persistent one refused to run it, and a saved navigate
  step pointed at a port that moved every run); model-written route rules had no
  condition, so the first always won, and the router read page state from inputs
  no real run passes; created Flows were never repaired because Core dropped the
  requested intervention mode and the Lab played them back with no grant; t012's
  verification call pushed runs past a 30-second request and lost their result.
- Integration, by the supervisor: resolved conflicts in `service.ts` (routing
  wraps the decision, permissions wrap tool execution, both kept),
  `evaluation-validation.ts`, and t019's replay against t013's moved build cache;
  fixed Core's purpose-count test and the repair lane's fake Core for t022.
  Merged the Core half of t016 before its downstream half had passed, by chaining
  with `;`; caught it, rebuilt, re-merged, pushed nothing in between.
- Validation: `pnpm lab replay social-scheduler --workspace t019-replay --flow
  flow.c1542a11-...` with no provider variable set -> passed, 14/14, 0 calls,
  dataset sha256 `23782055ca89...` identical to four earlier replays;
  `pnpm lab replay ... --flow flow.9c8f4386-...` on two renderings -> 14/14 each,
  different routes, 0 calls (t020); live `run-mu7gjreo` and `run-mu7hke99` ->
  override proposed, proposal `pending`, adaptation `draft` (t016);
  `social-scheduler-week-ahead` after t022 -> passed 14/14, verdict `confirmed`;
  every merge ran `pnpm check` -> passed in both repositories; `pnpm --filter
  @fluxiq-web-extension/test-runner test` after a clean `dist` -> 1189/1189.
- Not verified: approving and applying a repair then replaying it; the recovery
  path's permission wiring; any web UI; a full corpus since these fixes.

### 2026-09-18 — The instruments were lying: clicks, the security check, and success itself
- Agents: supervisor, plus `t010` click-landing-in-place, `t014` unscanned-store,
  `t012` result-required-fields, with `t011`, `t013`, `t015`, `t016`, `t017` in
  flight at the time of writing.
- Why: the first full live corpus scored 4 of 36, and the reports behind it were
  full of findings marked "inferred, not observed". Several of the day's
  blockers turned out to be FluxIQ's own instruments reporting something untrue,
  not the product failing.
- **A link click is judged by what the page did (t010, merged `d697f3f`).** The
  company-directory sector links carry an `href` whose navigation the page
  cancels, loading rows in place as most modern sites do, and every one of the
  four built Flows was failed at its first click with `output_not_observed`. A
  click now passes on a navigation, a history-API address change, or content
  changing in the way the click implies, and a click that changed nothing still
  fails. Validation: live, real DeepSeek, `company-directory-no-companies`
  **passed** and `logistics-sector` narrowed 320 rows to exactly 40; then
  extension 686/686, content harness 303/303, `pnpm check` exit 0.
- **The security check was refusing the run's own store (t014, merged
  `ab98466`).** `.fluxiq/global.sqlite` is 10.02 MiB against an 8 MiB per-file
  text budget, so it was never read and was reported as `unscanned-store`. There
  was no leak: the declared literal is the real provider key and it is absent
  from the store by a raw byte search in three encodings and a cell-by-cell read.
  The check failed loudest exactly where the product worked, because only runs
  that built a Flow and extracted records crossed 8 MiB. A store now has its own
  ceiling, still fails closed past it, and a planted secret in an uncheckpointed
  write-ahead log is still found. Validation: live before `failed
  security.redaction`, after **passed, 0 findings**, 19 files / 13,297,679 B,
  extraction 14/14 records and 56/56 fields; test-runner 1143/1143; `pnpm check`
  exit 0. The blanket "ignore binary stores" non-fix was applied as a mutation
  and four tests failed.
- **Success is no longer reported over wrong results (t012).** Result
  verification returned `performed: false` whenever playback had no provider,
  and a created Flow's playback has none, so the check built for this never ran.
  A created Flow's run now obtains a verdict, and a run nobody judged reports
  `unverified` — in the denominator, a hit in neither column, so it cannot
  become a false success. Validation: live, baseline `run-mu7c7df9` reported
  `passed` against an oracle `failed`; after, two runs report `failed` with
  `resultVerification: "refuted"` on identical output (10 records, 0 matched).
  Core result-verification 48/48, llm 347/347, `tsc --noEmit` exit 0.
- **The brief's premise was wrong and the worker checked it.** These runs were
  described as returning rows with required fields empty. They were not:
  `invalidRows: 0`, `totalRowsMissingRequired: 0`. The rows were the right
  count and shape with wrong values. The deterministic required-field check is a
  fail-closed backstop that caught nothing today.
- **Open, found by that work:** the model writes the Flow and the Flow declares
  which fields are required (`domain/src/output-nodes/extract-list/record-output.ts:73`,
  `required: spec?.required !== false`), so a model that marks every field
  optional disarms Core's free check. Core may only hold a Flow to what it
  declares, so the weakness is in the extraction authoring contract here.
- **Environment, three causes of a week of misattributed failures.** The shared
  Core at `F:xwork\!FluxIQ` sat eleven commits behind Core `dev` and had only
  its library built, not the web panel, so sibling worktrees raced to build it.
  And Windows MAX_PATH breaks Core's web-panel build when run artifacts sit
  inside a worktree: the slug `t015-extraction-mismatch-detail` is three
  characters longer than `t010-click-landing-in-place`, which was itself within
  three characters of the limit. All of it surfaced as "Core web panel
  production build did not succeed". Workaround in use:
  `FLUXIQ_TEST_RUNS_DIR='F:
15'`. Owned by t013.
- Validation: `pnpm lab:campaign company-directory-logistics-sector company-directory-no-companies`
  (live, isolated) -> `no-companies` **passed**, `logistics-sector` 40 of 40
  observed and 35 matched; `pnpm --filter @fluxiq-web-extension/extension test`
  -> 686/686; `test:content` -> 303 passed; `pnpm task finish t010` and
  `pnpm task finish t014` each ran `pnpm check` -> passed. `pnpm --filter
  @fluxiq-web-extension/test-runner test` -> 1143/1143. `pnpm lab:campaign
  social-scheduler-week-ahead` before -> `failed security.redaction`, after ->
  **passed, 0 findings**. `pnpm lab:campaign property-listings-newest-homes`
  before -> reported `passed` / oracle `failed`, after -> reported `failed`
  twice. `pnpm check` in `F:xwork	012\!FluxIQWebExtension` -> exit 0.
  `npx vitest run .../modes.test.ts .../scale-pages.test.ts` alone -> 7/7 in 43 s.
- **Not the RAM fault:** Core's `service-flows/tests/scale-pages.test.ts` takes
  14,515 ms against the configured 15,000 ms timeout, a 485 ms margin, so it
  fails under any concurrent load. It and `service-adaptation/tests/modes.test.ts`
  pass alone, 7/7 in 43 s.

### 2026-09-18 — First full live corpus run on the realistic fixtures
- Agent: supervisor, four live campaign workers
- Changed: reports only (`reports/w2-corpus-a.md` to `-d.md`)
- Why: the three tasks proven after creation learned to act were the only
  evidence; this measured the other thirty-six.
- Validation: real DeepSeek, isolated target, each slice probed first. A 1/9,
  B 0/9, C 1/8, D 2/10. Reported and oracle verdicts agreed on every directory
  run and disagreed on seven runs elsewhere, all reporting `passed`. No
  `ENOENT` races once Core was rebuilt; `--no-build` fails on a fresh Lab
  instance, and a stale Core build stopped the first dispatch through the guard
  built for it.
- Outcome: Accepted as measurement
- Follow-up: t009 to t012, and the unowned items in Current State.

### 2026-09-17 — Phase 2.4 built, two live fail-opens closed, 2.5 built unwired
- Agent: supervisor, tasks t003 and t004, five workers
- Changed: Core `runtime/flow-change/{resume,verdict,trial,contracts,index}.ts`,
  `runtime/service/adaptations/{gates,durable,patches}.ts`,
  `runtime/exploration-reduction/`, `runtime/training-modes.ts`,
  `storage/project/adaptation-store.ts`, `model/{flow-adaptation,validation}`;
  here `domain/src/runtime/expectation/{conditions,evaluate}.ts`
- Why: the briefs were drawn from scoping reports describing Core at `ee25ac9`,
  and two of the five defects they named were already fixed. Verifying that
  turned up a worse one underneath, live on both sides: nothing judged returned
  `{passed: true, checkedConditionCount: 0}`, Core read only `passed`, and a
  recovery with unlooked-at evidence came out verified and resumable. The
  browser half answered "the banner is gone" from an `absent` check with no
  selector to query. Separately, `insert_deterministic_path` inserted executable
  nodes while passing none of the three review gates, because each gate kept a
  hand-written list of kinds and a new kind defaulted to ungated.
- Validation: Core `pnpm task finish t004` -> `pnpm check` passed; flow-change
  and live-patch 148/148; subflow, training-modes and adaptations 21/21; here
  `pnpm check` exit 0 and domain tests 675/675. Mutations, each applied and
  reverted: unknown-check resumable -> 12 failed; resumeFrom only on verified ->
  6 failed; drop the subflow -> 2 failed; revert the judged guard -> 2 failed;
  insert without the entry edge -> the apply is refused, and without the guard
  too the next run fails because the node becomes a second root; keep
  observation-only steps -> 2 failed; latest-moment instead of earliest -> 9
  failed including the canonical reduction.
- Outcome: Accepted
- Follow-up: a caller that honours `resumable`; t005 for the state digest.

### 2026-09-17 — A Flow is written as plain lines, and the day's work is committed
- Agent: `w2-easy-model-output` (Core `1be6c9e`), plus the supervisor's
  integration of the web-side batch (`4f4efde`, `0578da7`, `2991188`).
- Building a Flow meant 48 required keys across 17 nested objects (1,110
  bytes for "type a name, press submit"); it is now 8 lines and 344 bytes.
  Core derives the schema version, keys, ids, versions, the output action,
  the edges between consecutive steps, the dataset id, the record schema and
  path, and writes a declared default onto the created node. `step <label>:`
  names a step, `on <port>: go to <label>` branches, `subflow <label>: … end`
  is a named block; `run subflow` had to become a Router rule, because the
  plan contract has no subflow-call node (open question for the user). The
  nested plan is still accepted. The reply stays a JSON envelope whose
  `result` is one string, so the only escape left is a line break.
- Validation: in `F:/fxlab/verify-core` at `25bea03` plus only these files,
  `npx tsc --noEmit -p packages/fluxiq` exit 0, `structure-audit` passed
  (159 warnings, 361 baselined), and `vitest` over flow-bootstrap, llm,
  service-adaptation and recovery from inside `packages/fluxiq` -> "71
  passed", "871 passed". The web-side batch was verified in
  `F:/fxlab/verify-ext` against a Core built from committed code only:
  domain check exit 0, "# pass 663", extension "# pass 678", test-runner
  "1141 passed", lab "# pass 74", audit passed.
- Found by that batch check, and fixed: `domain/src/tests/domain.test.ts`
  called Core's harness without declaring this domain's denied evidence keys,
  and addressed its fixture elements by `selector`, which Core now refuses to
  carry. The fixture addresses elements by handle, as a real packet does.
  Also `llm-diagnosis.test.ts` expected the old 2,400-byte failure share; the
  intended value is 3,000.
- State at the pause: both repositories clean, both audits pass, **nothing
  pushed** — Core 29 and this repository 40 commits ahead of `origin/dev`.
  Verification worktrees are set up and reusable: `F:/fxlab/verify-core` and
  `F:/fxlab/verify-ext`, whose `node_modules` are junctions to the main
  checkouts except `domain/node_modules/fluxiq`, which points at
  `verify-core` so the domain compiles against committed Core only.

### 2026-09-17 — The loop may decline, a repair may look, and a step refuses the wrong record
- Agents: `w2-repair-refuses` (Core `a830217`), `w2-repair-sees-more` (Core
  `833aa3c`), `w2-wrong-row-acted-on` (`3ee5e1d` + follow-up), L-2
  (`0088ac2`), `w2-declared-failure-verdict`, `w2-core-stays-domain-neutral`
  (Core `25bea03`, here `69e2434`), `w2-xpath-id-anchor` (`f92ae0d`).
- A repair reply may now be a `no_repair` with one of five named reasons, and
  both prompts say declining is allowed; no call is spent when the plan
  allows no override or candidates tie; a refusal may follow exploration; no
  substitution of the one compatible element. A repair is offered every
  observation that changes nothing (three, not two) and the rest only under a
  policy that allows side effects; it carries the diagnosis it just made; the
  failure page's budget doubles to 6,000 bytes, paid for by explored packets;
  every string in a recovery context is screened for locator-shaped text.
- A recorded step now carries which record its control sat in and refuses a
  control found in another: the member-directory Flow promoted a different
  member and reported success (`run-mu4yrwgj-02fe85f7`), and now fails with
  `target_not_found` (`run-mu5vfd6o-d98abd77`). An applied repair kept that
  protection only after the follow-up: a repair may rename a control, never
  say which record it belongs to. Core's generic `entityId` was measured as
  the alternative and rejected — it is scored, costing 0.303 against a 0.35
  floor and separating right from wrong record by 0.057 against a 0.2 margin.
- Validation: each change alone in `F:/fxlab/verify-core` or
  `F:/fxlab/verify-ext`. Refusal: `tsc` exit 0, "696 passed" (49 files).
  Repair evidence: `tsc` exit 0, "668 passed" (51 files). Wrong row:
  extension "# pass 676", audit passed. Lab lane: runner "1133 passed",
  contracts "113", lab "73". Boundary rule: `pnpm structure:test` "# pass
  182" in both, `--rule web-vocabulary` passed with 7 baselined entries, and
  a probe adding `cssSelector` failed the build and was refused a baseline.
- Standing direction recorded above: what the model emits must be easy to
  produce, and a large reply is asked for as a line format, not JSON.
  `w2-easy-model-output` is building it; branching is by named step and
  `on <port>: go to <label>`, subflows as named blocks, sequence otherwise.
- Open, with owners: two domain test rows still refuse with
  `recorded_target_unknown` (back with the refusal worker); the three ordering
  assertions share `action.dispatch`, so a Flow that starts at the wrong step
  and then hits its declared failure would pass; `targets.ts` is 420 lines
  and its own barrel prescribes the split; `sanitize.ts` can still trim the
  failed element's own row.

### 2026-09-17 — The model could not refuse: the loop's shape, not the context
- Agent: `w2-model-context-audit` (investigation; report
  `reports/w2-model-context-audit.md`), prompted by the user asking whether
  the model gets appropriate page context and the ability to explore.
- Validation: ten fixture pages captured through this repository's own
  content harness in headless Chromium, then through the real domain
  sanitizer and Core's annotation, with the request bodies compared
  byte-for-byte against the live campaign's own packets: product-catalog
  5,848 = 5,848, infinite-feed 5,030 = 5,030, navigation 792 = 792,
  identity-drift 3,382 vs 3,380.
- The page context was sufficient in four of the six refusal tasks; the
  deletion notice and "Page not found" do reach the model. What forced a
  substitute target: under `diagnose_and_adapt` the structured schema is
  `patches` minItems 1, maxItems 1, a target override with at least one
  handle, so **no schema-valid refusal exists**. The only refusal switch is
  `stillAchievable: "no"` at the diagnosis, which no prompt mentions and
  which `recovery/plan.ts:106` makes cancel exploration, so "look first, then
  refuse" is impossible. Core already skips a patch call that could only
  return a substitute (`annotation/annotate.ts:245-251`), but not for these
  classes.
- Also measured: a repair is offered 2 of the 6 declared exploration tools
  (`harness-options/registry.ts:248-253` withholds mutating ones; creation
  passes `allowSideEffectsWithoutPolicy` at `service.ts:1910`); the patch
  request omits the diagnosis just made; the 3,000-byte failure budget
  strips every price and rating from product-catalog and all 240 rows from
  member-directory; and `recoveryContext.failure.expected` carries a raw CSS
  selector and page text to the model although `recovery/context.ts:270-273`
  says it does not.
- Dispatched: the refusal worker redirected onto the loop shape (a
  `no_repair` branch, a sentence that says refusing is allowed, the extended
  skip, refusal after exploration); `w2-repair-sees-more` for the tool
  parity, the carried diagnosis, the evidence budget and the selector leak.

### 2026-09-17 — The build keeps going, evidence is screened, and the judge reads a URL
- Agents: `w2-creation-loop-keeps-going` (Core `ab2583c`), `w2-c7b-evidence-protection`
  (Core `b0f1407`), W-3a (`5e583ef`), `w2-judge-same-origin-urls` (`5ec0016`),
  `w2-campaign-tasks-start` (`a56529e`). Claude crashed twice; every worker was
  resumed from its transcript with its uncommitted work intact.
- Creation: a repeated tool request is answered from the earlier result and a
  reused call id gets Core's own, so a build ends only after three steps with
  nothing new; a refused plan whose issue set changed counts as progress
  (backstop twelve); each issue now carries the shape its parameter accepts;
  plan validation reads a record output with the parser that node runs.
- Evidence: the provider re-checks a patch's explored packets before sending
  (`llm.provider_exploration_evidence_invalid`, ends the grant), and every
  request carrying exploration evidence is held to the domain's denied keys
  and the credential screen. Repairs may scan page structure, and retained
  selector hints are keyed by element identity, with failure packets never
  evicted by exploration.
- Lab: an expected root-relative URL is resolved against the run's scenario
  origin (product-catalog-first-page 0/8 -> 8/8 on the real task's data);
  campaign tasks take declared secrets from their scenario's own fixture; a
  pre-bundle refusal carries the runner's reason, bounded and redacted.
- Validation: each change alone in a clean worktree with the main checkout's
  `node_modules` joined in. Core `F:/fxlab/verify-core` -> `tsc` exit 0 and
  `vitest --no-file-parallelism` "792 passed" (creation), "812 passed"
  (evidence); this repository `F:/fxlab/verify-ext` -> domain "# pass 636"
  (W-3a), and with the Lab changes "# pass 1102" (test-runner), "# pass 73"
  (lab), "# pass 242" (scenario-lab), audit passed. Service tests time out at
  5 s when run in parallel under load; serial runs are clean.
- Cause found for the "timed out in 5000ms" service-test failures everyone
  has been rerunning: `packages/fluxiq/vitest.config.ts` sets
  `testTimeout: 15_000`, but `npx vitest run <paths>` from Core's repository
  root never loads it, so those runs used vitest's 5,000 ms default. Run
  Core tests from inside `packages/fluxiq`, or pass `--config`. The full
  suite at `9d7cc24` was "4 failed / 2007 passed" that way and the four pass
  together alone (11/11). The machine's memory fault is still real; this was
  not it.
- Hazard, recorded: this repository's domain tests resolve `fluxiq` to Core's
  built `dist` in the main checkout, so a worker rebuilding Core there puts
  its in-flight code into everyone's runs. Three `repair-proposal` failures
  on 2026-09-17 came from that, not from the change under test (proven by
  running the same tests with the change reverted). Before the final checks
  and the next campaign, rebuild Core's `dist` from the committed tree.
- Found and fixed: `demo-workspace/tests/adaptation-lane.test.ts` scanned its
  subject's source for a bare newline, so a fresh Windows checkout failed it
  (second line-ending defect today's worktrees exposed).
- Found, being worked: the member-directory Flow whose recorded member has
  left **promoted a different member and reported success**, so no model was
  ever consulted (`w2-wrong-row-acted-on` dispatched). Decisions taken: a
  declared secret too short to scan (an expiry, a PIN) is recorded unattested
  with its reason when it comes from a scenario fixture, and refused when the
  machine supplied it; the card-secret refusal task needs reshaping into a
  Flow that builds and whose run is refused.

Entries dated 2026-09-16 are archived in
[archive/ledger-2026-09-16.md](./mvp-week2-automation-loop-plan/archive/ledger-2026-09-16.md),
and the earliest of that day in
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
