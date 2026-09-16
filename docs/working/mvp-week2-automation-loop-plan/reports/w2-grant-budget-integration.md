# Report: w2-grant-budget-integration

Repository changed: FluxIQ Core, `F:\!FluxIQ`. `AS/` = `packages/fluxiq/src/programs/automation-studio/`.
Nothing was committed or pushed. The Secret Keys service was **not** edited. Nothing in `apps/web/**` was touched. In this repository, only this report file was written.

## Outcome

**Done.** All five brief items and both coordinator additions are in place:

- the grant's claim window no longer caps a claimed run;
- the handler passes `maxTotalTokensPerRun` through and the grant returns it.

Required checks:

- **Core `pnpm check`:** exit 0.
- **Runtime suite:** 958/959, twice. The one failure is `instruction-readiness.test.ts` hitting the 15 s test timeout under full-suite load (15,004 ms and 15,003 ms). The test does not touch any changed code, and it passes alone in 5,025 ms.

Required tests:

- The default-grant test (26 calls, 100,000 tokens, $2.00, no confirmation prompt) exists and passes for all three iterating purposes.
- The patch-reserve test exists and passes, and fails when the hold-back is disabled.

## Worst-case cost of one recovery (new)

These are estimates, from the ledger's estimated-cost accounting and DeepSeek's peak prices ($0.44/M input, $1.32/M output).

| Recovery | Calls | Tokens | Estimated cost ceiling | Wall clock |
| --- | --- | --- | --- | --- |
| Default adapting grant (`diagnose_and_adapt` or `explore_and_adapt`, no numbers named) | ≤ 26: 1 diagnosis, ≤ 24 exploration decisions, 1 patch | ≤ 100,000 total, of which ≤ 52,000 output. Enforced by the run ledger and again by the grant. | **$2.00** (ledger and grant). Each call reserves $2/26 ≈ $0.0769. | Recovery deadline **600 s**. Grant lease 600 s from claim. Per-call timeout unchanged (20 s default, 45 s max). |
| Confirmed maximum grant | ≤ 64 | ≤ 640,000, of which ≤ 128,000 output | $2.00 | 600 s |
| No grant (training mode) | backstop 250; exploration ≤ 24 | ≤ 144,000 | $0.25 | **600 s** (was 120 s) |
| `diagnosis_only` grant | 1 | 10,000 | $0.25 | 600 s |

What that means in real money:

- **Default grant:** the token budget binds long before the $2.00 estimate. The priciest way to spend 100,000 tokens is 52,000 output plus 48,000 input, about **$0.09** at peak DeepSeek prices.
  - DeepSeek refuses replies above a call's token limits, so the "one call's overage" caveat from the earlier report cannot happen with DeepSeek.
- **Confirmed maximum grant:** about **$0.39** at peak prices.
- **No grant:** $0.25 at most. By tokens alone, about $0.06 to $0.19.

## What changed and why

### 1. Grant default of 26 calls, with a grant token budget (`AS/runtime/llm/execution-grants.ts`)

- **The default.** `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_DEFAULT_MAX_CALLS = 26`, written as a literal.
- **The new field.** `maxTotalTokensPerRun` was added to the requested limits, the grant metadata (and so the stored record and `publicGrant`) and the `resolve()` result.
- **How `preflight` computes it.**
  - Default: `max(perCall, min(perCall × calls, 100,000))`.
  - A supplied value must be a safe integer between one call's limit and every call's limit, or preflight throws `LLM total token limit is invalid.`
  - `max(perCall, …)` is the only difference from the report's formula. It keeps a future per-call profile above 100,000 valid.
- **The confirmation in `issue()`** keys on `max(maxTotalTokensPerRun, per-call limit)`. So many calls alone never prompt, and a run budget above 100,000 always does.
- **`AutomationStudioLlmProviderResolution`** in `AS/runtime/service.ts` gained `maxTotalTokensPerRun?`.

**Addition beyond the report: the grant enforces its own token budget.**

- *Why it was needed.* Flow Bootstrap has no run ledger. Without this, a default 26-call `build_and_adapt` grant issued with no confirmation could spend 26 × 10,000 = 260,000 tokens, which is exactly the exposure the confirmation exists for.
- *How it works.*
  - `claimCall` refuses a call when the tokens already used plus this call's worst case would cross the budget. The worst case is `min(maxTotal, maxInput + maxOutput)`. The refusal says `LLM execution total token limit exceeded.` and revokes the grant, as the existing cost refusal does.
  - `commitCall` charges what the call reported (a consistent report, capped at its worst case), or the worst case if the report is missing or inconsistent.
