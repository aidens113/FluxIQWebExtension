# t254-investigate: why the creation purse's per-call hold blocks repair rounds

Worker label: t254-investigate. Core read-only at `C:/Users/osrs_/FluxStuff/!FluxIQ`
dev `d401eeaa`. R = `packages/fluxiq/src/programs/automation-studio/runtime`.
No code changed. Figures below are counts, tokens and dollars only.

## Outcome

Done. The $0.019 that stopped murzln6g is not a purse hold on one call. It is the
**round gate** in `R/flow-bootstrap/unfinished-build/phases.ts` (`nextRoundHold`
plus `exhaustedBound`): the last decision's purse hold added to the last judge
call's hold, which is $0.0144 + $0.0043 = $0.0187, against $0.0111 left. About
71% of that $0.0187 is not input the provider would read. It is a packed-request
overcount ($0.0038), bytes/3 overcounting ($0.0019), and two 2,000-token reply
reserves ($0.0048). A true upper bound that removes those three, with input
counted exactly and smaller per-kind `max_tokens`, needs $0.0106 and would have
opened a repair round for murzln6g. Even so, the money left buys **at most 1–2
repair decisions**: priced uncached, the real input alone is $0.0067 per
decision, against about $0.0025 actually paid with the cache. The rest of the
fix is structural: the gate's judge count, and holding back money for judging
during exploration.

## 1. How the holds are computed (files and formula)

**Per-call purse hold (decide, judge, instruction reading).** It is the same
for every call made under the creation purse:

- `R/llm/harness/run.ts:68` calls `measuredInput(request, provider)` (lines
  350–363). That returns `estimatedInputTokens = max(packed, sent)`:
  - packed: `ceil(bytes(JSON.stringify(harnessRequest)) / 3)`, using
    `R/llm/token-estimation.ts` (`AUTOMATION_STUDIO_LLM_CONSERVATIVE_UTF8_BYTES_PER_TOKEN = 3`).
  - sent: `ceil(bytes(system + user message contents) / 3) + 16`, from
    `R/llm/deepseek/request-body.ts:27` (`measureAutomationStudioDeepSeekInput`;
    16 is the chat-framing reserve).
- `run.ts:156` calls `automationStudioLlmBuildPurseHoldCall`
  (`R/llm/build-purse/harness-hold.ts`) with `maxOutputTokens = request.tokenLimits.maxOutputTokens`.
- `R/llm/build-purse/projected-cost.ts` hands the price to the provider's
  `estimateCostUsd` (`R/llm/deepseek/provider.ts:75`), which is
  `estimateAutomationStudioDeepSeekCostUsd(in, out, cacheHit=0, model)` in
  `R/llm/deepseek/pricing.ts`. Every input token is priced as a cache miss, at
  the **peak** rate. For deepseek-flash that is $0.30/M input (miss),
  $0.006/M (hit, never used for the hold) and $1.20/M output.
- `R/llm/build-purse/purse.ts` `hold()` refuses the call if
  `spent + pending + hold > ceiling + 1e-9`. Otherwise it holds the amount and
  later settles at the reported cost (cache-discounted, also at peak rates).
- **Hold = estimatedInputTokens × $0.30/M + maxOutputTokens × $1.20/M.**

**Reply allowance per kind.** Every request sends `max_tokens = maxOutputTokens`
and `thinking: disabled` (`request-body.ts:43–45`). The output side of the hold
is therefore already a true bound, because the provider cannot reply past it.

| Call | Cap | Where set | Reply part of hold |
| --- | --- | --- | --- |
| Build decision (explore/repair) | 2,000 | `AUTOMATION_STUDIO_LLM_DECISION_REPLY_TOKENS`, `R/llm/harness/token-limits.ts`; applied at `R/service.ts:1565` | $0.0024 |
| Judge (first, ask-again, confirm) | 2,000 (t239) | `AUTOMATION_STUDIO_LLM_JUDGE_REPLY_TOKENS`, same file; applied in `R/result-verification/verify.ts:187` | $0.0024 |
| Instruction reading (phase `read`) | 8,000 | default `AUTOMATION_STUDIO_LLM_DEFAULT_REPLY_TOKENS` | $0.0096 |
| Chat panel command | 600 | panel command | $0.0007 |

