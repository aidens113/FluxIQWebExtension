# Automation Project Agents Plan

Status: Active
Status detail: Planned 2026-10-13; nothing implemented. Core unit A1 is ready to dispatch; downstream units W1-W3 and A8 follow the Core units.
Created: 2026-10-13
Last updated: 2026-10-13
Owner: Senior supervisor agent
Scope: The browser side of FluxIQ's product-level agent system for building an automation project — a project supervisor agent that owns the task, structure, interfaces, case plan, budget and assembly, and spawns bounded subflow builders, validation and repair. This document owns host-action (tab) ownership, the chat presentation, Lab qualification and the extension wiring; the domain-neutral agent contracts are owned by the Core paired document.
Paired document: `C:\Users\osrs_\FluxStuff\!FluxIQ\docs\working\automation-project-agents-plan.md`
Related: [MVP final month plan](./mvp-final-month-plan.md), [state-aware recovery plan](./state-aware-recovery-plan.md), [structural agent plan (superseded; problem list B7, B8, F24)](./structural-agent-plan.md), [t532 entry-case report](./mvp-final-month-plan/reports/t532-applicable-entry-cases.md)

---

## Current State

**Planned, not built (2026-10-13).** The user asked for a system of agents
for building an automation project: a supervisor that spawns the subflow
builder we already have, the way this repository's supervisor spawns
workers. This document holds the evidence for it, the browser side, the chat,
the Lab qualification and the cross-repository order; the Core paired
document owns the roles and contracts.

**Decided (supervisor recommendations; the user may overrule any):**
- Five roles: project supervisor, subflow builder, repair agent; validator
  and promotion owner stay the existing Core services.
- New authoring mode `project` beside today's default `candidate`; the
  default flips only after the Lab comparison passes. One-part tasks are a
  one-subflow plan, so there is one path, not two.
- **Builders share the browser one at a time** under a host lease that names
  the tab; two tabs of one profile are not isolation (shared cookies, cart,
  session). Parallel builders wait for a separate browser context (post-MVP).
- One Flow purse; the supervisor carves allowances and keeps a reserve for the
  judged whole run and one repair round.
- Creation still ends only on one judged whole-Flow run from the start;
  builder subflow trials are partial tests.

**Done:** discovery (three read-only reports, 2026-10-13: Core build engine,
extension build path and live evidence, prior plans); this plan and its Core
pair. **Not done:** every unit. No source changed.

**Next, in order:** Core A1 (contracts and build record, ready now) with
downstream W1 design in parallel; then Core A2/A3/A4 with W1 (lease and tab
id) and W2 (chat attribution); then Core A5 (supervisor wiring, the single
`service.ts` owner); then W3 (step log) and A8 (Lab comparison, paid, needs a
live supervisor and a frozen pair). Interleaving with the Codex entry-case
and held-topology units is in the Core document's `Units`.

**Blocked:** nothing. Three decisions are the user's (Open Questions); each
has a recommendation the plan already follows.

---

## User Direction

User, 2026-10-13 (handed off from Codex): "we'll need to come up with a plan
for that. Like we'll prob need a system of different agents for managing
different parts of a automation project. For instance, the current one we have
for actually building subflows, but that gets spawned by a senior supervisor,
much like we have in this repo."

The October 13 wrap in `mvp-final-month-plan.md` queued the same design:
a product-level supervisor that owns task interpretation, the overarching
Flow/Router structure, interfaces, the supported-case plan, budget and
assembly; bounded subflow builders that return scoped graph proposals and
evidence; independent validation that supplies actual case and run receipts;
and repair that returns held revisions through the same judged promotion
owner. Workers never write accepted topology or waive task, permission or
coverage gates. The existing deterministic Call Subflow frames are not this
model-agent architecture.

The analogy is deliberate: the repository's own `AGENTS.md` roles (one
supervisor that plans, briefs, integrates and verifies; workers that execute
one bounded brief, own only their files, and report a claim that the
supervisor verifies) are the shape the product should have for building one
automation.

## Why Now: The Evidence

