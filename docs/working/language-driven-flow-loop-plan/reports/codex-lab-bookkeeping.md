# Codex Lab bookkeeping

Status: Implemented and supervisor verified in paired task t220; local commits delivered for Claude integration. The inherited Core full-audit failure remains documented below. No merge, push, browser/Lab run or provider call.

## Findings and decisions

- The benchmark implementation is `packages/test-runner/src/bench/run-bench.ts`.
  A finalized resumed bundle contains its permission stop in the validated
  `stopped-for-permission` invariant. Reconstruction discarded that invariant.
  Preserve the original invariant (including evidence sequence references),
  without parsing its human-readable sentence or inferring a stop later.
- Lane C F15 already fixes the failed repaired re-run idle: the terminal-detail
  wait reads `metadata.repairedRerun.status`, bypasses recovery waiting when it
  is terminal, and still waits while `resultRepair.phase` is `rerunning`.
  Existing fake-clock tests cover immediate settlement and still-running repair.
  Core's `service/runtime-adaptation/repair-rerun.ts` also writes
  `metadata.repairedRerun.status` and a terminal `recoveryState: ended` via
  `rerunRecoveryState`, while preserving an existing ended/threw marker.
  No terminal-run-wait production edit is needed unless validation finds a gap.
- Before this change, Core traces did not retain the refused call's target or covering layer.
  Actual pre-call evidence is available only in the downstream node executor's
  `record.found`. The supervisor approved a paired follow-up tree for an opaque
  Core diagnostic seam; domain producer and bundle reader will enforce strict
  field/value allowlists. No Core source was edited in the detached t218 sibling.

## Changes

- `packages/test-runner/src/bench/run-bench.ts`: retain the permission-stop
  invariant and failed verdict when rebuilding a finalized Flow benchmark row.
- `packages/test-runner/src/bench/tests/run-bench.test.ts`: regression crashes
  after finalizing a permission-stop bundle, resumes twice, checks the exact
  stop invariant/evidence references and confirms one scenario execution.
- `domain/src/runtime/llm-evidence/refusal-diagnostic/{types,screen,from-page,index}.ts`
  and `tests/diagnostic.test.ts`: pure projection of the actual pre-call packet,
  target existence and covering handles/kinds; strict shared field/value screen
  rejects extra keys, labels, URLs, credential-like values and invented codes.
  These helpers are wired through the paired Core trace contract below.
- Work moved from unused downstream-only t218 to the supervisor-provisioned
  isolated t220 pair; transferred files were hash checked. t218 is no longer
  edited. Downstream executor/capture/export and runner admission are now wired
  in t220; the Core seam was implemented after setup completed.
- Added domain node-executor wiring assertions, runner malicious-value
  screening tests and a scripts/lab existing-bundle reader regression.
- Testing-facility docs now describe the current whole-page v2 evidence,
  pre-call structural refusal record, terminal repair settlement, and durable
  permission-stop invariant on resumed benchmarks.
- Core's paired build finished before editing. The opaque optional diagnostic
  is now carried through exact execution-key parsing, call diagnostics, trace
  types, stored-trace sanitization and public/refused evidence-step rebuilding.
  The generic transport validates only shallow structural JSON; it makes no
  secret-safety claim about arbitrary code-shaped strings. Domain producer and
  bundle consumer strict allowlists remain authoritative.
- New generic Core tests cover preservation through parser/trace/audit/public
  steps, malformed diagnostic dropping without losing the outcome, and old
  callers with no diagnostic. Core architecture docs describe the seam.

## Complete changed-file inventory (t220)

Downstream:

- `docs/architecture/testing-facility.md`
- `docs/working/language-driven-flow-loop-plan/reports/codex-lab-bookkeeping.md` (this report)
- `docs/working/language-driven-flow-loop-plan/reports/codex-lab-bookkeeping-brief.md` (supervisor-owned copied brief)
- `domain/src/runtime/llm-evidence/capture.ts`
- `domain/src/runtime/llm-evidence/index.ts`
- `domain/src/runtime/llm-evidence/node-run/run.ts`
- `domain/src/runtime/llm-evidence/node-run/tests/run.test.ts`
- `domain/src/runtime/llm-evidence/refusal-diagnostic/from-page.ts`
- `domain/src/runtime/llm-evidence/refusal-diagnostic/screen.ts`
- `domain/src/runtime/llm-evidence/refusal-diagnostic/types.ts`
- `domain/src/runtime/llm-evidence/refusal-diagnostic/index.ts`
- `domain/src/runtime/llm-evidence/refusal-diagnostic/tests/diagnostic.test.ts`
- `packages/test-runner/src/bench/run-bench.ts`
- `packages/test-runner/src/bench/tests/run-bench.test.ts`
- `packages/test-runner/src/existing-fluxiq-control/publishable-step-value.ts`
- `packages/test-runner/src/existing-fluxiq-control/tests/publishable-step-value.test.ts`
- `packages/test-runner/src/flow-lane/tests/terminal-run-wait.test.ts`
- `packages/test-runner/src/flow-lane/creation/tests/build-proposal.test.ts`
- `scripts/lab/live-campaign/row/tests/bundle.test.mjs`

