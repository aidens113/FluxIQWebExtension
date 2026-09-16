# The exploration's own call allowance — and whether a two-call provider run can pay for itself

All work in FluxIQ Core (`F:\!FluxIQ`). `AS/` below is
`packages/fluxiq/src/programs/automation-studio/`. Nothing in
`F:\!FluxIQWebExtension` was touched.

## Outcome

**Done.** The exploration has its own explicit call allowance, an exploration
call reserves against it, and a recovery that explores and then patches now
makes all four provider calls where the previous code made two.

Item 4 is answered, and the answer is the most important thing in this report:
**cost is not what stops a two-call run — and under `--llm-task adapt` nothing
stops one. But a live recovery *exploration* is impossible today for a reason
neither the budget nor the cost line, which is in the execution grant.** Details
in "The cost question" and "What actually blocks a live exploration" below.

## What changed and why

### 1. `AS/runtime/llm/run-budget.ts` — two call allowances, one purse

| Added | What it is |
| --- | --- |
| `AutomationStudioLlmRunBudgetAllowance` | `"run" \| "exploration"` |
| `AUTOMATION_STUDIO_LLM_DEFAULT_MAX_EXPLORATION_CALLS_PER_RUN` | `4` |
| `AutomationStudioLlmRunBudgetLimits.maxExplorationCallsPerRun?` | the exploration's own call number |
| `AutomationStudioLlmRunBudgetReservationInput.allowance?` | which allowance this reservation draws on |
| `llm_budget.run_exploration_call_limit` | the refusal when that allowance is spent |
| `snapshot().explorationCalls` | exploration spend reported on its own line |

**An undeclared reservation is a `run` reservation.** Defaulting the other way
would let any call reach the exploration allowance by saying nothing, which is
the borrowing this replaces. A test pins that direction specifically.

**The default is 4 because Core already answers this question elsewhere.** An
`explore_and_adapt` execution grant is issued for six calls
(`EXPLORE_DEFAULT_MAX_CALLS` in `execution-grants.ts`), and two of those are the
diagnosis and the patch it also authorizes. Four is what that grant already
leaves for looking at the live environment, so the two numbers agree rather than
being independently invented.

**Tokens and cost stay global.** The per-allowance counting is calls only; the
total-token, output-token and cost checks are unchanged and apply to every
reservation regardless of allowance. A test drives an exploration that has calls
left and no tokens, and one that has calls left and no money, and both are
refused.

One small robustness change in the constructor: an explicitly-`undefined`
optional limit is now skipped rather than throwing "must be a positive integer".

### 2. The declaration, threaded

`AutomationStudioLlmHarnessInput.runBudgetAllowance` (`harness/task-request.ts`)
→ `input.runBudget.reserve({ ..., allowance })` (`harness/run.ts`, one line) →
`runBudgetAllowance: "exploration"` on the exploration decision call
(`recovery/annotation/exploration.ts`). That one line is the whole of what makes
an exploration decision draw on the exploration allowance. `service.ts` was not
touched and is still 6468 lines.

`AUTOMATION_STUDIO_EXPLORATION_OUTCOME_FOR_RUN_BUDGET` gains the new code,
mapped to `budget_exhausted` — so an exploration that outruns its own allowance
still ends with the outcome it ended with before, under a name that says which
limit it was.

### 3. `recovery/annotation/annotate.ts` — the pots the calls are paid from

This is the half that is easy to miss, and without it the change does nothing.
The per-run token pot is derived as *per-request ceiling × how many calls this
run may make*. Sized for the diagnosis and the patch alone, it refuses an
exploration on **tokens** the instant the call allowance stops refusing it on
**calls**. Measured, not argued: reverting just this part of the change makes
the new tests fail with only the diagnosis and one more call getting through.

- `totalCallAllowance = maxCallsPerRun + explorationCallAllowance` now multiplies
  the token pot and the absolute per-request clamp.
- Core's own default token pot, previously the literal `12_000`, is now
  `6_000 × totalCallAllowance` — **exactly 12_000 when a run means two calls**.
  An operator-set `settings.budgets.maxTokensPerRun` still binds as written.
- **The money ceiling does not move.** `maxEstimatedCostUsdPerRun` is still
  derived from `maxCallsPerRun`, unchanged. What changed is the division:
  `maxEstimatedCostUsdPerCall = maxEstimatedCostUsdPerRun / totalCallAllowance`,
  so the same fixed purse is shared one slice per call the run may make instead
  of one slice per ordinary call. This is also load-bearing: reverting it alone
  makes the "still explores when the ordinary call limit is spent" test fail.
