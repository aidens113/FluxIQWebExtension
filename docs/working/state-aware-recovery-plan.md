# State-Aware Recovery Plan

Status: Active
Status detail: Recovery matrix and paid R4a/R4b passed; A qualified; t449 optional-path completion and t450 candidate default integrated and pushed; B/C/D live qualification underway.
Created: 2026-10-09
Last updated: 2026-10-11
Owner: Senior supervisor agent
Scope: State-aware subflows (Call Subflow, entries, checkpoints), scoped lifecycle handlers (On Start, On Before, On Retry, On Fail, On Before Next), the integrated recovery ladder with safe state routing, smallest-unit repair, and the browser side that serves them (fact checks, interruption facts, in-flight command reconciliation, chat cards, Lab perturbations), with the schedule, acceptance matrix and briefs. The domain-neutral contracts are owned by the Core paired document; this document does not restate them.
Paired document: C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/state-aware-recovery-plan.md
Related: [consultant proposal](./state-aware-recovery-plan/consultant-proposal.md), [MVP final month plan](./mvp-final-month-plan.md), [testing facility](../architecture/testing-facility.md), [extension client](../architecture/extension-client.md)

---

## Current State

**What this is.** The user's consultant proposed state-aware subflows, scoped event handlers and a deterministic
recovery ladder ([proposal](./state-aware-recovery-plan/consultant-proposal.md)). This plan adopted it with the
adjustments below; the domain-neutral contracts are sections C1-C12 of the Core document
(`C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/state-aware-recovery-plan.md`). The user's revisions (2026-10-09):
model repair is the last rung **inside the live run** at the failing step, and the run carries on from where it was;
only saving the fix waits for the judged end. The model is called only on a **true failure**: retries spent with no
On Fail path to another node at any scope, or every On Fail path tried and failed (Core document C6).

