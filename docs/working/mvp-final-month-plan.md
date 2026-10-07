# MVP Final Month Plan

Status: Active
Status detail: Intake 2026-10-07 found chat creation broken by candidate-only builds (t338 restores legacy as default) and parked Codex's production-integrity chain; next are a live lane A baseline and the candidate vertical slice.
Created: 2026-10-05
Last updated: 2026-10-07
Owner: Senior supervisor agent
Scope: The ordered plan from 2026-10-05 to the polished-MVP deadline of 2026-11-10: what is done, what is held on unmerged branches or dirty trees, what must be integrated and pushed, and the week-by-week work to pass the 30-day plan's Final MVP Acceptance Test. It does not redo intake already recorded in the 2026-10-03 handoff, and it does not itself run live provider calls.
Paired document: C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/mvp-final-month-plan.md
Related: [30-day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md), [Claude handoff 2026-10-03](./claude-work-handoff-2026-10-03.md), [live loop](./language-driven-flow-loop-plan.md), [working index](./README.md)

---

## Current State

**Where we are (2026-10-07, Claude intake after Codex).** Deadline November 10,
feature freeze October 29. Product source on `dev` is Codex's last pushed pair
(downstream `b8a158f8`, Core `a2672def`); later downstream commits are
documentation. No A-D lane has passed twice; round 4 (October 6) failed all four,
and no paid run has happened since October 6 21:08.

**The product cannot currently create a runnable Flow.** Codex's t330 switched
every chat and panel creation build to candidate mode. That mode saves an
unverified draft and says "the Flow's steps are unchanged", and nothing in Core
executes, verifies or promotes a candidate. Every Lab creation lane throws before
any provider call (`packages/test-runner/src/flow-lane/creation/readiness.ts`).
At the baseline (downstream `92d790d7`, Core `e9b7d691`) chat builds applied
their result. Candidate mode also took away the model's test run and the build
judge, and no text tells the model the Flow format. t338 is restoring the legacy
build as the default behind one setting, as consultant P1.1 required. Evidence:
[product path](./mvp-final-month-plan/reports/intake-1007/product-path.md).

**What t296-t337 gave us.**

| Units | What it gives | On the default path? | Still missing |
| --- | --- | --- | --- |
| t296 | Build judge needs a second affirmative verdict; unsupported held-repair shapes refused before applying | Yes (legacy judge) | Judges still see exploration's leftovers |
| t297, t302, t305, t310 | Extension, Core, domain host and server report their build identity | Reporting yes; the check is Lab-only | A live check on the final pair |
| t298 | Stop and cancel a build from the chat | Yes | Charge after an uncooperative provider stop is unknown |
| t301, t303, t306, t315, t319, t321 | Typed browser fixes: checkbox state, list change, navigation outcome, assert and wait, typing liveness | Yes | Remaining rows of the ranked node backlog |
| t307, t311, t327 | Atomic graph import; a result from the wrong session cannot settle a command; completion only from the awaited dispatch | Yes | None |
| t308, t312, t316, t318, t336 | Fixture paginator, ten new tasks (67 in all), atomic fixture reset | Lab only | None |
| t324 | Requests OFF policy and a disabled Settings field | Yes | Executable requests, later, under the user's policy |
| t299, t333 | Candidate authoring (`core.submit_candidate`) bound to the full original instruction | Yes since t330, always ends as a draft | Execution, verification, promotion |
| t300, t304, t309, t313, t317, t320, t323, t325, t329, t331, t332 | About 8,000 Core lines: candidate verifier, durable receipts, staged snapshots, durable command journal, "required mode" executor, canonical SQLite owner, writer guards | No: test-only, or opt-in required mode that nothing turns on | Parked, below |

**Parked: the production-integrity chain.** Codex had defined about thirteen more
links before any promotion or live run: required-mode execution for every web node
type (only click was started), a closed writer host covering every storage writer,
original-ID adoption, all-writer capture, pinned reads, a hand-written grammar per
task family for reading requirements, and a single CAS promoter. Two links exist,
two are partial, the rest are absent: roughly ten to twenty more units. The closed
host, adoption, all-writer and pinned-read links are not in the consultant
revision, the command journal belongs to the October 29 - November 4 hardening
window, and required mode refuses repair runs. Decision (2026-10-07, supervisor):
park the chain and leave landed code dormant; revisit the command journal in
hardening. In-flight t334 (click executor), t335 (installer, never compiled) and
t337 (grammar for one sentence family) are WIP commits on their own branches, not
merged. Evidence: [infrastructure chain](./mvp-final-month-plan/reports/intake-1007/infra-chain.md).

