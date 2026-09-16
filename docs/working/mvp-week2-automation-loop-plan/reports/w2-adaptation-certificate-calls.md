# Report: w2-adaptation-certificate-calls

## Outcome

**Partial.** The certificate side is finished and green. The two remaining steps are outside my files.

- **What works now.** The adaptation certificate records whatever number of provider calls a run actually made, within the grant. Every call gets its own record: the diagnosis first, any evidence-gathering calls in between, then the patch. A five-call run certifies with a count of 5 and five records.
- **Why it is Partial.**
  1. **The refusal the brief asked me to remove is not in the control module.** It is in `demo-workspace/adaptation-lane.ts:84-90`, which I must not touch. `demo-llm-adaptation-control.ts` never had a "calls must equal interventions" check; its `requireSourceRun` checks only the intervention shape and the grant.
  2. **The lane must now pass the run's call count to the certificate.** The certificate requires a new top-level `providerCallCount` input field. Without it, `pnpm demo:llm:adapt` fails at its very last step, after review, apply and both validation runs, with "missing or unsupported fields". **Type checking cannot catch this**, because `evaluateDemoLlmAdaptation` takes `unknown`. The exact diff is below.
  3. **Even with that diff, `demo:llm:adapt` still cannot certify an iterating run end to end.** Core's run detail, as this repository parses it, gives no per-call record for an evidence-gathering call. See Open questions, item 1.
- **Checks.**
  - `pnpm check`: exit 0.
  - test-runner: 980 of 980 pass (976 before, 4 new).
  - `node scripts/structure-audit.mjs`: passed, 57 warnings (unchanged), none on my files.

## What changed and why

**`packages/test-runner/src/demo-llm-adaptation.ts`** (the certificate; 357 → 392 lines)

- **Input.**
  - New required top-level field `providerCallCount`: the adapting run's own reported count, passed through unchanged.
  - `invocations` is now typed `[diagnosis, ...evidence[], patch]` in place of a fixed pair.
  - New purpose value `runtime_evidence`.
- **Parser** (replaces the "exactly two" check).
  - `providerCallCount` must be a nonnegative safe integer.
  - `invocations` must be an array of at least 2.
  - **`invocations.length === providerCallCount`**, otherwise refused with "…records N provider invocations, but the run made M provider calls; every call must be recorded". This is the check that replaces the lane's refusal. An understated certificate and an overstated one are both refused.
  - Position 0 must be `runtime_diagnosis`, the last position `runtime_patch`, and every position in between `runtime_evidence`. That is exactly one diagnosis and exactly one patch.
  - Diagnosis and patch keep their pinned prompt versions. An evidence call's prompt version must be a safe identifier and must not be the diagnosis or patch prompt, since that would be a second diagnosis or patch in disguise.
  - Request IDs must be distinct across all invocations.
  - Every invocation still requires `attempt: 1`, `retryCount: 0`, `providerCallCount: 1`, provider `deepseek` and model `deepseek-chat`.
- **Evaluation.**
  - **Grant check.** Calls `adaptationCallCountWithinGrant({ providerCallCount, interventions: [diagnosis, patch] })`, which reuses the rule rather than restating it. The diagnosis and patch are the run's two interventions; evidence calls leave none.
  - **Budget.** The per-call budget applies to every invocation, evidence calls included.
  - **Ordering.** The ordering check is generalized: failure < every invocation in recorded order < apply < first validation, each strictly increasing.
  - **Binding.** The applied adaptation must still be bound to the last (patch) invocation's request ID.
- **Result.**
  - `providerCallCount` is the observed number. It is no longer the literal `2`.
  - New additive field `evidenceCallCount`.
  - `evaluation.invocations` holds one provenance record per call.
  - The first reason now states the breakdown ("5 provider calls: one diagnosis, 3 gathering evidence, and one patch").
- **Unchanged.** Validation runs and the final replay still require 0 provider calls, 0 interventions, 0 diagnoses and 0 adaptations. Recording-provenance and recording-count checks are also unchanged.

**`packages/test-runner/src/demo-llm-adaptation-control.ts`**

- **Import removed.** It no longer imports `FIRST_LIVE_ADAPTATION_PROFILE` from the certificate.
  - The certificate now imports this module, so keeping that import would have closed a module cycle. The Current State records two cycle bugs this week in which a value read at load time came back `undefined`.
- **Ceiling source.** `adaptationCallCountWithinGrant` now reads its ceiling from `DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun`.
  - The value is identical (26): the profile's ceiling is defined as that constant (`demo-llm-adaptation.ts:38`).
  - The Lab's drift test holds Core's grant default equal to it (`live-llm/tests/live-llm-plan.test.ts:184`).
