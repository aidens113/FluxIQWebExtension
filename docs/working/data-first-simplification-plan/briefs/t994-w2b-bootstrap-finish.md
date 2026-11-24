# t994 W2b: finish the Flow build and bootstrap sweep failures (worker-heavy, retry after W2 ran out)

Goal: every file of W2's cluster passes for the right reason. Same rules as W2: a product regression fixed at its cause, or a test pinning deliberately superseded behaviour updated to the new contract citing commit and rule. Never weaken an assertion, delete or skip a test, raise a timeout or cap a symptom.
Read first: W2's brief `.../briefs/t994-w2-bootstrap.md` (owned and must-not-touch paths, the test command) and W2's report `.../reports/t994-sweep-fix-core/w2-bootstrap.md` (causes found: t976 start-of-build instruction reading in b2ee9ed45 and the shared helper `tests/service-bootstrap/tests/instruction-reading.ts`; U1 fixed starting model; t966 zero-charge; t987 new result code; t950 policies). Both live in `C:/Users/osrs_/FluxStuff/fxwork/t994/!FluxIQWebExtension/docs/working/data-first-simplification-plan/`.
Code: `C:/Users/osrs_/FluxStuff/fxwork/t994/!FluxIQ`. W2's edits are in the working tree; build on them.

Where W2 stopped (its batch-1 run on the current tree, output `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/b9e846ce-920f-4917-ba85-cff713b3e423/scratchpad/w2-b1.txt`): 14/19 files pass; still failing:
- `flow-bootstrap-commands/tests/candidate-unusable-reply.test.ts` 3/3 (W2's computed accounting)
- `service/tests/provider-unavailable-authoring-modes.test.ts` 2/7
- `tests/deepseek-bootstrap/tests/answerability.test.ts` 2/3 (judge sees 7 build-test steps, 6 expected; cause unknown)
- `tests/refuted-result/tests/reauthor-service.test.ts` 1/9 ("does not leak private retention to a same-caller generation on another Flow")
- `programs/automation-studio/api/tests/service-bootstrap-adaptation.test.ts` 1/9 (near line 349-355; W2 guessed the start reading's tokens)
Never run: batch 2, the 16 service-bootstrap files listed in `.../scratchpad/w2-batch2.txt`; and `service/runtime-adaptation/tests/refuted-result-port.test.ts` (parallel group).
Also: remove the temporary `if (process.env.W2DBG)` debug line in `framework/automation-service/tests/deepseek-bootstrap/tests/harness.ts` (use your own temporary probes if needed and remove them too).

Additional must-not-touch (beyond W2's list): `runtime/llm/role-routing/**` and `framework/automation-service/service.ts` (supervisor changed them: the judge model now follows the Flow's provider default); `framework/persistence/automation/project/run-dataset-answer/**`, `run-dataset-store.ts`, migration 0041 (lane t998); `engine/automation/target-reacquire/**`, `engine/automation/unbound-reacquire/**`, `engine/automation/step-loop/incident-repair.ts` (lane t995); `answer-first/**` (other workers, lane t993). If a cause lies there, report it with a proposed diff.

Run tests through heavy-slot as W2's brief shows, label `t994-w2b`, in the foreground: wait for each run's result before your next step and never hand back with a run in flight. Keep batches small (at most 8 files) so each returns within the tool timeout (600000 ms); a timed-out foreground call keeps running in the background, so wait for it rather than starting another.
Acceptance: every file of W2's list (W2 report) passes in your final runs, with counts quoted; `node scripts/structure-audit.mjs` (Core root) passes; no debug lines left (`grep -rn W2DBG packages/fluxiq/src` empty).
Report: `.../reports/t994-sweep-fix-core/w2b-bootstrap-finish.md`: per remaining failure: cause, breaking commit, fix (rule cited), files changed, exact commands with observed counts; open questions. End with the return contract.
