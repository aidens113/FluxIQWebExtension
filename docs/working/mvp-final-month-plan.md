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
t311 pending command session binding is integrated/pushed Core210453c1/downstreamaed8ae54 after root23/23 and both audits0. t313 command receipt foundation is integrated/pushed Core6712b950/downstreamc40734d7 after root30/30 merged checks, actual types/build and audits0; actual child restart2/2. No production dispatch wiring. t309 staged project snapshot foundation is integrated/pushed Core595daf8d/downstream1115c14a after root37/37, actual Core typecheck/build and both audits0. t310 native executing server-adapter identity is integrated/pushed Coref0a5f747/downstreamca788c03; actual Next proof held for explicit authorization. t318 final4 independently verified after merged dev: owner/global87/87, actual Chromium10/10 (27.139s), types/build/audit0, complete ordered original57 plus exactten NEW IDs/67 total; integration pending. t316 state-preservation tasks are integrated after root87/87 and Chromium6/6 (16.380s), types/build/audits0; total63. t312 first three clearly NEW fixture tasks are integrated/pushed downstreamb7c91b4d, originally60 total with the complete ordered original57 preserved; root70/70 owner/catalog checks, Chromium9/9, types/build/audits0. This is readiness, not created-Flow qualification. t315 native structured field typing is integrated/pushed downstreamd1d57889 after real Chromium1/1, source/e2etypes0 and final integrationaudit0. t314 installed Chrome154/Edge154 User Scripts prototype is integrated/pushed downstreamc6fec276 after root2/2 (9.9s), merged extension source/e2e types0 and audit0; still no product capability. t319 typing liveness is integrated after root actual Chromium1/1 (21.8s), unit7/7, types/build/audits0; no detached original can pass/submit. t321 typing observation integrated/pushed6bd6c9dd: queued reverts fail after50ms and post-typing actionability prevents Enter through a newly raised dialog; Chromium1/1, named units7/7. No P0 completion or fresh A-D qualification is claimed.

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

### 2026-10-07 - t319 typing target liveness independently verified
- Validation: actual production Chromium fail-first1failed5.7s, both removed text and numeric-with-submit incorrectly succeeded. Fixed same exact repro passes1/1 zero skips21.8s (fixture20.3s), intended background/content identity match, visible replacements old/7, Enter0/submits0. Owning unit `node --test`7/7 zero skips0.377s; actual all-target extension build0 13.678s/22files each, source/e2etypes0. Audit0 176warnings/117baseline; integration follows.
- Changed: original control must remain connected after keyboard/application handlers before positive readback or Enter. Existing native format/text/redaction/readonly/cancel tests pass; no silent replacement targeting or asynchronous application acceptance claim. Core source unchanged; existing current Core owning dependency rebuilt42.809s before probe, not full suite.
- Follow-up: t317 generic production gateway and t318 final4 fixtures implementing; t320 provision0, guard contracts reviewed before source release. No panel/provider/paid qualification; actual Next permission question remains unanswered. Full commands/limits in reports/p3-typing-target-liveness.md.

### 2026-10-07 - t321 bounded typing observation
- Change: awaited50ms after keyboard typing, required original connected value, and rechecked actionability before requested Enter. Post-typing rejection does not claim refusedBeforeDispatch. Existing architecture corrected native-field and observation limits.
- Validation: actual built Chromium1/1 zero skips26.3s fixture/28.0s total, native/detached/cancel/password checks plus queued reverts and coveredEnter0; named owning units7/7, source typecheck/build0 (11.363s, three targets22 files). First launch refused stale byte identity, rebuilt then real fail-first showed both queued reverts incorrectly succeeded. E2E types0; working index regenerated after header drift, final audit0 and task finish0; integrated/pushed6bd6c9dd.
- Limits: finite observation does not prove arbitrary later async/server acceptance. No Core/wire change, provider/panel/paid runs; active t317/t318/t320 work remains.

### 2026-10-07 - t318 final four fixture readiness independently verified
- Change: service review without booking, closed saved-job cleanup, existing photo collection union, and complete pending-request audit; current full-account facts reject forbidden effects even with correct-looking tables. Company frame updates acknowledged before widget continuation, exact source/origin/nonce; no generic mutation behavior changes.
- Validation: root source review and current-dev merge; owning/global87/87 zero skips1.961s, full ordered original57 objects unchanged and exactten additions/67 total asserted, permission classes explicit. Actual isolated Chromium10/10 zero skips27.139s includes cross-origin review/pay ACK sequence and current-state negative paths, desired-state repeat observation and original booking/shortlist regressions. Types0 9.086s/build0 14.548s, structure audit0; integration follows.
- Limits: fixture readiness is not created-Flow/model/extension qualification. Timeout/foreign/malformed/parallel frame messages not exercised; bounded fixture channel no general provenance promise. No panel/provider/paid/fullsuite.

## Open Questions

- Recording scope is resolved by the newer user order: evidence beside mandatory instructions, after A-D qualify. Do not reopen the older September ambiguity.
- Script channel, store eligibility and Firefox parity need a concrete feasibility result. Preserve no-debugger JS and requests-OFF policy meanwhile.
- Direct-request origins/session/redirect policy needs a concrete design; do not inherit the old any-origin default as authorization.
- Who runs the Phase 6 release-candidate script as the "person unfamiliar with FluxIQ"? Owner: user.
- Historical requested67task list had57existing rows; originalmissingten remain unknown. Supervisor is implementing ten clearly NEW proposals (t312 first3; t316 next3), preserving original57, with exact oracles; no recovered-history or qualification-pass claim. Optional original-list question remains unanswered.