**Implemented and merged into both `dev`s, pushed (2026-10-09/10, user: "use max subagents and implement this
fast").** Each unit was verified by the supervisor (tests beside each change, typechecks, structure audits).
- Core: lifecycle contracts (t385); requirement gate and protocol check (t386); safe routing guards (t387); candidate
  script parts, `call:`, start points, checkpoints, handlers, facts, `requires` (t388); run log (t391); executor
  integration: Call Subflow with frames, handlers at start/before/retry/fail/before_next, entries, checkpoint-only
  Routes, in-run repair that holds at the failing step and carries on, lost-command handling, effect check before
  retry/route/repair, orphaned-run sweep (t392); editor views (t395); `statement-packing` audit rule (t397); labels and
  recovery role (t398); locator facts (t402).
- Downstream: page facts (t389); Lab variants (t390); in-flight command record (t393); Lab fault injection (t394);
  chat recovery cards (t396); `pnpm lab recovery-matrix` (t399); fact handle resolution (t400); safe interference
  clearing (t401); matrix Flows (t403).
- Matrix-driven fixes (t404-t417): per-flow port keys, child-frame projection, navigating check reply, reconcile by
  command id, completed-act ledger with already-done skips, step `done when:` with page reconciliation, a landed
  lasting act never pressed twice. Matrix round 2: 14 of 14 cases pass provider-free, 0 model calls, 0 wrong routes,
  0 duplicated acts, 0 false successes.

**After paid R4a's two failures and the user's fingerprint rules (2026-10-10), all merged:**
- Fingerprint everywhere (user: every saved element carries a full multi-signal fingerprint): one builder
  `domain/src/element-fingerprint/` and one packet reader `runtime/llm-evidence/packet-fingerprint/` for recorded,
  model-built, repaired and in-run-repair steps (t422, t425, t429); absent id tokens never count (t419); a step with
  fewer than two identity signals is refused at save.
- The model never handles fingerprints (user): Core's boundary `runtime/llm/model-facing/` drops locators, scores and
  finding words from failure text (t426) and names a control by its own words (t431); element parameters are shown by
  handle only, Wait For Selector shows as Wait For Element, and a selector the model writes is refused on every path
  (t432).
- An interruption is dismissed through its way out, consent banners excepted; typing replaces a value (t423).
- Committing acts stay the domain's fact: a step's `consequences: none` never unlocks a second press (t430, which
  withdrew the supervisor's 61f6adbf); a step with no `done when:` asks the host's `actLanded`.
- Lost durable commands are reconciled by id; an unknown required outcome keeps its exactly-once latch and stops
  `run.outcome_uncertain`, worded from the page check (t427, supervisor decision (a)). Core's own transport sends
  required commands; a never-sent command ends unacted (t434). A runtime session run reuses one storage connection
  (t435: 43 reads per run from about 270 ms to 45 ms).
- Chat and trial wording: not found where saved, the box set back, what follows a failed step (t420, t421, t424,
  t428). Lab honest paths budget in page time (t433). Direct fixes 1ea9b038, b12f0391 (downstream), 19bf1773 (Core).

**2026-10-11/12 (this session): the paid proofs pass.** R4a attempt 3 (run-mv4912r9) and R4b (run-mv4dgmki,
run-mv4i1cls) failed on our defects (the user: "the model isn't the issue"); t436-t448 fixed them and are merged and
pushed in both repos: saved controls found on a later visit by scoring every signal (t436); Lab bundles publish while a
file is read (t437); one $0.10 purse per Flow in Lab scope (t438); saved steps rerun as saved, presses always declare
(t439); every element action repairable in-run (t440); a pressed control keeps its handle and pre-act identity (t442);
a repair rerun redoes earlier steps before a lasting act and the judge sees the real landing (t443, D1 unchanged);
requested acts never silently skipped (t444); unambiguous tool-call decisions accepted (t445); a renamed control
accepted by the in-run rung (t446); a created step carries its act's effect (t447); a repair replay succeeds when
every step ended well, unattended (t448).
- **R4a passed:** run-mv4dcf2j-cb68009a, $0.0365: built, trial passed, Lab replay on a fresh page passed with no repair.
- **R4b passed:** run-mv4itxkr-163e04a8, $0.0288: after the basket redesign the saved press failed its first attempt
  and 3 retries, the model was called once to diagnose and once to patch onto the renamed control, the run carried on
  and met the judgement, and the Lab's replay with the repair applied succeeded with no model call.
- **Checks:** sweep-1011 (both repos' full suites on dev) found two stale tests (prompt pin after t443, sealed-staging
  spend after t438), fixed forward; then Core 10,052 tests and the extension's `pnpm check`, `pnpm test`, `pnpm build`
  pass. Provider-free recovery matrix, all 14 cases, passed before each paid launch.

**October 11 continuation.** The [handoff execution](./live-testing-handoff-audit-2026-10-11.md) owns current briefs.
A's two round-3 creation passes plus two separate zero-model replays are supervisor-verified; no R4a/R4b relaunch
is owed. Recovered t274 C guidance/finishing changes and B's last-decision trial withdrawal fix are integrated.
D's later trials ran every displayed step successfully but ended failed for an unused optional-only wait;
paired t449 repairs terminal coverage for the exact validated optional bypass and reports graph-level endings.

**Next.** Verify/integrate t449 and t450 candidate-default; then B/C/D qualification on the new identified pair:
lane trees synced/rebuilt first, one lane per lab slot, every failure debugged before another launch.

**Blockers.** None.

**Follow-ups (not started).** Consolidate the way-out label lists (extension interference vocabulary and t430's domain
`act-landing/way-out-label.ts`) and guard optional steps to way-out presses (an optional step re-pointed to another
control that holds in the test is still saved, t439); steps an in-run repair writes carry no effect (t447); why R4a's
f2/f4/f6 lost scheduled candidates between repair rounds (t439); Upload's repair role is `clickable` (t440); chat turns
that neither build nor run are not charged to a Flow in Core (t438); chat wording: "Closed 2 notices ... It was"
(plural/singular), trial cards repeat the verb ("Choose · choose ..."), a search box named by its promotional
placeholder; bigbox "naive paths" stalls at 8 parallel copies (t433); only `runRuntimeSession` keeps storage
connections (t435); a matrix case for a timed-out dismiss press through `actLanded` (t430); reconciled flag in run
detail; Core web chat "Already done" wording.

**Binding rules every unit keeps** (the user's, from `mvp-final-month-plan.md` Current State, and Core's
architecture): state routing stays a global runtime behaviour that precedes any model call; every node keeps first
attempt plus 3 retries and a lasting act with an uncertain effect is never blindly repeated; the model is called
only on a true failure, inside the live run at the failing step, and the run carries on when the fix holds; any fix
(unit or whole) is saved to the Flow only after one judged whole run from the start; partial runs from a node are
allowed in repair; no permission grants for model calls (only genuinely risky acts ask the person); every saved
element carries a full fingerprint and the model names elements by handle only; tests and Lab runs use only the ten
realistic scenarios, headed, started from the extension chat for live runs; paid runs only with a live supervisor,
$0.10 per Flow, one attempt per launch, every run debugged before a rerun; the extension is chat-first and every step
is its own message with a card in plain words; model guidance never mirrors a realistic scenario's task or site; full
suites at most twice a day.

---

## Adjustments to the consultant plan

| Consultant proposal | Adjustment and reason |
| --- | --- |
| Build handlers, entries and a recovery ladder | **Extend the existing seams.** The ladder, state routing, optional/guarded steps, failure ports, Router, Call Flow typing and the effect model exist; new rungs and handlers plug into them. Two parallel systems would be the "accumulating special cases" the structural-agent plan warned about. |
| Never "jump to any node whose state resembles the page" | **Keep state routing, make it safe.** The user ordered it on 2026-10-01/02: a step that is not available routes by page state, for the whole runtime, before any model. It stays, with four guards (Core C6): the target is in the active frame; declared checkpoints are preferred and must have `true` facts; skipped nodes' unbound data refuses a forward route; a completed lasting act refuses a backward route unless its effect check says not landed. |
| "Local AI repair" as a ladder rung | **Kept as the last rung inside the live run, triggered only by a true failure** (user, 2026-10-09; Core C6 step 8). Today an adapting run already calls the model mid-run, but detached: the step loop ends, the patch is tried on a cloned Flow, and a new step loop restarts from a resume point rebuilt from receipts, which loses loop position and variables. R4b holds the run at the failing step instead: the model sees the live page and the incident's smallest unit (node, handler or part), its fix (including a new handler or a replaced part) is overlaid on this run's Flow and re-attempted there, and the run carries on. Retries and planned fails (an On Fail path to another node, or a deliberate stop) never call the model. Saving the fix still needs one judged whole run (the user's rule). Core's "a model is only ever called after the run" is rewritten when R4b lands. |
| One shared budget across retries, handlers, alternatives and routes | **The budget never cuts the retry floor.** First attempt plus 3 retries on every node is the user's rule and an architecture invariant. The shared incident budget covers handlers, routes and alternatives, carried across frames, never reset by entering a Subflow (Core C7). |
| A task composed of subflows that call each other | **Build Call Subflow and frames first.** Today one Router-selected Subflow runs per automation; nothing calls a sibling Subflow; the old `routine.subroutine` node is inert. R1 adds a Call Subflow node on Call Flow's typed boundary and an explicit frame stack. |
| Extract the transition logic into a pure controller | **No executor rewrite.** The new decisions (scope resolution, dispatch, continuation, entry selection, incident budget) are pure modules tested with a fake host; `graph-run.ts` gets wiring at its existing boundaries. Matches the 2026-10-06 consultant revision ("a wholesale file split is not a separate MVP dependency"). |
| Local hook ports and disconnected handler nodes | **One stored form.** A registration node plus body in the versioned Subflow graph (automation-wide ones in the automation's `recovery`-role Subflow). The authored `failed` edge and the optional way-on are read as node-scoped On Fail; the `clear_interference` rung folds in as an implicit registration. Hook ports are an editor view (R5b), not a second format. Router and Subflow records are not versioned, so nothing behavioural is stored there. |
| Avoid generic "close any modal" rules | **Agreed, with one existing exception kept.** The extension's in-page dismissal of a closed allow-list of layers stays as rung 0; it never touches a challenge. Authored handlers name the specific interruption by fact (dialog kind, its name, its control). |
| Facts, not page similarity; preserve unknown | **Extend the domain's expectation evaluator** into one batched, zero-wait, three-valued fact check (B1), with new kinds (value equals a literal or a Flow input, count, dialog kind). Only conditions of handlers active at that boundary are checked, in one round trip. |
| Persist execution position across extension reconnection | **Persist where the risk is.** The continuation lives in Core's process, not in the service worker; the service worker holds only the in-flight command. R5a records that command before dispatch, reports it after a restart as outcome unknown, deduplicates a re-sent command id, and Core reconciles before any retry. Core marks runs orphaned by its own restart as interrupted. Resuming a frame stack after a Core restart is post-RC. |
| Versioned capability support | **Small gate.** Handlers run in Core; only new fact checks need the extension. A Flow declares `requires`; Core refuses a run whose session lacks one, in plain words, and starts comparing the protocol version (Core C10). |
| Phase 2 "one known popup handler" | **Use the realistic scenarios' own variants** (`deal-wheel`, `flash-deal`, timed offers, rate-limited feeds) instead of new synthetic pages; the user allows only the ten realistic scenarios for any browser run. |
| Interruption handling in generation | **Keeps the user's t378 rule** (a rate-limit notice makes the build add wait/dismiss/continue and a growing pace, kept in the saved Flow). Predictable interruptions stay inline guarded steps; ones that can appear at several places, including any loop pass, become handlers. |
| Worked examples (invoice export, newsletter popup) | **Different sites.** company-website and bigbox-retail have timed newsletter/email offers, so examples use kinds of sites no realistic scenario has; Core's guard test enforces it. |
| Phase 5 editor (scope picker, hook ports, entry markers, inherited handlers) | **Chat first, editor later.** MVP UI: plain chat cards for each handler run, entry choice, route and alternative (B5); Core's run log shows the new trace records; the editor's validation stops flagging registered handler bodies as unreachable. The full editor is post-RC (R5b). |
| On Before Next | **Kept, low priority in guidance.** Its common case (a blocker appearing after a success) is caught by the next node's On Before; it is implemented in the same dispatcher and tested, but not taught in R4a's examples. |
| Five phases | **Mapped to R1-R5 with an MVP cut and a 2026-10-21 decision gate** (Schedule). |

---

## Browser-side contracts (owned here)

**B1. Fact evaluation.** A domain host capability `fact-evaluation` (beside `expectation-evaluation`,
`domain/src/runtime/host-runtime.ts:112`) evaluates a batch of Core `FactCondition`s (Core C9) in one content-script
round trip with no wait, returning per condition `true | false | unknown`, an evidence reference (the element's
fingerprint and a short text excerpt, never sensitive values) and `capturedAt`. `false` needs positive evidence in a
fully read document; an unreadable frame, a capture failure or a stale document is `unknown`. Kinds: today's exists,
absent, visible, enabled, text, url; new `value` (equals/contains/matches a literal or a bound Flow input; sensitive
fields refused), `count` (matching elements), `dialog` (page-evidence dialog `kind` plus name, from
`domain/src/page-evidence/types.ts:85-105`), `checked`/`selected`. Capability id `web.facts` with its kinds in
`domain/src/runtime/capabilities.ts`.

**B2. Interruption facts and rung 0.** Dialog, overlay and loading evidence are exposed as B1 facts. The in-page
allow-listed clearing (`apps/extension/src/content/interference/clear.ts`) and actionability retries stay rung 0 and
report what they cleared on the result, so Core's trace and the chat can say so.

**B3. In-flight command record and reconciliation (R5a).** Before sending `executeAction` to a tab, the background
writes `{ commandId, actionType, committing, tabId, documentId, startedAt }` to `chrome.storage.session` and clears
it on the result. On worker start, a leftover record is reported after `session_ready` as `client.action_result`
`{ status: "interrupted", effect: "unknown" }`. An `execute_action` repeating a command id whose result is queued
re-sends that result instead of acting again. Core treats `unknown` on a committing act as uncertain and runs the
effect check (Core C8) before any retry, route or alternative; the domain passes an effect check on the exploration
and replay paths (today both pass none, `domain/src/runtime/llm-evidence/node-run/run.ts:368`, `replay.ts:362`).

**B4. Capabilities.** `web.facts` and `web.actions.reconcile` are declared in the hello; the extension stamps and the
domain checks the protocol version (Core C10).

**B5. Chat cards (MVP UI).** Each Core `recovery` activity detail (Core C11) becomes its own chat message with a card
in plain words, never step numbers, node names or internal phrases, for example: "A sign-up box covered the page.
Closed it, then carried on with adding the kettle." / "The pickup store was already chosen, so started from picking a
time." / "That way to the basket didn't work, so used the other one; the basket matches." / "Tried to close the offer
twice and it stayed; stopped here." Chrome side panel and Firefox popup aligned. Wording lives beside the existing
step cards (`apps/extension/src/panel/chat/stream/step/`).

**B6. Lab perturbations.** On the ten realistic scenarios only: reuse existing variants (everything-store
`deal-wheel`, crossborder `flash-deal`, bigbox `store-remembered`, `redesigned-buy-box`, crossborder `basket-redesign`,
everything-store `redesigned-header`) and add switches where none exists: a known interruption at a chosen step or
loop pass; an interruption whose dismiss control does nothing; starting on a later page; a lost acknowledgement after
a committing act; the extension's service worker stopped mid-action. Run bundles record every lifecycle event.
Hand-authored Flows for the provider-free proofs live with the Lab's other test Flows.

**B7. Editor views (R5b, post-RC).** Hook ports drawn from node-scoped registrations, a labelled handler area, entry
and checkpoint markers, an inspector list of effective (inherited) handlers, the run log's lifecycle records.

---

## Phases, gates and schedule

| Phase | Dates (targets) | Work | Gate |
| --- | --- | --- | --- |
| R1 | Oct 10-14 | Core C1-C5, C7, C9, C10 types and pure modules; handler nodes and validation; Call Subflow (after the core types); requirement gate. Downstream B1 and B6 in parallel | Scripted tests with a fake host prove precedence, inactive-frame exclusion, every disposition by phase (including refusals), same-occurrence refusal, budget across frames, `unknown` never `true`, Call Subflow's typed boundary; the lanes' saved Flows replay provider-free with identical traces |
| R2 | Oct 14-19 | Wire C3/C5/C6 steps 1-6 into graph-run (after t388); fold clear_interference; C11 traces; B1 wired to Core; B5 cards; Core run log shows the new records | Matrix rows 4-7 pass provider-free on realistic scenarios with hand-authored Flows; zero model calls; no duplicated act; handler-check overhead measured |
| Decision | Oct 21 | Supervisor reviews R2's gate | Not met: R4b next, R3 and R4a after the RC; R1-R2 ship dormant |
| R3 | Oct 18-23 | Entries, checkpoints, success check (C2); safe state routing (C6); known alternatives through On Fail `resolve` | Matrix rows 1-3, 8, 10 provider-free; lane saved Flows replay unchanged (routing guards change behaviour for all Flows, so this merges between lane rounds) |
| R4a | Oct 21-27 | Script grammar, guidance, three examples, trial feedback naming handlers (C12), after t383 | Provider-free: parse/assemble tests for every example and the guard test; then one paid creation on a realistic scenario with an interruption variant (user approves the command) whose saved Flow holds a part, an entry or a handler, and whose zero-call replay passes with the variant on |
| R4b | Oct 21-28 | In-run repair (Core C6 step 8): true-failure trigger, hold in place, `repairIncident` callback, unit-scoped patch request with `add_handler` and `replace_unit`, overlay and re-attempt, carry on; chat card "Fixing a step"; after t383 | Provider-free with a scripted model: a true failure calls it once and the run carries on at the same loop pass and row; a retry, a planned fail and a deliberate stop make zero calls (matrix row 13); a fix that does not hold drops its overlay and ends honestly. Then one paid run on a realistic drift variant (user approves the command): the same run carries on after the fix, the judged end saves it, and its zero-call replay passes |
| Freeze | Oct 29 | | |
| R5a | Oct 29-Nov 4 | B3 reconciliation, orphaned-run sweep, matrix rows 9 and 11 | Provider-free; no duplicated committing act in either row |
| R4c, R5b | after Nov 10 | Post-run repair narrowed to the unit; editor views; resume after a Core restart | Unaffected parts' digests unchanged after a post-run unit repair |

## Acceptance matrix

Site assignments are proposals for B6 to confirm. "Free" = provider-free (zero model calls).

| # | Scenario | Realistic site and switch | Proof | Phase |
| --- | --- | --- | --- | --- |
| 1 | Cold start uses the default entry | crossborder hub-to-cart, lane A's saved Flow | free replay | R3 |
| 2 | Step already done: eligible entry, inputs bound | bigbox `store-remembered` | free, hand-authored entry | R3 |
| 3 | Similar page, wrong filters: shortcut refused | bigbox results after the Next arrow drops the filters | free | R3 |
| 4 | Popup before the first action and midway | everything-store `deal-wheel`; crossborder `flash-deal`; new switch for step N | free | R2 |
| 5 | Popup removal fails: no loop, honest end | new switch: dismiss control inert | free | R2 |
| 6 | Node and automation handlers both match: node wins, trace shows why | crossborder, hand-authored | free | R2 |
| 7 | Inactive part's handler matches: not run | bigbox, two parts, hand-authored | free | R2 |
| 8 | Primary way fails, known alternative passes the same check | bigbox `redesigned-buy-box` with an alternative part | free | R3 |
| 9 | Committing act's outcome lost: reconcile first | social-network-feed confirm, new switch drops the acknowledgement | free | R5a |
| 10 | Route back to a checkpoint: no repeated confirmation | social-network-feed confirm loop with its rate-limit notice | free | R3 |
| 11 | Service worker stopped mid-action | any lane site, new switch (feasibility checked by B6) | free | R5a |
| 12 | Change beyond known recovery: the failing unit is fixed in the run, which carries on | crossborder `basket-redesign` or bigbox `redesigned-buy-box` | paid, same run continues, judged whole run saves it, zero-call replay | R4b |
| 13 | Retries and planned fails never call the model | social-network-feed rate-limit notice handled by its On Fail path; an authored deliberate stop | free, scripted model asserts zero calls | R4b |

**Measures per round:** deterministic recovery rate (incidents closed without a model), true failures versus retries
and planned fails, model calls per true failure, runs that carried on after an in-run fix, model escalations a handler
could have avoided, wrong routes, duplicated acts, false successes, learning cost per accepted Flow, and handler-check
overhead (ms per boundary).

---

## Worker Briefs

Dispatch with `pnpm task start <slug> --worktree --core` (ids are allocated then); report to
`docs/working/state-aware-recovery-plan/reports/<label>.md` in the downstream tree. Contracts: the Core document's
sections named in each brief. Common to all: tests beside each change, each touched package's typecheck, the
structure audit, docs:check where docs change; no full suites; no paid run; never touch another `fxwork/` tree,
`lab-slots/` or Lab processes; do not commit; return at most 12 lines.

### Brief: R1-lifecycle-core (worker-high)
- Repository: Core (`!FluxIQ`); the downstream tree holds only the report.
- Task: implement Core C1 (frame type and stack only), C2 (metadata types and entry selection), C3-C5, C7 and C9 as
  types and pure functions: scope resolver (frame stack + registrations + event + node -> ordered candidates; node
  scope exact, ancestors only when `inherit`, inactive frames excluded), dispatcher decision (candidates + fact results
  + incident -> run handler or proceed), continuation rules per the disposition table (refusals included), incident
  budget (occurrence keys, defaults as named constants in the recovery-budget owner, never reset across frames, never
  below the retry floor), entry selection. Add `builtin.control.handler` and `builtin.control.handler-end` node
  definitions and the C4 validation in `model/validation/flow.ts` and web `flow-editor/graph-validation.ts`.
- Required reads: Core document C1-C5, C7, C9; `runtime/executor/recovery-ladder.ts`, `ladder-run.ts`,
  `recovery-budget.ts`, `retry-policy.ts`, `nodes/control-flow/start.ts`, `model/validation/flow.ts`.
- Owns: new `runtime/executor/frames/**`, `runtime/executor/lifecycle/**`, `nodes/control-flow/handler.ts`,
  `handler-end.ts` and the control-flow barrel, `model/validation/flow.ts`, the recovery-budget defaults file,
  `apps/web/src/features/automation-studio/flow-editor/graph-validation.ts`, tests beside each.
- Must not touch: `runtime/executor/graph-run.ts` (t388, then R2), `state-routing/**`, `runtime/llm/**`, `service.ts`.
- Definition of done: fake-host tests for every gate item of R1 except Call Subflow; existing executor and validation
  tests pass unchanged; a node reachable only from a registration's body is not reported unreachable, any other
  orphan still is; Core typecheck and structure audit pass.

### Brief: R1-gate (worker)
- Repository: Core.
- Task: Core C10. A Flow or Subflow graph `metadata.requires` list; before any step, refuse a run whose executor or
  connected client session lacks a listed id, with a plain reason naming it; compare the hello's protocol version to
  `CLIENT_GATEWAY_PROTOCOL_VERSION` and refuse a major mismatch. Flows without `requires` run unchanged.
- Required reads: Core document C10; `runtime/service/runtime-session/graph-options.ts:45-50`; client-gateway
  `service/inbound.ts:60-61`; `packages/contracts/src/client-gateway.ts:4-25`.
- Owns: `graph-options.ts` and a requirement-check module beside it (the capability-id constants live there); the
  inbound version check; tests beside each. Not `packages/contracts/src/client-gateway.ts` (R2-trace owns it).
- Must not touch: `service.ts` beyond one wiring call; `runtime/executor/**`.
- Definition of done: tests for allowed, missing capability refused (reason names it), no `requires` unchanged,
  version mismatch refused; typechecks and structure audit pass.

### Brief: R1-call-subflow (worker-high, after R1-lifecycle-core merges)
- Repository: Core.
- Task: Core C1 Call Subflow. `builtin.control.call-subflow` runs a sibling Subflow graph of the same automation at its
  latest revision inside a new frame, on the composite owner's typed boundary (generalise, do not copy); applies the
  Router-selected Subflow's mappings to the first frame; records `flowVersions` and `framePath`; refuses cycles through
  the frame stack; the container is not re-run as a whole. Remove the inert `builtin.routine.subroutine`.
- Required reads: Core document C1; `runtime/composite-execution/owner.ts`; `model/composites.ts`;
  `runtime/service.ts:2585-2651`; `model/flow-adaptation.ts:69-96`.
- Owns: `nodes/control-flow/call-subflow.ts`, `runtime/composite-execution/**`, a Subflow-invocation module beside
  `service.ts` (with one wiring call in it), `nodes/routine/subroutine.ts` (removal), tests beside each.
- Must not touch: `graph-run.ts`, `lifecycle/**` except imports.
- Definition of done: tests: only bound inputs reach the child; outputs leave only through bindings; `error.<id>`
  ports; a cycle is refused; trace frames and versions recorded; existing Call Flow and Router tests unchanged.

### Brief: B1-facts (worker-high)
- Repository: downstream (`domain/`, `apps/extension/`).
- Task: B1 above. A zero-wait batched fact check: a content-side evaluator (reusing the assertion evaluation's
  queries, `apps/extension/src/content/action-runtime/assertion-evaluation.ts`), a background route, a domain host
  method and the `web.facts` capability. Three-valued results with evidence and `capturedAt`; sensitive values never
  leave the page. Until Core's host interface exists (R2), define the domain-side function with the Core C9 shape.
- Required reads: this document's B1 and Core C9; `domain/src/runtime/host-runtime.ts`,
  `domain/src/runtime/expectation/evaluate.ts`, `conditions.ts`, `domain/src/page-evidence/types.ts`,
  `domain/src/runtime/capabilities.ts`, `domain/src/client/gateway-mapping.ts`.
- Owns: new `domain/src/runtime/facts/**`, new `apps/extension/src/content/facts/**`, the capability list, the host
  runtime's new method, the gateway mapping entry, tests beside each.
- Must not touch: `expectation/**` behaviour (shared readers keep today's results), `panel/**`, Core.
- Definition of done: unit tests per kind for true, false and unknown (unreadable frame, capture failure, stale
  document); one round trip per batch; a provider-free check on a realistic scenario page (everything-store with
  `deal-wheel`) reading the dialog fact; typechecks, structure audit, extension build.

### Brief: B6-perturbations (worker)
- Repository: downstream (`apps/scenario-lab/`, Lab scripts).
- Task: confirm a site and switch for each acceptance-matrix row (table above), writing the result into your report;
  implement the missing switches for rows 4 and 5 (interruption at a chosen step or loop pass; inert dismiss control)
  on the scenario chosen, following how existing variants are declared. Note for rows 9 and 11 whether the Lab can drop
  one acknowledgement and stop the extension's service worker mid-action, and how; do not build them yet.
- Required reads: `docs/architecture/testing-facility.md` scenario table (lines ~1037-1075) and variant mechanics;
  the chosen scenarios under `apps/scenario-lab/src/scenarios/`.
- Owns: the chosen scenarios' variant and switch files, their tests, the testing-facility doc's rows for them.
- Must not touch: lane trees, `lab-slots/`, Lab live guards, other scenarios.
- Definition of done: switches covered by scenario tests; one provider-free headed check per new switch showing the
  interruption at the chosen point; report with the per-row assignments and feasibility notes.

### Brief: R3-safe-state-routing (worker-high; started early, needs no new type)
- Repository: Core.
- Task: Core C6 "Safe state routing", the two guards that need nothing from R1: (a) a forward route is refused when
  a skipped node produces a value that a node on the route's path reads and that value is unbound; move the check in
  `executor/defensive/continuation.ts:157-169` into one shared module that continuation and the routing decision
  both call; (b) a backward route is refused when the walk from the target back to the failing node would repeat a
  completed lasting act that is not `RepeatIsSafe`, unless the host's effect check says it did not land. A refused
  candidate is dropped and the next ranked one tried; none left -> `none`, and the ladder runs as before. The trace's
  `stateRouting` record names the guard that refused (closed codes). Checkpoint preference and fact confirmation
  come later with R1/B1.
- Required reads: Core document C6; `executor/state-routing/**`, `executor/defensive/continuation.ts`,
  `defensive/lasting-act.ts`, `defensive/node-side-effect.ts`, `route-state/signatures/effect.ts`.
- Owns: `executor/state-routing/**`, `executor/defensive/continuation.ts`, the new shared data-dependency module, the
  `service/summaries/state-routing.ts` record if a new code must appear there, tests beside each.
- Must not touch: `graph-run.ts`, `step-skip/**`, `lifecycle/**`, `frames/**`.
- Definition of done: tests for each guard (refused, allowed, next candidate taken); existing state-routing and
  continuation tests pass (any changed expectation explained in the report); typecheck; structure audit.

### Brief: R4a-script-parts-handlers (worker-high; grammar against the contract names)
- Repository: Core.
- Task: Core C12 grammar in the candidate script, compiled to the C1/C2/C4/C9 shapes by their contract names
  (`builtin.control.call-subflow`, `builtin.control.handler`, `builtin.control.handler-end`, metadata
  `fluxiq.entry`, `fluxiq.checkpoint`, `FactCondition`), which R1 implements in parallel. A block without `when:`
  that a step calls with `call: <block label>` is a callable part (today `subflow_unreachable`); `run subflow` becomes
  `call:`; `input:` / `output:` lines; `start at: <step label>` + `when:`; `checkpoint: yes`; `on <before|retry|fail|
  start|next> [for <step labels> | for this part | everywhere]: <situation>` + `when:` + steps + `then: carry on |
  go to <checkpoint step> | use <output bindings> | give up` + `end`. A fact `when:` names a kind (exists, absent,
  visible, enabled, text, value, count, dialog), a target handle or dialog kind and name, and an optional op and
  value (`$input.x` allowed). A Flow using any of these gets `metadata.requires` (`flow.handlers@1`, `web.facts@1`).
  Format text gains one-line examples per rule; three worked examples (state-aware entry, interruption handler,
  verified alternative) on kinds of sites no realistic scenario uses; interruption guidance: predictable ->
  inline `optional:`/`only after:`, can appear at several places or any loop pass -> handler.
- Required reads: Core document C1, C2, C4, C9, C12; `flow-bootstrap/plan/flow-script-format.ts`,
  `flow-bootstrap/authoring/parse.ts`, `assemble.ts`, `script-statements/guarded-steps.ts`.
- Owns: `flow-bootstrap/plan/**`, `flow-bootstrap/authoring/**`, `flow-bootstrap/script-statements/**`, tests.
- Must not touch: `flow-bootstrap/candidate/**` and `runtime/llm/**` (t383), `executor/**`, `nodes/**`.
- Definition of done: parse/assemble tests for every new statement and every example; refusals name the script line
  (t378's rule); the Lab-mirroring guard test covers the new examples; existing script tests pass; typecheck;
  structure audit.

### Dispatch record, 2026-10-09
Ids are allocated in sequence, so the MVP plan's unstarted briefs no longer own t384-t391 by name.

| Task | Slug | Brief |
| --- | --- | --- |
| t383 | candidate-wrapup-refusal | MVP plan brief t383 |
| t384 | run-follow-ups | MVP plan brief "t388 run follow-ups" |
| t385 | lifecycle-core | R1-lifecycle-core |
| t386 | requirement-gate | R1-gate |
| t387 | safe-state-routing | R3-safe-state-routing |
| t388 | script-parts-handlers | R4a-script-parts-handlers |
| t389 | fact-evaluation | B1-facts |
| t390 | lab-perturbations | B6-perturbations |
| t391 | core-run-log | Core run log shows routing, skips, retries, pace and later the lifecycle records (B7/C11 MVP slice) |

Wave 2, after t385 merges: R1-call-subflow; R2-trace (C11, owns `packages/contracts/src/client-gateway.ts`); after
t384 too: R2-wiring. Wave 3: B5 chat cards, the Core run log, R3 entries and checkpoint preference, R4b in-run repair.
Their briefs are written here before dispatch, against the code as it then stands.

## Work Ledger

### 2026-10-09 - Plan written from the consultant's proposal and six maps
- Agent: senior supervisor agent (Claude)
- Changed: this document, `state-aware-recovery-plan/consultant-proposal.md`, the Core paired document (all new)
- Why: the user asked for a plan from the consultant's proposal, adjusted to the code, adjustments stated first
- Validation: documents only, no code changed: `node scripts/structure-audit.mjs --rule working-docs --rule docs-links` -> "structure-audit: passed (0 warning(s), 2 baselined)" here; in Core the same plus `node scripts/docs-reference.mjs --check` -> "passed (0 warning(s), 16 baselined)" and "Deterministic framework reference is current". Evidence: read-only maps of Core's executor, Flow model, authoring/repair, editor/traces and design documents, and of the extension and domain, at Core `dcaf8f9f` and downstream `111ea1dc`
- Outcome: Accepted
- Follow-up: dispatch R1-lifecycle-core, R1-gate, B1-facts, B6-perturbations on the user's go-ahead

### 2026-10-09 - Model repair moved into the live run; true failure defined
- Agent: senior supervisor agent (Claude)
- Changed: this document (Current State, adjustments row, schedule, matrix rows 12-13, measures, open questions); the Core paired document (C6 steps 8-9 and "What counts as a true failure", C7, C12, units)
- Why: the user said repair is meant to fix things on the fly at the step that fails, not detached from the live runtime, and that only a true failure (no On Fail path to another node) calls the model; checked against `service/adaptations/adaptive-retry.ts` and the architecture's "What the shipped app reaches", which show today's mid-run repair restarts a new step loop from a rebuilt resume point
- Validation: documents only: `node scripts/structure-audit.mjs --rule working-docs --rule docs-links` -> "passed (0 warning(s), 2 baselined)" here and "passed (0 warning(s), 16 baselined)" in Core; Core `node scripts/docs-reference.mjs --check` -> "Deterministic framework reference is current"
- Outcome: Accepted
- Follow-up: R4b joins the MVP cut after t383; dispatch R1/B1/B6 on the user's go-ahead

### 2026-10-09 - Wave 1 dispatched
- Agent: senior supervisor agent (Claude)
- Changed: task branches and worktrees t383-t391 (both repos where Core-paired); this document's briefs (R3-safe-state-routing, R4a-script-parts-handlers, R1-gate no longer owns the contracts file) and dispatch record
- Why: the user asked to implement the plan fast with as many subagents as possible; t383 and t384 (MVP briefs) unblock R4 and R2
- Validation: not validated (dispatch only); `pnpm task list` shows t383-t391 on `task/t3NN-<slug>` branches
- Outcome: Partial
- Follow-up: verify each worker's report and tests, merge t385 first, then wave 2

### 2026-10-09 - Wave 1 verified and merged (t383-t389, t391)
- Agent: senior supervisor agent (Claude)
- Changed: Core and downstream `dev` via `Merge task t383..t391` (t390 held); tooling commits `9f4d883a`, `17b1b968`
- Why: wave 1 of the plan; t386's `service.ts` one-line packing was replaced by extracting the Subflow ownership check, since `service.ts` may only shrink
- Validation: per task, the supervisor's own runs: t383 Core vitest 811/811, domain `test-domain.mjs extraction/tests/ resolve-plan-node` 168/168; t384 Core vitest 1244/1244, extension automations/shell/relay 189/189; t385 vitest 413/413; t386 vitest 76/76; t387 vitest 540/540; t388 vitest 1746/1746 (2 skipped); t389 domain 206/206, extension 674/674, extension build "verified 22 files" x3; t391 web vitest 160/160; each Core `tsc --noEmit` exit 0 and `structure-audit: passed`; Core `pnpm task finish` -> `"passed":true` for each. Core `pnpm check` failed once during t391's finish under parallel load and passed on rerun (failing test not captured)
- Outcome: Accepted
- Follow-up: merge t390 with t393; t392 lead running; B5 after t392's unit B

### 2026-10-10 - Executor integration merged; sweep-1010; matrix-driven fixes
- Agent: senior supervisor agent (Claude)
- Changed: `Merge task t392`, `t396`, `t399`-`t403` (both repos where paired); direct Core fixes `02d0cc82` (requirement gate grants `name@N` from a bare id at `metadata.version >= N`), `61f6adbf` (a step declaring no lasting consequence is retried after an ambiguous timeout), `dcc63bca` + `7a7fba52` (graph controller test follows t398's role argument); downstream `d9e1fcea` (`clearedLayers` lifted to the dispatch payload top), `4651c298` (locator facts)
- Why: t392 verified; the provider-free matrix (t404) found the gate's id mismatch (rows 2-7, 10 refused), the declared-none refusal (row 9) and the port key collision (row 8, t405); sweep-1010 found the stale web test
- Validation: t392 Core vitest over touched areas -> "579 passed | 3 skipped" files, "5495 passed | 7 skipped" tests; extension `test-extension.mjs shared/activity background/connection` -> 313/313; sweep-1010 (Core e396d489, downstream 4132eea2): Core install/build/check pass, Core `pnpm test` exit 1 (one web source-text test, now 10/10 after the fix), downstream check/build pass, downstream `pnpm test` exit 1 (row 8 save test, `UNIQUE constraint failed: flow_ports.port_id`, fixed by t405); gate test 12/12, defensive+executor tests 421/421
- Outcome: Partial
- Follow-up: merge t405; finish matrix round 1 (t404); paid proofs on the user's approval

### 2026-10-10 - Matrix round 1 and its fixes merged (t404-t415)
- Agent: senior supervisor agent (Claude)
- Changed: `Merge task` t404-t415 in both repos where paired; direct Core fixes 02d0cc82, 61f6adbf, 6a750cab, ae826078; docs b4998e7a
- Why: the provider-free matrix found real defects; each was fixed at its cause, two unsafe paths were closed (a landed lasting act re-pressed after a rejected expectation; a route refused instead of skipping completed acts)
- Validation: per task, the supervisor's runs, among them t405 storage+flows vitest 731 passed (4 skipped); t408 executor+validation 764/764; t409 gateway+defensive 188/188, domain 54/54, extension 288/288; t411 executor+service 919/919; t413 2833 passed (2 skipped); t415 Core 390, web 173, extension 339; every Core `tsc --noEmit` exit 0 and `structure-audit: passed`; `pnpm task finish` `"passed":true` both repos each time
- Outcome: Accepted
- Follow-up: round 2 (t417); paid proofs on approval

### 2026-10-10 - Paid proof R4a: failed at the trial's quantity step (run-mv2nlh9l-52e476da)
- Agent: senior supervisor agent (Claude); run from `fxwork/t418` (Core 3b54f5b0, downstream 5a02110f), instance `t418-proofs` (no Lab slot file changed: the loan was refused by the permission system; no lane was running), approved by the user
- Changed: nothing in product; debug report `state-aware-recovery-plan/reports/r4a-debug-run-mv2nlh9l.md`
- Why: R4a, candidate creation of crossborder hub-to-cart with the flash deal during the build; a first launch (launch-mv2nkl12) stopped before any call on `--target persistent-isolated conflicts with FLUXIQ_TEST_TARGET=isolated` from the copied `.env.local` and was relaunched with the target set
- Validation: `pnpm lab run crossborder-marketplace --variant flash-deal ... --authoring-mode candidate --workspace t418-r4a --replays 1` -> verdict failed, flowCreated false, cost $0.0525 (ceiling $0.10); the model met and closed the flash deal itself; trial nodes 1-8 succeeded, node 9 (quantity, t964) `web.target.not_found` best 0.27: its saved id `#fb1l6ufkg` is minted per load and not judged generated (`content/selector/volatile-identifier.ts:139-144`); the model never retested, looped clearing the box, three repeat refusals ended it. No state-aware feature failed
- Outcome: Blocked
- Follow-up: t419 (absent id tokens never contradict), t420 (trial feedback: handle still present, test again), t421 (chat wording from the UI review); relaunch R4a after they merge, then R4b

### 2026-10-10 - R4a attempt 2 failed; fingerprint and interruption fixes merged (t419-t424)
- Agent: senior supervisor agent (Claude)
- Changed: `Merge task` t419, t420, t421, t422, t423, t424 in both repos where paired; t425 and t426 dispatched
- Why: R4a attempt 2 (run-mv2pgqkj-f3552c70, $0.0779) failed: the quantity step's saved identity dropped its label, an optional step pressed a promotion's offer under `consequences: none`, and a clear step looped on a box the page refills; 19 of 48 decisions were wasted. The user then set the full-fingerprint rule and the rule that the model never handles fingerprints
- Validation: t422 domain plan-resolution 192/192, extension identity+action-runtime 418/418, content spec `created-identity` "1 passed (51.6s)", Core candidate-trial 64/64; t423 Core flow-bootstrap+activity wording vitest "276 passed" (26 files), extension wording 37/37, both typechecks exit 0; after t423 merged, extension activity+chat tests 495/495 on dev once Core's contracts and fluxiq builds were refreshed (the two failures before were the stale Core build); `pnpm task finish` "passed":true both repos for each
- Outcome: Accepted
- Follow-up: t425, t426; second sweep; ask the user before R4a attempt 3

### 2026-10-10 - Fingerprint everywhere, model-facing text screened, a double-press regression fixed
- Agent: senior supervisor agent (Claude)
- Changed: `Merge task` t425, t426, t428 in both repos; downstream 1ea9b038 (exploration retry metadata); t429 dispatched
- Why: the user's fingerprint rules; t425 found in-run repair steps saved raw; three domain safety tests (node-run/retries) failed on dev after 61f6adbf met the domain's `[]` for an undeclared press
- Validation: domain `test-domain.mjs src/runtime/llm-evidence/node-run` before the fix "pass 36, fail 3" (retries), after "302 pass, 1 fail" (the draft-control label test, fixed in t425); t425 merged tree `DOMAIN_TEST_BUILD_LABEL=t425 node domain/scripts/test-domain.mjs src/runtime/llm-evidence src/tests/ src/output-nodes src/element-fingerprint src/io src/client src/recording` -> "1328 pass, 0 fail", domain and extension tsc clean, worker's `created-identity` spec "1 passed" and recovery-matrix case 1 passed; t426 Core vitest over candidate-trial, llm/model-facing, recovery, flow-bootstrap/candidate -> "734 passed", Core check exit 0; t428 Core vitest activity + step-loop -> "334 passed"; recovery-matrix case 1 on dev (rmx-2026-10-10T19-16-39-962Z-b2d0a6) passed; every `pnpm task finish` "passed":true
- Outcome: Accepted
- Follow-up: t427, t429; second sweep; ask the user before R4a attempt 3

### 2026-10-10 - Sweep-1010b; durable reconcile, repair fingerprints, repair brief words; a declared-none override withdrawn
- Agent: senior supervisor agent (Claude)
- Changed: `Merge task` t427, t429, t431 in both repos; t430, t432, t433, t434 dispatched
- Why: sweep-1010b's failures (see Current State); t425's finding that in-run repair steps were saved raw; t427's open question 1, decided (a)
- Validation: sweep-1010b commands and exits: Core `pnpm install` 0, downstream `pnpm install` 0, Core `pnpm build` 0, Core `pnpm check` 0, Core `pnpm test` 1 ("1 failed | 1040 passed | 3 skipped" files, step-failure-port), downstream `pnpm check` 0, downstream `pnpm test` 1 (domain "pass 1740, fail 2"; then `pnpm -r --no-bail --filter '!@fluxiq-web-extension/domain' test`: extension "tests 2862, fail 0", test-runner "tests 2216, fail 0", scenario-lab "tests 694, fail 8"), downstream `pnpm build` 0; scenario-lab's two files alone "tests 22, pass 22"; t427 merged tree Core vitest client-gateway+executor+activity "1201 passed", domain io/runtime/client/node-run "486 pass, 2 fail" (the t430 pair); t429 merged tree Core recovery+runtime-session+in-run-repair+harness-options+live-patch "895 passed", domain llm-evidence "919 pass, 0 fail"; t431 Core "938 passed" after the supervisor restricted `name` to flat authored targets; each `pnpm task finish` "passed":true
- Outcome: Accepted
- Follow-up: t430, t432, t433, t434; consolidate the way-out label lists (extension vocabulary and t430's domain list)

### 2026-10-10 - Committing acts, handle-only model, transports and storage: t430, t432-t435
- Agent: senior supervisor agent (Claude)
- Changed: `Merge task` t430, t432, t433, t434, t435 in both repos; downstream b12f0391, 0378531a (R4a debug files); Core 19bf1773
- Why: sweep-1010b's domain failures (t430); the user's handle-only rule (t432); sweep-1010b's scenario-lab failures (t433); t427's open question 3 (t434); the required-mode service tests timing out on dev (t435, cause pre-existing)
- Validation: t430 merged tree Core executor+runtime-session+in-run-repair "107 passed" files, "901 passed" tests (an earlier run under four workers' load had 4 files fail to load, 42 tests, not reproduced in two reruns; its error was not captured), domain "88 pass"; t432 merged tree Core "378 passed | 1 skipped" files, "4355 passed" tests, domain runtime+output-nodes+actions "1502 pass, 0 fail", domain and extension tsc exit 0; t433 scenario-lab "tests 697, pass 697"; t434 merged tree Core "1073 passed", 2 failed (the required-mode tests, then on dev too); t435 merged tree Core "421 passed | 2 skipped" files, "3121 passed" tests, the filtered required-mode tests "2 passed" three times; each `pnpm task finish` "passed":true
- Outcome: Accepted
- Follow-up: matrix cases 1, 2, 9 on final dev; then the user's approval for R4a attempt 3

### 2026-10-10 - R4a attempt 3 launched and stopped at wrap-up
- Agent: senior supervisor agent (Claude)
- Changed: nothing in product; debug note `language-driven-flow-loop-plan/debugs/run-mv35459z-b5aa50cc.md`
- Why: the user approved R4a attempt 3 then R4b; minutes in, the user asked to wrap up, and a paid run never runs without a live supervisor
- Validation: before launch, `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --case 1 --case 2 --case 9` on dev (rmx-2026-10-10T23-54-47-485Z-5ac142) -> cases 1, 2 and 9 passed; `fxwork/t418` fast-forwarded to dev in both repos and rebuilt (`pnpm build` Core, `pnpm -r build` downstream, exit 0). The run reached mid-build (eight UI-review snapshots) and was stopped; its Lab, Core web, scenario server and browser processes were ended (none left)
- Outcome: Blocked
- Follow-up: relaunch supervised, then R4b

### 2026-10-10 - Handoff: Current State rewritten; paid R4a paused
- Agent: senior supervisor agent (Claude)
- Changed: this document's Current State and header, rewritten as a summary of what is true now
- Why: the user wrapped up the session ("we'll resume later"); R4a attempt 3 stopped and recorded
- Validation: `node scripts/structure-audit.mjs` -> "structure-audit: passed (184 warning(s), 651 baselined)." (run after this edit, see the commit); no product change in this entry
- Outcome: Accepted
- Follow-up: next session relaunches R4a attempt 3 supervised, then R4b, then lanes A-D round 3

### 2026-10-11 - R4a relaunched and failed on our defects; four root causes; t436-t438 dispatched
- Agent: senior supervisor agent (Claude); investigation workers (reports `state-aware-recovery-plan/reports/r4a-4-*.md`)
- Changed: debug note `language-driven-flow-loop-plan/debugs/run-mv4912r9-53b05a51.md`; no product change yet
- Why: R4a (run-mv4912r9-53b05a51, $0.1203) built a Flow whose trial passed, then the replay failed at step 6 "choose
  7-in-1": a visible chip "not found where it was saved"; in-run repair took three rounds to the call cap. The user:
  "the model isn't the issue" — these are our defects
- Validation: supervisor verified in source: `element-finder.ts:46-49` returns the first class-set match and
  `resolve-target.ts:491-497` returns on it, so the text scan never runs; `identity/candidates.ts:118-121` admits no
  script-bound div. Recorded rule check: the user's words are "$0.1 per flow max" (2026-10-01), so Core's separate
  creation and repair purses (`refuted-result/purse.ts:7-9` calls the split "the user's rule") are a defect.
  The unpublished bundle was a Windows EPERM on the staging rename, most likely the supervisor's own `tail -F` of
  `events.ndjson`; steps were in `~/FluxStuff/lab-runs/2026-10-11/run-mv4912r9-53b05a51/steps/`
- Outcome: Revised
- Follow-up: t436 resolver (A all class matches + text, B script-pressable candidates, C no chosen-state class
  saved); t437 bundle publish survives a reader, sealed staging read as finished; t438 (Core-paired) one purse per
  Flow; repair refusals root-caused (`r4a-4-repair-invalid-input.md`, verified at `repairable-parameters.ts:65-73`,
  `run.ts:287` and `run.ts:316`): t439 (Core-paired) saved steps rerun as saved (handle-only kept input, one
  domain-owned consequences rule, completion gate schedules unchanged steps, optional interruption never forced into a
  press, true chat wording); t440 repairable actions derived from the schemas (Set Checked was missing). Then merge,
  sync `fxwork/t418`, relaunch R4a. Supervisors must not tail files inside a `.staging-run-*` folder

### 2026-10-11 - t436-t441 merged: saved controls found again, saved steps rerun as saved, one purse per Flow
- Agent: senior supervisor agent (Claude); workers (reports `state-aware-recovery-plan/reports/t436..t441-*.md`)
- Changed: t436 resolver (class set answers all matches + words scored; script-pressable Level 2 candidates; chosen-state
  class not saved), `element-identity.md`; t437 bundle publish survives a reader, sealed staging read as finished,
  `unpublished` in the ledger, `testing-facility.md`; t438 (Core-paired) one Lab-scope purse per Flow covering build,
  repairs, re-authors, judge and the chat turn; t439 (Core-paired) one domain rule for declarations
  (`actions/consequence-declaration.ts`), saved steps rerun as saved, undeclared presses never sent, optional steps
  never forced, untested optional edits revert; t440 repairable actions from schemas; t441 two stale tests repaired
- Why: R4a run-mv4912r9-53b05a51's four root causes; the user: "the model isn't the issue"
- Validation: supervisor, each on its task branch: t440 `test-domain.mjs llm-evidence/tests/repairable-parameters
  llm-evidence/target/tests` -> "# pass 51 # fail 0"; t437 evidence 19/19, live-guards 42/42, test-runner
  facility-failure + lab-runs 44/44; t436 unit batch 341/342 (the one failure also on dev 327/328, fixed by t441),
  headed resolver net 55/56 (the one failure `volatile-selector-replay:179` also fails on dev, fixed by t441); t441
  batch "# pass 342 # fail 0", `volatile-selector-replay` headed "4 passed"; t438 Core vitest 54 files passed, tsc 0,
  downstream live-llm 145/145, Lab row + guards 75/75, Core merge gate `pnpm check` passed; t439 Core vitest
  "Test Files 183 passed, Tests 1873 passed", tsc 0, domain 766/766 after syncing to Core dev (t438+t439), extension
  activity 38/38, Core merge gate `pnpm check` passed
- Outcome: Accepted
- Follow-ups: an optional step re-pointed to a non-way-out control that holds in the test is still saved (guard
  optional steps to way-out presses; ties to consolidating the way-out label lists); why R4a's f2/f4/f6 lost their
  scheduled candidates between repair rounds; Upload's repair role is `clickable` (a file-input role needs
  `target/candidates.ts`); chat turns that neither build nor run are not charged to a Flow in Core; downstream post-run
  check and test-runner comments still say per-build; t439 Core was finished before its downstream half (order slip,
  no harm: downstream then synced to Core dev and re-validated)

### 2026-10-11 - R4a passed; R4b failed on new defects; t442-t446 dispatched
- Agent: senior supervisor agent (Claude); investigation workers (reports `reports/r4-refused-submits-and-decisions.md`,
  `r4b-coupon-step-identity.md`, `r4b-withheld-act-judge.md`)
- Changed: debug notes `run-mv4dcf2j-cb68009a.md` (R4a) and `run-mv4dgmki-2b13db91.md` (R4b); no product change yet
- Why: R4a (run-mv4dcf2j-cb68009a) passed: built in 81 s, trial passed, Lab replay on a fresh page passed with no
  repair, $0.0365. R4b (run-mv4dgmki-2b13db91) failed, $0.0887: the in-run rung refused the renamed "Add to basket"
  (`target_unanchored`); the re-author loop's rerun pressed it on a reloaded page with nothing redone, adding the wrong
  item; the judge then refused. The coupon step saved a wordless identity (t356's merge of before/after views)
- Validation: before both launches, provider-free `pnpm lab recovery-matrix --ready` then `--case 2 ... --case 11` in
  fxwork/t418 -> every case (1, 2, 3, 4a, 4b, 5-11, 13a, 13b) passed; R4a launcher `{"verdict":"passed",
  "totalEstimatedCostUsd":0.036523158, ... "buildsOverCeiling":0}`; R4b `{"verdict":"failed",
  "totalEstimatedCostUsd":0.088691622, ... "buildsOverCeiling":0}`, bundle published, ledger verdict truthful
- Outcome: Revised
- Decisions (supervisor): D1 (a build test never repeats a lasting effect) stays; the rerun-place fix plus judge
  evidence make one correct press provable. Approved: a step saves the control as it was when acted on, and words the
  act changed are its effect, never its identity. Refused handles enter the submit-refusal key
- Follow-up: t442 acted-control handle, pre-act identity, effect, save floor, refusal advice (Core-paired); t443 repair
  rerun redoes earlier steps and the judge sees the real landing (Core); t444 requested acts never silently skipped,
  done words count as done (Core); t445 unambiguous tool-call decisions accepted (Core); t446 renamed control accepted
  by the in-run rung (domain). Then matrix, sync, relaunch R4b

### 2026-10-12 - t442-t448 merged; sweep-1011 fixed forward; R4b passed
- Agent: senior supervisor agent (Claude); workers (reports `reports/t442..t448-*.md`)
- Changed: t442-t447 as in Current State (Core-paired where named); t448 the Lab's repair-replay success rule, plus the
  supervisor's unattended condition (a person-cleared step fails a replay); sweep fixes on dev: Core
  `system-prompt-pins.json` (t443's sentence), downstream `killed-run.test.mjs` (t438's per-Flow figure), Core
  `candidate-unusable-reply.test.ts` (t445's accepted shape)
- Why: R4b run-mv4dgmki-2b13db91 failed on our defects; R4b run-mv4i1cls-463e4b5c's product behaviour passed but the
  Lab's replay rule failed it on a retried busy press (the user's rule: one too-early attempt never fails a step)
- Validation: supervisor, on each task branch after merging the other repo's dev: t446 domain target + callers
  "# pass 58 # fail 0"; t445 Core llm "Test Files 57 passed, Tests 697 passed"; t444 Core "86 passed, 1132 passed";
  t442 domain "# pass 656 # fail 0", Core candidate "80 passed"; t443 Core "Test Files 173 passed, Tests 1895
  passed"; t447 Core "127 passed, 1221 passed", domain "# pass 745 # fail 0"; t448 test-runner flow-lane "# pass 308
  # fail 0", existing-fluxiq-control "# pass 24"; every tsc exit 0; Core merges gated by `pnpm check`. Sweep-1011:
  Core `pnpm test` "2 failed | 10052 passed" (both the stale pin, fixed: 31/31), downstream `pnpm check` 1 failure
  (stale figure, fixed; rerun exit 0), `pnpm test` exit 0, `pnpm build` exit 0. Recovery matrix all 14 cases passed
  before each launch. R4b run-mv4itxkr-163e04a8 launcher `{"verdict":"passed","totalEstimatedCostUsd":0.028847028,
  ... "buildsOverCeiling":0}`, replay `{"status":"succeeded","modelCalled":false,"goalPassed":true,
  "flowSucceeded":true}`
- Outcome: Accepted
- Decisions (supervisor): F5 save floor kept; first act's view wins for identity; t443's optional-step exception
  approved (a sometimes-present step may be absent without blocking a lasting act); a renamed same-place control with
  only its last word changed is accepted (the residual "Add to wishlist" case is bounded by the step's `done when:`)
- Follow-up: lanes A-D round 3; the follow-ups in Current State

## Open Questions

- User: approve the MVP cut (R1-R4b and R5a before the 11-10 deadline, R4c/R5b after the RC) or move the whole
  effort after the RC so lanes A-D and adaptation keep the remaining weeks.
- User: the paid R4a proof (one creation on a realistic scenario with an interruption variant) and the paid R4b proof
  (one run on a drift variant that is fixed in the run and carries on), each when its unit is ready.
- Supervisor, at B6: which realistic scenario offers two genuine ways to the same result for matrix row 8 (t390
  proposed bigbox `redesigned-buy-box` with the results tile's `+ Add`; to confirm when row 8 runs).
- Supervisor: an extra confirm in t399's first row-13a run (Lin confirmed between 38.3 s and 45.6 s while no command
  ran). t401 and t403 ruled out the click's second press, in-command retries, the clearing, a resent command, a
  duplicate content script and other click paths; ten later runs passed. Next probe in
  `reports/t403-committing-press-and-specs.md`; suspect the fixture replaying a queued request when its notice closes.
- Supervisor: whether step declarations should reach the extension so a committing press never re-presses on a
  missing signal. Not done (t403 reverted it): a committing press almost always fires a request, which already
  blocks the re-press, and forcing it broke the deliberate ignored-first-press rows (auction sort, buy box).
