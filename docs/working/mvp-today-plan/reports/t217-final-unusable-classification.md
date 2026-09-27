# t217 — Final unusable classification

## Outcome

Implemented the terminal-classification parity fix in FluxIQ Core. When the literal `maxIterations` exit follows an unusable final decision, the evidence loop now routes that refusal through the configured `unusableDecisions.stalled` callback with its last issue codes. A loop whose final decision was usable but non-completing still ends as `llm_evidence_loop.iteration_limit`.

No budget, iteration, token, cost, duration, tool-call, draft-amendment, or completion-answerability rule changed.

## Changed files

- `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\llm\evidence-loop.ts`
  - Added one local exhaustion helper shared by the existing budget-zero path and the bottom-of-loop max-iteration path.
  - The helper preserves the last unusable issue through `stalled`; with propagated errors it throws the caller's classified error, otherwise it returns `llm_evidence_loop.invalid_decision`.
  - It returns generic `llm_evidence_loop.iteration_limit` when there is no current unusable decision.
- `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\llm\tests\loop-budget.test.ts`
  - Added coverage for a refused completion on the literal final iteration, proving the final schema is completion-only and the stalled callback receives the issue code/accounting.
- `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\llm\tests\unusable-decision.test.ts`
  - Updated the iteration-backstop case to require preservation of a final malformed-provider issue instead of generic iteration-limit.

`evidence-loop.ts` already contained other uncommitted task work before this brief. This task changed only the exhaustion helper and the two call sites described above; it did not overwrite or revert the pre-existing edits.

## Validation

- Focused Core tests:
  - Command: `pnpm --filter fluxiq test -- src/programs/automation-studio/runtime/llm/tests/loop-budget.test.ts src/programs/automation-studio/runtime/llm/tests/unusable-decision.test.ts`
  - Result: **passed**, 2 files, 57 tests.
- Core full check:
  - Command: `pnpm check`
  - Result: **passed**. Structure audit passed with pre-existing warnings/baselines; all workspace type checks completed successfully.
- Core full build:
  - Command: `pnpm build`
  - Result: **passed**, including contracts, FluxIQ package, websocket gateway, and optimized Next.js production build.
- Diff hygiene:
  - `git diff --check` on all three owned Core files passed.

No live Lab, provider, browser, or panel activity was performed. No commit was created.

## Behavioral consequence for Run 1's shape

The same final refusal seen in `run-muj2kzx1-8f9f8271` would now reach Flow Bootstrap's already-configured stalled callback as `bootstrap.cannot_answer_instruction`, allowing it to surface the actionable unusable-decision diagnosis rather than being overwritten by `flow_bootstrap.evidence_iteration_limit`. This change improves terminal truthfulness; it does not claim that the provider would author an acceptable Flow on the next live run.
