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


## Part three, archived 2026-09-13

Moved verbatim when the plan reached 791 lines: the Core late-event fix, and
the fixture secrets with the wire-chain row, both committed.

### 2026-09-13 — g-core-late-event: a late recording message no longer fails the connection (CS1b′)

- Agent: worker `g-core-late-event` (Core); verified by supervisor.
- Changed: Core `client-gateway/bridge.ts` and its test, Core
  `docs/architecture/automation-studio/client-gateway.md`, both generated
  framework references. Recorded in full in Core's ledger.
- Found: the throw is raised in `recordGatewayInput` for the extension's
  `client.recording_event`, not only in the flush as `i-flow-lane-errors` (c)
  read it; the timer flush lost entries to an unhandled rejection. Core
  `appendRecordingDomainEvent` writes a late event into a finalized recording:
  added to `g-core-target-gate` as its item 3.
- Validation: supervisor, from `F:\!FluxIQ`: bridge `vitest` -> `Tests 15 passed
  (15)`; `pnpm check` -> exit 0, `structure-audit: passed`; `pnpm
  docs:reference` -> a one-line diff per copy; `pnpm docs:check` -> exit 0.
  Supervisor read the bridge diff: the discard applies only when a re-read shows
  `endedAt` set, and every other error propagates. Worker: `3 failed | 13 passed`
  before the fix, four mutations caught.
- Decisions: Lab Stage 1 runs against a Core worktree pinned beside a repository
  worktree under `F:\fxlab\` (`l-stage1`), because the Core links are relative
  and the live Core tree keeps changing; it defers the `--repeat 1` discovery
  bench until `g-flow-lane-observation` lands, and `sensitive-input` until
  `g-redaction-attestation` does.
- Not verified: the 24-run campaign's `gateway.receive_failed` count, which is
  Lab-only.
- Outcome: Accepted

### 2026-09-13 — g-scenario-secrets and g-identity-wire-chain

- Agent: workers `g-scenario-secrets` and `g-identity-wire-chain`; verified by
  supervisor.
- Changed: `storefront-checkout/manifest.ts` and its test (the cardholder name
  and expiry declared: 5 of 5 marked controls, where HEAD had 3);
  `sensitive-input/scenario.ts` (two secrets, and the password step targeting
  `testid:password`, since the recorder gives a password field no role) and a
  new test; `apps/extension/e2e/content/tests/identity-wire-chain.spec.ts` (new)
  and the header of `identity-fixtures.ts`. Brief defect on the first attempt:
  `sensitive-input` has no `manifest.ts`.
- Validation: supervisor read the `sensitive-input` diff;
  `pnpm --filter @fluxiq-web-extension/scenario-lab test` -> `# tests 202`,
  `# pass 202`, `# fail 0`, including `g-identity-drift-mode`'s in-flight tests;
  `EXTENSION_TEST_BUILD_LABEL=sup-wire pnpm exec playwright test -c
  e2e/playwright.content.config.ts --workers=2 identity-wire-chain` -> `2
  passed`. Workers: the real pairing function -> storefront 5 of 5 and
  sensitive-input 2 of 2 PAIRED, the old role target THREW; each test broken
  both ways and restored by hash; the wire-chain row with `1b6f5df`'s 17 keys
  -> `bestScore 0.197`, `confidence 0.173`, restored.
- Not verified: Lab pairing, which needs the `FLUXIQ_TEST_SECRET_*` values for
  all seven declarations.
- Outcome: Accepted
- Validation: supervisor read the grouped-by-file list and every Open row;
  the second dispatch's Owns lists share no file with each other or with a
  running brief. Worker: git and search only, no gate run, so each Settled row
  rests on reading the code at HEAD.
- Outcome: Accepted


## Part four, archived 2026-09-13

Moved verbatim when the plan reached 765 lines: the bench lane decision, the
W19 design decision with B3, and the redaction attestation. All three are
committed, and their decisions are carried in the briefs that act on them.

### 2026-09-13 — g-bench-coverage stopped on a brief defect; lanes decided

- Agent: supervisor.
- Changed: `briefs/finish-week1.md` (amended to item 1); worker resumed.
- Why: planning an unarmed row on both lanes yields two results with the same
  scenario, workflow and variant, and nothing records the lane, so
  `groupBenchResults` throws on its run count, or the report contract's
  duplicate check rejects it. Owning only the planner would have crashed every
  week1 bench after its last run and written no report. Resumed owning the
  report contract, its validation, `aggregate-report.ts` and
  `render-markdown.ts`.
- Decisions: every bench rate is per lane, never combined, because the recording
  lane executes no workflow and a combined rate counts each unarmed row twice;
  every unarmed row runs on both lanes, W24-W28 included. Sanitized packet size
  moves to the Flow-lane follow-up, read from Core's run detail `stateRefs`
  summary in `flow-lane/`. Raw snapshot bytes are not Week 1: no exit criterion
  names them, and they would need a new extension producer. Brief nit: design
  item 3 named `long-document`, which is in no corpus.
- Validation: worker test-runner `test` -> `tests 446 pass 446 fail 0`,
  `runnable: 43 (23 recording, 20 flow)`; scratch proof over `dist` -> both lanes
  in one group `THREW "has 2 runs, not the bench's 1"`, grouped apart `THREW
  "$.workflows[1]: repeats another result's scenario, workflow, and variant"`, a
  Flow-lane result alone valid.
- Outcome: Revised

### 2026-09-13 — g-domain-mapping: W19's navigation is lost in the recorder, and W19 takes Option A

- Agent: worker `g-domain-mapping` (stopped, no file changed); decisions by
  supervisor.
- Changed: `reports/g-domain-mapping.md`; `briefs/finish-week1.md` (B6
  withdrawn, B3 resumed owning `codes.test.ts` and `failure-taxonomy.md`; new
  `i-w19-expectation`).
- Found: auth-gate's sign-in reaches `/account` by `location.assign` after the
  recorded click, and the extension recorder drops that navigation twice: at
  `recorded-event-intake.ts:86` (a script navigation reports as `link`, read
  from Chrome's behaviour, not observed) and at `navigation-recorder.ts:48` (any
  untyped navigation within 5 s of a click). `input-model.ts` never sees it.
  Even a navigate step would report `navigation_unexpected`
  (`action-runner.ts:145-148`), because `authGateFailure` runs only for
  content-script actions. A new failure code breaks
  `runtime/failure/tests/codes.test.ts:47`, outside B3's Owns.
  `RECORDING_START_REASON` is stamped by nothing in either repository, so the
  rows guarding it pass by construction.
- Decisions:
  - **W19 takes Option A**: the recorded click carries the state its recording
    landed on, checked after replay, and the assert path already reports a
    missing selector on a sign-in gate as `AUTH_REQUIRED` (`assert.ts:36`).
    Option B, a Flow-lane-injected assertion, is rejected: the bench would
    measure the harness, not the recording. Option C, a navigate verb
    reclassifying redirects, is rejected: most files, least faithful, and a
    double navigation.
  - **PB10b moves into Week 1.** Its stated exception, a post-condition-less
    recorded step passing wrongly, is W19 exactly. Its Core lift shares
    `runtime/service.ts` with `g-core-late-event` and `g-core-target-gate`, so it
    lands serially after both, from `i-w19-expectation`'s design.
  - **B3 accepted as proposed**: `web.action.invalid_parameter`,
    `graph_validation_or_unknown_node`, not retryable, stage `dispatch`.
- Validation: worker grep and git reads only, each cited file:line; no gate run
  because nothing changed. Supervisor read "B6 findings" whole before deciding.
- Outcome: Revised

### 2026-09-13 — g-redaction-attestation: criterion 2's Lab-side leak check exists

- Agent: worker `g-redaction-attestation`; verified by supervisor. The Core
  late-event and fixture-secrets entries are archived verbatim to part three of
  `archive/2026-09-12-finish-week1-ledger.md`.
