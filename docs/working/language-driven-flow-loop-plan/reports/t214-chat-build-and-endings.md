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

## Round 2: the merge with t211, then the two trace gaps

### Merge fix (Core checkout `C:/Users/osrs_/FluxStuff/!FluxIQ`, staged by me; the supervisor committed it as `ef7cdf4d`)

- Six unreadable replies in a row ending as `flow_bootstrap.model_replies_unreadable` is the right combined behaviour.
  Each reply is asked again with a note. The ending carries a readable message and is retryable. It fires at 6 of 12
  calls, before the 8-decision no-progress guard.
- The combination had a defect. The staged `phases.ts` recorded only "unfinished" and "budget" rounds, so the unreadable
  ending published 6 paid calls with no steps and `decisionCount` 0. Fixed: every round except "finished"/"other" is
  recorded.
- Test changes:
  - The guard test is renamed "ends six unreadable replies in a row as exactly that while the run still has calls, with
    a named outcome". It pins iterations [1..6], the code, stage, `retryable: true`, accounting 7,200 / 900 / 8,100,
    six steps (iterations 1-6, `content_unclosed`), the ending and its exact message.
  - `replies-unreadable.test.ts` asserts that the unreadable round's trace and accounting are published.
- Validation there: the vitest run over the exploration test, unfinished-build and both unreadable-replies tests gave 5
  files and 38 passed. With generation-failure added, 12 files and 381 passed. Core tsc exit 0.

### Gap 1: the 20th decision of a 20-decision run left no trace row

- Cause: in `llm/evidence-loop.ts`, the last decision a budget allows is offered only completion. One spent on a tool
  call returned `exhausted("budget")` without recording a row. The decision was paid and counted
  (`iterationCount` 20), but the trace had only 19 decisions.
- Fix: the new module `llm/evidence-loop/final-decision-row.ts` builds that row: `tool_call`, the tool,
  `llm_evidence_loop.not_offered` and its usage.
  - A tool the model made up is recorded as an `unusable` row, so the published record is never refused for a non-Core
    identifier.
  - I moved the logic out of `evidence-loop.ts` because adding it inline took the file to 803 lines, past the
    structure audit's 800-line limit. It is back at 794.
- Tests:
  - The exploration test now pins `decisionCount: 20`, `not_offered` steps at iterations [18, 19, 20], and the 20th
    step's tool and usage.
  - The new `final-decision-row.test.ts` covers the known-tool and made-up-tool cases.

### Gap 2: a build that finishes after a repair stored only its last round's trace

- Cause: the service stored `built.loop.trace`, which is the repair round's alone.
- Fix, Core:
  - `phases.ts`: every round's rows are recorded, the finished round included. The `finished` outcome gains `trace`:
    every round's rows, numbered across the build. `loop.trace` is still the last round's.
  - `service.ts`: stores `built.trace` when the build finished.
  - `service/flow-bootstrap-commands/evidence-trace.ts`: a stored trace's row and iteration bounds are one round's ×
    `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_MAX_ROUNDS`, computed at call time.
  - The audit detail's `iterationCount` now counts each round's opening iteration-0 look, since every round makes its
    own. Counting it once would publish more tool calls than iterations for a repaired build.
- Fix, downstream, the cross-repo contract:
  - `packages/test-runner/src/existing-fluxiq-control/adaptation-evidence-loop.ts`: rows ceiling
    (64×2+1)×6, decisions ceiling 64×6+1, and `iterationCount ≤ providerCallCount + 6`. The old 129-row and
    `+1` rules would have rejected a repaired build's record.
  - The per-run Lab call cap of 64 still bounds `providerCallCount`.
- Tests:
  - `phases.test.ts`: the new case "finishes with every round's record...".
  - `tests/service-bootstrap/tests/unfinished-build.test.ts`: a repaired build stores decisions 1..N across both rounds,
    and its audit `decisionCount` equals the number of loop requests.
  - `evidence-trace.test.ts`: six-round bounds, and the new opening-look count.
  - The downstream `adaptation-evidence-loop.test.ts`: six-round bounds and the opening-look rule.

### Ready to commit

- Core (`fxwork/t214/!FluxIQ`, under `packages/fluxiq/src/programs/automation-studio/runtime/`):
  - `llm/evidence-loop.ts`
  - `llm/evidence-loop/final-decision-row.ts` (new)
  - `llm/evidence-loop/index.ts`
  - `llm/evidence-loop/tests/final-decision-row.test.ts` (new)
  - `flow-bootstrap/unfinished-build/phases.ts`
  - `flow-bootstrap/unfinished-build/tests/phases.test.ts`
  - `service.ts`
  - `service/flow-bootstrap-commands/evidence-trace.ts`
  - `service/flow-bootstrap-commands/tests/evidence-trace.test.ts`
  - `tests/deepseek-bootstrap-exploration.test.ts`
  - `tests/service-bootstrap/tests/unfinished-build.test.ts`
- Downstream (`fxwork/t214/!FluxIQWebExtension`):
  - `packages/test-runner/src/existing-fluxiq-control/adaptation-evidence-loop.ts`
  - `packages/test-runner/src/existing-fluxiq-control/tests/adaptation-evidence-loop.test.ts`
  - this report

### Validation, observed

- Core:
  - `npx tsc --noEmit -p tsconfig.json` (packages/fluxiq): exit 0.
  - vitest over conversations, tests/deepseek-bootstrap-exploration, flow-bootstrap, llm, tests/service-bootstrap and
    service (`--maxWorkers=2 --minWorkers=1`): `Test Files 205 passed (205)`, `Tests 2125 passed | 1 skipped (2126)`.
  - `node scripts/structure-audit.mjs`: `passed (203 warning(s), 354 baselined)`.
- Downstream:
  - `pnpm run check` (test-runner): exit 0.
  - `node --test "dist/existing-fluxiq-control/**/*.test.js"` after `pnpm run build`: 30 pass, 0 fail.
  - `node scripts/structure-audit.mjs`: `passed (135 warning(s), 119 baselined)`.

### Not done or not verified

- The `ended` outcome (cancelled, a refused configuration, the evidence backstop) still publishes its loop's last-round
  trace. It was not asked for.
- No Lab or browser run.
- No full `pnpm check`, `pnpm test` or `pnpm build` in either repository.
- The downstream `MAX_EVIDENCE_BYTES` of 7,340,032 was not revisited. Since t200 a build's evidence is whole pages and is
  now summed over rounds, so it may be low.
