# Other working-document history reconciliation

Status: Complete (bounded read-only audit)
Date: 2026-10-03
Owner: other-history worker
Scope: Remaining downstream working documents outside the live-history and UI-review assignments.

## Outcome

Claude's most recent engineering direction belongs to the language-driven live loop, not the older extraction, Week 1/2, conversations, facility, and governance documents whose headers still say Active. Most of those documents record delivered foundations and historical acceptance rather than new work to execute. Their remaining recommendations need reconciliation with integrated dev before becoming briefs.

All five September 30 Codex tasks have integrated task boundaries in dev history despite their parent document saying none started. Recorded extraction and conversation foundations also have stronger delivered evidence in nested reports than their parent Current States acknowledge. The important remaining obligations in this slice are integrated browser proof, browser compatibility, selected deployment/CI setup, protected user-data adoption, and documentation truth.

No product change, browser session, panel management, test, build, provider call, private run artifact, or Core mutation was performed by this worker.

## Coverage and limits

The assigned nested tree contains **823 Markdown files, 222,173 split lines, 13,455,858 bytes**. Every assigned file was opened completely as UTF-8 and every line scanned for headings, status/outcome, validation, unresolved work, follow-up, and supersession markers. Selected outcome and unresolved-work sections were surfaced and read. This is full-file programmatic coverage, **not a claim of close-reading every historical sentence**. An early oversized output was truncated; the final complete scan below succeeded without truncation or parsing errors. An earlier summary probe had substring errors; those were corrected in the final scan and did not modify files.

| Nested parent | Files | Lines scanned | Interpretation |
| --- | ---: | ---: | --- |
| agent-git-workflow-plan | 9 | 2,859 | Task isolation/provenance foundations; paired Core tooling report supersedes old missing-half claim |
| agent-token-efficiency-plan | 4 | 633 | Hooks, templates, working-doc audit delivered; metrics follow-up is operational |
| agent-working-doc-protocol | 3 | 453 | Earlier header/current-state reconciliation reports; useful evidence of pre-existing stale prose |
| automated-testing-facility-plan | 36 | 8,329 | Facility audits, network guard, packaging, build/startup caching and test-speed reports |
| first-class-data-extraction-plan | 49 | 14,815 | X0-X5 delivery, picker, datasets, privacy and live saved-scrape/restart proof |
| fluxiq-conversations-plan | 8 | 3,771 | Core thread/API/UI, parking/resume, integrated loop and live delivery |
| lab-port-allocation-plan | 1 | 86 | Explicit-port preflight delivered |
| live-activity-chat-plan | 31 | 4,413 | Activity/overlay/chat built, six iteration rounds, limited live proof |
| manual-panel-test-findings | 27 | 7,331 | Panel/extension UX, policy, settings, privacy and relay fixes |
| module-size-governance-plan | 5 | 1,333 | Splits delivered; source-text test hazards and historical validation gaps |
| mvp-week1-web-automation-reliability-plan | 431 | 123,294 | Completed reliability campaign, historical diagnostics and acceptance |
| mvp-week2-automation-loop-plan | 212 | 54,032 | Earlier three-entry-point loop build/fix history; superseded by live loop |
| repository-state-audit | 7 | 824 | Pre-Week1-closeout audit/remediation and paired verification |
| **Total** | **823** | **222,173** | **All assigned nested Markdown files scanned** |

Seventeen remaining top-level documents were likewise completely loaded and programmatically scanned. Current State and selected phase/decision/open-question sections were read across them. The six top-level documents read in full without output truncation were `manual-panel-test-findings.md`, `codex-tasks-2026-09-30.md`, `module-size-governance-plan.md`, `lab-port-allocation-plan.md`, `action-visual-entity-target-plan.md`, and `extension-ui-rebuild-plan.md`. Other parent outputs were partially truncated; they must not be represented as complete literal reads. Root owns README/protocol, the six live parents, and UI review.

The 17 parents are the six named above plus `agent-git-workflow-plan.md`, `agent-token-efficiency-plan.md`, `automated-testing-facility-plan.md`, `extension-runtime-capabilities-plan.md`, `first-class-data-extraction-plan.md`, `fluxiq-conversations-plan.md`, `live-activity-chat-plan.md`, `llm-production-automation-plan.md`, `mvp-week1-web-automation-reliability-plan.md`, `mvp-week2-automation-loop-plan.md`, and `repository-state-audit.md`.

