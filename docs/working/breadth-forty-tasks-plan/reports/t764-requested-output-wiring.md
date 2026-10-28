# Report: t764-requested-output-wiring

## Outcome
Done for the five steps. Two unrelated-looking test groups outside the brief's paths fail (see Not verified).

## What changed and why
Core paths are under `packages/fluxiq/src/programs/automation-studio/runtime/`.
1. `project-agents/supervisor/tools.ts`: part schema takes optional `answer {kind:"records", columns}`; part stays closed.
2. `project-agents/supervisor/guidance.ts`: one generic sentence in the write_plan tool text and in step 1.
3. `service/project-build/task-checklist.ts`: `checked()` copies `answer`; new `requestedOutput(spec)` builds the declared parts and columns.
4. Persistence: `service/project-build/promote.ts` adds `requestedOutput` to the proposal's `candidateTrial`; `flow-version/judged-build-trial/` (`applied.ts`, `contracts.ts`, `metadata-with.ts`, `from-metadata.ts`, new `requested-output.ts`, `index.ts`) saves it on the Flow's judged-trial record, read back strictly. `result-verification/run-outcome.ts` has a new `requestedOutput` port passed to `verify`; `service.ts` backs it from the saved Flow metadata. A Flow without one is judged as before.
5. `project-agents/amendment/part-change.ts`: a changed `answer` is `change: "changed"` ("its declared answer changed"), so its carried proposal is dropped.
6. Docs: paragraph in `docs/architecture/automation-studio.md`; `pnpm docs:reference` regenerated both framework-reference files.

Tests (written before the code, except as noted): `supervisor/tests/answer-declaration/tests/answer-declaration.test.ts`, `amendment/tests/part-change.test.ts`, `service/project-build/tests/project-build-task-checklist.test.ts` (copy and requestedOutput), `flow-version/judged-build-trial/tests/judged-build-trial.test.ts`, `result-verification/tests/requested-output-route/tests/run-outcome-port.test.ts`.

UNIT READY: all files above plus the two `framework-reference.md` files and `docs/architecture/automation-studio.md`.

## Commands run and observed results
Core, from `packages/fluxiq`, `FLUXIQ_BUILD_CACHE_DIR=off`:
- `pnpm test <project-agents, service/project-build, 3 prompt-contract files>` final: parallel `Test Files 94 passed (94)`, `Tests 672 passed (672)`; real-sql `Test Files 8 passed (8)`, `Tests 47 passed (47)`. The three prompt-contract files are in that run.
- Wider earlier run (project-agents, project-build, result-verification, flow-version, flow-bootstrap-commands, candidate-trial): parallel `1 failed | 277 passed (278)`, `5 failed | 2123 passed`; real-sql `2 failed | 17 passed (19)`, `3 failed | 90 passed`. All failures are in `flow-bootstrap-commands/tests/` (`build-judge.test.ts` x5, `applied-judged-trial.test.ts` x2, `candidate-failure-kept.test.ts` x1), all showing the judge answering `not_judged` / `model_unavailable` instead of `no`.
- `NODE_OPTIONS=--max-old-space-size=6144 pnpm check`: exit 0, final run "build" stamp after the last edit.
- Repo root: `pnpm structure:check` -> `structure-audit: passed (443 warning(s), 1152 baselined)`; `pnpm docs:check` after `docs:reference` -> "Deterministic framework reference is current."

## Not verified
- The 8 `flow-bootstrap-commands` failures: not proved pre-existing (no baseline run; t757's report lists the same `not_judged` symptom in other files). `applied-judged-trial.test.ts` touches the file I changed (`applied.ts`), so the supervisor should compare against dev.
- Downstream test-runner/test-contracts typechecks not run (additive optional fields only).
- No live, browser or paid run; the real `write_plan` reply with `answer` was not exercised. Promotion carrying `requestedOutput` end to end (through `service.ts` apply) has unit coverage only at each seam, not one test across them.
- Subflow-only trials are not gated; only the whole trial promotes.

## Open questions
- `part-change` reports `changed` rather than a new member; amendments therefore re-dispatch a part whose only difference is `answer`.
