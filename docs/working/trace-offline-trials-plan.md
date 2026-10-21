# Traces And Offline Trials (Extension Side)

Status: Active
Status detail: Boundary audit move plan complete; trace plan P0-P3 merged, P4 running (t746); breadth round 5 next after t743; t747 and t748 follow-ups.
Created: 2026-10-19
Last updated: 2026-10-20
Owner: Senior supervisor agent
Scope: Execution hub for the traces/offline-trials plan and the extension/Core boundary audit's move plan, plus this repository's own part of the trace plan (in-band artifacts, page snapshots, the offline queue fix, the domain's offline read/target resolver). Core owns the trace contract, store, offline-trial runner and build-loop integration.
Paired document: `docs/working/trace-offline-trials-plan.md` in FluxIQ Core (plan of record)
Related: [extension-core-boundary-audit.md](./extension-core-boundary-audit.md) (audit findings and move plan), [breadth-forty-tasks-plan.md](./breadth-forty-tasks-plan.md) (paused breadth round, L1)

---

## Current State

**User's instruction (2026-10-19):** "implement plan & audit changes with subagents. Write everything down regarding
progress. Get it done."

**Boundary audit move plan: complete.** All six phases are merged to `dev` and pushed in both repositories: t726
lane G (phases 1, 3), t727 lane H (0, 5), t728 lane S (2, 4). Ledger in
[extension-core-boundary-audit.md](./extension-core-boundary-audit.md).

**Trace plan: P0-P4 complete, P5 next.** P0 baseline (live trials are 49.8% of build time) and P1 contracts and the
run environment (t729, t734); P2 capture, on for every Lab live run, about +11.5% overhead (t736); P3 intake parity,
3,333 of 3,333 saved-Flow points and 4,274 of 6,941 live points matched, 0 intake defects (t742); t745 keyed every
content address in a protected project and t747 closed the storage follow-ups (sweep race, re-seal job, trace-storage
layout); P4 offline trials tier 1 (t746): the production trial runner against a recorded trace through Core's real
intake, strict matching, virtual time, explicit gaps; round 4's social trials reproduce their live judged outcome
exactly. **Next: t749 (P5 offline reads tier 2)**, which also owns P4's corrected-candidate gate item and replaces the
experiment's deep loads of Core internals with a public seam plus an audit rule. Then P6 build-loop integration, P7.

**Breadth reruns: rounds 2-4 passed 0 of 12; every cause was a product defect, each fixed** (t738, t741, t743, t748).
t743 made round 4's three shared weaknesses structural; t748 closed its open items. **Next: round 5**: sync the four
lane trees (t563, t719, t566, t567) and run the four tasks on fresh workspaces, supervised at $0.25 each via both
`FLUXIQ_LLM_RUN_COST_CEILING_USD` and `--llm-max-cost-usd`, each debugged with a UI review from screenshots. t750 (a
behaviour-neutral refactor) runs beside it.

**Also merged 2026-10-19/20:** t724 L1 reset settlement; t730 browser specs on the ten realistic scenarios only;
t731-t733, t735, t737; t739 photo-social fixture and build-cache fingerprint; t740 the real-SQL test group (removed
every sweep timeout); t744 sweep-1020b fixes; the root `test` script runs every package (`--no-bail`).

**Daily sweeps:** both 2026-10-20 sweeps are done; the next runs on 2026-10-21.

**Open follow-ups:** t750 (undo admission single source); t748's notes (C5 wording only, an unnamed control seals
baselines, plan order as run order in branching Flows); storage `project/` and `tests/` at their 25-file limit and
`content-store.ts` near its size limit.

**Environment:** OneDrive.Sync.Service leaked to 14.4 GB on 2026-10-19 and was restarted with the user's approval; a
monitor alerts above 4 GB or under 4 GB free commit.

**Blocked:** nothing needs the user.

## Worker Briefs

Briefs for work in flight or next; finished briefs are archived in
[archive/2026-10-20-briefs-and-oct19-ledger.md](./trace-offline-trials-plan/archive/2026-10-20-briefs-and-oct19-ledger.md).

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
- Progress log: append a dated entry to your report after each unit: what changed, the check command and its observed
  output. End a commit-sized unit with `UNIT READY: <files>` so the supervisor can commit it while you continue.