## Delivered versus stale parent claims

### Five Codex tasks

`codex-tasks-2026-09-30.md` still says none assigned or started. Read-only first-parent history establishes integrated task boundaries:

- `7183ec56`, t216: preserve cleared-check facts on refused browser actions.
- `06e462d4`, t217: verify whole-build traces in the Lab reader.
- `aef6ceae`, t219: rename automation relays and open the selected Flow in FluxIQ.
- `6d81d15d`, t220: record completed supervisor verification for Lab bookkeeping.
- `eb1b565e`, t221: finalize all five Codex tasks for Claude integration.

Do not assign those original five tasks again. Confirm any genuinely unfinished subcase against the corresponding reports/source. The older shared rules saying Labs are stopped and specifying old owned tasks are historical dispatch constraints, not a new blanket stop on current round 1003.

### Extraction

`first-class-data-extraction-plan.md` contradicts itself: its September 20 update says picker/recording complete and t032 initial/full-restart replay passed, while older paragraphs still call the picker in progress and X5.3/X5.5-X5.7 not done.

Nested delivered evidence:

- `reports/x4b-content-picker.md`, `x4c-background-control.md`, `x4d-picker-ui.md`, `x4e-picker-integration.md`: picker, background state/confirm, field handling UI, control gates and integration.
- `reports/x5-3-intent-seam.md`: intent translator and driver within its bounded ownership; remaining owner wiring covered by x4c and the later measurement reports.
- `reports/x5-5-flow-lane-judging.md`: Core persisted datasets are read and judged, with counts-only measurements in evaluation.
- `reports/x5-6-7-bench-and-docs.md`: pooled extraction aggregation, Markdown and comparison metrics already delivered alongside X5.5.
- `reports/x5f-pooled-rate.md`: count-only reads no longer contribute fictitious matched values to pooled accuracy.
- `reports/x5-8-recording-lane-measurements.md`: real product-catalog paginated-extraction measurement produced.
- `reports/w2-integrated-extraction-ui-smoke.md`: t032 fresh production UI initial and full-restart replay each produced one successful extraction, one dataset, eight rows, seven fields, eight rendered rows and nonempty CSV/JSON, zero provider calls; stable identities survived.
- `reports/w2-runtime-debug-refresh-live.md`: t030 reproduced and fixed missing same-view refresh.

X6 repair obligations and Week 3 encryption/field-editor work are broader roadmap concerns; current live-loop runtime/extraction fixes may already satisfy portions. The excluded-column durable withholding requirement is decided, not a question to ask again. See D12 in the parent and t182 privacy reports below. Do not claim model authoring is proven by provider-free recorded extraction.

### Conversations and activity

`fluxiq-conversations-plan.md` Current State remains at discovery/dispatch. Its own nested evidence goes much further:

- `reports/conv-store-and-api.md`: append-only subject threads, once-only asks, SQLite migration 0021, change feed and APIs.
- `reports/conv-parking-and-resume.md`: approval parks and resumes on approved/rejected/timeout routes without reexecuting the stopped node.
- `reports/conv-integration.md`: answer-ask endpoint closes the integrated continuation loop.
- `reports/conv-chat-window-live.md`: usable overlay/launcher and server-originated asks reach collapsed/background UI in measured 2–5 seconds.

`live-activity-chat-plan.md` P1-P3 are delivered, P4 integrated browser proof remains its explicit gap. The t191 reports show the later product design replacing the original folded stream and Simple Mode:

- r2 stable controls, database lease fix and asks reachability.
- r3 each explained decision/repair/check becomes its own message; recent units stay whole.
- r4 Core-owned icon/action cards shared by both chats.
- r5 explicit resolved ask events, rather than guessing a completed wait.
- r6 cleared robot-check waits and cancelled parked asks.

