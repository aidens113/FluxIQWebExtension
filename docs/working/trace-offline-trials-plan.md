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
progress. Get it done."

**Boundary audit move plan: complete.** All six phases are merged to `dev` and pushed in both repositories: t726
lane G (phases 1, 3), t727 lane H (0, 5), t728 lane S (2, 4). Ledger in
[extension-core-boundary-audit.md](./extension-core-boundary-audit.md).

**Trace plan: P0-P3 complete, P4 running.** P0 baseline (live trials are 49.8% of build time) and P1 contracts and
the run environment (t729, t734); P2 capture at the client gateway and Core's ingress, on for every Lab live run,
about +11.5% overhead (t736); P3 intake parity: a stored trace replays through Core's own intake, 3,333 of 3,333
saved-Flow delivery points and 4,274 of 6,941 live points matched with honest capture gaps and 0 intake defects
(t742); t745 keyed every content address in a protected project (trace chunks and boundaries, artifacts, manifests,
reusable-context digests), rekeying existing data at open. **Running:** t746 P4 offline trials tier 1 (lane T lead;
gate: T05-T08, T10, T12-T16, T20, T22-T24 and an offline trial reproducing social run-mvfq957o's judged result).
**Next:** P5 offline reads (tier 2), P6 build-loop integration, P7 measure and roll out.

**Breadth reruns: rounds 2-4 passed 0 of 12; every cause was a product defect, each fixed** (t738, t741, t743). t743
(merged) made round 4's three shared weaknesses structural: build-scoped site memory, actionable answers with
`gate_unsatisfiable`, repair before ending, plus each site's causes. **Next:** sync the four lane trees (t563, t719,
t566, t567) and run round 5 on fresh workspaces, supervised at $0.25 each via both `FLUXIQ_LLM_RUN_COST_CEILING_USD`
and `--llm-max-cost-usd`. **t748** fixes t743's open items and two earlier follow-ups in parallel (none was seen live).

**Also merged 2026-10-19/20:** t724 L1 reset settlement; t730 browser specs on the ten realistic scenarios only;
t731-t733, t735, t737; t739 photo-social fixture and build-cache fingerprint; t740 the real-SQL test group (removed
every sweep timeout); t744 sweep-1020b fixes; the root `test` script runs every package (`--no-bail`).

**Daily sweeps:** both 2026-10-20 sweeps are done; the next runs on 2026-10-21.

**Open follow-ups:** all assigned. t747 (running, lead): the content sweep's file-before-row removal, a re-seal job
for a host's key rotation, storage `gateway-trace/` at its 25-file limit. t748: the never-sent node catalog in the size
check, the control name lost on a reloading press, and t743's open items. t737 closed the earlier five.

**Environment:** OneDrive.Sync.Service leaked to 14.4 GB on 2026-10-19 and was restarted with the user's approval; a
monitor alerts above 4 GB or under 4 GB free commit.

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

### Brief: t732-sensitive-capture (worker-high, t732 sensitive-cvc-capture)
- Why: t730 worker C2 (`fxwork/t730-realistic-only-browser-specs/.../reports/t730-c2-bigbox-hooks.md`) confirmed
  in a headed probe that bigbox-retail's checkout "Security code" field (`input[name=cvc]`, in the card frame) leaks
  its typed value into the page snapshot, every recorded keydown and the recorded `dom.input`; and that a checkbox
  marked sensitive only through its group (hook B-1) carries no sensitive marker on the wire descriptor. Typed
  secrets must never leave the page. C1 also found `upload.ts` reporting an inert file input as `disabled`
  (`not_actionable`) where the contract since ba9fea58 says `not_shown`.
- Task: unit 1, find the extension's sensitive-field classification and every capture path it gates (snapshot,
  keydown/input recording, descriptors); make card security codes (name, autocomplete `cc-csc`, labels such as
  "Security code", "CVC", "CVV") and any control inside a sensitive-marked ancestor sensitive by one rule applied on
  every path, tests first beside each subject. Unit 2, the inert file input reports `not_shown`, test beside it.
- Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t732/!FluxIQWebExtension` (own Core, read-only).
- Owns: the classification module(s) and capture paths it leads to under `apps/extension/src/content/**` and
  `apps/extension/src/shared/**`, `upload.ts`, their `tests/`.
- Must not touch: L1's files (`git -C C:/Users/osrs_/FluxStuff/fxwork/t724/!FluxIQWebExtension status --short`,
  which include `shared/dom-element.ts` and `content/dom-snapshot.ts`): if the fix must go there, stop and report
  the exact change; `apps/extension/e2e/**` (t730); Core.
- Validation: tests beside each change; extension `tsc` src and test; structure audit; a headed provider-free probe
  on bigbox-retail's checkout (script in your scratchpad, not the tree) showing the typed code absent from snapshot,
  keydown and input events.
- Report: `docs/working/trace-offline-trials-plan/reports/t732-sensitive-capture.md` in the t732 tree, with
  `UNIT READY` markers. No commits; never write a typed value into logs or the report.

### Brief: t733-content-runtime-fixes (lead, t733 identity-capture-cost)
- Why: three product defects found while moving specs onto realistic sites. (1) Identity capture cost: per snapshot
  element, `content/identity/control-row.ts` `recordIdentity`/`recordSubject` run up to three walks of 2,000 nodes
  with `accessibleNameFor` each (6db9ca04, 2026-10-12; 62eb9b41, 2026-10-17): a 6,000-anchor page takes 372 s, about
  4 s on 2026-09-12 (`t730-c3-everything-store-hooks.md`); likely behind photo-social `extract_list` stalls. (2) The
  wire descriptor carries no sensitive marker for a control sensitive only through its group (`t732-sensitive-
  capture.md`, open question 2: the exact change in `shared/dom-element.ts` and `accessible-name.ts:104`). (3) A click
  answers "changed in place" before fetched rows land: `content/action-runtime/in-place-effect.ts` settles while a
  region it saw change is `aria-busy="true"` (`t730-realistic-specs.md`, click.spec.ts:524 analysis).
- Task: one unit each, partitioned by file, tests first. (1) Restore capture cost to seconds without losing what the
  two commits added (memoize or bound the walks per snapshot, one shared pass); add a cost test that fails on the
  regression. (2) The marker on the wire, one rule with the domain's descriptor reader. (3) `watchInPlaceEffect`
  waits, within its existing window, until busy regions it saw change clear (reuse `content/evidence/loading.ts`).
- Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t733/!FluxIQWebExtension` (own Core, read-only).
- Owns: `apps/extension/src/content/identity/**`, `shared/dom-element.ts`, the accessible-name module,
  `content/action-runtime/in-place-effect.ts`, `content/evidence/loading.ts`, domain `sensitivity/descriptor.ts`, tests.
- Must not touch: `apps/extension/e2e/**` (t730), `apps/scenario-lab/**`, Core, lane S's files.
- Validation: tests beside each change; extension and domain `tsc`; structure audit; headed on realistic sites:
  large-page-resolution rows 1-2 within their budget, click.spec.ts:524 green five runs in a row, and the measured
  capture time of a large realistic page before and after.
- Shared lane rules apply. Report: `docs/working/trace-offline-trials-plan/reports/t733-content-runtime-fixes.md`.

### Brief: t734-trace-consumer-wiring (lane T lead resumed, t734 trace-consumer-wiring)
- Why: P1's consumer wiring (U7) waited for L1, which merged (Core bcb2c0ec, downstream c375501a).
- Task: the remaining-wiring table in `trace-offline-trials-plan/reports/lane-t.md` (on `dev`): the executor,
  evidence loop and trial runner go through the environment port (clock plus channel scope, decision D3), so live or
  offline is configuration, never a second code path; live behaviour unchanged and proven by the existing tests.
  Lane S's lifecycle accessor may become the explicit request field if `binding.ts`/`evidence-loop.ts` allow it now;
  coordinate through the supervisor, since t728 is not yet merged.
- Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t734/` (both repositories, own Core).
- Validation: Core tests beside each change and the flow-bootstrap, llm, project-build and candidate-trial
  directories; fluxiq `tsc`; both audits; prompt contract tests if any model-facing text moves.
- Report: `docs/working/trace-offline-trials-plan/reports/lane-t-u7.md` in the t734 downstream tree.

### Brief: t735-sync-core-bootstrap (worker-high, t735 sync-core-bootstrap)
- Why: since t727, `pnpm task sync-core`, whose purpose is to move an outdated shared Core to Core's dev, fails on
  exactly that Core ("has no scripts/build-cache/build-cache-for.mjs: that Core predates the shared tooling"),
  thrown at import time from `scripts/core-scripts/import-core-script.mjs` via `scripts/build-cache/core-engine.mjs`;
  the supervisor moved the shared Core by hand. The four live-lane trees' Cores predate t727 too.
- Task: every command that brings a Core up to date (sync-core, the shared-Core move in `task start --worktree`) works
  against a Core that predates the imported tooling: no Core engine import before the move; the move uses only code
  shipped downstream or the moved Core's own scripts afterwards; every other command keeps the "predates" refusal.
  Tests first, including sync-core against a fixture Core lacking `build-cache-for.mjs`.
- Owns: `scripts/task/**`, `scripts/worktree/**`, `scripts/core-scripts/**`, the bootstrap path in
  `scripts/build-cache/**`, their tests. Never runs against the real shared Core or a lane tree.
- Report: `docs/working/trace-offline-trials-plan/reports/t735-sync-core-bootstrap.md` in the t735 tree.

### Brief: t745-keyed-content-addresses (lead-xhigh, Core security)
- Why: lane T (P3) found that Core's content store and trace chunks are addressed by an unkeyed SHA-256 of their
  contents, so anyone holding a project database can tell equal content apart and confirm a guess about it. Known
  security weaknesses are fixed, not deferred.
- Task: keyed (HMAC) addresses for the whole content store and trace chunks, keyed from the project's existing protection
  key material; reads accept both forms during a tested, idempotent migration that rekeys existing stores in place and
  removes the unkeyed form only after every reference resolves; deduplication still works within a project; no
  content ever logged. Design note first (in the report): key source and rotation, migration order, failure and rollback.
- Validation: tests beside each change (fresh store, migrated store, interrupted migration resumed, cross-project
  isolation, a guessed-content probe that no longer confirms); Core typecheck; audit; real-SQL marker on tests that open
  SQLite.
- Report: `docs/working/trace-offline-trials-plan/reports/t745-keyed-content-addresses.md` in the downstream tree.

### Brief: t748-build-loop-followups (lead-xhigh, Core and downstream build loop)
- Why: t743's open items and two earlier follow-ups are weaknesses a live build can meet; none was seen in round 4's
  runs, so round 5 runs on t743 while these are fixed (their debugs may add to this list).
- Task, partitioned by file (serial where two share one):
  1. Domain: a dialog view and a standalone page at one address share one view in the target-packet store, so a Flow
     that opens the dialog and presses a handle last shown on the standalone page can fail `web.target.ambiguous`.
     Choose the view a step stands on from the step before it, or key handles per document. t743's reverted attempt
     (`reports/t743-d5-view-alias.md`; patch `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad/t743-d5-view-alias.patch`) broke a passing spec: find why
     first.
  2. Core site reset: an `undo` reason no call can meet is detected in general (an act whose differing list has no
     admissible undo becomes `gate_unsatisfiable` with its condition named), not left to the repeat guard.
  3. Core trial feedback: a read step is labelled with the words it read, not the words captured before a change;
     a press that reloads the page keeps the control's name.
  4. Core LLM request size: the pre-provider size check counts only what is sent (the node catalog is counted though
     never sent; t744 worked around it in a test).
  5. Assess and fix where real: office debug C5/C6 (baselines on unrelated lists; "press again with this ref"); a
     looped trial act's pass named in `trialRan`; `refused-repeat.ts` carrying the last refusal code; t738's open
     points (the ending filter that drops part-level test claims; the reset-witness rule for unscoped presses and a
     lone `create_new`; the job spec's wrong-job undo check).
- Not: t746's files (Core `runtime/environment/**`, `runtime/gateway-trace/**`, `client-gateway/**`, executor
  contracts/graph-run/region-execution, `runtime/index.ts`, `service/offline-trial/**`, `model/offline-trial/**`) or
  t747's (`storage/project/**`). If a fix needs one, stop and report.
- Validation: each fix fails first; tests beside each change; Core prompt contract tests when model-facing text
  changes (no realistic task mirrored); touched typechecks; both audits; headed provider-free reproductions on the ten
  realistic scenarios where a fix changes browser behaviour, plus the `e2e/site-reset` specs.
- Report: `docs/working/trace-offline-trials-plan/reports/t748-build-loop-followups.md` in the downstream tree.

### Brief: t747-storage-followups (lead, Core project storage)
- Why: t745's notes 3-5 name three pre-existing gaps in Core's project storage; known integrity and security gaps are
  fixed, not deferred.
- Task: (a) `sweepUnreferencedObjects`, and any other path that removes a content file before its row, removes the row
  first through t745's pending-removal pattern (`object_pending_removals`, drained at every content store open), so a
  writer racing a sweep never loses a file; (b) a re-seal job: when a host rotates or retires its content protection
  key, every sealed item (content-store objects, trace chunks, sealed manifests, reusable contexts, the wrapped address
  key) is re-sealed under the new key, resumable after a crash, and the old key is released only after it finishes; the
  host-facing protection API states that order; (c) a structural decision for storage `gateway-trace/` (25-file hard
  limit, a subdirectory breaks the path-depth limit) applied now with callers switched in the same unit and the
  `storage/project` barrel exports unchanged.
- Owns: Core `packages/fluxiq/src/programs/automation-studio/storage/project/**` and tests, the content protection type
  and host binding if (b) needs them, `docs/architecture/automation-studio/persistence.md`, the regenerated framework
  reference. Not: `runtime/gateway-trace/**`, `client-gateway/**` (t746) or any file t743 changes. A migration takes the
  next free number after 0035.
- Validation: each fix fails first; storage/project tests and t745's consumer list; fluxiq `tsc`; Core audit;
  `pnpm docs:check`; real-SQL marker on tests that open SQLite.
- Report: `docs/working/trace-offline-trials-plan/reports/t747-storage-followups.md` in the downstream tree.

### Brief: t746-offline-trials-tier1 (lane T lead, trace plan P4)
- Plan of record: Core `docs/working/trace-offline-trials-plan.md` P4: the production executor runs against a trace
  environment (the t734 port), strict operation matching (action type, target fingerprint, arguments, occurrence,
  preceding operations), a virtual clock, explicit evidence gaps.
- Gate: source tests T05-T08, T10, T12-T16, T20, T22-T24, and an offline trial of a corrected candidate for the breadth
  round's social failure (run-mvfq957o-40103539) reproduces the judged result. Offline trials stay out of exploration
  and never satisfy the whole-run gate (decisions 2 and 3).
- Report: `docs/working/trace-offline-trials-plan/reports/lane-t-p4.md` in the downstream tree.

### Brief: t743-rerun4-structural (lead-xhigh, t743 rerun4-structural)
- Why: four rerun rounds, 0 of 16, each failure a new shape; round-4 debugs name three shared weaknesses. Debug
  notes (lane trees, `docs/working/language-driven-flow-loop-plan/debugs/`): t563 run-mvgvyaip-d856e135 office, t719
  run-mvgw1854-5d10955b job, t567 run-mvgw7320-de416190 photo (social pending; the supervisor forwards it).
- Unit S1, one build-scoped site memory: places, shown addresses and issued lists belong to the build, not the brief
  (domain `shown-addresses.ts`, `run.ts`, Core brief seeding); Core-framed reset looks are exempt from the shown-address
  rule; A1's witness adoption is limited to lists the act could have changed (office).
- Unit S2, an actionable-answer contract: every gate refusal names the condition that failed and whether any call on
  the page can meet it; when none can, the act leaves `actsToUndo` with a closed `gate_unsatisfiable` reason and the
  brief is offered an honest exit (job, photo); `undo-admission.ts` answers "already back" closed (photo).
- Unit S3, repair before ending: with money left, the supervisor's completion refuses an ending until each failed
  subflow has had one changed brief, unless the failure reason is closed and terminal (`completion.ts`, photo).
- Unit S4, specific defects: a read target's identity does not include the text it reads
  (`plan-resolution/element-identity.ts`, office); a looped save's pass row reaches `inspectStateDiff` and the control
  resolves in that row (Core `executor/host-state.ts`, domain `state-diff/places/diff.ts`, job); when Core's own look
  cannot restamp a group, the group is unreachable and a toggle act whose undo landed settles restored, the judge told
  (`ledger.ts`, `settlement-group-witness.ts`, `create-baselines.ts` wording, photo); a press the page reports as failed
  is not counted as succeeded (job, trace it).
- Rules: generic guidance only, never shaped like a realistic task; prompt contract gate tests; provider-free headed
  reproductions of each shape in `apps/extension/e2e/site-reset` with a scripted provider; usual lane rules.
- Report: `docs/working/trace-offline-trials-plan/reports/t743-rerun4-structural.md` in the t743 downstream tree.

### Brief: t742-trace-intake-parity (lane T lead, trace plan P3)
- Plan of record: Core `docs/working/trace-offline-trials-plan.md` P3 (traces fed through the same ingress; a parity
  harness over real Lab traces from all ten realistic sites; gate: the original run matches at every delivery point).
- Task: a harness that replays a stored trace through Core's own client-gateway intake (no second code path) and
  compares, at every delivery point, what Core received and derived against the original; traces from provider-free
  saved-flow replays on all ten realistic sites (tracing is on by default since t736), plus any live round-4 traces;
  every divergence classified (capture gap, nondeterminism, intake defect) and fixed at its source or recorded as an
  explicit evidence gap. Also: the start hook lands in the build's trace (t737's `run.ts` is merged), and stored event
  JSON (92-96% of bytes, ~34 MB per run) stores repeated content once.
- Rules: traces never feed model guidance; no page data, tokens or typed secrets in logs or reports; usual lane rules;
  provider-free, headed, realistic scenarios only; no paid runs.
- Report: `docs/working/trace-offline-trials-plan/reports/lane-t-p3.md` in the task's downstream tree.

### Brief: t741-rerun3-fixes (lead-xhigh, t741 rerun3-fixes)
- Why: rerun round 3 went 0 of 4, each run further than round 2 and every cause a product or generic-guidance defect.
  Debug notes (lane trees, `docs/working/language-driven-flow-loop-plan/debugs/`): t563 run-mvgo5xft-25460ba2 office,
  t719 run-mvgo9wzn-fad4e050 job, t566 run-mvgoawg4-ed85dd5a social, t567 run-mvgobp8h-b99ede98 photo. Read all four.
- Unit A, reset settlement (Core site-reset, reset calls, ledger, loop budget): structural, not another shape patch:
  Core settles trial and entry-preparation acts that sit in no list itself (office's address confirm); a settling look
  reports what it settled and every open act across the build; `reset_acts_in_place` and the witness refusal list the
  open acts and issued references; a look that names a reset destination without `undoes` gets a note; the candidate
  wrap-up no longer refuses the undo calls a trial demands (`loop-budget.ts` `withholds`, photo).
- Unit B, plan, script and brief (Core): one port-name rule shared by plan and script (`item`, office); the script
  format names `extractList.sort` beside the `where` line with a generic example on another kind of site, and a
  process sort or limit on a listing whose repeat makes a lasting act is refused (photo); the supervisor's recording
  excerpt reaches the builder's opening words (`run-brief.ts`, photo); scoped `unchanged_submission` refusals carry
  translated digests and a stable revision (`submission-numbering.ts`); endings tell the truth (photo's "a like
  remains", job's repeated sentence).
- Unit C, domain and extension: the retry wrapper reports an earlier rate-limited failure with its retry-after over
  later failures (`node-run/retries/dispatch.ts`, job); `markRenumbered` marks only when `navigation.timeOrigin` changes
  (`plan-resolution/target-packets.ts`, social); `incomplete_text` names the field and its hint says to read the list
  again after the presses (`refusal.ts`, `next-sentence.ts`, social); `find_on_page` with no match names the page's
  wordless icons (`page-find/search.ts`, job).
- Unit D, judge guidance (Core, generic only): a feed's continuation past its end marker is not rows missing from the
  task's range, and repeated identical advice is not repeated to the builder (social); never mirror a realistic task.
- Rules: model guidance generic and never shaped like a realistic task; prompt contract gate tests for any model-facing
  text; provider-free reproductions where feasible (site-reset installed-gateway specs); usual lane rules; no paid runs.
- Report: `docs/working/trace-offline-trials-plan/reports/t741-rerun3-fixes.md` in the t741 downstream tree.

### Brief: sql-test-pool (worker-high, Core vitest isolation for real-SQL tests)
- Why: every daily sweep produces a different set of 15 s timeouts in Core's heavy real-SQLite tests (S1, sweep-1019b,
  sweep-1020: canonical-authority, database-manager, controller, command-execution service, provider-unavailable,
  flow-index-read, ...): they pass alone in about a second and run 8 to 15 times slower inside the full package run
  (t731 and t739 reports). Rerunning each set is the patch; the structural fix is isolation.
- Task: in the Core worktree, give the real-SQL integration tests their own vitest project (or pool) with low
  concurrency so the full `pnpm test` never starves them, selected by a rule (path or a marker) that new tests follow
  without a list to maintain; `pnpm test` and `vitest run <path>` keep working; no timeout raised, no test skipped.
  Document the rule in Core's testing docs and AGENTS.md if it states where tests run.
- Validation: run the previously timed-out files together under the new pool and alone; run the whole
  `packages/fluxiq` vitest once at the end and report its duration and failures (one full package run is allowed for
  this change); both audits.
- Report: `docs/working/trace-offline-trials-plan/reports/sql-test-pool.md` in the task's downstream tree.

### Brief: t739-sweep-1020-fixes (lead, t739 sweep-1020-fixes)
- Why: sweep-1020 (`reports/sweep-1020.md`, logs `fxwork/sweep-1020/logs/`, Core ca23a8ba, downstream 6dd2d724).
- Task, partitioned by file, root causes only (never raise a timeout or loosen an assertion): (1) scenario-lab
  photo-social: the newest-likes scenario test fails a real assertion (the liked list misses one expected post) and
  the Glaze collection test times out on a close-dialog click; find whether a recent change (t730's photo-social
  `saved-logins` mode, t733, L1) or the test is wrong, and fix that side. This gates rerun round 3, since
  photo-social-newest-likes is one of its tasks. (2) Core fluxiq: four new 15 s timeouts (controller,
  command-execution service, provider-unavailable, flow-index-read): rerun each alone and in its directory, fix
  real causes, record environmental ones with evidence. (3) downstream `scripts/build-cache/tests/registry.test.mjs`:
  `git check-ignore` "empty string is not a valid pathspec"; fix if real, show it is worktree-specific if not.
  (4) Run the extension package tests (cut off in the sweep) and agent-orchestrator's absence is expected (deleted in
  t727); fix anything that fails.
- Report: `docs/working/trace-offline-trials-plan/reports/t739-sweep-fixes.md` in the t739 downstream tree.

### Brief: t738-rerun2-fixes (lead-xhigh, t738 rerun2-fixes)
- Why: breadth rerun round 2 went 0 of 4, every cause a product defect (debug notes, one per lane tree, under
  `docs/working/language-driven-flow-loop-plan/debugs/`: t719 run-mvgf4pk5-55343613 job, t563 run-mvgf04kw-310fc169
  office, t566 run-mvgf7ij5-a9747575 social, t567 run-mvgf801u-cc23575e photo). Read all four first.
- Unit A, reset witnesses and trial acts (Core `flow-bootstrap/site-reset/**`, `service/candidate-trial/landed-acts.ts`):
  before the seal, refuse without running any reversible press with no witness (no complete list it sits in, no
  stated control state, no issued reference), as `create_new` already is (job; office's address step); settle words
  never ask for a reference that cannot exist and never print "[withheld]"; an invented `resetDestination` is refused
  explicitly, not ignored; trial acts are built from the in-memory trace before withholding (photo).
- Unit B, script format (Core `nodes/data` write-records, `flow-bootstrap/authoring/locate-issue.ts`,
  `draft-routing.ts`): write-records takes a `records` parameter of `$step` values with a derived schema and a generic
  example; key-named node issues point at their own step; the loop-in-loop refusal points at the inner loop and names
  the `NO_ROW_LOOP_IN_PAGE_LOOP` alternative (office, social).
- Unit C, loop feedback and trial views (Core `llm/repeat-guard/candidate-feedback.ts`, `subflow-candidate/builder-loop.ts`,
  activity/chat wording): "test it" for an unchanged submission; `core.test_subflow` answers wrapped in the
  candidate-trial view so they carry the page; a refused test says where it moved the tab; trace and fix
  `unexpected_input_keys` on later briefs' opening calls (office); the final chat message and "one more change" tell
  the truth (office, job).
- Unit D, downstream (`rejection-next/next-sentence.ts`, `output-nodes/definitions.ts`, the refusal that drops keys):
  the cut-short hint says "load every row first, then loop over one read"; `scroll` gets a description and example;
  the refusal names the bad keys (social).
- Rules: model guidance never mirrors a realistic task, site, product or answer (examples use another kind of site);
  prompt contract gate tests when model-facing text changes; provider-free reproductions of each shape (the
  site-reset installed-gateway specs with a scripted provider where the shape is a reset one); usual lane rules; no
  paid runs (the supervisor reruns live).
- Report: `docs/working/trace-offline-trials-plan/reports/t738-rerun2-fixes.md` in the t738 downstream tree.

### Brief: t736-trace-capture (lane T lead, t736 trace-capture)
- Plan of record: Core `docs/working/trace-offline-trials-plan.md` P2, with decisions D1-D7 in `reports/lane-t.md`.
- Task: Core lane: capture at the client gateway into the workspace's existing store, through the same intake it uses
  live, with indexed reads and explicit completeness, secret screening before storage, and capture of the ingress that
  bypasses the gateway (D1: chat, asks, run control, screenshot upload, start hook) where Core accepts it. Extension
  lane: in-band artifacts for anything Core later dereferences; page snapshots by DOM serialization plus resource map at
  each observation and read in tracing mode, Chrome and Edge first; the offline queue's flush carries each entry's
  original envelope id and timestamp. The Lab turns tracing on for every live run. Gate: source tests T01-T04, T11,
  T14, and overhead measured provider-free on four realistic tasks.
- Rules: traces never feed model guidance; no recorded page data, tokens or typed secrets in logs or reports; the
  usual lane rules; narrow checks; no paid runs.
- Report: `docs/working/trace-offline-trials-plan/reports/lane-t-p2.md` in the t736 downstream tree.

### Brief: t737-session-followups (lead, t737 session-followups)
- Task, one unit each, partitioned by file: (1) the shared extension fixture's teardown and the missing hello after a
  service-worker restart (`apps/extension/e2e/fixtures/extension-context.ts`, background start path): root-cause both
  (lane G's evidence in `extension-core-boundary-audit/reports/lane-g.md`) and make reconnect.spec.ts `:85`/`:122` green
  five runs in a row, without raising waits; (2) `shown-addresses` values that exceed Core's 64 KiB per-value limit are
  stored durably (split or bounded), never kept only in process; (3) `scripts/lab/**/summarize-task.mjs:39`'s repair
  call count, with a test; (4) the repository scan covers every browser test in the repository (packages included);
  (5) Core emits a reset span inside `core.test_subflow`/`core.test_candidate` so the build-time baseline can measure
  resets inside trials.
- Report: `docs/working/trace-offline-trials-plan/reports/t737-followups.md` in the t737 downstream tree.

### Brief: lane-sync-1020 (worker-low, live lane trees to dev before the breadth rerun)
- Trees: `C:/Users/osrs_/FluxStuff/fxwork/{t563,t719,t566,t567}/{!FluxIQWebExtension,!FluxIQ}`, each on its own lane
  branch, clean, and strictly behind `dev` (nothing ahead).
- Task, per tree: `git merge --ff-only dev` in both repositories; `pnpm install --frozen-lockfile` in both (the
  lockfile changed); in Core, `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket
  build`; downstream, `node scripts/check/core-build.mjs` must say current, then
  `pnpm --filter @fluxiq-web-extension/extension build`. One tree at a time (memory).
- Must not: run any Lab or live run, edit files, commit, or touch other trees or `lab-slots`.
- Report: `docs/working/trace-offline-trials-plan/reports/lane-sync-1020.md` (main checkout): per tree, both HEADs
  after the merge and each command's exit code and last line.

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

### 2026-10-19 - Lane T P0 complete and P1 to the L1 stop point, committed on t729
- Agent: supervisor (lane-t and workers U2a, U2b, U3, U4, U6, U8)
- Changed: Core b529bd02 (`client-gateway/trace/**` contract, `client-gateway/service/channel-scope/**`, bridge
  `attachScopedSession`/`isScopedSession`, `runtime/environment/**` port and trace-fed fixture); downstream 791bb235
  (`apps/extension/e2e/content/tests/snapshot-fidelity/**`, reports u2a-u8).
- Findings: a DOM serialization with a resource map, reloaded with scripts and network off, matched live reads and
  sampled targets on all four sites tried (MHTML did not), so P2 captures that way; P1's single environment port
  is really a clock plus a gateway channel scope (D3), and the chat, asks, run control, screenshot upload and start
  hook bypass the gateway and need capture where Core accepts them (D1). Possible defect: photo-social
  `web.dom.extract_list` stalled over 4 minutes in 2 of about 6 spike runs.
- Validation: supervisor reruns in t729: Core `pnpm exec vitest run src/client-gateway
  src/programs/automation-studio/runtime/environment src/programs/automation-studio/client-gateway
  src/programs/automation-studio/model/offline-trial` -> 42 files, 303 tests passed; `npx tsc --noEmit -p
  tsconfig.json` (fluxiq) -> 0; Core audit passed (1152 baselined); extension `tsc -p tsconfig.test.json` -> 0;
  downstream audit passed (638). The spike's headed run (lead, 20:17, after the memory fix: 4 passed, 0 requests
  leaked, 0 page scripts run) was not repeated by the supervisor.
- Outcome: Accepted (P0; P1 contract and port)
- Follow-up: U7 consumer wiring after L1 merges, as a new task; the extract_list stall needs a trace.

### 2026-10-19 - L1, t732 and t731 merged; t733 and t735 verified on their branches
- Agent: supervisor (L1 lead and workers; t732, t731, t733, t735 workers and leads)
- Changed: t724 L1 merged (Core bcb2c0ec, downstream c375501a); t732 security fix merged (downstream, with the
  sensitive-values doc updated by the supervisor); t731 merged (Core 2737ad56: canonical-authority, flows creation and
  database-manager tests do only their subject in the timed body; no source changed). t733 (capture cost, group
  sensitive marker, in-place busy race) and t735 (sync-core bootstrap) committed or verified on their branches.
- Validation: L1 merged tree: Core `vitest run` over flow-bootstrap, project-build, candidate-trial, subflow-trial,
  project-agents, action-permissions, llm -> 543 files, 5486 passed, 2 skipped; fluxiq `tsc` 0; downstream checks 0;
  changed domain 71, extension 14 pass; headed `playwright test -c e2e/playwright.config.ts e2e/site-reset` -> 6
  passed (4.5m); after t732 merged in: extension content+shared 1469 pass, domain 1350 pass, four `tsc` 0. t732:
  four `tsc` 0, extension content+shared 1460 pass, domain sensitivity+recording 121 pass; the worker's headed probe
  showed the code absent with the fix and present with the old classifier. t731: 14 files / 106 tests passed on its
  branch; after merging dev, one combined run showed 2 owner-store failures, then the canonical-authority directory on
  dev with t731 -> 59/59 three times, and on the pre-t731 commit -> factory-provenance failed (the test t731 fixed).
  t733: four `tsc` 0; extension identity, action-runtime, evidence, shared, connection -> 1030 pass; domain
  sensitivity 27 pass; audit passed; lead's headed runs: large-page rows 1-2 in 12.7 s and 9.0 s (were 30 s timeouts),
  click.spec.ts:524 5 of 5 (was 1 of 5), a 6,000-link snapshot 3,917 ms (was 303,764 ms). t735: script tests 171
  pass; audit passed; the fixture sync-core test failed before the fix with the reported error.
- Supervisor error: the t731 finish was chained after its recheck without gating on the result, so it merged and
  pushed Core despite the 2 failures; the follow-up runs above show t731 is sound, but merges are gated from now on.
- Outcome: Accepted
- Follow-up: merge t733 after its doc/runtime-status unit; merge t735 after t730's combined run (shared Core).

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

## Open Questions

None requiring user input.