**In flight.** t338 restore the creation path (worker, `fxwork/t338`, Core-paired).

**Next order.**

1. t338: legacy default restored, Lab admits legacy creation. Verify, merge both
   repositories, push.
2. Re-establish the live baseline: rebuild a lane tree on the new pair, assert the
   running identity, then one supervised lane A run started from the extension
   chat (off-peak, flash, $0.10). Debug it fully before anything else is paid for.
3. The consultant's P1/P2 vertical slice on lane A, in candidate mode behind the
   setting: show the model the Flow format with examples; let it test-run its
   candidate; execute the candidate from the declared start through the normal
   runtime (not required mode); judge what the candidate run did, never
   exploration's leftovers (t296 stays fail-closed); promote with one
   base-revision check. Provider-free tests first, then one bounded live probe,
   compared with legacy on the same task.
4. Make candidate the default only when it matches or beats legacy on lane A. Then
   A-D rounds: two consecutive passes per lane on one build pair, plus zero-call
   replays.
5. Alongside: remaining typed browser blockers from the
   [ranked node backlog](./node-catalog-plan/ranked-backlog.md), and the week
   review's open causes (act-claim trust, judges reading exploration's leftovers,
   refusal churn, list-reading mistakes).

**Live acceptance stays strict.** Each A-D lane needs two consecutive independent
creation passes on the same source/build pair plus separate zero-call saved-Flow
replays, exact oracles and truthful product acceptance. Up to four headed,
supervised, one-attempt chat-started lanes after the first representative slice;
no relaunch loop. Off-peak guard, flash default and $0.10 Lab ceiling stay binding.
Unknown, withheld or unperformed outcomes and old-revision evidence cannot promote.

**User decisions preserved.** Recording is evidence beside mandatory instruction
and waits for A-D. Direct requests OFF by default in config and Settings. Typed
nodes first; JS last resort after about three typed failures, scored as partial
success that used JS. No debugger for JS; network capture debugger only if
absolutely needed with requests enabled. Full suites at most twice daily; narrow
gates per change; no user-panel management unless explicitly authorized.

**Pointers.** Order of work: [consultant revision](./mvp-final-month-plan/consultant-revision.md).
What failed and why up to October 6: [week review](./mvp-final-month-plan/reports/week-review/report.md).
Codex's full Current State, receipts and parked briefs:
[2026-10-07 archive](./mvp-final-month-plan/archive/2026-10-07-codex-current-state-and-parked-briefs.md)
and [verified slices](./mvp-final-month-plan/archive/2026-10-07-verified-slices-and-briefs.md).
Working documents audit: [intake C](./mvp-final-month-plan/reports/intake-1007/working-docs-audit.md).

---

## Schedule to 2026-11-10

**Re-baselined 2026-10-07.** P0 is done. The P1/P2 slice was not built: Codex built the
production-integrity chain instead (parked, see Current State). Targets now: t338 and a
live lane A baseline October 7-8; the candidate slice October 8-12; A-D rounds from
October 12. Freeze October 29 and the November 10 deadline are unchanged. If no lane has
passed twice by October 18, bring a scope proposal rather than relaxing the gates.

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

