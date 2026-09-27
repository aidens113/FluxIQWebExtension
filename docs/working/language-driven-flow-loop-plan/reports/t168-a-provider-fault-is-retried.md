# t168 — A provider fault the adapter called temporary is now asked again

Core (`F:\!FluxIQ`), branch `dev`. Nothing committed, Core not built.

---

## Outcome

**Done**, with one deliberate deviation from the brief and one finding that
refutes its premise.

- A new module, `runtime/llm/provider-retry/`, retries a temporary provider fault
  with backoff at the one seam every provider call passes through, on by default,
  with no configuration.
- **It would not have saved either of the two runs the brief names.** Both died on
  an **HTTP 400** — a deterministic refusal the adapter correctly marks
  non-retryable. Their artifacts say so plainly (below).
- **A per-call deadline timeout is deliberately excluded** from the retry set. It
  is `retryable: true` and the loop above already re-asks it; retrying it inside
  the call duplicated the outer re-ask and turned five provider requests into
  eleven in an existing test.
- The coordinator's two mid-task additions to `harness/context-packet.ts` (the
  judge's conversation, and `recordCount` on a recent action) are done and
  measured. They are a separate change and are described in their own section.

---

## 1. What was built

### The seam

`runtime/llm/harness/run.ts` sent the provider request inline and turned any
throw into a diagnostic. It now calls `automationStudioLlmProviderCall`, which
owns the attempt loop. The enforced per-attempt deadline moved there unchanged.

That seam covers everything: Core sends a request to a model in exactly one place
— the harness — and the only two other `runTask` callers in the repository are
decorators the harness wraps (`llm/execution/grants.ts:466`,
`service/runtime-adaptation/repair-authority.ts:107`). Verified by
`grep -rn "\.runTask("` over `packages/fluxiq/src`: three hits, two of them
decorators. So the diagnosis, the patch, the Flow build, every exploration
decision and every result verification inherit the retry, including ones written
later. Nothing opts in and nothing can decline it.

### The files

| File | What it is |
| --- | --- |
| `provider-retry/limits.ts` | Every bound, one frozen record, with the worst case stated |
| `provider-retry/decision.ts` | The pure decision: retry or stop, how long to wait, and which bound stopped it |
| `provider-retry/hint.ts` | A provider's own `Retry-After`, in seconds, milliseconds, or as an instant |
| `provider-retry/account.ts` | The record: every failed attempt, its wait, and why the loop stopped |
| `provider-retry/ledger.ts` | The per-run wall-clock allowance, and Core's own process-wide instance |
| `provider-retry/call.ts` | The loop, the abortable wait, and the per-attempt deadline |
| `provider-retry/index.ts` | Barrel; exported from `runtime/llm/index.ts` |
| `provider-retry/tests/policy.test.ts` | 12 tests: the decision, the hint, the ledger |
| `provider-retry/tests/call.test.ts` | 9 tests: the loop, with the clock and the waiting injected |

