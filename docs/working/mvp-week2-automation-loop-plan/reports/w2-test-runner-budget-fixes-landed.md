# w2 test-runner budget fixes — landed

**Outcome: Done.** Eight test files changed, no product source touched. All four
named commands run and observed clean.

The previous worker's triage (`w2-test-runner-budget-fixes.md`) was accurate and
saved the diagnosis. Its predicted count was low: the run showed **27** failures,
not the fifteen-plus-nine it had projected, because the product fix also moved
`EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS`, which that report had flagged but not
counted.

## Baseline

`pnpm --filter @fluxiq-web-extension/test-runner test` before any edit:

```
# tests 1157
# pass 1130
# fail 27
# duration_ms 27000.7821
Exit status 1
```

The 27 `not ok` lines were: 181, 490, 493, 495, 496, 498, 499, 500, 501, 502,
503, 512, 515, 523, 524, 525, 526, 532, 533, 534, 535, 539, 540, 541, 800, 828,
834.

## The rule every edit follows

No token count is written down anywhere below. Three sources are imported and
everything else is arithmetic on them:

- `AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD` from
  `fluxiq/automation-studio` — Core's own exported constant, 560,000.
- `DEFAULT_LLM_LAB_BUDGET` from `@fluxiq-web-extension/test-contracts` — the
  per-request triple and the default call count.
- `LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST` / `LLM_LAB_MAX_CALLS_PER_RUN` —
  the per-request ceiling and Core's call backstop.

Importing Core's constant is an established pattern in this package: six source
and test files already import from `fluxiq/automation-studio`, and the
`test-runner` package depends on `fluxiq` directly. Where a test's subject is
*not* the number itself, the expectation is derived from the plan under test
(`planLiveLlmExecution(PROFILE).maxTotalTokensPerRun`) rather than from a
formula restated in the test.

## How the source-parsing test was handled

`live-llm-plan.test.ts`, the drift detector, is now
**"the call, token and cost numbers the Lab mirrors are Core's own"** (renamed:
it checks a cost number too, which the old title did not say).

It was not weakened. The three constants Core exports are now **imported and
compared directly** — an import cannot be defeated by a change of expression and
cannot drift, which is strictly stronger than the regex it replaces. The regex
is what broke: it asserted `AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD`
was `([0-9_.]+)` and, once Core wrote `LIMITS.maxTotalTokens * 10`, reported
"no longer a plain numeric constant" instead of the 560,000-vs-100,000
difference it had actually found.

`MAX_TOTAL_COST_USD` is the one number Core does **not** export, so it is still
read from Core's source by regex — where it is still a plain numeric constant —
and the test still fails loudly if that stops being true. The comment records
why reading source was originally preferred (the build can lag it) and that a
Lab run against a Core build older than Core's source is now refused outright by
`scripts/lab/core-build-stale.mjs`, so that concern has its own dedicated guard.

## Every test changed, and why

### `live-llm/tests/live-llm-plan.test.ts`

| Test | Change |
| --- | --- |
| *(file preamble)* | Added `CORE_THRESHOLD` (imported from Core), `PER_REQUEST`, `DEFAULT_CALLS`, with a comment recording that this file's literal `100_000` agreed with the plan's literal and with nothing else. |
| 523 create-flow plans the … build_and_adapt grant | **Trap 1.** Dropped the `{ maxOutputTokens: 4_000, maxTotalTokensPerRequest: 12_000 }` override entirely: it inherited the new 48,000 input and 48,000 + 4,000 > 12,000 refused the profile. Budget now `CORE_THRESHOLD`. |
| 524 without `--llm-max-run-tokens` … | Budget, authorized tokens and threshold all `CORE_THRESHOLD`; the reason string is built from `PER_REQUEST`, `DEFAULT_CALLS` and their product. **Comment corrected**: "26 calls at 10,000 tokens could use 260,000 … holds the run to 100,000" was wrong twice. Three-call and one-call budgets derived. |
| 525 Core's high-token confirmation is planned exactly when … | Was green only because of the defect. `100_000`/`100_001` → `CORE_THRESHOLD`/`CORE_THRESHOLD + 1`. **Comment corrected**: "64 calls at the default budget" now says Core's backstop and uses `LLM_LAB_MAX_CALLS_PER_RUN`. |
| 526 a run token budget only moves down … | Held-to arithmetic now `PER_REQUEST * 2` (112,000, not 20,000). **Trap 2**: the floor probe `9_999` became `PER_REQUEST - 1`, and the non-integer probe `10_000.5` became `PER_REQUEST + 0.5` so it proves "not a whole number" independently of the floor. Comment added naming the floor. |
| 532 token limits are held inside Core's ceiling … | `maxInputTokens: 60_000` expecting "between 1 and 50000" is legal now (the ceiling is 64,000) and fired the add-up check instead. Now `LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST + 1` with the message derived from the same constant. |
| 533 → renamed *the call, token and cost numbers …* | See above. |

