# Brief t1051: the answer contract reads the asked columns right

**Goal.** The answer-contract reader in Core's `runtime/flow-authoring` misreads an instruction such as "... with
columns title only". It is most likely `runtime/flow-authoring/bootstrap/authoring/instruction-record-columns.ts`;
confirm that first.
- Because of the misread, the judge's yes-check (`runtime/result-verification/cited-yes/records-yes.ts`) matches
  asked against held columns by shared word, not by name.
- See `docs/working/data-first-simplification-plan.md`, the 2026-11-24 entry with "contract reader misreads":
  "that reader is to be fixed, then tightened."

**Do.**
1. First write a failing test of the reader over generic instructions (no realistic scenario's site, product or
   task; AGENTS.md "Model guidance never teaches to the test"):
   - "with columns X only";
   - "columns: X, Y";
   - "the X and Y of each";
   - a column named with two words;
   - an instruction that names no columns.
2. Fix the misreading at its cause, generally. Never special-case one phrase.
3. Tighten `records-yes.ts` to compare by the column names the reader now gives. Keep it tolerant only where a
   held column is honestly the same name: case, spacing, singular and plural. Keep its refutation rules: the
   asked table is not the rows, or a named column holds nothing.
4. Check `instruction-record-columns.ts`'s other callers still get what they expect.

**Proof.**
- The new reader tests fail before the fix and pass after.
- A records-yes test refutes a yes whose rows lack an asked column that only shares a word with a held one.
- The existing `cited-yes` and authoring tests pass.

**Owned paths (Core, `--core` task).** `runtime/flow-authoring/bootstrap/authoring/instruction-record-columns.ts`
and its tests, `runtime/result-verification/cited-yes/**`, and the tests beside each.
**Must not touch.** `runtime/flow-authoring/draft/**`, `runtime/llm/**`, `answer-first/**`,
`result-verification/result-evidence/**` (other tasks). No git, no paid or Lab runs, no `node -e`.

**Checks.**
- `pnpm --filter fluxiq check`.
- Vitest groups (parallel, real-sql) over `src/runtime/flow-authoring/bootstrap src/runtime/result-verification`.
- Core audit.
- Downstream `node scripts/check/model-text.mjs`.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1051.md`, ending with the return contract.
