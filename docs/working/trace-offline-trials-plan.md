# Traces And Offline Trials (Extension Side)

Status: Active
Status detail: User approved implementing both this plan and the boundary audit's move plan with subagents (2026-10-19). Lanes G, H, S, T have task branches t726-t729, not yet dispatched; L1 (reset redesign, t724) is still running.
Created: 2026-10-19
Last updated: 2026-10-19
Owner: Senior supervisor agent
Scope: Execution hub for the traces/offline-trials plan and the extension/Core boundary audit's move plan, plus this repository's own part of the trace plan (in-band artifacts, page snapshots, the offline queue fix, the domain's offline read/target resolver). Core owns the trace contract, store, offline-trial runner and build-loop integration.
Paired document: `docs/working/trace-offline-trials-plan.md` in FluxIQ Core (plan of record)
Related: [extension-core-boundary-audit.md](./extension-core-boundary-audit.md) (audit findings and move plan), [breadth-forty-tasks-plan.md](./breadth-forty-tasks-plan.md) (paused breadth round, L1)

---

## Current State

**User's instruction (2026-10-19):** "implement plan & audit changes with subagents. Write everything down regarding
progress. Get it done." Then: hand off first and continue in a new chat. Nothing in the lanes below has started.

**Plans being executed:**
- Traces and offline trials: Core `docs/working/trace-offline-trials-plan.md` (decisions, tiers, phases P0-P7,
  tests, risks), consultant's source beside it.
- Boundary audit move plan: [extension-core-boundary-audit.md](./extension-core-boundary-audit.md) (findings 1-12,
  phases 0-5). The user approved implementation; the tooling recommendation (Core owns build-cache and shared task
  rules, this repository imports them, drift checks on any copy left) is adopted.

**Lanes (paired task branches created, worktrees at `C:/Users/osrs_/FluxStuff/fxwork/t7NN/`, both repos clean):**

| Lane | Branch | Work, in order | Lead |
| --- | --- | --- | --- |
| G gateway | t726 `task/t726-gateway-client-into-core` | Audit P1: offline queue (`fluxiq.queuedEvents`, `background/storage.ts`, `gateway-session.ts`) scoped to its browser session, project and recording; then audit P3: reconnect, heartbeat, queue, reconciliation, lease fencing and one session-picking rule into Core's `client-gateway-websocket` client, the domain keeping only the web adapter | lead-xhigh |
| H guards and tooling | t727 `task/t727-guards-and-tooling` | Audit P0: a structure-audit rule failing on provider hosts/SDKs/key reads downstream; drift checks for every mirror of Core code; delete `packages/agent-orchestrator` and `reusable-evidence-coordinator.ts`; one provider key list; the stale "$0.10" comment; trace the three suspicions (test-matrix synthetic CI browser scenarios, core-web-build, Lab staleness by mtime). Last, audit P5: Core owns the build-cache engine and shared task rules, downstream imports them, keeping `pnpm task` CLI-compatible while other lanes use it | lead |
| S single sources and telemetry | t728 `task/t728-single-sources-telemetry` | Audit P2: Core publishes run accounting and the build lifecycle; the Lab and the domain's build memories read them (no `initial.<toolId>` parsing). Then audit P4: one Core source each for activity headline/pacer/wording, `where`/number reading, dedupe/sort (`order-rows.ts`); generic rules out of `WEB_LLM_SYSTEM_INSTRUCTIONS` into Core's prompt (contract gate tests apply); recording-capture and `requestsEnabled` policy owned by Core; the card-number screen into Core's secret screen. Not `gateway-session.ts`/`storage.ts` (lane G) | lead |
| T traces | t729 `task/t729-traces-offline-trials` | Trace P0: baseline from Lab per-step files (about 25 recent runs: share of build time in trials, resets, exploration, model calls); inventory of every client message Core accepts and everything it reads later; the page-snapshot spike (reload a captured page in a sandboxed browser, scripts and network off, run the extension's extraction and target code; realistic sites only, headed, provider-free). Then P1 contract and environment port; P1's evidence-loop/executor edits wait for L1 to merge | lead-xhigh |
| L1 reset redesign | t724 `task/t724-reset-settlement-redesign` | Running at handoff, uncommitted (Core 52 files, downstream 34). Report `fxwork/t724/!FluxIQWebExtension/docs/working/breadth-forty-tasks-plan/reports/l1-reset-settlement.md` and sub-reports `l1-c1`..`l1-d2`; C1-C3, C5, C6, D1, D2 reported; C4 (reset words) and D3 (installed-gateway browser proof) remained | lead-xhigh (running) |

**Lane rules for every brief:** follow both AGENTS.md files (structure, one export per file, barrels, tests in
`tests/` beside the subject, budgets, never extract-and-drop); tests first; narrow checks only (tests beside the
change, touched packages' typechecks, both structure audits; Core's `pnpm task finish` also runs the prompt contract
tests); no paid or live Lab runs (the supervisor runs those, supervised, $0.25 via both
`FLUXIQ_LLM_RUN_COST_CEILING_USD` and `--llm-max-cost-usd`); browser tests only on the ten realistic scenarios,
headed, provider-free; model guidance never mirrors a realistic task; no commits by leads or workers; each lead keeps a
running progress log in its own report `docs/working/<this-doc or audit-doc>/reports/<lane>.md` in its downstream
worktree.

**Conflict map:** G owns the extension background gateway files and Core's socket client; S must avoid them. T's
evidence-loop and executor work waits for L1 (both touch `llm/evidence-loop.ts`). H's tooling change lands last. L1
and S both touch Core prompt-adjacent text only through their own files; the contract gate catches pin drift.

**Next, in order:**
1. `/resume trace-offline-trials-plan`.
2. Check L1: if its final report says Done, verify (rerun its tests), commit by explicit paths on t724, merge `dev`
   in, narrow checks, `pnpm task finish t724` downstream then in Core, push. If it is still running or stopped
   mid-way, read its report and sub-reports and continue it with a lead resumed from the report.
3. Write the four lane briefs (at most 40 lines each, from the table above) under "Worker Briefs" here and in the
   audit document, then dispatch G, H, S, T in parallel.
4. Verify and commit each lane's units as they land; record every check in the ledgers here, in the audit
   document and in Core's plan.
5. When L1 and the reset rules are on `dev`: rerun the breadth round's four repaired tasks (office checkout, job
   save, photo newest likes, social group posts) on fresh workspaces, supervised.

**This repository's part of the trace plan (unchanged):** P0 prerequisites (audit P0 and P1, lanes H and G); the
page-snapshot spike (lane T); P2 extension lane after Core's P1 contract (in-band artifacts, page snapshots in
tracing mode, Chrome and Edge first, tracing on for every Lab live run); P5 the domain's offline resolver.

