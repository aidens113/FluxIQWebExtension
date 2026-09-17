# w2-core-failed-start-and-reads — worker report

Repository: FluxIQ Core (`F:\!FluxIQ`). `AS/` = `packages/fluxiq/src/programs/automation-studio/`.
Nothing was committed or pushed. No live provider calls were made.

## Outcome

**Done.** All three parts are finished:

- **Task 1, the failed start:** fixed.
- **Task 2, the five swallowed reads:** each now propagates.
- **The coordinator's addition:** the service promotes by confidence tier, and the old `validated`
  input and `adaptationConfidenceScore` are deleted.

Every change has a test that failed on the unchanged code for the intended reason and passes now.

**Checks:**

- `service.ts` went from 6415 to **6405** lines.
- Core `pnpm check` exits 0.
- Runtime + API suite: 1467 passed, 1 skipped, 3 failed.
  - The 3 failures were two 15 s timeouts and one Windows `EPERM` when deleting a temp directory.
  - All 3 files passed when rerun on their own (11 of 11).

## What changed and why

### Task 1: a run that throws no longer stays active

**What happened before.** `runRuntimeSession` wrote the session as `queued`, and later as `running`.
Only the Flow's execution was inside `try`/`finally`. So:

- A throw before that point (the history read, the code-owned compilation refusal, the "running" write,
  `materializeRecordingDerivedFlow`) left the session `queued` or `running`.
