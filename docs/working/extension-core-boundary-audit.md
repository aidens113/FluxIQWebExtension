# Extension And Core Boundary Audit

Status: Active
Status detail: Audit complete (no model calls downstream); the user approved implementing the six-phase move plan; lanes G, H, S (t726-t728) dispatched 2026-10-19.
Created: 2026-10-19
Last updated: 2026-10-19
Owner: Senior supervisor agent
Scope: Find anything in this repository that belongs in FluxIQ Core (model calls, prompts, judging, generic framework or gateway behaviour, durable ownership of projects, policies and recordings) and plan the moves. Planning only; no code moves in this effort until the user approves the plan.
Paired document: `docs/working/extension-boundary-moves.md` in FluxIQ Core
Related: [AGENTS.md](../../AGENTS.md) ("Repository Boundaries", "Automated Testing Facility Boundary"), [repository layout](../architecture/repository-layout.md), [breadth-forty-tasks-plan.md](./breadth-forty-tasks-plan.md)

---

## Current State

**Request (user, 2026-10-19):** audit the extension codebase and make sure nothing in this repository should be in
Core, such as calling models from the extension.

**The boundary (AGENTS.md):** `apps/extension` owns browser APIs, DOM access, recorder UI and browser-side
execution; `domain` owns web-automation contracts, state reducers, input/output mappings and runtime adapters;
generic gateway and framework behaviour belongs in Core; durable project, policy and recording ownership belongs in
Core, not extension-local storage. The extension may import domain contracts; domain must not depend on extension UI
or browser modules. Test infrastructure stays here unless it remains coherent with every browser, DOM, URL,
selector, tab, extension and web-automation concept removed and at least two real domain consumers need it.

**Answer (2026-10-19):** no model is called from this repository. The extension, the domain and the Lab make no
provider requests, import no provider SDK, read no provider key and estimate no tokens; the extension only calls
Core's program API with its pairing token, and the Lab only drives Core. Core owns projects, Flows, recordings,
policies and grants. Flow walking, retry policy, budgets, judging and site reset are already in Core.

**What is in the wrong place:** the client side of Core's gateway protocol (reconnect, heartbeat, offline queue,
command reconciliation, lease fencing, session picking) lives downstream because Core's socket client is a thin
transport; the offline queue keeps recorded page data across browser restarts and replays it to any later session;
the domain's system instructions carry framework rules; several modules are hand-synced twins of Core code; and the
build-cache and task tooling are unchecked, drifted copies of Core's. Ranked list and phased plan below.

**Approved (user, 2026-10-19):** implement the move plan with subagents, including the tooling recommendation
(Core owns the build-cache engine and the shared task rules; this repository imports them; drift checks on any copy
left). Execution is run from [trace-offline-trials-plan.md](./trace-offline-trials-plan.md) (lanes table): lane G
(t726) phases 1 and 3, lane H (t727) phases 0 and 5, lane S (t728) phases 2 and 4. Branches exist; nothing is
implemented yet. A paired Core document is opened by the first lane that edits Core.

**Dispatched 2026-10-19:** lanes G, H and S are running; their briefs are in
[trace-offline-trials-plan.md](./trace-offline-trials-plan.md) under "Worker Briefs" (lane-g, lane-h, lane-s), and
each lane's running log is `extension-core-boundary-audit/reports/lane-<g|h|s>.md` in its own worktree. Core's paired
document is `docs/working/extension-boundary-moves.md` in FluxIQ Core.

**Next:** commit each lane's units as they land; record the checks in this ledger.

## Worker Briefs

Shared rules: read-only on source (no edits, builds, browser or paid runs, commits); work on `dev` in
`C:/Users/osrs_/FluxStuff/!FluxIQWebExtension` and read Core at `C:/Users/osrs_/FluxStuff/!FluxIQ` only to compare;
write only your own report. Each finding: file and symbol, what it does, the boundary rule it breaks (or why it
correctly stays), evidence (quote the call or import), the proposed owner in Core or "stays", the move's risk and
the Core seam it would use. Separate confirmed findings from suspicions. Never copy secrets, tokens or page data.

- **A1, model calls and model-facing text:** every place downstream that calls a model or provider (any HTTP to
  provider APIs, SDK imports, API keys, token or cost accounting), builds prompts, tool descriptions, judge or
  verification requests, or holds model-facing guidance text; across `apps/extension`, `domain`, `packages/*`,
  `scripts/`. Lab/test code that only drives Core's own gateway is fine; say which is which.
- **A2, persistence and ownership:** every use of `chrome.storage`, IndexedDB, `localStorage`, files or SQLite
  downstream, and what it holds (projects, Flows, recordings, policies, grants, tokens, run data, settings).
  Classify each as legitimate extension-local state (pairing secrets, UI preferences, transient caches) or durable
  ownership that belongs in Core.
