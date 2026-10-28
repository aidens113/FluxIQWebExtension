# t769 b1-subflow-runner: the offline subflow trial runner

Core tree `fxwork/t769/!FluxIQ`, branch `task/t769-p6-offline-trials-in-builds`. AS =
`packages/fluxiq/src/programs/automation-studio/`. Nothing was committed, stashed, or switched.

## Outcome

Done. `runAutomationStudioOfflineSubflowTrial` (AS `runtime/service/offline-trial/subflow-run.ts`) wraps
`runAutomationStudioSubflowTrial` the way `runAutomationStudioOfflineCandidateTrial` wraps the candidate runner.
Both runners now share one matcher session (`matcher-session.ts`). The existing whole-candidate tests pass
unchanged, so the whole-candidate runner behaves as before.

UNIT READY: AS runtime/service/offline-trial/{matcher-session.ts, run.ts, subflow-run.ts, contracts.ts,
evidence-result.ts, index.ts, tests/offline-harness.ts, tests/session-view.test.ts, tests/subflow-harness.ts,
tests/subflow-run.test.ts, tests/without-claims.ts}

## What changed and why

### 2026-10-27

- **`matcher-session.ts`** (new; exports one function, `automationStudioOfflineTrialMatcherSession`).
  - Holds everything run.ts did around the trial, in the same order and with the same refusal texts:
    1. exploration is refused with `offline_not_allowed_in_phase`;
    2. the manifest is read: `incomplete_capture` when the store has none, `source_not_live` when the trace is derived;
    3. the virtual clock and the `trace` environment are set up;
    4. `ClientGatewayTraceMatcher.load` runs, and a matcher refusal ends the trial there;
    5. the session view: the recorded view wins, else the supplied one, else `incomplete_capture`;
    6. it attaches, delivers the opening, runs the caller's runner inside
       `AutomationStudioGatewayTraceReplaySources.run([traceId])`, which produces the derived replay trace naming
       its source, and waits for `settled()`;
    7. it disconnects in a `finally`.
  - It answers `status: "ran"` with the trial, the matcher report, `sessionView`, `normalizations` (the
    supplied-view note moved here), `supported`, `reevaluated` and `sourceEpisodeId`. Each runner adds only its
    own trial runner and the goal contract its evidence is bound to.
  - It is not exported from the barrel: it is internal to the directory, and the audit only counts imports from
    outside a directory.
- **`run.ts`**: now calls the session with `runAutomationStudioCandidateTrial(request, { ...ports, environment,
  now: environment.now })`.
  - The goal-contract default is unchanged: `originalInstructionsDigest ?? "candidate.requirements.unbound"`.
  - The header text about the session moved to `matcher-session.ts`.
- **`subflow-run.ts`** (new): `runAutomationStudioOfflineSubflowTrial(input)` calls
  `runAutomationStudioSubflowTrial(request, { ...ports, environment, now: environment.now }, undefined,
  input.judgeInputTokens)`.
  - There is no prepared start, so no hook and no reset (Decision 6).
  - The evidence's goal contract defaults to `request.scope.planDigest`; see open questions.
- **`contracts.ts`**:
  - New `AutomationStudioOfflineTrialSessionInput`, holding the shared source, gateway, phase, contractVersions,
    sessionView and reevaluator fields.
  - `AutomationStudioOfflineCandidateTrialInput` is now that type plus `request`, `ports` and
    `goalContractVersion`.
  - New `AutomationStudioOfflineSubflowTrialInput` is that type plus the subflow `request`/`ports`,
    `goalContractVersion?` and `judgeInputTokens?`.
  - New `AutomationStudioOfflineTrialRunOutcome`: `{ record: { execution, revision, digest }, result: { verdict }
    }`, the shape both trial outcomes share.
  - New generic `AutomationStudioOfflineTrialRan<Trial>` and `AutomationStudioOfflineTrialRefusal`.
  - The existing candidate names are kept as aliases (`...CandidateTrialRan`, `...CandidateTrialRefusal`,
    `...CandidateTrialOutcome`).
  - New `AutomationStudioOfflineSubflowTrialRan` and `AutomationStudioOfflineSubflowTrialOutcome`.
- **`evidence-result.ts`**: `trial` is widened to `AutomationStudioOfflineTrialRunOutcome`, since it reads only
  those fields. The logic is unchanged.
- **`index.ts`**: also exports `runAutomationStudioOfflineSubflowTrial`, which reaches the runtime barrel through
  `runtime/index.ts:45`.