- The grant was not revoked, and the abort controller stayed registered.
- A throw inside the execution revoked the grant, but still left the session `running`.
- A `queued`/`running`/`waiting` adaptive session makes admission refuse the project's next adaptive run.
- **A second grant leak:** when admission refused an explicit LLM run ("Only one adaptive runtime run
  can be active per project"), its grant was never revoked either.

**New module `AS/runtime/service/runtime-session/`** (barrel `index.ts`):

- `ending.ts`: `endAutomationStudioRuntimeSessionAfterThrow(ports, projectId, runId, error)`.
  - It re-reads the session. Only a session that is still `queued` or `running` is rewritten, as `failed`:
    - `finishedAt` is set;
    - the trace gets `status: "failed"` and `message: <error message>`, and keeps any attempts, values
      and effects it already had;
    - `metadata.runFailure` is set to `{ at, sessionStatus: "queued" | "running", reason }`.
  - A session that is already `succeeded`, `failed`, `cancelled` or `waiting` is left alone. So is one
    that is no longer stored; it is not recreated. This keeps a cancellation that was recorded before a
    later step threw.
  - It returns the caller's error unchanged. If reading or writing the session fails too, it returns an
    `AggregateError` holding both errors, so neither is lost.
- `admission.ts`: `admitAutomationStudioRuntimeSession(ports, projectId, adaptive)`.
  - This is the "one adaptive run per project" block, moved out of `service.ts` unchanged except that
    its session listing is now strict (read 3113 below).
  - Moving it is what paid for the new lines in `service.ts`.

**`service.ts` `runRuntimeSession`:**

- `let session: AutomationStudioRuntimeSession | undefined` is declared before a `try`.
- That `try` now starts right after the two up-front refusals (bad grant flags, and a grant with an
  idempotency key). Those two already revoke the grant. So the idempotency lookup, the lookup of an
  existing session, admission, the start and the whole run are all inside it.
- **New `catch`:** if a session exists, it calls the ending function and throws what that returns;
  otherwise it rethrows the error.
- **`finally`:**
  - It revokes the grant on every path. This now includes an admission refusal, a failed start, and the
    early return of an already-cancelled existing session.
  - It deletes the abort controller only when a session exists.
- The next adaptive run is admitted once the failed session is written, because `failed` is not an
  active status.

**Scope note.** I also end a run that throws **after** it was marked `running`, because it blocks the
next adaptive run in exactly the same way. The brief only named a failure before the run starts.

### Task 2: each remaining swallowed read now propagates

"Fails closed" means the same thing for every read in `runRuntimeSession`: the run is refused, and a
session that already exists is ended as `failed` by task 1.

| Read | Before | Now | Why |
| --- | --- | --- | --- |
| `service.ts` ~1566, `listAutomationFlowSummaries` → `readFlowIndex` | `.catch(() => emptyFlowSummaryIndex())` | **Propagates** | See note A below. |
| ~3091, idempotency lookup, `listRuntimeSessions` | `.catch(() => [])` | **Propagates** (the run is refused) | With an empty list, a retried request under the same key starts a duplicate run. There is no safe default. |
| ~3113, adaptive admission, `listRuntimeSessions` (now in `admission.ts`) | `.catch(() => [])` | **Propagates** (the run is refused) | With an empty list, a second adaptive run is admitted beside an active one. |
| ~3144, re-reading the canonical Flow, `getFlow` | `.catch(() => undefined)` | **Propagates** (the run fails and its session is ended) | See note B below. |
| `api/handlers/runtime-execution.ts:41`, `getFlowRunDetail` after the run | `.catch(() => null)` | **Propagates, with the run attached** | See note C below. |

**Note A: the flow-index read.**

- An empty index already claims its metadata is current, so the listing returned **no Flows at all**.
  A probe confirmed this: the old code returned `[]` and wrote nothing.
- A malformed file already failed the listing, but only by accident, through the metadata repair's
  write.
- A missing file still reads as empty, because `ProgramJsonStore` returns empty on `ENOENT`.

**Note B: the canonical Flow read.**

- With the read swallowed, a session marked `canonicalFlow: true` ran `session.flow` directly.
- That skipped the code-owned compilation check, the Router/Subflow path, and the adaptation context.

**Note C: the run-detail read in the API handler.**

- I did not rethrow the bare error, because the run has already finished. The answer would lose the
  run id and look like a start failure, and a client retry would start a second run.
- It now returns:

  ```ts
  { ok: false,
    error: "Run <id> ended <status>, but its run detail could not be read: <message>",
    payload: { runtimeSession, runDetailLink } }
  ```

- `durableBehaviorChanged`, `createdAdaptationIds` and `interventionCount` are left out rather than
  reported as `false`/`[]`/`0`.
- The registry already allows `payload` on `ok: false`: `appendRecordingDomainEvent` uses the same
  shape.

### The coordinator's addition: promotion by tier

**`service.ts`:** the exact edits from `w2-c8-promotion-gates.md` §2.

- The import uses `adaptationConfidence`.
- `maybePromoteRuntimeAdaptation`:
  - computes `const confidence = adaptationConfidence(input.adaptation)` and passes `confidence` to the
    gate;
  - its decision record now carries
    `validationStatus: confidence.tier === "unverified" ? "unvalidated" : "validated", confidence: confidence.tier`.
- `reviewFlowAdaptation` writes `confidence: adaptationConfidence(adaptation).tier` in place of
  `confidenceScore`.

**`AS/runtime/recovery/adaptation-promotion.ts`:** `adaptationConfidenceScore` is deleted. Nothing else
in Core or `apps/` referenced it.

**`AS/runtime/training-modes.ts`:**

- `AutomationStudioAdaptationPromotionGateInput` is now `Shared & { patchKinds; confidence }`. The
  `validated` branch is gone.
- The gate's evidence line is `promotionEvidenceRefusal(input.confidence)`.
- **One addition beyond the listed edits:** `promotionEvidenceRefusal` accepts `undefined` and refuses
  it with the "must pass validation" reason. An untyped caller still passing only `validated: true`
  now gets manual review instead of a `TypeError`.
- The file is 396 lines.
- `AutomationStudioProposalApprovalGateInput.validated` is a different gate and is untouched.

**`AS/runtime/tests/training-modes.test.ts`:**

- The six `validated: true` inputs in the policy test became `confidence: tierOf([trial()])`.
- The old both-inputs `@ts-expect-error` case now asserts that `{ ...base, validated: true }` is a type
  error and is refused at runtime.

### Tests (new unless stated)

**`AS/runtime/tests/service-adaptation/tests/failed-start.test.ts`, 8 cases.**

A run whose start throws:

- a failed history read ends the session `failed` with its reason (`sessionStatus: "queued"`), and the
  next adaptive run succeeds;
- a throw after the "running" write (`getFlowRouter` rejects) ends it `failed` (`sessionStatus: "running"`),
  and the next run succeeds;
- a cancellation recorded before a later throw stays `cancelled`, with no `runFailure` (guard case);
- a failed start revokes the explicit LLM grant;
- an admission refusal revokes the explicit LLM grant.

The reads a run's start makes:

- the idempotency lookup read failing refuses the run and starts no duplicate (a dedupe guard is
  included);
- the admission read failing refuses the run and starts no session;
- the canonical Flow re-read failing fails the run, and ends the session with `canonicalFlow: true`.

**`AS/runtime/tests/service-adaptation/tests/promotion-tier.test.ts`, 3 cases.** They drive the
service's private `maybePromoteRuntimeAdaptation` on a saved adaptation, with a context from
`resolveRuntimeAdaptationContext`:

- a succeeded trial is applied. The decision records `confidence: "provisional"`, and the record has
  `metadata.confidence` and no `confidenceScore`;
- trial succeeded, then replay failed: sent to a person with the tier's reason.
  - Before the fix, the old gate auto-applied it, and the apply then failed (`autoApplyFailed`).
- three succeeded replays and no trial: never applied.
  - Before the fix, it was applied.

**`AS/runtime/tests/service-adaptation/tests/adaptive-loop.test.ts` (existing):** the first case now
also expects `confidence: "provisional"` on the decision of a real run's auto-applied adaptation.

**`AS/runtime/tests/service-flows/tests/flow-index-read.test.ts`, 1 case:**

- a failed flow-index read fails the listing and writes nothing;
- the next listing still lists the Flow.

**`AS/api/handlers/tests/runtime-execution.test.ts`, 2 cases:**

- the full success answer;
- an unreadable detail gives `ok: false`, the run named, and the session and link attached.

**`AS/runtime/service/runtime-session/tests/ending.test.ts`, 9 cases:**

- `queued` and `running` sessions are rewritten, with the reason recorded;
- four terminal-or-waiting statuses are left alone;
- a session that is no longer stored is not recreated;
- a failed write, and a failed read, each come back as an `AggregateError` holding both errors.

**`AS/runtime/service/runtime-session/tests/admission.test.ts`, 8 cases:**

- a run with no project, or not adaptive, starts without reading the sessions;
- an adaptive run is admitted when none is active;
- `queued`, `running` and `waiting` adaptive runs block;
- a run is refused while another is being admitted;
- a failed listing refuses the run and releases the project;
- a failed start releases the project.

**Files, all under `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`:**

- **modified:**
  - `runtime/service.ts`
  - `api/handlers/runtime-execution.ts`
  - `runtime/recovery/adaptation-promotion.ts`
  - `runtime/training-modes.ts`
  - `runtime/tests/training-modes.test.ts`
  - `runtime/tests/service-adaptation/tests/adaptive-loop.test.ts`
- **new:**
  - `runtime/service/runtime-session/{index,admission,ending}.ts`
  - `runtime/service/runtime-session/tests/{admission,ending}.test.ts`
  - `runtime/tests/service-adaptation/tests/{failed-start,promotion-tier}.test.ts`
  - `runtime/tests/service-flows/tests/flow-index-read.test.ts`
  - `api/handlers/tests/runtime-execution.test.ts`

**Other workers' changes, not mine:** the remaining modified or untracked files in `git status`
(`flow-bootstrap/**`, `deepseek-bootstrap-exploration.test.ts`, `service-bootstrap/tests/rejections.test.ts`,
`storage/project/tests/adaptation-store.test.ts`).

## Commands run and observed results

All vitest commands were run from `F:\!FluxIQ\packages\fluxiq`.

**Failing-first.** All new tests, on the unchanged `service.ts` and handler:

- Files: `failed-start`, `promotion-tier`, `flow-index-read`, `adaptive-loop`,
  `handlers/tests/runtime-execution`.
- Result: **13 failed, 2 passed.**
- The 2 that passed are guard cases: the cancellation case, and adaptive-loop's second case.
- Failure messages:
  - the runs that should have ended failed: `expected {…} to match object { status: 'failed', … }`;
  - the grant cases: `expected [] to deeply equal [ 'llm-grant:failed-start' ]`;
  - the read cases: `promise resolved "{…}" instead of rejecting`;
  - the flow index: `promise resolved "[]" instead of rejecting`;
  - the handler: `expected { ok: true, … } to deeply equal { ok: false, … }`;
  - the replay-only promotion case: `expected 'applied' to be 'validated'`.

**Probe (a temporary test file, since deleted).** On the old code, a failed flow-index read listed
`[]`, left the file byte-identical, and made 0 index writes. I corrected my first test comment, which
had assumed a rewrite.

**Training-modes test on the committed `training-modes.ts`.**

- The file was swapped for the HEAD version, then restored; `cmp` printed `RESTORED`.
- Result: `1 failed | 12 passed (13)`.
- The failure was `expected { autoApply: true, … } to deeply equal { autoApply: false, … }`: the
  retired `validated: true` still promoted.

**`npx tsc --noEmit -p .`**

- First run: exit 2, with two `TS7006` errors in my own test (the options type).
- After the fix: **exit 0**.

**With the fix, 9 files:**

- The 5 above, plus `service/runtime-session` (2 files), `tests/training-modes.test.ts`,
  `recovery/tests/adaptation-promotion.test.ts` and `handlers/tests/llm-generation.test.ts`.
- Result: `Test Files 10 passed (10)`, `Tests 90 passed (90)`.
- The runner reports 10 files because the `service/runtime-session` directory holds 2 test files.

**Core `pnpm check` (`F:\!FluxIQ`): exit 0.**

- `# pass 105`, `# fail 0`.
- `structure-audit: passed (152 warning(s), 254 baselined)`, with
  `1 baseline entries can be lowered`.
- All four packages printed `check: Done`.
- `node scripts/structure-audit.mjs --json`:
  - The lowerable entry is `runtime/service.ts` at 6405 (recorded 6415).
  - None of the warnings is on a file I added.
  - The 2 warnings beyond the previous report's 150 are another worker's `flow-bootstrap/generation-failure.ts`
    (9 exported values) and its test (403 lines).
  - `training-modes.ts` keeps its earlier advisory warning (11 exported values).

**Suite.** `npx vitest run src/programs/automation-studio/runtime src/programs/automation-studio/api`:

- Exit 1: `Test Files 3 failed | 151 passed (154)`, `Tests 3 failed | 1467 passed | 1 skipped (1471)`,
  145.97 s.
- The 3 failures:
  - `service/summaries/tests/run-detail-preservation.test.ts`: `Test timed out in 15000ms`;
  - `service-flows/tests/instruction-readiness.test.ts`: `Test timed out in 15000ms`;
  - `service-recordings/tests/assets.test.ts`: `EPERM: operation not permitted, rmdir …\recordings\recording.batch-b\derived`.

**Those 3 files rerun on their own:** `Test Files 3 passed (3)`, `Tests 11 passed (11)`. I read them as
load and a Windows file lock, not code. The first two rest on a single failed observation each.

**`wc -l runtime/service.ts`:** 6405.

## Not verified

- No live run, no browser, and no `apps/web` exercise.
- **The web client and the new failure answer.** The client (`run-commands.ts`, `FlowRunView.tsx`,
  off limits) was not exercised with the handler's new `ok: false` answer, so what it shows is
  unchecked. It probably shows the error text.
- **The whole suite was not green in one run.** It was green only through the isolated rerun of the 3
  failing files.
- **`AggregateError` path.** It is covered by unit tests only. No service-level test makes the session
  write itself fail.
- **Test driver.** The service-level promotion test calls the private `maybePromoteRuntimeAdaptation`
  directly. No full run was built to produce a replay-only or contradicted record, because live patches
  only write trial-kind results today.
- `pnpm test` and `pnpm build` were not run for the whole repository.

## Open questions or contradictions found

1. **Run history now contains runs that never started.** A failed start is now a `failed` run in the
   project's run list (`writeRuntimeSummary`). The adaptation context reads that list, so the failed
   start counts as an unresolved failure in the stability metrics. I think this is right, since the
   run did fail, but it is a visible change.
2. **Swallowed reads still left in `service.ts`** (not in this brief; current line numbers):
   - **1194** `readPipelineIndex(...).catch(() => emptyPipelineIndex())`.
   - **1582** `readRuntimeIndex(...).catch(() => ({ sessions: [] }))`: the workspace summary lists no
     runs.
   - **2798** `startRuntimeSession`'s `getFlow(...).catch(() => undefined)`.
     - A failed canonical read makes the run non-canonical: it falls back to `getProjectArtifact`.
     - If that returns a document, the run starts without the checks that read 3144 now enforces.
     - The fix needs a "not found" error that can be told apart from a read failure.
   - **2964 / 2967** `flowHasPriorManualAdaptationReview`: a failed read answers "no prior manual
     review". That fails closed for promotion, but silently.
   - **2990, 2992, 2999** the retry path's `getFlowSubflow` / `getFlow` `.catch(() => null)`: a failed
     read skips the retry silently.
   - **3182** the routed Subflow's `getFlow(...).catch(() => undefined)`: the run then fails with a
     "could not be loaded" message that hides the cause.
   - **994, 1644, 2664, 3816, 3915, 4198, 4233, 4285, 4302, 4809/4814, 4946/4954, 5153** are also
     unreviewed.
   - **2879** (`flowScope`) is a documented fail-closed choice.
3. **The same swallow exists outside my files.** `AS/runtime/service/catalogue.ts:37` and `:77` read
   the flow index with `.catch(() => emptyFlowSummaryIndex())`:
   - `listCanonicalFlowArtifacts` then returns no Flows;
   - `loadProjectFlows` then loads none, which also affects `listFlowPublicationRecords`.
4. **Barrel.** `service/index.ts` (off limits) re-exports neither `runtime-session/` nor
   `run-detail-read/`. `service.ts` imports each directory's `index.ts` directly. Add both to the barrel
   if they should be part of that surface.
5. **Baseline.** Run `pnpm structure:baseline` at commit time to record `service.ts` at 6405.
6. **Docs.** No `docs/**` change was made.
   - `pnpm docs:reference` may need a rerun: `adaptationConfidenceScore` is gone, the promotion gate's
     input changed, and the handler has a new failure answer.
   - The run-detail read failure and the `metadata.runFailure` session field may deserve a line in the
     runtime architecture doc.
7. **Still open from `w2-c8-promotion-gates.md` §1 (not mine, `AS/storage/**`).** The typed store's
   apply path still accepts a succeeded result of any kind.
