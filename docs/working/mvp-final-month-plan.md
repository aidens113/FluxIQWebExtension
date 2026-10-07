# MVP Final Month Plan

Status: Active
Status detail: Acceptance, extension/Core identity, Stop, candidate facade/infrastructure and typed/navigation fixes pushed; durable receipt restart verification and loaded-host identity underway; production promotion/live qualification pending.
Created: 2026-10-05
Last updated: 2026-10-07
Owner: Senior supervisor agent
Scope: The ordered plan from 2026-10-05 to the polished-MVP deadline of 2026-11-10: what is done, what is held on unmerged branches or dirty trees, what must be integrated and pushed, and the week-by-week work to pass the 30-day plan's Final MVP Acceptance Test. It does not redo intake already recorded in the 2026-10-03 handoff, and it does not itself run live provider calls.
Paired document: C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/mvp-final-month-plan.md
Related: [30-day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md), [Claude handoff 2026-10-03](./claude-work-handoff-2026-10-03.md), [live loop](./language-driven-flow-loop-plan.md), [working index](./README.md)

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
Loaded domain host remains t305. t299 candidate facade is integrated (Core7f9bae15/downstreamcb792dee)
after independent actualservice/API53/53, package/dependentweb types and audits.
t300 receipt/detached infrastructure is integrated (Core386b4c15)
with production joins pending. t301 typed readiness is integrated (b2ad00de);
t303 navigation is integrated/pushed ddc8befd after owning114/114 and production
Chromium1/1. t304 durable ledger passed independent52/52/types/build; literal
owned child-process termination/restart checks passed2/2 independently.
No P0 completion
or fresh A-D qualification is claimed.

**Planning review completed locally 2026-10-06.**
The [consultant review and revised execution detail](./mvp-final-month-plan/consultant-revision.md)
is the current order of work. It supersedes the old schedule and structural
stage ordering, preserves the November 10 deadline and October 29 freeze, and
keeps the existing runtime rather than introducing a new Flow language.

**Claude's stopping point.** Downstream `92d790d7`, Core `e9b7d691`, both clean
at intake and pushed by Claude. Handoff 2026-10-07 05:10 UTC is October 6 locally.
Read-list S1-S6 and fix-everything workstreams landed; round 4 failed A-D; round 5
was cancelled. No lane has passed twice consecutively. The complete prior
[Current State](./mvp-final-month-plan/archive/2026-10-06-claude-stopping-point.md)
and [implementation ledger](./mvp-final-month-plan/archive/2026-10-06-pre-consultant-ledger.md)
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

**Audit reports.** [Working docs](./mvp-final-month-plan/reports/consultant-doc-context.md),
[Core source](./mvp-final-month-plan/reports/consultant-core-audit.md),
[browser/Lab source](./mvp-final-month-plan/reports/consultant-browser-lab-audit.md).
These record planning coverage and unverified hypotheses. Implementation checks
and source changes are recorded separately below; no paid run has started. Identity
and cancellation browser evidence must be independently reviewed before P0 closes.

## Schedule to 2026-11-10

Implementation instructions, file seams, requirements/evidence contracts, negative
cases and live command templates are in the
[revised execution plan](./mvp-final-month-plan/consultant-revision.md).
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
[historical reference](./mvp-final-month-plan/archive/2026-10-06-pre-consultant-schedule-and-briefs.md).

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


Historical briefs: [Claude schedule and task briefs](./mvp-final-month-plan/archive/2026-10-06-pre-consultant-schedule-and-briefs.md).

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

Earlier entries: [Claude implementation and handoff ledger](./mvp-final-month-plan/archive/2026-10-06-pre-consultant-ledger.md).

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
- Changed: t300 Core386b4c15 and paired downstream0befce51; t301 downstreamb2ad00de. P4 [feasibility record](./mvp-final-month-plan/reports/p4-script-request-feasibility.md) adds supported API/permission/timeout and requests-OFF requirements without enabling arbitrary execution.
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
