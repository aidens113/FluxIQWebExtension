# 2026-09-12 finish-Week-1 ledger entries, first part

Archived verbatim from the plan's Work Ledger on 2026-09-12 by the session that
finishes Week 1, when the plan reached 913 lines. Every entry here is settled
and its work committed.

### 2026-09-12 — Finish-Week-1 session: first dispatch

- Agent: supervisor
- Changed: new `briefs/finish-week1.md`; this ledger.
- Why: Next steps 1-2. No other Claude session was running, so Core's
  uncommitted trace withholding was taken over (Core ledger). Nine workers,
  partitioned by file: five fixes, the read-only `c-remaining` inventory, and
  three read-only investigations so later briefs need not wait on it.
- Validation: `git status -sb` in both trees -> `## dev...origin/dev`. Grep for
  `webAutomationSecretBindingPath` outside `output-nodes/` -> no use in
  `input-model.ts` or `gateway-mapping.ts`: W18 edits 1-3 had not landed.
- Outcome: In progress
- Follow-up: verify each report before accepting it.

### 2026-09-12 — f-test-runner-ratchet: already settled at HEAD

- Agent: worker `f-test-runner-ratchet`; verified by supervisor.
- Changed: its report only; `ab736a1` had moved the feature into
  `src/demo-llm-create-ui/` with its own `tests/`.
- Validation: `git ls-files packages/test-runner/src/tests` -> 50 files, none
  `demo-llm-create-ui`; `.structure-baseline.json:21` -> 50.
- Found: this document had passed 800 lines; the previous session's ledger
  entries moved verbatim to `archive/2026-09-12-handoff-ledger.md`, and D13-D14
  to `archive/2026-09-12-decisions-d13-d14.md`.
- Outcome: Accepted

### 2026-09-12 — f-evidence-producers: already settled at HEAD

- Agent: worker `f-evidence-producers`; verified by supervisor.
- Changed: `domain/src/page-evidence/types.ts`, a comment naming the old
  `content/evidence/present.ts` path (5 lines, same count); its report.
  `1b6f5df` had already removed the second producer's conditional spreads and
  moved `present` to `apps/extension/src/shared/present.ts`. Open work item 4's
  second-producer and merge-safety parts are settled.
- Validation: `grep -cE '\.\.\.\('` on `connection/dom-snapshot.ts` -> 1, and
  that one is in the header comment; `dom-snapshot.ts:33` imports
  `../../shared/present`; `git log -S'shared/present'` -> `1b6f5df`. Worker:
  extension `test` -> 294 of 294; three compile mutations in `dom-snapshot.ts`
  -> TS2353/TS2339/TS2345, restored byte-identical.
- Not verified: the Lab two-frame evidence packet.
- Outcome: Accepted

### 2026-09-12 — f-adapter-guard: the failure-record guard re-armed

- Agent: worker `f-adapter-guard`; verified by supervisor.
- Changed: `domain/src/runtime/adapter.ts` (399 lines): `producerDeclaredRedaction`
  refuses `redacted: true` beside the domain's withheld marker, which only a
  layer writes, and `secretSafeDispatchPayload` strips any received stamp
  instead of passing it on; `runtime/tests/adapter-redaction.test.ts` (the
  three-state probe, for a current and a pre-`1b6f5df` stamping client);
  `e2e/content/tests/redaction.spec.ts` (the `test.fixme` adapter row now runs).
- Why: open work item 4. At HEAD the extension no longer stamped, but the adapter
  still read any stamp as a producer declaration, so a stamping client leaked a
  sensitive control's `expected`/`actual`.
