# w2-threshold-test-fixes — Core tests pinning the high-token confirmation threshold

## Outcome

Done. All nine failing cases were stale assertions. None indicated a production
problem. The production change (`AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD`
= `LIMITS.maxTotalTokens * 10` = 560,000) was not touched; only test files changed.

One thing the supervisor needs to know that is **not** about this task:
`F:\!FluxIQ` was being merged while this work ran, and
`packages/fluxiq/src/programs/automation-studio/runtime/service.ts` is still left
**unmerged in the index** (`UU`) although `.git/MERGE_HEAD` is gone. The file has
no conflict markers, so the resolution is in the working tree but was never
staged. `git commit` will refuse until someone runs `git add` on it. I did not
touch it. Details under "The tree moved underneath this task" below.

## What changed and why

Four test files. Every number that used to be the literal `100_000` now comes
from the exported constant or is derived from the per-call limit, so the next
change to the per-call limit cannot silently invalidate them again — which is
exactly how this sequence started.

### 1. `AS/runtime/llm/tests/execution-grants.test.ts` — six cases, all stale

Added `AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD` to the imports and
two file-level constants with a comment explaining why the number is no longer
written here:

```ts
const THRESHOLD = AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD;
const THRESHOLD_LABEL = THRESHOLD.toLocaleString("en-US");
```

`THRESHOLD_LABEL` is interpolated into the titles, so a title can never again
state a number the code does not use. The rendered titles were checked with
`--reporter=verbose` and now read "… exceeds 560,000 total tokens", "… exceeds
560,000 tokens" and "issues a default <purpose> grant as 26 calls, 560,000 tokens
and $2.00, with no confirmation". The locale is pinned to `en-US` so the
thousands separator does not depend on the machine.

- **"requires explicit confirmation when a future supported profile exceeds
  100,000 total tokens"** → title now says 560,000. The mocked profile moved from
  `maxTotalTokens: 100_001` to `THRESHOLD + 1`, keeping the intent: a value above
  the threshold demands confirmation. 100,001 is now well below the threshold, so
  weakening the assertion instead would have proved nothing.
- **"requires confirmation only when the run's token budget exceeds 100,000
  tokens"** → title now says 560,000, and the body was rewritten. It used to use
  3 calls of 33,333/33,334 tokens to straddle 100,000. The per-call ceiling is
  64,000, so three calls can no longer reach 560,000 at all. The case now reads
  the per-call default from a real preflight, computes
  `callsToThreshold = THRESHOLD / perCall`, asserts it is 10, and straddles the
  threshold with 9 calls (under) and 11 calls (held down to it). That is the
  threshold's own arithmetic rather than chosen numbers, and it states the design
  — "ten full calls" — instead of restating a product.
- **"issues a default … grant as 26 calls, 100,000 tokens and $2.00"** (three
  `it.each` cases) → title and both `maxTotalTokensPerRun` assertions now use
  `THRESHOLD`. Added `expect(THRESHOLD).toBe(grant.tokenLimits.maxTotalTokens * 10)`
  so the case fails if the threshold ever stops being ten calls. The comment block
  above it, which said "The run budget is still 100,000 … so it did not move with
  the per-call limits", was rewritten to say that the threshold is ten of those
  calls and that a fixed 100,000 beside a 56,000-token call was under two calls'
  worth.
- **"issues an exact-revision adapt grant whose call count is configuration, not
  the purpose's identity"** → its three `100_000`/`100_001` literals became
  `THRESHOLD` and `THRESHOLD + 1`. This title carries no number, so it was left.

### 2. `AS/api/contracts/tests/llm.test.ts` — one case, stale

`expect(AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD).toBe(100_000)`
became `.toBe(preflight.tokenLimits.maxTotalTokens * 10)`, placed after the line
that already pins those limits to 48,000/8,000/56,000, so the derivation is
anchored on both ends. The expected `maxTotalTokensPerRun` became the constant.
Two comments that named 100,000 were rewritten.

