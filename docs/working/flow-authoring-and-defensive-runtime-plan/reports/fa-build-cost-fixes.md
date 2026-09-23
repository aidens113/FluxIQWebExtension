# t098 — making a Flow build cost what it should

Fixes A, B, C and E from `fa-build-cost.md`, plus the further reductions the
supervisor added mid-task. D (several node runs per reply) was **not**
implemented, as instructed.

Worktrees: `F:/fxwork/t098/!FluxIQWebExtension` and `F:/fxwork/t098/!FluxIQ`,
both on `task/t098-build-cost-caching`. Nothing was committed or pushed, and no
Lab run, campaign or provider call was made.

---

## Outcome

Done. All four briefed fixes are in with tests, and four further reductions were
found, costed and implemented; three more were costed and deliberately left.

The headline measurement, on one payload built from Core's own code, serialized
in the old key order and the new: **the contiguous reusable prefix went from
1,272 bytes to 50,693 of a 50,711-byte user message.**

---

## A. The invariant block is now a contiguous prefix

**File:** `packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek-provider.ts`,
`providerUserPayload`.

The order is now: `taskKind`, `promptVersion`, `expectedOutput`, `outputSchema`,
then `context.{schemaVersion, stage?, projectId, flowId, instructions,
policyGates?, flowBootstrap?, reusableContext?}`, then
`context.evidenceLoop.{tools, evidence, iteration}`. Nothing was removed and
nothing moved between messages; only the key order changed.

Two deviations from the ranked list's suggested order, both deliberate:

- **`outputSchema` stays at the head, not the tail of the constant block.** The
  list asked for it after the node catalog, which is impossible without moving
  it inside `context` and changing the shape the model reads. Keeping the shape,
  the only way to put it after the catalog is to put it after the whole of
  `context`, which would also put it after the evidence — outside the prefix on
  every call, instead of only on the two calls where `canAmend` flips. Head of
  the block is worth more: 5,726 bytes cached on thirteen calls of fifteen
  against nothing cached on all fifteen.
- **`evidence` comes before `iteration`, not after.** See reduction 5 below.

### Measured