- *Why a recovery still stops on a named limit.* The grant's charge per call and its budget are never stricter than the run ledger's, so in a recovery the ledger always refuses first, with a named code.
- *Why this is not a new call cap.* Charging on real usage rather than summed reservations avoids the 10-call cap the report warned about.

### 2. The patch always keeps its share

- **New module:** `AS/runtime/recovery/annotation/patch-reserve.ts`.
- **When it applies.** A patch will follow when there is a patch request, a provider, a runtime Flow, a failed attempt, and `createAdaptations`.
- **What it does.** Before the exploration starts, it reserves one patch-sized call on the run ledger: the patch's token limits and its per-call cost. It releases that reservation in a `finally` just before the patch.
  - While the hold stands, the ledger refuses exploration decisions that would eat into it, on the ordinary named codes. This covers calls, tokens and money together.
  - A hold the run cannot afford is not taken.
- **Declared call counts.** When a call count is declared, the exploration budget's `maxProviderCalls` is `declared − calls already made − 1`. `maxActions` becomes `max(default 24, that + 1)`, so actions never bind before calls do.
- **Supporting changes.**
  - The recovery run budget (`AS/runtime/recovery/annotation/run-budget.ts`) now reports `declaredCallsPerRun`.
  - Run-ledger leases (`AS/runtime/llm/run-budget.ts`) gained `release()`: the reservation is dropped with nothing charged, and a lease settles once.
  - `annotate.ts` computes `patchWillFollow` once and uses it for both the hold and the patch.

### 3. `explore_and_adapt` gets its grant's budget (`annotate.ts`)

- `explicitGrantBudget` now includes `explore_and_adapt`.
- The diagnosis and patch requests now carry `executionPurpose: "explore_and_adapt"`. DeepSeek narrows patches only for `diagnose_and_adapt`, so this changes nothing on the provider side.
- **Behaviour change.** Like `diagnose_and_adapt`, an `explore_and_adapt` run now proceeds when the training budget decision says it is exhausted, and it is held to the grant's purse.

### 4. Recovery deadline of 10 minutes

- `AUTOMATION_STUDIO_RECOVERY_MAX_DURATION_MS` went from 120,000 to 600,000 ms. The ceiling is unchanged at 600,000.
- The exploration budget's default `maxDurationMs` now reads that constant. It was a separate literal of 120,000, which would have become the next hidden cap.
- The per-call timeout is unchanged. No test pinned 120 s.

### 5. Flow-creation caps

- **New module:** `AS/runtime/loop-limits/flow-bootstrap-evidence-loop.ts`. It does arithmetic only and has no `llm/` imports.
- **Decisions.** `maxIterations` is the resolution's call count, or the loop's ceiling of 64 when none is declared. The old default of 4 and hard cap of 8 are gone.
- **Tool calls.** `maxToolCalls` is `min(iterations + 1, 64)`. For any count up to 6 this matches the old behaviour.
- **Unchanged loop settings.** The bootstrap-only settings (`minToolCalls`, evidence bytes, context bytes) moved into the module with their old values.
- **Cost per decision.** Each evidence decision now reserves `total ÷ calls`, rounded down to a billionth. With the old $0.25 per-call reservation, the grant's $2.00 total would have refused the 9th decision.
- **What still bounds the loop.**
  - the grant's call, cost and token totals, all enforced per call;
  - the loop's own no-progress checks (`duplicate_tool_request`, `repeat_without_progress`);
  - the run lease.
- **`AS/runtime/loop-limits/evidence-loop.ts`:** its ceilings are already 64, so no change was needed.
- **`service.ts`:** still exactly **6434** lines.

### Also done

- **Stale comment.** The doc comment on `runBudgetAllowance` in `AS/runtime/llm/harness/task-request.ts` is replaced with the report's text.

### Coordinator addition: the grant's claim window no longer caps a claimed run

A grant now has two lifetimes:

- **Claim window.** The issue-time TTL (default 60 s, max 300 s), exposed as `expiresAtMs`. It bounds only when the grant may be claimed.
- **Run lease.** A claim starts it: `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_RUN_MS = 600_000`.
  - At claim, the claim-window timer is replaced with a lease timer. When the lease timer fires, it revokes the grant and aborts any in-flight call as a `TimeoutError`.
  - Every check on a claimed grant uses the lease.
  - `claimCall` now also revokes a grant it finds past its lease; before, it only threw.
  - The host already revokes the grant in a `finally` when the run ends. The lease is the backstop.

**Reveal-authorization lifetime.**

- The authorizations minted at issue live only as long as the claim window. Secret Keys' own 300 s maximum and its per-authorization expiry are untouched.
- A call whose pooled authorization would expire before the call's time window ends (the larger of 1 s and the grant's timeout) exchanges it for a fresh one:
  - The fresh one is minted with `createSessionRevealAuthorization`, from the actor's still-unlocked Secret Keys session, and sized to that one call.
  - The old one is revoked.
  - If the grant was revoked, cancelled or superseded while the fresh one was being minted, or the key changed, the fresh one is revoked immediately.
- The exchange is one-for-one: it happens only for a pooled authorization already taken for this call, so reveals stay capped at the grant's call count.

**Why no Secret Keys change was needed.** Minting per call needs the session unlock, so a claimed grant still dies with the unlock, and with the identity session, which is checked on every call. I judged this model safe and implemented it fully.

**Security properties, one test each.** The tests are in `AS/runtime/llm/tests/execution-grant-lifetime.test.ts` unless marked otherwise.

1. **An unclaimed grant expires promptly.** It is not revoked at 999 ms and is revoked at 1,000 ms, with all 3 issue-time authorizations. After that it cannot be claimed, even when its timer has not run. Nothing was revealed. (`expires an unclaimed grant at the end of its claim window, revoking its authorizations`)
2. **A claimed grant's lifetime is the run lease, not the TTL.**
   - Calls succeed 300,001 ms after claim (past the longest possible TTL) and at the last lease millisecond.
   - At lease end the call is refused, the grant is revoked with its remaining authorizations, and nothing further is revealed.
   - (`keeps a claimed grant calling past its claim window, and refuses and revokes it at the end of its run lease`)
3. **The exchange never widens what the grant may reveal.**
   - 2 calls give 2 issue-time plus 2 exchanged authorizations. Only the exchanged two are revealed, and the originals are revoked.
   - The consumed grant is refused, with no further minting and exactly 2 reveals.
   - (`exchanges one for one, so a claimed grant never reveals more than its call count`)
4. **Nothing is minted that is not needed.** Inside the window, the issue-time authorization is used. (`uses the authorizations minted at issue while they still outlive the call`)
5. **A revoked grant is refused inside its lease.** No authorization is minted, no key is revealed, and the grant cannot be claimed again. (`refuses a claimed grant that was revoked, however much of its lease is left`)
6. **A claimed grant dies with its run's session.**
   - Identity session invalid: refused as `no longer valid`, and revoked.
   - Secret Keys unlock gone: the exchange is refused and the grant revoked, with nothing revealed.
   - (`dies with the actor's session and with the actor's Secret Keys unlock`)
7. **No minted authorization outlives a grant revoked during minting.** The fresh authorization is revoked and never revealed. (`revokes a freshly minted authorization when the grant was revoked while it was minted`)
8. **In-flight call at lease end.** (In `execution-grants.test.ts`: `does not commit a revealed in-flight result after cancellation, expiry, or dependency/settings drift`.) The claim window passing leaves a claimed grant active. A call still in flight when the lease timer fires is aborted with `llm.provider_timeout`, and the grant is revoked.
9. **Late reveal after the lease.** (In `execution-grants.test.ts`: `rechecks active state after a delayed just-in-time reveal crosses the run lease`.) A reveal that finishes after the lease has ended is discarded, and the grant is revoked.

**Test fixture change.** The grant tests' Secret Keys stand-in now behaves as the real service does: an authorization is one-use and is refused once revoked or expired. Without that, property 3 would pass with the exchange removed; with it, removing the exchange fails 5 tests (see controls).

### Coordinator addition: `maxTotalTokensPerRun` through the API