- **Parameter type widened.** It was `Pick<ExistingRunDetail, …>`; it is now `Readonly<{ providerCallCount?: number; interventions?: readonly unknown[] }>`, because only the length of `interventions` is read.
  - Existing callers pass run details and are unaffected; `pnpm check` confirms this.
- **No refusal removed.** There was nothing to remove here (see Outcome).

**Tests.** Existing tests were updated; none was deleted.

- **`tests/demo-llm-adaptation.test.ts`**
  - Fixture change: `validInput` gains `providerCallCount: 2`.
  - New helper: `withEvidenceCalls(input, n)` inserts n evidence calls and renumbers the later sequences.
  - The two-call test now also asserts `evidenceCallCount: 0` and the two request IDs.
  - **New:** a certificate with a diagnosis, three evidence calls and a patch validates. It records five invocations in order, with a count of 5, per-call tokens and cost, and the reason text.
  - **New:** call count disagreeing with invocations is refused: understated (5 vs 2), overstated (2 vs 5) and off by one (6 vs 5). A missing count is refused, and a non-integer, negative, string, NaN or null count is refused.
  - **New:** 26 calls certify; 27 are refused by the grant check.
  - **Rewritten** (formerly "requires exactly diagnosis then patch calls"). These inputs are refused:
    - two patches, with or without evidence between;
    - two diagnoses;
    - no diagnosis;
    - patch first, diagnosis last, evidence last, or diagnosis and patch swapped;
    - fewer than two invocations, or `invocations` not an array;
    - a retry, attempt or call-count violation on the patch or on an evidence call, or a wrong provider or model;
    - a per-call budget breach on an evidence call;
    - an evidence call carrying the diagnosis or patch prompt, or an unsafe prompt string;
    - duplicate request IDs across evidence, diagnosis and patch;
    - an adaptation bound to an evidence call's request.
  - **Ordering test extended** with seven evidence-sequence violations.
  - **Persistence test** also persists and re-reads a five-call certificate.
- **`tests/demo-llm-adaptation-control.test.ts`**
  - The grant-rule test also accepts the certificate's argument shape: 2, 5 and 26 calls pass; 1 and 27 fail.
  - **New source-level guard:** `demo-llm-adaptation-control.ts` must not import `./demo-llm-adaptation.js`, and the certificate must import the rule from the control module. This makes the cycle fail a test rather than rely on a comment.

## Required change in a file I do not own

**`packages/test-runner/src/demo-workspace/adaptation-lane.ts`**

1. **Required: pass the run's count** in the `evaluateDemoLlmAdaptation({ … })` call (line 136-137, between `failedAction` and `invocations`):
   ```ts
   providerCallCount: failedRun.providerCallCount,
   ```
   If the value is `undefined`, the certificate refuses with "accounting must be finite nonnegative integers". It never defaults the value.
2. **Recommended: keep the early refusal at lines 84-90, but replace its comment and message.** The current comment says the certificate "records one invocation per intervention and no calls in between", which is no longer true.
   - **Why keep it.** The certificate now refuses an understated run itself, but only at the end, after human approval, apply (which changes the Flow) and two validation runs. The lane can only itemize the calls that left an intervention, so the same condition remains the right guard before anything changes. Suggested text:
   ```ts
   // The certificate (`demo-llm-adaptation.ts`) needs one record for every
   // provider call, and the run detail itemizes only the calls that left an
   // intervention. Refuse here, before review and apply, rather than have the
   // certificate refuse after the Flow has changed.
   if (failedRun.providerCallCount !== interventions.length) {
     throw new RunnerFailure("runtime.behavior", `Adaptation run made ${failedRun.providerCallCount} provider calls, but its run detail itemizes only the ${interventions.length} that left an intervention; the certificate needs a record for every call`);
   }
   ```
   - **Later.** Once per-call evidence records exist, build `[diagnosis, ...evidence, patch]` before this point, compare against that list's length, and pass the same list as `invocations`.
3. **Suggested follow-up guard,** once item 1 is applied: a source-level test in `demo-workspace/tests/`, asserting that the lane's certificate input contains `providerCallCount: failedRun.providerCallCount`. I did not add it because it would fail today.

**`docs/architecture/testing-facility.md`** (Live LLM Safety Envelope). The `demo:llm:adapt` exception paragraph should say:

- the certificate records one invocation per call and any count within the grant;
- the lane still refuses an iterating run, because the run detail does not itemize evidence calls.

## Commands run and observed results

