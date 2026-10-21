# Traces And Offline Trials (Extension Side)

Status: Active
Status detail: Boundary move plan, trace P0-P5 and UI t753 merged; reset/judge recovery before P6 and breadth round 6.
Created: 2026-10-19
Last updated: 2026-10-21
Owner: Senior supervisor agent
Scope: Execution hub for the traces/offline-trials plan and the extension/Core boundary audit's move plan, plus this repository's own part of the trace plan (in-band artifacts, page snapshots, the offline queue fix, the domain's offline read/target resolver). Core owns the trace contract, store, offline-trial runner and build-loop integration.
Paired document: `docs/working/trace-offline-trials-plan.md` in FluxIQ Core (plan of record)
Related: [extension-core-boundary-audit.md](./extension-core-boundary-audit.md) (audit findings and move plan), [breadth-forty-tasks-plan.md](./breadth-forty-tasks-plan.md) (paused breadth round, L1)

---

## Current State

**Recovery active (2026-10-20): Codex is continuing the three preserved task worktrees.** Operating detail (in-flight
units t751, t752, t753 and how to resume them, the exact gate and merge steps, how to sync lanes and launch round 6,
and the ordered next steps) is in [reports/handoff-2026-10-20.md](./trace-offline-trials-plan/reports/handoff-2026-10-20.md).
Read it after this section.

**Recovery checkpoint (2026-10-21):** t753 is verified and merged in both repositories (downstream `daabd593`,
Core `d1c39c0a`). Post-merge narrow gates passed, with provider-free Chromium (12) and Firefox (2) rendering cases
and supervisor-inspected full-panel screenshots; the supervisor also independently passed the 82 overlay unit cases.
t752 is checkpointed locally; the supervisor's corrected changed-owner gate passed 32 files / 362 tests after
structured-negative fixture migrations. P5 compatibility review found unsupported automatic text disclosure must
be an explicit offline gap; the correction passes 22 unit cases, browser proof remains. t751's migrated real-service
fixtures pass11 tests; independent retained-witness checks pass36 tests, including absent diffs and resource collisions.
Exploration must additionally require an actually observed original at every project tool door; this final closure
is in progress. P6 remains gated on t751. t753 and its paired documentation are pushed in both repositories.
Detailed findings and observed checks: [supervisor integration review](./trace-offline-trials-plan/reports/codex-integration-review.md).

**User's instruction (2026-10-19):** "implement plan & audit changes with subagents. Write everything down regarding
progress. Get it done."

**Boundary audit move plan: complete.** All six phases are merged to `dev` and pushed in both repositories: t726
lane G (phases 1, 3), t727 lane H (0, 5), t728 lane S (2, 4). Ledger in
[extension-core-boundary-audit.md](./extension-core-boundary-audit.md).

**Trace plan: P0-P5 complete, P6 next.** P0/P1 contracts and baseline (live trials are 49.8% of build time); P2
capture on every Lab live run (+11.5%); P3 intake parity (0 intake defects); P4 offline trials tier 1 (t746: a
computation-only change runs against the recorded trace through Core's real intake); P5 tier 2 (t749: a changed read
runs the extension's own content code over the recorded snapshot; offline equals live on job-board 84/84 cells, photo
566/566, social 906/906). Builds do not use offline trials yet: **P6** (offline first in test and repair, live only for
action changes, gaps and the final judged run) starts when t751 merges, since both change the trial gates. Then P7.

**Breadth reruns: rounds 1-5 passed 0 of the four repaired tasks; all framework defects.** Round 5 (0 of 4, $0.499):
job, office and photo failed on the site-reset bookkeeping (a lasting step reaching a trial unchecked, a toggle the
site reverted itself deadlocking settle and undo, a reset taking its starting state after the build's own act), social
on judge consistency (an exact answer judged no) and read speed. **Running:** t751 reset by observed state
(lead-xhigh), t752 judge consistency and read speed (lead-xhigh), t753 chat and overlay polish (lead). Round 6 only
after t751's and t752's headed provider-free reproductions pass; trace P6 (offline trials inside builds) starts when t751 merges, since it shares the trial gates. t750 (merged) single-sourced the undo rules.

**Also merged 2026-10-19/20:** t724 L1 reset settlement; t730 browser specs on the ten realistic scenarios only;
t731-t733, t735, t737; t739 photo-social fixture and build-cache fingerprint; t740 the real-SQL test group (removed
every sweep timeout); t744 sweep-1020b fixes; the root `test` script runs every package (`--no-bail`).

**Daily sweeps:** both 2026-10-20 sweeps are done; the next runs on 2026-10-21.

**Open follow-ups:** t748's notes (C5 wording only, an unnamed control seals
baselines, plan order as run order in branching Flows); storage `project/` and `tests/` at their 25-file limit and
`content-store.ts` near its size limit.

**Environment:** OneDrive.Sync.Service leaked to 14.4 GB on 2026-10-19 and was restarted with the user's approval; a
monitor alerts above 4 GB or under 4 GB free commit.

**Package exports:** t754 is dispatched in its own paired worktrees at `fxwork/t754/` while reset/judge gates finish.
Its bounded brief is `trace-offline-trials-plan/reports/codex-t754-brief.md` in that task; source changes stay independent
of the reset and judge lanes. P6 still waits for the reset merge.

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
- Core tests run through the grouped runner, `pnpm test <paths>` from `packages/fluxiq` (the parallel group, then the
  real-SQL group with few workers), never a plain `vitest run` over folders: a plain run starves real-SQL tests into
  15 s timeouts under load. Quote both groups' "Test Files" lines.
- Model guidance never mirrors a realistic task, site, product or answer.
- No commits, merges or pushes. Do not edit `docs/working/README.md` or any plan's Current State or ledger; the
  supervisor owns them and the Core paired documents.
- Never put pairing tokens, keys, recorded page data or typed values in logs, reports or tests.
- Progress log: append a dated entry to your report after each unit: what changed, the check command and its observed
  output. End a commit-sized unit with `UNIT READY: <files>` so the supervisor can commit it while you continue.
- Dispatch workers (`worker-low`, `worker`, `worker-high`) partitioned by file, in the foreground when you need the
  result, and verify every worker claim yourself.
- Final message: the return contract (at most 12 lines: Outcome, Changed, Validation, Not verified, Report, Notes).

### Brief: t751-reset-by-observed-state (lead-xhigh, Core site reset; domain and extension where a fix needs them)
- Why: rerun rounds 1-5 passed 0 of the lasting-act tasks. Every round's debugs found the tasks and fixtures sound and
  the builds doing the task (round 5: job's save trial judged yes 4 times; office explored every fact; photo reached a
  judged whole run); what failed was the reset bookkeeping (witnesses, adoption, settled/unsettleable, already-back)
  checked at different doors. Each round's fixes exposed the next hole (t743's narrower adoption exposed round 5's job
  and office). A recurring class gets a structural fix, not another patch.
