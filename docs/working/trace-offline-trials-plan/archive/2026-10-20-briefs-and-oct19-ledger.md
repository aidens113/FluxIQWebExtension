# Traces And Offline Trials: Archived Briefs And 2026-10-19 Ledger

Moved from [trace-offline-trials-plan.md](../../trace-offline-trials-plan.md) on 2026-10-20 when it passed the
800-line compaction threshold. Every brief here is finished and merged; its outcome is in the hub's ledger or below.

## Archived Worker Briefs

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

## Archived Ledger (2026-10-19)

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