- New optional input `explorationCallAllowance` on
  `AutomationStudioRuntimeRecoveryAnnotationInput`. The service does not pass it,
  so the default applies and no service line was needed; a test sets it.

## The cost question (brief item 4), answered

**Short answer: a two-call `--llm-task adapt` / `diagnose_and_adapt` run can
reserve both calls. The `run-budget.ts:86` refusal does not fire on that path,
and nothing needs to change for it.**

The arithmetic at line 86 is
`state.estimatedCostUsd + reservedCost + (maxEstimatedCostUsd ?? 0.25) > (maxEstimatedCostUsdPerRun ?? 0.25)`.
Both `?? 0.25` defaults are only reached by a caller that supplies neither
number. **The only construction site of the ledger in the whole repository is
`annotate.ts`, and it always supplies both.** For an explicit
`diagnose_and_adapt` grant it derives (before this change) a per-run pot of
`0.25 × 2 = $0.50` and a per-call ceiling of `$0.25`, so the two reservations are
`0 + 0.25 ≤ 0.50` and `0.25 + 0.25 = 0.50`, which is not *greater than* 0.50. It
fits, exactly.

Measured with the real ledger (probe run against the numbers `annotate.ts`
derives; the probe file was deleted after):

| Case | Result |
| --- | --- |
| A. grant pot $0.50, per-call $0.25, provider reports **no** cost | `ok \| ok \| llm_budget.run_call_limit` — both calls reserve; the third is refused on the **call** limit, not on cost |
| B. same, provider reports $0.002/call | `ok \| ok \| llm_budget.run_call_limit`, run total charged **$0.004** |
| C. both numbers omitted (the bare `?? 0.25` case) | `ok \| llm_budget.run_cost_limit \| llm_budget.run_cost_limit` — **exactly one call per run** |
| D. both omitted, provider reports $0.002 | still one call: the first is charged its **actual** $0.002, and the second is refused anyway, because `0.002 + 0.25 > 0.25` |

So the trap the brief describes is **real but latent**. If a caller ever builds a
ledger without `maxEstimatedCostUsdPerRun` and reserves without
`maxEstimatedCostUsd`, it gets one call per run and no clue why. The number that
would have to change is the **per-run** default on line 86,
`this.limits.maxEstimatedCostUsdPerRun ?? 0.25`: a per-run default equal to the
per-call default (`AUTOMATION_STUDIO_LLM_DEFAULT_MAX_ESTIMATED_COST_USD = 0.25`
in `harness/token-limits.ts`) cannot pay for more than one call by construction.
I did **not** change it — no caller hits it, and changing a default nobody uses
is how a number stops meaning what it says. It is worth a one-line comment or a
guard if a second construction site ever appears.

### The real per-call estimate versus the reserved ceiling

A call reserves its **worst case**, never its actual size: `harness/run.ts`
reserves `tokenLimits.maxInputTokens + maxOutputTokens` (8 000 + 2 000 = 10 000
tokens by default) and `request.maxEstimatedCostUsd`. On completion the
**actual** reported usage is charged and the rest is released.

DeepSeek's rates in Core are `$0.44` per million input tokens and `$1.32` per
million output. So a call at Core's default per-request ceiling costs at most
`8 000 × 0.44/10⁶ + 2 000 × 1.32/10⁶ = $0.0062`. A call at Core's *absolute*
50 000-token ceiling, all output, costs at most `$0.066`.

The reserved per-call ceiling under a grant was `$0.25` — about **40×** the most
a default-sized call can actually cost, and about 4× the most any call Core will
ever issue can cost. After this change it is `$0.50 / 6 = $0.083`, still above
the absolute worst case. **No call Core makes can reach its own cost
reservation**, which is why cost never binds in practice and why shrinking the
slice is safe.

### The sharper constraint is tokens, not cost

Same probe, token side:

| Case | Result |
| --- | --- |
| F. non-grant pot 12 000, provider reports 1 400 tokens/call | `ok \| ok \| llm_budget.run_total_limit` — the pair fits, a third call does not |
| G. grant pot 20 000, provider reports 1 400 tokens/call | `ok \| ok \| ok` |
| H. grant pot 20 000, provider reports **no** usage | `ok \| ok \| llm_budget.run_total_limit` |