### `live-llm/tests/execution-grant.test.ts`

| Test | Change |
| --- | --- |
| `fakeCore` stub | Its own mirror `Math.min(tokenLimits.maxTotalTokens * maxCalls, 100_000)` → `CORE_THRESHOLD`. A stub that lies about Core is as bad as a stale assertion. |
| 499 an adapt grant asks Core for … | Ten authorized calls' exposure, `PER_REQUEST * 10`, in all three places. |
| 500 a run token budget at Core's threshold … | The **title was already wrong while passing**: it says "Core's threshold" and the body pinned 100,000. Body now uses `CORE_THRESHOLD` for both loop cases, so the title is true again. **Comment corrected**: "26 calls at 10,000 tokens, held to Core's default 100,000". Call count now `DEFAULT_CALLS`. |
| 501 … above Core's threshold … | `100_001` → `CORE_THRESHOLD + 1`. |
| 502 a diagnosis grant asks for exactly one call … | Expected run budget `10_000` → `PER_REQUEST`, with a comment that one call is one request's worth whatever the threshold. |
| 503 a grant authorizing more than this run asked for … | The `maxTotalTokensPerRun: 100_001` case no longer exceeded the plan's 560,000, so nothing was refused. Now `PER_REQUEST * 10 + 1`. |

### `live-llm/tests/live-llm-run.test.ts`

| Test | Change |
| --- | --- |
| 534 a default adapt run records that it sent no high-token confirmation | Five snapshot numbers and the reason string → `CORE_THRESHOLD`. |
| 535 a run whose typed token budget is above the threshold … | `150_000` is now *below* the threshold. Replaced with `CORE_THRESHOLD + PER_REQUEST` — one full request above it, which is what the test means. |
| `settleBuildOnce` helper (the shared fixture) | **Trap 1, behind all three of 539/540/541.** `profile({ maxOutputTokens: 4_000, maxTotalTokensPerRequest: 12_000 })` → `profile({})`, with a comment saying why a partial triple is refused. |
| 541 a build over its run budget … | `120_000` no longer breaches a 560,000 budget. Now `CORE_THRESHOLD + PER_REQUEST`, message derived. |

### `live-llm/tests/budget.test.ts`

| Test | Change |
| --- | --- |
| 490 each token limit bounds the run on its own | All three probes are now one token past their own limit, derived. The `totalTokens: 40_000` probe had gone silent against a 56,000 ceiling — the test asserted three limits and was really testing two. |
| 493 an iterating run inside its call count … | `adapting.maxTotalTokensPerRun` → `CORE_THRESHOLD`. |
| 495 an iterating run fails when its calls together exceed … | Rebuilt: 26 calls of 22,000 tokens (572,000) against a 560,000 budget. **Comment corrected**: "26 calls of 4,000 tokens is 104,000: every call is under 10,000, the run is over 100,000". Added two `assert.ok` guards so the probe cannot silently stop proving "each inside its own limit, together over the budget" when a limit next moves. |
| 496 a typed run token budget is the one the run is held to | **Trap 2.** `maxTotalTokensPerRun: 40_000` sits below the 56,000 one-request floor, so the plan refused before the assertion could run. Now `PER_REQUEST * 3` (168,000) with 11 calls of 16,000 breaching and 10 not, all derived. |
| 498 a one-call diagnosis is judged across its one authorized call | The inflated fixture (20,000 in / 22,000 total) no longer breaches a 48,000 input limit or a 56,000 run budget. Now one token past each. **Comment corrected**: "Core's totals say 20,000 input tokens for one call". |

### `live-llm/tests/lane-settlement.test.ts` (512, 515)

`failedRunDetail(150_000)` stopped breaching. Added `RUN_TOKEN_BUDGET`, taken
from `planLiveLlmExecution(PROFILE)` itself, and `OVERSPENT_TOKENS` one request
past it — used in all four places. Derived from the plan rather than from Core,
because this file's subject is *that a breach fails the lane on the budget*, not
what the number is; the number is pinned in `live-llm-plan.test.ts`.

### `demo-llm-create-ui/tests/exploration.test.ts` (181)

Not in the brief's list, and the extra failure beyond the prediction.

- `EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS` deepEqual restated `8_000 / 4_000 /
  12_000`; the product now follows `DEFAULT_LLM_LAB_BUDGET`, so the assertion is
  now written against those fields. Comment records that 8,000 input is the size
  measured as unable to describe a real page.