### 3. `AS/api/handlers/tests/llm-generation.test.ts` — one case, stale

"forwards a caller's lower run token budget, which the grant stores and returns."
The caller's 60,000 is still lower than the new 560,000 default, so it still
proves what it proves and was left as it is. The defaulted expectation became the
imported constant. Added
`expect(limits.maxTotalTokensPerRun).toBeLessThan(AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD)`
so that "lower" is enforced mechanically rather than by a comment — if the
per-call limit ever drops far enough that 60,000 stops being the lower number,
this fails rather than quietly testing nothing.

### 4. `AS/runtime/tests/recovery-grant-limits.test.ts` — one case, stale, and it was not proving what the brief says it exists to prove

Read carefully, as instructed. What it actually contained was
`expect(AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD).toBe(100_000)` —
a literal pinned to a literal. It did **not** exercise the recovery ledger, the
patch reserve or the exploration at all, so it could not have caught the
regression it is named for, and simply changing 100,000 to 560,000 would have left
it just as blind.

It now walks the property end to end, using production code on both sides:

1. a default `diagnose_and_adapt` preflight from the real
   `AutomationStudioLlmExecutionGrantService`;
2. `resolveAutomationStudioRecoveryRunBudget` turning that grant into the
   recovery's ledger limits;
3. `holdAutomationStudioRecoveryPatchReserve` setting the patch's share aside on a
   real `AutomationStudioLlmRunBudgetLedger`, as a recovery does;
4. a loop reserving exploration decisions at a whole call's worst case until the
   ledger refuses one, then asserting `decisions > 0` and
   `decisions === THRESHOLD / perCall - 1`.

Observed count: **9** (ten calls in the pot, one held for the patch). Under the
old literal the same walk yields **0**: the pot was 100,000, the patch reserve
holds `maxInputTokens + maxOutputTokens` = 56,000, and the next 56,000 reservation
crosses 100,000. That is precisely the failure the brief describes, and the case
now fails if it returns. The comment block says so.

The `async` keyword was added to the case, and
`IdentityAccessService`/`SecretKeysService` type imports plus a
`defaultAdaptGrantLimits()` helper (modelled on the one in
`api/contracts/tests/llm.test.ts`) were added at the foot of the file.

## Commands run and observed results

All run from inside `packages/fluxiq`, never a repository root.

**Baseline, before any edit** — `npx vitest run` on the four named files:
`Test Files 4 failed (4)`, `Tests 9 failed | 41 passed (50)`. The nine were
exactly the nine the brief predicted. Sample diff:
`- "maxTotalTokensPerRun": 100000` / `+ "maxTotalTokensPerRun": 560000`.

**After the edits** — same four files:

```
 ✓ runtime/llm/tests/execution-grants.test.ts (27 tests) 72ms
 ✓ runtime/tests/recovery-grant-limits.test.ts (3 tests) 4ms
 ✓ api/contracts/tests/llm.test.ts (4 tests) 5ms
 ✓ api/handlers/tests/llm-generation.test.ts (16 tests) 33ms
 Test Files  4 passed (4)
      Tests  50 passed (50)
```

**Full program run** — `npx vitest run src/programs/automation-studio`:

```
 Test Files  2 failed | 246 passed (248)
      Tests  2 failed | 2214 passed | 1 skipped (2217)
   Duration  177.77s (... tests 1429.34s ...)
```

The two failures were `service-bootstrap/tests/adaptation.test.ts > bridges a
generated proposal ID through the standard Adaptation Audit get, approve, and
apply endpoints` and `service-flows/tests/scale-pages.test.ts > persists Flow
expansion summaries with paged run and adaptation detail reads`. Both are
wall-clock budgets, and 1,429 s of test time inside a 177 s wall clock is the
oversubscription the brief warned about. Run alone, both pass:

```
 ✓ service-flows/tests/scale-pages.test.ts (3 tests) 15462ms
   ✓ ... pages and filters 10,000 Subflow summaries within the local directory budget 1027ms
 ✓ service-bootstrap/tests/adaptation.test.ts (9 tests) 17415ms
 Test Files  2 passed (2)
      Tests  12 passed (12)
```

Note that the case the brief told me to expect and ignore — "pages and filters
10,000 Subflow summaries within the local directory budget" — passed in the full
run and passed alone in 1,027 ms. The two that did fail under load are different
cases, one of them in the same file. Neither touches token budgets, grants or
recovery.

**Type check** — `npx tsc --noEmit -p tsconfig.json`: no output, exit 0.

Core was not rebuilt. Nothing was committed.

## The tree moved underneath this task

Partway through, `F:\!FluxIQ` changed while I was running the full suite. The
harness handed me file snapshots showing *older* content than I had started from
(the pre-56,000 per-call limits, `maxTotalTokensPerRun: 40_000`), and a solo run
of `service-flows/tests/runs.test.ts` failed to load
`runtime/result-verification/index.ts`, a file that exists now. The reflog shows
three task merges (`t005-exploration-state`, `t006-resumable-caller`,
`t007-adaptation-confidence`) landing on `dev` during that window, so those reads
caught the tree mid-merge. My edits were all still on disk afterwards and the
production constant was untouched; I verified each of the four files and re-ran
everything on the settled tree, which is what the results above are from.

Two consequences worth recording:

- **An earlier full-suite run is not trustworthy.** The run I made during the
  merge reported 243 files / 2,183 tests and one failure
  (`service-flows/tests/runs.test.ts`, a 1,959 ms elapsed against a 1,500 ms
  budget). The settled tree has 248 files / 2,217 tests. I am reporting only the
  later run. This is the exact hazard `AGENTS.md` describes under worktrees: a
  validation run reading a tree someone else is editing reports false failures.
- **`runtime/service.ts` is left unmerged in the index.** `git status` shows
  `UU packages/fluxiq/src/programs/automation-studio/runtime/service.ts` while
  `.git/MERGE_HEAD` is absent. The working-tree copy has no conflict markers and
  `git diff` shows a resolved 14-insertion/8-deletion change, so the resolution
  exists but was never `git add`ed. Until it is staged, `git commit` will refuse.
  I left it alone — it is production code, not mine to touch, and not part of
  this brief.

## Not verified

- Live browser or live-provider behaviour. No DeepSeek call was made; the grant
  tests use the fixture's scripted `fetchImpl`.
- The wider repository: I ran `src/programs/automation-studio` and
  `tsc -p tsconfig.json` for `packages/fluxiq` only, not `pnpm check`,
  `pnpm test` or `pnpm build` across the workspace, and not the downstream
  extension repository.
- That the two load-artefact failures are *only* load artefacts. Each was
  observed failing once under a full run and passing once alone, on a machine
  with known-faulty RAM; that is one observation each way.
- Whether the unmerged `service.ts` index entry is mid-flight supervisor work or
  a leftover. I observed the state and did not act on it.
- The full suite has not been run since the tree settled *and* stayed still for a
  whole run without another agent editing it; my last full run began after the
  merges appeared complete, but I cannot prove nothing changed during its 178 s.

## Open questions or contradictions found

1. The brief said `recovery-grant-limits.test.ts` "exists to prove exactly the
   property that was broken and is now fixed". It did not — it pinned one literal
   to another and exercised no ledger. I made it prove the property rather than
   merely making it green, and reported the count it now produces (9, against 0
   under the old threshold). If the intent was a minimal literal swap, this is
   larger than that, and it is the one place I went beyond a one-for-one edit.
2. The load artefact named in the brief is not the one that failed. The brief
   named `scale-pages.test.ts > pages and filters 10,000 Subflow summaries`; that
   case passed. Two different cases failed under load and passed alone. The class
   of failure is the same, so I treated them the same way, but the specific
   guidance did not match what happened.