Built from the real code paths (the adapter's own `outboundBody`), on a fixture
whose catalog and evidence window are sized like a real build's. The *same*
payload serialized both ways:

| | Contiguous prefix | Of message | 
|---|---:|---:|
| Old order, two calls over one window | 1,272 B | 2.5% |
| Old order, window grew by one result | 1,272 B | 2.5% |
| New order, two calls over one window | 50,707 B | 99.99% |
| New order, window grew by one result | 50,693 B | 99.96% |

Message: 50,711 bytes. The fixture's `outputSchema` is smaller than a real
build's (its tool input schemas are stubs), which is why the old-order prefix
measures 1,272 rather than the 6,499 the diagnosis measured on run 1's real
payload. The *relative* claim is the one that matters and it is identical:
**33,807 bytes of invariant material moved from behind the per-call counter to
in front of it, and the evidence window moved in front of it too.**

The 99.96% figure is a best case and should be read as one: the fixture's window
only ever appends. A real window also evicts, prepends a history entry once
anything is left out, and moves an answered entry to the end — each of which
cuts the prefix back to where it happens. See "left deliberately" below.

**Tests** — `runtime/llm/tests/provider-cache-prefix.test.ts` (new):
- two calls over one window differ only in the counter's digit, and the counter
  is the last thing in the message;
- every constant key is inside the prefix, in the written order;
- a window that only grew keeps all its earlier results inside the prefix.

## B. Cache-hit tokens are read and priced

**Files:** `runtime/llm/deepseek-pricing.ts` (new), `deepseek-provider.ts`,
`harness/provider.ts`, `harness/provider-result.ts`, `evidence-loop-decision.ts`,
`evidence-loop.ts`.

- `AutomationStudioLlmUsageSummary` gains `cacheHitInputTokens` and
  `cacheMissInputTokens`, which *divide* `inputTokens` rather than adding to it.
- The adapter reads `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens`, and
  `prompt_tokens_details.cached_tokens` as a fallback. A split larger than the
  input, or whose halves do not add up to it, is **dropped** rather than
  refused: the reply is sound and the call is worth having.
- `estimateAutomationStudioDeepSeekCostUsd(input, output, cacheHit = 0)` prices
  the hit tokens at a new named constant. Rates are now scaled by 1,000 rather
  than 100 so the three-decimal hit rate stays integral; the two existing rates
  produce byte-identical results (`(12, 5)` is still exactly `0.00001188`).
- The loop's accounting totals `cacheHitInputTokens` across a build.
- Both strict validators learned the fields: `validUsage`'s exact-key check in
  `evidence-loop-decision.ts` and `rejectUnexpectedFields` in
  `harness/provider-result.ts`. Missing either would have turned a usage report
  into a **discarded decision**, so a test pins that a decision carrying the
  split is still usable.

### The one number in this task that is not measured

`AUTOMATION_STUDIO_DEEPSEEK_PEAK_CACHE_HIT_INPUT_USD_PER_MILLION_TOKENS = 0.044`
is a tenth of the recorded peak cache-miss rate, which is the ratio DeepSeek has
published and the ratio the diagnosis assumed. **Nothing in either repository
sources it**, exactly as nothing sources the 0.44 beyond a dated review note.
Please confirm it against DeepSeek's current price list before quoting a cost
figure from it.

It cannot cause an overspend. A grant reserves against
`estimateAutomationStudioDeepSeekInputTokens`, which measures the bytes about to
be sent and knows nothing about caching, so every authorized call still holds
back the full cache-miss price. The hit rate prices only a call already made —
a measurement, not a promise. That is stated in the constant's own comment.

## C. A refused look no longer blocks its own retry

**Files:** `runtime/llm/repeat-policy.ts` (new
`automationStudioLlmEvidenceLookWasRefused`), `runtime/llm/evidence-loop.ts`.

### The decision the brief asked for, and why

The ranked list said to delete the request signature when "the result's
`resultCode` marks a rejection and `effectApplied` is false". Implemented
literally, that breaks a rule Core holds on purpose and has a test for: **an
action repeated with nothing whatever having happened is still a repeat**
(`repeat-policy.test.ts`, "does not let the same refused action be asked for
again"). `mutationEpoch` keys exactly that, and it is the no-progress guard's
whole job.

So the fix is narrowed to the case the list's own reasoning identifies —
`repeat-policy.ts`'s header already argues that a look repeated after *another*
action failed is a new question, "but only for a look after another action
failed, not for a look that itself failed":

> A **look** the domain refused looked at nothing, so it did not answer the
> request. A refused **action** is unchanged: it moves `attemptEpoch` whether or
> not it applied, so it already frees every look, and its own retry stays a
> repeat.

The run artifacts confirm this is the right cut. Run 2's pair is
`web.detect_repeating_structure` — declared `effect: "observe"` in
`domain/src/runtime/llm-evidence/tools.ts:255`, producing `page_unreadable` from
`structure/detect.ts` — a look, refused, retried twice, answered twice from a
refusal carrying nothing:

```
 5 web.detect_repeating_structure  web.action.rejected.page_unreadable
 6 web.detect_repeating_structure  llm_evidence_loop.already_answered
 7 web.detect_repeating_structure  llm_evidence_loop.already_answered
```

Core reads this from the result's own two general statements and never from a
code: `effectApplied`, and an evidence value of `{ok:false, …}` — the shape
Core's own decision instruction names and tells the model to read as feedback.
Core must never learn a domain's codes (`runtime/recovery/runtime-exploration.ts`
says so).

**Both doors are opened.** The request's signature is deleted, *and* a refused
look is not recorded as the tool's observation for the epoch — otherwise the
retry is answered `already_observed` instead and the fix does half a job. The
same rule applies to the free initial observation.

### Does a rejected observation count as progress? No — and why

**A refused look is a step without progress.** Deleting the signature removes
the bound that used to stop a refused look being asked forever, so the
no-progress guard has to be that bound instead. Three reasons:

1. Nothing happened and nothing was gathered beyond the refusal itself. The
   same refusal repeated teaches nothing.
2. A call that *threw* is already counted this way (`toolFailed` does
   `stepsWithoutProgress += 1`). A look that returned tidily and said no is the
   same event in a better envelope; counting one and resetting for the other is
   precisely what would leave the retry unbounded.
3. The model still learns from the first refusal. Acting on what it learned
   means doing something else, which clears the count on its first answered
   call. At the default of 24 steps a build genuinely working around a refusal
   has room; one that is only asking again stops.

A refused **action** still calls `progressed()`, unchanged — it is bounded by
its own signature instead.

**Tests** — `runtime/llm/tests/repeat-policy.test.ts`: a refused look asked
again runs (2 tool calls, both carrying the refusal code, no `already_*` row,
and the tool still offered on the second decision); and a loop that only ever
asks for a refused look still ends `repeat_without_progress` after three steps.
The two pre-existing guards — a refused action is still a repeat, a run that only
repeats itself still ends — pass unchanged.

## E. Calls are counted per iteration, end to end

**Core** — `runtime/service/flow-bootstrap-commands/evidence-trace.ts`:

- `providerCallCount` / `decisionCount` = distinct trace iterations above zero.
- `iterationCount` = those plus the deterministic iteration-0 observation where
  there was one, which is what its name says and what the downstream reader
  holds it to.
- `traceStepCount` = rows, which is now genuinely a different number.
- `totalProviderCallCount` = iterations + calls outside the loop.

**Core** — `runtime/flow-bootstrap/generation-failure.ts` had the identical
defect on the *refused* build's path (`decisionCount: result.trace.length`).
Fixed in the same work so the two paths cannot disagree about what a call is.

**Core, latent crash found and fixed.** `sanitizeEvidenceLoopTrace` refused a
trace longer than `maxIterations + 1` rows, and the loop writes **two** rows for
an `amend_draft` carrying a `rerun`. A build that corrected itself often enough
would have had its whole published record thrown away by its own sanitizer. The
row bound is now `maxIterations * 2 + 1`, and the same bound applies to the
published `steps` in `generation-failure.ts`.

**This repository** — `packages/test-runner/src/existing-fluxiq-control/adaptation-evidence-loop.ts`.
This is the module the brief's `existing-fluxiq-control.ts` re-exports; the
bounds live there, not in the barrel. `traceStepCount === iterationCount` became
`iterationCount <= traceStepCount <= 129`, and `steps` is bounded by rows rather
than by decisions. **Without this the fix is a regression**: the moment Core
counts calls correctly, every build that corrected itself fails this reader's
contract before its Flow is read.

`packages/test-runner/src/live-llm/build-usage.ts` needed no code change —
`providerCalls` already comes from `totalProviderCallCount` via
`flow-lane/creation/build-proposal.ts:243`, which I do not own. Its doc comment
now records what the number is and what it was.

**Tests** — Core `service/flow-bootstrap-commands/tests/evidence-trace.test.ts`:
a trace of 7 rows over 4 iterations plus iteration 0 reports 4 calls, 4
decisions, 7 rows, 5 iterations, and satisfies the reader's contract; and 64
doubled rows sanitize instead of throwing. This repository
`existing-fluxiq-control/tests/adaptation-evidence-loop.test.ts`: more rows than
iterations reads; fewer is refused; 129 reads and 130 is refused; steps bounded
by rows.

---

## Further reductions (the supervisor's addition)

Costed against the standing constraint: nothing here caps calls, truncates the
evidence window, pages or trims the node catalog, or narrows what the model may
ask for.

### Implemented

**1. Derive the wrapper's `kind` instead of demanding it.** Core asked for
exactly one output shape and refuses any other, so `kind` on the wrapper carries
no information. A reply of `{"summary":…,"decision":{…}}` was complete, usable,
and thrown away. Filled in when absent; still refused when present and naming
another task's answer.

**2. Lift a reply that *is* the decision, with no wrapper.** The likeliest
shape error in a nested grammar, and unambiguous: only the three decision kinds
are read this way.

**3. Cut an over-long summary; write a missing one.** `summary` was required,
held to 240 characters, and a reply one character over lost its decision with
it. The summary is a line a person reads; the decision is what the call was paid
for. Over-long is now cut to 240, and a missing one is written from the decision
(`"tool_call core.run_node"`).

**4. Drop a field of the model's own rather than the call under it.** A reply
carrying an extra top-level key — a note, a rationale — was refused outright.
The wrapper is now rebuilt from the three fields that mean something. This is
the safe direction: the rule it replaces existed because a field Core cannot
check must not be carried onward, and dropping it carries it onward *less* than
refusing did.

All four are one total function,
`automationStudioLlmEvidenceNormalizedDecisionResponse` in
`evidence-loop-decision.ts` — the module that already owns the loop's grammar,
so this is provider-neutral rather than DeepSeek-specific. **Nothing about what
a decision may be is relaxed**: the decision itself still goes through
`automationStudioLlmEvidenceParseDecision` unchanged, and the harness's own
validators are untouched behind it.

*Saving, honestly stated:* **unmeasured, and unmeasurable from the artifacts.**
Run 1 lost two of its sixteen calls to shape rather than content
(`llm.provider_output_invalid` at step 6 and `llm_output.invalid_evidence_decision`
at step 17), but Core records no per-call payload, so which check refused them
is not on the record. Each of the four removes a whole class of "complete reply,
discarded call" at zero capability cost, so they are worth having whether or not
they were these two. At ~12,400 input tokens a call, two calls is about 12% of
run 1's spend.

**5. Put the evidence window in front of the iteration counter.** This is the
largest byte saving in the task and it costs nothing. The window is built in the
order things happened and usually only gains an entry, so on a call that evicted
nothing every earlier entry is byte-for-byte what the last call carried. With
the counter last, that whole block extends the reusable prefix. Measured above:
a grown window shares 50,693 of 50,711 bytes. The draft entry and the budget
entry, which do change every call, are already appended after the window by
`evidence-loop.ts`, so nothing had to move for this.

### Costed and deliberately left

**6. Put the history entry at the end of the window instead of the start.**
Once the window starts evicting, `context-window.ts` *prepends* a history entry
that changes as more calls are left out — which cuts the reusable prefix back to
the start of `evidence` for the whole second half of a build. Moving it to the
end would keep the whole-entry block prefix-stable. Not implemented: it breaks
the module's documented chronological ordering ("shown in the order they
happened", oldest first, and the history is the oldest thing), and that ordering
has a live-run failure behind it. Worth its own task with its own reasoning
about what the model reads.

**7. Tell the model when a correction is not converging.** Run 1 spent four of
its sixteen calls re-running one extraction step's parameters (steps 7–14, four
`draft_rerun` + `core.run_node` pairs, each pair one paid decision) and still
shipped a Flow that returned 24 rows where 13 were wanted. Each rerun
*succeeded*, so `progressed()` reset the guard every time and the loop had no
way to notice. Two designs:
- *Safe:* show the model, in its evidence, how many times it has re-run this
  step and whether the result changed. Information, not a cap; removes no
  capability. Not implemented only because it is a new Core behaviour with its
  own design surface, not a fix to an existing one.
