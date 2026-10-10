# t392 unit RC: exploration regression and locator fact targets

## Outcome

Done. The exploration test file passes (8/8). The four named test directories pass (3629 passed, 2 skipped). The new locator test is in place and was shown to catch a regression. Two checks still fail because of other workers' files: tsc (1 error) and the structure audit (2 violations). Details are below.

## What changed and why

### 1. Cause of "saves a creation that looked more than sixteen times"

**Cause: Unit A's built-in `builtin.control.call-subflow` made the catalog bigger. It replaced `builtin.routine.subroutine`, and every request carries that catalog. The 17th request then went over the harness's per-call limit.**

- The refusal is `llm_budget.request_total_exceeded`, raised at `AS/runtime/llm/harness/run.ts:107`. The rule is estimated input plus 2,000 reserved for the reply must not exceed `maxTotalTokens` (22,000).
- The estimate comes from `measuredInput` (`run.ts:381-395`). It takes the larger of two sizes:
  - the packed request (`JSON.stringify(request)` at 3 bytes per token, which includes `context.flowBootstrap.nodeCatalog` with every entry whole);
  - the sent body.
- The packed request is about 60 KB and the sent body about 32 KB, so the packed size governs.
- Measured by instrumenting `measuredInput`, HEAD (from `git archive HEAD` into the scratchpad) against this tree, same test, same call:
  - The total difference was 486 bytes, or 162 tokens, on every call.
  - All of it is the catalog: `nodeCatalog` 27,291 → 27,702 bytes (+411) and `catalogNames` 3,369 → 3,444 (+75).
  - Nothing else in the request differs by a byte. That includes the evidence, decision schema, output schema and instructions.
- At HEAD, Call Subflow's full entry is 247 tokens (chars/4) and the removed Subroutine's is 145. Every built-in has availability `both` (`AS/nodes/definitions.ts:136`), so both nodes were in the Flow catalog.
- HEAD passes all 8 cases. Its largest request was 59,594 bytes, or 19,865 tokens: only 135 tokens under the 20,000 limit. This tree's call 17 is 60,080 bytes, or 20,027 tokens. Evidence adds about 102 tokens per call.
- Change responsible: Unit A, in `AS/nodes/control-flow/index.ts:34` (adds `callSubflowNode` to `controlFlowNodes`) and `AS/nodes/routine/index.ts` (removes `subroutineNode`).
- Ruled out by measurement: E1 (`add_handler` and `replace_unit` appear 0 times in any request body), G (no fact targets in this test), and D2/F2/F1b (no request component other than the catalog changed).

**Fix: in the test harness, not the test.** The node catalog is never cut, capped or ranked (user, 2026-09-30, `AS/runtime/flow-bootstrap/plan/catalog.ts` header and `plan/limits.ts`). Its only bound is the model's context window. The harness's per-call `tokenLimits` stand in for that window. They were already raised once, from 8,000/10,000 to 20,000/22,000, when the whole catalog first rode in every request.

That 20,000 is an accidental number: it left 135 tokens of headroom, less than one node entry. I raised the harness default in `AS/runtime/tests/deepseek-bootstrap/tests/harness.ts` (around line 117) to 28,000 input / 2,000 output / 30,000 total, with a comment explaining why. The test's expectations are unchanged: no failure, 19 calls, 19 trace rows, and more than 50,000 estimated input tokens.

The case that sets its own 20,000 limits ("records a build's token totals…") is unchanged and still passes. Its largest request is about 18.8k tokens.

### 2. A locator fact target is never sent to `fluxiq.fact.target`

G's code was already correct. `automationStudioPlanFactTargetSites` (`AS/runtime/llm/harness-options/plan-fact-targets.ts`) collects a target only when `automationStudioPlanNodeParametersNameHandle(target)` holds, and `{ locator }` has no `handle` key.

- **New test:** `AS/runtime/llm/harness-options/tests/plan-fact-targets.test.ts`, case "leaves a locator target as written in all five places and never asks the domain about it".
  - It puts `{ locator }` in the success check, entry `when`, checkpoint `when`, handler `when` and handler `completionCheck`.
  - It asserts that no `fluxiq.fact.target` request is made, every one of those places is unchanged after resolution, and `assertAutomationStudioFlowBootstrapPlanHandlesResolved` does not throw.
  - In a mixed plan, only the two handles are asked about and the locator entry facts stay as written.
