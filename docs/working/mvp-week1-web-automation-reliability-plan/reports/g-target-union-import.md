# g-target-union-import: the Flow lane imports Core's target-resolution type

Worker report, 2026-09-13. This repository was at HEAD `7263534` when the work
started and `4c8f30c` when it ended, because other sessions committed meanwhile.
My files were untouched by those commits. Core was read at `187f40d`. Nothing in
Core was edited or built.

## Outcome

**Done.** The Flow lane no longer keeps its own copy of Core's target-resolution
union. It imports `AutomationNodeTargetResolution` from Core's public
`fluxiq/automation-studio/nodes` subpath, which is listed in Core's
`package.json` `exports`. There is no deep `dist` import.

- The persisted type is now derived from Core's type. The type checker says it
  is identical to the old local union (probe P1).
- The reader behaves the same way: all 10 rows in its test file pass.
- The type check now fails when Core's union gains a status the reader does not
  handle, or loses one it handles. Three simulated drifts each failed `tsc`.
- A behaviour mutation of the new status guard fails a test row.

## What changed and why

**`packages/test-runner/src/flow-lane/persisted-flow-run.ts`** is the only file
changed (37 insertions, 21 deletions, 270 lines).

- **The import.** Added
  `import type { AutomationNodeTargetResolution } from "fluxiq/automation-studio/nodes";`.
  - It is type-only, so it is erased and adds no runtime dependency.
  - This is the subpath the domain already uses (for example
    `domain/src/output-nodes/definitions.ts`).
  - Core's built `dist/programs/automation-studio/nodes/contracts.d.ts` is dated
    2026-09-13 02:11 and declares the two-variant union. The stale-`dist` problem
    in `reports/g-target-resolution-union.md` is gone.
- **`PersistedTargetResolution`** is now `PersistedFieldsOf<AutomationNodeTargetResolution>`.
  - `PersistedFieldsOf` is a distributive `Pick`, applied to each variant
    separately. It keeps only the fields in `PersistedTargetResolutionField`:
    `status`, `candidateCount`, `minimumConfidence`, `confidence` and
    `normalizedScore`.
  - It is an allow-list, not `Omit`. A field Core adds later, which could carry
    page content, stays out of the bundle's type until someone names it. That
    matches the reader's existing "rebuilt field by field" rule.
  - `candidateId`, `matchedSignals` and `failedSignals` are still excluded.
- **The status check.** The scored-status tuple became
  `SCORED_TARGET_RESOLUTION_STATUSES: { readonly [Status in ScoredTargetResolutionStatus]: true }`.
  - `ScoredTargetResolutionStatus` is
    `Exclude<AutomationNodeTargetResolution["status"], "unresolved_no_candidates">`.
  - An object literal typed this way must name every status Core's union has,
    apart from the no-candidates status, and no status it lacks. That gives the
    "type check fails on a new status" guard without an unused assertion type.
  - A new guard, `isScoredStatus(value)`, is
    `typeof value === "string" && Object.hasOwn(SCORED_TARGET_RESOLUTION_STATUSES, value)`.
    It replaces `SCORED_TARGET_RESOLUTION_STATUSES.find(...)`. The results are the
    same: known statuses are accepted, and any other string or non-string is
    rejected. A key inherited from the prototype, such as `toString`, is not an
    own key, so it is rejected.
- **The reader, `targetResolutionOf`.** `status` is now destructured with the
  other fields and checked with `isScoredStatus`. The no-candidates branch is
  unchanged. Both return statements are type-checked against the derived type.
- **Doc comment.** It now says the type is Core's own type, imported from the
  public subpath and narrowed variant by variant. The rest of the explanation is
  unchanged.
- **`packages/test-runner/src/flow-lane/tests/persisted-flow-run.test.ts` was not
  changed.** The existing rows cover the behaviour. A type-level check cannot be
  written as a runtime row, so it was proved by mutation instead (below).
- No barrel, caller or other file needed changing.
  - `flow-lane/index.ts` already re-exports `persisted-flow-run.js`.
  - `run-flow-lane.ts:168` and `tests/run-flow-lane.test.ts:247` compile against
    the derived type.
  - The emitted declaration, `dist-gtui/flow-lane/persisted-flow-run.d.ts`, line
    2, imports from `fluxiq/automation-studio/nodes`, which test-runner's
    `package.json` already depends on (`fluxiq: link:../../../!FluxIQ/packages/fluxiq`).

## Commands run and observed results

All commands ran from `packages/test-runner` with
`EXTENSION_TEST_BUILD_LABEL=g-target-union-import` and
`DOMAIN_TEST_BUILD_LABEL=g-target-union-import`, except the audit, which ran from
the repository root. Node v22.11.0, TypeScript 5.9.3. Each exit status was
captured by redirecting to a file, not through a pipe. Outputs are saved in the
scratchpad as `gtui-*.txt`.

1. **`pnpm check`** exited 0. `domain:dist` found `domain/dist`, then
   `tsc -p tsconfig.json --noEmit` printed nothing.