Core paths below `packages/fluxiq/src/programs/automation-studio/runtime/`:

- `llm/evidence-loop-decision.ts`
- `llm/evidence-loop/{call-record,diagnostic,index,tool-execution,trace}.ts`
- `llm/evidence-loop/tests/diagnostic.test.ts`
- `flow-bootstrap/evidence-loop-steps.ts`
- `service/flow-bootstrap-commands/evidence-trace.ts`
- `service/flow-bootstrap-commands/tests/diagnostic-trace.test.ts` (new; no preexisting service test changed)
- `docs/architecture/automation-studio/llm-flow-bootstrap.md` (relative to Core root)

## Integration dependency

Task4 independently extends Core's execution result key list with `clearedWait`;
this task extends it with `diagnostic`. Integration must keep both accepted keys,
the diagnostic helper, and the existing cleared-wait activity reader. Task4's
change to `runtime/llm/evidence-loop-decision.ts` is allowlist-only; cleared-wait
semantic validation remains in activity/transport. The source tree builds require
the paired Core revision before downstream emits the new optional diagnostic.

## Validation

- `& 'C:/Program Files/Git/bin/bash.exe' C:/Users/osrs_/FluxStuff/build-slots/heavy.sh 'codex lab bookkeeping runner check' pnpm --filter @fluxiq-web-extension/test-runner check`
  exited 2: the regression initially inherited an optional `benchId` (fixed by
  supplying the required ID explicitly). This isolated checkout also lacks the
  built `@fluxiq-web-extension/test-evidence` declarations, causing missing-module
  and downstream type errors. Build prerequisites before repeating validation.
  Domain build prerequisite was restored from the shared build cache.
- In t218, `& 'C:/Program Files/Git/bin/bash.exe' C:/Users/osrs_/FluxStuff/build-slots/heavy.sh 'codex lab bookkeeping prerequisites and focused tests' pnpm --filter @fluxiq-web-extension/test-runner... build`
  exited 0: domain build (35,620 ms), cached test-contracts/test-evidence,
  runner build (62,134 ms). Despite the wrapper label, this command built only;
  no test ran. A requested cancellation was attempted only while queued; by
  inspection it already held b2, so no process was stopped. No further t218
  checks will run; t220 final validation must exercise its completed sources.
- `packages/test-runner/src/flow-lane/tests/terminal-run-wait.test.ts` adds a
  fake-clock transition regression: an active repair becomes a failed terminal
  rerun and settles after exactly one 250 ms poll. Covered by the passing full runner suite.
- t220 Core: `& 'C:/Program Files/Git/bin/bash.exe' C:/Users/osrs_/FluxStuff/build-slots/heavy.sh 'codex lab bookkeeping Core audit' node scripts/structure-audit.mjs`
  exited 1. Sole violation: unchanged `runtime/service.ts` has 4,506 lines,
  above its inherited 4,505-line baseline. `git diff -- <service.ts>` was empty;
  `git show HEAD:<service.ts>` has 4,506 lines and normalized HEAD/current source
  SHA-256 equality is true. No service source or baseline was changed. All other
  rules passed; the supervisor notes the separately owned Task4/Task5 service
  reductions will remove this inherited integration failure.

## Not verified

No live behavior is exercised: the brief prohibits Lab, browser, Playwright and provider calls.

## Final validation results

