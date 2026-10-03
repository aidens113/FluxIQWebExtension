# t254 stage 3, w1: a Flow unchanged since a judge said no is not re-judged at the reserve

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t254/!FluxIQ` (Core), branch `task/t254-purse-holds-true-cost`. Nothing was staged or committed.

U = `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build`.

## Outcome

**Done.** Sometimes the judging reserve stops a round while the draft is still the Flow a judge of this build last said no to. That round now spends nothing: there is no test replay and no judge call. The build ends `budget_exhausted` (cost). The ending carries that judge's findings and advice, says why the reserve was not spent, and includes lane D's "kept as a draft" sentence. A changed draft is tested and judged as in stage 2. `R/service.ts` and `build-judge.ts` did not need to change.

## What changed and why

### Which signature means "unchanged"

The signature used is the **Flow signature** (`automationStudioFlowDraftFlowSignature`) of the test the earlier judge judged:

- It is the `no` verdict's own `flowSignature`, which the service's judge stamps from the observed test.
- When the verdict carries none, it is `automationStudioFlowDraftFlowSignature(ending.loop.steps)` of the finished round. `automationStudioFlowBootstrapJudgeFinished` already holds that "a `no` is always about the loop's own test". The murzln6g test's round-0 verdict carries no signature, so it goes through this fallback.

It is compared with `automationStudioFlowDraftFlowSignature(toTest)`, where `toTest` is the repair seed of the stopped round's steps. This is the same comparison `unchanged-complete.ts` already makes between a draft and its seed.

I did not use the replay signature (`judgement.flowSignature` / `seed-signature.ts`). It leaves routing out, and `flow-signature.ts` says it is not what a judged test is about.

Only `no` verdicts are recorded. After an `unknown` or `not_judged` verdict, or a `no` whose `flowSignature` names another version, the Flow is tested and judged as in stage 2.

### `U/phases.ts`

- The module comment has a new paragraph on the stage 3 rule.
- New per-build state: `judgedNo: { flowSignature, judge }`. It is set whenever a finished round's judge says `no`, after `automationStudioFlowBootstrapJudgeFinished`.
- The stage 2 `atReserve` was split into two parts:
  - `stoppedAtReserve` holds the stage 2 condition.
  - `unchangedAtStop` is true when `stoppedAtReserve`, `judgedNo` is set, `toTest` is non-empty, and the signatures are equal.
  - `atReserve` is now `stoppedAtReserve && !unchangedAtStop`. All the stage 2 testing, announcing and judging hangs off `atReserve`, so an unchanged Flow has no test and no judge call.
- When `unchangedAtStop` is true:
  - A new announcement goes out: "The build reached its spending limit before the Flow was finished. The Flow is unchanged since the judge said it does not do what was asked, so what was kept back for judging is not spent judging it again."
  - Phase 2's judgement becomes the untested judgement plus `judge: judgedNo.judge`.
  - The existing `if (ending.kind === "budget") return await end(ending.bound)` then ends the build. That return comes before the not-doable check, so the ending is never "not doable".
- `costSpending` takes `unchangedAtStop`. In the purse branch it adds `unchangedSinceJudgedNo: true`. The figures stay the refusal's: spent, pending, `keptBackUsd` and projected cost. `judgedUsd` is not used here.

### `U/budget-exhausted.ts`

- New optional field: `AutomationStudioFlowBootstrapCostSpending.unchangedSinceJudgedNo`.
- When it is set, the spending clause reads: `: its next call could have cost up to $P, more than was left beside the $K kept back for judging the Flow, and that was not spent, because the Flow was unchanged since the judge said it does not do what was asked, and it had spent $S (… earlier builds) in all`.
- The existing findings sentence ("The judge found: … What the judge says is left to change: "…".") is now also said when `unchangedSinceJudgedNo` is set.
- Stage 2's "went on testing and judging" wording is untouched and is not used on this path.

### Tests

`U/tests/murzln6g-repair-funding.test.ts`: the peak case is now an `it.each(["yes", "no"])`, covering whatever the repair judge would have said. The asserts:

- `tests == []`.
- `judgeHolds` holds only round 0's two holds.
- The ending is `budget_exhausted`/cost with this exact text: "…could have cost up to $0.007, more than was left beside the $0.007 kept back for judging the Flow, and that was not spent, because the Flow was unchanged since the judge said it does not do what was asked, and it had spent $0.089 ($0.081 of it by earlier builds of this Flow) in all."
- The message contains round 0's finding: "The judge found: the 100 Count was added."
- The message contains "kept as a draft … with $0.011 left of this Flow's $0.10".
- Neither "went on testing and judging" nor the repair judge's words appear.
- Accounting is $0.00777 and the purse has spent $0.0889 with no breach.
- The separate stage 2 peak "judged no" case was removed. It can no longer happen in this scenario, and its wording is covered in `reserve-judging.test.ts`.
- The off-peak case is unchanged.

`U/tests/reserve-unchanged.test.ts` (new, six cases). In each, round 0 finishes and is judged; the repair is then refused at the reserve.

- **Unchanged, verdict with `flowSignature`.** Zero test replays and zero round-1 judge calls. The cost message has the exact text, the test sentence, round 0's findings and advice, and "kept as a draft". It does not contain "went on testing and judging". Accounting is $0.014.
- **Unchanged, verdict without `flowSignature`** (the fallback). Same asserts as the case above.
- **Never "not doable".** Round 0's Flow carries an `f1` step never run in this build, so its judgement is unmeasured. Its judge says `no` with `stillAchievable: "no"`, and a repair still follows. The reserve stops that repair on the same Flow. The ending is `budget_exhausted`, with no test and no re-judge.
- **Changed draft.** The Flow is tested (`judged: true`) and judged with the reserve, and the build finishes (stage 2 behaviour).
- **`no` about another version.** The verdict's `flowSignature` is "another Flow", so the draft is tested and judged.
- **Earlier `unknown`.** The draft is tested and judged.

The stage 2 cases in `reserve-judging.test.ts` (five) all still pass unchanged.

### `docs/architecture/automation-studio/llm-flow-bootstrap.md`

- The "Judging is kept back" bullet now names the stage 3 exception.
- A new bullet, "A Flow a judge said no to is not judged again unchanged", gives the signature used, that only a `no` counts, the ending's wording and the never-not-doable rule. The murzln6g example moved into this bullet.

## Commands run and observed results

All from `packages/fluxiq` unless noted.

- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build`: `Test Files 20 passed (20)`, `Tests 143 passed (143)`. This ran before the type fix to the test, which changed only an annotation.
- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/runtime/tests/service-bootstrap src/programs/automation-studio/runtime/service/flow-bootstrap-commands`: `Test Files 104 passed (104)`, `Tests 1296 passed (1296)`. This was the final run.
- `npx tsc --noEmit -p .`:
  - The first run failed with TS2322 in `reserve-unchanged.test.ts`: the `as const` verdict made `findings` readonly.
  - I typed the constant as `Extract<AutomationStudioFlowBootstrapTestVerdict, { verdict: "no" }>`.
  - The re-run printed nothing (`tsc exit=0`).
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (234 warning(s), 349 baselined).` That is the same warning count as stage 2. `phases.ts` is now 683 lines, under the 800 hard limit.
- `node scripts/structure-audit.mjs --rule docs-links`: `structure-audit: passed (0 warning(s), 0 baselined).`

