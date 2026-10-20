# Traces And Offline Trials (Extension Side)

Status: Active
Status detail: User approved implementing both this plan and the boundary audit's move plan with subagents (2026-10-19). Lanes G, H, S, T (t726-t729) dispatched 2026-10-19; L1 (reset redesign, t724) is still running.
Created: 2026-10-19
Last updated: 2026-10-19
Owner: Senior supervisor agent
Scope: Execution hub for the traces/offline-trials plan and the extension/Core boundary audit's move plan, plus this repository's own part of the trace plan (in-band artifacts, page snapshots, the offline queue fix, the domain's offline read/target resolver). Core owns the trace contract, store, offline-trial runner and build-loop integration.
Paired document: `docs/working/trace-offline-trials-plan.md` in FluxIQ Core (plan of record)
Related: [extension-core-boundary-audit.md](./extension-core-boundary-audit.md) (audit findings and move plan), [breadth-forty-tasks-plan.md](./breadth-forty-tasks-plan.md) (paused breadth round, L1)

---

## Current State

**User's instruction (2026-10-19):** "implement plan & audit changes with subagents. Write everything down regarding
progress. Get it done." Then: hand off first and continue in a new chat.

**Dispatched 2026-10-19 16:25:** lanes G, H, S and T running (briefs under "Worker Briefs"), each branch fast-forwarded
to `dev` first. L1 still running (C4 reset-words report landed; D3 installed-gateway proof remained). Core paired
document for the boundary moves: Core `docs/working/extension-boundary-moves.md`.

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

Dispatched 2026-10-19 (lanes G, H, S implement the boundary audit's phases; lane T the Core plan's P0-P1). L1 (t724)
was still running at dispatch and is excluded below by its own file list.

**Shared lane rules (every brief).**
- Work only in your lane's two worktrees, `C:/Users/osrs_/FluxStuff/fxwork/<tNNN>/!FluxIQWebExtension` and
  `.../<tNNN>/!FluxIQ`, both on `task/<tNNN>-<slug>`. Never edit the main checkouts or another lane's tree.
- Follow both repositories' AGENTS.md (structure, one export per file, barrels, tests in `tests/` beside the subject,
  budgets, never extract-and-drop: callers switch in the same unit). Core code downstream consumes is rebuilt in your
  Core worktree before downstream uses it.
- Tests first. Narrow checks only: tests beside each change, touched packages' typechecks, both structure audits, and
  Core's prompt contract tests when model-facing text changes. No full suites.
- No paid or live Lab runs. Browser tests only on the ten realistic scenarios, headed, provider-free.
- Model guidance never mirrors a realistic task, site, product or answer.
- No commits, merges or pushes. Do not edit `docs/working/README.md` or any plan's Current State or ledger; the
  supervisor owns them and the Core paired documents.
- Never put pairing tokens, keys, recorded page data or typed values in logs, reports or tests.
- Must not touch any file in L1's list: `git -C C:/Users/osrs_/FluxStuff/fxwork/t724/<repo> status --short` (Core
  site-reset, candidate, candidate-trial, evidence-loop, repeat policy, action-permissions, project-agents dispatch;
  downstream control-spot, start-state, state-diff places, llm-evidence elements, dom-snapshot, read-coverage). If you
  must, stop and report.
- Progress log: append a dated entry to your report after each unit: what changed, the check command and its observed
  output. End a commit-sized unit with `UNIT READY: <files>` so the supervisor can commit it while you continue.
- Dispatch workers (`worker-low`, `worker`, `worker-high`) partitioned by file, in the foreground when you need the
  result, and verify every worker claim yourself.
- Final message: the return contract (at most 12 lines: Outcome, Changed, Validation, Not verified, Report, Notes).

### Brief: lane-g (lead-xhigh, t726 gateway-client-into-core)
- Task 1, audit phase 1 (finding 2): the offline event queue (`fluxiq.queuedEvents`, `background/storage.ts`;
  `send`/`flushQueue` in `background/gateway-session.ts`) lives for one browser session only (session storage, Firefox
  parity), each entry tagged with its gateway session, project and recording; a flush delivers only matching entries,
  in order, and drops the rest; any queue left in persistent storage is discarded on upgrade; the cap stays.
- Task 2, audit phase 3 (finding 1): Core's `client-gateway-websocket` client gains reconnect with backoff,
  heartbeat, the queue semantics above, command reconciliation, lease epoch fencing (`domain/src/client/host-lease.ts`)
  and one session-picking rule replacing the three; the domain keeps only the web adapter. Core tests use a fake
  socket, no browser concept. Wire changes stay synchronized across protocol types, background routing, domain
  mappings, capabilities, tests and `docs/architecture/`.