- **Tests**:
  - `tests/subflow-harness.ts` (new) provides:
    - a brief scope with no predecessor;
    - `subflowOf({ queries, threshold })`: one gateway read per query, then a filter over the last read;
    - subflow ports built from the offline harness's ports, with the scripted verdict as the scoped judge (no
      model) and the production detached subflow runner;
    - `recordLive`, a live partial trial traced into its own episode;
    - `runOfflineSubflow`.
  - `tests/without-claims.ts` (new): `withoutClaims`, moved out of `session-view.test.ts` so both test files use
    it. It throws instead of calling `expect`.
  - `tests/offline-harness.ts`: exports `READ` and `RECORD_OUTPUT` and adds `traces()`. It stays at 8 exported
    values, so the exported-values advisory no longer fires.
  - `tests/session-view.test.ts`: imports `withoutClaims` instead of defining it.
  - `tests/subflow-run.test.ts` (new, 6 tests):
    1. **Recorded proposal.** Two reads, matched = recorded = 2, no gaps, `sessionView: "recorded"`, verdict yes.
       The start is `not_reset`. It keeps the same rows as the live run ([2,3]). The evidence is a full `pass`
       bound to `plan.offline` with `liveEpisodeId: null`, and it is never a live success. Its own trace is
       `derived/replay` with `sourceTraceIds: [live trace]`. The scoped judge was asked again (2 calls). No live
       client was reached and nothing was dispatched locally.
    2. **T09, an added command.** The recording is lamps then desks; the proposal is lamps, chairs (added), desks.
       There is exactly one gap: ordinal 2, `argument_mismatch`, cause `mismatch`. Matched 1 of 2. Every delivered
       sequence is below the sequence of the second recorded `server.execute_action`. `read2` failed once,
       `read3` never ran, the trial's verdict is `execution_failed`, and the judge was not asked. The evidence is
       `inconclusive`, `segment`, with reason `argument_mismatch` and assertion `unverified`.
    3. **Reevaluator, in the repair phase.** A changed read is answered by the reevaluator; `reevaluated` lists
       `parameters.query` and no value, and the origins include `snapshot_evaluation`.
    4. **Exploration is refused.** No episode, no judge, no client.
    5. **No session view anywhere.** The recorded view was removed and none was supplied: refused with
       `incomplete_capture` before anything ran.
    6. **Supplied view.** With the recorded view removed, a supplied view is used and declared as a
       normalization.

## Commands run and observed results (2026-10-27)

**Before any change:** `pnpm test src/programs/automation-studio/runtime/service/offline-trial` (from
`packages/fluxiq`) printed `Test Files  8 passed (8)` and `Tests  26 passed (26)`. The real-sql group printed
`No test files found, exiting with code 0`.

**Tests first, before the runner existed.** Command:
`pnpm exec vitest run .../offline-trial/tests/subflow-run.test.ts .../offline-trial/tests/session-view.test.ts`.
It printed `Test Files  1 failed | 1 passed (2)` and `Tests  6 failed | 5 passed (11)`. Every subflow test failed
with `TypeError: runAutomationStudioOfflineSubflowTrial is not a function`. The live partial-trial recordings in
those tests had already passed their own expectations by then.

**After the code:** `pnpm exec vitest run .../tests/subflow-run.test.ts` printed `Test Files  1 passed (1)`,
`Tests  6 passed (6)`.

**`pnpm exec tsc --noEmit -p .` (first attempt)** exited 134 with `FATAL ERROR: Ineffective mark-compacts near heap
limit Allocation failed - JavaScript heap out of memory`. That is node's default 2 GB heap, not a type error. The
package's own `check` script runs tsc with `--max-old-space-size=4096`, so I reran with the same heap:

- `NODE_OPTIONS=--max-old-space-size=4096 pnpm exec tsc --noEmit -p .` exited 0 with no output, and did so again
  on the final tree.

**Final tree:** `pnpm test src/programs/automation-studio/runtime/service/offline-trial` exited 0.
- parallel group: `Test Files  9 passed (9)`, `Tests  32 passed (32)`. All 8 existing files passed (26 tests),
  plus `subflow-run.test.ts` (6 tests).
- real-sql group: `No test files found, exiting with code 0`. That group prints no "Test Files" line because this
  directory has no real-sql tests.
- The run ended with `[vitest-groups] all groups passed: parallel, real-sql`.

**`node scripts/structure-audit.mjs`** (Core root, not in the brief) exited 1 with `5 violation(s) across 4
rule(s)`, all in files other workers own:
- `llm/step-log/tests/offline-trial-step.test.ts`: `as-never`;
- `llm/step-log/offline-trial-step.ts`: `swallowed-failure`;
- `service/candidate-trial/tests/`: `directory-files`, 26 files against a limit of 25;
- `service/candidate-trial/run.ts`: `imports`, reaching into `gateway-trace/installation.ts`;
- `service/subflow-trial/run.ts`: `imports`, reaching into `gateway-trace/installation.ts`.

The audit's first run also warned that `offline-trial/tests/offline-harness.ts` had 12 exported values, past the
advisory threshold of 8. I fixed that by un-exporting three constants and moving `withoutClaims` to its own file;
the rerun names nothing under `offline-trial/`.

## Not verified

- No full suites, live runs, paid runs or model calls (as the brief says). The subflow trial was only exercised
  with a router-run target and no predecessors. Predecessors and a callable target with an interface were not
  tested offline.
- The tsc result reflects the tree at the moment it ran; other workers were editing concurrently.
- `judgeInputTokens` pass-through (the affordability refusal offline) has no dedicated test.

## Open questions or contradictions found

- **The goal contract default for a subflow is my choice: `request.scope.planDigest`.** The candidate runner binds
  the candidate's original instructions digest, but a subflow scope carries no instructions digest. The scoped
  judge asks about the plan's parts and success check, so the plan digest is the closest contract. Callers can
  override it with `goalContractVersion`. The supervisor may prefer something like `subflow.<planDigest>.<key>`.
- **`judgeInputTokens` was added to the subflow input only. The brief did not name it.** The live subflow port
  passes it, and the design's mapping says the runner refuses an unaffordable trial itself. The candidate offline
  input was left without it so its runner stays unchanged.
- **The brief's `pnpm exec tsc --noEmit -p .` runs out of memory on this machine at the default heap.** It needs
  `NODE_OPTIONS=--max-old-space-size=4096`, matching the package's `check` script.