| Command | Result |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/test-runner check` | exit 0 |
| `pnpm --filter @fluxiq-web-extension/test-runner test`, first run | exit 0; `# tests 980 # pass 980 # fail 0`; all 4 new tests, plus the renamed test, `ok` |
| `pnpm check`, first run | exit 0; `structure-audit: passed (58 warning(s), 17 baselined)` |

**Negative probes.** For each probe I copied the source to a scratch file, edited one guard, rebuilt, ran `node --test dist/tests/demo-llm-adaptation.test.js`, and restored the file. The sha1 was `0004e322…` before and after.

| Probe | Result | Failing test(s) |
| --- | --- | --- |
| Equality check disabled | `# pass 11 # fail 1` | "refuses a certificate whose call count disagrees…" |
| Grant check disabled | `# pass 11 # fail 1` | "certifies up to the grant's ceiling and refuses a call count past it" |
| Result count hardcoded to `2` | `# pass 9 # fail 3` | the evidence-certification test, the ceiling test, the persistence test |

- **Build exit codes.**
  - The first probe's build exited 2, with `TS18046` at the probe's own `false &&` edit, which broke type narrowing. tsc still emitted, and the test result shows the probe took effect.
  - The other two probe builds exited 0.
- **After the probes.** A rebuild from the restored source exited 0; `dist/demo-llm-adaptation.js` contains `providerCallCount: parsed.providerCallCount` twice (the grant call and the result).

**The 58th warning was mine, and it is fixed.**

- `demo-llm-adaptation.ts` had reached 401 lines, past the 400-line advisory.
- I collapsed two multi-line literals, and the file is now 392 lines.
- Then:

| Command | Result |
| --- | --- |
| `node scripts/structure-audit.mjs` | exit 0; `passed (57 warning(s), 17 baselined)`; no warning names any file I touched |
| `pnpm check`, final | exit 0; structure-audit tests `96/96`; Lab tests `15/15`; `passed (57 warning(s), 17 baselined)`; all 10 workspace checks `Done` |
| `pnpm --filter @fluxiq-web-extension/test-runner test`, final | exit 0; `# tests 980 # pass 980 # fail 0 # cancelled 0` |

**Git status.** `git status --short` shows my four files modified. The `demo-workspace/` files listed there were already modified at session start, by the previous worker, and I did not edit them.

## Not verified

- **No demo, `pnpm lab` or `--live-llm` command was run,** as the brief required. Nothing here shows `demo:llm:adapt` certifying a real run, iterating or not.
- **The evidence call's prompt version is not pinned.** I did not read Core, and this repository names no evidence prompt. The fixture value `automation-studio.runtime-evidence.v1` is invented.
- **The ordering is assumed:** diagnosis, then evidence, then patch, with the diagnosis intervention's event sequence before every evidence call. This follows the brief's wording and the previous report. If Core gathers evidence before it records the diagnosis, or writes the diagnosis intervention's event after the evidence loop, the certificate will refuse such a run with "ordering is invalid". It fails closed, not open.
- **Run totals are not checked.** The certificate does not check run-wide tokens or cost against Core's aggregate `llmAccounting`. Per-call budgets apply to every recorded call, and nothing caps the sum.

## Open questions or contradictions found

1. **`demo:llm:adapt` has no data source for evidence calls.**
   - What the run detail offers:
     - `ExistingRunDetail` (`existing-fluxiq-control.ts:31`) itemizes only `interventions`, whose kind enum has no evidence kind.
     - It gives aggregate `llmAccounting { calls, inputTokens, outputTokens, totalTokens, estimatedCostUsd, budgetBreaches, pendingCalls }`.
     - `ExistingRunEvent.eventKind` has no provider-call kind.
   - So the lane has no request ID, prompt version, tokens, cost or event sequence for any evidence call.
   - Two ways forward:
     - **(a) Recommended:** Core itemizes every provider call in the run detail and the client parses it. This is a Core change, and it keeps the certificate's per-call records honest and ordered.
     - **(b)** The certificate accepts an unitemized aggregate block taken from `llmAccounting`, minus the itemized calls. This gives up per-call ordering and identity.
   - Whether Core already stores such records is unknown, because I did not read Core.
2. **The brief located the refusal wrongly.** It said the refusal was in `demo-llm-adaptation-control.ts`; it is in `demo-workspace/adaptation-lane.ts:88`.
3. **Consider cross-checking `llmAccounting`.** The certificate could also take the run's `llmAccounting` and require `calls`, `totalTokens` and `estimatedCostUsd` to equal the sums over its invocations. That would guard understated tokens and cost as well as understated calls, and it fits naturally with option (a).
