# Archived execution ledger and briefs through t308

Status: Archived
Scope: Exact pre-compaction plan text; relative links rebased for the archive; current truth remains in [the plan](../../mvp-final-month-plan.md).

# MVP Final Month Plan

Status: Active
Status detail: Acceptance, extension/Core identity, Stop, candidate facade/infrastructure and typed/navigation fixes pushed; durable receipt restart verified; loaded-host identity independently verified; production promotion/live qualification pending.
Created: 2026-10-05
Last updated: 2026-10-07
Owner: Senior supervisor agent
Scope: The ordered plan from 2026-10-05 to the polished-MVP deadline of 2026-11-10: what is done, what is held on unmerged branches or dirty trees, what must be integrated and pushed, and the week-by-week work to pass the 30-day plan's Final MVP Acceptance Test. It does not redo intake already recorded in the 2026-10-03 handoff, and it does not itself run live provider calls.
Paired document: C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/mvp-final-month-plan.md
Related: [30-day MVP plan](../../../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md), [Claude handoff 2026-10-03](../../claude-work-handoff-2026-10-03.md), [live loop](../../language-driven-flow-loop-plan.md), [working index](../../README.md)

---

## Current State

**Implementation authorized locally 2026-10-06; P0 in progress.** t296 is integrated
and pushed: downstream acceptance `62ceaac8`, Core `6c449022`; downstream identity
`2c76ba48` is also pushed. Supervisor reran the two changed
test files (29/29), the fluxiq typecheck and Core structure audit; downstream task
integration audit passed. The identity slice passed independent production Chromium
match/mismatch checks, 22/22 owning tests and runner typecheck after integration.
t298 cancellation is integrated as downstream43e5e54b/Core2ee06482. Supervisor
rebuilt current pair and repeated headed Stop build/run2/2, owning reauthor9/9,
Core typecheck/build and both integration audits pass. Running Core-server identity
is integrated/pushed (Corec8501c15/downstream267a4215), after independent
Core/routes59/59, generator10/10, HTTP15/15 and headed identity/runner61/61.
Loaded domain host t305 is independently verified (Core6/6, generator/cache21/21,
headed actual built host/runner55/55); integrated/pushed Corec051b8f7/downstream3b8f78df. t299 candidate facade is integrated (Core7f9bae15/downstreamcb792dee)
after independent actualservice/API53/53, package/dependentweb types and audits.
t300 receipt/detached infrastructure is integrated (Core386b4c15)
with production joins pending. t301 typed readiness is integrated (b2ad00de);
t303 navigation is integrated/pushed ddc8befd after owning114/114 and production
Chromium1/1. t304 durable ledger passed independent52/52/types/build; literal
owned child-process termination/restart checks passed2/2 independently, pushed
Core04b51050/downstream1c55b131. t306 meaningful assert/wait integrated and
pushed after root33/33 and production Chromium1/1 (17.2s).
t307 atomic graph import is integrated/pushed Corec2ea1e5d/downstreamf7b5c5a9
after independent19/19, merged package types/build and both audits0.
t308 fixture paginator, t309 staged project snapshot foundation and t310 actual
server-adapter identity are isolated active tasks. No P0 completion or fresh A-D
qualification is claimed.

**Planning review completed locally 2026-10-06.**
The [consultant review and revised execution detail](../../mvp-final-month-plan/consultant-revision.md)
is the current order of work. It supersedes the old schedule and structural
stage ordering, preserves the November 10 deadline and October 29 freeze, and
keeps the existing runtime rather than introducing a new Flow language.

**Claude's stopping point.** Downstream `92d790d7`, Core `e9b7d691`, both clean
at intake and pushed by Claude. Handoff 2026-10-07 05:10 UTC is October 6 locally.
Read-list S1-S6 and fix-everything workstreams landed; round 4 failed A-D; round 5
was cancelled. No lane has passed twice consecutively. The complete prior
[Current State](../../mvp-final-month-plan/archive/2026-10-06-claude-stopping-point.md)
and [implementation ledger](../../mvp-final-month-plan/archive/2026-10-06-pre-consultant-ledger.md)
remain available; historical briefs are not active dispatch instructions.

**Verified by source/history inspection.** Discovery and authoring still share
draft state on the legacy path. t296 now requires a second affirmative verdict
when build confirmation is requested and refuses unsupported held-repair topologies
before applying or dispatching. Desired-state check and persistent
locator fingerprints already exist; their implementations need refinement. The
Lab already resets before persisted playback and checks exact zero-call reuse.
Its cached-worker deletion is wired; t297 now asserts actual background/top-frame
content identity before Lab dispatch. The planning audit performed no product
checks; later implementation/browser proofs are recorded in the ledger.

**Evidence correction.** Affected cached workers leave recent background fixes
unproven live; historical page outcomes and replay receipts remain evidence of
what ran, not proof of the newer intended build. Rebuild lane pairs and assert
running identities before further paid work. Existing lane trees/slots must be
reconciled through task tooling; this planning task did not reset or remove them.

**Do not repeat landed work.** t267 adaptation/caller/promotion fixes (with the
topology limit above), t268 extraction preview/deep links, t270/t273 binding and
wiring, t279/t280 and read-list S1-S6 are on dev. Their older schedule/gap-map
entries are superseded. Verify them live instead of implementing again.

**Next order.** P0 fail-closed acceptance, unsupported-topology fence, Lab running
build identity and Stop/build cancellation; P1 separate discovery and complete
candidate submission behind a feature flag; P2 declared-start candidate execution
and one promotion gate for builds/repairs. Improve shared typed browser blockers
alongside those slices. Complete navigation/gaps node audits and rank all four
families. Design script/request feasibility and permissions alongside, without
making arbitrary page JS the prerequisite for typed proof. Then current-build
A-D qualification, S7 after C, Phase 1b, adaptation proof, breadth/UX and release.

**Live acceptance stays strict.** Each A-D lane needs two consecutive independent
creation passes on the same source/build pair plus separate zero-call saved-Flow
replays, exact oracles and truthful product acceptance. Up to four headed,
supervised, one-attempt chat-started lanes after the first representative slice;
no relaunch loop. Off-peak guard, flash default and $0.10 Lab ceiling stay binding.
Unknown, withheld/unperformed outcomes and old-revision evidence cannot promote.

**User decisions preserved.** Recording is evidence beside mandatory instruction
and waits for A-D. Direct requests OFF by default in config and Settings. Typed
nodes first; JS last resort after about three typed failures, scored partial
success used JS. No debugger for JS; network capture debugger only if absolutely
needed with requests enabled. Full suites at most twice daily; narrow gates per
change; no user-panel management unless explicitly authorized.

**Audit reports.** [Working docs](../../mvp-final-month-plan/reports/consultant-doc-context.md),
[Core source](../../mvp-final-month-plan/reports/consultant-core-audit.md),
[browser/Lab source](../../mvp-final-month-plan/reports/consultant-browser-lab-audit.md).
These record planning coverage and unverified hypotheses. Implementation checks
and source changes are recorded separately below; no paid run has started. Identity
and cancellation browser evidence must be independently reviewed before P0 closes.

## Schedule to 2026-11-10

Implementation instructions, file seams, requirements/evidence contracts, negative
cases and live command templates are in the
[revised execution plan](../../mvp-final-month-plan/consultant-revision.md).
The following are targets subject to gates, not claimed completion dates.

| Order | Work | Gate |
| --- | --- | --- |
| P0, Oct 6-9 | Fence false acceptance and early promotion; prove running build identity; Stop/cancel | Negative cases + provider-free identity mismatch + real isolated cancel proof |
| P1/P2, Oct 6-16 | Separate discovery; submit canonical candidate; declared-start execution; shared acceptance | Candidate-specific sufficient outcome evidence before promotion |
| Alongside | Typed browser blockers; finish full node audit; fallback feasibility | Shared regressions; JS/requests preserve user's policy |
| P5, Oct 10-16 | Rebuild and qualify A-D | Two creation passes per build pair, exact oracles and zero-call replays; then C S7 |
| Phase 1b, after A-D | Other realistic tasks; recording plus instruction | Correct reusable outcome despite recording detours |
| Adaptation, Oct 12-23 | Create, drift, diagnose, repair, verify, persist, resume, reuse | Three sites twice each; later run zero-call |
| Breadth/UX, Oct 17-28 | Ten sites, explicit 67-task denominator; onboarding, scraping, controls | Creation + repair coverage; understandable outcomes/learning |
| Freeze Oct 29; harden to Nov 4 | Restart/uncertain-write matrix, privacy, performance, packages | Installed Chrome/Edge and Firefox proof, screened diagnostics |
| RC Nov 5-10 | Clean-profile 13-step script and 26 acceptance items | Unfamiliar-user proof; approval for main/tag/store submission |

If adaptation is not green by October 23, bring an explicit qualification-scope
proposal rather than silently relaxing success. Preserve the prior schedule as
[historical reference](../../mvp-final-month-plan/archive/2026-10-06-pre-consultant-schedule-and-briefs.md).

## Worker Briefs

### Brief: p2-detached-execution (continues task t300)
- Repository: paired t300 !FluxIQ / !FluxIQWebExtension. Verification controller source frozen and independently reviewed/tested before this continuation.
- Task: Add an actual detached-topology executor adapter for canonical submitted candidates using existing normalizeAutomationStudioFlowBuildPlan, routeAutomationStudioRun and runCanonicalAutomationStudioFlow; no graph/adaptation apply or accepted storage write. Preserve normal registry/runtime/effect permissions and host routing state.
- Required reads: t300 verification report/identity/start/execute contracts; existing bootstrap normalization/validation; route-state/router-state.ts; composite-executor.ts/executor.ts owning tests; native node/effect runtime options used by service.ts; held-candidate limits.
- Owns: new flow-bootstrap/verification/detached-execution.ts + owning tests and verification barrel; own reports/p2-detached-execution.md downstream. Existing verification controller/contracts only for a concrete adapter incompatibility, report before edit. No service/API/other barrel/storage changes.
- Definition of done: execute actual representative multi-node canonical topology without persistence using real router/graph executor, pure mocked native/effect boundaries only; changed selected graph is exactly submitted candidate, other graph not read from accepted store. Ownership/topology/registry errors, absent host state, cancellation/partial execution/waiting fail closed; no recovery that applies before judgement. Static validity alone insufficient. Provide precise trace-to-receipt command/subject/provenance integration contract; do not infer performed lasting action from succeeded node alone.
- Must not touch: shared/main docs, t299 tree/source, cancellation/UI, runtime data; no gitmutation/provider/full suites. No blanket authorize flag or stub runtime replacing real executor. Unsupported topology safely draft/refused with reason.
- Report: t300 docs/working/mvp-final-month-plan/reports/p2-detached-execution.md; actual runtime tests/limits and serial facade integration seam.

### Brief: p3-typed-browser-readiness (task t301)
- Repository: isolated C:/Users/osrs_/FluxStuff/fxwork/t301-typed-browser-readiness; shared sibling Core read-only.
- Task: Reproduce then fix three shared browser blockers: controlled desired-state checkbox/radio, in-place Next-page rerender/ended distinction, type(submit:true) committing declaration parity. Preserve actionability, sensitive evidence and no blind mutating retry.
- Required reads: this Current State/revision P3; node-catalog interaction/reading reports; exact checkable-state/check action and owning browser tests; pagination list-change/Next execution/tests; domain plan-resolution step-permission/type parameters/existing tests. Discover exact Next owners before editing and send file list.
- Owns: checkable-state.ts/check.ts and owning regression/browser fixtures/tests; Next list-change/continuation modules and owning tests; domain step-permission.ts and owning tests; scoped authored web-capabilities docs; own reports/p3-typed-browser-readiness.md in task tree. No Core/shared protocols/Stop/identity/facade source.
- Must not touch: main/shared docs, other trees, Core, runtime/user data; no git mutation/provider/full suites. Wait provisioning completion before source edit; no debugger input fallback.
- Definition of done: controlled components update application state, already-correct check has no click, unchecked radio refused, revert readback fails; Next changing text in existing rows advances once, unchanged/disabled/ended remain truthful and bounded; submit type requires explicit consequences through same Core gate, unsent type preserves contract. Fail-first owning regressions and provider-free real production/browser fixture proofs; touched typechecks/audit.
- Report: docs/working/mvp-final-month-plan/reports/p3-typed-browser-readiness.md; include before/after, exact commands, browser/target and limitations.

### Brief: p2-candidate-evidence (task t300; supervisor until a worker is free)
- Repository: paired C:/Users/osrs_/FluxStuff/fxwork/t300/!FluxIQ and !FluxIQWebExtension.
- Task: Implement domain-neutral immutable requirement/evidence receipt contracts and fail-closed candidate acceptance controller; later wire the serial facade after t298/t299 integration. Preserve canonical graph/runtime/persistence ownership.
- Required reads: this Current State; consultant revision Binding design contracts and P0/P2; Core code structure; candidate submission contracts after t299; current bootstrap acceptance, adaptation validation and held-candidate executor/promotion owners.
- Owns: new Core flow-bootstrap/verification modules/barrel/tests and own downstream reports/p2-candidate-evidence.md; facade/API/persistence wiring only supervisor serially after control integration. Do not overlap candidate directory/evidence-loop cancellation or existing worker files.
- Definition of done: receipts bound to original instruction requirements, candidate revision/digest/base and actual execution run/command/subject/coverage; builder claims cannot act as facts. Negative tests: unknown, wrong qualifier, partial subjects, withheld/zero-action create, stale revision, cancelled/late result, changed base, duplicate promotion, insufficient coverage. Existing ensure can pass only with trusted observed state. Concrete contradictions outrank semantic yes. No model fields accepted as trusted observations.
- Must not touch: shared/main docs, other trees, service.ts until assigned serially, runtime data; no git mutations/provider/full suites. Unsupported execution shapes remain draft; no assertion of universal verification or real-browser qualification.
- Report: docs/working/mvp-final-month-plan/reports/p2-candidate-evidence.md in t300 downstream, record exact implemented versus not yet wired seams and narrow checks.

### Brief: p1-candidate-authoring (task t299, follows t296)
- Repository: paired trees C:/Users/osrs_/FluxStuff/fxwork/t299/!FluxIQ and !FluxIQWebExtension.
- Task: Implement a feature-flagged vertical candidate-authoring path. Discovery executes existing registry tools and records evidence without draft retention/auto-openers/act completion; one explicit complete submission reuses canonical bootstrap acceptance/plan validation, assigns revision/digest/diff, and returns consolidated diagnostics. Keep accepted Flow untouched, existing saved Flows/legacy default compatible. No claim of semantic acceptance from static validity.
- Required reads: main Current State; consultant revision P1/P2 and Core audit; Core boundary/structure; current evidence-loop/node-tools, bootstrap authoring/plan/unfinished-build, runtime service generation-request/built-loop, and their owning tests.
- Owns: focused Core flow-bootstrap/candidate modules/barrels/tests, feature-flag/tool-interface contracts, evidence-loop and bootstrap integration owners needed for the path (not service.ts until t298 frozen/merged); domain candidate plan resolution adapter if required; own downstream report docs/working/mvp-final-month-plan/reports/p1-candidate-authoring.md.
- Must not touch: main checkouts/shared docs, other trees, cancellation/acceptance/identity worker files, Lab launch/Stop UI; no git mutations/commits/merges, provider calls/full suites. Send exact discovered ownership list before editing existing coordinators. If service.ts wiring required, give supervisor narrow patch for serial integration.
- Definition of done: provider-free scripted harness constructs/revises representative multi-node candidate without amend/keep/act grammar; discovery wrong-turn omitted; registry/parameter/binding/permission/ownership/handle validation diagnostics; any revision invalidates prior receipt; legacy owning regressions and touched checks/audit pass. The new path must fail closed until exact candidate runtime verification is wired; no untested proposal promotion.
- Report to: t299 downstream docs/working/mvp-final-month-plan/reports/p1-candidate-authoring.md; record implementation, commands/results, limitations and precise P2 caller wiring as work progresses.

