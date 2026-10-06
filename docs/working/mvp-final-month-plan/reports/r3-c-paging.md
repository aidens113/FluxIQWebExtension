# r3-c-paging — worker report (2026-10-06)

Brief: `### Brief: r3-c-paging (worker)` in `docs/working/mvp-final-month-plan.md`. Trees: `fxwork/t274/` (both repos,
`task/t274-live-lane-c`). Nothing committed.

## Outcome

Done. R2-2 is fixed in the domain. R2-4 is fixed with the smallest honest change that stays in the files I own: the
repair round's opening value now names where each step to fix starts and says to look and detect there. The round is
not navigated there.

## What changed and why

### R2-2: the paging refusal says why (downstream)

- `domain/src/runtime/llm-evidence/plan-resolution/extraction/slot.ts`
  - `keptPagination` now returns `no_pager_detected` instead of `malformed` when the plan writes a `paginate` object
    and the handle's detection carried no pagination.
  - `resolveWebExtractionSlot` refuses that case as `web.handle.malformed` at `paginate`, and adds a new shape hint:
    `web.handle.expected.extract_list.paginate.no_pager_detected.detect_on_step_start_page` (85 characters; Core's
    `ISSUE_CODE` pattern allows up to 100).
  - The hint says what was wrong (the list was detected with no pager) and the way out (detect on the page the step
    starts on).
  - The reason stays `malformed_handle`, because `tool-rejection.ts` treats `web.handle.expected.*` codes as hints,
    never as reasons. I did not need to touch `tool-rejection.ts`, which I do not own.
  - The slot's refusal `expected` type is widened to `WebExtractionSlotHint`.
- `domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts`: the new code is added to
  `WEB_PLAN_HANDLE_ISSUE_CODES`, after the `maxScrolls` hint.
