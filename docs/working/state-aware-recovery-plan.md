# State-Aware Recovery Plan

Status: Active
Status detail: Planned 2026-10-09 from the consultant's proposal, adjusted to the code and revised so model repair happens inside the live run on a true failure only; nothing implemented; R1, B1 and B6 briefs ready on the user's go-ahead.
Created: 2026-10-09
Last updated: 2026-10-09
Owner: Senior supervisor agent
Scope: State-aware subflows (Call Subflow, entries, checkpoints), scoped lifecycle handlers (On Start, On Before, On Retry, On Fail, On Before Next), the integrated recovery ladder with safe state routing, smallest-unit repair, and the browser side that serves them (fact checks, interruption facts, in-flight command reconciliation, chat cards, Lab perturbations), with the schedule, acceptance matrix and briefs. The domain-neutral contracts are owned by the Core paired document; this document does not restate them.
Paired document: C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/state-aware-recovery-plan.md
Related: [consultant proposal](./state-aware-recovery-plan/consultant-proposal.md), [MVP final month plan](./mvp-final-month-plan.md), [testing facility](../architecture/testing-facility.md), [extension client](../architecture/extension-client.md)

---

## Current State

**What this is (2026-10-09).** The user's consultant proposed making state-aware subflows, scoped event handlers and
a deterministic recovery ladder the next structural change ([proposal](./state-aware-recovery-plan/consultant-proposal.md)).
Six read-only maps checked it against Core `dcaf8f9f` and downstream `111ea1dc`: the executor and recovery, the Flow
model and subflows, authoring and repair, the extension and domain, the editor and traces, and every overlapping
design document. This plan adopts the proposal's goal and most of its semantics, with the adjustments below. The
contracts (frames, Call Subflow, subflow contract, events, handlers, continuations, ladder, incident budget, fact
conditions, requirement gate, traces, script grammar, unit repair) are sections C1-C12 of the Core document
(`C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/state-aware-recovery-plan.md`, "the Core document" below).

**Nothing is implemented.** No branch exists. Planning only: no code changed, no tests run, no provider calls.

**What the code already has, so the plan extends it rather than building beside it.** A recovery ladder (skip when
satisfied, wait for the recorded state, clear interference, retry, failed route, then recorded-only patch/reroute/
diagnosis); global state routing before the ladder with a progress guard; optional and guarded steps; named failure
ports; the Router choosing one Subflow per run by `state.*` rules; Call Flow with typed inputs, outputs and error
ports (for other published Flows only); regions with a declared `failed` handoff; one retry-policy owner (first
attempt plus 3 retries); the lasting-act and uncertain-effect model; the domain's expectation evaluator (exists,
absent, text, url, visible, enabled); typed dialog kinds (consent, rate limit, robot check, promotion, assistant);
in-page dismissal of an allow-listed set of layers; the candidate script's Router situation blocks; repairs that apply
only after a judged whole run.