- Required reads: audit findings 1-2; reports `extension-core-boundary-audit/reports/a2-persistence.md`,
  `a3-framework-logic.md`; the files named.
- Owns: `apps/extension/src/background/` gateway, session and storage modules; `domain/src/client/**`; Core's
  `client-gateway-websocket` package and its exports; tests beside each; the gateway architecture docs.
- Must not touch: lane S's areas (Core prompt, run accounting, activity, record-sets, secret screen), `scripts/**`.
- Done: both units ready; the built extension exercised headed against a provider-free realistic scenario (connect,
  drop, reconnect, queue flush, lease takeover) with what was and was not exercised stated.
- Report: `docs/working/extension-core-boundary-audit/reports/lane-g.md` (downstream t726 tree).

### Brief: lane-h (lead, t727 guards-and-tooling)
- Task 1, audit phase 0, first: (a) a structure-audit rule that fails on provider hosts, provider SDK imports and
  provider key reads anywhere downstream outside an explicit allowlist of the Lab's Core-driving code (finding 12);
  if the mirrored engine needs a new rule kind, change Core's `scripts/structure-audit*` first, then mirror;
  (b) a check in `pnpm check` that fails when any remaining mirror of Core code differs from Core's copy (structure
  audit first); (c) delete `packages/agent-orchestrator` and `reusable-evidence-coordinator.ts` after proving no
  caller; (d) one provider key list (`scripts/provider-secret-environment.mjs`, `packages/test-runner/src/environment.ts`)
  and the stale "$0.10" comment in `packages/test-contracts/src/llm.ts`; (e) trace the three "To verify" suspicions,
  fixing any confirmed violation in your files or reporting it with evidence. Mark phase 0 `UNIT READY`, continue.
- Task 2, audit phase 5, last (finding 5): Core owns the build-cache engine and the shared task rules (id allocation,
  refs, branch naming, git runner) as importable modules, with Core's later build-cache fixes (output replay,
  git-visible fingerprinting); downstream `scripts/build-cache` and `scripts/task` import them and keep only
  repository config; the drift check covers any copy left. `pnpm task start|finish|abandon|prune` stays
  CLI-compatible (flags, ids, branch names, JSON output): other lanes use it concurrently. Exercise it only through
  its tests or a throwaway task, never on t724-t729.
- Required reads: audit findings 5, 9-12 and "To verify"; reports `a1-model-calls.md`, `a4-packages-scripts.md`.
- Owns: `scripts/structure-audit/config.mjs`, new check scripts, `scripts/build-cache/**`, `scripts/task/**`,
  `scripts/provider-secret-environment.mjs`, `packages/agent-orchestrator/**`, `packages/test-runner/src/environment.ts`,
  `packages/test-contracts/src/llm.ts`, `packages/test-matrix/**`, root workspace files and lockfile; Core
  `scripts/structure-audit*`, `scripts/build-cache/**`, `scripts/task/**` and their exports.
- Must not touch: `packages/test-runner/src/live-llm/**` (lane S); lanes G and S areas.
- Done: the provider rule fails on a planted provider URL and passes on the tree; the drift check fails on a planted
  one-byte difference; both units ready.
- Report: `docs/working/extension-core-boundary-audit/reports/lane-h.md` (downstream t727 tree).

### Brief: lane-s (lead, t728 single-sources-telemetry)
- Task 1, audit phase 2 (findings 6, 8): Core publishes run accounting (total spend, missing ledger calls,
  consequences on failed builds, empty-balance errors) and the build lifecycle through its existing API and events;
  `packages/test-runner/src/live-llm/*` reads them and drops its reconstruction; the domain's build memories and
  `cleared-way-outs` key off the published lifecycle (no `initial.<toolId>` parsing), durable state in Core.
- Task 2, audit phase 4 (findings 3, 4, 7, 9): one Core source each for the activity headline, pacer and wording;
  `where` and number reading (drop the parity test once single); dedupe and sort (`content/extraction/order-rows.ts`,
  bundle-safe for the content script). Generic rules out of `WEB_LLM_SYSTEM_INSTRUCTIONS` (recordings versus
  instructions, permissions, loop grammar, the cost line) into Core's prompt, the domain keeping web-only wording, the
  contract pins updated deliberately. Recording-capture switches and `requestsEnabled` policy owned by Core, the
  extension enforcing what Core says. The card-number screen into Core's secret screen; Core's activity reads the
  repeated-answer marker's reason from its constant.