**Rules that carry over:** traces never feed model guidance; no recorded page data, tokens or typed secrets in
logs, reports or commits; Core's secret screening runs before a trace is stored; offline trials only in the test and
repair phases, never during exploration; the final judged whole run stays live with a site reset.

**Blocked:** nothing needs the user.

## Worker Briefs

None dispatched yet; write them from the lane table before dispatch.

## Work Ledger

### 2026-10-19 - Paired plan filed
- Agent: supervisor
- Changed: this document (Core plan of record filed in the same unit)
- Why: the user approved the revised traces and offline trials plan.
- Validation: not validated; planning only.
- Outcome: Accepted (planning)
- Follow-up: P0.

### 2026-10-19 - Execution approved; lanes created; handoff
- Agent: supervisor
- Changed: this document (now the execution hub); `extension-core-boundary-audit.md`, Core
  `trace-offline-trials-plan.md` and `breadth-forty-tasks-plan.md` Current State
- Why: the user asked to implement both plans with subagents, then to hand off before starting.
- Validation: `pnpm task start <slug> --worktree --core` x4 -> `"id":"t726","branch":"task/t726-gateway-client-into-core"`,
  `t727 guards-and-tooling`, `t728 single-sources-telemetry`, `t729 traces-offline-trials`; `git status --short` in
  each of the eight worktrees -> 0 lines. t724 (L1) -> Core 52 and downstream 34 uncommitted files, lead still running.
- Outcome: Partial (nothing implemented yet)
- Follow-up: the "Next, in order" list above.

## Open Questions

None requiring user input.