- **A3, generic framework logic:** logic in `domain` and the extension's `background`, `runtime` and `shared` that
  is not web-specific: Flow execution or routing, retry and backoff policy, planning, verification or judging,
  reset or ledger logic, budgets, generic gateway or protocol behaviour, state machines that Core also has. Name
  any duplication of a Core module.
- **A4, packages and scripts:** `packages/*` (agent-orchestrator, boundary-audit, real-site-policy, test-*) and
  `scripts/`: which are web-automation or test infrastructure (stay) and which are generic tooling or framework
  that Core should own or that duplicates Core (for example mirrored scripts), applying the test-facility promotion
  rule.

## Findings

Reports: [A1 model calls](./extension-core-boundary-audit/reports/a1-model-calls.md),
[A2 persistence](./extension-core-boundary-audit/reports/a2-persistence.md),
[A3 framework logic](./extension-core-boundary-audit/reports/a3-framework-logic.md),
[A4 packages and scripts](./extension-core-boundary-audit/reports/a4-packages-scripts.md).

| # | Severity | Finding | Where | Proposed owner |
| --- | --- | --- | --- | --- |
| 1 | High | The client half of Core's gateway protocols lives downstream: reconnect with backoff, heartbeat, offline queue, command reconciliation, lease epoch fencing (`domain/src/client/host-lease.ts` has no web concept), and session picking, done in three places with two different rules. | `apps/extension/src/background/gateway-session.ts`, `domain/src/client/*` | Core `client-gateway-websocket` client; the domain keeps only the web adapter (A3) |
| 2 | High | The offline event queue (`fluxiq.queuedEvents`) keeps up to 1,000 DOM snapshots, typed values and action results in persistent extension storage across browser restarts and replays them to whichever session connects next. | `background/storage.ts`, `gateway-session.ts` `send`/`flushQueue` | Stays downstream, but with browser-session lifetime and each entry tied to its session, project and recording; queue semantics follow item 1 (A2) |
| 3 | High | `WEB_LLM_SYSTEM_INSTRUCTIONS` uses Core's intended seam but carries framework rules: recordings versus instructions, permissions, loop grammar, and a cost line copied from Core. | domain web instructions | Generic rules into Core's prompt; the domain keeps only web-specific wording (A1) |
| 4 | Medium | Hand-synced twins: the activity headline, pacer and wording exist in both the extension and Core `apps/web`; `where`-condition and number reading exist in both the domain and `@fluxiq/contracts` record-sets (held equal by a parity test); the content script's `order-rows.ts` re-implements Core's dedupe and sort. | extension activity, domain record-set readers, content order-rows | One Core source each, imported downstream (A3) |
| 5 | Medium | Drifted tooling copies with no check: `scripts/build-cache` (30 of 40 shared files differ; missing Core's later fixes such as output replay and git-visible fingerprinting), `scripts/task` (id allocation, refs, branch naming and git runner overlap Core's, kept in step by comment only); the structure-audit mirror is in sync but unchecked. | `scripts/build-cache`, `scripts/task`, `scripts/structure-audit*` | Core owns the build-cache engine and shared task rules and this repository imports them; any copy that remains gets a mechanical drift check (A4) |
| 6 | Medium | The Lab reconstructs figures Core does not publish: total spend, missing ledger calls, consequences on failed builds, empty-balance errors. | `packages/test-runner/src/live-llm/*` | Core publishes run accounting; the Lab reads it (A1) |
| 7 | Medium | Policy decided outside Core, though both are off today: the recording capture switches, and `requestsEnabled` (forced off in the extension, with a separate request policy in the domain). | extension settings, `domain/src/requests` | Core owns the policy; the extension enforces what Core says (A2) |
| 8 | Medium | The domain keeps way-out references and per-build memories in process memory (lost on a Core restart), and works out when a build starts by parsing Core's `initial.<toolId>` call ids. | `domain/src/cleared-way-outs`, build memories | Core exposes the build lifecycle; durable state in Core (A2, A3) |
| 9 | Low | Generic helpers in the domain: `swapped-name.ts`; a card-number screen missing from Core's secret screen; `reusable-evidence-coordinator.ts` with no production caller. Core's activity hard-codes the repeated-answer marker's reason string. | domain helpers | Screen into Core; delete the unused coordinator; helpers to Core if reused (A3) |
| 10 | Low | `packages/agent-orchestrator` has no consumer but is built and tested by `pnpm -r`. | `packages/agent-orchestrator` | Delete (A4) |
| 11 | Low | The provider key variable list is defined twice (identical today); a stale "$0.10 default" comment in `test-contracts/src/llm.ts` (Core's default is $0.25; $0.10 is the test default). | `scripts/provider-secret-environment.mjs`, `test-runner/src/environment.ts`, `test-contracts/src/llm.ts` | One list; fix the comment (A4) |
| 12 | Low | Nothing mechanically stops a future provider call downstream. | structure audit config | A structure-audit rule that fails on provider hosts, SDKs or key reads outside the Lab's Core-driving code (A1) |

To verify (suspected, not traced): `packages/test-runner/src/core-web-build/` runs its own production build of Core's
web panel although Core has `web:build`; `scripts/lab/core/build/` judges Core staleness by modification times rather
than Core's build cache; `packages/test-matrix` may select synthetic scenarios for CI browser checks, which would
break the ten-realistic-scenarios rule if those jobs open a browser.

## Move Plan (proposed, awaiting approval)

- **Phase 0, guards and cleanup (downstream only, small):** item 12's provider-call rule; drift checks for every
  remaining mirror of Core code (the structure audit first); delete `agent-orchestrator` and the unused
  coordinator; one provider key list and the comment fix; trace the three suspicions.
- **Phase 1, privacy fix (downstream):** item 2, the offline queue scoped to its browser session, project and
  recording.
- **Phase 2, Core publishes what downstream reconstructs:** run accounting (item 6) and the build lifecycle
  (item 8); the Lab and domain switch to them and drop their parsers.
- **Phase 3, the gateway client into Core:** item 1; Core's socket client gains reconnect, heartbeat, queue,
  reconciliation, lease fencing and one session-picking rule; the domain keeps the web adapter.
- **Phase 4, single sources:** item 4's twins, item 3's generic prompt rules, item 7's policy switches and item 9's
  secret screen move to Core and are imported here.
- **Phase 5, tooling:** item 5; Core owns the build-cache engine and the shared task rules, and this repository
  imports them.

Each phase is a paired task with tests beside every change and both repositories' narrow checks, and opens a Core
working document before its first Core edit.

## Work Ledger

### 2026-10-19 - Audit dispatched
- Agent: supervisor
- Changed: this document
- Why: user request to find downstream code that belongs in Core.
- Validation: not validated; the audit has just been dispatched.
- Outcome: Partial
- Follow-up: consolidate A1-A4.

### 2026-10-19 - A1-A4 reports consolidated
- Agent: supervisor (A1-A4 read-only workers)
- Changed: this document; `extension-core-boundary-audit/reports/a1` to `a4`
- Why: findings and a phased move plan for the user's approval.
- Validation: worker searches, not supervisor reruns (read-only audit): A1 `git grep` over extension, domain,
  packages, Lab and scripts for provider hosts, SDKs, keys, prompts and cost -> no provider call in production or Lab
  code; A2 searches for every storage API and module-level state -> only the stores in its table; A3 header survey
  of 394 domain and 159 extension files, about 45 read in depth; A4 `diff --strip-trailing-cr` against Core ->
  structure audit 55 of 56 files identical (config is per-repository), build-cache 10 identical / 30 differ /
  11 here only / 17 Core only, task 0 identical / 17 differ.
- Outcome: Accepted (planning)
- Follow-up: user approval of the move plan.

### 2026-10-19 - Move plan approved; lanes created
- Agent: supervisor
- Changed: this document's Current State; lanes recorded in `trace-offline-trials-plan.md`
- Why: the user approved implementing the move plan with subagents.
- Validation: `pnpm task start <slug> --worktree --core` -> t726 gateway-client-into-core, t727 guards-and-tooling,
  t728 single-sources-telemetry created; their worktrees `git status --short` -> 0 lines.
- Outcome: Partial (nothing implemented yet)
- Follow-up: dispatch lanes G, H, S.

### 2026-10-19 - Lane H phase 0 verified and committed on t727
- Agent: supervisor (lane-h, workers H1-H4)
- Changed: provider-call rule (`restricted-references`, Core first then mirrored), `scripts/check/core-mirror*` wired
  into `pnpm check`, `packages/agent-orchestrator` and `reusable-evidence-coordinator.ts` deleted, one provider key
  list, the "$0.10" comment, `packages/test-matrix` selects only the ten realistic scenarios for browser jobs.
  Commits t727: downstream 654e9b1f, Core 4ad4eac2.
- Validation: supervisor reruns in the t727 trees: `node scripts/structure-audit.mjs` -> `passed (213 warning(s),
  635 baselined)`, Core -> `passed (408 warning(s), 1152 baselined)`; `node scripts/check/core-mirror.mjs` -> `1
  mirror set(s) match ... structure-audit (58 files)`; rule and mirror tests -> pass 21 fail 0, Core rule test -> pass
  15 fail 0; planted `apps/extension/src/zz-planted.ts` with a DeepSeek URL -> `FAIL [restricted-references] ...`,
  removed -> passed; `pnpm --filter @fluxiq-web-extension/test-matrix test` -> pass 23 fail 0; domain `check` ->
  current; no remaining reference to either deleted module.
- Suspicions (lane-h-h4.md): core-web-build duplicates Core's `web:build` (needs a Core publication seam first);
  `scripts/lab/core/build/` judges Core staleness by mtime (confirmed; swap to Core's `decideStep`); test-matrix
  synthetic browser selection (confirmed, fixed). Still opening synthetic pages outside lane H's files: the CI
  workflow's scenario-page step and `apps/scenario-lab/e2e` specs.
- Outcome: Accepted (unit); merges with phase 5.
- Follow-up: phase 5; the two remaining suspicions and the synthetic-page specs need owners.

### 2026-10-19 - Lane G unit 1 (offline queue privacy) verified; commit held for unit 2
- Agent: supervisor (lane-g, workers W-A to W-D)
- Changed (t726, uncommitted): Core `client-gateway-websocket` outbox, storage-area, reconcile, host-lease,
  session-pick; the extension queue on Core's outbox in `chrome.storage.session` (`fluxiq.outbox`), the old
  `fluxiq.queuedEvents` discarded at every background start, flushes bound to the session lineage, project and
  recording.
- Validation: supervisor reruns in t726: Core `npx vitest run` in the package -> `Test Files 22 passed, Tests 150
  passed`, `npx tsc --noEmit` -> exit 0; extension `tsc -p tsconfig.json` and `tsconfig.test.json` -> exit 0;
  `EXTENSION_TEST_BUILD_LABEL=sup-g1 node apps/extension/scripts/test-extension.mjs` on gateway-session, host-lease,
  saved-state, storage-queue-discard, outbox -> tests 46 pass 46 fail 0; structure audit -> passed (638 baselined).
- Held: Core's package index already exports unit 2's `connection/`, and `shared/protocol.ts` changed outside the
  unit list, so the listed files alone may not compile; committed with unit 2.
- Follow-up: the session-storage byte risk (~10 MB) sent back to lane G as a fix (byte budget, explicit counted
  loss, write failure degrades instead of throwing).

### 2026-10-19 - Lane G units 1+2a and lane H phase 5 committed on their branches
- Agent: supervisor (lane-g workers W-A to W-G; lane-h workers H5, H6 and the lead)
- Changed: t726 Core 3ccb50b2 (`client-gateway-websocket`: reconnecting connection, outbox with lineage binding,
  count cap, byte budget, closed loss marker and write-failure degradation, reconciliation, lease fencing, one
  session pick) and downstream bca31a06 (queue on Core's outbox in session storage, old queue discarded at start,
  downstream reconciliation, ledgers and domain host-lease replaced by Core's, one web session pick). t727 Core
  f748af1a (build-cache engine and task rules exported; AGENTS.md says downstream imports them) and downstream
  0725def0 (imports them; Core staleness by Core's `decideStep`, not modification times; AGENTS.md names the
  provider guard, mirror check and imported tooling).
- Validation: supervisor reruns. t726: Core package `npx vitest run` -> 27 files, 178 tests passed; `tsc` 0; domain
  and extension `tsc` src and test -> 0; `DOMAIN_TEST_BUILD_LABEL=sup-g2 node domain/scripts/test-domain.mjs client/
  web-sessions host-resources runtime/tests/adapter io/tests/gateway-output-dispatcher llm-evidence/tests/tools` ->
  pass 181 fail 0; extension gateway, outbox, saved-state, in-flight, host-lease, server-command-channel,
  connection-status -> pass 73 fail 0; audits passed. t727: Core `node --test` task, build-cache, structure-audit,
  scripts/tests -> pass 394 fail 0; downstream `node --test` over every `check` glob plus core-scripts -> tests 667,
  pass 666, fail 0; `node scripts/build-cache/prove-inputs.mjs` -> `inputs proved complete for 31 listing(s)`;
  audits passed (634 baselined).
- Merge order (t727): Core first, then the main checkout's and shared Cores, then downstream; every Core that takes
  phase 5 rebuilds its three libraries once.
- Outcome: Accepted (units)
- Follow-up: lane G unit 2b (gateway adapter), Core docs, headed browser spec; lane H's core-web-build seam.

## Open Questions

None requiring user input (the move plan and the tooling policy were approved on 2026-10-19).
