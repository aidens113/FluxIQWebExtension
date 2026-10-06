# t275-d-c1-after-withheld: worker report

## Outcome

Done. Uncommitted in Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t275/!FluxIQ` on branch `task/t275-live-lane-d`.

## What changed and why

Run `run-muw6144a-e56f945d`, Cause C1: the build test only checked the Confirm passes it had not done (`verified`), so the
read after them (step 8) returned Amara alone. Nothing in the judge's packet said so, and the judge refused the right Flow.
`R` = `packages/fluxiq/src/programs/automation-studio/runtime`.

- `R/result-verification/build-test/summary.ts`: as the steps are built in order, keeps `undone`, the positions of
  checked steps (`withheld`) whose outcome or any pass reads `verified` (`present` means already in place, so it does not
  count). A step that does not mutate, has an outcome, and comes after at least one of them gets
  `afterWithheld: [...undone]`. The header list documents the new field and names the run.
- `R/result-verification/contracts.ts`: `AutomationStudioBuildTestStep.afterWithheld?: number[]` with a doc comment.
- `R/llm/diagnosis-instructions.ts`: one sentence after the withheld sentences of the build-test instruction. It says
  a read with afterWithheld ran on a page without what those acts make, so rows missing for that reason come from the
  test and not the Flow. It says to judge the read by whether its conditions would keep what those acts make on the rows
  their passes name (explored says what the act changed). It also says never to answer no, or ask for a withheld step to
  be run, because what those acts make is absent. The header comment names the run and C1. It quotes no page text.
- `R/llm/deepseek/tests/system-prompt-pins.json`: `loop_verification_build_test` re-pinned from the source. I bundled
  `deepseek/system-prompt.ts` with esbuild into the scratchpad and called `automationStudioDeepSeekSystemPrompt` with the
  test's own `loop_verification_build_test` request. Only that one line was replaced (length 9558 -> 10091). I did not
  edit it by hand.
- `R/llm/harness/request-evidence-check.ts`: not changed. `sendableBuildTest` screens observed values, passes, inputs and
  locator shapes, and it does not refuse unknown step keys.
- New test `R/result-verification/build-test/tests/after-withheld.test.ts` uses the round-1 shape: 1 navigate, 2-5
  route clicks, 6 listing, 7 Confirm repeated over 6 with passes present/verified/verified/verified, and 8 read. It
  asserts that step 8 gets `afterWithheld: [7]`. A single checked step that is `verified` also counts. A read after
  checks that are all `present` gets none, and none is set on steps 1-7 (the listing is before the withheld step). The
  only page text used is the row labels.

## Commands run and observed results

All commands ran from the Core root.

- Before the fix: `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/result-verification/build-test/tests/after-withheld.test.ts`
  -> `Tests 2 failed | 2 passed (4)`. The 2 failures were "expected { step: 8, …(3) } to match object { step: 8,
  afterWithheld: [ 7 ] }" and "expected undefined to deeply equal [ 7 ]". The first draft of the test failed 3 because
  its reads lacked `proposes: true`. I fixed the test fixture before recording this run.
- After the fix: the same command -> `Tests 4 passed (4)`.
- After the prose change, before the re-pin: `vitest run .../llm/deepseek/tests/system-prompt.test.ts` -> `2 failed | 29
  passed (31)`. Both failures were in the loop_verification_build_test pin cases, which is expected.
- `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/result-verification src/programs/automation-studio/runtime/llm/deepseek/tests`
  -> `Test Files 40 passed (40)`, `Tests 443 passed (443)`.
- `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/tests/diagnosis-channel.test.ts`
  -> `14 passed (14)`. It references the diagnosis instruction.
- `pnpm.cmd --filter fluxiq run check` -> exit 0 (tsc --noEmit, no errors).
- `node scripts/structure-audit.mjs` -> exit 0, `structure-audit: passed (258 warning(s), 349 baselined)`. The count is
  the same as before the change. `summary.ts` (432) and `contracts.ts` (583) remain past the 400-line advisory
  threshold, as they already were at 421 and 574.

## Not verified

- No live or Lab run, so it is unproven whether the judge now accepts the round-1 Flow.
- The full suites were not run, as the brief requires.
- `llm/harness` tests were not run because that directory was not touched.
- A read inside a repeated span after a checked step in the same pass is not covered by any test. Such a read gets
  `afterWithheld` by position order, which is what the brief's rule gives.

## Open questions or contradictions found

- The rule counts a read whose outcome is anything other than absent, including `failed`. The judge sentence speaks of
  missing rows, so a failed read with `afterWithheld` is harmless. The supervisor may still want it restricted to
  `replayed`.
- The global agent note says workers do not write report .md files, while this brief and the worker protocol name this
  path. I followed the brief.
