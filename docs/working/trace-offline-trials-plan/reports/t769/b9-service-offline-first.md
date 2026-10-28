# t769 b9-service-offline-first (worker-heavy)

Core tree `fxwork/t769/!FluxIQ`, branch `task/t769-p6-offline-trials-in-builds`. AS =
`packages/fluxiq/src/programs/automation-studio/`. Nothing committed, stashed, switched or merged.

## Outcome

Done. There is a new directory, AS `runtime/service/offline-first/`. It produces the `offlineFirst` port members the
gates call, the sources that pick each scope's recording, the outcome-to-answer mapping, and the host installation. Its
tests were written first and run first, and they cover T17, T19, T21, T09 and the gap-words drift check. All three
named checks pass on the final tree.

UNIT READY: AS runtime/service/offline-first/{contracts.ts, installation.ts, sources.ts, answer.ts, spend.ts, whole.ts,
subflow.ts, index.ts, tests/answer.test.ts, tests/sources.test.ts, tests/whole.test.ts, tests/subflow.test.ts,
tests/installation.test.ts}

## What changed and why

### 2026-10-27

- **`contracts.ts`** (types only):
  - `AutomationStudioOfflineTrialHost`: gateway, `storeFor`, `sessionViewFor`, optional reevaluator.
  - the source, record and spend types;
  - the factory input and output types (verbatim below).
- **`installation.ts`**: `AutomationStudioOfflineTrialInstallation`, frozen `{ install(host) -> uninstall, current() }`.
  - It follows `gateway-trace/installation.ts`: the newest installation wins, and an uninstall removes only its own.
  - `current()` answers `undefined` while `process.env.FLUXIQ_OFFLINE_TRIALS === "0"` (D44). It reads the setting
    each time it is called.
- **`sources.ts`**: `AutomationStudioOfflineFirstSources` (a class).
  - Scopes: `wholeScope(candidateId)` gives `whole:<id>`; `subflowScope(buildId, subflowKey)` gives
    `<buildId>/<subflowKey>`.
  - `observeWhole` and `observeSubflow` keep the latest eligible record per scope. Eligible means:
    - it has both `trialRunId` and `traceId`;
    - `execution` is not `not_run`;
    - it is not `judgedAgain`;
    - for a subflow, `entryPrepared === true`.
  - Other rules:
    - a run id already seen is ignored, so handing it every record again is safe and an older record never replaces
      a newer one;
    - `noteDerived(traceId)` bars an offline run's own trace from ever becoming a source;
    - `latest(scope)` returns `{ traceId, trialRunId }`, or nothing.
- **`answer.ts`**: `automationStudioOfflineFirstAnswer(outcome)` is pure and follows the design §3 table. It works from
  the evidence verdict (U5):

  | Offline outcome | Answer |
  | --- | --- |
  | refused | `live`, `not_tried`, why = the refusal's reasonCode |
  | `pass` with a yes | `live`, `passed` |
  | `fail` with verdict `no` or `execution_failed`, and `execution` `succeeded` or `failed` | `kept`: the runner's result unchanged, plus `standingNo` copied beside it and `checked` |
  | `fail` with `entryPrepared === false` | `live`, `inconclusive`, `offline_entry_not_prepared` |
  | `fail` on a run that did not run | `live`, `inconclusive`, `offline_not_run` |
  | inconclusive, with matcher gaps and a feedback step whose `failureCode` is in `CLIENT_GATEWAY_TRACE_MATCHER_GAP_REASONS` | `live`, `gap`, with that step's number and code |
  | any other inconclusive | `live`, `inconclusive`, why = the evidence's first reasonCode (for example `judgement_unavailable`, `missing_transition`, or a gap no step names) |

  `checked` is `{matched, recorded}` from `supported`. It is left out unless it holds valid counts, because B3 refuses
  a bad `checked`.
- **`spend.ts`**: `automationStudioOfflineFirstSpend(records)` sums the judge spend of the offline runs. `whole.ts` and
  `subflow.ts` share it.
