# w2-import-cycle

## Outcome

Done, with one reported change I was not allowed to make.

The `runtime/llm` -> `runtime/recovery` value edge is gone and is now a build
failure. A shared value that both directories need has a neutral home that
neither owns. One follow-up edit belongs in `runtime/recovery/**`, which this
brief forbids me to touch, so it is written out below rather than applied.

## What changed and why

### The cycle

The edge the brief describes was already removed from the source by commit
`59c6bac` ("Feed the recovery context to the model, and open a diagnosis
channel"): the hunk in `intervention.ts` that called
`summarizeAutomationStudioRuntimeRecoveryContext(...)` was dropped and replaced
by a comment explaining the hazard. So at the moment I started there was no
value import from `runtime/llm/` into `runtime/recovery/` -- only four
`import type` crossings, which are erased and cannot close a run-time cycle:

- `llm/harness/context-packet.ts:13`
- `llm/harness/task-request.ts:9`
- `llm/harness-options/binding.ts:18`
- `llm/tests/recovery-context-packet.test.ts:13`

What survived was the *documentation* of the hazard in two places, which is
exactly the outcome the brief rejects. Both comments have been replaced by a
rule.

### The neutral module

`packages/fluxiq/src/programs/automation-studio/runtime/loop-limits/`
(`index.ts` barrel + `evidence-loop.ts`) now owns
`AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS`, the three loop ceilings both
directories are bounded by. It sits directly under `runtime/`, a sibling of
`llm/` and `recovery/`, so it is owned by neither: ownership / layer / feature
/ kind per `docs/architecture/code-structure.md`, eight path segments, one
exported thing, its own barrel.

`llm/evidence-loop.ts` now imports the constant from there and re-exports it
under the same name, so the public surface is unchanged: every existing
consumer, including the downstream web-extension repository, still reads it
from `runtime/llm/`'s barrel.

This is the value both sides actually share. `recovery/exploration-budget.ts`
hand-copies those three numbers, with a comment saying it copies them
*because* reading them back closes the cycle. That copy is what part 1 of the
brief is about, and it can now be deleted -- but the deletion is an edit to
`recovery/**`. See "Change I did not make".

### The mechanical rule

`scripts/structure-audit/config.mjs` now configures one `importBoundaries`
entry:

```js
{
  from: "packages/fluxiq/src/programs/automation-studio/runtime/llm",
  to:   "packages/fluxiq/src/programs/automation-studio/runtime/recovery",
  valueOnly: true,
  reason: "runtime/llm must not import a value out of runtime/recovery: ..."
}
```

**Direction forbidden: `runtime/llm/` -> `runtime/recovery/`, values only.**

That direction and not the other, because the other direction is the one that
must keep working. `recovery/runtime-exploration.ts` imports
`runAutomationStudioLlmEvidenceLoop` -- a value -- out of `llm/index.ts`,
because recovery drives the loop. That edge is legitimate and forces
`runtime/llm` to evaluate first. It is precisely what makes the return edge a
cycle rather than a plain dependency: with `llm` half-initialized, a constant
read at module-evaluation time arrives `undefined` with a completely clean type
check. Banning the harness-to-recovery direction removes the cycle without
removing the loop's only caller.

**Type-only imports are still allowed**, and deliberately: `import type` and
`export type` are erased before any module evaluates, so they cannot cause the
fault the rule exists to prevent, and the harness has to keep reading
recovery's contracts (the four crossings listed above are untouched).

The exemption is narrow. Only a declaration written `import type ... from` or
`export type ... from` counts as erased. `import { type A, B }` binds a value,
and under this repository's `verbatimModuleSyntax: true` even
`import { type A }` emits `import {} from "..."`, which is a real edge in the
emitted graph and can close the cycle on its own. Both still fail, and there is
a unit test for each.

### Audit script

`scripts/structure-audit/rules/imports.mjs` already had `importBoundaries`
support, but it banned every crossing including type-only ones, which would
have failed the build on the four legitimate crossings above. I added the
optional `valueOnly` flag to a boundary: default behaviour is unchanged (bans
everything), `valueOnly: true` skips `import type` / `export type`. The
specifier collector now records whether each declaration is type-only.

Note for the supervisor: `scripts/structure-audit.mjs` and everything under
`scripts/structure-audit/` are mirrored into the web-extension repository. The
change originates here, in Core, which is correct, but the downstream
`scripts/structure-audit/rules/imports.mjs` and
`scripts/structure-audit/rules/tests/imports.test.mjs` now differ from Core's
and need the same content copied across. I did not touch that repository. The
downstream `config.mjs` is repository-specific and must *not* receive Core's
boundary entry.

## Files changed

- `packages/fluxiq/src/programs/automation-studio/runtime/loop-limits/evidence-loop.ts` (new)
- `packages/fluxiq/src/programs/automation-studio/runtime/loop-limits/index.ts` (new)
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/intervention.ts` (comment only)
- `scripts/structure-audit/config.mjs`
- `scripts/structure-audit/rules/imports.mjs`
- `scripts/structure-audit/rules/tests/imports.test.mjs`

The two new files were staged with `git add -N` (intent-to-add, no commit). The
audit reads `git ls-files`, so an untracked file is invisible to it and would
have been audited for the first time only after the supervisor committed it.

## Change I did not make (owned by another worker)

`packages/fluxiq/src/programs/automation-studio/runtime/recovery/exploration-budget.ts`,
the `AUTOMATION_STUDIO_EXPLORATION_BUDGET_CEILINGS` block at lines ~96-112.
Its doc comment says the numbers are written out rather than read from
`AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS` "because `llm/harness/intervention.ts`
imports a *value* from this directory, so reading one back at module-evaluation
time closes a cycle". That reason no longer holds. Exact change:

```ts
// add, with the other imports:
import { AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS } from "../loop-limits/index.ts";

export const AUTOMATION_STUDIO_EXPLORATION_BUDGET_CEILINGS = Object.freeze({
  maxDurationMs: 120_000,
  maxActions: AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS.maxToolCalls,
  maxProviderCalls: AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS.maxIterations,
  maxEvidenceBytes: AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS.maxEvidenceBytes,
  maxRefusedActions: 8,
  maxRepeatsPerAction: 4
});
```

and replace the paragraph of the doc comment that explains the copy with one
sentence saying the three bounded numbers are Core's loop ceilings, read from
`runtime/loop-limits/`. `recovery/tests/exploration-budget.test.ts` lines 32-34
already pin the three equal to the loop's limits and keep passing; they become
a guard against someone re-hardcoding them. This import crosses no boundary the
new rule cares about (`loop-limits/` is neither `llm/` nor `recovery/`), and it
reaches a barrel, so the barrel-skip check is satisfied too.

## Commands run and observed results

- `node scripts/structure-audit.mjs` -> **1 violation, not mine**:
  `FAIL [imports] .../runtime/llm/harness-options/binding.ts: 1 import(s) reach
  into another directory's files instead of its barrel, e.g.
  "../../recovery/runtime-exploration.ts" at line 18.` That import is an
  uncommitted working-tree change by another worker (`git diff HEAD` shows it
  added, and `.structure-baseline.json` has no entry for the file). It is the
  pre-existing barrel-skip check, not the boundary I added, and
  `harness-options/**` is on my must-not-touch list. Everything else passes;
  the remaining output is `file-lines` advisory warnings.
- Boundary rule in isolation, over the real repository, findings whose message
  contains "resolves under": **0**. The four type-only crossings are exempt as
  designed.
- **Proof the rule fires.** Reintroduced the exact defect in `intervention.ts`
  (`import { summarizeAutomationStudioRuntimeRecoveryContext } from "../../recovery/index.ts";`)
  and ran `node scripts/structure-audit.mjs --rule imports`:
  `FAIL [imports] .../llm/harness/intervention.ts:3: imports "../../recovery/index.ts",
  which resolves under .../runtime/recovery/. runtime/llm must not import a value
  out of runtime/recovery: ...`
  Then swapped that line for an `import type { ... }` plus an
  `import { type ... }` on the next line: the `import type` produced no finding,
  the inline-type form still failed at its line. Reverted `intervention.ts` from
  a backup; `--rule imports` returned to the single pre-existing `binding.ts`
  failure.
- `pnpm structure:test` -> `# tests 96 / # pass 96 / # fail 0` (10 pre-existing
  imports-rule tests + 8 new boundary tests, plus the baseline tests).
- `pnpm check` -> **exit 1**. `structure:test` passed (96/96), then
  `structure-audit` failed on the one `binding.ts` finding above, so
  `pnpm -r check` never ran.
- `npx tsc --noEmit` in `packages/fluxiq` -> **exit 2, exactly one error, not
  mine**:
  `src/programs/automation-studio/runtime/recovery/tests/runtime-exploration.test.ts(235,5):
  error TS2741: Property 'deniedEvidenceKeys' is missing ... but required in type
  'AutomationStudioLlmEvidenceRuntimeBinding'.` That is fallout from another
  worker's in-flight change making `deniedEvidenceKeys` required in
  `harness-options/binding.ts`; the fixture at line 235 has not caught up. Both
  files are on my must-not-touch list. Grepping the full tsc output for
  `loop-limits`, `evidence-loop.ts` and `intervention.ts`: **0 matches**, so the
  constant's move type-checks.

## Not verified

- **`pnpm check` and `pnpm -r check` have never been observed green**, because
  two other workers' in-flight edits fail before my changes are reached. What I
  can say is that no failure names a file I own, and that the single tsc error
  and the single audit failure both trace to `harness-options/binding.ts`, which
  I am forbidden to touch.
- **No test suite was run.** `pnpm test` was not run at all, so I have not
  observed the evidence-loop tests, the recovery tests, or the failing test that
  originally caught the cycle. The constant's move is a pure re-export with an
  unchanged name and value, so a run-time behaviour change would be surprising,
  but "surprising" is not "verified".
- **No browser or live-provider validation**, and none is relevant: nothing here
  changes runtime behaviour.
- **The downstream mirror is out of date and I did not test it.** I confirmed by
  `diff` that `FluxIQWebExtension`'s `scripts/structure-audit/rules/imports.mjs`
  now differs from Core's; I did not copy it across and did not run that
  repository's audit.
- I did not verify that the reported `exploration-budget.ts` change compiles,
  since I did not make it.

## Open questions or contradictions found

1. **The brief's premise was one commit stale.** It states that
   `llm/harness/intervention.ts` value-imports out of `runtime/recovery/`. It
   did, and the hunk was dropped in `59c6bac` before I started; what remained was
   a comment. This does not change the work -- the point of the brief was to make
   the edge impossible rather than documented -- but the supervisor should know
   that part 1 found nothing to delete in `llm/`, and that the only *live*
   duplication caused by the cycle is in `recovery/exploration-budget.ts`, which
   I could not touch.
2. **The brief scoped my audit ownership to `scripts/structure-audit.mjs`**, but
   the rules live in `scripts/structure-audit/rules/*.mjs`; `structure-audit.mjs`
   is only the 99-line entry point that loads them. `importBoundaries` support
   existed but was all-or-nothing, so I edited `rules/imports.mjs` and its test
   file instead of the entry point. I believe that is what the brief intended.
3. **Two other workers' changes currently fail Core's gates** (the `binding.ts`
   barrel skip and the `runtime-exploration.test.ts` fixture missing
   `deniedEvidenceKeys`). Neither is mine to fix, and both need to land before
   anyone can see a green `pnpm check`.
