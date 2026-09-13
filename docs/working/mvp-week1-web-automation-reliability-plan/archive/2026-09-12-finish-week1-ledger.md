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

