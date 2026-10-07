# MVP Final Month Plan

Status: Active
Status detail: Acceptance, extension/Core identity, Stop, candidate facade/infrastructure and typed/navigation fixes pushed; durable receipt restart verified; loaded-host identity independently verified; production promotion/live qualification pending.
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
t311 pending command session binding is integrated/pushed Core210453c1/downstreamaed8ae54 after root23/23 and both audits0. t309 staged project snapshot foundation passed root37/37, actual Core typecheck/build and audit0; paired integration follows. t310 actual server-adapter identity is frozen for independent review. t312 starts the first three clearly NEW fixture tasks toward the67-task denominator, preserving all57 existing tasks. No P0 completion or fresh A-D
qualification is claimed.

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

Active file-owned tasks only. Prior briefs and exact receipts are preserved in the
[execution archive](./mvp-final-month-plan/archive/2026-10-07-verified-slices-and-briefs.md).

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

### Brief: qualification-readiness-first-three (t312)
- Repository: isolated downstream fxwork/t312-qualification-readiness-first-three; shared Core read-only. Worker p0_build_identity.
- Task: Implement only professional-network-audit-stale-requests, auction-marketplace-remove-watched-accessories and crossborder-marketplace-collect-official-coupon-only from reports/qualification-ten-new-task-proposal.md. They are NEW tasks, not recovered historical IDs. Preserve every existing57 ID/instruction/oracle.
- Owns: those three site live-tasks.ts and exact manifest/barrel owners; new qualification/{workflow,expected,index}.ts and tests/expected.test.ts; existing site honest/naive browser tests. Name exact current owners in report before editing; no state/renderer edits without supervisor review. Own reports/qualification-first-three.md. No shared inventory test/document edits, Core edits or other sites.
- Required reads: Current State, own proposal sections1/4/9, scenario contracts and owning tests. Literal exact datasets/account outcomes; unique workflow/columns. Each honest browser path and wrong-outcome negative must exercise actual fixture account facts, not copied success metadata.
- Validation: narrow owning scenario/oracle tests, source/e2e typechecks, owning fixture build, real isolated Chromium honest/negative proof, audit. Provision first; wait supervisor ready before edits/frozen checks. No provider/Lab/fullsuite/panel/git. Freeze report with commands, measured counts and limits; root independently verifies. No qualification pass claimed from fixture readiness.

## Work Ledger

Earlier verified units and decisions moved intact to the [execution archive](./mvp-final-month-plan/archive/2026-10-07-verified-slices-and-briefs.md).

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

## Open Questions

- Recording scope is resolved by the newer user order: evidence beside mandatory instructions, after A-D qualify. Do not reopen the older September ambiguity.
- Script channel, store eligibility and Firefox parity need a concrete feasibility result. Preserve no-debugger JS and requests-OFF policy meanwhile.
- Direct-request origins/session/redirect policy needs a concrete design; do not inherit the old any-origin default as authorization.
- Who runs the Phase 6 release-candidate script as the "person unfamiliar with FluxIQ"? Owner: user.
- Requested67task inventory has57existing rows; ten are unaccounted. Optional user question asking for an existing list versus proposing new tasks remains unanswered. Do not fabricate historical IDs/passes; explicit new definitions and independent oracles required to add scope.

### 2026-10-07 - t309 root verification and next bounded dispatch
- Agent: Codex supervisor.
- Changed: staged complete-project snapshot CAS/immutable history/receipt join reviewed after current paired dev merge; root required borrowed-owner/operation/generation negatives before accepting storage claim. Production activation remains unavailable. Concrete all-writer/read cutover report retained as a proposal, not a product switch.
- Validation: root37/37 zero skips (testtotal9.73s, wall29.95s), actual fluxiqcheck0(38.432s)/build0(46.106s), Coreaudit0; downstream integration gate follows. Full receipt reports/p2-staged-authority-foundation.md.
- Outcome: Narrow staged foundation verified; no production capture/permission/compiler/active-reader/promotion or OS-kill/power-loss proof. Paired integration follows. t311 pushed Core210453c1/downstreamaed8ae54.
- Follow-up: t310 independent merged-source review/native socket probe; prepared Next proof requires explicit panel authorization. t312 implements three clearly NEW tasks toward67; original57 remain intact. User has not supplied the historical missing ten, so proposed additions are labelled new rather than recovered. No paid qualification or user panel started.