- `AS/api/handlers/llm-generation.ts` now forwards `maxTotalTokensPerRun` in both the `preflight` and `issue` calls. `publicGrant` returns it.
- New handler test in `AS/api/handlers/tests/llm-generation.test.ts`: `forwards a caller's lower run token budget, which the grant stores and returns`. It drives a **real** grant service:
  - A budget of 40,000 comes back from preflight and issue, and `resolve()` returns 40,000.
  - Leaving it out gives 100,000.
  - A string value is refused.

### Test file split

`execution-grants.test.ts` reached 934 lines, and the structure audit fails files over 800. So:

- the fixture moved to `AS/runtime/llm/tests/execution-grant-fixture.ts` (7 exports);
- the lifetime tests moved to `execution-grant-lifetime.test.ts`;
- `execution-grants.test.ts` is now 556 lines.

### Tests updated or added

**Updated `execution-grants.test.ts`:**

- The confirmation test now keys on the run budget.
- The configuration test now asks for tokens, not calls, to trigger confirmation.
- The late-reveal and in-flight-expiry tests now use the lease.
- New: the default-grant test (26 / 100,000 / $2.00 / no prompt) for all three purposes.
- New: the grant-token-budget test.

**`iteration-guards.test.ts`:**

- The cost and token cases now expect the patch to run. The token pot is 30,000.
- New: `leaves the patch its call when an exploration would otherwise use every declared call`.
- New: `holds an explore_and_adapt recovery to its grant, not to the no-grant training budget`.

**New test files:**

- `patch-reserve.test.ts`
- `loop-limits/tests/flow-bootstrap-evidence-loop.test.ts`
- `runtime/tests/recovery-grant-limits.test.ts`, which pins:
  - default calls = 2 + the exploration default;
  - lease ≥ the recovery deadline ceiling;
  - deadline 600 s, and the exploration clock equal to it.

**Other additions:**

