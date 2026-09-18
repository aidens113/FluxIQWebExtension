# w2 test-runner budget fixes — STOPPED on a real product defect

**Outcome: Blocked. No files changed.**

The brief said to stop and report if a failure indicates a real product problem
rather than a stale assertion. One does, and it governs four of the fifteen
failures plus nine assertions that are currently green *because* of the defect.
Fixing those four to whatever turns them green would cement the bug, so nothing
was edited at all — including the eleven that are purely stale — because the
product fix puts three of the same files back in play, and a part-green run
would read as "nearly done" while the Lab is still broken.

## The real defect: the Lab's copy of Core's threshold never moved

`packages/test-runner/src/live-llm/live-llm-plan.ts:40`

```ts
const CORE_HIGH_TOKEN_CONFIRMATION_THRESHOLD = 100_000;
```

Core's is now derived —
`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\llm\execution-grants.ts:84`:

```ts
export const AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD = LIMITS.maxTotalTokens * 10;  // 56_000 * 10 = 560_000
```

This is the eighth copy the brief warned about. It is not a test assertion: it is
shipped Lab source that decides what the Lab asks Core to authorize on a real
live campaign run.

### What it does in practice

`live-llm-plan.ts:157` computes the default run budget with Core's formula but
Core's *old* number:

```ts
tokens: Math.max(perCall, Math.min(exposure, CORE_HIGH_TOKEN_CONFIRMATION_THRESHOLD))
```

At the new call size that is `max(56_000, min(1_456_000, 100_000))` = **100,000**,
where Core would choose **560,000**.

`execution-grant.ts:51` sends that number on every grant request unconditionally,
and Core honours a caller-named budget (`execution-grants.ts:221`,
`input.maxTotalTokensPerRun ?? ...`), so Core's default never applies to a Lab
run. Worse, `execution-grant.ts:85` *rejects* a grant carrying more than the plan
asked for:

```ts
if (maxTotalTokensPerRun !== null && maxTotalTokensPerRun > plan.maxTotalTokensPerRun) { ... }
```

so even if Core issued its correct 560,000, the Lab would refuse it as "a larger
run token budget than this run asked for". The Lab cannot obtain Core's default
run budget by any path.

### Why that is the regression the limits change was made to remove

Core's own test states the arithmetic —
`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\tests\recovery-grant-limits.test.ts:40`,
"gives a default grant a diagnosis, a patch and the exploration's own default
decisions", whose comment reads: *"That count was ZERO while the threshold was
the literal 100_000 beside a 56,000-token call: the pot was under two calls'
worth and the patch's reserve held one of them, so every default-grant recovery
stopped without exploring."*

Run that arithmetic on what the Lab sends: pot 100,000; the patch reserve holds
one call's worth (56,000); 44,000 remains, less than the 56,000 an exploration
decision reserves. **Zero exploration decisions.** Every live Lab adapt, repair
and create-flow run that does not pass `--llm-max-run-tokens` reintroduces,
inside the Lab, exactly the failure Core's change was made to remove. Core's
comment notes the campaign never saw it "because it passes its own larger run
budget" — the Lab is the consumer that does not.

Secondary effect: `highTokenConfirmation.required` fires above 100,000, so a
**two-call** adapt run (2 x 56,000 = 112,000) now sends Core a high-token
confirmation it does not require. Failing test 526 asserts that flag is `false`
for exactly that run, and is right to.

### Suggested fix (product, not mine to make)

Derive it rather than restate it, per the brief's "do not add an eighth". The
plan already mirrors `LLM_LAB_MAX_CALLS_PER_RUN` from
`@fluxiq-web-extension/test-contracts`; the threshold should arrive the same way,
as `DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest * 10`, so it tracks the
per-call size the way Core's does. Two comments go stale with it:

- `live-llm-plan.ts:154-155` — "a request is at most 50,000 tokens" (now 64,000).
- `live-llm-plan.ts:35-39` — still describes the threshold as an absolute.

### A second stale copy, no test failing on it

`packages/test-runner/src/demo-llm-create-ui/limits.ts:34` —
`export const LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD = 100_000;`, and
`EVIDENCE_GUIDED_CREATION_LIMITS` (lines 22-27) still runs at
**8,000 in / 4,000 out / 12,000 per request** with `maxTotalTokensPerRun: 100_000`.
8,000 input is the precise number Core's comment records as having fired the
input guard before the request was sent on every realistic page in the live
corpus. Its tests are green because source and test agree on the old number.
Flagged, not fixed: outside the fifteen and outside "test files only".

## Triage of all fifteen failures

Eleven are stale assertions needing only a test edit; four cannot be written
correctly until the constant above moves.

### Blocked on the product fix (4)

