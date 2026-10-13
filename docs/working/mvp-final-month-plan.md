# MVP Final Month Plan

Status: Active
Status detail: A qualified; fixes and candidate default pushed; B/C/D round four failed semantic/oracle gates; generic feedback fixes underway, future testing budget $0.25.
Created: 2026-10-05
Last updated: 2026-10-13
Owner: Senior supervisor agent
Scope: The ordered plan from 2026-10-05 to the polished-MVP deadline of 2026-11-10: what is done, what is held on unmerged branches or dirty trees, what must be integrated and pushed, and the week-by-week work to pass the 30-day plan's Final MVP Acceptance Test. It does not redo intake already recorded in the 2026-10-03 handoff, and it does not itself run live provider calls.
Paired document: C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/mvp-final-month-plan.md
Related: [30-day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md), [Claude handoff 2026-10-03](./claude-work-handoff-2026-10-03.md), [live loop](./language-driven-flow-loop-plan.md), [working index](./README.md)

---

## Current State

**Active continuation (October 13).** User directs continuous execution until the MVP is finished. Instruction-led t519 is delivered on both dev branches (Core 63692096 / downstream 7b416b99): existing automations require explicit written tasks before the next run; recordings are described optional evidence. t516/t517 are delivered too. Separate t518 is preserved, unmerged/unpushed; retired recording-only conversion is not a prerequisite for instruction-led qualification. Resume the adaptation gate and breadth on current source, then unresolved UX/extraction/hardening and release acceptance. Do not infer completion from historical lane qualifications. No user-panel management is authorized.

**Continuation recovered October 11 (Los Angeles).** Follow
[live-testing handoff and execution](./live-testing-handoff-audit-2026-10-11.md), which owns current briefs and validation.
The older October 9 handoff and ledger are retained in the archive linked below. Deadline November 10;
feature freeze October 29. No user panel has been started or managed by this continuation.