- What the model now receives for run muwansvz's 0031 shape: `["web.handle.malformed",
  "web.handle.expected.extract_list.handle_fields_paginate",
  "web.handle.expected.extract_list.paginate.no_pager_detected.detect_on_step_start_page",
  "web.handle.malformed:extractList.paginate"]`.
- Unchanged: a bound past the cap on a list that does page, and a `paginate` that is not an object, still get the
  plain malformed refusal.

### R2-4: the repair round's opening names where the step to fix starts (Core)

- `R/flow-bootstrap/unfinished-build/contracts.ts`: the judgement gains an optional `fixSteps?: number[]`.
- `R/flow-bootstrap/unfinished-build/judgement.ts`:
  - `automationStudioFlowBootstrapJudgeUnfinished` sets `fixSteps` to the failed steps when the test ran and failed
    (`replay_failed`).
  - `automationStudioFlowBootstrapJudgeFinished` sets `fixSteps` to the Flow's read steps (`effect === "observe"`)
    when the judge said `no`. A `no` is always about the loop's own test.
  - `automationStudioFlowBootstrapJudgementValue` renders `fixSteps` as `judgement.whereToFix`. The repair's first
    decision reads this value through `resume.ts`, which passes `judgement` through verbatim. One sentence per step,
    for example: "Step 5 starts on the page step 4 leaves, which need not be the page the test left: a look or a detect
    made anywhere else describes that page, not the one step 5 runs on. Before you change step 5, get to where it
    starts the shortest way (mark any step you take only to get there exploratory), then look and detect there."
  - Step 1's sentence says "starts where the Flow starts".
  - The sentences use only step numbers, never page content.
- Why there is no navigation: Core has no per-step address. A step keeps state digests, not URLs. The round-opening
  instruction itself is in `R/llm/evidence-loop/resume.ts`, which is under `R/llm/**`, on my must-not-touch list.
  Moving the page there would also need the domain's `node-run/**`, which is also excluded.
- The heuristic, stated plainly:
  - For a judged `no`, the steps named are the Flow's reads. In run muwansvz that is step 5, the step the judge
    blamed.
  - The judge's account has no structured "blamed step", so a `no` about a missing press in a Flow that also has a
    read would name the read.
  - The sentence is advice about where the step starts, not a claim that the step is wrong, so a wrong pick costs
    words but no wrong action.

## Commands run and observed results

Fail-first runs, before each fix:
- Domain: `node <scratchpad>/tools/run-subset.mjs <t274>/domain r3c-paging .../extraction/tests/slot.test.ts
  .../plan-resolution/tests/resolve-plan-node.test.ts`, then `node --test` on the printed bundles.
  - Result: `not ok 16 - a paging read over a list detected with no pagination is refused saying so, and naming the
    way out`.
  - The only diff was the missing `...no_pager_detected.detect_on_step_start_page` code. The other 25 tests passed.
- Core: `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/judgement-value.test.ts`.
  - Result: 2 failed (`expected undefined to deeply equal [ Array(1) ]` and `[ …(2) ]`), 5 passed.

After the fixes:

| Check | Observed result |
| --- | --- |
| Domain: every test in `plan-resolution/extraction/tests/` and `plan-resolution/tests/`, plus `llm-evidence/tests/tool-rejection-detail.test.ts` (it reads `WEB_PLAN_HANDLE_ISSUE_CODES`), label `r3c-paging` | `# tests 110 # pass 110 # fail 0` |
| Core `judgement-value.test.ts` | `Tests 7 passed (7)` |
| Core: all 25 files in `unfinished-build/tests`, plus every file outside it that reads the judgement (see note below) | `Test Files 58 passed (58)`, `Tests 446 passed (446)` |
| Core `node scripts/build-cache/cli.mjs fluxiq:check` | first run: exit 2, from the test file's `exactOptionalPropertyTypes` (TS2379/TS2412); after fixing the test types: exit 0 |
| Core `node scripts/build-cache/cli.mjs structure-audit:check` | `structure-audit: passed (263 warning(s), 349 baselined)`, exit 0 |
| Core `pnpm.cmd build` | exit 0 (web:build stored) |
| `pnpm.cmd --filter @fluxiq-web-extension/domain check` | first run: exit 2, TS2790 on `delete` in my new test; after a cast: exit 0 |
| `pnpm.cmd --filter @fluxiq-web-extension/domain build` | exit 0 |
| Downstream `node scripts/structure-audit.mjs` | `structure-audit: passed (170 warning(s), 118 baselined)`, exit 0 |

The Core files outside `unfinished-build/tests` that read the judgement:
- `activity/wording/tests/run-ending.test.ts`
- `generation-failure/tests/build-ending.test.ts`
- `llm/evidence-loop/tests/resume.test.ts`
- `service/flow-bootstrap-commands/tests/build-judge.test.ts`
- `service/runtime-adaptation/tests/{reauthor-build,refuted-result-port}.test.ts`
- `tests/deepseek-bootstrap/tests/{answerability,exploration}.test.ts`
- `tests/refuted-result/tests/carried-steps-as-saved.test.ts`
- every file in `tests/service-bootstrap/tests/`

## Not verified

- No live, Lab, browser or provider run. Whether the model follows `whereToFix` and the new hint is unmeasured.
- Whole package suites were not run, per the shared rules. Only the tests named above ran.
- The `unfinished-build/tests` folder already holds 25 files, so I extended `judgement-value.test.ts` instead of
  adding a file.

## Open questions or contradictions found

1. **The brief contradicts itself about `resume.ts`.** It gives me "the repair-round opening it uses", but that opening
   (`R/llm/evidence-loop/resume.ts`) is under `R/llm/**`, which is on my must-not-touch list. I did not edit it. The
   change I propose for whoever owns it (r3-a's tree owns `R/llm/evidence-loop/**`):
   - `JUDGED_INSTRUCTION`, `UNJUDGED_INSTRUCTION`, `REPAIR_INSTRUCTION` and `notRunRepairInstruction` say "The page is
     where the test left it: look first".
   - When `judgement.whereToFix` is present, append: "judgement.whereToFix says where each step to fix starts: look
     and detect there, not on the page the test left."
2. **Optional navigation, not done.** The domain's rerun already puts the page back where the step starts (run
   muwansvz 0031: "page put back to page 1"). The cheapest real fix for R2-4 would be in `node-run/**` (excluded):
   when a rerun's handle was minted on a page other than the step's start page, refuse it before running, naming that
   page.
3. **Gap, not changed.** `paginate: true` on a handle with no detected pagination still resolves silently to a
   one-page read (`keptPagination` returns `undefined`). It is the same missing-pager situation without the refusal. I
   left it, because `true` with no pager has always meant "read what there is". Decide whether it should also carry
   the new hint.
4. The debug called the R2-1 detect-pagination fix uncommitted, but the t274 downstream tree showed no modification to
   `detect-pagination.ts` at the start of this task. Presumably it was already committed; I did not check.