- **Mutation check:** I temporarily made the site finder also collect `{ locator }` targets. The new case failed (1 failed, 4 passed). I then restored the file and confirmed it was unchanged.
- **Related fix:** `AS/runtime/flow-bootstrap/authoring/tests/state-statements.test.ts:382`, t402's "leaves a locator target alone through bootstrap's handle resolution".
  - At HEAD that case expected the `exists t4` handle in an entry `when` to stay `{ handle: "t4" }`. That was true only before G resolved metadata fact handles.
  - Under G, the case now asserts that the handle is asked about (`{ target: { handle: "t4" } }`) and that its target becomes the stand-in's answer (`{ target: "#t4" }`).
  - The locators stay as written, and the existing `not.toContain("locator")` check over every request still holds.

### 3. Statement packing

All new lines hold one statement each. The audit raised no `statement-packing` finding.

## Commands run and observed results

All commands ran from `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ/packages/fluxiq` unless stated otherwise.

- Before the fix: `npx vitest run …/deepseek-bootstrap/tests/exploration.test.ts -t "sixteen times"` → 1 failed. The failure was `flow_bootstrap.pre_provider_request_total_exceeded`, `estimatedInputTokens: 20027`, `totalProviderCallCount: 16`.
- The same file against HEAD source (from `git archive HEAD` in the scratchpad, node_modules junctioned) → `8 tests` all passed.
- After the fix: `npx vitest run src/programs/automation-studio/runtime/tests/deepseek-bootstrap` → `Test Files 2 passed (2)`, `Tests 11 passed (11)`.
- `npx vitest run …/harness-options/tests/plan-fact-targets.test.ts …/authoring/tests/state-statements.test.ts` → `Tests 26 passed (26)`.
- `npx vitest run src/programs/automation-studio/runtime/tests/deepseek-bootstrap src/programs/automation-studio/runtime/llm src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/nodes` → `Test Files 305 passed | 1 skipped (306)`, `Tests 3629 passed | 2 skipped (3631)`.
- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo` → exit 2 with one error, not mine:
  - `src/programs/automation-studio/runtime/conversations/commands/run-flow.ts(105,7): TS2739 … missing … add_handler, replace_unit`.
  - `BY_KIND: Record<AutomationStudioChangeProposalKind, string>` lacks labels for the two kinds E1's lane added to the union in `AS/model/flow-adaptation.ts:150`, which is on the stop list.
  - The fix is two `BY_KIND` entries in `run-flow.ts`, which is neither my path nor a stop-list path.
- `node scripts/structure-audit.mjs 2>&1 | tail -1` (Core root) → `structure-audit: 2 violation(s) across 1 rule(s).` Both are `as-never` in other workers' executor tests:
  - `AS/runtime/executor/lifecycle-run/tests/in-run-repair-fixtures.ts:48`
  - `AS/runtime/executor/lifecycle-run/tests/in-run-repair.test.ts:147`

  The audit also prints "3 baseline entries can be lowered".

## Not verified

- I did not run the whole Core vitest suite (the full-suite rule), only the four named directories.
- I did not check the production per-call limits beyond reading that they are sized to the model's context window (`llm/deepseek/provider.ts` comment). This failure is specific to the harness's small stand-in limits.
- Instrumentation was temporary. `run.ts` and `harness.ts` were restored from copies, and `git status` shows `run.ts` unmodified. The scratch tests and the HEAD copy were deleted, with junctions removed as links only. The tree's node_modules is confirmed intact.

## Open questions or contradictions found

- **The estimate counts the catalog more heavily than the request sends it.** `measuredInput` estimates the packed request, which carries the full catalog (about 27.7 KB). The sent body carries only names and descriptions (`catalogNames`, about 3.4 KB). So each built-in node costs about 8 times more estimated tokens than it sends. Deciding whether the packed measure should still include the full `nodeCatalog` is a harness design question (`AS/runtime/llm/harness/run.ts:381`), and I did not change it.
- `state-statements.test.ts` was written for t402 before G existed. Its expectation encoded the pre-G behaviour, in which metadata fact handles were left unresolved, so I updated it. The supervisor may want t402's downstream notes to say that a handle fact beside a locator is now resolved at completion.