- **`whole.ts` and `subflow.ts`**: `automationStudioOfflineFirstWhole` and `automationStudioOfflineFirstSubflow`. Each
  `offlineFirst` call does the following, in order:
  1. Checks the abort signal.
  2. Reads `liveRecords()`, if it was given, into `observe`.
  3. Answers `live` `not_tried` without running anything when:
     - nothing is installed (`offline_trials_off`);
     - the request is another candidate's or build's, or the candidate's frozen revision or digest differ
       (`offline_request_mismatch`);
     - the ports' environment is not live (`offline_port_not_live`);
     - the scope has no source yet (`no_live_source`).
  4. Otherwise runs `runAutomationStudioOfflineCandidateTrial` or `runAutomationStudioOfflineSubflowTrial` with the
     installation's store, gateway, session view and reevaluator, and the phase.
  5. Marks the derived trace and keeps `{record, evidence, answered}` apart from the live records.
  6. Returns the mapped answer.

  Two further details:
  - `observe` refuses another candidate's or build's record outright (T17).
  - The subflow factory passes `judgeInputTokens`: the largest judge prompt among the live records it observed and its
    own offline runs.
- **`index.ts`**: the barrel. It is not re-exported from `service/index.ts`, following `offline-trial/`.

## Factory API (verbatim)

```ts
export type AutomationStudioOfflineTrialHost = {
  gateway: AutomationStudioOfflineTrialGateway;
  storeFor(projectId: string): ClientGatewayTraceStore;
  sessionViewFor(projectId: string): ClientGatewayClientHello | undefined;
  reevaluator?: ClientGatewayTraceReevaluator | undefined;
};
export type AutomationStudioOfflineFirstRecord<TRecord> = { record: TRecord; evidence: AutomationStudioTrialEvidenceResult; answered: "kept" | "live" };
export type AutomationStudioOfflineFirstSpent = AutomationStudioCandidateTrialRecord["judge"];
type AutomationStudioOfflineFirstInputs<TPorts, TRecord> = {
  ports: TPorts;
  installation: AutomationStudioOfflineTrialHost | undefined;
  phase: AutomationStudioOfflineTrialPhase;            // "repair" for a repair build, else "test"
  liveRecords?: (() => readonly TRecord[]) | undefined; // the live port's records(), read at each offlineFirst call
};
export type AutomationStudioOfflineFirstWholeInput = AutomationStudioOfflineFirstInputs<AutomationStudioCandidateTrialPorts, AutomationStudioCandidateTrialRecord> & { candidateId: string };
export type AutomationStudioOfflineFirstSubflowInput = AutomationStudioOfflineFirstInputs<AutomationStudioSubflowTrialPorts, AutomationStudioSubflowTrialRecord> & { buildId: string };
type AutomationStudioOfflineFirstFactory<TRequest, TResult, TRecord> = {
  offlineFirst: AutomationStudioTrialOfflineFirst<TRequest, TResult>;
  observe(record: TRecord): boolean;
  offlineRecords(): AutomationStudioOfflineFirstRecord<TRecord>[];
  spent(): AutomationStudioOfflineFirstSpent;
};
export type AutomationStudioOfflineFirstWhole = AutomationStudioOfflineFirstFactory<AutomationStudioCandidateTrialRequest, AutomationStudioCandidateTrialResult, AutomationStudioCandidateTrialRecord>;
export type AutomationStudioOfflineFirstSubflow = AutomationStudioOfflineFirstFactory<AutomationStudioSubflowTrialRequest, AutomationStudioSubflowTrialResult, AutomationStudioSubflowTrialRecord>;

export function automationStudioOfflineFirstWhole(input: AutomationStudioOfflineFirstWholeInput): AutomationStudioOfflineFirstWhole;
export function automationStudioOfflineFirstSubflow(input: AutomationStudioOfflineFirstSubflowInput): AutomationStudioOfflineFirstSubflow;
export const AutomationStudioOfflineTrialInstallation: { install(host: AutomationStudioOfflineTrialHost): () => void; current(): AutomationStudioOfflineTrialHost | undefined };
export function automationStudioOfflineFirstAnswer<Trial>(outcome: AutomationStudioOfflineTrialRefusal | AutomationStudioOfflineTrialRan<Trial>): AutomationStudioTrialOfflineFirstAnswer<Trial["result"]>;
export class AutomationStudioOfflineFirstSources { static wholeScope(candidateId): string; static subflowScope(buildId, subflowKey): string; observeWhole(record): boolean; observeSubflow(record): boolean; noteDerived(traceId): void; latest(scope): { traceId; trialRunId } | undefined }
export function automationStudioOfflineFirstSpend(records): AutomationStudioOfflineFirstSpent;
```

**How B10 attaches it.** `whole-trials.ts` does this for a candidate build only (D40); `subflow-trials.ts` does the same
with `automationStudioSubflowTrialPort` / `automationStudioOfflineFirstSubflow({ buildId, ... })`:

```ts
const trials = automationStudioCandidateTrialPort(candidateId, ports);
const offline = automationStudioOfflineFirstWhole({ candidateId, ports, installation: AutomationStudioOfflineTrialInstallation.current(), phase, liveRecords: () => trials.records() });
trials.port.offlineFirst = offline.offlineFirst;   // needs B7's `offlineFirst?` on the port type
```

- With `liveRecords`, the live port needs no wrapper.
- `trials.records()` stays live-only.
- Add `offline.spent()` to the build's spend.
- `offline.offlineRecords()` holds the offline runs and their evidence, for logging or Lab counts.

Import from the sibling barrel: `../offline-first/index.ts`.

## Commands run and observed results (2026-10-27)

All test commands ran from `packages/fluxiq`.

1. **Tests first, before any source existed:** `pnpm test src/programs/automation-studio/runtime/service/offline-first`
   - Printed `Test Files  5 failed (5)`, `Tests  no tests`, `[vitest-groups] failed: parallel (exit 1)`.
   - `pnpm exec vitest run .../tests/sources.test.ts` showed the cause:
     `Error: Failed to load url ../index.ts ... Does the file exist?`.
2. **First run after the source:** `Test Files  1 failed | 4 passed (5)`, `Tests  1 failed | 33 passed (34)`.
   - The failure was `whole.test.ts:64`: `observe` accepted another candidate's record into that other candidate's
     scope and answered true.
   - Fixed by having the factory's `observe` refuse any record outside its own candidate or build.
3. **Gap step numbers.** I temporarily set the expected step to 99 to read the real values: `+ "step": 3` (subflow:
   the start, the recorded read, then the added read) and `+ "step": 2` (whole: the start, then the changed read).
   Both are now pinned in the tests.
4. **Final tree.** The same `pnpm test ...offline-first` printed:
   - parallel: `Test Files  5 passed (5)`, `Tests  36 passed (36)`;
   - real-sql: `No test files found, exiting with code 0`;
   - `[vitest-groups] all groups passed: parallel, real-sql`.
5. **Typecheck.** `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p .` printed `exit=0`
   with 0 output lines. That covered the whole package, other workers' in-flight edits included.
6. **Structure audit.** `node scripts/structure-audit.mjs | grep -E "FAIL|structure-audit:"` from the Core root printed
   `structure-audit: passed (443 warning(s), 1152 baselined).` with exit 0.
   - No line names `offline-first` (count 0).
   - 443 warnings is the same count the lead recorded before this unit.

## Not verified

- **Not wired into the gates.** The gates (B7/B8) and the project-build wrappers (B10) are not wired. Gate acceptance
  is checked only by running each answer through B3's `automationStudioTrialOfflineFirstStep` in `answer.test.ts` and
  `subflow.test.ts`.
- **`sessionViewFor`** returned `undefined` in every test, because the recorded `session.claimed` view was used. The
  supplied-view path is B1's runner and is tested there.
- **The reevaluator** is not exercised through the factories. It is passed through, and B1 tests it.
- **Concurrent offline subflow trials** from parallel briefs are not tested.
- **No full suites, live or paid runs, or model calls.** The judge was the harness's scripted verdict.

## Open questions or contradictions found

1. **Barrel line.** Not needed for B10, which imports the sibling barrel. B12 (`programs/_shared/runtime.ts`) needs
   `AutomationStudioOfflineTrialInstallation`. If it imports through the runtime barrel, the lead should add
   `export * from "./service/offline-first/index.ts";` to AS `runtime/index.ts` beside line 45 (the offline-trial line).
   This module imports `service/offline-trial/`, which is in the trace-free boundary's `to` list, so no `from` module
   may import it. `runtime/index.ts` already exports offline-trial, so the line adds no new reach.
2. **When the env switch is read.** `FLUXIQ_OFFLINE_TRIALS=0` is checked by `current()`. A factory keeps the host it
   was given, so a factory made before the setting changed stays on for that build.
3. **New `why` codes in `not_tried` and `inconclusive` notes:** `no_live_source`, `offline_trials_off`,
   `offline_request_mismatch`, `offline_port_not_live`, `offline_entry_not_prepared`, `offline_not_run`,
   `offline_pass_without_yes`, `offline_inconclusive`.
   - They are plain codes for the step log. B3's words never echo them, and per D46 a `not_tried` note adds no
     evidence.
   - B6's Lab classifier may want to list them.
4. **Two conservative choices beyond the design table:**
   - a subflow whose entry was not prepared is never kept;
   - a run that did not run is never kept.

   Both run live instead.