- Dispatch workers (`worker-low`, `worker`, `worker-high`) partitioned by file, in the foreground when you need the
  result, and verify every worker claim yourself.
- Final message: the return contract (at most 12 lines: Outcome, Changed, Validation, Not verified, Report, Notes).

### Brief: t750-undo-admission-single-source (worker-high, Core site reset)
- Why: t748's `site-reset/undo-reach.ts` copies `site-reset/undo-admission.ts`'s admission paths, and a test pins the
  copied lines so the two cannot drift silently. A copied rule is still two sources of one rule; make it one.
- Task: extract the admission paths both files need into one focused module that both import (one export per file,
  barrel, tests beside it), switch both callers in the same unit, delete the copy and the pin test that guarded it.
  Behaviour must not change: every existing site-reset, reset-settlement and reset-answers test passes unchanged.
- Owns: Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/{undo-reach,undo-admission}.ts`,
  the new module (in `site-reset/` only if its file budget allows, otherwise a sibling directory, as t743 did with
  `reset-settlement/`), and their tests. Nothing else.
- Validation: from `packages/fluxiq`, `pnpm exec vitest run src/programs/automation-studio/runtime/flow-bootstrap
  src/programs/automation-studio/runtime/service/project-build src/programs/automation-studio/runtime/project-agents`;
  `pnpm exec tsc --noEmit -p .`; Core `node scripts/structure-audit.mjs`. Quote observed output.
- Report: `docs/working/trace-offline-trials-plan/reports/t750-undo-admission.md` in the downstream tree.

### Brief: t749-offline-reads-tier2 (lane T lead, trace plan P5)
- Plan of record: Core `docs/working/trace-offline-trials-plan.md` P5 (tier 2): a changed read or target is evaluated
  against the captured page snapshot loaded in a sandboxed browser with scripts and network off, running the same
  extension extraction and target code; anything dynamic is an evidence gap. Chrome and Edge first.
- Also owned here:
  - P4's deferred gate item: an offline trial of a corrected candidate for the breadth round's social failure
    reproduces the judged result (round 4's correction changes `extractList.where` inside the extension's read, so it
    needs tier 2). Use the round-4 social traces t746 used; no paid run.
  - Boundary: t746's experiment loads three unexported Core modules by path (`offline-trial-experiment/rebuild/
    core-authoring.ts`: brief scope, scoped submission, whole-candidate assembly) and the domain's `where` reading.
    Replace them with a public Core seam (or move the rebuild into Core's offline-trial runner), delete the deep
    loads, and add a downstream structure-audit rule (mirrored from Core first if the rule is generic) that refuses any
    import or load of a Core build path that is not a package export.
- Gate: on the breadth round's photo, job and social traces a changed read evaluated offline matches what the live
  read returned; the social corrected-candidate item above; a dynamic or missing snapshot is an explicit gap, never a
  pass; an offline pass still never satisfies the whole-run gate; no trace content reaches model guidance.
- Not: t748's files (check `git -C C:/Users/osrs_/FluxStuff/fxwork/t748/<repo> status --short` before editing; it
  owns domain plan-resolution target packets, Core site reset, candidate-trial feedback, the LLM request size check)
  and t747's (Core `storage/project/**`). If you need one, stop and report.
- Validation: tests first; tests beside each change; touched typechecks; both audits; headed provider-free browser
  checks only on the ten realistic scenarios.
- Report: `docs/working/trace-offline-trials-plan/reports/lane-t-p5.md` in the downstream tree.

## Work Ledger

### 2026-10-20 - t728, t730, t734, t735, t737 merged; rerun round 2 0 of 4; t738 fixing its causes
- Agent: supervisor (lanes S, T; t730, t735, t737 leads and workers; four debuggers)
- Changed: merged and pushed in order t735, t728 (lane S with follow-ups, including the chat instruction-fold fix,
  migration 0026), t730 (realistic-only browser specs, one conflict in requests-settings.spec.ts resolved to lane S's
  test on t730's realistic page), t734 (trace U7), t737 (install handler, shown-addresses, repair count, scan, reset
  step). Rerun round 2 ran on the synced lane trees: 0 of 4, $0.567236172 (ledger in breadth-forty-tasks-plan.md).
- Validation: t728 gated recheck after merging dev: Core `vitest run` over flow-bootstrap, llm, conversations, service,
  ui/activity-status, client-gateway -> 669 files, 6488 passed; fluxiq `tsc` 0; web check 0; extension background,
  identity, action-runtime, shared, panel/settings -> 1236 pass; domain runtime, sensitivity, client -> 1625 pass;
  audits passed. t730: headed `requests-settings.spec.ts` -> 1 passed, scan -> 4 passed, Scenario Lab suite -> 45
  passed, the unblocked specs -> 32 passed. t734 gated: Core 664 files, 6407 passed; tsc 0; audits passed. t735:
  171 pass; its sync-core moved the shared Core bcb2c0ec -> 2d7bf003 -> 3dcd0355 for real. t737: five `tsc` 0;
  extension background 573, domain 398, row 41, build-time 12, Core 84 pass; headed `reconnect.spec.ts` -> 3 passed
  twice (the flaky `:85`/`:122` included); scan -> 9 passed.
- Outcome: Accepted (merges); Partial (live)
- Follow-up: t738 (four rerun causes), then rerun round 3; t736 P2 capture; sweep-1020.

### 2026-10-20 - First daily sweep (sweep-1020)
- Agent: supervisor (worker sweep-1020)
- Changed: `reports/sweep-1020.md`; worktrees `fxwork/sweep-1020/` (Core ca23a8ba, downstream 6dd2d724).
- Validation: worker's runs, not rerun by the supervisor: installs, Core build and check, downstream build -> 0; Core
  `pnpm test` -> 1 (fluxiq 13310 passed, 4 failed: new 15 s timeouts in controller, command-execution service,
  provider-unavailable, flow-index-read; contracts 250/250; client-gateway-websocket 179/179; apps/web 3129/3129);
  downstream `pnpm check` -> 1 (build-cache registry.test.mjs: `git check-ignore` empty pathspec; audit and `pnpm -r
  check` not reached); downstream `pnpm test` -> 1 (scenario-lab 996 passed, 2 failed, both photo-social: newest-likes
  assertion, Glaze close-dialog timeout; domain 2212/2212; extension cut off without totals). All 10 Core failures
  and the crossborder failure of sweep-1019b are gone; no out-of-memory error.
- Outcome: Partial (fix forward in t739)
- Follow-up: t739; the photo-social fixture result gates rerun round 3.

### 2026-10-20 - t739 merged: photo-social fixture defect, build-cache fingerprint gap
- Agent: supervisor (t739 lead and workers)
- Changed: downstream merged (Core side had no change): photo-social's heart and dock show done only once the server
  has the act (newest-likes lost likes when a navigation followed the optimistic heart; a live-run risk too); the
  recording driver keeps Playwright's call log; `scenario-lab:check` declares its read of `packages/test-runner`
  (t730 had left the realistic-scenarios list outside the cache fingerprint).
- Validation: supervisor reruns in t739: `node --test dist/scenarios/photo-social/tests/*.test.js
  dist/scenarios/photo-social/breadth/tests/*.test.js` -> pass 46 fail 0; live-task and instruction tests -> pass 17;
  `node --test scripts/build-cache/tests/*.test.mjs` -> pass 25 fail 0; `prove-inputs.mjs scenario-lab:check` ->
  `inputs proved complete for 2 listing(s)`; scenario-lab e2e `tsc` 0; audit passed; gated `pnpm task finish t739`
  -> merged. Lead: extension suite alone 3220/3220; the four Core timeouts pass alone (0.4-1.5 s) and in their
  directories (218/218), load-only.
- Outcome: Accepted
- Follow-up: sql-test-pool (structural fix for the recurring sweep timeouts).

### 2026-10-20 - t738 merged: the four rerun round 2 causes fixed
- Agent: supervisor (t738 lead and workers)
- Changed: Core and downstream merged and pushed: reset witnesses required before a lasting reversible press; real
  trial-act addresses; an invented reset destination refused; write-records takes step-value records; issue placement
  and the loop-in-loop alternative; "test it" for an unchanged submission; trial answers carry their page; a refused
  test says where the tab went; one lifecycle store per process (since t728 the domain never saw Core's call frame,
  so later briefs' opening calls were refused); truthful endings; the downstream load-every-row-first hint, scroll
  description and named bad keys. The supervisor updated one text-disclosure test that pinned the old hint wording.
- Validation: supervisor reruns in t738: Core `vitest run` over flow-bootstrap, llm, service, nodes, project-agents,
  ui -> 724 files, 7003 passed; fluxiq `tsc` 0; downstream checks 0; domain runtime/io/client -> pass 1848; extension
  content+background -> 1990 pass, 1 fail (`text-disclosure.test.ts` pinned the old hint; updated to the new
  structure, the folder then pass 2 fail 0); headed `e2e/site-reset` -> 6 passed (3.7m); after merging dev, gated:
  Core 632 files, 6173 passed; extension 1992 pass; domain 1855 pass; audits passed; finish merged both sides.
- Open (lead): the ending filter that drops part-level test claims is broad; the reset-witness rule does not cover
  unscoped presses or a lone `create_new`; the rewritten job spec no longer checks the wrong-job undo.
- Outcome: Accepted
- Follow-up: rerun round 3 on synced lane trees; then the open points.

### 2026-10-20 - t736 merged: trace plan P2 capture
- Agent: supervisor (lane T and its workers)
- Changed: Core and downstream merged and pushed: capture at the client gateway and Core's own ingress into each
  project's store (indexed, explicit completeness, secrets screened before storage, per-trace artifact scope); the
  extension's page snapshots and in-band artifacts; the offline queue keeps original envelopes; the Lab traces every
  live run (`--no-tracing` opts out). Five new gateway-trace tests carry t740's real-SQL marker (the guard flagged
  them after the merge, as designed).
- Validation: supervisor reruns on t736 after merging dev: Core `vitest run` over client-gateway, AS client-gateway,
  environment, gateway-trace, storage gateway-trace, candidate-trial, subflow-trial, project-build, service/tests, api,
  parking -> 149 passed, 1 failed (`cancel-runtime-session.test.ts` "stops a queued run", then 6/6 alone three times
  and the api directory 27 files, 165 passed on the re-gate); fluxiq and web `tsc` 0; extension `tsc` both 0;
  extension trace-capture, connection, background -> pass 477; test-runner trace-inspection, saved-flow-replay,
  commands, environment -> pass 101; the first gate held on a stale Core build after the marker edit, the re-gate
  (Core rebuilt) passed domain, extension, test-runner checks and both audits; finish merged both sides. Lead: the
  capture overhead is about +11.5% over 36 provider-free replays on four realistic tasks; a default-settings headed
  replay wrote a complete trace (127 events, 22 snapshots held, 0 secret hits).
- Outcome: Accepted
- Follow-up: P3 intake parity (t742).

### 2026-10-20 - t741 merged: the four rerun round 3 causes fixed
- Agent: supervisor (t741 lead and workers)
- Changed: Core and downstream merged and pushed: Core settles witnessless trial and entry-preparation acts against
  the build's issued lists (A1, structural), settling looks report what they settled and every open act, the wrap-up
  allows the undo calls a trial demands; one port-name rule for plan and script; `extractList.sort` in the script
  format and a refusal of process sort/limit on a lasting-act listing; the recording excerpt reaches the builder;
  stable scoped revisions; truthful endings; the judge no longer reads a feed's continuation as missing rows and does
  not repeat identical advice; downstream: rate-limited retries reported first, reload marks by time origin, named
  incomplete fields, wordless icons named; a headed spec reproducing office round 3's address-confirm shape.
- Validation: supervisor's gate on t741 after merging dev: Core `vitest run` over flow-bootstrap, llm, service,
  project-agents, result-verification, ui -> 854 files, 8072 passed; fluxiq `tsc` 0; downstream checks 0; domain
  runtime/io/client -> pass 1873; extension content+background -> pass 2055; audits passed; headed `e2e/site-reset`
  -> 7 passed (4.2m). The script's own gate printed ok=0 because a test title contains "failed"; the silent checks were
  rerun (`tsc` 0, core-build current) and the finish merged both sides. Lead: the new office spec fails exactly as
  round 3 did with A1 switched off and passes with it on.
- Open (lead): a press that reloads the page drops the control's name from trial feedback; several directories are at
  their 25-file budget.
- Outcome: Accepted
- Follow-up: rerun round 4 (tracing on for the first live runs).

### 2026-10-20 - Second daily sweep (sweep-1020b); root test script runs every package
- Agent: supervisor (worker sweep-1020b)
- Changed: `reports/sweep-1020b.md`; root `package.json` `test` is now `pnpm -r --no-bail test` (the sweep stopped at
  scenario-lab's failure, so the extension's tests never ran; the exit code still fails on any failure).
- Validation: worker's runs (Core 3b13e394, downstream 72b7fab3): installs, Core build and check 0; Core test 1
  (contracts 250/250; client-gateway-websocket 182/182; fluxiq parallel group 12115 passed in 952 s, real-SQL group
  1531 passed, 1 failed in 943 s; web 3142/3142); downstream check 0; test 1 (domain 2244/2244, scenario-lab 999/1000);
  build 0. Gone since sweep-1020: all four 15 s timeouts (t740 works), the registry test, both photo-social tests.
  New: Core `deepseek-bootstrap/exploration.test.ts` token ceiling (`pre_provider_request_total_exceeded`), and
  scenario-lab crossborder flash-deal-on-arrival `locator.waitFor` 1000 ms. Supervisor check of the flag:
  `pnpm -r --no-bail --filter @fluxiq-web-extension/real-site-policy exec node -e "process.exit(0)"` -> exit 0.
- Outcome: Partial (two failures to fix forward)
- Follow-up: t744 for the two failures; extension totals come back in the next sweep.

### 2026-10-20 - t744 and t742 merged: sweep-1020b fixes; trace plan P3 intake parity
- Agent: supervisor (t744 worker; lane T and its workers)
- Changed: t744 (test-side only: the deepseek exploration test uses the harness token window, since the write-records
  catalog growth is counted though never sent; crossborder browser paths read what the page showed on load instead of
  a 1 s wait). t742 (P3): a harness replays a stored trace through Core's own intake and compares every delivery point;
  trace payloads chunked and stored once under the content store's protection and lifecycle (migrations 0031-0032);
  screening keeps session references, digests are not redacted as card numbers, order is checked per causal chain,
  legacy traces classified by Core; the start hook lands in the build's trace.
- Validation: t744 gate: deepseek-bootstrap -> 11 passed; crossborder dist tests -> pass 59 fail 0; audit passed;
  finished both sides. t742 gate after merging dev: Core rebuilt; Core `vitest run` over client-gateway, AS
  client-gateway, environment, gateway-trace, storage gateway-trace, service/projects, candidate-trial, subflow-trial,
  service/tests -> 119 files, 775 passed; fluxiq `tsc` 0; downstream checks 0; test-runner trace tests -> pass 70 fail
  0; audits passed; finished both sides. Lead: all ten realistic sites covered (nine by saved-Flow replays, photo by its
  round-4 build trace); saved-Flow traces 3,333 of 3,333 delivery points matched; round-4 live traces 4,274 of 6,941
  matched with 2,667 honest capture gaps (they predate the delivered-value field), 0 intake defects; crossborder and
  bigbox replayed three times each, stable.
- Open: content-store and chunk addresses are unkeyed SHA-256 (equality and guesses confirmable from the database):
  brief t745; P4 offline trials tier 1: brief t746; the size check counts the never-sent node catalog (follow-up).
- Outcome: Accepted
- Follow-up: t745, t746; round 5 after t743.

### 2026-10-20 - t745 merged: keyed content addresses in protected projects
- Agent: supervisor (t745 lead and workers u1-u5)
- Changed: Core: in a project opened with a content protection, every address of protected content is an HMAC under a
  random per-project 256-bit address key sealed by that protection (closed domain set, project id in the input): trace
  chunk digests and a keyed chunker (the public gear table let chunk lengths confirm a guess), artifact digests,
  sealed manifests, reusable-context digests; legacy plaintext event bodies re-cut into keyed sealed chunks. Existing
  data is rekeyed at each protected open in guarded batches, resumable after a crash; old forms are removed and the
  file scrubbed (secure_delete, durable scrub requests, VACUUM after a converting open); key rotation keeps retired
  keys. Migrations 0033-0035. Brief premise corrected: sealed content-store object ids were already safe (SHA-256 of
  random-IV ciphertext). Wire digests stay plain SHA-256, so downstream needed no change. Reports
  `reports/t745-*.md`.
- Validation: supervisor's gate on t745 after merging dev: Core `vitest run` over storage/project, runtime
  gateway-trace, client-gateway trace and trace-tap, reusable-context service, caches, object-documents-trace,
  service/projects -> `Test Files 99 passed | 2 skipped (101)`, `Tests 662 passed | 4 skipped (666)`; fluxiq `tsc` 0;
  Core audit passed (433 warnings, 1152 baselined); `pnpm docs:check` -> framework reference current; Core build 0;
  downstream audit passed after `structure:baseline`; core-build gate current; extension trace-capture and core-api ->
  pass 50 fail 0. Every new SQLite test carries the real-SQL marker. Lead: Core web trace routes 17/17; Lab trace
  inspection and parity 28/28; mutations reverted to show each test fails without its fix.
- Open (lead): two-process races tested within one process and by injection only; a re-seal job, the sweep's
  file-before-row removal and storage `gateway-trace/` at its 25-file limit are pre-existing (brief t747).
- Outcome: Accepted
- Follow-up: t747 storage follow-ups.

### 2026-10-20 - t743 merged: round 4's three shared weaknesses fixed structurally
- Agent: supervisor (t743 lead and workers)
- Changed: Core and downstream merged and pushed. S1 build-scoped site memory: shown addresses belong to the build,
  every brief's opening carries the build's issued-list places, Core's own reset looks skip the address rule (new
  public `runAsAutomationStudioCoreMove`). S2 actionable answers: every reset refusal names its failed condition and
  whether any call can meet it (`reset-answers/`); a list that is an act's only witness and cannot be read again makes
  it `gate_unsatisfiable` (honest exit, `terminalReason`); a toggle back settles `restored`; a witnessless trial act
  adopts only lists the build named or lists on its own page. S3 repair before ending: with money and turns left, an
  ending is refused once per failed subflow until it had one changed brief, unless it carries a closed terminal
  reason. S4: a read step's words are marked as the value it reads; each looped pass on its own row; a press answered
  only by a notice in the page's alert or status region fails `web.action.page_reported_failure` and is retried. S5
  social: disclosure checked only on rows a read's conditions keep; a trial past 40 steps names its stopping step; the
  step log names a thrown error's real kind; judge advice after `incomplete_text` is the disclosure order. Settlement
  modules moved to `reset-settlement/`. Supervisor accepted the lead's two choices (the job spec retries the page's
  failed first save then undoes it, per the retry rule; a witnessless act with nothing adoptable ends honestly instead
  of settling on unrelated lists, which was round 4's office defect).
- Validation: supervisor's gate on t743 after merging dev: Core `vitest run` over flow-bootstrap, llm, project-agents,
  service, executor, runtime/tests -> `Test Files 927 passed | 1 skipped (928)`, `Tests 8274 passed | 3 skipped
  (8277)`; fluxiq `tsc` 0; Core audit passed; `pnpm docs:check` failed on a stale framework reference (t743's two new
  exports), regenerated and committed, then current; Core build 0; domain and extension `check` 0; domain runtime,
  client, actions, element-fingerprint, output-nodes -> pass 2024 fail 0; extension content+background -> pass 2089
  fail 0; downstream audit passed; headed provider-free `e2e/site-reset` -> `11 passed (6.3m)` (after a Core rebuild:
  the first attempt was refused by the core-build gate because the reference commit touched `packages/fluxiq`);
  content harness `social-kept-row-disclosure.spec.ts` -> `1 passed`.
- Open (lead, now brief t748): dialog and standalone page at one address share one view (d5 reverted); an undo reason
  no call can meet is not detected in general; trial feedback labels a read with pre-change words; office C5/C6 and
  smaller debug points; Core reads the domain refusal word `incomplete_text` (documented cross-repository contract).
- Outcome: Accepted
- Follow-up: sync the lane trees and run rerun round 5; t748.

### 2026-10-20 - t747 merged: storage sweep race, re-seal job, gateway-trace layout
- Agent: supervisor (t747 lead and workers a, b, c)
- Changed: Core: (a) every path that removed a content file before its row removes the row first through the
  pending-removal record, now keyed by file path (migration 0036 rebuilds `object_pending_removals`, every column and
  row kept, since SQLite cannot change a primary key in place), so a writer racing a sweep or removal never loses its
  file; (b) a re-seal job (`content-reseal/`) re-seals every sealed item under the host's new current key, resumable
  and rerunnable; the host makes the new key current, runs the job until it reports complete, and only then drops the
  old key; providers declare the optional `sealedKeyId` or the job refuses them (`persistence.md`); (c) storage
  `gateway-trace/` (25 files, at its limit) split into `gateway-trace-schema/`, `gateway-trace-chunk-codec/`,
  `gateway-trace-chunk-rows/` (6 files left), callers switched, barrel exports unchanged. The supervisor resolved the
  merge conflict in the generated framework reference by regenerating it from the merged source (t743's core-move
  and t747's re-seal exports both present).
- Validation: supervisor's gate on t747 after merging dev: Core `vitest run` over storage, runtime gateway-trace,
  client-gateway trace and trace-tap, reusable-context service, caches, object-documents-trace, service/projects ->
  `Test Files 124 passed | 2 skipped (126)`, `Tests 785 passed | 4 skipped (789)`; fluxiq `tsc` 0; Core audit passed
  (435 warnings, 1152 baselined); `pnpm docs:check` -> framework reference current; Core build 0; core-build gate
  current; downstream audit passed; extension trace-capture and core-api -> pass 50 fail 0. New SQLite tests carry the
  real-SQL marker. Lead: worker-run fail-first, (a) 6 of 9 tests failed on the old code, (b) 7 of 9 against a stub.
- Open: storage `project/` root and its `tests/` are at 25 files each and `content-store.ts` is 596 lines with 28
  methods (advisory thresholds passed, limits not); the audit refuses the next file there, so the next storage change
  restructures first. Two-process races and real process kills simulated (two connections, thrown hooks).
- Outcome: Accepted
- Follow-up: none beyond the open note.

### 2026-10-20 - t746 merged: trace plan P4 offline trials tier 1
- Agent: supervisor (lane T lead and workers P4a-P4d)
- Changed: Core and downstream merged and pushed: an offline trial is the candidate trial runner with a trace
  environment; a strict trace matcher (`client-gateway/trace-matcher/`) attached to the live gateway answers every
  command through Core's real intake (action type, canonical target and parameters, occurrence, matched prefix), never
  delivers anything recorded after the matched point, and answers a mismatch with a classified evidence gap; virtual
  timers (deadlines fire when explicit waits or recorded latencies pass them); U5 results (recorded origins; gaps,
  failed deliveries and unjudged trials make it inconclusive; inconclusive marks assertions unverified); the offline
  trial's own trace is marked derived; judges still run and an offline yes stays evidence only. Downstream: the
  test-runner's `offline-trial-experiment/`. Fixed on the way: a capability-less default session with no gap had
  produced a dishonest "fail"; T12's test race (3 of 5, then 10 of 10).
- Validation: supervisor's gate on t746 after merging dev: Core `vitest run` over client-gateway, environment,
  executor, runtime gateway-trace, offline-trial, candidate-trial, subflow-trial, flow-bootstrap/candidate, model
  offline-trial, runtime/tests -> `Test Files 364 passed (364)`, `Tests 2504 passed (2504)`; fluxiq `tsc` 0; Core
  audit passed; Core build 0; test-runner build 0, offline-trial-experiment + trace-inspection + trace-parity -> pass
  74 fail 0; downstream audit passed; headed `e2e/site-reset` -> `11 passed (9.2m)` (t746 changes executor timers).
  `pnpm docs:check` failed on the new exports; after merging dev again (t747) the reference was regenerated and is
  current; re-run after that merge: Core trace-matcher, trace, gateway-trace, offline-trial, environment, storage
  gateway-trace, model offline-trial -> `Test Files 62 passed (62)`, `Tests 355 passed (355)`; `tsc` 0; build 0;
  test-runner -> pass 74 fail 0; both audits passed. Lead experiments (provider-free, copied round-4 social traces):
  revisions 10 and 16 against their own traces matched 19/19 operations with identical rows, steps and stop point,
  oracle verdict equal to the live "no"; revision 16 against revision 10's trace gets an explicit `argument_mismatch`
  gap on `extractList.where`; a trace with no recorded session view is refused.
- Outcome: Partial. Tests T05-T08, T10, T12-T16, T20, T22-T24 pass; the gate's corrected-candidate item cannot be met
  in tier 1 (round 4's social correction changes a filter inside the extension's read) and moves to P5 (brief t749),
  with no paid run. The experiment deep-loads three unexported Core modules (digest-guarded); t749 replaces them with
  a public seam and adds an audit rule refusing such loads.
- Follow-up: t749 (P5); P6 passes the live session's view (production does not yet).

### 2026-10-20 - Core dev fix: graph options pin the environment's region timer
- Agent: supervisor
- Changed: Core `runtime/service/runtime-session/tests/graph-options.test.ts`: since t746 the run environment supplies
  the region timeout timer (`startTimer`) as well as clock, waits and randomness; the test treated it as an unrelated
  option and failed on Core `dev` (t746's gate covered executor, trial runners and environment, not this caller). It
  now asserts an offline environment's timer is taken and a live run has none. Pushed (Core 939bdd4b).
- Validation: t748's gate found it: Core `vitest run` -> `1 failed | 937 passed`; reproduced on Core `dev` 1c8efbda ->
  `Tests 1 failed | 2 passed (3)`; after the fix, graph-options + environment -> `Test Files 7 passed (7)`, `Tests 35
  passed (35)`; in t748 after merging dev, runtime-session + environment -> `Test Files 24 passed (24)`, `Tests 158
  passed (158)`.
- Outcome: Accepted
- Follow-up: none; a narrow gate misses tests in unchanged directories by design, the daily sweep covers them.

### 2026-10-20 - t748 merged: t743's open items and two earlier follow-ups
- Agent: supervisor (t748 lead and workers u1, u1b, u2, u3, u4, u5, u7)
- Changed: Core and downstream merged and pushed. Item 1: Core tells the domain each node's preceding steps
  (`precedingSteps`), and the domain picks the view a step stands on from them (`plan-resolution/step-views/`), so a
  dialog view and a standalone page at one address no longer fail `web.target.ambiguous`. Item 2: an act whose
  differing list no undo could put back is `gate_unsatisfiable` with `no_admissible_undo`. Item 3: a read step is named
  by the value it read and a press keeps its control's name (the cause was Core's text screen dropping "address", not
  the reload; a separate screen for a control's own words). Item 4: the request-size window counts only what is sent.
  Item 5: a stall names the refusal it followed and the person's ending keeps a failure that says why; a looped act's
  pass is named in trial feedback; office C5 (the refusal names which list to name) and C6 (`retryRefused`); an
  unidentified creation needs a witness. New headed spec `photo-dialog-step.spec.ts` (fails on the old resolver).
- Validation: supervisor's gate on t748 after merging dev: Core `vitest run` over flow-bootstrap, llm, project-agents,
  service, executor, runtime/tests -> `Test Files 1 failed | 937 passed | 1 skipped (939)`, `Tests 1 failed | 8339
  passed` (the graph-options pin above, a `dev` defect from t746, fixed on `dev` and merged; then runtime-session +
  environment -> 24 files, 158 tests passed); fluxiq `tsc` 0; Core audit passed; `docs:check` current; Core build 0
  (rebuilt after the merge, gate current); domain and extension `check` 0; domain runtime, client, actions,
  element-fingerprint, output-nodes -> pass 2031 fail 0; extension content+background -> pass 2089 fail 0; downstream
  audit passed; headed `e2e/site-reset` -> `12 passed (5.2m)`.
- Open (lead): C5 has no generic rule (watch the office purchase in round 5); a press whose control names nothing still
  seals the baselines; plan order is used as run order, so in a branching Flow a press after a handler resolves as
  before; `undo-reach.ts` copies `undo-admission.ts`'s admission paths under a pin test (brief t750, a refactor with
  no behaviour change, runs beside round 5); two cross-repository contracts documented (`readsWords`, `precedingSteps`).
- Outcome: Accepted
- Follow-up: sync the lane trees and run round 5; t750.

## Open Questions

None requiring user input.