- `LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD === 100_000` → compared against Core's
  imported constant, turning the Lab's *second* mirror of that number into a
  drift detector rather than a second place for it to go stale.

### `tests/cli-llm.test.ts` (800)

**Trap 1 through the CLI.** The command passed `--llm-max-output-tokens 4000
--llm-max-total-tokens 12000` with no input flag, so input defaulted to 48,000
and the profile was refused with `must cover maxInputTokens plus
maxOutputTokens`. Now types the whole triple, `40000 / 6000 / 46000`, with the
expected `tokenLimits` matching.

I deliberately did **not** take the previous report's suggestion of adding
`--llm-max-input-tokens 8000`: the test is about flag plumbing, and re-enshrining
the exact figure Core measured as unusable would have put a ninth misleading copy
of it in front of the next reader.

### `tests/commands.test.ts` (828, 834)

- 828: the expected budget object restated the old default triple. Now
  `budget: { ...DEFAULT_LLM_LAB_BUDGET }`, so it never needs touching again.
- 834: `--llm-max-total-tokens 50001` expecting `/50000/` →
  `LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST + 1` with the message derived.
  `--llm-max-input-tokens 9000` expecting `/must cover/` had stopped throwing
  (9,000 + the new 8,000 default output is 17,000, well inside 56,000) → now
  `DEFAULT_LLM_LAB_BUDGET.maxInputTokens + 1`, the smallest input that genuinely
  overruns the total beside the default output.

## Commands run and observed results

All four were run from `F:\!FluxIQWebExtension` after the edits, one at a time.

**1. `pnpm --filter @fluxiq-web-extension/test-runner test`** — first run after
the edits reported **one** failure, and it was not one of mine:

```
not ok 2 - FIFO tickets prevent a later scheduler from overtaking an earlier waiter
  location: '…/dist/bench/campaign/machine-slots/tests/acquire-machine-cell-slot.test.js:92:1'
  failureType: 'unhandledRejection'
  error: 'Machine cell slot owner is unreadable; refusing unsafe recovery'
# tests 1157 / # pass 1156 / # fail 1
```

It is in `bench/campaign/machine-slots`, shares no file with anything I touched,
passed in the 27-failure baseline, and failed reading a slot file rather than on
an assertion diff. Rerun once, alone, per the brief's hardware note — clean:

```
# tests 1157
# suites 0
# pass 1157
# fail 0
# cancelled 0 / # skipped 0 / # todo 0
# duration_ms 38005.2884
EXIT=0
```

**2. `pnpm test`** (whole workspace) — `EXIT=0`. Per package:

| Package | tests | pass | fail |
| --- | --- | --- | --- |
| packages/test-contracts | 113 | 113 | 0 |
| packages/boundary-audit | 6 | 6 | 0 |
| packages/real-site-policy | 7 | 7 | 0 |
| packages/test-matrix | 17 | 17 | 0 |
| domain | 679 | 679 | 0 |
| packages/agent-orchestrator | 16 | 16 | 0 |
| packages/test-evidence | 17 | 17 | 0 |
| apps/scenario-lab | 330 | 330 | 0 |
| apps/extension | 678 | 678 | 0 |
| packages/test-runner | 1157 | 1157 | 0 |

3,020 tests, 0 failures.

**3. `pnpm check`** — `EXIT=0`. `structure-audit: passed (73 warning(s), 122
baselined)`, then `tsc --noEmit` clean for domain, boundary-audit,
real-site-policy, test-contracts, test-matrix, agent-orchestrator, test-evidence,
scenario-lab, test-runner, and `check-extension.mjs` for apps/extension. Every
project printed `Done`.

**4. `node scripts/structure-audit.mjs`** — `EXIT=0`,
`structure-audit: passed (73 warning(s), 122 baselined)`, zero lines containing
`error`. None of the 73 warnings names a file I changed; the `file-lines`
advisories are for `run-flow-lane.test.ts`, `run-scenario.ts` and
`existing-fluxiq-control.test.ts`, all pre-existing.

`git status` confirms the only modified product files are the two the supervisor
fixed (`live-llm-plan.ts`, `demo-llm-create-ui/limits.ts`) plus the pre-existing
`packages/test-contracts/tests/llm-contracts.test.mjs`. I edited test files only.

## One thing I have to flag (not fixed, not mine to fix)

**`EVIDENCE_GUIDED_CREATION_LIMITS` in
`packages/test-runner/src/demo-llm-create-ui/limits.ts` was not moved**, and it
is a live, consumed profile rather than dead constant.