- Changed: new `packages/test-runner/src/redaction-attestation/` (the declared
  literals of each `secrets[]` step, scanned in the run bundle and the isolated
  workspace's `.fluxiq`, failing closed, reporting paths only);
  `run-manifest/create-run-manifest.ts` (`redactionState` derived, where it was
  a hard-coded `"verified"` for every run) and a new test.
- Decisions: a scenario declaring no secrets records `"not_applicable"`, a new
  contract value, rather than `"verified"` over nothing scanned or a permanent
  `"pending"`; generic credential-pattern hits stay advisories, since only a
  declared literal is evidence. Both are in `g-redaction-wiring`, which also
  wires the call into `run-scenario.ts` once `g-flow-lane-observation` lands.
  Until then `run.json` reads `"pending"`; no reader of the field exists outside
  the contract's validation.
- Validation: supervisor built the test-runner into a private `dist-sup` beside
  `dist` and ran `node --test "dist-sup/**/*.test.js"` -> `# tests 471`,
  `# pass 471`, `# fail 0`, 19 redaction rows. A first private build one level
  deeper failed 8 tests on path errors alone (`ENOENT ...\packages\package.json`),
  because those tests locate the repository from `dist`'s depth; not a defect.
  Worker: skipping the scan fails 5 of 13, restoring the `"verified"` literal
  fails 2, restored by SHA-256.
- Not verified: the wiring and any Lab run; a declared value that is also on the
  bundle's redaction list is scrubbed on write, so only the workspace scan can
  see it (auth-gate's password).
- Outcome: Accepted


## Part five, archived 2026-09-13

Moved verbatim when the plan reached 801 lines: the Flow-lane observation and
identity-drift landings (with W26 settled as CS1d), and B3 with B5. All are
committed.

### 2026-09-13 — g-flow-lane-observation and g-identity-drift-mode land; W26 is CS1d

- Agent: workers `g-flow-lane-observation` and `g-identity-drift-mode`; verified
  and decided by supervisor. Five more committed entries (Core late-event,
  fixture secrets, bench lanes, W19 and B3, redaction attestation) are archived
  verbatim to parts three and four of `archive/2026-09-12-finish-week1-ledger.md`.
- Changed: `a4564c5`, in `packages/test-runner/src/`: `run-flow-lane.ts` (oracle
  and observation published before the asserts; `flowLaneSnapshot`),
  `lane-observation.ts` (`selectLaneObservation`: a Flow-lane run that never
  published is a Flow run with `flowCreated: false`, never a recording-lane run),
  `recording-flow-proposal.ts` (`assertProposalCoversRecording`, B1),
  `persisted-flow-run.ts` (each action keeps Core's `targetResolution`),
  `run-scenario.ts`, and tests. `082c2c0`: identity-drift's `save-and-exit` mode,
  R7's lone identifier-less button, expecting `target_not_found`.
- Decisions:
  - **CS1f, partly deferred.** `flow-lane.json` now carries Core's own
    `targetResolution` record, which for web is Core's inert gate. The browser
    resolver's `confidence` and `bestScore` are on no record Core serves
    (`conversions.ts` drops attempt outputs). Criterion 3's pass conditions are
    outcomes (drift rows recover, W26 refuses, W29 refuses), so serving those
    numbers is a Core change made only if a criterion 3 row fails live and needs
    them for diagnosis.
  - **W26 is CS1d.** `week1.ts:51` is `ambiguous-targets` `no-context`: the
    identical twins resolved by position, which `g-resolver-corroboration`
    fixes. It needs no Core landmark or context signal in Week 1, whatever
    `g-recorder-signals` found about W26 needing one.
  - Dispatched on the committed base: `g-redaction-wiring` (the attestation's
    call site, `not_applicable`, and D3's discard audit) and
    `g-flow-lane-followups` (D4, one Flow read, the packet size).
- Validation: supervisor, `a4564c5`: test-runner built into a private `dist-sup2`
  beside `dist`, `node --test` -> `# tests 471`, `# pass 471`, `# fail 0`; read
  the `run-scenario.ts`, `run-flow-lane.ts`, `lane-observation.ts` and
  `recording-flow-proposal.ts` diff. `082c2c0`: `scenario-lab check` -> exit 0;
  `scenario-lab test` -> `# tests 202`, `# pass 202`; `pnpm exec playwright test
  -c e2e/playwright.config.ts identity-drift.spec.ts` -> `9 passed`. Workers: five
  mutations for the Flow lane (D1, D2, CS1f, B1 count, B1 wiring); two for the
  mode (a removed case, a mode that records a save), each restored by SHA-256.
- Not verified: D2's Lab invariant (`flow-lane.json` present implies `lane
  "flow"`, `flowCreated true`); B1 false failures on real recordings; W29's
  refusal, which needs `g-resolver-corroboration`; the W29 corpus row, which
  waits for `g-bench-coverage`.
- Outcome: Accepted

### 2026-09-13 — B3 and B5 land: an unreadable required field is refused, and two recorder signals reach the domain

- Agent: workers `g-domain-mapping` (resumed for B3) and `g-recorder-signals`
  (resumed with its amended Owns); verified by supervisor.
- Changed: B3, `domain/src/client/gateway-action-parameters.ts` (the reader
  reports refused fields), `gateway-mapping.ts` (a required field refused ->
  rejected before dispatch), `runtime/failure/codes.ts`
  (`web.action.invalid_parameter`, `graph_validation_or_unknown_node`, not
  retryable, `dispatch`), their tests, `docs/architecture/failure-taxonomy.md`.
  B5, `shared/protocol.ts`, `content/describe-element.ts` (`checked` for a
  checkbox or radio, none for a sensitive one), `content/identity/context.ts`
  (`landmarkName`), `background/connection/gateway-payloads.ts` (`checked`
  withheld for a secret control), `domain/src/actions/types.ts`,
  `output-nodes/targets.ts`, their tests, and a new
  `e2e/content/tests/identity-signals.spec.ts`.
- Decisions: the landmark name follows the ARIA order `accessible-name.ts`
  already uses (`aria-labelledby`, `aria-label`, `title`), not the brief's
  order, and a reference to a form control or editable region contributes
  nothing, so the name cannot carry what a person typed. A recorded checkbox
  toggle now maps to an executable `web.dom.check`, so Lab counts of executable
  steps on checkbox pages may move; B1 counts `web.element.changed` already.
- Validation: supervisor read both diffs; `pnpm --filter
  @fluxiq-web-extension/domain check` -> exit 0; `DOMAIN_TEST_BUILD_LABEL=sup-b3
  ... domain test` -> `# tests 352`, `# pass 352`; extension `check` -> exit 0;
  `EXTENSION_TEST_BUILD_LABEL=sup-b5 ... extension test` -> `# tests 323`,
  `# pass 323`; content harness `identity-signals identity-resolution
  --workers=2` -> `18 passed`. Workers: a probe of Core's real failure-record
  parser accepted the new record before any edit (its `retryable: true` twin
  returned `null`); B3 mutations (refusal off, pinned row removed) and B5
  mutations (`checked` blanked, `landmarkName` dropped, the sensitive gate
  removed at the wire and at capture, the key deleted) each failed, restored by
  SHA-256.
- Found, queued for the integration pass: the stale checkbox comment at
  `domain/src/io/input-model.ts:181-184`; a `failure-taxonomy.md` paragraph that
  already miscounted producers; `gateway-mapping.ts` at 413 lines, past the
  400-line advisory.
- Not verified: the extension and test-runner against the new code outside
  domain tests (grep finds no other pin of the code set); tracked
  `domain/.test-build/`, regenerated at integration; any Lab run.
- Outcome: Accepted


## Part six, archived 2026-09-13

Moved verbatim when the plan reached 789 lines: the bench lane change
(`8325107`) and the redaction wiring with D3 (`3c396b0`). Both are committed,
and their open follow-ups are briefed as `g-w29-row` and
`g-run-scenario-followups`.

### 2026-09-13 — g-bench-coverage: every unarmed week1 row runs on both lanes

- Agent: worker `g-bench-coverage` (resumed for item 1); verified by supervisor.
  The Flow-lane observation and B3/B5 entries are archived verbatim to part five
  of `archive/2026-09-12-finish-week1-ledger.md`.
- Changed: `8325107`. `packages/test-contracts/src/bench-report.ts` and
  `bench-report-validation.ts` (a result carries its `lane`, which grouping, the
  duplicate check and `runs.json` ordering include; rates in
  `metrics.ratesByLane`, never combined); `bench/expand-corpus.ts`
  (`lanesForResult`), `run-bench.ts`, `aggregate-report.ts`,
  `render-markdown.ts` (a Lane column), `corpus/bench-corpus.ts`,
  `corpus/week1.ts`, and their tests, including three renamed id literals in
  `bench/tests/compare-reports.test.ts`, which no brief owned.
- Decisions: the `compare-reports.test.ts` edit is accepted. The latency and
  duration distributions still mix both lanes. That is acceptable for Week 1,
  because two week1 benches mix them identically and so still compare for
  repeatability, but `report.md` must label them "all lanes"
  (`g-w29-row`). Splitting them per lane is Week 2. W29's row lands through
  `g-w29-row` with the count test's 66 raised to 67.
- Validation: supervisor, with `g-redaction-wiring`'s in-flight contract change
  also in the tree: `pnpm --filter @fluxiq-web-extension/test-contracts check`
  -> exit 0, `test` -> `# tests 63`, `# pass 63`; test-runner built into a
  private `dist-sup3` beside `dist`, `node --test` -> `# runnable: 66 (23
  recording; 43 flow, 23 unarmed and 20 variants)`, `# tests 483`, `# pass 483`,
  `# fail 0`. The commit names its files and a guard refused to stage the three
  test-contracts files that belong to `g-redaction-wiring`. Worker: reverting the
  lane planner drops the count to 43 of 66; removing the lane from grouping
  brings back `has 2 runs, not the bench's 1`; removing it from the duplicate
  check makes a dual-lane report invalid; each restored by hash.
- Not verified: no Lab bench, and no live `lab compare` against a pre-lane report
  on disk.
- Outcome: Accepted

### 2026-09-13 — g-redaction-wiring: every Lab run attests redaction, and D3 reads Core's discards

- Agent: worker `g-redaction-wiring`; verified by supervisor.
- Changed: `packages/test-runner/src/run-scenario.ts` (the attestation after Core
  stops and its logs reach the bundle, before the clone cleanup, the manifest and
  finalization; D3's audit read after the Core round trip); new
  `flow-lane/recording-discards.ts` (`readRecordingDiscards`) and its test;
  `redaction-attestation/run-redaction-state.ts` (`not_applicable`);
  `run-evaluation/tests/runner-wiring.test.ts`; test-contracts `src/run.ts`,
  `src/run-validation.ts` and `tests/run-manifest.test.mjs` (the new contract
  value). Outside its brief, each needed for the change to work: one export line
  in `flow-lane/index.ts`, and two test assertions that expected the old
  `pending`.
- Decisions:
  - The three edits outside the brief are accepted.
  - A snapshot with no audit log fails the run as `gateway.connection`: failing
    closed is right.
  - An `existing` target whose scenario declares secrets records `pending`,
    because a remote FluxIQ cannot be scanned.
  - Two follow-ups are briefed as `g-run-scenario-followups`: D3 reads the audit
    once, so a message discarded after that read is missed; and a
    `persistent-isolated` workspace grows until the scan reaches its limits. The
    Week 1 proofs run on `isolated`, so neither blocks them.
- Validation: supervisor read the `run-scenario.ts` and `flow-lane/index.ts`
  diffs. The literals are never added to the bundle's redaction list, which
  would scrub the very leak the bundle scan looks for. `pnpm --filter
  @fluxiq-web-extension/test-contracts test` -> `# tests 63`, `# pass 63`;
  test-runner built into a private `dist-sup4` beside `dist`, `node --test` ->
  `# tests 483`, `# pass 483`, `# fail 0`, 15 redaction and discard rows. The
  commit guard required the barrel's diff to be exactly its one export line.
  Worker: four mutations (the contract enum, the attestation's position before
  cleanup, the recording filter and fail rule, the `not_applicable` mapping) each
  failed its test, restored byte-identical.
- Not verified: `pnpm lab run sensitive-input --target isolated` passing with
  `findingCount: 0`, files scanned in both scopes and `redactionState:
  "verified"`; the 24-run campaign's `action_discarded` count and connection
  state after Stop; the `existing`, `clone` and `persistent-isolated` targets.
- Outcome: Accepted


## Part seven, archived 2026-09-13

Moved verbatim when the plan reached 750 lines: the Flow-lane follow-ups
(`1c4e56c`), with D4 ruled out of Week 1.

### 2026-09-13 — g-flow-lane-followups: one Flow read and measured evidence packets; D4 is not Week 1

- Agent: worker `g-flow-lane-followups`; verified and decided by supervisor. The
  bench-lanes (`8325107`) and redaction-wiring (`3c396b0`) entries are archived
  verbatim to part six of `archive/2026-09-12-finish-week1-ledger.md`.
- Changed: `packages/test-runner/src/flow-lane/flow-action-types.ts`
  (`readFlowNodes`, and a pure `flowActionTypes`), `declared-secrets.ts` (a pure
  `flowSecretRequests`), `run-flow-lane.ts` (one read feeds both),
  `persisted-flow-run.ts` (`evidencePackets`: each packet's UTF-8 byte size and
  `truncated` flag, read from the run detail's `stateRefs.beforeAction` and
  `afterAction` summaries), and their tests.
- Decisions:
  - **D4 is not Week 1.** Core's `actionCount` comes only from the paged
    `list-recordings` and counts entries that are not recorded actions, so a
    comparison could hide one lost action. The extension's tally exists only
    inside `run-scenario.ts`. B1 already fails a proposal short of the
    recording's pinned executable events, which covers every pinned row,
    including step 4b's `basic-form`.
  - `readFlowSecretRequests` survives with no production caller, kept only so a
    test row stayed unchanged. Its removal is added to `g-run-scenario-followups`.
  - Item 3 of `g-bench-coverage`, the bench's evidence-size consumer, can now be
    built on `evidencePackets`, and joins the integration pass.
- Validation: supervisor read the source diff: packets are measured by
  `serializedBytes` and never copied. Test-runner built into a private
  `dist-sup5` beside `dist`, `node --test` -> `# tests 483`, `# pass 483`,
  `# fail 0`. Worker: four mutations each failed their target rows, restored by
  hash; its earlier failing runs were all in `g-redaction-wiring`'s in-progress
  files, and its final run passed.
- Not verified: Core serving `stateRefs` summaries in a live run detail, which is
  read from source only; a Lab `flow-lane.json` showing `evidencePackets` as
  sizes and flags; W18 still pairing after the single read.
- Outcome: Accepted


## Part eight, archived 2026-09-13

Moved verbatim when the plan reached 783 lines: the resolver corroboration
(`ba4a17b`) with the identity-spec fix (`1cca5a2`), and the assert resend
(`1acea4c`). All are committed. The standing rule from the first: a change to
the element descriptor or its context is verified against the whole `identity-`
content family.

### 2026-09-13 — g-resolver-corroboration lands, and a red identity row B5 left behind is fixed

- Agent: worker `g-resolver-corroboration`; supervisor for the verification, the
  identity-spec fix and the decisions. The Flow-lane follow-ups entry
  (`1c4e56c`) is archived verbatim to part seven of the ledger archive.
- Changed: `ba4a17b`, in `apps/extension/src/content/`: a new
  `identity/corroboration.ts` (at least one distinguishing signal the recording
  carried agrees at Core's exact rung: text similarity of 0.92 or more on
  visible text, accessible name or label, or an equal id or test id);
  `identity/score.ts` (Level 2 returns `unmatched` when the winner fails it);
  `identity/veto.ts` (rule 2 uses the same predicate); `action-runtime/resolve-target.ts`
  (CS1d: a positional strategy enumerates its candidate family and reports
  ambiguity); their tests; near-miss rows in `e2e/content/tests/identity-resolution.spec.ts`.
  Then the supervisor's own commit: `identity.spec.ts`, the ambiguous-targets row.
- Found and fixed: the worker's full content-harness run failed
  `identity.spec.ts:112`, and it still failed alone. The row asserted the two
  duplicate buttons share their whole context; since `5911011` (B5) the context
  also carries the landmark's name, `"Primary"` against `"Secondary"`. B5 is
  right and the row's premise was stale, but the supervisor's B5 verification
  ran only the two identity specs B5 edited, so the red row reached a commit.
  From here on, a change to the element descriptor or its context is verified
  against the whole `identity-` content family, not only the specs it touches.
- Decisions:
  - The measured stop condition was not met, so design A lands: W20-W23 resolve
    the right control with unchanged scores (0.149, 0.259, 0.777, 0.783), and
    W26 `no-context` now reports `web.target.ambiguous`.
  - The accepted costs are refusals rather than wrong clicks: the right Save
    shortened to "Save" with nothing exact left, Level 2 on a recording that
    names nothing, and a point-only replay onto identical buttons.
  - Brief defect: `e2e/content/tests/` was at its 25-file limit, so the near-miss
    rows went into `identity-resolution.spec.ts` (now 501 lines, an advisory
    warning) instead of a new spec. Accepted.
- Validation: supervisor, `EXTENSION_TEST_BUILD_LABEL=sup-rc pnpm --filter
  @fluxiq-web-extension/extension check` -> exit 0; `... test` -> `# tests 357`,
  `# pass 357`, `# fail 0`; content `identity-resolution identity-signals
  identity-wire-chain large-page-resolution resolve-target` -> `41 passed`.
  `identity.spec.ts:112` alone -> `1 failed`, `- "landmarkName": "Secondary"` /
  `+ "landmarkName": "Primary"`; after the fix, content `identity-
  large-page-resolution resolve-target` -> `50 passed`. Worker: design A's rule
  weakened -> 14 unit and 6 content rows fail; CS1d disabled -> 2 unit and 1
  content row fail; both restored byte-identical.
- Not verified: the Lab rows (W20-W23 recover and W26 reports
  `web.target.ambiguous`, 3 of 3; W29 refuses); the full content harness since
  both commits, which runs at integration.
- Outcome: Accepted

### 2026-09-13 — w19-e3: an assert that meets a navigating tab is sent once more

- Agent: worker `w19-e3`; verified by supervisor.
- Changed: `apps/extension/src/runtime/action-runner.ts` (`sendAction`: on Chrome's
  no-receiver or closed-channel error, a `web.dom.assert` alone waits for
  `waitForTabReady` and is sent exactly once more) and its test.
- Decisions: nothing records that a second send happened, so a Lab run cannot tell
  a race absorbed from no race; that and Firefox's closed-channel wording are not
  Week 1, since W18's proof is its outcome.
- Validation: supervisor read the diff. `EXTENSION_TEST_BUILD_LABEL=sup-e3 ...
  extension check` -> exit 0; `... test` -> `# tests 357`, `# pass 356`,
  `# fail 1`, 21 resend rows passing. The one failure, `not ok 83`, is at
  `background/connection/tests/recorded-event-intake.test.mjs:1660`, in files
  `w19-e1` was editing and had not committed; `w19-e3` touched only
  `runtime/`, and its commit's guard refused any `background/` file. Test 83
  must pass again in `w19-e1`'s verification. Worker: three mutations each
  failed 4 rows, restored by hash.
- Not verified: Lab W18 3 of 3 with no `web.action.failed` on the landing assert.
- Outcome: Accepted


## Part nine, archived 2026-09-13

Moved verbatim when the plan reached 773 lines: the W29 row and mixed-lane
labels (`c29018f`), committed.

### 2026-09-13 — g-w29-row: W29 is in the week1 bench, and mixed-lane figures say so

- Agent: worker `g-w29-row`; verified by supervisor.
- Changed: `packages/test-runner/src/bench/corpus/week1.ts` (`variantOnly("W29",
  "identity-drift", null, ["save-and-exit"])`, expecting `target_not_found`),
  `bench/tests/week1-corpus.test.ts` (29 rows, 67 runnable), `bench/render-markdown.ts`
  (`## Distributions, all lanes`, and `all lanes` on each distribution row and
  the truncation count), and a new `bench/tests/render-markdown.test.ts`.
- Decisions: `compare-reports.ts:48`'s `run-duration-p95` also mixes lanes, and
  is printed nowhere in `report.md`; it compares two week1 benches that mix the
  same way, so it stays for Week 1. The plan's corpus table already carries W29.
- Validation: supervisor built the test-runner into a private `dist-sup6` beside
  `dist`: `# runnable: 67 (23 recording; 44 flow, 23 unarmed and 21 variants)`,
  `# tests 475`, `# pass 474`, `# fail 1`. The one failure is
  `flow-lane/tests/declared-secrets.test.js`, which failed to load on
  `TS2724: no exported member named 'readFlowSecretRequests'`: that export is the
  dead wrapper `g-run-scenario-followups` is removing, with its test, in files it
  had uncommitted. The commit's guard refused any `flow-lane/` file. Worker:
  dropping the W29 row fails three corpus tests (`+ 66 - 67`), removing the label
  fails the render test, both restored by hash.
- Not verified: W29 on the Flow lane refusing as `target_not_found`, which needs
  the Lab.
- Outcome: Accepted


## Part ten, archived 2026-09-13

Moved verbatim before committing the negative-click-outcome entry: the recorder
link (`d124b04`) with Core C1 (`6f172b9`) and the Core target gate, all
committed.

### 2026-09-13 — w19-e1 lands the click's landing; Core C1 and the target gate are verified

- Agent: workers `w19-e1`, `w19-c1` and `g-core-target-gate`; verified by
  supervisor. The W29-row entry (`c29018f`) is archived verbatim to part nine of
  the ledger archive. The Core entries are in Core's paired document.
- Changed: `d124b04`, `apps/extension/src/background/connection/navigation-recorder.ts`
  and `recorded-event-intake.ts`: a top-frame `link` or `form_submit` commit
  inside an executable click's window is recorded as a non-executable
  `browser.navigation` with `transition: "explained"`, `explainedBy` naming the
  click's sequence, and a URL of origin and path only; subframe commits and
  reloads are dropped; a new recording forgets the last one's clicks. Core
  `6f172b9`: a rejected expected state fails its attempt (C1). Core, committed
  next: the honest element-target trace, the recorded element's identity, and
  refused late domain events.
- Decisions: dropping every subframe commit, not only links and submits, is
  accepted, since an iframe loading on the landing page would otherwise replace
  the landing in the per-tab debounce. `explainedBy` is a per-document counter
  and not unique within a recording, so `w19-e1` is resumed to carry the click's
  unique event id beside it before the domain mapper (D1) is briefed.
- Validation: supervisor read the E1 diff. `EXTENSION_TEST_BUILD_LABEL=sup-e1
  ... extension check` -> exit 0; `... test` -> `# tests 370`, `# pass 370`,
  `# fail 0`, the recorded-event-intake row that failed while `w19-e1` was
  mid-edit included. Core executor `vitest` over `node-execution`,
  `transition-comparison` and `trace-withholding` -> `Tests 28 passed (28)`.
  Core target gate `vitest` over its four files -> `Tests 142 passed (142)`;
  Core `pnpm check` -> exit 0; `pnpm docs:check` -> exit 0. Workers: E1 restoring
  the old early return -> 3 failed; C1 transform removed -> 4 failed; target gate
  six mutations, each failing only its row; all restored byte-identical.
- Not verified: the auth-gate recording's explained landing, live; W18 and W19 on
  the Flow lane; a generated click node carrying the recorded identity.
- Outcome: Accepted


## Part eleven, archived 2026-09-13

Moved verbatim when the Lab Stage 1 entry took the plan to its limit: the
negative click outcomes (`7e3e6e2`), committed.

### 2026-09-13 — g-negative-click-outcomes: three negative variants expect a failed click

- Agent: worker `g-negative-click-outcomes`; verified by supervisor. Core's target
  gate is committed as `0e6d3ac`, with Core's completed briefs archived.
- Changed: `auth-gate/manifest.ts` (`expired`: typing `succeeded`, sign-in click
  `failed`, restated because a variant's `actions` replace the workflow's),
  `navigation/scenario.ts` (`broken-link`), `failure-surfaces/manifest.ts`
  (`blocked-url`), and each scenario's test.
- Decisions: the existing and clone lanes reject any non-succeeded attempt
  (`existing-flow-run.ts:96-97`), as they already did for `disabled` and
  `detached`; the week1 negatives run on the isolated Flow lane, so that is not
  Week 1.
- Validation: supervisor read the diff; `pnpm --filter
  @fluxiq-web-extension/scenario-lab check` -> exit 0; `... test` -> `# tests 202`,
  `# pass 202`, `# fail 0`. Worker: each click flipped back to `succeeded` failed
  its own scenario test, restored by hash.
- Outcome: Accepted


## Part twelve, archived 2026-09-13

Moved verbatim when the plan reached its limit: the W10 and W27 decision (E4,
the landing marker deferred, the no-navigation claim rejected). Its decisions
are carried in the sixth-dispatch briefs that act on them.

### 2026-09-13 — W10 and W27 take E4; three negative variants declare a failed click

- Agent: worker `i-w19-expectation` (follow-up, read-only); decisions by
  supervisor.
- Changed: `reports/i-w19-expectation.md` "Follow-up: W10 and W27"; sixth-dispatch
  briefs.
- Found: both fixtures serve a real error: W10 `broken-link` redirects to a 404
  and W27's guard answers 403. A landing marker reaches W10 but never W27, whose
  recorded click navigated nowhere. A "no navigation" claim fails W15's new tab,
  late navigations and single-page-app routes, costs about 1 s on some 30 clicks
  per pass, and still passes W27, whose blocked path contains the recorded one.
  **C1 already breaks three rows:** W19 `expired`, W10 `broken-link` and W27
  `blocked-url` declare their click `succeeded`, so once the click correctly
  fails, the Flow lane records the category and then throws on the actions check
  (`run-flow-lane.ts:129-130`).
- Decisions:
  - **E4 is taken:** a replayed click whose own tab lands on a page served with
    HTTP 400 or above fails as `navigation_unexpected`. It needs no wire change
    and makes no claim on other clicks. It costs about 300 ms on each click that
    commits nothing, roughly 9 s per pass. It is serial after `w19-e3`, which is
    committed.
  - The landing marker is Week 2, for wrong landings served with 200. The "no
    navigation" claim is rejected. E2 lands alone. D1 is unchanged.
  - The three variants declare the click `failed`, as W27's `disabled` and
    `detached` already do (`g-negative-click-outcomes`).
- Validation: worker, read-only, nothing run: no probe reaches the background
  navigation path without a browser. Supervisor read the follow-up whole.
- Not verified: that Chromium reports the 404 and 403 statuses to the extension;
  that W27's click result reaches the background before its page unloads; how
  the bench scores a matched category followed by a thrown actions check.
- Outcome: Accepted


## Part thirteen, archived 2026-09-13

Moved verbatim to keep the plan under its limit: E2 (`85a7e21`) and the click
event id on its landing (`4d88d65`), both committed.

### 2026-09-13 — w19-e2 and the E1 event id land

- Agent: workers `w19-e2` and `w19-e1` (resumed); verified by supervisor.
- Changed: `85a7e21`, `content/action-runtime/results.ts`: a failed URL claim that
  names a URL, on a sign-in gate, reports `web.auth.required`, naming the claim
  and never the page's address. `4d88d65`: the explained landing also carries
  `explainedByEventId`, the click's `web.<sequence>.<timestamp>` from the domain's
  builder.
- Decisions: a failed URL claim on a sign-up or change-password form also reads
  as `auth_required`, the same heuristic the selector branch uses; Week 2. Core
  stores a click's sequence and timestamp but not its event id, so D1 rebuilds the
  id with that same domain builder; Core needs no change.
- Validation: supervisor read the `results.ts` diff; `EXTENSION_TEST_BUILD_LABEL=sup-e2
  ... extension check` -> exit 0, `... test` -> `# tests 372`, `# pass 372`, the
  E1 follow-up's rows included; content `failures.spec.ts check-assert.spec.ts`
  -> `26 passed`. Workers: E2's three mutations and E1's dropped id each failed
  their rows, restored by hash.
- Outcome: Accepted


## Part fourteen, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the bench evidence-size
reader (`82454db`) and the no-candidates union (`12de09e`), both committed.

### 2026-09-13 — g-bench-evidence-size and g-target-resolution-union land

- Agent: workers `g-bench-evidence-size` and `g-target-resolution-union`; verified
  by supervisor.
- Changed: `bench/evaluate-run.ts` and `run-evaluation/observed-run-evaluation.ts`
  (a Flow-lane row's `sanitizedPacketBytes` and `truncationCount` from
  `flow-lane.json` `evidencePackets`; none for the recording lane;
  `rawSnapshotBytes` empty, not Week 1); `flow-lane/persisted-flow-run.ts` (Core's
  status-keyed resolution union kept, no-candidates included).
- Decisions: a single `lab run --flow` still records empty evidence, so a lone
  run and its bench row disagree; briefed as `g-single-run-evidence` after
  `g-run-scenario-followups`. The union copies Core's source type because Core's
  `dist` predates `0e6d3ac`; it becomes an import after the Core build
  (integration).
- Validation: supervisor read the evidence-size diff (sizes and flags only).
  Test-runner built into a private `dist-sup7` beside `dist`, `node --test` ->
  `# tests 496`, `# pass 496`, `# fail 0`, 33 evidence rows, with
  `g-run-scenario-followups`' in-flight edits in the tree. Workers: four and three
  mutations each failed their rows, restored byte-identical.
- Outcome: Accepted


## Part fifteen, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the run-scenario
follow-ups (`3959823`), committed.

### 2026-09-13 — g-run-scenario-followups: a second discard read and a bounded scan

- Agent: worker `g-run-scenario-followups`; verified by supervisor.
- Changed: `run-scenario.ts` (a second audit read after the browser closes and
  before Core stops); `flow-lane/recording-discards.ts` (union by audit entry id);
  `redaction-attestation/` (a `persistent-isolated` workspace scans only files
  written since run start); `declared-secrets.ts` (dead wrapper removed); tests.
- Decisions: a discarded action found by either read replaces the run's failure
  category, the old one kept as `supersededFailureCategory`, since it is the root
  cause; the redaction attestation keeps the earlier category, a separate finding.
- Validation: supervisor read the diff; test-runner in a private `dist-sup8`,
  `node --test` -> `# tests 496`, `# pass 496`, `# fail 0`, 29 discard, scope and
  wiring rows. Worker: seven mutations each caught, restored byte-identical.
- Not verified: the second read on the 24-run campaign; the bounded scan live.
- Outcome: Accepted


## Part sixteen, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the W19 design entry,
whose decisions were all dispatched, and the error-page click rule (`1cc98ec`),
committed.

### 2026-09-13 — i-w19-expectation: Option A needs a Core verdict change, and W10/W27 need their own answer

- Agent: worker `i-w19-expectation` (read-only); decisions by supervisor.
- Changed: `reports/i-w19-expectation.md` only; fifth-dispatch briefs.
- Found:
  - **Core ignores an expectation's verdict.** A probe of Core's own executor,
    run from a scratch config outside the tree, gave a click whose expected
    state the host rejected as `auth_required` -> `"runStatus": "succeeded"`,
    the attempt `"failure": null`, the comparison only `"blocked"`, and the next
    node dispatched. `node-execution.test.ts:114-137` pins that behaviour, so
    PB10b's "one lift line" understated Core.
  - The navigation cannot ride on the click's own event, which is sent before
    the navigation commits.
  - No URL claim reports `AUTH_REQUIRED` today; `results.ts` needs a branch.
  - W10 `broken-link` and W27 `blocked-url` expect `navigation_unexpected`, which
    no click path produces. W27's recorded click navigates nowhere, so Option A
    alone never reaches it, and W27 is one of criterion 4's named five.
  - Core `service.ts` (6919) and `service.test.ts` (4789) sit on their line
    baselines, so the Core lift must move code out, not add to it.
- Decisions:
  - **The link design (E1):** the navigation is its own non-executable event
    naming the click, not a held click. Holding clicks would reopen the path
    where 12 of 24 runs lost an action.
  - **C1 is a Core behaviour change**, and the user is alerted: a rejected
    expected state fails the attempt, and routing honours `failureRoute` as for
    any failed attempt. It affects every host binding `expectationEvaluator`;
    nothing downstream writes `expectedState` yet.
  - Dispatched: `w19-c1`, `w19-e1`, `w19-e3`. Held: C2 until
    `g-core-target-gate` releases `service.ts`; E2 and D1 until the follow-up on
    W10 and W27, sent to the same worker.
- Validation: worker probe, from `F:\!FluxIQ\packages\fluxiq`, `npx vitest run
  --config <scratchpad>/w19probe/vitest.probe.config.mjs` -> exit 0, `Tests 2
  passed (2)`, quoting the rows above; with the proposed transform the run is
  `"failed"`, `"dispatched": ["web.dom.click"]`, and `"failure"` carries
  `"category":"auth_required"`. Core executor tests `transition-comparison` and
  `node-execution` -> `Tests 15 passed (15)`. Supervisor read sections 3 and 4,
  the fix design and the open questions before deciding.
- Not verified: whether Chrome reports `location.assign` as `link` on frame 0;
  the timeline order of the explained event after its click; every Lab row.
- Outcome: Revised

### 2026-09-13 — w19-e4: a click that lands on a refused page fails as navigation_unexpected

- Agent: worker `w19-e4`; verified by supervisor.
- Changed: new `apps/extension/src/runtime/click-landing.ts` and its test; one
  call in `runtime/action-runner.ts` and its test. A replayed `web.dom.click`
  whose own tab's top frame commits a document served with HTTP 400 or above
  fails as `navigation_unexpected`, naming the status and path, never the page.
- Decisions: the status is read from the committed document at commit time, not
  after `waitForTabReady`, which would add at least 1 s per navigating click;
  accepted. A soft 404 served 200 and a sign-in page served 401 are Week 2. The
  two architecture pages that should name the module join the integration batch.
- Validation: supervisor read the diff and the new module;
  `EXTENSION_TEST_BUILD_LABEL=sup-e4 ... extension check` -> exit 0; `... test` ->
  `# tests 390`, `# pass 390`, `# fail 0`, 29 landing rows, `waited 300 ms` for a
  click that commits nothing. Worker: three mutations (threshold, top-frame
  filter, the one call) each failed their rows; on a built extension a redirect
  to a 404 read 404, a 403 read 403, and the click reply beat the unload 15 of 15.
- Not verified: W10 `broken-link` and W27 `blocked-url` reporting
  `navigation_unexpected` 3 of 3 in the Lab.
- Outcome: Accepted


## Part seventeen, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: Lab Stage 1, whose
failures `i-stage1-failures` and `i-recording-loss` have since explained.

### 2026-09-13 — l-stage1: the Core pin held, and recording entries go missing under load

- Agent: worker `l-stage1` (Lab); decisions by supervisor.
- Changed: `reports/l-stage1.md`; no tracked file. Worktrees under `F:\fxlab\`
  (repository `16ff729`, Core `267a2ca`); runs under `F:\fxlab-runs\stage1\`.
- Validation: supervisor tally of `F:\fxlab-runs\stage1\`: `find . -name
  run.json` -> 40 files (the worker reports 44 records, so 4 are unaccounted
  for), every one naming `"commit":"16ff729..."` and `"commit":"267a2ca..."`,
  with `"dirty":false` 80 times out of 80. Across the 25 `snapshots/flow-lane.json`
  files, `basic-form` shows `candidateCount=4` 10 times and `candidateCount=2`
  9 times, and 5 of its 24 step 4b runs wrote none; auth-gate shows
  `candidateCount=2` twice and delayed-ui once. `basic-form` `run.json` verdicts
  -> 14 `failed`, 12 `passed`, which includes the rerun and the smoke bench's
  runs. Worker figures, each a Lab observation: pin proof
  `exit=0 unpinned=0` on all three worktrees. Step 4b -> 10 of 24 runs with `candidateCount` 4,
  a FAIL; the 14 losing runs gave Core 5-6 entries instead of 10-13 (nine runs)
  or none (five), 1 of 15 passing under two instances against 9 of 10 alone; run
  12's build hit a Windows access violation and passed when rerun alone. W18
  `auth-gate --flow` -> 0 of 3: one empty recording although the extension
  counted five events, two password type steps that found no field; the
  password in no bundle file; oracle passed 3 of 3. `reconnect` 3 of 3. W24 -> 0
  of 3, no failure where `output_not_observed` was expected. W25 -> 0 of 3, two
  runs with no Flow and one `target_not_found` where `timeout` was expected.
  Smoke bench 4 of 4, compare exit 1 on navigation latency (2609 against
  1684 ms). Step 4 extension e2e -> `8 passed`, MV3 worker restart included.
  Lowest free memory 8.71 GB.
- Decisions:
  - **Recording-entry loss under load is the first Week 1 blocker.** It is
    partial, repeated and load-correlated, so it is a real defect, not the
    faulty RAM, and it likely explains W18's empty recording and W25's missing
    Flows. `i-recording-loss` investigates.
  - W18's password field, W24 and W25 go to `i-stage1-failures`, judged against
    HEAD, since most of this session's fixes postdate `16ff729`.
  - The smoke comparison ran under two-instance load against Part 3's rule, so
    its latency "regression" is not evidence; it reruns alone in Stage 2.
- Not verified: the cause of the lost entries; 30 run exits were read from each
  run's captured output, because the worker's file watch blocked the status-line
  writes.
- Outcome: Revised


## Part eighteen, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the pointer to parts
one to fifteen, the Stage 1 failure diagnosis (its fixes are dispatched), and
the single-run evidence fix (`f85ddad`), committed.

### 2026-09-13 — Finish-Week-1 session: fifteen settled entries archived

- Agent: supervisor.
- Changed: fifteen ledger entries moved verbatim to
  `archive/2026-09-12-finish-week1-ledger.md`. Part one: the first dispatch,
  `f-test-runner-ratchet`, `f-evidence-producers`, `f-adapter-guard`,
  `c-remaining`, `i-flow-lane-errors`, `f-w18-secret-leg`,
  `f-connection-split`, `i-lab-campaign`. Part two: `i-resolver-safety`, which
  amends D14; the `g-recorder-signals` and `g-identity-drift-mode` brief
  defects; `g-snapshot-evidence`; `g-small-fixes`; `l-stage0`.
- Why: this document passed its 800-line limit twice, at 913 and 855 lines.
  Every moved entry is settled, and its work is committed locally in
  `b43a46a`, `957c831`, `147fdb4`, `f255c2f`, `4c53354` and `81d7186`, with
  Core `5d495eb`. Decisions that stand: Firefox, CS1b, B4, B7, C5, C7, PB10b
  and raw snapshot bytes are not Week 1; CS1b′ is; under the amended D14 a
  match that no distinguishing signal agrees with exactly is refused; the Core
  element-target floor stays inert for web, and B.3 is Week 2; the bench plans
  every unarmed row on both lanes and reports each rate per lane; Lab proof
  runs need Core source edits stopped, not only Core builds.
- Validation: `sed -n` guards -> part two began at the `i-resolver-safety`
  heading and ended before `g-bench-coverage`, and the old summary ended at its
  Outcome line; `wc -l` on this document after the move -> 705.
- Outcome: Accepted

### 2026-09-13 — i-stage1-failures: W18 ran on the wrong page, and nothing generates a wait or a result check

- Agent: worker `i-stage1-failures` (read-only); decisions by supervisor.
- Changed: `reports/i-stage1-failures.md` only; ninth-dispatch briefs.
- Found:
  - **W18 runs 2-3.** The Flow lane reloads the start page only for an armed
    variant (`run-flow-lane.ts:93`), so W18's unarmed Flow began on the account
    page the recording ended on, which has no inputs. The failure screenshot is
    byte-identical to the recording's account-page capture. The password node
    carried a selector, a point and a fingerprint; nothing was withheld.
  - **W25 `too-slow`.** Nothing maps a recording to `web.dom.wait_for_selector`,
    and replayed resolution does not wait (`resolve-target.ts:188`), so the late
    click fails at once as `target_not_found`. The unarmed W24 and W25 Flow rows
    expect the same wait node, so they cannot pass either.
  - **W24 `unannounced`.** Nothing can report `output_not_observed`. Core's output
    confirmation is met by the replayed click's own input, the mapper sets no
    claim, and a recorded mutation carries only counts.
  - In every partial loss the earliest recorded action is the one missing (W18
    runs 2-3, W24 runs 1 and 3, W25 run 3); the lead went to `i-recording-loss`.
    B1 at HEAD would stop W18 runs 2-3 before their Flows, hiding the wrong page;
    W25 pins no click count, so B1 misses its loss.
- Decisions:
  - F1, every Flow run starts on the start page, follows `g-single-run-evidence`.
  - F2, a wait before a click whose target appeared late, is measured first by
    `i-late-target-wait`, since a selector-only wait could time out ahead of the
    scored resolver on the drift rows. That brief also pins delayed-ui's clicks.
  - **W24 `unannounced` is not Week 1.** Its producer needs a recorded-payload
    contract change, a claim builder, an evaluator rule and a corpus-wide pass.
    The row stays in the corpus, counts against criterion 4 as measured, and is
    ranked at Phase 1.6b.
- Validation: supervisor read `run-flow-lane.ts:75-114` (`:93` is
  `if (input.workflow.variant) await input.armVariant();`), `run-scenario.ts:320-333`
  (the callback always calls `openScenarioStart`), and both manifests
  (`delayed-ui/scenario.ts:40` pins only `web.dom.mutated`). Stage 1 bundles: W24
  `run-mtzhu41z-76f6a4fc` `flow-lane.json` -> `"status":"succeeded","failure":null,"candidateCount":3`,
  type, type, click all `succeeded`; W25 `run-mtzi1vgu-d40300bd` -> `"status":"failed"`,
  `"category":"target_not_found"`, `"candidateCount":1`. Each a single Lab observation.
- Not verified: the password node resolving on the sign-in page; the cause of the
  first-entry loss; F1's effect on unarmed rows now passing on leftover pages.
- Outcome: Revised

### 2026-09-13 — g-single-run-evidence: a lone Flow-lane run records the evidence sizes its bench row reads

- Agent: worker `g-single-run-evidence`; verified by supervisor.
- Changed: `run-evaluation/single-run-evaluation.ts` and its test; the evaluation
  call in `run-scenario.ts`. A Flow-lane run's `evaluation.json` reads
  `evidencePackets` from the staging bundle's `snapshots/flow-lane.json`, the file
  the bench reads once `finalize` renames the directory. A recording-lane run
  reads none, and a missing or malformed file yields none without throwing.
- Decisions: the reader copied from `bench/evaluate-run.ts` does not stay;
  `g-evidence-reader-merge` moves it into one module. `bundlePath` is optional only
  because `bench-parity.test.ts` omits it, and a call-site row guards the runner.
- Validation: supervisor read the diff; from `packages/test-runner`, `pnpm check`
  -> exit 0; `pnpm exec tsc -p tsconfig.json --outDir dist-sup8` -> exit 0;
  `node --test "dist-sup8/**/*.test.js"` -> `# tests 500`, `# pass 500`,
  `# fail 0`; private build removed. Worker: five mutations each failed only their
  row, restored with `sha256sum -c` OK.
- Not verified: a Lab run whose `evaluation.json` sizes equal its `flow-lane.json`
  packets and its bench row.
- Outcome: Accepted


## Part nineteen, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the recording-loss
diagnosis, whose Core, extension and runner fixes are dispatched.

### 2026-09-13 — i-recording-loss: Core drops what a client sends before its recording is open

- Agent: worker `i-recording-loss` (read-only); decisions by supervisor.
- Changed: `reports/i-recording-loss.md` only; tenth-dispatch briefs.
- Found:
  - Core opens a client-started recording only after `createRecording` returns,
    and entries, events, snapshots and state updates arriving before then are
    dropped; some are audited, none with a recording id.
  - Core never acknowledges a client start, so the extension's 750 ms local
    fallback fires in every run, not only under load.
  - Load lengthens the start, so the loss grows from the opening messages to the
    first actions to everything: counts fall at 13, 10, 6, 5 or 0.
  - The "appended after Stop" contradiction is two waits: the runner's after
    Stop, and the Flow lane's second wait on a finished recording, always 0.
  - Smoke gate 5.0's "4 of 4" included two W01 recording-lane runs that stored
    0 entries, and HEAD's discard reader, filtering by recording id, sees none.
- Decisions: the fix is in Core's bridge (an ordered start, an acknowledgement,
  audited drops), not a serialized WebSocket host. The extension begins locally
  only after its start was sent. The runner compares action counts on both lanes
  and counts session-scoped discards. Core is crossed again; the user was alerted.
  Dispatched `g-core-start-order` and `f-recording-start-send`; queued behind
  `f-flow-start-page`, `g-recording-completeness`.
- Validation: supervisor read Core `bridge.ts:196-356` and `:505-565`:
  `activeRecordings.set` at `:304` follows `await ... createRecording` at `:271`;
  `:218-220` and `:341-348` audit with no recording id; `:518` and `:555` are
  `if (!active) return;`. A grep of `F:\!FluxIQ\packages` for `start_recording`
  finds one sender, `client-gateway/service/commands.ts:43`; extension
  `handshake.ts:28` is `RECORDING_START_ACCEPT_TIMEOUT_MS = 750`. Worker probe on
  the pinned Core's built bridge with fake collaborators, a single observation
  each: concurrent start delays of 50, 450 and 1000 ms kept 8, 3 and 0 of 8
  entries; handled in order at 1000 ms, 8 of 8.
- Not verified: the host's concurrent handling (`apps/web/.../client-gateway-websocket.ts:179`,
  not found by the supervisor's search); Core's start latency in the bundles,
  which timestamp no open; the extension hazard E1, inferred from code.
- Outcome: Revised


## Part twenty, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the W19 Core candidate
field (Core `c0e0ce9`, whose own ledger holds the full entry), committed.

### 2026-09-13 — w19-c2: Core carries a mapper's expected state into the Flow, and shows the mapper what followed

- Agent: worker `w19-c2` (Core); verified by supervisor. Core's ledger has the
  paired entry.
- Changed (Core):
  - an optional `expectedState` on the recording mapper candidate, kept only as a
    plain-object clone and written into the approved Flow node;
  - a mapper context `following`, the next 32 observations;
  - construction moved from `service.ts` into
    `runtime/service/recordings/proposal-candidates.ts`, with its test;
  - importer SDK and `automation-studio.md` pages, and `w19-c1`'s paragraphs;
  - two Core baseline entries lowered.
- Decisions: the six open questions are settled in the eleventh dispatch. Node
  definitions dropping `expectedState` is Week 2. `g-core-expectation-record`
  shares the record and treats `{}` as no expectation. `w19-d1` gets the
  `following` shape.
- Validation: supervisor, Core `packages/fluxiq`:
  - new test -> `Tests 4 passed (4)`;
  - `service.test.ts` -> `Tests 108 passed (108)`;
  - executor tests -> `Tests 19 passed (19)`;
  - Core `pnpm check` -> exit 0, `2 baseline entries can be lowered`; after
    lowering both, the audit -> `passed` with nothing left to lower;
  - `pnpm docs:check` -> exit 0.
  - Worker: five mutations each failed their row, restored byte-identical.
- Not verified: Core `pnpm build` and root `pnpm test`; the domain against the new
  types.
- Outcome: Accepted


## Part twenty-one, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the start-page fix
(`c1c2557`), the evidence-reader merge (`fe6409a`), the start-send change
(`895d68b`) and the small fixes (`36163dc`), all committed.

### 2026-09-13 — f-flow-start-page: every Flow run starts on the scenario's start page

- Agent: worker `f-flow-start-page`; verified by supervisor.
- Changed: `flow-lane/run-flow-lane.ts` calls `prepareFlowPage` (renamed from
  `armVariant`) on every run, after the reset. `run-scenario.ts`'s callback arms
  only for a variant and always loads the start page. There is a new row in
  `flow-lane/tests/run-flow-lane.test.ts`.
- Found, from the worker reading fixture code only: 20 of the 23 unarmed week1
  Flow-lane rows now start differently. W10 and W18 change URL, 18 change page
  content only, and W04, W05 and W08 are unchanged. All 20 need re-measuring in
  Stage 2.
- Validation: supervisor read the diff. From `packages/test-runner`:
  - `pnpm check` -> exit 0;
  - `tsc --outDir dist-sup9` -> exit 0;
  - `node --test "dist-sup9/**/*.test.js"` -> `# tests 502`, `# pass 502`,
    `# fail 0`, with `ok 121 - every Flow run, armed or not, prepares its page
    once, after the reset and before the Flow is read or started`.
  - The tree also held the reader merge's and the small fixes' uncommitted edits.
  - Worker: restoring the variant guard failed that row, restored byte-identical.
- Not verified: W18 in the Lab starting on `/scenarios/auth-gate/`.
- Outcome: Accepted

### 2026-09-13 — g-evidence-reader-merge: one Flow-lane evidence-size reader

- Agent: worker `g-evidence-reader-merge`; verified by supervisor.
- Changed: a new `run-evaluation/flow-lane-evidence-sizes.ts` and its test,
  exported through `run-evaluation/index.ts`. `single-run-evaluation.ts` and
  `bench/evaluate-run.ts` both import it, and both copies and the rows pinning
  them together are gone.
- Found: one single-run row still compares a Flow-lane single run with its bench
  row. It belongs in `bench-parity.test.ts`, which the worker did not own. It
  stays in place, as the only check that the two producers agree.
- Validation: supervisor read the new module. From `packages/test-runner`:
  - `pnpm check` -> exit 0;
  - `tsc --outDir dist-sup10` -> exit 0;
  - `node --test "dist-sup10/**/*.test.js"` -> `# tests 502`, `# pass 502`,
    `# fail 0`, with 16 evidence-size rows ok.
  - Worker: three breaks in the module, and removing each caller's call, each
    failed their rows; all restored, `sha256sum -c` OK. The moved reader differs
    from both old copies only by `export`.
- Not verified: a real bundle read by either producer.
- Outcome: Accepted

### 2026-09-13 — f-recording-start-send: a recording begins locally only after its start was sent

- Agent: worker `f-recording-start-send`; verified by supervisor.
- Changed: `recording-start/handshake.ts`. The acceptance window still opens
  before the send, but when it elapses with the send unsettled, recording begins
  locally only once that attempt's send settles. There are new rows in
  `recording-start/tests/handshake.test.ts`, and acknowledgement rows in
  `connection/tests/active-recording.test.ts`.
- Found:
  - A worker probe showed a Core acknowledgement arriving during a local start
    (before `active-recording.ts:200`) starts recording twice and leaves the
    project link null.
  - `beginAccepted` never compares the acknowledged `recordingId` with the
    pending one.
  - A send that never settles now never falls back, and the project lookup
    (`core-api.ts:34`) is unbounded.
- Decisions: all three go to `f-recording-start-guard`, twelfth dispatch.
- Validation: supervisor read the diff;
  `EXTENSION_TEST_BUILD_LABEL=sup11 ... extension check` -> exit 0;
  `... extension test` -> `# tests 395`, `# pass 395`, `# fail 0`, 21 handshake
  rows ok. Worker: making the window begin locally at once failed 3 rows (first
  `handshake.test.ts:196`); three more mutations were each caught; all restored
  byte-identical.
- Not verified: Core's acknowledgement live; the Lab.
- Outcome: Accepted

### 2026-09-13 — g-integration-small-fixes: stale comments, casts and the content-harness script

- Agent: worker `g-integration-small-fixes`; verified by supervisor, who also
  corrected one stale sentence in `observed-run-evaluation.ts` outside the
  worker's lines.
- Changed:
  - comments in extension, domain and test-runner source, with only comment lines
    changed in every source file;
  - `failure-taxonomy.md` and `web-capabilities.md` name `runtime/click-landing.ts`;
  - one cast removed from `recording/tests/domain.test.ts`, whose fixture's
    `armPending` now matches the type;
  - the bench report's truncation sentence;
  - `apps/extension/package.json`'s `test:content` strips the forwarded `--`.
- Found: two casts must stay, or the tests do not compile (`project.test.ts:47`,
  `forms.test.ts:151`). The taxonomy's `AUTH_REQUIRED` and Dispatch bullets are
  still stale; they went to `g-w19-docs`.
- Validation: supervisor, with private labels `sup11`:
  - extension `check` -> exit 0, `test` -> `# pass 395`, `# fail 0`;
  - domain `check` -> exit 0, `test` -> `# tests 352`, `# pass 352`, `# fail 0`;
  - test-runner `check` -> exit 0, private build `# tests 502`, `# pass 502`;
  - content harness `--list` -> `Total: 218 tests in 24 files`;
  - `pnpm --filter @fluxiq-web-extension/extension test:content -- e2e/content/tests/identity-veto.spec.ts`
    -> `4 passed`;
  - the structure audit -> passed.
- Not verified: the full content harness through the script; root gates.
- Outcome: Accepted


## Part twenty-two, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the wait-rule
measurement (`2ca97f5`; its option 2 is dispatched) and the shared Core
expectation record (Core `5ca9981`), both committed.

### 2026-09-13 — i-late-target-wait: a wait rule must read the evidence observation, and the recorder must send page changes first

- Agent: worker `i-late-target-wait` (read-only, plus one manifest pin); decisions
  by supervisor.
- Changed: `apps/scenario-lab/src/scenarios/delayed-ui/scenario.ts` pins
  `{ type: "web.element.clicked", count: 2 }`, with a test;
  `reports/i-late-target-wait.md`.
- Found:
  - The mapper never receives `web.dom.mutated`. A recorded `dom.mutation` reaches
    Core as an event-role input and is kept as an `input.event` observation
    carrying `latestEvidence`, which compaction keeps.
  - The recorder sends its mutation batch 500 ms after the last change. In all
    three Stage 1 W25 recordings the late click was therefore sent first, so a
    rule that reads a mutation before a click never fires on its own target.
  - Option 3 would remove the corpus's only `timeout` row, and its unarmed pass
    would be a latency race.
  - No rule can put a wait after W24's last click, so W24's unarmed expected wait
    is unreachable.
- Decisions: option 2.
  - `f-recorder-mutation-flush`: the recorder sends pending page changes before
    any executable event, and W24's unarmed expected wait is dropped.
  - `w25-wait-mapper`, after `w19-d1`: the domain emits a wait from the mutation
    observation's own call when a same-document CSS click follows.
- Validation: supervisor read the code.
  - `content/recorder.ts:35-39` sends the batch only from its timer, and `emit` at
    `:55-60` does not flush it.
  - Core `runtime/io-bridge.ts:53-62` appends a non-action input as
    `type: "observation"`, `observationType: "input.${role}"`.
  - The supervisor also read the pin diff.
  - `pnpm --filter @fluxiq-web-extension/scenario-lab check` -> exit 0; `... test`
    -> `# tests 203`, `# pass 203`, `# fail 0`.
  - Worker: with the pin removed, 1 failed (the new test); restored identical.
- Not verified: which W25 run 3 entry Core compacted (inferred); W28's wait frame
  targeting; the Lab.
- Outcome: Revised

### 2026-09-13 — g-core-expectation-record: one expectation-rejected record in Core, and no empty expectation

- Agent: worker `g-core-expectation-record` (Core); verified by supervisor. Core's
  ledger has the paired entry.
- Changed (Core):
  - the `expected_state_missing` record is exported once, from `nodes/policy/`,
    and the executor's copy is deleted;
  - an `expectedState` with no keys is neither lifted from a mapper candidate nor
    sent to the host;
  - the supervisor updated two architecture sentences.
- Found: no import cycle. `{ conditions: [] }` still reaches the host, and `{}`
  still appears in the trace; neither changes a verdict.
- Validation: supervisor, Core `packages/fluxiq`:
  - the four changed and neighbouring test files -> `Tests 29 passed (29)`;
  - `service.test.ts` -> `Tests 108 passed (108)`;
  - Core `pnpm check` -> exit 0;
  - `pnpm docs:check` -> exit 0.
  - Worker: four mutations each failed their rows, restored identical.
- Not verified: Core `pnpm build`; root `pnpm test`; the Lab.
- Outcome: Accepted


## Part twenty-three, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: Core's ordered and
acknowledged client start (Core `73a81e9`) and the recorder flush
(`a840001`), both committed.

### 2026-09-13 — g-core-start-order: Core orders a client's recording start with what follows it, and acknowledges it

- Agent: worker `g-core-start-order` (Core); verified by supervisor. Core's ledger
  has the paired entry.
- Changed (Core): `client-gateway/bridge.ts` and its test; the client-gateway
  architecture page. The supervisor also updated
  `docs/integrations/client-gateway-websocket.md`.
  - Later messages from a client wait for its pending start.
  - `server.start_recording` is sent once the recording is open, but not after a
    Stop for it.
  - A refused start's waiting messages, dropped snapshots and dropped state
    updates are audited under the recording id they name.
- Found:
  - An acknowledgement can still cross the extension's own Stop on the wire. That
    guard was added to the running `f-recording-start-guard`.
  - `bridge.ts` is 796 of 800 lines.
- Validation: supervisor, Core `packages/fluxiq`:
  - bridge test -> `Tests 20 passed (20)`;
  - with both Core changes in the tree, `pnpm check` -> exit 0 and
    `pnpm docs:check` -> exit 0.
  - Worker: seven mutations each failed their target tests, restored
    byte-identical.
- Not verified: the WebSocket host; the extension receiving the acknowledgement
  live; the Lab proof, which is step 4b at 24 of 24 under two-instance load.
- Outcome: Accepted

### 2026-09-13 — f-recorder-mutation-flush: a page change is recorded before the action that follows it

- Agent: worker `f-recorder-mutation-flush`; verified by supervisor.
- Changed:
  - `content/recorder.ts` sends its pending mutation batch before it emits any
    executable kind. The batch includes records the observer has queued but not
    delivered (`takeRecords()`, one line beyond the brief, kept).
  - A new `content/tests/recorder.test.ts`.
  - W24's unarmed `expected.actions` in `intermediate-state/scenario.ts` drops
    `web.dom.wait_for_selector: succeeded`, and its test changes to match.
- Found:
  - `flow-lane/expectations.ts:7-19` only requires a matching attempt to exist,
    and ignores order, count and extra attempts.
  - A debounced `dom.input` can follow a mutation its own typing caused, so the
    W25 rule stays click-only. That note went to `w25-wait-mapper`.
- Validation: supervisor ran:
  - `EXTENSION_TEST_BUILD_LABEL=sup14 ... extension check` -> exit 0;
  - `... test` -> `# tests 405`, `# pass 405`, `# fail 0`, with rows 288-292 ok
    (`a click after a DOM addition sends the dom.mutation first, and the quiet
    period does not send it again`, and `every kind that can be executable
    flushes the batch first; ...`);
  - scenario-lab `check` -> exit 0, `test` -> `# pass 203`, `# fail 0`;
  - content harness `recorder-trust.spec.ts` -> `4 passed`.
  - The tree also held `f-recording-start-guard`'s uncommitted tests.
  - Worker: removing the flush failed rows 283, 284 and 286
    (`actual ['dom.click'], expected ['dom.mutation','dom.click']`), and the file
    was restored.
  - Worker: `failures.spec.ts` gave 11 passed, with one teardown timeout and no
    assertion diff. Rerun alone it gave 12 passed, a single observation.
- Not verified: the Lab, where W25's mutation must be recorded before the late
  click 3 of 3, and W24 unarmed must pass.
- Outcome: Accepted


## Part twenty-four, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the recording start
guard (`2f3dc29`) and the recording completeness check (`ac25435`), both
committed.

### 2026-09-13 — f-recording-start-guard: a recording starts once, whichever way Core's acknowledgement arrives

- Agent: worker `f-recording-start-guard`; verified by supervisor.
- Changed: `connection/active-recording.ts` and its test.
  - Every way into a recording goes through one start, marked before its first
    await. A second start waits for it, then only links its project.
  - An acknowledgement naming a recording this client is not starting, not
    running, or has already stopped is ignored, with an activity warning.
  - A start's project lookup is bounded at
    `RECORDING_START_PROJECT_LOOKUP_BOUND_MS = 1_500`. At the bound the start goes
    on without a project, and the local fallback does not wait on the lookup a
    second time.
- Found:
  - Before the fix, the new rows gave `# pass 8 # fail 5`; the double start failed
    at `:412` with `one start event 2 !== 1`.
  - The 1,500 ms bound is the worker's choice, not a measured figure.
  - Three older gaps stay open: a second Record press, a refusal, and a Stop
    arriving while a start is under way. They are for the Phase 1.6b ranking
    unless Stage 2 shows them.
- Validation: supervisor read the diff. With `EXTENSION_TEST_BUILD_LABEL=sup15`:
  - extension `check` -> exit 0;
  - `test` -> `# tests 405`, `# pass 405`, `# fail 0`, with rows 28-34 ok, from
    `an acknowledgement inside the window starts the recording once, and the
    window never fires` to `a stalled project lookup holds a start for its bound,
    then the local fallback begins without a project`, including `an
    acknowledgement that crosses the client's own Stop does not restart the
    recording`.
  - Worker: seven mutations each failed a row, and every restore was identical.
- Not verified: Core's acknowledgement live; a real stalled `fetch`; the Lab,
  which must show one "started" `browser.tab` event per recording and a linked
  project.
- Outcome: Accepted

### 2026-09-13 — g-recording-completeness: a run whose recording Core holds short fails, on both lanes

- Agent: worker `g-recording-completeness`, resumed once to finish two leftover
  files; verified by supervisor.
- Changed:
  - New `run-expectations/recording-completeness.ts` and its test. The runner
    reads the extension's `status.eventCount` before Stop, and Core's action count
    from each recording's full session (`get-recording`). A Core count below the
    extension's fails as `recording.persistence`, naming both counts, and an
    unreadable count fails closed.
  - `flow-lane/recording-discards.ts` also counts a discard naming no recording
    when this run's paired session sent it.
  - `runtime.settle` reports `recordedActions` and `entriesAppendedAfterFirstPoll`,
    and `flow-lane.json`'s `recording` labels the lane's own wait `secondWait`.
  - `runner-wiring.test.ts` pins the new discard-read text, and
    `scenario-assertions.test.ts`' messages match the start-page change.
  - The supervisor updated step 4b's pass conditions in `live-validation-plan.md`
    to the new fields.
- Found: a paired-session discard naming a recording Core never created stays
  open (report, open question 3).
- Validation: supervisor read the new module and the runner and discard diffs.
  - A search found no code reading the old field names.
  - From `packages/test-runner`, `pnpm check` -> exit 0, and
    `tsc --outDir dist-sup16` -> exit 0.
  - `node --test "dist-sup16/**/*.test.js"` -> `# tests 509`, `# pass 509`,
    `# fail 0`, including `ok 196 - a short count fails as recording.persistence,
    naming the two counts and nothing recorded` and `ok 104 - a discard that
    names no recording is counted when the run's paired session sent it, and
    another session's is not`.
  - The structure audit passed.
  - Worker: the T1 and T2 mutations failed 3 and 2 tests. A runner mutation
    dropping the discard scope failed the two wiring rows. Both were restored
    byte-identical.
- Not verified: the Lab. A clean `basic-form` run must show equal
  `recordedActions`, and smoke W01's empty recording must now fail.
- Outcome: Accepted


## Part twenty-five, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: Core's entry identity
(Core `187f40d`), the W25 wait rule (`5c1872d`) and the target resolution type
import (`6db2ff8`), all committed.

### 2026-09-13 — g-core-action-entry-identity: a recorded click's Core entry keeps its event id

- Agent: worker `g-core-action-entry-identity` (Core); verified by supervisor.
  Core's ledger has the paired entry.
- Changed (Core):
  - `bridge.ts`, one line, still 796: the event's own `eventId` reaches the
    recorded input's envelope metadata.
  - `io-bridge.ts`: action and observation entries copy that `eventId` and the
    `sourceId`, non-blank strings only.
  - Their tests, and the client-gateway architecture page.
- Found: a landing's `sourceId` is a top-level field mappers are not shown, so
  `w19-d1b` now matches by event id only (brief amended). A `sourceId` in the
  extension's metadata is client-declared and is now stored.
- Validation: supervisor, Core `packages/fluxiq`:
  - io-bridge and bridge tests -> `Tests 33 passed (33)`;
  - Core `pnpm check` -> exit 0;
  - `pnpm docs:check` -> exit 0.
  - Worker: seven mutations each failed named rows.
- Not verified: Core `pnpm build`; the Lab, where a W19 click's action entry must
  carry `metadata.eventId` equal to its landing's `explainedByEventId`.
- Outcome: Accepted

### 2026-09-13 — w25-wait-mapper: a wait before a click whose target a page change produced

- Agent: worker `w25-wait-mapper`; verified by supervisor.
- Changed:
  - New `domain/src/recording/proposals/late-target-wait.ts`, with its barrel and
    test. `web-panel-host.ts`'s mapper returns its candidate for an observation
    that maps to no action. There are new rows in `tests/domain.test.ts`, and the
    checkbox comment in `io/input-model.ts` is updated.
  - The rule starts from an `input.event` observation whose `latestEvidence` is a
    `dom.mutation` that added nodes, and the first executable entry in `following`
    decides. It proposes
    `web.dom.wait_for_selector { selector, wait: { condition: "present" } }`, with
    no timeout, source input or confirmation, when that entry is a
    `web.dom.click` with a CSS selector, in the top frame, with no other document
    named in between.
  - A click's own `action` entry still maps to `null`, so Core's fallback click
    stands.
  - `delayed-ui`'s expectations are unchanged, since `flow-lane/expectations.ts`
    only requires a matching attempt to exist.
- Found:
  - An `action` entry carries no URL. "Same document" is therefore inferred from
    the top frame and the absence of any other URL in between, and a child-frame
    mutation can still add an extra wait.
  - The wait matches by CSS selector only, so a drifted selector that the
    fingerprint would still resolve could time out. Stage 2's bench now checks the
    drift, W26, modal and iframe rows for an added wait.
- Validation: supervisor read the module and the mapper diff.
  - `DOMAIN_TEST_BUILD_LABEL=sup17 ... domain check` -> exit 0.
  - `... test` -> `# tests 373`, `# pass 373`, `# fail 0`, with `ok 96 - a
    mutation that added nodes, then a click in the same document, proposes
    waiting for the click's selector` and `ok 97 - the wait carries no timeout,
    source input or confirmation`.
  - The structure audit's only finding was the working-docs index, stale from
    the uncommitted ledger.
  - Worker: six mutations each failed a named row, restored hash-identical: no
    builder call, `added >= 0`, no selector guard, no click-URL check, no
    between-evidence check, and no frame check.
- Not verified: the Lab. `delayed-ui --flow` must show click, wait, click 3 of 3;
  `too-slow` must fail as `timeout`; and the rows above must stay unchanged.
- Outcome: Accepted

### 2026-09-13 — g-target-union-import: the Flow lane takes its target resolution shape from Core's type

- Agent: worker `g-target-union-import`; verified by supervisor.
- Changed: `flow-lane/persisted-flow-run.ts` only.
  - `AutomationNodeTargetResolution` is imported from Core's public
    `fluxiq/automation-studio/nodes` export, and the local copy of the union is
    gone.
  - The persisted type narrows each variant to named fields that cannot carry
    page content.
  - The scored statuses are a record keyed by Core's own, so the type check fails
    when Core's union gains or loses one.
- Found: the persisted fields are still named by hand, so if Core renamed
  `confidence` or `normalizedScore`, only a test would catch it (report, open
  question 1).
- Validation: supervisor read the diff, and confirmed
  `./automation-studio/nodes` is in Core's `package.json` `exports` with `types`
  and `import` entries. From `packages/test-runner`:
  - `pnpm check` -> exit 0;
  - `tsc --outDir dist-sup18` -> exit 0;
  - `node --test "dist-sup18/**/*.test.js"` -> `# tests 509`, `# pass 509`,
    `# fail 0`.
  - Worker: faking a new scored status or variant in Core, and dropping
    `no_match` from the reader, each failed `tsc` with TS2741. Breaking the status
    guard failed test 8. The file was restored byte-identical.
- Not verified: root gates; the Lab (no change expected).
- Outcome: Accepted


## Part twenty-six, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the domain landing
claim builder (`e8a725e`) and the live-click landing claim (`32b4324`), both
committed.

### 2026-09-13 — w19-d1: the domain mapper builds a click's landing claim, which a live click does not yet reach

- Agent: worker `w19-d1`; verified by supervisor.
- Changed:
  - New `domain/src/runtime/expectation/click-landing.ts` and its test, exported
    through the directory's barrel.
  - `web-panel-host.ts`'s mapper takes Core's optional context, and a click's
    `candidate(...)` gets the claim
    `{ conditions: [{ assert: { kind: "url", expected: <path> } }], mode: "all", timeoutMs: 5000 }`.
    The path comes from the last explained landing naming the click by event id;
    without an event id, from the nearest preceding click in the same tab with
    that sequence.
  - New rows in `tests/domain.test.ts`, and one in `io/tests/input-model.test.ts`.
- Found: live, the claim is inert.
  - Core stores a recorded click as an `action` entry (`io-bridge.ts:31-49`). Its
    metadata carries no event id, sequence or source id: the envelope metadata
    built at `bridge.ts:649-655` is not copied (`io-bridge.ts:24-29`).
  - The mapper returns `null` for that entry, so Core proposes the click through
    `recordingActionEntryCandidate` (`service.ts:2411`, `:5726-5749`), with no
    `expectedState`.
  - The landing itself does reach the mapper intact, as a `domain_event`.
- Decisions:
  - Committed as the builder and the domain-event path, labelled inert live.
  - `g-core-action-entry-identity` keeps the recorded event's id and source on the
    entry.
  - `w19-d1b` then proposes a linked click from its action entry. Every unlinked
    click keeps Core's fallback.
  - `g-w19-docs` waits for `w19-d1b`.
- Validation: supervisor read Core `bridge.ts:631-657`, `io-bridge.ts:20-64`,
  `service.ts:2396-2417` and `:5726-5749`.
  - `DOMAIN_TEST_BUILD_LABEL=sup13 ... domain check` -> exit 0.
  - `... test` -> `# tests 364`, `# pass 364`, `# fail 0`, with rows 167-178 ok,
    from `a click whose landing names its event id claims exactly the landing's
    path` to `a landing with no event id and no tab to compare claims nothing`.
  - Worker: dropping `expectedState` from `candidate(...)` failed "D1: a click
    proposes the path it landed on…"; breaking the event-id match failed rows 169
    and 175. Both restored, hashes matching.
- Not verified: the claim in a live proposal; the Lab.
- Outcome: Revised

### 2026-09-13 — w19-d1b: a live click's action entry carries its landing claim

- Agent: worker `w19-d1b`; verified by supervisor.
- Changed: `web-panel-host.ts`'s mapper and `runtime/expectation/click-landing.ts`,
  with rows in both tests.
  - A click Core recorded as an `action` entry now gets a candidate when a landing
    in `following` names the entry's stored `metadata.eventId`. The candidate is
    what Core's fallback proposes for it, plus the landing claim: output,
    parameters, source input, confirmation, confidence 0.95, and label
    "Web Dom Click".
  - Every other `action` entry still maps to `null`, and an entry the fallback
    refuses (`policyEligible: false`) is left to it.
  - Only this new path reads a stored domain event one level deeper, where Core
    puts its payload.
- Found:
  - The mapper's shared reader takes a stored domain event's payload one level too
    shallow. On a real recording, D1's domain-event path claims nothing, W25's
    between-evidence URL check misses navigations, and a navigation proposal
    likely reads no `url`. The existing rows pass only because they build the
    shallower shape. `g-mapper-stored-payload` fixes it.
  - An action entry carries no page URL, so its claim cannot be refused for
    landing on its own path. That is accepted, since such a claim passes on
    replay.
  - The probe wrote `recordings/` and `indexes/` into the repository root. The
    supervisor inspected the five files, an empty probe recording with no page
    data, and removed them.
- Validation: supervisor read the diff.
  - `DOMAIN_TEST_BUILD_LABEL=sup19 ... domain check` -> exit 0.
  - `... test` -> `# tests 375`, `# pass 375`, `# fail 0`, with rows 176-184 ok.
  - The structure audit passed; `domain.test.ts` is 400 lines.
  - Worker: nine mutations each failed a named row, restored byte-identical.
- Not verified: a live proposal; the Lab, where W19 `expired` must fail as
  `auth_required` with the click attempt `failed`.
- Outcome: Accepted


## Part twenty-seven, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the W19 architecture
pages (`d775b5e`), committed.

### 2026-09-13 — g-w19-docs: the architecture pages describe W19's changes

- Agent: worker `g-w19-docs`; verified by supervisor, who corrected one
  sentence.
- Changed:
  - `docs/architecture/extension-client.md`. Action Surface gains the assert sent
    once more to a navigating tab (E3) and `auth_required` for a failed URL claim
    on a sign-in gate (E2). Recording Evidence gains the navigation recording
    rules, the explained landing (E1), and both ways a click's landing claim is
    built (D1, D1b).
  - `docs/architecture/failure-taxonomy.md`, the whole "Who Produces What"
    section, which is wider than the brief's producer paragraphs.
    `AUTH_REQUIRED` gains its two shapes, the Dispatch refusals are listed, and
    `ACTION_FAILED` from `runtime/command-router.ts` is named.
- Found:
  - The domain-event click path the page describes claims nothing on a real
    recording until `g-mapper-stored-payload` lands. The action-entry path is
    true at HEAD.
  - The worker wrote that Core's bridge puts `sourceId` on neither entry. That
    is wrong for an action entry since Core `187f40d`. The supervisor rewrote it:
    a domain-event entry keeps `sourceId` as a top-level field, which mappers
    are not shown.
- Validation: supervisor read the full diff and spot-checked the claims beyond
  the brief at HEAD.
  - `gateway-mapping.ts` builds `UNSUPPORTED_TYPE` (`:342`),
    `USER_INTERVENTION_REQUIRED` (`:351`) and `INVALID_PARAMETER` (`:369`), in
    that file order. The check order the page states is the worker's reading.
  - `command-router.ts:33` answers a thrown send with `browserActionFailure`.
  - `runtime/result-mapping.ts` exists.
  - Supervisor: `node scripts/structure-audit.mjs` -> exit 0 before commit.
  - Worker: every linked file and both anchors exist, and every cited file:line
    was opened at HEAD. This repository has no `pnpm docs:check`.
- Not verified: rendered Markdown; the Lab.
- Outcome: Accepted


## Part twenty-eight, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the discard window fix
(`9c198d2`), committed.

### 2026-09-13 — g-discard-window: a discard counts only inside the recording's window

- Agent: worker `g-discard-window`; verified by supervisor.
- Changed:
  - `flow-lane/recording-discards.ts`: `RecordingDiscardScope` gains `from` and an
    optional `until`. An audit entry Core stamped outside them is not read,
    whether it names a recording or only the session. An entry with no readable
    timestamp is read.
  - `run-scenario.ts` takes `from` just before asking the extension to start
    recording, after the Core action probe, and passes `until` to the second read.
  - `flow-lane/run-flow-lane.ts` reports the time just before it dispatches the
    Flow.
  - Their tests, and `runner-wiring.test.ts`.
- Found:
  - The failure text still says "after their recording was finalized", and the
    bundle cannot show the window or what it excluded. Both go to
    `g-discard-window-evidence` before Stage 2 runs again.
  - The worker added three wiring pins beyond the strings its brief named: the
    `from` placement, the scope construction and the `until` source. They are
    accepted.
- Validation: supervisor read the diff. From `packages/test-runner`:
  - `pnpm check` -> exit 0;
  - `tsc --outDir dist-sup20` -> exit 0;
  - `node --test "dist-sup20/**/*.test.js"` -> `# tests 514`, `# pass 514`,
    `# fail 0`, including:
    - `ok 110 - a discard Core audited inside the window counts, from the moment
      the extension was asked to start recording`;
    - `ok 111 - once the Flow lane began dispatching, a discard naming the
      recording is ignored, and a late one Core audited before that counts`;
    - `ok 112 - an entry with no readable timestamp counts, so the window fails
      closed`;
  - the structure audit passed.
  - Worker: the rows use the diagnosis run's six real discards and one genuine
    late loss. Three mutated builds failed 6, 3 and 3 rows, and were restored
    byte-identical.
- Not verified: the Lab.
- Outcome: Accepted


## Part twenty-nine, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: Lab Stage 2's first
attempt and its blocker diagnosis (superseded by the second attempt's entry),
the stored-payload correction (`17c5bae`) and the discard window evidence
(`6c22e22`), all committed.

### 2026-09-13 — l-stage2: every run failed the runner's own discard check before measuring anything

- Agent: worker `l-stage2` (Lab); decisions by supervisor.
- Changed: no tracked file.
  - Worktrees `F:\fxlab\fxlab-7263534` and `-load` at `7263534`, and
    `F:\fxlab\!FluxIQ` at Core `187f40d`, rebuilt.
  - Runs under `F:\fxlab-runs\stage2\`; `reports/l-stage2.md`.
- Found:
  - All 12 runs exited 1 as `recording.persistence`: "Core discarded recorded
    actions that arrived after their recording was finalized (2 with no recording
    id)". That was step 4b 0 of 6 (4 under load, 2 alone), the load loop 0 of 5,
    and `sensitive-input` 0 of 1.
  - Every recording itself was complete. `recordedActions` for the extension
    equalled Core's (4 and 4, or 3 and 3), the connection stayed `connected`, and
    the second discard read added 0.
  - `sensitive-input`'s leak attestation passed: `findingCount 0`, and 0
    declared-value hits in 13 files.
  - The cause, confirmed in code by the supervisor:
    - the runner's Core action probe (`run-scenario.ts:261`) runs before recording
      starts (`:273`);
    - after a Core-dispatched action succeeds, the extension sends a runtime
      confirmation as a `client.recording_event` with
      `metadata.runtimeConfirmation: true`, whatever the recording state
      (`server-command-channel.ts:209-237`);
    - with no recording open, Core's bridge audits it as an executable
      `recording.action_discarded` naming no recording id (`bridge.ts:479-499`);
    - `g-recording-completeness` counts such a session-scoped discard as a loss.
  - Entry counts were 15 in 9 runs and 16 in 2, so the brief's "one entry count
    across all runs" is not a valid pass condition as written.
  - The instrumented run found six discarded `client.recording_event` messages,
    all judged executable. It is a single observation, with the check skipped, so
    its `run.json` is dirty and it is not a measurement.
    - Two came from the probe before recording, each 2 ms after its navigate or
      type returned. Record was pressed at 15.339 s; Core's `startedAt` was
      15.344 s.
    - None came during the recording.
    - Four came after finalization (`sinceFinalizedMs` 11165-14533), one at the
      end of each of the Flow lane's four actions, each carrying the finished
      recording's id.
    - That run passed: 4 of 4 Flow actions, 4 of 4 recorded, and 0 declared-value
      hits in 60 files.
- Decisions:
  - The runner's check is what is wrong. `g-discard-window` limits it to discards
    audited between the recording's start request and the Flow lane's dispatch.
  - Core's audit wording for a runtime confirmation goes to the Phase 1.6b
    ranking.
  - Stage 2 is redispatched at the fix commit.
  - Meanwhile the Lab worker runs one instrumented `basic-form --flow` in its
    worktree, timing both reads, including any Flow-lane echoes after
    finalization.
  - Step 4b's entry-count condition gives way to per-run action equality, which
    the completeness check enforces.
- Validation:
  - Worker: pin proof `exit=0 unpinned=0` on both worktrees; all 12 `run.json`
    name facility `7263534` and Core `187f40d` with `dirty=false`; lowest free
    memory 9.88 GB, with no pause.
  - Supervisor read `bridge.ts:479-499`, `audit-log.ts:14-17`
    (`timestamp: this.now()`), `run-scenario.ts:261-275` and
    `server-command-channel.ts:196-237`.
  - Each run count above is a single Lab observation.
- Not verified:
  - step 4b runs 7-24;
  - W18, W25, W10, W27 and W24;
  - smoke gate 5.0;
  - the week1 bench;
  - W19 `expired`.
- Outcome: Revised

### 2026-09-13 — g-mapper-stored-payload: the mapper already reads Core's stored domain events correctly

- Agent: worker `g-mapper-stored-payload`; decisions by supervisor.
- Changed: a new `domain/src/tests/web-panel-host.test.ts`, with five rows that run
  a recording through Core. The hand-built domain-event rows moved out of
  `domain/src/tests/domain.test.ts`. `domain/src/web-panel-host.ts` is unchanged.
- Found:
  - The brief's premise, taken from `reports/w19-d1b.md` open question 1, was
    wrong. Core stores each domain event twice: as a `domain_event` entry whose
    own payload sits inside `{ target?, payload }` (`model/recording-domain.ts:187`),
    and as an `observation` from the domain's `observationExtractor`, with the
    payload one level up (`:228-237`).
  - The mapper reads that observation copy. On a real recording, D1's
    domain-event click claim, W25's between-evidence URL check and a navigation
    proposal therefore already work, once each. Reading the entry as well
    proposes every executable domain event twice (mutation M1: 4 rows fail).
- Decisions:
  - Task 1 is withdrawn, and the reader stays as it is; the Core-run rows are
    kept.
  - This corrects the `w19-d1b` and `g-w19-docs` entries in archive parts
    twenty-six and twenty-seven, which said the domain-event path claims
    nothing on a real recording. The architecture pages never said so.
  - Stage 2's redispatch now waits only for `g-discard-window-evidence`
    (twenty-second dispatch).
- Validation: supervisor confirmed `recording-domain.ts:187` and `:228-237`, and
  that `web-panel-host.ts` is unchanged against HEAD. With
  `DOMAIN_TEST_BUILD_LABEL=sup21`:
  - `domain check` -> exit 0;
  - `test` -> `# tests 380`, `# pass 380`, `# fail 0`, including `ok 376 - Core
    shows a mapper a domain event twice, and the mapper reads it from the
    observation alone` and `ok 377 - D1: a click sent as a domain event is
    proposed once, claiming the path it landed on`;
  - the structure audit passed, and `domain.test.ts` is 300 lines.
  - Worker: M1, the brief's fix, failed 4 rows; M2, which stops reading an
    observation's payload, failed 5. HEAD was restored after each.
- Not verified: the Core rows copy the gateway's routing rather than running
  `ClientGatewayBridge`; the Lab.
- Outcome: Revised

### 2026-09-13 — g-discard-window-evidence: each discard read shows what its window excluded

- Agent: worker `g-discard-window-evidence`; verified by supervisor.
- Changed:
  - `flow-lane/recording-discards.ts` returns a `window` beside each read's
    discards: `from` (or `null`), and `until` when set.
  - Per audit type, the window also counts the excluded entries, by whether each
    names this run's recording, no recording, or another. No entry's id, message,
    session, recording id, label or input id travels.
  - Both discard reads' `runtime.settle` events in `run-scenario.ts` publish it as
    `recordingDiscardWindow`.
  - The failure text names lost actions "inside this run's recording window",
    per recording or "with no recording id". It adds "after finalization" only
    when every entry showing that loss carries `sinceFinalizedMs`.
  - A bound that is not a finite number now excludes nothing.
  - Tests, and two moved wiring pins.
- Found:
  - The "no recording" count includes other sessions' entries, and counts are per
    read, not unioned.
  - The `l-stage2` entry quotes the old failure text as it appeared then.
- Validation: supervisor read the diff. From `packages/test-runner`:
  - `pnpm check` -> exit 0;
  - `tsc --outDir dist-sup22` -> exit 0;
  - `node --test "dist-sup22/**/*.test.js"` -> `# tests 517`, `# pass 517`,
    `# fail 0`, including `ok 113 - each read publishes its bounds, until only
    when set, and counts what the window excluded by audit type and by the
    recording each entry names` and `ok 115 - the failure names lost actions
    inside this run's recording window, ...`;
  - the structure audit passed.
  - Worker: 17 mutations each failed a test with a real diff, and both files were
    restored byte-identical.
- Not verified: the Lab. `basic-form --flow` should show two things:
  - the first read excluding 2 action discards naming no recording;
  - the second read adding `until`, and excluding 4 naming this run's recording
    and 2 naming none, with `discardsAfterFirstRead` 0.
- Outcome: Accepted


## Part thirty, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the Flow-lane
expectation corrections (`e3df022`), committed.

### 2026-09-13 — g-flow-lane-expectations: the Flow lane judges only what a recording can produce, and shows the comparison status

- Agent: worker `g-flow-lane-expectations`; verified by supervisor.
- Changed:
  - `flow-lane/expectations.ts` and `run-flow-lane.ts`: a Flow with no extract
    node is not judged on the workflow's extraction, and `flow-lane.json` records
    `extractionExpectation: "not_applicable"`. The recording lane still judges
    unpaginated extraction.
  - `flow-lane/persisted-flow-run.ts` and `run-flow-lane.ts`: each attempt carries
    Core's transition comparison status, when Core reports one, and it reaches
    the `flow-lane.json` snapshot.
  - `run-scenario.ts`: the second discard read retries once when a read yields no
    audit log, and publishes `snapshotFetches`.
  - Their tests, and `runner-wiring.test.ts`.
  - The two edits beyond the brief's file list publish evidence that would
    otherwise reach no bundle file. They are accepted.
- Found: paginated extraction (`product-catalog`, `pagination: followNext`) is
  now judged by neither lane. Before this change, its Flow row could only fail
  with `0 extraction result(s)`.
- Decisions: paginated extraction has no Lab producer in Week 1. A recording
  never yields an extract node, and authoring one is Week 2 Flow work. The
  content harness keeps the verb's own coverage.
- Validation: supervisor, from `packages/test-runner`:
  - `pnpm check` -> exit 0;
  - `tsc --outDir dist-sup23` -> exit 0;
  - `node --test "dist-sup23/**/*.test.js"` -> `# tests 521`, `# pass 521`,
    `# fail 0`, including `ok 75 - a Flow with no extract node is not judged on
    the workflow's extraction, and the expectation is named as not applying`,
    `ok 99 - each attempt carries Core's transition comparison status when Core
    reports one, ...` and `ok 142 - each action's transition comparison status
    reaches the flow-lane snapshot`;
  - the structure audit passed.
  - Worker: three mutations, each failing its rows and restored byte-identical:
    the extraction guard, the comparison status, and the retry.
- Not verified:
  - the Lab: W18 and W09 `not_applicable`, W19 `comparisonStatus: "blocked"`,
    and `snapshotFetches`;
  - the retry against the real transient fault.
- Outcome: Accepted

## Part thirty-one, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: Lab Stage 2's second
attempt and the secret investigation, whose fixes are dispatched.

### 2026-09-13 — l-stage2, second attempt: the recording fixes held under load; auth-gate leaks its secret into Core, and W18, W19 and W25 fail

- Agent: worker `l-stage2` (Lab); verified by supervisor.
- Changed: no tracked file.
  - Worktrees under `F:\fxlab\` moved to `6c22e22`, with Core at `5845f5d`.
  - 157 runs under `F:\fxlab-runs\stage2b\`.
  - `reports/l-stage2.md`, "Second attempt".
- Found (worker figures; each run is a single observation):
  - **Pin:** the pin proof showed `unpinned=0` on both worktrees.
  - **Step 4b under two-instance load:** 23 of 24 passed, each with
    `candidateCount` 4 and equal `recordedActions`.
    - Run 8 failed `process.startup` before recording, and passed when rerun
      alone.
    - The load loop passed 37 of 37.
    - The lowest free memory was 8.82 GB, and the load never paused.
  - **Alone, all passing:**
    - W10 `broken-link` and W27 `blocked-url` each passed 3 of 3, reporting
      `navigation_unexpected` / `web.navigation.unexpected` with the click
      `failed`;
    - `sensitive-input` passed 3 of 3, with its attestation `passed`;
    - W24 unarmed passed 3 of 3;
    - smoke gate 5.0 was `equivalent`.
  - **W18, 0 of 3.** The Flow succeeded, but the Flow-lane extraction expectation
    can never be met, and the leak attestation failed.
  - **W19, 0 of 3.**
    - Its failure category held: the click `failed`, with `auth_required` /
      `web.auth.required` 3 of 3 and no extract attempt.
    - `comparisonStatus` is in no bundle, and the leak attestation failed.
    - Run 1's second discard read hit the fail-closed "no audit log" branch.
  - **W25, 0 of 3.** No wait was proposed, and `too-slow` failed 0 of 3 as
    `target_not_found`.
  - **The week1 bench, `--repeat 1`,** exited 1 with 37 of 67 passed.
    - Recording lane: `initialExecutionSuccess` 0.174.
    - Flow lane: `flowCreationSuccess` 0.682, `initialExecutionSuccess` 0.273,
      `falseSuccess` 0.167, and `failureClassificationAccuracy` 0.727.
  - **Evidence discards inside the window** occurred in 6 of 37 load runs, W18
    run 1 and W19 run 3. They failed none.
- Decisions, set out in the twenty-third dispatch:
  - the auth-gate secret comes first (`i-secret-in-workspace`, the Lab owner);
  - the bench's failing rows are triaged (`i-bench-triage`);
  - W25's live wait is investigated (`i-w25-live-wait`);
  - `g-flow-lane-expectations` makes the Flow lane stop judging an unreachable
    extraction expectation, publish each attempt's comparison status, and retry
    a failed snapshot read once;
  - step 4b's discard condition counts action discards only.
- Validation: supervisor, from the bundles.
  - **A tally of every `run.json` under `F:\fxlab-runs\stage2b\`:**
    - 157 files, with commit prefixes `6c22e22` ×157 and `5845f5d` ×157;
    - `"dirty":true` 0 times;
    - `basic-form`: 65 passed, 1 failed;
    - `auth-gate`: 5 failed; `auth-gate/expired`: 4 failed;
    - `delayed-ui`: 4 failed, 1 passed; `delayed-ui/too-slow`: 4 failed;
    - `navigation/broken-link`: 4 passed; `failure-surfaces/blocked-url`: 4
      passed;
    - `sensitive-input`: 3 passed; `intermediate-state`: 5 passed.
  - **The discard windows published by the 24 step 4b bundles.** 23 carry them,
    all one shape.
    - The first read excluded 2 action discards naming no recording, and
      counted 0.
    - The second read, with `until` set, excluded 4 naming this run's recording
      and 2 naming none, with `discardsAfterFirstRead` 0 and 0 counted.
  - **Two W18 bundles' `redaction-attestation.json`:** `status` `failed`, with
    `findingCount` 13.
    - All 13 findings are in scope `workspace`, and none in `bundle`.
    - 5 are in the project's content-addressed `objects/sha256/`, 5 in the
      recording's `objects/`, and 3 in
      `runtime/command-attempts/…/attempt.json`.
    - Only scopes and paths were printed, never a value.
- Not verified:
  - which Core objects and key paths hold the secret (the workspaces were
    deleted, and `i-secret-in-workspace` keeps one);
  - W18's username node and start page;
  - why W25 proposes no wait;
  - the single failures: W26 `Timed out waiting for client gateway`, W16
    `fetch failed`, and the startup timeouts;
  - W19 `expired` against a Core that no longer leaks.
- Outcome: Revised

### 2026-09-13 — i-secret-in-workspace: the auth-gate secret reaches Core by three routes, none of them typing

- Agent: worker `l-stage2`, as the Lab owner; decisions by supervisor.
- Changed: no tracked file.
  - One `auth-gate --flow` run and one recording-lane run, under
    `F:\fxlab-runs\secret\`. Each kept its Core workspace through a temporary
    runner edit, was reported, then deleted.
  - The edit was reverted, and the worktree was proven clean.
  - `reports/i-secret-in-workspace.md`.
- Found (a single run per lane):
  - **The fixture renders the demo password as page text**
    (`apps/scenario-lab/src/scenarios/auth-gate/pages.ts:21-26`). State
    snapshots capture it as `visibleText`, `text` and labels: 6 objects per
    lane, plus the attempts' result snapshots.
  - **The runner sends the secret twice as Flow run inputs**
    (`run-flow-lane.ts:133`). Core persists them in the session metadata and in
    `runDetailEnvelope`'s event chunks.
  - **Core saves each command attempt whole.** The password step's resolved value
    sits at `command.parameters.text`, and trace withholding never covered
    attempts.
  - Nothing came from typing: the recorder withholds a password field's value.
  - The attestation undercounts. It skips SQLite, and both runs' databases held
    the value in 4 rows it never reported.
- Decisions: the twenty-fourth dispatch takes fixes 1-5.
  - `f-authgate-fixture`: the fixture stops rendering the password.
  - `g-attestation-sqlite`: the attestation scans SQLite.
  - `f-runner-secret-input`: the runner drops its duplicate input, after
    `g-flow-lane-expectations`.
  - In Core, `g-core-input-withholding` withholds persisted run inputs, and
    `g-core-attempt-withholding` withholds resolved values in saved attempts.
    The user was told the Core areas, the reason and the compatibility effect
    before dispatch.
  - Fix 6, a sensitive-display rule in the domain, goes to the Phase 1.6b
    ranking.
- Validation:
  - Supervisor read:
    - `run-flow-lane.ts:120-134`, where the run's `inputs` spread both
      `declaredSecretFlowInputs(input.secrets)` and `secretInputs`;
    - Core `programs/automation-studio/runtime/service.ts:2824-2835`
      (`metadata: { ..., inputs: input.inputs ?? {} }`, written by
      `writeRuntimeSession`);
    - `storage/project/runtime-stream-store.ts` `runDetailEnvelope`
      (`inputs: detail.inputs`);
    - `runtime/storage.ts:51-52`, where `saveCommandAttempt` writes the whole
      attempt.
  - Worker: 13 and 6 flagged files, as in Stage 2. The revert rebuilt at exit 0,
    and `git status --short` printed nothing. After deletion, `.work entries
    after: 0`, and the value count was 0 in 57 run files.
  - The fixture's page text was never printed.
- Not verified: the browser profile; the exact Core call writing each recording
  state file; any fix.
- Outcome: Revised

## Part thirty-two, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the bench triage, whose fixes are dispatched, and the runner's single secret input, committed.

### 2026-09-13 — i-bench-triage: the 30 failing bench rows are 9 product defects, 11 harness defects, 3 environment and 7 already decided

- Agent: worker `i-bench-triage` (read-only); decisions by supervisor.
- Changed: `reports/i-bench-triage.md` only.
- Found (each row is a single observation):
  - **The recording lane's `initialExecutionSuccess` of 4/23 measures only
    whether Core's probe could type one string.** 17 of 23 recording results
    executed nothing: 12 have no `type` step, and 5 had no Core identity (H2).
  - **Six Flow-lane rows passed with no Flow built** (W04, W06 and W08, twice
    each). `scenarioRequiresCore` starts Core only when a workflow pins recording
    events, actions or a playback goal (H2). The 37 passes overstate by 6.
  - **The Flow lane's one false success is W03.** A key press was recorded before
    the text typed just before it (P1).
  - **Product defects, ranked by failing results:**
    - P3, a quick repeated click is dropped: 3;
    - P1, the key press ordering: 2;
    - 1 each: P2, no check confirmation; P6, a child-frame id replayed after a
      reload; P4, no recorded tab switch or close; P5, a file input recorded as
      text; P7, an optional dismissal.
  - **Harness defects H1-H7,** as the report tabulates.
- Decisions: the twenty-fifth dispatch.
  - P1, P2, P3 and H1-H7 are fixed now, across five workers.
  - P4-P7 are designed first (`i-recording-capability-gaps`), since W15 and W17
    are in criterion 1's set.
- Validation: supervisor read the code behind four claims.
  - `content/dom-events.ts:116-131`: the `keydown` listener emits without
    flushing pending input.
  - `background/connection/pointer-click-filter.ts:4-19`: a 750 ms suppression
    per signature.
  - `background/connection/runtime-status.ts:93-107`: no `web.dom.check` branch.
  - `packages/test-runner/src/scenarios.ts:25-27`: `scenarioRequiresCore`.
  - Worker: its extraction scripts read all 30 failing bundles and a passing
    comparison, and no fixture value appears in the report.
- Not verified:
  - the generated Flows' node order (the workspaces were deleted);
  - W05's and W07's page-status text;
  - which tab W15's second click ran in;
  - reruns of the three environment failures.
- Outcome: Revised

### 2026-09-13 — f-runner-secret-input: the Flow run gets each declared secret once, under its node's path

- Agent: worker `f-runner-secret-input`; verified by supervisor.
- Changed:
  - `packages/test-runner/src/flow-lane/run-flow-lane.ts`: the run's `inputs`;
  - `flow-lane/declared-secrets.ts`: `declaredSecretFlowInputs` removed, having no
    other caller;
  - their tests.
- Why: Core persists a run's inputs, so the copy keyed by secret id was one more
  copy on disk (`i-secret-in-workspace` fix 2). This reverses the id-keyed copy that
  `p-secret-binding` and `f-w18-secret-leg` kept.
- Validation:
  - **Supervisor**, the test-runner gate under label `sup31`:
    - `check` exit=0; private `tsc` exit=0;
    - `node --test` printed "# tests 524", "# pass 524", "# fail 0";
    - the private build was removed.
  - That run included `g-attestation-sqlite`'s uncommitted rows (521 + 3). The
    structure audit failed only on this plan's length and the stale index, both
    fixed in this commit.
  - **Worker mutation:** re-adding the id-keyed spread failed the row "no input is
    keyed by a secret id". Restored, 521 pass.
- Not verified: no Lab run. W18 must still type twice, and Core's workspace must
  hold no `inputs.auth-gate-password` key. `web.secret.password` stays in persisted
  inputs until `g-core-input-withholding` lands.
- Outcome: Accepted

## Part thirty-three, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the blocked attempt-withholding dispatch, since redispatched; the W25 storage-order investigation, whose fix is dispatched; the auth-gate page and the extract expectations, committed in 413dcb3.

### 2026-09-13 — g-core-attempt-withholding: blocked on its brief's ownership, and redispatched to own the whole chain

- Agent: worker `g-core-attempt-withholding` (Core); decisions by supervisor.
- Changed: nothing in Core; `reports/g-core-attempt-withholding.md`.
- Found: a resolved value reaches the saved attempt through three files the brief
  did not own.
  - `executor/contracts.ts:163`: the dispatcher context is `{ signal }` only.
  - `io-policy.ts:76,88-100`: forwards only the signal and preferred client.
  - `runtime/contracts.ts:145-148`: the dispatch context has no field for it.
  - An edit to the owned ends alone would have compiled, passed, and done nothing.
    The worker said so instead of shipping it.
- Decisions: the twenty-fifth dispatch's redispatch.
  - Build the report's design.
  - Withhold when the attempt is built, so the attempt in memory and on disk agree.
  - Withhold `result.message`, `result.error` and `attempt.message`.
  - The framework owns the marker, and Automation Studio aliases it.
- Validation: worker, in Core: `git status --short` printed nothing at `240c73e`.
  No code changed, so the supervisor had nothing to rerun.
- Not verified: the chain in code, by the supervisor. The redispatch's end-to-end
  row proves it.
- Outcome: Revised

### 2026-09-13 — i-w25-live-wait: W25 fails because Core's bridge stores the late click before the page change that revealed it

- Agent: worker `i-w25-live-wait` (read-only); decisions by supervisor.
- Changed: `reports/i-w25-live-wait.md` only; its probes are in the scratchpad.
- Found: a probe ran Core's real gateway, bridge and service with the domain's
  mapper.
  - **Delivered in order:** 8 entries, "Compacted 3", and the candidates click,
    wait, click.
  - **Delivered back to back, as Core's WebSocket host delivers:** the late click
    was stored first in 5 of 5 runs, with 2 candidates. That matches all 8 live
    Stage 2b `delayed-ui` recordings.
  - **The cause:** the host starts handling each of a client's messages without
    awaiting the last (`apps/web/src/server/client-gateway-websocket.ts:172-181`).
    The bridge flushes queued state snapshots before a state update (`bridge.ts:605`)
    but appends a recorded event at once (`:390-402`).
  - **A prototype** combined one ordered chain per recording with a flush before
    every direct append. It gave click, wait, click in 21 of 21 runs.
  - **A contradiction:** `i-late-target-wait` said Core appends in arrival order.
    That holds for the model, not for the bridge.
- Decisions: the twenty-sixth dispatch.
  - The fix goes in Core's bridge, and a Core-run row in the domain.
  - The wait rule, the recorder flush and the manifest stay unchanged.
  - The user was told this crosses into Core.
- Validation: the supervisor read Core's `bridge.ts` at `240c73e`.
  - The recorded-event path calls `recordGatewayInput` with no flush (`:392-402`).
  - The state-update path awaits `flushRecordingEntries` first (`:605`).
- Not verified:
  - Core's live stored order, which is inferred from the fingerprint;
  - the extension's send order;
  - Stop and a pending start under the fix;
  - whether proposal state links change.
- Outcome: Revised

### 2026-09-13 — f-authgate-fixture: the auth-gate sign-in page stops showing its password

- Agent: worker `f-authgate-fixture`; verified by supervisor.
- Changed:
  - `apps/scenario-lab/src/scenarios/auth-gate/pages.ts`: the password row shows a
    fixed placeholder;
  - its `tests/scenario.test.ts`: no rendering, and no served sign-in page, contains
    the constant;
  - `apps/scenario-lab/e2e/auth-gate.spec.ts`.
- Why: every state snapshot captures an element's visible text. A page that showed
  the declared secret put it into Core's workspace, however well typing was
  withheld (`i-secret-in-workspace` fix 1).
- Validation:
  - **Supervisor**, scenario-lab built into the private directory `dist-sup32`:
    - `check` exit=0; private build exit=0;
    - `node --test` printed "# tests 204", "# pass 204", "# fail 0";
    - the auth-gate diff was byte-identical to the one reviewed.
  - **Worker:**
    - the mutation restoring the password `<dd>` failed 3 of 13 auth-gate rows;
    - the e2e spec gave `6 passed`;
    - content harness `failures.spec.ts -g "on auth-gate"` gave `4 passed`.
- Not verified:
  - no Lab run;
  - the supervisor did not rerun the e2e spec or the content harness;
  - two content-harness rows and three comments still describe the old page. That
    work is `f-authgate-followups`.
- Outcome: Accepted

### 2026-09-13 — g-manifest-extract-entries: W11 and W15 stop expecting an extract no recording produces

- Agent: worker `g-manifest-extract-entries`; decisions and verification by
  supervisor.
- Changed: `expected.actions` only, in `scenario-lab` `infinite-feed/scenario.ts`
  and `multi-tab/manifest.ts`, and their tests.
- **The Flow lane now requires** `web.dom.scroll` (W11) and `web.dom.click` (W15).
  - It still judges final state.
  - The recording lane still checks extraction: 40 or 25 records for W11, and
    `PO-4472` for W15.
- Decision: `admin-console/manifest.ts:143` holds the same unreachable entry, and a
  written rule did not prevent it. A check replaces the rule (`g-expected-action-guard`,
  after `g-bench-expectation-fixes`).
- Validation:
  - Supervisor: the `sup32` scenario-lab run above, 204 of 204, included both
    scenarios' diffs.
  - Worker mutation: restoring both entries failed the W11 and W15 manifest rows.
- Not verified:
  - no Lab run;
  - W15 still fails first on P4;
  - the existing and clone target modes.
- Outcome: Accepted

## Part thirty-four, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the bench expectation fixes, committed in dd9b9f9.

### 2026-09-13 — g-bench-expectation-fixes: an action pinned with no outcome is judged on presence, and a bench row shows its own category's message

- Agent: worker `g-bench-expectation-fixes`; verified by supervisor.
- Changed:
  - `packages/test-runner/src/flow-lane/expectations.ts` (H4): an `expected.actions`
    entry with no `outcome` matches any attempt of its type. A declared outcome is
    still checked.
  - `bench/read-run-bundle.ts` and `bench/run-bench.ts` (H7): a row's cause is the
    last `error` event written under the category the runner returned. When no
    event records that category, the row shows no cause and a problem line.
  - Their tests.
- Scope, per the worker: only three rows pin an action with no outcome. They are
  W15 `popup-blocked`, W26 `no-context` and W24 `unannounced`, and each also
  declares its expected failure. No positive workflow changes.
- Validation:
  - **Supervisor**, the test-runner gate under label `sup34`:
    - `check` exit=0; private `tsc` exit=0;
    - `node --test` printed "# tests 526", "# pass 526", "# fail 0";
    - the structure audit passed;
    - the run included other workers' uncommitted test-runner edits.
  - **Worker mutations,** each failing its row, then restored byte-identical:
    - restoring the `succeeded` default;
    - taking the last `error` event again, which gave all three rows the redaction
      message;
    - not passing the category from `run-bench.ts`.
- Not verified:
  - no Lab run: W15 `popup-blocked` and W26 `no-context` must pass on the Flow lane,
    and W18's Flow row must show its own message;
  - the evaluation still cites the last `error` event's sequence.
- Outcome: Accepted

## Part thirty-five, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the recording-capability design, whose workers are dispatched; the three recorder fixes, committed in 9efd8c2; and the auth-gate cleanups, committed in 1d1e756.

### 2026-09-13 — i-recording-capability-gaps: uploads, tabs and child frames are Week 1; an optional dismissal is Week 2

- Agent: worker `i-recording-capability-gaps` (read-only); decisions by supervisor.
- Changed: `reports/i-recording-capability-gaps.md` only.
- Found: every root cause below rests on code reading and one bench run per row.
  - **P5, W17.** The domain maps every change that is not a select or checkbox to
    typing (`domain/src/io/input-model.ts:122-130`). Nothing can build an upload
    from a recording, because `web.dom.upload` needs inline content.
  - **P4, W15.**
    - No tab-close listener exists (`background/index.ts:48-68`).
    - Activating a tab records nothing (`active-page.ts:90-112`).
    - No action input maps to `web.browser.tab`.
    - The switch verb matches a URL substring (`runtime/browser-tab.ts:81-89`).
  - **P6, W28.** Only the numeric frame id is carried (`payloads.ts:28-31`), and
    Chrome renumbers frames when the Flow lane reloads the start page.
  - **P7, W13 `banner-absent`.** Core follows a failure edge on any failure, and
    nothing can mark a node optional.
- Decisions (the twenty-eighth dispatch):
  - P5, P4 and P6 are built now: one serial domain worker and two extension
    workers, against wire names the brief fixes.
  - Confirmations and the runner's upload input are briefed once their files
    are free.
  - The recorder stops sending a file input's value.
  - **P7 is ruled out of Week 1.** It needs a new Core node outcome on the
    deferred `failureRoute` seam, and a loose rule would let W12 skip its invite
    and still report success.
- Validation: the supervisor read the report in full, and checked it against the
  code already verified for P2 (`runtime-status.ts:93-107`). Worker: a
  declared-value scan of the report found 0 hits.
- Not verified:
  - how a background-raised event reaches the path that counts actions;
  - whether Chrome fires `tabs.onActivated` for Playwright's pages;
  - Core's handling of a large run input;
  - every design, which is unbuilt.
- Outcome: Revised

### 2026-09-13 — f-recorder-key-order-and-check-confirmation and f-pointer-click-pairing: typed text precedes the key that acts on it, a check confirms, and a quick second click is kept

- Agents: workers `f-recorder-key-order-and-check-confirmation` (P1, P2) and
  `f-pointer-click-pairing` (P3); verified by supervisor.
- Changed:
  - **P1, `apps/extension/src/content/dom-events.ts`.** A key that acts on the
    text sends the pending debounced `dom.input` first: Enter, Tab, Escape or an
    arrow. A key that continues typing does not: a character, a deletion, a bare
    modifier, or a key an input method reports while composing. The brief said
    "before any keydown". The worker narrowed it, because every keystroke is a
    keydown and one pending input would split per key.
  - **P2, `background/connection/runtime-status.ts`.** A succeeded `web.dom.check`
    confirms as `dom.change` with `checkboxToggled`, carrying no value. An action
    that did not succeed confirms nothing.
  - **Task 3:** no other recorded verb waits for a confirmation it never gets.
  - **P3, `pointer-click-filter.ts` and `recorded-event-intake.ts`.** A `click` is
    paired with the last `pointerdown` in its tab and frame, with no time window.
    - A second press on the same unmoved control is a second action.
    - A keyboard click is always recorded.
    - A double-click records two clicks.
    - A long press is one action.
  - Tests, including `e2e/content/tests/recorder-trust.spec.ts`.
  - A stale comment in `recording-start/tests/handshake.test.ts`, by the
    supervisor.
  - `docs/architecture/extension-client.md` and `web-capabilities.md`.
- Validation:
  - **Supervisor,** extension `pnpm check` exit=0, and
    `EXTENSION_TEST_BUILD_LABEL=sup35 pnpm test` exit=0 with "# tests 413", "# pass
    413", "# fail 0". That run began as the P1/P2 worker finished.
  - **Supervisor,** content harness
    `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2 keyboard.spec.ts recorder-trust.spec.ts`:
    exit=0, "19 passed".
  - Both diffs were frozen as patches and committed from them. The P3 diff
    compared byte-identical (`cmp`) to its first saved copy.
  - **Worker mutations:**
    - P1/P2: removing the key flush reproduced W02's and W03's orders; five
      mutations each failed their rows.
    - P3: three mutations each failed their rows.
- Not verified:
  - no Lab run: W02, W03 and W14 unarmed must pass on both lanes, and W14
    `armed` must stay `user_intervention_required`;
  - a live browser for double-click, touch cancel and input methods;
  - the content harness does not drive the background filter;
  - one residual drop: a press that never produces a click, then a keyboard click
    on the same selector, size and position in that tab and frame.
- Outcome: Accepted

### 2026-09-13 — f-authgate-followups: the password placeholder is one constant, and no comment says the page shows the password

- Agents: worker `f-authgate-followups` (scenario-lab); the content-harness rows by
  supervisor.
- Changed:
  - `apps/scenario-lab/src/scenarios/auth-gate/constants.ts` exports
    `authGatePasswordPlaceholder`.
    - `pages.ts` and `tests/scenario.test.ts` use it.
    - A new row fails if the placeholder ever contains the password.
  - `constants.ts:9` and `manifest.ts:28-30,97-98` no longer say the page shows the
    password.
  - The two auth-gate rows in `apps/extension/e2e/content/tests/failures.spec.ts`,
    by the supervisor: the variable is now the page's password row, commented as a
    placeholder. The rows still assert that the failure record quotes no page text.
- Decision: those rows do not import the constant.
  - No extension e2e spec imports scenario-lab source.
  - The page no longer shows the password, so the rows cannot meet it.
  - The guard that can is scenario-lab's own row: no rendering contains the
    password constant.
- Validation:
  - **Supervisor,** scenario-lab built into `dist-sup37`:
    - `check` exit=0; private build exit=0;
    - `node --test` printed "# tests 204", "# pass 204", "# fail 0";
    - the diff compared byte-identical to the copy saved when the worker finished.
  - **Supervisor,** content harness `failures.spec.ts -g "on auth-gate"`: exit=0,
    "4 passed".
  - **Worker mutation:** pointing the placeholder at the password failed 2 rows.
- Not verified: no Lab run, and no run of the scenario-lab e2e spec.
- Outcome: Accepted

## Part thirty-six, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the runner harness fixes (7a6a8e7), the expectation check (80171a8), and the SQLite leak check (ededbb4), all committed.

### 2026-09-13 — g-runner-harness-fixes: every Flow-lane run has Core and must build a Flow, the probe types only on the start page, a negative run skips goal facts, and the recording lane follows pagination

- Agent: worker `g-runner-harness-fixes`; decisions and verification by supervisor.
- Changed, in `packages/test-runner/src/`:
  - **New `lane-rules/`,** with tests:
    - `core-identity.ts` (H2): a Flow-lane or clone run always bootstraps a Core
      identity.
    - `built-flow.ts` (H2): a Flow-lane run on an isolated target that published no
      `flowCreated` fails `environment.missing`.
    - `probe-step.ts` (H3): the probe types into the first CSS `type` step visible on
      the start page within 1 s. Otherwise it is skipped, and its reason and step
      ids are published.
    - `final-state-facts.ts` (H5): a run whose resolved `expected.failure` is set is
      not judged on playback-goal facts.
  - **`run-scenario.ts`** calls those rules. **`scenarios.ts`** loses
    `scenarioRequiresCore`, which nothing else used.
  - **`scenario-steps/extract-records.ts` (H1).** An extract step with `pagination`
    clicks `next` as trusted input, and waits until the page it read is replaced.
    It reads every page up to `maxPages`, and the recording lane now asserts
    paginated extraction.
  - **`run-evaluation/tests/runner-wiring.test.ts`:** one new test pins the rule
    calls.
- Decisions:
  - **Accept `lane-rules/`.** `src/` and `src/tests/` are at their file-count limits.
  - **H1 is fixed in the runner, not the manifest.**
    - The fixture's own e2e spec pages through.
    - W05's Flow lane can now build a Flow, with two Next clicks.
    - This reverses "the Flow follows pagination".
  - **W05 `short-catalog` is expected to fail on the Flow lane.** A recorded Flow
    replays Next clicks that the armed page lacks. The Lab rerun records the
    outcome before the row's judgement is decided.
  - **The two comments H1 made stale go to `g-expected-action-guard`:**
    `flow-lane/expectations.ts:78-83` and `test-contracts/src/scenario.ts:22-24`.
- Validation:
  - **Supervisor,** the test-runner gate under label `sup39`:
    - `check` exit=0; private `tsc` exit=0;
    - `node --test` printed "# tests 540", "# pass 540", "# fail 0";
    - the structure audit passed;
    - the run included other workers' uncommitted test-runner and test-contracts
      edits.
  - **Worker mutations:** five, each failing its row, then restored and confirmed
    by `sha256sum -c`.
- Not verified: no Lab or browser run, so none of these was seen live:
  - real Next clicks, and the wait for the page to be replaced;
  - the start-page visibility probe;
  - the W04-W08, W12 and W29 outcomes.
- Outcome: Accepted

### 2026-09-13 — g-expected-action-guard: a manifest that expects an action no recording can produce does not load

- Agent: worker `g-expected-action-guard`; decisions and verification by supervisor.
- Changed:
  - **New `packages/test-contracts/src/recordable-actions.ts`:** the action types a
    recording of each step operation can yield. A paginated `extract` yields what a
    click yields.
  - **`test-contracts/src/validation.ts`:**
    - every `expected.actions` entry, in a workflow and in its variants, must be
      recordable from that workflow's script;
    - a script with no steps is not judged;
    - a manifest is checked when it is built and again when the runner loads it.
  - **`admin-console/manifest.ts`:** its unreachable `web.dom.extract` entry is
    gone. A scan of all 25 manifests then flagged none.
  - **Comments H1 made stale:** `test-contracts/src/scenario.ts:21-28` and
    `flow-lane/expectations.ts`. Plus a doc comment on `ExpectedAction`'s missing
    outcome.
  - Tests.
- Decisions:
  - **The validator is the check's home,** because it covers every lane and a
    defective manifest cannot load.
  - **The table's `upload`, `switchTab` and `closeTab` rows change** with P5 and P4,
    in `g-runner-upload-input`.
  - **The existing and clone lanes' outcome rule, and a rejected manifest's
    category,** go to `g-lane-consistency`.
- Validation:
  - **Supervisor, `packages/test-contracts` `pnpm test`,** which rebuilds the shared
    `dist`: exit=0, "# tests 65", "# pass 65", "# fail 0".
  - **Supervisor, scenario-lab built into `dist-sup40`:** `check` exit=0, "# tests
    204", "# pass 204", "# fail 0".
  - **Supervisor, test-runner gate `sup40`: 8 tests failed.**
    - The failing tests were week1-corpus 35-37 and demo-llm-exploration-request
      391-395.
    - Each was a `ContractValidationError` naming `web.dom.extract`, thrown from the
      stale shared `apps/scenario-lab/dist`. That build dated from 05:58, before
      `413dcb3`.
  - **Supervisor, test-runner gate `sup41`,** after that `dist` was rebuilt
    (exit=0):
    - `check` exit=0; private `tsc` exit=0;
    - `node --test` printed "# tests 545", "# pass 545", "# fail 0";
    - the structure audit passed.
  - **Worker mutations:** removing the check, restoring admin-console's entry, and
    removing the pagination rule each failed a test. Each file was restored and
    confirmed byte-identical by `cmp`.
- Not verified:
  - no Lab run;
  - the paginated-extract, upload and navigate rows rest on code reading;
  - the Flow lane with a zero-action recording.
- Outcome: Accepted

### 2026-09-13 — g-attestation-sqlite and g-attestation-sqlite-reader: the leak check reads SQLite databases, as bytes and cell by cell

- Agents: workers `g-attestation-sqlite` and `g-attestation-sqlite-reader`;
  verified by supervisor.
- Changed, in `packages/test-runner/src/`:
  - **`secret-leak-attestation.ts`:**
    - A workspace scope scans each SQLite database, with its `-wal`, `-shm` and
      `-journal` files, for every literal as UTF-8, UTF-16LE and UTF-16BE. Before,
      it counted them as skipped binary.
    - A file it cannot scan is an `unscanned-store` finding.
    - Each database is also copied, with its `-wal` and `-journal`, to a temporary
      folder and read cell by cell. That finds a literal SQLite split across pages.
  - **New `sqlite-store-reader/`,** the reader:
    - it runs Node's `node:sqlite` in a child process started with
      `--experimental-sqlite`, and takes the literal on stdin;
    - it skips virtual tables, and reads the ordinary tables that store their
      contents;
    - no dependency was added.
  - `redaction-attestation/run-redaction-scopes.ts`: a doc comment. Tests.
- Found:
  - **A byte search misses split literals.** It missed 36 of 303 split positions in
    each encoding, and the cell reader found all 303.
  - **Node's SQLite has no FTS5 or R*Tree,** and Core's project database uses both.
  - **Not every target gets a fresh workspace.** The default `isolated` target and
    `clone` give each run a new one. `persistent-isolated` reuses its workspace, so
    an earlier run's leak fails every later run until the workspace is reset.
- Decisions:
  - **A literal split across pages SQLite has already freed is still missed.**
    Core now withholds values before it writes them, so this is recorded as a
    known limit for the Phase 1.6b ranking, not fixed with `secure_delete`.
  - **A small follow-up gets the rest:** the demo check's default database size
    limit, and two stale comments in `run-redaction-scopes.ts` and
    `attest-run-redaction.ts`.
- Validation:
  - **Supervisor,** test-runner gate `sup42`, on diffs frozen when the reader worker
    finished:
    - `check` exit=0; private `tsc` exit=0;
    - `node --test` printed "# tests 545", "# pass 545", "# fail 0".
  - **Worker mutations,** each restored byte-identical afterwards:
    - restoring the binary skip failed the 3 new byte rows;
    - turning the reader off, or removing the virtual-table skip, failed 4 tests.
- Not verified:
  - **No Lab run.** Auth-gate's recording lane must show findings before Core's
    withholding lands, and 0 on both lanes after.
  - Reading Core's live databases.
  - Node after 22.11.
  - The reader's timeout and output-limit paths.
  - The demo attestations under their default limit.
- Outcome: Accepted

## Part thirty-seven, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the lane consistency fix (0a8606c) and the demo leak check's limits (1aec39e), both committed.

### 2026-09-13 — g-lane-consistency: every lane judges an expected action alike, and a manifest the validator rejects is fixture.invalid

- Agent: worker `g-lane-consistency`; the test-contracts comment and the
  verification by supervisor.
- Changed, in `packages/test-runner/src/`:
  - **`existing-flow-run.ts`:** the existing and clone lanes call the Flow lane's
    `assertFlowActions` instead of keeping their own copy. An entry with no
    `outcome` is therefore judged on presence alone there too, and attempt types
    are still sanitized.
  - **`scenarios.ts`:** a contract rejection fails as `fixture.invalid`, whether the
    registry throws it while being imported or the runner's own check does. The
    message names issue paths and the validator's wording only. Any other load
    failure keeps its category.
  - Tests: `tests/existing-flow-run.test.ts` and `tests/prerequisites.test.ts`.
  - **`packages/test-contracts/src/scenario.ts`,** by the supervisor: the
    `ExpectedAction` comment no longer says the existing and clone lanes read a
    missing outcome as `succeeded`.
- Found:
  - **Negative variants cannot pass on the existing and clone lanes.** Those lanes
    fail any attempt or run that did not succeed before the expected-action check
    (`existing-flow-run.ts:89-98`), and they never judge `expected.failure`
    (`run-scenario.ts:229,255`). The Week 1 bench runs isolated targets, so this
    stays as it is.
  - **A `fixture.invalid` load failure has no run bundle.** It happens before one
    exists, so it reaches only the CLI's stderr line, and one bad manifest fails a
    whole bench.
  - **A recording with zero actions fails the Flow lane.** Admin-console's
    `extract-customer-list` fails at the proposal step as `recording.contract`.
    This was read from code.
- Validation:
  - **Supervisor,** the test-runner gate under label `sup44`:
    - `check` exit=0; private `tsc` exit=0;
    - `node --test` printed "# tests 550", "# pass 550", "# fail 0";
    - the structure audit passed;
    - the run included `g-demo-attestation-limits`'s uncommitted edits.
  - **Supervisor,** `packages/test-contracts` `pnpm check` after the comment fix:
    exit=0.
  - **Worker mutations:** four, each failing its test. Both files were restored and
    confirmed byte-identical by `cmp`.
- Not verified:
  - no Lab run;
  - the `fixture.invalid` path through the CLI;
  - a Lab instance that resolves its own copy of the contracts package.
- Outcome: Accepted

### 2026-09-13 — g-demo-attestation-limits: the demo leak check scans Core's databases up to the Lab run's limits

- Agent: worker `g-demo-attestation-limits`; the shared constant and the
  verification by supervisor.
- Changed, in `packages/test-runner/src/`:
  - **`secret-leak-attestation.ts`,** by the supervisor: exports
    `SECRET_LEAK_ATTESTATION_RUN_LIMITS`, which is 10,000 files, 8 MiB per file,
    64 MiB per scan and depth 32. The scanner's absolute ceilings spread it and add
    128 approved paths.
  - **`demo-llm-attestation.ts`:** the demo setup scan uses those limits.
    - Before, it used the defaults.
    - Under those, a Core database or `-wal` over 1 MiB failed setup on size alone,
      and so would a workspace of more than 2,000 files.
  - **`redaction-attestation/attest-run-redaction.ts`,** by the supervisor: the run
    attestation uses the same constant instead of its own copy.
  - **Comments in `run-redaction-scopes.ts` and `attest-run-redaction.ts`** now
    describe the SQLite reading, including that database copies count against a
    scan's total.
  - **`tests/demo-llm-attestation.test.ts`:**
    - a setup whose databases are each between 1 and 8 MiB, and together over
      16 MiB, passes;
    - one with a database over 8 MiB fails.
- Validation:
  - **Supervisor,** the test-runner gate under label `sup46`, run after the constant
    was shared:
    - `check` exit=0; private `tsc` exit=0;
    - `node --test` printed "# tests 550", "# pass 550", "# fail 0";
    - the structure audit passed.
  - **Worker mutations,** made before the constant was shared: removing the limits,
    and restoring only the 16 MiB total. Each failed the 1-8 MiB row (`not ok 3`).
    Both were restored and confirmed by `sha256sum -c`.
- Not verified:
  - no Lab or demo run;
  - real demo store sizes;
  - whether the over-8 MiB row's finding is `unscanned-store`, which that row
    cannot assert.
- Outcome: Accepted

## Part thirty-eight, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the domain capability mapping (1316533), the extension capability work (857513e), and the architecture pages, committed alongside this move.

### 2026-09-13 — f-domain-capability-gaps: a recorded file choice, tab switch or close, and child frame each map to a replayable node

- Agent: worker `f-domain-capability-gaps`; verified by supervisor.
- Changed, in `domain/src/`:
  - **The wire names, compiled first** for the extension workers:
    - the recorded payload's `tab: { operation, urlPath? }`;
    - the inputs `web.user.files_chosen`, `web.user.tab_switched` and
      `web.user.tab_closed`;
    - `urlPath` on the tab switch request;
    - `frameUrlPath` on `WebAutomationActionCommand`, lifted from
      `browserFrameUrlPath`.
  - **P5,** `io/input-model.ts` and new `output-nodes/upload-binding.ts`.
    - A file input's change maps to `web.dom.upload`, whose `upload` is a
      `web.upload.<key>` binding with no fallback.
    - The node carries no file name, count or content.
    - An emptied file input stays evidence.
  - **P4.** A recorded switch that has a path maps to `web.browser.tab`, and so does
    a close. Neither carries a tab id, origin or query. The recording-start marker
    stays non-executable.
  - **P6,** `output-nodes/payloads.ts`. A child-frame node also carries its frame's
    URL path, and top-frame nodes are pinned byte for byte.
  - **New `output-nodes/url-path.ts`:** `webAutomationUrlPath`, the one pathname
    rule. It refuses a leading `//` or `/\`, and the extension now imports it.
  - **New `output-nodes/recorded-element-key.ts`:** the element-key rule, moved out
    of `secret-binding.ts` and renamed `webAutomationRecordedElementKey`. Nothing
    outside `domain/src` used the old name.
  - `client/`, `actions/` and the `web-panel-host.ts` labels; tests.
- Decision: a file input recorded with `hasValue: false` must also stay evidence,
  now that the recorder sends no file value. That is `g-runner-upload-input`'s
  task 5.
- Validation:
  - **Supervisor:** `domain` `pnpm check` exit=0.
  - **Supervisor:** `DOMAIN_TEST_BUILD_LABEL=sup47 pnpm test` printed "# tests
    399", "# pass 398", "# fail 1". The one failure is the uncommitted W25 row
    `core-gateway-recording-order.test.ts`, which needs a Core build and is not in
    this commit.
  - **Worker mutations:**
    - 16 guards each failed a test;
    - one guard is masked by the payload guard, and is caught only together with
      it;
    - all were restored and confirmed by SHA-256.
- Not verified:
  - the extension and test-runner compiling against the new exports, which the next
    gates cover;
  - the Lab rows W15, W17 and W28.
- Outcome: Accepted

### 2026-09-13 — f-tab-recording, f-frame-address and f-capability-confirmations: tab changes record and replay, child frames are found by path, and new actions confirm

- Agents: workers `f-tab-recording`, `f-frame-address` and
  `f-capability-confirmations`. The shared page-path helper, the switch to the
  domain's path rule, and the verification are by the supervisor.
- Changed, in `apps/extension/src/`:
  - **P4, recording:** new `background/connection/tab-recorder.ts`.
    - Switching to another page the recording can see records a `browser.tab`
      event with `tab: { operation: "switch", urlPath }`. Closing the recording's
      tab records `{ operation: "close" }`.
    - Both enter through the facade's intake, so each is sent with its input id
      and counted once.
    - Browser and extension pages are not recorded, and neither are tab changes
      made while a command runs.
    - It is wired through `background/index.ts` (`tabs.onRemoved`),
      `connection.ts`, `active-page.ts`, `gateway-payloads.ts` and
      `shared/protocol.ts`, plus one barrel line.
  - **P4, replay:**
    - `runtime/browser-tab.ts` switches to the tab at exactly the recorded path,
      and waits up to the command's timeout for one still opening.
    - `runtime/automation-tab.ts` remembers the previous tab, so a close brings it
      back.
  - **P6:** new `runtime/frame-address.ts`.
    - An action with `frameUrlPath` goes to the one child frame at that path.
    - When several frames match, the recorded id breaks the tie. Otherwise the
      action fails `target_ambiguous` or `target_not_found`, naming paths only.
    - An action without a path is unchanged.
  - **Recorder privacy:** `content/describe-element.ts` no longer reads a file
    input's value, so a chosen file's local name never leaves the page.
  - **Confirmations,** in `runtime-status.ts` and `server-command-channel.ts`:
    - a succeeded upload confirms with `web.user.files_chosen`, and carries no
      value;
    - a succeeded tab switch or close confirms with its input id and `tab`. A
      switch's `urlPath` is the pathname of the tab left in front;
    - the caller's redundant failed-status check is gone.
  - **By the supervisor:**
    - **New `background/connection/recordable-page-address.ts`:** the one rule by
      which the tab recorder and a tab confirmation name a page, under the domain's
      `webAutomationUrlPath`. Before, the tab recorder accepted a pathname beginning
      with `//`, which the confirmation refused.
    - **`runtime/command-options.ts`** imports `webAutomationUrlPath` instead of its
      own copy, which let a protocol-relative host through as a frame path.
  - Tests throughout.
- Decisions:
  - **The tab worker's extra wiring is accepted:** `connection.ts`'s constructor and
    the barrel line. Without them nothing called the recorder.
  - **`chooseFrame` takes the frame list,** and the top frame never matches by path.
    Both accepted.
  - **Every confirmation's `url` still carries the full URL,** as a recorded event's
    does. That predates this work, and is not changed here.
- Validation:
  - **Supervisor,** extension gate `sup50`, on diffs frozen after the last change:
    - `pnpm check` exit=0;
    - `EXTENSION_TEST_BUILD_LABEL=sup50 pnpm test` printed "# tests 462",
      "# pass 462", "# fail 0";
    - the structure audit passed.
  - **Supervisor,** content harness: the `redaction`, `recorder-trust`, `identity`,
    `upload-dialog`, `evidence`, `selection-redaction`, `frames` and `keyboard`
    specs gave exit=0, "78 passed". That run came before the page-path helper,
    which changes background files only.
  - **Supervisor mutations:**
    - with the old frame-path rule back in `command-options.ts`, its test failed
      "not ok 2" (9 tests, 8 passed). Restored byte-identical, 9 of 9 passed.
    - with `recordablePageAddress` missing the domain rule, "not ok 2" (2 tests,
      1 passed). Restored byte-identical, 2 of 2 passed.
  - **Worker mutations,** each failing its rows: eight for the tab recorder, four for
    the frame lookup, and six plus seven for the confirmations.
  - **An earlier supervisor gate, `sup43`,** failed 2 active-page tests, plus a type
    error in `active-page.test.ts`, while the tab worker was mid-edit. `sup50` is
    the gate on the finished files.
- Not verified:
  - **No browser or Lab run,** so none of these was seen live:
    - Chrome's close-then-activate order;
    - the path lookup against the real `chrome.webNavigation`;
    - W15, W17 and W28.
  - The runtime guard's timing on the existing and clone lanes.
  - The `tabs.onRemoved` listener, which no unit test reaches.
- Outcome: Accepted

### 2026-09-13 — d-capability-docs: the architecture pages describe uploads, tab changes, child frames and confirmations

- Agent: worker `d-capability-docs`; the failure-taxonomy line and the
  verification by supervisor.
- Changed, in `docs/architecture/`:
  - **`web-capabilities.md`:**
    - the switch-tab, close-tab and upload rows;
    - a table of the eleven recorded action inputs and their ten outputs;
    - how a file choice, a tab change and a checkbox toggle become actions;
    - a new "Child Frames" section;
    - a confirmation table covering every recorded verb.
  - **`extension-client.md`:** `tab.urlPath`, `frameUrlPath`, the one path rule,
    the three new inputs, and what the tab recorder counts.
  - **`sensitive-values.md`:** a file input never sends its value, and upload
    requests are kept apart from secret requests.
  - **`failure-taxonomy.md`,** by the supervisor: `runtime/frame-address.ts` as a
    producer of `TARGET_NOT_FOUND` and `TARGET_AMBIGUOUS`.
  - **`apps/extension/e2e/content/tests/recorder-trust.spec.ts`,** by the
    supervisor:
    - a chosen file, set from disk, is recorded as a trusted change on a file input
      with `hasValue: true` and no value;
    - no message or snapshot carries Chrome's fake path or the file's name.
- Decisions:
  - **The corrected checkbox bullet is accepted:** the recorder now reports
    `checked`.
  - **A confirmation's `url` carries the full result URL,** and the page now says
    so plainly.
- Validation:
  - **Supervisor:** the worker's link checker, read before running, over all four
    pages: exit=0, "checked 78 relative links in 4 page(s), 0 unresolved".
  - **Supervisor:** `node scripts/structure-audit.mjs` printed "passed (40
    warning(s), 17 baselined)".
  - **Supervisor, spot-checked against source:** an unanswered upload request is
    refused before dispatch as `USER_INTERVENTION_REQUIRED`
    (`domain/src/client/gateway-mapping.ts:151-155,366-369`).
  - **Supervisor, content harness mutation for the recorder row** (`sup53`):
    - before the mutation, "1 passed";
    - with the file-input guard removed from `content/describe-element.ts`, "1
      failed", on `not.toHaveProperty`;
    - restored byte-identical, "1 passed".
    - An earlier attempt (`sup51`) failed before the row ran, on a manifest the
      stale shared contracts build rejected. It proved nothing, and was rerun once
      the build was current.
- Not verified:
  - anchors are matched by the checker's own slug rule, not by a renderer;
  - the `hasValue: false` rule rests on `g-runner-upload-input`'s uncommitted
    change, so these pages are committed with it.
- Outcome: Accepted

## Part thirty-nine, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the runner's upload input, committed in d0d81c3.

### 2026-09-13 — g-runner-upload-input: the Flow lane supplies the file a recorded upload asks for, and a cancelled file choice stays evidence

- Agent: worker `g-runner-upload-input`; verification by supervisor.
- Changed:
  - **New `packages/test-runner/src/flow-lane/declared-uploads.ts`.** For each node
    that asks for files, it checks the node's `web.upload.<key>` path against the
    domain's key for that node's recorded control. It then supplies
    `{ files: [{ name, mimeType, contentBase64 }] }`, with the same bytes the
    recording lane uploads. The run fails before it starts if a path does not
    match, or if the script's upload steps do not name exactly one file.
  - **`flow-lane/run-flow-lane.ts`:** those inputs go beside the secret inputs.
  - **`apps/scenario-lab/src/scenarios/file-transfer/manifest.ts`:** W17 pins
    `web.dom.upload`, then `web.dom.click`.
  - **`packages/test-contracts/src/recordable-actions.ts`:** `upload` yields
    `web.dom.upload`, and `switchTab` and `closeTab` yield `web.browser.tab`.
  - **`domain/src/io/input-model.ts`:** a file input recorded with
    `hasValue: false` stays evidence, for `change` and `input` alike.
  - Tests.
- Found:
  - **Core holds `[withheld]` for a supplied upload,** in its saved run inputs,
    trace and command attempts. That was read from Core `6621d66`'s code, so a Lab
    run gets it only after a Core build.
  - **The Lab's leak attestation does not look for upload content.**
- Decisions:
  - **The supplied file declares `application/octet-stream`.** The fixture reads
    only name and size.
  - **Several upload files fail closed** until a second scenario needs them.
  - **The Lab rerun searches Core's workspace for the upload content directly**
    (`l-stage2c`, run 4).
- Validation:
  - **Supervisor, gate script `sup53`,** one command at a time, on the diff frozen
    when the worker finished:
    - shared scenario-lab build exit=0;
    - `packages/test-contracts` `pnpm test` exit=0, "# tests 66", "# pass 66",
      "# fail 0";
    - scenario-lab `check` exit=0, and its private build printed "# tests 204",
      "# pass 204";
    - domain `check` exit=0. `DOMAIN_TEST_BUILD_LABEL=sup53 pnpm test` printed
      "# tests 399", "# pass 398", "# fail 1"; the one failure is the uncommitted
      W25 row, which needs a Core build;
    - test-runner `check` exit=0, private `tsc` exit=0, "# tests 555",
      "# pass 555", "# fail 0".
  - **Worker mutations:** nine, each failing as quoted, then restored and confirmed
    by `sha256sum -c`.
- Not verified:
  - no Lab W17 run;
  - Core resolving the upload input over HTTP;
  - Chrome sending `hasValue: false` for a cancelled choice.
- Outcome: Accepted

## Part forty, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: Core's withholding (6621d66) and bridge ordering (949fbb4), and the W25 Core-order row (69f40c1), all committed.

### 2026-09-13 — Core withholding: run inputs and resolved values are withheld at rest, and what a run executes is unchanged (Core `6621d66`)

- Agents: workers `g-core-input-withholding`, `g-core-attempt-withholding` and
  `g-core-withholding-execution`; decisions and verification by supervisor.
  - `g-core-attempt-withholding` was blocked once on its brief's ownership.
  - It was then redispatched to own the whole chain, and amended to cover inputs
    that no node reads.
- Changed, in Core `packages/fluxiq/src/`:
  - **Run inputs at rest.** A run session's `metadata.inputs`, and each run-summary
    envelope, keep every key and replace every value with `[withheld]`. A queued
    session run by `runId` without inputs now runs with none.
  - **Command attempts.**
    - An attempt is built with the values resolved from state bindings withheld,
      in `command.parameters`, `result.message`, `result.error` and
      `attempt.message`. That holds in memory and on disk alike, and the adapter
      still executes the real value.
    - `FluxIQRuntimeDispatchContext` gains an optional `withheldValues`, carried
      from the executor through `io-policy.ts`.
    - The framework owns the marker, `FLUXIQ_RUNTIME_WITHHELD_VALUE`.
  - **The trace.**
    - Each supplied run input is withheld wherever it still holds the supplied
      value. That is done by position: withholding by value broke a Call Flow
      child's port defaults in a probe.
    - A Call Flow parent also withholds what its child withheld.
  - **Execution is unchanged.** A live-patch rerun takes the executed trace, and a
    Call Flow parent builds its outputs from what its child executed.
  - **One text rule,** `runtime/text-withholding.ts`
    (`fluxiqRuntimeTextWithholding`). It is span-based, so an overlapping value
    leaves no fragment and a marker is never rewritten.
  - **Docs:** `runtime-kernel.md`, `automation-studio.md`,
    `automation-studio-native-nodes.md`, the 0.4.0 migration notes in
    `package-boundaries.md`, and both framework references.
- Decisions:
  - **Execution reads real values;** only saved or published copies are withheld.
  - **A known gap for Week 1:** a node that copies an unbound input into another
    key leaves it in clear at that copy. The Flow lane sends only bound
    `web.secret.*` inputs.
  - **Not withheld:** `command.metadata`, `result.payload`, `result.failure` and
    `result.metadata`.
- Validation:
  - **Supervisor,** Core gate `sup52`, on the tree holding both Core units, each
    command run alone:
    - `pnpm docs:reference` exit=0, "1577 public declarations";
    - `pnpm docs:check` exit=0;
    - `pnpm check` exit=0, "structure-audit: passed (122 warning(s), 256
      baselined)";
    - `packages/fluxiq` `npx vitest run --no-file-parallelism` exit=0, "Test Files
      136 passed (136)";
    - `@fluxiq/contracts`, `@fluxiq/client-gateway-websocket` and `@fluxiq/web`
      tests each exit=0, with 1, 1 and 228 files passed.
  - **Supervisor, earlier:** the input-withholding rows, `npx vitest run` over two
    files, "Tests 15 passed".
  - **Worker mutations,** each failing its row and restored byte-identical: 3 for
    the inputs, 8 for the attempts, and 10 for the execution fix.
- Not verified:
  - **No Core `pnpm build` yet.**
  - **No Lab run.** An auth-gate `--flow` run with a kept workspace must show the
    password typed, 0 declared-value hits, and no fragment.
  - A real LLM live patch, and a Call Flow error binding.
- Outcome: Accepted

### 2026-09-13 — g-core-bridge-order: a client's recording messages are stored in arrival order, and a Stop never touches a recording opened during it (Core `949fbb4`)

- Agent: worker `g-core-bridge-order`, with two amendments; decisions and
  verification by supervisor.
- Changed, in Core `packages/fluxiq/src/`:
  - **New `programs/automation-studio/client-gateway/client-recording-write-order.ts`:**
    one ordered chain per client for the five kinds of message that write to a
    recording, joined before the bridge's first await. It also holds the snapshot
    batch queue.
  - **`client-gateway/bridge.ts`:**
    - queued snapshots are written before any direct append, action results
      included;
    - both Stop paths wait for messages received before their drain ends;
    - a Stop removes only the recording it stopped;
    - a start waits for that client's earlier messages.
  - **`client-gateway/service/inbound.ts`:** a client Stop clears
    `activeRecordingId` only while it still names the recording that Stop stopped.
  - **Tests:** `bridge.test.ts`, the new `bridge-restart.test.ts` and
    `client-recording-write-order.test.ts`, and `client-gateway/tests/service.test.ts`.
  - **`client-gateway.md`** states the order guarantee.
- Decisions:
  - **`0e4edea`'s rule is reversed.** That rule stored a recorded event without
    writing queued snapshots first. The mapper's `following` needs storage order,
    so a click's write now waits for one snapshot batch.
  - **Both races the first pass left are fixed,** since the chain lengthened the
    first of them.
- Validation:
  - **Supervisor:** Core gate `sup52` above, which held this unit.
  - **Worker mutations,** each failing its own row, restored in a `finally` and
    hash-checked: 6 for the chain and flush, 4 for the races, and 1 for the session
    id.
  - **One early script had no guard,** and left the original `bridge.ts` on disk
    for minutes. The worker restored the file and hash-verified it.
- Not verified:
  - no Core build yet, so the domain row `f-w25-core-order-row` has not run against
    the fix;
  - W25 live;
  - `stateLink` on a real recording;
  - a Stop overlapping a start, live.
- Outcome: Accepted

### 2026-09-13 — f-w25-core-order-row: the live W25 messages through Core's gateway propose click, wait, click against the fixed Core, and did not before

- Agent: worker `f-w25-core-order-row`; verification by supervisor.
- Changed: new `domain/src/tests/core-gateway-recording-order.test.ts`.
  - It sends the eight live `delayed-ui` messages through Core's real client
    gateway and Automation Studio bridge. All are started without awaiting, as
    Core's WebSocket host receives them.
  - It asserts:
    - 8 entries;
    - the "Compacted 3" issue;
    - the `web` candidates click `begin-delay`, `web.dom.wait_for_selector`
      `late-action`, click `late-action`.
- Validation:
  - **Before the fix, against Core built at `187f40d`:**
    - worker: five runs of the row alone, each failing with 2 candidates;
    - supervisor gates `sup47` and `sup53`: "# tests 399", "# pass 398",
      "# fail 1". The one failure was this row.
  - **After the fix,** supervisor gate `sup55`, against Core `6621d66`'s
    `packages/fluxiq/dist`, rebuilt at 07:18. `DOMAIN_TEST_BUILD_LABEL=sup55 pnpm
    test` gave exit=0, "# tests 399", "# pass 399", "# fail 0", and "ok 380 - W25:
    the live delayed-ui messages through Core's client gateway, received as its
    WebSocket host receives them, propose click, wait, click". This is a single
    observation.
  - **The failure before and the pass after** stand in for the brief's mutation,
    which was to remove the chain and rebuild Core.
- Not verified:
  - the issues assertion requires exactly the one "Compacted 3" message;
  - the row copies the extension's evidence message shape by hand, so it does not
    detect drift in `recording-evidence.ts`;
  - W25 in the Lab.
- Outcome: Accepted

## Part forty-one, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the Lab rerun's first four runs and the W25 timeout investigation, both committed in cfa1bfb, whose follow-ups are dispatched.

### 2026-09-13 — l-stage2c: the fixes hold live for W18, W19 and W25; W15, W17's file name, W28 and W25 `too-slow`'s code do not; the bench was cut short

- Agent: worker `l-stage2c` (Lab), with a duplicate copy that ran after the
  supervisor's restart; verification by supervisor.
- Pins: this repository `69f40c1` and Core `6621d66`, both `dirty=false` in every
  `run.json`. Runs are under `F:\fxlab-runs\stage2c\`.
- Found in runs 1-4. Each row is a single observation. Two runs crashed in the
  faulty-RAM shape, and each passed when rerun alone.
  - **W18 `auth-gate`, both lanes: passed 3 of 3 on each lane.**
    - The leak attestation reported `findingCount` 0, with no `unscanned-store`.
    - A search of each kept Core workspace, SQLite cells included, found the
      declared value 0 times. Stage 2 had found it in 13 JSON objects and 4 SQLite
      rows.
    - The password node's `web.dom.type` succeeded, and its saved attempt holds the
      withheld marker.
  - **W19 `expired`, Flow lane: passed 3 of 3,** with `auth_required`. The recording
    lane refuses `--variant` by design (`commands.ts:42`), so that half of the brief
    could not run.
  - **W25 `delayed-ui`.**
    - Unarmed: passed 3 of 3, with 3 candidates (click, wait, click).
    - `too-slow`: failed 3 of 3 on the right category, `timeout`. But the code was
      Core's `output_dispatch.timed_out`, not the expected `web.action.timeout`.
  - **W15 `multi-tab`, unarmed and `popup-blocked`: 0 of 6.**
    - The Flow's first node is a tab close that names no tab. It timed out at Core's
      deadline.
    - Rerun once, alone, the extension rejected it: `web.action.rejected`, "no tab
      named and none open".
  - **W17 upload: passed 3 of 3,** upload then click.
    - The file's content appears in Core's workspace 0 times.
    - Its name appears twice per run, in the upload attempt's
      `result.payload.result.validation.expected` and `.actual`.
  - **W28 frames: 2 of 3.** Run 2 recorded a second scroll, ran it, then stopped with
    no failure record.
- Interruption:
  - **Two copies ran.** The supervisor's session restarted at 08:02, and the
    pre-restart session's copy of this worker kept running beside the resumed one.
    They wrote two Run 4 sections; the second is marked withdrawn.
  - **The bench was cut short.** At 08:22 the user killed every session. That
    stopped run 5, the week1 bench, after 5 of its 67 rows. Run 5 is not reported,
    and it runs again on the fixed tree.
- Decisions:
  - **W25 `too-slow`'s code** goes to `i-w25-timeout-code`, then to
    `g-core-dispatch-deadline`.
  - **W15 and W28** go to `i-w15-w28-flow-order`.
  - **W17's file name** goes to `f-upload-validation-names`. A chosen file's name is
    the user's data.
- Validation: the supervisor read every bundle's `evaluation.json` and `run.json`
  with `sup-bundle-check.mjs`, which prints ids, verdicts and failure codes only.
  All 28 agree with the report:
  - W18: 6 `passed`;
  - W19: 3 `passed`, with `auth_required/web.auth.required`;
  - W25: 3 `passed`;
  - `too-slow`: 3 `failed`, with `timeout/output_dispatch.timed_out`;
  - W15: 6 `failed`, with `timeout/output_dispatch.timed_out`, plus the rerun with
    `blocked_by_capability_or_policy/web.action.rejected`;
  - W17: 3 `passed`;
  - W28: 2 `passed`, and 1 `failed` with `ambiguous_or_unknown`.
- Not verified:
  - candidate counts and action lists, which were read only from the report;
  - the kept-workspace searches and the SQLite probe;
  - run 5.
- Outcome: Revised

### 2026-09-13 — i-w25-timeout-code: Core gives up on a command at the moment the extension is told to stop waiting, so Core always reports first

- Agent: worker `i-w25-timeout-code` (read-only); decision by supervisor.
- Found:
  - **The default timeout.** A proposed wait has no timeout of its own, so its node
    takes the 5,000 ms default (`nodes/policy/action.ts:20,40`). Core uses that one
    value three ways:
    - its runtime deadline (`runtime/service.ts:361-371`);
    - its client-gateway deadline (`client-gateway/service/commands.ts:65-70`);
    - the timeout it sends the extension (`client-gateway-transport.ts:172`).
  - **The extension's clock starts later,** after the tab settles for at least
    1,000 ms (`automation-tab.ts:137`). In the three `too-slow` runs the wait ended
    at 5,005, 5,011 and 5,004 ms, with Core's code.
  - **The fix changes one verdict:** W25 `too-slow`. In other rows it would change
    a code, not a verdict.
  - **Stale comments:** `delayed-ui/scenario.ts:16-19`, `late-target-wait.ts:15` and
    `action-runner.ts:197-198`.
- Decisions: the thirty-first dispatch.
  - Both Core deadlines wait the timeout plus a named margin.
  - The client still receives the timeout.
  - `output_dispatch.timed_out` keeps meaning a client that never answered.
  - The user was told this crosses into Core.
- Validation: the supervisor's bundle check, recorded in the entry above, shows the
  three `too-slow` runs reporting `timeout/output_dispatch.timed_out`. The worker's
  timings (`node -e` over `run.json`) were not rerun by the supervisor.
- Not verified:
  - when the extension's own answer arrived;
  - how large the margin needs to be under load.
- Outcome: Revised

## Part forty-two, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the W05 short-catalog decision and the upload validation fix, both committed in af80298.

### 2026-09-13 — i-w05-short-catalog: W05 `short-catalog` is a real product gap, ruled out of Week 1 once the Lab shows its failure

- Agent: worker `i-w05-short-catalog` (read-only); decision by supervisor.
- Changed: `reports/i-w05-short-catalog.md` only.
- Found, from code. These are predictions until the Lab observes them:
  - **What the Flow does.** A Flow built from W05's recording is two Next clicks,
    with a wait before the second.
    - `short-catalog` shows five products and no Next, so the first click fails
      `target_not_found`.
    - The final state still holds.
    - The run therefore fails only because the variant expects success.
  - **What Core lacks.** Core already has loop and branch nodes. It lacks a web
    output that answers whether Next is present, and a recording mapper that builds
    the loop.
  - **The Week 2 entry point.** `web.dom.extract_list` with `paginate` already pages
    until Next is absent, but nothing produces it from a recording.
- Decision: option (d).
  - **No code change.** `product-catalog/manifest.ts:66-75` and `week1.ts:34` stay
    as they are.
  - **Ruled out once observed.** When the Lab recheck records the failing node and
    category, W05 `short-catalog` joins "Ruled out of Week 1", beside W13
    `banner-absent` and W24 `unannounced`. The row stays in the corpus and keeps
    failing visibly.
  - **Rejected:** declaring the failure as expected (a), and moving the variant to
    the recording lane (c). Both would hide the gap.
- Validation: the supervisor read the report's option analysis. No code ran; the
  prediction rests on reading, and `reports/l-stage2c.md` holds no W05 observation.
- Not verified: the live failing node and category, and whether a wait comes before
  the first click.
- Outcome: Revised

### 2026-09-13 — f-upload-validation-names: the upload's check and its refusals quote no file name

- Agent: worker `f-upload-validation-names` (Partial). The refusal reasons and the
  verification are by the supervisor.
- Changed, in `apps/extension/`:
  - **`src/content/actions/upload.ts`:** the post-condition's `expected` and `actual`
    give only the count of files and whether their names match, for example
    `1 file, named as requested`.
    - The check still passes only when the input holds exactly the requested names,
      in order.
    - Otherwise it still fails `output_not_observed`.
  - **New `src/content/actions/tests/upload.test.ts`.**
  - **`src/content/action-runtime/file-input.ts`,** by the supervisor: a refusal
    names a file by its position ("file 1"), never by its name, and the header says
    why.
  - **`e2e/content/tests/upload-dialog.spec.ts`:**
    - the two upload rows assert that no name appears;
    - a new row, by the supervisor: a refusal names a file by position.
- Found: nothing reads the upload validation's text as names. The worker checked the
  domain's classifier and adapter, Core, the runner and the bench.
- Validation:
  - **Supervisor, `sup60`:**
    - `EXTENSION_TEST_BUILD_LABEL=sup60 pnpm test` printed "# tests 468", "# pass
      468", "# fail 0";
    - `upload-dialog.spec.ts` gave "7 passed";
    - extension `pnpm check` exit=2, on a type error in the supervisor's new row
      (`validation?.actual` on a union).
  - **Supervisor, `sup61`,** after that row was rewritten as a `toMatchObject`:
    extension `pnpm check` exit=0, and `upload-dialog.spec.ts` "7 passed".
  - **Supervisor mutation, content harness:** quoting the name in the base64 refusal
    failed the new row ("1 failed"). Restored byte-identical, "1 passed".
  - **Worker mutations:** putting the names back failed all six new unit rows, and
    making every upload pass failed the three mismatch rows.
- Not verified:
  - a Lab W17 run showing the name 0 times in Core's saved attempt;
  - `pnpm build`, since the tracked `build/` still holds the old content script.
- Outcome: Accepted

## Part forty-three, archived 2026-09-13

Moved verbatim on arrival to keep headroom under the plan limit: the W15 and W28 start-node investigation and the architecture pages audit, whose follow-ups are dispatched.

### 2026-09-13 — i-w15-w28-flow-order: a Flow built from a recording starts at the first node by id, and `entry.10` sorts before `entry.9`

- Agent: worker `i-w15-w28-flow-order` (read-only); decisions and verification by
  supervisor.
- Changed: `reports/i-w15-w28-flow-order.md` only.
- Found:
  - **The start rule.**
    - A Flow with no `builtin.control.start` node begins at `flow.nodes[0]`.
    - The saved graph is read back `order by node_id`.
    - Recorded node ids carry an unpadded entry number, so in a recording of more
      than ten entries a later action can become the start.
    - The links between actions are right; only the start is wrong.
  - **W15** starts at its tab close, in 7 of 7 runs. Nothing is driven yet, so the
    close has no tab to act on. Its six timeouts belong to the dispatch deadline.
  - **W28 run 2** (12 entries) started at its last scroll. The scroll succeeded, but
    no next action followed while three were unvisited. Core ended the run with no
    failed attempt and no failure record.
  - **W28's second scroll** probably came from a frame. The bundle cannot prove it.
  - **Other rows.** The same rule may explain other Flow-lane failures in earlier
    benches.
- Decisions: the thirty-sixth dispatch.
  - **Fix the start in Core** (`g-core-start-node`), and **fail a Flow-lane run that
    does not start at its first action** (`g-runner-start-guard`).
  - **Fix 3 is not taken.** Closing the active tab when none is driven would close a
    tab FluxIQ never opened.
  - **Fix 4 waits** for a Lab run that keeps W28's Core workspace.
  - The user was told this crosses into Core.
- Validation:
  - **Supervisor, at Core `604d0d3`:**
    - `git show HEAD:…/runtime/executor/graph-navigation.ts`: `findStartNode` returns
      the `builtin.control.start` node `?? flow.nodes[0]`;
    - `…/storage/project/graph-store.ts`, `exportSnapshotData`:
      `select * from graph_nodes where flow_id = ? and deleted_at_ms is null order by node_id`.
  - **Worker probes:** a JavaScript sort, and SQLite running Core's query
    (`node --experimental-sqlite`), both put `entry.10` ahead of `entry.9`.
- Not verified:
  - the real entry numbers of W15's and W28's actions, since no workspace was kept;
  - Core's reason for stopping W28 run 2;
  - which frame scrolled;
  - the other week1 rows.
- Outcome: Revised

### 2026-09-13 — i-arch-pages-audit: six of eight architecture pages contradicted the code or left out this session's behaviour

- Agent: worker `i-arch-pages-audit` (read-only); decisions by supervisor.
- Changed: `reports/i-arch-pages-audit.md` only.
- Found, by page:
  - **`testing-facility.md` was furthest off.**
    - It said the auth-gate sign-in page prints its password.
    - It said an expected action with no outcome means `succeeded`.
    - It said isolated runs never build a Flow.
    - It said the leak checks skip databases.
    - It said Core's recording-start window is 10 s; it is 300 s.
    - It missed three fixtures, and no page described the Flow lane or the bench.
  - **`extension-client.md`** lacked the start-once rule, the page-change flush, and
    the late-target wait.
  - **`element-identity.md`** gave the scan bound as 600 elements; it is 5,000.
  - **`sensitive-values.md`** did not say how a withheld run input is handled.
  - **Three smaller pages** had stale dates and small gaps.
  - **`run-scenario.ts:270-277`** repeated two of the stale claims.
- Decisions: the thirty-fifth dispatch, with one docs worker per page group. Areas
  still in flight are left for later.
- Validation: the auth-gate claim matches `1d1e756`, which this session replaced
  with a placeholder. The docs workers' changes are validated at integration.
- Not verified: the probe step's 1 s bound, and what `frames.spec.ts` proves about
  child frames.
- Outcome: Revised

## Part forty-four, archived 2026-09-13

Moved verbatim to keep headroom under the plan limit: the architecture pages pass, committed in 696e8a8.

### 2026-09-13 — the architecture pages match the code at HEAD (four docs workers, from `i-arch-pages-audit`)

- Agents: workers `d-testing-facility-page`, `d-extension-client-page`,
  `d-identity-evidence-sensitive-pages` and `d-capabilities-layout-taxonomy-pages`.
  Two links and the verification are by the supervisor.
- Changed, in `docs/architecture/`:
  - **`testing-facility.md`.**
    - It no longer says the sign-in page prints its password, that a missing
      outcome means `succeeded`, or that isolated runs never build a Flow.
    - It gains sections on the recording and Flow lanes, the lane rules, the
      recording checks, the run leak check with SQLite, declared secrets and
      uploads, and the bench.
    - It lists 25 fixtures, and describes the content-script harness.
  - **`extension-client.md`:** the start-once rule, the page-change flush, and a new
    section, "A Wait Before A Late Target".
  - **`element-identity.md`:** the 5,000-element scan bound, and the late-target
    wait, linked to that new section.
  - **`sensitive-values.md`:** the upload name rule, and how Core withholds a
    declared secret sent as a run input.
  - **`page-evidence.md`, `web-capabilities.md`, `repository-layout.md` and
    `failure-taxonomy.md`:** smaller corrections, and the content-harness commands.
    Both command forms ran.
  - **`packages/test-runner/src/run-scenario.ts`:** a comment no longer repeats the
    10 s window or the "stays idle" claim.
  - **`briefs/finish-week1.md`:** the binding rule no longer says the `test:content`
    filter form finds no tests.
- Incident: one worker's search printed the auth-gate fixture password into its own
  tool output. No file holds it: the supervisor's scan counted 0.
- Validation:
  - **Supervisor, `dcd-check-links.mjs` over all eight pages:** exit=0, "checked 137
    relative links in 8 page(s), 0 unresolved".
  - **Supervisor, `node scripts/structure-audit.mjs`:** "passed (41 warning(s), 17
    baselined)".
  - **Supervisor, spot checks in `testing-facility.md`:**
    - an entry with no `outcome` "is judged on the attempt's presence alone"
      (`:684`);
    - a contract rejection is `fixture.invalid` (`:704`);
    - the auth-gate row "shows a placeholder where the password would be" (`:745`).
  - **Supervisor, `secret-count.mjs`** over every architecture page and the
    testing-facility report: "hits=0".
  - **Worker:** `test:content`, and the direct Playwright form, each ran 12 tests on
    `select.spec.ts`.
- Not verified:
  - rendering in a Markdown viewer;
  - plan-history wording older than the audit, which was left in place;
  - the Flow lane's new early-stop check, which `g-runner-start-guard` adds.
- Outcome: Accepted