**Qualified: lanes A, B, C and D** (2026-10-13; B and D in round 12, C in round 16; details and run ids in the live-testing audit's Current State). Lane A: Same identified product pair for two consecutive candidate creations,
`run-mv4jihmm-af72a1e1` ($0.03038) and `run-mv4jvo7k-612f0bbb` ($0.04783), both exact oracles 4/4.
Separate replays `replay-mv4kt6g0-4e4900a8` and `replay-mv4kv3z1-2cfab70c` passed with unchanged saved
Flow hashes, independent goal held, model wiring disabled and every provider/intervention/harness count zero.
Supervisor inspected creation identities and replay receipts; saved UI/consequence-reporting issues remain follow-ups.
Evidence and exact commands are committed in `live-testing-handoff-audit-2026-10-11/reports/a-*.md` and
`mvp-final-month-plan/reports/lane-a-round3.md`. A's workspace/branch is retained for later live work.

**Creation/repair foundations proven:** R4a `run-mv4dcf2j-cb68009a` ($0.03652) and R4b
`run-mv4itxkr-163e04a8` ($0.02885) passed; t385-t448 state-aware recovery/fingerprint/retry fixes already
landed. Recovery matrix round 2 passed 14/14 provider-free. See the recovery plan for remaining scoped follow-ups.
These proofs do not replace the multi-site adaptation acceptance gate.

**Integrated in this continuation:** t274 recovered C's unfinished feedback/endings, finishing-tool and
paging guidance changes, plus B's confirmed final-turn tool withdrawal fix. Supervisor Core owning tests 80/80,
domain instructions 14/14, current Core typecheck and domain freshness/typecheck gate, both structure audits.
Candidate submission/testing stays available during look withdrawal and the final counted decision; accepted
receipts name the exact trial next. Mandatory trial acceptance is unchanged. Round-four B/C/D all exercised
submission and trial execution; their semantic/oracle failures are tracked in the execution document. Future
testing budget is $0.25 (new user authorization), historical round-four ceiling was $0.10.

**Not qualified:** B round 3 `run-mv4jqkko-bc9a05c6` ($0.09192) accepted three candidates but never tested one;
completion was forced after trial tools were withdrawn, then the purse refused another request. C's round-2
failure fixes are integrated but await a live rerun. D round 3 `run-mv4jjsvj-25b4dc2a` ($0.09410) reached
terminal reads after legitimately bypassing a conditional wait; the runtime incorrectly counted that wait as
unvisited required work. Its last three trials had all displayed steps succeed, but feedback omitted the
graph-level ending. Paired t449 repairs exact optional-path accounting and safe terminal feedback.

**Next order:**
1. t449 and t450 are independently verified, integrated and pushed in both repositories. Configured product default
   is candidate; explicit legacy opt-out and raw omitted-mode API compatibility are preserved. Round-four source
   freeze ended: B/C rejected semantic results, D false acceptance caught by independent oracle. t452 fixes
   generic feedback/category guidance/UI; inspect D judge evidence coverage before relaunch.
2. Sync/rebuild live lane trees to the new identified pair, run narrow free preflights and relevant recovery matrix
   cases, then qualify B/C/D: two creation passes on one pair with exact oracles and separate zero-model replays.
   Debug every failure fully, fix its cause and requalify on changed source; no relaunch loops.
3. t380 fixture fixes independently verified (45 tests including 16 actual-built process probes), integrated and pushed.
   Finish t381 connection ownership against t435 and reproduce
   B's separate recording.persistence problem provider-free. An old instruction for a whole suite before merging
   t381 is superseded by the newer narrow-gate user rule. Do not blame machine load or conflate recording with chat builds.
4. Prove adaptation on three sites twice each, then the ten-site/67-task breadth plan, recording plus mandatory
   instructions, exposed catalog/extraction/UX gaps, freeze/hardening and installed-browser release proof.

**Other retained units:** parked t334/t335/t337 production-integrity chain and paused UI review remain separate.
Branches/worktrees with zero ahead commits are not unfinished code merely because they exist. No destructive cleanup
or profile reset is needed to resume. Preserve the existing user edit to `.clinerules/fluxiq.md`.

**Standing user rules (binding on any agent; several lived only in Claude's private memory until today).**
- No time-of-day rule for live runs (2026-10-09); launch when ready. Peak pricing matters only when debugging a
  ceiling stop. A rule an agent derived is never presented as the user's.
- Testing now permits $0.25 per Flow (user, 2026-10-11, superseding $0.10): launch environment
  `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25`, counted in billed dollars; never cap model
  output. Paid runs only with a live supervisor; stop at the first balance error; no relaunch loops.
- Live runs: only the ten realistic scenarios; headed, visible browsers; started by typing into the real extension
  chat; one attempt per launch; every run debugged fully (every step logged as files) before a rerun; lane trees
  synced to dev and rebuilt first; up to four lanes at once; a live failure is a product or Lab defect, never
  machine load; review the UI in every live loop.
- Every node: first attempt plus 3 automatic retries on every path; a lasting act with an uncertain effect is
  never blindly repeated; a build never gives up on a recoverable failure.
- When a test run meets an interruption (a "going too fast" popup), the build adapts the Flow: a guarded
  wait/dismiss/continue step inside the loop and a pace that grows after a rate limit, kept in the saved Flow.
- The extension is chat-first: every step is its own message with its reasoning and a card with an icon naming
  what it acted on; the panel switches to the Chat tab when a run starts; a red dot only means recording.
- Recording is evidence beside mandatory instructions, never blind replay; recording-built Flows wait until A-D.
- Flows are authored as general structure (loops, row-bound steps, parameters); runtime routes by page state.
- No permission grants for model calls; only genuinely risky acts (move money, delete, send) ask the person.
- Typed nodes first; JS only after about three typed failures, scored as partial success; requests OFF by
  default; no debugger for JS.
- Model guidance never mirrors a realistic scenario's task (AGENTS.md; guard test in Core).
- Every saved element carries a full multi-signal fingerprint (user, 2026-10-10): element type, visible text,
  label, id, name, classes, role and other stable attributes; matching weighs them together so a changed id or
  class never breaks a Flow on its own. Applies to recorded, model-built and repaired steps alike (t422, t425).
  The model never sees or handles fingerprints: it names elements by handle, and the extension and domain build,
  save and match them (user, 2026-10-10).
- Full suites at most twice a day, in the background; each change gets only the tests beside it, its packages'
  typechecks and the structure audit.
- Status reports in plain English; answer a direct question first; announce before acting; act on a
  recommendation instead of asking; keep going until the work is done.


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

The following briefs are historical or reusable reference. Current dispatch and file ownership are in
[the continuation document](./live-testing-handoff-audit-2026-10-11.md); do not restart an older assigned unit from these templates.
Retired briefs: [2026-10-08 archive](./mvp-final-month-plan/archive/2026-10-08-retired-briefs.md) and [2026-10-07 archive](./mvp-final-month-plan/archive/2026-10-07-verified-slices-and-briefs.md).

### Brief: lanes A-D round 2 in candidate mode (one lead per lane)
- Replaces the lanes B-D first-probe brief and the t342 rounds 8-9 brief, both run on 2026-10-09 at 04:00 UTC (text in git history at `6c79c021`).
- Leads: one `lead-xhigh` per lane in its existing tree and slot, both repos synced to dev by the supervisor before dispatch: A `fxwork/t342` (slot 2), B `fxwork/t262` (slot 3), C `fxwork/t274` (slot 1), D `fxwork/t275` (slot 4). Report: append a round section to the lane's report from round 1 (A `t342-lane-a-baseline.md`, B/C/D `lane-<b|c|d>-candidate.md`). Never touch another lane's tree, slot or processes.
- What changed since round 1 (check each is in effect): Flow listings read only their rows and saved traces keep each input once (t377); Lab reads before the chat send retry (t377); refusals name the model's own script line and the format matches the checks; identical resubmissions get the original issues; a missing closing brace is repaired; interruptions are named in trial feedback, a guarded step in a loop and a pace are expressible, and `builtin.timing.wait` pauses; rows acted on are narrowed in the read (t378); Stop, Take over/Hand back, onboarding, the switch to Chat when a run starts, the neutral record button (t376); plain run endings (t375).
- Each lead: rebuild Core libraries, Core panel, domain, test-runner and extension; candidate dry run shows `candidateTrial` with `trialRunner` and `startReset` true; assert running identities; then the paid run(s), started from the extension chat, admitted by the Lab's guards (no time-of-day rule since 2026-10-09), flash model, $0.10 ceiling, headed browser, one attempt each, no relaunch. Lane A: a qualifying run; if the Lab's oracle passed and the product accepted it, its zero-call replay, then a second run on the same pair and its replay (two consecutive passes qualify the lane). Lanes B, C, D: one run; if it passes, its zero-call replay. Any failure: debug fully and stop.
- Debug completely: exploration, every submission (did a refusal name the script line, and did the model fix that line?), every trial (start reset, each step and attempts, interruptions met and what the feedback said), judge verdicts against the private oracle, promotion, chat apply, the Lab's playback and oracle, cost and calls. Lane D first: the user's rule that a rate-limit popup makes the build add a guarded wait/dismiss/continue step in the loop and a pace that grows, kept in the saved Flow; say whether it happened and why not.
- Early cause (supervisor, 2026-10-09, to shorten the fix loop): the moment a run fails and its decisive cause is known with the file to change, send the supervisor a message of at most 5 lines (run id, how far it got, the cause, the file, the evidence path); then finish the full debug.
- UI review at every moment (chat, cards, overlay, Automations): the onboarding at start, the switch to Chat when the Flow runs, Stop and Take over present, the record button neutral, card and ending wording.
- Binding: AGENTS.md rules (the ten realistic scenarios only; automatic retries) and Current State live-acceptance rules. Must not: edit product source, commit, create override files, manage the user's panel; leave no Lab processes running.
- Return at most 12 lines: verdict per run first (passed or failed, why, how far it got), judge versus oracle, cost and calls, distinct causes with exact reproduction and the file to change, UI findings, report path.

### Brief: t375 adaptation unblock (lead)
- Lead: `lead-xhigh`. Trees `fxwork/t375` (downstream and Core, both on `task/t375-adaptation-unblock`). Report: `docs/working/mvp-final-month-plan/reports/t375-adaptation-unblock.md` in the downstream tree. Merges only after lane A's streak ends; product source on dev stays frozen meanwhile.
- Source: [adaptation loop audit](./mvp-final-month-plan/reports/adaptation-loop-audit.md) (2026-10-05), blockers 1-6. First re-verify each blocker and file:line against current dev; candidate mode changed the build path since.
- Units, in order:
  1. Product runs can repair (blocker 1): the chat's "run it" (`conversations/commands/run-flow.ts`) and the extension's Automations Run (`background/automation-relay/automation-relay.ts`, Core `api/handlers/runtime-execution.ts`) carry the person's caller and `runIntent`. Check first and prove with a test: a run whose steps all succeed makes zero model calls, including the scheduled result check (item 23). User rule: no grants for model calls.
  2. Lab playback lets a repair promote (blocker 2): `test-runner/src/flow-lane/persisted-flow-run.ts`.
  3. Repair lane counts only replayed repairs (blocker 3): `flow-lane/repair/prove-repair.ts`, `run-repair-lane.ts`.
  4. Blocker 4: read one candidate-built saved Flow (lane A's `run-muz3cqdh-927fd2f1` evidence in `fxwork/t342`, read-only) for a verification basis. If trials on its nodes would be `unverifiable`, implement the audit's design (the judged whole run is the evidence).
  5. Re-authored Flows apply only after their re-run is judged (blocker 5).
  6. Item 24: the chat's run answer says in plain words what ran and what was learned, no raw run id; the Automations row counts only applied adaptations (`panel/automations/facts.ts`, `summary-copy.ts`).
- Owns those files and their tests, plus Core `runtime/service.ts` if a unit needs it. Must not edit files t376 owns (run-control, activity, client-gateway contracts, panel chat, overlay).
- Validation: the tests beside each change, each touched package's typecheck, the structure audit; no full suites; no paid Lab run; provider-free runs only on the ten realistic scenarios and never in a lane's tree or slot.
- Must not commit, merge or push (leave changes uncommitted; the supervisor commits), create override files, or manage the user's panel.
- Return at most 12 lines: per unit done or not, with cause; validation commands and observed output; what still needs a live proof; report path.

### Brief: t376 run controls and onboarding (lead)
- Lead: `lead`. Trees `fxwork/t376` (downstream and Core, both on `task/t376-run-controls-onboarding`). Report: `docs/working/mvp-final-month-plan/reports/t376-run-controls-onboarding.md` in the downstream tree. Merges only after lane A's streak ends.
- Source: [UX MVP design](./mvp-final-month-plan/reports/ux-mvp-design.md) (2026-10-05) Units 1-3 (onboarding after connect, Stop, take over and hand back) and its work units W-A, W-C, W-D, the Stop part of W-E, and W-G. t264 and t265 are merged, so all of these can start. Re-verify the design against current dev first; t373 added candidate chat cards in `panel/chat`.
- Owns: Core `runtime/run-control/**`, `runtime/executor/graph-run.ts`, `runtime/activity/**`, `api/handlers/run-control.ts`, `contracts/src/client-gateway.ts`, `apps/web/src/lib/program-route.ts`; extension `background/panel/**`, `background/activity/**`, `shared/{constants,protocol}.ts`, `shared/activity/**`, `panel/chat/**`, `panel/shell/**`, `content/activity-overlay/**`, `panel/automations/**` except `facts.ts` and `summary-copy.ts`; the new Lab panel-control helper; `docs/architecture/extension-client.md`.
- Must not edit `runtime/service.ts`, `conversations/commands/run-flow.ts`, `api/handlers/runtime-execution.ts` or `automation-relay.ts` (t375). If stopping a build needs `service.ts`, design it in the report and stop there.
- Added 2026-10-09 (user): the panel switches to the Chat tab whenever a run of the chosen project starts (Automations Run, the chat's "run it", a Lab playback through the API), unless a recording is in progress, so the person watches each step live. The idle "Start recording" button is neutral, not red; red only while a recording runs (`panel/recording/**` is also owned; the accessible name "Start recording" stays exact for the Lab).
- Chrome side panel and Firefox popup stay aligned. Words are plain (the chat-first UI rule).
- Validation: the tests beside each change, typechecks, the structure audit, the extension build; provider-free browser checks only on the ten realistic scenarios, never in a lane's tree or slot; no paid run.
- Must not commit, merge or push (leave changes uncommitted; the supervisor commits), create override files, or manage the user's panel.
- Return at most 12 lines: per unit done or not, with cause; validation commands and observed output; what still needs a live check; report path.

### Brief: t377 workspace reads scale (three workers, one Core-paired task)
- Tree `fxwork/t377` (both repos on `task/t377-workspace-read-scaling`). Each worker writes `docs/working/mvp-final-month-plan/reports/t377/<worker>.md` in the downstream tree. Evidence: lane A round 8 in `fxwork/t342/.../reports/t342-lane-a-baseline.md` and its debug `docs/working/language-driven-flow-loop-plan/debugs/run-mv0fu9uq-107ab0de.md` (same tree). Lane A run 8 died because Core answered `list-flows` after the Lab's one 10 s try: every Flow listing parses the whole workspace table (193 MB in `t342-a`), four times per cold call.
- W1 Core storage (`worker-high`): a Flow listing reads only the rows it needs (a key-prefix query, not a whole-table read). Path: `runtime/service.ts:1281` -> `legacy/store.ts:93-110` -> `programs/_shared/storage.ts:179-201` -> `sqlite-repository.ts:41`. Owns those files except `service.ts` (change it only if the call shape must change) and their tests. Prove with a test that a listing does not read unrelated rows, and measure a listing on a copy of a large workspace before and after (never the lane's live workspace).
- W2 Core attempt records (`worker-high`): each attempt copies every earlier step's result and page snapshot (`runtime/executor/node-execution/attempt.ts:120`), so trial sessions grow quadratically (15.2 MB for 19 attempts). Store each step's evidence once and reference it; every reader of those fields keeps working (the per-step run files the user requires stay complete). Owns `runtime/executor/node-execution/**` and the readers it must adjust; not W1's files.
- W3 Lab (`worker`): the chat thread's `list-flows` read (`packages/test-runner/src/flow-lane/creation/chat/chat-thread.ts:26`) gets the first try plus 3 retries and names the endpoint when it gives up (user rule: every safe read retries); audit the other Lab control reads before the chat send for the same single-try pattern. The `unchanged` guard (`scripts/lab/live-guards/rules/unchanged.mjs`, `guard-state.mjs`) does not count a run that failed before any provider call with a facility failure as a product failure. Owns those files and their tests.
- All: tests beside each change; the package typecheck; the structure audit. No paid run; never touch a lane tree, slot or process. Must not commit. Return at most 12 lines: done or not with cause, validation commands and output, what is unverified.

### Brief: t378 candidate refusals point at the model's own script line (lead)
- Lead: `lead-xhigh`. Trees `fxwork/t378` (both repos on `task/t378-candidate-feedback`). Report: `docs/working/mvp-final-month-plan/reports/t378-candidate-feedback.md` in the downstream tree. Evidence (read the hand-back sections and debugs, not whole reports): lane B `fxwork/t262/.../reports/lane-b-candidate.md` and debug `run-mv0fu9pb-57454dc4.md`; lane C `fxwork/t274/.../reports/lane-c-candidate.md`, `lane-c-candidate-ui.md`, debug `run-mv0fuotv-805294d7.md` (debugs under `docs/working/language-driven-flow-loop-plan/debugs/` in each lane tree).
- Recurring failure (structural fix, not patches): B and C were both refused at their first submission because the script format's text contradicts the checks, the refusal did not point at the model's own script line, and the repeat guard then dropped the issues. Fix the class:
  1. Every candidate refusal issue (parse, assemble, routing, domain resolution) names the script step's own name and line, and says what to write instead (B C2: `authoring/assemble.ts:342-344`, `bootstrap-completion.ts`, `issue-feedback.ts`; C C1: `authoring/parse.ts:182-189`, `draft-routing.ts:302,316`). Enforce it mechanically: a test that fails when any refusal code reaches the model without a script line.
  2. The script format (`flow-bootstrap/plan/flow-script-format.ts`) matches the checks, each rule with a one-line example: `consequences:` on a submitting type (`none` allowed; B C1, `:141`); where `repeat most:` goes (C C1, `:264`). Add a test that every example in the format text parses and assembles.
  3. In candidate mode an identical resubmission is answered with the original refusal's issues and candidate-mode advice, never the legacy draft advice (C C2, `runtime/llm/repeat-guard/feedback.ts:22-26`).
  4. Repair a reply that is missing only its final closing brace, as an extra one already is (C C3, `runtime/llm/deepseek/response-envelope.ts:116-129`).
  5. Domain: a handle the model was never shown is refused, naming the step (B C4; reproduce first).
  6. Wording (plain, per the chat-first rule): the refusal card's reason and count (B C3, `completion-refusal.ts:9`); the resubmission card; an ending that names its cause and never quotes "Create an automation here"; cards name the control and kind (choose, tick, type), never "Click" for a choice (lane A U1, `src/ui/activity-action/verb.ts:20-21`, `names.ts`); "Dom next page" becomes plain words; an unusable reply is not headed "Decided the next step"; model narration is not shown as fact.
  7. Lane D (sent to the lead 2026-10-09; evidence `fxwork/t275/.../reports/lane-d-candidate*.md`, debug `run-mv0fuual-f9e6f089.md`). User rule: a trial that meets an interruption leads the build to a guarded step in the loop (wait, dismiss, continue) and a pace that grows after a rate limit, both kept by the saved Flow. Trial feedback names the interruption, row and wait (`candidate-trial/feedback.ts:89-97`); the wait counts time already passed (`graph-run.ts:631-640`); `builtin.timing.wait` pauses instead of ending the run; the format allows a guarded step in a loop and a pace key; rows acted on are narrowed in the read (`extractList.where`), run-end processing is for output only; a repeat refusal means the same issue, not the same kind (`submission-refusal.ts:61-64`); an act on plain text is refused naming the step; Confirm cards name the row.
- Validation: tests beside each change, typechecks, structure audits, docs:check; provider-free reproductions of B's and C's refused scripts now refused with line-named issues (or accepted where the format allows them). No paid run; never touch a lane tree, slot or process, or `fxwork/t377`.
- Must not commit, merge or push; leave changes uncommitted. Return at most 12 lines: per unit done or not with cause, validation commands and output, what still needs a live run, report path.

### Brief: t379 paired tokens reach only what the pairing approved (worker-high)
- Tree `fxwork/t379` (Core `!FluxIQ` on `task/t379-paired-token-project-scope`; the downstream side holds only the report). Report: `docs/working/mvp-final-month-plan/reports/t379-paired-token-scope.md` in the downstream tree.
- Finding (t376 lead, 2026-10-09): a paired client's token is scoped to its domain at the program route (`apps/web/src/lib/program-route.ts:51-54`), not to a project; t376 added the run-control endpoints to that allowlist, so pause/resume inherit it.
- First establish the pairing contract from source and docs (Core client-gateway pairing, the approval screen, the extension's project chooser in `apps/extension/src/panel`): does a person approve a browser for one project, or for their account in a domain? Quote the evidence.
- If pairing binds a project: refuse at the route any token call whose payload or URL names another project, for every allowlisted endpoint, with tests (allowed, other project refused, missing project). If pairing is per account by design: change nothing in behaviour; write the contract into the route's header comment and `docs/architecture/automation-studio/client-gateway.md`, and test that a token cannot reach another person's project.
- Owns `program-route.ts`, its tests and the client-gateway doc; read anything. Validation: the route's tests, `apps/web` typecheck, Core structure audit, docs:check. Must not commit; never touch other `fxwork/` trees. Return at most 10 lines.

### Brief: t380 Core tests that fail only under load (worker-high)
- Tree `fxwork/t380` (Core `!FluxIQ` on `task/t380-load-sensitive-tests`; downstream holds only the report). Report: `docs/working/mvp-final-month-plan/reports/t380-load-sensitive-tests.md` in the downstream tree.
- Recurring (four tests today, each passes alone): sweep-1009 (`fxwork/sweep-1009/.../reports/sweep-1009.md`): `storage/canonical-authority/tests/whole-sql.test.ts` "refuses owner parent corruption before actual feed effect" timed out at 15 s; `runtime/service/flows/tests/creation.test.ts` "real generated orchestration Flow writer ingress" (2 tests) timed out, then `EBUSY ... global.sqlite` on cleanup. Supervisor's narrow run earlier: `runtime/tests/service-adaptation/tests/recovery-trace.test.ts` (2 tests) failed alongside other suites.
- Find the cause of each, not a bigger timeout: measure each test's time alone and inside `pnpm test`'s parallel run; look for database handles or files left open (the EBUSY says something still holds `global.sqlite`), files shared between tests or workers, real waits or sleeps, and work repeated per test that could be shared. Fix the cause in the test or its helper (or in product code if the product leaks a handle, which is then a product defect to name). A timeout may be raised only where the measured cost alone justifies it, with that number in a comment.
- Prove it: run each fixed file 5 times in a row alone, and the whole `packages/fluxiq` test run once; report times before and after.
- Owns those test files and their helpers. Must not commit; never touch other `fxwork/` trees. Return at most 10 lines.

### Brief: t381 storage keeps its connections (worker-high)
- Tree `fxwork/t381` (Core `!FluxIQ` on `task/t381-sqlite-connection-reuse`; downstream holds only the report). Report: `docs/working/mvp-final-month-plan/reports/t381-sqlite-connection-reuse.md` in the downstream tree. Merges after the lanes A-D round 2.
- Finding (t380, `fxwork/t380/.../reports/t380-load-sensitive-tests.md` item 1 and lines 20-40): `SQLiteRepository` (`packages/fluxiq/src/programs/database-manager/storage/sqlite-repository.ts`) opens a new connection on every call; each open re-runs `pragma journal_mode=WAL` and two `create ... if not exists`; each close of the last connection checkpoints and deletes the WAL and SHM files. One canonical Flow create or save is about 400 sequential statements and 25 `global.sqlite` opens (one creation round about 1,300 statements and 62 open/close cycles); global writes use `synchronous=FULL` where the project DB uses `NORMAL` in WAL.
- Goal: a process keeps one connection per database file (opened lazily, closed on dispose or exit), runs table DDL and pragmas once per connection, and a multi-statement write runs in one transaction. Keep correctness across processes (the Lab, the web panel and Core can open the same files: WAL, busy timeout, no stale reads). Decide `synchronous` for global writes with a reason. Measure statements, opens and wall time for one Flow create and save before and after.
- Owns `database-manager/storage/**` and the callers that must change to use a transaction; tests beside each. Prove: storage tests, the canonical-authority and flows tests, and the whole `packages/fluxiq` run once; a test that two connections in two processes see each other's committed writes. Must not commit; never touch other `fxwork/` trees. Return at most 10 lines.

### Briefs t383-t391 (2026-10-09, full development)
- Common rules for t383-t391: work only in your tree `fxwork/<id>` (downstream and Core on `task/<id>-<slug>`); report at `docs/working/mvp-final-month-plan/reports/<id>-<slug>.md` in the downstream tree; tests beside each change, typechecks and structure audits; never full suites; never touch another `fxwork/` tree, `lab-slots/` or Lab processes; no paid run unless the brief says so; do not commit; return at most 12 lines (done or not per unit with cause, validation commands and output, what needs a live check, report path). Live lanes run paid builds at the same time. Nothing merges until the supervisor says so.
- **t383 candidate wrap-up and refusal advice** (`worker-high`). (1) Lane C `run-mv0pa79q-ef91811b`: at 3 decisions left the wrap-up offers no tools (`runtime/llm/evidence-loop.ts:641-642`, `offered = wrappingUp ? [] : eligibleTools`), so `core.submit_candidate` is withdrawn and candidate `complete` can never succeed; keep submit in the candidate wrap-up and start wrap-up early enough to submit; candidate wording in `runtime/llm/loop-budget.ts:135`. (2) Lane D `run-mv0pcfaf-cd251bdc`: `runtime/flow-bootstrap/candidate/submission-refusal.ts:51` `HANDLE_ISSUE` matches every `web.handle.*`, so `web.handle.unknown_field` got the not-seen-handle advice (:138-142); give each code its own true advice; the domain issue names the bad field and the step's saved columns (`domain/src/runtime/llm-evidence/plan-resolution/extraction/conditions.ts` ~216, `columns.ts:265`). A test per code that the advice matches the code. Evidence: each lane tree's `test-runs/instances/<slot>/<run>/steps/`.
- **t384 Open in FluxIQ and Firefox popup** (`lead`). UX design report Units 5 and 7 (`reports/ux-mvp-design.md` sections "Unit 5" and "Unit 7"): Open in FluxIQ lands on the right Flow and its adaptation in the Core panel (deep link, MVP items 25-26), and the Firefox popup at about 600 px matches the Chrome side panel's contract. Owns `apps/extension/src/panel/open-fluxiq/**`, `background/panel/open-fluxiq.ts`, popup HTML/CSS, Core `apps/web` deep-link hook and session wiring. Not `panel/automations/**` (t388), not manifests (t390).
- **t385 adaptation live proof** (`lead-xhigh`, paid). The owed proofs in `reports/t375-adaptation-unblock.md` "Live proof still owed": bigbox redesigned (target override), social-feed regrouped (re-author, `--llm-permit send_or_publish`), and "run it" in the real extension chat on a saved Flow; each with a zero-call replay. Use the commands in `reports/adaptation-loop-audit.md` "Recommended live proof tasks" with `--authoring-mode candidate`. Slot: the supervisor assigns one when a lane frees it; prepare and preflight meanwhile. Same live rules as the lanes ($0.10 ceiling, one attempt, debug every run fully, early-cause message to "main").
- **t386 candidate follow-ups** (`worker-high`). Trial records keep every trial's verdict, not only the deciding one (Core promotion); `metadata.optional` alone falls under the optional-step rule (`executor/step-skip/optional-step.ts`); the candidate view record is persisted on the stored draft. Not `runtime/llm/**` or `flow-bootstrap/candidate/submission-refusal.ts` (t383), not `executor/graph-run.ts` (t388).
- **t387 recorder targets in shadow roots** (`worker-high`). Lane A's free practice run `run-mv0p1mbu-ee8c2d49` (`fxwork/t342/.../test-runs/instances/t342-slot-2/`) and round 8's note: a recorded step on the coupon inside the `fb-store-coupon` shadow root ends `web.target.not_found` after four attempts. Fix recording capture and replay resolution for open shadow roots (extension content/recording, domain resolution), plus Core recording import carrying `sometimesPresent` for the recording lane's repeated busy press. Prove with the crossborder scenario's fixture in a unit or provider-free test (ten realistic scenarios only for any browser run).
- **t388 run follow-ups** (`worker-high`). Core `executor/graph-run.ts` ladder `satisfied` rung keeps the attempt `failed` (`:645-651`): mark it so `flow-change/attempt-projection.ts` reads it as done; extension Automations row counts `durableBehaviorChanged` from listed runs (`panel/automations/controller.ts`, `replies.ts`, `types.ts`); the strip's Stop learns the run id from the run list, not only the reply.
- **t389 extraction UI** (`lead`). UX design report Unit 6 (t224's held units: caret and table, preview feedback) against current source. Owns `apps/extension/src/panel/extraction/**` and any Core dataset UI it needs.
- **t390 install and release proof** (`lead`). MVP item 1: packaged Chrome/Edge and Firefox builds (`docs/architecture/release-packaging.md`), install and quickstart docs for a person who has never seen FluxIQ (extension plus Core), and a clean-profile install proof of each package (provider-free, realistic scenario only). Owns release scripts, manifests, `docs/user/**`.
- **t391 breadth plan** (`lead`, read-only except docs). The schedule's breadth phase: the ten realistic sites and the 67-task denominator. Inventory each scenario's live tasks and oracles, which run today in candidate mode (dry runs only, zero calls), and write a ready-to-run campaign plan (order, lanes, expected blockers) as the report.

## Work Ledger

Earlier state and all 64 prior entries are preserved in
[the pre-continuation archive](./mvp-final-month-plan/archive/2026-10-11-pre-continuation-state-and-ledger.md).

### 2026-10-11 ? Handoff reconciled, A qualified and C/B source unit integrated
- Agent: Codex senior supervisor; a-review, b-debug and c-validation workers.
- Changed: Current State, archived historical state/ledger, recovered lane evidence and t274 source/docs.
- Why: current summaries predated finished round-3 runs and unfinished C changes; continuation was authorized.
- Validation: supervisor Core six owning files 80/80; domain instructions 14/14; current Core typecheck/domain check passed; both A replay JSON receipts independently passed exact hash/zero model/goal checks; task t274 downstream structure gate passed. Core default whole-check invocation was bypassed after actual owning tests/typecheck/audit under the newer narrow-gate rule.
- Outcome: Accepted bounded integration and A qualification; B/C/D live proofs remain open.
- Follow-up: t449/t450; updated live lanes and separate recording-persistence work.

## Open Questions

- Carried over from general-flow-authoring-plan (marked Complete 2026-10-07): P5 binding to an earlier step's output (`$step`) is still refused, and F7, a stored Flow node keeping no `consequences` for the stored-run permission gate, is still open. Schedule them only if an A-D or Phase 1b task needs them.
- Recording scope is resolved by the newer user order: evidence beside mandatory instructions, after A-D qualify. Do not reopen the older September ambiguity.
- Script channel, store eligibility and Firefox parity need a concrete feasibility result. Preserve no-debugger JS and requests-OFF policy meanwhile.
- Direct-request origins/session/redirect policy needs a concrete design; do not inherit the old any-origin default as authorization.
- Who runs the Phase 6 release-candidate script as the "person unfamiliar with FluxIQ"? Owner: user.
- Historical requested67task list had57existing rows; originalmissingten remain unknown. Ten clearly NEW proposals are integrated (t312 first3; t316 next3; t318 final4), preserving all original57 full ordered objects, with exact oracles; no recovered-history or qualification-pass claim. Optional original-list question remains unanswered.

### Brief: mvp-continuation-live-readiness
- Worker: codex-t516; discovery only in main downstream and existing lane trees; no source edits, paid launches or panel management.
- Read this Current State, adaptation-and-breadth-plan Current State and Phase 2/Gate oracle, owning Lab guard/setup scripts and latest lane debug only as needed.
- Inspect current slot ownership/processes without printing credentials, lane git status/build identities and recorded debug guard prerequisites. Find exact current Windows commands for crossborder/store/social gate and the remaining breadth reruns.
- Decide whether t519 creates any genuine launch incompatibility in existing instruction-created paths; never restore recorded-only conversion or synthesize task authority from fixture goals for saved Flows.
- Own report: docs/working/mvp-final-month-plan/reports/codex-continuation-live-readiness.md. Return recommended first slot/tree, narrow preflights/build commands, concrete blockers and owning source seams. Preserve profiles/data and existing lane work.
- No full suites/paid calls/commits/shared document edits. Do not start or stop any processes.

### Brief: mvp-continuation-recovery-triage
- Worker: replay_investigation; read-only in paired main and t518, no source edits or tests initially.
- Read this Current State, adaptation-and-breadth-plan Current State, instruction-led-automation-plan Current State and relevant t518 reports only as needed.
- Determine which unmerged t518 changes affect instruction-created/repaired Flow reliability independently of retired trace conversion, versus obsolete recording-only work. Assess native SQLite long-path issue for isolated instruction-first Lab builds.
- Own report: docs/working/mvp-final-month-plan/reports/codex-continuation-recovery-triage.md. Return smallest independently mergeable needed unit, exact files/dependencies, existing evidence and narrow regression commands. Do not merge/cherry-pick or erase t518.
- No full suites/paid calls/process management/commits/shared document edits; no user/browser/token data in output.

### Brief: mvp-continuation-acceptance-audit
- Worker: codex-t517; read-only downstream/Core source and authored docs.
- Read this Current State, 30-day plan Final MVP Acceptance Test and Week3/4 exit criteria, current node/extraction/manual findings documents' Current State as needed.
- Map remaining release acceptance gaps to actual existing code/evidence, distinguishing proven, implemented-unproven and missing. Focus on instruction-first user journey, adaptation visibility/reuse, extraction, operational controls, onboarding and installable artifacts.
- Own report: docs/working/mvp-final-month-plan/reports/codex-continuation-acceptance-audit.md. Give ordered concrete work, precise file ownership and narrow/live validation plan. Avoid broad cosmetic refactors or speculative post-MVP features.
- No source edits/full suites/paid calls/process management/commits/shared document edits or private recorded data output.

### Brief: t520-windows-sqlite-long-paths
- Worker: replay_investigation, after read-only triage report is frozen. Unit: paired fxwork/t520; branch task/t520-windows-sqlite-long-paths.
- Read current plan state, your triage report and Core AGENTS; inspect e60bfbe0 only for the two generic SQLite source/test files.
- Own: Core packages/fluxiq/src/programs/database-manager/storage/sqlite-repository.ts and its tests/sqlite-repository.test.ts only. No recording-related contracts/docs/source from t518.
- Port the minimal native Windows long-path SQLite opening fix to current dev, preserving POSIX behavior and both constructor paths. Existing-parent regression must demonstrate long path create/write/reopen/read.
- Record fail-first if feasible without editing main; test only owning SQLite repository/pool tests. No broad suite/type/build while root is independently preparing public libraries.
- Own report: main downstream docs/working/mvp-final-month-plan/reports/codex-t520-sqlite.md; root owns shared storage architecture/doc integration.
- No commits/merges/pushes, user runtime state, panel management, paid calls or t518 changes. Freeze source before reporting. Return exact files/check command/result and limitations.

### Brief: t521-durable-learning-run-summary
- Worker: codex-t517, after read-only acceptance audit report is frozen. Unit: paired fxwork/t521; branch task/t521-durable-learning-run-summary.
- Read current plan state, your acceptance audit and Core AGENTS; trace existing authoritative durableBehaviorChanged response/summary and current adaptation application semantics.
- Own Core apps/web/src/features/automation-studio/runtime/FlowRunView.tsx, RuntimePostRunSummary.tsx and focused run-detail/result projection/copy helpers if needed, adjacent tests/barrels only. Coordinate exact helper scope in report before large extraction; keep changes small.
- Reconnected/read-back run results must consume server summary.durableBehaviorChanged, covering runtime patches, handlers/inRunRepairs and result reauthor. Never infer learning from autoApply intent or created adaptation IDs. Preserve server's deliberate legacy semantics; no generic runtime changes.
- Post-run explanation distinguishes actual kept change, proposed/waiting/held-back change and no change, instead of saying every created repair needs approval. Do not overclaim actual reuse.
- Regressions: applied:false and missing application proof cannot claim durable change; authoritative true handles all repair kinds; failed/refuted/cancelled cases retain honest copy; existing readback/run-control behavior preserved.
- Own report main downstream docs/working/mvp-final-month-plan/reports/codex-t521-learning-summary.md. Run adjacent tests only; source freeze before root types/audit.
- No Core packages/downstream source/shared docs/commits/live/full suites/panel management/private data. Root owns paired docs and integration.

### 2026-10-13 - Continuous MVP execution and t520 narrow verification
- Agent: Codex senior supervisor; discovery reports from replay_investigation, codex-t516 and codex-t517.
- Changed: resumed instruction-led adaptation/breadth and remaining release acceptance on user direction; retained t518 except independently necessary native SQLite path fix. Written t520/t521 briefs precede worker execution; main unrelated .clinerules edit is preserved.
- Validation: independently reviewed t520 source/test diff, repository/pool13/13 passed on Windows, Core source/test typecheck passed and structure audit passed. Fresh narrow framework build passed. Native long-path failure was reproduced before worker fix; no recording-only endpoint or graph contract restored.
- Outcome: t520 accepted pending paired integration; lane readiness and bounded truthful-learning UI correction continue before live source freeze.

### Brief: continuation-crossborder-lane-preparation
- Worker: codex-t516 after readiness report frozen. Unit: existing clean paired fxwork/t418, slot3; no source edits.
- Read Current State, own readiness report, adaptation Phase2/Gate oracle and exact prior slot3 debug; preserve lane branch/history/data.
- Wait for root's t520/t521 integrated-source notice before syncing/building. Merge each local dev into its existing lane branch normally; never rebase/reset/discard divergent work. Stop and report conflicts or dirty source.
- Recheck lane/slot liveness with existing process helpers, preserve current slot3 owner marker under external run-scoped evidence, then assign the idle slot reservation to this lane. This coordination marker is agent-owned, not product runtime storage. Never touch other slots or guards.
- Preserve and copy exact prior slot3 debug into this lane so existing debug guard is satisfied; never fabricate a debug or write override files.
- Build only required Core public libraries/native gateway, web-domain host, scenario lab, runner prerequisite packages and instanced extension using owning launcher/cache. No full workspace suite/build; no user panel management.
- Preflight current instruction-led crossborder basket-redesign gate with dry-run readiness, zero providers; run only relevant free recovery matrix cases and scripted realistic base/variant workflow as needed. Bare --flow remains forbidden.
- Own report: docs/working/mvp-final-month-plan/reports/codex-continuation-crossborder-preparation.md in main downstream; logs/count-only receipts outside git. Return exact running source/artifact identity, ready flags, expected actual repair classification and failures.
- No paid launches until root sends frozen-pair authorization; no source/private data/commits/pushes. Keep slot3 reserved for this lane; report all processes actually started and cleanly close only your completed preflight children.

### Brief: t522-extraction-picker-ownership
- Worker: replay_investigation. Unit: downstream fxwork/t522/!FluxIQWebExtension, task/t522-extraction-picker-ownership; sibling detached Core is read-only.
- Read Current State, codex-continuation-acceptance-audit extraction section and prior extraction-receiver-release-readiness/confirmation-fixture-plan reports. User's complete-MVP direction releases this focused held receiver work; no broader paused UI review resumed.
- Own extension content/picker/session.ts and messages.ts, shared/extraction-messages.ts only for truthful stale_session union/comment; adjacent new receiver/confirmation tests and local test support/barrel. No Core/background/auth/recorded-event source edits.
- Implement accepted receiver lease separate from overlay/drain lifetime. Current exact successful pick remains confirmable after ordinary click/timer/draining Escape; invalid-definition/not-recording can retry. Known-retired start/cancel/record never touches newer picker; unknown matching cancel tombstones later delivery. Never-seen opaque start may replace; do not claim chronological ordering that IDs cannot prove.
- Duplicate current start must preserve successful pick and avoid duplicate listeners; refused pick can rearm same ID. Stale callback closures/timers, including restarted same-session timer, must check exact lease/operation before swallowing or releasing.
- Preserve idle never-retired no-pick DefineExtraction compatibility and existing emit/definition/recording gates; active other-picker record refuses before effect. Retain known retired IDs for content-document lifetime, reset only through explicit administrative stopPick hard-reset; ordinary production drain/replacement/cancel use owned release operations.
- Tests first reproduce stale A against B and successful public inference/confirmation. Use real inference/recordExtraction and structural synthetic fixture; no injected production test hook, value trace, fabricated success or weakened existing assertions. Preserve each accepted explicit Confirm invocation; no definition caching/idempotence invention.
- Own report main docs/working/mvp-final-month-plan/reports/codex-t522-picker.md. Narrow owning tests only then freeze; root types/audit/native realistic DOM proof. Stop and report any needed source beyond ownership before editing.
- No shared docs/commits/full suites/paid calls/process or user-panel management/private data. Read-only sibling Core; no t518 imports. Return exact limits, checks and changed paths.

### 2026-10-13 - t520 integration and t521 learning summary verification
- Agent: Codex senior supervisor.
- Changed: integrated t520 on both dev branches (downstream2583ccfc/Core6f11c3bc); t521 fixes read-back and post-run learning statements from authoritative durable summary, preserving unknown and actual review controls. t522 bounded extraction receiver ownership is released separately; the remainder of paused UX scope stays paused.
- Validation: t520 repository/pool13/13, Core source/test types, public-library build and both owning integration audits passed. For t521 root initial29pass/1obsolete-copy failure, corrected15/15 and final web types passed; no grant/review controls weakened. Final structure audit precedes merge. No full suite, provider call or user panel management.
- Outcome: current slots/lane identities mapped; slot3 reassigned after no-live-process check with old marker and prior debug preserved. Live preparation waits integrated source notice; paid qualification waits frozen t522 delta too.