Because each reservation books 10 000 tokens while a real call uses ~1 400, the
pot is consumed by the *pending* reservation rather than by the actual spend. A
provider that reports no usage is charged the full 10 000, which is why stub
providers hit ceilings that a real DeepSeek run would not.

## What actually blocks a live exploration (read, not tested)

This decides whether the Lab proof is possible at all, so it matters more than
the budget work above.

1. **`runRuntimeSession` will not accept the grant purpose that authorizes
   exploration.** `service.ts:3087` types `llmExecution.purpose` as
   `"diagnosis_only" | "diagnose_and_adapt"`, and line 3091 refuses anything
   else. `explore_and_adapt` cannot be passed in.
2. **`diagnose_and_adapt` forbids the task kind outright.**
   `requestMatchesGrant` in `execution-grants.ts` allows that purpose only
   `runtime_diagnosis` and `runtime_patch`; `evidence_tool_decision` is not in
   its list. And the grant is issued for **exactly two** calls — line 124 throws
   if `maxCalls !== 2`.
3. **`explore_and_adapt` exists and already does the right thing**: six calls by
   default, and `evidence_tool_decision` explicitly allowed. It is simply not
   reachable from a runtime session.
4. `annotate.ts` also does not recognise it: `explicitCallLimit` returns
   `undefined` and `explicitGrantBudget` is `false` for `explore_and_adapt`, so
   such a run would fall back to the configured limits and to the settings token
   clamp rather than to the grant's own budget.

**So a live provider run that explores needs `explore_and_adapt` opened up at the
runtime-session entry point** (items 1 and 4). I did not make that change: item 1
is in `service.ts`, which my brief freezes, and item 4 is a grant-semantics
decision rather than a budget one. Without it, the exploration allowance is
correct and exercised only by tests.

## Commands run and observed results

All in `F:\!FluxIQ`.

```
pnpm check
  -> structure-audit: passed (140 warning(s), 254 baselined)   [unchanged count]
  -> packages/contracts, packages/client-gateway-websocket, packages/fluxiq,
     apps/web  ->  all "Done";  CHECK_EXIT=0

npx vitest run src/programs/automation-studio/runtime --root packages/fluxiq
  -> Test Files 98 passed (98),  Tests 890 passed (890),  0 failed

node ./node_modules/typescript/lib/tsc.js --noEmit   (in packages/fluxiq)
  -> TSC_EXIT=0

npx vitest run .../runtime/recovery .../runtime/llm --root packages/fluxiq
  -> Test Files 28 passed,  Tests 313 passed
```

The brief's baseline was 884/884 with one known pre-existing failure
(`service-bootstrap/tests/generation.test.ts`). That failure is **gone** — fixed
by another worker in the meantime, not by me. 884 + my 6 new tests = 890, which
is what ran.

`.structure-baseline.json` shows as modified in `git status`; that is another
worker's change, not mine. No file I own needed a baseline entry, and
`annotate.ts` was trimmed from 405 to **395 lines** so it stays under the
400-line advisory threshold once the new directory is committed. (Note: the
audit walks git-tracked files, so it does not currently see
`recovery/annotation/` at all — it is still untracked.)

### Negative probes — three, each reverted, each observed

1. **Remove `runBudgetAllowance: "exploration"`** from
   `annotation/exploration.ts` → both new tests fail:
   `expected [ 'runtime_diagnosis', …(1) ] to deeply equal [ 'runtime_diagnosis', …(3) ]`.
   Only two provider calls happen; the patch never fires. This is exactly the
   behaviour the brief describes as useless in practice.
2. **Revert the token-pot scaling** in `annotate.ts` (`* maxCallsPerRun` and the
   literal `12_000`) while keeping the declaration → same two failures. The call
   allowance alone is not enough; the pot has to be sized for the calls.
3. **Revert the cost divisor** to `/ maxCallsPerRun` → `still explores when the
   ordinary call limit is spent on the diagnosis` fails
   (`expected [] to deeply equal [ 'test.inspect' ]`). The exploration is refused
   on cost instead.

All three were restored and the suites re-run green.

### What the new tests assert

`llm/tests/run-budget.test.ts` (+2):
- exploration calls are counted against their own allowance, an **undeclared**
  call cannot reach that allowance (it gets `llm_budget.run_call_limit` while the
  exploration allowance is untouched), and `snapshot()` reports the two apart;
- an exploration with calls left is still refused for tokens
  (`run_total_limit`) and for money (`run_cost_limit`) — one purse, two
  allowances.

