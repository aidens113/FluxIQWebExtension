# Core limit test fixes

Worker report. Scope: repair Core tests left failing by the deliberate token-limit
and `explorationNeeded` changes. Test files only; no production source edited; no
Core rebuild; nothing committed.

## Outcome

**Partial — one genuine production regression found, and left unfixed as the brief
directs.**

All eight named failures are fixed, plus five more of the same cause that the two
named suites did not cover. Two failures remain that are **not** stale assertions:
they are the limits change starving the recovery loop's exploration budget. I did
not edit either side for those. Two further failures in the whole-program run are
load artefacts and pass in isolation.

| Suite | Failures before | After |
| --- | --- | --- |
| `runtime/recovery` + `runtime/llm` (the named two) | 8 | 0 |
| `api/` (found by the whole-program run) | 5 | 0 |
| `runtime/tests/service-adaptation/.../iterating-recovery.test.ts` | 2 | 2 (real, see below) |
| Load-sensitive, pass alone | 2 | 2 under load, 0 alone |

## Each failure, and what it was

### Stale assertions — fixed (13)

**1–2. `execution-grants.test.ts` — "accepts bounded user limits…" and "fails
build_and_adapt closed…".** Both asserted `tokenLimits: { maxTotalTokens: 50_001 }`
is refused. 50,001 is now legal. Kept the intent by moving the value above the new
ceiling: `64_001`. Both still reject with "LLM token limits are invalid."

**3–5. `execution-grants.test.ts` — the three default-purpose grants
(`diagnose_and_adapt`, `explore_and_adapt`, `build_and_adapt`).** These pinned the
grant's default per-call limits at 8,000/2,000/10,000. Updated to
48,000/8,000/56,000, with a comment recording why: the new numbers are
deepseek-chat's 64k context less room for the reply, and the run budget (100,000)
and call count (26) did **not** move, because 26 x 56,000 is still held to the
confirmation threshold. The test's own title — "26 calls, 100,000 tokens and $2.00,
with no confirmation" — is therefore still literally true and needed no change.

**6–7. `execution-grants.test.ts` "refuses a call whose worst case would cross the
run's token budget…" and `execution-grant-failures.test.ts` "ends the grant on a
budget breach…".** Not stale assertions about the ceiling: both issue a grant with
`maxTotalTokensPerRun: 25_000`, and a run budget may never sit below one call's
ceiling, which is now 56,000. Rather than rescale the arithmetic, both now name the
per-call ceiling explicitly (`{ maxInputTokens: 8_000, maxOutputTokens: 2_000,
maxTotalTokens: 10_000 }` — exactly what the fixture's `request()` asks for, and so
exactly what each call is charged). The three-call example, its comments and the
property under test are unchanged, and the test no longer depends on a default it
was never about. The floor rule itself stays covered by "requires confirmation only
when the run's token budget exceeds 100,000 tokens", which asserts
`maxTotalTokensPerRun: 33_333` is refused below a 33,334 per-call ceiling.

**8. `plan.test.ts` — "plans nothing, and asks for nothing, when no failed attempt
was classified".** This was the supervisor's blanket replace, as flagged. Restored
to `["stop"]`. `plan.ts` answers this case on a dedicated unclassified path
(`unclassifiedPlan`, a hard-coded single `stop` step) that never reads
`explorationNeeded`, so the raised default cannot reach it. I checked the file's two
other changed cases and left them as `explore`: both use a fixture whose
`deterministicRecoveryAvailable` is false, which is precisely when Core should now
ask to look. Added a comment saying why this one case is different.

**9–10. `api/contracts/tests/llm.test.ts`.** "gets an explore_and_adapt preflight
with a run token budget" asked for `maxTotalTokensPerRun: 40_000`, now below the
56,000 floor; raised to 60,000, which is still well under the 100,000 default, so it
still proves a caller's *lower* budget is the one returned. "describes the defaults
the grant service applies" pinned 8,000/2,000/10,000; updated as in 3–5. The same
test's `maxTotalTokensPerRun: 9_999` rejection still holds, now because it is below
one call's ceiling.

**11. `api/handlers/tests/llm-execution-settings.test.ts` — "rejects unsupported
providers, oversized totals…".** `maxTotalTokens: 50001` is now inside the handler's
raised bound. Moved to `64001` so the case still proves an oversized total is
refused.