The 2026-10-06 consultant review said "no new multi-agent build pipeline is
required" and "subflow replacement can follow only when measured candidate
sizes justify it" (`mvp-final-month-plan/reports/consultant-doc-context.md:98-101,
204-205`). The user's 2026-10-13 direction overrides that, and the
measurements the consultant asked for now exist (discovery report, 2026-10-13,
from `lab-runs/` step `meta.json` usage and the saved debugs):

- **Context grows without bound in one agent.** `run-mv6qr7fk-77f30b49`
  (job-board): build-decision input grew from 14,691 tokens at step 0003 to
  34,882 at 0045, 59,237 at 0083 and 81,737 at 0110; judges, which start
  fresh, stayed near 15,400. `run-mv4v1v25-c7d57567` (store, $0.2124) spent
  1.82M input tokens over 42 calls and stopped on
  `flow_bootstrap.evidence_iteration_limit` although trials 3-6 already had
  all 13 rows right. `run-munmmj5n-52d8a67d` (crossborder) spent 1.74M.
- **Task parts get lost or invented.** `run-munmmj5n-52d8a67d` accepted seven
  navigations with no add-to-cart and no coupon step. `run-muq3uozx-3153564b`
  (confirm requests) lost its loop and pinned presses to handles, two on rows
  that did not qualify. `run-mv62icw3-9118516f` invented a "$25 to $50"
  filter for "under $50"; `run-mv6v2kzn-d593231f` added an unrequested
  column (0 of 7 oracle rows); `run-mv6v2hx5-f448e662`'s judges accepted an
  exclusion the instruction never asked for.
- **One budget for everything starves verification.**
  `run-mv4jqkko-bc9a05c6` (bigbox) accepted three revisions, tested none, and
  hit `run_budget_cost_exhausted`. `run-mv6qr7fk-77f30b49` ended at the call
  limit with each repair round costing about four calls.
- **Exploration churn becomes structure.** `run-mutepu6b-656f8882` spent
  steps 0034-0071 on about 19 refused or partial draft amendments;
  `run-mv6v2jh4-69244ffb` ended on four refused `submit_candidate` repeats.

None of these is a model being unable to do one subflow. They are one context
being asked to hold the whole task, the whole site history and its own
bookkeeping at once — problem-list items B7, B8 and F24. A supervisor with an
explicit task breakdown, bounded builders that start fresh, and a protected
verification reserve address those causes directly. Lab success rate on
10-12/10-13 was 24 passed, 25 failed (`lab-runs/index.md`).

What this plan does **not** claim: that agents fix wrong judgements
(`run-mv79nrcx-112c5ed7`, `run-mv6qr7fk-77f30b49`'s false "not newest-first")
or invented exclusions by themselves. The task spec gives the judge a
checklist of what was and was not asked, but the instructions stay the only
authority.

---

## Roles And Contracts (owned by Core)

The roles, invariants and contracts are owned by the Core paired document
and not restated here. In one paragraph: a **project supervisor** (model
agent) owns the task spec, structure plan, subflow interfaces, case plan,
allowances, dispatch, assembly and triage, and makes no lasting act; a
**subflow builder** (the existing candidate authoring loop scoped to one
subflow) explores from a prepared entry, submits a scoped proposal, tests it
from that entry and returns a claim; a **repair agent** does the same for the
smallest failing unit; the **validator** (trial port, detached execution,
judge) writes receipts; the **promotion owner** (existing) is the only writer
of accepted topology and needs one judged whole-Flow run from the start.
One purse per Flow; builders run one at a time under a host lease.

## Host Actions: Serialize Now, Isolate Later

Two builders on two tabs of the same browser profile are not isolated: they
share cookies, the session, the cart and every other server-side state, so
one builder's lasting act changes the other's page and invalidates its
evidence. Real isolation needs separate browser contexts, which lose the
user's signed-in session and so do not work in general.

The code today assumes one actor (discovery report, 2026-10-13):

- The extension does not serialize commands: `connection.ts:127,137`
  dispatches each `server.execute_action` fire-and-forget. In-flight
  reconciliation (`background/connection/in-flight/command-reconciliation.ts`)
  is keyed by command id for lost answers and worker restarts; it is not a lock.
- Commands go to the tab in front unless `browserTabId` is set
  (`background/.../action-runner.ts:197-213`); no build code sets it
  (`domain/src/client/gateway-action-parameters.ts:74,112` only reads it), and
  navigation brings its tab to the front (`automation-tab.ts:214-221`).
- One `ActivePage.currentTabId`, one `RuntimeStatusTracker` status, one
  module-global `automationTabs` history, one overlay target
  (`background/activity/overlay-target.ts`), per-origin page pacing for the
  whole worker (`background/page-pace/origin-pace.ts`), and a reset that closes
  every tab FluxIQ opened (`action-runner.ts:216-230`).
- The domain requires exactly one connected extension client for evidence and
  dispatch (`domain/src/runtime/llm-evidence/capture.ts:309-313`,
  `domain/src/io/gateway-output-dispatcher.ts:128-140`). Handles are scoped to
  project and Flow and "numbered for the whole Flow"
  (`domain/src/runtime/llm-evidence/tools.ts:114-116,303-336`), valid only from
  a retained packet that printed them (24 kept).
- Core's state-aware contract C3 already says "one execution owner per browser
  resource" (Core `state-aware-recovery-plan.md:139-140`).

Decision (supervisor recommendation): **one host lease per browser context;
builders run one at a time, in dependency order.** The lease holder is the
only role allowed to issue browser actions; the validator takes the lease for
its runs. This costs no real parallelism, because subflow N's entry state is
usually subflow N-1's exit state anyway. The gain from this plan is bounded
context and judged structure, not speed.

The lease is per browser context, not global, so genuine isolation can be
added later (for example read-only subflows in a separate signed-out context)
by issuing a second lease, without changing the roles.

The lasting-act ledger is project-scoped. Resetting before a trial restores
the *case's entry state*: return to the build's starting state through the
site's own controls, then prepare the entry by running the predecessor
candidates the case plan names (the t529 candidate helper execution). A
builder never undoes acts that existed before the build began.

## Chat Presentation (this repository owns)

The chat-first rule holds for every role: each step is its own message with
its reasoning and a card naming what it acted on (`mvp-final-month-plan.md`
standing rules). What changes is that steps now have an author.

- **Attribution on the wire.** Every `server.activity` event a build emits
  carries `agent: { role, briefId?, subflowName? }` (role is `supervisor`,
  `builder`, `repair` or `validator`). This is a wire-protocol change and
  moves together across Core's `ClientGatewayActivity` type, background
  routing, the domain gateway mapping, tests and
  `docs/architecture/extension-client.md`.
- **What the person sees, in order:** the supervisor's plan as one card
  (task parts, each subflow with a one-line purpose, the starting cases, the
  budget split); "Building <subflow>: <purpose>" when a brief is dispatched;
  that builder's steps as ordinary per-step messages under its subflow
  header; its return as a card (outcome, spend, what it tested); each
  validator receipt as a card; assembly; the judged whole run; the ending.
- **Paced display.** Because builders run one at a time, the single headline
  and the 1.6 s detail pacing (`extension-client.md:486-594`) still fit: the
  headline changes at brief boundaries. The overlay stays on the one leased
  tab.
- **History size.** `ActivityRelay`'s `UnitHistory` keeps the last 10 units of
  at most 500 events (`background/activity/unit-history.ts`). A build with a
  supervisor, several builders, the validator and a repair can pass 10 units
  on its own, so the build must be one unit with sub-units, or history must
  keep every unit of the current build. Decided in unit W2.
- The person can correct the plan card in the chat; a correction is a new
  instruction turn, never an edit the supervisor makes to the instructions.

## Extension And Domain Wiring (this repository owns)

1. **Lease enforcement at the boundary.** Every build command carries the
   lease holder id that Core issued. Core refuses a command from a role that
   does not hold the lease before it is sent; the extension checks it again in
   `ServerCommandChannel.handleCommand` and refuses a mismatched holder with a
   typed refusal, so a stale builder's late command cannot act after the lease
   moved. Serialization is Core's; the extension check catches mistakes.
2. **Leased tab.** The lease names the browser tab; build commands set
   `browserTabId` from it instead of relying on the tab in front. This is
   needed for a correct lease even without parallelism, and it removes the
   Lab's "bring the Flow's tab to the front" workaround
   (`testing-facility.md:1386-1398`) for builds.
3. **Entry preparation.** The domain host adapter owns site-control
   preparation and observation for a declared case (entry-case design unit 4,
   `mvp-final-month-plan/reports/codex-entry-case-acceptance-design.md`). A
   builder's entry is prepared by that owner, never by the builder driving
   there with exploration acts.
4. **Handles.** Handles stay Flow-scoped. A builder starts with a fresh look
   at its prepared entry; a brief never passes the supervisor's handles,
   because those packets may no longer be retained.
5. **No parallel host actions** until a second, isolated browser context
   exists (post-MVP, see Host Actions).

## Lab Qualification (this repository owns)

Measured against the current single agent on one frozen source pair, using
only the ten realistic scenarios, started from the extension chat, headed,
at most $0.25 per Flow, every run fully debugged before any rerun.

- **Tasks.** The multi-part tasks that fail today: crossborder (three hubs,
  seller, variant, ship-from, coupon), bigbox (switch store, add two sized
  items, keep the cart), social-network-feed (confirm requests with 5+ mutual
  friends, then a table), everything-store (every page, filtered,
  deduplicated). Plus one single-part task per already-qualified lane, to
  prove the one-subflow plan costs no more than today.
- **Per run, recorded:** exact oracle result, billed cost, calls, the largest
  single decision input in tokens, whether the reserve paid for the judged
  run, and per role: calls, cost, steps.
- **Pass:** the existing P1-P7 conduct and the two-consecutive-passes rule per
  site, plus a separate zero-model replay of the saved Flow. The lane counts
  structure only from receipts; a subflow count is never an oracle
  (`mvp-final-month-plan.md`, no subflow-count oracle).
- **Logs.** `steps/NNNN-*/meta.json` and `steps/index.md` gain `role` and
  `briefId` so a debug can read one builder's steps on their own.

## Units (this repository)

Partitioned by file; Core units A1-A7 are in the Core paired document.

- **W1 Lease enforcement and leased tab.** `apps/extension/src/background/connection/`
  (`server-command-channel.ts`: refuse a command whose lease holder or epoch
  is not current, typed refusal), `background/.../action-runner.ts` (use the
  lease's `browserTabId`), `domain/src/client/gateway-action-parameters.ts`
  (carry the lease). Paired with Core A3; wire change kept in step with
  `docs/architecture/web-capabilities.md`. Tests beside each file; a Chromium
  content-harness check that a stale holder's command is refused. Live
  browser check of the leased tab staying correct when the person switches
  tabs.
- **W2 Chat attribution.** `apps/extension/src/panel/chat/stream/` (plan,
  brief, return and receipt cards; per-subflow headers) and
  `background/activity/unit-history.ts` (keep every unit of the current
  build). Paired with Core A6; `docs/architecture/extension-client.md`
  updated. Chrome side panel and Firefox popup aligned.
- **W3 Lab step logs by role.** `scripts/lab/` step-log writer and
  `steps/index.md` gain `role` and `briefId`; `docs/architecture/testing-facility.md`.
- **A8 Lab comparison.** The qualification in `Lab Qualification` above,
  on a frozen source pair after A5, W1 and W2. Paid: one attempt per launch,
  a live supervisor, a full debug before any rerun.

## Order Across Both Repositories

1. Core A1 (contracts, build record). Downstream: nothing needed yet.
2. Core A2, A3, A4 and downstream W1, W2 in parallel (disjoint files; A3/W1
   and A6/W2 are paired wire changes merged together).
3. Core A5, the only `service.ts` change of this plan, serial with any other
   `service.ts` work (Codex entry-case and held-topology units included).
4. W3, then A8 on a frozen pair.
5. Core A7 after held-topology units 1-4.

Mode `project` stays off by default throughout; nothing here changes what a
build does today until A5 lands and the mode is chosen.

## Work Ledger

### 2026-10-13 — Plan written from three discovery reports
- Agent: supervisor
- Changed: this document (new); Core paired document (new); both `mvp-final-month-plan.md` Current States and indexes
- Why: user direction for a supervisor/builder agent system, queued in the October 13 wrap
- Validation: not validated by tests (planning only); discovery claims spot-checked in Core source (`service.ts:1495` child-build signature, `:2512` re-author call, `authoring-loop.ts:145` tool filter, purse `carriedUsd` and judging reserve)
- Outcome: Accepted
- Follow-up: dispatch Core A1

## Open Questions

Owned by the user; listed in full, with recommendations, in the Core paired
document: schedule against the MVP (recommended: before the 2026-10-29
freeze behind mode `project`), whether the supervisor may add required
starting cases (recommended: add-only), and whether the person confirms the
plan before builders start (recommended: no blocking step).