It still reads `maxInputTokens: 8_000, maxOutputTokens: 4_000, maxTotalTokens:
12_000, maxTotalTokensPerRun: 100_000` — sitting in the same file as a
`LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD` that is now 560,000 and an
`EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS` that now follows the shared budget. Its
consumers:

- `demo-llm-exploration-request.ts:95-106` publishes all of it as the exploration
  request's `providerBudget`, including the 8,000 input limit;
- `explore-proposal-ui.ts:53` and `:104` use `maxTotalTokensPerRun` as the
  aggregate bound a proposal's accounting is failed against.

8,000 input is the exact figure Core's comment records as having fired the input
guard before the request was ever sent, on every realistic page in the live
corpus. I did **not** stop the job over it, for two reasons: the brief's own
description of the product fix names `EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS`
and not this constant, so excluding it looks like a deliberate scoping decision
rather than a new discovery; and the previous worker already flagged it. Nothing
I changed depends on it, and its tests (`exploration.test.ts:60`, `:70`,
`demo-llm-exploration-request.test.ts:25`) are truthful about the product as it
stands, so I left them alone rather than making them lie in either direction.

Its run-budget arithmetic is *not* the zero-decisions catastrophe: a 100,000 pot
with 12,000-token calls leaves roughly six exploration decisions after the patch
reserve. The 8,000 input limit is the serious half.

I checked whether the threshold move changed behaviour through this path and it
did not: `explore-proposal-ui.ts:58` computes
`configuredProfileRequiresConfirmation` as `100_000 > THRESHOLD`, which was
`false` at 100,000 and is `false` at 560,000, and it is a diagnostic field inside
an already-failing branch.

**Also worth a line**: `live-llm-plan.ts:27` keeps `const CORE_MAX_TOKENS =
64_000` as its own literal, duplicating
`LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST` in `test-contracts`. That is the same
shape of defect one generation earlier. I did not touch it, but my rewrite of
test 532 now derives its expected message from the contract constant, so the two
diverging would fail that test rather than pass silently.

## Not verified

- **Live browser or provider behaviour.** Nothing here was exercised against
  DeepSeek, a real Lab run or a browser. Every result above is a unit run, a type
  check and a structure audit. The claim that a default Lab run can now afford
  exploration decisions rests on Core's arithmetic as the previous report read
  it, not on a live run made here.
- **The FIFO scheduler test's flakiness** rests on two observations: it passed in
  the 27-failure baseline and passed on the rerun, failing once in between. I did
  not run it in a loop to characterise it, and I did not investigate the
  `Machine cell slot owner is unreadable` path. If it recurs without load it is
  worth a look; the evidence I have points at the machine, not at code.
- **`pnpm build`** was not run — it was not among the four commands named, and
  `pnpm check` and `pnpm test` (which builds `test-runner` as its first step)
  both compiled everything I touched.
- **Whether the new probe values are the *best* ones.** They satisfy the stated
  intent of each test and I asserted the intent explicitly where it was cheap to
  (the two `assert.ok` guards in 495), but values like 22,000 and 16,000 tokens a
  call are chosen to sit between limits, not measured against a real run.
- I did not re-read every currently-passing assertion in the eight files for
  prose that is stale for *other* reasons; I corrected the five the previous
  report listed, the two titles, and the comments in the blocks I rewrote.

## Open questions or contradictions found

1. **`EVIDENCE_GUIDED_CREATION_LIMITS` needs a decision**, as above. It is the
   last place in this repository carrying both an 8,000-token input limit and a
   100,000 run budget, and it reaches a real exploration request. It wants its
   own brief that owns `limits.ts`, `demo-llm-exploration-request.ts` and
   `explore-proposal-ui.ts`, plus the four test assertions that follow it.
   The stale prose in `limits.ts:16-24` ("12,000 per call times Core's default of
   26 calls, held to 100,000") goes with it — that arithmetic now yields 312,000,
   not 100,000, though the explicit literal still makes the number 100,000.
2. **`CORE_MAX_TOKENS` in `live-llm-plan.ts` should import
   `LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST`** rather than restate 64,000. One
   line, product source, so not mine.
3. **Nothing pins the Lab's threshold derivation against Core's *formula*.**
   Test 533 now proves Core's value equals the plan's, which is the property that
   matters. But if Core changed its threshold to, say, twenty requests and the
   Lab was updated to match by hand, both would agree and the test would pass —
   the Lab is still deriving it independently
   (`DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest * 10`) rather than importing
   Core's constant into `live-llm-plan.ts` itself. Importing it there would
   delete the last copy. I did not do it: `live-llm-plan.ts` is product source.