| # | Test | File | Why |
| --- | --- | --- | --- |
| 523 | create-flow plans the web panel's iterating build_and_adapt grant, with the operator's call count and Core's default run budget | `live-llm/tests/live-llm-plan.test.ts:103` | Two faults. The fixture is trap #1 (`maxOutputTokens: 4_000, maxTotalTokensPerRequest: 12_000` inherits the new 48,000 input, so 48,000+4,000 > 12,000). And line 109 asserts the default run budget is 100,000, which is the defect. |
| 524 | without --llm-max-run-tokens the run token budget is Core's default, so a default adapt run needs no confirmation | `live-llm-plan.test.ts:117` | Wholly about the defective number. Correct expectation once fixed: budget 560,000, threshold 560,000, reason `...the smaller of --llm-max-total-tokens 56000 x 26 authorized call(s) = 1456000 and 560000...`. Line 118's comment ("26 calls at 10,000 tokens could use 260,000") is stale prose. |
| 526 | a run token budget only moves down: held to what the authorized calls could use, refused below one request | `live-llm-plan.test.ts:147` | The held-to arithmetic is stale (2 calls is now 112,000, not 20,000) — that part is a plain edit. But line 150 asserts `highTokenConfirmation.required === false` for that run, true only once the threshold is 560,000. Trap #2 also hits line 156 (the floor is now 56,000, not 10,000). |
| 533 | the call and token numbers the Lab mirrors are Core's own | `live-llm-plan.test.ts:196` | **This is the detector that caught it.** It reads Core's source with `^(?:export )?const NAME = ([0-9_.]+);` and now fails with "AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD is no longer a plain numeric constant". Teaching the parser to evaluate `LIMITS.maxTotalTokens * 10` is a test edit, but the assertion it then makes — Core's value equals the Lab's `highTokenConfirmation.threshold` — fails 560,000 vs 100,000. Weakening the parser to skip this constant would delete the only check that would have caught tonight's drift. |

### Stale assertions, safe to edit once unblocked (11)

| # | Test | File | What is stale / how to fix |
| --- | --- | --- | --- |
| 490 | each token limit bounds the run on its own | `live-llm/tests/budget.test.ts:77` | `totalTokens: 40_000` was over the old 10,000 per-request cap and is under the new 56,000, so nothing throws. Raise all three probes above the new triple, derived from `DEFAULT_LLM_LAB_BUDGET` rather than fresh literals. |
| 496 | a typed run token budget is the one the run is held to, and is named | `budget.test.ts:149` | **Trap #2.** `maxTotalTokensPerRun: 40_000` is below the 56,000 one-request floor, so the plan refuses before the assertion. Move it above 56,000 (three calls' worth, derived) and recompute the 11-call / 41,800-token arithmetic and the quoted message. Title carries no number. |
| 498 | a one-call diagnosis is judged across its one authorized call, not the larger cap typed | `budget.test.ts:168` | Quotes `--llm-max-input-tokens 8000` and `run token budget of 10000`; now 48,000 and 56,000. The inflated fixture (20,000 input / 22,000 total) no longer breaches either — raise it so it still proves "fine for 26 calls, a breach for one". |
| 502 | a diagnosis grant asks for exactly one call whatever cap was typed | `live-llm/tests/execution-grant.test.ts:96` | Expects `maxTotalTokensPerRun` 10,000, gets 56,000. Genuinely independent: a one-call run budget is one request whatever the threshold. Derive from `DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest`. |
| 532 | token limits are held inside Core's ceiling and must add up | `live-llm-plan.test.ts:191` | Expects `--llm-max-input-tokens 60000 must be a whole number between 1 and 50000`. The ceiling is 64,000, so 60,000 is legal now and the add-up check fires instead. Use a value above `LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST` and take the message's ceiling from that constant. |
| 539 | a create-flow run authorizes a build_and_adapt grant and records the build it settled | `live-llm/tests/live-llm-run.test.ts:183` | All three share `settleBuildOnce`'s fixture at line 176: `profile({ maxOutputTokens: 4_000, maxTotalTokensPerRequest: 12_000 })` — **trap #1**, it inherits the new 48,000 input. Set the per-request triple together in that one helper and all three clear. |
| 540 | a build that reached no provider fails the run closed, after its evidence is written, and says where Core stopped | `live-llm-run.test.ts:201` | Same fixture. |
| 541 | a build over its run budget, over its call count, or run on another model fails the run | `live-llm-run.test.ts:212` | Same fixture; its run-budget arithmetic needs recomputing against whatever triple the helper settles on. |
| 800 | a create-flow dry run resolves the task, plans the build grant and starts nothing | `src/tests/cli-llm.test.ts:108` | **Trap #1 through the CLI**: passes `--llm-max-output-tokens 4000 --llm-max-total-tokens 12000` but no `--llm-max-input-tokens`, so input defaults to 48,000 and the profile is refused with `$.budget.maxTotalTokensPerRequest: must cover maxInputTokens plus maxOutputTokens`. Pass the third flag, and update line 123's expected `{ maxInputTokens: 8_000, maxOutputTokens: 4_000, maxTotalTokens: 12_000 }` to match. |
| 828 | parses explicit live LLM mode with conservative defaults | `src/tests/commands.test.ts:50` | Expects the old default budget `8_000 / 2_000 / 10_000`; it is now `48_000 / 8_000 / 56_000`. Spread `DEFAULT_LLM_LAB_BUDGET` instead of restating the triple, so it never needs touching again. |
| 834 | live LLM CLI rejects unsafe budgets and multi-run matrices | `commands.test.ts:125` | Two stale lines. `--llm-max-total-tokens 50001` expecting `/50000/` needs a value above `LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST` (64,000), message derived. And `--llm-max-input-tokens 9000` expecting `/must cover/` no longer throws: 9,000 + the new 8,000 default output = 17,000, well inside 56,000 — it needs a value that genuinely overruns the new total. |

