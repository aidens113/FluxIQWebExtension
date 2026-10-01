# t214: six Core test failures on dev after the lifecycle merges

Worker report. Core tree `fxwork/t214/!FluxIQ`, branch `task/t214-chat-build-and-endings-tests` (off Core `fd2f7e6b`).
No Lab run, no commits.

## Outcome

Done. All six failures fixed. The three chat failures came from t200, not t196: only the test's scripted provider was
wrong, and the product chat path is right. Two of the three exploration failures were intended contract changes from
t208. The third exposed a real loss of information in the product: a multi-round build's failure record kept only the
last round's decisions. That is fixed in the product.

Ready to commit (Core): 
- `packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/tests/extension-chat.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/phases.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/tests/phases.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/diagnostic-parse.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/evidence-loop-steps.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/loop-limits/flow-bootstrap-rounds.ts` (new)
- `packages/fluxiq/src/programs/automation-studio/runtime/loop-limits/index.ts`

Validation: `npx vitest run <conversations, tests/deepseek-bootstrap-exploration, flow-bootstrap, llm, tests/service-bootstrap> --maxWorkers=2 --minWorkers=1` -> `Test Files 158 passed (158)`, `Tests 1776 passed (1776)`; `npx tsc --noEmit -p tsconfig.json` (packages/fluxiq) -> exit 0; `node scripts/structure-audit.mjs` -> `structure-audit: passed (203 warning(s), 354 baselined)`.

## What changed and why

### 1. extension-chat.test.ts (all 3): t200 broke them; only the test changed