## Not verified

- No live Lab or browser run; this is unit-level only. The service-level tests under `tests/service-bootstrap` pass, but none of them exercises a reserve stop on an unchanged Flow end to end.
- I did not run the full fluxiq suite or `pnpm check`, per the twice-a-day rule. I did not check whether the generated `framework-reference.md` files need regenerating for the new optional type field. Those files were already modified in the tree by stage 2.
- The other modified files in the tree (`deepseek/`, `recovery/annotation/`, `harness/provider.ts`, `service.ts`, `build-judge.ts`, `judged-build.test.ts`, the reference docs) belong to other workers or to stage 2, and I did not touch them.

## Open questions or contradictions found

1. **Earlier builds are not covered.** The rule covers a `no` from a judge of *this* build. Suppose an extend build, or one continuing a kept draft, starts from a Flow an earlier build's judge said no to, and its first round is stopped at the reserve without changing it. That Flow is still tested and judged, because Core does not carry the earlier build's verdict into `phases.ts`. Covering it would need a caller input, such as an `input.judgedNo` beside `seedSignature`, which `R/service.ts` would have to supply. I left it out as outside the brief.
2. **The unchanged path keeps phase 2's judgement untested.** The test sentence in that ending comes from the judge's account: "The Flow (N steps) ran from its start, but what it did was judged not to be what you asked." That sentence describes the earlier test of the same Flow, so it is truthful, but the judgement's own `tested` field reads `not_tested`. Nothing downstream reads it on this path, because the build ends.
3. **The new announcement wording is mine.** The brief did not set the text of the chat row ("Flow unchanged since judged"), so it may need review.
