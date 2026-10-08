# t360: the structure audit refuses new import cycles; the cycle t358 found is fixed

Worker: t360-cycles. Worktree `C:\Users\osrs_\FluxStuff\fxwork\t360\` (Core and
downstream), branch `task/t360-audit-import-cycles` on both sides. Nothing committed.

## Outcome

Done.

1. **The cycle t358 found is fixed.** `harness-options/plan-node-handles.ts` now
   imports its three handle constants from their owner,
   `llm/harness/structured-response.ts`, not through `llm/harness.ts`.
   `plan-parameter-resolution.ts` went through the harness barrel, which also leads
   back into the cycle, so it now imports from the owner too. Both modules have left
   the cycle: the largest Core cycle went from 110 modules to 108. A new test runs
   the handle check in both load orders. It failed 3 of 8 with the old import (only
   in the bootstrap-completion-first order) and passes 8 of 8 with the fix.
2. **A new structure-audit rule, `import-cycles`.** It finds module cycles among all
   audited scripts, barrels included, counting only imports that survive compilation.
   It baselines each module in a cycle by how many of its imports lead back, and fails
   on a new member, on a new import that leads back, and on two cycles merging. The
   message prints the shortest loop each import closes and how to break it. Authored
   in Core and mirrored byte for byte (line endings aside) downstream, with each
   repository's own baseline.
3. **Baselined today:**
   - Core: 10 cycles, 223 modules, 452 imports that lead back. The largest cycle has
     108 modules (runtime/llm with flow-bootstrap and others). The next largest are
     55 (apps/web automation-studio), 12, 11 and 10. The biggest single entry is
     `runtime/llm/index.ts` with 13.
   - Downstream: 8 cycles, 78 modules, 140 imports. The largest cycle has 36 modules
     (`domain/src/runtime/llm-evidence`), the next 8, 7 and 6. The biggest single
     entry is `domain/src/runtime/llm-evidence/index.ts` with 7.

## What changed and why

Core (`C:\Users\osrs_\FluxStuff\fxwork\t360\!FluxIQ`):

- `packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/plan-node-handles.ts`:
  imports the constants from `../harness/structured-response.ts`, with a comment
  saying why.
- `.../harness-options/plan-parameter-resolution.ts`: the same change, from
  `../harness/index.ts`. t358 had picked the barrel, which only happened to work in
  the load orders it saw.
- `.../runtime/llm/harness.ts`: a comment only. Modules inside the cycle import from
  the owning file, and the audit refuses new loops through this file. The
  `export *` itself is unchanged.
- `.../harness-options/tests/plan-node-handles-load-order.test.ts` (new): each case
  calls `vi.resetModules()`, then imports in the order under test. Order 1 is
  bootstrap-completion first (the order that failed). Order 2 is the handle check
  first. Each order checks four things: a bad token is refused, an over-long token is
  refused, 17 references are refused, and a 64-character handle is accepted.
- `scripts/structure-audit/import-graph/` (new, with an `index.mjs` barrel):
  - `runtime-specifiers.mjs`: static imports and re-exports, leaving out only
    `import type` and `export type`. Under `verbatimModuleSyntax`,
    `import { type A }` still emits `import {}`, so it counts. Dynamic `import()`
    does not count, because it runs after the static graph has evaluated.
  - `runtime-graph.mjs`: resolves specifiers with browser-graph's resolver
    (relative paths, plus workspace packages into source) and is cached per audit
    run.
  - `cycle-components.mjs`: Tarjan's algorithm, iterative.
  - `shortest-loop.mjs`: finds the loop that one import closes.
  - `reachable-modules.mjs`: lists every module a barrel reaches.
- `scripts/structure-audit/rules/import-cycles.mjs` (new): the rule. It uses
  key = module, value = imports that stay inside its cycle, and is ratcheted.
- `scripts/structure-audit/rules/imports.mjs`: **a deliberate change to the
  barrel-skip check.** A value import that reaches past a barrel is no longer
  counted when that barrel's own imports lead back to the importer. Without this,
  the two rules refuse each other's remedy: the fix above became two new `imports`
  failures. Type-only imports are still counted.
  - The same rule had already been worked around by hand 22 times: 20 apps/web files
    plus `dsl/compiler.ts`, `adaptation-store.ts` and `compiled-plan-store.ts`. Those
    entries are now exempt and were removed or lowered with
    `--update --rule imports`. I compared the findings with the exemption on and off.
    Separately, a stale entry for `runtime/tests/state-linker.test.ts` was dropped
    in the same update.
- `scripts/structure-audit/rules/tests/import-cycles.test.mjs` (new, 12 tests) and
  `rules/tests/imports.test.mjs` (4 new tests for the exemption).
- `.structure-baseline.json`: `--adopt import-cycles` added 223 entries, and
  `--update --rule imports` lowered 2 entries and removed 21.

Downstream (`C:\Users\osrs_\FluxStuff\fxwork\t360\!FluxIQWebExtension`):

- The same `import-graph/`, `rules/import-cycles.mjs`, `rules/imports.mjs` and both
  test files, copied with LF line endings. `diff -rq --strip-trailing-cr` against
  Core shows only `config.mjs` differing, as before.
- `.structure-baseline.json`: `--adopt import-cycles` added 78 entries. No
  `imports` entry changed downstream.

## Commands run and observed results

- Fail-first, handle check:
  - `npx vitest run .../harness-options/tests/plan-node-handles-load-order.test.ts`
    with the old `../harness.ts` import restored temporarily printed
    `Tests 3 failed | 5 passed (8)`. The 3 failures were the refusals in the
    bootstrap-completion-first order. The handle-check-first order passed.
  - With the fix: `Tests 8 passed (8)`.
- Fail-first, imports exemption: with the exemption line commented out,
  `node --test scripts/structure-audit/rules/tests/imports.test.mjs` printed
  `not ok 19 - a value import of the owner past a barrel that leads back to the importer is not counted`,
  `# fail 1`. With it restored: `# pass 22`, `# fail 0`.