Also changed: `harness/run.ts` (the loop's call site and the retry diagnostic),
`harness/task-request.ts` (`providerRetry` on the input, `providerRetry` on the
result), `harness/tests/run.test.ts` (4 new tests and a non-spending waiter in the
shared helper), `harness/index.ts` (an export reorder — see §6), and
`llm/tests/harness.test.ts` (two calls given a non-spending waiter, because two
retried faults there cost 8 real seconds).

### The brief's six requirements, answered

**1. Retry a fault the adapter already called retryable, with backoff, honouring
`Retry-After`.** Done, with a caveat the brief did not anticipate: **nothing in
Core can carry a `Retry-After` today.** t145's screened refusal record
(`llm/refusal-record.ts`) holds the status, the declared media type, the body's
byte count and the provider's error object — **not headers**. So `hint.ts` reads a
hint wherever a failure could carry one (a field on the thrown failure, a headers
bag, a `retryAfterMs` on a refusal record) and the backoff table decides for every
DeepSeek failure today. The one-line follow-up that makes it real is in files I do
not own: read `response.headers.get("retry-after")` in `deepseek/refusal.ts` and
carry it as `retryAfterMs` on the record in `refusal-record.ts`. The policy is
already ready for it and a test proves it honours it.

**2. Do not retry a deterministic refusal.** The adapter's `retryable` flag is the
discriminator and nothing is re-derived from the status. A 400 the provider
explained, a 401, a 403, a malformed body, and all twenty pre-flight refusals are
asked once. One documented exception in the other direction — see §2.

**3. Respect the run's budget, and do not double-charge it.**

- **A retry consumes no call against the run budget.** One reservation per harness
  call, made before the loop, charged once on the attempt that answered. Tested:
  a call that made three attempts leaves `budget.snapshot(runId).calls === 1`.
- Reserving per attempt would have been worse than the bug: the second `reserve()`
  is refused as `llm_budget.duplicate_request`, and the projection that stores a
  failed build takes the **newest error** diagnostic
  (`flow-bootstrap/generation-failure/harness-failure.ts`, `findLastError`), so a
  provider fault would have been recorded as the run running out of money — the
  exact misreading that cost a day on `run-muhs8hx3-6fd929e6`. There is a test
  asserting the newest error is still the provider's code and that no
  `llm_budget.duplicate_request` appears.
- For the same reason the retry account is recorded as `info`/`warning` and never
  `error`, and is appended **after** the provider's failure diagnostic.
- **An exhausted budget is still reported as an exhausted budget.** The reservation
  refusal path is untouched: `llm_budget.run_call_limit`,
  `providerInvocation: "not_attempted"`, no provider request, no retry account.
  Tested.
- **But there is a second counter, and a retry does spend it.** The execution grant
  wraps the provider, so every attempt passes through `grants.ts` and
  `settleFailedCall` → `finishCall` spends one grant call per attempt. That is
  consistent with what the grant counts — credential releases to the endpoint,
  which is an exfiltration bound, not a token bound — and with its own disposition
  table (`llm/failure-disposition.ts`: `rate_limited` → `spend_call`,
  `http_error` → `spend_call_on_server_error`). Consequence, stated plainly: a
  retry can consume up to `maxAttempts - 1` extra grant calls per question, so a
  Lab run whose every question were rate limited twice would reach its 48-call
  grant after 16 questions. No retry can revoke a grant: every code I retry is
  `spend_call`, and every `end_grant` code is non-retryable. **This interaction is
  reasoned from the table, not exercised — no test in `runtime/tests` puts a 429
  or a 503 through a grant.** See §8 item 2 for the field that should own this.

**4. Bound it, and state the worst case.** Every bound is a projection: the loop
starts another attempt only when the wait **plus that attempt's own deadline**
still fit, so each figure is a ceiling on the whole thing rather than the point
past which one more unbounded attempt begins.

| Bound | Value | What it means |
| --- | --- | --- |
| Attempts per call | 3 | The first, and two retries |
| One wait | ≤ 5 000 ms | However long a hint asks for |
| Backoff table | 1 000, 3 000 ms | No jitter: one loop, one endpoint, and a random wait would make the bounds unverifiable |
| **Wall clock per call** | **≤ 60 000 ms** | Attempts and waits together |
| **Wall clock added per run** | **≤ 120 000 ms** | Every wait and every retried attempt, across all the run's calls |

At the Lab's 25 000 ms per-attempt deadline that is **one** retry for a slow fault
(25 000 + 1 000 + 25 000 = 51 000 fits; a second at 79 000 does not) and the full
three for a fast one — which is the case that matters, because a 429 arrives in
milliseconds. Against a live run's 300–950 s, retrying may add at most two
minutes in total. Both bounds have tests; the per-call one asserts the clock
never passes 60 000 ms.

**5. Record every retry.** Two channels, and one predicate so they always agree:

- `AutomationStudioLlmTaskResult.providerRetry` — the typed account: every failed
  attempt with its code, status, `retryable`, `elapsedMs`, `waitedMs` and
  `waitSource`, plus `retries`, `waitedMs`, `addedMs` and `stop`.
- A diagnostic, `llm.provider_retried`, so the code reaches the run's receipt
  through `callOutcome`'s `issueCodes`. `info` when the call went on to answer,
  `warning` when it did not, never `error`.

`stop` is the part that matters for the next person measuring wall clock:
`answered`, `not_retryable`, `attempts_exhausted`, `call_deadline`,
`run_allowance`, `cancelled`. A bound that stopped a retry says so by name, so an
exhausted allowance never reads as the provider simply having failed. What a retry
cost in tokens is nothing: a refused attempt returns no usage, and the ledger
charges the reservation once, on the attempt that answered.

**6. What it would have done to the two failed runs.** Answered in §3.

---

## 2. The deviation: Core's own deadline is not asked again

`llm.provider_timeout` is `retryable: true` and this policy still does not retry
it. Three reasons, the third measured:

1. It is **Core's deadline elapsing**, not the provider refusing. The request may
   still be in flight — its provenance is `providerInvocation: "unknown"` — so a
   re-send is a second paid request for a question whose first answer is not known
   to have failed.
2. It is the most expensive fault to repeat: another whole deadline, 25 s in the
   Lab, while a person waits.
3. **The loop above already re-asks it.** `runtime/llm/evidence-loop.ts` treats a
   decision that ran past its deadline as one to make again next iteration, with
   the evidence advanced — better than re-sending an identical request, and
   already counted and recorded as a step. Retrying it inside the call broke
   `runtime/tests/deepseek-bootstrap-exploration.test.ts` → "asks again after a
   decision that runs past its deadline" (the build ended
   `flow_bootstrap.evidence_invalid_decision`, because the retry consumed the next
   scripted reply) and turned 5 provider requests into 11 in
   `deepseek-recovery-requests.test.ts`. With the exclusion both files pass (15
   tests).

