# t1016 brief: task memory tolerates only a store that cannot be read or written

Lead: Claude Code. Task t1016. Trees: Core `C:/Users/osrs_/FluxStuff/fxwork/t1016/!FluxIQ` (branch `task/t1016-memory-tolerance`), downstream `C:/Users/osrs_/FluxStuff/fxwork/t1016/!FluxIQWebExtension` (report only). Work in the Core tree.

Goal: `packages/fluxiq/src/framework/automation-service/service/answer-first/task-model/resolve.ts`, `tolerated` (~line 39), swallows every error from unscoped task memory except `AutomationStudioAnswerFirstTaskMemoryIntegrityError`, so a programming error (a TypeError, a bad argument, a contract bug) silently becomes "no memory" and the task falls back to the default model with nothing reported. That hides errors (AGENTS.md: hiding an error is not a fix). Tolerate only a store that could not be read or written (the store unavailable, locked or busy, an I/O failure), and let every other error through.

How:
- Find how task memory's stores fail: `answer-first/task-memory/` (ports, `automationStudioAnswerFirstTaskMemoryOf`) and the store adapters it is built on. If they already raise a typed I/O or unavailable failure, tolerate exactly that. If not, add one typed error at the store boundary, where the adapter catches the driver's error, in the module that owns that boundary (one exported thing per file, a barrel in every directory). Never classify by message words.
- Keep: scoped memory stays strict; an integrity error still stops the task; the attempt's opening read keeps its own best-effort rule (check it uses the same classification, and change it to match if it swallows everything too).

Owned paths (Core): `answer-first/task-model/**`, `answer-first/task-memory/**`, and the store adapter file(s) task memory uses (name them in your report). Must not touch: `runtime/llm/**`, `answer-first/attempt/**`, `answer-first/earlier-rounds/**`, `scripts/**`, the shared Core `C:/Users/osrs_/FluxStuff/fxwork/!FluxIQ`, any Lab run.

Acceptance (from `packages/fluxiq`, quote outputs):
- New tests in `task-model/tests/resolve.test.ts`: a store I/O failure is tolerated (default model, task goes on); a TypeError from the store is thrown; an integrity error is thrown; scoped memory throws on an I/O failure.
- `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/framework/automation-service/service/answer-first/task-model src/framework/automation-service/service/answer-first/task-memory <adapter test dirs> --maxWorkers=1 --minWorkers=1 --fileParallelism=false` passes.
- `pnpm --filter fluxiq check` exit 0; `node scripts/structure-audit.mjs` (Core root) passes.
- Leave the fluxiq version alone; the lead bumps it at merge.

Report: `C:/Users/osrs_/FluxStuff/fxwork/t1016/!FluxIQWebExtension/docs/working/data-first-simplification-plan/reports/t1016-memory-tolerance.md`. No git. No `node -e`. End with the return contract.