**Judge call count.** `verify.ts` asks again on any non-yes, and
`R/result-verification/build-test/judge.ts:137` (`confirmAnswer: true`) confirms
a yes with a second call. So judging a build's Flow is **two sequential calls**
whenever the first one answers. Lane C's confirming call is already at
d401eeaa: all 18 judge calls in these runs are in 9 pairs with byte-identical
requests.

**Round gate (what actually stopped murzln6g and murz83zy).** In `phases.ts`:

- After each round, `holds.decisionUsd = purse.lastProjectedCostUsd`. That is
  the hold of the round's **last** decision.
- After judging, `holds.judgeUsd = purse.lastProjectedCostUsd`. That is the hold
  of the **last** judge call.
- `nextRoundHold` returns `decisionUsd + judgeUsd`, with one judge call counted.
- `exhaustedBound` ends the build on `"cost"` when `purse.leftUsd() < need`.
- The message comes from `R/flow-bootstrap/unfinished-build/budget-exhausted.ts:134`.

**Loop count (`R/llm/loop-budget.ts`).** It only counts. It enforces nothing
(t234). `R/llm/evidence-loop/cost-purse.ts` runs each decision under the same
purse. Neither one holds money back for the test's judging that follows the
round.

**Reconstructing the current hold.** The step logs record usage and cost but
not the hold. The packed request is not logged either, so the packed measure
cannot be recomputed. I modelled it as the sent measure plus a constant
packed-only overhead on decisions. The packed request carries the full
`flowBootstrap` catalog with every node definition, while the provider sends
names only plus the described nodes (`request-body.ts:228–237`). Taking 12,800
tokens (about 38 KB) for that overhead reproduces all three figures Core
reported:

| Run | Core said | Reconstructed |
| --- | --- | --- |
| murzln6g gate | $0.019 | $0.0187 |
| murz83zy gate | $0.015 | $0.0153 |
| murwdp4f purse refusal of next decision | $0.016 | last decision's hold $0.0160 (the next one is slightly larger) |

For judges the sent measure is the larger one: their packed request has no
catalog and no system prompt or schema. This overhead is **inferred**, not
measured.

## 2. Hold versus actual, per call kind (6 runs, 206 calls, all `finish_reason: stop`)

Nearest-rank percentiles. "Est in" is today's sent measure (bytes/3 + 16).
"Hold now" adds the inferred packed overhead to decisions.

**Decide (explore and repair), n = 177**

| | max | p95 | median |
| --- | --- | --- | --- |
| Est in (tokens) | 36,930 | 33,772 | 21,767 |
| Actual in (tokens) | 34,117 | 28,105 | 17,783 |
| Cache hit (tokens) | 27,904 | 19,456 | 9,856 (56% share) |
| Out (tokens, cap 2,000) | 371 | 256 | 91 |
| Actual cost | $0.00765 | $0.00508 | $0.00246 |
| Hold now | $0.01732 | $0.01637 | $0.01277 |
| Hold now / actual cost | 8.1× | 7.7× | 5.1× (min 2.2×) |

**Judge, first call, n = 10**

| | max | p95 | median |
| --- | --- | --- | --- |
| Est in | 7,781 | 7,781 | 5,774 |
| Actual in | 6,422 | 6,422 | 4,509 |
| Out | 537 | 537 | 425 |
| Cost | $0.00193 | $0.00193 | $0.00142 |
| Hold | $0.00473 | $0.00473 | $0.00413 |
| Hold / cost | 3.9× | 3.9× | 3.0× |

**Judge, second call (ask-again or confirm, same request), n = 8**

| | max | p95 | median |
| --- | --- | --- | --- |
| Out | 625 | 625 | 434 |
| Cost | $0.00084 | $0.00084 | $0.00060 (96% cache hit) |
| Hold | $0.00473 | $0.00473 | $0.00413 |
| Hold / cost | 7.7× | 7.7× | 7.1× |