2. **`pnpm exec tsc -p tsconfig.json --outDir dist-gtui`** exited 0 with no
   output.
3. **`node --test dist-gtui/flow-lane/tests/persisted-flow-run.test.js`** exited
   0: "# tests 10 / # pass 10 / # fail 0". Rows 7 (no-candidates and scored
   records) and 8 (records Core does not write) were "ok".
4. **`node --test "dist-gtui/**/*.test.js"`** (the full test-runner suite)
   exited 0: "# tests 509 / # suites 0 / # pass 509 / # fail 0 / # cancelled 0".
5. **Mutation and probe run**, by the scratch script `gtui-mutate.mjs`. For each
   case the script edits the source, runs `node node_modules/typescript/lib/tsc.js -p tsconfig.json`
   (`--noEmit` for type cases; `--outDir dist-gtui-m` plus the test file for
   B1), restores the source from a snapshot, and compares bytes. The script
   exited 0.

| Case | What it simulates | Observed |
| --- | --- | --- |
| P1 | Probe: is `PersistedTargetResolution` identical to the old local union? Uses the strict `<T>() => T extends A` identity check. | `tsc --noEmit exit 0`: identical |
| P2 | Negative control: the old union plus `candidateId?: string` | exit 2, `(273,7): error TS2322: Type 'true' is not assignable to type 'false'.` The probe can fail, so P1 means something |
| T1 | Core's scored variant gains status `ambiguous` | exit 2, `(90,7): error TS2741: Property 'ambiguous' is missing in type '{ matched: true; no_match: true; below_confidence: true; }' but required in type '{ readonly ambiguous: true; ... }'` |
| T2 | Core gains a new variant without a confidence floor, `{ status: "unresolved_hidden"; candidateCount: 0 }` | exit 2, `(90,7): error TS2741: Property 'unresolved_hidden' is missing ...`, and `(230,5): error TS2322: Type 'ScoredTargetResolutionStatus' is not assignable to type '"matched" \| "no_match" \| "below_confidence"'` |
| T3 | The lane stops handling `no_match` | exit 2, `(90,7): error TS2741: Property 'no_match' is missing in type '{ matched: true; below_confidence: true; }' ...` |
| B1 | `isScoredStatus` accepts any string | tsc exit 0; `node --test` exit 1, "# pass 9 / # fail 1", "not ok 8 - an attempt with no target resolution, or one Core does not write, carries none": `{"status":"guessed",...}`, `+ { candidateCount: 1, minimumConfidence: 0.5, status: 'guessed' }` against `- undefined` |

   Every case printed "restored byte-identical: true", and the script ended with
   "final source identical: true" and "final test identical: true". SHA-256
   hashes of both files, taken before and after the script, matched ("sha before
   == after"). `dist-gtui-m` was removed by the script and confirmed absent.
6. **`node scripts/structure-audit.mjs`** (root) exited 0: "structure-audit:
   passed (39 warning(s), 17 baselined)." No line names either of my files. The
   file is 270 lines, under the 400-line advisory threshold, and has no baseline
   entry.
7. **`rm -rf packages/test-runner/dist-gtui`**. `ls` afterwards: "No such file or
   directory". `git status --short -- packages/test-runner` shows only
   ` M packages/test-runner/src/flow-lane/persisted-flow-run.ts`.

## Not verified

- **Lab.** This change is type-only and the reader's behaviour is unchanged, so
  a Lab run should show nothing new. A Flow-lane `flow-lane.json` against Core
  `187f40d` should still carry `targetResolution` on each web action as exactly
  `{"status":"unresolved_no_candidates","candidateCount":0}`.
- **Not run:** root `pnpm check`, root `pnpm test`, the package's own `pnpm test`
  (it builds into the shared `dist`), `pnpm build`, and any Lab command. The
  brief forbids the last two.
- **A real change to Core's union** was simulated by widening the imported type
  locally (T1, T2). Core itself was not edited.
- **Single observations.** Each command, including the 509-test suite and each
  mutation, was observed once, on the machine with faulty RAM. Nothing failed
  unexpectedly, so nothing was rerun.

## Open questions or contradictions found

1. **Allow-list rather than `Omit`.** I chose to keep the persisted type a closed
   allow-list of fields, so an optional field Core adds later does not appear in
   the bundle type unexamined. The consequence: if Core renames `confidence` or
   `normalizedScore`, the type check does not fail; that field simply stops being
   carried. The row asserting `matched` keeps `confidence` would then fail at
   test time. This is the supervisor's call.
2. **The no-candidates variant is only partly guarded.** If Core adds a new
   required field to that variant, the `{ status: "unresolved_no_candidates", candidateCount: 0 }`
   return fails to compile. If Core adds a new optional field, it is left behind,
   the same as on the scored variant.
3. **The earlier report's open question 1** (Core's `dist` was stale, so a
   compile-time tie was deferred) is now settled by this change.
4. **Structure baseline.** No entry should change for this brief.