- Validation: supervisor `DOMAIN_TEST_BUILD_LABEL=supervisor-guard pnpm --filter
  @fluxiq-web-extension/domain test` -> `# tests 349`, `# pass 349`, `# fail 0`;
  content harness `redaction.spec.ts --workers=2` -> `Running 14 tests`,
  `14 passed`, none skipped. Grep for readers of `redacted` in both
  repositories -> only `sensitivity/redaction.ts:60`, which runs before the
  strip; Core has none. Worker: old conjunction restored -> domain 2 fail, spec
  1 fail, restored byte-identical. The worker's "19 passed" for the spec does
  not match the 14 rows the file declares.
- Not verified: the supervisor's own mutation rerun, deferred while
  `f-w18-secret-leg` compiles the domain package from the same tree; Lab.
- Outcome: Accepted

### 2026-09-12 — c-remaining inventory, and the scope it settles

- Agent: worker `c-remaining`; decisions by supervisor.
- Changed: `reports/c-remaining.md` (77 rows: 35 Settled, 29 Open, 11 In
  flight, 2 pointers); second-dispatch briefs in `briefs/finish-week1.md`.
- Decisions, each from the row's evidence rather than by asking:
  - **Not Week 1.** Firefox and C8 (30-day plan `:1312`, Phase 4.9 "Firefox
    build where practical", Week 4); CS1b, a coded late-event frame to the
    client (Week 1 exit criteria `:350-359` do not require it); B7 and C7
    (Week 2 contracts); C5 (needs a real Core); PB10b (a Core candidate field,
    unless the bench shows a post-condition-less step passing wrongly); B4
    (`capture_snapshot` stays top-frame, unless the Lab evidence run misses a
    child frame's items).
  - **Week 1.** CS1b′: a race presented as a connection failure fails "Failures
    are meaningfully classified", so Core's `flushRecordingEntries` is fixed.
  - `actions.spec.ts` is supervisor-only (C4).
  - Held: CS1d and CS2c until `i-resolver-safety` reports; B1, B3, B6 until
    `f-w18-secret-leg` releases their files; Lab-only rows until
    `i-lab-campaign` reports.

### 2026-09-12 — i-flow-lane-errors: a failing Flow-lane run loses its own observation

- Agent: worker `i-flow-lane-errors` (read-only); decisions by supervisor.
- Changed: `reports/i-flow-lane-errors.md` only.
- Found: (a) the race fix is committed and unit-proven, never run live, and the
  24-run campaign cannot pass on exit status alone: every run must also show
  `candidateCount` 4. (b) Cause 1, the redaction walk, is fixed at HEAD; Cause 2
  is open: an expectation mismatch throws before `run-flow-lane.ts` builds its
  observation, so `run-scenario.ts` substitutes a recording-lane observation and
  the bench publishes `flowCreated: false` with no reported category, which
  makes every negative variant a classification miss. All 11 saved `L-replay`
  Flow runs read `lane "recording"`. (c) the client error frame is not Week 1;
  a late event marking a healthy connection failed is.
- Decisions: D1, D2, CS1f and B1 share `run-scenario.ts` and `run-flow-lane.ts`,
  so `g-lab-resolution` is withdrawn for one brief, `g-flow-lane-observation`;
  its oracle choice is to consult `checkFinalState` before the asserts. D3 and
  D4 follow it serially. D5 (`failure.ts` reading `cause.code`) is not Week 1
  unless the bench shows `unknown` rows; its test would also hit the
  `src/tests/` ratchet. D6, step 4b of `live-validation-plan.md`, is the
  supervisor's, after `i-lab-campaign`. Core row C1 folded into
  `g-core-late-event`, whose ownership was widened by message to the typed
  error module, line-neutral `service.ts` throw sites, and
  `docs/architecture/automation-studio/client-gateway.md`.
  `storefront-checkout` and `sensitive-input` now fail Flow-lane pairing after
  W18, and the realistic-fixture rows need them, so `g-scenario-secrets`.
- Validation: worker, race-fix tests 7/7 and, with the old order in a scratch
  copy, 0/2 (`1 !== 4`); probe at HEAD -> `rejected: RunnerFailure(runtime.behavior)`,
  `error carries an observation: false`, `fixture oracle consulted: false`.
  Supervisor read Cause 2 and the fix design table against the two briefs'
  Owns: no shared file.
- Outcome: Accepted

### 2026-09-12 — f-w18-secret-leg: the password step replays up to the Lab

- Agent: worker `f-w18-secret-leg`; verified by supervisor.
- Changed: `domain/src/io/input-model.ts` (a request satisfies a required
  parameter), `domain/src/client/gateway-mapping.ts` (an unanswered request is
  refused, `web.intervention.required`, names and paths only),
  `packages/test-runner/src/flow-lane/declared-secrets.ts` and
  `run-flow-lane.ts` (requests read off the approved Flow, paired one-to-one by
  the recorded control, value supplied under the node's path, else
  `fixture.invalid` before the run), and their tests.
- Validation: supervisor read the source diff. `DOMAIN_TEST_BUILD_LABEL=sup-w18
  pnpm --filter @fluxiq-web-extension/domain test` -> `# tests 349`,
  `# pass 349`; `pnpm --filter @fluxiq-web-extension/test-runner test` ->
  `# tests 446`, `# pass 446`, `# fail 0` (439 at handoff). Pairing check
  mutated to `if (false && ...)` -> `# pass 443`, `# fail 3`, the three
  one-to-one rows, restored byte-identical. Worker: four mutations across the
  three edits, each failing its test.
- Found: `readFlowSecretRequests` repeats `readFlowActionTypes`' Flow walk; a
  dedicated failure code would need `codes.ts`. `storefront-checkout` and
  `sensitive-input` now fail pairing (`g-scenario-secrets`).
- Not verified: W18 in the Lab: a password node present, no pairing failure, no
  `web.intervention.required`, oracle passed, no value in trace or evidence, W19
  still its expected failure.
- Outcome: Accepted

### 2026-09-12 — f-connection-split: `connection.ts` 764 lines to 344

- Agent: worker `f-connection-split`; verified by supervisor.
- Changed: `apps/extension/src/background/connection.ts` (38 methods to 20),
  `connection/active-recording.ts` and `server-command-channel.ts` rebuilt onto
  the recording-start handshake, `connection/index.ts`, four new collaborator
  tests. The four modules had been committed unused in `ab736a1`.
- Validation: supervisor `EXTENSION_TEST_BUILD_LABEL=sup-split pnpm --filter
  @fluxiq-web-extension/extension check` -> exit 0; `... test` -> `# tests 313`,
  `# pass 313`, `# fail 0` (294 at handoff); `wc -l connection.ts` -> 344.
  Worker: facade call trace against HEAD byte-identical in a stubbed probe (362
  entries); four mutations caught; content harness 202 passed on an alone
  rerun after one `runMicrotasks is not a function` failure that did not recur
  (a single observation, attributed to load).
- Found: stale `connection.ts` comments in `recording-evidence.ts` and two
  tests; `connection/` holds 23 of 25 files.
- Not verified: MV3 service-worker restart, WebSocket reconnect and queue
  flush, real pairing; the content harness never loads the background.
- Outcome: Accepted

### 2026-09-12 — i-lab-campaign: what each criterion's Lab proof really needs

- Agent: worker `i-lab-campaign` (read-only); decisions by supervisor.
- Changed: `reports/i-lab-campaign.md` only; third-dispatch briefs.
- Found: criterion 1 cannot be proven by the bench as built, because rows
  without a variant run on the recording lane (`bench/expand-corpus.ts:15`),
  which never executes the workflow; criterion 2 has no Lab-side redaction
  assertion and no packet-size producer; criterion 4 cannot reach 90% while
  W19 cannot report `auth_required`. A Lab run works from a worktree directly
  under `F:\`, but a worktree does not pin Core, so Core must be frozen during a
  Lab wave. At most 3 instances, 2 under worker load, 1 for the proof benches;
  about 8.5-11 h of Lab time.
- Decisions:
  - Design item 1 taken: the bench plans W01-W18 on the Flow lane too, so one
    report covers criteria 1 and 5, at about 1.5x bench time. A bench whose
    main rows execute nothing cannot show actions are reliable.
  - Items 2, 3 and 4 briefed (`g-redaction-attestation`, `g-bench-coverage`,
    `g-domain-mapping`, which also takes B3). Item 5, read-only `lab` commands
    skipping the build, is not Week 1: it costs time, not correctness.
  - Stage 0 starts now (`l-stage0`, one instance). Stage 1 waits for Core to go
    quiet: `g-core-late-event` is editing it, and Stage 1's runs are proofs.
  - Design item 6, the corpus table's W27 `disabled` and W14 categories, is the
    supervisor's: the manifests are authoritative.
- Validation: worker, a scratch worktree at `99eca80` -> offline install exit 0
  in 1.6 s, every Core junction and `import('fluxiq/automation-studio')`
  resolving to `F:\!FluxIQ`; worktree removed, main tree and Core unchanged.
  Supervisor read the Outcome, Part 3 and the fix design.
- Outcome: Accepted


## Part two, archived 2026-09-13

Moved verbatim when the plan reached 855 lines.

### 2026-09-12 — i-resolver-safety: why the resolver acts wrongly, and D14 amended

- Agent: worker `i-resolver-safety` (read-only); decisions by supervisor.
- Changed: `reports/i-resolver-safety.md` only; fourth-dispatch briefs.
- Found, each reproduced in the real resolver or Core's compiled gate:
  - (c) `reworded-aria` at 0.173 is settled at HEAD: `1b6f5df`'s
    `gateway-payloads.ts` projection dropped `accessibleName` and
    `implicitRole`, which `ab736a1` restored; the old projection reproduces
    0.197/0.173 exactly, and HEAD's resolves at 0.389.
  - (b) Core's element-target floor is a wiring defect, not calibration: no
    candidates are supplied, the mapper builds the target from top-level keys and
    promotes typed text to `visibleText`, the floor is never sent, and
    confidence is never checked. Wired as it stands, it would refuse the correct
    `reworded-aria` control at every tier.
  - (a) the wrong action cannot be separated by any floor or margin: Core's text
    comparison scores "Save" and "Save changes and exit" the same, 0.359 on an
    authored recording and 0.633/0.640 on an identifier-less one.
- Decisions:
  - **D14 amended.** Its numbers stand, but its scope was too broad: the veto
    margin was tested against one fully labelled recording, rule 2 accepts any
    partial label match, and limit 2 covers any label that reaches Core's 0.35
    similarity, not only the recorded one. A match that no distinguishing signal
    agrees with exactly is now refused (design A, `g-resolver-corroboration`).
    The known cost is a label shortened with nothing exact left: that row
    refuses instead of recovering. Refusing beats clicking the wrong control,
    and the cost is measured before landing.
  - CS2c: for web, Week 1's floor is the browser's `TARGET_SCORE_FLOOR`. Core's
    floor stays inert, with its trace made truthful and its fingerprint correct
    (B.1, B.2, `g-core-target-gate`, after `g-core-late-event`). B.3, a
    tier-aware floor applied in the browser, is Week 2.
  - Core similarity metadata (design A's optional Core row) is not Week 1: the
    predicate reads Core's contributions as they are.
  - CS2b becomes a Lab confirmation; C's permanent row is
    `g-identity-wire-chain`.
- Validation: worker, extension 313/313 and domain 349/349; scratch Chromium
  probes of the real `resolveTarget` -> 8, 8 and 11 passed, identical across
  runs; Core gate probes exit 0. Supervisor read design sets A-C against the
  running briefs' Owns: no shared file except Core `service.ts`, which is why
  `g-core-target-gate` waits.
- Not verified: no Lab run; R7-R9 observed once; A's cost unmeasured.
- Outcome: Accepted

### 2026-09-12 — g-recorder-signals stopped on a brief defect; fourth dispatch

- Agent: supervisor.
- Changed: `briefs/finish-week1.md` (`g-recorder-signals` amended; fourth
  dispatch); `reports/g-recorder-signals.md` (the worker's Blocked report).
- Why: `g-recorder-signals` stopped without editing, correctly. Its Owns omitted
  `domain/src/actions/types.ts`, which `output-nodes/targets.ts` checks both
  field lists against with `satisfies`, and `shared/tests/present.test.ts`,
  whose `present<DomElementContext>` literals a new context key breaks. Both
  fields would otherwise have reached the wire and been dropped one layer later,
  as `x-identity-wire` found. The worker was resumed with both files and a new
  `identity-signals.spec.ts`. Decision on its question: a sensitive checkbox or
  radio withholds `checked`, recorded and on the gateway, since its checked
  state is its contents. Dispatched from `i-resolver-safety`:
  `g-resolver-corroboration`, `g-identity-drift-mode`, `g-identity-wire-chain`;
  `g-core-target-gate` waits for `g-core-late-event`.
- Validation: supervisor checked each named blocker against the brief's Owns and
  the running briefs: neither file is owned by any running worker. The worker's
  compile probes failed on setup (a C:/F: path split), so both blockers rest on
  reading `targets.ts:158,206`, `actions/types.ts:50-96` and
  `present.test.ts:271-331`, not a compile.
- Outcome: Revised

### 2026-09-13 — g-snapshot-evidence: the top frame's evidence survives the merge (LR7, LR8)

- Agent: worker `g-snapshot-evidence`; verified by supervisor.
- Changed: `background/connection/dom-snapshot.ts` and its test;
  `domain/src/recording/web-state/types.ts` (`evidence` declared in the
  contract's type); `web-state/evidence/input.ts` (the local restatement
  deleted, `pageEvidenceOfSnapshot` takes the typed snapshot). Also
  `live-validation-plan.md` step 4b, corrected by the supervisor from
  `i-flow-lane-errors` (a): Flow lane, 12 of 24, exactly 4 candidates per run.
- Why: LR7, the fallback merge path dropped the top frame's elements, totals
  and additive evidence; LR8, the contract was not joined at its own key. LR7
  departs from the inventory's smallest change, which the worker tried and which
  still dropped the elements: the top frame is now merged as a frame entry after
  the seed.
- Validation: supervisor `EXTENSION_TEST_BUILD_LABEL=sup-snap ... extension test`
  -> `# tests 315`, `# pass 315`; `DOMAIN_TEST_BUILD_LABEL=sup-snap ... domain
  test` -> `# pass 349`, `# fail 0`; `node scripts/structure-audit.mjs` ->
  `passed (34 warning(s), 17 baselined)`. Grep for `pageEvidenceOfSnapshot` and
  the two deleted types across `apps`, `packages` and `domain` -> the only source
  caller is `web-state/snapshot.ts:34`, already typed. Worker: the two new tests
  failed before the fix (313/315); renaming `evidence` -> TS2339 at `input.ts`
  and twice in `dom-snapshot.ts`, restored by SHA-256.
- Found: stale comments and casts outside its files at
  `domain/src/recording/tests/domain.test.ts:99-104`,
  `web-state/evidence/tests/project.test.ts:47` and
  `content/evidence/tests/forms.test.ts:151`; queued for a later small-fixes
  batch. `shared/protocol.ts:328` still declares `evidence` separately, inside
  `g-recorder-signals`' files.
- Not verified: the LR7 fallback is likely unreachable on demand in Chromium, so
  unit tests are its only proof; the content harness; test-runner and
  scenario-lab against the widened domain type.
- Outcome: Accepted

### 2026-09-13 — g-small-fixes: C1, A3, A4, LR9 and C3

- Agent: worker `g-small-fixes`; verified by supervisor.
- Changed: `validation-outcome.ts` and its test (comments); `domain/scripts/test-domain.mjs`
  (every load failure reported, exit 1); `e2e/playwright.content.config.ts`
  (`workers: 4`); `test-contracts/src/scenario-workflow.ts` (comment); the
  `intermediate-state` and `multi-tab` scenario tests (asserting
  `scenarioPageFactSchedule`); `docs/architecture/testing-facility.md`
  (`expected.actions`).
- Validation: supervisor read the diff of the runner, config and both tests;
  `pnpm --filter @fluxiq-web-extension/scenario-lab test` -> `# tests 197`,
  `# pass 197`; `DOMAIN_TEST_BUILD_LABEL=sup-sf ... domain test` through the
  edited runner -> `# pass 349`, `# fail 0`; content harness `--list` ->
  `Total: 202 tests in 22 files`. Worker: A3 scratch entry -> the edited runner
  names both broken entries and still runs the next, exit 1; LR9 inheritance
  restored -> both re-pointed tests fail with real diffs.
- Found: `validation-outcome.ts:17-20` may overstate what Core's parser drops;
  the `test:content --` forwarding trap in `apps/extension/package.json:10` is
  still open. Both queued for the later small-fixes batch.
- Outcome: Accepted

### 2026-09-13 — l-stage0: the Lab runs from a worktree

- Agent: worker `l-stage0`; verified by supervisor from the run's own files.
- Changed: no tracked file. Worktree `F:\fxlab-147fdb4`, kept for Stage 1; run
  `F:\fxlab-runs\stage0\run-mtzgp21f-57ba88e6`.
- Validation: supervisor grep of that run's `run.json` -> facility `"commit":
  "147fdb458015bd8a63c5f4e9099d3d8774353d63"`, `"dirty": false`; Core
  `"commit": "5d495eb06bea8ba024463394b98a4f77b61de08a"`, `"dirty": true`;
  `"verdict": "passed"`. `evaluation.json` -> `"lane": "recording"`,
  `"oracleVerdict": "passed"`, `"reportedVerdict": "passed"`,
  `"automationFailureReported": null`. Worker: `exit=0 seconds=101.4182841`;
  lowest free memory 12.26 GB; highest Chrome plus Node working set 3.49 GB. A
  single run.
- Found: the Lab's Core guard watches built output only, so it printed
  `"state":"quiet"` while `g-core-late-event` was editing Core's source.
  **Rule for proof runs: Core source edits stop too, not only Core builds.**
  The passing run also records `processExits` of 1 for both children and
  `sanitizedPacketBytes: []` (`g-bench-coverage` owns the size producer).
- Outcome: Accepted

### 2026-09-13 — g-identity-drift-mode stopped on a brief defect

- Agent: supervisor.
- Changed: `briefs/finish-week1.md` (amended); worker resumed.
- Why: a new variant breaks `apps/scenario-lab/e2e/identity-drift.spec.ts` at
  `:19`, `:131-133` and `:135-165`, a tracked spec outside the brief's Owns that
  neither scenario-lab `check` nor `test` runs, so the change would have passed
  every named gate and broken it. Resumed with that spec, `state.ts` and
  `save-action.ts`, and the spec's own Playwright gate. Its W29 corpus row needs
  `week1-corpus.test.ts:43` (28 rows) and `PLAN_NEGATIVE_VARIANTS` changed with
  it, inside `g-bench-coverage`'s files, so the supervisor lands it after.
- Validation: worker `git grep -n -i "save-and-exit\|saveAndExit\|and exit" HEAD
  -- apps/scenario-lab packages/test-runner/src/bench` -> exit 1, not settled
  at HEAD; the three spec lines were cited from source, not a failing run.
- Outcome: Revised