### Brief: t339 U1 candidate authoring format and trial gate (merged 2026-10-07)
- Worker: t339-candidate-gate (worker-high). Worktree `C:\Users\osrs_\FluxStuff\fxwork\t339\` (Core-paired, branch `task/t339-candidate-trial-gate`); edits in its `!FluxIQ` tree. Report: `docs/working/mvp-final-month-plan/reports/t339-candidate-trial-gate.md` in the t339 downstream tree.
- Design: [t339 design](./mvp-final-month-plan/reports/t339-candidate-slice-design.md), unit U1 row and sections it cites. Decisions D1-D4 are settled (ledger 2026-10-07).
- Goal: in candidate mode the model (a) sees the Flow script format and one act-on-an-item example in `core.submit_candidate`'s description, rendered from `runtime/flow-bootstrap/plan/flow-script-format.ts` (single source, no copy); (b) can ask to test its latest candidate with a new model-facing test tool that calls an injected trial port; (c) can complete only when the port returned `yes` for that exact latest revision and digest. Errors give the model actionable feedback.
- Pin the port contract in `candidate/contracts.ts` (U2 implements it later): input `{ candidateId, revision, digest, signal }`; result `{ revision, digest, verdict: "yes" | "no" | "unsure" | "not_judged" | "execution_failed", feedback, trialRunId? }`. When no port is injected, the test tool answers `candidate.trial_unavailable` and completion is refused (candidate mode then still ends as a draft, as today).
- Owns: Core `runtime/flow-bootstrap/candidate/{authoring-loop,contracts}.ts`, new `candidate/trial-gate.ts`, `runtime/flow-bootstrap/plan/flow-script-format.ts`, owning `candidate/tests/*` and `plan/tests/*`; the candidate barrel if needed.
- Must not touch: `runtime/service.ts`, `runtime/service/**`, `runtime/conversations/**`, `apps/web/**` (t338 and U2 own them), required-mode or storage-authority owners, any `docs/working/*.md`. No commits, provider, Lab or panel.
- Definition of done: fail-first tests from the U1 row (completion without a trial refused `candidate.trial_required`; yes on R1 then submit R2 and complete R2 refused; unsure, not_judged and execution_failed refuse with feedback; unchanged revision after a no refused without a new trial; the port receives the exact latest revision and digest; the submit description contains the format text). Owning tests pass; Core nonincremental typecheck and Core structure audit pass. Report the exact commands and output.

### Brief: t339 candidate vertical slice design (read-only)
- Worker: t339-candidate-design (worker-high). Read-only on dev heads (downstream `56ac438d`, Core `a2672def`). Own ONLY `reports/t339-candidate-slice-design.md` in the main checkout. No edits, builds, Lab, provider, panel.
- Context: [consultant revision](./mvp-final-month-plan/consultant-revision.md) P1 items 1-6 and P2 items 1-5; Current State "Next order" step 3; [product path](./mvp-final-month-plan/reports/intake-1007/product-path.md) on candidate-mode gaps. t338 is concurrently editing `flow-lane/creation/**` and the conversation commands to add an authoring-mode setting (`legacy` default, `candidate` opt-in); design against that, do not depend on its exact names.
- Design, for lane A (`crossborder-marketplace-hub-to-cart`), the smallest complete path from candidate submission to a promoted, runnable Flow, reusing existing seams. Do NOT use required mode (t331/t334) or the parked integrity chain.
- Answer with file:line evidence: (1) what the candidate-mode model sees today (tools, prompt text) and what is missing, especially the Flow format and examples; name the existing sources (node definitions, catalog) to render it from. (2) How the legacy build test-runs its draft today, and how the submitted candidate can run detached through the normal runtime from the declared start (t300 `runAutomationStudioDetachedCandidate`, start location, Lab reset) when the model asks to test it. (3) Which existing judge entry, with t296's fail-closed agreement, can judge only the candidate run's evidence (end page, step changes, rows), never exploration's leftovers. (4) Promotion: one base-revision compare-and-swap writing the accepted candidate graph into the Flow; which existing write path and revision fields to use; what changes in the `promotionAllowed:false` contract. (5) What the Lab creation lane must do in candidate mode (wait for a promoted Flow, record candidate id and verdicts).
- Output: a file-owned partition into 2-4 implementation units, each with owners, tests (including fail-first negatives: unexecuted candidate, edited revision with an older verdict, base revision changed, judge unsure), and rough size. Flag any point needing a user decision.

### Brief: t338 restore the creation path behind an authoring-mode setting
- Worker: t338-restore (worker-high). Worktree `C:\Users\osrs_\FluxStuff\fxwork\t338\` (both repos, branch `task/t338-restore-creation-path`). Report: `docs/working/mvp-final-month-plan/reports/t338-restore-creation-path.md` in the t338 downstream tree.
- Why: t330 (merges downstream `4db30a78`, Core `66a310cc`) made every chat and panel creation build candidate-only, and nothing promotes candidates, so the extension cannot make a runnable Flow and every Lab creation lane throws (`test-runner/src/flow-lane/creation/readiness.ts:4-5`). Consultant revision P1.1 required the new interface behind a flag with legacy kept. Evidence: `reports/intake-1007/product-path.md`, `infra-chain.md`.
- Goal: ONE authoring-mode setting with a single source of truth in Core runtime configuration (propose the owner; no per-caller literals). `legacy` (default) restores pre-t330 behavior (baseline Core `e9b7d691` / downstream `92d790d7`): create-here and explore build, judge, then approve/apply and say the automation is ready; improve asks to apply; the panel's evidence-guided build proposes an adaptation as before. `candidate` keeps t330's draft-only behavior exactly. Reuse the code t330 replaced (`git diff` its merges); do not reinvent it.
- Lab: the readiness hold refuses only when the run's Core is in candidate mode; legacy creation lanes (chat build, lane, build-proposal, review-proposal, `extension-chat-check/prove/chat-build.ts`) run as at baseline. The campaign selects the mode explicitly (default legacy) and every run report records it.
- Owns: Core `runtime/conversations/commands/*` and tests; the Core config owner you propose; `apps/web/src/features/automation-studio/authoring/*` and `runtime/runtime-host.ts` callers t330 changed, plus tests; downstream `packages/test-runner/src/flow-lane/creation/**`, `extension-chat-check/prove/chat-build.ts`, the campaign option plumbing and their tests; authored architecture docs that describe creation authoring (Core automation-studio docs, downstream `build-loop.md`, `testing-facility.md`).
- Must not touch: `docs/working/*.md` (shared), required-mode/command-ledger/storage-authority owners (t313-t335), fixtures/oracles, Lab guards or override files. Keep t296 fences, t298 cancel and the t333 candidate bridge working. No commits, provider calls, live Lab runs or panel.
- Definition of done: tests for both modes (legacy create-here applies and says ready; candidate stays a draft; readiness refuses candidate only, admits legacy). Owning tests in each changed directory, nonincremental typechecks of Core, web, domain and test-runner, and the structure audit in both repos pass. Run a provider-free `pnpm lab:campaign crossborder-marketplace-hub-to-cart --dry-run --max-attempts 1` in the t338 tree and report whether readiness admits legacy. Commands are in `docs/architecture/repository-layout.md` and Core's equivalent.

## Work Ledger

Earlier verified units, decisions and ledger detail remain in [the execution archive](./mvp-final-month-plan/archive/2026-10-07-verified-slices-and-briefs.md).

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
- Validation: root source review and current-dev merge; owning/global87/87 zero skips1.961s, full ordered original57 objects unchanged and exactten additions/67 total asserted, permission classes explicit. Actual isolated Chromium10/10 zero skips27.139s includes cross-origin review/pay ACK sequence and current-state negative paths, desired-state repeat observation and original booking/shortlist regressions. Types0 9.086s/build0 14.548s, structure audit0; integrated/pushed47322131 (finish audit passed after regenerating stale index).
- Limits: fixture readiness is not created-Flow/model/extension qualification. Timeout/foreign/malformed/parallel frame messages not exercised; bounded fixture channel no general provenance promise. No panel/provider/paid/fullsuite.

### 2026-10-07 - t317 and t320 independently verified; production joins next
- Validation: root t317 six actual owners57/57 zero skips27.96s, direct nonincremental Core tsc0, domain source/test tsconfigs0, Core audit0 (281warnings/349baseline). Root t320 SQL33/33 zero skips5.49s, literal current-built child kill/reopen2/2 zero skips2.55s, direct nonincremental Core tsc0 and audit0. Owning build artifacts current; combined pair integration pending.
- Changed: explicit opaque stored-session/private-pool gateway claim-before-send/receipt-before-result and orderly shutdown; original-ID separate durable legacy writer/capture claims, full historical joins, revision CAS and trusted read-only owner release. Exact reports retain fail-first and scope limits.
- Follow-up: t322 read-only actual all-writer/global owner/pinned reader coverage. Next command-run foundation requires atomic scan+claim before replay/insertion, private incarnation-owned consumption evidence, sticky unknown, conservative receipt-only restart refusal. Serial actual executor/domain/bridge propagation and recovery/resume fences remain mandatory; neither foundation closes P2.
- Limits: no all-writer, original capture/adoption/accepted promotion or model/live qualification; no panel/provider/fullsuite. Active worker discovery remains source read-only.

### 2026-10-07 - t322 concrete writer coverage reviewed
- Validation: source/report review only, including actual global canonical wrapper and existing project UoW transaction boundary. No executable all-writer/atomicity proof. Exact read inventory/unknowns and future race/kill matrix in reports/p2-original-project-writer-coverage.md. Documentation structure audit is the integration gate.
- Finding: canonical global rows lack stable project owner/tombstone; whole saves span global SQL/project SQL/files, and repair reads/direct SQL/publication/delete paths bypass a facade-only guard. Existing bootstrap pages all100-sized batches; do not invent a blanket first100 defect. Project directory deletion can erase local coordination, requiring surviving global tombstone.
- Decision: next original-owner partition remains contract review/source HOLD until actual t320 interface and default physical global DB transaction binding verified. Supported Flow/publication scope alone cannot claim policy/all-writer coverage. No activation/adoption endpoint before whole-operation writers, direct SQL/files, nonrepair complete capture, pinned readers/compiler/dependencies and execution/promotion join.
- Follow-up: close read-only unit, integrate verified t317/t320 pairs, then provision closed one-effect run admission and original global owner slice. Actual Next authorization remains pending; no panel/provider/fullsuite.

### 2026-10-07 - t323/t324/t327 independently verified and pushed
- Changed: Coread3914cd/downstreamdbf2a5f4 pushed. t323 atomic one-command actual-run admission; t324 immutable closed policy and forced-OFF unavailable Settings; t327 authoritative runtime completion only from awaited dispatch. Retired exact briefs to archive, own reports retain failures/commands and next ticket proposal.
- Validation: t323 root merged6files65/65 zero skips36.22s, nonincremental Core/domain source/test types0, owning Core build0 53.597s6094outputs and Core audit0; downstream task finish audit0. t324 root22Settings+45domain tests pass, direct source/test types0, final extension build0 24.474s three targets22files, actual identified Chromium134 Settings1/1 zero skips3.874s and task audit0. t327 root meaningful4fail-first then40/40 pass2.20s/types/audits0. Exact unit-specific pair/proof limits in own reports.
- Follow-up: t323 scope remains one-command and not registered in actual Flow paths; post-COMMIT private outcomes/actual executor consumption plus both-path propagation and sticky recovery/bounds fences next. t325 owners/all-writers/capture/pinned read/activation and common candidate acceptance remain prerequisites. No Next panel/provider/paid qualification executed.

### 2026-10-07 - t326 execution context checkpoint
- Changed: folded settled receipt/head summaries into Current State, preserved older source/build evidence and retired briefs in archive, corrected67-task/ranked typing status. Active t323/t324/t325 ownership and source holds explicit; no phase completion inferred from infrastructure.
- Validation: documentation/source receipt reconciliation only; task structure audit is the gate. No product source/tests/builds/provider/panel/fullsuite.
- Follow-up: t323 first behavioral failures reproduced same-run double admission and missing UoW callbacks; implementation underway. t324 approved forced-OFF policy/settings fixture owners, no request action. t325 generic read-only/project-existence/coordinator additions approved; public factory contracts still reviewed before release. Provisioning30677/87762/50576 all completed0.

### 2026-10-07 - t328 actual production acceptance joins independently reviewed
- Finding: actual Lab applies at lane.ts390 before reset419/execution427/private oracles453-454; real website/chat creation callers still request legacy adaptations. Candidate verifier and sole original-project promoter are not production joins. No earlier receipt/build proves accepted candidate execution.
- Validation: supervisor read actual caller/candidate store paths and confirmed write ordering and draft preservation; report-only source audit, no product test/build/live/provider claim. Task finish structure audit0; integrated fc657df0. Provision68113 was setup only.
- Follow-up: t330 actual creation callers draft-only, closed truthful response and pre-provider Lab hold reviewed before source release. t325 canonical factory review negatives and t329 consumption provenance tests remain active. Full executor/writer/capture/pinned-reader/promotion and final-pair qualification still required.

### 2026-10-07 - t329 private consumption independently verified/integrated
- Changed: actual post-COMMIT dispatch-only proof, required observer deadline/uncertainty, trusted post-handling witness and atomic SQL consumed-history continuation. Both actual Flow paths/issuer remain unwired; no feature activation.
- Validation: supervisor frozen actual5owner81/81 zero skips54.10s, nonincremental Core and both domain tsconfigs0; actual Core audit0 (282/349), worker fresh6098-output build0, downstream task finish audit0. Integrated down7df54aea/Core030eca4f; paired push follows checkpoint. Exact counterfeit/late/unknown/race proofs and limitations in own report.
- Follow-up: t331 actual executor/node-entry/bridge/result-handling joins source HOLD pending reviewed brief. t325 reviewed source37/37 plus built-child5/5 and types0 independently; current-dev merge brings t329, narrow combined verification/build pending. t330 reviewed source released, no paid/provider/panel.

### 2026-10-07 - t325 original canonical owner foundation integrated
- Validation: initial root37/37 + built-child5/5, current Core030eca4f merge then combined118/118 zero skips43.19s; actual combined freshbuild0 57.203s6130outputs, Core and both domain nonincremental types0, actual built child5/5 zero skips43.43s, Core audit0 and downstream finish audit0. Integrated downd325fc9f/Core1b0e5278, paired push follows checkpoint.
- Changed: opt-in fixed-root factory/original owner/tombstones and private global/project participants, bounded nonrepair readers; meaningful review negatives fixed. Retired brief intact to archive; actual constructor/creation/whole-operation/lifecycle/all-writer/pinned reader/adoption remain unimplemented, WAL unsupported.
- Follow-up: t332 exact original writer/creation/lifecycle joins discovery/source HOLD; service integration must be serial with t331. t330 reviewed draft-only callers implementing. Qualification and actual Next proof still held; no providers/panel/fullsuite.

### 2026-10-07 - serial executor facade and next acceptance discovery
- Changed: root authored t331 actual service/private-context resolver seam; explicit required fresh runs persist marker and open actual private owner after running storage, lazily own graph pipelines, fence continuation and bypass legacy model diagnosis/judging/promotion. Worker public-entry tests requested; source unverified. t333 isolated candidate join discovery READY86280 exit0, no source release. t330 current-dev branch root checks progressing.
- Validation: root t330 cleanup14/14, current combined command/parser/public export67/67 zero skips27.19s, React50/50 zero skips13.02s, Core nonincremental types0 and owning build0 (39.974s6142files). Runner/web final combined checks pending. t331 raw IO owning positive/timeout tests are worker observations, Runtime/import-order failures retained until fixed.
- Limits: no actual production promotion, all-writer activation, provider/panel/qualification or full sweep. Documentation/tooling reads that failed path/anchor matching were corrected; no successful result inferred from them.

### 2026-10-07 - t330 combined draft-only callers independently verified
- Changed: reviewed website/chat draft-only callers, pure browser parser export and owning generated-output cleanup; qualification helpers refuse before this entry dispatches until actual acceptance joins exist. Core330b5338/down020bb826 source committed, merged current Core1b0e5278/down71384038 on task. Authored Core bootstrap contract updated.
- Validation: root cleanup/registry14/14; current Core command/parser/browser67/67 zero skips27.19s, React50/50 zero skips13.02s; nonincremental Core/web/runner types0; owning fresh Core build0 (39.974s6142files), actual optimized Next build0 (135.110s2383files); emitted runner92/92 zero skips11.756s. Final structure audits0 (Core280/349, downstream174/117) and paired integration4db30a78/66a310cc completed.
- Limits: build only/no panel; no browser/provider/semantic acceptance, all-writer/adoption/initialization, production Next process or qualification. Static readiness hold is interim and must be replaced by verified real joins. t331/t332/t333 remain active.

### 2026-10-07 - executor, writer and original-source integration review
- Changed: t331 legacy undefined-context compatibility corrected; approved validating-only public context boundary and authentic service-issued downstream test harness. t332 full Guard history validation now precedes actual SQL metadata/feed effects inside their transaction; bounded SQLite preflight precedes raw history allocation. Root reviewed source, committed Core540e32d7 and merged current dev66a310cc; combined independent gates running. t333 complete original inventory helper authored/root4/4, service bridge pending; full v2 accounting projection validation requested.
- Validation: t332 worker final101/101 including16 built race/kill probes, build/types/audit0 are worker claims pending root combined validation. Root combined t332 audit0 (282warnings/349baseline); build/types and owning execution pending. t331 actual public service/controller16/16 worker observations precede public boundary correction; t333 actual v2 pipeline still failing, no success inferred from v1 compatibility.
- Limits: none of these units activates whole-writer service/host selection, initialization/adoption/pinned reads, candidate semantic verification/promotion, actual native-web required execution or paid qualification. Next process authorization remains unanswered; no panel/provider/full sweep. Exact repros and remaining owners in individual reports.

### 2026-10-07 - t332 whole writer foundation independently integrated
- Changed: sourceCore540e32d7, current-dev merge and paired down8af7872c/Core7388717b. Whole-operation reservation joins real canonical document/catalogue/project files/SQL/feed/completion. Full Guard parent validation precedes SQL effect inside TX; bounded SQLite preflight precedes raw allocation. Retired exact brief intact to archive.
- Validation: root merged Core build0 (46.885s6170outputs), nonincremental Core types0/audit0; combined18files100passed/one15s timeout144.65s, literal built16process probes all passed111.459s. Exact unchanged timed-out file case isolated1/1 passed1.765s, and complete owning file5/5 passed3.277s (file1.464s), original15s budget unchanged. Initial timeout retained, no reproduced stalled operation or inferred product fix. Final Core documentation audit0 and downstream task finish audit0; Core finish --skip-checks used after actually observed narrow gates.
- Limits: infrastructure only, normal host remains canonical memory; no service opt-in, missing-store initialization, original-ID adoption, remaining writers, pinned capture/execution/promotion or qualification. Paired dev push follows checkpoint. No panel/providers/fullsuite.

### 2026-10-07 - t331 actual executor independently integrated
- Changed: Core8c5482e7/down887a8251 source, merged current7388717b/downff0f19b5, paired integration2576139f/Core5eac215b. Fresh explicit required stored runs privately issue entry/effect context, registered IO/Runtime forwarding, actual capture/state handling then sole durable consumption; sticky unknown/cancel/deadline/recovery fences and exact post-COMMIT lease drain. Public guard validates/STOP only. Retired brief intact to archive.
- Validation: root Core60/60 zero64.00s +239/239 zero39.86s, nonincremental types0/freshbuild0 (59.702s6238outputs), built actual domain32/32 zero4.398s and source/test types0. Final Core audit0 (283/349), owning baseline lowered ONLY service4399->4395, downstream task audit0. Core finish --skip-checks used after observed narrow gates. Actual IO fixture/config corrections do not claim a product consumption fix.
- Limits: no arbitrary/custom/native web/Code support, reconstructed run clearance, candidate/verifier/promoter/pin/adoption activation or browser/provider/qualification. Paired push follows checkpoint; t333 source bridge serial root now available, t334 reviewed pure-click ownership implementation next. No panel/fullsuite.

### 2026-10-07 - current source integration and installer/reset releases
- Changed: t333 actual facade bridge and complete original-source binding independently reviewed; canonical source sorting fixed after genuine counterexample. t335 smallest independent installer partition released with exclusive birth/process-crash conservative hold; no unsupported Windows directory durability claim. t336 actual atomic reset/reseed and reducer publication source release extends to focused authenticated control and internal safe counter owner.
- Validation: t333 final71/71 zero30.37s, Core types0/fresh build51.994s6250files, actual built domain32/32 zero6.341s; final checks/audits pending. t334 worker reproduced actual live-registration mutation during awaited admission sending1 instead of0; worker source fix/fresh gates pending root verification. t336 worker actual reset/reseed/in-place throw3/3 failed first, later23/23 observed; root independent verification pending. Root isolated fresh-directory sync probe returned EPERM fsync and cleaned only owned empty temp directory.
- Limits: implementation remains active. No semantic/oracle/pin/all-writer/adoption/promoter completion, live qualification, provider, panel or full suites. Existing production guard remains closed.

### 2026-10-07 - t333/t336 integrated and next semantic unit assigned
- Changed: complete actual original-source bridge integrated/pushed Corea2672def/down2affcc28; fixture atomic publication/generations integrated downstreamb8a158f8 after independent checks. Retired briefs preserved in archive. t337 full-original semantic grammar/private admission proposal reviewed after READY; form parser/scoped byte-bound owner released, controller/host join held. Scheduling missing calendar/account facts remains unknown. t334 root private exact native binding/controller getter/graph forwarding authored and types verified, fresh combined checks/build pending.
- Validation: t33371owning +actual external-Core domain32 zero skips, Core/domain types/build/audit gates observed and paired task boundaries completed. t336 root actual regenerated30/30 zero5.163s +real helper18/18 zero1.295s, source/e2e types0/runner emit0, merged tree audit0 and task gate0. No corpus/Core reset source changes. t334 root initial wrong controller field/exact-optional type errors corrected, nonincremental types0; source not yet independently accepted. Native parameter-contract dual mutation reproduced actual false-positive; fixed source/fresh downstream gates/browser proof pending. t335 fixed installer birth config via wx/file sync approved after reviewing unsuitable recursive legacy initializer; existing canonical schema barrel export approved, no migration edits.
- Limits: full plan remains active; no final-pair P0/A-D/provider qualification, semantic acceptance, causal oracle, adoption/pins/all-writer closure or production promotion. No panel/full validation sweep. Paired source pushes recorded above; latest fixture push follows checkpoint.

### 2026-10-07 - Claude intake after Codex: creation path broken, integrity chain parked, documents reclassified
- Changed: committed Codex's leftover plan edit (`53324d18`); intake reports A-C under `reports/intake-1007/`; 17 working documents reclassified, 23 Active to 6 (`57ef32ce`); 13 merged worktrees removed with `pnpm task abandon`; t334, t335 and t337 parked as WIP commits on their own branches (downstream `2849bded`, `65f24865`, `c22895a9`; Core `49525d93`, `25c595cf`, `4d358d95`); t338 started. Current State rewritten in plain English; Codex's Current State and the finished or parked briefs moved verbatim to `archive/2026-10-07-codex-current-state-and-parked-briefs.md`.
- Validation: supervisor read the source. `packages/test-runner/src/flow-lane/creation/readiness.ts:4-5` throws unconditionally and is called from `build-proposal.ts:362`, `chat/build-from-chat.ts:92`, `lane.ts:338` and `review-proposal.ts:26`. Core `runtime/conversations/commands/build.ts:37` hard-codes `authoringMode: "candidate"`. `create-here.ts:52` now answers "Saved a candidate draft. Verification pending; the Flow's steps are unchanged.", where baseline `e9b7d691` applied the adaptation and said the automation was ready. No production caller passes `commandOutcomeMode: "required"`; only `lifecycle.ts` checks it and `service.ts:2520` forwards it. After reclassification, `node scripts/structure-audit.mjs` printed "passed (174 warning(s), 117 baselined)".
- Limits: the intake read source and history only; no builds, tests, Lab runs or provider calls. "About 8,000 Core lines with no default caller" and the chain sizes are the workers' grep counts and judgement, spot-checked by the supervisor, not re-measured.

### 2026-10-07 - t339 candidate slice designed; decisions D1-D4 settled; U1 dispatched as task t339
- Changed: t339 design report (`reports/t339-candidate-slice-design.md`): candidate trial through the normal runtime via `runAutomationStudioDetachedCandidate`, the build-test judge on trial evidence only, promotion through the existing proposal/apply path; units U1-U4. Decisions by the supervisor, from the design and the user's standing rules: D1 an optional Core start hook the Lab points at its fixture reset before each trial, unset in product; D2 reuse the legacy apply path (lock plus base-digest check) for the MVP, revisit in hardening; D3 product trials run, because the user requires a whole-Flow run from the start judged successful before a build finishes and allows any act a person could do outside the permission gates (delete, money, send), which still ask; D4 the build judge's confirmed second yes accepts, the Lab oracle is the independent check. U1 brief written and dispatched as task t339; U2 waits for t338.
- Validation: supervisor confirmed `core.submit_candidate`'s description (`candidate/authoring-loop.ts:16`) contains no Flow format, and the format module is used only by `plan/evidence-schema.ts` (legacy completion); `runAutomationStudioDetachedCandidate` exists at `verification/detached-execution.ts:13`. Design otherwise read-only; nothing built or run.
- Limits: the candidate script format has no loop syntax, so lanes C and D cannot use candidate mode until it does; not yet scheduled. Consequence gating inside a trial (`permittedConsequences` on graph options) is unverified and U2 must check it before any live probe.

### 2026-10-07 - t339 U1 merged: candidate format and trial gate
- Changed: Core `953272c2` (source `3a250f97`), downstream merge of task t339. In candidate mode `core.submit_candidate` now carries the Flow script format and an act-on-one-item example; new `core.test_candidate` asks an injected trial port to run the exact latest revision and digest; completion needs a yes for that exact revision and digest, a no closes that digest, other verdicts refuse with feedback. Without a port nothing changes: completion saves an unverified draft. The example declares `modify_existing` for the add press, which is not permission-gated (`action-permissions/destructive.ts:53`). Port requests also carry the frozen candidate, so U2 must mint the candidate id before the loop.
- Validation: supervisor in the t339 Core tree: `npx vitest run` on `flow-bootstrap/candidate/tests` and `plan/tests` -> 16 files, 131 tests passed; `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` -> exit 0; Core `node scripts/structure-audit.mjs` -> passed (283 warnings, 349 baselined). Downstream `pnpm task finish t339` structure audit passed; Core finished with `--skip-checks` after those narrow gates (Core dev unchanged since the branch). Both dev branches pushed.
- Limits: no provider call or Lab run; candidate mode still ends as a draft until U2 supplies the trial runner. Risk for the live probe: a wrong "no" forces the model to change the Flow before it can finish.

## Open Questions

- Carried over from general-flow-authoring-plan (marked Complete 2026-10-07): P5 binding to an earlier step's output (`$step`) is still refused, and F7, a stored Flow node keeping no `consequences` for the stored-run permission gate, is still open. Schedule them only if an A-D or Phase 1b task needs them.
- Recording scope is resolved by the newer user order: evidence beside mandatory instructions, after A-D qualify. Do not reopen the older September ambiguity.
- Script channel, store eligibility and Firefox parity need a concrete feasibility result. Preserve no-debugger JS and requests-OFF policy meanwhile.
- Direct-request origins/session/redirect policy needs a concrete design; do not inherit the old any-origin default as authorization.
- Who runs the Phase 6 release-candidate script as the "person unfamiliar with FluxIQ"? Owner: user.
- Historical requested67task list had57existing rows; originalmissingten remain unknown. Ten clearly NEW proposals are integrated (t312 first3; t316 next3; t318 final4), preserving all original57 full ordered objects, with exact oracles; no recovered-history or qualification-pass claim. Optional original-list question remains unanswered.