- Rule to satisfy (user, 2026-10-12): before every trial and the judged whole run the site returns to the state the
  build started from, undoing exactly the build's own lasting acts and never touching what existed before.
- Required design:
  - R1 Baseline: each control or list a build act can touch is read before the build's first lasting act there, never
    from evidence after a build act. An act with no target identity ends honestly with its condition named.
  - R2 Settlement by observed state: an act is settled when fresh reads of its witness show the baseline, whatever put
    it back (the build's undo or the site itself). A refusal like "already back" never leaves an act on the to-undo list.
  - R3 One admission point at every door a lasting act can land through (exploration, subflow trial, candidate trial,
    entry or phase preparation, whole run): a lasting step needs a readable witness first; a trial holding an
    unwitnessed lasting step is refused unrun, before baselines seal, naming the condition and a call that meets it.
  - R4 Setup reruns (`phase-start.ts` explore) never repeat the build's lasting acts while they are on the site.
  - R5 Contract: every refusal a builder can meet names a call the domain can carry out; a test fails the build when a
    rule cannot be met (domain-declared capabilities, e.g. rows in page order). Fix the listing-order rule under it.
  - R6 The new model replaces the rule pile; delete what it replaces (no dead paths), callers switched in the same unit.
- Evidence (read the debug notes, lane trees `C:/Users/osrs_/FluxStuff/fxwork/{t563,t719,t566,t567}/!FluxIQWebExtension/
  docs/working/language-driven-flow-loop-plan/debugs/`): round 5 `run-mvhibk0z-1950493f` (job), `run-mvhibit5-e1d3a4f3`
  (office), `run-mvhibis0-b536958b` (photo), `run-mvhibis1-d570b37d` (social); rounds 2-4 `run-mvgf*`, `run-mvgo*`,
  `run-mvgv*`, `run-mvgw*` (on dev).
- Acceptance before any paid run: the 12 `e2e/site-reset` specs pass, plus new headed provider-free specs on the
  realistic scenarios, each failing on current `dev` first: a lasting step never pressed in exploration; a toggle the
  site reverts itself; a dialog act with no address that must not touch pre-existing state; a press that navigates away;
  a rows-in-page-order limit with a lasting press; and the social round-5 shape if it is a reset or rule-contract cause.
- Not: UI wording owned by t753 (check its status before editing shared files); trace plan files owned by t749.
- Validation: tests first; tests beside each change; Core prompt contract tests when model-facing text changes (no
  realistic task mirrored); touched typechecks; both audits.
- Report: `docs/working/trace-offline-trials-plan/reports/t751-reset-by-observed-state.md` in the downstream tree.

### Brief: t752-judge-consistency-and-read-speed (lead-xhigh, Core judging and the web read)
- Why: round 5's social run (`run-mvhibis1-d570b37d`, debug note in `C:/Users/osrs_/FluxStuff/fxwork/t566/
  !FluxIQWebExtension/docs/working/language-driven-flow-loop-plan/debugs/`) returned exactly the oracle's rows at its
  second whole-run test and was judged no: the judge objected to what the previous judge had advised and made a false
  claim about a condition. Judge errors that lose a correct answer have recurred (rerun round 1, t725, t741, now), so
  this is a structural fix, not new wording.
- Fix, each with a test that fails first:
  - Judge consistency: every judge sees the earlier judges' advice for this build and whether it was followed; a no
    that contradicts followed advice, or claims a condition is wrong, is checked by Core against the stored rows and
    conditions before it counts (extend t659's "claims weighed by what Core measured"); an unsupported no is not a no.
    For a set the request defines by the person's relation to it, guidance uses a sign each row shows (generic wording
    only, never this task's site, groups or answer).
  - Judge evidence: a loop-source read's rows are working rows, not the answer (`summary-with-also-in-result.ts`,
    `summary-reads.ts`), so the judge is never told the answer must exclude them.
  - Read speed: `extract_list` expands per-row "See more" itself on the rows its conditions keep (extension
    `list-reader.ts`, `field-reader.ts`, `text-disclosure.ts`, the domain extractList contract, `next-sentence.ts`);
    if that cannot land cleanly, a submit check that a loop's read and the later read use the same conditions.
  - Structure detection samples more than the first five rows, so a per-row control (a membership button) becomes a
    column when rows differ.
  - Repair seeding: among tests with the same verdict, `closestTrial` takes the latest and counts only the answer set
    (`project-agents/contracts/builder-return.ts`).
- Not: reset files (t751) or chat/overlay wording (t753). `builder-return.ts` and supervisor files may be shared with
  t751: check `git -C C:/Users/osrs_/FluxStuff/fxwork/t751/<repo> status --short` and keep shared files serial.
- Acceptance: a headed provider-free spec on social-network-feed reproducing the shape (a correct answer judged with
  a contradicting no; a long "See more" list) fails on current `dev` and passes after; prompt contract tests pass.
- Validation: tests first; tests beside each change; touched typechecks; both audits.
- Report: `docs/working/trace-offline-trials-plan/reports/t752-judge-consistency-and-read-speed.md` downstream.

### Brief: t753-chat-and-overlay-polish (lead, extension UI and Core activity wording)
- Why: round 5's UI reviews (screenshots under each run's `.ui-review.local/`, findings in the four round-5 debug notes
  named in t751's brief) show the person internal or wrong text and an unstable overlay. The user judges a run by
  watching it; a ChatGPT-quality chat and a stable, visible overlay are part of passing.
- Fix (each with a test that fails first):
  - Names: a CSS class shown as a control's name ("css-..."); internal terms in chat and overlay ("Submit subflow",
    "Test subflow", the plan's "Main" router); post pages labelled with the site's name instead of the page.
  - Truth: an untick worded as "Ticking"/"set checked" (domain `node-run/run.ts`, Core `activity/wording/action.ts`); a
    reset's undo shown as an ordinary user act ("Click · Like Done"); a setup rerun labelled "Testing your Flow"; a
    false "needs a model key" notice at start.
  - Endings: one verdict repeated, contradictory sentences ("no change it knows of" beside "left changes that can't
    be checked"), a dense paragraph without the supervisor's reason, "used Unlike" for a leftover act, and no composer
    after a failed build. One plain ending: what happened, why, what is left on the site, what the person can do next.
  - Overlay: stuttered text ("Build failed | Build failed ... could not finish ... could not finish"); jumps between
    screen positions and covers the site's header or logo; flicker. One stable position that never covers page
    content the person needs, text changes only when the state changes.
  - Repeated identical cards in the chat.
- Mechanical guard: a test over Core's activity wording and the extension's chat and overlay text that fails on
  internal terms (subflow, router, candidate, brief, harness, node keys) and on CSS-class-like or generated names, so
  the class of defect cannot return silently.
- Owns: extension side panel / popup chat and the on-page overlay, Core `runtime/activity/**` wording, the supervisor's
  ending text, domain node-run wording. Coordinate: t751 owns reset data and may touch `project-agents/supervisor/**`;
  check `git -C C:/Users/osrs_/FluxStuff/fxwork/t751/<repo> status --short` and keep the two serial on any shared file.
- Validation: tests beside each change; touched typechecks; both audits; Core prompt contract tests if model-facing
  text changes; headed provider-free screenshots on two realistic scenarios showing the chat, overlay and an ending,
  looked at and described in the report (Chrome; Firefox popup alignment where the contract is shared).
- Report: `docs/working/trace-offline-trials-plan/reports/t753-chat-and-overlay-polish.md` in the downstream tree.

### Brief: package-exports-cleanup (worker, both repositories' scripts)
- Why: t749 added the structure-audit rules `package-exports` and `module-reach` (a load of a build path that is not
  a package export fails the audit). The findings that already existed were baselined so the rules could land: Core 3
  root scripts load `fluxiq`'s `dist` by path; downstream 34 root scripts load the test-runner's `dist` by path, plus
  one domain test. A baselined violation is still a violation; remove them all.
- Task: give each loaded entry point a package export (`exports` in the owning package.json, built by its normal
  build) and switch every script and the test to import it by package name and subpath; or move a script beside the
  package that owns the code. No copying of code. Then run `pnpm structure:baseline` in each repository and confirm the
  `package-exports` entries are gone from `.structure-baseline.json` and nothing else was added.
- Owns: Core root `scripts/**` that the baseline names, `packages/fluxiq/package.json` exports; downstream root
  `scripts/**` that the baseline names, `packages/test-runner/package.json` exports, the one domain test. Nothing else.
- Validation: each switched script still runs its own smallest real command (for Lab scripts, `--help` or a dry
  path; never a live or paid run); `node --test` for any tests beside the scripts; both audits passed with zero
  `package-exports` baseline entries; Core `pnpm docs:check`; downstream `node scripts/check/core-mirror.mjs`.
- Report: `docs/working/trace-offline-trials-plan/reports/package-exports-cleanup.md` in the downstream tree.

### Brief: P6-offline-trials-in-builds (lane T lead, trace plan P6)
- Plan of record: Core `docs/working/trace-offline-trials-plan.md` P6 (test and repair phases only). User direction
  (2026-10-20): test and iterate on Flows without acting on the site, going live only for the final judged run, when
  required, or on errors.
- Task: during a build's test and repair phases, a candidate's trial runs offline first against the build's latest
  live trace of that subflow (t746's runner; tier 2 reads once t749 merges): a demonstrated failure goes back to the
  builder as repair feedback marked recorded; an evidence gap (changed actions or order, a dynamic page, a missing
  snapshot) becomes a focused live run from that node (the existing run-from-node tool), not a whole live trial; the
  final judged whole run stays live, preceded by the reset; live-success accounting counts live episodes only, and an
  offline pass never completes a build or satisfies the whole-run gate. Production passes the live session's view to
  the matcher (open since P4). The chat and step log say which results were offline, in plain words.
- Order: tier 1 first (computation-only changes), then tier 2 when t749 is merged.
- Not: exploration or the initial build (no offline trial there, plan test); model guidance never sees trace content.
- Validation: tests first; the source tests no earlier phase covered (T09, T17-T19, T21; confirm against the source plan) plus the plan's added
  tests; tests beside each change; touched typechecks; both audits; a headed provider-free build on two realistic
  scenarios whose repair iteration runs offline and whose final judged run runs live, with the step log showing both.
- Report: `docs/working/trace-offline-trials-plan/reports/lane-t-p6.md` in the downstream tree.

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
- Reports: [recovery](./trace-offline-trials-plan/reports/codex-recover-t753.md),
  [post-merge validation](./trace-offline-trials-plan/reports/codex-t753-integration.md).
  External screenshots: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-21/codex-t753-ui-review/`.
- Reset/judge tasks continue in their own paired trees. No paid run, full sweep or user-panel management.

## Open Questions

None requiring user input.

### 2026-10-20 — Codex recovery dispatched
- Agent: supervisor
- Changed: recovery ownership recorded; preserved t751/t752/t753 worktrees and user `.clinerules/fluxiq.md` edit.
- Validation: initial main `git status --short` confirmed only the user edit; paired tasks contain reported partial work. Both main `pnpm.cmd structure:baseline` runs exited 0 (downstream 651 entries, Core 1155; no baseline growth).
- Outcome: Partial; each task requires fresh diff review and narrow checks before acceptance.
- Follow-up: workers recover one existing task each; supervisor reviews, integrates and verifies both repositories.

## Recovery briefs (2026-10-20)

### Brief: codex-recover-t751
- Repository: paired fxwork/t751/!FluxIQWebExtension and fxwork/t751/!FluxIQ only.
- Task: complete existing t751 brief and R1-R6 design, auditing partial edits against every worker report first.
- Required reads: hub Current State, t751 original brief, handoff, lane report and subordinate reports; both AGENTS.md and Core code-structure.
- Owns: all files assigned by original t751 brief and wave split, plus new tests needed for those subjects and own recovery report.
- Must not touch: other task trees, main checkouts, shared plan/index/ledger, user edits; no commits/merges/pushes; no paid runs or panel management.
- Definition of done: complete waves 2/3, remove replaced paths, narrow grouped tests/types/audits and headed provider-free site-reset specs pass; report exact gaps and commands.
- Coordinate: no edits to t752/t753 owned files; flag overlaps for supervisor integration. Do not spawn more workers (three slots occupied).
- Report to: docs/working/trace-offline-trials-plan/reports/codex-recover-t751.md in task tree.

### Brief: codex-recover-t752
- Repository: paired fxwork/t752/!FluxIQWebExtension and fxwork/t752/!FluxIQ only.
- Task: complete existing t752 brief; audit partial work against subordinate reports, finish judge/read changes and browser acceptance.
- Required reads: hub Current State, original t752 brief, handoff, lane/subordinate reports; both AGENTS.md and Core code-structure.
- Owns: original t752 assigned files, their tests and authored architecture docs, own recovery report.
- Must not touch: other task trees, main checkouts, shared plan/index/ledger, user edits; no commits/merges/pushes; no paid runs or panel management.
- Definition of done: original acceptance met; grouped Core tests, affected types, audits, prompt contracts, headed provider-free social shape verified.
- Coordinate: flag shared files for supervisor; do not spawn more workers. Rebuild only own paired Core.
- Report to: docs/working/trace-offline-trials-plan/reports/codex-recover-t752.md in task tree.

### Brief: codex-recover-t753
- Repository: paired fxwork/t753/!FluxIQWebExtension and fxwork/t753/!FluxIQ only.
- Task: audit all seven finished worker claims; complete original t753 acceptance and repair defects found.
- Required reads: hub Current State, original t753 brief, handoff, lane/subordinate reports; both AGENTS.md and Core code-structure.
- Owns: original t753 assigned files, their tests and architecture docs, own recovery report; narrow Core apps/web program-route readiness projection and owning test (preserve unknown versus absent keys).
- Must not touch: other task trees, main checkouts, shared plan/index/ledger, user edits; no commits/merges/pushes; no paid runs or panel management.
- Definition of done: grouped tests/types/audits and text guard pass; headed screenshots on two realistic scenarios inspected, limitations explicit.
- Coordinate: flag shared files for supervisor; do not spawn more workers. Rebuild only own paired Core.
- Report to: docs/working/trace-offline-trials-plan/reports/codex-recover-t753.md in task tree.
### Recovery review notes (2026-10-20, supervisor)
- Both main `dev...origin/dev` comparisons initially returned `0 0`; user `.clinerules/fluxiq.md` edit remains untouched.
- Supervisor `git diff --check` in all six task worktrees returned exit 0 before recovery edits progressed; this is whitespace validation only.
- Initial changed-file overlap: t751/t752 Core candidate/contracts.ts and candidate/index.ts. New trial-door edits will require serial integration review.
- Review requests sent to t751: new unidentified project actions must not use legacy admission; source-derived witness stamps must reject model injection.
- Review requests sent to t752: earlier advice is context, never exemption from the task; preserve valid ordering/format/missing-action refusals, absence versus empty defects, and advice older than three trials.
- t753 recovery scope includes its discovered Core apps/web readiness projection bug; retain unknown versus explicitly absent model keys.
- No source unit accepted, merged or pushed yet. Narrow task checks are running in isolated worktrees; no daily full sweep or paid run started.

### 2026-10-21 — Recovery source checkpoints and independent verification
- t753 Core `e4f0e0a2`, downstream `c03a2c65`; task branches now include current dev. Generated reference conflicts
  were regenerated through `docs:reference` (4124 declarations), never hand-edited. Integration review found a
  candidate-less ending could erase earlier whole-run history; bounded regression/fix is Core `df25f02d`.
- t752 Core `534c41fb`, downstream `5f0b26ef`; still awaiting current-dev integration and final headed acceptance.
  Supervisor observed grouped changed-owner gate: 32 files / 362 tests passed, empty real-SQL selection exited 0.
- t751 review additionally found a project trial without a diff spot could inherit legacy settlement, and the real
  brief-ports wrapper dropped the shared admission. Both need their focused regressions and final integration gates.
  Supervisor's migrated two-builder real-SQL test passes, restoring the build's effects before dependent entry and
  preserving the pre-existing cart line. Remaining reset fixtures are not accepted yet.
- No paid execution, full suite, panel management, task merge-back or implementation push during this checkpoint.
  User `.clinerules/fluxiq.md` remains untouched.