A 429, a 5xx and a dropped connection are all still retried: for those something
answered, and what it answered was "not this time". The exclusion is one named
set, `NEVER_ASKED_AGAIN`, with the reasoning in the file, and it has its own test.

---

## 3. What this would have done to `run-muhs8hx3-6fd929e6` and `run-muhtuizo-c458e49c`

**Nothing. Their fault is outside the retryable set, and correctly so.**

Both bundles say the same thing (`events.ndjson` sequence 3 and
`snapshots/live-llm.json` → `build.failure`):

```json
{"failure":{"code":"flow_bootstrap.provider_transport_unknown","stage":"provider_request","httpStatus":400},
 "providerCalls":null,"providerInvocation":"attempted"}
```

- `httpStatus: 400`. The adapter marks `llm.provider_http_error` retryable only at
  `status >= 500` (`deepseek/provider.ts`), so a 400 is `retryable: false` and this
  policy asks once. Retrying it would spend the run's money to be told the same
  thing.
- `observed.accounting.calls: 1`, `inputTokens: 0`, `totalTokens: 0`,
  `estimatedCostUsd: 0` — **one** provider request each, not "roughly ten
  successful exploration calls" as the brief describes;
  `exploration: null`, `evidenceLoop: null`, `observedCalls: []`.
- `durationMs: 167200` and `193832`, against a 25 000 ms per-call deadline and one
  call. **That gap is not retries — there were none — and this change does not
  explain it either.** Whatever consumed 167 and 194 seconds happened around a
  single failed provider request, and the bundles do not say what. Worth its own
  task.
- Neither bundle carries a `providerRefusal`, so the artifacts **cannot** say why
  the 400 happened. These runs predate t145's record reaching a stored failure.
  The logs hold nothing either (`core.log` is 348 bytes; no `400`, no
  `invalid_request`, no `max_tokens`).

