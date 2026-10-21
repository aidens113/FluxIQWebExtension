# Recovery ledger archive, 2026-10-21

Moved from docs/working/trace-offline-trials-plan.md under the working-document protocol.
The hub's Current State remains authoritative. Only the two relative report links were adjusted for this location.

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

### 2026-10-20 - t750 merged: one source for undo admission paths and act subjects
- Agent: supervisor (worker-high t750)
- Changed: Core: t748's `site-reset/undo-reach.ts` copied `undo-admission.ts`'s admission paths under a pin test, and
  `reset-settlement/act-groups.ts` held a third copy of "what the act was about"; the paths now live in
  `site-reset/undo-paths.ts` and the act subject in `reset-settlement/act-subjects.ts`, every caller imports them, the
  copies and the pin test are deleted (site-reset still depends on reset-settlement, never the reverse). Behaviour
  unchanged.
- Validation: worker: reset-settlement, site-reset, reset-answers before 27 files / 338 tests, after the first pass 28
  / 346, after the third copy 29 / 347 (one moved, new tests added), all passing; `browser-export.test.ts` 1898 / 75 /
  133 ms alone and 424 ms in its folder against its earlier 15180 ms under load. Supervisor's gate after merging dev:
  Core `vitest run` over flow-bootstrap, service/project-build, project-agents, service/candidate-trial -> `Test
  Files 339 passed | 1 skipped (340)`, `Tests 3496 passed | 2 skipped (3498)`; fluxiq `tsc` 0; Core audit passed (439
  warnings: `reset-settlement/` at 16 files, advisory); `docs:check` current; Core build 0; downstream audit passed.
- Open: `site-reset/tests/` is at its 25-file limit (the audit refuses the next file there).
- Outcome: Accepted
- Follow-up: none.

### 2026-10-20 - t749 merged: trace plan P5 offline reads and targets tier 2
- Agent: supervisor (lane T lead and workers P5a-P5e, P5s, W6-W8)
- Changed: Core and downstream merged and pushed. When a trial's read differs from the recorded one, the trace matcher
  hands it to a reevaluation port; the domain (`runtime/offline-reads/`) runs the extension's own content code over
  the recorded page snapshot in a headed sandbox page (scripts and network off; hosted by the test-runner for now)
  and answers, or returns an explicit gap (`snapshot_unavailable`, `dynamic_content`; origin `snapshot_evaluation`).
  Public seams `automationStudioProjectSingleSubflowRebuild`, `automationStudioServiceWholeTrialPorts` and
  `automationStudioGatewayTraceServiceStore` (the build uses them too) replace t746's deep loads, which are deleted.
  New structure-audit rules `package-exports` and `module-reach` refuse loads of non-exported build paths; their
  existing findings were baselined (Core 3, downstream 35; brief package-exports-cleanup removes them).
- Validation: supervisor's gate on t749 after merging dev: Core `vitest run` (plain) over client-gateway, gateway-trace,
  offline-trial, trial-ports, project-build, candidate-trial, project-agents, model offline-trial, environment,
  runtime/tests -> `Test Files 3 failed | 317 passed`, `Tests 5 failed | 2010 passed`: five real-SQL tests timed out
  at 15.1-16.9 s under load; alone `Test Files 3 passed (3)`, `Tests 11 passed (11)` twice, and on Core `dev` too;
  grouped runner (`pnpm test` with the same folders) -> parallel group `Test Files 223 passed (223)`,
  `Tests 1549 passed (1549)`; real-SQL group `Test Files 2 failed | 95 passed (97)`: `runtime-patches.test.ts` timed
  out again (15.6 s) under three leads' load, and `project-build-reset.test.ts` "a reset brief's requests through
  DeepSeek's own pre-send checks" failed in 3.6 s (not a timeout); that file alone -> `Tests 10 passed (10)` on t749
  and on Core `dev` d78c8d4a, so it is an intermittent, order- or load-dependent failure, not t749's; fluxiq `tsc` 0; Core audit passed (1155 baselined); audit rule tests -> pass 31 fail 0; `docs:check`
  current; Core build 0; core-build gate current; core mirror matches (72 files); domain and extension `check` 0;
  domain runtime + client -> pass 1692 fail 0; extension content+background -> pass 2089 fail 0; test-runner build 0,
  offline-trial-experiment + offline-snapshot-page + trace-inspection + trace-parity -> pass 126 fail 0; downstream
  audit passed (651 baselined); headed content harness `e2e/content/tests/offline-reads` -> `5 passed (2.9m)`. Only
  `package-exports` entries were added to either baseline (diff checked). Lead: changed read offline equals live on
  job-board 84/84 cells (Chrome and Edge), photo 566/566, social 906/906; P4's corrected-candidate item met (social
  revision 16 on trace f53b350b, 19/19 operations, 1 reevaluated, oracle fails like the live no); photo partial (round
  4 has no photo changed-read pair whose list appeared; 9/9 recorded reads reproduced from their snapshots).
- Cause found on the way: Core's plain `vitest run <path>` runs real-SQL files at full concurrency (only `pnpm test`
  groups them), so narrow gates under load starve them into timeouts; gates and leads now use the grouped runner
  (shared lane rule above), the running leads were told.
- Open: production hosting of the snapshot page and the live session's view (P6); about 6 GB of P5 run output with
  page data in the worktree's ignored `test-runs/` (removed with the worktree); the intermittent
  `project-build-reset.test.ts` failure and the `runtime-patches.test.ts` timeout under concurrent load (handoff
  file, open items).
- Outcome: Accepted
- Follow-up: package-exports-cleanup; P6 after t751.

### 2026-10-21 — t753 integrated: readable endings, usable chat and stable overlay
- Validation: `pnpm.cmd task finish t753 "Readable chat endings and stable overlay"` observed the structure gate
  `passed:true`; paired Core `pnpm.cmd task finish t753 "Readable chat endings and steady activity" --skip-checks`
  ran its mandatory prompt contracts: `Test Files 3 passed (3)`, `Tests 64 passed (64)`. Supervisor
  `pnpm.cmd docs:check` printed `Deterministic framework reference is current.` Independent owner gates and
  post-merge checks are recorded below and in the linked reports, with their actual limits.
- Merged downstream `daabd593`, Core `d1c39c0a`, preserving task merge boundaries. Downstream finished first through
  its structure gate; Core finished with manual narrow gates instead of a full sweep, and its mandatory contract
  gate independently passed 3 files / 64 tests. No hooks were bypassed.
- Post-dev integration: Core owning groups 185 files / 1633 tests plus real-SQL 11 files / 111 tests; Core package
  typecheck, web 79 tests/typecheck, domain 432 tests/source/test typechecks/build, extension 1131 tests/check,
  both audits and stamped paired Core build passed. Supervisor docs:check passed after reference regeneration.
  Stale domain/dist caused one intermediate extension type failure; owning domain rebuild resolved it.
- Supervisor independently verified Core UI 277 tests and final extension overlay 82 tests; observed final headed
  Chromium 12/12 and Firefox 2/2 logs and inspected preserved screenshots. Rendering source did not change at dev
  integration. This is scripted transport/content-harness proof, not authenticated gateway or live model execution.
- Reports: [recovery](../reports/codex-recover-t753.md),
  [post-merge validation](../reports/codex-t753-integration.md).
  External screenshots: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-21/codex-t753-ui-review/`.
- Reset/judge tasks continue in their own paired trees. No paid run, full sweep or user-panel management.

## Open Questions

None requiring user input.