- *Unsafe, and rejected:* count a rerun whose result is unchanged as a step
  without progress. This can end a build that is genuinely converging, which is
  the one thing the constraint forbids.

The underlying cause is fix F (whether `extract-list`'s numeric bounds can read
`$49.99` and `3.7 out of 5 stars`), which is not in this brief. Until that is
settled the model has no way to express the filter and will keep discovering so
at a call apiece.

**8. Truncate an over-long amendment list instead of discarding the reply.**
`readAmendments` returns nothing for more than 16 amendments, throwing the whole
reply away, when the loop's own comment already argues that "a reply that named
four steps and mistyped one has still said three things worth doing". Taking the
first 16 would be consistent. Not implemented: it needs the same change in two
validators and no run has been observed hitting it.

### Rejected outright

Anything that caps calls, shortens the evidence window, pages or trims the node
catalog, or narrows the decision grammar. The diagnosis recommends against them
and the constraint forbids them.

---

## Commands run and observed results

Core (`F:/fxwork/t098/!FluxIQ`):

- `pnpm --filter fluxiq check` → `tsc --noEmit`, no output, exit 0.
- `node scripts/structure-audit.mjs` → `structure-audit: passed (176
  warning(s), 360 baselined)`.
  - It **failed** first: `FAIL [file-lines] …/llm/deepseek-provider.ts: 810
    lines exceeds the 800-line limit.` Split by moving the rates, the cost
    function and the cache-split reader into `runtime/llm/deepseek-pricing.ts`
    (provider 740 lines), which is a real separation: dated provider prices a
    person reviews, against Core's contract with the endpoint.