`recovery/annotation/tests/run-budget-allowance.test.ts` (new, +2):
- **the headline case.** A run whose ordinary allowance is exactly two — what a
  `diagnose_and_adapt` grant buys — makes all four calls:
  `["runtime_diagnosis", "evidence_tool_decision", "evidence_tool_decision", "runtime_patch"]`,
  takes a real action, reaches the trace as `completed` / `evidence_gathered`,
  reports `{ calls: 2, explorationCalls: 2 }`, and records **no** `llm_budget.*`
  diagnostic at all;
- with `explorationCallAllowance: 1` the exploration stops at
  `budget_exhausted` / `llm_budget.run_exploration_call_limit` **and the
  diagnosis and the patch still both happen** — the property the split exists
  for.

The stub provider in the new file reports usage, as a real one does, so the call
allowances rather than the token ceiling are the binding limit under test.

`recovery/annotation/tests/annotate.test.ts` (+1, 1 rewritten): the old
"budget exhaustion" test drove `maxCallsPerRun: 1`, which after this change no
longer touches the exploration; it now drives the exploration's own allowance,
and a new sibling test asserts the opposite direction — the ordinary limit spent
on the diagnosis, and the exploration running anyway.

## Not verified

- **No live provider, no real DeepSeek call, no Lab run, no browser.** Every
  test uses a scripted provider. The cost and token figures above are from Core's
  own rate constants and from the ledger driven directly, not from a real call.
- **`explore_and_adapt` was read, not run.** Points 1–4 of "What actually blocks
  a live exploration" come from reading `service.ts:3087`,
  `execution-grants.ts` `requestMatchesGrant` / `defaultMaxCalls`, and
  `annotate.ts`'s `explicitCallLimit`. I wrote no test against them.
- **`pnpm test` and `pnpm build` were not run whole.** `pnpm check` was, and the
  whole Automation Studio runtime suite was. Other workers have edits in flight
  (`harness-options/`, `context-packet.ts`, `loop-limits/`, `structured-diagnosis.ts`
  and more are modified in the tree), so a whole-repository gate would not
  attribute cleanly.
- **The new diagnostic code is exercised at one call site.**
  `llm_budget.run_exploration_call_limit` is driven through the ledger and
  through the recovery path; the other five codes in the outcome table are typed
  as total by the `Record` and pinned by `exploration-outcome.test.ts`, but not
  each driven end to end.
- **The widened default token pot is not measured against a real run.** Core's
  no-settings default moves from 12 000 to `6 000 × totalCallAllowance`
  (36 000 for a two-call run with the default allowance). Nothing an operator set
  changes; but what a six-call recovery actually consumes against a real provider
  is unmeasured.
- **`explorationCallAllowance` has no configuration path.** It is an input field
  with a default; no setting, policy field or grant feeds it yet. Deliberate —
  `service.ts` is frozen and the model/settings types are outside my brief.

## Open questions or contradictions found

1. **Opening `explore_and_adapt` to `runRuntimeSession` is the next blocker, and
   it is a `service.ts` edit.** Two lines (the `purpose` union at 3087 and the
   `compatiblePurpose` test at 3091), plus recognising the purpose in
   `annotate.ts`'s `explicitCallLimit` / `explicitGrantBudget` so the grant's own
   budget is used rather than the settings clamp. Until that lands, the wiring
   and the allowance are correct and unreachable from a real run.
2. **A per-run cost default equal to the per-call cost default is a trap waiting
   for its second caller.** `run-budget.ts:86` and
   `AUTOMATION_STUDIO_LLM_DEFAULT_MAX_ESTIMATED_COST_USD` are both `0.25`, which
   means "one call per run" for anyone who omits both. I left it alone
   deliberately; a guard in the constructor ("a per-run cost ceiling below the
   per-call default pays for one call") would make it impossible to get wrong.
3. **A reservation books the worst case and a real call uses about a seventh of
   it.** 10 000 tokens reserved against ~1 400 used. That is correct
   conservatism for concurrent calls, but it means the per-run token pot is sized
   by pending reservations rather than by spend, and it is why the pot has to
   scale with the call count at all. A reservation sized from
   `estimatedInputTokens` rather than from `maxInputTokens` would make the pots
   much smaller and much more honest — a bigger change than this brief.
4. **`explorationCallAllowance` is clamped to a minimum of 1.** There is no way
   to express "this run may not explore" through that number; the plan's
   `explorationRequested` and the Flow-scope port are what express it. Worth
   knowing before somebody sets it to 0 expecting it to mean something.