### Brief: p0-acceptance (task t296)
- Repository: paired trees C:/Users/osrs_/FluxStuff/fxwork/t296/!FluxIQ and !FluxIQWebExtension.
- Task: Implement P0 fail-closed confirming judgement (yes + unsure/silent/unavailable must not pass) and refuse unsupported held reauthor topology instead of apply-before-judge. Add fail-first tests proving accepted graph is never applied for unsupported topology, and update downstream callers only if required to render a truthful unknown/draft.
- Required reads: main downstream Current State and consultant revision P0; consultant-core-audit.md; Core AGENTS boundary/validation; existing agreement, held-candidate, repair-rerun and their owning tests.
- Owns: Core result-verification/agreement.ts and tests; service/runtime-adaptation/held-candidate.ts, repair-rerun.ts and their tests/barrels if needed; downstream report docs/working/mvp-final-month-plan/reports/p0-acceptance.md in t296 tree only.
- Must not touch: main checkouts/shared docs, other task trees, service.ts, cancellation owners, gateway, Lab, UI; no git mutations/commits/merges, provider/live/full-suite calls.
- Definition of done: fail-first then passing owning tests, fluxiq typecheck, Core structure audit; list compatibility behavior/unsupported shapes. Inspect callers for truthful refusal; report needed changes outside ownership instead of editing them.
- Report to: t296 downstream docs/working/mvp-final-month-plan/reports/p0-acceptance.md.

### Brief: p0-build-identity (task t297)
- Repository: C:/Users/osrs_/FluxStuff/fxwork/t297-lab-build-identity; its sibling shared Core read-only.
- Task: Implement running extension background/content build identity assertion in Lab before any provider call; compare intended build-info/core-domain pair/protocol identity and record screened identities. Preserve cached-worker workaround only in owned profiles. Add provider-free mismatch tests and a real browser identity probe where possible, no paid runs.
- Required reads: main downstream Current State/revision P0 and consultant-browser-lab-audit.md; build-info generation, background/content diagnostic messaging, guarded launch and chat/build preflight owners/tests.
- Owns: extension build-stamp diagnostic owners/protocol/barrels and tests; Lab browser/build identity preflight/report owners and tests; docs/architecture/testing-facility.md and extension-client.md in task tree if needed; own report docs/working/mvp-final-month-plan/reports/p0-build-identity.md.
- Must not touch: main checkout/shared working docs, any Core, panel/chat cancellation owners, other task trees; no git mutations/commits/merges, provider calls or full suites.
- Definition of done: deliberate worker/content/disk mismatch rejected before provider work; current match accepted; owning tests, extension/test-runner checks and audit pass; identify exact live/probe evidence and limitations. Coordinate any shared protocol filename with supervisor before editing.
- Report to: t297 docs/working/mvp-final-month-plan/reports/p0-build-identity.md.

### Brief: p0-cancel-control (task t298)
- Repository: paired trees C:/Users/osrs_/FluxStuff/fxwork/t298/!FluxIQ and !FluxIQWebExtension.
- Task: Expose reachable Stop for active run and active build in extension; implement cooperative build cancellation through existing Core controller/API grants. Stop new dispatch and prevent cancelled/late result promotion; UI settles truthfully. Reuse current run cancellation. Add fail-first owning tests and a provider-free real extension isolated cancellation proof if feasible.
- Required reads: main downstream Current State/revision P0; consultant-doc-context UX gaps; Core AGENTS; existing runtime cancel and bootstrap/evidence-loop cancellation APIs, client handler allowlist, extension run-control and chat/automations surfaces/tests.
- Owns: Core build cancellation API/runtime/handler owners and tests (not verdict/agreement or held-candidate); extension panel/chat/automations Stop, background/panel/run-control and API relay/cancel contracts/tests; existing cancellation architecture docs; own report docs/working/mvp-final-month-plan/reports/p0-cancel-control.md in t298 downstream.
- Must not touch: main checkouts/shared working docs, other task trees, build identity protocol files, acceptance worker files; no git mutations/commits/merges, paid calls or full suites. For contested source owners request supervisor partition before editing.
- Definition of done: cancel-before-dispatch, mid-build/mid-run, late result/no promotion tested; reachable UI control and status; touched package checks and owning tests/audits pass. No user-panel management, only owned isolated test topology.
- Report to: t298 downstream docs/working/mvp-final-month-plan/reports/p0-cancel-control.md.

### Completed consultant audit briefs (2026-10-06, task t295; planning only)

All three reports are returned and integrated. These are the review's provenance,
not pending implementation assignments; the next brief is P0 in the revision.