- `pnpm check` (whole repo: structure tests, task tests, audit, `-r check`) →
  exit 0.
- `pnpm docs:check` → `Deterministic framework reference is current.` after
  `pnpm docs:reference`. **The checked-in reference was already stale before
  this task** — it recorded `deepseek-provider.ts:33` for a constant that was at
  line 42, and `live-patch.ts:202` for one now at 337 — so the regenerated diff
  is 2,010 insertions and 666 deletions, most of it other people's drift rather
  than this task's four new exports.
- `npx vitest run src/…/runtime/llm src/…/runtime/service/flow-bootstrap-commands
  src/…/runtime/flow-bootstrap src/…/runtime/recovery` →
  `Test Files 85 passed (85)`, `Tests 1029 passed (1029)`.
- `npx vitest run src/…/runtime/llm` (final) →
  `Test Files 42 passed (42)`, `Tests 446 passed (446)`.
- `npx vitest run` (whole package, final) → `Test Files 1 failed | 350 passed
  (351)`, `Tests 1 failed | 3032 passed | 1 skipped (3034)`. The one failure is
  `service-flows/tests/scale-pages.test.ts`, `AssertionError: expected
  1058.4663999999975 to be less than 500` — a wall-clock assertion in a scale
  test, nothing I touched. Run alone: `Test Files 1 passed (1)`.