So the audit's finding 2 stands as a gap in the runtime, but the two runs it was
counted against are not instances of it. The honest revision: **the provider-fault
finding is worth 0 of the ~18 reportable failures so far, and every future
transient one.**

---

## 4. The coordinator's two additions to `harness/context-packet.ts`

Separate from the retry work, as asked.

**(a) The judge can now read the conversation.** `conversation` was gated on an
inline pair — `runtime_diagnosis`, `runtime_patch` — while `resultSummary` was
gated on a named set that already included `loop_verification`. Rather than add a
third kind to a second list, I renamed the set to
`AUTOMATION_STUDIO_FINISHED_RUN_TASK_KINDS` (its own comment already said "the
calls that are looking at a finished run") and both slots now read it. One list,
so there is one thing to widen rather than two. Its only other use site was the
`resultSummary` gate; the membership is unchanged. The two stale doc comments that
said "Runtime tasks only" / "Runtime diagnosis and patch only" are updated.

Checked before making it: no provider-side gate refuses a `loop_verification`
request that carries a conversation (`harness/request-evidence-check.ts` and
`deepseek/preflight.ts` contain no task-kind rule for `conversation`), so this
cannot reproduce the `RECENT_ACTION_FIELDS` failure mode where the provider kept
its own copy of a list.

**(b) `recordCount` on a recent action.** Read from `action.metadata?.recordCount`,
which is where `runtime/recovery/repair-context/step-parameters.ts` already reads
it, and carried only when it is a non-negative safe integer. Added to the type, to
the `RECENT_ACTION_FIELDS` allow-list the `satisfies` clause checks, and to
`isAutomationStudioLlmRecentActionContext`, which now refuses a float, a negative
or a string in that field.

**Cost, measured** (a throwaway vitest harness, run then deleted, using
`estimateTokens` and the real packer):

| Addition | Bytes | Estimated tokens | Share of a 441,531-token build |
| --- | --- | --- | --- |
| `recordCount`, worst case (all 12 recent actions carry one) | +216 | 420 → 474, **+54** | 0.012 % |
| The judge's conversation, 20 turns of a realistic sentence | +1 541 | 75 → 460, **+385** | 0.087 % |

The conversation slot's own ceiling is unchanged —
`AUTOMATION_STUDIO_LLM_CONVERSATION_MAX_BYTES = 4 000`, about 1 000 estimated
tokens, 0.23 % — and that is the pre-existing bound the two repair calls already
live under. The packet's byte ceiling does not move, so the worst case does not
move either; `loop_verification` simply now reaches a slot the other two already
reached.

---

## 5. Commands run, and what they printed

From `F:\!FluxIQ\packages\fluxiq`:

- `npx tsc --noEmit` → **clean, exit 0** (run five times across the work; the two
  `noUncheckedIndexedAccess` errors it found in my own test file are fixed).
- `npx vitest run src/programs/automation-studio/runtime/llm/provider-retry` →
  **21 tests, 2 files, all passed**.
- `npx vitest run .../runtime/llm/provider-retry .../runtime/llm/harness/tests/run.test.ts`
  → **31 passed, 3 files**.
- `npx vitest run src/programs/automation-studio/runtime/llm` →
  **516 passed, 2 failed, 518 collected across 56 files; 6 files failed.**
  Both failing tests are `verify-result-grant.test.ts`, both
  `llm.provider_request_construction_failed` thrown from `deepseek/provider.ts:104`,
  and both call `resolved.provider.runTask(...)` **directly** — my code is not in
  the path. Five of the six failing files never load at all (§6).
- `npx vitest run src/programs/automation-studio/runtime/tests` →
  **479–483 passed, 11–15 failed, 494 collected across 74 files**, varying run to
  run under load exactly as the brief warned. The brief's baseline was 493
  collected, so nothing is lost to collection.
- The failures re-run alone and attributed: `service-bootstrap/tests/generation.test.ts`
  (6), `permission.test.ts` (4), `permission-ask.test.ts` (2),
  `service-flows/tests/representation.test.ts` (2) = **14 stable failures, none
  mine** — proven by reverting both of my `context-packet.ts` edits (same 14) and
  then also setting `maxAttempts: 1` to switch retrying off entirely (**15**, i.e.
  one *more* than with my changes on). `service-adaptation/tests/modes.test.ts` and
  `service-flows/tests/instruction-readiness.test.ts` appear only under load.
  These areas — `flow-bootstrap/action-permissions.ts`, `executor/run-state.ts`,
  `executor/graph-run.ts`, `executor/node-execution.ts` — are all modified in the
  working tree by other workers.
- The two tests most at risk from this change, run alone:
  `deepseek-bootstrap-exploration.test.ts` + `deepseek-recovery-requests.test.ts`
  → **15 passed, 2 files**.

From `F:\!FluxIQ`:

- `node scripts/structure-audit.mjs` → **1 violation, unchanged from the baseline I
  captured before writing any code**:
  `[directory-files] runtime/llm/tests/: 26 source files exceeds the 25-file limit`.
  That directory was already at 26 before I started and I added no file to it — my
  tests live in `provider-retry/tests/` and `harness/tests/`. A `diff` of the audit
  output before and after my work shows **only four advisory line counts moving**,
  two of them mine (`context-packet.ts` 491 → 529, `llm/tests/harness.test.ts`
  679 → 685; both advisory, neither a violation) and two other workers'. No new
  finding, no new FAIL. `pnpm structure:baseline` was not run.

---

## 6. A pre-existing module cycle that stops 5 test files loading, and its one-line fix

Independent of this task, and worth the supervisor's attention.

Twenty-two files in `runtime/llm` failed to load with
`TypeError: automationStudioExploredEvidenceLabel is not a function` at
`deepseek/system-prompt.ts:29`. The cycle:

```
harness/index.ts → harness/context-packet.ts → flow-bootstrap/index.ts
  → generation-failure/index.ts → generation-failure/diagnostic-parse.ts
  → llm/index.ts → provider-factories.ts → deepseek/index.ts
  → deepseek/provider.ts → request-body.ts → system-prompt.ts → ../harness.ts  (incomplete)
```

`system-prompt.ts` builds one of its instruction strings from
`automationStudioExploredEvidenceLabel` **while its own module body runs**, reading
it through the `harness.ts` star re-export. Every edge here predates my work: the
`harness → flow-bootstrap` value imports are at HEAD in both
`harness/run.ts:2` and `harness/context-packet.ts:18`, and HEAD's
`generation-failure.ts` imported `../llm/index.ts` at module scope too.

**Proof it is not mine:** disabling my one barrel-level edit
(`export * from "./provider-retry/index.ts"` in `llm/index.ts`) reproduces the
identical failure.

**What I did about it:** moved `explored-evidence-label.ts` above
`context-packet.ts` in `harness/index.ts` — a file I own — with a comment saying
the order is load-bearing and why. That recovered **17 of the 22** files.

**The 5 that remain** all enter through `llm/harness.ts` itself, where the star
re-export cannot have run when the cycle closes:
`llm/tests/evidence-loop-provider.test.ts`, `llm/tests/opaque-target-override.test.ts`,
`llm/tests/run-call-record.test.ts`, `llm/harness-options/tests/plan-parameter-resolution.test.ts`,
`llm/stages/tests/protocol.test.ts` — about 27 tests.

**The fix, tested and then reverted because `deepseek/` is not mine.** In
`deepseek/system-prompt.ts`, import the label from its own module instead of
through the barrel:

```ts
import { automationStudioExploredEvidenceLabel } from "../harness/explored-evidence-label.ts";
```

With that line, `stages/tests/protocol.test.ts` and `llm/tests/run-call-record.test.ts`
both pass (18 tests). I reverted it and confirmed the file is byte-identical to
before the experiment. The durable alternative is for that module to build the
string inside a function, or for `generation-failure/diagnostic-parse.ts` to stop
importing the llm barrel at module scope.

---

## 7. Not verified

- **No live run.** Nothing here was exercised against the real DeepSeek endpoint.
  The retry has never absorbed a real 429.
- **The grant interaction is reasoned, not exercised.** No test in `runtime/tests`
  or `llm/tests` puts a 429 or a 503 through an execution grant, so "a retry spends
  a grant call and never revokes the grant" rests on `llm/failure-disposition.ts`'s
  table plus `settleFailedCall`'s two branches, read, not run.
- **`Retry-After` is honoured only where a failure carries one**, and no Core
  adapter carries one today, so that path is proved by a test double and not by the
  provider.
- **Core was not built** (`pnpm build` not run) and `pnpm check` was not run — the
  brief asked for `tsc`, the two vitest suites and the structure audit.
- The per-run allowance's eviction (64 runs, least recently charged) is tested, but
  its behaviour in a long-lived server process — where eviction *loosens* the bound
  for an old run — is reasoned, not measured.
- The 167 s and 194 s durations in the two failed runs are **unexplained**. I
  established what they are not (they are not retries, and there were no ten
  exploration calls) and did not establish what they are.
- I did not verify whether `maxAttempts: 3` is the right number against real
  DeepSeek rate-limit behaviour; 1 000/3 000 ms comes from what a rate limit
  usually needs, not from measurement.

## 8. Open questions, and one contradiction worth naming

1. **The brief's premise does not survive its own artifacts.** It says a retry
   "would very likely have absorbed" what killed the two runs. Both died on a 400.
   The task was still worth doing — nothing retried a transient fault, and that is
   real — but its live justification is now "every future transient fault", not
   "these two runs". The 13-of-18 figure in the t163 audit should be read as
   11-of-18 (finding 1) plus 0 (finding 2).
2. **The grant already has a slot for this and it is pinned to zero.**
   `providerRetryCount` exists on the grant contract (`api/contracts/llm.ts:55`),
   on its metadata (`execution/grant-metadata.ts:33`, typed as the literal `0`),
   and in the resolution the harness receives (`grants.ts:485`), and **every one of
   them is 0**. That is the natural owner of a per-run retry allowance: an operator's
   grant would state how many attempts it pays for, and the grant's call accounting
   would then be intentional rather than incidental. Threading it into
   `input.providerRetry.maxAttempts` is the follow-up, and it touches `execution/`
   and the Lab's plan, neither of which is mine.
3. **Two call counters with different meanings.** The run budget counts questions
   asked of the model; the grant counts credential releases to the endpoint. Both
   are defensible and they now disagree by up to two per retried question. Someone
   should decide whether that is the intended reading and write it down, because a
   reader comparing a run's receipt with its grant's usage will find the difference
   and have nothing to attribute it to.
4. **`AUTOMATION_STUDIO_LLM_MAX_TIMEOUT_MS` is 45 000 and the Lab caps a call at
   25 000.** A caller that asks for 45 000 gets no retry at all under the 60 000 ms
   per-call ceiling (45 000 + 1 000 + 45 000 = 91 000). That is the honest
   arithmetic — a caller that asked for a 45-second deadline has said its call may
   take 45 seconds — but if anyone wants retries at that deadline, the per-call
   ceiling is the number to change, in `provider-retry/limits.ts`.
5. **`runtime/executor/defensive/retry-hint.ts` and `provider-retry/hint.ts` answer
   the same question twice.** That directory is another worker's in-flight,
   untracked work, and importing a value across the `llm` → `executor` edge would
   add a barrel-bypass finding and couple my module to uncommitted files, so I
   wrote the narrower reader and named the duplication in its file comment. Once
   both land, they should be one function in a directory neither owns —
   `runtime/loop-limits/` is where `config.mjs` says such a value belongs.