**Instruction reading (`read`), n = 4.** Input about 2,130 tokens, output at most
129 tokens, cost at most $0.00038, hold $0.0105: **28–34×**. The 8,000-token
reply reserve is 91% of that hold.

**Chat, n = 6.** Hold $0.0014 against cost $0.0003, about 4.3×.

**Input measure against actual.** For decisions, est/actual is 1.235 median
(range 1.08–1.32); for judges, 1.28. Bytes per actual token across all calls:
minimum 3.24, median 3.72, maximum 4.38.

## 3. What makes the hold large

The median decision hold now is $0.01277, against an actual median cost of
$0.00246. It breaks down as follows:

1. **Real input priced all cache-miss**: 42% (17,783 tokens × $0.30/M =
   $0.0053). This is the gap a true bound cannot close. DeepSeek's cache is
   best-effort, and with caching the real median cost of that input is about a
   third of that.
2. **Packed-request measure**: 30% (inferred, about $0.0038). `measuredInput`
   takes `max(packed, sent)` so that the harness's size refusal never disagrees
   with the adapter's. The same figure is then used as the **price**, although
   the packed bytes (the full node catalog) are never sent or billed.
3. **The 2,000-token reply reserve**: 19% ($0.0024). Observed decision replies
   are at most 371 tokens, median 91. The cap is 22× the median reply and 5.4×
   the maximum.
4. **bytes/3 overcounting the sent input**: 9% (about 1.235×).

For murzln6g's gate ($0.0187), the same parts are:

| Part | Amount |
| --- | --- |
| Packed overhead on the decision | $0.0038 |
| bytes/3 overcount (decision $0.0014, judge $0.0005) | $0.0019 |
| Two reply reserves (2 × 2,000 tokens) | $0.0048 |
| Real input priced uncached (decision 22,452 tokens, judge 4,742) | $0.0081 |

Structural problems in the gate:

- **It over-reserves the next decision.** It prices the next round's first
  decision at the previous round's **last** one. Every first repair decision in
  these runs was smaller than that: 0.39–0.90×, median about 0.74× (for
  example, murz83zy 9,812 against 21,318 tokens, murwcmx2 18,864 against
  34,117), because a repair round starts with a fresh window.
- **It under-reserves judging.** It counts **one** judge call, but judging is
  two sequential calls.
- **Nothing reserves judging during exploration.** murzln6g spent $0.089 over
  30 exploration decisions and reached its test with nothing left for a repair.

A further point: bytes/3 is **not itself a provable upper bound**. The densest
call measured 3.24 bytes per token, an 8% margin. Text that tokenizes more
densely (non-Latin scripts, for example) would breach it. The purse only counts
such a breach after the fact.

## 4. Proposal: a hold that stays a true upper bound

Per call: **hold = exactInputTokens(sent messages + chat template) × miss rate +
max_tokens(kind) × output rate.** Input stays uncached and peak-priced.
`max_tokens` is the figure the request sends, so the provider cannot exceed it.
The purse still refuses any call whose hold does not fit, so the ceiling can
never be crossed.

1. **P1, price what is sent.** Split `measuredInput` into a size measure (keep
   the max, for the window refusals) and a price measure (the provider's sent
   messages only). It needs no new dependency.
2. **P2, count exactly.** Use the DeepSeek tokenizer on the exact messages, plus
   the template's framing tokens, in place of bytes/3. This removes the 1.235×
   overcount and is the only provable input bound. It needs a tokenizer
   dependency and its data, since Core has none today.
3. **P3, per-kind `max_tokens`:**
   - decisions: 2,000 → **1,000**. That is 2.7× the corpus maximum of 371 and
     1.7× t234's all-time maximum of 593.
   - judges: 2,000 → **1,000**, or 1,200 if the 3× margin matters. The maximum
     seen here is 625 (1.6×).
   - instruction reading: 8,000 → **1,000** (maximum 129).
   - The risk is a truncated reply (`finish_reason: length`), which is a quality
     cost because the call is asked again. It is not a purse risk.
4. **Round gate (`phases.ts`).** Count judging as the **two** calls it makes,
   held in sequence. Do not price the next round's first decision at the
   previous round's last: either measure the actual first repair request, or
   let the purse decide that call.