- Cause: the build's second decision was refused before it was sent, with
  `flow_bootstrap.pre_provider_request_total_exceeded`. I confirmed this by printing the thread: the chat said
  "stopped because the build failed: ... pre_provider_request_total_exceeded ...". The first decision ran (`call.search`
  executed), and the second request was larger than the test's made-up window of `{ maxInputTokens: 8_000,
  maxOutputTokens: 2_000, maxTotalTokens: 10_000 }`.
- Which merge: t200 (`711eab8c`). It removed the trimming of a request to fit and moved every per-request ceiling to
  the model's 1,000,000-token window. A request over the window is now refused, never trimmed (`llm/harness/run.ts`).
  Before t200, the 10k window was quietly met by trimming.
- Not t196. The scripted model already adds its step with `add: true`, which t196 put in this test. Once the window was
  realistic, the authored step reached the Flow.
- The improve test's `blank_target_required` was a knock-on effect. Its create step failed for the same reason, so the
  Flow had no applied steps. An extend on a Flow with no steps is refused (`service.ts:1476`, mode `extend` with no
  extend subject).
- Product: the chat path needs no change. The real provider resolver uses `AUTOMATION_STUDIO_SESSION_KEY_PROVIDER_DEFAULTS`,
  the 1M window.
- Test change, all three tests: the scripted provider now declares
  `AUTOMATION_STUDIO_SESSION_KEY_PROVIDER_DEFAULTS.tokenLimits`, the real window, with a comment saying why. Nothing
  else changed. All 7 tests in the file pass.

### 2. deepseek-bootstrap-exploration.test.ts (3)

What each failing run produced (captured with temporary logging, since removed):

- **"names the ending ... more than sixteen decisions"**: the change was intended (t208). One round of 20 looks with
  no Flow and no call left now ends `flow_bootstrap.evidence_budget_exhausted` (bound `calls`, rounds 1, decisions 20)
  instead of `evidence_iteration_limit`. No information was lost: iterationCount 20 and toolCallCount 17 are unchanged.
  The test now pins the new code, `retryable: true`, the ending and the opening of the message.
- **"reproduces the measured 26-decision creation exhaustion ..."**: the change was intended (t208). Only the `code`
  differed. Exact feedback, trace, accounting (31,200 / 3,900 / 35,100), `exhausted` (iterations 26 of 26) and
  issueCodes all still match. The test now pins `evidence_budget_exhausted`, the ending (calls, 1 round, 26 decisions),
  and a message naming the cause ("the Flow could not give the answer you asked for").
- **"stops on the no-progress guard ..."**: the behaviour change was intended (t208), but **information was lost in
  the product**.
  - The behaviour now: the guard still stops round 1 at 8 of 12 calls. Under t208, an empty draft keeps exploring, so
    the build ran a second round with the 4 calls left (the provider saw iterations `[1..8, 1..4]`). It then ended
    `evidence_budget_exhausted` with the message "The build stopped at its limit of 12 model calls ... I explored live
    2 times over 12 decisions, and what held it up was that the model's replies could not be read. ..."
  - What was lost: the failure's `evidenceLoop` came from the **last round only** (iterationCount 4, decisionCount 4,
    steps for iterations 1-4), while `accounting` covered the whole build (14,400 input tokens = 12 calls). Round 1's
    eight decisions disappeared from the published trace, and the counts disagreed with the tokens.
  - Product fix (below). The test now pins 12 steps, iterations 1-12, each `core.decision_unusable` /
    `llm.provider_malformed_response` / `content_unclosed`; iterationCount and decisionCount 12; accounting
    14,400 / 1,800 / 16,200; `retryable: true`; the full ending (`calls`, rounds 2, decisions 12, stepsInFlow 0,
    `not_tested`); and the exact message.

### 3. Product: a build's ending carries every round's record

- `flow-bootstrap/unfinished-build/phases.ts`: the build now collects every unfinished or budget round's trace. Each
  round's decisions are numbered across the build (`numberedAcrossBuild`: round 2's decision 1 becomes 9; iteration 0,
  the unpaid observation, stays 0).
  - The `unfinished` outcome's `progress` is now `{ trace: all rounds, accounting: whole build, exhaustion: last
    round's }`, so the failure's counts and steps agree with its tokens. Before, it was the last round's record.
  - `maxRounds` is clamped to `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_MAX_ROUNDS`, so a published record always parses.
- `loop-limits/flow-bootstrap-rounds.ts` (new): `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_MAX_ROUNDS = 6`, moved out of
  `phases.ts`. The diagnostic reader needs it, and importing it from the lifecycle would create a cycle. Nothing else
  imported it (I searched both repos).
  - The barrel exports it before `flow-bootstrap-evidence-loop.ts`, the module that imports `../llm/`.
- `generation-failure/diagnostic-parse.ts`: a record's iterationCount, decisionCount, toolCallCount and trace rows are
  bounded at one round's ceiling × `MAX_ROUNDS`. `exhausted` stays one round's.
  - The bounds are computed at parse time. My first version computed them at module load, and that produced `NaN` inside
    the `loop-limits -> llm -> flow-bootstrap` import cycle. That refused every diagnostic in `incomplete-draft.test.ts`
    (3 failures, which I reproduced and then fixed).
- `evidence-loop-steps.ts`: a step's `iteration` is bounded at `maxIterations × MAX_ROUNDS`.
- Tests:
  - `phases.test.ts`: a new case, "ends with every round's record, its decisions numbered across the build". Iterations
    `[0,1,2,0,3,4,0,5,6]`, and the progress accounting equals the build's.
  - `diagnostics.test.ts`: the bound pins are raised to the build-wide bounds, and two refusals were added: just over the
    build-wide iterationCount, and just over the build-wide toolCallCount.

## Commands run and observed results

All Core commands ran from `packages/fluxiq` through `heavy.sh`.

- Baseline: `npx vitest run .../extension-chat.test.ts .../deepseek-bootstrap-exploration.test.ts` -> `6 failed | 12 passed (18)`, the six in the brief.
- `npx vitest run .../extension-chat.test.ts` after the fix -> `7 passed (7)`.
- `npx vitest run .../deepseek-bootstrap-exploration.test.ts` after the fix -> `11 passed (11)`.
- First full set run -> `3 failed | 1773 passed (1776)`, all in `incomplete-draft.test.ts`. With HEAD's versions of my
  three product files swapped in, the same file gave `24 passed`, so my change caused it. That was the load-time `NaN`
  described above, and is fixed.
- `npx vitest run runtime/flow-bootstrap runtime/tests/deepseek-bootstrap-exploration` -> `46 files, 846 passed`.
- Final: `npx tsc --noEmit -p tsconfig.json` -> exit 0.
- Final: vitest over `runtime/conversations runtime/tests/deepseek-bootstrap-exploration runtime/flow-bootstrap runtime/llm runtime/tests/service-bootstrap --maxWorkers=2 --minWorkers=1` -> `Test Files 158 passed (158)`, `Tests 1776 passed (1776)`, exit 0.
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (203 warning(s), 354 baselined)`. It also
  printed "1 baseline entries can be lowered"; I did not run `pnpm structure:baseline`.
- `node scripts/docs-reference.mjs --check` -> **fails**: "docs/reference/framework-reference.md is stale". This was
  already true on dev: regenerating it adds t196/t200/t208 exports (for example `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_BUILD_ENDING_CODES`)
  and 33 declarations, not only mine. I regenerated it, looked at the diff, and restored both copies. It is left for the
  supervisor's integration.

## Not verified

- No browser or Lab run (the brief forbids them), so the real chat build has not been run with a live model.
- `pnpm check`, `pnpm test` and `pnpm build` were not run across the whole workspace. The downstream repository was not
  built or tested; nothing downstream changed.
- Only the `unfinished` ending got the whole-build record. A build that finishes after a repair still stores only the
  last round's `evidenceTrace` (`service.ts`, `evidenceTrace = loop.trace`). The same is true of the `ended` outcome
  (cancelled or a refused configuration). I did not change either.

## Open questions or contradictions found

1. `framework-reference.md` is stale on Core dev from today's merges (see above). `pnpm docs:check` fails until someone
   runs `pnpm docs:reference`.
2. In the "more than sixteen decisions" run, the record shows `iterationCount 20` but `decisionCount 19`, and no step for
   decision 20. The twentieth decision, a look asked for on a decision that offers only completion, was paid for but
   wrote no trace row. Decisions 18 and 19 wrote `llm_evidence_loop.not_offered`. This looks like a trace gap for the
   last decision; the old test did not cover it either. I did not investigate further.
3. In the 26-decision run, the ending says "No step I found belonged in the Flow" while `exhausted.draftSteps` is 22.
   `proposableSteps` is 0 and `stepsInFlow` is 0, so the sentence is consistent with the checklist's view, but a reader
   of the record may find the two counts confusing.
4. A successful build after repairs has the same last-round-only gap in its stored `evidenceTrace` (see Not verified).
   It may deserve the same whole-build numbering.
