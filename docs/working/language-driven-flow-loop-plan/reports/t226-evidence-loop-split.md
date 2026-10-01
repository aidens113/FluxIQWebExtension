# t226 report: evidence-loop.ts back under the 800-line limit

## Outcome

Done. `runtime/llm/evidence-loop.ts` went from 802 to 731 lines, leaving 69
lines of headroom. `node scripts/structure-audit.mjs` passes, and so do
`pnpm docs:check`, `tsc` and the brief's three vitest directories. Behaviour is
unchanged and no comment was trimmed: every comment that left the loop body
moved with its code.

## What changed and why

**Why it grew.** The file was a giant function body: `runAutomationStudioLlmEvidenceLoop`
is roughly 560 of its lines. Round 5 added only a handful of lines: lane B's
`rerunHeld` settling, lane C's purse (`purse.run` / `purse.refused`, and the
`costRefusal` and `budgetBound` branch in `exhausted`), and the named
`tool_result_invalid` codes. That was enough to push a body already near the
limit over it. The code-structure doc's cut for this cause is to extract named
steps into the modules that own them.

**Where the extractions could go.** No new file fits in `evidence-loop/`:

- it already holds 25 source files, the `directory-files` cap;
- a subdirectory under it would be 10 path segments, past the 9-segment depth limit (`naming.mjs`).

Moving `rerun-input/replacement/request.ts` into a `rerun/` subdirectory was
ruled out for the same depth reason. It would also have left stale path
references in comments in files outside my ownership (`flow-draft/amendment.ts`,
`decision-handlers/amendment.ts`, `evidence-progress/no-progress.ts`,
`tests/draft-amendment-feedback.test.ts`). So each extraction went into the
existing `evidence-loop/` file that declares the noun it writes. That follows
the `accounting.ts` precedent: a type plus the function group that fills it.

1. **The row recorder, moved to `evidence-loop/trace.ts`.** This was the
   opening ~60 lines of the loop body:
   - `recordRow`, together with its `draftShown`, `draftRevision`,
     `previousAnswerability` and `sameAnswerability` state;
   - both doc blocks (the moment stamp and the draft shown).

   It is now `automationStudioLlmEvidenceLoopTraceRecorder(trace)`, returning
   `{ draftShown, draftRevision, answerability, record }` (type
   `AutomationStudioLlmEvidenceLoopTraceRecorder`). `record` is a closure, not a
   `this` method, so the loop's `const recordRow = rows.record` and the
   handlers' detached use behave as before. The push order of the row's members
   is unchanged. The `transition` parameter type comes from
   `../decision-handlers/index.ts` as an `import type`, which is erased; the
   imports rule exempts type-only edges and no boundary is configured there.
2. **The exhaustion record, built in `evidence-loop/exhaustion.ts`.**
   `automationStudioLlmEvidenceLoopExhaustion(state)` builds the
   `AutomationStudioLlmEvidenceLoopExhaustion` record. It keeps the same fields
   in the same order and the same expressions, with the inline comments moved
   alongside. `exhausted()` in the loop now calls it.
3. **The coordinator, `evidence-loop.ts`.**
   - It imports both functions through the `./evidence-loop/index.ts` barrel,
     which already re-exports both files.
   - `draftShown = …` became `rows.draftShown = …`.
   - The `noProgress` facts read `rows.answerability`.
   - The handlers' `draftRevision` reads `rows.draftRevision`.
   - The two type imports it no longer uses were dropped. The public type
     re-exports are unchanged.
4. **New tests.**
   - `evidence-loop/tests/trace.test.ts` (4 tests): the stamps, revision counting,
     the answerability comparison across rows that observed none, and the draft
     shown when `record` is used detached.
   - `evidence-loop/tests/exhaustion.test.ts` (4 tests): proposable counting, the
     unbroken-refusal rule for `lastIssueCodes` (as a copy), `budgetBound` only on
     a budget ending, and `cost` plus a copy of the purse's refusal.
5. **The generated references.** Both `framework-reference.md` files were
   regenerated with `pnpm docs:reference` (2851 to 2853 declarations). The two
   added declarations are round 5's `AutomationStudioPermissionAskOutcome` type
   and value from `parking/`. My new exports are not public; only the existing
   exhaustion type's line number moved.

Line endings were kept as CRLF to match the working copy (`core.autocrlf=true`).

## Commands run and observed results

- `npx tsc --noEmit -p .` in `packages/fluxiq` (via `heavy.sh`): exit 0, no output. Run both before and after adding the tests.
- `npx vitest run --testTimeout=120000 src/programs/automation-studio/runtime/llm src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/runtime/recovery` (via `heavy.sh`): exit 0, `Test Files 183 passed (183)`, `Tests 2154 passed (2154)`.
- `node scripts/structure-audit.mjs` at the Core root: exit 0, `structure-audit: passed (206 warning(s), 353 baselined).` `evidence-loop.ts` now only warns (731 lines, past the 400-line advisory threshold). `evidence-loop/` is still at 25 files, a warning.
- `pnpm docs:check` before regenerating: failed with `docs/reference/framework-reference.md is stale`.
- `pnpm docs:reference`: `Wrote docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md (2853 public declarations).`
- `pnpm docs:check` after: exit 0, `structure-audit: passed (0 warning(s), 0 baselined).` and `Deterministic framework reference is current.`

## Not verified

- I ran no package-wide or repository-wide `pnpm check`, `pnpm test` or `pnpm build`; only the commands the brief named.
- No live or Lab run.
- I made no commit, as the brief requires.

## Open questions or contradictions found

- The brief said to place the extraction "into `evidence-loop/`", but `evidence-loop/` is full (25 files) and cannot take a subdirectory (depth limit 9). The cut therefore extended two existing files rather than adding new ones. The next extraction from this loop will hit the same wall. The obvious remaining candidates are the initial observation (~55 lines) and the trio of unusable decision, refusal and unreadable reply (~58 lines). Either needs a sibling directory under `runtime/llm/`, as t208 did with `evidence-progress/`, or a move of one of the `evidence-loop/` files out to one.
- `evidence-loop/trace.ts` now holds a type-only import of `decision-handlers/` (`AutomationStudioLlmEvidenceRowTransition`), while `decision-handlers/` imports `evidence-loop/` for values. This is erased and allowed by the imports rule. The cleaner home for that type would be beside the recorder in `trace.ts`, re-exported from `decision-handlers/types.ts`, but `decision-handlers/` was outside my ownership.