**12–13. `api/handlers/tests/llm-generation.test.ts`.** "forwards a caller's lower
run token budget" used 40,000; raised to 60,000 for the reason in 9. "rejects
mismatched sessions and unbounded provider accounting" used
`estimatedInputTokens: 50_001`; `boundedAccountingInteger` is now bounded by
`AUTOMATION_STUDIO_LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST`, so moved to `64_001`.

### Real — NOT fixed, reported instead (2)

`runtime/tests/service-adaptation/tests/iterating-recovery.test.ts`, both cases:
"completes a diagnose_and_adapt / explore_and_adapt recovery that stages a
diagnosis, gathers evidence and then answers".

```
expected [ Array(2) ] to deeply equal [ 'runtime_diagnosis', …(3) ]
- "evidence_tool_decision",
- "evidence_tool_decision",
```

The run makes the diagnosis call and the patch call and **skips both exploration
calls**. This is not the `explorationNeeded` default: the scripted diagnosis reply
sets `explorationNeeded: true` explicitly, and the plan stage records
`explorationRequested: true`. I instrumented the test to print the recovery trace,
then reverted the instrumentation. The trace says:

```
{ "stage": "exploration", "status": "failed", "providerCalled": true,
  "reason": "The run's own LLM budget could not pay for the next exploration
             decision, so the exploration stopped.",
  "detail": { "requested": true, "outcome": "budget_exhausted",
              "endedBy": "llm_budget.run_total_limit", "actions": 0,
              "providerCalls": 1, "evidenceBytes": 0 } }
```

The arithmetic, from `runtime/recovery/annotation/run-budget.ts`,
`annotation/patch-reserve.ts` and `runtime/llm/run-budget.ts`:

- The recovery ledger's pot is `min(64_000 x 26, grant's 100_000, 56_000 x 26)` =
  **100,000** — the grant's run budget binds, and it did not move.
- Before the exploration starts, `holdAutomationStudioRecoveryPatchReserve` reserves
  the patch's worst case: `maxInputTokens + maxOutputTokens` = 48,000 + 8,000 =
  **56,000**, held for the whole exploration.
- That leaves **44,000**, and each exploration decision reserves up to 56,000 on the
  same ledger. So `state.totalTokens + reserved + requested > maxTotalTokensPerRun`
  fires on the very first decision: **zero exploration decisions can ever fit under
  a default grant.**

With the old 8,000/2,000/10,000 limits the same sum was 10,000 held plus 10,000 per
decision against the same 100,000 pot — roughly eight decisions' headroom. So this
is caused by change 1, and it defeats change 2 on the default path: the
`explorationNeeded` fix now correctly asks to explore, and the budget refuses every
time.

I did not edit these tests, because making them green would mean asserting that a
default-grant recovery never explores — the exact failure the `explorationNeeded`
work was done to end.

**This needs a production decision, not a test edit.** The three candidates I can
see, in the order I would try them: raise the grant's default `maxTotalTokensPerRun`
(which requires `AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD` to move
with it, or every default adaptation starts demanding confirmation); size the patch
reserve and the exploration requests to a smaller per-call limit than the grant's
maximum, since an evidence decision is not a 48,000-token request; or make the pot
scale with the per-call limit rather than being pinned at the confirmation
threshold. All three are production changes and outside my brief.

### Load artefacts — not real (2)

Both fail only inside the whole-program run and pass when run alone, so I am not
calling either one real:

- `runtime/tests/service-flows/tests/instruction-readiness.test.ts` — "Test timed
  out in 15000ms" under load; **4,049 ms and passing** run alone.
- `runtime/tests/deepseek-bootstrap-exploration.test.ts` — "asks again after a
  decision that runs past its deadline", "expected { …(7) } to be undefined", 17.1 s
  under load; the whole file (8 tests) **passes alone**, that case included.

The whole-program run reports `tests 1293.32s` of test time inside a 166 s wall
clock, so it is heavily oversubscribed, and live campaigns are running against this
checkout. Both are deadline-sensitive cases.

## Files changed (test files only)

- `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\llm\tests\execution-grants.test.ts`
- `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\llm\tests\execution-grant-failures.test.ts`
- `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\recovery\tests\plan.test.ts`
- `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\api\contracts\tests\llm.test.ts`
- `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\api\handlers\tests\llm-execution-settings.test.ts`
- `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\api\handlers\tests\llm-generation.test.ts`

Note for the supervisor: the working tree already carried uncommitted production
changes from other in-flight work (`llm-generation.ts`, `generation-failure.ts`,
`harness/*`, `provider-contract.ts`, `service.ts`, `loop-limits/*`, new
`result-verification/` and `diagnosis-instructions.ts`), and uncommitted test
changes in four other files. None of those are mine. The token-limit change itself
is split: the grant `LIMITS` and `structured-diagnosis.ts` are in commit `37679ce`,
while the API settings bound and the accounting bound are uncommitted.

## Commands run, and what they printed

All run from inside `F:\!FluxIQ\packages\fluxiq`, never a repository root.

**The two named suites, before:**
```
Test Files  3 failed | 47 passed (50)
     Tests  8 failed | 643 passed (651)
```

**The two named suites, after:**
```
Test Files  50 passed (50)
     Tests  651 passed (651)
     Duration  6.54s
```

**`npx vitest run src/programs/automation-studio`, before my API fixes:**
```
Test Files  6 failed | 237 passed (243)
     Tests  9 failed | 2173 passed | 1 skipped (2183)
```

**`npx vitest run src/programs/automation-studio`, after (the full program run the
brief asked for):**
```
× AutomationStudioService iterating recovery > completes a diagnose_and_adapt recovery
  that stages a diagnosis, gathers evidence and then answers  14590ms
  → expected [ Array(2) ] to deeply equal [ 'runtime_diagnosis', …(3) ]
× AutomationStudioService iterating recovery > completes a explore_and_adapt recovery
  that stages a diagnosis, gathers evidence and then answers  14087ms
  → expected [ Array(2) ] to deeply equal [ 'runtime_diagnosis', …(3) ]
× AutomationStudioService instruction readiness summaries > finds one active applicable
  instruction beyond an unfiltered 100-item page…  15013ms
  → Test timed out in 15000ms.
× creating a Flow through an exploration, under a real grant > asks again after a
  decision that runs past its deadline  17145ms
  → expected { …(7) } to be undefined

Test Files  3 failed | 240 passed (243)
     Tests  4 failed | 2178 passed | 1 skipped (2183)
     Duration  166.62s
```

**`npx vitest run src/programs/automation-studio/api`, after:**
```
Test Files  15 passed (15)
     Tests  57 passed (57)
```

**Isolated reruns of the two load-sensitive files:**
```
src/.../instruction-readiness.test.ts   1 passed (1)   4049ms
src/.../deepseek-bootstrap-exploration.test.ts   8 passed (8)   46.60s
```

**`npx tsc --noEmit -p tsconfig.json`** — no output, `tsc exit: 0`.

## Not verified

- **No live provider run.** Everything here is scripted-endpoint and unit level. The
  brief's live evidence (thirty-six creation tasks, thirteen repair runs) is not
  something I re-measured.
- **The exploration starvation is measured only on the scripted path.** I have not
  established why the brief's live repair run explored twice and succeeded while the
  default-grant path here cannot reserve a single decision. The most likely reason is
  that the live campaign issues its grant with an explicit, larger
  `maxTotalTokensPerRun` — the brief lists "the campaign's own arguments" as one of
  the seven places a ceiling lived — but I did not read the campaign's arguments to
  confirm it. If that is so, the default path is broken and the live path is not,
  which is the worst shape for this kind of defect.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run**, and neither was the
  structure audit. The brief named four commands and I ran those.
- **Core was not rebuilt** and nothing was committed, per the brief.
- The two load artefacts are judged on one clean isolated run each. That is the
  brief's own rule for this machine, but it is a single observation in each case.

## Open questions and contradictions found

1. **The main one.** Does the supervisor accept that
   `iterating-recovery.test.ts` is now failing for a real reason, and which of the
   three production fixes is wanted? Until one lands, a default-grant recovery
   diagnoses and patches but can never look at the page first.
2. **The confirmation threshold did not move with the limits.**
   `AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD` is still 100,000, and
   the default grant's run budget lands exactly on it (26 x 56,000 held to the
   threshold). That is what keeps "no confirmation for a default adaptation" true,
   and it is also what caps the pot that is now starving exploration. The two
   properties are in direct tension and only one of them can be kept as it is.
3. **The brief said seven places; I saw the effects of six.** The seventh, the
   campaign's own arguments, lives in the web-extension repository and I did not
   look at it. If it still passes a 50,000 or a 40,000 run budget, it is now below
   the 56,000 per-call floor and the campaign will fail at preflight with "LLM total
   token limit is invalid." Worth checking before the next campaign starts.