- `pnpm --filter fluxiq build` → clean.

This repository (`F:/fxwork/t098/!FluxIQWebExtension`):

- `pnpm -r check` → exit 0, every package `Done`.
- `pnpm --filter @fluxiq-web-extension/test-runner test` (and
  `node --test "dist/**/*.test.js"` after a rebuild against the new Core dist) →
  `# tests 1313 / # pass 1313 / # fail 0`. Run three times; the first reported
  one file-level `not ok` for `dist/bench/tests/evaluate-run.test.js` with no
  failing subtest, which passed alone (14/14) and on both later full runs.
- `pnpm --filter …/test-contracts --filter domain test` → exit 0; domain
  `# tests 760 / # pass 760 / # fail 0`.
- `pnpm build` → every package `Done`.
- `pnpm check` → **fails, and it failed before I touched anything**:
  `FAIL [working-docs] docs/working/README.md is out of date with the
  documents' header blocks. Run "pnpm structure:baseline" to regenerate it.`
  Nothing in `docs/` differs from `HEAD` in this worktree, and the rule indexes
  only top-level `docs/working/*.md`, so this report cannot have caused it. It
  needs `pnpm structure:baseline`, which rewrites a shared document — the
  supervisor's to run, not a worker's.

### On the flakes

Core's full suite was run three times. The first two reported 19 and 5 failures;
**every one was a 15-second timeout, an `EBUSY` unlink on Windows, or a
wall-clock assertion**, the sets differed between runs, and every failing file
passed when re-run. Twenty-nine such files run with `--no-file-parallelism`
gave `Test Files 29 passed (29)`, `Tests 128 passed (128)`. This machine has
faulty RAM and the suite is heavily parallel; I have treated these as
environmental and said so rather than hiding them.

Two failures across those runs were **real and mine**, both from fix E, and both
are corrected expectations rather than corrected code:
`runtime/tests/service-bootstrap/tests/rejections.test.ts` expected
`decisionCount: 4` where three decisions were made, and
`flow-bootstrap/tests/generation-failure.test.ts` expected a 66-row published
trace to be refused.

---

## What Core's paired document should record

1. **A new Core module and a new public rate.**
   `runtime/llm/deepseek-pricing.ts` now owns the three DeepSeek rates, the cost
   estimate and the cache-split reader.
   `AUTOMATION_STUDIO_DEEPSEEK_PEAK_CACHE_HIT_INPUT_USD_PER_MILLION_TOKENS =
   0.044` is a **dated, unsourced provider price** on the same footing as the
   0.44 beside it, and needs confirming against DeepSeek's live price list. It
   can never make a reservation cheaper.
2. **The payload's key order is now load-bearing.** A key added to
   `providerUserPayload` must go on the correct side of the line: anything that
   varies per call belongs after the evidence. Getting it wrong costs about half
   the input bill silently. `docs/architecture/automation-studio/llm-flow-bootstrap.md`
   was updated to say so; the paragraph claiming Core "intentionally does not
   assume cache-hit … discounts" was false and is corrected.
