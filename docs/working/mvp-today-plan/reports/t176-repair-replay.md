# t176: repair and deterministic replay (lane lead report)

Lane t176, 2026-09-29. Trees: `C:\Users\osrs_\FluxStuff\fxwork\t176\!FluxIQWebExtension`
and Core `C:\Users\osrs_\FluxStuff\fxwork\t176\!FluxIQ`, branch `task/t176-repair-replay`.
Nothing committed. No live run, no Lab or browser run, no provider call.

## Outcome

**Done, with named follow-ups.** The MVP chain now runs provider-free through
the real service, with a scripted provider that answers from what it is sent:

- the created Flow runs and returns the wrong dataset;
- the judge refutes it with a directive;
- the re-author receives the directive in its brief and reruns the extract step
  with the corrected parameter;
- the edit is persisted (the adaptation is `applied` and the graph holds `where: "red"`);
- the same-run re-run is judged right (`succeeded`, outcome `answered`);
- two no-grant replays return the right rows with 0 provider calls and an
  explicit zero-cost gate, and the second makes the repair `established`.

The test is `runtime/tests/refuted-result/tests/repair-replay-chain.test.ts`
(Core paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`).

**Grants.** Per the user directive, grants are being removed and t186 owns
that. I withdrew my grant-code changes: `llm/execution/grants.ts`, `index.ts`
and the grant tests are byte-identical to HEAD, and the new
`grant-call-failure.ts` is deleted. I also dropped the chain's revoke
assertions. The chain asserts nothing about grants; only its harness still
resolves the provider through today's grant registry, the only resolution Core
has.

## Breaks found and fixed (each with a test)

### 1. Rank 6: the re-author died anonymously

- **Cause, already fixed, now guarded.** Both live incidents (`run-mulxk0ro`,
  `run-mum06sfc`) ran on Core builds without c25c0fb, the draft denied-key
  screen; 8b56084 lacks it. A seeded click step holding `selector` made
  `packEvidenceLoop` throw a plain `Error` before the first call.
- The chain Flow has exactly that shape.
- **Fail-before, measured:** with the screen disabled (temporarily, restored
  with no diff), the chain stops after the two judgements.
- **Withdrawn for t186:** a second anonymous route I found and fixed.
  - Every grant guard inside `runTask` threw a plain `Error`, which the provider
    call normalizes to `llm.provider_request_failed`, invocation `unknown`.
  - Measured: a re-author whose grant hit its call cap after decision 1 recorded
    `flow_bootstrap.provider_transport_unknown`, although no request was sent.
  - If any per-call refusal survives the grant removal (for example consequence
    permissions refused inside the provider call), it should be thrown as a
    typed `AutomationStudioLlmProviderError`, such as
    `llm.provider_secret_unavailable` with `not_attempted`/`not_received`.
    Otherwise the same anonymous record returns.

### 2. The directive pointed the re-author at the end node

- **Defect:** Core's first fix line said "the Flow's last step is end
  (builtin.control.end)" (measured).
- **Fix:** `result-verification/repair-directive.ts` skips the derived start and end nodes.
- **Test:** `result-verification/tests/repair-directive.test.ts` (+1; fails
  before, passes after).

### 3. A provider-free replay could not be certified (t179 finding)

- **Defect:** only the recovery wrote `llmGate.costAccounting`.
- **Fix:** `result-verification/zero-provider-run.ts` (new) builds
  `{ invoked: false, ok: true, costAccounting: {all 0}, providerCalls: [], providerCallsOmitted: 0 }`
  for a run with no gate, no intervention and no verification call.
  - `run-outcome.ts` writes it **in the same save as the verdict**
    (`recordOnRunDetail`), never as a second read-modify-write. My first
    version did a second write, and the broad run caught it: 9
    `run-outcome.test.ts` failures.
  - It carries no `code`, so the Lab does not read it as a refusal. A run that
    asked a model is never written over.
- **Tests:** `result-verification/tests/zero-provider-run.test.ts` (5) and the chain.

### 4. Nothing recorded replays, so `established` was unreachable (t179 finding)

- **Recorder:** `service/runtime-adaptation/adaptation-replays.ts` (new) judges
  every adaptation stamped on the run's attempts with
  `recordAutomationStudioAdaptationReplays`, and saves each proved or
  contradicted result, one per run.
  - It reads and writes a **Flow Bootstrap** adaptation as itself. Those carry
    the stamps of created and repaired Flows, and keep their own
    `validationResults`. `getFlowAdaptation` answers them as a view with no
    results, and `saveFlowAdaptation` would write a shadow copy into the
    runtime store.
- **Wiring:** a new optional port, `recordAdaptationReplays`, which
  `run-outcome.ts` calls right after that save for a run that asked no model.
  - **`runtime/service.ts` (outside my list):** one port property inside the
    existing `resultPorts` literal, plus one name in an existing import. Two
    lines changed in place; the file stays at 4547 lines.
- **Tests:** `service/runtime-adaptation/tests/adaptation-replays.test.ts` (3).
  In the chain, the repair goes `provisional` then `established`.

### 5. No extraction Flow's replay could prove its change

- **Defect:** the saved trace holds `{ $dataset: { recordCount } }`, but
  `automationStudioAttemptCapturedRecords` counted only arrays, so the verdict
  was `unverifiable` (measured).
- **Fix:** `flow-change/attempt-projection.ts` reads the marker. **Outside my
  list;** no lane owns `flow-change/`. Without it, item 4 never reaches
  `established` for extraction Flows.
- **Test:** `flow-change/tests/attempt-projection.test.ts` (new; fails before,
  passes after).

### 6. The Lab settled a repair in flight as a failed run

- **Defect:** Core saves `failed` with `resultRepair.phase: "reauthoring"`
  before the re-author starts. `pendingWork` ignored `phase`, so past the
  request's 300 s cap the Lab took the refuted detail, or gave it the 5 s grace.
- **Fix:**
  - `flow-lane/terminal-run-wait.ts`: a new pending kind, `repair`, checked
    first, which keeps the full granted bound. If it is still in flight at the
    lease it is reported `unsettled: "repair"`.
  - `flow-lane/persisted-flow-run.ts`: the non-timeout path re-reads on it too.
- **Tests:** `flow-lane/tests/terminal-run-wait.test.ts` (+2; both fail before, 8/8 after).

### 7. The Lab's repair lane replayed nothing for a wrong-answer repair

- **Defect:** a repair the re-author applied in the run left no proposal, so
  `--replays` found `no_proposal`, replayed nothing and passed. With a declared
  `temporary_target_override`, it failed as `not_proposed` instead.
- **Fix:**
  - `flow-lane/repair/run-repair-lane.ts` (`resultRepairOf`) proves the
    re-author's already-applied adaptation and skips the runtime-patch
    expectation.
  - `repair/replay-repair.ts` and `repair/prove-repair.ts`: every replay must
    reproduce the judged run's datasets row for row (`datasetsReproduced`), or
    fail as "not deterministic".
- **Tests:** `flow-lane/repair/tests/run-repair-lane.test.ts` (+2).

### 8. Write `snapshots/adaptation.json` (supervisor, via t179)

- **Added:** `flow-lane/adaptation-snapshot.ts` (new), which measures and
  writes, and writes nothing when the read fails.
- **Test:** `flow-lane/tests/adaptation-snapshot.test.ts` (3).
- **Not wired:** t179's `readRunAdaptationMeasurements` exists only
  uncommitted in t179's tree. After t179 merges, add one line in each
  `run-scenario.ts` `flowRunHooks` publish callback (around `:384` and `:482`):
  `await writeFlowLaneAdaptationSnapshot({ bundle, path: RUN_ADAPTATION_SNAPSHOT, measure: () => readRunAdaptationMeasurements(control, { projectId, flowId: evidence.flowId, runId: evidence.run.runId }) });`

### 9. The created lane judged dataset tasks by records only (supervisor, via t184)

- **Fix:** `flow-lane/creation/oracles.ts` (new).
  - A dataset task whose workflow declares `finalState` is held to both oracles,
    and passes only if neither failed.
  - The failure names which failed. When both fail, "; and the scenario's final
    state did not hold afterwards" is appended to the records' own message.
  - `oracles` is on the evidence and in `snapshots/flow-lane.json`.
- **Tests:** `creation/tests/lane.test.ts`: 3 new tests, and 2 call-list tests
  updated where they pinned the old no-oracle behaviour.

### 10. Permission points (supervisor, via t184)

- **Declaration:** `permissionPoint: { consequence, control, askFirst? }` on a
  task, parsed strictly in `creation/instruction-task.ts`.
- **Judgement:** `creation/permission-point.ts` (new). A stop is at the
  declared point when the class is in Core's `missing` and `controlName` matches
  the declared label, ignoring case and spacing. An unnamed control is stated
  as `unnamed`.
- **Lane:** `lane.ts` returns `{ permissionStop }` as the pass and writes it
  with `failure: null`. A stop elsewhere fails, with `details.permissionPoint`
  giving the reason: `no_point_declared`, `class_not_missing` or
  `control_differs`.
- **`askFirst` (check-first inversion):** when the instruction says to ask
  first, a Flow built without asking fails as `not_asked`, and nothing is
  applied.
- **Declarations (outside my list):** in `apps/scenario-lab/.../live-tasks.ts`,
  with labels checked against fixture source, plus the optional type field in
  `live-instructions.ts`:

  | Task | Consequence | Control |
  | --- | --- | --- |
  | crossborder buy-hub | `move_money` | "Place order" |
  | bigbox pickup-order | `move_money` | "Place order" |
  | job-board apply-quillmark | `send_or_publish` | "Submit application" |
  | job-board apply-quillmark-check-first | `send_or_publish` | "Submit application", `askFirst` |
  | photo-social moon-jar-price | `send_or_publish` | "Send" |
  | social-feed move-open-day | `delete` | "Move" |
  | company-website book-service | `move_money` | "Confirm and pay £30.00" |

  t184's uncommitted edits in those files do not touch these lines.
- **`packages/test-runner/src/run-scenario.ts` (outside my list):** a two-line
  branch so the stop reaches `verdict = "passed"` without reading `lane.run`.
- **Tests:**
  - `creation/tests/permission-point.test.ts` (new): the six tasks against five
    cases each, plus the parser including `askFirst`.
  - `lane.test.ts` (+4): the declared stop passes; another control fails;
    `askFirst` without asking fails; `askFirst` with the stop passes.
  - `apps/scenario-lab/src/scenarios/tests/live-instructions.test.ts` (+1) pins
    the seven declarations.

## Validation (commands and observed output)

Core, in `packages/fluxiq`:

- `npx tsc --noEmit`: exit 0, after the final edit.
- `node scripts/structure-audit.mjs` (Core root): "structure-audit: passed (194
  warning(s), 355 baselined)". The first run flagged my empty `catch`, now
  named as `best-effort`.
- `npx vitest run` over `result-verification`, `recovery`,
  `service/runtime-adaptation`, `flow-change`, `adaptation-confidence`,
  `llm/tests/execution-grant` and the chain test, `--minWorkers=1 --maxWorkers=2`:
  "Test Files 63 passed (63) / Tests 840 passed (840)".
- `reauthor-service.test.ts` alone, 1 worker: "Tests 9 passed (9)".
- Broad run (`runtime/tests`, `service`, `executor` and more): 175 of 183 files
  passed.
  - 9 real failures: `run-outcome`, from my second-write design, fixed above.
  - The rest were 15 to 60 s timeouts, an `EBUSY` on SQLite, and a timing budget
    (867 ms against 500 ms), with the CPU at 100% from other lanes.
  - Every file that failed then passed in isolation with 1 worker:
    - `subflow`, `scale-pages`, `runtime-patches`;
    - `iterating-recovery`, `recovery-trace`, `execution-digest`, `llm-diagnosis`
      (19/19);
    - `reauthor-service` (9/9).
  - The whole broad set was not re-run green in one invocation.

Downstream:

- `packages/test-runner`: `pnpm build` (tsc) clean, then
  `node --test "dist/flow-lane/**/*.test.js"`: "# pass 311 # fail 0".
- `apps/scenario-lab`: `tsc --noEmit` exit 0; `pnpm build`, then the
  `live-instructions` test: "# pass 10 # fail 0".
- Downstream `node scripts/structure-audit.mjs`: "passed (117 warning(s), 120 baselined)".

## Not verified

- **No live or browser run.** Whether a live re-author now applies an edit, and
  whether live Core names the controls above in `controlName`, is unmeasured.
- **Fail-before was executed** for items 1 (draft screen), 2, 5 and 6. For 7, 9
  and 10 it holds by construction and was not executed.
- **Replays are recorded only for succeeded runs that asked no model.** A failed
  replay, which should demote, is not recorded; that needs the failed-run exit
  in `service.ts`.
- **Runtime-patch adaptations are stamped only by the project-database store**
  (`storage/project/adaptation-store.ts`). Replays were proved only for Flow
  Bootstrap adaptations.

## Follow-ups for other owners

1. **t186 (grant removal).** My owned code that will need their new provider
   path, which I did not pre-empt:
   - `service/runtime-adaptation/refuted-result-port.ts`: it needs
     `executionGrant`, reads the binding for the grant, and uses
     `applyAndContinue` to set `replayReady`.
   - `reauthor-continuation.ts`: the grant continuation after apply. With no
     grant, apply alone should mean `replayReady`.
   - `result-check.ts`: resolves the judge through the verification grant.
   - The chain test harness: its resolver.
   - Keep per-call refusals typed (item 1).
2. **`test-contracts` `RunHarnessRecovery`:** the Lab still parses
   `resultRepair` and `resultReauthor` in the old shape, so `phase`, `outcome`,
   `attempts`, `degraded` and `replayReady` never reach the Lab's record.
3. **t179 merge:** the one-line snapshot call per lane (item 8).
4. **Run-level permitted consequences:** "should have stopped" for a
   non-`askFirst` task needs the run's permitted classes, which today live on
   the grant. Wire them to the lane once t186 defines consequence permissions.
5. **`flow-bootstrap` (t175):** `automationStudioFlowBootstrapFailureDiagnosticOf`
   maps any plain `Error` at `provider_request` to `unexpected_error`, and knows
   no grant or permission refusal codes.