### Titles

None of the fifteen failing titles carries a literal token count; the numbers
live in bodies and prose. Two titles carry counts that remain correct (26 calls,
Core's backstop of 64). One **passing** title does state a number that is about
to be wrong — `execution-grant.test.ts:82`, "a run token budget at Core's
threshold is issued without a high-token confirmation", whose body pins the
threshold at 100,000.

Stale prose to fix alongside the assertions: `live-llm-plan.test.ts:118`
("26 calls at 10,000 tokens could use 260,000"), `budget.test.ts:129`
("26 calls of 3,800 tokens is 98,800"), `budget.test.ts:143` ("26 calls of 4,000
tokens is 104,000: every call is under 10,000"), `budget.test.ts:173` ("Core's
totals say 20,000 input tokens for one call"), `execution-grant.test.ts:83`
("26 calls at 10,000 tokens, held to Core's default 100,000").

### Green only because of the defect

These go red the moment the constant is corrected and must move in the same
change — they encode 100,000 as Core's default or threshold:

- `live-llm-plan.test.ts:131` — "Core's high-token confirmation is planned
  exactly when the run token budget exceeds its threshold": the whole test is
  built on 100,000 / 100,001.
- `execution-grant.test.ts:69` (lines 73, 77, 79), `:82` (lines 84, 89), `:97`
  (100,001), `:124` (the `maxTotalTokensPerRun: 100_001` case), and the
  `fakeCore` stub's own mirror at line 51,
  `Math.min(tokenLimits.maxTotalTokens * maxCalls, 100_000)`.
- `live-llm-run.test.ts:117-133` — snapshot assertions on 100,000 and on the
  "within Core's 100000-token confirmation threshold" reason string; and line 234.
- `lane-settlement.test.ts:163` — "against its run token budget of 100000".
- `budget.test.ts:131, 145, 147` — `adapting.maxTotalTokensPerRun` of 100,000.

Nine more sites across four files, three of which also hold stale failures. That
is why doing the eleven now would have meant editing the same files twice.

## Commands run and observed results

`pnpm --filter @fluxiq-web-extension/test-runner test`, run twice. Identical
counts and identical fifteen `not ok` lines both times; no `EBUSY`,
`SQLITE_CORRUPT` or worker-init crash appeared, so none of this is hardware
noise.

Run 1:

```
1..1121
# tests 1157
# suites 0
# pass 1142
# fail 15
# cancelled 0
# skipped 0
# todo 0
# duration_ms 32861.6805
F:\!FluxIQWebExtension\packages\test-runner:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @fluxiq-web-extension/test-runner@0.1.0 test: `pnpm build && node --test "dist/**/*.test.js"`
Exit status 1
```

Run 2: `# tests 1157`, `# pass 1142`, `# fail 15`, `# duration_ms 36092.4877`.

This is the unchanged baseline; nothing was edited.

## Not verified

- `pnpm test` (whole workspace) and `node scripts/structure-audit.mjs` were **not
  run**. With no edits made they would only re-measure the same baseline at the
  cost of a long run on a machine with known-faulty RAM. They are owed after the
  product fix and the test updates, not before.
- The zero-exploration-decisions consequence is read from Core's arithmetic and
  its `recovery-grant-limits.test.ts`, not reproduced by executing a live Lab
  run. The reasoning is deterministic (100,000 pot, 56,000 patch reserve, 56,000
  per decision) but nothing was run live to watch it happen.
- Whether `test-contracts` is the right home for the exported threshold is a
  suggestion, not a verified design. Core exports the constant publicly, so
  importing it may be cleaner than mirroring it.
- `demo-llm-create-ui/limits.ts` was inspected but its behaviour was not
  exercised; the claim that its 8,000-token input profile cannot describe a real
  page rests on Core's recorded measurement, not on a run made here.

## Open questions or contradictions found

1. **Who owns the fix?** `live-llm-plan.ts` is Lab source, not a test, so it sits
   outside "edit test files only". It needs a supervisor decision or a new brief
   that owns that file, plus `execution-grant.ts` if the grant-narrowing check at
   line 85 is to be revisited.
2. **Mirror or import?** Core exports
   `AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD`. The Lab mirrors it
   with a literal and checks the mirror by regex-parsing Core's source (test
   533). Now that Core's value is an expression, a regex cannot follow it —
   either the Lab imports the real constant and test 533's third assertion
   becomes unnecessary, or the parser must evaluate `LIMITS.maxTotalTokens * 10`.
   Importing is the only option that cannot drift again.
3. **`demo-llm-create-ui/limits.ts` was not in the brief** but holds both the
   second stale 100,000 and an 8,000-token input profile that Core's measurement
   says cannot describe a real page. It is green and silent. Worth its own brief.