3. **`AutomationStudioLlmUsageSummary` gained two fields, and two strict
   validators had to learn them in the same change** — `validUsage`'s exact-key
   check and `rejectUnexpectedFields`. A future usage field that teaches only
   the adapter will not produce an extra field; it will produce a discarded
   decision.
4. **`cacheHitInputTokens` is on the loop's accounting but not on the wire.**
   Putting it on `AutomationStudioBootstrapAccounting` would ripple into the
   `accountingFields` tuple in `api/contracts/adaptation.ts`, `hasExactFields`
   in `generation-failure.ts`, `sanitizedBootstrapAccounting`, the API handler
   and this repository's readers. Until then, the proof that caching is working
   is `estimatedCostUsd / inputTokens` falling below 0.44/M.
5. **It is made optional deliberately.** A required field broke
   `packages/test-runner/src/flow-lane/creation/tests/permission-required-diagnostic.ts`
   in this repository, which a concurrent task owns and I must not touch. Core
   always writes it.
6. **The four counts published by `evidenceTraceAuditDetail` are three
   different things** and the file now says so: `providerCallCount` /
   `decisionCount` are paid calls, `iterationCount` adds the deterministic
   opening observation, `traceStepCount` is rows. Only the last moves by two
   when a decision edits the draft and re-runs a step.
7. **Core records no per-call payload,** so a reply refused for shape leaves
   nothing behind to diagnose. `llm.provider_output_invalid` covers about six
   distinct checks under one code. The four normalisations above remove most of
   the reasons that matters, but if shape refusals recur, naming *which* check
   refused — without recording the content — would make the next one
   diagnosable in minutes rather than not at all.

---

## Not verified

- **No live provider call, Lab run or campaign of any kind.** Everything here is
  unit-tested and byte-measured. Whether DeepSeek's cache actually hits on the
  new prefix, and at what rate, is exactly what fix B was built to answer and
  can only be answered by a real run.
- **The real cache-hit price.** See fix B.
- **The real prefix share on a live build.** 99.96% is this fixture's best case,
  where the window only appends. Eviction, the prepended history entry and a
  moved answered-entry each cut it back; how often those happen on the ten sites
  is not known. The floor is fix A alone, which the diagnosis measured at 55%.
- **Which checks actually refused run 1's two unparseable replies.** Not
  recorded; see point 7 above. The four normalisations are justified by removing
  whole classes of waste at no cost, not by having been shown to be these two.
- **Wall-clock effect.** Prefill time should fall with a cache hit. Not
  measured.
- **Browser behaviour.** Nothing here touches a content script, the background
  worker, pairing, permissions or the panel, so no manual browser validation was
  performed.
- **`pnpm check` in this repository still fails** on the pre-existing
  `docs/working/README.md` staleness. I did not regenerate it because it is a
  shared document.

## Open questions and contradictions found

1. **The ranked list's fix C, taken literally, contradicts a rule Core holds on
   purpose and tests.** Resolved by narrowing it to a refused *look*, which is
   what the list's own reasoning identifies and what both live runs actually
   hit. Flagging it because the list will be read again.
2. **The ranked list's fix A ordering is not achievable without changing the
   payload's shape,** which the brief forbade. Resolved as described under A.
   The two deviations are deliberate and commented in the source.
3. **`packages/test-runner/src/existing-fluxiq-control.ts` contains a literal
   NUL byte** at offset 53,217, inside a regex character class
   (`.replace(/[\0-\x1f\x7f]/gu, " ")`). It makes `grep`/ripgrep treat the file
   as binary and refuse to print matches. Pre-existing; I did not touch that
   region. It should probably be `\x00`.
4. **`docs/reference/framework-reference.md` was stale in Core before this
   task**, so `pnpm docs:check` was already failing. Regenerating it was
   unavoidable (I added exports) and pulls in unrelated drift.
5. **The node catalog describes 25 definitions while `core.run_node`'s input
   schema enumerates all 59 ids.** The model may therefore name 34 nodes it has
   never been told anything about. Both blocks are invariant, so this costs
   nothing per call after fix A — but it is a correctness question worth its own
   look, and it is adjacent to the four wasted extraction reruns.
