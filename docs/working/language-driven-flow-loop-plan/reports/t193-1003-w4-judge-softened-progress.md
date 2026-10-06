# t193-1003-w4-judge-softened-progress

## Outcome

Partial. The measure, the carried field and the ending's wording are done and tested in
`R/flow-bootstrap/unfinished-build/`. It will not fire in a live build until one change
lands in a file this brief forbids me to touch.

**Verdict assembly file (named first, as the brief asks):**
`R/result-verification/build-test/judge.ts`, line 179 (the `unknown` return), plus its
verdict type at lines 75-82. That file is where the agreement's `outcome.basis`
(`model_disagreed` / `model_unconfirmed`) is dropped. It is under `R/result-verification/build-test/**`,
which is in my Must-not-touch list and another worker owns it. It is currently being edited
(`build-test/summary.ts` and `observation.ts` are dirty in the tree). `R/service/flow-bootstrap-commands/build-judge.ts`
only sees the already-built verdict, so it cannot recover the pair. I did not edit either file.

Change the owner of build-test/** needs to make (2 lines):
- type (judge.ts l.75 union member): add `oneCallSaidYes?: true;`
- l.179: `return { verdict: "unknown", why: outcome.reason, ...carried, ...(reading ? { unconfirmedReading: { ...reading } } : {}), ...(outcome.basis === "model_disagreed" ? { oneCallSaidYes: true as const } : {}), spent };`

The field is optional, so the build-test verdict without it still type-checks against the phases' `judge` type.

## What changed and why

R = `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`

- **Trace.** The two judge calls are combined into one verdict in `R/result-verification/agreement.ts`.
  no+no gives a refuted `does_not_answer`. no+yes, unknown+yes and (with confirmAnswer) yes+no
  give `unsure` with `basis: "model_disagreed"`. no+unknown/silent gives `model_unconfirmed`.
  `build-test/judge.ts` maps both unsure results to `{ verdict: "unknown", why, unconfirmedReading? }`
  and drops `basis`. `unconfirmedReading` is present for both no+yes and no+unknown, so it cannot
  tell the two apart. `unfinished-build/judgement.ts` `judgedWrong` copies only the verdict's fields.
  So the judgement does not record which pair it came from.
- `R/flow-bootstrap/unfinished-build/contracts.ts`:
  - Added the closed optional field `oneCallSaidYes?: true` to `AutomationStudioFlowBootstrapTestVerdict`'s
    unknown/not_judged member, with its doc.
  - Added the same field to `AutomationStudioFlowBootstrapJudgedWrong`, documented as unknown-only.
    It records which pair it was, never what either call said.
  - Added `"judge_no_longer_refutes"` to `AutomationStudioFlowBootstrapProgressMeasure` and to that type's doc list.
- `judgement.ts` `judgedWrong`: carries `oneCallSaidYes: true` only for an `unknown` whose verdict set it.
- `progress.ts`:
  - New measure: `before.judge.verdict === "no"` and `after.judge.verdict === "unknown"` with `oneCallSaidYes`
    gives `judge_no_longer_refutes`. A no then unconfirmed pair does not.
  - New header paragraph explains why this is measured rather than claimed (it is the pair the two calls
    returned, kept as one flag), and why no→unconfirmed does not count.
  - The header also says the purse and the live-round backstop bound an alternation. In a no / split / no / split
    sequence, each round reads as progress: the split by this measure, the following `no` by `judged_after_unjudged`.
- `not-finished.ts` `judgeSaid`:
  - Before `no`, after unknown with a yes: "the judge no longer agreed it was wrong: one check said it does
    what you asked, the other did not".
  - Before `no`, after unknown/not_judged with no yes: "the judge could not judge it this time, where it had
    found the round before wrong". This is the same false "still" from the live run, for the
    `model_unconfirmed` pair. I fixed it under "words each pair truthfully".
  - Before unsure, after unsure: "the judge still could not judge it" (unchanged).
  - Every after-`no` branch is unchanged. A header paragraph cites `run-musp4h2f-72e8ed99`.
- Tests:
  - New `tests/progress.test.ts`, 3 cases: no→disagreed returns `["judge_no_longer_refutes"]`;
    no→unconfirmed returns `[]`; unknown→disagreed does not get the measure.
  - `tests/judgement-value.test.ts`, 1 case: the flag is carried, and is absent when the verdict lacks it.
  - `tests/not-finished.test.ts`, 3 cases, one for each wording pair above.

## Commands run and observed results

- Failing first, before the implementation:
  `npx vitest run .../unfinished-build/tests/{progress,not-finished,judgement-value}.test.ts`
  printed `Tests 4 failed | 12 passed (16)`. The 4 failures were the new expectations, for example
  `expected [] to deeply equal [ 'judge_no_longer_refutes' ]`.
- `cd packages/fluxiq && npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build`
  printed `Test Files 21 passed (21)`, `Tests 150 passed (150)`. That run was after the final edit.
- `npx vitest run src/programs/automation-studio/runtime/service/flow-bootstrap-commands` printed
  `Test Files 6 passed (6)`, `Tests 51 passed (51)`. This checks the build-judge consumer; I did not change it.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t193 w4 tsc" npx tsc --noEmit -p tsconfig.json` (in packages/fluxiq)
  printed `exit=0`. Its only output was `[heavy] t193 w4 tsc holds b1`, with no diagnostics. The tsconfig
  includes `src/**/*.ts`, so tests are covered. The tree included other workers' uncommitted edits at the time.
  I ran this tsc before a comment-only header edit to not-finished.ts; vitest was re-run after that edit.

## Not verified

- Live behaviour. Until `build-test/judge.ts` sets `oneCallSaidYes`, no live verdict carries it, so the
  new measure and the new disagreement wording never trigger. The no→unconfirmed wording fix does work live,
  because it needs no flag.
- No phases-level test runs a scripted judge through no→disagreed to show the build continues instead
  of stopping. The measure is exercised directly in progress.test.ts.
- Structure audit and full suites were not run.

## Open questions or contradictions found

- The brief says I own the verdict assembly "only if the pair must be recorded", but that assembly is in
  `R/result-verification/build-test/judge.ts`, which the brief also lists as Must not touch. The pair
  must be recorded. The supervisor needs to route the 2-line change above to the build-test/** owner,
  or re-brief me after that worker finishes.
- Docs that word the measures and are outside my ownership:
  - `!FluxIQ/docs/architecture/automation-studio/llm-flow-bootstrap.md` around l.905 lists progress
    measures and should gain `judge_no_longer_refutes`.
  - `docs/reference/framework-reference.md` (both copies, l.943) embeds the contracts doc comment; it
    looks generated, so regenerate it rather than editing by hand.
- Should the repair also be told `oneCallSaidYes` through `automationStudioFlowBootstrapJudgementValue`?
  I left it out: the brief did not ask for it, and `llm/evidence-loop/resume.ts` would need to word it.