- t220 Core root `pnpm build` exited 0: Core library, gateway and web build completed. Library emitted 4,625 files; web compiled, type checked and generated 17 pages.
- t220 downstream `pnpm --filter @fluxiq-web-extension/test-runner... build` first failed only because the new proposed-build fixture omitted required `toolIds`; corrected the synthetic fixture, then queued the final rebuild. Domain compilation already passed with the public screening export.
- Full runner/domain suites, focused Core diagnostic suites, Core explicit tsc, new bundle test, downstream structure audit and supplemental Core doc-links audit ran under distinct `codex lab bookkeeping` heavy labels. Final results follow. No Claude process or build-slot owner was changed.
- F15 source confirmation: Core `runtime/result-verification/run-outcome.ts` settles a failed repair rerun with `rerun_failed` at line 354, and `settleResultRepair` persists the settled marker. Core's `recovery/refuted-result/repair.ts` transitions active phases to `settled`. The downstream wait must still respect a genuinely active `rerunning` marker; no production wait change is needed.
- Core `pnpm exec vitest run diagnostic.test diagnostic-trace` exited 0: two files, five tests passed; old executions remain compatible, malformed diagnostics drop without losing execution, and generic structural data survives sanitized trace/public-step reconstruction.
- Downstream `node --test scripts/lab/live-campaign/row/tests/bundle.test.mjs` exited 0: one test passed, confirming the call-time account is read from the existing `snapshots/flow-lane.json` artifact.
- Downstream `node scripts/structure-audit.mjs` exited 0: passed with 135 advisory warnings and 119 baselined findings; no baseline was raised.
- Runner full `pnpm --filter @fluxiq-web-extension/test-runner test` started and confirmed Core's build current. It owns the fresh runner build. The redundant queued `downstream final build` wrappers (exact PIDs 11116/21464, verified label/command and no owned slot) were stopped to prevent concurrent writes to runner `dist`; its exit 1 is cancellation, not a build failure. No other process or slot was touched.
- That runner command's fresh `test-runner:build` passed in 54,509 ms (1,462 files emitted), then began the full suite. The supervisor was notified immediately to run independent focused checks against final artifacts.
- Core `pnpm exec tsc --noEmit -p tsconfig.json` in `packages/fluxiq` exited 0. Core `node scripts/structure-audit.mjs --rule docs-links` exited 0 (zero warnings/baselined findings).
- Domain `pnpm --filter @fluxiq-web-extension/domain test` exited 0: 1,064 tests passed, zero failed/cancelled/skipped, 107,123 ms. Its prerequisite Core build guard passed.
- Runner `pnpm --filter @fluxiq-web-extension/test-runner test` exited 0: 1,730 tests passed, zero failed/cancelled/skipped, 124,514 ms. Observed new permission-stop repeated-resume, strict publication screen, and proposed/refused diagnostic-preservation regressions pass.
- All requested checks are now observed. The only nonzero product gate is the unchanged inherited Core full-audit `service.ts` line count documented above; no baseline changes or bypasses were introduced. No additional fixes are pending in this bounded task.
- `git diff --check` exited 0 in both paired repositories.
- Original full-suite final output portions (including observed totals; earlier chunks were returned directly, not saved) are available for supervisor inspection at OS TEMP `C:/Users/osrs_/AppData/Local/Temp/codex-t220-domain-suite-final.log` and `C:/Users/osrs_/AppData/Local/Temp/codex-t220-runner-suite-final.log`. These are synthetic test output only and are not repository artifacts.
- The supervisor independently observed five Core diagnostic tests, 87 runner focused tests and 12 domain/bundle focused tests pass with no failures/skips. Source and report are frozen for supervisor commit/integration.

## Supervisor verification

Reviewed bench reconstruction, F15 terminal settlement, pre-call refusal projection, strict publication screen, generic Core diagnostic transport and both trace rebuilders. Independently ran heavy label `codex t220 supervisor diagnostic regressions`, Core package `pnpm exec vitest run diagnostic-trace evidence-loop/tests/diagnostic` -> 2 files/5 tests passed, exit0. Independently ran heavy label `codex t220 supervisor bench refusal F15 checks`: `node --test packages/test-runner/dist/bench/tests/run-bench.test.js packages/test-runner/dist/flow-lane/tests/terminal-run-wait.test.js packages/test-runner/dist/existing-fluxiq-control/tests/publishable-step-value.test.js packages/test-runner/dist/flow-lane/creation/tests/build-proposal.test.js` -> 87/87 passed; then `node --test domain/.test-build/runtime/llm-evidence/refusal-diagnostic/tests/diagnostic.test.mjs domain/.test-build/runtime/llm-evidence/node-run/tests/run.test.mjs scripts/lab/live-campaign/row/tests/bundle.test.mjs` -> 12/12 passed. Both have zero failures/skips; complete chain exit0. Inspected original full-suite final logs directly: domain1064/1064 and runner1730/1730, zero failures/skips. Independently confirmed failing Core service.ts is unchanged from HEAD and both diff checks pass. Final supervisor type/freshness check queued before local commit. No live behavior claimed.

Final supervisor heavy label `codex t220 supervisor type freshness check`: Core package `pnpm exec tsc --noEmit -p tsconfig.json` -> exit0; downstream `node scripts/check/core-build.mjs` -> exit0, private Core build current with source. Complete chain exit0. All changed behavior verified independently; the inherited full Core size-audit failure remains transparently recorded. Local paired commits only; Claude owns integration, nothing merged or pushed.