### Brief: audit-plan-context
- Repository: downstream, read-only except own report.
- Task: Read EVERY top-level docs/working/*.md plus every Markdown file under mvp-final-month-plan/ (including archives/reports); consult referenced reports elsewhere when needed. Reconcile current claims with Claude's latest handoff, distinguish history from pending work, and produce a complete workstream/dependency map and critiques of the consultant's ordering.
- Required reads: this document Current State; MVP_AGENT_INSTRUCTIONS.md; 30-day MVP plan; consultant attachment C:/Users/osrs_/.codex/attachments/010d6243-d325-443e-85a6-67242d0af85d/Pasted text.txt.
- Owns: docs/working/mvp-final-month-plan/reports/consultant-doc-context.md.
- Must not touch: source, tests, shared docs, Core, fxwork, runtime data; no build/test/Lab/provider/git mutation.
- Definition of done: report with docs read inventory, authoritative/pending/superseded status by workstream, contradictory claims, recommended phase order and acceptance gaps. Say exactly which nested reports were not read.
- Report to: docs/working/mvp-final-month-plan/reports/consultant-doc-context.md.

### Brief: audit-core-boundaries
- Repository: Core C:/Users/osrs_/FluxStuff/!FluxIQ read-only; report downstream.
- Task: Audit discovery/draft mutation, candidate submission and signatures, instruction interpretation, judged-run evidence, budgets, bootstrap/reauthor/recovery promotion and persistence. Compare the consultant design with current code; find reusable seams and concrete false-acceptance paths. Read relevant Core working docs Current State; no Core edits.
- Required reads: this document Current State; structural-agent-plan.md; consultant attachment as above; Core AGENTS.md; relevant Core runtime owners and tests.
- Owns: docs/working/mvp-final-month-plan/reports/consultant-core-audit.md.
- Must not touch: any other files; no build/test/Lab/provider/git mutation; never inspect .fluxiq or expose secrets.
- Definition of done: file:line evidence, minimal migration phases, owners/tests and negative acceptance cases; distinguish confirmed code defects from hypotheses.
- Report to: docs/working/mvp-final-month-plan/reports/consultant-core-audit.md.

### Brief: audit-browser-and-lab
- Repository: downstream read-only except own report.
- Task: Audit typed action reliability (check/type/next_page), handles vs reusable locators, extraction completeness, browser reconnect/uncertain writes; Lab cached-worker fix/build identity, reset/candidate replay, live gate/oracles and decision replay. Reconcile existing node audits with source, assess fallback risks and minimal live sequence. Read remaining working-tree Markdown reports outside mvp-final-month-plan/ as useful; inventory coverage.
- Required reads: this document Current State; node-catalog-plan.md and its reports; docs/architecture/testing-facility.md, extension-client.md, web-capabilities.md; consultant attachment as above.
- Owns: docs/working/mvp-final-month-plan/reports/consultant-browser-lab-audit.md.
- Must not touch: any other files; no builds/tests/Lab/browser/provider/git mutation; no runtime data or secrets.
- Definition of done: concrete file:line findings, reuse/defer recommendations, exact live commands and expected A-D outcomes, test gaps and browser limits; no claims of live validation.
- Report to: docs/working/mvp-final-month-plan/reports/consultant-browser-lab-audit.md.


Historical briefs: [Claude schedule and task briefs](../../mvp-final-month-plan/archive/2026-10-06-pre-consultant-schedule-and-briefs.md).

## Work Ledger

### 2026-10-06 - Requirement controller independently checked; detached execution follows
- Agent: Codex supervisor.
- Validation: reviewed t300 contracts/controller/predicates; supervisor owning tests 31/31. Worker fluxiq typecheck/audit passed; intent interpreter, browser observation and durable atomic promotion are explicitly absent.
- Changed: written continuation brief for real router/executor adapter; t299 static authoring remains isolated until atomic facade integration.
- Outcome: Partial.
- Follow-up: actual detached runtime proof; supported create currently new-result identity only, existing-subject quantity deltas stay unsupported/unknown rather than relabelled ensure. No paid launch.

### 2026-10-06 - Typed shared blocker task prepared
- Agent: Codex supervisor.
- Changed: t301 bounded brief; isolated downstream provisioning started session 72014; worker assignment follows completed navigation/gaps reports.
- Validation: source inspected check/type/permission boundaries; no fix or live behavior claimed yet. t299 candidate module and unverified store committed locally with checked architecture/report updates, pending atomic facade integration.
- Outcome: Partial.
- Follow-up: reproduce controlled check, in-place Next and submit declaration parity; qualify with narrow browser regressions. Preserve all existing safety/actionability gates.

### 2026-10-06 - Identity integrated; candidate and Stop proofs advance
- Agent: Codex supervisor.
- Changed: t297 merge `2c76ba48` pushed; t299 Core local commit `0b5d7543` and downstream `467bb74f` hold static candidate/discovery plus separate unverified draft storage. t299 is not merged or pushed because facade/API must read the new flag atomically. t300 receipt worker and navigation/gaps report worker active.
- Validation: t297 supervisor post-merge real Chromium production probe and negatives 22/22; digest 1/1; runner check exit 0 and task finish audit pass. t299 supervisor candidate loop 7/7, request parser 6/6, JSON/SQLite draft storage 3/3; fluxiq check/audit pass. Worker isolated real build Stop proof returned, independent rerun and active-run browser proof pending.
- Outcome: Partial.
- Follow-up: t298 current-dev integration/cancel checks, serial t299 facade/durable unverified response, t300 exact execution/evidence/promotion adapter. No paid calls. Core `7717ff42` fixes ledger validation format and remains local until next paired push. Current source catalog has 57 tasks versus planned 67; audit reconciliation must preserve the missing scope explicitly.

### 2026-10-06 - t297 running-extension identity independently verified
- Agent: Codex supervisor.
- Changed: source/architecture/report commit `ac243ae0`; embedded per-target stamp, authenticated background/top-frame content query, screened Lab pre-dispatch gate.
- Validation: reviewed generation/diagnostic/preflight modules; supervisor digest test 1/1 and post-dev-merge identity/browser selection 22/22. Real Chromium 134.0.6998.35, production E2E bundle, four owned-profile launches: match accepted; deliberately altered background/content/disk refused, zero simulated dispatch on each mismatch. Runner check passed after merge; worker extension typecheck/release/authorization checks passed. Task audit required at finish.
- Outcome: Accepted for this bounded slice, not all P0.
- Follow-up: running Core-server identity still absent (reached Core/domain source digests are not that handshake); rebuild integrated pair before paid live qualification. No paid call or user-panel management.

### 2026-10-06 - t300 provisioned for requirement receipts and common acceptance
- Agent: Codex supervisor.
- Changed: written P2 brief; paired isolated worktree provisioning started (session 30711).
- Why: static candidate validity alone cannot establish outcomes or authorize promotion; requirement-level negatives are still a P0 exit dependency.
- Validation: no source edit or completion claim yet. Identity supervisor unit checks passed 20/20 plus digest test 1/1; browser rerun initially refused on missing default bundle path, worker asked for reproducible custom-root command.
- Outcome: Partial.
- Follow-up: complete provisioning, receipt controller, then serial facade/exact-runtime proof; no paid launch while readiness remains open.

### 2026-10-06 - t296 integrated and paired dev branches pushed
- Agent: Codex supervisor.
- Changed: Core source/test/architecture commit `1736ba81`, paired verification ledgers and downstream acceptance report; merges downstream `62ceaac8`, Core `6c449022`.
- Validation: supervisor reviewed source and reran changed agreement/held-candidate tests 29/29 after dev integration; fluxiq check exit 0; Core audit exit 0; downstream task finish audit passed. Worker broader owning selection: 391 tests; not substituted for supervisor checks.
- Outcome: Partial (two P0 fences complete; requirements receipts, identity and real cancel proof remain).
- Follow-up: t297/t298 validation and merge; t299 authoring followed by serial candidate runtime verification. Both dev branches pushed; main/release untouched. Core task finish used `--skip-checks` only after observed narrow gates to honor the twice-daily full-suite limit.

### 2026-10-06 - t296 two acceptance fences independently verified
- Agent: Codex supervisor; p0-acceptance worker.
- Changed: paired Core agreement/held-topology source and architecture; downstream p0-acceptance report. Source commit Core 1736ba81.
- Why: automatic build completion needs actual affirmative confirmation; accepted graph stays unchanged for unsupported held topology.
- Validation: supervisor reviewed source/negative tests and reran changed owners 29/29 passed; worker directory regressions 391 passed and fluxiq check/audit passed; dev integrated and owning checks rerun before merge. No browser/provider calls; this is not all of P0 complete.
- Outcome: Accepted
- Follow-up: t297 identity, t298 control/decline reason, remaining requirement receipts; t299 explicit candidates. Core legacy finish runs full check by default: use its --skip-checks only after observed manual narrow gates under the user's twice-daily full-suite rule.

### 2026-10-06 - Implementation started; first P0 units assigned
- Agent: Codex supervisor.
- Changed: paired Core working doc, this Current State and three bounded briefs; isolated t296/t297/t298 trees provisioned through task tooling.
- Why: user authorized plan execution with continuous handoff documentation.
- Validation: main downstream/Core intake clean; source audit baselines read; provisioning and worker execution still in progress. No paid run started.
- Outcome: Partial
- Follow-up: acceptance/control/identity reports and independent validation; then P1/P2 vertical candidate slice and remaining node audits.

### 2026-10-06 - t296 code returned; candidate slice prepared
- Agent: Codex supervisor; p0-acceptance worker.
- Changed: t296 agreement and held-topology fences, owning regression tests/report; t299 paired tree and P1 bounded brief prepared.
- Why: acceptance now has a concrete fail-closed implementation to verify; separate candidate authoring can proceed in isolated files while cancellation is integrated serially.
- Validation: worker reports fail-first 10 failures, final 391 owning tests, fluxiq typecheck/audit; supervisor rerun of the two changed test owners is running. Not merged or accepted as complete yet. t297/t299 provisioning still finishing.
- Outcome: Partial
- Follow-up: supervisor verifies t296 and documents architecture; integrate downstream then Core; P1 implementation; identity/cancellation and remaining P0 receipt cases still open.

Earlier entries: [Claude implementation and handoff ledger](../../mvp-final-month-plan/archive/2026-10-06-pre-consultant-ledger.md).

### 2026-10-06 - Consultant audit started; historical ledger compacted
- Agent: Codex supervisor, task t295.
- Changed: archived the settled 2026-10-05..07 UTC ledger without deleting evidence; written audit briefs below.
- Why: user requested all-working-doc context, current-code audit and a revised plan from Claude's stopping point. Local date is 2026-10-06; the previous handoff used 2026-10-07 UTC.
- Validation: inspection only; no source changes, live runs or provider calls.
- Outcome: Partial
- Follow-up: verify worker findings, revise the execution order and live acceptance gates.

### 2026-10-06 - Consultant audit integrated; current plan revised
- Agent: Codex supervisor, task t295; three bounded read-only audit workers.
- Changed: current final-month schedule and consultant execution detail; structural stage order/defaults; node-audit priority; audit reports; archived prior stopping point, schedule/briefs and ledger; regenerated index.
- Why: independent acceptance and explicit candidates address the shared failure causes; older schedule repeated landed work and delayed these boundaries behind broad fallbacks.
- Validation: supervisor inspected verdict agreement/build-test mapping, topology apply-first branch, signature, gateway pending/late-result handling, checkbox implementation, submit declaration mismatch, Lab launch wiring, t268/t273 history and instruction-built redesign task. Structure audit exit 0 with advisory warnings; git diff --check exit 0. An initial docs-links failure caused by moving historical relative links was corrected by rebasing archive links, then the audit passed.
- Outcome: Accepted
- Follow-up: execute P0 paired Core/downstream acceptance/readiness/control tasks, then the P1/P2 vertical slice. Product implementation, package tests, live browser proof and provider calls were not performed by this review.

## Open Questions

- Recording scope is resolved by the newer user order: evidence beside mandatory instructions, after A-D qualify. Do not reopen the older September ambiguity.
- Script channel, store eligibility and Firefox parity need a concrete feasibility result. Preserve no-debugger JS and requests-OFF policy meanwhile.
- Direct-request origins/session/redirect policy needs a concrete design; do not inherit the old any-origin default as authorization.
- Who runs the Phase 6 release-candidate script as the "person unfamiliar with FluxIQ"? Owner: user.

### Brief: p0-core-runtime-identity (t302)
- Mode: Execute Plan With Workers; worker never declares mode.
- Task: close the running Core-server identity gap before Lab paid dispatch.
- Trees: C:/Users/osrs_/FluxStuff/fxwork/t302/{!FluxIQ,!FluxIQWebExtension}; paired task/t302-core-runtime-identity.
- Read: this Current State, consultant-revision P0, p0-build-identity report, repository boundaries and Core instructions/working Current State.
- Own: new focused Core build/runtime identity module and authenticated restricted diagnostic route; paired Lab preflight/identity gate and owning tests; architecture identity paragraphs; own reports/p0-core-runtime-identity.md only.
- Inspect first and send exact existing files before editing shared router/protocol modules.
- Expected: embed immutable executing Core build identity, compare reached contract digest and expected built artifact before any provider/chat dispatch; changed disk alone must not masquerade as restarted server.
- Refuse missing/stale/mismatched actual server identity; never return secret keys, storage, page data or tokens.
- Use existing authenticated downstream route. No new broad privilege, public unauthenticated diagnostic or source-only handshake.
- No provider calls, user panel management, full suites, git mutation or shared document edits.
- Provider-free owning negatives plus isolated server/browser proof; narrow package typechecks and structure audit.
- Return exact source paths/checks/limits in own report. Supervisor reviews, integrates and independently verifies.

### 2026-10-06 - Serial facade and remaining P0 identity assigned
- Agent: Codex supervisor.
- Changed: t299 candidate-generation command extraction added locally; t302 paired running-Core identity task provisioned; t298 decline reason reviewed before independent checks.
- Validation: first helper typecheck exposed harness completionSchema/provider/result narrowing; corrected types and explicit schema, final check pending. No provider call. t298 independent owning regression and current-pair rebuild in progress.
- Outcome: Partial.
- Follow-up: wire candidate flag/draft API atomically, independently repeat Stop browser proof, then integrate receipt/detached execution and typed readiness. Running Core identity still blocks P0 completion.

### Brief: p1-candidate-facade (t299 continuation)
- Worker: p0_acceptance; paired trees fxwork/t299/{!FluxIQ,!FluxIQWebExtension}; same t299 branch.
- Read: Current State; own p1-candidate-authoring.md and p1-supervisor-integration.md reports; current Core instructions.
- Own: runtime/service.ts candidate branch, flow-bootstrap-commands/{candidate-generation,contracts,index}.ts, Core api/contracts/adaptation.ts and owning generation API handler/sanitizer, relevant conversation build draft rendering, focused service/API regressions, architecture bootstrap candidate section, own report p1-candidate-facade.md.
- Do not edit cancellation, held rerun, candidate submission/controller, draft store, t300 verification or downstream source/shared docs.
- Supervisor added uncommitted candidate-generation.ts helper + barrel export. Own/fix these now; current first checks revealed missing harness completionSchema and optional provider, corrected locally but final check pending.
- Start read-only design and exact file list now; wait for supervisor to merge current dev/t298 into t299 before service.ts edits.
- Wire authoringMode:candidate through restricted request/API to actual service discovery-only branch and durable Core candidate-draft store. Omitted preserves legacy proposed.
- Result status:draft must discriminate from status:proposed, contain candidate identity/base/source instruction IDs/accounting, verification:not_performed and promotionAllowed:false. No apply action/no adaptationId fabrication/no adaptation creation.
- Preserve purse, inherited external cancellation, permissions/tool wrappers, current registry/handle resolution, immutable original instruction text, stale Flow/settings refusal and truthful accounting. Draft must not mark creation purse ended.
- All old legacy/reauthor callers must narrow proposed before adaptation use; reject unexpected draft explicitly. Keep service line budget via focused extraction, no bulk refactor.
- Service-level scripted test must exercise discover wrong turn + complete submission/revision -> durable draft, unchanged accepted Flow and empty adaptations; cancel and stale base cannot write. No real provider call.
- API flag parser/handler/draft response integrated atomically; never expose parser alone.
- Narrow owning tests, fluxiq/touched web package typechecks, structure audits and diff checks; freeze then report exact receipts/limits.
- No provider/live/full suite/git mutations/shared docs. Supervisor integrates and verifies.

### 2026-10-06 - t298 integrated and independently verified
- Agent: Codex supervisor.
- Changed: merges downstream43e5e54b and Core2ee06482 integrate scoped build cancellation, reachable Stop, truthful terminal states and persisted held-decline reason. t299 now merged both dev branches and worker owns serial facade.
- Validation: supervisor reviewed source, reauthor9/9, Core packagecheck0/build0, current extension three targets22files each; headed actual Core build/run Stop2/2 (18.1s) on production bundle, no next node/proposal and unchanged graphs. Both structure audits passed; index refreshed after report status change. Finish first invoked from task tree failed dev already checked out, corrected by invoking lifecycle from main; no manual removal/history rewrite. Core legacy finish --skip-checks only after observed manual narrow gates.
- Outcome: Accepted cancellation slice; paired dev push next.
- Follow-up: t302 running Core identity, t299 atomic flag/facade, t300 receipt/runtime joins, t301 typed readiness. Independent t300 verification58/58 passes; module is not yet product promotion. No paid calls/full suites/user panel.

### Brief: p3-browser-navigation-readiness (t303)
- Worker: p0_build_identity; tree fxwork/t303-browser-navigation-readiness, task/t303-browser-navigation-readiness; shared Core read-only.
- Read: this Current State; node-catalog-plan/ranked-backlog.md rows4/5 and node-audit-navigation.md P0/tab/HTTPS findings; relevant repository instructions.
- Scope: correct tab repeat-safety metadata, explicit tab-open shared landing verification, and HTTPS downgrade refusal. Preserve blank-tab creation and ordinary switching/close semantics.
- Discover owners then send exact existing file list before edits; do not expand to downloads/frame identity/readiness timeout or submit-runtime inspection without separate brief.
- Expected: open/close must not become safely retryable observation; explicit opened URL must pass same HTTP/challenge evidence gates as navigate/click-open, not URL equality alone.
- Redirect transport does not prove user outcome; unread landing evidence stays unknown. No automatic captcha solving, repeated consequential dispatch or weakened oracle.
- Preserve existing typed/action/policy boundaries; focused shared landing module only if it owns same capability across callers.
- Owning negatives before fix: tab metadata repeat classification, explicit open404/challenge/ordinary success, HTTPSdowngrade/upgrade tests. Provider-free production Chromium proof on isolated local fixture; record build identity and driver seam limitations.
- Narrow extension/domain source+test types, changed-directory tests, structure audit. Shared Core source/dist only rebuilt through lifecycle tool and remains read-only.
- Write own reports/p3-browser-navigation-readiness.md in task tree; no shared docs/git/providers/user-panel/full suites.
- Return exact failures/fixes/checks/limits, freeze. Supervisor verifies/integrates.

### 2026-10-06 - Typed readiness independently verified and navigation queued
- Agent: Codex supervisor.
- Changed: t301 source4d7a1447 reviewed and current dev merged; t303 bounded navigation task provisioned.
- Validation: supervisor production Chromium typed checks2/2 (23.9s), four owning extension files19/19 and real Core permission seam12/12. Domain test typecheck0; extension test typecheck found shared Core still at7717ff42 missing t298 buildCancellation API. Task provisioning advances/rebuilds the read-only shared dependency before repeating; do not change product to satisfy stale declarations.
- Outcome: Partial integration pending current dependency types and audits.
- Follow-up: integrate typed fixes, then navigation slice; broader extraction/corpus and P2 promotion joins remain open. No paid calls.

### 2026-10-06 - Candidate infrastructure and typed blockers integrated
- Agent: Codex supervisor.
- Changed: t300 Core386b4c15 and paired downstream0befce51; t301 downstreamb2ad00de. P4 [feasibility record](../../mvp-final-month-plan/reports/p4-script-request-feasibility.md) adds supported API/permission/timeout and requests-OFF requirements without enabling arbitrary execution.
- Validation: t300 post-dev-merge58/58 and packagecheck0; final export check0/audit0, both task audits0. t301 independent browser2/2, extension19/19, real Core permission12/12, domain/extension source+test checks0 after shared dependency refresh; taskaudit0. No paid call.
- Outcome: Accepted bounded infrastructure and typed fixes, not full P0/P2/P3.
- Follow-up: t299 facade, t302 server identity, t303 navigation; durable receipt/promotion/semantic/browser proof joins and breadth still pending. Paired push next; no main/release changes.

### 2026-10-06 - Paired bounded slices pushed
- Agent: Codex supervisor.
- Changed: downstream devafb5f939 and Core dev386b4c15 pushed; infrastructure and typed readiness integration documented.
- Validation: all bounded task receipts above observed; main working state corrected to distinguish merged modules from unintegrated production joins. No new product test required for prose.
- Outcome: Partial overall plan.
- Follow-up: t299 facade, t302 actualserver and t303 navigation active; P2 promotion and paid off-peak readiness remain pending. No main/release push.

### Brief: p2-durable-candidate-promotion (next paired unit)
- Worker: p0_acceptance; task/tree assigned after t299 integration. Until then read-only bounded discovery in frozen t299 Core, report p2-promotion-design.md downstream t299.
- Read: main Current State, consultant-revision P2, t300 verification contracts/controller and t299 draft store/service report.
- Investigate exact existing bootstrap apply transaction, locks, authorization/validation, ProgramJsonStore transactions and accepted parent/subflow graph persistence. Send exact file owners/design before edits.
- Objective: durable requirement/start/run/evidence receipts and one idempotent promotion adapter whose commit atomically compares candidate/revision/digest/original instructions/accepted base/settings and preserves normal apply-time permissions, graph validation and representation/version rules.
- Do not expose a receipt supplied by builder/API caller as authority. Trusted observer/controller issues acceptance; persisted unknown/partial/stale/cancel receipts cannot authorize mutation.
- Persist bounded IDs/receipt references and explicit pending/committed/outcome_unknown states, preserving original instruction association. No raw page/cookie/credential logs.
- Failures before/after graph commit and duplicate delivery must recover truthfully; rerun write must never execute irreversible candidate commands again. Preserve unknown in-flight charges/outcomes.
- Normal locks alone are not crash atomicity. Join existing project transaction, test rollback/crash boundaries against real JSON/SQLite storage, not fake bool promotion.
- Candidate create/ensure evidence rules remain strict; do not reinterpret create as ensure, infer performed from successful attempt, or treat compile as semantics.
- Source will be one paired unit after plan approval; focused new receipt/promoter owner and narrow existing storage/apply hooks, no service budget/baseline growth or broad refactor.
- Production requirement interpreter/start/independent browser oracle/domain command acknowledgements remain separate ports; report exactly which joins exist and which do not.
- No provider/live/full suites/git/shared docs; owning negatives/narrow types/audits and source freeze, supervisor verifies/integrates.

### Brief: p2-durable-receipt-ledger (t304)
- Worker: p0_acceptance; paired fxwork/t304/{!FluxIQ,!FluxIQWebExtension}, task/t304-durable-candidate-receipts.
- Read: main Current State, own p2-promotion-design.md (now preserved main), consultant P2 and relevant Core instructions.
- Approved scope: first bounded receipt-ledger unit described in promotion design, production promotion explicitly unavailable.
- Own: new storage/project/candidate-verification/{contracts,migration,store,index}.ts + owning tests; required focused migration/export registration after exact file proposal.
- Own: flow-bootstrap/verification/durable-session.ts + owning tests/barrel; candidate-drafts/store.ts narrow uncached read; own reports/p2-durable-receipts.md only.
- Send exact existing controller stagehook/migration files before edits if required; no broad accepted-topology/service changes.
- Durable envelope includes candidateId/revision/digest/base/settings/original instruction source+requirements and permission/compiler/version binding; bounded IDs/digests, no public builder receipt issuance input.
- Commit pending claim before any start/execute. Duplicate or restarted pending attempt returns outcome_unknown and never repeats irreversible actions. Conflicting same key/payload refuses; committed known stages recover truthfully.
- Persist trusted controller/observer receipts only through private issuance seam. Unknown/partial/stale/cancel/corrupt joins cannot prepare mutation.
- Preparation must return explicit unsupported storage authority and change no accepted graph; do not provide fake successful promote callback or claim P2 complete.
- JSON promotion refuses; SQL ledger uses actual project transaction/idempotency and survives reopen. No automatic migration/reset of user data.
- Real storage tests: simultaneous/duplicate/conflicting claims, restart pending, crash before/after stage write, malformed/mismatched refs, uncached draft freshness, unchanged accepted files and no repeated start/execute.
- No provider/live/full suites/git/shared docs/user panel. Narrow owning tests/types/audits; freeze and report exact product joins/limits.
- Provisioning running; discovery only until supervisor signals built dependencies.

### 2026-10-06 - Candidate draft facade integrated; durable receipts next
- Agent: Codex supervisor.
- Changed: t299 paired merges Core7f9bae15/downstreamcb792dee; exact atomic-topology prerequisite investigation preserved. Pairedt304 receipt ledger provisioned, no accepting promoter authorized by this bounded brief.
- Validation: post-dev53/53 independently observed; Corecheck/build0, dependentwebcheck0 and both integration audits0. Core lifecycle full sweep skipped only after observed narrow gates, preserving daily suite limit. No paid calls.
- Outcome: Accepted opt-in draft slice, partial overall plan.
- Follow-up: t302 loadedserver identity inventory refinement/rebuild, t303 navigation, t304 durable receipts; authoritative topology transaction and interpreter/start/oracle/command acknowledgements still required. Paired push next.

### 2026-10-06 - t303 navigation independently verified
- Agent: Codex supervisor.
- Changed: tab actions mutate; explicit URL opens share navigate landing checks; HTTPS downgrade refused; unknown evidence unvalidated. Current dev/t301 merged into task before checks.
- Validation: owning extension96/96 + domain18/18, affected source/test typechecks and structure audit0, three-target22-file builds, production Chromium1/1 (8.4s). Initial ad hoc native-addon bundling probe corrected to established ESM/external boundary; no product defect inferred.
- Outcome: Narrow P3 slice verified; task integration follows.
- Follow-up: Core/domain executing identity, receipt/store authority and trusted start/oracle joins remain. No paid A-D, Firefox/Edge live or TLS redirect proof. Full handoff in reports/p3-browser-navigation-readiness.md.

### 2026-10-07 - t302 executing Core identity independently verified
- Agent: Codex supervisor.
- Changed: immutable executing-service capture, authenticated read-only identity diagnostic, exact expected source/artifact inventory and Lab gate before project/browser/chat/provider setup. Merged latest dev on both sides and resolved Stop/identity service field conflict preserving both.
- Validation: generator/cache10/10; Core reader/diagnostic/real Next route59/59; HTTP15/15; headed Chromium identity/runner61/61 including retained service versus regenerated disk/reloaded route refusal; package/dependentweb/runner checks and both audits0, three-target extension builds22 files each.
- Outcome: Paired unit verified, integration follows. Full commands/digests/limits in reports/p0-core-runtime-identity.md.
- Follow-up: loaded domain-host and server-adapter identity, receipt/storage authority, independent browser oracle. P0/all-plan/live qualification remain incomplete; zero providers or user-panel management.

### Brief: p2-authority-mutation-inventory (task t304 companion)
- Repository: inspect current main Core C:/Users/osrs_/FluxStuff/!FluxIQ read-only; write only paired t304 downstream reports/p2-authority-migration-inventory.md.
- Task: Discover every mutable dependency of getLlmExecutionBinding and the ordinary save/delete paths that must join a single promotion authority. Continue the already inspected p2-promotion-design.md; do not rediscover its conclusions.
- Required reads: main and t304 Current State; p2-promotion-design.md; Core instructions; binding digest/canonical plan route ownership; flow instruction and publication/dependency stores.
- Owns: only the named report. No source, shared working docs, git, provider/browser/server commands, baseline or migrations.
- Definition of done: concrete owner/function table for instruction source/revision saves/deletes, settings, flow/router/subflow/graph reads/writes, publication/revision dependency mutation, caches; show which uses project SQL transaction versus JSON/global projection. Recommend the smallest executable migration phases that do not let an ordinary writer evade CAS, and required restart/concurrency negatives. Distinguish unresolved reader/writer authority from proposed design.
- Validation: source inspection with paths/function names; no atomicity success claim. Return status, inspected files, own report path and exact unresolved seams.

### Brief: p0-loaded-domain-host-identity (task t305)
- Repository: paired fxwork/t305/!FluxIQ and !FluxIQWebExtension; main user panel is not managed. Core generic provenance changes remain additive and legacy calls stay usable; missing provenance refuses Lab admission.
- Task: Attest the actual separately bundled web domain host loaded by the retained Core service, not its latest disk file or extension-bundled domain contracts. Extend t302's authenticated gate with bounded loaded module identity.
- Required reads: Current State; t302 identity report/modules/tests; domain/scripts/build-web-panel-host.mjs and domain/src/web-panel-host.ts; Core bindNativeNodeRuntime and existing route classification; downstream build-cache domain:host-build, Core-process host loading.
- Proposed seam: optional immutable generic module build identity on existing trusted native-runtime binding, captured in service-owned registry/WeakMap by focused Core helper. No browser concepts in Core. Preserve method budget. Bound host must register its embedded identity BEFORE any host registration/IO mutation. Rebinding changed loaded identity must refuse; uninstrumented binding must never attest old provenance. Discuss exact owners/design with supervisor before editing.
- Owns after approval: focused Core build-identity module registry/types/tests, existing native-runtime binding signature/body and diagnostics projection/tests; downstream host build generator/embedded reader/build-cache inputs + owning tests, host registration, Lab expected/verify gate + tests. Own report reports/p0-domain-host-identity.md. New folders require barrels/owning tests. No storage/controller/t304/shared docs/git edits.
- Definition of done: immutable embedded normalized executable host digest plus source freshness/full matching inventory; intended artifacts independently regenerated; authenticated diagnostic returns actual retained binding; Lab refuses missing, stale, changed artifact/source/registration and retained old host after disk/route reload before chat/provider. Generic diagnostic remains read-only and bounded. Include actual loaded built-host retained/fresh process provider-free proof; use synthetic authenticated transport only if stated. No passing stamp from reading the latest disk on server.
- Validation: narrow owner tests, affected Core/domain/runner typechecks and structure audit; rebuild owning Core/host/extension artifacts sequentially; precise browser/process/source identity receipts. No full suite, paid Lab, user panel, debugger or fabricated loaded server-adapter claim. Provisioning first; wait for supervisor before frozen checks. Return file inventory/report/commands/limits.

### Brief: p2-receipt-process-restart-probe (task t304 continuation)
- Repository: paired t304 Core (latest dev merged; root built/check and observed52/52) and own downstream p2-durable-receipts.md.
- Task: Add a literal owned child-process termination/relaunch fixture for the durable session and real project SQLite ledger; close the reopened-connection-only validation gap. No product changes.
- Owns: verification/tests/process-restart.test.ts (focused helper under tests if necessary, barrel where required); append only own p2-durable-receipts.md. No service/storage/source/shared docs/git/browser/provider/panel changes.
- Definition of done: actual built internal session/store imports in owned child process; kill after synthetic command marker is written but before execution-stage commit, restart another child/session with same immutable attempt, assert unknown and no second start/marker. Also kill after actual finish COMMIT before acknowledgement and reconcile original committed draft without re-execution. Inspect persisted status/stages and counters; no accepted promotion or browser/power-loss claim.
- Validation: independently runnable narrow vitest file + affected package typecheck; bounded child startup/IPC timeouts, cleanup only owned child/temp directories; output bounded packets without original source/page/secrets. Existing build available; source tests excluded from runtime identity. Supervisor repeats before integration.

### 2026-10-07 - Paired identity push and next proofs
- Agent: Codex supervisor.
- Changed: t302 pushed downstream267a4215/Corec8501c15. t305 paired tree provision completed0; additive loaded-domain-host provenance work authorized. t304 source merged latest dev, root reviewed controller/store/session/migration and observed owning52/52. Actual child termination/relaunch negatives now assigned before integration.
- Validation: t302 receipt above; t304 Corecheck0 (37.6s)/build0 (45.5s)/audit0 and owning52/52 (16.5s). Core task lifecycle used --skip-checks solely to avoid forbidden broad suite, after root-observed narrow gates. t305 provisioning completed before any worker edits; no frozen-source test claim from provisioning.
- Outcome: Partial ordered implementation; no accepting promotion or paid qualification.
- Follow-up: authoritative topology/source/settings/read/write/publication migration inventory report; domain-host proof; trusted interpreter/start/oracle/command receipts. User asked asynchronously whether to propose ten missing qualification tasks or use an existing omitted list; preserve67scope meanwhile. No user panel managed.

### Brief: p3-meaningful-assert-wait (task t306)
- Repository: flat fxwork/t306-meaningful-assert-wait; shared Core read-only.
- Task: Reproduce and correct false-success from missing authored assertion/wait predicates. Focus absent assertion with no target and text assertion/wait with missing/empty expectation; preserve genuine exists/absent and literal text such as null when explicitly authored. Hidden-match/any-match semantics are excluded unless inseparable; report them separately.
- Required reads: Current State; node backlog row6 and reading audit A1/A2/W1/W5; extension assertion-evaluation, actions assert/wait-for-text/wait conditions and existing tests; domain assertion/wait wire request normalization.
- Owns after supervisor-approved file list: assertion-evaluation and wait owner(s), domain assertion/wait request normalization only if reachable malformed input currently defaulted; owning unit tests and one provider-free production Chromium probe. Own report reports/p3-meaningful-assert-wait.md and scoped architecture paragraph. No Core/shared docs/git/identity/host/storage/permissions/other-node edits.
- Definition of done: fail first through actual dispatch where feasible; malformed/no meaningful expectation refused with closed failure and no passed assertion or hanging poll. Valid predicates keep compatible behavior and timeout/state mismatch semantics. Explicit valid text must not be censored by arbitrary string-word bans; assert's contains model cannot use empty substring as real predicate. Blank-value equality requires a real separately supported equality contract, not silent contains-empty.
- Validation: narrow affected tests/source+test types/audit, three-target build and actual content Chromium fixture with fresh build identities; no provider/fullsuite/userpanel/debugger. Proposed exact owners before edits; wait for supervisor provisioning completion before frozen checks. Return report/commands/limits.

### 2026-10-07 - t304 durable claims and literal restart verified
- Agent: Codex supervisor.
- Changed: project-SQL overall/stage claims before effects, bounded immutable binding/receipt joins, authoritative draft read, explicit unsupported promotion; create-all/minimum0 cannot satisfy empty scope. Actual process test is opt-in after owning build.
- Validation: root52/52 after current-dev merge, Corecheck0/build0/dependentwebcheck0; root actual kill/relaunch2/2 zero skips (6.66s), pending effect never repeated and committed draft reconciled with original receipt/run IDs. Core audit0; task integration audit follows. Initial provisioning overlapping worker source changes was not a frozen-source gate; final checks were on frozen merged source.
- Outcome: Bounded durable infrastructure verified; production promotion stays unavailable.
- Follow-up: graph import itself currently writes sequentially; move entire import to actual transaction with injected failure/concurrency regressions, then accepted topology/source/settings/all-writer authority migration. Reports p2-durable-receipts.md and p2-authority-migration-inventory.md preserve source owners/commands and unknowns. No paid runs or user panel.

### Brief: p2-atomic-project-graph-import (task t307)
- Repository: paired fxwork/t307 Core/downstream; Core storage change, existing public callers compatible. No accepting candidate promotion.
- Task: Fix confirmed sequential importMonolithicFlowGraph partial-state risk with actual single project SQLite transaction. Make existing Flow upsert accept/use the transaction executor and keep every import SQL operation in that executor; no nested queued database calls/deadlocks.
- Required reads: Current State; p2-authority-migration-inventory.md graph row; Core instructions; storage/project graph-store/database/unit-of-work and owning graph tests. Inspect all current import callers and transaction nesting before edits.
- Owns after supervisor-approved exact list: graph-store.ts focused import/upsert executor changes, new owning graph import atomicity test file(s), focused Core storage/architecture paragraph, own downstream reports/p2-atomic-graph-import.md. No service/bootstrap/ledger/schema/shared docs/git/host/t305/publication/source-authority edits.
- Definition of done: fail-first injected node/edge/region/revision/partition failure leaves no partially imported Flow/revision/entities/indexes; retry imports complete graph rather than false already_imported. Concurrent same-flow imports across real separate SQLite owners result one complete graph; preserve existing graph patch/inverse/ownership semantics and upsert compatibility. Entire already-imported decision+write must be inside transaction. Reconcile cancellation/storage uncertainty truthfully, no success from compile.
- Validation: owning graph tests and real SQLite fail/reopen/concurrency cases, Core typecheck/owning build and structure audit; bounded fixtures with owned cleanup. Explain transaction boundaries and remaining whole-topology authority gaps. No full suites/provider/browser/userpanel or JSON/global atomicity claim. Proposed owners/caller analysis before edit; provisioning first, root signals ready for frozen checks.

### 2026-10-07 - t305 loaded domain host independently verified
- Agent: Codex supervisor.
- Changed: immutable trusted native-module capture before host IO, owning normalized host stamp and full source inventory, mandatory pre-dispatch Lab gate and per-instance companion copy. Merged both current dev branches before checks; architecture updated.
- Validation: Core binding/diagnostic6/6, generator/cache/Lab21/21, actual built-host headed Chromium/identity/runner55/55 zero skips9.27s, Core/domain/runner typechecks, sequential Core/host/three-target builds and Coreaudit0. Downstream integration audit follows. Full receipt reports/p0-domain-host-identity.md.
- Outcome: Bounded loaded-host provenance verified; paired integration follows. No paid/provider calls or user panel management.
- Follow-up: actual websocket server adapter stamp/retained closure; iframe/Firefox/Edge live identity and trusted P2 browser oracle/authority. t307 atomic graph import independently19/19, matching-stamp Coretypes/build/audit0; merge latest integrated pair before finish.

### 2026-10-07 - t306 integrated verification
- Agent: Codex supervisor.
- Changed: malformed assertions/waits refuse promptly; valid whole-page text ignores unrelated focus and authored targeted predicates preserve resolution. Integrated after current-dev merge.
- Validation: supervisor33/33 owning tests, affected source/test typechecks, audit0 and three22-file target builds; actual unpacked Chromium1/1 passed17.2s. Full handoff reports/p3-meaningful-assert-wait.md.
- Outcome: Narrow P3 slice complete; no paid/site/Firefox/Edge qualification claim.
- Follow-up: t305 loaded host and t307 graph import frozen; root reviewing merged source and repeating checks. Whole authority/promotion and trusted semantic browser proof remain incomplete.

### Brief: p0-server-adapter-identity-design
- Repository: main Core/downstream read-only; own report only.
- Task: Locate the actual executing server websocket adapter and retained owner, then propose the smallest additive generic provenance/stamp/gate slice closing t305's explicit scope gap.
- Owns: reports/p0-server-adapter-identity-design.md only; no shared/source/git/build/panel/provider/runtime-state edits.
- Required reads: Current State, t305 report limits, Core instructions, actual server registration/module owners and build pipeline.
- Definition of done: exact executable artifact and trusted retained capture, expected source/artifact inventory and route-reload/adapter-reload negatives; distinguish browser client package from server adapter. Return precise implementation owners for supervisor approval.
- Validation: source inspection with paths/functions; no executing adapter identity claim from disk or mocks.

### Brief: p2-authority-contract-slice
- Repository: main Core/downstream read-only; own report only.
- Task: Design the first bounded complete accepted-state project-SQL contract/storage foundation from the prior authority inventory, with coherent snapshot/CAS and explicit support limits. Do not enable promotion or cut over existing writers.
- Owns: reports/p2-authority-contract-slice.md only; no shared/source/git/build/panel/provider/runtime-state edits.
- Required reads: Current State, p2-promotion-design.md, p2-authority-migration-inventory.md and concrete existing graph/source/instruction/settings/reader owners.
- Definition of done: exact minimal schema, complete source/settings/router/subflow/graph/instruction vector, stable authority/CAS/adoption invariants, unsupported publication-dependent/JSON scope, and precise new implementation owners/tests. List existing writers that must join before production cutover. No automatic user-data adoption.
- Validation: source evidence and concrete contract proposal, not duplicate general inventory or atomicity proof.

### Brief: p3-professional-paginator (next isolated task)
- Repository: task worktree assigned by supervisor, shared Core read-only; fixture-only implementation.
- Task: Fix confirmed Next initialPage+1 defect in professional-network fixture; preserve exact full collection oracle and promoted/repeated row behavior.
- Owns: apps/scenario-lab/src/scenarios/professional-network/search/people-client.ts; existing professional-network/tests/honest-and-naive-paths.test.ts; own reports/p3-professional-paginator.md. No manifest/oracle/dataset/runtime/extension/Core edits.
- Required reads: Current State and own proposal; relevant backlog16, owning client/tests/helper.
- Definition of done: fail first with actual Chromium Next1?2?3, then use current+1 and retain full23unique/24includingrepeat expected dataset; naive promoted all-card extraction still rejected. Preserve challenge/attempt guard/history/Previous/filter semantics; do not claim rapid press/popstate coverage unless exercised.
- Validation: owning scenario build/two Chromium tests, narrow scenario test, source/e2e typechecks/audit. No full suites/provider/userpanel/debugger/external site. Wait provisioning before checks, report honest limits and freeze for supervisor.

### 2026-10-07 - t307 atomic graph import independently verified
- Agent: Codex supervisor.
- Changed: revision1 existence decision and Flow/revision/node/edge/region/operation/FTS/bounds/partition writes share one actual project SQLite transaction and passed executor; current paired dev merged before final checks.
- Validation: root19/19 owning regressions zero skips8.10s, fluxiqcheck0(36.4s)/owningbuild0(72.7s); current audits/integration gate follow. Root reviewed SQL boundaries; trigger rollback/reopen retry, separate-owner serialization and lost COMMIT acknowledgement tested. Full receipt reports/p2-atomic-graph-import.md.
- Outcome: New graph import atomicity verified; integrated/pushed Corec2ea1e5d/downstreamf7b5c5a9; both audits0. Existing partial legacy imports remain undiagnosed/unrepaired. No complete topology promotion or browser/provider/power-loss proof.
- Follow-up: t309 staged complete-project contract foundation and all-writer/read authority cutover, t310 actual server adapter provenance, t308 paginator. User panel unmanaged; paid A-D remain held.

### Brief: p2-staged-project-authority-foundation (next paired task)
- Repository: isolated paired task assigned by supervisor; Core storage boundary already authorized, no production cutover.
- Task: Implement the concrete contract in reports/p2-authority-contract-slice.md as one complete-project staged immutable snapshot/head foundation. This is preparation for authority migration, not authority over legacy data.
- Owns: new Core storage/project/accepted-state/{contracts,migration,validation,digest,store,index}.ts and owning tests/{validation,store}.test.ts; project/index.ts additive barrel; focused persistence architecture paragraph; own downstream reports/p2-staged-authority-foundation.md. Request approval for further cohesive splits before editing. No service/controller/promoter/ordinary writers/legacy migration edits.
- Required reads: Current State, authority contract report, Core instructions and existing project database/migration/UoW/digest conventions.
- Definition of done: two local numbered snapshot/head tables, complete visual artifacts/settings/router/subflow/source bodies/scopes/bindings, internally derived complete membership/vector; project generation/epoch CAS and durable mutation replay/reconciliation. Staged/tombstoned only, no active/adopted/promoted enum or automatic adoption/read fallback. Refuse JSON/code/global or cross-project instructions/ALL publication-dependent scope. Explicit supplied snapshot, open creates no head. No production capture completeness claim from caller-supplied none list.
- Limits: canonical32MiBUTF8 reject without truncation, IDs200 chars, positive safe generations; immutable history/no pruning; preserve semantic ordering. Future adoption needs separately reviewed all-reader/all-writer fence/participation and explicit opt-in. No feature flag bypass.
- Validation: real SQLite failures before writes/commit, lost-commit-ack/reopen, separate-owner competing CAS, same-key replay/conflict, corruption/tombstone, >100 source/member fixture, fully migrated existing DB checksum/user_version/data preservation and unchanged legacy files. Direct context.sql only within UoW; never queued nested owner calls. Narrow owning tests/Coretypes/build/bothaudits, no fullsuite/providers/panel/browser. Provision first, supervisor signals ready before frozen checks; freeze precise report.

### Brief: p0-executing-server-adapter (next paired task)
- Repository: isolated paired task assigned by supervisor; Core web server/runtime provenance, additive framework capture. User notified boundary/startup compatibility; user panel not managed.
- Task: Implement reports/p0-server-adapter-identity-design.md using actual native-bundled websocket server factory and retained actual ClientGatewayService capture. Browser client package hash is not executing server identity.
- Owns Core: client-gateway/service.ts two provenance delegates + focused service/transport-build-identity/{owner,lease,index} and owningtests; service/index.ts only necessary exports; existing identity diagnostic+test; apps/web/src/server/client-gateway-websocket.ts+owningtest; server/gateway-runtime/{types,load,index}, server/build-identity/{read,index}+tests; lib/fluxiq.ts+owningtest; webpackage/cache steps/.gitignore; owning native generator scripts/build-client-gateway-server.mjs and gateway-server-identity/{build,inventory,normalize,index}+tests. Instrumentation only if proven necessary and root notified.
- Owns downstream: necessary core-web-build/{prepare,types,required-paths,publication,workspace,index,server-adapter}.ts+owningtests; browser-session/server-adapter-identity/{types,screen,inventory,normalize,expected,assert-match,verify,index}+tests; browser-session/index.ts and run-scenario.ts additive gate. Own reports/p0-server-adapter-identity.md; scoped architecture paragraphs. Request further owner changes before editing.
- Required reads: Current State, design report, Core instructions and actual owner/start/staging/cache conventions.
- Definition of done: normalized immutable actual server executable stamp/full intended inventory, preloaded native factory exclusively for supported enabled web startup, actual gateway-owner trusted lease capture BEFORE IO; changed retained rebind rejects, legacy clears active but preserves anchor, old close cannot clear new lease, failed/inactive server unattested. Native-host slot unchanged. Separate authenticated bounded serverTransportIdentity projection; mandatory gate before project/browser/chat/providers. Pure offline exemption preserved.
- Build compatibility: dev/build/native-generator+cache registry and Lab canonical generate before collect/stage/directNext must agree; copy artifact/companion and resolve staged app, generated paths ignored. No stamp from latest disk reported as loaded. Capture limits supported registered owner; no arbitrary-listener/per-session attestation claim.
- Validation: fail-first owner/factory/diagnostic negatives, generator/inventory/cache/staging tests, actual built native server plus real socket handshake/frame/ping/close and retained route/factory reload refusal/fresh owner match, bounded cleanup/provider0. Actual isolated production Next route proof requires explicit panel-management authorization under AGENTS; prepare opt-in fixture but do not launch until authorized. Native socket/synthetic diagnostic and source route tests continue; production Next remains unverified until authorized. Narrow Core/web/runner types/affectedtests/audits, owning artifacts sequentially; no full suite/paid Lab. Provision first and root signals ready, then freeze report for independent supervisor checks.

### 2026-10-07 - Paired push and current dispatch
- Agent: Codex supervisor.
- Changed: t305 pushed Corec051b8f7/downstream3b8f78df; t307 pushed Corec2ea1e5d/downstreamf7b5c5a9. Both paired histories align. Current workers: t308 paginator test-first browser regression, t309 staged-only complete-project snapshot/CAS foundation, t310 actual native server adapter/registered-owner identity and build/staging gate.
- Validation: root observed t3056/6+21/21+55/55 and t30719/19, package types/builds and actual both audit/integration gates0; see individual reports. Taskfinish Core --skip-checks after narrow checks, no broad sweep. Provision t308/t310 completed0; t309 completed0 immediately after first worker source edits, not a frozen-source proof; final worker/root checks required.
- Outcome: Verified narrow units pushed; whole plan remains active/incomplete. Staged foundation is never accepted authority over legacy data, and promotion remains unavailable.
- Follow-up: actual Next panel startup proof explicitly held for panel-management authorization per AGENTS; prepare fixture only. Provider-free native socket/synthetic diagnostic tests proceed. Production semantic interpreter/start/independent browser oracle/performed-command durable attribution and coherent all-writer/adoption migration remain. No paid A-D/user panel management.

### 2026-10-07 - t308 paginator independently verified
- Agent: Codex supervisor.
- Changed: fixture Next uses current successful rendered page; regression traverses Next1?2?3. Current downstream dev merged before independent owning build.
- Validation: root real Chromium2/2 zero skips18.03s, scenario10/10, source/e2e typechecks and audit0. Full24rows/23unique exact oracle unchanged; promoted naive collection still rejects. Task integration follows; report p3-professional-paginator.md.
- Outcome: Fixture correction verified, not paid creation/replay or extension playback qualification.
- Follow-up: t309 staged authority and t310 executing adapter; command session-binding regression next. Rapid presses/Previous/popstate remain unexercised.

### Brief: p0-command-session-binding (next paired task)
- Repository: isolated paired task assigned by supervisor; generic Core gateway command trust.
- Task: Reproduce/fix known pending command settlement by a different ready session; preserve original sender identity through promise and event boundary.
- Owns: Core client-gateway/service/{commands,inbound}.ts and existing client-gateway/tests/service.test.ts; focused architecture paragraph; own downstream reports/p0-command-session-binding.md. No service.ts/t310identity, protocol/session lifecycle/public contract changes or durable journal implementation.
- Required reads: Current State, own proposal, actual pending/inbound/event owner and real pairClient test helper, Core instructions.
- Definition of done: settle accepts sender sessionId and checks pending owner BEFORE timer deletion/resolve; explicit wrong-session disposition suppresses inbound publication. Real ready A/B: B sends known A command ID, A promise remains pending/no event; A valid answer succeeds once. Wrong result cannot shorten original timeout. Unknown/late event compatibility remains explicitly unbound and is not certified receipt evidence; durable journal and late-session attribution still required.
- Validation: fail-first owning real service tests, narrow gateway/runtime transport tests, Coretypes/build/audits. No providers/panel/browser/fullsuite. Product edits wait provisioning; freeze precise report for supervisor independent rerun. No git/shared docs.


## Additional verified task briefs

### Brief: sanitized-field-typing (t315, supervisor)
- Repository: task/t315-sanitized-field-typing in main checkout; no Core source changes. Worker none.
- Task: Reproduce real browser sanitization of number1.5/-3 and ISO date, then preserve requested native values and refuse malformed formats without partial mutation. Preserve normal text/autocomplete character events, page cancellation/revert and sensitive value redaction.
- Owns: keyboard/type-text.ts, focused new keyboard/sanitized-input.ts + barrel if needed; e2e/runtime/tests/sanitized-field-typing.spec.ts; scoped action-runtime architecture paragraph and own reports/p3-sanitized-field-typing.md. Native format acceptance comes from detached same-type browser value sanitization, not silent normalization.
- Validation: fail-first real production content via runtime harness, exact retained field/application state, invalid/reverted/readonly/cancelled paths, unsent form and sensitive readback. Affected source/testtypes, owning builds and audit only; no fullsuite/provider/panel. Final rebuilt background/content identity recorded; no Firefox/Edge/site qualification claim.


### Brief: user-script-browser-feasibility (t314)
- Repository: isolated downstream fxwork/script-feasibility/t314-user-script-browser-feasibility; private sibling Core detached/read-only. Worker p0_cancel_control. Provision first; no edits until ready.
- Task: Implement a provider-free actual installed Chrome/Edge User Scripts API feasibility fixture, not a product capability. Read p4-script-request-feasibility.md, current browser harness and current official primary API/permission/CSP docs. Confirm installed executable versions; never inspect real browser profiles.
- Initial owns: own reports/p4-user-script-browser-probe.md plus proposed focused apps/extension/e2e/user-script-feasibility/ fixture/harness/owning tests. Name exact cohesive files for supervisor before edits. Generate minimal probe extension/local pages in ignored owned temporary directories only; no production manifests/action registry/settings/Core change.
- Required proof: supported135+ one-shot USER_SCRIPT, missing/revoked user-controlled permission/toggle, site/document targeting, page CSP and per-world connect-src behavior. Exercise only isolated synthetic pages/accounts; no secrets, real sites, infinite-loop page hangs or claims of hard termination. Network isolation versus DOM-triggered navigation must be reported separately and honestly. No debugger permission/input/JS executor in product.
- Limits: modern branded Chrome extension loading may require documented CDP loadUnpacked test infrastructure; investigate actual availability, never infer from Chromium134. Browser UI enablement only in owned temporary profile, not editing browser storage or normal settings. Firefox parity remains separate unless an actual bounded supported probe is feasible.
- Validation: exact actual browser/version/API/method outcomes, errors and current-source fingerprint; bounded cleanup verifies resolved owned roots. No provider/panel/fullsuite/git/shared docs or qualification claim. Browser/API prototype is readiness evidence, not permission to ship arbitrary JS or enable requests. Freeze report/source for root independent rerun.


### Brief: p0-executing-server-adapter (next paired task)
- Repository: isolated paired task assigned by supervisor; Core web server/runtime provenance, additive framework capture. User notified boundary/startup compatibility; user panel not managed.
- Task: Implement reports/p0-server-adapter-identity-design.md using actual native-bundled websocket server factory and retained actual ClientGatewayService capture. Browser client package hash is not executing server identity.
- Owns Core: client-gateway/service.ts two provenance delegates + focused service/transport-build-identity/{owner,lease,index} and owningtests; service/index.ts only necessary exports; existing identity diagnostic+test; apps/web/src/server/client-gateway-websocket.ts+owningtest; server/gateway-runtime/{types,load,index}, server/build-identity/{read,index}+tests; lib/fluxiq.ts+owningtest; webpackage/cache steps/.gitignore; owning native generator scripts/build-client-gateway-server.mjs and gateway-server-identity/{build,inventory,normalize,index}+tests. Instrumentation only if proven necessary and root notified.
- Owns downstream: necessary core-web-build/{prepare,types,required-paths,publication,workspace,index,server-adapter}.ts+owningtests; browser-session/server-adapter-identity/{types,screen,inventory,normalize,expected,assert-match,verify,index}+tests; browser-session/index.ts and run-scenario.ts additive gate. Own reports/p0-server-adapter-identity.md; scoped architecture paragraphs. Request further owner changes before editing.
- Required reads: Current State, design report, Core instructions and actual owner/start/staging/cache conventions.
- Definition of done: normalized immutable actual server executable stamp/full intended inventory, preloaded native factory exclusively for supported enabled web startup, actual gateway-owner trusted lease capture BEFORE IO; changed retained rebind rejects, legacy clears active but preserves anchor, old close cannot clear new lease, failed/inactive server unattested. Native-host slot unchanged. Separate authenticated bounded serverTransportIdentity projection; mandatory gate before project/browser/chat/providers. Pure offline exemption preserved.
- Build compatibility: dev/build/native-generator+cache registry and Lab canonical generate before collect/stage/directNext must agree; copy artifact/companion and resolve staged app, generated paths ignored. No stamp from latest disk reported as loaded. Capture limits supported registered owner; no arbitrary-listener/per-session attestation claim.
- Validation: fail-first owner/factory/diagnostic negatives, generator/inventory/cache/staging tests, actual built native server plus real socket handshake/frame/ping/close and retained route/factory reload refusal/fresh owner match, bounded cleanup/provider0. Actual isolated production Next route proof requires explicit panel-management authorization under AGENTS; prepare opt-in fixture but do not launch until authorized. Native socket/synthetic diagnostic and source route tests continue; production Next remains unverified until authorized. Narrow Core/web/runner types/affectedtests/audits, owning artifacts sequentially; no full suite/paid Lab. Provision first and root signals ready, then freeze report for independent supervisor checks.


### Brief: qualification-readiness-first-three (t312)
- Repository: isolated downstream fxwork/t312-qualification-readiness-first-three; shared Core read-only. Worker p0_build_identity.
- Task: Implement only professional-network-audit-stale-requests, auction-marketplace-remove-watched-accessories and crossborder-marketplace-collect-official-coupon-only from reports/qualification-ten-new-task-proposal.md. They are NEW tasks, not recovered historical IDs. Preserve every existing57 ID/instruction/oracle.
- Owns: those three site live-tasks.ts and exact manifest/barrel owners; new qualification/{workflow,expected,index}.ts and tests/expected.test.ts; existing site honest/naive browser tests. Name exact current owners in report before editing; no state/renderer edits without supervisor review. Own reports/qualification-first-three.md. No shared inventory test/document edits, Core edits or other sites.
- Required reads: Current State, own proposal sections1/4/9, scenario contracts and owning tests. Literal exact datasets/account outcomes; unique workflow/columns. Each honest browser path and wrong-outcome negative must exercise actual fixture account facts, not copied success metadata.
- Validation: narrow owning scenario/oracle tests, source/e2e typechecks, owning fixture build, real isolated Chromium honest/negative proof, audit. Provision first; wait supervisor ready before edits/frozen checks. No provider/Lab/fullsuite/panel/git. Freeze report with commands, measured counts and limits; root independently verifies. No qualification pass claimed from fixture readiness.


### Brief: durable-command-reconciliation (t313, bounded owner discovery first)
- Repository: paired fxwork/t313 trees; Core gateway/runtime command trust boundary. Worker p0_acceptance. Provisioning; no source edits until ready and exact owners approved.
- Task: Trace actual command dispatch/ack/project-run IDs, then implement a durable command claim/result join before send and truthful restart reconciliation, preserving normal session/action permissions. Candidate receipts must not treat unknown/late unbound events as effects evidence.
- Approved first source partition: generic client-gateway/service/command-ledger/{contracts,controller,index}.ts + owning tests; actual project storage/project/command-ledger/{contracts,migration,store,index}.ts + real SQL tests and additive project barrel; own report. Production commands/inbound/service/executor/context wiring still held for the next serial partition. No authority namespace/cutover source approved. Exact discovery report names both real dispatch paths and missing context.
- Required contract: durable stable attempt/command/client/session/run binding independent of payload digest; claim before send; same-key conflict refuse; pending/restarted effects remain unknown, no blind resend; full owner/operation/request/result joins refuse borrowed receipts. Receipt-only safe status/classification/timestamps/resultdigest, no raw parameters/page/results/secrets. Restart missing usable payload returns result_unavailable, never fake extraction success. Actual dispatcher/context/permission joins must land before any production authority claim. Allocate local migration after0026; direct context.sql inside TX.
- Validation: real SQL lost acknowledgement/process restart and paired sender negatives; bounded owning tests/types/build/audits. No provider/panel/fullsuite/git/shared docs or user-state mutation. Describe unsupported joins before source approval, avoid model outcome claims. Freeze brief in own report for root review; root verifies integrated code independently.


### Brief: durable-command-production-context-review (t313, report only)
- Worker: p0_cancel_control; paired fxwork/t313 trees. Independent review of next production partition while supervisor verifies frozen ledger. No source edits or builds.
- Read: Current State, p2-durable-command-reconciliation.md final executor discovery, generic command-ledger contracts/controller and SQL store contracts. Do not reread broad plans.
- Inspect exact Core owners: automation-studio/runtime/{service,io-policy,composite-executor}.ts and executor/{contracts,node-execution,graph-run}.ts; runtime/{contracts,service,client-gateway-transport}.ts; client-gateway/service/{commands,inbound,types}.ts; automation-studio/client-gateway/bridge.ts; programs/_shared/runtime.ts. Downstream domain/runtime/adapter.ts and io/gateway-output-dispatcher.ts.
- Write only reports/p2-command-production-context-review.md. Propose smallest exact file partition for both production paths, server-issued run/invocation context, claim-before-send/receipt-before-resolve, unresolved-command terminal/no-retry and actual resume fence. Preserve existing permissions/cancel/withholding.
- Explicitly determine whether unbound action_result compatibility events can be removed from Runtime pending completion without losing legitimate awaited completion. Explain async inbound races, production project SQL injection and safe result digest parsing. No model metadata authority or new namespace/schema.
- Return verified source findings with line references, exact required exports/contract changes and unknowns; no tests/provider/panel/git/shared docs. Supervisor must approve source owners before implementation.



### Brief: qualification-state-preservation (t316)
- Repository: fxwork/qualification-next/t316-qualification-state-preservation, private sibling Core detached/read-only. Worker p0_build_identity; provision15520 pending, no edits until ready.
- Task: Add only NEW bigbox-retail-ensure-soap-quantity, everything-store-restore-saved-cloths and local-classifieds-remove-sold-saves from ten-task proposal sections2/5/7. Preserve all original57 and t3123 additions; total63 only after combined integration.
- Initial owns: those3 site live-tasks/manifest and necessary barrel owners; new qualification/{workflow,expected,facts,index}.ts + owning tests; existing owning browser/scenario tests, narrow actual-account oracle readout owners to be named BEFORE editing. Own reports/qualification-state-preservation.md. No shared global inventory test/document, other sites/Core/product node edits.
- Contract: exact literal independent row identities/order/quantities/full account state. Bigbox ensure total3 twice produces no added line/store change; everything transfers existing saved S1 without duplicate/newline and keeps S2; local removes Sold save without hidden/messages/offers. Actual current account facts, not stale readouts or just count/confirmation; explicit permission labels. Refresh only private instrumentation from actual mutation response if necessary, preserve visible fixture quirks. Wrongoutcomes fail before manual reload; also verify durable reload.
- Validation: owning old+new unit/oracle tests, real isolated Chromium honest and deliberatewrongoutcome probes, source/e2etypes/owningbuild/audit. Literal authored records independent from renderer/filter code; record lifecycle/staticcodepin exactly. No provider/fullsuite/panel/git/shared docs. Freeze reports and source for independent root checks; no model/extension qualification claim.


### Brief: original-project-authority-cutover-review (report only)
- Worker: p0_cancel_control; main Core/downstream source inspection, own downstream reports/p2-original-project-authority-review.md only. No source/build/browser/provider/panel/git/shared docs.
- Read Current State, consultant-revision P2 authority requirements, verified staged foundation report and prior p2-authority-cutover-brief.md. Prior asql reserved-namespace/new-project-only proposal remains UNAPPROVED and does not satisfy original-project candidate acceptance. Preserve existing IDs and user data.
- Find a coherent explicit adoption/capture/read/all-writer cutover using actual project SQL snapshot owner and original IDs. Reuse schema, normal compiler/permissions, source/settings/membership and all actual production readers/writers; no second graph schema or shadow-only feature claim.
- Inspect exact prior writer table owners and actual project pool/UoW/outbox/coordinator boundaries; identify minimum first implementable partition and full later activation gate. Specify race handling when legacy writer begins before adoption and completes after capture, cross-process writers, missing graph/global canonical writes, file/instruction/index revisions. A lookup-only marker or callback preflight is not atomic fencing.
- Consider a project-SQL claim/guard that all legacy official writers acquire before effects and release only after full operation, with adoption refusing pending/unknown claims; if viable explain migration/admission/restart/compatibility and enumerate exact ingress/read joins. Unknown interrupted file/global write cannot silently activate from mixed capture. Refuse unsupported dependencies without silently creating a new project.
- Return concrete owner/contract proposal plus unsupported assumptions. No namespace/source implementation authorized. Root owns acceptance of architecture and integration; report is not proof or activation.


### Brief: typing-target-liveness (t319, supervisor)
- Task branch in main checkout; owned private HTTP/production extension proof. Core source unchanged, current owning dependency build needed before unpacked extension build.
- Own existing content/actions/type.ts, owning actions/tests/type-unsent-form.test.ts fake connected field property, existing e2e/runtime/tests/sanitized-field-typing.spec.ts actual removed/replaced-field negative, scoped architecture extension-client typing paragraph and reports/p3-typing-target-liveness.md.
- Reproduce actual false success when input handler removes/replaces target but detached object retains requested value. Original resolved control must still be connected at immediate readback; refuse passed result and any submit Enter after detachment, even if old value matches. Do not silently resolve a replacement target or claim async application acceptance.
- Preserve actual native whole-value/per-character semantics, redaction, form/permission behavior; no source change in keyboard/other nodes unless reproduction requires revised brief. Real content+background identities, wrong visible replacement value and zero submit/Enter evidence.
- Fail-first browser proof before implementation, then source/e2e types, narrow owning content tests, owning all-target extension build, real unpacked Chromium proof and audit. No fullsuite/provider/panel/user-state/gitforce. Document exact results/limits before integration/push.


## Retired verified t321 brief

### Brief: typing-observation-window (t321, supervisor)
- Root task branch in main checkout; owned extension fixture only. Own content/actions/type.ts, existing actions/tests/type-unsent-form.test.ts async test contract, existing e2e/runtime/tests/sanitized-field-typing.spec.ts delayed/microtask revert negatives, extension-client scoped paragraph and reports/p3-typing-observation-window.md.
- Reproduce truthful readback gap after deferred application handlers. Execute already awaits typeAction, so use bounded50ms timer observation after typing as existing checkable-state does, then original connected-control value comparison. Recheck existing actionability before requested Enter after the await; no pre-dispatch refusal flag after text already typed. No silent replacement or retry.
- Preserve per-character/native format/redaction, initial permission/actionability and form messages. Real-browser fail-first before fix, then named units/types/build/current identity/browser/audit. This finite window is not general asynchronous/server acceptance or React qualification. No Core/domain/schema changes/fullsuite/provider/panel/user-state reset.


## Retired independently verified t318 brief

### Brief: qualification-final-four (t318)
- Worker: p0_build_identity; supervisor provisions separate downstream task/private read-only Core. No source until READY/exact owners approved. Preserve all original57 and prior six new tasks; final denominator67, no historical recovered IDs/pass claim.
- Implement proposal sections3/6/8/10: company review without booking, job closed saved cleanup, photo existing collection union, social pending request audit. Read only Current State, these proposal sections and owning scenario conventions.
- Name exact per-site manifest/live-tasks/qualification module+tests/browser owners and state-backed readout/bootstrap hook BEFORE editing. Company cross-frame review must provide positive exact review plus independently observed no bookings/deposits/quotes/newsletter on current page after wrong pay+leave; job exposes existing filled-heart accessible Unsave job label, delete point; photo literal full saved/collection/follow/liked/outbox state; social complete8 ordered literal requests no confirmation/delete/message.
- Pure private fact formatter must read actual response.state and update current DOM before returning result, no stale badge/no secret body. Preserve existing controls/mutation/UI quirks; no generic fixture helper/state operation changes. Full membership/IDs; counts only complete baseline-zero forbidden collections. Actual cross-origin frame proof, no JS/network mutation bypass.
- Exact datasets hand authored from proposal, unique workflows/columns, explicit start facts. Negative paths must preserve correct-looking requested table while forbidden side effects/full membership fail. Photo repeated union desired-state idempotence; social full8 vs home4 negative.
- Own reports/qualification-final-four.md only plus approved per-site source; no shared inventory/docs/Core/domain/node changes. Supervisor owns original baseline and67 aggregate tests/classifications.
- Narrow scenario source/e2e types/owning fixture build/owning tests/real isolated Chromium/audit, no fullsuite/provider/panel/git/real profile. Freeze with commands/source digest/actual measured failures/results/limits. Root independently verifies/integrates; fixture readiness is not model qualification.




## Retired independently verified t317/t320 briefs

### Brief: durable-gateway-production-seam (t317)
- Worker: p0_acceptance; isolated paired fxwork/t317 trees, provision after verified t313 integration. No source edits until READY; identify exact added filenames before edits.
- Read Current State and reports/p2-command-production-context-review.md Gateway-only first production partition; Core instructions. Foundation is receipt-only; no raw action/results/page secrets persisted.
- Own Core generic: client-gateway/service/command-ledger/{contracts,controller,index}.ts, new {context,dispatch}.ts and owning tests; existing service/{commands,inbound,transport,types,index}.ts and client-gateway/service.ts narrow delegates; client-gateway/index.ts necessary exports. No client wire changes.
- Own Core program: new automation-studio/runtime/service/command-context/{contracts,controller,index}.ts + tests; runtime/service.ts narrow readonly collaborator/constructor; programs/_shared/runtime.ts generic resolver injection using existing actual private pool and validated actual stored session. Own scoped architecture/automation-studio/client-gateway.md paragraph and downstream reports/p2-durable-gateway-production-seam.md only.
- Implement opaque server-issued context, impossible to forge via JSON/model metadata; exact actual project/run/graph/invocation/attempt/effect ownership. Generic resolveCommandLedger(context) returns domain-neutral leased port+close; no generic program-storage import/exposed pool. Freeze actual request before await and compute bounded original digest.
- Real ready selected client/session immutable claim before queue/send; revalidate readiness/signal after await. Receipt-only replay committed=>result_unavailable, pending/unknown=>outcome_unknown and no resend. Legacy context-free path retains behavior; malformed supplied context NEVER downgrades to legacy. SQL missing refuses before send.
- Parse closed bounded actual sender result; status unknown/no acknowledgement/timeout/disconnect/cancel/send-after-effect throw stay uncertain. Compute original bounded resultDigest/server receive time; no client provenance authority. Serialize result/timeout/abort/disconnect races, commit/read exact receipt BEFORE public resolve or authoritative event; preserve right-session/duplicate protections and normal permissions.
- Cover every ledger lease close/error path and gateway disposal. No automatic continuation/new command key for unknown. Program factory validates existing session/project; no LLM API/endpoint grants context issuance. Actual node/run-scope allocation, complete run scans/atomic same-run admission and executor/domain propagation remain next serial partition, not claimed here.
- Validate provider-free real program pool+stored session+actual gateway/socket; delayed/failing claim zero sends, commit delayed before public resolve, wrong sender/forgery/malformed/oversize/duplicates, uncertain send, timeout/abort/disconnect/commit-loss races, legacy compatibility/permission denial/lease cleanup. Narrow types/build/owner tests/audits; no fullsuite/panel/provider/git/shared docs. Freeze before root independent proof.




### Brief: original-project-authority-guard (t320, bounded contracts first)
- Worker: p0_cancel_control; paired isolated fxwork/t320 trees provisioned by root. Read Current State and own p2-original-project-authority-review.md first foundation partition. Source HOLD until provision READY and exact contracts approved; original IDs, no reserved namespace/new project substitute.
- Own new Core storage/project/authority-guard/{contracts,migration,validation,store,index}.ts + owning tests/process probe, additive project/index.ts only. Scoped architecture persistence paragraph: name exact existing doc before editing. Own downstream reports/p2-original-project-authority-guard.md only; no shared docs/git.
- Propose closed bounded original-project/operation key/request/owner/revision/capture contracts first. Next local migration0028 after0027; no old checksum edits. Durable pre-effect claim COMMIT separate from external-operation callback. Serialize per-project topology claims and block capturing mode; pending/unknown persists across error/process death and never expires. Same key original request joins, conflicts/foreign borrowed records refuse.
- Successful whole-operation completion increments legacy revision once with immutable receipt, never a nested helper's first SQL write. Same owner/key replay cannot repeat external sentinel; completion lost COMMIT ack reconciles original record. Atomic beginCapture compares completed revision and no pending/unknown inside same actual transaction; later legacy claim refuses; recorded capture key/revision/protocol/owner remain immutable across restart.
- No active/tombstone/adoption endpoint or snapshot activation method. Capture release/reconcile requires exact recorded read-only capture owner; do not accept arbitrary caller success/no-effects fields as independent proof. Store is infrastructure/trusted owner port only; actual all-writer wiring/global ownership/capture/compiler/pinned readers/promotion stay unavailable.
- Use existing project pool/UoW direct context.sql, no nested queued transaction or uncommitted started row pretending pre-effect durability. Store-issued timestamps and strict original owner/operation/request/result/historical joins. No raw page/source/secret payload persisted.
- Narrow real SQLite two owners/concurrent legacy-vs-capture, preclaim rollback zeroeffects, uncertain synthetic multi-store sentinel, revision/key conflicts/corrupt/borrowed receipts; literal child kill after external sentinel+pending and aftercompletion beforeack then reopen/no repeat. Provider-free explicit probe; source/e2etypes/owning build/audits, no fullsuite/panel/user data. Freeze then root independently reviews/runs.
- One-time old uninstrumented writer drain remains separate authorization/deployment gate; no code can attest it from marker/PID/TTL. No actual original-project authority/candidate acceptance claim from this foundation.


## Retired t322 discovery brief

### Brief: original-writer-coverage (t322, read-only discovery)
- Worker: p0_build_identity. Main checkout task/t322-original-writer-coverage; no source/build/test/git/shared doc edits. Own only reports/p2-original-project-writer-coverage.md. Read Current State and reports/p2-original-project-authority-review.md exact checklist.
- Investigate actual Core source in sibling MAIN !FluxIQ read-only; do not use stale flat task buddy. t320 foundation still isolated/unintegrated; do not assume production guards exist.
- Enumerate actual original-project SQL, global canonical/resource, file/projection/private repair and public facade writer entrypoints, ownership routing and pin readers. Distinguish whole-operation effect boundaries from nested TX/repair reads; identify bypasses, missing/deleted resource routing and injectable ports.
- Propose smallest coherent next implementation partition with exact existing/new paths and closed interfaces. Canonical global companion owner protocol must preserve original IDs and tombstones, bounded scopes, atomic allocation and owner joins; no caller-selected project authority, marker/TTL/readonly-open proof.
- Identify actual graph/source/settings/membership capture inputs, unsupported dependencies and mandatory old-process drain; no adoption endpoint or alternative namespace. Provide source evidence and concrete provider-free verification matrix, including two-process races/kill boundaries/foreign-resource and >100 membership tests.
- Write concise report with findings/unknowns/limitations and candidate first partition; no implementation or executable proof claim. Return exact paths and unresolved design decisions for supervisor review.


## t326 prior chronological integrated state (preserved receipts)

**Implementation authorized locally 2026-10-06; P0 in progress.** t296 is integrated
and pushed: downstream acceptance `62ceaac8`, Core `6c449022`; downstream identity
`2c76ba48` is also pushed. Supervisor reran the two changed
test files (29/29), the fluxiq typecheck and Core structure audit; downstream task
integration audit passed. The identity slice passed independent production Chromium
match/mismatch checks, 22/22 owning tests and runner typecheck after integration.
t298 cancellation is integrated as downstream43e5e54b/Core2ee06482. Supervisor
rebuilt current pair and repeated headed Stop build/run2/2, owning reauthor9/9,
Core typecheck/build and both integration audits pass. Running Core-server identity
is integrated/pushed (Corec8501c15/downstream267a4215), after independent
Core/routes59/59, generator10/10, HTTP15/15 and headed identity/runner61/61.
Loaded domain host t305 is independently verified (Core6/6, generator/cache21/21,
headed actual built host/runner55/55); integrated/pushed Corec051b8f7/downstream3b8f78df. t299 candidate facade is integrated (Core7f9bae15/downstreamcb792dee)
after independent actualservice/API53/53, package/dependentweb types and audits.
t300 receipt/detached infrastructure is integrated (Core386b4c15)
with production joins pending. t301 typed readiness is integrated (b2ad00de);
t303 navigation is integrated/pushed ddc8befd after owning114/114 and production
Chromium1/1. t304 durable ledger passed independent52/52/types/build; literal
owned child-process termination/restart checks passed2/2 independently, pushed
Core04b51050/downstream1c55b131. t306 meaningful assert/wait integrated and
pushed after root33/33 and production Chromium1/1 (17.2s).
t307 atomic graph import is integrated/pushed Corec2ea1e5d/downstreamf7b5c5a9
after independent19/19, merged package types/build and both audits0.
t308 paginator is integrated after root Chromium2/2, scenario10/10, types/audit0;
t311 pending command session binding is integrated/pushed Core210453c1/downstreamaed8ae54 after root23/23 and both audits0. t313 command receipt foundation is integrated/pushed Core6712b950/downstreamc40734d7 after root30/30 merged checks, actual types/build and audits0; actual child restart2/2. t317 explicit gateway production seam integrated/pushedCore38b2d8f4/down94fecac0 after independent57/57/types/audit0; actual Flow propagation/run fences remain absent. t309 staged project snapshot foundation is integrated/pushed Core595daf8d/downstream1115c14a after root37/37, actual Core typecheck/build and both audits0. t310 native executing server-adapter identity is integrated/pushed Coref0a5f747/downstreamca788c03; actual Next proof held for explicit authorization. t318 final4 independently verified after merged dev: owner/global87/87, actual Chromium10/10 (27.139s), types/build/audit0, complete ordered original57 plus exactten NEW IDs/67 total; integrated/pushed47322131. t316 state-preservation tasks are integrated after root87/87 and Chromium6/6 (16.380s), types/build/audits0; total63. t312 first three clearly NEW fixture tasks are integrated/pushed downstreamb7c91b4d, originally60 total with the complete ordered original57 preserved; root70/70 owner/catalog checks, Chromium9/9, types/build/audits0. This is readiness, not created-Flow qualification. t315 native structured field typing is integrated/pushed downstreamd1d57889 after real Chromium1/1, source/e2etypes0 and final integrationaudit0. t314 installed Chrome154/Edge154 User Scripts prototype is integrated/pushed downstreamc6fec276 after root2/2 (9.9s), merged extension source/e2e types0 and audit0; still no product capability. t319 typing liveness is integrated after root actual Chromium1/1 (21.8s), unit7/7, types/build/audits0; no detached original can pass/submit. t321 typing observation integrated/pushed6bd6c9dd: queued reverts fail after50ms and post-typing actionability prevents Enter through a newly raised dialog; Chromium1/1, named units7/7. t320 original-ID writer/capture guard foundation integrated/pushedCoread232818/down d77aa1e2 after independent merged51/51, killed combined-built child2/2, actual types/build/audit0; no all-writer/adoption join yet. No P0 completion or fresh A-D qualification is claimed.


## t326 older verified ledger detail

### 2026-10-07 - t306 integrated verification
- Agent: Codex supervisor.
- Changed: malformed assertions/waits refuse promptly; valid whole-page text ignores unrelated focus and authored targeted predicates preserve resolution. Integrated after current-dev merge.
- Validation: supervisor33/33 owning tests, affected source/test typechecks, audit0 and three22-file target builds; actual unpacked Chromium1/1 passed17.2s. Full handoff reports/p3-meaningful-assert-wait.md.
- Outcome: Narrow P3 slice complete; no paid/site/Firefox/Edge qualification claim.
- Follow-up: t305 loaded host and t307 graph import frozen; root reviewing merged source and repeating checks. Whole authority/promotion and trusted semantic browser proof remain incomplete.

### 2026-10-07 - t307 atomic graph import independently verified
- Agent: Codex supervisor.
- Changed: revision1 existence decision and Flow/revision/node/edge/region/operation/FTS/bounds/partition writes share one actual project SQLite transaction and passed executor; current paired dev merged before final checks.
- Validation: root19/19 owning regressions zero skips8.10s, fluxiqcheck0(36.4s)/owningbuild0(72.7s); current audits/integration gate follow. Root reviewed SQL boundaries; trigger rollback/reopen retry, separate-owner serialization and lost COMMIT acknowledgement tested. Full receipt reports/p2-atomic-graph-import.md.
- Outcome: New graph import atomicity verified; integrated/pushed Corec2ea1e5d/downstreamf7b5c5a9; both audits0. Existing partial legacy imports remain undiagnosed/unrepaired. No complete topology promotion or browser/provider/power-loss proof.
- Follow-up: t309 staged complete-project contract foundation and all-writer/read authority cutover, t310 actual server adapter provenance, t308 paginator. User panel unmanaged; paid A-D remain held.

### 2026-10-07 - Paired push and current dispatch
- Agent: Codex supervisor.
- Changed: t305 pushed Corec051b8f7/downstream3b8f78df; t307 pushed Corec2ea1e5d/downstreamf7b5c5a9. Both paired histories align. Current workers: t308 paginator test-first browser regression, t309 staged-only complete-project snapshot/CAS foundation, t310 actual native server adapter/registered-owner identity and build/staging gate.
- Validation: root observed t3056/6+21/21+55/55 and t30719/19, package types/builds and actual both audit/integration gates0; see individual reports. Taskfinish Core --skip-checks after narrow checks, no broad sweep. Provision t308/t310 completed0; t309 completed0 immediately after first worker source edits, not a frozen-source proof; final worker/root checks required.
- Outcome: Verified narrow units pushed; whole plan remains active/incomplete. Staged foundation is never accepted authority over legacy data, and promotion remains unavailable.
- Follow-up: actual Next panel startup proof explicitly held for panel-management authorization per AGENTS; prepare fixture only. Provider-free native socket/synthetic diagnostic tests proceed. Production semantic interpreter/start/independent browser oracle/performed-command durable attribution and coherent all-writer/adoption migration remain. No paid A-D/user panel management.

### 2026-10-07 - t308 paginator independently verified
- Agent: Codex supervisor.
- Changed: fixture Next uses current successful rendered page; regression traverses Next1?2?3. Current downstream dev merged before independent owning build.
- Validation: root real Chromium2/2 zero skips18.03s, scenario10/10, source/e2e typechecks and audit0. Full24rows/23unique exact oracle unchanged; promoted naive collection still rejects. Task integration follows; report p3-professional-paginator.md.
- Outcome: Fixture correction verified, not paid creation/replay or extension playback qualification.
- Follow-up: t309 staged authority and t310 executing adapter; command session-binding regression next. Rapid presses/Previous/popstate remain unexercised.

### 2026-10-07 - Memory compacted for continuation
- Agent: Codex supervisor.
- Changed: kept authoritative Current State/schedule, three active worker briefs and recent receipts; archived all previous text intact once ledger exceeded20 entries, per working-document protocol.
- Validation: source text preserved in authored archive; active t309/t310/t311 briefs retained exactly; working index regeneration follows. No product behavior or tests changed.
- Outcome: Durable readable handoff; whole plan remains active.
- Follow-up: independently review current worker source/results; preserve held Next startup and paid qualification gates.

### 2026-10-07 - t309 root verification and next bounded dispatch
- Agent: Codex supervisor.
- Changed: staged complete-project snapshot CAS/immutable history/receipt join reviewed after current paired dev merge; root required borrowed-owner/operation/generation negatives before accepting storage claim. Production activation remains unavailable. Concrete all-writer/read cutover report retained as a proposal, not a product switch.
- Validation: root37/37 zero skips (testtotal9.73s, wall29.95s), actual fluxiqcheck0(38.432s)/build0(46.106s), Coreaudit0; downstream integration gate follows. Full receipt reports/p2-staged-authority-foundation.md.
- Outcome: Narrow staged foundation verified; no production capture/permission/compiler/active-reader/promotion or OS-kill/power-loss proof. Paired integration follows. t311 pushed Core210453c1/downstreamaed8ae54.
- Follow-up: t310 independent merged-source review/native socket probe; prepared Next proof requires explicit panel authorization. t312 implements three clearly NEW tasks toward67; original57 remain intact. User has not supplied the historical missing ten, so proposed additions are labelled new rather than recovered. No paid qualification or user panel started.

### 2026-10-07 - paired staged foundation pushed; command trust next
- Agent: Codex supervisor.
- Changed: t309 integrated/pushed downstream1115c14a/Core595daf8d; immutable staged-only snapshot foundation remains unavailable to ordinary production writers. t313 provisioned as a paired command reconciliation unit; exact owners/production join reviewed before edits.
- Validation: root37/37, actual types/build and both audit gates0. Initial taskfinish issued from task worktree refused because dev belongs to main checkout; reran from main successfully, no forced checkout/removal. Core narrow gates observed before --skip-checks integration.
- Outcome: Paired coherent unit pushed. New managed-ID authority proposal is not approved source or a substitute for original candidate/promotion scope; existing-project requirement remains open.
- Follow-up: t310 merged current source independently owner8/8 and generator/cache9/9; package checks/build/proof in progress. t312 first3 new readiness tasks; paid qualification remains held. No user panel managed.

### 2026-10-07 - t315 native structured field typing verified
- Agent: Codex supervisor.
- Changed: native number/calendar/time controls admit exact whole value before one synthetic replacement input/change; malformed native formats preserve old value. Text/autocomplete remains per character, page cancellation/readback/redaction/submit gates preserved. Architecture paragraph updated.
- Validation: initial stale-build refusal then owning rebuild; real fail-first1.5 returned failed; final production Chromium1/1 passed17.5s (18.8s total), background/content identity matched, all6 native type families and cancellation/revert/readonly/malformed/text/redaction/no-submit cases. Owning3targets22files/build0; source/e2etypes0 finalrepeat observed; final taskaudit0 after regenerating stale handoff index. No broad suite/provider/panel/Core source change. Full report reports/p3-sanitized-field-typing.md.
- Outcome: Narrow typed readiness slice verified; not trusted keyboard input or async/React/Edge/Firefox/model qualification. One fixture synthetic value was accidentally in commandId; corrected ordinal IDs before final success.
- Follow-up: t310 actualnative identity verified, preparedNext test awaiting explicitpanel authorization; t312 frozen3 new tasks rootreview; t313 durable command infrastructure and t314 installedbrowser script feasibility active.


### 2026-10-07 - installed-browser feasibility independently verified; next3 tasks
- Agent: Codex supervisor.
- Changed: t315 pushed downstreamd1d57889 after final typecheck and corrected generated-index integration gate0. New t316 bounded3-site preservation unit provisioned; no shared Core movement. Current reports keep production/native/browser readiness separate.
- Validation: root t314 actual installed Chrome154.0.8037.98/Edge154.0.4258.62 prototype2/2 zero skips9.9s on identical7-file fingerprint87f504c1c75b7dd09268f01ae1bd49301560d001da01f4881a773247b4e1baee. Missing/revoked enablement and stale/ungranted document refuse; isolated USER_SCRIPT works; no providers/panel. Final merged types/audit follow.
- Outcome: API feasibility verified, not arbitrary-JS confinement: connect-src denial blocked fetch, but DOM image/navigation requested network; even stricter world CSP did not stop tested anchor navigation. No product script capability, requests toggle or browser-minimum change.
- Follow-up: P4 must resolve admitted script surface/normal consequence and requests-OFF semantics before enabling. t312 root required current-page account oracle update from actual order response; negatives now refuse without reload and worker refrozen. t313 root required immutable bounded canonical claims/receipts before production wiring. PreparedNext question still unanswered, user panel unmanaged.


### 2026-10-07 - t314 installed-browser feasibility integrated; next production context review assigned
- Validation: Supervisor independently ran `FLUXIQ_USER_SCRIPT_PROBE=1` with `playwright test -c e2e/user-script-feasibility/playwright.config.ts`: actual installed Chrome154/Edge154 matrix2/2, zero skips9.9s on identical seven-file digest87f504c1c75b7dd09268f01ae1bd49301560d001da01f4881a773247b4e1baee. Source/e2e types and structure audit exit0 after current dev merge; task finish audit0; downstreamc6fec276 pushed, Core unchanged.
- Requests-OFF cannot promise arbitrary JS network confinement: connect-src denial blocked fetch, DOM image still sent and anchor navigation sent even with tested default-src none. Product JS/settings/request capability, hard termination, Firefox and release qualification remain pending. Full receipt in reports/p4-user-script-browser-probe.md; exact retired brief archived.
- t313 corrected frozen infrastructure independently passed26/26; current-built child probes/checks ongoing. Assigned report-only next production context review to p0_cancel_control, with exact owner list above; no production wiring approved yet.
- t312 added full authored original57-task field/order baseline and exact three additions inventory plus permission classifications; supervisor owner/global70/70 passed, real browser checks ongoing. Worker report add/add merge conflict resolved by preserving its complete report over the obsolete assigned-only placeholder. No original oracle/instruction weakened.
- t316 provisioning exit0; worker source released after exact full account fact shapes/mutation wrapper and visible-preserving bigbox price child span approved. Source validation pending. No paid run or panel start.

### 2026-10-07 - t310 native server identity and t312 fixture readiness integrated
- Validation: t310 independent owner/diag8, web27, route55, generator9 and native socket1/1 zero skips7.059s; actual Coretypes/build0, webtypes/runneremit0 and both audits0. Current downstream source merged; taskfinish audit0. Coref0a5f747/downstreamca788c03 pushed together. Prepared `FLUXIQ_SERVER_ADAPTER_NEXT_PROBE=1` remains unexecuted pending explicit user panel-management authorization; native proof is not production Next proof or P0 completion.
- Validation: t312 owner/global `node --test`70/70 zero skips2.021s; real Chromium honest/negative/original purchase/review9/9 zero skips37.773s. Fixture source/e2etypes0 actual5.516s/build0 actual12.860s; final/current integration audit0 (176warnings/117baseline). Downstreamb7c91b4d pushed; Core unchanged for that unit.
- Changed: readonly stale-invitation audit, watch-accessory removal with delete permission, official-only coupon collection with current ALL-order facts. Added complete authored57-task baseline plus exact3newIDs/permission classifications; all original fields/order preserved. Reports preserve commands, fail-first and source identities; exact retired briefs archived.
- Follow-up: original-project authority/promotion/declared-start semantic execution and both-path durable command joins remain unfinished. t313 merged foundation validation ongoing; no paid run/panel/fullsuite. Native structured typing and installed-script feasibility were already integrated; no product arbitrary-JS capability enabled.

### 2026-10-07 - t313 command receipt foundation integrated; gateway composition next
- Validation: root generic/SQL26/26, current-built child SIGKILL/relaunch2/2 zero skips5.96s; exact nonincremental tsc0, actual build44.966s. After current t310 merge, owning30/30 zero skips18.07s; actual Coretypes26.285s/build43.451s and Coreaudit0 (281warnings/349baseline); downstream taskfinish audit0. Core6712b950/downstreamc40734d7 pushed together, no known broken source included.
- Changed: strict bounded exact-JSON hashing, frozen claims/receipts and additive actual-project0027 durable original-request receipt joins. Report repaired invalid punctuation bytes to ASCII. Production context source review completed separately with exact gateway-first and later both-path/fence ownership.
- Follow-up: t317 implements gateway-only trusted opaque context/project-pool resolver/async settlement; Flow executor/runtime/downstream propagation remains a subsequent unit. Restart with receipt-only data cannot fabricate extracted payload; reconstructed same-run automatic continuation must remain closed until consumed-result association is designed. No new namespace or wire change approved.
- t316 three state-preservation tasks frozen; root current63 inventory/permission additions and owning verification underway. Final four task brief assigned for precise owner discovery. No paid run/panel/fullsuite; prepared Next question remains pending.

### 2026-10-07 - t316 state-preservation fixture readiness integrated
- Validation: supervisor owner/global87/87 zero skips3.332s, actual Chromium6/6 zero skips16.380s; actual scenario source/e2etypes0 8.650s/build0 10.949s; audit0 176warnings/117baseline and taskfinish integrationaudit0. Complete original57 fields/order remain identical; combined63 exact new IDs/permission classes asserted. Downstreambc4ed566 integrated, Core source unchanged; push follows.
- Changed: desired total soap3 with unchanged line/store, saved cloth transfer preserving all original lines, sold unsave preserving Available and no hidden/contact state. Private facts update from actual mutation response before handler continuation; same-table wrong identity/Hide negatives fail on current page. No model/extension qualification claim.
- Follow-up: t317 provisioning completed exit0 and source READY with actual shutdown owner additionally approved; t318 provisioning completed exit0, exact owners approved and source READY including acknowledged cross-frame private fact and visible-preserving numeric child span. No paid run/panel/fullsuite. Root narrow typing liveness probe next; semantic authority/promotion remain pending.



## t323, t324 and t327 verified briefs (retired after integration)

### Brief: command-run-admission (t323, implementing closed foundation)
- Worker: p0_acceptance. Isolated paired fxwork/t323 provision30677 completed0; source authorized for reviewed closed APIs; Core/downstream pair required. Read Current State and reports/p2-command-production-context-review.md. Reviewed closed source contracts approved; no gateway/executor activation in this unit.
- Own new Core runtime/service/command-run/{contracts,controller,index}.ts/tests/controller.test.ts; storage/project/command-ledger/{contracts,store,index}.ts, new admission.ts and owning admission/run-fence tests; unit-of-work.ts + owning unit-of-work.test.ts optional trusted validateAdmission(sql). Own downstream p2-command-run-admission.md; one scoped Core client-gateway architecture paragraph.
- CLOSED consumption foundation: storage-issued opaque admission registered to exact store/project/run/incarnation after complete no-prior-claim scan. Fresh/reconstructed same-run ANY prior claim (including committed receipt-only) refuses. Privately reserve first command; exact first-command replay never sends; second command refuses even after committed success. No caller/model arrays, receipt JSON or success boolean clear scope.
- readRun validates project-wide bounded deterministic keyset pages <=128, cap4096 each claims/receipts/unknowns, UoW proofs bounded at3*4096, plus full historical/orphan inventory; row <=8192bytes. Corruption/overflow/unavailable/incomplete observation refuses. No json_extract clearance; retain all original exact ownership/request/digest checks.
- claimForRun capability binding plus complete scan/new claim/UoW proof COMMIT in ONE actual SQL transaction. UoW trusted optional validateAdmission runs BEFORE replay lookup/insertion inside TX; absent callback unchanged; callback failure no effect/claim and existing failure-journal behavior explicit. Two actual owners opening clean run then racing different commands: exactly one can claim/send.
- Program controller owns dedicated store lease/admission and opaque run scope bound to actual stored live session/root/incarnation; revalidate after awaits, close invalidates scopes/admissions, sticky block. Do not wire service/gateway/command-context/executor/domain yet; no multi-command Flow durability claim.
- Real SQL and private session tests: copied/foreign/stale scope, replay after corruption, pending/unknown/committed reopen, first-command payload/session conflicts, second-command refusal, different-owner race, read bounds/orphans, pool/close failures. Narrow owner tests/direct types/build/audits; source freeze before supervisor verification.
- Follow immediately with serial trusted outcome ticket/actual executor consumption, both runtime/IO/domain/bridge propagation, child invocation/effect allocation, sticky graph/recovery/timeout/resume/repair fences. Unknown or receipt-only result_unavailable cannot reach state/next-node/provider diagnosis. No activation from this foundation.

### Brief: requests-policy-foundation (t324, implementing OFF foundation)
- Worker: p0_cancel_control; isolated fxwork/requests-policy/t324-requests-policy-foundation/private read-only Core provision87762 completed0; approved source authorized. Read Current State, consultant P4 and installed-script feasibility report. No Core source, request execution/advertisement, script action, manifest expansion or user state.
- Own extension shared/{protocol,browser}.ts, background/saved-state.ts, background/panel/settings-save.ts, panel/settings/form-fields.ts and owning tests; domain host.ts/runtime/{service,adapter}.ts and narrow new requests/policy/{contracts,validation,index}.ts + tests/required barrels. Own p4-requests-policy-foundation.md and scoped current architecture paragraph.
- Additional approved owners: panel/settings/address-form.ts, draft-store.ts and existing settings-draft.test.ts; background/storage.ts forced-OFF normalizeSettings plus new background/tests/storage-settings.test.ts and background/panel/tests/settings-save.test.ts. Typed fixture-only requestsEnabled:false additions allowed in background connection-status/problem-report/panel-control, panel chat owner-context/chat-owner-recovery and automations controller-owner-recovery tests. New isolated e2e/runtime/tests/requests-settings.spec.ts approved.
- Closed domain WebAutomationRequestPolicy enabled defaultsfalse; allowedOrigins exact HTTPS origins; credentials omit/redirects reject only; bounded timeoutMs/maxResponseBytes. Validate/clone/freeze injected policy and conflicting repeated registration; no browser-specific fields in generic Core config. Server enabled policy plus extension requestsEnabled are independent prerequisites and neither a grant.
- Saved-state missing/malformed switch repairs false, explicit Settings control. Product UI must visibly remain unavailable/disabled while executable request capability is absent; activate useful switch with second executable unit. No misleading enabled capability, hidden auto-fetch or local legacy storage grant. Name final UI approach/closed defaults/limits before source release.
- Default/off policies and typed host registrations advertise NO executable request action. Existing ordinary actions/native/domain registrations unaffected. Preserve browser parity, existing saved settings and no Core/node/wire executable change.
- Narrow settings repair/save/policy/conflicting registration tests, domain/source/e2e types and owning extension build; actual isolated unpacked Chromium Settings proof for disabled/unavailable control and OFF persisted default when feasible. No panel/provider/fullsuite. Freeze for root review with actual measured checks/limits.
- Follow-on executable one-shot HTTPS GET/HEAD requires explicit exact preexecution grant and trusted run/attempt/effect command context plus durable unknown/no-retry joins on BOTH paths. Credentials/authenticated session/redirects unsupported initially. DOM arbitrary script remains held: CSP prototype permits image/navigation egress; hard interruption/rollback unproved.

### Brief: runtime gateway event authority (supervisor serial slice)
- Supervisor-owned paired task: Core runtime/client-gateway-transport.ts and existing runtime/tests/client-gateway-transport.test.ts; scoped Core client-gateway architecture paragraph and downstream reports/p2-runtime-gateway-event-authority.md. No worker overlap, executor/facade/context propagation or activation.
- Stop forwarding compatibility client.action_result as authoritative runtime command.result; retain gateway diagnostic events and runtime state/client lifecycle events. Awaited dispatch remains the sole result input to RuntimeService's authoritative result event. Document public observer compatibility effect.
- Fail-first unsolicited/late/duplicate result tests; awaited dispatch failure/cleared-wait preservation and actual RuntimeService exactly-one completion test. Narrow owning tests/direct Core types/build only if needed, structure audits; no panel/providers/full suites. This closes event authority only, not whole-run durability.

## Retired t325 brief - verified original owner foundation

### Brief: canonical-owner-routing (t325, implementing reviewed foundation)
- Worker: p0_build_identity; paired fxwork/t325 provision50576 completed0; generic readonly/closed schema and fixed-root explicit factory options approved; constructor remains unchanged. Read Current State, t322 actual writer report and integrated t320 guard contracts. Root approved explicit opted-in routing, default legacy behavior, adoption unavailable; generic nonrepair project-existence owners approved; reviewed closed routing envelopes released; no public allocation or withCanonicalOperation authority from caller JSON. Plain opted-in put refuses every unbound ID, existing or new.
- Proposed Core owners: storage/{contracts,sqlite-repository,index}.ts and runtime/service.ts constructor only; new storage/canonical-authority/{contracts,migration,owner-store,repository,index}.ts + owner/repository/process tests; new storage/tests/sqlite-repository.test.ts. No generic raw SQL export; same physical global DB transaction privately held by owner store. Request any extra owner before edits.
- Additional approved owners: new canonical-authority/project-coordinator.ts and project-existence.ts with owning tests; programs/_shared/storage.ts and existing tests/storage.test.ts; programs/database-manager/storage/sqlite-repository.ts plus new storage/tests/sqlite-repository.test.ts. Generic getExistingReadOnly must OPEN_READONLY without mkdir/create/schema/WAL/repair/fallback, preserving the existing layout resolver; absent returns null, unsupported/corrupt layouts refuse. Project catalogue index.json and manifest.json require matching original membership, bounded nonrepair observations and post-await revalidation; this is not lifecycle stability before all-writer joins.
- Further approved owners: canonical-authority/validation.ts with owning validation.test.ts, tests/fixture.ts shared related test support and tests/process-probe.mjs actual built child entry. Strict mutation-free readers support checked DELETE-mode SQLite; normal persisted WAL catalogue refuses before opening, no immutable URI/copy fallback. Official original creation ingress and normal WAL-compatible existence still need future joins.
- Durable original canonical kind/id binding with immutable original project owner, revision, permanent tombstone and closed global operation phases. Initial supported kinds Flow/publication only; publication resolves stored original Flow owner. Replacement document/caller domain/project cannot select existing owner; deleted ID cannot be reallocated after directory removal. No automatic legacy seeding or namespace/new-project substitute.
- Explicit opt-in mode only, schema creation allocates no owners/proof. Unbound existing legacy rows/ambiguous owner refuse authority allocation. Trusted original-project existence must use actual nonrepair owner; pool.acquire/migration/caller-ID or repair getProject is not proof. Name verified source seam before implementation. Offline seed/old-process drain remain held operations, not inferred from marker/PID/TTL.
- Global claim COMMIT before effect then actual original-project t320 claim in fixed order; nested opaque operation validates both participants and NEVER completes outer save/publish/delete. Canonical row effect+owner revision/tombstone+effect receipt atomic in global TX. Project completion/global finalization separate: no cross-DB atomicity; any partial failure retains unresolved durable participants, global capture fence must refuse until BOTH exact participants reconciled.
- Default factory and updated-source old objects check durable mode/binding at execution time; custom/memory ports legacy-only absent verified durable capability, no shaped-object privilege. Whole file/SQL/facade/direct writer/repair/policy/shared-index/pinned-reader joins remain serial prerequisites; no all-writer protection claim.
- Test actual default factory/global DB plus project claims: two-owner allocation/mutation race, foreign replacement/publication owner, missing/delete/recreate/tombstones, pre-opened object mode check, partial claim/effect/COMMIT-lost reconciliation, literal child kills, nested outer claim retention, unseeded/custom unsupported paths and old rows unchanged. Freeze narrow types/build/audits for root independent review; no panel/providers/fullsuite/user data or git.
- Own downstream p2-canonical-owner-routing.md and scoped Core persistence paragraph. Detailed closed contracts/limits approved before source release. Adoption/activation/common promotion remains disabled.