5. **Reserve judging during the round.** Have the loop's purse check (or a
   pending hold on the purse) keep back 2 × the judge hold, so decisions can
   never spend what the test's judging needs. This is a true bound in both
   directions: no decision can strand the judge.

**Per-run counterfactual.** In the decision columns, "+N" is extra decisions in
a repair round. The model starts at 0.74× the last decision's input, grows by
the run's median growth, and charges the median cost of the last 10 decisions.
Each column is "no judge reserve / two judge holds reserved".

| Run (outcome) | Left | Gate now | P1 gate | P2 gate | P3 gate | Decisions now | P2 decisions | P3 decisions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| murzln6g (judged no, stopped at gate) | $0.0111 | $0.0187 no | $0.0148 no | $0.0130 no | **$0.0106 opens** | +0 / +0 | +2 / +0 | +2 / +0 (+1 if the 2nd judge is reserved at its observed cost) |
| murz83zy (stopped at gate) | $0.0123 | $0.0153 no | $0.0115 opens | $0.0101 opens | $0.0077 opens | +2 / +0 | +4 / +0 | +4 / +2 |
| murwdp4f (purse refused next decision at $0.016) | $0.0128 | $0.0201 | $0.0163 | $0.0143 | $0.0119 opens | +0 (refused) | +2 / +0 | +2 / +1 |
| murwcaj0 (ended otherwise) | $0.0108 | $0.0161 | $0.0123 | $0.0109 | $0.0085 | +1 / +0 | +2 / +0 | +3 / +1 |
| murwcmx2 (ended otherwise) | $0.0025 | — | — | — | — | +0 | +0 | +0 |
| murwd8le (passed) | $0.0421 | $0.0166 | — | — | — | +12 / +9 | +14 / +11 | +14 / +12 |

Under P1, murwdp4f's next decision (hold about $0.0124) would have been sent.

**Would murzln6g have had a repair round?** Under P1 + P2 + P3 with today's
gate, yes, but only just ($0.0106 needed against $0.0111 left). With the
judging held correctly, as two judge calls, it would have had room for at most
one repair decision, which is unlikely to fix the missing "250 Count" act. At
peak pricing, any true bound leaves the last $0.01 of a $0.10 purse good for
about one or two decisions near the end of a build. The lever that matters for
repairs is P5 plus an earlier wrap-up: exploration should stop while one repair
round and its judging are still affordable. Shrinking the hold alone does not
get there.

## 5. Files a fix would touch, and tests that pin today's holds

**Source:**

- `R/llm/harness/run.ts`: `measuredInput`, split into size and price; the
  ledger's `reservedCostUsd` and the purse hold read the price measure.
- `R/llm/deepseek/request-body.ts`: `measureAutomationStudioDeepSeekInput`
  counts exactly. Add a new tokenizer module under `R/llm/deepseek/`, plus the
  package dependency in `packages/fluxiq/package.json`.
- `R/llm/token-estimation.ts`: kept only as a fallback for providers without a
  tokenizer.
- `R/llm/harness/token-limits.ts`: `AUTOMATION_STUDIO_LLM_DECISION_REPLY_TOKENS`
  and `AUTOMATION_STUDIO_LLM_JUDGE_REPLY_TOKENS`, plus a new instruction-reading
  cap.
- `R/service.ts` (about line 1565) and the instruction-authority call site in
  `R/service/flow-bootstrap-commands/creation-purse.ts` / `service.ts`: apply
  the reading cap.
- `R/flow-bootstrap/unfinished-build/phases.ts`: `nextRoundHold`,
  `exhaustedBound`, `CallHolds`, with judging counted as two calls and the first
  decision measured.
- `R/flow-bootstrap/unfinished-build/budget-exhausted.ts`: the wording of what
  the round needed.
- `R/llm/loop-budget.ts` and `R/llm/evidence-loop/cost-purse.ts`, or a pending
  reservation on `R/llm/build-purse/purse.ts`: the judging reserve.
