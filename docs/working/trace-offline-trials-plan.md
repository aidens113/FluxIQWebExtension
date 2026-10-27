# Traces And Offline Trials (Extension Side)

Status: Paused
Status detail: User stopped all work; t753/t752 pushed, t754 downstream-only local merge, t751 final corrections preserved.
Created: 2026-10-19
Last updated: 2026-10-21
Owner: Senior supervisor agent
Scope: Execution hub for the traces/offline-trials plan and the extension/Core boundary audit's move plan, plus this repository's own part of the trace plan (in-band artifacts, page snapshots, the offline queue fix, the domain's offline read/target resolver). Core owns the trace contract, store, offline-trial runner and build-loop integration.
Paired document: `docs/working/trace-offline-trials-plan.md` in FluxIQ Core (plan of record)
Related: [extension-core-boundary-audit.md](./extension-core-boundary-audit.md) (audit findings and move plan), [breadth-forty-tasks-plan.md](./breadth-forty-tasks-plan.md) (paused breadth round, L1)

---

## Current State

**RESUMED (user, 2026-10-27): "get this MVP done"; there is no feature freeze.** Follow the resume sequence in
[the Codex handoff](./trace-offline-trials-plan/reports/handoff-2026-10-21-codex.md) (step 1 done).
The original [Claude handoff](./trace-offline-trials-plan/reports/handoff-2026-10-20.md) remains historical context.

**Publication boundary:** t753, t752 and t754 are merged and published in both repositories (t754 Core finish
2026-10-27). t751 retains five uncommitted Core files plus preserved reports in its paired worktrees. Final
corrections pass their focused gates, but no complete current-code reset build/browser acceptance exists. Next:
handoff steps 2-6 for t751 (review and checkpoint the dirty files, integrate current dev, final gates, headed
site-reset specs, finish), then P6. Live rounds have not started.

**Recovery checkpoint (2026-10-21):** t753 is verified and merged in both repositories (downstream `daabd593`,
Core `d1c39c0a`). Post-merge narrow gates passed, with provider-free Chromium (12) and Firefox (2) rendering cases
and supervisor-inspected full-panel screenshots; the supervisor also independently passed the 82 overlay unit cases.
t752 is verified and merged (downstream `4da5947c`, Core `149ba69e`): strict grounded negative judgements, retained
advice, kept-row disclosures and explicit inert-snapshot gaps. Final owning/types/build/audit gates passed; headed
social5/5 and offline gap1/1 passed. The supervisor independently reviewed source, changed-owner362tests and
offline reevaluator22tests; Core finish additionally passed68 mandatory prompt-contract tests.
t751 source is checkpointed (Core `b5a9efcd`, downstream `9bb8ad87`) and integrating accepted dev before final
owning/build/browser gates. Independent retained-witness36, exploration46 and merged service11tests passed,
including absent diffs, resource collisions and a custom effect's honest undo cycle. P6 remains gated on t751.
t753 and its documentation are pushed; paired t752 ledger/baseline updates accompany its implementation push.
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
on judge consistency (an exact answer judged no) and read speed. **Recovered:** t752 judge/read and t753 UI are merged;
t751 reset is in final integration. Round 6 only
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

**Package exports:** t754's final integrated owning gates all passed, including 31 real help commands and exact
3 Core + 35 downstream baseline removals. Finished in both repositories (downstream `54d27653`, Core finish
2026-10-27) and published together. P6 still waits for the reset merge.

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

Earlier settled evidence: [17 archived ledger entries](./trace-offline-trials-plan/archive/2026-10-21-recovery-ledger.md).

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

### 2026-10-21 — t752 judge/read recovery accepted
- Agent: supervisor, recover_t752
- Changed: grounded current negative defects, immutable request/advice history, answer-only counts, automatic kept-row disclosure and later-row control detection; unsupported inert disclosure is an explicit gap. Downstream merge4da5947c; Core149ba69e.
- Validation: grouped Core owners315parallelfiles/2463tests initially2461pass+2stale assertions; corrected owning rerun2files/7pass; real-SQL1file/3pass. `tsc`0, stamped3library build0, domain768/768 and extension595/595, package checks0, both audits0, docs:check current, Core freshness0. Supervisor independently passed changed-owner362 and offline reevaluator22 tests and reviewed final source/logs.
- Validation: headed Chromium content harness social3specs/5tests pass; offline-gap1test pass after fixture-only setup correction, actual liveA/control parity and liveB success, inert incomplete_text,0leaks, dynamic_content gap. Core `pnpm.cmd task finish t752 "Ground negative judge findings in measured rows" --skip-checks` independently passed3mandatorycontractfiles/68tests; downstream task finish audit passed. Full suite not repeated.
- Outcome: Accepted. Exact commands, counts and external evidence in reports/codex-t752-integration.md; no Firefox or paid packaged-extension acceptance claimed.
- Follow-up: paired ledger/baseline push; final t751 combined gates, then P6. No paid run or panel management performed. User .clinerules edit preserved.

### 2026-10-21 - Compact settled recovery ledger
- Agent: supervisor
- Changed: moved17older ledger entries to archive/2026-10-21-recovery-ledger.md, retaining current facts and recent recovery/acceptance entries here.
- Why:20entries had reached the protocol limit; the next accepted unit must not exceed it.
- Validation: strict UTF-8 round-trip comparison passed; text preserved apart from two relative report link targets. The owning check flagged the now-stale index; `node scripts/structure-audit.mjs --update --rule working-docs` regenerated it, native0 with unchanged651baseline; `--rule docs-links` passed0warnings/0baseline.
- Outcome: Accepted (documentation); no source, test, generated reference or package input changed.
- Follow-up: reset combined gate correction, final build/browser acceptance, then P6.

### 2026-10-21 - User requested stop and handoff
- Agent: supervisor
- Changed: paused both paired plans; preserved exact pushed/local/uncommitted boundaries in reports/handoff-2026-10-21-codex.md and the task reports.
- Validation: process inspection found zero task-owned node/browser processes; all three agents stopped/interrupted. Final facade gate had already passed11tests before stop; no new test/build/integration followed the request.
- Outcome: Paused by user. t753/t752 pushed; t754 downstream local merge only, Core finish pending; t751 five dirty Core files preserved. No post-stop implementation push.
- Follow-up: wait for explicit user resume; never publish the pending downstream t754 half alone.

### 2026-10-27 - Resumed; t754 finished in Core and published with downstream
- Agent: supervisor
- Changed: user resumed the MVP work and removed the feature freeze from every plan (both repositories). Core `pnpm task finish t754 "Replace private build path loads with package exports" --skip-checks` merged the paired task after detaching its clean worktree.
- Validation: the finish's mandatory contracts: "Test Files 3 passed (3)", "Tests 68 passed (68)". `pnpm structure:check` after the merge: Core "passed (443 warning(s), 1152 baselined)", downstream "passed (222 warning(s), 616 baselined)" (the earlier downstream `package-exports` failure on arrival.test.ts is gone). `pnpm install --frozen-lockfile` in both main checkouts: "Done". Four switched downstream launchers (`lab/live-campaign/selection.mjs`, `lab/scenario-guard/lab-scenario-refusal.mjs`, `record-demo-workspace.mjs`, `run-demo-workspace-flow.mjs`) `--help` exit 0; Core `flow-compiler.mjs --help` printed usage.
- Outcome: Accepted; both dev branches published together.
- Follow-up: handoff steps 2-6 for t751, then P6.