**What is genuinely missing.** Subflow-to-subflow calls and invocation frames (a run executes exactly one Subflow;
its input/output mappings are validated but never applied); any lifecycle handler; declared entries and checkpoints;
data-dependency and side-effect guards on state routing (it picks the closest matching node by similarity); one
budget across retries, handlers, routes and alternatives; a three-valued fact check (a timed-out check counts as
false; nothing compares a field's value to a Flow input); deduplication or reconciliation of an in-flight browser
command (lost when the service worker restarts); unit-scoped repair (the re-author rebuilds the whole graph); a Flow
requirement gate against the connected extension (the protocol version is never compared).

**Recommended MVP cut** (deadline 2026-11-10, feature freeze 2026-10-29; see Schedule). Before the freeze: R1
(contracts, frames, Call Subflow, pure dispatcher, requirement gate, validation), R2 (handlers live, hand-authored,
provider-free proofs on realistic scenarios, chat cards), R3 (entries, checkpoints, safe state routing, known
alternatives), R4a (the candidate script can author parts, entries and handlers; one paid proof), R4b (in-run
repair: on a true failure the run holds at the failing step, the model fixes that unit on the live page, and the same
run carries on; one paid proof). During hardening: R5a (in-flight command reconciliation, orphaned-run sweep). After
the RC: R4c (post-run repair narrowed to the unit), R5b (editor), resume after a Core restart. **Decision gate
2026-10-21:** if R2's gate is not met, R4b goes next (it needs only R2), R3 and R4a move after the RC, and R1-R2 ship
dormant (a Flow without registrations runs exactly as today).

**Revised the same day (user).** "Part of this is that it's supposed to fix things on the fly": model repair is the
last rung **inside the live run**, at the step that fails, and the run carries on from exactly where it was (same
loop pass, same row). Only saving the fix to the Flow waits for the judged end. "Redefine what is considered truly
FAILING rather than just a retry or planned fail. EG if there is no edge from the on fail to some other node, THEN it
calls model": a **true failure** is retries spent with no On Fail path to another node at any scope, or every On Fail
path tried and failed; retries and planned fails never call the model (Core document C6).

**Conflicts with work in flight** (from the MVP plan's briefs): t388 owns `executor/graph-run.ts`, so R2's wiring
starts after t388 merges; t386 owns `executor/step-skip/optional-step.ts` (R3 reads, does not edit it); t383 owns
`runtime/llm/**` and `candidate/submission-refusal.ts`, so R4a and R4b start after t383 merges; t385 (adaptation live
proof) exercises today's detached repair path, which R4b replaces for runs that can hold in place, so t385's evidence
is the baseline R4b is measured against. R1, B1 and B6 touch none of
those files and can start now. This work must not delay lanes A-D round 3: lane trees are synced to `dev` only
between rounds, and a merge that changes behaviour for existing Flows (R3's routing guards) lands between rounds with
the lanes' saved Flows replayed provider-free first.

**Next.** On the user's go-ahead: dispatch R1-lifecycle-core and R1-gate (Core), B1-facts and B6-perturbations
(downstream) in parallel, each on its own task branch and worktree; R1-call-subflow after R1-lifecycle-core merges.
Briefs are below. Record each dispatch and result in the Work Ledger.

**Binding rules every unit keeps** (the user's, from `mvp-final-month-plan.md` Current State, and Core's
architecture): state routing stays a global runtime behaviour that precedes any model call; every node keeps first
attempt plus 3 retries and a lasting act with an uncertain effect is never blindly repeated; the model is called
only on a true failure, inside the live run at the failing step, and the run carries on when the fix holds; any fix
(unit or whole) is saved to the Flow only after one judged whole run from the start; partial runs from a node are
allowed in repair; no permission grants for model calls (only genuinely risky acts ask the person); tests and Lab runs use only the ten realistic scenarios, headed, started from the
extension chat for live runs; paid runs only with a live supervisor, $0.10 per Flow, one attempt per launch, every
run debugged before a rerun; the extension is chat-first and every step is its own message with a card in plain
words; model guidance never mirrors a realistic scenario's task or site; full suites at most twice a day.

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
- Owns: `graph-options.ts` and a requirement-check module beside it; the inbound version check; the contracts file's
  capability-id constants; tests beside each.
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

Later briefs (R2-R5) are written here before their dispatch, against the code as it then stands.

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

## Open Questions

- User: approve the MVP cut (R1-R4b before the freeze, R5a in hardening, R4c/R5b after the RC) or move the whole
  effort after the RC so lanes A-D and adaptation keep the remaining weeks.
- User: the paid R4a proof (one creation on a realistic scenario with an interruption variant) and the paid R4b proof
  (one run on a drift variant that is fixed in the run and carries on), each when its unit is ready.
- Supervisor, at B6: which realistic scenario offers two genuine ways to the same result for matrix row 8.