- `R/llm/step-log/model-step.ts`: record `holdUsd`, `estimatedInputTokens` and
  `maxOutputTokens` in `meta.json`. They are absent today, which is why this
  investigation had to infer the packed overhead.

**Tests that pin current behaviour (under R):**

- `llm/harness/tests/run-size.test.ts`, which pins bytes/3, the packed
  fallback, and "reserves the request's own size and price".
- `llm/build-purse/tests/purse.test.ts` and `llm/harness/tests/paid-refusal.test.ts`.
- `llm/evidence-loop/tests/cost-purse.test.ts` and `llm/tests/loop-budget.test.ts`
  (the worst-case counting).
- `result-verification/build-test/tests/judge.test.ts`: "run 38 (C7): the judge's
  call is held at a 2,000-token reply…", plus the confirm and refusal cases.
- `tests/service-bootstrap/tests/creation-spend.test.ts` case (d): "asks each
  decision for a reply of at most 2,000 tokens".
- `flow-bootstrap/unfinished-build/tests/repair-rounds.test.ts`: "opens none the
  purse cannot fund for one decision plus a judge…" and "holds a judge at what
  the purse last priced it at…".
- `flow-bootstrap/unfinished-build/tests/judged.test.ts:310` and
  `flow-bootstrap/unfinished-build/tests/budget-figures.test.ts`.
- `llm/tests/run-budget.test.ts` and `tests/recovery-default-limits.test.ts`
  (the standing decision).
- `llm/deepseek/tests/refusal.test.ts` and
  `llm/domain-instructions/tests/provider.test.ts` (measurement).

## What changed and why

Nothing in either repository. I added three scratch scripts under
`<scratchpad>/t254/` (`collect.js`, `stats.js`, `sim.js`) with their outputs
`rows.json` and `rows2.json`. These are counts only: no prompt or page text was
copied.

## Commands run and observed results

- `git log -1` in Core printed `d401eeaa Merge task t253…`.
- `collect.js` read `meta.json` and `request.json` for every step in the 6
  runs: 206 model calls (177 decide, 18 judge, 4 read, 6 chat, 1 decide with
  status error), all `finish_reason: stop`.
- `stats.js` produced the tables in section 2. `sim.js` produced the
  counterfactual table in section 4.
- I took the gate and refusal figures from the cost-ending text in each run's
  `summary.json` (murzln6g $0.089 / $0.011 / $0.019; murz83zy $0.088 / $0.012 /
  $0.015; murwdp4f $0.087 / $0.013 / $0.016). My sums of `costUsd` agree to
  within $0.0005.

## Not verified

- **The packed-request overhead (about 12,800 tokens per decision) is
  inferred.** It is fitted to three reported totals and backed by the code (the
  full catalog in the packed request), but not measured, because the logs hold
  neither the packed request nor the hold.
- "Exact count" uses the provider's reported `prompt_tokens` as a stand-in for a
  local tokenizer. No tokenizer was run.
- The counterfactual decision counts assume that repair inputs, growth and
  per-decision cost follow each run's observed medians, and that today's purse
  rules otherwise apply. The model's behaviour in a repair round is not
  simulated.
- I did not check DeepSeek's live price page or its billing-time rule. The
  rates come from Core's `pricing.ts` (dated 2026-09-23).

## Open questions or contradictions found

- **Off-peak billing.** All six runs started between 04:33 and 06:04 UTC on
  **Saturday** 2026-10-03, which `pricing.ts` says is billed at half the peak
  rate. The purse counts spend at peak rates too, so murzln6g's counted $0.089
  would have been billed at about $0.045. Whether the $0.10 ceiling means
  peak-priced or billed dollars is a policy question for the user. A
  time-aware price is only a true bound if DeepSeek bills by request time and
  a call cannot straddle a peak boundary.
- **The brief's "lane C adds a confirming judge call" is already at d401eeaa**
  (`build-test/judge.ts` `confirmAnswer: true`). Every judgement in these runs
  was two calls, while the round gate counts one.
- **t234 and t239 justify the 2,000-token caps with a ≥3× margin over the
  recorded maximum.** The judge's maximum here (625 tokens) already leaves only
  3.2×. Caps of 1,000 would drop that margin rule.