- A ledger `release()` test in `llm/tests/run-budget.test.ts`.
- `declaredCallsPerRun` assertions in `annotation/tests/run-budget.test.ts`.
- A bootstrap test in `service-bootstrap/tests/generation.test.ts`: 11 decisions complete, and a model that never finishes is stopped at exactly 12 (the grant's count). Each decision reserves $2/12.

## Commands run and observed results

- **Type check.** `npx tsc --noEmit -p .` in `packages/fluxiq`: exit 0, no output. Run twice, before and after the test split.
- **Affected tests before updating them.** 6 failed / 251 passed.
  - The 6 were the predicted consequences: 2 iteration-guards cases and 4 grant tests.
  - One grant test took 15,001 ms because its old claim-window expiry never fired.
- **Targeted runs after the changes:**
  - execution-grants: 34/34 (before the split).
  - annotation: 60/60.
  - llm tests after the split: 10 files, 125/125.
  - patch-reserve and generation: 12/12.
  - The first pass had 2 failures, both mistakes in my tests: a wrong expectation of 62 where 63 is correct, and a fixed Flow ID that cannot be reused. Both were fixed.
- **Negative controls.** Each change was applied to a scratch-backed copy, run, then restored. `cmp` confirmed each restore.

  | Control | Result |
  | --- | --- |
  | A. Authorization exchange disabled | 5 failed / 29 passed (lease, exchange, session-unlock, mint-race and in-flight-expiry tests) |
  | B. Claimed grants held to the claim window | 5 failed / 29 passed |
  | C. Patch hold-back disabled | 3 failed / 3 passed (the cost, token and declared-call patch tests) |
  | D. Old bootstrap `min(calls ?? 4, 8)` and $0.25 per-decision cost | 2 failed / 6 passed (both bootstrap cases) |
  | E. `explore_and_adapt` removed from `explicitGrantBudget` | 1 failed / 5 passed (the `explore_and_adapt` grant test) |

- **First `pnpm check` (Core root).** Exit 1: `FAIL [file-lines] …/llm/tests/execution-grants.test.ts: 934 lines exceeds the 800-line limit`. This is what led to the split.
- **Final `pnpm check`.** Exit 0.
  - `structure-audit: passed (140 warning(s), 254 baselined)`, the same warning count as before this task.
  - `packages/contracts`, `packages/client-gateway-websocket`, `packages/fluxiq` and `apps/web` all reported `check: Done`.
  - The audit also prints `1 baseline entries can be lowered` (`service.ts`, 6468 → 6434). I did not run `pnpm structure:baseline`.
- **Runtime suite, first full run.** `npx vitest run src/programs/automation-studio/runtime --root packages/fluxiq`: `Test Files 1 failed | 104 passed (105)`, `Tests 1 failed | 958 passed (959)`. The failure was `instruction-readiness.test.ts` at 15,004 ms.
- **Runtime suite, second full run.** Identical: 958/959, with the same test at 15,003 ms. The suite took 103 s wall time.
- **The timed-out test alone.** `npx vitest run src/programs/automation-studio/runtime/tests/service-flows/tests/instruction-readiness.test.ts`: 1/1 passed in 5,025 ms. It imports only the large-project model fixture and the service, none of the changed code.
- **API, shared host and Secret Keys suites.** `npx vitest run src/programs/automation-studio/api src/programs/_shared src/programs/secret-keys --root packages/fluxiq`: 33 files, 222/222 passed.
- **Line count.** `wc -l AS/runtime/service.ts` gives 6434.

## Not verified

- **No real-provider run.** Nothing was run against DeepSeek. The cost figures are arithmetic from the ledger and DeepSeek's price constants, not a measured recovery.
- **Real Secret Keys.** The exchange was not exercised against the real `SecretKeysService`; the stand-in mimics its one-use and expiry rules. By reading the code:
  - the real `createSessionRevealAuthorization` accepts the requested TTL of `max(1000, timeoutMs)` (≤ 45 s), and further caps it at the session unlock's remaining time;
  - the session unlock's own expiry is untouched.
- **Live surfaces.** No live browser run, no Lab run, and nothing through the web panel.
- **Wider test runs.** I did not run Core `pnpm test` across all packages, or `pnpm build`.
- **A clean full-suite run.** 959/959 was never seen in a single run: the readiness test timed out under load both times, and it passes alone.
- **`apps/web`.** It passed `pnpm check` at that moment, but the supervisor is editing it concurrently.

## Open questions or contradictions found

1. **API contract type (not my file).** `AS/api/contracts/llm.ts` `AutomationStudioLlmExecutionLimitRequest` has no `maxTotalTokensPerRun`. The handler reads it from the untyped part of the payload, so the web client cannot send it type-safely until the contract gains `maxTotalTokensPerRun?: number`. `AutomationStudioLlmExecutionPurpose` there still lacks `explore_and_adapt`.
2. **Deviation from the report's plan: the grant enforces tokens.** The report said the run ledger alone would enforce the 100,000. Flow Bootstrap has no ledger, so I made the grant enforce it too, on reported usage. The grant's refusal is unnamed and revokes the grant, as the existing cost refusal does. For recoveries the ledger always refuses first.
3. **Bootstrap's last call.** When the grant's token or cost total runs out, the bootstrap fails as a provider-request failure. The loop does not force a completion on its last affordable decision. A small follow-up could require the last affordable decision to complete, or give bootstrap a run ledger with named codes.
4. **Behaviour changes for callers.**
   - A caller that passes `maxUses` without `maxCalls` for an iterating purpose is refused (uses must equal 26).
   - The web panel (`run-input-model.ts`, `FlowRunView.tsx`) and the Lab (`live-llm-plan.ts`) still ask for 2 calls, as flagged earlier.
   - The public `expiresAtMs` is now the claim-window end. A UI showing it as "grant lifetime" would under-report a claimed grant, which may run for 600 s.
5. **Key copies in memory.** A default grant now mints 26 reveal authorizations at issue (was 10; originally 2). Each holds a copy of the decryption key in memory for at most the TTL (60 s by default); all are zeroed on revoke or expiry. A call made after the window mints one more, which is consumed by that call's reveal.
6. **Trace quirk (existing).** The exploration trace's `providerCalls` counts loop iterations, including one the exploration refused before any provider was asked. The patch-reserve test asserts on the receipt and the task list instead.
7. **Documentation not updated.** Core architecture docs that describe the 120 s recovery deadline, the 10-call default, per-call caps, or grant expiry were not updated; they are not in my owned paths.
8. **Baseline not lowered.** `pnpm structure:baseline` was not run. The `service.ts` baseline could drop from 6468 to 6434.
9. **Slow test under load.** `instruction-readiness.test.ts` needs about 5 s alone and exceeded 15 s in both full runs, now that the suite has 959 tests. Its timeout may need raising.