Earlier gaps in those worker reports are often subsequently closed by later rounds/t216/t217. Do not copy every report's Open Questions into a new backlog. Real-Core plus real-extension end-to-end proof is still distinct from the t191 fake-gateway/scripted-Core screenshots, unit tests, and component checks. The parent memory-floor/one-slot language is superseded by current AGENTS four independent live lanes and its rejection of machine-load excuses.

### Manual findings and hardening

`manual-panel-test-findings.md` is an intake/history, not a current host-health assertion. Its September 20 `127.0.0.1:3000` description does not establish today's process state.

| Finding | Reconciled state |
| --- | --- |
| PANEL-001 login 500 | Historical closed importer-root launch fix |
| PANEL-002 layout v2 | Offline adoption implementation delivered; applying it to preserved user root remains a protected operational step, with explicit stop/backup/adoption/hash/restart authorization |
| PANEL-003 autofill | Focused isolated positive/negative proof recorded; saved-password user browser-profile retest still matters |
| PANEL-004 chat cannot operate panel | Registry/capability work in chat-operates-panel and t173 capability reports; parent Assigned state is stale; reconcile current capability coverage before adding work |
| PANEL-005 defaults/settings | permission-defaults and settings-ui-broken reports describe delivered policy/default and round-trip fixes; latest live consequence rules take precedence |
| PANEL-006 panel clunk | WS-A/B/C/D implemented first-run, vocabulary, authorization and shell improvements; later Codex t224 owns further audit/iteration |
| PANEL-007 extension | Four workstreams integrated with extension checks, 990 unit tests and 13 browser e2e tests recorded; real pairing/chat/Stop and Firefox 600px popup were explicitly not exercised then |

`reports/t182-hardening-privacy.md` adds reconnect/pairing persistence, at-rest/privacy/diagnostics and paired-client relays. `t182-w1-core-withholding.md` addresses echoed results and copied input withholding. `t182-w2-lab-extension-storage-scope.md` scans profile storage but states best-effort limits. `t182-w3-core-paired-relays.md` adds scoped paired-client endpoints and documents required facade wiring. These delivered changes contradict older repository-audit privacy gaps and the facility's cancellation-404 claim; verify present behavior before treating an old report as an open defect.

### Week 1, Week 2 and older LLM roadmap

- Week 1 is Complete. September 15 production-Core A/B accepted pair: each 189 evaluated + 12 skipped, 180 passed + 9 ruled-out failures, no startup/facility failure; comparator 0 differing results/runs and 23/23 comparable metrics. This supersedes older pre-closeout audit claims that Stage 4 had not run. Old campaign artifacts are not fresh evidence.
- Week 2 parent September 20 describes built parts still being live repaired and third entry point not started. Later `week2-exit-plan`, defensive runtime, general authoring and language-driven loop supersede its old priority queue and t027 setup.
- `llm-production-automation-plan.md` is a September 8–10 foundation and reusable-context roadmap. Its 12 KB/40-element evidence cap, four-call grant, $1 envelope, selector details and old immediate next steps conflict with the later page-view/purse/live-loop rules. Never use them as today's constraints.
- The runtime-capabilities six phases, action visual target and extension UI rebuild are Complete foundations. Optional read_state/run_flow protocol proposals are not prerequisites for the currently host-owned deterministic runtime.

## Facility and operational backlog, after reconciliation

The September 28 facility audit is useful but its individual defects need classification:

1. **External CI configuration:** missing Core repository/ref/token settings meant jobs never passed prerequisite setup. Later packaging workflow may change workflow mechanics, not prove settings were supplied. External settings status remains unverified in this audit.
2. **Core build precondition:** delivered in `reports/core-built-precondition.md`; do not relist as pending. Nightly runtime estimate was updated there.
3. **Network guard and launcher coverage:** delivered in `reports/demo-lane-network-guard.md`, with real service-worker interception and canary proof. Playwright 1.51.1 service-worker WebSocket enforcement limitation remains a stated limitation, not a new claim of total network isolation.
4. **Extension e2e freshness:** present package.json `test:e2e` builds extension before Playwright, so the old stale-artifact criticism is no longer current. It still does not itself prove Linux CI ran.
5. **Browser parity:** current source produces Firefox package checks; loading/testing native Firefox popup and stable Chrome/Edge remains separate certification. Old installed-revision mismatch may have changed; inspect environment when scheduling.
6. **Existing/clone:** older audit found zero live runs for these topologies; current primary live lanes are isolated. External installation/clone certification is separate from current MVP live-loop completion, needs a designated target, and must preserve user data.
7. **Core promotion:** facility remains downstream/private. Two-domain public promotion requirement is a deferral/boundary, not an engineering task to move it into Core now.
8. **Evidence policy:** event-only screenshots, dedup and sampler prose differs from actual runner. Current UI-review capture work (e.g. t257 document swaps) supersedes older no-screenshot claims. Keep documentation aligned with each runner path rather than claiming one universal policy.
9. **Build/test speed:** t187 downstream shared fingerprint/store and in-process Lab build prelude; t192 Core cache/deferral; t193 seeded/shared fixtures are delivered foundations. Worker reports marked ready/uncommitted reflect their then-current branches, not present integrated state. Root must use task history for remaining live-lane ownership.
10. **Governance docs:** module-size Current State still says no extension unit runner and demo-workspace untouched. Actual package.json has the runner, and its own September 11 ledger records the facade split. Agent-git Current State says Core paired tooling not done, but its nested core-task-tooling report and current AGENTS describe it. These are documentation reconciliation items.

## Live-testing obligations to carry into the root plan

The current four-lane round and acceptance criteria are root/live-history's authority. This slice adds a concise checklist for those runs and later compatibility validation:

1. Use the real extension chat to submit the instruction. Observe reasoning messages, action cards, question/permission lifecycle and overlay from real events through build, test, judge, repair and settle.
2. Confirm the side panel/popup is beside the scenario page and automation actions still target the scenario tab after panel activation.
3. Inspect overlay truth and interference: absent before first Core event; accurate phase; no overlay host/text in snapshots, evidence blockers or recordings; no blocked/misdirected corner actions; correct document-swap handling.
4. Answer and decline a consequential permission ask; complete/allow a robot check to clear; confirm ask cards settle correctly on cleared/failing/cancelled/expired paths and work does not continue after a decline/Stop.
5. Repair a wrong/broken Flow and inspect durable applied/held/waiting state; rerun saved Flow after restart to distinguish real repair persistence from one successful live patch.
6. For extraction, inspect Core's dataset/preview/export, row/field correctness, optional/null semantics and pagination; measurements remain counts-only. Provider-free saved-scrape proof does not establish new model-authored general row loops.
7. Test a real pairing, reconnect/browser restart and real Stop against running Core; inspect bounded diagnostics. Old fake-gateway proof is insufficient here.
8. Later release matrix: Chrome/Edge side panel narrow/wide; Firefox native popup around 600px height; keyboard tabs/settings/dialogs; saved-password autofill in the original user environment; Linux CI and attach/clone only in their appropriate environment.

No panel should be started/restarted by this audit. Current AGENTS narrows regression checks before merges and limits full sweeps to twice daily. Older per-fix whole-suite instructions and machine-load explanations must not override that policy.

## Read-only verification performed

- Complete assigned-file UTF-8/line scans: 823 nested Markdown files, table above; 17 top-level parent scans.
- Read README for orientation, parent Current States, selected nested outcomes/gaps and historical evidence.
- `git log --first-parent --format='%h %s' -180`: inspected actual integrated task subjects including t216/t217/t219/t220/t221 and later loop work through t252/t254/t258/t259.
- `apps/extension/package.json`: inspected current check/test/build/e2e scripts; actual unit runner and build-before-e2e contradict stale parent claims.
- `rg --files scripts/task packages/test-runner/src/demo-workspace apps/extension/src/panel`: confirmed current task tooling and decomposed demo-workspace paths.
- Tests/builds/browser/provider runs: **not run**. Historical reported passes have not been independently rerun.

## Return contract

- Files changed: only this report.
- Product behavior changed: none.
- Root action: reconcile this historical/operational slice with live-history and Core/UI reports; prioritize round 1003 and integrated browser proof, then compatibility/CI/user-root operations and broader roadmap.
- Gaps: most historical text was scanned rather than close-read; current external CI settings/browser state/private root state uninspected; all historical live claims are dated evidence, not new validation.
