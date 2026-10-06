# t195-w42 judge-stopped-round: worker report

## Outcome

Mostly done. A round that stops short (ending kind `unfinished`, not a budget stop) is now put to the build's judge when four things hold: its Flow ran clean from its start, the caller can build it as it stands (`acceptStopped`), it is non-empty, and it is not the Flow a judge last said no to (`judgedNo`). The failing-first test now passes, all of `flow-bootstrap` passes (1134/1134), the core check exits 0, and the audit shows no finding in my files.

Two things are not clean:

- `service-bootstrap/tests/extend.test.ts` fails 4 of 5 tests with `flow_bootstrap.evidence_budget_exhausted`. It fails the same way with my new path switched off (shown below), so another worker's in-flight edits to `llm/evidence-loop/rerun-*.ts` and `flow-draft/amendment.ts` cause it, not this change.
- `node scripts/structure-audit.mjs` exits 1 on one violation: `llm/node-tools/replay-span.ts` imports `../step-log/scope.ts` without going through the barrel. That file is another worker's in-flight edit and is on my must-not-touch list.

## What changed and why

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`. `U` = `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build`.

- `U/reserve-judging.ts`: generalised rather than copied. `automationStudioFlowBootstrapJudgeAtReserve` now takes `stopped: "reserve" | "short"`, which only picks the built Flow's summary text.
  - The `judged` result now also carries `verdict`: the non-yes verdict as it applies to this Flow, so a yes about another Flow comes back as `not_judged`.
  - Module comment rewritten to cover both cases, citing `run-musp474o-e0ed7432`.
- `U/phases.ts` (705 lines, budget 800):
  - New `unchangedSinceNo`: the Flow is the one a judge last said no to, by signature. `unchangedAtStop` is now `stoppedAtReserve && unchangedSinceNo`.
  - New `shortJudged = ending.kind === "unfinished" && judge !== undefined && !unchangedSinceNo`.
  - The phase-2 test runs with `{ judged: true }` when `atReserve || shortJudged`, so the service's `buildJudge.judgedTest()` hands the test report and flowSignature to the judge.
  - The judging step now runs for `atReserve || shortJudged`, with the same rules as before:
    - A yes about this Flow finishes the build.
    - Any other verdict becomes the round's judgement.
    - `judgedAtStopUsd` is set only for reserve stops, so a short round's later cost ending is unaffected.
    - A `no` now updates `judgedNo`.
    - A short round announces "Judging the Flow" just before the judge is called.
  - Phase 3's rules then apply unchanged: stillAchievable no ends it not doable; progress is measured against the previous judgement; a judge who named the fix buys one more round if the purse funds it.
  - Comments updated: a new module paragraph citing the run, and the `judgedNo` and `acceptStopped` docs.
- `U/judgement.ts`: doc comments only (`AutomationStudioFlowBootstrapUnfinishedTest`'s `judged`, `automationStudioFlowBootstrapWithJudgeAccount`).
- `U/tests/judge-stopped-round.test.ts` (new), 5 tests:
  - A yes about the stopped round's changed Flow finishes the build, and its test runs with `judged: true`.
  - A no with advice opens one more round.
  - stillAchievable no ends the build not doable.
  - Pin: the same Flow as the judged-no one is not judged again (`not_finished`).
  - Pin: a dirty test is not judged.

`progress.ts` and `round-funding.ts` were read and needed no change: the judging pair is already kept back from the build's start.

## Commands run and observed results

All from the Core tree root.

- **Baseline, before any edit.** The 4-dir vitest command from the brief gave `Test Files 1 failed | 101 passed (102)`, `Tests 1 failed | 1271 passed (1272)`. The only failure was an `adaptation.test.ts` 5000 ms timeout.
- **Failing first.** `npx vitest run --exclude ".tmp/**" .../U/tests/judge-stopped-round.test.ts` gave `Tests 3 failed | 2 passed (5)`.
  - "is put to the judge": the tests list differed, because round 1's test ran without `judged`.
  - "no with the fix named": `expected [ +0 ] to deeply equal [ +0, 1, 2 ]`, meaning only round 0 was judged.
  - "not doable": `expected [ +0 ] to deeply equal [ +0, 1 ]`.
  - The 2 pins passed today, as intended.
- **After.** `npx vitest run --exclude ".tmp/**" .../flow-bootstrap/unfinished-build` gave `Test Files 21 passed (21)`, `Tests 148 passed (148)`.
- **After, final.** `npx vitest run --exclude ".tmp/**" .../runtime/flow-bootstrap` gave `Test Files 76 passed (76)`, `Tests 1134 passed (1134)`.
- **After, the 4-dir command.** `Tests 18 failed | 1259 passed (1277)`, all in `service-bootstrap`: 14 were 5000 ms timeouts and 4 were `extend.test.ts` `evidence_budget_exhausted`. `deepseek-bootstrap`, `service-authoring` and `flow-bootstrap` had no failures.
  - Re-running `service-bootstrap` alone gave 29 failures, a different set of timeouts each run while other workers were loading the machine.
  - The 13 non-extend files run serially (`--no-file-parallelism`) gave `12 failed | 75 passed`, all timeouts.
  - The 5 files that still failed, re-run with `--no-file-parallelism --testTimeout=30000` (accounting, adaptation, generation, rejections, state-digest-and-trace), gave `Test Files 5 passed (5)`, `Tests 50 passed (50)`.
- **extend.test.ts, isolating the cause.** Run alone it gave `4 failed | 1 passed`, each `Flow Bootstrap generation failed (flow_bootstrap.evidence_budget_exhausted)`.
  - A temporary probe in my `phases.ts` showed round 0 stops on `iterations` with 2 steps.
  - With my path disabled by a temporary env switch (`shortJudged` false), the result was identical: 4 failed, same error. So this change does not cause it.
  - The probe and switch were then removed (`grep "T195W42\|process.env" phases.ts` finds nothing).
  - `extend.test.ts` passed in the baseline, and the tree now has uncommitted edits by others to `llm/evidence-loop/rerun-replacement.ts`, `rerun-request.ts` and `flow-draft/amendment.ts`, `entry.ts` and `step.ts`.
- **Typecheck.** `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195 w42 core check" pnpm --filter fluxiq check` exited 0. The build cache noted that inputs changed while it ran, so it was not stamped.
- **Audit.** `node scripts/structure-audit.mjs` exited 1 with 1 violation, `[imports] llm/node-tools/replay-span.ts` (not mine). For my files there are warnings only: `phases.ts` at 705 lines (advisory 400, budget 800), and the directory file counts in `unfinished-build/` and `unfinished-build/tests/`, which are advisory.

## Not verified

- No live run. Whether the service's completion check (`acceptStopped`) would accept round 2's Flow in `run-musp474o-e0ed7432` is unknown. If it refuses, the round is still not judged, as today.
- `extend.test.ts` was not re-verified once the other workers' rerun edits settle.
- No timed-out test was seen passing at the default 5000 ms timeout under the current load. Only the 30 s re-run passed.

## Open questions or contradictions found

- **Wider than the run's case.** As the brief specifies ("differs from `judgedNo`"), a stopped-short round is also judged when no judge has said no yet, for example round 0 stopping short in exploration with a clean, acceptable Flow. That is the same rule as a reserve stop. It costs one judging pair from the reserve and can finish a build earlier.
- **Same Flow as the judged-no one.** Such a round is not judged again and gets no judge account copied onto its judgement, unlike the reserve-unchanged case. So with no measured progress it ends `not_finished` at once (judgedFixNamed is false), as today. If the supervisor wants that round to carry the earlier judge's account, and so get the one-more-round allowance, that is a one-line change in `phases.ts`.
- **Stale reference.** `service/flow-bootstrap-commands/build-judge.ts`'s `judgedTest` doc still describes only the reserve case. It is outside my ownership.