- Required reads: audit findings 3, 4, 6-9; reports `a1-model-calls.md`, `a2-persistence.md`, `a3-framework-logic.md`.
- Owns: the modules those findings name in both repositories and their tests; the affected architecture docs.
- Must not touch: `background/gateway-session.ts`, `background/storage.ts`, `domain/src/client/**`, Core's gateway
  client (lane G); `scripts/**`, `reusable-evidence-coordinator.ts`, `packages/test-runner/src/environment.ts` (lane H).
- Done: both units ready; extension build passes for the content-script import; the chat's activity headline checked
  headed on a provider-free realistic scenario.
- Report: `docs/working/extension-core-boundary-audit/reports/lane-s.md` (downstream t728 tree).

### Brief: lane-t (lead-xhigh, t729 traces-offline-trials)
- Plan of record: Core `docs/working/trace-offline-trials-plan.md` (read it whole) and the consultant source beside
  it for test ids T01-T24.
- Task 1, P0, in parallel: (a) baseline from the Lab's per-step run files (`steps/NNNN-*/`, about 25 recent live runs
  in `test-runs/` of the main checkout and lane slots, read-only): share of build wall time in live trials, resets,
  exploration and model calls, per run and overall, computed by a Lab script with tests; (b) inventory of every
  client message type Core's client gateway accepts, what it carries, everything Core dereferences later, and any
  read bypassing the gateway, ending in a proposed capture-boundary decision; (c) the page-snapshot spike: capture
  pages in a provider-free run (compare page capture/MHTML with DOM serialization), reload each in a sandboxed headed
  browser with scripts and network off, run the extension's own extraction and target code, and measure agreement
  with the live result on at least three realistic sites, with snapshot sizes and what did not survive. Spike code
  stays in Lab or test infrastructure.
- Task 2, P1 (Core): trace manifest, event envelope and completeness status; the result contract; one environment
  port; a non-browser fixture adapter in unit tests proving no web field. Wiring the port into the executor and
  `llm/evidence-loop.ts` waits for L1: if `git -C C:/Users/osrs_/FluxStuff/!FluxIQ log dev --oneline` has no
  "Merge task t724", stop there and report Partial with the remaining wiring listed; the supervisor merges `dev` into
  your branches and resumes you.
- Owns: new Core trace modules (placed per Core's code structure) and tests; the downstream Lab baseline script and
  spike under `packages/test-runner/` or `scripts/lab/`, with tests.
- Must not touch: lanes G, S, H areas; L1's files until resumed after its merge.
- Report: `docs/working/trace-offline-trials-plan/reports/lane-t.md` (downstream t729 tree).

### Brief: t730-realistic-specs (lead, t730 realistic-only-browser-specs)
- Why: lane H's tracing (`lane-h-h4.md`) found browser runs on synthetic pages, which AGENTS.md forbids ("Lab and
  browser test runs use only the ten realistic scenarios", Playwright specs and the extension's content harness
  included): 19 of `apps/scenario-lab/e2e/*.spec.ts` (all but local-classifieds and social-network-feed), the
  workflow's scenario-page step, and any `apps/extension/e2e` spec that opens a synthetic page.
- Task: for each such spec, name the capability it proves, then retarget it to a realistic scenario that exercises
  the same capability, or delete it where a realistic spec already proves it, or move browser-free logic to a unit
  test; never drop coverage silently (a table spec -> capability -> disposition -> new home in the report). Make the
  Playwright fixtures refuse a non-realistic scenario id the way the Lab's launch entries do, with a test, so the rule
  holds mechanically. Synthetic scenario packages stay for unit tests that never open a browser.
- Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t730-realistic-only-browser-specs` (shared Core, read-only).
- Owns: `apps/scenario-lab/e2e/**`, `apps/extension/e2e/**` except `content/tests/snapshot-fidelity/**` (lane T)
  and `reconnect.spec.ts` (lane G), `.github/workflows/testing-facility.yml`, `apps/scenario-lab/package.json`,
  new unit tests beside their subjects; `scenarios/**` only for realistic-scenario test hooks a spec needs.
- Must not touch: lane files (G, H, S, T, L1 lists above), `packages/test-matrix/**` (lane H, done).
- Validation: run every rewritten or retargeted spec headed, provider-free, and record the command and pass counts;
  the fixture refusal test; structure audit; the scenario-lab and extension typechecks.
- Shared lane rules apply. Report: `docs/working/trace-offline-trials-plan/reports/t730-realistic-specs.md` in the
  t730 tree, as a running log with `UNIT READY` markers.

### Brief: t731-sweep-fixes (lead, t731 sweep-1019b-fixes)
- Why: sweep-1019b (`reports/sweep-1019b.md`) left 10 Core fluxiq failures, all timeouts or EBUSY, and one
  scenario-lab browser failure. Full suites are fixed forward; "machine load" is not a cause until proven.
- Task: rerun each failing file alone in the t731 trees; for each, find the root cause and fix the side that is wrong
  (a test that does slow real I/O it need not do, a writer admission that waits on a lock never released, a SQLite
  handle left open before an unlink on Windows), never by raising a timeout or loosening an assertion. If a file
  passes alone, find what it contends on when run with its package (shared temp paths, ports, a global) and remove
  the contention. Core files (under `packages/fluxiq/src/programs/`): `runtime/service/flows/tests/creation.test.ts`,
  `runtime/tests/service-adaptation/tests/promotion-tier.test.ts`, `runtime/tests/service-flows/tests/cancel-parked-run.test.ts`,
  `storage/canonical-authority/tests/whole-operation.test.ts` (also failed in S1), `.../whole-sql.test.ts`,
  `testing/tests/scale-graph-store.test.ts` (EBUSY), `database-manager/tests/index.test.ts`. Downstream:
  `scenarios/crossborder-marketplace/tests/browser-paths.test.ts`, step traffic-check (`waitForState`, 6000 ms).
  Then run the downstream packages that `pnpm test` did not reach after scenario-lab and fix what fails there.
- Worktrees: `C:/Users/osrs_/FluxStuff/fxwork/t731/!FluxIQWebExtension` and `.../t731/!FluxIQ`.
- Owns: those test files and the source modules their root causes lead to; `scenarios/crossborder-marketplace/**`.
- Must not touch: lane files (G, H, S, T, t730 and L1 lists above); if a root cause lands in one, stop and report.
- Validation: each fixed file run alone and then with its package directory, three times, pass counts recorded.
- Shared lane rules apply. Report: `docs/working/trace-offline-trials-plan/reports/t731-sweep-fixes.md` in the t731
  downstream tree, running log with `UNIT READY` markers.

### Brief: sweep-1019b (worker-low, second daily full sweep of `dev`)
- Detached worktrees of both repositories at `origin/dev` (downstream cedd46af, Core 4077d0a0) under
  `C:/Users/osrs_/FluxStuff/fxwork/sweep-1019b/` (Core sibling to the downstream checkout); `pnpm install` both;
  Core `pnpm build`, `pnpm check`, `pnpm test`; downstream `pnpm check`, `pnpm test`, `pnpm build`.
- Record each command, exit code, totals and the names of failing tests, compared with sweep S1
  (`breadth-forty-tasks-plan/reports/sweep-1019.md`), in `docs/working/trace-offline-trials-plan/reports/sweep-1019b.md`
  (main checkout). No fixes, commits, browser or live runs; never touch the lane worktrees.

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

### 2026-10-19 - Lanes G, H, S, T dispatched
- Agent: supervisor
- Changed: this document (Worker Briefs); Core `docs/working/extension-boundary-moves.md` (new paired document)
- Why: execute both plans; L1 still running, and none of the four lanes touches its files.
- Validation: `git merge --ff-only dev` in all eight lane worktrees -> each fast-forwarded (4 files downstream, 2 in
  Core); `git -C fxwork/t724/<repo> status --short` -> Core 52 files (site-reset, candidate, evidence-loop, repeat
  policy, action-permissions, dispatch), downstream 35 (control-spot, start-state, state-diff places, dom-snapshot,
  read-coverage), none in any lane's owned area.
- Outcome: Partial (lanes running)
- Follow-up: commit each `UNIT READY` as it lands; finish L1.

### 2026-10-19 - Lane T units U1 (baseline) and U5 (result contract) committed on t729
- Agent: supervisor (lane-t and its workers)
- Changed: downstream `packages/test-runner/src/build-time/**` (132a0ebb); Core
  `model/offline-trial/**` and one `model/index.ts` export (4d9a6b4c).
- Baseline (25 newest runs with steps, 219.8 build minutes, 129 trials), time-weighted: live trials 49.8%, model calls
  24.3%, exploration 22.3%, site resets 0.6% (a lower bound: resets inside trials emit no span), other 3.0%. Social
  run-mvfq957o-40103539: 20.50 of 25.05 minutes in 7 trials, longest 336.8 s.
- Validation: supervisor reruns in t729: `pnpm --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json`
  -> exit 0; `node --test packages/test-runner/dist/build-time/tests/*.test.js` -> tests 8 pass 8 fail 0; `node
  packages/test-runner/dist/build-time/cli.js --limit 25` -> the category table, no unknown kinds; Core `pnpm exec
  vitest run src/programs/automation-studio/model/offline-trial` -> `Test Files 5 passed, Tests 47 passed`; Core
  structure audit -> passed (1152 baselined). Downstream audit -> 1 violation, in the uncommitted snapshot-fidelity
  spike (`statement-packing`, probe.spec.ts line 18), not in either unit.
- Outcome: Accepted (units)
- Follow-up: Core should emit a reset span inside `core.test_subflow`/`core.test_candidate`; the spike's packing fix.

### 2026-10-19 - Second daily sweep (sweep-1019b)
- Agent: supervisor (worker sweep-1019b)
- Changed: `trace-offline-trials-plan/reports/sweep-1019b.md`; worktrees `fxwork/sweep-1019b/` (Core 4077d0a0,
  downstream cedd46af)
- Why: the second allowed full sweep of the day, after t722, t723 and t725 merged.
- Validation: worker's runs (not rerun by the supervisor): Core `pnpm build` 0, `pnpm check` 0, `pnpm test` 1
  (fluxiq 10 failed / 12852 passed in 7 files, every one `Test timed out in 15000ms`, a hook timeout or `EBUSY ...
  project.sqlite-shm`; apps/web 3123/3123; contracts 178/178); downstream `pnpm check` 0, `pnpm build` 0, `pnpm test`
  1 (domain 2177/2177, extension 3271/3271, scenario-lab 873/874: crossborder-marketplace `browser-paths.test.ts`
  step traffic-check `waitForState` 6000 ms timeout; packages after scenario-lab not reached). Against S1: Core's 56
  apps/web and 27 of 29 fluxiq failures, the TS7006 errors and the domain adapter failure are gone; whole-operation's
  2 timeouts remain; 8 Core timeouts/EBUSY and the scenario-lab failure are new.
- Outcome: Partial (fix forward)
- Follow-up: brief sweep-1019b-fixes.

### 2026-10-19 - Machine out of commit memory; OneDrive restarted with the user's approval
- Agent: supervisor (found by lane G while tracing its spec flakes)
- Changed: nothing in either repository; OneDrive restarted (`OneDrive.exe /shutdown`, then `/background`).
- Why: OneDrive.Sync.Service (started 14:34) held 14,451 MB private memory on a 12,220 MB machine; Playwright
  workers died with "Fatal process out of memory: Zone", a run exited 127, a page rendered blank. Every browser and
  test result between about 14:34 and 19:50 may be affected, the 17:00 sweep included.
- Validation: `Get-CimInstance Win32_OperatingSystem` -> free commit 3,192 MB before, 14,599 MB after; `Get-Process`
  -> OneDrive 28 MB after restart. A monitor alerts if the sync service passes 4 GB or free commit drops under 4 GB.
- Outcome: Accepted (environment)
- Follow-up: lanes G, L1, T, t730 and t731 told to rerun pre-19:50 failures before acting on them.

### 2026-10-19 - Lane G unit 2b held: headed specs flaky
- Agent: supervisor
- Changed: nothing committed; lane G resumed.
- Validation: supervisor reruns in t726: Core package vitest -> 27 files, 179 tests passed, `tsc` 0; extension `tsc`
  src and test 0; `EXTENSION_TEST_BUILD_LABEL=sup-g3 node apps/extension/scripts/test-extension.mjs
  background/connection` -> pass 313 fail 0; headed `npx playwright test -c e2e/playwright.config.ts e2e/gateway-session
  e2e/reconnect.spec.ts [lease/tests/stale-holder.spec.ts]` four times -> 3/2, all pass, 4/0, 3/1 (queue-across-
  reconnects, worker-restart reconnect, saved-settings reconnect), all before the memory fix.
- Recording start marker (g-recording-start-marker.md): by design; it crosses as a `client.state_update`
  (`browser.tab`, `recordingState: started`) and Core needs no marker; the new spec will assert that.
- Outcome: Partial
- Follow-up: lane G reruns on the recovered machine, compares with pre-G sweep-1019b, fixes any race, five green runs.

## Open Questions

None requiring user input.
