# MVP Final Month Plan

Status: Active
Status detail: P0 acceptance fences integrated and pushed in both repositories; identity, cancellation and candidate authoring in isolated task trees; P0 live readiness and later gates pending.
Created: 2026-10-05
Last updated: 2026-10-06
Owner: Senior supervisor agent
Scope: The ordered plan from 2026-10-05 to the polished-MVP deadline of 2026-11-10: what is done, what is held on unmerged branches or dirty trees, what must be integrated and pushed, and the week-by-week work to pass the 30-day plan's Final MVP Acceptance Test. It does not redo intake already recorded in the 2026-10-03 handoff, and it does not itself run live provider calls.
Paired document: C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/mvp-final-month-plan.md
Related: [30-day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md), [Claude handoff 2026-10-03](./claude-work-handoff-2026-10-03.md), [live loop](./language-driven-flow-loop-plan.md), [working index](./README.md)

---

## Current State

**Implementation authorized locally 2026-10-06; P0 in progress.** t296 is integrated
and pushed: downstream `62ceaac8`, Core `6c449022`. Supervisor reran the two changed
test files (29/29), the fluxiq typecheck and Core structure audit; downstream task
integration audit passed. See the acceptance report and ledger. t297 running-build
identity, t298 cancellation and t299 feature-flagged candidate authoring remain in
isolated trees. No P0 completion or fresh A-D qualification is claimed.

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
Its cached-worker deletion is wired, but running-worker build identity is missing.
No fresh product behavior was executed in this review.

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