- Audit tests, Core:
  `node --test "scripts/structure-audit/rules/tests/*.test.mjs" "scripts/structure-audit/tests/*.test.mjs"`
  printed `# tests 226`, `# pass 226`, `# fail 0`.
- Audit tests, downstream: the same command printed `# tests 226`, `# pass 226`,
  `# fail 0`.
- Core audit: `node scripts/structure-audit.mjs` printed
  `structure-audit: passed (288 warning(s), 710 baselined).`, exit 0. The one
  lowerable entry is the existing `file-lines` entry for `runtime/service.ts`, which
  is not mine.
- Downstream audit: `node scripts/structure-audit.mjs` printed
  `structure-audit: passed (176 warning(s), 257 baselined).`, exit 0.
- Core vitest over runtime/llm, from `packages/fluxiq`:
  `npx vitest run src/programs/automation-studio/runtime/llm/` printed
  `Test Files 166 passed (166)`, `Tests 1687 passed (1687)`, exit 0.
- Core typecheck: `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` gave
  `tsc exit 0`.
- Native Node against the built `dist`. The dist was built at 18:19, before my edit,
  so this is the old code:
  - Importing `harness-options/bootstrap-completion.js` first, or
    `plan-node-handles.js` first, **throws** `ReferenceError: Cannot access
    'AUTOMATION_STUDIO_LLM_DIAGNOSIS_TEXT_MAX_LENGTH' before initialization` at
    `llm/deepseek/output-schema.js:16`.
  - Importing `runtime/index.js` first, then `plan-node-handles.js`, refuses the
    bad token (`malformed: true`).

## Not verified

- The native Node behaviour after my fix. I did not rebuild `dist`.
- The downstream product test suites. Only downstream audit files changed.
- Core vitest outside `runtime/llm`. The import change touches only two modules
  there, and their consumers are covered by the 166 files that ran.
- Rule runtime cost: a whole Core audit took about 15 s wall clock, against about
  10 s for the graph exploration alone. I did not compare it with the audit before
  the rule.

## Open questions or contradictions found

- **The cycle hazard is real under native Node, not only under vitest.** When the
  built package is entered at a `harness-options` module, evaluation throws a TDZ
  `ReferenceError` in `llm/deepseek/output-schema.js`, which reads a harness
  constant at module top level. The production entries (`runtime/index.js` and the
  package barrels) load in an order that works. Any new entry point, worker or
  script that imports a harness-options module directly would crash.
  `deepseek/output-schema.ts` and the other `deepseek/*` importers of `../harness.ts`
  are outside my brief. They are baselined, not fixed.
- **Merge interaction with t359.** The downstream extension action modules are in a
  baselined cycle: `content/actions/execute.ts` (3), `click.ts`, `index.ts` and
  `wait-for-selector.ts` (1 each). If t359 adds a file to that cycle, or another
  import that leads back, the downstream audit fails once both are merged. That
  failure is the intended behaviour. No Core `runtime/executor/**` module is in a
  cycle.
- **Rule docs not updated.** `docs/architecture/code-structure.md` (Core) and
  `docs/architecture/repository-layout.md` (downstream) list the audit's rules, and
  neither mentions `import-cycles` or the new barrel exemption. They were not in my
  brief.
- **Breaking a file inside a large cycle into two will fail the audit.** The new file
  has no entry. This is by design: the remedy is to break the loop, not to baseline
  it. The supervisor may want that called out to the lanes working in runtime/llm
  and flow-bootstrap.
